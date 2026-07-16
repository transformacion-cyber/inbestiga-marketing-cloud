-- INBESTIGA Marketing Cloud v17.9
-- COLLABORATIVE WORKSPACE · FILES, MULTI-ASSIGNMENT, SUBMISSIONS & REVIEWS
-- Instalación OPCIONAL, manual, aditiva, atómica e idempotente.
-- Crea un bucket privado dedicado con límite de 25 MB por archivo.
-- No modifica las 45 RPC productivas, Auth, Creative Arena, tablas productivas ni RLS existentes.
-- La escritura de metadatos ocurre únicamente mediante RPC controladas.

begin;

DO $preflight$
declare
  v_missing text;
begin
  if to_regnamespace('marketing_app') is null then
    raise exception 'Preflight v17.9: el esquema marketing_app no existe.' using errcode='3F000';
  end if;

  with required(table_name) as (
    values ('members'), ('tasks'), ('campaigns'), ('briefs')
  )
  select string_agg(table_name, ', ' order by table_name)
    into v_missing
  from required
  where to_regclass(format('marketing_app.%I', table_name)) is null;

  if v_missing is not null then
    raise exception 'Preflight v17.9: faltan tablas requeridas: %.', v_missing using errcode='42P01';
  end if;

  with required(table_name, column_name) as (
    values
      ('members','id'), ('members','auth_user_id'), ('members','role_code'), ('members','status'),
      ('tasks','id'), ('tasks','assigned_to'), ('tasks','campaign_id'), ('tasks','status'), ('tasks','evidence_url'), ('tasks','updated_at'),
      ('campaigns','id'), ('briefs','id'), ('briefs','campaign_id')
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
    raise exception 'Preflight v17.9: faltan columnas requeridas: %.', v_missing using errcode='42703';
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'Preflight v17.9: gen_random_uuid() no está disponible.' using errcode='42883';
  end if;

  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'Preflight v17.9: Supabase Storage no está disponible.' using errcode='42P01';
  end if;
end
$preflight$;

create table if not exists marketing_app.task_participants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  member_id uuid not null references marketing_app.members(id) on delete cascade,
  assignment_role text not null default 'collaborator'
    check (assignment_role in ('primary','collaborator')),
  status text not null default 'active'
    check (status in ('active','removed')),
  assigned_by uuid references marketing_app.members(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_participants_task_member_unique unique(task_id, member_id)
);

create table if not exists marketing_app.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  submitted_by uuid not null references marketing_app.members(id) on delete restrict,
  submission_round integer not null default 1 check (submission_round between 1 and 999),
  comment text not null default '',
  status text not null default 'submitted'
    check (status in ('submitted','approved','observed','withdrawn')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references marketing_app.members(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_submissions_member_round_unique unique(task_id, submitted_by, submission_round)
);

create table if not exists marketing_app.work_item_attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('task','campaign','brief')),
  entity_id uuid not null,
  category text not null default 'reference' check (category in ('reference','submission')),
  submission_id uuid references marketing_app.task_submissions(id) on delete cascade,
  uploader_member_id uuid not null references marketing_app.members(id) on delete restrict,
  file_name text,
  mime_type text,
  file_size bigint not null default 0 check (file_size between 0 and 26214400),
  storage_path text,
  external_url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint work_item_attachments_resource_check check (
    nullif(btrim(coalesce(storage_path,'')), '') is not null
    or nullif(btrim(coalesce(external_url,'')), '') is not null
  ),
  constraint work_item_attachments_submission_check check (
    (category='submission' and submission_id is not null)
    or (category='reference' and submission_id is null)
  )
);

create table if not exists marketing_app.task_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  submission_id uuid references marketing_app.task_submissions(id) on delete set null,
  member_id uuid not null references marketing_app.members(id) on delete restrict,
  reviewer_id uuid not null references marketing_app.members(id) on delete restrict,
  decision text not null check (decision in ('validate','observe')),
  quality smallint check (quality between 1 and 5),
  timeliness smallint check (timeliness between 1 and 5),
  collaboration smallint check (collaboration between 1 and 5),
  communication smallint check (communication between 1 and 5),
  overall_score smallint check (overall_score between 0 and 100),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists task_participants_member_idx
  on marketing_app.task_participants(member_id, status, assigned_at desc);
