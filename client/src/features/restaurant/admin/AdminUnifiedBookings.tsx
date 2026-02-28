/**
 * Unified Admin Dashboard for Restaurant Reservations
 * 
 * Centralized interface to manage all reservation requests:
 * - Groupes (groups)
 * - Entreprises (companies)
 * 
 * Features:
 * - Filter by type, slot, status, space
 * - View capacity allocation
 * - Confirm/reject/propose alternatives
 * - Automatic hold expiration tracking
 */

import { useState, useMemo } from "react";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";

type ReservationType = "groupe" | "entreprise";
type ReservationStatus = "submitted" | "pending_confirmation" | "confirmed" | "rejected" | "cancelled";

interface Reservation {
  id: number;
  reference: string;
  type: ReservationType;
  name: string;
  email: string;
  phone: string;
  seatsTotal: number;
  displayChoice: "jardin" | "brasserie" | "corpo";
  status: ReservationStatus;
  slotId: number;
  slotTime: string;
  allocatedSpace?: "brasserie" | "corpo" | "jardin_libre";
  expiresAt?: Date;
  createdAt: Date;
}

interface SlotCapacity {
  slotId: number;
  slotTime: string;
  brasserie: { available: number; booked: number; capacity: number };
  corpo: { available: number; booked: number; capacity: number };
  jardin_libre: { available: number; booked: number; capacity: number };
}

