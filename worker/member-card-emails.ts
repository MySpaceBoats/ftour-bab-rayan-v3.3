const BRAND_HEADER = 'linear-gradient(135deg, #166534 0%, #15803d 100%)';

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table role="presentation" style="width:100%;padding:24px;">
    <tr><td align="center">
      <table role="presentation" style="max-width:620px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${BRAND_HEADER};padding:24px;text-align:center;color:#fff;">
          <h1 style="margin:0;font-size:26px;">Ftour Bab Rayan</h1>
        </td></tr>
        <tr><td style="padding:28px;">${content}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildOrderEmail(confirmUrl: string): { subject: string; html: string } {
  return {
    subject: 'Carte Membre Bab Rayan - Confirmation de commande',
    html: baseTemplate(`
      <h2 style="margin-top:0;color:#166534;">Confirmez votre demande de carte membre</h2>
      <p>Merci pour votre engagement avec Bab Rayan.</p>
      <p>Cliquez sur le bouton ci-dessous pour confirmer votre demande de carte membre.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${confirmUrl}" style="background:#166534;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Je confirme ma demande de carte</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">Si le bouton ne fonctionne pas, copiez ce lien :<br/>${confirmUrl}</p>
    `),
  };
}

export function buildPaymentEmail(paymentUrl: string, amount: number, currency: string): { subject: string; html: string } {
  return {
    subject: 'Carte Membre Bab Rayan - Validation du paiement',
    html: baseTemplate(`
      <h2 style="margin-top:0;color:#166534;">Finalisez votre carte membre</h2>
      <p>Votre demande de carte a bien été confirmée.</p>
      <p>Montant à régler : <strong>${amount.toFixed(2)} ${currency}</strong></p>
      <p>RIB: <strong>00000 00000 000000000000 00</strong><br/>Banque: <strong>Bab Rayan Bank</strong></p>
      <p>Vous pouvez payer sur place ou par virement (avec preuve PDF/JPG/PNG).</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${paymentUrl}" style="background:#166534;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Valider paiement</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">Support: contact@ftourbabrayan.ma</p>
    `),
  };
}
