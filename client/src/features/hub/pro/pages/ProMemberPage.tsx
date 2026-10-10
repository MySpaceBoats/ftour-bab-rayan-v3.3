import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Briefcase, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import Avatar from "../../components/Avatar";
import { useHubMember } from "../../useHubMember";
import * as api from "../pro-api";
import ProLayout from "../ProLayout";

export default function ProMemberPage() {
  const { lang } = useI18n();
  const me = useHubMember();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/:lang/benevole/espace/pro/membre/:id");
  const memberId = Number(params?.id);
  const base = `/${lang}/benevole/espace/pro`;
  const [p, setP] = useState<api.ProProfileView | null | undefined>(undefined);

  useEffect(() => {
    if (!me || !Number.isSafeInteger(memberId)) return;
    api.getProfile(memberId).then(setP).catch(() => setP(null));
  }, [me, memberId]);

  if (!me || p === undefined) return <div className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-blue-700" /></div>;
  if (p === null) return <ProLayout me={me} active={null}><p className="rounded-xl bg-white p-8 text-center text-slate-600">Membre introuvable. <Link href={base} className="text-blue-700 underline">Retour au feed</Link></p></ProLayout>;

  return (
    <ProLayout me={me} active={null}>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-r from-blue-800 to-blue-500" />
        <div className="space-y-3 p-4">
          <div className="-mt-12 rounded-full ring-4 ring-white w-fit"><Avatar name={p.member.display_name} src={p.member.avatar} size={80} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{p.member.display_name}</h1>
            {p.headline && <p className="text-slate-700">{p.headline}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-slate-500">
              {p.company && <span className="flex items-center gap-1"><Briefcase size={14} />{p.company}</span>}
              {p.city && <span className="flex items-center gap-1"><MapPin size={14} />{p.city}</span>}
            </p>
          </div>
          {p.open_to_work && <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Ouvert(e) aux opportunités</span>}
          {p.bio && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{p.bio}</p>}
          {p.skills.length > 0 && <ul className="flex flex-wrap gap-2">{p.skills.map(s => <li key={s} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{s}</li>)}</ul>}
          {p.mine && <Link href={`${base}/profil`} className="inline-block text-sm text-blue-700 underline">Modifier mon profil pro</Link>}
          {!p.mine && (
            <Button className="bg-blue-700 hover:bg-blue-800" onClick={() => api.openThread({ to: p.member.id }).then(t => setLocation(`${base}/messages/${t.id}`)).catch(e => toast.error((e as Error).message))}>Écrire</Button>
          )}
        </div>
      </div>
    </ProLayout>
  );
}
