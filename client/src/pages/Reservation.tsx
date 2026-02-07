import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, Users, Phone, Mail, CheckCircle2, ArrowRight, ArrowLeft, Utensils, Clock, AlertCircle, ExternalLink, Leaf } from 'lucide-react';
import { toast } from 'sonner';

type Step = 'date' | 'restaurant' | 'details' | 'form' | 'confirmation';

interface ReservationData {
  date: string;
  restaurantId: number | null;
  slotId: number | null;
  seats: number;
  fullName: string;
  phone: string;
  email: string | undefined;
  notes: string;
  acceptedTerms: boolean;
}

export default function Reservation() {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<Step>('date');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reservationResult, setReservationResult] = useState<any>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<ReservationData>({
    date: '',
    restaurantId: null,
    slotId: null,
    seats: 1,
    fullName: '',
    phone: '',
    email: undefined,
    notes: '',
    acceptedTerms: false,
  });

  // Fetch restaurants
  const { data: restaurants, isLoading: loadingRestaurants } = trpc.restaurants.list.useQuery({ activeOnly: true });
  
  // Fetch available seats when restaurant and date are selected
  const { data: availableSeats, isLoading: loadingSeats } = trpc.reservations.getAvailableSeats.useQuery(
    { 
      restaurantId: formData.restaurantId!, 
      date: formData.date,
      slotId: formData.slotId || undefined,
    },
    { enabled: !!formData.restaurantId && !!formData.date }
  );

  // Fetch slots for selected restaurant and date
  const { data: slots } = trpc.restaurants.getSlots.useQuery(
    { restaurantId: formData.restaurantId!, date: formData.date },
    { enabled: !!formData.restaurantId && !!formData.date }
  );

  // Create reservation mutation
  const createReservation = trpc.reservations.create.useMutation({
    onSuccess: (data) => {
      setReservationResult(data);
      setStep('confirmation');
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la réservation');
      setIsSubmitting(false);
    },
  });

  // Fetch full reservation details when confirmation is shown
  const { data: fullReservation } = trpc.reservations.getByReference.useQuery(
    { referenceCode: reservationResult?.referenceCode || '' },
    { enabled: !!reservationResult?.referenceCode }
  );

  // Generate available dates (next 30 days during Ramadan)
  const generateAvailableDates = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const availableDates = generateAvailableDates();

  const selectedRestaurant = restaurants?.find(r => r.id === formData.restaurantId);

  const handleNext = () => {
    switch (step) {
      case 'date':
        if (!formData.date) {
          toast.error('Veuillez sélectionner une date');
          return;
        }
        setStep('restaurant');
        break;
      case 'restaurant':
        if (!formData.restaurantId) {
          toast.error('Veuillez sélectionner un restaurant');
          return;
        }
        setStep('details');
        break;
      case 'details':
        if (formData.seats < 1 || formData.seats > (availableSeats?.available || 0)) {
          toast.error(`Nombre de places invalide. Disponibles: ${availableSeats?.available || 0}`);
          return;
        }
        setStep('form');
        break;
      case 'form':
        handleSubmit();
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'restaurant':
        setStep('date');
        break;
      case 'details':
        setStep('restaurant');
        break;
      case 'form':
        setStep('details');
        break;
    }
  };

  const validateEmail = (email: string | undefined) => {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      toast.error('Veuillez entrer votre nom complet');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Veuillez entrer votre numéro de téléphone');
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      const errorMessages: Record<string, string> = {
        fr: 'Adresse email invalide',
        en: 'Invalid email address',
        ar: 'البريد الإلكتروني غير صالح',
        amz: 'Imayl ur sɛiḥ'
      };
      setFormErrors({ email: errorMessages[lang] || errorMessages.fr });
      return;
    }
    if (!formData.acceptedTerms) {
      toast.error('Veuillez accepter les conditions');
      return;
    }
    setFormErrors({});

    setIsSubmitting(true);
    createReservation.mutate({
      restaurantId: formData.restaurantId!,
      date: formData.date,
      slotId: formData.slotId || undefined,
      fullName: formData.fullName,
      phone: formData.phone,
      email: formData.email?.trim(),
      seats: formData.seats,
      notes: formData.notes || undefined,
    });
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return '—';
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) return '—';
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
      return date.toLocaleDateString(locale, options);
    } catch (e) {
      return '—';
    }
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-8">
      {['date', 'restaurant', 'details', 'form'].map((s, i) => (
        <div key={s} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === s || ['date', 'restaurant', 'details', 'form'].indexOf(step) > i
                ? 'bg-[#5d5a3c] text-[#f5f5dc]'
                : 'bg-[#d4d4aa] text-[#5d5a3c]'
            }`}
          >
            {i + 1}
          </div>
          {i < 3 && (
            <div className={`w-8 h-1 ${
              ['date', 'restaurant', 'details', 'form'].indexOf(step) > i
                ? 'bg-[#5d5a3c]'
                : 'bg-[#d4d4aa]'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f5f5f0] to-[#e8e8d8]">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 pt-32">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#5d5a3c] mb-4">
            {lang === 'ar' ? 'حجز فطور' : 'Réservation Ftour'}
          </h1>
          <p className="text-lg text-[#6b6b4e] max-w-2xl mx-auto">
            {lang === 'ar' 
              ? 'احجز مكانك في فطور باب ريان التضامني'
              : 'Réservez votre place pour le Ftour solidaire Bab Rayan'
            }
          </p>
        </div>

        {step !== 'confirmation' && stepIndicator}

        <div className="max-w-2xl mx-auto">
          {/* Step 1: Date Selection */}
          {step === 'date' && (
            <Card className="border-[#d4d4aa] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#5d5a3c]">
                  <Calendar className="w-5 h-5" />
                  {lang === 'ar' ? 'اختر التاريخ' : 'Choisissez la date'}
                </CardTitle>
                <CardDescription>
                  {lang === 'ar' 
                    ? 'حدد اليوم الذي ترغب في الحضور فيه'
                    : 'Sélectionnez le jour où vous souhaitez participer'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                  {availableDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => setFormData({ ...formData, date })}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        formData.date === date
                          ? 'border-[#5d5a3c] bg-[#5d5a3c] text-[#f5f5dc]'
                          : 'border-[#d4d4aa] hover:border-[#5d5a3c] bg-white'
                      }`}
                    >
                      <div className="text-sm font-medium">
                        {new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { weekday: 'short' })}
                      </div>
                      <div className="text-lg font-bold">
                        {new Date(date).getDate()}
                      </div>
                      <div className="text-xs opacity-75">
                        {new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { month: 'short' })}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Restaurant Selection */}
          {step === 'restaurant' && (
            <Card className="border-[#d4d4aa] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#5d5a3c]">
                  <Utensils className="w-5 h-5" />
                  {lang === 'ar' ? 'اختر المطعم' : 'Choisissez le restaurant'}
                </CardTitle>
                <CardDescription>
                  {lang === 'ar' 
                    ? `التاريخ المحدد: ${formatDate(formData.date)}`
                    : `Date sélectionnée: ${formatDate(formData.date)}`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRestaurants ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-[#5d5a3c] border-t-transparent rounded-full mx-auto"></div>
                  </div>
                ) : restaurants && restaurants.length > 0 ? (
                  <div className="space-y-3">
                    {restaurants.map((restaurant) => (
                      <button
                        key={restaurant.id}
                        onClick={() => setFormData({ ...formData, restaurantId: restaurant.id, slotId: null })}
                        className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                          formData.restaurantId === restaurant.id
                            ? 'border-[#5d5a3c] bg-[#5d5a3c] text-[#f5f5dc]'
                            : 'border-[#d4d4aa] hover:border-[#5d5a3c] bg-white'
                        }`}
                      >
                        <div className="font-bold text-lg">{restaurant.name}</div>
                        <div className="flex items-center gap-2 mt-1 text-sm opacity-75">
                          <MapPin className="w-4 h-4" />
                          {restaurant.address}
                        </div>
                        {restaurant.phone && (
                          <div className="flex items-center gap-2 mt-1 text-sm opacity-75">
                            <Phone className="w-4 h-4" />
                            {restaurant.phone}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <Users className="w-4 h-4" />
                          {lang === 'ar' 
                            ? `السعة: ${restaurant.capacity} مكان`
                            : `Capacité: ${restaurant.capacity} places`
                          }
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#6b6b4e]">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{lang === 'ar' ? 'لا توجد مطاعم متاحة حاليًا' : 'Aucun restaurant disponible actuellement'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Details (Seats & Slot) */}
          {step === 'details' && (
            <Card className="border-[#d4d4aa] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#5d5a3c]">
                  <Users className="w-5 h-5" />
                  {lang === 'ar' ? 'تفاصيل الحجز' : 'Détails de la réservation'}
                </CardTitle>
                <CardDescription>
                  {selectedRestaurant?.name} - {formatDate(formData.date)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Slots if available */}
                {slots && slots.length > 0 && (
                  <div>
                    <Label className="text-[#5d5a3c] font-medium mb-3 block">
                      {lang === 'ar' ? 'اختر الفترة الزمنية' : 'Choisissez le créneau'}
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {slots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setFormData({ ...formData, slotId: slot.id })}
                          className={`p-3 rounded-lg border-2 text-center transition-all ${
                            formData.slotId === slot.id
                              ? 'border-[#5d5a3c] bg-[#5d5a3c] text-[#f5f5dc]'
                              : 'border-[#d4d4aa] hover:border-[#5d5a3c] bg-white'
                          }`}
                        >
                          <Clock className="w-4 h-4 mx-auto mb-1" />
                          <div className="font-medium">
                            {slot.startTime} - {slot.endTime}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Number of seats */}
                <div>
                  <Label htmlFor="seats" className="text-[#5d5a3c] font-medium mb-3 block">
                    {lang === 'ar' ? 'عدد الأماكن' : 'Nombre de places'}
                  </Label>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setFormData({ ...formData, seats: Math.max(1, formData.seats - 1) })}
                      className="border-[#5d5a3c] text-[#5d5a3c]"
                    >
                      -
                    </Button>
                    <span className="text-2xl font-bold text-[#5d5a3c] w-12 text-center">
                      {formData.seats}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setFormData({ ...formData, seats: Math.min(availableSeats?.available || 20, formData.seats + 1) })}
                      className="border-[#5d5a3c] text-[#5d5a3c]"
                    >
                      +
                    </Button>
                  </div>
                  {loadingSeats ? (
                    <p className="text-sm text-[#6b6b4e] mt-2">Chargement...</p>
                  ) : (
                    <p className="text-sm text-[#6b6b4e] mt-2">
                      {lang === 'ar' 
                        ? `${availableSeats?.available || 0} مكان متاح`
                        : `${availableSeats?.available || 0} places disponibles`
                      }
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Contact Form */}
          {step === 'form' && (
            <Card className="border-[#d4d4aa] bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#5d5a3c]">
                  <Mail className="w-5 h-5" />
                  {lang === 'ar' ? 'معلوماتك' : 'Vos informations'}
                </CardTitle>
                <CardDescription>
                  {selectedRestaurant?.name} - {formatDate(formData.date)} - {formData.seats} {formData.seats > 1 ? 'places' : 'place'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="text-[#5d5a3c]">
                    {lang === 'ar' ? 'الاسم الكامل' : 'Nom complet'} *
                  </Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder={lang === 'ar' ? 'أدخل اسمك الكامل' : 'Entrez votre nom complet'}
                    className="mt-1 border-[#d4d4aa] focus:border-[#5d5a3c]"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-[#5d5a3c]">
                    {lang === 'ar' ? 'رقم الهاتف' : 'Téléphone'} *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+212 6XX XXX XXX"
                    className="mt-1 border-[#d4d4aa] focus:border-[#5d5a3c]"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-[#5d5a3c]">
                    {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'} ({lang === 'ar' ? 'اختياري' : 'optionnel'})
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value || undefined });
                      if (formErrors.email) setFormErrors({});
                    }}
                    placeholder="nom@example.com"
                    className={`mt-1 border-[#d4d4aa] focus:border-[#5d5a3c] ${formErrors.email ? 'border-red-500' : ''}`}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>
                  )}
                  <p className="text-xs text-[#6b6b4e] mt-1">
                    {lang === 'ar' 
                      ? 'لتلقي تأكيد الحجز ورمز QR'
                      : 'Pour recevoir la confirmation et le QR code'
                    }
                  </p>
                </div>

                <div>
                  <Label htmlFor="notes" className="text-[#5d5a3c]">
                    {lang === 'ar' ? 'ملاحظات' : 'Notes'} ({lang === 'ar' ? 'اختياري' : 'optionnel'})
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={lang === 'ar' ? 'أي ملاحظات خاصة...' : 'Remarques particulières...'}
                    className="mt-1 border-[#d4d4aa] focus:border-[#5d5a3c]"
                    rows={3}
                  />
                </div>

                <div className="flex items-start gap-3 p-4 bg-[#f5f5f0] rounded-lg">
                  <Checkbox
                    id="terms"
                    checked={formData.acceptedTerms}
                    onCheckedChange={(checked) => setFormData({ ...formData, acceptedTerms: checked as boolean })}
                    className="mt-1"
                  />
                  <Label htmlFor="terms" className="text-sm text-[#5d5a3c] cursor-pointer">
                    {lang === 'ar' 
                      ? 'أوافق على شروط المشاركة وسياسة الخصوصية. أتعهد باحترام التعليمات والحضور في اليوم المحدد.'
                      : "J'accepte les conditions de participation et la politique de confidentialité. Je m'engage à respecter les consignes et à être présent(e) le jour choisi."
                    } *
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Confirmation */}
          {step === 'confirmation' && reservationResult && (
            <Card className="border-[#5d5a3c] bg-white/90 backdrop-blur">
              <CardContent className="pt-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-[#5d5a3c] mb-2">
                  {lang === 'ar' ? 'تم تأكيد الحجز!' : 'Réservation confirmée !'}
                </h2>
                
                <p className="text-[#6b6b4e] mb-6">
                  {lang === 'ar' 
                    ? 'شكرًا لك. تم تسجيل حجزك بنجاح.'
                    : 'Merci ! Votre réservation a été enregistrée avec succès.'
                  }
                </p>

                <div className="bg-[#5d5a3c] text-[#f5f5dc] rounded-lg p-6 mb-6">
                  <div className="text-sm opacity-75 mb-1">
                    {lang === 'ar' ? 'رقم المرجع' : 'Référence'}
                  </div>
                  <div className="text-3xl font-bold tracking-wider">
                    {reservationResult.referenceCode}
                  </div>
                </div>

                <div className="bg-[#f5f5f0] rounded-lg p-4 mb-6 text-left">
                  <h3 className="font-bold text-[#5d5a3c] mb-3">
                    {lang === 'ar' ? 'ملخص الحجز' : 'Récapitulatif'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#6b6b4e]">{lang === 'ar' ? 'التاريخ' : 'Date'}:</span>
                      <span className="font-medium text-[#5d5a3c]">{formatDate(fullReservation?.date || reservationResult?.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6b6b4e]">{lang === 'ar' ? 'المطعم' : 'Restaurant'}:</span>
                      <span className="font-medium text-[#5d5a3c]">{fullReservation?.restaurant?.name || reservationResult?.restaurant?.name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6b6b4e]">{lang === 'ar' ? 'عدد الأماكن' : 'Places'}:</span>
                      <span className="font-medium text-[#5d5a3c]">{fullReservation?.seats || reservationResult?.seats || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="mb-6">
                  <p className="text-sm text-[#6b6b4e] mb-3">
                    {lang === 'ar' 
                      ? 'قدم رمز QR هذا عند وصولك'
                      : 'Présentez ce QR code à votre arrivée'
                    }
                  </p>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://ftourbabrayan.ma/checkin-reservation/${reservationResult.qrToken}`)}`}
                    alt="QR Code"
                    className="mx-auto rounded-lg"
                  />
                </div>

                {reservationResult.email && (
                  <p className="text-sm text-[#6b6b4e] mb-6">
                    {lang === 'ar' 
                      ? `تم إرسال تأكيد إلى ${reservationResult.email}`
                      : `Un email de confirmation a été envoyé à ${reservationResult.email}`
                    }
                  </p>
                )}

                <div className="bg-[#f5f5f0] rounded-lg p-4 text-left">
                  <h4 className="font-bold text-[#5d5a3c] mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {lang === 'ar' ? 'العنوان' : 'Adresse'}
                  </h4>
                  <p className="text-[#6b6b4e]">
                    {reservationResult.restaurant?.address || '4 rue Bayt Lham, quartier Palmier, Casablanca'}
                  </p>
                </div>

                <Button
                  onClick={() => window.location.href = `/${lang}`}
                  className="mt-6 bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
                >
                  {lang === 'ar' ? 'العودة للصفحة الرئيسية' : "Retour à l'accueil"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          {step !== 'confirmation' && (
            <div className="flex justify-between mt-6">
              {step !== 'date' ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="border-[#5d5a3c] text-[#5d5a3c] hover:bg-[#5d5a3c] hover:text-[#f5f5dc]"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {lang === 'ar' ? 'السابق' : 'Précédent'}
                </Button>
              ) : (
                <div />
              )}
              
              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc]"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-[#f5f5dc] border-t-transparent rounded-full mr-2" />
                    {lang === 'ar' ? 'جاري الحجز...' : 'Réservation en cours...'}
                  </>
                ) : step === 'form' ? (
                  <>
                    {lang === 'ar' ? 'تأكيد الحجز' : 'Confirmer la réservation'}
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    {lang === 'ar' ? 'التالي' : 'Suivant'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* La Table du Jardin Section */}
      <section className="py-16 bg-[#f5f5f0]">
        <div className="container max-w-4xl mx-auto px-4">
          <Card className="border-[#5d5a3c]/20 bg-white overflow-hidden">
            <div className="md:flex">
              {/* Left side - Content */}
              <div className="p-8 md:w-2/3">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#5d5a3c]/10 flex items-center justify-center">
                    <Leaf className="w-6 h-6 text-[#5d5a3c]" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#5d5a3c]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    {t.reservation.tableJardin.title}
                  </h2>
                </div>
                
                <p className="text-[#6b6b4e] mb-6 leading-relaxed">
                  {t.reservation.tableJardin.description}
                </p>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-[#5d5a3c]">
                    <MapPin className="w-5 h-5 text-[#5d5a3c]/70" />
                    <span>{t.reservation.tableJardin.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#5d5a3c]">
                    <Phone className="w-5 h-5 text-[#5d5a3c]/70" />
                    <span>+212 664-887978</span>
                  </div>
                  <div className="flex items-center gap-3 text-[#5d5a3c]">
                    <Clock className="w-5 h-5 text-[#5d5a3c]/70" />
                    <span>{t.reservation.tableJardin.hours}</span>
                  </div>
                </div>

                <a 
                  href="https://latabledujardin.ftourbabrayan.ma" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#5d5a3c] hover:bg-[#4a4730] text-[#f5f5dc] px-6 py-3 rounded-lg transition-colors font-medium"
                >
                  {t.reservation.tableJardin.cta}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Right side - Decorative */}
              <div className="hidden md:block md:w-1/3 bg-[#5d5a3c] relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-[#f5f5dc]/90">
                    <Utensils className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium" style={{ fontFamily: 'Caveat, cursive' }}>
                      {t.reservation.tableJardin.tagline}
                    </p>
                  </div>
                </div>
                {/* Decorative pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="w-full h-full" style={{ 
                    backgroundImage: 'radial-gradient(circle, #f5f5dc 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                  }} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
