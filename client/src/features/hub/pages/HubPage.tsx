import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as hub from "../api";
import Composer from "../components/Composer";
import PostCard from "../components/PostCard";
import HubShell from "../components/HubShell";
import Avatar from "../components/Avatar";

export default function HubPage() {
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

  if (me === undefined) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  }

  if (me === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 p-4">
        <form onSubmit={sendLink} className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src="/logo-bab-rayan.svg" alt="" className="h-16 w-16" />
            <h1 className="text-2xl font-bold text-slate-900">Espace bénévole</h1>
            <p className="text-sm text-slate-600">Le coin des bénévoles Ftour Bab Rayan : partagez des photos, des nouvelles et des remerciements avec toute l'équipe.</p>
          </div>
          {sent ? (
            <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">Si cet email correspond à un bénévole confirmé, un lien de connexion vient d'être envoyé. Il est valable 15 minutes.</p>
          ) : (
            <>
              <Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} aria-label="Email" placeholder="L'email de votre inscription" className="h-11" />
              <Button type="submit" className="h-11 w-full bg-blue-700 hover:bg-blue-800" disabled={busy || !email.trim()}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : "Recevoir mon lien de connexion"}
              </Button>
              <p className="text-center text-xs text-slate-500">Pas de mot de passe : un lien sécurisé vous est envoyé par email.</p>
            </>
          )}
        </form>
      </div>
    );
  }

  const right = (
    <>
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm" aria-label="Annonces de l'équipe">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900"><Pin size={16} /> Annonces de l'équipe</h2>
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

  return (
    <HubShell me={me} right={right}>
      <Composer me={me} onPosted={() => load()} />
      {pinned.length > 0 && (
        <div className="space-y-4 xl:hidden">
          {pinned.map(p => <PostCard key={`pin-${p.id}`} post={p} me={me} onChanged={() => load()} />)}
        </div>
      )}
      {posts.map(p => <PostCard key={p.id} post={p} me={me} onChanged={() => load()} />)}
      {posts.length === 0 && pinned.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune publication pour l'instant. Lancez la conversation !</p>
      )}
      {next !== null && <Button variant="outline" className="w-full bg-white" onClick={() => load(next)}>Voir plus</Button>}
    </HubShell>
  );
}
