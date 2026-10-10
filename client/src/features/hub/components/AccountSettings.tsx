import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as hub from "../api";

const MIN = 8;

export default function AccountSettings() {
  const [sec, setSec] = useState<hub.Security | null>(null);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => hub.getSecurity().then(setSec).catch(e => toast.error((e as Error).message)), []);
  useEffect(() => { refresh(); }, [refresh]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < MIN) return toast.error("Le mot de passe doit faire au moins 8 caractères.");
    if (pw !== confirm) return toast.error("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      await hub.setPassword(pw, sec?.has_password ? current : undefined);
      toast.success("Mot de passe enregistré. Vos autres sessions ont été déconnectées.");
      setCurrent(""); setPw(""); setConfirm("");
      await refresh();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Sécurité du compte">
      <h2 className="font-semibold text-slate-900">Sécurité du compte</h2>
      {!sec ? (
        <Loader2 className="animate-spin text-blue-700" aria-label="Chargement" />
      ) : (
        <form onSubmit={submitPassword} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Mot de passe</h3>
          {!sec.has_password && <p className="text-sm text-slate-600">Définissez un mot de passe pour vous connecter sans attendre le lien par email.</p>}
          {sec.has_password && (
            <Input type="password" autoComplete="current-password" aria-label="Mot de passe actuel" placeholder="Mot de passe actuel" value={current} onChange={e => setCurrent(e.target.value)} required />
          )}
          <Input type="password" autoComplete="new-password" aria-label="Nouveau mot de passe" placeholder="Nouveau mot de passe" minLength={MIN} maxLength={128} value={pw} onChange={e => setPw(e.target.value)} required />
          <Input type="password" autoComplete="new-password" aria-label="Confirmer" placeholder="Confirmer" minLength={MIN} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={busy || !pw || !confirm}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : sec.has_password ? "Changer le mot de passe" : "Définir le mot de passe"}
          </Button>
        </form>
      )}
    </section>
  );
}
