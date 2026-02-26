import { useState } from 'react';
import RequireRole from '@/components/RequireRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type OrderData = {
  id: string;
  reference: string;
  status: string;
  customer_first_name: string;
  customer_last_name: string;
  total_mad: number;
  cash_order_items: Array<{ name_snapshot: string; qty: number; unit_price_mad: number; type_snapshot: string }>;
};

export default function AdminCashOrders() {
  const [reference, setReference] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);

  const authHeaders = (): HeadersInit => {
    const raw = localStorage.getItem('supabase_session');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as { accessToken?: string };
      return parsed.accessToken ? { Authorization: `Bearer ${parsed.accessToken}` } : {};
    } catch {
      return {};
    }
  };

  const search = async () => {
    const res = await fetch(`/api/orders/${reference}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Introuvable');
    setOrder(data);
  };

  const fulfill = async () => {
    if (!order) return;
    const res = await fetch(`/api/orders/${order.reference}/fulfill`, { method: 'POST', headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Erreur');
    setOrder({ ...order, status: 'FULFILLED' });
  };

  return (
    <RequireRole allowedRoles={['admin', 'super_admin', 'admin_ops', 'scanner', 'admin_boutique']}>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Admin commandes espèces</h1>
        <div className="flex gap-2">
          <Input placeholder="BR-YYYYMMDD-XXXXXX" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} />
          <Button onClick={search}>Rechercher</Button>
        </div>

        {order && (
          <div className="border rounded p-4 space-y-2">
            <p><strong>{order.reference}</strong> — {order.status}</p>
            <p>{order.customer_first_name} {order.customer_last_name}</p>
            <p>Total: {order.total_mad} MAD</p>
            <ul className="list-disc pl-5">
              {order.cash_order_items?.map((i, idx) => <li key={idx}>{i.name_snapshot} x{i.qty}</li>)}
            </ul>
            <Button disabled={order.status === 'FULFILLED'} onClick={fulfill}>Marquer remis</Button>
          </div>
        )}
      </div>
    </RequireRole>
  );
}
