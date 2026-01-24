/**
 * Module d'envoi d'emails via Resend
 * Gère les confirmations automatiques pour bénévoles, commandes et dons
 */

import { ENV } from "./_core/env";

const RESEND_API_URL = "https://api.resend.com/emails";

// Configuration de l'expéditeur
const FROM_EMAIL = "Ftour Bab Rayan <onboarding@resend.dev>"; // Domaine par défaut Resend
const REPLY_TO = "contact@babrayan.ma";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
}

interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name: string;
  };
}

/**
 * Envoie un email via l'API Resend
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        reply_to: REPLY_TO,
        cc: options.cc,
      }),
    });

    const data: ResendResponse = await response.json();

    if (!response.ok || data.error) {
      console.error("[Email] Failed to send:", data.error?.message || "Unknown error");
      return { success: false, error: data.error?.message || "Failed to send email" };
    }

    console.log("[Email] Sent successfully:", data.id);
    return { success: true, id: data.id };
  } catch (error) {
    console.error("[Email] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Vérifie que la clé API Resend est valide
 * Note: Les clés restreintes (send-only) ne peuvent pas accéder à /domains
 * On vérifie simplement que la clé est présente et a le bon format
 */
export async function verifyResendApiKey(): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    return false;
  }

  // Vérifier le format de la clé Resend (commence par re_)
  if (!apiKey.startsWith('re_')) {
    return false;
  }

  return true;
}

// ============================================
// TEMPLATES D'EMAILS
// ============================================

/**
 * Génère l'URL du QR code pour un token donné
 */
function getQrCodeUrl(token: string, baseUrl: string): string {
  const checkinUrl = `${baseUrl}/checkin/${token}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkinUrl)}`;
}

/**
 * Template de base pour tous les emails
 */
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ftour Bab Rayan</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #166534 0%, #15803d 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                Ftour <span style="color: #fbbf24;">Bab Rayan</span>
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">
                Parce que chaque enfant mérite un bon départ dans la vie
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                Association Bab Rayan
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                4 rue Bayt Lham, quartier Palmier, Casablanca<br>
                Tél: +212 610 023 555 | contact@babrayan.ma
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Email de confirmation d'inscription bénévole
 */
export interface VolunteerEmailData {
  firstName: string;
  lastName: string;
  email: string;
  dayNumber: number;
  dayDate: string;
  location: string;
  startTime: string;
  qrToken: string;
  baseUrl: string;
}

export function generateVolunteerConfirmationEmail(data: VolunteerEmailData): { subject: string; html: string } {
  const qrCodeUrl = getQrCodeUrl(data.qrToken, data.baseUrl);
  const checkinUrl = `${data.baseUrl}/checkin/${data.qrToken}`;
  
  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Merci pour votre inscription !
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.firstName} ${data.lastName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Votre inscription en tant que bénévole pour le <strong>Ftour Bab Rayan</strong> a bien été enregistrée. 
      Nous sommes ravis de vous compter parmi notre équipe !
    </p>
    
    <!-- Détails du jour -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">📅 Votre jour de participation</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Jour :</strong> ${data.dayNumber} du Ramadan</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.dayDate}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Heure :</strong> ${data.startTime}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Lieu :</strong> ${data.location}</p>
        </td>
      </tr>
    </table>
    
    <!-- QR Code -->
    <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #166534; border-radius: 8px;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">🎫 Votre QR Code d'accès</h3>
      <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; margin: 10px 0;" />
      <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
        Présentez ce QR code à l'entrée le jour de votre participation
      </p>
    </div>
    
    <!-- Consignes -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📋 Consignes importantes</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Arrivez 30 minutes avant l'heure du Ftour</li>
            <li style="margin-bottom: 8px;">Portez des vêtements confortables</li>
            <li style="margin-bottom: 8px;">Apportez votre bonne humeur et votre sourire !</li>
            <li style="margin-bottom: 8px;">En cas d'empêchement, prévenez-nous à l'avance</li>
          </ul>
        </td>
      </tr>
    </table>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Si vous avez des questions, n'hésitez pas à nous contacter.
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      À très bientôt !<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `✅ Confirmation inscription - Ftour Bab Rayan Jour ${data.dayNumber}`,
    html: baseTemplate(content),
  };
}

/**
 * Email de confirmation de commande goodies
 */
export interface OrderEmailData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  orderId: string;
  items: Array<{
    name: string;
    variant?: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  baseUrl: string;
}

