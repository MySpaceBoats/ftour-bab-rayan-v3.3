-- Fix: Remove FK constraints on performed_by and counted_by that reference the Supabase
-- public.users table (which is empty). The users are stored in MySQL, not Supabase.
-- These columns remain as plain integers for audit purposes (stores MySQL user ID).

ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_performed_by_fkey;

ALTER TABLE inventory_counts
  DROP CONSTRAINT IF EXISTS inventory_counts_counted_by_fkey;
