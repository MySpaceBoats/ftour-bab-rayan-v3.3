/** Password reset on the Worker: the recovery link is built here and mailed through Resend (no dependence on Supabase's own mailer). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, sendEmail } from "./email";

const LANGS = ["fr", "en", "ar", "amz"];

interface ResetEnv { PUBLIC_APP_URL?: string; RESEND_API_KEY?: string; EMAIL_PROVIDER_KEY?: string }

export interface ResetCopy { subject: string; intro: string }
const RESET_COPY: ResetCopy = { subject: "Réinitialisation de votre mot de passe", intro: "Pour choisir un nouveau mot de passe, cliquez sur ce lien :" };

/** Never reveals whether the address has an account: unknown address and mail failure both resolve silently (logged). */
export async function requestPasswordReset(
  supabase: SupabaseClient,
  env: ResetEnv,
  email: string,
  lang: string,
  send: typeof sendEmail = sendEmail,
  copy: ResetCopy = RESET_COPY,
): Promise<void> {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return;
  const base = (env.PUBLIC_APP_URL || "https://www.ftourbabrayan.ma").replace(/\/$/, "");
  const url = `${base}/${LANGS.includes(lang) ? lang : "fr"}/reinitialiser-mot-de-passe?token_hash=${encodeURIComponent(hash)}`;
  try {
    await send({
      to: email,
      subject: copy.subject,
      html: `<p>Bonjour,</p><p>${escapeHtml(copy.intro)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p><p style="color:#64748b;font-size:12px">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
      apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "",
    });
  } catch (err) {
    console.error("[password-reset] mail failed", err);
  }
}

export async function completePasswordReset(supabase: SupabaseClient, tokenHash: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error || !data.user) throw new Error("Lien de réinitialisation invalide ou expiré");
  const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { password: newPassword });
  if (updateError) throw new Error(updateError.message);
}
