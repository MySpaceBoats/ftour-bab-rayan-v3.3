import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Génère un token sécurisé de 128 bits (32 caractères hexadécimaux)
 * Conforme aux bonnes pratiques de sécurité : aléatoire, non séquentiel, non devinable
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(16).toString('hex'); // 128 bits = 16 bytes = 32 hex chars
}

/**
 * Construit l'URL de check-in pour un token donné
 * Format: https://{domain}/checkin/{token}
 */
export function buildCheckinUrl(token: string, baseUrl?: string): string {
  // En production, utiliser le domaine réel
  const domain = baseUrl || process.env.VITE_APP_URL || 'https://ftourbabrayan.ma';
  return `${domain}/checkin/${token}`;
}

/**
 * Options de génération du QR code
 * Conforme au standard ISO/IEC 18004 (QR Code Model 2)
 */
interface QRCodeOptions {
  /** Niveau de correction d'erreur: L (7%), M (15%), Q (25%), H (30%) */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** Taille du QR code en pixels */
  width?: number;
  /** Marge autour du QR code (en modules) */
  margin?: number;
  /** Couleur sombre (foreground) */
  darkColor?: string;
  /** Couleur claire (background) */
  lightColor?: string;
}

const defaultOptions: QRCodeOptions = {
  errorCorrectionLevel: 'Q', // Niveau Q recommandé pour une bonne lisibilité
  width: 300,
  margin: 2,
  darkColor: '#000000',
  lightColor: '#FFFFFF',
};

/**
 * Génère un QR code au format PNG (base64 data URL)
 * Le QR code encode uniquement l'URL de check-in
 * Scannable par n'importe quelle application de scan QR standard
 */
export async function generateQRCodePNG(
  token: string,
  baseUrl?: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const url = buildCheckinUrl(token, baseUrl);
  const opts = { ...defaultOptions, ...options };
  
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: opts.errorCorrectionLevel,
    width: opts.width,
    margin: opts.margin,
    color: {
      dark: opts.darkColor,
      light: opts.lightColor,
    },
  });
  
  return qrDataUrl;
}

/**
 * Génère un QR code au format SVG (string)
 * Idéal pour l'impression haute qualité
 */
export async function generateQRCodeSVG(
  token: string,
  baseUrl?: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const url = buildCheckinUrl(token, baseUrl);
  const opts = { ...defaultOptions, ...options };
  
  const svgString = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: opts.errorCorrectionLevel,
    width: opts.width,
    margin: opts.margin,
    color: {
      dark: opts.darkColor,
      light: opts.lightColor,
    },
  });
  
  return svgString;
}

/**
 * Génère un QR code au format Buffer (PNG)
 * Utile pour l'envoi par email ou le stockage
 */
export async function generateQRCodeBuffer(
  token: string,
  baseUrl?: string,
  options: QRCodeOptions = {}
): Promise<Buffer> {
  const url = buildCheckinUrl(token, baseUrl);
  const opts = { ...defaultOptions, ...options };
  
  const buffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: opts.errorCorrectionLevel,
    width: opts.width,
    margin: opts.margin,
    color: {
      dark: opts.darkColor,
      light: opts.lightColor,
    },
  });
  
  return buffer;
}

/**
 * Valide qu'un token a le bon format (32 caractères hexadécimaux)
 */
export function isValidToken(token: string): boolean {
  return /^[a-f0-9]{32}$/i.test(token);
}
