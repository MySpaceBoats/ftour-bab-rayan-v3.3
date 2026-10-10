import { beforeEach, describe, expect, it } from "vitest";
import type { D1Like } from "./gallery-d1";
import { fakeD1, openDb, type Sqlite } from "./test-d1";
import * as h from "./hub-d1";
import * as pro from "./pro-d1";
import * as mx from "./messenger-d1";

const T0 = Date.parse("2026-10-10T12:00:00.000Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string, first = "Amina") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  return (await h.getSession(d, session, T0 + 1))!;
}
const suspend = (id: number) => sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(id);

function marketThread(seller: number, buyer: number, msgs: [number, string, number][], status = "active") {
  const l = sqlite.prepare("INSERT INTO mk_listings (member_id,title,description,price,category,item_condition,status) VALUES (?,?,?,?,?,?,?)").run(seller, "Vélo", "d", 10, "autre", "bon", status).lastInsertRowid;
  const t = sqlite.prepare("INSERT INTO mk_threads (listing_id,buyer_id,seller_id,created_at,last_message_at) VALUES (?,?,?,?,?)").run(l, buyer, seller, at(0), at(msgs.length ? msgs[msgs.length - 1][2] : 0)).lastInsertRowid;
  for (const [sender, body, min] of msgs) sqlite.prepare("INSERT INTO mk_messages (thread_id,sender_id,body,created_at) VALUES (?,?,?,?)").run(t, sender, body, at(min));
  return Number(t);
}
function stayRequest(host: number, guest: number, msgs: [number, string, number][]) {
  const l = sqlite.prepare("INSERT INTO st_listings (member_id,title,description,kind) VALUES (?,?,?,?)").run(host, "Studio Rabat", "d", "studio").lastInsertRowid;
  const r = sqlite.prepare("INSERT INTO st_requests (listing_id,guest_id,host_id,start_date,end_date,guests,message,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(l, guest, host, "2026-11-01", "2026-11-03", 1, "Bonjour", at(0), at(0)).lastInsertRowid;
  for (const [sender, body, min] of msgs) sqlite.prepare("INSERT INTO st_request_messages (request_id,sender_id,body,created_at) VALUES (?,?,?,?)").run(r, sender, body, at(min));
  return Number(r);
}

beforeEach(() => {
  sqlite = openDb();
  d = fakeD1(sqlite);
});

describe("inbox", () => {
  it("merges the three sources, newest first, with context and unread", async () => {
    const a = await member("a@x.ma"), b = await member("b@x.ma", "Bilal"), c = await member("c@x.ma", "Chaima"), e = await member("e@x.ma", "Emna");
    const { id: tid } = await pro.openThread(d, a, { to: b.id, jobId: 0 }, T0);
    await pro.sendMessage(d, b, tid, "salut pro", T0 + 60_000 * 5);
    const mk = marketThread(c.id, a.id, [[a.id, "dispo ?", 10], [c.id, "oui", 20]]);
    const st = stayRequest(e.id, a.id, [[e.id, "bienvenue", 30]]);

    const items = await mx.inbox(d, a.id);
    expect(items.map(i => [i.source, i.id])).toEqual([["stay", st], ["market", mk], ["pro", tid]]);
    expect(items[0]).toMatchObject({ context: "Studio Rabat", last_body: "bienvenue", unread: 1, other: { id: e.id } });
    expect(items[1]).toMatchObject({ context: "Vélo", last_body: "oui", unread: 1, other: { id: c.id } });
    expect(items[2]).toMatchObject({ context: null, last_body: "salut pro", unread: 1, other: { id: b.id } });
  });

  it("drops conversations with a suspended member and hidden market listings", async () => {
    const a = await member("a@x.ma"), b = await member("b@x.ma", "Bilal"), c = await member("c@x.ma", "Chaima");
    marketThread(b.id, a.id, [[a.id, "x", 1]]);
    marketThread(c.id, a.id, [[a.id, "y", 2]], "hidden");
    suspend(b.id);
    expect(await mx.inbox(d, a.id)).toEqual([]);
  });

  it("truncates last_body to 140 characters", async () => {
    const a = await member("a@x.ma"), b = await member("b@x.ma", "Bilal");
    marketThread(b.id, a.id, [[b.id, "z".repeat(500), 1]]);
    expect((await mx.inbox(d, a.id))[0].last_body).toHaveLength(140);
  });

  it("lists a stay request without messages (last_body null, date = request date)", async () => {
    const a = await member("a@x.ma"), b = await member("b@x.ma", "Bilal");
    stayRequest(b.id, a.id, []);
    expect((await mx.inbox(d, a.id))[0]).toMatchObject({ source: "stay", last_body: null, last_message_at: at(0), unread: 0 });
  });
});

describe("unreadAll", () => {
  it("sums the three modules", async () => {
    const a = await member("a@x.ma"), b = await member("b@x.ma", "Bilal"), c = await member("c@x.ma", "Chaima"), e = await member("e@x.ma", "Emna");
    const { id: tid } = await pro.openThread(d, a, { to: b.id, jobId: 0 }, T0);
    await pro.sendMessage(d, b, tid, "1", T0 + 1);
    marketThread(c.id, a.id, [[c.id, "2", 1], [c.id, "3", 2]]);
    stayRequest(e.id, a.id, [[e.id, "4", 1]]);
    expect(await mx.unreadAll(d, a.id)).toBe(1 + 2 + 1);
  });
});

describe("recipientOf / isEligible", () => {
  it("returns the other participant for each source, null for a stranger or unknown thread", async () => {
    const a = await member("a@x.ma"), b = await member("b@x.ma", "Bilal"), c = await member("c@x.ma", "Chaima");
    const { id: tid } = await pro.openThread(d, a, { to: b.id, jobId: 0 }, T0);
    const mk = marketThread(b.id, a.id, [[a.id, "x", 1]]);
    const st = stayRequest(b.id, a.id, []);
    expect(await mx.recipientOf(d, "pro", tid, a.id)).toBe(b.id);
    expect(await mx.recipientOf(d, "market", mk, b.id)).toBe(a.id);
    expect(await mx.recipientOf(d, "stay", st, a.id)).toBe(b.id);
    expect(await mx.recipientOf(d, "pro", tid, c.id)).toBeNull();
    expect(await mx.recipientOf(d, "pro", 999, a.id)).toBeNull();
  });

  it("isEligible is false for suspended or unknown members", async () => {
    const a = await member("a@x.ma");
    expect(await mx.isEligible(d, a.id)).toBe(true);
    suspend(a.id);
    expect(await mx.isEligible(d, a.id)).toBe(false);
    expect(await mx.isEligible(d, 9999)).toBe(false);
  });
});
