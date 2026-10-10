import { Link, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FeedbackCta from "@/components/FeedbackCta";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function RestaurantParticuliers() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12 max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/${lang}/reservation`}
            className="text-sm text-[#844653] underline"
          >
            ← Retour
          </Link>
          <h1 className="text-3xl font-bold text-[#844653] mt-2 italic">
            Réservation Ftour
          </h1>
          <p className="text-[#8b8b7a] mt-2">
            Demande de réservation pour le ftour solidaire —{" "}
            <a
              href="https://latabledujardin.ma/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#d4a574] hover:underline inline-flex items-center gap-1"
            >
              La Table du Jardin
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            by Bab Rayan.
          </p>
          <p className="text-sm text-[#8b8b7a] mt-3">
            Service unique à partir de 18h45.
            <br />
            Les demandes sont ouvertes pour toutes les dates.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={() => navigate(`/${lang}/contact`)}
              className="w-full bg-[#d4a574] text-[#844653] hover:bg-[#c9955f] font-medium"
            >
              Nous contacter pour réserver
            </Button>
          </CardContent>
        </Card>
      </main>
      <FeedbackCta type="restaurant" source="restaurant" />
      <Footer />
    </div>
  );
}
