/** Règlement du Hub: source unique, lue par l'invite du modèle et par les messages envoyés aux membres. */
export interface Rule { id: string; title: string; description: string }

export const RULES: readonly Rule[] = [
  { id: "R1", title: "Respect", description: "Pas d'insultes, de moqueries ni d'attaques personnelles envers un membre ou l'association." },
  { id: "R2", title: "Pas de haine ni de discrimination", description: "Aucun propos haineux ou discriminatoire (origine, religion, genre, handicap, orientation, etc.)." },
  { id: "R3", title: "Pas de harcèlement ni de menaces", description: "Aucune menace, intimidation ou harcèlement répété envers un membre." },
  { id: "R4", title: "Pas de spam ni de publicité", description: "Pas de publicité non sollicitée, de messages répétés ni de liens commerciaux sans rapport avec l'association." },
  { id: "R5", title: "Données personnelles d'autrui", description: "Ne publiez ni le téléphone, ni l'adresse, ni les documents d'une autre personne sans son accord." },
  { id: "R6", title: "Pas d'arnaque ni de fraude", description: "Pas d'arnaque, de demande d'argent trompeuse ni de fausses informations dangereuses." },
  { id: "R7", title: "Pas de contenu illégal ou explicite", description: "Aucun contenu illégal ni sexuellement explicite." },
];

export const ruleById = (id: unknown): Rule | undefined => RULES.find(r => r.id === id);
