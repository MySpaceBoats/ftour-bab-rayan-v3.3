-- ============================================================
-- AI LAYER – Ftour Bab Rayan
-- Adds: ai_conversations, ai_messages, ai_action_logs
-- ============================================================

-- ── 1. AI Conversations ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_openid TEXT NOT NULL,
  title       TEXT,                               -- auto-generated from first message
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations (user_openid);

-- ── 2. AI Messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  context_used    JSONB,   -- RAG snippets that were injected
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages (conversation_id, created_at);

-- ── 3. AI Action Logs (smart UX logging) ─────────────────────
-- Tracks user interactions for AI-powered behavioural analysis
CREATE TABLE IF NOT EXISTS ai_action_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_openid TEXT,
  session_id  TEXT,
  action      TEXT NOT NULL,          -- e.g. "page_view", "click", "form_submit"
  entity_type TEXT,                   -- e.g. "volunteer", "order", "reservation"
  entity_id   TEXT,
  metadata    JSONB,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_log_user   ON ai_action_logs (user_openid, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_log_action ON ai_action_logs (action, created_at);

-- ── 4. Row-level security ────────────────────────────────────
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_logs   ENABLE ROW LEVEL SECURITY;

-- Service-role bypass (server only) – no public access
CREATE POLICY "service_role_only_conv"  ON ai_conversations  USING (false);
CREATE POLICY "service_role_only_msg"   ON ai_messages       USING (false);
CREATE POLICY "service_role_only_log"   ON ai_action_logs    USING (false);

-- ── 5. Updated-at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ai_conversations_updated_at'
  ) THEN
    CREATE TRIGGER ai_conversations_updated_at
      BEFORE UPDATE ON ai_conversations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
