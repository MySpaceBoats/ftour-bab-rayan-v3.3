// Simple in-memory rate limiter for anonymous gallery uploads.
// 10 photos per IP per 15-minute window.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_UPLOADS = 10;

type Entry = { count: number; windowStart: number };
const store = new Map<string, Entry>();

export function checkGalleryRateLimit(ip: string, count: number = 1): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count, windowStart: now });
    return { allowed: true };
  }

  if (entry.count + count > MAX_UPLOADS) {
    const retryAfterSec = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  entry.count += count;
  return { allowed: true };
}

// Prune stale entries every hour to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > WINDOW_MS) store.delete(key);
  }
}, 60 * 60 * 1000);
