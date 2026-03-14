import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Plus } from 'lucide-react';
import { useI18n } from '@/i18n';

type TerroirVariant = {
  id?: number;
  label: string;
  price_unit: number;
  stock_total?: number | null;
  stock_reserved?: number | null;
};

interface TerroirProductCardProps {
  product: any;
  variants: TerroirVariant[];
  onAddToCart: (product: any, variant: TerroirVariant) => void;
}

export default function TerroirProductCard({ product, variants, onAddToCart }: TerroirProductCardProps) {
  const { t } = useI18n();
  const first = variants[0];

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
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
          {variants.map((variant: TerroirVariant) => {
            const hasStockTracking = variant.stock_total != null;
            const totalStock = Number(variant.stock_total ?? 0);
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
                <Button size="sm" disabled={isOutOfStock} onClick={() => onAddToCart(product, variant)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isOutOfStock ? (t.terroir.outOfStock || 'Rupture de stock') : t.terroir.addToCart}
                </Button>
              </div>
            );
          })}
        </div>

        {variants.length > 0 && (
          <p className="text-sm text-muted-foreground">À partir de {Number(first?.price_unit) || 0} DH</p>
        )}
      </CardContent>
    </Card>
  );
}
