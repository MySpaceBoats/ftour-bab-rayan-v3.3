-- Salons thématiques du Hub (feed + visio Jitsi). Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/salon.sql
-- (staging : --env staging, base ftour-bab-rayan-staging-db)
CREATE TABLE IF NOT EXISTS sl_salons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  topic TEXT NOT NULL CHECK (length(topic) BETWEEN 1 AND 500),
  -- jeton aléatoire du nom de salle Jitsi : ne sort que par le détail d'un salon
  room TEXT NOT NULL UNIQUE CHECK (length(room) >= 16),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','hidden')),
  last_post_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sl_salons_status ON sl_salons(status, last_post_at DESC);
CREATE INDEX IF NOT EXISTS idx_sl_salons_member ON sl_salons(member_id, created_at);

CREATE TABLE IF NOT EXISTS sl_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL REFERENCES sl_salons(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sl_posts_salon ON sl_posts(salon_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_sl_posts_member ON sl_posts(member_id, created_at);
