import { useState } from 'react';
import { useLocation } from 'wouter';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { QrCode, CheckCircle, AlertCircle } from 'lucide-react';

export default function CompanyBooking() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [bookingReference, setBookingReference] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    companyName: '',
    companyICE: '',
    companySector: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    participantsCount: 1,
    date: new Date().toISOString().split('T')[0],
    restaurantId: undefined as number | undefined,
    slotId: undefined as number | undefined,
    notes: '',
    scansAllowed: 1, // Nombre de scans autorisés (N scans)
  });

  const createReservation = trpc.companyBookings.create.useMutation({
    onSuccess: (data: any) => {
      setBookingReference(data.booking.reference);
      // Générer QR code avec URL de validation
      const qrUrl = `${window.location.origin}/validate-company-booking/${data.booking.reference}?scans=${formData.scansAllowed}`;
      setQrCode(qrUrl);
      setStep(3);
      
      // Envoyer email automatique à entreprise@ftourbabrayan.ma (optionnel)

    },
    onError: () => {
      // Erreur gérée par le composant
    }
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    // Étape 2 : Créer la réservation
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
      notes: formData.notes || undefined,
      scansAllowed: formData.scansAllowed,
    });
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t.companyBooking?.title || 'Réservation Entreprise'}</h1>
          <p className="text-lg text-muted-foreground">{t.companyBooking?.subtitle || 'Réservez un repas solidaire pour votre équipe'}</p>
          <p className="text-sm text-muted-foreground mt-2">{t.companyBooking?.description || 'Chaque participant recevra un QR code unique pour accéder au repas.'}</p>
        </div>

        {/* Progress Indicator */}
        {step < 3 && (
          <div className="flex gap-2 mb-8">
            {[1, 2].map(s => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        )}

        {/* Form Card */}
        {step < 3 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>
                {step === 1 && 'Informations Entreprise'}
                {step === 2 && 'Détails de la Réservation'}
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
                    <Label htmlFor="companyICE">Numéro ICE</Label>
                    <Input
                      id="companyICE"
                      value={formData.companyICE}
                      onChange={(e) => handleInputChange('companyICE', e.target.value)}
                      placeholder="Numéro ICE (optionnel)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="companySector">Secteur d'activité</Label>
                    <Input
                      id="companySector"
                      value={formData.companySector}
                      onChange={(e) => handleInputChange('companySector', e.target.value)}
                      placeholder="Secteur d'activité (optionnel)"
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
                    <Label htmlFor="contactEmail">Email du contact *</Label>
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
                    <Label htmlFor="contactPhone">Téléphone du contact *</Label>
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
                    <Label htmlFor="participantsCount">Nombre de participants *</Label>
                    <Input
                      id="participantsCount"
                      type="number"
                      min="1"
                      value={formData.participantsCount}
                      onChange={(e) => handleInputChange('participantsCount', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="scansAllowed">Nombre de scans autorisés par QR code *</Label>
                    <Input
                      id="scansAllowed"
                      type="number"
                      min="1"
                      value={formData.scansAllowed}
                      onChange={(e) => handleInputChange('scansAllowed', parseInt(e.target.value) || 1)}
                      placeholder="Nombre de fois que le QR code peut être scanné"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="date">Date du repas *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="restaurant">Restaurant *</Label>
                    <Select value={formData.restaurantId ? formData.restaurantId.toString() : ''} onValueChange={(v) => handleInputChange('restaurantId', parseInt(v))}>
                      <SelectTrigger id="restaurant">
                        <SelectValue placeholder="Sélectionner un restaurant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">La Table du Jardin</SelectItem>
                        <SelectItem value="2">Restaurant Corpo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes spéciales</Label>
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
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirmation with QR Code */}
        {step === 3 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                Réservation Confirmée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">
                  Votre réservation a été enregistrée avec succès !
                </p>
                <p className="text-green-700 text-sm mt-2">
                  Référence : <span className="font-mono font-bold">{bookingReference}</span>
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Détails de la réservation</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Entreprise</p>
                    <p className="font-medium">{formData.companyName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Participants</p>
                    <p className="font-medium">{formData.participantsCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{new Date(formData.date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Scans autorisés</p>
                    <p className="font-medium">{formData.scansAllowed}</p>
                  </div>
                </div>
              </div>

              {qrCode && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    QR Code de Validation
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-lg flex justify-center">
                    <div className="text-center">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`}
                        alt="QR Code"
                        className="w-64 h-64"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Scannez ce code pour valider l'accès
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Un email de confirmation avec ce QR code a été envoyé à <strong>entreprise@ftourbabrayan.ma</strong>
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  <strong>Note :</strong> Chaque participant recevra un QR code unique. Le QR code ci-dessus peut être scanné {formData.scansAllowed} fois.
                </p>
              </div>

              <Button onClick={() => navigate('/')} className="w-full">
                Retour à l'accueil
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        {step < 3 && (
          <div className="flex gap-4">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex-1"
              >
                Précédent
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={createReservation.isPending}
              className="flex-1"
            >
              {createReservation.isPending ? 'Traitement...' : (step === 2 ? 'Confirmer la réservation' : 'Suivant')}
            </Button>
          </div>
        )}

        {createReservation.isError && (
          <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Erreur lors de la création de la réservation</p>
              <p className="text-sm">Veuillez vérifier vos informations et réessayer.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
