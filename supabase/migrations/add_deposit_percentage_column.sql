-- Migration: Add deposit_percentage column to restaurant_reservations
-- Allows admin to manually enter the percentage of deposit received (0-100).
-- The reservation status is updated automatically based on this value.

ALTER TABLE restaurant_reservations
  ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 0;

-- Also add display_choice if missing (some older schemas may not have it)
ALTER TABLE restaurant_reservations
  ADD COLUMN IF NOT EXISTS display_choice VARCHAR(20);
