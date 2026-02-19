import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Loader2, CheckCircle, XCircle,
  Clock, UsersRound, Users, CreditCard, Bug
} from "lucide-react";

export default function AdminRestaurantGroupes() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showDebug, setShowDebug] = useState(false);

  const allowedRoles = ['admin', 'super_admin', 'admin_restaurant'];
  const hasAccess = user?.role && allowedRoles.includes(user.role);

  const { data: reservations, isLoading, isError, error, refetch } = trpc.restaurantReservations.adminListGroupes.useQuery(undefined, {
    enabled: !!hasAccess,
    retry: 1,
  });

  // Debug: fetch raw Supabase data to diagnose column issues
  const { data: debugData } = trpc.restaurantReservations.debugRawData.useQuery(undefined, {
    enabled: !!hasAccess && showDebug,
    retry: 1,
  });

  const validateMutation = trpc.restaurantReservations.validate.useMutation({
    onSuccess: () => {
      toast.success("Réservation validée, email de confirmation envoyé");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const refuseMutation = trpc.restaurantReservations.refuse.useMutation({
    onSuccess: () => {
      toast.success("Réservation refusée, email de notification envoyé");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = trpc.restaurantReservations.adminUpdateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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

  const filteredReservations = reservations?.filter((r: any) => {
    const matchesSearch = searchQuery === "" ||
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.groupName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_validation':
      case 'submitted':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case 'validated_pending_payment':
      case 'pending_confirmation':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><CreditCard className="h-3 w-3 mr-1" />Paiement attendu</Badge>;
      case 'paid_confirmed':
      case 'confirmed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Confirmée</Badge>;
      case 'refused':
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Refusée</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Annulée</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-600"><CheckCircle className="h-3 w-3 mr-1" />Terminée</Badge>;
      case 'no_show':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">No show</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR');
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
              {filteredReservations?.length || 0} réservation(s) - soumises à confirmation
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
              <SelectItem value="validated_pending_payment">Paiement attendu</SelectItem>
              <SelectItem value="paid_confirmed">Confirmée</SelectItem>
              <SelectItem value="refused">Refusée</SelectItem>
              <SelectItem value="cancelled">Annulée</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
              <SelectItem value="no_show">No show</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Debug Panel */}
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)} className="text-xs">
            <Bug className="h-3 w-3 mr-1" />
            {showDebug ? 'Masquer debug' : 'Afficher debug'}
          </Button>
          {showDebug && (
            <Card className="mt-2 border-yellow-300 bg-yellow-50">
              <CardContent className="p-4 text-xs font-mono space-y-2">
                <p className="font-bold text-yellow-800">Diagnostic Supabase (raw data)</p>
                {debugData?.error && (
                  <p className="text-red-600">Erreur: {debugData.error}</p>
                )}
                {debugData && !debugData.error && (
                  <>
                    <p><strong>Colonnes DB:</strong> {debugData.columns?.join(', ') || 'aucune'}</p>
                    <p><strong>Nombre de lignes:</strong> {debugData.rowCount}</p>
                    {debugData.rows?.map((row: any, i: number) => (
                      <details key={i} className="border border-yellow-200 rounded p-2">
                        <summary className="cursor-pointer text-yellow-800">
                          Ligne {i + 1} - seats_total: {row.seats_total} | group_name: {row.group_name}
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                          {JSON.stringify(row, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </>
                )}
                {reservations && reservations.length > 0 && (
                  <details className="border border-blue-200 rounded p-2 bg-blue-50">
                    <summary className="cursor-pointer text-blue-800">
                      Mapped data (1ere reservation) - groupName: {(reservations[0] as any).groupName} | seatsTotal: {(reservations[0] as any).seatsTotal}
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                      {JSON.stringify((reservations[0] as any)._debug, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
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
              <p className="text-red-600 font-medium">Erreur lors du chargement des réservations</p>
              <p className="text-sm text-muted-foreground">{error?.message || 'Erreur inconnue'}</p>
              <Button variant="outline" onClick={() => refetch()}>Réessayer</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Groupe</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Places</TableHead>
                    <TableHead>Date ftour</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Aucune réservation trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReservations?.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.reference}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.groupName || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <div>{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.phone}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell>{r.seatsTotal}</TableCell>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(r.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(r.status === 'pending_validation' || r.status === 'submitted') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600"
                                  onClick={() => validateMutation.mutate({
                                    reference: r.reference,
                                    baseUrl: window.location.origin,
                                  })}
                                  disabled={validateMutation.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Valider
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600"
                                  onClick={() => refuseMutation.mutate({ reference: r.reference })}
                                  disabled={refuseMutation.isPending}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Refuser
                                </Button>
                              </>
                            )}
                            {(['validated_pending_payment', 'pending_confirmation', 'paid_confirmed', 'confirmed'].includes(r.status)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'completed' })}
                              >
                                Terminer
                              </Button>
                            )}
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
    </div>
  );
}
