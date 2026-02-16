/**
 * Envoie un email avec QR code d'accès au scanner bénévoles
 * Usage: RESEND_API_KEY=re_xxx node send-scanner-qr-email.mjs
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const SCANNER_URL = "https://ftourbabrayan.ma/scanner";
const LOGIN_URL = "https://ftourbabrayan.ma/fr/connexion";
const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(SCANNER_URL)}`;

const TO_EMAIL = "rsebbani@myspace.boats";
const SCANNER_EMAIL = "scaner@ftourbabrayan.ma";
const SCANNER_PASSWORD = "WERISETOGETHER";

const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#166534 0%,#15803d 50%,#166534 100%);padding:30px 20px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:28px;">
        Ftour <span style="color:#fbbf24;">Bab Rayan</span>
      </h1>
      <p style="color:#d1fae5;margin:8px 0 0;font-size:14px;">Scanner Bénévoles — Accès QR Code</p>
    </div>

    <!-- Body -->
    <div style="padding:30px 25px;">

      <h2 style="color:#166534;margin:0 0 15px;font-size:22px;">Accès au Scanner Bénévoles</h2>

      <p style="color:#374151;line-height:1.6;margin:0 0 20px;">
        Bonjour,<br><br>
        Voici votre QR code d'accès au <strong>Scanner Unifié</strong> de Ftour Bab Rayan.
        Scannez-le avec votre téléphone pour accéder directement à l'interface de scan des bénévoles,
        réservations et commandes.
      </p>

      <!-- QR Code -->
      <div style="text-align:center;margin:30px 0;padding:25px;background:#f0fdf4;border-radius:12px;border:2px solid #bbf7d0;">
        <p style="color:#166534;font-weight:bold;margin:0 0 15px;font-size:16px;">📱 Scannez ce QR code</p>
        <img src="${QR_CODE_URL}"
             alt="QR Code Scanner Bénévoles"
             width="250" height="250"
             style="border-radius:8px;border:3px solid #166534;" />
        <p style="color:#6b7280;margin:15px 0 0;font-size:13px;">
          Lien direct : <a href="${SCANNER_URL}" style="color:#166534;">${SCANNER_URL}</a>
        </p>
      </div>

      <!-- Credentials -->
      <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:20px;margin:25px 0;">
        <h3 style="color:#92400e;margin:0 0 15px;font-size:18px;">🔐 Identifiants de connexion</h3>
        <p style="color:#374151;margin:0 0 8px;font-size:14px;">
          Connectez-vous d'abord sur la page de connexion avant d'accéder au scanner :
        </p>
        <p style="margin:8px 0;text-align:center;">
          <a href="${LOGIN_URL}" style="color:#166534;font-weight:bold;font-size:14px;">${LOGIN_URL}</a>
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:15px;">
          <tr>
            <td style="padding:10px 15px;background:#fef3c7;border-radius:6px 0 0 0;font-weight:bold;color:#92400e;width:120px;">Email</td>
            <td style="padding:10px 15px;background:#fefce8;border-radius:0 6px 0 0;font-family:monospace;font-size:15px;color:#1f2937;">${SCANNER_EMAIL}</td>
          </tr>
          <tr>
            <td style="padding:10px 15px;background:#fef3c7;border-radius:0 0 0 6px;font-weight:bold;color:#92400e;">Mot de passe</td>
            <td style="padding:10px 15px;background:#fefce8;border-radius:0 0 6px 0;font-family:monospace;font-size:15px;color:#1f2937;">${SCANNER_PASSWORD}</td>
          </tr>
        </table>
        <p style="color:#92400e;margin:12px 0 0;font-size:12px;">
          ⚠️ Rôle : <strong>Scanner</strong> — accès limité au scanner uniquement
        </p>
      </div>

      <!-- Instructions -->
      <div style="background:#eff6ff;border-radius:12px;padding:20px;margin:25px 0;border:1px solid #bfdbfe;">
        <h3 style="color:#1e40af;margin:0 0 12px;font-size:16px;">📋 Instructions</h3>
        <ol style="color:#374151;line-height:1.8;margin:0;padding-left:20px;font-size:14px;">
          <li>Ouvrez <a href="${LOGIN_URL}" style="color:#166534;">${LOGIN_URL}</a> sur votre appareil</li>
          <li>Connectez-vous avec les identifiants ci-dessus</li>
          <li>Accédez au scanner via <a href="${SCANNER_URL}" style="color:#166534;">${SCANNER_URL}</a> ou scannez le QR code</li>
          <li>Autorisez l'accès à la caméra quand demandé</li>
          <li>Scannez les QR codes des bénévoles pour valider leur présence</li>
        </ol>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        Association Bab Rayan — Ftour Solidaire<br>
        <a href="https://ftourbabrayan.ma" style="color:#166534;">ftourbabrayan.ma</a> ·
        <a href="mailto:contact@ftourbabrayan.ma" style="color:#166534;">contact@ftourbabrayan.ma</a>
      </p>
    </div>

  </div>
</body>
</html>
`;

async function sendEmail() {
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║  ENVOI EMAIL QR CODE SCANNER — FTOUR BAB RAYAN   ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY non configurée.");
    console.error("   Usage: RESEND_API_KEY=re_xxx node send-scanner-qr-email.mjs");
    process.exit(1);
  }

  console.log(`📧 Destinataire : ${TO_EMAIL}`);
  console.log(`🔗 URL Scanner  : ${SCANNER_URL}`);
  console.log(`👤 Email compte : ${SCANNER_EMAIL}`);
  console.log(`🔑 Rôle         : scanner\n`);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ftour Bab Rayan <noreply@ftourbabrayan.ma>",
        to: TO_EMAIL,
        subject: "🔐 Accès Scanner Bénévoles — QR Code & Identifiants",
        html: emailHtml,
        reply_to: "contact@ftourbabrayan.ma",
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error(`❌ Erreur HTTP ${response.status}:`, data.error?.message || JSON.stringify(data));
      process.exit(1);
    }

    console.log("✅ Email envoyé avec succès !");
    console.log(`   ID Resend : ${data.id}`);
    console.log(`\n💡 Vérifiez la boîte de réception de ${TO_EMAIL}`);

  } catch (error) {
    console.error("❌ Erreur réseau :", error.message);
    process.exit(1);
  }
}

sendEmail();