export default function AdminUnifiedBookings() {
  const { t } = useI18n();
  const [filterType, setFilterType] = useState<ReservationType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | "all">("all");
  const [filterSlot, setFilterSlot] = useState<number | "all">("all");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Mock data - replace with actual API calls
  const mockReservations: Reservation[] = [
    {
      id: 1,
      reference: "RES-G-51881B",
      type: "entreprise",
      name: "CONSULAT USA - Fatima Zahra Bentayebi",
      email: "bentayebif@stat.gov",
      phone: "06 66 96 93 08",
      seatsTotal: 15,
      displayChoice: "jardin",
      status: "confirmed",
      slotId: 1,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "corpo",
      createdAt: new Date("2026-02-24T20:00:00"),
    },
    {
      id: 2,
      reference: "RES-G-42646F",
      type: "groupe",
      name: "Particulier/parrain - Nawfal Sabik",
      email: "sabiknawfal@gmail.com",
      phone: "33 6 85 79 78 98",
      seatsTotal: 29,
      displayChoice: "jardin",
      status: "confirmed",
      slotId: 1,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "jardin_libre",
      createdAt: new Date("2026-02-24T20:00:00"),
    },
    {
      id: 3,
      reference: "RES-G-27B7DE",
      type: "groupe",
      name: "Particulier/parrain - Amina Benghalem",
      email: "aminabenghalem@yahoo.fr",
      phone: "06 61 32 92 63",
      seatsTotal: 32,
      displayChoice: "jardin",
      status: "confirmed",
      slotId: 2,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "jardin_libre",
      createdAt: new Date("2026-02-25T20:00:00"),
    },
    {
      id: 4,
      reference: "RES-G-1F22C8",
      type: "groupe",
      name: "Particulier/parrain - Saad Meddoun",
      email: "saad.meddoun@gmail.com",
      phone: "06 67 07 07 86",
      seatsTotal: 32,
      displayChoice: "brasserie",
      status: "confirmed",
      slotId: 3,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "brasserie",
      createdAt: new Date("2026-02-26T20:00:00"),
    },
    {
      id: 5,
      reference: "RES-G-A4FE32",
      type: "groupe",
      name: "Particulier - Rachel Wong",
      email: "beingrachely@gmail.com",
      phone: "1(404)8349386",
      seatsTotal: 2,
      displayChoice: "jardin",
      status: "confirmed",
      slotId: 3,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "jardin_libre",
      createdAt: new Date("2026-02-26T20:00:00"),
    },
    {
      id: 6,
      reference: "RES-G-6CBF34",
      type: "groupe",
      name: "Particulier - Maha Bennani",
      email: "maha.bennani1@gmail.com",
      phone: "212661260230",
      seatsTotal: 6,
      displayChoice: "jardin",
      status: "confirmed",
      slotId: 4,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "jardin_libre",
      createdAt: new Date("2026-02-27T20:00:00"),
    },
    {
      id: 7,
      reference: "RES-G-76509E",
      type: "entreprise",
      name: "Think ONE GROUP - Mariam Lahlou",
      email: "mariem.lahlou@thinkonegroup.com",
      phone: "666889434",
      seatsTotal: 7,
      displayChoice: "corpo",
      status: "confirmed",
      slotId: 4,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "corpo",
      createdAt: new Date("2026-02-27T20:00:00"),
    },
    {
      id: 8,
      reference: "RES-G-EC2D5E",
      type: "entreprise",
      name: "NUMU - Myriem Kadmiri",
      email: "Myriamk@numu.ma",
      phone: "+212 661 403303",
      seatsTotal: 33,
      displayChoice: "corpo",
      status: "confirmed",
      slotId: 4,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "corpo",
      createdAt: new Date("2026-02-27T20:00:00"),
    },
    {
      id: 9,
      reference: "RES-G-8C0128",
      type: "entreprise",
      name: "CHEF STEPHANE - Stephane Pierre",
      email: "stephane.pierre60@yahoo.com",
      phone: "06 36 08 17 41",
      seatsTotal: 14,
      displayChoice: "brasserie",
      status: "confirmed",
      slotId: 5,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "brasserie",
      createdAt: new Date("2026-02-28T20:00:00"),
    },
    {
      id: 10,
      reference: "RES-G-4A1CCF",
      type: "entreprise",
      name: "WEBRAND - Réda Essakali",
      email: "reda.essakalli@we-brand.ma",
      phone: "06 65 10 01 81",
      seatsTotal: 10,
      displayChoice: "corpo",
      status: "submitted",
      slotId: 6,
      slotTime: "20:00 - 22:30",
      createdAt: new Date("2026-03-03T20:00:00"),
    },
    {
      id: 11,
      reference: "RES-G-34890F",
      type: "entreprise",
      name: "STANLEY FIELD - Louloi Bargach",
      email: "lbargach@stanleyfield.com",
      phone: "06 79 33 09 72",
      seatsTotal: 23,
      displayChoice: "corpo",
      status: "submitted",
      slotId: 7,
      slotTime: "20:00 - 22:30",
      createdAt: new Date("2026-03-04T20:00:00"),
    },
    {
      id: 12,
      reference: "RES-G-FBF46B",
      type: "entreprise",
      name: "MONTESSORI - Hind Ratibe",
      email: "ratibehind3@gmail.com",
      phone: "",
      seatsTotal: 40,
      displayChoice: "corpo",
      status: "submitted",
      slotId: 8,
      slotTime: "20:00 - 22:30",
      createdAt: new Date("2026-03-05T20:00:00"),
    },
    {
      id: 13,
      reference: "RES-G-528B61",
      type: "entreprise",
      name: "APG - JAIDI",
      email: "Jaidi.abdou@gmail.com",
      phone: "212661196435",
      seatsTotal: 50,
      displayChoice: "corpo",
      status: "confirmed",
      slotId: 9,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "corpo",
      createdAt: new Date("2026-03-06T20:00:00"),
    },
    {
      id: 14,
      reference: "RES-G-291031",
      type: "groupe",
      name: "fatine chafai",
      email: "Fatine.chafai@gmail.com",
      phone: "+212 684 969618",
      seatsTotal: 20,
      displayChoice: "jardin",
      status: "submitted",
      slotId: 9,
      slotTime: "20:00 - 22:30",
      createdAt: new Date("2026-03-06T20:00:00"),
    },
    {
      id: 15,
      reference: "RES-G-2DBDB8",
      type: "entreprise",
      name: "CRÉDIT AGRICOLE - Jihane LOUKILI",
      email: "jihane.loukili@creditagricole.ma",
      phone: "06 29 06 97 35",
      seatsTotal: 103,
      displayChoice: "corpo",
      status: "confirmed",
      slotId: 10,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "corpo",
      createdAt: new Date("2026-03-07T20:00:00"),
    },
    {
      id: 16,
      reference: "RES-G-ADD271",
      type: "entreprise",
      name: "CARE MAROC - FATIMA ZAHRA",
      email: "baaoud@caremaroc.org",
      phone: "06 61 67 58 60",
      seatsTotal: 15,
      displayChoice: "corpo",
      status: "submitted",
      slotId: 11,
      slotTime: "20:00 - 22:30",
      createdAt: new Date("2026-03-10T20:00:00"),
    },
    {
      id: 17,
      reference: "RES-G-6B0C7E",
      type: "entreprise",
      name: "LAFARGE - Lamia JOUNDY",
      email: "",
      phone: "06 08 89 29 36",
      seatsTotal: 15,
      displayChoice: "corpo",
      status: "pending_confirmation",
      slotId: 12,
      slotTime: "20:00 - 22:30",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date("2026-03-11T20:00:00"),
    },
    {
      id: 18,
      reference: "RES-G-E590FF",
      type: "entreprise",
      name: "Wavestone - Hajar RIANE",
      email: "farah.berrada@wavestone.com",
      phone: "+212 665 647713",
      seatsTotal: 35,
      displayChoice: "corpo",
      status: "submitted",
      slotId: 12,
      slotTime: "20:00 - 22:30",
      createdAt: new Date("2026-03-11T20:00:00"),
    },
  ];

  const mockCapacities: SlotCapacity[] = [
    {
      slotId: 1,
      slotTime: "20:00 - 22:30",
      brasserie: { available: 30, booked: 20, capacity: 50 },
      corpo: { available: 30, booked: 20, capacity: 50 },
      jardin_libre: { available: 5, booked: 15, capacity: 20 },
    },
  ];

  // Filter reservations
  const filteredReservations = useMemo(() => {
    return mockReservations.filter((res) => {
      if (filterType !== "all" && res.type !== filterType) return false;
      if (filterStatus !== "all" && res.status !== filterStatus) return false;
      if (filterSlot !== "all" && res.slotId !== filterSlot) return false;
      return true;
    });
  }, [filterType, filterStatus, filterSlot]);

  const getStatusIcon = (status: ReservationStatus) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "pending_confirmation":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeColor = (type: ReservationType) => {
    switch (type) {
      case "groupe":
        return "bg-purple-100 text-purple-800";
      case "entreprise":
        return "bg-orange-100 text-orange-800";
    }
  };

  const getStatusColor = (status: ReservationStatus) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending_confirmation":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion Unifiée des Réservations</h1>
        <p className="text-gray-600 mt-2">
          Arbitrez toutes les demandes de réservation (groupes, entreprises) en un seul endroit
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium">Type de Réservation</label>
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="groupe">Groupe</SelectItem>
                <SelectItem value="entreprise">Entreprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Statut</label>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending_confirmation">En Attente</SelectItem>
                <SelectItem value="confirmed">Confirmée</SelectItem>
                <SelectItem value="rejected">Rejetée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Créneau</label>
            <Select value={String(filterSlot)} onValueChange={(v) => setFilterSlot(v === "all" ? "all" : parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="1">20:00 - 22:30</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFilterType("all");
                setFilterStatus("all");
                setFilterSlot("all");
              }}
              className="w-full"
            >
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Capacity Overview */}
      {mockCapacities.map((capacity) => (
        <Card key={capacity.slotId}>
          <CardHeader>
            <CardTitle>Capacité - {capacity.slotTime}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Brasserie", data: capacity.brasserie },
              { name: "Salle Corpo", data: capacity.corpo },
              { name: "Jardin Libre", data: capacity.jardin_libre },
            ].map((space) => (
              <div key={space.name} className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">{space.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Capacité:</span>
                    <span className="font-medium">{space.data.capacity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Réservé:</span>
                    <span className="font-medium">{space.data.booked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Disponible:</span>
                    <span className="font-medium text-green-600">{space.data.available}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(space.data.booked / space.data.capacity) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Reservations List */}
      <Card>
        <CardHeader>
          <CardTitle>Demandes de Réservation</CardTitle>
          <CardDescription>{filteredReservations.length} demande(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredReservations.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune demande de réservation</p>
            ) : (
              filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => setSelectedReservation(reservation)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{reservation.reference}</h3>
                        <Badge className={getTypeColor(reservation.type)}>
                          {reservation.type}
                        </Badge>
                        <Badge className={getStatusColor(reservation.status)}>
                          {reservation.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{reservation.name}</p>
                      <p className="text-sm text-gray-600">{reservation.email}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span>👥 {reservation.seatsTotal} places</span>
                        <span>🏠 {reservation.displayChoice}</span>
                        <span>📍 {reservation.allocatedSpace || "Non alloué"}</span>
                        <span>⏰ {reservation.slotTime}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(reservation.status)}
                      {reservation.expiresAt && (
                        <span className="text-xs text-gray-500">
                          Expire: {reservation.expiresAt.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {reservation.status === "pending_confirmation" && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <Button size="sm" variant="default">
                        ✓ Confirmer
                      </Button>
                      <Button size="sm" variant="outline">
                        💬 Proposer Alternative
                      </Button>
                      <Button size="sm" variant="destructive">
                        ✗ Rejeter
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Panel */}
      {selectedReservation && (
        <Card>
          <CardHeader>
            <CardTitle>Détails - {selectedReservation.reference}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Nom</p>
                <p className="font-medium">{selectedReservation.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{selectedReservation.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Téléphone</p>
                <p className="font-medium">{selectedReservation.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Places</p>
                <p className="font-medium">{selectedReservation.seatsTotal}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Choix d'Espace</p>
                <p className="font-medium">{selectedReservation.displayChoice}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Espace Alloué</p>
                <p className="font-medium">{selectedReservation.allocatedSpace || "En attente"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
