# Messenger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One Messenger-style inbox ("Mes messages") that merges the Pro, Marketplace and Stay conversations, with online presence and instant chat over a WebSocket Durable Object.

**Architecture:** Tables of the three modules stay untouched. A new data module `worker/messenger-d1.ts` merges them into `GET /hub/pro/inbox` and sums unread counts. A Durable Object `HubChat` (hibernation API, one global instance) holds the WebSockets: presence, "message" pushes, typing relay. Messages are still sent through each module's REST route; `hub.ts` notifies the Durable Object afterwards. Client: one socket singleton, one `MessengerPage` with a per-source adapter.

**Tech Stack:** TypeScript 5.9, Cloudflare Workers + D1 + Durable Objects, vitest + `node:sqlite`, React 19, wouter, Tailwind, sonner, lucide-react, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-10-messenger-design.md`

## Global Constraints
- Worker code is not in `tsconfig.json` (`include` = client, shared, server): verified by vitest and the esbuild bundle only. Client code is typechecked by `pnpm check`.
- Baseline: `pnpm check` and `pnpm test` have pre-existing failures unrelated to this work; the gate is "no new errors in touched files" + hub/market/stay/pro/messenger suites green. Record the baseline counts in the ledger at setup.
- No new D1 table, no ALTER. No new npm dependency.
- The Durable Object class must NOT import `cloudflare:workers` (the bundle is built with `--platform=browser` without that external): it is a plain class with `fetch`, `webSocketMessage`, `webSocketClose`, `webSocketError`.
- Time is passed as `nowMs`; tests use `T0 = Date.parse("2026-10-10T12:00:00.000Z")`.
- French UI copy; 4-space or existing file indent; Tailwind classes as in existing hub pages (`bg-blue-700`, `rounded-xl border border-slate-200 bg-white`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Précisions décidées au plan (amendent le spec)
- Session token for `/hub/ws` travels in the `Sec-WebSocket-Protocol` header (`["hub", token]`), not in the URL (URLs end up in logs). The 101 response echoes `Sec-WebSocket-Protocol: hub`.
- Invalid or expired token: HTTP 401 before the upgrade (browsers cannot read it). The client retries with backoff while a token exists; REST 401 handling (`hub:unauthorized`) clears the token, which stops it. No 4401 close code.
- The messenger lives at `/:lang/benevole/espace/messages` and `/:lang/benevole/espace/messages/:source/:id` (it is not Pro-specific). `/pro/messages*` and `/marketplace/messages*` redirect to it.
- Stay: `StayRequestsPage` / `StayRequestPage` stay as they are (request management with accept/decline and its own chat). They are not messaging inboxes; the messenger links to them ("Voir la demande").
- The unified unread = `P.unreadTotal + M.unreadTotal + S.unreadTotal` (Stay's total already includes pending requests addressed to the host). The nav drops the separate Pro and Stay badges; one badge on "Messages".
- Inbox items whose other member is suspended or no longer eligible are dropped (applies to the three sources).
- Messenger opens at most the 100 most recent items; old messages beyond the first 50 of a thread are not paged (as today).

## Review Focus
- Message push must never leak to a non-participant: `recipientOf` derives the recipient from the thread row, never from the client.
- Typing relay is bounded: payload size, field validation; garbage frames are ignored, never crash the Durable Object.
- A member with two tabs: closing one tab must not announce "offline".
- Socket down: the chat keeps working through polling; no duplicate messages when a push and a poll both fire.
- Suspended member: not in inbox of others, not pushed to.

---

### Task 1: Unified inbox data layer

**Files:**
- Create: `worker/messenger-d1.ts`, `worker/messenger-d1.test.ts`
- Modify: `worker/test-d1.ts` (load marketplace.sql and stay.sql too)

**Interfaces:**
- Consumes: `P.listThreads(d, memberId)`, `P.unreadTotal`, `P.memberOk(alias)`, `P.Person` from `./pro-d1`; `M.listThreads`, `M.unreadTotal` from `./market-d1`; `S.listMyRequests(d, memberId, "all")`, `S.unreadTotal` from `./stay-d1`.
- Produces:
  - `type Source = "pro" | "market" | "stay"`
  - `interface InboxItem { source: Source; id: number; other: P.Person; context: string | null; last_body: string | null; last_message_at: string; unread: number }`
  - `inbox(d: D1Like, memberId: number): Promise<InboxItem[]>`
  - `unreadAll(d: D1Like, memberId: number): Promise<number>`
  - `recipientOf(d: D1Like, source: Source, id: number, senderId: number): Promise<number | null>`
  - `isEligible(d: D1Like, memberId: number): Promise<boolean>`

- [ ] **Step 1: Extend the test db helper**

In `worker/test-d1.ts` change the schema list:

```ts
for (const f of ["hub.sql", "pro.sql", "marketplace.sql", "stay.sql"]) sqlite.exec(readFileSync(new URL(`./d1/${f}`, import.meta.url), "utf8"));
```
and the doc comment to `hub + pro + marketplace + stay schemas`.

Run: `pnpm vitest run worker/pro-d1.test.ts worker/pro.test.ts`
Expected: PASS (unchanged counts).

- [ ] **Step 2: Write the failing tests**

Create `worker/messenger-d1.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run worker/messenger-d1.test.ts`
Expected: FAIL — cannot resolve `./messenger-d1`.

- [ ] **Step 4: Implement**

Create `worker/messenger-d1.ts`:

```ts
/** Unified messenger: one inbox over Pro threads, Marketplace threads and Stay requests. Tables stay in their modules. */
import type { D1Like } from "./gallery-d1";
import * as P from "./pro-d1";
import * as M from "./market-d1";
import * as S from "./stay-d1";

export type Source = "pro" | "market" | "stay";
export interface InboxItem { source: Source; id: number; other: P.Person; context: string | null; last_body: string | null; last_message_at: string; unread: number }

const LIMIT = 100;
const BODY_MAX = 140;
const cut = (s: string | null) => (s && s.length > BODY_MAX ? s.slice(0, BODY_MAX) : s);
const marks = (n: number) => Array(n).fill("?").join(",");

