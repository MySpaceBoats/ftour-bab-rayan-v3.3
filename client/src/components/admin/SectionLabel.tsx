import { cn } from '@/lib/utils';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export default function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div
      className={cn('section-label', className)}
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
        color: 'var(--ink-mute)',
      }}
    >
      {children}
    </div>
  );
}
