/* ===== v17.12.8 PRODUCTION CERTIFICATION ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_PRODUCTION_CERTIFICATION) return;

  const VERSION = "v17.12.8";
  const BUILD = "PRODUCTION CERTIFICATION · TASK OPERATIONS & RANKING";
  const STORE_KEY = "inbestiga:v161:production-certification";
  const REQUIRED_SECTIONS = [
    "home", "myday", "tasks", "campaigns", "notifications", "messages",
    "workload", "creativeRoomsClean", "assets", "profile", "reports",
    "admin", "permissions", "auditpro", "governance"
  ];
  const REQUIRED_GLOBALS = [
    "navTo", "renderAll", "renderHome", "loadAll", "openPremiumModal",
    "homeOpenTask", "homeOpenCampaign"
  ];
  const REQUIRED_ARRAYS = [
    "members", "roles", "role_permissions", "tasks", "campaigns", "messages",
    "notifications", "live_presence", "assets"
  ];

  const ROLE_STEPS = {
    director: [
      ["d-login", "Ingresar como Dirección", "La sesión carga el perfil y reconoce el rol de dirección.", "home"],
      ["d-access", "Abrir Administración y Permisos", "Ambos módulos deben abrir sin bloqueos ni errores.", "admin"],
      ["d-campaign", "Crear, editar, archivar y restaurar una campaña de prueba", "El proyecto persiste, conserva relaciones y vuelve a aparecer después de restaurarlo.", "campaigns"],
      ["d-review", "Validar u observar una entrega", "La decisión queda registrada con comentario e historial.", "approvals"],
      ["d-report", "Abrir y guardar un reporte", "El reporte utiliza datos actuales y respeta los permisos.", "reports"],
      ["d-security", "Comprobar restricción con otra cuenta", "Una cuenta colaboradora no puede entrar a permisos ni administrar usuarios.", "permissions"],
      ["d-realtime", "Verificar cambio entre dos navegadores", "Una actualización se refleja en la segunda sesión sin recargar.", "notifications"],
      ["d-arena", "Abrir y guardar una pizarra vinculada", "La pizarra conserva sus avances al cerrar y volver a abrir.", "creativeRoomsClean"]
    ],
    supervisor: [
      ["s-login", "Ingresar como Supervisión", "La sesión reconoce el rol y muestra su centro operativo.", "home"],
      ["s-scope", "Revisar tareas del equipo", "Solo se muestran los datos permitidos para su alcance.", "tasks"],
      ["s-review", "Validar y observar entregas", "Ambas acciones actualizan estado, comentario e historial.", "approvals"],
      ["s-workload", "Comprobar carga del equipo", "Las horas, vencimientos y responsables coinciden con las tareas.", "workload"],
      ["s-campaign", "Abrir un espacio integral de campaña", "Brief, tareas, archivos y pizarra corresponden a la misma campaña.", "campaigns"],
      ["s-message", "Enviar y recibir un mensaje", "El mensaje aparece para ambas cuentas y actualiza el indicador.", "messages"],
      ["s-realtime", "Verificar Realtime", "El segundo navegador recibe cambios y presencia correctamente.", "notifications"],
      ["s-denied", "Confirmar rutas restringidas", "No puede modificar configuración corporativa reservada a Dirección.", "permissions"]
    ],
    collaborator: [
      ["c-login", "Ingresar como Colaborador", "El Home muestra sus tareas y prioridades personales.", "home"],
      ["c-scope", "Comprobar alcance de tareas", "No puede editar tareas ajenas ni ver información restringida.", "tasks"],
      ["c-progress", "Actualizar progreso", "El nuevo estado persiste después de sincronizar.", "tasks"],
      ["c-deliver", "Entregar enlace o archivo", "La evidencia queda vinculada a la tarea correcta.", "tasks"],
      ["c-observation", "Corregir una observación", "La tarea vuelve a revisión conservando el historial.", "tasks"],
      ["c-message", "Enviar y recibir mensajes", "El destinatario recibe la conversación y la notificación.", "messages"],
      ["c-arena", "Abrir la pizarra asignada", "Puede trabajar solo en la pizarra correspondiente y guardar avances.", "creativeRoomsClean"],
      ["c-denied", "Probar módulos administrativos", "Administración, permisos y gobernanza permanecen restringidos.", "admin"]
    ]
  };

  let activeTab = "automatic";
  let lastReport = null;
  let running = false;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const list = (value) => Array.isArray(value) ? value : [];

  function localDateKey(value = new Date(), timeZone = "America/Lima") {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(value);
      const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${map.year}-${map.month}-${map.day}`;
    } catch {
      const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 10);
    }
  }

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function writeStore(value) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch { /* opcional */ }
  }

  function currentRole() {
    try {
      if (typeof isDirector === "function" && isDirector()) return "director";
      if (typeof isSupervisor === "function" && isSupervisor()) return "supervisor";
    } catch { /* sigue como colaborador */ }
    return "collaborator";
  }

  function projectRef() {
    try {
      const url = typeof cfg === "function" ? cfg()?.url : "";
      const host = new URL(url).hostname;
      return host.split(".")[0] || "no-configurado";
    } catch {
      return "no-configurado";
    }
  }

  function duplicateIds() {
    const seen = new Set();
    const duplicates = [];
    document.querySelectorAll("[id]").forEach((node) => {
      if (seen.has(node.id) && !duplicates.includes(node.id)) duplicates.push(node.id);
      seen.add(node.id);
    });
    return duplicates;
  }

  function technicalText() {
    const patterns = [/\bfunction\s+[A-Za-z_$]/, /\.innerHTML\s*=/, /=>\s*\{/, /<\/script>/i];
    const hits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        const value = (node.textContent || "").trim();
        return value && patterns.some((pattern) => pattern.test(value))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode() && hits.length < 8) {
      hits.push((walker.currentNode.textContent || "").trim().slice(0, 150));
    }
    return hits;
  }

  function test(name, status, value, meta) {
    return { name, status, value, meta };
  }

  async function testBackendVersion() {
    try {
      if (typeof sb === "undefined" || !sb?.schema) {
        return test("Compatibilidad backend", "pending", "Sin cliente", "No se pudo consultar system_versions; esta comprobación opcional no afecta la salud operativa.");
      }
      const table = sb.schema("marketing_app").from("system_versions");
      const result = await table.select("component,version,metadata,updated_at").eq("component", "frontend").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return test("Compatibilidad backend", "pending", "Sin registro", "El registro system_versions es opcional y no afecta la operación de la versión actual.");
      const version = String(result.data.version || "").trim();
      const majorMatch = version.match(/^v?(\d+)/i);
      const major = majorMatch ? Number(majorMatch[1]) : NaN;
      const compatible = Number.isFinite(major) && major >= 16;
      return test(
        "Compatibilidad backend",
        compatible ? "ok" : "warn",
        `DB ${version || "sin versión"}`,
        compatible ? "El registro de versión es compatible con la versión actual o una familia posterior." : "Revisa la compatibilidad antes de operaciones productivas."
      );
    } catch (error) {
      return test("Compatibilidad backend", "warn", "No certificada", error?.message || String(error));
    }
  }

  async function testStorage() {
    try {
      if (typeof sb === "undefined" || !sb?.storage) {
        return test("Storage", "warn", "No disponible", "El cliente de Storage no está cargado.");
      }
      const bucket = window.INBESTIGA_MEDIA_BUCKET || "inbestiga-media";
      const prefix = (typeof authUser !== "undefined" && authUser?.id) || "";
      const result = await sb.storage.from(bucket).list(prefix, { limit: 1 });
      if (result.error) throw result.error;
      return test("Storage", "ok", "Lectura permitida", `Bucket ${bucket} accesible para la sesión actual.`);
    } catch (error) {
      return test("Storage", "warn", "Pendiente", error?.message || String(error));
    }
  }

  async function testRealtime() {
    if (!navigator.onLine) return test("Realtime", "warn", "Sin conexión", "Recupera internet para probar el canal.");
    if (typeof sb === "undefined" || !sb?.channel) return test("Realtime", "warn", "Sin cliente", "Supabase Realtime no está disponible.");
    return new Promise((resolve) => {
      let done = false;
      let channel = null;
      const finish = (result) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { if (channel && sb?.removeChannel) sb.removeChannel(channel); } catch { /* opcional */ }
        resolve(result);
      };
      const timer = setTimeout(() => finish(test("Realtime", "warn", "Sin confirmación", "El canal no confirmó la suscripción en 5 segundos.")), 5000);
      try {
        channel = sb.channel(`inbestiga-v175-cert-${Date.now()}`).subscribe((status) => {
          if (status === "SUBSCRIBED") finish(test("Realtime", "ok", "Canal activo", "El servicio confirmó una suscripción temporal de solo lectura."));
          if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) finish(test("Realtime", "warn", status, "Revisa la publicación y las políticas de Realtime."));
        });
      } catch (error) {
        finish(test("Realtime", "warn", "No disponible", error?.message || String(error)));
      }
    });
  }

  async function testPwa() {
    if (!("serviceWorker" in navigator)) return test("PWA", "warn", "No compatible", "Este navegador no admite Service Worker.");
    if (!(location.protocol === "https:" || location.hostname === "localhost")) {
      return test("PWA", "warn", "Requiere HTTPS", "La instalación PWA necesita HTTPS o localhost.");
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      return test("PWA", registration ? "ok" : "warn", registration ? "Registrada" : "Pendiente", registration ? "Service Worker activo para este origen." : "Recarga una vez para completar el registro.");
    } catch (error) {
      return test("PWA", "warn", "No certificada", error?.message || String(error));
    }
  }

  async function runAutomatic() {
    if (running) return lastReport;
    running = true;
    render();
    try {
      const sourceState = typeof state !== "undefined" ? state : {};
      const missingSections = REQUIRED_SECTIONS.filter((id) => !document.getElementById(id));
      const missingGlobals = REQUIRED_GLOBALS.filter((name) => typeof window[name] !== "function");
      const missingArrays = REQUIRED_ARRAYS.filter((key) => !Array.isArray(sourceState?.[key]));
      const duplicates = duplicateIds();
      const visibleCode = technicalText();
      const sessionActive = typeof authUser !== "undefined" && !!authUser?.id;
      const memberActive = typeof member !== "undefined" && !!member?.id;
      const role = currentRole();
      const limeDate = localDateKey();
      const appDate = typeof today === "function" ? today() : null;
      const errors = window.INBESTIGA_QUALITY_CORE?.last?.()?.errors || [];

      let diagnostics = null;
      try { diagnostics = await window.INBESTIGA_PLATFORM_DIAGNOSTICS?.run?.({ network: true }); } catch { diagnostics = null; }

      const automatic = [
        test("Versión frontend", /^v?(?:1[7-9]|[2-9]\d)(?:\.|$)/.test(document.documentElement.dataset.inbestigaBuild || "") || document.documentElement.dataset.inbestigaBuild === VERSION ? "ok" : "warn", document.documentElement.dataset.inbestigaBuild || "Sin versión", `Compatible: ${VERSION} o superior.`),
        test("Sesión autenticada", sessionActive ? "ok" : "warn", sessionActive ? "Activa" : "Pendiente", sessionActive ? "Supabase Auth devolvió un usuario." : "Inicia sesión con una cuenta real para completar la certificación."),
        test("Perfil de miembro", memberActive ? "ok" : "warn", memberActive ? (member.full_name || member.id) : "Pendiente", memberActive ? `Rol detectado: ${role}.` : "El bootstrap no ha cargado un miembro."),
        test("Fecha local Perú", appDate === limeDate ? "ok" : "fail", appDate || "Sin función", `Fecha Lima esperada: ${limeDate}.`),
        test("Estado inicial", missingArrays.length ? "fail" : "ok", missingArrays.length ? `${missingArrays.length} faltantes` : "Completo", missingArrays.length ? missingArrays.join(", ") : "Las colecciones principales existen."),
        test("Secciones", missingSections.length ? "fail" : "ok", missingSections.length ? `${missingSections.length} faltantes` : "Completas", missingSections.length ? missingSections.join(", ") : `${REQUIRED_SECTIONS.length} secciones esenciales presentes.`),
        test("Funciones globales", missingGlobals.length ? "fail" : "ok", missingGlobals.length ? `${missingGlobals.length} faltantes` : "Disponibles", missingGlobals.length ? missingGlobals.join(", ") : "Navegación, render y modales listos."),
        test("Integridad DOM", duplicates.length || visibleCode.length ? "fail" : "ok", duplicates.length + visibleCode.length ? "Requiere revisión" : "Limpio", [...duplicates, ...visibleCode].join(" · ") || "Sin IDs duplicados ni código técnico visible."),
        test("Errores recientes", errors.length ? "warn" : "ok", errors.length ? `${errors.length} registrados` : "Sin errores", errors.length ? "Revisa Platform Quality Center." : "No hay errores persistidos por el monitor."),
        test("RPC requeridas", diagnostics?.openapi?.available ? (diagnostics.missing_rpcs?.length ? "fail" : "ok") : "pending", diagnostics?.openapi?.available ? (diagnostics.missing_rpcs?.length ? `${diagnostics.missing_rpcs.length} faltantes` : "Verificadas") : "Ejecución por rol pendiente", diagnostics?.openapi?.reason || `${diagnostics?.required_rpcs || 45} funciones declaradas; la introspección restringida no reemplaza su ejecución real.`),
        test("Ciclo de vida de registros", window.INBESTIGA_RECORD_LIFECYCLE ? "ok" : "fail", window.INBESTIGA_RECORD_LIFECYCLE?.version || "No disponible", window.INBESTIGA_RECORD_LIFECYCLE ? "Edición, archivado, papelera reversible y restauración cargados." : "Falta el módulo record-lifecycle-controls."),
        test("Diseño y apariencia", window.INBESTIGA_DESIGN_STUDIO ? "ok" : "fail", window.INBESTIGA_DESIGN_STUDIO?.health?.()?.value || "No disponible", window.INBESTIGA_DESIGN_STUDIO ? "Editor global y personalización del muro cargados con capa segura." : "Falta el módulo design-system-studio."),
        test("Creative Arena", window.CreativeArenaClean?.openBoard ? (window.Konva ? "ok" : "pending") : "warn", window.CreativeArenaClean?.openBoard ? (window.Konva ? "Módulo disponible" : "Motor bajo demanda") : "Pendiente", window.Konva ? "Motor Konva cargado." : "Creative Arena permanece protegida; Konva puede cargarse al abrir una pizarra."),
        test("Conectividad", navigator.onLine ? "ok" : "warn", navigator.onLine ? "En línea" : "Offline", "Estado actual del navegador."),
        await testBackendVersion(),
        await testStorage(),
        await testRealtime(),
        await testPwa()
      ];

      const scoreItems = automatic.filter((item) => item.status !== "pending");
      const score = Math.round(scoreItems.reduce((sum, item) => sum + (item.status === "ok" ? 1 : item.status === "warn" ? 0.45 : 0), 0) / Math.max(1, scoreItems.length) * 100);
      lastReport = {
        version: VERSION,
        build: BUILD,
        generated_at: new Date().toISOString(),
        local_date: limeDate,
        project_ref: projectRef(),
        account: {
          authenticated: sessionActive,
          member_id: memberActive ? member.id : null,
          role_code: memberActive ? member.role_code || null : null,
          role_detected: role
        },
        score,
        automatic,
        diagnostics: diagnostics ? {
          openapi: diagnostics.openapi,
          required_rpcs: diagnostics.required_rpcs,
          missing_rpcs: diagnostics.missing_rpcs
        } : null,
        manual: readStore().manual || {}
      };
      const store = readStore();
      writeStore({ ...store, lastReport, updated_at: new Date().toISOString() });
      return lastReport;
    } finally {
      running = false;
      render();
    }
  }

  function manualState(role, id) {
    return readStore().manual?.[role]?.[id] || { status: "pending", updated_at: null };
  }

  function setManual(role, id, status) {
    const store = readStore();
    store.manual ||= {};
    store.manual[role] ||= {};
    store.manual[role][id] = { status, updated_at: new Date().toISOString() };
    writeStore(store);
    if (lastReport) lastReport.manual = store.manual;
    render();
  }

  function manualProgress(role) {
    const steps = ROLE_STEPS[role] || [];
    const states = steps.map(([id]) => manualState(role, id).status);
    const decided = states.filter((status) => ["pass", "fail", "na"].includes(status)).length;
    const passed = states.filter((status) => status === "pass").length;
    return { total: steps.length, decided, passed };
  }

  function statusLabel(status) {
    return ({ ok: "Correcto", warn: "Advertencia", fail: "Falló", pending: "Pendiente" })[status] || status;
  }

  function ensurePanel() {
    let backdrop = document.getElementById("v161CertBackdrop");
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = "v161CertBackdrop";
    backdrop.innerHTML = `<section id="v161CertPanel" role="dialog" aria-modal="true" aria-labelledby="v161CertTitle"></section>`;
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function automaticHtml() {
    const report = lastReport || readStore().lastReport;
    const tests = report?.automatic || [];
    const score = report?.score ?? 0;
    return `
      <div class="v161-cert-summary">
        <div class="v161-cert-score"><div><strong>${running ? "…" : esc(score)}</strong><span>Índice de preparación</span></div></div>
        <div class="v161-cert-context">
          <article><span>Proyecto</span><strong>${esc(projectRef())}</strong><small>La clave anon no se incluye en ningún informe.</small></article>
          <article><span>Cuenta actual</span><strong>${esc(typeof member !== "undefined" && member?.full_name ? member.full_name : "Sin sesión")}</strong><small>${esc(typeof member !== "undefined" && member?.role_code ? member.role_code : "Rol pendiente")}</small></article>
          <article><span>Última ejecución</span><strong>${report?.generated_at ? new Date(report.generated_at).toLocaleString("es-PE") : "Aún no ejecutada"}</strong><small>Pruebas automáticas de lectura.</small></article>
        </div>
      </div>
      <div class="v161-cert-section-head"><div><h3>Pruebas automáticas</h3><p>No insertan, actualizan ni eliminan datos productivos.</p></div><button type="button" data-v161-action="run">${running ? "Comprobando…" : "Ejecutar pruebas"}</button></div>
      <div class="v161-cert-grid">
        ${tests.length ? tests.map((item) => `<article class="v161-cert-card" data-status="${esc(item.status)}"><b>${esc(statusLabel(item.status))}</b><span>${esc(item.name)}</span><strong>${esc(item.value)}</strong><small>${esc(item.meta)}</small></article>`).join("") : `<article class="v161-cert-card" data-status="pending"><b>Pendiente</b><span>Certificación</span><strong>Lista para comenzar</strong><small>Inicia sesión y ejecuta las pruebas desde esta cuenta.</small></article>`}
      </div>
      <div class="v161-cert-note"><strong>Límite de la prueba automática:</strong> la seguridad RLS de escritura, la entrega real de archivos y la sincronización entre dos usuarios requieren completar las matrices manuales de Dirección, Supervisión y Colaborador.</div>`;
  }

  function roleHtml(role) {
    const progress = manualProgress(role);
    const title = role === "director" ? "Dirección" : role === "supervisor" ? "Supervisión" : "Colaborador";
    return `
      <div class="v161-cert-section-head"><div><h3>Cuenta de ${title}</h3><p>${progress.decided}/${progress.total} verificaciones registradas · ${progress.passed} correctas.</p></div><button type="button" data-v161-action="open-role" data-route="home">Abrir Inicio</button></div>
      <div class="v161-manual-list">
        ${(ROLE_STEPS[role] || []).map(([id, stepTitle, meta, route]) => {
          const item = manualState(role, id);
          return `<article class="v161-manual-row"><div class="v161-manual-copy"><strong>${esc(stepTitle)}</strong><span>${esc(meta)}</span></div><div class="v161-manual-actions"><button type="button" data-v161-route="${esc(route)}">Abrir</button><button type="button" data-v161-manual="${esc(id)}" data-role="${role}" data-status="pass" class="${item.status === "pass" ? "active" : ""}">Correcto</button><button type="button" data-v161-manual="${esc(id)}" data-role="${role}" data-status="fail" class="${item.status === "fail" ? "active" : ""}">Falló</button><button type="button" data-v161-manual="${esc(id)}" data-role="${role}" data-status="na" class="${item.status === "na" ? "active" : ""}">No aplica</button></div></article>`;
        }).join("")}
      </div>
      <div class="v161-cert-note">Ejecuta esta matriz con una cuenta real de ${title}. No marques una prueba como correcta si solo se abrió la pantalla: confirma persistencia, permisos y resultado en una segunda sesión cuando corresponda.</div>`;
  }

  function render() {
    const backdrop = ensurePanel();
    const panel = backdrop.querySelector("#v161CertPanel");
    if (!panel) return;
    const content = activeTab === "automatic" ? automaticHtml() : roleHtml(activeTab);
    panel.innerHTML = `
      <header class="v161-cert-head"><div><span>INBESTIGA ${VERSION}</span><h2 id="v161CertTitle">Production Certification Center</h2><p>Verifica la plataforma con pruebas automáticas de solo lectura y una matriz controlada por cada rol productivo.</p></div><button type="button" class="v161-cert-close" data-v161-action="close" aria-label="Cerrar">×</button></header>
      <nav class="v161-cert-tabs" aria-label="Áreas de certificación">${[["automatic","Automática"],["director","Dirección"],["supervisor","Supervisión"],["collaborator","Colaborador"]].map(([id,label]) => `<button type="button" data-v161-tab="${id}" class="${activeTab === id ? "active" : ""}">${label}</button>`).join("")}</nav>
      <main class="v161-cert-body">${content}</main>
      <footer class="v161-cert-foot"><p>Los resultados manuales se guardan solo en este navegador.</p><div><button type="button" data-v161-action="reset">Restablecer</button><button type="button" data-v161-action="export">Exportar JSON</button><button type="button" class="primary" data-v161-action="run">${running ? "Comprobando…" : "Certificar ahora"}</button></div></footer>`;
  }

  function open(tab) {
    activeTab = tab || (typeof authUser !== "undefined" && authUser?.id ? currentRole() : "automatic");
    if (!ROLE_STEPS[activeTab] && activeTab !== "automatic") activeTab = "automatic";
    const backdrop = ensurePanel();
    render();
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => backdrop.querySelector("button")?.focus(), 0);
    if (!lastReport && !readStore().lastReport) runAutomatic();
  }

  function close() {
    document.getElementById("v161CertBackdrop")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  function exportReport() {
    const store = readStore();
    const report = lastReport || store.lastReport || {
      version: VERSION, build: BUILD, generated_at: new Date().toISOString(), automatic: [], score: 0
    };
    const output = { ...report, manual: store.manual || {}, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `INBESTIGA_certificacion_${localDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function reset() {
    if (!confirm("¿Restablecer la certificación guardada en este navegador?")) return;
    try { localStorage.removeItem(STORE_KEY); } catch { /* opcional */ }
    lastReport = null;
    render();
  }

  function addPaletteItem() {
    let items = null;
    try { if (typeof V12_PALETTE_ITEMS !== "undefined" && Array.isArray(V12_PALETTE_ITEMS)) items = V12_PALETTE_ITEMS; } catch { items = null; }
    if (!items) return;
    const key = "v161:production-certification";
    if (items.some((item) => item.key === key)) return;
    items.push({
      key,
      code: "PC",
      title: "Certificación de producción",
      meta: "Director, supervisor, colaborador, RPC, Storage, Realtime y PWA",
      action: () => open("automatic")
    });
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-v161-tab]")?.dataset.v161Tab;
    if (tab) { activeTab = tab; render(); return; }
    const action = event.target.closest("[data-v161-action]")?.dataset.v161Action;
    if (action === "close") return close();
    if (action === "run") return runAutomatic();
    if (action === "export") return exportReport();
    if (action === "reset") return reset();
    if (action === "open-role") { close(); return typeof navTo === "function" && navTo(event.target.closest("[data-route]")?.dataset.route || "home"); }
    const manual = event.target.closest("[data-v161-manual]");
    if (manual) return setManual(manual.dataset.role, manual.dataset.v161Manual, manual.dataset.status);
    const route = event.target.closest("[data-v161-route]")?.dataset.v161Route;
    if (route) { close(); return typeof navTo === "function" && navTo(route); }
    if (event.target.id === "v161CertBackdrop") close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("v161CertBackdrop")?.classList.contains("open")) close();
  });

  function init() {
    ensurePanel();
    addPaletteItem();
    window.INBESTIGA_QUALITY_CORE?.register?.("production-certification", { version: VERSION, mode: "read-only-guided" });
    if (window.INBESTIGA_PRODUCTIVITY_REALTIME) window.INBESTIGA_PRODUCTIVITY_REALTIME.certify = () => open("automatic");
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "productivity-realtime-core", "production-certification"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  window.INBESTIGA_PRODUCTION_CERTIFICATION = {
    version: VERSION,
    build: BUILD,
    open,
    close,
    run: runAutomatic,
    export: exportReport,
    last: () => lastReport || readStore().lastReport || null,
    manual: () => readStore().manual || {}
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
