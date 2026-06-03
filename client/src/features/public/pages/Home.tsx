import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FeedbackCta from "@/components/FeedbackCta";
import { useI18n } from "@/i18n";
import {
  Heart,
  Users,
  ShoppingBag,
  ArrowRight,
  Star,
  Clock,
  MapPin,
  Utensils,
  GraduationCap,
  Home as HomeIcon,
  Baby,
  TrendingUp,
  Shield,
  ChevronDown,
} from "lucide-react";
import RamadanImpactLive from "@/components/RamadanImpactLive";

export default function Home() {
  const { t, dir, lang } = useI18n();
  const { data: testimonials } = trpc.public.testimonials.useQuery();
  const { data: partners } = trpc.public.partners.useQuery();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0F172A" }} dir={dir}>
      <Navbar />

      <main className="flex-1">

        {/* ================================================================
            HERO — Immersif, moderne, premier impact
            ================================================================ */}
        <section
          className="relative min-h-[92vh] flex items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #070E1A 0%, #0F172A 40%, #1E3A8A 80%, #1D4ED8 100%)" }}
        >
          {/* Orbes lumineux décoratifs */}
          <div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)", filter: "blur(60px)" }}
          />
          <div
            className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)", filter: "blur(60px)" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(30,58,138,0.2) 0%, transparent 70%)", filter: "blur(80px)" }}
          />

          {/* Grille décorative */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(rgba(248,250,252,1) 1px, transparent 1px), linear-gradient(90deg, rgba(248,250,252,1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          <div className="container relative z-10 py-24 text-center">
            <div className="max-w-4xl mx-auto space-y-8">

              {/* Badge édition */}
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-sm font-semibold"
                  style={{
                    background: "rgba(37,99,235,0.15)",
                    border: "1px solid rgba(37,99,235,0.35)",
                    color: "#60A5FA",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"
                  />
                  <span style={{ fontFamily: "Cormorant Garamond, serif", fontStyle: "italic", fontSize: "15px" }}>
                    {t.home.heroSubtitle}
                  </span>
                </div>
              </div>

              {/* Titre arabe */}
              <div
                className="text-2xl md:text-3xl text-sky-300/70"
                style={{ fontFamily: "Aref Ruqaa, serif" }}
              >
                فطور باب ريان
              </div>

              {/* Titre principal */}
              <h1
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white leading-[0.95] tracking-tight"
                style={{ fontFamily: "Syne, Inter, sans-serif", fontWeight: 800 }}
              >
                {t.home.heroTitle}
              </h1>

              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                {t.home.heroDescription}
              </p>

              {/* CTAs principaux */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Link href={`/${lang}/reservation`}>
                  <button
                    className="flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-200"
                    style={{
                      background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)",
                      boxShadow: "0 4px 24px rgba(37,99,235,0.4)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(37,99,235,0.55)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(37,99,235,0.4)";
                    }}
                  >
                    <Utensils className="h-5 w-5" />
                    Réserver ftour
                  </button>
                </Link>
                <Link href={`/${lang}/benevole`}>
                  <button
                    className="flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-200"
                    style={{ border: "1px solid rgba(248,250,252,0.2)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(248,250,252,0.06)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.4)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.2)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    }}
                  >
                    <Users className="h-5 w-5 text-sky-400" />
                    Devenir bénévole
                  </button>
                </Link>
                <Link href={`/${lang}/dons`}>
                  <button
                    className="flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-200"
                    style={{ border: "1px solid rgba(248,250,252,0.2)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(248,250,252,0.06)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.4)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.2)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    }}
                  >
                    <Heart className="h-5 w-5 text-rose-400" />
                    {t.cta.donate}
                  </button>
                </Link>
              </div>

              {/* Micro-stats en ligne */}
              <div
                className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-slate-400"
                style={{ borderTop: "1px solid rgba(248,250,252,0.06)", paddingTop: "2rem", marginTop: "1rem" }}
              >
                {[
                  { n: "+6 000", label: "bénévoles mobilisés" },
                  { n: "+230 000", label: "repas servis" },
                  { n: "10 ans", label: "d'engagement" },
                  { n: "+1 500", label: "familles aidées" },
                ].map(({ n, label }) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{n}</span>
                    <span className="text-slate-500">{label}</span>
                    <span className="hidden sm:block last:hidden text-slate-700 mx-1">·</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-500 animate-bounce">
            <ChevronDown className="h-5 w-5" />
          </div>
        </section>

        {/* ================================================================
            CHIFFRES CLÉS — Impact consolidé
            ================================================================ */}
        <section style={{ background: "#1E293B", borderBottom: "1px solid rgba(248,250,252,0.06)" }}>
          <div className="container py-16">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0 divide-x divide-white/5">
              {[
                { n: "+450", label: t.home.childrenCaredFor, icon: Baby },
                { n: "+6 000", label: t.home.volunteersCount, icon: Users },
                { n: "+1 500", label: t.home.familiesBenefited, icon: HomeIcon },
                { n: "+230 000", label: t.home.mealsServed, icon: Utensils },
                { n: "+31 200", label: t.home.ftoursServed, icon: Star, span: true },
              ].map(({ n, label, icon: Icon, span }) => (
                <div
                  key={n}
                  className={`flex flex-col items-center justify-center py-8 px-4 text-center group ${span ? "col-span-2 md:col-span-1" : ""}`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-200 group-hover:scale-110"
                    style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}
                  >
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div
                    className="text-3xl md:text-4xl font-black text-white mb-1 leading-none"
                    style={{ fontFamily: "Syne, Inter, sans-serif", fontWeight: 800 }}
                  >
                    {n}
                  </div>
                  <div className="text-xs text-slate-500 max-w-[120px] leading-tight">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================
            À PROPOS — Section identité
            ================================================================ */}
        <section style={{ background: "#0F172A" }} className="py-24">
          <div className="container">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-7">
                {/* Label section */}
                <div className="flex items-center gap-3">
                  <div style={{ width: 40, height: 3, background: "linear-gradient(90deg, #2563EB, #38BDF8)", borderRadius: 2 }} />
                  <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest">
                    {t.home.solidarityActions}
                  </span>
                </div>

                <h2
                  className="text-4xl md:text-5xl text-white leading-tight"
                  style={{ fontFamily: "Syne, Inter, sans-serif", fontWeight: 700 }}
                >
                  {t.home.ftourTitle}
                </h2>

                <p className="text-base text-slate-400 leading-relaxed">
                  {t.home.ftourDesc1}
                </p>
                <p className="text-base text-slate-400 leading-relaxed">
                  {t.home.ftourDesc2}
                </p>

                <ul className="space-y-4">
                  {[
                    { Icon: Clock, title: t.home.since2015, desc: t.home.yearsEngagement },
                    { Icon: MapPin, title: t.home.casablanca, desc: t.home.address },
                    { Icon: Users, title: t.home.volunteersCount6000, desc: t.home.engagedCommunity },
                  ].map(({ Icon, title, desc }) => (
                    <li key={title} className="flex items-start gap-4">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}
                      >
                        <Icon className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <span className="font-semibold text-white text-sm">{title}</span>
                        <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <Link href={`/${lang}/evenement`}>
                  <button
                    className="flex items-center gap-2 mt-2 text-sm font-semibold text-blue-400 hover:text-sky-300 transition-colors group"
                  >
                    {t.cta.learnMore}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </Link>
              </div>

              <div className="relative">
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{ aspectRatio: "4/5", border: "1px solid rgba(37,99,235,0.15)" }}
                >
                  <img
                    src="https://jgnzhrlumlydmseusnbo.supabase.co/storage/v1/object/public/Images%20siteweb/WhatsApp%20Image%202026-02-16%20at%2010.17.55.jpeg"
                    alt="Ftour Bab Rayan"
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay gradient */}
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(15,23,42,0.6) 0%, transparent 50%)" }}
                  />
                </div>

                {/* Carte flottante */}
                <div
                  className="absolute -bottom-6 -left-6 px-5 py-4 rounded-2xl"
                  style={{
                    background: "rgba(30,41,59,0.95)",
                    border: "1px solid rgba(37,99,235,0.25)",
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(37,99,235,0.15)" }}
                    >
                      <Utensils className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-lg leading-none">+31 200</div>
                      <div className="text-xs text-slate-400 mt-0.5">Ftours servis</div>
                    </div>
                  </div>
                </div>

                {/* Badge accréditation */}
                <div
                  className="absolute -top-4 -right-4 px-4 py-2.5 rounded-xl"
                  style={{
                    background: "rgba(37,99,235,0.9)",
                    boxShadow: "0 8px 24px rgba(37,99,235,0.4)",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-white" />
                    <span className="text-xs font-bold text-white">Depuis 2015</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            IMPACT EN DIRECT
            ================================================================ */}
        <div style={{ background: "#1E293B" }}>
          <RamadanImpactLive className="text-white" />
        </div>

        {/* ================================================================
            MISSIONS — Trois piliers
            ================================================================ */}
        <section style={{ background: "#0F172A" }} className="py-24">
          <div className="container">
            <div className="text-center mb-16 space-y-4">
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-blue-400 uppercase tracking-widest"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}
                >
                  {t.home.missionsTitle}
                </div>
              </div>
              <h2
                className="text-4xl md:text-5xl text-white"
                style={{ fontFamily: "Syne, Inter, sans-serif", fontWeight: 700 }}
              >
                {t.home.missionsSubtitle}
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  Icon: HomeIcon,
                  title: t.home.childProtection,
                  desc: t.home.childProtectionDesc,
                  cta: t.home.discoverHome,
                  color: "#2563EB",
                  colorBg: "rgba(37,99,235,0.12)",
                  colorBorder: "rgba(37,99,235,0.25)",
                },
                {
                  Icon: GraduationCap,
                  title: t.home.educationSchool,
                  desc: t.home.educationSchoolDesc,
                  cta: t.home.discoverSchool,
                  color: "#38BDF8",
                  colorBg: "rgba(56,189,248,0.1)",
                  colorBorder: "rgba(56,189,248,0.2)",
                },
                {
                  Icon: Baby,
                  title: t.home.trainingInsertion,
                  desc: t.home.trainingInsertionDesc,
                  cta: t.home.discoverCFI,
                  color: "#10B981",
                  colorBg: "rgba(16,185,129,0.1)",
                  colorBorder: "rgba(16,185,129,0.2)",
                },
              ].map(({ Icon, title, desc, cta, color, colorBg, colorBorder }) => (
                <div
                  key={title}
                  className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: "#1E293B",
                    border: "1px solid rgba(248,250,252,0.06)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = colorBorder;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 48px ${colorBg.replace("0.12", "0.15")}`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.06)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  {/* Barre accent en haut */}
                  <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />

                  <div className="p-8 space-y-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                      style={{ background: colorBg, border: `1px solid ${colorBorder}` }}
                    >
                      <Icon className="h-6 w-6" style={{ color }} />
                    </div>
                    <h3
                      className="text-xl font-bold text-white"
                      style={{ fontFamily: "Syne, Inter, sans-serif" }}
                    >
                      {title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                    <Link href={`/${lang}/association`}>
                      <button
                        className="flex items-center gap-2 text-sm font-medium transition-colors group/btn mt-2"
                        style={{ color }}
                      >
                        {cta}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================
            COMMENT PARTICIPER — Trois parcours différenciés
            ================================================================ */}
        <section
          className="py-24"
          style={{ background: "linear-gradient(180deg, #1E3A8A 0%, #1E293B 100%)" }}
        >
          <div className="container">
            <div className="text-center mb-16 space-y-4">
              <h2
                className="text-4xl md:text-5xl text-white"
                style={{ fontFamily: "Syne, Inter, sans-serif", fontWeight: 700 }}
              >
                {t.home.howToParticipate}
              </h2>
              <p className="text-lg text-blue-200/70 max-w-xl mx-auto">
                {t.home.howToParticipateDesc}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Bénévolat */}
              <div
                className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2"
                style={{
                  background: "rgba(248,250,252,0.06)",
                  border: "1px solid rgba(248,250,252,0.12)",
                  backdropFilter: "blur(12px)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(248,250,252,0.1)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.25)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(248,250,252,0.06)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.12)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div className="p-8 space-y-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    style={{ background: "rgba(248,250,252,0.12)", border: "1px solid rgba(248,250,252,0.2)" }}
                  >
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
                      {t.home.volunteerCardTitle}
                    </h3>
                    <p className="text-sm text-blue-100/60 leading-relaxed">{t.home.volunteerCardDesc}</p>
                  </div>
                  <Link href={`/${lang}/benevole`}>
                    <button
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 mt-2"
                      style={{ background: "rgba(248,250,252,0.15)", border: "1px solid rgba(248,250,252,0.2)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,250,252,0.25)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,250,252,0.15)"; }}
                    >
                      {t.home.register}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Boutique solidaire */}
              <div
                className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2"
                style={{
                  background: "rgba(37,99,235,0.12)",
                  border: "1px solid rgba(37,99,235,0.25)",
                  backdropFilter: "blur(12px)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.2)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(37,99,235,0.25)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.12)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.25)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div className="p-8 space-y-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(56,189,248,0.3)" }}
                  >
                    <ShoppingBag className="h-7 w-7 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
                      {t.home.boutiqueTitle}
                    </h3>
                    <p className="text-sm text-blue-100/60 leading-relaxed">{t.home.boutiqueDesc}</p>
                  </div>
                  <Link href={`/${lang}/boutique`}>
                    <button
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-sky-400 transition-all duration-200 mt-2"
                      style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.35)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.3)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.15)"; }}
                    >
                      {t.home.viewBoutique}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Don */}
              <div
                className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2"
                style={{
                  background: "rgba(244,63,94,0.08)",
                  border: "1px solid rgba(244,63,94,0.2)",
                  backdropFilter: "blur(12px)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.14)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(244,63,94,0.4)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 60px rgba(244,63,94,0.15)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.08)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(244,63,94,0.2)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div className="p-8 space-y-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.25)" }}
                  >
                    <Heart className="h-7 w-7 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
                      {t.home.donationCardTitle}
                    </h3>
                    <p className="text-sm text-blue-100/60 leading-relaxed">{t.home.donationCardDesc}</p>
                  </div>
                  <Link href={`/${lang}/dons`}>
                    <button
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-rose-400 transition-all duration-200 mt-2"
                      style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.2)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.1)"; }}
                    >
                      {t.home.donateNow}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            TÉMOIGNAGES
            ================================================================ */}
        {testimonials && testimonials.length > 0 && (
          <section style={{ background: "#0F172A" }} className="py-24">
            <div className="container">
              <div className="text-center mb-14 space-y-4">
                <div className="flex justify-center">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-blue-400 uppercase tracking-widest"
                    style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}
                  >
                    {t.home.testimonialsTitle}
                  </div>
                </div>
                <h2
                  className="text-4xl md:text-5xl text-white"
                  style={{ fontFamily: "Syne, Inter, sans-serif", fontWeight: 700 }}
                >
                  {t.home.testimonialsSubtitle}
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {testimonials.slice(0, 3).map((testimonial: {
                  id: number;
                  content: string;
                  authorName: string;
                  authorRole?: string;
                  rating?: number;
                }) => (
                  <div
                    key={testimonial.id}
                    className="group rounded-2xl p-7 space-y-5 transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background: "#1E293B",
                      border: "1px solid rgba(248,250,252,0.06)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.25)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(37,99,235,0.1)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.06)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    {/* Guillemet décoratif */}
                    <div className="text-4xl text-blue-600/30 font-serif leading-none select-none">"</div>

                    <div className="flex gap-0.5">
                      {[...Array(testimonial.rating || 5)].map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed italic">
                      {testimonial.content}
                    </p>
                    <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid rgba(248,250,252,0.06)" }}>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1E3A8A, #2563EB)" }}
                      >
                        <span className="text-white text-sm font-semibold">
                          {testimonial.authorName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{testimonial.authorName}</div>
                        <div className="text-xs text-slate-500">{testimonial.authorRole}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            PARTENAIRES
            ================================================================ */}
        {partners && partners.length > 0 && (
          <section style={{ background: "#1E293B", borderTop: "1px solid rgba(248,250,252,0.05)" }} className="py-16">
            <div className="container">
              <div className="text-center mb-10">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                  Nos partenaires
                </p>
                <p className="text-slate-400 text-sm">Ils nous font confiance et nous soutiennent</p>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-8">
                {partners.map((partner: { id: number; name: string; logoUrl?: string; websiteUrl?: string }) => (
                  <div
                    key={partner.id}
                    className="transition-all duration-200 hover:scale-105"
                    style={{ opacity: 0.5, filter: "grayscale(1) brightness(1.5)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                      (e.currentTarget as HTMLElement).style.filter = "grayscale(0) brightness(1)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.opacity = "0.5";
                      (e.currentTarget as HTMLElement).style.filter = "grayscale(1) brightness(1.5)";
                    }}
                  >
                    {partner.logoUrl ? (
                      <img src={partner.logoUrl} alt={partner.name} className="h-10 object-contain" />
                    ) : (
                      <div
                        className="h-10 px-5 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(248,250,252,0.06)", border: "1px solid rgba(248,250,252,0.1)" }}
                      >
                        <span className="text-sm font-medium text-slate-300">{partner.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            CTA FINAL — Appel à l'action
            ================================================================ */}
        <section
          className="py-24 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #1D4ED8 100%)" }}
        >
          {/* Orbes */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)", filter: "blur(60px)", transform: "translate(30%, -30%)" }}
          />
          <div
            className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 70%)", filter: "blur(60px)", transform: "translate(-30%, 30%)" }}
          />

          <div className="container text-center relative z-10 space-y-8">
            <div className="flex justify-center">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-blue-200 uppercase tracking-widest"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <TrendingUp className="h-3 w-3" />
                13e Édition — Ramadan 2026
              </div>
            </div>

            <h2
              className="text-4xl md:text-6xl font-black text-white max-w-3xl mx-auto leading-tight"
              style={{ fontFamily: "Syne, Inter, sans-serif" }}
            >
              Prêt à rejoindre l'aventure ?
            </h2>
            <p className="text-lg text-blue-200/70 max-w-xl mx-auto">
              Inscrivez-vous dès maintenant et faites partie de cette belle initiative solidaire pour les enfants en difficulté.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/${lang}/benevole`}>
                <button
                  className="flex items-center justify-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-200"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(8px)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.25)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  <Users className="h-5 w-5" />
                  Devenir bénévole
                </button>
              </Link>
              <Link href={`/${lang}/dons`}>
                <button
                  className="flex items-center justify-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    color: "#1E3A8A",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <Heart className="h-5 w-5 text-rose-500" />
                  <span style={{ color: "#1E3A8A" }}>{t.cta.donate}</span>
                </button>
              </Link>
            </div>
          </div>
        </section>

      </main>

      <FeedbackCta type="general" source="home" />
      <Footer />
    </div>
  );
}
