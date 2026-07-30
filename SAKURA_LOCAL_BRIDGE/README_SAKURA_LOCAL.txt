SAKURA LOCAL BRIDGE v0.9 — INBESTIGA MARKETING CLOUD v17.15.3
================================================================

ESTE ES EL CONECTOR CORRECTO PARA LA PLATAFORMA.
No uses los ejecutores v1.0, v1.1, v1.1.1 ni v1.1.2 entregados anteriormente.

PRIMER USO
1. Asegúrate de tener Python 3.10+ y Ollama instalados.
2. Ejecuta DESCARGAR_MODELOS_SAKURA.bat para obtener gemma3:4b y embeddinggemma.
3. Ejecuta INICIAR_SAKURA_Y_OLLAMA.bat.
4. Copia el código mostrado.
5. Abre Marketing Cloud > SAKURA > Ajustes.
6. Pega el código y pulsa Emparejar.

SI APARECE UN ERROR
- Ejecuta REPARAR_Y_REINICIAR_SAKURA.bat.
- Después ejecuta DIAGNOSTICAR_CONEXION.bat.

SEGURIDAD
- Solo escucha en 127.0.0.1:8765.
- No recibe credenciales de Supabase.
- No ejecuta comandos del chat.
- El código se renueva después de emparejar.
- El origen web queda autorizado localmente mediante token.
- La bóveda se conserva en SAKURA_DATA.

COMPATIBILIDAD v17.15.3
- Rutas nativas: /status, /pair, /models, /chat, /intent, /analyze, /embed, /vault, /backup y /release.
- Alias compatibles: /health, /api/pairing/verify, /api/models, /api/chat y /api/model/release.
- Soporte CORS y Local Network Access para conexión desde Vercel.
