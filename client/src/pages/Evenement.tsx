import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Users, Calendar, MapPin, Star, ArrowRight, Target, Sparkles, HandHeart, Utensils, Baby, GraduationCap } from "lucide-react";

export default function Evenement() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                Depuis 2015 - 12ème édition
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                L'événement <span className="text-primary">Ftour Bab Rayan</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Un mois de partage, de solidarité et de générosité au cœur de Casablanca. Plus de 31 200 Ftours servis chaque année.
              </p>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Target className="h-4 w-4" />
                  Actions Solidaires
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Les Ftours Bab Rayan
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  L'association Bab Rayan organise chaque année depuis 2015 le Ftour Bab Rayan. Pendant ce mois sacré, la plupart n'ont pas la chance de rompre leur jeûne autour d'une table garnie.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Cette action apporte beaucoup de convivialité et de chaleur à leur environnement ; l'esprit de solidarité du Ramadan est alors au rendez-vous, grâce à vos dons !
                </p>
                <div className="bg-primary/5 rounded-xl p-6 border-l-4 border-primary">
                  <p className="text-muted-foreground italic">
                    "Parce que chaque enfant mérite un bon départ dans la vie"
                  </p>
                  <p className="text-sm text-primary mt-2 font-medium">— Vision de Bab Rayan</p>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                  <Utensils className="h-24 w-24 text-primary/30" />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-card rounded-xl shadow-lg p-4 border">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">+31 200</div>
                    <div className="text-xs text-muted-foreground">Ftours servis/an</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chiffres clés */}
        <section className="py-16 bg-primary text-white">
          <div className="container">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-4">L'impact de Bab Rayan</h2>
              <p className="text-white/80">Chiffres clés annuels de l'association</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+450</div>
                <p className="text-white/80 text-sm">Enfants pris en charge</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+6 000</div>
                <p className="text-white/80 text-sm">Bénévoles</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+1 500</div>
                <p className="text-white/80 text-sm">Familles bénéficiaires</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+230 000</div>
                <p className="text-white/80 text-sm">Repas à la cantine</p>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <div className="text-3xl md:text-4xl font-bold mb-2">+31 200</div>
                <p className="text-white/80 text-sm">Ftours servis</p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Les piliers de Bab Rayan</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Protéger, Éduquer, Accompagner - Notre mission au quotidien
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                    <Baby className="h-8 w-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold">Protection</h3>
                  <p className="text-muted-foreground">
                    Depuis 2014, Bab Rayan se consacre à la protection de l'enfance, assurant un environnement sûr et bienveillant pour les enfants vulnérables.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <GraduationCap className="h-8 w-8 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold">Éducation</h3>
                  <p className="text-muted-foreground">
                    En intégrant ces jeunes dans un parcours éducatif adapté à leurs besoins, nous leur donnons les outils nécessaires pour construire leur avenir.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <HandHeart className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Accompagnement</h3>
                  <p className="text-muted-foreground">
                    Des formations offertes dans des secteurs variés pour accompagner ces jeunes vers une insertion professionnelle réussie.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Comment ça se passe ?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Une organisation rodée pour des Ftours réussis chaque soir
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Préparation (15h - 17h)</h3>
                    <p className="text-muted-foreground">
                      Les bénévoles arrivent pour préparer le lieu, installer les tables et chaises, 
                      et commencer la préparation des repas. Tout est organisé pour accueillir 
                      dignement nos invités.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Accueil (17h - Maghreb)</h3>
                    <p className="text-muted-foreground">
                      Les bénéficiaires sont accueillis avec le sourire. Chacun trouve sa place 
                      autour des tables dressées. L'ambiance est chaleureuse et conviviale.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Ftour (Maghreb)</h3>
                    <p className="text-muted-foreground">
                      À l'appel à la prière, tout le monde rompt le jeûne ensemble. Dattes, lait, 
                      harira, et un repas complet sont servis. C'est un moment de partage unique.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    4
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Rangement (Après Ftour)</h3>
                    <p className="text-muted-foreground">
                      Les bénévoles rangent et nettoient le lieu. Tout est prêt pour le lendemain. 
                      La journée se termine dans la bonne humeur et la satisfaction du devoir accompli.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Info Cards */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Dates</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Du 1er au 30 Ramadan 2026, soit 30 jours de Ftours solidaires consécutifs. 12ème édition depuis 2015.
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
                  <p className="text-muted-foreground">
                    4 rue Bayt Lham, quartier Palmier, Casablanca. L'adresse exacte est communiquée aux bénévoles inscrits.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Bénévoles</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Plus de 6 000 bénévoles mobilisés chaque année pour servir plus de 31 200 Ftours.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 gradient-primary text-white">
          <div className="container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Rejoignez l'aventure
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Rejoignez le combat pour la protection de l'enfance, engagez-vous en devenant donateur, partenaire ou bénévole.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/benevole">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Users className="h-5 w-5 mr-2" />
                  Devenir bénévole
                </Button>
              </Link>
              <Link href="/dons">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-white text-white hover:bg-white/10">
                  <Heart className="h-5 w-5 mr-2" />
                  Faire un don
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
