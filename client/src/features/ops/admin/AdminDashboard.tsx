import { useState, useMemo, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/_core/hooks/useAuth';
import { getStoredSession } from '@/_core/authToken';
import { useAdminPage } from './_shell/AdminFrame';
import Sparkline from '@/components/admin/Sparkline';
import {
  Moon, Calendar, Users, ShoppingBag, Heart, QrCode, CreditCard,
  AlertTriangle, CheckCircle, ChevronRight, RefreshCw, Package,
  Printer, TrendingUp, ScanLine, UserPlus, Bell,
  Clock, Utensils, ArrowUpRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type ActivityCategory = 'reservation' | 'benevole' | 'paiement' | 'don' | 'boutique' | 'scan' | 'admin';
type HealthTone = 'ok' | 'warn' | 'danger';

// ── Static data (realistic for a Ramadan solidarity event) ─────────────────

const ACTIVITY_ITEMS: Array<{
  id: number;
  category: ActivityCategory;
  text: string;
  detail: string;
  minsAgo: number;
}> = [
  { id: 1,  category: 'scan',        text: 'QR scanné',              detail: 'Khadija B. — poste Accueil', minsAgo: 2 },
  { id: 2,  category: 'reservation', text: 'Réservation confirmée',  detail: 'Groupe Berrada — 12 pers. · 19h00', minsAgo: 5 },
  { id: 3,  category: 'paiement',    text: 'Paiement reçu',          detail: 'Carte membre #0234 — 150 MAD', minsAgo: 8 },
  { id: 4,  category: 'boutique',    text: 'Commande validée',        detail: '3 Goodies — livraison sur place', minsAgo: 13 },
  { id: 5,  category: 'don',         text: 'Don reçu',               detail: 'Virement — 500 MAD · anonyme', minsAgo: 19 },
  { id: 6,  category: 'benevole',    text: 'Bénévole arrivé',        detail: 'Omar T. — Cuisine · 17h–21h', minsAgo: 24 },
  { id: 7,  category: 'admin',       text: 'Stock mis à jour',       detail: 'Pâtisserie — 48 unités ajoutées', minsAgo: 33 },
  { id: 8,  category: 'reservation', text: 'Annulation traitée',     detail: 'Famille Chaoui — remboursement initié', minsAgo: 41 },
  { id: 9,  category: 'scan',        text: 'Entrée enregistrée',     detail: '42 personnes — créneau 18h30', minsAgo: 47 },
  { id: 10, category: 'boutique',    text: 'Commande Terroir',        detail: '1 panier — Mohammed A.', minsAgo: 55 },
  { id: 11, category: 'paiement',    text: 'Paiement en attente',    detail: 'Carte membre #0198 — vérification', minsAgo: 70 },
  { id: 12, category: 'admin',       text: 'Session ouverte',        detail: 'Admin connecté — mobile', minsAgo: 92 },
];

const CAT_CONFIG: Record<ActivityCategory, { label: string; color: string; bg: string; icon: ReactNode }> = {
  reservation: { label: 'Réservation', color: 'var(--olive)',      bg: 'var(--olive-soft)',  icon: <Utensils size={11} /> },
  benevole:    { label: 'Bénévole',    color: 'var(--info)',       bg: 'var(--info-bg)',     icon: <Users size={11} /> },
  paiement:    { label: 'Paiement',    color: 'var(--warn)',       bg: 'var(--warn-bg)',     icon: <CreditCard size={11} /> },
  don:         { label: 'Don',         color: 'var(--success)',    bg: 'var(--success-bg)',  icon: <Heart size={11} /> },
  boutique:    { label: 'Boutique',    color: '#C77B3B',           bg: '#FFF3E8',            icon: <ShoppingBag size={11} /> },
  scan:        { label: 'Scanner',     color: 'var(--olive-deep)', bg: 'var(--olive-soft)',  icon: <QrCode size={11} /> },
  admin:       { label: 'Admin',       color: 'var(--ink-mute)',   bg: 'var(--surface-alt)', icon: <ScanLine size={11} /> },
};

const EVENING_SLOTS = [
  { time: '17h30', cap: 80, res: 54, walk: 6 },
  { time: '18h00', cap: 80, res: 78, walk: 8 },
  { time: '18h30', cap: 80, res: 80, walk: 12 },
  { time: '19h00', cap: 80, res: 75, walk: 15 },
  { time: '19h30', cap: 80, res: 58, walk: 8 },
  { time: '20h00', cap: 80, res: 40, walk: 4 },
  { time: '20h30', cap: 80, res: 22, walk: 0 },
  { time: '21h00', cap: 80, res: 10, walk: 0 },
];

const RAMADAN_FILL = [
  42, 48, 51, 59, 66, 70, 74, 68, 72, 78,
  83, 80, 86, 89, 92, 87, 85, 91, 94, 90,
  88, 82, 80, 78, 76, 74, 72, 70, 68, 65,
];

// ── Sub-components ─────────────────────────────────────────────────────────

// KPI tile — clickable, colored accent, sparkline
function KpiTile({
  label, value, suffix, sub, color, accent, sparkValues, onClick, urgent,
}: {
  label: string; value: string | number; suffix?: string; sub?: string;
  color?: string; accent?: string; sparkValues?: number[];
  onClick?: () => void; urgent?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${urgent ? 'var(--danger)' : 'var(--line)'}`,
        borderLeft: `3px solid ${accent || color || 'var(--olive)'}`,
        borderRadius: 6, padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 6,
        cursor: onClick ? 'pointer' : 'default', minHeight: 96,
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--ink)', lineHeight: 1, letterSpacing: -0.5 }}>
          {value}
        </div>
        {suffix && <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{suffix}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
        {sub && <div style={{ fontSize: 10.5, color: urgent ? 'var(--danger)' : 'var(--ink-mute)' }}>{sub}</div>}
        {sparkValues && sparkValues.length > 1 && (
          <Sparkline values={sparkValues} width={60} height={18} color={accent || color || 'var(--olive)'} />
        )}
      </div>
    </div>
  );
}

// Single urgency row
function UrgencyItem({
  icon, iconBg, label, value, priority, cta, onClick,
}: {
  icon: ReactNode; iconBg: string; label: string; value: string;
  priority: 'critique' | 'important' | 'a-faire'; cta: string; onClick?: () => void;
}) {
  const pc = {
    critique: { label: 'Critique', color: 'var(--danger)' },
    important: { label: 'Important', color: 'var(--warn)' },
    'a-faire': { label: 'À faire', color: 'var(--info)' },
  }[priority];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px', borderBottom: '1px solid var(--line-soft)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 6, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>{label}</span>
          <span style={{
            fontSize: 9.5, fontWeight: 600, color: pc.color,
            border: `1px solid ${pc.color}`, borderRadius: 3, padding: '1px 5px',
          }}>{pc.label}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{value}</div>
      </div>
      <button
        onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 26, padding: '0 9px',
          background: 'var(--surface-alt)', color: 'var(--ink)',
          border: '1px solid var(--line)', borderRadius: 5,
          fontSize: 11.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        {cta} <ChevronRight size={11} />
      </button>
    </div>
  );
}

// Evening flow SVG bar chart
function EveningFlowChart({ totalReservations }: { totalReservations: number }) {
  const maxY = 100;
  const chartH = 110;
  const barW = 26;
  const gap = 16;
  const nSlots = EVENING_SLOTS.length;
  const svgW = nSlots * (barW + gap) - gap + 10;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Flux de la soirée</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 2 }}>
            Réservations par créneau · {totalReservations} confirmées
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: 'var(--ink-soft)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--olive)', display: 'inline-block' }} />Réservations
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--sand)', display: 'inline-block' }} />Walk-in
          </span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${svgW} ${chartH + 28}`} style={{ overflow: 'visible' }}>
        {/* Capacity dashed line */}
        <line
          x1="0" y1={chartH - (80 / maxY) * chartH}
          x2={svgW} y2={chartH - (80 / maxY) * chartH}
          stroke="var(--line)" strokeWidth="1.5" strokeDasharray="5 4"
        />
        {EVENING_SLOTS.map((s, i) => {
          const x = i * (barW + gap);
          const total = s.res + s.walk;
          const fillPct = total / s.cap;
          const barColor = fillPct > 0.85 ? 'var(--danger)' : fillPct > 0.6 ? 'var(--warn)' : 'var(--olive)';
          const hRes = (s.res / maxY) * chartH;
          const hWalk = (s.walk / maxY) * chartH;
          const hTotal = hRes + hWalk;
          return (
            <g key={s.time}>
              {s.walk > 0 && (
                <rect x={x} y={chartH - hTotal} width={barW} height={hWalk} fill="var(--sand)" rx="2" />
              )}
              <rect x={x} y={chartH - hRes} width={barW} height={Math.max(hRes, 2)} fill={barColor} rx="2" />
              {total > 0 && (
                <text x={x + barW / 2} y={Math.max(chartH - hTotal - 5, 10)} textAnchor="middle"
                  fontSize="9" fill={fillPct > 0.85 ? 'var(--danger)' : 'var(--ink-mute)'}
                  fontWeight={fillPct > 0.85 ? '700' : '400'}>
                  {total}{fillPct > 0.85 ? '!' : ''}
                </text>
              )}
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize="9.5" fill="var(--ink-soft)">
                {s.time}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Operational health row
function HealthRow({ label, value, tone }: { label: string; value: string; tone: HealthTone }) {
  const c = { ok: 'var(--success)', warn: 'var(--warn)', danger: 'var(--danger)' }[tone];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: '1px solid var(--line-soft)',
    }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: c, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: c, display: 'inline-block' }} />
        {value}
      </span>
    </div>
  );
}

// Module card (3×3 grid)
function ModuleCard({
  icon, name, keyMetric, metricLabel, status, onClick,
}: {
  icon: ReactNode; name: string; keyMetric: string | number;
  metricLabel: string; status: 'ok' | 'warn' | 'danger' | 'idle'; onClick: () => void;
}) {
  const sc = {
    ok:     { label: 'Actif',     color: 'var(--success)', bg: 'var(--success-bg)' },
    warn:   { label: 'Attention', color: 'var(--warn)',    bg: 'var(--warn-bg)' },
    danger: { label: 'Urgent',    color: 'var(--danger)',  bg: 'var(--danger-bg)' },
    idle:   { label: 'Calme',     color: 'var(--ink-mute)', bg: 'var(--surface-alt)' },
  }[status];
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 14, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--olive-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--olive)',
        }}>{icon}</div>
        <span style={{
          fontSize: 9.5, fontWeight: 600, color: sc.color,
          background: sc.bg, borderRadius: 99, padding: '2px 7px',
        }}>{sc.label}</span>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 1 }}>
          <span style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>{keyMetric}</span> {metricLabel}
        </div>
      </div>
    </div>
  );
}

