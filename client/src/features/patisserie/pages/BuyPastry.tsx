import { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import PaymentMethodSelector from '@/components/PaymentMethodSelector';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

export default function BuyPastry() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/:lang/buy/pastry/:id');
  const { t } = useI18n();
  const pastryId = params?.id ? parseInt(params.id) : null;

  const [quantity, setQuantity] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    paymentMethod: 'cash' as const,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: pastries, isLoading } = trpc.pastries.list.useQuery();
  const pastry = pastries?.find((p: any) => p.id === pastryId) ?? null;

  const createOrderMutation = trpc.pastryOrders.create.useMutation();

  const handleSubmitOrder = async () => {
    if (!formData.fullName || !formData.phone || !pastry) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrderMutation.mutateAsync({
        customerName: formData.fullName,
        phone: formData.phone,
        email: formData.email || undefined,
        items: [
          {
            pastryId: pastry.id,
            quantity,
            price: pastry.price,
          },
        ],
        totalAmount: pastry.price * quantity,
        paymentMethod: formData.paymentMethod as any,
        channel: 'on_site_qr',
      });

      setLocation(`/${params?.lang}/`);
    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!match) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-8 border-b">
        <div className="container">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/${params?.lang}/pastries`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.pastries?.backToPastries || 'Back to Pastries'}
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{t.pastries?.expressCheckout || 'Express Checkout'}</h1>
        </div>
      </div>

      <div className="container py-12">
        {isLoading ? (
          <div className="text-center py-12">{t.pastries?.loading || 'Loading...'}</div>
        ) : !pastry ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">{t.pastries?.productNotFound || 'Product not found'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Product Details */}
            <div className="lg:col-span-1">
              <Card className="overflow-hidden sticky top-4">
                {pastry.image_url && (
                  <img
                    src={pastry.image_url}
                    alt={pastry.name}
                    className="w-full h-64 object-cover"
                  />
                )}
                <div className="p-6">
                  <h2 className="text-2xl font-bold mb-2">{pastry.name}</h2>
                  {pastry.description && (
                    <p className="text-muted-foreground mb-4">{pastry.description}</p>
                  )}

                  {/* Quantity Selector */}
                  <div className="mb-6">
                    <Label className="mb-2 block">{t.pastries?.quantity || 'Quantity'}</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        −
                      </Button>
                      <span className="w-12 text-center font-semibold">{quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="bg-muted p-4 rounded-lg mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-muted-foreground">{t.pastries?.unitPrice || 'Unit Price'}</span>
                      <span className="font-semibold">{pastry.price} DH</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                      <span>{t.pastries?.cartTotal || 'Total'}</span>
                      <span className="text-primary">{pastry.price * quantity} DH</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting}
                    className="w-full"
                    size="lg"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    {isSubmitting ? t.pastries?.processing || 'Processing...' : t.pastries?.completeOrder || 'Complete Order'}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <Card className="p-8">
                <h2 className="text-2xl font-bold mb-6">{t.pastries?.customerInfo || 'Customer Information'}</h2>

                <div className="space-y-6">
                  {/* Customer Details */}
                  <div className="space-y-4">
                    <div>
                      <Label>{t.pastries?.fullName || 'Full Name'}</Label>
                      <Input
                        value={formData.fullName}
                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder={t.pastries?.fullName || 'Full Name'}
                        required
                      />
                    </div>

                    <div>
                      <Label>{t.pastries?.phone || 'Phone'}</Label>
                      <Input
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={t.pastries?.phone || 'Phone'}
                        required
                      />
                    </div>

                    <div>
                      <Label>{t.pastries?.email || 'Email'} ({t.pastries?.optional || 'Optional'})</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder={t.pastries?.email || 'Email'}
                      />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">{t.checkout?.paymentMethod || 'Payment Method'}</h3>
                    <PaymentMethodSelector
                      value={formData.paymentMethod}
                      onChange={(method: any) => setFormData({ ...formData, paymentMethod: method })}
                      availableMethods={['cash', 'bank_transfer', 'check', 'paypal'] as any}
                    />
                  </div>

                  {/* Info Message */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      {t.pastries?.expressCheckout || 'This is an express checkout. Your order will be processed immediately.'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
