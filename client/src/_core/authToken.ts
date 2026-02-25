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
    const parsed = JSON.parse(payload) as Partial<StoredSession>;

    if (
      typeof parsed.accessToken !== 'string' ||
      parsed.accessToken.length === 0 ||
      typeof parsed.refreshToken !== 'string' ||
      parsed.refreshToken.length === 0 ||
      (parsed.expiresAt !== null && typeof parsed.expiresAt !== 'number')
    ) {
      clearStoredSession();
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt ?? null,
    };
  } catch {
    clearStoredSession();
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

export function scrubStaleSession(maxSessionAgeDays = 14): void {
  const session = getStoredSession();
  if (!session) return;

  if (session.expiresAt && isSessionExpired(session.expiresAt)) {
    clearStoredSession();
    return;
  }

  // Guard against very old tokens where expiresAt might be missing.
  if (!session.expiresAt) {
    const maxAgeMs = maxSessionAgeDays * 24 * 60 * 60 * 1000;
    const markerKey = `${STORAGE_KEY}_created_at`;
    const createdAt = Number(localStorage.getItem(markerKey) || 0);
    if (!createdAt) {
      localStorage.setItem(markerKey, Date.now().toString());
      return;
    }

    if (Date.now() - createdAt > maxAgeMs) {
      clearStoredSession();
      localStorage.removeItem(markerKey);
    }
  }
}

export function isSessionExpired(expiresAt: number): boolean {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowInSeconds;
}

export function isSessionExpiringSoon(expiresAt: number | null, marginSeconds = 120): boolean {
  if (!expiresAt) return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return expiresAt - nowInSeconds <= marginSeconds;
}
