import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RequireRole from "@/components/RequireRole";
import {
  Package, Warehouse, MapPin, ArrowLeftRight, BarChart3,
  AlertTriangle, TrendingDown, History, QrCode,
} from "lucide-react";

function StockLevelCard({
  title, value, subtitle, icon: Icon, color,
}: {
  title: string; value: number; subtitle?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminInventory() {
  const { data: summary, isLoading } = trpc.inventory.stock.summary.useQuery(undefined, {
    staleTime: 60_000,
  });
  const { data: movements } = trpc.inventory.movements.list.useQuery(
    { limit: 10, offset: 0 },
    { staleTime: 30_000 },
  );

  const globalQty    = summary?.globalQty       ?? 0;
  const bufferQty    = summary?.bufferQty        ?? 0;
  const posQty       = summary?.posQty           ?? 0;
  const lowStock     = { length: summary?.lowStockCount    ?? 0 };
  const outOfStock   = { length: summary?.outOfStockCount  ?? 0 };

  const navLinks = [
    { href: "/admin/inventory/products",  label: "Produits & Stock",          icon: Package },
    { href: "/admin/inventory/events",    label: "Événements & Buffers",       icon: Warehouse },
    { href: "/admin/inventory/movements", label: "Journal des mouvements",     icon: History },
    { href: "/admin/inventory/stock-entry", label: "QR Entrée Stock", icon: QrCode },
  ];

  return (
    <RequireRole allowedRoles={["admin", "super_admin", "admin_ops", "admin_boutique", "admin_patisserie", "admin_terroir"]}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Warehouse className="h-6 w-6 text-green-700" />
              Gestion de Stock
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Stock multi-niveaux : Global → Buffer événement → Points de vente
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm">Retour dashboard</Button>
          </Link>
        </div>

        {/* Navigation rapide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className="h-5 w-5 text-green-700" />
                  <span className="font-medium text-sm">{label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StockLevelCard
              title="Stock Global"
              value={globalQty}
              subtitle="Unités en stock central"
              icon={Warehouse}
              color="text-blue-600"
            />
            <StockLevelCard
              title="En Buffer Événement"
              value={bufferQty}
              subtitle="Stocks intermédiaires"
              icon={ArrowLeftRight}
              color="text-amber-600"
            />
            <StockLevelCard
              title="En Points de Vente"
              value={posQty}
              subtitle="Disponible dans les POS"
              icon={MapPin}
              color="text-green-600"
            />
            <StockLevelCard
              title="Stock total"
              value={globalQty + bufferQty + posQty}
              subtitle={`${summary?.activeProductCount ?? 0} produits actifs`}
              icon={BarChart3}
              color="text-purple-600"
            />
          </div>
        )}

        {/* Alertes */}
        {(lowStock.length > 0 || outOfStock.length > 0) && (
          <div className="space-y-2">
            {outOfStock.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="flex items-center gap-3 p-4">
                  <TrendingDown className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800 text-sm">
                      {outOfStock.length} emplacement(s) en rupture de stock
                    </p>
                    <p className="text-red-600 text-xs mt-0.5">
                      Consultez la page Produits &amp; Stock pour le détail.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {lowStock.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">
                      {lowStock.length} emplacement(s) avec stock faible (≤ 5)
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5">
                      Consultez la page Produits &amp; Stock pour le détail.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Mouvements récents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Mouvements récents
            </CardTitle>
            <Link href="/admin/inventory/movements">
              <Button variant="outline" size="sm">Voir tout</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!movements?.movements?.length ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Aucun mouvement enregistré
              </p>
            ) : (
              <div className="space-y-2">
                {(movements.movements ?? []).slice(0, 8).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div className="flex items-center gap-2">
                      <MovementBadge type={m.movement_type} />
                      <span className="font-medium truncate max-w-[160px]">
                        {m.inventory_products?.name ?? `#${m.product_id}`}
                      </span>
                      {m.from_location && (
                        <span className="text-muted-foreground hidden sm:inline">
                          {m.from_location.name}
                        </span>
                      )}
                      {m.from_location && m.to_location && (
                        <span className="text-muted-foreground hidden sm:inline">→</span>
                      )}
                      {m.to_location && (
                        <span className="text-muted-foreground hidden sm:inline">
                          {m.to_location.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-green-700">
                        {['SALE', 'TRANSFER_OUT', 'RETURN_OUT', 'ADJUSTMENT_MINUS'].includes(m.movement_type) ? '-' : '+'}
                        {m.quantity}
                      </span>
                      <span className="text-muted-foreground text-xs hidden sm:inline">
                        {new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RequireRole>
  );
}

function MovementBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    INITIAL_LOAD:    { label: 'Init',       variant: 'secondary' },
    PURCHASE_IN:     { label: 'Entrée',     variant: 'default' },
    DONATION_IN:     { label: 'Don',        variant: 'default' },
    PRODUCTION_IN:   { label: 'Prod.',      variant: 'default' },
    TRANSFER_OUT:    { label: 'Transfert',  variant: 'outline' },
    TRANSFER_IN:     { label: 'Réception',  variant: 'outline' },
    SALE:            { label: 'Vente',      variant: 'destructive' },
    RETURN_IN:       { label: 'Retour+',    variant: 'secondary' },
    RETURN_OUT:      { label: 'Retour-',    variant: 'outline' },
    ADJUSTMENT_PLUS: { label: 'Ajust.+',   variant: 'default' },
    ADJUSTMENT_MINUS:{ label: 'Ajust.-',   variant: 'destructive' },
  };
  const { label, variant } = map[type] ?? { label: type, variant: 'outline' };
  return <Badge variant={variant} className="text-xs shrink-0">{label}</Badge>;
}
