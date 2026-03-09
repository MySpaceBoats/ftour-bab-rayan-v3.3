import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Users,
  Mail,
  UtensilsCrossed,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Send,
  Trash2,
  ArrowLeft,
  ChefHat,
} from "lucide-react";
import { Link } from "wouter";

// ============================================
// TYPES
// ============================================

type InvitationStatus = "pending" | "confirmed" | "declined";

const STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  declined: "Refusé",
};

const STATUS_COLORS: Record<InvitationStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  declined: "destructive",
};

const FOOD_TYPE_LABELS: Record<string, string> = {
  plats_sales: "Plats salés",
  plats_sucres: "Plats sucrés",
  boissons: "Boissons",
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function AdminFtour() {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [volunteerSearch, setVolunteerSearch] = useState("");
  const [inviteForm, setInviteForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    volunteerId: undefined as number | undefined,
  });

  // --- Données ---
  const { data: events = [], isLoading: eventsLoading } = trpc.ftour.listEvents.useQuery();

  const { data: invitations = [], refetch: refetchInvitations } = trpc.ftour.listInvitations.useQuery(
    { eventId: selectedEventId! },
    { enabled: selectedEventId !== null }
  );

  const { data: foodContributions = [], refetch: refetchContributions } = trpc.ftour.listFoodContributions.useQuery(
    { eventId: selectedEventId! },
    { enabled: selectedEventId !== null }
  );

  const { data: volunteerResults = [] } = trpc.ftour.searchVolunteers.useQuery(
    { query: volunteerSearch },
    { enabled: volunteerSearch.length >= 2 }
  );

  // --- Mutations ---
  const inviteMutation = trpc.ftour.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitation envoyée avec succès !");
      setShowInviteDialog(false);
      setInviteForm({ firstName: "", lastName: "", email: "", volunteerId: undefined });
      setVolunteerSearch("");
      refetchInvitations();
    },
    onError: (err) => {
      toast.error(err.message || "Erreur lors de l'envoi de l'invitation");
    },
  });

  const deleteMutation = trpc.ftour.deleteInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation supprimée");
      refetchInvitations();
      refetchContributions();
    },
    onError: (err) => {
      toast.error(err.message || "Erreur lors de la suppression");
    },
  });

  // --- Stats ---
  const totalInvited = invitations.length;
  const totalConfirmed = invitations.filter((i: any) => i.status === "confirmed").length;
  const totalPending = invitations.filter((i: any) => i.status === "pending").length;
  const totalDeclined = invitations.filter((i: any) => i.status === "declined").length;

  // Résumé contributions
  const contributionSummary: Record<string, Record<string, number>> = {};
  for (const c of foodContributions) {
    if (!contributionSummary[c.foodType]) contributionSummary[c.foodType] = {};
    contributionSummary[c.foodType][c.foodName] =
      (contributionSummary[c.foodType][c.foodName] ?? 0) + 1;
  }

  const handleSelectVolunteer = (v: any) => {
    setInviteForm({
      firstName: v.first_name,
      lastName: v.last_name,
      email: v.email,
      volunteerId: v.id,
    });
    setVolunteerSearch(`${v.first_name} ${v.last_name}`);
  };

  const handleSendInvitation = () => {
    if (!selectedEventId) return;
    if (!inviteForm.firstName || !inviteForm.lastName || !inviteForm.email) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    inviteMutation.mutate({
      eventId: selectedEventId,
      volunteerId: inviteForm.volunteerId,
      firstName: inviteForm.firstName,
      lastName: inviteForm.lastName,
      email: inviteForm.email,
    });
  };

  const selectedEvent = events.find((e: any) => e.id === selectedEventId);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ftour des bénévoles</h1>
          <p className="text-sm text-gray-500">Gestion des invitations et contributions culinaires</p>
        </div>
      </div>

      {/* Sélection de l'événement */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Sélectionner un événement</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucun événement ftour trouvé. Veuillez exécuter la migration SQL.
            </p>
          ) : (
            <Select
              value={selectedEventId?.toString() ?? ""}
              onValueChange={(v) => setSelectedEventId(Number(v))}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Choisir un événement…" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e: any) => (
                  <SelectItem key={e.id} value={e.id.toString()}>
                    {e.title} — {new Date(e.event_date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedEventId && selectedEvent && (
        <>
          {/* Info événement */}
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">📍 {selectedEvent.location}</p>
            <p className="text-sm text-green-700">
              📅{" "}
              {new Date(selectedEvent.event_date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs text-gray-500">Total invités</p>
                    <p className="text-2xl font-bold">{totalInvited}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">Confirmés</p>
                    <p className="text-2xl font-bold text-green-600">{totalConfirmed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="text-xs text-gray-500">En attente</p>
                    <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-xs text-gray-500">Refusés</p>
                    <p className="text-2xl font-bold text-red-600">{totalDeclined}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bouton inviter */}
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowInviteDialog(true)}>
              <Mail className="w-4 h-4 mr-2" />
              Inviter un bénévole
            </Button>
          </div>

          {/* Tableau 1 — Présences */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Présence des bénévoles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Aucune invitation envoyée pour cet événement.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Confirmation</TableHead>
                      <TableHead>Contribution</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv: any) => {
                      const contributions = inv.ftour_food_contributions ?? [];
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">
                            {inv.first_name} {inv.last_name}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_COLORS[inv.status as InvitationStatus]}>
                              {STATUS_LABELS[inv.status as InvitationStatus] ?? inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {inv.confirmed_at
                              ? new Date(inv.confirmed_at).toLocaleDateString("fr-FR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {contributions.length > 0 ? (
                              <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                                <ChefHat className="w-3 h-3 mr-1" />
                                Apport confirmé
                              </Badge>
                            ) : inv.status === "confirmed" ? (
                              <span className="text-sm text-gray-400">Sans apport</span>
                            ) : (
                              <span className="text-sm text-gray-300">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Supprimer cette invitation ?")) {
                                  deleteMutation.mutate({ id: inv.id });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Tableau 2 — Contributions culinaires */}
          {foodContributions.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  Contributions culinaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bénévole</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Plat</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Commentaire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {foodContributions.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.volunteerName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {FOOD_TYPE_LABELS[c.foodType] ?? c.foodType}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.foodName}</TableCell>
                        <TableCell className="text-sm text-gray-500">{c.quantity ?? "—"}</TableCell>
                        <TableCell className="text-sm text-gray-500">{c.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Résumé par catégorie */}
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Résumé des contributions
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(contributionSummary).map(([type, items]) => (
                      <div key={type} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
                          {FOOD_TYPE_LABELS[type] ?? type}
                        </p>
                        <ul className="space-y-1">
                          {Object.entries(items).map(([name, count]) => (
                            <li key={name} className="text-sm text-gray-700 flex justify-between">
                              <span>{name}</span>
                              <span className="font-medium text-gray-900">×{count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialog — Inviter un bénévole */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter un bénévole</DialogTitle>
            <DialogDescription>
              Recherchez un bénévole existant ou saisissez manuellement ses informations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Recherche bénévole */}
            <div>
              <Label htmlFor="vol-search">Rechercher un bénévole</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  id="vol-search"
                  placeholder="Nom, prénom ou email…"
                  className="pl-9"
                  value={volunteerSearch}
                  onChange={(e) => setVolunteerSearch(e.target.value)}
                />
              </div>
              {volunteerResults.length > 0 && volunteerSearch.length >= 2 && (
                <div className="mt-1 border rounded-md shadow-sm bg-white max-h-48 overflow-y-auto">
                  {volunteerResults.map((v: any) => (
                    <button
                      key={v.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                      onClick={() => handleSelectVolunteer(v)}
                    >
                      <span className="font-medium">{v.first_name} {v.last_name}</span>
                      <span className="ml-2 text-gray-500">{v.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Formulaire manuel */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Prénom"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Nom"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemple.com"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSendInvitation}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                "Envoi en cours…"
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer l'invitation
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
