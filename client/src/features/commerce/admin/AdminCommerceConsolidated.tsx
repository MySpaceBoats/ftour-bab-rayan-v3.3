import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, UtensilsCrossed, Leaf, BarChart3 } from 'lucide-react';

// ============================================
// COMMERCE CONSOLIDÉ — 4 ONGLETS
// ============================================

export default function AdminCommerceConsolidated() {
  const [activeTab, setActiveTab] = useState<'goodies' | 'terroir' | 'patisserie' | 'paiements'>('goodies');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-foreground">Commerce Unifié</h1>
          </div>
          <p className="text-muted-foreground">Gérer Goodies, Terroir, Pâtisserie et Paiements en un seul endroit</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="goodies" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Goodies</span>
            </TabsTrigger>
            <TabsTrigger value="terroir" className="flex items-center gap-2">
              <Leaf className="w-4 h-4" />
              <span className="hidden sm:inline">Terroir</span>
            </TabsTrigger>
            <TabsTrigger value="patisserie" className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              <span className="hidden sm:inline">Pâtisserie</span>
            </TabsTrigger>
            <TabsTrigger value="paiements" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Paiements</span>
            </TabsTrigger>
          </TabsList>

          {/* Goodies Tab */}
          <TabsContent value="goodies">
            <Card>
              <CardHeader>
                <CardTitle>Goodies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Gérer les commandes et le catalogue de goodies.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Commandes</h3>
                      <p className="text-sm text-muted-foreground">Voir et gérer les commandes de goodies</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Catalogue</h3>
                      <p className="text-sm text-muted-foreground">Ajouter, éditer, supprimer des produits</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Terroir Tab */}
          <TabsContent value="terroir">
            <Card>
              <CardHeader>
                <CardTitle>Produits du Terroir</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Gérer les commandes et le catalogue de produits du terroir.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Commandes</h3>
                      <p className="text-sm text-muted-foreground">Voir et gérer les commandes de terroir</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Catalogue</h3>
                      <p className="text-sm text-muted-foreground">Ajouter, éditer, supprimer des produits</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patisserie Tab */}
          <TabsContent value="patisserie">
            <Card>
              <CardHeader>
                <CardTitle>Pâtisserie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Gérer les commandes et le catalogue de pâtisserie.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Commandes</h3>
                      <p className="text-sm text-muted-foreground">Voir et gérer les commandes de pâtisserie</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Catalogue</h3>
                      <p className="text-sm text-muted-foreground">Ajouter, éditer, supprimer des produits</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Paiements Tab */}
          <TabsContent value="paiements">
            <Card>
              <CardHeader>
                <CardTitle>Suivi des Paiements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Suivre et gérer tous les paiements du commerce (Goodies, Terroir, Pâtisserie).
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total paiements</p>
                      <p className="text-2xl font-bold">0 DH</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">En attente</p>
                      <p className="text-2xl font-bold">0 DH</p>
                    </CardContent>
                  </Card>
                  <Card className="border">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Reçus</p>
                      <p className="text-2xl font-bold">0 DH</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="pt-4 border-t">
                  <h3 className="font-semibold mb-4">Historique des paiements</h3>
                  <p className="text-sm text-muted-foreground">Aucun paiement enregistré</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
