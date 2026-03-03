const BRAND_GREEN = '#166534';
const BRAND_HEADER = 'linear-gradient(135deg, #166534 0%, #15803d 100%)';

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ftour Bab Rayan</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_HEADER};padding:28px 32px;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:13px;color:#bbf7d0;letter-spacing:0.08em;text-transform:uppercase;">Association Bab Rayan</p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">Ftour Bab Rayan</h1>
              <p style="margin:8px 0 0 0;font-size:13px;color:#bbf7d0;">Ensemble pour un Ramadan solidaire</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">
                Association Bab Rayan — Casablanca, Maroc
              </p>
              <p style="margin:0;font-size:12px;color:#6b7280;">
                Support&nbsp;:&nbsp;<a href="mailto:contact@ftourbabrayan.ma" style="color:${BRAND_GREEN};text-decoration:none;">contact@ftourbabrayan.ma</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto;">
      <tr>
        <td style="background:${BRAND_GREEN};border-radius:8px;">
          <a href="${href}"
             style="display:block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;white-space:nowrap;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function fallbackLink(href: string): string {
  return `<p style="font-size:12px;color:#6b7280;word-break:break-all;">
    Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br/>
    <a href="${href}" style="color:${BRAND_GREEN};">${href}</a>
  </p>`;
}

// ---------------------------------------------------------------------------
// Email 1 – Order confirmation (sent by admin)
// CTA: "Je confirme ma demande de carte"  →  /card/confirm-order?token=...
// ---------------------------------------------------------------------------
export function buildOrderEmail(confirmUrl: string): { subject: string; html: string } {
  return {
    subject: 'Carte Membre Bab Rayan – Confirmez votre demande',
    html: baseTemplate(`
      <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${BRAND_GREEN};">
        Votre demande de carte membre
      </h2>

      <p style="margin:0 0 16px 0;line-height:1.6;">
        Merci pour votre engagement auprès de Bab Rayan&nbsp;!<br/>
        Nous avons bien enregistré votre intérêt pour la <strong>Carte Membre Bab Rayan</strong>.
      </p>

      <p style="margin:0 0 8px 0;line-height:1.6;">
        Pour finaliser votre inscription, veuillez confirmer votre demande en cliquant sur le bouton ci-dessous.
        Ce lien est valable <strong>72&nbsp;heures</strong>.
      </p>

      ${ctaButton(confirmUrl, '✅ Je confirme ma demande de carte')}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

      <p style="margin:0 0 8px 0;font-size:13px;color:#374151;line-height:1.5;">
        <strong>Qu'est-ce que la Carte Membre Bab Rayan&nbsp;?</strong><br/>
        Elle vous permet de soutenir les actions solidaires de l'association tout au long de l'année
        et de bénéficier de nos événements en avant-première.
      </p>

      ${fallbackLink(confirmUrl)}
    `),
  };
}

// ---------------------------------------------------------------------------
// Email 2 – Payment instructions (sent automatically after order confirmation)
// CTA: "Valider mon paiement"  →  /card/payment?token=...
// ---------------------------------------------------------------------------
export function buildPaymentEmail(
  paymentUrl: string,
  amount: number,
  currency: string,
): { subject: string; html: string } {
  const formattedAmount = amount.toFixed(2);

  return {
    subject: 'Carte Membre Bab Rayan – Instructions de paiement',
    html: baseTemplate(`
      <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${BRAND_GREEN};">
        Finalisez votre carte membre
      </h2>

      <p style="margin:0 0 16px 0;line-height:1.6;">
        Votre demande de carte a bien été confirmée. Il ne reste plus qu'à régler le montant de cotisation.
      </p>

      <!-- Amount box -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;">
        <tr>
          <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Montant à régler</p>
            <p style="margin:0;font-size:28px;font-weight:700;color:#166534;">${formattedAmount}&nbsp;${currency}</p>
          </td>
        </tr>
      </table>

      <!-- Payment methods -->
      <h3 style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#1f2937;">Modes de paiement acceptés</h3>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;border-collapse:separate;border-spacing:0 8px;">
        <tr>
          <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;vertical-align:top;">
            <p style="margin:0 0 4px 0;font-weight:700;color:#1f2937;">💵 Paiement sur place</p>
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
              Remettez le montant directement à un responsable de l'association lors de nos événements.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 16px;vertical-align:top;">
            <p style="margin:0 0 8px 0;font-weight:700;color:#1f2937;">🏦 Virement bancaire</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;color:#374151;">
              <tr><td style="padding:2px 0;width:90px;color:#6b7280;">Banque</td><td><strong>CIH Bank</strong></td></tr>
              <tr><td style="padding:2px 0;color:#6b7280;">RIB</td><td><strong>230 810 4810820410010168</strong></td></tr>
              <tr><td style="padding:2px 0;color:#6b7280;">IBAN</td><td><strong>MA64 230 810 4810820410010168</strong></td></tr>
              <tr><td style="padding:2px 0;color:#6b7280;">Titulaire</td><td><strong>Association Bab Rayan</strong></td></tr>
              <tr><td style="padding:2px 0;color:#6b7280;">Montant</td><td><strong>${formattedAmount} ${currency}</strong></td></tr>
              <tr><td style="padding:2px 0;color:#6b7280;">Motif</td><td><strong>Carte Membre</strong></td></tr>
            </table>
            <p style="margin:8px 0 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
              Après le virement, uploadez votre preuve de paiement (relevé PDF ou capture d'écran JPG/PNG, max&nbsp;10&nbsp;Mo) via le bouton ci-dessous.
            </p>
          </td>
        </tr>
      </table>

      ${ctaButton(paymentUrl, '💳 Valider mon paiement')}

      <p style="margin:-12px 0 20px 0;font-size:12px;color:#6b7280;text-align:center;">
        Ce lien est valable <strong>72&nbsp;heures</strong>. Vous pouvez le réutiliser tant qu'il n'a pas expiré.
      </p>

      ${fallbackLink(paymentUrl)}
    `),
  };
}
