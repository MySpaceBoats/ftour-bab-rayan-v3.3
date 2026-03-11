/**
 * Email module for Cloudflare Workers
 * Uses Resend API for sending emails
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "Ftour Bab Rayan <noreply@ftourbabrayan.ma>";
const REPLY_TO = "contact@ftourbabrayan.ma";

/**
 * Calcule les horaires des créneaux bénévoles à partir de l'heure d'iftar.
 * Préparation : iftarTime - 3h → iftarTime - 1h15
 * Service : iftarTime - 1h15 → iftarTime + 1h40
 */
function computeSlotTimes(iftarTimeStr: string): { prepStart: string; prepEnd: string; serviceStart: string; serviceEnd: string } {
  const match = iftarTimeStr.match(/(\d{1,2})[h:](\d{2})/);
  if (!match) {
    return { prepStart: '15:00', prepEnd: '16:45', serviceStart: '16:45', serviceEnd: '19:40' };
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
    serviceStart: formatTime(iftarTotalMin - 75),
    serviceEnd: formatTime(iftarTotalMin + 100),
  };
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
  cc?: string[];
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
  }>;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!options.apiKey) {
    console.warn("[Email] RESEND_API_KEY/EMAIL_PROVIDER_KEY not configured, skipping email");
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        reply_to: REPLY_TO,
        ...(options.cc ? { cc: options.cc } : {}),
        ...(options.attachments ? { attachments: options.attachments } : {}),
      }),
    });

    const data = await response.json() as any;

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
 * Generate QR code URL using external service
 */
function getQrCodeUrl(token: string, baseUrl: string): string {
  const checkinUrl = `${baseUrl}/checkin/${token}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkinUrl)}`;
}

/**
 * Base template for all emails
 */
function baseTemplate(content: string, headerBackground = 'linear-gradient(135deg, #166534 0%, #15803d 100%)'): string {
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
            <td style="background: ${headerBackground}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
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
 * Generate volunteer confirmation email
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
  const safeDayNumber = data.dayNumber;
  const safeDayDate = data.dayDate;

  const times = computeSlotTimes(data.startTime);
  const slotLabels: Record<string, string> = {
    preparation_ftour: `Préparation Ftour (${times.prepStart} – ${times.prepEnd})`,
    service_ftour: `Service Ftour (${times.serviceStart} – ${times.serviceEnd})`,
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
          <p style="margin: 5px 0; color: #374151;"><strong>Jour :</strong> ${safeDayNumber} du Ramadan</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${safeDayDate}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Lieu :</strong> ${data.location}</p>
          ${slotsHtml ? `<p style="margin: 10px 0 5px 0; color: #374151;"><strong>Créneaux choisis :</strong></p><ul style="margin: 0; padding-left: 20px; color: #374151;">${slotsHtml}</ul>` : ''}
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

    <!-- Lien d'annulation -->
    <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
      <p style="color: #991b1b; font-size: 14px; margin: 0 0 10px 0;">
        En cas d'empêchement, vous pouvez annuler votre inscription en cliquant sur le lien ci-dessous :
      </p>
      <a href="https://www.ftourbabrayan.ma/cancel-volunteer/${data.qrToken}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
        Annuler mon inscription
      </a>
    </div>

    <!-- Consignes -->
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
    subject: `✅ Confirmation inscription - Ftour Bab Rayan Jour ${safeDayNumber}`,
    html: baseTemplate(content, 'linear-gradient(135deg, #5E5B34 0%, #4A4829 100%)'),
  };
}


/**
 * Generate order confirmation email for goodies
 */
export interface OrderEmailData {
  customerName: string;
  customerEmail: string;
  orderReference: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>;
  totalAmount: number;
  pickupLocation?: string;
  pickupDate?: string;
}

