-- Migration: Fix restaurant_reservations table for Supabase
-- The worker code expects snake_case columns but the table may have been
-- created with different column names or may be missing columns entirely.
--
-- Run this SQL in the Supabase SQL Editor to fix reservation creation errors.

-- Drop the old table if it has wrong schema and recreate it properly
-- WARNING: This will delete existing reservation data. Only run if the table
-- has no important data or if inserts have never worked.
DROP TABLE IF EXISTS restaurant_reservation_allocations;
DROP TABLE IF EXISTS restaurant_reservations;

CREATE TABLE restaurant_reservations (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('particulier', 'entreprise', 'groupe')),
  seats_total INTEGER NOT NULL,
  date DATE,
  -- Contact
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(320),
  -- Company (entreprise)
  company_name VARCHAR(255),
  -- Group (groupe)
  group_name VARCHAR(255),
  group_type VARCHAR(50),
  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'pending_confirmation', 'pending_validation',
    'validated_pending_payment', 'confirmed', 'paid_confirmed',
    'rejected', 'refused', 'cancelled', 'completed', 'no_show', 'checked_in'
  )),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'not_applicable' CHECK (payment_status IN (
    'not_applicable', 'not_requested', 'pending', 'pending_payment', 'paid', 'failed', 'refunded'
  )),
  payment_amount DECIMAL(10,2),
  payment_provider VARCHAR(50),
  payment_reference VARCHAR(100),
  -- QR
  qr_token VARCHAR(64) UNIQUE,
  qr_status VARCHAR(20) DEFAULT 'inactive' CHECK (qr_status IN ('inactive', 'active', 'used', 'revoked')),
  -- Hold expiration
  expires_at TIMESTAMPTZ,
  -- Tracking
  processed_by INTEGER,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_restaurant_reservations_reference ON restaurant_reservations(reference);
CREATE INDEX idx_restaurant_reservations_type ON restaurant_reservations(type);
CREATE INDEX idx_restaurant_reservations_status ON restaurant_reservations(status);
CREATE INDEX idx_restaurant_reservations_date ON restaurant_reservations(date);

-- RLS
ALTER TABLE restaurant_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can create restaurant reservations" ON restaurant_reservations
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read restaurant reservations" ON restaurant_reservations
  FOR SELECT USING (true);
CREATE POLICY "Service role full access restaurant_reservations" ON restaurant_reservations
  FOR ALL USING (true) WITH CHECK (true);

-- Checkins table for scan validation
CREATE TABLE IF NOT EXISTS reservation_checkins (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER NOT NULL REFERENCES restaurant_reservations(id) ON DELETE CASCADE,
  validation_mode VARCHAR(20) DEFAULT 'scan',
  validated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reservation_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access reservation_checkins" ON reservation_checkins
  FOR ALL USING (true) WITH CHECK (true);
