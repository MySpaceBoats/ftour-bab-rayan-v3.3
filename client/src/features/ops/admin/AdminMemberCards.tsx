import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/app/layout/DashboardLayout';
import { getStoredSession } from '@/_core/authToken';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Member = {
  id: number;
  first_name: string;
  last_name: string;
  address: string | null;
  phone: string | null;
  email: string;
};

type OrderItem = {
  id: number;
  status: CardStatus;
  payment_method: 'on_site' | 'bank_transfer' | null;
  payment_proof_path: string | null;
  amount: number;
  currency: string;
  updated_at: string;
  members: Member;
};

type EventItem = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type CardStatus =
  | 'INSCRIT'
  | 'MAIL_COMMANDE_ENVOYE'
  | 'CARTE_DEMANDEE'
  | 'MAIL_PAIEMENT_ENVOYE'
  | 'PAIEMENT_RECU'
  | 'A_IMPRIMER'
  | 'IMPRIMEE'
  | 'LIVREE';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Tous les statuts' },
  { value: 'INSCRIT', label: 'Inscrit' },
  { value: 'MAIL_COMMANDE_ENVOYE', label: 'Mail commande envoyé' },
  { value: 'CARTE_DEMANDEE', label: 'Carte demandée' },
  { value: 'MAIL_PAIEMENT_ENVOYE', label: 'Mail paiement envoyé' },
  { value: 'PAIEMENT_RECU', label: 'Paiement reçu' },
  { value: 'A_IMPRIMER', label: 'À imprimer' },
  { value: 'IMPRIMEE', label: 'Imprimée' },
  { value: 'LIVREE', label: 'Livrée' },
];

const STATUS_BADGE: Record<CardStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  INSCRIT:               { label: 'Inscrit',               variant: 'outline' },
  MAIL_COMMANDE_ENVOYE:  { label: 'Mail commande envoyé',  variant: 'secondary' },
  CARTE_DEMANDEE:        { label: 'Carte demandée',         variant: 'secondary' },
  MAIL_PAIEMENT_ENVOYE:  { label: 'Mail paiement envoyé',  variant: 'secondary' },
  PAIEMENT_RECU:         { label: 'Paiement reçu',         variant: 'default' },
  A_IMPRIMER:            { label: 'À imprimer',            variant: 'default' },
  IMPRIMEE:              { label: 'Imprimée',              variant: 'default' },
  LIVREE:                { label: 'Livrée',                variant: 'default' },
};

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

