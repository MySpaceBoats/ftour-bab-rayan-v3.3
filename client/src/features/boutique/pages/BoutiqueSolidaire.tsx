import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import { ShoppingBag, Utensils, ArrowRight, Heart, Leaf } from "lucide-react";

export default function BoutiqueSolidaire() {
  const { t, dir, lang } = useI18n();

  const topCategories = [
    {
      key: "goodies" as const,
      href: `/${lang}/goodies`,
      icon: ShoppingBag,
      color: "#38BDF8",
      title: t.boutique.goodiesTitle,
      description: t.boutique.goodiesDesc,
      cta: t.boutique.goodiesCta,
    },
    {
      key: "pastries" as const,
      href: `/${lang}/patisserie`,
      icon: Utensils,
      color: "#D4A574",
      title: t.boutique.pastriesTitle,
      description: t.boutique.pastriesDesc,
      cta: t.boutique.pastriesCta,
    },
  ];

  const terroirCategory = {
    key: "terroir" as const,
    href: `/${lang}/terroir`,
    icon: Leaf,
    color: "#8BAF6A",
    title: t.boutique.terroirTitle,
    description: t.boutique.terroirDesc,
    cta: t.boutique.terroirCta,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0F172A]" dir={dir}>
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-[#1E293B]">
          <div className="container text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F8FAFC]/10 text-[#38BDF8] text-sm font-medium mb-6">
              <Heart className="h-4 w-4" />
              {t.boutique.badge}
            </div>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F8FAFC] mb-6"
              style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
            >
              {t.boutique.title}
            </h1>
            <p className="text-lg md:text-xl text-[#CBD5E1] max-w-3xl mx-auto leading-relaxed">
              {t.boutique.subtitle}
            </p>
          </div>
        </section>

        {/* Categories Grid — triangle layout */}
        <section className="py-20 bg-[#0F172A]">
          <div className="container">
            {/* Top row: Goodies & Patisserie */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {topCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.key}
                    className="bg-[#1E293B] rounded-lg overflow-hidden border border-[#F8FAFC]/10 group hover:border-[#F8FAFC]/30 transition-all"
                  >
                    <div className="h-1" style={{ backgroundColor: cat.color }} />
                    <div className="p-8 space-y-4">
                      <div
                        className="w-24 h-24 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${cat.color}30` }}
                      >
                        <Icon className="h-12 w-12" style={{ color: cat.color }} />
                      </div>
                      <h2 className="text-xl font-bold text-[#F8FAFC]">{cat.title}</h2>
                      <p className="text-[#CBD5E1]">{cat.description}</p>
                      <Link href={cat.href}>
                        <Button
                          variant="outline"
                          className="w-full mt-4 border-[#F8FAFC]/30 text-[#F8FAFC] bg-transparent hover:bg-[#F8FAFC] hover:text-[#1E293B]"
                        >
                          {cat.cta}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom row: Produits du Terroir — centré pour former le triangle */}
            <div className="flex justify-center">
              <div className="w-full lg:w-1/2 bg-[#1E293B] rounded-lg overflow-hidden border border-[#F8FAFC]/10 group hover:border-[#F8FAFC]/30 transition-all">
                <div className="h-1" style={{ backgroundColor: terroirCategory.color }} />
                <div className="p-8 space-y-4">
                  <div
                    className="w-24 h-24 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${terroirCategory.color}30` }}
                  >
                    <terroirCategory.icon className="h-12 w-12" style={{ color: terroirCategory.color }} />
                  </div>
                  <h2 className="text-xl font-bold text-[#F8FAFC]">{terroirCategory.title}</h2>
                  <p className="text-[#CBD5E1]">{terroirCategory.description}</p>
                  <Link href={terroirCategory.href}>
                    <Button
                      variant="outline"
                      className="w-full mt-4 border-[#F8FAFC]/30 text-[#F8FAFC] bg-transparent hover:bg-[#F8FAFC] hover:text-[#1E293B]"
                    >
                      {terroirCategory.cta}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Info Banner */}
        <section className="py-16 bg-[#1E293B]">
          <div className="container text-center">
            <p className="text-lg text-[#CBD5E1] max-w-2xl mx-auto">
              {t.boutique.infoText}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
