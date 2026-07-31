-- INBESTIGA Marketing Cloud v17.16.0
-- SOLICITUDES 360 · instalación requerida una sola vez
-- Ejecutar completo en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.interarea_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  requester_name text not null,
  requester_area text not null,
  request_type text not null,
  title text not null,
  description text not null,
  needed_by date,
  urgency text not null default 'normal' check (urgency in ('normal','alta','urgente')),
  contact text,
  links jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','new','reviewing','needs_info','accepted','in_production','in_review','delivered','completed','rejected')),
  upload_token_hash text not null,
  tracking_token_hash text not null,
  device_token_hash text not null,
  audio_consent boolean not null default false,
  assigned_to uuid,
  internal_priority text check (internal_priority is null or internal_priority in ('baja','media','alta','urgente')),
  internal_notes text,
  converted_task_id uuid,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.interarea_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.interarea_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_type text,
  file_size bigint not null default 0,
  kind text not null default 'document',
  created_at timestamptz not null default now()
);

create table if not exists public.interarea_request_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.interarea_requests(id) on delete cascade,
  status text,
  message text,
  visibility text not null default 'internal' check (visibility in ('internal','public')),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists interarea_requests_status_idx on public.interarea_requests(status, submitted_at desc);
create index if not exists interarea_requests_area_idx on public.interarea_requests(requester_area, submitted_at desc);
create index if not exists interarea_requests_device_idx on public.interarea_requests(device_token_hash, created_at desc);
create index if not exists interarea_request_attachments_request_idx on public.interarea_request_attachments(request_id);
create index if not exists interarea_request_updates_request_idx on public.interarea_request_updates(request_id, created_at desc);

create or replace function public.ibm_requests360_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists interarea_requests_touch_updated_at on public.interarea_requests;
create trigger interarea_requests_touch_updated_at
before update on public.interarea_requests
for each row execute function public.ibm_requests360_touch_updated_at();

create or replace function public.ibm_is_marketing_member()
returns boolean
language sql
stable
security definer
set search_path = public, marketing_app, auth, pg_temp
as $$
  select exists (
    select 1
    from marketing_app.members m
    where m.auth_user_id = auth.uid()
      and coalesce(m.status,'active') <> 'inactive'
  );
$$;

