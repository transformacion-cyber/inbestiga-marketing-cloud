# INBESTIGA Marketing Cloud

Plataforma interna de gestión integral del equipo de Marketing de INBESTIGA.

## Versión base

**v17.12.8 — Editor Layout Responsive Hotfix**

Esta versión continúa únicamente desde la rama autorizada v17.12.x y corrige la distribución responsive del editor visual unificado.

## Ejecución local

No abras `index.html` mediante `file:///`.

Desde esta carpeta ejecuta:

```bash
py -m http.server 8080
```

Después abre:

```text
http://localhost:8080
```

## Despliegue

El proyecto puede publicarse en Netlify desde la raíz del repositorio. `index.html` debe permanecer en la carpeta principal.

## Seguridad

- Nunca subir una clave `service_role`.
- No guardar contraseñas, tokens privados ni archivos `.env` en GitHub.
- En el frontend solo puede utilizarse una clave pública `anon` o `publishable`, protegida mediante RLS.
- El repositorio debe mantenerse **privado**.

## Zonas protegidas

No modificar sin validación específica:

- Supabase Auth y login.
- `loadAll`, `renderAll` y bootstrap productivo.
- RPC, RLS, tablas y Storage productivos.
- Creative Arena y sus pizarras.
- Trabajo 360, campañas y mensajes salvo error reproducible.

## Estado del repositorio

Este repositorio contiene el proyecto descomprimido y preparado para control de versiones. No incluye el ZIP original de distribución.
