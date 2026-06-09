alter table public.routine_exercises
add column if not exists target_weight numeric(8, 2)
not null default 0
check (target_weight >= 0);
