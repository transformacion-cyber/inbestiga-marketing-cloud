/* ===== v17.0 WORK 360 ADVANCED ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_WORK360_ADVANCED) return;

  const VERSION = "v17.0";
  const BUILD = "WORK 360 ADVANCED";
  const DEFAULT_VIEW = "kanban";
  const VIEWS = new Set(["kanban", "list", "timeline", "capacity"]);
  const DONE = new Set(["aprobado", "publicado", "completado", "completada", "finalizado", "finalizada", "done", "hecho"]);

  let currentUserKey = "guest";
  let data = blankData();
  let selected = new Set();
  let cloudState = "local";
  let cloudLoadedFor = "";
  let cloudSaveTimer = null;
  let baseRenderTasks = null;

  function blankData() {
    return {
      view: DEFAULT_VIEW,
      metadata: {},
      savedFilters: [],
      templates: [],
      history: [],
      activeTimer: null,
      updatedAt: null,
    };
  }

  function userId() {
    try {
      return String(member?.id || authUser?.id || "guest");
    } catch {
      return "guest";
    }
  }

  function authUserId() {
    try {
      return authUser?.id || null;
    } catch {
      return null;
    }
  }

  function storageKey() {
    return `inbestiga:v17:work360:${userId()}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function sameId(a, b) {
    return String(a ?? "") === String(b ?? "");
  }

  function statusKey(value) {
    if (typeof v412StatusKey === "function") return v412StatusKey(value);
    return String(value || "").trim().toLowerCase().replaceAll(" ", "_");
  }

  function isDone(task) {
    if (typeof v412TaskDone === "function") return v412TaskDone(task);
    return DONE.has(statusKey(task?.status));
  }

  function taskList() {
    try {
      return Array.isArray(state?.tasks) ? state.tasks : [];
    } catch {
      return [];
    }
  }

  function memberList() {
    try {
      return Array.isArray(state?.members) ? state.members : [];
    } catch {
      return [];
    }
  }

  function taskById(id) {
    return taskList().find((task) => sameId(task.id, id));
  }

  function personName(id) {
    try {
      return typeof memberName === "function" ? memberName(id) : memberList().find((item) => sameId(item.id, id))?.full_name || "Sin responsable";
    } catch {
      return "Sin responsable";
    }
  }

  function campaignName(id) {
    try {
      return typeof nameOf === "function" ? nameOf(state.campaigns || [], id) : "";
    } catch {
      return "";
    }
  }

  function clientName(id) {
    try {
      return typeof nameOf === "function" ? nameOf(state.clients || [], id) : "";
    } catch {
      return "";
    }
  }

  function dateKey() {
    try {
      return typeof today === "function" ? today() : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    } catch {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    }
  }

  function displayDate(value) {
    if (!value) return "Sin fecha";
    try {
      return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return String(value);
    }
  }

  function loadLocal() {
    const key = userId();
    if (key === currentUserKey && data) return data;
    currentUserKey = key;
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey()) || "null");
      data = normalizeData(parsed || blankData());
    } catch {
      data = blankData();
    }
    selected = new Set();
    return data;
  }

  function normalizeData(raw) {
    const next = blankData();
    next.view = VIEWS.has(raw?.view) ? raw.view : DEFAULT_VIEW;
    next.metadata = raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
    next.savedFilters = Array.isArray(raw?.savedFilters) ? raw.savedFilters.slice(0, 20) : [];
    next.templates = Array.isArray(raw?.templates) ? raw.templates.slice(0, 20) : [];
    next.history = Array.isArray(raw?.history) ? raw.history.slice(0, 120) : [];
    next.activeTimer = raw?.activeTimer && raw.activeTimer.taskId ? raw.activeTimer : null;
    next.updatedAt = raw?.updatedAt || null;
    return next;
  }

  function persistLocal() {
    loadLocal();
    data.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey(), JSON.stringify(data));
    } catch (error) {
      console.warn("[v17] local persistence", error);
    }
  }

  function table(name) {
    try {
      return typeof sb !== "undefined" && sb?.schema ? sb.schema("marketing_app").from(name) : null;
    } catch {
      return null;
    }
  }

  async function loadCloud() {
    loadLocal();
    const uid = authUserId();
    if (!uid || cloudLoadedFor === uid) return;
    cloudLoadedFor = uid;
    cloudState = "syncing";
    renderSyncState();
    try {
      const metaTable = table("task_extensions");
      const prefsTable = table("work360_preferences");
      if (!metaTable || !prefsTable) throw new Error("Tablas opcionales no disponibles");
      const [metaResult, prefsResult] = await Promise.all([
        metaTable.select("task_id,metadata").eq("user_id", uid),
        prefsTable.select("preferences").eq("user_id", uid).maybeSingle(),
      ]);
      if (metaResult.error) throw metaResult.error;
      if (prefsResult.error) throw prefsResult.error;
      for (const row of metaResult.data || []) {
        data.metadata[String(row.task_id)] = { ...(data.metadata[String(row.task_id)] || {}), ...(row.metadata || {}) };
      }
      if (prefsResult.data?.preferences) {
        const remote = normalizeData({ ...data, ...prefsResult.data.preferences, metadata: data.metadata });
        data.view = remote.view;
        data.savedFilters = remote.savedFilters;
        data.templates = remote.templates;
        data.history = remote.history;
        data.activeTimer = remote.activeTimer || data.activeTimer;
      }
      persistLocal();
      cloudState = "synced";
      renderAllAdvanced();
    } catch (error) {
      cloudState = "unavailable";
      console.info("[v17] Work360 cloud opcional no disponible", error?.message || error);
      renderSyncState();
    }
  }

  function scheduleCloudSave(taskId = null) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => saveCloud(taskId), 650);
  }

  async function saveCloud(taskId = null) {
    const uid = authUserId();
    if (!uid) return;
    const metaTable = table("task_extensions");
    const prefsTable = table("work360_preferences");
    if (!metaTable || !prefsTable) return;
    cloudState = "syncing";
    renderSyncState();
    try {
      if (taskId) {
        const result = await metaTable.upsert({
          user_id: uid,
          task_id: String(taskId),
          metadata: getMeta(taskId),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,task_id" });
        if (result.error) throw result.error;
      }
      const preferences = {
        view: data.view,
        savedFilters: data.savedFilters,
        templates: data.templates,
        history: data.history.slice(0, 120),
        activeTimer: data.activeTimer,
        updatedAt: data.updatedAt,
      };
      const result = await prefsTable.upsert({ user_id: uid, preferences, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (result.error) throw result.error;
      cloudState = "synced";
    } catch (error) {
      cloudState = "unavailable";
      console.info("[v17] cloud save fallback local", error?.message || error);
    }
    renderSyncState();
  }

  function getMeta(taskId) {
    loadLocal();
    const id = String(taskId);
    const current = data.metadata[id] || {};
    return {
      estimateHours: Number(current.estimateHours) || 0,
      trackedMinutes: Number(current.trackedMinutes) || 0,
      parentTaskId: current.parentTaskId || "",
      dependencies: Array.isArray(current.dependencies) ? current.dependencies.map(String) : [],
      recurrence: {
        frequency: current.recurrence?.frequency || "none",
        interval: Math.max(1, Number(current.recurrence?.interval) || 1),
      },
      tags: Array.isArray(current.tags) ? current.tags : [],
      notes: current.notes || "",
      updatedAt: current.updatedAt || null,
    };
  }

  function historyEntry(taskId, action, before, after) {
    return {
      id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      taskId: String(taskId),
      action,
      actor: userId(),
      actorName: (() => { try { return member?.full_name || "Usuario"; } catch { return "Usuario"; } })(),
      at: new Date().toISOString(),
      before: clone(before),
      after: clone(after),
    };
  }

  function updateMeta(taskId, patch, action = "Planificación actualizada", options = {}) {
    loadLocal();
    const id = String(taskId);
    const before = getMeta(id);
    const after = {
      ...before,
      ...patch,
      recurrence: { ...before.recurrence, ...(patch.recurrence || {}) },
      dependencies: Array.isArray(patch.dependencies) ? patch.dependencies.map(String) : before.dependencies,
      tags: Array.isArray(patch.tags) ? patch.tags : before.tags,
      updatedAt: new Date().toISOString(),
    };
    data.metadata[id] = after;
    if (!options.skipHistory) data.history.unshift(historyEntry(id, action, before, after));
    data.history = data.history.slice(0, 120);
    persistLocal();
    scheduleCloudSave(id);
    renderAllAdvanced();
    return after;
  }

  function dependenciesFor(taskId) {
    return getMeta(taskId).dependencies.map(taskById).filter(Boolean);
  }

  function blockedDependencies(taskId) {
    return dependenciesFor(taskId).filter((task) => !isDone(task));
  }

  function isBlocked(taskId) {
    return blockedDependencies(taskId).length > 0;
  }

  function childrenOf(taskId) {
    return taskList().filter((task) => sameId(getMeta(task.id).parentTaskId, taskId));
  }

  function descendantIds(taskId, seen = new Set()) {
    const id = String(taskId);
    if (seen.has(id)) return seen;
    seen.add(id);
    for (const child of childrenOf(id)) descendantIds(child.id, seen);
    return seen;
  }

  function dependencyCreatesCycle(taskId, dependencyIds) {
    const target = String(taskId);
    function walk(id, seen = new Set()) {
      const key = String(id);
      if (key === target) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return getMeta(key).dependencies.some((dep) => walk(dep, seen));
    }
    return dependencyIds.some((dep) => walk(dep));
  }

  function currentFilters() {
    try {
      return {
        search: v412TaskView.search || "",
        assignee: v412TaskView.assignee || "",
        priority: v412TaskView.priority || "",
        scope: v412TaskView.scope || "all",
      };
    } catch {
      return { search: "", assignee: "", priority: "", scope: "all" };
    }
  }

  function visibleTasks() {
    const filters = currentFilters();
    const query = String(filters.search || "").toLowerCase().trim();
    return taskList().filter((task) => {
      const searchable = `${task.title || ""} ${task.description || ""} ${personName(task.assigned_to)} ${clientName(task.client_id)} ${campaignName(task.campaign_id)} ${getMeta(task.id).tags.join(" ")}`.toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (filters.assignee && !sameId(task.assigned_to, filters.assignee)) return false;
      if (filters.priority && String(task.priority || "").toLowerCase() !== String(filters.priority).toLowerCase()) return false;
      if (filters.scope === "mine" && !sameId(task.assigned_to, userId())) return false;
      if (filters.scope === "late" && !(task.due_date && task.due_date < dateKey() && !isDone(task))) return false;
      if (filters.scope === "today" && task.due_date !== dateKey()) return false;
      if (filters.scope === "review" && !["en_revision", "observado", "corregido"].includes(statusKey(task.status))) return false;
      return true;
    });
  }

  function totalEstimate(tasks) {
    return tasks.reduce((sum, task) => sum + getMeta(task.id).estimateHours, 0);
  }

  function totalTracked(tasks) {
    return tasks.reduce((sum, task) => sum + getMeta(task.id).trackedMinutes, 0);
  }

  function formatMinutes(minutes) {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return hours ? `${hours}h ${mins ? `${mins}m` : ""}`.trim() : `${mins}m`;
  }

  function ensureShell() {
    const board = document.getElementById("taskKanban");
    if (!board || document.getElementById("v17Work360Shell")) return;
    const shell = document.createElement("section");
    shell.id = "v17Work360Shell";
    shell.className = "v17-work360-shell";
    shell.innerHTML = `
      <div class="v17-work360-head">
        <div>
          <span class="v17-work360-kicker">WORK 360 ADVANCED · ${VERSION}</span>
          <h3>Planificación, jerarquía y tiempo en una sola vista.</h3>
          <p>Kanban, lista, timeline, capacidad, dependencias, subtareas, recurrencia, plantillas y seguimiento sin reemplazar el flujo productivo actual.</p>
        </div>
        <div id="v17SyncState" class="v17-work360-sync" data-state="local"><i></i><span>Guardado local</span></div>
      </div>
      <div id="v17Metrics" class="v17-work360-metrics"></div>
      <div class="v17-work360-controls">
        <div class="v17-view-tabs" aria-label="Vistas de tareas">
          <button type="button" data-v17-view="kanban">Kanban</button>
          <button type="button" data-v17-view="list">Lista</button>
          <button type="button" data-v17-view="timeline">Timeline</button>
          <button type="button" data-v17-view="capacity">Carga</button>
        </div>
        <div class="v17-tool-grid">
          <select id="v17QuickTask"><option value="">Planificar una tarea…</option></select>
          <button type="button" id="v17OpenPlanner">Planificar</button>
          <button type="button" class="primary" id="v17NewTask">Nueva tarea</button>
        </div>
      </div>
      <div class="v17-advanced-row">
        <div class="v17-saved-tools">
          <select id="v17SavedFilter"><option value="">Filtros guardados</option></select>
          <button type="button" id="v17SaveFilter">Guardar filtro</button>
          <button type="button" id="v17DeleteFilter">Eliminar</button>
        </div>
        <div class="v17-template-tools">
          <select id="v17Template"><option value="">Plantillas de tarea</option></select>
          <button type="button" id="v17UseTemplate">Usar</button>
          <button type="button" id="v17SaveTemplate">Guardar</button>
        </div>
      </div>
      <div id="v17TimerStrip" class="v17-timer-strip"></div>
      <div id="v17BulkBar" class="v17-bulkbar"></div>`;
    board.insertAdjacentElement("beforebegin", shell);
    const alternate = document.createElement("div");
    alternate.id = "v17AlternateView";
    board.insertAdjacentElement("afterend", alternate);
    bindShell(shell);
    loadCloud();
  }

  function bindShell(shell) {
    shell.addEventListener("click", async (event) => {
      const viewButton = event.target.closest("[data-v17-view]");
      if (viewButton) return setView(viewButton.dataset.v17View);
      if (event.target.closest("#v17OpenPlanner")) {
        const id = document.getElementById("v17QuickTask")?.value;
        if (id) openPlanner(id);
        else notify("Selecciona una tarea", "Elige una tarea antes de abrir la planificación.", "warning");
      }
      if (event.target.closest("#v17NewTask")) return openCreateTask();
      if (event.target.closest("#v17SaveFilter")) return saveCurrentFilter();
      if (event.target.closest("#v17DeleteFilter")) return deleteCurrentFilter();
      if (event.target.closest("#v17UseTemplate")) return useSelectedTemplate();
      if (event.target.closest("#v17SaveTemplate")) return saveTemplateFromSelectedTask();
      if (event.target.closest("[data-v17-bulk='plan']")) return bulkPlan();
      if (event.target.closest("[data-v17-bulk='export']")) return exportSelectedCsv();
      if (event.target.closest("[data-v17-bulk='template']")) return saveTemplateFromSelection();
      if (event.target.closest("[data-v17-bulk='clear']")) return clearSelection();
      if (event.target.closest("[data-v17-timer='stop']")) return stopTimer();
      if (event.target.closest("[data-v17-timer='open']")) return openPlanner(data.activeTimer?.taskId);
    });
    shell.addEventListener("change", (event) => {
      if (event.target.id === "v17SavedFilter") applySavedFilter(event.target.value);
      if (event.target.id === "v17QuickTask" && event.target.value) selected = new Set([String(event.target.value)]);
    });
  }

  function notify(title, message, type = "success") {
    if (typeof premiumToast === "function") return premiumToast(title, message, type);
    if (typeof toast === "function") return toast(title, message);
    console.log(`[${type}] ${title}: ${message}`);
  }

  function openCreateTask() {
    try {
      if (typeof navTo === "function") navTo("tasks");
      if (typeof v413TogglePanel === "function") v413TogglePanel("v413CreateTaskPanel", true);
      document.getElementById("taskTitle")?.focus();
    } catch (error) {
      console.warn("[v17] open task form", error);
    }
  }

  function setView(view) {
    loadLocal();
    data.view = VIEWS.has(view) ? view : DEFAULT_VIEW;
    persistLocal();
    scheduleCloudSave();
    renderAllAdvanced();
  }

  function renderSyncState() {
    const node = document.getElementById("v17SyncState");
    if (!node) return;
    const labels = { local: "Guardado local", syncing: "Sincronizando", synced: "Local + Supabase", unavailable: "Supabase opcional no disponible" };
    node.dataset.state = cloudState;
    node.querySelector("span").textContent = labels[cloudState] || labels.local;
  }

  function renderMetrics(tasks) {
    const host = document.getElementById("v17Metrics");
    if (!host) return;
    const open = tasks.filter((task) => !isDone(task));
    const blocked = open.filter((task) => isBlocked(task.id));
    const overdue = open.filter((task) => task.due_date && task.due_date < dateKey());
    const estimate = totalEstimate(open);
    const tracked = totalTracked(tasks);
    host.innerHTML = [
      ["Visibles", tasks.length, "Según filtros actuales"],
      ["Estimadas", `${estimate.toFixed(1)}h`, "Horas planificadas"],
      ["Registradas", formatMinutes(tracked), "Tiempo acumulado"],
      ["Bloqueadas", blocked.length, "Dependencias abiertas"],
      ["Vencidas", overdue.length, "Pendientes fuera de fecha"],
    ].map(([label, value, note]) => `<article class="v17-work360-metric"><span>${escHtml(label)}</span><strong>${escHtml(value)}</strong><small>${escHtml(note)}</small></article>`).join("");
  }

  function renderSelectors() {
    const quick = document.getElementById("v17QuickTask");
    if (quick) {
      const previous = quick.value;
      quick.innerHTML = `<option value="">Planificar una tarea…</option>${taskList().map((task) => `<option value="${escHtml(task.id)}">${escHtml(task.title || "Tarea")}</option>`).join("")}`;
      if (taskById(previous)) quick.value = previous;
    }
    const filter = document.getElementById("v17SavedFilter");
    if (filter) {
      const previous = filter.value;
      filter.innerHTML = `<option value="">Filtros guardados</option>${data.savedFilters.map((item) => `<option value="${escHtml(item.id)}">${escHtml(item.name)}</option>`).join("")}`;
      if (data.savedFilters.some((item) => item.id === previous)) filter.value = previous;
    }
    const templates = document.getElementById("v17Template");
    if (templates) {
      const previous = templates.value;
      templates.innerHTML = `<option value="">Plantillas de tarea</option>${data.templates.map((item) => `<option value="${escHtml(item.id)}">${escHtml(item.name)}</option>`).join("")}`;
      if (data.templates.some((item) => item.id === previous)) templates.value = previous;
    }
  }

  function renderTabs() {
    document.querySelectorAll("#v17Work360Shell [data-v17-view]").forEach((button) => button.classList.toggle("active", button.dataset.v17View === data.view));
  }

  function renderTimer() {
    const host = document.getElementById("v17TimerStrip");
    if (!host) return;
    const timer = data.activeTimer;
    const task = timer ? taskById(timer.taskId) : null;
    host.classList.toggle("show", !!task);
    if (!task) {
      host.innerHTML = "";
      return;
    }
    const started = new Date(timer.startedAt);
    host.innerHTML = `<div class="v17-timer-copy"><i></i><div><strong>Tiempo activo · ${escHtml(task.title || "Tarea")}</strong><span>Iniciado ${started.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}. El tiempo se calcula al detenerlo.</span></div></div><div class="v17-timer-actions"><button type="button" data-v17-timer="open">Planificación</button><button type="button" class="primary" data-v17-timer="stop">Detener y registrar</button></div>`;
  }

  function renderBulkBar() {
    const host = document.getElementById("v17BulkBar");
    if (!host) return;
    const count = [...selected].filter(taskById).length;
    host.classList.toggle("show", count > 0);
    host.innerHTML = count ? `<strong>${count} tarea${count === 1 ? "" : "s"} seleccionada${count === 1 ? "" : "s"}</strong><div class="v17-bulk-actions"><button type="button" data-v17-bulk="plan">Planificar</button><button type="button" data-v17-bulk="template">Crear plantilla</button><button type="button" data-v17-bulk="export">Exportar CSV</button><button type="button" data-v17-bulk="clear">Limpiar</button></div>` : "";
  }

  function renderAlternate(tasks) {
    const board = document.getElementById("taskKanban");
    const host = document.getElementById("v17AlternateView");
    if (!board || !host) return;
    const kanban = data.view === "kanban";
    board.style.display = kanban ? "grid" : "none";
    host.classList.toggle("show", !kanban);
    if (kanban) {
      host.innerHTML = "";
      decorateKanban();
      return;
    }
    if (data.view === "list") host.innerHTML = renderList(tasks);
    if (data.view === "timeline") host.innerHTML = renderTimeline(tasks);
    if (data.view === "capacity") host.innerHTML = renderCapacity(tasks);
    bindAlternate(host);
  }

  function taskTone(task) {
    if (task.due_date && task.due_date < dateKey() && !isDone(task)) return "overdue";
    if (isBlocked(task.id)) return "blocked";
    return "";
  }

  function renderList(tasks) {
    if (!tasks.length) return `<div class="v17-empty">No existen tareas para los filtros actuales.</div>`;
    const descendants = new Map();
    for (const task of tasks) {
      const parent = getMeta(task.id).parentTaskId;
      if (!descendants.has(parent || "root")) descendants.set(parent || "root", []);
      descendants.get(parent || "root").push(task);
    }
    const ordered = [];
    const seen = new Set();
    function append(parent = "root", level = 0) {
      for (const task of descendants.get(parent) || []) {
        if (seen.has(String(task.id))) continue;
        seen.add(String(task.id));
        ordered.push({ task, level });
        append(String(task.id), level + 1);
      }
    }
    append();
    for (const task of tasks) if (!seen.has(String(task.id))) ordered.push({ task, level: 0 });
    return `<div class="v17-list">${ordered.map(({ task, level }) => {
      const meta = getMeta(task.id);
      const blocked = blockedDependencies(task.id);
      const tone = taskTone(task);
      const project = campaignName(task.campaign_id) || clientName(task.client_id) || "Sin proyecto";
      return `<article class="v17-list-row ${tone}" data-v17-task-row="${escHtml(task.id)}"><label><input type="checkbox" data-v17-select="${escHtml(task.id)}" ${selected.has(String(task.id)) ? "checked" : ""}></label><div class="v17-list-title" style="padding-left:${Math.min(level, 4) * 18}px"><strong>${level ? "↳ " : ""}${escHtml(task.title || "Tarea")}</strong><span>${escHtml(project)} · ${escHtml(meta.tags.join(", ") || "Sin etiquetas")}</span></div><div class="v17-list-cell"><b>${escHtml(personName(task.assigned_to))}</b><small>${escHtml(task.priority || "media")}</small></div><div class="v17-list-cell"><b>${escHtml(displayDate(task.due_date))}</b><small>${escHtml(task.status || "pendiente")}</small></div><div class="v17-list-cell"><b>${meta.estimateHours ? `${meta.estimateHours}h` : "Sin estimar"}</b><small>${formatMinutes(meta.trackedMinutes)} registradas</small></div><div class="v17-list-actions"><span class="v17-status-chip ${blocked.length ? "warning" : isDone(task) ? "good" : tone === "overdue" ? "danger" : ""}">${blocked.length ? `Bloqueada (${blocked.length})` : isDone(task) ? "Completada" : "Activa"}</span><button type="button" data-v17-open="${escHtml(task.id)}">Abrir</button><button type="button" data-v17-plan="${escHtml(task.id)}">Planificar</button></div></article>`;
    }).join("")}</div>`;
  }

  function renderTimeline(tasks) {
    const sorted = tasks.slice().sort((a, b) => String(a.due_date || "9999-99-99").localeCompare(String(b.due_date || "9999-99-99")) || String(a.title || "").localeCompare(String(b.title || "")));
    if (!sorted.length) return `<div class="v17-empty">No hay tareas para construir el timeline.</div>`;
    return `<div class="v17-timeline">${sorted.map((task) => {
      const meta = getMeta(task.id);
      const tone = taskTone(task);
      const blocked = blockedDependencies(task.id);
      return `<article class="v17-timeline-row ${tone}" data-v17-task-row="${escHtml(task.id)}"><div class="v17-timeline-date"><strong>${escHtml(displayDate(task.due_date))}</strong><span>${escHtml(task.due_time || "Sin hora")}</span></div><div class="v17-timeline-copy"><strong>${escHtml(task.title || "Tarea")}</strong><span>${escHtml(personName(task.assigned_to))} · ${escHtml(campaignName(task.campaign_id) || clientName(task.client_id) || "Sin proyecto")} · ${meta.estimateHours ? `${meta.estimateHours}h estimadas` : "sin estimar"}</span></div><div class="v17-list-actions"><span class="v17-status-chip ${blocked.length ? "warning" : isDone(task) ? "good" : tone === "overdue" ? "danger" : ""}">${blocked.length ? "Bloqueada" : escHtml(task.status || "pendiente")}</span><button type="button" data-v17-open="${escHtml(task.id)}">Abrir</button><button type="button" data-v17-plan="${escHtml(task.id)}">Planificar</button></div></article>`;
    }).join("")}</div>`;
  }

  function renderCapacity(tasks) {
    const active = tasks.filter((task) => !isDone(task));
    const groups = new Map();
    for (const person of memberList().filter((item) => item.status !== "inactive")) groups.set(String(person.id), { person, tasks: [], hours: 0, tracked: 0 });
    groups.set("unassigned", { person: { full_name: "Sin responsable" }, tasks: [], hours: 0, tracked: 0 });
    for (const task of active) {
      const key = task.assigned_to ? String(task.assigned_to) : "unassigned";
      if (!groups.has(key)) groups.set(key, { person: { full_name: personName(task.assigned_to) }, tasks: [], hours: 0, tracked: 0 });
      const item = groups.get(key);
      const meta = getMeta(task.id);
      item.tasks.push(task);
      item.hours += meta.estimateHours || 2;
      item.tracked += meta.trackedMinutes;
    }
    const rows = [...groups.values()].filter((item) => item.tasks.length).sort((a, b) => b.hours - a.hours);
    if (!rows.length) return `<div class="v17-empty">No hay tareas abiertas para calcular capacidad.</div>`;
    return `<div class="v17-capacity-grid">${rows.map((item) => {
      const percent = Math.min(140, Math.round(item.hours / 40 * 100));
      const tone = percent > 110 ? "danger" : percent > 85 ? "warning" : "";
      const blocked = item.tasks.filter((task) => isBlocked(task.id)).length;
      return `<article class="v17-capacity-card ${tone}"><div class="v17-capacity-head"><strong>${escHtml(item.person.full_name || "Miembro")}</strong><span>${percent}%</span></div><p>${item.tasks.length} tareas · ${item.hours.toFixed(1)}h planificadas · ${formatMinutes(item.tracked)} registradas${blocked ? ` · ${blocked} bloqueadas` : ""}</p><div class="v17-capacity-track"><i style="width:${Math.min(100, percent)}%"></i></div></article>`;
    }).join("")}</div>`;
  }

  function bindAlternate(host) {
    host.querySelectorAll("[data-v17-select]").forEach((input) => input.addEventListener("change", () => toggleSelection(input.dataset.v17Select, input.checked)));
    host.querySelectorAll("[data-v17-open]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); openTask(button.dataset.v17Open); }));
    host.querySelectorAll("[data-v17-plan]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); openPlanner(button.dataset.v17Plan); }));
    host.querySelectorAll("[data-v17-task-row]").forEach((row) => row.addEventListener("dblclick", () => openTask(row.dataset.v17TaskRow)));
  }

  function decorateKanban() {
    document.querySelectorAll("#taskKanban .v412-task-card[data-task-id]").forEach((card) => {
      const id = String(card.dataset.taskId);
      const meta = getMeta(id);
      const blocked = blockedDependencies(id);
      let selectNode = card.querySelector(".v17-card-select");
      if (!selectNode) {
        selectNode = document.createElement("label");
        selectNode.className = "v17-card-select";
        selectNode.innerHTML = `<input type="checkbox" data-v17-select="${escHtml(id)}">`;
        card.appendChild(selectNode);
        selectNode.addEventListener("click", (event) => event.stopPropagation());
        selectNode.querySelector("input").addEventListener("change", (event) => toggleSelection(id, event.target.checked));
      }
      selectNode.querySelector("input").checked = selected.has(id);
      let ext = card.querySelector(".v17-card-extension");
      if (!ext) {
        ext = document.createElement("div");
        ext.className = "v17-card-extension";
        card.appendChild(ext);
      }
      ext.innerHTML = `<div class="v17-card-extension-meta"><span>${meta.estimateHours ? `${meta.estimateHours}h estimadas` : "Sin estimar"}</span><span>${formatMinutes(meta.trackedMinutes)} registradas</span>${blocked.length ? `<span class="warning">${blocked.length} dependencia${blocked.length === 1 ? "" : "s"}</span>` : ""}${childrenOf(id).length ? `<span>${childrenOf(id).length} subtarea${childrenOf(id).length === 1 ? "" : "s"}</span>` : ""}</div><button type="button" class="v17-card-plan">Planificar trabajo</button>`;
      ext.querySelector("button").addEventListener("click", (event) => { event.stopPropagation(); openPlanner(id); });
    });
  }

  function toggleSelection(id, checked) {
    const key = String(id);
    if (checked) selected.add(key); else selected.delete(key);
    renderBulkBar();
    document.querySelectorAll(`[data-v17-select="${CSS.escape(key)}"]`).forEach((input) => { input.checked = selected.has(key); });
  }

  function clearSelection() {
    selected.clear();
    renderAllAdvanced();
  }

  async function saveCurrentFilter() {
    const name = typeof premiumInputModal === "function" ? await premiumInputModal({ title: "Guardar filtro", subtitle: "Conserva la combinación actual de búsqueda, responsable, prioridad y vista.", label: "Nombre del filtro", placeholder: "Ej. Revisiones de esta semana", confirmLabel: "Guardar", required: true }) : prompt("Nombre del filtro");
    if (!name) return;
    const item = { id: `f_${Date.now().toString(36)}`, name: String(name).trim(), definition: currentFilters() };
    data.savedFilters.unshift(item);
    data.savedFilters = data.savedFilters.slice(0, 20);
    persistLocal();
    scheduleCloudSave();
    renderAllAdvanced();
    notify("Filtro guardado", item.name, "success");
  }

  function applySavedFilter(id) {
    const item = data.savedFilters.find((filter) => filter.id === id);
    if (!item) return;
    try {
      Object.assign(v412TaskView, item.definition);
      const fields = { v412TaskSearch: "search", v412TaskAssignee: "assignee", v412TaskPriority: "priority", v412TaskScope: "scope" };
      Object.entries(fields).forEach(([elementId, key]) => { const node = document.getElementById(elementId); if (node) node.value = item.definition[key] || (key === "scope" ? "all" : ""); });
      renderTasks();
      notify("Filtro aplicado", item.name, "success");
    } catch (error) {
      console.warn("[v17] apply filter", error);
    }
  }

  function deleteCurrentFilter() {
    const select = document.getElementById("v17SavedFilter");
    const id = select?.value;
    if (!id) return notify("Selecciona un filtro", "Elige el filtro que deseas eliminar.", "warning");
    const item = data.savedFilters.find((filter) => filter.id === id);
    data.savedFilters = data.savedFilters.filter((filter) => filter.id !== id);
    persistLocal();
    scheduleCloudSave();
    renderAllAdvanced();
    notify("Filtro eliminado", item?.name || "Filtro", "success");
  }

  async function saveTemplateFromSelectedTask() {
    const id = document.getElementById("v17QuickTask")?.value || [...selected][0];
    if (!id) return notify("Selecciona una tarea", "Elige una tarea para convertirla en plantilla.", "warning");
    return saveTemplate(id);
  }

  async function saveTemplateFromSelection() {
    const id = [...selected][0];
    if (!id) return;
    return saveTemplate(id);
  }

  async function saveTemplate(taskId) {
    const task = taskById(taskId);
    if (!task) return;
    const name = typeof premiumInputModal === "function" ? await premiumInputModal({ title: "Crear plantilla", subtitle: task.title || "Tarea", label: "Nombre de la plantilla", placeholder: "Ej. Publicación semanal", confirmLabel: "Guardar plantilla", required: true }) : prompt("Nombre de la plantilla");
    if (!name) return;
    const template = {
      id: `tpl_${Date.now().toString(36)}`,
      name: String(name).trim(),
      createdAt: new Date().toISOString(),
      task: {
        title: task.title || "",
        description: task.description || "",
        client_id: task.client_id || "",
        area_id: task.area_id || "",
        assigned_to: task.assigned_to || "",
        campaign_id: task.campaign_id || "",
        priority: task.priority || "media",
        due_time: task.due_time || "",
        impact: Number(task.impact) || 3,
        checklist: Array.isArray(task.checklist) ? task.checklist : [],
      },
      metadata: getMeta(task.id),
    };
    data.templates.unshift(template);
    data.templates = data.templates.slice(0, 20);
    persistLocal();
    scheduleCloudSave();
    renderAllAdvanced();
    notify("Plantilla creada", template.name, "success");
  }

  function useSelectedTemplate() {
    const id = document.getElementById("v17Template")?.value;
    const template = data.templates.find((item) => item.id === id);
    if (!template) return notify("Selecciona una plantilla", "Elige una plantilla antes de continuar.", "warning");
    const mapping = {
      taskTitle: template.task.title,
      taskDescription: template.task.description,
      taskClient: template.task.client_id,
      taskArea: template.task.area_id,
      taskAssignee: template.task.assigned_to,
      taskCampaign: template.task.campaign_id,
      taskPriority: template.task.priority,
      taskTime: template.task.due_time,
      taskImpact: template.task.impact,
      taskChecklist: (template.task.checklist || []).map((item) => typeof item === "string" ? item : item.title || item.text || "").filter(Boolean).join(", "),
    };
    openCreateTask();
    for (const [elementId, value] of Object.entries(mapping)) {
      const node = document.getElementById(elementId);
      if (node && value !== undefined && value !== null) node.value = value;
    }
    notify("Plantilla aplicada", "Revisa los datos y crea la tarea cuando esté lista.", "success");
  }

  function openTask(id) {
    if (typeof v412OpenTask === "function") return v412OpenTask(id);
  }

  function plannerOptions(taskId) {
    const descendants = descendantIds(taskId);
    const taskOptions = taskList().filter((task) => !sameId(task.id, taskId)).map((task) => ({
      id: String(task.id),
      title: task.title || "Tarea",
      disabledParent: descendants.has(String(task.id)),
    }));
    return taskOptions;
  }

  function plannerBody(task, token) {
    const meta = getMeta(task.id);
    const options = plannerOptions(task.id);
    const children = childrenOf(task.id);
    const dependencies = dependenciesFor(task.id);
    return `<div class="v17-planner">
      <div class="v17-planner-summary">
        <article><span>Estado</span><strong>${escHtml(task.status || "pendiente")}</strong></article>
        <article><span>Estimación</span><strong>${meta.estimateHours ? `${meta.estimateHours}h` : "Sin estimar"}</strong></article>
        <article><span>Tiempo</span><strong>${formatMinutes(meta.trackedMinutes)}</strong></article>
        <article><span>Dependencias</span><strong>${dependencies.length}</strong></article>
      </div>
      <div class="v17-planner-grid">
        <label>Estimación en horas<input id="${token}_estimate" type="number" min="0" step="0.25" value="${escHtml(meta.estimateHours || "")}" placeholder="Ej. 4"></label>
        <label>Tarea padre<select id="${token}_parent"><option value="">Sin tarea padre</option>${options.map((item) => `<option value="${escHtml(item.id)}" ${sameId(item.id, meta.parentTaskId) ? "selected" : ""} ${item.disabledParent ? "disabled" : ""}>${escHtml(item.title)}</option>`).join("")}</select></label>
        <label class="full">Dependencias<select id="${token}_dependencies" multiple>${options.map((item) => `<option value="${escHtml(item.id)}" ${meta.dependencies.includes(item.id) ? "selected" : ""}>${escHtml(item.title)} · ${escHtml(taskById(item.id)?.status || "pendiente")}</option>`).join("")}</select></label>
        <label>Recurrencia<select id="${token}_frequency"><option value="none" ${meta.recurrence.frequency === "none" ? "selected" : ""}>Sin recurrencia</option><option value="daily" ${meta.recurrence.frequency === "daily" ? "selected" : ""}>Diaria</option><option value="weekly" ${meta.recurrence.frequency === "weekly" ? "selected" : ""}>Semanal</option><option value="monthly" ${meta.recurrence.frequency === "monthly" ? "selected" : ""}>Mensual</option></select></label>
        <label>Intervalo<input id="${token}_interval" type="number" min="1" max="52" value="${escHtml(meta.recurrence.interval)}"></label>
        <label class="full">Etiquetas<input id="${token}_tags" value="${escHtml(meta.tags.join(", "))}" placeholder="diseño, urgente, cliente"></label>
        <label class="full">Notas de planificación<textarea id="${token}_notes" class="v17-planner-note" placeholder="Contexto, acuerdos o restricciones">${escHtml(meta.notes)}</textarea></label>
      </div>
      <div class="v17-planner-relations">
        <div class="v17-relation-box"><h4>Subtareas (${children.length})</h4><div class="v17-relation-list">${children.length ? children.map((child) => `<div class="v17-relation-item"><span>${escHtml(child.title || "Subtarea")}</span><b>${escHtml(child.status || "pendiente")}</b></div>`).join("") : `<div class="v17-empty">Sin subtareas vinculadas.</div>`}</div></div>
        <div class="v17-relation-box"><h4>Dependencias (${dependencies.length})</h4><div class="v17-relation-list">${dependencies.length ? dependencies.map((dep) => `<div class="v17-relation-item"><span>${escHtml(dep.title || "Dependencia")}</span><b>${isDone(dep) ? "Lista" : "Pendiente"}</b></div>`).join("") : `<div class="v17-empty">Sin dependencias.</div>`}</div></div>
      </div>
      <div class="v17-inline-actions">
        <button type="button" data-v17-planner-action="timer">${data.activeTimer?.taskId && sameId(data.activeTimer.taskId, task.id) ? "Detener tiempo" : "Iniciar tiempo"}</button>
        <button type="button" data-v17-planner-action="subtask">Crear subtarea</button>
        <button type="button" data-v17-planner-action="repeat">Generar siguiente</button>
        <button type="button" data-v17-planner-action="template">Guardar como plantilla</button>
        <button type="button" data-v17-planner-action="history">Ver historial</button>
      </div>
    </div>`;
  }

  function readPlanner(taskId, token) {
    const dependencies = [...document.getElementById(`${token}_dependencies`)?.selectedOptions || []].map((option) => option.value).filter(Boolean);
    const parentTaskId = document.getElementById(`${token}_parent`)?.value || "";
    if (dependencyCreatesCycle(taskId, dependencies)) throw new Error("La selección de dependencias crea un ciclo.");
    if (parentTaskId && descendantIds(taskId).has(String(parentTaskId))) throw new Error("Una tarea descendiente no puede convertirse en padre.");
    return {
      estimateHours: Math.max(0, Number(document.getElementById(`${token}_estimate`)?.value) || 0),
      parentTaskId,
      dependencies,
      recurrence: {
        frequency: document.getElementById(`${token}_frequency`)?.value || "none",
        interval: Math.max(1, Number(document.getElementById(`${token}_interval`)?.value) || 1),
      },
      tags: String(document.getElementById(`${token}_tags`)?.value || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12),
      notes: String(document.getElementById(`${token}_notes`)?.value || "").trim(),
    };
  }

  function openPlanner(taskId) {
    const task = taskById(taskId);
    if (!task || typeof openPremiumModal !== "function") return;
    const token = `v17_${Math.random().toString(36).slice(2, 8)}`;
    openPremiumModal({
      title: task.title || "Planificación de tarea",
      subtitle: `${personName(task.assigned_to)} · ${campaignName(task.campaign_id) || clientName(task.client_id) || "Sin proyecto"}`,
      icon: "W",
      body: plannerBody(task, token),
      actions: [
        { label: "Cerrar", value: null, className: "ghost" },
        {
          label: "Guardar planificación",
          className: "primary",
          loadingLabel: "Guardando…",
          onClick: async () => {
            const patch = readPlanner(task.id, token);
            updateMeta(task.id, patch, "Planificación actualizada");
            notify("Planificación guardada", task.title || "Tarea", "success");
            return true;
          },
        },
      ],
    });
    requestAnimationFrame(() => {
      const host = document.getElementById("premiumModalBody");
      host?.querySelector("[data-v17-planner-action='timer']")?.addEventListener("click", () => {
        closePremiumModal?.();
        if (data.activeTimer?.taskId && sameId(data.activeTimer.taskId, task.id)) stopTimer(); else startTimer(task.id);
      });
      host?.querySelector("[data-v17-planner-action='subtask']")?.addEventListener("click", () => { closePremiumModal?.(); setTimeout(() => createSubtask(task.id), 40); });
      host?.querySelector("[data-v17-planner-action='repeat']")?.addEventListener("click", () => { closePremiumModal?.(); setTimeout(() => generateNextOccurrence(task.id), 40); });
      host?.querySelector("[data-v17-planner-action='template']")?.addEventListener("click", () => { closePremiumModal?.(); setTimeout(() => saveTemplate(task.id), 40); });
      host?.querySelector("[data-v17-planner-action='history']")?.addEventListener("click", () => { closePremiumModal?.(); setTimeout(() => openHistory(task.id), 40); });
    });
  }

  function startTimer(taskId) {
    const task = taskById(taskId);
    if (!task) return;
    if (data.activeTimer?.taskId && !sameId(data.activeTimer.taskId, taskId)) stopTimer(false);
    data.activeTimer = { taskId: String(taskId), startedAt: new Date().toISOString() };
    persistLocal();
    scheduleCloudSave();
    renderAllAdvanced();
    notify("Temporizador iniciado", task.title || "Tarea", "success");
  }

  async function stopTimer(showToast = true) {
    const timer = data.activeTimer;
    if (!timer) return;
    const task = taskById(timer.taskId);
    const started = new Date(timer.startedAt).getTime();
    const ended = Date.now();
    const minutes = Math.max(1, Math.round((ended - started) / 60000));
    const meta = getMeta(timer.taskId);
    data.activeTimer = null;
    updateMeta(timer.taskId, { trackedMinutes: meta.trackedMinutes + minutes }, `Tiempo registrado: ${minutes} min`);
    try {
      const entries = table("work360_time_entries");
      const uid = authUserId();
      if (entries && uid) await entries.insert({ user_id: uid, task_id: String(timer.taskId), started_at: new Date(started).toISOString(), ended_at: new Date(ended).toISOString(), minutes });
    } catch (error) {
      console.info("[v17] time entry cloud opcional", error?.message || error);
    }
    if (showToast) notify("Tiempo registrado", `${task?.title || "Tarea"} · ${formatMinutes(minutes)}`, "success");
  }

  function nextDate(baseDate, recurrence) {
    if (!baseDate || !recurrence || recurrence.frequency === "none") return "";
    const date = new Date(`${baseDate}T12:00:00`);
    const interval = Math.max(1, Number(recurrence.interval) || 1);
    if (recurrence.frequency === "daily") date.setDate(date.getDate() + interval);
    if (recurrence.frequency === "weekly") date.setDate(date.getDate() + interval * 7);
    if (recurrence.frequency === "monthly") date.setMonth(date.getMonth() + interval);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(date);
  }

  async function createTaskClone(source, overrides = {}) {
    if (typeof sb === "undefined" || !sb?.rpc) throw new Error("Supabase no está disponible.");
    const before = new Set(taskList().map((task) => String(task.id)));
    const payload = {
      p_title: overrides.title ?? source.title ?? "Nueva tarea",
      p_description: overrides.description ?? source.description ?? "",
      p_assigned_to: overrides.assigned_to ?? source.assigned_to ?? null,
      p_client_id: overrides.client_id ?? source.client_id ?? null,
      p_area_id: overrides.area_id ?? source.area_id ?? null,
      p_campaign_id: overrides.campaign_id ?? source.campaign_id ?? null,
      p_due_date: overrides.due_date ?? source.due_date ?? null,
      p_due_time: overrides.due_time ?? source.due_time ?? null,
      p_priority: overrides.priority ?? source.priority ?? "media",
      p_impact: Number(overrides.impact ?? source.impact ?? 3),
      p_checklist: Array.isArray(overrides.checklist ?? source.checklist) ? (overrides.checklist ?? source.checklist) : [],
    };
    const result = await sb.rpc("ibm_v30_create_task", payload);
    if (result.error) throw result.error;
    if (typeof loadAll === "function") await loadAll();
    const created = taskList().filter((task) => !before.has(String(task.id))).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
    if (typeof renderAll === "function") await renderAll();
    return created || (result.data?.id ? taskById(result.data.id) : null);
  }

  async function createSubtask(parentId) {
    const parent = taskById(parentId);
    if (!parent) return;
    const title = typeof premiumInputModal === "function" ? await premiumInputModal({ title: "Crear subtarea", subtitle: parent.title || "Tarea padre", label: "Título de la subtarea", placeholder: "Describe el siguiente paso", confirmLabel: "Crear subtarea", required: true }) : prompt("Título de la subtarea");
    if (!title) return;
    try {
      const created = await createTaskClone(parent, { title: String(title).trim(), description: `Subtarea de: ${parent.title || "Tarea"}` });
      if (created?.id) {
        const parentMeta = getMeta(parent.id);
        updateMeta(created.id, { parentTaskId: String(parent.id), estimateHours: parentMeta.estimateHours ? Math.max(.5, Math.round(parentMeta.estimateHours / 2 * 4) / 4) : 0 }, "Subtarea vinculada");
      }
      notify("Subtarea creada", String(title).trim(), "success");
    } catch (error) {
      notify("No se pudo crear la subtarea", error?.message || String(error), "error");
    }
  }

  async function generateNextOccurrence(taskId) {
    const task = taskById(taskId);
    const meta = getMeta(taskId);
    const dueDate = nextDate(task?.due_date, meta.recurrence);
    if (!task || !dueDate) return notify("Recurrencia incompleta", "Define una frecuencia y una fecha de entrega antes de generar la siguiente tarea.", "warning");
    const confirmed = typeof premiumConfirmModal === "function" ? await premiumConfirmModal({ title: "Generar siguiente tarea", subtitle: `${task.title || "Tarea"} · ${displayDate(dueDate)}`, preview: `Se creará una nueva tarea usando el flujo productivo existente.`, confirmLabel: "Generar" }) : confirm("¿Generar la siguiente tarea?");
    if (!confirmed) return;
    try {
      const created = await createTaskClone(task, { due_date: dueDate });
      if (created?.id) updateMeta(created.id, { ...meta, trackedMinutes: 0, parentTaskId: "" }, "Recurrencia heredada");
      notify("Siguiente tarea creada", `${task.title || "Tarea"} · ${displayDate(dueDate)}`, "success");
    } catch (error) {
      notify("No se pudo generar", error?.message || String(error), "error");
    }
  }

  function openHistory(taskId) {
    const task = taskById(taskId);
    if (!task || typeof openPremiumModal !== "function") return;
    const entries = data.history.filter((entry) => sameId(entry.taskId, taskId));
    openPremiumModal({
      title: "Historial de planificación",
      subtitle: task.title || "Tarea",
      icon: "H",
      body: `<div class="v17-history-list">${entries.length ? entries.map((entry) => `<article class="v17-history-item"><div><strong>${escHtml(entry.action)}</strong><span>${escHtml(entry.actorName || "Usuario")} · ${new Date(entry.at).toLocaleString("es-PE")}</span></div><button type="button" data-v17-restore="${escHtml(entry.id)}">Restaurar</button></article>`).join("") : `<div class="v17-empty">Todavía no existen cambios de planificación.</div>`}</div>`,
      actions: [{ label: "Cerrar", value: true, className: "ghost" }],
    });
    requestAnimationFrame(() => document.querySelectorAll("[data-v17-restore]").forEach((button) => button.addEventListener("click", () => restoreHistory(button.dataset.v17Restore))));
  }

  function restoreHistory(historyId) {
    const entry = data.history.find((item) => item.id === historyId);
    if (!entry) return;
    closePremiumModal?.();
    updateMeta(entry.taskId, entry.before, `Restauración: ${entry.action}`);
    notify("Versión restaurada", taskById(entry.taskId)?.title || "Tarea", "success");
  }

  async function bulkPlan() {
    const ids = [...selected].filter(taskById);
    if (!ids.length || typeof openPremiumModal !== "function") return;
    const token = `v17bulk_${Math.random().toString(36).slice(2, 8)}`;
    openPremiumModal({
      title: "Planificación masiva",
      subtitle: `${ids.length} tareas seleccionadas`,
      icon: "B",
      body: `<div class="v17-planner-grid"><label>Estimación por tarea<input id="${token}_estimate" type="number" min="0" step="0.25" placeholder="Ej. 2"></label><label>Etiquetas<input id="${token}_tags" placeholder="urgente, diseño"></label><label class="full">Nota común<textarea id="${token}_notes" class="v17-planner-note" placeholder="Contexto para las tareas seleccionadas"></textarea></label></div>`,
      actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Aplicar", className: "primary", onClick: async () => {
          const estimate = Number(document.getElementById(`${token}_estimate`)?.value) || 0;
          const tags = String(document.getElementById(`${token}_tags`)?.value || "").split(",").map((item) => item.trim()).filter(Boolean);
          const notes = String(document.getElementById(`${token}_notes`)?.value || "").trim();
          ids.forEach((id) => updateMeta(id, { estimateHours: estimate || getMeta(id).estimateHours, tags: tags.length ? tags : getMeta(id).tags, notes: notes || getMeta(id).notes }, "Planificación masiva"));
          clearSelection();
          notify("Planificación aplicada", `${ids.length} tareas actualizadas.`, "success");
          return true;
        } },
      ],
    });
  }

  function exportSelectedCsv() {
    const tasks = [...selected].map(taskById).filter(Boolean);
    if (!tasks.length) return;
    const rows = [["Tarea", "Responsable", "Campaña", "Estado", "Prioridad", "Fecha", "Estimación h", "Tiempo min", "Bloqueada", "Etiquetas"]];
    for (const task of tasks) {
      const meta = getMeta(task.id);
      rows.push([task.title || "", personName(task.assigned_to), campaignName(task.campaign_id) || clientName(task.client_id), task.status || "", task.priority || "", task.due_date || "", meta.estimateHours, meta.trackedMinutes, isBlocked(task.id) ? "Sí" : "No", meta.tags.join(" | ")]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `work360_${dateKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
    notify("Exportación creada", `${tasks.length} tareas incluidas.`, "success");
  }

  function renderAllAdvanced() {
    loadLocal();
    ensureShell();
    void loadCloud();
    const tasks = visibleTasks();
    renderSyncState();
    renderMetrics(tasks);
    renderSelectors();
    renderTabs();
    renderTimer();
    renderBulkBar();
    renderAlternate(tasks);
  }

  function installRenderBridge() {
    if (baseRenderTasks || typeof window.renderTasks !== "function") return;
    baseRenderTasks = window.renderTasks;
    window.renderTasks = function () {
      const result = baseRenderTasks.apply(this, arguments);
      try { renderAllAdvanced(); } catch (error) { console.error("[v17] render bridge", error); }
      return result;
    };
  }

  function installKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || String(event.key).toLowerCase() !== "w") return;
      event.preventDefault();
      if (typeof navTo === "function") navTo("tasks");
      setTimeout(() => { ensureShell(); setView("list"); }, 60);
    });
  }

  function boot() {
    installRenderBridge();
    installKeyboard();
    ensureShell();
    renderAllAdvanced();
  }

  window.v17OpenTaskPlanner = openPlanner;
  window.v17StopTimer = stopTimer;
  window.INBESTIGA_WORK360_ADVANCED = {
    version: VERSION,
    build: BUILD,
    refresh: renderAllAdvanced,
    openPlanner,
    setView,
    getMeta,
    updateMeta,
    startTimer,
    stopTimer,
    createSubtask,
    generateNextOccurrence,
    exportSelectedCsv,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
