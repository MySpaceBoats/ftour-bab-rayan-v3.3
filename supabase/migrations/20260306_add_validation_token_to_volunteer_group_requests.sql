ALTER TABLE volunteer_group_requests
  ADD COLUMN IF NOT EXISTS validation_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_volunteer_group_requests_validation_token
  ON volunteer_group_requests(validation_token);
