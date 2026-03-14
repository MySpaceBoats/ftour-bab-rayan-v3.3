import { useState } from 'react';
import { useLocation } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MapPin, Clock, Users, Heart, Leaf, UtensilsCrossed, Star } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';

export default function Reservation() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    seats: '1',
    salle: '' as '' | 'jardin' | 'brasserie',
    fullName: '',
    phone: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const createReservation = trpc.restaurantReservations.particulier.create.useMutation();
  const isReservationClosed = new Date() >= new Date('2026-03-13T00:00:00');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReservationClosed) {
      toast.error('Les réservations restaurant sont désormais fermées.');
      return;
    }

    const seatsCount = Number.parseInt(formData.seats, 10);

    if (!formData.date || !formData.salle || !formData.fullName || !formData.phone || !formData.email) {
      toast.error('Merci de compléter tous les champs requis');
      return;
    }

    if (!Number.isFinite(seatsCount) || seatsCount < 1 || seatsCount > 120) {
      toast.error('Le nombre de couverts doit être entre 1 et 120');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createReservation.mutateAsync({
        firstName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        date: formData.date,
        participantsCount: seatsCount,
        displayChoice: formData.salle as 'jardin' | 'brasserie',
      });

      if (result.success && result.reservation) {
        setReference(result.reservation.reference);
        toast.success('Demande envoyée avec succès !');
        setConfirmed(true);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de l'envoi de la demande");
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
              <CardTitle className="text-white text-2xl">Demande de réservation envoyée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Merci pour votre demande.</p>
                <p className="text-sm text-[#d4c4a0]">
                  Notre équipe organisatrice l'étudiera dans les plus brefs délais et vous contactera par email.
                </p>
              </div>
              <div className="bg-[#4a4830] p-3 rounded">
                <p className="text-sm font-medium text-[#d4c4a0]">Référence de votre demande</p>
                <p className="text-lg font-bold text-[#d4a574]">{reference || 'RES-PENDING'}</p>
              </div>
              <Button
                onClick={() => navigate(`/${lang}`)}
                className="w-full bg-[#d4a574] text-[#5d5a3c] hover:bg-[#c9955f]"
              >
                Retour à l'accueil
              </Button>
            </CardContent>
          </Card>

          <div className="mt-8">
            <div className="flex items-center gap-2 text-[#5d5a3c] mb-3">
              <MapPin className="h-5 w-5" />
              <h2 className="text-xl font-bold">Nous trouver</h2>
            </div>
            <p className="text-[#8b8b7a] text-sm mb-3">La Table du Jardin by Bab Rayan — 4 rue Bayt Lahm, quartier Palmier, Casablanca</p>
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

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="bg-[#5d5a3c] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#d4a574] text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            Restaurant Solidaire · Ramadan
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-2 leading-tight">
            La Table du Jardin
          </h1>
          <p className="text-xl text-[#d4c4a0] italic mb-6">by Bab Rayan</p>
          <p className="text-[#d4c4a0] max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Rompez le jeûne autour d'une table garnie, dans un cadre élégant et convivial.
            Chaque couvert contribue à la mission solidaire de l'association Bab Rayan.
          </p>
        </div>
      </section>

      {/* ── Info bar ─────────────────────────────────────── */}
      <section className="bg-[#4a4830] py-5 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="flex items-center gap-3 text-white">
            <Clock className="h-5 w-5 text-[#d4a574] shrink-0" />
            <div>
              <p className="text-[10px] text-[#d4c4a0] uppercase tracking-widest mb-0.5">Service</p>
              <p className="font-semibold text-sm">À partir de 18h45</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-white">
            <Users className="h-5 w-5 text-[#d4a574] shrink-0" />
            <div>
              <p className="text-[10px] text-[#d4c4a0] uppercase tracking-widest mb-0.5">Réservation</p>
              <p className="font-semibold text-sm">À partir de 1 couvert</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-white">
            <Heart className="h-5 w-5 text-[#d4a574] shrink-0" />
            <div>
              <p className="text-[10px] text-[#d4c4a0] uppercase tracking-widest mb-0.5">Esprit</p>
              <p className="font-semibold text-sm">Solidarité & convivialité</p>
            </div>
          </div>
        </div>
      </section>

      <main className="container py-12">
        <div className="max-w-5xl mx-auto">

          {/* ── L'expérience ─────────────────────────────── */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-[#d4a574] mb-3">
              <Star className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Une expérience unique</span>
              <Star className="h-4 w-4" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#5d5a3c] mb-4">
              Un ftour solidaire & mémorable
            </h2>
            <p className="text-[#8b8b7a] max-w-2xl mx-auto leading-relaxed">
              La Table du Jardin by Bab Rayan vous accueille pour partager la magie du ftour pendant le Ramadan.
              Un repas généreux, un lieu d'exception, un geste de solidarité — chaque réservation soutient les enfants et familles accompagnés par l'association.
            </p>
          </div>

          {/* ── Nos espaces ──────────────────────────────── */}
          <div className="mb-12">
            <h2 className="text-xl font-bold text-[#5d5a3c] mb-6 text-center">Nos espaces</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e8e5d8] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-[#5d5a3c]/10 flex items-center justify-center shrink-0">
                    <Leaf className="h-4 w-4 text-[#5d5a3c]" />
                  </div>
                  <h3 className="text-base font-bold text-[#5d5a3c]">Pavillon du Jardin</h3>
                </div>
                <p className="text-[#8b8b7a] text-sm leading-relaxed">
                  Un espace verdoyant et aéré, idéal pour profiter d'une atmosphère sereine en plein cœur de Casablanca.
                  Cadre naturel, lumière tamisée et décor chaleureux.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-[#e8e5d8] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-[#5d5a3c]/10 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="h-4 w-4 text-[#5d5a3c]" />
                  </div>
                  <h3 className="text-base font-bold text-[#5d5a3c]">Salon Palmier</h3>
                </div>
                <p className="text-[#8b8b7a] text-sm leading-relaxed">
                  Un salon raffiné sous les palmiers, alliant élégance et intimité.
                  Un écrin parfait pour un ftour mémorable dans une ambiance sophistiquée.
                </p>
              </div>
            </div>
          </div>

          {/* ── Formulaire de réservation ─────────────────── */}
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#5d5a3c] mb-1">Réservez votre table</h2>
              <p className="text-[#8b8b7a] text-sm">
                Remplissez le formulaire ci-dessous pour soumettre votre demande de réservation.
              </p>
            </div>

            {isReservationClosed && (
              <Card className="border border-[#7b1e3a] bg-[#7b1e3a]">
                <CardContent className="py-6 text-center space-y-2">
                  <p className="text-lg font-semibold text-white">Les réservations sont fermées</p>
                </CardContent>
              </Card>
            )}

            <form onSubmit={handleSubmit} className={isReservationClosed ? 'hidden' : ''}>
              <Card className="border border-[#e8e5d8]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-[#5d5a3c]">Vos informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Date */}
                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-[#8b8b7a] mt-1">Service unique à partir de 18h30 — toutes dates disponibles</p>
                  </div>

                  {/* Nombre de couverts */}
                  <div>
                    <Label htmlFor="seats">Nombre de couverts *</Label>
                    <Input
                      id="seats"
                      type="number"
                      min="1"
                      max="120"
                      value={formData.seats}
                      onChange={(e) => setFormData((p) => ({ ...p, seats: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-[#8b8b7a] mt-1">De 1 à 120 couverts</p>
                  </div>

                  {/* Espace */}
                  <div>
                    <Label htmlFor="salle">Espace *</Label>
                    <Select
                      value={formData.salle}
                      onValueChange={(value) =>
                        setFormData((p) => ({ ...p, salle: value as 'jardin' | 'brasserie' }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choisissez un espace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jardin">Pavillon du Jardin</SelectItem>
                        <SelectItem value="brasserie">Salon Palmier</SelectItem>
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
                      placeholder="Ex : Fatima Zahra Benali"
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
                      placeholder="Ex : +212 6 00 00 00 00"
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
                      placeholder="Ex : prenom@exemple.com"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#d4a574] text-[#5d5a3c] hover:bg-[#c9955f] font-semibold py-5 text-base"
                  >
                    {isSubmitting ? 'Envoi en cours…' : 'Envoyer ma demande →'}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>

          {/* ── Carte / Localisation ─────────────────────── */}
          <div className="max-w-2xl mx-auto mt-14">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 text-[#5d5a3c]">
                <MapPin className="h-5 w-5" />
                <h2 className="text-xl font-bold">Nous trouver</h2>
              </div>
              <p className="text-[#8b8b7a] text-sm mt-1">La Table du Jardin by Bab Rayan</p>
              <p className="text-[#8b8b7a] text-xs mt-0.5">4 rue Bayt Lahm, quartier Palmier, Casablanca</p>
            </div>
            <div className="rounded-xl overflow-hidden shadow-md">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.9690513357727!2d-7.631227813238418!3d33.5801528045934!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xda7d30029a4e42d%3A0x3373083e51403fde!2sla%20Table%20du%20Jardin%20by%20Bab%20Rayan!5e0!3m2!1sfr!2sma!4v1771424452220!5m2!1sfr!2sma"
                width="100%"
                height="400"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localisation La Table du Jardin by Bab Rayan"
              />
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
