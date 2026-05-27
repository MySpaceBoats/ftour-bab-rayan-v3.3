import { type ReactNode } from 'react';
import { Bell, Search } from 'lucide-react';
import Kbd from '@/components/admin/Kbd';

interface AdminTopbarProps {
  title: string;
  crumb?: string[];
  actions?: ReactNode;
  onSearchClick?: () => void;
}

export default function AdminTopbar({ title, crumb, actions, onSearchClick }: AdminTopbarProps) {
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        borderBottom: '1px solid var(--line)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
      }}
    >
      {/* Left: breadcrumb + title */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        {crumb && crumb.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-mute)' }}>
            {crumb.map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{c}</span>
                {i < crumb.length - 1 && <span style={{ fontSize: 10, opacity: 0.5 }}>›</span>}
              </span>
            ))}
          </div>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: -0.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h1>
      </div>

      {/* Center: search field */}
      <button
        onClick={onSearchClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 280,
          height: 32,
          padding: '0 10px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 5,
          color: 'var(--ink-mute)',
          fontSize: 13,
          fontFamily: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          flexShrink: 0,
        }}
      >
        <Search size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Rechercher partout…</span>
        <Kbd>⌘K</Kbd>
      </button>

      {/* Right: notifications + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          style={{
            position: 'relative',
            width: 32,
            height: 32,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-soft)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Bell size={14} strokeWidth={1.5} />
          <span
            style={{
              position: 'absolute',
              top: 5,
              right: 6,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--danger)',
              border: '1.5px solid var(--surface)',
            }}
          />
        </button>
        {actions}
      </div>
    </header>
  );
}
