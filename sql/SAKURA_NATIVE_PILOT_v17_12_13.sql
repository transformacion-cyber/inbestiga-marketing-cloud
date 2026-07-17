-- INBESTIGA MARKETING CLOUD v17.12.13 · SAKURA NATIVE PILOT
-- SQL OPCIONAL, ADITIVO, IDEMPOTENTE Y MANUAL.
-- La interfaz funciona con bóveda local aunque este SQL no se ejecute.
-- Solo crea objetos sakura_*; no modifica tablas, RPC ni políticas productivas existentes.

begin;

create table if not exists marketing_app.sakura_knowledge (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'personal' check (scope in ('personal','area','enterprise')),
  owner_member_id uuid,
  area_id uuid,
  knowledge_type text not null default 'knowledge',
  title text not null,
  content text not null,
  analysis jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','pending_review','published','paused','archived','rejected')),
  version integer not null default 1 check (version > 0),
  created_by_auth uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sakura_knowledge_content_size check (octet_length(content) <= 500000),
  constraint sakura_knowledge_analysis_object check (jsonb_typeof(analysis) = 'object')
);

create table if not exists marketing_app.sakura_user_preferences (
  member_id uuid primary key,
  preferences jsonb not null default '{}'::jsonb,
  updated_by_auth uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint sakura_preferences_object check (jsonb_typeof(preferences) = 'object'),
  constraint sakura_preferences_size check (octet_length(preferences::text) <= 100000)
);

create table if not exists marketing_app.sakura_learning_proposals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid,
  area_id uuid,
  proposed_scope text not null default 'personal' check (proposed_scope in ('personal','area','enterprise')),
  pattern_type text not null default 'workflow',
  title text not null,
  proposal jsonb not null default '{}'::jsonb,
  sample_count integer not null default 1 check (sample_count > 0),
  status text not null default 'pending' check (status in ('pending','approved','edited','rejected','muted')),
  created_by_auth uuid not null default auth.uid(),
  reviewed_by_auth uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint sakura_proposal_object check (jsonb_typeof(proposal) = 'object'),
  constraint sakura_proposal_size check (octet_length(proposal::text) <= 150000)
);

create table if not exists marketing_app.sakura_action_audit (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  actor_member_id uuid,
  actor_role text,
  action_name text not null,
  parameters jsonb not null default '{}'::jsonb,
  result text not null check (result in ('confirmed','completed','cancelled','error')),
  entity_type text,
  entity_id text,
  error_message text,
  sakura_version text not null default 'v17.12.13',
  created_by_auth uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint sakura_action_parameters_object check (jsonb_typeof(parameters) = 'object'),
  constraint sakura_action_parameters_size check (octet_length(parameters::text) <= 150000)
);

create index if not exists sakura_knowledge_scope_status_idx on marketing_app.sakura_knowledge(scope,status,updated_at desc);
create index if not exists sakura_knowledge_owner_idx on marketing_app.sakura_knowledge(owner_member_id,updated_at desc);
create index if not exists sakura_knowledge_area_idx on marketing_app.sakura_knowledge(area_id,updated_at desc);
create index if not exists sakura_proposals_member_status_idx on marketing_app.sakura_learning_proposals(member_id,status,created_at desc);
create index if not exists sakura_action_actor_idx on marketing_app.sakura_action_audit(actor_member_id,created_at desc);

alter table marketing_app.sakura_knowledge enable row level security;
alter table marketing_app.sakura_user_preferences enable row level security;
alter table marketing_app.sakura_learning_proposals enable row level security;
alter table marketing_app.sakura_action_audit enable row level security;

create or replace function marketing_app.ibm_v171213_sakura_member()
returns marketing_app.members
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public
as $$
  select m
  from marketing_app.members m
  where m.auth_user_id = auth.uid()
    and coalesce(lower(m.status),'active') = 'active'
  limit 1
$$;

create or replace function marketing_app.ibm_v171213_sakura_is_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public
as $$
  select coalesce(lower((marketing_app.ibm_v171213_sakura_member()).role_code) = any(array[
    'italo','jhulio','alejandro'
  ]), false)
$$;

create or replace function marketing_app.ibm_v171213_sakura_is_director()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public
as $$
  select coalesce(lower((marketing_app.ibm_v171213_sakura_member()).role_code) = any(array[
    'italo','jhulio'
  ]), false)