create index if not exists task_participants_task_idx
  on marketing_app.task_participants(task_id, status);
create index if not exists task_submissions_task_idx
  on marketing_app.task_submissions(task_id, submitted_at desc);
create index if not exists task_submissions_member_idx
  on marketing_app.task_submissions(submitted_by, submitted_at desc);
create index if not exists work_item_attachments_entity_idx
  on marketing_app.work_item_attachments(entity_type, entity_id, category, created_at desc)
  where archived_at is null;
create index if not exists work_item_attachments_submission_idx
  on marketing_app.work_item_attachments(submission_id, created_at desc)
  where archived_at is null;
create index if not exists task_reviews_task_idx
  on marketing_app.task_reviews(task_id, created_at desc);
create index if not exists task_reviews_member_idx
  on marketing_app.task_reviews(member_id, created_at desc);

alter table marketing_app.task_participants enable row level security;
alter table marketing_app.task_submissions enable row level security;
alter table marketing_app.work_item_attachments enable row level security;
alter table marketing_app.task_reviews enable row level security;

grant usage on schema marketing_app to authenticated;
grant select on marketing_app.task_participants, marketing_app.task_submissions,
  marketing_app.work_item_attachments, marketing_app.task_reviews to authenticated;
revoke all on marketing_app.task_participants, marketing_app.task_submissions,
  marketing_app.work_item_attachments, marketing_app.task_reviews from anon;
revoke insert, update, delete, truncate, references, trigger
  on marketing_app.task_participants, marketing_app.task_submissions,
  marketing_app.work_item_attachments, marketing_app.task_reviews from authenticated;

create or replace function marketing_app.ibm_v179_actor_member_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
  select m.id
  from marketing_app.members m
  where m.auth_user_id=auth.uid()
    and coalesce(m.status,'active')='active'
  limit 1
$function$;

create or replace function marketing_app.ibm_v179_is_manager()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
  select exists (
    select 1
    from marketing_app.members m
    where m.auth_user_id=auth.uid()
      and coalesce(m.status,'active')='active'
      and lower(coalesce(m.role_code,'')) in ('italo','jhulio','alejandro','director','admin','administrator','supervisor')
  )
$function$;

create or replace function marketing_app.ibm_v179_can_access_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
  select auth.uid() is not null and (
    marketing_app.ibm_v179_is_manager()
    or exists (
      select 1
      from marketing_app.tasks t
      where t.id=p_task_id
        and t.assigned_to=marketing_app.ibm_v179_actor_member_id()
    )
    or exists (
      select 1
      from marketing_app.task_participants p
      where p.task_id=p_task_id
        and p.member_id=marketing_app.ibm_v179_actor_member_id()
        and p.status='active'
    )
  )
$function$;

