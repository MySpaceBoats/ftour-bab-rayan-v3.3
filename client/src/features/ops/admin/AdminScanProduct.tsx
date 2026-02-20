import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, QrCode } from 'lucide-react';
import UniversalScannerCore from '@/components/UniversalScannerCore';

export default function AdminScanProduct() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Link href="/admin/commandes">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scanner Universel
            </h1>
            <p className="text-xs opacity-80">Produits - Benevoles - Reservations - Commandes - Dons</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <UniversalScannerCore onBack={() => navigate('/admin/commandes')} />
      </main>
    </div>
  );
}
