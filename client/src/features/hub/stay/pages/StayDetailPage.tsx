import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { BedDouble, CalendarDays, Flag, Loader2, MessageCircle, Phone, Star, Trash2, Users } from "lucide-react";
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
import { AMENITIES, KINDS, addDays, availabilityLabel, label, nights, priceLabel, todayIso } from "../format";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Note ${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} className={i <= Math.round(rating) ? "fill-amber-500 text-amber-500" : "text-slate-300"} aria-hidden />)}
    </span>
  );
}

export default function StayDetailPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/hebergement/:id");
  const listingId = Number(params?.id);
  const base = `/${lang}/benevole/espace/hebergement`;
  const [l, setL] = useState<st.StayDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [photo, setPhoto] = useState(0);
  const [booking, setBooking] = useState(false);
  const [dates, setDates] = useState({ start: "", end: "", guests: "1", message: "" });

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast.error((e as Error).message); } };

  // A deleted or paused-out listing (404) is not an error: show the "no longer exists" message instead.
  const loadListing = useCallback(() => {
    setLoadError("");
    return st.getStay(listingId).then(setL).catch((e: unknown) => {
      if (e instanceof HubApiError && e.status === 404) { setL(null); return; }
      setLoadError(e instanceof Error ? e.message : "Impossible de charger ce logement.");
    });
  }, [listingId]);

  useEffect(() => { if (me && Number.isSafeInteger(listingId)) loadListing(); }, [me, listingId, loadListing]);

  // default the booking window to the listing's own availability
  useEffect(() => {
    if (!l || l.mine) return;
    const start = l.available_from && l.available_from > todayIso() ? l.available_from : todayIso();
    setDates(d => ({ ...d, start: d.start || start, end: d.end || addDays(start, 2) }));
  }, [l]);

  const total = useMemo(() => {
    if (!l || !dates.start || !dates.end) return null;
    const n = nights(dates.start, dates.end);
    if (n < 1) return null;
    return l.price_type === "gratuit" ? null : { nights: n, amount: n * l.price };
  }, [l, dates.start, dates.end]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (loadError) return <HubShell me={me}><ErrorPanel message={loadError} onRetry={loadListing} /></HubShell>;
  if (l === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (l === null) return (
    <HubShell me={me}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Ce logement n'est plus disponible. <Link href={base} className="text-blue-700 underline">Retour à l'hébergement</Link></p></HubShell>
  );

  const photos = l.media.filter((u): u is string => !!u);
  const digits = l.contact?.phone.replace(/^\+/, "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dates.end <= dates.start) { toast.error("La date de départ doit suivre la date d'arrivée."); return; }
    const guests = Number(dates.guests);
    if (!Number.isSafeInteger(guests) || guests < 1 || guests > l.capacity) { toast.error(`Ce logement accueille ${l.capacity} voyageur(s) au maximum.`); return; }
    setBooking(true);
    try {
      const r = await st.createStayRequest(l.id, { startDate: dates.start, endDate: dates.end, guests, message: dates.message });
      setLocation(`${base}/demandes/${r.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBooking(false);
    }
  };

  return (
    <HubShell me={me}>
      <Link href={base} className="text-sm text-blue-700 underline">← Hébergement</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {photos.length > 0 && (
          <div>
            <img src={photos[photo]} alt="" className="max-h-[28rem] w-full bg-slate-100 object-contain" />
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-2">
                {photos.map((u, i) => (
                  <button key={u} type="button" aria-label={`Photo ${i + 1}`} onClick={() => setPhoto(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === photo ? "border-blue-700" : "border-transparent"}`}>
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">{l.title}</h1>
            <p className="whitespace-nowrap text-lg font-bold text-blue-800">{priceLabel(l.price_type, l.price)}</p>
          </div>
          <p className="text-sm text-slate-500">
            {label(KINDS, l.kind)}{l.city ? ` · ${l.city}` : ""}{l.area ? ` · ${l.area}` : ""}{l.status === "paused" ? " · EN PAUSE" : ""}
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
            <span className="inline-flex items-center gap-1"><Users size={16} aria-hidden /> {l.capacity} voyageur{l.capacity > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center gap-1"><BedDouble size={16} aria-hidden /> {l.rooms} pièce{l.rooms > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={16} aria-hidden /> {availabilityLabel(l.available_from, l.available_to)}</span>
            {l.review_count > 0 && <span className="inline-flex items-center gap-1"><Stars rating={l.rating ?? 0} /> {l.rating} ({l.review_count} avis)</span>}
          </div>
          <p className="whitespace-pre-wrap break-words text-slate-900">{l.description}</p>
          {l.amenities.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Équipements">
              {l.amenities.map(a => <li key={a} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{label(AMENITIES, a)}</li>)}
            </ul>
          )}
          <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-sm">
            <Avatar name={l.host.display_name} src={l.host.avatar} size={36} />
            <span className="font-semibold text-slate-900">{l.host.display_name}</span>
            <span className="text-slate-500">hôte</span>
          </div>

          {l.mine ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Link href={`${base}/${l.id}/modifier`} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200">Modifier</Link>
                <Link href={`${base}/demandes`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Demandes reçues</Link>
                <Button variant="outline" onClick={() => act(async () => { await st.setStayStatus(l.id, l.status === "paused" ? "active" : "paused"); setL(await st.getStay(l.id)); })}>
                  {l.status === "paused" ? "Remettre en ligne" : "Mettre en pause"}
                </Button>
                <Button variant="outline" onClick={() => { if (window.confirm("Supprimer ce logement ?")) act(async () => { await st.removeStay(l.id); setLocation(base); }); }}><Trash2 size={16} className="mr-1" /> Supprimer</Button>
              </div>
              <p className="text-xs text-slate-500">Vous ne pouvez pas réserver votre propre logement : les demandes arrivent dans « Mes demandes », onglet « Reçues ».</p>
            </div>
          ) : (
            <div className="space-y-3 border-t border-slate-200 pt-3">
              <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-50 p-3">
                <h2 className="font-bold text-slate-900">Demander à séjourner</h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-sm text-slate-700">Arrivée
                    <Input aria-label="Date d'arrivée" type="date" required min={todayIso()} value={dates.start} onChange={e => setDates(d => ({ ...d, start: e.target.value }))} />
                  </label>
                  <label className="text-sm text-slate-700">Départ
                    <Input aria-label="Date de départ" type="date" required min={dates.start ? addDays(dates.start, 1) : todayIso()} value={dates.end} onChange={e => setDates(d => ({ ...d, end: e.target.value }))} />
                  </label>
                  <label className="text-sm text-slate-700">Voyageurs
                    <Input aria-label="Nombre de voyageurs" type="number" required min={1} max={l.capacity} value={dates.guests} onChange={e => setDates(d => ({ ...d, guests: e.target.value }))} />
                  </label>
                </div>
                <Textarea aria-label="Message à l'hôte" required rows={3} maxLength={1000} value={dates.message} onChange={e => setDates(d => ({ ...d, message: e.target.value }))} placeholder="Présentez-vous brièvement : qui vient, pourquoi, heure d'arrivée…" />
                {total && <p className="text-sm text-slate-600">{total.nights} nuit{total.nights > 1 ? "s" : ""} · environ <strong>{total.amount.toLocaleString("fr-FR")} MAD</strong> à régler directement à l'hôte (aucun paiement sur le site).</p>}
                <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800" disabled={booking}>{booking ? <Loader2 size={16} className="animate-spin" /> : "Envoyer la demande"}</Button>
              </form>
              <div className="flex flex-wrap gap-2">
                {l.contact && <a href={`tel:${l.contact.phone}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Phone size={16} /> Appeler l'hôte</a>}
                {l.contact?.whatsapp && <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"><MessageCircle size={16} /> WhatsApp</a>}
                {/* ponytail: native prompt for the report reason; replace with a dialog if reports become frequent */}
                <Button variant="ghost" onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) act(async () => { await st.reportStay("listing", l.id, r); toast.success("Merci, signalement envoyé."); }); }}><Flag size={16} className="mr-1" /> Signaler</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Avis des bénévoles">
        <h2 className="font-bold text-slate-900">Avis ({l.review_count})</h2>
        {l.reviews.length === 0 && <p className="text-sm text-slate-500">Aucun avis pour l'instant.</p>}
        {l.reviews.map(r => (
          <div key={r.id} className="flex items-start gap-2">
            <Avatar name={r.author.display_name} src={r.author.avatar} size={32} />
            <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm">
              <p className="flex items-center gap-2 font-semibold text-slate-900">{r.author.display_name} <Stars rating={r.rating} /></p>
              {r.body && <p className="break-words text-slate-800">{r.body}</p>}
            </div>
          </div>
        ))}
      </section>
    </HubShell>
  );
}
