/**
 * Hermetic check of the volunteer-hub demo seed (Fil, Marketplace, Hébergement, Pro). The generated SQL is replayed
 * against the real D1 schema in an in-memory SQLite database, so a broken statement, a missing section or a leaky
 * cleanup fails here instead of halfway through a remote `wrangler d1 execute`. The real data-layer functions
 * (the ones the Worker routes call) are then run over the seeded database to prove the app can read and show it.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { DEMO_DOMAIN, DEMO_LABEL, LISTING_MEDIA, POST_MEDIA, cleanupSql, seedSql } from "../scripts/hub-demo/build";
import { PRO_POST_MEDIA } from "../scripts/hub-demo/pro";
import { STAY_MEDIA } from "../scripts/hub-demo/stay";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as H from "./hub-d1";
import * as mk from "./market-d1";
import * as pro from "./pro-d1";
import * as st from "./stay-d1";

// node:sqlite is still experimental, so it is absent from Vite's builtin list and must be
// resolved at runtime instead of being statically imported (Vite would try to bundle it).
interface SqliteStatement { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): unknown }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => SqliteDb };

// order matters: base tables, then the hub/marketplace/stay/pro tables, then the triggers that need them
const SCHEMA = ["schema.generated.sql", "hub.sql", "marketplace.sql", "stay.sql", "pro.sql", "logic.sql"];
const DEMO_LIKE = `'%@${DEMO_DOMAIN}'`;

function freshDb(): SqliteDb {
  const db = new DatabaseSync(":memory:");
  for (const f of SCHEMA) db.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  return db;
}

function asD1(sqlite: SqliteDb): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...params) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...params) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...params),
  } as D1Stmt);
  return {
    prepare: sql => stmt(sql),
    batch: async s => { for (const x of s) await x.run(); return []; },
  };
}

const n = (db: SqliteDb, sql: string): number => (db.prepare(sql).get() as { n: number }).n;
const count = (db: SqliteDb, table: string): number => n(db, `SELECT COUNT(*) AS n FROM ${table}`);
/** Row counts of every table the seed touches, to compare two runs. */
const TABLES = [
  "hub_members", "hub_posts", "hub_post_media", "hub_comments", "hub_likes", "hub_reports",
  "mk_listings", "mk_listing_media", "mk_comments", "mk_reports", "mk_threads", "mk_messages",
  "st_listings", "st_listing_media", "st_requests", "st_request_messages", "st_reviews", "st_reports",
  "pro_profiles", "pro_posts", "pro_post_media", "pro_likes", "pro_comments", "pro_jobs", "pro_threads", "pro_messages", "pro_reports",
  "t_volunteers",
];
const snapshot = (db: SqliteDb) => TABLES.map(t => [t, count(db, t)] as const);
const registered = (db: SqliteDb) => n(db, "SELECT COALESCE(SUM(registered_count),0) AS n FROM t_ramadan_days");

const REAL = "reel@example.org";
/** A real, confirmed volunteer with a hub account (not a demo one). */
function realMember(db: SqliteDb, email = REAL): H.MemberRow {
  db.exec(`INSERT INTO t_volunteers (first_name,last_name,email,phone,day_id,qr_token,status) VALUES ('Réel','Membre','${email}','+212600000000',0,'real-${email}','confirmed');`);
  db.exec(`INSERT INTO hub_members (email, display_name) VALUES ('${email}','Membre réel');`);
  return memberRow(db, email);
}
const memberRow = (db: SqliteDb, email: string) => db.prepare("SELECT * FROM hub_members WHERE email = ?").get(email) as H.MemberRow;
const demo = (db: SqliteDb, key: string) => memberRow(db, `${key}@${DEMO_DOMAIN}`);

