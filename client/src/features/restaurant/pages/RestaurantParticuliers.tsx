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
import { MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

export default function RestaurantParticuliers() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    seats: 5,
    salle: '' as '' | 'jardin' | 'brasserie',
    fullName: '',
    phone: '',
    email: '',
  });

  // Dates autorisées : 20 février - 13 mars
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
    
    if (!formData.date || !formData.salle || !formData.fullName || !formData.phone || !formData.email) {
      toast.error('Merci de compléter tous les champs requis');
      return;
    }

    if (!isDateAllowed(formData.date)) {
      toast.error('Veuillez sélectionner une date entre le 20 février et le 13 mars');
      return;
    }

    if (formData.seats < 5 || formData.seats > 12) {
      toast.error('Le nombre de couverts doit être entre 5 et 12');
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
        displayChoice: formData.salle as 'jardin' | 'brasserie',
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

          {/* Localisation du restaurant */}
          <div className="mt-8">
            <div className="flex items-center gap-2 text-[#5d5a3c] mb-3">
              <MapPin className="h-5 w-5" />
              <h2 className="text-xl font-bold">Nous trouver</h2>
            </div>
            <p className="text-[#8b8b7a] text-sm mb-3">La Table du Jardin by Bab Rayan</p>
            <div className="rounded-lg overflow-hidden shadow-md">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.9690513357727!2d-7.631227813238418!3d33.5801528045934!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xda7d30029a4e42d%3A0x3373083e51403fde!2sla%20Table%20du%20Jardin%20by%20Bab%20Rayan!5e0!3m2!1sfr!2sma!4v1771424452220!5m2!1sfr!2sma"
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localisation La Table du Jardin by Bab Rayan"
              />
            </div>
          </div>
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
          <Link href={`/${lang}/reservation`} className="text-sm text-[#5d5a3c] underline">← Retour</Link>
          <h1 className="text-3xl font-bold text-[#5d5a3c] mt-2 italic">Réservation Ftour</h1>
          <p className="text-[#8b8b7a] mt-2">
            Demande de réservation pour le ftour solidaire (réservation en ligne à partir de 5 couverts). Confirmation sous 48 heures.
          </p>
          <p className="text-sm text-[#8b8b7a] mt-3">
            Service unique à partir de 18h45.<br />
            Les demandes sont ouvertes du 20 février au 13 mars.
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
                <Label htmlFor="seats">Nombre de couverts (5 à 12) *</Label>
                <Input
                  id="seats"
                  type="number"
                  min="5"
                  max="12"
                  value={formData.seats}
                  onChange={(e) => setFormData((p) => ({ ...p, seats: Math.max(5, Math.min(12, parseInt(e.target.value) || 5)) }))}
                  required
                />
              </div>

              {/* Salle */}
              <div>
                <Label htmlFor="salle">Salle *</Label>
                <Select
                  value={formData.salle}
                  onValueChange={(value) => setFormData((p) => ({ ...p, salle: value as 'jardin' | 'brasserie' }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisissez une salle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jardin">Jardin</SelectItem>
                    <SelectItem value="brasserie">Brasserie</SelectItem>
                  </SelectContent>
                </Select>
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
