-- INBESTIGA Marketing Cloud v17.0
-- WORK 360 ADVANCED
-- SQL OPCIONAL, IDEMPOTENTE Y NO DESTRUCTIVO.
-- La plataforma funciona con almacenamiento local aunque este SQL no se ejecute.

create schema if not exists marketing_app;

create table if not exists marketing_app.task_extensions (
  user_id uuid not null,
  task_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create table if not exists marketing_app.work360_preferences (
  user_id uuid primary key,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists marketing_app.work360_time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  minutes integer not null check (minutes > 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists task_extensions_task_id_idx
  on marketing_app.task_extensions(task_id);

create index if not exists work360_time_entries_user_task_idx
  on marketing_app.work360_time_entries(user_id, task_id, created_at desc);

alter table marketing_app.task_extensions enable row level security;
alter table marketing_app.work360_preferences enable row level security;
alter table marketing_app.work360_time_entries enable row level security;

do $$
begin
  create policy task_extensions_select_own
    on marketing_app.task_extensions for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy task_extensions_write_own
    on marketing_app.task_extensions for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy work360_preferences_select_own
    on marketing_app.work360_preferences for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy work360_preferences_write_own
    on marketing_app.work360_preferences for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy work360_time_entries_select_own
    on marketing_app.work360_time_entries for select
    to authenticated
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy work360_time_entries_write_own
    on marketing_app.work360_time_entries for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

grant usage on schema marketing_app to authenticated;
grant select, insert, update, delete on marketing_app.task_extensions to authenticated;
grant select, insert, update, delete on marketing_app.work360_preferences to authenticated;
grant select, insert, update, delete on marketing_app.work360_time_entries to authenticated;
