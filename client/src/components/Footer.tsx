import { Link } from "wouter";
import { Heart, Facebook, Instagram, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { useI18n } from "@/i18n";

export default function Footer() {
  const { t, lang } = useI18n();
  const currentYear = new Date().getFullYear();
  const isRTL = lang === 'ar';

  return (
    <footer className="bg-[#4A4829] text-[#F2E9D3]" dir={isRTL ? 'rtl' : 'ltr'}>
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
                <span className="text-xs text-[#CDBB8A]" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>{t.footer.edition}</span>
              </div>
            </div>
            <p className="text-sm text-[#E6DCC3] leading-relaxed">
              {t.footer.description}
            </p>
            <div className="flex gap-3">
              <a href="https://facebook.com/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#F2E9D3]/10 hover:bg-[#F2E9D3]/20 transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/ftourbabrayan/?hl=fr" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#F2E9D3]/10 hover:bg-[#F2E9D3]/20 transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://linkedin.com/company/babrayan" target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-[#F2E9D3]/10 hover:bg-[#F2E9D3]/20 transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-[#F2E9D3]">{t.footer.quickLinks}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${lang}/evenement`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.nav.event}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/programme`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.footer.program}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/benevole`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.nav.volunteer}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/boutique`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.footer.shop}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/dons`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.cta.donate}
                </Link>
              </li>
            </ul>
          </div>

          {/* Association */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-[#F2E9D3]">{t.footer.associationTitle}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${lang}/association`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.footer.about}
                </Link>
              </li>
              <li>
                <a href="https://www.babrayan.ma" target="_blank" rel="noopener noreferrer" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.footer.officialSite}
                </a>
              </li>
              <li>
                <Link href={`/${lang}/faq`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/contact`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.nav.contact}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/mentions-legales`} className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  {t.footer.legal}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-[#F2E9D3]">{t.nav.contact}</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#CDBB8A]" />
                <span className="text-[#E6DCC3]">{t.contact.addressValue}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 flex-shrink-0 text-[#CDBB8A]" />
                <a href="tel:+212664887978" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  +212 610 023 555
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 flex-shrink-0 text-[#CDBB8A]" />
                <a href="mailto:contact@ftourbabrayan.ma" className="text-[#E6DCC3] hover:text-[#CDBB8A] transition-colors">
                  contact@ftourbabrayan.ma
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-[#F2E9D3]/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-[#E6DCC3]">
            <p>{t.footer.copyright.replace('{year}', currentYear.toString())}</p>
            <p className="flex items-center gap-1">
              {t.footer.madeWith} <Heart className="h-4 w-4 text-[#CDBB8A]" /> {t.footer.inMorocco}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
