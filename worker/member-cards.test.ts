import { describe, expect, it } from 'vitest';
import { canAdvance, isTokenExpired } from './member-cards';

describe('member card status transitions', () => {
  it('allows forward transitions and blocks regressions', () => {
    expect(canAdvance('INSCRIT', 'MAIL_COMMANDE_ENVOYE')).toBe(true);
    expect(canAdvance('MAIL_PAIEMENT_ENVOYE', 'A_IMPRIMER')).toBe(true);
    expect(canAdvance('IMPRIMEE', 'LIVREE')).toBe(true);
    expect(canAdvance('LIVREE', 'IMPRIMEE')).toBe(false);
    expect(canAdvance('CARTE_DEMANDEE', 'INSCRIT')).toBe(false);
  });
});

describe('token expiration', () => {
  it('marks expired token', () => {
    const now = Date.now();
    expect(isTokenExpired(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isTokenExpired(new Date(now + 1000).toISOString(), now)).toBe(false);
  });
});
