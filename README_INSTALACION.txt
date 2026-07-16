INBESTIGA MARKETING CLOUD v17.11
TASK OPERATIONS, CATALOGS & PERFORMANCE RANKING

BASE AUTORIZADA
v17.10.2 AUDIT HEALTH WIDGET PERSISTENCE HOTFIX.
Este paquete es acumulativo: para Netlify se publica únicamente v17.11.

DESPLIEGUE FRONTEND
1. Subir el ZIP completo v17.11 al mismo proyecto de Netlify.
2. Esperar el estado Publicado.
3. Cerrar todas las pestañas anteriores y recargar con Ctrl + Shift + R.
4. Confirmar INBESTIGA v17.11 y Shell v17.11 activa.
5. Comprobar Salud del sistema antes de instalar el backend opcional.

BACKEND OPCIONAL
6. SQL_OPCIONAL_v17_9.sql debe estar instalado si se usan ejecutores múltiples, referencias y entregas.
7. SQL_OPCIONAL_v17_10.sql debe permanecer instalado para deadlines y gobierno de miembros.
8. Ejecutar SQL_OPCIONAL_v17_11.sql completo una sola vez en Supabase SQL Editor.
9. No ejecutar fragmentos, no agregar GRANT manuales y nunca usar service_role en el frontend.
10. Esperar 20–30 segundos, cerrar las pestañas y volver a cargar.

PRUEBA RECOMENDADA
11. Crear una tarea de certificación con dos ejecutores y un responsable final diferente.
12. Definir horas estimadas, dependencia y recurrencia.
13. Aceptar la tarea con un ejecutor y registrar su estimación manual.
14. Entregar con archivos y horas reales manuales.
15. Calificar 1–10 desde Jhulio/Alejandro y comprobar puntos/rango.
16. Exportar el reporte del día y del mes a CSV, Excel y PDF.
17. Crear/renombrar/archivar/restaurar un cliente y editar una campaña de prueba.

IMPORTANTE
- El temporizador no es obligatorio para las horas reales.
- Las tareas anteriores siguen funcionando; los campos nuevos aparecerán como “sin información registrada”.
- La sincronización, RLS, Realtime, recurrencias y puntajes deben certificarse con Supabase real después de ejecutar el SQL.
- Creative Arena, Auth, las 45 RPC productivas, loadAll, renderAll y bootstrap no se modifican.
