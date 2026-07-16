/* ===== v17.5.3 AUDIT COUNTER ACCURACY ===== */
(() => {
  "use strict";

  const VERSION = "v17.5.3";
  const BUILD = "AUDIT COUNTER ACCURACY";
  const FILTER_LABELS = {
    "backend-all": "Eventos backend",
    "backend-warning": "Advertencias backend",
    "backend-error": "Errores backend",
    "browser-error": "Errores del navegador",
    "session-all": "Eventos de sesión",
    "session-error": "Renders fallidos"
  };

  let activeFilter = "backend-all";
  let wrapped = false;

  const array = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? "");
  const safeDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString("es-PE");
  };
  const escapeHtml = (value) => text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function sourceState() {
    return typeof state === "object" && state ? state : {};
  }

  function sourceSession() {
    return typeof v414Perf === "object" && v414Perf ? array(v414Perf.audit) : [];
  }

  function severityOf(row) {
    const value = text(row?.severity || row?.level || row?.status || "info").trim().toLowerCase();
    if (/^(error|fatal|critical)$/.test(value) || value.includes("error") || value.includes("fatal") || value.includes("critical")) return "error";
    if (/^(warn|warning)$/.test(value) || value.includes("warn")) return "warning";
    return "info";
  }

  function actorName(id) {
    try {
      if (typeof memberName === "function") return memberName(id);
    } catch (_) {}
    return id ? text(id) : "Usuario";
  }

  function dataSet() {
    const current = sourceState();
    const backend = array(current.audit_logs);
    const browser = array(current.client_errors);
    const session = sourceSession();
    return {
      backend,
      browser,
      session,
      backendWarnings: backend.filter((row) => severityOf(row) === "warning"),
      backendErrors: backend.filter((row) => severityOf(row) === "error"),
      sessionErrors: session.filter((row) => text(row?.type).toLowerCase() === "error")
    };
  }

  function normalizeBackend(row) {
    return {
      origin: "backend",
      at: row?.created_at || row?.at || "",
      module: row?.module || row?.entity_type || "",
      action: row?.action || row?.event_type || "",
      actor: actorName(row?.actor_id),
      severity: severityOf(row),
      message: row?.message || row?.description || "",
      details: row?.details || {}
    };
  }

  function normalizeBrowser(row) {
    return {
      origin: "navegador",
      at: row?.created_at || row?.at || "",
      module: row?.module || row?.context || row?.source || "app",
      action: row?.action || row?.event_type || "error cliente",
      actor: actorName(row?.actor_id),
      severity: "error",
      message: row?.message || row?.error_message || "",
      details: row?.details || row?.metadata || {}
    };
  }

  function normalizeSession(row) {
    const isError = text(row?.type).toLowerCase() === "error";
    let actor = "Usuario";
    try {
      if (typeof member === "object" && member) actor = member.full_name || member.name || "Usuario";
    } catch (_) {}
    return {
      origin: "sesión local",
      at: row?.at || "",
      module: "sesión local",
      action: [row?.type, row?.label].filter(Boolean).join(" · "),
      actor,
      severity: isError ? "error" : "info",
      message: row?.detail || "",
      details: {}
    };
  }

  function rowsFor(filter = activeFilter) {
    const data = dataSet();
    if (filter === "backend-warning") return data.backendWarnings.map(normalizeBackend);
    if (filter === "backend-error") return data.backendErrors.map(normalizeBackend);
    if (filter === "browser-error") return data.browser.map(normalizeBrowser);
    if (filter === "session-all") return data.session.slice().reverse().map(normalizeSession);
    if (filter === "session-error") return data.sessionErrors.slice().reverse().map(normalizeSession);
    return data.backend.map(normalizeBackend);
  }

  function card(filter, label, value, tone = "neutral", help = "") {
    const active = filter === activeFilter ? " is-active" : "";
    return `<button type="button" class="v1753-audit-card${active}" data-v1753-audit-filter="${escapeHtml(filter)}" data-tone="${escapeHtml(tone)}" aria-pressed="${filter === activeFilter}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(help)}</small>
    </button>`;
  }

  function renderSummary() {
    const host = document.getElementById("v414AuditSummary");
    if (!host) return;
    const data = dataSet();
    host.classList.add("v1753-audit-summary");
    host.innerHTML = [
      card("backend-all", "Eventos backend", data.backend.length, "neutral", "Registros recibidos"),
      card("backend-warning", "Advertencias backend", data.backendWarnings.length, data.backendWarnings.length ? "warning" : "ok", "Severidad warning"),
      card("backend-error", "Errores backend", data.backendErrors.length, data.backendErrors.length ? "error" : "ok", "Solo severidad error"),
      card("browser-error", "Errores navegador", data.browser.length, data.browser.length ? "warning" : "ok", "Historial independiente"),
      card("session-all", "Eventos sesión", data.session.length, "neutral", "Actividad de esta pestaña"),
      card("session-error", "Renders fallidos", data.sessionErrors.length, data.sessionErrors.length ? "error" : "ok", "Errores locales actuales")
    ].join("");
  }

  function severityBadge(value) {
    const severity = value === "warning" || value === "error" ? value : "info";
    return `<span class="v1753-severity" data-severity="${severity}">${escapeHtml(severity)}</span>`;
  }

  function renderDetail() {
    const host = document.getElementById("auditProList");
    if (!host) return;
    const panel = host.closest(".panel");
    const title = panel?.querySelector("h3");
    if (title) title.textContent = `Detalle filtrado · ${FILTER_LABELS[activeFilter] || "Auditoría"}`;

    const rows = rowsFor(activeFilter);
    const visible = rows.slice(0, 250);
    host.innerHTML = `<div class="v1753-audit-filter-note">
        <div><strong>${escapeHtml(FILTER_LABELS[activeFilter] || "Auditoría")}</strong><span>${rows.length} registro${rows.length === 1 ? "" : "s"}. Los errores backend se cuentan únicamente cuando la severidad es error; el límite de consulta no se usa como contador.</span></div>
        <button type="button" class="ghost" data-v1753-audit-filter="backend-all">Ver todos los eventos</button>
      </div>
      <div class="table-wrap"><table class="table v1753-audit-table"><thead><tr><th>Fecha</th><th>Origen</th><th>Módulo</th><th>Acción</th><th>Actor</th><th>Severidad</th><th>Mensaje</th></tr></thead><tbody>
      ${visible.map((row) => `<tr><td>${escapeHtml(safeDate(row.at))}</td><td>${escapeHtml(row.origin)}</td><td>${escapeHtml(row.module)}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(row.actor)}</td><td>${severityBadge(row.severity)}</td><td>${escapeHtml(row.message)}</td></tr>`).join("") || `<tr><td colspan="7"><div class="v1753-empty">No hay registros en este filtro.</div></td></tr>`}
      </tbody></table></div>${rows.length > visible.length ? `<p class="small v1753-limit-note">Se muestran los primeros ${visible.length} de ${rows.length} registros.</p>` : ""}`;
  }

  function browserKey(row) {
    return [row?.module || row?.context || row?.source || "app", row?.action || "", row?.message || row?.error_message || ""].map(text).join("\u241f");
  }

  function renderBrowserGroups() {
    const host = document.getElementById("clientErrorList");
    if (!host) return;
    const panel = host.closest(".panel");
    const title = panel?.querySelector("h3");
    if (title) title.textContent = "Errores del navegador · historial independiente";

    const errors = dataSet().browser;
    const groups = new Map();
    errors.forEach((row) => {
      const key = browserKey(row);
      const current = groups.get(key) || { row, count: 0, lastAt: "" };
      current.count += 1;
      const at = row?.created_at || row?.at || "";
      if (!current.lastAt || text(at) > text(current.lastAt)) {
        current.lastAt = at;
        current.row = row;
      }
      groups.set(key, current);
    });
    const grouped = Array.from(groups.values()).sort((a, b) => text(b.lastAt).localeCompare(text(a.lastAt)));
    host.innerHTML = `<div class="v1753-browser-note">Estos registros no se suman a <strong>Errores backend</strong>. Se agrupan por módulo, acción y mensaje para distinguir repeticiones.</div>${grouped.slice(0, 100).map(({ row, count, lastAt }) => `<article class="error-row v1753-error-group"><div class="v1753-error-heading"><strong>${escapeHtml(row?.module || row?.context || row?.source || "app")} · ${escapeHtml(row?.action || "error cliente")}</strong><span>${count} vez${count === 1 ? "" : "es"}</span></div><p>${escapeHtml(row?.message || row?.error_message || "Sin mensaje")}</p><span class="small">Último registro: ${escapeHtml(safeDate(lastAt))} · ${escapeHtml(actorName(row?.actor_id))}</span></article>`).join("") || "<p>Sin errores registrados por el navegador.</p>"}`;
  }

  function csvSafe(value) {
    let result = typeof value === "object" && value !== null ? JSON.stringify(value) : text(value);
    if (/^[=+\-@]/.test(result)) result = `'${result}`;
    return `"${result.replaceAll('"', '""')}"`;
  }

  function download(name, rows) {
    const content = "\ufeff" + rows.map((row) => row.map(csvSafe).join(",")).join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
    anchor.remove();
  }

  function exportRows(kind) {
    const data = dataSet();
    let rows = [];
    let name = "auditoria_eventos_inbestiga.csv";
    if (kind === "warnings") {
      name = "auditoria_advertencias_inbestiga.csv";
      rows = data.backendWarnings.map(normalizeBackend);
    } else if (kind === "errors") {
      name = "auditoria_errores_inbestiga.csv";
      rows = [
        ...data.backendErrors.map(normalizeBackend),
        ...data.browser.map(normalizeBrowser),
        ...data.sessionErrors.map(normalizeSession)
      ];
    } else {
      rows = [...data.backend.map(normalizeBackend), ...data.session.map(normalizeSession)];
    }
    download(name, [
      ["Fecha", "Origen", "Módulo", "Acción", "Actor", "Severidad", "Mensaje", "Detalle"],
      ...rows.map((row) => [row.at, row.origin, row.module, row.action, row.actor, row.severity, row.message, row.details])
    ]);
  }

  function installExports() {
    const section = document.getElementById("auditpro");
    const header = section?.querySelector(":scope > .module-title");
    const original = document.getElementById("exportAuditBtn");
    if (!header || !original) return;

    let actions = document.getElementById("v1753AuditExports");
    if (!actions) {
      actions = document.createElement("div");
      actions.id = "v1753AuditExports";
      actions.className = "v1753-audit-exports";
      original.insertAdjacentElement("beforebegin", actions);
      actions.appendChild(original);
      actions.insertAdjacentHTML("beforeend", `<button type="button" class="ghost" id="v1753ExportWarnings">Exportar advertencias</button><button type="button" class="ghost" id="v1753ExportErrors">Exportar errores</button>`);
    }
    original.textContent = "Exportar eventos";
    original.onclick = () => exportRows("events");
    document.getElementById("v1753ExportWarnings").onclick = () => exportRows("warnings");
    document.getElementById("v1753ExportErrors").onclick = () => exportRows("errors");
  }

  function render() {
    renderSummary();
    renderDetail();
    renderBrowserGroups();
    installExports();
  }

  function setFilter(filter) {
    if (!FILTER_LABELS[filter]) return;
    activeFilter = filter;
    renderSummary();
    renderDetail();
    const detail = document.getElementById("auditProList");
    detail?.closest(".panel")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function wrapRenderer() {
    if (wrapped || typeof window.renderAuditPro !== "function") return;
    const base = window.renderAuditPro;
    const enhanced = function () {
      const result = base.apply(this, arguments);
      render();
      return result;
    };
    enhanced.__v1753Wrapped = true;
    enhanced.__v1753Base = base;
    window.renderAuditPro = enhanced;
    wrapped = true;
  }

  function init() {
    wrapRenderer();
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-v1753-audit-filter]");
      if (!button) return;
      event.preventDefault();
      setFilter(button.dataset.v1753AuditFilter);
    });
    render();
    window.INBESTIGA_QUALITY_CORE?.register?.("audit-counter-accuracy", { version: VERSION, mode: "read-only-audit-ui" });
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "audit-counter-accuracy"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  window.INBESTIGA_AUDIT_ACCURACY = {
    version: VERSION,
    build: BUILD,
    render,
    setFilter,
    counts: () => {
      const data = dataSet();
      return {
        backend_events: data.backend.length,
        backend_warnings: data.backendWarnings.length,
        backend_errors: data.backendErrors.length,
        browser_errors: data.browser.length,
        session_events: data.session.length,
        failed_renders: data.sessionErrors.length
      };
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
