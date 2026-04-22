import { Eye } from "lucide-react";

export function DemoBadge() {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 ring-1 ring-inset ring-orange-200"
      aria-label="Espace d'aperçu"
      data-testid="demo-badge"
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      Aperçu
    </div>
  );
}
