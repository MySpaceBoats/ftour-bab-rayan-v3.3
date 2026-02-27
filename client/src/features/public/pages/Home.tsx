import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import { Heart, Users, ShoppingBag, ArrowRight, Star, Clock, MapPin, Utensils, GraduationCap, Home as HomeIcon, Baby } from "lucide-react";
import RamadanImpactLive from "@/components/RamadanImpactLive";

export default function Home() {
  const { t, dir, lang } = useI18n();
  const { data: stats } = trpc.public.stats.useQuery();
  const { data: testimonials } = trpc.public.testimonials.useQuery();
  const { data: partners } = trpc.public.partners.useQuery();

  return (
    <div className="min-h-screen flex flex-col bg-[#5E5B34]" dir={dir}>
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section - Style olive/crème */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-[#5E5B34]">
          {/* Motif subtil */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23F2E9D3' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />
          </div>
          
          <div className="container relative z-10 py-20 text-center">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Titre arabe */}
              <div className="text-[#F2E9D3] text-3xl md:text-4xl" style={{ fontFamily: 'Aref Ruqaa, serif' }}>
                فطور باب ريان
              </div>
              
              {/* Titre principal manuscrit */}
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-[#F2E9D3] leading-tight" style={{ fontFamily: 'Caveat, cursive' }}>
                {t.home.heroTitle}
              </h1>
              
              {/* Badge édition */}
              <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#F2E9D3]/30 bg-[#F2E9D3]/5">
                <span className="text-[#CDBB8A] text-lg" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
                  {t.home.heroSubtitle}
                </span>
              </div>
              
              <p className="text-lg sm:text-xl md:text-2xl text-[#E6DCC3] max-w-2xl mx-auto leading-relaxed">
                {t.home.heroDescription}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link href={`/${lang}/reservation`}>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full sm:w-auto text-lg px-8 py-6 bg-transparent border-2 border-[#F2E9D3] text-[#F2E9D3] hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                  >
                    <Utensils className="h-5 w-5 mr-2" />
                    Réserver ftour
                  </Button>
                </Link>
                <Link href={`/${lang}/benevole`}>
                  <Button 
                    size="lg" 
                    className="w-full sm:w-auto text-lg px-8 py-6 bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] border-2 border-[#F2E9D3]"
                  >
                    <Users className="h-5 w-5 mr-2" />
                    {t.cta.volunteer}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
                <Link href={`/${lang}/dons`}>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="w-full sm:w-auto text-lg px-8 py-6 bg-transparent border-2 border-[#F2E9D3] text-[#F2E9D3] hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                  >
                    <Heart className="h-5 w-5 mr-2" />
                    {t.cta.donate}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          
          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 rounded-full border-2 border-[#F2E9D3]/50 flex items-start justify-center p-2">
              <div className="w-1 h-2 bg-[#F2E9D3]/80 rounded-full animate-pulse" />
            </div>
          </div>
        </section>

        {/* Chiffres Clés Section - Style olive foncé */}
        <section className="py-16 bg-[#4A4829]">
          <div className="container">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-[#F2E9D3]">{t.home.statsTitle}</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2 text-[#F2E9D3]">+450</div>
                <div className="text-sm text-[#E6DCC3]">{t.home.childrenCaredFor}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2 text-[#F2E9D3]">+6 000</div>
                <div className="text-sm text-[#E6DCC3]">{t.home.volunteersCount}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2 text-[#F2E9D3]">+1 500</div>
                <div className="text-sm text-[#E6DCC3]">{t.home.familiesBenefited}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2 text-[#F2E9D3]">+230 000</div>
                <div className="text-sm text-[#E6DCC3]">{t.home.mealsServed}</div>
              </div>
              <div className="text-center col-span-2 md:col-span-1">
                <div className="text-3xl md:text-4xl font-bold mb-2 text-[#F2E9D3]">+31 200</div>
                <div className="text-sm text-[#E6DCC3]">{t.home.ftoursServed}</div>
              </div>
            </div>
          </div>
        </section>

        {/* About Ftour Bab Rayan Section */}
        <section className="py-20 bg-[#5E5B34]">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2E9D3]/10 text-[#CDBB8A] text-sm font-medium">
                  <Utensils className="h-4 w-4" />
                  {t.home.solidarityActions}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-[#F2E9D3]" style={{ fontFamily: 'Caveat, cursive' }}>
                  {t.home.ftourTitle}
                </h2>
                <p className="text-lg text-[#E6DCC3] leading-relaxed">
                  {t.home.ftourDesc1}
                </p>
                <p className="text-lg text-[#E6DCC3] leading-relaxed">
                  {t.home.ftourDesc2}
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#F2E9D3]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="h-3 w-3 text-[#CDBB8A]" />
                    </div>
                    <div>
                      <span className="font-medium text-[#F2E9D3]">{t.home.since2015}</span>
                      <p className="text-sm text-[#E6DCC3]">{t.home.yearsEngagement}</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#F2E9D3]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="h-3 w-3 text-[#CDBB8A]" />
                    </div>
                    <div>
                      <span className="font-medium text-[#F2E9D3]">{t.home.casablanca}</span>
                      <p className="text-sm text-[#E6DCC3]">{t.home.address}</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#F2E9D3]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Users className="h-3 w-3 text-[#CDBB8A]" />
                    </div>
                    <div>
                      <span className="font-medium text-[#F2E9D3]">{t.home.volunteersCount6000}</span>
                      <p className="text-sm text-[#E6DCC3]">{t.home.engagedCommunity}</p>
                    </div>
                  </li>
                </ul>
                <Link href={`/${lang}/evenement`}>
                  <Button 
                    variant="outline" 
                    className="mt-4 border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                  >
                    {t.cta.learnMore}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
              
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-[#4A4829] p-8 border border-[#F2E9D3]/10">
                  <div className="w-full h-full rounded-xl bg-[#6F6C3F] flex items-center justify-center">
                    <div className="text-center space-y-4">
                      {/* Logo mains + cœur */}
                      <svg viewBox="0 0 120 120" className="h-32 w-32 mx-auto">
                        <path 
                          d="M60 25c-6 0-12 3-15 9-3-6-9-9-15-9-12 0-21 9-21 21 0 24 36 48 36 48s36-24 36-48c0-12-9-21-21-21z" 
                          fill="none" 
                          stroke="#F2E9D3" 
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <line x1="36" y1="42" x2="48" y2="54" stroke="#F2E9D3" strokeWidth="1.5" opacity="0.5"/>
                        <line x1="42" y1="36" x2="54" y2="48" stroke="#F2E9D3" strokeWidth="1.5" opacity="0.5"/>
                        <line x1="48" y1="42" x2="60" y2="54" stroke="#F2E9D3" strokeWidth="1.5" opacity="0.5"/>
                        <line x1="54" y1="36" x2="66" y2="48" stroke="#F2E9D3" strokeWidth="1.5" opacity="0.5"/>
                      </svg>
                      <p className="text-[#E6DCC3]" style={{ fontFamily: 'Caveat, cursive', fontSize: '1.5rem' }}>Ftour Bab Rayan</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-6 bg-[#4A4829] rounded-xl shadow-lg p-4 border border-[#F2E9D3]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F2E9D3]/10 flex items-center justify-center">
                      <Utensils className="h-5 w-5 text-[#CDBB8A]" />
                    </div>
                    <div>
                      <div className="font-bold text-[#F2E9D3]">+31 200</div>
                      <div className="text-xs text-[#E6DCC3]">Ftours servis</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <RamadanImpactLive className="bg-[#5E5B34] text-[#F2E9D3]" />

        {/* Missions Bab Rayan Section */}
        <section className="py-20 bg-[#6F6C3F]">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#F2E9D3] mb-4" style={{ fontFamily: 'Caveat, cursive' }}>
                {t.home.missionsTitle}
              </h2>
              <p className="text-lg text-[#E6DCC3] max-w-3xl mx-auto">
                {t.home.missionsSubtitle}
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#CDBB8A]/30 transition-all">
                <div className="h-1 bg-[#CDBB8A]" />
                <div className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#CDBB8A]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <HomeIcon className="h-7 w-7 text-[#CDBB8A]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F2E9D3]">{t.home.childProtection}</h3>
                  <p className="text-[#E6DCC3]">
                    {t.home.childProtectionDesc}
                  </p>
                  <Link href={`/${lang}/association`}>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 border-[#F2E9D3]/30 text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                    >
                      {t.home.discoverHome}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#CDBB8A]/30 transition-all">
                <div className="h-1 bg-[#CDBB8A]" />
                <div className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#CDBB8A]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <GraduationCap className="h-7 w-7 text-[#CDBB8A]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F2E9D3]">{t.home.educationSchool}</h3>
                  <p className="text-[#E6DCC3]">
                    {t.home.educationSchoolDesc}
                  </p>
                  <Link href={`/${lang}/association`}>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 border-[#F2E9D3]/30 text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                    >
                      {t.home.discoverSchool}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#CDBB8A]/30 transition-all">
                <div className="h-1 bg-[#CDBB8A]" />
                <div className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#CDBB8A]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Baby className="h-7 w-7 text-[#CDBB8A]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F2E9D3]">{t.home.trainingInsertion}</h3>
                  <p className="text-[#E6DCC3]">
                    {t.home.trainingInsertionDesc}
                  </p>
                  <Link href={`/${lang}/association`}>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 border-[#F2E9D3]/30 text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                    >
                      {t.home.discoverCFI}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Cards Section */}
        <section className="py-20 bg-[#5E5B34]">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-[#F2E9D3] mb-4" style={{ fontFamily: 'Caveat, cursive' }}>
                {t.home.howToParticipate}
              </h2>
              <p className="text-lg text-[#E6DCC3] max-w-2xl mx-auto">
                {t.home.howToParticipateDesc}
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {/* Volunteer Card */}
              <div className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#F2E9D3]/30 transition-all">
                <div className="h-1 bg-[#F2E9D3]" />
                <div className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#F2E9D3]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="h-7 w-7 text-[#F2E9D3]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F2E9D3]">{t.home.volunteerCardTitle}</h3>
                  <p className="text-[#E6DCC3]">
                    {t.home.volunteerCardDesc}
                  </p>
                  <Link href={`/${lang}/benevole`}>
                    <Button className="w-full mt-4 bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]">
                      {t.home.register}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Boutique Solidaire Card */}
              <div className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#CDBB8A]/30 transition-all">
                <div className="h-1 bg-[#CDBB8A]" />
                <div className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#CDBB8A]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingBag className="h-7 w-7 text-[#CDBB8A]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F2E9D3]">{t.home.boutiqueTitle}</h3>
                  <p className="text-[#E6DCC3]">
                    {t.home.boutiqueDesc}
                  </p>
                  <Link href={`/${lang}/boutique`}>
                    <Button
                      variant="outline"
                      className="w-full mt-4 border-[#CDBB8A]/30 text-[#CDBB8A] bg-transparent hover:bg-[#CDBB8A] hover:text-[#4A4829]"
                    >
                      {t.home.viewBoutique}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Donation Card */}
              <div className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#F2E9D3]/30 transition-all">
                <div className="h-1 bg-[#F2E9D3]" />
                <div className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#F2E9D3]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart className="h-7 w-7 text-[#F2E9D3]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F2E9D3]">{t.home.donationCardTitle}</h3>
                  <p className="text-[#E6DCC3]">
                    {t.home.donationCardDesc}
                  </p>
                  <Link href={`/${lang}/dons`}>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 border-[#F2E9D3] text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
                    >
                     {t.home.donateNow}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Restaurant Solidaire Card */}
              <div className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#9B8B6F]/30 transition-all">
                <div className="h-1 bg-[#9B8B6F]" />
                <div className="p-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#9B8B6F]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Utensils className="h-7 w-7 text-[#9B8B6F]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#F2E9D3]">{t.nav.restaurant || 'Restaurant Solidaire'}</h3>
                  <p className="text-[#E6DCC3]">
                    {'Découvrez notre restaurant solidaire et réservez votre place'}
                  </p>
                  <Button
                    variant="outline"
                    disabled
                    className="w-full mt-4 border-[#9B8B6F]/30 text-[#9B8B6F]/30 bg-transparent cursor-not-allowed opacity-50"
                  >
                    {'Réserver'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        {testimonials && testimonials.length > 0 && (
          <section className="py-20 bg-[#6F6C3F]">
            <div className="container">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-[#F2E9D3] mb-4" style={{ fontFamily: 'Caveat, cursive' }}>
                  {t.home.testimonialsTitle}
                </h2>
                <p className="text-lg text-[#E6DCC3] max-w-2xl mx-auto">
                  {t.home.testimonialsSubtitle}
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                {testimonials.slice(0, 3).map((testimonial: { id: number; content: string; authorName: string; authorRole?: string; rating?: number }) => (
                  <div key={testimonial.id} className="bg-[#4A4829] rounded-lg p-6 space-y-4 border border-[#F2E9D3]/10">
                    <div className="flex gap-1">
                      {[...Array(testimonial.rating || 5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-[#CDBB8A] text-[#CDBB8A]" />
                      ))}
                    </div>
                    <p className="text-[#E6DCC3] italic">"{testimonial.content}"</p>
                    <div className="flex items-center gap-3 pt-2">
                      <div className="w-10 h-10 rounded-full bg-[#F2E9D3]/10 flex items-center justify-center">
                        <span className="text-[#F2E9D3] font-medium">
                          {testimonial.authorName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-[#F2E9D3]">{testimonial.authorName}</div>
                        <div className="text-xs text-[#E6DCC3]">{testimonial.authorRole}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Partners Section */}
        {partners && partners.length > 0 && (
          <section className="py-16 bg-[#5E5B34]">
            <div className="container">
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold text-[#F2E9D3] mb-2">Nos partenaires</h2>
                <p className="text-[#E6DCC3]">Ils nous font confiance et nous soutiennent</p>
              </div>
              
              <div className="flex flex-wrap justify-center items-center gap-8">
                {partners.map((partner: { id: number; name: string; logoUrl?: string; websiteUrl?: string }) => (
                  <div key={partner.id} className="grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100">
                    {partner.logoUrl ? (
                      <img src={partner.logoUrl} alt={partner.name} className="h-12 object-contain" />
                    ) : (
                      <div className="h-12 px-6 bg-[#4A4829] rounded flex items-center justify-center border border-[#F2E9D3]/10">
                        <span className="font-medium text-[#E6DCC3]">{partner.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="py-20 bg-[#4A4829]">
          <div className="container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#F2E9D3]" style={{ fontFamily: 'Caveat, cursive' }}>
              Prêt à rejoindre l'aventure ?
            </h2>
            <p className="text-lg text-[#E6DCC3] max-w-2xl mx-auto mb-8">
              Inscrivez-vous dès maintenant et faites partie de cette belle initiative solidaire pour les enfants en difficulté
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/${lang}/benevole`}>
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto text-lg px-8 bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Devenir bénévole
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
