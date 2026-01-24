import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { HelpCircle, MessageSquare, Users, Heart, ShoppingBag, Loader2 } from "lucide-react";

const defaultFaqs = [
  {
    category: "benevole",
    question: "Comment devenir bénévole ?",
    answer: "Pour devenir bénévole, rendez-vous sur la page 'Devenir bénévole', choisissez le ou les jours où vous souhaitez participer, et remplissez le formulaire d'inscription. Vous recevrez un QR code de confirmation par email."
  },
  {
    category: "benevole",
    question: "Quels sont les horaires des bénévoles ?",
    answer: "Les bénévoles sont attendus à partir de 15h pour la préparation. Le Ftour a lieu au moment du Maghreb, et le rangement se termine généralement vers 21h-22h. Vous pouvez participer à tout ou partie de ces créneaux."
  },
  {
    category: "benevole",
    question: "Puis-je m'inscrire pour plusieurs jours ?",
    answer: "Oui, vous pouvez vous inscrire pour autant de jours que vous le souhaitez. Chaque inscription génère un QR code unique pour le jour concerné."
  },
  {
    category: "benevole",
    question: "Que faire si je ne peux plus venir ?",
    answer: "Si vous ne pouvez plus venir, veuillez annuler votre inscription depuis l'email de confirmation ou contactez-nous. Cela permettra de libérer une place pour un autre bénévole."
  },
  {
    category: "don",
    question: "Comment faire un don ?",
    answer: "Vous pouvez faire une promesse de don sur notre site. Deux modes de paiement sont proposés : par virement bancaire (les coordonnées vous seront communiquées) ou sur place lors de l'événement."
  },
  {
    category: "don",
    question: "Les dons sont-ils déductibles des impôts ?",
    answer: "Bab Rayan étant une association reconnue d'utilité publique, les dons peuvent être déductibles selon la législation en vigueur. Un reçu fiscal vous sera délivré sur demande."
  },
  {
    category: "don",
    question: "À quoi servent les dons ?",
    answer: "Les dons servent à financer les repas (ingrédients, préparation), la logistique (tables, chaises, vaisselle), et le fonctionnement général de l'événement. Chaque dirham compte !"
  },
  {
    category: "goodies",
    question: "Comment commander des goodies ?",
    answer: "Parcourez notre boutique solidaire, ajoutez les articles souhaités à votre panier, et validez votre réservation. Le paiement s'effectue sur place lors du retrait."
  },
  {
    category: "goodies",
    question: "Où et quand récupérer mes goodies ?",
    answer: "Les goodies peuvent être récupérés sur le lieu de l'événement, aux horaires communiqués lors de la réservation. Présentez votre numéro de commande pour le retrait."
  },
  {
    category: "evenement",
    question: "Où se déroule l'événement ?",
    answer: "L'événement se déroule à Casablanca. L'adresse exacte est communiquée aux bénévoles inscrits et aux personnes ayant réservé des goodies."
  },
  {
    category: "evenement",
    question: "Combien de personnes sont servies chaque soir ?",
    answer: "Nous servons entre 300 et 500 personnes chaque soir du Ramadan, grâce à nos équipes de bénévoles dévoués."
  },
  {
    category: "evenement",
    question: "Qui peut bénéficier des Ftours ?",
    answer: "Les Ftours sont ouverts à toute personne dans le besoin, sans distinction. Nous accueillons principalement des personnes en situation de précarité, des sans-abri, et des familles démunies."
  },
];

export default function FAQ() {
  // Use default FAQs - can be extended with database later
  const faqs = defaultFaqs;

  const categories = [
    { id: "benevole", label: "Bénévolat", icon: Users },
    { id: "don", label: "Dons", icon: Heart },
    { id: "goodies", label: "Goodies", icon: ShoppingBag },
    { id: "evenement", label: "Événement", icon: HelpCircle },
  ];

  const getFaqsByCategory = (category: string) => {
    return faqs.filter((faq: any) => faq.category === category);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <HelpCircle className="h-4 w-4" />
                Aide
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">Questions fréquentes</h1>
              <p className="text-lg text-muted-foreground">
                Trouvez rapidement les réponses à vos questions
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-16">
          <div className="container">
            <div className="max-w-4xl mx-auto space-y-12">
              {categories.map((category) => {
                  const categoryFaqs = getFaqsByCategory(category.id);
                  if (categoryFaqs.length === 0) return null;

                  const Icon = category.icon;

                  return (
                    <div key={category.id}>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">{category.label}</h2>
                      </div>

                      <Accordion type="single" collapsible className="space-y-3">
                        {categoryFaqs.map((faq: any, index: number) => (
                          <AccordionItem 
                            key={index} 
                            value={`${category.id}-${index}`}
                            className="border rounded-lg px-4"
                          >
                            <AccordionTrigger className="text-left hover:no-underline">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  );
                })}
              </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <Card className="max-w-2xl mx-auto">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Vous n'avez pas trouvé votre réponse ?</h2>
                <p className="text-muted-foreground">
                  Notre équipe est là pour vous aider. N'hésitez pas à nous contacter.
                </p>
                <Link href="/contact">
                  <Button size="lg">
                    Nous contacter
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
