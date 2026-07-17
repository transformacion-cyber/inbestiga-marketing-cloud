/* ===== INBESTIGA v17.11.2 · TASK OPERATIONS · FOCUS REFRESH HOTFIX (v17.12.10) ===== */
(() => {
  "use strict";

  if (window.INBESTIGA_V1711) return;

  const VERSION = "v17.12.10";
  const BUILD = "TASK OPERATIONS, CATALOGS & PERFORMANCE RANKING";
  const MANAGER_ROLES = new Set(["italo", "jhulio", "alejandro", "director", "admin", "administrator", "supervisor"]);
  const DIRECTOR_ROLES = new Set(["italo", "director", "admin", "administrator"]);
  const DONE = new Set(["aprobado", "publicado", "completado", "completada", "finalizado", "finalizada", "done", "hecho"]);
  const LOCAL_KEY = "inbestiga:v1711:operations";
  const ROMAN = ["I", "II", "III", "IV", "V"];

  let initialized = false;
  let cloudAvailable = false;
  let dashboard = emptyDashboard();
  let realtimeChannel = null;
  let refreshTimer = null;
  let wrapped = false;
  let cloudLastError = null;
  let cloudCheckPromise = null;
  let cloudLastCheckedAt = 0;
  const CLOUD_RETRY_MS = 5000;

  function emptyDashboard() {
    return {
      version: VERSION,
      operations: [], efforts: [], dependencies: [], reviews: [], ledger: [], ranking: [],
      rank_tiers: [], catalog_lifecycle: [], occurrences: []
    };
  }

  const arr = (value) => Array.isArray(value) ? value : [];
  const str = (value) => String(value ?? "");
  const lower = (value) => str(value).trim().toLowerCase();
  const same = (a, b) => str(a) === str(b);
  const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const escHtml = (value) => {
    try { if (typeof window.esc === "function") return window.esc(value); } catch (_) {}
    return str(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  };
  const getState = () => { try { return typeof state !== "undefined" ? state : null; } catch (_) { return null; } };
  const getMember = () => { try { return typeof member !== "undefined" ? member : null; } catch (_) { return null; } };
  const getAuthUser = () => { try { return typeof authUser !== "undefined" ? authUser : null; } catch (_) { return null; } };
  const getSb = () => { try { return typeof sb !== "undefined" ? sb : null; } catch (_) { return null; } };
  const role = () => lower(getMember()?.role_code || getMember()?.role);
  const isManager = () => MANAGER_ROLES.has(role()) || (() => { try { return !!window.isSupervisor?.(); } catch (_) { return false; } })();
  const isDirector = () => DIRECTOR_ROLES.has(role());
  const taskList = () => arr(getState()?.tasks);
  const memberList = () => arr(getState()?.members).filter((person) => lower(person?.status || "active") === "active");
  const clientList = () => arr(getState()?.clients);
  const campaignList = () => arr(getState()?.campaigns);
  const taskById = (id) => taskList().find((task) => same(task?.id, id));
  const memberById = (id) => memberList().find((person) => same(person?.id, id));
  const clientById = (id) => clientList().find((item) => same(item?.id, id));
  const campaignById = (id) => campaignList().find((item) => same(item?.id, id));
  const memberName = (id) => memberById(id)?.full_name || "Sin asignar";
  const taskDone = (task) => {
    try { if (typeof window.v412TaskDone === "function") return !!window.v412TaskDone(task); } catch (_) {}
    return DONE.has(lower(task?.status).replaceAll(" ", "_"));
  };
  const notify = (title, detail = "", tone = "success") => {
    if (typeof window.premiumToast === "function") return window.premiumToast(title, detail, tone);
    if (typeof window.toast === "function") return window.toast(title, detail);
    console[tone === "error" ? "error" : "log"](`[${VERSION}] ${title}`, detail);
  };

  function localKey() { return `${LOCAL_KEY}:${getAuthUser()?.id || getMember()?.id || "guest"}`; }
  function loadLocal() {
    try { return { ...emptyDashboard(), ...(JSON.parse(localStorage.getItem(localKey()) || "null") || {}) }; }
    catch (_) { return emptyDashboard(); }
  }
  function saveLocal() {
    try { localStorage.setItem(localKey(), JSON.stringify({ ...dashboard, version: VERSION, updated_at: new Date().toISOString() })); }
    catch (_) {}
  }

  function operation(taskId) { return arr(dashboard.operations).find((row) => same(row.task_id, taskId)) || null; }
  function efforts(taskId) { return arr(dashboard.efforts).filter((row) => same(row.task_id, taskId)); }
  function effort(taskId, memberId) { return efforts(taskId).find((row) => same(row.member_id, memberId)) || null; }
  function dependencies(taskId) { return arr(dashboard.dependencies).filter((row) => same(row.task_id, taskId)); }
  function reviews(taskId) { return arr(dashboard.reviews).filter((row) => same(row.task_id, taskId)); }
  function catalogState(type, id) { return arr(dashboard.catalog_lifecycle).find((row) => row.entity_type === type && same(row.entity_id, id))?.state || "active"; }
  function participantIds(taskId) {
    const workspace = window.INBESTIGA_V179?.workspace?.() || {};
    const ids = arr(workspace.task_participants).filter((row) => same(row.task_id, taskId) && lower(row.status || "active") === "active").map((row) => row.member_id);
    const primary = taskById(taskId)?.assigned_to;
    if (primary) ids.unshift(primary);
    return [...new Set(ids.filter(Boolean).map(str))];
  }
  function canParticipate(taskId) { return isManager() || participantIds(taskId).some((id) => same(id, getMember()?.id)) || same(operation(taskId)?.responsible_member_id, getMember()?.id); }

  function minutesFrom(hoursId, minutesId) {
    const hours = Math.max(0, num(document.getElementById(hoursId)?.value));
    const minutes = Math.max(0, Math.min(59, num(document.getElementById(minutesId)?.value)));
    return Math.round(hours * 60 + minutes);
  }
  function hoursParts(totalMinutes) {
    const total = Math.max(0, num(totalMinutes));
    return { hours: Math.floor(total / 60), minutes: Math.round(total % 60) };
  }
  function formatMinutes(value) {
    const total = Math.max(0, num(value));
    if (!total) return "0 h";
    const h = Math.floor(total / 60), m = Math.round(total % 60);
    return `${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""}`;
  }
  function formatDate(value) {
    if (!value) return "Sin fecha";
    try { return new Date(String(value).length <= 10 ? `${value}T12:00:00` : value).toLocaleString("es-PE", { dateStyle: "medium", ...(String(value).length > 10 ? { timeStyle: "short" } : {}) }); }
    catch (_) { return str(value); }
  }
  function todayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()); }

  function rpcErrorText(error) {
    if (!error) return "";
    return [error.message, error.details, error.hint].filter(Boolean).join(" · ") || str(error);
  }
  function normalizeRpcPayload(data) {
    if (Array.isArray(data)) return data[0] || null;
    if (typeof data === "string") { try { return JSON.parse(data); } catch (_) { return data; } }
    return data;
  }
  async function callRpc(name, params) {
    const client = getSb();
    if (!client?.rpc) return { data: null, error: new Error("Supabase todavía no está disponible en esta sesión.") };
    const attempts = [];
    if (typeof client.schema === "function") {
      try { const scoped = client.schema("marketing_app"); if (scoped?.rpc) attempts.push(scoped); } catch (_) {}
    }
    attempts.push(client);
    const seen = new Set();
    let last = { data: null, error: new Error(`No se pudo invocar ${name}.`) };
    for (const api of attempts) {
      if (!api || seen.has(api)) continue;
      seen.add(api);
      try {
        const result = await api.rpc(name, params);
        if (!result?.error) return result || { data: null, error: null };
        last = result;
      } catch (error) { last = { data: null, error }; }
    }
    return last;
  }
  function backendUnavailableMessage() {
    const text = rpcErrorText(cloudLastError).toLowerCase();
    if (text.includes("schema") && (text.includes("exposed") || text.includes("profile"))) return "El esquema marketing_app no está expuesto en Supabase Data API.";
    if (text.includes("permission") || text.includes("42501")) return "La cuenta autenticada no tiene permisos para Operación 360+.";
    if (text.includes("schema cache") || text.includes("pgrst202") || text.includes("could not find the function")) return "Supabase aún no actualizó su caché de funciones.";
    return "No se pudo conectar con Operación 360+; los datos permanecerán locales hasta recuperar la conexión.";
  }

  async function checkBackend(force = false) {
    if (cloudAvailable && !force) return true;
    if (!getAuthUser()?.id) return false;
    if (!force && cloudLastCheckedAt && Date.now() - cloudLastCheckedAt < CLOUD_RETRY_MS) return false;
    if (cloudCheckPromise) return cloudCheckPromise;
    cloudCheckPromise = (async () => {
      cloudLastCheckedAt = Date.now();
      try {
        const { data, error } = await callRpc("ibm_v1711_capabilities");
        if (error) throw error;
        const value = normalizeRpcPayload(data) || {};
        cloudAvailable = str(value.version).replace(/^v/i, "") === "17.11" || value.task_operations === true;
        if (!cloudAvailable) throw new Error("La respuesta de capacidades v17.11 no fue reconocida.");
        cloudLastError = null;
      } catch (error) {
        cloudAvailable = false;
        cloudLastError = error;
        console.warn("[v17.11.1] No se pudo validar Operación 360+.", rpcErrorText(error));
      }
      updateBackendNotice();
      return cloudAvailable;
    })();
    try { return await cloudCheckPromise; }
    finally { cloudCheckPromise = null; }
  }

  async function refreshDashboard({ render = false } = {}) {
    if (!await checkBackend()) {
      dashboard = loadLocal();
      if (render) renderAffectedViews();
      return dashboard;
    }
    try {
      const { data, error } = await callRpc("ibm_v1711_dashboard");
      if (error) throw error;
      dashboard = { ...emptyDashboard(), ...(data || {}) };
      saveLocal();
    } catch (error) {
      console.warn("[v17.11] Dashboard remoto", error);
      dashboard = loadLocal();
    }
    if (render) renderAffectedViews();
    return dashboard;
  }

  function backendNoticeMarkup() {
    return `<div id="v1711BackendNotice" class="v1711-backend-notice ${cloudAvailable ? "ready" : "local"}">
      <i></i><div><strong>${cloudAvailable ? "Operación 360+ conectada" : "Operación 360+ en modo local"}</strong>
      <span>${cloudAvailable ? "Horas manuales, responsables, recurrencia, catálogos, calificaciones y ranking sincronizados." : backendUnavailableMessage()}</span></div>
      <button type="button" data-v1711-open="operations">Abrir centro</button></div>`;
  }
  function updateBackendNotice() {
    document.querySelectorAll("#v1711BackendNotice").forEach((node) => node.remove());
    const target = document.getElementById("v413TaskCommand") || document.getElementById("tasks");
    if (target) target.insertAdjacentHTML("afterbegin", backendNoticeMarkup());
    bindActions(target || document);
  }

  function membersOptions(selected = "", blank = "Selecciona") {
    return `<option value="">${escHtml(blank)}</option>${memberList().map((person) => `<option value="${escHtml(person.id)}" ${same(person.id, selected) ? "selected" : ""}>${escHtml(person.full_name)} · ${escHtml(person.position || person.role_code || "Equipo")}</option>`).join("")}`;
  }
  function tasksOptions(selected = "", exclude = "") {
    return `<option value="">Sin dependencia</option>${taskList().filter((task) => !same(task.id, exclude)).map((task) => `<option value="${escHtml(task.id)}" ${same(task.id, selected) ? "selected" : ""}>${escHtml(task.title)} · ${escHtml(memberName(task.assigned_to))}</option>`).join("")}`;
  }

  function taskPlanFieldsMarkup(prefix = "v1711Task", existing = null, taskId = "") {
    const parts = hoursParts(existing?.estimated_minutes);
    const dep = dependencies(taskId)[0];
    const days = new Set(arr(existing?.recurrence_days).map(Number));
    return `<section class="v1711-form-section" data-v1711-task-plan>
      <div class="v1711-form-head"><div><span>PLANIFICACIÓN 360+</span><h4>Responsabilidad, esfuerzo y recurrencia</h4></div><b>${cloudAvailable ? "Sincronizado" : "Local"}</b></div>
      <div class="v1711-form-grid">
        <label><span>Responsable final</span><select id="${prefix}Responsible">${membersOptions(existing?.responsible_member_id || getMember()?.id, "Sin responsable final")}</select><small>Responde por el seguimiento; puede ser diferente de quien ejecuta.</small></label>
        <label><span>Complejidad</span><select id="${prefix}Complexity"><option value="simple">Simple</option><option value="media">Media</option><option value="alta">Alta</option><option value="critica">Crítica</option></select><small>Define el bono de puntos antes de la entrega.</small></label>
        <label><span>Horas estimadas por el jefe</span><div class="v1711-hours"><input id="${prefix}EstimateHours" type="number" min="0" max="10000" step="1" value="${parts.hours}"><em>h</em><input id="${prefix}EstimateMinutes" type="number" min="0" max="59" value="${parts.minutes}"><em>min</em></div></label>
        <label><span>Depende de otra tarea</span><select id="${prefix}Dependency">${tasksOptions(dep?.depends_on_task_id || "", taskId)}</select></label>
        <label><span>Tipo de dependencia</span><select id="${prefix}DependencyType"><option value="finish_to_start">No iniciar hasta que termine</option><option value="finish_to_finish">No finalizar hasta que termine</option><option value="related">Relacionada, no bloqueante</option></select></label>
        <label><span>Tarea repetitiva</span><select id="${prefix}Recurrence"><option value="none">No repetir</option><option value="daily">Todos los días</option><option value="weekdays">Lunes a viernes</option><option value="weekly">Semanal</option><option value="biweekly">Quincenal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option><option value="custom">Intervalo personalizado</option></select></label>
        <label><span>Intervalo</span><input id="${prefix}RecurrenceInterval" type="number" min="1" max="365" value="${num(existing?.recurrence_interval, 1)}"><small>Ej.: cada 2 semanas o cada 3 días.</small></label>
        <label><span>Primera / próxima ejecución</span><input id="${prefix}NextDue" type="date" value="${escHtml(existing?.next_due_date || document.getElementById("taskDue")?.value || "")}"></label>
        <label><span>Fin de recurrencia</span><input id="${prefix}RecurrenceEnd" type="date" value="${escHtml(existing?.recurrence_end_date || "")}"></label>
        <fieldset class="v1711-weekdays"><legend>Días personalizados</legend>${[1,2,3,4,5,6,7].map((day, index) => `<label><input type="checkbox" value="${day}" ${days.has(day) ? "checked" : ""}><span>${["L","M","X","J","V","S","D"][index]}</span></label>`).join("")}</fieldset>
      </div>
    </section>`;
  }

  function applyPlanValues(prefix, existing = null, taskId = "") {
    const complexity = document.getElementById(`${prefix}Complexity`);
    if (complexity) complexity.value = existing?.complexity || "media";
    const depType = document.getElementById(`${prefix}DependencyType`);
    if (depType) depType.value = dependencies(taskId)[0]?.dependency_type || "finish_to_start";
    const recurrence = document.getElementById(`${prefix}Recurrence`);
    if (recurrence) recurrence.value = existing?.recurrence_frequency || "none";
  }

  function ensureTaskFormEnhancements() {
    const form = document.getElementById("taskForm");
    if (!form || document.getElementById("v1711TaskResponsible")) return;
    const button = form.querySelector("button[type='submit'],button:not([type])");
    button?.insertAdjacentHTML("beforebegin", taskPlanFieldsMarkup("v1711Task", null, ""));
    applyPlanValues("v1711Task");
  }

  function ensureQuickTaskEnhancements() {
    const title = document.getElementById("v179QuickTaskTitle");
    if (!title || document.getElementById("v1711QuickResponsible")) return;
    const grid = title.closest(".v179-modal-grid");
    if (!grid) return;
    const refs = document.getElementById("v179QuickTaskFiles")?.closest("label") || grid.lastElementChild;
    refs?.insertAdjacentHTML("beforebegin", taskPlanFieldsMarkup("v1711Quick", null, ""));
    applyPlanValues("v1711Quick");
  }

  function collectPlan(prefix, taskId = "") {
    const recurrence = document.getElementById(`${prefix}Recurrence`)?.value || "none";
    const dependencyId = document.getElementById(`${prefix}Dependency`)?.value || "";
    const days = Array.from(document.querySelectorAll(`#${CSS.escape(prefix + "Responsible")} ~ * input`));
    const section = document.getElementById(`${prefix}Responsible`)?.closest("[data-v1711-task-plan]");
    const selectedDays = Array.from(section?.querySelectorAll(".v1711-weekdays input:checked") || []).map((input) => Number(input.value));
    return {
      taskId,
      responsible: document.getElementById(`${prefix}Responsible`)?.value || null,
      estimatedMinutes: minutesFrom(`${prefix}EstimateHours`, `${prefix}EstimateMinutes`),
      complexity: document.getElementById(`${prefix}Complexity`)?.value || "media",
      recurrence: {
        frequency: recurrence,
        interval: Math.max(1, num(document.getElementById(`${prefix}RecurrenceInterval`)?.value, 1)),
        days: selectedDays,
        end_date: document.getElementById(`${prefix}RecurrenceEnd`)?.value || null,
        active: recurrence !== "none",
        next_due_date: document.getElementById(`${prefix}NextDue`)?.value || document.getElementById("taskDue")?.value || null,
        next_due_time: document.getElementById("taskTime")?.value || document.getElementById("v179QuickTaskTime")?.value || null
      },
      dependencies: dependencyId ? [{ task_id: dependencyId, type: document.getElementById(`${prefix}DependencyType`)?.value || "finish_to_start" }] : []
    };
  }

  async function saveTaskPlan(taskId, plan) {
    if (!taskId) return;
    if (!await checkBackend()) {
      const existing = arr(dashboard.operations).filter((row) => !same(row.task_id, taskId));
      dashboard.operations = [...existing, { task_id: taskId, responsible_member_id: plan.responsible, estimated_minutes: plan.estimatedMinutes, complexity: plan.complexity, recurrence_frequency: plan.recurrence.frequency, recurrence_interval: plan.recurrence.interval, recurrence_days: plan.recurrence.days, recurrence_end_date: plan.recurrence.end_date, recurrence_active: plan.recurrence.active, next_due_date: plan.recurrence.next_due_date, next_due_time: plan.recurrence.next_due_time, updated_at: new Date().toISOString() }];
      dashboard.dependencies = [...arr(dashboard.dependencies).filter((row) => !same(row.task_id, taskId)), ...plan.dependencies.map((dep) => ({ task_id: taskId, depends_on_task_id: dep.task_id, dependency_type: dep.type }))];
      saveLocal();
      return;
    }
    const { error } = await callRpc("ibm_v1711_upsert_task_plan", {
      p_task_id: taskId,
      p_responsible_member_id: plan.responsible,
      p_estimated_minutes: plan.estimatedMinutes,
      p_complexity: plan.complexity,
      p_recurrence: plan.recurrence,
      p_dependencies: plan.dependencies
    });
    if (error) throw error;
    await refreshDashboard();
  }

  async function onTaskCreated(event) {
    const taskId = event?.detail?.taskId;
    if (!taskId || !isManager()) return;
    const source = event.detail.source === "quick" ? "v1711Quick" : "v1711Task";
    try {
      const plan = collectPlan(source, taskId);
      await saveTaskPlan(taskId, plan);
      notify("Planificación guardada", "Responsable, horas, dependencia y recurrencia quedaron vinculados.", "success");
    } catch (error) { notify("La tarea se creó, pero faltó la planificación 360+", error?.message || error, "warning"); }
  }

  function ensureDeliveryEnhancements() {
    const modal = document.getElementById("v179DeliveryComment")?.closest(".v179-modal-grid");
    if (!modal || document.getElementById("v1711DeliveryActualHours")) return;
    const comment = document.getElementById("v179DeliveryComment")?.closest("label");
    comment?.insertAdjacentHTML("beforebegin", `<section class="v1711-delivery-effort"><div><span>TIEMPO REAL MANUAL</span><strong>¿Cuánto duró tu parte?</strong></div><label>Horas<input id="v1711DeliveryActualHours" type="number" min="0" max="10000" step="1" value="0"></label><label>Minutos<input id="v1711DeliveryActualMinutes" type="number" min="0" max="59" value="0"></label><small>No necesitas usar temporizador. El responsable podrá validar este dato al aprobar.</small></section>`);
  }

  async function onSubmissionCreated(event) {
    const taskId = event?.detail?.taskId;
    if (!taskId) return;
    const actualMinutes = minutesFrom("v1711DeliveryActualHours", "v1711DeliveryActualMinutes");
    if (!actualMinutes) return;
    try {
      await recordEffort(taskId, { actualMinutes, comment: document.getElementById("v179DeliveryComment")?.value || "Horas declaradas al entregar" });
    } catch (error) { notify("La entrega se guardó; las horas requieren revisión", error?.message || error, "warning"); }
  }

  async function recordEffort(taskId, { memberId = null, acceptanceStatus = null, estimateMinutes = null, actualMinutes = null, comment = "" } = {}) {
    if (!await checkBackend()) {
      const target = memberId || getMember()?.id;
      const previous = effort(taskId, target) || {};
      dashboard.efforts = [...arr(dashboard.efforts).filter((row) => !(same(row.task_id, taskId) && same(row.member_id, target))), { ...previous, task_id: taskId, member_id: target, acceptance_status: acceptanceStatus || previous.acceptance_status || "pending", executor_estimate_minutes: estimateMinutes ?? previous.executor_estimate_minutes, actual_minutes: actualMinutes ?? previous.actual_minutes, updated_at: new Date().toISOString() }];
      saveLocal();
      return;
    }
    const { error } = await callRpc("ibm_v1711_record_effort", {
      p_task_id: taskId, p_member_id: memberId, p_acceptance_status: acceptanceStatus,
      p_executor_estimate_minutes: estimateMinutes, p_actual_minutes: actualMinutes, p_comment: comment
    });
    if (error) throw error;
    await refreshDashboard();
  }

  function effortModal(taskId, targetMemberId = null) {
    const target = targetMemberId || getMember()?.id;
    const row = effort(taskId, target);
    const estimate = hoursParts(row?.executor_estimate_minutes), actual = hoursParts(row?.actual_minutes);
    const body = `<div class="v1711-modal-grid">
      <div class="v1711-modal-callout"><span>REGISTRO MANUAL</span><h3>${escHtml(taskById(taskId)?.title || "Tarea")}</h3><p>${escHtml(memberName(target))}</p></div>
      <label><span>Estado</span><select id="v1711EffortStatus"><option value="accepted">Acepto la tarea</option><option value="proposed">Acepto con nueva estimación</option><option value="clarification">Solicito aclaración</option><option value="blocked">Reporto bloqueo</option></select></label>
      <label><span>Horas previstas por el ejecutor</span><div class="v1711-hours"><input id="v1711EffortEstimateHours" type="number" min="0" value="${estimate.hours}"><em>h</em><input id="v1711EffortEstimateMinutes" type="number" min="0" max="59" value="${estimate.minutes}"><em>min</em></div></label>
      <label><span>Horas reales</span><div class="v1711-hours"><input id="v1711EffortActualHours" type="number" min="0" value="${actual.hours}"><em>h</em><input id="v1711EffortActualMinutes" type="number" min="0" max="59" value="${actual.minutes}"><em>min</em></div></label>
      <label class="full"><span>Comentario</span><textarea id="v1711EffortComment" rows="4" placeholder="Explica la estimación, el bloqueo o la diferencia de horas.">${escHtml(row?.actual_comment || row?.acceptance_comment || "")}</textarea></label>
    </div>`;
    window.openPremiumModal?.({ title: "Aceptar y registrar horas", subtitle: "Sin temporizador obligatorio", body, actions: [
      { label: "Cancelar", value: null, className: "ghost" },
      { label: "Guardar", className: "primary", loadingLabel: "Guardando…", onClick: async () => {
        await recordEffort(taskId, { memberId: targetMemberId, acceptanceStatus: document.getElementById("v1711EffortStatus")?.value || "accepted", estimateMinutes: minutesFrom("v1711EffortEstimateHours", "v1711EffortEstimateMinutes"), actualMinutes: minutesFrom("v1711EffortActualHours", "v1711EffortActualMinutes") || null, comment: document.getElementById("v1711EffortComment")?.value || "" });
        notify("Horas actualizadas", "El registro quedó guardado con trazabilidad.", "success");
        return true;
      } }
    ] });
  }

  function planModal(taskId) {
    const existing = operation(taskId);
    const body = `<div class="v1711-modal-grid">${taskPlanFieldsMarkup("v1711Edit", existing, taskId)}</div>`;
    window.openPremiumModal?.({ title: "Planificación de tarea", subtitle: taskById(taskId)?.title || "Trabajo 360", body, actions: [
      { label: "Cancelar", value: null, className: "ghost" },
      { label: "Guardar planificación", className: "primary", loadingLabel: "Guardando…", onClick: async () => {
        await saveTaskPlan(taskId, collectPlan("v1711Edit", taskId));
        notify("Planificación actualizada", "Los cambios ya están disponibles para el equipo.", "success");
        return true;
      } }
    ] });
    requestAnimationFrame(() => applyPlanValues("v1711Edit", existing, taskId));
  }

  function reviewModal(taskId) {
    const participants = participantIds(taskId);
    if (!participants.length) return notify("Sin participantes", "La tarea no tiene ejecutores para calificar.", "warning");
    const body = `<div class="v1711-modal-grid"><div class="v1711-modal-callout"><span>CALIFICACIÓN Y PUNTOS</span><h3>${escHtml(taskById(taskId)?.title || "Tarea")}</h3><p>La nota del jefe es de 1 a 10. El sistema suma puntos por complejidad, evidencia, puntualidad y aprobación.</p></div>
      <label><span>Miembro evaluado</span><select id="v1711ReviewMember">${participants.map((id) => `<option value="${escHtml(id)}">${escHtml(memberName(id))}</option>`).join("")}</select></label>
      <label><span>Decisión</span><select id="v1711ReviewDecision"><option value="approved">Aprobada</option><option value="approved_with_notes">Aprobada con observaciones</option><option value="observed">Devuelta / observada</option></select></label>
      <label><span>Nota del jefe · 1 a 10</span><input id="v1711ReviewScore" type="number" min="1" max="10" value="8" required></label>
      <label><span>Horas reales validadas</span><div class="v1711-hours"><input id="v1711ReviewHours" type="number" min="0" value="0"><em>h</em><input id="v1711ReviewMinutes" type="number" min="0" max="59" value="0"><em>min</em></div></label>
      <label class="full"><span>Fortalezas</span><textarea id="v1711ReviewStrengths" rows="3" placeholder="Qué estuvo bien en el trabajo"></textarea></label>
      <label class="full"><span>Mejoras necesarias</span><textarea id="v1711ReviewImprovements" rows="3" placeholder="Obligatorio si la nota es menor de 7"></textarea></label>
      <label class="full"><span>Comentario final</span><textarea id="v1711ReviewComment" rows="3"></textarea></label></div>`;
    window.openPremiumModal?.({ title: "Calificar trabajo", subtitle: "Nota 1–10 + puntos automáticos", body, actions: [
      { label: "Cancelar", value: null, className: "ghost" },
      { label: "Guardar calificación", className: "primary", loadingLabel: "Calculando…", onClick: async () => {
        if (!await checkBackend()) throw new Error("Instala SQL_OPCIONAL_v17_11.sql para registrar puntajes y ranking.");
        const score = num(document.getElementById("v1711ReviewScore")?.value);
        const improvements = document.getElementById("v1711ReviewImprovements")?.value || "";
        if (score < 1 || score > 10) throw new Error("La nota debe estar entre 1 y 10.");
        if (score < 7 && !improvements.trim()) throw new Error("Indica las mejoras necesarias para notas menores de 7.");
        const validated = minutesFrom("v1711ReviewHours", "v1711ReviewMinutes") || null;
        const { data, error } = await callRpc("ibm_v1711_review_task_performance", {
          p_task_id: taskId,
          p_member_id: document.getElementById("v1711ReviewMember")?.value,
          p_manual_score: score,
          p_decision: document.getElementById("v1711ReviewDecision")?.value,
          p_strengths: document.getElementById("v1711ReviewStrengths")?.value || "",
          p_improvements: improvements,
          p_comment: document.getElementById("v1711ReviewComment")?.value || "",
          p_validated_actual_minutes: validated
        });
        if (error) throw error;
        await refreshDashboard();
        try { await window.loadAll?.(); await window.renderAll?.(); } catch (_) {}
        const rank = data?.rank;
        notify("Trabajo calificado", rank ? `${rank.tier_name} ${ROMAN[Math.max(0, num(rank.division, 1) - 1)]} · Nivel ${rank.level}` : "Puntos y nota actualizados.", "success");
        return true;
      } }
    ] });
  }

  function planSummaryMarkup(taskId) {
    const op = operation(taskId), deps = dependencies(taskId), rows = efforts(taskId), taskReviews = reviews(taskId);
    if (!op && !rows.length && !deps.length && !taskReviews.length) return `<section class="v1711-detail-card empty"><div><span>OPERACIÓN 360+</span><h4>Sin planificación avanzada</h4><p>El responsable puede registrar estimación, dependencias y recurrencia.</p></div>${isManager() ? `<button type="button" data-v1711-plan="${escHtml(taskId)}">Configurar</button>` : ""}</section>`;
    const estimate = op?.estimated_minutes || 0;
    const totalActual = rows.reduce((sum, row) => sum + num(row.validated_minutes ?? row.actual_minutes), 0);
    const variance = totalActual - estimate;
    return `<section class="v1711-detail-card"><div class="v1711-detail-head"><div><span>OPERACIÓN 360+</span><h4>Plan, horas y responsabilidad</h4></div>${isManager() ? `<button type="button" data-v1711-plan="${escHtml(taskId)}">Editar</button>` : ""}</div>
      <div class="v1711-metrics"><article><span>Responsable final</span><strong>${escHtml(memberName(op?.responsible_member_id))}</strong></article><article><span>Estimado por el jefe</span><strong>${formatMinutes(estimate)}</strong></article><article><span>Real total</span><strong>${formatMinutes(totalActual)}</strong><small class="${variance > 0 ? "danger" : "good"}">${variance >= 0 ? "+" : ""}${formatMinutes(Math.abs(variance))} vs. plan</small></article><article><span>Complejidad</span><strong>${escHtml(op?.complexity || "media")}</strong></article></div>
      <div class="v1711-effort-list">${rows.length ? rows.map((row) => `<article><div><strong>${escHtml(memberName(row.member_id))}</strong><span>${escHtml(row.acceptance_status || "pending")}</span></div><div><small>Previsto</small><b>${formatMinutes(row.executor_estimate_minutes)}</b></div><div><small>Real</small><b>${formatMinutes(row.validated_minutes ?? row.actual_minutes)}</b></div>${(same(row.member_id, getMember()?.id) || isManager()) ? `<button type="button" data-v1711-effort="${escHtml(taskId)}:${escHtml(row.member_id)}">Actualizar</button>` : ""}</article>`).join("") : `<div class="v1711-empty">Nadie ha registrado horas todavía.</div>`}</div>
      ${deps.length ? `<div class="v1711-dependency"><strong>Dependencias</strong>${deps.map((dep) => `<button type="button" data-v1711-open-task="${escHtml(dep.depends_on_task_id)}">${escHtml(taskById(dep.depends_on_task_id)?.title || "Tarea relacionada")} · ${escHtml(dep.dependency_type)}</button>`).join("")}</div>` : ""}
      ${op?.recurrence_active ? `<div class="v1711-recurrence"><span>REPETITIVA</span><strong>${escHtml(op.recurrence_frequency)} · próxima ${escHtml(formatDate(op.next_due_date))}</strong>${isManager() ? `<button type="button" data-v1711-generate="${escHtml(taskId)}">Generar siguiente ejecución</button>` : ""}</div>` : ""}
      ${taskReviews.length ? `<div class="v1711-review-list">${taskReviews.map((review) => `<article><strong>${escHtml(memberName(review.member_id))}</strong><b>${review.manual_score}/10</b><span>${review.total_points} puntos · ${escHtml(review.decision)}</span></article>`).join("")}</div>` : ""}
      <div class="v1711-detail-actions">${canParticipate(taskId) ? `<button type="button" data-v1711-effort="${escHtml(taskId)}:${escHtml(getMember()?.id)}">Aceptar / registrar horas</button>` : ""}${isManager() ? `<button type="button" class="primary" data-v1711-review="${escHtml(taskId)}">Calificar 1–10</button>` : ""}</div>
    </section>`;
  }

  function enhanceTaskDetail(taskId) {
    const host = document.getElementById("premiumModalBody");
    const detail = host?.querySelector(".v66-task-detail") || host;
    if (!detail || detail.querySelector("[data-v1711-detail]")) return;
    const wrapper = document.createElement("div");
    wrapper.dataset.v1711Detail = "1";
    wrapper.innerHTML = planSummaryMarkup(taskId);
    const dock = detail.querySelector(".v66-action-dock");
    dock?.insertAdjacentElement("beforebegin", wrapper) || detail.appendChild(wrapper);
    bindActions(wrapper);
  }

  function rankCardMarkup(row, index = 0) {
    const rank = row?.rank || {};
    const division = ROMAN[Math.max(0, Math.min(4, num(rank.division, 1) - 1))];
    return `<article class="v1711-rank-card" style="--rank:${escHtml(rank.color || "#6e26f6")}"><span class="v1711-rank-place">${index + 1}</span><i>${escHtml(rank.icon || "◆")}</i><div><strong>${escHtml(row.member_name || "Miembro")}</strong><span>${escHtml(rank.tier_name || "Brote Creativo")} ${division} · Nivel ${num(rank.level, 1)}</span><div class="v1711-progress"><b style="width:${Math.max(0, Math.min(100, num(rank.progress_percent)))}%"></b></div></div><em>${num(row.points).toLocaleString("es-PE")} pts</em></article>`;
  }

  function rankingModal() {
    const rows = arr(dashboard.ranking);
    const body = `<div class="v1711-ranking-modal"><header><span>RANKED 1000</span><h3>Progreso profesional del equipo</h3><p>Calidad, cumplimiento, complejidad y evidencia construyen el ranking. El nivel máximo es 1000.</p></header><div class="v1711-ranking-list">${rows.length ? rows.map(rankCardMarkup).join("") : `<div class="v1711-empty">Todavía no hay puntos registrados.</div>`}</div><details><summary>Ver rangos y divisiones</summary><div class="v1711-tier-grid">${arr(dashboard.rank_tiers).map((tier) => `<article style="--rank:${escHtml(tier.color)}"><i>${escHtml(tier.icon)}</i><strong>${escHtml(tier.name)}</strong><span>Niveles ${tier.min_level}–${tier.max_level}</span>${isDirector() ? `<button type="button" data-v1711-edit-tier="${escHtml(tier.code)}">Editar nombre</button>` : ""}</article>`).join("")}</div></details></div>`;
    window.openPremiumModal?.({ title: "Ranking del equipo", subtitle: "Niveles 1–1000 · divisiones I–V", body, actions: [{ label: "Cerrar", value: true, className: "primary" }] });
    requestAnimationFrame(() => bindActions(document.getElementById("premiumModalBody") || document));
  }

  function editTierModal(code) {
    const tier = arr(dashboard.rank_tiers).find((row) => row.code === code);
    if (!tier || !isDirector()) return;
    const body = `<div class="v1711-modal-grid"><label class="full"><span>Nombre del rango</span><input id="v1711TierName" value="${escHtml(tier.name)}"></label><label><span>Nivel inicial</span><input id="v1711TierMin" type="number" min="1" max="1000" value="${tier.min_level}"></label><label><span>Nivel final</span><input id="v1711TierMax" type="number" min="1" max="1000" value="${tier.max_level}"></label><label><span>Color</span><input id="v1711TierColor" type="color" value="${escHtml(tier.color || "#6e26f6")}"></label><label><span>Ícono</span><input id="v1711TierIcon" maxlength="8" value="${escHtml(tier.icon || "◆")}"></label></div>`;
    window.openPremiumModal?.({ title: "Editar rango", subtitle: code, body, actions: [{ label: "Cancelar", value: null, className: "ghost" }, { label: "Guardar rango", className: "primary", onClick: async () => {
      if (!await checkBackend()) throw new Error("Instala SQL_OPCIONAL_v17_11.sql.");
      const { error } = await callRpc("ibm_v1711_update_rank_tier", { p_code: code, p_name: document.getElementById("v1711TierName")?.value, p_min_level: num(document.getElementById("v1711TierMin")?.value), p_max_level: num(document.getElementById("v1711TierMax")?.value), p_color: document.getElementById("v1711TierColor")?.value, p_icon: document.getElementById("v1711TierIcon")?.value });
      if (error) throw error; await refreshDashboard(); notify("Rango actualizado", "El nuevo nombre ya aparece en el ranking.", "success"); return true;
    } }] });
  }

  function injectRankingWidgets() {
    const home = document.getElementById("home");
    if (home && !document.getElementById("v1711HomeRanking")) {
      const rows = arr(dashboard.ranking).slice(0, 5);
      const section = document.createElement("section"); section.id = "v1711HomeRanking"; section.className = "v1711-home-ranking";
      section.innerHTML = `<header><div><span>RANKED 1000</span><h3>Progreso del equipo</h3></div><button type="button" data-v1711-open="ranking">Ver ranking</button></header><div>${rows.length ? rows.map(rankCardMarkup).join("") : `<div class="v1711-empty">Las primeras tareas aprobadas activarán el ranking.</div>`}</div>`;
      (home.querySelector(".v47-wrap,.mz-home-shell,.v412-home") || home).appendChild(section); bindActions(section);
    }
    const work = document.getElementById("workSummary") || document.getElementById("workIntel");
    if (work && !document.getElementById("v1711WorkButtons")) {
      work.insertAdjacentHTML("afterbegin", `<div id="v1711WorkButtons" class="v1711-work-buttons"><button type="button" data-v1711-open="operations"><span>Operación 360+</span><small>Horas · dependencias · recurrencia</small></button><button type="button" data-v1711-open="ranking"><span>Ranking 1000</span><small>Notas · puntos · niveles</small></button>${isManager() ? `<button type="button" data-v1711-open="report"><span>Reporte 360+</span><small>Día · semana · mes · año</small></button>` : ""}</div>`); bindActions(work);
    }
    const profile = document.getElementById("memberProfileStats");
    if (profile && !profile.querySelector("[data-v1711-rank-profile]")) {
      let targetId = getMember()?.id;
      try { targetId = currentProfileMemberId || targetId; } catch (_) {}
      const row = arr(dashboard.ranking).find((item) => same(item.member_id, targetId));
      if (row) {
        const rank = row.rank || {}, division = ROMAN[Math.max(0, num(rank.division, 1) - 1)];
        profile.insertAdjacentHTML("beforeend", `<div class="profile-stat v1711-profile-rank" data-v1711-rank-profile style="--rank:${escHtml(rank.color || "#6e26f6")}"><span class="small">${escHtml(rank.icon || "◆")} ${escHtml(rank.tier_name || "Brote Creativo")} ${division}</span><br><strong>Nivel ${num(rank.level, 1)}</strong><span class="small"> · ${num(row.points).toLocaleString("es-PE")} pts</span></div>`);
      }
    }
  }

  function operationsModal() {
    const recurring = arr(dashboard.operations).filter((row) => row.recurrence_active);
    const body = `<div class="v1711-operations-modal"><header><span>TRABAJO 360+</span><h3>Centro operativo de tareas</h3><p>Responsables finales, horas manuales, dependencias y tareas repetitivas.</p></header><div class="v1711-op-summary"><article><b>${arr(dashboard.operations).length}</b><span>tareas planificadas</span></article><article><b>${arr(dashboard.efforts).filter((row) => row.actual_minutes != null).length}</b><span>registros de horas reales</span></article><article><b>${arr(dashboard.dependencies).length}</b><span>dependencias</span></article><article><b>${recurring.length}</b><span>recurrencias activas</span></article></div><section><div class="v1711-section-title"><h4>Próximas tareas repetitivas</h4>${isManager() ? `<button type="button" data-v1711-generate-due>Generar vencidas / de hoy</button>` : ""}</div><div class="v1711-recurring-list">${recurring.length ? recurring.map((row) => `<article><div><strong>${escHtml(taskById(row.task_id)?.title || "Tarea")}</strong><span>${escHtml(row.recurrence_frequency)} · próxima ${escHtml(formatDate(row.next_due_date))}</span></div>${isManager() ? `<button type="button" data-v1711-generate="${escHtml(row.task_id)}">Generar</button>` : ""}</article>`).join("") : `<div class="v1711-empty">No hay tareas repetitivas configuradas.</div>`}</div></section></div>`;
    window.openPremiumModal?.({ title: "Operación 360+", subtitle: cloudAvailable ? "Sincronización activa" : "Fallback local", body, actions: [{ label: "Cerrar", value: true, className: "primary" }] });
    requestAnimationFrame(() => bindActions(document.getElementById("premiumModalBody") || document));
  }

  async function createTaskAndFind(payload, matcher) {
    const before = new Set(taskList().map((task) => str(task.id)));
    const { data, error } = await callRpc("ibm_v30_create_task", payload);
    if (error) throw error;
    let id = data?.id || data?.task_id || (typeof data === "string" ? data : "");
    try { await window.loadAll?.(); } catch (_) {}
    if (!id) id = taskList().filter((task) => !before.has(str(task.id))).find(matcher)?.id || "";
    if (!id) throw new Error("No fue posible identificar la tarea recurrente creada.");
    return str(id);
  }

  async function generateOccurrence(sourceTaskId) {
    if (!isManager()) throw new Error("Solo Dirección o Supervisión puede generar recurrencias.");
    if (!await checkBackend()) throw new Error("Instala SQL_OPCIONAL_v17_11.sql.");
    const source = taskById(sourceTaskId), op = operation(sourceTaskId);
    if (!source || !op?.recurrence_active || !op.next_due_date) throw new Error("La tarea no tiene una próxima ejecución activa.");
    if (arr(dashboard.occurrences).some((row) => same(row.source_task_id, sourceTaskId) && str(row.scheduled_date).slice(0, 10) === str(op.next_due_date).slice(0, 10))) return notify("Ya generada", "La ejecución de esa fecha ya existe.", "warning");
    const title = source.title.replace(/\s·\s\d{4}-\d{2}-\d{2}$/i, "") + ` · ${op.next_due_date}`;
    const newId = await createTaskAndFind({ p_title: title, p_description: source.description || "", p_assigned_to: source.assigned_to || null, p_client_id: source.client_id || null, p_area_id: source.area_id || null, p_campaign_id: source.campaign_id || null, p_due_date: op.next_due_date, p_due_time: op.next_due_time || source.due_time || null, p_priority: source.priority || "media", p_impact: num(source.impact, 3), p_checklist: arr(source.checklist) }, (task) => task.title === title && same(task.assigned_to, source.assigned_to));
    const participants = participantIds(sourceTaskId);
    if (participants.length && window.INBESTIGA_V179 && cloudAvailable) {
      try { await callRpc("ibm_v179_set_task_participants", { p_task_id: newId, p_member_ids: participants }); } catch (_) {}
    }
    await saveTaskPlan(newId, { responsible: op.responsible_member_id, estimatedMinutes: op.estimated_minutes, complexity: op.complexity, recurrence: { frequency: "none", interval: 1, days: [], end_date: null, active: false, next_due_date: null, next_due_time: null }, dependencies: [] });
    const { error } = await callRpc("ibm_v1711_register_occurrence", { p_source_task_id: sourceTaskId, p_generated_task_id: newId, p_scheduled_date: op.next_due_date });
    if (error) throw error;
    await refreshDashboard(); try { await window.renderAll?.(); } catch (_) {}
    notify("Tarea recurrente creada", `${title} ya fue asignada al equipo.`, "success");
  }

  async function generateDueOccurrences() {
    const due = arr(dashboard.operations).filter((row) => row.recurrence_active && row.next_due_date && str(row.next_due_date).slice(0, 10) <= todayKey()).slice(0, 20);
    if (!due.length) return notify("Recurrencias al día", "No hay ejecuciones pendientes.", "success");
    for (const row of due) await generateOccurrence(row.task_id);
  }

  function catalogModal(tab = "clients") {
    const clients = clientList(), campaigns = campaignList();
    const body = `<div class="v1711-catalog"><nav><button type="button" data-v1711-catalog-tab="clients" class="${tab === "clients" ? "active" : ""}">Clientes</button><button type="button" data-v1711-catalog-tab="campaigns" class="${tab === "campaigns" ? "active" : ""}">Campañas</button>${isDirector() ? `<button type="button" data-v1711-catalog-tab="ranks" class="${tab === "ranks" ? "active" : ""}">Rangos</button>` : ""}</nav>
      <section data-v1711-catalog-panel="clients" class="${tab === "clients" ? "active" : ""}"><header><div><h3>Clientes</h3><p>Agrega, renombra, archiva o restaura clientes sin crear una nueva versión.</p></div><button type="button" class="primary" data-v1711-new-client>Nuevo cliente</button></header><div>${clients.map((client) => `<article><div><strong>${escHtml(client.name)}</strong><span>${catalogState("client", client.id)}</span></div><button type="button" data-v1711-edit-client="${escHtml(client.id)}">Editar</button><button type="button" data-v1711-catalog-state="client:${escHtml(client.id)}:${catalogState("client", client.id) === "archived" ? "active" : "archived"}">${catalogState("client", client.id) === "archived" ? "Restaurar" : "Archivar"}</button></article>`).join("")}</div></section>
      <section data-v1711-catalog-panel="campaigns" class="${tab === "campaigns" ? "active" : ""}"><header><div><h3>Campañas</h3><p>Edita los nombres y retira del catálogo las campañas cerradas.</p></div><button type="button" class="primary" data-v1711-new-campaign>Nueva campaña</button></header><div>${campaigns.map((campaign) => `<article><div><strong>${escHtml(campaign.name)}</strong><span>${escHtml(clientById(campaign.client_id)?.name || "Sin cliente")} · ${catalogState("campaign", campaign.id)}</span></div><button type="button" data-v1711-edit-campaign="${escHtml(campaign.id)}">Editar</button><button type="button" data-v1711-catalog-state="campaign:${escHtml(campaign.id)}:${catalogState("campaign", campaign.id) === "archived" ? "active" : "archived"}">${catalogState("campaign", campaign.id) === "archived" ? "Restaurar" : "Archivar"}</button></article>`).join("")}</div></section>
      <section data-v1711-catalog-panel="ranks" class="${tab === "ranks" ? "active" : ""}"><header><div><h3>Rangos 1–1000</h3><p>Los nombres pueden cambiarse sin alterar los puntos históricos.</p></div></header><div>${arr(dashboard.rank_tiers).map((tier) => `<article><div><strong>${escHtml(tier.icon)} ${escHtml(tier.name)}</strong><span>Niveles ${tier.min_level}–${tier.max_level}</span></div><button type="button" data-v1711-edit-tier="${escHtml(tier.code)}">Editar</button></article>`).join("")}</div></section></div>`;
    window.openPremiumModal?.({ title: "Catálogos operativos", subtitle: "Clientes · campañas · rangos", body, actions: [{ label: "Cerrar", value: true, className: "primary" }] });
    requestAnimationFrame(() => bindActions(document.getElementById("premiumModalBody") || document));
  }

  function clientEditModal(id = "") {
    const client = clientById(id);
    const body = `<div class="v1711-modal-grid"><label class="full"><span>Nombre del cliente</span><input id="v1711ClientName" value="${escHtml(client?.name || "")}" placeholder="Nombre oficial"></label></div>`;
    window.openPremiumModal?.({ title: client ? "Editar cliente" : "Nuevo cliente", subtitle: "Catálogo dinámico", body, actions: [{ label: "Cancelar", value: null, className: "ghost" }, { label: "Guardar", className: "primary", onClick: async () => {
      if (!await checkBackend()) throw new Error("Instala SQL_OPCIONAL_v17_11.sql.");
      const { error } = await callRpc("ibm_v1711_upsert_client", { p_client_id: id || null, p_name: document.getElementById("v1711ClientName")?.value, p_state: "active" });
      if (error) throw error; await window.loadAll?.(); await refreshDashboard(); try { await window.renderAll?.(); } catch (_) {} notify("Cliente guardado", "Los selectores se actualizaron.", "success"); return true;
    } }] });
  }

  function campaignEditModal(id) {
    const campaign = campaignById(id); if (!campaign) return;
    const body = `<div class="v1711-modal-grid"><label class="full"><span>Nombre</span><input id="v1711CampaignName" value="${escHtml(campaign.name)}"></label><label><span>Cliente</span><select id="v1711CampaignClient">${clientList().map((client) => `<option value="${escHtml(client.id)}" ${same(client.id, campaign.client_id) ? "selected" : ""}>${escHtml(client.name)}</option>`).join("")}</select></label><label><span>Estado</span><input id="v1711CampaignStatus" value="${escHtml(campaign.status || "planificacion")}"></label><label><span>Inicio</span><input id="v1711CampaignStart" type="date" value="${escHtml(campaign.start_date || "")}"></label><label><span>Fin</span><input id="v1711CampaignEnd" type="date" value="${escHtml(campaign.end_date || "")}"></label><label class="full"><span>Objetivo</span><textarea id="v1711CampaignObjective">${escHtml(campaign.objective || "")}</textarea></label></div>`;
    window.openPremiumModal?.({ title: "Editar campaña", subtitle: campaign.name, body, actions: [{ label: "Cancelar", value: null, className: "ghost" }, { label: "Guardar", className: "primary", onClick: async () => {
      if (!await checkBackend()) throw new Error("Instala SQL_OPCIONAL_v17_11.sql.");
      const { error } = await callRpc("ibm_v1711_update_campaign", { p_campaign_id: id, p_name: document.getElementById("v1711CampaignName")?.value, p_client_id: document.getElementById("v1711CampaignClient")?.value || null, p_status: document.getElementById("v1711CampaignStatus")?.value || null, p_start_date: document.getElementById("v1711CampaignStart")?.value || null, p_end_date: document.getElementById("v1711CampaignEnd")?.value || null, p_objective: document.getElementById("v1711CampaignObjective")?.value || null, p_state: "active" });
      if (error) throw error; await window.loadAll?.(); await refreshDashboard(); try { await window.renderAll?.(); } catch (_) {} notify("Campaña actualizada", "El nuevo nombre ya está disponible.", "success"); return true;
    } }] });
  }

  async function setCatalogState(type, id, stateValue) {
    if (!await checkBackend()) throw new Error("Instala SQL_OPCIONAL_v17_11.sql.");
    const { error } = await callRpc("ibm_v1711_set_catalog_state", { p_entity_type: type, p_entity_id: id, p_state: stateValue });
    if (error) throw error;
    await refreshDashboard(); applyCatalogFilters(); notify(stateValue === "archived" ? "Archivado" : "Restaurado", "El catálogo se actualizó sin borrar historial.", "success");
  }

  function applyCatalogFilters() {
    const archivedClients = new Set(arr(dashboard.catalog_lifecycle).filter((row) => row.entity_type === "client" && row.state === "archived").map((row) => str(row.entity_id)));
    const archivedCampaigns = new Set(arr(dashboard.catalog_lifecycle).filter((row) => row.entity_type === "campaign" && row.state === "archived").map((row) => str(row.entity_id)));
    document.querySelectorAll("#taskClient,#campaignClient,#edClient,#boardClient,#assetClient,#incidentClient,#v179QuickCampaignClient").forEach((select) => Array.from(select.options || []).forEach((option) => { option.hidden = archivedClients.has(str(option.value)); option.disabled = archivedClients.has(str(option.value)); }));
    document.querySelectorAll("#taskCampaign,#briefCampaign,#edCampaign,#boardCampaign,#assetCampaign,#incidentCampaign,#v179QuickTaskCampaign").forEach((select) => Array.from(select.options || []).forEach((option) => { option.hidden = archivedCampaigns.has(str(option.value)); option.disabled = archivedCampaigns.has(str(option.value)); }));
  }

  function reportPeriod(mode, customStart = "", customEnd = "") {
    const now = new Date(), end = new Date(now), start = new Date(now);
    if (mode === "day") {}
    if (mode === "week") { const day = (now.getDay() + 6) % 7; start.setDate(now.getDate() - day); }
    if (mode === "month") start.setDate(1);
    if (mode === "year") { start.setMonth(0, 1); }
    if (mode === "custom") return { start: customStart || "0000-01-01", end: customEnd || "9999-12-31" };
    const key = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    return { start: key(start), end: key(end) };
  }

  function reportRows(mode = "month", customStart = "", customEnd = "") {
    const range = reportPeriod(mode, customStart, customEnd);
    return taskList().filter((task) => {
      const date = str(task.due_date || task.created_at || "").slice(0, 10);
      return !date || (date >= range.start && date <= range.end);
    }).map((task) => {
      const op = operation(task.id), rows = efforts(task.id), reviewRows = reviews(task.id);
      const actual = rows.reduce((sum, row) => sum + num(row.validated_minutes ?? row.actual_minutes), 0);
      const estimate = num(op?.estimated_minutes);
      const average = reviewRows.length ? reviewRows.reduce((sum, row) => sum + num(row.manual_score), 0) / reviewRows.length : null;
      const points = reviewRows.reduce((sum, row) => sum + num(row.total_points), 0);
      return { id: task.id, title: task.title, client: clientById(task.client_id)?.name || "", campaign: campaignById(task.campaign_id)?.name || "", executor: participantIds(task.id).map(memberName).join(", ") || memberName(task.assigned_to), responsible: memberName(op?.responsible_member_id), status: task.status, due: task.due_date || "", dueTime: task.due_time || "", complexity: op?.complexity || "media", estimatedMinutes: estimate, actualMinutes: actual, variance: actual - estimate, recurrence: op?.recurrence_active ? op.recurrence_frequency : "no", dependencies: dependencies(task.id).map((dep) => taskById(dep.depends_on_task_id)?.title || dep.depends_on_task_id).join(" | "), score: average, points };
    });
  }

  function csvSafe(value) { const text = str(value); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"','""')}"`; }
  function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function xmlEsc(value) { return str(value).replace(/[<>&"']/g, (char) => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;", "'":"&apos;" }[char])); }
  function excelCell(value, header = false) { const numeric = typeof value === "number" && Number.isFinite(value); return `<Cell${header ? ' ss:StyleID="Header"' : ''}><Data ss:Type="${numeric ? "Number" : "String"}">${xmlEsc(value ?? "")}</Data></Cell>`; }
  function excelSheet(name, rows) { return `<Worksheet ss:Name="${xmlEsc(name.slice(0,31))}"><Table>${rows.map((row, index) => `<Row>${row.map((cell) => excelCell(cell,index===0)).join("")}</Row>`).join("")}</Table></Worksheet>`; }

  function exportOperationalCsv(mode, start, end) {
    const rows = reportRows(mode, start, end), header = ["ID","Tarea","Cliente","Campaña","Ejecutores","Responsable final","Estado","Deadline","Hora","Complejidad","Min estimados","Min reales","Variación","Recurrencia","Dependencias","Nota 1-10","Puntos"];
    const csv = [header, ...rows.map((row) => [row.id,row.title,row.client,row.campaign,row.executor,row.responsible,row.status,row.due,row.dueTime,row.complexity,row.estimatedMinutes,row.actualMinutes,row.variance,row.recurrence,row.dependencies,row.score ?? "",row.points])].map((row) => row.map(csvSafe).join(",")).join("\r\n");
    download(`reporte_operativo_360_${mode}_${todayKey()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  function exportOperationalExcel(mode, start, end) {
    const rows = reportRows(mode, start, end);
    const detail = [["ID","Tarea","Cliente","Campaña","Ejecutores","Responsable","Estado","Deadline","Hora","Complejidad","Horas estimadas","Horas reales","Variación horas","Recurrencia","Dependencias","Nota","Puntos"], ...rows.map((row) => [row.id,row.title,row.client,row.campaign,row.executor,row.responsible,row.status,row.due,row.dueTime,row.complexity,row.estimatedMinutes/60,row.actualMinutes/60,row.variance/60,row.recurrence,row.dependencies,row.score ?? "",row.points])];
    const memberMap = new Map(); rows.forEach((row) => row.executor.split(", ").filter(Boolean).forEach((name) => { const current = memberMap.get(name) || { tasks:0, estimated:0, actual:0, points:0, scores:[] }; current.tasks++; current.estimated += row.estimatedMinutes; current.actual += row.actualMinutes; current.points += row.points; if (row.score != null) current.scores.push(row.score); memberMap.set(name,current); }));
    const members = [["Miembro","Tareas","Horas estimadas","Horas reales","Variación","Nota promedio","Puntos"], ...[...memberMap.entries()].map(([name,row]) => [name,row.tasks,row.estimated/60,row.actual/60,(row.actual-row.estimated)/60,row.scores.length ? row.scores.reduce((a,b)=>a+b,0)/row.scores.length : "",row.points])];
    const ranking = [["Posición","Miembro","Rango","División","Nivel","Puntos","Nota promedio"], ...arr(dashboard.ranking).map((row,index) => [index+1,row.member_name,row.rank?.tier_name,ROMAN[Math.max(0,num(row.rank?.division,1)-1)],row.rank?.level,row.points,row.average_score ?? ""])];
    const catalogs = [["Tipo","Nombre","Estado"], ...clientList().map((item) => ["Cliente",item.name,catalogState("client",item.id)]), ...campaignList().map((item) => ["Campaña",item.name,catalogState("campaign",item.id)])];
    const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#6E2FB2" ss:Pattern="Solid"/></Style></Styles>${excelSheet("Detalle de tareas",detail)}${excelSheet("Por colaborador",members)}${excelSheet("Ranking 1000",ranking)}${excelSheet("Clientes y campañas",catalogs)}</Workbook>`;
    download(`reporte_operativo_360_${mode}_${todayKey()}.xls`, workbook, "application/vnd.ms-excel");
  }

  function printOperationalReport(mode, start, end) {
    const rows = reportRows(mode,start,end), popup = window.open("","_blank","noopener,noreferrer"); if (!popup) return notify("Ventana bloqueada","Permite ventanas emergentes para crear el PDF.","warning");
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reporte 360+</title><style>body{font-family:Arial;padding:32px;color:#1d1d1f}h1{margin:0}.meta{color:#6e6e73;margin:8px 0 24px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#1d1d1f;color:white}@media print{button{display:none}}</style></head><body><h1>Reporte operativo 360+</h1><div class="meta">${xmlEsc(mode)} · generado ${xmlEsc(new Date().toLocaleString("es-PE"))}</div><button onclick="print()">Guardar como PDF</button><table><thead><tr><th>Tarea</th><th>Ejecutores</th><th>Responsable</th><th>Estado</th><th>Deadline</th><th>Estimado</th><th>Real</th><th>Nota</th><th>Puntos</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${xmlEsc(row.title)}</td><td>${xmlEsc(row.executor)}</td><td>${xmlEsc(row.responsible)}</td><td>${xmlEsc(row.status)}</td><td>${xmlEsc(row.due)}</td><td>${xmlEsc(formatMinutes(row.estimatedMinutes))}</td><td>${xmlEsc(formatMinutes(row.actualMinutes))}</td><td>${xmlEsc(row.score ?? "")}</td><td>${row.points}</td></tr>`).join("")}</tbody></table></body></html>`); popup.document.close();
  }

  function reportModal() {
    const body = `<div class="v1711-report-modal"><header><span>EXPORTACIÓN EXTERNA</span><h3>Reporte operativo 360+</h3><p>Descarga por día, semana, mes, año o rango personalizado para analizarlo en Excel o Google Sheets.</p></header><div class="v1711-report-filter"><label>Periodo<select id="v1711ReportPeriod"><option value="day">Hoy</option><option value="week">Semana</option><option value="month" selected>Mes</option><option value="year">Año</option><option value="custom">Rango personalizado</option></select></label><label>Desde<input id="v1711ReportStart" type="date"></label><label>Hasta<input id="v1711ReportEnd" type="date"></label></div><div class="v1711-export-actions"><button type="button" data-v1711-export="csv">Exportar CSV</button><button type="button" class="primary" data-v1711-export="excel">Exportar Excel</button><button type="button" data-v1711-export="pdf">Imprimir / PDF</button></div><small>Los archivos CSV y Excel se pueden importar directamente en Google Sheets. No se almacenan claves de Google en el frontend.</small></div>`;
    window.openPremiumModal?.({ title: "Reporte 360+", subtitle: "Evaluación externa", body, actions: [{ label: "Cerrar", value: true, className: "ghost" }] });
    requestAnimationFrame(() => bindActions(document.getElementById("premiumModalBody") || document));
  }

  function injectCatalogButtons() {
    if (!isManager()) return;
    const campaigns = document.getElementById("campaigns");
    if (campaigns && !campaigns.querySelector("[data-v1711-open-catalog]")) {
      const header = campaigns.querySelector(".module-title,.v413-section-head,.action-bar") || campaigns.firstElementChild;
      header?.insertAdjacentHTML("beforeend", `<button type="button" data-v1711-open-catalog>Catálogos operativos</button>`);
    }
    const admin = document.getElementById("admin");
    if (admin && !admin.querySelector("[data-v1711-open-catalog]")) {
      const panel = admin.querySelector(".panel") || admin;
      panel.insertAdjacentHTML("afterbegin", `<div class="v1711-admin-card"><div><span>CATÁLOGOS DINÁMICOS</span><h3>Clientes, campañas y rangos</h3><p>Agrega, renombra, archiva o restaura sin generar una nueva versión.</p></div><button type="button" class="primary" data-v1711-open-catalog>Abrir editor</button></div>`);
    }
    bindActions(campaigns || document); bindActions(admin || document);
  }

  function bindActions(root = document) {
    root.querySelectorAll("[data-v1711-open]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => { const action = button.dataset.v1711Open; if (action === "operations") operationsModal(); if (action === "ranking") rankingModal(); if (action === "report") reportModal(); }); });
    root.querySelectorAll("[data-v1711-plan]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => planModal(button.dataset.v1711Plan)); });
    root.querySelectorAll("[data-v1711-effort]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => { const [taskId,memberId] = button.dataset.v1711Effort.split(":"); effortModal(taskId, isManager() ? memberId : null); }); });
    root.querySelectorAll("[data-v1711-review]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => reviewModal(button.dataset.v1711Review)); });
    root.querySelectorAll("[data-v1711-open-task]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => window.v412OpenTask?.(button.dataset.v1711OpenTask)); });
    root.querySelectorAll("[data-v1711-generate]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => generateOccurrence(button.dataset.v1711Generate).catch((error) => notify("No se pudo generar", error.message, "error"))); });
    root.querySelectorAll("[data-v1711-generate-due]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => generateDueOccurrences().catch((error) => notify("No se pudieron generar recurrencias", error.message, "error"))); });
    root.querySelectorAll("[data-v1711-open-catalog]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => catalogModal()); });
    root.querySelectorAll("[data-v1711-catalog-tab]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound = "1"; button.addEventListener("click", () => { const tab=button.dataset.v1711CatalogTab; document.querySelectorAll("[data-v1711-catalog-tab]").forEach((node)=>node.classList.toggle("active",node.dataset.v1711CatalogTab===tab)); document.querySelectorAll("[data-v1711-catalog-panel]").forEach((node)=>node.classList.toggle("active",node.dataset.v1711CatalogPanel===tab)); }); });
    root.querySelectorAll("[data-v1711-new-client]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound="1"; button.addEventListener("click",()=>clientEditModal()); });
    root.querySelectorAll("[data-v1711-edit-client]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound="1"; button.addEventListener("click",()=>clientEditModal(button.dataset.v1711EditClient)); });
    root.querySelectorAll("[data-v1711-new-campaign]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound="1"; button.addEventListener("click",()=>{ window.closePremiumModal?.(); setTimeout(()=>window.v66QuickCampaignModal?.(),20); }); });
    root.querySelectorAll("[data-v1711-edit-campaign]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound="1"; button.addEventListener("click",()=>campaignEditModal(button.dataset.v1711EditCampaign)); });
    root.querySelectorAll("[data-v1711-catalog-state]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound="1"; button.addEventListener("click",()=>{ const [type,id,stateValue]=button.dataset.v1711CatalogState.split(":"); setCatalogState(type,id,stateValue).then(()=>catalogModal(type==="client"?"clients":"campaigns")).catch((error)=>notify("No se pudo actualizar",error.message,"error")); }); });
    root.querySelectorAll("[data-v1711-edit-tier]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound="1"; button.addEventListener("click",()=>editTierModal(button.dataset.v1711EditTier)); });
    root.querySelectorAll("[data-v1711-export]").forEach((button) => { if (button.dataset.v1711Bound) return; button.dataset.v1711Bound="1"; button.addEventListener("click",()=>{ const mode=document.getElementById("v1711ReportPeriod")?.value||"month",start=document.getElementById("v1711ReportStart")?.value||"",end=document.getElementById("v1711ReportEnd")?.value||""; if(button.dataset.v1711Export==="csv")exportOperationalCsv(mode,start,end); if(button.dataset.v1711Export==="excel")exportOperationalExcel(mode,start,end); if(button.dataset.v1711Export==="pdf")printOperationalReport(mode,start,end); }); });
  }

  function wrapFunctions() {
    if (wrapped) return; wrapped = true;
    for (const name of ["renderHome","renderTasks","renderCampaigns","renderV356","renderMemberProfile","fillSelects","renderAdmin"]) {
      const original = window[name]; if (typeof original !== "function" || original.__v1711Wrapped) continue;
      const replacement = function (...args) {
        const result = original.apply(this,args);
        queueMicrotask(() => { ensureTaskFormEnhancements(); injectRankingWidgets(); injectCatalogButtons(); applyCatalogFilters(); bindActions(); });
        return result;
      };
      replacement.__v1711Wrapped = true; replacement.__v1711Base = original; window[name] = replacement;
    }
    const openTask = window.v412OpenTask;
    if (typeof openTask === "function" && !openTask.__v1711Wrapped) {
      const replacement = function (taskId, ...args) { const result = openTask.call(this, taskId, ...args); setTimeout(() => enhanceTaskDetail(taskId), 35); return result; };
      replacement.__v1711Wrapped = true; replacement.__v1711Base = openTask; window.v412OpenTask = replacement;
    }
  }

  function renderAffectedViews() {
    try { window.renderHome?.(); } catch (_) {}
    try { window.renderTasks?.(); } catch (_) {}
    try { window.renderV356?.(); } catch (_) {}
    try { window.renderMemberProfile?.(); } catch (_) {}
    ensureTaskFormEnhancements(); injectRankingWidgets(); injectCatalogButtons(); applyCatalogFilters(); bindActions();
  }

  function subscribeRealtime() {
    const client = getSb(); if (!cloudAvailable || !client?.channel || realtimeChannel) return;
    try {
      realtimeChannel = client.channel(`inbestiga-v1711-${getAuthUser()?.id || Date.now()}`)
        .on("postgres_changes", { event:"*", schema:"marketing_app", table:"task_operations_v1711" }, scheduleRefresh)
        .on("postgres_changes", { event:"*", schema:"marketing_app", table:"task_effort_v1711" }, scheduleRefresh)
        .on("postgres_changes", { event:"*", schema:"marketing_app", table:"task_performance_reviews_v1711" }, scheduleRefresh)
        .on("postgres_changes", { event:"*", schema:"marketing_app", table:"performance_points_ledger_v1711" }, scheduleRefresh)
        .subscribe();
    } catch (error) { console.warn("[v17.11] Realtime opcional", error); }
  }
  function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refreshDashboard({ render:true }), 350); }

  function bindEvents() {
    window.addEventListener("inbestiga:task-created", onTaskCreated);
    window.addEventListener("inbestiga:task-submission-created", onSubmissionCreated);
    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-v1711-open],[data-v1711-plan],[data-v1711-effort],[data-v1711-review],[data-v1711-open-catalog]")) return;
      setTimeout(() => { ensureQuickTaskEnhancements(); ensureDeliveryEnhancements(); }, 0);
    });
    window.addEventListener("inbestiga:modal-rendered", () => {
      ensureTaskFormEnhancements(); ensureQuickTaskEnhancements(); ensureDeliveryEnhancements();
      const modal = document.getElementById("premiumModalBody"); if (modal) bindActions(modal);
    });
  }

  function registerBuild() {
    try { window.INBESTIGA_QUALITY_CORE?.register?.("task-operations-ranking-v17-11", { version: VERSION, mode: cloudAvailable ? "productive-sync" : "local-fallback" }); } catch (_) {}
    const build = window.INBESTIGA_BUILD || {}, modules = [...new Set([...(build.modules || []), "task-operations-ranking-v17-11"])] ;
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  async function init() {
    if (initialized) return;
    if (!getMember()?.id || !getState()?.tasks) { setTimeout(init, 250); return; }
    initialized = true;
    wrapFunctions(); bindEvents(); await checkBackend(); await refreshDashboard(); subscribeRealtime(); registerBuild(); renderAffectedViews(); updateBackendNotice();
    let lastPassiveRefresh = Date.now();
    const passiveRefresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastPassiveRefresh < 120000) return;
      lastPassiveRefresh = Date.now();
      refreshDashboard({ render:false }).then(() => { injectRankingWidgets(); applyCatalogFilters(); }).catch(() => {});
    };
    window.addEventListener("focus", passiveRefresh, { passive:true });
    document.addEventListener("visibilitychange", passiveRefresh, { passive:true });
  }

  window.INBESTIGA_V1711 = {
    version: "v17.11.2", diagnostics: () => ({ cloudAvailable, lastCheckedAt: cloudLastCheckedAt, lastError: rpcErrorText(cloudLastError) }),
    refresh: refreshDashboard, dashboard: () => dashboard, operation, efforts, dependencies, reviews,
    openOperations: operationsModal, openRanking: rankingModal, openCatalogs: catalogModal, openReport: reportModal,
    planTask: planModal, recordEffort: effortModal, reviewTask: reviewModal, generateOccurrence
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
