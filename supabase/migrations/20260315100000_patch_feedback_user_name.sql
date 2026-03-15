-- Patch migration: corrects missing user_name in feedback_responses
-- for environments where 20260314123000_unify_feedback_module.sql already ran
-- without mapping feedbacks.name -> feedback_responses.user_name.
-- This migration is safe to run regardless of current state.

do $$
begin
  -- Only run if feedbacks table still exists (original migration not yet applied or partially applied)
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'feedbacks'
  ) then

    -- Ensure feedback_responses table exists before inserting
    if exists (
      select from information_schema.tables
      where table_schema = 'public' and table_name = 'feedback_responses'
    ) then
      -- Patch user_name for already-migrated rows that are missing it
      update public.feedback_responses r
      set user_name = f.name
      from public.feedbacks f
      where r.id = f.id
        and r.user_name is null
        and f.name is not null;

      -- Insert any rows that were not migrated at all (e.g. if INSERT step failed)
      insert into public.feedback_responses (
        id,
        email,
        user_email,
        user_name,
        feedback_type,
        rating,
        message,
        source,
        created_at,
        moderation,
        is_anonymous
      )
      overriding system value
      select
        f.id,
        f.email,
        f.email,
        f.name,
        f.feedback_type,
        f.rating,
        f.comment,
        'site',
        f.created_at,
        case when f.status = 'processed' then 'processed' else 'pending' end,
        false
      from public.feedbacks f
      on conflict (id) do nothing;

      -- Resync identity sequence
      perform setval(
        pg_get_serial_sequence('public.feedback_responses', 'id'),
        greatest((select coalesce(max(id), 1) from public.feedback_responses), 1),
        true
      );

    end if;

    -- Drop the legacy feedbacks table
    drop table if exists public.feedbacks;

  end if;
end;
$$;
