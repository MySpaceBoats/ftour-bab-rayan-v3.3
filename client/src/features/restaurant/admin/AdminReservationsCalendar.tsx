import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Loader2, Users,
  UtensilsCrossed, UsersRound, CalendarDays, XCircle, Moon
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, isToday, isWithinInterval, parseISO
} from "date-fns";
import { fr } from "date-fns/locale";

// ============================================
// TYPES
// ============================================

interface ReservationItem {
  id: number;
  reference: string;
  type: string;
  name: string;
  groupName?: string | null;
  companyName?: string | null;
  seatsTotal: number;
  date: Date | string | null;
  status: string;
  email?: string;
  phone?: string;
  displayChoice?: string | null;
}

interface DayData {
  date: Date;
  reservations: ReservationItem[];
  totalSeats: number;
  groupCount: number;
}

// ============================================
// HELPERS
// ============================================

const ACTIVE_STATUSES = [
  "pending_validation",
  "submitted",
  "validated_pending_payment",
  "pending_confirmation",
  "paid_confirmed",
  "confirmed",
  "completed",
];

function getGroupLabel(r: ReservationItem): string {
  if (r.groupName) return r.groupName;
  if (r.companyName) return r.companyName;
  return r.name;
}

function getTypeBadge(type: string) {
  switch (type) {
    case "particulier":
      return <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">Particulier</Badge>;
    case "entreprise":
      return <Badge className="bg-purple-600 text-white text-[10px] px-1.5 py-0">Entreprise</Badge>;
    case "groupe":
      return <Badge className="bg-orange-600 text-white text-[10px] px-1.5 py-0">Groupe</Badge>;
    default:
      return <Badge className="text-[10px] px-1.5 py-0">{type}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending_validation":
    case "submitted":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">En attente</Badge>;
    case "validated_pending_payment":
    case "pending_confirmation":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0">Paiement</Badge>;
    case "paid_confirmed":
    case "confirmed":
      return <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">Confirmée</Badge>;
    case "completed":
      return <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">Terminée</Badge>;
    case "refused":
    case "rejected":
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Refusée</Badge>;
    case "cancelled":
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Annulée</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>;
  }
}

// ============================================
// COMPONENT
// ============================================

