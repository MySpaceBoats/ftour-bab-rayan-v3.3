import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Users, Calendar, ShoppingBag, ArrowRight, Star, Clock, MapPin, HandHeart, Sparkles, Utensils, GraduationCap, Home as HomeIcon, Baby } from "lucide-react";

export default function Home() {
  const { data: stats } = trpc.public.stats.useQuery();
  const { data: testimonials } = trpc.public.testimonials.useQuery();
  const { data: partners } = trpc.public.partners.useQuery();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden gradient-hero pattern-overlay">
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
          
          <div className="container relative z-10 py-20 text-center text-white">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-sm font-medium">Ramadan 2025 - Depuis 2015</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Ftour <span className="text-gradient-secondary">Bab Rayan</span>
              </h1>
              
              <p className="text-lg sm:text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed">
                Parce que chaque enfant mérite un bon départ dans la vie. Partageons ensemble des moments de solidarité pendant ce mois sacré.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link href="/benevole">
                  <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-lg px-8 py-6">
                    <Users className="h-5 w-5 mr-2" />
                    Devenir bénévole
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/dons">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 bg-white/10 border-white/30 text-white hover:bg-white/20">
                    <Heart className="h-5 w-5 mr-2" />
                    Faire un don
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          
          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-white/50 flex items-start justify-center p-2">
              <div className="w-1 h-2 bg-white/80 rounded-full animate-pulse" />
            </div>
          </div>
        </section>

        {/* Chiffres Clés Section - Données réelles Bab Rayan */}
        <section className="py-16 bg-primary text-white">
          <div className="container">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Chiffres clés annuels</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+450</div>
                <div className="text-sm text-white/80">Enfants pris en charge</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+6 000</div>
                <div className="text-sm text-white/80">Bénévoles</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+1 500</div>
                <div className="text-sm text-white/80">Familles bénéficiaires</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+230 000</div>
                <div className="text-sm text-white/80">Repas offerts à la cantine</div>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <div className="text-3xl md:text-4xl font-bold mb-2">+31 200</div>
                <div className="text-sm text-white/80">Ftours servis</div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section - Données dynamiques de l'événement */}
        <section className="py-16 bg-muted/50">
          <div className="container">
            <h2 className="text-2xl font-bold text-center mb-8">Cette année</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="card-hover border-none shadow-md">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-primary">{stats?.totalDays || 30}</div>
                  <div className="text-sm text-muted-foreground mt-1">Jours de Ftour</div>
                </CardContent>
              </Card>
              
              <Card className="card-hover border-none shadow-md">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-primary">{stats?.totalVolunteers || 0}</div>
                  <div className="text-sm text-muted-foreground mt-1">Bénévoles inscrits</div>
                </CardContent>
              </Card>
              
              <Card className="card-hover border-none shadow-md">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-secondary/20 flex items-center justify-center">
                    <Heart className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div className="text-3xl font-bold text-secondary-foreground">{stats?.totalDonations || 0}</div>
                  <div className="text-sm text-muted-foreground mt-1">Promesses de dons</div>
                </CardContent>
              </Card>
              
              <Card className="card-hover border-none shadow-md">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                    <HandHeart className="h-6 w-6 text-accent" />
                  </div>
                  <div className="text-3xl font-bold text-accent">
                    {stats?.receivedDonationAmount ? `${Number(stats.receivedDonationAmount).toLocaleString()} DH` : '0 DH'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Collectés</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* About Ftour Bab Rayan Section */}
        <section className="py-20">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  <Utensils className="h-4 w-4" />
                  Actions Solidaires
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  Les Ftours <span className="text-primary">Bab Rayan</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  L'association Bab Rayan organise chaque année depuis 2015 le Ftour Bab Rayan. Pendant ce mois sacré, la plupart n'ont pas la chance de rompre leur jeûne autour d'une table garnie.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Cette action apporte beaucoup de convivialité et de chaleur à leur environnement ; l'esprit de solidarité du Ramadan est alors au rendez-vous, grâce à vos dons !
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium">Depuis 2015</span>
                      <p className="text-sm text-muted-foreground">10 ans d'engagement solidaire</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium">Casablanca</span>
                      <p className="text-sm text-muted-foreground">4 rue Bayt Lham, quartier Palmier</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium">+6 000 bénévoles</span>
                      <p className="text-sm text-muted-foreground">Une communauté engagée</p>
                    </div>
                  </li>
                </ul>
                <Link href="/evenement">
                  <Button variant="outline" className="mt-4">
                    En savoir plus
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
              
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-8">
                  <div className="w-full h-full rounded-xl bg-muted flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <Utensils className="h-20 w-20 mx-auto text-primary/30" />
                      <p className="text-muted-foreground">Ftour Bab Rayan</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-6 bg-card rounded-xl shadow-lg p-4 border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Utensils className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold">+31 200</div>
                      <div className="text-xs text-muted-foreground">Ftours servis</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Missions Bab Rayan Section */}
        <section className="py-20 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Nos Missions
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Notre mission est de protéger, d'éduquer et de former les enfants et jeunes en difficulté pour leur offrir un avenir digne, autonome et enrichissant.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="card-hover border-none shadow-lg overflow-hidden group">
                <div className="h-2 bg-red-500" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <HomeIcon className="h-7 w-7 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold">Protection de l'enfance</h3>
                  <p className="text-muted-foreground">
                    Depuis 2014, Bab Rayan se consacre à la protection de l'enfance, assurant un environnement sûr et bienveillant pour les enfants vulnérables.
                  </p>
                  <Link href="/association">
                    <Button variant="outline" className="w-full mt-4">
                      Découvrir le foyer
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="card-hover border-none shadow-lg overflow-hidden group">
                <div className="h-2 bg-yellow-500" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-7 w-7 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold">Éducation et scolarité</h3>
                  <p className="text-muted-foreground">
                    En intégrant ces jeunes dans un parcours éducatif adapté à leurs besoins, nous leur donnons les outils nécessaires pour construire leur avenir.
                  </p>
                  <Link href="/association">
                    <Button variant="outline" className="w-full mt-4">
                      Découvrir l'école Palmier
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="card-hover border-none shadow-lg overflow-hidden group">
                <div className="h-2 bg-primary" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Baby className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Formation et insertion</h3>
                  <p className="text-muted-foreground">
                    Des formations offertes dans des secteurs variés tels que l'hôtellerie-restauration et les métiers du digital pour une insertion professionnelle réussie.
                  </p>
                  <Link href="/association">
                    <Button variant="outline" className="w-full mt-4">
                      Découvrir le CFI
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Cards Section */}
        <section className="py-20">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Comment participer ?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Rejoignez le combat pour la protection de l'enfance, engagez-vous en devenant donateur, partenaire ou bénévole.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Volunteer Card */}
              <Card className="card-hover border-none shadow-lg overflow-hidden group">
                <div className="h-2 bg-primary" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Devenir bénévole</h3>
                  <p className="text-muted-foreground">
                    Rejoignez notre équipe de +6 000 bénévoles et participez à l'organisation des Ftours solidaires. Choisissez vos jours de disponibilité.
                  </p>
                  <Link href="/benevole">
                    <Button className="w-full mt-4 bg-primary hover:bg-primary/90">
                      S'inscrire
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Goodies Card */}
              <Card className="card-hover border-none shadow-lg overflow-hidden group">
                <div className="h-2 bg-secondary" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingBag className="h-7 w-7 text-secondary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">Boutique solidaire</h3>
                  <p className="text-muted-foreground">
                    Découvrez nos goodies exclusifs édition Ramadan. Tous les bénéfices soutiennent nos actions pour les enfants en difficulté.
                  </p>
                  <Link href="/goodies">
                    <Button variant="outline" className="w-full mt-4">
                      Voir la boutique
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Donation Card */}
              <Card className="card-hover border-none shadow-lg overflow-hidden group">
                <div className="h-2 bg-accent" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart className="h-7 w-7 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold">Faire un don</h3>
                  <p className="text-muted-foreground">
                    Soutenez notre action par un don. Chaque contribution compte pour offrir des repas et un avenir meilleur aux enfants.
                  </p>
                  <Link href="/dons">
                    <Button variant="outline" className="w-full mt-4">
                      Faire un don
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        {testimonials && testimonials.length > 0 && (
          <section className="py-20 bg-muted/30">
            <div className="container">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Témoignages
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Ce que disent nos bénévoles et partenaires
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                {testimonials.slice(0, 3).map((testimonial) => (
                  <Card key={testimonial.id} className="border-none shadow-md">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex gap-1">
                        {[...Array(testimonial.rating || 5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-secondary text-secondary" />
                        ))}
                      </div>
                      <p className="text-muted-foreground italic">"{testimonial.content}"</p>
                      <div className="flex items-center gap-3 pt-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-medium">
                            {testimonial.authorName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{testimonial.authorName}</div>
                          <div className="text-xs text-muted-foreground">{testimonial.authorRole}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Partners Section */}
        {partners && partners.length > 0 && (
          <section className="py-16">
            <div className="container">
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold text-foreground mb-2">Nos partenaires</h2>
                <p className="text-muted-foreground">Ils nous font confiance et nous soutiennent</p>
              </div>
              
              <div className="flex flex-wrap justify-center items-center gap-8">
                {partners.map((partner) => (
                  <div key={partner.id} className="grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100">
                    {partner.logoUrl ? (
                      <img src={partner.logoUrl} alt={partner.name} className="h-12 object-contain" />
                    ) : (
                      <div className="h-12 px-6 bg-muted rounded flex items-center justify-center">
                        <span className="font-medium text-muted-foreground">{partner.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="py-20 gradient-primary text-white">
          <div className="container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Prêt à rejoindre l'aventure ?
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Inscrivez-vous dès maintenant et faites partie de cette belle initiative solidaire pour les enfants en difficulté
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/benevole">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto text-lg px-8">
                  <Users className="h-5 w-5 mr-2" />
                  Devenir bénévole
                </Button>
              </Link>
              <Link href="/programme">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 border-white/30 text-white hover:bg-white/10">
                  <Calendar className="h-5 w-5 mr-2" />
                  Voir le programme
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
