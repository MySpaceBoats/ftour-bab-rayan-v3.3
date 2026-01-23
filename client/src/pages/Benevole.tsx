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

export default function Benevole() {
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
    acceptedTerms: false,
  });
  
  const [registrationSuccess, setRegistrationSuccess] = useState<{
    qrCode: string;
    dayInfo: { dayNumber: number; date: string };
  } | null>(null);

  const registerMutation = trpc.volunteers.register.useMutation({
    onSuccess: (data) => {
      const selectedDay = days?.find(d => d.id === parseInt(formData.dayId));
      setRegistrationSuccess({
        qrCode: data.qrCode,
        dayInfo: {
          dayNumber: selectedDay?.dayNumber || 0,
          date: selectedDay?.date ? new Date(selectedDay.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
        }
      });
      toast.success("Inscription réussie ! Vérifiez votre email.");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'inscription");
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
      toast.error("Veuillez accepter les conditions");
      return;
    }
    
    if (!formData.dayId) {
      toast.error("Veuillez sélectionner un jour");
      return;
    }

    registerMutation.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      city: formData.city || undefined,
      dayId: parseInt(formData.dayId),
      acceptedTerms: formData.acceptedTerms,
    });
  };

  const availableDays = days?.filter(d => !d.isClosed && d.currentCount < d.maxCapacity) || [];

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
                  <h1 className="text-2xl font-bold text-foreground">Inscription confirmée !</h1>
                  <p className="text-muted-foreground">
                    Merci de rejoindre notre équipe de bénévoles pour le Jour {registrationSuccess.dayInfo.dayNumber}
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Calendar className="h-5 w-5" />
                    <span className="font-medium capitalize">{registrationSuccess.dayInfo.date}</span>
                  </div>
                  
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground mb-3">Votre code QR unique :</p>
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <div className="w-48 h-48 bg-muted flex items-center justify-center rounded">
                        <QrCode className="h-24 w-24 text-muted-foreground/50" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 font-mono">
                        {registrationSuccess.qrCode}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 text-left space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Email de confirmation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Un email contenant votre QR code et les consignes vous a été envoyé. 
                    Présentez ce QR code à l'entrée le jour de votre participation.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button onClick={() => setRegistrationSuccess(null)} variant="outline" className="flex-1">
                    Nouvelle inscription
                  </Button>
                  <Button onClick={() => navigate('/programme')} className="flex-1">
                    Voir le programme
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
                Rejoignez-nous
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Devenir bénévole
              </h1>
              <p className="text-lg text-muted-foreground">
                Participez à cette belle aventure solidaire et partagez des moments uniques pendant le Ramadan
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
                      <h3 className="font-semibold">Horaires</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Arrivée 1h30 avant le Ftour. L'activité dure environ 3h au total.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">Lieu</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      L'adresse exacte vous sera communiquée par email après inscription.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <QrCode className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold">QR Code</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Vous recevrez un QR code unique à présenter à l'entrée le jour J.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <AlertCircle className="h-5 w-5" />
                      <h3 className="font-semibold">Important</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• Tenue correcte exigée</li>
                      <li>• Ponctualité requise</li>
                      <li>• Respect des consignes</li>
                      <li>• Bonne condition physique</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Registration Form */}
              <div className="lg:col-span-2">
                <Card className="border-none shadow-lg">
                  <CardHeader>
                    <CardTitle>Formulaire d'inscription</CardTitle>
                    <CardDescription>
                      Remplissez ce formulaire pour vous inscrire comme bénévole
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Day Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="day">Jour de participation *</Label>
                        <Select
                          value={formData.dayId}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, dayId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez un jour" />
                          </SelectTrigger>
                          <SelectContent>
                            {daysLoading ? (
                              <SelectItem value="loading" disabled>Chargement...</SelectItem>
                            ) : availableDays.length > 0 ? (
                              availableDays.map((day) => (
                                <SelectItem key={day.id} value={day.id.toString()}>
                                  Jour {day.dayNumber} - {new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  {' '}({day.maxCapacity - day.currentCount} places)
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>Aucun jour disponible</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Name Fields */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">Prénom *</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="Votre prénom"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Nom *</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Votre nom"
                            required
                          />
                        </div>
                      </div>

                      {/* Contact Fields */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
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
                          <Label htmlFor="phone">Téléphone *</Label>
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
                        <Label htmlFor="city">Ville (optionnel)</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Votre ville"
                        />
                      </div>

                      {/* Terms */}
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="terms"
                          checked={formData.acceptedTerms}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptedTerms: checked as boolean }))}
                        />
                        <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                          J'accepte les conditions de participation et la politique de confidentialité. 
                          Je m'engage à respecter les consignes et à être présent(e) le jour choisi.
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
                            Inscription en cours...
                          </>
                        ) : (
                          <>
                            <Users className="h-5 w-5 mr-2" />
                            S'inscrire comme bénévole
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
