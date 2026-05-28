import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/_core/hooks/useAuth';
import { getStoredSession } from '@/_core/authToken';
import { useAdminPage } from './_shell/AdminFrame';
import Sparkline from '@/components/admin/Sparkline';
import {
  Moon, Plus, Calendar, Trophy, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Printer, Users, Mail, QrCode, ChevronRight,
} from 'lucide-react';

// Utility: get initials from name
function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// Tiny stat tile component
function StatTile({
  label, value, suffix, delta, trend, sparkValues, color,
}: {
  label: string; value: string | number; suffix?: string; delta?: number;
  trend?: string; sparkValues?: number[]; color?: string;
}) {
  const isUp = delta === undefined ? null : delta >= 0;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minHeight: 110,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-soft)' }}>{label}</div>
        {delta !== undefined && isUp !== null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 11, fontWeight: 600,
            color: isUp ? 'var(--success)' : 'var(--danger)',
          }}>
            {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--ink)', letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
        {suffix && <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{suffix}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{trend}</div>
        {sparkValues && sparkValues.length > 1 && (
          <Sparkline values={sparkValues} width={70} height={22} color={color || 'var(--olive)'} />
        )}
      </div>
    </div>
  );
}

// Action item in the "À traiter" queue
function ActionItem({
  icon, iconBg, title, meta, urgent, cta, onClick,
}: {
  icon: React.ReactNode; iconBg: string; title: string; meta: string;
  urgent?: boolean; cta: string; onClick?: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderBottom: '1px solid var(--line-soft)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 6, background: iconBg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {title}
          {urgent && <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--danger)', flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{meta}</div>
      </div>
      <button
        onClick={onClick}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 26, padding: '0 8px',
          background: 'var(--surface)', color: 'var(--ink)',
          border: '1px solid var(--line)', borderRadius: 5,
          fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}
      >
        {cta}
        <ChevronRight size={11} />
      </button>
    </div>
  );
}

