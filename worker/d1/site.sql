-- Team directory, contact messages, partner leads on Cloudflare D1.
-- Apply: wrangler d1 execute <db> --remote --file worker/d1/site.sql
CREATE TABLE IF NOT EXISTS ftour_team_members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  role          TEXT,
  citation      TEXT,
  photo_url     TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  edition       INTEGER NOT NULL DEFAULT 12,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_team_edition_active ON ftour_team_members(edition, is_active, display_order);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_contact_is_read ON contact_messages(is_read);

CREATE TABLE IF NOT EXISTS partner_leads (
  id               TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  company_name     TEXT NOT NULL,
  contact_name     TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  city             TEXT,
  partnership_type TEXT,
  budget_range     TEXT,
  message          TEXT,
  source           TEXT NOT NULL DEFAULT 'website',
  locale           TEXT
);
