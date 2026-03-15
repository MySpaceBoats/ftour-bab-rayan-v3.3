import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Loader2,
  QrCode,
  Download,
  ShoppingBag,
  CakeSlice,
  Package,
  Heart,
  Search,
  X,
  Save,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import QRCode from "qrcode";

// ============================================
// TYPES
// ============================================

type ProductCategory = "goodies" | "patisserie" | "terroir" | "dons";

interface CatalogProduct {
  id: number;
  name: string;
  imageUrl: string | null;
  price: number | null;
  category: ProductCategory;
  qrUrl: string;
  qrDataUrl: string;
}

interface SavedCustomQR {
  id: number;
  label: string;
  url: string;
  created_at: string;
  qrDataUrl?: string;
}

const CATEGORY_CONFIG: Record<
  ProductCategory,
  { label: string; icon: typeof ShoppingBag; color: string; bg: string }
> = {
  goodies: {
    label: "Goodies",
    icon: ShoppingBag,
    color: "text-secondary-foreground",
    bg: "bg-secondary/20",
  },
  patisserie: {
    label: "Pâtisserie",
    icon: CakeSlice,
    color: "text-amber-600",
    bg: "bg-amber-100",
  },
  terroir: {
    label: "Terroir",
    icon: Package,
    color: "text-emerald-700",
    bg: "bg-emerald-100",
  },
  dons: { label: "Dons", icon: Heart, color: "text-red-500", bg: "bg-red-50" },
};

const ALL_CATEGORIES: ProductCategory[] = [
  "goodies",
  "patisserie",
  "terroir",
  "dons",
];

// ============================================
// COMPONENT
// ============================================

