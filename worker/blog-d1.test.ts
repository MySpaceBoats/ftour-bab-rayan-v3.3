import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1Stmt } from "./gallery-d1";
import * as b from "./blog-d1";

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

let d: D1Like;
const post = (over: Partial<b.NewPost> = {}): b.NewPost => ({
  title: "Titre", slug: `s-${crypto.randomUUID()}`, content: "c", excerpt: "e", hook: null,
  authorId: 1, authorName: "A", type: "benevole", categories: ["ressenti"], coverImage: null, ...over,
});
const page = { page: 1, pageSize: 10, sort: "recent" as const };

beforeEach(() => {
  const s = new DatabaseSync(":memory:");
  s.exec(readFileSync(new URL("./d1/blog.sql", import.meta.url), "utf8"));
  d = fakeD1(s);
});

describe("blog-d1", () => {
  it("creates pending posts hidden from public until approved", async () => {
    const { id, slug } = await b.createPost(d, post({ slug: "a" }));
    expect(await b.bySlug(d, slug)).toBeNull();
    await b.updatePost(d, id, { status: "approved" });
    expect((await b.bySlug(d, "a"))?.categories).toEqual(["ressenti"]);
  });

  it("filters by category/type/search with escaped LIKE", async () => {
    const a = await b.createPost(d, post({ title: "100% foi", categories: ["histoire", "analyse"] }));
    const c = await b.createPost(d, post({ title: "autre", type: "equipe" }));
    for (const x of [a, c]) await b.updatePost(d, x.id, { status: "approved" });
    const q = (extra: object) => b.listPosts(d, { ...page, status: "approved", ...extra }, false);
    expect((await q({ category: "analyse" })).total).toBe(1);
    expect((await q({ type: "equipe" })).total).toBe(1);
    expect((await q({ search: "100%" })).total).toBe(1);
    expect((await q({ search: "%" })).total).toBe(1);
  });

  it("toggleLike is symmetric, per user, counter never negative", async () => {
    const { id } = await b.createPost(d, post());
    expect(await b.toggleLike(d, id, 7)).toBe(true);
    expect(await b.toggleLike(d, id, 8)).toBe(true);
    expect((await b.getById(d, id))?.likes).toBe(2);
    expect(await b.toggleLike(d, id, 7)).toBe(false);
    expect(await b.hasLiked(d, id, 7)).toBe(false);
    expect((await b.getById(d, id))?.likes).toBe(1);
  });

  it("uniqueSlug suffixes collisions and ignores own id", async () => {
    const { id } = await b.createPost(d, post({ slug: "x" }));
    expect(await b.uniqueSlug(d, "x")).toBe("x-1");
    expect(await b.uniqueSlug(d, "x", id)).toBe("x");
  });

  it("views, stats, delete", async () => {
    const { id } = await b.createPost(d, post({ slug: "v" }));
    await b.updatePost(d, id, { status: "approved" });
    await b.incrementViews(d, "v");
    expect((await b.bySlug(d, "v"))?.views).toBe(1);
    expect(await b.stats(d)).toEqual({ pending: 0, approved: 1, rejected: 0, total: 1 });
    await b.deletePost(d, id);
    expect((await b.stats(d)).total).toBe(0);
  });
});
