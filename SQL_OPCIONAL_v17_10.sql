-- INBESTIGA Marketing Cloud v17.10
-- DEADLINES & MEMBER GOVERNANCE
-- Instalación manual, opcional, transaccional e idempotente.
-- Alcance: eliminación segura SOLO dentro de marketing_app.
-- No elimina auth.users, tickets."User", Storage ni otros sistemas de la empresa.

begin;

-- ===== COMPATIBILIDAD MÍNIMA =====
do $$
declare
  v_missing text[];
begin
  select array_agg(required.column_name order by required.column_name)
    into v_missing
  from (values
    ('id'),('auth_user_id'),('email'),('full_name'),('role_code'),('position'),('status'),('updated_at')
  ) required(column_name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema='marketing_app'
      and c.table_name='members'
      and c.column_name=required.column_name
  );
  if coalesce(array_length(v_missing,1),0)>0 then
    raise exception 'v17.10 requiere columnas faltantes en marketing_app.members: %', array_to_string(v_missing,', ');
  end if;
end
$$;

-- ===== AUDITORÍA DE GOBERNANZA =====
create table if not exists marketing_app.member_governance_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('deactivate','delete')),
  target_member_id uuid,
  target_email text,
  target_snapshot jsonb not null default '{}'::jsonb,
  transfer_to_member_id uuid,
  dependency_summary jsonb not null default '{}'::jsonb,
  actor_member_id uuid,
  actor_auth_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists member_governance_log_created_idx
  on marketing_app.member_governance_log(created_at desc);
create index if not exists member_governance_log_target_idx
  on marketing_app.member_governance_log(target_member_id, created_at desc);

revoke all on table marketing_app.member_governance_log from public, anon, authenticated;

-- ===== ACTOR Y PERMISOS =====
create or replace function marketing_app.ibm_v1710_actor_member_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, auth
as $$
  select m.id
  from marketing_app.members m
  where m.auth_user_id=auth.uid()
    and coalesce(m.status,'active')='active'
  limit 1
$$;

create or replace function marketing_app.ibm_v1710_actor_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, auth
as $$
  select lower(coalesce(m.role_code,''))
  from marketing_app.members m
  where m.auth_user_id=auth.uid()
    and coalesce(m.status,'active')='active'
  limit 1
$$;

create or replace function marketing_app.ibm_v1710_is_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, auth
as $$
  select coalesce(marketing_app.ibm_v1710_actor_role() = any(array[
    'italo','jhulio','alejandro','director','admin','administrator','supervisor'
  ]),false)
$$;

create or replace function marketing_app.ibm_v1710_role_rank(p_role text)
returns integer
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select case lower(coalesce(p_role,''))
    when 'italo' then 100
    when 'director' then 100
    when 'admin' then 100
    when 'administrator' then 100
    when 'jhulio' then 80
    when 'alejandro' then 60
    when 'supervisor' then 60
    when 'member' then 10
    when 'guest' then 0
    else 10
  end
$$;

