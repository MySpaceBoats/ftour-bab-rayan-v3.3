import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { D1Like } from "./gallery-d1";
import * as h from "./hub-d1";
import * as m from "./meetup-d1";
import { fakeD1, openDb, type Sqlite } from "./test-d1";

const T0 = Date.parse("2026-10-10T12:00:00.000Z"); // 13:00 in Casablanca -> 2026-10-10T13:00
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string, first = "Amina") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  return (await h.getSession(d, session, T0 + 1))!;
}

const input = (over: Record<string, unknown> = {}) => ({
  title: "Sortie plage", category: "sortie", description: "Balade et thé à la menthe.",
  country: "Maroc", city: "Casablanca", place: "Corniche Ain Diab",
  startsAt: "2026-10-20T19:00", endsAt: "2026-10-20T22:00", capacity: 10, ...over,
});

/** Insert a meetup directly (bypasses the daily rate limit and the past-start check). */
function raw(memberId: number, over: Record<string, string | number | null> = {}) {
  const o: Record<string, string | number | null> = {
    title: "Meetup", category: "sortie", description: "desc", country: "Maroc", city: "Casablanca", place: "Lieu",
    starts_at: "2026-10-20T19:00", ends_at: "2026-10-20T22:00", capacity: 10, status: "active", photo_key: null, ...over,
  };
  return Number(sqlite.prepare(
    `INSERT INTO mt_meetups (member_id,title,category,description,country,city,place,starts_at,ends_at,capacity,status,photo_key,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(memberId, o.title, o.category, o.description, o.country, o.city, o.place, o.starts_at, o.ends_at, o.capacity, o.status, o.photo_key, h.iso(T0), h.iso(T0)).lastInsertRowid);
}

const rejects = async (p: Promise<unknown>, code: h.HubErrorCode) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(h.HubError);
  expect((e as h.HubError).code).toBe(code);
  return (e as h.HubError).message;
};

beforeEach(() => {
  sqlite = openDb();
  // idempotency: applying the schema again on top of itself must not fail
  const ddl = readFileSync(new URL("./d1/meetup.sql", import.meta.url).pathname, "utf8");
  sqlite.exec(ddl);
  sqlite.exec(ddl);
  d = fakeD1(sqlite);
});

describe("meetup validation", () => {
  it("rejects every bad payload with a French invalid error", async () => {
    const org = await member("org@x.ma");
    const other = await member("other@x.ma");
    const bad: Record<string, unknown>[] = [
      { title: "" }, { title: "   " }, { title: "x".repeat(81) }, { title: 5 },
      { category: "fete" }, { category: undefined },
      { description: "" },
      { country: " " }, { country: "x".repeat(61) }, { city: "" }, { city: "x".repeat(61) }, { place: "" }, { place: "x".repeat(121) },
      { capacity: 0 }, { capacity: 501 }, { capacity: 1.5 }, { capacity: "5" }, { capacity: undefined },
      { startsAt: "2026-10-20" }, { startsAt: "2026-02-31T10:00" }, { startsAt: "2026-10-20T25:00" }, { startsAt: "2026-10-20T10:61" },
      { endsAt: "2026-10-20T19:00" }, { endsAt: "2026-10-20T18:00" },
      { startsAt: "2026-10-20T10:00", endsAt: "2026-11-20T10:00" }, // 31 days
      { startsAt: "2026-10-10T12:59", endsAt: "2026-10-10T15:00" }, // before now (13:00 Casablanca)
      { photo: `${other.id}/x.jpg` }, { photo: `${org.id}/../${other.id}/x.jpg` }, { photo: 12 },
    ];
    for (const over of bad) {
      const msg = await rejects(m.createMeetup(d, org, input(over), T0), "invalid");
      expect(msg, JSON.stringify(over)).not.toMatch(/Required|Expected|Invalid|String must/);
      expect(msg.length).toBeGreaterThan(3);
    }
    await rejects(m.createMeetup(d, org, null, T0), "invalid");
    await rejects(m.createMeetup(d, org, "nope", T0), "invalid");
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM mt_meetups").get() as { n: number }).n).toBe(0);
  });

  it("accepts boundaries, trims text and collapses country/city spaces", async () => {
    const org = await member("org@x.ma");
    await m.createMeetup(d, org, input({ startsAt: "2026-10-10T13:00", endsAt: "2026-10-10T13:01" }), T0); // start == now
    await m.createMeetup(d, org, input({ startsAt: "2026-10-20T10:00", endsAt: "2026-11-19T10:00", capacity: 500 }), T0); // 30 days
    const { id } = await m.createMeetup(d, org, input({ title: "  Thé  ", country: "  Pays   Bas ", city: " La   Haye ", photo: `${org.id}/a.jpg` }), T0);
    const r = sqlite.prepare("SELECT title, country, city, photo_key FROM mt_meetups WHERE id = ?").get(id) as any;
    expect(r).toMatchObject({ title: "Thé", country: "Pays Bas", city: "La Haye", photo_key: `${org.id}/a.jpg` });
  });

  it("caps the organizer at 5 meetups per 24 h", async () => {
    const org = await member("org@x.ma");
    for (let i = 0; i < 5; i++) await m.createMeetup(d, org, input(), T0);
    await rejects(m.createMeetup(d, org, input(), T0 + HOUR), "rate_limited");
    await m.createMeetup(d, org, input(), T0 + DAY + 1000);
  });

  it("nowMinuteCasablanca uses the Casablanca wall clock", () => {
    expect(m.nowMinuteCasablanca(T0)).toBe("2026-10-10T13:00");
    expect(m.nowMinuteCasablanca(Date.parse("2026-10-10T23:30:00Z"))).toBe("2026-10-11T00:30");
  });
});

describe("meetup list, places and detail", () => {
  it("lists only active, not ended meetups of eligible organizers, soonest first", async () => {
    const org = await member("org@x.ma");
    const viewer = await member("viewer@x.ma");
    const gone = await member("gone@x.ma");
    const unconfirmed = await member("pending@x.ma");
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id = ?").run(gone.id);
    sqlite.prepare("UPDATE t_volunteers SET status='pending' WHERE email = ?").run("pending@x.ma");
    const b = raw(org.id, { title: "B", starts_at: "2026-10-22T10:00", ends_at: "2026-10-22T12:00" });
    const a = raw(org.id, { title: "A", starts_at: "2026-10-21T10:00", ends_at: "2026-10-21T12:00" });
    const justNow = raw(org.id, { title: "Now", starts_at: "2026-10-10T11:00", ends_at: "2026-10-10T13:00" }); // ends exactly now: still shown
    raw(org.id, { title: "Cancelled", status: "cancelled" });
    raw(org.id, { title: "Hidden", status: "hidden" });
    raw(org.id, { title: "Ended", starts_at: "2026-10-09T10:00", ends_at: "2026-10-09T12:00" });
    raw(org.id, { title: "Ended minute ago", starts_at: "2026-10-10T11:00", ends_at: "2026-10-10T12:59" });
    raw(gone.id, { title: "Suspended organizer" });
    raw(unconfirmed.id, { title: "Unconfirmed organizer" });
    const r = await m.listMeetups(d, viewer.id, {}, T0);
    expect(r.meetups.map(x => x.id)).toEqual([justNow, a, b]);
    expect(r.nextCursor).toBeNull();
    expect(r.meetups[0]).toMatchObject({ going_count: 0, waitlist_count: 0, my_status: null, ended: false, status: "active", organizer: { id: org.id, display_name: "Amina B." } });
    expect(JSON.stringify(r)).not.toContain("@");
  });

  it("filters by country, city (case-insensitive), category and dates", async () => {
    const org = await member("org@x.ma");
    const v = await member("v@x.ma");
    const ma = raw(org.id, { country: "Maroc", city: "Casablanca", category: "sortie", starts_at: "2026-10-20T10:00", ends_at: "2026-10-20T12:00" });
    const rab = raw(org.id, { country: "Maroc", city: "Rabat", category: "rencontre", starts_at: "2026-11-05T10:00", ends_at: "2026-11-05T12:00" });
    const fr = raw(org.id, { country: "France", city: "Lyon", category: "evenement", starts_at: "2026-12-01T10:00", ends_at: "2026-12-01T12:00" });
    const ids = async (o: m.MeetupSearch) => (await m.listMeetups(d, v.id, o, T0)).meetups.map(x => x.id);
    expect(await ids({ country: "maroc" })).toEqual([ma, rab]);
    expect(await ids({ country: "MAROC", city: "rabat" })).toEqual([rab]);
    expect(await ids({ city: "LYON" })).toEqual([fr]);
    expect(await ids({ category: "evenement" })).toEqual([fr]);
    expect(await ids({ country: "Maroc", category: "sortie" })).toEqual([ma]);
    expect(await ids({ from: "2026-11-01" })).toEqual([rab, fr]);
    expect(await ids({ to: "2026-11-05" })).toEqual([ma, rab]);
    expect(await ids({ from: "2026-11-05", to: "2026-11-05" })).toEqual([rab]);
    expect(await ids({ country: "Belgique" })).toEqual([]);
    expect(await ids({ country: "  ", city: "" })).toEqual([ma, rab, fr]);
    await rejects(m.listMeetups(d, v.id, { from: "2026-11-10", to: "2026-11-01" }, T0), "invalid");
    await rejects(m.listMeetups(d, v.id, { category: "fete" }, T0), "invalid");
    await rejects(m.listMeetups(d, v.id, { from: "2026-02-31" }, T0), "invalid");
    await rejects(m.listMeetups(d, v.id, { to: "demain" }, T0), "invalid");
    await rejects(m.listMeetups(d, v.id, { cursor: "garbage" }, T0), "invalid");
  });

  it("pages by keyset cursor and returns every meetup exactly once", async () => {
    const org = await member("org@x.ma");
    const v = await member("v@x.ma");
    const made: number[] = [];
    for (const day of ["22", "20", "21", "20", "22", "23", "20"]) made.push(raw(org.id, { starts_at: `2026-10-${day}T10:00`, ends_at: `2026-10-${day}T12:00` }));
    const seen: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const r: Awaited<ReturnType<typeof m.listMeetups>> = await m.listMeetups(d, v.id, { cursor, limit: 3 }, T0);
      seen.push(...r.meetups.map(x => x.id));
      cursor = r.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    const expected = [...made].sort((x, y) => {
      const sx = (sqlite.prepare("SELECT starts_at FROM mt_meetups WHERE id=?").get(x) as any).starts_at as string;
      const sy = (sqlite.prepare("SELECT starts_at FROM mt_meetups WHERE id=?").get(y) as any).starts_at as string;
      return sx === sy ? x - y : sx < sy ? -1 : 1;
    });
    expect(seen).toEqual(expected);
  });

  it("builds the places dropdowns from upcoming active meetups only, grouped case-insensitively", async () => {
    const org = await member("org@x.ma");
    raw(org.id, { country: "Maroc", city: "Rabat" });
    raw(org.id, { country: "maroc", city: "casablanca" });
    raw(org.id, { country: "Maroc", city: "CASABLANCA" });
    raw(org.id, { country: "France", city: "Lyon" });
    raw(org.id, { country: "Belgique", city: "Liège", status: "cancelled" });
    raw(org.id, { country: "Espagne", city: "Madrid", status: "hidden" });
    raw(org.id, { country: "Italie", city: "Rome", starts_at: "2026-10-01T10:00", ends_at: "2026-10-01T12:00" });
    expect(await m.listMeetupPlaces(d, T0)).toEqual({
      countries: [
        { country: "France", cities: ["Lyon"] },
        { country: "Maroc", cities: ["casablanca", "Rabat"] },
      ],
    });
  });

  it("returns the detail with spots left, waiting names for the organizer only, and no email", async () => {
    const org = await member("org@x.ma", "Olivia");
    const a = await member("a@x.ma", "Alice");
    const b = await member("b@x.ma", "Bob");
    const out = await member("out@x.ma", "Zoe");
    const id = raw(org.id, { capacity: 1, photo_key: `${org.id}/p.jpg`, description: "Le détail" });
    await m.joinMeetup(d, a, id, T0);
    await m.joinMeetup(d, b, id, T0);
    const asOrg = await m.getMeetup(d, org.id, id, T0);
    expect(asOrg).toMatchObject({ id, mine: true, description: "Le détail", spots_left: 0, going_count: 1, waitlist_count: 1, my_status: null, photo_key: `${org.id}/p.jpg` });
    expect(asOrg.participants.map(p => p.display_name)).toEqual(["Alice B."]);
    expect(asOrg.waitlist.map(p => p.display_name)).toEqual(["Bob B."]);
    const asOut = await m.getMeetup(d, out.id, id, T0);
    expect(asOut).toMatchObject({ mine: false, spots_left: 0, waitlist_count: 1, my_status: null, waitlist: [] });
    expect(asOut.participants.map(p => p.display_name)).toEqual(["Alice B."]);
    expect((await m.getMeetup(d, b.id, id, T0)).my_status).toBe("waitlist");
    expect((await m.getMeetup(d, a.id, id, T0)).my_status).toBe("going");
    for (const v of [asOrg, asOut]) expect(JSON.stringify(v)).not.toContain("@");
  });

  it("shows cancelled meetups, hides hidden ones and those of suspended organizers", async () => {
    const org = await member("org@x.ma");
    const v = await member("v@x.ma");
    const gone = await member("gone@x.ma");
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id = ?").run(gone.id);
    expect((await m.getMeetup(d, v.id, raw(org.id, { status: "cancelled" }), T0)).status).toBe("cancelled");
    await rejects(m.getMeetup(d, v.id, raw(org.id, { status: "hidden" }), T0), "not_found");
    await rejects(m.getMeetup(d, v.id, raw(gone.id), T0), "not_found");
    await rejects(m.getMeetup(d, v.id, 9999, T0), "not_found");
  });
});

describe("meetup participation", () => {
  it("seats members while room remains, then waitlists them", async () => {
    const org = await member("org@x.ma");
    const [a, b, c] = [await member("a@x.ma"), await member("b@x.ma"), await member("c@x.ma")];
    const id = raw(org.id, { capacity: 2 });
    expect(await m.joinMeetup(d, a, id, T0)).toEqual({ status: "going" });
    expect(await m.joinMeetup(d, b, id, T0)).toEqual({ status: "going" });
    expect(await m.joinMeetup(d, c, id, T0)).toEqual({ status: "waitlist" });
    const card = (await m.listMeetups(d, c.id, {}, T0)).meetups[0];
    expect(card).toMatchObject({ going_count: 2, waitlist_count: 1, my_status: "waitlist" });
  });

  it("refuses organizer, double, cancelled, ended, hidden and unknown meetups", async () => {
    const org = await member("org@x.ma");
    const a = await member("a@x.ma");
    const id = raw(org.id);
    await rejects(m.joinMeetup(d, org, id, T0), "invalid");
    await m.joinMeetup(d, a, id, T0);
    await rejects(m.joinMeetup(d, a, id, T0), "invalid");
    await rejects(m.joinMeetup(d, a, raw(org.id, { status: "cancelled" }), T0), "invalid");
    await rejects(m.joinMeetup(d, a, raw(org.id, { starts_at: "2026-10-09T10:00", ends_at: "2026-10-09T12:00" }), T0), "invalid");
    await rejects(m.joinMeetup(d, a, raw(org.id, { status: "hidden" }), T0), "not_found");
    await rejects(m.joinMeetup(d, a, 9999, T0), "not_found");
  });

  it("limits a member to 30 joins per hour", async () => {
    const org = await member("org@x.ma");
    const a = await member("a@x.ma");
    const ids = Array.from({ length: 31 }, () => raw(org.id));
    for (const id of ids.slice(0, 30)) await m.joinMeetup(d, a, id, T0);
    await rejects(m.joinMeetup(d, a, ids[30], T0 + 1000), "rate_limited");
    expect(await m.joinMeetup(d, a, ids[30], T0 + HOUR + 1000)).toEqual({ status: "going" });
  });

  it("never overbooks when members race for the last seats", async () => {
    const org = await member("org@x.ma");
    const people = await Promise.all(["a", "b", "c"].map(x => member(`${x}@x.ma`)));
    const id = raw(org.id, { capacity: 2 });
    const res = await Promise.all(people.map(p => m.joinMeetup(d, p, id, T0)));
    expect(res.filter(r => r.status === "going")).toHaveLength(2);
    expect(res.filter(r => r.status === "waitlist")).toHaveLength(1);
    const n = (s: string) => (sqlite.prepare("SELECT COUNT(*) AS n FROM mt_participants WHERE meetup_id = ? AND status = ?").get(id, s) as { n: number }).n;
    expect([n("going"), n("waitlist")]).toEqual([2, 1]);
  });

  it("promotes the oldest waiting member when a seat frees up, and not when a waiting member leaves", async () => {
    const org = await member("org@x.ma");
    const [a, b, c, e] = [await member("a@x.ma", "Alice"), await member("b@x.ma", "Bob"), await member("c@x.ma", "Carl"), await member("e@x.ma", "Eve")];
    const id = raw(org.id, { capacity: 1 });
    await m.joinMeetup(d, a, id, T0);
    await m.joinMeetup(d, b, id, T0 + 1);
    await m.joinMeetup(d, c, id, T0 + 2);
    await m.leaveMeetup(d, a, id); // Bob (oldest waiting) gets the seat
    let detail = await m.getMeetup(d, org.id, id, T0);
    expect(detail.participants.map(p => p.display_name)).toEqual(["Bob B."]);
    expect(detail.waitlist.map(p => p.display_name)).toEqual(["Carl B."]);
    await m.leaveMeetup(d, c, id); // a waiting member leaving promotes nobody
    detail = await m.getMeetup(d, org.id, id, T0);
    expect([detail.going_count, detail.waitlist_count]).toEqual([1, 0]);
    await m.leaveMeetup(d, b, id);
    expect(await m.joinMeetup(d, e, id, T0 + 3)).toEqual({ status: "going" }); // the freed seat is takeable
    await rejects(m.leaveMeetup(d, b, id), "not_found"); // no participation anymore
    await rejects(m.leaveMeetup(d, a, 9999), "not_found");
  });
});

describe("meetup update and cancel", () => {
  it("lets only the organizer edit, only while active", async () => {
    const org = await member("org@x.ma");
    const a = await member("a@x.ma");
    const { id } = await m.createMeetup(d, org, input(), T0);
    await rejects(m.updateMeetup(d, a, id, input(), T0), "forbidden");
    await m.updateMeetup(d, org, id, input({ title: "Nouveau titre", city: "Rabat", capacity: 20 }), T0);
    expect(sqlite.prepare("SELECT title, city, capacity FROM mt_meetups WHERE id = ?").get(id)).toMatchObject({ title: "Nouveau titre", city: "Rabat", capacity: 20 });
    await rejects(m.updateMeetup(d, org, id, input({ capacity: 0 }), T0), "invalid");
    await rejects(m.updateMeetup(d, org, id, input({ photo: `${a.id}/x.jpg` }), T0), "invalid");
    await rejects(m.updateMeetup(d, org, 9999, input(), T0), "not_found");
    await m.cancelMeetup(d, org, id, T0);
    await rejects(m.updateMeetup(d, org, id, input(), T0), "invalid");
  });

  it("refuses a capacity under the going count and promotes the waitlist when capacity is raised", async () => {
    const org = await member("org@x.ma");
    const ppl = await Promise.all(["a", "b", "c", "e", "f"].map((x, i) => member(`${x}@x.ma`, `P${i}`)));
    const { id } = await m.createMeetup(d, org, input({ capacity: 2 }), T0);
    for (const [i, p] of ppl.entries()) await m.joinMeetup(d, p, id, T0 + i);
    await rejects(m.updateMeetup(d, org, id, input({ capacity: 1 }), T0), "invalid");
    await m.updateMeetup(d, org, id, input({ capacity: 4 }), T0);
    const detail = await m.getMeetup(d, org.id, id, T0);
    expect(detail.participants.map(p => p.display_name)).toEqual(["P0 B.", "P1 B.", "P2 B.", "P3 B."]);
    expect(detail.waitlist.map(p => p.display_name)).toEqual(["P4 B."]);
    await m.updateMeetup(d, org, id, input({ capacity: 4 }), T0); // same capacity: nothing moves
    expect((await m.getMeetup(d, org.id, id, T0)).waitlist_count).toBe(1);
  });

  it("keeps a started meetup editable when its start is unchanged, rejects a changed start in the past", async () => {
    const org = await member("org@x.ma");
    const id = raw(org.id, { starts_at: "2026-10-10T10:00", ends_at: "2026-10-10T20:00" });
    await m.updateMeetup(d, org, id, input({ startsAt: "2026-10-10T10:00", endsAt: "2026-10-10T21:00", title: "Plus tard" }), T0);
    expect(sqlite.prepare("SELECT ends_at FROM mt_meetups WHERE id = ?").get(id)).toMatchObject({ ends_at: "2026-10-10T21:00" });
    await rejects(m.updateMeetup(d, org, id, input({ startsAt: "2026-10-10T09:00", endsAt: "2026-10-10T21:00" }), T0), "invalid");
  });

  it("cancels once, by the organizer only, and then refuses participation", async () => {
    const org = await member("org@x.ma");
    const a = await member("a@x.ma");
    const { id } = await m.createMeetup(d, org, input(), T0);
    await rejects(m.cancelMeetup(d, a, id, T0), "forbidden");
    await m.cancelMeetup(d, org, id, T0);
    await rejects(m.cancelMeetup(d, org, id, T0), "invalid");
    await rejects(m.joinMeetup(d, a, id, T0), "invalid");
    expect((await m.listMeetups(d, a.id, {}, T0)).meetups).toEqual([]);
    expect((await m.listMyMeetups(d, org.id, "organized", T0))[0]).toMatchObject({ id, status: "cancelled" });
    expect(sqlite.prepare("SELECT cancelled_at FROM mt_meetups WHERE id = ?").get(id)).toMatchObject({ cancelled_at: h.iso(T0) });
  });
});

describe("my meetups and admin", () => {
  it("lists what I organize and what I joined, past and cancelled included", async () => {
    const org = await member("org@x.ma");
    const a = await member("a@x.ma");
    const mine1 = raw(org.id, { starts_at: "2026-10-21T10:00", ends_at: "2026-10-21T12:00" });
    const mine2 = raw(org.id, { starts_at: "2026-10-01T10:00", ends_at: "2026-10-01T12:00" });
    const mine3 = raw(org.id, { status: "cancelled" });
    raw(org.id, { status: "hidden" });
    const full = raw(org.id, { capacity: 1, starts_at: "2026-10-25T10:00", ends_at: "2026-10-25T12:00" });
    const other = await member("o@x.ma");
    await m.joinMeetup(d, other, full, T0);
    await m.joinMeetup(d, a, mine1, T0);
    await m.joinMeetup(d, a, full, T0);
    const organized = await m.listMyMeetups(d, org.id, "organized", T0);
    expect(organized.map(x => x.id)).toEqual([full, mine1, mine3, mine2].sort((x, y) => {
      const sx = organized.find(o => o.id === x)!.starts_at, sy = organized.find(o => o.id === y)!.starts_at;
      return sx === sy ? y - x : sx < sy ? 1 : -1;
    }));
    expect(organized.find(x => x.id === mine2)).toMatchObject({ ended: true });
    expect(organized.find(x => x.id === mine3)).toMatchObject({ status: "cancelled" });
    const joined = await m.listMyMeetups(d, a.id, "joined", T0);
    expect(joined.map(x => [x.id, x.my_status])).toEqual([[full, "waitlist"], [mine1, "going"]]);
    await rejects(m.listMyMeetups(d, a.id, "all", T0), "invalid");
  });

  it("lets admins list everything, hide (soft) and delete (hard)", async () => {
    const org = await member("org@x.ma", "Olivia");
    const a = await member("a@x.ma");
    const id1 = raw(org.id, { title: "Un" });
    const id2 = raw(org.id, { title: "Deux", status: "cancelled" });
    await m.joinMeetup(d, a, id1, T0);
    const list = await m.adminListMeetups(d);
    expect(list.map(x => x.id)).toEqual([id2, id1]);
    expect(list[1]).toMatchObject({ title: "Un", organizer: "Olivia B.", going_count: 1, waitlist_count: 0, status: "active" });

    await m.hideMeetup(d, id1);
    expect((await m.listMeetups(d, a.id, {}, T0)).meetups).toEqual([]);
    await rejects(m.getMeetup(d, a.id, id1, T0), "not_found");
    expect(await m.listMyMeetups(d, a.id, "joined", T0)).toEqual([]);
    expect((await m.adminListMeetups(d)).find(x => x.id === id1)!.status).toBe("hidden");

    await m.deleteMeetup(d, id1);
    const n = (t: string) => (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    expect(n("mt_participants")).toBe(0);
    expect(n("mt_meetups")).toBe(1);
    await rejects(m.hideMeetup(d, 9999), "not_found");
    await rejects(m.deleteMeetup(d, 9999), "not_found");
  });
});

describe("schéma D1", () => {
  it("aucun motif LIKE/GLOB de plus de 50 octets (limite D1, absente de node:sqlite)", () => {
    for (const f of ["meetup.sql", "stay.sql", "pro.sql", "social.sql", "hub.sql", "marketplace.sql"]) {
      const sql = readFileSync(new URL(`./d1/${f}`, import.meta.url).pathname, "utf8");
      for (const [, pat] of sql.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)) {
        expect(Buffer.byteLength(pat), `${f}: ${pat}`).toBeLessThanOrEqual(50);
      }
    }
  });
});
