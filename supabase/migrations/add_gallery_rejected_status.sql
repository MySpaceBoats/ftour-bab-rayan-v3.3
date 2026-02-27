-- Add explicit rejected status for gallery moderation
alter table public.gallery_photos
  drop constraint if exists gallery_photos_status_check;

alter table public.gallery_photos
  add constraint gallery_photos_status_check
  check (status in ('draft', 'published', 'rejected'));
