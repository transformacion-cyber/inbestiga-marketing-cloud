/* INBESTIGA Marketing Cloud v17.15.2 · Platform Interaction Integrity & Automatic Diagnostics */
(function () {
  "use strict";
  if (window.INBESTIGA_INTERACTION_INTEGRITY) return;

  const VERSION = "v17.15.2";
  const MODULE = "interaction-integrity-v17-15-2";
  const REPORT_KEY = "inbestiga:v17152:integrity-reports";
  const TRASH_KEY = "inbestiga:v17152:integrity-report-trash";
  const ACTIVITY_KEY = "inbestiga:v17152:interaction-activity";
  const MAX_REPORTS = 8;
  const MAX_ACTIVITY = 240;
  const INTERACTIVE_SELECTOR = [
    "button", "a[href]", "input:not([type='hidden'])", "select", "textarea", "summary",
    "[role='button']", "[role='tab']", "[role='menuitem']", "[tabindex]:not([tabindex='-1'])", "[data-section]"
  ].join(",");
  const registry = window.__IB_INTERACTION_REGISTRY || null;
  let currentTab = "summary";
  let lastReport = null;
  let cacheSnapshot = null;
  let running = false;
  let mounted = false;
  let activity = readArray(ACTIVITY_KEY).slice(-MAX_ACTIVITY);

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const list = (value) => Array.isArray(value) ? value : [];
  const now = () => new Date().toISOString();

  function readArray(key) {
    try { const parsed = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  function writeArray(key, value, limit = 100) {
    try { localStorage.setItem(key, JSON.stringify(value.slice(-limit))); } catch { /* almacenamiento opcional */ }
  }
  function safeText(value, limit = 220) {
    if (registry?.safeString) return registry.safeString(value, limit);
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
  }
  function displayDate(value) {
    try { return new Date(value).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return String(value || ""); }
  }
  function toast(title, detail, tone = "success") {
    try {
      if (typeof premiumToast === "function") return premiumToast(title, detail, tone);
      if (typeof window.premiumToast === "function") return window.premiumToast(title, detail, tone);
    } catch { /* usa fallback */ }
    console.info(`[${title}] ${detail}`);
  }
  function confirmAction(message) { try { return window.confirm(message); } catch { return false; } }

  function recordActivity(type, label, detail = "", extra = {}) {
    const item = { id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: now(), type, label: safeText(label, 160), detail: safeText(detail, 240), ...extra };
    activity.push(item);
    while (activity.length > MAX_ACTIVITY) activity.shift();
    writeArray(ACTIVITY_KEY, activity, MAX_ACTIVITY);
    if (mounted && currentTab === "history") render();
    return item;
  }

  function controlText(element) {
    if (!element) return "Elemento";
    const aria = element.getAttribute?.("aria-label") || element.getAttribute?.("title");
    const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    const value = ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName) ? element.getAttribute("name") || element.id || element.getAttribute("placeholder") : "";
    return safeText(aria || text || value || element.id || element.tagName, 120) || element.tagName;
  }
  function sectionFor(element) { return element?.closest?.(".section")?.id || "global"; }
  function activeSection() { return document.querySelector(".section.active")?.id || window.currentSection || "home"; }
  function isElementVisible(element) {
    if (!element?.isConnected) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0.01) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function isInactivePanel(element) {
    const section = element.closest?.(".section");
    return !!section && !section.classList.contains("active");
  }
  function cssEscape(value) { return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/([^a-zA-Z0-9_-])/g, "\\$1"); }
  function selectorFor(element) {
    if (!element || !element.tagName) return "";
    if (element.id && document.querySelectorAll(`#${cssEscape(element.id)}`).length === 1) return `#${cssEscape(element.id)}`;
    for (const attr of ["data-section", "data-action", "data-ska-pane", "data-v14-quality-action", "name", "aria-label"]) {
      const value = element.getAttribute?.(attr);
      if (value) {
        const selector = `${element.tagName.toLowerCase()}[${attr}="${String(value).replaceAll('"', '\\"')}"]`;
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
    }
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const peers = [...parent.children].filter((child) => child.tagName === node.tagName);
        if (peers.length > 1) part += `:nth-of-type(${peers.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(" > ");
  }

  function registeredOn(element, types) { return !!registry?.has?.(element, types); }
  function registeredOnAncestor(element, types) {
    let node = element?.parentElement;
    let depth = 0;
    while (node && depth < 5) {
      if (registeredOn(node, types)) return true;
      node = node.parentElement; depth += 1;
    }
    return false;
  }
  function inlineHandler(element, types) {
    return types.some((type) => typeof element?.[`on${type}`] === "function" || !!element?.getAttribute?.(`on${type}`));
  }
  function nativeAction(element) {
    if (!element) return false;
    if (element.matches("a[href]") && !["", "#", "javascript:void(0)"].includes((element.getAttribute("href") || "").trim())) return true;
    if (element.matches("summary") && element.closest("details")) return true;
    if (element.matches("input[type='checkbox'],input[type='radio'],input[type='file'],input[type='range'],select,textarea,input:not([type])")) return true;
    if (element.matches("button[type='submit'],input[type='submit']") && element.form) return inlineHandler(element.form, ["submit"]) || registeredOn(element.form, ["submit"]);
    return false;
  }
  function delegatedSignature(element) {
    const attributes = [...(element?.attributes || [])].map((attr) => attr.name);
    return attributes.some((name) => /^data-(action|section|route|tab|pane|.*-action|.*-id|v\d+)/.test(name));
  }
  function interactionStatus(element) {
    const tag = element.tagName;
    const types = tag === "FORM" ? ["submit"] : tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" ? ["change", "input", "click"] : ["click", "keydown"];
    if (inlineHandler(element, types)) return { wired: true, proof: "handler directo" };
    if (registeredOn(element, types)) return { wired: true, proof: "listener registrado" };
    if (nativeAction(element)) return { wired: true, proof: "comportamiento nativo" };
    if (delegatedSignature(element) && (registeredOnAncestor(element, types) || registeredOn(document, types) || registeredOn(document.body, types))) return { wired: true, proof: "delegación registrada" };
    if (element.matches(".nav-leaf[data-section]") && typeof window.navTo === "function") return { wired: true, proof: "navegación navTo" };
    return { wired: false, proof: "sin evidencia de acción" };
  }

  function rgb(value) {
    const match = String(value || "").match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] == null ? 1 : Number(match[4]) };
  }
  function luminance(color) {
    const convert = (channel) => { const c = channel / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * convert(color.r) + 0.7152 * convert(color.g) + 0.0722 * convert(color.b);
  }
  function contrastRatio(a, b) {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function effectiveBackground(element) {
    let node = element;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") return null;
      const color = rgb(style.backgroundColor);
      if (color && color.a >= 0.92) return color;
    }
    return rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  }
  function contrastCheck(element) {
    const text = (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 180) return null;
    const style = getComputedStyle(element);
    const foreground = rgb(style.color);
    const background = effectiveBackground(element);
    if (!foreground || !background) return null;
    const size = Number.parseFloat(style.fontSize) || 16;
    const weight = Number.parseInt(style.fontWeight, 10) || 400;
    const threshold = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const ratio = contrastRatio(foreground, background);
    return { ratio, threshold, ok: ratio + 0.05 >= threshold };
  }
  function accessibleName(element) {
    if (!element) return "";
    const labelled = element.getAttribute("aria-labelledby");
    if (labelled) return labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
    return (element.getAttribute("aria-label") || element.getAttribute("title") || element.innerText || element.textContent || element.value || "").replace(/\s+/g, " ").trim();
  }
  function labelForInput(element) {
    if (!element?.matches("input,select,textarea")) return true;
    if (element.type === "hidden" || element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.getAttribute("title")) return true;
    if (element.id && document.querySelector(`label[for="${cssEscape(element.id)}"]`)) return true;
    return !!element.closest("label");
  }
  function coveredAtCenter(element) {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null;
    const top = document.elementFromPoint(x, y);
    if (!top || top === element || element.contains(top) || top.contains(element)) return null;
    return top;
  }
  function issue(id, severity, category, title, detail, element = null, extra = {}) {
    return {
      id, severity, category, title, detail, selector: element ? selectorFor(element) : "",
      section: element ? sectionFor(element) : extra.section || "global", control: element ? controlText(element) : extra.control || "",
      ...extra
    };
  }

  function scanControls() {
    const controls = [...new Set(document.querySelectorAll(INTERACTIVE_SELECTOR))].filter((element) => !element.closest("#v17152IntegrityMount"));
    const issues = [];
    const stats = { total: controls.length, wired: 0, unwired: 0, visible: 0, hidden: 0, disabled: 0, lowContrast: 0, covered: 0, smallTargets: 0, unnamed: 0 };
    controls.forEach((element, index) => {
      const visible = isElementVisible(element) && !isInactivePanel(element);
      if (visible) stats.visible += 1; else stats.hidden += 1;
      if (element.disabled || element.getAttribute("aria-disabled") === "true") stats.disabled += 1;
      const status = interactionStatus(element);
      if (status.wired) stats.wired += 1; else {
        stats.unwired += 1;
        if (element.matches("button,[role='button'],[role='tab'],[role='menuitem'],a[href]") && !element.disabled) {
          issues.push(issue(`unwired_${index}`, isInactivePanel(element) ? "warn" : "fail", "events", isInactivePanel(element) ? "Control no verificable hasta abrir el panel" : "Control sin acción comprobable", `${controlText(element)} no expone listener, handler, navegación ni comportamiento nativo${isInactivePanel(element) ? " en el estado inactivo actual" : ""}.`, element, { proof: status.proof }));
        }
      }
      if (!visible) return;
      const style = getComputedStyle(element);
      if (style.pointerEvents === "none" && !element.disabled) issues.push(issue(`pointer_${index}`, "fail", "layout", "Control bloqueado por CSS", "El elemento está visible, pero pointer-events impide interactuar.", element));
      if (!accessibleName(element) && element.matches("button,[role='button'],[role='tab'],a[href]")) {
        stats.unnamed += 1;
        issues.push(issue(`name_${index}`, "warn", "accessibility", "Control sin nombre accesible", "Añade texto visible, aria-label o aria-labelledby.", element));
      }
      if (!labelForInput(element)) issues.push(issue(`label_${index}`, "warn", "accessibility", "Campo sin etiqueta asociada", "El campo necesita label, aria-label o aria-labelledby.", element));
      const contrast = contrastCheck(element);
      if (contrast && !contrast.ok) {
        stats.lowContrast += 1;
        issues.push(issue(`contrast_${index}`, contrast.ratio < 2.2 ? "fail" : "warn", "contrast", "Contraste de texto insuficiente", `Relación ${contrast.ratio.toFixed(2)}:1; se requiere al menos ${contrast.threshold}:1.`, element, { ratio: contrast.ratio }));
      }
      const rect = element.getBoundingClientRect();
      if (element.matches("button,a[href],[role='button'],[role='tab'],input,select") && (rect.width < 40 || rect.height < 40)) {
        stats.smallTargets += 1;
        issues.push(issue(`target_${index}`, "warn", "mobile", "Área táctil pequeña", `${Math.round(rect.width)} × ${Math.round(rect.height)} px; se recomiendan al menos 40 × 40 px.`, element));
      }
      const cover = coveredAtCenter(element);
      if (cover) {
        stats.covered += 1;
        issues.push(issue(`cover_${index}`, "fail", "layout", "Control cubierto por otra capa", `${controlText(cover)} está por encima del centro del control.`, element, { coveredBy: selectorFor(cover) }));
      }
    });
    return { controls, stats, issues };
  }

  function scanStructure() {
    const issues = [];
    const seen = new Map();
    document.querySelectorAll("[id]").forEach((element) => {
      const bucket = seen.get(element.id) || []; bucket.push(element); seen.set(element.id, bucket);
    });
    const duplicateIds = [...seen.entries()].filter(([, elements]) => elements.length > 1);
    duplicateIds.forEach(([id, elements], index) => issues.push(issue(`duplicate_${index}`, "fail", "structure", "ID duplicado", `${id} aparece ${elements.length} veces y puede dirigir eventos al panel incorrecto.`, elements[0])));

    const emptySections = [...document.querySelectorAll(".section")].filter((section) => !section.children.length || !(section.textContent || "").trim());
    emptySections.forEach((section, index) => issues.push(issue(`empty_section_${index}`, "warn", "structure", "Sección vacía", `La sección ${section.id || "sin ID"} no contiene interfaz visible.`, section)));

    const forms = [...document.forms];
    forms.forEach((form, index) => {
      const submits = form.querySelectorAll("button[type='submit'],input[type='submit'],button:not([type])");
      const status = interactionStatus(form);
      if (!submits.length) issues.push(issue(`form_submit_${index}`, "warn", "forms", "Formulario sin acción visible", "No se encontró botón de envío dentro del formulario.", form));
      if (!status.wired && submits.length) issues.push(issue(`form_handler_${index}`, "fail", "forms", "Formulario sin envío comprobable", "El formulario tiene botón, pero no expone submit handler registrado.", form));
    });

    const all = [...document.querySelectorAll("body *")];
    const overflow = all.filter((element) => {
      if (!isElementVisible(element) || element.closest("#v17152IntegrityMount")) return false;
      const rect = element.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 8 || rect.left < -8;
    }).slice(0, 30);
    overflow.forEach((element, index) => issues.push(issue(`overflow_${index}`, "warn", "mobile", "Desbordamiento horizontal", `El elemento sale ${Math.round(Math.max(0, element.getBoundingClientRect().right - document.documentElement.clientWidth))} px del viewport.`, element)));

    return { issues, duplicateIds: duplicateIds.map(([id, elements]) => ({ id, count: elements.length })), forms: forms.length, emptySections: emptySections.length, overflow: overflow.length };
  }

  async function inspectCache() {
    const result = {
      serviceWorkerSupported: "serviceWorker" in navigator,
      controlled: !!navigator.serviceWorker?.controller,
      controllerUrl: navigator.serviceWorker?.controller?.scriptURL || "",
      cachesSupported: "caches" in window,
      cacheNames: [],
      build: document.documentElement.dataset.inbestigaBuild || "",
      runtimeVersion: window.INBESTIGA_PUBLIC_RUNTIME_CONFIG?.version || "",
      manifestVersion: "",
      mismatches: []
    };
    try { if (result.cachesSupported) result.cacheNames = await caches.keys(); } catch { /* opcional */ }
    try {
      const response = await fetch("manifest.webmanifest", { cache: "no-store" });
      if (response.ok) {
        const manifest = await response.json();
        result.manifestVersion = String(manifest.id || "").match(/v\d+(?:-\d+)*/)?.[0]?.replaceAll("-", ".") || manifest.id || "";
      }
    } catch { /* sin red */ }
    const normalized = [result.build, result.runtimeVersion].filter(Boolean);
    if (new Set(normalized).size > 1) result.mismatches.push(`Build HTML ${result.build} y runtime ${result.runtimeVersion} no coinciden.`);
    const oldCaches = result.cacheNames.filter((name) => /^inbestiga-/i.test(name) && !name.includes("17-15-2"));
    if (oldCaches.length) result.mismatches.push(`${oldCaches.length} caché${oldCaches.length === 1 ? "" : "s"} anterior${oldCaches.length === 1 ? "" : "es"} detectada${oldCaches.length === 1 ? "" : "s"}.`);
    cacheSnapshot = result;
    return result;
  }

  function runtimeErrors() {
    const bootstrap = registry?.runtimeErrors?.() || [];
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem("inbestiga:v14:runtime-errors") || "[]"); } catch { legacy = []; }
    const merged = [...bootstrap, ...list(legacy)].sort((a, b) => String(a.at || a.created_at || "").localeCompare(String(b.at || b.created_at || "")));
    const unique = [];
    const fingerprints = new Set();
    merged.forEach((entry) => {
      const fingerprint = `${entry.message || entry.detail}|${entry.source || entry.filename}|${entry.line || ""}`;
      if (!fingerprints.has(fingerprint)) { fingerprints.add(fingerprint); unique.push(entry); }
    });
    return unique.slice(-80);
  }

  function lifecycleSummary() {
    const api = window.INBESTIGA_RECORD_LIFECYCLE;
    const source = typeof state !== "undefined" && state ? state : {};
    const entities = [
      ["campaign", "campaigns", "Campañas", "campaigns"], ["task", "tasks", "Tareas", "tasks"], ["brief", "briefs", "Briefs", "campaigns"],
      ["editorial", "editorial", "Editorial", "editorial"], ["asset", "assets", "Archivos", "assets"], ["template", "templates", "Plantillas", "templates"],
      ["incident", "incidents", "Incidencias", "incidents"], ["report", "report_snapshots", "Reportes", "reports"]
    ];
    return entities.map(([entity, key, label, route]) => {
      const rows = list(source[key]);
      const counts = { active: 0, archived: 0, trashed: 0 };
      rows.forEach((row) => { const stateName = api?.state?.(entity, row.id) || "active"; counts[stateName] = (counts[stateName] || 0) + 1; });
      return { entity, label, route, total: rows.length, ...counts };
    });
  }

  function scoreFor(issues, errors) {
    const fail = issues.filter((item) => item.severity === "fail").length + errors.filter((item) => item.severity === "fail" || item.type === "error" || item.type === "promise").length;
    const warn = issues.filter((item) => item.severity === "warn").length;
    return Math.max(0, Math.round(100 - Math.min(72, fail * 8) - Math.min(24, warn * 1.5)));
  }
  function summarize(report) {
    if (report.failures) return `${report.failures} falla${report.failures === 1 ? "" : "s"} de interacción requiere${report.failures === 1 ? "" : "n"} atención.`;
    if (report.warnings) return `Interfaz funcional con ${report.warnings} advertencia${report.warnings === 1 ? "" : "s"} de calidad.`;
    return "Todos los controles comprobados tienen evidencia de funcionamiento y legibilidad.";
  }

  async function run(options = {}) {
    if (running) return lastReport;
    running = true;
    renderRunning();
    try {
      const controlScan = scanControls();
      const structural = scanStructure();
      const cache = await inspectCache();
      const errors = runtimeErrors();
      const cacheIssues = cache.mismatches.map((detail, index) => issue(`cache_${index}`, "warn", "cache", "Caché o versión desalineada", detail));
      const errorIssues = errors.map((entry, index) => issue(`runtime_${index}`, entry.severity === "warn" ? "warn" : "fail", "runtime", "Error de ejecución registrado", safeText(entry.message || entry.detail || "Error del navegador", 300), null, { source: safeText(entry.source || entry.filename || "runtime", 220), at: entry.at || entry.created_at || "" }));
      const issues = [...controlScan.issues, ...structural.issues, ...cacheIssues, ...errorIssues];
      const failures = issues.filter((item) => item.severity === "fail").length;
      const warnings = issues.filter((item) => item.severity === "warn").length;
      const report = {
        id: `report_${Date.now()}`,
        version: VERSION,
        generatedAt: now(),
        activeSection: activeSection(),
        score: scoreFor(issues, errors), failures, warnings,
        controls: controlScan.stats,
        structure: { duplicateIds: structural.duplicateIds, forms: structural.forms, emptySections: structural.emptySections, overflow: structural.overflow },
        cache, runtimeErrors: errors.slice(-30), issues,
        lifecycle: lifecycleSummary(),
        viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio || 1, coarsePointer: matchMedia?.("(pointer: coarse)")?.matches || false },
        restrictions: { destructiveClicks: false, polling: false, mutationObserver: false, realtimeChannels: 0, backendChanges: false },
        note: options.manual ? "Auditoría manual" : "Auditoría automática no destructiva"
      };
      const reports = readArray(REPORT_KEY); reports.push(report); writeArray(REPORT_KEY, reports, MAX_REPORTS);
      lastReport = report;
      recordActivity("audit", "Auditoría de interacción", `${report.score}/100 · ${failures} fallas · ${warnings} advertencias`, { reportId: report.id });
      try { localStorage.setItem("inbestiga:last_interaction_integrity", JSON.stringify(report)); } catch { /* opcional */ }
      window.dispatchEvent(new CustomEvent("inbestiga:interaction-integrity-report", { detail: report }));
      render();
      return report;
    } finally { running = false; }
  }

  function last() {
    if (lastReport) return lastReport;
    try { lastReport = JSON.parse(localStorage.getItem("inbestiga:last_interaction_integrity") || "null"); } catch { lastReport = null; }
    return lastReport;
  }
  function health() {
    const report = last();
    if (!report) return { status: "info", value: "Integridad pendiente", detail: "Ejecuta la auditoría de interacción." };
    if (report.failures) return { status: "fail", value: `${report.failures} falla${report.failures === 1 ? "" : "s"}`, detail: summarize(report) };
    if (report.warnings) return { status: "warn", value: `${report.score}/100`, detail: summarize(report) };
    return { status: "ok", value: `${report.score}/100`, detail: summarize(report) };
  }

  function badge(severity) { return severity === "fail" ? "Crítico" : severity === "warn" ? "Advertencia" : "Correcto"; }
  function tone(severity) { return severity === "fail" ? "bad" : severity === "warn" ? "warn" : "good"; }
  function categoryLabel(value) {
    return ({ events: "Eventos", layout: "Capas", accessibility: "Accesibilidad", contrast: "Contraste", mobile: "Móvil", structure: "Estructura", forms: "Formularios", cache: "Caché", runtime: "Ejecución" })[value] || value;
  }

  function summaryHtml(report) {
    if (!report) return `<div class="v17152-empty"><strong>Aún no existe una auditoría.</strong><p>La prueba es de solo lectura: no pulsa botones de guardar, eliminar, enviar o aprobar.</p><button type="button" class="primary" data-v17152-action="run">Ejecutar Auditoría de Integridad</button></div>`;
    const c = report.controls || {};
    const cards = [
      ["SALUD", `${report.score}/100`, summarize(report), report.failures ? "bad" : report.warnings ? "warn" : "good"],
      ["CONTROLES", c.total || 0, `${c.wired || 0} con acción comprobable`, c.unwired ? "bad" : "good"],
      ["FALLAS", report.failures || 0, "Eventos, capas, contraste y ejecución", report.failures ? "bad" : "good"],
      ["ADVERTENCIAS", report.warnings || 0, "Accesibilidad, móvil y caché", report.warnings ? "warn" : "good"],
      ["ERRORES JS", report.runtimeErrors?.length || 0, "Sesión actual y registros recientes", report.runtimeErrors?.length ? "bad" : "good"],
      ["CAMBIOS REVERSIBLES", registry?.localChanges?.().filter((item) => !item.undone).length || 0, "Preferencias locales seguras", "neutral"]
    ];
    const topIssues = report.issues.slice(0, 6);
    return `<div class="v17152-hero" data-tone="${tone(report.failures ? "fail" : report.warnings ? "warn" : "ok")}">
      <div><span>PLATFORM INTERACTION INTEGRITY · ${VERSION}</span><h3>${esc(summarize(report))}</h3><p>Comprobación no destructiva de botones, pestañas, formularios, capas, contraste, caché, errores y comportamiento móvil.</p></div>
      <strong>${esc(report.score)}</strong>
    </div>
    <div class="v17152-metrics">${cards.map(([label, value, detail, itemTone]) => `<article data-tone="${itemTone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`).join("")}</div>
    <div class="v17152-grid">
      <section class="v17152-card"><div class="v17152-card-head"><div><h4>Señales prioritarias</h4><p>Primero se muestran las fallas que pueden bloquear trabajo.</p></div><button type="button" data-v17152-tab="issues">Ver todas</button></div>${topIssues.length ? `<div class="v17152-issue-list">${topIssues.map(issueRow).join("")}</div>` : `<div class="v17152-success">No se detectaron fallas ni advertencias.</div>`}</section>
      <section class="v17152-card"><div class="v17152-card-head"><div><h4>Cobertura comprobada</h4><p>La auditoría no ejecuta acciones productivas.</p></div></div><div class="v17152-coverage">
        <div><b>${c.visible || 0}</b><span>Controles visibles</span></div><div><b>${c.hidden || 0}</b><span>En paneles inactivos</span></div><div><b>${c.lowContrast || 0}</b><span>Contraste bajo</span></div><div><b>${c.covered || 0}</b><span>Cubiertos</span></div><div><b>${c.smallTargets || 0}</b><span>Objetivos pequeños</span></div><div><b>${report.structure?.overflow || 0}</b><span>Desbordamientos</span></div>
      </div><div class="v17152-note">Última lectura: ${esc(displayDate(report.generatedAt))} · ${esc(report.viewport.width)} × ${esc(report.viewport.height)} px.</div></section>
    </div>`;
  }

  function issueRow(item) {
    return `<article class="v17152-issue" data-severity="${esc(item.severity)}"><i></i><div><div class="v17152-issue-meta"><span>${esc(categoryLabel(item.category))}</span><b>${esc(badge(item.severity))}</b></div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><small>${esc(item.section)}${item.control ? ` · ${esc(item.control)}` : ""}</small></div>${item.selector ? `<button type="button" data-v17152-locate="${esc(item.id)}">Ubicar</button>` : ""}</article>`;
  }
  function issuesHtml(report) {
    if (!report) return summaryHtml(report);
    const categories = [...new Set(report.issues.map((item) => item.category))];
    return `<div class="v17152-card"><div class="v17152-card-head"><div><h4>Hallazgos de interacción</h4><p>${report.failures} fallas y ${report.warnings} advertencias.</p></div><div class="v17152-inline"><select id="v17152SeverityFilter"><option value="all">Todas las severidades</option><option value="fail">Solo fallas</option><option value="warn">Solo advertencias</option></select><select id="v17152CategoryFilter"><option value="all">Todas las categorías</option>${categories.map((category) => `<option value="${esc(category)}">${esc(categoryLabel(category))}</option>`).join("")}</select></div></div><div id="v17152IssueList" class="v17152-issue-list">${report.issues.length ? report.issues.map(issueRow).join("") : `<div class="v17152-success">No existen hallazgos en esta lectura.</div>`}</div></div>`;
  }

  function historyHtml() {
    const changes = registry?.localChanges?.().slice().reverse() || [];
    const events = activity.slice().reverse();
    return `<div class="v17152-grid"><section class="v17152-card"><div class="v17152-card-head"><div><h4>Actividad de interfaz</h4><p>Navegación y controles utilizados; no se guardan contraseñas ni contenido escrito.</p></div><button type="button" data-v17152-action="clear-history">Limpiar</button></div><div class="v17152-timeline">${events.length ? events.slice(0, 80).map((item) => `<article><i></i><div><strong>${esc(item.label)}</strong><p>${esc(item.detail || item.type)}</p><small>${esc(displayDate(item.at))}</small></div></article>`).join("") : `<div class="v17152-empty-small">Sin actividad registrada.</div>`}</div></section>
      <section class="v17152-card"><div class="v17152-card-head"><div><h4>Historial local reversible</h4><p>Solo preferencias visuales y de navegación almacenadas en este dispositivo.</p></div></div><div class="v17152-change-list">${changes.length ? changes.slice(0, 60).map((item) => `<article class="${item.undone ? "undone" : ""}"><div><strong>${esc(item.key)}</strong><small>${esc(displayDate(item.at))}${item.undone ? " · deshecho" : ""}</small></div>${!item.undone ? `<button type="button" data-v17152-undo="${esc(item.id)}">Deshacer</button>` : ""}</article>`).join("") : `<div class="v17152-empty-small">Todavía no hay preferencias reversibles.</div>`}</div></section></div>`;
  }

  function recoveryHtml(report) {
    const cache = cacheSnapshot || report?.cache || {};
    const lifecycle = report?.lifecycle || lifecycleSummary();
    const reports = readArray(REPORT_KEY).slice().reverse();
    const trash = readArray(TRASH_KEY).slice().reverse();
    return `<div class="v17152-grid"><section class="v17152-card"><div class="v17152-card-head"><div><h4>Caché y versión</h4><p>Detecta shells anteriores que pueden mantener código obsoleto.</p></div><button type="button" data-v17152-action="refresh-cache">Actualizar lectura</button></div><div class="v17152-status-list">
      <article><span>Build visible</span><strong>${esc(cache.build || "No detectado")}</strong></article><article><span>Runtime</span><strong>${esc(cache.runtimeVersion || "No detectado")}</strong></article><article><span>Service Worker</span><strong>${cache.controlled ? "Controlando la aplicación" : cache.serviceWorkerSupported ? "Sin controlador activo" : "No compatible"}</strong></article><article><span>Cachés INBESTIGA</span><strong>${esc(list(cache.cacheNames).filter((name) => /^inbestiga-/i.test(name)).length)}</strong></article>
      </div>${list(cache.mismatches).length ? `<div class="v17152-warning">${cache.mismatches.map((item) => `<p>${esc(item)}</p>`).join("")}</div>` : `<div class="v17152-success">Versiones y caché sin desalineaciones detectadas.</div>`}<button type="button" class="danger" data-v17152-action="reset-cache">Limpiar caché de la plataforma y recargar</button></section>
      <section class="v17152-card"><div class="v17152-card-head"><div><h4>Papelera productiva existente</h4><p>Lectura del ciclo de vida ya implementado; no elimina registros.</p></div><span class="v17152-pill">${esc(window.INBESTIGA_RECORD_LIFECYCLE?.mode?.() || "local")}</span></div><div class="v17152-lifecycle">${lifecycle.map((item) => `<button type="button" data-v17152-route="${esc(item.route)}"><span>${esc(item.label)}</span><b>${esc(item.trashed)}</b><small>en papelera · ${esc(item.archived)} archivados</small></button>`).join("")}</div></section>
      <section class="v17152-card"><div class="v17152-card-head"><div><h4>Informes guardados</h4><p>Las auditorías eliminadas pasan a una papelera local recuperable.</p></div></div><div class="v17152-report-list">${reports.length ? reports.map((item) => `<article><div><strong>${esc(item.score)}/100</strong><small>${esc(displayDate(item.generatedAt))} · ${esc(item.failures)} fallas</small></div><button type="button" data-v17152-delete-report="${esc(item.id)}">Papelera</button></article>`).join("") : `<div class="v17152-empty-small">Sin informes guardados.</div>`}</div>${trash.length ? `<h5>Papelera de diagnósticos</h5><div class="v17152-report-list">${trash.map((item) => `<article><div><strong>${esc(item.score)}/100</strong><small>${esc(displayDate(item.deletedAt || item.generatedAt))}</small></div><button type="button" data-v17152-restore-report="${esc(item.id)}">Restaurar</button></article>`).join("")}</div>` : ""}</section>
      <section class="v17152-card"><div class="v17152-card-head"><div><h4>Restauración segura</h4><p>Alcance real de “Deshacer” en esta versión.</p></div></div><ul class="v17152-rules"><li>Puede restaurar preferencias locales de diseño, navegación y apariencia.</li><li>Puede limpiar cachés antiguas y forzar la carga del build actual.</li><li>Los registros productivos utilizan la papelera existente y sus permisos.</li><li>No revierte operaciones de Supabase sin una función productiva auditada.</li></ul></section></div>`;
  }

  function mobileHtml(report) {
    const issues = report?.issues?.filter((item) => item.category === "mobile") || [];
    return `<div class="v17152-grid"><section class="v17152-card"><div class="v17152-card-head"><div><h4>Comprobación móvil</h4><p>Viewport actual y controles que pueden ser difíciles de usar con el pulgar.</p></div><button type="button" data-v17152-action="open-mobile">Abrir ventana 390 × 844</button></div><div class="v17152-mobile-device"><div><span>Viewport</span><strong>${esc(report?.viewport?.width || innerWidth)} × ${esc(report?.viewport?.height || innerHeight)}</strong></div><div><span>Objetivos pequeños</span><strong>${esc(report?.controls?.smallTargets || 0)}</strong></div><div><span>Desbordamientos</span><strong>${esc(report?.structure?.overflow || 0)}</strong></div><div><span>Puntero táctil</span><strong>${report?.viewport?.coarsePointer ? "Sí" : "No detectado"}</strong></div></div><div class="v17152-note">La ventana móvil permite una validación visual real. El auditor no fuerza estilos ni modifica los paneles productivos.</div></section>
      <section class="v17152-card"><div class="v17152-card-head"><div><h4>Hallazgos móviles</h4><p>Áreas táctiles y elementos que salen del viewport.</p></div></div><div class="v17152-issue-list">${issues.length ? issues.map(issueRow).join("") : `<div class="v17152-success">No se detectaron problemas móviles en el viewport probado.</div>`}</div></section></div>`;
  }

  function renderRunning() {
    const content = document.getElementById("v17152IntegrityContent");
    if (content) content.innerHTML = `<div class="v17152-running"><i></i><strong>Comprobando controles y capas…</strong><span>No se ejecutan acciones productivas.</span></div>`;
  }
  function render() {
    ensureMount();
    const report = last();
    const content = document.getElementById("v17152IntegrityContent");
    if (!content) return;
    document.querySelectorAll("[data-v17152-tab]").forEach((button) => button.classList.toggle("active", button.dataset.v17152Tab === currentTab));
    content.innerHTML = currentTab === "issues" ? issuesHtml(report) : currentTab === "history" ? historyHtml() : currentTab === "recovery" ? recoveryHtml(report) : currentTab === "mobile" ? mobileHtml(report) : summaryHtml(report);
    bindFilters();
  }
  function ensureMount() {
    const audit = document.getElementById("auditpro");
    if (!audit) return null;
    let mount = document.getElementById("v17152IntegrityMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "v17152IntegrityMount";
      mount.className = "v17152-integrity";
      mount.innerHTML = `<div class="v17152-toolbar"><div><span>AUDITORÍA PRO · ${VERSION}</span><h2>Integridad de interacción</h2><p>Comprueba que botones, pestañas y campos puedan utilizarse, que el texto sea legible y que la versión activa no esté atrapada en caché.</p></div><div class="v17152-actions"><button type="button" class="primary" data-v17152-action="run">Ejecutar ahora</button><button type="button" data-v17152-action="export">Exportar JSON</button></div></div><nav class="v17152-tabs" aria-label="Diagnóstico de interacción"><button type="button" data-v17152-tab="summary">Resumen</button><button type="button" data-v17152-tab="issues">Hallazgos</button><button type="button" data-v17152-tab="history">Historial y deshacer</button><button type="button" data-v17152-tab="recovery">Recuperación</button><button type="button" data-v17152-tab="mobile">Móvil</button></nav><div id="v17152IntegrityContent" aria-live="polite"></div>`;
      const first = audit.firstElementChild;
      if (first) first.insertAdjacentElement("afterend", mount); else audit.appendChild(mount);
      mount.addEventListener("click", handleClick);
      mount.addEventListener("change", handleChange);
    }
    mounted = true;
    return mount;
  }

  function bindFilters() {
    const severity = document.getElementById("v17152SeverityFilter");
    const category = document.getElementById("v17152CategoryFilter");
    if (severity) severity.onchange = filterIssues;
    if (category) category.onchange = filterIssues;
  }
  function filterIssues() {
    const report = last(); if (!report) return;
    const severity = document.getElementById("v17152SeverityFilter")?.value || "all";
    const category = document.getElementById("v17152CategoryFilter")?.value || "all";
    const filtered = report.issues.filter((item) => (severity === "all" || item.severity === severity) && (category === "all" || item.category === category));
    const host = document.getElementById("v17152IssueList");
    if (host) host.innerHTML = filtered.length ? filtered.map(issueRow).join("") : `<div class="v17152-empty-small">No hay hallazgos con esos filtros.</div>`;
  }

  function locateIssue(id) {
    const item = last()?.issues?.find((entry) => entry.id === id);
    if (!item?.selector) return;
    if (item.section && item.section !== "global" && typeof window.navTo === "function") {
      try { window.navTo(item.section); } catch { /* continúa */ }
    }
    setTimeout(() => {
      const element = document.querySelector(item.selector);
      if (!element) return toast("Elemento no disponible", "El panel se volvió a renderizar; ejecuta nuevamente la auditoría.", "warning");
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      element.classList.remove("v17152-highlight"); void element.offsetWidth; element.classList.add("v17152-highlight");
      setTimeout(() => element.classList.remove("v17152-highlight"), 3600);
      toast("Elemento localizado", `${item.title}: ${item.control || item.section}`, "success");
    }, 90);
  }
  async function exportReport() {
    const report = last() || await run({ manual: true });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `INBESTIGA_INTERACTION_INTEGRITY_${VERSION.replaceAll(".", "_")}_${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function undoLocalChange(id) {
    if (!confirmAction("¿Restaurar el valor anterior de esta preferencia local? La página se recargará para aplicar el cambio.")) return;
    const result = registry?.undo?.(id) || { ok: false, reason: "Registro de restauración no disponible" };
    if (!result.ok) return toast("No se pudo deshacer", result.reason || "Cambio no disponible", "error");
    recordActivity("undo", "Preferencia local restaurada", result.key || "");
    location.reload();
  }
  async function resetCaches() {
    if (!confirmAction("Se eliminarán únicamente las cachés de INBESTIGA y se recargará la aplicación. No se borrarán tareas, archivos ni datos de Supabase. ¿Continuar?")) return;
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter((registration) => /service-worker\.js/i.test(registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || "")).map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => /^inbestiga-/i.test(name)).map((name) => caches.delete(name)));
      }
      recordActivity("recovery", "Caché de INBESTIGA eliminada", "Recarga forzada del build actual");
      location.replace(`${location.pathname}?integrity_refresh=${Date.now()}${location.hash || ""}`);
    } catch (error) { toast("No se pudo limpiar la caché", error?.message || String(error), "error"); }
  }
  function deleteReport(id) {
    const reports = readArray(REPORT_KEY); const index = reports.findIndex((item) => item.id === id); if (index < 0) return;
    const [removed] = reports.splice(index, 1); removed.deletedAt = now();
    const trash = readArray(TRASH_KEY); trash.push(removed); writeArray(REPORT_KEY, reports, MAX_REPORTS); writeArray(TRASH_KEY, trash, MAX_REPORTS);
    if (lastReport?.id === id) lastReport = reports.at(-1) || null;
    render();
  }
  function restoreReport(id) {
    const trash = readArray(TRASH_KEY); const index = trash.findIndex((item) => item.id === id); if (index < 0) return;
    const [restored] = trash.splice(index, 1); delete restored.deletedAt;
    const reports = readArray(REPORT_KEY); reports.push(restored); writeArray(REPORT_KEY, reports, MAX_REPORTS); writeArray(TRASH_KEY, trash, MAX_REPORTS); lastReport = restored; render();
  }
  function openMobile() {
    const url = new URL(location.href); url.searchParams.set("integrity_mobile", "1");
    window.open(url.href, "inbestiga_mobile_test", "popup=yes,width=390,height=844,resizable=yes,scrollbars=yes");
  }
  function handleChange(event) {
    if (event.target.matches("#v17152SeverityFilter,#v17152CategoryFilter")) filterIssues();
  }
  function handleClick(event) {
    const tab = event.target.closest("[data-v17152-tab]");
    if (tab) { currentTab = tab.dataset.v17152Tab; render(); return; }
    const action = event.target.closest("[data-v17152-action]")?.dataset.v17152Action;
    if (action === "run") { run({ manual: true }); return; }
    if (action === "export") { exportReport(); return; }
    if (action === "clear-history") { activity = []; writeArray(ACTIVITY_KEY, [], MAX_ACTIVITY); registry?.clearRuntimeErrors?.(); try{localStorage.removeItem("inbestiga:v14:runtime-errors")}catch{} render(); return; }
    if (action === "refresh-cache") { inspectCache().then(render); return; }
    if (action === "reset-cache") { resetCaches(); return; }
    if (action === "open-mobile") { openMobile(); return; }
    const locate = event.target.closest("[data-v17152-locate]"); if (locate) { locateIssue(locate.dataset.v17152Locate); return; }
    const undo = event.target.closest("[data-v17152-undo]"); if (undo) { undoLocalChange(undo.dataset.v17152Undo); return; }
    const route = event.target.closest("[data-v17152-route]"); if (route) { window.navTo?.(route.dataset.v17152Route); return; }
    const remove = event.target.closest("[data-v17152-delete-report]"); if (remove) { deleteReport(remove.dataset.v17152DeleteReport); return; }
    const restore = event.target.closest("[data-v17152-restore-report]"); if (restore) { restoreReport(restore.dataset.v17152RestoreReport); }
  }

  function captureUserActivity() {
    document.addEventListener("click", (event) => {
      const target = event.target.closest?.(INTERACTIVE_SELECTOR);
      if (!target || target.closest("#v17152IntegrityMount")) return;
      recordActivity("click", controlText(target), `Sección: ${sectionFor(target)}`);
    }, true);
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!target?.matches?.("input,select,textarea") || target.closest("#v17152IntegrityMount")) return;
      recordActivity("change", controlText(target), `Se modificó un campo en ${sectionFor(target)}; el valor no se registró.`);
    }, true);
  }
  function wrapNavigation() {
    if (typeof window.navTo !== "function" || window.navTo.__v17152Wrapped) return;
    const base = window.navTo;
    const wrapped = function (id) {
      const result = base.apply(this, arguments);
      recordActivity("navigation", `Abrir ${id}`, "Navegación interna");
      if (id === "auditpro") { ensureMount(); render(); const report=last(); if(!report || report.activeSection!=="auditpro" || Date.now()-new Date(report.generatedAt||0).getTime()>60000) run({manual:false}); }
      return result;
    };
    wrapped.__v17152Wrapped = true; wrapped.__v17152Base = base; window.navTo = wrapped;
  }
  function open() { if (typeof window.navTo === "function") window.navTo("auditpro"); ensureMount(); render(); }

  function init() {
    ensureMount(); captureUserActivity(); wrapNavigation(); last(); render();
    window.INBESTIGA_QUALITY_CORE?.register?.(MODULE, { version: VERSION, mode: "read-only-interaction-audit", polling: false, realtimeChannels: 0, mutationObservers: 0, dynamicCode: false, backendChanges: false });
    const build = window.INBESTIGA_BUILD || {};
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: "PLATFORM INTERACTION INTEGRITY & AUTOMATIC DIAGNOSTICS", modules: [...new Set([...(Array.isArray(build.modules) ? build.modules : []), MODULE])] };
    document.documentElement.dataset.inbestigaBuild = VERSION;
    const autoRun = () => { const app=document.getElementById("appScreen"); if(app && !app.classList.contains("hidden")) run({ manual: false }).catch((error) => console.warn("[INBESTIGA integrity]", error)); };
    if ("requestIdleCallback" in window) requestIdleCallback(autoRun, { timeout: 2600 }); else setTimeout(autoRun, 900);
  }

  window.INBESTIGA_INTERACTION_INTEGRITY = Object.freeze({
    version: VERSION, run, last, health, open, locate: locateIssue,
    undoLocalChange, resetCaches, activity: () => activity.map((item) => ({ ...item })), lifecycleSummary
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
