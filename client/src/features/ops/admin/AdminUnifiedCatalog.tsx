import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import RequireRole from '@/components/RequireRole';
import { useAdminPage } from './_shell/AdminFrame';
import AdminBadge from '@/components/admin/AdminBadge';
import {
  Search, Plus, X,
  MoreHorizontal, Check, ChevronLeft, ChevronRight,
  Image as ImageIcon,
} from 'lucide-react';

type ProductType = 'all' | 'goodies' | 'pastry' | 'terroir';

type UnifiedRow = {
  id: string;
  rawId: number;
  type: Exclude<ProductType, 'all'>;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  sortOrder: number;
  price: number | null;
  stock: number;
  isActive: boolean;
};

const BASE_FORM = {
  name: '', description: '', category: '', imageUrl: '', price: 0,
  stock: 0, sortOrder: 0, isActive: true, variantLabel: '', variantSku: '',
};

const TYPE_LABEL: Record<string, string> = { goodies: 'Goodies', pastry: 'Pâtisserie', terroir: 'Terroir' };
const TYPE_TONE: Record<string, 'info' | 'warn' | 'success'> = { goodies: 'info', pastry: 'warn', terroir: 'success' };

function statusTone(stock: number, isActive: boolean): { tone: 'success' | 'warn' | 'danger' | 'neutral'; label: string } {
  if (!isActive) return { tone: 'neutral', label: 'Inactif' };
  if (stock === 0) return { tone: 'danger', label: 'Épuisé' };
  if (stock < 10) return { tone: 'warn', label: 'Stock bas' };
  return { tone: 'success', label: 'En stock' };
}

