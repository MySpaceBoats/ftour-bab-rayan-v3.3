import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import * as hub from "../api";
import Composer from "../components/Composer";
import PostCard from "../components/PostCard";

export default function HubPage() {
  const { lang } = useI18n();
  const [me, setMe] = useState<hub.Member | null | undefined>(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState<hub.Post[]>([]);
  const [posts, setPosts] = useState<hub.Post[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const started = useRef(false); // StrictMode runs effects twice: the magic link is single-use

  const load = useCallback(async (cursor: number | null = null) => {
    try {
      const f = await hub.getFeed(cursor);
      if (cursor === null) { setPinned(f.pinned); setPosts(f.posts); } else setPosts(p => [...p, ...f.posts]);
      setNext(f.nextCursor);
    } catch (e) {
      if (e instanceof hub.HubApiError && e.status === 401) { hub.setHubToken(null); setMe(null); } else toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const onUnauthorized = () => { setMe(null); setSent(false); };
    window.addEventListener("hub:unauthorized", onUnauthorized);
    return () => window.removeEventListener("hub:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
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
        if (token) toast.error((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => { if (me) load(); }, [me, load]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await hub.requestLogin(email.trim()); setSent(true); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-200">
      <Navbar />
      <main className="container max-w-2xl py-8 space-y-4">
        <h1 className="text-2xl font-bold">Espace bénévole</h1>

        {me === undefined && <Loader2 className="animate-spin" />}

        {me === null && (
          <form onSubmit={sendLink} className="rounded-xl border border-slate-300 bg-white shadow-sm p-4 space-y-3">
            {sent ? (
              <p>Si cet email correspond à un bénévole confirmé, un lien de connexion vient d'être envoyé. Il est valable 15 minutes.</p>
            ) : (
              <>
                <p>Entrez l'email utilisé lors de votre inscription. Nous vous envoyons un lien de connexion.</p>
                <Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" placeholder="votre@email.com" />
                <Button type="submit" disabled={busy || !email.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Recevoir mon lien"}</Button>
              </>
            )}
          </form>
        )}

        {me && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span>Connecté·e : <strong>{me.display_name}</strong></span>
              <span className="space-x-3">
                <Link href={`/${lang}/benevole/espace/profil`} className="underline">Mon profil</Link>
                <button type="button" className="underline" onClick={async () => { await hub.logout().catch(() => undefined); setMe(null); setSent(false); }}>Se déconnecter</button>
              </span>
            </div>
            <Composer onPosted={() => load()} />
            {pinned.map(p => <PostCard key={`pin-${p.id}`} post={p} me={me} onChanged={() => load()} />)}
            {posts.map(p => <PostCard key={p.id} post={p} me={me} onChanged={() => load()} />)}
            {posts.length === 0 && pinned.length === 0 && <p className="text-muted-foreground">Aucune publication pour l'instant. Lancez la conversation !</p>}
            {next !== null && <Button variant="outline" className="w-full" onClick={() => load(next)}>Voir plus</Button>}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
