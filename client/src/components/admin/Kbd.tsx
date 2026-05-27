export default function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 4px',
        background: 'var(--surface-alt)',
        border: '1px solid var(--line)',
        borderRadius: 3,
        color: 'var(--ink-soft)',
        fontSize: 10.5,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
