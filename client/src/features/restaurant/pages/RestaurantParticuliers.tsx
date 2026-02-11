import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function RestaurantParticuliers() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    seats: 1,
    fullName: '',
    phone: '',
    email: '',
  });

  // Dates autorisées : 20 février - 13 mars 2026
  const startDate = new Date(2026, 1, 20); // février = mois 1
  const endDate = new Date(2026, 2, 13); // mars = mois 2

  const isDateAllowed = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date >= startDate && date <= endDate;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const createReservation = trpc.restaurantReservations.particulier.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.fullName || !formData.phone || !formData.email) {
      toast.error('Merci de compléter tous les champs requis');
      return;
    }

    if (!isDateAllowed(formData.date)) {
      toast.error('Veuillez sélectionner une date entre le 20 février et le 13 mars');
      return;
    }

    if (formData.seats < 1 || formData.seats > 12) {
      toast.error('Le nombre de places doit être entre 1 et 12');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createReservation.mutateAsync({
        firstName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        date: formData.date,
        participantsCount: formData.seats,
      });
      
      if (result.success && result.reservation) {
        setReference(result.reservation.reference);
        toast.success('Demande envoyée avec succès!');
        setConfirmed(true);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi de la demande');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#f5f5f0]">
        <Navbar />
        <main className="container py-12 max-w-2xl">
          <Card className="bg-[#5d5a3c] text-white border-0">
            <CardHeader>
              <CardTitle className="text-white">Demande de réservation envoyée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Merci pour votre demande.</p>
                <p className="text-sm">Notre équipe organisatrice l'étudiera dans les plus brefs délais.</p>
                <p className="text-sm">Vous recevrez une confirmation par email sous 48 heures.</p>
              </div>
              <div className="bg-[#4a4830] p-3 rounded">
                <p className="text-sm font-medium">Référence de votre demande</p>
                <p className="text-lg font-bold text-[#d4a574]">{reference || 'RES-PENDING'}</p>
              </div>
              <Button onClick={() => navigate(`/${lang}`)} className="w-full bg-[#d4a574] text-[#5d5a3c] hover:bg-[#c9955f]">Retour à l'accueil</Button>
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
      <main className="container py-12 max-w-2xl">
        <div className="mb-6">
          <Link href={`/${lang}/reservation`} className="text-sm text-[#5d5a3c] underline">← Retour au hub réservation</Link>
          <h1 className="text-3xl font-bold text-[#5d5a3c] mt-2 italic">Restaurant - Particuliers</h1>
          <p className="text-[#8b8b7a] mt-2">
            Demande de réservation pour le ftour solidaire.<br />
            Service unique à partir de 18h45.
          </p>
          <p className="text-sm text-[#8b8b7a] mt-3">
            Les demandes sont ouvertes du 20 février au 13 mars.<br />
            Confirmation sous 48 heures par notre équipe.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Vos informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date */}
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  min="2026-02-20"
                  max="2026-03-13"
                  value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                  required
                />
                <p className="text-xs text-[#8b8b7a] mt-1">Entre le 20 février et le 13 mars</p>
              </div>

              {/* Nombre de places */}
              <div>
                <Label htmlFor="seats">Nombre de places (1 à 12) *</Label>
                <Input
                  id="seats"
                  type="number"
                  min="1"
                  max="12"
                  value={formData.seats}
                  onChange={(e) => setFormData((p) => ({ ...p, seats: Math.max(1, Math.min(12, parseInt(e.target.value) || 1)) }))}
                  required
                />
              </div>

              {/* Nom complet */}
              <div>
                <Label htmlFor="fullName">Nom complet *</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                  required
                />
              </div>

              {/* Téléphone */}
              <div>
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>

              {/* Bouton */}
              <Button type="submit" className="w-full bg-[#d4a574] text-[#5d5a3c] hover:bg-[#c9955f] font-medium">
                Envoyer ma demande →
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
      <Footer />
    </div>
  );
}