create or replace function marketing_app.ibm_v179_can_access_campaign(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
  select auth.uid() is not null and (
    marketing_app.ibm_v179_is_manager()
    or exists (
      select 1
      from marketing_app.tasks t
      where t.campaign_id=p_campaign_id
        and marketing_app.ibm_v179_can_access_task(t.id)
    )
  )
$function$;

create or replace function marketing_app.ibm_v179_can_access_brief(p_brief_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
  select auth.uid() is not null and exists (
    select 1
    from marketing_app.briefs b
    where b.id=p_brief_id
      and (marketing_app.ibm_v179_is_manager() or marketing_app.ibm_v179_can_access_campaign(b.campaign_id))
  )
$function$;

create or replace function marketing_app.ibm_v179_can_read_storage_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth, storage
as $function$
declare
  v_type text := split_part(coalesce(p_name,''),'/',2);
  v_id_text text := split_part(coalesce(p_name,''),'/',3);
  v_id uuid;
begin
  if auth.uid() is null then return false; end if;
  if split_part(coalesce(p_name,''),'/',1)=auth.uid()::text then return true; end if;
  begin v_id := v_id_text::uuid; exception when others then return false; end;
  if v_type='task' then return marketing_app.ibm_v179_can_access_task(v_id); end if;
  if v_type='campaign' then return marketing_app.ibm_v179_can_access_campaign(v_id); end if;
  if v_type='brief' then return marketing_app.ibm_v179_can_access_brief(v_id); end if;
  return false;
end
$function$;

DO $policies$
begin
  drop policy if exists v179_read_task_participants on marketing_app.task_participants;
  create policy v179_read_task_participants on marketing_app.task_participants
    for select to authenticated
    using (marketing_app.ibm_v179_can_access_task(task_id));

  drop policy if exists v179_read_task_submissions on marketing_app.task_submissions;
  create policy v179_read_task_submissions on marketing_app.task_submissions
    for select to authenticated
    using (marketing_app.ibm_v179_can_access_task(task_id));

  drop policy if exists v179_read_work_item_attachments on marketing_app.work_item_attachments;
  create policy v179_read_work_item_attachments on marketing_app.work_item_attachments
    for select to authenticated
    using (
      archived_at is null and (
        (entity_type='task' and marketing_app.ibm_v179_can_access_task(entity_id))
        or (entity_type='campaign' and marketing_app.ibm_v179_can_access_campaign(entity_id))
        or (entity_type='brief' and marketing_app.ibm_v179_can_access_brief(entity_id))
      )
    );

  drop policy if exists v179_read_task_reviews on marketing_app.task_reviews;
  create policy v179_read_task_reviews on marketing_app.task_reviews
    for select to authenticated
    using (
      marketing_app.ibm_v179_is_manager()
      or member_id=marketing_app.ibm_v179_actor_member_id()
    );
end
$policies$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'inbestiga-work-files',
  'inbestiga-work-files',
  false,
  26214400,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm',
    'audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/aac','audio/ogg',
    'application/pdf','application/zip','text/plain','text/csv','text/uri-list',
    'application/postscript','image/vnd.adobe.photoshop','application/x-photoshop',
    'application/x-indesign','application/x-after-effects','application/x-premiere',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream'
  ]::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=26214400,
  allowed_mime_types=excluded.allowed_mime_types;

DO $storage_policies$
begin
  drop policy if exists v179_work_files_select on storage.objects;
  create policy v179_work_files_select on storage.objects
    for select to authenticated
    using (
      bucket_id='inbestiga-work-files'
      and marketing_app.ibm_v179_can_read_storage_object(name)
    );

  drop policy if exists v179_work_files_insert on storage.objects;
  create policy v179_work_files_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id='inbestiga-work-files'
      and split_part(name,'/',1)=auth.uid()::text
      and split_part(name,'/',2) in ('task','campaign','brief')
    );

  drop policy if exists v179_work_files_update on storage.objects;
  create policy v179_work_files_update on storage.objects
    for update to authenticated
    using (bucket_id='inbestiga-work-files' and split_part(name,'/',1)=auth.uid()::text)
    with check (bucket_id='inbestiga-work-files' and split_part(name,'/',1)=auth.uid()::text);

  drop policy if exists v179_work_files_delete on storage.objects;
  create policy v179_work_files_delete on storage.objects
    for delete to authenticated
    using (bucket_id='inbestiga-work-files' and split_part(name,'/',1)=auth.uid()::text);
end
$storage_policies$;

create or replace function marketing_app.ibm_v179_capabilities()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
  select jsonb_build_object(
    'version','17.9',
    'collaborative_workspace',true,
    'private_bucket','inbestiga-work-files',
    'max_files_per_block',3,
    'max_file_size_bytes',26214400,
    'max_links_per_block',5,
    'multi_assignee',true,
    'submissions',true,
    'member_scoring',true
  )
$function$;

