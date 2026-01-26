import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Users, Home, GraduationCap, Utensils, ExternalLink, Award, Briefcase, Quote, Building, Baby, ChefHat, Laptop } from "lucide-react";

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
                Reconnue d'utilité publique - Depuis 2014
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Association <span className="text-primary">Bab Rayan</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Changer le parcours d'une vie - Protéger, éduquer, accompagner les enfants en difficulté
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

        {/* Vision & Mission */}
        <section className="py-16">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 text-secondary-foreground text-sm font-medium">
                  <Quote className="h-4 w-4" />
                  Notre Vision
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Parce que chaque enfant mérite un bon départ dans la vie
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  L'association Bab Rayan, reconnue d'utilité publique, accompagne depuis 2014 les enfants vulnérables vers un avenir prometteur. Par la protection, l'éducation, la formation et l'insertion professionnelle, elle les aide à devenir des citoyens autonomes et responsables.
                </p>
                <div className="bg-muted/50 rounded-xl p-6 border-l-4 border-primary">
                  <h3 className="font-bold mb-2">Mission Globale</h3>
                  <p className="text-muted-foreground italic">
                    "Notre mission est de protéger, d'éduquer et de former les enfants et jeunes en difficulté pour leur offrir un avenir digne, autonome et enrichissant. Grâce à nos programmes holistiques, nous les accompagnons sur la voie de la réussite personnelle et professionnelle."
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                  <Heart className="h-32 w-32 text-primary/30" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mot de la Présidente */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">Mot de la Présidente</h2>
              </div>
              <Card className="border-none shadow-lg">
                <CardContent className="p-8 md:p-12">
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="flex-shrink-0">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <Users className="h-16 w-16 text-primary/40" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Quote className="h-8 w-8 text-primary/30" />
                      <p className="text-muted-foreground italic leading-relaxed">
                        "Au cours de cette décennie, notre dévouement inébranlable envers la protection, l'éducation, la formation, et l'insertion professionnelle des enfants en difficulté a été la pierre angulaire de notre action à Bab Rayan. Guidés par des valeurs nobles, notre boussole morale reste ferme, et nous sommes fiers de reconnaître Sa Majesté le Roi Mohammed VI comme une source inépuisable d'inspiration et de motivation."
                      </p>
                      <div className="pt-4">
                        <p className="font-bold text-primary">Fatima Zohra Hamroudi Ratibe</p>
                        <p className="text-sm text-muted-foreground">Fondatrice et Présidente de l'association Bab Rayan</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Trois Piliers */}
        <section className="py-16">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Nos Trois Piliers</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Protéger, Éduquer, Accompagner - Une approche globale pour transformer des vies
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-lg overflow-hidden">
                <div className="h-2 bg-red-500" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Home className="h-7 w-7 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold">Protection de l'enfance</h3>
                  <p className="text-muted-foreground">
                    Depuis 2014, Bab Rayan se consacre à la protection de l'enfance, assurant un environnement sûr et bienveillant pour les enfants vulnérables.
                  </p>
                  <div className="pt-4">
                    <span className="text-sm font-medium text-red-500">Le Foyer Bab Rayan</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Un lieu de vie sécurisé où les enfants retrouvent stabilité et affection.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg overflow-hidden">
                <div className="h-2 bg-yellow-500" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <GraduationCap className="h-7 w-7 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold">Éducation et scolarité</h3>
                  <p className="text-muted-foreground">
                    En intégrant ces jeunes dans un parcours éducatif adapté à leurs besoins, nous leur donnons les outils nécessaires pour construire leur avenir.
                  </p>
                  <div className="pt-4">
                    <span className="text-sm font-medium text-yellow-600">L'École Palmier</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Une école qui offre un enseignement de qualité adapté à chaque enfant.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Formation et insertion</h3>
                  <p className="text-muted-foreground">
                    Des formations offertes dans des secteurs variés tels que l'hôtellerie-restauration et les métiers du digital pour accompagner ces jeunes vers une insertion professionnelle réussie.
                  </p>
                  <div className="pt-4">
                    <span className="text-sm font-medium text-primary">Le CFI</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Centre de Formation et d'Insertion pour préparer les jeunes à l'emploi.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Chiffres clés */}
        <section className="py-16 bg-primary text-white">
          <div className="container">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-4">Chiffres clés annuels</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+450</div>
                <p className="text-white/80">Enfants pris en charge</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+6 000</div>
                <p className="text-white/80">Bénévoles</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+1 500</div>
                <p className="text-white/80">Familles bénéficiaires</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+230 000</div>
                <p className="text-white/80">Repas à la cantine</p>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <div className="text-4xl md:text-5xl font-bold mb-2">+31 200</div>
                <p className="text-white/80">Ftours servis</p>
              </div>
            </div>
          </div>
        </section>

        {/* Programmes */}
        <section className="py-16">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Nos Programmes</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Des initiatives concrètes pour accompagner les jeunes vers l'autonomie
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                    <Utensils className="h-7 w-7 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold">Les Ftours Bab Rayan</h3>
                  <p className="text-sm text-muted-foreground">
                    Depuis 2015, des repas de rupture du jeûne pour les plus démunis pendant le Ramadan.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <ChefHat className="h-7 w-7 text-yellow-600" />
                  </div>
                  <h3 className="text-lg font-bold">La Table du Jardin</h3>
                  <p className="text-sm text-muted-foreground">
                    Restaurant solidaire où les jeunes formés mettent en pratique leurs compétences.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Laptop className="h-7 w-7 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold">ForsaTech</h3>
                  <p className="text-sm text-muted-foreground">
                    Formations aux métiers du numérique pour répondre aux besoins du marché digital.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Baby className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">Mécénat Culturel</h3>
                  <p className="text-sm text-muted-foreground">
                    Éveiller les talents et les passions de nos jeunes à travers l'art et la culture.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Notre Histoire</h2>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="font-bold text-primary">2014</span>
                </div>
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary mt-1"></div>
                <div>
                  <h3 className="font-semibold">Création de l'association</h3>
                  <p className="text-muted-foreground text-sm">
                    Fondation de Bab Rayan par Fatima Zohra Hamroudi Ratibe avec la mission de protéger les enfants vulnérables.
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
                    Lancement de l'événement annuel Ftour solidaire pendant le mois de Ramadan.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="font-bold text-primary">2020</span>
                </div>
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary mt-1"></div>
                <div>
                  <h3 className="font-semibold">Centre de Formation et d'Insertion</h3>
                  <p className="text-muted-foreground text-sm">
                    Ouverture du CFI pour former les jeunes aux métiers de l'hôtellerie-restauration.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="font-bold text-primary">2026</span>
                </div>
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary mt-1"></div>
                <div>
                  <h3 className="font-semibold">12ème édition du Ftour</h3>
                  <p className="text-muted-foreground text-sm">
                    Célébration de 11 ans de Ftours solidaires avec plus de 31 200 repas servis annuellement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="py-16">
          <div className="container">
            <div className="max-w-4xl mx-auto">
              <Card className="border-none shadow-lg">
                <CardContent className="p-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold">Nous contacter</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Building className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">Adresse</p>
                            <p className="text-sm text-muted-foreground">4 rue Bayt Lham, quartier Palmier, Casablanca</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Users className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">Téléphone</p>
                            <p className="text-sm text-muted-foreground">+212 610 023 555</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Heart className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">Email</p>
                            <p className="text-sm text-muted-foreground">contact@babrayan.ma</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold">Suivez-nous</h3>
                      <p className="text-muted-foreground">
                        Restez informés de nos actions et actualités sur nos réseaux sociaux.
                      </p>
                      <div className="flex gap-4">
                        <a href="https://www.facebook.com/babrayan" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 transition-colors">
                          <span className="text-sm font-bold">f</span>
                        </a>
                        <a href="https://www.instagram.com/babrayan" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                          <span className="text-sm font-bold">ig</span>
                        </a>
                        <a href="https://www.linkedin.com/company/babrayan" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-white hover:bg-blue-800 transition-colors">
                          <span className="text-sm font-bold">in</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
              Rejoignez le combat pour la protection de l'enfance, engagez-vous en devenant donateur, partenaire ou bénévole.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dons">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Heart className="h-5 w-5 mr-2" />
                  Faire un don
                </Button>
              </Link>
              <Link href="/benevole">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-white text-white hover:bg-white/10">
                  <Users className="h-5 w-5 mr-2" />
                  Devenir bénévole
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
