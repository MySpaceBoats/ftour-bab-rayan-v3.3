import { describe, expect, it } from 'vitest';
import { filterDashboardItems, hasDashboardAccess } from '../shared/dashboard/access';

describe('dashboard access helpers', () => {
  it('hasDashboardAccess returns true only for allowed keys', () => {
    const allowed = new Set(['dash.a', 'dash.b']);
    expect(hasDashboardAccess('dash.a', allowed)).toBe(true);
    expect(hasDashboardAccess('dash.c', allowed)).toBe(false);
  });

  it('filterDashboardItems keeps only allowed entries', () => {
    const items = [
      { key: 'dash.a', label: 'A' },
      { key: 'dash.b', label: 'B' },
      { key: 'dash.c', label: 'C' },
    ];

    const filtered = filterDashboardItems(items, new Set(['dash.b']));
    expect(filtered).toEqual([{ key: 'dash.b', label: 'B' }]);
  });
});