function StockBar({ stock, sold }: { stock: number; sold: number }) {
  const total = stock + sold;
  const pct = total ? Math.min((stock / total) * 100, 100) : 0;
  const color = stock === 0 ? 'var(--danger)' : stock < 10 ? 'var(--warn)' : 'var(--success)';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
        color: stock === 0 ? 'var(--danger)' : stock < 10 ? 'var(--warn)' : 'var(--ink)',
        fontSize: 12.5,
      }}>{stock}</span>
      <div style={{ width: 36, height: 3, background: 'var(--line-soft)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(pct, 4)}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

// Slide-over Drawer for editing
function ProductDrawer({
  row, onClose, onSave,
}: {
  row: UnifiedRow; onClose: () => void;
  onSave: (data: typeof BASE_FORM) => void;
}) {
  const [form, setForm] = useState({
    ...BASE_FORM,
    name: row.name,
    description: row.description,
    category: row.category,
    imageUrl: row.imageUrl,
    price: row.price ?? 0,
    stock: row.stock,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  });

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 380, background: 'var(--surface)',
      borderLeft: '1px solid var(--line)',
      boxShadow: '-12px 0 32px -16px rgba(38,36,26,0.18)',
      display: 'flex', flexDirection: 'column', zIndex: 10,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        {row.imageUrl ? (
          <img src={row.imageUrl} alt={row.name} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: 6, flexShrink: 0,
            background: `repeating-linear-gradient(135deg, var(--olive-soft) 0 6px, var(--sand-soft) 6px 12px)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ImageIcon size={16} style={{ color: 'var(--ink-mute)' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AdminBadge tone={TYPE_TONE[row.type]} dot>{TYPE_LABEL[row.type]}</AdminBadge>
            <AdminBadge tone={row.isActive ? 'success' : 'neutral'} dot>{row.isActive ? 'Actif' : 'Inactif'}</AdminBadge>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
            {row.type.toUpperCase()}-{String(row.rawId).padStart(3, '0')}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 2 }}>
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Identité */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>
            Identité
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom du produit"
              style={{ height: 32, padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 5, outline: 'none', width: '100%', boxSizing: 'border-box' }}
            />
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description"
              style={{ padding: '8px 10px', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 5, resize: 'none', minHeight: 60, outline: 'none', lineHeight: 1.5, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Prix & stock */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>
            Prix & stock
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Prix (DH)', field: 'price' as const, type: 'number' },
              { label: 'Stock', field: 'stock' as const, type: 'number' },
              { label: 'Catégorie', field: 'category' as const, type: 'text' },
              { label: 'Ordre', field: 'sortOrder' as const, type: 'number' },
            ].map(f => (
              <div key={f.field}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginBottom: 4 }}>{f.label}</div>
                <input
                  type={f.type}
                  value={form[f.field] as string | number}
                  onChange={e => setForm(prev => ({ ...prev, [f.field]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  style={{ height: 32, padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 5, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Statut */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>
            Statut
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
            />
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>Produit actif</span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
      }}>
        <button
          onClick={onClose}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 26, padding: '0 8px',
            background: 'var(--surface)', color: 'var(--danger)',
            border: '1px solid var(--line)', borderRadius: 5,
            fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Annuler
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { onSave(form); onClose(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 26, padding: '0 12px',
              background: 'var(--olive)', color: '#F5F1E2',
              border: 'none', borderRadius: 5,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// Create product dialog/form (simple modal)
function CreateProductModal({
  createType, onClose, onCreate,
}: {
  createType: Exclude<ProductType, 'all'>;
  onClose: () => void;
  onCreate: (data: typeof BASE_FORM) => void;
}) {
  const [form, setForm] = useState({ ...BASE_FORM });

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(38,36,26,0.32)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        width: 480, background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 8,
        boxShadow: '0 24px 64px -16px rgba(38,36,26,0.25)',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            Ajouter · {TYPE_LABEL[createType]}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Nom *', field: 'name' as const, type: 'text', required: true },
            { label: 'Catégorie', field: 'category' as const, type: 'text' },
            { label: 'Prix (DH)', field: 'price' as const, type: 'number' },
            { label: 'Stock initial', field: 'stock' as const, type: 'number' },
            { label: 'Description', field: 'description' as const, type: 'text' },
            { label: 'URL image', field: 'imageUrl' as const, type: 'text' },
          ].map(f => (
            <div key={f.field}>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 4 }}>{f.label}</div>
              <input
                type={f.type}
                value={form[f.field] as string | number}
                onChange={e => setForm(prev => ({ ...prev, [f.field]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                style={{ height: 32, padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 5, outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
            <span style={{ fontSize: 13 }}>Actif dès création</span>
          </label>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ height: 32, padding: '0 12px', background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 5, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Annuler
          </button>
          <button
            onClick={() => { if (!form.name) return; onCreate(form); onClose(); }}
            style={{ height: 32, padding: '0 12px', background: 'var(--olive)', color: '#F5F1E2', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function AdminUnifiedCatalog() {
  const [tab, setTab] = useState<ProductType>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<UnifiedRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<Exclude<ProductType, 'all'>>('goodies');
  const [page, setPage] = useState(1);

  // tRPC
  const { data: rawGoodies, refetch: refetchGoodies } = trpc.goodies.listAll.useQuery();
  const { data: rawPastries, refetch: refetchPastries } = trpc.pastries.list.useQuery();
  const { data: rawTerroir, refetch: refetchTerroir } = trpc.terroirModule.adminListProducts.useQuery();
  const utils = trpc.useUtils();

  const invalidateAll = () => {
    refetchGoodies();
    refetchPastries();
    refetchTerroir();
    utils.qr.catalogQRCodes.invalidate();
  };

  // Mutations
  const createGoodie = trpc.goodies.create.useMutation({ onSuccess: () => { toast.success('Produit Goodies créé'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });
  const updateGoodie = trpc.goodies.update.useMutation({ onSuccess: () => { toast.success('Goodies mis à jour'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });
  const deleteGoodie = trpc.goodies.delete.useMutation({ onSuccess: () => { toast.success('Produit supprimé'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });
  const createPastry = trpc.pastries.create.useMutation({ onSuccess: () => { toast.success('Pâtisserie créée'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });
  const updatePastry = trpc.pastries.update.useMutation({ onSuccess: () => { toast.success('Pâtisserie mise à jour'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });
  const deletePastry = trpc.pastries.delete.useMutation({ onSuccess: () => { toast.success('Pâtisserie supprimée'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });
  const createTerroir = trpc.terroirModule.adminCreateProduct.useMutation({ onSuccess: () => { toast.success('Produit Terroir créé'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });
  const updateTerroir = trpc.terroirModule.adminUpdateProduct.useMutation({ onSuccess: () => { toast.success('Terroir mis à jour'); invalidateAll(); }, onError: (e: any) => toast.error(e.message) });

  // Normalize data
  const rows: UnifiedRow[] = useMemo(() => {
    const goodies: UnifiedRow[] = (rawGoodies ?? []).map((g: any) => ({
      id: `goodies-${g.id}`, rawId: g.id, type: 'goodies' as const,
      name: g.name, description: g.description ?? '', category: g.category ?? '',
      imageUrl: g.image_url ?? '', sortOrder: g.sort_order ?? 0,
      price: g.price ?? 0, stock: g.stock ?? 0, isActive: g.is_active ?? true,
    }));
    const pastries: UnifiedRow[] = (rawPastries ?? []).map((p: any) => ({
      id: `pastry-${p.id}`, rawId: p.id, type: 'pastry' as const,
      name: p.name, description: p.description ?? '', category: p.category ?? '',
      imageUrl: p.image_url ?? '', sortOrder: p.sort_order ?? 0,
      price: p.price ?? 0, stock: p.stock ?? 0, isActive: p.active ?? true,
    }));
    const terroir: UnifiedRow[] = (rawTerroir ?? []).map((t: any) => ({
      id: `terroir-${t.id}`, rawId: t.id, type: 'terroir' as const,
      name: t.name, description: t.description ?? '', category: t.category ?? '',
      imageUrl: t.image_url ?? '', sortOrder: t.sort_order ?? 0,
      price: t.terroir_product_variants?.[0]?.price_unit != null
        ? Number(t.terroir_product_variants[0].price_unit)
        : null,
      stock: (t.terroir_product_variants ?? []).reduce(
        (s: number, v: any) => s + ((v.stock_total ?? 0) - (v.stock_reserved ?? 0)),
        0
      ),
      isActive: t.is_active ?? true,
    }));
    return [...goodies, ...pastries, ...terroir];
  }, [rawGoodies, rawPastries, rawTerroir]);

  const filtered = useMemo(() => {
    let r = rows;
    if (tab !== 'all') r = r.filter(row => row.type === tab);
    if (search) r = r.filter(row =>
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.category.toLowerCase().includes(search.toLowerCase())
    );
    return r;
  }, [rows, tab, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI stats
  const stats = useMemo(() => ({
    total: rows.length,
    stockTotal: rows.reduce((s, r) => s + r.stock, 0),
    lowStock: rows.filter(r => r.stock > 0 && r.stock < 10).length,
    outOfStock: rows.filter(r => r.stock === 0).length,
    active: rows.filter(r => r.isActive).length,
  }), [rows]);

  // Handle save (edit drawer)
  function handleSave(form: typeof BASE_FORM) {
    if (!editingRow) return;
    if (editingRow.type === 'goodies') {
      updateGoodie.mutate({
        id: editingRow.rawId,
        name: form.name,
        description: form.description,
        category: form.category,
        imageUrl: form.imageUrl,
        price: form.price,
        stock: form.stock,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });
    } else if (editingRow.type === 'pastry') {
      updatePastry.mutate({
        id: editingRow.rawId,
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        imageUrl: form.imageUrl || undefined,
        price: form.price,
        stock: form.stock,
        sortOrder: form.sortOrder,
        active: form.isActive,
      });
    } else if (editingRow.type === 'terroir') {
      updateTerroir.mutate({
        id: editingRow.rawId,
        name: form.name,
        description: form.description,
        category: form.category,
        imageUrl: form.imageUrl,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        stockTotal: form.stock,
      });
    }
  }

  // Handle create
  function handleCreate(form: typeof BASE_FORM) {
    if (createType === 'goodies') {
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
    } else if (createType === 'pastry') {
      createPastry.mutate({
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        imageUrl: form.imageUrl || undefined,
        price: form.price,
        stock: form.stock,
        sortOrder: form.sortOrder,
      });
    } else if (createType === 'terroir') {
      createTerroir.mutate({
        name: form.name,
        description: form.description,
        category: form.category,
        imageUrl: form.imageUrl,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      });
    }
  }

  // Bulk deactivate
  function handleBulkDeactivate() {
    selectedIds.forEach(id => {
      const row = rows.find(r => r.id === id);
      if (!row) return;
      if (row.type === 'goodies') {
        updateGoodie.mutate({ id: row.rawId, isActive: false });
      } else if (row.type === 'pastry') {
        updatePastry.mutate({ id: row.rawId, active: false });
      } else if (row.type === 'terroir') {
        updateTerroir.mutate({ id: row.rawId, isActive: false });
      }
    });
    setSelectedIds(new Set());
    toast.success('Produits désactivés');
  }

  // Topbar actions
  useAdminPage({
    actions: (
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => { setCreateType('goodies'); setShowCreate(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px',
            background: 'var(--olive)', color: '#F5F1E2',
            border: 'none', borderRadius: 5,
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={13} strokeWidth={1.5} />
          Ajouter un produit
        </button>
      </div>
    ),
  });

  return (
    <RequireRole allowedRoles={['admin', 'super_admin', 'admin_boutique', 'admin_patisserie', 'admin_terroir']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', minHeight: 0 }}>

        {/* Compact KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { l: 'Total', v: stats.total, t: 'références', c: undefined },
            { l: 'Stock total', v: stats.stockTotal.toLocaleString('fr'), t: 'unités', c: 'var(--info)' },
            { l: 'Actifs', v: stats.active, t: 'produits', c: 'var(--success)' },
            { l: 'Stocks bas', v: stats.lowStock, t: '< 10 unités', c: 'var(--warn)' },
            { l: 'Épuisés', v: stats.outOfStock, t: 'à réapprovisionner', c: 'var(--danger)' },
          ].map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 6, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginBottom: 4 }}>{s.l}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: s.c || 'var(--ink)', letterSpacing: -0.3 }}>{s.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>{s.t}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, padding: '8px 10px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Type tabs */}
          <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--surface-alt)', borderRadius: 5 }}>
            {(['all', 'goodies', 'pastry', 'terroir'] as const).map(t => {
              const isActive = tab === t;
              const count = t === 'all' ? rows.length : rows.filter(r => r.type === t).length;
              return (
                <button key={t} onClick={() => { setTab(t); setPage(1); }} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 4,
                  background: isActive ? 'var(--ink)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--ink-soft)',
                  border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>
                  {t !== 'all' && (
                    <span style={{
                      width: 7, height: 7, borderRadius: 99,
                      background: isActive
                        ? 'rgba(255,255,255,0.6)'
                        : (t === 'goodies' ? 'var(--info)' : t === 'pastry' ? 'var(--warn)' : 'var(--success)'),
                    }} />
                  )}
                  {t === 'all' ? 'Tous' : TYPE_LABEL[t]}
                  <span style={{
                    fontSize: 10.5, padding: '0 5px', borderRadius: 99,
                    background: isActive ? 'rgba(255,255,255,0.18)' : 'var(--line-soft)',
                    color: isActive ? '#fff' : 'var(--ink-mute)',
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--line)' }} />

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 10px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 5 }}>
            <Search size={13} strokeWidth={1.5} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher dans le catalogue…"
              style={{ width: 240, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--ink)', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', background: 'var(--olive)', color: '#F5F1E2',
            borderRadius: 6, fontSize: 12,
          }}>
            <Check size={13} strokeWidth={2} />
            <strong>{selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}</strong>
            <span style={{ opacity: 0.5 }}>·</span>
            <button onClick={handleBulkDeactivate} style={{ background: 'transparent', border: 'none', color: '#F5F1E2', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Désactiver</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setSelectedIds(new Set())} style={{ background: 'transparent', border: 'none', color: '#F5F1E2', cursor: 'pointer', padding: 2 }}>
              <X size={13} />
            </button>
          </div>
        )}

        {/* Table + Drawer */}
        <div style={{ position: 'relative', display: 'flex' }}>
          <div style={{
            flex: 1,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 6, overflow: 'hidden',
            marginRight: editingRow ? 380 : 0,
            transition: 'margin-right 200ms ease',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line-soft)', background: 'var(--surface-alt)' }}>
                  <th style={{ padding: '8px 8px 8px 14px', textAlign: 'left', width: 32 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paginated.length && paginated.length > 0}
                      onChange={e => setSelectedIds(e.target.checked ? new Set(paginated.map(r => r.id)) : new Set())}
                    />
                  </th>
                  {['Produit', 'Type', 'Catégorie', 'Prix', 'Stock', 'Statut', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '8px 12px',
                      textAlign: ['Prix', 'Stock'].includes(h) ? 'right' : 'left',
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
                      color: 'var(--ink-mute)', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(row => {
                  const isSelected = selectedIds.has(row.id);
                  const { tone, label } = statusTone(row.stock, row.isActive);
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--line-soft)',
                        background: isSelected
                          ? 'color-mix(in srgb, var(--olive) 8%, transparent)'
                          : editingRow?.id === row.id
                            ? 'var(--olive-soft)'
                            : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setEditingRow(editingRow?.id === row.id ? null : row)}
                    >
                      <td style={{ padding: '9px 8px 9px 14px' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            const next = new Set(selectedIds);
                            e.target.checked ? next.add(row.id) : next.delete(row.id);
                            setSelectedIds(next);
                          }}
                        />
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {row.imageUrl ? (
                            <img src={row.imageUrl} alt={row.name} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--olive-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ImageIcon size={12} style={{ color: 'var(--ink-mute)' }} />
                            </div>
                          )}
                          <div style={{ lineHeight: 1.3 }}>
                            <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{row.name}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: '"JetBrains Mono", monospace' }}>
                              {row.type.toUpperCase()}-{String(row.rawId).padStart(3, '0')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <AdminBadge tone={TYPE_TONE[row.type]} dot>{TYPE_LABEL[row.type]}</AdminBadge>
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--ink-soft)' }}>{row.category || '—'}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
                        {row.price !== null ? (
                          <>
                            {row.price}
                            <span style={{ color: 'var(--ink-mute)', fontSize: 10.5, marginLeft: 2 }}>DH</span>
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                        <StockBar stock={row.stock} sold={50} />
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <AdminBadge tone={tone} dot>{label}</AdminBadge>
                      </td>
                      <td style={{ padding: '9px 14px 9px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button style={{ background: 'transparent', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', padding: 4 }}>
                          <MoreHorizontal size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
                      Aucun produit trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{
              padding: '10px 16px', borderTop: '1px solid var(--line-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface-alt)', fontSize: 11.5, color: 'var(--ink-mute)',
            }}>
              <span>
                {filtered.length === 0
                  ? 'Aucun résultat'
                  : `Affiche ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} sur ${filtered.length}`}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{ height: 26, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: page <= 1 ? 'var(--ink-mute)' : 'var(--ink)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  style={{ height: 26, padding: '0 8px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: page >= totalPages ? 'var(--ink-mute)' : 'var(--ink)', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Slide-over drawer */}
          {editingRow && (
            <ProductDrawer
              row={editingRow}
              onClose={() => setEditingRow(null)}
              onSave={handleSave}
            />
          )}
        </div>

        {/* Create product modal */}
        {showCreate && (
          <CreateProductModal
            createType={createType}
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
      </div>
    </RequireRole>
  );
}
