/* ===== RUNTIME-AWARE AUDIT HEALTH INTEGRATION · v17.12.13.4 ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_AUDIT_HEALTH) return;

  const VERSION = window.INBESTIGA_PUBLIC_RUNTIME_CONFIG?.version || document.documentElement.dataset.inbestigaBuild || "v17.12.13.4";
  const BUILD = "AUDIT HEALTH · MANAGED ACCESS & PWA ALIGNMENT";
  const MOUNT_ID = "v172AuditHealthMount";
  const STALE_MS = 10 * 60 * 1000;
  const ESSENTIAL_CHECKS = [
    ["supabase", "Supabase"],
    ["rpc-openapi", "RPC"],
    ["storage", "Storage"],
    ["realtime", "Realtime"],
    ["pwa", "PWA"],
    ["work360-cloud", "Work 360"]
  ];

  let refreshPromise = null;
  let wrapped = false;
  let autoRefreshAttemptedAt = 0;
  let auditObserver = null;
  let repairTimer = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function healthApi() {
    return window.INBESTIGA_SYSTEM_HEALTH || null;
  }

  function authorized() {
    try { return !!healthApi()?.authorized?.(); } catch { return false; }
  }

  function report() {
    try { return healthApi()?.last?.() || null; } catch { return null; }
  }

  function statusText(status) {
    return ({ ok: "Saludable", warn: "Advertencia", fail: "Crítico", info: "Pendiente" })[status] || "Pendiente";
  }

  function formatDate(value, fallback = "Aún no comprobado") {
    if (!value) return fallback;
    try {
      return new Date(value).toLocaleString("es-PE", {
        timeZone: "America/Lima", day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return String(value); }
  }

  function checkById(currentReport, id) {
    const checks = Array.isArray(currentReport?.checks) ? currentReport.checks : [];
    return checks.find((item) => item?.id === id) || null;
  }

  function issueCounts(currentReport) {
    const checks = Array.isArray(currentReport?.checks) ? currentReport.checks : [];
    return {
      fail: checks.filter((item) => item?.status === "fail").length,
      warn: checks.filter((item) => item?.status === "warn").length
    };
  }

  function ensureMount() {
    const section = document.getElementById("auditpro");
    if (!section) return null;
    let mount = document.getElementById(MOUNT_ID);
    const summary = document.getElementById("v414AuditSummary");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = MOUNT_ID;
      mount.setAttribute("aria-live", "polite");
    }
    if (mount.parentNode !== section) {
      if (summary?.parentNode === section) section.insertBefore(mount, summary);
      else section.prepend(mount);
    } else if (summary?.parentNode === section && mount.nextElementSibling !== summary) {
      section.insertBefore(mount, summary);
    }
    return mount;
  }

  function restrictedHtml() {
    return `<section class="v172-audit-health v172-restricted" aria-label="Salud del sistema">
      <div class="v172-health-copy">
        <span class="v172-eyebrow">SALUD DEL SISTEMA</span>
        <h3>Resumen técnico reservado a Dirección</h3>
        <p>Auditoría conserva los eventos y errores visibles para tu rol. El diagnóstico de Supabase, RPC, Storage, Realtime, PWA y Work 360 requiere acceso de Dirección o administración.</p>
      </div>
      <span class="v172-restricted-badge">Acceso restringido</span>
    </section>`;
  }

  function serviceHtml(currentReport, id, label) {
    const item = checkById(currentReport, id);
    const status = item?.status || "info";
    const value = item?.value || "Pendiente";
    return `<article class="v172-service" data-status="${esc(status)}" title="${esc(item?.detail || "Ejecuta una comprobación de salud.")}">
      <i aria-hidden="true"></i><div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>
    </article>`;
  }

  function dashboardHtml(currentReport) {
    const overall = currentReport?.overall || { status: "info", title: "Aún no comprobado", score: 0, message: "Ejecuta la primera lectura de salud." };
    const counts = issueCounts(currentReport);
    const firstWarning = (currentReport?.checks || []).find((item) => item?.status === "warn");
    const rpc = currentReport?.rpc || {};
    const rpcValue = rpc.verified ? `${rpc.available_count ?? 0}/${rpc.required_count || 45}` : "Pendiente";
    const lastCheck = formatDate(currentReport?.generated_at);
    const busy = !!refreshPromise;
    return `<section class="v172-audit-health" data-status="${esc(overall.status || "info")}" aria-label="Resumen de salud del sistema">
      <div class="v172-health-top">
        <div class="v172-score" data-status="${esc(overall.status || "info")}"><strong>${esc(overall.score ?? 0)}</strong><span>salud</span></div>
        <div class="v172-health-copy">
          <span class="v172-eyebrow">SALUD DEL SISTEMA · SOLO LECTURA</span>
          <div class="v172-title-row"><h3>${esc(overall.title || "Aún no comprobado")}</h3><span class="v172-state" data-status="${esc(overall.status || "info")}"><i></i>${esc(statusText(overall.status))}</span></div>
          <p>${esc(overall.message || "Ejecuta la primera lectura de salud.")}</p>
          <small>Última comprobación: ${esc(lastCheck)}</small>
        </div>
        <div class="v172-health-actions">
          <button type="button" class="ghost" data-v172-health-action="open">Ver diagnóstico completo</button>
          <button type="button" class="primary" data-v172-health-action="run" ${busy ? "disabled" : ""}>${busy ? "Comprobando…" : "Comprobar salud"}</button>
        </div>
      </div>
      <div class="v172-health-metrics">
        <article><span>RPC publicadas</span><strong>${esc(rpcValue)}</strong><small>${rpc.verified ? "Presencia OpenAPI" : "No certificadas"}</small></article>
        <article><span>Fallas</span><strong>${esc(counts.fail)}</strong><small>${counts.fail ? "Requieren atención" : "Sin fallas detectadas"}</small></article>
        <article><span>Advertencias</span><strong>${esc(counts.warn)}</strong><small>${counts.warn ? esc(firstWarning?.label || "Validación pendiente") : "Sin advertencias"}</small></article>
      </div>
      <div class="v172-services">${ESSENTIAL_CHECKS.map(([id, label]) => serviceHtml(currentReport, id, label)).join("")}</div>
      <div class="v172-health-footnote"><strong>Alcance:</strong> esta lectura confirma disponibilidad técnica de forma no destructiva; no certifica RLS de escritura, persistencia entre cuentas ni operaciones reales de Storage.</div>
    </section>`;
  }

  function render() {
    const mount = ensureMount();
    if (!mount) return;
    mount.innerHTML = authorized() ? dashboardHtml(report()) : restrictedHtml();
  }

  async function refresh({ silent = false } = {}) {
    if (!authorized()) return null;
    const api = healthApi();
    if (!api?.run) return null;
    if (refreshPromise) return refreshPromise;
    refreshPromise = Promise.resolve(api.run()).catch((error) => {
      if (!silent) {
        try {
          if (typeof premiumToast === "function") premiumToast("No se pudo comprobar la salud", error?.message || String(error), "warning");
          else if (typeof toast === "function") toast("No se pudo comprobar la salud", error?.message || String(error));
        } catch { /* sin dependencia de notificaciones */ }
      }
      return null;
    }).finally(() => {
      refreshPromise = null;
      render();
    });
    render();
    return refreshPromise;
  }

  function maybeRefresh() {
    const section = document.getElementById("auditpro");
    if (!section?.classList.contains("active") || !authorized() || refreshPromise) return;
    const now = Date.now();
    if (now - autoRefreshAttemptedAt < 30000) return;
    const current = report();
    const generatedAt = current?.generated_at ? new Date(current.generated_at).getTime() : 0;
    if (generatedAt && now - generatedAt < STALE_MS) return;
    autoRefreshAttemptedAt = now;
    refresh({ silent: true });
  }

  function wrapAuditRenderer() {
    if (wrapped || typeof window.renderAuditPro !== "function") return;
    const base = window.renderAuditPro;
    window.renderAuditPro = function () {
      const result = base.apply(this, arguments);
      render();
      maybeRefresh();
      return result;
    };
    wrapped = true;
  }

  function installPersistenceGuard() {
    const section = document.getElementById("auditpro");
    if (!section) return;
    if (!auditObserver && typeof MutationObserver === "function") {
      auditObserver = new MutationObserver(() => {
        const mount = document.getElementById(MOUNT_ID);
        if (!mount || mount.parentNode !== section) requestAnimationFrame(render);
      });
      auditObserver.observe(section, { childList: true });
    }
    if (!repairTimer) {
      repairTimer = window.setInterval(() => {
        if (!document.getElementById("auditpro")?.classList.contains("active")) return;
        const mount = document.getElementById(MOUNT_ID);
        if (!mount || !mount.firstElementChild) render();
      }, 1500);
    }
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-v172-health-action]")?.dataset.v172HealthAction;
    if (action === "open") healthApi()?.open?.("summary");
    if (action === "run") refresh();
  });

  window.addEventListener("inbestiga:system-health-updated", render);
  window.addEventListener("online", () => {
    if (document.getElementById("auditpro")?.classList.contains("active")) render();
  });
  window.addEventListener("offline", render);

  function init() {
    ensureMount();
    wrapAuditRenderer();
    installPersistenceGuard();
    render();
    requestAnimationFrame(render);
    window.setTimeout(() => { wrapAuditRenderer(); render(); }, 250);
    if (document.getElementById("auditpro")?.classList.contains("active")) maybeRefresh();
    window.INBESTIGA_QUALITY_CORE?.register?.("audit-health-integration", { version: VERSION, mode: "read-only-director" });
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "audit-health-integration"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  window.INBESTIGA_AUDIT_HEALTH = { version: VERSION, build: BUILD, render, refresh, authorized };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
