import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, UtensilsCrossed } from 'lucide-react';

export default function Reservation() {
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h1 className="text-4xl font-bold text-[#5d5a3c] mb-3">Ftour solidaire</h1>
          <p className="text-muted-foreground">Demande de réservation pour le ftour solidaire (réservation en ligne à partir de 5 couverts). Confirmation sous 48 heures.</p>
        </div>

        <div className="max-w-md mx-auto">
          <Card className="flex flex-col">
            <CardHeader>
              <div className="h-10 w-10 rounded-full bg-[#5d5a3c]/10 text-[#5d5a3c] flex items-center justify-center mb-2">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <CardTitle>Réservation Groupe ou Entreprise</CardTitle>
              <CardDescription>Demande de réservation groupe ou entreprise pour le ftour solidaire (à partir de 5 couverts). Confirmation sous 48 heures.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Link href={`/${lang}/restaurant/groupes`}>
                <Button className="w-full">
                  Réserver
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
