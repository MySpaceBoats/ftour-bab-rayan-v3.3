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
import { Mail, Phone, MapPin, Send, Loader2, MessageSquare, Clock, CheckCircle } from "lucide-react";

export default function Contact() {
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
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Message envoyé !</h2>
              <p className="text-muted-foreground">
                Merci de nous avoir contactés. Nous vous répondrons dans les plus brefs délais.
              </p>
              <Button onClick={() => setSubmitted(false)} variant="outline">
                Envoyer un autre message
              </Button>
            </CardContent>
          </Card>
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
              <h1 className="text-4xl md:text-5xl font-bold">Contactez-nous</h1>
              <p className="text-lg text-muted-foreground">
                Une question ? Une suggestion ? N'hésitez pas à nous écrire.
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
                <h2 className="text-2xl font-bold">Informations de contact</h2>
                
                <Card>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Email</h3>
                        <a href="mailto:contact@babrayan.ma" className="text-muted-foreground hover:text-primary">
                          contact@babrayan.ma
                        </a>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Phone className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Téléphone</h3>
                        <a href="tel:+212610023555" className="text-muted-foreground hover:text-primary">
                          +212 610 023 555
                        </a>
                        <p className="text-xs text-muted-foreground mt-1">Direction Générale</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Adresse</h3>
                        <p className="text-muted-foreground">
                          4 rue Bayt Lham, quartier Palmier<br />Casablanca, Maroc
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Horaires</h3>
                        <p className="text-muted-foreground">
                          Lun - Ven : 9h - 18h
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex gap-3">
                      <MessageSquare className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1">Réponse rapide</h3>
                        <p className="text-sm text-muted-foreground">
                          Nous nous efforçons de répondre à tous les messages dans un délai de 24 à 48 heures.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Envoyez-nous un message</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nom complet *</Label>
                          <Input
                            id="name"
                            placeholder="Votre nom"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="votre@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Téléphone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+212 6 00 00 00 00"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">Sujet *</Label>
                          <Select
                            value={formData.subject}
                            onValueChange={(value) => setFormData({ ...formData, subject: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir un sujet" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="benevole">Bénévolat</SelectItem>
                              <SelectItem value="don">Dons</SelectItem>
                              <SelectItem value="partenariat">Partenariat</SelectItem>
                              <SelectItem value="presse">Presse / Média</SelectItem>
                              <SelectItem value="autre">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Message *</Label>
                        <Textarea
                          id="message"
                          placeholder="Votre message..."
                          rows={6}
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          required
                        />
                      </div>

                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full"
                        disabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Envoi en cours...
                          </>
                        ) : (
                          <>
                            <Send className="h-5 w-5 mr-2" />
                            Envoyer le message
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
