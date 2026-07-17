SAKURA LOCAL BRIDGE v0.6
========================

1. Ejecuta INSTALAR_SAKURA_LOCAL.bat una sola vez.
2. Asegúrate de que Ollama esté abierto.
3. Ejecuta DESCARGAR_MODELOS_SAKURA.bat si aún no tienes gemma3:4b y embeddinggemma.
4. Ejecuta INICIAR_SAKURA_LOCAL.bat.
5. Copia el código de seis dígitos que aparece en la ventana negra.
6. Abre Marketing Cloud > SAKURA > Ajustes, pega el código y pulsa Emparejar.
7. Mantén la ventana local abierta mientras conversas con Ollama.

SEGURIDAD
- El puente escucha solo en 127.0.0.1:8765.
- No recibe ni guarda credenciales de Supabase.
- No ejecuta comandos enviados desde el chat.
- Solo acepta el origen web que emparejaste y un token local.
- La bóveda está en SAKURA_DATA y no se publica en Vercel.

RESPALDO
Desde Estudio de SAKURA puedes crear respaldos. Se guardan en:
SAKURA_DATA\respaldos
