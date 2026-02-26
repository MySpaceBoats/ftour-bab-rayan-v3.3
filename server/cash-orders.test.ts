import { describe, expect, it } from 'vitest';
import { __internal } from '../worker/cash-orders';

describe('cash order internals', () => {
  it('builds a BR reference date and random suffix shape helpers', () => {
    const date = __internal.toYyyymmdd(new Date('2026-03-01T10:00:00Z'));
    expect(date).toBe('20260301');
    const suffix = __internal.randomSuffix(6);
    expect(suffix).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('creates deterministic proof token length', async () => {
    const t1 = await __internal.buildProofToken('secret', 'BR-20260301-ABC123', '2026-03-01T10:00:00.000Z');
    const t2 = await __internal.buildProofToken('secret', 'BR-20260301-ABC123', '2026-03-01T10:00:00.000Z');
    expect(t1).toHaveLength(24);
    expect(t1).toBe(t2);
  });
});