export default function AdminQRCodes() {
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(
    null
  );
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customQrDataUrl, setCustomQrDataUrl] = useState("");
  const [customQrError, setCustomQrError] = useState("");
  const [isGeneratingCustomQr, setIsGeneratingCustomQr] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [selectedSavedQR, setSelectedSavedQR] = useState<SavedCustomQR | null>(
    null
  );

  const utils = trpc.useUtils();

  // Fetch all QR codes from server (generated server-side)
  const { data: products, isLoading } = trpc.qr.catalogQRCodes.useQuery(
    undefined,
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  // Fetch saved custom QR codes
  const { data: savedQRs, isLoading: isLoadingSaved } =
    trpc.qr.listCustom.useQuery();

  const saveCustomMutation = trpc.qr.saveCustom.useMutation({
    onSuccess: () => {
      void utils.qr.listCustom.invalidate();
      setCustomLabel("");
    },
  });

  const deleteCustomMutation = trpc.qr.deleteCustom.useMutation({
    onSuccess: () => {
      void utils.qr.listCustom.invalidate();
      setDeleteConfirmId(null);
    },
  });

  const items: CatalogProduct[] = (products || []).map((p: any) => ({
    ...p,
    category: p.category as ProductCategory,
  }));

  // Filter products
  const filteredProducts = items.filter(p => {
    const matchesCategory =
      activeCategory === "all" || p.category === activeCategory;
    const matchesSearch =
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Count by category
  const countByCategory = (cat: ProductCategory) =>
    items.filter(p => p.category === cat).length;

  const generateCustomQrCode = async () => {
    const trimmedUrl = customUrl.trim();

    if (!trimmedUrl) {
      setCustomQrError("Veuillez renseigner une URL.");
      setCustomQrDataUrl("");
      return;
    }

    try {
      const parsedUrl = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Protocole invalide");
      }

      setIsGeneratingCustomQr(true);
      setCustomQrError("");

      const dataUrl = await QRCode.toDataURL(trimmedUrl, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 400,
      });

      setCustomQrDataUrl(dataUrl);
    } catch {
      setCustomQrError(
        "URL invalide. Utilisez une URL complète (https://...)."
      );
      setCustomQrDataUrl("");
    } finally {
      setIsGeneratingCustomQr(false);
    }
  };

  const clearCustomQr = () => {
    setCustomQrDataUrl("");
    setCustomUrl("");
    setCustomLabel("");
    setCustomQrError("");
  };

  const handleSaveCustomQr = () => {
    const trimmedUrl = customUrl.trim();
    const trimmedLabel = customLabel.trim();
    if (!trimmedUrl || !customQrDataUrl) return;
    saveCustomMutation.mutate({
      label: trimmedLabel || trimmedUrl,
      url: trimmedUrl,
    });
  };

  // Download QR code (fetch external image and save as blob)
  const downloadQR = async (product: {
    name: string;
    category: string;
    qrDataUrl: string;
    qrUrl: string;
  }) => {
    if (!product.qrDataUrl) return;
    try {
      const res = await fetch(product.qrDataUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `qr-${product.category}-${product.name.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = blobUrl;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(product.qrDataUrl, "_blank");
    }
  };

  const downloadSavedQR = async (saved: SavedCustomQR) => {
    let dataUrl = saved.qrDataUrl;
    if (!dataUrl) {
      dataUrl = await QRCode.toDataURL(saved.url, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 400,
      });
    }
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `qr-custom-${saved.label.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = blobUrl;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(dataUrl, "_blank");
    }
  };

  const openSavedQR = async (saved: SavedCustomQR) => {
    if (!saved.qrDataUrl) {
      const dataUrl = await QRCode.toDataURL(saved.url, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 400,
      });
      setSelectedSavedQR({ ...saved, qrDataUrl: dataUrl });
    } else {
      setSelectedSavedQR(saved);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Codes Catalogue
              </h1>
              <p className="text-xs text-muted-foreground">
                {items.length} QR code(s) disponible(s)
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Custom URL QR generator */}
        <Card className="mb-6">
          <CardContent className="p-4 md:p-6 space-y-4">
            <div>
              <h2 className="text-base md:text-lg font-semibold">
                Générateur QR personnalisé
              </h2>
              <p className="text-sm text-muted-foreground">
                Génère un QR code à partir d'une URL (site web, formulaire, page
                de paiement, etc.).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="https://example.com"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    void generateCustomQrCode();
                  }
                }}
              />
              <Button
                onClick={() => void generateCustomQrCode()}
                disabled={isGeneratingCustomQr}
              >
                {isGeneratingCustomQr ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Générer
              </Button>
            </div>

            {customQrError && (
              <p className="text-sm text-red-600">{customQrError}</p>
            )}

            {customQrDataUrl && (
              <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                <div className="bg-white rounded-lg p-4 flex items-center justify-center border">
                  <img
                    src={customQrDataUrl}
                    alt="QR code personnalisé"
                    className="w-48 h-48 md:w-56 md:h-56"
                  />
                </div>

                <div className="text-xs text-muted-foreground break-all bg-muted/50 p-2 rounded">
                  {customUrl.trim()}
                </div>

                {/* Label input for saving */}
                <Input
                  placeholder="Libellé (optionnel, ex: Page d'accueil)"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      downloadQR({
                        name: "custom-url",
                        category: "custom",
                        qrUrl: customUrl.trim(),
                        qrDataUrl: customQrDataUrl,
                      })
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button
                    onClick={handleSaveCustomQr}
                    disabled={saveCustomMutation.isPending}
                  >
                    {saveCustomMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Sauvegarder
                  </Button>
                  <Button variant="ghost" onClick={clearCustomQr}>
                    <X className="h-4 w-4 mr-2" />
                    Effacer
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved custom QR codes */}
        {((savedQRs && savedQRs.length > 0) || isLoadingSaved) && (
          <Card className="mb-6">
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base md:text-lg font-semibold">
                    QR codes personnalisés sauvegardés
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {savedQRs?.length ?? 0} QR code(s) sauvegardé(s)
                  </p>
                </div>
              </div>

              {isLoadingSaved ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="divide-y">
                  {savedQRs?.map(saved => (
                    <div
                      key={saved.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {saved.label || saved.url}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {saved.url}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(saved.created_at).toLocaleDateString(
                            "fr-FR",
                            { day: "2-digit", month: "short", year: "numeric" }
                          )}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void openSavedQR(saved)}
                          title="Afficher le QR"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void downloadSavedQR(saved)}
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteConfirmId(saved.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card
            className={`cursor-pointer transition-all ${activeCategory === "all" ? "ring-2 ring-primary" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{items.length}</div>
              <div className="text-xs text-muted-foreground">Tous</div>
            </CardContent>
          </Card>
          {ALL_CATEGORIES.map(cat => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;
            return (
              <Card
                key={cat}
                className={`cursor-pointer transition-all ${activeCategory === cat ? "ring-2 ring-primary" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="text-2xl font-bold">
                    {countByCategory(cat)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {config.label}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <QrCode className="h-12 w-12 mb-4" />
            <p>Aucun QR code trouvé</p>
          </div>
        ) : (
          /* QR Code Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => {
              const key = `${product.category}-${product.id}`;
              const config = CATEGORY_CONFIG[product.category];
              const Icon = config.icon;

              return (
                <Card
                  key={key}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-4">
                    {/* Product header */}
                    <div className="flex items-start gap-3 mb-3">
                      {product.imageUrl ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-lg flex-shrink-0 ${config.bg} flex items-center justify-center`}
                        >
                          <Icon className={`h-5 w-5 ${config.color}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-xs">
                            {config.label}
                          </Badge>
                          {product.price != null && (
                            <span className="text-xs text-muted-foreground">
                              {product.price} DH
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div
                      className="bg-white rounded-lg p-3 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors border"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <img
                        src={product.qrDataUrl}
                        alt={`QR Code - ${product.name}`}
                        className="w-40 h-40"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        Agrandir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => downloadQR(product)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Télécharger
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Full-size QR Code (catalog) */}
      <Dialog
        open={!!selectedProduct}
        onOpenChange={open => {
          if (!open) setSelectedProduct(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {/* Category badge */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {CATEGORY_CONFIG[selectedProduct.category].label}
                </Badge>
                {selectedProduct.price != null && (
                  <span className="text-sm text-muted-foreground">
                    {selectedProduct.price} DH
                  </span>
                )}
              </div>

              {/* QR Code full size */}
              <div className="bg-white rounded-xl p-6 flex items-center justify-center border">
                <img
                  src={selectedProduct.qrDataUrl}
                  alt={`QR Code - ${selectedProduct.name}`}
                  className="w-72 h-72"
                />
              </div>

              {/* URL info */}
              <div className="text-xs text-muted-foreground text-center break-all bg-muted/50 p-2 rounded">
                {selectedProduct.qrUrl}
              </div>

              {/* Download */}
              <Button
                className="w-full"
                onClick={() => downloadQR(selectedProduct)}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger le QR Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Full-size saved custom QR code */}
      <Dialog
        open={!!selectedSavedQR}
        onOpenChange={open => {
          if (!open) setSelectedSavedQR(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {selectedSavedQR?.label || "QR personnalisé"}
            </DialogTitle>
          </DialogHeader>
          {selectedSavedQR && (
            <div className="space-y-4">
              {selectedSavedQR.qrDataUrl ? (
                <div className="bg-white rounded-xl p-6 flex items-center justify-center border">
                  <img
                    src={selectedSavedQR.qrDataUrl}
                    alt={`QR Code - ${selectedSavedQR.label}`}
                    className="w-72 h-72"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center break-all bg-muted/50 p-2 rounded">
                {selectedSavedQR.url}
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => void downloadSavedQR(selectedSavedQR)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
                <Button
                  variant="outline"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => {
                    setSelectedSavedQR(null);
                    setDeleteConfirmId(selectedSavedQR.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={open => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce QR code ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le QR code sera définitivement
              supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteConfirmId !== null) {
                  deleteCustomMutation.mutate({ id: deleteConfirmId });
                }
              }}
              disabled={deleteCustomMutation.isPending}
            >
              {deleteCustomMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
