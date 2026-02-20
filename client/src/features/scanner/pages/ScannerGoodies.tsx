import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import UniversalScannerCore from "@/components/UniversalScannerCore";

export default function ScannerGoodies() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-orange-600 text-white p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h1 className="font-bold text-lg">Scanner Universel</h1>
            <p className="text-xs opacity-80">Goodies - Benevoles - Reservations - Commandes - Dons</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <UniversalScannerCore onBack={() => navigate('/admin')} />
      </main>
    </div>
  );
}
