ALTER TABLE restaurant_reservations
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_received DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_adult INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nb_kids INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS resp_resa VARCHAR(20) NOT NULL DEFAULT 'Nayla';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_reservations_payment_mode_check'
  ) THEN
    ALTER TABLE restaurant_reservations
      ADD CONSTRAINT restaurant_reservations_payment_mode_check
      CHECK (payment_mode IN ('cash', 'virement', 'espece'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'restaurant_reservations_resp_resa_check'
  ) THEN
    ALTER TABLE restaurant_reservations
      ADD CONSTRAINT restaurant_reservations_resp_resa_check
      CHECK (resp_resa IN ('Nayla', 'Hind', 'Kamal', 'Rita'));
  END IF;
END $$;