$$;

-- Recreate only SAKURA policies, leaving all other schemas untouched.
drop policy if exists sakura_knowledge_select on marketing_app.sakura_knowledge;
create policy sakura_knowledge_select on marketing_app.sakura_knowledge
for select to authenticated using (
  owner_member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or (scope = 'area' and area_id = (marketing_app.ibm_v171213_sakura_member()).area_id and status = 'published')
  or (scope = 'enterprise' and status = 'published')
  or marketing_app.ibm_v171213_sakura_is_director()
);

drop policy if exists sakura_knowledge_insert on marketing_app.sakura_knowledge;
create policy sakura_knowledge_insert on marketing_app.sakura_knowledge
for insert to authenticated with check (
  created_by_auth = auth.uid()
  and owner_member_id = (marketing_app.ibm_v171213_sakura_member()).id
  and (
    scope = 'personal'
    or (scope = 'area' and marketing_app.ibm_v171213_sakura_is_manager())
    or (scope = 'enterprise' and marketing_app.ibm_v171213_sakura_is_director())
  )
);

drop policy if exists sakura_knowledge_update on marketing_app.sakura_knowledge;
create policy sakura_knowledge_update on marketing_app.sakura_knowledge
for update to authenticated using (
  owner_member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or marketing_app.ibm_v171213_sakura_is_manager()
) with check (
  owner_member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or marketing_app.ibm_v171213_sakura_is_manager()
);

drop policy if exists sakura_knowledge_delete on marketing_app.sakura_knowledge;
create policy sakura_knowledge_delete on marketing_app.sakura_knowledge
for delete to authenticated using (
  owner_member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or marketing_app.ibm_v171213_sakura_is_director()
);

drop policy if exists sakura_preferences_all on marketing_app.sakura_user_preferences;
create policy sakura_preferences_all on marketing_app.sakura_user_preferences
for all to authenticated using (
  member_id = (marketing_app.ibm_v171213_sakura_member()).id
) with check (
  member_id = (marketing_app.ibm_v171213_sakura_member()).id
  and updated_by_auth = auth.uid()
);

drop policy if exists sakura_proposals_select on marketing_app.sakura_learning_proposals;
create policy sakura_proposals_select on marketing_app.sakura_learning_proposals
for select to authenticated using (
  member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or marketing_app.ibm_v171213_sakura_is_manager()
);

drop policy if exists sakura_proposals_insert on marketing_app.sakura_learning_proposals;
create policy sakura_proposals_insert on marketing_app.sakura_learning_proposals
for insert to authenticated with check (
  created_by_auth = auth.uid()
  and member_id = (marketing_app.ibm_v171213_sakura_member()).id
);

drop policy if exists sakura_proposals_update on marketing_app.sakura_learning_proposals;
create policy sakura_proposals_update on marketing_app.sakura_learning_proposals
for update to authenticated using (
  member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or marketing_app.ibm_v171213_sakura_is_manager()
) with check (
  member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or marketing_app.ibm_v171213_sakura_is_manager()
);

drop policy if exists sakura_audit_select on marketing_app.sakura_action_audit;
create policy sakura_audit_select on marketing_app.sakura_action_audit
for select to authenticated using (
  actor_member_id = (marketing_app.ibm_v171213_sakura_member()).id
  or marketing_app.ibm_v171213_sakura_is_manager()
);

drop policy if exists sakura_audit_insert on marketing_app.sakura_action_audit;
create policy sakura_audit_insert on marketing_app.sakura_action_audit
for insert to authenticated with check (
  created_by_auth = auth.uid()
  and actor_member_id = (marketing_app.ibm_v171213_sakura_member()).id
);

grant select, insert, update, delete on marketing_app.sakura_knowledge to authenticated;
grant select, insert, update on marketing_app.sakura_user_preferences to authenticated;
grant select, insert, update on marketing_app.sakura_learning_proposals to authenticated;
grant select, insert on marketing_app.sakura_action_audit to authenticated;
grant execute on function marketing_app.ibm_v171213_sakura_member() to authenticated;
grant execute on function marketing_app.ibm_v171213_sakura_is_manager() to authenticated;
grant execute on function marketing_app.ibm_v171213_sakura_is_director() to authenticated;

commit;
