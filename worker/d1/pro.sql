-- Sous-espace Pro de l'espace bénévole. Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/pro.sql
CREATE TABLE IF NOT EXISTS pro_profiles (
  member_id INTEGER PRIMARY KEY REFERENCES hub_members(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '' CHECK (length(headline) <= 80),
  company TEXT NOT NULL DEFAULT '' CHECK (length(company) <= 80),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  skills TEXT NOT NULL DEFAULT '[]',
  open_to_work INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pro_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  link TEXT CHECK (link IS NULL OR length(link) <= 300),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pro_posts_status ON pro_posts(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_pro_posts_member ON pro_posts(member_id, created_at);

-- r2_key = chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>)
CREATE TABLE IF NOT EXISTS pro_post_media (
  post_id INTEGER NOT NULL REFERENCES pro_posts(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  PRIMARY KEY (post_id, position)
);

CREATE TABLE IF NOT EXISTS pro_likes (
  post_id INTEGER NOT NULL REFERENCES pro_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, member_id)
);

CREATE TABLE IF NOT EXISTS pro_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES pro_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pro_comments_post ON pro_comments(post_id, id);
CREATE INDEX IF NOT EXISTS idx_pro_comments_member ON pro_comments(member_id, created_at);

CREATE TABLE IF NOT EXISTS pro_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 80),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  type TEXT NOT NULL CHECK (type IN ('cdi','cdd','stage','freelance','benevolat')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 3000),
  contact TEXT CHECK (contact IS NULL OR length(contact) <= 120),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_status ON pro_jobs(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_type ON pro_jobs(type, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_pro_jobs_member ON pro_jobs(member_id, created_at);

-- member_a < member_b (paire ordonnée, interdit aussi la discussion avec soi-même) ; job_id 0 = discussion directe
CREATE TABLE IF NOT EXISTS pro_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_a INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  member_b INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  UNIQUE (member_a, member_b, job_id),
  CHECK (member_a < member_b)
);
CREATE INDEX IF NOT EXISTS idx_pro_threads_a ON pro_threads(member_a, last_message_at);
CREATE INDEX IF NOT EXISTS idx_pro_threads_b ON pro_threads(member_b, last_message_at);
CREATE INDEX IF NOT EXISTS idx_pro_threads_creator ON pro_threads(created_by, created_at);

CREATE TABLE IF NOT EXISTS pro_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES pro_threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pro_messages_thread ON pro_messages(thread_id, id);
CREATE INDEX IF NOT EXISTS idx_pro_messages_sender ON pro_messages(sender_id, created_at);

CREATE TABLE IF NOT EXISTS pro_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','job')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (target_type, target_id, member_id)
);
