import { z } from 'zod';
import type { Env } from './index';

// "Monde" sub-shop: products live from Printify, paid via Stripe Checkout, fulfilled by Printify.
// Stateless on purpose (no DB): Printify is the catalogue, Stripe metadata carries the cart.
// Shipping is baked into Printify variant prices (same convention as The Mandala Atlas).

type MondeEnv = Env & {
  PRINTIFY_API_TOKEN?: string;
  PRINTIFY_SHOP_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Stripe/Printify price currency (Printify prices are minor units of the shop currency). Default eur. */
  MONDE_CURRENCY?: string;
  /** "true" = create Printify orders as drafts instead of sending to production. */
  MONDE_DRAFT_ONLY?: string;
};

const PRINTIFY = 'https://api.printify.com/v1';
const SHIP_COUNTRIES = ['MA', 'FR', 'BE', 'NL', 'DE', 'ES', 'IT', 'GB', 'CH', 'CA', 'US', 'AE', 'SA'];

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });

async function printify<T>(env: MondeEnv, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PRINTIFY}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Printify ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

interface PfProduct {
  id: string;
  title: string;
  description: string;
  visible: boolean;
  images: { src: string; is_default: boolean }[];
  variants: { id: number; title: string; price: number; is_enabled: boolean }[];
}

async function listProducts(env: MondeEnv): Promise<PfProduct[]> {
  const out: PfProduct[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await printify<{ data: PfProduct[]; last_page: number }>(
      env,
      `/shops/${env.PRINTIFY_SHOP_ID}/products.json?limit=50&page=${page}`,
    );
    out.push(...res.data);
    if (page >= res.last_page) break;
  }
  return out.filter((p) => p.visible);
}

function toPublic(p: PfProduct) {
  const variants = p.variants.filter((v) => v.is_enabled).map((v) => ({ id: v.id, title: v.title, price: v.price }));
  return {
    id: p.id,
    title: p.title,
    description: p.description.replace(/<[^>]*>/g, '').slice(0, 400),
    image: (p.images.find((i) => i.is_default) ?? p.images[0])?.src ?? null,
    variants,
  };
}

const checkoutSchema = z.object({
  email: z.string().email().max(320).optional(),
  lang: z.enum(['fr', 'en', 'ar', 'amz']).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        variantId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
});

