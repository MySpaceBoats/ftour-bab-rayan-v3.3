// ponytail: same helper as PostCard's private `ago`; extract to a shared util if a third copy appears
export const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
};

export const JOB_TYPES: { value: string; label: string }[] = [
  { value: "cdi", label: "CDI" }, { value: "cdd", label: "CDD" }, { value: "stage", label: "Stage" },
  { value: "freelance", label: "Freelance" }, { value: "benevolat", label: "Bénévolat" },
];
export const typeLabel = (v: string) => JOB_TYPES.find(t => t.value === v)?.label ?? v;