export function generateOrderConfirmationEmail(data: OrderEmailData): { subject: string; html: string } {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.unitPrice} DH</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.totalPrice} DH</td>
    </tr>
  `).join('');

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Merci pour votre commande !
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.customerName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Votre commande de goodies solidaires a bien été enregistrée. 
      Merci de soutenir l'association Bab Rayan !
    </p>
    
    <!-- Référence commande -->
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; color: #166534; font-size: 14px;">Référence de commande</p>
      <p style="margin: 5px 0 0 0; color: #166534; font-size: 24px; font-weight: bold;">${data.orderReference}</p>
    </div>
    
    <!-- Détails commande -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 10px; text-align: left; color: #374151;">Article</th>
          <th style="padding: 10px; text-align: center; color: #374151;">Qté</th>
          <th style="padding: 10px; text-align: right; color: #374151;">Prix unit.</th>
          <th style="padding: 10px; text-align: right; color: #374151;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr style="background-color: #166534;">
          <td colspan="3" style="padding: 15px; color: #ffffff; font-weight: bold;">Total</td>
          <td style="padding: 15px; color: #ffffff; font-weight: bold; text-align: right;">${data.totalAmount} DH</td>
        </tr>
      </tfoot>
    </table>
    
    <!-- Retrait -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📦 Retrait de votre commande</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Lieu :</strong> ${data.pickupLocation || 'Association Bab Rayan, 4 rue Bayt Lahm, Casablanca'}</p>
          ${data.pickupDate ? `<p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.pickupDate}</p>` : ''}
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
            Présentez cette confirmation lors du retrait. Le paiement s'effectue sur place.
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
    subject: `🛍️ Confirmation commande ${data.orderReference} - Ftour Bab Rayan`,
    html: baseTemplate(content),
  };
}

/**
 * Generate donation confirmation email
 */
export interface DonationEmailData {
  donorName: string;
  donorEmail: string;
  donationReference: string;
  amount: string;
  paymentMethod: 'transfer' | 'on_site' | 'cheque';
  message?: string;
}

export function generateDonationConfirmationEmail(data: DonationEmailData): { subject: string; html: string } {
  const paymentInfo = data.paymentMethod === 'transfer' ? `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">🏦 Coordonnées bancaires</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Banque :</strong> Attijariwafa Bank</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Titulaire :</strong> Association Bab Rayan</p>
          <p style="margin: 5px 0; color: #374151;"><strong>RIB :</strong> 007 780 0003851000000217 97</p>
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
            Merci d'indiquer la référence <strong>${data.donationReference}</strong> dans le motif du virement.
          </p>
        </td>
      </tr>
    </table>
  ` : data.paymentMethod === 'cheque' ? `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3e8ff; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #6b21a8; margin: 0 0 15px 0; font-size: 18px;">📝 Paiement par chèque</h3>
          <p style="margin: 5px 0; color: #374151;">Veuillez établir votre chèque à l'ordre de :</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Association Bab Rayan</strong></p>
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
            Mentionnez la référence <strong>${data.donationReference}</strong> au dos du chèque.
          </p>
        </td>
      </tr>
    </table>
  ` : `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📍 Don sur place</h3>
          <p style="margin: 5px 0; color: #374151;">Vous pouvez effectuer votre don lors d'un Ftour à :</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Association Bab Rayan</strong></p>
          <p style="margin: 5px 0; color: #374151;">4 rue Bayt Lahm, quartier Palmier, Casablanca</p>
          <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
            Présentez cette confirmation avec la référence <strong>${data.donationReference}</strong>.
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
      Cher(e) <strong>${data.donorName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous avons bien reçu votre promesse de don pour le <strong>Ftour Bab Rayan</strong>. 
      Votre générosité permettra d'offrir des repas aux enfants de l'association.
    </p>
    
    <!-- Récapitulatif -->
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; color: #166534; font-size: 14px;">Référence de don</p>
      <p style="margin: 5px 0; color: #166534; font-size: 24px; font-weight: bold;">${data.donationReference}</p>
      <p style="margin: 15px 0 0 0; color: #166534; font-size: 32px; font-weight: bold;">${data.amount} DH</p>
    </div>
    
    ${paymentInfo}
    
    ${data.message ? `
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #166534;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Votre message :</p>
      <p style="margin: 5px 0 0 0; color: #374151; font-style: italic;">"${data.message}"</p>
    </div>
    ` : ''}
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      Que Dieu vous récompense pour votre générosité !<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `❤️ Merci pour votre don ${data.donationReference} - Ftour Bab Rayan`,
    html: baseTemplate(content),
  };
}

