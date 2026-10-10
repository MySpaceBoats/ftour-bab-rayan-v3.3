import { call } from "../api";

export interface MeetupOrganizer { id: number; display_name: string; avatar: string | null }
export type MeetupCategory = "sortie" | "evenement" | "rencontre" | "autre";
export type MeetupStatus = "active" | "cancelled" | "hidden";
export type MyStatus = "going" | "waitlist" | null;
export interface MeetupCard {
  id: number; title: string; category: MeetupCategory; country: string; city: string; place: string;
  starts_at: string; ends_at: string; capacity: number; going_count: number; waitlist_count: number;
  status: MeetupStatus; ended: boolean; my_status: MyStatus; photo: string | null; organizer: MeetupOrganizer;
}
export interface MeetupDetail extends MeetupCard {
  description: string; spots_left: number; mine: boolean;
  participants: MeetupOrganizer[]; waitlist: MeetupOrganizer[];
  photo_key?: string | null; // organizer only, resent unchanged by the edit form
}
export interface MeetupForm {
  title: string; category: MeetupCategory; description: string; country: string; city: string; place: string;
  startsAt: string; endsAt: string; capacity: number; photo: string | null;
}
export interface MeetupFilters { country?: string; city?: string; category?: string; from?: string; to?: string }
export interface MeetupPlaces { countries: { country: string; cities: string[] }[] }
export interface AdminMeetup {
  id: number; title: string; category: string; country: string; city: string; starts_at: string;
  capacity: number; status: MeetupStatus; organizer: string; going_count: number; waitlist_count: number;
}

export const listMeetups = (cursor?: string | null, f: MeetupFilters = {}) => {
  const qs = new URLSearchParams();
  if (cursor) qs.set("cursor", cursor);
  if (f.country) qs.set("country", f.country);
  if (f.city) qs.set("city", f.city);
  if (f.category) qs.set("category", f.category);
  if (f.from) qs.set("from", f.from);
  if (f.to) qs.set("to", f.to);
  const s = qs.toString();
  return call<{ meetups: MeetupCard[]; nextCursor: string | null }>("GET", `meetup/meetups${s ? `?${s}` : ""}`);
};
export const meetupPlaces = () => call<MeetupPlaces>("GET", "meetup/places");
export const getMeetup = (id: number) => call<{ meetup: MeetupDetail }>("GET", `meetup/meetups/${id}`).then(r => r.meetup);
export const createMeetup = (form: MeetupForm) => call<{ id: number }>("POST", "meetup/meetups", { body: form });
export const updateMeetup = (id: number, form: MeetupForm) => call<{ ok: true }>("PUT", `meetup/meetups/${id}`, { body: form });
export const cancelMeetup = (id: number) => call<{ ok: true }>("POST", `meetup/meetups/${id}/cancel`);
export const joinMeetup = (id: number) => call<{ status: "going" | "waitlist" }>("POST", `meetup/meetups/${id}/join`);
export const leaveMeetup = (id: number) => call<{ ok: true }>("POST", `meetup/meetups/${id}/leave`);
export const myMeetups = (role: "organized" | "joined") => call<{ meetups: MeetupCard[] }>("GET", `meetup/mine?role=${role}`).then(r => r.meetups);

export const adminMeetups = () => call<{ meetups: AdminMeetup[] }>("GET", "meetup/admin/meetups", { admin: true }).then(r => r.meetups);
export const adminHideMeetup = (id: number) => call<{ ok: true }>("POST", "meetup/admin/hide", { admin: true, body: { id } });
export const adminDeleteMeetup = (id: number) => call<{ ok: true }>("POST", "meetup/admin/delete", { admin: true, body: { id } });
