import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import RequireRole from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";

type ProductType = "all" | "goodies" | "pastry" | "terroir";

export default function AdminUnifiedCatalog() {
  const [selectedType, setSelectedType] = useState<ProductType>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] =
    useState<Exclude<ProductType, "all">>("goodies");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "",
    imageUrl: "",
    price: 0,
    stock: 0,
    sortOrder: 0,
    isActive: true,
    variantLabel: "",
    variantSku: "",
  });

  const goodiesQuery = trpc.goodies.listAll.useQuery();
  const pastriesQuery = trpc.pastries.list.useQuery();
  const terroirQuery = trpc.terroirModule.adminListProducts.useQuery();

  const uploadMutation = trpc.upload.image.useMutation({
    onError: (error: any) => {
      toast.error(`Erreur upload: ${error.message}`);
      setIsUploading(false);
    },
  });

  const createGoodie = trpc.goodies.create.useMutation({
    onSuccess: () => {
      toast.success("Produit goodies créé");
      postCreate();
      goodiesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createPastry = trpc.pastries.create.useMutation({
    onSuccess: () => {
      toast.success("Produit pâtisserie créé");
      postCreate();
      pastriesQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createTerroirProduct =
    trpc.terroirModule.adminCreateProduct.useMutation({
      onSuccess: async created => {
        if (form.variantLabel) {
          await createTerroirVariant.mutateAsync({
            productId: created.id,
            label: form.variantLabel,
            sku: form.variantSku,
            priceUnit: form.price,
            stockTotal: form.stock,
            isActive: form.isActive,
          });
        }
        toast.success("Produit terroir créé");
        postCreate();
        terroirQuery.refetch();
      },
      onError: (err: any) => toast.error(err.message),
    });

  const createTerroirVariant =
    trpc.terroirModule.adminCreateVariant.useMutation({
      onError: (err: any) => toast.error(err.message),
    });

  const updateGoodie = trpc.goodies.update.useMutation({
    onSuccess: () => goodiesQuery.refetch(),
    onError: (err: any) => toast.error(err.message),
  });

  const updatePastry = trpc.pastries.update.useMutation({
    onSuccess: () => pastriesQuery.refetch(),
    onError: (err: any) => toast.error(err.message),
  });

  const updateTerroir = trpc.terroirModule.adminUpdateProduct.useMutation({
    onSuccess: () => terroirQuery.refetch(),
    onError: (err: any) => toast.error(err.message),
  });

  const postCreate = () => {
    setShowCreate(false);
    setImagePreview(null);
    setForm({
      name: "",
      description: "",
      category: "",
      imageUrl: "",
      price: 0,
      stock: 0,
      sortOrder: 0,
      isActive: true,
      variantLabel: "",
      variantSku: "",
    });
  };

  const unifiedRows = useMemo(() => {
    const goodies = (goodiesQuery.data || []).map((item: any) => ({
      id: `goodies-${item.id}`,
      type: "goodies" as const,
      name: item.name,
      category: item.category || "-",
      price: item.price,
      stock: item.stock ?? 0,
      isActive: item.isActive,
      manageRoute: "/admin/goodies",
      rawId: item.id,
    }));

    const pastries = (pastriesQuery.data || []).map((item: any) => ({
      id: `pastry-${item.id}`,
      type: "pastry" as const,
      name: item.name,
      category: item.category || "-",
      price: item.price,
      stock: item.stock ?? 0,
      isActive: item.active,
      manageRoute: "/admin/patisserie/catalogue",
      rawId: item.id,
    }));

    const terroir = (terroirQuery.data || []).map((item: any) => ({
      id: `terroir-${item.id}`,
      type: "terroir" as const,
      name: item.name,
      category: item.category || "-",
      price: item.terroir_product_variants?.[0]?.price_unit
        ? Number(item.terroir_product_variants[0].price_unit)
        : null,
      stock: (item.terroir_product_variants || []).reduce(
        (sum: number, v: any) => sum + (v.stock_total - v.stock_reserved),
        0
      ),
      isActive: item.is_active,
      manageRoute: "/admin/terroir/products",
      rawId: item.id,
    }));

    const combined = [...goodies, ...pastries, ...terroir];
    if (selectedType === "all") return combined;
    return combined.filter(row => row.type === selectedType);
  }, [goodiesQuery.data, pastriesQuery.data, terroirQuery.data, selectedType]);

  const loading =
    goodiesQuery.isLoading || pastriesQuery.isLoading || terroirQuery.isLoading;

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Type de fichier non autorisé. Utilisez PNG, JPEG ou WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux. Maximum 5 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async e => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);
      setIsUploading(true);
      try {
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          fileData: base64,
          folder: createType === "pastry" ? "pastries" : createType,
        });
        setForm(prev => ({ ...prev, imageUrl: result.url }));
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!form.name) {
      toast.error("Le nom du produit est obligatoire");
      return;
    }

    if (createType !== "terroir" && !form.price) {
      toast.error("Le prix est obligatoire");
      return;
    }

    if (createType === "goodies") {
      createGoodie.mutate({
        name: form.name,
        description: form.description,
        category: form.category,
        imageUrl: form.imageUrl,
        price: form.price,
        stock: form.stock,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });
      return;
    }

    if (createType === "pastry") {
      createPastry.mutate({
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        imageUrl: form.imageUrl || undefined,
        price: form.price,
        stock: form.stock,
        sortOrder: form.sortOrder,
      });
      return;
    }

    createTerroirProduct.mutate({
      name: form.name,
      description: form.description,
      category: form.category,
      imageUrl: form.imageUrl,
      isActive: form.isActive,
      sortOrder: form.sortOrder,
    });
  };

  const toggleActive = (row: any) => {
    if (row.type === "goodies") {
      updateGoodie.mutate({ id: row.rawId, isActive: !row.isActive });
    } else if (row.type === "pastry") {
      updatePastry.mutate({ id: row.rawId, active: !row.isActive });
    } else {
      updateTerroir.mutate({ id: row.rawId, isActive: !row.isActive });
    }
  };

  return (
    <RequireRole
      allowedRoles={[
        "admin",
        "super_admin",
        "admin_boutique",
        "admin_patisserie",
        "admin_terroir",
      ]}
    >
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-50 bg-background border-b">
          <div className="container flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="font-bold text-lg">
                  Dashboard catalogue unifié
                </h1>
                <p className="text-xs text-muted-foreground">
                  Goodies, pâtisseries et terroir depuis un seul écran
                </p>
              </div>
            </div>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Ajouter un produit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Créer un produit</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type de catalogue</Label>
                    <div className="flex gap-2 flex-wrap">
                      {(["goodies", "pastry", "terroir"] as const).map(type => (
                        <Button
                          key={type}
                          type="button"
                          variant={createType === type ? "default" : "outline"}
                          onClick={() => setCreateType(type)}
                        >
                          {type === "goodies"
                            ? "Goodies"
                            : type === "pastry"
                              ? "Pâtisserie"
                              : "Terroir"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Nom du produit *</Label>
                      <Input
                        value={form.name}
                        onChange={e =>
                          setForm(prev => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={form.description}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Input
                        value={form.category}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ordre</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.sortOrder || ""}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            sortOrder: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Prix (DH)
                        {createType === "terroir"
                          ? " (pour 1ère variante)"
                          : " *"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price || ""}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            price: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Stock
                        {createType === "terroir" ? " (1ère variante)" : ""}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.stock || ""}
                        onChange={e =>
                          setForm(prev => ({
                            ...prev,
                            stock: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>

                    {createType === "terroir" && (
                      <>
                        <div className="space-y-2">
                          <Label>Label variante (optionnel)</Label>
                          <Input
                            value={form.variantLabel}
                            onChange={e =>
                              setForm(prev => ({
                                ...prev,
                                variantLabel: e.target.value,
                              }))
                            }
                            placeholder="250g, 500ml..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SKU variante (optionnel)</Label>
                          <Input
                            value={form.variantSku}
                            onChange={e =>
                              setForm(prev => ({
                                ...prev,
                                variantSku: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Image</Label>
                    <div className="border rounded-md p-3">
                      {imagePreview || form.imageUrl ? (
                        <div className="relative inline-block">
                          <img
                            src={imagePreview || form.imageUrl}
                            alt="preview"
                            className="max-h-40 rounded"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => {
                              setImagePreview(null);
                              setForm(prev => ({ ...prev, imageUrl: "" }));
                              if (fileInputRef.current)
                                fileInputRef.current.value = "";
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Choisir une image
                        </Button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleUpload}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Actif</Label>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={checked =>
                        setForm(prev => ({ ...prev, isActive: checked }))
                      }
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleCreate}
                    disabled={
                      isUploading ||
                      createGoodie.isPending ||
                      createPastry.isPending ||
                      createTerroirProduct.isPending
                    }
                  >
                    {isUploading ||
                    createGoodie.isPending ||
                    createPastry.isPending ||
                    createTerroirProduct.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Créer le produit
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="container py-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Tous</p>
                <p className="text-2xl font-bold">
                  {(goodiesQuery.data?.length || 0) +
                    (pastriesQuery.data?.length || 0) +
                    (terroirQuery.data?.length || 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Goodies</p>
                <p className="text-2xl font-bold">
                  {goodiesQuery.data?.length || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pâtisserie</p>
                <p className="text-2xl font-bold">
                  {pastriesQuery.data?.length || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Terroir</p>
                <p className="text-2xl font-bold">
                  {terroirQuery.data?.length || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all", label: "Tous" },
              { key: "goodies", label: "Goodies" },
              { key: "pastry", label: "Pâtisserie" },
              { key: "terroir", label: "Terroir" },
            ].map(item => (
              <Button
                key={item.key}
                variant={selectedType === item.key ? "default" : "outline"}
                onClick={() => setSelectedType(item.key as ProductType)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unifiedRows.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {row.type === "pastry"
                              ? "Pâtisserie"
                              : row.type === "goodies"
                                ? "Goodies"
                                : "Terroir"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>
                          {row.price !== null && row.price !== undefined
                            ? `${Number(row.price).toFixed(2)} DH`
                            : "-"}
                        </TableCell>
                        <TableCell>{row.stock}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              row.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }
                          >
                            {row.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleActive(row)}
                            >
                              {row.isActive ? "Désactiver" : "Activer"}
                            </Button>
                            <Link href={row.manageRoute}>
                              <Button size="sm" variant="outline">
                                <ExternalLink className="h-4 w-4 mr-1" /> Gérer
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <ImageIcon className="h-3 w-3" />
            Pour les variantes terroir avancées et les modifications détaillées,
            le bouton "Gérer" ouvre le module dédié.
          </p>
        </main>
      </div>
    </RequireRole>
  );
}
