import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as e from "./election-d1";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
function fakeD1(sqlite: InstanceType<typeof DatabaseSync>): D1Like {
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return { prepare: sql => stmt(sql), batch: async x => Promise.all(x.map(y => y.run())) };
}

let d: D1Like;
const Y = 2026;
const cand = (email: string, over: Partial<e.NewCandidate> = {}): e.NewCandidate => ({
  first_name: "A", last_name: "B", email, phone: null, photo_url: null, motivation_text: null,
  participation_count: 3, election_year: Y, ...over,
});
beforeEach(() => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("./d1/election.sql", import.meta.url), "utf8"));
  d = fakeD1(db);
});

describe("election-d1", () => {
  it("settings: get-or-create is idempotent, toggle open", async () => {
    const a = await e.getSettings(d, Y);
    expect(a).toMatchObject({ is_open: false, max_managers: 10 });
    expect((await e.getSettings(d, Y))?.id).toBe(a?.id);
    expect(await e.isOpen(d, Y)).toBe(false);
    expect((await e.upsertSettings(d, Y, { is_open: true }))?.is_open).toBe(true);
    expect(await e.isOpen(d, Y)).toBe(true);
  });

  it("candidacy: one per email per year, case-insensitive", async () => {
    await e.createCandidate(d, cand("a@x.y"));
    expect(await e.hasCandidacy(d, "A@X.Y", Y)).toBe(true);
    await expect(e.createCandidate(d, cand("A@x.y"))).rejects.toThrow(/UNIQUE/);
    await e.createCandidate(d, cand("a@x.y", { election_year: Y - 1 }));
  });

  it("vote: only approved candidates, once per voter, ranking by votes", async () => {
    const a: any = await e.createCandidate(d, cand("a@x.y"));
    const b: any = await e.createCandidate(d, cand("b@x.y"));
    expect(await e.castVote(d, "v1", a.id, Y)).toBe("no_candidate");
    await e.setCandidateStatus(d, a.id, "approved");
    await e.setCandidateStatus(d, b.id, "approved");
    expect(await e.castVote(d, "v1", b.id, Y)).toBe("ok");
    expect(await e.castVote(d, "v1", a.id, Y)).toBe("already_voted");
    await e.castVote(d, "v2", b.id, Y);
    await e.castVote(d, "v3", a.id, Y);
    const r = await e.results(d, Y);
    expect(r.map((x: any) => [x.id, x.votes])).toEqual([[b.id, 2], [a.id, 1]]);
    expect(await e.getVote(d, "v1", Y)).toBe(b.id);
    expect(await e.stats(d, Y)).toEqual({ totalCandidates: 2, approvedCandidates: 2, pendingCandidates: 0, totalVotes: 3 });
  });

  it("delete candidate cascades votes; history caps at max_managers", async () => {
    await e.upsertSettings(d, Y, { max_managers: 1 });
    const a: any = await e.createCandidate(d, cand("a@x.y"));
    const b: any = await e.createCandidate(d, cand("b@x.y"));
    for (const c of [a, b]) await e.setCandidateStatus(d, c.id, "approved");
    await e.castVote(d, "v1", b.id, Y);
    const h = await e.history(d);
    expect(h).toHaveLength(1);
    expect(h[0].managers.map((m: any) => m.id)).toEqual([b.id]);
    await e.deleteCandidate(d, b.id);
    expect(await e.listVotes(d, Y)).toHaveLength(0);
  });
});
