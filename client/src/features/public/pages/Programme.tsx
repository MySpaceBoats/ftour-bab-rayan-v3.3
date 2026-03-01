import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n";

export default function Programme() {
  const { lang } = useI18n();
  const { data: days, isLoading } = trpc.days.list.useQuery();
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const weeks = days ? Math.ceil(days.length / 7) : 4;
  const weekDays = days?.slice((selectedWeek - 1) * 7, selectedWeek * 7) || [];

  // Auto-navigate to the week containing the first open day
  useEffect(() => {
    if (!days || days.length === 0) return;
    const firstOpenIdx = days.findIndex(d => d.isOpen);
    if (firstOpenIdx !== -1) {
      setSelectedWeek(Math.floor(firstOpenIdx / 7) + 1);
    }
  }, [days]);

  const isFutureDay = (dateStr: string) => {
    const dayDate = new Date(dateStr);
    const today = new Date();
    dayDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return dayDate > today;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  type DayType = NonNullable<typeof days>[number];

  const getAvailabilityColor = (day: DayType) => {
    if (!day.isOpen) {
      if (isFutureDay(day.date)) return "bg-amber-100 text-amber-800 border-amber-200";
      return "bg-red-100 text-red-800 border-red-200";
    }
    return "bg-green-100 text-green-800 border-green-200";
  };

  const getAvailabilityText = (day: DayType) => {
    if (!day.isOpen) {
      if (isFutureDay(day.date)) return "Bientôt";
      return "Fermé";
    }
    return "Disponible";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Calendar className="h-4 w-4" />
                Ramadan
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Programme du Ftour
              </h1>
              <p className="text-lg text-muted-foreground">
                Consultez le calendrier des 30 jours de Ftour et inscrivez-vous aux jours qui vous conviennent
              </p>
            </div>
          </div>
        </section>

        {/* Week Selector */}
        <section className="py-8 border-b">
          <div className="container">
            <div className="flex flex-wrap justify-center gap-2">
              {[...Array(weeks)].map((_, i) => (
                <Button
                  key={i}
                  variant={selectedWeek === i + 1 ? "default" : "outline"}
                  onClick={() => setSelectedWeek(i + 1)}
                  className="min-w-[100px]"
                >
                  Semaine {i + 1}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Calendar Grid */}
        <section className="py-12">
          <div className="container">
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(7)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6 space-y-4">
                      <div className="h-6 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-20 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : days && days.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {weekDays.map((day) => (
                  <Card key={day.id} className={`card-hover overflow-hidden ${!day.isOpen ? 'opacity-75' : ''}`}>
                    <div className={`h-1 ${!day.isOpen ? (isFutureDay(day.date) ? 'bg-amber-400' : 'bg-red-500') : 'bg-primary'}`} />
                    <CardContent className="p-6 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-2xl font-bold text-primary">Jour {day.dayNumber}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {formatDate(day.date)}
                          </div>
                        </div>
                        <Badge variant="outline" className={getAvailabilityColor(day)}>
                          {!day.isOpen ? (
                            isFutureDay(day.date) ? <Clock className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {getAvailabilityText(day)}
                        </Badge>
                      </div>

                      {/* Info */}
                      <div className="space-y-2 text-sm">
                        {day.iftarTime && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{day.iftarTime}</span>
                          </div>
                        )}
                        {day.location && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{day.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{day.registeredCount} inscrits</span>
                        </div>
                      </div>


                      {/* Action */}
                      <Link href={`/${lang}/benevole?day=${day.id}`}>
                        <Button
                          className="w-full"
                          disabled={!day.isOpen}
                          variant={!day.isOpen ? "outline" : "default"}
                        >
                          {!day.isOpen
                            ? (isFutureDay(day.date) ? "Bientôt disponible" : "Complet")
                            : "S'inscrire"}
                          {day.isOpen && <ArrowRight className="h-4 w-4 ml-2" />}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Calendar className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Programme à venir</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Le programme des Ftours sera bientôt disponible. Revenez nous voir !
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Info Section */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Informations pratiques</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">Horaires</h3>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Les bénévoles sont attendus 1h30 avant l'heure du Ftour pour la préparation. 
                      L'activité se termine environ 1h après le Ftour.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">Lieu</h3>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      4 rue Bayt Lahm, quartier Palmier, Casablanca
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">Capacité</h3>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Chaque jour a une capacité limitée de bénévoles pour assurer une bonne organisation. 
                      Inscrivez-vous tôt !
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">Confirmation</h3>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Après inscription, vous recevrez un email de confirmation avec votre QR code 
                      à présenter le jour J.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="container text-center">
            <h2 className="text-2xl font-bold mb-4">Prêt à vous engager ?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Choisissez un ou plusieurs jours et rejoignez notre équipe de bénévoles
            </p>
            <Link href={`/${lang}/benevole`}>
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                <Users className="h-5 w-5 mr-2" />
                Devenir bénévole
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
