-- Progressively Fit initial schema.
-- Run with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- Keep updated_at values consistent without relying on the client.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (routine_id, day_of_week)
);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references public.routine_days (id) on delete cascade,
  exercise_name text not null
    check (char_length(trim(exercise_name)) between 1 and 150),
  sets smallint not null check (sets > 0),
  reps smallint not null check (reps > 0),
  target_weight numeric(8, 2) not null default 0 check (target_weight >= 0),
  exercise_order smallint not null check (exercise_order >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (routine_day_id, exercise_order)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  routine_day_id uuid references public.routine_days (id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (completed_at is null or completed_at >= started_at)
);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null
    references public.workout_sessions (id) on delete cascade,
  exercise_name text not null
    check (char_length(trim(exercise_name)) between 1 and 150),
  set_number smallint not null check (set_number > 0),
  weight numeric(8, 2) not null default 0 check (weight >= 0),
  reps smallint not null check (reps >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workout_session_id, exercise_name, set_number)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  reminder_time time not null,
  days smallint[] not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    cardinality(days) between 1 and 7
    and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  )
);

-- Foreign-key and common access-path indexes.
create index routines_user_id_idx on public.routines (user_id);
create index routine_days_routine_id_idx on public.routine_days (routine_id);
create index routine_exercises_day_id_idx
  on public.routine_exercises (routine_day_id);
create index workout_sessions_user_started_at_idx
  on public.workout_sessions (user_id, started_at desc);
create index workout_sessions_routine_day_id_idx
  on public.workout_sessions (routine_day_id);
create index session_sets_workout_session_id_idx
  on public.session_sets (workout_session_id);
create index reminders_user_active_idx
  on public.reminders (user_id, active);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger routines_set_updated_at
before update on public.routines
for each row execute function public.set_updated_at();

create trigger routine_days_set_updated_at
before update on public.routine_days
for each row execute function public.set_updated_at();

create trigger routine_exercises_set_updated_at
before update on public.routine_exercises
for each row execute function public.set_updated_at();

create trigger workout_sessions_set_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

create trigger session_sets_set_updated_at
before update on public.session_sets
for each row execute function public.set_updated_at();

create trigger reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

-- Mirror each Supabase Auth user into the public users table.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Include any Auth users that existed before this migration.
insert into public.users (id, display_name)
select
  id,
  coalesce(
    raw_user_meta_data ->> 'display_name',
    raw_user_meta_data ->> 'full_name'
  )
from auth.users
on conflict (id) do nothing;

-- Only authenticated users may access application tables. The service role
-- retains its normal RLS-bypassing server access.
revoke all on table public.users from anon;
revoke all on table public.routines from anon;
revoke all on table public.routine_days from anon;
revoke all on table public.routine_exercises from anon;
revoke all on table public.workout_sessions from anon;
revoke all on table public.session_sets from anon;
revoke all on table public.reminders from anon;

grant select, update on table public.users to authenticated;
grant select, insert, update, delete on table public.routines to authenticated;
grant select, insert, update, delete on table public.routine_days to authenticated;
grant select, insert, update, delete on table public.routine_exercises to authenticated;
grant select, insert, update, delete on table public.workout_sessions to authenticated;
grant select, insert, update, delete on table public.session_sets to authenticated;
grant select, insert, update, delete on table public.reminders to authenticated;

alter table public.users enable row level security;
alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.reminders enable row level security;

-- users
create policy "Users can read their own profile"
on public.users
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- routines
create policy "Users can read their own routines"
on public.routines
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own routines"
on public.routines
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own routines"
on public.routines
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own routines"
on public.routines
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- routine_days
create policy "Users can read days in their own routines"
on public.routine_days
for select
to authenticated
using (
  exists (
    select 1
    from public.routines
    where routines.id = routine_days.routine_id
      and routines.user_id = (select auth.uid())
  )
);

create policy "Users can create days in their own routines"
on public.routine_days
for insert
to authenticated
with check (
  exists (
    select 1
    from public.routines
    where routines.id = routine_days.routine_id
      and routines.user_id = (select auth.uid())
  )
);

create policy "Users can update days in their own routines"
on public.routine_days
for update
to authenticated
using (
  exists (
    select 1
    from public.routines
    where routines.id = routine_days.routine_id
      and routines.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.routines
    where routines.id = routine_days.routine_id
      and routines.user_id = (select auth.uid())
  )
);

create policy "Users can delete days in their own routines"
on public.routine_days
for delete
to authenticated
using (
  exists (
    select 1
    from public.routines
    where routines.id = routine_days.routine_id
      and routines.user_id = (select auth.uid())
  )
);

-- routine_exercises
create policy "Users can read exercises in their own routines"
on public.routine_exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.routine_days
    join public.routines on routines.id = routine_days.routine_id
    where routine_days.id = routine_exercises.routine_day_id
      and routines.user_id = (select auth.uid())
  )
);

create policy "Users can create exercises in their own routines"
on public.routine_exercises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.routine_days
    join public.routines on routines.id = routine_days.routine_id
    where routine_days.id = routine_exercises.routine_day_id
      and routines.user_id = (select auth.uid())
  )
);

create policy "Users can update exercises in their own routines"
on public.routine_exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.routine_days
    join public.routines on routines.id = routine_days.routine_id
    where routine_days.id = routine_exercises.routine_day_id
      and routines.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.routine_days
    join public.routines on routines.id = routine_days.routine_id
    where routine_days.id = routine_exercises.routine_day_id
      and routines.user_id = (select auth.uid())
  )
);

create policy "Users can delete exercises in their own routines"
on public.routine_exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.routine_days
    join public.routines on routines.id = routine_days.routine_id
    where routine_days.id = routine_exercises.routine_day_id
      and routines.user_id = (select auth.uid())
  )
);

-- workout_sessions
create policy "Users can read their own workout sessions"
on public.workout_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own workout sessions"
on public.workout_sessions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    routine_day_id is null
    or exists (
      select 1
      from public.routine_days
      join public.routines on routines.id = routine_days.routine_id
      where routine_days.id = workout_sessions.routine_day_id
        and routines.user_id = (select auth.uid())
    )
  )
);

create policy "Users can update their own workout sessions"
on public.workout_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    routine_day_id is null
    or exists (
      select 1
      from public.routine_days
      join public.routines on routines.id = routine_days.routine_id
      where routine_days.id = workout_sessions.routine_day_id
        and routines.user_id = (select auth.uid())
    )
  )
);

create policy "Users can delete their own workout sessions"
on public.workout_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- session_sets
create policy "Users can read sets in their own workout sessions"
on public.session_sets
for select
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = session_sets.workout_session_id
      and workout_sessions.user_id = (select auth.uid())
  )
);

create policy "Users can create sets in their own workout sessions"
on public.session_sets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = session_sets.workout_session_id
      and workout_sessions.user_id = (select auth.uid())
  )
);

create policy "Users can update sets in their own workout sessions"
on public.session_sets
for update
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = session_sets.workout_session_id
      and workout_sessions.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = session_sets.workout_session_id
      and workout_sessions.user_id = (select auth.uid())
  )
);

create policy "Users can delete sets in their own workout sessions"
on public.session_sets
for delete
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = session_sets.workout_session_id
      and workout_sessions.user_id = (select auth.uid())
  )
);

-- reminders
create policy "Users can read their own reminders"
on public.reminders
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own reminders"
on public.reminders
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own reminders"
on public.reminders
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own reminders"
on public.reminders
for delete
to authenticated
using ((select auth.uid()) = user_id);
