import { getStoredSession } from "@/_core/authSession";

// The static site and the Worker live on different origins: the hub token travels in an Authorization header (no cookie).
const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "/api/trpc";
const ORIGIN = new URL(apiBase, window.location.origin).origin;
const KEY = "hub_session";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const getHubToken = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setHubToken = (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

export class HubApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export interface Member { id: number; display_name: string; bio: string; role: "member" | "moderator"; avatar_key: string | null; avatar?: string | null }
export interface Author { id: number; display_name: string; avatar: string | null }
export interface Post { id: number; body: string; kind: "post" | "announcement"; pinned: boolean; created_at: string; author: Author; like_count: number; comment_count: number; liked: boolean; media: (string | null)[] }
export interface Comment { id: number; post_id: number; body: string; created_at: string; author: Author }
export interface Report { id: number; target_type: "post" | "comment"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminMember { id: number; email: string; display_name: string; role: "member" | "moderator"; status: "active" | "suspended"; created_at: string }

// opts.admin = "use the Supabase site session" (admin pages and the volunteer "Mes photos" tab), not the hub token.
export async function call<T>(method: string, path: string, opts: { body?: unknown; admin?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  // ponytail: admin calls use the stored Supabase access token as-is; tRPC refreshes it on the next admin request
  const token = opts.admin ? getStoredSession()?.accessToken : getHubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${ORIGIN}/hub/${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new HubApiError(0, "network", "Connexion impossible, réessayez.");
  }
  // The site's service worker answers failed GETs with a cached HTML page (200): never treat a non-JSON reply as data.
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
    throw new HubApiError(res.status, "bad_response", "Service indisponible, réessayez dans un instant.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status === 401 && !opts.admin) {
    setHubToken(null);
    window.dispatchEvent(new Event("hub:unauthorized"));
  }
  if (!res.ok) throw new HubApiError(res.status, data.error ?? "error", data.message ?? "Une erreur est survenue.");
  return data as T;
}

export const requestLogin = (email: string) => call<{ ok: true }>("POST", "login", { body: { email } });
export const verifyLogin = (token: string) => call<{ session: string; member: Member }>("POST", "verify", { body: { token } });
export const getMe = () => call<{ member: Member }>("GET", "me").then(r => r.member);
export const updateMe = (b: { display_name?: string; bio?: string; avatar_key?: string | null }) => call<{ member: Member }>("PUT", "me", { body: b }).then(r => r.member);
export const logout = () => call<{ ok: true }>("POST", "logout").finally(() => setHubToken(null));
export const getFeed = (cursor: number | null) => call<{ pinned: Post[]; posts: Post[]; nextCursor: number | null }>("GET", `feed${cursor ? `?cursor=${cursor}` : ""}`);
export const createPost = (body: string, media: string[], site = false) => call<{ id: number }>("POST", site ? "volunteer/posts" : "posts", { body: { body, media }, admin: site });
export const toggleLike = (id: number) => call<{ liked: boolean; count: number }>("POST", `posts/${id}/like`);
export const getComments = (id: number) => call<{ comments: Comment[] }>("GET", `posts/${id}/comments`).then(r => r.comments);
export const addComment = (id: number, body: string) => call<{ id: number }>("POST", `posts/${id}/comments`, { body: { body } });
export const removePost = (id: number) => call<{ ok: true }>("DELETE", `posts/${id}`);
export const removeComment = (id: number) => call<{ ok: true }>("DELETE", `comments/${id}`);
export const report = (type: "post" | "comment", id: number, reason: string) => call<{ ok: true }>("POST", "report", { body: { type, id, reason } });

/** Uploads one image to R2 through a signed URL; returns the bucket-relative path to send with the post. */
export const uploadImage = (file: File): Promise<string> => upload(file, false);
/** Same upload with the Supabase site session (volunteer "Mes photos" tab). */
export const uploadSiteImage = (file: File): Promise<string> => upload(file, true);

async function upload(file: File, site: boolean): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new HubApiError(0, "too_large", "Image trop lourde (8 Mo max).");
  const { path, uploadUrl } = await call<{ path: string; uploadUrl: string }>("POST", site ? "volunteer/media" : "media", { body: { contentType: file.type }, admin: site });
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!res.ok) throw new HubApiError(res.status, "upload", "Envoi de la photo impossible.");
  return path;
}

export type GalleryStatus = "draft" | "published" | "rejected" | null;
export interface Photo { path: string; url: string | null; post_id: number; created_at: string; gallery_status: GalleryStatus }
export const proposePhoto = (path: string) => call<{ gallery_photo_id: string }>("POST", "volunteer/photos/propose", { admin: true, body: { path } });
export const getMyPhotos = () => call<{ photos: Photo[] }>("GET", "volunteer/photos", { admin: true }).then(r => r.photos);

export const adminReports = () => call<{ reports: Report[] }>("GET", "admin/reports", { admin: true }).then(r => r.reports);
export const adminDismiss = (id: number) => call<{ ok: true }>("POST", `admin/reports/${id}/dismiss`, { admin: true });
export const adminHide = (type: "post" | "comment", id: number) => call<{ ok: true }>("POST", "admin/hide", { admin: true, body: { type, id } });
export const adminAnnounce = (body: string, pinned: boolean) => call<{ id: number }>("POST", "admin/posts", { admin: true, body: { body, pinned } });
export const adminMembers = () => call<{ members: AdminMember[] }>("GET", "admin/members", { admin: true }).then(r => r.members);
export const adminUpdateMember = (id: number, b: { status?: "active" | "suspended"; role?: "member" | "moderator" }) => call<{ ok: true }>("PUT", `admin/members/${id}`, { admin: true, body: b });
