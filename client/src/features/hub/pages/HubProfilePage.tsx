import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import * as hub from "../api";

export default function HubProfilePage() {
  const { lang } = useI18n();
  const [me, setMe] = useState<hub.Member | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    hub.getMe().then(m => { setMe(m); setName(m.display_name); setBio(m.bio); }).catch(() => setLocation(`/${lang}/benevole/espace`));
  }, [lang, setLocation]);

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

  return (
    <div className="min-h-screen bg-slate-200">
      <Navbar />
      <main className="container max-w-xl py-8 space-y-4">
        <h1 className="text-2xl font-bold">Mon profil</h1>
        {me && (
          <div className="rounded-xl border border-slate-300 bg-white shadow-sm p-4 space-y-4">
            {me.avatar && <img src={me.avatar} alt="" className="h-24 w-24 rounded-full object-cover" />}
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Photo de profil" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; pickAvatar(f); }} />
            <Input value={name} onChange={e => setName(e.target.value)} maxLength={40} aria-label="Nom affiché" />
            <Textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} rows={3} aria-label="Bio" placeholder="Quelques mots sur vous" />
            <Button onClick={() => save()} disabled={busy || !name.trim()}>Enregistrer</Button>
          </div>
        )}
        <Link href={`/${lang}/benevole/espace`} className="underline text-sm">← Retour à l'espace</Link>
      </main>
      <Footer />
    </div>
  );
}
