-- Admin dashboard performance indexes for common filters/sorts
create index if not exists idx_reservations_status on reservations(status);
create index if not exists idx_reservations_created_at on reservations(created_at desc);
create index if not exists idx_reservations_email on reservations(email);

create index if not exists idx_users_email on users(email);

create index if not exists idx_volunteers_created_at on volunteers(created_at desc);
create index if not exists idx_volunteers_status on volunteers(status);
create index if not exists idx_volunteers_user_id on volunteers(user_id);
create index if not exists idx_volunteers_email on volunteers(email);

create index if not exists idx_payments_created_at on payments(created_at desc);
create index if not exists idx_payments_status on payments(status);
create index if not exists idx_payments_user_id on payments(user_id);

create index if not exists idx_contact_messages_created_at on contact_messages(created_at desc);
create index if not exists idx_contact_messages_status on contact_messages(status);
create index if not exists idx_contact_messages_email on contact_messages(email);
