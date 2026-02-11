import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function RestaurantParticuliers() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    space: 'brasserie',
    seats: 1,
    fullName: '',
    phone: '',
    email: '',
  });

  const total = formData.seats * 250;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.time || !formData.fullName || !formData.phone || !formData.email) {
      toast.error('Merci de compléter tous les champs requis');
      return;
    }
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#f5f5f0]">
        <Navbar />
        <main className="container py-12 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Réservation confirmée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>Votre demande a été enregistrée et un QR de confirmation sera envoyé par email.</p>
              <p className="text-sm text-muted-foreground">Référence provisoire: RES-{Date.now().toString().slice(-6)}</p>
              <Button onClick={() => navigate(`/${lang}`)}>Retour à l'accueil</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12 max-w-3xl">
        <div className="mb-6">
          <Link href={`/${lang}/reservation`} className="text-sm text-[#5d5a3c] underline">← Retour au hub réservation</Link>
          <h1 className="text-3xl font-bold text-[#5d5a3c] mt-2">Restaurant - Particuliers</h1>
          <p className="text-muted-foreground">Choisissez un créneau puis passez au paiement.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informations de réservation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} required />
              </div>
              <div>
                <Label>Heure</Label>
                <Input type="time" value={formData.time} onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))} required />
              </div>
              <div>
                <Label>Espace</Label>
                <Select value={formData.space} onValueChange={(value) => setFormData((p) => ({ ...p, space: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brasserie">Brasserie</SelectItem>
                    <SelectItem value="table-du-jardin">Table du Jardin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre de places (max 10)</Label>
                <Input type="number" min={1} max={10} value={formData.seats} onChange={(e) => setFormData((p) => ({ ...p, seats: Math.min(10, Number(e.target.value) || 1) }))} required />
              </div>
              <div>
                <Label>Nom complet</Label>
                <Input value={formData.fullName} onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))} required />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} required />
              </div>
              <div className="md:col-span-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} required />
              </div>

              <div className="md:col-span-2 bg-muted rounded-lg p-4 space-y-1">
                <p className="font-semibold">Récapitulatif</p>
                <p className="text-sm">{formData.seats} place(s) × 250 MAD</p>
                <p className="font-semibold">Total estimé: {total} MAD</p>
                <p className="text-xs text-muted-foreground">Le paiement est redirigé vers le tunnel CMI à l'étape suivante.</p>
              </div>

              <div className="md:col-span-2">
                <Button type="submit" className="w-full">Valider et continuer au paiement</Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
      <Footer />
    </div>
  );
}
