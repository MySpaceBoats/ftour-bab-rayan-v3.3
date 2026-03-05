#!/usr/bin/env node
/**
 * Script to apply the gallery validation migration.
 * Adds validation columns (validation_email, validation_token,
 * validation_sent_at, validated_at) to the gallery_photos table.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/apply-gallery-validation-migration.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables:");
  if (!SUPABASE_URL) console.error("   SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const SQL = `
alter table if exists public.gallery_photos
  add column if not exists validation_email text,
  add column if not exists validation_token text,
  add column if not exists validation_sent_at timestamptz,
  add column if not exists validated_at timestamptz;

create index if not exists idx_gallery_photos_validation_token
  on public.gallery_photos(validation_token)
  where validation_token is not null;
`.trim();

async function run() {
  console.log("🔄 Applying gallery validation migration...");
  console.log(`   Project: ${SUPABASE_URL}`);

  // Use Supabase Management API to run SQL
  const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0];
  const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  const res = await fetch(managementApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (res.ok) {
    console.log("✅ Migration applied successfully!");
    return;
  }

  // Fallback: try via the pg REST endpoint (requires exec_sql function)
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql: SQL }),
  });

  if (rpcRes.ok) {
    console.log("✅ Migration applied via RPC!");
    return;
  }

  console.error("❌ Could not apply migration automatically.");
  console.error("");
  console.error("Please run the following SQL manually in the Supabase Dashboard");
  console.error(`(https://supabase.com/dashboard/project/${projectRef}/sql/new):`);
  console.error("");
  console.error(SQL);
  process.exit(1);
}

run().catch((err) => {
  console.error("❌ Unexpected error:", err.message);
  process.exit(1);
});
