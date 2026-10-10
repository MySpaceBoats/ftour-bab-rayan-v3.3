import { beforeEach, describe, expect, it } from "vitest";
import type { D1Like } from "./gallery-d1";
import { fakeD1, openDb, type Sqlite } from "./test-d1";
import * as h from "./hub-d1";
import * as pro from "./pro-d1";

const T0 = Date.parse("2026-10-10T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let sqlite: Sqlite;
let d: D1Like;

async function member(email: string, first = "Amina", role?: "moderator") {
  sqlite.prepare("INSERT INTO t_volunteers (first_name,last_name,email,status) VALUES (?,?,?,'confirmed')").run(first, "Benali", email);
  const { session } = await h.openSession(d, await h.createLoginToken(d, email, T0), T0);
  if (role) sqlite.prepare("UPDATE hub_members SET role=? WHERE email=?").run(role, email);
  return (await h.getSession(d, session, T0 + 1))!;
}
const suspend = (id: number) => sqlite.prepare("UPDATE hub_members SET status='suspended' WHERE id=?").run(id);

beforeEach(() => {
  sqlite = openDb();
  d = fakeD1(sqlite);
});

describe("pro profile", () => {
  it("returns defaults, then saves and normalises", async () => {
    const a = await member("a@x.ma");
    expect(await pro.getProfile(d, a.id, a.id)).toMatchObject({ headline: "", company: "", skills: [], open_to_work: false, mine: true });
    await pro.saveProfile(d, a, { headline: " Dev ", company: "Acme", city: "Rabat", skills: ["React", " react ", "", "SQL"], open_to_work: true }, T0);
    expect(await pro.getProfile(d, a.id, a.id)).toMatchObject({ headline: "Dev", company: "Acme", city: "Rabat", skills: ["React", "SQL"], open_to_work: true });
  });

  it("saving twice updates the same row", async () => {
    const a = await member("a@x.ma");
    await pro.saveProfile(d, a, { headline: "A" }, T0);
    await pro.saveProfile(d, a, { headline: "B" }, T0 + 1);
    expect((await pro.getProfile(d, a.id, a.id)).headline).toBe("B");
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM pro_profiles").get() as { n: number }).n).toBe(1);
  });

  it("rejects invalid input", async () => {
    const a = await member("a@x.ma");
    const bad: Record<string, unknown>[] = [
      { headline: "x".repeat(81) }, { company: "x".repeat(81) }, { city: "x".repeat(61) },
      { skills: Array.from({ length: 9 }, (_, i) => `s${i}`) }, { skills: ["x".repeat(31)] }, { skills: "react" }, { skills: [1] }, { company: 5 },
    ];
    for (const b of bad) await expect(pro.saveProfile(d, a, b, T0)).rejects.toMatchObject({ code: "invalid" });
  });

  it("is visible to other members; suspended or unknown members are not found", async () => {
    const a = await member("a@x.ma");
    const b = await member("b@x.ma", "Youssef");
    await pro.saveProfile(d, a, { headline: "Dev" }, T0);
    expect(await pro.getProfile(d, b.id, a.id)).toMatchObject({ headline: "Dev", mine: false, member: { id: a.id } });
    suspend(a.id);
    await expect(pro.getProfile(d, b.id, a.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(pro.getProfile(d, b.id, 9999)).rejects.toMatchObject({ code: "not_found" });
  });
});
