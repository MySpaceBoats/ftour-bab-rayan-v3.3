-- ============================================================
-- Migration: add ftour_team_members and event_photos tables
-- Created for Trombinoscope and Ramadan Closing Page modules
-- ============================================================

-- ============================================================
-- ftour_team_members – Équipe Ftour Bab Rayan (Trombinoscope)
-- ============================================================
CREATE TABLE IF NOT EXISTS ftour_team_members (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(100)  NOT NULL,
  last_name     VARCHAR(100)  NOT NULL,
  role          VARCHAR(150),
  citation      TEXT,
  photo_url     TEXT,
  display_order INTEGER       NOT NULL DEFAULT 0,
  edition       INTEGER       NOT NULL DEFAULT 12,
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ftour_team_members_edition
  ON ftour_team_members (edition);

CREATE INDEX IF NOT EXISTS idx_ftour_team_members_active_edition
  ON ftour_team_members (edition, is_active, display_order);

-- ============================================================
-- event_photos – Ramadan Closing Page photo slider
-- ============================================================
CREATE TABLE IF NOT EXISTS event_photos (
  id            SERIAL PRIMARY KEY,
  image_url     TEXT          NOT NULL,
  storage_path  TEXT,
  title         VARCHAR(255),
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  display_order INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_photos_active_order
  ON event_photos (is_active, display_order);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