create or replace function marketing_app.ibm_v179_set_task_participants(
  p_task_id uuid,
  p_member_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_actor uuid;
  v_primary uuid;
  v_ids uuid[];
  v_count integer;
begin
  if auth.uid() is null or not marketing_app.ibm_v179_is_manager() then
    raise exception 'Solo Dirección o Supervisión pueden asignar varios responsables.' using errcode='42501';
  end if;
  if not exists (select 1 from marketing_app.tasks where id=p_task_id) then
    raise exception 'La tarea indicada no existe.' using errcode='23503';
  end if;
  select array_agg(distinct x order by x) into v_ids from unnest(coalesce(p_member_ids,'{}'::uuid[])) x where x is not null;
  v_count := coalesce(array_length(v_ids,1),0);
  if v_count<1 or v_count>20 then
    raise exception 'Selecciona entre 1 y 20 responsables.' using errcode='22023';
  end if;
  if (select count(*) from marketing_app.members m where m.id=any(v_ids) and coalesce(m.status,'active')='active')<>v_count then
    raise exception 'Uno o más responsables no existen o están inactivos.' using errcode='23503';
  end if;
  select assigned_to into v_primary from marketing_app.tasks where id=p_task_id;
  if v_primary is null or not (v_primary=any(v_ids)) then
    raise exception 'La lista debe incluir al responsable principal de la tarea.' using errcode='22023';
  end if;
  v_actor := marketing_app.ibm_v179_actor_member_id();

  update marketing_app.task_participants
     set status='removed', updated_at=now()
   where task_id=p_task_id and not (member_id=any(v_ids));

  insert into marketing_app.task_participants(task_id,member_id,assignment_role,status,assigned_by,assigned_at,updated_at)
  select p_task_id, member_id,
         case when member_id=v_primary then 'primary' else 'collaborator' end,
         'active',v_actor,now(),now()
  from unnest(v_ids) member_id
  on conflict(task_id,member_id) do update set
    assignment_role=excluded.assignment_role,
    status='active',
    assigned_by=excluded.assigned_by,
    assigned_at=excluded.assigned_at,
    updated_at=now();

  return jsonb_build_object(
    'task_id',p_task_id,
    'participant_count',v_count,
    'participants',(
      select coalesce(jsonb_agg(to_jsonb(p) order by p.assignment_role desc,p.assigned_at),'[]'::jsonb)
      from marketing_app.task_participants p
      where p.task_id=p_task_id and p.status='active'
    )
  );
end
$function$;

create or replace function marketing_app.ibm_v179_create_attachment(
  p_entity_type text,
  p_entity_id uuid,
  p_category text,
  p_submission_id uuid,
  p_file_name text,
  p_mime_type text,
  p_file_size bigint,
  p_storage_path text,
  p_external_url text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_actor uuid;
  v_row marketing_app.work_item_attachments%rowtype;
  v_file_count integer;
  v_link_count integer;
  v_allowed boolean := false;
  v_submission marketing_app.task_submissions%rowtype;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión autenticada.' using errcode='42501'; end if;
  if p_entity_type not in ('task','campaign','brief') or p_category not in ('reference','submission') then
    raise exception 'Tipo de entidad o categoría no permitido.' using errcode='22023';
  end if;
  if coalesce(p_file_size,0)<0 or coalesce(p_file_size,0)>26214400 then
    raise exception 'Cada archivo puede pesar como máximo 25 MB.' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_storage_path,'')),'') is null and nullif(btrim(coalesce(p_external_url,'')),'') is null then
    raise exception 'Debes indicar un archivo o enlace.' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_storage_path,'')),'') is not null
     and split_part(p_storage_path,'/',1)<>auth.uid()::text then
    raise exception 'La ruta del archivo no pertenece a la sesión actual.' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_external_url,'')),'') is not null
     and lower(p_external_url) !~ '^https?://' then
    raise exception 'Los enlaces deben comenzar con http:// o https://.' using errcode='22023';
  end if;

  v_actor := marketing_app.ibm_v179_actor_member_id();
  if v_actor is null then raise exception 'La cuenta no está vinculada a un miembro activo.' using errcode='42501'; end if;

  if p_category='reference' then
    if p_submission_id is not null then raise exception 'Una referencia no puede pertenecer a una entrega.' using errcode='22023'; end if;
    if p_entity_type='task' then v_allowed := marketing_app.ibm_v179_is_manager();
    elsif p_entity_type='campaign' then v_allowed := marketing_app.ibm_v179_is_manager();
    elsif p_entity_type='brief' then v_allowed := marketing_app.ibm_v179_is_manager();
    end if;
  else
    if p_entity_type<>'task' or p_submission_id is null then
      raise exception 'Los archivos de entrega deben pertenecer a una tarea y una entrega.' using errcode='22023';
    end if;
    select * into v_submission from marketing_app.task_submissions where id=p_submission_id and task_id=p_entity_id;
    if not found then raise exception 'La entrega indicada no existe o no pertenece a la tarea.' using errcode='23503'; end if;
    v_allowed := marketing_app.ibm_v179_is_manager() or v_submission.submitted_by=v_actor;
  end if;

  if not v_allowed then raise exception 'No tienes permiso para registrar este recurso.' using errcode='42501'; end if;

  select count(*) filter(where nullif(storage_path,'') is not null),
         count(*) filter(where nullif(external_url,'') is not null)
    into v_file_count,v_link_count
  from marketing_app.work_item_attachments a
  where a.entity_type=p_entity_type and a.entity_id=p_entity_id and a.category=p_category
    and a.archived_at is null
    and coalesce(a.submission_id,'00000000-0000-0000-0000-000000000000'::uuid)
        =coalesce(p_submission_id,'00000000-0000-0000-0000-000000000000'::uuid);

  if nullif(btrim(coalesce(p_storage_path,'')),'') is not null and v_file_count>=3 then
    raise exception 'Este bloque ya tiene 3 archivos.' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_external_url,'')),'') is not null and v_link_count>=5 then
    raise exception 'Este bloque ya tiene 5 enlaces.' using errcode='22023';
  end if;

  insert into marketing_app.work_item_attachments(
    entity_type,entity_id,category,submission_id,uploader_member_id,
    file_name,mime_type,file_size,storage_path,external_url,notes,created_at,updated_at
  ) values (
    p_entity_type,p_entity_id,p_category,p_submission_id,v_actor,
    left(nullif(btrim(coalesce(p_file_name,'')),''),240),
    left(nullif(btrim(coalesce(p_mime_type,'')),''),160),
    coalesce(p_file_size,0),nullif(btrim(coalesce(p_storage_path,'')),''),
    nullif(btrim(coalesce(p_external_url,'')),''),left(coalesce(p_notes,''),2000),now(),now()
  ) returning * into v_row;

  return to_jsonb(v_row);
