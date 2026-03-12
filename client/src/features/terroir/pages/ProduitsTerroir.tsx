import { useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { trpc } from '@/lib/trpc';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle, Loader2, Minus, Package, Plus, ShoppingCart } from 'lucide-react';

export default function ProduitsTerroir() {
  const { t, lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { cart: unifiedCart, addToCart, updateQuantity, removeFromCart, getCartByType, clearCartByType } = useCart();
  const [step, setStep] = useState<'browse' | 'checkout' | 'success'>('browse');
  const [orderResult, setOrderResult] = useState<{ reference: string; total: number } | null>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: '',
  });

  const { data: products, isLoading, isError, error, refetch } = trpc.terroirModule.listProducts.useQuery();
  const createOrderMutation = trpc.terroirModule.createOrder.useMutation();

  const terroirCart = getCartByType('terroir');

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

  const findCartIndex = (productId: number, variantId?: number) =>
    unifiedCart.findIndex(
      item => item.productType === 'terroir' && item.productId === productId && item.variantId === variantId
    );

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
    const index = findCartIndex(productId, variantId);
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
    const index = findCartIndex(productId, variantId);
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
      <div className="min-h-screen flex flex-col bg-background" dir={dir}>
        <Navbar />
        <main className="container flex-1 py-12 max-w-2xl">
          <Card>
            <CardContent className="pt-8 text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
              <h1 className="text-3xl font-bold">{t.terroir.reservationConfirmed}</h1>
              <p className="text-muted-foreground">Votre commande terroir a bien été enregistrée.</p>
              <div className="rounded-lg bg-amber-50 p-4 border">
                <p className="text-sm text-muted-foreground">Référence</p>
                <p className="text-2xl font-semibold text-amber-700 font-mono">{orderResult.reference}</p>
              </div>
              <p className="text-lg font-semibold">Total: {orderResult.total} DH</p>
              <Button onClick={() => setStep('browse')}>Continuer mes achats</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={dir}>
      <Navbar />
      <main className="container flex-1 py-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t.terroir.title}</h1>
          <p className="text-muted-foreground">{t.terroir.subtitle}</p>
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
                    const first = variants[0];
                    return (
                      <Card key={product.id} className="overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-52 object-contain bg-muted p-2" />
                        ) : (
                          <div className="h-44 bg-muted flex items-center justify-center">
                            <Package className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        <CardContent className="p-4 space-y-3">
                          <h3 className="font-semibold text-lg">{product.name}</h3>
                          {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
                          <div className="space-y-2">
                            {variants.map((variant: any) => {
                              const hasStockTracking = variant.stock_total != null;
                              const totalStock = Number(variant.stock_total ?? variant.stock ?? 0);
                              const reservedStock = Number(variant.stock_reserved ?? 0);
                              const availableStock = Math.max(0, totalStock - reservedStock);
                              const isOutOfStock = hasStockTracking && availableStock <= 0;
                              const inStockLabel = hasStockTracking
                                ? `${t.terroir.inStock || 'En stock'} (${availableStock})`
                                : (t.terroir.inStock || 'En stock');

                              return (
                              <div key={variant.id ?? `fallback-${product.id}`} className="flex items-center justify-between border rounded-md p-2">
                                <div>
                                  <p className="text-sm font-medium">{variant.label}</p>
                                  <p className="text-xs text-muted-foreground">{Number(variant.price_unit)} DH</p>
                                  <p className={`text-xs font-medium ${isOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                                    {isOutOfStock ? (t.terroir.outOfStock || 'Rupture de stock') : inStockLabel}
                                  </p>
                                </div>
                                <Button size="sm" disabled={isOutOfStock} onClick={() => handleAddToCart(product, variant)}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  {isOutOfStock ? (t.terroir.outOfStock || 'Rupture de stock') : t.terroir.addToCart}
                                </Button>
                              </div>
                              );
                            })}
                          </div>
                          {variants.length === 0 && (
                            <Button size="sm" disabled className="w-full">
                              Indisponible
                            </Button>
                          )}
                          {variants.length > 0 && (
                            <p className="text-sm text-muted-foreground">À partir de {Number(first?.price_unit) || 0} DH</p>
                          )}
                        </CardContent>
                      </Card>
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
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>{t.terroir.finalizeReservation}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t.terroir.fullName}</Label>
                  <Input
                    value={formData.customerName}
                    onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder={t.terroir.fullName}
                  />
                </div>
                <div>
                  <Label>{t.terroir.phone}</Label>
                  <Input
                    value={formData.customerPhone}
                    onChange={e => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder={t.terroir.phone}
                  />
                </div>
                <div>
                  <Label>{t.terroir.email}</Label>
                  <Input
                    type="email"
                    value={formData.customerEmail}
                    onChange={e => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    placeholder={t.terroir.email}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Informations complémentaires (optionnel)"
                  />
                </div>

                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium mb-1">Récapitulatif</p>
                  <p>{terroirCart.length} article(s)</p>
                  <p className="font-semibold">Total: {cartTotal} DH</p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('browse')} className="flex-1">
                    Retour
                  </Button>
                  <Button onClick={submitOrder} className="flex-1" disabled={createOrderMutation.isPending}>
                    {createOrderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Valider la commande
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
