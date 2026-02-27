-- Volunteer profile space (auth-linked profile + attendance view)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'volunteer_role'
  ) THEN
    CREATE TYPE volunteer_role AS ENUM ('blue', 'orange', 'yellow', 'red');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS volunteer_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role volunteer_role NOT NULL DEFAULT 'blue',
  points_total INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_role ON volunteer_profiles(role);
CREATE INDEX IF NOT EXISTS idx_volunteer_profiles_created_at ON volunteer_profiles(created_at);

CREATE OR REPLACE FUNCTION volunteer_profiles_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_volunteer_profiles_updated_at ON volunteer_profiles;
CREATE TRIGGER trg_volunteer_profiles_updated_at
BEFORE UPDATE ON volunteer_profiles
FOR EACH ROW
EXECUTE FUNCTION volunteer_profiles_set_updated_at();

CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_service_role()
    OR EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM users u
      WHERE u.open_id = auth.uid()::text
        AND u.role IN ('admin', 'super_admin', 'admin_ops')
    );
$$;

CREATE OR REPLACE FUNCTION enforce_volunteer_profile_update_restrictions()
RETURNS TRIGGER AS $$
BEGIN
  IF is_service_role() OR is_admin_user() THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role
    OR OLD.points_total IS DISTINCT FROM NEW.points_total
    OR OLD.level IS DISTINCT FROM NEW.level
    OR OLD.email IS DISTINCT FROM NEW.email
    OR OLD.id IS DISTINCT FROM NEW.id
  THEN
    RAISE EXCEPTION 'Only admins can update role, points, level, or email';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_volunteer_profiles_restrict_updates ON volunteer_profiles;
CREATE TRIGGER trg_volunteer_profiles_restrict_updates
BEFORE UPDATE ON volunteer_profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_volunteer_profile_update_restrictions();

ALTER TABLE volunteer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "volunteer_profiles_select_self" ON volunteer_profiles;
CREATE POLICY "volunteer_profiles_select_self"
  ON volunteer_profiles FOR SELECT
  USING (auth.uid() = id OR is_admin_user());

DROP POLICY IF EXISTS "volunteer_profiles_insert_self" ON volunteer_profiles;
CREATE POLICY "volunteer_profiles_insert_self"
  ON volunteer_profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR is_admin_user() OR is_service_role());

DROP POLICY IF EXISTS "volunteer_profiles_update_self" ON volunteer_profiles;
CREATE POLICY "volunteer_profiles_update_self"
  ON volunteer_profiles FOR UPDATE
  USING (auth.uid() = id OR is_admin_user())
  WITH CHECK (auth.uid() = id OR is_admin_user());

-- Attendance source from existing volunteers module (no duplication)
CREATE OR REPLACE VIEW volunteer_attendance_view AS
SELECT
  v.id::bigint AS id,
  vp.id AS volunteer_id,
  rd.date::date AS date,
  COALESCE(NULLIF(slot.slot, ''), 'full_day')::text AS slot,
  CASE
    WHEN v.status IN ('registered', 'confirmed', 'present', 'cancelled') THEN v.status
    ELSE 'registered'
  END::text AS status,
  0::int AS points_earned,
  v.created_at
FROM volunteers v
JOIN ramadan_days rd ON rd.id = v.day_id
LEFT JOIN volunteer_profiles vp ON lower(vp.email) = lower(v.email)
LEFT JOIN LATERAL (
  SELECT jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(v.volunteer_slots) = 'array' AND jsonb_array_length(v.volunteer_slots) > 0 THEN v.volunteer_slots
      ELSE '["full_day"]'::jsonb
    END
  ) AS slot
) slot ON TRUE
WHERE vp.id IS NOT NULL;

ALTER VIEW volunteer_attendance_view SET (security_invoker = true);

CREATE OR REPLACE FUNCTION ensure_volunteer_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS volunteer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing volunteer_profiles;
  fallback_first_name TEXT;
  fallback_last_name TEXT;
  volunteer_row RECORD;
BEGIN
  SELECT * INTO existing
  FROM volunteer_profiles
  WHERE id = p_user_id;

  IF FOUND THEN
    RETURN existing;
  END IF;

  fallback_first_name := split_part(COALESCE(NULLIF(trim(p_name), ''), 'Benevole'), ' ', 1);
  fallback_last_name := NULLIF(trim(replace(COALESCE(p_name, ''), fallback_first_name, '')), '');

  IF fallback_last_name IS NULL THEN
    fallback_last_name := 'Ftour';
  END IF;

  SELECT v.first_name, v.last_name, v.phone
  INTO volunteer_row
  FROM volunteers v
  WHERE lower(v.email) = lower(COALESCE(p_email, ''))
  ORDER BY v.created_at DESC
  LIMIT 1;

  INSERT INTO volunteer_profiles (id, first_name, last_name, phone, email)
  VALUES (
    p_user_id,
    COALESCE(volunteer_row.first_name, fallback_first_name),
    COALESCE(volunteer_row.last_name, fallback_last_name),
    COALESCE(volunteer_row.phone, p_phone),
    p_email
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO existing
  FROM volunteer_profiles
  WHERE id = p_user_id;

  RETURN existing;
END;
$$;
