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

export default function CompanyBooking() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  
  const [formData, setFormData] = useState({
    // Étape 1 - Informations Entreprise
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    companyICE: '',
    companyNotes: '',
    // Étape 2 - Détails de la demande
    date: '',
    participantsCount: 10,
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
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Validation Étape 1
    if (step === 1) {
      if (!formData.companyName || !formData.contactName || !formData.contactEmail || !formData.contactPhone) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }
      setStep(2);
      return;
    }

    // Validation Étape 2 et soumission
    if (step === 2) {
      if (!formData.date || !formData.participantsCount) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }

      if (!isDateAllowed(formData.date)) {
        toast.error('Veuillez sélectionner une date entre le 20 février et le 13 mars');
        return;
      }

      if (formData.participantsCount < 10 || formData.participantsCount > 120) {
        toast.error('Le nombre de participants doit être entre 10 et 120');
        return;
      }

      // TODO: Send Email 1 (demande reçue) - no QR yet
      // TODO: Update status to pending_validation in database
      // TODO: Create company booking record with status = pending_validation

      setConfirmed(true);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
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
                <p className="text-sm">Vous recevrez une confirmation par email sous 48 heures avec les instructions de paiement et votre QR d'accès.</p>
              </div>
              <div className="bg-[#4a4830] p-3 rounded">
                <p className="text-sm font-medium">Référence de votre demande</p>
                <p className="text-lg font-bold text-[#d4a574]">ENT-{Date.now().toString().slice(-6)}</p>
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
          <h1 className="text-3xl font-bold text-[#5d5a3c] mt-2 italic">Réservation Entreprise</h1>
          <p className="text-[#8b8b7a] mt-2">
            Demande de réservation pour votre équipe dans le cadre du ftour solidaire.
          </p>
          <p className="text-sm text-[#8b8b7a] mt-3">
            Notre équipe étudiera votre demande et vous confirmera les disponibilités sous 48 heures.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map(s => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                s <= step ? 'bg-[#d4a574]' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && 'Informations Entreprise'}
              {step === 2 && 'Détails de la Demande'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Company Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Nom de l'entreprise *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="Nom de votre entreprise"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contactName">Nom du contact *</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    placeholder="Nom du contact"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contactEmail">Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    placeholder="Email du contact"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contactPhone">Téléphone *</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    placeholder="Téléphone du contact"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="companyICE">Numéro ICE (optionnel)</Label>
                  <Input
                    id="companyICE"
                    value={formData.companyICE}
                    onChange={(e) => handleInputChange('companyICE', e.target.value)}
                    placeholder="Numéro ICE"
                  />
                </div>

                <div>
                  <Label htmlFor="companyNotes">Notes (optionnel)</Label>
                  <Textarea
                    id="companyNotes"
                    value={formData.companyNotes}
                    onChange={(e) => handleInputChange('companyNotes', e.target.value)}
                    placeholder="Informations supplémentaires..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Reservation Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="date">Date du repas *</Label>
                  <Input
                    id="date"
                    type="date"
                    min="2026-02-20"
                    max="2026-03-13"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                  />
                  <p className="text-xs text-[#8b8b7a] mt-1">Entre le 20 février et le 13 mars</p>
                </div>

                <div>
                  <Label htmlFor="participantsCount">Nombre de participants (10 à 120) *</Label>
                  <Input
                    id="participantsCount"
                    type="number"
                    min="10"
                    max="120"
                    value={formData.participantsCount}
                    onChange={(e) => handleInputChange('participantsCount', Math.max(10, Math.min(120, parseInt(e.target.value) || 10)))}
                    required
                  />
                </div>

                {/* Info Block */}
                <div className="bg-[#f0ebe0] border border-[#d4a574] rounded p-4 mt-6">
                  <p className="text-sm text-[#5d5a3c]">
                    <strong>Après validation :</strong> Vous recevrez un email de confirmation avec les instructions de paiement et votre QR d'accès.
                  </p>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <Button 
                  onClick={handleBack} 
                  variant="outline"
                  className="flex-1"
                >
                  ← Retour
                </Button>
              )}
              <Button 
                onClick={handleNext} 
                className="flex-1 bg-[#d4a574] text-[#5d5a3c] hover:bg-[#c9955f]"
              >
                {step === 1 ? 'Suivant →' : 'Envoyer la demande →'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
