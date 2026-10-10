export const KINDS: { value: string; label: string }[] = [
  { value: "chambre", label: "Chambre" },
  { value: "studio", label: "Studio" },
  { value: "appartement", label: "Appartement" },
  { value: "maison", label: "Maison" },
  { value: "canape", label: "Canapé / lit d'appoint" },
  { value: "tente", label: "Emplacement / tente" },
];

export const PRICE_TYPES: { value: string; label: string }[] = [
  { value: "gratuit", label: "Gratuit" },
  { value: "participation", label: "Participation libre" },
  { value: "prix", label: "Prix par nuit" },
];

export const AMENITIES: { value: string; label: string }[] = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "cuisine", label: "Cuisine" },
  { value: "salle_de_bain", label: "Salle de bain" },
  { value: "chauffage", label: "Chauffage" },
  { value: "clim", label: "Climatisation" },
  { value: "parking", label: "Parking" },
  { value: "lessive", label: "Lave-linge" },
  { value: "animaux_ok", label: "Animaux acceptés" },
  { value: "famille_ok", label: "Familles bienvenues" },
  { value: "accessible", label: "Accès PMR" },
];

export const REQUEST_STATUS: { value: string; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "accepted", label: "Acceptée" },
  { value: "declined", label: "Refusée" },
  { value: "cancelled", label: "Annulée" },
];

export const label = (list: { value: string; label: string }[], v: string) => list.find(x => x.value === v)?.label ?? v;

const mad = (n: number) => `${n.toLocaleString("fr-FR")} MAD`;

/** "Gratuit" / "Participation ~ 50 MAD / nuit" / "200 MAD / nuit". */
export const priceLabel = (type: string, price: number) =>
  type === "gratuit" ? "Gratuit" : type === "participation" ? `Participation ~ ${mad(price)} / nuit` : `${mad(price)} / nuit`;

/** ISO date (YYYY-MM-DD) → "1 nov. 2026". */
export const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Human wording for a listing's availability window (either bound may be open). */
export const availabilityLabel = (from: string | null, to: string | null) =>
  from && to ? `Du ${fmtDate(from)} au ${fmtDate(to)}` : from ? `À partir du ${fmtDate(from)}` : to ? `Jusqu'au ${fmtDate(to)}` : "Dates libres";

export const todayIso = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Casablanca" }).format(new Date());

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const nights = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
