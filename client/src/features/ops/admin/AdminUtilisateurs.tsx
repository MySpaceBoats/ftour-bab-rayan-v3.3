import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Users, Loader2, Shield, UserCog, Mail, Plus
} from "lucide-react";

const roleLabels: Record<string, string> = {
  user: "Utilisateur",
  admin: "Admin",
  super_admin: "Super Admin",
  admin_ops: "Admin Opérations",
  admin_boutique: "Admin Boutique",
  admin_dons: "Admin Dons",
  scanner: "Scanner",
  admin_restaurant_particuliers: "Admin Restaurant Particuliers",
  admin_restaurant_entreprises: "Admin Restaurant Entreprises",
  admin_restaurant_groupes: "Admin Restaurant Groupes",
  admin_patisserie: "Admin Pâtisserie",
  admin_terroir: "Admin Terroir",
};

const roleColors: Record<string, string> = {
  user: "bg-gray-100 text-gray-700",
  admin: "bg-blue-100 text-blue-700",
  super_admin: "bg-purple-100 text-purple-700",
  admin_ops: "bg-green-100 text-green-700",
  admin_boutique: "bg-orange-100 text-orange-700",
  admin_dons: "bg-pink-100 text-pink-700",
  scanner: "bg-cyan-100 text-cyan-700",
  admin_restaurant_particuliers: "bg-amber-100 text-amber-700",
  admin_restaurant_entreprises: "bg-indigo-100 text-indigo-700",
  admin_restaurant_groupes: "bg-teal-100 text-teal-700",
  admin_patisserie: "bg-rose-100 text-rose-700",
  admin_terroir: "bg-emerald-100 text-emerald-700",
};

export default function AdminUtilisateurs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "user" as string,
  });

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Utilisateur créé avec succès");
      setShowCreateDialog(false);
      setNewUser({ email: "", password: "", name: "", phone: "", role: "user" });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création de l'utilisateur");
    },
  });

  const filteredUsers = users?.filter((u: any) => {
    const matchesSearch = searchQuery === "" ||
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const handleRoleChange = (userId: number, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole as any });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password) {
      toast.error("Email et mot de passe sont obligatoires");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    createUserMutation.mutate({
      email: newUser.email,
      password: newUser.password,
      name: newUser.name || undefined,
      phone: newUser.phone || undefined,
      role: newUser.role as any,
    });
  };

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
          <div className="flex-1">
            <h1 className="font-bold text-lg">Gestion des utilisateurs</h1>
            <p className="text-xs text-muted-foreground">
              {filteredUsers?.length || 0} utilisateur(s)
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreateUser}>
                <DialogHeader>
                  <DialogTitle>Nouvel utilisateur</DialogTitle>
                  <DialogDescription>
                    Créez un nouveau compte utilisateur avec un email et un mot de passe.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input
                      id="name"
                      placeholder="Nom complet"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@exemple.com"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Mot de passe *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimum 6 caractères"
                      required
                      minLength={6}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      placeholder="06 00 00 00 00"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Rôle</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utilisateur</SelectItem>
                        <SelectItem value="scanner">Scanner</SelectItem>
                        <SelectItem value="admin_ops">Admin Opérations</SelectItem>
                        <SelectItem value="admin_boutique">Admin Boutique</SelectItem>
                        <SelectItem value="admin_dons">Admin Dons</SelectItem>
                        <SelectItem value="admin_restaurant_particuliers">Admin Restaurant Particuliers</SelectItem>
                        <SelectItem value="admin_restaurant_entreprises">Admin Restaurant Entreprises</SelectItem>
                        <SelectItem value="admin_restaurant_groupes">Admin Restaurant Groupes</SelectItem>
                        <SelectItem value="admin_patisserie">Admin Pâtisserie</SelectItem>
                        <SelectItem value="admin_terroir">Admin Terroir</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      "Créer l'utilisateur"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container py-8">
        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{users?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {users?.filter((u: any) => u.role === 'super_admin').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Super Admins</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {users?.filter((u: any) => ['admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes', 'admin_patisserie', 'admin_terroir'].includes(u.role)).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Admins</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-cyan-600">
                {users?.filter((u: any) => u.role === 'scanner').length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Scanners</div>
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
            ) : filteredUsers && filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rôle actuel</TableHead>
                      <TableHead>Dernière connexion</TableHead>
                      <TableHead>Modifier le rôle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                              </span>
                            </div>
                            <span className="font-medium">{user.name || "Sans nom"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {user.email || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[user.role] || "bg-gray-100"}>
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString('fr-FR') : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Utilisateur</SelectItem>
                              <SelectItem value="scanner">Scanner</SelectItem>
                              <SelectItem value="admin_ops">Admin Opérations</SelectItem>
                              <SelectItem value="admin_boutique">Admin Boutique</SelectItem>
                              <SelectItem value="admin_dons">Admin Dons</SelectItem>
                              <SelectItem value="admin_restaurant_particuliers">Admin Restaurant Particuliers</SelectItem>
                              <SelectItem value="admin_restaurant_entreprises">Admin Restaurant Entreprises</SelectItem>
                              <SelectItem value="admin_restaurant_groupes">Admin Restaurant Groupes</SelectItem>
                              <SelectItem value="admin_patisserie">Admin Pâtisserie</SelectItem>
                              <SelectItem value="admin_terroir">Admin Terroir</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Legend */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Légende des rôles
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <Badge className={roleColors.super_admin}>Super Admin</Badge>
                <p className="text-muted-foreground mt-1">Accès complet à toutes les fonctionnalités</p>
              </div>
              <div>
                <Badge className={roleColors.admin}>Admin</Badge>
                <p className="text-muted-foreground mt-1">Accès à toutes les sections admin</p>
              </div>
              <div>
                <Badge className={roleColors.admin_ops}>Admin Opérations</Badge>
                <p className="text-muted-foreground mt-1">Gestion des bénévoles et scanner</p>
              </div>
              <div>
                <Badge className={roleColors.admin_boutique}>Admin Boutique</Badge>
                <p className="text-muted-foreground mt-1">Gestion des goodies et commandes</p>
              </div>
              <div>
                <Badge className={roleColors.admin_dons}>Admin Dons</Badge>
                <p className="text-muted-foreground mt-1">Gestion des promesses de dons</p>
              </div>
              <div>
                <Badge className={roleColors.scanner}>Scanner</Badge>
                <p className="text-muted-foreground mt-1">Scan des QR codes uniquement</p>
              </div>
              <div>
                <Badge className={roleColors.admin_restaurant_particuliers}>Admin Restaurant Particuliers</Badge>
                <p className="text-muted-foreground mt-1">Réservations restaurant individuelles</p>
              </div>
              <div>
                <Badge className={roleColors.admin_restaurant_entreprises}>Admin Restaurant Entreprises</Badge>
                <p className="text-muted-foreground mt-1">Réservations restaurant entreprises</p>
              </div>
              <div>
                <Badge className={roleColors.admin_restaurant_groupes}>Admin Restaurant Groupes</Badge>
                <p className="text-muted-foreground mt-1">Réservations restaurant groupes</p>
              </div>
              <div>
                <Badge className={roleColors.admin_patisserie}>Admin Pâtisserie</Badge>
                <p className="text-muted-foreground mt-1">Gestion des commandes pâtisserie</p>
              </div>
              <div>
                <Badge className={roleColors.admin_terroir}>Admin Terroir</Badge>
                <p className="text-muted-foreground mt-1">Gestion des produits et commandes terroir</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
