import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';

export default function ProduitsTerroir() {
  const { lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <Navbar />
      <main className="flex-1 bg-muted/20 py-16">
        <div className="container max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Produits terroir indisponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Cette section a été vidée. Aucun produit terroir n&apos;est affiché pour le moment.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
