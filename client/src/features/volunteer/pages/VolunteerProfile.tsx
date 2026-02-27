import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import PrivateRoute from "../components/PrivateRoute";
import VolunteerBadge from "../components/VolunteerBadge";
import {
  getMyAttendance,
  getMyVolunteerProfile,
  updateMyVolunteerProfile,
} from "../volunteerApi";

export default function VolunteerProfilePage() {
  const profileQuery = getMyVolunteerProfile();
  const attendanceQuery = getMyAttendance(20, 0);
  const updateMutation = updateMyVolunteerProfile();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm({
      first_name: profileQuery.data.first_name,
      last_name: profileQuery.data.last_name,
      phone: profileQuery.data.phone ?? "",
    });
  }, [profileQuery.data]);

  const onSave = async () => {
    await updateMutation.mutateAsync({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone || null,
    });
  };

  return (
    <PrivateRoute redirectTo="/profil-benevole">
      <div className="min-h-screen flex flex-col bg-stone-50">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10 space-y-6">
          <h1 className="text-3xl font-bold text-stone-900">Mon profil bénévole</h1>

          {profileQuery.isLoading ? (
            <div className="flex items-center gap-2 text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement du profil...
            </div>
          ) : profileQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>Impossible de charger le profil.</AlertDescription>
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
                  <p className="text-stone-700">Points: {profileQuery.data.points_total} (bientôt)</p>
                  <p className="text-stone-700">Niveau: {profileQuery.data.level} (bientôt)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mes informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Prénom</Label>
                    <Input
                      value={form.first_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input
                      value={form.last_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={profileQuery.data.email ?? ""} readOnly />
                  </div>
                  <Button onClick={onSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historique</CardTitle>
                </CardHeader>
                <CardContent>
                  {attendanceQuery.isLoading ? (
                    <div className="text-stone-600">Chargement de l'historique...</div>
                  ) : attendanceQuery.error ? (
                    <Alert variant="destructive">
                      <AlertDescription>Impossible de charger l'historique.</AlertDescription>
                    </Alert>
                  ) : !attendanceQuery.data?.length ? (
                    <div className="text-stone-600">Aucune participation pour le moment.</div>
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
                          {attendanceQuery.data.map((row) => (
                            <tr key={`${row.id}-${row.slot}`} className="border-b">
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
