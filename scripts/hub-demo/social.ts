/**
 * Demo data for friends / follows (hub_friendships, hub_follows), all between fictional members.
 * Requires worker/d1/social.sql to be applied BEFORE seed.sql / cleanup.sql (the tables must exist).
 */
import { ago, mid } from "./common";

const MIN_PER_H = 60;
/** [requester, addressee, hours ago]; accepted friendships also imply two follows (mutual). */
const ACCEPTED: [string, string, number][] = [
  ["yasmine", "salma", 70], ["yasmine", "hajar", 68], ["salma", "hajar", 66], ["karim", "omar", 60],
  ["nadia", "imane", 54], ["mehdi", "reda", 50], ["omar", "reda", 44], ["salma", "nadia", 40], ["imane", "yasmine", 30],
];
const PENDING: [string, string, number][] = [["anas", "salma", 20], ["mehdi", "yasmine", 12], ["karim", "hajar", 6]];
/** [follower, followee, favorite, hours ago]: one-way follows, no friendship. */
const FOLLOWS: [string, string, boolean, number][] = [
  ["anas", "omar", true, 25], ["anas", "nadia", false, 24], ["reda", "salma", true, 22],
  ["imane", "hajar", false, 18], ["karim", "salma", true, 15], ["mehdi", "nadia", false, 10],
];
/** Favorites among the mutual follows implied by friendships: [follower, followee]. */
const FAVORITES = new Set(["yasmine>salma", "hajar>yasmine"]);

const DEMO = (col: string) => `${col} IN (SELECT id FROM hub_members WHERE email LIKE '%@demo.ftour.invalid')`;

/** Also removes rows with REAL members (their requests / follows of demo profiles). */
export function socialCleanup(): string[] {
  return [
    `DELETE FROM hub_follows WHERE ${DEMO("follower_id")} OR ${DEMO("followee_id")};`,
    `DELETE FROM hub_friendships WHERE ${DEMO("requester_id")} OR ${DEMO("addressee_id")};`,
  ];
}

export function socialSeed(): string[] {
  const out: string[] = [];
  const follow = (a: string, b: string, fav: boolean, h: number) =>
    out.push(`INSERT INTO hub_follows (follower_id, followee_id, favorite, created_at) VALUES (${mid(a)}, ${mid(b)}, ${fav ? 1 : 0}, ${ago(h * MIN_PER_H)});`);
  for (const [a, b, h] of ACCEPTED) {
    out.push(`INSERT INTO hub_friendships (requester_id, addressee_id, status, created_at) VALUES (${mid(a)}, ${mid(b)}, 'accepted', ${ago(h * MIN_PER_H)});`);
    follow(a, b, FAVORITES.has(`${a}>${b}`), h);
    follow(b, a, FAVORITES.has(`${b}>${a}`), h);
  }
  for (const [a, b, h] of PENDING) out.push(`INSERT INTO hub_friendships (requester_id, addressee_id, status, created_at) VALUES (${mid(a)}, ${mid(b)}, 'pending', ${ago(h * MIN_PER_H)});`);
  for (const [a, b, fav, h] of FOLLOWS) follow(a, b, fav, h);
  return out;
}
