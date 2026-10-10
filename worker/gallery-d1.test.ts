import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import type { DatabaseSync as DB } from "node:sqlite";
import * as g from "./gallery-d1";
import { GALLERY_SCHEMA } from "./test-d1";

// Fake D1 over node:sqlite so the real SQL (json_each, LIKE, joins) is exercised offline.
// vite does not know node:sqlite as a builtin, so load it via require
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

function fakeD1(sqlite: DB): g.D1Like {
  const stmt = (sql: string, params: unknown[] = []): g.D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as any[])) as any[] }),
    first: async () => ((sqlite.prepare(sql).get(...(params as any[])) as any) ?? null),
    run: async () => sqlite.prepare(sql).run(...(params as any[])),
  });
  return { prepare: sql => stmt(sql), batch: async s => Promise.all(s.map(x => x.run())) };
}

const O = "https://api.test";
let d: g.D1Like;
const photo = (over: Partial<g.NewPhoto> = {}): g.NewPhoto => ({
  eventDate: null, tags: [], sortOrder: 0, isFeatured: false, status: "published",
  storagePath: `gallery/original/${crypto.randomUUID()}.jpg`, sizeBytes: 10, mimeType: "image/jpeg",
  validated: true, ...over,
});

beforeEach(() => {
  const s = new DatabaseSync(":memory:");
  s.exec(GALLERY_SCHEMA);
  d = fakeD1(s);
});

describe("gallery D1 data layer", () => {
  it("inserts a photo and maps it to the client shape with R2 urls", async () => {
    const album: any = await g.createAlbum(d, { name: "2026", slug: "ftour-2026", sortOrder: 0, status: "published" });
    const p: any = await g.insertPhoto(d, photo({ tags: ["a", "b"], albumId: album.id, isFeatured: true, storagePath: "gallery/original/x.jpg" }), O);
    expect(p.tags).toEqual(["a", "b"]);
    expect(p.is_featured).toBe(true);
    expect(p.image_original_url).toBe(`${O}/media/gallery/original/x.jpg`);
    expect(p.image_thumb_url).toBe(p.image_original_url);
    expect(p.gallery_albums).toEqual({ name: "2026", slug: "ftour-2026" });
  });

  it("filters by status, album slug, tag and escapes LIKE wildcards in search", async () => {
    const a: any = await g.createAlbum(d, { name: "A", slug: "album-a", sortOrder: 0, status: "published" });
    await g.insertPhoto(d, photo({ title: "100% fun", tags: ["iftar"], albumId: a.id }), O);
    await g.insertPhoto(d, photo({ title: "other", tags: ["sport"], status: "draft" }), O);
    const base = { page: 1, pageSize: 10 };
    expect((await g.listPhotos(d, { ...base, status: "published" }, O)).total).toBe(1);
    expect((await g.listPhotos(d, { ...base, album: "album-a" }, O)).total).toBe(1);
    expect((await g.listPhotos(d, { ...base, tag: "sport" }, O)).items).toHaveLength(1);
    expect((await g.listPhotos(d, { ...base, search: "100%" }, O)).total).toBe(1);
    expect((await g.listPhotos(d, { ...base, search: "%" }, O)).total).toBe(1); // literal %, not wildcard
  });

  it("paginates with a correct total", async () => {
    for (let i = 0; i < 5; i++) await g.insertPhoto(d, photo({ sortOrder: i }), O);
    const r = await g.listPhotos(d, { page: 2, pageSize: 2 }, O);
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(5);
  });

  it("recent sort puts dated photos first, newest first", async () => {
    await g.insertPhoto(d, photo({ title: "nodate" }), O);
    await g.insertPhoto(d, photo({ title: "old", eventDate: "2020-01-01" }), O);
    await g.insertPhoto(d, photo({ title: "new", eventDate: "2026-01-01" }), O);
    const t = (await g.listPhotos(d, { page: 1, pageSize: 10, sort: "recent" }, O)).items.map((i: any) => i.title);
    expect(t).toEqual(["new", "old", "nodate"]);
  });

  it("updates only provided fields; deletes return the unique R2 keys", async () => {
    const p: any = await g.insertPhoto(d, photo({ title: "t", storagePath: "gallery/original/k.jpg" }), O);
    const u: any = await g.updatePhoto(d, p.id, { isFeatured: true, tags: ["z"] }, O);
    expect(u.title).toBe("t");
    expect(u.is_featured).toBe(true);
    expect(u.tags).toEqual(["z"]);
    expect(await g.deletePhoto(d, p.id)).toEqual(["gallery/original/k.jpg"]); // thumb == original, deduped
    expect(await g.deletePhoto(d, p.id)).toBeNull();
  });

  it("email validation publishes once and clears the token", async () => {
    const token = "t".repeat(36);
    const p: any = await g.insertPhoto(d, photo({ status: "draft", validated: false, validationToken: token, validationEmail: "a@b.c" }), O);
    expect(await g.pendingTokenForEmail(d, "a@b.c")).toBe(token);
    const rows = await g.photosByToken(d, token);
    await g.publishValidated(d, rows.map(r => r.id));
    expect((await g.getPhoto(d, p.id, O) as any).status).toBe("published");
    expect(await g.photosByToken(d, token)).toHaveLength(0);
    expect(await g.pendingTokenForEmail(d, "a@b.c")).toBeNull();
  });

  it("fails loudly when the D1 binding is missing", () => {
    expect(() => g.db({})).toThrow(/DB is not configured/);
  });
});
