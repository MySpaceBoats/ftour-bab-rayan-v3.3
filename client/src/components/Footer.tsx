import { Link } from "wouter";
import { Facebook, Heart, Instagram, Linkedin, Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/i18n";

export default function Footer() {
  const { t, lang } = useI18n();
  const footerYear = 2015;
  const isRTL = lang === "ar";

  return (
    <footer
      dir={isRTL ? "rtl" : "ltr"}
      style={{ background: "#070E1A", borderTop: "1px solid rgba(248,250,252,0.06)" }}
    >
      {/* Bande supérieure — gradient décoratif */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #1E3A8A 0%, #2563EB 40%, #38BDF8 70%, #0EA5E9 100%)" }} />

      <div className="container py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="space-y-5 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)", boxShadow: "0 0 20px rgba(37,99,235,0.25)" }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <path d="M12 3C8.5 3 6 5.5 6 8.5 6 14 12 20 12 20s6-6 6-11.5C18 5.5 15.5 3 12 3z" fill="white" opacity="0.9" />
                  <path d="M9 9h6M10 12h4M11 15h2" stroke="rgba(15,23,42,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex flex-col leading-tight">
                <span
                  className="text-base font-bold text-white"
                  style={{ fontFamily: "Syne, Inter, sans-serif" }}
                >
                  Ftour Bab Rayan
                </span>
                <span
                  className="text-[10px] text-sky-400 tracking-widest uppercase"
                  style={{ fontFamily: "Cormorant Garamond, serif", fontStyle: "italic" }}
                >
                  {t.footer.edition}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              {t.footer.description}
            </p>

            <div className="flex gap-2.5">
              {[
                { href: "https://facebook.com/babrayan", Icon: Facebook, label: "Facebook" },
                { href: "https://www.instagram.com/ftourbabrayan/?hl=fr", Icon: Instagram, label: "Instagram" },
                { href: "https://linkedin.com/company/babrayan", Icon: Linkedin, label: "LinkedIn" },
              ].map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white transition-all duration-200"
                  style={{ border: "1px solid rgba(248,250,252,0.1)" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(37,99,235,0.5)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.1)";
                    (e.currentTarget as HTMLElement).style.color = "#60A5FA";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,250,252,0.1)";
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "";
                  }}
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Liens rapides */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {t.footer.quickLinks}
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: `/${lang}/evenement`, label: t.nav.event },
                { href: `/${lang}/programme`, label: t.footer.program },
                { href: `/${lang}/benevole`, label: t.nav.volunteer },
                { href: `/${lang}/boutique`, label: t.footer.shop },
                { href: `/${lang}/dons`, label: t.cta.donate },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-slate-400 hover:text-white transition-colors duration-150 flex items-center gap-1 group"
                  >
                    <span>{label}</span>
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Association */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {t.footer.associationTitle}
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: `/${lang}/association`, label: t.footer.about, external: false },
                { href: "https://www.babrayan.ma", label: t.footer.officialSite, external: true },
                { href: `/${lang}/faq`, label: "FAQ", external: false },
                { href: `/${lang}/contact`, label: t.nav.contact, external: false },
                { href: `/${lang}/mentions-legales`, label: t.footer.legal, external: false },
              ].map(({ href, label, external }) => (
                <li key={href}>
                  {external ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-400 hover:text-white transition-colors duration-150 flex items-center gap-1 group"
                    >
                      <span>{label}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="text-sm text-slate-400 hover:text-white transition-colors duration-150 flex items-center gap-1 group"
                    >
                      <span>{label}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {t.nav.contact}
            </h3>
            <ul className="space-y-3.5">
              <li className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center mt-0.5"
                  style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}
                >
                  <MapPin className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <span className="text-sm text-slate-400 leading-relaxed">{t.contact.addressValue}</span>
              </li>
              <li className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}
                >
                  <Phone className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <a
                  href="tel:+212666690534"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  +212 (0) 666-690534
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)" }}
                >
                  <Mail className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <a
                  href="mailto:contact@ftourbabrayan.ma"
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  contact@ftourbabrayan.ma
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bas de page */}
        <div
          className="mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderTop: "1px solid rgba(248,250,252,0.06)" }}
        >
          <p className="text-xs text-slate-600">
            {t.footer.copyright.replace("{year}", footerYear.toString())}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            {t.footer.madeWith}
            <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
            {t.footer.inMorocco}
          </p>
        </div>
      </div>
    </footer>
  );
}
