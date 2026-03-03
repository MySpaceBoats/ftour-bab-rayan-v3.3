import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n";
import VolunteerGalleryUploadModule from "@/features/gallery/components/VolunteerGalleryUploadModule";

export default function BenevoleGalerieUpload() {
  const { lang } = useI18n();
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: `/${lang}/connexion`,
  });

  if (!loading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container py-10">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Connexion requise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Vous devez être connecté pour uploader des photos bénévoles.
              </p>
              <Link href={`/${lang}/connexion`}>
                <Button>Se connecter</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/${lang}/benevole`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Uploader mes photos bénévoles</h1>
        </div>

        <VolunteerGalleryUploadModule />
      </main>
      <Footer />
    </div>
  );
}
