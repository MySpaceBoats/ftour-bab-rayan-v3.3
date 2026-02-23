-- Ramadan stats module tables

create table if not exists public.ramadan_config (
  id bigserial primary key,
  hijri_year text not null,
  gregorian_start_date date not null,
  timezone text not null default 'Africa/Casablanca',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ramadan_config_single_active_idx
  on public.ramadan_config (is_active)
  where is_active = true;

create table if not exists public.ramadan_daily_stats (
  id bigserial primary key,
  config_id bigint not null references public.ramadan_config(id) on delete cascade,
  ramadan_day int not null check (ramadan_day between 1 and 30),
  gregorian_date date not null,
  beneficiaries_served int not null default 0 check (beneficiaries_served >= 0),
  meals_distributed int not null default 0 check (meals_distributed >= 0),
  volunteers_present int not null default 0 check (volunteers_present >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(config_id, ramadan_day)
);

create index if not exists ramadan_daily_stats_config_date_idx
  on public.ramadan_daily_stats(config_id, gregorian_date);

create or replace function public.set_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_ramadan_config_updated_at on public.ramadan_config;
create trigger set_ramadan_config_updated_at
before update on public.ramadan_config
for each row execute function public.set_updated_at_column();

drop trigger if exists set_ramadan_daily_stats_updated_at on public.ramadan_daily_stats;
create trigger set_ramadan_daily_stats_updated_at
before update on public.ramadan_daily_stats
for each row execute function public.set_updated_at_column();
