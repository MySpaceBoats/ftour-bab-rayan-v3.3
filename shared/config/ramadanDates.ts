export type RamadanRange = {
  year: number;
  startDate: string; // format YYYY-MM-DD
  endDate: string; // format YYYY-MM-DD
  isApproximate?: boolean;
  notes?: string;
};

/**
 * Source unique de vérité pour le déclenchement automatique des modules Ramadan.
 * Les dates sont estimatives (observation lunaire) et peuvent être ajustées manuellement.
 */
export const RAMADAN_DATE_RANGES: readonly RamadanRange[] = [
  {
    year: 2027,
    startDate: '2027-02-08',
    endDate: '2027-03-10',
    isApproximate: true,
    notes: 'Dates estimatives, ajustables selon l’observation lunaire locale.',
  },
  {
    year: 2028,
    startDate: '2028-01-28',
    endDate: '2028-02-27',
    isApproximate: true,
    notes: 'Dates estimatives, ajustables selon l’observation lunaire locale.',
  },
  {
    year: 2029,
    startDate: '2029-01-16',
    endDate: '2029-02-15',
    isApproximate: true,
    notes: 'Dates estimatives, ajustables selon l’observation lunaire locale.',
  },
  {
    year: 2030,
    startDate: '2030-01-06',
    endDate: '2030-02-05',
    isApproximate: true,
    notes: 'Dates estimatives, ajustables selon l’observation lunaire locale.',
  },
] as const;

export const DEFAULT_RAMADAN_DATE_TOLERANCE_DAYS = 1;
