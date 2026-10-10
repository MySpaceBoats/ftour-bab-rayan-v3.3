import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";

export default function ProProfilePage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [f, setF] = useState<{ headline: string; company: string; city: string; skills: string; open: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    api.getProfile(me.id).then(p => setF({ headline: p.headline, company: p.company, city: p.city, skills: p.skills.join(", "), open: p.open_to_work }))
      .catch(e => { toast.error((e as Error).message); setF({ headline: "", company: "", city: "", skills: "", open: false }); });
  }, [me]);

  if (!me || !f) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      await api.saveProfile({ headline: f.headline, company: f.company, city: f.city, skills: f.skills.split(",").map(s => s.trim()).filter(Boolean), open_to_work: f.open });
      toast.success("Profil pro enregistré");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <ProLayout me={me} active={null}>
      <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <h1 className="text-xl font-bold text-slate-900">Mon profil pro</h1>
        <Input aria-label="Titre professionnel" value={f.headline} maxLength={80} onChange={e => set("headline", e.target.value)} placeholder="Ex. Développeuse web, Casablanca" />
        <Input aria-label="Entreprise" value={f.company} maxLength={80} onChange={e => set("company", e.target.value)} placeholder="Entreprise" />
        <Input aria-label="Ville" value={f.city} maxLength={60} onChange={e => set("city", e.target.value)} placeholder="Ville" />
        <Input aria-label="Compétences" value={f.skills} onChange={e => set("skills", e.target.value)} placeholder="Compétences, séparées par des virgules (8 max)" />
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.open} onChange={e => set("open", e.target.checked)} /> Ouvert(e) aux opportunités</label>
        <div className="flex items-center gap-3">
          <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={busy}>Enregistrer</Button>
          <Link href={`/${lang}/benevole/espace/pro/membre/${me.id}`} className="text-sm text-blue-700 underline">Voir ma fiche</Link>
        </div>
      </form>
    </ProLayout>
  );
}
