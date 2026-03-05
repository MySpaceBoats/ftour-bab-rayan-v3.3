import { z } from 'zod';
import { createSupabaseAdmin } from './supabase';
import { sendEmail } from './email';
import type { Env } from './index';
import { createWorkerContext } from './context';
import { DONATION_SUGGESTED_AMOUNTS_MAD } from '../shared/const';

const orderItemSchema = z.object({
  productId: z.number().int().positive().nullable().optional(),
  name: z.string().min(1).max(200),
  qty: z.number().int().min(1).max(50),
  unitPriceMad: z.number().int().min(1).max(100000),
  type: z.enum(['GOODIE', 'PASTRY', 'TERROIR', 'DONATION']),
  meta: z.record(z.any()).optional(),
});

const createOrderSchema = z.object({
  customer: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().max(320),
    phone: z.string().min(6).max(25).optional().nullable(),
    acceptedTerms: z.boolean().optional().default(true),
  }),
  items: z.array(orderItemSchema).min(1).max(100),
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getClientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
}

function toYyyymmdd(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}${m}${d}`;
}

function randomSuffix(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildProofToken(secret: string, reference: string, createdAtIso: string): Promise<string> {
  const sig = await hmacHex(secret, `${reference}|${createdAtIso}`);
  return sig.slice(0, 24);
}

export async function handleCashOrderRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const supabase = createSupabaseAdmin(env);

  const fetchAllRows = async (
    table: string,
    select: string,
    options?: {
      filters?: (query: any) => any;
      orderBy?: { column: string; ascending?: boolean };
      chunkSize?: number;
    },
  ) => {
    const chunkSize = options?.chunkSize ?? 1000;
    const allRows: any[] = [];
    let from = 0;

    while (true) {
      let query = supabase.from(table).select(select);
      if (options?.filters) {
        query = options.filters(query);
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
      }

      const { data, error } = await query.range(from, from + chunkSize - 1);
      if (error) {
        return { data: [] as any[], error };
      }

      const rows = data || [];
      allRows.push(...rows);

      if (rows.length < chunkSize) {
        break;
      }
      from += chunkSize;
    }

    return { data: allRows, error: null };
  };

  if (url.pathname === '/api/catalog' && request.method === 'GET') {
    const [goodiesRes, pastriesRes, terroirJoinRes, donationProductsRes] = await Promise.all([
      fetchAllRows('goodies', 'id,name,description,price,image_url,is_active,sort_order', {
        filters: (query) => query.eq('is_active', true),
        orderBy: { column: 'sort_order', ascending: true },
      }),
      fetchAllRows('pastries', 'id,name,description,price,image_url,active,is_active,sort_order', {
        orderBy: { column: 'sort_order', ascending: true },
      }),
      fetchAllRows(
        'terroir_products',
        'id,name,description,image_url,is_active,sort_order,terroir_product_variants(id,label,price_unit,is_active)',
        {
          filters: (query) => query.eq('is_active', true),
          orderBy: { column: 'sort_order', ascending: true },
        },
      ),
      fetchAllRows('products', 'id,name,price_mad,active', {
        filters: (query) => query.eq('type', 'DONATION'),
      }),
    ]);

    const donationProducts = donationProductsRes.error ? [] : (donationProductsRes.data || []);

    const goodies = goodiesRes.error ? [] : (goodiesRes.data || []);
    const pastries = pastriesRes.error
      ? []
      : (pastriesRes.data || []).filter((p: any) => (typeof p.active === 'boolean' ? p.active : p.is_active !== false));

    let terroirProducts = terroirJoinRes.error ? [] : (terroirJoinRes.data || []);
    if (terroirJoinRes.error) {
      const terroirProductsRes = await fetchAllRows('terroir_products', 'id,name,description,image_url,is_active,sort_order', {
        filters: (query) => query.eq('is_active', true),
        orderBy: { column: 'sort_order', ascending: true },
      });

      if (!terroirProductsRes.error && (terroirProductsRes.data || []).length > 0) {
        const productIds = (terroirProductsRes.data || []).map((p: any) => p.id);
        const terroirVariantsRes = await fetchAllRows('terroir_product_variants', 'id,product_id,label,price_unit,is_active', {
          filters: (query) => query.in('product_id', productIds).eq('is_active', true),
        });

        if (!terroirVariantsRes.error) {
          const variantsByProductId = (terroirVariantsRes.data || []).reduce((acc: Record<number, any[]>, variant: any) => {
            if (!acc[variant.product_id]) {
              acc[variant.product_id] = [];
            }
            acc[variant.product_id].push(variant);
            return acc;
          }, {});

          terroirProducts = (terroirProductsRes.data || []).map((product: any) => ({
            ...product,
            terroir_product_variants: variantsByProductId[product.id] || [],
          }));
        }
      }
    }

    const mapItem = (item: any, type: 'GOODIE' | 'PASTRY' | 'TERROIR') => ({
      id: `${type}-${item.id}`,
      sourceId: item.id,
      type,
      name: item.name,
      description: item.description || '',
      priceMad: Math.round(Number(item.price || 0)),
      imageUrl: item.image_url || null,
    });

    const terroir = terroirProducts.flatMap((product: any) =>
      (product.terroir_product_variants || [])
        .filter((variant: any) => variant.is_active !== false)
        .map((variant: any) => ({
          id: `TERROIR-${product.id}-${variant.id}`,
          sourceId: product.id,
          type: 'TERROIR' as const,
          name: `${product.name}${variant.label ? ` - ${variant.label}` : ''}`,
          description: product.description || '',
          priceMad: Math.round(Number(variant.price_unit || 0)),
          imageUrl: product.image_url || null,
          variantId: variant.id,
        })),
    );

    return jsonResponse({
      goodies: goodies.map((i) => mapItem(i, 'GOODIE')),
      pastries: pastries.map((i) => mapItem(i, 'PASTRY')),
      terroir,
      donations: {
        presets: donationProducts
          .filter((d: any) => d.active !== false)
          .map((d: any) => Number(d.price_mad))
          .filter((v: number) => Number.isFinite(v) && v > 0)
          .sort((a: number, b: number) => a - b)
          .reduce((acc: number[], v: number) => (acc.includes(v) ? acc : [...acc, v]), [])
          .concat(
            [...DONATION_SUGGESTED_AMOUNTS_MAD].filter(
              (v) => !donationProducts.some((d: any) => Number(d.price_mad) === v && d.active !== false),
            ),
          ),
      },
    });
  }

  if (url.pathname === '/api/orders' && request.method === 'POST') {
    const ip = getClientIp(request);
    const windowStart = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabase
      .from('cash_order_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', windowStart);

    if ((count || 0) >= 10) {
      return jsonResponse({ error: 'Trop de tentatives. Merci de réessayer plus tard.' }, 429);
    }

    await supabase.from('cash_order_rate_limits').insert({ ip });

    const body = await request.json().catch(() => null);
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: 'Payload invalide', issues: parsed.error.issues }, 400);
    }
    const { customer, items } = parsed.data;
    if (!customer.acceptedTerms) {
      return jsonResponse({ error: 'Veuillez accepter les conditions.' }, 400);
    }

    const reference = `BR-${toYyyymmdd()}-${randomSuffix(6)}`;
    const createdAt = new Date().toISOString();
    const totalMad = items.reduce((sum, item) => sum + item.unitPriceMad * item.qty, 0);
    const proofToken = await buildProofToken(env.ORDER_PROOF_SECRET || env.JWT_SECRET, reference, createdAt);

    const orderInsert = await supabase
      .from('cash_orders')
      .insert({
        reference,
        status: 'PENDING_CASH',
        customer_first_name: customer.firstName,
        customer_last_name: customer.lastName,
        customer_email: customer.email,
        customer_phone: customer.phone || null,
        currency: 'MAD',
        total_mad: totalMad,
        proof_token: proofToken,
        created_at: createdAt,
      })
      .select('id')
      .single();

    if (orderInsert.error || !orderInsert.data) {
      return jsonResponse({ error: orderInsert.error?.message || 'order_create_failed' }, 500);
    }

    const orderId = orderInsert.data.id;

    const itemInserts = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId || null,
      name_snapshot: item.name,
      unit_price_mad: item.unitPriceMad,
      qty: item.qty,
      type_snapshot: item.type,
      meta: item.meta || {},
    }));

    const itemInsertRes = await supabase.from('cash_order_items').insert(itemInserts);
    if (itemInsertRes.error) {
      return jsonResponse({ error: itemInsertRes.error.message }, 500);
    }

    await supabase.from('cash_order_events').insert({ order_id: orderId, event_type: 'CREATED', actor: 'public' });

    const appUrl = env.PUBLIC_APP_URL || 'https://ftourbabrayan.ma';
    const lines = items.map((item) => `<li>${item.name} x${item.qty} — ${item.unitPriceMad * item.qty} MAD</li>`).join('');
    const html = `
      <h2>Confirmation de votre commande – Association Bab Rayan</h2>
      <p>Bonjour ${customer.firstName} ${customer.lastName},</p>
      <p>Votre commande en espèces est enregistrée.</p>
      <p><strong>Référence :</strong> ${reference}</p>
      <p><strong>Date :</strong> ${new Date(createdAt).toLocaleString('fr-FR')}</p>
      <p><strong>Total :</strong> ${totalMad} MAD</p>
      <ul>${lines}</ul>
      <p>Présentez cette référence à l'hôtesse pour retirer votre commande.</p>
      <p>Preuve: <a href="${appUrl}/proof/${reference}?t=${proofToken}">${appUrl}/proof/${reference}?t=${proofToken}</a></p>
    `;

    await sendEmail({
      to: customer.email,
      subject: 'Confirmation de votre commande – Association Bab Rayan',
      html,
      apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "",
      ...(env.CASH_ORDER_ADMIN_CC_EMAIL ? { cc: [env.CASH_ORDER_ADMIN_CC_EMAIL] } : {}),
    });

    return jsonResponse({ reference, orderId, proofToken });
  }

  const proofMatch = url.pathname.match(/^\/api\/proof\/([A-Z0-9-]+)$/);
  if (proofMatch && request.method === 'GET') {
    const reference = proofMatch[1];
    const token = url.searchParams.get('t') || '';
    const { data } = await supabase
      .from('cash_orders')
      .select('reference,status,total_mad,created_at,cash_order_items(name_snapshot,qty,unit_price_mad,type_snapshot)')
      .eq('reference', reference)
      .eq('proof_token', token)
      .single();

    if (!data) return jsonResponse({ error: 'Preuve invalide' }, 404);

    return jsonResponse({
      reference: data.reference,
      status: data.status,
      totalMad: data.total_mad,
      createdAt: data.created_at,
      items: data.cash_order_items,
    });
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([A-Z0-9-]+)$/);
  if (orderMatch && request.method === 'GET') {
    const reference = orderMatch[1];
    const token = url.searchParams.get('t');
    if (!token) {
      const ctx = await createWorkerContext(request, env);
      const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'scanner', 'admin_boutique'];
      if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    let q = supabase
      .from('cash_orders')
      .select('id,reference,status,customer_first_name,customer_last_name,total_mad,created_at,proof_token,cash_order_items(name_snapshot,qty,unit_price_mad,type_snapshot)')
      .eq('reference', reference);
    if (token) q = q.eq('proof_token', token);
    const { data } = await q.single();
    if (!data) return jsonResponse({ error: 'Commande introuvable' }, 404);

    return jsonResponse(data);
  }

  const fulfillMatch = url.pathname.match(/^\/api\/orders\/([A-Z0-9-]+)\/fulfill$/);
  if (fulfillMatch && request.method === 'POST') {
    const ctx = await createWorkerContext(request, env);
    const allowedRoles = ['admin', 'super_admin', 'admin_ops', 'scanner', 'admin_boutique'];
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const reference = fulfillMatch[1];
    const upd = await supabase
      .from('cash_orders')
      .update({ status: 'FULFILLED', fulfilled_at: new Date().toISOString() })
      .eq('reference', reference)
      .select('id,reference,status')
      .single();

    if (upd.error || !upd.data) return jsonResponse({ error: upd.error?.message || 'not_found' }, 404);
    await supabase.from('cash_order_events').insert({ order_id: upd.data.id, event_type: 'FULFILLED', actor: `user:${ctx.user.id}` });

    return jsonResponse({ ok: true, order: upd.data });
  }

  return null;
}

export const __internal = { randomSuffix, toYyyymmdd, buildProofToken };
