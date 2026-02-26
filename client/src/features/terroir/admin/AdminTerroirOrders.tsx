import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import RequireRole from "@/components/RequireRole";
import {
  ArrowLeft, Search, Loader2, Package, CheckCircle, XCircle, Clock, Truck, Trash2
} from "lucide-react";

const statusLabels: Record<string, string> = {
  created: "Créée",
  paid: "Payée",
  ready: "Prête",
  picked_up: "Retirée",
  cancelled: "Annulée",
  no_show: "No-show",
};

const statusColors: Record<string, string> = {
  created: "bg-gray-100 text-gray-700",
  paid: "bg-green-100 text-green-700",
  ready: "bg-blue-100 text-blue-700",
  picked_up: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

export default function AdminTerroirOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: orders, isLoading, refetch } = trpc.terroirModule.adminListOrders.useQuery(
    { status: statusFilter !== "all" ? statusFilter : undefined, search: search || undefined }
  );
  const { data: stats } = trpc.terroirModule.adminStats.useQuery();

  const updateStatusMutation = trpc.terroirModule.adminUpdateOrderStatus.useMutation({
    onSuccess: () => { toast.success("Statut mis à jour"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOrderMutation = trpc.terroirModule.adminDeleteOrder.useMutation({
    onSuccess: () => { toast.success("Commande supprimée"); refetch(); },
    onError: (err: any) => toast.error(err.message || "Erreur lors de la suppression"),
  });

  const handleDeleteOrder = (order: any) => {
    const confirmed = window.confirm(
      `Supprimer définitivement la commande ${order.order_reference} ?`
    );
    if (!confirmed) return;
    deleteOrderMutation.mutate({ id: order.id });
  };

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_terroir"]}>
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="container flex h-16 items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg">Commandes Terroir</h1>
              <p className="text-xs text-muted-foreground">{orders?.length || 0} commande(s)</p>
            </div>
          </div>
        </header>

        <main className="container py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats?.byStatus?.paid || 0}</div>
                <div className="text-xs text-muted-foreground">Payées</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats?.byStatus?.ready || 0}</div>
                <div className="text-xs text-muted-foreground">Prêtes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{stats?.byStatus?.picked_up || 0}</div>
                <div className="text-xs text-muted-foreground">Retirées</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher par nom, tél, référence..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="created">Créée</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
                  <SelectItem value="ready">Prête</SelectItem>
                  <SelectItem value="picked_up">Retirée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                  <SelectItem value="no_show">No-show</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders && orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Référence</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.order_reference}</TableCell>
                          <TableCell>
                            <div className="font-medium">{order.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                          </TableCell>
                          <TableCell className="font-medium">{parseFloat(order.total_amount).toFixed(2)} DH</TableCell>
                          <TableCell>
                            <Badge className={statusColors[order.status] || "bg-gray-100"}>
                              {statusLabels[order.status] || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {order.status === "created" && (
                                <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: order.id, status: "paid" })}>
                                  <CheckCircle className="h-4 w-4 mr-1" /> Payée
                                </Button>
                              )}
                              {order.status === "paid" && (
                                <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: order.id, status: "ready" })}>
                                  <Package className="h-4 w-4 mr-1" /> Prête
                                </Button>
                              )}
                              {order.status === "ready" && (
                                <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: order.id, status: "picked_up" })}>
                                  <Truck className="h-4 w-4 mr-1" /> Retirée
                                </Button>
                              )}
                              {!["picked_up", "cancelled", "no_show"].includes(order.status) && (
                                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => updateStatusMutation.mutate({ id: order.id, status: "cancelled" })}>
                                  <XCircle className="h-4 w-4 mr-1" /> Annuler
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-700"
                                onClick={() => handleDeleteOrder(order)}
                                disabled={deleteOrderMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Aucune commande trouvée</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </RequireRole>
  );
}
