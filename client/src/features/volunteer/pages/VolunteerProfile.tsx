import { useEffect, useState, type ChangeEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera } from "lucide-react";
import PrivateRoute from "../components/PrivateRoute";
import VolunteerBadge from "../components/VolunteerBadge";
import VolunteerGalleryUploadModule from "@/features/gallery/components/VolunteerGalleryUploadModule";
import {
  getMyAttendance,
  getMyVolunteerProfile,
  updateMyVolunteerProfile,
  updateMyVolunteerPassword,
} from "../volunteerApi";

export default function VolunteerProfilePage() {
  const profileQuery = getMyVolunteerProfile();
  const attendanceQuery = getMyAttendance(20, 0);
  const updateMutation = updateMyVolunteerProfile();
  const passwordMutation = updateMyVolunteerPassword();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
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

  const onPasswordSave = async () => {
    setPasswordMessage(null);
    setPasswordError(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError("Veuillez remplir tous les champs du mot de passe.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    try {
      await passwordMutation.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordMessage("Mot de passe mis à jour avec succès.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour le mot de passe."
      );
    }
  };

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
                  <CardTitle>Sécurité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-stone-600">
                    Votre mot de passe initial est votre numéro de téléphone. Vous pouvez le modifier ici.
                  </p>
                  {passwordMessage ? (
                    <Alert>
                      <AlertTitle>Succès</AlertTitle>
                      <AlertDescription>{passwordMessage}</AlertDescription>
                    </Alert>
                  ) : null}
                  {passwordError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div>
                    <Label>Mot de passe actuel</Label>
                    <Input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          currentPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Nouveau mot de passe</Label>
                    <Input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Confirmer le nouveau mot de passe</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    onClick={onPasswordSave}
                    disabled={
                      passwordMutation.isPending ||
                      !passwordForm.currentPassword ||
                      !passwordForm.newPassword ||
                      !passwordForm.confirmPassword
                    }
                  >
                    {passwordMutation.isPending
                      ? "Mise à jour..."
                      : "Changer mon mot de passe"}
                  </Button>
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
