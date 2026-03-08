import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, AlertCircle, Package } from "lucide-react";
import { Link } from "wouter";
import NotFound from "@/features/public/pages/NotFound";

const statusLabels: Record<string, string> = {
  created: "Enregistrée",
  paid: "Payée",
  ready: "Prête",
  picked_up: "Retirée",
  cancelled: "Annulée",
  no_show: "No-show",
};

const statusColors: Record<string, string> = {
  created: "bg-gray-100 text-gray-700",
  paid: "bg-green-100 text-green-700",
  ready: "bg-blue-100 text-blue-700",
  picked_up: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

export default function TerroirQRPage() {
  const { reference } = useParams<{ reference: string }>();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  if (!reference) {
    return <NotFound />;
  }

  const { data: order, isLoading, error } = trpc.terroirModule.getOrderByReference.useQuery(
    { reference }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-2">Commande introuvable</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {error?.message || "Nous n'avons pas trouvé cette commande terroir."}
                </p>
                <Link href={`/${lang}/terroir`}>
                  <Button className="w-full">Voir les produits terroir</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled" || order.status === "no_show";
  const isDelivered = order.status === "picked_up";

  return (
    <div className="min-h-screen bg-background py-12" dir={dir}>
      <div className="container max-w-2xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex justify-center">
            {isCancelled ? (
              <AlertCircle className="h-16 w-16 text-red-500" />
            ) : (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
          </div>
          <h1 className="text-3xl font-bold">
            {isCancelled ? "Commande annulée" : "Commande confirmée !"}
          </h1>
          <p className="text-muted-foreground">
            {isCancelled
              ? "Cette commande a été annulée."
              : "Votre commande de produits du terroir a bien été enregistrée."}
          </p>
        </div>

        {/* Reference & Status */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Référence de commande</p>
              <p className="text-2xl font-bold font-mono text-amber-700">
                {order.order_reference}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Statut</span>
              <Badge className={statusColors[order.status] || "bg-gray-100"}>
                {statusLabels[order.status] || order.status}
              </Badge>
            </div>

            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>{parseFloat(order.total_amount).toFixed(2)} DH</span>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        {order.terroir_order_items && order.terroir_order_items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Articles commandés
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.terroir_order_items.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">
                      {item.terroir_products?.name || `Produit #${item.product_id}`}
                    </p>
                    {item.terroir_product_variants?.label && (
                      <p className="text-xs text-muted-foreground">
                        {item.terroir_product_variants.label}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Qté: {item.quantity}</p>
                  </div>
                  <p className="font-medium text-sm">{parseFloat(item.total_price).toFixed(2)} DH</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!isCancelled && !isDelivered && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold">Prochaines étapes</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Votre commande a été enregistrée avec succès.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 font-bold">→</span>
                  <span>Présentez cette page ou votre référence lors du retrait.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-600 font-bold">→</span>
                  <span>Le paiement s'effectue sur place au moment du retrait.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="flex gap-4 justify-center">
          <Link href={`/${lang}/terroir`}>
            <Button variant="outline">Voir les produits</Button>
          </Link>
          <Link href={`/${lang}`}>
            <Button>Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
