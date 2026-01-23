import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Users, Home, GraduationCap, Stethoscope, Utensils, ExternalLink, Award, Target, Calendar } from "lucide-react";

export default function Association() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Award className="h-4 w-4" />
                Depuis 2004
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Association <span className="text-primary">Bab Rayan</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Protéger, éduquer et accompagner les enfants en situation de précarité au Maroc
              </p>
              <a href="https://www.babrayan.ma" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Visiter babrayan.ma
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="py-16">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-bold">
                  Une association au service de l'enfance
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Bab Rayan est une association marocaine à but non lucratif fondée en 2004. 
                  Notre mission est d'offrir aux enfants en situation de précarité un environnement 
                  sûr, une éducation de qualité et un accompagnement vers l'autonomie.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Depuis sa création, l'association a accueilli et accompagné des centaines d'enfants, 
                  leur offrant un foyer, une scolarité et les outils nécessaires pour construire 
                  leur avenir.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  L'événement Ftour Bab Rayan est l'une des nombreuses actions solidaires organisées 
                  par l'association pour venir en aide aux plus démunis et sensibiliser le public 
                  aux valeurs de partage et de générosité.
                </p>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                  <Home className="h-32 w-32 text-primary/30" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Nos domaines d'action</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Une approche globale pour accompagner les enfants vers l'autonomie
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-none shadow-md">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Home className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">Hébergement</h3>
                  <p className="text-sm text-muted-foreground">
                    Un foyer sécurisé et chaleureux pour les enfants sans famille ou en danger.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-secondary/20 flex items-center justify-center">
                    <GraduationCap className="h-7 w-7 text-secondary-foreground" />
                  </div>
                  <h3 className="text-lg font-bold">Éducation</h3>
                  <p className="text-sm text-muted-foreground">
                    Scolarisation, soutien scolaire et formation professionnelle pour tous.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                    <Stethoscope className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="text-lg font-bold">Santé</h3>
                  <p className="text-sm text-muted-foreground">
                    Suivi médical régulier et accès aux soins pour chaque enfant.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 flex items-center justify-center">
                    <Utensils className="h-7 w-7 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold">Nutrition</h3>
                  <p className="text-sm text-muted-foreground">
                    Des repas équilibrés et adaptés aux besoins de chaque enfant.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Bab Rayan en chiffres</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                20 ans d'engagement au service de l'enfance
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">20+</div>
                <p className="text-muted-foreground">Années d'existence</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">500+</div>
                <p className="text-muted-foreground">Enfants accompagnés</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">100%</div>
                <p className="text-muted-foreground">Scolarisation</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">50+</div>
                <p className="text-muted-foreground">Collaborateurs</p>
              </div>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Notre histoire</h2>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="font-bold text-primary">2004</span>
                </div>
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary mt-1"></div>
                <div>
                  <h3 className="font-semibold">Création de l'association</h3>
                  <p className="text-muted-foreground text-sm">
                    Fondation de Bab Rayan avec la mission d'accueillir les enfants en difficulté.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="font-bold text-primary">2010</span>
                </div>
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary mt-1"></div>
                <div>
                  <h3 className="font-semibold">Expansion des programmes</h3>
                  <p className="text-muted-foreground text-sm">
                    Lancement des programmes de formation professionnelle et d'insertion.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="font-bold text-primary">2015</span>
                </div>
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary mt-1"></div>
                <div>
                  <h3 className="font-semibold">Premier Ftour Bab Rayan</h3>
                  <p className="text-muted-foreground text-sm">
                    Lancement de l'événement annuel Ftour solidaire pendant le Ramadan.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="font-bold text-primary">2025</span>
                </div>
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary mt-1"></div>
                <div>
                  <h3 className="font-semibold">10ème édition du Ftour</h3>
                  <p className="text-muted-foreground text-sm">
                    Célébration de 10 ans de Ftours solidaires avec des milliers de repas servis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 gradient-primary text-white">
          <div className="container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Soutenez Bab Rayan
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Votre soutien permet à l'association de continuer sa mission auprès des enfants.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dons">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Heart className="h-5 w-5 mr-2" />
                  Faire un don
                </Button>
              </Link>
              <a href="https://www.babrayan.ma" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-white text-white hover:bg-white/10">
                  <ExternalLink className="h-5 w-5 mr-2" />
                  En savoir plus
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
