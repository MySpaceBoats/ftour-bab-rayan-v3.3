-- ============================================
-- MODULE BLOG COMMUNAUTAIRE — Ftour Bab Rayan
-- 2026-03-19
-- ============================================

-- Enum: type d'auteur
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_type') THEN
    CREATE TYPE blog_post_type AS ENUM ('benevole', 'participant', 'equipe', 'autre');
  END IF;
END
$$;

-- Enum: statut de modération
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_post_status') THEN
    CREATE TYPE blog_post_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

-- Table principale des articles de blog
CREATE TABLE IF NOT EXISTS blog_posts (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  content         TEXT NOT NULL,
  excerpt         VARCHAR(300),
  hook            VARCHAR(255),                     -- "Ton expérience en une phrase"
  author_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name     VARCHAR(200) NOT NULL,
  type            blog_post_type NOT NULL DEFAULT 'participant',
  categories      TEXT[] NOT NULL DEFAULT '{}',     -- tableau : ['ressenti','analyse',...]
  cover_image     TEXT,
  likes           INTEGER NOT NULL DEFAULT 0,
  views           INTEGER NOT NULL DEFAULT 0,
  status          blog_post_status NOT NULL DEFAULT 'pending',
  rejection_note  TEXT,                             -- note de refus par l'admin
  consented       BOOLEAN NOT NULL DEFAULT false,   -- consentement publication
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des likes (pour éviter les doubles likes)
CREATE TABLE IF NOT EXISTS blog_post_likes (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status       ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug         ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id    ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_type         ON blog_posts(type);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at   ON blog_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_likes        ON blog_posts(likes DESC);
CREATE INDEX IF NOT EXISTS idx_blog_post_likes_post_id ON blog_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_likes_user_id ON blog_post_likes(user_id);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_posts_updated_at();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