/**
 * Generate donation received confirmation email (validated by admin)
 */
export interface DonationReceivedEmailData {
  donorName: string;
  donorEmail: string;
  donationReference: string;
  amount: number | string;
  paymentMethod: string;
}

export function generateDonationReceivedEmail(data: DonationReceivedEmailData): { subject: string; html: string } {
  const paymentMethodLabel =
    data.paymentMethod === 'transfer' ? 'virement bancaire'
    : data.paymentMethod === 'cheque' ? 'chèque'
    : 'espèces / sur place';

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Votre don a bien été reçu !
    </h2>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.donorName}</strong>,
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous avons bien reçu votre don pour le <strong>Ftour Bab Rayan</strong> et nous vous en remercions chaleureusement.
      Votre générosité contribue directement à offrir des repas aux enfants de l'association.
    </p>

    <!-- Récapitulatif -->
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; border: 2px solid #166534;">
      <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">DON REÇU ET CONFIRMÉ</p>
      <p style="margin: 10px 0; color: #166534; font-size: 36px; font-weight: bold;">${data.amount} MAD</p>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
        Référence : <strong>${data.donationReference}</strong>
      </p>
      <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 14px;">
        Mode de paiement : <strong>${paymentMethodLabel}</strong>
      </p>
    </div>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Que Dieu vous récompense pour votre générosité !<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `✅ Don reçu ${data.donationReference} - Merci pour votre générosité !`,
    html: baseTemplate(content),
  };
}

/**
 * Generate contact form confirmation email
 */


function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    <p style="font-size: 13px; color: #9ca3af; margin-top: 24px;">
      Cet email a été envoyé à ${safeEmail} suite à un dépôt de photos sur la galerie Ftour Bab Rayan.
      Si vous n'êtes pas à l'origine de cette action, ignorez cet email.
    </p>
  `;

  return {
    subject: "Validez la publication de vos photos – Ftour Bab Rayan",
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

export function generatePartnerLeadAdminNotificationEmail(data: PartnerLeadEmailData): { subject: string; html: string } {
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
export interface ContactEmailData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export function generateContactConfirmationEmail(data: ContactEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Message bien reçu !
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.name}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous avons bien reçu votre message et nous vous en remercions. 
      Notre équipe vous répondra dans les plus brefs délais.
    </p>
    
    <!-- Récapitulatif -->
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">📝 Récapitulatif de votre message</h3>
      <p style="margin: 5px 0; color: #374151;"><strong>Sujet :</strong> ${data.subject}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Email :</strong> ${data.email}</p>
      ${data.phone ? `<p style="margin: 5px 0; color: #374151;"><strong>Téléphone :</strong> ${data.phone}</p>` : ''}
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Message :</p>
        <p style="margin: 5px 0 0 0; color: #374151; white-space: pre-wrap;">${data.message}</p>
      </div>
    </div>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      À très bientôt !<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `📩 Message reçu - ${data.subject}`,
    html: baseTemplate(content),
  };
}

/**
 * Generate admin notification email for new contact message
 */
export function generateContactAdminNotificationEmail(data: ContactEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Nouveau message de contact
    </h2>
    
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📬 Informations du contact</h3>
      <p style="margin: 5px 0; color: #374151;"><strong>Nom :</strong> ${data.name}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Email :</strong> <a href="mailto:${data.email}" style="color: #166534;">${data.email}</a></p>
      ${data.phone ? `<p style="margin: 5px 0; color: #374151;"><strong>Téléphone :</strong> <a href="tel:${data.phone}" style="color: #166534;">${data.phone}</a></p>` : ''}
      <p style="margin: 5px 0; color: #374151;"><strong>Sujet :</strong> ${data.subject}</p>
    </div>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">💬 Message</h3>
      <p style="margin: 0; color: #374151; white-space: pre-wrap;">${data.message}</p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
      Répondez directement à cet email pour contacter ${data.name}.
    </p>
  `;

  return {
    subject: `📬 [Contact] ${data.subject} - ${data.name}`,
    html: baseTemplate(content),
  };
}


