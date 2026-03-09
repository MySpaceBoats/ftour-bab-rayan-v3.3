-- ============================================
-- MODULE FTOUR BÉNÉVOLES
-- Invitation, confirmation de présence et coordination des contributions culinaires
-- ============================================

-- Table des événements ftour
CREATE TABLE IF NOT EXISTS ftour_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des invitations
CREATE TABLE IF NOT EXISTS ftour_invitations (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES ftour_events(id) ON DELETE CASCADE,
  volunteer_id BIGINT,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  invitation_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ftour_invitations_token ON ftour_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_ftour_invitations_event_id ON ftour_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_ftour_invitations_status ON ftour_invitations(status);

-- Table des contributions culinaires
CREATE TABLE IF NOT EXISTS ftour_food_contributions (
  id BIGSERIAL PRIMARY KEY,
  invitation_id BIGINT NOT NULL REFERENCES ftour_invitations(id) ON DELETE CASCADE,
  food_type TEXT NOT NULL CHECK (food_type IN ('plats_sales', 'plats_sucres', 'boissons')),
  food_name TEXT NOT NULL,
  quantity TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ftour_food_contributions_invitation ON ftour_food_contributions(invitation_id);

-- Insérer l'événement initial
INSERT INTO ftour_events (title, description, location, event_date)
VALUES (
  'Ftour des bénévoles + remise de certificat de bénévolat personnalisé',
  'Ftour convivial avec remise d''un certificat personnalisé de bénévolat.',
  'La Table du Jardin by Bab Rayan',
  '2026-03-18T19:00:00+01:00'
) ON CONFLICT DO NOTHING;
