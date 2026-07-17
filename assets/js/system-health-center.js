/* ===== v17.12.10 SYSTEM HEALTH CENTER ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_SYSTEM_HEALTH) return;

  const VERSION = "v17.12.10";
  const BUILD = "TASK OPERATIONS, CATALOGS & PERFORMANCE RANKING · SYSTEM HEALTH";
  const STORE_KEY = "inbestiga:v171:system-health";
  const RPC_MANIFEST_URL = "config/rpc-manifest.json";
  const DEFAULT_BUCKET = "inbestiga-media";
  const EXPECTED_RPC_COUNT = 45;
  const STATUS_ORDER = { fail: 0, warn: 1, info: 2, ok: 3 };

  let activeTab = "summary";
  let running = false;
  let lastReport = null;
  let paletteWrapped = false;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function readJson(key, fallback = null) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento opcional */ }
  }

  function safeMessage(value) {
    return String(value || "")
      .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[token oculto]")
      .replace(/(apikey|authorization|service_role|anon_key)\s*[:=]\s*[^\s,;]+/gi, "$1=[oculto]")
      .slice(0, 500);
  }

  function safeCfg() {
    try {
      const value = typeof cfg === "function" ? cfg() : {};
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function authId() {
    try { return authUser?.id || null; } catch { return null; }
  }

  function memberId() {
    try { return member?.id || authUser?.id || null; } catch { return null; }
  }

  function memberLabel() {
    try { return member?.full_name || authUser?.email || "Sesión sin perfil"; } catch { return "Sin sesión"; }
  }

  function roleLabelSafe() {
    try {
      if (typeof roleLabel === "function") return roleLabel();
      return member?.position || member?.role_code || "Rol no identificado";
    } catch {
      return "Rol no identificado";
    }
  }

  function authorized() {
    try {
      if (typeof isDirector === "function" && isDirector()) return true;
      const text = [member?.role_code, member?.position].filter(Boolean).join(" ").toLowerCase();
      return /\b(admin|administrator|administrador|director|direcci[oó]n|owner|propietario|gerente general)\b/.test(text);
    } catch {
      return false;
    }
  }

  function projectRef() {
    try {
      const host = new URL(safeCfg().url || "").hostname;
      return host.split(".")[0] || "no-configurado";
    } catch {
      return "no-configurado";
    }
  }

  function formatDate(value, fallback = "Sin registro") {
    if (!value) return fallback;
    try {
      return new Date(value).toLocaleString("es-PE", {
        timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return String(value);
    }
  }

  function statusLabel(status) {
    return ({ ok: "Operativo", warn: "Advertencia", fail: "Requiere atención", info: "Informativo" })[status] || status;
  }

  function check(id, category, label, status, value, detail, extra = {}) {
    return { id, category, label, status, value, detail: safeMessage(detail), ...extra };
  }

  function withTimeout(promise, milliseconds, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label || "Operación"} excedió ${milliseconds / 1000} segundos`)), milliseconds);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function fetchJson(url) {
    const response = await withTimeout(fetch(url, { cache: "no-store" }), 7000, "Lectura del manifiesto");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function rpcHealth() {
    let manifest = null;
    try {
      manifest = await fetchJson(RPC_MANIFEST_URL);
    } catch (error) {
      return {
        manifest: check("rpc-manifest", "services", "Manifiesto RPC", "fail", "No disponible", error?.message || error),
        openapi: check("rpc-openapi", "services", "RPC en Supabase", "warn", "No comprobadas", "El manifiesto local no pudo leerse."),
        required: [], missing: [], available: [], verified: false
      };
    }

    const required = list(manifest.required_rpcs).map(String);
    const declaredCount = Number(manifest.count) || required.length;
    const uniqueCount = new Set(required).size;
    const manifestOk = declaredCount === required.length && uniqueCount === required.length && required.length === EXPECTED_RPC_COUNT;
    const manifestCheck = check(
      "rpc-manifest", "services", "Manifiesto RPC", manifestOk ? "ok" : "fail",
      `${required.length}/${EXPECTED_RPC_COUNT}`,
      manifestOk ? "Las funciones requeridas están declaradas una sola vez." : `Declaradas: ${required.length}; count: ${declaredCount}; únicas: ${uniqueCount}.`
    );

    const config = safeCfg();
    if (!config.url || !config.key || typeof fetch !== "function") {
      return {
        manifest: manifestCheck,
        openapi: check("rpc-openapi", "services", "RPC en Supabase", "warn", "Sin configuración", "Se necesita URL y clave anon para consultar OpenAPI."),
        required, missing: required, available: [], verified: false
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let accessToken = config.key;
      try {
        const current = await sb?.auth?.getSession?.();
        accessToken = current?.data?.session?.access_token || config.key;
      } catch { /* usa anon si la sesión no puede refrescarse */ }
      const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/`, {
        signal: controller.signal,
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/openapi+json",
          "Accept-Profile": "marketing_app"
        }
      });
      clearTimeout(timer);
      if ([401, 403, 404].includes(response.status)) {
        return {
          manifest: manifestCheck,
          openapi: check(
            "rpc-openapi", "services", "RPC productivas", "info",
            `${required.length} declaradas · ejecución pendiente`,
            `La introspección OpenAPI respondió HTTP ${response.status}. No se reduce la salud por una ruta de catálogo restringida; las RPC se certifican ejecutándolas por rol desde Production Certification.`
          ),
          required, missing: [], available: [], verified: false, introspection_restricted: true
        };
      }
      if (!response.ok) throw new Error(`OpenAPI HTTP ${response.status}`);
      const spec = await response.json();
      const available = Object.keys(spec.paths || {})
        .filter((path) => path.startsWith("/rpc/"))
        .map((path) => path.slice(5));
      const availableSet = new Set(available);
      const missing = required.filter((name) => !availableSet.has(name));
      return {
        manifest: manifestCheck,
        openapi: check(
          "rpc-openapi", "services", "RPC en Supabase", missing.length ? "fail" : "ok",
          missing.length ? `${required.length - missing.length}/${required.length}` : `${required.length}/${required.length}`,
          missing.length ? `Faltan: ${missing.join(", ")}` : "OpenAPI expone las 45 RPC requeridas. Esto confirma presencia, no permisos ni persistencia."
        ),
        required, missing, available, verified: true
      };
    } catch (error) {
      return {
        manifest: manifestCheck,
        openapi: check("rpc-openapi", "services", "RPC en Supabase", "warn", "No verificadas", error?.name === "AbortError" ? "La consulta OpenAPI agotó el tiempo." : error?.message || error),
        required, missing: [], available: [], verified: false
      };
    }
  }

  function supabaseHealth() {
    const config = safeCfg();
    const library = !!window.supabase;
    let client = false;
    try { client = typeof sb !== "undefined" && !!sb; } catch { client = false; }
    const configured = !!(config.url && config.key);
    const sessionActive = !!authId();
    const status = library && client && configured && sessionActive ? "ok" : client && configured ? "warn" : "fail";
    const value = sessionActive ? "Sesión activa" : configured ? "Cliente configurado" : "Sin configuración";
    const detail = [
      library ? "librería cargada" : "librería ausente",
      client ? "cliente creado" : "cliente ausente",
      configured ? `proyecto ${projectRef()}` : "URL/anon pendientes",
      sessionActive ? "usuario autenticado" : "sin usuario autenticado"
    ].join(" · ");
    return check("supabase", "summary", "Supabase", status, value, detail);
  }

  async function storageHealth() {
    try {
      if (typeof sb === "undefined" || !sb?.storage) {
        return check("storage", "services", "Storage", "warn", "No disponible", "El cliente de Storage no está cargado.");
      }
      const bucket = window.INBESTIGA_MEDIA_BUCKET || DEFAULT_BUCKET;
      const prefix = authId() || "";
      const result = await withTimeout(sb.storage.from(bucket).list(prefix, { limit: 1 }), 7000, "Storage");
      if (result.error) throw result.error;
      return check("storage", "services", "Storage", "ok", "Lectura permitida", `Bucket ${bucket} accesible para la sesión actual. No se subió ni eliminó ningún archivo.`);
    } catch (error) {
      return check("storage", "services", "Storage", "warn", "No certificado", error?.message || error);
    }
  }

  async function realtimeHealth() {
    if (!navigator.onLine) return check("realtime", "services", "Realtime", "warn", "Sin conexión", "El navegador está offline.");
    try {
      if (typeof sb === "undefined" || !sb?.channel) {
        return check("realtime", "services", "Realtime", "warn", "Sin cliente", "Supabase Realtime no está disponible.");
      }
      return await new Promise((resolve) => {
        let finished = false;
        let channel = null;
        const finish = (item) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          try { if (channel && sb?.removeChannel) sb.removeChannel(channel); } catch { /* temporal */ }
          resolve(item);
        };
        const timer = setTimeout(() => finish(check("realtime", "services", "Realtime", "warn", "Sin confirmación", "El canal temporal no confirmó suscripción en 6 segundos.")), 6000);
        channel = sb.channel(`inbestiga-v171-health-${Date.now()}`).subscribe((status) => {
          if (status === "SUBSCRIBED") finish(check("realtime", "services", "Realtime", "ok", "Canal activo", "Supabase confirmó una suscripción temporal. La sincronización entre dos cuentas aún requiere prueba manual."));
          if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) finish(check("realtime", "services", "Realtime", "warn", status, "Revisa publicación, red y políticas de Realtime."));
        });
      });
    } catch (error) {
      return check("realtime", "services", "Realtime", "warn", "No certificado", error?.message || error);
    }
  }

  async function pwaHealth() {
    const secure = location.protocol === "https:" || location.hostname === "localhost";
    const supported = "serviceWorker" in navigator;
    const manifest = !!document.querySelector('link[rel="manifest"]');
    if (!supported) return check("pwa", "services", "PWA", "warn", "No compatible", "Este navegador no admite Service Worker.");
    if (!secure) return check("pwa", "services", "PWA", "warn", "Requiere HTTPS", "Service Worker solo funciona con HTTPS o localhost.");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      let cacheName = "";
      try {
        const names = typeof caches !== "undefined" ? await caches.keys() : [];
        cacheName = names.find((name) => name.includes("inbestiga-v17-12-10")) || names.find((name) => name.includes("inbestiga")) || "";
      } catch { /* CacheStorage puede estar restringido */ }
      const expectedCache = cacheName.includes("inbestiga-v17-12-10");
      const ready = !!registration && manifest && expectedCache;
      return check(
        "pwa", "services", "PWA", ready ? "ok" : "warn",
        ready ? `Shell ${VERSION} activa` : registration ? "Actualización pendiente" : "Registro pendiente",
        `${manifest ? "manifest presente" : "manifest ausente"}${cacheName ? ` · caché ${cacheName}` : " · caché no confirmada"}${navigator.serviceWorker.controller ? " · página controlada" : " · recarga pendiente"}`
      );
    } catch (error) {
      return check("pwa", "services", "PWA", "warn", "No certificada", error?.message || error);
    }
  }

  function work360Local() {
    const id = memberId();
    if (!id) return { key: null, data: null, bytes: 0 };
    const key = `inbestiga:v17:work360:${id}`;
    const raw = (() => { try { return localStorage.getItem(key); } catch { return null; } })();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    return { key, data, bytes: raw ? new Blob([raw]).size : 0 };
  }

  function work360DomState() {
    const node = document.getElementById("v17SyncState");
    return node?.dataset?.state || null;
  }

  function work360HasMeaningfulLocalData(value) {
    if (!value || typeof value !== "object") return false;
    const metadata = value.metadata && typeof value.metadata === "object" ? value.metadata : {};
    return Object.keys(metadata).length > 0
      || list(value.savedFilters).length > 0
      || list(value.templates).length > 0
      || list(value.history).length > 0
      || !!value.activeTimer
      || (!!value.view && value.view !== "kanban");
  }

  async function work360Health() {
    const local = work360Local();
    const localUpdated = local.data?.updatedAt || null;
    const localItems = Object.keys(local.data?.metadata || {}).length;
    const meaningfulLocal = work360HasMeaningfulLocalData(local.data);
    const localCheck = check(
      "work360-local", "sync", "Work 360 local", local.data ? "ok" : "info",
      local.data ? `${localItems} tareas planificadas` : "Sin datos locales",
      local.data ? `Último cambio ${formatDate(localUpdated)} · ${(local.bytes / 1024).toFixed(1)} KB en este navegador.` : "El fallback local está disponible y se activará al guardar planificación."
    );

    if (!authId()) {
      return {
        local: localCheck,
        cloud: check("work360-cloud", "sync", "Work 360 en Supabase", "warn", "Requiere sesión", "Inicia sesión para comprobar tablas opcionales y sincronización."),
        pending: check("work360-pending", "sync", "Cambios por sincronizar", meaningfulLocal ? "warn" : "ok", meaningfulLocal ? "No determinable" : "Sin pendientes detectados", meaningfulLocal ? "Sin sesión no se puede comparar la copia local con Supabase." : "El contenedor local está vacío y no contiene trabajo por sincronizar."),
        mode: "local",
        localUpdated,
        remoteUpdated: null,
        metadataCount: localItems
      };
    }

    try {
      if (typeof sb === "undefined" || !sb?.schema) throw new Error("Cliente Supabase no disponible");
      const preferencesTable = sb.schema("marketing_app").from("work360_preferences");
      const extensionsTable = sb.schema("marketing_app").from("task_extensions");
      const [preferencesResult, extensionsResult] = await Promise.all([
        withTimeout(preferencesTable.select("preferences,updated_at").eq("user_id", authId()).maybeSingle(), 7000, "Preferencias Work 360"),
        withTimeout(extensionsTable.select("task_id", { count: "exact", head: true }).eq("user_id", authId()), 7000, "Extensiones Work 360")
      ]);
      if (preferencesResult.error) throw preferencesResult.error;
      if (extensionsResult.error) throw extensionsResult.error;

      const remoteUpdated = preferencesResult.data?.preferences?.updatedAt || preferencesResult.data?.updated_at || null;
      const domState = work360DomState();
      const cloudCheck = check(
        "work360-cloud", "sync", "Work 360 en Supabase", "ok", "Tablas disponibles",
        `${Number(extensionsResult.count) || 0} extensiones visibles para esta cuenta${domState ? ` · estado UI ${domState}` : ""}.`
      );

      let pendingStatus = "info";
      let pendingValue = "Sin cambios";
      let pendingDetail = "No hay una copia local más reciente que la remota.";
      if (!meaningfulLocal) {
        pendingStatus = "ok";
        pendingValue = "Sin pendientes detectados";
        pendingDetail = local.data
          ? "El contenedor local solo contiene la configuración base; no hay tareas, filtros, plantillas, historial ni temporizadores por sincronizar."
          : "No existen datos locales pendientes.";
      } else if (localUpdated && !remoteUpdated) {
        pendingStatus = "warn";
        pendingValue = "1 bloque local";
        pendingDetail = "Existe planificación local y todavía no hay preferencias remotas para esta cuenta.";
      } else if (localUpdated && remoteUpdated) {
        const localTime = new Date(localUpdated).getTime();
        const remoteTime = new Date(remoteUpdated).getTime();
        if (Number.isFinite(localTime) && Number.isFinite(remoteTime) && localTime > remoteTime + 2000) {
          pendingStatus = "warn";
          pendingValue = "1 bloque pendiente";
          pendingDetail = `La copia local (${formatDate(localUpdated)}) es más reciente que Supabase (${formatDate(remoteUpdated)}).`;
        } else {
          pendingStatus = "ok";
          pendingValue = "Sin pendientes detectados";
          pendingDetail = `Local ${formatDate(localUpdated)} · Supabase ${formatDate(remoteUpdated)}.`;
        }
      } else if (remoteUpdated) {
        pendingStatus = "ok";
        pendingValue = "Sin pendientes detectados";
        pendingDetail = `La última copia remota es ${formatDate(remoteUpdated)}.`;
      }

      return {
        local: localCheck,
        cloud: cloudCheck,
        pending: check("work360-pending", "sync", "Cambios por sincronizar", pendingStatus, pendingValue, pendingDetail),
        mode: "cloud",
        localUpdated,
        remoteUpdated,
        metadataCount: localItems,
        remoteExtensionCount: Number(extensionsResult.count) || 0
      };
    } catch (error) {
      const message = error?.message || String(error);
      return {
        local: localCheck,
        cloud: check("work360-cloud", "sync", "Work 360 en Supabase", "warn", "Fallback local", `${message}. SQL_OPCIONAL_v17_0.sql permanece opcional y no fue ejecutado por este centro.`),
        pending: check("work360-pending", "sync", "Cambios por sincronizar", meaningfulLocal ? "warn" : "ok", meaningfulLocal ? "Solo local" : "Sin pendientes detectados", meaningfulLocal ? "La planificación está protegida en este navegador, pero no se confirmó copia en Supabase." : "El contenedor local está vacío y no contiene trabajo por sincronizar."),
        mode: "local",
        localUpdated,
        remoteUpdated: null,
        metadataCount: localItems,
        error: safeMessage(message)
      };
    }
  }

  function runtimeHealth() {
    const reportErrors = list(window.INBESTIGA_QUALITY_CORE?.last?.()?.errors);
    const storedErrors = list(readJson("inbestiga:v14:runtime-errors", []));
    const errors = [...reportErrors, ...storedErrors]
      .filter(Boolean)
      .slice(-20)
      .map((item) => ({
        at: item.at || item.created_at || item.timestamp || null,
        type: safeMessage(item.type || item.kind || "runtime"),
        message: safeMessage(item.message || item.reason || item.error || JSON.stringify(item)),
        source: safeMessage(item.source || item.filename || "")
      }));
    return {
      check: check("runtime-errors", "incidents", "Errores recientes", errors.length ? "warn" : "ok", errors.length ? `${errors.length} registrados` : "Sin errores", errors.length ? "El monitor local conserva eventos de esta sesión o de la anterior." : "No se encontraron errores persistidos por Platform Quality Core."),
      errors
    };
  }

  async function storageEstimateHealth() {
    if (!navigator.storage?.estimate) return check("browser-storage", "sync", "Almacenamiento del navegador", "info", "No disponible", "El navegador no expone estimación de cuota.");
    try {
      const estimate = await navigator.storage.estimate();
      const usage = Number(estimate.usage) || 0;
      const quota = Number(estimate.quota) || 0;
      const percent = quota ? Math.round(usage / quota * 1000) / 10 : 0;
      const status = percent >= 85 ? "fail" : percent >= 65 ? "warn" : "ok";
      return check("browser-storage", "sync", "Almacenamiento del navegador", status, quota ? `${percent}% utilizado` : "Disponible", quota ? `${(usage / 1048576).toFixed(1)} MB de ${(quota / 1048576).toFixed(1)} MB.` : "No se pudo calcular la cuota total.");
    } catch (error) {
      return check("browser-storage", "sync", "Almacenamiento del navegador", "info", "No medido", error?.message || error);
    }
  }

  function lifecycleHealth() {
    try {
      const result = window.INBESTIGA_RECORD_LIFECYCLE?.health?.();
      if (!result) return check("record-lifecycle", "sync", "Ciclo de vida de registros", "info", "Módulo no confirmado", "La interfaz de edición, archivado, papelera y restauración todavía no reportó estado.");
      const status = ["ok", "warn", "fail", "info"].includes(result.status) ? result.status : "info";
      return check("record-lifecycle", "sync", "Ciclo de vida de registros", status, result.value || "Disponible", result.detail || "Controles v17.5.1 cargados.");
    } catch (error) {
      return check("record-lifecycle", "sync", "Ciclo de vida de registros", "warn", "No comprobado", error?.message || error);
    }
  }

  function designStudioHealth() {
    try {
      const result = window.INBESTIGA_DESIGN_STUDIO?.health?.();
      if (!result) return check("design-studio", "sync", "Diseño y apariencia", "info", "Módulo no confirmado", "El editor visual todavía no reportó estado.");
      const status = ["ok", "warn", "fail", "info"].includes(result.status) ? result.status : "info";
      return check("design-studio", "sync", "Diseño y apariencia", status, result.value || "Disponible", result.detail || "Capa visual controlada y reversible.");
    } catch (error) {
      return check("design-studio", "sync", "Diseño y apariencia", "warn", "No comprobado", error?.message || error);
    }
  }

  function buildHealth() {
    const runtimeVersion = window.INBESTIGA_BUILD?.version || document.documentElement.dataset.inbestigaBuild || "sin versión";
    const modules = list(window.INBESTIGA_BUILD?.modules);
    const healthLoaded = !!window.INBESTIGA_SYSTEM_HEALTH;
    const status = healthLoaded ? "ok" : "fail";
    return check("build", "summary", "Versión instalada", status, runtimeVersion, `${window.INBESTIGA_BUILD?.name || BUILD} · ${modules.length || "módulos no contados"} módulos registrados.`);
  }

  function connectivityHealth() {
    const secure = window.isSecureContext;
    const online = navigator.onLine;
    const status = online && secure ? "ok" : online ? "warn" : "fail";
    return check("connectivity", "summary", "Conectividad", status, online ? (secure ? "Online + segura" : "Online sin HTTPS") : "Offline", `${location.protocol}//${location.host || "archivo local"}`);
  }

  function scoreChecks(checks) {
    const scored = checks.filter((item) => ["ok", "warn", "fail"].includes(item.status));
    const points = scored.reduce((sum, item) => sum + (item.status === "ok" ? 1 : item.status === "warn" ? 0.5 : 0), 0);
    return Math.round(points / Math.max(1, scored.length) * 100);
  }

  function overallStatus(checks) {
    const fails = checks.filter((item) => item.status === "fail").length;
    const warnings = checks.filter((item) => item.status === "warn").length;
    if (fails) return { status: "fail", title: "Requiere atención", message: `${fails} falla${fails === 1 ? "" : "s"} y ${warnings} advertencia${warnings === 1 ? "" : "s"} detectadas.` };
    if (warnings) return { status: "warn", title: "Operativo con advertencias", message: `${warnings} comprobación${warnings === 1 ? "" : "es"} necesita${warnings === 1 ? "" : "n"} validación o configuración.` };
    return { status: "ok", title: "Operación estable", message: "No se detectaron fallas en esta lectura automática." };
  }

  async function run(options = {}) {
    if (running) return lastReport;
    if (!authorized() && !options.allowUnauthorized) {
      return { denied: true, version: VERSION, generated_at: new Date().toISOString() };
    }
    running = true;
    render();
    try {
      const baseChecks = [buildHealth(), supabaseHealth(), connectivityHealth()];
      const [rpc, storage, realtime, pwa, work360, browserStorage] = await Promise.all([
        rpcHealth(), storageHealth(), realtimeHealth(), pwaHealth(), work360Health(), storageEstimateHealth()
      ]);
      const runtime = runtimeHealth();
      const lifecycle = lifecycleHealth();
      const designStudio = designStudioHealth();
      const checks = [
        ...baseChecks,
        rpc.manifest,
        rpc.openapi,
        storage,
        realtime,
        pwa,
        work360.local,
        work360.cloud,
        work360.pending,
        lifecycle,
        designStudio,
        browserStorage,
        runtime.check
      ];
      const overall = overallStatus(checks);
      const score = scoreChecks(checks);
      lastReport = {
        version: VERSION,
        build: BUILD,
        generated_at: new Date().toISOString(),
        project_ref: projectRef(),
        account: {
          member_id: memberId(),
          auth_user_id: authId(),
          name: memberLabel(),
          role: roleLabelSafe(),
          authorized: authorized()
        },
        overall: { ...overall, score },
        checks,
        rpc: {
          required_count: rpc.required.length,
          verified: !!rpc.verified,
          available_count: rpc.verified ? rpc.required.length - rpc.missing.length : null,
          missing: rpc.verified ? rpc.missing : []
        },
        work360,
        incidents: runtime.errors,
        limitations: [
          "Las pruebas automáticas son de lectura y no certifican RLS de escritura.",
          "Realtime entre dos usuarios, carga real de archivos y persistencia cruzada requieren pruebas manuales.",
          "La introspección OpenAPI restringida no sustituye la ejecución controlada de las 45 RPC por rol.",
          "SQL_OPCIONAL_v16_1.sql, SQL_OPCIONAL_v17_0.sql, SQL_OPCIONAL_v17_5_1.sql, SQL_OPCIONAL_v17_7.sql y SQL_OPCIONAL_v17_8.sql no se ejecutan automáticamente."
        ]
      };
      writeJson(STORE_KEY, lastReport);
      emitUpdate(lastReport);
      return lastReport;
    } catch (error) {
      lastReport = {
        version: VERSION,
        build: BUILD,
        generated_at: new Date().toISOString(),
        overall: { status: "fail", title: "Diagnóstico interrumpido", message: safeMessage(error?.message || error), score: 0 },
        checks: [check("health-run", "summary", "Centro de salud", "fail", "No completado", error?.message || error)],
        incidents: [],
        limitations: []
      };
      writeJson(STORE_KEY, lastReport);
      emitUpdate(lastReport);
      return lastReport;
    } finally {
      running = false;
      render();
    }
  }

  function emitUpdate(report) {
    try {
      window.dispatchEvent(new CustomEvent("inbestiga:system-health-updated", { detail: { report } }));
    } catch { /* evento opcional */ }
  }

  function last() {
    const report = lastReport || readJson(STORE_KEY, null);
    return report?.version === VERSION ? report : null;
  }

  function ensurePanel() {
    let backdrop = document.getElementById("v171HealthBackdrop");
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = "v171HealthBackdrop";
    backdrop.innerHTML = '<section id="v171HealthPanel" role="dialog" aria-modal="true" aria-labelledby="v171HealthTitle"></section>';
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function orderedChecks(category) {
    return list(last()?.checks)
      .filter((item) => !category || item.category === category)
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
  }

  function checkCard(item, compact = false) {
    return `<article class="v171-health-card${compact ? " compact" : ""}" data-status="${esc(item.status)}">
      <div class="v171-health-card-head"><span>${esc(item.label)}</span><b>${esc(statusLabel(item.status))}</b></div>
      <strong>${esc(item.value)}</strong>
      <p>${esc(item.detail)}</p>
    </article>`;
  }

  function summaryHtml(report) {
    const checks = list(report?.checks);
    const preferred = ["supabase", "storage", "realtime", "pwa", "work360-cloud", "design-studio"];
    const cards = preferred.map((id) => checks.find((item) => item.id === id)).filter(Boolean);
    const overall = report?.overall || { status: "info", title: "Aún no comprobado", message: "Ejecuta una lectura de salud.", score: 0 };
    return `<div class="v171-health-hero" data-status="${esc(overall.status)}">
      <div class="v171-health-score"><strong>${running ? "…" : esc(overall.score ?? 0)}</strong><span>salud operativa</span></div>
      <div class="v171-health-hero-copy"><span>Estado actual</span><h3>${esc(overall.title)}</h3><p>${esc(overall.message)}</p><small>Última lectura: ${esc(formatDate(report?.generated_at, "Aún no ejecutada"))}</small></div>
      <div class="v171-health-context"><span>Proyecto</span><strong>${esc(report?.project_ref || projectRef())}</strong><small>${esc(memberLabel())} · ${esc(roleLabelSafe())}</small></div>
    </div>
    <div class="v171-health-grid">${cards.length ? cards.map((item) => checkCard(item)).join("") : checkCard(check("empty", "summary", "Centro de salud", "info", "Listo para comprobar", "La lectura no modifica datos productivos."))}</div>
    <div class="v171-health-section-head"><div><h3>Atención prioritaria</h3><p>Primero aparecen fallas y advertencias.</p></div></div>
    <div class="v171-health-list">${checks.filter((item) => ["fail", "warn"].includes(item.status)).length ? checks.filter((item) => ["fail", "warn"].includes(item.status)).map((item) => rowHtml(item)).join("") : rowHtml(check("stable", "summary", "Sin alertas críticas", "ok", "Operación estable", "No se detectaron fallas en la última lectura."))}</div>`;
  }

  function rowHtml(item) {
    return `<article class="v171-health-row" data-status="${esc(item.status)}"><i></i><div><strong>${esc(item.label)}</strong><p>${esc(item.detail)}</p></div><span>${esc(item.value)}</span></article>`;
  }

  function servicesHtml() {
    const checks = orderedChecks("services");
    return `<div class="v171-health-section-head"><div><h3>Servicios técnicos</h3><p>Conexión de solo lectura a RPC, Storage, Realtime y PWA.</p></div></div>
      <div class="v171-health-grid">${checks.length ? checks.map((item) => checkCard(item)).join("") : checkCard(check("services-empty", "services", "Servicios", "info", "Pendiente", "Ejecuta una comprobación."))}</div>
      <div class="v171-health-note"><strong>Importante:</strong> el catálogo OpenAPI puede estar restringido y no afecta por sí solo la salud operativa. La certificación real exige ejecutar las 45 RPC con Dirección, Supervisión y Colaborador.</div>`;
  }

  function syncHtml(report) {
    const checks = orderedChecks("sync");
    const work360 = report?.work360 || {};
    return `<div class="v171-health-section-head"><div><h3>Sincronización Work 360</h3><p>Compara el fallback local con las tablas opcionales cuando están disponibles.</p></div></div>
      <div class="v171-health-sync-strip">
        <article><span>Modo detectado</span><strong>${esc(work360.mode === "cloud" ? "Local + Supabase" : "Fallback local")}</strong></article>
        <article><span>Último cambio local</span><strong>${esc(formatDate(work360.localUpdated, "Sin registro"))}</strong></article>
        <article><span>Última copia remota</span><strong>${esc(formatDate(work360.remoteUpdated, "No confirmada"))}</strong></article>
        <article><span>Metadatos locales</span><strong>${esc(work360.metadataCount ?? 0)}</strong></article>
      </div>
      <div class="v171-health-list">${checks.length ? checks.map((item) => rowHtml(item)).join("") : rowHtml(check("sync-empty", "sync", "Sincronización", "info", "Pendiente", "Ejecuta una comprobación."))}</div>
      <div class="v171-health-note"><strong>Fallback protegido:</strong> si las tablas v17 no existen o RLS impide la lectura, Work 360 conserva planificación, filtros, plantillas e historial en el navegador. Este panel no instala SQL.</div>`;
  }

  function incidentsHtml(report) {
    const errors = list(report?.incidents);
    const incidentCheck = list(report?.checks).find((item) => item.id === "runtime-errors");
    return `<div class="v171-health-section-head"><div><h3>Incidencias observadas</h3><p>Eventos guardados localmente por el monitor de calidad.</p></div><button type="button" data-v171-action="quality">Abrir Quality Center</button></div>
      ${incidentCheck ? rowHtml(incidentCheck) : ""}
      <div class="v171-health-incidents">${errors.length ? errors.slice().reverse().map((item) => `<article><div><strong>${esc(item.type || "runtime")}</strong><span>${esc(formatDate(item.at, "Fecha no registrada"))}</span></div><p>${esc(item.message || "Sin detalle")}</p>${item.source ? `<small>${esc(item.source)}</small>` : ""}</article>`).join("") : `<div class="v171-health-empty"><strong>Sin errores registrados</strong><p>El monitor local no reporta incidencias recientes.</p></div>`}</div>
      <div class="v171-health-note">Los errores mostrados provienen del navegador actual. No sustituyen registros del servidor ni monitoreo centralizado.</div>`;
  }

  function render() {
    const backdrop = ensurePanel();
    const panel = backdrop.querySelector("#v171HealthPanel");
    if (!panel) return;
    const report = last();
    const content = activeTab === "services" ? servicesHtml(report)
      : activeTab === "sync" ? syncHtml(report)
      : activeTab === "incidents" ? incidentsHtml(report)
      : summaryHtml(report);
    const overall = report?.overall || { status: "info", title: "Pendiente" };
    panel.innerHTML = `<header class="v171-health-head">
        <div><span>INBESTIGA ${VERSION}</span><h2 id="v171HealthTitle">Centro de salud del sistema</h2><p>Diagnóstico operativo de solo lectura para Dirección. No modifica tablas, políticas, archivos ni autenticación.</p></div>
        <div class="v171-health-head-actions"><div class="v171-health-state" data-status="${esc(overall.status)}"><i></i><span>${esc(overall.title)}</span></div><button type="button" data-v171-action="close" aria-label="Cerrar">×</button></div>
      </header>
      <nav class="v171-health-tabs" aria-label="Áreas del centro de salud">${[["summary", "Resumen"], ["services", "Servicios"], ["sync", "Sincronización"], ["incidents", "Incidencias"]].map(([id, label]) => `<button type="button" data-v171-tab="${id}" class="${activeTab === id ? "active" : ""}">${label}</button>`).join("")}</nav>
      <main class="v171-health-body">${content}</main>
      <footer class="v171-health-foot"><p>Lectura automática: no equivale a certificación productiva completa.</p><div><button type="button" data-v171-action="certification">Abrir certificación</button><button type="button" data-v171-action="export" ${report ? "" : "disabled"}>Exportar JSON</button><button type="button" class="primary" data-v171-action="run" ${running ? "disabled" : ""}>${running ? "Comprobando…" : "Comprobar ahora"}</button></div></footer>`;
  }

  function notify(title, detail, kind = "warning") {
    try {
      if (typeof premiumToast === "function") return premiumToast(title, detail, kind);
      if (typeof toast === "function") return toast(title, detail);
    } catch { /* fallback */ }
    alert(`${title}\n${detail}`);
  }

  function open(tab = "summary") {
    if (!authorized()) {
      notify("Acceso restringido", "El Centro de salud está disponible solo para Dirección o administración.", "warning");
      return false;
    }
    activeTab = ["summary", "services", "sync", "incidents"].includes(tab) ? tab : "summary";
    const backdrop = ensurePanel();
    render();
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => backdrop.querySelector("button")?.focus(), 0);
    const report = last();
    const age = report?.generated_at ? Date.now() - new Date(report.generated_at).getTime() : Infinity;
    if (!report || age > 120000) run();
    return true;
  }

  function close() {
    document.getElementById("v171HealthBackdrop")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  function exportReport() {
    const report = last();
    if (!report) return;
    const output = { ...report, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `INBESTIGA_salud_sistema_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function addPaletteItem() {
    let items = null;
    try { if (typeof V12_PALETTE_ITEMS !== "undefined" && Array.isArray(V12_PALETTE_ITEMS)) items = V12_PALETTE_ITEMS; } catch { items = null; }
    if (!items) return;
    const key = "v171:system-health";
    const index = items.findIndex((item) => item.key === key);
    if (!authorized()) {
      if (index >= 0) items.splice(index, 1);
      return;
    }
    if (index >= 0) return;
    items.push({
      key,
      code: "SH",
      title: "Centro de salud del sistema",
      meta: "Supabase, 45 RPC, Storage, Realtime, PWA, Work 360 e incidencias",
      action: () => open("summary")
    });
  }

  function wrapPalette() {
    if (paletteWrapped) return;
    let base = null;
    try { base = typeof v12OpenCommandPalette === "function" ? v12OpenCommandPalette : null; } catch { base = null; }
    if (!base) return;
    v12OpenCommandPalette = function () {
      addPaletteItem();
      return base.apply(this, arguments);
    };
    paletteWrapped = true;
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-v171-tab]")?.dataset.v171Tab;
    if (tab) { activeTab = tab; render(); return; }
    const action = event.target.closest("[data-v171-action]")?.dataset.v171Action;
    if (action === "close") return close();
    if (action === "run") return run();
    if (action === "export") return exportReport();
    if (action === "certification") {
      close();
      return window.INBESTIGA_PRODUCTION_CERTIFICATION?.open?.("automatic");
    }
    if (action === "quality") {
      close();
      return window.INBESTIGA_QUALITY_CORE?.open?.();
    }
    if (event.target.id === "v171HealthBackdrop") close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("v171HealthBackdrop")?.classList.contains("open")) close();
  });

  window.addEventListener("online", () => {
    if (document.getElementById("v171HealthBackdrop")?.classList.contains("open")) run();
  });
  window.addEventListener("offline", () => {
    if (document.getElementById("v171HealthBackdrop")?.classList.contains("open")) run();
  });

  function init() {
    ensurePanel();
    addPaletteItem();
    wrapPalette();
    window.INBESTIGA_QUALITY_CORE?.register?.("system-health-center", { version: VERSION, mode: "read-only-director" });
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "system-health-center"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  window.INBESTIGA_SYSTEM_HEALTH = {
    version: VERSION,
    build: BUILD,
    open,
    close,
    run,
    last,
    export: exportReport,
    authorized
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
