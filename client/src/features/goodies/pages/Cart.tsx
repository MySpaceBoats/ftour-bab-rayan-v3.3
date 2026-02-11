import { Link } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Cart() {
  const { lang } = useI18n();
  const type = window.location.pathname.split('/').pop() || 'patisserie';

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Panier ({type})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              MVP: écran panier unifié prêt pour les modules pâtisserie / terroir / goodies.
            </p>
            <div className="p-4 rounded-lg border flex items-center justify-between">
              <div>
                <p className="font-medium">Article exemple</p>
                <p className="text-sm text-muted-foreground">Quantité: 1</p>
              </div>
              <Badge>120 MAD</Badge>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>120 MAD</span>
            </div>
            <Link href={`/${lang}/checkout/${type}`}>
              <Button className="w-full">Passer au checkout</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
