-- Unification catalogue: goodies + terroir + patisserie dans products

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  product_type TEXT NOT NULL CHECK (product_type IN ('goodies', 'terroir', 'patisserie')),
  is_best_seller BOOLEAN NOT NULL DEFAULT false,
  is_ramadan_edition BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_product_type ON public.products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE PROCEDURE public.update_products_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active products" ON public.products;
CREATE POLICY "Public can read active products"
  ON public.products FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Service role full access products" ON public.products;
CREATE POLICY "Service role full access products"
  ON public.products FOR ALL
  USING (true)
  WITH CHECK (true);

-- Migration de données existantes
INSERT INTO public.products (name, description, price, stock, image, category, tags, status, product_type, is_best_seller, is_ramadan_edition, created_at, updated_at)
SELECT g.name, g.description, g.price, COALESCE(g.stock,0), g.image_url, g.category, '{}', CASE WHEN g.is_active THEN 'active' ELSE 'inactive' END, 'goodies', false, false, COALESCE(g.created_at, now()), COALESCE(g.updated_at, now())
FROM public.goodies g
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.product_type='goodies' AND p.name=g.name
);

INSERT INTO public.products (name, description, price, stock, image, category, tags, status, product_type, is_best_seller, is_ramadan_edition, created_at, updated_at)
SELECT p.name, p.description, p.price, COALESCE(p.stock,0), p.image_url, p.category, '{}', CASE WHEN p.active THEN 'active' ELSE 'inactive' END, 'patisserie', false, false, COALESCE(p.created_at, now()), COALESCE(p.updated_at, now())
FROM public.pastries p
WHERE NOT EXISTS (
  SELECT 1 FROM public.products pr WHERE pr.product_type='patisserie' AND pr.name=p.name
);

INSERT INTO public.products (name, description, price, stock, image, category, tags, status, product_type, is_best_seller, is_ramadan_edition, created_at, updated_at)
SELECT tp.name, tp.description, COALESCE(tv.price_unit,0), GREATEST(COALESCE(tv.stock_total,0)-COALESCE(tv.stock_reserved,0),0), tp.image_url, tp.category, '{}', CASE WHEN tp.is_active THEN 'active' ELSE 'inactive' END, 'terroir', false, false, COALESCE(tp.created_at, now()), COALESCE(tp.updated_at, now())
FROM public.terroir_products tp
LEFT JOIN LATERAL (
  SELECT v.* FROM public.terroir_product_variants v WHERE v.product_id = tp.id ORDER BY v.id ASC LIMIT 1
) tv ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.products pr WHERE pr.product_type='terroir' AND pr.name=tp.name
);

-- NOTE: legacy tables can be removed in a dedicated migration once dependent FK constraints are migrated.
