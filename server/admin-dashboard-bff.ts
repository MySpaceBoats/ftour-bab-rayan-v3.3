import { getSupabaseAdminClient } from './supabase';

type DashboardCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const DASHBOARD_CACHE_TTL_MS = 45_000;
const dashboardCache = new Map<string, DashboardCacheEntry>();

const toIsoOrNull = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const clampPage = (value: number) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 1);
const clampPageSize = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 50;
  return Math.min(50, Math.floor(value));
};

export async function getAdminDashboardPayload(input: { page?: number; pageSize?: number }) {
  const page = clampPage(input.page ?? 1);
  const pageSize = clampPageSize(input.pageSize ?? 50);
  const cacheKey = `admin-dashboard:${page}:${pageSize}`;
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return { ...(cached.payload as Record<string, unknown>), cache: 'HIT' as const };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      cache: 'MISS' as const,
      meta: { page, pageSize },
      stats: { reservations: 0, volunteers: 0, payments: 0, notifications: 0 },
      reservations: [],
      volunteers: [],
      payments: [],
      notifications: [],
    };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [
    reservationsResult,
    reservationsCountResult,
    volunteersResult,
    volunteersCountResult,
    paymentsResult,
    paymentsCountResult,
    notificationsResult,
    notificationsCountResult,
  ] = await Promise.all([
    supabase
      .from('reservations')
      .select('id,name,email,phone,status,total_amount,created_at')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase.from('reservations').select('id', { count: 'exact', head: true }),
    supabase
      .from('volunteers')
      .select('id,first_name,last_name,email,status,day_id,created_at,user_id')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase.from('volunteers').select('id', { count: 'exact', head: true }),
    supabase
      .from('payments')
      .select('id,user_id,amount,status,payment_method,created_at')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase.from('payments').select('id', { count: 'exact', head: true }),
    supabase
      .from('contact_messages')
      .select('id,name,email,subject,status,created_at')
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }),
  ]);

  const payload = {
    meta: { page, pageSize },
    stats: {
      reservations: reservationsCountResult.count ?? 0,
      volunteers: volunteersCountResult.count ?? 0,
      payments: paymentsCountResult.count ?? 0,
      notifications: notificationsCountResult.count ?? 0,
    },
    reservations: (reservationsResult.data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      totalAmount: Number(row.total_amount ?? 0),
      createdAt: toIsoOrNull(row.created_at),
    })),
    volunteers: (volunteersResult.data ?? []).map((row: any) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      status: row.status,
      dayId: row.day_id,
      userId: row.user_id,
      createdAt: toIsoOrNull(row.created_at),
    })),
    payments: (paymentsResult.data ?? []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      amount: Number(row.amount ?? 0),
      status: row.status,
      paymentMethod: row.payment_method,
      createdAt: toIsoOrNull(row.created_at),
    })),
    notifications: (notificationsResult.data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      status: row.status,
      createdAt: toIsoOrNull(row.created_at),
    })),
  };

  dashboardCache.set(cacheKey, { expiresAt: now + DASHBOARD_CACHE_TTL_MS, payload });

  return { ...payload, cache: 'MISS' as const };
}
