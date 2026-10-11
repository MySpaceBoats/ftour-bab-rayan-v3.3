import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as social from "./social-api";

const BTN = "min-h-10";

export default function RelationBar({ memberId }: { memberId: number }) {
  const [rel, setRel] = useState<social.Relation | null>(null);
  const [busy, setBusy] = useState(false);

  const idRef = useRef(memberId);
  idRef.current = memberId;

  useEffect(() => {
    let live = true;
    setRel(null);
    setBusy(false);
    social.getRelation(memberId).then(r => { if (live) setRel(r); }).catch(e => { if (live) toast.error((e as Error).message); });
    return () => { live = false; };
  }, [memberId]);

  const act = useCallback(async (fn: () => Promise<unknown>) => {
    const id = memberId;
    setBusy(true);
    try { await fn(); }
    catch (e) {
      if (idRef.current === id) { toast.error((e as Error).message); setBusy(false); }
      return;
    }
    try {
      const r = await social.getRelation(id);
      if (idRef.current === id) setRel(r);
    } catch {
      if (idRef.current === id) toast.error("Action effectuée, actualisez la page");
    }
    if (idRef.current === id) setBusy(false);
  }, [memberId]);

  if (!rel) return null;
  const friends = rel.friendship === "friends";

  return (
    <div role="group" className="space-y-2" aria-label="Relation avec ce membre">
      <div className="flex flex-wrap gap-2">
        {rel.friendship === "none" && <Button className={`${BTN} bg-blue-700 hover:bg-blue-800`} disabled={busy} onClick={() => act(() => social.requestFriend(memberId))}>Ajouter en ami</Button>}
        {rel.friendship === "sent" && <Button variant="outline" className={BTN} disabled={busy} onClick={() => act(() => social.removeFriend(memberId))}>Demande envoyée · Annuler</Button>}
        {rel.friendship === "received" && (
          <>
            <Button className={`${BTN} bg-blue-700 hover:bg-blue-800`} disabled={busy} onClick={() => act(() => social.acceptFriend(memberId))}>Accepter</Button>
            <Button variant="outline" className={BTN} disabled={busy} onClick={() => act(() => social.declineFriend(memberId))}>Refuser</Button>
          </>
        )}
        {friends && (
          <>
            <span className="inline-flex min-h-10 items-center rounded-lg bg-green-50 px-3 text-sm font-medium text-green-800">Amis ✓</span>
            <Button variant="outline" className={BTN} disabled={busy} onClick={() => { if (window.confirm("Retirer cet ami ?")) act(() => social.removeFriend(memberId)); }}>Retirer</Button>
          </>
        )}
        <Button
          variant="outline"
          className={BTN}
          aria-pressed={rel.following}
          disabled={busy || friends}
          title={friends ? "Vous suivez déjà vos amis" : undefined}
          onClick={() => act(() => (rel.following ? social.unfollow(memberId) : social.follow(memberId)))}
        >
          {rel.following ? "Suivi ✓" : "Suivre"}
        </Button>
        {rel.following && (
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            aria-label="Favori"
            aria-pressed={rel.favorite}
            disabled={busy}
            onClick={() => act(() => social.setFavorite(memberId, !rel.favorite))}
          >
            <Star size={18} aria-hidden className={rel.favorite ? "fill-amber-400 text-amber-500" : "text-slate-500"} />
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-500">{rel.friends_count} amis · {rel.followers_count} abonnés</p>
    </div>
  );
}