/**
 * Generate reservation confirmation email
 */
export interface ReservationEmailData {
  fullName: string;
  email: string;
  phone: string;
  referenceCode: string;
  restaurantName: string;
  restaurantAddress: string;
  date: string;
  seats: number;
  qrToken: string;
  baseUrl: string;
}

export function generateReservationConfirmationEmail(data: ReservationEmailData): { subject: string; html: string } {
  const qrCodeUrl = getQrCodeUrl(data.qrToken, data.baseUrl.replace('/checkin/', '/reservation/checkin/'));
  const checkinUrl = `${data.baseUrl.replace('/checkin/', '/reservation/checkin/')}${data.qrToken}`;
  
  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Réservation confirmée !
    </h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${data.fullName}</strong>,
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Votre réservation pour le <strong>Ftour solidaire</strong> a bien été enregistrée. 
      Nous avons hâte de vous accueillir !
    </p>
    
    <!-- Référence -->
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; color: #166534; font-size: 14px;">Référence de réservation</p>
      <p style="margin: 5px 0 0 0; color: #166534; font-size: 24px; font-weight: bold;">${data.referenceCode}</p>
    </div>
    
    <!-- Détails de la réservation -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">📅 Détails de votre réservation</h3>
          <p style="margin: 5px 0; color: #374151;"><strong>Restaurant :</strong> ${data.restaurantName}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Adresse :</strong> ${data.restaurantAddress}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.date}</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Nombre de places :</strong> ${data.seats} personne(s)</p>
        </td>
      </tr>
    </table>
    
    <!-- QR Code -->
    <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #166534; border-radius: 8px;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">🎫 Votre QR Code</h3>
      <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px; margin: 10px 0;" />
      <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
        Présentez ce QR code à l'entrée du restaurant
      </p>
    </div>
    
    <!-- Consignes -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📋 Informations importantes</h3>
          <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Arrivez 15 minutes avant l'heure du Ftour</li>
            <li style="margin-bottom: 8px;">Présentez votre QR code ou référence à l'entrée</li>
            <li style="margin-bottom: 8px;">En cas d'annulation, prévenez-nous à l'avance</li>
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
    subject: `✅ Réservation confirmée - ${data.referenceCode}`,
    html: baseTemplate(content),
  };
}

/**
 * Generate admin notification email for new reservation
 */
