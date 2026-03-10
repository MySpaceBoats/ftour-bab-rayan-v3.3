import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Percent,
  Pencil,
  Trash2,
  Link2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type ReservationType = "all" | "particulier" | "entreprise" | "groupe";
type ReservationStatus =
  | "all"
  | "pending_validation"
  | "validated_pending_payment"
  | "pending_deposit"
  | "deposit_submitted"
  | "deposit_received"
  | "paid_confirmed"
  | "confirmed"
  | "refused"
  | "cancelled"
  | "completed"
  | "no_show";

type ManualStatus =
  | "validated_pending_payment"
  | "pending_deposit"
  | "deposit_submitted"
  | "deposit_received"
  | "paid_confirmed"
  | "refused"
  | "completed";

const getDisplayChoiceOptions = (type: string) => {
  const baseOptions = [{ value: 'jardin', label: 'Pavillon du Jardin' }];

  if (type === 'entreprise') {
    return [...baseOptions, { value: 'corpo', label: 'Salon Palmier' }];
  }

  return [...baseOptions, { value: 'brasserie', label: 'Salon Palmier' }];
};

export default function AdminRestaurantReservations() {
  const [typeFilter, setTypeFilter] = useState<ReservationType>("all");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [depositInput, setDepositInput] = useState<string>("");
  const [manualStatus, setManualStatus] = useState<ManualStatus>(
    "validated_pending_payment"
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [downloadingProofId, setDownloadingProofId] = useState<number | null>(null);
  const [generatingLinkId, setGeneratingLinkId] = useState<number | null>(null);
  const [generatedLink, setGeneratedLink] = useState<{ id: number; url: string } | null>(null);
  const [editForm, setEditForm] = useState<{
    id: number;
    name: string;
    email: string;
    phone: string;
    date: string;
    seatsTotal: number;
    notes: string;
    companyName: string;
    groupName: string;
    displayChoice: string;
    type: string;
  } | null>(null);

  const trpcUtils = trpc.useUtils();

  // Fetch reservations via restaurantReservations router
  const {
    data: reservations = [],
    isLoading,
    isError: hasError,
    refetch: refetchReservations,
  } = trpc.restaurantReservations.adminListAll.useQuery(undefined, {
    retry: 1,
  });

  const refetchAll = () => {
    refetchReservations();
  };

  // Combine all reservations
  const allReservations = useMemo(() => {
    const all = reservations.map((r: any) => ({
      ...r,
      type:
        r.type === "particulier" || r.type === "entreprise" || r.type === "groupe"
          ? r.type
          : "particulier",
    }));
    return all.sort((a: any, b: any) => {
      const reservationDateA = a.date ? new Date(a.date).getTime() : 0;
      const reservationDateB = b.date ? new Date(b.date).getTime() : 0;

      if (reservationDateA !== reservationDateB) {
        return reservationDateA - reservationDateB;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reservations]);

  // Filter reservations
  const filteredReservations = useMemo(() => {
    return allReservations.filter((res: any) => {
      const matchesType = typeFilter === "all" || res.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || res.status === statusFilter;
      const text =
        `${res.reference} ${res.name} ${res.email} ${res.phone} ${res.groupName || ""} ${res.companyName || ""}`.toLowerCase();
      const matchesSearch =
        searchQuery === "" || text.includes(searchQuery.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [allReservations, typeFilter, statusFilter, searchQuery]);

  const selectedReservation = filteredReservations.find((res: any) => res.id === selectedId) || null;
  const displayChoiceOptions = editForm ? getDisplayChoiceOptions(editForm.type) : [];

  useEffect(() => {
    if (!selectedReservation) {
      return;
    }

    if (
      selectedReservation.status === "validated_pending_payment" ||
      selectedReservation.status === "pending_deposit" ||
      selectedReservation.status === "deposit_submitted" ||
      selectedReservation.status === "deposit_received" ||
      selectedReservation.status === "paid_confirmed" ||
      selectedReservation.status === "refused" ||
      selectedReservation.status === "completed"
    ) {
      setManualStatus(selectedReservation.status);
      return;
    }

    setManualStatus("validated_pending_payment");
  }, [selectedReservation]);

  // Validate reservation
  const validateMutation = trpc.restaurantReservations.validate.useMutation({
    onSuccess: () => {
      toast.success("Réservation validée, email de confirmation envoyé");
      setSelectedId(null);
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la validation");
    },
  });

  // Refuse reservation
  const refuseMutation = trpc.restaurantReservations.refuse.useMutation({
    onSuccess: () => {
      toast.success("Réservation refusée, email de notification envoyé");
      setSelectedId(null);
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors du refus");
    },
  });

  // Update status
  const updateStatusMutation =
    trpc.restaurantReservations.adminUpdateStatus.useMutation({
      onSuccess: () => {
        toast.success("Statut mis à jour");
        setSelectedId(null);
        refetchAll();
      },
      onError: (error: any) => {
        toast.error(error.message || "Erreur lors de la mise à jour");
      },
    });

  // Update deposit percentage
  const depositMutation =
    trpc.restaurantReservations.adminUpdateDepositPercentage.useMutation({
      onSuccess: () => {
        toast.success("Pourcentage d'acompte mis à jour, statut ajusté");
        setDepositInput("");
        refetchAll();
      },
      onError: (error: any) => {
        toast.error(error.message || "Erreur lors de la mise à jour");
      },
    });

  // Edit reservation
  const editMutation = trpc.restaurantReservations.adminEdit.useMutation({
    onSuccess: () => {
      toast.success("Réservation modifiée avec succès");
      setEditDialogOpen(false);
      setEditForm(null);
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la modification");
    },
  });

  const deleteMutation = trpc.restaurantReservations.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("Réservation supprimée");
      setSelectedId(null);
      refetchAll();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  const openEditDialog = (res: any) => {
    setEditForm({
      id: res.id,
      name: res.name || "",
      email: res.email || "",
      phone: res.phone || "",
      date: res.date ? new Date(res.date).toISOString().split("T")[0] : "",
      seatsTotal: res.seatsTotal || 0,
      notes: res.notes || "",
      companyName: res.companyName || "",
      groupName: res.groupName || "",
      displayChoice: res.displayChoice || "",
      type: res.type || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editForm) return;
    editMutation.mutate({
      id: editForm.id,
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      date: editForm.date,
      seatsTotal: editForm.seatsTotal,
      notes: editForm.notes,
      companyName: editForm.companyName || undefined,
      groupName: editForm.groupName || undefined,
      displayChoice: editForm.displayChoice || undefined,
    });
  };

  const handleDepositUpdate = (id: number) => {
    const pct = parseInt(depositInput, 10);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Veuillez entrer un pourcentage entre 0 et 100");
      return;
    }
    depositMutation.mutate({ id, percentage: pct });
  };

  const handleValidate = (reference: string) => {
    validateMutation.mutate({
      reference,
      baseUrl: window.location.origin,
    });
  };

  const handleRefuse = (reference: string) => {
    refuseMutation.mutate({ reference });
  };

  const handleDelete = (reservation: any) => {
    const label =
      reservation.groupName ||
      reservation.companyName ||
      reservation.name ||
      reservation.reference;
    const confirmed = window.confirm(
      `Supprimer définitivement la réservation ${reservation.reference} (${label}) ?`
    );
    if (!confirmed) return;
    deleteMutation.mutate({ id: reservation.id });
  };

  const handleDownloadProof = async (reservationId: number) => {
    try {
      setDownloadingProofId(reservationId);
      const result = await trpcUtils.client.restaurantReservations.adminGetLatestProofUrl.query({
        reservationId,
      });

      if (!result?.signedUrl) {
        toast.error("Aucune preuve de virement trouvée");
        return;
      }

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error?.message || "Impossible de récupérer la preuve de virement");
    } finally {
      setDownloadingProofId(null);
    }
  };

  const handleGenerateProofLink = async (reservationId: number) => {
    try {
      setGeneratingLinkId(reservationId);
      setGeneratedLink(null);
      const result = await trpcUtils.client.restaurantReservations.adminGenerateProofLink.mutate({ reservationId });
      setGeneratedLink({ id: reservationId, url: result.proofUploadUrl });
      toast.success(`Lien généré pour ${result.reservationRef}`);
    } catch (error: any) {
      toast.error(error?.message || "Impossible de générer le lien");
    } finally {
      setGeneratingLinkId(null);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => toast.success("Lien copié")).catch(() => toast.error("Impossible de copier"));
  };

  const exportCsv = () => {
    if (filteredReservations.length === 0) {
      toast.error("Aucune réservation à exporter");
      return;
    }

    const header = [
      "Référence",
      "Type",
      "Statut",
      "Contact",
      "Email",
      "Téléphone",
      "Places",
      "Date Ftour",
      "Acompte %",
      "Créé le",
      "Notes",
    ];
    const rows = filteredReservations.map((res: any) => [
      res.reference,
      res.type,
      res.status,
      res.name,
      res.email || "",
      res.phone,
      res.seatsTotal || "-",
      res.date ? new Date(res.date).toLocaleDateString("fr-FR") : "-",
      res.depositPercentage || 0,
      res.createdAt ? new Date(res.createdAt).toLocaleString("fr-FR") : "-",
      (res.notes || "").replace(/\n/g, " "),
    ]);

    const csv = [header, ...rows]
      .map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reservations_restaurant_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success("Export CSV téléchargé");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_validation":
      case "submitted":
        return <Badge variant="outline">En attente</Badge>;
      case "validated_pending_payment":
      case "pending_confirmation":
      case "pending_deposit":
        return <Badge variant="secondary">Paiement attendu</Badge>;
      case "deposit_submitted":
        return <Badge className="bg-amber-600">Preuve déposée</Badge>;
      case "deposit_received":
        return <Badge className="bg-emerald-600">Acompte reçu</Badge>;
      case "paid_confirmed":
      case "confirmed":
        return <Badge className="bg-green-600">Confirmée</Badge>;
      case "refused":
      case "rejected":
        return <Badge variant="destructive">Refusée</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Annulée</Badge>;
      case "completed":
        return <Badge className="bg-emerald-600">Terminée</Badge>;
      case "no_show":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700">
            No show
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "particulier":
        return <Badge className="bg-blue-600">Particulier</Badge>;
      case "entreprise":
        return <Badge className="bg-purple-600">Entreprise</Badge>;
      case "groupe":
        return <Badge className="bg-orange-600">Groupe</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("fr-FR");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Réservations Restaurant</h1>
            <p className="text-xs text-muted-foreground">
              {filteredReservations.length} réservation(s)
            </p>
          </div>
        </div>
      </header>

      <main className="container py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Liste</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une réservation..."
                  className="pl-10"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={typeFilter === "all" ? "default" : "outline"}
                  onClick={() => setTypeFilter("all")}
                  size="sm"
                >
                  Tous
                </Button>
                <Button
                  variant={typeFilter === "entreprise" ? "default" : "outline"}
                  onClick={() => setTypeFilter("entreprise")}
                  size="sm"
                >
                  Entreprises
                </Button>
                <Button
                  variant={typeFilter === "groupe" ? "default" : "outline"}
                  onClick={() => setTypeFilter("groupe")}
                  size="sm"
                >
                  Groupes
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                  size="sm"
                >
                  Tous statuts
                </Button>
                <Button
                  variant={
                    statusFilter === "pending_validation"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setStatusFilter("pending_validation")}
                  size="sm"
                >
                  En attente
                </Button>
                <Button
                  variant={
                    statusFilter === "validated_pending_payment"
                      ? "default"
                      : "outline"
                  }
                  onClick={() => setStatusFilter("validated_pending_payment")}
                  size="sm"
                >
                  Paiement attendu
                </Button>
                <Button
                  variant={
                    statusFilter === "deposit_submitted" ? "default" : "outline"
                  }
                  onClick={() => setStatusFilter("deposit_submitted")}
                  size="sm"
                >
                  Preuve déposée
                </Button>
                <Button
                  variant={
                    statusFilter === "deposit_received" ? "default" : "outline"
                  }
                  onClick={() => setStatusFilter("deposit_received")}
                  size="sm"
                >
                  Acompte reçu
                </Button>
                <Button
                  variant={
                    statusFilter === "paid_confirmed" ? "default" : "outline"
                  }
                  onClick={() => setStatusFilter("paid_confirmed")}
                  size="sm"
                >
                  Confirmées
                </Button>
                <Button
                  variant={statusFilter === "refused" ? "default" : "outline"}
                  onClick={() => setStatusFilter("refused")}
                  size="sm"
                >
                  Refusées
                </Button>
              </div>

              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : hasError ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-red-600 font-medium">
                  Erreur lors du chargement des réservations
                </p>
                <Button variant="outline" onClick={refetchAll}>
                  Réessayer
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReservations.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucune réservation trouvée.
                  </p>
                )}

                {filteredReservations.map((res: any) => (
                  <button
                    key={`${res.type}-${res.id}`}
                    onClick={() => setSelectedId(res.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedId === res.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-medium">{res.reference}</p>
                      <div className="flex gap-1">
                        {getTypeBadge(res.type)}
                        {getStatusBadge(res.status)}
                      </div>
                    </div>
                    {(res.groupName || res.companyName) && (
                      <p className="text-sm font-medium">
                        {res.groupName || res.companyName}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {res.name} {res.email ? `• ${res.email}` : ""}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">
                        {res.seatsTotal || 0} places
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        • Ftour {formatDate(res.date)} • Créé{" "}
                        {formatDate(res.createdAt)}
                      </span>
                      {res.depositPercentage > 0 && (
                        <span
                          className={`ml-2 font-medium ${res.depositPercentage >= 100 ? "text-green-600" : "text-amber-600"}`}
                        >
                          • Acompte {res.depositPercentage}%
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détail</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedReservation && (
              <p className="text-sm text-muted-foreground">
                Sélectionnez une réservation.
              </p>
            )}
            {selectedReservation && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Référence</p>
                  <p className="font-semibold">
                    {selectedReservation.reference}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    {getTypeBadge(selectedReservation.type)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Statut</p>
                    {getStatusBadge(selectedReservation.status)}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="font-medium">{selectedReservation.name}</p>
                  <p className="text-sm">{selectedReservation.email}</p>
                  <p className="text-sm">{selectedReservation.phone}</p>
                </div>

                {(selectedReservation.companyName ||
                  selectedReservation.groupName) && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Entreprise/Groupe
                    </p>
                    <p className="font-medium">
                      {selectedReservation.companyName ||
                        selectedReservation.groupName}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Places</p>
                    <p className="font-medium">
                      {selectedReservation.seatsTotal || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date Ftour</p>
                    <p className="font-medium">
                      {formatDate(selectedReservation.date)}
                    </p>
                  </div>
                </div>

                {selectedReservation.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <Textarea
                      value={selectedReservation.notes}
                      readOnly
                      className="min-h-[80px]"
                    />
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openEditDialog(selectedReservation)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Modifier la réservation
                </Button>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleDelete(selectedReservation)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Effacer la réservation
                </Button>

                {(selectedReservation.latestPaymentProofPath ||
                  selectedReservation.status === "deposit_submitted" ||
                  selectedReservation.status === "deposit_received") && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownloadProof(selectedReservation.id)}
                    disabled={downloadingProofId === selectedReservation.id}
                  >
                    {downloadingProofId === selectedReservation.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Télécharger preuve de virement
                  </Button>
                )}

                {/* Generate proof upload link */}
                {!["refused", "cancelled", "paid_confirmed", "completed"].includes(
                  selectedReservation.status
                ) && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleGenerateProofLink(selectedReservation.id)}
                      disabled={generatingLinkId === selectedReservation.id}
                    >
                      {generatingLinkId === selectedReservation.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Générer lien de dépôt de preuve
                    </Button>
                    {generatedLink?.id === selectedReservation.id && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
                        <p className="text-xs font-medium text-green-800">Lien généré (valide 7 jours) :</p>
                        <p className="break-all text-xs text-green-700 font-mono">{generatedLink.url}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => handleCopyLink(generatedLink.url)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copier le lien
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Deposit percentage section */}
                {!["refused", "cancelled"].includes(
                  selectedReservation.status
                ) && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground">
                      Acompte reçu
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              (selectedReservation.depositPercentage || 0) >=
                              100
                                ? "bg-green-600"
                                : (selectedReservation.depositPercentage || 0) >
                                    0
                                  ? "bg-amber-500"
                                  : "bg-gray-400"
                            }`}
                            style={{
                              width: `${Math.min(selectedReservation.depositPercentage || 0, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-semibold min-w-[40px] text-right">
                        {selectedReservation.depositPercentage || 0}%
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="0-100"
                        value={depositInput}
                        onChange={e => setDepositInput(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleDepositUpdate(selectedReservation.id)
                        }
                        disabled={depositMutation.isPending || !depositInput}
                      >
                        <Percent className="h-3 w-3 mr-1" />
                        Mettre à jour
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(selectedReservation.depositPercentage || 0) >= 100
                        ? "Acompte complet - réservation confirmée"
                        : (selectedReservation.depositPercentage || 0) > 0
                          ? "Acompte partiel - en attente du solde"
                          : "Aucun acompte reçu"}
                    </p>
                  </div>
                )}

                {(selectedReservation.status === "pending_validation" ||
                  selectedReservation.status === "submitted") && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        handleValidate(selectedReservation.reference)
                      }
                      disabled={validateMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Valider
                    </Button>
                    <Button
                      onClick={() =>
                        handleRefuse(selectedReservation.reference)
                      }
                      disabled={refuseMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Refuser
                    </Button>
                  </div>
                )}

                {[
                  "validated_pending_payment",
                  "pending_confirmation",
                  "pending_deposit",
                  "deposit_submitted",
                  "deposit_received",
                  "paid_confirmed",
                  "confirmed",
                ].includes(selectedReservation.status) && (
                  <Button
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: selectedReservation.id,
                        status: "completed",
                      })
                    }
                    disabled={updateStatusMutation.isPending}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marquer terminée
                  </Button>
                )}

                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">
                    Changement manuel du statut
                  </p>
                  <div className="flex gap-2">
                    <Select
                      value={manualStatus}
                      onValueChange={value =>
                        setManualStatus(value as ManualStatus)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choisir un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="validated_pending_payment">
                          Paiement attendu
                        </SelectItem>
                        <SelectItem value="pending_deposit">
                          En attente acompte
                        </SelectItem>
                        <SelectItem value="deposit_submitted">
                          Preuve déposée
                        </SelectItem>
                        <SelectItem value="deposit_received">
                          Acompte reçu
                        </SelectItem>
                        <SelectItem value="paid_confirmed">Confirmée</SelectItem>
                        <SelectItem value="refused">Refusée</SelectItem>
                        <SelectItem value="completed">Terminée</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: selectedReservation.id,
                          status: manualStatus,
                        })
                      }
                      disabled={
                        updateStatusMutation.isPending ||
                        selectedReservation.status === manualStatus
                      }
                    >
                      Appliquer
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit reservation dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la réservation</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nom du contact</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={e =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={e =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={e =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-date">Date du Ftour</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={e =>
                    setEditForm({ ...editForm, date: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-seats">Nombre de places</Label>
                <Input
                  id="edit-seats"
                  type="number"
                  min={1}
                  value={editForm.seatsTotal}
                  onChange={e =>
                    setEditForm({
                      ...editForm,
                      seatsTotal: parseInt(e.target.value, 10) || 0,
                    })
                  }
                />
              </div>

              {editForm.type === "entreprise" && (
                <div>
                  <Label htmlFor="edit-company">Nom de l'entreprise</Label>
                  <Input
                    id="edit-company"
                    value={editForm.companyName}
                    onChange={e =>
                      setEditForm({ ...editForm, companyName: e.target.value })
                    }
                  />
                </div>
              )}

              {editForm.type === "groupe" && (
                <div>
                  <Label htmlFor="edit-group">Nom du groupe</Label>
                  <Input
                    id="edit-group"
                    value={editForm.groupName}
                    onChange={e =>
                      setEditForm({ ...editForm, groupName: e.target.value })
                    }
                  />
                </div>
              )}

              <div>
                <Label htmlFor="edit-display">Salle</Label>
                <Select
                  value={editForm.displayChoice}
                  onValueChange={value =>
                    setEditForm({ ...editForm, displayChoice: value })
                  }
                >
                  <SelectTrigger id="edit-display">
                    <SelectValue placeholder="Choisir une salle" />
                  </SelectTrigger>
                  <SelectContent>
                    {displayChoiceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={e =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  className="min-h-[80px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleEditSubmit}
                  disabled={editMutation.isPending}
                  className="flex-1"
                >
                  {editMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
