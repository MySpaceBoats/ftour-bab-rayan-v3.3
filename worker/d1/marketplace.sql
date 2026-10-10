-- Marketplace de l'espace bénévole. Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/marketplace.sql
CREATE TABLE IF NOT EXISTS mk_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  price INTEGER NOT NULL CHECK (price BETWEEN 0 AND 9999999),
  category TEXT NOT NULL CHECK (category IN ('maison','mode','high-tech','enfants','livres','vehicules','autre')),
  item_condition TEXT NOT NULL CHECK (item_condition IN ('neuf','bon','correct')),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','hidden')),
  contact_phone TEXT,
  contact_whatsapp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_mk_listings_status ON mk_listings(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_mk_listings_cat ON mk_listings(category, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_mk_listings_member ON mk_listings(member_id, created_at);

-- r2_key = chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>)
CREATE TABLE IF NOT EXISTS mk_listing_media (
  listing_id INTEGER NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
  PRIMARY KEY (listing_id, position)
);

CREATE TABLE IF NOT EXISTS mk_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_mk_comments_listing ON mk_comments(listing_id, id);
CREATE INDEX IF NOT EXISTS idx_mk_comments_member ON mk_comments(member_id, created_at);

CREATE TABLE IF NOT EXISTS mk_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  UNIQUE (listing_id, buyer_id),
  CHECK (buyer_id <> seller_id)
);
CREATE INDEX IF NOT EXISTS idx_mk_threads_buyer ON mk_threads(buyer_id, last_message_at);
CREATE INDEX IF NOT EXISTS idx_mk_threads_seller ON mk_threads(seller_id, last_message_at);

CREATE TABLE IF NOT EXISTS mk_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES mk_threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_mk_messages_thread ON mk_messages(thread_id, id);
CREATE INDEX IF NOT EXISTS idx_mk_messages_sender ON mk_messages(sender_id, created_at);

CREATE TABLE IF NOT EXISTS mk_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing','comment')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (target_type, target_id, member_id)
);
