-- Migration: Add terroir tables required by terroirModule
-- Fixes runtime error: "Could not find the table 'public.terroir_products' in the schema cache"

-- ============================================
-- TERROIR PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS terroir_products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terroir_products_category ON terroir_products(category);
CREATE INDEX IF NOT EXISTS idx_terroir_products_is_active ON terroir_products(is_active);

-- ============================================
-- TERROIR PRODUCT VARIANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS terroir_product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES terroir_products(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  sku VARCHAR(50),
  price_unit DECIMAL(10,2) NOT NULL,
  stock_total INTEGER NOT NULL DEFAULT 0,
  stock_reserved INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terroir_variants_product ON terroir_product_variants(product_id);

-- ============================================
-- TERROIR PICKUP SLOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS terroir_pickup_slots (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  max_orders INTEGER,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TERROIR ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS terroir_orders (
  id SERIAL PRIMARY KEY,
  order_reference VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(320),
  pickup_slot_id INTEGER REFERENCES terroir_pickup_slots(id),
  status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'ready', 'picked_up', 'cancelled', 'no_show')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  total_amount DECIMAL(10,2) NOT NULL,
  payment_provider VARCHAR(50),
  payment_reference VARCHAR(100),
  deposit_deadline TIMESTAMPTZ,
  deposit_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'paid', 'expired', 'waived')),
  qr_token VARCHAR(64) UNIQUE,
  qr_status VARCHAR(20) DEFAULT 'inactive' CHECK (qr_status IN ('inactive', 'active', 'used', 'revoked')),
  processed_by INTEGER REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terroir_orders_reference ON terroir_orders(order_reference);
CREATE INDEX IF NOT EXISTS idx_terroir_orders_status ON terroir_orders(status);

-- ============================================
-- TERROIR ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS terroir_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES terroir_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES terroir_products(id),
  variant_id INTEGER REFERENCES terroir_product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terroir_order_items_order ON terroir_order_items(order_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE terroir_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_pickup_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_products' AND policyname = 'Public can read active terroir products') THEN
    CREATE POLICY "Public can read active terroir products" ON terroir_products FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_product_variants' AND policyname = 'Public can read active terroir variants') THEN
    CREATE POLICY "Public can read active terroir variants" ON terroir_product_variants FOR SELECT USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_pickup_slots' AND policyname = 'Public can read open terroir pickup slots') THEN
    CREATE POLICY "Public can read open terroir pickup slots" ON terroir_pickup_slots FOR SELECT USING (is_closed = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_orders' AND policyname = 'Public can create terroir orders') THEN
    CREATE POLICY "Public can create terroir orders" ON terroir_orders FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_orders' AND policyname = 'Public can read terroir orders') THEN
    CREATE POLICY "Public can read terroir orders" ON terroir_orders FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_order_items' AND policyname = 'Public can create terroir order items') THEN
    CREATE POLICY "Public can create terroir order items" ON terroir_order_items FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_order_items' AND policyname = 'Public can read terroir order items') THEN
    CREATE POLICY "Public can read terroir order items" ON terroir_order_items FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_products' AND policyname = 'Service role full access terroir_products') THEN
    CREATE POLICY "Service role full access terroir_products" ON terroir_products FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_product_variants' AND policyname = 'Service role full access terroir_product_variants') THEN
    CREATE POLICY "Service role full access terroir_product_variants" ON terroir_product_variants FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_pickup_slots' AND policyname = 'Service role full access terroir_pickup_slots') THEN
    CREATE POLICY "Service role full access terroir_pickup_slots" ON terroir_pickup_slots FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_orders' AND policyname = 'Service role full access terroir_orders') THEN
    CREATE POLICY "Service role full access terroir_orders" ON terroir_orders FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terroir_order_items' AND policyname = 'Service role full access terroir_order_items') THEN
    CREATE POLICY "Service role full access terroir_order_items" ON terroir_order_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_terroir_products_updated_at') THEN
    CREATE TRIGGER update_terroir_products_updated_at BEFORE UPDATE ON terroir_products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_terroir_variants_updated_at') THEN
    CREATE TRIGGER update_terroir_variants_updated_at BEFORE UPDATE ON terroir_product_variants
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_terroir_orders_updated_at') THEN
    CREATE TRIGGER update_terroir_orders_updated_at BEFORE UPDATE ON terroir_orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
