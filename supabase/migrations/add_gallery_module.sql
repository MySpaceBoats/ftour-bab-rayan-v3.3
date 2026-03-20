-- Galerie photo module
create extension if not exists "pgcrypto";

create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  cover_photo_id uuid,
  status text not null default 'published' check (status in ('draft', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text,
  description text,
  event_date date,
  tags jsonb not null default '[]'::jsonb,
  album_id uuid references public.gallery_albums(id) on delete set null,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'rejected')),
  image_original_url text not null,
  image_thumb_url text not null,
  image_medium_url text,
  storage_path text not null,
  thumb_storage_path text,
  medium_storage_path text,
  width integer,
  height integer,
  size_bytes bigint not null,
  mime_type text not null,
  uploaded_by text
);

alter table public.gallery_albums
  add constraint gallery_albums_cover_photo_fk
  foreign key (cover_photo_id) references public.gallery_photos(id) on delete set null;

create index if not exists idx_gallery_photos_status on public.gallery_photos(status);
create index if not exists idx_gallery_photos_album on public.gallery_photos(album_id);
create index if not exists idx_gallery_photos_featured on public.gallery_photos(is_featured);
create index if not exists idx_gallery_photos_event_date on public.gallery_photos(event_date desc);

-- Keep updated_at fresh
create or replace function public.touch_gallery_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_gallery_photos_touch_updated_at on public.gallery_photos;
create trigger trg_gallery_photos_touch_updated_at
before update on public.gallery_photos
for each row execute function public.touch_gallery_updated_at();

drop trigger if exists trg_gallery_albums_touch_updated_at on public.gallery_albums;
create trigger trg_gallery_albums_touch_updated_at
before update on public.gallery_albums
for each row execute function public.touch_gallery_updated_at();

insert into public.gallery_albums (name, slug, sort_order, status)
values
  ('Ftour Bab Rayan', 'ftour-bab-rayan', 0, 'published'),
  ('Bénévoles', 'benevoles', 1, 'published')
on conflict (slug) do nothing;

-- Public storage bucket for gallery images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
