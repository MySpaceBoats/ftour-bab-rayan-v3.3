import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as hub from "../api";

export interface SessionResult { session: string; member: hub.Member; email: string }

/** Email + password login (the magic link stays available in the other tab). */
export function PasswordTab({ initialEmail, onSession }: { initialEmail: string; onSession: (r: SessionResult) => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await hub.forgotPassword(email.trim());
      setForgotSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const r = await hub.loginWithPassword(email.trim(), password);
      onSession({ ...r, email: email.trim() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (forgot) {
    return (
      <form onSubmit={submitForgot} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="hub-forgot-email" className="text-sm font-medium text-slate-700">Votre email d'inscription ou de récupération</label>
          <Input id="hub-forgot-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        {forgotSent && (
          <div role="status" className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
            <MailCheck size={20} className="mt-0.5 shrink-0" aria-hidden />
            <span>Si cette adresse correspond à un compte bénévole (email d'inscription ou adresse de récupération vérifiée), un lien de réinitialisation valable 30 minutes vient d'être envoyé.</span>
          </div>
        )}
        <Button type="submit" className="h-11 w-full bg-blue-700 hover:bg-blue-800" disabled={busy || !email.trim()}>
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : forgotSent ? "Renvoyer le lien" : "Envoyer le lien de réinitialisation"}
        </Button>
        <button type="button" className="block w-full text-center text-xs text-blue-700 underline" onClick={() => { setForgot(false); setForgotSent(false); setError(null); }}>Retour</button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="hub-pw-email" className="text-sm font-medium text-slate-700">Votre email d'inscription</label>
        <Input id="hub-pw-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="hub-pw" className="text-sm font-medium text-slate-700">Mot de passe</label>
        <Input id="hub-pw" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="h-11" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <Button type="submit" className="h-11 w-full bg-blue-700 hover:bg-blue-800" disabled={busy || !email.trim() || !password}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : "Se connecter"}
      </Button>
      <button type="button" className="block w-full text-center text-xs text-blue-700 underline" onClick={() => { setForgot(true); setError(null); }}>Mot de passe oublié ?</button>
    </form>
  );
}

/** Set a new password from the emailed reset link; success opens a session. */
export function ResetPasswordForm({ token, onSession, onCancel }: { token: string; onSession: (r: SessionResult) => void; onCancel: () => void }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pw.length < 8) return setError("Le mot de passe doit faire au moins 8 caractères.");
    if (pw !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    setError(null);
    try {
      const r = await hub.resetPassword(token, pw);
      onSession({ ...r, email: "" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">Nouveau mot de passe</h2>
      <div className="space-y-1.5">
        <label htmlFor="hub-new-pw" className="text-sm font-medium text-slate-700">Nouveau mot de passe</label>
        <Input id="hub-new-pw" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="hub-new-pw2" className="text-sm font-medium text-slate-700">Confirmer</label>
        <Input id="hub-new-pw2" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="h-11" />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <Button type="submit" className="h-11 w-full bg-blue-700 hover:bg-blue-800" disabled={busy || !pw || !confirm}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : "Enregistrer et me connecter"}
      </Button>
      <button type="button" className="block w-full text-center text-xs text-blue-700 underline" onClick={onCancel}>Annuler</button>
    </form>
  );
}
