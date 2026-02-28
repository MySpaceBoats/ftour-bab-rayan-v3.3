-- Dashboard visibility permissions

CREATE TABLE IF NOT EXISTS public.dashboard_items (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  deprecated BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.user_dashboard_items (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL REFERENCES public.dashboard_items(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_key)
);

ALTER TABLE public.user_dashboard_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dashboard permissions" ON public.user_dashboard_items;
CREATE POLICY "Users can view own dashboard permissions"
ON public.user_dashboard_items
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage dashboard permissions" ON public.user_dashboard_items;
CREATE POLICY "Admins manage dashboard permissions"
ON public.user_dashboard_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.open_id = auth.uid()::text
      AND u.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.open_id = auth.uid()::text
      AND u.role IN ('admin', 'super_admin')
  )
);

INSERT INTO public.dashboard_items (key, label, category, sort, description, deprecated) VALUES
('dash.kpis.overview', 'Vue d''ensemble KPI', 'dashboard', 10, NULL, FALSE),
('dash.volunteers.table', 'Bénévoles', 'operations', 20, NULL, FALSE),
('dash.days.management', 'Jours Ramadan', 'operations', 30, NULL, FALSE),
('dash.reservations.table', 'Réservations Ftour', 'restaurant', 40, NULL, FALSE),
('dash.reservations.calendar', 'Calendrier réservations', 'restaurant', 50, NULL, FALSE),
('dash.reservations.groups', 'Réservations groupes', 'restaurant', 60, NULL, FALSE),
('dash.reservations.enterprises', 'Réservations entreprises', 'restaurant', 70, NULL, FALSE),
('dash.reservations.scanner', 'Scanner réservations', 'scanner', 80, NULL, FALSE),
('dash.restaurants.management', 'Restaurants', 'restaurant', 90, NULL, FALSE),
('dash.orders.goodies', 'Commandes goodies', 'commerce', 100, NULL, FALSE),
('dash.catalog.goodies', 'Catalogue goodies', 'commerce', 110, NULL, FALSE),
('dash.orders.pastries', 'Commandes pâtisserie', 'commerce', 120, NULL, FALSE),
('dash.catalog.pastries', 'Catalogue pâtisserie', 'commerce', 130, NULL, FALSE),
('dash.orders.terroir', 'Commandes terroir', 'commerce', 140, NULL, FALSE),
('dash.catalog.terroir', 'Catalogue terroir', 'commerce', 150, NULL, FALSE),
('dash.payments', 'Paiements', 'finance', 160, NULL, FALSE),
('dash.donations.kpis', 'Dons', 'finance', 170, NULL, FALSE),
('dash.qrcodes', 'Catalogue QR codes', 'scanner', 180, NULL, FALSE),
('dash.scanner', 'Scanner unifié', 'scanner', 190, NULL, FALSE),
('dash.gallery', 'Galerie', 'contenu', 200, NULL, FALSE),
('dash.content', 'Contenu', 'contenu', 210, NULL, FALSE),
('dash.messages', 'Messages', 'support', 220, NULL, FALSE),
('dash.settings.users', 'Utilisateurs', 'settings', 230, NULL, FALSE),
('dash.stats.ramadan', 'Statistiques Ramadan', 'dashboard', 240, NULL, FALSE),
('dash.orders.cash', 'Commandes cash', 'commerce', 250, NULL, FALSE),
('dash.scan.product', 'Scanner produits', 'scanner', 260, NULL, FALSE),
('dash.unified', 'Dashboard unifié', 'dashboard', 270, NULL, FALSE)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  sort = EXCLUDED.sort,
  description = EXCLUDED.description,
  deprecated = EXCLUDED.deprecated;

-- existing admins get all keys
INSERT INTO public.user_dashboard_items (user_id, item_key)
SELECT u.open_id::uuid, di.key
FROM public.users u
CROSS JOIN public.dashboard_items di
WHERE u.role IN ('admin', 'super_admin')
ON CONFLICT DO NOTHING;

-- existing non-admin users get defaults
INSERT INTO public.user_dashboard_items (user_id, item_key)
SELECT u.open_id::uuid, d.key
FROM public.users u
JOIN (VALUES
  ('dash.kpis.overview'),
  ('dash.volunteers.table'),
  ('dash.reservations.table'),
  ('dash.donations.kpis')
) AS d(key) ON TRUE
WHERE u.role NOT IN ('admin', 'super_admin')
ON CONFLICT DO NOTHING;
