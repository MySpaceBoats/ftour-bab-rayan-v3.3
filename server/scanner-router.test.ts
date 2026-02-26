import { describe, expect, it } from 'vitest';
import { detectQrType, extractTokenFromUrl } from './scanner-router';

describe('scanner token extraction', () => {
  it('extracts product token from catalog buy URL (goodie)', () => {
    expect(extractTokenFromUrl('https://ftourbabrayan.ma/fr/buy/goodie/12')).toBe('PROD-GOODIE-12');
  });

  it('extracts product token from catalog buy URL (pastry)', () => {
    expect(extractTokenFromUrl('https://ftourbabrayan.ma/fr/buy/pastry/34?utm=test')).toBe('PROD-PASTRY-34');
  });

  it('extracts product token from legacy printed pastries URL', () => {
    expect(extractTokenFromUrl('https://ftourbabrayan.ma/fr/patisserie/5')).toBe('PROD-PASTRY-5');
  });

  it('decodes qrserver image URL and extracts underlying product URL', () => {
    const wrapped = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=H&data=' + encodeURIComponent('https://ftourbabrayan.ma/fr/buy/goodie/99');
    expect(extractTokenFromUrl(wrapped)).toBe('PROD-GOODIE-99');
  });

  it('keeps checkin reservation tokens intact', () => {
    expect(extractTokenFromUrl('https://ftourbabrayan.ma/checkin-reservation/rp-ABC123')).toBe('rp-ABC123');
  });
});

describe('scanner qr type detection', () => {
  it('detects product and order tokens correctly', () => {
    expect(detectQrType('PROD-GOODIE-12')).toBe('product_goodie');
    expect(detectQrType('PROD-PASTRY-9')).toBe('product_pastry');
    expect(detectQrType('FBR-ABC-123')).toBe('goodies');
    expect(detectQrType('PASTRY-ABC-123')).toBe('pastry');
  });
});
