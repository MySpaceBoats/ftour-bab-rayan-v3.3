/**
 * Object storage on Cloudflare R2, replacing Supabase Storage.
 *  - createR2Storage(): supabase-js `storage.from(bucket)` compatible facade (upload, getPublicUrl,
 *    createSignedUrl, createSignedUploadUrl, remove) so existing call sites keep working.
 *  - handleMediaRequest(): GET /media/<key> (public), GET /media-signed/<key> (HMAC, expiring),
 *    PUT /media-upload/<key> (HMAC, expiring, images only).
 * R2 key = path for bucket "images" (the gallery already lives there), "<bucket>/<path>" for other public
 * buckets, "private/<bucket>/<path>" for everything else (never served by /media).
 */
import type { R2Like } from "./gallery-d1";

export const PUBLIC_BUCKETS = new Set(["images", "manager-candidates", "product-images", "Formulaire", "RIB", "Images siteweb"]);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// www.ftourbabrayan.ma is a different deployment (static site): media must be served from the Worker itself.
export const DEFAULT_MEDIA_BASE = "https://ftour-bab-rayan-v2.reda-sebbani-43b.workers.dev";

export function objectKey(bucket: string, path: string): string {
  const p = path.replace(/^\/+/, "");
  if (p.includes("..")) throw new Error("Invalid path");
  if (bucket === "images") return p;
  return PUBLIC_BUCKETS.has(bucket) ? `${bucket}/${p}` : `private/${bucket}/${p}`;
}

const encKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

async function hmacHex(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export type Purpose = "get" | "put";
export const signMedia = (secret: string, purpose: Purpose, key: string, exp: number) => hmacHex(secret, `${purpose}:${key}:${exp}`);

export async function verifyMedia(secret: string, purpose: Purpose, key: string, exp: number, sig: string, now = Date.now()): Promise<boolean> {
  if (!secret || !Number.isFinite(exp) || exp * 1000 < now) return false;
  const good = await signMedia(secret, purpose, key, exp);
  if (good.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < good.length; i++) diff |= good.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export interface MediaEnv { GALLERY_MEDIA?: R2Like; JWT_SECRET?: string; MEDIA_BASE_URL?: string }
const originOf = (env: MediaEnv) => (env.MEDIA_BASE_URL || DEFAULT_MEDIA_BASE).replace(/\/$/, "");

async function toBytes(body: unknown): Promise<ArrayBuffer | Uint8Array> {
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) return body;
  if (body && typeof (body as Blob).arrayBuffer === "function") return (body as Blob).arrayBuffer();
  throw new Error("Unsupported upload body");
}

type Err = { message: string; statusCode?: string };
const fail = (message: string, statusCode = "500") => ({ data: null, error: { message, statusCode } as Err });

/** supabase-js `supabase.storage` look-alike backed by R2. */
export function createR2Storage(env: MediaEnv, now: () => number = Date.now) {
  const bucketApi = (bucket: string) => ({
    async upload(path: string, body: unknown, opts?: { contentType?: string; upsert?: boolean }) {
      if (!env.GALLERY_MEDIA) return fail("R2 binding GALLERY_MEDIA is not configured");
      try {
        await env.GALLERY_MEDIA.put(objectKey(bucket, path), await toBytes(body), { httpMetadata: { contentType: opts?.contentType } });
        return { data: { path, id: path, fullPath: `${bucket}/${path}` }, error: null };
      } catch (e) { return fail((e as Error).message); }
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: `${originOf(env)}/media/${encKey(objectKey(bucket, path))}` } };
    },
    async createSignedUrl(path: string, expiresIn: number) {
      if (!env.JWT_SECRET) return fail("JWT_SECRET missing: cannot sign media URLs");
      const key = objectKey(bucket, path);
      const exp = Math.floor(now() / 1000) + expiresIn;
      const sig = await signMedia(env.JWT_SECRET, "get", key, exp);
      return { data: { signedUrl: `${originOf(env)}/media-signed/${encKey(key)}?exp=${exp}&sig=${sig}` }, error: null };
    },
    async createSignedUploadUrl(path: string) {
      if (!env.JWT_SECRET) return fail("JWT_SECRET missing: cannot sign media URLs");
      const key = objectKey(bucket, path);
      const exp = Math.floor(now() / 1000) + 2 * 60 * 60;
      const sig = await signMedia(env.JWT_SECRET, "put", key, exp);
      return { data: { signedUrl: `${originOf(env)}/media-upload/${encKey(key)}?exp=${exp}&sig=${sig}`, token: sig, path }, error: null };
    },
    async remove(paths: string[]) {
      if (!env.GALLERY_MEDIA) return fail("R2 binding GALLERY_MEDIA is not configured");
      await env.GALLERY_MEDIA.delete(paths.map(p => objectKey(bucket, p)));
      return { data: paths.map(p => ({ name: p })), error: null };
    },
  });
  return { from: bucketApi };
}

const cacheFor = (key: string) =>
  /(^|\/)\d{10,}-/.test(key) ? "public, max-age=31536000, immutable" : "public, max-age=3600";

/** Returns a Response for media routes, or null when the request is not a media route. */
export async function handleMediaRequest(request: Request, env: MediaEnv, cors: Record<string, string>, now = Date.now()): Promise<Response | null> {
  const url = new URL(request.url);
  const route = ["/media/", "/media-signed/", "/media-upload/"].find(p => url.pathname.startsWith(p));
  if (!route) return null;
  const notFound = () => new Response("Not found", { status: 404, headers: cors });
  let key: string;
  try { key = decodeURIComponent(url.pathname.slice(route.length)); } catch { return notFound(); }
  if (!env.GALLERY_MEDIA || !key || key.includes("..")) return notFound();
  const secret = env.JWT_SECRET ?? "";

  if (route === "/media/" && (request.method === "GET" || request.method === "HEAD")) {
    if (key.startsWith("private/")) return notFound();
    const obj = await env.GALLERY_MEDIA.get(key);
    if (!obj) return notFound();
    const headers: Record<string, string> = {
      ...cors,
      "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": cacheFor(key),
      ETag: obj.httpEtag,
    };
    const dl = url.searchParams.get("download");
    if (dl) headers["Content-Disposition"] = `attachment; filename="${dl.replace(/[^\w.\- ]/g, "_")}"`;
    return new Response(request.method === "HEAD" ? null : obj.body, { headers });
  }

  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";

  if (route === "/media-signed/" && request.method === "GET") {
    if (!(await verifyMedia(secret, "get", key, exp, sig, now))) return new Response("Forbidden", { status: 403, headers: cors });
    const obj = await env.GALLERY_MEDIA.get(key);
    if (!obj) return notFound();
    return new Response(obj.body, {
      headers: { ...cors, "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, no-store", ETag: obj.httpEtag },
    });
  }

  if (route === "/media-upload/" && request.method === "PUT") {
    if (!(await verifyMedia(secret, "put", key, exp, sig, now))) return new Response("Forbidden", { status: 403, headers: cors });
    const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!UPLOAD_TYPES.has(type)) return new Response("Unsupported media type", { status: 415, headers: cors });
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES) return new Response("Payload too large", { status: 413, headers: cors });
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) return new Response("Invalid size", { status: 413, headers: cors });
    await env.GALLERY_MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
    return new Response(JSON.stringify({ Key: key }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response("Method not allowed", { status: 405, headers: cors });
}
