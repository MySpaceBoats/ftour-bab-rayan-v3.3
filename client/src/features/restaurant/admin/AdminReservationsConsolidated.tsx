import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UtensilsCrossed, Building2, UsersRound } from 'lucide-react';

// ============================================
// RÉSERVATIONS CONSOLIDÉES — 3 ONGLETS
// ============================================

export default function AdminReservationsConsolidated() {
  const [activeTab, setActiveTab] = useState<'particuliers' | 'entreprises' | 'groupes'>('particuliers');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <UtensilsCrossed className="w-8 h-8 text-amber-700" />
            <h1 className="text-3xl font-bold text-foreground">Réservations Unifiées</h1>
          </div>
          <p className="text-muted-foreground">Gérer réservations particuliers, entreprises et groupes en un seul endroit</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="particuliers" className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              <span className="hidden sm:inline">Particuliers</span>
            </TabsTrigger>
            <TabsTrigger value="entreprises" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Entreprises</span>
            </TabsTrigger>
            <TabsTrigger value="groupes" className="flex items-center gap-2">
              <UsersRound className="w-4 h-4" />
              <span className="hidden sm:inline">Groupes</span>
            </TabsTrigger>
          </TabsList>

          {/* Particuliers Tab */}
          <TabsContent value="particuliers">
            <Card>
              <CardHeader>
                <CardTitle>Réservations Particuliers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Réservations individuelles (max 12 places, paiement direct).
                </p>
                <div className="grid md:grid-cols-4 gap-4">
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">En attente</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Confirmées</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Refusées</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">Liste des réservations</h3>
                  <p className="text-sm text-muted-foreground">Aucune réservation enregistrée</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Entreprises Tab */}
          <TabsContent value="entreprises">
            <Card>
              <CardHeader>
                <CardTitle>Réservations Entreprises</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Réservations corporate soumises à confirmation admin (10-120 places).
                </p>
                <div className="grid md:grid-cols-4 gap-4">
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">En attente</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Confirmées</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Refusées</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">Liste des réservations</h3>
                  <p className="text-sm text-muted-foreground">Aucune réservation enregistrée</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Groupes Tab */}
          <TabsContent value="groupes">
            <Card>
              <CardHeader>
                <CardTitle>Réservations Groupes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Réservations groupes (assos, familles, délégations) soumises à confirmation (1-120 places).
                </p>
                <div className="grid md:grid-cols-4 gap-4">
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">En attente</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Confirmées</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Refusées</p>
                      <p className="text-2xl font-bold">0</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">Liste des réservations</h3>
                  <p className="text-sm text-muted-foreground">Aucune réservation enregistrée</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
