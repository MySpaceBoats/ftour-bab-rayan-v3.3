import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Package, ShoppingCart, Minus, Plus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { useCart } from '@/contexts/CartContext';
import TerroirProductCard from '@/features/terroir/components/TerroirProductCard';
import TerroirCheckout from '@/features/terroir/pages/TerroirCheckout';
import TerroirConfirmation from '@/features/terroir/pages/TerroirConfirmation';
import { type PaymentMethod } from '@/components/PaymentMethodSelector';

export default function Terroir() {
  const { t, lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const {
    addToCart,
    updateQuantity,
    removeFromCart,
    getCartByType,
    getCartCountByType,
    clearCartByType,
    getCartIndexByType,
  } = useCart();

  const [step, setStep] = useState<'browse' | 'checkout' | 'success'>('browse');
  const [orderResult, setOrderResult] = useState<{ reference: string; total: number } | null>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: '',
    paymentMethod: 'bank_transfer' as PaymentMethod,
  });

  const { data: products, isLoading, isError, error, refetch } = trpc.terroirModule.listProducts.useQuery();
  const createOrderMutation = trpc.terroirModule.createOrder.useMutation();

  const terroirCart = getCartByType('terroir');
  const terroirCartCount = getCartCountByType('terroir');

  const getFallbackVariant = (product: any) => {
    const fallbackPrice = Number(product?.price_unit ?? product?.price ?? 0);
    if (!Number.isFinite(fallbackPrice) || fallbackPrice <= 0) {
      return null;
    }

    return {
      id: undefined,
      label: 'Format unique',
      price_unit: fallbackPrice,
      stock_total: null,
      stock_reserved: null,
      is_active: true,
      isFallback: true,
    };
  };

  const cartTotal = useMemo(
    () => terroirCart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [terroirCart]
  );

  const handleAddToCart = (product: any, variant: any) => {
    if (!variant) {
      toast.error('Aucune variante disponible');
      return;
    }

    addToCart({
      productType: 'terroir',
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variant: variant.label,
      price: Number(variant.price_unit) || 0,
      quantity: 1,
      imageUrl: product.image_url || undefined,
    });

    toast.success(t.terroir.addedToCart);
  };

  const handleUpdateQuantity = (productId: number, variantId: number | undefined, nextQuantity: number) => {
    const index = getCartIndexByType('terroir', productId, variantId);
    const existing = terroirCart.find(item => item.productId === productId && item.variantId === variantId);

    if (index < 0 || !existing) {
      return;
    }

    const delta = nextQuantity - existing.quantity;
    if (delta !== 0) {
      updateQuantity(index, delta);
    }
  };

  const handleRemove = (productId: number, variantId: number | undefined) => {
    const index = getCartIndexByType('terroir', productId, variantId);
    if (index >= 0) {
      removeFromCart(index);
    }
  };

  const handleCheckout = () => {
    if (terroirCart.length === 0) {
      toast.error('Votre panier est vide');
      return;
    }
    setStep('checkout');
  };

  const submitOrder = async () => {
    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      toast.error(t.terroir.fillInfo);
      return;
    }

    if (terroirCart.length === 0) {
      toast.error('Votre panier est vide');
      setStep('browse');
      return;
    }

    try {
      const result = await createOrderMutation.mutateAsync({
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail || undefined,
        notes: formData.notes || undefined,
        items: terroirCart.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      });

      setOrderResult({
        reference: result.order_reference,
        total: Number(result.total_amount) || 0,
      });
      clearCartByType('terroir');
      setStep('success');
      toast.success(t.terroir.reservationConfirmed);
    } catch (err: any) {
      toast.error(err?.message || t.terroir.reservationError);
    }
  };

  if (step === 'success' && orderResult) {
    return (
      <TerroirConfirmation
        reference={orderResult.reference}
        total={orderResult.total}
        onBackToCatalog={() => {
          setOrderResult(null);
          setStep('browse');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      <Navbar />
      <main className="container flex-1 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t.terroir.title}</h1>
            <p className="text-muted-foreground">{t.terroir.subtitle}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-sm font-medium">
            <ShoppingCart className="h-4 w-4" />
            <span>{terroirCartCount}</span>
          </div>
        </div>

        {step === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2">
              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  {t.common.loading}
                </div>
              ) : isError ? (
                <div className="py-16 text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                  <p className="font-semibold mb-2">{t.terroir.loadError}</p>
                  <p className="text-sm text-muted-foreground mb-4">{error?.message}</p>
                  <Button variant="outline" onClick={() => refetch()}>
                    Réessayer
                  </Button>
                </div>
              ) : !products || products.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3" />
                  <p>{t.terroir.noProducts}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {products.map(product => {
                    const configuredVariants = product.terroir_product_variants?.filter((v: any) => v.is_active !== false) || [];
                    const variants = configuredVariants.length > 0 ? configuredVariants : [getFallbackVariant(product)].filter(Boolean);
                    return (
                      <TerroirProductCard
                        key={product.id}
                        product={product}
                        variants={variants as any[]}
                        onAddToCart={handleAddToCart}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <aside>
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    {t.terroir.yourCart}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {terroirCart.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Votre panier est vide</p>
                  ) : (
                    <div className="space-y-3">
                      {terroirCart.map(item => (
                        <div key={`${item.productId}-${item.variantId}`} className="border rounded-md p-3">
                          <p className="font-medium text-sm">{item.name}</p>
                          {item.variant && <p className="text-xs text-muted-foreground mb-2">{item.variant}</p>}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.productId, item.variantId, item.quantity - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center text-sm">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.productId, item.variantId, item.quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleRemove(item.productId, item.variantId)}>
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="border-t pt-3 flex items-center justify-between font-semibold">
                        <span>{t.terroir.total}</span>
                        <span>{cartTotal} DH</span>
                      </div>

                      <Button className="w-full" onClick={handleCheckout}>
                        {t.terroir.finalizeReservation}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        )}

        {step === 'checkout' && (
          <TerroirCheckout
            formData={formData}
            cartCount={terroirCartCount}
            cartTotal={cartTotal}
            isSubmitting={createOrderMutation.isPending}
            onFormChange={setFormData}
            onBack={() => setStep('browse')}
            onSubmit={submitOrder}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
