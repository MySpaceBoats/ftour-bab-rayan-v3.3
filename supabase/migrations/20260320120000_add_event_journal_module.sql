-- ============================================
-- EVENT JOURNAL MODULE
-- Ftour Bab Rayan — Internal operational log
-- ============================================

-- ──────────────────────────────────────────
-- JOURNAL ENTRIES
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('observation','problem','solution','idea','decision')),
  category        TEXT NOT NULL CHECK (category IN ('logistics','volunteers','communication','food','participant_experience','technical')),
  importance      TEXT NOT NULL DEFAULT 'medium' CHECK (importance IN ('low','medium','high','critical')),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_edition   TEXT NOT NULL DEFAULT '',
  is_useful       BOOLEAN NOT NULL DEFAULT FALSE,
  useful_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_author     ON journal_entries(author_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_type       ON journal_entries(type);
CREATE INDEX IF NOT EXISTS idx_journal_entries_category   ON journal_entries(category);
CREATE INDEX IF NOT EXISTS idx_journal_entries_importance ON journal_entries(importance);
CREATE INDEX IF NOT EXISTS idx_journal_entries_edition    ON journal_entries(event_edition);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created    ON journal_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tags       ON journal_entries USING gin(tags);

-- ──────────────────────────────────────────
-- JOURNAL USEFUL VOTES (prevent double vote)
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_useful_votes (
  id         SERIAL PRIMARY KEY,
  entry_id   UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_useful_entry ON journal_useful_votes(entry_id);

-- ──────────────────────────────────────────
-- JOURNAL COMMENTS
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS journal_comments (
  id         SERIAL PRIMARY KEY,
  entry_id   UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_comments_entry  ON journal_comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_comments_author ON journal_comments(author_id);

-- ──────────────────────────────────────────
-- LESSONS LEARNED
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lessons_learned (
  id             SERIAL PRIMARY KEY,
  entry_id       UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
  problem        TEXT NOT NULL,
  context        TEXT,
  solution       TEXT NOT NULL,
  outcome        TEXT,
  recommendation TEXT,
  category       TEXT CHECK (category IN ('logistics','volunteers','communication','food','participant_experience','technical')),
  importance     TEXT NOT NULL DEFAULT 'medium' CHECK (importance IN ('low','medium','high','critical')),
  event_edition  TEXT NOT NULL DEFAULT '',
  author_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_entry    ON lessons_learned(entry_id);
CREATE INDEX IF NOT EXISTS idx_lessons_author   ON lessons_learned(author_id);
CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons_learned(category);
CREATE INDEX IF NOT EXISTS idx_lessons_edition  ON lessons_learned(event_edition);
CREATE INDEX IF NOT EXISTS idx_lessons_created  ON lessons_learned(created_at DESC);

-- ──────────────────────────────────────────
-- RLS — Row Level Security (all tables private)
-- ──────────────────────────────────────────

ALTER TABLE journal_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_useful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons_learned      ENABLE ROW LEVEL SECURITY;

-- Service role bypass (used by server-side Supabase admin client)
CREATE POLICY "service_role_journal_entries"      ON journal_entries      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_journal_votes"        ON journal_useful_votes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_journal_comments"     ON journal_comments     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_lessons_learned"      ON lessons_learned      FOR ALL TO service_role USING (true) WITH CHECK (true);
