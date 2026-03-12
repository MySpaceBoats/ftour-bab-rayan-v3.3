import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Calendar,
  CheckCircle,
  Mail,
  Phone,
  MapPin,
  Loader2,
  QrCode,
  Clock,
  AlertCircle,
  Upload,
  UsersRound,
  Download,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useI18n } from "@/i18n";

const RAMADAN_TIMEZONE = "Africa/Casablanca";

const getDateStringInRamadanTimezone = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: RAMADAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const toUtcDayNumber = (dateString: string): number => {
  const [year, month, day] = dateString.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
};

const getRamadanTodayDayNumber = (): number =>
  toUtcDayNumber(getDateStringInRamadanTimezone(new Date()));

const isWithinIndividualRegistrationWindow = (date: string): boolean => {
  const targetDayNumber = toUtcDayNumber(date);
  const todayDayNumber = getRamadanTodayDayNumber();
  const diffDays = targetDayNumber - todayDayNumber;

  return diffDays >= 0 && diffDays <= 2;
};

export default function Benevole() {
  const { t, lang } = useI18n();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedDay = params.get("day");

  const [, navigate] = useLocation();
  const { data: days, isLoading: daysLoading } = trpc.days.list.useQuery();

  const [isGroup, setIsGroup] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    comment: "",
    dayId: preselectedDay || "",
    slots: {
      preparation_ftour: false, // Préparation ftour : 15h00 – 16h45
      service_ftour: false, // Service ftour : 17h30 – 19h15
    },
    acceptedTerms: false,
  });
  const [groupData, setGroupData] = useState({
    groupName: "",
    responsibleName: "",
    responsibleEmail: "",
    responsiblePhone: "",
    estimatedSize: "",
  });
  const [groupFile, setGroupFile] = useState<File | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);

  const [registrationSuccess, setRegistrationSuccess] = useState<{
    qrToken: string;
    dayInfo: { dayNumber: number; date: string };
  } | null>(null);
  const [groupSuccess, setGroupSuccess] = useState(false);

  const registerMutation = trpc.volunteers.register.useMutation({
    onSuccess: data => {
      const selectedDay = days?.find(d => d.id === parseInt(formData.dayId));
      const dateLocale =
        lang === "ar" ? "ar-MA" : lang === "en" ? "en-US" : "fr-FR";
      setRegistrationSuccess({
        qrToken: data.qrToken,
        dayInfo: {
          dayNumber: selectedDay?.dayNumber || 0,
          date: selectedDay?.date
            ? new Date(selectedDay.date).toLocaleDateString(dateLocale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "",
        },
      });
      setShowWhatsAppPopup(true);
      toast.success(t.volunteer.submitSuccess);
    },
    onError: error => {
      toast.error(error.message || t.volunteer.submitError);
    },
  });

  const groupRegisterMutation = trpc.volunteers.registerGroup.useMutation({
    onSuccess: () => {
      setGroupSuccess(true);
      toast.success(
        lang === "ar"
          ? "تم تسجيل المجموعة بنجاح!"
          : lang === "en"
            ? "Group registration successful!"
            : "Demande groupe envoyée !"
      );
    },
    onError: error => {
      toast.error(
        error.message ||
          (lang === "ar" ? "خطأ" : lang === "en" ? "Error" : "Erreur")
      );
    },
  });

  useEffect(() => {
    if (preselectedDay) {
      setFormData(prev => ({ ...prev, dayId: preselectedDay }));
    }
  }, [preselectedDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fallbackDayId = availableDays[0]?.id?.toString() ?? "";
    const resolvedDayId = formData.dayId || fallbackDayId;

    if (!formData.acceptedTerms) {
      toast.error(
        lang === "ar"
          ? "يرجى قبول الشروط"
          : lang === "en"
            ? "Please accept the terms"
            : "Veuillez accepter les conditions"
      );
      return;
    }

    if (!resolvedDayId) {
      toast.error(
        lang === "ar"
          ? "يرجى اختيار تاريخ"
          : lang === "en"
            ? "Please select a date"
            : "Veuillez sélectionner une date"
      );
      return;
    }

    // Build volunteer slots array from checkbox state
    const volunteerSlots: string[] = [];
    if (formData.slots.preparation_ftour)
      volunteerSlots.push("preparation_ftour");
    if (formData.slots.service_ftour) volunteerSlots.push("service_ftour");

    if (volunteerSlots.length === 0) {
      setSlotsError(true);
      toast.error(
        lang === "ar"
          ? "يرجى اختيار فترة واحدة على الأقل"
          : lang === "en"
            ? "Please select at least one time slot"
            : "Veuillez sélectionner au moins un créneau de participation"
      );
      return;
    }
    setSlotsError(false);

    if (isGroup) {
      // Group registration
      if (!groupData.groupName.trim()) {
        toast.error(
          lang === "ar"
            ? "يرجى إدخال اسم المجموعة"
            : lang === "en"
              ? "Please enter the group name"
              : "Veuillez entrer le nom du groupe"
        );
        return;
      }
      if (
        !groupData.responsibleName.trim() ||
        !groupData.responsibleEmail.trim() ||
        !groupData.responsiblePhone.trim()
      ) {
        toast.error(
          lang === "ar"
            ? "يرجى ملء معلومات المسؤول"
            : lang === "en"
              ? "Please fill in the responsible person info"
              : "Veuillez remplir les informations du responsable"
        );
        return;
      }
      if (selectedGroupDayInsufficientCapacity) {
        toast.error(
          lang === "ar"
            ? "اليوم المختار ممتلئ لهذا العدد"
            : lang === "en"
              ? "Selected day is full for this group size"
              : "Le jour choisi est complet pour cet effectif de groupe"
        );
        return;
      }

      if (!groupFile) {
        toast.error(
          lang === "ar"
            ? "يرجى رفع ملف Excel"
            : lang === "en"
              ? "Please upload an Excel file"
              : "Veuillez uploader un fichier Excel"
        );
        return;
      }
      if (groupFile.size > 5 * 1024 * 1024) {
        toast.error(
          lang === "ar"
            ? "حجم الملف كبير جداً (الحد الأقصى 5 ميغا)"
            : lang === "en"
              ? "File too large (max 5 MB)"
              : "Fichier trop volumineux (max 5 Mo)"
        );
        return;
      }

      // Read file as base64
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:...;base64, prefix
          resolve(result.split(",")[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(groupFile);
      });

      groupRegisterMutation.mutate({
        groupName: groupData.groupName,
        responsibleName: groupData.responsibleName,
        responsibleEmail: groupData.responsibleEmail,
        responsiblePhone: groupData.responsiblePhone,
        estimatedSize: groupData.estimatedSize
          ? parseInt(groupData.estimatedSize)
          : undefined,
        dayId: parseInt(resolvedDayId),
        volunteerSlots: volunteerSlots as (
          | "preparation_ftour"
          | "service_ftour"
        )[],
        fileName: groupFile.name,
        fileBase64,
        acceptedTerms: formData.acceptedTerms,
      });
    } else {
      // Individual registration
      registerMutation.mutate({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        comment: formData.comment || undefined,
        dayId: parseInt(resolvedDayId),
        volunteerSlots: volunteerSlots as (
          | "preparation_ftour"
          | "service_ftour"
        )[],
        acceptedTerms: formData.acceptedTerms,
      });
    }
  };

  const isDayFull = (day: {
    date: string;
    isOpen: boolean;
    registeredCount?: number | null;
    capacity: number;
  }) =>
    !day.isOpen || (day.registeredCount ?? 0) >= day.capacity;

  const isFutureDay = (date: string) =>
    toUtcDayNumber(date) > getRamadanTodayDayNumber();

  const isIndividualDayOpenSoon = (day: { date: string }) =>
    isFutureDay(day.date) && !isWithinIndividualRegistrationWindow(day.date);

  const individualDays = days || [];
  const availableDays = individualDays.filter(
    day =>
      isWithinIndividualRegistrationWindow(day.date) &&
      !isIndividualDayOpenSoon(day) &&
      !isDayFull(day)
  );
  const selectedDay = days?.find(day => day.id.toString() === formData.dayId);
  const selectedDayIsFull = selectedDay ? isDayFull(selectedDay) : false;
  const selectedGroupSize = Number(groupData.estimatedSize || 0);
  const selectedDayRemainingSeats = selectedDay
    ? Math.max(0, selectedDay.capacity - (selectedDay.registeredCount ?? 0))
    : 0;
  const selectedGroupDayInsufficientCapacity =
    isGroup &&
    selectedDay &&
    selectedGroupSize > 0 &&
    selectedGroupSize > selectedDayRemainingSeats;
  const dateLocale =
    lang === "ar" ? "ar-MA" : lang === "en" ? "en-US" : "fr-FR";

  // Success screen translations
  const successTexts = {
    title:
      lang === "ar"
        ? "تم التسجيل بنجاح!"
        : lang === "en"
          ? "Registration confirmed!"
          : "Inscription confirmée !",
    thankYou:
      lang === "ar"
        ? "شكرًا لانضمامك إلى فريق المتطوعين بتاريخ"
        : lang === "en"
          ? "Thank you for joining our volunteer team on"
          : "Merci de rejoindre notre équipe de bénévoles le",
    qrCode:
      lang === "ar"
        ? "رمز QR الخاص بك:"
        : lang === "en"
          ? "Your unique QR code:"
          : "Votre code QR unique :",
    scanQr:
      lang === "ar"
        ? "امسح هذا الرمز عند الدخول"
        : lang === "en"
          ? "Scan this QR code at the entrance"
          : "Scannez ce QR code à l'entrée",
    emailSent:
      lang === "ar"
        ? "تم إرسال بريد إلكتروني يحتوي على رمز QR والتعليمات."
        : lang === "en"
          ? "An email with your QR code and instructions has been sent."
          : "Un email contenant votre QR code et les consignes vous a été envoyé.",
    newRegistration:
      lang === "ar"
        ? "تسجيل جديد"
        : lang === "en"
          ? "New registration"
          : "Nouvelle inscription",
    confirmationEmail:
      lang === "ar"
        ? "بريد التأكيد"
        : lang === "en"
          ? "Confirmation email"
          : "Email de confirmation",
    whatsappPopupTitle:
      lang === "ar"
        ? "انضم إلى مجتمع باب الريان"
        : lang === "en"
          ? "Join Bab Rayan Community"
          : "Rejoignez Bab Rayan Community",
    whatsappPopupDescription:
      lang === "ar"
        ? "انضموا إلى مجموعة واتساب أدناه لدمجكم في Bab Rayan Community."
        : lang === "en"
          ? "Join the WhatsApp group below to become part of the Bab Rayan Community."
          : "Rejoignez le groupe WhatsApp ci-dessous pour intégrer Bab Rayan Community.",
    whatsappPopupButton:
      lang === "ar"
        ? "الانضمام عبر واتساب"
        : lang === "en"
          ? "Join via WhatsApp"
          : "Rejoindre via WhatsApp",
    whatsappPopupClose:
      lang === "ar" ? "إغلاق" : lang === "en" ? "Close" : "Fermer",
  };

  // Form translations
  const formTexts = {
    joinUs:
      lang === "ar"
        ? "انضم إلينا"
        : lang === "en"
          ? "Join us"
          : "Rejoignez-nous",
    becomeVolunteer:
      lang === "ar"
        ? "كن متطوعا"
        : lang === "en"
          ? "Become a volunteer"
          : "Devenir bénévole",
    subtitle:
      lang === "ar"
        ? "شارك في هذه المغامرة التضامنية وشارك لحظات فريدة خلال شهر رمضان"
        : lang === "en"
          ? "Participate in this solidarity adventure and share unique moments during Ramadan"
          : "Participez à cette belle aventure solidaire et partagez des moments uniques pendant le Ramadan",
    schedules:
      lang === "ar" ? "المواعيد" : lang === "en" ? "Schedules" : "Horaires",
    location: lang === "ar" ? "المكان" : lang === "en" ? "Location" : "Lieu",
    locationDesc:
      lang === "ar"
        ? "4 شارع بيت لحم، حي النخيل، الدار البيضاء"
        : lang === "en"
          ? "4 rue Bayt Lahm, Palmier district, Casablanca"
          : "4 rue Bayt Lahm, quartier Palmier, Casablanca",
    qrCodeTitle:
      lang === "ar" ? "رمز QR" : lang === "en" ? "QR Code" : "QR Code",
    qrCodeDesc:
      lang === "ar"
        ? "ستتلقى رمز QR فريدًا لتقديمه عند الدخول يوم المشاركة."
        : lang === "en"
          ? "You will receive a unique QR code to present at the entrance on the day."
          : "Un QR code personnel vous sera envoyé ; il devra être présenté à l’entrée le jour de l’événement.",
    important:
      lang === "ar" ? "مهم" : lang === "en" ? "Important" : "Important",
    dress:
      lang === "ar"
        ? "لباس محتشم مطلوب"
        : lang === "en"
          ? "Proper dress required"
          : "Tenue correcte exigée",
    punctuality:
      lang === "ar"
        ? "الالتزام بالمواعيد مطلوب"
        : lang === "en"
          ? "Punctuality required"
          : "Ponctualité requise",
    instructions:
      lang === "ar"
        ? "احترام التعليمات"
        : lang === "en"
          ? "Respect instructions"
          : "Respect des consignes",
    noBags:
      lang === "ar"
        ? "الحقائب غير مسموحة"
        : lang === "en"
          ? "No bags allowed"
          : "Sac non autorisé",
    formTitle:
      lang === "ar"
        ? "استمارة التسجيل"
        : lang === "en"
          ? "Registration form"
          : "Formulaire d'inscription",
    formDesc:
      lang === "ar"
        ? "املأ هذا النموذج للتسجيل كمتطوع"
        : lang === "en"
          ? "Fill out this form to register as a volunteer"
          : "Remplissez ce formulaire pour vous inscrire comme bénévole",
    dayLabel:
      lang === "ar"
        ? "تاريخ المشاركة *"
        : lang === "en"
          ? "Participation date *"
          : "Date de participation *",
    selectDay:
      lang === "ar"
        ? "اختر تاريخًا"
        : lang === "en"
          ? "Select a date"
          : "Sélectionnez une date",
    loading:
      lang === "ar"
        ? "جاري التحميل..."
        : lang === "en"
          ? "Loading..."
          : "Chargement...",
    noDay:
      lang === "ar"
        ? "لا يوجد تاريخ متاح"
        : lang === "en"
          ? "No date available"
          : "Aucune date disponible",
    dayFull: lang === "ar" ? "اليوم مكتمل" : lang === "en" ? "Full" : "Complet",
    upcomingOpenSoon:
      lang === "ar"
        ? "فتح التسجيل قريبًا"
        : lang === "en"
          ? "Registrations opening soon"
          : "Inscriptions ouvertes bientôt",
    places: lang === "ar" ? "أماكن" : lang === "en" ? "places" : "places",
    day: lang === "ar" ? "اليوم" : lang === "en" ? "Day" : "Jour",
    firstName:
      lang === "ar"
        ? "الاسم الأول *"
        : lang === "en"
          ? "First name *"
          : "Prénom *",
    firstNamePlaceholder:
      lang === "ar"
        ? "اسمك الأول"
        : lang === "en"
          ? "Your first name"
          : "Votre prénom",
    lastName:
      lang === "ar" ? "اسم العائلة *" : lang === "en" ? "Last name *" : "Nom *",
    lastNamePlaceholder:
      lang === "ar"
        ? "اسم عائلتك"
        : lang === "en"
          ? "Your last name"
          : "Votre nom",
    email:
      lang === "ar"
        ? "البريد الإلكتروني *"
        : lang === "en"
          ? "Email *"
          : "Email *",
    phone:
      lang === "ar" ? "الهاتف *" : lang === "en" ? "Phone *" : "Téléphone *",
    terms:
      lang === "ar"
        ? "أوافق على شروط المشاركة وسياسة الخصوصية. أتعهد باحترام التعليمات والحضور في اليوم المختار."
        : lang === "en"
          ? "I accept the terms of participation and privacy policy. I commit to respecting the instructions and being present on the chosen day."
          : "J'accepte les conditions de participation et la politique de confidentialité. Je m'engage à respecter les consignes et à être présent(e) le jour choisi.",
    registering:
      lang === "ar"
        ? "جاري التسجيل..."
        : lang === "en"
          ? "Registering..."
          : "Inscription en cours...",
    register:
      lang === "ar"
        ? "التسجيل كمتطوع"
        : lang === "en"
          ? "Register as volunteer"
          : "S'inscrire comme bénévole",
    slotsLabel:
      lang === "ar"
        ? "فترات المشاركة (يمكنك اختيار فترة واحدة أو أكثر) *"
        : lang === "en"
          ? "Participation slots (you can select one or more) *"
          : "Créneaux de participation (vous pouvez cocher un ou plusieurs créneaux) *",
    preparationSlot:
      lang === "ar"
        ? "تحضير الفطور (15:00 – 16:45)"
        : lang === "en"
          ? "Ftour preparation (15:00 – 16:45)"
          : "Préparation ftour (15:00 – 16:45)",
    serviceSlot:
      lang === "ar"
        ? "خدمة الفطور (17:30 – 19:15)"
        : lang === "en"
          ? "Ftour service (17:30 – 19:15)"
          : "Service ftour (17:30 – 19:15)",
    slotsError:
      lang === "ar"
        ? "يرجى اختيار فترة واحدة على الأقل"
        : lang === "en"
          ? "Please select at least one time slot"
          : "Veuillez sélectionner au moins un créneau",
    consignesTitle:
      lang === "ar"
        ? "تعليمات مهمة"
        : lang === "en"
          ? "Important instructions"
          : "Consignes importantes",
    entryRule:
      lang === "ar"
        ? "الدخول للمشاركة في الخدمة يبدأ من الساعة 16:30. يُمنع على المتطوعين الدخول بعد الساعة 17:30."
        : lang === "en"
          ? "Entry to participate in the service starts from 4:30pm. Volunteers are not permitted to enter after 5:30pm."
          : "L'entrée pour participer au service commence à partir de 16h30. Il est interdit aux bénévoles d'entrer au-delà de 17h30.",
    consigneNoBags:
      lang === "ar"
        ? "الحقائب غير مسموح بها."
        : lang === "en"
          ? "Bags are not allowed."
          : "Les sacs ne sont pas autorisés.",
    consigneVest:
      lang === "ar"
        ? "ارتداء سترة المتطوع إلزامي داخل الجمعية."
        : lang === "en"
          ? "Wearing the volunteer vest is mandatory within the association."
          : "Le port du gilet bénévole est obligatoire au sein de l'association.",
    consigneNoPhotos:
      lang === "ar"
        ? "يمنع التقاط صور للمستفيدين."
        : lang === "en"
          ? "Taking photos of beneficiaries is prohibited."
          : "Il est interdit de prendre des photos des bénéficiaires.",
    // Group registration
    groupToggle:
      lang === "ar"
        ? "التسجيل كمجموعة"
        : lang === "en"
          ? "Register as a group"
          : "Je m'inscris en tant que groupe",
    groupName:
      lang === "ar"
        ? "اسم المجموعة / الهيكل *"
        : lang === "en"
          ? "Group / organization name *"
          : "Nom du groupe / structure *",
    groupNamePlaceholder:
      lang === "ar"
        ? "اسم جمعيتكم أو مجموعتكم"
        : lang === "en"
          ? "Name of your association or group"
          : "Nom de votre association ou groupe",
    responsibleName:
      lang === "ar"
        ? "اسم المسؤول *"
        : lang === "en"
          ? "Responsible person name *"
          : "Nom du responsable *",
    responsibleNamePlaceholder:
      lang === "ar"
        ? "الاسم الكامل للمسؤول"
        : lang === "en"
          ? "Full name of the responsible person"
          : "Nom complet du responsable",
    responsibleEmail:
      lang === "ar"
        ? "البريد الإلكتروني للمسؤول *"
        : lang === "en"
          ? "Responsible email *"
          : "Email du responsable *",
    responsiblePhone:
      lang === "ar"
        ? "هاتف المسؤول *"
        : lang === "en"
          ? "Responsible phone *"
          : "Téléphone du responsable *",
    estimatedSize:
      lang === "ar"
        ? "الحجم التقديري *"
        : lang === "en"
          ? "Estimated size *"
          : "Taille estimée *",
    estimatedSizePlaceholder:
      lang === "ar"
        ? "عدد المتطوعين تقريباً"
        : lang === "en"
          ? "Approximate number of volunteers"
          : "Nombre approximatif de bénévoles",
    uploadFile:
      lang === "ar"
        ? "رفع ملف Excel (قائمة المتطوعين) *"
        : lang === "en"
          ? "Upload Excel file (volunteer list) *"
          : "Upload fichier Excel (liste des bénévoles) *",
    uploadFileDesc:
      lang === "ar"
        ? "ملفات مقبولة: .xlsx, .xls, .csv (الحد الأقصى 5 ميغا)"
        : lang === "en"
          ? "Accepted files: .xlsx, .xls, .csv (max 5 MB)"
          : "Fichiers acceptés : .xlsx, .xls, .csv (max 5 Mo)",
    downloadTemplate:
      lang === "ar"
        ? "تحميل نموذج الاستمارة"
        : lang === "en"
          ? "Download the form template"
          : "Télécharger le formulaire",
    downloadTemplateDesc:
      lang === "ar"
        ? "حمّل الاستمارة، املأها بمعلومات المتطوعين، ثم ارفعها أدناه."
        : lang === "en"
          ? "Download the form, fill it with the volunteers' information, then upload it below."
          : "Téléchargez le formulaire, remplissez-le avec les informations des bénévoles, puis uploadez-le ci-dessous.",
    registerGroup:
      lang === "ar"
        ? "تسجيل المجموعة"
        : lang === "en"
          ? "Register group"
          : "Inscrire le groupe",
    registeringGroup:
      lang === "ar"
        ? "جاري تسجيل المجموعة..."
        : lang === "en"
          ? "Registering group..."
          : "Inscription du groupe en cours...",
  };

  const renderConsignesBox = (className = "") => (
    <div
      className={`bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2 ${className}`.trim()}
    >
      <h4 className="font-semibold text-amber-700 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {formTexts.consignesTitle}
      </h4>
      <ul className="text-sm text-amber-900 space-y-1">
        <li className="font-bold text-red-700">• {formTexts.entryRule}</li>
        <li>• {formTexts.dress}</li>
        <li>• {formTexts.punctuality}</li>
        <li>• {formTexts.consigneNoBags}</li>
        <li>• {formTexts.consigneVest}</li>
        <li>• {formTexts.consigneNoPhotos}</li>
      </ul>
    </div>
  );

  // Group success screen
  if (groupSuccess) {
    const groupSuccessTexts = {
      title:
        lang === "ar"
          ? "تم تسجيل المجموعة بنجاح!"
          : lang === "en"
            ? "Group registration confirmed!"
            : "Demande groupe envoyée !",
      message:
        lang === "ar"
          ? "تم إرسال ملف Excel الخاص بكم إلى الإدارة. سيتم التواصل معكم قريباً."
          : lang === "en"
            ? "Your Excel file has been sent to the administration. You will be contacted soon."
            : "Votre demande a été transmise à l'administration. Vous recevrez un email après validation ou refus.",
      emailSent:
        lang === "ar"
          ? "تم إرسال بريد إلكتروني إلى الإدارة مع الملف المرفق."
          : lang === "en"
            ? "An email has been sent to the administration with the attached file."
            : "Un email de décision vous sera envoyé après traitement de votre demande.",
    };
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
                  <h1 className="text-2xl font-bold text-foreground">
                    {groupSuccessTexts.title}
                  </h1>
                  <p className="text-muted-foreground">
                    {groupSuccessTexts.message}
                  </p>
                </div>
                <div className="bg-primary/5 rounded-lg p-4 text-left space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    {successTexts.confirmationEmail}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {groupSuccessTexts.emailSent}
                  </p>
                </div>
                <div className="pt-4">
                  <Button
                    onClick={() => {
                      setGroupSuccess(false);
                      setIsGroup(false);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    {successTexts.newRegistration}
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

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Dialog open={showWhatsAppPopup} onOpenChange={setShowWhatsAppPopup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle>{successTexts.whatsappPopupTitle}</DialogTitle>
              <DialogDescription>
                {successTexts.whatsappPopupDescription}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center gap-2">
              <Button asChild className="w-full sm:w-auto">
                <a
                  href="https://chat.whatsapp.com/CzGvHX3Wu8C6O74MPaNYO8?mode=gi_t"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {successTexts.whatsappPopupButton}
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowWhatsAppPopup(false)}
                className="w-full sm:w-auto"
              >
                {successTexts.whatsappPopupClose}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Navbar />
        <main className="flex-1 py-16">
          <div className="container max-w-2xl">
            <Card className="border-none shadow-lg">
              <CardContent className="p-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {successTexts.title}
                  </h1>
                  <p className="text-muted-foreground">
                    {successTexts.thankYou}{" "}
                    <span className="capitalize">
                      {registrationSuccess.dayInfo.date}
                    </span>
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Calendar className="h-5 w-5" />
                    <span className="font-medium capitalize">
                      {registrationSuccess.dayInfo.date}
                    </span>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      {successTexts.qrCode}
                    </p>
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

                {renderConsignesBox("text-left")}

                <div className="pt-4">
                  <Button
                    onClick={() => setRegistrationSuccess(null)}
                    variant="outline"
                    className="w-full"
                  >
                    {successTexts.newRegistration}
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

  const entryRuleText =
    lang === "ar"
      ? "الدخول للمشاركة في الخدمة يبدأ من الساعة 16:30. يُمنع على المتطوعين الدخول بعد الساعة 17:30."
      : lang === "en"
        ? "Entry to participate in the service starts from 4:30pm. Volunteers are not permitted to enter after 5:30pm."
        : "L'entrée pour participer au service commence à partir de 16h30. Il est interdit aux bénévoles d'entrer au-delà de 17h30.";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Red alert banner */}
      <div className="bg-red-600 text-white w-full py-3 px-4">
        <div className="container max-w-3xl flex items-start gap-3">
          <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <p className="text-sm font-bold leading-snug">{entryRuleText}</p>
        </div>
      </div>

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

        {/* Registration Notices */}
        <section className="pb-0 pt-2">
          <div className="container max-w-3xl space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-900 font-medium">
                {lang === "ar"
                  ? "بدون رمز QR صالح، لا يمكن الدخول إلى مقر الجمعية."
                  : lang === "en"
                    ? "Without a valid QR code, entry into the association premises is not possible."
                    : "Sans QR code valide, il n'est pas possible d'entrer dans l'enceinte de l'association"}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-900 font-medium">
                {lang === "ar"
                  ? "عدد المشاركين محدود لأسباب داخل المؤسسة."
                  : lang === "en"
                    ? "The number of participants is limited for reasons inside the establishment."
                    : "Le nombre de participants est limité durant l'évènement pour des raisons de sécurité mais également pour que ton expérience en tant que bénévole et le service assuré pour les bénéficiaires soit excellent."}
              </p>
            </div>
            {renderConsignesBox()}
          </div>
        </section>

        {/* Form Section */}
        <section className="py-12">
          <div className="container">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Info Cards */}
              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardContent className="p-6 space-y-3">
                    <h3 className="font-semibold">
                      {lang === "ar"
                        ? "شارك صوركم مع المعرض"
                        : lang === "en"
                          ? "Share your photos with the gallery"
                          : "Partagez vos photos sur la galerie"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lang === "ar"
                        ? "يمكن للمتطوعين رفع صور الحدث مباشرة. تُنشر الصور فوراً في المعرض."
                        : lang === "en"
                          ? "Volunteers can upload event photos directly. Photos are published immediately in the gallery."
                          : "Les bénévoles peuvent uploader directement leurs photos de l'événement. Publication immédiate dans la galerie."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/${lang}/benevole/photos`)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {lang === "ar"
                        ? "رفع الصور"
                        : lang === "en"
                          ? "Upload photos"
                          : "Uploader des photos"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">{formTexts.schedules}</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-sm font-medium">
                            Préparation ftour
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground ml-4">
                          15h00 – 16h45
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-sm font-medium">
                            Service ftour
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground ml-4">
                          17h30 – 19h15
                        </p>
                      </div>
                    </div>
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
                    <div className="rounded-lg overflow-hidden mt-3">
                      <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.965397406019!2d-7.630356723855206!3d33.58024767333852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xda7d2be82cac4e5%3A0x4c7187e94a633b19!2sAssociation%20Bab%20Rayan!5e0!3m2!1sfr!2sma!4v1771423733450!5m2!1sfr!2sma"
                        width="100%"
                        height="200"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Association Bab Rayan - Google Maps"
                      />
                    </div>
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
              </div>

              {/* Registration Form */}
              <div className="lg:col-span-2">
                <Card className="border-none shadow-lg">
                  <CardHeader>
                    <CardTitle>{formTexts.formTitle}</CardTitle>
                    <CardDescription>{formTexts.formDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Volunteer Slots */}
                      <div className="space-y-3">
                        <Label>{formTexts.slotsLabel}</Label>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="slot-preparation"
                              checked={formData.slots.preparation_ftour}
                              onCheckedChange={checked => {
                                setFormData(prev => ({
                                  ...prev,
                                  slots: {
                                    ...prev.slots,
                                    preparation_ftour: checked as boolean,
                                  },
                                }));
                                setSlotsError(false);
                              }}
                            />
                            <label
                              htmlFor="slot-preparation"
                              className="text-sm cursor-pointer"
                            >
                              {formTexts.preparationSlot}
                            </label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id="slot-service"
                              checked={formData.slots.service_ftour}
                              onCheckedChange={checked => {
                                setFormData(prev => ({
                                  ...prev,
                                  slots: {
                                    ...prev.slots,
                                    service_ftour: checked as boolean,
                                  },
                                }));
                                setSlotsError(false);
                              }}
                            />
                            <label
                              htmlFor="slot-service"
                              className="text-sm cursor-pointer"
                            >
                              {formTexts.serviceSlot}
                            </label>
                          </div>
                        </div>
                        {slotsError && (
                          <p className="text-sm text-red-500">
                            {formTexts.slotsError}
                          </p>
                        )}
                      </div>

                      {/* Day Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="day">{formTexts.dayLabel}</Label>
                        {!isGroup ? (
                          <>
                            <Select
                              value={formData.dayId}
                              onValueChange={value =>
                                setFormData(prev => ({ ...prev, dayId: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={formTexts.selectDay}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {daysLoading ? (
                                  <SelectItem value="loading" disabled>
                                    {formTexts.loading}
                                  </SelectItem>
                                ) : individualDays.length > 0 ? (
                                  individualDays.map(day => (
                                    <SelectItem
                                      key={day.id}
                                      value={day.id.toString()}
                                      disabled={
                                        isDayFull(day) ||
                                        isIndividualDayOpenSoon(day)
                                      }
                                    >
                                      {new Date(day.date).toLocaleDateString(
                                        dateLocale,
                                        {
                                          weekday: "long",
                                          day: "numeric",
                                          month: "long",
                                        }
                                      )}
                                      {isIndividualDayOpenSoon(day)
                                        ? ` - ${formTexts.upcomingOpenSoon}`
                                        : isDayFull(day)
                                          ? ` - ${formTexts.dayFull}`
                                          : ""}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="none" disabled>
                                    {formTexts.noDay}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </>
                        ) : (
                          <Select
                            value={formData.dayId}
                            onValueChange={value =>
                              setFormData(prev => ({ ...prev, dayId: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formTexts.selectDay} />
                            </SelectTrigger>
                            <SelectContent>
                              {daysLoading ? (
                                <SelectItem value="loading-group" disabled>
                                  {formTexts.loading}
                                </SelectItem>
                              ) : days && days.length > 0 ? (
                                days.map(day => (
                                  <SelectItem
                                    key={`group-${day.id}`}
                                    value={day.id.toString()}
                                    disabled={
                                      isDayFull(day) && !isFutureDay(day.date)
                                    }
                                  >
                                    {new Date(day.date).toLocaleDateString(
                                      dateLocale,
                                      {
                                        weekday: "long",
                                        day: "numeric",
                                        month: "long",
                                      }
                                    )}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none-group" disabled>
                                  {formTexts.noDay}
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        {selectedDayIsFull && !isGroup && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {formTexts.dayFull}
                          </p>
                        )}
                        {selectedGroupDayInsufficientCapacity && (
                          <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Jour choisi complet pour cet effectif de groupe.
                          </p>
                        )}
                      </div>

                      {/* Group Toggle */}
                      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <UsersRound className="h-5 w-5 text-primary" />
                          <div>
                            <Label
                              htmlFor="group-toggle"
                              className="cursor-pointer font-medium"
                            >
                              {formTexts.groupToggle}
                            </Label>
                          </div>
                        </div>
                        <Switch
                          id="group-toggle"
                          checked={isGroup}
                          onCheckedChange={setIsGroup}
                        />
                      </div>

                      {isGroup ? (
                        <>
                          {/* Group Fields */}
                          <div className="space-y-2">
                            <Label htmlFor="groupName">
                              {formTexts.groupName}
                            </Label>
                            <Input
                              id="groupName"
                              value={groupData.groupName}
                              onChange={e =>
                                setGroupData(prev => ({
                                  ...prev,
                                  groupName: e.target.value,
                                }))
                              }
                              placeholder={formTexts.groupNamePlaceholder}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="responsibleName">
                              {formTexts.responsibleName}
                            </Label>
                            <Input
                              id="responsibleName"
                              value={groupData.responsibleName}
                              onChange={e =>
                                setGroupData(prev => ({
                                  ...prev,
                                  responsibleName: e.target.value,
                                }))
                              }
                              placeholder={formTexts.responsibleNamePlaceholder}
                              required
                            />
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="responsibleEmail">
                                {formTexts.responsibleEmail}
                              </Label>
                              <Input
                                id="responsibleEmail"
                                type="email"
                                value={groupData.responsibleEmail}
                                onChange={e =>
                                  setGroupData(prev => ({
                                    ...prev,
                                    responsibleEmail: e.target.value,
                                  }))
                                }
                                placeholder="responsable@email.com"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="responsiblePhone">
                                {formTexts.responsiblePhone}
                              </Label>
                              <Input
                                id="responsiblePhone"
                                type="tel"
                                value={groupData.responsiblePhone}
                                onChange={e =>
                                  setGroupData(prev => ({
                                    ...prev,
                                    responsiblePhone: e.target.value,
                                  }))
                                }
                                placeholder="+212 6XX XXX XXX"
                                required
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="estimatedSize">
                              {formTexts.estimatedSize}
                            </Label>
                            <Input
                              id="estimatedSize"
                              type="number"
                              min="2"
                              value={groupData.estimatedSize}
                              onChange={e =>
                                setGroupData(prev => ({
                                  ...prev,
                                  estimatedSize: e.target.value,
                                }))
                              }
                              placeholder={formTexts.estimatedSizePlaceholder}
                              required
                            />
                          </div>

                          {/* Download Template */}
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                            <p className="text-sm text-muted-foreground">
                              {formTexts.downloadTemplateDesc}
                            </p>
                            <a
                              href="https://jgnzhrlumlydmseusnbo.supabase.co/storage/v1/object/public/Formulaire/FORMULAIRE.xlsx"
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                              <Download className="h-4 w-4" />
                              {formTexts.downloadTemplate}
                            </a>
                          </div>

                          {/* File Upload */}
                          <div className="space-y-2">
                            <Label>{formTexts.uploadFile}</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                              <input
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={e =>
                                  setGroupFile(e.target.files?.[0] || null)
                                }
                                className="hidden"
                                id="group-file-upload"
                              />
                              <label
                                htmlFor="group-file-upload"
                                className="cursor-pointer space-y-2 block"
                              >
                                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                {groupFile ? (
                                  <p className="text-sm font-medium text-primary">
                                    {groupFile.name}
                                  </p>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    {formTexts.uploadFileDesc}
                                  </p>
                                )}
                              </label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="comment">Commentaire</Label>
                            <Textarea
                              id="comment"
                              value={formData.comment}
                              onChange={e =>
                                setFormData(prev => ({
                                  ...prev,
                                  comment: e.target.value,
                                }))
                              }
                              placeholder="Ajoutez un commentaire (optionnel)"
                              rows={3}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Individual Name Fields */}
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="firstName">
                                {formTexts.firstName}
                              </Label>
                              <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={e =>
                                  setFormData(prev => ({
                                    ...prev,
                                    firstName: e.target.value,
                                  }))
                                }
                                placeholder={formTexts.firstNamePlaceholder}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="lastName">
                                {formTexts.lastName}
                              </Label>
                              <Input
                                id="lastName"
                                value={formData.lastName}
                                onChange={e =>
                                  setFormData(prev => ({
                                    ...prev,
                                    lastName: e.target.value,
                                  }))
                                }
                                placeholder={formTexts.lastNamePlaceholder}
                                required
                              />
                            </div>
                          </div>

                          {/* Individual Contact Fields */}
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="email">{formTexts.email}</Label>
                              <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={e =>
                                  setFormData(prev => ({
                                    ...prev,
                                    email: e.target.value,
                                  }))
                                }
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
                                onChange={e =>
                                  setFormData(prev => ({
                                    ...prev,
                                    phone: e.target.value,
                                  }))
                                }
                                placeholder="+212 6XX XXX XXX"
                                required
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Terms */}
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="terms"
                          checked={formData.acceptedTerms}
                          onCheckedChange={checked =>
                            setFormData(prev => ({
                              ...prev,
                              acceptedTerms: checked as boolean,
                            }))
                          }
                          required
                        />
                        <label
                          htmlFor="terms"
                          className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                        >
                          {formTexts.terms}
                        </label>
                      </div>

                      {/* Submit */}
                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={
                          registerMutation.isPending ||
                          groupRegisterMutation.isPending ||
                          (!isGroup && availableDays.length === 0) ||
                          (isGroup && (!days || days.length === 0))
                        }
                      >
                        {registerMutation.isPending ||
                        groupRegisterMutation.isPending ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            {isGroup
                              ? formTexts.registeringGroup
                              : formTexts.registering}
                          </>
                        ) : (
                          <>
                            {isGroup ? (
                              <UsersRound className="h-5 w-5 mr-2" />
                            ) : (
                              <Users className="h-5 w-5 mr-2" />
                            )}
                            {isGroup
                              ? formTexts.registerGroup
                              : formTexts.register}
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