end
$function$;

create or replace function marketing_app.ibm_v179_create_submission(
  p_task_id uuid,
  p_comment text,
  p_links jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_actor uuid;
  v_round integer;
  v_row marketing_app.task_submissions%rowtype;
  v_link jsonb;
  v_url text;
  v_link_count integer := 0;
begin
  if auth.uid() is null or not marketing_app.ibm_v179_can_access_task(p_task_id) then
    raise exception 'La tarea está fuera de tu alcance.' using errcode='42501';
  end if;
  v_actor := marketing_app.ibm_v179_actor_member_id();
  if v_actor is null then raise exception 'La cuenta no está vinculada a un miembro activo.' using errcode='42501'; end if;

  select coalesce(max(submission_round),0)+1 into v_round
  from marketing_app.task_submissions
  where task_id=p_task_id and submitted_by=v_actor;

  insert into marketing_app.task_submissions(task_id,submitted_by,submission_round,comment,status,submitted_at,created_at,updated_at)
  values(p_task_id,v_actor,v_round,left(coalesce(p_comment,''),4000),'submitted',now(),now(),now())
  returning * into v_row;

  if p_links is not null and jsonb_typeof(p_links)<>'array' then
    raise exception 'Los enlaces deben enviarse como un arreglo JSON.' using errcode='22023';
  end if;

  for v_link in select value from jsonb_array_elements(coalesce(p_links,'[]'::jsonb))
  loop
    v_url := coalesce(v_link->>'url', trim(both '"' from v_link::text));
    if nullif(btrim(v_url),'') is null then continue; end if;
    v_link_count := v_link_count+1;
    if v_link_count>5 then raise exception 'Puedes agregar hasta 5 enlaces por entrega.' using errcode='22023'; end if;
    perform marketing_app.ibm_v179_create_attachment(
      'task',p_task_id,'submission',v_row.id,
      left(regexp_replace(v_url,'^https?://([^/]+).*$','\1'),240),
      'text/uri-list',0,null,v_url,left(coalesce(p_comment,''),2000)
    );
  end loop;

  update marketing_app.tasks set status='en_revision',updated_at=now() where id=p_task_id;
  return jsonb_build_object('id',v_row.id,'submission_id',v_row.id,'submission_round',v_round,'submitted_at',v_row.submitted_at);
end
$function$;

create or replace function marketing_app.ibm_v179_update_task_status(
  p_task_id uuid,
  p_status text,
  p_evidence_url text,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_row jsonb;
begin
  if auth.uid() is null or not marketing_app.ibm_v179_can_access_task(p_task_id) then
    raise exception 'La tarea está fuera de tu alcance.' using errcode='42501';
  end if;
  if coalesce(p_status,'') not in ('pendiente','en_proceso','corregido','en_revision','observado','aprobado','publicado') then
    raise exception 'Estado de tarea no permitido.' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_evidence_url,'')),'') is not null and lower(p_evidence_url) !~ '^https?://' then
    raise exception 'La evidencia debe ser un enlace http o https.' using errcode='22023';
  end if;
  update marketing_app.tasks t
     set status=p_status,
         evidence_url=coalesce(nullif(btrim(coalesce(p_evidence_url,'')),''),evidence_url),
         updated_at=now()
   where t.id=p_task_id
   returning to_jsonb(t) into v_row;
  return jsonb_build_object('task',v_row,'comment',left(coalesce(p_comment,''),2000));
