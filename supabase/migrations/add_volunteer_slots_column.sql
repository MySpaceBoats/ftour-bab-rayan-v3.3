-- Migration: Add volunteer_slots and confirmed_at columns to volunteers table
-- These columns were missing from the original schema, causing timeslots
-- selected during registration to not appear on the admin dashboard.
--
-- Run this SQL in the Supabase SQL Editor to fix the issue.

-- Add volunteer_slots column (JSONB array of selected timeslot keys)
ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS volunteer_slots JSONB DEFAULT '[]'::jsonb;

-- Add confirmed_at column (timestamp when volunteer QR code was confirmed)
ALTER TABLE volunteers
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
