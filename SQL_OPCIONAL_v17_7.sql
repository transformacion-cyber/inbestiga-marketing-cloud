-- INBESTIGA Marketing Cloud v17.7
-- MEMBER WALL WORK SYNC
-- Instalación OPCIONAL, manual, aditiva, atómica e idempotente.
-- No modifica las 45 RPC productivas, Auth, tablas existentes ni políticas RLS previas.
-- No ejecuta borrado físico de publicaciones o tareas.
-- La escritura remota ocurre únicamente por RPC controladas; el frontend no recibe INSERT/DELETE directo.

begin;

DO $preflight$
declare
  v_missing text;
begin
  if to_regnamespace('marketing_app') is null then
    raise exception 'Preflight v17.7: el esquema marketing_app no existe.' using errcode='3F000';
  end if;

  with required(table_name) as (
    values ('members'), ('wall_posts'), ('tasks')
  )
  select string_agg(table_name, ', ' order by table_name)
    into v_missing
  from required
  where to_regclass(format('marketing_app.%I', table_name)) is null;

  if v_missing is not null then
    raise exception 'Preflight v17.7: faltan tablas requeridas: %.', v_missing using errcode='42P01';
  end if;

  with required(table_name, column_name) as (
    values
      ('members','id'), ('members','auth_user_id'),
      ('wall_posts','id'), ('tasks','id')
  )
  select string_agg(format('%I.%I', table_name, column_name), ', ' order by table_name, column_name)
    into v_missing
  from required r
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema='marketing_app'
      and c.table_name=r.table_name
      and c.column_name=r.column_name
  );

  if v_missing is not null then
    raise exception 'Preflight v17.7: faltan columnas requeridas: %.', v_missing using errcode='42703';
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'Preflight v17.7: gen_random_uuid() no está disponible.' using errcode='42883';
  end if;
end
$preflight$;

create table if not exists marketing_app.work_activity_links (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  task_id text,
  campaign_id text,
  member_id text,
  activity_type text not null default 'task_progress'
    check (activity_type in ('task_progress','task_evidence','task_milestone','task_approved','post_to_task','post_linked')),
  visibility text not null default 'team'
    check (visibility in ('team')),
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_activity_links_post_task_type_unique unique (post_id, task_id, activity_type)
);

create index if not exists work_activity_links_post_idx
  on marketing_app.work_activity_links (post_id);
create index if not exists work_activity_links_task_idx
  on marketing_app.work_activity_links (task_id);
create index if not exists work_activity_links_member_idx
  on marketing_app.work_activity_links (member_id, created_at desc);
create index if not exists work_activity_links_campaign_idx
  on marketing_app.work_activity_links (campaign_id, created_at desc);

alter table marketing_app.work_activity_links enable row level security;

DO $policies$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='marketing_app' and tablename='work_activity_links' and policyname='v177_read_internal_links'
  ) then
    create policy v177_read_internal_links
      on marketing_app.work_activity_links
      for select
      to authenticated
      using (auth.uid() is not null);
  end if;

  -- Políticas defensivas. La escritura directa se revoca más abajo y solo las RPC pueden escribir.
  if not exists (
    select 1 from pg_policies
    where schemaname='marketing_app' and tablename='work_activity_links' and policyname='v177_create_own_links'
  ) then
    create policy v177_create_own_links
      on marketing_app.work_activity_links
      for insert
      to authenticated
      with check (created_by = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='marketing_app' and tablename='work_activity_links' and policyname='v177_remove_own_links'
  ) then
    create policy v177_remove_own_links
      on marketing_app.work_activity_links
      for delete
      to authenticated
      using (created_by = auth.uid());
  end if;
end
$policies$;

