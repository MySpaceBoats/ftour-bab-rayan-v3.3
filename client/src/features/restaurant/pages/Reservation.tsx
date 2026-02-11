import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building2, Users, UtensilsCrossed } from 'lucide-react';

const OPTIONS = [
  {
    title: 'Particuliers',
    description: 'Demande de réservation individuelle (jusqu\u0027à 10 personnes). Confirmation sous 48 heures.',
    href: (lang: string) => `/${lang}/restaurant/particuliers`,
    icon: UtensilsCrossed,
    cta: 'Faire une demande individuelle',
  },
  {
    title: 'Entreprises',
    description: 'Demande de réservation pour événements d\u0027entreprise avec gestion des participants.',
    href: (lang: string) => `/${lang}/company-booking`,
    icon: Building2,
    cta: 'Faire une demande entreprise',
  },
  {
    title: 'Groupes',
    description: 'Demande de réservation pour associations, familles ou délégations (jusqu\u0027à 120 personnes).',
    href: (lang: string) => `/${lang}/restaurant/groupes`,
    icon: Users,
    cta: 'Soumettre une demande groupe',
  },
];

export default function Reservation() {
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h1 className="text-4xl font-bold text-[#5d5a3c] mb-3">Restaurant solidaire</h1>
          <p className="text-muted-foreground">Sélectionnez le format adapté à votre demande. Toutes les réservations sont soumises à validation par notre équipe.</p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <Card key={option.title} className="flex flex-col">
                <CardHeader>
                  <div className="h-10 w-10 rounded-full bg-[#5d5a3c]/10 text-[#5d5a3c] flex items-center justify-center mb-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{option.title}</CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Link href={option.href(lang)}>
                    <Button className="w-full">
                      {option.cta}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
