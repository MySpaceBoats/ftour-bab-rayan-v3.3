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
import { handleMemberCardRequest } from './member-cards';
import { sendEmail } from './email';
import * as hubNotify from './hub-notify';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY?: string;
  EMAIL_PROVIDER_KEY?: string;
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
  RESERVATION_PROOF_TOKEN_TTL_DAYS?: string;
  RESERVATION_PAYMENT_PROOF_BUCKET?: string;
  RESERVATION_ADMIN_DASHBOARD_URL?: string;
  // Gallery: Cloudflare D1 (rows) + R2 (image bytes)
  DB?: D1Like;
  /** Overrides d1-tables.ts: comma list of Supabase tables served from D1, or "none" (instant rollback lever). */
  D1_TABLES?: string;
  /** Overrides d1-tables.ts R2_BUCKETS: Supabase Storage buckets served from R2, or "none". */
  R2_BUCKETS?: string;
  /** Public origin of this Worker for /media URLs (default: its workers.dev URL, see media-r2.ts). */
  MEDIA_BASE_URL?: string;
  GALLERY_MEDIA?: R2Like;
}

import type { D1Like, R2Like } from './gallery-d1';
import { handleMediaRequest } from './media-r2';
import { handleHubRequest } from './hub';

const MAX_PROOF_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
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
    // Volunteer reminders for the next Casablanca day. The cron fires at 23:05 UTC and Morocco is UTC+0 during
    // Ramadan, UTC+1 otherwise, so +3 h always lands on the upcoming Casablanca day.
    try {
      if (env.DB) {
        const tomorrow = getDateStringInTimeZone(new Date(Date.now() + 3 * 3600_000), DEFAULT_RAMADAN_TIMEZONE);
        const n = await hubNotify.remindVolunteers(env.DB, hubNotify.mailerFromEnv(env), tomorrow, Date.now());
        console.log(`[cron] hub reminders for ${tomorrow}: ${n}`);
      }
    } catch (e) {
      console.error('[cron] hub reminders failed', e);
    }
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


    // Media served from R2 (public /media, signed /media-signed, signed uploads /media-upload)
    const media = await handleMediaRequest(request, env, baseCorsHeaders);
    if (media) return media;

    // Volunteer hub REST API (/hub/*)
    const hub = await handleHubRequest(request, env, baseCorsHeaders, { waitUntil: (p) => ctx.waitUntil(p) });
    if (hub) return hub;

    if (url.pathname === '/api/reservations/proof/init' && request.method === 'POST') {
      const supabase = createSupabaseAdmin(env);
      const body = await request.json().catch(() => ({} as any));
      const reservationId = body?.reservation_id ? Number(body.reservation_id) : null;
      const reservationRef = typeof body?.reservation_ref === 'string' ? body.reservation_ref : null;

      let query = supabase.from('restaurant_reservations').select('id, reference').limit(1);
      if (reservationId) query = query.eq('id', reservationId);
      else if (reservationRef) query = query.eq('reference', reservationRef);
      else return jsonResponse({ success: false, message: 'reservation_id ou reservation_ref requis' }, 400);

      const { data: reservation, error } = await query.single();
      if (error || !reservation) return jsonResponse({ success: false, message: 'Réservation introuvable' }, 404);

      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const rawToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
      const tokenHash = await sha256Hex(rawToken);
      const ttlDays = Math.max(1, Number(env.RESERVATION_PROOF_TOKEN_TTL_DAYS || '7'));
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase.from('reservation_payment_tokens').insert({
        reservation_id: reservation.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (insertErr) return jsonResponse({ success: false, message: 'Impossible de créer le token' }, 500);

      const baseUrl = (env.PUBLIC_APP_URL || 'https://www.ftourbabrayan.ma').replace(/\/$/, '');
      return jsonResponse({
        success: true,
        link: `${baseUrl}/reservations/preuve?token=${encodeURIComponent(rawToken)}`,
        expires_at: expiresAt,
      });
    }

    // Reservation payment proof public API
    if (url.pathname === '/api/reservations/proof/verify' && request.method === 'GET') {
      const token = url.searchParams.get('token')?.trim();
      if (!token) {
        return jsonResponse({ valid: false, message: 'Lien invalide' }, 400);
      }
      const supabase = createSupabaseAdmin(env);
      const tokenHash = await sha256Hex(token);
      const { data: tokenRow, error: tokenErr } = await supabase
        .from('reservation_payment_tokens')
        .select('id, reservation_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (tokenErr || !tokenRow) {
        return jsonResponse({ valid: false, message: 'Lien invalide ou expiré' }, 404);
      }
      const isExpired = new Date(tokenRow.expires_at).getTime() < Date.now();
      if (tokenRow.used_at || isExpired) {
        return jsonResponse({ valid: false, message: 'Lien invalide ou expiré' }, 400);
      }

      const { data: reservation } = await supabase
        .from('restaurant_reservations')
        .select('reference, deposit_deadline, deposit, email')
        .eq('id', tokenRow.reservation_id)
        .single();

      return jsonResponse({
        valid: true,
        reservation_ref: reservation?.reference,
        due_date: reservation?.deposit_deadline ?? null,
        amount: reservation?.deposit ?? null,
        email: reservation?.email ?? null,
      });
    }

    if (url.pathname === '/api/reservations/proof/upload' && request.method === 'POST') {
      const supabase = createSupabaseAdmin(env);
      const form = await request.formData();
      const token = String(form.get('token') || '').trim();
      const note = String(form.get('note') || '').trim();
      const file = form.get('file');

      if (!token || !(file instanceof File)) {
        return jsonResponse({ success: false, message: 'Token ou fichier manquant' }, 400);
      }

      if (!ALLOWED_PROOF_TYPES.has(file.type)) {
        return jsonResponse({ success: false, message: 'Format fichier non autorisé (pdf/jpg/png)' }, 400);
      }
      if (file.size > MAX_PROOF_FILE_BYTES) {
        return jsonResponse({ success: false, message: 'Fichier trop volumineux (max 10MB)' }, 400);
      }

      const tokenHash = await sha256Hex(token);
      const { data: tokenRow, error: tokenErr } = await supabase
        .from('reservation_payment_tokens')
        .select('id, reservation_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (tokenErr || !tokenRow) return jsonResponse({ success: false, message: 'Lien invalide ou expiré' }, 404);
      if (tokenRow.used_at || new Date(tokenRow.expires_at).getTime() < Date.now()) {
        return jsonResponse({ success: false, message: 'Lien invalide ou expiré' }, 400);
      }

      const { data: reservation, error: reservationError } = await supabase
        .from('restaurant_reservations')
        .select('id, reference, name, email')
        .eq('id', tokenRow.reservation_id)
        .single();
      if (reservationError || !reservation) return jsonResponse({ success: false, message: 'Réservation introuvable' }, 404);

      const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
      const bucket = env.RESERVATION_PAYMENT_PROOF_BUCKET || 'reservation-payment-proofs';
      const path = `reservation/${reservation.reference}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, await file.arrayBuffer(), {
          contentType: file.type,
          upsert: false,
        });
      if (uploadErr) return jsonResponse({ success: false, message: 'Échec upload fichier' }, 500);

      await supabase.from('reservation_payment_proofs').insert({
        reservation_id: reservation.id,
        storage_path: path,
        uploaded_by_email: reservation.email,
        admin_note: note || null,
      });

      await supabase.from('reservation_payment_tokens').update({ used_at: new Date().toISOString() }).eq('id', tokenRow.id);

      await supabase.from('restaurant_reservations').update({
        status: 'deposit_submitted',
        updated_at: new Date().toISOString(),
      }).eq('id', reservation.id);

      await supabase.from('reservation_events').insert({
        reservation_id: reservation.id,
        event_type: 'deposit_proof_submitted',
        payload: { storage_path: path },
      });

      const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);
      const dashboardUrl = env.RESERVATION_ADMIN_DASHBOARD_URL || `${(env.PUBLIC_APP_URL || 'https://www.ftourbabrayan.ma').replace(/\/$/, '')}/admin/restaurant/groupes`;
      const uploadedAt = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca', dateStyle: 'full', timeStyle: 'short' });
      const proofLink = signed.data?.signedUrl ? `<p style="margin:16px 0"><a href="${signed.data.signedUrl}" style="background:#15803d;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">📎 Consulter la preuve de virement</a></p>` : '';
      const adminNotifHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
<h2 style="color:#15803d">🔔 Nouvelle preuve d'acompte reçue</h2>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px;background:#f0fdf4;font-weight:600;width:40%">Référence</td><td style="padding:8px;background:#f0fdf4">${reservation.reference}</td></tr>
<tr><td style="padding:8px;font-weight:600">Nom</td><td style="padding:8px">${reservation.name}</td></tr>
<tr><td style="padding:8px;background:#f0fdf4;font-weight:600">Email client</td><td style="padding:8px;background:#f0fdf4">${reservation.email}</td></tr>
<tr><td style="padding:8px;font-weight:600">Date de dépôt</td><td style="padding:8px">${uploadedAt}</td></tr>
${note ? `<tr><td style="padding:8px;background:#f0fdf4;font-weight:600">Note</td><td style="padding:8px;background:#f0fdf4">${note}</td></tr>` : ''}
</table>
${proofLink}
<p style="margin:16px 0"><a href="${dashboardUrl}" style="color:#15803d">Ouvrir le tableau de bord des réservations</a></p>
<p style="color:#374151;font-size:14px">Veuillez vérifier le virement et mettre à jour le statut dans le tableau de bord.</p>
</div>`;

      // Notification à tous les admins (Hind, Reda restaurant, Nayla, La Table du Jardin)
      const adminRecipients = [
        'ratibehind3@gmail.com',
        'restaurantbabrayan@ftourbabrayan.ma',
        'naylabennani@hotmail.com',
        'dir.cfi@babrayan.ma',
      ];
      const apiKey = env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "";
      for (const adminEmail of adminRecipients) {
        await sendEmail({
          to: adminEmail,
          apiKey,
          subject: `🔔 Preuve d'acompte reçue — [${reservation.reference}] — ${reservation.name}`,
          html: adminNotifHtml,
        }).catch(err => console.error('[proof/upload] Failed to notify admin', adminEmail, err));
      }

      // Email de confirmation au client
      const clientConfirmHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff">
<div style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);padding:30px;text-align:center;border-radius:8px 8px 0 0">
  <h1 style="color:#fff;margin:0;font-size:26px">La Table du Jardin — <span style="color:#fbbf24">Ftour Bab Rayan</span></h1>
</div>
<div style="padding:32px 24px">
  <h2 style="color:#166534;margin:0 0 16px">Preuve d'acompte reçue ✅</h2>
  <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px">Nous avons bien reçu votre preuve de virement pour la réservation <strong>${reservation.reference}</strong>.</p>
  <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0">
    <p style="margin:0;color:#374151;font-size:15px;line-height:1.6">Notre équipe va vérifier votre virement dans les plus brefs délais. Vous recevrez un email de confirmation définitive dès validation de votre paiement.</p>
  </div>
  <p style="color:#374151;font-size:15px;line-height:1.6;margin:16px 0">Pour toute question, contactez-nous à <a href="mailto:contact@ftourbabrayan.ma" style="color:#166534">contact@ftourbabrayan.ma</a>.</p>
  <p style="color:#374151;font-size:16px;line-height:1.6;margin:16px 0 0">Merci pour votre confiance.<br><strong>L'équipe La Table du Jardin — Ftour Bab Rayan</strong></p>
</div>
<div style="background:#f8f9fa;padding:16px 24px;text-align:center;border-radius:0 0 8px 8px;border-top:1px solid #e5e7eb">
  <p style="margin:0;font-size:12px;color:#9ca3af">Association Bab Rayan — 4 rue Bayt Lahm, quartier Palmier, Casablanca<br>Tél: +212 (0) 666-690534 | contact@ftourbabrayan.ma</p>
</div>
</div>`;
      await sendEmail({
        to: reservation.email,
        apiKey,
        subject: `Preuve d'acompte reçue — Réf. ${reservation.reference}`,
        html: clientConfirmHtml,
      }).catch(err => console.error('[proof/upload] Failed to send client confirmation', err));

      return jsonResponse({ success: true });
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

    const memberCardResponse = await handleMemberCardRequest(request, env);
    if (memberCardResponse) {
      const newHeaders = new Headers(memberCardResponse.headers);
      Object.entries(baseCorsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(memberCardResponse.body, {
        status: memberCardResponse.status,
        statusText: memberCardResponse.statusText,
        headers: newHeaders,
      });
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