async function lastStayMessages(d: D1Like, ids: number[]): Promise<Map<number, { body: string; created_at: string }>> {
  if (!ids.length) return new Map();
  const { results } = await d.prepare(
    `SELECT request_id, body, created_at FROM st_request_messages
     WHERE id IN (SELECT MAX(id) FROM st_request_messages WHERE status = 'visible' AND request_id IN (${marks(ids.length)}) GROUP BY request_id)`,
  ).bind(...ids).all<{ request_id: number; body: string; created_at: string }>();
  return new Map(results.map(r => [r.request_id, r]));
}

async function eligibleSet(d: D1Like, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { results } = await d.prepare(`SELECT m.id FROM hub_members m WHERE m.id IN (${marks(ids.length)}) AND ${P.memberOk("m")}`).bind(...ids).all<{ id: number }>();
  return new Set(results.map(r => r.id));
}

export async function inbox(d: D1Like, memberId: number): Promise<InboxItem[]> {
  const [pro, mk, stay] = await Promise.all([P.listThreads(d, memberId), M.listThreads(d, memberId), S.listMyRequests(d, memberId, "all")]);
  const last = await lastStayMessages(d, stay.map(r => r.id));
  const items: InboxItem[] = [
    ...pro.map(t => ({ source: "pro" as const, id: t.id, other: t.other, context: t.job_title, last_body: cut(t.last_body), last_message_at: t.last_message_at, unread: t.unread })),
    ...mk.map(t => ({ source: "market" as const, id: t.id, other: { id: t.other.id, display_name: t.other.display_name, avatar_key: t.other.avatar_key }, context: t.listing_title, last_body: cut(t.last_body), last_message_at: t.last_message_at, unread: t.unread })),
    ...stay.map(r => ({
      source: "stay" as const, id: r.id, other: r.other, context: r.listing_title,
      last_body: cut(last.get(r.id)?.body ?? null), last_message_at: last.get(r.id)?.created_at ?? r.created_at, unread: r.unread,
    })),
  ];
  const ok = await eligibleSet(d, [...new Set(items.map(i => i.other.id))]);
  return items
    .filter(i => ok.has(i.other.id))
    .sort((x, y) => (x.last_message_at < y.last_message_at ? 1 : x.last_message_at > y.last_message_at ? -1 : y.id - x.id))
    .slice(0, LIMIT);
}

export async function unreadAll(d: D1Like, memberId: number): Promise<number> {
  const [a, b, c] = await Promise.all([P.unreadTotal(d, memberId), M.unreadTotal(d, memberId), S.unreadTotal(d, memberId)]);
  return a + b + c;
}

const OTHER_SQL: Record<Source, string> = {
  pro: "SELECT CASE WHEN member_a = ? THEN member_b ELSE member_a END AS r, member_a AS x, member_b AS y FROM pro_threads WHERE id = ?",
  market: "SELECT CASE WHEN buyer_id = ? THEN seller_id ELSE buyer_id END AS r, buyer_id AS x, seller_id AS y FROM mk_threads WHERE id = ?",
  stay: "SELECT CASE WHEN guest_id = ? THEN host_id ELSE guest_id END AS r, guest_id AS x, host_id AS y FROM st_requests WHERE id = ?",
};

/** The other participant of a thread, derived from the stored row. Null if the sender is not a participant. */
export async function recipientOf(d: D1Like, source: Source, id: number, senderId: number): Promise<number | null> {
  const row = await d.prepare(OTHER_SQL[source]).bind(senderId, id).first<{ r: number; x: number; y: number }>();
  if (!row || (row.x !== senderId && row.y !== senderId)) return null;
  return row.r;
}

