import { useState, useRef } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAdminPage } from "./_shell/AdminFrame";
import AdminBadge from "@/components/admin/AdminBadge";
import SectionLabel from "@/components/admin/SectionLabel";
import {
  Search,
  Download,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  QrCode,
  Mail,
  Phone,
  Calendar,
  Trash2,
  Upload,
  FileSpreadsheet,
  UserPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ScanLine,
  Wifi,
  X,
} from "lucide-react";

/* ─────────────────────────── helpers ─────────────────────────── */

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

function statusTone(
  status: string
): "success" | "danger" | "neutral" | "info" | "warn" {
  switch (status) {
    case "present":
      return "success";
    case "absent":
      return "danger";
    case "confirmed":
      return "info";
    case "registered":
      return "neutral";
    case "cancelled":
      return "warn";
    default:
      return "neutral";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "present":
      return "Présent";
    case "absent":
      return "Absent";
    case "confirmed":
      return "Confirmé";
    case "registered":
      return "Inscrit";
    case "cancelled":
      return "Annulé";
    default:
      return status;
  }
}

/* ─────────────────────────── modal components ─────────────────────────── */

function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 10,
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          border: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 20px",
            borderBottom: "1px solid var(--line-soft)",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-mute)",
              padding: 4,
              borderRadius: 4,
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 10,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          border: "1px solid var(--line)",
          padding: 24,
        }}
      >
        <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20 }}>
          {description}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--danger)",
              color: "#fff",
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── form helpers ─────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ink-soft)",
  marginBottom: 5,
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
  background: "var(--olive)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const btnOutline: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const btnGhost: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 5,
  border: "none",
  background: "transparent",
  color: "var(--ink-soft)",
  fontSize: 12,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

/* ─────────────────────────── main component ─────────────────────────── */

