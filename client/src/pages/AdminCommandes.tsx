import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  ArrowLeft, Search, Download, Package, CheckCircle, XCircle, 
  Clock, Loader2, Mail, Phone, ShoppingBag, CreditCard
} from "lucide-react";

export default function AdminCommandes() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);

  const { data: orders, isLoading, refetch } = trpc.orders.listAll.useQuery();

  const updateStatusMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const filteredOrders = orders?.filter((o: any) => {
    const matchesSearch = searchQuery === "" || 
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderReference.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reserved':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />Réservé</Badge>;
      case 'paid':
        return <Badge className="bg-green-500"><CreditCard className="h-3 w-3 mr-1" />Payé</Badge>;
      case 'delivered':
        return <Badge className="bg-emerald-500"><CheckCircle className="h-3 w-3 mr-1" />Remis</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const headers = ["Référence", "Client", "Email", "Téléphone", "Total", "Statut", "Date"];
    const rows = filteredOrders.map((o: any) => [
      o.orderReference,
      o.customerName,
      o.customerEmail,
      o.customerPhone,
      `${o.totalAmount} DH`,
      o.status,
      new Date(o.createdAt).toLocaleDateString('fr-FR'),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `commandes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success("Export CSV téléchargé");
  };

  const currentOrder = orders?.find(o => o.id === selectedOrder);

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
            <h1 className="font-bold text-lg">Gestion des commandes</h1>
            <p className="text-xs text-muted-foreground">
              {filteredOrders?.length || 0} commande(s)
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
                    placeholder="Rechercher par référence, nom ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="reserved">Réservé</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="delivered">Remis</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{orders?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {orders?.filter((o: any) => o.status === 'reserved').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Réservées</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {orders?.filter((o: any) => o.status === 'paid').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Payées</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {orders?.filter((o: any) => o.status === 'delivered').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Remises</div>
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
            ) : filteredOrders && filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <span className="font-mono text-sm">{order.orderReference}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customerName}</div>
                            <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold">{order.totalAmount} DH</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedOrder(order.id)}
                            >
                              Détails
                            </Button>
                            {order.status === 'reserved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'paid' })}
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            )}
                            {order.status === 'paid' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600"
                                onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'delivered' })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {order.status !== 'cancelled' && order.status !== 'delivered' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'cancelled' })}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucune commande trouvée</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Order Detail Dialog */}
      <Dialog open={selectedOrder !== null} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails de la commande</DialogTitle>
          </DialogHeader>
          
          {currentOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg">{currentOrder.orderReference}</span>
                {getStatusBadge(currentOrder.status)}
              </div>

              <div className="space-y-2 text-sm border-t pt-4">
                <h4 className="font-semibold">Client</h4>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Nom</span>
                  <span>{currentOrder.customerName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Email</span>
                  <span>{currentOrder.customerEmail}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Téléphone</span>
                  <span>{currentOrder.customerPhone}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm border-t pt-4">
                <h4 className="font-semibold">Articles</h4>
                {currentOrder.items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between py-1">
                    <span>
                      {item.goodie?.name || 'Article'} 
                      {item.variant && ` (${item.variant.size || ''} ${item.variant.color || ''})`}
                      <span className="text-muted-foreground"> x{item.quantity}</span>
                    </span>
                    <span>{item.unitPrice} DH</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">{currentOrder.totalAmount} DH</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Commande passée le {new Date(currentOrder.createdAt).toLocaleDateString('fr-FR')} à {new Date(currentOrder.createdAt).toLocaleTimeString('fr-FR')}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
