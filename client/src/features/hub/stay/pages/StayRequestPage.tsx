import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { Check, Loader2, Send, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { ErrorPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import { HubApiError } from "../../api";
import * as st from "../stay-api";
import { REQUEST_STATUS, fmtDate, label, nights } from "../format";

const POLL_MS = 10_000;
const BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  accepted: "bg-emerald-100 text-emerald-900",
  declined: "bg-red-100 text-red-900",
  cancelled: "bg-slate-200 text-slate-700",
};

export default function StayRequestPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/hebergement/demandes/:requestId");
  const requestId = Number(params?.requestId);
  const base = `/${lang}/benevole/espace/hebergement`;
  const [data, setData] = useState<Awaited<ReturnType<typeof st.listStayMessages>> | null | undefined>(undefined);
  const [detail, setDetail] = useState<st.StayRequestDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const sending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([st.getStayRequest(requestId), st.listStayMessages(requestId)]);
      setDetail(r);
      setData(t);
      if (t.messages.some(m => m.sender_id !== me?.id && !m.read_at)) st.markStayRead(requestId).catch(() => undefined);
    } catch (err) {
      if (err instanceof HubApiError && err.status === 404) { setDetail(null); setData(null); return; }
      if (!dataRef.current) {
        setLoadError((err as Error).message);
        setDetail(undefined);
      } else toast.error((err as Error).message);
    }
  }, [requestId, me?.id]);

  // ponytail: polling every 10 s instead of websockets; fine for a small community
  useEffect(() => {
    if (!me || !Number.isSafeInteger(requestId)) return;
    setDetail(undefined);
    setLoadError("");
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [me, requestId, load]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [data?.messages.length]);

  if (!me || detail === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (loadError) return <HubShell me={me}><ErrorPanel message={loadError} onRetry={load} /></HubShell>;
  if (detail === null || !data) return (
    <HubShell me={me}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Demande introuvable. <Link href={`${base}/demandes`} className="text-blue-700 underline">Mes demandes</Link></p></HubShell>
  );

  const open = detail.status === "pending" || detail.status === "accepted";
  const other = detail.role === "guest" ? detail.host : detail.guest;

  const decide = async (action: "accept" | "decline" | "cancel") => {
    // ponytail: native prompt for the host's reply; replace with a dialog if needed
    const reply = action === "decline" ? window.prompt("Motif du refus (facultatif) ?") ?? undefined : undefined;
    setBusy(true);
    try {
      await st.decideStayRequest(detail.id, action, reply);
      toast.success(action === "accept" ? "Demande acceptée" : action === "decline" ? "Demande refusée" : "Demande annulée");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    // ref guard: state `busy` alone can lag behind a fast double Enter
    if (!draft.trim() || sending.current) return;
    sending.current = true;
    setBusy(true);
    const text = draft;
    try { await st.sendStayMessage(requestId, text); setDraft(d => (d === text ? "" : d)); await load(); } catch (err) { toast.error((err as Error).message); } finally { sending.current = false; setBusy(false); }
  };

  const review = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await st.reviewStay(requestId, rating, reviewBody);
      toast.success("Merci pour votre avis !");
      setReviewBody("");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <HubShell me={me}>
      <Link href={`${base}/demandes`} className="text-sm text-blue-700 underline">← Mes demandes</Link>
      <div className="space-y-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={other.display_name} src={other.avatar} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{other.display_name} <span className="font-normal text-slate-500">({detail.role === "guest" ? "hôte" : "voyageur"})</span></p>
              <Link href={`${base}/${detail.listing.id}`} className="block truncate text-sm text-blue-700 underline">{detail.listing.title}{detail.listing.city ? ` · ${detail.listing.city}` : ""}</Link>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${BADGE[detail.status]}`}>{label(REQUEST_STATUS, detail.status)}</span>
        </div>

        <dl className="grid gap-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500">Arrivée</dt><dd>{fmtDate(detail.start_date)}</dd></div>
          <div><dt className="text-xs text-slate-500">Départ</dt><dd>{fmtDate(detail.end_date)}</dd></div>
          <div><dt className="text-xs text-slate-500">Voyageurs · nuits</dt><dd>{detail.guests} · {nights(detail.start_date, detail.end_date)}</dd></div>
        </dl>
        <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{detail.message}</p>
        {detail.host_reply && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Réponse de l'hôte :</strong> {detail.host_reply}</p>}

        <div className="flex flex-wrap gap-2">
          {detail.role === "host" && detail.status === "pending" && (
            <>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => decide("accept")}><Check size={16} className="mr-2" /> Accepter</Button>
              <Button variant="outline" disabled={busy} onClick={() => decide("decline")}><X size={16} className="mr-2" /> Refuser</Button>
            </>
          )}
          {open && (
            <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Annuler cette demande ?")) decide("cancel"); }}>{detail.role === "guest" ? "Annuler ma demande" : "Annuler le séjour"}</Button>
          )}
        </div>

        {detail.can_review && (
          <form onSubmit={review} className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h2 className="font-semibold text-slate-900">Laisser un avis sur ce séjour</h2>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Note">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} sur 5`} onClick={() => setRating(i)}>
                  <Star size={22} className={i <= rating ? "fill-amber-500 text-amber-500" : "text-slate-300"} />
                </button>
              ))}
            </div>
            <Textarea aria-label="Votre avis" rows={2} maxLength={500} value={reviewBody} onChange={e => setReviewBody(e.target.value)} placeholder="Comment s'est passé votre séjour ? (facultatif)" />
            <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={busy}>Publier l'avis</Button>
          </form>
        )}
        {detail.review && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Votre avis :</strong> {detail.review.rating}/5{detail.review.body ? ` — ${detail.review.body}` : ""}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-200 p-3 font-bold text-slate-900">Discussion</h2>
        <div className="max-h-[50vh] min-h-[14rem] space-y-2 overflow-y-auto bg-slate-50 p-3">
          {data.nextCursor !== null && <p className="text-center text-xs text-slate-400">Messages plus anciens non affichés</p>}
          {data.messages.length === 0 && <p className="text-center text-sm text-slate-500">Aucun message pour l'instant.</p>}
          {data.messages.map(m => {
            const mine = m.sender_id === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? "bg-blue-700 text-white" : "bg-white text-slate-900 shadow-sm"}`}>{m.body}</p>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        {open ? (
          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
            <Input aria-label="Votre message" value={draft} maxLength={1000} onChange={e => setDraft(e.target.value)} placeholder="Écrivez un message…" className="rounded-full" />
            <Button type="submit" aria-label="Envoyer" className="bg-blue-700 hover:bg-blue-800" disabled={busy || !draft.trim()}><Send size={16} /></Button>
          </form>
        ) : (
          <p className="border-t border-slate-200 p-3 text-sm text-slate-500">Cette demande est close : la discussion est en lecture seule.</p>
        )}
      </div>
    </HubShell>
  );
}
