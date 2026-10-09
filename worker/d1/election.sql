-- Manager election on Cloudflare D1. Apply: wrangler d1 execute <db> --remote --file worker/d1/election.sql
CREATE TABLE IF NOT EXISTS election_settings (
  id            TEXT PRIMARY KEY,
  election_year INTEGER NOT NULL UNIQUE,
  is_open       INTEGER NOT NULL DEFAULT 0,
  max_managers  INTEGER NOT NULL DEFAULT 10,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS manager_candidates (
  id                  TEXT PRIMARY KEY,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  photo_url           TEXT,
  motivation_text     TEXT,
  participation_count INTEGER NOT NULL DEFAULT 0,
  election_year       INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_email_year ON manager_candidates(lower(email), election_year);
CREATE INDEX IF NOT EXISTS idx_candidates_year_status ON manager_candidates(election_year, status);
CREATE TABLE IF NOT EXISTS manager_votes (
  id            TEXT PRIMARY KEY,
  voter_email   TEXT NOT NULL,
  candidate_id  TEXT NOT NULL REFERENCES manager_candidates(id) ON DELETE CASCADE,
  election_year INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (voter_email, election_year)
);
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON manager_votes(candidate_id);
