import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import HubShell from "../../components/HubShell";
import Avatar from "../../components/Avatar";
import { ErrorPanel, LoadingPanel } from "../../components/StatePanel";
import { useHubMember } from "../../useHubMember";
import { HubApiError } from "../../api";
import * as sl from "../salon-api";
import JitsiPanel from "../components/JitsiPanel";
import { appendOlder, mergeFirstPage } from "../merge-posts";

const POLL_MS = 10_000;
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function SalonPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, params] = useRoute("/:lang/benevole/espace/salons/:id");
  const salonId = Number(params?.id);
  const back = `/${lang}/benevole/espace/salons`;
  const [salon, setSalon] = useState<sl.SalonDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [feed, setFeed] = useState<{ posts: sl.SalonPost[]; next: string | null }>({ posts: [], next: null });
  const { posts, next } = feed;
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const loadSalon = useCallback(() => {
    setLoadError("");
    return sl.getSalon(salonId).then(setSalon).catch((e: unknown) => {
      if (e instanceof HubApiError && e.status === 404) { setSalon(null); return; }
      setLoadError(e instanceof Error ? e.message : "Impossible de charger ce salon.");
    });
  }, [salonId]);

  // First page replaces the list; the poll merges new messages in front without losing older pages already loaded.
  const refresh = useCallback(async () => {
    try {
      const r = await sl.listPosts(salonId);
      setFeed(f => mergeFirstPage(f.posts, f.next, r.posts, r.nextCursor));
    } catch { /* ponytail: un échec de polling est silencieux, le prochain tick réessaie */ }
  }, [salonId]);

  useEffect(() => {
    if (!me || !Number.isSafeInteger(salonId)) return;
    void loadSalon();
    void sl.listPosts(salonId).then(r => setFeed({ posts: r.posts, next: r.nextCursor })).catch(() => undefined);
  }, [me, salonId, loadSalon]);

  useEffect(() => {
    if (!me || !salon) return;
    const t = setInterval(() => { if (!document.hidden) void refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [me, salon, refresh]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sl.createPost(salonId, text);
      setBody("");
      await refresh();
      logRef.current?.scrollTo({ top: 0 });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function more() {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await sl.listPosts(salonId, next);
      setFeed(f => ({ posts: appendOlder(f.posts, r.posts), next: r.nextCursor }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(p: sl.SalonPost) {
    try {
      await sl.deletePost(salonId, p.id);
      setFeed(f => ({ ...f, posts: f.posts.filter(x => x.id !== p.id) }));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function archive() {
    try {
      await sl.archiveSalon(salonId);
      toast.success("Salon archivé");
      await loadSalon();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (!me) return null;
  return (
    <HubShell me={me}>
      <div className="space-y-4">
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-blue-800 hover:underline"><ArrowLeft size={14} aria-hidden /> Tous les salons</Link>

        {salon === undefined && !loadError && <LoadingPanel label="Chargement du salon…" />}
        {loadError && <ErrorPanel message={loadError} onRetry={() => void loadSalon()} />}
        {salon === null && <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">Ce salon n'est plus disponible.</p>}

        {salon && (
          <>
            <header className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-bold">{salon.title}</h1>
                {salon.mine && salon.status === "active" && <Button variant="outline" size="sm" onClick={() => void archive()}>Archiver</Button>}
              </div>
              <p className="whitespace-pre-wrap text-slate-700">{salon.topic}</p>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Avatar name={salon.creator.display_name} src={salon.creator.avatar} size={20} /> Créé par {salon.creator.display_name}
                {salon.status === "archived" && <span className="rounded bg-slate-200 px-2 py-0.5 font-medium text-slate-700">Archivé</span>}
              </p>
            </header>

            {salon.status === "active" && <JitsiPanel room={salon.room} displayName={me.display_name} />}

            <section aria-label="Messages du salon" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {salon.status === "active" ? (
                <form onSubmit={send} className="flex gap-2">
                  <Textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={2} placeholder="Écris un message…" aria-label="Message" className="flex-1"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(e as unknown as React.FormEvent); } }} />
                  <Button type="submit" disabled={sending || !body.trim()} aria-label="Envoyer">
                    {sending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
                  </Button>
                </form>
              ) : (
                <p className="rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-600">Ce salon est archivé : lecture seule.</p>
              )}
              <div ref={logRef} role="log" aria-live="polite" className="space-y-3">
                {posts.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Aucun message pour l'instant. Lance la discussion !</p>}
                {posts.map(p => (
                  <article key={p.id} className="flex gap-3">
                    <Avatar name={p.author.display_name} src={p.author.avatar} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500"><span className="font-semibold text-slate-800">{p.author.display_name}</span> · {when(p.created_at)}</p>
                      {/* texte brut : React échappe, pas de HTML */}
                      <p className="whitespace-pre-wrap break-words text-sm">{p.body}</p>
                    </div>
                    {p.mine && salon.status === "active" && (
                      <button type="button" onClick={() => void remove(p)} aria-label="Supprimer mon message" className="self-start text-slate-400 hover:text-red-600"><Trash2 size={14} aria-hidden /></button>
                    )}
                  </article>
                ))}
              </div>
              {next && <div className="text-center"><Button variant="outline" className="bg-white" onClick={() => void more()} disabled={loadingMore}>{loadingMore && <Loader2 size={16} className="mr-2 animate-spin" aria-hidden />} Messages plus anciens</Button></div>}
            </section>
          </>
        )}
      </div>
    </HubShell>
  );
}
