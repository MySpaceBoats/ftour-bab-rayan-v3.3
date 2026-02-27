import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import PaymentMethodSelector, { type PaymentMethod } from '@/components/PaymentMethodSelector';
import PastriesConfirmation from '@/components/PastriesConfirmation';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

export default function Pastries() {
  const { t } = useI18n();
  const { cart: unifiedCart, addToCart: addToCartContext, updateQuantity: updateQuantityContext, removeFromCart: removeFromCartContext, getCartByType, clearCartByType } = useCart();
  const cart = getCartByType('pastry');
  const [step, setStep] = useState<'browse' | 'checkout' | 'success'>('browse');
  const [orderData, setOrderData] = useState<any>(null);
  const [formData, setFormData] = useState<{
    fullName: string;
    phone: string;
    email: string;
    deliveryMode: string;
    deliveryAddress: string;
    city: string;
    neighborhood: string;
    postalCode: string;
    contactPhone: string;
    deliveryInstructions: string;
    paymentMethod: PaymentMethod;
  }>({
    fullName: '',
    phone: '',
    email: '',
    deliveryMode: 'pickup',
    deliveryAddress: '',
    city: '',
    neighborhood: '',
    postalCode: '',
    contactPhone: '',
    deliveryInstructions: '',
    paymentMethod: 'bank_transfer',
  });

  const { data: pastries, isLoading } = trpc.pastries.list.useQuery();
  const createOrderMutation = trpc.pastryOrders.create.useMutation();

  const findPastryCartIndex = (pastryId: number) =>
    unifiedCart.findIndex(item => item.productType === 'pastry' && item.productId === pastryId);

  const addToCart = (pastry: any) => {
    addToCartContext({
      productType: 'pastry',
      productId: pastry.id,
      name: pastry.name,
      price: pastry.price,
      quantity: 1,
      imageUrl: pastry.image_url || undefined,
    });
    toast.success(t.pastries.addToCart);
  };

  const removeFromCart = (pastryId: number) => {
    const index = findPastryCartIndex(pastryId);
    if (index >= 0) {
      removeFromCartContext(index);
    }
  };

  const updateQuantity = (pastryId: number, quantity: number) => {
    const index = findPastryCartIndex(pastryId);
    const cartItem = cart.find(item => item.productId === pastryId);

    if (index < 0 || !cartItem) {
      return;
    }

    const delta = quantity - cartItem.quantity;
    if (delta !== 0) {
      updateQuantityContext(index, delta);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = formData.deliveryMode === 'delivery' ? 30 : 0;
  const estimatedTotal = cartTotal + deliveryFee;

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error(t.pastries.cartEmpty);
      return;
    }
    setStep('checkout');
  };

  const handleSubmitOrder = async () => {
    if (!formData.fullName || !formData.phone) {
      toast.error(t.pastries.fillInfo);
      return;
    }

    if (formData.deliveryMode === 'delivery' && !formData.deliveryAddress) {
      toast.error(t.pastries.deliveryAddress);
      return;
    }

    try {
      const result = await createOrderMutation.mutateAsync({
        customerName: formData.fullName,
        phone: formData.phone,
        email: formData.email || undefined,
        items: cart.map(item => ({
          pastryId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount: estimatedTotal,
        paymentMethod: formData.paymentMethod as any,
        channel: 'online',
      });

      setOrderData(result);
      setStep('success');
      clearCartByType('pastry');
      toast.success(t.pastries.confirmReservation);
    } catch (error) {
      toast.error(t.pastries.error || 'Erreur lors de la réservation');
    }
  };

  if (step === 'success' && orderData) {
    return <PastriesConfirmation order={orderData} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-12 border-b">
        <div className="container">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t.pastries.title}</h1>
          <p className="text-lg text-muted-foreground">{t.pastries.subtitle}</p>
        </div>
      </div>

      <div className="container py-12">
        {step === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pastries Grid */}
            <div className="lg:col-span-2">
              {isLoading ? (
                <div className="text-center py-12">{t.pastries.loading}</div>
              ) : !pastries || pastries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg text-muted-foreground">{t.pastries.noProducts}</p>
                  <p className="text-sm text-muted-foreground">{t.pastries.comingSoon}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pastries.map(pastry => (
                    <Card key={pastry.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      {pastry.image_url && (
                        <img
                          src={pastry.image_url}
                          alt={pastry.name}
                          className="w-full h-48 object-cover"
                        />
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-2">{pastry.name}</h3>
                        {pastry.description && (
                          <p className="text-sm text-muted-foreground mb-3">{pastry.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold text-primary">{pastry.price} DH</span>
                          <Button
                            onClick={() => addToCart(pastry)}
                            disabled={!pastry.active}
                            size="sm"
                          >
                            {pastry.active ? t.pastries.addToCart : t.pastries.outOfStock}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4 p-6">
                <h2 className="text-xl font-bold mb-4">{t.pastries.cartTitle}</h2>

                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">{t.pastries.cartEmpty}</p>
                ) : (
                  <>
                    <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-center justify-between text-sm border-b pb-2">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-muted-foreground">{item.price} DH × {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            >
                              −
                            </Button>
                            <span className="w-6 text-center">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            >
                              +
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.productId)}
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between">
                        <span>{t.pastries.subtotal}</span>
                        <span className="font-semibold">{cartTotal} DH</span>
                      </div>
                      {deliveryFee > 0 && (
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{t.pastries.deliveryFee}</span>
                          <span>{deliveryFee} DH</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold pt-2 border-t">
                        <span>{t.pastries.cartTotal}</span>
                        <span>{estimatedTotal} DH</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleCheckout}
                      className="w-full mt-4"
                      size="lg"
                    >
                      {t.pastries.checkout}
                    </Button>
                  </>
                )}
              </Card>
            </div>
          </div>
        )}

        {step === 'checkout' && (
          <div className="max-w-2xl mx-auto">
            <Card className="p-8">
              <h2 className="text-2xl font-bold mb-6">{t.pastries.checkout}</h2>

              <div className="space-y-6">
                {/* Customer Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t.pastries.fillInfo}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>{t.pastries.fullName}</Label>
                      <Input
                        value={formData.fullName}
                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder={t.pastries.fullName}
                      />
                    </div>
                    <div>
                      <Label>{t.pastries.phone}</Label>
                      <Input
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={t.pastries.phone}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>{t.pastries.email}</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder={t.pastries.email}
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Mode */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t.pastries.deliveryMode}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={formData.deliveryMode === 'pickup' ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, deliveryMode: 'pickup' })}
                      className="h-auto py-4"
                    >
                      {t.pastries.pickupAtLocation}
                    </Button>
                    <Button
                      variant={formData.deliveryMode === 'delivery' ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, deliveryMode: 'delivery' })}
                      className="h-auto py-4"
                    >
                      {t.pastries.homeDelivery}
                    </Button>
                  </div>
                </div>

                {/* Delivery Address */}
                {formData.deliveryMode === 'delivery' && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">{t.pastries.deliveryAddress}</h3>
                    <div className="space-y-3">
                      <Input
                        value={formData.deliveryAddress}
                        onChange={e => setFormData({ ...formData, deliveryAddress: e.target.value })}
                        placeholder={t.pastries.fullAddress}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          value={formData.city}
                          onChange={e => setFormData({ ...formData, city: e.target.value })}
                          placeholder={t.pastries.city}
                        />
                        <Input
                          value={formData.neighborhood}
                          onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                          placeholder={t.pastries.neighborhood}
                        />
                      </div>
                      <Input
                        value={formData.postalCode}
                        onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder={t.pastries.postalCode}
                      />
                      <Textarea
                        value={formData.deliveryInstructions}
                        onChange={e => setFormData({ ...formData, deliveryInstructions: e.target.value })}
                        placeholder={t.pastries.deliveryInstructions}
                      />
                    </div>
                  </div>
                )}

                {/* Payment Method */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">{t.checkout.paymentMethod}</h3>
                  <PaymentMethodSelector
                    value={formData.paymentMethod}
                    onChange={method => setFormData({ ...formData, paymentMethod: method })}
                  />
                </div>

                {/* Order Summary */}
                <Card className="bg-muted p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>{t.pastries.subtotal}</span>
                      <span className="font-semibold">{cartTotal} DH</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>{t.pastries.deliveryFee}</span>
                        <span>{deliveryFee} DH</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>{t.pastries.estimatedTotal}</span>
                      <span>{estimatedTotal} DH</span>
                    </div>
                  </div>
                </Card>

                {/* Actions */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep('browse')}
                    className="flex-1"
                  >
                    {t.pastries.continueShopping}
                  </Button>
                  <Button
                    onClick={handleSubmitOrder}
                    disabled={createOrderMutation.isPending}
                    className="flex-1"
                  >
                    {createOrderMutation.isPending ? t.pastries.processing : t.pastries.confirmReservation}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
