-- Migration: Update volunteer capacity from 50 to 120
-- Updates all existing ramadan_days that still have the old default capacity of 50
-- and changes the column default to 120 for future rows.

-- Update existing days with capacity = 50 to 120
UPDATE ramadan_days SET capacity = 120 WHERE capacity = 50;

-- Update the default value for future rows
ALTER TABLE ramadan_days ALTER COLUMN capacity SET DEFAULT 120;
