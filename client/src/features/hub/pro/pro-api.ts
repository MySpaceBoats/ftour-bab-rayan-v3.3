import { call } from "../api";

export interface Person { id: number; display_name: string; avatar: string | null; headline?: string }
export interface ProProfile { headline: string; company: string; city: string; skills: string[]; open_to_work: boolean }
export interface ProProfileView extends ProProfile { member: Person; bio: string; mine: boolean }
export interface ProPost { id: number; body: string; link: string | null; created_at: string; author: Person; like_count: number; comment_count: number; liked: boolean; media: (string | null)[] }
export interface ProComment { id: number; post_id: number; body: string; created_at: string; author: Person }
export type ReportType = "post" | "comment" | "job";
export interface ProReport { id: number; target_type: ReportType; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }

export const getProfile = (id: number) => call<{ profile: ProProfileView }>("GET", `pro/profile/${id}`).then(r => r.profile);
export const saveProfile = (p: ProProfile) => call<{ profile: ProProfile }>("PUT", "pro/profile", { body: p }).then(r => r.profile);

export const getFeed = (cursor: number | null) => call<{ posts: ProPost[]; nextCursor: number | null }>("GET", `pro/feed${cursor ? `?cursor=${cursor}` : ""}`);
export const createPost = (b: { body: string; link: string; media: string[] }) => call<{ id: number }>("POST", "pro/posts", { body: b });
export const toggleLike = (id: number) => call<{ liked: boolean; count: number }>("POST", `pro/posts/${id}/like`);
export const getComments = (id: number) => call<{ comments: ProComment[] }>("GET", `pro/posts/${id}/comments`).then(r => r.comments);
export const addComment = (id: number, body: string) => call<{ id: number }>("POST", `pro/posts/${id}/comments`, { body: { body } });
export const removePost = (id: number) => call<{ ok: true }>("DELETE", `pro/posts/${id}`);
export const removeComment = (id: number) => call<{ ok: true }>("DELETE", `pro/comments/${id}`);
export const report = (type: ReportType, id: number, reason: string) => call<{ ok: true }>("POST", "pro/report", { body: { type, id, reason } });

export const adminReports = () => call<{ reports: ProReport[] }>("GET", "pro/admin/reports", { admin: true }).then(r => r.reports);
export const adminHide = (type: ReportType, id: number) => call<{ ok: true }>("POST", "pro/admin/hide", { admin: true, body: { type, id } });
export const adminDismiss = (id: number) => call<{ ok: true }>("POST", `pro/admin/reports/${id}/dismiss`, { admin: true });
