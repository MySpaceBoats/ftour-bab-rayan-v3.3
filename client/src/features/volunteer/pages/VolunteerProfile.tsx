import { useEffect, useState, type ChangeEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  Loader2,
  QrCode,
  CalendarPlus,
  Images,
  MessageSquare,
  User,
  CheckCircle,
  Star,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import PrivateRoute from "../components/PrivateRoute";
import VolunteerBadge from "../components/VolunteerBadge";
import VolunteerGalleryUploadModule from "@/features/gallery/components/VolunteerGalleryUploadModule";
import QrImage from "@/shared/components/QrImage";
import {
  getMyAttendance,
  getMyRegistrations,
  getMyVolunteerProfile,
  getOpenDays,
  registerForDay,
  submitVolunteerFeedback,
  updateMyCredentials,
  updateMyVolunteerProfile,
} from "../volunteerApi";

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://ftourbabrayan.ma";

const SLOT_LABELS: Record<string, string> = {
  preparation_ftour: "Préparation Ftour",
  service_ftour: "Service Ftour",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  registered: { label: "Inscrit", color: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Confirmé", color: "bg-green-100 text-green-800" },
  present: { label: "Présent", color: "bg-emerald-100 text-emerald-800" },
  absent: { label: "Absent", color: "bg-red-100 text-red-800" },
  cancelled: { label: "Annulé", color: "bg-stone-100 text-stone-500" },
};

export default function VolunteerProfilePage() {
  const profileQuery = getMyVolunteerProfile();
  const attendanceQuery = getMyAttendance(20, 0);
  const registrationsQuery = getMyRegistrations();
  const openDaysQuery = getOpenDays();
  const updateMutation = updateMyVolunteerProfile();
  const registerMutation = registerForDay();
  const credentialsMutation = updateMyCredentials();
  const feedbackMutation = submitVolunteerFeedback();

  // Personal info form
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Credentials form
  const [credForm, setCredForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Registration form
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  // Feedback form
  const [feedback, setFeedback] = useState({ rating: 0, comment: "" });
  const [feedbackSent, setFeedbackSent] = useState(false);

  const photoStorageKey = profileQuery.data
    ? `volunteer-photo-${profileQuery.data.id}`
    : null;

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm({
      first_name: profileQuery.data.first_name,
      last_name: profileQuery.data.last_name,
      phone: profileQuery.data.phone ?? "",
    });
    setCredForm(prev => ({ ...prev, email: profileQuery.data!.email ?? "" }));
  }, [profileQuery.data]);

  useEffect(() => {
    if (!photoStorageKey) return;
    const stored = window.localStorage.getItem(photoStorageKey);
    setPhotoPreview(stored);
  }, [photoStorageKey]);

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setPhotoPreview(result);
      if (photoStorageKey) window.localStorage.setItem(photoStorageKey, result);
    };
    reader.readAsDataURL(file);
  };

  const onSaveInfo = async () => {
    await updateMutation.mutateAsync({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || null,
    });
    toast.success("Informations mises à jour");
  };

  const onSaveCredentials = async () => {
    if (!credForm.email && !credForm.password) {
      toast.error("Aucune modification à enregistrer");
      return;
    }
    if (credForm.password && credForm.password !== credForm.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      await credentialsMutation.mutateAsync({
        email: credForm.email || undefined,
        password: credForm.password || undefined,
      });
      toast.success("Identifiants mis à jour avec succès");
      setCredForm(prev => ({ ...prev, password: "", confirmPassword: "" }));
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la mise à jour");
    }
  };

  const toggleSlot = (slot: string) => {
    setSelectedSlots(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    );
  };

  const onRegister = async () => {
    if (!selectedDay || selectedSlots.length === 0) {
      toast.error("Choisissez un jour et au moins un créneau");
      return;
    }
    try {
      await registerMutation.mutateAsync({
        dayId: selectedDay,
        volunteerSlots: selectedSlots as any,
      });
      toast.success("Inscription enregistrée avec succès !");
      setSelectedDay(null);
      setSelectedSlots([]);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de l'inscription");
    }
  };

  const onSubmitFeedback = async () => {
    if (feedback.rating === 0) {
      toast.error("Veuillez donner une note");
      return;
    }
    if (feedback.comment.trim().length < 3) {
      toast.error("Le commentaire est trop court");
      return;
    }
    try {
      await feedbackMutation.mutateAsync({
        rating: feedback.rating,
        comment: feedback.comment.trim(),
      });
      setFeedbackSent(true);
      toast.success("Merci pour votre feedback !");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de l'envoi");
    }
  };

  const downloadQr = (token: string, dayNumber: number | null) => {
    const canvas = document.createElement("canvas");
    const img = document.querySelector(
      `[data-qr-token="${token}"]`
    ) as HTMLImageElement;
    if (!img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    ctx2d.drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.download = `qr-benevole-jour-${dayNumber ?? token.slice(0, 8)}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  return (
    <PrivateRoute redirectTo="/profil-benevole">
      <div className="min-h-screen flex flex-col bg-stone-50">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10 space-y-6">
          <h1 className="text-3xl font-bold text-stone-900">
            Mon espace bénévole
          </h1>

          {profileQuery.isLoading ? (
            <div className="flex items-center gap-2 text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : profileQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                Impossible de charger le profil.
              </AlertDescription>
            </Alert>
          ) : profileQuery.data ? (
            <>
              {/* Summary bar */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Avatar className="h-16 w-16 border border-stone-200">
                      <AvatarImage
                        src={photoPreview ?? undefined}
                        alt="Photo"
                      />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xl font-semibold">
                        {profileQuery.data.first_name?.[0] ?? "B"}
                        {profileQuery.data.last_name?.[0] ?? "R"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-center sm:text-left">
                      <div className="text-xl font-semibold">
                        {profileQuery.data.first_name}{" "}
                        {profileQuery.data.last_name}
                      </div>
                      <VolunteerBadge role={profileQuery.data.role} />
                    </div>
                    <div className="text-sm text-stone-500">
                      {registrationsQuery.data?.length ?? 0} inscription(s)
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="flex flex-wrap h-auto gap-1">
                  <TabsTrigger value="profile" className="gap-1.5">
                    <User className="h-4 w-4" />
                    Profil
                  </TabsTrigger>
                  <TabsTrigger value="inscriptions" className="gap-1.5">
                    <QrCode className="h-4 w-4" />
                    Inscriptions & QR
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-1.5">
                    <CalendarPlus className="h-4 w-4" />
                    Historique
                  </TabsTrigger>
                  <TabsTrigger value="gallery" className="gap-1.5">
                    <Images className="h-4 w-4" />
                    Galerie
                  </TabsTrigger>
                  <TabsTrigger value="feedback" className="gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Feedback
                  </TabsTrigger>
                </TabsList>

                {/* ── PROFIL TAB ── */}
                <TabsContent value="profile" className="space-y-6">
                  {/* Personal info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Mes informations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col items-center gap-3 rounded-lg border border-stone-200 p-4 sm:flex-row sm:items-start">
                        <Avatar className="h-20 w-20 border border-stone-200">
                          <AvatarImage
                            src={photoPreview ?? undefined}
                            alt="Photo du bénévole"
                          />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xl font-semibold">
                            {form.first_name?.[0] ?? "B"}
                            {form.last_name?.[0] ?? "R"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-2 w-full">
                          <Label htmlFor="volunteer-photo">
                            Photo de profil
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="volunteer-photo"
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="cursor-pointer"
                            />
                            <Camera className="h-4 w-4 text-stone-500" />
                          </div>
                          <p className="text-xs text-stone-500">
                            Personnalisez votre espace avec votre photo.
                          </p>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Prénom</Label>
                          <Input
                            value={form.first_name}
                            onChange={e =>
                              setForm(prev => ({
                                ...prev,
                                first_name: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>Nom</Label>
                          <Input
                            value={form.last_name}
                            onChange={e =>
                              setForm(prev => ({
                                ...prev,
                                last_name: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>Téléphone</Label>
                          <Input
                            value={form.phone}
                            onChange={e =>
                              setForm(prev => ({
                                ...prev,
                                phone: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <Button
                        onClick={onSaveInfo}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enregistrement...
                          </>
                        ) : (
                          "Enregistrer"
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Credentials */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Identifiants de connexion</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-stone-500">
                        Mettez à jour votre adresse email ou votre mot de passe.
                        Laissez vide les champs que vous ne souhaitez pas
                        modifier.
                      </p>
                      <div>
                        <Label>Nouvelle adresse email</Label>
                        <Input
                          type="email"
                          value={credForm.email}
                          placeholder={profileQuery.data.email ?? ""}
                          onChange={e =>
                            setCredForm(prev => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Nouveau mot de passe</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={credForm.password}
                          onChange={e =>
                            setCredForm(prev => ({
                              ...prev,
                              password: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label>Confirmer le mot de passe</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={credForm.confirmPassword}
                          onChange={e =>
                            setCredForm(prev => ({
                              ...prev,
                              confirmPassword: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        onClick={onSaveCredentials}
                        disabled={credentialsMutation.isPending}
                        variant="outline"
                      >
                        {credentialsMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Mise à jour...
                          </>
                        ) : (
                          "Mettre à jour les identifiants"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── INSCRIPTIONS & QR TAB ── */}
                <TabsContent value="inscriptions" className="space-y-6">
                  {/* Open days registration */}
                  <Card>
                    <CardHeader>
                      <CardTitle>S'inscrire pour un jour</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {openDaysQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-stone-600">
                          <Loader2 className="h-4 w-4 animate-spin" />{" "}
                          Chargement des jours...
                        </div>
                      ) : !openDaysQuery.data?.length ? (
                        <p className="text-stone-500 text-sm">
                          Aucun jour n'est ouvert aux inscriptions pour le
                          moment.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {openDaysQuery.data.map(day => (
                              <button
                                key={day.id}
                                onClick={() =>
                                  setSelectedDay(
                                    selectedDay === day.id ? null : day.id
                                  )
                                }
                                className={`rounded-lg border p-3 text-left transition-colors ${
                                  selectedDay === day.id
                                    ? "border-emerald-500 bg-emerald-50"
                                    : "border-stone-200 hover:border-stone-300"
                                }`}
                              >
                                <div className="font-medium text-sm">
                                  Jour {day.dayNumber}
                                </div>
                                <div className="text-xs text-stone-500">
                                  {new Date(day.date).toLocaleDateString(
                                    "fr-FR",
                                    {
                                      weekday: "long",
                                      day: "numeric",
                                      month: "long",
                                    }
                                  )}
                                </div>
                                <div className="text-xs text-stone-400 mt-1">
                                  {day.registeredCount ?? 0}/{day.capacity}{" "}
                                  inscrits
                                </div>
                              </button>
                            ))}
                          </div>

                          {selectedDay && (
                            <div className="space-y-3 border-t pt-4">
                              <Label>Créneaux de participation</Label>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    "preparation_ftour",
                                    "service_ftour",
                                  ] as const
                                ).map(slot => (
                                  <button
                                    key={slot}
                                    onClick={() => toggleSlot(slot)}
                                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                                      selectedSlots.includes(slot)
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : "border-stone-300 hover:border-stone-400"
                                    }`}
                                  >
                                    {SLOT_LABELS[slot]}
                                  </button>
                                ))}
                              </div>
                              <Button
                                onClick={onRegister}
                                disabled={
                                  registerMutation.isPending ||
                                  selectedSlots.length === 0
                                }
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                {registerMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Inscription...
                                  </>
                                ) : (
                                  <>
                                    <CalendarPlus className="h-4 w-4 mr-2" />
                                    S'inscrire
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* My QR codes */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Mes QR codes d'accès</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {registrationsQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-stone-600">
                          <Loader2 className="h-4 w-4 animate-spin" />{" "}
                          Chargement...
                        </div>
                      ) : !registrationsQuery.data?.length ? (
                        <p className="text-stone-500 text-sm">
                          Aucune inscription trouvée. Inscrivez-vous ci-dessus.
                        </p>
                      ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {registrationsQuery.data.map(reg => {
                            const statusInfo =
                              STATUS_LABELS[reg.status] ??
                              STATUS_LABELS.registered;
                            const checkinUrl = reg.qrToken
                              ? `${BASE_URL}/checkin/${reg.qrToken}`
                              : null;
                            return (
                              <div
                                key={reg.id}
                                className="flex flex-col items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                              >
                                <div className="text-center">
                                  <div className="font-semibold text-stone-800">
                                    {reg.dayNumber
                                      ? `Jour ${reg.dayNumber}`
                                      : "Jour ?"}
                                  </div>
                                  {reg.dayDate && (
                                    <div className="text-xs text-stone-500">
                                      {new Date(reg.dayDate).toLocaleDateString(
                                        "fr-FR",
                                        {
                                          weekday: "long",
                                          day: "numeric",
                                          month: "long",
                                        }
                                      )}
                                    </div>
                                  )}
                                  {reg.location && (
                                    <div className="text-xs text-stone-400">
                                      {reg.location}
                                    </div>
                                  )}
                                </div>

                                {checkinUrl ? (
                                  <QrImage
                                    data={checkinUrl}
                                    size={180}
                                    className="rounded-lg"
                                    alt={`QR Code Jour ${reg.dayNumber}`}
                                  />
                                ) : (
                                  <div className="h-[180px] w-[180px] flex items-center justify-center rounded-lg border border-dashed border-stone-300 text-stone-400 text-xs">
                                    QR indisponible
                                  </div>
                                )}

                                <div className="flex flex-wrap justify-center gap-1">
                                  <span
                                    className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusInfo.color}`}
                                  >
                                    {statusInfo.label}
                                  </span>
                                  {reg.volunteerSlots.map(slot => (
                                    <span
                                      key={slot}
                                      className="text-xs rounded-full bg-stone-100 text-stone-600 px-2 py-0.5"
                                    >
                                      {SLOT_LABELS[slot] ?? slot}
                                    </span>
                                  ))}
                                </div>

                                {checkinUrl && reg.qrToken && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() =>
                                      downloadQr(reg.qrToken!, reg.dayNumber)
                                    }
                                  >
                                    <Download className="h-3 w-3 mr-1.5" />
                                    Télécharger
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── HISTORY TAB ── */}
                <TabsContent value="history">
                  <Card>
                    <CardHeader>
                      <CardTitle>Historique des présences</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {attendanceQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-stone-600">
                          <Loader2 className="h-4 w-4 animate-spin" />{" "}
                          Chargement...
                        </div>
                      ) : attendanceQuery.error ? (
                        <Alert variant="destructive">
                          <AlertDescription>
                            Impossible de charger l'historique.
                          </AlertDescription>
                        </Alert>
                      ) : !attendanceQuery.data?.length ? (
                        <p className="text-stone-600 text-sm">
                          Aucune participation enregistrée pour le moment.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b text-stone-500">
                                <th className="py-2 pr-4">Date</th>
                                <th className="py-2 pr-4">Créneau</th>
                                <th className="py-2 pr-4">Statut</th>
                                <th className="py-2">Points</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceQuery.data.map(row => {
                                const statusInfo =
                                  STATUS_LABELS[row.status] ??
                                  STATUS_LABELS.registered;
                                return (
                                  <tr
                                    key={`${row.id}-${row.slot}`}
                                    className="border-b last:border-0"
                                  >
                                    <td className="py-2 pr-4">{row.date}</td>
                                    <td className="py-2 pr-4">
                                      {SLOT_LABELS[row.slot] ?? row.slot}
                                    </td>
                                    <td className="py-2 pr-4">
                                      <span
                                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusInfo.color}`}
                                      >
                                        {statusInfo.label}
                                      </span>
                                    </td>
                                    <td className="py-2">{row.points_earned}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── GALLERY TAB ── */}
                <TabsContent value="gallery">
                  <Card>
                    <CardHeader>
                      <CardTitle>Mes photos pour la galerie</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-stone-500 mb-4">
                        En tant que bénévole connecté, vos photos sont
                        enregistrées directement sans validation par email.
                        Elles restent en attente de modération avant publication.
                      </p>
                      <VolunteerGalleryUploadModule />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── FEEDBACK TAB ── */}
                <TabsContent value="feedback">
                  <Card>
                    <CardHeader>
                      <CardTitle>Laisser un feedback</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {feedbackSent ? (
                        <div className="flex flex-col items-center gap-4 py-8 text-center">
                          <CheckCircle className="h-12 w-12 text-emerald-500" />
                          <div>
                            <p className="text-lg font-semibold text-stone-900">
                              Merci pour votre retour !
                            </p>
                            <p className="text-stone-500 text-sm mt-1">
                              Votre feedback nous aide à améliorer l'expérience
                              bénévole.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setFeedbackSent(false);
                              setFeedback({ rating: 0, comment: "" });
                            }}
                          >
                            Donner un autre avis
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div>
                            <Label className="mb-2 block">
                              Note globale de l'expérience
                            </Label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button
                                  key={star}
                                  onClick={() =>
                                    setFeedback(prev => ({
                                      ...prev,
                                      rating: star,
                                    }))
                                  }
                                  className="transition-transform hover:scale-110"
                                >
                                  <Star
                                    className={`h-8 w-8 ${
                                      star <= feedback.rating
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-stone-300"
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="feedback-comment">
                              Commentaire
                            </Label>
                            <Textarea
                              id="feedback-comment"
                              placeholder="Partagez votre expérience, vos suggestions ou vos remarques..."
                              rows={5}
                              className="mt-1"
                              value={feedback.comment}
                              onChange={e =>
                                setFeedback(prev => ({
                                  ...prev,
                                  comment: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <Button
                            onClick={onSubmitFeedback}
                            disabled={feedbackMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {feedbackMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Envoi...
                              </>
                            ) : (
                              <>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Envoyer mon feedback
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </main>
        <Footer />
      </div>
    </PrivateRoute>
  );
}
