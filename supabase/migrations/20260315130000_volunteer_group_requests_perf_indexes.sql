-- Performance indexes for volunteer_group_requests table
-- Speeds up admin list (order by created_at), token lookups, and status filters
create index if not exists idx_volunteer_group_requests_created_at
  on volunteer_group_requests(created_at desc);

create index if not exists idx_volunteer_group_requests_status
  on volunteer_group_requests(status);

create index if not exists idx_volunteer_group_requests_day_id
  on volunteer_group_requests(day_id);

create index if not exists idx_volunteer_group_requests_validation_token
  on volunteer_group_requests(validation_token)
  where validation_token is not null;

create index if not exists idx_volunteer_group_requests_responsible_email
  on volunteer_group_requests(responsible_email);
