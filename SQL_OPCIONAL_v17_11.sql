-- INBESTIGA Marketing Cloud v17.11
-- TASK OPERATIONS, CATALOGS & PERFORMANCE RANKING
-- Instalación OPCIONAL, manual, aditiva, atómica e idempotente.
-- Requiere v17.9 (tareas colaborativas) y conserva las 45 RPC productivas.
-- No modifica Auth, Creative Arena ni elimina datos productivos.

begin;

DO $preflight$
declare
  v_missing text;
begin
  if to_regnamespace('marketing_app') is null then
    raise exception 'Preflight v17.11: el esquema marketing_app no existe.' using errcode='3F000';
  end if;

  with required(table_name) as (
    values ('members'),('tasks'),('clients'),('campaigns'),('task_participants'),('task_submissions'),('work_item_attachments')
  )
  select string_agg(table_name, ', ' order by table_name)
    into v_missing
  from required
  where to_regclass(format('marketing_app.%I',table_name)) is null;

  if v_missing is not null then
    raise exception 'Preflight v17.11: faltan tablas requeridas: %. Instala primero SQL_OPCIONAL_v17_9.sql.',v_missing using errcode='42P01';
  end if;

  with required(table_name,column_name) as (
    values
      ('members','id'),('members','auth_user_id'),('members','role_code'),('members','status'),('members','full_name'),
      ('tasks','id'),('tasks','title'),('tasks','assigned_to'),('tasks','client_id'),('tasks','campaign_id'),('tasks','area_id'),
      ('tasks','due_date'),('tasks','due_time'),('tasks','priority'),('tasks','impact'),('tasks','status'),('tasks','description'),
      ('clients','id'),('clients','name'),
      ('campaigns','id'),('campaigns','name'),('campaigns','client_id'),('campaigns','status'),('campaigns','start_date'),
      ('campaigns','end_date'),('campaigns','objective'),('campaigns','updated_at'),
      ('task_participants','task_id'),('task_participants','member_id'),('task_participants','status'),
      ('task_submissions','task_id'),('task_submissions','submitted_by'),('task_submissions','submitted_at'),('task_submissions','status'),
      ('work_item_attachments','entity_type'),('work_item_attachments','entity_id'),('work_item_attachments','category'),
      ('work_item_attachments','uploader_member_id'),('work_item_attachments','archived_at')
  )
  select string_agg(format('%I.%I',table_name,column_name),', ' order by table_name,column_name)
    into v_missing
  from required r
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='marketing_app' and c.table_name=r.table_name and c.column_name=r.column_name
  );

  if v_missing is not null then
    raise exception 'Preflight v17.11: faltan columnas requeridas: %.',v_missing using errcode='42703';
  end if;

  -- El editor puede crear clientes solo cuando no existen otras columnas obligatorias sin valor predeterminado.
  select string_agg(c.column_name, ', ' order by c.ordinal_position)
    into v_missing
  from information_schema.columns c
  where c.table_schema='marketing_app'
    and c.table_name='clients'
    and c.is_nullable='NO'
    and c.column_default is null
    and coalesce(c.is_identity,'NO')='NO'
    and c.column_name not in ('name');

  if v_missing is not null then
    raise exception 'Preflight v17.11: clients tiene columnas obligatorias no compatibles con el editor simple: %.',v_missing using errcode='23502';
  end if;
end
$preflight$;

