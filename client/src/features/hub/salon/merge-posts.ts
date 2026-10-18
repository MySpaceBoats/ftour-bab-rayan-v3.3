/** Pure list logic for the salon feed (newest first, ids strictly decreasing). */

/**
 * Merge a freshly polled first page into the posts already shown.
 * - page reaches the loaded history (no gap): keep older loaded posts, and their cursor unless the page now covers them all;
 * - gap (more new posts than one page): replace the list, the old cursor would skip the missing posts.
 */
export function mergeFirstPage<T extends { id: number }>(prev: T[], prevNext: string | null, page: T[], pageNext: string | null): { posts: T[]; next: string | null } {
  if (!prev.length || pageNext === null) return { posts: page, next: pageNext };
  const oldest = page[page.length - 1]?.id ?? 0;
  if (oldest > prev[0].id) return { posts: page, next: pageNext };
  const kept = prev.filter(p => p.id < oldest);
  return { posts: [...page, ...kept], next: kept.length ? prevNext : pageNext };
}

/** Append an older page, skipping ids already shown. */
export function appendOlder<T extends { id: number }>(prev: T[], older: T[]): T[] {
  const known = new Set(prev.map(p => p.id));
  return [...prev, ...older.filter(p => !known.has(p.id))];
}
