import { useState } from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ShoppingCart, Heart, Leaf, MapPin, Truck } from 'lucide-react';

export default function ProduitsTerroir() {
  const { t, lang } = useI18n();
  const [cart, setCart] = useState<{ id: number; name: string; price: number; quantity: number }[]>([]);

  // Produits du terroir marocain
  const products = [
    {
      id: 1,
      name: 'Huile d\'Argan Bio',
      description: 'Huile d\'argan pressée à froid, 100% biologique du Maroc',
      price: 150,
      category: 'Huiles',
      image: '🫒',
    },
    {
      id: 2,
      name: 'Miel du Rif',
      description: 'Miel pur des montagnes du Rif, récolté naturellement',
      price: 120,
      category: 'Miel',
      image: '🍯',
    },
    {
      id: 3,
      name: 'Piment d\'Espelette Marocain',
      description: 'Épice traditionnelle, saveur authentique',
      price: 80,
      category: 'Épices',
      image: '🌶️',
    },
    {
      id: 4,
      name: 'Tapis Berbère Artisanal',
      description: 'Tapis tissé à la main par les artisans du Moyen Atlas',
      price: 450,
      category: 'Artisanat',
      image: '🧵',
    },
    {
      id: 5,
      name: 'Savon Noir Traditionnel',
      description: 'Savon noir du Maroc, idéal pour le hammam',
      price: 45,
      category: 'Bien-être',
      image: '🧼',
    },
    {
      id: 6,
      name: 'Ras el Hanout Bio',
      description: 'Mélange d\'épices traditionnelles marocaines',
      price: 95,
      category: 'Épices',
      image: '🌾',
    },
  ];

  const addToCart = (product: typeof products[0]) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, quantity: 1 }]);
    }
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-amber-50 to-background">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-900 text-sm font-medium">
                <Leaf className="h-4 w-4" />
                Produits Authentiques
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Produits du <span className="text-amber-700">Terroir Marocain</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                Découvrez nos sélections de produits authentiques du Maroc. Chaque achat soutient les artisans et producteurs locaux.
              </p>
              <p className="text-sm text-amber-700 font-medium">
                Tous les bénéfices financent les actions solidaires de Bab Rayan
              </p>
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-16">
          <div className="container">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
                <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="bg-gradient-to-br from-amber-100 to-orange-100 h-48 flex items-center justify-center text-6xl">
                    {product.image}
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-amber-700 mb-1">{product.category}</p>
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                      </div>
                      <Heart className="h-5 w-5 text-muted-foreground hover:text-red-500 cursor-pointer transition-colors" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-2xl font-bold text-amber-700">{product.price} DH</span>
                      <Button
                        onClick={() => addToCart(product)}
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Ajouter
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                  <h3 className="font-semibold text-lg">100% Authentique</h3>
                  <p className="text-muted-foreground">
                    Produits sélectionnés directement auprès des producteurs et artisans marocains
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-none bg-transparent">
                <CardContent className="pt-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-semibold text-lg">Soutien Local</h3>
                  <p className="text-muted-foreground">
                    Chaque achat soutient directement les communautés et artisans du Maroc
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-none bg-transparent">
                <CardContent className="pt-0 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-semibold text-lg">Livraison Rapide</h3>
                  <p className="text-muted-foreground">
                    Expédition rapide et sécurisée vers toute le Maroc
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Cart Summary */}
        {totalItems > 0 && (
          <section className="py-16 bg-amber-50 border-t border-amber-200">
            <div className="container">
              <div className="max-w-2xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Résumé du panier</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {cart.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.name} x{item.quantity}</span>
                          <span className="font-medium">{item.price * item.quantity} DH</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-4 flex justify-between text-lg font-bold">
                      <span>Total ({totalItems} articles)</span>
                      <span className="text-amber-700">{totalPrice} DH</span>
                    </div>
                    <Button className="w-full bg-amber-600 hover:bg-amber-700 text-lg py-6">
                      Procéder au paiement
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        )}

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

      <Footer />
    </div>
  );
}
