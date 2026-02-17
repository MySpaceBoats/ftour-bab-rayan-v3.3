import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Heart, Users, Calendar, MapPin, Star, ArrowRight, Target, Sparkles, HandHeart, Utensils, Baby, GraduationCap } from "lucide-react";
import { useI18n } from "@/i18n";

export default function Evenement() {
  const { t, lang } = useI18n();
  
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
                {t.event.subtitle}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                {t.event.title} <span className="text-primary">Ftour Bab Rayan</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                {t.event.description}
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
                  {t.home.solidarityActions}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  {t.event.missionTitle}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t.home.ftourDesc1}
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t.home.ftourDesc2}
                </p>
                <div className="bg-primary/5 rounded-xl p-6 border-l-4 border-primary">
                  <p className="text-muted-foreground italic">
                    "{t.home.heroDescription.split('.')[0]}"
                  </p>
                  <p className="text-sm text-primary mt-2 font-medium">— {t.home.pillarsSubtitle.split('-')[1]?.trim() || 'Vision de Bab Rayan'}</p>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
                  <Utensils className="h-24 w-24 text-primary/30" />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-card rounded-xl shadow-lg p-4 border">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">+31 200</div>
                    <div className="text-xs text-muted-foreground">{t.common.ftours}</div>
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
              <h2 className="text-3xl font-bold mb-4">{t.event.impactTitle}</h2>
              <p className="text-white/80">{t.event.impactSubtitle}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+450</div>
                <p className="text-white/80 text-sm">{t.common.children}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+6 000</div>
                <p className="text-white/80 text-sm">{t.common.volunteers}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+1 500</div>
                <p className="text-white/80 text-sm">{t.common.families}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">+230 000</div>
                <p className="text-white/80 text-sm">{t.common.meals}</p>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <div className="text-3xl md:text-4xl font-bold mb-2">+31 200</div>
                <p className="text-white/80 text-sm">{t.common.ftours}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{t.event.valuesTitle}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t.event.valuesSubtitle}
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                    <Baby className="h-8 w-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold">{t.event.protection}</h3>
                  <p className="text-muted-foreground">
                    {t.event.protectionDesc}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <GraduationCap className="h-8 w-8 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold">{t.event.education}</h3>
                  <p className="text-muted-foreground">
                    {t.event.educationDesc}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <HandHeart className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">{t.event.support}</h3>
                  <p className="text-muted-foreground">
                    {t.event.supportDesc}
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
              <h2 className="text-3xl font-bold mb-4">{t.event.howItWorks}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t.event.howItWorksSubtitle}
              </p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{t.event.step1Title}</h3>
                    <p className="text-muted-foreground">
                      {t.event.step1Desc}
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{t.event.step2Title}</h3>
                    <p className="text-muted-foreground">
                      {t.event.step2Desc}
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{t.event.step3Title}</h3>
                    <p className="text-muted-foreground">
                      {t.event.step3Desc}
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
                    <h3 className="font-semibold">{t.programme.subtitle.split(' ')[0] || 'Dates'}</h3>
                  </div>
                  <p className="text-muted-foreground">
                    {t.programme.description}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{t.contact.address}</h3>
                  </div>
                  <p className="text-muted-foreground">
                    {t.contact.addressValue}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">{t.common.volunteers}</h3>
                  </div>
                  <p className="text-muted-foreground">
                    {t.home.volunteersCount6000} - {t.home.engagedCommunity}
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
              {t.event.joinTitle}
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              {t.event.joinDescription}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/${lang}/benevole`}>
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Users className="h-5 w-5 mr-2" />
                  {t.cta.volunteer}
                </Button>
              </Link>
              <Link href={`/${lang}/dons`}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-white text-white hover:bg-white/10">
                  <Heart className="h-5 w-5 mr-2" />
                  {t.cta.donate}
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
