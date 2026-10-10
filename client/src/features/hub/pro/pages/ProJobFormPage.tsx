import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import { JOB_TYPES } from "../format";

const EMPTY: api.JobForm = { title: "", company: "", city: "", type: "cdi", description: "", contact: "" };

export default function ProJobFormPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/pro/emplois/:id/modifier");
  const editId = params?.id ? Number(params.id) : null;
  const pro = `/${lang}/benevole/espace/pro`;
  const [f, setF] = useState<api.JobForm | null>(editId ? null : EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me || !editId) return;
    api.getJob(editId).then(j => {
      if (!j.mine) return setLocation(`${pro}/emplois/${j.id}`);
      setF({ title: j.title, company: j.company, city: j.city, type: j.type, description: j.description, contact: j.contact ?? "" });
    }).catch(() => setLocation(`${pro}/emplois`));
  }, [me, editId, pro, setLocation]);

  if (!me || !f) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  const set = (k: keyof api.JobForm, v: string) => setF({ ...f, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const id = editId ?? (await api.createJob(f)).id;
      if (editId) await api.updateJob(editId, f);
      setLocation(`${pro}/emplois/${id}`);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <ProLayout me={me} active="jobs">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{editId ? "Modifier l'offre" : "Publier une offre"}</h1>
        <Input aria-label="Intitulé du poste" required maxLength={80} value={f.title} onChange={e => set("title", e.target.value)} placeholder="Intitulé du poste" />
        <Input aria-label="Entreprise" required maxLength={80} value={f.company} onChange={e => set("company", e.target.value)} placeholder="Entreprise" />
        <div className="flex gap-2">
          <Input aria-label="Ville" maxLength={60} value={f.city} onChange={e => set("city", e.target.value)} placeholder="Ville" />
          <select aria-label="Type de contrat" className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={f.type} onChange={e => set("type", e.target.value)}>
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <Textarea aria-label="Description" required rows={8} maxLength={3000} value={f.description} onChange={e => set("description", e.target.value)} placeholder="Missions, profil recherché, conditions…" />
        <Input aria-label="Contact" maxLength={120} value={f.contact} onChange={e => set("contact", e.target.value)} placeholder="Contact (email, téléphone) — facultatif" />
        <p className="text-xs text-slate-500">Les candidats pourront aussi vous écrire en messagerie.</p>
        <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={busy || !f.title.trim() || !f.company.trim() || !f.description.trim()}>{editId ? "Enregistrer" : "Publier"}</Button>
      </form>
    </ProLayout>
  );
}
