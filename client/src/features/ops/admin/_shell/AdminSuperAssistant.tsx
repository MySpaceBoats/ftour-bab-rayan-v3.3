import { useRef, useState } from 'react';
import { getStoredSession } from '@/_core/authSession';

type Msg = { role: 'user' | 'assistant'; content: string };

// ponytail: même origine que tRPC (VITE_API_URL ou /api/trpc) ; pas de persistance de l'historique, pas de quota côté worker.
const ENDPOINT = (import.meta.env.VITE_API_URL || '/api/trpc').replace(/\/api\/trpc\/?$/, '') + '/api/superassistant';

/** Lit un flux SSE au format OpenAI et appelle onDelta pour chaque morceau de texte. */
async function readSse(res: Response, onDelta: (t: string) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const l of lines) {
      if (!l.startsWith('data:')) continue;
      const d = l.slice(5).trim();
      if (d === '[DONE]') return;
      try { onDelta(JSON.parse(d).choices?.[0]?.delta?.content ?? ''); } catch { /* ligne partielle ou keep-alive */ }
    }
  }
}

export default function AdminSuperAssistant({ page }: { page: string }) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [allow, setAllow] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const scroll = () => requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history: Msg[] = [...chat, { role: 'user', content: text }];
    setChat([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredSession()?.accessToken ?? ''}` },
        body: JSON.stringify({ messages: history, page, allow }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Erreur ${res.status}`);
      await readSse(res, t => {
        setChat(c => c.map((m, i) => (i === c.length - 1 ? { ...m, content: m.content + t } : m)));
        scroll();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setChat(history);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Superassistant"
        aria-expanded={open}
        style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60, padding: '10px 16px', borderRadius: 999, border: 'none', background: '#864654', color: '#fff', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}
      >
        ✦ Superassistant
      </button>
      {open && (
        <section
          role="dialog"
          aria-label="Superassistant"
          style={{ position: 'fixed', right: 20, bottom: 72, zIndex: 60, width: 'min(420px, calc(100vw - 40px))', height: 'min(560px, 70dvh)', display: 'flex', flexDirection: 'column', background: 'var(--bg, #fff)', color: 'var(--ink, #111)', border: '1px solid rgba(0,0,0,.15)', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,.3)', overflow: 'hidden' }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,.1)', fontWeight: 600 }}>
            <span>✦ Superassistant</span>
            <button type="button" onClick={() => { setChat([]); setError(''); }} disabled={busy || !chat.length} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: chat.length ? 1 : 0.4 }}>
              Nouvelle conversation
            </button>
          </header>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 14px', fontSize: 12, borderBottom: '1px solid rgba(0,0,0,.1)', color: allow ? '#b00020' : 'inherit' }} title="Sans cette case, l'assistant travaille sur des branches et ouvre des PR ; il ne peut ni merger, ni déployer, ni commiter sur main.">
            <input type="checkbox" checked={allow} onChange={e => setAllow(e.target.checked)} /> Autoriser merge, déploiement et commit sur main
          </label>
          <div ref={logRef} role="log" aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            {!chat.length && <p style={{ opacity: 0.7 }}>Je peux lire et modifier le code (branches, commits, PR), et avec l'autorisation merger et déployer. Pas de shell : je ne lance ni tests ni build. Je n'accède pas aux données Supabase. Les réponses peuvent être fausses : vérifie les PR avant de merger.</p>}
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', whiteSpace: 'pre-wrap', padding: '8px 12px', borderRadius: 10, background: m.role === 'user' ? '#864654' : 'rgba(0,0,0,.06)', color: m.role === 'user' ? '#fff' : 'inherit' }}>
                {m.content || '…'}
              </div>
            ))}
            {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
          </div>
          <form onSubmit={e => { e.preventDefault(); void send(); }} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid rgba(0,0,0,.1)' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={2}
              maxLength={12000}
              placeholder="Écris ton message…"
              aria-label="Message"
              style={{ flex: 1, resize: 'none', padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,.2)', font: 'inherit', background: 'transparent', color: 'inherit' }}
            />
            <button type="submit" disabled={busy || !input.trim()} style={{ padding: '0 14px', borderRadius: 8, border: 'none', background: '#864654', color: '#fff', cursor: 'pointer', opacity: busy || !input.trim() ? 0.5 : 1 }}>
              Envoyer
            </button>
          </form>
        </section>
      )}
    </>
  );
}