// Reservations bar chart (static layout, stacked bars)
function ReservationsToday({ totalReservations }: { totalReservations: number }) {
  const slots = [
    { time: '17:30', cap: 80, conf: 54, walk: 6 },
    { time: '18:00', cap: 80, conf: 72, walk: 8 },
    { time: '18:30', cap: 80, conf: 68, walk: 10 },
    { time: '19:00', cap: 80, conf: 80, walk: 14 },
    { time: '19:30', cap: 80, conf: 60, walk: 8 },
    { time: '20:00', cap: 80, conf: 42, walk: 4 },
    { time: '20:30', cap: 80, conf: 28, walk: 0 },
    { time: '21:00', cap: 80, conf: 14, walk: 0 },
  ];
  const maxBar = 100;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Réservations aujourd'hui</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 2 }}>
            {totalReservations} confirmées · capacité 640
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--ink-soft)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--olive)' }} /> Confirmées
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--sand)' }} /> Walk-in
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 130, paddingTop: 6 }}>
        {slots.map(s => {
          const total = s.conf + s.walk;
          const hCap   = (s.cap / maxBar) * 120;
          const hConf  = (s.conf / maxBar) * 120;
          const hWalk  = (s.walk / maxBar) * 120;
          const over = total > s.cap;
          return (
            <div key={s.time} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10, color: over ? 'var(--danger)' : 'var(--ink-mute)', fontWeight: 500 }}>
                {total}{over && ' !'}
              </div>
              <div style={{ position: 'relative', width: '100%', height: 120, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  height: hCap, border: '1px dashed var(--line)', borderRadius: 3,
                  background: 'var(--line-soft)',
                }} />
                <div style={{
                  position: 'relative', width: '100%',
                  display: 'flex', flexDirection: 'column-reverse',
                  borderRadius: 3, overflow: 'hidden',
                }}>
                  <div style={{ height: hConf, background: 'var(--olive)' }} />
                  <div style={{ height: hWalk, background: 'var(--sand)' }} />
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{s.time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Simple volunteer leaderboard
function TopVolunteers({ volunteers }: { volunteers: { name: string; hours: number; points: number; level: string }[] }) {
  const levelColor: Record<string, string> = {
    red: '#A85454', orange: '#C77B3B', yellow: '#C9A93A', blue: '#3C6E94',
  };
  const avatarTones = ['#5E5B34', '#CDBB8A', '#A8C2A0', '#A8BAD0', '#D9A8A8'];

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 6, padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Top bénévoles · semaine</div>
        <Trophy size={14} strokeWidth={1.5} style={{ color: 'var(--sand)' }} />
      </div>
      {volunteers.slice(0, 5).map((v, i) => (
        <div key={v.name} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
          borderBottom: i < 4 ? '1px solid var(--line-soft)' : 'none',
        }}>
          <div style={{
            width: 14, fontSize: 11, color: 'var(--ink-mute)',
            textAlign: 'right',
            fontFamily: '"JetBrains Mono", monospace',
          }}>{i + 1}</div>
          <div style={{
            width: 22, height: 22, borderRadius: 999,
            background: avatarTones[i % 5], color: i === 0 ? '#F5F1E2' : 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 600, flexShrink: 0,
          }}>
            {initials(v.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.name}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{v.hours}h · {v.points} pts</div>
          </div>
          <span style={{
            width: 8, height: 8, borderRadius: 999,
            background: levelColor[v.level] || '#CDBB8A',
          }} />
        </div>
      ))}
    </div>
  );
}

// Activity feed
const ACTIVITY = [
  { who: 'Système', ago: 'il y a 5 min', what: 'a traité ', target: '8 commandes goodies', tone: 'success' as const },
  { who: 'Scanner #1', ago: 'il y a 10 min', what: 'a validé ', target: '18 bénévoles', tone: 'info' as const },
  { who: 'Admin', ago: 'il y a 22 min', what: 'a confirmé le don de ', target: '500 DH', tone: 'success' as const },
  { who: 'Système', ago: 'il y a 35 min', what: 'a envoyé ', target: '6 emails carte membre', tone: 'neutral' as const },
  { who: 'Admin', ago: 'il y a 1h', what: 'a mis à jour ', target: 'le stock pâtisserie', tone: 'neutral' as const },
];

const toneDotColor: Record<string, string> = {
  success: 'var(--success)', info: 'var(--info)', danger: 'var(--danger)', neutral: 'var(--sand)',
};

// Main dashboard component
export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // tRPC queries
  const { data: volunteerStats } = trpc.volunteers.stats.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const { data: days } = trpc.days.list.useQuery();

  // BFF stats
  const token = getStoredSession()?.accessToken;
  const { data: adminDashboard } = useQuery({
    queryKey: ['admin-dashboard-bff'],
    queryFn: async () => {
      const res = await fetch('/api/admin-dashboard?page=1&pageSize=50', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ stats: { payments: number; notifications: number; reservations: number } }>;
    },
    refetchInterval: 60_000,
  });

  // Topbar actions
  useAdminPage({
    actions: (
      <div style={{ display: 'flex', gap: 8 }}>
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
          <Calendar size={13} strokeWidth={1.5} />
          Calendrier
        </button>
        <button
          onClick={() => navigate('/admin/benevoles')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px',
            background: 'var(--olive)', color: '#F5F1E2',
            border: '1px solid var(--olive)', borderRadius: 5,
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={13} strokeWidth={1.5} />
          Action rapide
        </button>
      </div>
    ),
  });

  const presentVolunteers = volunteerStats?.present ?? 0;
  const totalVolunteers = volunteerStats?.registered ?? 0;
  const totalDays = days?.length ?? 0;
  const totalReservations = adminDashboard?.stats?.reservations ?? 0;
  const totalPayments = adminDashboard?.stats?.payments ?? 0;

  const firstName = user?.name || user?.email?.split('@')[0] || 'Admin';

  // Static placeholder top volunteers (to be replaced with real query when available)
  const topVolunteers = [
    { name: 'Hicham Aouad', hours: 32, points: 480, level: 'red' },
    { name: 'Salma Khattabi', hours: 28, points: 420, level: 'red' },
    { name: 'Karim Idrissi', hours: 24, points: 360, level: 'yellow' },
    { name: 'Nora Tazi', hours: 22, points: 330, level: 'yellow' },
    { name: 'Mehdi Benjelloun', hours: 18, points: 270, level: 'orange' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1200 }}>

      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '4px 2px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{
            margin: 0,
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontSize: 22, fontWeight: 500,
            color: 'var(--ink)', letterSpacing: -0.3,
          }}>
            Bonsoir {firstName}.
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            {totalDays > 0 ? `${totalDays} jours de Ramadan configurés.` : 'Bienvenue dans l’espace admin.'}
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          background: 'var(--olive-soft)', borderRadius: 999,
        }}>
          <Moon size={13} strokeWidth={1.5} style={{ color: 'var(--olive)' }} />
          <span style={{ fontSize: 12, color: 'var(--olive-deep)', fontWeight: 500 }}>
            {totalDays} nuits
          </span>
          <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.6)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: 'var(--olive)' }} />
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatTile
          label="Bénévoles présents"
          value={presentVolunteers}
          suffix={`/ ${totalVolunteers}`}
          delta={8}
          trend={`${totalVolunteers - presentVolunteers} absents`}
          color="var(--olive)"
          sparkValues={[80, 90, 95, 110, 105, 120, presentVolunteers]}
        />
        <StatTile
          label="Réservations ce jour"
          value={totalReservations}
          delta={12}
          trend="capacité 640 couverts"
          color="var(--success)"
          sparkValues={[180, 200, 220, 230, 245, 260, totalReservations]}
        />
        <StatTile
          label="Commandes boutique"
          value={totalPayments}
          delta={5}
          trend="en attente de traitement"
          color="var(--info)"
          sparkValues={[60, 75, 85, 90, 100, 110, totalPayments]}
        />
        <StatTile
          label="Jours configurés"
          value={totalDays}
          trend="édition Ramadan 1447"
          color="var(--sand)"
          sparkValues={[0, 5, 10, 15, 20, 25, totalDays]}
        />
      </div>

      {/* Two-column: action queue + reservations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 14, alignItems: 'start' }}>

        {/* Action queue */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 16px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--line-soft)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>À traiter</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>Actions prioritaires</div>
            </div>
            <button
              onClick={() => navigate('/admin/logs')}
              style={{
                background: 'transparent', border: 'none', color: 'var(--ink-soft)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Tout voir</button>
          </div>
          <ActionItem
            urgent
            icon={<AlertTriangle size={14} strokeWidth={1.5} style={{ color: 'var(--danger)' }} />}
            iconBg="var(--danger-bg)"
            title="Dons en attente de confirmation"
            meta="Vérifier les paiements reçus"
            cta="Vérifier"
            onClick={() => navigate('/admin/dons')}
          />
          <ActionItem
            icon={<Printer size={14} strokeWidth={1.5} style={{ color: 'var(--warn)' }} />}
            iconBg="var(--warn-bg)"
            title="Cartes membres à imprimer"
            meta="Paiements reçus · prêts pour impression"
            cta="Lancer"
            onClick={() => navigate('/admin/cards')}
          />
          <ActionItem
            icon={<Users size={14} strokeWidth={1.5} style={{ color: 'var(--info)' }} />}
            iconBg="var(--info-bg)"
            title="Demandes groupes bénévoles"
            meta="Pièces jointes reçues · à valider"
            cta="Examiner"
            onClick={() => navigate('/admin/benevoles-groupes')}
          />
          <ActionItem
            icon={<Mail size={14} strokeWidth={1.5} style={{ color: 'var(--olive)' }} />}
            iconBg="var(--olive-soft)"
            title="Messages contact"
            meta="Nouveaux messages à traiter"
            cta="Ouvrir"
            onClick={() => navigate('/admin/messages')}
          />
          <ActionItem
            icon={<QrCode size={14} strokeWidth={1.5} style={{ color: 'var(--sand)' }} />}
            iconBg="var(--sand-soft)"
            title="Commandes en attente"
            meta="Goodies · Pâtisserie · Terroir"
            cta="Voir"
            onClick={() => navigate('/admin/commandes')}
          />
          <div style={{
            padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'var(--surface-alt)', fontSize: 11.5, color: 'var(--ink-mute)',
          }}>
            Voir plus d&apos;actions
            <ChevronRight size={11} />
          </div>
        </div>

        {/* Reservations chart */}
        <ReservationsToday totalReservations={totalReservations} />
      </div>

      {/* Bottom row: leaderboard + activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: 14, alignItems: 'start' }}>

        {/* Top volunteers */}
        <TopVolunteers volunteers={topVolunteers} />

        {/* Quick links / modules */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 12 }}>
            Accès rapides
          </div>
          {[
            { label: 'Catalogue unifié', route: '/admin/catalogue-unifie', sub: 'Goodies · Pâtisserie · Terroir' },
            { label: 'Réservations restaurant', route: '/admin/restaurant-reservations', sub: 'Groupes & particuliers' },
            { label: 'Cartes membres', route: '/admin/cards', sub: 'Pipeline complet' },
            { label: 'Inventaire', route: '/admin/inventory', sub: 'Stocks & mouvements' },
            { label: 'Galerie photos', route: '/admin/galerie', sub: 'Albums & événements' },
          ].map((m, i, arr) => (
            <button
              key={m.route}
              onClick={() => navigate(m.route)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '9px 0',
                background: 'transparent', border: 'none',
                borderBottom: i < arr.length - 1 ? '1px solid var(--line-soft)' : 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>{m.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{m.sub}</div>
              </div>
              <ChevronRight size={13} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
            </button>
          ))}
        </div>

        {/* Activity feed */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 6, padding: 16,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Activité récente</div>
            <button
              onClick={() => navigate('/admin/logs')}
              style={{
                background: 'transparent', border: 'none', color: 'var(--ink-soft)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Journal</button>
          </div>
          {ACTIVITY.map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 9, padding: '7px 0',
              borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 999,
                  background: toneDotColor[a.tone] || 'var(--sand)',
                }} />
                {i < ACTIVITY.length - 1 && (
                  <div style={{ flex: 1, width: 1, background: 'var(--line-soft)', marginTop: 4 }} />
                )}
              </div>
              <div style={{ flex: 1, lineHeight: 1.4, fontSize: 11.5, color: 'var(--ink-soft)', paddingBottom: 2 }}>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{a.who}</span> {a.what}
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{a.target}</span>
                <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 1 }}>{a.ago}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
