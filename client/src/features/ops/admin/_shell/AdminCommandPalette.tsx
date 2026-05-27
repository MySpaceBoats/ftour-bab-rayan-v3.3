import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { Search, Home, Users, ShoppingBag, Heart, QrCode, Package, CreditCard, BarChart3, FileText, Calendar, Settings } from 'lucide-react';
import Kbd from '@/components/admin/Kbd';
import SectionLabel from '@/components/admin/SectionLabel';
import { ADMIN_NAV } from './adminRouteMap';

interface AdminCommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  dashboard: Home, stats: BarChart3, logs: FileText, reservations: Calendar,
  groupes: Users, catalog: ShoppingBag, orders: Package, dons: Heart,
  benevoles: Users, cards: CreditCard, qrcodes: QrCode, utilisateurs: Settings,
};

function getNavIcon(id: string) {
  return NAV_ICONS[id] || Home;
}

export default function AdminCommandPalette({ open, onClose }: AdminCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten nav items for search
  const allItems = ADMIN_NAV.flatMap(g => g.items.map(item => ({ ...item, group: g.group })));

  const filtered = query.trim()
    ? allItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.id.includes(query.toLowerCase())
      )
    : allItems.slice(0, 8);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = useCallback((route: string) => {
    navigate(route);
    onClose();
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); e.preventDefault(); }
      if (e.key === 'ArrowUp') { setActiveIdx(i => Math.max(i - 1, 0)); e.preventDefault(); }
      if (e.key === 'Enter' && filtered[activeIdx]) {
        handleSelect(filtered[activeIdx].route);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIdx, handleSelect, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(38,36,26,0.32)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 90,
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          boxShadow: '0 24px 64px -16px rgba(38,36,26,0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <Search size={15} strokeWidth={1.5} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Aller à, chercher, créer…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: 'var(--ink)',
              fontFamily: 'inherit',
            }}
          />
          <Kbd>esc</Kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ink-mute)' }}>
              Aucun résultat
            </div>
          ) : (
            <div style={{ padding: '6px 0' }}>
              <SectionLabel style={{ padding: '4px 16px', fontSize: 9.5 }}>Aller à</SectionLabel>
              {filtered.map((item, i) => {
                const isActive = i === activeIdx;
                const Icon = getNavIcon(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.route)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 16px',
                      width: '100%',
                      background: isActive ? 'var(--olive-soft)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--olive)' : '2px solid transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        background: isActive ? 'var(--olive)' : 'var(--surface-alt)',
                        color: isActive ? '#F5F1E2' : 'var(--ink-soft)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={13} strokeWidth={1.5} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: isActive ? 500 : 400 }}>
                        {item.label}
                      </div>
                    </div>
                    {i < 3 && <Kbd>↵</Kbd>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--line-soft)',
            background: 'var(--surface-alt)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 10.5,
            color: 'var(--ink-mute)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd>↵</Kbd> ouvrir</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic' }}>Ftour Bab Rayan</span>
        </div>
      </div>
    </div>
  );
}
