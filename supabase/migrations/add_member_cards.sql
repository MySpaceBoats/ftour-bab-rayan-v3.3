-- Member cards workflow
create table if not exists public.members (
  id bigserial primary key,
  first_name text not null,
  last_name text not null,
  address text,
  phone text,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_card_orders (
  id bigserial primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  status text not null default 'INSCRIT' check (status in (
    'INSCRIT','MAIL_COMMANDE_ENVOYE','CARTE_DEMANDEE','MAIL_PAIEMENT_ENVOYE','PAIEMENT_RECU','A_IMPRIMER','IMPRIMEE','LIVREE'
  )),
  payment_method text check (payment_method in ('on_site','bank_transfer')),
  amount numeric(10,2) not null default 150,
  currency text not null default 'MAD',
  payment_proof_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_card_events (
  id bigserial primary key,
  order_id bigint not null references public.member_card_orders(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.member_card_tokens (
  id bigserial primary key,
  order_id bigint not null references public.member_card_orders(id) on delete cascade,
  type text not null check (type in ('order','payment')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_member_card_orders_member on public.member_card_orders(member_id);
create index if not exists idx_member_card_orders_status on public.member_card_orders(status);
create index if not exists idx_member_card_events_order on public.member_card_events(order_id);
create index if not exists idx_member_card_tokens_order_type on public.member_card_tokens(order_id, type);

create or replace function public.set_member_card_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_member_card_orders_updated_at on public.member_card_orders;
create trigger trg_member_card_orders_updated_at
before update on public.member_card_orders
for each row execute procedure public.set_member_card_updated_at();

create or replace function public.transition_member_card_status(old_status text, new_status text)
returns boolean
language plpgsql
as $$
declare
  allowed boolean;
begin
  if old_status = new_status then
    return true;
  end if;

  allowed := (old_status = 'MAIL_COMMANDE_ENVOYE' and new_status = 'CARTE_DEMANDEE')
    or (old_status = 'CARTE_DEMANDEE' and new_status = 'MAIL_PAIEMENT_ENVOYE')
    or (old_status = 'MAIL_PAIEMENT_ENVOYE' and new_status in ('PAIEMENT_RECU', 'A_IMPRIMER'))
    or (old_status = 'PAIEMENT_RECU' and new_status in ('A_IMPRIMER', 'IMPRIMEE'))
    or (old_status = 'A_IMPRIMER' and new_status = 'IMPRIMEE')
    or (old_status = 'IMPRIMEE' and new_status = 'LIVREE')
    or (old_status = 'INSCRIT' and new_status = 'MAIL_COMMANDE_ENVOYE');

  return allowed;
end;
$$;

create or replace function public.enforce_member_card_status_transition()
returns trigger
language plpgsql
as $$
begin
  if not public.transition_member_card_status(old.status, new.status) then
    raise exception 'Invalid member card status transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_member_card_orders_status_transition on public.member_card_orders;
create trigger trg_member_card_orders_status_transition
before update of status on public.member_card_orders
for each row execute procedure public.enforce_member_card_status_transition();

alter table public.members enable row level security;
alter table public.member_card_orders enable row level security;
alter table public.member_card_events enable row level security;
alter table public.member_card_tokens enable row level security;

-- No public access on member card tables
-- service role/admin worker are expected to manage data

-- storage bucket for payment proofs (execute in SQL editor with privileged role)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-card-proofs', 'member-card-proofs', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
