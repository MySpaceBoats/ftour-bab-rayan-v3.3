import { useEffect, useMemo, useState } from "react";
import { useEffect, useState, type ChangeEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera } from "lucide-react";
import PrivateRoute from "../components/PrivateRoute";
import VolunteerBadge from "../components/VolunteerBadge";
import VolunteerGalleryUploadModule from "@/features/gallery/components/VolunteerGalleryUploadModule";
import {
  getMyAttendance,
  getMyRegistrations,
  getMyRemainingDays,
  getMyVolunteerProfile,
  registerForDayFromProfile,
  updateMyVolunteerProfile,
} from "../volunteerApi";

export default function VolunteerProfilePage() {
  const profileQuery = getMyVolunteerProfile();
  const attendanceQuery = getMyAttendance(20, 0);
  const registrationsQuery = getMyRegistrations();
  const remainingDaysQuery = getMyRemainingDays();
  const updateMutation = updateMyVolunteerProfile();
  const registerMutation = registerForDayFromProfile();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
  }, [profileQuery.data]);

  useEffect(() => {
    if (!photoStorageKey) return;
    const storedPhoto = window.localStorage.getItem(photoStorageKey);
    setPhotoPreview(storedPhoto);
  }, [photoStorageKey]);

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setPhotoPreview(result);
      if (photoStorageKey) {
        window.localStorage.setItem(photoStorageKey, result);
      }
    };
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    await updateMutation.mutateAsync({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || null,
    });
  };

  const latestActiveRegistration = useMemo(() => {
    const rows = registrationsQuery.data ?? [];
    return rows.find((row) => row.status !== "cancelled");
  }, [registrationsQuery.data]);

  const qrLabel = latestActiveRegistration
    ? `Inscrit jour ${latestActiveRegistration.day_number} - ${latestActiveRegistration.date}`
    : "Aucune inscription active";

  return (
    <PrivateRoute redirectTo="/profil-benevole">
      <div className="min-h-screen flex flex-col bg-stone-50">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10 space-y-6">
          <h1 className="text-3xl font-bold text-stone-900">
            Mon profil bénévole
          </h1>

          {profileQuery.isLoading ? (
            <div className="flex items-center gap-2 text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement du
              profil...
            </div>
          ) : profileQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                Impossible de charger le profil.
              </AlertDescription>
            </Alert>
          ) : profileQuery.data ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Résumé</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xl font-semibold">
                    {profileQuery.data.first_name} {profileQuery.data.last_name}
                  </div>
                  <VolunteerBadge role={profileQuery.data.role} />
                  <p className="text-stone-700">
                    Points: {profileQuery.data.points_total} (bientôt)
                  </p>
                  <p className="text-stone-700">
                    Niveau: {profileQuery.data.level} (bientôt)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mon QR code bénévole</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latestActiveRegistration?.qr_token ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-stone-700">
                        <QrCode className="h-4 w-4" /> {qrLabel}
                      </div>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`${window.location.origin}/checkin/${latestActiveRegistration.qr_token}`)}`}
                        alt="QR code bénévole"
                        className="border rounded-lg"
                        width={240}
                        height={240}
                      />
                      <p className="text-sm text-stone-600">
                        Ce QR code devient valide pour la date sélectionnée et enregistre votre présence le jour du scan.
                      </p>
                    </>
                  ) : (
                    <p className="text-stone-600">Votre QR code sera activé dès votre première inscription à une date.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dates restantes du Ramadan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {remainingDaysQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-stone-600">
                      <Loader2 className="h-4 w-4 animate-spin" /> Chargement des jours...
                    </div>
                  ) : remainingDaysQuery.error ? (
                    <Alert variant="destructive">
                      <AlertDescription>Impossible de charger les jours restants.</AlertDescription>
                    </Alert>
                  ) : !remainingDaysQuery.data?.length ? (
                    <div className="text-stone-600">Aucun jour restant disponible.</div>
                  ) : (
                    <div className="space-y-2">
                      {remainingDaysQuery.data.map((day) => {
                        const isFull = (day.registeredCount ?? 0) >= day.capacity;
                        const disabled = !day.isOpen || isFull || day.alreadyRegistered || registerMutation.isPending;
                        return (
                          <div key={day.id} className="flex items-center justify-between border rounded-md p-3 bg-white">
                            <div>
                              <div className="font-medium">Jour {day.dayNumber} - {day.date}</div>
                              <div className="text-sm text-stone-600">
                                {day.location || "Association Bab Rayan"} • {day.iftarTime || "18h00"}
                              </div>
                            </div>
                            <Button
                              variant={day.alreadyRegistered ? "secondary" : "default"}
                              disabled={disabled}
                              onClick={async () => {
                                try {
                                  await registerMutation.mutateAsync({ dayId: day.id });
                                  toast.success("Inscription confirmée. Votre QR est activé pour ce jour.");
                                } catch (error: any) {
                                  toast.error(error?.message || "Erreur lors de l'inscription");
                                }
                              }}
                            >
                              {day.alreadyRegistered ? "Déjà inscrit" : "S'inscrire"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

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
                      <Label htmlFor="volunteer-photo">Photo de profil</Label>
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
                        Vous pouvez ajouter votre photo pour personnaliser votre
                        espace bénévole.
                      </p>
                    </div>
                  </div>
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
                        setForm(prev => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={profileQuery.data.email ?? ""} readOnly />
                  </div>
                  <Button onClick={onSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending
                      ? "Enregistrement..."
                      : "Enregistrer"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mes photos pour la galerie</CardTitle>
                </CardHeader>
                <CardContent>
                  <VolunteerGalleryUploadModule />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historique</CardTitle>
                </CardHeader>
                <CardContent>
                  {attendanceQuery.isLoading ? (
                    <div className="text-stone-600">
                      Chargement de l'historique...
                    </div>
                  ) : attendanceQuery.error ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Impossible de charger l'historique.
                      </AlertDescription>
                    </Alert>
                  ) : !attendanceQuery.data?.length ? (
                    <div className="text-stone-600">
                      Aucune participation pour le moment.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="py-2">Date</th>
                            <th className="py-2">Créneau</th>
                            <th className="py-2">Statut</th>
                            <th className="py-2">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceQuery.data.map(row => (
                            <tr
                              key={`${row.id}-${row.slot}`}
                              className="border-b"
                            >
                              <td className="py-2">{row.date}</td>
                              <td className="py-2">{row.slot}</td>
                              <td className="py-2">{row.status}</td>
                              <td className="py-2">{row.points_earned}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </main>
        <Footer />
      </div>
    </PrivateRoute>
  );
}
