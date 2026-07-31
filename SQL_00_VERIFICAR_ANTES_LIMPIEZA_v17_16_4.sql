-- INBESTIGA Marketing Cloud v17.16.4
-- PASO 00 · VERIFICAR ANTES DE LIMPIAR
-- Este archivo NO elimina ni modifica información.

create temporary table if not exists pg_temp.inbestiga_clean_preview(
  schema_name text,
  table_name text,
  row_count bigint,
  action text
);
truncate pg_temp.inbestiga_clean_preview;

do $$
declare
  r record;
  c bigint;
begin
  for r in
    select schemaname, tablename,
      case
        when schemaname='marketing_app' and tablename in ('areas','members','roles','settings','role_permissions','system_versions','rank_tiers_v1711','catalog_lifecycle_v1711','ui_theme_versions','ui_asset_library','permissions','permission_catalog','status_catalog','feature_flags','app_config','system_settings') then 'CONSERVAR'
        when schemaname='marketing_app' then 'LIMPIAR'
        when schemaname='public' and tablename in ('interarea_request_attachments','interarea_request_updates','interarea_requests') then 'LIMPIAR'
        else 'IGNORAR'
      end as action
    from pg_tables
    where schemaname='marketing_app'
       or (schemaname='public' and tablename in ('interarea_request_attachments','interarea_request_updates','interarea_requests'))
    order by schemaname,tablename
  loop
    execute format('select count(*) from %I.%I',r.schemaname,r.tablename) into c;
    insert into pg_temp.inbestiga_clean_preview values(r.schemaname,r.tablename,c,r.action);
  end loop;
end $$;

select *
from pg_temp.inbestiga_clean_preview
order by case action when 'LIMPIAR' then 1 when 'CONSERVAR' then 2 else 3 end,schema_name,table_name;

select action,sum(row_count) as total_registros
from pg_temp.inbestiga_clean_preview
group by action
order by action;
