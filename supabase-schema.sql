create table if not exists public.investment_course_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_lesson_id text not null default 'day1',
  active_lesson_id text not null default 'day1',
  completed jsonb not null default '{}'::jsonb,
  quiz_scores jsonb not null default '{}'::jsonb,
  ui jsonb not null default '{}'::jsonb,
  calculators jsonb not null default '{}'::jsonb,
  sync_calculators boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.investment_course_progress enable row level security;

drop policy if exists "Users can view own investment course progress"
  on public.investment_course_progress;

create policy "Users can view own investment course progress"
  on public.investment_course_progress
  for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own investment course progress"
  on public.investment_course_progress;

create policy "Users can insert own investment course progress"
  on public.investment_course_progress
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own investment course progress"
  on public.investment_course_progress;

create policy "Users can update own investment course progress"
  on public.investment_course_progress
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.investment_course_progress to authenticated;
grant usage on schema public to authenticated;
