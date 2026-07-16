-- INBESTIGA Marketing Cloud v17.8
-- DESIGN SYSTEM STUDIO
-- Instalación OPCIONAL, manual, aditiva, transaccional e idempotente.
-- No modifica Auth, Creative Arena, las 45 RPC productivas ni tablas existentes.
-- No permite CSS o JavaScript libre. La aplicación cliente normaliza una lista blanca de variables.
-- No crea buckets ni ejecuta borrado físico de archivos.

begin;

DO $preflight$
declare
  v_missing text;
begin
  if to_regnamespace('marketing_app') is null then
    raise exception 'Preflight v17.8: el esquema marketing_app no existe.' using errcode='3F000';
  end if;
  if to_regclass('marketing_app.members') is null then
    raise exception 'Preflight v17.8: falta marketing_app.members.' using errcode='42P01';
  end if;
  select string_agg(column_name, ', ' order by column_name)
    into v_missing
  from (values ('id'),('auth_user_id')) r(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='marketing_app' and c.table_name='members' and c.column_name=r.column_name
  );
  if v_missing is not null then
    raise exception 'Preflight v17.8: faltan columnas members.%', v_missing using errcode='42703';
  end if;
  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'Preflight v17.8: gen_random_uuid() no está disponible.' using errcode='42883';
  end if;
end
$preflight$;

create table if not exists marketing_app.ui_theme_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_active boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  module_settings jsonb not null default '{}'::jsonb,
  asset_slots jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  published_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint ui_theme_versions_name_length check (char_length(name) between 1 and 90),
  constraint ui_theme_versions_settings_object check (jsonb_typeof(settings)='object'),
  constraint ui_theme_versions_modules_object check (jsonb_typeof(module_settings)='object'),
  constraint ui_theme_versions_slots_object check (jsonb_typeof(asset_slots)='object')
);

create unique index if not exists ui_theme_versions_single_active_idx
  on marketing_app.ui_theme_versions ((is_active)) where is_active;
create index if not exists ui_theme_versions_updated_idx
  on marketing_app.ui_theme_versions (updated_at desc);

create table if not exists marketing_app.ui_asset_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_url text not null,
  mime_type text not null default 'image/webp',
  file_size bigint not null default 0 check (file_size between 0 and 25000000),
  width integer not null default 0 check (width between 0 and 10000),
  height integer not null default 0 check (height between 0 and 10000),
  alt_text text not null default '',
  tags text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ui_asset_library_name_length check (char_length(name) between 1 and 100),
  constraint ui_asset_library_metadata_object check (jsonb_typeof(metadata)='object')
);

create index if not exists ui_asset_library_active_idx
  on marketing_app.ui_asset_library (created_at desc) where archived_at is null;

alter table marketing_app.ui_theme_versions enable row level security;
alter table marketing_app.ui_asset_library enable row level security;

drop policy if exists v178_read_theme_versions on marketing_app.ui_theme_versions;
create policy v178_read_theme_versions on marketing_app.ui_theme_versions
  for select to authenticated
  using (auth.uid() is not null and (is_active = true or created_by = auth.uid()));

drop policy if exists v178_read_asset_library on marketing_app.ui_asset_library;
create policy v178_read_asset_library on marketing_app.ui_asset_library
  for select to authenticated using (auth.uid() is not null and archived_at is null);

grant usage on schema marketing_app to authenticated;
grant select on marketing_app.ui_theme_versions, marketing_app.ui_asset_library to authenticated;
revoke all on marketing_app.ui_theme_versions, marketing_app.ui_asset_library from anon;
revoke insert, update, delete, truncate, references, trigger
  on marketing_app.ui_theme_versions, marketing_app.ui_asset_library from authenticated;

create or replace function marketing_app.ibm_v178_actor_scope()
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
  if auth.uid() is null then return 'anon'; end if;
  select to_jsonb(m) into v_member
  from marketing_app.members m
  where m.auth_user_id=auth.uid()
  limit 1;
  if v_member is null then return 'collaborator'; end if;
  v_role_text := lower(concat_ws(' ',
    coalesce(v_member->>'full_name',''), coalesce(v_member->>'role_code',''),
    coalesce(v_member->>'position',''), coalesce(v_member->>'display_role',''),
    coalesce(v_member->>'email','')
  ));
  if v_role_text ~ '(director|dirección|direccion|gerente general|administrator|administrador|owner|propietario)'
     or v_role_text ~ '(^| )(italo|jhulio)( |$)' then return 'director'; end if;
  if v_role_text ~ '(supervisor|jefe|jefatura|coordinador|coordinadora|team lead|líder de equipo|lider de equipo|responsable de área|responsable de area|gerente)'
     or v_role_text ~ '(^| )alejandro( |$)' then return 'supervisor'; end if;
  return 'collaborator';
end
$function$;

