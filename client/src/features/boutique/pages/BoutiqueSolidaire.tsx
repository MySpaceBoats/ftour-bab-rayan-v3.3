import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import { ShoppingBag, Utensils, Sparkles, ArrowRight, Heart } from "lucide-react";

export default function BoutiqueSolidaire() {
  const { t, dir, lang } = useI18n();

  const categories = [
    {
      key: "goodies" as const,
      href: `/${lang}/goodies`,
      icon: ShoppingBag,
      color: "#CDBB8A",
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
    {
      key: "terroir" as const,
      href: `/${lang}/terroir`,
      icon: Sparkles,
      color: "#9B8B6F",
      title: t.boutique.terroirTitle,
      description: t.boutique.terroirDesc,
      cta: t.boutique.terroirCta,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#5E5B34]" dir={dir}>
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-[#4A4829]">
          <div className="container text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F2E9D3]/10 text-[#CDBB8A] text-sm font-medium mb-6">
              <Heart className="h-4 w-4" />
              {t.boutique.badge}
            </div>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F2E9D3] mb-6"
              style={{ fontFamily: "Caveat, cursive" }}
            >
              {t.boutique.title}
            </h1>
            <p className="text-lg md:text-xl text-[#E6DCC3] max-w-3xl mx-auto leading-relaxed">
              {t.boutique.subtitle}
            </p>
          </div>
        </section>

        {/* Categories Grid */}
        <section className="py-20 bg-[#5E5B34]">
          <div className="container">
            <div className="grid md:grid-cols-3 gap-8">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.key}
                    className="bg-[#4A4829] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#F2E9D3]/30 transition-all"
                  >
                    <div className="h-1" style={{ backgroundColor: cat.color }} />
                    <div className="p-8 space-y-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${cat.color}20` }}
                      >
                        <Icon className="h-7 w-7" style={{ color: cat.color }} />
                      </div>
                      <h2 className="text-xl font-bold text-[#F2E9D3]">{cat.title}</h2>
                      <p className="text-[#E6DCC3]">{cat.description}</p>
                      <Link href={cat.href}>
                        <Button
                          variant="outline"
                          className="w-full mt-4 border-[#F2E9D3]/30 text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#4A4829]"
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
          </div>
        </section>

        {/* Info Banner */}
        <section className="py-16 bg-[#4A4829]">
          <div className="container text-center">
            <p className="text-lg text-[#E6DCC3] max-w-2xl mx-auto">
              {t.boutique.infoText}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
