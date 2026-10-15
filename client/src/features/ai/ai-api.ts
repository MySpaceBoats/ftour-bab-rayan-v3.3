import { call } from "../hub/api";

export interface AiMsg { id?: number; role: "user" | "assistant" | "admin"; body: string; created_at?: string }
export type Choice = { source: "pro" | "market" | "stay"; id: number; label: string };
export interface AiCaseRow { id: number; status: "open" | "closed"; summary: string; source: string | null; item_id: number | null; created_at: string; member_name: string }
export interface AiCaseDetail extends AiCaseRow { conversation_id: number; messages: (AiMsg & { id: number })[]; context: string | null }

export const askPublic = (messages: { role: "user" | "assistant"; content: string }[]) =>
  call<{ reply: string }>("POST", "ai/public", { body: { messages } }).then(r => r.reply);

export const choices = () => call<{ items: Choice[] }>("GET", "ai/choices").then(r => r.items);
export const chat = (b: { message: string; conversation_id?: number; source?: Choice["source"]; item_id?: number }) =>
  call<{ conversation_id: number; reply: string | null; escalated: boolean; case_open: boolean }>("POST", "ai/chat", { body: b });
export const conversation = (id: number) =>
  call<{ messages: AiMsg[]; case: { id: number; status: "open" | "closed" } | null; source: Choice["source"] | null; item_id: number | null }>("GET", `ai/conversations/${id}`);
export const escalate = (conversation_id: number) => call<{ case_id: number }>("POST", "ai/escalate", { body: { conversation_id } });

export const adminCases = (status: "open" | "closed") => call<{ cases: AiCaseRow[] }>("GET", `ai/admin/cases?status=${status}`, { admin: true }).then(r => r.cases);
export const adminCase = (id: number) => call<{ case: AiCaseDetail }>("GET", `ai/admin/cases/${id}`, { admin: true }).then(r => r.case);
export const adminReply = (id: number, body: string) => call<{ ok: true }>("POST", `ai/admin/cases/${id}/reply`, { admin: true, body: { body } });
export const adminClose = (id: number) => call<{ ok: true }>("POST", `ai/admin/cases/${id}/close`, { admin: true });
