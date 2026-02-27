import { useState, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Download,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Loader2,
  QrCode,
  Mail,
  Phone,
  Calendar,
  Trash2,
  Upload,
  FileSpreadsheet,
  UserPlus,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function normalizeSlots(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isVolunteerPresent(volunteer: any): boolean {
  return (
    volunteer?.status === "present" ||
    volunteer?.qrStatus === "validated" ||
    !!volunteer?.scannedAt
  );
}

export default function AdminBenevoles() {
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [selectedVolunteer, setSelectedVolunteer] = useState<number | null>(
    null
  );

  // Import Excel state
  const [importOpen, setImportOpen] = useState(false);
  const [importDayId, setImportDayId] = useState<string>("");
  const [importSlots, setImportSlots] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<
    { email: string; success: boolean; error?: string }[] | null
  >(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualSlots, setManualSlots] = useState<string[]>([]);
  const [manualForm, setManualForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    dayId: "",
    status: "registered",
  });

  const { data: days } = trpc.days.list.useQuery();
  const {
    data: volunteers,
    isLoading,
    refetch,
  } = trpc.volunteers.listByDay.useQuery(
    { dayId: selectedDay === "all" ? undefined : parseInt(selectedDay) },
    {
      enabled: true,
      refetchInterval: 5000, // Rafraîchir automatiquement toutes les 5 secondes
      refetchIntervalInBackground: false, // Ne pas rafraîchir en arrière-plan
    }
  );

  const updateStatusMutation = trpc.volunteers.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.volunteers.delete.useMutation({
    onSuccess: () => {
      toast.success("Bénévole supprimé");
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const processExcelMutation = trpc.volunteers.processGroupExcel.useMutation({
    onSuccess: data => {
      setImportResults(data.results);
      toast.success(
        `${data.successCount} bénévole(s) inscrit(s), ${data.failCount} erreur(s)`
      );
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const createManualMutation = trpc.volunteers.adminCreateManual.useMutation({
    onSuccess: () => {
      toast.success("Bénévole ajouté manuellement");
      setManualOpen(false);
      setManualSlots([]);
      setManualForm({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        city: "",
        dayId: "",
        status: "registered",
      });
      refetch();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const handleImportExcel = async () => {
    if (!importFile || !importDayId || importSlots.length === 0) {
      toast.error(
        "Veuillez remplir tous les champs et sélectionner un fichier"
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      processExcelMutation.mutate({
        dayId: parseInt(importDayId),
        volunteerSlots: importSlots as (
          | "preparation_ftour"
          | "service_ftour"
        )[],
        fileBase64: base64,
        fileName: importFile.name,
      });
    };
    reader.readAsDataURL(importFile);
  };

  const resetImportDialog = () => {
    setImportOpen(false);
    setImportDayId("");
    setImportSlots([]);
    setImportFile(null);
    setImportResults(null);
    if (importFileRef.current) importFileRef.current.value = "";
  };

  const handleManualCreate = () => {
    if (
      !manualForm.firstName ||
      !manualForm.lastName ||
      !manualForm.email ||
      !manualForm.phone ||
      !manualForm.dayId
    ) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (manualSlots.length === 0) {
      toast.error("Veuillez sélectionner au moins un créneau");
      return;
    }

    createManualMutation.mutate({
      firstName: manualForm.firstName,
      lastName: manualForm.lastName,
      email: manualForm.email,
      phone: manualForm.phone,
      city: manualForm.city,
      dayId: parseInt(manualForm.dayId),
      volunteerSlots: manualSlots as ("preparation_ftour" | "service_ftour")[],
      status: manualForm.status as
        | "registered"
        | "confirmed"
        | "present"
        | "absent"
        | "cancelled",
    });
  };

  const volunteersList = volunteers?.volunteers || [];
  const filteredVolunteers = volunteersList.filter((v: any) => {
    const matchesSearch =
      searchQuery === "" ||
      v.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || v.status === statusFilter;

    const slots: string[] = normalizeSlots(v.volunteerSlots);
    let matchesSlot = true;
    if (slotFilter === "preparation_ftour") {
      matchesSlot = slots.includes("preparation_ftour");
    } else if (slotFilter === "service_ftour") {
      matchesSlot = slots.includes("service_ftour");
    } else if (slotFilter === "both") {
      matchesSlot =
        slots.includes("preparation_ftour") && slots.includes("service_ftour");
    }

    return matchesSearch && matchesStatus && matchesSlot;
  });

  const statsSource = filteredVolunteers;
  const totalCount = statsSource.length;
  const registeredCount = statsSource.filter(
    (v: any) => v.status === "registered"
  ).length;
  const confirmedCount = statsSource.filter(
    (v: any) => v.status === "confirmed" && !isVolunteerPresent(v)
  ).length;
  const presentCount = statsSource.filter((v: any) =>
    isVolunteerPresent(v)
  ).length;
  const absentCount = statsSource.filter(
    (v: any) => v.status === "absent"
  ).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "registered":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            <Clock className="h-3 w-3 mr-1" />
            Inscrit
          </Badge>
        );
      case "confirmed":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirmé
          </Badge>
        );
      case "present":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Présent
          </Badge>
        );
      case "absent":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Absent
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Annulé
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (!filteredVolunteers || filteredVolunteers.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const slotLabels: Record<string, string> = {
      preparation_ftour: "Préparation ftour",
      service_ftour: "Service ftour",
    };
    const headers = [
      "Prénom",
      "Nom",
      "Email",
      "Téléphone",
      "Ville",
      "Jour",
      "Créneaux",
      "Statut",
      "Date inscription",
    ];
    const rows = filteredVolunteers.map(v => [
      v.firstName,
      v.lastName,
      v.email,
      v.phone,
      v.city || "",
      `Jour ${v.day?.dayNumber || ""}`,
      normalizeSlots(v.volunteerSlots)
        .map((s: string) => slotLabels[s] || s)
        .join(" + "),
      v.status,
      new Date(v.createdAt).toLocaleDateString("fr-FR"),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `benevoles_${selectedDay === "all" ? "tous" : `jour_${selectedDay}`}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success("Export CSV téléchargé");
  };

  const currentVolunteer = volunteersList.find(
    (v: any) => v.id === selectedVolunteer
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Gestion des bénévoles</h1>
            <p className="text-xs text-muted-foreground">
              {totalCount} bénévole(s) affiché(s) / {volunteersList.length || 0}{" "}
              total
            </p>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par nom ou email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Tous les jours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les jours</SelectItem>
                  {days?.map(day => (
                    <SelectItem key={day.id} value={day.id.toString()}>
                      Jour {day.dayNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="registered">Inscrit</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="present">Présent</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={slotFilter} onValueChange={setSlotFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Tous les créneaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les créneaux</SelectItem>
                  <SelectItem value="preparation_ftour">
                    Préparation ftour
                  </SelectItem>
                  <SelectItem value="service_ftour">Service ftour</SelectItem>
                  <SelectItem value="both">Les deux</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="default" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Excel
              </Button>
              <Button variant="secondary" onClick={() => setManualOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter manuellement
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{totalCount}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {registeredCount}
              </div>
              <div className="text-xs text-muted-foreground">Inscrits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {confirmedCount}
              </div>
              <div className="text-xs text-muted-foreground">Confirmés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {presentCount}
              </div>
              <div className="text-xs text-muted-foreground">Présents</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {absentCount}
              </div>
              <div className="text-xs text-muted-foreground">Absents</div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredVolunteers && filteredVolunteers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bénévole</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Jour</TableHead>
                      <TableHead>Créneaux</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVolunteers.map(volunteer => (
                      <TableRow key={volunteer.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {volunteer.firstName} {volunteer.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {volunteer.city}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {volunteer.email}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {volunteer.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            Jour {volunteer.day?.dayNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {normalizeSlots(volunteer.volunteerSlots).includes(
                              "preparation_ftour"
                            ) && (
                              <Badge
                                variant="outline"
                                className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                              >
                                Préparation
                              </Badge>
                            )}
                            {normalizeSlots(volunteer.volunteerSlots).includes(
                              "service_ftour"
                            ) && (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                              >
                                Service
                              </Badge>
                            )}
                            {normalizeSlots(volunteer.volunteerSlots).length ===
                              0 && (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(volunteer.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedVolunteer(volunteer.id)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            {volunteer.status !== "present" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    volunteerId: volunteer.id,
                                    status: "present",
                                  })
                                }
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {volunteer.status !== "absent" &&
                              volunteer.status !== "cancelled" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      volunteerId: volunteer.id,
                                      status: "absent",
                                    })
                                  }
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Supprimer ce bénévole ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir supprimer{" "}
                                    {volunteer.firstName} {volunteer.lastName} ?
                                    Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() =>
                                      deleteMutation.mutate({
                                        volunteerId: volunteer.id,
                                      })
                                    }
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucun bénévole trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Volunteer Detail Dialog */}
      <Dialog
        open={selectedVolunteer !== null}
        onOpenChange={() => setSelectedVolunteer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails du bénévole</DialogTitle>
          </DialogHeader>

          {currentVolunteer && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-primary">
                    {currentVolunteer.firstName.charAt(0)}
                    {currentVolunteer.lastName.charAt(0)}
                  </span>
                </div>
                <h3 className="font-bold text-lg">
                  {currentVolunteer.firstName} {currentVolunteer.lastName}
                </h3>
                {getStatusBadge(currentVolunteer.status)}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Email</span>
                  <span>{currentVolunteer.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Téléphone</span>
                  <span>{currentVolunteer.phone}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Ville</span>
                  <span>{currentVolunteer.city || "-"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Jour</span>
                  <span>Jour {currentVolunteer.day?.dayNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Créneaux</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {normalizeSlots(currentVolunteer.volunteerSlots).includes(
                      "preparation_ftour"
                    ) && (
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                      >
                        Préparation ftour
                      </Badge>
                    )}
                    {normalizeSlots(currentVolunteer.volunteerSlots).includes(
                      "service_ftour"
                    ) && (
                      <Badge
                        variant="outline"
                        className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                      >
                        Service ftour
                      </Badge>
                    )}
                    {normalizeSlots(currentVolunteer.volunteerSlots).length ===
                      0 && <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Inscription</span>
                  <span>
                    {new Date(currentVolunteer.createdAt).toLocaleDateString(
                      "fr-FR"
                    )}
                  </span>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Code QR</p>
                <div className="bg-white p-3 rounded inline-block">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/checkin/${currentVolunteer.qrToken}`)}`}
                    alt="QR Code"
                    className="w-24 h-24"
                  />
                </div>
                <p className="text-xs mt-2 text-muted-foreground">
                  <a
                    href={`${window.location.origin}/checkin/${currentVolunteer.qrToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Tester le lien
                  </a>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual create dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un bénévole manuellement</DialogTitle>
            <DialogDescription>
              Cet ajout admin contourne les limites de capacité et l'état
              d'ouverture/fermeture du jour.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input
                  value={manualForm.firstName}
                  onChange={e =>
                    setManualForm(prev => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={manualForm.lastName}
                  onChange={e =>
                    setManualForm(prev => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={manualForm.email}
                onChange={e =>
                  setManualForm(prev => ({ ...prev, email: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Téléphone *</Label>
                <Input
                  value={manualForm.phone}
                  onChange={e =>
                    setManualForm(prev => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={manualForm.city}
                  onChange={e =>
                    setManualForm(prev => ({ ...prev, city: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Jour *</Label>
              <Select
                value={manualForm.dayId}
                onValueChange={value =>
                  setManualForm(prev => ({ ...prev, dayId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un jour" />
                </SelectTrigger>
                <SelectContent>
                  {days?.map(day => (
                    <SelectItem key={day.id} value={day.id.toString()}>
                      Jour {day.dayNumber} —{" "}
                      {new Date(day.date).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Créneaux *</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="manual-prep"
                    checked={manualSlots.includes("preparation_ftour")}
                    onCheckedChange={checked => {
                      setManualSlots(prev =>
                        checked
                          ? [...prev, "preparation_ftour"]
                          : prev.filter(s => s !== "preparation_ftour")
                      );
                    }}
                  />
                  <Label htmlFor="manual-prep" className="font-normal">
                    Préparation ftour
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="manual-service"
                    checked={manualSlots.includes("service_ftour")}
                    onCheckedChange={checked => {
                      setManualSlots(prev =>
                        checked
                          ? [...prev, "service_ftour"]
                          : prev.filter(s => s !== "service_ftour")
                      );
                    }}
                  />
                  <Label htmlFor="manual-service" className="font-normal">
                    Service ftour
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Statut initial</Label>
              <Select
                value={manualForm.status}
                onValueChange={value =>
                  setManualForm(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">Inscrit</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="present">Présent</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManualOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleManualCreate}
                disabled={createManualMutation.isPending}
              >
                {createManualMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Ajouter le bénévole
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Excel Dialog */}
      <Dialog
        open={importOpen}
        onOpenChange={open => {
          if (!open) resetImportDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importer un fichier Excel de bénévoles
            </DialogTitle>
            <DialogDescription>
              Uploadez un fichier Excel contenant la liste des bénévoles. Chaque
              personne sera inscrite individuellement et recevra un email de
              confirmation avec son QR code.
            </DialogDescription>
          </DialogHeader>

          {!importResults ? (
            <div className="space-y-4">
              {/* Day selection */}
              <div className="space-y-2">
                <Label>Jour du Ramadan *</Label>
                <Select value={importDayId} onValueChange={setImportDayId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un jour" />
                  </SelectTrigger>
                  <SelectContent>
                    {days?.map(day => (
                      <SelectItem key={day.id} value={day.id.toString()}>
                        Jour {day.dayNumber} —{" "}
                        {new Date(day.date).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Slots selection */}
              <div className="space-y-2">
                <Label>Créneaux de participation *</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="import-prep"
                      checked={importSlots.includes("preparation_ftour")}
                      onCheckedChange={checked => {
                        setImportSlots(prev =>
                          checked
                            ? [...prev, "preparation_ftour"]
                            : prev.filter(s => s !== "preparation_ftour")
                        );
                      }}
                    />
                    <Label htmlFor="import-prep" className="font-normal">
                      Préparation ftour
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="import-service"
                      checked={importSlots.includes("service_ftour")}
                      onCheckedChange={checked => {
                        setImportSlots(prev =>
                          checked
                            ? [...prev, "service_ftour"]
                            : prev.filter(s => s !== "service_ftour")
                        );
                      }}
                    />
                    <Label htmlFor="import-service" className="font-normal">
                      Service ftour
                    </Label>
                  </div>
                </div>
              </div>

              {/* File upload */}
              <div className="space-y-2">
                <Label>Fichier Excel *</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    ref={importFileRef}
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="import-excel-upload"
                  />
                  <label
                    htmlFor="import-excel-upload"
                    className="cursor-pointer"
                  >
                    {importFile ? (
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <span className="font-medium">{importFile.name}</span>
                        <span className="text-muted-foreground">
                          ({(importFile.size / 1024).toFixed(0)} Ko)
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Cliquez pour sélectionner un fichier
                        </p>
                        <p className="text-xs text-muted-foreground">
                          .xlsx, .xls, .csv (max 5 Mo)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le fichier doit contenir les colonnes : Prénom, Nom, Email (+
                  Téléphone, Ville optionnels)
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetImportDialog}>
                  Annuler
                </Button>
                <Button
                  onClick={handleImportExcel}
                  disabled={
                    !importFile ||
                    !importDayId ||
                    importSlots.length === 0 ||
                    processExcelMutation.isPending
                  }
                >
                  {processExcelMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Inscrire et envoyer les emails
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Results summary */}
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold">
                      {importResults.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-green-600">
                      {importResults.filter(r => r.success).length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Inscrits
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-red-600">
                      {importResults.filter(r => !r.success).length}
                    </div>
                    <div className="text-xs text-muted-foreground">Erreurs</div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed results */}
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{r.email}</TableCell>
                        <TableCell>
                          {r.success ? (
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200 text-xs"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-red-50 text-red-700 border-red-200 text-xs"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              {r.error}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button onClick={resetImportDialog}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
