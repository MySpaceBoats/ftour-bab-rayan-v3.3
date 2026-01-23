import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Users, Calendar, Clock, MapPin, Star, ArrowRight, Target, Sparkles, HandHeart } from "lucide-react";

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
                Ramadan 2025
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                L'événement <span className="text-primary">Ftour Bab Rayan</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Un mois de partage, de solidarité et de générosité au cœur de Casablanca
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
                  Notre mission
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Offrir un Ftour digne à ceux qui en ont besoin
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Chaque soir du mois sacré de Ramadan, nous organisons des Ftours solidaires pour les personnes 
                  dans le besoin. Notre objectif est simple : permettre à chacun de rompre le jeûne dans la dignité, 
                  entouré de chaleur humaine et de générosité.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Ftour Bab Rayan est bien plus qu'un simple repas. C'est un moment de partage, de rencontre 
                  et de solidarité qui réunit bénévoles, donateurs et bénéficiaires autour des valeurs 
                  fondamentales du Ramadan.
                </p>
              </div>
              <div className="relative">
                <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                  <Heart className="h-24 w-24 text-primary/30" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Nos valeurs</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Les principes qui guident notre action au quotidien
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Heart className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Solidarité</h3>
                  <p className="text-muted-foreground">
                    Nous croyons en la force du collectif et en la capacité de chacun à contribuer au bien commun.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-secondary/20 flex items-center justify-center">
                    <Star className="h-8 w-8 text-secondary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">Dignité</h3>
                  <p className="text-muted-foreground">
                    Chaque personne mérite d'être traitée avec respect et considération, quelle que soit sa situation.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                    <HandHeart className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold">Transparence</h3>
                  <p className="text-muted-foreground">
                    Nous rendons compte de l'utilisation de chaque don et de l'impact de nos actions.
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
                    Du 1er au 30 Ramadan 2025, soit 30 jours de Ftours solidaires consécutifs.
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
                    Casablanca, Maroc. L'adresse exacte est communiquée aux bénévoles inscrits.
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
                  <p className="text-muted-foreground">
                    Jusqu'à 500 personnes servies chaque soir grâce à nos équipes de bénévoles.
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
              Que vous souhaitiez donner de votre temps ou soutenir financièrement, 
              chaque contribution compte.
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