end
$function$;

create or replace function marketing_app.ibm_v179_review_submission(
  p_task_id uuid,
  p_submission_id uuid,
  p_decision text,
  p_comment text,
  p_scores jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_actor uuid;
  v_submission marketing_app.task_submissions%rowtype;
  v_score jsonb;
  v_member uuid;
  v_quality smallint;
  v_timeliness smallint;
  v_collaboration smallint;
  v_communication smallint;
  v_values integer[];
  v_overall smallint;
  v_saved integer := 0;
begin
  if auth.uid() is null or not marketing_app.ibm_v179_is_manager() then
    raise exception 'Solo Dirección o Supervisión pueden revisar y puntuar entregas.' using errcode='42501';
  end if;
  if p_decision not in ('validate','observe') then raise exception 'Decisión no permitida.' using errcode='22023'; end if;
  select * into v_submission from marketing_app.task_submissions where id=p_submission_id and task_id=p_task_id for update;
  if not found then raise exception 'La entrega indicada no existe.' using errcode='23503'; end if;
  v_actor := marketing_app.ibm_v179_actor_member_id();

  update marketing_app.task_submissions
     set status=case when p_decision='validate' then 'approved' else 'observed' end,
         reviewed_by=v_actor,reviewed_at=now(),review_comment=left(coalesce(p_comment,''),4000),updated_at=now()
   where id=p_submission_id;

  if p_scores is not null and jsonb_typeof(p_scores)<>'array' then
    raise exception 'Los puntajes deben enviarse como un arreglo JSON.' using errcode='22023';
  end if;

  for v_score in select value from jsonb_array_elements(coalesce(p_scores,'[]'::jsonb))
  loop
    begin v_member := (v_score->>'member_id')::uuid; exception when others then raise exception 'Un miembro puntuado no tiene UUID válido.' using errcode='22023'; end;
    if not exists (
      select 1 from marketing_app.tasks t where t.id=p_task_id and t.assigned_to=v_member
      union all
      select 1 from marketing_app.task_participants p where p.task_id=p_task_id and p.member_id=v_member and p.status='active'
    ) then
      raise exception 'Solo puedes puntuar miembros asignados a la tarea.' using errcode='42501';
    end if;
    v_quality := nullif(v_score->>'quality','')::smallint;
    v_timeliness := nullif(v_score->>'timeliness','')::smallint;
    v_collaboration := nullif(v_score->>'collaboration','')::smallint;
    v_communication := nullif(v_score->>'communication','')::smallint;
    v_values := array_remove(array[v_quality::integer,v_timeliness::integer,v_collaboration::integer,v_communication::integer],null);
    if coalesce(array_length(v_values,1),0)=0 then continue; end if;
    if exists(select 1 from unnest(v_values) x where x<1 or x>5) then raise exception 'Cada criterio debe estar entre 1 y 5.' using errcode='22023'; end if;
    select round(avg(x)*20)::smallint into v_overall from unnest(v_values) x;
    insert into marketing_app.task_reviews(
      task_id,submission_id,member_id,reviewer_id,decision,
      quality,timeliness,collaboration,communication,overall_score,comment,created_at
    ) values (
      p_task_id,p_submission_id,v_member,v_actor,p_decision,
      v_quality,v_timeliness,v_collaboration,v_communication,v_overall,left(coalesce(p_comment,''),2000),now()
    );
    v_saved := v_saved+1;
  end loop;

  update marketing_app.tasks
     set status=case when p_decision='validate' then 'aprobado' else 'observado' end,
         updated_at=now()
   where id=p_task_id;

  return jsonb_build_object(
    'task_id',p_task_id,'submission_id',p_submission_id,'decision',p_decision,
    'scores_saved',v_saved,'reviewed_at',now()
  );
end
$function$;

create or replace function marketing_app.ibm_v179_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, marketing_app, public, auth
as $function$
declare
  v_actor uuid;
  v_manager boolean;
  v_actor_json jsonb;
  v_participants jsonb;
  v_attachments jsonb;
  v_submissions jsonb;
  v_reviews jsonb;
  v_shared_tasks jsonb;
begin
  if auth.uid() is null then raise exception 'Se requiere una sesión autenticada.' using errcode='42501'; end if;
  v_actor := marketing_app.ibm_v179_actor_member_id();
  if v_actor is null then raise exception 'No existe un miembro activo vinculado a esta cuenta.' using errcode='42501'; end if;
  v_manager := marketing_app.ibm_v179_is_manager();
  select to_jsonb(m) into v_actor_json from marketing_app.members m where m.id=v_actor;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.assigned_at),'[]'::jsonb)
    into v_participants
  from marketing_app.task_participants p
  where p.status='active' and (v_manager or marketing_app.ibm_v179_can_access_task(p.task_id));

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]'::jsonb)
    into v_attachments
  from marketing_app.work_item_attachments a
  where a.archived_at is null and (
    v_manager
    or (a.entity_type='task' and marketing_app.ibm_v179_can_access_task(a.entity_id))
    or (a.entity_type='campaign' and marketing_app.ibm_v179_can_access_campaign(a.entity_id))
    or (a.entity_type='brief' and marketing_app.ibm_v179_can_access_brief(a.entity_id))
  );

  select coalesce(jsonb_agg(to_jsonb(s) order by s.submitted_at),'[]'::jsonb)
    into v_submissions
  from marketing_app.task_submissions s
  where v_manager or marketing_app.ibm_v179_can_access_task(s.task_id);

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb)
    into v_reviews
  from marketing_app.task_reviews r
  where v_manager or r.member_id=v_actor;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at),'[]'::jsonb)
    into v_shared_tasks
  from marketing_app.tasks t
  where not v_manager
    and t.assigned_to<>v_actor
    and exists (
      select 1 from marketing_app.task_participants p
      where p.task_id=t.id and p.member_id=v_actor and p.status='active'
    );

  return jsonb_build_object(
    'version','17.9','actor',v_actor_json,'is_manager',v_manager,
    'task_participants',v_participants,
    'attachments',v_attachments,
    'submissions',v_submissions,
    'reviews',v_reviews,
    'shared_tasks',v_shared_tasks
  );
