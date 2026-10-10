import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import * as hub from "../api";

const MIN = 8;
const PREF_LABELS: [hub.NotifType, string][] = [
  ["like", "J'aime sur mes publications"],
  ["comment", "Commentaires sur mes publications"],
  ["gallery", "Mes photos proposées à la galerie"],
  ["announcement", "Annonces de l'équipe"],
  ["volunteer", "Inscriptions et rappels bénévole"],
];

export default function AccountSettings() {
  const [sec, setSec] = useState<hub.Security | null>(null);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [recEmail, setRecEmail] = useState("");
  const [recBusy, setRecBusy] = useState(false);
  const [prefs, setPrefs] = useState<hub.NotifPrefs | null>(null);

  useEffect(() => { hub.getNotifPrefs().then(setPrefs).catch(e => toast.error((e as Error).message)); }, []);

  // optimistic toggle, reverted on error
  const togglePref = async (type: hub.NotifType, on: boolean) => {
    setPrefs(p => (p ? { ...p, [type]: on } : p));
    try { setPrefs(await hub.setNotifPrefs({ [type]: on })); }
    catch (err) { setPrefs(p => (p ? { ...p, [type]: !on } : p)); toast.error((err as Error).message); }
  };

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

  const sendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recEmail.trim()) return;
    setRecBusy(true);
    try {
      await hub.requestRecovery(recEmail.trim());
      toast.success("Lien de vérification envoyé. Consultez cette boîte mail.");
      setRecEmail("");
      await refresh();
    } catch (err) { toast.error((err as Error).message); } finally { setRecBusy(false); }
  };

  const removeRecovery = async () => {
    setRecBusy(true);
    try { await hub.removeRecovery(); toast.success("Adresse de récupération retirée"); await refresh(); }
    catch (err) { toast.error((err as Error).message); } finally { setRecBusy(false); }
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
      {sec && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Adresse de récupération</h3>
          <p className="text-sm text-slate-600">Une seconde adresse email, vérifiée par lien, qui sert à réinitialiser votre mot de passe et à vous envoyer un lien de connexion de secours.</p>
          {sec.recovery_email && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <span>Adresse vérifiée : <strong>{sec.recovery_email}</strong></span>
              <Button type="button" variant="outline" size="sm" disabled={recBusy} onClick={removeRecovery}>Retirer</Button>
            </div>
          )}
          {sec.recovery_pending && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">En attente de confirmation : <strong>{sec.recovery_pending}</strong>. Consultez cette boîte mail.</p>
          )}
          <form onSubmit={sendRecovery} className="space-y-2">
            <Input type="email" autoComplete="off" aria-label="Adresse de récupération" placeholder="adresse@exemple.com" value={recEmail} onChange={e => setRecEmail(e.target.value)} required />
            <Button type="submit" variant="outline" disabled={recBusy || !recEmail.trim()}>
              {recBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : "Envoyer le lien de vérification"}
            </Button>
          </form>
        </div>
      )}
      {prefs && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Notifications par email</h3>
          <ul className="space-y-2">
            {PREF_LABELS.map(([type, label]) => (
              <li key={type} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <label htmlFor={`pref-${type}`}>{label}</label>
                <Switch id={`pref-${type}`} checked={prefs[type]} onCheckedChange={on => togglePref(type, on)} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">Les notifications restent toujours visibles dans la cloche de l'espace ; ces réglages ne concernent que les emails.</p>
        </div>
      )}
    </section>
  );
}
