import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText } from "lucide-react";

export default function MentionsLegales() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-12 bg-gradient-to-b from-primary/5 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <FileText className="h-4 w-4" />
                Informations légales
              </div>
              <h1 className="text-4xl font-bold">Mentions légales</h1>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12">
          <div className="container">
            <div className="max-w-3xl mx-auto prose prose-gray">
              <h2>Éditeur du site</h2>
              <p>
                Le site Ftour Bab Rayan est édité par l'Association Bab Rayan, 
                association à but non lucratif régie par le dahir du 15 novembre 1958.
              </p>
              <ul>
                <li><strong>Raison sociale :</strong> Association Bab Rayan</li>
                <li><strong>Siège social :</strong> Casablanca, Maroc</li>
                <li><strong>Email :</strong> contact@ftourbabrayan.ma</li>
                <li><strong>Site web :</strong> www.babrayan.ma</li>
              </ul>

              <h2>Directeur de la publication</h2>
              <p>
                Le directeur de la publication est le Président de l'Association Bab Rayan.
              </p>

              <h2>Hébergement</h2>
              <p>
                Ce site est hébergé par Manus.
              </p>

              <h2>Propriété intellectuelle</h2>
              <p>
                L'ensemble du contenu de ce site (textes, images, vidéos, logos, etc.) 
                est la propriété exclusive de l'Association Bab Rayan ou de ses partenaires. 
                Toute reproduction, représentation, modification, publication, adaptation 
                de tout ou partie des éléments du site, quel que soit le moyen ou le procédé 
                utilisé, est interdite, sauf autorisation écrite préalable.
              </p>

              <h2>Protection des données personnelles</h2>
              <p>
                Conformément à la loi n° 09-08 relative à la protection des personnes physiques 
                à l'égard du traitement des données à caractère personnel, vous disposez d'un 
                droit d'accès, de rectification et de suppression des données vous concernant.
              </p>
              <p>
                Les données collectées sur ce site sont utilisées exclusivement dans le cadre 
                des activités de l'Association Bab Rayan :
              </p>
              <ul>
                <li>Gestion des inscriptions bénévoles</li>
                <li>Traitement des commandes de goodies</li>
                <li>Suivi des promesses de dons</li>
                <li>Communication relative aux événements</li>
              </ul>
              <p>
                Vos données ne sont jamais vendues ni cédées à des tiers à des fins commerciales.
              </p>
              <p>
                Pour exercer vos droits ou pour toute question relative à vos données personnelles, 
                contactez-nous à : contact@ftourbabrayan.ma
              </p>

              <h2>Cookies</h2>
              <p>
                Ce site utilise des cookies techniques nécessaires à son bon fonctionnement. 
                Ces cookies ne collectent pas de données personnelles à des fins publicitaires.
              </p>

              <h2>Liens hypertextes</h2>
              <p>
                Le site peut contenir des liens vers d'autres sites. L'Association Bab Rayan 
                n'est pas responsable du contenu de ces sites externes.
              </p>

              <h2>Limitation de responsabilité</h2>
              <p>
                L'Association Bab Rayan s'efforce d'assurer l'exactitude des informations 
                diffusées sur ce site. Toutefois, elle ne peut garantir l'exactitude, la 
                précision ou l'exhaustivité des informations mises à disposition.
              </p>
              <p>
                L'Association Bab Rayan décline toute responsabilité pour toute imprécision, 
                inexactitude ou omission portant sur des informations disponibles sur ce site.
              </p>

              <h2>Droit applicable</h2>
              <p>
                Les présentes mentions légales sont régies par le droit marocain. 
                En cas de litige, les tribunaux marocains seront seuls compétents.
              </p>

              <h2>Contact</h2>
              <p>
                Pour toute question concernant ces mentions légales, vous pouvez nous contacter :
              </p>
              <ul>
                <li>Par email : contact@ftourbabrayan.ma</li>
                <li>Via le formulaire de contact du site</li>
              </ul>

              <p className="text-sm text-muted-foreground mt-8">
                Dernière mise à jour : Janvier
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
