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
  Package,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
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
  } = trpc.goodies.list.useQuery();
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
    const variant = goodie.variants?.find(
      (v: { id: number }) => v.id.toString() === selectedVariant
    );
    const price =
      goodie.price +
      (variant?.priceModifier ? Number(variant.priceModifier) : 0);

    addToCartContext({
      productType: "goodies",
      productId: goodie.id,
      goodieId: goodie.id,
      variantId: variant?.id,
      name: goodie.name,
      variant: variant
        ? `${variant.size || ""} ${variant.color || ""}`.trim()
        : undefined,
      price,
      quantity: 1,
      imageUrl: goodie.imageUrl || undefined,
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
      <div className="min-h-screen flex flex-col bg-[#5E5B34]" dir={dir}>
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
              <h1
                className="text-4xl md:text-5xl font-bold text-[#F2E9D3]"
                style={{ fontFamily: "Caveat, cursive" }}
              >
                {t.goodies.title}
              </h1>
              <p className="text-lg text-[#E6DCC3]">{t.goodies.subtitle}</p>
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
            ) : isError ? (
              <div className="text-center py-16">
                <AlertTriangle className="h-16 w-16 mx-auto text-red-400/60 mb-4" />
                <h3 className="text-xl font-semibold text-[#F2E9D3] mb-2">
                  {t.goodies.loadError || "Erreur de chargement"}
                </h3>
                <p className="text-[#E6DCC3] mb-4">
                  {error?.message || "Impossible de charger les produits"}
                </p>
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  className="border-[#F2E9D3]/20 text-[#F2E9D3] hover:bg-[#F2E9D3]/10"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t.goodies.retry || "Réessayer"}
                </Button>
              </div>
            ) : goodies && goodies.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {goodies.map(goodie => {
                  const totalVariantStock = (goodie.variants || [])
                    .filter((v: any) => v.isAvailable)
                    .reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
                  const hasVariants = (goodie.variants?.length || 0) > 0;
                  const availableStock = hasVariants
                    ? totalVariantStock
                    : (goodie.stock ?? 0);
                  const isOutOfStock = availableStock <= 0;

                  return (
                    <Card
                      key={goodie.id}
                      className="overflow-hidden group bg-[#4A4829] border-[#F2E9D3]/10 hover:border-[#F2E9D3]/30 transition-all"
                    >
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
                          <h3 className="font-semibold text-lg line-clamp-1 text-[#F2E9D3]">
                            {goodie.name}
                          </h3>
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
                          <span
                            className={`text-xs font-medium ${isOutOfStock ? "text-red-400" : "text-green-400"}`}
                          >
                            {isOutOfStock
                              ? t.goodies.outOfStock || "Rupture de stock"
                              : `${t.goodies.inStock || "En stock"} (${availableStock})`}
                          </span>
                          <Button
                            size="sm"
                            className="bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]"
                            disabled={isOutOfStock}
                            onClick={() => {
                              if (
                                goodie.variants &&
                                goodie.variants.length > 0
                              ) {
                                setSelectedGoodie(goodie.id);
                              } else {
                                addToCart(goodie);
                              }
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
                <ShoppingBag className="h-16 w-16 mx-auto text-[#F2E9D3]/30 mb-4" />
                <h3 className="text-xl font-semibold text-[#F2E9D3] mb-2">
                  {t.goodies.noProducts}
                </h3>
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
      <Dialog
        open={selectedGoodie !== null}
        onOpenChange={() => setSelectedGoodie(null)}
      >
        <DialogContent className="bg-[#4A4829] border-[#F2E9D3]/20">
          <DialogHeader>
            <DialogTitle className="text-[#F2E9D3]">
              {t.goodies.selectVariant}
            </DialogTitle>
            <DialogDescription className="text-[#E6DCC3]">
              {t.goodies.chooseOptions}
            </DialogDescription>
          </DialogHeader>
          {currentGoodie && (
            <div className="space-y-4">
              <Select
                value={selectedVariant}
                onValueChange={setSelectedVariant}
              >
                <SelectTrigger className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]">
                  <SelectValue placeholder={t.goodies.selectOption} />
                </SelectTrigger>
                <SelectContent className="bg-[#4A4829] border-[#F2E9D3]/20">
                  {currentGoodie.variants?.map(
                    (variant: {
                      id: number;
                      size?: string;
                      color?: string;
                      priceModifier?: string;
                    }) => (
                      <SelectItem
                        key={variant.id}
                        value={variant.id.toString()}
                        className="text-[#F2E9D3]"
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
            <DialogTitle className="text-[#F2E9D3]">
              {t.goodies.yourCart}
            </DialogTitle>
            <DialogDescription className="text-[#E6DCC3]">
              {cartCount} {t.goodies.articles}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {cart.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-[#5E5B34] rounded-lg"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[#F2E9D3] truncate">
                    {item.name}
                  </h4>
                  {item.variant && (
                    <p className="text-sm text-[#E6DCC3]">{item.variant}</p>
                  )}
                  <p className="text-[#CDBB8A] font-semibold">
                    {item.price} DH
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-[#F2E9D3]/20 text-[#F2E9D3]"
                    onClick={() => updateQuantity(index, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-[#F2E9D3]">
                    {item.quantity}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-[#F2E9D3]/20 text-[#F2E9D3]"
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
          <div className="border-t border-[#F2E9D3]/20 pt-4 space-y-4">
            <div className="flex justify-between text-lg font-bold text-[#F2E9D3]">
              <span>{t.goodies.total}</span>
              <span>{cartTotal} DH</span>
            </div>
            <Button
              onClick={() => {
                setIsCartOpen(false);
                setIsCheckoutOpen(true);
              }}
              className="w-full bg-[#F2E9D3] text-[#4A4829] hover:bg-[#E6DCC3]"
            >
              {t.goodies.reserve}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="bg-[#4A4829] border-[#F2E9D3]/20 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F2E9D3]">
              {t.goodies.finalizeReservation}
            </DialogTitle>
            <DialogDescription className="text-[#E6DCC3]">
              {t.goodies.fillInfo}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#F2E9D3]">
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
                className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#F2E9D3]">
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
                className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[#F2E9D3]">
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
                className="bg-[#5E5B34] border-[#F2E9D3]/20 text-[#F2E9D3]"
              />
            </div>

            {/* Delivery Mode Selection */}
            <div className="space-y-2 border-t border-[#F2E9D3]/20 pt-4">
              <Label className="text-[#F2E9D3]">{t.goodies.deliveryMode}</Label>
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
                    className="text-[#E6DCC3] cursor-pointer"
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
                    className="text-[#E6DCC3] cursor-pointer"
                  >
                    {t.goodies.homeDelivery}
                  </Label>
                </div>
              </div>
            </div>
            {/* Delivery Address Form - Only shown if home delivery is selected */}
            {checkoutForm.deliveryMode === "home_delivery" && (
              <div className="space-y-3 bg-[#5E5B34] rounded-lg p-4 border border-[#F2E9D3]/10">
                <h4 className="font-semibold text-[#F2E9D3]">
                  {t.goodies.deliveryAddress}
                </h4>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-[#F2E9D3] text-sm">
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
                    className="bg-[#4A4829] border-[#F2E9D3]/20 text-[#F2E9D3]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-[#F2E9D3] text-sm">
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
                      className="bg-[#4A4829] border-[#F2E9D3]/20 text-[#F2E9D3]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="neighborhood"
                      className="text-[#F2E9D3] text-sm"
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
                      className="bg-[#4A4829] border-[#F2E9D3]/20 text-[#F2E9D3]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="postal" className="text-[#F2E9D3] text-sm">
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
                      className="bg-[#4A4829] border-[#F2E9D3]/20 text-[#F2E9D3]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="deliveryPhone"
                      className="text-[#F2E9D3] text-sm"
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
                      className="bg-[#4A4829] border-[#F2E9D3]/20 text-[#F2E9D3]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="instructions"
                    className="text-[#F2E9D3] text-sm"
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
                    className="w-full bg-[#4A4829] border border-[#F2E9D3]/20 text-[#F2E9D3] rounded px-3 py-2 text-sm min-h-[60px]"
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
            <div className="bg-[#5E5B34] rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-[#E6DCC3]">
                <span>{t.goodies.subtotal}</span>
                <span>{cartTotal} DH</span>
              </div>
              {checkoutForm.deliveryMode === "home_delivery" && (
                <div className="flex justify-between text-sm text-[#E6DCC3]">
                  <span>{t.goodies.deliveryFee}</span>
                  <span>{deliveryFee} DH</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-[#F2E9D3] border-t border-[#F2E9D3]/20 pt-2">
                <span>{t.goodies.total}</span>
                <span>{cartTotalWithDelivery} DH</span>
              </div>
              <p className="text-sm text-[#E6DCC3] mt-2">
                {checkoutForm.deliveryMode === "pickup"
                  ? t.goodies.paymentOnPlacePickup
                  : t.goodies.paymentOnDelivery}
              </p>
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
