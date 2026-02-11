/**
 * Composant bouton WhatsApp flottant
 * Visible sur toutes les pages, position bas-droite
 * Ouvre WhatsApp avec message prérempli
 */

const WHATSAPP_NUMBER = "212664887978"; // +212 664-887978 (sans +)
const DEFAULT_MESSAGE =
  "Bonjour, j'ai une question concernant Ftour Bab Rayan.";

export default function WhatsAppFloatingButton() {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    DEFAULT_MESSAGE
  )}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contacter via WhatsApp"
      className="fixed bottom-5 right-5 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow z-50"
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
  );
}
