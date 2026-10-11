-- Assistant IA : conversations, messages, dossiers admin, compteurs anti-abus. Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/ai.sql
CREATE TABLE IF NOT EXISTS ai_hits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_hits ON ai_hits(key, at);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  source TEXT CHECK (source IS NULL OR source IN ('pro','market','stay')),
  item_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_member ON ai_conversations(member_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conv_updated ON ai_conversations(updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','admin')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS ai_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL UNIQUE REFERENCES ai_conversations(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  source TEXT,
  item_id INTEGER,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_cases_status ON ai_cases(status, id DESC);
