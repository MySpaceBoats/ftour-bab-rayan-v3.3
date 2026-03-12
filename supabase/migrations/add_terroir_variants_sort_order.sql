-- Migration: add missing sort_order on terroir_product_variants
-- Fixes runtime error: Could not find the 'sort_order' column of 'terroir_product_variants' in the schema cache

ALTER TABLE IF EXISTS public.terroir_product_variants
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_terroir_variants_sort_order
ON public.terroir_product_variants(sort_order);

NOTIFY pgrst, 'reload schema';
