/**
 * Module d'envoi d'emails via Resend
 * Gère les confirmations automatiques pour bénévoles, commandes et dons
 */

import { ENV } from "./_core/env";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Calcule les horaires des créneaux bénévoles à partir de l'heure d'iftar.
 * Préparation : iftarTime - 3h → iftarTime - 15min
 * Service : iftarTime → iftarTime + 1h30
 */
function computeSlotTimes(iftarTimeStr: string): { prepStart: string; prepEnd: string; serviceStart: string; serviceEnd: string } {
  const match = iftarTimeStr.match(/(\d{1,2})[h:](\d{2})/);
  if (!match) {
    return { prepStart: '15:00', prepEnd: '17:45', serviceStart: '18:00', serviceEnd: '19:30' };
  }
  const iftarHour = parseInt(match[1]);
  const iftarMin = parseInt(match[2]);
  const iftarTotalMin = iftarHour * 60 + iftarMin;

  const formatTime = (totalMin: number) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return {
    prepStart: formatTime(iftarTotalMin - 180),
    prepEnd: formatTime(iftarTotalMin - 15),
    serviceStart: formatTime(iftarTotalMin),
    serviceEnd: formatTime(iftarTotalMin + 90),
  };
}

// Configuration de l'expéditeur
const FROM_EMAIL = "Ftour Bab Rayan <noreply@ftourbabrayan.ma>"; // Domaine vérifié Resend
const REPLY_TO = "contact@ftourbabrayan.ma"; // Stackmail pour réception

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
  }>;
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
  
  console.log("[Email] Attempting to send email to:", options.to);
  console.log("[Email] API Key present:", !!apiKey, apiKey ? `(${apiKey.substring(0, 10)}...)` : '');
  
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "API key not configured" };
  }

  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: options.to,
    subject: options.subject,
    html: options.html,
    reply_to: REPLY_TO,
    cc: options.cc,
    bcc: options.bcc || ['rsebbani@myspace.boats'],
  };
  if (options.attachments && options.attachments.length > 0) {
    payload.attachments = options.attachments;
  }
  
  console.log("[Email] Sending with from:", FROM_EMAIL);
  console.log("[Email] Subject:", options.subject);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("[Email] Response status:", response.status, response.statusText);
    
    const responseText = await response.text();
    console.log("[Email] Response body:", responseText);
    
    let data: ResendResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("[Email] Failed to parse response as JSON:", responseText);
      return { success: false, error: `Invalid response: ${responseText}` };
    }

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

function getReservationQrCodeUrl(token: string, baseUrl: string): string {
  const checkinUrl = `${baseUrl}/checkin-reservation/${token}`;
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
                4 rue Bayt Lahm, quartier Palmier, Casablanca<br>
                Tél: +212 610 023 555 | contact@ftourbabrayan.ma
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
  volunteerSlots?: string[];
  qrToken: string;
  baseUrl: string;
}