create or replace function marketing_app.ibm_v1710_can_manage_member(p_target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, auth
as $$
  select coalesce(
    case
      when actor.id is null or target.id is null or actor.id=target.id then false
      when lower(coalesce(actor.role_code,''))='italo' then true
      else marketing_app.ibm_v1710_role_rank(actor.role_code) > marketing_app.ibm_v1710_role_rank(target.role_code)
    end,
    false
  )
  from marketing_app.members actor
  left join marketing_app.members target on target.id=p_target_member_id
  where actor.auth_user_id=auth.uid()
    and coalesce(actor.status,'active')='active'
  limit 1
$$;

create or replace function marketing_app.ibm_v1710_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, auth
as $$
  select jsonb_build_object(
    'version','17.10',
    'member_governance',true,
    'deadline_ui',true,
    'actor_member_id',marketing_app.ibm_v1710_actor_member_id(),
    'actor_role',marketing_app.ibm_v1710_actor_role(),
    'can_manage_members',marketing_app.ibm_v1710_is_manager(),
    'hierarchy_scope_enforced',true,
    'auth_users_untouched',true,
    'tickets_untouched',true,
    'storage_untouched',true
  )
$$;

-- ===== DEPENDENCIAS DE UN MIEMBRO =====
create or replace function marketing_app.ibm_v1710_member_delete_preview(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, marketing_app, auth, information_schema
as $$
declare
  v_member jsonb;
  v_dependencies jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_transfer_total bigint := 0;
  v_cleanup_total bigint := 0;
  v_action text;
  v_count bigint;
  v_ref record;
  v_sql text;
begin
  if not marketing_app.ibm_v1710_is_manager() then
    raise exception 'No tienes permiso para gestionar miembros.' using errcode='42501';
  end if;
  if not marketing_app.ibm_v1710_can_manage_member(p_member_id) then
    raise exception 'No puedes gestionar un miembro de tu mismo nivel o superior.' using errcode='42501';
  end if;

  select jsonb_build_object(
    'id',m.id,'auth_user_id',m.auth_user_id,'email',m.email,'full_name',m.full_name,
    'role_code',m.role_code,'position',m.position,'status',m.status
  ) into v_member
  from marketing_app.members m
  where m.id=p_member_id;

  if v_member is null then
    raise exception 'El miembro no existe.' using errcode='P0002';
  end if;

  -- Foreign keys reales hacia marketing_app.members(id).
  for v_ref in
    select child_ns.nspname as child_schema,
           child.relname as child_table,
           child_col.attname as child_column
    from pg_constraint fk
    join pg_class parent on parent.oid=fk.confrelid
    join pg_namespace parent_ns on parent_ns.oid=parent.relnamespace
    join pg_class child on child.oid=fk.conrelid
    join pg_namespace child_ns on child_ns.oid=child.relnamespace
    join unnest(fk.conkey) with ordinality child_keys(attnum,position) on true
    join unnest(fk.confkey) with ordinality parent_keys(attnum,position) using(position)
    join pg_attribute child_col on child_col.attrelid=child.oid and child_col.attnum=child_keys.attnum
    join pg_attribute parent_col on parent_col.attrelid=parent.oid and parent_col.attnum=parent_keys.attnum
    where fk.contype='f'
      and array_length(fk.conkey,1)=1
      and parent_ns.nspname='marketing_app'
      and parent.relname='members'
      and parent_col.attname='id'
      and not (child_ns.nspname='marketing_app' and child.relname='member_governance_log')
    order by child_ns.nspname,child.relname,child_col.attname
  loop
    v_sql := format('select count(*) from %I.%I where %I=$1',v_ref.child_schema,v_ref.child_table,v_ref.child_column);
    execute v_sql into v_count using p_member_id;
    if v_count>0 then
      v_action := case when v_ref.child_table = any(array[
        'member_visual_profiles','member_work_profiles','visual_profiles','wall360_visual_profiles',
        'member_profile_visits','member_preferences'
      ]) then 'cleanup' else 'transfer' end;
      v_total := v_total+v_count;
      if v_action='cleanup' then v_cleanup_total:=v_cleanup_total+v_count; else v_transfer_total:=v_transfer_total+v_count; end if;
      v_dependencies := v_dependencies || jsonb_build_array(jsonb_build_object(
        'schema',v_ref.child_schema,'table',v_ref.child_table,'column',v_ref.child_column,
        'count',v_count,'source','foreign_key','action',v_action
      ));
    end if;
  end loop;

  -- Referencias heredadas sin FK: solo columnas conocidas que contienen el UUID del miembro.
  for v_ref in
    select c.table_schema as child_schema,c.table_name as child_table,c.column_name as child_column,c.data_type
    from information_schema.columns c
    where c.table_schema='marketing_app'
      and c.table_name not in ('members','member_governance_log')
      and c.column_name = any(array[
        'member_id','assigned_to','owner_id','actor_id','reviewer_id','submitted_by',
        'uploader_member_id','assigned_by','visitor_id','visited_member_id'
      ])
      and c.data_type in ('uuid','text','character varying')
      and not exists (
        select 1
        from pg_constraint fk
        join pg_class child on child.oid=fk.conrelid
        join pg_namespace child_ns on child_ns.oid=child.relnamespace
        join unnest(fk.conkey) child_key(attnum) on true
        join pg_attribute child_col on child_col.attrelid=child.oid and child_col.attnum=child_key.attnum
        where fk.contype='f'
          and child_ns.nspname=c.table_schema
          and child.relname=c.table_name
          and child_col.attname=c.column_name
          and fk.confrelid='marketing_app.members'::regclass
      )
    order by c.table_name,c.column_name
  loop
    v_sql := format('select count(*) from %I.%I where %I::text=$1',v_ref.child_schema,v_ref.child_table,v_ref.child_column);
    execute v_sql into v_count using p_member_id::text;
    if v_count>0 then
      v_action := case when v_ref.child_table = any(array[
        'member_visual_profiles','member_work_profiles','visual_profiles','wall360_visual_profiles',
        'member_profile_visits','member_preferences'
      ]) then 'cleanup' else 'transfer' end;
      v_total := v_total+v_count;
      if v_action='cleanup' then v_cleanup_total:=v_cleanup_total+v_count; else v_transfer_total:=v_transfer_total+v_count; end if;
      v_dependencies := v_dependencies || jsonb_build_array(jsonb_build_object(
        'schema',v_ref.child_schema,'table',v_ref.child_table,'column',v_ref.child_column,
        'count',v_count,'source','legacy_column','action',v_action
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'version','17.10',
    'member',v_member,
    'total_dependencies',v_total,
    'transfer_dependencies',v_transfer_total,
    'cleanup_dependencies',v_cleanup_total,
    'requires_transfer',v_transfer_total>0,
    'dependencies',v_dependencies,
    'auth_user_will_be_deleted',false,
    'tickets_user_will_be_deleted',false
  );
end
$$;

-- ===== DESACTIVACIÓN =====
create or replace function marketing_app.ibm_v1710_deactivate_member(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, auth
as $$
declare
  v_actor uuid;
  v_snapshot jsonb;
begin
  if not marketing_app.ibm_v1710_is_manager() then
    raise exception 'No tienes permiso para desactivar miembros.' using errcode='42501';
  end if;
  if not marketing_app.ibm_v1710_can_manage_member(p_member_id) then
    raise exception 'No puedes desactivar un miembro de tu mismo nivel o superior.' using errcode='42501';
  end if;
  v_actor := marketing_app.ibm_v1710_actor_member_id();
  if p_member_id=v_actor then
    raise exception 'No puedes desactivar tu propia cuenta.' using errcode='22023';
  end if;

  select to_jsonb(m) into v_snapshot from marketing_app.members m where m.id=p_member_id;
  if v_snapshot is null then raise exception 'El miembro no existe.' using errcode='P0002'; end if;
  if lower(coalesce(v_snapshot->>'role_code',''))='italo' and (
    select count(*) from marketing_app.members where lower(coalesce(role_code,''))='italo' and coalesce(status,'active')='active'
  )<=1 then
    raise exception 'No se puede desactivar al último usuario con rol italo.' using errcode='23514';
  end if;

  update marketing_app.members
     set status='inactive',updated_at=now()
   where id=p_member_id;

  insert into marketing_app.member_governance_log(
    action,target_member_id,target_email,target_snapshot,actor_member_id,dependency_summary
  ) values (
    'deactivate',p_member_id,v_snapshot->>'email',v_snapshot,v_actor,'{}'::jsonb
  );

  return jsonb_build_object('ok',true,'action','deactivate','member_id',p_member_id,'auth_user_untouched',true);
end
$$;

-- ===== ELIMINACIÓN PERMANENTE DE MARKETING CLOUD =====
create or replace function marketing_app.ibm_v1710_delete_member(
  p_member_id uuid,
  p_transfer_to_member_id uuid default null,
  p_confirm_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, auth, information_schema
as $$
declare
  v_actor uuid;
  v_actor_role text;
  v_member marketing_app.members%rowtype;
  v_target marketing_app.members%rowtype;
  v_preview jsonb;
  v_dependencies jsonb;
  v_total bigint;
  v_transfer_total bigint;
  v_ref record;
  v_sql text;
  v_rows bigint;
begin
  if not marketing_app.ibm_v1710_is_manager() then
    raise exception 'No tienes permiso para eliminar miembros.' using errcode='42501';
  end if;
  if not marketing_app.ibm_v1710_can_manage_member(p_member_id) then
    raise exception 'No puedes eliminar un miembro de tu mismo nivel o superior.' using errcode='42501';
  end if;
  v_actor := marketing_app.ibm_v1710_actor_member_id();
  v_actor_role := marketing_app.ibm_v1710_actor_role();
  if p_member_id=v_actor then
    raise exception 'No puedes eliminar tu propia cuenta.' using errcode='22023';
  end if;

  select * into v_member from marketing_app.members where id=p_member_id for update;
  if not found then raise exception 'El miembro no existe.' using errcode='P0002'; end if;
  if lower(btrim(coalesce(p_confirm_email,'')))<>lower(btrim(v_member.email)) then
    raise exception 'La confirmación no coincide con el correo del miembro.' using errcode='22023';
  end if;

  if lower(coalesce(v_member.role_code,''))='italo' and (
    select count(*) from marketing_app.members where lower(coalesce(role_code,''))='italo' and coalesce(status,'active')='active'
  )<=1 then
    raise exception 'No se puede eliminar al último usuario con rol italo.' using errcode='23514';
  end if;

  if p_transfer_to_member_id is not null then
    if p_transfer_to_member_id=p_member_id then raise exception 'El miembro de transferencia debe ser diferente.' using errcode='22023'; end if;
    select * into v_target from marketing_app.members
     where id=p_transfer_to_member_id and coalesce(status,'active')='active';
    if not found then raise exception 'El miembro de transferencia no existe o está inactivo.' using errcode='P0002'; end if;
  end if;

  v_preview := marketing_app.ibm_v1710_member_delete_preview(p_member_id);
  v_dependencies := coalesce(v_preview->'dependencies','[]'::jsonb);
  v_total := coalesce((v_preview->>'total_dependencies')::bigint,0);
  v_transfer_total := coalesce((v_preview->>'transfer_dependencies')::bigint,v_total);
  if v_transfer_total>0 and p_transfer_to_member_id is null then
    raise exception 'El miembro tiene % registros de trabajo vinculados. Selecciona a quién transferirlos.',v_transfer_total using errcode='23503';
  end if;

  -- Retirar únicamente configuraciones personales y visitas del perfil eliminado.
  for v_ref in
    select c.table_schema as child_schema,c.table_name as child_table,c.column_name as child_column,c.data_type
    from information_schema.columns c
    where c.table_schema='marketing_app'
      and c.table_name = any(array[
        'member_visual_profiles','member_work_profiles','visual_profiles','wall360_visual_profiles',
        'member_profile_visits','member_preferences'
      ])
      and c.column_name = any(array['member_id','visitor_id','visited_member_id'])
      and c.data_type in ('uuid','text','character varying')
    order by c.table_name,c.column_name
  loop
    if v_ref.data_type='uuid' then
      execute format('delete from %I.%I where %I=$1',v_ref.child_schema,v_ref.child_table,v_ref.child_column) using p_member_id;
    else
      execute format('delete from %I.%I where %I::text=$1',v_ref.child_schema,v_ref.child_table,v_ref.child_column) using p_member_id::text;
    end if;
  end loop;

  -- Transferir todas las FK reales hacia members(id).
  for v_ref in
    select child_ns.nspname as child_schema,
           child.relname as child_table,
           child_col.attname as child_column
    from pg_constraint fk
    join pg_class parent on parent.oid=fk.confrelid
    join pg_namespace parent_ns on parent_ns.oid=parent.relnamespace
    join pg_class child on child.oid=fk.conrelid
    join pg_namespace child_ns on child_ns.oid=child.relnamespace
    join unnest(fk.conkey) with ordinality child_keys(attnum,position) on true
    join unnest(fk.confkey) with ordinality parent_keys(attnum,position) using(position)
    join pg_attribute child_col on child_col.attrelid=child.oid and child_col.attnum=child_keys.attnum
    join pg_attribute parent_col on parent_col.attrelid=parent.oid and parent_col.attnum=parent_keys.attnum
    where fk.contype='f'
      and array_length(fk.conkey,1)=1
      and parent_ns.nspname='marketing_app'
      and parent.relname='members'
      and parent_col.attname='id'
      and not (child_ns.nspname='marketing_app' and child.relname='member_governance_log')
      and child.relname <> all(array[
        'member_visual_profiles','member_work_profiles','visual_profiles','wall360_visual_profiles',
        'member_profile_visits','member_preferences'
      ])
    order by child_ns.nspname,child.relname,child_col.attname
  loop
    if p_transfer_to_member_id is not null then
      -- Resolver duplicados previsibles de participantes antes del update.
      if v_ref.child_schema='marketing_app' and v_ref.child_table='task_participants' and v_ref.child_column='member_id' then
        execute format(
          'delete from %I.%I src using %I.%I dst where src.task_id=dst.task_id and src.%I=$1 and dst.%I=$2',
          v_ref.child_schema,v_ref.child_table,v_ref.child_schema,v_ref.child_table,v_ref.child_column,v_ref.child_column
        ) using p_member_id,p_transfer_to_member_id;
      end if;
      begin
        execute format('update %I.%I set %I=$1 where %I=$2',v_ref.child_schema,v_ref.child_table,v_ref.child_column,v_ref.child_column)
          using p_transfer_to_member_id,p_member_id;
      exception when unique_violation then
        raise exception 'Transferencia detenida de forma segura: existe un conflicto único en %.% (%). Revisa esa relación antes de eliminar.',
          v_ref.child_schema,v_ref.child_table,v_ref.child_column using errcode='23505';
      end;
    end if;
  end loop;

  -- Transferir columnas heredadas sin FK que contengan el member UUID.
  for v_ref in
    select c.table_schema as child_schema,c.table_name as child_table,c.column_name as child_column,c.data_type
    from information_schema.columns c
    where c.table_schema='marketing_app'
      and c.table_name not in (
        'members','member_governance_log','member_visual_profiles','member_work_profiles',
        'visual_profiles','wall360_visual_profiles','member_profile_visits','member_preferences'
      )
      and c.column_name = any(array[
        'member_id','assigned_to','owner_id','actor_id','reviewer_id','submitted_by',
        'uploader_member_id','assigned_by','visitor_id','visited_member_id'
      ])
      and c.data_type in ('uuid','text','character varying')
      and not exists (
        select 1
        from pg_constraint fk
        join pg_class child on child.oid=fk.conrelid
        join pg_namespace child_ns on child_ns.oid=child.relnamespace
        join unnest(fk.conkey) child_key(attnum) on true
        join pg_attribute child_col on child_col.attrelid=child.oid and child_col.attnum=child_key.attnum
        where fk.contype='f'
          and child_ns.nspname=c.table_schema
          and child.relname=c.table_name
          and child_col.attname=c.column_name
          and fk.confrelid='marketing_app.members'::regclass
      )
    order by c.table_name,c.column_name
  loop
    if p_transfer_to_member_id is not null then
      begin
        if v_ref.data_type='uuid' then
          execute format('update %I.%I set %I=$1 where %I=$2',v_ref.child_schema,v_ref.child_table,v_ref.child_column,v_ref.child_column)
            using p_transfer_to_member_id,p_member_id;
        else
          execute format('update %I.%I set %I=$1 where %I::text=$2',v_ref.child_schema,v_ref.child_table,v_ref.child_column,v_ref.child_column)
            using p_transfer_to_member_id::text,p_member_id::text;
        end if;
      exception when unique_violation then
        raise exception 'Transferencia detenida de forma segura: existe un conflicto único en %.% (%). Revisa esa relación antes de eliminar.',
          v_ref.child_schema,v_ref.child_table,v_ref.child_column using errcode='23505';
      end;
    end if;
  end loop;

  insert into marketing_app.member_governance_log(
    action,target_member_id,target_email,target_snapshot,transfer_to_member_id,
    dependency_summary,actor_member_id
  ) values (
    'delete',v_member.id,v_member.email,to_jsonb(v_member),p_transfer_to_member_id,
    v_preview,v_actor
  );

  delete from marketing_app.members where id=p_member_id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'No se pudo eliminar exactamente un perfil.'; end if;

  return jsonb_build_object(
    'ok',true,'action','delete','member_id',p_member_id,'email',v_member.email,
    'transferred_to',p_transfer_to_member_id,'dependencies_transferred',v_transfer_total,
    'profile_dependencies_removed',coalesce((v_preview->>'cleanup_dependencies')::bigint,0),
    'auth_user_untouched',true,'tickets_user_untouched',true,'storage_untouched',true,
    'message','Perfil eliminado de Marketing Cloud. Auth y otros sistemas permanecen intactos.'
  );
end
$$;

revoke all on function marketing_app.ibm_v1710_actor_member_id() from public, anon;
revoke all on function marketing_app.ibm_v1710_actor_role() from public, anon;
revoke all on function marketing_app.ibm_v1710_is_manager() from public, anon;
revoke all on function marketing_app.ibm_v1710_role_rank(text) from public, anon;
revoke all on function marketing_app.ibm_v1710_can_manage_member(uuid) from public, anon;
revoke all on function marketing_app.ibm_v1710_capabilities() from public, anon;
revoke all on function marketing_app.ibm_v1710_member_delete_preview(uuid) from public, anon;
revoke all on function marketing_app.ibm_v1710_deactivate_member(uuid) from public, anon;
revoke all on function marketing_app.ibm_v1710_delete_member(uuid,uuid,text) from public, anon;

grant execute on function marketing_app.ibm_v1710_actor_member_id() to authenticated;
grant execute on function marketing_app.ibm_v1710_actor_role() to authenticated;
grant execute on function marketing_app.ibm_v1710_is_manager() to authenticated;
grant execute on function marketing_app.ibm_v1710_role_rank(text) to authenticated;
grant execute on function marketing_app.ibm_v1710_can_manage_member(uuid) to authenticated;
grant execute on function marketing_app.ibm_v1710_capabilities() to authenticated;
grant execute on function marketing_app.ibm_v1710_member_delete_preview(uuid) to authenticated;
grant execute on function marketing_app.ibm_v1710_deactivate_member(uuid) to authenticated;
grant execute on function marketing_app.ibm_v1710_delete_member(uuid,uuid,text) to authenticated;

notify pgrst,'reload schema';

commit;

select marketing_app.ibm_v1710_capabilities() as v17_10_capabilities;
