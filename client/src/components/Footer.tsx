import { Link } from "wouter";
import { Heart, Facebook, Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-accent text-accent-foreground">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Heart className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-none">Ftour Bab Rayan</span>
                <span className="text-xs opacity-80">Solidarité & Partage</span>
              </div>
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              Un événement humanitaire organisé pendant le mois de Ramadan par l'association Bab Rayan pour partager des moments de solidarité et de générosité.
            </p>
            <div className="flex gap-3">
              <a href="https://facebook.com/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://instagram.com/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://youtube.com/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Liens rapides</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/evenement" className="opacity-80 hover:opacity-100 transition-opacity">
                  L'événement
                </Link>
              </li>
              <li>
                <Link href="/programme" className="opacity-80 hover:opacity-100 transition-opacity">
                  Programme
                </Link>
              </li>
              <li>
                <Link href="/benevole" className="opacity-80 hover:opacity-100 transition-opacity">
                  Devenir bénévole
                </Link>
              </li>
              <li>
                <Link href="/goodies" className="opacity-80 hover:opacity-100 transition-opacity">
                  Boutique solidaire
                </Link>
              </li>
              <li>
                <Link href="/dons" className="opacity-80 hover:opacity-100 transition-opacity">
                  Faire un don
                </Link>
              </li>
            </ul>
          </div>

          {/* Association */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Association</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/association" className="opacity-80 hover:opacity-100 transition-opacity">
                  À propos de Bab Rayan
                </Link>
              </li>
              <li>
                <Link href="/faq" className="opacity-80 hover:opacity-100 transition-opacity">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="opacity-80 hover:opacity-100 transition-opacity">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="opacity-80 hover:opacity-100 transition-opacity">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="opacity-80 hover:opacity-100 transition-opacity">
                  Politique de confidentialité
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-80" />
                <span className="opacity-80">Casablanca, Maroc</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 flex-shrink-0 opacity-80" />
                <a href="tel:+212500000000" className="opacity-80 hover:opacity-100 transition-opacity">
                  +212 5 00 00 00 00
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 flex-shrink-0 opacity-80" />
                <a href="mailto:contact@babrayan.ma" className="opacity-80 hover:opacity-100 transition-opacity">
                  contact@babrayan.ma
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm opacity-80">
            <p>© {currentYear} Association Bab Rayan. Tous droits réservés.</p>
            <p className="flex items-center gap-1">
              Fait avec <Heart className="h-4 w-4 text-red-400" /> au Maroc
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
