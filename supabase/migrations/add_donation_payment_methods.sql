-- Migration: Add cheque and cash payment methods to donations table
-- Replaces 'on_site' with 'cheque' and 'cash'

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_payment_method_check;

ALTER TABLE donations ADD CONSTRAINT donations_payment_method_check
  CHECK (payment_method IN ('transfer', 'cheque', 'cash'));

-- Update existing 'on_site' donations to 'cash' (closest equivalent)
UPDATE donations SET payment_method = 'cash' WHERE payment_method = 'on_site';
