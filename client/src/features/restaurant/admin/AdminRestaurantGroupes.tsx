import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  UsersRound,
  Users,
  CreditCard,
  Trash2,
  Pencil,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";

type SortDirection = "asc" | "desc";
type SortKey =
  | "reference"
  | "type"
  | "groupOrCompany"
  | "contact"
  | "seatsTotal"
  | "date"
  | "status"
  | "createdAt";

export default function AdminRestaurantGroupes() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({
    key: "createdAt",
    direction: "desc",
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: "groupe",
    groupOrCompanyName: "",
    contactName: "",
    email: "",
    phone: "",
    date: "",
    seatsTotal: 2,
    notes: "",
    displayChoice: "jardin",
    status: "pending_validation",
  });
  const [editForm, setEditForm] = useState<{
    id: number;
    name: string;
    email: string;
    phone: string;
    date: string;
    seatsTotal: number;
    notes: string;
    totalAmount: number;
    amountReceived: number;
    companyName: string;
    groupName: string;
    type: string;
  } | null>(null);

  const allowedRoles = ["admin", "super_admin", "admin_restaurant"];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  const {
    data: groupes,
    isLoading: loadingG,
    isError: errorG,
    error: errorGroupes,
    refetch: refetchG,
  } = trpc.restaurantReservations.adminListGroupes.useQuery(undefined, {
    enabled: !!hasAccess,
    retry: 1,
  });

  const {
    data: entreprises,
    isLoading: loadingE,
    isError: errorE,
    error: errorEntreprises,
    refetch: refetchE,
  } = trpc.restaurantReservations.adminListEntreprises.useQuery(undefined, {
    enabled: !!hasAccess,
    retry: 1,
  });

  const isLoading = loadingG || loadingE;
  const isError = errorG || errorE;
  const error = errorGroupes || errorEntreprises;

  const reservations = [
    ...(groupes || []).map((r: any) => ({ ...r, type: r.type || "groupe" })),
    ...(entreprises || []).map((r: any) => ({
      ...r,
      type: r.type || "entreprise",
    })),
  ];

  const refetch = () => {
    refetchG();
    refetchE();
  };

  const validateMutation = trpc.restaurantReservations.validate.useMutation({
    onSuccess: () => {
      toast.success("Réservation validée, email de confirmation envoyé");
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const refuseMutation = trpc.restaurantReservations.refuse.useMutation({
    onSuccess: () => {
      toast.success("Réservation refusée, email de notification envoyé");
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation =
    trpc.restaurantReservations.adminUpdateStatus.useMutation({
      onSuccess: () => {
        toast.success("Statut mis à jour");
        refetch();
      },
      onError: error => {
        toast.error(error.message);
      },
    });

  const deleteMutation = trpc.restaurantReservations.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("Réservation supprimée");
      refetch();
    },
    onError: error => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  const editMutation = trpc.restaurantReservations.adminEdit.useMutation({
    onSuccess: () => {
      toast.success("Réservation modifiée avec succès");
      setEditDialogOpen(false);
      setEditForm(null);
      refetch();
    },
    onError: error => {
      toast.error(error.message || "Erreur lors de la modification");
    },
  });

  const createManualMutation =
    trpc.restaurantReservations.adminCreateManual.useMutation({
      onSuccess: () => {
        toast.success("Réservation ajoutée manuellement");
        setCreateDialogOpen(false);
        setCreateForm({
          type: "groupe",
          groupOrCompanyName: "",
          contactName: "",
          email: "",
          phone: "",
          date: "",
          seatsTotal: 2,
          notes: "",
          displayChoice: "jardin",
          status: "pending_validation",
        });
        refetch();
      },
      onError: error => {
        toast.error(error.message || "Erreur lors de la création manuelle");
      },
    });

  const openEditDialog = (reservation: any) => {
    setEditForm({
      id: reservation.id,
      name: reservation.name || "",
      email: reservation.email || "",
      phone: reservation.phone || "",
      date: reservation.date
        ? new Date(reservation.date).toISOString().split("T")[0]
        : "",
      seatsTotal: reservation.seatsTotal || 0,
      notes: reservation.notes || "",
      totalAmount: Number(reservation.totalAmount || 0),
      amountReceived: Number(reservation.amountReceived || 0),
      companyName: reservation.companyName || "",
      groupName: reservation.groupName || "",
      type: reservation.type || "",
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
      totalAmount: editForm.totalAmount,
      amountReceived: editForm.amountReceived,
      companyName: editForm.companyName || undefined,
      groupName: editForm.groupName || undefined,
    });
  };

  const handleDeleteReservation = (reservation: any) => {
    const name =
      reservation.groupName ||
      reservation.companyName ||
      reservation.name ||
      reservation.reference;
    const confirmed = window.confirm(
      `Supprimer définitivement la réservation ${reservation.reference} (${name}) ?`
    );
    if (!confirmed) return;
    deleteMutation.mutate({ id: reservation.id });
  };

  const handleCreateManualReservation = () => {
    if (
      !createForm.groupOrCompanyName ||
      !createForm.contactName ||
      !createForm.email ||
      !createForm.phone ||
      !createForm.date
    ) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    createManualMutation.mutate({
      ...createForm,
      type: createForm.type as "groupe" | "entreprise",
      displayChoice: createForm.displayChoice as "jardin" | "brasserie",
      status: createForm.status as
        | "pending_validation"
        | "validated_pending_payment"
        | "paid_confirmed",
    });
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <Users className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les droits pour accéder aux réservations groupes.
            </p>
            <Link href="/admin">
              <Button variant="outline">Retour au dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSortValue = (reservation: any, key: SortKey) => {
    switch (key) {
      case "reference":
        return reservation.reference || "";
      case "type":
        return reservation.type || "";
      case "groupOrCompany":
        return reservation.groupName || reservation.companyName || "";
      case "contact":
        return reservation.name || "";
      case "seatsTotal":
        return Number(reservation.seatsTotal) || 0;
      case "date":
        return reservation.date ? new Date(reservation.date).getTime() : 0;
      case "status":
        return reservation.status || "";
      case "createdAt":
        return reservation.createdAt
          ? new Date(reservation.createdAt).getTime()
          : 0;
      default:
        return "";
    }
  };

  const filteredReservations = useMemo(() => {
    const filtered = reservations?.filter((r: any) => {
      const matchesSearch =
        searchQuery === "" ||
        r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.groupName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reference?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a: any, b: any) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      let comparison = 0;
      if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue), "fr", {
          sensitivity: "base",
        });
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [reservations, searchQuery, statusFilter, sortConfig]);

  const toggleSort = (key: SortKey) => {
    setSortConfig(current => {
      if (current.key === key) {
        return {
          ...current,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return { key, direction: "asc" };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;
    }

    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_validation":
      case "submitted":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            <Clock className="h-3 w-3 mr-1" />
            En attente
          </Badge>
        );
      case "validated_pending_payment":
      case "pending_confirmation":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            <CreditCard className="h-3 w-3 mr-1" />
            Paiement attendu
          </Badge>
        );
      case "paid_confirmed":
      case "confirmed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirmée
          </Badge>
        );
      case "refused":
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Refusée
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Annulée
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-emerald-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Terminée
          </Badge>
        );
      case "no_show":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700">
            No show
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("fr-FR");
  };

  const formatAmount = (value: number) => `${value.toFixed(2)} DH`;

  const getRemainingAmount = (reservation: any) => {
    const total = Number(reservation.totalAmount || 0);
    const received = Number(reservation.amountReceived || 0);
    return Math.max(0, total - received);
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
            <h1 className="font-bold text-lg flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-[#5d5a3c]" />
              Réservations Groupes ou Entreprises
            </h1>
            <p className="text-xs text-muted-foreground">
              {filteredReservations?.length || 0} réservation(s) - soumises à
              confirmation
            </p>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (groupe, contact, référence)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending_validation">En attente</SelectItem>
              <SelectItem value="validated_pending_payment">
                Paiement attendu
              </SelectItem>
              <SelectItem value="paid_confirmed">Confirmée</SelectItem>
              <SelectItem value="refused">Refusée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
              <SelectItem value="no_show">No show</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter manuellement
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-red-600 font-medium">
                Erreur lors du chargement des réservations
              </p>
              <p className="text-sm text-muted-foreground">
                {error?.message || "Erreur inconnue"}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("reference")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Référence
                        {renderSortIcon("reference")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("type")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Type
                        {renderSortIcon("type")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("groupOrCompany")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Groupe / Entreprise
                        {renderSortIcon("groupOrCompany")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("contact")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Contact
                        {renderSortIcon("contact")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("seatsTotal")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Places
                        {renderSortIcon("seatsTotal")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("date")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Date ftour
                        {renderSortIcon("date")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Statut
                        {renderSortIcon("status")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("createdAt")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Créé le
                        {renderSortIcon("createdAt")}
                      </button>
                    </TableHead>
                    <TableHead>Montant total</TableHead>
                    <TableHead>Montant reçu</TableHead>
                    <TableHead>Montant restant</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={12}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Aucune réservation trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReservations?.map((r: any) => (
                      <TableRow key={`${r.type}-${r.id}`}>
                        <TableCell className="font-mono text-sm">
                          {r.reference}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              r.type === "groupe"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            }
                          >
                            {r.type === "groupe" ? "Groupe" : "Entreprise"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {r.groupName || r.companyName || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.phone}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.email}
                          </div>
                        </TableCell>
                        <TableCell>{r.seatsTotal}</TableCell>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell>
                          {formatAmount(Number(r.totalAmount || 0))}
                        </TableCell>
                        <TableCell>
                          {formatAmount(Number(r.amountReceived || 0))}
                        </TableCell>
                        <TableCell>{formatAmount(getRemainingAmount(r))}</TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(r.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(r.status === "pending_validation" ||
                              r.status === "submitted") && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600"
                                  onClick={() =>
                                    validateMutation.mutate({
                                      reference: r.reference,
                                      baseUrl: window.location.origin,
                                    })
                                  }
                                  disabled={validateMutation.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Valider
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() =>
                                    refuseMutation.mutate({
                                      reference: r.reference,
                                    })
                                  }
                                  disabled={refuseMutation.isPending}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Refuser
                                </Button>
                              </>
                            )}
                            {[
                              "validated_pending_payment",
                              "pending_confirmation",
                              "paid_confirmed",
                              "confirmed",
                            ].includes(r.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: r.id,
                                    status: "completed",
                                  })
                                }
                              >
                                Terminer
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(r)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Modifier
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteReservation(r)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Effacer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la réservation</DialogTitle>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom du contact</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={e =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
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

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={e =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-date">Date du ftour</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={e =>
                    setEditForm({ ...editForm, date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-seats">Nombre de places</Label>
                <Input
                  id="edit-seats"
                  type="number"
                  min={1}
                  value={editForm.seatsTotal}
                  onChange={e =>
                    setEditForm({
                      ...editForm,
                      seatsTotal: Math.max(
                        1,
                        parseInt(e.target.value || "1", 10)
                      ),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-total-amount">Montant total (DH)</Label>
                <Input
                  id="edit-total-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.totalAmount}
                  onChange={e =>
                    setEditForm({
                      ...editForm,
                      totalAmount: Math.max(
                        0,
                        Number.parseFloat(e.target.value || "0") || 0
                      ),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-amount-received">Montant reçu (DH)</Label>
                <Input
                  id="edit-amount-received"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.amountReceived}
                  onChange={e =>
                    setEditForm({
                      ...editForm,
                      amountReceived: Math.max(
                        0,
                        Number.parseFloat(e.target.value || "0") || 0
                      ),
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Montant restant (DH)</Label>
                <Input
                  value={Math.max(
                    0,
                    Number(editForm.totalAmount || 0) -
                      Number(editForm.amountReceived || 0)
                  ).toFixed(2)}
                  readOnly
                  disabled
                />
              </div>

              {editForm.type === "entreprise" && (
                <div className="space-y-2">
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
                <div className="space-y-2">
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

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={e =>
                    setEditForm({ ...editForm, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleEditSubmit}
                  disabled={editMutation.isPending}
                  className="flex-1"
                >
                  {editMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
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

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une réservation manuelle</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={createForm.type}
                onValueChange={value =>
                  setCreateForm({ ...createForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groupe">Groupe</SelectItem>
                  <SelectItem value="entreprise">Entreprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {createForm.type === "groupe"
                  ? "Nom du groupe"
                  : "Nom de l'entreprise"}
              </Label>
              <Input
                value={createForm.groupOrCompanyName}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    groupOrCompanyName: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Nom du contact</Label>
              <Input
                value={createForm.contactName}
                onChange={e =>
                  setCreateForm({ ...createForm, contactName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={e =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={createForm.phone}
                onChange={e =>
                  setCreateForm({ ...createForm, phone: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Date du ftour</Label>
              <Input
                type="date"
                value={createForm.date}
                onChange={e =>
                  setCreateForm({ ...createForm, date: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Nombre de places</Label>
              <Input
                type="number"
                min={2}
                value={createForm.seatsTotal}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    seatsTotal: Math.max(
                      2,
                      parseInt(e.target.value || "2", 10)
                    ),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Choix d'espace</Label>
              <Select
                value={createForm.displayChoice}
                onValueChange={value =>
                  setCreateForm({ ...createForm, displayChoice: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jardin">Jardin</SelectItem>
                  <SelectItem value="brasserie">Brasserie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Statut initial</Label>
              <Select
                value={createForm.status}
                onValueChange={value =>
                  setCreateForm({ ...createForm, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_validation">En attente</SelectItem>
                  <SelectItem value="validated_pending_payment">
                    Paiement attendu
                  </SelectItem>
                  <SelectItem value="paid_confirmed">Confirmée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={createForm.notes}
                onChange={e =>
                  setCreateForm({ ...createForm, notes: e.target.value })
                }
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCreateManualReservation}
                disabled={createManualMutation.isPending}
                className="flex-1"
              >
                {createManualMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
