import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { Heart, CreditCard, Building2, CheckCircle, Loader2, ArrowRight, HandHeart, Users, Utensils, Gift } from "lucide-react";

const suggestedAmounts = [100, 200, 500, 1000, 2000, 5000];

export default function Dons() {
  const { data: stats } = trpc.public.stats.useQuery();
  
  const [formData, setFormData] = useState({
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    amount: "",
    customAmount: "",
    paymentMethod: "transfer" as "transfer" | "on_site",
    message: "",
    isAnonymous: false,
    acceptsUpdates: false,
  });
  
  const [donationSuccess, setDonationSuccess] = useState<{
    reference: string;
    amount: string;
    paymentMethod: string;
  } | null>(null);

  const createDonationMutation = trpc.donations.create.useMutation({
    onSuccess: (data) => {
      setDonationSuccess({
        reference: data.donationReference,
        amount: formData.customAmount || formData.amount,
        paymentMethod: formData.paymentMethod,
      });
      toast.success("Promesse de don enregistrée !");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de l'enregistrement");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountStr = formData.customAmount || formData.amount;
    if (!amountStr || parseFloat(amountStr) <= 0) {
      toast.error("Veuillez entrer un montant valide");
      return;
    }

    createDonationMutation.mutate({
      donorName: formData.donorName,
      donorEmail: formData.donorEmail,
      donorPhone: formData.donorPhone || undefined,
      amount: parseFloat(amountStr),
      paymentMethod: formData.paymentMethod,
      message: formData.message || undefined,
      isAnonymous: formData.isAnonymous,
      acceptsUpdates: formData.acceptsUpdates,
    });
  };

  const selectedAmount = formData.customAmount || formData.amount;

  if (donationSuccess) {
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
                  <h1 className="text-2xl font-bold text-foreground">Merci pour votre générosité !</h1>
                  <p className="text-muted-foreground">
                    Votre promesse de don a été enregistrée avec succès
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Référence</p>
                    <p className="text-2xl font-bold font-mono text-primary">{donationSuccess.reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Montant promis</p>
                    <p className="text-xl font-bold">{donationSuccess.amount} DH</p>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 text-left space-y-3">
                  <h3 className="font-semibold">
                    {donationSuccess.paymentMethod === 'transfer' ? 'Instructions pour le virement' : 'Paiement sur place'}
                  </h3>
                  {donationSuccess.paymentMethod === 'transfer' ? (
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>Effectuez votre virement avec les informations suivantes :</p>
                      <div className="bg-white rounded p-3 space-y-1 font-mono text-xs">
                        <p><strong>Banque :</strong> Banque Populaire</p>
                        <p><strong>RIB :</strong> XXXX XXXX XXXX XXXX XXXX XXXX</p>
                        <p><strong>Libellé :</strong> DON-{donationSuccess.reference}</p>
                      </div>
                      <p className="text-xs">Un email avec ces informations vous a été envoyé.</p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>Vous pouvez effectuer votre don sur place lors d'un Ftour.</p>
                      <p>Présentez votre référence : <strong>{donationSuccess.reference}</strong></p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button onClick={() => setDonationSuccess(null)} variant="outline" className="flex-1">
                    Faire un autre don
                  </Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full">
                      Retour à l'accueil
                    </Button>
                  </Link>
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
        <section className="py-16 bg-gradient-to-b from-accent/10 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                <Heart className="h-4 w-4" />
                Soutenez notre action
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Faire un don
              </h1>
              <p className="text-lg text-muted-foreground">
                Votre générosité permet d'offrir des repas aux personnes dans le besoin pendant le Ramadan
              </p>
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section className="py-12 bg-muted/30">
          <div className="container">
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <Utensils className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold">50 DH</div>
                  <p className="text-sm text-muted-foreground">= 1 repas complet</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold">500 DH</div>
                  <p className="text-sm text-muted-foreground">= 10 repas</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <Gift className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold">1000 DH</div>
                  <p className="text-sm text-muted-foreground">= 1 journée de Ftour</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <HandHeart className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold">{stats?.receivedDonationAmount ? `${Number(stats.receivedDonationAmount).toLocaleString()}` : '0'} DH</div>
                  <p className="text-sm text-muted-foreground">collectés à ce jour</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Form Section */}
        <section className="py-12">
          <div className="container">
            <div className="max-w-2xl mx-auto">
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle>Promesse de don</CardTitle>
                  <CardDescription>
                    Enregistrez votre promesse de don et choisissez votre mode de paiement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Amount Selection */}
                    <div className="space-y-3">
                      <Label>Montant du don *</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {suggestedAmounts.map((amount) => (
                          <Button
                            key={amount}
                            type="button"
                            variant={formData.amount === amount.toString() && !formData.customAmount ? "default" : "outline"}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, amount: amount.toString(), customAmount: "" }));
                            }}
                            className="h-12"
                          >
                            {amount} DH
                          </Button>
                        ))}
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="Autre montant"
                          value={formData.customAmount}
                          onChange={(e) => setFormData(prev => ({ ...prev, customAmount: e.target.value, amount: "" }))}
                          className="pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">DH</span>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-3">
                      <Label>Mode de paiement *</Label>
                      <RadioGroup
                        value={formData.paymentMethod}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value as "transfer" | "on_site" }))}
                        className="grid md:grid-cols-2 gap-4"
                      >
                        <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'transfer' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <RadioGroupItem value="transfer" id="transfer" />
                          <Label htmlFor="transfer" className="flex items-center gap-3 cursor-pointer flex-1">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">Virement bancaire</div>
                              <div className="text-xs text-muted-foreground">RIB envoyé par email</div>
                            </div>
                          </Label>
                        </div>
                        <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'on_site' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <RadioGroupItem value="on_site" id="on_site" />
                          <Label htmlFor="on_site" className="flex items-center gap-3 cursor-pointer flex-1">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">Sur place</div>
                              <div className="text-xs text-muted-foreground">Lors d'un Ftour</div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nom complet *</Label>
                        <Input
                          id="name"
                          value={formData.donorName}
                          onChange={(e) => setFormData(prev => ({ ...prev, donorName: e.target.value }))}
                          placeholder="Votre nom"
                          required
                        />
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.donorEmail}
                            onChange={(e) => setFormData(prev => ({ ...prev, donorEmail: e.target.value }))}
                            placeholder="votre@email.com"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Téléphone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={formData.donorPhone}
                            onChange={(e) => setFormData(prev => ({ ...prev, donorPhone: e.target.value }))}
                            placeholder="+212 6XX XXX XXX"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                      <Label htmlFor="message">Message (optionnel)</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Une intention, une dédicace..."
                        rows={3}
                      />
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="anonymous"
                          checked={formData.isAnonymous}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAnonymous: checked as boolean }))}
                        />
                        <label htmlFor="anonymous" className="text-sm cursor-pointer">
                          Don anonyme (votre nom ne sera pas affiché)
                        </label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="updates"
                          checked={formData.acceptsUpdates}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptsUpdates: checked as boolean }))}
                        />
                        <label htmlFor="updates" className="text-sm cursor-pointer">
                          Je souhaite recevoir des nouvelles de l'association
                        </label>
                      </div>
                    </div>

                    {/* Summary */}
                    {selectedAmount && parseFloat(selectedAmount) > 0 && (
                      <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Votre don</span>
                          <span className="text-2xl font-bold text-primary">{selectedAmount} DH</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ≈ {Math.floor(parseFloat(selectedAmount) / 50)} repas offerts
                        </p>
                      </div>
                    )}

                    {/* Submit */}
                    <Button 
                      type="submit" 
                      className="w-full" 
                      size="lg"
                      disabled={createDonationMutation.isPending || !selectedAmount}
                    >
                      {createDonationMutation.isPending ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          <Heart className="h-5 w-5 mr-2" />
                          Confirmer ma promesse de don
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Transparency Section */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="text-2xl font-bold">Où vont vos dons ?</h2>
              <p className="text-muted-foreground">
                100% de vos dons sont utilisés pour financer les Ftours solidaires
              </p>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <Card>
                  <CardContent className="p-6 space-y-2">
                    <div className="text-3xl font-bold text-primary">70%</div>
                    <h3 className="font-semibold">Repas</h3>
                    <p className="text-sm text-muted-foreground">
                      Achat des ingrédients et préparation des repas
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 space-y-2">
                    <div className="text-3xl font-bold text-primary">20%</div>
                    <h3 className="font-semibold">Logistique</h3>
                    <p className="text-sm text-muted-foreground">
                      Transport, matériel, installation
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 space-y-2">
                    <div className="text-3xl font-bold text-primary">10%</div>
                    <h3 className="font-semibold">Organisation</h3>
                    <p className="text-sm text-muted-foreground">
                      Coordination, communication, sécurité
                    </p>
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
