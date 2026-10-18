import { useState } from "react";
import { Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// ponytail: domaine configurable ; meet.jit.si limite l'embarquement, voir spec (JaaS / serveur dédié si bloquant)
const DOMAIN = (import.meta.env.VITE_JITSI_DOMAIN as string | undefined) || "meet.jit.si";

/** Visio de groupe du salon. Rien n'est chargé (ni caméra, ni micro) avant le clic. */
export default function JitsiPanel({ room, displayName }: { room: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const src = `https://${DOMAIN}/babrayan-${encodeURIComponent(room)}#userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}&config.prejoinPageEnabled=false`;
  return (
    <section aria-label="Visio du salon" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Video size={18} aria-hidden /> Visio du salon</h2>
        <Button variant={open ? "outline" : "default"} onClick={() => setOpen(o => !o)}>
          {open ? <><VideoOff size={16} className="mr-1" aria-hidden /> Quitter la visio</> : <><Video size={16} className="mr-1" aria-hidden /> Rejoindre la visio</>}
        </Button>
      </div>
      {open && (
        <iframe
          title="Visio du salon"
          src={src}
          allow="camera; microphone; display-capture; fullscreen; autoplay"
          className="h-[60vh] min-h-[320px] w-full rounded-lg border-0 bg-slate-900"
        />
      )}
    </section>
  );
}
