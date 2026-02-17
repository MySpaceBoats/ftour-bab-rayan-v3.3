-- Migration: Add payments, payment_logs, and payment_methods_config tables
-- These tables were referenced in the backend code but missing from the schema

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_reference VARCHAR(50) NOT NULL UNIQUE,
  user_name VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(20),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MAD',
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('bank_transfer', 'cheque', 'cash', 'paypal')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'validated', 'cancelled', 'cheque_cashed')),
  description TEXT,
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(50),
  metadata JSONB,
  validated_at TIMESTAMPTZ,
  validated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_email ON payments(email);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ============================================
-- PAYMENT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_logs (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payments(id),
  action VARCHAR(50) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  notes TEXT,
  performed_by INTEGER REFERENCES users(id),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON payment_logs(payment_id);

-- ============================================
-- PAYMENT METHODS CONFIG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods_config (
  id SERIAL PRIMARY KEY,
  method VARCHAR(20) NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  label VARCHAR(100),
  instructions TEXT,
  config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access payment_logs" ON payment_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access payment_methods_config" ON payment_methods_config FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
