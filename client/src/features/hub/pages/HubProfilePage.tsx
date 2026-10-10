import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import * as hub from "../api";
import HubShell from "../components/HubShell";
import AccountSettings from "../components/AccountSettings";
import Avatar from "../components/Avatar";

export default function HubProfilePage() {
  const { lang } = useI18n();
  const [me, setMe] = useState<hub.Member | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/membre/:id");
  const viewedId = params ? Number(params.id) : null;
  const [profile, setProfile] = useState<{ member: hub.Member; photos: hub.Photo[] } | null>(null);

  useEffect(() => {
    hub.getMe().then(m => { setMe(m); setName(m.display_name); setBio(m.bio); }).catch(() => setLocation(`/${lang}/benevole/espace`));
  }, [lang, setLocation]);

  const targetId = viewedId ?? me?.id ?? null;
  useEffect(() => {
    if (targetId == null) return;
    if (!Number.isSafeInteger(targetId) || targetId <= 0) { toast.error("Membre introuvable"); setProfile(null); return; }
    let live = true;
    setProfile(null);
    hub.getMember(targetId).then(r => { if (live) setProfile(r); }).catch(e => { if (live) toast.error((e as Error).message); });
    return () => { live = false; };
  }, [targetId]);

  useEffect(() => {
    const back = () => setLocation(`/${lang}/benevole/espace`);
    window.addEventListener("hub:unauthorized", back);
    return () => window.removeEventListener("hub:unauthorized", back);
  }, [lang, setLocation]);

  const save = async (avatarKey?: string) => {
    setBusy(true);
    try {
      const m = await hub.updateMe({ display_name: name, bio, ...(avatarKey ? { avatar_key: avatarKey } : {}) });
      setMe(m);
      toast.success("Profil enregistré");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try { await save(await hub.uploadImage(file)); } catch (e) { toast.error((e as Error).message); }
  };

  if (!me) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">Chargement…</div>;
  }

  const readOnly = viewedId != null && viewedId !== me.id;
  const photos = (profile?.photos ?? []).filter(p => p.url);
  const photoGrid = (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-900">Photos</h2>
      {photos.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune photo partagée.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map(p => <img key={p.path} src={p.url!} alt="Photo partagée" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />)}
        </div>
      )}
    </section>
  );

  if (readOnly) {
    const m = profile?.member;
    return (
      <HubShell me={me}>
        {m && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-24 bg-gradient-to-r from-blue-800 to-blue-500" />
            <div className="space-y-3 p-4">
              <div className="-mt-14 w-fit rounded-full ring-4 ring-white"><Avatar name={m.display_name} src={m.avatar} size={88} /></div>
              <h1 className="text-xl font-bold text-slate-900">{m.display_name}</h1>
              {m.bio && <p className="whitespace-pre-wrap text-sm text-slate-700">{m.bio}</p>}
            </div>
          </div>
        )}
        {m && photoGrid}
        <Link href={`/${lang}/benevole/espace`} className="inline-block text-sm text-blue-700 underline">← Retour au fil</Link>
      </HubShell>
    );
  }

  return (
    <HubShell me={me}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-24 bg-gradient-to-r from-blue-800 to-blue-500" />
        <div className="space-y-4 p-4">
          <div className="-mt-14 flex items-end gap-4">
            <div className="rounded-full ring-4 ring-white"><Avatar name={me.display_name} src={me.avatar} size={88} /></div>
            <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Changer la photo
              <input type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label="Photo de profil" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; pickAvatar(f); }} />
            </label>
          </div>
          <Input value={name} onChange={e => setName(e.target.value)} maxLength={40} aria-label="Nom affiché" />
          <Textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} rows={3} aria-label="Bio" placeholder="Quelques mots sur vous" />
          <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => save()} disabled={busy || !name.trim()}>Enregistrer</Button>
        </div>
      </div>
      {photoGrid}
      <AccountSettings />
      <Link href={`/${lang}/benevole/espace`} className="inline-block text-sm text-blue-700 underline">← Retour au fil</Link>
    </HubShell>
  );
}
