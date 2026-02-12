'use client';

import { useSearchParams } from 'wouter';
import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingBag, Plus, Eye, Edit, Trash2, Loader2, Package } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DataTable, { Column } from '@/features/admin/components/DataTable';
import FilterPanel, { FilterOption } from '@/features/admin/components/FilterPanel';

// ============================================
// ADMIN COMMERCE — UNIFIED VIEW WITH tRPC
// ============================================

interface Product {
  id: string;
  type: 'goodies' | 'terroir' | 'patisserie';
  name: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive';
  created_at: string;
}

interface Order {
  id: string;
  type: 'goodies' | 'terroir' | 'patisserie';
  product_name: string;
  quantity: number;
  total: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  customer_email: string;
  created_at: string;
}

export default function AdminCommercePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>(
    (searchParams.tab as 'products' | 'orders') || 'products'
  );
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState({
    type: searchParams.type || '',
    status: searchParams.status || '',
    search: searchParams.search || '',
  });

  // Fetch products from tRPC
  const { data: products = [], isLoading: productsLoading } = trpc.backoffice.commerce.listProducts.useQuery(
    { type: filters.type as any },
    { enabled: !!user && activeTab === 'products' }
  );

  // Fetch orders from tRPC
  const { data: orders = [], isLoading: ordersLoading } = trpc.backoffice.commerce.listOrders.useQuery(
    { type: filters.type as any },
    { enabled: !!user && activeTab === 'orders' }
  );

  // Mutations
  const updateStockMutation = trpc.backoffice.commerce.updateStock.useMutation();
  const toggleProductMutation = trpc.backoffice.commerce.toggleProduct.useMutation();
  const deleteProductMutation = trpc.backoffice.commerce.deleteProduct.useMutation();
  const updateOrderStatusMutation = trpc.backoffice.commerce.updateOrderStatus.useMutation();

  // Filter products
  const filteredProducts = useMemo(() => {
    return (products as Product[]).filter((prod) => {
      if (filters.type && prod.type !== filters.type) return false;
      if (filters.status && prod.status !== filters.status) return false;
      if (filters.search && !prod.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [products, filters]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return (orders as Order[]).filter((ord) => {
      if (filters.type && ord.type !== filters.type) return false;
      if (filters.search && !ord.product_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [orders, filters]);

  // Handle filter change
  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams.toString());
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilters({ type: '', status: '', search: '' });
    setSearchParams('');
  };

  // Actions
  const handleToggleProduct = useCallback(async (id: string, currentStatus: string) => {
    try {
      await toggleProductMutation.mutateAsync({
        id,
        status: currentStatus === 'active' ? 'inactive' : 'active',
      });
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
    }
  }, [toggleProductMutation]);

  const handleDeleteProduct = useCallback(async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    try {
      await deleteProductMutation.mutateAsync({ id });
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  }, [deleteProductMutation]);

  const handleUpdateOrderStatus = useCallback(async (id: string, newStatus: string) => {
    try {
      await updateOrderStatusMutation.mutateAsync({ id, status: newStatus as any });
      window.location.reload();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  }, [updateOrderStatusMutation]);

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setDetailDrawerOpen(true);
  };

  // Product columns
  const productColumns: Column<Product>[] = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '100px',
      render: (value) => {
        const labels = { goodies: 'Goodies', terroir: 'Terroir', patisserie: 'Pâtisserie' };
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
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      width: '100px',
      render: (value) => {
        const styles = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
        };
        const labels = { active: 'Actif', inactive: 'Inactif' };
        return (
          <span className={`px-2 py-1 rounded text-sm ${styles[value as keyof typeof styles]}`}>
            {labels[value as keyof typeof labels]}
          </span>
        );
      },
    },
    {
      key: 'id',
      label: 'Actions',
      width: '200px',
      render: (_, row: Product) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewProduct(row)}
            title="Voir détails"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleToggleProduct(row.id, row.status)}
            disabled={toggleProductMutation.isPending}
            title={row.status === 'active' ? 'Désactiver' : 'Activer'}
          >
            {toggleProductMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Edit className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={() => handleDeleteProduct(row.id)}
            disabled={deleteProductMutation.isPending}
            title="Supprimer"
          >
            {deleteProductMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      ),
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
        const labels = { goodies: 'Goodies', terroir: 'Terroir', patisserie: 'Pâtisserie' };
        return <span className="capitalize">{labels[value as keyof typeof labels]}</span>;
      },
    },
    {
      key: 'product_name',
      label: 'Produit',
      sortable: true,
    },
    {
      key: 'quantity',
      label: 'Qté',
      sortable: true,
      width: '60px',
    },
    {
      key: 'total',
      label: 'Total',
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
          confirmed: 'bg-green-100 text-green-800',
          delivered: 'bg-blue-100 text-blue-800',
          cancelled: 'bg-red-100 text-red-800',
        };
        const labels = {
          pending: 'En attente',
          confirmed: 'Confirmée',
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
    {
      key: 'customer_email',
      label: 'Client',
      sortable: true,
    },
    {
      key: 'id',
      label: 'Actions',
      width: '150px',
      render: (_, row: Order) => (
        <div className="flex gap-2">
          {row.status === 'pending' && (
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700"
              onClick={() => handleUpdateOrderStatus(row.id, 'confirmed')}
              disabled={updateOrderStatusMutation.isPending}
            >
              {updateOrderStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirmer'
              )}
            </Button>
          )}
          {row.status === 'confirmed' && (
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 hover:text-blue-700"
              onClick={() => handleUpdateOrderStatus(row.id, 'delivered')}
              disabled={updateOrderStatusMutation.isPending}
            >
              {updateOrderStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Livrer'
              )}
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Filter options
  const filterOptions: FilterOption[] = [
    {
      id: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'goodies', label: 'Goodies' },
        { value: 'terroir', label: 'Terroir' },
        { value: 'patisserie', label: 'Pâtisserie' },
      ],
    },
    ...(activeTab === 'products'
      ? [
          {
            id: 'status',
            label: 'Statut',
            type: 'select' as const,
            options: [
              { value: 'active', label: 'Actif' },
              { value: 'inactive', label: 'Inactif' },
            ],
          },
        ]
      : []),
    {
      id: 'search',
      label: 'Recherche',
      type: 'text',
      placeholder: 'Nom du produit...',
    },
  ];

  const isLoading = activeTab === 'products' ? productsLoading : ordersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 py-8 border-b">
        <div className="container">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingBag className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Commerce</h1>
                <p className="text-sm text-gray-600">Gérer produits et commandes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container py-6 border-b">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setActiveTab('products');
              setSearchParams('tab=products');
            }}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'products'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Produits ({filteredProducts.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('orders');
              setSearchParams('tab=orders');
            }}
            className={`px-4 py-2 font-medium border-b-2 transition ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Commandes ({filteredOrders.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="container py-6">
        <FilterPanel
          options={filterOptions}
          values={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      </div>

      {/* Content */}
      <div className="container pb-12">
        {activeTab === 'products' ? (
          <Card>
            <CardHeader>
              <CardTitle>Liste des produits</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucun produit trouvé</p>
                </div>
              ) : (
                <DataTable columns={productColumns} data={filteredProducts} />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Liste des commandes</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucune commande trouvée</p>
                </div>
              ) : (
                <DataTable columns={orderColumns} data={filteredOrders} />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Drawer */}
      <Dialog open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du produit</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="text-lg font-semibold capitalize">{selectedProduct.type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Statut</label>
                  <p className="text-lg font-semibold">{selectedProduct.status === 'active' ? 'Actif' : 'Inactif'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Prix</label>
                  <p className="text-lg font-semibold">{selectedProduct.price} DH</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stock</label>
                  <p className="text-lg font-semibold">{selectedProduct.stock}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-muted-foreground">Nom du produit</label>
                <p className="text-lg font-semibold">{selectedProduct.name}</p>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => setDetailDrawerOpen(false)}>Fermer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
