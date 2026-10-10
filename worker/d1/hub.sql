-- Espace bénévole. Idempotent. Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/hub.sql
CREATE TABLE IF NOT EXISTS hub_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_key TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS hub_login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hub_login_email ON hub_login_tokens(email, created_at);

CREATE TABLE IF NOT EXISTS hub_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS hub_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post','announcement')),
  pinned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_posts_feed ON hub_posts(status, pinned, id DESC);
CREATE INDEX IF NOT EXISTS idx_hub_posts_member ON hub_posts(member_id, created_at);

-- r2_key = chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>), pas la clé R2 complète
CREATE TABLE IF NOT EXISTS hub_post_media (
  post_id INTEGER NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  PRIMARY KEY (post_id, position)
);

CREATE TABLE IF NOT EXISTS hub_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_hub_comments_post ON hub_comments(post_id, id);
CREATE INDEX IF NOT EXISTS idx_hub_comments_member ON hub_comments(member_id, created_at);

CREATE TABLE IF NOT EXISTS hub_likes (
  post_id INTEGER NOT NULL REFERENCES hub_posts(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (post_id, member_id)
);

CREATE TABLE IF NOT EXISTS hub_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (target_type, target_id, member_id)
);

CREATE TABLE IF NOT EXISTS hub_uploads (
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hub_uploads_member ON hub_uploads(member_id, created_at);

-- Photos du Hub proposées à la galerie publique (une proposition par photo ; la galerie reste en brouillon jusqu'à modération admin)
CREATE TABLE IF NOT EXISTS hub_gallery_proposals (
  r2_key TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  gallery_photo_id TEXT,
  created_at TEXT NOT NULL
);

-- Identifiants : un mot de passe (hash PBKDF2) et une adresse de récupération vérifiée par membre. password_hash NULL = pas de mot de passe
CREATE TABLE IF NOT EXISTS hub_credentials (
  member_id INTEGER PRIMARY KEY REFERENCES hub_members(id) ON DELETE CASCADE,
  password_hash TEXT,
  recovery_email TEXT,
  recovery_verified_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_credentials_recovery ON hub_credentials(recovery_email);

-- Échecs de connexion par mot de passe (clé "pw:<email>" ou "ip:<ip>") pour le rate-limit
CREATE TABLE IF NOT EXISTS hub_auth_attempts (
  key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hub_auth_attempts ON hub_auth_attempts(key, created_at);
