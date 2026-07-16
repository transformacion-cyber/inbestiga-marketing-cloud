-- INBESTIGA Marketing Cloud v17.5.1
-- DATABASE COMPATIBILITY HOTFIX · RECORD LIFECYCLE CONTROLS
-- SQL OPCIONAL, MANUAL, ATOMICO, IDEMPOTENTE, ADITIVO Y NO DESTRUCTIVO.
-- NO se ejecuta automaticamente. No modifica las 45 RPC productivas existentes.
-- Corrige la compatibilidad con las tablas reales del esquema marketing_app:
-- campaigns, tasks, briefs, editorial_items, assets, templates, incidents y report_snapshots.
-- "Eliminar" significa enviar a papelera reversible. NO existe DELETE fisico ni cascada.
-- Si la validacion previa falla, toda la transaccion se revierte y no deja instalacion parcial.

begin;

-- 1. VALIDACION PREVIA: no crea objetos si la base no coincide con el contrato observado.
do $preflight$
declare
  v_missing_tables text;
  v_missing_columns text;
begin
  if to_regnamespace('marketing_app') is null then
    raise exception 'No existe el esquema marketing_app. Instalacion cancelada sin cambios.' using errcode = '3F000';
  end if;

  with required(table_name) as (
    values
      ('campaigns'),
      ('tasks'),
      ('briefs'),
      ('editorial_items'),
      ('assets'),
      ('templates'),
      ('incidents'),
      ('report_snapshots'),
      ('members')
  )
  select string_agg(table_name, ', ' order by table_name)
    into v_missing_tables
  from required
  where to_regclass(format('marketing_app.%I', table_name)) is null;

  if v_missing_tables is not null then
    raise exception 'Faltan tablas requeridas en marketing_app: %. Instalacion cancelada sin cambios.', v_missing_tables
      using errcode = '42P01';
  end if;

  with required(table_name, column_name) as (
    values
      ('campaigns','id'),
      ('tasks','id'),
      ('briefs','id'),
      ('editorial_items','id'),
      ('assets','id'),
      ('templates','id'),
      ('incidents','id'),
      ('report_snapshots','id'),
      ('members','id'),
      ('members','auth_user_id')
  )
  select string_agg(format('%I.%I', r.table_name, r.column_name), ', ' order by r.table_name, r.column_name)
    into v_missing_columns
  from required r
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'marketing_app'
      and c.table_name = r.table_name
      and c.column_name = r.column_name
  );

  if v_missing_columns is not null then
    raise exception 'Faltan columnas requeridas: %. Instalacion cancelada sin cambios.', v_missing_columns
      using errcode = '42703';
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'gen_random_uuid() no esta disponible. Instalacion cancelada sin cambios.' using errcode = '42883';
  end if;
end;
$preflight$;

