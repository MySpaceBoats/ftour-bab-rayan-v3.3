alter table if exists public.gallery_photos
  add column if not exists validation_email text,
  add column if not exists validation_token text,
  add column if not exists validation_sent_at timestamptz,
  add column if not exists validated_at timestamptz;

create index if not exists idx_gallery_photos_validation_token
  on public.gallery_photos(validation_token)
  where validation_token is not null;
