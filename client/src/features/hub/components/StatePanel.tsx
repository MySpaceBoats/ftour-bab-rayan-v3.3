import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared loading / error / empty blocks so every hub screen announces the same way to assistive tech. */

export function LoadingPanel({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
      <Loader2 size={18} className="animate-spin text-blue-700" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorPanel({ message, onRetry, retrying }: { message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="flex items-center justify-center gap-2 font-medium text-red-900">
        <AlertTriangle size={18} aria-hidden />
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" className="bg-white" onClick={onRetry} disabled={retrying}>
          {retrying ? <Loader2 size={16} className="mr-2 animate-spin" aria-hidden /> : <RefreshCw size={16} className="mr-2" aria-hidden />}
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function EmptyPanel({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="text-sm text-slate-500">{description}</p>}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}
