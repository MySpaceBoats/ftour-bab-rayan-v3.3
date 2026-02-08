import { useState } from 'react';
import { useLocation } from 'wouter';
import { useI18n } from '../lib/i18n';
import { trpc } from '../lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import PaymentMethodSelector from '../components/PaymentMethodSelector';

export default function CompanyBooking() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: '',
    companyICE: '',
    companySector: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    participantsCount: 1,
    date: new Date().toISOString().split('T')[0],
    restaurantId: undefined,
    slotId: undefined,
    paymentMethod: 'cash' as const,
    notes: '',
  });

  const createReservation = trpc.companyBookings.create.useMutation({
    onSuccess: (data) => {
      navigate(`/company-booking-confirmation/${data.booking.reference}`);
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    createReservation.mutate({
      companyName: formData.companyName,
      companyICE: formData.companyICE || undefined,
      companySector: formData.companySector || undefined,
      contactName: formData.contactName,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      participantsCount: formData.participantsCount,
      date: new Date(formData.date),
      restaurantId: formData.restaurantId,
      slotId: formData.slotId,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t.companyBooking.title}</h1>
          <p className="text-lg text-muted-foreground">{t.companyBooking.subtitle}</p>
          <p className="text-sm text-muted-foreground mt-2">{t.companyBooking.description}</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Form Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              {step === 1 && 'Informations Entreprise'}
              {step === 2 && 'Détails de la Réservation'}
              {step === 3 && 'Méthode de Paiement'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Company Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companyName">{t.companyBooking.companyName}</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="Nom de votre entreprise"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="companyICE">{t.companyBooking.companyICE}</Label>
                  <Input
                    id="companyICE"
                    value={formData.companyICE}
                    onChange={(e) => handleInputChange('companyICE', e.target.value)}
                    placeholder="Numéro ICE (optionnel)"
                  />
                </div>

                <div>
                  <Label htmlFor="companySector">{t.companyBooking.companySector}</Label>
                  <Input
                    id="companySector"
                    value={formData.companySector}
                    onChange={(e) => handleInputChange('companySector', e.target.value)}
                    placeholder="Secteur d'activité (optionnel)"
                  />
                </div>

                <div>
                  <Label htmlFor="contactName">{t.companyBooking.contactName}</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    placeholder="Nom du contact"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contactEmail">{t.companyBooking.contactEmail}</Label>
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
                  <Label htmlFor="contactPhone">{t.companyBooking.contactPhone}</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    placeholder="Téléphone du contact"
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 2: Reservation Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="participantsCount">{t.companyBooking.participantsCount}</Label>
                  <Input
                    id="participantsCount"
                    type="number"
                    min="1"
                    value={formData.participantsCount}
                    onChange={(e) => handleInputChange('participantsCount', parseInt(e.target.value))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="date">{t.companyBooking.date}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="restaurant">{t.companyBooking.restaurant}</Label>
                  <Select value={formData.restaurantId?.toString() || ''} onValueChange={(v) => handleInputChange('restaurantId', parseInt(v))}>
                    <SelectTrigger id="restaurant">
                      <SelectValue placeholder="Sélectionner un restaurant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Restaurant 1</SelectItem>
                      <SelectItem value="2">Restaurant 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="slot">{t.companyBooking.slot}</Label>
                  <Select value={formData.slotId?.toString() || ''} onValueChange={(v) => handleInputChange('slotId', parseInt(v))}>
                    <SelectTrigger id="slot">
                      <SelectValue placeholder="Sélectionner un créneau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">08:00 - 10:00</SelectItem>
                      <SelectItem value="2">10:00 - 12:00</SelectItem>
                      <SelectItem value="3">12:00 - 14:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">{t.companyBooking.notes}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Notes spéciales (optionnel)"
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Payment Method */}
            {step === 3 && (
              <div className="space-y-4">
                <PaymentMethodSelector
                  selectedMethod={formData.paymentMethod}
                  onMethodChange={(method) => handleInputChange('paymentMethod', method)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              {t.cta.back}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={createReservation.isPending}
            className="flex-1"
          >
            {step === 3 ? t.companyBooking.createReservation : 'Suivant'}
          </Button>
        </div>

        {createReservation.isError && (
          <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {t.companyBooking.reservationError}
          </div>
        )}
      </div>
    </div>
  );
}