async function stripeForm(env: MondeEnv, path: string, params: [string, string][]) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? 'unknown'}`);
  return data;
}

async function handleCheckout(request: Request, env: MondeEnv): Promise<Response> {
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid request.' }, 400);
  const { items, email, lang } = parsed.data;

  // Prices come from Printify, never from the client.
  const catalogue = new Map((await listProducts(env)).map((p) => [p.id, p]));
  const currency = (env.MONDE_CURRENCY || 'eur').toLowerCase();
  const params: [string, string][] = [
    ['mode', 'payment'],
    ['success_url', `${env.PUBLIC_APP_URL ?? new URL(request.url).origin}/${lang ?? 'fr'}/commerce-solidaire?monde=success`],
    ['cancel_url', `${env.PUBLIC_APP_URL ?? new URL(request.url).origin}/${lang ?? 'fr'}/commerce-solidaire?monde=cancel`],
    ['billing_address_collection', 'auto'],
    ['phone_number_collection[enabled]', 'true'],
  ];
  SHIP_COUNTRIES.forEach((c, i) => params.push([`shipping_address_collection[allowed_countries][${i}]`, c]));
  if (email) params.push(['customer_email', email]);

  const lines: { p: string; v: number; q: number }[] = [];
  for (const [i, item] of items.entries()) {
    const product = catalogue.get(item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId && v.is_enabled);
    if (!product || !variant) return json({ error: 'Un article n’est plus disponible.' }, 409);
    lines.push({ p: product.id, v: variant.id, q: item.quantity });
    params.push(
      [`line_items[${i}][quantity]`, String(item.quantity)],
      [`line_items[${i}][price_data][currency]`, currency],
      [`line_items[${i}][price_data][unit_amount]`, String(variant.price)],
      [`line_items[${i}][price_data][product_data][name]`, `${product.title} — ${variant.title}`.slice(0, 250)],
    );
    const img = product.images[0]?.src;
    if (img) params.push([`line_items[${i}][price_data][product_data][images][0]`, img]);
  }
  params.push(['metadata[monde_lines]', JSON.stringify(lines)]);
  if (JSON.stringify(lines).length > 500) return json({ error: 'Panier trop volumineux.' }, 400);

  try {
    const session = await stripeForm(env, '/checkout/sessions', params);
    return json({ url: session.url });
  } catch (e) {
    console.error('monde checkout failed', e);
    return json({ error: 'Paiement indisponible.' }, 502);
  }
}

async function verifyStripeSignature(secret: string, payload: string, header: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = parts.t;
  const v1 = header.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!t || v1.length === 0 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1.includes(hex);
}

async function handleWebhook(request: Request, env: MondeEnv): Promise<Response> {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig || !env.STRIPE_WEBHOOK_SECRET || !(await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, payload, sig))) {
    return json({ error: 'Invalid signature.' }, 400);
  }

  const event = JSON.parse(payload);
  const s = event?.data?.object;
  // Other Stripe webhooks on the same account may hit this endpoint: only act on Monde sessions.
  if (event.type !== 'checkout.session.completed' || s?.payment_status !== 'paid' || !s?.metadata?.monde_lines) {
    return json({ received: true });
  }

  const ship = s.collected_information?.shipping_details ?? s.shipping_details;
  const addr = ship?.address;
  const [first, ...rest] = String(ship?.name ?? s.customer_details?.name ?? 'Client').split(' ');
  if (!addr?.line1) {
    console.error('monde: paid session without shipping address', s.id);
    return json({ error: 'No shipping address.' }, 422);
  }

  try {
    const lines = JSON.parse(s.metadata.monde_lines) as { p: string; v: number; q: number }[];
    const order = await printify<{ id: string }>(env, `/shops/${env.PRINTIFY_SHOP_ID}/orders.json`, {
      method: 'POST',
      body: JSON.stringify({
        external_id: s.id,
        label: s.id,
        line_items: lines.map((l) => ({ product_id: l.p, variant_id: l.v, quantity: l.q })),
        shipping_method: 1,
        send_shipping_notification: true,
        address_to: {
          first_name: first,
          last_name: rest.join(' ') || '-',
          email: s.customer_details?.email ?? '',
          phone: s.customer_details?.phone ?? '',
          country: addr.country,
          region: addr.state ?? '',
          address1: addr.line1,
          address2: addr.line2 ?? '',
          city: addr.city,
          zip: addr.postal_code,
        },
      }),
    });
    if (env.MONDE_DRAFT_ONLY !== 'true') {
      await printify(env, `/shops/${env.PRINTIFY_SHOP_ID}/orders/${order.id}/send_to_production.json`, { method: 'POST' });
    }
  } catch (e) {
    // 500 => Stripe retries the event. Payment is already captured, so never swallow this.
    console.error('monde: printify order failed', s.id, e);
    return json({ error: 'Fulfilment failed.' }, 500);
  }
  return json({ received: true });
}

/** Returns null when the path isn't a /api/monde route. */
export async function handleMondeRequest(request: Request, env: Env): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith('/api/monde/')) return null;
  const e = env as MondeEnv;
  if (!e.PRINTIFY_API_TOKEN || !e.PRINTIFY_SHOP_ID || !e.STRIPE_SECRET_KEY) return json({ error: 'Monde shop not configured.' }, 503);

  try {
    if (pathname === '/api/monde/products' && request.method === 'GET') {
      return json({ currency: (e.MONDE_CURRENCY || 'eur').toUpperCase(), products: (await listProducts(e)).map(toPublic).filter((p) => p.variants.length > 0) }, 200, {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      });
    }
    if (pathname === '/api/monde/checkout' && request.method === 'POST') return await handleCheckout(request, e);
    if (pathname === '/api/monde/webhook' && request.method === 'POST') return await handleWebhook(request, e);
  } catch (err) {
    console.error('monde error', err);
    return json({ error: 'Service indisponible.' }, 502);
  }
  return json({ error: 'Not found.' }, 404);
}
