-- INBESTIGA MARKETING CLOUD v17.12
-- LIQUID GLASS VISUAL CONTENT BUILDER
-- SQL OPCIONAL, ADITIVO, IDEMPOTENTE Y MANUAL.
-- No modifica Auth, tareas, campañas, Creative Arena, RPC productivas ni datos operativos.

begin;

create table if not exists marketing_app.visual_content (
  scope text primary key default 'global',
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint visual_content_scope_check check (scope = 'global'),
  constraint visual_content_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create table if not exists marketing_app.visual_content_history (
  id bigserial primary key,
  scope text not null default 'global',
  payload jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  action text not null default 'publish',
  constraint visual_content_history_payload_object_check check (jsonb_typeof(payload) = 'object')
);

alter table marketing_app.visual_content enable row level security;
alter table marketing_app.visual_content_history enable row level security;

create or replace function marketing_app.ibm_v1712_actor_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public
as $$
  select lower(coalesce(m.role_code, 'member'))
  from marketing_app.members m
  where m.auth_user_id = auth.uid()
    and coalesce(lower(m.status), 'active') = 'active'
  order by m.updated_at desc nulls last
  limit 1
$$;

create or replace function marketing_app.ibm_v1712_can_manage_visual_content()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, marketing_app, public
as $$
  select coalesce(marketing_app.ibm_v1712_actor_role() = any(array[
    'italo','jhulio','alejandro','admin','director','owner','ceo','gerente','supervisor','marketing_lead'
  ]), false)
$$;

create or replace function marketing_app.ibm_v1712_visual_content_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, marketing_app, public
as $$
declare
  v_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión autenticada requerida.' using errcode = '42501';
  end if;

  select vc.payload into v_payload
  from marketing_app.visual_content vc
  where vc.scope = 'global';

  return coalesce(v_payload, '{}'::jsonb);
end;
$$;

create or replace function marketing_app.ibm_v1712_visual_content_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, marketing_app, public
as $$
declare
  v_previous jsonb;
  v_saved jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sesión autenticada requerida.' using errcode = '42501';
  end if;

  if not marketing_app.ibm_v1712_can_manage_visual_content() then
    raise exception 'Tu rol no puede publicar contenido visual global.' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'El contenido visual debe ser un objeto JSON válido.' using errcode = '22023';
  end if;

  if octet_length(p_payload::text) > 1800000 then
    raise exception 'El contenido visual supera el límite seguro de 1.8 MB. Usa Supabase Storage para las imágenes.' using errcode = '54000';
  end if;

  select payload into v_previous
  from marketing_app.visual_content
  where scope = 'global'
  for update;

  if v_previous is not null then
    insert into marketing_app.visual_content_history(scope, payload, changed_by, action)
    values ('global', v_previous, auth.uid(), 'previous_version');
  end if;

  insert into marketing_app.visual_content(scope, payload, updated_by, updated_at)
  values ('global', p_payload, auth.uid(), now())
  on conflict (scope) do update
    set payload = excluded.payload,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
  returning payload into v_saved;

  insert into marketing_app.visual_content_history(scope, payload, changed_by, action)
  values ('global', v_saved, auth.uid(), 'publish');

  return jsonb_build_object(
    'ok', true,
    'scope', 'global',
    'updated_at', now(),
    'payload', v_saved
  );
end;
$$;

revoke all on table marketing_app.visual_content from public, anon, authenticated;
revoke all on table marketing_app.visual_content_history from public, anon, authenticated;
revoke all on function marketing_app.ibm_v1712_actor_role() from public, anon;
revoke all on function marketing_app.ibm_v1712_can_manage_visual_content() from public, anon;
revoke all on function marketing_app.ibm_v1712_visual_content_get() from public, anon;
revoke all on function marketing_app.ibm_v1712_visual_content_save(jsonb) from public, anon;

grant execute on function marketing_app.ibm_v1712_actor_role() to authenticated;
grant execute on function marketing_app.ibm_v1712_can_manage_visual_content() to authenticated;
grant execute on function marketing_app.ibm_v1712_visual_content_get() to authenticated;
grant execute on function marketing_app.ibm_v1712_visual_content_save(jsonb) to authenticated;

comment on table marketing_app.visual_content is 'Configuración visual global editable de INBESTIGA Marketing Cloud v17.12.';
comment on table marketing_app.visual_content_history is 'Historial de publicaciones del Visual Content Builder v17.12.';
comment on function marketing_app.ibm_v1712_visual_content_get() is 'Lee el contenido visual global para cualquier miembro autenticado.';
comment on function marketing_app.ibm_v1712_visual_content_save(jsonb) is 'Publica contenido visual global solo para Dirección o Supervisión.';

commit;
