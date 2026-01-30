/**
 * Email module for Cloudflare Workers
 * Uses Resend API for sending emails
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "Ftour Bab Rayan <noreply@ftourbabrayan.ma>";
const REPLY_TO = "contact@ftourbabrayan.ma";
const BCC_EMAIL = "rsebbani@myspace.boats";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!options.apiKey) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email");
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
        bcc: [BCC_EMAIL],
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
                Tél: +212 664-887978 | contact@ftourbabrayan.ma
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
  qrToken: string;
  baseUrl: string;
}

export function generateVolunteerConfirmationEmail(data: VolunteerEmailData): { subject: string; html: string } {
  const qrCodeUrl = getQrCodeUrl(data.qrToken, data.baseUrl);
  
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
          <p style="margin: 5px 0; color: #374151;"><strong>Lieu :</strong> ${data.pickupLocation || 'Association Bab Rayan, 4 rue Bayt Lham, Casablanca'}</p>
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
  paymentMethod: 'transfer' | 'on_site';
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
  ` : `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📍 Don sur place</h3>
          <p style="margin: 5px 0; color: #374151;">Vous pouvez effectuer votre don lors d'un Ftour à :</p>
          <p style="margin: 5px 0; color: #374151;"><strong>Association Bab Rayan</strong></p>
          <p style="margin: 5px 0; color: #374151;">4 rue Bayt Lham, quartier Palmier, Casablanca</p>
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
 * Generate contact form confirmation email
 */
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