export function generateVolunteerConfirmationEmail(data: VolunteerEmailData): { subject: string; html: string } {
  const qrCodeUrl = getQrCodeUrl(data.qrToken, data.baseUrl);
  const checkinUrl = `${data.baseUrl}/checkin/${data.qrToken}`;

  // Build slots display with dynamic times based on iftar time
  const times = computeSlotTimes(data.startTime);
  const slotLabels: Record<string, string> = {
    preparation_ftour: `Préparation ftour (${times.prepStart} – ${times.prepEnd})`,
    service_ftour: `Service ftour (${times.serviceStart} – ${times.serviceEnd})`,
  };
  const slotsHtml = (data.volunteerSlots || []).map(s =>
    `<li style="margin-bottom: 4px;">${slotLabels[s] || s}</li>`
  ).join('');

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
          <p style="margin: 5px 0; color: #374151;"><strong>Lieu :</strong> ${data.location}</p>
        </td>
      </tr>
    </table>

    <!-- Créneaux choisis -->
    ${slotsHtml ? `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px;">🕐 Vos créneaux choisis</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 15px;">${slotsHtml}</ul>
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- QR Code -->
    <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #166534; border-radius: 8px;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">🎫 Votre QR Code d'accès</h3>
      <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; margin: 10px 0;" />
      <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
        Présentez ce QR code à l'entrée le jour de votre participation
      </p>
    </div>

    <!-- Consignes importantes (obligatoires) -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📋 Consignes importantes</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Arrivez à l'heure prévu par le créneau choisi.</li>
            <li style="margin-bottom: 8px;">En cas d'empêchement, prévenez-nous à l'avance</li>
            <li style="margin-bottom: 8px;">Portez des vêtements confortables</li>
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


// ============================================
// EMAILS POUR RÉSERVATIONS RESTAURANT
// ============================================

/**
 * Email 1 : Demande de réservation reçue (SANS QR CODE)
 * Envoyé immédiatement après soumission du formulaire
 */
export interface ReservationRequestEmailData {
  firstName: string;
  email: string;
  reservationType: 'particulier' | 'groupe' | 'entreprise';
  date: string;
  time: string;
  participantsCount: number;
  reference: string;
}

export function generateReservationRequestEmail(data: ReservationRequestEmailData): { subject: string; html: string } {
  const typeLabel = {
    particulier: 'Réservation particulier',
    groupe: 'Réservation groupe',
    entreprise: 'Réservation entreprise',
  }[data.reservationType];

  const content = `
    <h2 style="color: #5d5a3c; margin: 0 0 20px 0; font-size: 24px;">
      Demande de réservation reçue ✅
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.firstName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Merci pour votre demande de réservation. Nous avons bien reçu votre demande et notre équipe organisatrice l'étudiera dans les plus brefs délais.
    </p>
    
    <!-- Détails de la demande -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #5d5a3c; margin: 0 0 15px 0; font-size: 18px;">📋 Détails de votre demande</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Type :</strong> ${typeLabel}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.date}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Nombre de participants :</strong> ${data.participantsCount}</p>
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Référence :</strong> ${data.reference}</p>
        </td>
      </tr>
    </table>

    <!-- Prochaines étapes -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">⏱️ Prochaines étapes</h3>
          <p style="margin: 0; color: #374151; line-height: 1.6;">
            Vous recevrez une confirmation par email sous <strong>48 heures</strong> avec les détails finaux et votre QR code d'accès.
          </p>
        </td>
      </tr>
    </table>

    <!-- Conditions de réservation -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #9a3412; margin: 0 0 15px 0; font-size: 18px;">⚠️ Conditions de réservation</h3>
          <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            <strong>Le nombre de personnes réservées sera facturé dans sa totalité, même en cas d'absence ou de modification le jour même.</strong>
          </p>
          <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Afin de confirmer votre réservation à Table du Jardin, nous vous remercions de bien vouloir verser <strong>50 % du montant</strong> à l'avance.
          </p>
        </td>
      </tr>
    </table>

    <!-- RIB -->
    <div style="text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #374151; font-size: 14px;"><strong>RIB :</strong> 007 780 0003 401 000 100 238 97<br/><strong>IBAN :</strong> MA64 007 780 0003 401 000 100 238 97</p>
    </div>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Merci pour votre soutien à notre restaurant solidaire 💚
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      À très bientôt.<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `✅ Demande de réservation reçue - Référence ${data.reference}`,
    html: baseTemplate(content),
  };
}

/**
 * Email 2 : Réservation confirmée (AVEC QR CODE)
 * Envoyé après validation par l'admin
 */
export interface ReservationConfirmationEmailData {
  firstName: string;
  email: string;
  reservationType: 'particulier' | 'groupe' | 'entreprise';
  date: string;
  time: string;
  participantsCount: number;
  reference: string;
  qrToken: string;
  baseUrl: string;
  space: string;
}

