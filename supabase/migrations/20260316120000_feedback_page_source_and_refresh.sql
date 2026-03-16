-- Migration: add page_source column to feedback_responses + refresh PostgREST schema cache
-- Safe to run multiple times (idempotent)

-- 1) Add page_source column if missing
alter table public.feedback_responses
  add column if not exists page_source text;

-- 2) Backfill page_source for site feedbacks migrated from the legacy feedbacks table
--    The old feedbacks table stored page_source. We can retrieve it if feedbacks still exists,
--    otherwise we leave it null (the column is optional).
do $$
begin
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'feedbacks'
  ) then
    update public.feedback_responses r
    set page_source = f.page_source
    from public.feedbacks f
    where r.id = f.id
      and r.page_source is null
      and f.page_source is not null;
  end if;
end;
$$;

-- 3) Reload PostgREST schema cache so all new tables/columns are immediately visible
notify pgrst, 'reload schema';
