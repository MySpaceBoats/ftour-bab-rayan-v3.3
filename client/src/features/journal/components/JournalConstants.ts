// ============================================
// JOURNAL MODULE — Shared constants & helpers
// ============================================

export const JOURNAL_TYPE_LABELS: Record<string, string> = {
  observation: "Observation",
  problem: "Problème",
  solution: "Solution",
  idea: "Idée",
  decision: "Décision",
};

export const JOURNAL_CATEGORY_LABELS: Record<string, string> = {
  logistics: "Logistique",
  volunteers: "Bénévoles",
  communication: "Communication",
  food: "Nourriture",
  participant_experience: "Expérience Participants",
  technical: "Technique",
};

export const JOURNAL_IMPORTANCE_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

export const JOURNAL_TYPE_COLORS: Record<string, string> = {
  observation: "bg-blue-100 text-blue-800 border-blue-200",
  problem: "bg-red-100 text-red-800 border-red-200",
  solution: "bg-green-100 text-green-800 border-green-200",
  idea: "bg-purple-100 text-purple-800 border-purple-200",
  decision: "bg-orange-100 text-orange-800 border-orange-200",
};

export const JOURNAL_IMPORTANCE_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 border-gray-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

export const JOURNAL_IMPORTANCE_DOT: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-yellow-400",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export const JOURNAL_TYPES = ["observation", "problem", "solution", "idea", "decision"] as const;
export const JOURNAL_CATEGORIES = [
  "logistics", "volunteers", "communication", "food", "participant_experience", "technical",
] as const;
export const JOURNAL_IMPORTANCE_LEVELS = ["low", "medium", "high", "critical"] as const;
