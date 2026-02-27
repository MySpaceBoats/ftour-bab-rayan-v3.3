CREATE TABLE IF NOT EXISTS volunteer_group_requests (
  id BIGSERIAL PRIMARY KEY,
  group_name TEXT NOT NULL,
  responsible_name TEXT NOT NULL,
  responsible_email TEXT NOT NULL,
  responsible_phone TEXT NOT NULL,
  estimated_size INTEGER,
  day_id INTEGER NOT NULL REFERENCES ramadan_days(id) ON DELETE CASCADE,
  volunteer_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  file_name TEXT NOT NULL,
  file_base64 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'refused')),
  rejection_reason TEXT,
  reviewed_by INTEGER,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_group_requests_status ON volunteer_group_requests(status);
CREATE INDEX IF NOT EXISTS idx_volunteer_group_requests_day_id ON volunteer_group_requests(day_id);
