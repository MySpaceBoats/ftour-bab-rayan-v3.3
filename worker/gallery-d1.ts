/**
 * Gallery data layer on Cloudflare D1 (rows) + R2 (image bytes).
 * No tRPC / Supabase imports: keeps it testable with a fake D1.
 * Output keeps the snake_case shape the client already consumes.
 */

// Minimal structural types (workers-types is not loaded for the worker bundle).
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown[]>;
}
export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpEtag: string; httpMetadata?: { contentType?: string } } | null>;
  delete(keys: string | string[]): Promise<void>;
}

export type GalleryStatus = "draft" | "published" | "rejected";
export const MEDIA_PATH_PREFIX = "/media/";

export function mediaUrl(origin: string, key: string | null | undefined): string | null {
  return key ? `${origin}${MEDIA_PATH_PREFIX}${key}` : null;
}

export function db(env: { DB?: D1Like }): D1Like {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  return env.DB;
}

// ---- row mapping ----------------------------------------------------------

function parseTags(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function mapPhoto(row: any, origin: string) {
  if (!row) return row;
  const { album_name, album_slug, ...rest } = row;
  const original = mediaUrl(origin, row.storage_path) ?? row.image_original_url;
  return {
    ...rest,
    tags: parseTags(row.tags),
    is_featured: Boolean(Number(row.is_featured)),
    image_original_url: original,
    image_thumb_url: mediaUrl(origin, row.thumb_storage_path) ?? original,
    image_medium_url: mediaUrl(origin, row.medium_storage_path) ?? null,
    gallery_albums: row.album_id ? { name: album_name ?? null, slug: album_slug ?? null } : null,
  };
}

const PHOTO_SELECT = `p.*, a.name AS album_name, a.slug AS album_slug
  FROM gallery_photos p LEFT JOIN gallery_albums a ON a.id = p.album_id`;

// ---- albums ---------------------------------------------------------------

export async function listAlbums(d: D1Like, opts: { onlyPublished?: boolean } = {}) {
  const where = opts.onlyPublished ? "WHERE status = 'published'" : "";
  const { results } = await d
    .prepare(`SELECT * FROM gallery_albums ${where} ORDER BY sort_order ASC, created_at DESC`)
    .all();
  return results;
}

export async function createAlbum(
  d: D1Like,
  input: { name: string; slug: string; sortOrder: number; status: "draft" | "published" }
) {
  const id = crypto.randomUUID();
  await d
    .prepare("INSERT INTO gallery_albums (id, name, slug, sort_order, status) VALUES (?, ?, ?, ?, ?)")
    .bind(id, input.name, input.slug, input.sortOrder, input.status)
    .run();
  return d.prepare("SELECT * FROM gallery_albums WHERE id = ?").bind(id).first();
}

export async function albumNames(d: D1Like, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { results } = await d
    .prepare(`SELECT id, name FROM gallery_albums WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<{ id: string; name: string }>();
  return new Map(results.map(r => [r.id, r.name]));
}

// ---- photos ---------------------------------------------------------------

export interface ListPhotosInput {
  page: number;
  pageSize: number;
  search?: string;
  /** album id (uuid) or slug */
  album?: string;
  tag?: string;
  featured?: boolean;
  status?: GalleryStatus;
  sort?: "recent" | "oldest" | "featured" | "admin";
}

const ORDER: Record<NonNullable<ListPhotosInput["sort"]>, string> = {
  admin: "p.sort_order ASC, p.created_at DESC",
  featured: "p.is_featured DESC, p.event_date IS NULL, p.event_date DESC, p.created_at DESC",
  oldest: "p.event_date IS NULL, p.event_date ASC, p.created_at ASC",
  recent: "p.event_date IS NULL, p.event_date DESC, p.created_at DESC",
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);

export async function listPhotos(d: D1Like, input: ListPhotosInput, origin: string) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.status) { where.push("p.status = ?"); params.push(input.status); }
  if (input.album) { where.push("(p.album_id = ? OR a.slug = ?)"); params.push(input.album, input.album); }
  if (typeof input.featured === "boolean") { where.push("p.is_featured = ?"); params.push(input.featured ? 1 : 0); }
  if (input.tag) {
    where.push("EXISTS (SELECT 1 FROM json_each(p.tags) WHERE value = ?)");
    params.push(input.tag);
  }
  if (input.search) {
    const like = `%${escapeLike(input.search)}%`;
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const from = `FROM gallery_photos p LEFT JOIN gallery_albums a ON a.id = p.album_id ${w}`;
  const offset = (input.page - 1) * input.pageSize;

  const [rows, count] = await Promise.all([
    d
      .prepare(
        `SELECT p.*, a.name AS album_name, a.slug AS album_slug ${from}
         ORDER BY ${ORDER[input.sort ?? "admin"]} LIMIT ? OFFSET ?`
      )
      .bind(...params, input.pageSize, offset)
      .all(),
    d.prepare(`SELECT COUNT(*) AS n ${from}`).bind(...params).first<{ n: number }>(),
  ]);
  return { items: rows.results.map(r => mapPhoto(r, origin)), total: count?.n ?? 0 };
}

export async function getPhoto(d: D1Like, id: string, origin: string) {
  const row = await d.prepare(`SELECT ${PHOTO_SELECT} WHERE p.id = ?`).bind(id).first();
  return row ? mapPhoto(row, origin) : null;
}

export interface NewPhoto {
  title?: string | null;
  description?: string | null;
  eventDate: string | null;
  tags: string[];
  albumId?: string | null;
  sortOrder: number;
  isFeatured: boolean;
  status: GalleryStatus;
  storagePath: string;
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
  mimeType: string;
  uploadedBy?: string | null;
  validationEmail?: string | null;
  validationToken?: string | null;
  validated: boolean;
}

export async function insertPhoto(d: D1Like, p: NewPhoto, origin: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const url = mediaUrl(origin, p.storagePath)!;
  // ponytail: no resizing yet, thumb points at the same R2 object. Add Cloudflare Images/resize when needed.
  await d
    .prepare(
      `INSERT INTO gallery_photos
       (id, title, description, event_date, tags, album_id, sort_order, is_featured, status,
        image_original_url, image_thumb_url, storage_path, thumb_storage_path,
        width, height, size_bytes, mime_type, uploaded_by,
        validation_email, validation_token, validation_sent_at, validated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      id, p.title ?? null, p.description ?? null, p.eventDate, JSON.stringify(p.tags), p.albumId ?? null,
      p.sortOrder, p.isFeatured ? 1 : 0, p.status, url, url, p.storagePath, p.storagePath,
      p.width ?? null, p.height ?? null, p.sizeBytes, p.mimeType, p.uploadedBy ?? null,
      p.validationEmail ?? null, p.validationToken ?? null,
      p.validationToken ? now : null, p.validated ? now : null
    )
    .run();
  return getPhoto(d, id, origin);
}

export async function setStatus(d: D1Like, id: string, status: GalleryStatus) {
  await d
    .prepare("UPDATE gallery_photos SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, id)
    .run();
}

export interface PhotoPatch {
  title?: string;
  description?: string;
  eventDate?: string | null;
  tags?: string[];
  albumId?: string | null;
  sortOrder?: number;
  isFeatured?: boolean;
  status?: GalleryStatus;
}

export async function updatePhoto(d: D1Like, id: string, patch: PhotoPatch, origin: string) {
  const cols: Record<string, unknown> = {
    title: patch.title,
    description: patch.description,
    event_date: patch.eventDate,
    tags: patch.tags === undefined ? undefined : JSON.stringify(patch.tags),
    album_id: patch.albumId,
    sort_order: patch.sortOrder,
    is_featured: patch.isFeatured === undefined ? undefined : patch.isFeatured ? 1 : 0,
    status: patch.status,
  };
  const entries = Object.entries(cols).filter(([, v]) => v !== undefined);
  if (entries.length > 0) {
    await d
      .prepare(`UPDATE gallery_photos SET ${entries.map(([k]) => `${k} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...entries.map(([, v]) => v), id)
      .run();
  }
  return getPhoto(d, id, origin);
}

export async function reorderPhotos(d: D1Like, items: { id: string; sortOrder: number }[]) {
  if (items.length === 0) return;
  await d.batch(items.map(i => d.prepare("UPDATE gallery_photos SET sort_order = ? WHERE id = ?").bind(i.sortOrder, i.id)));
}

/** Deletes the row, returns the R2 keys that are no longer referenced. */
export async function deletePhoto(d: D1Like, id: string): Promise<string[] | null> {
  const row = await d
    .prepare("SELECT storage_path, thumb_storage_path, medium_storage_path FROM gallery_photos WHERE id = ?")
    .bind(id)
    .first<{ storage_path: string; thumb_storage_path: string | null; medium_storage_path: string | null }>();
  if (!row) return null;
  await d.prepare("DELETE FROM gallery_photos WHERE id = ?").bind(id).run();
  return [...new Set([row.storage_path, row.thumb_storage_path, row.medium_storage_path].filter((k): k is string => !!k))];
}

// ---- email validation -----------------------------------------------------

export async function photosByToken(d: D1Like, token: string) {
  const { results } = await d
    .prepare("SELECT id, status FROM gallery_photos WHERE validation_token = ?")
    .bind(token)
    .all<{ id: string; status: GalleryStatus }>();
  return results;
}

export async function publishValidated(d: D1Like, ids: string[]) {
  if (ids.length === 0) return;
  await d
    .prepare(
      `UPDATE gallery_photos SET status = 'published', validated_at = ?, validation_token = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${ids.map(() => "?").join(",")})`
    )
    .bind(new Date().toISOString(), ...ids)
    .run();
}

export async function pendingTokenForEmail(d: D1Like, email: string): Promise<string | null> {
  const row = await d
    .prepare(
      "SELECT validation_token FROM gallery_photos WHERE validation_email = ? AND status = 'draft' AND validation_token IS NOT NULL LIMIT 1"
    )
    .bind(email)
    .first<{ validation_token: string }>();
  return row?.validation_token ?? null;
}
