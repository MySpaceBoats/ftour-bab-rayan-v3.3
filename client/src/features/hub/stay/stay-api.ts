import { call } from "../api";

export interface StayHost { id: number; display_name: string; avatar: string | null }
export interface StayCard {
  id: number; title: string; kind: string; price_type: string; price: number; city: string; area: string;
  capacity: number; status: "active" | "paused"; available_from: string | null; available_to: string | null;
  created_at: string; host: StayHost; cover: string | null; rating: number | null; review_count: number;
}
export interface StayReview { id: number; request_id: number; rating: number; body: string; created_at: string; author: StayHost }
export interface StayDetail extends Omit<StayCard, "cover"> {
  description: string; rooms: number; amenities: string[]; updated_at: string; media: (string | null)[]; mine: boolean;
  contact: { phone: string; whatsapp: boolean } | null; reviews: StayReview[]; media_keys?: string[];
}
export interface StayForm {
  title: string; description: string; kind: string; city: string; area: string; capacity: number; rooms: number;
  priceType: string; price: number; amenities: string[]; availableFrom: string; availableTo: string;
  phone: string; whatsapp: boolean; media: string[];
}

export type StayRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export interface StayRequestSummary {
  id: number; listing_id: number; listing_title: string; listing_status: string; kind: string; city: string;
  start_date: string; end_date: string; guests: number; status: StayRequestStatus; created_at: string;
  host_reply: string | null; cover: string | null; other: StayHost; unread: number;
}
export interface StayRequestDetail {
  id: number; listing: { id: number; title: string; status: string; kind: string; city: string };
  guest: StayHost; host: StayHost; start_date: string; end_date: string; guests: number; message: string;
  status: StayRequestStatus; host_reply: string | null; created_at: string; updated_at: string; decided_at: string | null;
  role: "guest" | "host"; can_review: boolean; review: { rating: number; body: string; created_at: string } | null; unread: number;
}
export interface StayMessage { id: number; sender_id: number; body: string; created_at: string; read_at: string | null }
export interface StayReport { id: number; target_type: "listing" | "message"; target_id: number; reason: string; created_at: string; reporter: string; body: string | null; target_status: string | null }
export interface AdminStayListing { id: number; title: string; kind: string; price_type: string; price: number; status: string; host: string; created_at: string }

export interface StaySearchQuery {
  cursor?: number | null; kind?: string; city?: string; q?: string; priceType?: string;
  guests?: number; from?: string; to?: string; mine?: boolean;
}

export const listStays = (p: StaySearchQuery) => {
  const qs = new URLSearchParams();
  if (p.cursor) qs.set("cursor", String(p.cursor));
  if (p.kind) qs.set("kind", p.kind);
  if (p.city?.trim()) qs.set("city", p.city.trim());
  if (p.q?.trim()) qs.set("q", p.q.trim());
  if (p.priceType) qs.set("priceType", p.priceType);
  if (p.guests && p.guests > 1) qs.set("guests", String(p.guests));
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  if (p.mine) qs.set("mine", "1");
  const s = qs.toString();
  return call<{ listings: StayCard[]; nextCursor: number | null }>("GET", `stay/listings${s ? `?${s}` : ""}`);
};
export const getStay = (id: number) => call<{ listing: StayDetail }>("GET", `stay/listings/${id}`).then(r => r.listing);
export const createStay = (f: StayForm) => call<{ id: number }>("POST", "stay/listings", { body: f });
export const updateStay = (id: number, f: StayForm) => call<{ ok: true }>("PUT", `stay/listings/${id}`, { body: f });
export const setStayStatus = (id: number, status: "active" | "paused") => call<{ ok: true }>("POST", `stay/listings/${id}/status`, { body: { status } });
export const removeStay = (id: number) => call<{ ok: true }>("DELETE", `stay/listings/${id}`);

export const createStayRequest = (listingId: number, body: { startDate: string; endDate: string; guests: number; message: string }) =>
  call<{ id: number }>("POST", `stay/listings/${listingId}/requests`, { body });

export const listStayRequests = (role: "guest" | "host" | "all") =>
  call<{ requests: StayRequestSummary[] }>("GET", `stay/requests?role=${role}`).then(r => r.requests);
export const getStayRequest = (id: number) => call<{ request: StayRequestDetail }>("GET", `stay/requests/${id}`).then(r => r.request);
export const decideStayRequest = (id: number, action: "accept" | "decline" | "cancel", reply?: string) =>
  call<{ ok: true }>("POST", `stay/requests/${id}/status`, { body: { action, reply } });
export const listStayMessages = (id: number, cursor?: number | null) =>
  call<{ messages: StayMessage[]; nextCursor: number | null; other: StayHost; request: { id: number; status: StayRequestStatus; listing: { id: number; title: string; status: string } } }>(
    "GET",
    `stay/requests/${id}/messages${cursor ? `?cursor=${cursor}` : ""}`,
  );
export const sendStayMessage = (id: number, body: string) => call<{ id: number }>("POST", `stay/requests/${id}/messages`, { body: { body } });
export const markStayRead = (id: number) => call<{ ok: true }>("POST", `stay/requests/${id}/read`);
export const reviewStay = (id: number, rating: number, body: string) => call<{ id: number }>("POST", `stay/requests/${id}/review`, { body: { rating, body } });
export const stayUnread = () => call<{ count: number }>("GET", "stay/unread").then(r => r.count);
export const reportStay = (type: "listing" | "message", id: number, reason: string) => call<{ ok: true }>("POST", "stay/report", { body: { type, id, reason } });

export const adminStayListings = () => call<{ listings: AdminStayListing[] }>("GET", "stay/admin/listings", { admin: true }).then(r => r.listings);
export const adminStayReports = () => call<{ reports: StayReport[] }>("GET", "stay/admin/reports", { admin: true }).then(r => r.reports);
export const adminStayHide = (type: "listing" | "message", id: number) => call<{ ok: true }>("POST", "stay/admin/hide", { admin: true, body: { type, id } });
export const adminStayDismiss = (id: number) => call<{ ok: true }>("POST", `stay/admin/reports/${id}/dismiss`, { admin: true });
