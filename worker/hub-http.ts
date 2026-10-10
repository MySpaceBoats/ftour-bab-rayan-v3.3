import * as H from "./hub-d1";

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const b = await request.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    throw new H.HubError("invalid", "JSON invalide");
  }
}
export const num = (v: unknown) => {
  if (typeof v !== "string" && typeof v !== "number") return NaN;
  const n = /^\d+$/.test(String(v)) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : NaN;
};
export const id = (v: unknown) => {
  const n = num(v);
  if (Number.isNaN(n)) throw new H.HubError("invalid", "Identifiant invalide");
  return n;
};
export const str = (v: unknown) => {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new H.HubError("invalid", "Champ texte invalide");
  return v;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Required email field: trimmed, lowercased, validated. */
export const emailField = (v: unknown): string => {
  const e = str(v).trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 320) throw new H.HubError("invalid", "Email invalide");
  return e;
};
/** Public site origin used in mail links (no trailing slash). */
export const appBaseUrl = (env: { PUBLIC_APP_URL?: string }): string =>
  (env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma").replace(/\/$/, "");
