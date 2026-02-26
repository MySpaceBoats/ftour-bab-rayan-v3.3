import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';

type ItemType = 'GOODIE' | 'PASTRY' | 'TERROIR' | 'DONATION';
type MenuTab = 'ALL' | ItemType;

type CatalogItem = {
  id: string;
  sourceId: number;
  type: ItemType;
  name: string;
  description: string;
  priceMad: number;
  imageUrl?: string | null;
  variantId?: number;
};

type CartItem = {
  key: string;
  productId: number | null;
  name: string;
  type: ItemType;
  unitPriceMad: number;
  qty: number;
  meta?: Record<string, unknown>;
};

const CART_KEY = 'menu_solidaire_cart';

export default function MenuSolidaire() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<MenuTab>('ALL');
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<{
    goodies: CatalogItem[];
    pastries: CatalogItem[];
    terroir: CatalogItem[];
    donations: { presets: number[] };
  }>({
    goodies: [],
    pastries: [],
    terroir: [],
    donations: { presets: [] },
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customDonation, setCustomDonation] = useState<number>(0);

  useEffect(() => {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) setCart(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then(setCatalog)
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => cart.reduce((s, i) => s + i.unitPriceMad * i.qty, 0), [cart]);

  const addToCart = (item: Omit<CartItem, 'qty'>) => {
    setCart((prev) => {
      const idx = prev.findIndex((p) => p.key === item.key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const sections = useMemo(
    () => [
      { key: 'GOODIE' as const, title: 'Goodies', items: catalog.goodies },
      { key: 'PASTRY' as const, title: 'Pâtisseries', items: catalog.pastries },
      { key: 'TERROIR' as const, title: 'Produits du terroir', items: catalog.terroir },
    ],
    [catalog.goodies, catalog.pastries, catalog.terroir],
  );

  const hasAnyCatalogItems = sections.some((s) => s.items.length > 0);

  const renderProductCard = (item: CatalogItem) => (
    <Card key={item.id}>
      <CardHeader>
        <CardTitle>{item.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{item.description}</p>
        <p className="font-semibold">{item.priceMad} MAD</p>
        <Button
          onClick={() =>
            addToCart({
              key: item.id,
              productId: item.sourceId,
              name: item.name,
              type: item.type,
              unitPriceMad: item.priceMad,
              meta: item.variantId ? { variantId: item.variantId } : undefined,
            })
          }
        >
          Ajouter
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-3xl font-bold">Menu Solidaire</h1>
      <p className="text-muted-foreground">
        Choisissez vos goodies, pâtisseries, produits du terroir ou faites un don. Paiement en espèces uniquement.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as MenuTab)}>
        <TabsList>
          <TabsTrigger value="ALL">Tous</TabsTrigger>
          <TabsTrigger value="GOODIE">Goodies</TabsTrigger>
          <TabsTrigger value="PASTRY">Pâtisseries</TabsTrigger>
          <TabsTrigger value="TERROIR">Produits du terroir</TabsTrigger>
          <TabsTrigger value="DONATION">Dons</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p>Chargement…</p>
      ) : (
        <div className="space-y-8">
          {tab === 'ALL' && (
            <>
              {!hasAnyCatalogItems && <p className="text-muted-foreground">Aucun produit disponible pour le moment.</p>}

              {sections.map((section) => (
                <section key={section.key} className="space-y-3">
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                  {section.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun item dans cette catégorie.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-3">{section.items.map(renderProductCard)}</div>
                  )}
                </section>
              ))}

              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Dons solidaires</h2>
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {catalog.donations.presets.map((amt) => (
                        <Button
                          key={amt}
                          variant="outline"
                          onClick={() =>
                            addToCart({
                              key: `DON-${amt}`,
                              productId: null,
                              name: `Don ${amt} MAD`,
                              type: 'DONATION',
                              unitPriceMad: amt,
                              meta: { preset: true },
                            })
                          }
                        >
                          + {amt} MAD
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label>Don libre (MAD)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={customDonation || ''}
                        onChange={(e) => setCustomDonation(Number(e.target.value || 0))}
                      />
                      <Button
                        disabled={!customDonation}
                        onClick={() =>
                          addToCart({
                            key: `DON-CUSTOM-${Date.now()}`,
                            productId: null,
                            name: 'Don libre',
                            type: 'DONATION',
                            unitPriceMad: customDonation,
                            meta: { custom: true, amount: customDonation },
                          })
                        }
                      >
                        Ajouter don libre
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </>
          )}

          {tab !== 'ALL' && tab !== 'DONATION' && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">
                {tab === 'GOODIE' ? 'Goodies' : tab === 'PASTRY' ? 'Pâtisseries' : 'Produits du terroir'}
              </h2>
              {sections.find((s) => s.key === tab)?.items.length ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {sections.find((s) => s.key === tab)!.items.map(renderProductCard)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun item dans cette catégorie.</p>
              )}
            </section>
          )}

          {tab === 'DONATION' && (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Dons solidaires</h2>
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {catalog.donations.presets.map((amt) => (
                      <Button
                        key={amt}
                        variant="outline"
                        onClick={() =>
                          addToCart({
                            key: `DON-${amt}`,
                            productId: null,
                            name: `Don ${amt} MAD`,
                            type: 'DONATION',
                            unitPriceMad: amt,
                            meta: { preset: true },
                          })
                        }
                      >
                        + {amt} MAD
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Don libre (MAD)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={customDonation || ''}
                      onChange={(e) => setCustomDonation(Number(e.target.value || 0))}
                    />
                    <Button
                      disabled={!customDonation}
                      onClick={() =>
                        addToCart({
                          key: `DON-CUSTOM-${Date.now()}`,
                          productId: null,
                          name: 'Don libre',
                          type: 'DONATION',
                          unitPriceMad: customDonation,
                          meta: { custom: true, amount: customDonation },
                        })
                      }
                    >
                      Ajouter don libre
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      )}

      <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow p-4 min-w-[280px] space-y-2">
        <p className="font-semibold">Panier ({cart.reduce((s, i) => s + i.qty, 0)} articles)</p>
        <p className="text-sm">
          Total: <strong>{total} MAD</strong>
        </p>
        <div className="max-h-36 overflow-auto space-y-1 text-sm">
          {cart.map((i) => (
            <div key={i.key} className="flex justify-between gap-2">
              <span>
                {i.name} x{i.qty}
              </span>
              <button
                onClick={() =>
                  setCart((prev) =>
                    prev
                      .map((p) => (p.key === i.key ? { ...p, qty: Math.max(0, p.qty - 1) } : p))
                      .filter((p) => p.qty > 0),
                  )
                }
              >
                -
              </button>
            </div>
          ))}
        </div>
        <Button className="w-full" disabled={!cart.length} onClick={() => navigate('/menu/checkout')}>
          Valider en espèces
        </Button>
      </div>
    </div>
  );
}

export { CART_KEY };
