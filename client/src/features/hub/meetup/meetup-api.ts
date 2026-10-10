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
export interface MeetupForm {
  title: string; category: MeetupCategory; description: string; country: string; city: string; place: string;
  startsAt: string; endsAt: string; capacity: number; photo: string | null;
}

export const listMeetups = (cursor?: string | null) =>
  call<{ meetups: MeetupCard[]; nextCursor: string | null }>("GET", `meetup/meetups${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
export const createMeetup = (form: MeetupForm) => call<{ id: number }>("POST", "meetup/meetups", { body: form });
