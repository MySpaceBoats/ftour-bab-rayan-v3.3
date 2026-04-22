import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, PackagePlus, PackageCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DemoLayout } from "../components/DemoLayout";
import { KpiCard } from "../components/KpiCard";
import { formatMAD, formatNumber, formatRelativeTime } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";
import type { DemoProduct } from "../data/types";

const CATEGORY_LABELS: Record<DemoProduct["category"], string> = {
  goodies: "Goodies",
  terroir: "Terroir",
  patisserie: "Pâtisserie",
  ingredients: "Ingrédients",
  logistique: "Logistique",
};

const CATEGORY_STYLES: Record<DemoProduct["category"], string> = {
  goodies: "bg-orange-100 text-orange-700",
  terroir: "bg-emerald-100 text-emerald-700",
  patisserie: "bg-violet-100 text-violet-700",
  ingredients: "bg-sky-100 text-sky-700",
  logistique: "bg-slate-100 text-slate-700",
};

type CatFilter = DemoProduct["category"] | "all";

export default function DemoInventaire() {
  const data = useDemoData();
  const [cat, setCat] = useState<CatFilter>("all");

  const filtered = useMemo(() => {
    if (cat === "all") return data.products;
    return data.products.filter((p) => p.category === cat);
  }, [data.products, cat]);

  const stats = useMemo(() => {
    const value = data.products.reduce((a, p) => a + p.stock * p.unitCost, 0);
    const lowStock = data.products.filter((p) => p.stock <= p.threshold);
    const references = data.products.length;
    const outOfStock = data.products.filter((p) => p.stock === 0).length;
    return { value, lowStock, references, outOfStock };
  }, [data.products]);

  return (
    <DemoLayout
      title="Inventaire"
      subtitle="Stocks, alertes et mouvements produits"
      tooltip="Suivi des stocks de goodies, produits terroir, pâtisserie, ingrédients et logistique. Les alertes sont déclenchées automatiquement sous le seuil."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Références"
          value={formatNumber(stats.references)}
          icon={Boxes}
          accent="orange"
          trend={{ value: 0 }}
        />
        <KpiCard
          label="Valeur du stock"
          value={formatMAD(stats.value)}
          icon={PackageCheck}
          accent="emerald"
          trend={{ value: 4.7 }}
        />
        <KpiCard
          label="Alertes"
          value={formatNumber(stats.lowStock.length)}
          icon={AlertTriangle}
          accent="rose"
          trend={{ value: -2.5 }}
        />
        <KpiCard
          label="Ruptures"
          value={formatNumber(stats.outOfStock)}
          icon={PackagePlus}
          accent="violet"
          trend={{ value: 0 }}
        />
      </div>

      {stats.lowStock.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-900">
              {stats.lowStock.length} produit{stats.lowStock.length > 1 ? "s" : ""} sous
              seuil d'alerte
            </h2>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.lowStock.slice(0, 6).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md bg-white px-3 py-2 ring-1 ring-inset ring-amber-200"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {CATEGORY_LABELS[p.category]}
                  </div>
                </div>
                <span className="text-sm font-semibold text-amber-700">
                  {p.stock}/{p.threshold} {p.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 rounded-xl border border-slate-200 bg-white">
        <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={cat} onValueChange={(v) => setCat(v as CatFilter)}>
            <TabsList>
              <TabsTrigger value="all">Tout</TabsTrigger>
              <TabsTrigger value="ingredients">Ingrédients</TabsTrigger>
              <TabsTrigger value="patisserie">Pâtisserie</TabsTrigger>
              <TabsTrigger value="terroir">Terroir</TabsTrigger>
              <TabsTrigger value="goodies">Goodies</TabsTrigger>
              <TabsTrigger value="logistique">Logistique</TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Produit</th>
                <th className="hidden px-4 py-3 md:table-cell">Catégorie</th>
                <th className="px-4 py-3">Stock</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Coût unitaire</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Valeur stock</th>
                <th className="hidden px-4 py-3 md:table-cell">Dernier mouvement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const ratio = Math.min(
                  100,
                  Math.round((p.stock / (p.threshold * 3)) * 100),
                );
                const lowStock = p.stock <= p.threshold;
                return (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {p.name}
                      <div className="text-xs text-slate-500">
                        Seuil : {p.threshold} {p.unit}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[p.category]}`}
                      >
                        {CATEGORY_LABELS[p.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: 180 }}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                          aria-hidden="true"
                        >
                          <div
                            className={`h-full rounded-full transition-all ${
                              lowStock ? "bg-rose-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold whitespace-nowrap ${
                            lowStock ? "text-rose-600" : "text-slate-700"
                          }`}
                        >
                          {p.stock} {p.unit}
                        </span>
                      </div>
                      {lowStock && (
                        <Badge
                          variant="outline"
                          className="mt-1 bg-rose-100 text-[10px] text-rose-700 ring-1 ring-inset ring-rose-200"
                        >
                          Sous seuil
                        </Badge>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-slate-700 lg:table-cell">
                      {formatMAD(p.unitCost)}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-semibold text-slate-900 lg:table-cell">
                      {formatMAD(p.stock * p.unitCost)}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                      {formatRelativeTime(p.lastMovementAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </DemoLayout>
  );
}
