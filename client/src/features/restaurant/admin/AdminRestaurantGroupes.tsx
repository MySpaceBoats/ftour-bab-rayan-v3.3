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
  Download,
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

const RESERVATION_RESPONSABLES = ["Nayla", "Hind", "Kamal", "Rita", "Réda", "Souad"] as const;
type ReservationResponsable = (typeof RESERVATION_RESPONSABLES)[number];

const manualDisplayChoiceOptions = [
  { value: "jardin", label: "Salle Pavillon du Jardin" },
  { value: "brasserie", label: "Salle Palmier" },
] as const;

const GROUPES_FALLBACK_RESERVATIONS = [
  { ref: "RES-G-51881B", date_ftour: "2026-02-24", responsable: "Rita", nb_adultes: 15, nb_enfants: 0, entreprise: "CONSULAT USA", prenom: "Fatima Zahra", nom: "Bentayebi", telephone: "0666969308", email: "bentayebif@stat.gov", total: 4350, deposit: 0, complement: 4500, mode_paiement: "CASH", date_paiement: "2026-02-24", reste_a_payer: -150, validation: true, observations: null },
  { ref: "RES-G-42646F", date_ftour: "2026-02-24", responsable: "Rita", nb_adultes: 29, nb_enfants: 0, entreprise: "Particulier/parrain", prenom: "Nawfal", nom: "Sabik", telephone: "33685797898", email: "sabiknawfal@gmail.com", total: 8410, deposit: 0, complement: 5690, mode_paiement: "CASH/TPE", date_paiement: "2026-02-24", reste_a_payer: 2720, validation: true, observations: null },
  { ref: "RES-G-116D81", date_ftour: "2026-02-24", responsable: "Rita", nb_adultes: 2, nb_enfants: 0, entreprise: "Particulier/parrain", prenom: "Mounji", nom: "Sefrioui", telephone: "0661135106", email: "mounji64@gmail.com", total: 580, deposit: 0, complement: 600, mode_paiement: "CASH", date_paiement: "2026-02-24", reste_a_payer: -20, validation: true, observations: null },
  { ref: "RES-G-4BAC05", date_ftour: "2026-02-24", responsable: "Kamal", nb_adultes: 4, nb_enfants: 0, entreprise: "Particulier/parrain", prenom: "Zineb", nom: "Ibnabdeljalil", telephone: "212666391647", email: "Zinebibn@gmail.com", total: 1160, deposit: 0, complement: 1160, mode_paiement: "VIREMENT", date_paiement: "2026-02-24", reste_a_payer: 0, validation: true, observations: null },
  { ref: "RES-G-27B7DE", date_ftour: "2026-02-25", responsable: "Hind", nb_adultes: 32, nb_enfants: 0, entreprise: "Particulier/parrain", prenom: "Amina", nom: "Benghalem", telephone: "0661329263", email: "aminabenghalem@yahoo.fr", total: 9280, deposit: 3500, complement: 5780, mode_paiement: "VIREMENT/TPE", date_paiement: "2026-02-23", reste_a_payer: 0, validation: true, observations: null },
  { ref: "RES-G-1F22C8", date_ftour: "2026-02-26", responsable: "Rita", nb_adultes: 23, nb_enfants: 9, entreprise: "Particulier/parrain", prenom: "Saad", nom: "Meddoun", telephone: "0667070786", email: "saad.meddoun@gmail.com", total: 8380, deposit: 7420, complement: 960, mode_paiement: "VIREMENT/TPE", date_paiement: "2026-02-24", reste_a_payer: 0, validation: true, observations: null },
  { ref: "RES-G-A4FE32", date_ftour: "2026-02-26", responsable: "Kamal", nb_adultes: 2, nb_enfants: 0, entreprise: "Particulier", prenom: "Rachel", nom: "Wong", telephone: "14048349386", email: "beingrachely@gmail.com", total: 580, deposit: 0, complement: 580, mode_paiement: "TPE", date_paiement: "2026-02-26", reste_a_payer: 0, validation: true, observations: null },
  { ref: "RES-G-6CBF34", date_ftour: "2026-02-27", responsable: "Nayla", nb_adultes: 6, nb_enfants: 0, entreprise: "Particulier", prenom: "Maha", nom: "Bennani", telephone: "212661260230", email: "maha.bennani1@gmail.com", total: 1740, deposit: 870, complement: 800, mode_paiement: "VIREMENT", date_paiement: null, reste_a_payer: 70, validation: true, observations: null },
  { ref: "RES-G-76509E", date_ftour: "2026-02-27", responsable: "Hind", nb_adultes: 7, nb_enfants: 0, entreprise: "Think ONE GROUP", prenom: "Mariam", nom: "Lahlou", telephone: "666889434", email: "mariem.lahlou@thinkonegroup.com", total: 2030, deposit: 1015, complement: 1015, mode_paiement: "TPE", date_paiement: null, reste_a_payer: 0, validation: true, observations: null },
  { ref: "RES-G-EC2D5E", date_ftour: "2026-02-27", responsable: "Rita", nb_adultes: 33, nb_enfants: 0, entreprise: "NUMU", prenom: "Myriem", nom: "Kadmiri", telephone: "212661403303", email: "Myriamk@numu.ma", total: 9570, deposit: 6000, complement: 3570, mode_paiement: null, date_paiement: null, reste_a_payer: 0, validation: true, observations: null },
  { ref: "RES-G-8C0128", date_ftour: "2026-02-28", responsable: "Rita", nb_adultes: 14, nb_enfants: 0, entreprise: "CHEF STEPHANE", prenom: "Stephane", nom: "Pierre", telephone: "0636081741", email: "stephane.pierre60@yahoo.com", total: 4060, deposit: 7250, complement: null, mode_paiement: "VIREMENT", date_paiement: null, reste_a_payer: 3990, validation: true, observations: "devait être 25" },
  { ref: "RES-G-4A1CCF", date_ftour: "2026-03-03", responsable: "Rita", nb_adultes: 10, nb_enfants: 0, entreprise: "WEBRAND", prenom: "Réda", nom: "Essakali", telephone: "0665100181", email: "reda.essakalli@we-brand.ma", total: 2900, deposit: null, complement: null, mode_paiement: null, date_paiement: null, reste_a_payer: null, validation: null, observations: null },
  { ref: "RES-G-34890F", date_ftour: "2026-03-04", responsable: "Rita", nb_adultes: 23, nb_enfants: 0, entreprise: "STANLEY FIELD", prenom: "Louloi", nom: "Bargach", telephone: "0679330972", email: "lbargach@stanleyfield.com", total: 6670, deposit: null, complement: null, mode_paiement: null, date_paiement: null, reste_a_payer: null, validation: null, observations: null },
  { ref: "RES-G-FBF46B", date_ftour: "2026-03-05", responsable: "Hind", nb_adultes: 40, nb_enfants: 0, entreprise: "MONTESSORI", prenom: "Hind", nom: "Ratibe", telephone: null, email: "ratibehind3@gmail.com", total: 11600, deposit: null, complement: null, mode_paiement: null, date_paiement: null, reste_a_payer: null, validation: null, observations: null },
  { ref: "RES-G-528B61", date_ftour: "2026-03-06", responsable: "Hind", nb_adultes: 50, nb_enfants: 0, entreprise: "APG", prenom: null, nom: "JAIDI", telephone: "212661196435", email: "Jaidi.abdou@gmail.com", total: 14500, deposit: 7250, complement: null, mode_paiement: "VIREMENT", date_paiement: "2026-02-19", reste_a_payer: 7250, validation: true, observations: null },
  { ref: "RES-G-291031", date_ftour: "2026-03-06", responsable: "Kamal", nb_adultes: 20, nb_enfants: 0, entreprise: "Fatine Chafai", prenom: "Fatine", nom: "Chafai", telephone: "212684969618", email: "Fatine.chafai@gmail.com", total: 5800, deposit: null, complement: null, mode_paiement: null, date_paiement: null, reste_a_payer: null, validation: null, observations: null },
  { ref: "RES-G-2DBDB8", date_ftour: "2026-03-07", responsable: "Rita", nb_adultes: 103, nb_enfants: 0, entreprise: "CRÉDIT AGRICOLE", prenom: "Jihane", nom: "LoukilI", telephone: "0629069735", email: "jihane.loukili@creditagricole.ma", total: 30900, deposit: 30000, complement: null, mode_paiement: null, date_paiement: null, reste_a_payer: 900, validation: true, observations: null },
  { ref: "RES-G-ADD271", date_ftour: "2026-03-10", responsable: "Kamal", nb_adultes: 15, nb_enfants: 0, entreprise: "CARE MAROC", prenom: "Fatima Zahra", nom: null, telephone: "0661675860", email: "baaoud@caremaroc.org", total: 4350, deposit: null, complement: null, mode_paiement: null, date_paiement: null, reste_a_payer: null, validation: null, observations: null },
  { ref: "RES-G-6B0C7E", date_ftour: "2026-03-11", responsable: "Hind", nb_adultes: 15, nb_enfants: 0, entreprise: "LAFARGE", prenom: "Lamia", nom: "Joundy", telephone: "0608892936", email: null, total: 4350, deposit: null, complement: null, mode_paiement: "PENDING", date_paiement: null, reste_a_payer: null, validation: null, observations: "Paiement prévu mercredi prochain" },
  { ref: "RES-G-E590FF", date_ftour: "2026-03-11", responsable: "Hind", nb_adultes: 35, nb_enfants: 0, entreprise: "Wavestone", prenom: "Hajar", nom: "Riane", telephone: "212665647713", email: "farah.berrada@wavestone.com", total: 10150, deposit: null, complement: null, mode_paiement: null, date_paiement: null, reste_a_payer: null, validation: null, observations: null },
] as const;

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
  const [downloadingProofId, setDownloadingProofId] = useState<number | null>(null);
  const trpcUtils = trpc.useUtils();
  const [createForm, setCreateForm] = useState({
    type: "groupe",
    groupOrCompanyName: "",
    contactName: "",
    email: "",
    phone: "",
    date: "",
    nbAdult: 2,
    nbKids: 0,
    totalAmount: 580,
    amountReceived: 0,
    deposit: 0,
    paymentMode: "cash",
    respResa: "Nayla" as ReservationResponsable,
    modeDeposit: "",
    dateAvReg: "",
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
    deposit: number;
    nbAdult: number;
    nbKids: number;
    paymentMode: "cash" | "virement" | "espece";
    respResa: ReservationResponsable;
    companyName: string;
    groupName: string;
    type: string;
    modeDeposit: string;
    dateAvReg: string;
  } | null>(null);

  const allowedRoles = ["admin", "super_admin", "admin_restaurant", "vue_restaurant", "manager_restaurant"];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  const {
    data: particuliers,
    isLoading: loadingP,
    isError: errorP,
    error: errorParticuliers,
    refetch: refetchP,
  } = trpc.restaurantReservations.adminListParticuliers.useQuery(undefined, {
    enabled: !!hasAccess,
    retry: 1,
  });

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

  const isLoading = loadingP || loadingG || loadingE;
  const isError = errorP || errorG || errorE;
  const error = errorParticuliers || errorGroupes || errorEntreprises;

  const fallbackReservations = GROUPES_FALLBACK_RESERVATIONS.map((r, index) => {
    const fullName = [r.prenom, r.nom].filter(Boolean).join(" ");
    const status =
      r.validation === true
        ? Number(r.reste_a_payer ?? 0) > 0
          ? "validated_pending_payment"
          : "paid_confirmed"
        : r.mode_paiement === "PENDING"
          ? "pending_confirmation"
          : "pending_validation";

    return {
      id: index + 1,
      type: "groupe",
      reference: r.ref,
      groupName: r.entreprise,
      name: fullName,
      email: r.email || "",
      phone: r.telephone || "",
      date: r.date_ftour,
      createdAt: r.date_ftour,
      seatsTotal: Number(r.nb_adultes) + Number(r.nb_enfants),
      nbAdult: Number(r.nb_adultes),
      nbKids: Number(r.nb_enfants),
      totalAmount: Number(r.total || 0),
      deposit: Number(r.deposit || 0),
      amountReceived: Number(r.complement || 0),
      paymentMode: (r.mode_paiement || "").includes("VIREMENT") ? "virement" : "cash",
      dateAvReg: r.date_paiement,
      respResa: r.responsable,
      status,
      notes: r.observations || "",
      modeDeposit: r.mode_paiement || "",
    };
  });

  const apiReservations = [
    ...(particuliers || []).map((r: any) => ({ ...r, type: r.type || "particulier" })),
    ...(groupes || []).map((r: any) => ({ ...r, type: r.type || "groupe" })),
    ...(entreprises || []).map((r: any) => ({
      ...r,
      type: r.type || "entreprise",
    })),
  ];

  const isUsingFallbackData = false;
  const reservations = apiReservations;

  const refetch = () => {
    refetchP();
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
          nbAdult: 2,
          nbKids: 0,
          totalAmount: 580,
          amountReceived: 0,
          deposit: 0,
          paymentMode: "cash",
          respResa: "Nayla" as ReservationResponsable,
          modeDeposit: "",
          dateAvReg: "",
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
      deposit: Number(reservation.deposit || 0),
      nbAdult: Number(reservation.nbAdult || 0),
      nbKids: Number(reservation.nbKids || 0),
      paymentMode: reservation.paymentMode || "cash",
      respResa: reservation.respResa || "Nayla",
      companyName: reservation.companyName || "",
      groupName: reservation.groupName || "",
      type: reservation.type || "",
      modeDeposit: reservation.modeDeposit || "",
      dateAvReg: reservation.dateAvReg
        ? new Date(reservation.dateAvReg).toISOString().split("T")[0]
        : "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editForm) return;
    const trimmedName = editForm.name.trim();
    const trimmedEmail = editForm.email.trim();
    const trimmedPhone = editForm.phone.trim();
    const trimmedCompanyName = editForm.companyName.trim();
    const trimmedGroupName = editForm.groupName.trim();

    editMutation.mutate({
      id: editForm.id,
      name: trimmedName || undefined,
      email: trimmedEmail || undefined,
      phone: trimmedPhone || undefined,
      date: editForm.date,
      seatsTotal: editForm.seatsTotal,
      notes: editForm.notes,
      totalAmount: editForm.totalAmount,
      amountReceived: editForm.amountReceived,
      deposit: editForm.deposit,
      nbAdult: editForm.nbAdult,
      nbKids: editForm.nbKids,
      paymentMode: editForm.paymentMode,
      respResa: editForm.respResa,
      companyName: trimmedCompanyName || undefined,
      groupName: trimmedGroupName || undefined,
      modeDeposit: editForm.modeDeposit || null,
      dateAvReg: editForm.dateAvReg || null,
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
      seatsTotal: createForm.nbAdult + createForm.nbKids,
      type: "groupe",
      displayChoice: createForm.displayChoice as "jardin" | "brasserie",
      paymentMode: createForm.paymentMode as "cash" | "virement" | "espece",
      respResa: createForm.respResa as ReservationResponsable,
      modeDeposit: createForm.modeDeposit || undefined,
      dateAvReg: createForm.dateAvReg || undefined,
      status: createForm.status as
        | "pending_validation"
        | "validated_pending_payment"
        | "paid_confirmed",
    });
  };

  const toDateInputValue = (value: string | Date | null | undefined) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().split("T")[0];
  };

  const formatTableDate = (value: string | Date | null | undefined) => {
    const dateValue = toDateInputValue(value);
    return dateValue || "-";
  };

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
      const matchesStatus =
        statusFilter === "all" ||
        r.status === statusFilter ||
        (statusFilter === "pending_validation" &&
          ["pending_confirmation", "submitted"].includes(r.status)) ||
        (statusFilter === "validated_pending_payment" &&
          ["pending_deposit", "pending_confirmation"].includes(r.status));
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

  const totalReservationsCount = reservations?.length || 0;
  const filteredReservationsCount = filteredReservations?.length || 0;

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
              Vous n'avez pas les droits pour accéder aux réservations restaurant.
            </p>
            <Link href="/admin">
              <Button variant="outline">Retour au dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getReservationEntryUserLabel = (reservation: any) => {
    const source = String(reservation?.entrySource || "").toLowerCase();
    if (source === "website") return "Site";

    const createdByName = reservation?.createdByName;
    const createdByEmail = reservation?.createdByEmail;

    if (createdByName && String(createdByName).trim()) return String(createdByName);
    if (createdByEmail && String(createdByEmail).trim()) return String(createdByEmail);

    return "-";
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
      case "pending_deposit":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            <CreditCard className="h-3 w-3 mr-1" />
            Paiement attendu
          </Badge>
        );
      case "deposit_submitted":
        return (
          <Badge className="bg-amber-600">
            <Clock className="h-3 w-3 mr-1" />
            Preuve déposée
          </Badge>
        );
      case "deposit_received":
        return (
          <Badge className="bg-emerald-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Acompte reçu
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

  const ADULT_PRICE = 290;
  const KIDS_PRICE = 190;

  const computeTotalFromGuests = (nbAdult: number, nbKids: number) =>
    nbAdult * ADULT_PRICE + nbKids * KIDS_PRICE;

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
              Réservations Restaurant
            </h1>
            <p className="text-xs text-muted-foreground">
              {filteredReservationsCount} réservation(s) affichée(s) sur {totalReservationsCount}
              {statusFilter === "all"
                ? " (restaurant, tous types et statuts)"
                : " (restaurant, filtre actif)"}
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
              <SelectItem value="deposit_submitted">Preuve déposée</SelectItem>
              <SelectItem value="deposit_received">Acompte reçu</SelectItem>
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
        {isError && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Chargement API échoué — données de secours affichées.</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => refetch()}>
              Réessayer
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>REF RÉSERVATION</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("date")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        DATE FTOUR
                        {renderSortIcon("date")}
                      </button>
                    </TableHead>
                    <TableHead>RESP. RÉSA</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("seatsTotal")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        NB PAX
                        {renderSortIcon("seatsTotal")}
                      </button>
                    </TableHead>
                    <TableHead>NB KIDS</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("groupOrCompany")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        NOM DE L'ENTREPRISE
                        {renderSortIcon("groupOrCompany")}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("contact")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        PRÉNOM NOM
                        {renderSortIcon("contact")}
                      </button>
                    </TableHead>
                    <TableHead>NUMÉRO TÉL</TableHead>
                    <TableHead>EMAIL</TableHead>
                    <TableHead>SAISI PAR</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        STATUT
                        {renderSortIcon("status")}
                      </button>
                    </TableHead>
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
                        <TableCell>
                          <span className="font-mono text-xs min-w-[130px] inline-block">
                            {r.reference || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatTableDate(r.date)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{r.respResa || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{Number(r.nbAdult || r.seatsTotal || 0)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{Number(r.nbKids || 0)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{r.type === "groupe" ? r.groupName || "-" : r.companyName || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{r.name || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{r.phone || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{r.email || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-block min-w-[120px] text-sm text-muted-foreground">
                            {getReservationEntryUserLabel(r)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(r.status === "pending_validation" ||
                              r.status === "submitted") && (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-green-600"
                                  title="Valider"
                                  onClick={() =>
                                    validateMutation.mutate({
                                      reference: r.reference,
                                      baseUrl: window.location.origin,
                                    })
                                  }
                                  disabled={validateMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-red-600"
                                  title="Refuser"
                                  onClick={() =>
                                    refuseMutation.mutate({
                                      reference: r.reference,
                                    })
                                  }
                                  disabled={refuseMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {[
                              "validated_pending_payment",
                              "pending_confirmation",
                              "pending_deposit",
                              "deposit_submitted",
                              "deposit_received",
                              "paid_confirmed",
                              "confirmed",
                            ].includes(r.status) && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                title="Terminer"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: r.id,
                                    status: "completed",
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {(r.latestPaymentProofPath ||
                              r.status === "deposit_submitted" ||
                              r.status === "deposit_received") && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                title="Télécharger preuve de virement"
                                onClick={() => handleDownloadProof(r.id)}
                                disabled={downloadingProofId === r.id}
                              >
                                {downloadingProofId === r.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              title="Modifier"
                              onClick={() => openEditDialog(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              title="Supprimer"
                              onClick={() => handleDeleteReservation(r)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
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
                <Label htmlFor="edit-deposit">Deposit (DH)</Label>
                <Input
                  id="edit-deposit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.deposit}
                  onChange={e =>
                    setEditForm({
                      ...editForm,
                      deposit: Math.max(
                        0,
                        Number.parseFloat(e.target.value || "0") || 0
                      ),
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-nb-adult">NB ADULT</Label>
                  <Input
                    id="edit-nb-adult"
                    type="number"
                    min={0}
                    value={editForm.nbAdult}
                    onChange={e => {
                      const nbAdult = Math.max(
                        0,
                        Number.parseInt(e.target.value || "0", 10) || 0
                      );
                      setEditForm({
                        ...editForm,
                        nbAdult,
                        totalAmount: computeTotalFromGuests(
                          nbAdult,
                          editForm.nbKids
                        ),
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-nb-kids">NB KIDS</Label>
                  <Input
                    id="edit-nb-kids"
                    type="number"
                    min={0}
                    value={editForm.nbKids}
                    onChange={e => {
                      const nbKids = Math.max(
                        0,
                        Number.parseInt(e.target.value || "0", 10) || 0
                      );
                      setEditForm({
                        ...editForm,
                        nbKids,
                        totalAmount: computeTotalFromGuests(
                          editForm.nbAdult,
                          nbKids
                        ),
                      });
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-mode-deposit">Mode deposit</Label>
                <Select
                  value={editForm.modeDeposit || ""}
                  onValueChange={value =>
                    setEditForm({ ...editForm, modeDeposit: value })
                  }
                >
                  <SelectTrigger id="edit-mode-deposit">
                    <SelectValue placeholder="Sélectionner un mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="espece">Espèce</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-date-av-reg">Date AV/REG</Label>
                <Input
                  id="edit-date-av-reg"
                  type="date"
                  value={editForm.dateAvReg}
                  onChange={e =>
                    setEditForm({ ...editForm, dateAvReg: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-payment-mode">Mode de règlement</Label>
                <Select
                  value={editForm.paymentMode}
                  onValueChange={value =>
                    setEditForm({
                      ...editForm,
                      paymentMode: value as "cash" | "virement" | "espece",
                    })
                  }
                >
                  <SelectTrigger id="edit-payment-mode">
                    <SelectValue placeholder="Sélectionner un mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="espece">Espèce</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-resp-resa">RESP RESA</Label>
                <Select
                  value={editForm.respResa}
                  onValueChange={value =>
                    setEditForm({
                      ...editForm,
                      respResa: value as ReservationResponsable,
                    })
                  }
                >
                  <SelectTrigger id="edit-resp-resa">
                    <SelectValue placeholder="Sélectionner un responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVATION_RESPONSABLES.map(name => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Label>Nom du groupe</Label>
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
              <Label>NB adultes</Label>
              <Input
                type="number"
                min={2}
                value={createForm.nbAdult}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    nbAdult: Math.max(
                      2,
                      parseInt(e.target.value || "2", 10)
                    ),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>NB kids</Label>
              <Input
                type="number"
                min={0}
                value={createForm.nbKids}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    nbKids: Math.max(0, parseInt(e.target.value || "0", 10)),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Total (DH)</Label>
              <Input
                type="number"
                min={0}
                value={createForm.totalAmount}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    totalAmount: Math.max(
                      0,
                      parseFloat(e.target.value || "0") || 0
                    ),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Montant reçu (DH)</Label>
              <Input
                type="number"
                min={0}
                value={createForm.amountReceived}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    amountReceived: Math.max(
                      0,
                      parseFloat(e.target.value || "0") || 0
                    ),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Acompte (DH)</Label>
              <Input
                type="number"
                min={0}
                value={createForm.deposit}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    deposit: Math.max(0, parseFloat(e.target.value || "0") || 0),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Mode paiement</Label>
              <Select
                value={createForm.paymentMode}
                onValueChange={value =>
                  setCreateForm({ ...createForm, paymentMode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="espece">Espèce</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>RESP RESA</Label>
              <Select
                value={createForm.respResa}
                onValueChange={value =>
                  setCreateForm({ ...createForm, respResa: value as ReservationResponsable })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESERVATION_RESPONSABLES.map(name => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode deposit</Label>
              <Input
                value={createForm.modeDeposit}
                onChange={e =>
                  setCreateForm({ ...createForm, modeDeposit: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Date AV REG</Label>
              <Input
                type="date"
                value={createForm.dateAvReg}
                onChange={e =>
                  setCreateForm({ ...createForm, dateAvReg: e.target.value })
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
                  {manualDisplayChoiceOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
