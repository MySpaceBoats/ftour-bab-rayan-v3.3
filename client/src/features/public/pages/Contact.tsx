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
        <main className="flex-1 flex items-center justify-center py-20 bg-[#0F172A]">
          <Card className="max-w-md w-full mx-4 bg-[#1E293B] border-[#F8FAFC]/20">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-[#F8FAFC]">{t.contact.submitSuccess}</h2>
              <Button onClick={() => setSubmitted(false)} variant="outline" className="border-[#F8FAFC] text-[#F8FAFC] hover:bg-[#F8FAFC] hover:text-[#1E293B]">
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
      
      <main className="flex-1 bg-[#0F172A]">
        {/* Hero */}
        <section className="py-16 bg-[#1E293B]">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold text-[#F8FAFC]" style={{ fontFamily: 'Syne, Inter, sans-serif' }}>{t.contact.title}</h1>
              <p className="text-lg text-[#38BDF8]" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
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
                <h2 className="text-2xl font-bold text-[#F8FAFC]">{t.contact.infoTitle}</h2>
                
                <Card className="bg-[#1E293B] border-[#F8FAFC]/20">
                  <CardContent className="p-6 space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-[#F8FAFC]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F8FAFC]">{t.contact.emailLabel}</h3>
                        <a href="mailto:contact@ftourbabrayan.ma" className="text-[#38BDF8] hover:text-[#F8FAFC]">
                          contact@ftourbabrayan.ma
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                        <Phone className="h-5 w-5 text-[#F8FAFC]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F8FAFC]">{t.contact.phoneLabel}</h3>
                        <a href="tel:+212666690534" className="text-[#38BDF8] hover:text-[#F8FAFC]">
                          {t.topMenu.phone}
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-[#F8FAFC]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F8FAFC]">{t.contact.address}</h3>
                        <p className="text-[#38BDF8]">
                          {t.contact.addressValue}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-[#F8FAFC]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#F8FAFC]">{t.contact.hoursLabel}</h3>
                        <p className="text-[#38BDF8]">
                          {t.contact.hoursValue}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1E293B]/50 border-[#F8FAFC]/20">
                  <CardContent className="p-6">
                    <div className="flex gap-3">
                      <MessageSquare className="h-5 w-5 text-[#F8FAFC] flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1 text-[#F8FAFC]">{t.contact.quickResponse}</h3>
                        <p className="text-sm text-[#38BDF8]">
                          {t.contact.quickResponseText}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card className="bg-[#1E293B] border-[#F8FAFC]/20">
                  <CardHeader>
                    <CardTitle className="text-[#F8FAFC]">{t.contact.formTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-[#F8FAFC]">{t.contact.name} *</Label>
                          <Input
                            id="name"
                            placeholder={t.contact.name}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            className="bg-[#0F172A] border-[#F8FAFC]/30 text-[#F8FAFC] placeholder:text-[#38BDF8]/60"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-[#F8FAFC]">{t.contact.email} *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder={t.contact.email}
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            className="bg-[#0F172A] border-[#F8FAFC]/30 text-[#F8FAFC] placeholder:text-[#38BDF8]/60"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-[#F8FAFC]">{t.contact.phone}</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+212 6 00 00 00 00"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="bg-[#0F172A] border-[#F8FAFC]/30 text-[#F8FAFC] placeholder:text-[#38BDF8]/60"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject" className="text-[#F8FAFC]">{t.contact.subject} *</Label>
                          <Select
                            value={formData.subject}
                            onValueChange={(value) => setFormData({ ...formData, subject: value })}
                          >
                            <SelectTrigger className="bg-[#0F172A] border-[#F8FAFC]/30 text-[#F8FAFC]">
                              <SelectValue placeholder={t.contact.subject} />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1E293B] border-[#F8FAFC]/20">
                              <SelectItem value="general" className="text-[#F8FAFC] hover:bg-[#0F172A]">{t.contact.subjectGeneral}</SelectItem>
                              <SelectItem value="benevole" className="text-[#F8FAFC] hover:bg-[#0F172A]">{t.contact.subjectVolunteer}</SelectItem>
                              <SelectItem value="partenariat" className="text-[#F8FAFC] hover:bg-[#0F172A]">{t.contact.subjectPartnership}</SelectItem>
                              <SelectItem value="don" className="text-[#F8FAFC] hover:bg-[#0F172A]">{t.contact.subjectDonation}</SelectItem>
                              <SelectItem value="autre" className="text-[#F8FAFC] hover:bg-[#0F172A]">{t.contact.subjectOther}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message" className="text-[#F8FAFC]">{t.contact.message} *</Label>
                        <Textarea
                          id="message"
                          placeholder={t.contact.message}
                          rows={6}
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          required
                          className="bg-[#0F172A] border-[#F8FAFC]/30 text-[#F8FAFC] placeholder:text-[#38BDF8]/60 resize-none"
                        />
                      </div>

                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full bg-[#F8FAFC] text-[#1E293B] hover:bg-[#CBD5E1] font-semibold"
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

        {/* Google Maps */}
        <section className="py-12">
          <div className="container">
            <Card className="bg-[#1E293B] border-[#F8FAFC]/20 overflow-hidden">
              <CardContent className="p-0">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.965397406019!2d-7.630356723855206!3d33.58024767333852!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xda7d2be82cac4e5%3A0x4c7187e94a633b19!2sAssociation%20Bab%20Rayan!5e0!3m2!1sfr!2sma!4v1771423733450!5m2!1sfr!2sma"
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Association Bab Rayan - Google Maps"
                />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
