-- ============================================================
-- MODULE ELECTION MANAGERS BAB RAYAN
-- Système d'élection annuelle des managers du Ramadan
-- ============================================================

-- TABLE : volunteer_participations
-- Source de vérité pour l'éligibilité (candidature + vote)
CREATE TABLE IF NOT EXISTS volunteer_participations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  phone       TEXT,
  event_id    INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_participations_email
  ON volunteer_participations(lower(email));

-- TABLE : election_settings
CREATE TABLE IF NOT EXISTS election_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_year   INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT,
  is_open         BOOLEAN NOT NULL DEFAULT FALSE,
  max_managers    INT NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(election_year)
);

-- Paramètres par défaut pour l'année courante
INSERT INTO election_settings (election_year, is_open, max_managers)
VALUES (EXTRACT(YEAR FROM NOW())::INT, FALSE, 10)
ON CONFLICT (election_year) DO NOTHING;

-- TABLE : manager_candidates
CREATE TABLE IF NOT EXISTS manager_candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  photo_url           TEXT,
  motivation_text     TEXT,
  participation_count INT NOT NULL DEFAULT 0,
  election_year       INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_candidates_email
  ON manager_candidates(lower(email));
CREATE INDEX IF NOT EXISTS idx_manager_candidates_year_status
  ON manager_candidates(election_year, status);

-- Un seul dépôt de candidature par email par an
CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_candidates_email_year
  ON manager_candidates(lower(email), election_year);

-- TABLE : manager_votes
CREATE TABLE IF NOT EXISTS manager_votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_email  TEXT NOT NULL,
  candidate_id UUID NOT NULL REFERENCES manager_candidates(id) ON DELETE CASCADE,
  election_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(voter_email, election_year)
);

CREATE INDEX IF NOT EXISTS idx_manager_votes_candidate_id
  ON manager_votes(candidate_id);

-- ============================================================
-- FUNCTION : count_volunteer_participations
-- Calcule le nombre de participations à partir de la table
-- volunteers existante (plus fiable que volunteer_participations)
-- ============================================================
CREATE OR REPLACE FUNCTION count_volunteer_participations(p_email TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM volunteers v
  WHERE lower(v.email) = lower(p_email)
    AND v.status IN ('present', 'confirmed', 'registered');
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE manager_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_votes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_settings  ENABLE ROW LEVEL SECURITY;

-- election_settings : lecture publique, écriture service_role
DROP POLICY IF EXISTS "election_settings_select_public" ON election_settings;
CREATE POLICY "election_settings_select_public"
  ON election_settings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "election_settings_all_service" ON election_settings;
CREATE POLICY "election_settings_all_service"
  ON election_settings FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- manager_candidates : lecture publique (candidats approuvés),
--                      écriture service_role
DROP POLICY IF EXISTS "manager_candidates_select_public" ON manager_candidates;
CREATE POLICY "manager_candidates_select_public"
  ON manager_candidates FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "manager_candidates_insert_service" ON manager_candidates;
CREATE POLICY "manager_candidates_insert_service"
  ON manager_candidates FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "manager_candidates_update_service" ON manager_candidates;
CREATE POLICY "manager_candidates_update_service"
  ON manager_candidates FOR UPDATE
  USING (is_service_role());

DROP POLICY IF EXISTS "manager_candidates_delete_service" ON manager_candidates;
CREATE POLICY "manager_candidates_delete_service"
  ON manager_candidates FOR DELETE
  USING (is_service_role());

-- manager_votes : lecture service_role, écriture service_role
DROP POLICY IF EXISTS "manager_votes_select_service" ON manager_votes;
CREATE POLICY "manager_votes_select_service"
  ON manager_votes FOR SELECT
  USING (is_service_role());

DROP POLICY IF EXISTS "manager_votes_insert_service" ON manager_votes;
CREATE POLICY "manager_votes_insert_service"
  ON manager_votes FOR INSERT
  WITH CHECK (is_service_role());

DROP POLICY IF EXISTS "manager_votes_delete_service" ON manager_votes;
CREATE POLICY "manager_votes_delete_service"
  ON manager_votes FOR DELETE
  USING (is_service_role());

-- ============================================================
-- STORAGE BUCKET : manager-candidates
-- À créer manuellement dans le dashboard Supabase ou via CLI :
--   supabase storage create manager-candidates --public
-- Ou via le dashboard : Storage > New bucket > "manager-candidates"
-- Autorisations : jpg, png, webp — taille max : 5 MB
-- ============================================================