-- 2. METADATOS ADITIVOS. No se alteran las tablas productivas existentes.
create table if not exists marketing_app.record_lifecycle (
  entity_type text not null,
  entity_id text not null,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active','archived','trashed')),
  reason text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create table if not exists marketing_app.record_change_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists record_lifecycle_state_idx
  on marketing_app.record_lifecycle(lifecycle_state, entity_type, updated_at desc);

create index if not exists record_change_log_entity_idx
  on marketing_app.record_change_log(entity_type, entity_id, changed_at desc);

alter table marketing_app.record_lifecycle enable row level security;
alter table marketing_app.record_change_log enable row level security;

-- La visibilidad del estado sigue la visibilidad de las tablas productivas existentes.
drop policy if exists record_lifecycle_read_authenticated on marketing_app.record_lifecycle;
create policy record_lifecycle_read_authenticated
  on marketing_app.record_lifecycle
  for select
  to authenticated
  using (
    case lower(entity_type)
      when 'campaign' then exists (
        select 1 from marketing_app.campaigns x where x.id::text = entity_id
      )
      when 'task' then exists (
        select 1 from marketing_app.tasks x where x.id::text = entity_id
      )
      when 'brief' then exists (
        select 1 from marketing_app.briefs x where x.id::text = entity_id
      )
      when 'editorial' then exists (
        select 1 from marketing_app.editorial_items x where x.id::text = entity_id
      )
      when 'asset' then exists (
        select 1 from marketing_app.assets x where x.id::text = entity_id
      )
      when 'template' then exists (
        select 1 from marketing_app.templates x where x.id::text = entity_id
      )
      when 'incident' then exists (
        select 1 from marketing_app.incidents x where x.id::text = entity_id
      )
      when 'report' then exists (
        select 1 from marketing_app.report_snapshots x where x.id::text = entity_id
      )
      else false
    end
  );

-- No existe escritura directa del frontend sobre las tablas de auditoria.
grant usage on schema marketing_app to authenticated;
grant select on marketing_app.record_lifecycle to authenticated;
revoke all on marketing_app.record_lifecycle from anon;
revoke insert, update, delete, truncate, references, trigger
  on marketing_app.record_lifecycle from authenticated;
revoke all on marketing_app.record_change_log from public, anon, authenticated;

-- 3. ROL OPERATIVO DEL USUARIO AUTENTICADO.
create or replace function marketing_app.ibm_v175_actor_scope()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_member jsonb;
  v_role_text text := '';
begin
  if auth.uid() is null then
    return 'anon';
  end if;

  select to_jsonb(m)
    into v_member
  from marketing_app.members m
  where m.auth_user_id = auth.uid()
  limit 1;

  if v_member is null then
    return 'collaborator';
  end if;

  v_role_text := lower(concat_ws(
    ' ',
    coalesce(v_member ->> 'full_name', ''),
    coalesce(v_member ->> 'role_code', ''),
    coalesce(v_member ->> 'position', ''),
    coalesce(v_member ->> 'display_role', ''),
    coalesce(v_member ->> 'email', '')
  ));

  if v_role_text ~ '(director|dirección|direccion|gerente general|administrator|administrador|owner|propietario)'
     or v_role_text ~ '(^| )(italo|jhulio)( |$)' then
    return 'director';
  end if;

  if v_role_text ~ '(supervisor|jefe|jefatura|coordinador|coordinadora|team lead|líder de equipo|lider de equipo|responsable de área|responsable de area|gerente)'
     or v_role_text ~ '(^| )alejandro( |$)' then
    return 'supervisor';
  end if;

  return 'collaborator';
end;
$function$;

revoke all on function marketing_app.ibm_v175_actor_scope() from public, anon;
grant execute on function marketing_app.ibm_v175_actor_scope() to authenticated;

-- 4. EDICION CONTROLADA CON LISTA BLANCA Y AUDITORIA.
create or replace function marketing_app.ibm_v175_patch_record(
  p_entity_type text,
  p_entity_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_entity text := lower(trim(coalesce(p_entity_type, '')));
  v_table text;
  v_allowed text[];
  v_column text;
  v_type text;
  v_sets text[] := array[]::text[];
  v_before jsonb;
  v_after jsonb;
  v_relation regclass;
  v_scope text;
  v_member jsonb;
  v_actor_id text;
  v_area_id text;
  v_in_scope boolean := false;
  v_target_id text;
  v_linked jsonb;
begin
  v_scope := marketing_app.ibm_v175_actor_scope();
  if v_scope not in ('director','supervisor') then
    raise exception 'No autorizado para editar registros estructurales' using errcode = '42501';
  end if;

  select to_jsonb(m)
    into v_member
  from marketing_app.members m
  where m.auth_user_id = auth.uid()
  limit 1;

  v_actor_id := nullif(v_member ->> 'id', '');
  v_area_id := nullif(v_member ->> 'area_id', '');

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'El parche debe ser un objeto JSON' using errcode = '22023';
  end if;

  case v_entity
    when 'campaign' then
      v_table := 'campaigns';
      v_allowed := array['name','client_id','area_id','status','start_date','end_date','objective','audience','main_message'];
    when 'task' then
      v_table := 'tasks';
      v_allowed := array['title','description','assigned_to','client_id','area_id','campaign_id','due_date','due_time','priority','impact','checklist'];
    when 'brief' then
      v_table := 'briefs';
      v_allowed := array['campaign_id','title','objective','audience','formats','references_text','brand_rules','deliverables'];
    when 'editorial' then
      v_table := 'editorial_items';
      v_allowed := array['title','client_id','campaign_id','platform','format','copy_text','asset_url','publish_date','publish_time','status','owner_id'];
    when 'asset' then
      v_table := 'assets';
      v_allowed := array['name','client_id','campaign_id','related_task_id','file_type','notes'];
    when 'template' then
      v_table := 'templates';
      v_allowed := array['name','type','description','content','status'];
    when 'incident' then
      v_table := 'incidents';
      v_allowed := array['title','description','severity','status','client_id','campaign_id','assigned_to'];
    else
      raise exception 'Tipo de registro no compatible: %', p_entity_type using errcode = '22023';
  end case;

  v_relation := to_regclass(format('marketing_app.%I', v_table));
  if v_relation is null then
    raise exception 'La tabla marketing_app.% no existe', v_table using errcode = '42P01';
  end if;

  execute format('select to_jsonb(t) from marketing_app.%I t where t.id::text = $1', v_table)
    using p_entity_id
    into v_before;

  if v_before is null then
    raise exception 'Registro no encontrado' using errcode = 'P0002';
  end if;

  -- Defensa en profundidad para Supervisión.
  if v_scope = 'supervisor' then
    case v_entity
      when 'campaign' then
        v_in_scope := v_area_id is not null and (v_before ->> 'area_id') = v_area_id;

      when 'task' then
        v_in_scope := (v_actor_id is not null and (v_before ->> 'assigned_to') = v_actor_id)
          or (v_area_id is not null and (v_before ->> 'area_id') = v_area_id);
        if not coalesce(v_in_scope, false) and nullif(v_before ->> 'campaign_id', '') is not null then
          execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
            using (v_before ->> 'campaign_id') into v_linked;
          v_in_scope := v_area_id is not null and (v_linked ->> 'area_id') = v_area_id;
        end if;

      when 'brief' then
        execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
          using (v_before ->> 'campaign_id') into v_linked;
        v_in_scope := v_area_id is not null and (v_linked ->> 'area_id') = v_area_id;

      when 'editorial' then
        v_in_scope := v_actor_id is not null and (v_before ->> 'owner_id') = v_actor_id;
        if not coalesce(v_in_scope, false) and nullif(v_before ->> 'campaign_id', '') is not null then
          execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
            using (v_before ->> 'campaign_id') into v_linked;
          v_in_scope := v_area_id is not null and (v_linked ->> 'area_id') = v_area_id;
        end if;

      when 'asset' then
        v_in_scope := false;
        if nullif(v_before ->> 'campaign_id', '') is not null then
          execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
            using (v_before ->> 'campaign_id') into v_linked;
          v_in_scope := v_area_id is not null and (v_linked ->> 'area_id') = v_area_id;
        end if;
        if not coalesce(v_in_scope, false) and nullif(v_before ->> 'related_task_id', '') is not null then
          execute 'select to_jsonb(t) from marketing_app.tasks t where t.id::text = $1'
            using (v_before ->> 'related_task_id') into v_linked;
          v_in_scope := (v_actor_id is not null and (v_linked ->> 'assigned_to') = v_actor_id)
            or (v_area_id is not null and (v_linked ->> 'area_id') = v_area_id);
          if not coalesce(v_in_scope, false) and nullif(v_linked ->> 'campaign_id', '') is not null then
            execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
              using (v_linked ->> 'campaign_id') into v_linked;
            v_in_scope := v_area_id is not null and (v_linked ->> 'area_id') = v_area_id;
          end if;
        end if;

      when 'incident' then
        v_in_scope := v_actor_id is not null and (v_before ->> 'assigned_to') = v_actor_id;
        if not coalesce(v_in_scope, false) and nullif(v_before ->> 'campaign_id', '') is not null then
          execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
            using (v_before ->> 'campaign_id') into v_linked;
          v_in_scope := v_area_id is not null and (v_linked ->> 'area_id') = v_area_id;
        end if;

      when 'template' then
        v_in_scope := false;

      else
        v_in_scope := false;
    end case;

    if not coalesce(v_in_scope, false) then
      raise exception 'Supervisión no puede editar este registro fuera de su alcance' using errcode = '42501';
    end if;

    if p_patch ? 'area_id' and nullif(p_patch ->> 'area_id', '') is distinct from v_area_id then
      raise exception 'Supervisión no puede cambiar el área del registro' using errcode = '42501';
    end if;

    if p_patch ? 'campaign_id' then
      v_target_id := nullif(p_patch ->> 'campaign_id', '');
      if v_target_id is not null then
        execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
          using v_target_id into v_linked;
        if v_linked is null or v_area_id is null or (v_linked ->> 'area_id') is distinct from v_area_id then
          raise exception 'La campaña de destino está fuera del alcance de Supervisión' using errcode = '42501';
        end if;
      end if;
    end if;

    if p_patch ? 'assigned_to' or p_patch ? 'owner_id' then
      v_target_id := coalesce(nullif(p_patch ->> 'assigned_to', ''), nullif(p_patch ->> 'owner_id', ''));
      if v_target_id is not null then
        execute 'select to_jsonb(m) from marketing_app.members m where m.id::text = $1'
          using v_target_id into v_linked;
        if v_linked is null
           or not (
             (v_actor_id is not null and (v_linked ->> 'id') = v_actor_id)
             or (v_area_id is not null and (v_linked ->> 'area_id') = v_area_id)
           ) then
          raise exception 'El responsable de destino está fuera del alcance de Supervisión' using errcode = '42501';
        end if;
      end if;
    end if;

    if p_patch ? 'related_task_id' then
      v_target_id := nullif(p_patch ->> 'related_task_id', '');
      if v_target_id is not null then
        execute 'select to_jsonb(t) from marketing_app.tasks t where t.id::text = $1'
          using v_target_id into v_linked;
        v_in_scope := v_linked is not null and (
          (v_actor_id is not null and (v_linked ->> 'assigned_to') = v_actor_id)
          or (v_area_id is not null and (v_linked ->> 'area_id') = v_area_id)
        );
        if not coalesce(v_in_scope, false) and v_linked is not null and nullif(v_linked ->> 'campaign_id', '') is not null then
          execute 'select to_jsonb(c) from marketing_app.campaigns c where c.id::text = $1'
            using (v_linked ->> 'campaign_id') into v_linked;
          v_in_scope := v_area_id is not null and (v_linked ->> 'area_id') = v_area_id;
        end if;
        if not coalesce(v_in_scope, false) then
          raise exception 'La tarea relacionada está fuera del alcance de Supervisión' using errcode = '42501';
        end if;
      end if;
    end if;
  end if;

  -- Solo se aceptan campos de la lista blanca que realmente existan en la tabla productiva.
  for v_column in select jsonb_object_keys(p_patch)
  loop
    if not (v_column = any(v_allowed)) then
      continue;
    end if;

    select format_type(a.atttypid, a.atttypmod)
      into v_type
    from pg_attribute a
    where a.attrelid = v_relation
      and a.attname = v_column
      and a.attnum > 0
      and not a.attisdropped;

    if v_type is null then
      continue;
    elsif v_type in ('json','jsonb') then
      v_sets := array_append(v_sets, format(
        '%1$I = case when jsonb_typeof($1 -> %2$L) = ''null'' then null else ($1 -> %2$L)::%3$s end',
        v_column, v_column, v_type
      ));
    elsif right(v_type, 2) = '[]' then
      v_sets := array_append(v_sets, format(
        '%1$I = case '
        || 'when jsonb_typeof($1 -> %2$L) = ''null'' then null '
        || 'when jsonb_typeof($1 -> %2$L) = ''array'' then array(select jsonb_array_elements_text($1 -> %2$L))::%3$s '
        || 'else regexp_split_to_array($1 ->> %2$L, E''\\s*[,\\n]+\\s*'')::%3$s end',
        v_column, v_column, v_type
      ));
    else
      v_sets := array_append(v_sets, format(
        '%1$I = case when jsonb_typeof($1 -> %2$L) = ''null'' then null else ($1 ->> %2$L)::%3$s end',
        v_column, v_column, v_type
      ));
    end if;
  end loop;

  if array_length(v_sets, 1) is null then
    raise exception 'No se recibieron campos editables válidos para la estructura real de marketing_app.%', v_table
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_attribute a
    where a.attrelid = v_relation
      and a.attname = 'updated_at'
      and a.attnum > 0
      and not a.attisdropped
  ) then
    v_sets := array_append(v_sets, 'updated_at = now()');
  end if;

  execute format(
    'update marketing_app.%I as t set %s where t.id::text = $2 returning to_jsonb(t)',
    v_table,
    array_to_string(v_sets, ', ')
  ) using p_patch, p_entity_id into v_after;

  if v_after is null then
    raise exception 'El registro dejó de estar disponible durante la actualización' using errcode = 'P0002';
  end if;

  insert into marketing_app.record_change_log(
    entity_type, entity_id, action, before_data, after_data, changed_by
  ) values (
    v_entity, p_entity_id, 'edit', v_before, v_after, auth.uid()
  );

  return v_after;
end;
$function$;

revoke all on function marketing_app.ibm_v175_patch_record(text,text,jsonb) from public, anon;
grant execute on function marketing_app.ibm_v175_patch_record(text,text,jsonb) to authenticated;

-- 5. ARCHIVADO, PAPELERA Y RESTAURACION REVERSIBLES.
create or replace function marketing_app.ibm_v175_set_record_state(
  p_entity_type text,
  p_entity_id text,
  p_lifecycle_state text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_entity text := lower(trim(coalesce(p_entity_type, '')));
  v_table text;
  v_existing jsonb;
  v_result jsonb;
begin
  if marketing_app.ibm_v175_actor_scope() <> 'director' then
    raise exception 'Solo Dirección puede archivar, enviar a papelera o restaurar registros' using errcode = '42501';
  end if;

  if p_lifecycle_state not in ('active','archived','trashed') then
    raise exception 'Estado de ciclo de vida no válido' using errcode = '22023';
  end if;

  case v_entity
    when 'campaign' then v_table := 'campaigns';
    when 'task' then v_table := 'tasks';
    when 'brief' then v_table := 'briefs';
    when 'editorial' then v_table := 'editorial_items';
    when 'asset' then v_table := 'assets';
    when 'template' then v_table := 'templates';
    when 'incident' then v_table := 'incidents';
    when 'report' then v_table := 'report_snapshots';
    else
      raise exception 'Tipo de registro no compatible: %', p_entity_type using errcode = '22023';
  end case;

  execute format('select to_jsonb(t) from marketing_app.%I t where t.id::text = $1', v_table)
    using p_entity_id
    into v_existing;

  if v_existing is null then
    raise exception 'Registro no encontrado' using errcode = 'P0002';
  end if;

  insert into marketing_app.record_lifecycle as rl(
    entity_type, entity_id, lifecycle_state, reason, updated_by, updated_at
  ) values (
    v_entity,
    p_entity_id,
    p_lifecycle_state,
    nullif(trim(coalesce(p_reason, '')), ''),
    auth.uid(),
    now()
  )
  on conflict (entity_type, entity_id) do update
    set lifecycle_state = excluded.lifecycle_state,
        reason = excluded.reason,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
  returning to_jsonb(rl) into v_result;

  insert into marketing_app.record_change_log(
    entity_type, entity_id, action, before_data, after_data, changed_by
  ) values (
    v_entity,
    p_entity_id,
    case p_lifecycle_state
      when 'active' then 'restore'
      when 'archived' then 'archive'
      else 'trash'
    end,
    v_existing,
    jsonb_build_object(
      'lifecycle_state', p_lifecycle_state,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    ),
    auth.uid()
  );

  return v_result;
end;
$function$;

revoke all on function marketing_app.ibm_v175_set_record_state(text,text,text,text) from public, anon;
grant execute on function marketing_app.ibm_v175_set_record_state(text,text,text,text) to authenticated;

-- 6. SONDA DE CAPACIDADES PARA SALUD Y CERTIFICACION.
create or replace function marketing_app.ibm_v175_lifecycle_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
  select jsonb_build_object(
    'version', '17.5.1',
    'scope', marketing_app.ibm_v175_actor_scope(),
    'soft_delete_only', true,
    'physical_delete_enabled', false,
    'record_lifecycle', to_regclass('marketing_app.record_lifecycle') is not null,
    'record_change_log', to_regclass('marketing_app.record_change_log') is not null,
    'table_map', jsonb_build_object(
      'campaign', 'campaigns',
      'task', 'tasks',
      'brief', 'briefs',
      'editorial', 'editorial_items',
      'asset', 'assets',
      'template', 'templates',
      'incident', 'incidents',
      'report', 'report_snapshots'
    ),
    'atomic_installer', true
  );
$function$;

revoke all on function marketing_app.ibm_v175_lifecycle_capabilities() from public, anon;
grant execute on function marketing_app.ibm_v175_lifecycle_capabilities() to authenticated;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';

commit;

-- Resultado no destructivo de instalacion. Debe mostrar todos los objetos como CREADOS.
select *
from (
  select 'Tabla record_lifecycle' as objeto,
         coalesce(to_regclass('marketing_app.record_lifecycle')::text, 'NO CREADA') as estado
  union all
  select 'Tabla record_change_log',
         coalesce(to_regclass('marketing_app.record_change_log')::text, 'NO CREADA')
  union all
  select 'RPC actor_scope',
         coalesce(to_regprocedure('marketing_app.ibm_v175_actor_scope()')::text, 'NO CREADA')
  union all
  select 'RPC patch_record',
         coalesce(to_regprocedure('marketing_app.ibm_v175_patch_record(text,text,jsonb)')::text, 'NO CREADA')
  union all
  select 'RPC set_record_state',
         coalesce(to_regprocedure('marketing_app.ibm_v175_set_record_state(text,text,text,text)')::text, 'NO CREADA')
  union all
  select 'RPC lifecycle_capabilities',
         coalesce(to_regprocedure('marketing_app.ibm_v175_lifecycle_capabilities()')::text, 'NO CREADA')
) diagnostico;
