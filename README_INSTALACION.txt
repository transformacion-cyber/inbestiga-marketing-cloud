INBESTIGA MARKETING CLOUD v17.12.12
CENTRO OPERATIVO · SALUD PROTEGIDA

BASE ÚNICA
- Construida exclusivamente desde v17.12.11.
- No mezclar con archivos de versiones anteriores.
- No requiere ejecutar SQL adicional.

ACTUALIZACIÓN MEDIANTE GITHUB DESKTOP
1. Descomprime este ZIP.
2. Abre GitHub Desktop y el repositorio inbestiga-marketing-cloud.
3. Pulsa Repository > Show in Explorer.
4. Copia TODO el contenido descomprimido dentro de la carpeta del repositorio.
5. Reemplaza los archivos existentes.
6. No borres la carpeta oculta .git.
7. Regresa a GitHub Desktop.
8. Escribe el commit:
   Actualización v17.12.12 — Centro operativo y salud protegida
9. Pulsa Commit to main.
10. Pulsa Push origin.
11. Espera el despliegue automático de Vercel.

COMPROBACIÓN DESPUÉS DEL DESPLIEGUE
- Abre el enlace de Vercel en incógnito.
- Confirma v17.12.12 y caché inbestiga-v17-12-12-shell.
- Inicia sesión con un miembro y revisa Mi día.
- Inicia sesión con un jefe y revisa Aprobaciones y Capacidad.
- Ejecuta Auditoría Pro y compara con la línea base: 96 de salud, 0 fallas, 1 advertencia externa o de validación pendiente.
- No declarar 100 ni certificación real hasta probar con la sesión productiva.

SQL
- No ejecutar SQL para esta versión.
- La versión reutiliza tareas, approval_history, live_events, notifications, assets y controles de ciclo de vida ya existentes.

NOTA SOBRE PAPELERA
- La restauración reversible está disponible.
- La eliminación definitiva permanece deliberadamente deshabilitada porque la base actual no expone una operación de purga segura y reversible. Esto protege los datos y evita cambios destructivos en RLS/tablas.