export default function AdminReservationsCalendar() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const allowedRoles = ["admin", "super_admin", "admin_restaurant", "admin_ops"];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  // Fetch all reservation types
  const { data: particuliers, isLoading: loadingP } = trpc.restaurantReservations.adminListParticuliers.useQuery(undefined, {
    enabled: !!hasAccess,
    retry: 1,
  });
  const { data: groupes, isLoading: loadingG } = trpc.restaurantReservations.adminListGroupes.useQuery(undefined, {
    enabled: !!hasAccess,
    retry: 1,
  });
  const { data: entreprises, isLoading: loadingE } = trpc.restaurantReservations.adminListEntreprises.useQuery(undefined, {
    enabled: !!hasAccess,
    retry: 1,
  });

  const isLoading = loadingP || loadingG || loadingE;

  // Combine all reservations
  const allReservations: ReservationItem[] = useMemo(() => {
    return [
      ...(particuliers || []).map((r: any) => ({ ...r, type: r.type || "particulier" })),
      ...(groupes || []).map((r: any) => ({ ...r, type: r.type || "groupe" })),
      ...(entreprises || []).map((r: any) => ({ ...r, type: r.type || "entreprise" })),
    ];
  }, [particuliers, groupes, entreprises]);

  // Build calendar days with reservation data
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: calStart, end: calEnd });

    const dayMap = new Map<string, DayData>();

    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      dayMap.set(key, {
        date: day,
        reservations: [],
        totalSeats: 0,
        groupCount: 0,
      });
    }

    // Add reservations to their respective days
    for (const res of allReservations) {
      if (!res.date) continue;
      if (!ACTIVE_STATUSES.includes(res.status)) continue;

      const dateStr = typeof res.date === "string"
        ? res.date.split("T")[0]
        : format(new Date(res.date), "yyyy-MM-dd");

      const dayData = dayMap.get(dateStr);
      if (dayData) {
        dayData.reservations.push(res);
        dayData.totalSeats += res.seatsTotal || 0;
        dayData.groupCount += 1;
      }
    }

    return Array.from(dayMap.values());
  }, [allReservations, currentMonth]);

  // Global stats for the month
  const monthStats = useMemo(() => {
    const monthDays = calendarData.filter((d) => isSameMonth(d.date, currentMonth));
    const totalSeats = monthDays.reduce((sum, d) => sum + d.totalSeats, 0);
    const totalGroups = monthDays.reduce((sum, d) => sum + d.groupCount, 0);
    const daysWithReservations = monthDays.filter((d) => d.reservations.length > 0).length;
    return { totalSeats, totalGroups, daysWithReservations };
  }, [calendarData, currentMonth]);

  // Ramadan stats (19 février – 13 mars 2026)
  const RAMADAN_START = new Date(2026, 1, 19); // Feb 19
  const RAMADAN_END = new Date(2026, 2, 13);   // Mar 13

  const ramadanStats = useMemo(() => {
    const ramadanReservations = allReservations.filter((r) => {
      if (!r.date) return false;
      if (!ACTIVE_STATUSES.includes(r.status)) return false;
      const d = typeof r.date === "string" ? new Date(r.date) : new Date(r.date);
      return isWithinInterval(d, { start: RAMADAN_START, end: RAMADAN_END });
    });

    const totalSeats = ramadanReservations.reduce((sum, r) => sum + (r.seatsTotal || 0), 0);
    const totalGroups = ramadanReservations.length;

    const daysSet = new Set<string>();
    for (const r of ramadanReservations) {
      if (!r.date) continue;
      const dateStr = typeof r.date === "string"
        ? r.date.split("T")[0]
        : format(new Date(r.date), "yyyy-MM-dd");
      daysSet.add(dateStr);
    }

    return { totalSeats, totalGroups, daysWithReservations: daysSet.size };
  }, [allReservations]);

  const handleDayClick = (dayData: DayData) => {
    if (dayData.reservations.length === 0) return;
    setSelectedDay(dayData);
    setDialogOpen(true);
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
              Vous n'avez pas les droits pour accéder au calendrier des réservations.
            </p>
            <Link href="/admin">
              <Button variant="outline">Retour au dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
            <h1 className="font-bold text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-[#5d5a3c]" />
              Calendrier des Réservations
            </h1>
            <p className="text-xs text-muted-foreground">
              Vue mensuelle des réservations restaurant
            </p>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Ramadan Stats */}
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Moon className="h-5 w-5 text-amber-600" />
              <h2 className="font-bold text-amber-800">Ramadan 2026</h2>
              <span className="text-xs text-amber-600 ml-1">19 février – 13 mars</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 bg-white/70 rounded-xl p-3 border border-amber-200">
                <div className="w-11 h-11 rounded-full bg-amber-500 flex items-center justify-center">
                  <UtensilsCrossed className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-amber-700 font-medium">Places réservées</p>
                  <p className="text-2xl font-bold text-amber-900">{ramadanStats.totalSeats}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/70 rounded-xl p-3 border border-amber-200">
                <div className="w-11 h-11 rounded-full bg-orange-500 flex items-center justify-center">
                  <UsersRound className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-amber-700 font-medium">Réservations</p>
                  <p className="text-2xl font-bold text-amber-900">{ramadanStats.totalGroups}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/70 rounded-xl p-3 border border-amber-200">
                <div className="w-11 h-11 rounded-full bg-yellow-500 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-amber-700 font-medium">Jours avec réservations</p>
                  <p className="text-2xl font-bold text-amber-900">{ramadanStats.daysWithReservations}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Month Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-[#d4d4aa] bg-[#f5f5e8]/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#5d5a3c] flex items-center justify-center">
                <UtensilsCrossed className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#6b6b4e] font-medium">Places réservées</p>
                <p className="text-2xl font-bold text-[#5d5a3c]">{monthStats.totalSeats}</p>
                <p className="text-[10px] text-[#8b8b6e] capitalize">{format(currentMonth, "MMMM yyyy", { locale: fr })}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <UsersRound className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-700 font-medium">Groupes inscrits</p>
                <p className="text-2xl font-bold text-blue-900">{monthStats.totalGroups}</p>
                <p className="text-[10px] text-blue-600 capitalize">{format(currentMonth, "MMMM yyyy", { locale: fr })}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-violet-200 bg-violet-50/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-violet-700 font-medium">Jours avec réservations</p>
                <p className="text-2xl font-bold text-violet-900">{monthStats.daysWithReservations}</p>
                <p className="text-[10px] text-violet-600 capitalize">{format(currentMonth, "MMMM yyyy", { locale: fr })}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <Card className="border-[#d4d4aa]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-lg text-[#5d5a3c] capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: fr })}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#5d5a3c]" />
              </div>
            ) : (
              <div className="w-full">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-[#6b6b4e] py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarData.map((dayData) => {
                    const inCurrentMonth = isSameMonth(dayData.date, currentMonth);
                    const today = isToday(dayData.date);
                    const hasReservations = dayData.reservations.length > 0;

                    return (
                      <button
                        key={format(dayData.date, "yyyy-MM-dd")}
                        onClick={() => handleDayClick(dayData)}
                        disabled={!hasReservations}
                        className={`
                          relative min-h-[80px] sm:min-h-[100px] rounded-lg border p-1.5 text-left transition-all
                          ${!inCurrentMonth ? "opacity-40" : ""}
                          ${today ? "border-[#5d5a3c] ring-1 ring-[#5d5a3c]/30" : "border-[#e8e8d8]"}
                          ${hasReservations ? "cursor-pointer hover:bg-[#f5f5e8] hover:border-[#5d5a3c]/50" : "cursor-default"}
                          ${hasReservations ? "bg-[#fafaf0]" : "bg-white"}
                        `}
                      >
                        {/* Day number */}
                        <div className={`text-xs font-medium mb-1 ${today ? "text-[#5d5a3c] font-bold" : inCurrentMonth ? "text-[#5d5a3c]" : "text-[#b0b090]"}`}>
                          {format(dayData.date, "d")}
                        </div>

                        {/* Reservation data */}
                        {hasReservations && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <UtensilsCrossed className="h-3 w-3 text-[#5d5a3c] shrink-0" />
                              <span className="text-xs font-bold text-[#5d5a3c]">
                                {dayData.totalSeats}
                                <span className="font-normal text-[#6b6b4e] hidden sm:inline"> pl.</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <UsersRound className="h-3 w-3 text-[#6b6b4e] shrink-0" />
                              <span className="text-xs text-[#6b6b4e]">
                                {dayData.groupCount}
                                <span className="hidden sm:inline"> grp{dayData.groupCount > 1 ? "s" : ""}</span>
                              </span>
                            </div>
                            {/* Show first group name on larger screens */}
                            <div className="hidden sm:block">
                              {dayData.reservations.slice(0, 2).map((r) => (
                                <div
                                  key={r.id}
                                  className="text-[10px] text-[#6b6b4e] truncate leading-tight"
                                  title={getGroupLabel(r)}
                                >
                                  {getGroupLabel(r)}
                                </div>
                              ))}
                              {dayData.reservations.length > 2 && (
                                <div className="text-[10px] text-[#8b8b6e]">
                                  +{dayData.reservations.length - 2} autres
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#5d5a3c] flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                {selectedDay && format(selectedDay.date, "EEEE d MMMM yyyy", { locale: fr })}
              </DialogTitle>
              <DialogDescription>
                {selectedDay && (
                  <span>
                    {selectedDay.totalSeats} places réservées &bull; {selectedDay.groupCount} groupe{selectedDay.groupCount > 1 ? "s" : ""}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {selectedDay && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#f5f5e8] rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#5d5a3c]">{selectedDay.totalSeats}</p>
                    <p className="text-xs text-[#6b6b4e]">Places réservées</p>
                  </div>
                  <div className="bg-[#f5f5e8] rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-[#5d5a3c]">{selectedDay.groupCount}</p>
                    <p className="text-xs text-[#6b6b4e]">Groupes inscrits</p>
                  </div>
                </div>

                {/* Reservation list */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[#5d5a3c]">Détail des réservations</h3>
                  {selectedDay.reservations.map((r) => (
                    <div
                      key={`${r.type}-${r.id}`}
                      className="border border-[#e8e8d8] rounded-lg p-3 space-y-2 bg-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-[#5d5a3c]">
                          {getGroupLabel(r)}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          {getTypeBadge(r.type)}
                          {getStatusBadge(r.status)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#6b6b4e]">
                        <div>
                          <span className="text-[#8b8b6e]">Contact: </span>
                          <span className="font-medium">{r.name}</span>
                        </div>
                        <div>
                          <span className="text-[#8b8b6e]">Places: </span>
                          <span className="font-bold text-[#5d5a3c]">{r.seatsTotal}</span>
                        </div>
                        {r.phone && (
                          <div>
                            <span className="text-[#8b8b6e]">Tél: </span>
                            <span>{r.phone}</span>
                          </div>
                        )}
                        {r.displayChoice && (
                          <div>
                            <span className="text-[#8b8b6e]">Espace: </span>
                            <span className="capitalize">{r.displayChoice}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-[#b0b090] font-mono">
                        {r.reference}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