describe("hub demo seed: Fil and Marketplace", () => {
  it("creates ten fictional volunteers that can actually sign in", () => {
    const db = freshDb();
    db.exec(seedSql());
    expect(count(db, "hub_members")).toBe(10);
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_members WHERE email LIKE ${DEMO_LIKE}`)).toBe(10);
    // the magic link only resolves members backed by a confirmed volunteer row (see hub-d1.getMe)
    const joined = db.prepare("SELECT v.status AS status FROM hub_members m JOIN t_volunteers v ON lower(v.email) = m.email").all() as { status: string }[];
    expect(joined).toHaveLength(10);
    expect(joined.every(r => r.status === "confirmed")).toBe(true);
    // ...and every demo row is tagged so it can be found again
    expect(n(db, `SELECT COUNT(*) AS n FROM t_volunteers WHERE notes = 'DEMO - profil fictif'`)).toBe(10);
    // phones can never be real: +212 followed by a 0
    expect(n(db, "SELECT COUNT(*) AS n FROM t_volunteers WHERE phone NOT LIKE '+2120%'")).toBe(0);
  });

  it("fills every section and option of the space", () => {
    const db = freshDb();
    db.exec(seedSql());
    // fil d'actualité: ~25 posts by all ten authors, nested replies, uneven likes
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_posts WHERE kind = 'post' AND pinned = 0 AND status = 'visible'")).toBe(26);
    expect(n(db, "SELECT COUNT(DISTINCT member_id) AS n FROM hub_posts WHERE kind = 'post'")).toBe(10);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_comments WHERE status = 'visible'")).toBeGreaterThanOrEqual(60);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_comments WHERE body LIKE '@%'")).toBeGreaterThanOrEqual(10);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_likes")).toBeGreaterThanOrEqual(80);
    expect(n(db, "SELECT COUNT(DISTINCT c) AS n FROM (SELECT COUNT(*) AS c FROM hub_likes GROUP BY post_id)")).toBeGreaterThanOrEqual(6);
    // annonces de l'équipe (colonne de droite)
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_posts WHERE kind = 'announcement' AND pinned = 1 AND status = 'visible'")).toBeGreaterThanOrEqual(1);
    // file de modération (admin): une publication spam et un commentaire déplacé
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_reports WHERE target_type = 'post'")).toBe(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_reports WHERE target_type = 'comment'")).toBe(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_reports")).toBe(1);
    // marketplace: les sept catégories, un vendu, un don gratuit, une annonce douteuse
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_listings")).toBe(14);
    expect(n(db, "SELECT COUNT(DISTINCT category) AS n FROM mk_listings")).toBe(7);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_listings WHERE status = 'sold'")).toBeGreaterThanOrEqual(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_listings WHERE price = 0")).toBe(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_listings WHERE contact_phone IS NOT NULL")).toBeGreaterThanOrEqual(3);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_comments")).toBeGreaterThanOrEqual(20);
    // messagerie: 7 conversations de 3 à 8 messages, dont une sur une annonce vendue et des non-lus
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_threads")).toBe(7);
    const perThread = db.prepare("SELECT COUNT(*) AS c FROM mk_messages GROUP BY thread_id").all() as { c: number }[];
    for (const t of perThread) { expect(t.c).toBeGreaterThanOrEqual(3); expect(t.c).toBeLessThanOrEqual(8); }
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_messages WHERE read_at IS NULL")).toBeGreaterThanOrEqual(3);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_threads t JOIN mk_listings l ON l.id = t.listing_id WHERE l.status = 'sold'")).toBeGreaterThanOrEqual(1);
    // aucune conversation avec soi-même, aucun message orphelin
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_threads WHERE buyer_id = seller_id")).toBe(0);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_messages WHERE thread_id NOT IN (SELECT id FROM mk_threads)")).toBe(0);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_posts WHERE member_id NOT IN (SELECT id FROM hub_members)")).toBe(0);
  });

  it("gives every listing (marketplace and stay) a cover photo that really exists on disk", () => {
    const db = freshDb();
    db.exec(seedSql());
    for (const [table, media, label] of [["mk_listings", "mk_listing_media", "annonce"], ["st_listings", "st_listing_media", "logement"]] as const) {
      const perListing = db.prepare(
        `SELECT l.id, l.title, COUNT(m.r2_key) AS photos,
           COALESCE(SUM(CASE WHEN m.position = 0 THEN 1 ELSE 0 END), 0) AS covers
         FROM ${table} l LEFT JOIN ${media} m ON m.listing_id = l.id GROUP BY l.id`,
      ).all() as { id: number; title: string; photos: number; covers: number }[];
      expect(perListing).toHaveLength(table === "mk_listings" ? 14 : 8);
      for (const l of perListing) {
        expect(l.photos, `${l.title} : au moins une photo`).toBeGreaterThanOrEqual(1);
        expect(l.covers, `${l.title} : exactement une couverture (position 0)`).toBe(1);
        expect(l.photos, `${label} ${l.title} : 4 photos maximum`).toBeLessThanOrEqual(4);
      }
    }

    // la base pointe des clés `demo/<fichier>` : le Worker les sert depuis private/hub/demo/<fichier>.
    // Une clé sans fichier = une annonce à l'image cassée, donc on exige la correspondance exacte.
    const mediaDir = new URL("../scripts/hub-demo/media/", import.meta.url);
    const keys = [
      ...(db.prepare("SELECT DISTINCT r2_key FROM mk_listing_media").all() as { r2_key: string }[]),
      ...(db.prepare("SELECT DISTINCT r2_key FROM st_listing_media").all() as { r2_key: string }[]),
    ].map(r => r.r2_key);
    expect(keys.length).toBeGreaterThanOrEqual(22);
    for (const key of keys) {
      expect(key.startsWith("demo/"), `${key} doit être sous demo/`).toBe(true);
      expect(existsSync(new URL(key.slice("demo/".length), mediaDir)), `${key} absent de scripts/hub-demo/media/`).toBe(true);
    }
    // every listing photo is declared, and no listing photo is an orphan (post photos are checked below)
    const declared = [...Object.values(LISTING_MEDIA).flat(), ...Object.values(STAY_MEDIA).flat()];
    expect([...new Set(keys.map(k => k.slice("demo/".length)))].sort()).toEqual([...new Set(declared)].sort());
  });

  it("gives every member an illustrated avatar and uploads every referenced image (no broken photo)", () => {
    const db = freshDb();
    db.exec(seedSql());
    const mediaDir = new URL("../scripts/hub-demo/media/", import.meta.url);
    const members = db.prepare("SELECT email, avatar_key FROM hub_members WHERE email LIKE ?").all(`%@${DEMO_DOMAIN}`) as { email: string; avatar_key: string | null }[];
    expect(members).toHaveLength(10);
    for (const m of members) {
      expect(m.avatar_key, m.email).toMatch(/^demo\/avatar-[a-z]+\.png$/);
      expect(m.avatar_key).toBe(`demo/avatar-${m.email.split("@")[0]}.png`);
    }
    // every key written anywhere by the seed must be a file that scripts/hub-demo/upload-media.sh will upload
    const keys = new Set<string>();
    for (const [table] of [["hub_post_media"], ["pro_post_media"], ["mk_listing_media"], ["st_listing_media"]])
      for (const r of db.prepare(`SELECT r2_key FROM ${table}`).all() as { r2_key: string }[]) keys.add(r.r2_key);
    for (const m of members) keys.add(m.avatar_key!);
    expect(keys.size).toBeGreaterThanOrEqual(50);
    for (const key of keys) {
      expect(key, key).toMatch(/^demo\/[a-z0-9-]+\.(jpg|png)$/);
      expect(existsSync(new URL(key.slice("demo/".length), mediaDir)), `${key} absent de scripts/hub-demo/media/`).toBe(true);
    }
    // and nothing in the folder is an orphan image
    const images = readdirSync(mediaDir).filter(f => /\.(jpe?g|png|webp)$/.test(f)).sort();
    expect(images).toEqual([...keys].map(k => k.slice("demo/".length)).sort());
    expect(n(db, "SELECT COUNT(DISTINCT post_id) AS n FROM hub_post_media")).toBe(Object.keys(POST_MEDIA).length);
    expect(n(db, "SELECT COUNT(DISTINCT post_id) AS n FROM pro_post_media")).toBe(Object.keys(PRO_POST_MEDIA).length);
    expect(Object.keys(POST_MEDIA).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(PRO_POST_MEDIA).length).toBeGreaterThanOrEqual(6);
  });

  it("marks every demo profile, post and listing as test data", () => {
    const db = freshDb();
    db.exec(seedSql());
    const members = db.prepare("SELECT display_name, bio FROM hub_members").all() as { display_name: string; bio: string }[];
    expect(members).toHaveLength(10);
    for (const m of members) {
      // le nom est le seul champ visible partout (fil, annonces, messagerie) : le marqueur doit y être
      expect(m.display_name).toContain("profil test");
      expect(m.bio).toContain(DEMO_LABEL);
    }
    const bodies = db.prepare("SELECT body FROM hub_posts").all() as { body: string }[];
    expect(bodies).toHaveLength(28);
    for (const b of bodies) expect(b.body.startsWith(DEMO_LABEL), b.body.slice(0, 40)).toBe(true);
    const descriptions = db.prepare("SELECT description FROM mk_listings").all() as { description: string }[];
    expect(descriptions).toHaveLength(14);
    for (const d of descriptions) expect(d.description.startsWith(DEMO_LABEL)).toBe(true);

    // un vrai membre (option --me) ne doit jamais porter le marqueur
    const withMe = freshDb();
    withMe.exec("INSERT INTO hub_members (email, display_name) VALUES ('moi@example.org','Moi');");
    withMe.exec(seedSql("moi@example.org"));
    const real = withMe.prepare("SELECT display_name FROM hub_members WHERE email = 'moi@example.org'").get() as { display_name: string };
    expect(real.display_name).toBe("Moi");
  });

  it("leaves the public Ramadan capacity untouched", () => {
    const db = freshDb();
    db.exec("INSERT INTO t_ramadan_days (day_number, date, capacity, registered_count) VALUES (1,'2026-03-01',120,7);");
    db.exec(seedSql());
    // the insert trigger counts the demo volunteers in, the seed takes them back out
    expect(n(db, "SELECT registered_count AS n FROM t_ramadan_days WHERE id = 1")).toBe(7);
    db.exec(seedSql());
    expect(n(db, "SELECT registered_count AS n FROM t_ramadan_days WHERE id = 1")).toBe(7);
    db.exec(cleanupSql());
    expect(n(db, "SELECT registered_count AS n FROM t_ramadan_days WHERE id = 1")).toBe(7);
  });
});

describe("hub demo seed: Hébergement", () => {
  it("populates every screen of the stay tab", () => {
    const db = freshDb();
    db.exec(seedSql());
    expect(count(db, "st_listings")).toBe(8);
    expect(n(db, "SELECT COUNT(DISTINCT member_id) AS n FROM st_listings")).toBe(6);
    expect(n(db, "SELECT COUNT(DISTINCT city) AS n FROM st_listings")).toBeGreaterThanOrEqual(5);
    expect(n(db, "SELECT COUNT(DISTINCT kind) AS n FROM st_listings")).toBe(6);
    expect(n(db, "SELECT COUNT(*) AS n FROM st_listings WHERE price_type = 'gratuit'")).toBeGreaterThanOrEqual(3);
    expect(n(db, "SELECT COUNT(*) AS n FROM st_listings WHERE price_type = 'prix'")).toBeGreaterThanOrEqual(2);
    expect(n(db, "SELECT COUNT(*) AS n FROM st_listings WHERE price_type = 'participation'")).toBeGreaterThanOrEqual(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM st_listings WHERE status = 'paused'")).toBe(1);
    expect(n(db, "SELECT COUNT(DISTINCT capacity) AS n FROM st_listings")).toBeGreaterThanOrEqual(4);
    expect(n(db, "SELECT COUNT(*) AS n FROM st_listings WHERE amenities = '[]'")).toBe(0);
    for (const s of ["pending", "accepted", "declined", "cancelled"]) {
      expect(n(db, `SELECT COUNT(*) AS n FROM st_requests WHERE status = '${s}'`), s).toBeGreaterThanOrEqual(1);
    }
    expect(count(db, "st_requests")).toBe(11);
    expect(count(db, "st_reviews")).toBe(6);
    expect(count(db, "st_reports")).toBe(1);
    expect(count(db, "st_request_messages")).toBeGreaterThanOrEqual(20);
    expect(n(db, "SELECT COUNT(*) AS n FROM st_request_messages WHERE read_at IS NULL")).toBeGreaterThanOrEqual(3);
    // reviews only exist on accepted requests, one per request, written by the guest
    expect(n(db, "SELECT COUNT(*) AS n FROM st_reviews r JOIN st_requests q ON q.id = r.request_id WHERE q.status <> 'accepted' OR q.guest_id <> r.author_id")).toBe(0);
    // no accepted/pending overlap on the same listing
    expect(n(db, `SELECT COUNT(*) AS n FROM st_requests a JOIN st_requests b ON a.listing_id = b.listing_id AND a.id < b.id
      WHERE a.status IN ('pending','accepted') AND b.status IN ('pending','accepted') AND a.start_date < b.end_date AND b.start_date < a.end_date`)).toBe(0);
    // guests fit the listing
    expect(n(db, "SELECT COUNT(*) AS n FROM st_requests q JOIN st_listings l ON l.id = q.listing_id WHERE q.guests > l.capacity")).toBe(0);
    expect(n(db, "SELECT COUNT(*) AS n FROM st_listings WHERE contact_phone NOT LIKE '+2120%'")).toBe(0);
  });

  it("serves the stay content through the real data layer, without any email", async () => {
    const db = freshDb();
    db.exec(seedSql());
    const real = realMember(db);
    const d = asD1(db);
    const out: unknown[] = [];

    const list = await st.listStayListings(d, real.id, { limit: 50 });
    out.push(list);
    expect(list.listings).toHaveLength(7); // the paused one is hidden from search
    expect(list.listings.every(l => l.cover?.startsWith("demo/"))).toBe(true);
    expect(list.listings.filter(l => l.rating !== null).length).toBeGreaterThanOrEqual(4);
    expect((await st.listStayListings(d, real.id, { limit: 50, priceType: "gratuit" })).listings.length).toBeGreaterThanOrEqual(3);
    expect((await st.listStayListings(d, real.id, { limit: 50, city: "Marrakech" })).listings).toHaveLength(2);

    const maarif = list.listings.find(l => l.title.includes("Maârif"))!;
    const detail = await st.getStayListing(d, real.id, maarif.id);
    out.push(detail);
    expect(detail.reviews).toHaveLength(2);
    expect(detail.amenities.length).toBeGreaterThanOrEqual(3);
    expect(detail.contact?.phone.startsWith("+2120")).toBe(true);
    expect(detail.description.startsWith(DEMO_LABEL)).toBe(true);

    // as a host: incoming requests; as a guest: sent requests, request detail and conversation
    const yasmine = demo(db, "yasmine");
    const hosted = await st.listMyRequests(d, yasmine.id, "host");
    out.push(hosted);
    expect(hosted.length).toBeGreaterThanOrEqual(2);
    const mehdi = demo(db, "mehdi");
    const sent = await st.listMyRequests(d, mehdi.id, "guest");
    out.push(sent);
    expect(sent.map(r => r.status).sort()).toEqual(["accepted", "pending"]);
    const pending = sent.find(r => r.status === "pending")!;
    expect(pending.unread).toBeGreaterThanOrEqual(1);
    const rd = await st.getRequestDetail(d, mehdi, pending.id);
    out.push(rd);
    expect(rd.role).toBe("guest");
    const msgs = await st.listRequestMessages(d, mehdi, pending.id);
    out.push(msgs);
    expect(msgs.messages.length).toBeGreaterThanOrEqual(2);
    const done = sent.find(r => r.status === "accepted")!;
    const doneDetail = await st.getRequestDetail(d, mehdi, done.id);
    expect(doneDetail.review?.rating).toBe(5);
    expect(doneDetail.can_review).toBe(false);
    expect(await st.unreadTotal(d, demo(db, "anas").id)).toBeGreaterThanOrEqual(1);

    out.push(await st.listStayReports(d), await st.adminListStayListings(d));
    expect(JSON.stringify(out)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(JSON.stringify(out)).not.toContain(DEMO_DOMAIN);
  });
});

describe("hub demo seed: Pro", () => {
  it("populates every screen of the pro tab", () => {
    const db = freshDb();
    db.exec(seedSql());
    expect(count(db, "pro_profiles")).toBe(10);
    expect(count(db, "pro_posts")).toBe(16);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_posts WHERE link IS NOT NULL")).toBeGreaterThanOrEqual(4);
    expect(count(db, "pro_comments")).toBeGreaterThanOrEqual(35);
    expect(count(db, "pro_likes")).toBeGreaterThanOrEqual(60);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_comments WHERE body LIKE '@%'")).toBeGreaterThanOrEqual(5);
    expect(count(db, "pro_jobs")).toBe(8);
    expect(n(db, "SELECT COUNT(DISTINCT type) AS n FROM pro_jobs")).toBe(5);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_jobs WHERE status = 'open'")).toBe(6);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_jobs WHERE status = 'closed'")).toBe(2);
    expect(count(db, "pro_threads")).toBe(5);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_threads WHERE job_id > 0")).toBe(3);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_threads WHERE job_id = 0")).toBe(2);
    const perThread = db.prepare("SELECT COUNT(*) AS c FROM pro_messages GROUP BY thread_id").all() as { c: number }[];
    expect(perThread).toHaveLength(5);
    for (const t of perThread) { expect(t.c).toBeGreaterThanOrEqual(3); expect(t.c).toBeLessThanOrEqual(7); }
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_messages WHERE read_at IS NULL")).toBeGreaterThanOrEqual(3);
    expect(count(db, "pro_reports")).toBe(2);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_threads WHERE member_a >= member_b")).toBe(0);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_threads WHERE job_id > 0 AND job_id NOT IN (SELECT id FROM pro_jobs)")).toBe(0);
  });

  it("gives all ten members a complete professional profile", () => {
    const db = freshDb();
    db.exec(seedSql());
    const rows = db.prepare(
      "SELECT m.display_name, m.bio, p.headline, p.company, p.city, p.skills FROM hub_members m LEFT JOIN pro_profiles p ON p.member_id = m.id",
    ).all() as { display_name: string; bio: string; headline: string | null; company: string | null; city: string | null; skills: string | null }[];
    expect(rows).toHaveLength(10);
    for (const r of rows) {
      for (const f of [r.bio, r.headline, r.company, r.city]) expect(f && f.trim().length > 0, r.display_name).toBe(true);
      const skills = JSON.parse(r.skills ?? "[]") as string[];
      expect(skills.length, r.display_name).toBeGreaterThanOrEqual(3);
      expect(skills.length).toBeLessThanOrEqual(8);
      expect(skills.every(s => s.length <= 30)).toBe(true);
      expect(r.headline!.startsWith(DEMO_LABEL), "headline marked").toBe(true);
      expect(r.company!).toMatch(/\(fictif|fictive\)/);
    }
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_profiles WHERE open_to_work = 1")).toBeGreaterThanOrEqual(3);
    expect(n(db, "SELECT COUNT(*) AS n FROM pro_profiles WHERE open_to_work = 0")).toBeGreaterThanOrEqual(3);
  });

  it("only uses fictional links and phone-only contacts", () => {
    const db = freshDb();
    db.exec(seedSql());
    const links = (db.prepare("SELECT link FROM pro_posts WHERE link IS NOT NULL").all() as { link: string }[]).map(r => r.link);
    for (const l of links) {
      expect(() => new URL(l)).not.toThrow();
      expect(l.startsWith("https://exemple.invalid/"), l).toBe(true);
      expect(pro.cleanLink(l)).toBe(l);
    }
    const contacts = (db.prepare("SELECT contact FROM pro_jobs").all() as { contact: string }[]).map(r => r.contact);
    expect(contacts).toHaveLength(8);
    for (const c of contacts) expect(c, c).toMatch(/^\+2120000000\d\d$/);
    // no http(s) link anywhere else in the demo text, and no real-looking social or company domain
    const all = [
      ...(db.prepare("SELECT body AS t FROM pro_posts UNION ALL SELECT body FROM pro_comments UNION ALL SELECT body FROM pro_messages UNION ALL SELECT description FROM pro_jobs UNION ALL SELECT body FROM hub_posts UNION ALL SELECT description FROM st_listings").all() as { t: string }[]),
    ].map(r => r.t).join("\n");
    expect(all).not.toMatch(/linkedin|facebook|instagram|twitter|\.com\b|\.ma\b/i);
  });

  it("serves the pro content through the real data layer, without any email", async () => {
    const db = freshDb();
    db.exec(seedSql());
    const real = realMember(db);
    const d = asD1(db);
    const out: unknown[] = [];

    const feed = await pro.feed(d, real.id, null, 50);
    out.push(feed);
    expect(feed.posts).toHaveLength(16);
    expect(feed.posts.filter(p => p.link).length).toBeGreaterThanOrEqual(4);
    expect(feed.posts.every(p => p.author.headline.startsWith(DEMO_LABEL))).toBe(true);
    const proPhotos = feed.posts.filter(p => p.media.length > 0);
    expect(proPhotos).toHaveLength(Object.keys(PRO_POST_MEDIA).length);
    expect(proPhotos.flatMap(p => p.media).every(k => /^demo\/[a-z0-9-]+\.jpg$/.test(k))).toBe(true);
    expect(feed.posts.every(p => p.author.avatar_key?.startsWith("demo/avatar-"))).toBe(true);
    expect(feed.posts.some(p => p.like_count >= 6)).toBe(true);
    expect(feed.posts.some(p => p.like_count <= 3)).toBe(true);
    const commented = feed.posts.find(p => p.comment_count >= 3)!;
    const comments = await pro.listComments(d, commented.id);
    out.push(comments);
    expect(comments).toHaveLength(commented.comment_count);

    for (const key of ["yasmine", "karim", "salma", "omar", "nadia", "mehdi", "imane", "reda", "hajar", "anas"]) {
      const m = demo(db, key);
      const pv = await pro.getProfile(d, real.id, m.id);
      out.push(pv);
      expect(pv.headline && pv.company && pv.city && pv.bio, key).toBeTruthy();
      expect(pv.skills.length, key).toBeGreaterThanOrEqual(3);
    }

    const jobs = await pro.listJobs(d, real.id, { limit: 50 });
    out.push(jobs);
    expect(jobs.jobs).toHaveLength(6);
    for (const j of jobs.jobs) {
      const jd = await pro.getJob(d, real.id, j.id);
      out.push(jd);
      expect(jd.contact).toMatch(/^\+2120/);
    }
    expect((await pro.listJobs(d, demo(db, "omar").id, { mine: true })).jobs.map(j => j.status)).toEqual(["closed"]);
    expect((await pro.listJobs(d, real.id, { type: "stage" })).jobs).toHaveLength(1);
    expect(await pro.adminListJobs(d)).toHaveLength(8);

    // private conversations as a participant
    const imane = demo(db, "imane");
    const threads = await pro.listThreads(d, demo(db, "yasmine").id);
    out.push(threads);
    expect(threads).toHaveLength(1);
    expect(threads[0].job_title).toContain("événementiel");
    expect(threads[0].unread).toBe(0);
    const imaneThreads = await pro.listThreads(d, imane.id);
    expect(imaneThreads[0].unread).toBe(1);
    const conv = await pro.listMessages(d, imane, imaneThreads[0].id);
    out.push(conv);
    expect(conv.messages.length).toBe(6);
    expect(await pro.unreadTotal(d, demo(db, "omar").id)).toBeGreaterThanOrEqual(1);
    // an outsider cannot read someone else's thread
    await expect(pro.listMessages(d, real, imaneThreads[0].id)).rejects.toThrow();

    const reports = await pro.listReports(d);
    out.push(reports);
    expect(reports.map(r => r.target_type).sort()).toEqual(["job", "post"]);
    expect(reports.every(r => r.body)).toBe(true);

    expect(JSON.stringify(out)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(JSON.stringify(out)).not.toContain(DEMO_DOMAIN);
  });
});

describe("hub demo seed: Fil and Marketplace through the real data layer", () => {
  it("serves the feed and the marketplace without any email", async () => {
    const db = freshDb();
    db.exec(seedSql());
    const real = realMember(db);
    const d = asD1(db);
    const out: unknown[] = [];

    const feed = await H.feed(d, real.id, null, 50);
    out.push(feed);
    expect(feed.pinned.length).toBeGreaterThanOrEqual(2);
    expect(feed.posts).toHaveLength(26);
    const withComments = feed.posts.find(p => p.comment_count >= 4)!;
    out.push(await H.listComments(d, withComments.id));
    expect(feed.posts.some(p => p.like_count === 0)).toBe(true);
    const withPhotos = feed.posts.filter(p => p.media.length > 0);
    expect(withPhotos).toHaveLength(Object.keys(POST_MEDIA).length);
    for (const p of withPhotos) expect(p.media.length).toBeLessThanOrEqual(4);
    expect(feed.posts.every(p => p.author.avatar_key?.startsWith("demo/avatar-"))).toBe(true);
    expect(Math.max(...withPhotos.map(p => p.media.length))).toBe(3);

    const all = await mk.listListings(d, real.id, { limit: 50 });
    out.push(all);
    expect(all.listings).toHaveLength(14);
    expect(all.listings.every(l => l.cover?.startsWith("demo/"))).toBe(true);
    for (const cat of mk.MK_CATEGORIES) expect((await mk.listListings(d, real.id, { category: cat })).listings.length, cat).toBeGreaterThanOrEqual(1);
    const scooter = all.listings.find(l => l.title.includes("Scooter"))!;
    out.push(await mk.getListing(d, real.id, scooter.id), await mk.listListingComments(d, scooter.id));

    const salma = demo(db, "salma");
    const threads = await mk.listThreads(d, salma.id);
    out.push(threads);
    expect(threads.length).toBeGreaterThanOrEqual(2);
    out.push(await mk.listMessages(d, salma, threads[0].id));
    out.push(await H.listReports(d), await mk.listMarketReports(d));
    expect(JSON.stringify(out)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(JSON.stringify(out)).not.toContain(DEMO_DOMAIN);
  });
});

describe("hub demo seed: idempotence and cleanup", () => {
  it("can be re-run without duplicating anything", () => {
    const db = freshDb();
    db.exec("INSERT INTO t_ramadan_days (day_number, date, capacity, registered_count) VALUES (1,'2026-03-01',120,7);");
    db.exec(seedSql());
    const before = snapshot(db);
    const reg = registered(db);
    db.exec(seedSql());
    expect(snapshot(db)).toEqual(before);
    expect(registered(db)).toBe(reg);
    db.exec(seedSql("moi@example.org"));
    expect(snapshot(db)).toEqual(before);
  });

  it("cleanup returns every table to its baseline, including what a real member did on each tab", () => {
    const db = freshDb();
    db.exec("INSERT INTO t_ramadan_days (day_number, date, capacity, registered_count) VALUES (1,'2026-03-01',120,7);");
    realMember(db);
    const baseline = snapshot(db);
    const baseReg = registered(db);
    db.exec(seedSql());
    const me = `(SELECT id FROM hub_members WHERE email = '${REAL}')`;
    const one = (sql: string) => `(${sql} LIMIT 1)`;
    // Fil
    db.exec(`INSERT INTO hub_likes (post_id, member_id) VALUES (${one("SELECT id FROM hub_posts")}, ${me});`);
    db.exec(`INSERT INTO hub_comments (post_id, member_id, body) VALUES (${one("SELECT id FROM hub_posts")}, ${me}, 'Bravo à tous');`);
    db.exec(`INSERT INTO hub_reports (target_type, target_id, member_id, reason) VALUES ('post', ${one("SELECT id FROM hub_posts WHERE kind = 'post'")}, ${me}, 'Test');`);
    // Marketplace
    db.exec(`INSERT INTO mk_comments (listing_id, member_id, body) VALUES (${one("SELECT id FROM mk_listings")}, ${me}, 'Toujours dispo ?');`);
    db.exec(`INSERT INTO mk_reports (target_type, target_id, member_id, reason) VALUES ('listing', ${one("SELECT id FROM mk_listings")}, ${me}, 'Test');`);
    db.exec(`INSERT INTO mk_threads (listing_id, buyer_id, seller_id, created_at, last_message_at) SELECT id, ${me}, member_id, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z' FROM mk_listings WHERE status = 'active' LIMIT 1;`);
    db.exec(`INSERT INTO mk_messages (thread_id, sender_id, body, created_at) SELECT id, ${me}, 'Bonjour', '2026-01-01T00:00:00Z' FROM mk_threads WHERE buyer_id = ${me};`);
    // Hébergement: a request on a demo listing, a message, an accepted past request with a review, a report
    db.exec(`INSERT INTO st_requests (listing_id, guest_id, host_id, start_date, end_date, message, status) SELECT id, ${me}, member_id, '2026-01-01', '2026-01-03', 'Bonjour', 'accepted' FROM st_listings WHERE status = 'active' LIMIT 1;`);
    db.exec(`INSERT INTO st_request_messages (request_id, sender_id, body) SELECT id, ${me}, 'Merci' FROM st_requests WHERE guest_id = ${me};`);
    db.exec(`INSERT INTO st_reviews (request_id, listing_id, author_id, rating, body) SELECT id, listing_id, ${me}, 5, 'Super' FROM st_requests WHERE guest_id = ${me};`);
    db.exec(`INSERT INTO st_reports (target_type, target_id, member_id, reason) VALUES ('listing', ${one("SELECT id FROM st_listings")}, ${me}, 'Test');`);
    // Pro: like, comment, report on a post and a job, an application thread and a direct one
    db.exec(`INSERT INTO pro_likes (post_id, member_id) VALUES (${one("SELECT id FROM pro_posts")}, ${me});`);
    db.exec(`INSERT INTO pro_comments (post_id, member_id, body) VALUES (${one("SELECT id FROM pro_posts")}, ${me}, 'Merci pour le partage');`);
    db.exec(`INSERT INTO pro_reports (target_type, target_id, member_id, reason) VALUES ('post', ${one("SELECT id FROM pro_posts")}, ${me}, 'Test');`);
    db.exec(`INSERT INTO pro_reports (target_type, target_id, member_id, reason) VALUES ('job', ${one("SELECT id FROM pro_jobs WHERE status = 'open'")}, ${me}, 'Test');`);
    db.exec(`INSERT INTO pro_threads (member_a, member_b, job_id, created_by, created_at, last_message_at) SELECT min(${me}, j.member_id), max(${me}, j.member_id), j.id, ${me}, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z' FROM pro_jobs j WHERE j.status = 'open' LIMIT 1;`);
    db.exec(`INSERT INTO pro_threads (member_a, member_b, job_id, created_by, created_at, last_message_at) SELECT min(${me}, m.id), max(${me}, m.id), 0, ${me}, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z' FROM hub_members m WHERE m.email LIKE ${DEMO_LIKE} LIMIT 1;`);
    db.exec(`INSERT INTO pro_messages (thread_id, sender_id, body, created_at) SELECT id, ${me}, 'Bonjour', '2026-01-01T00:00:00Z' FROM pro_threads WHERE created_by = ${me};`);
    // sanity: the real member's interactions are really there
    expect(n(db, `SELECT COUNT(*) AS n FROM pro_threads WHERE created_by = ${me}`)).toBe(2);
    expect(n(db, `SELECT COUNT(*) AS n FROM st_reviews WHERE author_id = ${me}`)).toBe(1);

    db.exec(cleanupSql());
    expect(snapshot(db)).toEqual(baseline);
    expect(registered(db)).toBe(baseReg);
    // the real member survives
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_members WHERE email = '${REAL}'`)).toBe(1);
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_members WHERE email LIKE ${DEMO_LIKE}`)).toBe(0);
  });

  it("cleanup is safe on a clean database and can run twice", () => {
    const db = freshDb();
    db.exec(cleanupSql());
    expect(snapshot(db).every(([, c]) => c === 0)).toBe(true);
    db.exec(seedSql());
    db.exec(cleanupSql());
    db.exec(cleanupSql());
    expect(snapshot(db).every(([, c]) => c === 0)).toBe(true);
  });
});

