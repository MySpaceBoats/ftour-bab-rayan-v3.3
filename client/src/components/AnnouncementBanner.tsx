import { X } from "lucide-react";
import { useState } from "react";

const BANNER_STORAGE_KEY = "banner_closed";

export default function AnnouncementBanner() {
  const [closed, setClosed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(BANNER_STORAGE_KEY) === "true";
  });

  const closeBanner = () => {
    window.localStorage.setItem(BANNER_STORAGE_KEY, "true");
    setClosed(true);
  };

  if (closed) return null;

  return (
    <div className="bg-red-700 text-white min-h-[44px] px-4 py-2.5">
      <div className="container flex items-center justify-center gap-3">
        <p className="text-center text-sm sm:text-base font-medium leading-snug">
          🔴 Information importante — Le dernier ftour de l’édition Ramadan 2026
          à Bab Rayan aura lieu le lundi 16 mars.
        </p>
        <button
          onClick={closeBanner}
          aria-label="Fermer la bannière d'information"
          className="shrink-0 rounded-sm p-1 text-white/90 transition hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
