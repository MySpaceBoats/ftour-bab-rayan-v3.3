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
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-[#F8FAFC]" />
          <p className="text-[#F8FAFC]">{t.goodies.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
        <Card className="bg-[#1E293B] border-[#F8FAFC]/20 max-w-md">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-[#F8FAFC] mb-2">{t.goodies.error}</h3>
                <p className="text-[#CBD5E1] text-sm mb-4">
                  {error?.message || t.goodies.orderNotFound}
                </p>
                <Link href="/fr/goodies">
                  <Button className="w-full bg-[#F8FAFC] text-[#1E293B] hover:bg-[#CBD5E1]">
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
    <div className="min-h-screen bg-[#0F172A] py-12" dir={dir}>
      <div className="container max-w-2xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="text-4xl font-bold text-[#F8FAFC]">
            {t.goodies.orderConfirmed}
          </h1>
          <p className="text-lg text-[#CBD5E1]">
            {t.goodies.orderSuccessMessage}
          </p>
        </div>

        {/* Reference & Amount */}
        <Card className="bg-[#1E293B] border-[#F8FAFC]/20">
          <CardContent className="pt-6 space-y-4">
            <div className="bg-[#0F172A] rounded-lg p-4">
              <p className="text-[#CBD5E1] text-sm mb-2">{t.goodies.orderReference}</p>
              <p className="text-2xl font-bold text-[#F8FAFC]">{order.orderReference}</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[#CBD5E1]">
                <span>{t.goodies.subtotal}</span>
                <span>{(order.totalAmount - (order.deliveryFee || 0)).toFixed(0)} DH</span>
              </div>
              {isHomeDelivery && order.deliveryFee && (
                <div className="flex justify-between text-[#CBD5E1]">
                  <span>{t.goodies.deliveryFee}</span>
                  <span>{order.deliveryFee.toFixed(0)} DH</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-[#F8FAFC] border-t border-[#F8FAFC]/20 pt-2">
                <span>{t.goodies.totalToPay}</span>
                <span>{order.totalAmount.toFixed(0)} DH</span>
              </div>
              <p className="text-sm text-[#CBD5E1] mt-3">
                {isHomeDelivery ? t.goodies.paymentOnDelivery : t.goodies.paymentOnPlacePickup}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Conditional Content Based on Delivery Mode */}
        {isHomeDelivery ? (
          // Home Delivery Variant
          <Card className="bg-[#1E293B] border-[#F8FAFC]/20">
            <CardHeader>
              <CardTitle className="text-[#F8FAFC]">{t.goodies.deliveryAddress}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[#0F172A] rounded-lg p-4 space-y-3">
                <p className="text-[#CBD5E1] text-sm">{t.goodies.yourOrderWillBeDeliveredTo}</p>
                
                {/* Address Display */}
                <div className="space-y-2 text-[#F8FAFC]">
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
                    <div className="mt-3 pt-3 border-t border-[#F8FAFC]/20">
                      <p className="text-sm text-[#CBD5E1]">{t.goodies.deliveryInstructions}:</p>
                      <p className="text-[#F8FAFC]">{order.deliveryInstructions}</p>
                    </div>
                  )}
                </div>

                {/* Contact Phone (Masked) */}
                {order.deliveryPhone && (
                  <div className="mt-3 pt-3 border-t border-[#F8FAFC]/20">
                    <p className="text-sm text-[#CBD5E1]">{t.goodies.contactPhone}:</p>
                    <p className="text-[#F8FAFC]">{maskPhone(order.deliveryPhone)}</p>
                  </div>
                )}
              </div>

              {/* Next Steps for Home Delivery */}
              <div className="bg-[#0F172A] rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-[#F8FAFC] mb-3">{t.goodies.nextSteps}</h4>
                <ul className="space-y-2 text-[#CBD5E1] text-sm">
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
                    <span>{t.goodies.confirmationEmailSent}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
                    <span>{t.goodies.deliveryInstructions}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
                    <span>{t.goodies.paymentOnPlacePickup}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
                    <span>{t.goodies.thankYouForSupport}</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Pickup Variant
          <Card className="bg-[#1E293B] border-[#F8FAFC]/20">
            <CardHeader>
              <CardTitle className="text-[#F8FAFC]">{t.goodies.pickupInstructions}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[#0F172A] rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-[#F8FAFC]">{t.goodies.presentYourReference}</h4>
                <p className="text-[#CBD5E1]">{t.goodies.presentReferenceAtPickup}</p>
                <p className="text-sm text-[#CBD5E1] mt-3">{t.goodies.paymentOnPlacePickup}</p>
              </div>

              {/* Next Steps for Pickup */}
              <div className="bg-[#0F172A] rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-[#F8FAFC] mb-3">{t.goodies.nextSteps}</h4>
                <ul className="space-y-2 text-[#CBD5E1] text-sm">
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
                    <span>{t.goodies.confirmationEmailSent}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
                    <span>{t.goodies.presentReferenceAtPickup}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
                    <span>{t.goodies.paymentAtPickupLocation}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#F8FAFC]">✓</span>
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
            <Button className="bg-[#F8FAFC] text-[#1E293B] hover:bg-[#CBD5E1]">
              {t.goodies.continueShopping}
            </Button>
          </Link>
          <Link href="/fr">
            <Button variant="outline" className="border-[#F8FAFC] text-[#F8FAFC] hover:bg-[#F8FAFC]/10">
              {t.goodies.backToHome}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
