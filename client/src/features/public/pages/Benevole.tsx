import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { Users, Calendar, CheckCircle, Mail, Phone, MapPin, ArrowRight, Loader2, QrCode, Clock, AlertCircle } from "lucide-react";
import { useI18n } from "@/i18n";

export default function Benevole() {
  const { t, lang } = useI18n();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedDay = params.get('day');
  
  const [, navigate] = useLocation();
  const { data: days, isLoading: daysLoading } = trpc.days.list.useQuery();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    dayId: preselectedDay || "",
    slots: {
      preparation_ftour: false,  // Préparation ftour : 15h30 – 17h45
      service_ftour: false,      // Service ftour : 18h00 – 19h30
    },
    acceptedTerms: false,
  });
  const [slotsError, setSlotsError] = useState(false);
  
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    qrToken: string;
    dayInfo: { dayNumber: number; date: string };
  } | null>(null);

  const registerMutation = trpc.volunteers.register.useMutation({
    onSuccess: (data) => {
      const selectedDay = days?.find(d => d.id === parseInt(formData.dayId));
      const dateLocale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
      setRegistrationSuccess({
        qrToken: data.qrToken,
        dayInfo: {
          dayNumber: selectedDay?.dayNumber || 0,
          date: selectedDay?.date ? new Date(selectedDay.date).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }) : '',
        }
      });
      toast.success(t.volunteer.submitSuccess);
    },
    onError: (error) => {
      toast.error(error.message || t.volunteer.submitError);
    },
  });

  useEffect(() => {
    if (preselectedDay) {
      setFormData(prev => ({ ...prev, dayId: preselectedDay }));
    }
  }, [preselectedDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.acceptedTerms) {
      toast.error(lang === 'ar' ? 'يرجى قبول الشروط' : lang === 'en' ? 'Please accept the terms' : 'Veuillez accepter les conditions');
      return;
    }

    if (!formData.dayId) {
      toast.error(lang === 'ar' ? 'يرجى اختيار يوم' : lang === 'en' ? 'Please select a day' : 'Veuillez sélectionner un jour');
      return;
    }

    // Build volunteer slots array from checkbox state
    const volunteerSlots: string[] = [];
    if (formData.slots.preparation_ftour) volunteerSlots.push("preparation_ftour");
    if (formData.slots.service_ftour) volunteerSlots.push("service_ftour");

    if (volunteerSlots.length === 0) {
      setSlotsError(true);
      toast.error(lang === 'ar' ? 'يرجى اختيار فترة واحدة على الأقل' : lang === 'en' ? 'Please select at least one time slot' : 'Veuillez sélectionner au moins un créneau de participation');
      return;
    }
    setSlotsError(false);

    registerMutation.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      city: formData.city || undefined,
      dayId: parseInt(formData.dayId),
      volunteerSlots: volunteerSlots as ("preparation_ftour" | "service_ftour")[],
      acceptedTerms: formData.acceptedTerms,
    });
  };

  const availableDays = days?.filter(d => d.isOpen && d.registeredCount < 100) || [];
  const dateLocale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';

  // Success screen translations
  const successTexts = {
    title: lang === 'ar' ? 'تم التسجيل بنجاح!' : lang === 'en' ? 'Registration confirmed!' : 'Inscription confirmée !',
    thankYou: lang === 'ar' ? 'شكرا لانضمامك إلى فريق المتطوعين لليوم' : lang === 'en' ? 'Thank you for joining our volunteer team for Day' : 'Merci de rejoindre notre équipe de bénévoles pour le Jour',
    qrCode: lang === 'ar' ? 'رمز QR الخاص بك:' : lang === 'en' ? 'Your unique QR code:' : 'Votre code QR unique :',
    scanQr: lang === 'ar' ? 'امسح هذا الرمز عند الدخول' : lang === 'en' ? 'Scan this QR code at the entrance' : 'Scannez ce QR code à l\'entrée',
    emailSent: lang === 'ar' ? 'تم إرسال بريد إلكتروني يحتوي على رمز QR والتعليمات.' : lang === 'en' ? 'An email with your QR code and instructions has been sent.' : 'Un email contenant votre QR code et les consignes vous a été envoyé.',
    newRegistration: lang === 'ar' ? 'تسجيل جديد' : lang === 'en' ? 'New registration' : 'Nouvelle inscription',
    viewProgram: lang === 'ar' ? 'عرض البرنامج' : lang === 'en' ? 'View program' : 'Voir le programme',
    confirmationEmail: lang === 'ar' ? 'بريد التأكيد' : lang === 'en' ? 'Confirmation email' : 'Email de confirmation',
  };

  // Form translations
  const formTexts = {
    joinUs: lang === 'ar' ? 'انضم إلينا' : lang === 'en' ? 'Join us' : 'Rejoignez-nous',
    becomeVolunteer: lang === 'ar' ? 'كن متطوعا' : lang === 'en' ? 'Become a volunteer' : 'Devenir bénévole',
    subtitle: lang === 'ar' ? 'شارك في هذه المغامرة التضامنية وشارك لحظات فريدة خلال شهر رمضان' : lang === 'en' ? 'Participate in this solidarity adventure and share unique moments during Ramadan' : 'Participez à cette belle aventure solidaire et partagez des moments uniques pendant le Ramadan',
    schedules: lang === 'ar' ? 'المواعيد' : lang === 'en' ? 'Schedules' : 'Horaires',
    schedulesDesc: lang === 'ar' ? 'الوصول قبل ساعة ونصف من الإفطار. يستمر النشاط حوالي 3 ساعات.' : lang === 'en' ? 'Arrive 1h30 before Ftour. Activity lasts about 3 hours.' : 'Arrivée 1h30 avant le Ftour. L\'activité dure environ 3h au total.',
    location: lang === 'ar' ? 'المكان' : lang === 'en' ? 'Location' : 'Lieu',
    locationDesc: lang === 'ar' ? '4 شارع بيت لحم، حي النخيل، الدار البيضاء' : lang === 'en' ? '4 rue Bayt Lham, Palmier district, Casablanca' : '4 rue Bayt Lham, quartier Palmier, Casablanca',
    qrCodeTitle: lang === 'ar' ? 'رمز QR' : lang === 'en' ? 'QR Code' : 'QR Code',
    qrCodeDesc: lang === 'ar' ? 'ستتلقى رمز QR فريدًا لتقديمه عند الدخول يوم المشاركة.' : lang === 'en' ? 'You will receive a unique QR code to present at the entrance on the day.' : 'Vous recevrez un QR code unique à présenter à l\'entrée le jour J.',
    important: lang === 'ar' ? 'مهم' : lang === 'en' ? 'Important' : 'Important',
    dress: lang === 'ar' ? 'لباس محتشم مطلوب' : lang === 'en' ? 'Proper dress required' : 'Tenue correcte exigée',
    punctuality: lang === 'ar' ? 'الالتزام بالمواعيد مطلوب' : lang === 'en' ? 'Punctuality required' : 'Ponctualité requise',
    instructions: lang === 'ar' ? 'احترام التعليمات' : lang === 'en' ? 'Respect instructions' : 'Respect des consignes',
    fitness: lang === 'ar' ? 'لياقة بدنية جيدة' : lang === 'en' ? 'Good physical condition' : 'Bonne condition physique',
    noBags: lang === 'ar' ? 'الحقائب غير مسموحة' : lang === 'en' ? 'No bags allowed' : 'Sac non autorisé',
    formTitle: lang === 'ar' ? 'استمارة التسجيل' : lang === 'en' ? 'Registration form' : 'Formulaire d\'inscription',
    formDesc: lang === 'ar' ? 'املأ هذا النموذج للتسجيل كمتطوع' : lang === 'en' ? 'Fill out this form to register as a volunteer' : 'Remplissez ce formulaire pour vous inscrire comme bénévole',
    dayLabel: lang === 'ar' ? 'يوم المشاركة *' : lang === 'en' ? 'Participation day *' : 'Jour de participation *',
    selectDay: lang === 'ar' ? 'اختر يومًا' : lang === 'en' ? 'Select a day' : 'Sélectionnez un jour',
    loading: lang === 'ar' ? 'جاري التحميل...' : lang === 'en' ? 'Loading...' : 'Chargement...',
    noDay: lang === 'ar' ? 'لا يوجد يوم متاح' : lang === 'en' ? 'No day available' : 'Aucun jour disponible',
    places: lang === 'ar' ? 'أماكن' : lang === 'en' ? 'places' : 'places',
    day: lang === 'ar' ? 'اليوم' : lang === 'en' ? 'Day' : 'Jour',
    firstName: lang === 'ar' ? 'الاسم الأول *' : lang === 'en' ? 'First name *' : 'Prénom *',
    firstNamePlaceholder: lang === 'ar' ? 'اسمك الأول' : lang === 'en' ? 'Your first name' : 'Votre prénom',
    lastName: lang === 'ar' ? 'اسم العائلة *' : lang === 'en' ? 'Last name *' : 'Nom *',
    lastNamePlaceholder: lang === 'ar' ? 'اسم عائلتك' : lang === 'en' ? 'Your last name' : 'Votre nom',
    email: lang === 'ar' ? 'البريد الإلكتروني *' : lang === 'en' ? 'Email *' : 'Email *',
    phone: lang === 'ar' ? 'الهاتف *' : lang === 'en' ? 'Phone *' : 'Téléphone *',
    city: lang === 'ar' ? 'المدينة (اختياري)' : lang === 'en' ? 'City (optional)' : 'Ville (optionnel)',
    cityPlaceholder: lang === 'ar' ? 'مدينتك' : lang === 'en' ? 'Your city' : 'Votre ville',
    terms: lang === 'ar' ? 'أوافق على شروط المشاركة وسياسة الخصوصية. أتعهد باحترام التعليمات والحضور في اليوم المختار.' : lang === 'en' ? 'I accept the terms of participation and privacy policy. I commit to respecting the instructions and being present on the chosen day.' : 'J\'accepte les conditions de participation et la politique de confidentialité. Je m\'engage à respecter les consignes et à être présent(e) le jour choisi.',
    registering: lang === 'ar' ? 'جاري التسجيل...' : lang === 'en' ? 'Registering...' : 'Inscription en cours...',
    register: lang === 'ar' ? 'التسجيل كمتطوع' : lang === 'en' ? 'Register as volunteer' : 'S\'inscrire comme bénévole',
    slotsLabel: lang === 'ar' ? 'فترات المشاركة (يمكنك اختيار فترة واحدة أو أكثر) *' : lang === 'en' ? 'Participation slots (you can select one or more) *' : 'Créneaux de participation (vous pouvez cocher un ou plusieurs créneaux) *',
    preparationSlot: lang === 'ar' ? 'تحضير الفطور (15:30 – 17:45)' : lang === 'en' ? 'Ftour preparation (15:30 – 17:45)' : 'Préparation ftour (15:30 – 17:45)',
    serviceSlot: lang === 'ar' ? 'خدمة الفطور (18:00 – 19:30)' : lang === 'en' ? 'Ftour service (18:00 – 19:30)' : 'Service ftour (18:00 – 19:30)',
    slotsError: lang === 'ar' ? 'يرجى اختيار فترة واحدة على الأقل' : lang === 'en' ? 'Please select at least one time slot' : 'Veuillez sélectionner au moins un créneau',
    consignesTitle: lang === 'ar' ? 'تعليمات مهمة' : lang === 'en' ? 'Important instructions' : 'Consignes importantes',
    consigneNoBags: lang === 'ar' ? 'الحقائب غير مسموح بها.' : lang === 'en' ? 'Bags are not allowed.' : 'Les sacs ne sont pas autorisés.',
    consigneVest: lang === 'ar' ? 'ارتداء سترة المتطوع إلزامي داخل الجمعية.' : lang === 'en' ? 'Wearing the volunteer vest is mandatory within the association.' : 'Le port du gilet bénévole est obligatoire au sein de l\'association.',
    consigneNoPhotos: lang === 'ar' ? 'يمنع التقاط صور للمستفيدين.' : lang === 'en' ? 'Taking photos of beneficiaries is prohibited.' : 'Il est interdit de prendre des photos des bénéficiaires.',
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 py-16">
          <div className="container max-w-2xl">
            <Card className="border-none shadow-lg">
              <CardContent className="p-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">{successTexts.title}</h1>
                  <p className="text-muted-foreground">
                    {successTexts.thankYou} {registrationSuccess.dayInfo.dayNumber}
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Calendar className="h-5 w-5" />
                    <span className="font-medium capitalize">{registrationSuccess.dayInfo.date}</span>
                  </div>
                  
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground mb-3">{successTexts.qrCode}</p>
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/checkin/${registrationSuccess.qrToken}`)}`}
                        alt="QR Code"
                        className="w-48 h-48"
                      />
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {successTexts.scanQr}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 text-left space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    {successTexts.confirmationEmail}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {successTexts.emailSent}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button onClick={() => setRegistrationSuccess(null)} variant="outline" className="flex-1">
                    {successTexts.newRegistration}
                  </Button>
                  <Button onClick={() => navigate(`/${lang}/programme`)} className="flex-1">
                    {successTexts.viewProgram}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Users className="h-4 w-4" />
                {formTexts.joinUs}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                {formTexts.becomeVolunteer}
              </h1>
              <p className="text-lg text-muted-foreground">
                {formTexts.subtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Form Section */}
        <section className="py-12">
          <div className="container">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Info Cards */}
              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">{formTexts.schedules}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formTexts.schedulesDesc}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">{formTexts.location}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formTexts.locationDesc}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <QrCode className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">{formTexts.qrCodeTitle}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formTexts.qrCodeDesc}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <AlertCircle className="h-5 w-5" />
                      <h3 className="font-semibold">{formTexts.important}</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• {formTexts.dress}</li>
                      <li>• {formTexts.punctuality}</li>
                      <li>• {formTexts.instructions}</li>
                      <li>• {formTexts.fitness}</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertCircle className="h-5 w-5" />
                      <h3 className="font-semibold">{formTexts.consignesTitle}</h3>
                    </div>
                    <ul className="text-sm text-amber-900 space-y-2">
                      <li>• {formTexts.consigneNoBags}</li>
                      <li>• {formTexts.consigneVest}</li>
                      <li>• {formTexts.consigneNoPhotos}</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Registration Form */}
              <div className="lg:col-span-2">
                <Card className="border-none shadow-lg">
                  <CardHeader>
                    <CardTitle>{formTexts.formTitle}</CardTitle>
                    <CardDescription>
                      {formTexts.formDesc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Day Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="day">{formTexts.dayLabel}</Label>
                        <Select
                          value={formData.dayId}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, dayId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={formTexts.selectDay} />
                          </SelectTrigger>
                          <SelectContent>
                            {daysLoading ? (
                              <SelectItem value="loading" disabled>{formTexts.loading}</SelectItem>
                            ) : availableDays.length > 0 ? (
                              availableDays.map((day) => (
                                <SelectItem key={day.id} value={day.id.toString()}>
                                  {formTexts.day} {day.dayNumber} - {new Date(day.date).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })}
                                  {' '}({day.capacity - day.registeredCount} {formTexts.places})
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>{formTexts.noDay}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Name Fields */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">{formTexts.firstName}</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder={formTexts.firstNamePlaceholder}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">{formTexts.lastName}</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder={formTexts.lastNamePlaceholder}
                            required
                          />
                        </div>
                      </div>

                      {/* Contact Fields */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">{formTexts.email}</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="votre@email.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">{formTexts.phone}</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="+212 6XX XXX XXX"
                            required
                          />
                        </div>
                      </div>

                      {/* City */}
                      <div className="space-y-2">
                        <Label htmlFor="city">{formTexts.city}</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder={formTexts.cityPlaceholder}
                        />
                      </div>

                      {/* Volunteer Slots */}
                      <div className="space-y-3">
                        <Label>{formTexts.slotsLabel}</Label>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="slot-preparation"
                              checked={formData.slots.preparation_ftour}
                              onCheckedChange={(checked) => {
                                setFormData(prev => ({ ...prev, slots: { ...prev.slots, preparation_ftour: checked as boolean } }));
                                setSlotsError(false);
                              }}
                            />
                            <label htmlFor="slot-preparation" className="text-sm cursor-pointer">
                              {formTexts.preparationSlot}
                            </label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="slot-service"
                              checked={formData.slots.service_ftour}
                              onCheckedChange={(checked) => {
                                setFormData(prev => ({ ...prev, slots: { ...prev.slots, service_ftour: checked as boolean } }));
                                setSlotsError(false);
                              }}
                            />
                            <label htmlFor="slot-service" className="text-sm cursor-pointer">
                              {formTexts.serviceSlot}
                            </label>
                          </div>
                        </div>
                        {slotsError && (
                          <p className="text-sm text-red-500">{formTexts.slotsError}</p>
                        )}
                      </div>

                      {/* Consignes importantes */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold text-amber-700 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {formTexts.consignesTitle}
                        </h4>
                        <ul className="text-sm text-amber-900 space-y-1">
                          <li>• {formTexts.consigneNoBags}</li>
                          <li>• {formTexts.consigneVest}</li>
                          <li>• {formTexts.consigneNoPhotos}</li>
                        </ul>
                      </div>

                      {/* Terms */}
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="terms"
                          checked={formData.acceptedTerms}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptedTerms: checked as boolean }))}
                          required
                        />
                        <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                          {formTexts.terms}
                        </label>
                      </div>

                      {/* Submit */}
                      <Button 
                        type="submit" 
                        className="w-full" 
                        size="lg"
                        disabled={registerMutation.isPending || availableDays.length === 0}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            {formTexts.registering}
                          </>
                        ) : (
                          <>
                            <Users className="h-5 w-5 mr-2" />
                            {formTexts.register}
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
