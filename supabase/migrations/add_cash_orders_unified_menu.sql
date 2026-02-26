-- Unified QR cash ordering flow

create table if not exists products (
  id bigserial primary key,
  type varchar(20) not null check (type in ('GOODIE','PASTRY','TERROIR','DONATION')),
  name varchar(200) not null,
  description text,
  price_mad integer not null check (price_mad >= 0),
  active boolean not null default true,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cash_orders (
  id uuid primary key default uuid_generate_v4(),
  reference varchar(24) not null unique,
  status varchar(20) not null check (status in ('PENDING_CASH','FULFILLED','CANCELLED')),
  customer_first_name varchar(100) not null,
  customer_last_name varchar(100) not null,
  customer_email varchar(320) not null,
  customer_phone varchar(25),
  currency varchar(3) not null default 'MAD',
  total_mad integer not null check (total_mad >= 0),
  proof_token varchar(128) not null,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_orders_reference on cash_orders(reference);
create index if not exists idx_cash_orders_status on cash_orders(status);

create table if not exists cash_order_items (
  id bigserial primary key,
  order_id uuid not null references cash_orders(id) on delete cascade,
  product_id bigint references products(id),
  name_snapshot varchar(200) not null,
  unit_price_mad integer not null,
  qty integer not null check (qty > 0),
  type_snapshot varchar(20) not null check (type_snapshot in ('GOODIE','PASTRY','TERROIR','DONATION')),
  meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cash_order_events (
  id bigserial primary key,
  order_id uuid not null references cash_orders(id) on delete cascade,
  event_type varchar(32) not null,
  actor varchar(120),
  created_at timestamptz not null default now()
);

create table if not exists cash_order_rate_limits (
  id bigserial primary key,
  ip varchar(100) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_order_rate_limits_ip_created_at
  on cash_order_rate_limits(ip, created_at desc);

insert into products (type, name, description, price_mad, active, sort_order)
values
  ('DONATION','Don de 25 MAD','Soutenez un repas solidaire',25,true,10),
  ('DONATION','Don de 650 MAD','Parrainez une journée de ftour',650,true,11)
on conflict do nothing;
