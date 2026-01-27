import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { ShoppingBag, Plus, Minus, ShoppingCart, X, CheckCircle, Loader2, Package } from "lucide-react";
import { useI18n } from "@/i18n";

type CartItem = {
  goodieId: number;
  variantId?: number;
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

export default function Goodies() {
  const { t, lang } = useI18n();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  
  const { data: goodies, isLoading } = trpc.goodies.list.useQuery();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedGoodie, setSelectedGoodie] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [orderSuccess, setOrderSuccess] = useState<{ reference: string; total: number } | null>(null);
  
  const [checkoutForm, setCheckoutForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      setOrderSuccess({ reference: data.orderReference, total: data.totalAmount });
      setCart([]);
      setIsCheckoutOpen(false);
      toast.success(t.goodies.reservationConfirmed);
    },
    onError: (error) => {
      toast.error(error.message || t.goodies.reservationError);
    },
  });

  const addToCart = (goodie: NonNullable<typeof goodies>[number]) => {
    const variant = goodie.variants?.find((v: { id: number }) => v.id.toString() === selectedVariant);
    const price = goodie.price + (variant?.priceModifier ? Number(variant.priceModifier) : 0);
    
    const existingIndex = cart.findIndex(
      item => item.goodieId === goodie.id && item.variantId === (variant?.id || undefined)
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, {
        goodieId: goodie.id,
        variantId: variant?.id,
        name: goodie.name,
        variant: variant ? `${variant.size || ''} ${variant.color || ''}`.trim() : undefined,
        price,
        quantity: 1,
        imageUrl: goodie.imageUrl || undefined,
      }]);
    }
    
    setSelectedGoodie(null);
    setSelectedVariant("");
    toast.success(t.goodies.addedToCart);
  };

  const updateQuantity = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].quantity += delta;
    if (newCart[index].quantity <= 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    
    createOrderMutation.mutate({
      customerName: checkoutForm.customerName,
      customerEmail: checkoutForm.customerEmail,
      customerPhone: checkoutForm.customerPhone,
      items: cart.map(item => ({
        goodieId: item.goodieId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
    });
  };

  const currentGoodie = goodies?.find(g => g.id === selectedGoodie);

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-[#5E5B34]" dir={dir}>
        <Navbar />
        <main className="flex-1 py-16">
          <div className="container max-w-2xl">
            <Card className="border-none shadow-lg bg-[#4A4829]">
              <CardContent className="p-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-[#F2E9D3]">{t.goodies.reservationConfirmed}</h1>
                  <p className="text-[#E6DCC3]">
                    {t.goodies.orderRegistered}
                  </p>
                </div>

                <div className="bg-[#5E5B34] rounded-lg p-6 space-y-4">
                  <div>
                    <p className="text-sm text-[#E6DCC3]">{t.goodies.orderReference}</p>
                    <p className="text-2xl font-bold font-mono text-[#CDBB8A]">{orderSuccess.reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#E6DCC3]">{t.goodies.totalToPay}</p>
                    <p className="text-xl font-bold text-[#F2E9D3]">{orderSuccess.total} DH</p>
                  </div>
                </div>

                <div className="bg-[#5E5B34] rounded-lg p-4 text-left space-y-2">
                  <h3 className="font-semibold text-[#F2E9D3]">{t.goodies.nextSteps}</h3>
                  <ul className="text-sm text-[#E6DCC3] space-y-1">
                    <li>• {t.goodies.emailSent}</li>
                    <li>• {t.goodies.pickupPoint}</li>
                    <li>• {t.goodies.paymentOnSite}</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button onClick={() => setOrderSuccess(null)} variant="outline" className="flex-1 border-[#F2E9D3] text-[#F2E9D3] hover:bg-[#F2E9D3] hover:text-[#4A4829]">
                    {t.goodies.continueShopping}
                  </Button>
                  <Link href={`/${lang}`} className="flex-1">
                    <Button className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]">
                      {t.goodies.backToHome}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#5E5B34]" dir={dir}>
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-[#4A4829]">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2E9D3]/10 text-[#F2E9D3] text-sm font-medium">
                <ShoppingBag className="h-4 w-4" />
                {t.goodies.solidarityShop}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#F2E9D3]" style={{ fontFamily: 'Caveat, cursive' }}>
                {t.goodies.title}
              </h1>
              <p className="text-lg text-[#E6DCC3]">
                {t.goodies.subtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-12">
          <div className="container">
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="animate-pulse bg-[#4A4829]">
                    <div className="aspect-square bg-[#5E5B34]" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-5 bg-[#5E5B34] rounded w-3/4" />
                      <div className="h-4 bg-[#5E5B34] rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : goodies && goodies.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {goodies.map((goodie) => (
                  <Card key={goodie.id} className="overflow-hidden group bg-[#4A4829] border-[#F2E9D3]/10 hover:border-[#F2E9D3]/30 transition-all">
                    {/* Image */}
                    <div className="aspect-square bg-[#5E5B34] relative overflow-hidden">
                      {goodie.imageUrl ? (
                        <img 
                          src={goodie.imageUrl} 
                          alt={goodie.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-16 w-16 text-[#F2E9D3]/30" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1 text-[#F2E9D3]">{goodie.name}</h3>
                        {goodie.description && (
                          <p className="text-sm text-[#E6DCC3] line-clamp-2 mt-1">
                            {goodie.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-[#CDBB8A]">
                          {goodie.price.toFixed(0)} DH
                        </span>
                        <Button 
                          size="sm"
                          className="bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]"
                          onClick={() => {
                            if (goodie.variants && goodie.variants.length > 0) {
                              setSelectedGoodie(goodie.id);
                            } else {
                              addToCart(goodie);
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {t.goodies.addToCart}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <ShoppingBag className="h-16 w-16 mx-auto text-[#F2E9D3]/30 mb-4" />
                <h3 className="text-xl font-semibold text-[#F2E9D3] mb-2">{t.goodies.noProducts}</h3>
                <p className="text-[#E6DCC3]">{t.goodies.comingSoon}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 bg-[#F2E9D3] text-[#4A4829] p-4 rounded-full shadow-lg hover:bg-[#E6DCC3] transition-colors z-50"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-[#4A4829] text-[#F2E9D3] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {cartCount}
          </span>
        </button>
      )}

      {/* Variant Selection Dialog */}
      <Dialog open={selectedGoodie !== null} onOpenChange={() => setSelectedGoodie(null)}>
        <DialogContent className="bg-[#4A4829] border-[#F2E9D3]/20">
          <DialogHeader>
            <DialogTitle className="text-[#F2E9D3]">{t.goodies.selectVariant}</DialogTitle>
            <DialogDescription className="text-[#E6DCC3]">
              {t.goodies.chooseOptions}
            </DialogDescription>
          </DialogHeader>
          {currentGoodie && (
            <div className="space-y-4">
              <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                <SelectTrigger className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]">
                  <SelectValue placeholder={t.goodies.selectOption} />
                </SelectTrigger>
                <SelectContent className="bg-[#4A4829] border-[#F2E9D3]/20">
                  {currentGoodie.variants?.map((variant: { id: number; size?: string; color?: string; priceModifier?: string }) => (
                    <SelectItem key={variant.id} value={variant.id.toString()} className="text-[#F2E9D3]">
                      {`${variant.size || ''} ${variant.color || ''}`.trim()}
                      {variant.priceModifier && Number(variant.priceModifier) > 0 && ` (+${variant.priceModifier} DH)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => addToCart(currentGoodie)} 
                disabled={!selectedVariant}
                className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]"
              >
                {t.goodies.addToCart}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="bg-[#4A4829] border-[#F2E9D3]/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F2E9D3]">{t.goodies.yourCart}</DialogTitle>
            <DialogDescription className="text-[#E6DCC3]">
              {cartCount} {t.goodies.articles}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {cart.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-[#5E5B34] rounded-lg">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[#F2E9D3] truncate">{item.name}</h4>
                  {item.variant && <p className="text-sm text-[#E6DCC3]">{item.variant}</p>}
                  <p className="text-[#CDBB8A] font-semibold">{item.price} DH</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8 border-[#F2E9D3]/20 text-[#F2E9D3]" onClick={() => updateQuantity(index, -1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-[#F2E9D3]">{item.quantity}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8 border-[#F2E9D3]/20 text-[#F2E9D3]" onClick={() => updateQuantity(index, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => removeFromCart(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#F2E9D3]/20 pt-4 space-y-4">
            <div className="flex justify-between text-lg font-bold text-[#F2E9D3]">
              <span>{t.goodies.total}</span>
              <span>{cartTotal} DH</span>
            </div>
            <Button 
              onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
              className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]"
            >
              {t.goodies.reserve}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="bg-[#4A4829] border-[#F2E9D3]/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F2E9D3]">{t.goodies.finalizeReservation}</DialogTitle>
            <DialogDescription className="text-[#E6DCC3]">
              {t.goodies.fillInfo}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#F2E9D3]">{t.goodies.fullName}</Label>
              <Input 
                id="name" 
                value={checkoutForm.customerName}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerName: e.target.value }))}
                required
                className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#F2E9D3]">{t.goodies.email}</Label>
              <Input 
                id="email" 
                type="email"
                value={checkoutForm.customerEmail}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                required
                className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[#F2E9D3]">{t.goodies.phone}</Label>
              <Input 
                id="phone" 
                type="tel"
                value={checkoutForm.customerPhone}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                required
                className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]"
              />
            </div>
            <div className="bg-[#5E5B34] rounded-lg p-4">
              <div className="flex justify-between text-lg font-bold text-[#F2E9D3]">
                <span>{t.goodies.total}</span>
                <span>{cartTotal} DH</span>
              </div>
              <p className="text-sm text-[#E6DCC3] mt-2">{t.goodies.paymentOnSite}</p>
            </div>
            <Button 
              type="submit" 
              disabled={createOrderMutation.isPending}
              className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]"
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.goodies.processing}
                </>
              ) : (
                t.goodies.confirmReservation
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
