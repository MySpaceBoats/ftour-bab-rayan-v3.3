/** A volunteer who signs up through the site form also gets a site account (no password yet): they set one from a mailed link. Best effort, never throws. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./email";
import { requestPasswordReset } from "./password-reset";

interface AccountEnv { PUBLIC_APP_URL?: string; RESEND_API_KEY?: string; EMAIL_PROVIDER_KEY?: string }
export interface NewVolunteer { firstName: string; lastName: string; email: string; phone: string }

const WELCOME = {
  subject: "Votre compte Ftour Bab Rayan",
  intro: "Suite à votre inscription comme bénévole, un compte a été créé pour vous sur le site Ftour Bab Rayan. Choisissez votre mot de passe avec ce lien (valable quelques heures, sinon utilisez « Mot de passe oublié » sur la page de connexion). Si vous ne souhaitez pas de compte, ignorez ce message ou écrivez à support@ftourbabrayan.ma :",
};

export async function ensureVolunteerAccount(
  supabase: SupabaseClient,
  env: AccountEnv,
  v: NewVolunteer,
  lang = "fr",
  send: typeof sendEmail = sendEmail,
): Promise<"created" | "exists" | "failed"> {
  try {
    const email = v.email.trim().toLowerCase();
    const name = `${v.firstName} ${v.lastName}`.trim();
    const { data: existing } = await supabase.from("users").select("id").ilike("email", email).maybeSingle();
    if (existing) return "exists";

    const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name, phone: v.phone } });
    if (error || !data.user) return /already|registered|exists/i.test(error?.message ?? "") ? "exists" : "failed";

    const { error: rowError } = await supabase.from("users").insert({ open_id: data.user.id, email, name, phone: v.phone, role: "user" });
    if (rowError) {
      await supabase.auth.admin.deleteUser(data.user.id); // no orphan Auth user without a profile row
      return "failed";
    }
    await requestPasswordReset(supabase, env, email, lang, send, WELCOME);
    return "created";
  } catch (err) {
    console.error("[auto-account] failed", err);
    return "failed";
  }
}
