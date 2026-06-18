-- demo_stream_sessions: durable stream session state for serverless (Vercel multi-instance)
create table public.demo_stream_sessions (
  id uuid primary key,
  ip text not null,
  started_at timestamptz not null default now(),
  tick_count integer not null default 0,
  stopped boolean not null default false
);

alter table public.demo_stream_sessions enable row level security;

create policy "Allow public read access"
  on public.demo_stream_sessions for select
  using (true);

create policy "Allow service writes"
  on public.demo_stream_sessions for all
  to service_role
  using (true)
  with check (true);

create index demo_stream_sessions_started_at_idx
  on public.demo_stream_sessions (started_at desc);