export function generateReservationConfirmationEmail(data: ReservationConfirmationEmailData): { subject: string; html: string } {
  const qrCodeUrl = getReservationQrCodeUrl(data.qrToken, data.baseUrl);
  const checkinUrl = `${data.baseUrl}/checkin-reservation/${data.qrToken}`;

  const content = `
    <h2 style="color: #5d5a3c; margin: 0 0 20px 0; font-size: 24px;">
      Votre réservation est confirmée ✅
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.firstName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Excellente nouvelle ! Votre réservation au Restaurant Solidaire a été confirmée. Nous vous attendons avec impatience !
    </p>
    
    <!-- Détails de la réservation -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #5d5a3c; margin: 0 0 15px 0; font-size: 18px;">📋 Détails de votre réservation</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Espace :</strong> ${data.space}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.date}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Nombre de participants :</strong> ${data.participantsCount}</p>
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Référence :</strong> ${data.reference}</p>
        </td>
      </tr>
    </table>

    <!-- QR Code -->
    <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #d4a574; border-radius: 8px;">
      <h3 style="color: #5d5a3c; margin: 0 0 15px 0; font-size: 18px;">🎫 Votre QR Code d'accès</h3>
      <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; margin: 10px 0;" />
      <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
        Présentez ce QR code à l'entrée le jour de votre visite
      </p>
    </div>
    
    <!-- Consignes -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📋 Consignes importantes</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Arrivez 15 minutes avant l'heure de votre réservation</li>
            <li style="margin-bottom: 8px;">Présentez votre QR code à l'entrée</li>
            <li style="margin-bottom: 8px;">En cas d'annulation, prévenez-nous au moins 24h à l'avance</li>
          </ul>
        </td>
      </tr>
    </table>

    <!-- Conditions de réservation -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #9a3412; margin: 0 0 15px 0; font-size: 18px;">⚠️ Conditions de réservation</h3>
          <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            <strong>Le nombre de personnes réservées sera facturé dans sa totalité, même en cas d'absence ou de modification le jour même.</strong>
          </p>
          <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Afin de confirmer votre réservation à Table du Jardin, nous vous remercions de bien vouloir verser <strong>50 % du montant</strong> à l'avance.
          </p>
        </td>
      </tr>
    </table>

    <!-- RIB -->
    <div style="text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #374151; font-size: 14px;"><strong>RIB :</strong> 007 780 0003 401 000 100 238 97<br/><strong>IBAN :</strong> MA64 007 780 0003 401 000 100 238 97</p>
    </div>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Merci pour votre soutien à notre restaurant solidaire 💚
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      À très bientôt.<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `✅ Réservation confirmée - ${data.date} à ${data.time}`,
    html: baseTemplate(content),
  };
}


// ============================================
// EMAILS TRANSACTIONNELS - MODULE PARTICULIERS
// ============================================

/**
 * Email 1 : Demande reçue (SANS QR)
 * Envoyé automatiquement à la soumission
 */
export interface ParticulierReservationRequestEmailData {
  firstName: string;
  email: string;
  date: string;
  participantsCount: number;
  reference: string;
  displayChoice?: string;
}

export function generateParticulierReservationRequestEmail(data: ParticulierReservationRequestEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #5d5a3c; margin: 0 0 20px 0; font-size: 24px;">
      Votre demande de réservation a bien été reçue
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Bonjour <strong>${data.firstName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous avons bien reçu votre demande de réservation pour le ftour solidaire du <strong>${data.date}</strong>.
    </p>
    
    <!-- Détails de la demande -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #5d5a3c; margin: 0 0 15px 0; font-size: 18px;">📋 Détails de votre demande</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.date}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Nombre de places :</strong> ${data.participantsCount}</p>
          ${data.displayChoice ? `<p style="margin: 5px 0; color: #374151;"><strong>Salle :</strong> ${data.displayChoice}</p>` : ''}
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Référence :</strong> ${data.reference}</p>
        </td>
      </tr>
    </table>
    
    <!-- Message important -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e0f2fe; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0; color: #0369a1; font-size: 16px;">
            <strong>⏳ Notre équipe étudiera votre demande et vous confirmera la disponibilité sous 48 heures.</strong>
          </p>
        </td>
      </tr>
    </table>

    <!-- Conditions de réservation -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #9a3412; margin: 0 0 15px 0; font-size: 18px;">⚠️ Conditions de réservation</h3>
          <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            <strong>Le nombre de personnes réservées sera facturé dans sa totalité, même en cas d'absence ou de modification le jour même.</strong>
          </p>
          <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Afin de confirmer votre réservation à Table du Jardin, nous vous remercions de bien vouloir verser <strong>50 % du montant</strong> à l'avance.
          </p>
        </td>
      </tr>
    </table>

    <!-- RIB -->
    <div style="text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #374151; font-size: 14px;"><strong>RIB :</strong> 007 780 0003 401 000 100 238 97<br/><strong>IBAN :</strong> MA64 007 780 0003 401 000 100 238 97</p>
    </div>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Merci pour votre soutien à notre restaurant solidaire 💚
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      À très bientôt.<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `📬 Votre demande de réservation a bien été reçue`,
    html: baseTemplate(content),
  };
}

/**
 * Email 2 : Réservation confirmée + QR CODE
 * Envoyé après validation admin
 */
export interface ParticulierReservationConfirmedEmailData {
  firstName: string;
  email: string;
  date: string;
  participantsCount: number;
  reference: string;
  qrToken: string;
  baseUrl: string;
}

export function generateParticulierReservationConfirmedEmail(data: ParticulierReservationConfirmedEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #5d5a3c; margin: 0 0 20px 0; font-size: 24px;">
      Votre réservation est confirmée ✅
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Bonjour <strong>${data.firstName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Excellente nouvelle ! Votre demande de réservation pour le <strong>${data.date}</strong> a été validée.
    </p>
    
    <!-- Détails de la réservation -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #5d5a3c; margin: 0 0 15px 0; font-size: 18px;">📋 Détails de votre réservation</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.date}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Nombre de places confirmées :</strong> ${data.participantsCount}</p>
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Référence :</strong> ${data.reference}</p>
        </td>
      </tr>
    </table>
    
    <!-- QR Code -->
    <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #d4a574; border-radius: 8px;">
      <h3 style="color: #5d5a3c; margin: 0 0 15px 0; font-size: 18px;">🎛 Votre QR Code d'accès</h3>
      <img src="${getReservationQrCodeUrl(data.qrToken, data.baseUrl)}" alt="QR Code" style="width: 200px; height: 200px; margin: 10px 0;" />
      <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
        Présentez ce QR code à l'entrée le jour de votre visite
      </p>
    </div>

    <!-- Consignes -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📋 Consignes importantes</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Présentez votre QR code à l'entrée le jour de votre visite</li>
            <li style="margin-bottom: 8px;">Arrivez 15 minutes avant l'heure de votre réservation</li>
            <li style="margin-bottom: 8px;">En cas d'annulation, prévenez-nous au moins 24h à l'avance</li>
          </ul>
        </td>
      </tr>
    </table>

    <!-- Conditions de réservation -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #9a3412; margin: 0 0 15px 0; font-size: 18px;">⚠️ Conditions de réservation</h3>
          <p style="margin: 0 0 12px 0; color: #374151; font-size: 15px; line-height: 1.6;">
            <strong>Le nombre de personnes réservées sera facturé dans sa totalité, même en cas d'absence ou de modification le jour même.</strong>
          </p>
          <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
            Afin de confirmer votre réservation à Table du Jardin, nous vous remercions de bien vouloir verser <strong>50 % du montant</strong> à l'avance.
          </p>
        </td>
      </tr>
    </table>

    <!-- RIB -->
    <div style="text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #374151; font-size: 14px;"><strong>RIB :</strong> 007 780 0003 401 000 100 238 97<br/><strong>IBAN :</strong> MA64 007 780 0003 401 000 100 238 97</p>
    </div>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Merci pour votre soutien à notre restaurant solidaire 💚
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      À très bientôt.<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `✅ Votre réservation est confirmée - Paiement requis`,
    html: baseTemplate(content),
  };
}

/**
 * Email 3 : Refus de réservation
 * Envoyé si le créneau est complet
 */
export interface ParticulierReservationRefusedEmailData {
  firstName: string;
  email: string;
  date: string;
}

export function generateParticulierReservationRefusedEmail(data: ParticulierReservationRefusedEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #dc2626; margin: 0 0 20px 0; font-size: 24px;">
      Demande de réservation - Indisponibilité
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Bonjour <strong>${data.firstName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous vous remercions pour votre demande de réservation.
    </p>
    
    <!-- Message -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fee2e2; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0; color: #991b1b; font-size: 16px;">
            <strong>Malheureusement, le créneau du ${data.date} est complet.</strong>
          </p>
          <p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px;">
            Nous vous invitons à sélectionner une autre date encore disponible.
          </p>
        </td>
      </tr>
    </table>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      N'hésitez pas à nous contacter si vous avez des questions.
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      À très bientôt !<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `❌ Demande de réservation - Créneau indisponible`,
    html: baseTemplate(content),
  };
}



// ============================================
// EMAILS INTERNES - NOTIFICATIONS À L'ÉQUIPE
// ============================================

/**
 * Email interne : Nouvelle demande reçue
 * Envoyé à l'équipe à chaque nouvelle demande
 */
export interface NewBookingNotificationData {
  type: 'particulier' | 'entreprise' | 'groupe';
  date: string;
  participantsCount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  reference: string;
  companyName?: string;
  displayChoice?: string;
}

export function generateNewBookingNotificationEmail(data: NewBookingNotificationData): { subject: string; html: string } {
  const typeLabel = {
    particulier: 'Particulier',
    entreprise: 'Entreprise',
    groupe: 'Groupe',
  }[data.type];

  const content = `
    <h2 style="color: #5d5a3c; margin: 0 0 20px 0; font-size: 24px;">
      📬 Nouvelle demande reçue
    </h2>
    
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f0; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #5d5a3c; margin: 0 0 15px 0; font-size: 18px;">📋 Détails de la demande</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Type :</strong> ${typeLabel}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.date}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Participants :</strong> ${data.participantsCount}</p>
          ${data.displayChoice ? `<p style="margin: 5px 0; color: #374151;"><strong>Salle :</strong> ${data.displayChoice}</p>` : ''}
          ${data.companyName ? `<p style="margin: 5px 0; color: #374151;"><strong>Entreprise :</strong> ${data.companyName}</p>` : ''}
          <p style="margin: 5px 0; color: #374151;"><strong>Contact :</strong> ${data.contactName}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Email :</strong> ${data.contactEmail}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Téléphone :</strong> ${data.contactPhone}</p>
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Référence :</strong> ${data.reference}</p>
        </td>
      </tr>
    </table>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      ⏳ À traiter dans les 48 heures.
    </p>
  `;

  return {
    subject: `📬 Nouvelle demande ${typeLabel} - ${data.date}`,
    html: baseTemplate(content),
  };
}


// ============================================
// EMAIL POUR INSCRIPTION GROUPE BÉNÉVOLE
// ============================================

export interface GroupRegistrationEmailData {
  groupName: string;
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  estimatedSize?: number;
  volunteerSlots: string[];
  dayNumber?: number;
  dayDate?: string;
  startTime?: string;
  fileName: string;
}

export function generateGroupRegistrationEmail(data: GroupRegistrationEmailData): { subject: string; html: string } {
  const times = computeSlotTimes(data.startTime || '18h00');
  const slotLabels: Record<string, string> = {
    preparation_ftour: `Préparation ftour (${times.prepStart} – ${times.prepEnd})`,
    service_ftour: `Service ftour (${times.serviceStart} – ${times.serviceEnd})`,
  };
  const slotsHtml = data.volunteerSlots.map(s =>
    `<li style="margin-bottom: 4px;">${slotLabels[s] || s}</li>`
  ).join('');

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Nouvelle inscription groupe bénévole
    </h2>

    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">Informations du groupe</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Nom du groupe :</strong> ${data.groupName}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Responsable :</strong> ${data.responsibleName}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Email :</strong> <a href="mailto:${data.responsibleEmail}">${data.responsibleEmail}</a></p>
          <p style="margin: 5px 0; color: #374151;"><strong>Téléphone :</strong> ${data.responsiblePhone}</p>
          ${data.estimatedSize ? `<p style="margin: 5px 0; color: #374151;"><strong>Taille estimée :</strong> ${data.estimatedSize} personnes</p>` : ''}
          ${data.dayNumber ? `<p style="margin: 5px 0; color: #374151;"><strong>Jour :</strong> ${data.dayNumber} du Ramadan${data.dayDate ? ` (${data.dayDate})` : ''}</p>` : ''}
          ${slotsHtml ? `<p style="margin: 10px 0 5px 0; color: #374151;"><strong>Créneaux choisis :</strong></p><ul style="margin: 0; padding-left: 20px; color: #374151;">${slotsHtml}</ul>` : ''}
        </td>
      </tr>
    </table>

    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 18px;">Fichier joint</h3>
          <p style="margin: 0; color: #374151;">
            Le fichier <strong>${data.fileName}</strong> contenant la liste des bénévoles est joint à cet email.
          </p>
        </td>
      </tr>
    </table>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Veuillez traiter cette inscription groupe dans les meilleurs délais.
    </p>
  `;

  return {
    subject: `[Bénévoles][Groupe] Nouvelle inscription groupe – ${data.groupName}`,
    html: baseTemplate(content),
  };
}
