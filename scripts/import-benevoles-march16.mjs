#!/usr/bin/env node
/**
 * Import bénévoles - Ftour Bab Rayan - Lundi 16 mars 2026
 * Créneaux : préparation_ftour + service_ftour
 *
 * Usage:
 *   node scripts/import-benevoles-march16.mjs
 *   node scripts/import-benevoles-march16.mjs --dry-run
 *   node scripts/import-benevoles-march16.mjs --data=contacts.json
 *   node scripts/import-benevoles-march16.mjs --no-email
 *
 * Variables d'environnement requises:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY  (ou EMAIL_PROVIDER_KEY)
 *
 * Pour lire depuis Google Sheets (si les feuilles sont rendues publiques):
 *   SHEET_ID_1, SHEET_ID_2, SHEET_ID_3
 *
 * Pour utiliser un fichier local de contacts (format JSON):
 *   --data=contacts.json
 *   Le fichier doit être un tableau d'objets:
 *   [{ "firstName": "...", "lastName": "...", "email": "...", "phone": "..." }, ...]
 *
 * IDs des Google Sheets fournis:
 *   1: 144lw71tUsZ6MMdfGIRK163CObKDysbjZ
 *   2: 1KyqBQDnNm7bm5PuOCwa7wzvfCysLx4ja
 *   3: 1rFR1QuyNtMzG4bDFJNd45pft6j7Ww5vx
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ============================================
// CONFIGURATION
// ============================================

const TARGET_DATE = '2026-03-16'; // Lundi 16 mars
const VOLUNTEER_SLOTS = ['preparation_ftour', 'service_ftour'];
const BASE_URL = 'https://ftourbabrayan.ma';
const FROM_EMAIL = 'Ftour Bab Rayan <noreply@ftourbabrayan.ma>';
const REPLY_TO = 'contact@ftourbabrayan.ma';
const RESEND_API_URL = 'https://api.resend.com/emails';

// IDs des Google Sheets à importer
const SHEET_IDS = [
  '144lw71tUsZ6MMdfGIRK163CObKDysbjZ',
  '1KyqBQDnNm7bm5PuOCwa7wzvfCysLx4ja',
  '1rFR1QuyNtMzG4bDFJNd45pft6j7Ww5vx',
];

// ============================================
// ARGUMENTS
// ============================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const skipEmail = args.includes('--no-email');
const dataFileArg = args.find(a => a.startsWith('--data='));
const dataFile = dataFileArg ? dataFileArg.split('=')[1] : null;

// ============================================
// HELPERS
// ============================================

function generateSecureToken() {
  return crypto.randomBytes(16).toString('hex');
}

function normalizeString(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getQrCodeUrl(token, baseUrl) {
  const checkinUrl = encodeURIComponent(`${baseUrl}/checkin/${token}`);
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${checkinUrl}`;
}

function computeSlotTimes(iftarTimeStr) {
  const match = (iftarTimeStr || '').match(/(\d{1,2})[h:](\d{2})/);
  if (!match) {
    return { prepStart: '15:00', prepEnd: '16:45', serviceStart: '17:30', serviceEnd: '19:15' };
  }
  const iftarHour = parseInt(match[1]);
  const iftarMin = parseInt(match[2]);
  const total = iftarHour * 60 + iftarMin;
  const fmt = (m) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
  return {
    prepStart: fmt(total - 180),
    prepEnd: fmt(total - 75),
    serviceStart: '17:30',
    serviceEnd: '19:15',
  };
}

// ============================================
// EMAIL TEMPLATE
// ============================================

function generateVolunteerEmail({ firstName, lastName, email, dayNumber, dayDate, location, startTime, volunteerSlots, qrToken }) {
  const qrCodeUrl = getQrCodeUrl(qrToken, BASE_URL);
  const times = computeSlotTimes(startTime || '18h00');

  const slotLabels = {
    preparation_ftour: `Préparation ftour (${times.prepStart} – ${times.prepEnd})`,
    service_ftour: `Service ftour (${times.serviceStart} – ${times.serviceEnd})`,
  };

  const slotsHtml = (volunteerSlots || [])
    .map(s => `<li style="margin-bottom: 4px;">${slotLabels[s] || s}</li>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Confirmation bénévole – Ftour Bab Rayan</title></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
<table role="presentation" style="width: 100%; border-collapse: collapse;">
  <tr><td style="padding: 40px 20px;">
    <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
      <!-- Header -->
      <tr><td style="background-color: #166534; padding: 30px 40px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🌙 Ftour Bab Rayan</h1>
        <p style="color: #86efac; margin: 8px 0 0 0; font-size: 16px;">12ème édition</p>
      </td></tr>
      <!-- Content -->
      <tr><td style="padding: 40px;">
        <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 24px;">Merci pour votre inscription !</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Cher(e) <strong>${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong>,
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Votre inscription en tant que bénévole pour le <strong>Ftour Bab Rayan</strong> a bien été enregistrée.
          Nous sommes ravis de vous compter parmi notre équipe !
        </p>
        <!-- Détails -->
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border-radius: 8px; margin: 20px 0;">
          <tr><td style="padding: 20px;">
            <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">📅 Votre jour de participation</h3>
            <p style="margin: 5px 0; color: #374151;"><strong>Date :</strong> ${escapeHtml(dayDate)}</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Lieu :</strong> ${escapeHtml(location)}</p>
          </td></tr>
        </table>
        <!-- Créneaux -->
        ${slotsHtml ? `
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe;">
          <tr><td style="padding: 20px;">
            <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px;">🕐 Vos créneaux choisis</h3>
            <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 15px;">${slotsHtml}</ul>
          </td></tr>
        </table>` : ''}
        <!-- QR Code -->
        <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #ffffff; border: 2px dashed #166534; border-radius: 8px;">
          <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">🎫 Votre QR Code d'accès</h3>
          <img src="${getQrCodeUrl(qrToken, BASE_URL)}" alt="QR Code" style="width: 200px; height: 200px; margin: 10px 0;" />
          <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">Présentez ce QR code à l'entrée le jour de votre participation</p>
        </div>
        <!-- Annulation -->
        <div style="text-align: center; margin: 20px 0; padding: 15px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          <p style="color: #991b1b; font-size: 14px; margin: 0 0 10px 0;">En cas d'empêchement, vous pouvez annuler votre inscription :</p>
          <a href="${BASE_URL}/cancel-volunteer/${escapeHtml(qrToken)}" style="display: inline-block; background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">Annuler mon inscription</a>
        </div>
        <!-- Consignes -->
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
          <tr><td style="padding: 20px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">📋 Consignes importantes</h3>
            <ul style="margin: 0; padding-left: 20px; color: #374151;">
              <li style="margin-bottom: 8px; color: #dc2626; font-weight: bold;">L'entrée pour participer au service commence à partir de 16h30. Il est interdit aux bénévoles d'entrer au-delà de 17h30.</li>
              <li style="margin-bottom: 8px;">Arrivez à l'heure prévue par le créneau choisi.</li>
              <li style="margin-bottom: 8px;">En cas d'empêchement, prévenez-nous à l'avance.</li>
              <li style="margin-bottom: 8px;">Portez des vêtements confortables.</li>
            </ul>
          </td></tr>
        </table>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0 0 0;">À très bientôt !<br><strong>L'équipe Ftour Bab Rayan</strong></p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">Ftour Bab Rayan – Association Bab Rayan</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;"><a href="${BASE_URL}" style="color: #166534;">ftourbabrayan.ma</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return {
    subject: '✅ Confirmation inscription bénévole - Ftour Bab Rayan (12ème édition)',
    html,
  };
}

// ============================================
// EMAIL SENDER
// ============================================

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_PROVIDER_KEY;
  if (!apiKey) {
    console.warn(`  ⚠️  Pas de RESEND_API_KEY – email non envoyé à ${to}`);
    return { success: false, error: 'API key manquante' };
  }

  const payload = {
    from: FROM_EMAIL,
    to,
    subject,
    html,
    reply_to: REPLY_TO,
    bcc: ['rsebbani@myspace.boats'],
  };

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error?.message || `HTTP ${res.status}` };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// GOOGLE SHEETS READER (feuilles publiques)
// ============================================

async function fetchSheetAsCsv(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      console.warn(`  ⚠️  Sheet ${sheetId} inaccessible (HTTP ${res.status}) – feuille privée?`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  ⚠️  Sheet ${sheetId} erreur réseau: ${err.message}`);
    return null;
  }
}

function parseCsvRow(line) {
  // Simple CSV parser handling quoted fields
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseContactsFromCsv(csvText) {
  if (!csvText) return [];
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect header row (look for email column among first 10 rows)
  let headerIndex = 0;
  let headerFields = [];
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const fields = parseCsvRow(lines[i]);
    const normalized = fields.map(normalizeString);
    if (normalized.some(f => f.includes('email') || f.includes('mail'))) {
      headerIndex = i;
      headerFields = fields;
      break;
    }
  }

  if (!headerFields.length) {
    console.warn('  ⚠️  En-tête CSV non trouvé (colonne "email" manquante)');
    return [];
  }

  const norm = headerFields.map(normalizeString);
  const colEmail = norm.findIndex(f => f.includes('email') || f.includes('mail'));
  const colFirstName = norm.findIndex((f, i) => i !== colEmail && (f.includes('prenom') || f.includes('first')));
  const colLastName = norm.findIndex((f, i) => i !== colEmail && i !== colFirstName && (f.includes('nom') || f.includes('last')));
  const colFullName = (colFirstName === -1 || colLastName === -1)
    ? norm.findIndex((f, i) => i !== colEmail && (f.includes('nom') || f.includes('name') || f.includes('prenom')))
    : -1;
  const colPhone = norm.findIndex((f, i) =>
    ![colEmail, colFirstName, colLastName, colFullName].includes(i) &&
    (f.includes('tel') || f.includes('phone') || f.includes('mobile') || f.includes('gsm'))
  );
  const colCity = norm.findIndex((f, i) =>
    ![colEmail, colFirstName, colLastName, colFullName, colPhone].includes(i) &&
    (f.includes('ville') || f.includes('city'))
  );

  if (colEmail === -1) return [];
  if (colFirstName === -1 && colLastName === -1 && colFullName === -1) return [];

  const contacts = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const fields = parseCsvRow(lines[i]);
    const email = (fields[colEmail] || '').toLowerCase().trim();
    if (!isValidEmail(email)) continue;

    let firstName, lastName;
    if (colFullName !== -1) {
      const parts = (fields[colFullName] || '').trim().split(/\s+/).filter(Boolean);
      lastName = parts[0] || '';
      firstName = parts.slice(1).join(' ') || parts[0] || '';
    } else {
      firstName = (fields[colFirstName] || '').trim();
      lastName = (fields[colLastName] || '').trim();
    }

    if (!firstName || !lastName || !email) continue;

    contacts.push({
      firstName,
      lastName,
      email,
      phone: colPhone !== -1 ? (fields[colPhone] || '').trim() : '',
      city: colCity !== -1 ? (fields[colCity] || '').trim() : undefined,
    });
  }
  return contacts;
}

// ============================================
// SUPABASE
// ============================================

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function findRamadanDayForDate(supabase, dateStr) {
  // Try exact date match on the ramadan_days table
  const { data, error } = await supabase
    .from('ramadan_days')
    .select('*')
    .order('date', { ascending: true });

  if (error) throw new Error(`Erreur lecture ramadan_days: ${error.message}`);

  const targetDate = new Date(dateStr);
  const targetDay = targetDate.toISOString().slice(0, 10);

  // Find by date string match
  const day = (data || []).find(d => {
    const dayDate = new Date(d.date || d.day_date || d.created_at || '').toISOString().slice(0, 10);
    return dayDate === targetDay;
  });

  return day || null;
}

async function getExistingEmails(supabase, dayId, emails) {
  if (!emails.length) return new Set();
  const { data, error } = await supabase
    .from('volunteers')
    .select('email')
    .eq('day_id', dayId)
    .in('email', emails.map(e => e.toLowerCase().trim()));

  if (error) throw new Error(`Erreur vérification doublons: ${error.message}`);
  return new Set((data || []).map(r => String(r.email).toLowerCase().trim()));
}

async function insertVolunteers(supabase, rows, dayId) {
  if (!rows.length) return [];
  const payload = rows.map(row => ({
    first_name: row.firstName,
    last_name: row.lastName,
    email: row.email.toLowerCase().trim(),
    phone: row.phone || '',
    city: row.city || null,
    day_id: dayId,
    qr_token: generateSecureToken(),
    qr_status: 'generated',
    status: 'registered',
    accepted_terms: true,
    email_sent: false,
    volunteer_slots: VOLUNTEER_SLOTS,
    notes: null,
  }));

  const { data, error } = await supabase
    .from('volunteers')
    .insert(payload)
    .select();

  if (error) throw new Error(`Erreur insertion bénévoles: ${error.message}`);
  return (data || []).map(v => ({
    id: v.id,
    firstName: v.first_name,
    lastName: v.last_name,
    email: v.email,
    phone: v.phone,
    city: v.city,
    dayId: v.day_id,
    qrToken: v.qr_token,
    volunteerSlots: v.volunteer_slots || VOLUNTEER_SLOTS,
  }));
}

async function markEmailSent(supabase, volunteerId) {
  await supabase
    .from('volunteers')
    .update({ email_sent: true })
    .eq('id', volunteerId);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  Import Bénévoles – Ftour Bab Rayan – 16 mars 2026  ');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Mode: ${isDryRun ? '🔍 DRY-RUN (aucune écriture)' : '✅ PRODUCTION'}`);
  console.log(`  Créneaux: ${VOLUNTEER_SLOTS.join(', ')}`);
  console.log(`  Email: ${skipEmail ? '❌ désactivé' : '✅ activé'}`);
  console.log('');

  // 1. Collect contacts
  let allContacts = [];

  if (dataFile) {
    // Load from local JSON file
    console.log(`📂 Lecture fichier local: ${dataFile}`);
    const filePath = path.resolve(dataFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fichier introuvable: ${filePath}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    allContacts = Array.isArray(raw) ? raw : [];
    console.log(`   → ${allContacts.length} contacts chargés`);
  } else {
    // Try to fetch Google Sheets (public access)
    console.log('🌐 Tentative de lecture des Google Sheets...');
    console.log('   (Les feuilles doivent être partagées en lecture publique)');
    console.log('');

    for (const sheetId of SHEET_IDS) {
      console.log(`  📊 Sheet: ${sheetId}`);
      const csv = await fetchSheetAsCsv(sheetId);
      if (!csv) {
        console.log(`     → Ignoré (inaccessible)`);
        continue;
      }
      const contacts = parseContactsFromCsv(csv);
      console.log(`     → ${contacts.length} contacts trouvés`);
      allContacts.push(...contacts);
    }
  }

  // Deduplicate by email
  const seen = new Map();
  for (const c of allContacts) {
    const key = c.email.toLowerCase().trim();
    if (!seen.has(key)) seen.set(key, c);
  }
  allContacts = Array.from(seen.values());

  if (!allContacts.length) {
    console.log('');
    console.error('❌ Aucun contact trouvé.');
    console.log('');
    console.log('Solutions possibles:');
    console.log('  1. Rendre les Google Sheets publiques (Partager → Tout le monde avec le lien → Lecteur)');
    console.log('     puis relancer ce script.');
    console.log('');
    console.log('  2. Exporter les feuilles en CSV depuis Google Sheets,');
    console.log('     créer un fichier contacts.json au format:');
    console.log('     [{"firstName":"...","lastName":"...","email":"...","phone":"..."}]');
    console.log('     puis lancer: node scripts/import-benevoles-march16.mjs --data=contacts.json');
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log(`✅ Total contacts uniques: ${allContacts.length}`);
  console.log('');

  // 2. Connect to Supabase
  let supabase;
  try {
    supabase = getSupabaseClient();
    console.log('🔌 Connexion Supabase OK');
  } catch (err) {
    console.error(`❌ ${err.message}`);
    console.log('');
    console.log('Configurez les variables d\'environnement:');
    console.log('  export SUPABASE_URL=https://xxx.supabase.co');
    console.log('  export SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...');
    console.log('  export RESEND_API_KEY=re_...');
    process.exit(1);
  }

  // 3. Find ramadan day for March 16
  console.log(`🔍 Recherche du jour Ramadan pour le ${TARGET_DATE}...`);
  let day;
  try {
    day = await findRamadanDayForDate(supabase, TARGET_DATE);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  if (!day) {
    console.error(`❌ Aucun jour Ramadan trouvé pour le ${TARGET_DATE}`);
    console.log('');
    console.log('Vérifiez que le jour du 16 mars est bien créé dans la table ramadan_days.');
    process.exit(1);
  }

  const dayId = day.id;
  const dayNumber = day.day_number || day.dayNumber;
  const dayLocation = day.location || 'Association Bab Rayan, Casablanca';
  const dayIftarTime = day.iftar_time || day.iftarTime || '18h00';
  const dayDateFormatted = new Date(day.date || day.day_date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  console.log(`   → Jour Ramadan #${dayNumber} (ID=${dayId})`);
  console.log(`   → Date: ${dayDateFormatted}`);
  console.log(`   → Lieu: ${dayLocation}`);
  console.log(`   → Heure ftour: ${dayIftarTime}`);
  console.log('');

  // 4. Check for existing volunteers (dedup)
  console.log('🔍 Vérification des doublons...');
  let existingEmails;
  try {
    existingEmails = await getExistingEmails(supabase, dayId, allContacts.map(c => c.email));
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  const newContacts = allContacts.filter(c => !existingEmails.has(c.email.toLowerCase().trim()));
  const duplicates = allContacts.filter(c => existingEmails.has(c.email.toLowerCase().trim()));

  console.log(`   → ${newContacts.length} nouveaux bénévoles`);
  if (duplicates.length) {
    console.log(`   → ${duplicates.length} déjà inscrits (ignorés):`);
    duplicates.forEach(d => console.log(`      - ${d.email}`));
  }
  console.log('');

  if (!newContacts.length) {
    console.log('ℹ️  Tous les contacts sont déjà inscrits pour ce jour. Rien à faire.');
    process.exit(0);
  }

  if (isDryRun) {
    console.log('🔍 DRY-RUN – Bénévoles qui seraient créés:');
    newContacts.forEach(c => {
      console.log(`   - ${c.firstName} ${c.lastName} <${c.email}> ${c.phone || ''}`);
    });
    console.log('');
    console.log('Relancez sans --dry-run pour effectuer l\'import réel.');
    process.exit(0);
  }

  // 5. Insert volunteers
  console.log(`💾 Insertion de ${newContacts.length} bénévoles...`);
  let createdVolunteers = [];
  try {
    createdVolunteers = await insertVolunteers(supabase, newContacts, dayId);
    console.log(`   → ${createdVolunteers.length} bénévoles inscrits ✅`);
  } catch (err) {
    console.error(`❌ Erreur lors de l'insertion: ${err.message}`);
    process.exit(1);
  }
  console.log('');

  // 6. Send emails
  if (skipEmail) {
    console.log('📧 Envoi d\'emails désactivé (--no-email)');
  } else {
    console.log(`📧 Envoi des QR codes à ${createdVolunteers.length} bénévoles...`);
    let sent = 0;
    let failed = 0;

    for (const vol of createdVolunteers) {
      process.stdout.write(`   → ${vol.email}... `);
      const emailData = generateVolunteerEmail({
        firstName: vol.firstName,
        lastName: vol.lastName,
        email: vol.email,
        dayNumber,
        dayDate: dayDateFormatted,
        location: dayLocation,
        startTime: dayIftarTime,
        volunteerSlots: VOLUNTEER_SLOTS,
        qrToken: vol.qrToken,
      });

      const result = await sendEmail({
        to: vol.email,
        subject: emailData.subject,
        html: emailData.html,
      });

      if (result.success) {
        console.log('✅');
        await markEmailSent(supabase, vol.id).catch(() => {});
        sent++;
      } else {
        console.log(`❌ ${result.error}`);
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('');
    console.log(`📊 Résultats emails: ${sent} envoyés, ${failed} échoués`);
  }

  // 7. Summary
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  ✅ Import terminé !');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Contacts traités  : ${allContacts.length}`);
  console.log(`  Déjà inscrits     : ${duplicates.length}`);
  console.log(`  Nouveaux inscrits : ${createdVolunteers.length}`);
  if (!skipEmail) {
    console.log(`  Emails envoyés   : ${createdVolunteers.length}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('');
  console.error('❌ Erreur fatale:', err.message || err);
  process.exit(1);
});