function apiFetch(path: string, init?: RequestInit) {
  const token = getStoredSession()?.accessToken;
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(init?.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(path, { ...init, headers });
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const rawBody = await res.text();

  if (!contentType.includes('application/json')) {
    if (rawBody.trim().startsWith('<!doctype') || rawBody.trim().startsWith('<html')) {
      throw new Error('Réponse invalide du serveur (HTML retourné au lieu de JSON)');
    }
    throw new Error('Réponse invalide du serveur (format JSON attendu)');
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error('Réponse JSON invalide reçue du serveur');
  }
}

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: CardStatus }) {
  const { label, variant } = STATUS_BADGE[status] ?? { label: status, variant: 'outline' as const };
  const colorClass: Record<CardStatus, string> = {
    INSCRIT:               'border-gray-300 text-gray-600',
    MAIL_COMMANDE_ENVOYE:  'border-blue-300 text-blue-700 bg-blue-50',
    CARTE_DEMANDEE:        'border-indigo-300 text-indigo-700 bg-indigo-50',
    MAIL_PAIEMENT_ENVOYE:  'border-violet-300 text-violet-700 bg-violet-50',
    PAIEMENT_RECU:         'border-amber-300 text-amber-700 bg-amber-50',
    A_IMPRIMER:            'border-orange-300 text-orange-700 bg-orange-50',
    IMPRIMEE:              'border-teal-300 text-teal-700 bg-teal-50',
    LIVREE:                'border-green-300 text-green-700 bg-green-50',
  };
  return (
    <Badge variant="outline" className={`whitespace-nowrap text-xs ${colorClass[status] ?? ''}`}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Timeline event row
// ---------------------------------------------------------------------------

function EventRow({ ev }: { ev: EventItem }) {
  const date = new Date(ev.created_at).toLocaleString('fr-MA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return (
    <li className="flex gap-3 items-start border-l-2 border-green-200 pl-3 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-green-800">{ev.event_type}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
        {Object.keys(ev.payload).length > 0 && (
          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(ev.payload, null, 2)}</pre>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminMemberCards() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const selectedOrder = useMemo(
    () => items.find((item) => item.id === selectedOrderId) ?? null,
    [items, selectedOrderId],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ---- Data loading ----

  const load = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'ALL') params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(pageOverride ?? page));
      const res = await apiFetch(`/api/admin/cards?${params.toString()}`);
      const data = await parseApiResponse<{ items?: OrderItem[]; count?: number }>(res);
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      setItems(data.items ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err: any) {
      toast.error(`Erreur lors du chargement : ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  const loadEvents = useCallback(async (orderId: number) => {
    setEventsLoading(true);
    try {
      const res = await apiFetch(`/api/admin/cards/${orderId}/events`);
      const data = await parseApiResponse<{ items?: EventItem[] }>(res);
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      setEvents(data.items ?? []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [status, page]);

  useEffect(() => {
    if (selectedOrderId) loadEvents(selectedOrderId);
  }, [selectedOrderId, loadEvents]);

  // ---- Search + filter ----

  const handleSearch = () => {
    setPage(1);
    load(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  // ---- Pagination ----

  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages));
    setPage(clamped);
  };

  // ---- Actions ----

  const postAction = async (path: string, payload: Record<string, unknown>, label: string) => {
    const orderId = (payload.order_id ?? payload.member_id) as number;
    setActionLoading(orderId);
    try {
      const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(payload) });
      const data = await parseApiResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(`${label} — succès`);
      await load();
      if (selectedOrderId) await loadEvents(selectedOrderId);
    } catch (err: any) {
      toast.error(`${label} — ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const downloadProof = async (orderId: number) => {
    try {
      const res = await apiFetch(`/api/admin/card/proof-url?order_id=${orderId}`);
      const data = await parseApiResponse<{ error?: string; url?: string }>(res);
      if (!res.ok || !data.url) throw new Error(data.error ?? 'URL indisponible');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(`Preuve : ${err.message}`);
    }
  };

  // ---- Render ----

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cartes membres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Recherche nom, email, téléphone…"
                className="flex-1 min-w-48"
              />
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Rechercher
              </Button>
              <Button variant="outline" size="icon" onClick={() => load()} disabled={loading} title="Actualiser">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Aucune carte membre trouvée.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium">Prénom</th>
                      <th className="text-left px-4 py-3 font-medium">Nom</th>
                      <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Adresse</th>
                      <th className="text-left px-4 py-3 font-medium">Téléphone</th>
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-left px-4 py-3 font-medium">Statut</th>
                      <th className="text-left px-4 py-3 font-medium">Preuve</th>
                      <th className="text-left px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isLoading = actionLoading === item.id || actionLoading === item.members?.id;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b hover:bg-muted/20 transition-colors ${selectedOrderId === item.id ? 'bg-green-50' : ''}`}
                        >
                          <td className="px-4 py-3">{item.members?.first_name ?? '—'}</td>
                          <td className="px-4 py-3 font-medium">{item.members?.last_name ?? '—'}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{item.members?.address ?? '—'}</td>
                          <td className="px-4 py-3">{item.members?.phone ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.members?.email}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-4 py-3">
                            {item.payment_proof_path ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => downloadProof(item.id)}
                              >
                                <Download className="h-3 w-3" />
                                Voir
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <ActionButton
                                label="Mail commande"
                                disabled={isLoading}
                                onClick={() =>
                                  postAction(
                                    '/api/admin/card/send-order-email',
                                    { member_id: item.members.id },
                                    'Mail commande',
                                  )
                                }
                              />
                              <ActionButton
                                label="Mail paiement"
                                disabled={isLoading}
                                onClick={() =>
                                  postAction(
                                    '/api/admin/card/resend-payment-email',
                                    { order_id: item.id },
                                    'Mail paiement renvoyé',
                                  )
                                }
                              />
                              <ActionButton
                                label="Marquer payé"
                                disabled={isLoading}
                                onClick={() =>
                                  postAction(
                                    '/api/admin/card/mark-paid',
                                    { order_id: item.id },
                                    'Paiement enregistré',
                                  )
                                }
                              />
                              <ActionButton
                                label="Imprimée"
                                disabled={isLoading}
                                onClick={() =>
                                  postAction(
                                    '/api/admin/card/mark-printed',
                                    { order_id: item.id },
                                    'Carte marquée imprimée',
                                  )
                                }
                              />
                              <ActionButton
                                label="Livrée"
                                disabled={isLoading}
                                onClick={() =>
                                  postAction(
                                    '/api/admin/card/mark-delivered',
                                    { order_id: item.id },
                                    'Carte marquée livrée',
                                  )
                                }
                              />
                              <Button
                                size="sm"
                                variant={selectedOrderId === item.id ? 'default' : 'outline'}
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  setSelectedOrderId(selectedOrderId === item.id ? null : item.id)
                                }
                              >
                                Timeline
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>
                  {totalCount} résultat{totalCount > 1 ? 's' : ''} — page {page} / {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1 || loading}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages || loading}
                    onClick={() => goToPage(page + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline panel */}
        {selectedOrder && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Timeline — commande #{selectedOrder.id}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedOrder.members.first_name} {selectedOrder.members.last_name}
                  {' · '}
                  <StatusBadge status={selectedOrder.status} />
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedOrderId(null)}>✕</Button>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
              ) : (
                <ul className="space-y-3">
                  {events.map((ev) => <EventRow key={ev.id} ev={ev} />)}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}

// Small reusable action button
function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      disabled={disabled}
      onClick={onClick}
    >
      {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
    </Button>
  );
}