create table if not exists marketing_app.task_operations_v1711 (
  task_id uuid primary key references marketing_app.tasks(id) on delete cascade,
  responsible_member_id uuid references marketing_app.members(id) on delete set null,
  estimated_minutes integer check (estimated_minutes between 0 and 600000),
  complexity text not null default 'media' check (complexity in ('simple','media','alta','critica')),
  recurrence_frequency text not null default 'none'
    check (recurrence_frequency in ('none','daily','weekdays','weekly','biweekly','monthly','yearly','custom')),
  recurrence_interval integer not null default 1 check (recurrence_interval between 1 and 365),
  recurrence_days smallint[] not null default '{}'::smallint[],
  recurrence_end_date date,
  recurrence_active boolean not null default false,
  next_due_date date,
  next_due_time time,
  generated_from_task_id uuid references marketing_app.tasks(id) on delete set null,
  last_generated_task_id uuid references marketing_app.tasks(id) on delete set null,
  created_by uuid references marketing_app.members(id) on delete set null,
  updated_by uuid references marketing_app.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketing_app.task_effort_v1711 (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  member_id uuid not null references marketing_app.members(id) on delete cascade,
  acceptance_status text not null default 'pending'
    check (acceptance_status in ('pending','accepted','clarification','blocked','proposed')),
  executor_estimate_minutes integer check (executor_estimate_minutes between 0 and 600000),
  actual_minutes integer check (actual_minutes between 0 and 600000),
  accepted_at timestamptz,
  acceptance_comment text not null default '',
  actual_comment text not null default '',
  actual_recorded_at timestamptz,
  validated_minutes integer check (validated_minutes between 0 and 600000),
  validated_by uuid references marketing_app.members(id) on delete set null,
  validation_note text not null default '',
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_effort_v1711_task_member_unique unique(task_id,member_id)
);

create table if not exists marketing_app.task_dependencies_v1711 (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start'
    check (dependency_type in ('finish_to_start','finish_to_finish','related')),
  created_by uuid references marketing_app.members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint task_dependencies_v1711_not_self check (task_id<>depends_on_task_id),
  constraint task_dependencies_v1711_unique unique(task_id,depends_on_task_id,dependency_type)
);

create table if not exists marketing_app.task_occurrences_v1711 (
  id uuid primary key default gen_random_uuid(),
  source_task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  generated_task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  scheduled_date date not null,
  generated_by uuid references marketing_app.members(id) on delete set null,
  generated_at timestamptz not null default now(),
  constraint task_occurrences_v1711_source_date_unique unique(source_task_id,scheduled_date)
);

create table if not exists marketing_app.task_performance_reviews_v1711 (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references marketing_app.tasks(id) on delete cascade,
  member_id uuid not null references marketing_app.members(id) on delete restrict,
  reviewer_id uuid not null references marketing_app.members(id) on delete restrict,
  decision text not null check (decision in ('approved','approved_with_notes','observed')),
  manual_score smallint not null check (manual_score between 1 and 10),
  strengths text not null default '',
  improvements text not null default '',
  comment text not null default '',
  on_time boolean,
  complexity text not null default 'media',
  system_points integer not null default 0,
  manual_points integer not null default 0,
  total_points integer not null default 0,
  points_breakdown jsonb not null default '{}'::jsonb,
  original_actual_minutes integer,
  validated_actual_minutes integer,
  review_version integer not null default 1,
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_performance_reviews_v1711_task_member_unique unique(task_id,member_id)
);

create table if not exists marketing_app.performance_points_ledger_v1711 (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references marketing_app.tasks(id) on delete cascade,
  member_id uuid not null references marketing_app.members(id) on delete cascade,
  event_code text not null,
  points integer not null,
  detail jsonb not null default '{}'::jsonb,
  granted_by uuid references marketing_app.members(id) on delete set null,
  granted_at timestamptz not null default now(),
  constraint performance_points_ledger_v1711_unique unique(task_id,member_id,event_code)
);

create table if not exists marketing_app.rank_tiers_v1711 (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  min_level integer not null check (min_level between 1 and 1000),
  max_level integer not null check (max_level between 1 and 1000 and max_level>=min_level),
  color text not null default '#6e26f6',
  icon text not null default '◆',
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_by uuid references marketing_app.members(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists marketing_app.catalog_lifecycle_v1711 (
  entity_type text not null check (entity_type in ('client','campaign')),
  entity_id uuid not null,
  state text not null default 'active' check (state in ('active','archived')),
  changed_by uuid references marketing_app.members(id) on delete set null,
  changed_at timestamptz not null default now(),
  primary key(entity_type,entity_id)
);

create table if not exists marketing_app.task_operations_audit_v1711 (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  task_id uuid references marketing_app.tasks(id) on delete set null,
  member_id uuid references marketing_app.members(id) on delete set null,
  actor_id uuid references marketing_app.members(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists task_operations_v1711_responsible_idx on marketing_app.task_operations_v1711(responsible_member_id,updated_at desc);
create index if not exists task_operations_v1711_recurrence_idx on marketing_app.task_operations_v1711(recurrence_active,next_due_date) where recurrence_active;
create index if not exists task_effort_v1711_member_idx on marketing_app.task_effort_v1711(member_id,updated_at desc);
create index if not exists task_dependencies_v1711_task_idx on marketing_app.task_dependencies_v1711(task_id);
create index if not exists task_dependencies_v1711_depends_idx on marketing_app.task_dependencies_v1711(depends_on_task_id);
create index if not exists task_performance_reviews_v1711_member_idx on marketing_app.task_performance_reviews_v1711(member_id,reviewed_at desc);
create index if not exists performance_points_ledger_v1711_member_idx on marketing_app.performance_points_ledger_v1711(member_id,granted_at desc);

insert into marketing_app.rank_tiers_v1711(code,name,min_level,max_level,color,icon,sort_order)
values
 ('brote','Brote Creativo',1,100,'#8FBF63','✦',10),
 ('explorador','Explorador',101,200,'#4F9DE8','◆',20),
 ('creador','Creador',201,300,'#5F7CFF','✧',30),
 ('artesano','Artesano',301,400,'#7A5AF8','◇',40),
 ('especialista','Especialista',401,500,'#6E2FB2','⬟',50),
 ('estratega','Estratega',501,600,'#8C3DD1','⬢',60),
 ('vanguardista','Vanguardista',601,700,'#C23BD1','✹',70),
 ('dominador','Dominador',701,800,'#E04B9A','⚡',80),
 ('titan','Titán Creativo',801,900,'#F26A4B','✷',90),
 ('leyenda','Leyenda Ejecutiva',901,950,'#E89A27','★',100),
 ('inmortal','Inmortal INBESTIGA',951,999,'#D8AF36','♛',110),
 ('arquitecto','Arquitecto del Éxito',1000,1000,'#111827','∞',120)
on conflict(code) do update set
 name=excluded.name,min_level=excluded.min_level,max_level=excluded.max_level,
 color=excluded.color,icon=excluded.icon,sort_order=excluded.sort_order;

alter table marketing_app.task_operations_v1711 enable row level security;
alter table marketing_app.task_effort_v1711 enable row level security;
alter table marketing_app.task_dependencies_v1711 enable row level security;
alter table marketing_app.task_occurrences_v1711 enable row level security;
alter table marketing_app.task_performance_reviews_v1711 enable row level security;
alter table marketing_app.performance_points_ledger_v1711 enable row level security;
alter table marketing_app.rank_tiers_v1711 enable row level security;
alter table marketing_app.catalog_lifecycle_v1711 enable row level security;
alter table marketing_app.task_operations_audit_v1711 enable row level security;

grant usage on schema marketing_app to authenticated;
grant select on marketing_app.task_operations_v1711,marketing_app.task_effort_v1711,
 marketing_app.task_dependencies_v1711,marketing_app.task_occurrences_v1711,
 marketing_app.task_performance_reviews_v1711,marketing_app.performance_points_ledger_v1711,
 marketing_app.rank_tiers_v1711,marketing_app.catalog_lifecycle_v1711,
 marketing_app.task_operations_audit_v1711 to authenticated;
revoke all on marketing_app.task_operations_v1711,marketing_app.task_effort_v1711,
 marketing_app.task_dependencies_v1711,marketing_app.task_occurrences_v1711,
 marketing_app.task_performance_reviews_v1711,marketing_app.performance_points_ledger_v1711,
 marketing_app.rank_tiers_v1711,marketing_app.catalog_lifecycle_v1711,
 marketing_app.task_operations_audit_v1711 from anon;
revoke insert,update,delete,truncate,references,trigger on marketing_app.task_operations_v1711,
 marketing_app.task_effort_v1711,marketing_app.task_dependencies_v1711,
 marketing_app.task_occurrences_v1711,marketing_app.task_performance_reviews_v1711,
 marketing_app.performance_points_ledger_v1711,marketing_app.rank_tiers_v1711,
 marketing_app.catalog_lifecycle_v1711,marketing_app.task_operations_audit_v1711 from authenticated;

create or replace function marketing_app.ibm_v1711_actor_member_id()
returns uuid language sql stable security definer
set search_path=pg_catalog,marketing_app,auth
as $$
 select m.id from marketing_app.members m
 where m.auth_user_id=auth.uid() and coalesce(m.status,'active')='active' limit 1
$$;

create or replace function marketing_app.ibm_v1711_actor_role()
returns text language sql stable security definer
set search_path=pg_catalog,marketing_app,auth
as $$
 select lower(coalesce(m.role_code,'')) from marketing_app.members m
 where m.auth_user_id=auth.uid() and coalesce(m.status,'active')='active' limit 1
$$;

create or replace function marketing_app.ibm_v1711_is_manager()
returns boolean language sql stable security definer
set search_path=pg_catalog,marketing_app,auth
as $$
 select coalesce(marketing_app.ibm_v1711_actor_role()=any(array['italo','jhulio','alejandro','director','admin','administrator','supervisor']),false)
$$;

create or replace function marketing_app.ibm_v1711_is_director()
returns boolean language sql stable security definer
set search_path=pg_catalog,marketing_app,auth
as $$
 select coalesce(marketing_app.ibm_v1711_actor_role()=any(array['italo','director','admin','administrator']),false)
$$;

create or replace function marketing_app.ibm_v1711_can_access_task(p_task_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,marketing_app,auth
as $$
 select coalesce(
   marketing_app.ibm_v1711_is_manager()
   or exists(select 1 from marketing_app.tasks t where t.id=p_task_id and t.assigned_to=marketing_app.ibm_v1711_actor_member_id())
   or exists(select 1 from marketing_app.task_participants p where p.task_id=p_task_id and p.member_id=marketing_app.ibm_v1711_actor_member_id() and p.status='active')
   or exists(select 1 from marketing_app.task_operations_v1711 o where o.task_id=p_task_id and o.responsible_member_id=marketing_app.ibm_v1711_actor_member_id()),
   false
 )
$$;

create or replace function marketing_app.ibm_v1711_points_for_level(p_level integer)
returns integer language sql immutable security definer
set search_path=pg_catalog
as $$
 select case when greatest(1,least(1000,coalesce(p_level,1)))=1 then 0 else
   floor(
     30.0*(greatest(1,least(1000,coalesce(p_level,1)))-1)
     +0.28*power(greatest(1,least(1000,coalesce(p_level,1)))-1,2)
     +0.00003*power(greatest(1,least(1000,coalesce(p_level,1)))-1,3)
   )::integer end
$$;

create or replace function marketing_app.ibm_v1711_level_from_points(p_points bigint)
returns integer language plpgsql immutable security definer
set search_path=pg_catalog,marketing_app
as $$
declare v_low integer:=1; v_high integer:=1000; v_mid integer; v_points bigint:=greatest(0,coalesce(p_points,0));
begin
 while v_low<v_high loop
   v_mid:=ceil((v_low+v_high+1)/2.0)::integer;
   if marketing_app.ibm_v1711_points_for_level(v_mid)<=v_points then v_low:=v_mid; else v_high:=v_mid-1; end if;
 end loop;
 return v_low;
end
$$;

create or replace function marketing_app.ibm_v1711_rank_for_points(p_points bigint)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,marketing_app
as $$
declare v_level integer; v_tier marketing_app.rank_tiers_v1711%rowtype; v_start integer; v_span integer; v_division integer; v_next integer;
begin
 v_level:=marketing_app.ibm_v1711_level_from_points(p_points);
 select * into v_tier from marketing_app.rank_tiers_v1711
 where active and v_level between min_level and max_level order by sort_order desc limit 1;
 v_start:=coalesce(v_tier.min_level,1); v_span:=greatest(1,coalesce(v_tier.max_level,v_start)-v_start+1);
 v_division:=least(5,greatest(1,floor(((v_level-v_start)::numeric/v_span)*5)::integer+1));
 v_next:=case when v_level>=1000 then marketing_app.ibm_v1711_points_for_level(1000) else marketing_app.ibm_v1711_points_for_level(v_level+1) end;
 return jsonb_build_object('level',v_level,'tier_code',v_tier.code,'tier_name',v_tier.name,'division',v_division,
  'color',v_tier.color,'icon',v_tier.icon,'points',greatest(0,coalesce(p_points,0)),
  'level_floor_points',marketing_app.ibm_v1711_points_for_level(v_level),'next_level_points',v_next,
  'progress_percent',case when v_level>=1000 then 100 else round(100.0*(greatest(0,coalesce(p_points,0))-marketing_app.ibm_v1711_points_for_level(v_level))/greatest(1,v_next-marketing_app.ibm_v1711_points_for_level(v_level)),1) end);
end
$$;

create or replace function marketing_app.ibm_v1711_capabilities()
returns jsonb language sql stable security definer
set search_path=pg_catalog,marketing_app,auth
as $$
 select jsonb_build_object(
  'version','17.11','task_operations',true,'manual_effort',true,'dependencies',true,'recurrence',true,
  'catalog_editor',true,'score_1_to_10',true,'automatic_points',true,'ranking_to_1000',true,
  'actor_member_id',marketing_app.ibm_v1711_actor_member_id(),'actor_role',marketing_app.ibm_v1711_actor_role(),
  'manager',marketing_app.ibm_v1711_is_manager(),'director',marketing_app.ibm_v1711_is_director()
 )
$$;

create or replace function marketing_app.ibm_v1711_dashboard()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_manager boolean; v_operations jsonb; v_efforts jsonb; v_dependencies jsonb; v_reviews jsonb; v_ledger jsonb; v_ranking jsonb; v_tiers jsonb; v_catalog jsonb; v_occurrences jsonb;
begin
 if auth.uid() is null then raise exception 'Se requiere una sesión autenticada.' using errcode='42501'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 if v_actor is null then raise exception 'La cuenta no está vinculada con un miembro activo.' using errcode='42501'; end if;
 v_manager:=marketing_app.ibm_v1711_is_manager();

 select coalesce(jsonb_agg(to_jsonb(o) order by o.updated_at desc),'[]'::jsonb) into v_operations
 from marketing_app.task_operations_v1711 o where v_manager or marketing_app.ibm_v1711_can_access_task(o.task_id);
 select coalesce(jsonb_agg(to_jsonb(e) order by e.updated_at desc),'[]'::jsonb) into v_efforts
 from marketing_app.task_effort_v1711 e where v_manager or e.member_id=v_actor or marketing_app.ibm_v1711_can_access_task(e.task_id);
 select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at),'[]'::jsonb) into v_dependencies
 from marketing_app.task_dependencies_v1711 d where v_manager or marketing_app.ibm_v1711_can_access_task(d.task_id);
 select coalesce(jsonb_agg(to_jsonb(r) order by r.reviewed_at desc),'[]'::jsonb) into v_reviews
 from marketing_app.task_performance_reviews_v1711 r where v_manager or r.member_id=v_actor;
 select coalesce(jsonb_agg(to_jsonb(l) order by l.granted_at desc),'[]'::jsonb) into v_ledger
 from marketing_app.performance_points_ledger_v1711 l where v_manager or l.member_id=v_actor;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order),'[]'::jsonb) into v_tiers from marketing_app.rank_tiers_v1711 t where t.active;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_catalog from marketing_app.catalog_lifecycle_v1711 c;
 select coalesce(jsonb_agg(to_jsonb(o) order by o.generated_at desc),'[]'::jsonb) into v_occurrences
 from marketing_app.task_occurrences_v1711 o where v_manager or marketing_app.ibm_v1711_can_access_task(o.source_task_id);

 select coalesce(jsonb_agg(x.row_data order by x.points desc,x.member_name),'[]'::jsonb) into v_ranking
 from (
   select jsonb_build_object(
     'member_id',m.id,'member_name',m.full_name,'position',m.position,
     'points',p.points,
     'rank',marketing_app.ibm_v1711_rank_for_points(p.points),
     'average_score',r.average_score,
     'reviewed_tasks',r.reviewed_tasks
   ) row_data,p.points,m.full_name member_name
   from marketing_app.members m
   left join lateral (
     select coalesce(sum(l.points),0)::bigint as points
     from marketing_app.performance_points_ledger_v1711 l
     where l.member_id=m.id
   ) p on true
   left join lateral (
     select round(avg(rv.manual_score)::numeric,2) as average_score,
            count(distinct rv.task_id)::integer as reviewed_tasks
     from marketing_app.task_performance_reviews_v1711 rv
     where rv.member_id=m.id
   ) r on true
   where coalesce(m.status,'active')='active' and (v_manager or m.id=v_actor)
 ) x;

 return jsonb_build_object('version','17.11','actor_member_id',v_actor,'manager',v_manager,
  'operations',v_operations,'efforts',v_efforts,'dependencies',v_dependencies,'reviews',v_reviews,
  'ledger',v_ledger,'ranking',v_ranking,'rank_tiers',v_tiers,'catalog_lifecycle',v_catalog,'occurrences',v_occurrences);
end
$$;

create or replace function marketing_app.ibm_v1711_upsert_task_plan(
 p_task_id uuid,p_responsible_member_id uuid,p_estimated_minutes integer,p_complexity text,
 p_recurrence jsonb default '{}'::jsonb,p_dependencies jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_before jsonb; v_after jsonb; v_dep jsonb; v_dep_id uuid; v_dep_type text; v_frequency text; v_days smallint[]; v_active boolean;
begin
 if not marketing_app.ibm_v1711_is_manager() then raise exception 'Solo Dirección o Supervisión pueden definir la planificación.' using errcode='42501'; end if;
 if not exists(select 1 from marketing_app.tasks where id=p_task_id) then raise exception 'La tarea no existe.' using errcode='23503'; end if;
 if p_responsible_member_id is not null and not exists(select 1 from marketing_app.members where id=p_responsible_member_id and coalesce(status,'active')='active') then raise exception 'El responsable no es un miembro activo.' using errcode='23503'; end if;
 if coalesce(p_complexity,'media') not in ('simple','media','alta','critica') then raise exception 'Complejidad no válida.' using errcode='22023'; end if;
 if coalesce(p_estimated_minutes,0)<0 or coalesce(p_estimated_minutes,0)>600000 then raise exception 'La estimación está fuera del rango permitido.' using errcode='22023'; end if;
 if p_dependencies is not null and jsonb_typeof(p_dependencies)<>'array' then raise exception 'Las dependencias deben ser un arreglo JSON.' using errcode='22023'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 select to_jsonb(o) into v_before from marketing_app.task_operations_v1711 o where o.task_id=p_task_id;
 v_frequency:=coalesce(nullif(p_recurrence->>'frequency',''),'none');
 if v_frequency not in ('none','daily','weekdays','weekly','biweekly','monthly','yearly','custom') then raise exception 'Frecuencia no válida.' using errcode='22023'; end if;
 select coalesce(array_agg(value::smallint),'{}'::smallint[]) into v_days from jsonb_array_elements_text(coalesce(p_recurrence->'days','[]'::jsonb));
 v_active:=coalesce((p_recurrence->>'active')::boolean,false) and v_frequency<>'none';

 insert into marketing_app.task_operations_v1711(task_id,responsible_member_id,estimated_minutes,complexity,
   recurrence_frequency,recurrence_interval,recurrence_days,recurrence_end_date,recurrence_active,next_due_date,next_due_time,
   created_by,updated_by,created_at,updated_at)
 values(p_task_id,p_responsible_member_id,p_estimated_minutes,coalesce(p_complexity,'media'),v_frequency,
   greatest(1,coalesce(nullif(p_recurrence->>'interval','')::integer,1)),v_days,
   nullif(p_recurrence->>'end_date','')::date,v_active,nullif(p_recurrence->>'next_due_date','')::date,
   nullif(p_recurrence->>'next_due_time','')::time,v_actor,v_actor,now(),now())
 on conflict(task_id) do update set responsible_member_id=excluded.responsible_member_id,
   estimated_minutes=excluded.estimated_minutes,complexity=excluded.complexity,
   recurrence_frequency=excluded.recurrence_frequency,recurrence_interval=excluded.recurrence_interval,
   recurrence_days=excluded.recurrence_days,recurrence_end_date=excluded.recurrence_end_date,
   recurrence_active=excluded.recurrence_active,next_due_date=excluded.next_due_date,next_due_time=excluded.next_due_time,
   updated_by=v_actor,updated_at=now();

 delete from marketing_app.task_dependencies_v1711 where task_id=p_task_id;
 for v_dep in select value from jsonb_array_elements(coalesce(p_dependencies,'[]'::jsonb)) loop
   begin v_dep_id:=(v_dep->>'task_id')::uuid; exception when others then raise exception 'Dependencia con UUID inválido.' using errcode='22023'; end;
   v_dep_type:=coalesce(nullif(v_dep->>'type',''),'finish_to_start');
   if v_dep_id=p_task_id then raise exception 'Una tarea no puede depender de sí misma.' using errcode='23514'; end if;
   if not exists(select 1 from marketing_app.tasks where id=v_dep_id) then raise exception 'La tarea dependiente no existe.' using errcode='23503'; end if;
   if v_dep_type not in ('finish_to_start','finish_to_finish','related') then raise exception 'Tipo de dependencia no válido.' using errcode='22023'; end if;
   if exists(
     with recursive chain(task_id,depends_on_task_id) as (
       select d.task_id,d.depends_on_task_id from marketing_app.task_dependencies_v1711 d where d.task_id=v_dep_id
       union all select d.task_id,d.depends_on_task_id from marketing_app.task_dependencies_v1711 d join chain c on d.task_id=c.depends_on_task_id
     ) select 1 from chain where depends_on_task_id=p_task_id
   ) then raise exception 'La dependencia crearía un ciclo.' using errcode='23514'; end if;
   insert into marketing_app.task_dependencies_v1711(task_id,depends_on_task_id,dependency_type,created_by)
   values(p_task_id,v_dep_id,v_dep_type,v_actor) on conflict do nothing;
 end loop;
 select to_jsonb(o) into v_after from marketing_app.task_operations_v1711 o where o.task_id=p_task_id;
 insert into marketing_app.task_operations_audit_v1711(action,task_id,actor_id,before_data,after_data)
 values('upsert_task_plan',p_task_id,v_actor,v_before,v_after);
 return jsonb_build_object('task_id',p_task_id,'operation',v_after,'dependencies',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from marketing_app.task_dependencies_v1711 d where d.task_id=p_task_id));
end
$$;

create or replace function marketing_app.ibm_v1711_record_effort(
 p_task_id uuid,p_member_id uuid default null,p_acceptance_status text default null,
 p_executor_estimate_minutes integer default null,p_actual_minutes integer default null,p_comment text default ''
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_target uuid; v_before jsonb; v_after jsonb;
begin
 if auth.uid() is null then raise exception 'Se requiere una sesión autenticada.' using errcode='42501'; end if;
 if not marketing_app.ibm_v1711_can_access_task(p_task_id) then raise exception 'La tarea está fuera de tu alcance.' using errcode='42501'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id(); v_target:=coalesce(p_member_id,v_actor);
 if not marketing_app.ibm_v1711_is_manager() and v_target<>v_actor then raise exception 'Solo puedes registrar tus propias horas.' using errcode='42501'; end if;
 if not exists(
   select 1 from marketing_app.tasks t where t.id=p_task_id and t.assigned_to=v_target
   union all select 1 from marketing_app.task_participants p where p.task_id=p_task_id and p.member_id=v_target and p.status='active'
   union all select 1 from marketing_app.task_operations_v1711 o where o.task_id=p_task_id and o.responsible_member_id=v_target
 ) then raise exception 'El miembro no participa en la tarea.' using errcode='42501'; end if;
 if p_acceptance_status is not null and p_acceptance_status not in ('pending','accepted','clarification','blocked','proposed') then raise exception 'Estado de aceptación no válido.' using errcode='22023'; end if;
 if coalesce(p_executor_estimate_minutes,0)<0 or coalesce(p_actual_minutes,0)<0 then raise exception 'Las horas no pueden ser negativas.' using errcode='22023'; end if;
 select to_jsonb(e) into v_before from marketing_app.task_effort_v1711 e where e.task_id=p_task_id and e.member_id=v_target;
 insert into marketing_app.task_effort_v1711(task_id,member_id,acceptance_status,executor_estimate_minutes,actual_minutes,
   accepted_at,acceptance_comment,actual_comment,actual_recorded_at,created_at,updated_at)
 values(p_task_id,v_target,coalesce(p_acceptance_status,'pending'),p_executor_estimate_minutes,p_actual_minutes,
   case when p_acceptance_status in ('accepted','proposed') then now() else null end,
   case when p_acceptance_status is not null then left(coalesce(p_comment,''),3000) else '' end,
   case when p_actual_minutes is not null then left(coalesce(p_comment,''),3000) else '' end,
   case when p_actual_minutes is not null then now() else null end,now(),now())
 on conflict(task_id,member_id) do update set
   acceptance_status=coalesce(p_acceptance_status,marketing_app.task_effort_v1711.acceptance_status),
   executor_estimate_minutes=coalesce(p_executor_estimate_minutes,marketing_app.task_effort_v1711.executor_estimate_minutes),
   actual_minutes=coalesce(p_actual_minutes,marketing_app.task_effort_v1711.actual_minutes),
   accepted_at=case when p_acceptance_status in ('accepted','proposed') then coalesce(marketing_app.task_effort_v1711.accepted_at,now()) else marketing_app.task_effort_v1711.accepted_at end,
   acceptance_comment=case when p_acceptance_status is not null then left(coalesce(p_comment,''),3000) else marketing_app.task_effort_v1711.acceptance_comment end,
   actual_comment=case when p_actual_minutes is not null then left(coalesce(p_comment,''),3000) else marketing_app.task_effort_v1711.actual_comment end,
   actual_recorded_at=case when p_actual_minutes is not null then now() else marketing_app.task_effort_v1711.actual_recorded_at end,
   updated_at=now();
 select to_jsonb(e) into v_after from marketing_app.task_effort_v1711 e where e.task_id=p_task_id and e.member_id=v_target;
 insert into marketing_app.task_operations_audit_v1711(action,task_id,member_id,actor_id,before_data,after_data,reason)
 values('record_effort',p_task_id,v_target,v_actor,v_before,v_after,left(coalesce(p_comment,''),1000));
 return v_after;
end
$$;

create or replace function marketing_app.ibm_v1711_review_task_performance(
 p_task_id uuid,p_member_id uuid,p_manual_score integer,p_decision text,
 p_strengths text default '',p_improvements text default '',p_comment text default '',p_validated_actual_minutes integer default null
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_task record; v_operation record; v_effort record; v_submission timestamptz; v_due timestamptz; v_on_time boolean; v_evidence boolean; v_collaboration boolean; v_base integer; v_system integer; v_manual integer; v_total integer; v_breakdown jsonb; v_before jsonb; v_after jsonb;
begin
 if not marketing_app.ibm_v1711_is_manager() then raise exception 'Solo Dirección o Supervisión pueden calificar.' using errcode='42501'; end if;
 if p_manual_score<1 or p_manual_score>10 then raise exception 'La nota debe estar entre 1 y 10.' using errcode='22023'; end if;
 if p_decision not in ('approved','approved_with_notes','observed') then raise exception 'Decisión no válida.' using errcode='22023'; end if;
 if p_manual_score<7 and nullif(btrim(coalesce(p_improvements,'')),'') is null then raise exception 'Indica las mejoras necesarias cuando la nota es menor de 7.' using errcode='22023'; end if;
 if not exists(
   select 1 from marketing_app.tasks t where t.id=p_task_id and t.assigned_to=p_member_id
   union all select 1 from marketing_app.task_participants p where p.task_id=p_task_id and p.member_id=p_member_id and p.status='active'
 ) then raise exception 'Solo puedes calificar a participantes de la tarea.' using errcode='42501'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 select * into v_task from marketing_app.tasks where id=p_task_id for update;
 select * into v_operation from marketing_app.task_operations_v1711 where task_id=p_task_id;
 select * into v_effort from marketing_app.task_effort_v1711 where task_id=p_task_id and member_id=p_member_id;
 select max(s.submitted_at) into v_submission from marketing_app.task_submissions s where s.task_id=p_task_id and s.submitted_by=p_member_id and s.status<>'withdrawn';
 v_due:=case when v_task.due_date is null then null else ((v_task.due_date::text||' '||coalesce(v_task.due_time::text,'23:59:59'))::timestamp at time zone 'America/Lima') end;
 v_on_time:=case when v_due is null or v_submission is null then null else v_submission<=v_due end;
 v_evidence:=exists(select 1 from marketing_app.work_item_attachments a where a.entity_type='task' and a.entity_id=p_task_id and a.category='submission' and a.uploader_member_id=p_member_id and a.archived_at is null);
 v_collaboration:=(select count(*) from marketing_app.task_participants p where p.task_id=p_task_id and p.status='active')>1;
 v_base:=case coalesce(v_operation.complexity,'media') when 'simple' then 10 when 'media' then 15 when 'alta' then 25 when 'critica' then 40 else 15 end;
 v_manual:=case when p_manual_score<=4 then 0 when p_manual_score<=6 then 2 when p_manual_score=7 then 5 when p_manual_score=8 then 7 when p_manual_score=9 then 9 else 12 end;
 v_system:=case when p_decision='observed' then 0 else v_base + case when v_evidence then 5 else 0 end + case when v_on_time is true then 10 else 0 end + 10 + case when coalesce(v_operation.recurrence_active,false) then 3 else 0 end + case when v_collaboration then 3 else 0 end end;
 v_total:=v_system+case when p_decision='observed' then 0 else v_manual end;
 v_breakdown:=jsonb_build_object('complexity_base',case when p_decision='observed' then 0 else v_base end,'evidence',case when p_decision<>'observed' and v_evidence then 5 else 0 end,
   'on_time',case when p_decision<>'observed' and v_on_time is true then 10 else 0 end,'approval',case when p_decision<>'observed' then 10 else 0 end,
   'recurrence',case when p_decision<>'observed' and coalesce(v_operation.recurrence_active,false) then 3 else 0 end,
   'collaboration',case when p_decision<>'observed' and v_collaboration then 3 else 0 end,'manual_score_points',case when p_decision='observed' then 0 else v_manual end);
 select to_jsonb(r) into v_before from marketing_app.task_performance_reviews_v1711 r where r.task_id=p_task_id and r.member_id=p_member_id;
 insert into marketing_app.task_performance_reviews_v1711(task_id,member_id,reviewer_id,decision,manual_score,strengths,improvements,comment,on_time,complexity,
   system_points,manual_points,total_points,points_breakdown,original_actual_minutes,validated_actual_minutes,review_version,reviewed_at,updated_at)
 values(p_task_id,p_member_id,v_actor,p_decision,p_manual_score,left(coalesce(p_strengths,''),3000),left(coalesce(p_improvements,''),3000),left(coalesce(p_comment,''),4000),v_on_time,
   coalesce(v_operation.complexity,'media'),v_system,case when p_decision='observed' then 0 else v_manual end,v_total,v_breakdown,v_effort.actual_minutes,
   coalesce(p_validated_actual_minutes,v_effort.actual_minutes),1,now(),now())
 on conflict(task_id,member_id) do update set reviewer_id=v_actor,decision=excluded.decision,manual_score=excluded.manual_score,strengths=excluded.strengths,
   improvements=excluded.improvements,comment=excluded.comment,on_time=excluded.on_time,complexity=excluded.complexity,system_points=excluded.system_points,
   manual_points=excluded.manual_points,total_points=excluded.total_points,points_breakdown=excluded.points_breakdown,
   original_actual_minutes=excluded.original_actual_minutes,validated_actual_minutes=excluded.validated_actual_minutes,
   review_version=marketing_app.task_performance_reviews_v1711.review_version+1,reviewed_at=now(),updated_at=now();

 delete from marketing_app.performance_points_ledger_v1711 where task_id=p_task_id and member_id=p_member_id and event_code like 'review_%';
 if p_decision<>'observed' then
   insert into marketing_app.performance_points_ledger_v1711(task_id,member_id,event_code,points,detail,granted_by)
   values(p_task_id,p_member_id,'review_system',v_system,v_breakdown,v_actor),
         (p_task_id,p_member_id,'review_manual',v_manual,jsonb_build_object('manual_score',p_manual_score),v_actor)
   on conflict(task_id,member_id,event_code) do update set points=excluded.points,detail=excluded.detail,granted_by=excluded.granted_by,granted_at=now();
 end if;

 if p_validated_actual_minutes is not null then
   update marketing_app.task_effort_v1711 set validated_minutes=p_validated_actual_minutes,validated_by=v_actor,validated_at=now(),validation_note=left(coalesce(p_comment,''),2000),updated_at=now()
   where task_id=p_task_id and member_id=p_member_id;
 end if;
 update marketing_app.tasks set status=case when p_decision='observed' then 'observado' else 'aprobado' end,updated_at=now() where id=p_task_id;
 select to_jsonb(r) into v_after from marketing_app.task_performance_reviews_v1711 r where r.task_id=p_task_id and r.member_id=p_member_id;
 insert into marketing_app.task_operations_audit_v1711(action,task_id,member_id,actor_id,before_data,after_data,reason)
 values('review_performance',p_task_id,p_member_id,v_actor,v_before,v_after,left(coalesce(p_comment,''),1000));
 return jsonb_build_object('review',v_after,'rank',marketing_app.ibm_v1711_rank_for_points((select coalesce(sum(points),0) from marketing_app.performance_points_ledger_v1711 where member_id=p_member_id)));
end
$$;

create or replace function marketing_app.ibm_v1711_upsert_client(p_client_id uuid,p_name text,p_state text default 'active')
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_id uuid; v_row jsonb;
begin
 if not marketing_app.ibm_v1711_is_manager() then raise exception 'Solo Dirección o Supervisión pueden gestionar clientes.' using errcode='42501'; end if;
 if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Escribe el nombre del cliente.' using errcode='22023'; end if;
 if p_state not in ('active','archived') then raise exception 'Estado no válido.' using errcode='22023'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 if p_client_id is null then
   insert into marketing_app.clients(name) values(left(btrim(p_name),240)) returning id into v_id;
 else
   update marketing_app.clients set name=left(btrim(p_name),240) where id=p_client_id returning id into v_id;
   if v_id is null then raise exception 'El cliente no existe.' using errcode='23503'; end if;
 end if;
 insert into marketing_app.catalog_lifecycle_v1711(entity_type,entity_id,state,changed_by,changed_at)
 values('client',v_id,p_state,v_actor,now()) on conflict(entity_type,entity_id) do update set state=excluded.state,changed_by=v_actor,changed_at=now();
 select to_jsonb(c) into v_row from marketing_app.clients c where c.id=v_id;
 return jsonb_build_object('client',v_row,'state',p_state);
end
$$;

create or replace function marketing_app.ibm_v1711_update_campaign(
 p_campaign_id uuid,p_name text,p_client_id uuid default null,p_status text default null,
 p_start_date date default null,p_end_date date default null,p_objective text default null,p_state text default 'active'
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_row jsonb;
begin
 if not marketing_app.ibm_v1711_is_manager() then raise exception 'Solo Dirección o Supervisión pueden gestionar campañas.' using errcode='42501'; end if;
 if nullif(btrim(coalesce(p_name,'')),'') is null then raise exception 'Escribe el nombre de la campaña.' using errcode='22023'; end if;
 if p_state not in ('active','archived') then raise exception 'Estado no válido.' using errcode='22023'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 update marketing_app.campaigns c set name=left(btrim(p_name),240),client_id=coalesce(p_client_id,c.client_id),
   status=coalesce(nullif(p_status,''),c.status),start_date=coalesce(p_start_date,c.start_date),end_date=coalesce(p_end_date,c.end_date),
   objective=coalesce(p_objective,c.objective),updated_at=now() where c.id=p_campaign_id returning to_jsonb(c) into v_row;
 if v_row is null then raise exception 'La campaña no existe.' using errcode='23503'; end if;
 insert into marketing_app.catalog_lifecycle_v1711(entity_type,entity_id,state,changed_by,changed_at)
 values('campaign',p_campaign_id,p_state,v_actor,now()) on conflict(entity_type,entity_id) do update set state=excluded.state,changed_by=v_actor,changed_at=now();
 return jsonb_build_object('campaign',v_row,'state',p_state);
end
$$;

create or replace function marketing_app.ibm_v1711_set_catalog_state(p_entity_type text,p_entity_id uuid,p_state text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid;
begin
 if not marketing_app.ibm_v1711_is_manager() then raise exception 'No tienes permiso para modificar catálogos.' using errcode='42501'; end if;
 if p_entity_type not in ('client','campaign') or p_state not in ('active','archived') then raise exception 'Parámetros de catálogo no válidos.' using errcode='22023'; end if;
 if p_entity_type='client' and not exists(select 1 from marketing_app.clients where id=p_entity_id) then raise exception 'El cliente no existe.' using errcode='23503'; end if;
 if p_entity_type='campaign' and not exists(select 1 from marketing_app.campaigns where id=p_entity_id) then raise exception 'La campaña no existe.' using errcode='23503'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 insert into marketing_app.catalog_lifecycle_v1711(entity_type,entity_id,state,changed_by,changed_at)
 values(p_entity_type,p_entity_id,p_state,v_actor,now()) on conflict(entity_type,entity_id) do update set state=excluded.state,changed_by=v_actor,changed_at=now();
 return jsonb_build_object('entity_type',p_entity_type,'entity_id',p_entity_id,'state',p_state);
end
$$;

create or replace function marketing_app.ibm_v1711_update_rank_tier(
 p_code text,p_name text,p_min_level integer,p_max_level integer,p_color text,p_icon text
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_row jsonb;
begin
 if not marketing_app.ibm_v1711_is_director() then raise exception 'Solo Dirección puede modificar los rangos.' using errcode='42501'; end if;
 if p_min_level<1 or p_max_level>1000 or p_max_level<p_min_level then raise exception 'Rango de niveles inválido.' using errcode='22023'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 update marketing_app.rank_tiers_v1711 t set name=left(btrim(p_name),120),min_level=p_min_level,max_level=p_max_level,
  color=left(coalesce(nullif(p_color,''),'#6e26f6'),20),icon=left(coalesce(nullif(p_icon,''),'◆'),8),updated_by=v_actor,updated_at=now()
 where t.code=p_code returning to_jsonb(t) into v_row;
 if v_row is null then raise exception 'El rango no existe.' using errcode='23503'; end if;
 return v_row;
end
$$;

create or replace function marketing_app.ibm_v1711_register_occurrence(p_source_task_id uuid,p_generated_task_id uuid,p_scheduled_date date)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,marketing_app,auth
as $$
declare v_actor uuid; v_next date; v_frequency text; v_interval integer; v_days smallint[]; v_end date; v_candidate date; v_guard integer;
begin
 if not marketing_app.ibm_v1711_is_manager() then raise exception 'Solo un jefe puede generar recurrencias.' using errcode='42501'; end if;
 v_actor:=marketing_app.ibm_v1711_actor_member_id();
 insert into marketing_app.task_occurrences_v1711(source_task_id,generated_task_id,scheduled_date,generated_by)
 values(p_source_task_id,p_generated_task_id,p_scheduled_date,v_actor) on conflict(source_task_id,scheduled_date) do nothing;
 select recurrence_frequency,recurrence_interval,recurrence_days,recurrence_end_date into v_frequency,v_interval,v_days,v_end
 from marketing_app.task_operations_v1711 where task_id=p_source_task_id;
 v_next:=case v_frequency
   when 'daily' then p_scheduled_date+greatest(1,v_interval)
   when 'weekdays' then case extract(isodow from p_scheduled_date) when 5 then p_scheduled_date+3 when 6 then p_scheduled_date+2 else p_scheduled_date+1 end
   when 'weekly' then p_scheduled_date+(7*greatest(1,v_interval))
   when 'biweekly' then p_scheduled_date+14
   when 'monthly' then (p_scheduled_date+(greatest(1,v_interval)||' month')::interval)::date
   when 'yearly' then (p_scheduled_date+(greatest(1,v_interval)||' year')::interval)::date
   when 'custom' then p_scheduled_date+greatest(1,v_interval)
   else null end;

 -- Cuando se eligieron días concretos, busca la siguiente fecha válida sin crear bucles infinitos.
 if coalesce(array_length(v_days,1),0)>0 and v_frequency in ('weekly','custom') then
   v_candidate:=p_scheduled_date+1; v_guard:=0;
   while v_guard<370 loop
     if extract(isodow from v_candidate)::smallint=any(v_days) then v_next:=v_candidate; exit; end if;
     v_candidate:=v_candidate+1; v_guard:=v_guard+1;
   end loop;
 end if;
 if v_end is not null and v_next>v_end then v_next:=null; end if;
 update marketing_app.task_operations_v1711 set last_generated_task_id=p_generated_task_id,next_due_date=v_next,
   recurrence_active=recurrence_active and v_next is not null,updated_by=v_actor,updated_at=now() where task_id=p_source_task_id;
 return jsonb_build_object('source_task_id',p_source_task_id,'generated_task_id',p_generated_task_id,'scheduled_date',p_scheduled_date,'next_due_date',v_next);
end
$$;

-- RLS de lectura: cada usuario ve su alcance; managers ven el equipo.
drop policy if exists task_operations_v1711_select on marketing_app.task_operations_v1711;
create policy task_operations_v1711_select on marketing_app.task_operations_v1711 for select to authenticated
using(marketing_app.ibm_v1711_can_access_task(task_id));
drop policy if exists task_effort_v1711_select on marketing_app.task_effort_v1711;
create policy task_effort_v1711_select on marketing_app.task_effort_v1711 for select to authenticated
using(marketing_app.ibm_v1711_is_manager() or member_id=marketing_app.ibm_v1711_actor_member_id() or marketing_app.ibm_v1711_can_access_task(task_id));
drop policy if exists task_dependencies_v1711_select on marketing_app.task_dependencies_v1711;
create policy task_dependencies_v1711_select on marketing_app.task_dependencies_v1711 for select to authenticated
using(marketing_app.ibm_v1711_can_access_task(task_id));
drop policy if exists task_occurrences_v1711_select on marketing_app.task_occurrences_v1711;
create policy task_occurrences_v1711_select on marketing_app.task_occurrences_v1711 for select to authenticated
using(marketing_app.ibm_v1711_can_access_task(source_task_id));
drop policy if exists task_performance_reviews_v1711_select on marketing_app.task_performance_reviews_v1711;
create policy task_performance_reviews_v1711_select on marketing_app.task_performance_reviews_v1711 for select to authenticated
using(marketing_app.ibm_v1711_is_manager() or member_id=marketing_app.ibm_v1711_actor_member_id());
drop policy if exists performance_points_ledger_v1711_select on marketing_app.performance_points_ledger_v1711;
create policy performance_points_ledger_v1711_select on marketing_app.performance_points_ledger_v1711 for select to authenticated
using(marketing_app.ibm_v1711_is_manager() or member_id=marketing_app.ibm_v1711_actor_member_id());
drop policy if exists rank_tiers_v1711_select on marketing_app.rank_tiers_v1711;
create policy rank_tiers_v1711_select on marketing_app.rank_tiers_v1711 for select to authenticated using(active);
drop policy if exists catalog_lifecycle_v1711_select on marketing_app.catalog_lifecycle_v1711;
create policy catalog_lifecycle_v1711_select on marketing_app.catalog_lifecycle_v1711 for select to authenticated using(true);
drop policy if exists task_operations_audit_v1711_select on marketing_app.task_operations_audit_v1711;
create policy task_operations_audit_v1711_select on marketing_app.task_operations_audit_v1711 for select to authenticated
using(marketing_app.ibm_v1711_is_manager() or member_id=marketing_app.ibm_v1711_actor_member_id());

grant execute on function marketing_app.ibm_v1711_capabilities() to authenticated;
grant execute on function marketing_app.ibm_v1711_dashboard() to authenticated;
grant execute on function marketing_app.ibm_v1711_upsert_task_plan(uuid,uuid,integer,text,jsonb,jsonb) to authenticated;
grant execute on function marketing_app.ibm_v1711_record_effort(uuid,uuid,text,integer,integer,text) to authenticated;
grant execute on function marketing_app.ibm_v1711_review_task_performance(uuid,uuid,integer,text,text,text,text,integer) to authenticated;
grant execute on function marketing_app.ibm_v1711_upsert_client(uuid,text,text) to authenticated;
grant execute on function marketing_app.ibm_v1711_update_campaign(uuid,text,uuid,text,date,date,text,text) to authenticated;
grant execute on function marketing_app.ibm_v1711_set_catalog_state(text,uuid,text) to authenticated;
grant execute on function marketing_app.ibm_v1711_update_rank_tier(text,text,integer,integer,text,text) to authenticated;
grant execute on function marketing_app.ibm_v1711_register_occurrence(uuid,uuid,date) to authenticated;
grant execute on function marketing_app.ibm_v1711_rank_for_points(bigint) to authenticated;
revoke all on function marketing_app.ibm_v1711_capabilities() from anon;
revoke all on function marketing_app.ibm_v1711_dashboard() from anon;

DO $realtime$
begin
  begin alter publication supabase_realtime add table marketing_app.task_operations_v1711; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table marketing_app.task_effort_v1711; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table marketing_app.task_dependencies_v1711; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table marketing_app.task_performance_reviews_v1711; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table marketing_app.performance_points_ledger_v1711; exception when duplicate_object then null; end;
end
$realtime$;

notify pgrst,'reload schema';
commit;

select
  to_regclass('marketing_app.task_operations_v1711') as task_operations,
  to_regclass('marketing_app.task_effort_v1711') as task_effort,
  to_regclass('marketing_app.task_dependencies_v1711') as task_dependencies,
  to_regclass('marketing_app.task_performance_reviews_v1711') as performance_reviews,
  to_regclass('marketing_app.performance_points_ledger_v1711') as points_ledger,
  to_regclass('marketing_app.rank_tiers_v1711') as rank_tiers,
  to_regprocedure('marketing_app.ibm_v1711_dashboard()') as dashboard_rpc;
