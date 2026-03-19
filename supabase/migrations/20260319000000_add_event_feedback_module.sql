-- ============================================================
-- EVENT FEEDBACK MODULE — Feedback multi-dimensionnel Ramadan
-- Migration: 20260319000000_add_event_feedback_module.sql
-- ============================================================
-- Système de feedback structuré pour les événements Ramadan :
--   • Multi-rôles (bénévole, manager, groupe, bénéficiaire…)
--   • Multi-sections (service, cuisine, sécurité, nuit 26…)
--   • Notes, sous-questions JSON, réponses textes, tags auto
-- ============================================================

-- ============================================================
-- 1. TABLE PRINCIPALE : event_feedback
-- ============================================================

create table if not exists public.event_feedback (
  id            bigint generated always as identity primary key,
  user_id       integer,                          -- FK vers users (optionnel)
  email         varchar(320),                     -- Email (optionnel, anonyme autorisé)
  name          varchar(255),
  role          text not null check (role in (
                  'VOLUNTEER','MANAGER','GROUP',
                  'BENEFICIARY','VISITOR','PARTNER'
                )),
  participation_type text not null check (participation_type in (
                  'FTOR','NIGHT_26','VOLUNTEER_EVENT','THANK_YOU_EVENT'
                )),
  event_day     integer,                          -- Jour Ramadan 1-30
  event_date    timestamptz,                      -- Date réelle (optionnel)
  is_anonymous  boolean not null default false,
  nps_score     integer check (nps_score between 0 and 10),
  global_score  integer check (global_score between 1 and 10),
  moderation    text not null default 'pending' check (moderation in (
                  'pending','processed','to_analyze','important'
                )),
  created_at    timestamptz not null default now()
);

-- Index pour les analyses par rôle, type, jour
create index if not exists idx_ef_role           on public.event_feedback(role);
create index if not exists idx_ef_participation  on public.event_feedback(participation_type);
create index if not exists idx_ef_event_day      on public.event_feedback(event_day);
create index if not exists idx_ef_created_at     on public.event_feedback(created_at desc);
create index if not exists idx_ef_moderation     on public.event_feedback(moderation);

-- ============================================================
-- 2. RÉPONSES PAR SECTION : event_feedback_section_responses
-- ============================================================

create table if not exists public.event_feedback_section_responses (
  id           bigint generated always as identity primary key,
  feedback_id  bigint not null references public.event_feedback(id) on delete cascade,
  section_key  varchar(100) not null,   -- "service", "cuisine", "securite", "nuit_26"…
  rating       integer check (rating between 1 and 10),
  metadata     jsonb,                   -- Sous-questions { "qualite": 4, "quantite": 3 }
  created_at   timestamptz not null default now()
);

create index if not exists idx_efsr_feedback_id  on public.event_feedback_section_responses(feedback_id);
create index if not exists idx_efsr_section_key  on public.event_feedback_section_responses(section_key);

-- ============================================================
-- 3. RÉPONSES TEXTUELLES : event_feedback_text_responses
-- ============================================================

create table if not exists public.event_feedback_text_responses (
  id           bigint generated always as identity primary key,
  feedback_id  bigint not null references public.event_feedback(id) on delete cascade,
  field_key    varchar(100) not null,   -- "suggestion_1", "testimonial", "personal_impact"
  value        text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_eftr_feedback_id  on public.event_feedback_text_responses(feedback_id);

-- ============================================================
-- 4. TAGS AUTO-GÉNÉRÉS : event_feedback_tags
-- ============================================================

create table if not exists public.event_feedback_tags (
  id           bigint generated always as identity primary key,
  feedback_id  bigint not null references public.event_feedback(id) on delete cascade,
  tag          varchar(100) not null,     -- "low_service_score", "security_issue"
  section_key  varchar(100),             -- Section d'origine (optionnel)
  severity     varchar(20) default 'info' check (severity in ('info','warning','critical')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_eft_feedback_id  on public.event_feedback_tags(feedback_id);
create index if not exists idx_eft_tag          on public.event_feedback_tags(tag);
create index if not exists idx_eft_severity     on public.event_feedback_tags(severity);

-- ============================================================
-- 5. RLS — désactiver pour lecture admin (même pattern que feedback_responses)
-- ============================================================

alter table public.event_feedback                  enable row level security;
alter table public.event_feedback_section_responses enable row level security;
alter table public.event_feedback_text_responses    enable row level security;
alter table public.event_feedback_tags              enable row level security;

-- Politique : accès total pour le service role (backend Supabase admin)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'service_role_all_ef' and tablename = 'event_feedback') then
    create policy "service_role_all_ef"
      on public.event_feedback for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'service_role_all_efsr' and tablename = 'event_feedback_section_responses') then
    create policy "service_role_all_efsr"
      on public.event_feedback_section_responses for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'service_role_all_eftr' and tablename = 'event_feedback_text_responses') then
    create policy "service_role_all_eftr"
      on public.event_feedback_text_responses for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'service_role_all_eft' and tablename = 'event_feedback_tags') then
    create policy "service_role_all_eft"
      on public.event_feedback_tags for all to service_role using (true) with check (true);
  end if;
end $$;

-- Rafraîchir le cache PostgREST
notify pgrst, 'reload schema';
