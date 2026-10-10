import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Flag, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import { ago, typeLabel } from "../format";

export default function ProJobDetailPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/pro/emplois/:id");
  const jobId = Number(params?.id);
  const pro = `/${lang}/benevole/espace/pro`;
  const [job, setJob] = useState<api.JobDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = () => api.getJob(jobId).then(setJob).catch(() => setJob(null));
  useEffect(() => {
    if (!me) return;
    if (!Number.isSafeInteger(jobId) || jobId <= 0) setJob(null); else load();
  }, [me, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me || job === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (job === null) return <ProLayout me={me} active="jobs"><p className="rounded-xl bg-white p-8 text-center text-slate-600">Offre introuvable. <Link href={`${pro}/emplois`} className="text-blue-700 underline">Voir les offres</Link></p></ProLayout>;

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); after?.(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <ProLayout me={me} active="jobs">
      <Link href={`${pro}/emplois`} className="text-sm text-blue-700 underline">← Toutes les offres</Link>
      <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <header>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
            <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">{typeLabel(job.type)}</span>
          </div>
          <p className="text-slate-700">{job.company}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
            {job.city && <span className="flex items-center gap-1"><MapPin size={14} />{job.city}</span>}
            <span>{ago(job.created_at)}</span>
          </p>
          {job.status === "closed" && <p className="mt-2 rounded bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">Cette offre est fermée.</p>}
        </header>

        <p className="whitespace-pre-wrap break-words text-[15px] text-slate-900">{job.description}</p>
        {job.contact && <p className="text-sm text-slate-700"><strong>Contact :</strong> <span className="break-all">{job.contact}</span></p>}

        <Link href={`${pro}/membre/${job.poster.id}`} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 hover:bg-slate-100">
          <Avatar name={job.poster.display_name} src={job.poster.avatar} size={44} />
          <span className="min-w-0"><span className="block font-semibold text-slate-900">{job.poster.display_name}</span>{job.poster.headline && <span className="block truncate text-xs text-slate-600">{job.poster.headline}</span>}</span>
        </Link>

        <div className="flex flex-wrap gap-2">
          {job.mine ? (
            <>
              <Link href={`${pro}/emplois/${job.id}/modifier`} className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50">Modifier</Link>
              <Button variant="outline" disabled={busy} onClick={() => run(() => api.setJobStatus(job.id, job.status === "open" ? "closed" : "open"), load)}>{job.status === "open" ? "Fermer l'offre" : "Rouvrir l'offre"}</Button>
              <Button variant="destructive" disabled={busy} onClick={() => window.confirm("Supprimer cette offre ?") && run(() => api.removeJob(job.id), () => setLocation(`${pro}/emplois`))}>Supprimer</Button>
            </>
          ) : (
            <>
              {job.status === "open" && (
                <Button className="bg-blue-700 hover:bg-blue-800" disabled={busy}
                  onClick={() => run(async () => { const t = await api.openThread({ to: job.poster.id, jobId: job.id }); setLocation(`${pro}/messages/${t.id}?postuler=1`); })}>Postuler</Button>
              )}
              {/* ponytail: native prompt for the report reason, same as post cards */}
              <Button variant="ghost" size="sm" onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) run(async () => { await api.report("job", job.id, r); toast.success("Merci, signalement envoyé."); }); }}><Flag size={16} className="mr-1.5" />Signaler</Button>
            </>
          )}
        </div>
      </article>
    </ProLayout>
  );
}
