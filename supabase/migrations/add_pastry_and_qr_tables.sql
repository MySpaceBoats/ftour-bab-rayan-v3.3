-- Migration: Add pastries, pastry_orders, qr_tokens, qr_scans tables
-- Also adds missing RLS read policies for order_items and terroir_order_items
-- Run this in the Supabase SQL Editor if the tables are missing

-- ============================================
-- PASTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pastries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category VARCHAR(100),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pastries_active ON pastries(active);

-- ============================================
-- PASTRY ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pastry_orders (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(320),
  items JSONB NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'paid', 'cancelled')),
  order_status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (order_status IN ('reserved', 'paid', 'handed', 'cancelled')),
  qr_token VARCHAR(64) UNIQUE,
  scanned_at TIMESTAMPTZ,
  scanned_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pastry_orders_reference ON pastry_orders(reference);
CREATE INDEX IF NOT EXISTS idx_pastry_orders_status ON pastry_orders(order_status);

-- ============================================
-- QR TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS qr_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  scope VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_scope ON qr_tokens(scope);

-- ============================================
-- QR SCANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS qr_scans (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) NOT NULL,
  scope VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  validation_action VARCHAR(50) NOT NULL,
  validated_by INTEGER NOT NULL REFERENCES users(id),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_scans_token ON qr_scans(token);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Pastries
ALTER TABLE pastries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pastry_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pastries' AND policyname = 'Public can read active pastries') THEN
    CREATE POLICY "Public can read active pastries" ON pastries FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pastry_orders' AND policyname = 'Public can create pastry orders') THEN
    CREATE POLICY "Public can create pastry orders" ON pastry_orders FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pastry_orders' AND policyname = 'Public can read pastry orders') THEN
    CREATE POLICY "Public can read pastry orders" ON pastry_orders FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pastries' AND policyname = 'Service role full access pastries') THEN
    CREATE POLICY "Service role full access pastries" ON pastries FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pastry_orders' AND policyname = 'Service role full access pastry_orders') THEN
    CREATE POLICY "Service role full access pastry_orders" ON pastry_orders FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qr_tokens' AND policyname = 'Service role full access qr_tokens') THEN
    CREATE POLICY "Service role full access qr_tokens" ON qr_tokens FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qr_scans' AND policyname = 'Service role full access qr_scans') THEN
    CREATE POLICY "Service role full access qr_scans" ON qr_scans FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Missing read policies for order_items and terroir_order_items (only if tables exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Public can read order items') THEN
      CREATE POLICY "Public can read order items" ON order_items FOR SELECT USING (true);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'terroir_order_items') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_order_items' AND policyname = 'Public can read terroir order items') THEN
      CREATE POLICY "Public can read terroir order items" ON terroir_order_items FOR SELECT USING (true);
    END IF;
  END IF;
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pastries_updated_at') THEN
    CREATE TRIGGER update_pastries_updated_at BEFORE UPDATE ON pastries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pastry_orders_updated_at') THEN
    CREATE TRIGGER update_pastry_orders_updated_at BEFORE UPDATE ON pastry_orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