create or replace function public.ibm_public_request_begin(
  p_requester_name text,
  p_requester_area text,
  p_request_type text,
  p_title text,
  p_description text,
  p_needed_by date default null,
  p_urgency text default 'normal',
  p_contact text default null,
  p_links jsonb default '[]'::jsonb,
  p_audio_consent boolean default false,
  p_device_token text default null,
  p_started_at timestamptz default null,
  p_honeypot text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
  v_upload_token text := encode(gen_random_bytes(32),'hex');
  v_tracking_token text := encode(gen_random_bytes(32),'hex');
  v_reference text;
  v_device_hash text;
  v_recent integer;
begin
  if nullif(trim(coalesce(p_honeypot,'')),'') is not null then
    raise exception 'No se pudo validar el envío.';
  end if;
  if p_started_at is null or now() - p_started_at < interval '2 seconds' or now() - p_started_at > interval '24 hours' then
    raise exception 'Recarga el formulario antes de enviarlo.';
  end if;
  if length(trim(coalesce(p_requester_name,''))) < 5 then raise exception 'Escribe tu nombre completo.'; end if;
  if length(trim(coalesce(p_requester_area,''))) < 2 then raise exception 'Selecciona tu área.'; end if;
  if length(trim(coalesce(p_request_type,''))) < 2 then raise exception 'Selecciona el tipo de requerimiento.'; end if;
  if length(trim(coalesce(p_title,''))) < 5 then raise exception 'Escribe un título más claro.'; end if;
  if length(trim(coalesce(p_description,''))) < 20 then raise exception 'Explica el requerimiento con un poco más de detalle.'; end if;
  if length(coalesce(p_device_token,'')) < 20 then raise exception 'No se pudo identificar este dispositivo para proteger el formulario.'; end if;
  if coalesce(p_urgency,'normal') not in ('normal','alta','urgente') then raise exception 'Urgencia no válida.'; end if;
  v_device_hash := encode(digest(p_device_token,'sha256'),'hex');
  select count(*) into v_recent from public.interarea_requests where device_token_hash=v_device_hash and created_at > now()-interval '10 minutes';
  if v_recent >= 5 then raise exception 'Se enviaron varias solicitudes en pocos minutos. Espera un momento antes de continuar.'; end if;
  select count(*) into v_recent from public.interarea_requests where device_token_hash=v_device_hash and created_at > now()-interval '24 hours';
  if v_recent >= 30 then raise exception 'Este dispositivo alcanzó el límite diario de solicitudes.'; end if;
  v_reference := 'REQ-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(v_id::text,'-',''),1,6));
  insert into public.interarea_requests(id,reference,requester_name,requester_area,request_type,title,description,needed_by,urgency,contact,links,status,upload_token_hash,tracking_token_hash,device_token_hash,audio_consent)
  values(v_id,v_reference,trim(p_requester_name),trim(p_requester_area),trim(p_request_type),trim(p_title),trim(p_description),p_needed_by,coalesce(p_urgency,'normal'),nullif(trim(coalesce(p_contact,'')),''),case when jsonb_typeof(coalesce(p_links,'[]'::jsonb))='array' then p_links else '[]'::jsonb end,'draft',encode(digest(v_upload_token,'sha256'),'hex'),encode(digest(v_tracking_token,'sha256'),'hex'),v_device_hash,coalesce(p_audio_consent,false));
  return jsonb_build_object('request_id',v_id,'reference',v_reference,'upload_token',v_upload_token,'tracking_token',v_tracking_token);
end;
$$;

create or replace function public.ibm_public_request_can_upload(p_request_id uuid,p_upload_token text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists(
    select 1 from public.interarea_requests r
    where r.id=p_request_id
      and r.status='draft'
      and r.created_at > now()-interval '2 hours'
      and r.upload_token_hash=encode(digest(coalesce(p_upload_token,''),'sha256'),'hex')
  );
$$;

create or replace function public.ibm_storage_request_can_upload(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_parts text[];
  v_request_id uuid;
begin
  v_parts := storage.foldername(p_name);
  if array_length(v_parts,1) < 3 or v_parts[1] <> 'public' then return false; end if;
  v_request_id := v_parts[2]::uuid;
  return public.ibm_public_request_can_upload(v_request_id,v_parts[3]);
exception when others then
  return false;
end;
$$;

create or replace function public.ibm_public_request_finalize(p_request_id uuid,p_upload_token text,p_attachments jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_item jsonb;
  v_path text;
  v_reference text;
begin
  if not public.ibm_public_request_can_upload(p_request_id,p_upload_token) then raise exception 'La sesión de carga venció o no es válida.'; end if;
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' then raise exception 'Lista de archivos no válida.'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) loop
    v_path := v_item->>'path';
    if v_path is null or v_path not like ('public/'||p_request_id::text||'/'||p_upload_token||'/%') then raise exception 'Ruta de archivo no válida.'; end if;
    insert into public.interarea_request_attachments(request_id,storage_path,file_name,file_type,file_size,kind)
    values(p_request_id,v_path,left(coalesce(v_item->>'file_name','archivo'),255),left(coalesce(v_item->>'file_type','application/octet-stream'),160),greatest(0,coalesce((v_item->>'file_size')::bigint,0)),left(coalesce(v_item->>'kind','document'),40))
    on conflict(storage_path) do nothing;
  end loop;
  update public.interarea_requests set status='new',submitted_at=now(),updated_at=now() where id=p_request_id returning reference into v_reference;
  insert into public.interarea_request_updates(request_id,status,message,visibility) values(p_request_id,'new','Solicitud recibida por el equipo de Marketing.','public');
  return jsonb_build_object('request_id',p_request_id,'reference',v_reference,'status','new');
end;
$$;

create or replace function public.ibm_public_request_status(p_tracking_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'reference',r.reference,
    'title',r.title,
    'requester_area',r.requester_area,
    'status',r.status,
    'created_at',r.created_at,
    'submitted_at',r.submitted_at,
    'updated_at',r.updated_at,
    'updates',coalesce((select jsonb_agg(jsonb_build_object('status',u.status,'message',u.message,'created_at',u.created_at) order by u.created_at desc) from public.interarea_request_updates u where u.request_id=r.id and u.visibility='public'),'[]'::jsonb)
  )
  from public.interarea_requests r
  where r.tracking_token_hash=encode(digest(coalesce(p_tracking_token,''),'sha256'),'hex')
    and r.status<>'draft'
  limit 1;
$$;

alter table public.interarea_requests enable row level security;
alter table public.interarea_request_attachments enable row level security;
alter table public.interarea_request_updates enable row level security;

drop policy if exists interarea_requests_internal_select on public.interarea_requests;
create policy interarea_requests_internal_select on public.interarea_requests for select to authenticated using(public.ibm_is_marketing_member());
drop policy if exists interarea_requests_internal_update on public.interarea_requests;
create policy interarea_requests_internal_update on public.interarea_requests for update to authenticated using(public.ibm_is_marketing_member()) with check(public.ibm_is_marketing_member());
drop policy if exists interarea_attachments_internal_select on public.interarea_request_attachments;
create policy interarea_attachments_internal_select on public.interarea_request_attachments for select to authenticated using(public.ibm_is_marketing_member());
drop policy if exists interarea_updates_internal_select on public.interarea_request_updates;
create policy interarea_updates_internal_select on public.interarea_request_updates for select to authenticated using(public.ibm_is_marketing_member());
drop policy if exists interarea_updates_internal_insert on public.interarea_request_updates;
create policy interarea_updates_internal_insert on public.interarea_request_updates for insert to authenticated with check(public.ibm_is_marketing_member());

revoke all on public.interarea_requests from anon,authenticated;
revoke all on public.interarea_request_attachments from anon,authenticated;
revoke all on public.interarea_request_updates from anon,authenticated;
grant select,update on public.interarea_requests to authenticated;
grant select on public.interarea_request_attachments to authenticated;
grant select,insert on public.interarea_request_updates to authenticated;
grant execute on function public.ibm_is_marketing_member() to authenticated;
grant execute on function public.ibm_public_request_begin(text,text,text,text,text,date,text,text,jsonb,boolean,text,timestamptz,text) to anon,authenticated;
grant execute on function public.ibm_public_request_can_upload(uuid,text) to anon,authenticated;
grant execute on function public.ibm_storage_request_can_upload(text) to anon,authenticated;
grant execute on function public.ibm_public_request_finalize(uuid,text,jsonb) to anon,authenticated;
grant execute on function public.ibm_public_request_status(text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit)
values('inbestiga-requests','inbestiga-requests',false,52428800)
on conflict(id) do update set public=false,file_size_limit=52428800;

drop policy if exists inbestiga_requests_public_upload on storage.objects;
create policy inbestiga_requests_public_upload on storage.objects for insert to anon with check(bucket_id='inbestiga-requests' and public.ibm_storage_request_can_upload(name));
drop policy if exists inbestiga_requests_internal_read on storage.objects;
create policy inbestiga_requests_internal_read on storage.objects for select to authenticated using(bucket_id='inbestiga-requests' and public.ibm_is_marketing_member());

-- Realtime para la bandeja interna.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='interarea_requests') then
    alter publication supabase_realtime add table public.interarea_requests;
  end if;
exception when others then
  raise notice 'Realtime no se añadió automáticamente: %',sqlerrm;
end $$;
