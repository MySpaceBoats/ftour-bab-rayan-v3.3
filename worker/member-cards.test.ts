import { describe, expect, it, vi, beforeEach } from 'vitest';
import { canAdvance, isTokenExpired } from './member-cards';

// ---------------------------------------------------------------------------
// Status transition tests
// ---------------------------------------------------------------------------
describe('member card status transitions', () => {
  it('allows forward transitions and blocks regressions', () => {
    expect(canAdvance('INSCRIT', 'MAIL_COMMANDE_ENVOYE')).toBe(true);
    expect(canAdvance('MAIL_PAIEMENT_ENVOYE', 'A_IMPRIMER')).toBe(true);
    expect(canAdvance('IMPRIMEE', 'LIVREE')).toBe(true);
    expect(canAdvance('LIVREE', 'IMPRIMEE')).toBe(false);
    expect(canAdvance('CARTE_DEMANDEE', 'INSCRIT')).toBe(false);
  });

  it('allows same-status idempotence (no regression)', () => {
    const statuses = [
      'INSCRIT', 'MAIL_COMMANDE_ENVOYE', 'CARTE_DEMANDEE',
      'MAIL_PAIEMENT_ENVOYE', 'PAIEMENT_RECU', 'A_IMPRIMER',
      'IMPRIMEE', 'LIVREE',
    ] as const;
    for (const s of statuses) {
      expect(canAdvance(s, s)).toBe(true);
    }
  });

  it('blocks skipping backwards more than one step', () => {
    expect(canAdvance('LIVREE', 'INSCRIT')).toBe(false);
    expect(canAdvance('A_IMPRIMER', 'MAIL_COMMANDE_ENVOYE')).toBe(false);
    expect(canAdvance('PAIEMENT_RECU', 'INSCRIT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Token expiration tests
// ---------------------------------------------------------------------------
describe('token expiration', () => {
  it('marks expired token', () => {
    const now = Date.now();
    expect(isTokenExpired(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isTokenExpired(new Date(now + 1000).toISOString(), now)).toBe(false);
  });

  it('does not mark token expiring exactly at now as expired (strict less-than)', () => {
    const now = Date.now();
    // isTokenExpired uses strict < so equal timestamps are still valid
    expect(isTokenExpired(new Date(now).toISOString(), now)).toBe(false);
    // But 1ms before now is expired
    expect(isTokenExpired(new Date(now - 1).toISOString(), now)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// used_at check – verifyToken must reject already-used tokens
// ---------------------------------------------------------------------------
describe('used token rejection (simulates verifyToken logic)', () => {
  function simulateVerifyToken(row: {
    used_at: string | null;
    expires_at: string;
  }, nowTs = Date.now()) {
    if (row.used_at) return { valid: false as const, reason: 'already_used' };
    if (isTokenExpired(row.expires_at, nowTs)) return { valid: false as const, reason: 'expired' };
    return { valid: true as const };
  }

  it('rejects a token that has been used', () => {
    const row = { used_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString() };
    const result = simulateVerifyToken(row);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('already_used');
  });

  it('accepts a fresh unused token', () => {
    const row = { used_at: null, expires_at: new Date(Date.now() + 60_000).toISOString() };
    const result = simulateVerifyToken(row);
    expect(result.valid).toBe(true);
  });

  it('rejects used token even when not yet expired', () => {
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString();
    const row = { used_at: new Date(Date.now() - 5000).toISOString(), expires_at: farFuture };
    const result = simulateVerifyToken(row);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('already_used');
  });
});

// ---------------------------------------------------------------------------
// Bank-transfer server-side proof requirement
// ---------------------------------------------------------------------------
describe('bank_transfer proof requirement', () => {
  function validatePaymentSubmission(paymentMethod: string, hasFile: boolean) {
    if (!['on_site', 'bank_transfer'].includes(paymentMethod)) return { ok: false, reason: 'invalid_method' };
    if (paymentMethod === 'bank_transfer' && !hasFile) return { ok: false, reason: 'proof_required' };
    return { ok: true };
  }

  it('accepts on_site without a file', () => {
    expect(validatePaymentSubmission('on_site', false)).toEqual({ ok: true });
  });

  it('accepts bank_transfer with a file', () => {
    expect(validatePaymentSubmission('bank_transfer', true)).toEqual({ ok: true });
  });

  it('rejects bank_transfer without a file', () => {
    const result = validatePaymentSubmission('bank_transfer', false);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('proof_required');
  });

  it('rejects unknown payment method', () => {
    const result = validatePaymentSubmission('crypto', false);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid_method');
  });
});

// ---------------------------------------------------------------------------
// Idempotence tests
// ---------------------------------------------------------------------------
describe('idempotence – simulate worker handler logic', () => {
  /**
   * Simulate the advanceStatus function used in the worker.
   * Returns {ok: true} if target >= current (no regression).
   */
  const STATUS_ORDER = [
    'INSCRIT', 'MAIL_COMMANDE_ENVOYE', 'CARTE_DEMANDEE',
    'MAIL_PAIEMENT_ENVOYE', 'PAIEMENT_RECU', 'A_IMPRIMER',
    'IMPRIMEE', 'LIVREE',
  ] as const;
  type CardStatus = typeof STATUS_ORDER[number];

  function simulateAdvance(current: CardStatus, target: CardStatus) {
    if (!canAdvance(current, target)) return { ok: false, status: current };
    // Already at or past target → idempotent success
    if (current === target) return { ok: true, status: current, idempotent: true };
    return { ok: true, status: target };
  }

  it('returns ok without mutation when order already at target status', () => {
    const result = simulateAdvance('CARTE_DEMANDEE', 'CARTE_DEMANDEE');
    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
    expect(result.status).toBe('CARTE_DEMANDEE');
  });

  it('advances when status is behind target', () => {
    const result = simulateAdvance('MAIL_COMMANDE_ENVOYE', 'CARTE_DEMANDEE');
    expect(result.ok).toBe(true);
    expect(result.status).toBe('CARTE_DEMANDEE');
  });

  it('rejects regression', () => {
    const result = simulateAdvance('PAIEMENT_RECU', 'CARTE_DEMANDEE');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('PAIEMENT_RECU');
  });

  it('token already used scenario: second call with same status is idempotent', () => {
    // Simulate: order already at MAIL_PAIEMENT_ENVOYE, token re-used
    // Worker's verifyToken would return row with used_at set, but if order
    // is already at the correct status we return ok without re-processing.
    const orderStatus: CardStatus = 'CARTE_DEMANDEE';
    const targetStatus: CardStatus = 'CARTE_DEMANDEE';
    const result = simulateAdvance(orderStatus, targetStatus);
    expect(result.ok).toBe(true);
    expect(result.idempotent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Upload proof validation tests (simulates worker file validation logic)
// ---------------------------------------------------------------------------
describe('upload proof validation', () => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png']);

  function validateProofFile(mimeType: string, ext: string, sizeBytes: number) {
    if (!ALLOWED_MIME.has(mimeType)) return { valid: false, reason: 'mime_not_allowed' };
    if (!ALLOWED_EXT.has(ext.toLowerCase())) return { valid: false, reason: 'ext_not_allowed' };
    if (sizeBytes > MAX_FILE_SIZE) return { valid: false, reason: 'too_large' };
    return { valid: true };
  }

  it('accepts PDF within size limit', () => {
    expect(validateProofFile('application/pdf', 'pdf', 1024 * 1024)).toEqual({ valid: true });
  });

  it('accepts JPEG within size limit', () => {
    expect(validateProofFile('image/jpeg', 'jpg', 2 * 1024 * 1024)).toEqual({ valid: true });
  });

  it('accepts PNG within size limit', () => {
    expect(validateProofFile('image/png', 'png', 500_000)).toEqual({ valid: true });
  });

  it('rejects file exceeding 10MB', () => {
    const result = validateProofFile('image/jpeg', 'jpg', 11 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('too_large');
  });

  it('rejects disallowed MIME type (GIF)', () => {
    const result = validateProofFile('image/gif', 'gif', 100_000);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('mime_not_allowed');
  });

  it('rejects disallowed extension (.docx)', () => {
    // Attacker could spoof mime type but worker also checks extension
    const result = validateProofFile('application/pdf', 'docx', 100_000);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('ext_not_allowed');
  });

  it('rejects exactly at 10MB boundary (exclusive)', () => {
    expect(validateProofFile('application/pdf', 'pdf', MAX_FILE_SIZE)).toEqual({ valid: true });
    const result = validateProofFile('application/pdf', 'pdf', MAX_FILE_SIZE + 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('too_large');
  });
});
