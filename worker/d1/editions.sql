-- Editions: every Ramadan day belongs to an edition; one edition is active at a time.
-- Apply ONCE on the prod D1 (and staging) BEFORE deploying the Worker that reads it (the ALTER is not re-runnable):
--   npx wrangler d1 execute ftour-bab-rayan-prod-db --remote --file=worker/d1/editions.sql
ALTER TABLE t_ramadan_days ADD COLUMN edition INTEGER NOT NULL DEFAULT 12;

-- day_number was unique across the whole table: it must only be unique inside an edition.
DROP INDEX IF EXISTS uq_t_ramadan_days_1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_t_ramadan_days_edition_day ON t_ramadan_days(edition, day_number);

CREATE TABLE IF NOT EXISTS edition_settings (
  edition INTEGER PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO edition_settings (edition, status) VALUES (12, 'active'), (13, 'draft');
