import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { Mail, Phone, MapPin, Send, Loader2, MessageSquare, Clock, CheckCircle } from "lucide-react";

export default function Contact() {
  const { t, dir } = useI18n();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.contact.send.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Message envoyé avec succès !");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'envoi");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    submitMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" dir={dir}>
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20 bg-[#5E5B34]">
          <Card className="max-w-md w-full mx-4 bg-[#4A4829] border-[#F2E9D3]/20">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-[#F2E9D3]">{t.contact.submitSuccess}</h2>
              <Button onClick={() => setSubmitted(false)} variant="outline" className="border-[#F2E9D3] text-[#F2E9D3] hover:bg-[#F2E9D3] hover:text-[#4A4829]">
                {t.cta.back}
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <Navbar />
      
      <main className="flex-1 bg-[#5E5B34]">
        {/* Hero */}
        <section className="py-16 bg-[#4A4829]">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-[#F2E9D3]" style={{ fontFamily: 'Caveat, cursive' }}>{t.contact.title}</h1>
              <p className="text-lg text-[#CDBB8A]" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
                {t.contact.subtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Contact Form & Info */}
        <section className="py-16">
          <div className="container">
            <div className="grid lg:grid-cols-3 gap-12">
              {/* Contact Info */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-[#F2E9D3]">{t.contact.infoTitle}</h2>
                
                <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
                  <CardContent className="p-6 space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#5E5B34] flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-[#F2E9D3]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F2E9D3]">{t.contact.emailLabel}</h3>
                        <a href="mailto:contact@babrayan.ma" className="text-[#CDBB8A] hover:text-[#F2E9D3]">
                          contact@babrayan.ma
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#5E5B34] flex items-center justify-center flex-shrink-0">
                        <Phone className="h-5 w-5 text-[#F2E9D3]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F2E9D3]">{t.contact.phoneLabel}</h3>
                        <a href="tel:+212610023555" className="text-[#CDBB8A] hover:text-[#F2E9D3]">
                          {t.topMenu.phone}
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#5E5B34] flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-[#F2E9D3]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F2E9D3]">{t.contact.address}</h3>
                        <p className="text-[#CDBB8A]">
                          {t.contact.addressValue}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#5E5B34] flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-[#F2E9D3]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F2E9D3]">{t.contact.hoursLabel}</h3>
                        <p className="text-[#CDBB8A]">
                          {t.contact.hoursValue}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#4A4829]/50 border-[#F2E9D3]/20">
                  <CardContent className="p-6">
                    <div className="flex gap-3">
                      <MessageSquare className="h-5 w-5 text-[#F2E9D3] flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 text-[#F2E9D3]">Réponse rapide</h3>
                        <p className="text-sm text-[#CDBB8A]">
                          Nous nous efforçons de répondre à tous les messages dans un délai de 24 à 48 heures.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
                  <CardHeader>
                    <CardTitle className="text-[#F2E9D3]">{t.contact.formTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-[#F2E9D3]">{t.contact.name} *</Label>
                          <Input
                            id="name"
                            placeholder={t.contact.name}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#CDBB8A]/60"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-[#F2E9D3]">{t.contact.email} *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder={t.contact.email}
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#CDBB8A]/60"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-[#F2E9D3]">{t.contact.phone}</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+212 6 00 00 00 00"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#CDBB8A]/60"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject" className="text-[#F2E9D3]">{t.contact.subject} *</Label>
                          <Select
                            value={formData.subject}
                            onValueChange={(value) => setFormData({ ...formData, subject: value })}
                          >
                            <SelectTrigger className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]">
                              <SelectValue placeholder={t.contact.subject} />
                            </SelectTrigger>
                            <SelectContent className="bg-[#4A4829] border-[#F2E9D3]/20">
                              <SelectItem value="general" className="text-[#F2E9D3] hover:bg-[#5E5B34]">{t.contact.subjectGeneral}</SelectItem>
                              <SelectItem value="benevole" className="text-[#F2E9D3] hover:bg-[#5E5B34]">{t.contact.subjectVolunteer}</SelectItem>
                              <SelectItem value="partenariat" className="text-[#F2E9D3] hover:bg-[#5E5B34]">{t.contact.subjectPartnership}</SelectItem>
                              <SelectItem value="don" className="text-[#F2E9D3] hover:bg-[#5E5B34]">{t.contact.subjectDonation}</SelectItem>
                              <SelectItem value="autre" className="text-[#F2E9D3] hover:bg-[#5E5B34]">{t.contact.subjectOther}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message" className="text-[#F2E9D3]">{t.contact.message} *</Label>
                        <Textarea
                          id="message"
                          placeholder={t.contact.message}
                          rows={6}
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          required
                          className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3] placeholder:text-[#CDBB8A]/60 resize-none"
                        />
                      </div>

                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] font-semibold"
                        disabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            {t.common.loading}
                          </>
                        ) : (
                          <>
                            <Send className="h-5 w-5 mr-2" />
                            {t.contact.submit}
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
