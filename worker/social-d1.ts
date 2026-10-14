/** Friends / follows / favorites. Data layer only; routes live in social.ts. */
import type { D1Like } from "./gallery-d1";
import { HubError, HOUR_MS, iso } from "./hub-d1";

export const SOCIAL_LIMITS = { requestsPerHour: 20, pendingSent: 50, following: 200, page: 50 } as const;
export type Friendship = "none" | "sent" | "received" | "friends";
export interface Relation { friendship: Friendship; following: boolean; favorite: boolean; friends_count: number; followers_count: number }
export interface PersonRow { id: number; display_name: string; avatar_key: string | null; favorite?: boolean }

const VISIBLE = "m.status = 'active' AND EXISTS (SELECT 1 FROM t_volunteers v WHERE lower(v.email) = m.email AND v.status IN ('confirmed','present'))";
const notFound = () => new HubError("not_found", "Membre introuvable");

async function visibleTarget(d: D1Like, meId: number, targetId: number): Promise<void> {
  if (targetId === meId) throw notFound();
  const r = await d.prepare(`SELECT m.id FROM hub_members m WHERE m.id = ? AND ${VISIBLE}`).bind(targetId).first();
  if (!r) throw notFound();
}

async function friendshipRow(d: D1Like, a: number, b: number) {
  return d.prepare("SELECT requester_id, status FROM hub_friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)")
    .bind(a, b, b, a).first<{ requester_id: number; status: "pending" | "accepted" }>();
}

export async function relation(d: D1Like, meId: number, targetId: number): Promise<Relation> {
  await visibleTarget(d, meId, targetId);
  const fr = await friendshipRow(d, meId, targetId);
  const fo = await d.prepare("SELECT favorite FROM hub_follows WHERE follower_id = ? AND followee_id = ?").bind(meId, targetId).first<{ favorite: number }>();
  const fc = await d.prepare("SELECT COUNT(*) AS n FROM hub_friendships WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)").bind(targetId, targetId).first<{ n: number }>();
  const ec = await d.prepare("SELECT COUNT(*) AS n FROM hub_follows WHERE followee_id = ?").bind(targetId).first<{ n: number }>();
  // ponytail: counts include members who became invisible; fine for a social counter
  const friendship: Friendship = !fr ? "none" : fr.status === "accepted" ? "friends" : fr.requester_id === meId ? "sent" : "received";
  return { friendship, following: fo != null, favorite: fo?.favorite === 1, friends_count: fc?.n ?? 0, followers_count: ec?.n ?? 0 };
}

export async function acceptFriend(d: D1Like, meId: number, fromId: number, nowMs: number): Promise<void> {
  await visibleTarget(d, meId, fromId);
  const p = await d.prepare("SELECT 1 AS ok FROM hub_friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'").bind(fromId, meId).first();
  if (!p) throw new HubError("not_found", "Demande introuvable");
  const follow = (a: number, b: number) => d.prepare(
    "INSERT OR IGNORE INTO hub_follows (follower_id, followee_id, created_at) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM hub_friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'accepted')",
  ).bind(a, b, iso(nowMs), fromId, meId);
  await d.batch([
    d.prepare("UPDATE hub_friendships SET status = 'accepted' WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'").bind(fromId, meId),
    follow(meId, fromId),
    follow(fromId, meId),
  ]);
}

