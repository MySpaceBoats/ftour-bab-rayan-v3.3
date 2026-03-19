-- Unification & stabilization du module feedback (PostgreSQL / Supabase)

-- 1) Tables avancées (créées si absentes)
create table if not exists public.feedback_forms (
  id bigint generated always as identity primary key,
  name text not null,
  title text,
  description text,
  target_type text not null default 'global',
  is_anonymous_allowed boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_questions (
  id bigint generated always as identity primary key,
  form_id bigint not null references public.feedback_forms(id) on delete cascade,
  label text not null,
  question text,
  type text not null,
  required boolean not null default false,
  order_index integer not null default 0,
  options jsonb,
  constraint feedback_questions_type_check check (type in ('rating','text','multiple_choice','yes_no'))
);

create table if not exists public.feedback_campaigns (
  id bigint generated always as identity primary key,
  name text not null,
  title text,
  subject text not null,
  email_subject text,
  email_content text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sent')),
  form_id bigint references public.feedback_forms(id) on delete set null,
  target_group text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_campaign_recipients (
  id bigint generated always as identity primary key,
  campaign_id bigint not null references public.feedback_campaigns(id) on delete cascade,
  email text not null,
  token text not null unique,
  opened_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  user_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_responses (
  id bigint generated always as identity primary key,
  form_id bigint references public.feedback_forms(id) on delete set null,
  campaign_id bigint references public.feedback_campaigns(id) on delete set null,
  recipient_id bigint references public.feedback_campaign_recipients(id) on delete set null,
  email text,
  feedback_type text,
  rating integer check (rating between 1 and 5),
  message text,
  source text not null default 'public_page',
  created_at timestamptz not null default now(),
  user_id bigint,
  user_email text,
  user_name text,
  is_anonymous boolean not null default false,
  moderation text not null default 'pending' check (moderation in ('pending','processed','to_analyze','important'))
);

create table if not exists public.feedback_answers (
  id bigint generated always as identity primary key,
  response_id bigint not null references public.feedback_responses(id) on delete cascade,
  question_id bigint not null references public.feedback_questions(id) on delete cascade,
  value text,
  answer_text text,
  answer_rating integer,
  answer_choice text
);



update public.feedback_forms set title = coalesce(title, name) where title is null;
update public.feedback_questions set question = coalesce(question, label) where question is null;
update public.feedback_campaigns set title = coalesce(title, name), email_subject = coalesce(email_subject, subject) where title is null or email_subject is null;

create index if not exists idx_feedback_campaign_recipients_campaign_id on public.feedback_campaign_recipients(campaign_id);
create index if not exists idx_feedback_campaign_recipients_token on public.feedback_campaign_recipients(token);
create index if not exists idx_feedback_campaign_recipients_expires_at on public.feedback_campaign_recipients(expires_at);
create index if not exists idx_feedback_responses_campaign_id on public.feedback_responses(campaign_id);
create index if not exists idx_feedback_responses_recipient_id on public.feedback_responses(recipient_id);
create index if not exists idx_feedback_responses_feedback_type on public.feedback_responses(feedback_type);
create index if not exists idx_feedback_responses_rating on public.feedback_responses(rating);
create index if not exists idx_feedback_responses_source on public.feedback_responses(source);
create index if not exists idx_feedback_responses_created_at on public.feedback_responses(created_at desc);

-- 2) Migration data depuis feedbacks -> feedback_responses (si la table source existe)
do $$
begin
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'feedbacks'
  ) then
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

    -- Resync identity after explicit id insert
    perform setval(
      pg_get_serial_sequence('public.feedback_responses','id'),
      greatest((select coalesce(max(id), 1) from public.feedback_responses), 1),
      true
    );
  end if;
end;
$$;

-- 3) Vue stats campagnes
create or replace view public.feedback_campaign_stats as
select
  r.campaign_id,
  count(*)::bigint as emails_sent,
  count(r.opened_at)::bigint as emails_opened,
  count(r.submitted_at)::bigint as feedback_received,
  avg(fr.rating)::numeric(10,2) as average_rating
from public.feedback_campaign_recipients r
left join public.feedback_responses fr
  on fr.recipient_id = r.id
group by r.campaign_id;

-- 4) Fonction transactionnelle atomique de soumission
create or replace function public.submit_feedback_atomic(
  p_form_id bigint,
  p_campaign_id bigint,
  p_recipient_id bigint,
  p_email text,
  p_feedback_type text,
  p_rating integer,
  p_message text,
  p_source text,
  p_user_name text,
  p_is_anonymous boolean,
  p_answers jsonb,
  p_token text
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_response_id bigint;
  v_item jsonb;
begin
  insert into public.feedback_responses (
    form_id,
    campaign_id,
    recipient_id,
    email,
    user_email,
    user_name,
    is_anonymous,
    feedback_type,
    rating,
    message,
    source,
    moderation
  ) values (
    p_form_id,
    p_campaign_id,
    p_recipient_id,
    p_email,
    p_email,
    case when p_is_anonymous then null else p_user_name end,
    p_is_anonymous,
    p_feedback_type,
    p_rating,
    p_message,
    p_source,
    'pending'
  )
  returning id into v_response_id;

  if p_answers is not null then
    for v_item in select * from jsonb_array_elements(p_answers)
    loop
      insert into public.feedback_answers (
        response_id,
        question_id,
        value,
        answer_text,
        answer_rating,
        answer_choice
      ) values (
        v_response_id,
        (v_item->>'questionId')::bigint,
        coalesce(v_item->>'answerText', v_item->>'answerChoice', v_item->>'answerRating'),
        v_item->>'answerText',
        nullif(v_item->>'answerRating','')::integer,
        v_item->>'answerChoice'
      );
    end loop;
  end if;

  if p_recipient_id is not null then
    update public.feedback_campaign_recipients
    set submitted_at = now()
    where id = p_recipient_id
      and (expires_at is null or expires_at > now());
  end if;

  return v_response_id;
end;
$$;

-- 5) Nettoyage table legacy
drop table if exists public.feedbacks;