end
$function$;

revoke all on function marketing_app.ibm_v179_actor_member_id() from public, anon;
revoke all on function marketing_app.ibm_v179_is_manager() from public, anon;
revoke all on function marketing_app.ibm_v179_can_access_task(uuid) from public, anon;
revoke all on function marketing_app.ibm_v179_can_access_campaign(uuid) from public, anon;
revoke all on function marketing_app.ibm_v179_can_access_brief(uuid) from public, anon;
revoke all on function marketing_app.ibm_v179_can_read_storage_object(text) from public, anon;
revoke all on function marketing_app.ibm_v179_capabilities() from public, anon;
revoke all on function marketing_app.ibm_v179_set_task_participants(uuid,uuid[]) from public, anon;
revoke all on function marketing_app.ibm_v179_create_attachment(text,uuid,text,uuid,text,text,bigint,text,text,text) from public, anon;
revoke all on function marketing_app.ibm_v179_create_submission(uuid,text,jsonb) from public, anon;
revoke all on function marketing_app.ibm_v179_update_task_status(uuid,text,text,text) from public, anon;
revoke all on function marketing_app.ibm_v179_review_submission(uuid,uuid,text,text,jsonb) from public, anon;
revoke all on function marketing_app.ibm_v179_workspace() from public, anon;

