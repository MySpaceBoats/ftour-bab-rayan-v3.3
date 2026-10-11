import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import * as hub from "../api";
import HubShell from "../components/HubShell";
import Avatar from "../components/Avatar";
import { ErrorPanel, LoadingPanel } from "../components/StatePanel";
import * as social from "./social-api";
import type { Person } from "./social-api";

type Tab = "requests" | "friends" | "following";
const TABS: { id: Tab; label: string }[] = [
  { id: "requests", label: "Demandes" },
  { id: "friends", label: "Amis" },
  { id: "following", label: "Suivis" },
];
const EMPTY: Record<Tab, string> = { requests: "Aucune demande", friends: "Aucun ami pour le moment", following: "Vous ne suivez personne" };
const btn = "min-h-10 min-w-10";

export default function FriendsPage() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [me, setMe] = useState<hub.Member | null>(null);
  const [tab, setTab] = useState<Tab>("requests");
  const [received, setReceived] = useState<Person[]>([]);
  const [sent, setSent] = useState<Person[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const seq = useRef(0);
  const base = `/${lang}/benevole/espace`;

  useEffect(() => {
    hub.getMe().then(setMe).catch(() => setLocation(base));
  }, [base, setLocation]);

  useEffect(() => {
    const back = () => setLocation(base);
    window.addEventListener("hub:unauthorized", back);
    return () => window.removeEventListener("hub:unauthorized", back);
  }, [base, setLocation]);

  // Each load bumps seq; a response whose seq is stale (tab changed or newer load) is ignored.
  const load = useCallback(async (t: Tab, silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (t === "requests") {
        const r = await social.getRequests();
        if (id !== seq.current) return;
        setReceived(r.received); setSent(r.sent);
      } else {
        const r = await (t === "friends" ? social.getFriends() : social.getFollowing());
        if (id !== seq.current) return;
        setPeople(r.people); setCursor(r.nextCursor);
      }
    } catch (e) {
      if (id === seq.current) setError((e as Error).message || "Chargement impossible");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPeople([]); setCursor(null); setReceived([]); setSent([]);
    void load(tab);
    return () => { seq.current++; };
  }, [tab, load]);

  const loadMore = async () => {
    if (cursor == null || more) return;
    const id = seq.current;
    setMore(true);
    try {
      const r = await (tab === "friends" ? social.getFriends(cursor) : social.getFollowing(cursor));
      if (id !== seq.current) return;
      setPeople(p => [...p, ...r.people.filter(n => !p.some(o => o.id === n.id))]);
      setCursor(r.nextCursor);
    } catch (e) {
      if (id === seq.current) toast.error((e as Error).message);
    } finally { setMore(false); }
  };

  const act = async (p: Person, fn: () => Promise<unknown>, opts: { badge?: boolean; ok?: string } = {}) => {
    if (busy != null) return;
    setBusy(p.id);
    try {
      await fn();
      if (opts.ok) toast.success(opts.ok);
      if (opts.badge) window.dispatchEvent(new Event("hub:friends-changed"));
      await load(tab, true);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const row = (p: Person, actions: React.ReactNode) => (
    <li key={p.id} className="flex items-center gap-3 p-3">
      <Link href={`${base}/membre/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:underline">
        <Avatar name={p.display_name} src={p.avatar} size={44} />
        <span className="truncate font-medium text-slate-900">{p.display_name}</span>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{actions}</div>
    </li>
  );

  const section = (title: string, list: Person[], render: (p: Person) => React.ReactNode) =>
    list.length > 0 && (
      <section aria-label={title}>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">{title} ({list.length})</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">{list.map(render)}</ul>
      </section>
    );

  let body: React.ReactNode;
  if (loading) body = <LoadingPanel />;
  else if (error) body = <ErrorPanel message={error} onRetry={() => void load(tab)} />;
  else if (tab === "requests") {
    body = received.length + sent.length === 0 ? <Empty text={EMPTY.requests} /> : (
      <div className="space-y-4">
        {section("Reçues", received, p => row(p, <>
          <Button size="sm" className={btn} disabled={busy != null} onClick={() => act(p, () => social.acceptFriend(p.id), { badge: true, ok: "Ami ajouté" })}>Accepter</Button>
          <Button size="sm" variant="outline" className={btn} disabled={busy != null} onClick={() => act(p, () => social.declineFriend(p.id), { badge: true })}>Refuser</Button>
        </>))}
        {section("Envoyées", sent, p => row(p,
          <Button size="sm" variant="outline" className={btn} disabled={busy != null} onClick={() => act(p, () => social.declineFriend(p.id), { badge: true })}>Annuler</Button>))}
      </div>
    );
  } else if (people.length === 0) body = <Empty text={EMPTY[tab]} />;
  else {
    body = (
      <div className="space-y-3">
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {people.map(p => row(p, tab === "friends" ? (
            <Button size="sm" variant="outline" className={btn} disabled={busy != null}
              onClick={() => { if (window.confirm(`Retirer ${p.display_name} de vos amis ?`)) void act(p, () => social.removeFriend(p.id)); }}>Retirer</Button>
          ) : (
            <>
              <button type="button" aria-pressed={!!p.favorite} aria-label={p.favorite ? `Retirer ${p.display_name} des favoris` : `Ajouter ${p.display_name} aux favoris`}
                disabled={busy != null} onClick={() => act(p, () => social.setFavorite(p.id, !p.favorite))}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-amber-500 hover:bg-slate-100 disabled:opacity-50">
                <Star size={20} aria-hidden fill={p.favorite ? "currentColor" : "none"} />
              </button>
              <Button size="sm" variant="outline" className={btn} disabled={busy != null} onClick={() => act(p, () => social.unfollow(p.id))}>Ne plus suivre</Button>
            </>
          )))}
        </ul>
        {cursor != null && (
          <div className="text-center">
            <Button variant="outline" className="min-h-10" disabled={more} onClick={loadMore}>{more ? "Chargement…" : "Voir plus"}</Button>
          </div>
        )}
      </div>
    );
  }

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">Chargement…</div>;

  return (
    <HubShell me={me}>
      <h1 className="text-xl font-bold text-slate-900">Mes amis</h1>
      <div className="flex gap-2" role="group" aria-label="Sections">
        {TABS.map(t => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}
            className={`min-h-10 flex-1 rounded-lg border px-3 text-sm font-medium ${tab === t.id ? "border-blue-800 bg-blue-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {body}
    </HubShell>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">{text}</p>;
}
