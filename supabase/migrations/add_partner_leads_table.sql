CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS partner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  partnership_type text,
  budget_range text,
  message text,
  source text NOT NULL DEFAULT 'website',
  locale text
);

ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can create partner leads" ON partner_leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access partner_leads" ON partner_leads
  FOR ALL USING (true) WITH CHECK (true);
