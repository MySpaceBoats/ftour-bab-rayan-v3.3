-- ============================================
-- FTOUR BAB RAYAN - SUPABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  open_id VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  phone VARCHAR(20),
  login_method VARCHAR(64),
  role VARCHAR(40) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin', 'admin_ops', 'admin_boutique', 'admin_dons', 'scanner', 'admin_restaurant_particuliers', 'admin_restaurant_entreprises', 'admin_restaurant_groupes', 'admin_patisserie', 'admin_terroir')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signed_in TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_open_id ON users(open_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- RAMADAN DAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ramadan_days (
  id SERIAL PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE,
  date DATE NOT NULL UNIQUE,
  hijri_date VARCHAR(50),
  capacity INTEGER NOT NULL DEFAULT 120,
  registered_count INTEGER NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT true,
  iftar_time TIME,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ramadan_days_date ON ramadan_days(date);
CREATE INDEX idx_ramadan_days_is_open ON ramadan_days(is_open);

-- ============================================
-- VOLUNTEERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS volunteers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(100),
  day_id INTEGER NOT NULL REFERENCES ramadan_days(id) ON DELETE CASCADE,
  qr_token VARCHAR(64) NOT NULL UNIQUE,
  qr_status VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (qr_status IN ('generated', 'validated', 'expired', 'invalid')),
  status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'present', 'absent', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
  scanned_at TIMESTAMPTZ,
  scanned_by INTEGER REFERENCES users(id),
  volunteer_slots JSONB DEFAULT '[]'::jsonb,
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_volunteers_day_id ON volunteers(day_id);
CREATE INDEX idx_volunteers_email ON volunteers(email);
CREATE INDEX idx_volunteers_qr_token ON volunteers(qr_token);
CREATE INDEX idx_volunteers_status ON volunteers(status);
CREATE INDEX idx_volunteers_qr_status ON volunteers(qr_status);

-- ============================================
-- CHECKINS TABLE (for audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS checkins (
  id SERIAL PRIMARY KEY,
  volunteer_id INTEGER NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_by INTEGER REFERENCES users(id),
  validation_mode VARCHAR(10) NOT NULL DEFAULT 'scan' CHECK (validation_mode IN ('scan', 'manual')),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkins_volunteer_id ON checkins(volunteer_id);
CREATE INDEX idx_checkins_token ON checkins(token);
CREATE INDEX idx_checkins_scanned_at ON checkins(scanned_at);

-- ============================================
-- GOODIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goodies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goodies_is_active ON goodies(is_active);
CREATE INDEX idx_goodies_category ON goodies(category);

-- ============================================
-- GOODIE VARIANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS goodie_variants (
  id SERIAL PRIMARY KEY,
  goodie_id INTEGER NOT NULL REFERENCES goodies(id) ON DELETE CASCADE,
  size VARCHAR(20),
  color VARCHAR(50),
  stock INTEGER NOT NULL DEFAULT 0,
  price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goodie_variants_goodie_id ON goodie_variants(goodie_id);
CREATE INDEX idx_goodie_variants_is_available ON goodie_variants(is_available);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_reference VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(320) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'paid', 'delivered', 'cancelled')),
  pickup_date DATE,
  pickup_location TEXT,
  notes TEXT,
  processed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_reference ON orders(order_reference);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  goodie_id INTEGER NOT NULL REFERENCES goodies(id),
  variant_id INTEGER REFERENCES goodie_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================
-- DONATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  donation_reference VARCHAR(20) NOT NULL UNIQUE,
  donor_name VARCHAR(200) NOT NULL,
  donor_email VARCHAR(320) NOT NULL,
  donor_phone VARCHAR(20),
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('transfer', 'on_site')),
  status VARCHAR(20) NOT NULL DEFAULT 'promised' CHECK (status IN ('promised', 'pending', 'received', 'cancelled')),
  message TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  accepts_updates BOOLEAN NOT NULL DEFAULT false,
  processed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donations_reference ON donations(donation_reference);
CREATE INDEX idx_donations_status ON donations(status);
CREATE INDEX idx_donations_donor_email ON donations(donor_email);

-- ============================================
-- CONTACT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(200),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_is_read ON contact_messages(is_read);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ramadan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE goodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE goodie_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Public read access for ramadan_days and goodies (for public pages)
CREATE POLICY "Public can read open ramadan days" ON ramadan_days
  FOR SELECT USING (is_open = true);

CREATE POLICY "Public can read active goodies" ON goodies
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read available variants" ON goodie_variants
  FOR SELECT USING (is_available = true);

-- Public can create volunteers (registration)
CREATE POLICY "Public can register as volunteer" ON volunteers
  FOR INSERT WITH CHECK (true);

-- Public can read their own volunteer record by qr_token
CREATE POLICY "Public can read volunteer by token" ON volunteers
  FOR SELECT USING (true);

-- Public can create orders
CREATE POLICY "Public can create orders" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read orders" ON orders
  FOR SELECT USING (true);

CREATE POLICY "Public can create order items" ON order_items
  FOR INSERT WITH CHECK (true);

-- Public can create donations
CREATE POLICY "Public can create donations" ON donations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read donations" ON donations
  FOR SELECT USING (true);

-- Public can create contact messages
CREATE POLICY "Public can send contact messages" ON contact_messages
  FOR INSERT WITH CHECK (true);

-- Service role (admin) has full access - these policies allow service_role to bypass RLS
-- Note: service_role key automatically bypasses RLS, but we add explicit policies for clarity

