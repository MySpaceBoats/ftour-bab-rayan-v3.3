export const CATEGORIES: { value: string; label: string }[] = [
  { value: "maison", label: "Maison" }, { value: "mode", label: "Mode" }, { value: "high-tech", label: "High-tech" },
  { value: "enfants", label: "Enfants" }, { value: "livres", label: "Livres" }, { value: "vehicules", label: "Véhicules" }, { value: "autre", label: "Autre" },
];
export const CONDITIONS: { value: string; label: string }[] = [{ value: "neuf", label: "Neuf" }, { value: "bon", label: "Bon état" }, { value: "correct", label: "État correct" }];
export const price = (p: number) => (p === 0 ? "Gratuit" : `${p.toLocaleString("fr-FR")} MAD`);
export const label = (list: { value: string; label: string }[], v: string) => list.find(x => x.value === v)?.label ?? v;
