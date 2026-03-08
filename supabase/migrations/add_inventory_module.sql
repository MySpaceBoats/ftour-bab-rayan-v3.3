-- ============================================================
-- INVENTORY MODULE — Ftour Bab Rayan
-- Gestion de stock multi-niveaux : Global / Buffer / POS
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Catalogue centralisé des produits stockables
CREATE TABLE IF NOT EXISTS inventory_products (
  id SERIAL PRIMARY KEY,
  product_type VARCHAR(50) NOT NULL, -- goodie | goodie_variant | pastry | terroir_product | terroir_variant
  source_product_id INTEGER,          -- ID dans la table source (goodies.id, pastries.id, etc.)
  source_variant_id INTEGER,          -- ID de la variante si applicable
  sku VARCHAR(50),
  barcode VARCHAR(100),
  name VARCHAR(255) NOT NULL,         -- Snapshot du nom
  category VARCHAR(100),              -- Snapshot de la catégorie
  unit VARCHAR(30) NOT NULL DEFAULT 'piece', -- piece | kg | litre | box
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_products_src
  ON inventory_products(product_type, source_product_id, source_variant_id)
  WHERE source_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inv_products_type ON inventory_products(product_type);
CREATE INDEX IF NOT EXISTS idx_inv_products_sku   ON inventory_products(sku) WHERE sku IS NOT NULL;

-- Événements (éditions / périodes de vente)
CREATE TABLE IF NOT EXISTS inventory_events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emplacements de stock : GLOBAL / EVENT_BUFFER / POS
CREATE TABLE IF NOT EXISTS inventory_locations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('GLOBAL', 'EVENT_BUFFER', 'POS')),
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  event_id INTEGER REFERENCES inventory_events(id) ON DELETE SET NULL,
  parent_location_id INTEGER REFERENCES inventory_locations(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_locations_event ON inventory_locations(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_locations_type  ON inventory_locations(type);

-- Soldes agrégés par (produit, emplacement)
CREATE TABLE IF NOT EXISTS inventory_stock_balances (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_balance_product_location UNIQUE (product_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_balances_product  ON inventory_stock_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_balances_location ON inventory_stock_balances(location_id);

-- Journal immuable des mouvements de stock
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
    'INITIAL_LOAD',
    'PURCHASE_IN',
    'DONATION_IN',
    'PRODUCTION_IN',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'SALE',
    'RETURN_IN',
    'RETURN_OUT',
    'ADJUSTMENT_PLUS',
    'ADJUSTMENT_MINUS'
  )),
  from_location_id INTEGER REFERENCES inventory_locations(id),
  to_location_id   INTEGER REFERENCES inventory_locations(id),
  event_id         INTEGER REFERENCES inventory_events(id),
  pos_location_id  INTEGER REFERENCES inventory_locations(id),
  sale_order_id    VARCHAR(100),   -- Reference de la commande liee
  sale_line_id     VARCHAR(100),
  reference_type   VARCHAR(50),    -- order | pastry_order | terroir_order | manual
  reference_id     VARCHAR(100),
  reason           TEXT,
  note             TEXT,
  performed_by     INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_mvt_product    ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_mvt_event      ON inventory_movements(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_mvt_from_loc   ON inventory_movements(from_location_id) WHERE from_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_mvt_to_loc     ON inventory_movements(to_location_id)   WHERE to_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_mvt_created_at ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_mvt_type       ON inventory_movements(movement_type);

-- Inventaires physiques (comptages)
CREATE TABLE IF NOT EXISTS inventory_counts (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES inventory_locations(id),
  event_id    INTEGER REFERENCES inventory_events(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  counted_by  INTEGER REFERENCES users(id),
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_count_lines (
  id SERIAL PRIMARY KEY,
  count_id     INTEGER NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES inventory_products(id),
  expected_qty INTEGER NOT NULL DEFAULT 0,
  counted_qty  INTEGER,
  variance_qty INTEGER GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - expected_qty) STORED,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. TRIGGERS updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION inventory_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inv_products_updated_at') THEN
    CREATE TRIGGER trg_inv_products_updated_at
      BEFORE UPDATE ON inventory_products FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inv_events_updated_at') THEN
    CREATE TRIGGER trg_inv_events_updated_at
      BEFORE UPDATE ON inventory_events FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inv_locations_updated_at') THEN
    CREATE TRIGGER trg_inv_locations_updated_at
      BEFORE UPDATE ON inventory_locations FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inv_balances_updated_at') THEN
    CREATE TRIGGER trg_inv_balances_updated_at
      BEFORE UPDATE ON inventory_stock_balances FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inv_counts_updated_at') THEN
    CREATE TRIGGER trg_inv_counts_updated_at
      BEFORE UPDATE ON inventory_counts FOR EACH ROW EXECUTE FUNCTION inventory_set_updated_at();
  END IF;
END $$;

-- ============================================================
-- 3. TRANSACTIONAL STORED PROCEDURES
-- Ces fonctions garantissent l'atomicite des operations.
-- ============================================================

-- Helper : upsert d'un solde
CREATE OR REPLACE FUNCTION inventory_upsert_balance(
  p_product_id  INTEGER,
  p_location_id INTEGER,
  p_delta       INTEGER   -- positif = entree, negatif = sortie
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_current INTEGER;
BEGIN
  INSERT INTO inventory_stock_balances (product_id, location_id, quantity_on_hand)
  VALUES (p_product_id, p_location_id, 0)
  ON CONFLICT (product_id, location_id) DO NOTHING;

  SELECT quantity_on_hand INTO v_current
  FROM inventory_stock_balances
  WHERE product_id = p_product_id AND location_id = p_location_id
  FOR UPDATE;

  IF v_current + p_delta < 0 THEN
    RAISE EXCEPTION 'Stock insuffisant (produit %, emplacement %). Disponible: %, demandé: %',
      p_product_id, p_location_id, v_current, ABS(p_delta)
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE inventory_stock_balances
  SET quantity_on_hand = quantity_on_hand + p_delta,
      updated_at = NOW()
  WHERE product_id = p_product_id AND location_id = p_location_id;
END;
$$;

-- Approvisionner le stock global
CREATE OR REPLACE FUNCTION inventory_add_stock(
  p_product_id    INTEGER,
  p_location_id   INTEGER,
  p_quantity      INTEGER,
  p_movement_type VARCHAR,
  p_reason        TEXT,
  p_note          TEXT,
  p_performed_by  INTEGER,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id   VARCHAR DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_movement_id INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive' USING ERRCODE = 'P0002';
  END IF;

  PERFORM inventory_upsert_balance(p_product_id, p_location_id, p_quantity);

  INSERT INTO inventory_movements (
    product_id, quantity, movement_type,
    to_location_id,
    reason, note, performed_by,
    reference_type, reference_id
  ) VALUES (
    p_product_id, p_quantity, p_movement_type,
    p_location_id,
    p_reason, p_note, p_performed_by,
    p_reference_type, p_reference_id
  ) RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- Transfert entre emplacements (atomique)
CREATE OR REPLACE FUNCTION inventory_transfer_stock(
  p_product_id      INTEGER,
  p_quantity        INTEGER,
  p_from_location   INTEGER,
  p_to_location     INTEGER,
  p_event_id        INTEGER DEFAULT NULL,
  p_reason          TEXT    DEFAULT NULL,
  p_note            TEXT    DEFAULT NULL,
  p_performed_by    INTEGER DEFAULT NULL
)
RETURNS INTEGER[] LANGUAGE plpgsql AS $$
DECLARE
  v_out_id INTEGER;
  v_in_id  INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive' USING ERRCODE = 'P0002';
  END IF;

  -- Débit source
  PERFORM inventory_upsert_balance(p_product_id, p_from_location, -p_quantity);
  -- Crédit destination
  PERFORM inventory_upsert_balance(p_product_id, p_to_location,   p_quantity);

  INSERT INTO inventory_movements (
    product_id, quantity, movement_type,
    from_location_id, to_location_id, event_id,
    reason, note, performed_by
  ) VALUES (
    p_product_id, p_quantity, 'TRANSFER_OUT',
    p_from_location, p_to_location, p_event_id,
    p_reason, p_note, p_performed_by
  ) RETURNING id INTO v_out_id;

  INSERT INTO inventory_movements (
    product_id, quantity, movement_type,
    from_location_id, to_location_id, event_id,
    reason, note, performed_by
  ) VALUES (
    p_product_id, p_quantity, 'TRANSFER_IN',
    p_from_location, p_to_location, p_event_id,
    p_reason, p_note, p_performed_by
  ) RETURNING id INTO v_in_id;

  RETURN ARRAY[v_out_id, v_in_id];
END;
$$;

-- Enregistrer une vente (sur place)
CREATE OR REPLACE FUNCTION inventory_record_sale(
  p_product_id    INTEGER,
  p_quantity      INTEGER,
  p_location_id   INTEGER,
  p_event_id      INTEGER DEFAULT NULL,
  p_sale_order_id VARCHAR DEFAULT NULL,
  p_sale_line_id  VARCHAR DEFAULT NULL,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id   VARCHAR DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_performed_by  INTEGER DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_movement_id INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive' USING ERRCODE = 'P0002';
  END IF;

  PERFORM inventory_upsert_balance(p_product_id, p_location_id, -p_quantity);

  INSERT INTO inventory_movements (
    product_id, quantity, movement_type,
    from_location_id, event_id, pos_location_id,
    sale_order_id, sale_line_id,
    reference_type, reference_id,
    note, performed_by
  ) VALUES (
    p_product_id, p_quantity, 'SALE',
    p_location_id, p_event_id, p_location_id,
    p_sale_order_id, p_sale_line_id,
    p_reference_type, p_reference_id,
    p_note, p_performed_by
  ) RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$;

-- Retour POS → buffer
CREATE OR REPLACE FUNCTION inventory_record_return(
  p_product_id       INTEGER,
  p_quantity         INTEGER,
  p_from_pos_location INTEGER,
  p_to_buffer_location INTEGER,
  p_event_id          INTEGER DEFAULT NULL,
  p_reason            TEXT    DEFAULT NULL,
  p_note              TEXT    DEFAULT NULL,
  p_performed_by      INTEGER DEFAULT NULL
)
RETURNS INTEGER[] LANGUAGE plpgsql AS $$
DECLARE
  v_out_id INTEGER;
  v_in_id  INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive' USING ERRCODE = 'P0002';
  END IF;

  PERFORM inventory_upsert_balance(p_product_id, p_from_pos_location,  -p_quantity);
  PERFORM inventory_upsert_balance(p_product_id, p_to_buffer_location,  p_quantity);

  INSERT INTO inventory_movements (
    product_id, quantity, movement_type,
    from_location_id, to_location_id, event_id, pos_location_id,
    reason, note, performed_by
  ) VALUES (
    p_product_id, p_quantity, 'RETURN_OUT',
    p_from_pos_location, p_to_buffer_location, p_event_id, p_from_pos_location,
    p_reason, p_note, p_performed_by
  ) RETURNING id INTO v_out_id;

  INSERT INTO inventory_movements (
    product_id, quantity, movement_type,
    from_location_id, to_location_id, event_id, pos_location_id,
    reason, note, performed_by
  ) VALUES (
    p_product_id, p_quantity, 'RETURN_IN',
    p_from_pos_location, p_to_buffer_location, p_event_id, p_from_pos_location,
    p_reason, p_note, p_performed_by
  ) RETURNING id INTO v_in_id;

  RETURN ARRAY[v_out_id, v_in_id];
END;
$$;

-- Ajustement manuel (admin seulement)
CREATE OR REPLACE FUNCTION inventory_adjust_stock(
  p_product_id  INTEGER,
  p_location_id INTEGER,
  p_qty_delta   INTEGER,  -- positif ou negatif
  p_reason      TEXT,
  p_note        TEXT    DEFAULT NULL,
  p_performed_by INTEGER DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_movement_id   INTEGER;
  v_movement_type VARCHAR;
  v_qty           INTEGER;
BEGIN
  IF p_qty_delta = 0 THEN
    RAISE EXCEPTION 'Le delta ne peut pas être zéro' USING ERRCODE = 'P0002';
  END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Le motif est obligatoire pour un ajustement' USING ERRCODE = 'P0003';
  END IF;

  IF p_qty_delta > 0 THEN
    v_movement_type := 'ADJUSTMENT_PLUS';
    v_qty := p_qty_delta;
  ELSE
    v_movement_type := 'ADJUSTMENT_MINUS';
    v_qty := ABS(p_qty_delta);
  END IF;

  PERFORM inventory_upsert_balance(p_product_id, p_location_id, p_qty_delta);

  IF p_qty_delta > 0 THEN
    INSERT INTO inventory_movements (
      product_id, quantity, movement_type,
      to_location_id, reason, note, performed_by
    ) VALUES (
      p_product_id, v_qty, v_movement_type,
      p_location_id, p_reason, p_note, p_performed_by
    ) RETURNING id INTO v_movement_id;
  ELSE
    INSERT INTO inventory_movements (
      product_id, quantity, movement_type,
      from_location_id, reason, note, performed_by
    ) VALUES (
      p_product_id, v_qty, v_movement_type,
      p_location_id, p_reason, p_note, p_performed_by
    ) RETURNING id INTO v_movement_id;
  END IF;

  RETURN v_movement_id;
END;
$$;

-- ============================================================
-- 4. SEED DATA — Emplacement global par défaut
-- ============================================================

INSERT INTO inventory_locations (type, code, name, is_active)
VALUES ('GLOBAL', 'GLOBAL-MAIN', 'Stock Central Principal', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE inventory_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_balances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_lines     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Full access for service role on all inventory tables
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_products' AND policyname = 'Service role full access inventory_products') THEN
    CREATE POLICY "Service role full access inventory_products" ON inventory_products FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_events' AND policyname = 'Service role full access inventory_events') THEN
    CREATE POLICY "Service role full access inventory_events" ON inventory_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_locations' AND policyname = 'Service role full access inventory_locations') THEN
    CREATE POLICY "Service role full access inventory_locations" ON inventory_locations FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_stock_balances' AND policyname = 'Service role full access inventory_stock_balances') THEN
    CREATE POLICY "Service role full access inventory_stock_balances" ON inventory_stock_balances FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_movements' AND policyname = 'Service role full access inventory_movements') THEN
    CREATE POLICY "Service role full access inventory_movements" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_counts' AND policyname = 'Service role full access inventory_counts') THEN
    CREATE POLICY "Service role full access inventory_counts" ON inventory_counts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_count_lines' AND policyname = 'Service role full access inventory_count_lines') THEN
    CREATE POLICY "Service role full access inventory_count_lines" ON inventory_count_lines FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
