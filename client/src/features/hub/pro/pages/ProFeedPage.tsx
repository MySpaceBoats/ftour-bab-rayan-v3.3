import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";
import ProComposer from "../components/ProComposer";
import ProPostCard from "../components/ProPostCard";

export default function ProFeedPage() {
  const me = useHubMember();
  const [posts, setPosts] = useState<api.ProPost[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async (cursor: number | null = null) => {
    const id = ++reqId.current;
    try {
      const r = await api.getFeed(cursor);
      if (id !== reqId.current) return;
      setPosts(prev => (cursor ? [...(prev ?? []), ...r.posts] : r.posts));
      setNext(r.nextCursor);
    } catch (e) {
      if (id !== reqId.current) return;
      toast.error((e as Error).message);
      if (!cursor) setPosts([]);
    }
  }, []);
  useEffect(() => { if (me) load(); }, [me, load]);

  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;

  return (
    <ProLayout me={me} active="feed">
      <ProComposer me={me} onPosted={() => load()} />
      {posts === null && <Loader2 className="mx-auto animate-spin text-blue-700" />}
      {posts?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aucune publication pour l'instant. Lancez la conversation !</p>}
      {posts?.map(p => <ProPostCard key={p.id} post={p} me={me} onChanged={() => load()} />)}
      {next !== null && <Button variant="outline" className="w-full bg-white" onClick={() => load(next)}>Voir plus</Button>}
    </ProLayout>
  );
}
