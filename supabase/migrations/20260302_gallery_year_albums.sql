-- Add gallery albums by edition year (2015 -> 2030)
insert into public.gallery_albums (name, slug, sort_order, status)
values
  ('Édition 2015', 'edition-2015', 2015, 'published'),
  ('Édition 2016', 'edition-2016', 2016, 'published'),
  ('Édition 2017', 'edition-2017', 2017, 'published'),
  ('Édition 2018', 'edition-2018', 2018, 'published'),
  ('Édition 2019', 'edition-2019', 2019, 'published'),
  ('Édition 2020', 'edition-2020', 2020, 'published'),
  ('Édition 2021', 'edition-2021', 2021, 'published'),
  ('Édition 2022', 'edition-2022', 2022, 'published'),
  ('Édition 2023', 'edition-2023', 2023, 'published'),
  ('Édition 2024', 'edition-2024', 2024, 'published'),
  ('Édition 2025', 'edition-2025', 2025, 'published'),
  ('Édition 2026', 'edition-2026', 2026, 'published'),
  ('Édition 2027', 'edition-2027', 2027, 'published'),
  ('Édition 2028', 'edition-2028', 2028, 'published'),
  ('Édition 2029', 'edition-2029', 2029, 'published'),
  ('Édition 2030', 'edition-2030', 2030, 'published')
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  status = excluded.status;
