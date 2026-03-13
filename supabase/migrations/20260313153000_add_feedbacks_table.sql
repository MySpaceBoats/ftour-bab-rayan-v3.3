create table if not exists public.feedbacks (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  phone text,
  feedback_type text not null check (feedback_type in ('volunteer','event','restaurant','product','general')),
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  page_source text not null check (page_source in ('home','volunteer','event','restaurant','product')),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','processed'))
);

create index if not exists idx_feedbacks_created_at on public.feedbacks(created_at desc);
create index if not exists idx_feedbacks_type on public.feedbacks(feedback_type);
create index if not exists idx_feedbacks_status on public.feedbacks(status);
