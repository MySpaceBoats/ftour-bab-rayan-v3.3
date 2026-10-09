import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as h from "./hub-d1";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function fakeD1(sqlite: InstanceType<typeof DatabaseSync>): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return {
    prepare: sql => stmt(sql),
    batch: async s => {
      sqlite.exec("BEGIN");
      try { for (const x of s) await x.run(); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      return [];
    },
  };
}

const T0 = Date.parse("2026-10-09T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
let sqlite: InstanceType<typeof DatabaseSync>;
let d: D1Like;

const vol = (email: string, status = "confirmed", first = "Amina", last = "Benali") =>
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,?)").run(first, last, email, status);

async function login(email: string, now = T0) {
  return h.openSession(d, await h.createLoginToken(d, email, now), now);
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE t_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, email TEXT, status TEXT);");
  const sql = readFileSync(new URL("./d1/hub.sql", import.meta.url), "utf8");
  sqlite.exec(sql);
  sqlite.exec(sql); // idempotent
  d = fakeD1(sqlite);
});

describe("hub identity", () => {
  it("isEligible: confirmed/present only, case-insensitive", async () => {
    vol("ok@x.ma", "confirmed"); vol("here@x.ma", "present"); vol("new@x.ma", "registered"); vol("gone@x.ma", "cancelled");
    expect(await h.isEligible(d, "OK@x.ma ")).toBe(true);
    expect(await h.isEligible(d, "here@x.ma")).toBe(true);
    expect(await h.isEligible(d, "new@x.ma")).toBe(false);
    expect(await h.isEligible(d, "gone@x.ma")).toBe(false);
    expect(await h.isEligible(d, "nobody@x.ma")).toBe(false);
  });

  it("login token is single-use, expires, and is stored hashed", async () => {
    const raw = await h.createLoginToken(d, "a@x.ma", T0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_login_tokens WHERE token_hash = ?").get(raw)).toEqual({ n: 0 });
    vol("a@x.ma");
    await h.openSession(d, raw, T0 + 1000);
    await expect(h.openSession(d, raw, T0 + 2000)).rejects.toMatchObject({ code: "unauthorized" });
    const late = await h.createLoginToken(d, "a@x.ma", T0);
    await expect(h.openSession(d, late, T0 + h.LOGIN_TTL_MS + 1)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("opens a session, creates the member once, names it from the volunteer", async () => {
    vol("a@x.ma");
    const a = await login("A@x.ma");
    expect(a.member).toMatchObject({ display_name: "Amina B.", role: "member" });
    expect(JSON.stringify(a.member)).not.toContain("a@x.ma");
    await login("a@x.ma", T0 + 1000);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_members").get()).toEqual({ n: 1 });
    expect((await h.getSession(d, a.session, T0 + 5000))?.email).toBe("a@x.ma");
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM hub_sessions WHERE token_hash = ?").get(a.session)).toEqual({ n: 0 });
  });

  it("refuses non-eligible volunteers and suspended members", async () => {
    vol("new@x.ma", "registered");
    await expect(login("new@x.ma")).rejects.toMatchObject({ code: "forbidden" });
    vol("s@x.ma");
    const s = await login("s@x.ma");
    sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(s.member.id);
    expect(await h.getSession(d, s.session, T0 + 10)).toBeNull();
    await expect(login("s@x.ma", T0 + 20)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("session ends on revoke and on expiry", async () => {
    vol("a@x.ma");
    const a = await login("a@x.ma");
    expect(await h.getSession(d, a.session, T0 + h.SESSION_TTL_MS + 1)).toBeNull();
    expect(await h.getSession(d, a.session, T0 + 1)).not.toBeNull();
    await h.revokeSession(d, a.session, T0 + 2);
    expect(await h.getSession(d, a.session, T0 + 3)).toBeNull();
    expect(await h.getSession(d, "", T0)).toBeNull();
  });

  it("canRequestLogin allows 3 links per hour per email", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await h.canRequestLogin(d, "a@x.ma", T0 + i)).toBe(true);
      await h.createLoginToken(d, "a@x.ma", T0 + i);
    }
    expect(await h.canRequestLogin(d, "a@x.ma", T0 + 10)).toBe(false);
    expect(await h.canRequestLogin(d, "a@x.ma", T0 + HOUR + 10)).toBe(true);
  });

  it("updateProfile validates name, bio and avatar ownership", async () => {
    vol("a@x.ma");
    const { member } = await login("a@x.ma");
    const row = (await h.getSession(d, (await login("a@x.ma", T0 + 1)).session, T0 + 2))!;
    expect(await h.updateProfile(d, row, { display_name: " Nadia ", bio: "Hello", avatar_key: `${member.id}/p.jpg` }))
      .toMatchObject({ display_name: "Nadia", bio: "Hello", avatar_key: `${member.id}/p.jpg` });
    await expect(h.updateProfile(d, row, { display_name: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { display_name: "x".repeat(41) })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { bio: "x".repeat(301) })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { avatar_key: "999/p.jpg" })).rejects.toMatchObject({ code: "invalid" });
    await expect(h.updateProfile(d, row, { avatar_key: `${member.id}/../x.jpg` })).rejects.toMatchObject({ code: "invalid" });
  });
});