create or replace function marketing_app.ibm_v177_create_work_activity_link(
  p_post_id text,
  p_task_id text,
  p_campaign_id text,
  p_member_id text,
  p_activity_type text,
  p_summary text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_row marketing_app.work_activity_links%rowtype;
  v_actor jsonb;
  v_post jsonb;
  v_task jsonb;
  v_target_member jsonb;
  v_actor_id text;
  v_actor_area text;
  v_role_text text;
  v_scope text := 'collaborator';
  v_post_author text;
  v_task_assignee text;
  v_task_area text;
  v_target_member_id text;
  v_target_area text;
  v_campaign_id text;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada.' using errcode='42501';
  end if;

  if nullif(btrim(coalesce(p_post_id,'')), '') is null then
    raise exception 'La publicación es obligatoria.' using errcode='22023';
  end if;

  if coalesce(p_activity_type,'') not in ('task_progress','task_evidence','task_milestone','task_approved','post_to_task','post_linked') then
    raise exception 'Tipo de actividad no permitido.' using errcode='22023';
  end if;

  select to_jsonb(m)
    into v_actor
  from marketing_app.members m
  where m.auth_user_id = auth.uid()
  limit 1;

  if v_actor is null then
    raise exception 'No existe un miembro interno vinculado a esta cuenta.' using errcode='42501';
  end if;

  v_actor_id := nullif(v_actor ->> 'id', '');
  v_actor_area := nullif(v_actor ->> 'area_id', '');
  v_role_text := lower(concat_ws(
    ' ', coalesce(v_actor ->> 'full_name',''), coalesce(v_actor ->> 'role_code',''),
    coalesce(v_actor ->> 'position',''), coalesce(v_actor ->> 'display_role',''),
    coalesce(v_actor ->> 'email','')
  ));

  if v_role_text ~ '(director|dirección|direccion|gerente general|administrator|administrador|owner|propietario)'
     or v_role_text ~ '(^| )(italo|jhulio)( |$)' then
    v_scope := 'director';
  elsif v_role_text ~ '(supervisor|jefe|jefatura|coordinador|coordinadora|team lead|líder de equipo|lider de equipo|responsable de área|responsable de area|gerente)'
     or v_role_text ~ '(^| )alejandro( |$)' then
    v_scope := 'supervisor';
  end if;

  select to_jsonb(p)
    into v_post
  from marketing_app.wall_posts p
  where p.id::text = btrim(p_post_id)
  limit 1;

  if v_post is null then
    raise exception 'La publicación indicada no existe.' using errcode='23503';
  end if;

  v_post_author := coalesce(
    nullif(v_post ->> 'author_id',''), nullif(v_post ->> 'member_id',''),
    nullif(v_post ->> 'created_by_member_id',''), nullif(v_post ->> 'user_id','')
  );

  if nullif(btrim(coalesce(p_task_id,'')), '') is not null then
    select to_jsonb(t)
      into v_task
    from marketing_app.tasks t
    where t.id::text = btrim(p_task_id)
    limit 1;

    if v_task is null then
      raise exception 'La tarea indicada no existe.' using errcode='23503';
    end if;
  end if;

  v_task_assignee := coalesce(
    nullif(v_task ->> 'assigned_to',''), nullif(v_task ->> 'member_id',''),
    nullif(v_task ->> 'assignee_id','')
  );
  v_task_area := nullif(v_task ->> 'area_id','');
  v_campaign_id := coalesce(nullif(v_task ->> 'campaign_id',''), nullif(btrim(coalesce(p_campaign_id,'')), ''));
  v_target_member_id := coalesce(v_task_assignee, v_post_author, nullif(btrim(coalesce(p_member_id,'')), ''));

  if v_target_member_id is not null then
    select to_jsonb(m)
      into v_target_member
    from marketing_app.members m
    where m.id::text = v_target_member_id
    limit 1;
    v_target_area := nullif(v_target_member ->> 'area_id','');
  end if;

  -- Dirección puede vincular dentro del entorno interno.
  if v_scope = 'director' then
    v_allowed := true;
  -- Supervisión solo puede actuar en su propia área o sobre trabajo propio.
  elsif v_scope = 'supervisor' then
    v_allowed := (v_actor_id is not null and (v_actor_id = v_post_author or v_actor_id = v_task_assignee))
      or (v_actor_area is not null and (v_actor_area = v_task_area or v_actor_area = v_target_area));
  -- Colaboración: publicación propia y, cuando hay tarea, tarea asignada a la misma persona.
  else
    v_allowed := v_actor_id is not null
      and v_actor_id = v_post_author
      and (v_task is null or v_actor_id = v_task_assignee);
  end if;

  if p_activity_type = 'post_to_task' and v_scope not in ('director','supervisor') then
    raise exception 'Solo Dirección o Supervisión pueden convertir una publicación en tarea.' using errcode='42501';
  end if;

  if not v_allowed then
    raise exception 'La publicación o tarea está fuera de tu alcance autorizado.' using errcode='42501';
  end if;

  insert into marketing_app.work_activity_links (
    post_id, task_id, campaign_id, member_id, activity_type, visibility,
    summary, payload, created_by, created_at, updated_at
  ) values (
    btrim(p_post_id), nullif(btrim(coalesce(p_task_id,'')), ''),
    v_campaign_id, v_target_member_id,
    p_activity_type, 'team', left(coalesce(p_summary,''), 1000), coalesce(p_payload, '{}'::jsonb),
    auth.uid(), now(), now()
  )
  on conflict (post_id, task_id, activity_type)
  do update set
    campaign_id = excluded.campaign_id,
    member_id = excluded.member_id,
    summary = excluded.summary,
    payload = excluded.payload,
    updated_at = now()
  where marketing_app.work_activity_links.created_by = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'El vínculo ya existe y fue creado por otra cuenta.' using errcode='42501';
  end if;

  return to_jsonb(v_row);
end
$function$;

create or replace function marketing_app.ibm_v177_remove_work_activity_link(
  p_link_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión autenticada.' using errcode='42501';
  end if;

  delete from marketing_app.work_activity_links
  where id = p_link_id and created_by = auth.uid();

  get diagnostics v_count = row_count;
  return v_count > 0;
end
$function$;

create or replace function marketing_app.ibm_v177_work_activity_capabilities()
returns jsonb
language sql
stable
security invoker
set search_path = marketing_app, public
as $function$
  select jsonb_build_object(
    'version', '17.7',
    'authenticated', auth.uid() is not null,
    'table', to_regclass('marketing_app.work_activity_links') is not null,
    'reversible_links', true,
    'physical_delete_of_tasks_or_posts', false,
    'visibility', 'team',
    'direct_table_writes', false,
    'role_guarded_rpc', true
  );
$function$;

grant usage on schema marketing_app to authenticated;
grant select on marketing_app.work_activity_links to authenticated;
revoke insert, update, delete, truncate, references, trigger on marketing_app.work_activity_links from authenticated;
revoke all on marketing_app.work_activity_links from anon;

revoke all on function marketing_app.ibm_v177_create_work_activity_link(text,text,text,text,text,text,jsonb) from public, anon;
revoke all on function marketing_app.ibm_v177_remove_work_activity_link(uuid) from public, anon;
revoke all on function marketing_app.ibm_v177_work_activity_capabilities() from public, anon;
grant execute on function marketing_app.ibm_v177_create_work_activity_link(text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function marketing_app.ibm_v177_remove_work_activity_link(uuid) to authenticated;
grant execute on function marketing_app.ibm_v177_work_activity_capabilities() to authenticated;

DO $realtime$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    begin
      alter publication supabase_realtime add table marketing_app.work_activity_links;
    exception when duplicate_object then
      null;
    end;
  end if;
end
$realtime$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

commit;

select
  to_regclass('marketing_app.work_activity_links') as work_activity_links,
  to_regprocedure('marketing_app.ibm_v177_create_work_activity_link(text,text,text,text,text,text,jsonb)') as create_link_rpc,
  to_regprocedure('marketing_app.ibm_v177_remove_work_activity_link(uuid)') as remove_link_rpc,
  to_regprocedure('marketing_app.ibm_v177_work_activity_capabilities()') as capabilities_rpc;
