-- INBESTIGA Marketing Cloud v16.1
-- SQL OPCIONAL, IDPOTENTE Y NO DESTRUCTIVO.
-- Registra la compatibilidad de versión. No altera tablas productivas, RLS, Storage ni Realtime.

create schema if not exists marketing_app;

create table if not exists marketing_app.system_versions (
  component text primary key,
  version text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into marketing_app.system_versions(component, version, metadata, updated_at)
values (
  'frontend',
  '16.1',
  jsonb_build_object(
    'build', 'PRODUCTION CERTIFICATION',
    'rpc_count', 45,
    'read_only_automatic_tests', true,
    'guided_role_matrix', true,
    'realtime_bridge', true,
    'pwa_shell', true,
    'non_destructive', true
  ),
  now()
)
on conflict (component) do update
set version = excluded.version,
    metadata = excluded.metadata,
    updated_at = excluded.updated_at;

-- La certificación automática solo consulta servicios y metadatos.
-- La validación de escrituras y RLS debe realizarse con las tres cuentas reales
-- siguiendo la matriz incluida en el Production Certification Center.