export async function requestFriend(d: D1Like, meId: number, targetId: number, nowMs: number): Promise<{ friendship: Friendship }> {
  await visibleTarget(d, meId, targetId);
  const resolveExisting = async (): Promise<{ friendship: Friendship } | null> => {
    const ex = await friendshipRow(d, meId, targetId);
    if (!ex) return null;
    if (ex.status === "accepted") throw new HubError("conflict", "Vous êtes déjà amis");
    if (ex.requester_id === meId) throw new HubError("conflict", "Demande déjà envoyée");
    await acceptFriend(d, meId, targetId, nowMs); // crossed request
    return { friendship: "friends" };
  };
  const done = await resolveExisting();
  if (done) return done;
  const recent = await d.prepare("SELECT COUNT(*) AS n FROM hub_friendships WHERE requester_id = ? AND created_at > ?").bind(meId, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  const pending = await d.prepare("SELECT COUNT(*) AS n FROM hub_friendships WHERE requester_id = ? AND status = 'pending'").bind(meId).first<{ n: number }>();
  // ponytail: cancelled requests don't count toward the hourly cap (request+cancel loop bypasses it; 50-pending cap still applies). Add a tombstone/counter if notifications are added.
  if ((recent?.n ?? 0) >= SOCIAL_LIMITS.requestsPerHour || (pending?.n ?? 0) >= SOCIAL_LIMITS.pendingSent) throw new HubError("rate_limited", "Trop de demandes d'ami, réessayez plus tard");
  try {
    await d.prepare("INSERT INTO hub_friendships (requester_id, addressee_id, created_at) VALUES (?,?,?)").bind(meId, targetId, iso(nowMs)).run();
  } catch (e) {
    // lost a race against the unique pair index: re-read and apply the existing-row rules
    const again = await resolveExisting();
    if (again) return again;
    throw e;
  }
  return { friendship: "sent" };
}

export async function declineFriend(d: D1Like, meId: number, fromId: number): Promise<void> {
  const r = await d.prepare("DELETE FROM hub_friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending' RETURNING 1 AS ok").bind(fromId, meId).first();
  if (!r) throw new HubError("not_found", "Demande introuvable");
}

/** Cancel my pending request or remove a friend (either side). Follows are kept. */
export async function removeFriend(d: D1Like, meId: number, otherId: number): Promise<void> {
  const r = await d.prepare("DELETE FROM hub_friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?) RETURNING 1 AS ok").bind(meId, otherId, otherId, meId).first();
  if (!r) throw new HubError("not_found", "Relation introuvable");
}

export async function follow(d: D1Like, meId: number, targetId: number, nowMs: number): Promise<void> {
  await visibleTarget(d, meId, targetId);
  if (await d.prepare("SELECT 1 AS ok FROM hub_follows WHERE follower_id = ? AND followee_id = ?").bind(meId, targetId).first()) return;
  const n = await d.prepare("SELECT COUNT(*) AS n FROM hub_follows WHERE follower_id = ?").bind(meId).first<{ n: number }>();
  if ((n?.n ?? 0) >= SOCIAL_LIMITS.following) throw new HubError("rate_limited", "Limite d'abonnements atteinte");
  await d.prepare("INSERT OR IGNORE INTO hub_follows (follower_id, followee_id, created_at) VALUES (?,?,?)").bind(meId, targetId, iso(nowMs)).run();
}

export async function unfollow(d: D1Like, meId: number, targetId: number): Promise<void> {
  const fr = await friendshipRow(d, meId, targetId);
  if (fr?.status === "accepted") throw new HubError("conflict", "Retirez d'abord cet ami pour ne plus le suivre");
  await d.prepare("DELETE FROM hub_follows WHERE follower_id = ? AND followee_id = ?").bind(meId, targetId).run();
}

export async function setFavorite(d: D1Like, meId: number, targetId: number, on: boolean): Promise<void> {
  const r = await d.prepare("UPDATE hub_follows SET favorite = ? WHERE follower_id = ? AND followee_id = ? RETURNING 1 AS ok").bind(on ? 1 : 0, meId, targetId).first();
  if (!r) throw new HubError("conflict", "Suivez d'abord ce membre");
}

const page = async (d: D1Like, sql: string, binds: unknown[], limit = SOCIAL_LIMITS.page) => {
  const { results } = await d.prepare(sql).bind(...binds, limit + 1).all<PersonRow & { favorite?: number }>();
  const people = results.slice(0, limit).map(r => ({ id: r.id, display_name: r.display_name, avatar_key: r.avatar_key, ...(r.favorite === undefined ? {} : { favorite: r.favorite === 1 }) }));
  return { people, nextCursor: results.length > limit ? people[people.length - 1].id : null };
};

export function listFriends(d: D1Like, meId: number, cursor: number | null) {
  return page(d,
    `SELECT m.id, m.display_name, m.avatar_key FROM hub_friendships fr
     JOIN hub_members m ON m.id = CASE WHEN fr.requester_id = ? THEN fr.addressee_id ELSE fr.requester_id END
     WHERE fr.status = 'accepted' AND (fr.requester_id = ? OR fr.addressee_id = ?) AND m.id > ? AND ${VISIBLE}
     ORDER BY m.id LIMIT ?`, [meId, meId, meId, cursor ?? 0]);
}

export function listFollowing(d: D1Like, meId: number, cursor: number | null) {
  return page(d,
    `SELECT m.id, m.display_name, m.avatar_key, f.favorite FROM hub_follows f JOIN hub_members m ON m.id = f.followee_id
     WHERE f.follower_id = ? AND m.id > ? AND ${VISIBLE} ORDER BY m.id LIMIT ?`, [meId, cursor ?? 0]);
}

export async function listRequests(d: D1Like, meId: number): Promise<{ received: PersonRow[]; sent: PersonRow[] }> {
  const q = (own: string, other: string) => `SELECT m.id, m.display_name, m.avatar_key FROM hub_friendships fr JOIN hub_members m ON m.id = fr.${other}
    WHERE fr.${own} = ? AND fr.status = 'pending' AND ${VISIBLE} ORDER BY fr.created_at DESC LIMIT ?`;
  const [received, sent] = await Promise.all([
    page(d, q("addressee_id", "requester_id"), [meId]),
    page(d, q("requester_id", "addressee_id"), [meId]),
  ]);
  return { received: received.people, sent: sent.people };
}

export async function pendingCount(d: D1Like, meId: number): Promise<number> {
  const r = await d.prepare(`SELECT COUNT(*) AS n FROM hub_friendships fr JOIN hub_members m ON m.id = fr.requester_id WHERE fr.addressee_id = ? AND fr.status = 'pending' AND ${VISIBLE}`).bind(meId).first<{ n: number }>();
  return r?.n ?? 0;
}
