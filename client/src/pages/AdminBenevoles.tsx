import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  ArrowLeft, Search, Download, Users, CheckCircle, XCircle, 
  Clock, Filter, Loader2, QrCode, Mail, Phone, Calendar
} from "lucide-react";

export default function AdminBenevoles() {
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedVolunteer, setSelectedVolunteer] = useState<number | null>(null);

  const { data: days } = trpc.days.list.useQuery();
  const { data: volunteers, isLoading, refetch } = trpc.volunteers.listByDay.useQuery(
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
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const volunteersList = volunteers?.volunteers || [];
  const filteredVolunteers = volunteersList.filter((v: any) => {
    const matchesSearch = searchQuery === "" || 
      v.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />Inscrit</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Confirmé</Badge>;
      case 'present':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Présent</Badge>;
      case 'absent':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Absent</Badge>;
      case 'cancelled':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (!filteredVolunteers || filteredVolunteers.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const headers = ["Prénom", "Nom", "Email", "Téléphone", "Ville", "Jour", "Statut", "Date inscription"];
    const rows = filteredVolunteers.map(v => [
      v.firstName,
      v.lastName,
      v.email,
      v.phone,
      v.city || "",
      `Jour ${v.day?.dayNumber || ""}`,
      v.status,
      new Date(v.createdAt).toLocaleDateString('fr-FR'),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `benevoles_${selectedDay === "all" ? "tous" : `jour_${selectedDay}`}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success("Export CSV téléchargé");
  };

  const currentVolunteer = volunteersList.find((v: any) => v.id === selectedVolunteer);

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
              {filteredVolunteers?.length || 0} bénévole(s)
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
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                  {days?.map((day) => (
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
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{volunteersList.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {volunteersList.filter((v: any) => v.status === 'registered').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Inscrits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {volunteersList.filter((v: any) => v.status === 'confirmed').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Confirmés</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {volunteersList.filter((v: any) => v.status === 'present').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Présents</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {volunteersList.filter((v: any) => v.status === 'absent').length || 0}
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
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVolunteers.map((volunteer) => (
                      <TableRow key={volunteer.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{volunteer.firstName} {volunteer.lastName}</div>
                            <div className="text-xs text-muted-foreground">{volunteer.city}</div>
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
                        <TableCell>{getStatusBadge(volunteer.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedVolunteer(volunteer.id)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            {volunteer.status !== 'present' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600"
                                onClick={() => updateStatusMutation.mutate({ volunteerId: volunteer.id, status: 'present' })}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {volunteer.status !== 'absent' && volunteer.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => updateStatusMutation.mutate({ volunteerId: volunteer.id, status: 'absent' })}
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
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucun bénévole trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Volunteer Detail Dialog */}
      <Dialog open={selectedVolunteer !== null} onOpenChange={() => setSelectedVolunteer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails du bénévole</DialogTitle>
          </DialogHeader>
          
          {currentVolunteer && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <span className="text-2xl font-bold text-primary">
                    {currentVolunteer.firstName.charAt(0)}{currentVolunteer.lastName.charAt(0)}
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
                  <span className="text-muted-foreground">Inscription</span>
                  <span>{new Date(currentVolunteer.createdAt).toLocaleDateString('fr-FR')}</span>
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
    </div>
  );
}
