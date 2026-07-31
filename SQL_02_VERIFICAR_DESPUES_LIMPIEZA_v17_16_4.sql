-- INBESTIGA Marketing Cloud v17.16.4
-- PASO 02 · VERIFICAR DESPUÉS DE LA LIMPIEZA
-- No modifica datos.

create temporary table pg_temp.inbestiga_post_clean(
  schema_name text,
  table_name text,
  row_count bigint,
  expected text
);

do $$
declare r record;c bigint;
begin
  for r in
    select schemaname,tablename,
      case when schemaname='marketing_app' and tablename in ('areas','members','roles','settings','role_permissions','system_versions','rank_tiers_v1711','catalog_lifecycle_v1711','ui_theme_versions','ui_asset_library','permissions','permission_catalog','status_catalog','feature_flags','app_config','system_settings') then 'CONSERVADA' else 'DEBE ESTAR EN 0' end expected
    from pg_tables
    where schemaname='marketing_app'
       or (schemaname='public' and tablename in ('interarea_request_attachments','interarea_request_updates','interarea_requests'))
    order by schemaname,tablename
  loop
    execute format('select count(*) from %I.%I',r.schemaname,r.tablename) into c;
    insert into pg_temp.inbestiga_post_clean values(r.schemaname,r.tablename,c,r.expected);
  end loop;
end $$;

select * from pg_temp.inbestiga_post_clean order by expected,schema_name,table_name;
select count(*) filter(where expected='DEBE ESTAR EN 0' and row_count<>0) as tablas_operativas_con_datos,
       count(*) filter(where expected='CONSERVADA') as tablas_de_configuracion_conservadas
from pg_temp.inbestiga_post_clean;
