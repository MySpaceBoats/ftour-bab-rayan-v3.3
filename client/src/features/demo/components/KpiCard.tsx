import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  trend?: { value: number; label?: string };
  icon: LucideIcon;
  accent?: "orange" | "emerald" | "sky" | "violet" | "rose";
}

const ACCENTS: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  orange: "bg-orange-100 text-orange-600",
  emerald: "bg-emerald-100 text-emerald-600",
  sky: "bg-sky-100 text-sky-600",
  violet: "bg-violet-100 text-violet-600",
  rose: "bg-rose-100 text-rose-600",
};

export function KpiCard({
  label,
  value,
  trend,
  icon: Icon,
  accent = "orange",
}: KpiCardProps) {
  const isUp = (trend?.value ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg",
            ACCENTS[accent],
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div
          className={cn(
            "mt-3 flex items-center gap-1 text-xs font-medium",
            isUp ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {isUp ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {Math.abs(trend.value).toFixed(1)}%
          <span className="ml-1 text-slate-500 font-normal">
            {trend.label ?? "vs mois précédent"}
          </span>
        </div>
      )}
    </div>
  );
}
