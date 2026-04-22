import { useEffect, useMemo, useState } from "react";
import { Search, UserCheck, Heart, HandCoins, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoLayout } from "../components/DemoLayout";
import { formatDate, formatMAD, formatNumber } from "../components/utils";
import { useDemoData } from "../hooks/useDemoData";
import { updateDemoDataset } from "../data/store";
import type { DemoUser, UserRole } from "../data/types";

const ROLE_LABELS: Record<UserRole, string> = {
  benevole: "Bénévole",
  beneficiaire: "Bénéficiaire",
  donateur: "Donateur",
};

const ROLE_STYLES: Record<UserRole, string> = {
  benevole: "bg-sky-100 text-sky-700 ring-sky-200",
  beneficiaire: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  donateur: "bg-orange-100 text-orange-700 ring-orange-200",
};

export default function DemoUtilisateurs() {
  const data = useDemoData();
  const [tab, setTab] = useState<UserRole | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DemoUser | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.users.filter((u) => {
      if (tab !== "all" && u.role !== tab) return false;
      if (!q) return true;
      return (
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q)
      );
    });
  }, [data.users, tab, query]);

  const counts = useMemo(
    () => ({
      benevole: data.users.filter((u) => u.role === "benevole").length,
      beneficiaire: data.users.filter((u) => u.role === "beneficiaire").length,
      donateur: data.users.filter((u) => u.role === "donateur").length,
    }),
    [data.users],
  );

  const saveEdit = (updated: DemoUser) => {
    updateDemoDataset((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === updated.id ? updated : u)),
    }));
    toast.success("Utilisateur mis à jour", {
      description: "La fiche a été enregistrée.",
    });
    setSelected(null);
  };

  return (
    <DemoLayout
      title="Utilisateurs"
      subtitle="Bénévoles, bénéficiaires et donateurs — fiches détaillées"
      tooltip="Gérez les profils de chaque intervenant. Vos modifications restent dans votre espace d'aperçu."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryBox
          label="Bénévoles"
          value={counts.benevole}
          icon={<UserCheck className="h-5 w-5 text-sky-600" />}
        />
        <SummaryBox
          label="Bénéficiaires"
          value={counts.beneficiaire}
          icon={<Heart className="h-5 w-5 text-emerald-600" />}
        />
        <SummaryBox
          label="Donateurs"
          value={counts.donateur}
          icon={<HandCoins className="h-5 w-5 text-orange-600" />}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as UserRole | "all")}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="benevole">Bénévoles</TabsTrigger>
              <TabsTrigger value="beneficiaire">Bénéficiaires</TabsTrigger>
              <TabsTrigger value="donateur">Donateurs</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un nom, ville, email…"
              className="pl-9"
              aria-label="Rechercher un utilisateur"
            />
          </div>
        </div>

        <div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Rôle</th>
                    <th className="hidden px-4 py-3 md:table-cell">Contact</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Ville</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Inscrit le</th>
                    <th className="px-4 py-3 text-right">Activité</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 40).map((u) => (
                    <tr
                      key={u.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                      onClick={() => setSelected(u)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                            {u.avatar}
                          </span>
                          <div>
                            <div className="font-medium text-slate-900">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-xs text-slate-500 md:hidden">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`${ROLE_STYLES[u.role]} ring-1 ring-inset`}
                          variant="outline"
                        >
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <div className="text-slate-900">{u.email}</div>
                        <div className="text-xs text-slate-500">{u.phone}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-slate-700 lg:table-cell">
                        {u.city}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                        {formatDate(u.joinedAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {u.role === "benevole" && `${u.hours ?? 0} h`}
                        {u.role === "beneficiaire" && `${u.ftoursReceived ?? 0} ftours`}
                        {u.role === "donateur" && formatMAD(u.totalDonated ?? 0)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        Aucun utilisateur ne correspond à votre recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filtered.length > 40 && (
                <div className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-500">
                  Affichage des 40 premiers résultats sur {formatNumber(filtered.length)}.
                </div>
              )}
            </div>
        </div>
      </div>

      <UserDetailDialog
        user={selected}
        onClose={() => setSelected(null)}
        onSave={saveEdit}
      />
    </DemoLayout>
  );
}

function SummaryBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(value)}</p>
      </div>
      <div className="rounded-lg bg-slate-50 p-2">{icon}</div>
    </div>
  );
}

function UserDetailDialog({
  user,
  onClose,
  onSave,
}: {
  user: DemoUser | null;
  onClose: () => void;
  onSave: (u: DemoUser) => void;
}) {
  const [draft, setDraft] = useState<DemoUser | null>(user);

  useEffect(() => {
    setDraft(user);
  }, [user]);

  if (!user || !draft) return null;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
              {draft.avatar}
            </span>
            <div>
              <DialogTitle className="text-left">
                {draft.firstName} {draft.lastName}
              </DialogTitle>
              <p className="text-xs text-slate-500">{ROLE_LABELS[draft.role]}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Prénom">
            <Input
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            />
          </Field>
          <Field label="Nom">
            <Input
              value={draft.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <Field label="Téléphone">
            <Input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </Field>
          <Field label="Ville">
            <Input
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
          </Field>
          <Field label="Inscrit le">
            <Input value={formatDate(draft.joinedAt)} disabled />
          </Field>
        </div>

        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {draft.role === "benevole" && (
            <>
              <strong>{draft.hours ?? 0}</strong> heures de bénévolat ·
              <strong> {draft.missions ?? 0}</strong> missions.
            </>
          )}
          {draft.role === "beneficiaire" && (
            <>
              <strong>{draft.ftoursReceived ?? 0}</strong> ftours reçus · Foyer de{" "}
              <strong>{draft.familySize ?? 1}</strong> personnes.
            </>
          )}
          {draft.role === "donateur" && (
            <>
              <strong>{draft.donationsCount ?? 0}</strong> dons ·
              <strong> {formatMAD(draft.totalDonated ?? 0)}</strong> au total.
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" /> Annuler
          </Button>
          <Button onClick={() => onSave(draft)}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-600">{label}</Label>
      {children}
    </div>
  );
}