export async function isEligible(d: D1Like, memberId: number): Promise<boolean> {
  return !!(await d.prepare(`SELECT 1 AS ok FROM hub_members m WHERE m.id = ? AND ${P.memberOk("m")}`).bind(memberId).first());
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run worker/messenger-d1.test.ts`
Expected: PASS (8 tests). If a Stay/Market column used in the seed helpers is rejected by a CHECK, fix the seed (not the schema).

- [ ] **Step 6: Commit**

```bash
git add worker/test-d1.ts worker/messenger-d1.ts worker/messenger-d1.test.ts
git commit -m "feat(messenger): unified inbox data layer over pro, market and stay

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Inbox + unread routes

**Files:**
- Modify: `worker/pro.ts` (inbox route, unread sums), `worker/pro.test.ts`

**Interfaces:**
- Consumes: `X.inbox`, `X.unreadAll` from Task 1 (`import * as X from "./messenger-d1"`).
- Produces: `GET /hub/pro/inbox` → `{ items: (InboxItem with other:{id,display_name,avatar})[] }`; `GET /hub/pro/unread` → `{ count }` (sum of three).

- [ ] **Step 1: Write the failing tests** — append to `worker/pro.test.ts` (reuse its `signIn`, `call`, `sqlite`, `clock`; the new tests seed market/stay rows by SQL like Task 1):

```ts
describe("messenger inbox route", () => {
  it("requires a session", async () => {
    expect((await call("GET", "/hub/pro/inbox")).status).toBe(401);
  });

  it("merges sources and unread sums the three modules", async () => {
    const a = await signIn("a@x.ma"), b = await signIn("b@x.ma", "Bilal");
    const th = (await (await call("POST", "/hub/pro/threads", { token: a.session, body: { to: b.id } })).json()) as any;
    await call("POST", `/hub/pro/threads/${th.id}/messages`, { token: b.session, body: { body: "salut" } });
    const l = sqlite.prepare("INSERT INTO mk_listings (member_id,title,description,price,category,item_condition) VALUES (?,?,?,?,?,?)").run(b.id, "Vélo", "d", 10, "autre", "bon").lastInsertRowid;
    const t = sqlite.prepare("INSERT INTO mk_threads (listing_id,buyer_id,seller_id,created_at,last_message_at) VALUES (?,?,?,?,?)").run(l, a.id, b.id, new Date(clock).toISOString(), new Date(clock + 1000).toISOString()).lastInsertRowid;
    sqlite.prepare("INSERT INTO mk_messages (thread_id,sender_id,body,created_at) VALUES (?,?,?,?)").run(t, b.id, "vélo ok", new Date(clock + 1000).toISOString());

    const res = (await (await call("GET", "/hub/pro/inbox", { token: a.session })).json()) as any;
    expect(res.items.map((i: any) => i.source)).toEqual(["market", "pro"]);
    expect(res.items[0]).toMatchObject({ context: "Vélo", last_body: "vélo ok", unread: 1, other: { id: b.id, display_name: expect.any(String) } });
    expect(((await (await call("GET", "/hub/pro/unread", { token: a.session })).json()) as any).count).toBe(2);
  });
});
```
If `signIn` does not return `id`, use `(await (await call("GET","/hub/me",{token})).json()).member.id` inside a local helper; check `signIn`'s return in the file first.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run worker/pro.test.ts`
Expected: FAIL — `inbox` returns 404 (route unknown); unread equals 1.

- [ ] **Step 3: Implement** in `worker/pro.ts`: add `import * as X from "./messenger-d1";`, add before the `unread` route:

```ts
  if (match("GET", /^inbox$/)) {
    const me = await member();
    const items = await X.inbox(d, me.id);
    return json({ items: await Promise.all(items.map(async i => ({ ...i, other: await who(i.other) }))) });
  }
```
and change the unread route to `return json({ count: await X.unreadAll(d, me.id) });`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run worker/pro.test.ts worker/pro-d1.test.ts worker/messenger-d1.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/pro.ts worker/pro.test.ts
git commit -m "feat(messenger): inbox route and summed unread count

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Chat core (pure logic)

**Files:**
- Create: `worker/hub-chat-core.ts`, `worker/hub-chat-core.test.ts`

**Interfaces:**
- Produces:
  - `type ChatSource = "pro" | "market" | "stay"`
  - `type ClientEvent = { type: "typing"; to: number; source: ChatSource; thread_id: number }`
  - `type ServerEvent = { type: "presence_snapshot"; online: number[] } | { type: "presence"; id: number; online: boolean } | { type: "message"; source: ChatSource; thread_id: number } | { type: "typing"; source: ChatSource; thread_id: number; from: number }`
  - `interface Conn { memberId: number; send(data: string): void }`
  - `onlineIds(conns: Conn[]): number[]` (unique, ascending)
  - `parseClientEvent(raw: unknown): ClientEvent | null`
  - `deliver(conns: Conn[], to: number, ev: ServerEvent): number` (count sent; a throwing socket is skipped)
  - `broadcast(conns: Conn[], ev: ServerEvent): void`
  - `presenceOnOpen(conns: Conn[], memberId: number): ServerEvent | null` — `conns` includes the new one; event only when it is the member's only connection
  - `presenceOnClose(remaining: Conn[], memberId: number): ServerEvent | null` — `remaining` excludes the closing one; event only when none left

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { broadcast, deliver, onlineIds, parseClientEvent, presenceOnClose, presenceOnOpen, type Conn } from "./hub-chat-core";

const conn = (memberId: number, sent: string[] = [], fail = false): Conn => ({ memberId, send: s => { if (fail) throw new Error("closed"); sent.push(s); } });

describe("onlineIds", () => {
  it("returns unique ids ascending", () => {
    expect(onlineIds([conn(3), conn(1), conn(3)])).toEqual([1, 3]);
  });
});

describe("parseClientEvent", () => {
  const ok = JSON.stringify({ type: "typing", to: 7, source: "market", thread_id: 12 });
  it("accepts a valid typing frame", () => {
    expect(parseClientEvent(ok)).toEqual({ type: "typing", to: 7, source: "market", thread_id: 12 });
  });
  it("rejects garbage, wrong types, oversize and non-string frames", () => {
    for (const bad of [
      "not json", "{}", "null", "[]",
      JSON.stringify({ type: "typing", to: "7", source: "pro", thread_id: 1 }),
      JSON.stringify({ type: "typing", to: 7, source: "evil", thread_id: 1 }),
      JSON.stringify({ type: "typing", to: -1, source: "pro", thread_id: 1 }),
      JSON.stringify({ type: "typing", to: 7, source: "pro", thread_id: 1.5 }),
      JSON.stringify({ type: "other", to: 7, source: "pro", thread_id: 1 }),
      ok + " ".repeat(600), new ArrayBuffer(4), 42,
    ]) expect(parseClientEvent(bad)).toBeNull();
  });
});

describe("deliver / broadcast", () => {
  it("sends only to the named member (all their tabs) and counts", () => {
    const a1: string[] = [], a2: string[] = [], b: string[] = [];
    const n = deliver([conn(1, a1), conn(1, a2), conn(2, b)], 1, { type: "message", source: "pro", thread_id: 5 });
    expect(n).toBe(2);
    expect(JSON.parse(a1[0])).toEqual({ type: "message", source: "pro", thread_id: 5 });
    expect(a2).toHaveLength(1);
    expect(b).toEqual([]);
  });
  it("skips a socket that throws", () => {
    const ok: string[] = [];
    expect(deliver([conn(1, [], true), conn(1, ok)], 1, { type: "message", source: "pro", thread_id: 1 })).toBe(1);
    expect(ok).toHaveLength(1);
  });
  it("broadcast reaches everyone and never throws", () => {
    const a: string[] = [], b: string[] = [];
    broadcast([conn(1, a), conn(2, [], true), conn(3, b)], { type: "presence", id: 9, online: true });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });
});

describe("presence transitions", () => {
  it("announces online only for the first connection of a member", () => {
    expect(presenceOnOpen([conn(1), conn(2)], 2)).toEqual({ type: "presence", id: 2, online: true });
    expect(presenceOnOpen([conn(2), conn(2)], 2)).toBeNull();
  });
  it("announces offline only when the last connection closes", () => {
    expect(presenceOnClose([conn(2)], 2)).toBeNull();
    expect(presenceOnClose([conn(1)], 2)).toEqual({ type: "presence", id: 2, online: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run worker/hub-chat-core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `worker/hub-chat-core.ts`:

```ts
/** Pure logic of the realtime chat (presence, typing relay, push). The Durable Object only wires sockets to it. */
export type ChatSource = "pro" | "market" | "stay";
export type ClientEvent = { type: "typing"; to: number; source: ChatSource; thread_id: number };
export type ServerEvent =
  | { type: "presence_snapshot"; online: number[] }
  | { type: "presence"; id: number; online: boolean }
  | { type: "message"; source: ChatSource; thread_id: number }
  | { type: "typing"; source: ChatSource; thread_id: number; from: number };
export interface Conn { memberId: number; send(data: string): void }

const MAX_FRAME = 512;
const SOURCES = new Set<string>(["pro", "market", "stay"]);
const posInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;

export const onlineIds = (conns: Conn[]): number[] => [...new Set(conns.map(c => c.memberId))].sort((a, b) => a - b);

export function parseClientEvent(raw: unknown): ClientEvent | null {
  if (typeof raw !== "string" || raw.length > MAX_FRAME) return null;
  let v: any;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== "object" || v.type !== "typing") return null;
  if (!posInt(v.to) || !posInt(v.thread_id) || !SOURCES.has(v.source)) return null;
  return { type: "typing", to: v.to, source: v.source, thread_id: v.thread_id };
}

function trySend(c: Conn, data: string): boolean {
  try { c.send(data); return true; } catch { return false; }
}

export function deliver(conns: Conn[], to: number, ev: ServerEvent): number {
  const data = JSON.stringify(ev);
  let n = 0;
  for (const c of conns) if (c.memberId === to && trySend(c, data)) n++;
  return n;
}

export function broadcast(conns: Conn[], ev: ServerEvent): void {
  const data = JSON.stringify(ev);
  for (const c of conns) trySend(c, data);
}

export function presenceOnOpen(conns: Conn[], memberId: number): ServerEvent | null {
  return conns.filter(c => c.memberId === memberId).length === 1 ? { type: "presence", id: memberId, online: true } : null;
}

export function presenceOnClose(remaining: Conn[], memberId: number): ServerEvent | null {
  return remaining.some(c => c.memberId === memberId) ? null : { type: "presence", id: memberId, online: false };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run worker/hub-chat-core.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/hub-chat-core.ts worker/hub-chat-core.test.ts
git commit -m "feat(messenger): pure chat core (presence, typing relay, push)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Durable Object, `/hub/ws` route, push hook, config

**Files:**
- Create: `worker/hub-chat.ts`
- Modify: `worker/hub.ts`, `worker/index.ts`, `wrangler.toml`, `worker/pro.test.ts` (ws + push tests)

**Interfaces:**
- Consumes: Task 3 core; `X.recipientOf`, `X.isEligible` (Task 1).
- Produces:
  - `class HubChat` (Durable Object): `fetch` handles `GET /ws` (upgrade, header `x-member-id`) and `POST /notify` (JSON `{ to, source, thread_id }`).
  - `HubEnv.HUB_CHAT?: { idFromName(n: string): unknown; get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> } }`
  - Route `GET /hub/ws` (subprotocol auth), push after a successful `POST` to `pro/threads/:id/messages`, `market/threads/:id/messages`, `stay/requests/:id/messages`.

- [ ] **Step 1: Write the failing tests** — append to `worker/pro.test.ts`:

```ts
describe("realtime chat route", () => {
  const upgrade = (protocols: string): Request =>
    new Request("https://w.test/hub/ws", { headers: { upgrade: "websocket", "sec-websocket-protocol": protocols } });
  const run = (req: Request, e: HubEnv = env) => handleHubRequest(req, e, CORS, deps());
  const fakeNs = (calls: { url: string; init?: RequestInit }[]) => ({
    idFromName: (n: string) => n,
    get: () => ({ fetch: async (url: string, init?: RequestInit) => { calls.push({ url, init }); return new Response(null, { status: url.endsWith("/ws") ? 200 : 204 }); } }),
  });

  it("503 without the binding, 400 without upgrade, 401 with a bad token", async () => {
    const a = await signIn("a@x.ma");
    expect((await run(upgrade(`hub, ${a.session}`)))!.status).toBe(503);
    const calls: any[] = [];
    const e2 = { ...env, HUB_CHAT: fakeNs(calls) } as HubEnv;
    expect((await run(new Request("https://w.test/hub/ws"), e2))!.status).toBe(400);
    expect((await run(upgrade("hub, nope"), e2))!.status).toBe(401);
    expect((await run(upgrade("hub"), e2))!.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("forwards a valid session to the Durable Object with the member id and echoes the protocol", async () => {
    const a = await signIn("a@x.ma");
    const calls: any[] = [];
    const res = (await run(upgrade(`hub, ${a.session}`), { ...env, HUB_CHAT: fakeNs(calls) } as HubEnv))!;
    expect(res.status).toBe(200);
    expect(calls[0].url).toBe("https://hub-chat/ws");
    expect(calls[0].init.headers["x-member-id"]).toBe(String(a.id));
  });

  it("pushes to the thread's other participant after a message, never to a stranger or on failure", async () => {
    const a = await signIn("a@x.ma"), b = await signIn("b@x.ma", "Bilal");
    const calls: { url: string; init?: RequestInit }[] = [];
    const e2 = { ...env, HUB_CHAT: fakeNs(calls) } as HubEnv;
    const send = (token: string, tid: number, body: string) =>
      handleHubRequest(new Request(`https://w.test/hub/pro/threads/${tid}/messages`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ body }) }), e2, CORS, deps());
    const th = (await (await call("POST", "/hub/pro/threads", { token: a.session, body: { to: b.id } })).json()) as any;

    expect((await send(a.session, th.id, "coucou"))!.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://hub-chat/notify");
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({ to: b.id, source: "pro", thread_id: th.id });

    expect((await send(a.session, th.id, ""))!.status).toBe(400);
    expect(calls).toHaveLength(1);
  });
});
```
(`deps()` has no `waitUntil`, so the background push is awaited — tests see the call. In `signIn`, the member's `id` must be available; see Task 2 note.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run worker/pro.test.ts`
Expected: FAIL — `/hub/ws` returns 404; no push calls.

- [ ] **Step 3: Implement the route and the push hook** in `worker/hub.ts`:

1. Imports: `import * as X from "./messenger-d1";`
2. `HubEnv` gets:
```ts
export interface ChatNamespace { idFromName(n: string): unknown; get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> } }
```
and `HUB_CHAT?: ChatNamespace;` in `HubEnv`.
3. Before the `if (path.startsWith("market/"))` block add:

```ts
    // ---- realtime chat -----------------------------------------------------
    if (match("GET", /^ws$/)) {
      if (request.headers.get("upgrade") !== "websocket") return json({ error: "invalid", message: "WebSocket requis" }, 400);
      if (!env.HUB_CHAT) return json({ error: "unavailable", message: "Chat temps réel indisponible" }, 503);
      // browsers cannot set headers on a WebSocket: the token rides in Sec-WebSocket-Protocol ("hub, <token>")
      const token = (request.headers.get("sec-websocket-protocol") ?? "").split(",").map(s => s.trim())[1] ?? "";
      const me = token ? await H.getSession(d, token, now()) : null;
      if (!me) throw new H.HubError("unauthorized", "Connexion requise");
      const res = await env.HUB_CHAT.get(env.HUB_CHAT.idFromName("hub")).fetch("https://hub-chat/ws", { headers: { upgrade: "websocket", "x-member-id": String(me.id) } });
      return res;
    }
```
4. Wrap the three delegations so a successful message POST triggers a push. Replace the three `if (path.startsWith(...))` blocks' response handling: after computing each `r`, before returning it, call `pushAfterSend(r)`. Define once, near `background`:

```ts
    const SENT = /^(pro)\/threads\/(\d+)\/messages$|^(market)\/threads\/(\d+)\/messages$|^(stay)\/requests\/(\d+)\/messages$/;
    const pushAfterSend = async (res: Response | null): Promise<void> => {
      if (!res || !res.ok || request.method !== "POST" || !env.HUB_CHAT) return;
      const m = SENT.exec(path);
      if (!m) return;
      const source = (m[1] ?? m[3] ?? m[5]) as X.Source;
      const threadId = Number(m[2] ?? m[4] ?? m[6]);
      await background("chat push", async () => {
        const me = await member();
        const to = await X.recipientOf(d, source, threadId, me.id);
        if (to === null || !(await X.isEligible(d, to))) return;
        await env.HUB_CHAT!.get(env.HUB_CHAT!.idFromName("hub")).fetch("https://hub-chat/notify", { method: "POST", body: JSON.stringify({ to, source, thread_id: threadId }) });
      });
    };
```
and at each of the three delegation sites: `if (r) { await pushAfterSend(r); return r; }` (keep their existing structure: view lines 341-358 and add the call only on the non-null branch). `background` returns a promise only when `waitUntil` is absent; `await` of `void` is fine.

- [ ] **Step 4: Implement the Durable Object** `worker/hub-chat.ts`:

```ts
/** Durable Object holding the hub WebSockets: presence, message push, typing relay. State lives in the sockets (hibernation API). */
import { broadcast, deliver, onlineIds, parseClientEvent, presenceOnClose, presenceOnOpen, type Conn, type ServerEvent } from "./hub-chat-core";

interface ChatState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  getTags(ws: WebSocket): string[];
}
declare const WebSocketPair: { new (): { 0: WebSocket; 1: WebSocket } };

export class HubChat {
  constructor(private state: ChatState, _env: unknown) {}

  private conns(except?: WebSocket): Conn[] {
    return this.state.getWebSockets().filter(w => w !== except).map(w => ({ memberId: Number(this.state.getTags(w)[0]), send: (s: string) => w.send(s) }));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/notify" && request.method === "POST") {
      const b = (await request.json().catch(() => null)) as { to?: number; source?: "pro" | "market" | "stay"; thread_id?: number } | null;
      if (!b || !Number.isSafeInteger(b.to) || !Number.isSafeInteger(b.thread_id) || !b.source) return new Response(null, { status: 400 });
      deliver(this.conns(), b.to!, { type: "message", source: b.source, thread_id: b.thread_id! });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/ws" && request.headers.get("upgrade") === "websocket") {
      const memberId = Number(request.headers.get("x-member-id"));
      if (!Number.isSafeInteger(memberId) || memberId <= 0) return new Response(null, { status: 400 });
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.state.acceptWebSocket(server, [String(memberId)]);
      const conns = this.conns();
      const snapshot: ServerEvent = { type: "presence_snapshot", online: onlineIds(conns) };
      server.send(JSON.stringify(snapshot));
      const ev = presenceOnOpen(conns, memberId);
      if (ev) broadcast(conns, ev);
      return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": "hub" } } as ResponseInit);
    }
    return new Response(null, { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const ev = parseClientEvent(message);
    if (!ev) return;
    const from = Number(this.state.getTags(ws)[0]);
    deliver(this.conns(), ev.to, { type: "typing", source: ev.source, thread_id: ev.thread_id, from });
  }

  private gone(ws: WebSocket): void {
    const id = Number(this.state.getTags(ws)[0]);
    const rest = this.conns(ws);
    const ev = presenceOnClose(rest, id);
    if (ev) broadcast(rest, ev);
  }

  webSocketClose(ws: WebSocket): void {
    this.gone(ws);
    try { ws.close(); } catch { /* already closed */ }
  }

  webSocketError(ws: WebSocket): void {
    this.gone(ws);
  }
}
```

- [ ] **Step 5: Wire export and config**

`worker/index.ts`: add `export { HubChat } from './hub-chat';` next to the other top-level exports, and in `Env` add `HUB_CHAT?: import('./hub').ChatNamespace;` (match the file's import style: `import type { ChatNamespace } from './hub'`).

`wrangler.toml`: append (prod, top level):

```toml
# Hub realtime chat: one global Durable Object (presence + push)
[[durable_objects.bindings]]
name = "HUB_CHAT"
class_name = "HubChat"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["HubChat"]
```
and in the staging section:

```toml
[[env.staging.durable_objects.bindings]]
name = "HUB_CHAT"
class_name = "HubChat"

[[env.staging.migrations]]
tag = "v1"
new_sqlite_classes = ["HubChat"]
```

- [ ] **Step 6: Run to verify**

Run: `pnpm vitest run worker/pro.test.ts worker/hub.test.ts worker/market.test.ts worker/stay.test.ts worker/hub-chat-core.test.ts worker/messenger-d1.test.ts`
Expected: PASS (the three new route tests included).
Run: `pnpm build:worker 2>&1 | tail -5`
Expected: build succeeds, `dist/worker.js` written, no unresolved import.
Run: `grep -c "class HubChat" dist/worker.js`
Expected: `1` or more.

- [ ] **Step 7: Commit**

```bash
git add worker/hub-chat.ts worker/hub.ts worker/index.ts wrangler.toml worker/pro.test.ts
git commit -m "feat(messenger): HubChat Durable Object, /hub/ws route, message push

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client socket + presence hook

**Files:**
- Create: `client/src/features/hub/messenger/chat-socket.ts`, `client/src/features/hub/messenger/useChat.ts`
- Modify: `client/src/features/hub/pro/pro-api.ts` (inbox type + call)

**Interfaces:**
- Produces (`chat-socket.ts`): `type ChatSource`, `type ServerEvent`, `retain(): () => void`, `subscribe(l: (e: ServerEvent) => void): () => void`, `isOnline(id: number): boolean`, `isConnected(): boolean`, `sendTyping(to: number, source: ChatSource, threadId: number): void`.
- Produces (`useChat.ts`): `useChat(onEvent?: (e: ServerEvent) => void): { isOnline(id: number): boolean; connected: boolean }` — retains the socket while mounted and re-renders on presence/connection changes.
- Produces (`pro-api.ts`): `InboxItem`, `inbox(): Promise<InboxItem[]>`.

- [ ] **Step 1: pro-api additions**

```ts
export type InboxSource = "pro" | "market" | "stay";
export interface InboxItem { source: InboxSource; id: number; other: Person; context: string | null; last_body: string | null; last_message_at: string; unread: number }
export const inbox = () => call<{ items: InboxItem[] }>("GET", "pro/inbox").then(r => r.items);
```

- [ ] **Step 2: `chat-socket.ts`**

```ts
import { getHubToken } from "../api";

export type ChatSource = "pro" | "market" | "stay";
export type ServerEvent =
  | { type: "presence_snapshot"; online: number[] }
  | { type: "presence"; id: number; online: boolean }
  | { type: "message"; source: ChatSource; thread_id: number }
  | { type: "typing"; source: ChatSource; thread_id: number; from: number };
type Listener = (e: ServerEvent) => void;

const online = new Set<number>();
const listeners = new Set<Listener>();
let ws: WebSocket | null = null;
let connected = false;
let users = 0;
let retry = 1000;
let timer: ReturnType<typeof setTimeout> | undefined;

function url(): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) || "/api/trpc";
  const u = new URL(base, window.location.origin);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/hub/ws";
  u.search = "";
  return u.toString();
}

const fire = (e: ServerEvent) => listeners.forEach(l => { try { l(e); } catch { /* a bad listener must not break the others */ } });

function open() {
  const token = getHubToken();
  if (!token || ws || users === 0) return;
  let sock: WebSocket;
  try { sock = new WebSocket(url(), ["hub", token]); } catch { return; }
  ws = sock;
  sock.onopen = () => { retry = 1000; connected = true; fire({ type: "presence_snapshot", online: [...online] }); };
  sock.onmessage = ev => {
    let e: ServerEvent;
    try { e = JSON.parse(String(ev.data)); } catch { return; }
    if (e.type === "presence_snapshot") { online.clear(); e.online.forEach(i => online.add(i)); }
    else if (e.type === "presence") { e.online ? online.add(e.id) : online.delete(e.id); }
    fire(e);
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    connected = false;
    online.clear();
    fire({ type: "presence_snapshot", online: [] });
    if (users > 0 && getHubToken()) { timer = setTimeout(open, retry); retry = Math.min(retry * 2, 30_000); }
  };
}

/** Keep the socket open while at least one component needs it. Returns the release function. */
export function retain(): () => void {
  users++;
  open();
  return () => { users--; if (users === 0) { clearTimeout(timer); ws?.close(); ws = null; connected = false; online.clear(); } };
}
export const subscribe = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const isOnline = (id: number) => online.has(id);
export const isConnected = () => connected;
export function sendTyping(to: number, source: ChatSource, threadId: number): void {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "typing", to, source, thread_id: threadId }));
}
```

- [ ] **Step 3: `useChat.ts`**

```ts
import { useEffect, useReducer, useRef } from "react";
import { isConnected, isOnline, retain, subscribe, type ServerEvent } from "./chat-socket";

/** Retains the hub socket while mounted; re-renders on presence or connection changes; forwards every event to `onEvent`. */
export function useChat(onEvent?: (e: ServerEvent) => void) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => {
    const release = retain();
    const off = subscribe(e => {
      if (e.type === "presence" || e.type === "presence_snapshot") bump();
      handler.current?.(e);
    });
    return () => { off(); release(); };
  }, []);
  return { isOnline, connected: isConnected() };
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check 2>&1 | grep -E "messenger/|pro-api" | head`
Expected: no output (no new errors in these files).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/hub/messenger client/src/features/hub/pro/pro-api.ts
git commit -m "feat(messenger): client socket singleton and useChat hook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Messenger UI, routes, navigation

**Files:**
- Create: `client/src/features/hub/messenger/sources.ts`, `PresenceDot.tsx`, `ThreadList.tsx`, `ConversationPane.tsx`, `MessengerPage.tsx`, `Redirects.tsx`
- Modify: `client/src/App.tsx`, `client/src/features/hub/components/HubShell.tsx`, `client/src/features/hub/pro/ProLayout.tsx`, `pro/pages/ProMemberPage.tsx`, `pro/pages/ProJobDetailPage.tsx`, `pages/HubProfilePage.tsx`
- Delete: `pro/pages/ProInboxPage.tsx`, `pro/pages/ProConversationPage.tsx`, `market/pages/InboxPage.tsx`, `market/pages/ConversationPage.tsx`

**Interfaces:**
- Consumes: Task 5 (`useChat`, `sendTyping`, `pro-api.inbox`), existing `pro-api`, `market-api`, `stay-api`.
- Produces:
  - `sources.ts`: `interface Msg`, `interface Convo { messages: Msg[]; other: { id: number; display_name: string; avatar: string | null }; context: string | null; link: { path: string; label: string } | null; closed: boolean }`, `ADAPTERS: Record<InboxSource, { load(id: number): Promise<Convo>; send(id: number, body: string): Promise<unknown>; read(id: number): Promise<unknown> }>`.
  - Routes: `/:lang/benevole/espace/messages` and `/:lang/benevole/espace/messages/:source/:id` → `MessengerPage`.
  - Redirect components: `/pro/messages/:id` → `messages/pro/:id` (keeps `?postuler=1`), `/pro/messages` → `messages`, `/marketplace/messages/:id` → `messages/market/:id`, `/marketplace/messages` → `messages`.

- [ ] **Step 1: `sources.ts`**

```ts
import * as pro from "../pro/pro-api";
import * as mk from "../market/market-api";
import * as st from "../stay/stay-api";

export interface Msg { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
export interface Convo {
  messages: Msg[];
  other: { id: number; display_name: string; avatar: string | null };
  context: string | null;
  /** path relative to /:lang/benevole/espace/ */
  link: { path: string; label: string } | null;
  closed: boolean;
}
export interface Adapter { load(id: number): Promise<Convo>; send(id: number, body: string): Promise<unknown>; read(id: number): Promise<unknown> }

export const ADAPTERS: Record<pro.InboxSource, Adapter> = {
  pro: {
    load: async id => {
      const c = await pro.getMessages(id);
      return { messages: c.messages, other: c.other, context: c.job?.title ?? null, link: c.job ? { path: `pro/emplois/${c.job.id}`, label: "Voir l'offre" } : null, closed: false };
    },
    send: pro.sendMessage,
    read: pro.markRead,
  },
  market: {
    load: async id => {
      const c = await mk.listMessages(id);
      return { messages: c.messages, other: c.other, context: c.listing.title, link: { path: `marketplace/${c.listing.id}`, label: "Voir l'annonce" }, closed: false };
    },
    send: mk.sendMessage,
    read: mk.markRead,
  },
  stay: {
    load: async id => {
      const c = await st.listStayMessages(id);
      const closed = c.request.status === "declined" || c.request.status === "cancelled" || c.request.listing.status === "hidden";
      return { messages: c.messages, other: c.other, context: c.request.listing.title, link: { path: `hebergement/demandes/${c.request.id}`, label: "Voir la demande" }, closed };
    },
    send: st.sendStayMessage,
    read: st.markStayRead,
  },
};
```

- [ ] **Step 2: `PresenceDot.tsx`**

```tsx
export default function PresenceDot({ online, className = "" }: { online: boolean; className?: string }) {
  return (
    <span role="img" aria-label={online ? "En ligne" : "Hors ligne"} className={`inline-block h-3 w-3 rounded-full border-2 border-white ${online ? "bg-emerald-500" : "bg-slate-300"} ${className}`} />
  );
}
```

- [ ] **Step 3: `ThreadList.tsx`** — props `{ items: InboxItem[] | null; activeKey: string | null; filter; onFilter; isOnline; base; onlineMembers }`. Renders:
  - filter chips `Tout · Pro · Marketplace · Séjours` (`aria-pressed`).
  - "En ligne" strip: avatars (with `PresenceDot`) of members that are online and appear in `items`' `other`s, plus nothing else (members you have never talked to are reached from member pages). Each chip is a `Link` to `${base}/messages/${source}/${id}` of the latest item with that member.
  - list rows: `Link` to `${base}/messages/${i.source}/${i.id}`, avatar with a `PresenceDot` at bottom-right (`relative` wrapper, `absolute -bottom-0.5 -right-0.5`), name, `ago(i.last_message_at)` (import from `../pro/format`), source badge (`Pro` blue-100, `Marketplace` amber-100, `Séjour` emerald-100, each `rounded-full px-2 text-[11px] font-semibold`), context line, last body (bold when unread), unread pill. Empty state: « Aucune discussion. Écrivez à un membre depuis sa fiche, ou ouvrez une offre, une annonce ou un séjour. »
  - active row `bg-blue-50`; `aria-current="page"`.

- [ ] **Step 4: `ConversationPane.tsx`** — props `{ me: Member; source: InboxSource; id: number; base: string; onActivity(): void }`. Behaviour (port of the old `ProConversationPage`, same guards):
  - `ADAPTERS[source].load(id)`; `reqId` ref to drop stale loads; `hasData` ref; only `HubApiError` 404 sets "introuvable"; other errors toast only when nothing loaded yet.
  - `useChat(e => { if (e.type === "message" && e.source === source && e.thread_id === id) load(); if (e.type === "typing" && e.source === source && e.thread_id === id && e.from === data?.other.id) show typing for 4 s })`. Keep a `typingTimer` ref; show « … écrit » under the name.
  - Polling: `setInterval(load, connected ? 30_000 : 5_000)` when `!document.hidden` (safety net; push does the instant work). Dedupe is natural: `load` replaces the whole message array.
  - After load: if any message from the other is unread → `ADAPTERS[source].read(id)` then `onActivity()` (refreshes inbox badges).
  - Header: avatar + `PresenceDot online={isOnline(other.id)}`, name linking to `${base}/pro/membre/${other.id}`, status text « En ligne » (emerald) / « Hors ligne » (slate), context + `link` (`Link` to `${base}/${link.path}`) .
  - Messages: bubbles as in the old page; `max-h-[60vh]` becomes `h-full overflow-y-auto` inside a flex column that fills the pane; scroll to bottom on length change.
  - Form: `Input` maxLength 1000; `sending` ref guard; on send → `adapter.send` then `load()` and `onActivity()`; `onChange` calls `sendTyping(other.id, source, id)` at most once per 2.5 s (ref timestamp). When `closed`, replace the form with « Cette demande est close. » 
  - Prefill: `?postuler=1` (via `useSearch`) and `source === "pro"` and no messages and `context` → draft `Bonjour, je suis intéressé(e) par l'offre « ${context} ». Pouvons-nous échanger ?` once (`prefilled` ref).

- [ ] **Step 5: `MessengerPage.tsx`**

```tsx
// route params: lang, source?, id?
```
  - `useRoute("/:lang/benevole/espace/messages/:source/:id")` for the selection; validates `source ∈ {pro, market, stay}` and `Number.isSafeInteger(id) && id > 0`, else treated as no selection.
  - `me = useHubMember()`; spinner while loading.
  - `items` state from `pro.inbox()`; `refresh()` on mount, on `useChat` events of type `message`, and via `onActivity`. Poll 30 s.
  - Layout inside `HubShell`: `grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4`; list column hidden on small screens when a conversation is selected (`hidden lg:block`), pane hidden on small screens when none selected. On small screens the pane has a « ← Messages » link to `${base}/messages`. Pane placeholder on desktop with no selection: « Choisissez une discussion. ».
  - `filter` state: `"all" | InboxSource`.

- [ ] **Step 6: `Redirects.tsx`**

```tsx
import { useEffect } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useI18n } from "@/i18n";

/** Old inbox/conversation URLs (bookmarks, notification links) keep working. */
export function RedirectMessages({ from, source }: { from: string; source?: "pro" | "market" }) {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [, params] = useRoute(`${from}/:id`);
  const search = useSearch();
  useEffect(() => {
    const base = `/${lang}/benevole/espace/messages`;
    setLocation(`${source && params?.id ? `${base}/${source}/${params.id}` : base}${search ? `?${search}` : ""}`, { replace: true });
  }, [lang, params?.id, search, setLocation, source]);
  return null;
}
```
(`from` is the route pattern prefix, e.g. `/:lang/benevole/espace/pro/messages`; the component is mounted twice per module: once for `:id`, once without. Keep it simple: in `App.tsx` mount `<RedirectMessages from=… source=… />` for `…/messages/:id` and `…/messages`.)

- [ ] **Step 7: Wire `App.tsx`**

Remove the imports/routes of `ProInboxPage`, `ProConversationPage`, `InboxPage`, `ConversationPage`. Add (most specific first, before `/marketplace/:id`-style routes so `messages` is not captured as `:id`):

```tsx
<Route path="/:lang/benevole/espace/messages/:source/:id" component={MessengerPage} />
<Route path="/:lang/benevole/espace/messages" component={MessengerPage} />
<Route path="/:lang/benevole/espace/marketplace/messages/:threadId">{() => <RedirectMessages from="/:lang/benevole/espace/marketplace/messages" source="market" />}</Route>
<Route path="/:lang/benevole/espace/marketplace/messages">{() => <RedirectMessages from="/:lang/benevole/espace/marketplace/messages" />}</Route>
<Route path="/:lang/benevole/espace/pro/messages/:threadId">{() => <RedirectMessages from="/:lang/benevole/espace/pro/messages" source="pro" />}</Route>
<Route path="/:lang/benevole/espace/pro/messages">{() => <RedirectMessages from="/:lang/benevole/espace/pro/messages" />}</Route>
```
The `useRoute` pattern in `Redirects.tsx` uses the param name `:id`; route patterns in `App.tsx` use `:threadId`. Use `:threadId` in `Redirects.tsx` (`useRoute(\`${from}/:threadId\`)`, `params?.threadId`) so both agree.

- [ ] **Step 8: Navigation and links**

`HubShell.tsx`: remove `mk`, `st` imports and the `unread`/`stayUnread`/`proUnread` states; keep one `msgUnread` from `proApi.unreadCount()`; call `useChat(e => { if (e.type === "message") tick(); })` (import from `../messenger/useChat`; move `tick` out of the effect with `useCallback`). `const messages = \`${base}/messages\``. `isMessages = path.startsWith(messages)`; `isMarket = path.startsWith(market)`. In `navLinks`: Marketplace, « Offre d'emploi », Hébergement get `badge: 0`; « Messages » (`short: "Messages"`, label `Messages`) gets `badge: msgUnread, badgeLabel: "messages non lus"`. Dropdown « Mes messages » uses `msgUnread`.
`ProLayout.tsx`: the Messages tab links to `/${lang}/benevole/espace/messages` (special-case in the map: `to` absolute for that tab).
`ProMemberPage.tsx`: « Écrire » → `setLocation(\`/${lang}/benevole/espace/messages/pro/${t.id}\`)`; add `PresenceDot`/« En ligne » next to the name via `useChat().isOnline(p.member.id)`.
`ProJobDetailPage.tsx`: « Postuler » → `setLocation(\`/${lang}/benevole/espace/messages/pro/${t.id}?postuler=1\`)`.
`HubProfilePage.tsx`: when viewing another member (`viewedId && me && viewedId !== me.id`), add an « Écrire » button → `proApi.openThread({ to: viewedId })` then `setLocation(\`/${lang}/benevole/espace/messages/pro/${t.id}\`)`, and the online dot.

- [ ] **Step 9: Verify**

Run: `pnpm check 2>&1 | grep -E "features/hub|App.tsx" | head`
Expected: no output (no errors in touched files; baseline errors elsewhere are unchanged — compare the total count to the baseline).
Run: `pnpm vitest run worker 2>&1 | tail -8`
Expected: only the baseline failures.
Run: `grep -rn "ProInboxPage\|ProConversationPage\|market/pages/InboxPage\|market/pages/ConversationPage\|marketplace/messages\|pro/messages" client/src | grep -v Redirects | grep -v "App.tsx"`
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add -A client/src
git commit -m "feat(messenger): unified Messenger page, presence, instant chat, redirects

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Final verification and docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-10-messenger-design.md` (apply the "Précisions décidées au plan")

- [ ] **Step 1:** Apply the plan's « Précisions » to the spec (subprotocol auth, no 4401, `/espace/messages` route, Stay pages kept, unread sum + single badge).
- [ ] **Step 2:** Run `pnpm vitest run worker/hub.test.ts worker/hub-d1.test.ts worker/market.test.ts worker/market-d1.test.ts worker/stay.test.ts worker/stay-d1.test.ts worker/pro.test.ts worker/pro-d1.test.ts worker/messenger-d1.test.ts worker/hub-chat-core.test.ts` — Expected: all PASS.
- [ ] **Step 3:** Run `pnpm check` and `pnpm test`; Expected: same totals as the baseline recorded at setup.
- [ ] **Step 4:** Run `pnpm build:worker` — Expected: success.
- [ ] **Step 5:** Commit `docs: align messenger spec with plan decisions`.
- [ ] **Step 6 (manual, user side):** `npx wrangler dev`, sign in with two accounts in two browsers, check: green dot appears/disappears on tab open/close, a message appears instantly on the other side, typing indicator, Marketplace and Stay conversations show in "Messages", old `/marketplace/messages` URLs redirect. Deploy: `pnpm build:cloudflare && npx wrangler deploy` (the Durable Object migration `v1` is created by this deploy), then the front deploy.
