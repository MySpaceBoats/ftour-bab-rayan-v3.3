-- Modération IA du Hub: une ligne par contenu analysé et jugé (masqué/signalé) ou en erreur.
-- UNIQUE(target_type, target_id): un contenu n'est analysé qu'une fois (un contenu restauré n'est jamais réanalysé).
-- Appliquer: wrangler d1 execute <db> --remote --file worker/d1/moderation.sql   (idempotent)
CREATE TABLE IF NOT EXISTS hub_moderation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  rule TEXT,
  confidence REAL,
  reason TEXT,
  action TEXT NOT NULL CHECK (action IN ('hidden','flagged','restored','error')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT,
  restored_by TEXT,
  UNIQUE (target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_moderation_review ON hub_moderation(action, reviewed_at, id DESC);
