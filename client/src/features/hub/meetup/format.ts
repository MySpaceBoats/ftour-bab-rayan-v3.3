export const CATEGORIES: { value: string; label: string }[] = [
  { value: "sortie", label: "Sortie" },
  { value: "evenement", label: "Événement" },
  { value: "rencontre", label: "Rencontre" },
  { value: "autre", label: "Autre" },
];

export const label = (list: { value: string; label: string }[], v: string) => list.find(x => x.value === v)?.label ?? v;

const fmtDay = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Wall-clock "YYYY-MM-DDTHH:MM" strings (venue local time, no timezone): formatted as written, never converted. */
export function fmtWhen(startsAt: string, endsAt: string): string {
  const sd = startsAt.slice(0, 10), ed = endsAt.slice(0, 10);
  const st = startsAt.slice(11, 16), et = endsAt.slice(11, 16);
  return sd === ed ? `${fmtDay(sd)}, ${st} – ${et}` : `${fmtDay(sd)} ${st} → ${fmtDay(ed)} ${et}`;
}
