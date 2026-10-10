-- Hébergement entre bénévoles (façon Airbnb). Idempotent. Prérequis : worker/d1/hub.sql.
-- Appliquer : wrangler d1 execute ftour-bab-rayan-prod-db --remote --file worker/d1/stay.sql
-- (staging : --env staging, base ftour-bab-rayan-staging-db)
CREATE TABLE IF NOT EXISTS st_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
  kind TEXT NOT NULL CHECK (kind IN ('chambre','studio','appartement','maison','canape','tente')),
  city TEXT NOT NULL DEFAULT '' CHECK (length(city) <= 60),
  area TEXT NOT NULL DEFAULT '' CHECK (length(area) <= 60),
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 12),
  rooms INTEGER NOT NULL DEFAULT 1 CHECK (rooms BETWEEN 0 AND 10),
  price_type TEXT NOT NULL DEFAULT 'gratuit' CHECK (price_type IN ('gratuit','participation','prix')),
  price INTEGER NOT NULL DEFAULT 0 CHECK (price BETWEEN 0 AND 999999),
  -- JSON array of amenity keys (see worker/stay-d1.ts ST_AMENITIES); validated in the data layer
  amenities TEXT NOT NULL DEFAULT '[]' CHECK (length(amenities) <= 400),
  available_from TEXT CHECK (available_from IS NULL OR available_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  available_to TEXT CHECK (available_to IS NULL OR available_to GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','hidden')),
  contact_phone TEXT,
  contact_whatsapp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (available_from IS NULL OR available_to IS NULL OR available_to >= available_from),
  -- free stays carry no price; a paid stay must carry one
  CHECK (price_type <> 'gratuit' OR price = 0),
  CHECK (price_type <> 'prix' OR price > 0)
);
CREATE INDEX IF NOT EXISTS idx_st_listings_status ON st_listings(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_st_listings_kind ON st_listings(kind, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_st_listings_city ON st_listings(city, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_st_listings_member ON st_listings(member_id, created_at);

-- r2_key = chemin dans le bucket logique "hub" (<memberId>/<uuid>.<ext>)
CREATE TABLE IF NOT EXISTS st_listing_media (
  listing_id INTEGER NOT NULL REFERENCES st_listings(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 5),
  PRIMARY KEY (listing_id, position)
);

-- Une demande de séjour. host_id est dénormalisé depuis st_listings pour lister/compter sans jointure.
CREATE TABLE IF NOT EXISTS st_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES st_listings(id) ON DELETE CASCADE,
  guest_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  host_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date TEXT NOT NULL CHECK (end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  guests INTEGER NOT NULL DEFAULT 1 CHECK (guests BETWEEN 1 AND 12),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  host_reply TEXT CHECK (host_reply IS NULL OR length(host_reply) <= 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_at TEXT,
  CHECK (end_date > start_date),
  CHECK (guest_id <> host_id)
);
CREATE INDEX IF NOT EXISTS idx_st_requests_listing ON st_requests(listing_id, status, start_date);
CREATE INDEX IF NOT EXISTS idx_st_requests_guest ON st_requests(guest_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_st_requests_host ON st_requests(host_id, id DESC);

CREATE TABLE IF NOT EXISTS st_request_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES st_requests(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_st_messages_request ON st_request_messages(request_id, id);
CREATE INDEX IF NOT EXISTS idx_st_messages_sender ON st_request_messages(sender_id, created_at);

-- Un avis par demande, laissé par le voyageur après acceptation.
CREATE TABLE IF NOT EXISTS st_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL UNIQUE REFERENCES st_requests(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES st_listings(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_st_reviews_listing ON st_reviews(listing_id, id DESC);

CREATE TABLE IF NOT EXISTS st_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing','message')),
  target_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (target_type, target_id, member_id)
);
