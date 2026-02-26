import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import RequireRole from '@/components/RequireRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminTerroirProducts() {
  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_terroir"]}>
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="container flex h-16 items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" aria-label="Retour">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg">Catalogue Terroir</h1>
              <p className="text-xs text-muted-foreground">Section produits vidée</p>
            </div>
          </div>
        </header>

        <main className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle>Produits terroir indisponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Le contenu de la section produit terroir a été retiré du backoffice.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </RequireRole>
  );
}
