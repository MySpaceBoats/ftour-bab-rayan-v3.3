import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAdminPage } from './_shell/AdminFrame';
import { getStoredSession } from '@/_core/authToken';
import AdminBadge from '@/components/admin/AdminBadge';
import {
  Loader2,
  Download,
  Check,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

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

const PIPELINE: CardStatus[] = [
  'INSCRIT',
  'MAIL_COMMANDE_ENVOYE',
  'CARTE_DEMANDEE',
  'MAIL_PAIEMENT_ENVOYE',
  'PAIEMENT_RECU',
  'A_IMPRIMER',
  'IMPRIMEE',
  'LIVREE',
];

const STATUS_LABEL: Record<CardStatus, string> = {
  INSCRIT: 'Inscrit',
  MAIL_COMMANDE_ENVOYE: 'Mail envoyé',
  CARTE_DEMANDEE: 'Carte demandée',
  MAIL_PAIEMENT_ENVOYE: 'Mail paiement',
  PAIEMENT_RECU: 'Paiement reçu',
  A_IMPRIMER: 'À imprimer',
  IMPRIMEE: 'Imprimée',
  LIVREE: 'Livrée',
};

type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'sand' | 'olive' | 'ghost';

const STATUS_TONE: Record<CardStatus, BadgeTone> = {
  INSCRIT: 'neutral',
  MAIL_COMMANDE_ENVOYE: 'info',
  CARTE_DEMANDEE: 'info',
  MAIL_PAIEMENT_ENVOYE: 'warn',
  PAIEMENT_RECU: 'success',
  A_IMPRIMER: 'warn',
  IMPRIMEE: 'sand',
  LIVREE: 'olive',
};

// Funnel bar segment colors per status index
const FUNNEL_COLORS: string[] = [
  'var(--olive-soft)',
  'var(--info-bg)',
  'var(--info-bg)',
  'var(--warn-bg)',
  'var(--success-bg)',
  'var(--warn-bg)',
  'var(--sand-soft)',
  'var(--olive)',
];

const FUNNEL_FG: string[] = [
  'var(--olive-deep)',
  'var(--info)',
  'var(--info)',
  'var(--warn)',
  'var(--success)',
  'var(--warn)',
  '#7B5E1E',
  '#F5F1E2',
];

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const session = getStoredSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    ...(session?.refreshToken ? { 'x-refresh-token': session.refreshToken } : {}),
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const contentType = res.headers.get('content-type') || '';
  const rawBody = await res.text();

  if (!contentType.includes('application/json')) {
    if (rawBody.trim().startsWith('<!doctype') || rawBody.trim().startsWith('<html')) {
      throw new Error('Réponse invalide du serveur (HTML retourné au lieu de JSON)');
    }
    throw new Error('Réponse invalide du serveur (format JSON attendu)');
  }

  let data: unknown;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error('Réponse JSON invalide reçue du serveur');
  }

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchAllCards(): Promise<OrderItem[]> {
  // Fetch all without status filter; we group client-side
  const data = await apiFetch<{ items?: OrderItem[]; count?: number }>('/api/admin/cards?page=1');
  return data.items ?? [];
}

