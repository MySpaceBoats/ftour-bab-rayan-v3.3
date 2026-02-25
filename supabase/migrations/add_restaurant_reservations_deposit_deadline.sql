-- Migration: add deposit deadline workflow for restaurant reservations

ALTER TABLE restaurant_reservations
  ADD COLUMN IF NOT EXISTS deposit_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Keep allowed status values in sync with app logic
ALTER TABLE restaurant_reservations
  DROP CONSTRAINT IF EXISTS restaurant_reservations_status_check;

ALTER TABLE restaurant_reservations
  ADD CONSTRAINT restaurant_reservations_status_check
  CHECK (status IN ('submitted', 'pending_confirmation', 'pending_validation', 'validated_pending_payment', 'confirmed', 'paid_confirmed', 'rejected', 'refused', 'cancelled', 'cancelled_auto', 'completed', 'no_show', 'checked_in'));

ALTER TABLE restaurant_reservations
  DROP CONSTRAINT IF EXISTS restaurant_reservations_deposit_status_check;

ALTER TABLE restaurant_reservations
  ADD CONSTRAINT restaurant_reservations_deposit_status_check
  CHECK (deposit_status IN ('pending', 'paid', 'expired', 'waived'));

CREATE INDEX IF NOT EXISTS idx_restaurant_reservations_deposit_deadline
  ON restaurant_reservations(deposit_deadline);
