import { call } from "../api";

export type FeedScope = "all" | "friends" | "following" | "favorites";
export type Friendship = "none" | "sent" | "received" | "friends";
export interface Relation { friendship: Friendship; following: boolean; favorite: boolean; friends_count: number; followers_count: number }
export interface Person { id: number; display_name: string; avatar: string | null; favorite?: boolean }

const post = (path: string, body: unknown) => call<unknown>("POST", `social/${path}`, { body });
export const getRelation = (id: number) => call<Relation>("GET", `social/relation/${id}`);
export const requestFriend = (id: number) => post("friend/request", { id });
export const acceptFriend = (id: number) => post("friend/accept", { id });
export const declineFriend = (id: number) => post("friend/decline", { id });
export const removeFriend = (id: number) => call<unknown>("DELETE", `social/friend/${id}`);
export const follow = (id: number) => post("follow", { id });
export const unfollow = (id: number) => call<unknown>("DELETE", `social/follow/${id}`);
export const setFavorite = (id: number, on: boolean) => post("favorite", { id, on });
const q = (cursor?: number | null) => (cursor ? `?cursor=${cursor}` : "");
export const getFriends = (cursor?: number | null) => call<{ people: Person[]; nextCursor: number | null }>("GET", `social/friends${q(cursor)}`);
export const getFollowing = (cursor?: number | null) => call<{ people: Person[]; nextCursor: number | null }>("GET", `social/following${q(cursor)}`);
export const getRequests = () => call<{ received: Person[]; sent: Person[] }>("GET", "social/requests");
