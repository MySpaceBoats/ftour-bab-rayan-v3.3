import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import UniversalScannerCore from '@/components/UniversalScannerCore';

export default function AdminScanReservation() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <div className="bg-[#5d5a3c] text-[#f5f5dc] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/admin/reservations')}
            className="text-[#f5f5dc] hover:bg-[#4a4730]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Scanner Universel</h1>
            <p className="text-sm text-[#d4d4aa]">Reservations - Benevoles - Commandes - Dons</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <UniversalScannerCore onBack={() => setLocation('/admin/reservations')} />
      </div>
    </div>
  );
}