create or replace function marketing_app.ibm_v178_design_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_scope text;
  v_active jsonb;
  v_versions jsonb := '[]'::jsonb;
  v_assets jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión autenticada.' using errcode='42501'; end if;
  v_scope := marketing_app.ibm_v178_actor_scope();
  select to_jsonb(t) into v_active
  from marketing_app.ui_theme_versions t
  where t.is_active=true
  order by t.published_at desc nulls last, t.updated_at desc
  limit 1;
  if v_scope='director' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb)
      into v_versions
    from (select * from marketing_app.ui_theme_versions order by updated_at desc limit 30) x;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
      into v_assets
    from (select * from marketing_app.ui_asset_library where archived_at is null order by created_at desc limit 100) x;
  end if;
  return jsonb_build_object(
    'version','17.8','scope',v_scope,'can_manage',v_scope='director',
    'active',v_active,'versions',v_versions,'assets',v_assets,
    'safe_variables_only',true,'arbitrary_css',false,'arbitrary_javascript',false
  );
end
$function$;

create or replace function marketing_app.ibm_v178_save_design_draft(
  p_name text,
  p_settings jsonb,
  p_module_settings jsonb,
  p_asset_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_row marketing_app.ui_theme_versions%rowtype;
begin
  if marketing_app.ibm_v178_actor_scope()<>'director' then
    raise exception 'Solo Dirección puede guardar temas globales.' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null or char_length(btrim(p_name))>90 then
    raise exception 'El nombre del tema debe tener entre 1 y 90 caracteres.' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(p_settings,'{}'::jsonb))<>'object'
     or jsonb_typeof(coalesce(p_module_settings,'{}'::jsonb))<>'object'
     or jsonb_typeof(coalesce(p_asset_slots,'{}'::jsonb))<>'object' then
    raise exception 'La configuración visual debe usar objetos JSON.' using errcode='22023';
  end if;
  if octet_length(coalesce(p_settings,'{}'::jsonb)::text)>100000
     or octet_length(coalesce(p_module_settings,'{}'::jsonb)::text)>100000
     or octet_length(coalesce(p_asset_slots,'{}'::jsonb)::text)>300000 then
    raise exception 'La configuración visual supera el tamaño permitido.' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(coalesce(p_settings,'{}'::jsonb)) as k(key)
    where key not in ('mode','primary','secondary','accent','background','surface','surface2','text','muted','radius','baseSize','headingScale','navWidth','fontBody','fontHeading','density','shadow','motion')
  ) then
    raise exception 'La configuración contiene variables visuales no autorizadas.' using errcode='22023';
  end if;
  if lower(coalesce(p_settings,'{}'::jsonb)::text || coalesce(p_module_settings,'{}'::jsonb)::text || coalesce(p_asset_slots,'{}'::jsonb)::text)
       ~ '(javascript:|data:text/html|<script|</script|expression\s*\()' then
    raise exception 'La configuración contiene contenido activo no permitido.' using errcode='22023';
  end if;
  insert into marketing_app.ui_theme_versions(name,status,is_active,settings,module_settings,asset_slots,created_by,created_at,updated_at)
  values (btrim(p_name),'draft',false,coalesce(p_settings,'{}'::jsonb),coalesce(p_module_settings,'{}'::jsonb),coalesce(p_asset_slots,'{}'::jsonb),auth.uid(),now(),now())
  returning * into v_row;
  return to_jsonb(v_row);
end
$function$;

