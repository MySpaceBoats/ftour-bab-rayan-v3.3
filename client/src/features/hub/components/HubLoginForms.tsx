import { useState } from "react";
import { Loader2 } from "lucide-react";
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
    </form>
  );
}
