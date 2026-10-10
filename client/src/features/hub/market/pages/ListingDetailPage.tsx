import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Flag, Loader2, MessageCircle, Phone, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as mk from "../market-api";
import { CATEGORIES, CONDITIONS, label, price } from "../format";

export default function ListingDetailPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/marketplace/:id");
  const listingId = Number(params?.id);
  const base = `/${lang}/benevole/espace/marketplace`;
  const [l, setL] = useState<mk.ListingDetail | null | undefined>(undefined);
  const [comments, setComments] = useState<mk.MkComment[]>([]);
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState(0);
  const [posting, setPosting] = useState(false);

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast.error((e as Error).message); } };
  const loadComments = useCallback(() => mk.listComments(listingId).then(setComments).catch(() => undefined), [listingId]);

  useEffect(() => {
    if (!me || !Number.isSafeInteger(listingId)) return;
    mk.getListing(listingId).then(setL).catch(() => setL(null));
    loadComments();
  }, [me, listingId, loadComments]);

  if (!me || l === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (l === null) return (
    <HubShell me={me}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Cette annonce n'existe plus. <Link href={base} className="text-blue-700 underline">Retour à la marketplace</Link></p></HubShell>
  );

  const photos = l.media.filter((u): u is string => !!u);
  const digits = l.contact?.phone.replace(/^\+/, "");

  return (
    <HubShell me={me}>
      <Link href={base} className="text-sm text-blue-700 underline">← Marketplace</Link>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {photos.length > 0 && (
          <div>
            <img src={photos[photo]} alt="" className="max-h-[28rem] w-full bg-slate-100 object-contain" />
            {photos.length > 1 && (
              <div className="flex gap-2 p-2">
                {photos.map((u, i) => (
                  <button key={u} type="button" aria-label={`Photo ${i + 1}`} onClick={() => setPhoto(i)} className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === photo ? "border-blue-700" : "border-transparent"}`}>
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900">{l.title}</h1>
            <p className="whitespace-nowrap text-xl font-bold text-blue-800">{price(l.price)}</p>
          </div>
          <p className="text-sm text-slate-500">{label(CATEGORIES, l.category)} · {label(CONDITIONS, l.condition)}{l.city ? ` · ${l.city}` : ""}{l.status === "sold" ? " · VENDU" : ""}</p>
          <p className="whitespace-pre-wrap break-words text-slate-900">{l.description}</p>
          <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-sm">
            <Avatar name={l.seller.display_name} src={l.seller.avatar} size={36} />
            <span className="font-semibold text-slate-900">{l.seller.display_name}</span>
          </div>

          {l.mine ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`${base}/${l.id}/modifier`} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200">Modifier</Link>
              <Button variant="outline" onClick={() => act(async () => { await mk.setListingStatus(l.id, l.status === "sold" ? "active" : "sold"); setL(await mk.getListing(l.id)); })}>
                {l.status === "sold" ? "Remettre en vente" : "Marquer comme vendu"}
              </Button>
              <Button variant="outline" onClick={() => { if (window.confirm("Supprimer cette annonce ?")) act(async () => { await mk.removeListing(l.id); setLocation(base); }); }}><Trash2 size={16} className="mr-1" /> Supprimer</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {l.contact && <a href={`tel:${l.contact.phone}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Phone size={16} /> Appeler</a>}
              {l.contact?.whatsapp && <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"><MessageCircle size={16} /> WhatsApp</a>}
              <Button className="bg-blue-700 hover:bg-blue-800" disabled={l.status === "sold"} onClick={() => act(async () => { const t = await mk.openThread(l.id); setLocation(`${base}/messages/${t.id}`); })}>
                <MessageCircle size={16} className="mr-2" /> Envoyer un message
              </Button>
              {/* ponytail: native prompt for the report reason; replace with a dialog if reports become frequent */}
              <Button variant="ghost" onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) act(async () => { await mk.reportMarket("listing", l.id, r); toast.success("Merci, signalement envoyé."); }); }}><Flag size={16} className="mr-1" /> Signaler</Button>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Questions et commentaires">
        <h2 className="font-bold text-slate-900">Questions ({comments.length})</h2>
        {comments.map(c => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar name={c.author.display_name} src={c.author.avatar} size={32} />
            <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-3 py-2 text-sm">
              <p className="font-semibold text-slate-900">{c.author.display_name}</p>
              <p className="break-words text-slate-800">{c.body}</p>
            </div>
            {(c.author.id === me.id || me.role === "moderator") && (
              <button type="button" aria-label="Supprimer le commentaire" className="mt-2 text-slate-500" onClick={() => act(async () => { await mk.removeListingComment(c.id); await loadComments(); })}><Trash2 size={14} /></button>
            )}
          </div>
        ))}
        <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (posting || !draft.trim()) return; setPosting(true); act(async () => { await mk.addListingComment(l.id, draft); setDraft(""); await loadComments(); }).finally(() => setPosting(false)); }}>
          <Avatar name={me.display_name} src={me.avatar} size={32} />
          <Input aria-label="Votre question" className="rounded-full" value={draft} maxLength={500} disabled={posting} onChange={e => setDraft(e.target.value)} placeholder="Posez une question publique…" />
          <button type="submit" aria-label="Envoyer le commentaire" disabled={posting || !draft.trim()} className="text-blue-700 disabled:opacity-40"><Send size={18} /></button>
        </form>
      </section>
    </HubShell>
  );
}
