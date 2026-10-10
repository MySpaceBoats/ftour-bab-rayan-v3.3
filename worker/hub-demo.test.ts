/**
 * Hermetic check of the volunteer-hub demo seed. The generated SQL is replayed against the real D1
 * schema in an in-memory SQLite database, so a broken statement, a missing section or a leaky
 * cleanup fails here instead of halfway through a remote `wrangler d1 execute`.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { DEMO_DOMAIN, DEMO_LABEL, cleanupSql, seedSql } from "../scripts/hub-demo/build";

// node:sqlite is still experimental, so it is absent from Vite's builtin list and must be
// resolved at runtime instead of being statically imported (Vite would try to bundle it).
interface SqliteStatement { get(): unknown; all(): unknown[] }
interface SqliteDb { exec(sql: string): void; prepare(sql: string): SqliteStatement }
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => SqliteDb };

// order matters: base tables, then the hub/marketplace tables, then the triggers that need them
const SCHEMA = ["schema.generated.sql", "hub.sql", "marketplace.sql", "logic.sql"];
const DEMO_LIKE = `'%@${DEMO_DOMAIN}'`;

function freshDb(): SqliteDb {
  const db = new DatabaseSync(":memory:");
  for (const f of SCHEMA) db.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
  return db;
}

const n = (db: SqliteDb, sql: string): number => (db.prepare(sql).get() as { n: number }).n;
const count = (db: SqliteDb, table: string): number => n(db, `SELECT COUNT(*) AS n FROM ${table}`);
/** Row counts of every table the seed touches, to compare two runs. */
const TABLES = ["hub_members", "hub_posts", "hub_comments", "hub_likes", "hub_reports", "mk_listings", "mk_listing_media", "mk_comments", "mk_reports", "mk_threads", "mk_messages", "t_volunteers"];
const snapshot = (db: SqliteDb) => TABLES.map(t => [t, count(db, t)] as const);

