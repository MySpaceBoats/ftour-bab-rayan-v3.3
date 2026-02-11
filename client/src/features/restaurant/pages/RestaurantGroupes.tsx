import { useState } from 'react';
import { Link } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
// TODO: Send Email 1 (demande reçue) - no QR yet
// TODO: Update status to pending_validation in database

export default function RestaurantGroupes() {
  const { lang } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    space: 'brasserie',
    groupSize: 20,
    organization: '',
    contactName: '',
    phone: '',
    email: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.time || !formData.organization || !formData.contactName || !formData.phone || !formData.email) {
      toast.error('Merci de remplir tous les champs obligatoires');
      return;
    }
    // Status = pending_validation (not confirmed yet)
    // Email 1 sent: "demande reçue"
    // QR will be sent after admin validation (status = confirmed)
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      <Navbar />
      <main className="container py-12 max-w-3xl">
        <div className="mb-6">
          <Link href={`/${lang}/reservation`} className="text-sm text-[#5d5a3c] underline">← Retour au hub réservation</Link>
          <h1 className="text-3xl font-bold text-[#5d5a3c] mt-2">Restaurant - Groupes</h1>
          <p className="text-muted-foreground">Demande de réservation sans paiement immédiat (validation manuelle).</p>
        </div>

        {submitted ? (
          <Card>
            <CardHeader>
              <CardTitle>Demande de réservation envoyée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Merci pour votre demande.</p>
                <p className="text-sm">Notre équipe organisatrice l'étudiera dans les plus brefs délais.</p>
                <p className="text-sm">Vous recevrez une confirmation par email sous 48 heures.</p>
              </div>
              <div className="bg-[#f5f5f0] p-3 rounded border border-[#d4a574]">
                <p className="text-sm font-medium">Référence de votre demande</p>
                <p className="text-lg font-bold text-[#5d5a3c]">GRP-{Date.now().toString().slice(-6)}</p>
              </div>
              <Button onClick={() => navigate(`/${lang}`)} className="w-full">Retour à l'accueil</Button>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Informations du groupe</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} required />
                </div>
                <div>
                  <Label>Heure</Label>
                  <Input type="time" value={formData.time} onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))} required />
                </div>
                <div>
                  <Label>Espace</Label>
                  <Select value={formData.space} onValueChange={(value) => setFormData((p) => ({ ...p, space: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brasserie">Brasserie</SelectItem>
                      <SelectItem value="table-du-jardin">Table du Jardin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Taille du groupe (max 120)</Label>
                  <Input type="number" min={1} max={120} value={formData.groupSize} onChange={(e) => setFormData((p) => ({ ...p, groupSize: Math.min(120, Number(e.target.value) || 1) }))} required />
                </div>
                <div>
                  <Label>Nom du groupe / organisation</Label>
                  <Input value={formData.organization} onChange={(e) => setFormData((p) => ({ ...p, organization: e.target.value }))} required />
                </div>
                <div>
                  <Label>Nom du contact</Label>
                  <Input value={formData.contactName} onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))} required />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} required />
                </div>
                <div className="md:col-span-2">
                  <Label>Informations complémentaires</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Besoins spécifiques, contexte, etc." />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">Soumettre la demande</Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
