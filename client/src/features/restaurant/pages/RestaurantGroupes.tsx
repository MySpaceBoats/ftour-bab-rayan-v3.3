import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function RestaurantGroupes() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: '',
    groupSize: '',
    organizationName: '',
    contactName: '',
    phone: '',
    email: '',
    notes: '',
  });

  // Dates autorisées : 20 février - 13 mars 2026
  const startDate = new Date(2026, 1, 20);
  const endDate = new Date(2026, 2, 13);

  const isDateAllowed = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date >= startDate && date <= endDate;
  };

  const handleInputChange = (field: string, value: any) => {
    if (field === 'groupSize') {
      // Autoriser l'édition libre du champ (string)
      setFormData(prev => ({ ...prev, [field]: value }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const createReservation = trpc.restaurantReservations.groupe.create.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.date || !formData.contactName || !formData.phone || !formData.email) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!isDateAllowed(formData.date)) {
      toast.error('Veuillez sélectionner une date valide (20 février - 13 mars)');
      return;
    }

    // Normaliser groupSize
    const groupSizeNum = parseInt(formData.groupSize, 10);
    if (isNaN(groupSizeNum) || groupSizeNum < 5 || groupSizeNum > 120) {
      toast.error('Le nombre de couverts doit être entre 5 et 120');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await createReservation.mutateAsync({
        date: formData.date,
        participantsCount: groupSizeNum,
        contactName: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        groupName: formData.organizationName || '',
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
              <CardTitle className="text-2xl">Demande de réservation envoyée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Merci pour votre demande.</p>
                <p className="text-sm">Notre équipe organisatrice l'étudiera dans les plus brefs délais.</p>
                <p className="text-sm">Vous recevrez une confirmation par email sous 48 heures avec les instructions de paiement et votre QR d'accès.</p>
              </div>
              <div className="bg-[#4a4830] p-3 rounded">
                <p className="text-sm font-medium">Référence de votre demande</p>
                <p className="text-lg font-bold text-[#d4a574]">{reference || 'GRP-PENDING'}</p>
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
        <Link href={`/${lang}/reservation`} className="text-sm text-[#5d5a3c] underline">← Retour</Link>
        
        <div className="mb-8 mt-6">
          <h1 className="text-3xl font-bold text-[#5d5a3c] italic">Réservation Ftour – Groupes</h1>
          <p className="text-[#8b8b7a] mt-2">Demande de réservation pour le ftour solidaire (réservation en ligne à partir de 5 couverts). Confirmation sous 48 heures.</p>
          <p className="text-[#8b8b7a] text-sm mt-1">Service unique à partir de 18h45.</p>
          <p className="text-[#8b8b7a] text-sm mt-1">Les demandes sont ouvertes du 20 février au 13 mars.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Formulaire de demande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date */}
              <div>
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  min={startDate.toISOString().split('T')[0]}
                  max={endDate.toISOString().split('T')[0]}
                  required
                />
                <p className="text-xs text-[#8b8b7a] mt-1">Entre le 20 février et le 13 mars 2026</p>
              </div>

              {/* Taille du groupe */}
              <div>
                <Label htmlFor="groupSize">Nombre de couverts * (5-120)</Label>
                <Input
                  id="groupSize"
                  type="number"
                  min="5"
                  max="120"
                  value={formData.groupSize}
                  onChange={(e) => handleInputChange('groupSize', e.target.value)}
                  placeholder="Ex: 45"
                  required
                />
              </div>

              {/* Nom du groupe (optionnel) */}
              <div>
                <Label htmlFor="organizationName">Nom du groupe / organisation (optionnel)</Label>
                <Input
                  id="organizationName"
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => handleInputChange('organizationName', e.target.value)}
                  placeholder="Ex: Association Culturelle"
                />
              </div>

              {/* Nom du contact */}
              <div>
                <Label htmlFor="contactName">Nom du contact *</Label>
                <Input
                  id="contactName"
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => handleInputChange('contactName', e.target.value)}
                  placeholder="Ex: Jean Dupont"
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
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Ex: +212612345678"
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
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Ex: contact@example.com"
                  required
                />
              </div>

              {/* Notes (optionnel) */}
              <div>
                <Label htmlFor="notes">Informations complémentaires (optionnel)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Ex: Besoins spéciaux, régimes alimentaires, etc."
                  rows={3}
                />
              </div>

              {/* Bloc informatif */}
              <div className="bg-[#f9f9f5] p-4 rounded border border-[#d4a574]">
                <p className="text-sm text-[#5d5a3c]">
                  Après validation de votre demande, vous recevrez un email de confirmation avec les instructions de paiement et votre QR d'accès.
                </p>
              </div>

              {/* Bouton */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#5d5a3c] text-white hover:bg-[#4a4830]"
              >
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer ma demande →'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
      <Footer />
    </div>
  );
}
