import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ExternalLink, Flag, Heart, MessageCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import type * as hub from "../../api";
import Avatar from "../../components/Avatar";
import * as api from "../pro-api";
import { ago } from "../format";

const action = "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-slate-600 hover:bg-slate-100";

const host = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };

export default function ProPostCard({ post, me, onChanged }: { post: api.ProPost; me: hub.Member; onChanged: () => void }) {
  const { lang } = useI18n();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.like_count);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<api.ProComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const canDelete = post.author.id === me.id || me.role === "moderator";
  const commentCount = comments ? comments.length : post.comment_count;
  const photos = post.media.filter((u): u is string => !!u);
  const profile = `/${lang}/benevole/espace/pro/membre/${post.author.id}`;

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast.error((e as Error).message); } };
  const loadComments = () => act(async () => setComments(await api.getComments(post.id)));

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 p-4 pb-2">
        <Link href={profile}><Avatar name={post.author.display_name} src={post.author.avatar} size={44} /></Link>
        <div className="min-w-0 flex-1">
          <Link href={profile} className="font-semibold leading-tight text-slate-900 hover:underline">{post.author.display_name}</Link>
          {post.author.headline && <p className="truncate text-xs text-slate-600">{post.author.headline}</p>}
          <p className="text-xs text-slate-500">{ago(post.created_at)}</p>
        </div>
        {canDelete && (
          <button type="button" aria-label="Supprimer" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            onClick={() => { if (window.confirm("Supprimer cette publication ?")) act(async () => { await api.removePost(post.id); onChanged(); }); }}><Trash2 size={16} /></button>
        )}
      </header>

      <p className="whitespace-pre-wrap break-words px-4 pb-3 text-[15px] text-slate-900">{post.body}</p>
      {post.link && /^https?:\/\//i.test(post.link) && (
        <a href={post.link} target="_blank" rel="noopener noreferrer nofollow" className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-blue-700 hover:bg-slate-100">
          <ExternalLink size={16} className="shrink-0" /><span className="truncate">{host(post.link)}</span>
        </a>
      )}
      {photos.length > 0 && (
        <div className={`grid gap-0.5 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {photos.map(u => <img key={u} src={u} alt="" loading="lazy" className={`w-full object-cover ${photos.length === 1 ? "max-h-[28rem]" : "aspect-square"}`} />)}
        </div>
      )}

      {(likes > 0 || commentCount > 0) && (
        <div className="flex items-center justify-between px-4 pt-3 text-sm text-slate-500">
          <span>{likes > 0 && <><Heart size={14} className="mr-1 inline fill-red-500 text-red-500" />{likes}</>}</span>
          <span>{commentCount > 0 && `${commentCount} commentaire${commentCount > 1 ? "s" : ""}`}</span>
        </div>
      )}
      <div className="mx-4 mt-2 flex gap-1 border-t border-slate-200 py-1">
        <button type="button" aria-label={`J'aime, ${likes}`} aria-pressed={liked} className={`${action} ${liked ? "text-red-600" : ""}`}
          onClick={() => act(async () => { const r = await api.toggleLike(post.id); setLiked(r.liked); setLikes(r.count); })}><Heart size={18} className={liked ? "fill-red-500" : ""} /> J'aime</button>
        <button type="button" aria-label={`Commentaires, ${commentCount}`} aria-expanded={open} className={action}
          onClick={() => { setOpen(!open); if (!open && !comments) loadComments(); }}><MessageCircle size={18} /> Commenter</button>
        {/* ponytail: native prompt for the report reason; replace with a dialog if reports become frequent */}
        <button type="button" aria-label="Signaler" className={action}
          onClick={() => { const r = window.prompt("Motif du signalement ?"); if (r?.trim()) act(async () => { await api.report("post", post.id, r); toast.success("Merci, signalement envoyé."); }); }}><Flag size={18} /> Signaler</button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">
          {(comments ?? []).map(c => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar name={c.author.display_name} src={c.author.avatar} size={32} />
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-200/70 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-900">{c.author.display_name}</p>
                <p className="break-words text-slate-800">{c.body}</p>
              </div>
              {(c.author.id === me.id || me.role === "moderator") && (
                <button type="button" aria-label="Supprimer le commentaire" className="mt-2 text-slate-500" onClick={() => act(async () => { await api.removeComment(c.id); await loadComments(); })}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; act(async () => { await api.addComment(post.id, draft); setDraft(""); await loadComments(); }); }}>
            <Avatar name={me.display_name} src={me.avatar} size={32} />
            <Input aria-label="Votre commentaire" className="rounded-full bg-white" value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Écrivez un commentaire…" />
          </form>
        </div>
      )}
    </article>
  );
}
