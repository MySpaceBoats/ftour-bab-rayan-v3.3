/**
 * Community blog data layer on Cloudflare D1.
 * No tRPC / Supabase imports: testable with a fake D1 (see blog-d1.test.ts).
 * Output keeps the snake_case shape the client already consumes.
 */
import type { D1Like } from "./gallery-d1";

export type BlogStatus = "pending" | "approved" | "rejected";
export type BlogSort = "recent" | "popular" | "views";

const PUBLIC_LIST = "id, title, slug, excerpt, hook, author_name, type, categories, cover_image, likes, views, created_at";
const ADMIN_LIST =
  "id, title, slug, excerpt, author_name, author_id, type, categories, status, likes, views, created_at, rejection_note";
const PUBLIC_ONE =
  "id, title, slug, content, excerpt, hook, author_name, type, categories, cover_image, likes, views, status, created_at";
const CARD = "id, title, slug, excerpt, hook, author_name, type, categories, cover_image, likes, created_at";

function parseCategories(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function mapPost<T extends Record<string, any>>(row: T | null): T | null {
  if (!row) return row;
  const out: Record<string, any> = { ...row };
  if ("categories" in out) out.categories = parseCategories(out.categories);
  if ("consented" in out) out.consented = Boolean(Number(out.consented));
  return out as T;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);

const ORDER: Record<BlogSort, string> = {
  popular: "likes DESC",
  views: "views DESC",
  recent: "created_at DESC",
};

export interface ListPostsInput {
  page: number;
  pageSize: number;
  sort: BlogSort;
  status?: BlogStatus;
  type?: string;
  category?: string;
  search?: string;
}

export async function listPosts(d: D1Like, input: ListPostsInput, admin: boolean) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.status) { where.push("status = ?"); params.push(input.status); }
  if (input.type) { where.push("type = ?"); params.push(input.type); }
  if (input.category) {
    where.push("EXISTS (SELECT 1 FROM json_each(categories) WHERE value = ?)");
    params.push(input.category);
  }
  if (input.search) { where.push("title LIKE ? ESCAPE '\\'"); params.push(`%${escapeLike(input.search)}%`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows, count] = await Promise.all([
    d
      .prepare(`SELECT ${admin ? ADMIN_LIST : PUBLIC_LIST} FROM blog_posts ${w} ORDER BY ${ORDER[input.sort]} LIMIT ? OFFSET ?`)
      .bind(...params, input.pageSize, (input.page - 1) * input.pageSize)
      .all(),
    d.prepare(`SELECT COUNT(*) AS n FROM blog_posts ${w}`).bind(...params).first<{ n: number }>(),
  ]);
  return { posts: rows.results.map(mapPost), total: count?.n ?? 0 };
}

export async function bySlug(d: D1Like, slug: string) {
  return mapPost(
    await d.prepare(`SELECT ${PUBLIC_ONE} FROM blog_posts WHERE slug = ? AND status = 'approved'`).bind(slug).first()
  );
}

export async function getById(d: D1Like, id: number) {
  return mapPost(await d.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(id).first());
}

export async function related(d: D1Like, postId: number, type: string) {
  const { results } = await d
    .prepare(
      `SELECT id, title, slug, excerpt, author_name, type, cover_image, likes, created_at FROM blog_posts
       WHERE status = 'approved' AND type = ? AND id != ? ORDER BY created_at DESC LIMIT 3`
    )
    .bind(type, postId)
    .all();
  return results;
}

export async function latest(d: D1Like, limit = 3) {
  const { results } = await d
    .prepare(`SELECT ${CARD} FROM blog_posts WHERE status = 'approved' ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all();
  return results.map(mapPost);
}

export async function incrementViews(d: D1Like, slug: string) {
  await d.prepare("UPDATE blog_posts SET views = views + 1 WHERE slug = ?").bind(slug).run();
}

/** Slug unique among posts (optionally ignoring one id). */
export async function uniqueSlug(d: D1Like, base: string, excludeId?: number): Promise<string> {
  let slug = base;
  for (let attempt = 1; ; attempt++) {
    const hit = await d
      .prepare("SELECT 1 AS x FROM blog_posts WHERE slug = ? AND id != ? LIMIT 1")
      .bind(slug, excludeId ?? -1)
      .first();
    if (!hit) return slug;
    slug = `${base}-${attempt}`;
  }
}

export interface NewPost {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  hook: string | null;
  authorId: number;
  authorName: string;
  type: string;
  categories: string[];
  coverImage: string | null;
}

export async function createPost(d: D1Like, p: NewPost) {
  const row = await d
    .prepare(
      `INSERT INTO blog_posts (title, slug, content, excerpt, hook, author_id, author_name, type, categories, cover_image, consented, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,'pending') RETURNING id, slug`
    )
    .bind(p.title, p.slug, p.content, p.excerpt, p.hook, p.authorId, p.authorName, p.type, JSON.stringify(p.categories), p.coverImage)
    .first<{ id: number; slug: string }>();
  if (!row) throw new Error("blog insert failed");
  return row;
}

export async function hasLiked(d: D1Like, postId: number, userId: number) {
  return !!(await d.prepare("SELECT 1 AS x FROM blog_post_likes WHERE post_id = ? AND user_id = ?").bind(postId, userId).first());
}

/** Atomic (D1 batch is a transaction): row + counter change together. */
export async function toggleLike(d: D1Like, postId: number, userId: number): Promise<boolean> {
  if (await hasLiked(d, postId, userId)) {
    await d.batch([
      d.prepare("DELETE FROM blog_post_likes WHERE post_id = ? AND user_id = ?").bind(postId, userId),
      d.prepare("UPDATE blog_posts SET likes = MAX(0, likes - 1) WHERE id = ?").bind(postId),
    ]);
    return false;
  }
  await d.batch([
    d.prepare("INSERT INTO blog_post_likes (post_id, user_id) VALUES (?, ?)").bind(postId, userId),
    d.prepare("UPDATE blog_posts SET likes = likes + 1 WHERE id = ?").bind(postId),
  ]);
  return true;
}

export interface PostPatch {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  type?: string;
  categories?: string[];
  hook?: string;
  cover_image?: string | null;
  status?: BlogStatus;
  rejection_note?: string | null;
}

export async function updatePost(d: D1Like, id: number, patch: PostPatch) {
  const cols: Record<string, unknown> = {
    ...patch,
    categories: patch.categories === undefined ? undefined : JSON.stringify(patch.categories),
  };
  const entries = Object.entries(cols).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  await d
    .prepare(
      `UPDATE blog_posts SET ${entries.map(([k]) => `${k} = ?`).join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    )
    .bind(...entries.map(([, v]) => v), id)
    .run();
}

export async function deletePost(d: D1Like, id: number) {
  await d.batch([
    d.prepare("DELETE FROM blog_post_likes WHERE post_id = ?").bind(id),
    d.prepare("DELETE FROM blog_posts WHERE id = ?").bind(id),
  ]);
}

export async function stats(d: D1Like) {
  const { results } = await d
    .prepare("SELECT status, COUNT(*) AS n FROM blog_posts GROUP BY status")
    .all<{ status: BlogStatus; n: number }>();
  const by = Object.fromEntries(results.map(r => [r.status, r.n]));
  const [pending, approved, rejected] = [by.pending ?? 0, by.approved ?? 0, by.rejected ?? 0];
  return { pending, approved, rejected, total: pending + approved + rejected };
}
