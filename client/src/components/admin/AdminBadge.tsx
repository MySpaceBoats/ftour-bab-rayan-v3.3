import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'sand' | 'olive' | 'ghost';

interface AdminBadgeProps {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--olive-soft)',  fg: 'var(--olive-deep)' },
  success: { bg: 'var(--success-bg)',  fg: 'var(--success)' },
  warn:    { bg: 'var(--warn-bg)',     fg: 'var(--warn)' },
  danger:  { bg: 'var(--danger-bg)',   fg: 'var(--danger)' },
  info:    { bg: 'var(--info-bg)',     fg: 'var(--info)' },
  sand:    { bg: 'var(--sand-soft)',   fg: '#7B5E1E' },
  olive:   { bg: 'var(--olive)',       fg: '#F5F1E2' },
  ghost:   { bg: 'transparent',       fg: 'var(--ink-soft)' },
};

export default function AdminBadge({ tone = 'neutral', dot = false, children, className }: AdminBadgeProps) {
  const { bg, fg } = toneStyles[tone];
  return (
    <span
      className={cn(className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? 6 : 0,
        padding: '3px 8px',
        borderRadius: 4,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.1,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: fg, flexShrink: 0 }} />
      )}
      {children}
    </span>
  );
}
