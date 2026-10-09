-- Community blog on Cloudflare D1. Apply: wrangler d1 execute <db> --remote --file worker/d1/blog.sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  content        TEXT NOT NULL,
  excerpt        TEXT,
  hook           TEXT,
  author_id      INTEGER,            -- users live in Supabase: no FK
  author_name    TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'participant' CHECK (type IN ('benevole','participant','equipe','autre')),
  categories     TEXT NOT NULL DEFAULT '[]',  -- JSON array
  cover_image    TEXT,
  likes          INTEGER NOT NULL DEFAULT 0,
  views          INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_note TEXT,
  consented      INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS blog_post_likes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_created ON blog_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