export default function AdminBenevoles() {
  /* ── filter / sort state ── */
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [attendanceFrequencyFilter, setAttendanceFrequencyFilter] =
    useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  /* ── QR detail modal ── */
  const [selectedVolunteer, setSelectedVolunteer] = useState<number | null>(null);

  /* ── delete confirm ── */
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  /* ── import Excel state ── */
  const [importOpen, setImportOpen] = useState(false);
  const [importDayId, setImportDayId] = useState<string>("");
  const [importSlots, setImportSlots] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<
    { email: string; success: boolean; error?: string }[] | null
  >(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  /* ── manual create state ── */
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSlots, setManualSlots] = useState<string[]>([]);
  const [manualForm, setManualForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    dayId: "",
    groupMembersCount: "1",
    status: "registered",
  });

  /* ── scanner sidebar state ── */
  const [scanInput, setScanInput] = useState("");
  const [recentScans, setRecentScans] = useState<
    { name: string; time: string; id: number }[]
  >([]);

  /* ─── tRPC ─── */
  const { data: days } = trpc.days.list.useQuery();
  const {
    data: volunteers,
    isLoading,
    refetch,
  } = trpc.volunteers.listByDay.useQuery(
    { dayId: selectedDay === "all" ? undefined : parseInt(selectedDay) },
    {
      enabled: true,
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
    }
  );

  const updateStatusMutation = trpc.volunteers.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.volunteers.delete.useMutation({
    onSuccess: () => {
      toast.success("Bénévole supprimé");
      setDeleteTarget(null);
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  const processExcelMutation = trpc.volunteers.processGroupExcel.useMutation({
    onSuccess: data => {
      setImportResults(data.results);
      toast.success(
        `${data.successCount} bénévole(s) inscrit(s), ${data.failCount} erreur(s)`
      );
      refetch();
    },
    onError: error => toast.error(error.message),
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
        groupMembersCount: "1",
        status: "registered",
      });
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  /* ─── useAdminPage ─── */
  useAdminPage({
    title: "Bénévoles",
    crumb: ["Solidarité & Équipe", "Bénévoles"],
    actions: (
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnOutline} onClick={() => setImportOpen(true)}>
          <Upload size={14} />
          Importer Excel
        </button>
        <button style={btnPrimary} onClick={() => setManualOpen(true)}>
          <UserPlus size={14} />
          Ajouter
        </button>
      </div>
    ),
  });

  /* ─── derived data ─── */
  const volunteersList = volunteers?.volunteers || [];

  const statsSource = volunteersList.filter(
    (v: any) => v.status !== "cancelled"
  );
  const totalCount = statsSource.length;
  const presentCount = statsSource.filter((v: any) =>
    isVolunteerPresent(v)
  ).length;
  const absentCount = statsSource.filter(
    (v: any) => v.status === "absent"
  ).length;
  const pendingCount = statsSource.filter(
    (v: any) =>
      !isVolunteerPresent(v) &&
      v.status !== "absent" &&
      (v.status === "registered" || v.status === "confirmed")
  ).length;

  /* role distribution */
  const prepCount = volunteersList.filter((v: any) =>
    normalizeSlots(v.volunteerSlots).includes("preparation_ftour")
  ).length;
  const serviceCount = volunteersList.filter((v: any) =>
    normalizeSlots(v.volunteerSlots).includes("service_ftour")
  ).length;
  const bothCount = volunteersList.filter(
    (v: any) =>
      normalizeSlots(v.volunteerSlots).includes("preparation_ftour") &&
      normalizeSlots(v.volunteerSlots).includes("service_ftour")
  ).length;

  /* filtering */
  const filteredVolunteers = volunteersList.filter((v: any) => {
    const matchesSearch =
      searchQuery === "" ||
      v.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || v.status === statusFilter;

    const frequency = Number(v.attendanceFrequency ?? 0);
    const matchesAttendanceFrequency =
      attendanceFrequencyFilter === "all" ||
      (attendanceFrequencyFilter === "4+"
        ? frequency >= 4
        : frequency === Number(attendanceFrequencyFilter));

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

    return matchesSearch && matchesStatus && matchesSlot && matchesAttendanceFrequency;
  });

  /* sorting */
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedVolunteers = [...filteredVolunteers].sort((a: any, b: any) => {
    if (!sortColumn) return 0;
    let aVal: any;
    let bVal: any;
    switch (sortColumn) {
      case "name":
        aVal = `${a.lastName} ${a.firstName}`.toLowerCase();
        bVal = `${b.lastName} ${b.firstName}`.toLowerCase();
        break;
      case "day":
        aVal = a.day?.dayNumber ?? 0;
        bVal = b.day?.dayNumber ?? 0;
        break;
      case "frequency":
        aVal = Number(a.attendanceFrequency ?? 0);
        bVal = Number(b.attendanceFrequency ?? 0);
        break;
      case "status":
        aVal = a.status;
        bVal = b.status;
        break;
      default:
        return 0;
    }
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  /* ─── import excel ─── */
  const handleImportExcel = async () => {
    if (!importFile || !importDayId || importSlots.length === 0) {
      toast.error("Veuillez remplir tous les champs et sélectionner un fichier");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      processExcelMutation.mutate({
        dayId: parseInt(importDayId),
        volunteerSlots: importSlots as ("preparation_ftour" | "service_ftour")[],
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

  /* ─── manual create ─── */
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
      groupMembersCount: Math.max(
        1,
        parseInt(manualForm.groupMembersCount || "1", 10) || 1
      ),
      volunteerSlots: manualSlots as ("preparation_ftour" | "service_ftour")[],
      status: manualForm.status as
        | "registered"
        | "confirmed"
        | "present"
        | "absent"
        | "cancelled",
    });
  };

  /* ─── export CSV ─── */
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
      "Prénom", "Nom", "Email", "Téléphone", "Ville",
      "Jour", "Créneaux", "Statut", "Date inscription",
    ];
    const rows = filteredVolunteers.map((v: any) => [
      v.firstName, v.lastName, v.email, v.phone, v.city || "",
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

  /* ─── QR scanner sidebar ─── */
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    const token = scanInput.trim();
    const found = volunteersList.find(
      (v: any) => v.qrToken === token
    ) as any | undefined;
    if (found) {
      const name = `${found.firstName} ${found.lastName}`;
      setRecentScans(prev =>
        [
          {
            name,
            time: new Date().toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            id: found.id,
          },
          ...prev,
        ].slice(0, 10)
      );
      if (!isVolunteerPresent(found)) {
        updateStatusMutation.mutate({
          volunteerId: found.id,
          status: "present",
        });
        toast.success(`${name} marqué présent`);
      } else {
        toast.info(`${name} déjà présent`);
      }
    } else {
      toast.error("QR token introuvable");
    }
    setScanInput("");
  };

  const currentVolunteer = volunteersList.find(
    (v: any) => v.id === selectedVolunteer
  ) as any;

  /* ─────────── sort icon ─────────── */
  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDirection === "asc" ? (
      <ArrowUp size={12} />
    ) : (
      <ArrowDown size={12} />
    );
  };

  /* ─────────── render ─────────── */
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        minHeight: "100%",
      }}
    >
      {/* ══════════════ LEFT PANEL ══════════════ */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ── stat strip ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {[
            { label: "Total bénévoles", value: totalCount, color: "var(--ink)" },
            { label: "Présents", value: presentCount, color: "var(--success)" },
            { label: "Absents", value: absentCount, color: "var(--danger)" },
            { label: "En attente", value: pendingCount, color: "var(--warn)" },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: stat.color,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  lineHeight: 1.3,
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* ── filter toolbar ── */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {/* Day tabs */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              onClick={() => setSelectedDay("all")}
              style={{
                padding: "5px 10px",
                borderRadius: 5,
                border: "1px solid var(--line)",
                background:
                  selectedDay === "all" ? "var(--olive)" : "var(--surface)",
                color: selectedDay === "all" ? "#fff" : "var(--ink-soft)",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: selectedDay === "all" ? 600 : 400,
              }}
            >
              Tous
            </button>
            {days?.map(day => (
              <button
                key={day.id}
                onClick={() => setSelectedDay(day.id.toString())}
                style={{
                  padding: "5px 10px",
                  borderRadius: 5,
                  border: "1px solid var(--line)",
                  background:
                    selectedDay === day.id.toString()
                      ? "var(--olive)"
                      : "var(--surface)",
                  color:
                    selectedDay === day.id.toString() ? "#fff" : "var(--ink-soft)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: selectedDay === day.id.toString() ? 600 : 400,
                }}
              >
                J{day.dayNumber}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 22,
              background: "var(--line-soft)",
              flexShrink: 0,
            }}
          />

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              ...inputStyle,
              width: "auto",
              padding: "5px 8px",
              fontSize: 12,
            }}
          >
            <option value="all">Tous statuts</option>
            <option value="registered">Inscrit</option>
            <option value="confirmed">Confirmé</option>
            <option value="present">Présent</option>
            <option value="absent">Absent</option>
            <option value="cancelled">Annulé</option>
          </select>

          {/* Slot filter */}
          <select
            value={slotFilter}
            onChange={e => setSlotFilter(e.target.value)}
            style={{
              ...inputStyle,
              width: "auto",
              padding: "5px 8px",
              fontSize: 12,
            }}
          >
            <option value="all">Tous créneaux</option>
            <option value="preparation_ftour">Préparation</option>
            <option value="service_ftour">Service</option>
            <option value="both">Les deux</option>
          </select>

          {/* Frequency filter */}
          <select
            value={attendanceFrequencyFilter}
            onChange={e => setAttendanceFrequencyFilter(e.target.value)}
            style={{
              ...inputStyle,
              width: "auto",
              padding: "5px 8px",
              fontSize: 12,
            }}
          >
            <option value="all">Toutes fréquences</option>
            <option value="0">0 fois</option>
            <option value="1">1 fois</option>
            <option value="2">2 fois</option>
            <option value="3">3 fois</option>
            <option value="4+">4+</option>
          </select>

          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-mute)",
              }}
            />
            <input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                ...inputStyle,
                paddingLeft: 26,
                padding: "5px 8px 5px 26px",
                fontSize: 12,
              }}
            />
          </div>

          {/* Export CSV */}
          <button style={btnGhost} onClick={handleExportCSV}>
            <Download size={13} />
            CSV
          </button>
        </div>

        {/* ── role distribution bar ── */}
        {volunteersList.length > 0 && (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line-soft)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 7,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>
                Répartition des créneaux
              </span>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink-soft)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: "var(--sand)",
                      display: "inline-block",
                    }}
                  />
                  Préparation ({prepCount})
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: "var(--olive)",
                      display: "inline-block",
                    }}
                  />
                  Service ({serviceCount})
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: "var(--olive-deep)",
                      display: "inline-block",
                    }}
                  />
                  Les deux ({bothCount})
                </span>
              </div>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "var(--line-soft)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              {volunteersList.length > 0 && (
                <>
                  <div
                    style={{
                      width: `${(prepCount / volunteersList.length) * 100}%`,
                      background: "var(--sand)",
                      transition: "width 0.3s",
                    }}
                  />
                  <div
                    style={{
                      width: `${(bothCount / volunteersList.length) * 100}%`,
                      background: "var(--olive-deep)",
                      transition: "width 0.3s",
                    }}
                  />
                  <div
                    style={{
                      width: `${(serviceCount / volunteersList.length) * 100}%`,
                      background: "var(--olive)",
                      transition: "width 0.3s",
                    }}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── table ── */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* table header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 12px",
              borderBottom: "1px solid var(--line-soft)",
              gap: 4,
            }}
          >
            <span
              style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}
            >
              {filteredVolunteers.length} bénévole
              {filteredVolunteers.length !== 1 ? "s" : ""} affichés
              {volunteersList.length > filteredVolunteers.length &&
                ` / ${volunteersList.length} total`}
            </span>
          </div>

          {isLoading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 48,
                color: "var(--ink-mute)",
              }}
            >
              <Loader2 size={24} style={{ marginRight: 8 }} className="animate-spin" />
              Chargement...
            </div>
          ) : sortedVolunteers.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                color: "var(--ink-mute)",
              }}
            >
              <Users size={36} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>Aucun bénévole trouvé</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)" }}>
                    {[
                      { key: "name", label: "Nom" },
                      { key: "contact", label: "Email / Téléphone", sortable: false },
                      { key: "city", label: "Ville", sortable: false },
                      { key: "slots", label: "Créneaux", sortable: false },
                      { key: "status", label: "Présence" },
                      { key: "actions", label: "Actions", sortable: false },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={
                          col.sortable !== false
                            ? () => handleSort(col.key)
                            : undefined
                        }
                        style={{
                          padding: "9px 12px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--ink-soft)",
                          borderBottom: "1px solid var(--line-soft)",
                          cursor: col.sortable !== false ? "pointer" : "default",
                          whiteSpace: "nowrap",
                          userSelect: "none",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {col.label}
                          {col.sortable !== false && <SortIcon column={col.key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedVolunteers.map((volunteer: any, i: number) => (
                    <tr
                      key={volunteer.id}
                      style={{
                        borderBottom:
                          i < sortedVolunteers.length - 1
                            ? "1px solid var(--line-soft)"
                            : "none",
                        background:
                          i % 2 === 0 ? "var(--surface)" : "var(--bg)",
                      }}
                    >
                      {/* Nom */}
                      <td style={{ padding: "10px 12px" }}>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: 13,
                            color: "var(--ink)",
                          }}
                        >
                          {volunteer.firstName} {volunteer.lastName}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                          {volunteer.day?.date
                            ? `J${volunteer.day.dayNumber} · ${new Date(volunteer.day.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                            : `J${volunteer.day?.dayNumber ?? "—"}`}
                        </div>
                      </td>

                      {/* Contact */}
                      <td style={{ padding: "10px 12px" }}>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--ink)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Mail size={11} style={{ color: "var(--ink-mute)" }} />
                            {volunteer.email}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--ink-soft)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Phone size={11} style={{ color: "var(--ink-mute)" }} />
                            {volunteer.phone}
                          </span>
                        </div>
                      </td>

                      {/* Ville */}
                      <td
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "var(--ink-soft)",
                        }}
                      >
                        {volunteer.city || "—"}
                      </td>

                      {/* Créneaux */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {normalizeSlots(volunteer.volunteerSlots).includes(
                            "preparation_ftour"
                          ) && (
                            <AdminBadge tone="sand">Prép.</AdminBadge>
                          )}
                          {normalizeSlots(volunteer.volunteerSlots).includes(
                            "service_ftour"
                          ) && (
                            <AdminBadge tone="olive">Service</AdminBadge>
                          )}
                          {normalizeSlots(volunteer.volunteerSlots).length === 0 && (
                            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                              —
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Présence */}
                      <td style={{ padding: "10px 12px" }}>
                        <AdminBadge tone={statusTone(volunteer.status)}>
                          {statusLabel(volunteer.status)}
                        </AdminBadge>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {/* View QR */}
                          <button
                            title="Voir QR code"
                            onClick={() => setSelectedVolunteer(volunteer.id)}
                            style={{
                              ...btnGhost,
                              padding: "5px 7px",
                              border: "1px solid var(--line-soft)",
                              borderRadius: 5,
                            }}
                          >
                            <QrCode size={13} />
                          </button>

                          {/* Mark present */}
                          {!isVolunteerPresent(volunteer) && (
                            <button
                              title="Marquer présent"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  volunteerId: volunteer.id,
                                  status: "present",
                                })
                              }
                              style={{
                                ...btnGhost,
                                padding: "5px 7px",
                                border: "1px solid var(--line-soft)",
                                borderRadius: 5,
                                color: "var(--success)",
                              }}
                            >
                              <CheckCircle size={13} />
                            </button>
                          )}

                          {/* Mark absent */}
                          {volunteer.status !== "absent" &&
                            volunteer.status !== "cancelled" && (
                              <button
                                title="Marquer absent"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    volunteerId: volunteer.id,
                                    status: "absent",
                                  })
                                }
                                style={{
                                  ...btnGhost,
                                  padding: "5px 7px",
                                  border: "1px solid var(--line-soft)",
                                  borderRadius: 5,
                                  color: "var(--danger)",
                                }}
                              >
                                <XCircle size={13} />
                              </button>
                            )}

                          {/* Delete */}
                          <button
                            title="Supprimer"
                            onClick={() =>
                              setDeleteTarget({
                                id: volunteer.id,
                                name: `${volunteer.firstName} ${volunteer.lastName}`,
                              })
                            }
                            style={{
                              ...btnGhost,
                              padding: "5px 7px",
                              border: "1px solid var(--line-soft)",
                              borderRadius: 5,
                              color: "var(--danger)",
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ RIGHT SIDEBAR — Scanner ══════════════ */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          position: "sticky",
          top: 16,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--line-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <ScanLine size={15} style={{ color: "var(--olive)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                Scanner QR
              </span>
            </div>
            {/* Live indicator */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10,
                color: "var(--success)",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--success)",
                  animation: "pulse 1.8s ease-in-out infinite",
                }}
              />
              LIVE
            </span>
          </div>

          {/* Stats mini */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--line-soft)",
              display: "flex",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--success)",
                  lineHeight: 1,
                }}
              >
                {presentCount}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>scannés</div>
            </div>
            <div
              style={{
                width: 1,
                background: "var(--line-soft)",
                alignSelf: "stretch",
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--ink)",
                  lineHeight: 1,
                }}
              >
                {totalCount}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>total</div>
            </div>
            {totalCount > 0 && (
              <>
                <div
                  style={{
                    width: 1,
                    background: "var(--line-soft)",
                    alignSelf: "stretch",
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--ink)",
                      lineHeight: 1,
                    }}
                  >
                    {Math.round((presentCount / totalCount) * 100)}%
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-mute)" }}>taux</div>
                </div>
              </>
            )}
          </div>

          {/* Scanner input */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line-soft)" }}>
            <form onSubmit={handleScanSubmit}>
              <label style={{ ...labelStyle, marginBottom: 6 }}>
                Saisir / scanner un token QR
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  placeholder="Token ou scan..."
                  autoFocus
                  style={{
                    ...inputStyle,
                    fontSize: 12,
                    padding: "6px 8px",
                    flex: 1,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    ...btnPrimary,
                    padding: "6px 10px",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  OK
                </button>
              </div>
            </form>
            <Link href="/admin/scan">
              <a
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--olive)",
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Ouvrir le scanner caméra →
              </a>
            </Link>
          </div>

          {/* Recent scans */}
          <div style={{ padding: "10px 14px" }}>
            <SectionLabel>Derniers scans</SectionLabel>
            {recentScans.length === 0 ? (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  textAlign: "center",
                  padding: "12px 0",
                }}
              >
                Aucun scan récent
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {recentScans.map((scan, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 8px",
                      background: "var(--surface-alt)",
                      borderRadius: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--ink)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 160,
                      }}
                    >
                      {scan.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--ink-mute)",
                        flexShrink: 0,
                      }}
                    >
                      {scan.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ MODALS ══════════════ */}

      {/* QR / Volunteer detail modal */}
      <Modal
        open={selectedVolunteer !== null}
        onClose={() => setSelectedVolunteer(null)}
        title={
          currentVolunteer
            ? `${currentVolunteer.firstName} ${currentVolunteer.lastName}`
            : "Détails du bénévole"
        }
        maxWidth={460}
      >
        {currentVolunteer && (
          <div>
            {/* Avatar + status */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--olive-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 10px",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--olive-deep)",
                }}
              >
                {currentVolunteer.firstName.charAt(0)}
                {currentVolunteer.lastName.charAt(0)}
              </div>
              <AdminBadge tone={statusTone(currentVolunteer.status)}>
                {statusLabel(currentVolunteer.status)}
              </AdminBadge>
            </div>

            {/* Info rows */}
            {[
              { label: "Email", value: currentVolunteer.email },
              { label: "Téléphone", value: currentVolunteer.phone },
              { label: "Ville", value: currentVolunteer.city || "—" },
              {
                label: "Jour",
                value: `Jour ${currentVolunteer.day?.dayNumber ?? "—"}`,
              },
              {
                label: "Créneaux",
                value: (
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {normalizeSlots(currentVolunteer.volunteerSlots).includes(
                      "preparation_ftour"
                    ) && <AdminBadge tone="sand">Préparation ftour</AdminBadge>}
                    {normalizeSlots(currentVolunteer.volunteerSlots).includes(
                      "service_ftour"
                    ) && <AdminBadge tone="olive">Service ftour</AdminBadge>}
                    {normalizeSlots(currentVolunteer.volunteerSlots).length === 0 &&
                      "—"}
                  </span>
                ),
              },
              {
                label: "Inscription",
                value: new Date(currentVolunteer.createdAt).toLocaleDateString(
                  "fr-FR"
                ),
              },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  {row.value as React.ReactNode}
                </span>
              </div>
            ))}

            {/* QR Code */}
            <div
              style={{
                background: "var(--surface-alt)",
                borderRadius: 8,
                padding: 16,
                textAlign: "center",
                marginTop: 16,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "var(--ink-mute)",
                  marginBottom: 10,
                }}
              >
                Code QR de présence
              </p>
              <div
                style={{
                  background: "#fff",
                  padding: 10,
                  borderRadius: 6,
                  display: "inline-block",
                }}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/checkin/${currentVolunteer.qrToken}`)}`}
                  alt="QR Code"
                  style={{ width: 96, height: 96, display: "block" }}
                />
              </div>
              <p style={{ fontSize: 11, marginTop: 8, color: "var(--ink-mute)" }}>
                <a
                  href={`${window.location.origin}/checkin/${currentVolunteer.qrToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--olive)", textDecoration: "none" }}
                >
                  Tester le lien ↗
                </a>
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ volunteerId: deleteTarget.id });
          }
        }}
        loading={deleteMutation.isPending}
        title="Supprimer ce bénévole ?"
        description={`Êtes-vous sûr de vouloir supprimer ${deleteTarget?.name ?? "ce bénévole"} ? Cette action est irréversible.`}
      />

      {/* Manual create dialog */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <UserPlus size={15} />
            Ajouter un bénévole manuellement
          </span>
        }
      >
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            marginBottom: 16,
            padding: "8px 10px",
            background: "var(--warn-bg)",
            borderRadius: 5,
            border: "1px solid var(--warn)",
          }}
        >
          Cet ajout admin contourne les limites de capacité et l'état
          d'ouverture/fermeture du jour.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Prénom *</label>
            <input
              style={inputStyle}
              value={manualForm.firstName}
              onChange={e =>
                setManualForm(prev => ({ ...prev, firstName: e.target.value }))
              }
            />
          </div>
          <div>
            <label style={labelStyle}>Nom *</label>
            <input
              style={inputStyle}
              value={manualForm.lastName}
              onChange={e =>
                setManualForm(prev => ({ ...prev, lastName: e.target.value }))
              }
            />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>Email *</label>
          <input
            type="email"
            style={inputStyle}
            value={manualForm.email}
            onChange={e =>
              setManualForm(prev => ({ ...prev, email: e.target.value }))
            }
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 10,
          }}
        >
          <div>
            <label style={labelStyle}>Téléphone *</label>
            <input
              style={inputStyle}
              value={manualForm.phone}
              onChange={e =>
                setManualForm(prev => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>
          <div>
            <label style={labelStyle}>Ville</label>
            <input
              style={inputStyle}
              value={manualForm.city}
              onChange={e =>
                setManualForm(prev => ({ ...prev, city: e.target.value }))
              }
            />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>Jour *</label>
          <select
            style={inputStyle}
            value={manualForm.dayId}
            onChange={e =>
              setManualForm(prev => ({ ...prev, dayId: e.target.value }))
            }
          >
            <option value="">Sélectionner un jour</option>
            {days?.map(day => (
              <option key={day.id} value={day.id.toString()}>
                Jour {day.dayNumber} —{" "}
                {new Date(day.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>Taille du groupe QR</label>
          <input
            type="number"
            min={1}
            max={100}
            style={inputStyle}
            value={manualForm.groupMembersCount}
            onChange={e =>
              setManualForm(prev => ({
                ...prev,
                groupMembersCount: e.target.value,
              }))
            }
          />
          <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
            Valeur &gt; 1 pour un QR code groupe.
          </p>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>Créneaux *</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { key: "preparation_ftour", label: "Préparation ftour" },
              { key: "service_ftour", label: "Service ftour" },
            ].map(slot => (
              <label
                key={slot.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={manualSlots.includes(slot.key)}
                  onChange={e =>
                    setManualSlots(prev =>
                      e.target.checked
                        ? [...prev, slot.key]
                        : prev.filter(s => s !== slot.key)
                    )
                  }
                  style={{ accentColor: "var(--olive)" }}
                />
                {slot.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={labelStyle}>Statut initial</label>
          <select
            style={inputStyle}
            value={manualForm.status}
            onChange={e =>
              setManualForm(prev => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="registered">Inscrit</option>
            <option value="confirmed">Confirmé</option>
            <option value="present">Présent</option>
            <option value="absent">Absent</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 18,
          }}
        >
          <button style={btnOutline} onClick={() => setManualOpen(false)}>
            Annuler
          </button>
          <button
            style={{
              ...btnPrimary,
              opacity: createManualMutation.isPending ? 0.7 : 1,
              cursor: createManualMutation.isPending ? "not-allowed" : "pointer",
            }}
            onClick={handleManualCreate}
            disabled={createManualMutation.isPending}
          >
            {createManualMutation.isPending && (
              <Loader2 size={13} className="animate-spin" />
            )}
            Ajouter le bénévole
          </button>
        </div>
      </Modal>

      {/* Import Excel dialog */}
      <Modal
        open={importOpen}
        onClose={resetImportDialog}
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <FileSpreadsheet size={15} />
            Importer un fichier Excel
          </span>
        }
      >
        {!importResults ? (
          <div>
            <p
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              Uploadez un fichier Excel contenant la liste des bénévoles. Chaque
              personne sera inscrite individuellement et recevra un email de
              confirmation avec son QR code.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Jour du Ramadan *</label>
              <select
                style={inputStyle}
                value={importDayId}
                onChange={e => setImportDayId(e.target.value)}
              >
                <option value="">Sélectionner un jour</option>
                {days?.map(day => (
                  <option key={day.id} value={day.id.toString()}>
                    Jour {day.dayNumber} —{" "}
                    {new Date(day.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Créneaux de participation *</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  { key: "preparation_ftour", label: "Préparation ftour" },
                  { key: "service_ftour", label: "Service ftour" },
                ].map(slot => (
                  <label
                    key={slot.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={importSlots.includes(slot.key)}
                      onChange={e =>
                        setImportSlots(prev =>
                          e.target.checked
                            ? [...prev, slot.key]
                            : prev.filter(s => s !== slot.key)
                        )
                      }
                      style={{ accentColor: "var(--olive)" }}
                    />
                    {slot.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Fichier Excel *</label>
              <div
                style={{
                  border: "2px dashed var(--line)",
                  borderRadius: 8,
                  padding: 20,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onClick={() =>
                  document.getElementById("import-excel-upload")?.click()
                }
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  ref={importFileRef}
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  id="import-excel-upload"
                  style={{ display: "none" }}
                />
                {importFile ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <FileSpreadsheet
                      size={18}
                      style={{ color: "var(--success)" }}
                    />
                    <span style={{ fontWeight: 500 }}>{importFile.name}</span>
                    <span style={{ color: "var(--ink-mute)" }}>
                      ({(importFile.size / 1024).toFixed(0)} Ko)
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload
                      size={28}
                      style={{
                        margin: "0 auto 6px",
                        color: "var(--ink-mute)",
                        display: "block",
                      }}
                    />
                    <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                      Cliquez pour sélectionner un fichier
                    </p>
                    <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>
                      .xlsx, .xls, .csv (max 5 Mo)
                    </p>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 4 }}>
                Le fichier doit contenir : Prénom, Nom, Email (+ Téléphone, Ville
                optionnels)
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btnOutline} onClick={resetImportDialog}>
                Annuler
              </button>
              <button
                style={{
                  ...btnPrimary,
                  opacity:
                    !importFile ||
                    !importDayId ||
                    importSlots.length === 0 ||
                    processExcelMutation.isPending
                      ? 0.5
                      : 1,
                  cursor:
                    !importFile ||
                    !importDayId ||
                    importSlots.length === 0 ||
                    processExcelMutation.isPending
                      ? "not-allowed"
                      : "pointer",
                }}
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
                    <Loader2 size={13} className="animate-spin" />
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    <Mail size={13} />
                    Inscrire et envoyer les emails
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Results summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {[
                {
                  label: "Total",
                  value: importResults.length,
                  color: "var(--ink)",
                },
                {
                  label: "Inscrits",
                  value: importResults.filter(r => r.success).length,
                  color: "var(--success)",
                },
                {
                  label: "Erreurs",
                  value: importResults.filter(r => !r.success).length,
                  color: "var(--danger)",
                },
              ].map(s => (
                <div
                  key={s.label}
                  style={{
                    background: "var(--surface-alt)",
                    borderRadius: 6,
                    padding: "10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: s.color,
                      lineHeight: 1,
                    }}
                  >
                    {s.value}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 3 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed results */}
            <div
              style={{
                maxHeight: 240,
                overflowY: "auto",
                border: "1px solid var(--line-soft)",
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)" }}>
                    <th
                      style={{
                        padding: "7px 10px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--ink-soft)",
                        borderBottom: "1px solid var(--line-soft)",
                      }}
                    >
                      Email
                    </th>
                    <th
                      style={{
                        padding: "7px 10px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--ink-soft)",
                        borderBottom: "1px solid var(--line-soft)",
                      }}
                    >
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {importResults.map((r, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom:
                          i < importResults.length - 1
                            ? "1px solid var(--line-soft)"
                            : "none",
                      }}
                    >
                      <td
                        style={{
                          padding: "7px 10px",
                          fontSize: 12,
                          color: "var(--ink)",
                        }}
                      >
                        {r.email}
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        {r.success ? (
                          <AdminBadge tone="success">
                            <CheckCircle size={10} style={{ marginRight: 3 }} />
                            OK
                          </AdminBadge>
                        ) : (
                          <AdminBadge tone="danger">
                            <XCircle size={10} style={{ marginRight: 3 }} />
                            {r.error}
                          </AdminBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button style={btnPrimary} onClick={resetImportDialog}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