async function fetchEvents(orderId: number): Promise<EventItem[]> {
  const data = await apiFetch<{ items?: EventItem[] } | EventItem[]>(
    `/api/admin/cards/${orderId}/events`,
  );
  if (Array.isArray(data)) return data;
  return (data as { items?: EventItem[] }).items ?? [];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PipelineFunnel({
  counts,
}: {
  counts: Record<CardStatus, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        height: 36,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {PIPELINE.map((status, idx) => {
        const count = counts[status] ?? 0;
        const pct = Math.max((count / total) * 100, count > 0 ? 2 : 0);
        return (
          <div
            key={status}
            title={`${STATUS_LABEL[status]}: ${count}`}
            style={{
              flex: `${pct} 0 0`,
              minWidth: count > 0 ? 32 : 4,
              background: FUNNEL_COLORS[idx],
              color: FUNNEL_FG[idx],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              transition: 'flex 0.3s',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            {count > 0 ? count : ''}
          </div>
        );
      })}
    </div>
  );
}

function EventTimeline({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { data: events = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ['card-events', orderId],
    queryFn: () => fetchEvents(orderId),
    staleTime: 30_000,
  });

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: 16,
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
          Timeline #{orderId}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-mute)',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ink-mute)' }} />
        </div>
      ) : events.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--ink-mute)', margin: 0 }}>
          Aucun événement enregistré.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map((ev) => {
            const date = new Date(ev.created_at).toLocaleString('fr-MA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <li
                key={ev.id}
                style={{
                  borderLeft: '2px solid var(--olive)',
                  paddingLeft: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--olive-deep)',
                  }}
                >
                  {ev.event_type}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--ink-mute)' }}>{date}</p>
                {Object.keys(ev.payload).length > 0 && (
                  <pre
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      background: 'var(--surface-alt)',
                      padding: '4px 6px',
                      borderRadius: 4,
                      overflow: 'auto',
                      color: 'var(--ink-soft)',
                    }}
                  >
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KCard — single card in a kanban column
// ---------------------------------------------------------------------------

function KCard({
  item,
  onAction,
  actionLoading,
}: {
  item: OrderItem;
  onAction: (path: string, payload: Record<string, unknown>, label: string) => Promise<void>;
  actionLoading: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const isLoading = actionLoading === item.id || actionLoading === item.members?.id;

  const memberName = `${item.members?.first_name ?? ''} ${item.members?.last_name ?? ''}`.trim() || '—';
  const memberEmail = item.members?.email ?? '—';

  const downloadProof = async () => {
    try {
      const data = await apiFetch<{ url?: string; error?: string }>(
        `/api/admin/card/proof-url?order_id=${item.id}`,
      );
      if (!data.url) throw new Error(data.error ?? 'URL indisponible');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      toast.error(`Preuve : ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line-soft)',
        borderRadius: 6,
        padding: '10px 10px 8px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {memberName}
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 11,
              color: 'var(--ink-mute)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {memberEmail}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-soft)' }}>
            #{item.id}
          </p>
        </div>
        <span style={{ flexShrink: 0, color: 'var(--ink-mute)', marginTop: 2 }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line-soft)', paddingTop: 8 }}>
          {/* Address & phone */}
          {item.members?.address && (
            <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--ink-soft)' }}>
              {item.members.address}
            </p>
          )}
          {item.members?.phone && (
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--ink-soft)' }}>
              {item.members.phone}
            </p>
          )}

          {/* Paiement info */}
          {item.payment_method && (
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--ink-soft)' }}>
              Paiement:{' '}
              {item.payment_method === 'bank_transfer' ? 'Virement' : 'Sur place'}
            </p>
          )}

          {/* Action buttons based on status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
            {item.status === 'INSCRIT' && (
              <SmallBtn
                loading={isLoading}
                onClick={() =>
                  onAction(
                    '/api/admin/card/send-order-email',
                    { member_id: item.members.id },
                    'Mail commande envoyé',
                  )
                }
              >
                Envoyer mail cmd
              </SmallBtn>
            )}

            {item.status === 'CARTE_DEMANDEE' && (
              <SmallBtn
                loading={isLoading}
                onClick={() =>
                  onAction(
                    '/api/admin/card/resend-payment-email',
                    { order_id: item.id },
                    'Mail paiement envoyé',
                  )
                }
              >
                Envoyer mail paiement
              </SmallBtn>
            )}

            {item.status === 'MAIL_PAIEMENT_ENVOYE' && (
              <SmallBtn
                loading={isLoading}
                onClick={() =>
                  onAction(
                    '/api/admin/card/mark-paid',
                    { order_id: item.id },
                    'Paiement enregistré',
                  )
                }
              >
                Marquer payé
              </SmallBtn>
            )}

            {item.status === 'A_IMPRIMER' && (
              <SmallBtn
                loading={isLoading}
                onClick={() =>
                  onAction(
                    '/api/admin/card/mark-printed',
                    { order_id: item.id },
                    'Carte marquée imprimée',
                  )
                }
              >
                Marquer imprimée
              </SmallBtn>
            )}

            {item.status === 'IMPRIMEE' && (
              <SmallBtn
                loading={isLoading}
                onClick={() =>
                  onAction(
                    '/api/admin/card/mark-delivered',
                    { order_id: item.id },
                    'Carte marquée livrée',
                  )
                }
              >
                Marquer livrée
              </SmallBtn>
            )}

            {item.status === 'LIVREE' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--success)',
                  fontWeight: 500,
                }}
              >
                <Check size={12} />
                Livrée
              </div>
            )}

            {/* Download proof (available whenever there's a proof path) */}
            {item.payment_proof_path && (
              <SmallBtn
                loading={false}
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadProof();
                }}
              >
                <Download size={11} style={{ marginRight: 4 }} />
                Justificatif
              </SmallBtn>
            )}

            {/* Timeline toggle */}
            <SmallBtn
              loading={false}
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setShowTimeline((v) => !v);
              }}
            >
              {showTimeline ? 'Masquer timeline' : 'Voir timeline'}
            </SmallBtn>
          </div>

          {showTimeline && (
            <EventTimeline orderId={item.id} onClose={() => setShowTimeline(false)} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SmallBtn — tiny action button
// ---------------------------------------------------------------------------

function SmallBtn({
  children,
  onClick,
  loading,
  variant = 'primary',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  loading: boolean;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const isPrimary = variant === 'primary';
  return (
    <button
      disabled={loading || disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 4,
        border: isPrimary ? '1px solid var(--line)' : 'none',
        background: isPrimary ? 'var(--surface-alt)' : 'transparent',
        color: isPrimary ? 'var(--ink)' : 'var(--ink-soft)',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
        transition: 'background 0.12s',
      }}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// KanbanColumn
// ---------------------------------------------------------------------------

function KanbanColumn({
  status,
  items,
  onAction,
  actionLoading,
}: {
  status: CardStatus;
  items: OrderItem[];
  onAction: (path: string, payload: Record<string, unknown>, label: string) => Promise<void>;
  actionLoading: number | null;
}) {
  const tone = STATUS_TONE[status];
  return (
    <div
      style={{
        width: 188,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 4px 10px',
          gap: 6,
        }}
      >
        <AdminBadge tone={tone} dot>
          {STATUS_LABEL[status]}
        </AdminBadge>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--ink-mute)',
            background: 'var(--surface-alt)',
            borderRadius: 12,
            padding: '1px 7px',
          }}
        >
          {items.length}
        </span>
      </div>

      {/* Cards list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          paddingBottom: 8,
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 8px',
              color: 'var(--ink-mute)',
              fontSize: 11,
              borderRadius: 6,
              border: '1px dashed var(--line-soft)',
            }}
          >
            —
          </div>
        ) : (
          items.map((item) => (
            <KCard
              key={item.id}
              item={item}
              onAction={onAction}
              actionLoading={actionLoading}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminMemberCards() {
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const { data: allItems = [], isLoading, isFetching, refetch } = useQuery<OrderItem[]>({
    queryKey: ['admin-cards'],
    queryFn: fetchAllCards,
    staleTime: 60_000,
  });

  // Group by status, filtered by search
  const { grouped, counts } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allItems.filter((item) => {
          const name =
            `${item.members?.first_name ?? ''} ${item.members?.last_name ?? ''}`.toLowerCase();
          const email = (item.members?.email ?? '').toLowerCase();
          const phone = (item.members?.phone ?? '').toLowerCase();
          return name.includes(q) || email.includes(q) || phone.includes(q);
        })
      : allItems;

    const grouped: Record<CardStatus, OrderItem[]> = {
      INSCRIT: [],
      MAIL_COMMANDE_ENVOYE: [],
      CARTE_DEMANDEE: [],
      MAIL_PAIEMENT_ENVOYE: [],
      PAIEMENT_RECU: [],
      A_IMPRIMER: [],
      IMPRIMEE: [],
      LIVREE: [],
    };

    for (const item of filtered) {
      if (grouped[item.status]) {
        grouped[item.status].push(item);
      }
    }

    const counts: Record<CardStatus, number> = {} as Record<CardStatus, number>;
    for (const s of PIPELINE) {
      counts[s] = grouped[s].length;
    }

    return { grouped, counts };
  }, [allItems, search]);

  const totalFiltered = Object.values(counts).reduce((a, b) => a + b, 0);

  // ---- Actions ----

  const postAction = async (
    path: string,
    payload: Record<string, unknown>,
    label: string,
  ) => {
    const loadingId = (payload.order_id ?? payload.member_id) as number;
    setActionLoading(loadingId);
    try {
      await apiFetch<{ error?: string }>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(`${label} — succès`);
      await queryClient.invalidateQueries({ queryKey: ['admin-cards'] });
    } catch (err: unknown) {
      toast.error(`${label} — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- useAdminPage ----

  useAdminPage({
    title: 'Cartes membres',
    crumb: ['Solidarité & Équipe', 'Cartes membres'],
    actions: (
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 6,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          cursor: isFetching ? 'not-allowed' : 'pointer',
          opacity: isFetching ? 0.7 : 1,
        }}
      >
        <RefreshCw
          size={14}
          style={{
            animation: isFetching ? 'spin 1s linear infinite' : 'none',
          }}
        />
        Actualiser
      </button>
    ),
  });

  // ---- Render ----

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 7,
            padding: '6px 12px',
            width: '100%',
            maxWidth: 380,
          }}
        >
          <Search size={14} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche nom, email, téléphone…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: 'var(--ink)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-mute)',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {search && (
          <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--ink-mute)' }}>
            {totalFiltered} résultat{totalFiltered !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Pipeline funnel */}
      <PipelineFunnel counts={counts} />

      {/* Loading state */}
      {isLoading ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-mute)',
            gap: 10,
            fontSize: 14,
          }}
        >
          <Loader2 size={20} className="animate-spin" />
          Chargement…
        </div>
      ) : (
        /* Kanban board */
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              height: '100%',
              minWidth: 'max-content',
              paddingBottom: 8,
            }}
          >
            {PIPELINE.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                items={grouped[status]}
                onAction={postAction}
                actionLoading={actionLoading}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
