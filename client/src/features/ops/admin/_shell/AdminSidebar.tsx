import { useLocation } from 'wouter';
import {
  Home, BarChart3, FileText, Calendar, Users, Store,
  ShoppingBag, Package, CakeSlice, Leaf, QrCode, ScanLine,
  Heart, UserCheck, CreditCard, Vote, Images, Camera,
  CalendarDays, MessageSquare, BookOpen, Star, Edit3, Users2,
  Settings, LayoutDashboard, DollarSign, Warehouse, LogOut,
} from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { ADMIN_NAV, ROUTE_TO_NAV_ID } from './adminRouteMap';

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  dashboard: Home,
  stats: BarChart3,
  logs: FileText,
  payments: DollarSign,
  reservations: Calendar,
  'reservations-cal': CalendarDays,
  groupes: Users2,
  restaurants: Store,
  catalog: ShoppingBag,
  orders: Package,
  'orders-cash': DollarSign,
  patisserie: CakeSlice,
  terroir: Leaf,
  'terroir-orders': Package,
  qrcodes: QrCode,
  'scan-product': ScanLine,
  inventory: Warehouse,
  dons: Heart,
  benevoles: Users,
  'benevoles-groupes': UserCheck,
  cards: CreditCard,
  ftour: Star,
  elections: Vote,
  galerie: Images,
  'event-photos': Camera,
  jours: CalendarDays,
  messages: MessageSquare,
  blog: BookOpen,
  feedback: Star,
  contenu: Edit3,
  equipe: Users2,
  utilisateurs: Settings,
  unified: LayoutDashboard,
};

interface AdminSidebarProps {
  active: string;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function AdminSidebar({ active }: AdminSidebarProps) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();

  // Normalize location (strip /admin3 prefix)
  const normalizedLocation = location.replace(/^\/admin3/, '/admin');
  const derivedActive = ROUTE_TO_NAV_ID[normalizedLocation] || active;

  function handleNav(route: string) {
    // Support admin3 mode
    const isAdmin3 = location.startsWith('/admin3');
    const targetRoute = isAdmin3 ? route.replace('/admin', '/admin3') : route;
    navigate(targetRoute);
  }

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: 'var(--surface-alt)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Brand block */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            background: 'var(--olive)',
            color: '#F5F1E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontSize: 17,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          F
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Ftour Bab Rayan
          </span>
          <span
            style={{
              fontSize: 10.5,
              color: 'var(--ink-mute)',
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic',
            }}
          >
            12<sup>e</sup> édition · Admin
          </span>
        </div>
      </div>

      {/* Nav groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 14px' }}>
        {ADMIN_NAV.map(group => (
          <div key={group.group} style={{ marginTop: 12 }}>
            <div
              className="section-label"
              style={{ padding: '4px 10px', fontSize: 9.5 }}
            >
              {group.group}
            </div>
            <div style={{ marginTop: 4 }}>
              {group.items.map(item => {
                const isActive = item.id === derivedActive;
                const Icon = NAV_ICONS[item.id] || Home;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.route)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '6px 10px',
                      margin: '1px 0',
                      borderRadius: 5,
                      width: '100%',
                      background: isActive ? 'var(--olive)' : 'transparent',
                      color: isActive ? '#F5F1E2' : 'var(--ink-soft)',
                      fontSize: 12.5,
                      fontWeight: isActive ? 500 : 400,
                      cursor: 'pointer',
                      border: 'none',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      transition: 'background 100ms ease',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--line-soft)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <Icon size={14} strokeWidth={1.5} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          background: isActive ? 'rgba(255,255,255,0.18)' : 'var(--olive-soft)',
                          color: isActive ? '#F5F1E2' : 'var(--olive-deep)',
                          padding: '1px 6px',
                          borderRadius: 999,
                          minWidth: 16,
                          textAlign: 'center',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User footer */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: 'var(--olive)',
            color: '#F5F1E2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {user ? getInitials(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'A') : 'A'}
        </div>
        <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Admin'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>
            {user?.role || 'Admin'}
          </div>
        </div>
        <button
          onClick={() => logout?.()}
          title="Se déconnecter"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-mute)',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <LogOut size={14} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}
