/** Activity notifications to the support inbox (new member, order, donation, ...). Best effort: never throws, never blocks the visitor's action. */
import { escapeHtml, sendEmail } from "./email";

export const SUPPORT_NOTIFY_DEFAULT = "support@ftourbabrayan.ma";

export interface SupportEvent { kind: string; title: string; lines: [label: string, value: string | number | null | undefined][] }
interface SupportEnv { RESEND_API_KEY?: string; EMAIL_PROVIDER_KEY?: string; SUPPORT_NOTIFY_EMAIL?: string }

export function renderSupport(e: SupportEvent): { subject: string; html: string } {
  const rows = e.lines
    .filter(([, v]) => v !== null && v !== undefined && String(v) !== "")
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#64748b">${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`)
    .join("");
  const when = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" });
  return {
    subject: `[Ftour] ${e.title}`,
    html: `<p><strong>${escapeHtml(e.title)}</strong></p><table>${rows}</table><p style="color:#94a3b8;font-size:12px">${escapeHtml(when)} · ${escapeHtml(e.kind)}</p>`,
  };
}

export async function notifySupport(env: SupportEnv, e: SupportEvent, send: typeof sendEmail = sendEmail): Promise<void> {
  try {
    await send({
      to: env.SUPPORT_NOTIFY_EMAIL || SUPPORT_NOTIFY_DEFAULT,
      ...renderSupport(e),
      apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "",
    });
  } catch (err) {
    console.error("[support-notify] failed", e.kind, err);
  }
}
