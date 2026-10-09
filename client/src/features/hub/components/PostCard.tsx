import { useState } from "react";
import { toast } from "sonner";
import { Flag, Heart, MessageCircle, Pin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as hub from "../api";

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PostCard({ post, me, onChanged }: { post: hub.Post; me: hub.Member; onChanged: () => void }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<hub.Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const canDelete = post.author.id === me.id || me.role === "moderator";

  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); } catch (e) { toast.error((e as Error).message); }
  };
  const loadComments = () => act(async () => setComments(await hub.getComments(post.id)));

  return (
    <article className={`rounded-xl border bg-white p-4 space-y-3 ${post.kind === "announcement" ? "border-amber-400 bg-amber-50" : ""}`}>
      <header className="flex items-center justify-between text-sm">
        <div>
          <span className="font-semibold">{post.author.display_name}</span>
          <span className="ml-2 text-muted-foreground">{when(post.created_at)}</span>
        </div>
        {post.pinned && <span className="flex items-center gap-1 text-amber-700"><Pin size={14} /> Annonce</span>}
      </header>

      <p className="whitespace-pre-wrap break-words">{post.body}</p>

      {post.media.some(Boolean) && (
        <div className="grid grid-cols-2 gap-2">
          {post.media.filter((u): u is string => !!u).map(u => <img key={u} src={u} alt="" loading="lazy" className="w-full rounded-lg object-cover" />)}
        </div>
      )}

      <footer className="flex items-center gap-1 text-sm">
        <Button variant="ghost" size="sm" aria-label={`J'aime, ${likes}`} aria-pressed={liked} onClick={() => act(async () => { const r = await hub.toggleLike(post.id); setLiked(r.liked); setLikes(r.count); })}>
          <Heart size={16} className={liked ? "mr-1 fill-red-500 text-red-500" : "mr-1"} /> {likes}
        </Button>
        <Button variant="ghost" size="sm" aria-label={`Commentaires, ${comments ? comments.length : post.comment_count}`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !comments) loadComments(); }}>
          <MessageCircle size={16} className="mr-1" /> {comments ? comments.length : post.comment_count}
        </Button>
        <span className="flex-1" />
        {/* ponytail: native prompt for the report reason; replace with a dialog if reports become frequent */}
        <Button variant="ghost" size="sm" aria-label="Signaler" onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) act(async () => { await hub.report("post", post.id, r); toast.success("Merci, signalement envoyé."); }); }}>
          <Flag size={16} />
        </Button>
        {canDelete && (
          <Button variant="ghost" size="sm" aria-label="Supprimer" onClick={() => { if (window.confirm("Supprimer cette publication ?")) act(async () => { await hub.removePost(post.id); onChanged(); }); }}>
            <Trash2 size={16} />
          </Button>
        )}
      </footer>

      {open && (
        <div className="space-y-2 border-t pt-3">
          {(comments ?? []).map(c => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
              <p className="break-words"><span className="font-semibold">{c.author.display_name}</span> {c.body}</p>
              {(c.author.id === me.id || me.role === "moderator") && (
                <button type="button" aria-label="Supprimer le commentaire" className="text-muted-foreground" onClick={() => act(async () => { await hub.removeComment(c.id); await loadComments(); })}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; act(async () => { await hub.addComment(post.id, draft); setDraft(""); await loadComments(); }); }}>
            <Input aria-label="Votre commentaire" value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Votre commentaire…" />
            <Button type="submit" size="sm" disabled={!draft.trim()}>Envoyer</Button>
          </form>
        </div>
      )}
    </article>
  );
}
