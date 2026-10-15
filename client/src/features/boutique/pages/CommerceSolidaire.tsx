import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useI18n } from "@/i18n";
import {
  ShoppingBag,
  Utensils,
  ArrowRight,
  Heart,
  Leaf,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MondeShop from "../components/MondeShop";

export default function CommerceSolidaire() {
  const { t, dir, lang } = useI18n();

  const boutiqueCategories = [
    {
      key: "goodies",
      href: `/${lang}/goodies`,
      icon: ShoppingBag,
      color: "#CDBB8A",
      title: t.boutique.goodiesTitle,
      description: t.boutique.goodiesDesc,
      cta: t.boutique.goodiesCta,
    },
    {
      key: "pastries",
      href: `/${lang}/patisserie`,
      icon: Utensils,
      color: "#D4A574",
      title: t.boutique.pastriesTitle,
      description: t.boutique.pastriesDesc,
      cta: t.boutique.pastriesCta,
    },
    {
      key: "terroir",
      href: `/${lang}/terroir`,
      icon: Leaf,
      color: "#8BAF6A",
      title: t.boutique.terroirTitle,
      description: t.boutique.terroirDesc,
      cta: t.boutique.terroirCta,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#864654]" dir={dir}>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 bg-[#6B3643]">
          <div className="container text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F2E9D3]/10 text-[#CDBB8A] text-sm font-medium mb-6">
              <Heart className="h-4 w-4" />
              {t.boutique.badge}
            </div>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#F2E9D3] mb-6"
              style={{ fontFamily: "Caveat, cursive" }}
            >
              Commerce Solidaire
            </h1>
            <p className="text-lg md:text-xl text-[#E6DCC3] max-w-3xl mx-auto leading-relaxed">
              {t.boutique.subtitle}
            </p>
          </div>
        </section>

        <Tabs
          defaultValue={new URLSearchParams(window.location.search).has("monde") ? "monde" : "casablanca"}
          className="gap-0"
        >
          <div className="bg-[#864654] pt-10 flex justify-center">
            <TabsList className="bg-[#6B3643] h-auto p-1">
              <TabsTrigger value="casablanca" className="px-6 py-2 text-[#F2E9D3] data-[state=active]:bg-[#CDBB8A] data-[state=active]:text-[#6B3643]">
                {t.boutique.tabCasablanca}
              </TabsTrigger>
              <TabsTrigger value="monde" className="px-6 py-2 text-[#F2E9D3] data-[state=active]:bg-[#CDBB8A] data-[state=active]:text-[#6B3643]">
                {t.boutique.tabMonde}
              </TabsTrigger>
            </TabsList>
          </div>

        <TabsContent value="monde" className="bg-[#864654] py-16">
          <div className="container">
            <h2 className="text-2xl md:text-3xl font-bold text-[#F2E9D3] mb-3 text-center" style={{ fontFamily: "Caveat, cursive" }}>
              {t.boutique.mondeTitle}
            </h2>
            <p className="text-[#E6DCC3] text-center mb-10">{t.boutique.mondeSubtitle}</p>
            <MondeShop />
          </div>
        </TabsContent>

        <TabsContent value="casablanca">
        {/* Boutique Solidaire section */}
        <section className="py-16 bg-[#864654]">
          <div className="container">
            <h2
              className="text-2xl md:text-3xl font-bold text-[#F2E9D3] mb-10 text-center"
              style={{ fontFamily: "Caveat, cursive" }}
            >
              {t.boutique.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {boutiqueCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.key}
                    className="bg-[#6B3643] rounded-lg overflow-hidden border border-[#F2E9D3]/10 group hover:border-[#F2E9D3]/30 transition-all"
                  >
                    <div className="h-1" style={{ backgroundColor: cat.color }} />
                    <div className="p-6 space-y-4">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: `${cat.color}30` }}
                      >
                        <Icon className="h-8 w-8" style={{ color: cat.color }} />
                      </div>
                      <h3 className="text-lg font-bold text-[#F2E9D3]">{cat.title}</h3>
                      <p className="text-[#E6DCC3] text-sm">{cat.description}</p>
                      <Link href={cat.href}>
                        <Button
                          variant="outline"
                          className="w-full mt-2 border-[#F2E9D3]/30 text-[#F2E9D3] bg-transparent hover:bg-[#F2E9D3] hover:text-[#6B3643]"
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
        </TabsContent>
        </Tabs>

        {/* Info Banner */}
        <section className="py-12 bg-[#6B3643]">
          <div className="container text-center">
            <p className="text-[#E6DCC3] max-w-2xl mx-auto">
              {t.boutique.infoText}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
