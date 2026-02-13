/**
 * Composant boutons flottants (WhatsApp, Itinéraire, Appeler)
 * Visible sur toutes les pages, position bas-droite
 */

const WHATSAPP_NUMBER = "212664216938"; // +212 664-216938 (sans +)
const DEFAULT_MESSAGE =
  "Bonjour, j'ai une question concernant Ftour Bab Rayan.";
const MAPS_ITINERARY_URL = "https://share.google/VNwpwHz3v0g9kCpuz";

const BUTTON_BASE =
  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-2";

export default function WhatsAppFloatingButton() {
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    DEFAULT_MESSAGE
  )}`;
  const telUrl = `tel:+${WHATSAPP_NUMBER}`;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Itinéraire */}
      <a
        href={MAPS_ITINERARY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Itinéraire Google Maps"
        className={`${BUTTON_BASE} bg-[#4285F4] focus:ring-[#4285F4]`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      </a>

      {/* Appeler */}
      <a
        href={telUrl}
        aria-label="Appeler +212 664-216938"
        className={`${BUTTON_BASE} bg-[#EA4335] focus:ring-[#EA4335]`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="white"
        >
          <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.01-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.1.31.03.66-.25 1.02l-2.2 2.2z" />
        </svg>
      </a>

      {/* WhatsApp */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contacter via WhatsApp"
        className={`${BUTTON_BASE} bg-[#25D366] focus:ring-[#25D366]`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          width="28"
          height="28"
          fill="white"
        >
          <path d="M19.11 17.23c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.15-.42-2.19-1.34-.81-.72-1.36-1.6-1.52-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.54-.45-.47-.61-.48h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.84.14.18 1.93 2.95 4.68 4.13.65.28 1.16.45 1.56.58.66.21 1.26.18 1.74.11.53-.08 1.6-.65 1.83-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z" />
          <path d="M16 2.67C8.82 2.67 3 8.49 3 15.67c0 2.6.77 5.02 2.09 7.05L3 29l6.46-2.04c1.94 1.06 4.17 1.71 6.54 1.71 7.18 0 13-5.82 13-13S23.18 2.67 16 2.67zm0 23.33c-2.21 0-4.26-.61-6.02-1.66l-.43-.25-3.83 1.21 1.25-3.73-.28-.45C5.61 19.36 5 17.56 5 15.67 5 9.6 9.93 4.67 16 4.67S27 9.6 27 15.67 22.07 26 16 26z" />
        </svg>
      </a>
    </div>
  );
}
