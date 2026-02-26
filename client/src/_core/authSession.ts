const STORAGE_KEY = 'supabase_session';

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
};

export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.accessToken || !parsed.refreshToken) {
      clearStoredSession();
      return null;
    }
    return parsed;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function setStoredSession(session: StoredSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem('supabase_token', session.accessToken);
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('supabase_token');
}

export function isSessionExpiringSoon(expiresAt: number | null, marginSeconds = 120): boolean {
  if (!expiresAt) return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return expiresAt - nowInSeconds <= marginSeconds;
}
