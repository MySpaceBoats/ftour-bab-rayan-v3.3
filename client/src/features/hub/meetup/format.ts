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
  return sd === ed ? `${fmtDay(sd)}, ${st} – ${et}` : `Du ${fmtDay(sd)} ${st} au ${fmtDay(ed)} ${et}`;
}

export interface BadgeInput {
  status: string; ended: boolean; my_status: "going" | "waitlist" | null; organizer: { id: number };
}

const BADGE_CLASS = {
  neutral: "bg-slate-200 text-slate-700",
  ok: "bg-emerald-100 text-emerald-900",
  wait: "bg-amber-100 text-amber-900",
  me: "bg-blue-100 text-blue-900",
};

/** The one badge that best describes a meetup for the viewer (null = nothing to flag). */
export function statusBadge(m: BadgeInput, meId: number): { text: string; className: string } | null {
  if (m.status === "cancelled") return { text: "Annulé", className: BADGE_CLASS.neutral };
  if (m.ended) return { text: "Terminé", className: BADGE_CLASS.neutral };
  if (m.organizer.id === meId) return { text: "Organisateur", className: BADGE_CLASS.me };
  if (m.my_status === "going") return { text: "Inscrit", className: BADGE_CLASS.ok };
  if (m.my_status === "waitlist") return { text: "Liste d'attente", className: BADGE_CLASS.wait };
  return null;
}