describe("hub demo seed", () => {
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
  });

  it("fills every section and option of the space", () => {
    const db = freshDb();
    db.exec(seedSql());
    // fil d'actualité
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_posts WHERE kind = 'post' AND pinned = 0 AND status = 'visible'")).toBeGreaterThanOrEqual(10);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_comments WHERE status = 'visible'")).toBeGreaterThanOrEqual(15);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_likes")).toBeGreaterThanOrEqual(20);
    // annonces de l'équipe (colonne de droite)
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_posts WHERE kind = 'announcement' AND pinned = 1 AND status = 'visible'")).toBeGreaterThanOrEqual(1);
    // file de modération (admin)
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_reports")).toBe(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_reports")).toBe(1);
    // marketplace: plusieurs catégories, un vendu, un don gratuit, une annonce douteuse
    expect(n(db, "SELECT COUNT(DISTINCT category) AS n FROM mk_listings")).toBeGreaterThanOrEqual(5);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_listings WHERE status = 'sold'")).toBeGreaterThanOrEqual(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_listings WHERE price = 0")).toBe(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_listings WHERE contact_phone IS NOT NULL")).toBeGreaterThanOrEqual(3);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_comments")).toBeGreaterThanOrEqual(8);
    // messagerie: conversations nourries, dont une sur une annonce vendue et des non-lus
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_threads")).toBeGreaterThanOrEqual(5);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_messages")).toBeGreaterThanOrEqual(20);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_messages WHERE read_at IS NULL")).toBeGreaterThanOrEqual(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_threads t JOIN mk_listings l ON l.id = t.listing_id WHERE l.status = 'sold'")).toBeGreaterThanOrEqual(1);
    // aucune conversation avec soi-même, aucun message orphelin
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_threads WHERE buyer_id = seller_id")).toBe(0);
    expect(n(db, "SELECT COUNT(*) AS n FROM mk_messages WHERE thread_id NOT IN (SELECT id FROM mk_threads)")).toBe(0);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_posts WHERE member_id NOT IN (SELECT id FROM hub_members)")).toBe(0);
  });

  it("gives every marketplace listing a cover photo that really exists on disk", () => {
    const db = freshDb();
    db.exec(seedSql());
    const perListing = db.prepare(
      `SELECT l.id, l.title, COUNT(m.r2_key) AS photos,
         COALESCE(SUM(CASE WHEN m.position = 0 THEN 1 ELSE 0 END), 0) AS covers
       FROM mk_listings l LEFT JOIN mk_listing_media m ON m.listing_id = l.id GROUP BY l.id`,
    ).all() as { id: number; title: string; photos: number; covers: number }[];
    expect(perListing).toHaveLength(10);
    for (const l of perListing) {
      expect(l.photos, `${l.title} : au moins une photo`).toBeGreaterThanOrEqual(1);
      expect(l.covers, `${l.title} : exactement une couverture (position 0)`).toBe(1);
      expect(l.photos, `${l.title} : 4 photos maximum`).toBeLessThanOrEqual(4);
    }

    // la base pointe des clés `demo/<fichier>` : le Worker les sert depuis private/hub/demo/<fichier>.
    // Une clé sans fichier = une annonce à l'image cassée, donc on exige la correspondance exacte.
    const mediaDir = new URL("../scripts/hub-demo/media/", import.meta.url);
    const keys = (db.prepare("SELECT DISTINCT r2_key FROM mk_listing_media").all() as { r2_key: string }[]).map(r => r.r2_key);
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const key of keys) {
      expect(key.startsWith("demo/"), `${key} doit être sous demo/`).toBe(true);
      expect(existsSync(new URL(key.slice("demo/".length), mediaDir)), `${key} absent de scripts/hub-demo/media/`).toBe(true);
    }
    const onDisk = readdirSync(mediaDir).filter(f => f.endsWith(".jpg")).sort();
    expect(onDisk).toEqual([...new Set(keys.map(k => k.slice("demo/".length)))].sort());
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
    expect(bodies).toHaveLength(17);
    for (const b of bodies) expect(b.body.startsWith(DEMO_LABEL), b.body.slice(0, 40)).toBe(true);
    const descriptions = db.prepare("SELECT description FROM mk_listings").all() as { description: string }[];
    expect(descriptions).toHaveLength(10);
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
  });

  it("can be re-run without duplicating anything", () => {
    const db = freshDb();
    db.exec(seedSql());
    const before = snapshot(db);
    db.exec(seedSql());
    expect(snapshot(db)).toEqual(before);
  });

  it("cleanup removes every demo row and what real members did on it", () => {
    const db = freshDb();
    db.exec(seedSql());
    db.exec("INSERT INTO hub_members (email, display_name) VALUES ('reel@example.org','Membre réel');");
    db.exec("INSERT INTO hub_likes (post_id, member_id) SELECT id, (SELECT id FROM hub_members WHERE email = 'reel@example.org') FROM hub_posts LIMIT 1;");
    db.exec(cleanupSql());
    for (const t of TABLES.filter(t => t !== "hub_members")) expect(count(db, t), `${t} should be empty`).toBe(0);
    expect(n(db, `SELECT COUNT(*) AS n FROM hub_members WHERE email LIKE ${DEMO_LIKE}`)).toBe(0);
    // a real member survives, only their interaction with demo content is dropped
    expect(count(db, "hub_members")).toBe(1);
    expect(n(db, "SELECT COUNT(*) AS n FROM hub_members WHERE email = 'reel@example.org'")).toBe(1);
    expect(count(db, "hub_likes")).toBe(0);
  });

  it("only opens the personal conversations when that member exists", () => {
    const email = "moi@example.org";
    const withMe = freshDb();
    withMe.exec(`INSERT INTO hub_members (email, display_name) VALUES ('${email}','Moi');`);
    withMe.exec(seedSql(email));
    const mine = `(SELECT id FROM hub_members WHERE email = '${email}')`;
    expect(n(withMe, `SELECT COUNT(*) AS n FROM mk_threads WHERE buyer_id = ${mine}`)).toBe(2);
    expect(n(withMe, `SELECT COUNT(*) AS n FROM mk_messages WHERE thread_id IN (SELECT id FROM mk_threads WHERE buyer_id = ${mine}) AND read_at IS NULL`)).toBeGreaterThanOrEqual(1);

    // an email that is not a hub member must not create orphan threads
    const unknown = freshDb();
    unknown.exec(seedSql("inconnu@example.org"));
    expect(count(unknown, "mk_threads")).toBe(7);

    const withoutMe = freshDb();
    withoutMe.exec(seedSql());
    expect(count(withoutMe, "mk_threads")).toBe(7);
  });
});
