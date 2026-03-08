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
import { Heart, CreditCard, Building2, CheckCircle, Loader2, ArrowRight, HandHeart, Users, Utensils, Gift, Banknote } from "lucide-react";
import { useI18n } from "@/i18n";

const suggestedAmounts = [25, 100, 200, 500, 650, 1000, 2000, 5000];

const amountLabels: Record<number, { fr: string; ar: string; en: string }> = {
  25: { fr: '1 repas', ar: 'وجبة واحدة', en: '1 meal' },
  650: { fr: '1 personne tout Ramadan', ar: 'شخص واحد طوال رمضان', en: '1 person all Ramadan' },
};

export default function Dons() {
  const { t, lang } = useI18n();
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
    paymentMethod: "transfer" | "on_site";
  } | null>(null);

  const createDonationMutation = trpc.donations.create.useMutation({
    onSuccess: (data) => {
      setDonationSuccess({
        reference: data.donationReference,
        amount: formData.customAmount || formData.amount,
        paymentMethod: formData.paymentMethod,
      });
      toast.success(t.donations.submitSuccess);
    },
    onError: (error) => {
      toast.error(error.message || t.donations.submitError);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountStr = formData.customAmount || formData.amount;
    if (!amountStr || parseFloat(amountStr) <= 0) {
      toast.error(t.donations.invalidAmount);
      return;
    }

    createDonationMutation.mutate({
      donorName: formData.donorName,
      donorEmail: formData.donorEmail,
      donorPhone: formData.donorPhone || undefined,
      amount: amountStr,
      paymentMethod: formData.paymentMethod,
      message: formData.message || undefined,
      isAnonymous: formData.isAnonymous,
      acceptsUpdates: formData.acceptsUpdates,
    });
  };

  const selectedAmount = formData.customAmount || formData.amount;

  if (donationSuccess) {
    return (
      <div className="min-h-screen flex flex-col" dir={t.dir}>
        <Navbar />
        <main className="flex-1 py-16">
          <div className="container max-w-2xl">
            <Card className="border-none shadow-lg">
              <CardContent className="p-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">{t.donations.thankYou}</h1>
                  <p className="text-muted-foreground">
                    {t.donations.promiseRegistered}
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.donations.reference}</p>
                    <p className="text-2xl font-bold font-mono text-primary">{donationSuccess.reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.donations.promisedAmount}</p>
                    <p className="text-xl font-bold">{donationSuccess.amount} DH</p>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 text-left space-y-3">
                  <h3 className="font-semibold">
                    {donationSuccess.paymentMethod === 'transfer' ? t.donations.transferInstructions : t.donations.cashPayment}
                  </h3>
                  {donationSuccess.paymentMethod === 'transfer' ? (
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>{t.donations.transferDetails}</p>
                      <div className="bg-white rounded p-3 space-y-1 font-mono text-xs">
                        <p><strong>{t.donations.bank}:</strong> Attijariwafa Bank</p>
                        <p><strong>RIB:</strong> 007 780 0003 401 000 100 238 97</p>
                        <p><strong>{t.donations.label}:</strong> DON-{donationSuccess.reference}</p>
                      </div>
                      <p className="text-xs">{t.donations.emailSent}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>{t.donations.cashDetails}</p>
                      <p>{t.donations.showReference}: <strong>{donationSuccess.reference}</strong></p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button onClick={() => setDonationSuccess(null)} variant="outline" className="flex-1">
                    {t.donations.makeAnotherDonation}
                  </Button>
                  <Link href={`/${lang}`} className="flex-1">
                    <Button className="w-full">
                      {t.goodies.backToHome}
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
    <div className="min-h-screen flex flex-col" dir={t.dir}>
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-accent/10 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium">
                <Heart className="h-4 w-4" />
                {t.donations.supportAction}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                {t.donations.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                {t.donations.subtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section className="py-12 bg-muted/30">
          <div className="container">
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border-none shadow-sm border-2 border-primary/20">
                <CardContent className="p-6 text-center">
                  <Utensils className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold text-primary">25 DH</div>
                  <p className="text-sm text-muted-foreground">= {lang === 'ar' ? 'وجبة واحدة' : lang === 'en' ? '1 meal' : '1 repas'}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold">500 DH</div>
                  <p className="text-sm text-muted-foreground">= {t.donations.tenMeals}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm border-2 border-primary/20">
                <CardContent className="p-6 text-center">
                  <HandHeart className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold text-primary">650 DH</div>
                  <p className="text-sm text-muted-foreground">= {lang === 'ar' ? 'شخص واحد طوال رمضان' : lang === 'en' ? '1 person all Ramadan' : '1 personne tout Ramadan'}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <Gift className="h-8 w-8 mx-auto text-primary mb-3" />
                  <div className="text-2xl font-bold">1000 DH</div>
                  <p className="text-sm text-muted-foreground">= {t.donations.oneDayFtour}</p>
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
                  <CardTitle>{t.donations.formTitle}</CardTitle>
                  <CardDescription>
                    {t.donations.formDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Amount Selection */}
                    <div className="space-y-3">
                      <Label>{t.donations.amount} *</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {suggestedAmounts.map((amount) => {
                          const label = amountLabels[amount];
                          const isSelected = formData.amount === amount.toString() && !formData.customAmount;
                          return (
                            <Button
                              key={amount}
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, amount: amount.toString(), customAmount: "" }));
                              }}
                              className={`h-auto py-3 flex flex-col items-center gap-0.5 ${label ? 'ring-2 ring-primary/20' : ''}`}
                            >
                              <span className="font-bold">{amount} DH</span>
                              {label && (
                                <span className={`text-[10px] leading-tight ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                  {lang === 'ar' ? label.ar : lang === 'en' ? label.en : label.fr}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder={t.donations.otherAmount}
                          value={formData.customAmount}
                          onChange={(e) => setFormData(prev => ({ ...prev, customAmount: e.target.value, amount: "" }))}
                          className="pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">DH</span>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-3">
                      <Label>{t.donations.paymentMethod} *</Label>
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
                              <div className="font-medium">{t.donations.bankTransfer}</div>
                              <div className="text-xs text-muted-foreground">{t.donations.ribByEmail}</div>
                            </div>
                          </Label>
                        </div>
                        <div className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'on_site' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <RadioGroupItem value="on_site" id="on_site" />
                          <Label htmlFor="on_site" className="flex items-center gap-3 cursor-pointer flex-1">
                            <Banknote className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{t.donations.cash}</div>
                              <div className="text-xs text-muted-foreground">{t.donations.cashDesc}</div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t.goodies.fullName} *</Label>
                        <Input
                          id="name"
                          value={formData.donorName}
                          onChange={(e) => setFormData(prev => ({ ...prev, donorName: e.target.value }))}
                          placeholder={t.donations.yourName}
                          required
                        />
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">{t.goodies.email} *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.donorEmail}
                            onChange={(e) => setFormData(prev => ({ ...prev, donorEmail: e.target.value }))}
                            placeholder={t.donations.yourEmail}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">{t.goodies.phone}</Label>
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
                      <Label htmlFor="message">{t.donations.messageOptional}</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        placeholder={t.donations.messagePlaceholder}
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
                          {t.donations.anonymousDonation}
                        </label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="updates"
                          checked={formData.acceptsUpdates}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptsUpdates: checked as boolean }))}
                        />
                        <label htmlFor="updates" className="text-sm cursor-pointer">
                          {t.donations.receiveUpdates}
                        </label>
                      </div>
                    </div>

                    {/* Submit */}
                    <Button 
                      type="submit" 
                      className="w-full h-12 text-lg"
                      disabled={createDonationMutation.isPending || !selectedAmount}
                    >
                      {createDonationMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {t.goodies.processing}
                        </>
                      ) : (
                        <>
                          {t.donations.confirmPromise}
                          {selectedAmount && ` - ${selectedAmount} DH`}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