export function generateOrderConfirmationEmail(data: OrderEmailData): { subject: string; html: string } {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        ${item.name}${item.variant ? ` (${item.variant})` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        ${item.price} MAD
      </td>
    </tr>
  `).join('');

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Commande confirmée !
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.firstName} ${data.lastName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Votre réservation de goodies solidaires a bien été enregistrée. 
      Merci de soutenir l'association Bab Rayan !
    </p>
    
    <!-- Référence commande -->
    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Référence de commande</p>
      <p style="margin: 5px 0 0 0; color: #166534; font-size: 24px; font-weight: bold; font-family: monospace;">
        ${data.orderId}
      </p>
    </div>
    
    <!-- Détails commande -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 10px; text-align: left; color: #374151;">Article</th>
          <th style="padding: 10px; text-align: center; color: #374151;">Qté</th>
          <th style="padding: 10px; text-align: right; color: #374151;">Prix</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
        <tr style="background-color: #f0fdf4;">
          <td colspan="2" style="padding: 15px; font-weight: bold; color: #166534;">Total</td>
          <td style="padding: 15px; text-align: right; font-weight: bold; color: #166534; font-size: 18px;">
            ${data.totalAmount} MAD
          </td>
        </tr>
      </tbody>
    </table>
    
    <!-- Instructions -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">💳 Paiement et retrait</h3>
          <p style="margin: 0 0 10px 0; color: #374151;">
            <strong>Le paiement se fait sur place</strong> lors du retrait de votre commande.
          </p>
          <p style="margin: 0; color: #374151;">
            Présentez cette confirmation et votre référence de commande pour récupérer vos articles.
          </p>
        </td>
      </tr>
    </table>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      Merci pour votre soutien !<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `🛍️ Commande ${data.orderId} confirmée - Ftour Bab Rayan`,
    html: baseTemplate(content),
  };
}

/**
 * Email de confirmation de promesse de don
 */
export interface DonationEmailData {
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
  paymentMethod: 'transfer' | 'on_site';
  donationId: string;
  baseUrl: string;
}

export function generateDonationConfirmationEmail(data: DonationEmailData): { subject: string; html: string } {
  const paymentInstructions = data.paymentMethod === 'transfer' ? `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">🏦 Coordonnées bancaires</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Banque :</strong> Attijariwafa Bank</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Titulaire :</strong> Association Bab Rayan</p>
          <p style="margin: 5px 0; color: #374151;"><strong>RIB :</strong> 007 780 0003 401 000 100 238 97</p>
          <p style="margin: 5px 0; color: #374151;"><strong>IBAN :</strong> MA64 007 780 0003 401 000 100 238 97</p>
          <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px;">
            <strong>Important :</strong> Mentionnez votre référence <strong>${data.donationId}</strong> dans le motif du virement.
          </p>
        </td>
      </tr>
    </table>
  ` : `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">📍 Don sur place</h3>
          <p style="margin: 0; color: #374151;">
            Vous avez choisi de faire votre don sur place. Présentez cette confirmation 
            lors de votre visite à l'association ou pendant un événement Ftour.
          </p>
        </td>
      </tr>
    </table>
  `;

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Merci pour votre générosité !
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.firstName} ${data.lastName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Votre promesse de don a bien été enregistrée. Votre générosité permettra 
      d'offrir des moments de partage et de solidarité aux enfants de Bab Rayan.
    </p>
    
    <!-- Montant -->
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">Montant de votre don</p>
      <p style="margin: 10px 0 0 0; color: #166534; font-size: 36px; font-weight: bold;">
        ${data.amount} MAD
      </p>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
        Référence : <strong>${data.donationId}</strong>
      </p>
    </div>
    
    ${paymentInstructions}
    
    <!-- Impact -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">💚 Où va votre don ?</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Repas Ftour pour les enfants et familles</li>
            <li style="margin-bottom: 8px;">Programmes éducatifs et de formation</li>
            <li style="margin-bottom: 8px;">Accompagnement social des familles</li>
            <li style="margin-bottom: 8px;">Activités culturelles et sportives</li>
          </ul>
        </td>
      </tr>
    </table>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      Un grand merci pour votre soutien !<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `💚 Merci pour votre don - Ftour Bab Rayan`,
    html: baseTemplate(content),
  };
}

/**
 * Email de notification pour le formulaire de contact
 */
export interface ContactEmailData {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export function generateContactNotificationEmail(data: ContactEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Nouveau message de contact
    </h2>
    
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; background-color: #f3f4f6; font-weight: bold; width: 120px;">Nom</td>
        <td style="padding: 10px; background-color: #f9fafb;">${data.name}</td>
      </tr>
      <tr>
        <td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Email</td>
        <td style="padding: 10px; background-color: #f9fafb;"><a href="mailto:${data.email}">${data.email}</a></td>
      </tr>
      ${data.phone ? `
      <tr>
        <td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Téléphone</td>
        <td style="padding: 10px; background-color: #f9fafb;">${data.phone}</td>
      </tr>
      ` : ''}
      ${data.subject ? `
      <tr>
        <td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Sujet</td>
        <td style="padding: 10px; background-color: #f9fafb;">${data.subject}</td>
      </tr>
      ` : ''}
    </table>
    
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 16px;">Message :</h3>
      <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.message}</p>
    </div>
  `;

  return {
    subject: `📬 Nouveau message de contact - ${data.name}`,
    html: baseTemplate(content),
  };
}
