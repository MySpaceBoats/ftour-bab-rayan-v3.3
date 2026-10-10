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

export interface JobCard { id: number; title: string; company: string; city: string; type: string; status: "open" | "closed"; created_at: string; poster: Person }
export interface JobDetail extends JobCard { description: string; contact: string | null; updated_at: string; mine: boolean }
export interface JobForm { title: string; company: string; city: string; type: string; description: string; contact: string }
export interface AdminJob { id: number; title: string; company: string; status: string; poster: string; created_at: string }

export const listJobs = (p: { cursor?: number | null; type?: string; city?: string; q?: string; mine?: boolean }) => {
  const qs = new URLSearchParams();
  if (p.cursor) qs.set("cursor", String(p.cursor));
  if (p.type) qs.set("type", p.type);
  if (p.city?.trim()) qs.set("city", p.city.trim());
  if (p.q?.trim()) qs.set("q", p.q.trim());
  if (p.mine) qs.set("mine", "1");
  const s = qs.toString();
  return call<{ jobs: JobCard[]; nextCursor: number | null }>("GET", `pro/jobs${s ? `?${s}` : ""}`);
};
export const getJob = (id: number) => call<{ job: JobDetail }>("GET", `pro/jobs/${id}`).then(r => r.job);
export const createJob = (f: JobForm) => call<{ id: number }>("POST", "pro/jobs", { body: f });
export const updateJob = (id: number, f: JobForm) => call<{ ok: true }>("PUT", `pro/jobs/${id}`, { body: f });
export const setJobStatus = (id: number, status: "open" | "closed") => call<{ ok: true }>("POST", `pro/jobs/${id}/status`, { body: { status } });
export const removeJob = (id: number) => call<{ ok: true }>("DELETE", `pro/jobs/${id}`);
export const adminJobs = () => call<{ jobs: AdminJob[] }>("GET", "pro/admin/jobs", { admin: true }).then(r => r.jobs);

export interface Thread { id: number; job_id: number; job_title: string | null; other: Person; last_body: string | null; last_message_at: string; unread: number }
export interface Message { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
export interface Conversation { messages: Message[]; nextCursor: number | null; other: Person; job: { id: number; title: string } | null }

export const openThread = (p: { to: number; jobId?: number }) => call<{ id: number; created: boolean }>("POST", "pro/threads", { body: { to: p.to, ...(p.jobId ? { job_id: p.jobId } : {}) } });
export const listThreads = () => call<{ threads: Thread[] }>("GET", "pro/threads").then(r => r.threads);
export const getMessages = (threadId: number) => call<Conversation>("GET", `pro/threads/${threadId}/messages`);
export const sendMessage = (threadId: number, body: string) => call<{ id: number }>("POST", `pro/threads/${threadId}/messages`, { body: { body } });
export const markRead = (threadId: number) => call<{ ok: true }>("POST", `pro/threads/${threadId}/read`);
export const unreadCount = () => call<{ count: number }>("GET", "pro/unread").then(r => r.count);
