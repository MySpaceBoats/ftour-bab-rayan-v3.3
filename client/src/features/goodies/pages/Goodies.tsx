import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FeedbackCta from "@/components/FeedbackCta";
import { toast } from "sonner";
import {
  ShoppingBag,
  Plus,
  Minus,
  ShoppingCart,
  X,
  CheckCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import ProductImageCarousel from "@/components/ProductImageCarousel";
import { useI18n } from "@/i18n";
import { useCart } from "@/contexts/CartContext";
import GoodiesConfirmation from "@/components/GoodiesConfirmation";
import PaymentMethodSelector, {
  PaymentMethod,
} from "@/components/PaymentMethodSelector";

export default function Goodies() {
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const {
    data: goodies,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.catalogProducts.listPublic.useQuery({ productType: "goodies" });
  const {
    cart,
    cartCount,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    addToCart: addToCartContext,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedGoodie, setSelectedGoodie] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [orderSuccess, setOrderSuccess] = useState<{
    reference: string;
    total: number;
  } | null>(null);

  const [checkoutForm, setCheckoutForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    deliveryMode: "pickup" as "pickup" | "home_delivery",
    deliveryAddress: "",
    deliveryCity: "",
    deliveryNeighborhood: "",
    deliveryPostalCode: "",
    deliveryPhone: "",
    deliveryInstructions: "",
    paymentMethod: "cash" as PaymentMethod,
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: data => {
      setOrderSuccess({
        reference: data.orderReference,
        total: data.totalAmount,
      });
      clearCart();
      setIsCheckoutOpen(false);
      toast.success(t.goodies.reservationConfirmed);
    },
    onError: error => {
      toast.error(error.message || t.goodies.reservationError);
    },
  });

  const addToCart = (goodie: NonNullable<typeof goodies>[number]) => {
    addToCartContext({
      productType: "goodies",
      productId: goodie.id,
      goodieId: goodie.id,
      name: goodie.name,
      price: Number(goodie.price),
      quantity: 1,
      imageUrl: (goodie as any).image || undefined,
    });

    setSelectedGoodie(null);
    setSelectedVariant("");
    toast.success(t.goodies.addedToCart);
  };

  const deliveryFee = checkoutForm.deliveryMode === "home_delivery" ? 30 : 0;
  const cartTotalWithDelivery = cartTotal + deliveryFee;

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate delivery address if home delivery is selected
    if (checkoutForm.deliveryMode === "home_delivery") {
      if (
        !checkoutForm.deliveryAddress.trim() ||
        !checkoutForm.deliveryCity.trim() ||
        !checkoutForm.deliveryNeighborhood.trim() ||
        !checkoutForm.deliveryPhone.trim()
      ) {
        toast.error(t.goodies.deliveryAddressRequired);
        return;
      }
    }

    createOrderMutation.mutate({
      customerName: checkoutForm.customerName,
      customerEmail: checkoutForm.customerEmail,
      customerPhone: checkoutForm.customerPhone,
      deliveryMode: checkoutForm.deliveryMode,
      deliveryAddress:
        checkoutForm.deliveryMode === "home_delivery"
          ? checkoutForm.deliveryAddress
          : undefined,
      deliveryCity:
        checkoutForm.deliveryMode === "home_delivery"
          ? checkoutForm.deliveryCity
          : undefined,
      deliveryNeighborhood:
        checkoutForm.deliveryMode === "home_delivery"
          ? checkoutForm.deliveryNeighborhood
          : undefined,
      deliveryPostalCode:
        checkoutForm.deliveryMode === "home_delivery"
          ? checkoutForm.deliveryPostalCode
          : undefined,
      deliveryPhone:
        checkoutForm.deliveryMode === "home_delivery"
          ? checkoutForm.deliveryPhone
          : undefined,
      deliveryInstructions:
        checkoutForm.deliveryMode === "home_delivery"
          ? checkoutForm.deliveryInstructions
          : undefined,
      items: cart.map(item => ({
        goodieId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      paymentMethod: checkoutForm.paymentMethod,
    });
  };

  const currentGoodie = goodies?.find(g => g.id === selectedGoodie);

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0F172A]" dir={dir}>
        <Navbar />
        <main className="flex-1">
          <GoodiesConfirmation
            orderReference={orderSuccess.reference}
            onClose={() => setOrderSuccess(null)}
          />
        </main>
        <FeedbackCta type="product" source="product" />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0F172A]" dir={dir}>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-[#1E293B]">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8FAFC]/10 text-[#F8FAFC] text-sm font-medium">
                <ShoppingBag className="h-4 w-4" />
                {t.goodies.solidarityShop}
              </div>
              <h1
                className="text-4xl md:text-5xl font-bold text-[#F8FAFC]"
                style={{ fontFamily: 'Syne, Inter, sans-serif' }}
              >
                {t.goodies.title}
              </h1>
              <p className="text-lg text-[#CBD5E1]">{t.goodies.subtitle}</p>
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-12">
          <div className="container">
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="animate-pulse bg-[#1E293B]">
                    <div className="aspect-square bg-[#0F172A]" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-5 bg-[#0F172A] rounded w-3/4" />
                      <div className="h-4 bg-[#0F172A] rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : isError ? (
              <div className="text-center py-16">
                <AlertTriangle className="h-16 w-16 mx-auto text-red-400/60 mb-4" />
                <h3 className="text-xl font-semibold text-[#F8FAFC] mb-2">
                  {t.goodies.loadError || "Erreur de chargement"}
                </h3>
                <p className="text-[#CBD5E1] mb-4">
                  {error?.message || "Impossible de charger les produits"}
                </p>
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  className="border-[#F8FAFC]/20 text-[#F8FAFC] hover:bg-[#F8FAFC]/10"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t.goodies.retry || "Réessayer"}
                </Button>
              </div>
            ) : goodies && goodies.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {goodies.map(goodie => {
                  const availableStock = (goodie as any).stock ?? 0;
                  const isOutOfStock = availableStock <= 0;

                  return (
                    <Card
                      key={goodie.id}
                      className="overflow-hidden group bg-[#1E293B] border-[#F8FAFC]/10 hover:border-[#F8FAFC]/30 transition-all"
                    >
                      {/* Image / Carousel */}
                      <div className="aspect-square bg-[#0F172A] relative overflow-hidden">
                        <ProductImageCarousel
                          image={(goodie as any).image}
                          images={(goodie as any).images}
                          alt={goodie.name}
                          showFitToggle={true}
                        />
                      </div>

                      {/* Content */}
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg line-clamp-1 text-[#F8FAFC]">
                            {goodie.name}
                          </h3>
                          {goodie.description && (
                            <p className="text-sm text-[#CBD5E1] line-clamp-2 mt-1">
                              {goodie.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xl font-bold text-[#38BDF8]">
                            {Number(goodie.price).toFixed(0)} DH
                          </span>
                          <span
                            className={`text-xs font-medium ${isOutOfStock ? "text-red-400" : "text-green-400"}`}
                          >
                            {isOutOfStock
                              ? t.goodies.outOfStock || "Rupture de stock"
                              : `${t.goodies.inStock || "En stock"} (${availableStock})`}
                          </span>
                          <Button
                            size="sm"
                            className="bg-[#F8FAFC] text-[#1E293B] hover:bg-[#CBD5E1]"
                            disabled={isOutOfStock}
                            onClick={() => {
                              addToCart(goodie);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            {isOutOfStock
                              ? t.goodies.outOfStock || "Rupture de stock"
                              : t.goodies.addToCart}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <ShoppingBag className="h-16 w-16 mx-auto text-[#F8FAFC]/30 mb-4" />
                <h3 className="text-xl font-semibold text-[#F8FAFC] mb-2">
                  {t.goodies.noProducts}
                </h3>
                <p className="text-[#CBD5E1]">{t.goodies.comingSoon}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-6 right-6 bg-[#F8FAFC] text-[#1E293B] p-4 rounded-full shadow-lg hover:bg-[#CBD5E1] transition-colors z-50"
        >
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-[#1E293B] text-[#F8FAFC] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
            {cartCount}
          </span>
        </button>
      )}

      {/* Variant Selection Dialog */}
      <Dialog
        open={selectedGoodie !== null}
        onOpenChange={() => setSelectedGoodie(null)}
      >
        <DialogContent className="bg-[#1E293B] border-[#F8FAFC]/20">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">
              {t.goodies.selectVariant}
            </DialogTitle>
            <DialogDescription className="text-[#CBD5E1]">
              {t.goodies.chooseOptions}
            </DialogDescription>
          </DialogHeader>
          {currentGoodie && (
            <div className="space-y-4">
              <Select
                value={selectedVariant}
                onValueChange={setSelectedVariant}
              >
                <SelectTrigger className="bg-[#0F172A] border-[#F8FAFC]/20 text-[#F8FAFC]">
                  <SelectValue placeholder={t.goodies.selectOption} />
                </SelectTrigger>
                <SelectContent className="bg-[#1E293B] border-[#F8FAFC]/20">
                  {(currentGoodie as any).variants?.map(
                    (variant: {
                      id: number;
                      size?: string;
                      color?: string;
                      priceModifier?: string;
                    }) => (
                      <SelectItem
                        key={variant.id}
                        value={variant.id.toString()}
                        className="text-[#F8FAFC]"
                      >
                        {`${variant.size || ""} ${variant.color || ""}`.trim()}
                        {variant.priceModifier &&
                          Number(variant.priceModifier) > 0 &&
                          ` (+${variant.priceModifier} DH)`}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={() => addToCart(currentGoodie)}
                disabled={!selectedVariant}
                className="w-full bg-[#F8FAFC] text-[#1E293B] hover:bg-[#CBD5E1]"
              >
                {t.goodies.addToCart}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="bg-[#1E293B] border-[#F8FAFC]/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">
              {t.goodies.yourCart}
            </DialogTitle>
            <DialogDescription className="text-[#CBD5E1]">
              {cartCount} {t.goodies.articles}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {cart.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-[#0F172A] rounded-lg"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[#F8FAFC] truncate">
                    {item.name}
                  </h4>
                  {item.variant && (
                    <p className="text-sm text-[#CBD5E1]">{item.variant}</p>
                  )}
                  <p className="text-[#38BDF8] font-semibold">
                    {item.price} DH
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-[#F8FAFC]/20 text-[#F8FAFC]"
                    onClick={() => updateQuantity(index, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-[#F8FAFC]">
                    {item.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-[#F8FAFC]/20 text-[#F8FAFC]"
                    onClick={() => updateQuantity(index, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-400 hover:text-red-300"
                    onClick={() => removeFromCart(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#F8FAFC]/20 pt-4 space-y-4">
            <div className="flex justify-between text-lg font-bold text-[#F8FAFC]">
              <span>{t.goodies.total}</span>
              <span>{cartTotal} DH</span>
            </div>
            <Button
              onClick={() => {
                setIsCartOpen(false);
                setIsCheckoutOpen(true);
              }}
              className="w-full bg-[#F8FAFC] text-[#1E293B] hover:bg-[#CBD5E1]"
            >
              {t.goodies.reserve}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="bg-[#1E293B] border-[#F8FAFC]/20 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">
              {t.goodies.finalizeReservation}
            </DialogTitle>
            <DialogDescription className="text-[#CBD5E1]">
              {t.goodies.fillInfo}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#F8FAFC]">
                {t.goodies.fullName}
              </Label>
              <Input
                id="name"
                value={checkoutForm.customerName}
                onChange={e =>
                  setCheckoutForm(prev => ({
                    ...prev,
                    customerName: e.target.value,
                  }))
                }
                required
                className="bg-[#0F172A] border-[#F8FAFC]/20 text-[#F8FAFC]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#F8FAFC]">
                {t.goodies.email}
              </Label>
              <Input
                id="email"
                type="email"
                value={checkoutForm.customerEmail}
                onChange={e =>
                  setCheckoutForm(prev => ({
                    ...prev,
                    customerEmail: e.target.value,
                  }))
                }
                required
                className="bg-[#0F172A] border-[#F8FAFC]/20 text-[#F8FAFC]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[#F8FAFC]">
                {t.goodies.phone}
              </Label>
              <Input
                id="phone"
                type="tel"
                value={checkoutForm.customerPhone}
                onChange={e =>
                  setCheckoutForm(prev => ({
                    ...prev,
                    customerPhone: e.target.value,
                  }))
                }
                required
                className="bg-[#0F172A] border-[#F8FAFC]/20 text-[#F8FAFC]"
              />
            </div>

            {/* Delivery Mode Selection */}
            <div className="space-y-2 border-t border-[#F8FAFC]/20 pt-4">
              <Label className="text-[#F8FAFC]">{t.goodies.deliveryMode}</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="pickup"
                    name="deliveryMode"
                    value="pickup"
                    checked={checkoutForm.deliveryMode === "pickup"}
                    onChange={e =>
                      setCheckoutForm(prev => ({
                        ...prev,
                        deliveryMode: "pickup" as const,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <Label
                    htmlFor="pickup"
                    className="text-[#CBD5E1] cursor-pointer"
                  >
                    {t.goodies.pickupAtLocation}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="delivery"
                    name="deliveryMode"
                    value="home_delivery"
                    checked={checkoutForm.deliveryMode === "home_delivery"}
                    onChange={e =>
                      setCheckoutForm(prev => ({
                        ...prev,
                        deliveryMode: "home_delivery" as const,
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <Label
                    htmlFor="delivery"
                    className="text-[#CBD5E1] cursor-pointer"
                  >
                    {t.goodies.homeDelivery}
                  </Label>
                </div>
              </div>
            </div>
            {/* Delivery Address Form - Only shown if home delivery is selected */}
            {checkoutForm.deliveryMode === "home_delivery" && (
              <div className="space-y-3 bg-[#0F172A] rounded-lg p-4 border border-[#F8FAFC]/10">
                <h4 className="font-semibold text-[#F8FAFC]">
                  {t.goodies.deliveryAddress}
                </h4>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-[#F8FAFC] text-sm">
                    {t.goodies.fullAddress}
                  </Label>
                  <Input
                    id="address"
                    value={checkoutForm.deliveryAddress}
                    onChange={e =>
                      setCheckoutForm(prev => ({
                        ...prev,
                        deliveryAddress: e.target.value,
                      }))
                    }
                    required
                    className="bg-[#1E293B] border-[#F8FAFC]/20 text-[#F8FAFC]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-[#F8FAFC] text-sm">
                      {t.goodies.city}
                    </Label>
                    <Input
                      id="city"
                      value={checkoutForm.deliveryCity}
                      onChange={e =>
                        setCheckoutForm(prev => ({
                          ...prev,
                          deliveryCity: e.target.value,
                        }))
                      }
                      required
                      className="bg-[#1E293B] border-[#F8FAFC]/20 text-[#F8FAFC]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="neighborhood"
                      className="text-[#F8FAFC] text-sm"
                    >
                      {t.goodies.neighborhood}
                    </Label>
                    <Input
                      id="neighborhood"
                      value={checkoutForm.deliveryNeighborhood}
                      onChange={e =>
                        setCheckoutForm(prev => ({
                          ...prev,
                          deliveryNeighborhood: e.target.value,
                        }))
                      }
                      required
                      className="bg-[#1E293B] border-[#F8FAFC]/20 text-[#F8FAFC]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="postal" className="text-[#F8FAFC] text-sm">
                      {t.goodies.postalCode}
                    </Label>
                    <Input
                      id="postal"
                      value={checkoutForm.deliveryPostalCode}
                      onChange={e =>
                        setCheckoutForm(prev => ({
                          ...prev,
                          deliveryPostalCode: e.target.value,
                        }))
                      }
                      className="bg-[#1E293B] border-[#F8FAFC]/20 text-[#F8FAFC]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="deliveryPhone"
                      className="text-[#F8FAFC] text-sm"
                    >
                      {t.goodies.contactPhone}
                    </Label>
                    <Input
                      id="deliveryPhone"
                      type="tel"
                      value={checkoutForm.deliveryPhone}
                      onChange={e =>
                        setCheckoutForm(prev => ({
                          ...prev,
                          deliveryPhone: e.target.value,
                        }))
                      }
                      required
                      className="bg-[#1E293B] border-[#F8FAFC]/20 text-[#F8FAFC]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="instructions"
                    className="text-[#F8FAFC] text-sm"
                  >
                    {t.goodies.deliveryInstructions}
                  </Label>
                  <textarea
                    id="instructions"
                    value={checkoutForm.deliveryInstructions}
                    onChange={e =>
                      setCheckoutForm(prev => ({
                        ...prev,
                        deliveryInstructions: e.target.value,
                      }))
                    }
                    className="w-full bg-[#1E293B] border border-[#F8FAFC]/20 text-[#F8FAFC] rounded px-3 py-2 text-sm min-h-[60px]"
                    placeholder={t.goodies.deliveryInstructions}
                  />
                </div>
              </div>
            )}

            {/* Payment Method Selection */}
            <PaymentMethodSelector
              value={checkoutForm.paymentMethod}
              onChange={method =>
                setCheckoutForm(prev => ({ ...prev, paymentMethod: method }))
              }
              availableMethods={["bank_transfer", "cheque", "cash"]}
              showDescriptions={true}
            />

            {/* Price Summary */}
            <div className="bg-[#0F172A] rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-[#CBD5E1]">
                <span>{t.goodies.subtotal}</span>
                <span>{cartTotal} DH</span>
              </div>
              {checkoutForm.deliveryMode === "home_delivery" && (
                <div className="flex justify-between text-sm text-[#CBD5E1]">
                  <span>{t.goodies.deliveryFee}</span>
                  <span>{deliveryFee} DH</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-[#F8FAFC] border-t border-[#F8FAFC]/20 pt-2">
                <span>{t.goodies.total}</span>
                <span>{cartTotalWithDelivery} DH</span>
              </div>
              <p className="text-sm text-[#CBD5E1] mt-2">
                {checkoutForm.deliveryMode === "pickup"
                  ? t.goodies.paymentOnPlacePickup
                  : t.goodies.paymentOnDelivery}
              </p>
            </div>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="w-full bg-[#F8FAFC] text-[#1E293B] hover:bg-[#CBD5E1]"
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
