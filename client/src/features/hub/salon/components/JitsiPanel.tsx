import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jitsiUrl } from "../salon-api";

/** Visio de groupe du salon. Rien n'est chargé (ni caméra, ni micro) avant le clic ; l'URL (avec jeton JaaS) vient du serveur. */
export default function JitsiPanel({ salonId }: { salonId: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (src) { setSrc(null); return; }
    setBusy(true);
    try {
      setSrc((await jitsiUrl(salonId)).url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Visio du salon" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold"><Video size={18} aria-hidden /> Visio du salon</h2>
        <Button variant={src ? "outline" : "default"} onClick={() => void toggle()} disabled={busy}>
          {busy ? <Loader2 size={16} className="mr-1 animate-spin" aria-hidden /> : src ? <VideoOff size={16} className="mr-1" aria-hidden /> : <Video size={16} className="mr-1" aria-hidden />}
          {src ? "Quitter la visio" : "Rejoindre la visio"}
        </Button>
      </div>
      {src && (
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
