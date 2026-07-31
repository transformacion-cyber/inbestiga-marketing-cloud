-- INBESTIGA Marketing Cloud v17.16.4
-- PASO 01 · LIMPIEZA OFICIAL DE DATOS OPERATIVOS
-- BASE: v17.16.3 confirmada como funcional.
--
-- CONSERVA:
--   * auth.users y todas las cuentas de acceso
--   * marketing_app.members (usuarios/equipo)
--   * áreas, roles, permisos y configuración de la plataforma
--   * versiones del sistema, catálogo visual y temas globales
--
-- ELIMINA:
--   * tareas, campañas, clientes, briefs, editorial, muro y comentarios
--   * mensajes, notificaciones, reportes, incidencias y entregas
--   * Solicitudes 360, audios/documentos vinculados en base de datos
--   * historiales, auditorías operativas, preferencias y datos de prueba
--
-- IMPORTANTE: este SQL no toca storage.objects. Los archivos físicos se
-- vacían mediante Supabase Storage/API siguiendo la guía incluida.

begin;
select pg_advisory_xact_lock(hashtext('inbestiga-official-clean-start-v17-16-4'));

do $$
declare
  targets text;
  r record;
begin
  select string_agg(format('%I.%I',schemaname,tablename),', ' order by schemaname,tablename)
  into targets
  from pg_tables
  where
    (schemaname='marketing_app' and tablename not in ('areas','members','roles','settings','role_permissions','system_versions','rank_tiers_v1711','catalog_lifecycle_v1711','ui_theme_versions','ui_asset_library','permissions','permission_catalog','status_catalog','feature_flags','app_config','system_settings'))
    or
    (schemaname='public' and tablename in ('interarea_request_attachments','interarea_request_updates','interarea_requests'));

  if targets is not null and length(targets)>0 then
    execute 'truncate table '||targets||' restart identity';
  end if;

  -- Reiniciar contadores personales sin borrar identidad, cargo o acceso.
  for r in
    select column_name,data_type
    from information_schema.columns
    where table_schema='marketing_app'
      and table_name='members'
      and column_name in (
        'points','total_points','score','xp','streak','current_streak','longest_streak',
        'completed_tasks','tasks_completed','tasks_on_time','tasks_late','late_tasks',
        'quality_score','performance_score','productivity_score'
      )
  loop
    if r.data_type in ('smallint','integer','bigint','numeric','real','double precision') then
      execute format('update marketing_app.members set %I=0',r.column_name);
    end if;
  end loop;

  -- Limpiar marcas temporales de actividad sin alterar usuarios.
  for r in
    select column_name
    from information_schema.columns
    where table_schema='marketing_app'
      and table_name='members'
      and column_name in ('last_seen_at','last_active_at','last_presence_at')
  loop
    execute format('update marketing_app.members set %I=null',r.column_name);
  end loop;
end $$;

commit;

-- Verificación rápida: las tablas operativas deben quedar en cero.
create temporary table pg_temp.inbestiga_clean_result(
  schema_name text,
  table_name text,
  row_count bigint
);

do $$
declare
  r record;
  c bigint;
begin
  for r in
    select schemaname,tablename
    from pg_tables
    where
      (schemaname='marketing_app' and tablename not in ('areas','members','roles','settings','role_permissions','system_versions','rank_tiers_v1711','catalog_lifecycle_v1711','ui_theme_versions','ui_asset_library','permissions','permission_catalog','status_catalog','feature_flags','app_config','system_settings'))
      or
      (schemaname='public' and tablename in ('interarea_request_attachments','interarea_request_updates','interarea_requests'))
    order by schemaname,tablename
  loop
    execute format('select count(*) from %I.%I',r.schemaname,r.tablename) into c;
    insert into pg_temp.inbestiga_clean_result values(r.schemaname,r.tablename,c);
  end loop;
end $$;

select * from pg_temp.inbestiga_clean_result where row_count<>0 order by schema_name,table_name;
select 'LIMPIEZA_COMPLETADA' as estado,
       (select count(*) from marketing_app.members) as usuarios_conservados,
       now() as ejecutado_en;
