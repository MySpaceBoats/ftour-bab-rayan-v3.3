import { useState } from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { toast } from 'sonner';
import { ShoppingCart, Plus, Minus, X, Leaf, MapPin, Truck, Loader2, Package, RefreshCw, AlertTriangle, CheckCircle, Heart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import PaymentMethodSelector, { PaymentMethod } from '@/components/PaymentMethodSelector';

export default function ProduitsTerroir() {
  const { t, lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const { data: products, isLoading, isError, error, refetch } = trpc.terroirModule.listProducts.useQuery();
  const { cart, addToCart: addToCartContext, updateQuantity, removeFromCart, getCartByType, getCartCountByType, getCartTotalByType, clearCartByType } = useCart();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{ reference: string; total: number } | null>(null);

  const [checkoutForm, setCheckoutForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: '',
    paymentMethod: 'cash' as PaymentMethod,
  });

  const createOrderMutation = trpc.terroirModule.createOrder.useMutation({
    onSuccess: (data) => {
      setOrderSuccess({ reference: data.order_reference, total: parseFloat(data.total_amount) });
      clearCartByType('terroir');
      setIsCheckoutOpen(false);
      toast.success(t.terroir.reservationConfirmed);
    },
    onError: (error) => {
      toast.error(error.message || t.terroir.reservationError);
    },
  });

  const terroirCart = getCartByType('terroir');
  const terroirCartCount = getCartCountByType('terroir');
  const terroirCartTotal = getCartTotalByType('terroir');

  // Find the index in the full cart for a terroir cart item
  const getFullCartIndex = (item: typeof terroirCart[number]) =>
    cart.findIndex(ci => ci.productType === 'terroir' && ci.productId === item.productId && ci.variantId === item.variantId);

  const addToCart = (product: NonNullable<typeof products>[number], variant?: any) => {
    addToCartContext({
      productType: 'terroir',
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      variant: variant?.label,
      price: variant ? parseFloat(variant.price_unit) : 0,
      quantity: 1,
      imageUrl: product.image_url || undefined,
    });

    setSelectedProduct(null);
    toast.success(t.terroir.addedToCart);
  };

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();

    createOrderMutation.mutate({
      customerName: checkoutForm.customerName,
      customerPhone: checkoutForm.customerPhone,
      customerEmail: checkoutForm.customerEmail || undefined,
      notes: checkoutForm.notes || undefined,
      items: terroirCart.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
    });
  };

  const currentProduct = products?.find(p => p.id === selectedProduct);

  // Confirmation page
  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col" dir={dir}>
        <Navbar />
        <main className="flex-1 bg-gradient-to-b from-amber-50 to-background py-12">
          <div className="container max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-4 mb-8">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <h1 className="text-4xl font-bold text-foreground">
                {t.terroir.reservationConfirmed}
              </h1>
              <p className="text-lg text-muted-foreground">
                Votre commande a bien été enregistrée. Vous recevrez un email de confirmation.
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Référence de commande</p>
                  <p className="text-2xl font-bold text-amber-700 font-mono">{orderSuccess.reference}</p>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-4">
                  <span>{t.terroir.total}</span>
                  <span className="text-amber-700">{orderSuccess.total} DH</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prochaines étapes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Un email de confirmation vous a été envoyé avec votre QR code</span>
                </div>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Présentez votre QR code ou référence lors du retrait</span>
                </div>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Paiement sur place lors du retrait de votre commande</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => setOrderSuccess(null)} className="bg-amber-600 hover:bg-amber-700">
                Continuer les achats
              </Button>
              <Link href={`/${lang}`}>
                <Button variant="outline">Retour à l'accueil</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-amber-50 to-background">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-900 text-sm font-medium">
                <Leaf className="h-4 w-4" />
                {t.terroir.badge}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                {t.terroir.title.split('Terroir')[0]}
                <span className="text-amber-700">Terroir</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                {t.terroir.subtitle}
              </p>
              <p className="text-sm text-amber-700 font-medium">
                {t.terroir.allBenefits}
              </p>
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-16">
          <div className="container">
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse overflow-hidden">
                    <div className="h-48 bg-muted" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : isError ? (
              <div className="text-center py-16">
                <AlertTriangle className="h-16 w-16 mx-auto text-red-400/60 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t.terroir.loadError}</h3>
                <p className="text-muted-foreground mb-4">{error?.message}</p>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t.terroir.retry}
                </Button>
              </div>
            ) : products && products.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => {
                  const variants = product.terroir_product_variants?.filter((v: any) => v.is_active) || [];
                  const minPrice = variants.length > 0
                    ? Math.min(...variants.map((v: any) => parseFloat(v.price_unit)))
                    : 0;

                  return (
                    <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                      <div className="bg-gradient-to-br from-amber-100 to-orange-100 h-48 flex items-center justify-center relative overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <Package className="h-16 w-16 text-amber-700/30" />
                        )}
                      </div>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {product.category && (
                              <p className="text-xs font-medium text-amber-700 mb-1">{product.category}</p>
                            )}
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                        )}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <span className="text-2xl font-bold text-amber-700">
                            {variants.length > 1 ? `${minPrice}+ DH` : variants.length === 1 ? `${parseFloat(variants[0].price_unit)} DH` : '—'}
                          </span>
                          <Button
                            onClick={() => {
                              if (variants.length > 1) {
                                setSelectedProduct(product.id);
                              } else if (variants.length === 1) {
                                addToCart(product, variants[0]);
                              }
                            }}
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700"
                            disabled={variants.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {t.terroir.addToCart}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{t.terroir.noProducts}</h3>
                <p className="text-muted-foreground">{t.terroir.comingSoon}</p>
              </div>
            )}
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-none bg-transparent">
                <CardContent className="pt-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.terroir.authentic}</h3>
                  <p className="text-muted-foreground">{t.terroir.authenticDesc}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-none bg-transparent">
                <CardContent className="pt-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.terroir.localSupport}</h3>
                  <p className="text-muted-foreground">{t.terroir.localSupportDesc}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-none bg-transparent">
                <CardContent className="pt-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-semibold text-lg">{t.terroir.fastDelivery}</h3>
                  <p className="text-muted-foreground">{t.terroir.fastDeliveryDesc}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-amber-600 to-orange-600 text-white">
          <div className="container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Soutenez les Producteurs Marocains
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              En achetant nos produits du terroir, vous contribuez directement à l'économie locale et aux actions solidaires de Bab Rayan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/${lang}/dons`}>
                <Button size="lg" variant="secondary">
                  <Heart className="h-5 w-5 mr-2" />
                  Faire un don
                </Button>
              </Link>
              <Link href={`/${lang}/benevole`}>
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10">
                  Devenir bénévole
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Cart Button */}
      {terroirCart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 bg-amber-600 text-white p-4 rounded-full shadow-lg hover:bg-amber-700 transition-colors z-50"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-white text-amber-700 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {terroirCartCount}
          </span>
        </button>
      )}

      {/* Variant Selection Dialog */}
      <Dialog open={selectedProduct !== null} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.terroir.selectVariant}</DialogTitle>
            <DialogDescription>{t.terroir.chooseVariant}</DialogDescription>
          </DialogHeader>
          {currentProduct && (
            <div className="space-y-3">
              {currentProduct.terroir_product_variants
                ?.filter((v: any) => v.is_active)
                .map((variant: any) => {
                  const available = variant.stock_total - variant.stock_reserved;
                  const outOfStock = available <= 0;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => !outOfStock && addToCart(currentProduct, variant)}
                      disabled={outOfStock}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div>
                        <p className="font-medium">{variant.label}</p>
                        {outOfStock && <p className="text-xs text-red-500">Rupture de stock</p>}
                      </div>
                      <span className="font-bold text-amber-700">{parseFloat(variant.price_unit)} DH</span>
                    </button>
                  );
                })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.terroir.yourCart}</DialogTitle>
            <DialogDescription>{terroirCartCount} {t.terroir.articles}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {terroirCart.map((item) => {
              const fullIndex = getFullCartIndex(item);
              return (
                <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{item.name}</h4>
                    {item.variant && <p className="text-sm text-muted-foreground">{item.variant}</p>}
                    <p className="text-amber-700 font-semibold">{item.price} DH</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(fullIndex, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(fullIndex, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400" onClick={() => removeFromCart(fullIndex)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t pt-4 space-y-4">
            <div className="flex justify-between text-lg font-bold">
              <span>{t.terroir.total}</span>
              <span className="text-amber-700">{terroirCartTotal} DH</span>
            </div>
            <Button
              onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {t.terroir.reserve}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.terroir.finalizeReservation}</DialogTitle>
            <DialogDescription>{t.terroir.fillInfo}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="terroir-name">{t.terroir.fullName}</Label>
              <Input
                id="terroir-name"
                value={checkoutForm.customerName}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terroir-email">{t.terroir.email}</Label>
              <Input
                id="terroir-email"
                type="email"
                value={checkoutForm.customerEmail}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terroir-phone">{t.terroir.phone}</Label>
              <Input
                id="terroir-phone"
                type="tel"
                value={checkoutForm.customerPhone}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                required
              />
            </div>

            {/* Payment Method */}
            <PaymentMethodSelector
              value={checkoutForm.paymentMethod}
              onChange={(method) => setCheckoutForm(prev => ({ ...prev, paymentMethod: method }))}
              availableMethods={['bank_transfer', 'cheque', 'cash']}
              showDescriptions={true}
            />

            {/* Price Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t.terroir.subtotal}</span>
                <span>{terroirCartTotal} DH</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{t.terroir.total}</span>
                <span className="text-amber-700">{terroirCartTotal} DH</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.terroir.processing}
                </>
              ) : (
                t.terroir.confirmReservation
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