export function generateReservationAdminNotificationEmail(data: ReservationEmailData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Nouvelle réservation Ftour
    </h2>
    
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">📋 Détails de la réservation</h3>
      <p style="margin: 5px 0; color: #374151;"><strong>Référence :</strong> ${data.referenceCode}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Nom :</strong> ${data.fullName}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Téléphone :</strong> <a href="tel:${data.phone}" style="color: #166534;">${data.phone}</a></p>
      ${data.email ? `<p style="margin: 5px 0; color: #374151;"><strong>Email :</strong> <a href="mailto:${data.email}" style="color: #166534;">${data.email}</a></p>` : ''}
      <p style="margin: 5px 0; color: #374151;"><strong>Places :</strong> ${data.seats}</p>
    </div>
    
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📍 Lieu et date</h3>
      <p style="margin: 5px 0; color: #374151;"><strong>Restaurant :</strong> ${data.restaurantName}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Adresse :</strong> ${data.restaurantAddress}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${data.date}</p>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
      Gérez cette réservation depuis le <a href="https://ftourbabrayan.ma/admin/reservations" style="color: #166534;">dashboard admin</a>.
    </p>
  `;

  return {
    subject: `📅 [Réservation] ${data.referenceCode} - ${data.fullName} (${data.seats} places)`,
    html: baseTemplate(content),
  };
}

/**
 * Generate group volunteer registration email for admin
 */
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

export interface GroupRegistrationAcknowledgementEmailData {
  responsibleName: string;
  groupName: string;
  dayNumber?: number;
  dayDate?: string;
  estimatedSize?: number;
  volunteerSlots: string[];
  startTime?: string;
}

export function generateGroupRefusalEmail(data: GroupRefusalEmailData): { subject: string; html: string } {
  const safeResponsibleName = escapeHtml(data.responsibleName);
  const safeGroupName = escapeHtml(data.groupName);
  const safeDayNumber = data.dayNumber;
  const content = `
    <h2 style="color: #991b1b; margin: 0 0 20px 0; font-size: 24px;">
      Demande groupe bénévole non retenue
    </h2>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Cher(e) <strong>${safeResponsibleName}</strong>,
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous avons bien étudié votre demande d'inscription groupe <strong>${safeGroupName}</strong>${data.dayNumber ? ` pour le jour ${safeDayNumber} du Ramadan` : ''}.
      Malheureusement, nous ne pouvons pas y donner suite.
    </p>

    ${data.rejectionReason ? `
    <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #fca5a5;">
      <h3 style="color: #991b1b; margin: 0 0 10px 0; font-size: 16px;">Motif</h3>
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">${data.rejectionReason}</p>
    </div>` : ''}

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Pour toute question, n'hésitez pas à nous contacter à <a href="mailto:contact@ftourbabrayan.ma" style="color: #166534;">contact@ftourbabrayan.ma</a>.
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      Cordialement,<br>
      <strong>L'équipe Ftour Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `Votre demande groupe bénévole – ${safeGroupName}`,
    html: baseTemplate(content, 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)'),
  };
}

