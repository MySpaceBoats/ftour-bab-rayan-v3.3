import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/app/layout/DashboardLayout';
import { getStoredSession } from '@/_core/authToken';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type OrderItem = {
  id: number;
  status: string;
  payment_method: string | null;
  payment_proof_path: string | null;
  members: {
    id: number;
    first_name: string;
    last_name: string;
    address: string | null;
    phone: string | null;
    email: string;
  };
};

type EventItem = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const STATUSES = ['ALL', 'INSCRIT', 'MAIL_COMMANDE_ENVOYE', 'CARTE_DEMANDEE', 'MAIL_PAIEMENT_ENVOYE', 'PAIEMENT_RECU', 'A_IMPRIMER', 'IMPRIMEE', 'LIVREE'];

function apiFetch(path: string, init?: RequestInit) {
  const token = getStoredSession()?.accessToken;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!(init?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(path, {
    ...init,
    headers,
  });
}

export default function AdminMemberCards() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  const selectedOrder = useMemo(() => items.find((item) => item.id === selectedOrderId) || null, [items, selectedOrderId]);

  const load = async () => {
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    const res = await apiFetch(`/api/admin/cards?${params.toString()}`);
    const data = await res.json();
    setItems(data.items || []);
  };

  const loadEvents = async (orderId: number) => {
    const res = await apiFetch(`/api/admin/cards/${orderId}/events`);
    const data = await res.json();
    setEvents(data.items || []);
  };

  useEffect(() => {
    load();
  }, [status]);

  useEffect(() => {
    if (selectedOrderId) loadEvents(selectedOrderId);
  }, [selectedOrderId]);

  const post = async (path: string, payload: Record<string, unknown>) => {
    await apiFetch(path, { method: 'POST', body: JSON.stringify(payload) });
    await load();
    if (selectedOrderId) await loadEvents(selectedOrderId);
  };

  const downloadProof = async (orderId: number) => {
    const res = await apiFetch(`/api/admin/card/proof-url?order_id=${orderId}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Recherche (nom, email, téléphone)" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((st) => (<SelectItem key={st} value={st}>{st}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button onClick={load}>Rechercher</Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Liste des membres</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th>Prénom</th><th>Nom</th><th>Adresse</th><th>Téléphone</th><th>Email</th><th>Statut</th><th>Preuve</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td>{item.members?.first_name}</td>
                    <td>{item.members?.last_name}</td>
                    <td>{item.members?.address}</td>
                    <td>{item.members?.phone}</td>
                    <td>{item.members?.email}</td>
                    <td>{item.status}</td>
                    <td>{item.payment_proof_path ? <Button size="sm" variant="outline" onClick={() => downloadProof(item.id)}>Télécharger</Button> : '-'}</td>
                    <td className="space-x-2 py-2">
                      <Button size="sm" variant="outline" onClick={() => post('/api/admin/card/send-order-email', { member_id: item.members.id })}>Envoyer mail commande</Button>
                      <Button size="sm" variant="outline" onClick={() => post('/api/admin/card/resend-payment-email', { order_id: item.id })}>Renvoyer mail paiement</Button>
                      <Button size="sm" variant="outline" onClick={() => post('/api/admin/card/mark-paid', { order_id: item.id })}>Marquer payé</Button>
                      <Button size="sm" variant="outline" onClick={() => post('/api/admin/card/mark-printed', { order_id: item.id })}>Marquer imprimée</Button>
                      <Button size="sm" variant="outline" onClick={() => post('/api/admin/card/mark-delivered', { order_id: item.id })}>Marquer livrée</Button>
                      <Button size="sm" onClick={() => setSelectedOrderId(item.id)}>Timeline</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Timeline commande #{selectedOrder.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="border p-2 rounded">
                  <strong>{ev.event_type}</strong> — {new Date(ev.created_at).toLocaleString()}
                  <pre className="text-xs mt-1 bg-muted p-2 rounded">{JSON.stringify(ev.payload, null, 2)}</pre>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
