import { call } from "../api";

export interface Seller { id: number; display_name: string; avatar: string | null }
export interface ListingCard { id: number; title: string; price: number; category: string; condition: string; city: string; status: "active" | "sold"; created_at: string; seller: Seller; cover: string | null }
export interface ListingDetail extends Omit<ListingCard, "cover"> {
  description: string; updated_at: string; media: (string | null)[]; mine: boolean;
  contact: { phone: string; whatsapp: boolean } | null; media_keys?: string[];
}
export interface ListingForm { title: string; description: string; price: number; category: string; condition: string; city: string; phone: string; whatsapp: boolean; media: string[] }
export interface MkComment { id: number; listing_id: number; body: string; created_at: string; author: Seller }
export interface MkReport { id: number; target_type: "listing" | "comment"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminListing { id: number; title: string; price: number; status: string; seller: string; created_at: string }

export const listListings = (p: { cursor?: number | null; category?: string; q?: string; mine?: boolean }) => {
  const qs = new URLSearchParams();
  if (p.cursor) qs.set("cursor", String(p.cursor));
  if (p.category) qs.set("category", p.category);
  if (p.q?.trim()) qs.set("q", p.q.trim());
  if (p.mine) qs.set("mine", "1");
  const s = qs.toString();
  return call<{ listings: ListingCard[]; nextCursor: number | null }>("GET", `market/listings${s ? `?${s}` : ""}`);
};
export const getListing = (id: number) => call<{ listing: ListingDetail }>("GET", `market/listings/${id}`).then(r => r.listing);
export const createListing = (f: ListingForm) => call<{ id: number }>("POST", "market/listings", { body: f });
export const updateListing = (id: number, f: ListingForm) => call<{ ok: true }>("PUT", `market/listings/${id}`, { body: f });
export const setListingStatus = (id: number, status: "active" | "sold") => call<{ ok: true }>("POST", `market/listings/${id}/status`, { body: { status } });
export const removeListing = (id: number) => call<{ ok: true }>("DELETE", `market/listings/${id}`);
export const listComments = (id: number) => call<{ comments: MkComment[] }>("GET", `market/listings/${id}/comments`).then(r => r.comments);
export const addListingComment = (id: number, body: string) => call<{ id: number }>("POST", `market/listings/${id}/comments`, { body: { body } });
export const removeListingComment = (id: number) => call<{ ok: true }>("DELETE", `market/comments/${id}`);
export const reportMarket = (type: "listing" | "comment", id: number, reason: string) => call<{ ok: true }>("POST", "market/report", { body: { type, id, reason } });

export const adminListings = () => call<{ listings: AdminListing[] }>("GET", "market/admin/listings", { admin: true }).then(r => r.listings);
export const adminMarketReports = () => call<{ reports: MkReport[] }>("GET", "market/admin/reports", { admin: true }).then(r => r.reports);
export const adminMarketHide = (type: "listing" | "comment", id: number) => call<{ ok: true }>("POST", "market/admin/hide", { admin: true, body: { type, id } });
export const adminMarketDismiss = (id: number) => call<{ ok: true }>("POST", `market/admin/reports/${id}/dismiss`, { admin: true });

export interface Thread { id: number; listing_id: number; listing_title: string; listing_status: string; cover: string | null; other: Seller; last_body: string | null; last_message_at: string; unread: number }
export interface Message { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }

export const openThread = (listingId: number) => call<{ id: number; created: boolean }>("POST", `market/listings/${listingId}/thread`);
export const listThreads = () => call<{ threads: Thread[] }>("GET", "market/threads").then(r => r.threads);
export const listMessages = (threadId: number, cursor?: number | null) =>
  call<{ messages: Message[]; nextCursor: number | null; other: Seller; listing: { id: number; title: string; status: string } }>("GET", `market/threads/${threadId}/messages${cursor ? `?cursor=${cursor}` : ""}`);
export const sendMessage = (threadId: number, body: string) => call<{ id: number }>("POST", `market/threads/${threadId}/messages`, { body: { body } });
export const markRead = (threadId: number) => call<{ ok: true }>("POST", `market/threads/${threadId}/read`);
export const unreadCount = () => call<{ count: number }>("GET", "market/unread").then(r => r.count);
