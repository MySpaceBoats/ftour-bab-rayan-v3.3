-- Support terroir orders from the unified catalog (products table)
-- The admin catalog page now stores terroir products in the `products` table,
-- so orders placed from the public Terroir page must reference products.id
-- instead of terroir_products.id.
-- We add a nullable catalog_items JSONB column to terroir_orders to store
-- order lines for catalog-sourced orders without the terroir_products FK.

ALTER TABLE public.terroir_orders
  ADD COLUMN IF NOT EXISTS catalog_items JSONB;

COMMENT ON COLUMN public.terroir_orders.catalog_items IS
  'Order items for unified-catalog terroir products (products table). '
  'Each element: {catalogProductId, name, quantity, unitPrice, totalPrice}. '
  'NULL for legacy orders that use the terroir_order_items table.';
