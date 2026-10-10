/**
 * Hub credentials on D1: password (PBKDF2), login rate limits.
 * No HTTP imports: testable with a fake D1. Time is always passed in (nowMs).
 */
import type { D1Like } from "./gallery-d1";
import { HOUR_MS, HubError, createSession, isEligible, iso, randomToken, sha256Hex, upsertMember, type MemberRow, type MemberView } from "./hub-d1";

export const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers WebCrypto rejects more than 100000
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const RESET_TTL_MS = 30 * 60 * 1000;
export const RECOVERY_TTL_MS = 24 * HOUR_MS;
const TOKENS_PER_HOUR = 3;
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

export interface Security { has_password: boolean; recovery_email: string | null; recovery_pending: string | null }

export async function security(d: D1Like, memberId: number, nowMs: number): Promise<Security> {
  const r = await d.prepare("SELECT password_hash, recovery_email FROM hub_credentials WHERE member_id = ?").bind(memberId).first<{ password_hash: string | null; recovery_email: string | null }>();
  const p = await d.prepare(
    "SELECT email FROM hub_account_tokens WHERE member_id = ? AND purpose = 'recovery' AND used_at IS NULL AND expires_at > ? AND email <> COALESCE(?, '') ORDER BY created_at DESC LIMIT 1",
  ).bind(memberId, iso(nowMs), r?.recovery_email ?? null).first<{ email: string }>();
  return { has_password: Boolean(r?.password_hash), recovery_email: r?.recovery_email ?? null, recovery_pending: p?.email ?? null };
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
  await invalidateResetTokens(d, member.id, nowMs);
}

async function invalidateResetTokens(d: D1Like, memberId: number, nowMs: number): Promise<void> {
  await d.prepare("UPDATE hub_account_tokens SET used_at = ? WHERE member_id = ? AND purpose = 'reset' AND used_at IS NULL").bind(iso(nowMs), memberId).run();
}

// ---- account tokens (reset / recovery) --------------------------------------

type Purpose = "reset" | "recovery";

async function createAccountToken(d: D1Like, memberId: number, purpose: Purpose, email: string, nowMs: number): Promise<string> {
  const raw = randomToken();
  await d.prepare("DELETE FROM hub_account_tokens WHERE expires_at < ?").bind(iso(nowMs - 24 * HOUR_MS)).run();
  await d.prepare("INSERT INTO hub_account_tokens (token_hash, member_id, purpose, email, created_at, expires_at) VALUES (?,?,?,?,?,?)")
    .bind(await sha256Hex(raw), memberId, purpose, email, iso(nowMs), iso(nowMs + (purpose === "reset" ? RESET_TTL_MS : RECOVERY_TTL_MS))).run();
  return raw;
}

/** Single-use: one atomic UPDATE ... RETURNING. null when unknown, used or expired. */
async function consumeAccountToken(d: D1Like, raw: string, purpose: Purpose, nowMs: number): Promise<{ member_id: number; email: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(raw)) return null;
  return d.prepare("UPDATE hub_account_tokens SET used_at = ? WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? RETURNING member_id, email")
    .bind(iso(nowMs), await sha256Hex(raw), purpose, iso(nowMs)).first<{ member_id: number; email: string }>();
}

async function tokensSince(d: D1Like, purpose: Purpose, col: "email" | "member_id", val: string | number, nowMs: number): Promise<number> {
  const r = await d.prepare(`SELECT COUNT(*) AS n FROM hub_account_tokens WHERE purpose = ? AND ${col} = ? AND created_at > ?`).bind(purpose, val, iso(nowMs - HOUR_MS)).first<{ n: number }>();
  return r?.n ?? 0;
}

// ---- recovery address -------------------------------------------------------

export async function requestRecovery(d: D1Like, member: MemberRow, email: string, nowMs: number): Promise<string> {
  if (email === member.email) throw new HubError("invalid", "Choisissez une adresse différente de votre email d'inscription");
  if ((await tokensSince(d, "recovery", "member_id", member.id, nowMs)) >= TOKENS_PER_HOUR) throw new HubError("rate_limited", "Trop de demandes, réessayez plus tard");
  return createAccountToken(d, member.id, "recovery", email, nowMs);
}

