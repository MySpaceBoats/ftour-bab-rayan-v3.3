/**
 * Script de test d'envoi d'emails via Resend
 * Usage: node test-email.mjs
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = "https://api.resend.com/emails";
const TEST_EMAIL = "reda.sebbani@gmail.com";

async function testResendConnection() {
  console.log("=== Test de connexion Resend ===\n");
  
  // Vérifier la clé API
  if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY non configurée dans l'environnement");
    return false;
  }
  
  if (!RESEND_API_KEY.startsWith('re_')) {
    console.error("❌ Format de clé API invalide (doit commencer par 're_')");
    return false;
  }
  
  console.log("✅ Clé API Resend présente");
  console.log(`   Suffixe: ...${RESEND_API_KEY.slice(-4)}`);
  
  return true;
}

async function sendTestEmail(type) {
  const timestamp = new Date().toISOString();
  
  const templates = {
    simple: {
      subject: `[TEST] Email simple - ${timestamp}`,
      html: `
        <h1>Test d'envoi simple</h1>
        <p>Cet email a été envoyé le ${timestamp}</p>
        <p>Si vous recevez cet email, le système Resend fonctionne correctement.</p>
      `
    },
    benevole: {
      subject: `✅ [TEST] Confirmation inscription bénévole - ${timestamp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #166534 0%, #15803d 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">Ftour <span style="color: #fbbf24;">Bab Rayan</span></h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #166534;">Test - Confirmation d'inscription bénévole</h2>
            <p>Cher(e) <strong>Test User</strong>,</p>
            <p>Ceci est un email de test pour vérifier le système d'envoi.</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #166534;">📅 Détails du test</h3>
              <p><strong>Date:</strong> ${timestamp}</p>
              <p><strong>Type:</strong> Confirmation bénévole</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TEST-QR-CODE" alt="QR Code Test" />
              <p style="color: #666;">QR Code de test</p>
            </div>
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center;">
            <p style="margin: 0; color: #666;">Association Bab Rayan - Test Email</p>
          </div>
        </div>
      `
    },
    contact: {
      subject: `📬 [TEST] Nouveau message de contact - ${timestamp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #166534;">Test - Notification de contact</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; background: #f3f4f6; font-weight: bold;">Nom</td>
              <td style="padding: 10px; background: #f9fafb;">Test User</td>
            </tr>
            <tr>
              <td style="padding: 10px; background: #f3f4f6; font-weight: bold;">Email</td>
              <td style="padding: 10px; background: #f9fafb;">${TEST_EMAIL}</td>
            </tr>
            <tr>
              <td style="padding: 10px; background: #f3f4f6; font-weight: bold;">Sujet</td>
              <td style="padding: 10px; background: #f9fafb;">Test du système d'email</td>
            </tr>
          </table>
          <div style="background: #f9fafb; padding: 20px; margin-top: 20px; border-radius: 8px;">
            <h3>Message:</h3>
            <p>Ceci est un message de test envoyé le ${timestamp}</p>
          </div>
        </div>
      `
    }
  };

  const template = templates[type] || templates.simple;
  
  console.log(`\n📧 Envoi de l'email de type "${type}" à ${TEST_EMAIL}...`);
  
  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ftour Bab Rayan <noreply@ftourbabrayan.ma>",
        to: TEST_EMAIL,
        subject: template.subject,
        html: template.html,
        reply_to: "contact@ftourbabrayan.ma",
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Erreur HTTP ${response.status}:`, data);
      return { success: false, error: data };
    }
    
    if (data.error) {
      console.error("❌ Erreur Resend:", data.error);
      return { success: false, error: data.error };
    }
    
    console.log("✅ Email envoyé avec succès!");
    console.log(`   ID Resend: ${data.id}`);
    return { success: true, id: data.id };
    
  } catch (error) {
    console.error("❌ Erreur réseau:", error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║  TEST D'ENVOI D'EMAILS - FTOUR BAB RAYAN   ║");
  console.log("╚════════════════════════════════════════════╝\n");
  
  console.log(`📬 Adresse de test: ${TEST_EMAIL}\n`);
  
  // Test 1: Vérifier la connexion
  const connectionOk = await testResendConnection();
  if (!connectionOk) {
    console.log("\n⚠️ Impossible de continuer sans clé API valide");
    process.exit(1);
  }
  
  // Test 2: Envoyer un email simple
  console.log("\n--- Test 1: Email simple ---");
  const result1 = await sendTestEmail('simple');
  
  // Test 3: Envoyer un email de type bénévole
  console.log("\n--- Test 2: Email confirmation bénévole ---");
  const result2 = await sendTestEmail('benevole');
  
  // Test 4: Envoyer un email de type contact
  console.log("\n--- Test 3: Email notification contact ---");
  const result3 = await sendTestEmail('contact');
  
  // Résumé
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║              RÉSUMÉ DES TESTS              ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log(`\n📧 Email simple:     ${result1.success ? '✅ OK' : '❌ ÉCHEC'} ${result1.id ? `(ID: ${result1.id})` : ''}`);
  console.log(`📧 Email bénévole:   ${result2.success ? '✅ OK' : '❌ ÉCHEC'} ${result2.id ? `(ID: ${result2.id})` : ''}`);
  console.log(`📧 Email contact:    ${result3.success ? '✅ OK' : '❌ ÉCHEC'} ${result3.id ? `(ID: ${result3.id})` : ''}`);
  
  const allSuccess = result1.success && result2.success && result3.success;
  console.log(`\n${allSuccess ? '✅ Tous les tests ont réussi!' : '⚠️ Certains tests ont échoué'}`);
  console.log(`\n💡 Vérifiez la boîte de réception de ${TEST_EMAIL}`);
  console.log("   Les emails peuvent prendre quelques secondes à arriver.");
}

main().catch(console.error);
