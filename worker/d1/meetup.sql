-- Meetup entre bénévoles (sorties, événements, rencontres par pays et ville). Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/meetup.sql
-- (staging : --env staging, base ftour-bab-rayan-staging-db)
CREATE TABLE IF NOT EXISTS mt_meetups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (category IN ('sortie','evenement','rencontre','autre')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  country TEXT NOT NULL CHECK (length(country) BETWEEN 1 AND 60),
  city TEXT NOT NULL CHECK (length(city) BETWEEN 1 AND 60),
  place TEXT NOT NULL CHECK (length(place) BETWEEN 1 AND 120),
  -- heure locale du lieu, texte AAAA-MM-JJTHH:MM sans fuseau
  starts_at TEXT NOT NULL CHECK (starts_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]'),
  ends_at TEXT NOT NULL CHECK (ends_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]'),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  -- chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>)
  photo_key TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','hidden')),
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_mt_meetups_status ON mt_meetups(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_mt_meetups_place ON mt_meetups(country, city);
CREATE INDEX IF NOT EXISTS idx_mt_meetups_member ON mt_meetups(member_id, created_at);

-- id croissant = ordre d'arrivée = ordre de la liste d'attente
CREATE TABLE IF NOT EXISTS mt_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meetup_id INTEGER NOT NULL REFERENCES mt_meetups(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('going','waitlist')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (meetup_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_mt_participants_meetup ON mt_participants(meetup_id, status, id);
CREATE INDEX IF NOT EXISTS idx_mt_participants_member ON mt_participants(member_id, created_at);
