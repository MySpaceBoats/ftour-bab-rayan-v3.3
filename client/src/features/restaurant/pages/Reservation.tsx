import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, UtensilsCrossed, MapPin } from 'lucide-react';

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

        {/* Localisation du restaurant */}
        <div className="max-w-2xl mx-auto mt-12">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 text-[#5d5a3c]">
              <MapPin className="h-5 w-5" />
              <h2 className="text-2xl font-bold">Nous trouver</h2>
            </div>
            <p className="text-[#8b8b7a] mt-1">La Table du Jardin by Bab Rayan</p>
          </div>
          <div className="rounded-lg overflow-hidden shadow-md">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.9690513357727!2d-7.631227813238418!3d33.5801528045934!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xda7d30029a4e42d%3A0x3373083e51403fde!2sla%20Table%20du%20Jardin%20by%20Bab%20Rayan!5e0!3m2!1sfr!2sma!4v1771424452220!5m2!1sfr!2sma"
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localisation La Table du Jardin by Bab Rayan"
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
