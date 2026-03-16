import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { useI18n } from '@/i18n';
import { CheckCircle2 } from 'lucide-react';

interface PastriesConfirmationProps {
  order: any;
}

export default function PastriesConfirmation({ order }: PastriesConfirmationProps) {
  const [, setLocation] = useLocation();
  const { t } = useI18n();

  const deliveryMode = order.delivery_mode || 'pickup';
  const paymentMethod = order.payment_method || 'bank_transfer';

  const paymentMethodLabels: Record<string, string> = {
    bank_transfer: t.checkout.bankTransfer,
    cheque: t.checkout.cheque,
    cash: t.checkout.cash,
    paypal: t.checkout.paypal,
    cmi: (t.checkout as any).cmi || 'CMI',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background py-12">
      <div className="container max-w-2xl">
        <div className="text-center mb-8">
          <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">{t.pastries.orderConfirmed}</h1>
          <p className="text-lg text-muted-foreground">{t.pastries.orderSuccessMessage}</p>
        </div>

        <Card className="p-8 mb-6">
          <div className="space-y-6">
            {/* Order Reference */}
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">{t.pastries.orderReference}</p>
              <p className="text-2xl font-bold font-mono text-foreground">{order.reference}</p>
            </div>

            {/* Order Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t.pastries.fullName}</p>
                <p className="font-semibold">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t.pastries.phone}</p>
                <p className="font-semibold">{order.phone}</p>
              </div>
              {order.email && (
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">{t.pastries.email}</p>
                  <p className="font-semibold">{order.email}</p>
                </div>
              )}
            </div>

            {/* Delivery Information */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg mb-4">{t.pastries.nextSteps}</h3>

              {deliveryMode === 'pickup' ? (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-semibold text-blue-900 mb-3">{t.pastries.pickupInstructions}</p>
                    <h4 className="font-semibold text-blue-900 mb-2">{t.pastries.nextSteps}</h4>
                    <ul className="space-y-2">
                      <li className="flex gap-2 text-sm text-blue-800">
                        <span className="text-blue-900">✓</span>
                        <span>{t.pastries.confirmationEmailSent}</span>
                      </li>
                      <li className="flex gap-2 text-sm text-blue-800">
                        <span className="text-blue-900">✓</span>
                        <span>{t.pastries.presentReferenceAtPickup}</span>
                      </li>
                      <li className="flex gap-2 text-sm text-blue-800">
                        <span className="text-blue-900">✓</span>
                        <span>{t.pastries.paymentAtPickupLocation}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-semibold text-blue-900 mb-2">{t.pastries.deliveryAddress}</p>
                    <p className="text-sm text-blue-800">{order.delivery_address}</p>
                    {order.city && <p className="text-sm text-blue-800">{order.city}</p>}
                    <p className="text-sm text-blue-800 mt-3">{t.pastries.estimatedDelivery}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Information */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg mb-4">{t.checkout.paymentMethod}</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900 mb-2">
                  <span className="font-semibold">{paymentMethodLabels[paymentMethod]}</span>
                </p>

                {paymentMethod === 'bank_transfer' && (
                  <p className="text-sm text-amber-800">{(t.checkout as any).bankTransferInstructions || t.checkout.bankTransferDesc}</p>
                )}
                {paymentMethod === 'cheque' && (
                  <p className="text-sm text-amber-800">{t.checkout.chequeInstructions}</p>
                )}
                {paymentMethod === 'cash' && (
                  <p className="text-sm text-amber-800">{t.checkout.cashInstructions}</p>
                )}
                {paymentMethod === 'paypal' && (
                  <p className="text-sm text-amber-800">{t.checkout.paypalInstructions}</p>
                )}

                {deliveryMode === 'pickup' && (
                  <p className="text-sm text-amber-800 mt-2">{t.pastries.paymentOnPlacePickup}</p>
                )}
                {deliveryMode === 'delivery' && (
                  <p className="text-sm text-amber-800 mt-2">{t.pastries.paymentOnDelivery}</p>
                )}
              </div>
            </div>

            {/* Email Confirmation */}
            {order.email && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  ✓ {t.pastries.confirmationEmailSent}
                </p>
              </div>
            )}

            {/* Total Amount */}
            <div className="border-t pt-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{t.pastries.estimatedTotal}</span>
                <span className="text-3xl font-bold text-primary">{order.total_amount} DH</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/pastries')}
            className="flex-1"
          >
            {t.pastries.continueShopping}
          </Button>
          <Button
            onClick={() => setLocation('/')}
            className="flex-1"
          >
            {t.pastries.backToHome}
          </Button>
        </div>

        {/* Support Message */}
        <div className="mt-8 p-4 bg-muted rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            {t.pastries.teamWillContact}
          </p>
        </div>
      </div>
    </div>
  );
}
