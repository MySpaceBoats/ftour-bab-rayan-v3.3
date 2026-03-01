/**
 * Cloudflare Worker for Ftour Bab Rayan API
 * Handles all /api/* requests using tRPC Fetch adapter
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './routers';
import { createWorkerContext } from './context';
import { handleCMSRequest } from './cms-handlers';
import { createSupabaseAdmin } from './supabase';
import { DEFAULT_RAMADAN_TIMEZONE, getDateStringInTimeZone, getRamadanDay } from '../shared/ramadan';
import { handleCashOrderRequest } from './cash-orders';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  VITE_APP_ID: string;
  NODE_ENV: string;
  // GitHub App credentials for CMS
  GITHUB_APP_ID: string;
  GITHUB_APP_INSTALLATION_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  CMS_ALLOWED_ORIGINS?: string;
  ORDER_PROOF_SECRET?: string;
  PUBLIC_APP_URL?: string;
  CASH_ORDER_ADMIN_CC_EMAIL?: string;
}

/**
 * Ensure exactly OPEN_WINDOW_SIZE Ramadan days are open for volunteer registration
 * at all times, starting from today, until the end of Ramadan.
 *
 * Logic:
 *   1. Fetch all ramadan_days ordered by date ascending.
 *   2. Determine today's date in the Ramadan timezone (Africa/Casablanca).
 *   3. Select the first OPEN_WINDOW_SIZE days whose date >= today and that are
 *      not yet passed.  These are the "target open" days.
 *   4. For every other day (past or beyond the window) ensure is_open = false.
 *   5. For the target days ensure is_open = true.
 */
const OPEN_WINDOW_SIZE = 3;

async function ensureRollingOpenDays(env: Env): Promise<void> {
  const supabase = createSupabaseAdmin(env);

  const { data: days, error } = await supabase
    .from('ramadan_days')
    .select('id, date, is_open')
    .order('date', { ascending: true });

  if (error || !days) {
    console.error('[cron] Failed to fetch ramadan_days:', error?.message);
    return;
  }

  const todayStr = getDateStringInTimeZone(new Date(), DEFAULT_RAMADAN_TIMEZONE);

  // Days whose date >= today, in chronological order
  const upcomingDays = days.filter((d: any) => String(d.date).slice(0, 10) >= todayStr);
  const targetOpenIds = new Set(
    upcomingDays.slice(0, OPEN_WINDOW_SIZE).map((d: any) => d.id)
  );

  const toOpen: number[] = [];
  const toClose: number[] = [];

  for (const day of days as any[]) {
    const shouldBeOpen = targetOpenIds.has(day.id);
    if (shouldBeOpen && !day.is_open) toOpen.push(day.id);
    if (!shouldBeOpen && day.is_open) toClose.push(day.id);
  }

  if (toOpen.length > 0) {
    const { error: openErr } = await supabase
      .from('ramadan_days')
      .update({ is_open: true })
      .in('id', toOpen);
    if (openErr) console.error('[cron] Failed to open days:', openErr.message);
    else console.log('[cron] Opened days:', toOpen);
  }

  if (toClose.length > 0) {
    const { error: closeErr } = await supabase
      .from('ramadan_days')
      .update({ is_open: false })
      .in('id', toClose);
    if (closeErr) console.error('[cron] Failed to close days:', closeErr.message);
    else console.log('[cron] Closed days:', toClose);
  }

  console.log(`[cron] Rolling window done. Today=${todayStr}, open=${[...targetOpenIds]}`);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await ensureRollingOpenDays(env);
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ---- CORS (restrict to allowed origins) ----
    const origin = request.headers.get('Origin') ?? '';
    const allowed = new Set([
      'https://ftourbabrayan.ma',
      'https://www.ftourbabrayan.ma',
      'https://ftour-bab-rayan-v2.pages.dev',
    ]);
    const allowOrigin = allowed.has(origin) ? origin : 'https://ftourbabrayan.ma';

    const baseCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': allowOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: baseCorsHeaders });
    }


    if (url.pathname === '/api/public/ramadan/summary' && request.method === 'GET') {
      const supabase = createSupabaseAdmin(env);
      const { data: config } = await supabase
        .from('ramadan_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      const asOfGregorianDate = getDateStringInTimeZone(new Date(), config?.timezone || DEFAULT_RAMADAN_TIMEZONE);
      let payload: any = {
        hijri_year: null,
        today_ramadan_day: null,
        totals_to_date: { meals: 0, beneficiaries: 0, volunteers_presence: 0 },
        as_of_gregorian_date: asOfGregorianDate,
      };

      if (config) {
        const rawDay = getRamadanDay(asOfGregorianDate, config.gregorian_start_date);
        const todayRamadanDay = rawDay === null ? null : Math.min(rawDay, 30);

        let q = supabase
          .from('ramadan_daily_stats')
          .select('beneficiaries_served, meals_distributed, volunteers_present')
          .eq('config_id', config.id);
        if (todayRamadanDay !== null) q = q.lte('ramadan_day', todayRamadanDay);
        const { data: rows } = await q;
        const totals = (rows || []).reduce((acc: any, row: any) => {
          acc.meals += row.meals_distributed || 0;
          acc.beneficiaries += row.beneficiaries_served || 0;
          acc.volunteers_presence += row.volunteers_present || 0;
          return acc;
        }, { meals: 0, beneficiaries: 0, volunteers_presence: 0 });

        payload = {
          hijri_year: config.hijri_year,
          today_ramadan_day: todayRamadanDay,
          totals_to_date: totals,
          as_of_gregorian_date: asOfGregorianDate,
        };
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          ...baseCorsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      });
    }

    // Handle CMS API requests (must be before tRPC)
    if (url.pathname.startsWith('/api/cms')) {
      const cmsPath = url.pathname.substring(8); // Remove '/api/cms'
      const response = await handleCMSRequest(request, env, cmsPath);
      
      // Merge CORS headers
      const newHeaders = new Headers(response.headers);
      Object.entries(baseCorsHeaders).forEach(([key, value]) => {
        if (!newHeaders.has(key)) {
          newHeaders.set(key, value);
        }
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    if (url.pathname === '/api/catalog' || url.pathname.startsWith('/api/orders') || url.pathname.startsWith('/api/proof/')) {
      const response = await handleCashOrderRequest(request, env);
      if (response) {
        const newHeaders = new Headers(response.headers);
        Object.entries(baseCorsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
    }

    // Handle tRPC API requests
    if (url.pathname.startsWith('/api/trpc')) {
      const response = await fetchRequestHandler({
        endpoint: '/api/trpc',
        req: request,
        router: appRouter,
        createContext: () => createWorkerContext(request, env),
        onError: ({ error, path }) => {
          console.error(`[tRPC Error] ${path}:`, error.message);
        },
      });

      // Merge CORS headers into tRPC response
      const newHeaders = new Headers(response.headers);
      Object.entries(baseCorsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
