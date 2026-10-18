import { call } from "../api";

export interface SalonPerson { id: number; display_name: string; avatar: string | null }
export type SalonStatus = "active" | "archived" | "hidden";
export interface SalonCard {
  id: number; title: string; topic: string; status: SalonStatus; post_count: number;
  last_post_at: string | null; created_at: string; mine: boolean; creator: SalonPerson;
}
export interface SalonDetail extends SalonCard { room: string }
export interface SalonPost { id: number; body: string; created_at: string; mine: boolean; author: SalonPerson }

const qs = (cursor?: string | null) => (cursor ? `?cursor=${encodeURIComponent(cursor)}` : "");

export const listSalons = (cursor?: string | null) => call<{ salons: SalonCard[]; nextCursor: string | null }>("GET", `salon/salons${qs(cursor)}`);
export const getSalon = (id: number) => call<{ salon: SalonDetail }>("GET", `salon/salons/${id}`).then(r => r.salon);
export const createSalon = (form: { title: string; topic: string }) => call<{ id: number }>("POST", "salon/salons", { body: form });
export const archiveSalon = (id: number) => call<{ ok: true }>("POST", `salon/salons/${id}/archive`);
export const listPosts = (salonId: number, cursor?: string | null) => call<{ posts: SalonPost[]; nextCursor: string | null }>("GET", `salon/salons/${salonId}/posts${qs(cursor)}`);
export const createPost = (salonId: number, body: string) => call<{ id: number }>("POST", `salon/salons/${salonId}/posts`, { body: { body } });
export const deletePost = (salonId: number, postId: number) => call<{ ok: true }>("DELETE", `salon/salons/${salonId}/posts/${postId}`);
