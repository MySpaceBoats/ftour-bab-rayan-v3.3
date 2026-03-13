import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { CheckCircle } from 'lucide-react';

interface TerroirConfirmationProps {
  reference: string;
  total: number;
  onBackToCatalog: () => void;
}

export default function TerroirConfirmation({ reference, total, onBackToCatalog }: TerroirConfirmationProps) {
  const { t, lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      <Navbar />
      <main className="container flex-1 py-12 max-w-2xl">
        <Card>
          <CardContent className="pt-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <h1 className="text-3xl font-bold">{t.terroir.reservationConfirmed}</h1>
            <p className="text-muted-foreground">Votre commande terroir a bien été enregistrée.</p>
            <div className="rounded-lg bg-amber-50 p-4 border">
              <p className="text-sm text-muted-foreground">Référence</p>
              <p className="text-2xl font-semibold text-amber-700 font-mono">{reference}</p>
            </div>
            <p className="text-lg font-semibold">Total: {total} DH</p>
            <Button onClick={onBackToCatalog}>Retour au catalogue</Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
