-- Reservation payment proof workflow

ALTER TABLE restaurant_reservations
  DROP CONSTRAINT IF EXISTS restaurant_reservations_status_check;

ALTER TABLE restaurant_reservations
  ADD CONSTRAINT restaurant_reservations_status_check
  CHECK (
    status IN (
      'submitted',
      'pending_confirmation',
      'pending_validation',
      'validated_pending_payment',
      'pending_deposit',
      'deposit_submitted',
      'deposit_received',
      'confirmed',
      'paid_confirmed',
      'rejected',
      'refused',
      'cancelled',
      'cancelled_auto',
      'completed',
      'no_show',
      'checked_in'
    )
  );

CREATE TABLE IF NOT EXISTS reservation_payment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id INTEGER NOT NULL REFERENCES restaurant_reservations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_payment_tokens_reservation_id
  ON reservation_payment_tokens(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_payment_tokens_token_hash
  ON reservation_payment_tokens(token_hash);

CREATE TABLE IF NOT EXISTS reservation_payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id INTEGER NOT NULL REFERENCES restaurant_reservations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by_email TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'submitted',
  admin_note TEXT
);

CREATE TABLE IF NOT EXISTS reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id INTEGER NOT NULL REFERENCES restaurant_reservations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_events_reservation_id
  ON reservation_events(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_events_event_type
  ON reservation_events(event_type);

CREATE OR REPLACE FUNCTION prevent_restaurant_reservation_status_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_rank INT;
  new_rank INT;
  caller_role TEXT;
BEGIN
  IF NEW.status IS NULL OR OLD.status IS NULL OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  caller_role := auth.role();
  IF caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  old_rank := CASE OLD.status
    WHEN 'submitted' THEN 0
    WHEN 'pending_confirmation' THEN 1
    WHEN 'pending_validation' THEN 2
    WHEN 'validated_pending_payment' THEN 3
    WHEN 'pending_deposit' THEN 4
    WHEN 'deposit_submitted' THEN 5
    WHEN 'deposit_received' THEN 6
    WHEN 'confirmed' THEN 7
    WHEN 'paid_confirmed' THEN 8
    WHEN 'checked_in' THEN 9
    WHEN 'completed' THEN 10
    ELSE 99
  END;

  new_rank := CASE NEW.status
    WHEN 'submitted' THEN 0
    WHEN 'pending_confirmation' THEN 1
    WHEN 'pending_validation' THEN 2
    WHEN 'validated_pending_payment' THEN 3
    WHEN 'pending_deposit' THEN 4
    WHEN 'deposit_submitted' THEN 5
    WHEN 'deposit_received' THEN 6
    WHEN 'confirmed' THEN 7
    WHEN 'paid_confirmed' THEN 8
    WHEN 'checked_in' THEN 9
    WHEN 'completed' THEN 10
    ELSE 99
  END;

  IF new_rank < old_rank THEN
    RAISE EXCEPTION 'Status regression is not allowed (% -> %)', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_restaurant_reservation_status_regression ON restaurant_reservations;
CREATE TRIGGER trg_prevent_restaurant_reservation_status_regression
BEFORE UPDATE OF status ON restaurant_reservations
FOR EACH ROW
EXECUTE FUNCTION prevent_restaurant_reservation_status_regression();



-- Private storage bucket for transfer proofs (run with privileged role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reservation-payment-proofs',
  'reservation-payment-proofs',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;