export function generateGroupRegistrationEmail(data: GroupRegistrationEmailData): { subject: string; html: string } {
  const times = computeSlotTimes(data.startTime || '18h00');
  const safeGroupName = escapeHtml(data.groupName);
  const safeResponsibleName = escapeHtml(data.responsibleName);
  const safeResponsibleEmail = escapeHtml(data.responsibleEmail);
  const safeResponsiblePhone = escapeHtml(data.responsiblePhone);
  const safeEstimatedSize = data.estimatedSize;
  const safeDayNumber = data.dayNumber;
  const safeDayDate = data.dayDate ? escapeHtml(data.dayDate) : undefined;
  const safeFileName = escapeHtml(data.fileName);
  const slotLabels: Record<string, string> = {
    preparation_ftour: `Préparation Ftour (${times.prepStart} – ${times.prepEnd})`,
    service_ftour: `Service Ftour (${times.serviceStart} – ${times.serviceEnd})`,
  };
  const slotsDisplay = data.volunteerSlots.map(s => escapeHtml(slotLabels[s] || s)).join(', ');

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Nouvelle inscription groupe bénévole
    </h2>

    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">👥 Informations du groupe</h3>
      <p style="margin: 5px 0; color: #374151;"><strong>Nom du groupe :</strong> ${safeGroupName}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Responsable :</strong> ${safeResponsibleName}</p>
      <p style="margin: 5px 0; color: #374151;"><strong>Email :</strong> <a href="mailto:${safeResponsibleEmail}" style="color: #166534;">${safeResponsibleEmail}</a></p>
      <p style="margin: 5px 0; color: #374151;"><strong>Téléphone :</strong> ${safeResponsiblePhone}</p>
      ${data.estimatedSize ? `<p style="margin: 5px 0; color: #374151;"><strong>Nombre estimé :</strong> ${safeEstimatedSize} personnes</p>` : ''}
    </div>

    <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📅 Participation</h3>
      ${data.dayNumber ? `<p style="margin: 5px 0; color: #374151;"><strong>Jour :</strong> ${safeDayNumber} du Ramadan</p>` : ''}
      ${data.dayDate ? `<p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${safeDayDate}</p>` : ''}
      <p style="margin: 5px 0; color: #374151;"><strong>Créneaux :</strong> ${slotsDisplay}</p>
    </div>

    <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">📎 Fichier joint</h3>
      <p style="margin: 5px 0; color: #374151;">Le fichier <strong>${safeFileName}</strong> contenant la liste des membres du groupe est joint à cet email.</p>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
      Gérez les bénévoles depuis le <a href="https://ftourbabrayan.ma/admin/benevoles" style="color: #166534;">dashboard admin</a>.
    </p>
  `;

  return {
    subject: `👥 [Groupe] Inscription bénévole - ${safeGroupName}`,
    html: baseTemplate(content),
  };
}

export function generateGroupRegistrationAcknowledgementEmail(
  data: GroupRegistrationAcknowledgementEmailData,
): { subject: string; html: string } {
  const times = computeSlotTimes(data.startTime || '18h00');
  const safeResponsibleName = escapeHtml(data.responsibleName);
  const safeGroupName = escapeHtml(data.groupName);
  const safeDayNumber = data.dayNumber;
  const safeDayDate = data.dayDate ? escapeHtml(data.dayDate) : undefined;
  const safeEstimatedSize = data.estimatedSize;
  const slotLabels: Record<string, string> = {
    preparation_ftour: `Préparation Ftour (${times.prepStart} – ${times.prepEnd})`,
    service_ftour: `Service Ftour (${times.serviceStart} – ${times.serviceEnd})`,
  };
  const slotsDisplay = data.volunteerSlots.map(s => escapeHtml(slotLabels[s] || s)).join(', ');

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      Votre demande de groupe est <strong>en cours de traitement ⏳</strong>
    </h2>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Bonjour <strong>${safeResponsibleName}</strong>,
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Nous avons bien reçu votre <strong>demande d'inscription pour le groupe ${safeGroupName}</strong>.
    </p>

    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
        ⚠️ <strong>Votre demande est actuellement en cours d'étude par notre équipe.</strong><br>
        La participation n'est pas encore confirmée à ce stade. Nous reviendrons vers vous prochainement
        pour vous informer de la <strong>validation ou des éventuelles disponibilités alternatives.</strong>
      </p>
    </div>

    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">📋 Récapitulatif de votre demande</h3>
      ${data.dayNumber ? `<p style="margin: 5px 0; color: #374151;"><strong>Jour :</strong> ${safeDayNumber} du Ramadan</p>` : ''}
      ${data.dayDate ? `<p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${safeDayDate}</p>` : ''}
      ${data.estimatedSize ? `<p style="margin: 5px 0; color: #374151;"><strong>Nombre estimé :</strong> ${safeEstimatedSize} personnes</p>` : ''}
      <p style="margin: 5px 0; color: #374151;"><strong>Créneaux demandés :</strong></p>
      <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #374151;">
        ${data.volunteerSlots.map(s => `<li style="margin: 3px 0;">${escapeHtml(slotLabels[s] || s)}</li>`).join('')}
      </ul>
    </div>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">
      Nous vous remercions pour votre engagement et votre intérêt pour cette action solidaire.
    </p>

    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 10px 0 0 0;">
      <strong>L'équipe Bab Rayan</strong>
    </p>
  `;

  return {
    subject: `Votre demande de groupe est en cours de traitement ⏳`,
    html: baseTemplate(content),
  };
}
