/**
 * Templates d'emails dynamiques pour Goodies
 * Génère des emails conditionnels basés sur le mode de livraison et la méthode de paiement
 */

export type PaymentMethod = 'bank_transfer' | 'cheque' | 'cash';
export type DeliveryMode = 'pickup' | 'home_delivery';

interface OrderItem {
  name: string;
  variant?: string;
  quantity: number;
  price: number;
}

interface GoodiesOrderEmailData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  orderId: string;
  items: OrderItem[];
  totalAmount: number;
  deliveryFee?: number;
  deliveryMode: DeliveryMode;
  paymentMethod: PaymentMethod;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryNeighborhood?: string;
  deliveryPhone?: string;
  baseUrl: string;
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
 * Génère le contenu de paiement en fonction de la méthode
 */
function getPaymentInstructions(paymentMethod: PaymentMethod, deliveryMode: DeliveryMode): string {
  const paymentTexts: Record<PaymentMethod, { title: string; instructions: string }> = {
    bank_transfer: {
      title: '🏦 Virement bancaire',
      instructions: `
        <p style="margin: 0 0 10px 0; color: #374151;">
          Veuillez effectuer un virement bancaire aux coordonnées suivantes :
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
          <li style="margin-bottom: 5px;"><strong>Bénéficiaire :</strong> Association Bab Rayan</li>
          <li style="margin-bottom: 5px;"><strong>IBAN :</strong> MA64 0000 0000 0000 0000 0000 (à confirmer)</li>
          <li style="margin-bottom: 5px;"><strong>Montant :</strong> À définir</li>
          <li style="margin-bottom: 5px;"><strong>Référence :</strong> Inclure votre numéro de commande</li>
        </ul>
        <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
          ⏱️ Délai de traitement : 2-3 jours ouvrables
        </p>
      `
    },
    cheque: {
      title: '✉️ Chèque',
      instructions: `
        <p style="margin: 0 0 10px 0; color: #374151;">
          Veuillez envoyer un chèque à l'ordre de « Association Bab Rayan » à :
        </p>
        <p style="margin: 0; padding: 10px; background-color: #f3f4f6; border-radius: 4px; color: #374151;">
          Association Bab Rayan<br>
          4 rue Bayt Lham, quartier Palmier<br>
          20000 Casablanca, Maroc
        </p>
        <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
          ⏱️ Délai de traitement : 5-7 jours après réception
        </p>
      `
    },
    cash: {
      title: '💵 Paiement en espèces',
      instructions: deliveryMode === 'pickup' 
        ? `
          <p style="margin: 0 0 10px 0; color: #374151;">
            Le paiement se fera en espèces <strong>lors du retrait</strong> de votre commande.
          </p>
          <p style="margin: 0; color: #374151;">
            Aucune action requise de votre part pour le moment. Nous vous confirmerons la date et l'heure du retrait.
          </p>
        `
        : `
          <p style="margin: 0 0 10px 0; color: #374151;">
            Le paiement se fera en espèces <strong>à la livraison</strong> de votre commande.
          </p>
          <p style="margin: 0; color: #374151;">
            Notre livreur vous contactera pour convenir d'un créneau de livraison.
          </p>
        `
    },
    paypal: {
      title: '🔐 PayPal',
      instructions: `
        <p style="margin: 0 0 10px 0; color: #374151;">
          Un lien de paiement sécurisé PayPal vous sera envoyé par email séparé.
        </p>
        <p style="margin: 0; color: #374151;">
          Cliquez sur le lien pour compléter votre paiement de manière sécurisée.
        </p>
        <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
          ⏱️ Délai de traitement : Immédiat après confirmation PayPal
        </p>
      `
    }
  };

  const paymentInfo = paymentTexts[paymentMethod];
  return `
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">${paymentInfo.title}</h3>
          ${paymentInfo.instructions}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Génère le contenu de livraison en fonction du mode
 */
function getDeliveryInstructions(deliveryMode: DeliveryMode, deliveryData?: {
  address?: string;
  city?: string;
  neighborhood?: string;
  phone?: string;
}): string {
  if (deliveryMode === 'pickup') {
    return `
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #dbeafe; border-radius: 8px; margin: 20px 0;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px;">📍 Retrait sur place</h3>
            <p style="margin: 0 0 10px 0; color: #374151;">
              Votre commande sera disponible au retrait à l'adresse suivante :
            </p>
            <p style="margin: 0; padding: 10px; background-color: #ffffff; border-radius: 4px; color: #374151;">
              <strong>Ftour Bab Rayan - Point de retrait</strong><br>
              4 rue Bayt Lham, quartier Palmier<br>
              20000 Casablanca, Maroc
            </p>
            <p style="margin: 10px 0 0 0; color: #374151;">
              📞 Tél: +212 610 023 555<br>
              📧 Email: contact@ftourbabrayan.ma
            </p>
            <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
              ⏱️ Nous vous contactons pour convenir d'une date et heure de retrait
            </p>
          </td>
        </tr>
      </table>
    `;
  } else {
    return `
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #dbeafe; border-radius: 8px; margin: 20px 0;">
        <tr>
          <td style="padding: 20px;">
            <h3 style="color: #0c4a6e; margin: 0 0 15px 0; font-size: 18px;">🚚 Livraison à domicile</h3>
            <p style="margin: 0 0 10px 0; color: #374151;">
              Votre commande sera livrée à l'adresse suivante :
            </p>
            <p style="margin: 0; padding: 10px; background-color: #ffffff; border-radius: 4px; color: #374151;">
              ${deliveryData?.address ? `<strong>${deliveryData.address}</strong><br>` : ''}
              ${deliveryData?.neighborhood ? `${deliveryData.neighborhood}<br>` : ''}
              ${deliveryData?.city ? `${deliveryData.city}` : 'Casablanca'}<br>
              ${deliveryData?.phone ? `<strong>Tél livraison :</strong> ${deliveryData.phone}` : ''}
            </p>
            <p style="margin: 10px 0 0 0; color: #374151;">
              📦 <strong>Frais de livraison :</strong> 30 MAD
            </p>
            <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">
              ⏱️ Notre livreur vous contactera pour convenir d'un créneau de livraison (généralement 2-3 jours)
            </p>
          </td>
        </tr>
      </table>
    `;
  }
}

/**
 * Génère un email de confirmation de commande Goodies avec contenu dynamique
 */
export function generateGoodiesOrderEmail(data: GoodiesOrderEmailData): { subject: string; html: string } {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
        ${item.name}${item.variant ? ` (${item.variant})` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        ${item.price.toFixed(0)} MAD
      </td>
    </tr>
  `).join('');

  const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = data.deliveryMode === 'home_delivery' ? (data.deliveryFee || 30) : 0;
  const total = subtotal + deliveryFee;

  const paymentInstructions = getPaymentInstructions(data.paymentMethod, data.deliveryMode);
  const deliveryInstructions = getDeliveryInstructions(data.deliveryMode, {
    address: data.deliveryAddress,
    city: data.deliveryCity,
    neighborhood: data.deliveryNeighborhood,
    phone: data.deliveryPhone,
  });

  const content = `
    <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">
      ✅ Commande confirmée !
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
        ${data.deliveryMode === 'home_delivery' ? `
          <tr style="background-color: #f3f4f6;">
            <td colspan="2" style="padding: 10px; color: #374151;">Sous-total</td>
            <td style="padding: 10px; text-align: right; color: #374151;">
              ${subtotal.toFixed(0)} MAD
            </td>
          </tr>
          <tr style="background-color: #f3f4f6;">
            <td colspan="2" style="padding: 10px; color: #374151;">Frais de livraison</td>
            <td style="padding: 10px; text-align: right; color: #374151;">
              ${deliveryFee.toFixed(0)} MAD
            </td>
          </tr>
        ` : ''}
        <tr style="background-color: #f0fdf4;">
          <td colspan="2" style="padding: 15px; font-weight: bold; color: #166534;">Total à payer</td>
          <td style="padding: 15px; text-align: right; font-weight: bold; color: #166534; font-size: 18px;">
            ${total.toFixed(0)} MAD
          </td>
        </tr>
      </tbody>
    </table>
    
    <!-- Livraison -->
    ${deliveryInstructions}
    
    <!-- Paiement -->
    ${paymentInstructions}
    
    <!-- Prochaines étapes -->
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">📋 Prochaines étapes</h3>
          <ol style="margin: 0; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 8px;">Nous vous contactons pour confirmer la date/heure de ${data.deliveryMode === 'pickup' ? 'retrait' : 'livraison'}</li>
            <li style="margin-bottom: 8px;">Effectuez le paiement selon la méthode choisie</li>
            <li style="margin-bottom: 8px;">Recevez votre commande</li>
            <li>Merci de votre soutien ! 🙏</li>
          </ol>
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
    subject: `✅ Confirmation commande Goodies - Référence ${data.orderId}`,
    html: baseTemplate(content),
  };
}
