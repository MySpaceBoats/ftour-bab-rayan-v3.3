import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { ShoppingBag, Plus, Minus, Star, Sparkles, Tag, ShoppingCart, X, CheckCircle, Loader2, Package } from "lucide-react";

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
  const { data: goodies, isLoading } = trpc.goodies.list.useQuery();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedGoodie, setSelectedGoodie] = useState<number | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [orderSuccess, setOrderSuccess] = useState<{ reference: string; total: string } | null>(null);
  
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
      toast.success("Réservation confirmée !");
    },
    onError: (error) => {
      toast.error(error.message || "Erreur lors de la réservation");
    },
  });

  const addToCart = (goodie: NonNullable<typeof goodies>[number]) => {
    const variant = goodie.variants?.find(v => v.id.toString() === selectedVariant);
    const price = parseFloat(goodie.price) + (variant?.priceModifier ? parseFloat(variant.priceModifier) : 0);
    
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
    toast.success("Ajouté au panier !");
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
      })),
    });
  };

  const currentGoodie = goodies?.find(g => g.id === selectedGoodie);

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 py-16">
          <div className="container max-w-2xl">
            <Card className="border-none shadow-lg">
              <CardContent className="p-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">Réservation confirmée !</h1>
                  <p className="text-muted-foreground">
                    Votre commande a été enregistrée avec succès
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Référence de commande</p>
                    <p className="text-2xl font-bold font-mono text-primary">{orderSuccess.reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total à payer sur place</p>
                    <p className="text-xl font-bold">{orderSuccess.total} DH</p>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 text-left space-y-2">
                  <h3 className="font-semibold">Prochaines étapes</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Un email de confirmation vous a été envoyé</li>
                    <li>• Présentez-vous au point de retrait avec votre référence</li>
                    <li>• Le paiement se fait sur place lors du retrait</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button onClick={() => setOrderSuccess(null)} variant="outline" className="flex-1">
                    Continuer les achats
                  </Button>
                  <Link href="/" className="flex-1">
                    <Button className="w-full">
                      Retour à l'accueil
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
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-secondary/10 to-background">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 text-secondary-foreground text-sm font-medium">
                <ShoppingBag className="h-4 w-4" />
                Boutique solidaire
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Goodies Ftour Bab Rayan
              </h1>
              <p className="text-lg text-muted-foreground">
                Soutenez notre action en vous procurant nos goodies exclusifs. Tous les bénéfices financent les Ftours solidaires.
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
                  <Card key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : goodies && goodies.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {goodies.map((goodie) => (
                  <Card key={goodie.id} className="card-hover overflow-hidden group">
                    {/* Image */}
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {goodie.imageUrl ? (
                        <img 
                          src={goodie.imageUrl} 
                          alt={goodie.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-2">
                        {goodie.isBestSeller && (
                          <Badge className="bg-amber-500 hover:bg-amber-500">
                            <Star className="h-3 w-3 mr-1" />
                            Best-seller
                          </Badge>
                        )}
                        {goodie.isNew && (
                          <Badge className="bg-blue-500 hover:bg-blue-500">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Nouveau
                          </Badge>
                        )}
                        {goodie.isRamadanEdition && (
                          <Badge className="bg-primary hover:bg-primary">
                            <Tag className="h-3 w-3 mr-1" />
                            Édition Ramadan
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg line-clamp-1">{goodie.name}</h3>
                        {goodie.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {goodie.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-primary">
                          {parseFloat(goodie.price).toFixed(0)} DH
                        </span>
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (goodie.variants && goodie.variants.length > 0) {
                              setSelectedGoodie(goodie.id);
                            } else {
                              addToCart(goodie);
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Boutique à venir</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Nos goodies seront bientôt disponibles. Revenez nous voir !
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Info Section */}
        <section className="py-16 bg-muted/30">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h2 className="text-2xl font-bold">Comment ça marche ?</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">1</span>
                  </div>
                  <h3 className="font-semibold">Réservez en ligne</h3>
                  <p className="text-sm text-muted-foreground">
                    Choisissez vos articles et validez votre réservation
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">2</span>
                  </div>
                  <h3 className="font-semibold">Recevez votre confirmation</h3>
                  <p className="text-sm text-muted-foreground">
                    Un email avec votre référence de commande
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">3</span>
                  </div>
                  <h3 className="font-semibold">Payez et retirez sur place</h3>
                  <p className="text-sm text-muted-foreground">
                    Présentez-vous au point de retrait avec votre référence
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button 
            size="lg" 
            className="rounded-full shadow-lg h-14 px-6"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Panier ({cartCount})
            <span className="ml-2 font-bold">{cartTotal.toFixed(0)} DH</span>
          </Button>
        </div>
      )}

      {/* Variant Selection Dialog */}
      <Dialog open={selectedGoodie !== null} onOpenChange={() => { setSelectedGoodie(null); setSelectedVariant(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentGoodie?.name}</DialogTitle>
            <DialogDescription>Choisissez une variante</DialogDescription>
          </DialogHeader>
          
          {currentGoodie && (
            <div className="space-y-4">
              <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une option" />
                </SelectTrigger>
                <SelectContent>
                  {currentGoodie.variants?.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id.toString()}>
                      {variant.size} {variant.color} 
                      {variant.priceModifier && parseFloat(variant.priceModifier) !== 0 && (
                        <span className="text-muted-foreground ml-2">
                          ({parseFloat(variant.priceModifier) > 0 ? '+' : ''}{variant.priceModifier} DH)
                        </span>
                      )}
                      {variant.stock !== undefined && variant.stock <= 5 && (
                        <span className="text-amber-500 ml-2">({variant.stock} restants)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                className="w-full" 
                onClick={() => addToCart(currentGoodie)}
                disabled={!selectedVariant}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter au panier
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Votre panier
            </DialogTitle>
          </DialogHeader>
          
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Votre panier est vide</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-16 h-16 bg-muted rounded flex-shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                    {item.variant && (
                      <p className="text-xs text-muted-foreground">{item.variant}</p>
                    )}
                    <p className="text-sm font-bold text-primary">{item.price.toFixed(0)} DH</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(index, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center font-medium">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(index, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => removeFromCart(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold text-primary">{cartTotal.toFixed(0)} DH</span>
                </div>
                <Button className="w-full" onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}>
                  Réserver (paiement sur place)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finaliser la réservation</DialogTitle>
            <DialogDescription>
              Remplissez vos coordonnées pour réserver vos articles
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                value={checkoutForm.customerName}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="Votre nom"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={checkoutForm.customerEmail}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                placeholder="votre@email.com"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                value={checkoutForm.customerPhone}
                onChange={(e) => setCheckoutForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="+212 6XX XXX XXX"
                required
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span>Total à payer sur place</span>
                <span className="text-xl font-bold text-primary">{cartTotal.toFixed(0)} DH</span>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Réservation en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Confirmer la réservation
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