grant execute on function marketing_app.ibm_v179_actor_member_id() to authenticated;
grant execute on function marketing_app.ibm_v179_is_manager() to authenticated;
grant execute on function marketing_app.ibm_v179_can_access_task(uuid) to authenticated;
grant execute on function marketing_app.ibm_v179_can_access_campaign(uuid) to authenticated;
grant execute on function marketing_app.ibm_v179_can_access_brief(uuid) to authenticated;
grant execute on function marketing_app.ibm_v179_can_read_storage_object(text) to authenticated;
grant execute on function marketing_app.ibm_v179_capabilities() to authenticated;
grant execute on function marketing_app.ibm_v179_set_task_participants(uuid,uuid[]) to authenticated;
grant execute on function marketing_app.ibm_v179_create_attachment(text,uuid,text,uuid,text,text,bigint,text,text,text) to authenticated;
grant execute on function marketing_app.ibm_v179_create_submission(uuid,text,jsonb) to authenticated;
grant execute on function marketing_app.ibm_v179_update_task_status(uuid,text,text,text) to authenticated;
grant execute on function marketing_app.ibm_v179_review_submission(uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function marketing_app.ibm_v179_workspace() to authenticated;

DO $realtime$
declare
  v_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach v_table in array array['task_participants','task_submissions','work_item_attachments','task_reviews']
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='marketing_app' and tablename=v_table
      ) then
        execute format('alter publication supabase_realtime add table marketing_app.%I',v_table);
      end if;
    end loop;
  end if;
end
$realtime$;

notify pgrst, 'reload schema';

commit;

select jsonb_pretty(jsonb_build_object(
  'version','17.9',
  'bucket',(select id from storage.buckets where id='inbestiga-work-files'),
  'task_participants',to_regclass('marketing_app.task_participants'),
  'task_submissions',to_regclass('marketing_app.task_submissions'),
  'work_item_attachments',to_regclass('marketing_app.work_item_attachments'),
  'task_reviews',to_regclass('marketing_app.task_reviews'),
  'capabilities_rpc',to_regprocedure('marketing_app.ibm_v179_capabilities()'),
  'workspace_rpc',to_regprocedure('marketing_app.ibm_v179_workspace()'),
  'set_participants_rpc',to_regprocedure('marketing_app.ibm_v179_set_task_participants(uuid,uuid[])'),
  'create_attachment_rpc',to_regprocedure('marketing_app.ibm_v179_create_attachment(text,uuid,text,uuid,text,text,bigint,text,text,text)'),
  'create_submission_rpc',to_regprocedure('marketing_app.ibm_v179_create_submission(uuid,text,jsonb)'),
  'update_status_rpc',to_regprocedure('marketing_app.ibm_v179_update_task_status(uuid,text,text,text)'),
  'review_submission_rpc',to_regprocedure('marketing_app.ibm_v179_review_submission(uuid,uuid,text,text,jsonb)')
)) as instalacion_v17_9;
