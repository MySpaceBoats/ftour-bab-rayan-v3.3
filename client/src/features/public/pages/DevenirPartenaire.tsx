import { useEffect, useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle,
  Handshake,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Loader2,
} from "lucide-react";

const pageContent = {
  fr: {
    title: "Devenir partenaire",
    description:
      "Associez votre entreprise à une action solidaire à fort impact au service des enfants et des familles.",
  },
  en: {
    title: "Become a partner",
    description:
      "Associate your company with a high-impact solidarity initiative for children and families.",
  },
  ar: {
    title: "كن شريكاً",
    description:
      "اربط شركتك بمبادرة تضامنية عالية الأثر لفائدة الأطفال والعائلات.",
  },
} as const;

export default function DevenirPartenaire() {
  const { t, lang, dir } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    partnershipType: "",
    budgetRange: "",
    message: "",
    consent: false,
  });

  const content = pageContent[lang] ?? pageContent.fr;

  useEffect(() => {
    const previousTitle = document.title;
    const description =
      "Ftour Bab Rayan - Devenir partenaire: impact social, visibilité et partenariat transparent avec l'association.";

    document.title = `Ftour Bab Rayan | ${content.title}`;

    const setMeta = (selector: string, attr: "name" | "property", key: string, value: string) => {
      let meta = document.querySelector(selector) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, key);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", value);
    };

    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", `Ftour Bab Rayan | ${content.title}`);
    setMeta('meta[property="og:description"]', "property", "og:description", description);

    return () => {
      document.title = previousTitle;
    };
  }, [content.title]);

  const partnerLeadMutation = trpc.partnerLeads.create.useMutation({
    onSuccess: () => {
      toast.success("Demande partenaire envoyée avec succès.");
      setSubmitted(true);
      setFormData({
        companyName: "",
        contactName: "",
        email: "",
        phone: "",
        city: "",
        partnershipType: "",
        budgetRange: "",
        message: "",
        consent: false,
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Une erreur est survenue lors de l'envoi.");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.consent) {
      toast.error("Veuillez accepter les conditions avant l'envoi.");
      return;
    }

    partnerLeadMutation.mutate({
      companyName: formData.companyName,
      contactName: formData.contactName,
      email: formData.email,
      phone: formData.phone || undefined,
      city: formData.city || undefined,
      partnershipType: formData.partnershipType || undefined,
      budgetRange: formData.budgetRange || undefined,
      message: formData.message || undefined,
      locale: lang,
      source: "website",
    });
  };

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <Navbar />

      <main className="flex-1 bg-[#5E5B34]">
        <section className="py-16 bg-[#4A4829]">
          <div className="container text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-[#F2E9D3]">{content.title}</h1>
            <p className="max-w-3xl mx-auto text-lg text-[#CDBB8A]">{content.description}</p>
          </div>
        </section>

        <section className="py-14">
          <div className="container">
            <h2 className="text-2xl font-bold text-[#F2E9D3] mb-6">Pourquoi devenir partenaire ?</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
                <CardHeader>
                  <CardTitle className="text-[#F2E9D3] flex items-center gap-2"><Sparkles className="h-5 w-5" /> Impact social</CardTitle>
                </CardHeader>
                <CardContent className="text-[#CDBB8A]">Contribuez directement à financer des repas et des actions concrètes pour les enfants de Bab Rayan.</CardContent>
              </Card>
              <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
                <CardHeader>
                  <CardTitle className="text-[#F2E9D3] flex items-center gap-2"><Megaphone className="h-5 w-5" /> Visibilité</CardTitle>
                </CardHeader>
                <CardContent className="text-[#CDBB8A]">Associez votre marque à une initiative reconnue et valorisez vos engagements RSE auprès de vos publics.</CardContent>
              </Card>
              <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
                <CardHeader>
                  <CardTitle className="text-[#F2E9D3] flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Transparence</CardTitle>
                </CardHeader>
                <CardContent className="text-[#CDBB8A]">Bénéficiez d'un cadre clair, d'un suivi des actions et d'une relation de partenariat pérenne.</CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="container grid lg:grid-cols-3 gap-8 items-start">
            <Card className="lg:col-span-2 bg-[#4A4829] border-[#F2E9D3]/20">
              <CardHeader>
                <CardTitle className="text-[#F2E9D3]">Formulaire de contact partenaire</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="text-[#F2E9D3]">Nom entreprise *</Label>
                      <Input id="companyName" required value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactName" className="text-[#F2E9D3]">Nom & prénom *</Label>
                      <Input id="contactName" required value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[#F2E9D3]">Email *</Label>
                      <Input id="email" type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-[#F2E9D3]">Téléphone</Label>
                      <Input id="phone" type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-[#F2E9D3]">Ville</Label>
                      <Input id="city" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#F2E9D3]">Type de partenariat</Label>
                      <Select value={formData.partnershipType} onValueChange={value => setFormData({ ...formData, partnershipType: value })}>
                        <SelectTrigger className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent className="bg-[#4A4829] border-[#F2E9D3]/20">
                          <SelectItem value="financier">Financier</SelectItem>
                          <SelectItem value="nature">En nature</SelectItem>
                          <SelectItem value="media">Média & communication</SelectItem>
                          <SelectItem value="competences">Mécénat de compétences</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#F2E9D3]">Budget estimé</Label>
                      <Select value={formData.budgetRange} onValueChange={value => setFormData({ ...formData, budgetRange: value })}>
                        <SelectTrigger className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3]"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent className="bg-[#4A4829] border-[#F2E9D3]/20">
                          <SelectItem value="<10000">Moins de 10 000 DH</SelectItem>
                          <SelectItem value="10000-50000">10 000 - 50 000 DH</SelectItem>
                          <SelectItem value="50000-100000">50 000 - 100 000 DH</SelectItem>
                          <SelectItem value=">100000">Plus de 100 000 DH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-[#F2E9D3]">Message</Label>
                    <Textarea id="message" rows={5} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} className="bg-[#5E5B34] border-[#F2E9D3]/30 text-[#F2E9D3] resize-none" />
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="consent"
                      checked={formData.consent}
                      onCheckedChange={checked => setFormData({ ...formData, consent: Boolean(checked) })}
                      className="mt-1 border-[#F2E9D3] data-[state=checked]:bg-[#F2E9D3] data-[state=checked]:text-[#4A4829]"
                    />
                    <Label htmlFor="consent" className="text-sm text-[#CDBB8A]">
                      J'accepte que mes informations soient utilisées pour être recontacté(e) au sujet d'un partenariat.
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3] font-semibold"
                    disabled={partnerLeadMutation.isPending}
                  >
                    {partnerLeadMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {t.common.loading}
                      </>
                    ) : (
                      <>
                        <Handshake className="h-5 w-5 mr-2" />
                        Envoyer la demande
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
              <CardHeader>
                <CardTitle className="text-[#F2E9D3]">FAQ Partenariats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-[#CDBB8A]">
                <div>
                  <h3 className="font-semibold text-[#F2E9D3]">Quels types de partenariats proposez-vous ?</h3>
                  <p>Financier, en nature, communication, mécénat de compétences.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-[#F2E9D3]">Quand serez-vous recontacté ?</h3>
                  <p>Notre équipe revient vers vous sous 48h ouvrées en moyenne.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-[#F2E9D3]">Puis-je adapter mon budget ?</h3>
                  <p>Oui, nous co-construisons des formats adaptés à vos objectifs.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-[#F2E9D3]">Comment suivez-vous l'impact ?</h3>
                  <p>Nous partageons des bilans et éléments de reporting selon le partenariat.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {submitted && (
          <section className="pb-10">
            <div className="container">
              <Card className="bg-emerald-900/30 border-emerald-300/30">
                <CardContent className="py-6 flex items-start gap-3 text-emerald-100">
                  <CheckCircle className="h-5 w-5 mt-1" />
                  <p>Merci ! Votre demande a bien été envoyée. Notre équipe vous contactera prochainement.</p>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        <section className="py-12 bg-[#4A4829]">
          <div className="container text-center space-y-4">
            <h2 className="text-2xl font-bold text-[#F2E9D3]">Besoin d'échanger rapidement ?</h2>
            <p className="text-[#CDBB8A]">Contactez-nous directement à <a className="underline" href="mailto:contact@ftourbabrayan.ma">contact@ftourbabrayan.ma</a> ou au <a className="underline" href="tel:+212666690534">{t.topMenu.phone}</a>.</p>
            <Link href={`/${lang}/contact`}>
              <Button className="bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]" aria-label="Nous contacter">
                Nous contacter
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
