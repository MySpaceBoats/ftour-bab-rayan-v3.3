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
