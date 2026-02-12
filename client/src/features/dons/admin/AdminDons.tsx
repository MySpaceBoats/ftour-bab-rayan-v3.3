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
  ArrowLeft, Search, Download, Heart, CheckCircle, XCircle, 
  Clock, Loader2, Mail, Phone, Building2, CreditCard
} from "lucide-react";

export default function AdminDons() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedDonation, setSelectedDonation] = useState<number | null>(null);

  const { data: donations, isLoading, refetch } = trpc.donations.listAll.useQuery();
  const { data: stats } = trpc.donations.stats.useQuery();

  const updateStatusMutation = trpc.donations.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Statut mis à jour");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const filteredDonations = donations?.filter((d: any) => {
    const matchesSearch = searchQuery === "" || 
      d.donorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.donorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.donationReference.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    const matchesPayment = paymentFilter === "all" || d.paymentMethod === paymentFilter;
    
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'promised':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />Promis</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case 'received':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Reçu</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (method: string) => {
    switch (method) {
      case 'transfer':
        return <Badge variant="outline"><Building2 className="h-3 w-3 mr-1" />Virement</Badge>;
      case 'on_site':
        return <Badge variant="outline"><CreditCard className="h-3 w-3 mr-1" />Sur place</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (!filteredDonations || filteredDonations.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const headers = ["Référence", "Donateur", "Email", "Téléphone", "Montant", "Mode", "Statut", "Date"];
    const rows = filteredDonations.map((d: any) => [
      d.donationReference,
      d.isAnonymous ? "Anonyme" : d.donorName,
      d.donorEmail,
      d.donorPhone || "",
      `${d.amount} DH`,
      d.paymentMethod === 'transfer' ? 'Virement' : 'Sur place',
      d.status,
      new Date(d.createdAt).toLocaleDateString('fr-FR'),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `dons_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success("Export CSV téléchargé");
  };

  const currentDonation = donations?.find((d: any) => d.id === selectedDonation);

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
            <h1 className="font-bold text-lg">Gestion des dons</h1>
            <p className="text-xs text-muted-foreground">
              {filteredDonations?.length || 0} promesse(s) de don
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
                  <SelectItem value="promised">Promis</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="received">Reçu</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Tous les modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les modes</SelectItem>
                  <SelectItem value="transfer">Virement</SelectItem>
                  <SelectItem value="on_site">Sur place</SelectItem>
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
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <div className="text-xs text-muted-foreground">Total promesses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {stats?.totalAmount || 0} DH
              </div>
              <div className="text-xs text-muted-foreground">Montant total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats?.receivedAmount || 0} DH
              </div>
              <div className="text-xs text-muted-foreground">Reçus</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {((stats?.totalAmount || 0) - (stats?.receivedAmount || 0))} DH
              </div>
              <div className="text-xs text-muted-foreground">En attente</div>
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
            ) : filteredDonations && filteredDonations.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Donateur</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDonations.map((donation: any) => (
                      <TableRow key={donation.id}>
                        <TableCell>
                          <span className="font-mono text-sm">{donation.donationReference}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {donation.isAnonymous ? "Anonyme" : donation.donorName}
                            </div>
                            <div className="text-xs text-muted-foreground">{donation.donorEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-primary">{donation.amount} DH</span>
                        </TableCell>
                        <TableCell>{getPaymentBadge(donation.paymentMethod)}</TableCell>
                        <TableCell>{getStatusBadge(donation.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(donation.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedDonation(donation.id)}
                            >
                              Détails
                            </Button>
                            {donation.status !== 'received' && donation.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() => updateStatusMutation.mutate({ donationId: donation.id, status: 'received' })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {donation.status !== 'cancelled' && donation.status !== 'received' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => updateStatusMutation.mutate({ donationId: donation.id, status: 'cancelled' })}
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
                <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucun don trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Donation Detail Dialog */}
      <Dialog open={selectedDonation !== null} onOpenChange={() => setSelectedDonation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails du don</DialogTitle>
          </DialogHeader>
          
          {currentDonation && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg">{currentDonation.donationReference}</span>
                {getStatusBadge(currentDonation.status)}
              </div>

              <div className="text-center py-4 bg-muted/50 rounded-lg">
                <div className="text-3xl font-bold text-primary">{currentDonation.amount} DH</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {getPaymentBadge(currentDonation.paymentMethod)}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Donateur</span>
                  <span>{currentDonation.isAnonymous ? "Anonyme" : currentDonation.donorName}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Email</span>
                  <span>{currentDonation.donorEmail}</span>
                </div>
                {currentDonation.donorPhone && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Téléphone</span>
                    <span>{currentDonation.donorPhone}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date</span>
                  <span>{new Date(currentDonation.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>

              {currentDonation.message && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Message</p>
                  <p className="italic">"{currentDonation.message}"</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