create or replace function marketing_app.ibm_v178_publish_design(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_row marketing_app.ui_theme_versions%rowtype;
begin
  if marketing_app.ibm_v178_actor_scope()<>'director' then
    raise exception 'Solo Dirección puede publicar o restaurar temas.' using errcode='42501';
  end if;
  select * into v_row from marketing_app.ui_theme_versions where id=p_version_id for update;
  if not found then raise exception 'La versión indicada no existe.' using errcode='P0002'; end if;
  update marketing_app.ui_theme_versions
     set is_active=false,
         status=case when status='published' then 'archived' else status end,
         updated_at=now()
   where is_active=true and id<>p_version_id;
  update marketing_app.ui_theme_versions
     set is_active=true,status='published',published_by=auth.uid(),published_at=now(),updated_at=now()
   where id=p_version_id
   returning * into v_row;
  return to_jsonb(v_row);
end
$function$;

create or replace function marketing_app.ibm_v178_upsert_design_asset(
  p_asset_id uuid,
  p_name text,
  p_source_url text,
  p_mime_type text,
  p_file_size bigint,
  p_width integer,
  p_height integer,
  p_alt_text text,
  p_tags text[],
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_row marketing_app.ui_asset_library%rowtype;
  v_url text := btrim(coalesce(p_source_url,''));
begin
  if marketing_app.ibm_v178_actor_scope()<>'director' then
    raise exception 'Solo Dirección puede administrar la biblioteca global.' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_name,'')),'') is null or char_length(btrim(p_name))>100 then
    raise exception 'El nombre del recurso debe tener entre 1 y 100 caracteres.' using errcode='22023';
  end if;
  if not (v_url ~* '^https://' or v_url ~* '^data:image/(png|jpeg|jpg|webp|gif);base64,') then
    raise exception 'La URL debe usar HTTPS o ser una imagen inline permitida.' using errcode='22023';
  end if;
  if char_length(v_url)>1500000 then raise exception 'El recurso inline supera el límite permitido.' using errcode='22023'; end if;
  if p_asset_id is null then
    insert into marketing_app.ui_asset_library(name,source_url,mime_type,file_size,width,height,alt_text,tags,metadata,created_by)
    values (btrim(p_name),v_url,left(coalesce(p_mime_type,'image/webp'),80),greatest(0,least(coalesce(p_file_size,0),25000000)),greatest(0,least(coalesce(p_width,0),10000)),greatest(0,least(coalesce(p_height,0),10000)),left(coalesce(p_alt_text,''),180),(coalesce(p_tags,'{}'::text[]))[1:20],coalesce(p_metadata,'{}'::jsonb),auth.uid())
    returning * into v_row;
  else
    update marketing_app.ui_asset_library set
      name=btrim(p_name),source_url=v_url,mime_type=left(coalesce(p_mime_type,'image/webp'),80),
      file_size=greatest(0,least(coalesce(p_file_size,0),25000000)),width=greatest(0,least(coalesce(p_width,0),10000)),height=greatest(0,least(coalesce(p_height,0),10000)),
      alt_text=left(coalesce(p_alt_text,''),180),tags=(coalesce(p_tags,'{}'::text[]))[1:20],metadata=coalesce(p_metadata,'{}'::jsonb),updated_at=now(),archived_at=null
    where id=p_asset_id returning * into v_row;
    if not found then raise exception 'El recurso indicado no existe.' using errcode='P0002'; end if;
  end if;
  return to_jsonb(v_row);
end
$function$;

create or replace function marketing_app.ibm_v178_archive_design_asset(p_asset_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare v_count integer;
begin
  if marketing_app.ibm_v178_actor_scope()<>'director' then
    raise exception 'Solo Dirección puede archivar recursos globales.' using errcode='42501';
  end if;
  update marketing_app.ui_asset_library set archived_at=now(),updated_at=now() where id=p_asset_id and archived_at is null;
  get diagnostics v_count=row_count;
  return v_count>0;
end
$function$;

revoke all on function marketing_app.ibm_v178_actor_scope() from public, anon;
revoke all on function marketing_app.ibm_v178_design_bootstrap() from public, anon;
revoke all on function marketing_app.ibm_v178_save_design_draft(text,jsonb,jsonb,jsonb) from public, anon;
revoke all on function marketing_app.ibm_v178_publish_design(uuid) from public, anon;
revoke all on function marketing_app.ibm_v178_upsert_design_asset(uuid,text,text,text,bigint,integer,integer,text,text[],jsonb) from public, anon;
revoke all on function marketing_app.ibm_v178_archive_design_asset(uuid) from public, anon;
grant execute on function marketing_app.ibm_v178_actor_scope() to authenticated;
grant execute on function marketing_app.ibm_v178_design_bootstrap() to authenticated;
grant execute on function marketing_app.ibm_v178_save_design_draft(text,jsonb,jsonb,jsonb) to authenticated;
grant execute on function marketing_app.ibm_v178_publish_design(uuid) to authenticated;
grant execute on function marketing_app.ibm_v178_upsert_design_asset(uuid,text,text,text,bigint,integer,integer,text,text[],jsonb) to authenticated;
grant execute on function marketing_app.ibm_v178_archive_design_asset(uuid) to authenticated;

DO $realtime$
begin
  begin
    alter publication supabase_realtime add table marketing_app.ui_theme_versions;
  exception when duplicate_object then null;
  when undefined_object then null;
  end;
end
$realtime$;

notify pgrst, 'reload schema';

commit;

select * from (values
  ('table_theme_versions',coalesce(to_regclass('marketing_app.ui_theme_versions')::text,'NO CREADA')),
  ('table_asset_library',coalesce(to_regclass('marketing_app.ui_asset_library')::text,'NO CREADA')),
  ('rpc_bootstrap',coalesce(to_regprocedure('marketing_app.ibm_v178_design_bootstrap()')::text,'NO CREADA')),
  ('rpc_save_draft',coalesce(to_regprocedure('marketing_app.ibm_v178_save_design_draft(text,jsonb,jsonb,jsonb)')::text,'NO CREADA')),
  ('rpc_publish',coalesce(to_regprocedure('marketing_app.ibm_v178_publish_design(uuid)')::text,'NO CREADA')),
  ('rpc_upsert_asset',coalesce(to_regprocedure('marketing_app.ibm_v178_upsert_design_asset(uuid,text,text,text,bigint,integer,integer,text,text[],jsonb)')::text,'NO CREADA')),
  ('rpc_archive_asset',coalesce(to_regprocedure('marketing_app.ibm_v178_archive_design_asset(uuid)')::text,'NO CREADA'))
) as installation_check(object_name,status);
