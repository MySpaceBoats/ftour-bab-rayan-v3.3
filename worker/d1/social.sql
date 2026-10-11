-- Amis et abonnements de l'espace bénévole. Idempotent.
CREATE TABLE IF NOT EXISTS hub_friendships (
  requester_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_friendships_pair ON hub_friendships(min(requester_id,addressee_id), max(requester_id,addressee_id));
CREATE INDEX IF NOT EXISTS idx_hub_friendships_addressee ON hub_friendships(addressee_id, status);

CREATE TABLE IF NOT EXISTS hub_follows (
  follower_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES hub_members(id) ON DELETE CASCADE,
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0,1)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_follows_followee ON hub_follows(followee_id);