export async function confirmRecovery(d: D1Like, raw: string, nowMs: number): Promise<{ recovery_email: string; primary_email: string }> {
  const t = await consumeAccountToken(d, raw, "recovery", nowMs);
  if (!t) throw new HubError("invalid", "Lien invalide ou expiré");
  const taken = await d.prepare(
    "SELECT 1 AS ok FROM hub_members WHERE email = ? AND id <> ? UNION ALL SELECT 1 FROM hub_credentials WHERE recovery_email = ? AND member_id <> ? LIMIT 1",
  ).bind(t.email, t.member_id, t.email, t.member_id).first();
  if (taken) throw new HubError("invalid", "Adresse déjà utilisée par un autre compte");
  const owner = await d.prepare("SELECT email FROM hub_members WHERE id = ?").bind(t.member_id).first<{ email: string }>();
  if (!owner) throw new HubError("invalid", "Lien invalide ou expiré");
  await d.prepare("INSERT INTO hub_credentials (member_id, recovery_email, recovery_verified_at, updated_at) VALUES (?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET recovery_email = excluded.recovery_email, recovery_verified_at = excluded.recovery_verified_at, updated_at = excluded.updated_at")
    .bind(t.member_id, t.email, iso(nowMs), iso(nowMs)).run();
  return { recovery_email: t.email, primary_email: owner.email };
}

export async function removeRecovery(d: D1Like, memberId: number, nowMs: number): Promise<void> {
  await d.prepare("UPDATE hub_credentials SET recovery_email = NULL, recovery_verified_at = NULL, updated_at = ? WHERE member_id = ?").bind(iso(nowMs), memberId).run();
  await d.prepare("UPDATE hub_account_tokens SET used_at = ? WHERE member_id = ? AND purpose = 'recovery' AND used_at IS NULL").bind(iso(nowMs), memberId).run();
}

/** Primary email of the active member whose verified recovery address is `email`, else null. */
export async function recoveryOwner(d: D1Like, email: string): Promise<string | null> {
  const r = await d.prepare("SELECT m.email AS email FROM hub_credentials c JOIN hub_members m ON m.id = c.member_id WHERE c.recovery_email = ? AND c.recovery_verified_at IS NOT NULL AND m.status = 'active'")
    .bind(email).first<{ email: string }>();
  return r?.email ?? null;
}

// ---- password reset ---------------------------------------------------------

/** Silent (null) when the address is unknown, ineligible, suspended or over the per-address cap: callers answer the same. */
export async function requestReset(d: D1Like, email: string, nowMs: number): Promise<{ token: string; sendTo: string } | null> {
  let primary = email;
  if (!(await isEligible(d, email))) {
    const owner = await recoveryOwner(d, email);
    if (!owner || !(await isEligible(d, owner))) return null;
    primary = owner;
  }
  const member = await upsertMember(d, primary);
  if (member.status !== "active") return null;
  if ((await tokensSince(d, "reset", "email", email, nowMs)) >= TOKENS_PER_HOUR) return null;
  return { token: await createAccountToken(d, member.id, "reset", email, nowMs), sendTo: email };
}

export async function resetPassword(d: D1Like, raw: string, password: string, nowMs: number): Promise<{ session: string; member: MemberView; email: string }> {
  checkPassword(password); // before consuming: a too-short password must not burn the link
  const t = await consumeAccountToken(d, raw, "reset", nowMs);
  if (!t) throw new HubError("invalid", "Lien invalide ou expiré");
  const member = await d.prepare("SELECT * FROM hub_members WHERE id = ?").bind(t.member_id).first<MemberRow>();
  if (!member) throw new HubError("invalid", "Lien invalide ou expiré");
  if (!(await isEligible(d, member.email))) throw new HubError("forbidden", "Accès réservé aux bénévoles confirmés");
  if (member.status !== "active") throw new HubError("forbidden", "Compte suspendu");
  await storeHash(d, member.id, password, nowMs);
  await revokeSessions(d, member.id, nowMs);
  await invalidateResetTokens(d, member.id, nowMs);
  const s = await createSession(d, member, nowMs);
  return { ...s, email: member.email };
}
