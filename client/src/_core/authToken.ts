const STORAGE_KEY = 'supabase_session';

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
};

export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;

  const payload = localStorage.getItem(STORAGE_KEY);
  if (!payload) return null;

  try {
    return JSON.parse(payload) as StoredSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: StoredSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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