describe("hub demo seed: personal conversations for the demo operator", () => {
  it("only opens them when that member exists, on all four tabs", async () => {
    const email = "moi@example.org";
    const withMe = freshDb();
    const me = realMember(withMe, email);
    withMe.exec(seedSql(email));
    const d = asD1(withMe);

    const mkThreads = await mk.listThreads(d, me.id);
    expect(mkThreads).toHaveLength(3);
    expect(mkThreads.reduce((s, t) => s + t.unread, 0)).toBeGreaterThanOrEqual(4);
    expect(await mk.unreadTotal(d, me.id)).toBeGreaterThanOrEqual(4);

    const requests = await st.listMyRequests(d, me.id, "guest");
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("accepted");
    expect(requests[0].host_reply).toBeTruthy();
    expect(requests[0].unread).toBe(2);
    expect(await st.unreadTotal(d, me.id)).toBe(2);

    const proThreads = await pro.listThreads(d, me.id);
    expect(proThreads).toHaveLength(1);
    expect(proThreads[0].unread).toBe(2);
    expect(proThreads[0].job_title).toBeTruthy();
    expect(await pro.unreadTotal(d, me.id)).toBe(2);

    // a real member is never marked, an email that is not a hub member creates nothing
    const unknown = freshDb();
    unknown.exec(seedSql("inconnu@example.org"));
    const without = freshDb();
    without.exec(seedSql());
    expect(snapshot(unknown)).toEqual(snapshot(without));
    expect(count(without, "mk_threads")).toBe(7);
    expect(count(without, "st_requests")).toBe(11);
    expect(count(without, "pro_threads")).toBe(5);
    // 3 marketplace + 1 stay + 1 pro on top of the demo ones
    expect(count(withMe, "mk_threads")).toBe(10);
    expect(count(withMe, "st_requests")).toBe(12);
    expect(count(withMe, "pro_threads")).toBe(6);
  });

  it("marks stay and pro content as test data too", () => {
    const db = freshDb();
    db.exec(seedSql());
    for (const [sql, label] of [
      ["SELECT description AS t FROM st_listings", "stay description"],
      ["SELECT body AS t FROM pro_posts", "pro post"],
      ["SELECT description AS t FROM pro_jobs", "pro job"],
      ["SELECT headline AS t FROM pro_profiles", "pro headline"],
    ] as const) {
      const rows = db.prepare(sql).all() as { t: string }[];
      expect(rows.length, label).toBeGreaterThan(0);
      for (const r of rows) expect(r.t.startsWith(DEMO_LABEL), `${label}: ${r.t.slice(0, 40)}`).toBe(true);
    }
  });
});
