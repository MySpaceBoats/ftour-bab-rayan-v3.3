import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as hub from "../api";
import Composer from "../components/Composer";
import PostCard from "../components/PostCard";
import HubShell from "../components/HubShell";
import Avatar from "../components/Avatar";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../components/StatePanel";

const EMAIL_KEY = "hub_login_email";
const RESEND_COOLDOWN_S = 30;

export default function HubPage() {
  const [me, setMe] = useState<hub.Member | null | undefined>(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loginError, setLoginError] = useState<string | null>(null); // expired or already-used link
  const [notice, setNotice] = useState<string | null>(null); // e.g. session expired mid-visit
  const [pinned, setPinned] = useState<hub.Post[]>([]);
  const [posts, setPosts] = useState<hub.Post[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [feedStatus, setFeedStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedError, setFeedError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const started = useRef(false); // StrictMode runs effects twice: the magic link is single-use
  const hasContentRef = useRef(false); // read inside load() without making it a dependency
  hasContentRef.current = posts.length > 0 || pinned.length > 0;

  /**
   * `silent` reloads (after posting, liking, deleting) keep what is on screen instead of
   * swapping the feed for a spinner; only a first load or an explicit retry shows the loader.
   */
  const load = useCallback(async (cursor: number | null = null, opts: { silent?: boolean } = {}) => {
    const keepContent = opts.silent === true && hasContentRef.current;
    if (cursor === null) {
      if (!keepContent) { setFeedStatus("loading"); setFeedError(""); }
    } else {
      setLoadingMore(true);
    }
    try {
      const f = await hub.getFeed(cursor);
      if (cursor === null) { setPinned(f.pinned); setPosts(f.posts); } else setPosts(p => [...p, ...f.posts]);
      setNext(f.nextCursor);
      setFeedStatus("ready");
    } catch (e) {
      if (e instanceof hub.HubApiError && e.status === 401) {
        hub.setHubToken(null);
        setMe(null);
        setNotice("Votre session a expiré. Demandez un nouveau lien de connexion.");
      } else if (cursor === null && !keepContent) {
        setFeedStatus("error");
        setFeedError((e as Error).message);
      } else {
        // what is already on screen stays usable: only the refresh or the extra page failed
        toast.error((e as Error).message);
      }
    } finally {
      if (cursor !== null) setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const onUnauthorized = () => { setMe(null); setSent(false); setNotice("Votre session a expiré. Demandez un nouveau lien de connexion."); };
    window.addEventListener("hub:unauthorized", onUnauthorized);
    return () => window.removeEventListener("hub:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try { setEmail(localStorage.getItem(EMAIL_KEY) ?? ""); } catch { /* storage unavailable */ }
    (async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      try {
        if (token) {
          window.history.replaceState({}, "", window.location.pathname);
          const r = await hub.verifyLogin(token);
          hub.setHubToken(r.session);
          setMe(r.member);
        } else if (hub.getHubToken()) setMe(await hub.getMe());
        else setMe(null);
      } catch (e) {
        // only a 401 invalidates the stored session; a network error must not log the user out
        if (token || (e instanceof hub.HubApiError && e.status === 401)) hub.setHubToken(null);
        else toast.error((e as Error).message);
        setMe(null);
        if (token) setLoginError("Ce lien de connexion a expiré ou a déjà été utilisé. Demandez-en un nouveau ci-dessous.");
      }
    })();
  }, []);

  useEffect(() => { if (me) load(); }, [me, load]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || busy || cooldown > 0) return;
    setBusy(true);
    setLoginError(null);
    try {
      await hub.requestLogin(value);
      try { localStorage.setItem(EMAIL_KEY, value); } catch { /* storage unavailable */ }
      setSent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (me === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  }

  if (me === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 p-4">
        <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo-bab-rayan.svg" alt="" className="h-16 w-16" />
            <h1 className="text-2xl font-bold text-slate-900">Espace bénévole</h1>
            <p className="text-sm text-slate-600">Le coin des bénévoles Ftour Bab Rayan : partagez des photos, des nouvelles et des remerciements avec toute l'équipe.</p>
          </div>

          {loginError && (
            <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-900">{loginError}</p>
          )}
          {notice && (
            <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">{notice}</p>
          )}

          {sent ? (
            <div className="space-y-4">
              <div role="status" className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
                <MailCheck size={20} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  Si cet email correspond à un bénévole confirmé, un lien de connexion vient d'être envoyé à <strong>{email.trim()}</strong>.
                  Il est valable <strong>15 minutes</strong>.
                </span>
              </div>
              <p className="text-center text-xs text-slate-500">
                Rien reçu ? Vérifiez vos spams, puis demandez un nouveau lien.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={busy || cooldown > 0}
                onClick={sendLink}
              >
                {busy
                  ? <Loader2 size={16} className="animate-spin" aria-hidden />
                  : cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer le lien"}
              </Button>
              <button
                type="button"
                className="block w-full text-center text-xs text-blue-700 underline"
                onClick={() => { setSent(false); setCooldown(0); setLoginError(null); setNotice(null); }}
              >
                Utiliser une autre adresse email
              </button>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="hub-email" className="text-sm font-medium text-slate-700">Votre email d'inscription</label>
                <Input
                  id="hub-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  aria-describedby="hub-email-hint"
                  placeholder="L'email de votre inscription"
                  className="h-11"
                />
              </div>
              <Button type="submit" className="h-11 w-full bg-blue-700 hover:bg-blue-800" disabled={busy || !email.trim()}>
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : "Recevoir mon lien de connexion"}
              </Button>
              <p id="hub-email-hint" className="text-center text-xs text-slate-500">Pas de mot de passe : un lien sécurisé, valable 15 minutes, vous est envoyé par email.</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  const right = (
    <>
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm" aria-label="Annonces de l'équipe">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900"><Pin size={16} aria-hidden /> Annonces de l'équipe</h2>
        {pinned.length === 0 && <p className="text-sm text-amber-900/70">Aucune annonce pour le moment.</p>}
        <ul className="space-y-3">
          {pinned.map(p => (
            <li key={p.id} className="text-sm text-slate-800">
              <p className="line-clamp-4 whitespace-pre-wrap break-words">{p.body}</p>
              <p className="mt-1 text-xs text-slate-500">{p.author.display_name}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 font-bold text-slate-900"><Avatar name="B" size={22} /> Entre bénévoles</h2>
        <p>Restez bienveillant·e : ici, on partage, on s'entraide et on se remercie. Un contenu déplacé ? Utilisez « Signaler ».</p>
      </section>
    </>
  );

  const hasContent = posts.length > 0 || pinned.length > 0;

  return (
    <HubShell me={me} right={right}>
      <Composer me={me} onPosted={() => load(null, { silent: true })} />
      {feedStatus === "loading" && <LoadingPanel label="Chargement du fil…" />}
      {feedStatus === "error" && <ErrorPanel message={feedError || "Impossible de charger le fil."} onRetry={() => load()} />}
      {feedStatus === "ready" && pinned.length > 0 && (
        <div className="space-y-4 xl:hidden">
          {pinned.map(p => <PostCard key={`pin-${p.id}`} post={p} me={me} onChanged={() => load(null, { silent: true })} />)}
        </div>
      )}
      {feedStatus === "ready" && posts.map(p => <PostCard key={p.id} post={p} me={me} onChanged={() => load(null, { silent: true })} />)}
      {feedStatus === "ready" && !hasContent && (
        <EmptyPanel
          title="Aucune publication pour l'instant."
          description="Lancez la conversation : une photo de votre dernière soirée, une question à l'équipe, un merci…"
        />
      )}
      {feedStatus === "ready" && next !== null && (
        <Button variant="outline" className="w-full bg-white" onClick={() => load(next)} disabled={loadingMore}>
          {loadingMore ? <><Loader2 size={16} className="mr-2 animate-spin" aria-hidden />Chargement…</> : "Voir plus"}
        </Button>
      )}
    </HubShell>
  );
}
