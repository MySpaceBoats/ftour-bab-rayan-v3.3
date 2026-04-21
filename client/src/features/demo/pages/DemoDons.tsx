import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, HandCoins, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DemoLayout } from "../components/DemoLayout";
import { KpiCard } from "../components/KpiCard";
import { formatMAD, formatNumber, formatRelativeTime } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";
import { addDemoActivityEntry, updateDemoDataset } from "../data/store";
import type { DonationMethod, DonationStatus } from "../data/types";

const METHOD_LABELS: Record<DonationMethod, string> = {
  carte: "Carte bancaire",
  virement: "Virement",
  cash: "Espèces",
  cheque: "Chèque",
};

const STATUS_LABELS: Record<DonationStatus, string> = {
  valide: "Validé",
  en_attente: "En attente",
  refuse: "Refusé",
};

const STATUS_STYLES: Record<DonationStatus, string> = {
  valide: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  en_attente: "bg-amber-100 text-amber-700 ring-amber-200",
  refuse: "bg-rose-100 text-rose-700 ring-rose-200",
};

const METHOD_COLORS = ["#f97316", "#fb923c", "#0ea5e9", "#10b981"];

export default function DemoDons() {
  const data = useDemoData();
  const [addOpen, setAddOpen] = useState(false);

  const stats = useMemo(() => {
    const valide = data.donations.filter((d) => d.status === "valide");
    const totalMad = valide.reduce((a, d) => a + d.amount, 0);
    const average = valide.length ? Math.round(totalMad / valide.length) : 0;

    const byDay = new Map<string, number>();
    data.donations.forEach((d) => {
      const key = d.createdAt.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + (d.status === "valide" ? d.amount : 0));
    });
    const series = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        }),
        amount,
      }));

    const byMethod: Record<DonationMethod, number> = {
      carte: 0,
      virement: 0,
      cash: 0,
      cheque: 0,
    };
    data.donations.forEach((d) => {
      byMethod[d.method] += d.amount;
    });
    const methodData = (Object.keys(byMethod) as DonationMethod[]).map((k) => ({
      name: METHOD_LABELS[k],
      value: byMethod[k],
    }));

    const byMonth = new Map<string, number>();
    data.donations.forEach((d) => {
      const date = new Date(d.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + d.amount);
    });
    const monthSeries = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, amount]) => {
        const [y, m] = key.split("-");
        return {
          month: new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
            month: "short",
          }),
          amount,
        };
      });

    return { totalMad, average, series, methodData, monthSeries, valide };
  }, [data.donations]);

  const addDonation = (d: {
    donorName: string;
    amount: number;
    method: DonationMethod;
  }) => {
    const id = `don_${Date.now().toString(36)}`;
    const createdAt = new Date().toISOString();
    updateDemoDataset((prev) => ({
      ...prev,
      donations: [
        { ...d, id, status: "valide", createdAt },
        ...prev.donations,
      ],
    }));
    addDemoActivityEntry({
      id: `act_${Date.now().toString(36)}`,
      type: "donation",
      label: `Don de ${d.amount.toLocaleString("fr-FR")} MAD reçu`,
      actor: d.donorName,
      createdAt,
      meta: { amount: d.amount },
    });
    toast.success("Don ajouté avec succès", {
      description: `${d.donorName} — ${formatMAD(d.amount)} (simulation)`,
    });
    setAddOpen(false);
  };

  return (
    <DemoLayout
      title="Dons"
      subtitle="Historique, graphiques et ajout de faux dons"
      tooltip="Vous pouvez ajouter, consulter et filtrer des dons — tout reste local, aucune transaction n'est réellement traitée."
      actions={
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter un don
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total collecté"
          value={formatMAD(stats.totalMad)}
          icon={HandCoins}
          accent="orange"
          trend={{ value: 9.6 }}
        />
        <KpiCard
          label="Dons validés"
          value={formatNumber(stats.valide.length)}
          icon={CheckCircle2}
          accent="emerald"
          trend={{ value: 4.2 }}
        />
        <KpiCard
          label="Don moyen"
          value={formatMAD(stats.average)}
          icon={HandCoins}
          accent="violet"
          trend={{ value: 2.1 }}
        />
        <KpiCard
          label="En attente"
          value={formatNumber(
            data.donations.filter((d) => d.status === "en_attente").length,
          )}
          icon={Clock}
          accent="rose"
          trend={{ value: -1.2 }}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Collecte quotidienne — 30 derniers jours
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  formatter={(v: number) => [formatMAD(v), "Dons"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Répartition par moyen
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.methodData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                >
                  {stats.methodData.map((_, i) => (
                    <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMAD(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Collecte mensuelle — tendance
        </h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.monthSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip formatter={(v: number) => [formatMAD(v), "Total"]} />
              <Bar dataKey="amount" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Historique récent</h2>
          <p className="text-xs text-slate-500">
            Derniers dons simulés — aucune vraie transaction effectuée
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Donateur</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="hidden px-4 py-3 md:table-cell">Méthode</th>
                <th className="px-4 py-3">Statut</th>
                <th className="hidden px-4 py-3 md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.donations.slice(0, 25).map((d) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {d.donorName}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatMAD(d.amount)}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-700 md:table-cell">
                    {METHOD_LABELS[d.method]}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`${STATUS_STYLES[d.status]} ring-1 ring-inset`}
                    >
                      {d.status === "valide" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {d.status === "en_attente" && <Clock className="mr-1 h-3 w-3" />}
                      {d.status === "refuse" && <XCircle className="mr-1 h-3 w-3" />}
                      {STATUS_LABELS[d.status]}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {formatRelativeTime(d.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AddDonationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={addDonation}
      />
    </DemoLayout>
  );
}

function AddDonationDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (d: { donorName: string; amount: number; method: DonationMethod }) => void;
}) {
  const [donorName, setDonorName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<DonationMethod>("carte");

  const submit = () => {
    const value = Number(amount);
    if (!donorName.trim()) {
      toast.error("Le nom du donateur est requis");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Le montant doit être un nombre positif");
      return;
    }
    onSubmit({ donorName: donorName.trim(), amount: value, method });
    setDonorName("");
    setAmount("");
    setMethod("carte");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un don fictif</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nom du donateur</Label>
            <Input
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              placeholder="Ex : Salma El Fassi"
              maxLength={80}
            />
          </div>
          <div className="space-y-1">
            <Label>Montant (MAD)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              min={1}
              max={1_000_000}
            />
          </div>
          <div className="space-y-1">
            <Label>Méthode</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as DonationMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METHOD_LABELS) as DonationMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Rappel : ce don est 100% simulé. Aucun paiement n'est déclenché.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit}>
            <Plus className="mr-2 h-4 w-4" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
