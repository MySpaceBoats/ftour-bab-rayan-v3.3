-- Migration: Add custom_qr_codes table for persistent admin-generated QR codes
-- Allows admins to save, view, and delete custom URL QR codes

CREATE TABLE IF NOT EXISTS custom_qr_codes (
  id SERIAL PRIMARY KEY,
  label VARCHAR(255) NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for listing by creation date
CREATE INDEX IF NOT EXISTS idx_custom_qr_codes_created_at ON custom_qr_codes(created_at DESC);
