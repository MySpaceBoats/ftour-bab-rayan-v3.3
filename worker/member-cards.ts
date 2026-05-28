import type { Env } from './index';
import { createSupabaseAdmin } from './supabase';
import { sendEmail } from './email';
import { buildOrderEmail, buildPaymentEmail } from './member-card-emails';

type CardStatus =
  | 'INSCRIT'
  | 'MAIL_COMMANDE_ENVOYE'
  | 'CARTE_DEMANDEE'
  | 'MAIL_PAIEMENT_ENVOYE'
  | 'PAIEMENT_RECU'
  | 'A_IMPRIMER'
  | 'IMPRIMEE'
  | 'LIVREE';

const STATUS_ORDER: CardStatus[] = [
  'INSCRIT',
  'MAIL_COMMANDE_ENVOYE',
  'CARTE_DEMANDEE',
  'MAIL_PAIEMENT_ENVOYE',
  'PAIEMENT_RECU',
  'A_IMPRIMER',
  'IMPRIMEE',
  'LIVREE',
];

const ALLOWED_ROLES = new Set([
  'admin','super_admin','admin_ops','admin_operations','admin_boutique','admin_dons','admin_restaurant','admin_patisserie','admin_terroir'
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png']);

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function cardPage(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Carte Membre – Ftour Bab Rayan</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:24px 16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827}
    .card{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)}
    .hdr{background:linear-gradient(135deg,#166534 0%,#15803d 100%);padding:22px 28px;text-align:center;color:#fff}
    .hdr h1{margin:0;font-size:20px;font-weight:700}
    .hdr p{margin:4px 0 0;font-size:13px;color:#bbf7d0}
    .body{padding:28px}
    .ftr{background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280}
    .ftr a{color:#166534;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <h1>Ftour Bab Rayan</h1>
      <p>Carte Membre</p>
    </div>
    <div class="body">${content}</div>
    <div class="ftr">
      Association Bab Rayan – Casablanca, Maroc<br/>
      <a href="mailto:contact@ftourbabrayan.ma">contact@ftourbabrayan.ma</a>
    </div>
  </div>
</body>
</html>`;
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function canAdvance(current: CardStatus, target: CardStatus): boolean {
  return STATUS_ORDER.indexOf(target) >= STATUS_ORDER.indexOf(current);
}

export function isTokenExpired(expiresAtIso: string, nowTs = Date.now()): boolean {
  return new Date(expiresAtIso).getTime() < nowTs;
}

async function requireAdmin(request: Request, env: Env): Promise<{ok: true} | {ok: false; response: Response}> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: json({ error: 'unauthorized' }, 401) };
  }
  const token = authHeader.substring(7);
  const supabase = createSupabaseAdmin(env);
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes.user) return { ok: false, response: json({ error: 'unauthorized' }, 401) };

  const { data: dbUser } = await supabase.from('users').select('role').eq('open_id', userRes.user.id).maybeSingle();
  if (!dbUser || !ALLOWED_ROLES.has(dbUser.role)) return { ok: false, response: json({ error: 'forbidden' }, 403) };
  return { ok: true };
}

async function createToken(orderId: number, type: 'order' | 'payment', env: Env): Promise<string> {
  const supabase = createSupabaseAdmin(env);
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString();
  await supabase.from('member_card_tokens').insert({ order_id: orderId, type, token_hash: tokenHash, expires_at: expiresAt });
  return token;
}

async function logEvent(orderId: number, eventType: string, payload: any, env: Env): Promise<void> {
  const supabase = createSupabaseAdmin(env);
  await supabase.from('member_card_events').insert({ order_id: orderId, event_type: eventType, payload });
}

async function verifyToken(rawToken: string, type: 'order' | 'payment', env: Env) {
  const supabase = createSupabaseAdmin(env);
  const tokenHash = await sha256(rawToken);
  const { data: row } = await supabase
    .from('member_card_tokens')
    .select('id, order_id, type, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .eq('type', type)
    .maybeSingle();
  if (!row) return { valid: false as const, reason: 'not_found' };
  if (row.used_at) return { valid: false as const, reason: 'already_used', row };
  if (isTokenExpired(row.expires_at)) return { valid: false as const, reason: 'expired', row };
  return { valid: true as const, row };
}

async function markTokenUsed(id: number, env: Env): Promise<void> {
  const supabase = createSupabaseAdmin(env);
  await supabase.from('member_card_tokens').update({ used_at: new Date().toISOString() }).eq('id', id).is('used_at', null);
}

async function advanceStatus(orderId: number, targetStatus: CardStatus, env: Env): Promise<{ok:boolean; status?:CardStatus}> {
  const supabase = createSupabaseAdmin(env);
  const { data: order } = await supabase.from('member_card_orders').select('status').eq('id', orderId).single();
  if (!order) return { ok:false };
  const current = order.status as CardStatus;
  if (!canAdvance(current, targetStatus)) return { ok: false, status: current };
  if (current === targetStatus) return { ok: true, status: current };
  const { error } = await supabase.from('member_card_orders').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
  if (error) return { ok: false, status: current };
  return { ok: true, status: targetStatus };
}

export async function handleMemberCardRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const supabase = createSupabaseAdmin(env);

  if (url.pathname === '/api/admin/card/send-order-email' && request.method === 'POST') {
    const auth = await requireAdmin(request, env);
    if (!auth.ok) return auth.response;
    const { member_id } = await request.json() as { member_id: number };
    if (!member_id) return json({ error: 'member_id requis' }, 400);

    const { data: member } = await supabase.from('members').select('id,email,first_name,last_name').eq('id', member_id).single();
    if (!member) return json({ error: 'member introuvable' }, 404);

    let { data: order } = await supabase.from('member_card_orders').select('*').eq('member_id', member_id).order('id', { ascending: false }).limit(1).maybeSingle();
    if (!order) {
      const { data: created } = await supabase.from('member_card_orders').insert({ member_id, status: 'INSCRIT', amount: 150, currency: 'MAD' }).select('*').single();
      order = created;
    }

    await advanceStatus(order.id, 'MAIL_COMMANDE_ENVOYE', env);
    const token = await createToken(order.id, 'order', env);
    const confirmUrl = `${env.PUBLIC_APP_URL || 'https://www.ftourbabrayan.ma'}/card/confirm-order?token=${token}`;
    const email = buildOrderEmail(confirmUrl);
    await sendEmail({ to: member.email, subject: email.subject, html: email.html, apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "" });
    await logEvent(order.id, 'MAIL_COMMANDE_ENVOYE', { member_id }, env);
    return json({ ok: true, order_id: order.id });
  }

  if (url.pathname === '/card/confirm-order' && request.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    const verified = await verifyToken(token, 'order', env);
    if (!verified.valid) return new Response(cardPage(`
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <h2 style="margin:0 0 8px;color:#991b1b;">Lien invalide ou expiré</h2>
        <p style="color:#374151;">Ce lien a expiré ou a déjà été utilisé. Contactez-nous pour obtenir un nouveau lien.</p>
        <p style="font-size:13px;color:#6b7280;margin-top:12px;"><a href="mailto:contact@ftourbabrayan.ma" style="color:#166534;">contact@ftourbabrayan.ma</a></p>
      </div>
    `), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    const { data: order } = await supabase.from('member_card_orders').select('*').eq('id', verified.row.order_id).single();
    if (!order) return new Response(cardPage(`
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:40px;margin-bottom:12px;">❌</div>
        <h2 style="margin:0 0 8px;color:#991b1b;">Commande introuvable</h2>
        <p style="color:#374151;">Aucune commande associée à ce lien. Contactez-nous.</p>
      </div>
    `), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    await advanceStatus(order.id, 'CARTE_DEMANDEE', env);
    await markTokenUsed(verified.row.id, env);
    await logEvent(order.id, 'CARTE_DEMANDEE', { token_id: verified.row.id }, env);

    const paymentToken = await createToken(order.id, 'payment', env);
    const paymentUrl = `${env.PUBLIC_APP_URL || 'https://www.ftourbabrayan.ma'}/card/payment?token=${paymentToken}`;
    const emailData = buildPaymentEmail(paymentUrl, Number(order.amount || 150), order.currency || 'MAD');

    const { data: member } = await supabase.from('members').select('email').eq('id', order.member_id).single();
    if (member?.email) {
      await sendEmail({ to: member.email, subject: emailData.subject, html: emailData.html, apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "" });
    }
    await advanceStatus(order.id, 'MAIL_PAIEMENT_ENVOYE', env);
    await logEvent(order.id, 'MAIL_PAIEMENT_ENVOYE', { reason: 'auto_after_confirm' }, env);

    return new Response(cardPage(`
      <div style="text-align:center;padding:16px 0 24px;">
        <div style="font-size:48px;margin-bottom:16px;">✅</div>
        <h2 style="margin:0 0 12px;color:#166534;font-size:22px;">Demande confirmée !</h2>
        <p style="margin:0 0 20px;color:#374151;line-height:1.6;">
          Merci — votre demande de carte membre a bien été enregistrée.<br/>
          Un e-mail avec les instructions de paiement vient de vous être envoyé.
        </p>
        <p style="margin:0;font-size:13px;color:#6b7280;">
          Vérifiez votre boîte de réception (et vos spams).<br/>
          Pour toute question : <a href="mailto:contact@ftourbabrayan.ma" style="color:#166534;">contact@ftourbabrayan.ma</a>
        </p>
      </div>
    `), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (url.pathname === '/card/payment' && request.method === 'GET') {
    const token = url.searchParams.get('token') || '';
    if (!token) return new Response(cardPage(`
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
        <h2 style="margin:0 0 8px;color:#991b1b;">Lien invalide</h2>
        <p style="color:#374151;">Ce lien est invalide ou a expiré. Contactez-nous si vous avez besoin d'un nouveau lien.</p>
      </div>
    `), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    return new Response(cardPage(`
      <h2 style="margin:0 0 6px;color:#166534;font-size:20px;">Finaliser le paiement de votre carte membre</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Choisissez votre mode de paiement et validez ci-dessous.</p>

      <form id="paymentForm" action="/api/card/confirm-payment" method="post" enctype="multipart/form-data">
        <input type="hidden" name="token" value="${token}" />

        <div style="margin-bottom:20px;">
          <label style="display:block;font-weight:600;margin-bottom:8px;color:#1f2937;">Mode de paiement *</label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:14px;border:2px solid #e5e7eb;border-radius:8px;margin-bottom:8px;cursor:pointer;transition:border-color .15s;" id="lbl-site">
            <input type="radio" name="payment_method" value="on_site" required style="margin-top:2px;" onchange="toggleProof(this.value)" />
            <span>
              <strong style="display:block;color:#1f2937;">💵 Paiement sur place</strong>
              <span style="font-size:13px;color:#6b7280;">Remettez le montant directement à un responsable lors de nos événements.</span>
            </span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:14px;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:border-color .15s;" id="lbl-bank">
            <input type="radio" name="payment_method" value="bank_transfer" style="margin-top:2px;" onchange="toggleProof(this.value)" />
            <span>
              <strong style="display:block;color:#1f2937;">🏦 Virement bancaire</strong>
              <span style="font-size:13px;color:#6b7280;">Effectuez un virement et joignez la preuve ci-dessous (PDF/JPG/PNG, max 10 Mo).</span>
            </span>
          </label>
        </div>

        <div id="proofSection" style="display:none;margin-bottom:20px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
          <label style="display:block;font-weight:600;margin-bottom:4px;color:#166534;">RIB pour virement</label>
          <table style="font-size:13px;color:#374151;margin-bottom:12px;">
            <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Banque</td><td><strong>CIH Bank</strong></td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">RIB</td><td><strong>230 810 4810820410010168</strong></td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Titulaire</td><td><strong>Association Bab Rayan</strong></td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Motif</td><td><strong>Carte Membre</strong></td></tr>
          </table>
          <label style="display:block;font-weight:600;margin-bottom:6px;color:#166534;">Preuve de virement *</label>
          <input type="file" name="file" id="fileInput" accept=".pdf,.jpg,.jpeg,.png"
            style="width:100%;padding:8px;border:1px solid #bbf7d0;border-radius:6px;background:#ffffff;font-size:14px;box-sizing:border-box;" />
          <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Formats acceptés : PDF, JPG, PNG — Taille max : 10 Mo</p>
        </div>

        <button type="submit" id="submitBtn"
          style="width:100%;background:#166534;color:#fff;border:none;padding:14px;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;">
          Valider mon paiement
        </button>
      </form>

      <script>
        function toggleProof(val) {
          var s = document.getElementById('proofSection');
          var f = document.getElementById('fileInput');
          if (val === 'bank_transfer') {
            s.style.display = 'block';
            f.setAttribute('required', '');
          } else {
            s.style.display = 'none';
            f.removeAttribute('required');
          }
        }
        document.getElementById('paymentForm').addEventListener('submit', function() {
          var btn = document.getElementById('submitBtn');
          btn.textContent = 'Envoi en cours…';
          btn.disabled = true;
        });
      </script>
    `), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (url.pathname === '/api/card/confirm-payment' && request.method === 'POST') {
    const form = await request.formData();
    const token = String(form.get('token') || '');
    const paymentMethod = String(form.get('payment_method') || '');
    if (!['on_site', 'bank_transfer'].includes(paymentMethod)) return json({ error: 'payment_method invalide' }, 400);

    const verified = await verifyToken(token, 'payment', env);
    if (!verified.valid) return json({ error: 'token invalide/expiré' }, 400);

    const { data: order } = await supabase.from('member_card_orders').select('*').eq('id', verified.row.order_id).single();
    if (!order) return json({ error: 'order introuvable' }, 404);

    const maybeFile = form.get('file');
    if (paymentMethod === 'bank_transfer' && !(maybeFile instanceof File && maybeFile.size > 0)) {
      return json({ error: 'preuve de virement requise' }, 400);
    }

    let paymentProofPath: string | null = order.payment_proof_path;
    if (maybeFile && maybeFile instanceof File && maybeFile.size > 0) {
      const ext = maybeFile.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_MIME.has(maybeFile.type) || !ALLOWED_EXT.has(ext)) return json({ error: 'type de fichier non autorisé' }, 400);
      if (maybeFile.size > MAX_FILE_SIZE) return json({ error: 'fichier > 10MB' }, 400);
      const path = `${order.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('member-card-proofs')
        .upload(path, maybeFile, { contentType: maybeFile.type, upsert: false });
      if (uploadErr) return json({ error: uploadErr.message }, 500);
      paymentProofPath = path;
    }

    const targetStatus: CardStatus = paymentMethod === 'on_site' ? 'PAIEMENT_RECU' : 'A_IMPRIMER';
    await supabase
      .from('member_card_orders')
      .update({ payment_method: paymentMethod, payment_proof_path: paymentProofPath, updated_at: new Date().toISOString() })
      .eq('id', order.id);
    await advanceStatus(order.id, targetStatus, env);
    await markTokenUsed(verified.row.id, env);
    await logEvent(order.id, targetStatus, { payment_method: paymentMethod, has_proof: !!paymentProofPath }, env);

    return new Response(cardPage(`
      <div style="text-align:center;padding:16px 0 24px;">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <h2 style="margin:0 0 12px;color:#166534;font-size:22px;">Paiement confirmé !</h2>
        <p style="margin:0 0 16px;color:#374151;line-height:1.6;">
          Merci pour votre cotisation. Votre carte membre Bab Rayan est en cours de préparation.<br/>
          Vous serez contacté(e) pour la récupérer lors de nos événements.
        </p>
        <p style="margin:0;font-size:13px;color:#6b7280;">
          Pour toute question : <a href="mailto:contact@ftourbabrayan.ma" style="color:#166534;">contact@ftourbabrayan.ma</a>
        </p>
      </div>
    `), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (url.pathname === '/api/admin/card/queue-print' && request.method === 'POST') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const { order_id } = await request.json() as { order_id: number };
    const res = await advanceStatus(order_id, 'A_IMPRIMER', env);
    if (!res.ok) return json({ error: 'transition impossible', current: res.status }, 400);
    await logEvent(order_id, 'A_IMPRIMER', { by_admin: true }, env);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/card/mark-printed' && request.method === 'POST') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const { order_id } = await request.json() as { order_id: number };
    const res = await advanceStatus(order_id, 'IMPRIMEE', env);
    if (!res.ok) return json({ error: 'transition impossible', current: res.status }, 400);
    await logEvent(order_id, 'IMPRIMEE', {}, env);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/card/mark-delivered' && request.method === 'POST') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const { order_id } = await request.json() as { order_id: number };
    const res = await advanceStatus(order_id, 'LIVREE', env);
    if (!res.ok) return json({ error: 'transition impossible', current: res.status }, 400);
    await logEvent(order_id, 'LIVREE', {}, env);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/card/mark-paid' && request.method === 'POST') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const { order_id } = await request.json() as { order_id: number };
    await supabase.from('member_card_orders').update({ payment_method: 'on_site' }).eq('id', order_id);
    const res = await advanceStatus(order_id, 'PAIEMENT_RECU', env);
    if (!res.ok) return json({ error: 'transition impossible', current: res.status }, 400);
    await logEvent(order_id, 'PAIEMENT_RECU', { payment_method: 'on_site', by_admin: true }, env);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/card/resend-payment-email' && request.method === 'POST') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const { order_id } = await request.json() as { order_id: number };
    const { data: order } = await supabase.from('member_card_orders').select('*').eq('id', order_id).single();
    if (!order) return json({ error: 'order introuvable' }, 404);
    const { data: member } = await supabase.from('members').select('email').eq('id', order.member_id).single();
    if (!member?.email) return json({ error: 'email introuvable' }, 404);
    const token = await createToken(order.id, 'payment', env);
    const paymentUrl = `${env.PUBLIC_APP_URL || 'https://www.ftourbabrayan.ma'}/card/payment?token=${token}`;
    const emailData = buildPaymentEmail(paymentUrl, Number(order.amount || 150), order.currency || 'MAD');
    await sendEmail({ to: member.email, subject: emailData.subject, html: emailData.html, apiKey: env.RESEND_API_KEY || env.EMAIL_PROVIDER_KEY || "" });
    await advanceStatus(order.id, 'MAIL_PAIEMENT_ENVOYE', env);
    await logEvent(order.id, 'MAIL_PAIEMENT_ENVOYE', { reason: 'manual_resend' }, env);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/cards' && request.method === 'GET') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const status = url.searchParams.get('status');
    const search = (url.searchParams.get('search') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const pageSize = 20;

    let query = supabase
      .from('member_card_orders')
      .select('id,status,payment_method,payment_proof_path,updated_at,amount,currency,members(id,first_name,last_name,address,phone,email)', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const normalizedSearch = search.toLowerCase();
    const filtered = (data || []).filter((item: any) => {
      if (!normalizedSearch) return true;
      const member = item.members || {};
      return [member.first_name, member.last_name, member.email, member.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });

    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
    return json({ items: paginated, count: normalizedSearch ? filtered.length : (count || 0), page, pageSize });
  }

  if (url.pathname.match(/^\/api\/admin\/cards\/\d+\/events$/) && request.method === 'GET') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const orderId = Number(url.pathname.split('/')[4]);
    const { data } = await supabase.from('member_card_events').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
    return json({ items: data || [] });
  }

  if (url.pathname === '/api/admin/card/proof-url' && request.method === 'GET') {
    const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
    const orderId = Number(url.searchParams.get('order_id'));
    const { data: order } = await supabase.from('member_card_orders').select('payment_proof_path').eq('id', orderId).single();
    if (!order?.payment_proof_path) return json({ error: 'preuve absente' }, 404);
    const { data, error } = await supabase.storage.from('member-card-proofs').createSignedUrl(order.payment_proof_path, 60 * 10);
    if (error || !data?.signedUrl) return json({ error: error?.message || 'erreur signed url' }, 500);
    return json({ url: data.signedUrl });
  }

  return null;
}
