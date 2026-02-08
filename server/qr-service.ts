import QRCode from 'qrcode';

export interface QRCodeGenerationOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Service de génération de QR codes ISO/IEC 18004
 * Les QR codes encodent des URLs HTTPS publiques universellement scannables
 */
export class QRCodeService {
  /**
   * Génère un QR code PNG pour une URL publique
   * Conforme ISO/IEC 18004 - universellement scannable par tout appareil
   */
  static async generateQRCodePNG(
    url: string,
    options: QRCodeGenerationOptions = {}
  ): Promise<Buffer> {
    const defaultOptions = {
      errorCorrectionLevel: 'H' as const,
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      ...options,
    };

    try {
      const qrCodeDataUrl = await QRCode.toDataURL(url, defaultOptions);
      // Convertir data URL en Buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    } catch (error) {
      throw new Error(`Erreur lors de la génération du QR code PNG: ${error}`);
    }
  }

  /**
   * Génère un QR code SVG pour une URL publique
   * Format vectoriel idéal pour l'impression
   */
  static async generateQRCodeSVG(
    url: string,
    options: QRCodeGenerationOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      errorCorrectionLevel: 'H' as const,
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      ...options,
    };

    try {
      const svgString = await QRCode.toString(url, {
        ...defaultOptions,
        type: 'svg',
      });
      return svgString;
    } catch (error) {
      throw new Error(`Erreur lors de la génération du QR code SVG: ${error}`);
    }
  }

  /**
   * Génère les URLs publiques pour les QR codes
   * Chaque URL est publiquement accessible et universellement scannable
   */
  static generatePublicQRUrl(
    baseUrl: string,
    scope: 'goodie' | 'pastry' | 'donation' | 'ftour',
    reference: string
  ): string {
    // Format: https://domain.com/qr/{scope}/{reference}
    // Cette URL est publique et ouvre une page de validation
    return `${baseUrl}/qr/${scope}/${encodeURIComponent(reference)}`;
  }

  /**
   * Génère une URL pour achat express via QR
   * Utilisée pour les ventes sur place sans pré-réservation
   */
  static generateExpressBuyUrl(
    baseUrl: string,
    module: 'goodie' | 'pastry',
    productId: number
  ): string {
    return `${baseUrl}/buy/${module}/${productId}`;
  }

  /**
   * Génère une URL pour achat sur place via QR générique
   * Permet la sélection du produit et de la quantité
   */
  static generateOnSiteBuyUrl(
    baseUrl: string,
    module: 'goodie' | 'pastry'
  ): string {
    return `${baseUrl}/buy/${module}`;
  }

  /**
   * Valide un QR code en vérifiant que l'URL est valide
   */
  static validateQRUrl(url: string, baseUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.origin === new URL(baseUrl).origin;
    } catch {
      return false;
    }
  }
}

export default QRCodeService;
