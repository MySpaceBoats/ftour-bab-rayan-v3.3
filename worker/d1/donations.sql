-- Donations on Cloudflare D1: new table donations_v2, the old `donations` snapshot table is left untouched.
-- Differences: no FK processed_by -> users(id) (users live in Supabase, the D1 users copy is a stale snapshot),
-- ISO timestamps. Idempotent. Apply: wrangler d1 execute <db> --remote --file worker/d1/donations.sql
CREATE TABLE IF NOT EXISTS donations_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_reference TEXT NOT NULL UNIQUE,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  donor_phone TEXT,
  amount TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('transfer', 'on_site', 'cheque', 'cash')),
  status TEXT NOT NULL DEFAULT 'promised' CHECK (status IN ('promised', 'pending', 'received', 'cancelled')),
  message TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  accepts_updates INTEGER NOT NULL DEFAULT 0,
  processed_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_donations_v2_status ON donations_v2(status);
CREATE INDEX IF NOT EXISTS idx_donations_v2_email ON donations_v2(donor_email);
