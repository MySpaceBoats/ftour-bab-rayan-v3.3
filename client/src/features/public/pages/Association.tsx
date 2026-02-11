import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Users, Home, GraduationCap, Utensils, ExternalLink, Award, Briefcase, Quote, Building, Baby, ChefHat, Laptop } from "lucide-react";
import { useI18n } from "@/i18n";

export default function Association() {
  const { t, lang } = useI18n();
  
  return (
    <div className="min-h-screen flex flex-col" dir={t.dir}>
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Award className="h-4 w-4" />
                {t.association.recognizedPublicUtility}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                {t.association.title.split(' ').slice(0, -2).join(' ')} <span className="text-primary">{t.association.title.split(' ').slice(-2).join(' ')}</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                {t.association.subtitle}
              </p>
              <a href="https://www.babrayan.ma" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {t.association.visitWebsite}
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
                  {t.association.ourVision}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  {t.association.visionTitle}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t.association.visionDescription}
                </p>
                <div className="bg-muted/50 rounded-xl p-6 border-l-4 border-primary">
                  <h3 className="font-bold mb-2">{t.association.globalMission}</h3>
                  <p className="text-muted-foreground italic">
                    "{t.association.missionQuote}"
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
                <h2 className="text-3xl font-bold mb-4">{t.association.presidentWord}</h2>
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
                        "{t.association.presidentQuote}"
                      </p>
                      <div className="pt-4">
                        <p className="font-bold text-primary">Fatima Zohra Hamroudi Ratibe</p>
                        <p className="text-sm text-muted-foreground">{t.association.presidentTitle}</p>
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
              <h2 className="text-3xl font-bold mb-4">{t.association.threePillars}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t.association.pillarsSubtitle}
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-lg overflow-hidden">
                <div className="h-2 bg-red-500" />
                <CardContent className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Home className="h-7 w-7 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold">{t.association.pillar1Title}</h3>
                  <p className="text-muted-foreground">
                    {t.association.pillar1Description}
                  </p>
                  <div className="pt-4">
                    <span className="text-sm font-medium text-red-500">{t.association.pillar1Program}</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.association.pillar1ProgramDesc}
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
                  <h3 className="text-xl font-bold">{t.association.pillar2Title}</h3>
                  <p className="text-muted-foreground">
                    {t.association.pillar2Description}
                  </p>
                  <div className="pt-4">
                    <span className="text-sm font-medium text-yellow-600">{t.association.pillar2Program}</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.association.pillar2ProgramDesc}
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
                  <h3 className="text-xl font-bold">{t.association.pillar3Title}</h3>
                  <p className="text-muted-foreground">
                    {t.association.pillar3Description}
                  </p>
                  <div className="pt-4">
                    <span className="text-sm font-medium text-primary">{t.association.pillar3Program}</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.association.pillar3ProgramDesc}
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
              <h2 className="text-3xl font-bold mb-4">{t.association.keyFigures}</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+450</div>
                <p className="text-white/80">{t.association.childrenCaredFor}</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+6 000</div>
                <p className="text-white/80">{t.association.volunteersCount}</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+1 500</div>
                <p className="text-white/80">{t.association.beneficiaryFamilies}</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold mb-2">+230 000</div>
                <p className="text-white/80">{t.association.canteenMeals}</p>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <div className="text-4xl md:text-5xl font-bold mb-2">+31 200</div>
                <p className="text-white/80">{t.association.ftoursServed}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Programmes */}
        <section className="py-16">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{t.association.ourPrograms}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t.association.programsSubtitle}
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                    <Baby className="h-6 w-6 text-red-500" />
                  </div>
                  <h3 className="font-bold">{t.association.program1}</h3>
                  <p className="text-sm text-muted-foreground">{t.association.program1Desc}</p>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-yellow-600" />
                  </div>
                  <h3 className="font-bold">{t.association.program2}</h3>
                  <p className="text-sm text-muted-foreground">{t.association.program2Desc}</p>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <ChefHat className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold">{t.association.program3}</h3>
                  <p className="text-sm text-muted-foreground">{t.association.program3Desc}</p>
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Laptop className="h-6 w-6 text-blue-500" />
                  </div>
                  <h3 className="font-bold">{t.association.program4}</h3>
                  <p className="text-sm text-muted-foreground">{t.association.program4Desc}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Ftour Bab Rayan */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Utensils className="h-4 w-4" />
                {t.association.flagshipEvent}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">
                {t.association.ftourTitle}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t.association.ftourDescription}
              </p>
              <div className="grid sm:grid-cols-3 gap-6 pt-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="text-3xl font-bold text-primary mb-2">12</div>
                  <p className="text-muted-foreground">{t.association.editionsCount}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="text-3xl font-bold text-primary mb-2">+31 200</div>
                  <p className="text-muted-foreground">{t.association.mealsPerYear}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="text-3xl font-bold text-primary mb-2">30</div>
                  <p className="text-muted-foreground">{t.association.daysOfRamadan}</p>
                </div>
              </div>
              <Link href={`/${lang}/benevole`}>
                <Button size="lg" className="mt-4">
                  {t.cta.volunteer}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-primary to-primary/80 text-white">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">
                {t.association.ctaTitle}
              </h2>
              <p className="text-lg text-white/90">
                {t.association.ctaDescription}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link href={`/${lang}/benevole`}>
                  <Button size="lg" variant="secondary">
                    {t.cta.volunteer}
                  </Button>
                </Link>
                <Link href={`/${lang}/dons`}>
                  <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10">
                    {t.cta.donate}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
