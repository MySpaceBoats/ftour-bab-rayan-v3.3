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
    description: 'Réservation individuelle (max 10 places) avec passage au paiement.',
    href: (lang: string) => `/${lang}/restaurant/particuliers`,
    icon: UtensilsCrossed,
    cta: 'Réserver en tant que particulier',
  },
  {
    title: 'Entreprises',
    description: 'Réservation corporate avec gestion des participants et QR code.',
    href: (lang: string) => `/${lang}/company-booking`,
    icon: Building2,
    cta: 'Réserver pour une entreprise',
  },
  {
    title: 'Groupes',
    description: 'Demande de réservation groupe (max 120 personnes), sans paiement immédiat.',
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
          <h1 className="text-4xl font-bold text-[#5d5a3c] mb-3">Hub de réservation</h1>
          <p className="text-muted-foreground">Choisissez votre parcours pour lancer la bonne expérience de réservation.</p>
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
