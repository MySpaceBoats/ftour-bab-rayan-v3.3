import { useCallback, useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { CalendarDays, Loader2, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { ErrorPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import { HubApiError } from "../../api";
import * as mt from "../meetup-api";
import { CATEGORIES, fmtWhen, label } from "../format";

export default function MeetupDetailPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/meetup/:id");
  const meetupId = Number(params?.id);
  const base = `/${lang}/benevole/espace/meetup`;
  const [m, setM] = useState<mt.MeetupDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  // A hidden or deleted meetup (404) is not an error: show the "no longer available" message instead.
  const load = useCallback(() => {
    setLoadError("");
    return mt.getMeetup(meetupId).then(setM).catch((e: unknown) => {
      if (e instanceof HubApiError && e.status === 404) { setM(null); return; }
      setLoadError(e instanceof Error ? e.message : "Impossible de charger ce meetup.");
    });
  }, [meetupId]);

  useEffect(() => { if (me && Number.isSafeInteger(meetupId)) load(); }, [me, meetupId, load]);

  // run an action, toast its result or its server error, then refresh the meetup
  const act = async (fn: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await fn();
      if (ok) toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (loadError) return <HubShell me={me}><ErrorPanel message={loadError} onRetry={load} /></HubShell>;
  if (m === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (m === null) return (
    <HubShell me={me}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Ce meetup n'est plus disponible. <Link href={base} className="text-blue-700 underline">Retour aux meetups</Link></p></HubShell>
  );

  const cancelled = m.status === "cancelled";
  const closed = cancelled || m.ended;
  const full = m.spots_left === 0;

  return (
    <HubShell me={me}>
      <Link href={base} className="text-sm text-blue-700 underline">← Meetup</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {m.photo && <img src={m.photo} alt="" className="max-h-[28rem] w-full bg-slate-100 object-contain" />}
        <div className="space-y-3 p-4">
          {cancelled && <p role="status" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-900">Ce meetup a été annulé par l'organisateur.</p>}
          {!cancelled && m.ended && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm font-semibold text-slate-700">Ce meetup est terminé.</p>}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">{m.title}</h1>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">{label(CATEGORIES, m.category)}</span>
          </div>
          <div className="space-y-1 text-sm text-slate-700">
            <p className="inline-flex items-center gap-2"><CalendarDays size={16} aria-hidden /> {fmtWhen(m.starts_at, m.ends_at)}</p>
            <p className="flex items-center gap-2"><MapPin size={16} aria-hidden className="shrink-0" /> <span className="break-words">{m.place}, {m.city}, {m.country}</span></p>
            <p className="inline-flex items-center gap-2"><Users size={16} aria-hidden /> {m.going_count} / {m.capacity} inscrits · {full ? "complet" : `${m.spots_left} place${m.spots_left > 1 ? "s" : ""} restante${m.spots_left > 1 ? "s" : ""}`}{m.waitlist_count > 0 ? ` · ${m.waitlist_count} en attente` : ""}</p>
          </div>
          <p className="whitespace-pre-wrap break-words text-slate-900">{m.description}</p>
          <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-sm">
            <Avatar name={m.organizer.display_name} src={m.organizer.avatar} size={36} />
            <span className="font-semibold text-slate-900">{m.organizer.display_name}</span>
            <span className="text-slate-500">organisateur</span>
          </div>

          {m.mine ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              {!cancelled && <Link href={`${base}/${m.id}/modifier`} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200">Modifier</Link>}
              {!cancelled && (
                <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Annuler ce meetup ? Les inscrits ne pourront plus y participer.")) act(async () => { await mt.cancelMeetup(m.id); return "Meetup annulé"; }); }}>Annuler le meetup</Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              {m.my_status === null && (
                <Button className="bg-blue-700 hover:bg-blue-800" disabled={busy || closed}
                  onClick={() => act(async () => ((await mt.joinMeetup(m.id)).status === "going" ? "Vous êtes inscrit" : "Vous êtes sur liste d'attente"))}>
                  {full ? "Rejoindre la liste d'attente" : "Participer"}
                </Button>
              )}
              {m.my_status !== null && (
                <>
                  <p className="self-center text-sm font-semibold text-slate-800">{m.my_status === "going" ? "Vous êtes inscrit." : "Vous êtes sur liste d'attente."}</p>
                  <Button variant="outline" disabled={busy} onClick={() => act(async () => { await mt.leaveMeetup(m.id); return "Inscription annulée"; })}>Se désinscrire</Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Participants">
        <h2 className="font-bold text-slate-900">Participants ({m.going_count})</h2>
        {m.participants.length === 0 && <p className="text-sm text-slate-500">Personne n'est encore inscrit.</p>}
        <ul className="flex flex-wrap gap-3">
          {m.participants.map(p => (
            <li key={p.id} className="flex items-center gap-2 text-sm text-slate-800"><Avatar name={p.display_name} src={p.avatar} size={28} /> {p.display_name}</li>
          ))}
        </ul>
        {m.mine && (
          <>
            <h2 className="pt-2 font-bold text-slate-900">Liste d'attente ({m.waitlist_count})</h2>
            {m.waitlist.length === 0 && <p className="text-sm text-slate-500">Personne en attente.</p>}
            <ol className="space-y-1">
              {m.waitlist.map(p => (
                <li key={p.id} className="flex items-center gap-2 text-sm text-slate-800"><Avatar name={p.display_name} src={p.avatar} size={28} /> {p.display_name}</li>
              ))}
            </ol>
          </>
        )}
      </section>
    </HubShell>
  );
}
