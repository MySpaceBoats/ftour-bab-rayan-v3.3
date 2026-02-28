export function hasDashboardAccess(key: string, allowedKeys: Set<string>): boolean {
  return allowedKeys.has(key);
}

export function filterDashboardItems<T extends { key: string }>(
  items: T[],
  allowedKeys: Set<string>
): T[] {
  return items.filter(item => hasDashboardAccess(item.key, allowedKeys));
}
