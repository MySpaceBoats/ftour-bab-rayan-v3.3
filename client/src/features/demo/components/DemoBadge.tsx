import { Sparkles } from "lucide-react";

export function DemoBadge() {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-300"
      aria-label="Mode démonstration actif"
      data-testid="demo-badge"
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      Mode Démo
    </div>
  );
}