// Quick-access button
function QuickBtn({
  icon, label, onClick, primary,
}: {
  icon: ReactNode; label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
        padding: '12px 10px', flex: 1, minWidth: 0,
        background: primary ? 'var(--olive)' : 'var(--surface)',
        border: `1px solid ${primary ? 'var(--olive)' : 'var(--line)'}`,
        borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: primary ? 'rgba(255,255,255,0.18)' : 'var(--olive-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: primary ? '#F5F1E2' : 'var(--olive)',
      }}>{icon}</div>
      <span style={{
        fontSize: 10.5, fontWeight: 500, textAlign: 'center', lineHeight: 1.3,
        color: primary ? '#F5F1E2' : 'var(--ink-soft)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%',
      }}>
        {label}
      </span>
    </button>
  );
}

// Section header label
function SectionTitle({ icon, title, sub }: { icon?: ReactNode; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
      {icon && <span style={{ color: 'var(--olive)', display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{sub}</span>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  // ─── ALL hooks unconditionally before any return ────────────────────────
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activityFilter, setActivityFilter] = useState<ActivityCategory | 'all'>('all');
  const [startTime] = useState(() => new Date());

  // tRPC queries
  const { data: volunteerStats } = trpc.volunteers.stats.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: days } = trpc.days.list.useQuery();
  const { data: restaurants } = trpc.restaurants.list.useQuery({});

  // BFF REST
  const token = getStoredSession()?.accessToken;
  const { data: adminDashboard, dataUpdatedAt } = useQuery({
    queryKey: ['admin-dashboard-bff'],
    queryFn: async () => {
      const res = await fetch('/api/admin-dashboard?page=1&pageSize=50', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json?.stats) return null;
      return json as { stats: { payments: number; notifications: number; reservations: number } };
    },
    refetchInterval: 60_000,
  });

  // Topbar
  useAdminPage({
    title: "Vue d'ensemble",
    actions: (
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => navigate('/admin/scan-reservation')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px',
            background: 'var(--olive)', color: '#F5F1E2',
            border: '1px solid var(--olive)', borderRadius: 5,
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <ScanLine size={13} />
          Scanner QR
        </button>
        <button
          onClick={() => navigate('/admin/jours')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px',
            background: 'var(--surface)', color: 'var(--ink)',
            border: '1px solid var(--line)', borderRadius: 5,
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Calendar size={13} />
          Calendrier
        </button>
      </div>
    ),
  });

  // ─── Derived values ───────────────────────────────────────────────────────
  const presentVolunteers = volunteerStats?.present ?? 0;
  const totalVolunteers   = volunteerStats?.registered ?? 0;
  const totalDays         = days?.length ?? 0;
  const totalReservations = adminDashboard?.stats?.reservations ?? 0;
  const totalPayments     = adminDashboard?.stats?.payments ?? 0;
  const totalCapacity     = restaurants?.reduce((s, r) => s + (r.capacity ?? 0), 0) || 640;
  const fillRate          = totalCapacity > 0 ? Math.round((totalReservations / totalCapacity) * 100) : 0;
  const absentVolunteers  = Math.max(0, totalVolunteers - presentVolunteers);
  const absenceRate       = totalVolunteers > 0 ? Math.round((absentVolunteers / totalVolunteers) * 100) : 0;
  const presenceRate      = totalVolunteers > 0 ? Math.round((presentVolunteers / totalVolunteers) * 100) : 100;
  const firstName         = user?.name || user?.email?.split('@')[0] || 'Admin';

  const healthStatus: 'stable' | 'tension' | 'critique' =
    fillRate > 90 || absenceRate > 30 ? 'critique' :
    fillRate > 70 || absenceRate > 15 ? 'tension' : 'stable';

  const healthConfig = {
    stable:   { emoji: '🟢', label: 'Stable',              color: 'var(--success)', bg: 'var(--success-bg)' },
    tension:  { emoji: '🟡', label: 'Tension modérée',     color: 'var(--warn)',    bg: 'var(--warn-bg)' },
    critique: { emoji: '🔴', label: 'Saturation critique', color: 'var(--danger)',  bg: 'var(--danger-bg)' },
  };
  const hc = healthConfig[healthStatus];

  const chargeLabel: string = absenceRate > 30 ? 'Forte' : absenceRate > 15 ? 'Modérée' : 'Légère';
  const chargeTone: HealthTone = absenceRate > 30 ? 'danger' : absenceRate > 15 ? 'warn' : 'ok';

  const todayDate = startTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const jourRamadan = totalDays || 1;
  const readinessRate = Math.round((presenceRate * 0.5) + (fillRate < 90 ? 30 : 10) + (totalPayments < 5 ? 20 : 5));

  // Dynamic urgencies derived from real data
  const urgencies = useMemo(() => {
    const list: Array<{
      id: string; icon: ReactNode; iconBg: string; label: string; value: string;
      priority: 'critique' | 'important' | 'a-faire'; cta: string; route: string;
    }> = [];

    if (fillRate > 90) {
      list.push({
        id: 'capacity', icon: <AlertTriangle size={14} strokeWidth={1.5} style={{ color: 'var(--danger)' }} />,
        iconBg: 'var(--danger-bg)', label: 'Capacité quasi-saturée',
        value: `${fillRate}% de remplissage — risque de surcapacité détecté`,
        priority: 'critique', cta: 'Gérer', route: '/admin/reservations-calendar',
      });
    }
    if (absenceRate > 20) {
      list.push({
        id: 'volunteers', icon: <Users size={14} strokeWidth={1.5} style={{ color: absenceRate > 30 ? 'var(--danger)' : 'var(--warn)' }} />,
        iconBg: absenceRate > 30 ? 'var(--danger-bg)' : 'var(--warn-bg)',
        label: 'Déficit bénévoles',
        value: `${absentVolunteers} absents · ${absenceRate}% du total inscrit non présent`,
        priority: absenceRate > 30 ? 'critique' : 'important', cta: 'Voir', route: '/admin/benevoles',
      });
    }
    if (totalPayments > 5) {
      list.push({
        id: 'payments', icon: <CreditCard size={14} strokeWidth={1.5} style={{ color: 'var(--warn)' }} />,
        iconBg: 'var(--warn-bg)', label: 'Commandes boutique en attente',
        value: `${totalPayments} commandes à traiter — paiements non validés`,
        priority: totalPayments > 15 ? 'critique' : 'important', cta: 'Traiter', route: '/admin/payments',
      });
    }
    // pendingGroups / pendingCards: replace with real API data when available
    const pendingGroups = adminDashboard?.stats?.reservations ?? 3;
    const pendingCards = 2;
    if (pendingGroups > 0) {
      list.push({
        id: 'groups', icon: <Utensils size={14} strokeWidth={1.5} style={{ color: 'var(--info)' }} />,
        iconBg: 'var(--info-bg)', label: 'Groupes & réservations à valider',
        value: `${pendingGroups} réservations entreprises en attente de confirmation admin`,
        priority: 'a-faire', cta: 'Valider', route: '/admin/restaurant/groupes',
      });
    }
    if (pendingCards > 0) {
      list.push({
        id: 'cards', icon: <Printer size={14} strokeWidth={1.5} style={{ color: 'var(--ink-soft)' }} />,
        iconBg: 'var(--surface-alt)', label: 'Cartes membres en file impression',
        value: `${pendingCards} cartes prêtes à imprimer — paiements reçus`,
        priority: 'a-faire', cta: 'Lancer', route: '/admin/cards',
      });
    }
    return list;
  }, [fillRate, absenceRate, absentVolunteers, totalPayments]);

  const filteredActivity = activityFilter === 'all'
    ? ACTIVITY_ITEMS
    : ACTIVITY_ITEMS.filter(a => a.category === activityFilter);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1240, paddingBottom: 24 }}>

      {/* ── 1. Strategic Header ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 8, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 0, position: 'relative', overflow: 'hidden',
      }}>
        {/* Accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, var(--olive) 0%, var(--sand) 60%, transparent 100%)',
        }} />

        {/* Greeting */}
        <div style={{ flex: 1 }}>
          <h2 style={{
            margin: 0, fontSize: 19, fontWeight: 600,
            fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic',
            color: 'var(--ink)',
          }}>
            Bonsoir, {firstName}.
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Moon size={11} strokeWidth={1.5} style={{ color: 'var(--olive)', flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
              Jour {jourRamadan} Ramadan 1447 · Soirée du {todayDate}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 48, background: 'var(--line-soft)', margin: '0 24px' }} />

        {/* 3 key metrics */}
        <div style={{ display: 'flex', gap: 28 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 24, fontWeight: 700, lineHeight: 1,
              color: fillRate > 85 ? 'var(--danger)' : 'var(--olive)',
            }}>{totalReservations}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 3 }}>réservations</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 24, fontWeight: 700, lineHeight: 1,
              color: absenceRate > 20 ? 'var(--warn)' : 'var(--info)',
            }}>{presentVolunteers}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 3 }}>bénévoles actifs</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 24, fontWeight: 700, lineHeight: 1,
              color: fillRate > 85 ? 'var(--danger)' : fillRate > 70 ? 'var(--warn)' : 'var(--success)',
            }}>{fillRate}%</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 3 }}>capacité</div>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 48, background: 'var(--line-soft)', margin: '0 24px' }} />

        {/* Health status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{
            padding: '6px 14px', background: hc.bg, color: hc.color,
            borderRadius: 99, fontSize: 12, fontWeight: 600,
            border: `1px solid ${hc.color}30`,
          }}>
            {hc.emoji} {hc.label}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>État opérationnel global</div>
        </div>
      </div>

      {/* ── 2. KPI Strip (6 tiles) ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        <KpiTile
          label="Réservations"
          value={totalReservations}
          suffix={`/ ${totalCapacity}`}
          sub={`${fillRate}% remplissage`}
          color={fillRate > 85 ? 'var(--danger)' : fillRate > 70 ? 'var(--warn)' : 'var(--olive)'}
          accent={fillRate > 85 ? 'var(--danger)' : 'var(--olive)'}
          sparkValues={[180, 200, 220, 240, 250, 260, totalReservations]}
          onClick={() => navigate('/admin/reservations-calendar')}
          urgent={fillRate > 90}
        />
        <KpiTile
          label="Bénévoles"
          value={presentVolunteers}
          suffix={`/ ${totalVolunteers}`}
          sub={absenceRate > 15 ? `⚠ ${absentVolunteers} absents` : `${presenceRate}% présents`}
          color={absenceRate > 20 ? 'var(--warn)' : 'var(--info)'}
          accent={absenceRate > 20 ? 'var(--warn)' : 'var(--info)'}
          sparkValues={[45, 50, 55, 58, 62, 65, presentVolunteers]}
          onClick={() => navigate('/admin/benevoles')}
          urgent={absenceRate > 30}
        />
        <KpiTile
          label="Commandes en attente"
          value={totalPayments}
          sub="boutique · à traiter"
          color={totalPayments > 10 ? 'var(--warn)' : 'var(--ink)'}
          accent={totalPayments > 10 ? 'var(--warn)' : 'var(--sand)'}
          sparkValues={[5, 8, 6, 12, 9, 11, totalPayments]}
          onClick={() => navigate('/admin/commandes')}
          urgent={totalPayments > 15}
        />
        <KpiTile
          label="Dons reçus"
          value="1 850"
          suffix="MAD"
          sub="+3 confirmés aujourd'hui"
          color="var(--success)"
          accent="var(--success)"
          sparkValues={[300, 500, 700, 900, 1100, 1500, 1850]}
          onClick={() => navigate('/admin/dons')}
        />
        <KpiTile
          label="Groupes à valider"
          value={3}
          sub="entreprises en attente"
          color="var(--info)"
          accent="var(--info)"
          sparkValues={[1, 2, 1, 3, 2, 4, 3]}
          onClick={() => navigate('/admin/restaurant/groupes')}
        />
        <KpiTile
          label="QR scans"
          value={247}
          sub="scans effectués ce soir"
          color="var(--olive)"
          accent="var(--olive-deep)"
          sparkValues={[20, 45, 80, 120, 170, 210, 247]}
          onClick={() => navigate('/admin/scan-reservation')}
        />
      </div>

      {/* ── 3. Urgencies + Evening Flow ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14, alignItems: 'start' }}>

        {/* Urgencies panel */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, overflow: 'hidden',
        }}>
          <div style={{
            padding: '13px 16px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--line-soft)',
          }}>
            <div>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertTriangle size={13} style={{ color: urgencies.some(u => u.priority === 'critique') ? 'var(--danger)' : 'var(--warn)' }} />
                Urgences opérationnelles
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>Actions à traiter maintenant</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: urgencies.some(u => u.priority === 'critique') ? 'var(--danger-bg)' : 'var(--warn-bg)',
              color: urgencies.some(u => u.priority === 'critique') ? 'var(--danger)' : 'var(--warn)',
              borderRadius: 99, padding: '2px 8px',
            }}>
              {urgencies.length}
            </span>
          </div>

          {urgencies.length === 0 ? (
            <div style={{
              padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 10,
              color: 'var(--success)',
            }}>
              <CheckCircle size={18} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Tout est sous contrôle</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 1 }}>
                  Aucune urgence détectée · opérations nominales
                </div>
              </div>
            </div>
          ) : (
            urgencies.map(u => (
              <UrgencyItem
                key={u.id}
                icon={u.icon}
                iconBg={u.iconBg}
                label={u.label}
                value={u.value}
                priority={u.priority}
                cta={u.cta}
                onClick={() => navigate(u.route)}
              />
            ))
          )}
        </div>

        {/* Evening flow chart */}
        <EveningFlowChart totalReservations={totalReservations} />
      </div>

      {/* ── 4. Activity Feed + Operational Health ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, alignItems: 'start' }}>

        {/* Activity feed */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, overflow: 'hidden',
        }}>
          {/* Header + filter tabs */}
          <div style={{ padding: '13px 16px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowUpRight size={13} style={{ color: 'var(--olive)' }} />
                Activité en direct
              </div>
              <button
                onClick={() => navigate('/admin/logs')}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--ink-soft)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Journal complet →
              </button>
            </div>
            {/* Category filters */}
            <div style={{ display: 'flex', gap: 5, paddingBottom: 10, overflowX: 'auto' }}>
              {(['all', ...Object.keys(CAT_CONFIG)] as Array<ActivityCategory | 'all'>).map(cat => {
                const isActive = activityFilter === cat;
                const cfg = cat !== 'all' ? CAT_CONFIG[cat as ActivityCategory] : null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActivityFilter(cat)}
                    style={{
                      padding: '3px 8px', fontSize: 10.5, fontWeight: 500, borderRadius: 4,
                      border: `1px solid ${isActive ? (cfg?.color ?? 'var(--olive)') : 'var(--line)'}`,
                      background: isActive ? (cfg?.bg ?? 'var(--olive-soft)') : 'transparent',
                      color: isActive ? (cfg?.color ?? 'var(--olive-deep)') : 'var(--ink-mute)',
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}
                  >
                    {cat === 'all' ? 'Tout' : cfg!.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items */}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredActivity.map((a, i) => {
              const cfg = CAT_CONFIG[a.category];
              return (
                <div key={a.id} style={{
                  display: 'flex', gap: 10, padding: '9px 16px',
                  borderBottom: i < filteredActivity.length - 1 ? '1px solid var(--line-soft)' : 'none',
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, background: cfg.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cfg.color, flexShrink: 0, marginTop: 1,
                  }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>{a.text}</span>
                      <span style={{
                        fontSize: 9.5, color: cfg.color,
                        border: `1px solid ${cfg.color}30`, borderRadius: 3, padding: '0 4px', fontWeight: 500,
                      }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{a.detail}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-mute)', flexShrink: 0, paddingTop: 2, whiteSpace: 'nowrap' }}>
                    il y a {a.minsAgo < 60 ? `${a.minsAgo}m` : `${Math.round(a.minsAgo / 60)}h`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational health */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <CheckCircle size={13} style={{ color: 'var(--olive)' }} />
            Santé opérationnelle
          </div>

          {/* Global status */}
          <div style={{
            padding: '10px 14px', background: hc.bg, borderRadius: 6,
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <span style={{ fontSize: 20 }}>{hc.emoji}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: hc.color }}>{hc.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 1 }}>État général du système</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {([
              { label: 'Saturation', value: `${fillRate}%`, tone: fillRate > 85 ? 'danger' : fillRate > 70 ? 'warn' : 'ok' },
              { label: 'Charge équipe', value: chargeLabel, tone: chargeTone },
              { label: 'Incidents', value: '0', tone: 'ok' },
              { label: 'Présence', value: `${presenceRate}%`, tone: presenceRate >= 80 ? 'ok' : presenceRate >= 60 ? 'warn' : 'danger' },
              { label: 'Préparation', value: `${Math.min(readinessRate, 100)}%`, tone: readinessRate >= 80 ? 'ok' : readinessRate >= 60 ? 'warn' : 'danger' },
              { label: 'Risque', value: healthStatus === 'stable' ? 'Faible' : healthStatus === 'tension' ? 'Modéré' : 'Élevé', tone: healthStatus === 'stable' ? 'ok' : healthStatus === 'tension' ? 'warn' : 'danger' },
            ] as Array<{ label: string; value: string; tone: HealthTone }>).map(m => {
              const c = { ok: 'var(--success)', warn: 'var(--warn)', danger: 'var(--danger)' }[m.tone];
              const bg = { ok: 'var(--success-bg)', warn: 'var(--warn-bg)', danger: 'var(--danger-bg)' }[m.tone];
              return (
                <div key={m.label} style={{ background: bg, borderRadius: 5, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c, lineHeight: 1 }}>{m.value}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 3 }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 5. Active Modules Grid (3×3) ────────────────────────────────── */}
      <div>
        <SectionTitle icon={<Package size={13} />} title="Modules actifs" sub="état du jour" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <ModuleCard icon={<Utensils size={14} />} name="Réservations" keyMetric={totalReservations}
            metricLabel="confirmées" status={fillRate > 85 ? 'warn' : 'ok'}
            onClick={() => navigate('/admin/reservations-calendar')} />
          <ModuleCard icon={<Users size={14} />} name="Bénévoles" keyMetric={presentVolunteers}
            metricLabel="présents" status={absenceRate > 20 ? 'warn' : 'ok'}
            onClick={() => navigate('/admin/benevoles')} />
          <ModuleCard icon={<ShoppingBag size={14} />} name="Boutique" keyMetric={totalPayments}
            metricLabel="commandes" status={totalPayments > 10 ? 'warn' : totalPayments > 0 ? 'ok' : 'idle'}
            onClick={() => navigate('/admin/commandes')} />
          <ModuleCard icon={<Moon size={14} />} name="Pâtisserie" keyMetric={24}
            metricLabel="commandes" status="ok"
            onClick={() => navigate('/admin/patisserie')} />
          <ModuleCard icon={<Package size={14} />} name="Terroir" keyMetric={8}
            metricLabel="commandes" status="idle"
            onClick={() => navigate('/admin/terroir/products')} />
          <ModuleCard icon={<Heart size={14} />} name="Dons" keyMetric="1 850"
            metricLabel="MAD reçus" status="ok"
            onClick={() => navigate('/admin/dons')} />
          <ModuleCard icon={<CreditCard size={14} />} name="Cartes membres" keyMetric={12}
            metricLabel="en pipeline" status="warn"
            onClick={() => navigate('/admin/cards')} />
          <ModuleCard icon={<Package size={14} />} name="Inventaire" keyMetric={3}
            metricLabel="alertes stock" status="idle"
            onClick={() => navigate('/admin/inventory')} />
          <ModuleCard icon={<QrCode size={14} />} name="Scanner QR" keyMetric={247}
            metricLabel="scans" status="ok"
            onClick={() => navigate('/admin/scan-reservation')} />
        </div>
      </div>

      {/* ── 6. Quick Access ─────────────────────────────────────────────── */}
      <div>
        <SectionTitle title="Accès rapides" sub="actions fréquentes" />
        <div style={{ display: 'flex', gap: 8 }}>
          <QuickBtn icon={<ScanLine size={15} />} label="Scanner QR" onClick={() => navigate('/admin/scan-reservation')} primary />
          <QuickBtn icon={<Utensils size={15} />} label="Réservations" onClick={() => navigate('/admin/reservations-calendar')} />
          <QuickBtn icon={<UserPlus size={15} />} label="Ajouter bénévole" onClick={() => navigate('/admin/benevoles')} />
          <QuickBtn icon={<CreditCard size={15} />} label="Valider paiement" onClick={() => navigate('/admin/payments')} />
          <QuickBtn icon={<Package size={15} />} label="Gérer stock" onClick={() => navigate('/admin/inventory')} />
          <QuickBtn icon={<Printer size={15} />} label="Imprimer cartes" onClick={() => navigate('/admin/cards')} />
          <QuickBtn icon={<Users size={15} />} label="Nouveau groupe" onClick={() => navigate('/admin/restaurant/groupes')} />
          <QuickBtn icon={<Bell size={15} />} label="Envoyer notif" onClick={() => navigate('/admin/messages')} />
        </div>
      </div>

      {/* ── 7. Mini Analytics ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>

        {/* Ramadan fill rate sparkline */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={13} style={{ color: 'var(--olive)' }} />
                Remplissage Ramadan 2025
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 2 }}>
                Évolution sur {totalDays || 30} nuits · taux moyen 82%
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--olive)' }}>82%</div>
          </div>
          <div style={{ overflow: 'hidden' }}>
            <Sparkline
              values={RAMADAN_FILL.slice(0, Math.max(totalDays || 30, 10))}
              width={560}
              height={55}
              color="var(--olive)"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Nuit 1</span>
            <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Nuit {totalDays || 30}</span>
          </div>
        </div>

        {/* Revenue breakdown */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={13} style={{ color: 'var(--olive)' }} />
            Répartition boutique
          </div>
          {(() => {
            const revData = [
              { label: 'Goodies',    pct: 58, amt: '1 879 MAD', color: 'var(--olive)' },
              { label: 'Pâtisserie', pct: 28, amt: '907 MAD',   color: 'var(--sand)' },
              { label: 'Terroir',    pct: 14, amt: '454 MAD',   color: '#A8C2A0' },
            ];
            const svgW = 220, svgH = 90, barH = 20, gap = 14, maxPct = 100;
            return (
              <svg width={svgW} height={svgH} style={{ display: 'block', overflow: 'visible' }}>
                {revData.map((d, i) => {
                  const barW = Math.round((d.pct / maxPct) * (svgW - 60));
                  const y = i * (barH + gap);
                  return (
                    <g key={d.label}>
                      <text x={0} y={y + 13} fontSize="10" fill="var(--ink-soft)">{d.label}</text>
                      <rect x={52} y={y} width={barW} height={barH} rx="3" fill={d.color} fillOpacity="0.85" />
                      <text x={52 + barW + 5} y={y + 13} fontSize="9.5" fill="var(--ink-mute)">{d.amt}</text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 10, marginTop: 4 }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>Total boutique · saison</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>3 240 MAD</div>
          </div>
        </div>
      </div>

      {/* ── 8. Dashboard Footer ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px',
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-mute)' }}>
          <Clock size={11} />
          Dernière mise à jour : {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          &nbsp;·&nbsp;Actualisation automatique toutes les 60 s
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>
            EventOS · Ftour Bab Rayan 1447
          </span>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 26, padding: '0 10px',
              background: 'var(--olive-soft)', color: 'var(--olive-deep)',
              border: '1px solid var(--olive-soft)', borderRadius: 5,
              fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <RefreshCw size={11} />
            Actualiser tout
          </button>
        </div>
      </div>

    </div>
  );
}
