import { useState, useMemo } from 'react';
import { useSearchParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Plus, Edit2, Package, Eye, ToggleLeft, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

// ============================================
// ADMIN COMMERCE — UNIFIED VIEW
// ============================================

interface Product {
  id: string;
  type: 'goodie' | 'terroir' | 'pastry';
  name: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
}

interface Order {
  id: string;
  type: 'goodie' | 'terroir' | 'pastry';
  customer_name: string;
  products: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
}

// Mock data
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    type: 'goodie',
    name: 'T-shirt Ftour Bab Rayan',
    price: 150,
    stock: 45,
    status: 'active',
    created_at: '2026-01-15',
  },
  {
    id: 'prod-002',
    type: 'terroir',
    name: 'Miel du Rif',
    price: 250,
    stock: 12,
    status: 'active',
    created_at: '2026-01-20',
  },
  {
    id: 'prod-003',
    type: 'pastry',
    name: 'Cornes de Gazelle',
    price: 80,
    stock: 0,
    status: 'active',
    created_at: '2026-02-01',
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-001',
    type: 'goodie',
    customer_name: 'Mohammed Alaoui',
    products: 'T-shirt (2x)',
    amount: 300,
    status: 'confirmed',
    created_at: '2026-02-10',
  },
  {
    id: 'ord-002',
    type: 'terroir',
    customer_name: 'Fatima Bennani',
    products: 'Miel (1x)',
    amount: 250,
    status: 'shipped',
    created_at: '2026-02-09',
  },
];

export default function AdminCommercePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [productFilters, setProductFilters] = useState({
    type: searchParams.type || '',
    status: searchParams.status || '',
    stock_status: searchParams.stock_status || '',
  });

  // Filter products
  const filteredProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter((prod) => {
      if (productFilters.type && prod.type !== productFilters.type) return false;
      if (productFilters.status && prod.status !== productFilters.status) return false;
      if (productFilters.stock_status === 'in_stock' && prod.stock === 0) return false;
      if (productFilters.stock_status === 'out_of_stock' && prod.stock > 0) return false;
      return true;
    });
  }, [productFilters]);

  // Product columns
  const productColumns: Column<Product>[] = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '100px',
      render: (value) => {
        const labels = { goodie: 'Goodie', terroir: 'Terroir', pastry: 'Pâtisserie' };
        return <span className="capitalize">{labels[value as keyof typeof labels]}</span>;
      },
    },
    {
      key: 'name',
      label: 'Produit',
      sortable: true,
    },
    {
      key: 'price',
      label: 'Prix',
      sortable: true,
      width: '100px',
      render: (value) => `${value} DH`,
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      width: '80px',
      render: (value) => (
        <span className={value === 0 ? 'text-red-600 font-semibold' : ''}>
          {value} {value === 0 && '(Rupture)'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      width: '120px',
      render: (value) => {
        const styles = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-yellow-100 text-yellow-800',
          discontinued: 'bg-red-100 text-red-800',
        };
        const labels = { active: 'Actif', inactive: 'Inactif', discontinued: 'Discontinué' };
        return (
          <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>
            {labels[value as keyof typeof labels]}
          </span>
        );
      },
    },
  ];

  // Order columns
  const orderColumns: Column<Order>[] = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '100px',
      render: (value) => {
        const labels = { goodie: 'Goodie', terroir: 'Terroir', pastry: 'Pâtisserie' };
        return <span className="capitalize">{labels[value as keyof typeof labels]}</span>;
      },
    },
    {
      key: 'customer_name',
      label: 'Client',
      sortable: true,
    },
    {
      key: 'products',
      label: 'Produits',
      sortable: false,
    },
    {
      key: 'amount',
      label: 'Montant',
      sortable: true,
      width: '100px',
      render: (value) => `${value} DH`,
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      width: '120px',
      render: (value) => {
        const styles = {
          pending: 'bg-yellow-100 text-yellow-800',
          confirmed: 'bg-blue-100 text-blue-800',
          shipped: 'bg-purple-100 text-purple-800',
          delivered: 'bg-green-100 text-green-800',
          cancelled: 'bg-red-100 text-red-800',
        };
        const labels = {
          pending: 'En attente',
          confirmed: 'Confirmée',
          shipped: 'Expédiée',
          delivered: 'Livrée',
          cancelled: 'Annulée',
        };
        return (
          <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>
            {labels[value as keyof typeof labels]}
          </span>
        );
      },
    },
  ];

  // Filter options
  const productFilterOptions: FilterOption[] = [
    {
      id: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'goodie', label: 'Goodies' },
        { value: 'terroir', label: 'Terroir' },
        { value: 'pastry', label: 'Pâtisserie' },
      ],
    },
    {
      id: 'status',
      label: 'Statut',
      type: 'select',
      options: [
        { value: 'active', label: 'Actif' },
        { value: 'inactive', label: 'Inactif' },
        { value: 'discontinued', label: 'Discontinué' },
      ],
    },
    {
      id: 'stock_status',
      label: 'Stock',
      type: 'select',
      options: [
        { value: 'in_stock', label: 'En stock' },
        { value: 'out_of_stock', label: 'Rupture' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-foreground">Commerce</h1>
            </div>
            {activeTab === 'products' && (
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nouveau produit
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">Gérer produits et commandes (Goodies, Terroir, Pâtisserie)</p>
        </div>
      </div>

      <div className="container py-12">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="orders">Commandes</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-8">
            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total produits</p>
                  <p className="text-2xl font-bold">{MOCK_PRODUCTS.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Actifs</p>
                  <p className="text-2xl font-bold">{MOCK_PRODUCTS.filter((p) => p.status === 'active').length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">En rupture</p>
                  <p className="text-2xl font-bold">{MOCK_PRODUCTS.filter((p) => p.stock === 0).length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Stock total</p>
                  <p className="text-2xl font-bold">{MOCK_PRODUCTS.reduce((sum, p) => sum + p.stock, 0)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <FilterPanel
              filters={productFilterOptions}
              values={productFilters}
              onFilterChange={(key, value) => setProductFilters((prev) => ({ ...prev, [key]: value }))}
              onReset={() => setProductFilters({ type: '', status: '', stock_status: '' })}
            />

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Produits ({filteredProducts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<Product>
                  data={filteredProducts}
                  columns={productColumns}
                  selectable={true}
                  onSelectionChange={setSelectedProducts}
                  emptyMessage="Aucun produit trouvé"
                />

                {/* Bulk Actions */}
                {selectedProducts.length > 0 && (
                  <div className="mt-6 p-4 bg-muted rounded-lg flex items-center justify-between">
                    <p className="text-sm font-semibold">{selectedProducts.length} produit(s) sélectionné(s)</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <ToggleLeft className="w-4 h-4" />
                        Activer/Désactiver
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Package className="w-4 h-4" />
                        Gérer stock
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-8">
            {/* Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total commandes</p>
                  <p className="text-2xl font-bold">{MOCK_ORDERS.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold">{MOCK_ORDERS.filter((o) => o.status === 'pending').length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Montant total</p>
                  <p className="text-2xl font-bold">{MOCK_ORDERS.reduce((sum, o) => sum + o.amount, 0)} DH</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Livrées</p>
                  <p className="text-2xl font-bold">{MOCK_ORDERS.filter((o) => o.status === 'delivered').length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Commandes ({MOCK_ORDERS.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<Order>
                  data={MOCK_ORDERS}
                  columns={orderColumns}
                  emptyMessage="Aucune commande trouvée"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
