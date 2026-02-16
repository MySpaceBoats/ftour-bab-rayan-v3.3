import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { QrCode, ShoppingCart, Check } from 'lucide-react';

export default function AdminScanProduct() {
  const { t } = useI18n();
  const [module, setModule] = useState<'goodie' | 'pastry'>('goodie');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);

  const { data: productList, isLoading: productLoading } = (trpc as any)[module === 'goodie' ? 'goodies' : 'pastries'].list.useQuery();
  const product = productList?.find((p: any) => p.id === (productId ? parseInt(productId) : 0)) ?? null;

  const createOrderMutation = module === 'goodie' 
    ? trpc.orders.create.useMutation()
    : trpc.pastryOrders.create.useMutation();

  const handleCreateOrder = async () => {
    if (!product || !customerName || !customerPhone) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (module === 'goodie') {
        await (createOrderMutation as any).mutateAsync({
          customerName,
          customerEmail: '',
          customerPhone,
          phone: customerPhone,
          items: [
            {
              goodieId: product.id,
              quantity,
              unitPrice: product.price,
            },
          ],
          totalAmount: product.price * quantity,
          paymentMethod: paymentMethod as any,
          channel: 'on_site_admin',
          deliveryMode: 'pickup',
        });
      } else {
        await (createOrderMutation as any).mutateAsync({
          customerName,
          customerEmail: '',
          customerPhone,
          phone: customerPhone,
          items: [
            {
              pastryId: product.id,
              quantity,
              price: product.price,
            },
          ],
          totalAmount: product.price * quantity,
          paymentMethod: paymentMethod as any,
          channel: 'on_site_admin',
        });
      }

      setOrderCreated(true);
      setTimeout(() => {
        setProductId('');
        setQuantity(1);
        setCustomerName('');
        setCustomerPhone('');
        setOrderCreated(false);
      }, 2000);
    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center gap-3 mb-2">
            <QrCode className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-foreground">Vente sur place</h1>
          </div>
          <p className="text-muted-foreground">Créer une commande rapide pour les ventes sur place</p>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card className="p-8">
              <div className="space-y-6">
                {/* Module Selection */}
                <div>
                  <Label>Module</Label>
                  <Select value={module} onValueChange={(v: any) => setModule(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="goodie">Goodies</SelectItem>
                      <SelectItem value="pastry">Pâtisserie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Product ID */}
                <div>
                  <Label>ID Produit</Label>
                  <Input
                    type="number"
                    value={productId}
                    onChange={e => setProductId(e.target.value)}
                    placeholder="Entrez l'ID du produit"
                  />
                </div>

                {/* Product Info */}
                {productLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
                {product && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-semibold text-lg mb-2">{product.name}</p>
                    <p className="text-sm text-muted-foreground mb-2">{product.description}</p>
                    <p className="text-2xl font-bold text-primary">{product.price} DH</p>
                  </div>
                )}

                {/* Quantity */}
                {product && (
                  <div>
                    <Label>Quantité</Label>
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
                )}

                {/* Customer Info */}
                {product && (
                  <>
                    <div>
                      <Label>Nom du client</Label>
                      <Input
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        placeholder="Nom complet"
                      />
                    </div>

                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        placeholder="Numéro de téléphone"
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <Label>Méthode de paiement</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Espèces</SelectItem>
                          <SelectItem value="bank_transfer">Virement</SelectItem>
                          <SelectItem value="cheque">Chèque</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={handleCreateOrder}
                      disabled={isSubmitting || !customerName || !customerPhone}
                      className="w-full"
                      size="lg"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {isSubmitting ? 'Création...' : 'Créer la commande'}
                    </Button>

                    {orderCreated && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <p className="text-green-900">Commande créée avec succès!</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Summary */}
          {product && (
            <div className="lg:col-span-1">
              <Card className="sticky top-4 p-6">
                <h3 className="font-semibold text-lg mb-4">Résumé</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Produit</span>
                    <span className="font-semibold">{product.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prix unitaire</span>
                    <span className="font-semibold">{product.price} DH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantité</span>
                    <span className="font-semibold">{quantity}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">{product.price * quantity} DH</span>
                  </div>
                  {customerName && (
                    <div className="bg-blue-50 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-blue-900">{customerName}</p>
                      <p className="text-blue-800">{customerPhone}</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
