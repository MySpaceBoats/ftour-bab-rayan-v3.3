import { Link } from "wouter";
import { Heart, Facebook, Instagram, Linkedin, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#4A4829] text-[#F2E9D3]">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* Logo mains + cœur hachuré */}
              <div className="flex h-10 w-10 items-center justify-center">
                <svg viewBox="0 0 40 40" className="h-10 w-10">
                  <path 
                    d="M20 8c-2 0-4 1-5 3-1-2-3-3-5-3-4 0-7 3-7 7 0 8 12 16 12 16s12-8 12-16c0-4-3-7-7-7z" 
                    fill="none" 
                    stroke="#F2E9D3" 
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line x1="12" y1="14" x2="16" y2="18" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
                  <line x1="14" y1="12" x2="18" y2="16" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
                  <line x1="16" y1="14" x2="20" y2="18" stroke="#F2E9D3" strokeWidth="1" opacity="0.6"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-none" style={{ fontFamily: 'Caveat, cursive' }}>Ftour Bab Rayan</span>
                <span className="text-xs text-[#CDBB8A]" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>12e édition — 2026</span>
              </div>
            </div>
            <p className="text-sm text-[#E6DCC3] leading-relaxed">
              L'association Bab Rayan organise chaque année depuis 2015 le Ftour Bab Rayan. Cette action apporte convivialité et chaleur pendant le mois sacré du Ramadan.
            </p>
            <div className="flex gap-3">
              <a href="https://facebook.com/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#F2E9D3]/10 hover:bg-[#F2E9D3]/20 transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://instagram.com/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#F2E9D3]/10 hover:bg-[#F2E9D3]/20 transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://linkedin.com/company/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#F2E9D3]/10 hover:bg-[#F2E9D3]/20 transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-[#F2E9D3]">Liens rapides</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/evenement" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  L'événement
                </Link>
              </li>
              <li>
                <Link href="/programme" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  Programme
                </Link>
              </li>
              <li>
                <Link href="/benevole" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  Devenir bénévole
                </Link>
              </li>
              <li>
                <Link href="/goodies" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  Boutique solidaire
                </Link>
              </li>
              <li>
                <Link href="/dons" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  Faire un don
                </Link>
              </li>
            </ul>
          </div>

          {/* Association */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-[#F2E9D3]">Association</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/association" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  À propos de Bab Rayan
                </Link>
              </li>
              <li>
                <a href="https://www.babrayan.ma" target="_blank" rel="noopener noreferrer" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  Site officiel
                </a>
              </li>
              <li>
                <Link href="/faq" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-[#F2E9D3]">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#CDBB8A]" />
                <span className="text-[#E6DCC3]">4 rue Bayt Lham, quartier Palmier, Casablanca</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 flex-shrink-0 text-[#CDBB8A]" />
                <a href="tel:+212610023555" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  +212 610 023 555
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 flex-shrink-0 text-[#CDBB8A]" />
                <a href="mailto:contact@babrayan.ma" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  contact@babrayan.ma
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-[#F2E9D3]/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[#E6DCC3]">
            <p>© {currentYear} Association Bab Rayan - Reconnue d'utilité publique. Tous droits réservés.</p>
            <p className="flex items-center gap-1">
              Fait avec <Heart className="h-4 w-4 text-[#CDBB8A]" /> au Maroc
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