CREATE POLICY "Service role full access users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ramadan_days" ON ramadan_days FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access volunteers" ON volunteers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access checkins" ON checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access goodies" ON goodies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access goodie_variants" ON goodie_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access donations" ON donations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access contact_messages" ON contact_messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ramadan_days_updated_at BEFORE UPDATE ON ramadan_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_volunteers_updated_at BEFORE UPDATE ON volunteers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goodies_updated_at BEFORE UPDATE ON goodies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGER TO UPDATE registered_count
-- ============================================
CREATE OR REPLACE FUNCTION update_registered_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ramadan_days SET registered_count = registered_count + 1 WHERE id = NEW.day_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ramadan_days SET registered_count = registered_count - 1 WHERE id = OLD.day_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.day_id != NEW.day_id THEN
    UPDATE ramadan_days SET registered_count = registered_count - 1 WHERE id = OLD.day_id;
    UPDATE ramadan_days SET registered_count = registered_count + 1 WHERE id = NEW.day_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_volunteer_count AFTER INSERT OR DELETE OR UPDATE OF day_id ON volunteers
  FOR EACH ROW EXECUTE FUNCTION update_registered_count();

-- ============================================
-- RESTAURANT SLOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_slots (
  id SERIAL PRIMARY KEY,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  cap_jardin_global INTEGER NOT NULL DEFAULT 120,
  cap_brasserie INTEGER NOT NULL DEFAULT 50,
  cap_corpo INTEGER NOT NULL DEFAULT 50,
  cap_jardin_libre INTEGER NOT NULL DEFAULT 20,
  booked_jardin_global INTEGER NOT NULL DEFAULT 0,
  booked_brasserie INTEGER NOT NULL DEFAULT 0,
  booked_corpo INTEGER NOT NULL DEFAULT 0,
  booked_jardin_libre INTEGER NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restaurant_slots_start_at ON restaurant_slots(start_at);
CREATE INDEX idx_restaurant_slots_is_closed ON restaurant_slots(is_closed);

-- ============================================
-- RESTAURANT RESERVATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_reservations (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('particulier', 'entreprise', 'groupe')),
  seats_total INTEGER NOT NULL,
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
  status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending_confirmation', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'not_applicable' CHECK (payment_status IN ('not_applicable', 'pending', 'paid', 'failed', 'refunded')),
  payment_amount DECIMAL(10,2),
  payment_provider VARCHAR(50),
  payment_reference VARCHAR(100),
  -- QR
  qr_token VARCHAR(64) UNIQUE,
  qr_status VARCHAR(20) DEFAULT 'inactive' CHECK (qr_status IN ('inactive', 'active', 'used', 'revoked')),
  -- Hold expiration
  expires_at TIMESTAMPTZ,
  -- Tracking
  processed_by INTEGER REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restaurant_reservations_reference ON restaurant_reservations(reference);
CREATE INDEX idx_restaurant_reservations_type ON restaurant_reservations(type);
CREATE INDEX idx_restaurant_reservations_slot_id ON restaurant_reservations(slot_id);
CREATE INDEX idx_restaurant_reservations_status ON restaurant_reservations(status);

-- ============================================
-- RESTAURANT RESERVATION ALLOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_reservation_allocations (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER NOT NULL REFERENCES restaurant_reservations(id) ON DELETE CASCADE,
  bucket VARCHAR(20) NOT NULL CHECK (bucket IN ('brasserie', 'corpo', 'jardin_libre')),
  seats INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restaurant_allocations_reservation ON restaurant_reservation_allocations(reservation_id);

-- RLS for restaurant tables
ALTER TABLE restaurant_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_reservation_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read open restaurant slots" ON restaurant_slots
  FOR SELECT USING (is_closed = false);
CREATE POLICY "Public can create restaurant reservations" ON restaurant_reservations
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read restaurant reservations" ON restaurant_reservations
  FOR SELECT USING (true);
CREATE POLICY "Service role full access restaurant_slots" ON restaurant_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access restaurant_reservations" ON restaurant_reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access restaurant_reservation_allocations" ON restaurant_reservation_allocations FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_restaurant_slots_updated_at BEFORE UPDATE ON restaurant_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurant_reservations_updated_at BEFORE UPDATE ON restaurant_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

CREATE INDEX idx_terroir_products_category ON terroir_products(category);
CREATE INDEX idx_terroir_products_is_active ON terroir_products(is_active);

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

CREATE INDEX idx_terroir_variants_product ON terroir_product_variants(product_id);

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
  qr_token VARCHAR(64) UNIQUE,
  qr_status VARCHAR(20) DEFAULT 'inactive' CHECK (qr_status IN ('inactive', 'active', 'used', 'revoked')),
  processed_by INTEGER REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_terroir_orders_reference ON terroir_orders(order_reference);
CREATE INDEX idx_terroir_orders_status ON terroir_orders(status);

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

CREATE INDEX idx_terroir_order_items_order ON terroir_order_items(order_id);

-- RLS for terroir tables
ALTER TABLE terroir_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_pickup_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE terroir_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active terroir products" ON terroir_products FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read active terroir variants" ON terroir_product_variants FOR SELECT USING (is_active = true);
CREATE POLICY "Public can read open terroir pickup slots" ON terroir_pickup_slots FOR SELECT USING (is_closed = false);
CREATE POLICY "Public can create terroir orders" ON terroir_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read terroir orders" ON terroir_orders FOR SELECT USING (true);
CREATE POLICY "Public can create terroir order items" ON terroir_order_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access terroir_products" ON terroir_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access terroir_product_variants" ON terroir_product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access terroir_pickup_slots" ON terroir_pickup_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access terroir_orders" ON terroir_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access terroir_order_items" ON terroir_order_items FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_terroir_products_updated_at BEFORE UPDATE ON terroir_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_terroir_variants_updated_at BEFORE UPDATE ON terroir_product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_terroir_orders_updated_at BEFORE UPDATE ON terroir_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
