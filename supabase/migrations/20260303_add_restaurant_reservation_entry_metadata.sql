ALTER TABLE restaurant_reservations
  ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'website';

ALTER TABLE restaurant_reservations
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;

ALTER TABLE restaurant_reservations
  ADD COLUMN IF NOT EXISTS created_by_email TEXT;

UPDATE restaurant_reservations
SET entry_source = 'website'
WHERE entry_source IS NULL;
