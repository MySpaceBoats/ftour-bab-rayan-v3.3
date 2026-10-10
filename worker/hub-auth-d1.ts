/**
 * Hub credentials on D1: password (PBKDF2), login rate limits.
 * No HTTP imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, createSession, isEligible, iso, sha256Hex, type MemberRow, type MemberView } from "./hub-d1";

export const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers WebCrypto rejects more than 100000
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const AUTH_LIMITS = { emailFailures: 5, emailWindowMs: 15 * 60 * 1000, ipFailures: 20, ipWindowMs: HOUR_MS };

const HASH_RE = /^pbkdf2-sha256\$(\d+)\$([0-9a-f]{32})\$([0-9a-f]{64})$/;
const hex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], h => parseInt(h, 16));

async function derive(pw: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

/** Constant time: no early exit once the lengths match (crypto.subtle.timingSafeEqual is not available in Node tests). */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${hex(salt)}$${hex(await derive(pw, salt, PBKDF2_ITERATIONS))}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const m = HASH_RE.exec(stored ?? "");
  if (!m || typeof pw !== "string" || pw.length === 0 || pw.length > 1024) return false;
  const iterations = Number(m[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
  return equalBytes(await derive(pw, unhex(m[2]), iterations), unhex(m[3]));
}

/** Unknown accounts still pay one derivation so response time does not reveal whether the email exists. */
const DUMMY_HASH = `pbkdf2-sha256$${PBKDF2_ITERATIONS}$00112233445566778899aabbccddeeff$${"ab".repeat(32)}`;

export function checkPassword(raw: unknown): string {
  if (typeof raw !== "string" || raw.length < PASSWORD_MIN || raw.length > PASSWORD_MAX) throw new HubError("invalid", "Mot de passe invalide (8 à 128 caractères)");
  return raw;
}

// ---- rate limit -----------------------------------------------------------

async function tooMany(d: D1Like, key: string, max: number, windowMs: number, nowMs: number): Promise<boolean> {
  const r = await d.prepare("SELECT COUNT(*) AS n FROM hub_auth_attempts WHERE key = ? AND created_at > ?").bind(key, iso(nowMs - windowMs)).first<{ n: number }>();
  return (r?.n ?? 0) >= max;
}

async function recordFailure(d: D1Like, keys: string[], nowMs: number): Promise<void> {
  await d.prepare("DELETE FROM hub_auth_attempts WHERE created_at < ?").bind(iso(nowMs - 24 * HOUR_MS)).run();
  for (const key of keys) await d.prepare("INSERT INTO hub_auth_attempts (key, created_at) VALUES (?,?)").bind(key, iso(nowMs)).run();
}

const RATE_MSG = "Trop de tentatives, réessayez dans 15 minutes";

// ---- password -------------------------------------------------------------

export interface Security { has_password: boolean; recovery_email: string | null }

export async function security(d: D1Like, memberId: number): Promise<Security> {
  const r = await d.prepare("SELECT password_hash, recovery_email FROM hub_credentials WHERE member_id = ?").bind(memberId).first<{ password_hash: string | null; recovery_email: string | null }>();
  return { has_password: Boolean(r?.password_hash), recovery_email: r?.recovery_email ?? null };
}

export async function loginWithPassword(d: D1Like, email: string, password: string, nowMs: number, ip: string | null): Promise<{ session: string; member: MemberView }> {
  const emailKey = `pw:${email}`;
  const ipKey = ip ? `ip:${ip}` : null;
  if ((await tooMany(d, emailKey, AUTH_LIMITS.emailFailures, AUTH_LIMITS.emailWindowMs, nowMs))
    || (ipKey && (await tooMany(d, ipKey, AUTH_LIMITS.ipFailures, AUTH_LIMITS.ipWindowMs, nowMs)))) {
    throw new HubError("rate_limited", RATE_MSG);
  }
  const row = await d.prepare(
    "SELECT m.*, c.password_hash AS password_hash FROM hub_members m LEFT JOIN hub_credentials c ON c.member_id = m.id WHERE m.email = ?",
  ).bind(email).first<MemberRow & { password_hash: string | null }>();
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !row.password_hash || !ok) {
    await recordFailure(d, ipKey ? [emailKey, ipKey] : [emailKey], nowMs);
    throw new HubError("unauthorized", "Email ou mot de passe incorrect");
  }
  if (!(await isEligible(d, row.email))) throw new HubError("forbidden", "Accès réservé aux bénévoles confirmés");
  if (row.status !== "active") throw new HubError("forbidden", "Compte suspendu");
  return createSession(d, row, nowMs);
}

async function revokeSessions(d: D1Like, memberId: number, nowMs: number, keepToken?: string): Promise<void> {
  if (keepToken) {
    await d.prepare("UPDATE hub_sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL AND token_hash <> ?").bind(iso(nowMs), memberId, await sha256Hex(keepToken)).run();
  } else {
    await d.prepare("UPDATE hub_sessions SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL").bind(iso(nowMs), memberId).run();
  }
}

async function storeHash(d: D1Like, memberId: number, password: string, nowMs: number): Promise<void> {
  await d.prepare("INSERT INTO hub_credentials (member_id, password_hash, updated_at) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at")
    .bind(memberId, await hashPassword(password), iso(nowMs)).run();
}

/** Sets or changes the password. Changing requires the current one. Every other session of the member is revoked. */
export async function setPassword(d: D1Like, member: MemberRow, input: { current: string; password: string; keepSessionToken: string }, nowMs: number): Promise<void> {
  const password = checkPassword(input.password);
  const existing = await d.prepare("SELECT password_hash FROM hub_credentials WHERE member_id = ?").bind(member.id).first<{ password_hash: string | null }>();
  if (existing?.password_hash) {
    const key = `pw:${member.email}`;
    if (await tooMany(d, key, AUTH_LIMITS.emailFailures, AUTH_LIMITS.emailWindowMs, nowMs)) throw new HubError("rate_limited", RATE_MSG);
    if (!(await verifyPassword(input.current, existing.password_hash))) {
      await recordFailure(d, [key], nowMs);
      throw new HubError("invalid", "Mot de passe actuel incorrect");
    }
  }
  await storeHash(d, member.id, password, nowMs);
  await revokeSessions(d, member.id, nowMs, input.keepSessionToken);
}
