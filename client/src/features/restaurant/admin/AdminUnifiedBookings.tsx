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
      id: 2,
      reference: "RES-E-00002",
      type: "entreprise",
      name: "TechCorp Morocco",
      email: "booking@techcorp.ma",
      phone: "+212 5 22 12 34 56",
      seatsTotal: 20,
      displayChoice: "corpo",
      status: "pending_confirmation",
      slotId: 1,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "corpo",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    },
    {
      id: 3,
      reference: "RES-G-00003",
      type: "groupe",
      name: "Association Solidarité",
      email: "contact@asso.ma",
      phone: "+212 6 98 76 54 32",
      seatsTotal: 15,
      displayChoice: "brasserie",
      status: "confirmed",
      slotId: 1,
      slotTime: "20:00 - 22:30",
      allocatedSpace: "brasserie",
      createdAt: new Date(),
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
