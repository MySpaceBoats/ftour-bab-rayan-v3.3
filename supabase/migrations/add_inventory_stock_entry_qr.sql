-- ============================================================
-- INVENTORY STOCK ENTRY QR
-- QR dédiés pour l'entrée de stock global (flux logistique)
-- ============================================================

ALTER TABLE inventory_products
  ADD COLUMN IF NOT EXISTS stock_entry_qr_slug VARCHAR(120),
  ADD COLUMN IF NOT EXISTS stock_entry_qr_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_products_stock_entry_qr_slug
  ON inventory_products(stock_entry_qr_slug)
  WHERE stock_entry_qr_slug IS NOT NULL;

-- Backfill slug pour les produits déjà existants
UPDATE inventory_products
SET stock_entry_qr_slug = CONCAT(
  'stk_',
  id,
  '_',
  SUBSTRING(md5(CONCAT(id::text, NOW()::text, random()::text)) FROM 1 FOR 16)
)
WHERE stock_entry_qr_slug IS NULL;
