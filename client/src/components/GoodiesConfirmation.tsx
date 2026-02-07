import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';

interface GoodiesConfirmationProps {
  orderReference: string;
  onClose?: () => void;
}

export default function GoodiesConfirmation({ orderReference, onClose }: GoodiesConfirmationProps) {
  const { t, lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  
  const { data: order, isLoading, error } = trpc.orders.getByReference.useQuery({ reference: orderReference });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#5E5B34]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-[#F2E9D3]" />
          <p className="text-[#F2E9D3]">{t.goodies.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#5E5B34]">
        <Card className="bg-[#4A4829] border-[#F2E9D3]/20 max-w-md">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-[#F2E9D3] mb-2">{t.goodies.error}</h3>
                <p className="text-[#E6DCC3] text-sm mb-4">
                  {error?.message || t.goodies.orderNotFound}
                </p>
                <Link href="/fr/goodies">
                  <Button className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]">
                    {t.goodies.continueShopping}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isHomeDelivery = order.deliveryMode === 'home_delivery';
  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 4) return phone;
    return `${phone.substring(0, 2)}•••••${phone.substring(phone.length - 2)}`;
  };

  return (
    <div className="min-h-screen bg-[#5E5B34] py-12" dir={dir}>
      <div className="container max-w-2xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-4xl font-bold text-[#F2E9D3]">
            {t.goodies.orderConfirmed}
          </h1>
          <p className="text-lg text-[#E6DCC3]">
            {t.goodies.orderSuccessMessage}
          </p>
        </div>

        {/* Reference & Amount */}
        <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
          <CardContent className="pt-6 space-y-4">
            <div className="bg-[#5E5B34] rounded-lg p-4">
              <p className="text-[#E6DCC3] text-sm mb-2">{t.goodies.orderReference}</p>
              <p className="text-2xl font-bold text-[#F2E9D3]">{order.orderReference}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[#E6DCC3]">
                <span>{t.goodies.subtotal}</span>
                <span>{(order.totalAmount - (order.deliveryFee || 0)).toFixed(0)} DH</span>
              </div>
              {isHomeDelivery && order.deliveryFee && (
                <div className="flex justify-between text-[#E6DCC3]">
                  <span>{t.goodies.deliveryFee}</span>
                  <span>{order.deliveryFee.toFixed(0)} DH</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-[#F2E9D3] border-t border-[#F2E9D3]/20 pt-2">
                <span>{t.goodies.totalToPay}</span>
                <span>{order.totalAmount.toFixed(0)} DH</span>
              </div>
              <p className="text-sm text-[#E6DCC3] mt-3">
                {isHomeDelivery ? t.goodies.paymentOnDelivery : t.goodies.paymentOnPlacePickup}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Conditional Content Based on Delivery Mode */}
        {isHomeDelivery ? (
          // Home Delivery Variant
          <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
            <CardHeader>
              <CardTitle className="text-[#F2E9D3]">{t.goodies.deliveryAddress}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[#5E5B34] rounded-lg p-4 space-y-3">
                <p className="text-[#E6DCC3] text-sm">{t.goodies.yourOrderWillBeDeliveredTo}</p>
                
                {/* Address Display */}
                <div className="space-y-2 text-[#F2E9D3]">
                  {order.deliveryAddress && (
                    <p className="font-semibold">{order.deliveryAddress}</p>
                  )}
                  {order.deliveryCity && order.deliveryNeighborhood && (
                    <p>{order.deliveryCity}, {order.deliveryNeighborhood}</p>
                  )}
                  {order.deliveryPostalCode && (
                    <p>{t.goodies.postalCode}: {order.deliveryPostalCode}</p>
                  )}
                  {order.deliveryInstructions && (
                    <div className="mt-3 pt-3 border-t border-[#F2E9D3]/20">
                      <p className="text-sm text-[#E6DCC3]">{t.goodies.instructions}:</p>
                      <p className="text-[#F2E9D3]">{order.deliveryInstructions}</p>
                    </div>
                  )}
                </div>

                {/* Contact Phone (Masked) */}
                {order.deliveryPhone && (
                  <div className="mt-3 pt-3 border-t border-[#F2E9D3]/20">
                    <p className="text-sm text-[#E6DCC3]">{t.goodies.contactPhone}:</p>
                    <p className="text-[#F2E9D3]">{maskPhone(order.deliveryPhone)}</p>
                  </div>
                )}
              </div>

              {/* Next Steps for Home Delivery */}
              <div className="bg-[#5E5B34] rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-[#F2E9D3] mb-3">{t.goodies.nextSteps}</h4>
                <ul className="space-y-2 text-[#E6DCC3] text-sm">
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.confirmationEmailSent}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.teamWillContact}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.paymentOnPlacePickup}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.thankYouForSupport}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Pickup Variant
          <Card className="bg-[#4A4829] border-[#F2E9D3]/20">
            <CardHeader>
              <CardTitle className="text-[#F2E9D3]">{t.goodies.pickupInstructions}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[#5E5B34] rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-[#F2E9D3]">{t.goodies.presentYourReference}</h4>
                <p className="text-[#E6DCC3]">{t.goodies.presentReferenceAtPickup}</p>
                <p className="text-sm text-[#E6DCC3] mt-3">{t.goodies.paymentOnPlacePickupMessage}</p>
              </div>

              {/* Next Steps for Pickup */}
              <div className="bg-[#5E5B34] rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-[#F2E9D3] mb-3">{t.goodies.nextSteps}</h4>
                <ul className="space-y-2 text-[#E6DCC3] text-sm">
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.confirmationEmailSent}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.presentReferenceAtPickup}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.paymentAtPickupLocation}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F2E9D3]">✓</span>
                    <span>{t.goodies.thankYouForSupport}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Buttons */}
        <div className="flex gap-4 justify-center">
          <Link href="/fr/goodies">
            <Button className="bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]">
              {t.goodies.continueShopping}
            </Button>
          </Link>
          <Link href="/fr">
            <Button variant="outline" className="border-[#F2E9D3] text-[#F2E9D3] hover:bg-[#F2E9D3]/10">
              {t.goodies.backToHome}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
