/* ===== v17.6 WORK 360 TEAM REPORTS ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_WORK360_TEAM_REPORTS) return;

  const VERSION = "v17.6";
  const BUILD = "WORK 360 TEAM REPORTS";
  const MODAL_ID = "v176TeamReportsBackdrop";
  const BUTTON_ID = "v176OpenTeamReports";
  const STORE_PREFIX = "inbestiga:v176:team-reports:";
  const DONE = new Set(["aprobado", "publicado", "completado", "completada", "finalizado", "finalizada", "done", "hecho", "cerrado", "cerrada"]);
  const REVIEW = new Set(["en_revision", "revision", "observado", "corregido", "por_aprobar"]);
  const MAX_RANGE_DAYS = 366;

  let initialized = false;
  let activeReport = null;
  let renderTimer = null;
  let shellObserver = null;

  const array = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? "");
  const sameId = (a, b) => text(a) === text(b);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const round = (value, digits = 1) => {
    const factor = 10 ** digits;
    return Math.round((number(value) + Number.EPSILON) * factor) / factor;
  };
  const esc = (value) => text(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const xmlEsc = (value) => text(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[char]);

  function appState() {
    try { return typeof state !== "undefined" && state ? state : (window.state || {}); } catch { return window.state || {}; }
  }

  function currentMember() {
    try { return typeof member !== "undefined" && member ? member : (window.member || null); } catch { return window.member || null; }
  }

  function currentUserId() {
    const user = currentMember();
    try { return text(user?.id || authUser?.id || "guest"); } catch { return text(user?.id || "guest"); }
  }

  function director() {
    try { return typeof isDirector === "function" && isDirector(); } catch { return false; }
  }

  function authorized() {
    try { return typeof isSupervisor === "function" && isSupervisor(); } catch { return director(); }
  }

  function notify(title, message, type = "success") {
    try {
      if (typeof premiumToast === "function") return premiumToast(title, message, type);
      if (typeof toast === "function") return toast(title, message);
    } catch { /* fallback */ }
    console.log(`[${type}] ${title}: ${message}`);
  }

  function statusKey(value) {
    try { if (typeof v412StatusKey === "function") return v412StatusKey(value); } catch { /* fallback */ }
    return text(value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
  }

  function isDone(task) {
    try { if (typeof v412TaskDone === "function") return v412TaskDone(task); } catch { /* fallback */ }
    return DONE.has(statusKey(task?.status));
  }

  function lifecycleStateFor(entity, id) {
    try { return window.INBESTIGA_RECORD_LIFECYCLE?.state?.(entity, id) || "active"; } catch { return "active"; }
  }

  function lifecycleState(task) {
    return lifecycleStateFor("task", task?.id);
  }

  function workMeta(taskId) {
    try { return window.INBESTIGA_WORK360_ADVANCED?.getMeta?.(taskId) || {}; } catch { return {}; }
  }

  function dependencyIds(task) {
    const value = workMeta(task?.id)?.dependencies;
    return array(value).map(text).filter(Boolean);
  }

  function taskById(id) {
    return array(appState().tasks).find((task) => sameId(task?.id, id));
  }

  function blockedDependencies(task) {
    return dependencyIds(task).map(taskById).filter((item) => item && !isDone(item));
  }

  function isBlocked(task) {
    return blockedDependencies(task).length > 0;
  }

  function recordBy(listName, id) {
    if (!id) return null;
    return array(appState()[listName]).find((item) => sameId(item?.id, id)) || null;
  }

  function memberName(id) {
    try { if (typeof window.memberName === "function") return window.memberName(id); } catch { /* fallback */ }
    return recordBy("members", id)?.full_name || "Sin responsable";
  }

  function areaIdFor(task) {
    const campaign = recordBy("campaigns", task?.campaign_id);
    const person = recordBy("members", task?.assigned_to);
    return task?.area_id || campaign?.area_id || person?.area_id || null;
  }

  function areaName(id) {
    return recordBy("areas", id)?.name || "Sin área";
  }

  function campaignName(id) {
    return recordBy("campaigns", id)?.name || "Sin campaña";
  }

  function clientIdFor(task) {
    const campaign = recordBy("campaigns", task?.campaign_id);
    return task?.client_id || campaign?.client_id || null;
  }

  function clientName(id) {
    return recordBy("clients", id)?.name || "Sin cliente";
  }

  function peruToday() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()); } catch { return new Date().toISOString().slice(0, 10); }
  }

  function parseDate(value) {
    if (!value) return null;
    const key = text(value).slice(0, 10);
    const date = new Date(`${key}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateKey(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(value, days) {
    const date = value instanceof Date ? new Date(value) : parseDate(value);
    if (!date) return null;
    date.setDate(date.getDate() + Number(days || 0));
    return date;
  }

  function startOfWeek(value) {
    const date = value instanceof Date ? new Date(value) : parseDate(value);
    if (!date) return null;
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return date;
  }

  function startOfMonth(value) {
    const date = value instanceof Date ? new Date(value) : parseDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  }

  function endOfMonth(value) {
    const date = value instanceof Date ? new Date(value) : parseDate(value);
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  }

  function daysBetween(start, end) {
    const first = parseDate(start);
    const last = parseDate(end);
    if (!first || !last) return 0;
    return Math.max(0, Math.floor((last - first) / 86400000) + 1);
  }

  function periodForPreset(preset) {
    const today = parseDate(peruToday());
    if (!today) return { start: "", end: "" };
    if (preset === "today") return { start: dateKey(today), end: dateKey(today) };
    if (preset === "current_week") {
      const start = startOfWeek(today);
      return { start: dateKey(start), end: dateKey(addDays(start, 6)) };
    }
    if (preset === "previous_week") {
      const end = addDays(startOfWeek(today), -1);
      return { start: dateKey(addDays(end, -6)), end: dateKey(end) };
    }
    if (preset === "current_month") return { start: dateKey(startOfMonth(today)), end: dateKey(endOfMonth(today)) };
    if (preset === "previous_month") {
      const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1, 12);
      return { start: dateKey(startOfMonth(previous)), end: dateKey(endOfMonth(previous)) };
    }
    if (preset === "last_30") return { start: dateKey(addDays(today, -29)), end: dateKey(today) };
    if (preset === "last_90") return { start: dateKey(addDays(today, -89)), end: dateKey(today) };
    return { start: "", end: "" };
  }

  function previousPeriod(start, end) {
    const span = daysBetween(start, end);
    if (!span) return null;
    const previousEnd = addDays(start, -1);
    return { start: dateKey(addDays(previousEnd, -(span - 1))), end: dateKey(previousEnd) };
  }

  function completionInfo(task) {
    const directFields = ["completed_at", "approved_at", "published_at", "finished_at", "closed_at", "resolved_at"];
    for (const field of directFields) {
      if (task?.[field]) return { date: dateKey(task[field]), source: field, exact: true };
    }
    const history = array(appState().approval_history)
      .filter((row) => sameId(row?.task_id, task?.id))
      .sort((a, b) => text(b?.created_at).localeCompare(text(a?.created_at)));
    const approved = history.find((row) => /aprobad|publicad|complet|finaliz|cerrad/.test(`${statusKey(row?.status)} ${statusKey(row?.action)} ${statusKey(row?.decision)} ${statusKey(row?.new_status)}`));
    if (approved?.created_at) return { date: dateKey(approved.created_at), source: "approval_history", exact: true };
    if (isDone(task) && task?.updated_at) return { date: dateKey(task.updated_at), source: "updated_at", exact: false };
    return { date: "", source: "", exact: false };
  }

  function taskDate(task, basis) {
    if (basis === "created") return dateKey(task?.created_at);
    if (basis === "updated") return dateKey(task?.updated_at);
    if (basis === "completed") return completionInfo(task).date;
    return dateKey(task?.due_date);
  }

  function dateInRange(value, start, end) {
    if (!value) return false;
    return (!start || value >= start) && (!end || value <= end);
  }

  function formatDate(value, fallback = "Sin fecha") {
    const date = parseDate(value);
    if (!date) return fallback;
    return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatHours(value) {
    return `${round(value, 1).toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  }

  function formatMinutes(value) {
    const minutes = Math.max(0, Math.round(number(value)));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
  }

  function percent(numerator, denominator) {
    return denominator ? Math.round((number(numerator) / number(denominator)) * 100) : null;
  }

  function activeMembers() {
    return array(appState().members).filter((item) => !["inactive", "inactivo", "disabled"].includes(statusKey(item?.status)));
  }

  function timeToMinutes(value) {
    const match = text(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function durationHours(start, end, fallback = 0.5) {
    const first = timeToMinutes(start);
    const last = timeToMinutes(end);
    if (first === null || last === null || last <= first) return fallback;
    return (last - first) / 60;
  }

  function weeklySchedule(memberId) {
    const daily = new Map();
    const grid = array(appState().member_schedule_grid_slots).filter((slot) => sameId(slot?.member_id, memberId) && slot?.is_active !== false);
    const productiveGrid = grid.filter((slot) => ["trabajo", "hora_extra", "remoto"].includes(statusKey(slot?.slot_type)) || statusKey(slot?.work_mode) === "remoto");
    if (productiveGrid.length) {
      const seen = new Set();
      for (const slot of productiveGrid) {
        const weekday = Number(slot?.weekday);
        if (!weekday) continue;
        const signature = `${weekday}|${slot?.slot_start || slot?.start_time || slot?.minute}|${slot?.slot_end || slot?.end_time}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        const hours = durationHours(slot?.slot_start || slot?.start_time, slot?.slot_end || slot?.end_time, 0.5);
        daily.set(weekday, number(daily.get(weekday)) + hours);
      }
      return { daily, source: "Horario Pro · cuadrícula", exact: true };
    }

    const blocks = array(appState().member_schedule_blocks).filter((block) => sameId(block?.member_id, memberId) && block?.is_active !== false && ["trabajo", "hora_extra", "remoto"].includes(statusKey(block?.block_type)));
    if (blocks.length) {
      for (const block of blocks) {
        const weekday = Number(block?.weekday);
        if (!weekday) continue;
        daily.set(weekday, number(daily.get(weekday)) + durationHours(block?.start_time, block?.end_time, 0));
      }
      return { daily, source: "Horario Pro · bloques", exact: true };
    }

    const profile = array(appState().member_work_profiles).find((item) => sameId(item?.member_id, memberId)) || {};
    const weeklyHours = number(profile?.weekly_hours || profile?.hours_per_week || profile?.capacity_hours);
    if (weeklyHours > 0) {
      const days = array(profile?.workdays).length ? array(profile.workdays).map(Number) : [1, 2, 3, 4, 5];
      const perDay = weeklyHours / Math.max(1, days.length);
      days.forEach((day) => daily.set(day, perDay));
      return { daily, source: "Perfil laboral", exact: true };
    }

    [1, 2, 3, 4, 5].forEach((day) => daily.set(day, 8));
    return { daily, source: "Referencia 40 h/semana", exact: false };
  }

  function exceptionForDate(memberId, key) {
    return array(appState().member_schedule_exceptions).filter((row) => {
      if (!sameId(row?.member_id, memberId)) return false;
      if (!["aprobado", "approved", "aceptado"].includes(statusKey(row?.status))) return false;
      const start = dateKey(row?.exception_date || row?.start_date || row?.start_at);
      const end = dateKey(row?.end_date || row?.end_at || row?.exception_date || row?.start_date || row?.start_at);
      return start && key >= start && key <= (end || start);
    });
  }

  function capacityForPeriod(memberId, start, end) {
    if (!start || !end) return { hours: null, source: "Periodo sin límites", exact: false };
    const span = daysBetween(start, end);
    if (!span) return { hours: 0, source: "Periodo inválido", exact: false };
    const schedule = weeklySchedule(memberId);
    if (span > MAX_RANGE_DAYS) {
      const weekly = [...schedule.daily.values()].reduce((sum, value) => sum + number(value), 0);
      return { hours: round((span / 7) * weekly, 1), source: `${schedule.source} · aproximación`, exact: false };
    }
    let total = 0;
    let cursor = parseDate(start);
    const last = parseDate(end);
    while (cursor && last && cursor <= last) {
      const key = dateKey(cursor);
      const weekday = cursor.getDay() || 7;
      let dayHours = number(schedule.daily.get(weekday));
      const exceptions = exceptionForDate(memberId, key);
      for (const exception of exceptions) {
        const type = statusKey(exception?.event_type || exception?.exception_type || exception?.type);
        const hours = number(exception?.hours || exception?.duration_hours);
        if (["vacaciones", "permiso", "falta", "feriado", "libre"].includes(type)) dayHours = hours > 0 ? Math.max(0, dayHours - hours) : 0;
        if (["hora_extra", "horas_extra", "extra"].includes(type)) dayHours += hours;
      }
      total += dayHours;
      cursor = addDays(cursor, 1);
    }
    return { hours: round(total, 1), source: schedule.source, exact: schedule.exact };
  }

  function evidenceCount(task) {
    const assets = array(appState().assets).filter((asset) => sameId(asset?.related_task_id, task?.id) || sameId(asset?.task_id, task?.id));
    const links = [task?.delivery_url, task?.deliverable_url, task?.evidence_url, task?.asset_url, task?.link].filter(Boolean);
    return assets.length + links.length;
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(`${STORE_PREFIX}${currentUserId()}`) || "{}") || {}; } catch { return {}; }
  }

  function writeStore(value) {
    try { localStorage.setItem(`${STORE_PREFIX}${currentUserId()}`, JSON.stringify(value)); } catch { /* local opcional */ }
  }

  function defaultFilters() {
    const period = periodForPreset("current_month");
    return {
      preset: "current_month",
      start: period.start,
      end: period.end,
      basis: "due",
      area: "",
      member: "",
      campaign: "",
      priority: "",
      status: "all",
      includeUndated: false,
      includeArchived: false,
      comparePrevious: true
    };
  }

  function normalizeFilters(raw) {
    const defaults = defaultFilters();
    const next = { ...defaults, ...(raw || {}) };
    next.includeUndated = !!next.includeUndated;
    next.includeArchived = !!next.includeArchived;
    next.comparePrevious = !!next.comparePrevious;
    return next;
  }

  function loadLastFilters() {
    return normalizeFilters(readStore().lastFilters || defaultFilters());
  }

  function persistFilters(filters) {
    const store = readStore();
    store.lastFilters = normalizeFilters(filters);
    writeStore(store);
  }

  function taskMatches(task, filters) {
    const lifecycle = lifecycleState(task);
    if (lifecycle === "trashed") return false;
    if (!filters.includeArchived && lifecycle !== "active") return false;
    if (filters.area && !sameId(areaIdFor(task), filters.area)) return false;
    if (filters.member && !sameId(task?.assigned_to, filters.member)) return false;
    if (filters.campaign && !sameId(task?.campaign_id, filters.campaign)) return false;
    if (filters.priority && statusKey(task?.priority) !== statusKey(filters.priority)) return false;

    const done = isDone(task);
    const overdue = !!task?.due_date && dateKey(task.due_date) < peruToday() && !done;
    const blocked = isBlocked(task);
    const status = filters.status;
    if (status === "open" && done) return false;
    if (status === "done" && !done) return false;
    if (status === "overdue" && !overdue) return false;
    if (status === "blocked" && !blocked) return false;
    if (status === "review" && !REVIEW.has(statusKey(task?.status))) return false;

    if (filters.preset !== "all") {
      const key = taskDate(task, filters.basis);
      if (!key) return !!filters.includeUndated;
      if (!dateInRange(key, filters.start, filters.end)) return false;
    }
    return true;
  }

  function qualityAnalysis(tasks, membersInReport) {
    const issues = [];
    const add = (id, label, count, severity, recommendation) => {
      if (count > 0) issues.push({ id, label, count, severity, recommendation });
    };
    const noAssignee = tasks.filter((task) => !task?.assigned_to).length;
    const noDate = tasks.filter((task) => !task?.due_date).length;
    const noEstimate = tasks.filter((task) => number(workMeta(task?.id)?.estimateHours) <= 0).length;
    const noCampaign = tasks.filter((task) => !task?.campaign_id).length;
    const doneNoEvidence = tasks.filter((task) => isDone(task) && evidenceCount(task) === 0).length;
    const doneInferredDate = tasks.filter((task) => isDone(task) && !completionInfo(task).exact).length;
    const noSchedule = membersInReport.filter((person) => !weeklySchedule(person.id).exact).length;

    add("unassigned", "Tareas sin responsable", noAssignee, "high", "Asignar una persona responsable antes de usar el reporte para gestión.");
    add("undated", "Tareas sin fecha de entrega", noDate, "high", "Definir una fecha para poder medir cumplimiento y vencimientos.");
    add("unestimated", "Tareas sin estimación", noEstimate, "medium", "Estimar el esfuerzo para que Carga y capacidad sean comparables.");
    add("uncampaigned", "Tareas sin campaña", noCampaign, "low", "Vincular el trabajo a una campaña cuando corresponda.");
    add("no-evidence", "Completadas sin evidencia vinculada", doneNoEvidence, "medium", "Adjuntar archivo, enlace o entregable antes del cierre.");
    add("inferred-completion", "Cierre con fecha inferida", doneInferredDate, "low", "Registrar aprobación o cierre explícito para medir puntualidad con precisión.");
    add("reference-schedule", "Capacidad con horario referencial", noSchedule, "low", "Completar Horario Pro para reemplazar la referencia de 40 h/semana.");

    const taskChecks = Math.max(1, tasks.length * 4 + tasks.filter(isDone).length * 2);
    const taskDefects = noAssignee + noDate + noEstimate + noCampaign + doneNoEvidence + doneInferredDate;
    const score = clamp(Math.round((1 - taskDefects / taskChecks) * 100), 0, 100);
    return { score, issues, counts: { noAssignee, noDate, noEstimate, noCampaign, doneNoEvidence, doneInferredDate, noSchedule } };
  }

  function taskRow(task) {
    const meta = workMeta(task?.id);
    const completion = completionInfo(task);
    const due = dateKey(task?.due_date);
    const done = isDone(task);
    const onTime = done && due && completion.date ? completion.date <= due : null;
    const estimate = number(meta?.estimateHours);
    const trackedMinutes = number(meta?.trackedMinutes);
    const trackedHours = trackedMinutes / 60;
    const varianceHours = trackedHours - estimate;
    const dependencies = blockedDependencies(task);
    return {
      id: text(task?.id),
      title: task?.title || "Tarea",
      responsible: memberName(task?.assigned_to),
      responsibleId: text(task?.assigned_to),
      area: areaName(areaIdFor(task)),
      areaId: text(areaIdFor(task)),
      campaign: campaignName(task?.campaign_id),
      campaignId: text(task?.campaign_id),
      client: clientName(clientIdFor(task)),
      status: task?.status || "pendiente",
      priority: task?.priority || "media",
      dueDate: due,
      completionDate: completion.date,
      completionSource: completion.source,
      completionExact: completion.exact,
      onTime,
      estimateHours: round(estimate, 2),
      trackedMinutes: Math.round(trackedMinutes),
      trackedHours: round(trackedHours, 2),
      varianceHours: round(varianceHours, 2),
      blocked: dependencies.length > 0,
      blockedBy: dependencies.map((item) => item?.title || "Tarea").join(" | "),
      tags: array(meta?.tags).join(" | "),
      evidence: evidenceCount(task),
      lifecycle: lifecycleState(task),
      createdAt: task?.created_at || "",
      updatedAt: task?.updated_at || "",
      done,
      overdue: !!due && due < peruToday() && !done,
      review: REVIEW.has(statusKey(task?.status))
    };
  }

  function reportMembers(tasks) {
    const ids = new Set(tasks.map((task) => text(task?.assigned_to)).filter(Boolean));
    return activeMembers().filter((person) => ids.has(text(person?.id)));
  }

  function memberSummary(person, tasks, filters) {
    const assigned = tasks.filter((task) => sameId(task?.assigned_to, person?.id));
    const rows = assigned.map(taskRow);
    const completed = rows.filter((row) => row.done);
    const pending = rows.filter((row) => !row.done);
    const onTimeKnown = completed.filter((row) => row.onTime !== null);
    const onTime = onTimeKnown.filter((row) => row.onTime === true);
    const estimate = rows.reduce((sum, row) => sum + row.estimateHours, 0);
    const trackedHours = rows.reduce((sum, row) => sum + row.trackedHours, 0);
    const capacity = filters.preset === "all" ? { hours: null, source: "Periodo sin límites", exact: false } : capacityForPeriod(person?.id, filters.start, filters.end);
    const loadPercent = capacity.hours > 0 ? Math.round((estimate / capacity.hours) * 100) : null;
    return {
      id: text(person?.id),
      name: person?.full_name || "Miembro",
      position: person?.position || person?.role_code || "Equipo",
      area: areaName(person?.area_id),
      assigned: rows.length,
      completed: completed.length,
      completionRate: percent(completed.length, rows.length),
      onTime: onTime.length,
      onTimeKnown: onTimeKnown.length,
      onTimeRate: percent(onTime.length, onTimeKnown.length),
      pending: pending.length,
      overdue: rows.filter((row) => row.overdue).length,
      blocked: rows.filter((row) => row.blocked).length,
      review: rows.filter((row) => row.review).length,
      unestimated: rows.filter((row) => row.estimateHours <= 0).length,
      estimateHours: round(estimate, 1),
      trackedHours: round(trackedHours, 1),
      varianceHours: round(trackedHours - estimate, 1),
      capacityHours: capacity.hours,
      capacitySource: capacity.source,
      capacityExact: capacity.exact,
      loadPercent,
      evidence: rows.reduce((sum, row) => sum + row.evidence, 0)
    };
  }

  function metricsFor(tasks) {
    const rows = tasks.map(taskRow);
    const completed = rows.filter((row) => row.done);
    const onTimeKnown = completed.filter((row) => row.onTime !== null);
    const onTime = onTimeKnown.filter((row) => row.onTime === true);
    const estimate = rows.reduce((sum, row) => sum + row.estimateHours, 0);
    const trackedHours = rows.reduce((sum, row) => sum + row.trackedHours, 0);
    return {
      total: rows.length,
      completed: completed.length,
      completionRate: percent(completed.length, rows.length),
      onTime: onTime.length,
      onTimeKnown: onTimeKnown.length,
      onTimeRate: percent(onTime.length, onTimeKnown.length),
      pending: rows.filter((row) => !row.done).length,
      overdue: rows.filter((row) => row.overdue).length,
      blocked: rows.filter((row) => row.blocked).length,
      review: rows.filter((row) => row.review).length,
      unassigned: rows.filter((row) => !row.responsibleId).length,
      unestimated: rows.filter((row) => row.estimateHours <= 0).length,
      estimateHours: round(estimate, 1),
      trackedHours: round(trackedHours, 1),
      varianceHours: round(trackedHours - estimate, 1)
    };
  }

  function comparisonPeriod(filters) {
    if (!filters?.start || !filters?.end) return null;
    if (["current_month", "previous_month"].includes(filters.preset)) {
      const anchor = parseDate(filters.start);
      if (!anchor) return null;
      const previousMonth = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1, 12);
      return { start: dateKey(startOfMonth(previousMonth)), end: dateKey(endOfMonth(previousMonth)) };
    }
    if (["today", "current_week", "previous_week"].includes(filters.preset)) {
      const span = daysBetween(filters.start, filters.end);
      const end = addDays(filters.start, -1);
      return { start: dateKey(addDays(end, -(Math.max(1, span) - 1))), end: dateKey(end) };
    }
    return previousPeriod(filters.start, filters.end);
  }

  function comparisonFor(filters) {
    if (!filters.comparePrevious || filters.preset === "all" || !filters.start || !filters.end) return null;
    const previous = comparisonPeriod(filters);
    if (!previous) return null;
    const previousFilters = { ...filters, start: previous.start, end: previous.end, comparePrevious: false };
    const tasks = array(appState().tasks).filter((task) => taskMatches(task, previousFilters));
    return { period: previous, metrics: metricsFor(tasks) };
  }

  function delta(current, previous, inverse = false) {
    if (current === null || previous === null || current === undefined || previous === undefined) return null;
    const value = number(current) - number(previous);
    return { value, favorable: inverse ? value < 0 : value > 0, neutral: value === 0 };
  }

  function buildReport(filtersInput) {
    if (!authorized()) throw new Error("Acceso restringido a Dirección y Supervisión.");
    const filters = normalizeFilters(filtersInput);
    const tasks = array(appState().tasks).filter((task) => taskMatches(task, filters));
    const rows = tasks.map(taskRow).sort((a, b) => text(a.dueDate || "9999-99-99").localeCompare(text(b.dueDate || "9999-99-99")) || a.responsible.localeCompare(b.responsible));
    const members = reportMembers(tasks);
    const team = members.map((person) => memberSummary(person, tasks, filters)).sort((a, b) => b.overdue - a.overdue || b.blocked - a.blocked || b.assigned - a.assigned || a.name.localeCompare(b.name));
    const metrics = metricsFor(tasks);
    metrics.members = team.length;
    metrics.capacityHours = filters.preset === "all" ? null : round(team.reduce((sum, item) => sum + number(item.capacityHours), 0), 1);
    metrics.loadPercent = metrics.capacityHours > 0 ? Math.round((metrics.estimateHours / metrics.capacityHours) * 100) : null;
    const quality = qualityAnalysis(tasks, members);
    const comparison = comparisonFor(filters);
    const risks = [
      ...rows.filter((row) => row.overdue).map((row) => ({ severity: "alta", type: "Tarea vencida", owner: row.responsible, item: row.title, detail: `${row.campaign} · venció ${formatDate(row.dueDate)}` })),
      ...rows.filter((row) => row.blocked).map((row) => ({ severity: "alta", type: "Tarea bloqueada", owner: row.responsible, item: row.title, detail: row.blockedBy || "Dependencia abierta" })),
      ...rows.filter((row) => !row.responsibleId).map((row) => ({ severity: "media", type: "Sin responsable", owner: "Sin responsable", item: row.title, detail: row.campaign })),
      ...team.filter((item) => item.loadPercent !== null && item.loadPercent > 110).map((item) => ({ severity: "media", type: "Carga estimada alta", owner: item.name, item: `${item.loadPercent}% de capacidad`, detail: `${formatHours(item.estimateHours)} planificadas sobre ${formatHours(item.capacityHours)}` })),
      ...rows.filter((row) => row.done && row.onTime === false).map((row) => ({ severity: "media", type: "Cierre fuera de plazo", owner: row.responsible, item: row.title, detail: `Entrega ${formatDate(row.completionDate)} · vencimiento ${formatDate(row.dueDate)}` }))
    ].slice(0, 500);
    return {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      generatedBy: currentMember()?.full_name || "Usuario",
      role: director() ? "Dirección" : "Supervisión",
      scope: director() ? "Todo el equipo visible" : "Equipo visible según permisos",
      filters,
      metrics,
      comparison,
      quality,
      team,
      tasks: rows,
      risks
    };
  }

  function option(value, label, selectedValue) {
    return `<option value="${esc(value)}" ${sameId(value, selectedValue) ? "selected" : ""}>${esc(label)}</option>`;
  }

  function filterOptions(filters) {
    const areas = array(appState().areas).slice().sort((a, b) => text(a?.name).localeCompare(text(b?.name)));
    const members = activeMembers().slice().sort((a, b) => text(a?.full_name).localeCompare(text(b?.full_name)));
    const campaigns = array(appState().campaigns).filter((item) => lifecycleStateFor("campaign", item?.id) !== "trashed").slice().sort((a, b) => text(a?.name).localeCompare(text(b?.name)));
    return { areas, members, campaigns };
  }

  function metricCard(label, value, note, tone = "neutral", comparison = null) {
    let comparisonHtml = "";
    if (comparison) {
      const sign = comparison.value > 0 ? "+" : "";
      const toneClass = comparison.neutral ? "neutral" : comparison.favorable ? "good" : "bad";
      comparisonHtml = `<small class="v176-delta ${toneClass}">${sign}${esc(comparison.value)} vs. periodo anterior</small>`;
    }
    return `<article class="v176-report-metric" data-tone="${esc(tone)}"><span>${esc(label)}</span><strong>${esc(value)}</strong><p>${esc(note)}</p>${comparisonHtml}</article>`;
  }

  function reportHeader(report) {
    const filters = report.filters;
    const period = filters.preset === "all" ? "Todo el historial visible" : `${formatDate(filters.start)} — ${formatDate(filters.end)}`;
    return `<div class="v176-report-context">
      <div><span>PERIODO DEL REPORTE</span><strong>${esc(period)}</strong><small>${esc(report.scope)} · ${esc(report.role)}</small></div>
      <div><span>GENERADO</span><strong>${esc(new Date(report.generatedAt).toLocaleString("es-PE"))}</strong><small>${esc(report.generatedBy)} · criterio: ${esc(filters.basis === "due" ? "fecha de entrega" : filters.basis === "created" ? "fecha de creación" : filters.basis === "updated" ? "última actualización" : "fecha de cierre")}</small></div>
    </div>`;
  }

  function reportMetrics(report) {
    const current = report.metrics;
    const previous = report.comparison?.metrics || null;
    return `<div class="v176-report-metrics">
      ${metricCard("Tareas incluidas", current.total, `${current.members} miembro${current.members === 1 ? "" : "s"}`, "neutral", previous ? delta(current.total, previous.total) : null)}
      ${metricCard("Cumplimiento", current.completionRate === null ? "N/D" : `${current.completionRate}%`, `${current.completed} completadas`, current.completionRate !== null && current.completionRate >= 80 ? "good" : current.completionRate !== null && current.completionRate < 60 ? "bad" : "warning", previous ? delta(current.completionRate, previous.completionRate) : null)}
      ${metricCard("A tiempo", current.onTimeRate === null ? "N/D" : `${current.onTimeRate}%`, `${current.onTime}/${current.onTimeKnown} cierres medibles`, current.onTimeRate !== null && current.onTimeRate >= 85 ? "good" : current.onTimeRate !== null && current.onTimeRate < 65 ? "bad" : "warning", previous ? delta(current.onTimeRate, previous.onTimeRate) : null)}
      ${metricCard("Vencidas", current.overdue, `${current.pending} pendientes`, current.overdue ? "bad" : "good", previous ? delta(current.overdue, previous.overdue, true) : null)}
      ${metricCard("Bloqueadas", current.blocked, `${current.review} en revisión`, current.blocked ? "warning" : "good", previous ? delta(current.blocked, previous.blocked, true) : null)}
      ${metricCard("Carga planificada", current.loadPercent === null ? "N/D" : `${current.loadPercent}%`, current.capacityHours === null ? "Periodo sin capacidad calculable" : `${formatHours(current.estimateHours)} / ${formatHours(current.capacityHours)}`, current.loadPercent !== null && current.loadPercent > 110 ? "bad" : current.loadPercent !== null && current.loadPercent > 85 ? "warning" : "good")}
      ${metricCard("Tiempo registrado", formatHours(current.trackedHours), `Variación ${current.varianceHours >= 0 ? "+" : ""}${formatHours(current.varianceHours)}`, "neutral", previous ? delta(current.trackedHours, previous.trackedHours) : null)}
      ${metricCard("Calidad de datos", `${report.quality.score}%`, `${report.quality.issues.length} tipo${report.quality.issues.length === 1 ? "" : "s"} de observación`, report.quality.score >= 90 ? "good" : report.quality.score >= 75 ? "warning" : "bad")}
    </div>`;
  }

  function loadTone(value) {
    if (value === null) return "neutral";
    if (value > 110) return "bad";
    if (value > 85) return "warning";
    return "good";
  }

  function teamTable(report) {
    const rows = report.team;
    return `<div class="v176-section-head"><div><h3>Rendimiento por colaborador</h3><p>El cumplimiento se calcula por tareas; la carga solo usa estimaciones registradas.</p></div><span>${rows.length} integrante${rows.length === 1 ? "" : "s"}</span></div>
      <div class="v176-table-wrap"><table class="v176-report-table"><thead><tr><th>Colaborador</th><th>Tareas</th><th>Cumplimiento</th><th>A tiempo</th><th>Pendientes</th><th>Vencidas</th><th>Bloqueadas</th><th>Estimadas</th><th>Registradas</th><th>Carga</th></tr></thead><tbody>
      ${rows.map((row) => `<tr><td><strong>${esc(row.name)}</strong><small>${esc(row.area)} · ${esc(row.position)}</small></td><td>${row.assigned}</td><td><b>${row.completionRate === null ? "N/D" : `${row.completionRate}%`}</b><small>${row.completed} completadas</small></td><td>${row.onTimeRate === null ? "N/D" : `${row.onTimeRate}%`}<small>${row.onTime}/${row.onTimeKnown} medibles</small></td><td>${row.pending}</td><td class="${row.overdue ? "v176-cell-danger" : ""}">${row.overdue}</td><td class="${row.blocked ? "v176-cell-warning" : ""}">${row.blocked}</td><td>${formatHours(row.estimateHours)}<small>${row.unestimated ? `${row.unestimated} sin estimar` : "Completo"}</small></td><td>${formatHours(row.trackedHours)}<small>${row.varianceHours >= 0 ? "+" : ""}${formatHours(row.varianceHours)} vs. plan</small></td><td><span class="v176-load-chip ${loadTone(row.loadPercent)}">${row.loadPercent === null ? "N/D" : `${row.loadPercent}%`}</span><small>${row.capacityHours === null ? "Sin periodo" : `${formatHours(row.capacityHours)} capacidad`}</small></td></tr>`).join("") || `<tr><td colspan="10"><div class="v176-empty">No hay tareas para los filtros seleccionados.</div></td></tr>`}
      </tbody></table></div>`;
  }

  function riskList(report) {
    const visible = report.risks.slice(0, 12);
    return `<div class="v176-section-head"><div><h3>Riesgos y alertas</h3><p>Prioriza vencimientos, bloqueos y sobrecarga estimada.</p></div><span>${report.risks.length} señal${report.risks.length === 1 ? "" : "es"}</span></div>
      <div class="v176-risk-grid">${visible.map((risk) => `<article data-severity="${esc(risk.severity)}"><span>${esc(risk.type)}</span><strong>${esc(risk.item)}</strong><p>${esc(risk.owner)} · ${esc(risk.detail)}</p></article>`).join("") || `<div class="v176-empty"><strong>Sin riesgos detectados</strong><p>No hay vencimientos, bloqueos ni sobrecarga en este filtro.</p></div>`}</div>
      ${report.risks.length > visible.length ? `<p class="v176-more-note">El Excel incluirá las ${report.risks.length} señales.</p>` : ""}`;
  }

  function qualityList(report) {
    return `<div class="v176-section-head"><div><h3>Integridad del reporte</h3><p>Antes de tomar decisiones, completa los datos que faltan.</p></div><span>${report.quality.score}%</span></div>
      <div class="v176-quality-list">${report.quality.issues.map((issue) => `<article data-severity="${esc(issue.severity)}"><b>${issue.count}</b><div><strong>${esc(issue.label)}</strong><p>${esc(issue.recommendation)}</p></div></article>`).join("") || `<div class="v176-empty"><strong>Datos completos</strong><p>No se detectaron observaciones de integridad en este reporte.</p></div>`}</div>`;
  }

  function renderReport(report) {
    const host = document.getElementById("v176ReportPreview");
    if (!host) return;
    activeReport = report;
    host.innerHTML = `${reportHeader(report)}${reportMetrics(report)}<section>${teamTable(report)}</section><section class="v176-report-split"><div>${riskList(report)}</div><div>${qualityList(report)}</div></section>`;
    const count = document.getElementById("v176ReportCount");
    if (count) count.textContent = `${report.tasks.length} tarea${report.tasks.length === 1 ? "" : "s"} · ${report.team.length} integrante${report.team.length === 1 ? "" : "s"}`;
  }

  function filtersFromForm() {
    const value = (id) => document.getElementById(id)?.value || "";
    const checked = (id) => !!document.getElementById(id)?.checked;
    return normalizeFilters({
      preset: value("v176PeriodPreset"),
      start: value("v176StartDate"),
      end: value("v176EndDate"),
      basis: value("v176DateBasis"),
      area: value("v176AreaFilter"),
      member: value("v176MemberFilter"),
      campaign: value("v176CampaignFilter"),
      priority: value("v176PriorityFilter"),
      status: value("v176StatusFilter"),
      includeUndated: checked("v176IncludeUndated"),
      includeArchived: checked("v176IncludeArchived"),
      comparePrevious: checked("v176ComparePrevious")
    });
  }

  function updateCustomDates(preset) {
    const start = document.getElementById("v176StartDate");
    const end = document.getElementById("v176EndDate");
    if (!start || !end) return;
    if (preset !== "custom" && preset !== "all") {
      const period = periodForPreset(preset);
      start.value = period.start;
      end.value = period.end;
    }
    const disabled = preset === "all";
    start.disabled = disabled;
    end.disabled = disabled;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const filters = filtersFromForm();
      persistFilters(filters);
      renderReport(buildReport(filters));
    }, 120);
  }

  function savedViews() {
    return array(readStore().views).slice(0, 20);
  }

  function renderSavedViews(selected = "") {
    const select = document.getElementById("v176SavedView");
    if (!select) return;
    select.innerHTML = `<option value="">Vistas guardadas</option>${savedViews().map((item) => option(item.id, item.name, selected)).join("")}`;
  }

  async function saveView() {
    const filters = filtersFromForm();
    let name = "";
    try {
      if (typeof premiumInputModal === "function") name = await premiumInputModal({ title: "Guardar vista de reporte", subtitle: "Conserva filtros, periodo y criterio de fecha.", label: "Nombre", placeholder: "Ej. Resumen semanal del equipo", confirmLabel: "Guardar", required: true });
      else name = window.prompt("Nombre de la vista");
    } catch { name = window.prompt("Nombre de la vista"); }
    if (!name) return;
    const store = readStore();
    store.views = array(store.views);
    const item = { id: `view_${Date.now().toString(36)}`, name: text(name).trim().slice(0, 80), filters, createdAt: new Date().toISOString() };
    store.views.unshift(item);
    store.views = store.views.slice(0, 20);
    store.lastFilters = filters;
    writeStore(store);
    renderSavedViews(item.id);
    notify("Vista guardada", item.name, "success");
  }

  function applySavedView(id) {
    const item = savedViews().find((view) => sameId(view.id, id));
    if (!item) return;
    applyFiltersToForm(item.filters);
    scheduleRender();
  }

  async function deleteSavedView() {
    const id = document.getElementById("v176SavedView")?.value;
    if (!id) return notify("Selecciona una vista", "Elige la vista que deseas eliminar.", "warning");
    const store = readStore();
    store.views = array(store.views).filter((item) => !sameId(item.id, id));
    writeStore(store);
    renderSavedViews();
    notify("Vista eliminada", "La configuración local fue retirada.", "success");
  }

  function applyFiltersToForm(filtersInput) {
    const filters = normalizeFilters(filtersInput);
    const setValue = (id, value) => { const node = document.getElementById(id); if (node) node.value = value ?? ""; };
    const setChecked = (id, value) => { const node = document.getElementById(id); if (node) node.checked = !!value; };
    setValue("v176PeriodPreset", filters.preset);
    setValue("v176StartDate", filters.start);
    setValue("v176EndDate", filters.end);
    setValue("v176DateBasis", filters.basis);
    setValue("v176AreaFilter", filters.area);
    setValue("v176MemberFilter", filters.member);
    setValue("v176CampaignFilter", filters.campaign);
    setValue("v176PriorityFilter", filters.priority);
    setValue("v176StatusFilter", filters.status);
    setChecked("v176IncludeUndated", filters.includeUndated);
    setChecked("v176IncludeArchived", filters.includeArchived);
    setChecked("v176ComparePrevious", filters.comparePrevious);
    updateCustomDates(filters.preset);
  }

  function modalHtml(filters) {
    const { areas, members, campaigns } = filterOptions(filters);
    return `<section class="v176-report-dialog" role="dialog" aria-modal="true" aria-labelledby="v176ReportTitle">
      <header class="v176-report-head">
        <div><span>WORK 360 · ${VERSION}</span><h2 id="v176ReportTitle">Reporte profesional del equipo</h2><p>Analiza cumplimiento, puntualidad, carga, tiempo e integridad con los datos visibles para tu rol.</p></div>
        <div class="v176-head-actions"><span id="v176ReportCount">Preparando reporte…</span><button type="button" data-v176-action="close" aria-label="Cerrar">×</button></div>
      </header>
      <div class="v176-report-layout">
        <aside class="v176-report-filters">
          <div class="v176-filter-title"><div><strong>Configuración</strong><span>El periodo se aplica al criterio de fecha elegido.</span></div><button type="button" data-v176-action="reset">Restablecer</button></div>
          <label>Periodo<select id="v176PeriodPreset">
            ${option("today", "Hoy", filters.preset)}${option("current_week", "Esta semana", filters.preset)}${option("previous_week", "Semana anterior", filters.preset)}${option("current_month", "Este mes", filters.preset)}${option("previous_month", "Mes anterior", filters.preset)}${option("last_30", "Últimos 30 días", filters.preset)}${option("last_90", "Últimos 90 días", filters.preset)}${option("custom", "Rango personalizado", filters.preset)}${option("all", "Todo el historial visible", filters.preset)}
          </select></label>
          <div class="v176-date-grid"><label>Desde<input id="v176StartDate" type="date" value="${esc(filters.start)}"></label><label>Hasta<input id="v176EndDate" type="date" value="${esc(filters.end)}"></label></div>
          <label>Criterio de fecha<select id="v176DateBasis">${option("due", "Fecha de entrega", filters.basis)}${option("created", "Fecha de creación", filters.basis)}${option("updated", "Última actualización", filters.basis)}${option("completed", "Fecha de cierre", filters.basis)}</select></label>
          <label>Área<select id="v176AreaFilter"><option value="">Todas las áreas visibles</option>${areas.map((item) => option(item.id, item.name || "Área", filters.area)).join("")}</select></label>
          <label>Colaborador<select id="v176MemberFilter"><option value="">Todo el equipo visible</option>${members.map((item) => option(item.id, item.full_name || "Miembro", filters.member)).join("")}</select></label>
          <label>Campaña<select id="v176CampaignFilter"><option value="">Todas las campañas</option>${campaigns.map((item) => option(item.id, item.name || "Campaña", filters.campaign)).join("")}</select></label>
          <div class="v176-date-grid"><label>Estado<select id="v176StatusFilter">${option("all", "Todos", filters.status)}${option("open", "Abiertas", filters.status)}${option("done", "Completadas", filters.status)}${option("overdue", "Vencidas", filters.status)}${option("blocked", "Bloqueadas", filters.status)}${option("review", "En revisión", filters.status)}</select></label><label>Prioridad<select id="v176PriorityFilter"><option value="">Todas</option>${["baja", "media", "alta", "urgente"].map((value) => option(value, value[0].toUpperCase() + value.slice(1), filters.priority)).join("")}</select></label></div>
          <div class="v176-checks"><label><input id="v176IncludeUndated" type="checkbox" ${filters.includeUndated ? "checked" : ""}> Incluir tareas sin fecha</label><label><input id="v176IncludeArchived" type="checkbox" ${filters.includeArchived ? "checked" : ""}> Incluir archivadas</label><label><input id="v176ComparePrevious" type="checkbox" ${filters.comparePrevious ? "checked" : ""}> Comparar periodo anterior</label></div>
          <div class="v176-saved-views"><select id="v176SavedView"><option value="">Vistas guardadas</option></select><div><button type="button" data-v176-action="save-view">Guardar vista</button><button type="button" data-v176-action="delete-view">Eliminar</button></div></div>
          <div class="v176-filter-note"><strong>Alcance protegido</strong><p>El reporte usa únicamente la información que Supabase y RLS ya entregaron a tu sesión. No amplía permisos.</p></div>
        </aside>
        <main id="v176ReportPreview" class="v176-report-preview"><div class="v176-loading">Preparando indicadores…</div></main>
      </div>
      <footer class="v176-report-foot"><p>Los indicadores dependen de fechas, estimaciones y tiempos registrados. Revisa Integridad antes de evaluar resultados.</p><div><button type="button" data-v176-action="snapshot">Guardar snapshot</button><button type="button" data-v176-action="print">Imprimir / PDF</button><button type="button" data-v176-action="csv">Exportar CSV</button><button type="button" class="primary" data-v176-action="excel">Exportar Excel</button></div></footer>
    </section>`;
  }

  function openReports() {
    if (!authorized()) return notify("Acceso restringido", "Los reportes del equipo están disponibles para Dirección y Supervisión.", "warning");
    closeReports();
    const filters = loadLastFilters();
    const backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "v176-report-backdrop";
    backdrop.innerHTML = modalHtml(filters);
    document.body.appendChild(backdrop);
    bindModal(backdrop);
    renderSavedViews();
    applyFiltersToForm(filters);
    renderReport(buildReport(filters));
    requestAnimationFrame(() => backdrop.classList.add("open"));
  }

  function closeReports() {
    clearTimeout(renderTimer);
    document.getElementById(MODAL_ID)?.remove();
  }

  function bindModal(backdrop) {
    backdrop.addEventListener("click", (event) => {
      const action = event.target.closest("[data-v176-action]")?.dataset.v176Action;
      if (event.target === backdrop || action === "close") return closeReports();
      if (action === "reset") {
        const filters = defaultFilters();
        applyFiltersToForm(filters);
        persistFilters(filters);
        return renderReport(buildReport(filters));
      }
      if (action === "save-view") return void saveView();
      if (action === "delete-view") return void deleteSavedView();
      if (action === "excel") return exportExcel(activeReport || buildReport(filtersFromForm()));
      if (action === "csv") return exportCsv(activeReport || buildReport(filtersFromForm()));
      if (action === "print") return printReport(activeReport || buildReport(filtersFromForm()));
      if (action === "snapshot") return void saveSnapshot(activeReport || buildReport(filtersFromForm()));
    });
    backdrop.addEventListener("change", (event) => {
      if (event.target.id === "v176PeriodPreset") updateCustomDates(event.target.value);
      if (event.target.id === "v176SavedView") return applySavedView(event.target.value);
      scheduleRender();
    });
    backdrop.addEventListener("input", (event) => {
      if (["v176StartDate", "v176EndDate"].includes(event.target.id)) scheduleRender();
    });
  }

  function safeSpreadsheetText(value) {
    const raw = text(value);
    return /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  }

  function csvCell(value) {
    return `"${safeSpreadsheetText(value).replaceAll('"', '""')}"`;
  }

  function downloadBlob(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function filenamePart(report) {
    const start = report.filters.start || "historial";
    const end = report.filters.end && report.filters.end !== start ? `_${report.filters.end}` : "";
    return `${start}${end}`.replace(/[^0-9A-Za-z_-]/g, "-");
  }

  function exportCsv(report) {
    if (!authorized()) return notify("Acceso restringido", "La exportación del equipo requiere rol de Dirección o Supervisión.", "warning");
    if (!report) return;
    const headers = ["ID", "Tarea", "Responsable", "Área", "Campaña", "Cliente", "Estado", "Prioridad", "Fecha entrega", "Fecha cierre", "A tiempo", "Estimación h", "Tiempo min", "Variación h", "Bloqueada", "Dependencias", "Evidencias", "Etiquetas", "Ciclo de vida"];
    const rows = report.tasks.map((row) => [row.id, row.title, row.responsible, row.area, row.campaign, row.client, row.status, row.priority, row.dueDate, row.completionDate, row.onTime === null ? "No medible" : row.onTime ? "Sí" : "No", row.estimateHours, row.trackedMinutes, row.varianceHours, row.blocked ? "Sí" : "No", row.blockedBy, row.evidence, row.tags, row.lifecycle]);
    const metadata = [
      ["Reporte", "WORK 360 TEAM REPORTS"], ["Versión", VERSION], ["Generado", report.generatedAt], ["Generado por", report.generatedBy], ["Alcance", report.scope], ["Periodo", report.filters.preset === "all" ? "Todo el historial visible" : `${report.filters.start} a ${report.filters.end}`], []
    ];
    const csv = [...metadata, headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadBlob(`work360_equipo_${filenamePart(report)}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
    notify("Reporte CSV creado", `${report.tasks.length} tareas incluidas.`, "success");
  }

  function excelCell(value, style = "", typeName = null) {
    const isNumber = typeName === "Number" || (typeName === null && typeof value === "number" && Number.isFinite(value));
    const type = isNumber ? "Number" : "String";
    const safe = isNumber ? value : safeSpreadsheetText(value);
    return `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="${type}">${xmlEsc(safe)}</Data></Cell>`;
  }

  function excelRow(values, style = "") {
    return `<Row>${values.map((value) => excelCell(value, style)).join("")}</Row>`;
  }

  function sheetXml(name, rows, widths = []) {
    return `<Worksheet ss:Name="${xmlEsc(name.slice(0, 31))}"><Table>${widths.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join("")}${rows.join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
  }

  function exportExcel(report) {
    if (!authorized()) return notify("Acceso restringido", "La exportación del equipo requiere rol de Dirección o Supervisión.", "warning");
    if (!report) return;
    const summaryRows = [
      `<Row ss:Height="34">${excelCell("WORK 360 · REPORTE DEL EQUIPO", "Title")}</Row>`,
      excelRow(["Versión", VERSION]), excelRow(["Generado", new Date(report.generatedAt).toLocaleString("es-PE")]), excelRow(["Generado por", report.generatedBy]), excelRow(["Alcance", report.scope]),
      excelRow(["Periodo", report.filters.preset === "all" ? "Todo el historial visible" : `${report.filters.start} a ${report.filters.end}`]), excelRow(["Criterio de fecha", report.filters.basis]),
      `<Row/>`, excelRow(["INDICADOR", "VALOR", "DETALLE"], "Header"),
      excelRow(["Tareas incluidas", report.metrics.total, `${report.metrics.members} integrantes`]),
      excelRow(["Cumplimiento", report.metrics.completionRate === null ? "N/D" : `${report.metrics.completionRate}%`, `${report.metrics.completed} completadas`]),
      excelRow(["Puntualidad", report.metrics.onTimeRate === null ? "N/D" : `${report.metrics.onTimeRate}%`, `${report.metrics.onTime}/${report.metrics.onTimeKnown} cierres medibles`]),
      excelRow(["Pendientes", report.metrics.pending, ""]), excelRow(["Vencidas", report.metrics.overdue, ""]), excelRow(["Bloqueadas", report.metrics.blocked, ""]),
      excelRow(["Horas estimadas", report.metrics.estimateHours, ""]), excelRow(["Horas registradas", report.metrics.trackedHours, ""]), excelRow(["Capacidad", report.metrics.capacityHours === null ? "N/D" : report.metrics.capacityHours, ""]),
      excelRow(["Carga", report.metrics.loadPercent === null ? "N/D" : `${report.metrics.loadPercent}%`, "Solo estimaciones registradas"]), excelRow(["Calidad de datos", `${report.quality.score}%`, `${report.quality.issues.length} tipos de observación`])
    ];

    const teamRows = [excelRow(["Colaborador", "Cargo", "Área", "Tareas", "Completadas", "Cumplimiento %", "A tiempo", "Puntualidad %", "Pendientes", "Vencidas", "Bloqueadas", "En revisión", "Sin estimar", "Estimadas h", "Registradas h", "Variación h", "Capacidad h", "Carga %", "Fuente capacidad"], "Header"),
      ...report.team.map((row) => excelRow([row.name, row.position, row.area, row.assigned, row.completed, row.completionRate ?? "N/D", row.onTime, row.onTimeRate ?? "N/D", row.pending, row.overdue, row.blocked, row.review, row.unestimated, row.estimateHours, row.trackedHours, row.varianceHours, row.capacityHours ?? "N/D", row.loadPercent ?? "N/D", row.capacitySource]))
    ];

    const detailRows = [excelRow(["ID", "Tarea", "Responsable", "Área", "Campaña", "Cliente", "Estado", "Prioridad", "Entrega", "Cierre", "A tiempo", "Fecha cierre exacta", "Estimación h", "Tiempo min", "Tiempo h", "Variación h", "Bloqueada", "Dependencias", "Evidencias", "Etiquetas", "Ciclo de vida", "Creada", "Actualizada"], "Header"),
      ...report.tasks.map((row) => excelRow([row.id, row.title, row.responsible, row.area, row.campaign, row.client, row.status, row.priority, row.dueDate, row.completionDate, row.onTime === null ? "No medible" : row.onTime ? "Sí" : "No", row.completionExact ? "Sí" : "No", row.estimateHours, row.trackedMinutes, row.trackedHours, row.varianceHours, row.blocked ? "Sí" : "No", row.blockedBy, row.evidence, row.tags, row.lifecycle, row.createdAt, row.updatedAt]))
    ];

    const riskRows = [excelRow(["Severidad", "Tipo", "Responsable", "Elemento", "Detalle"], "Header"), ...report.risks.map((row) => excelRow([row.severity, row.type, row.owner, row.item, row.detail]))];
    const qualityRows = [excelRow(["Severidad", "Observación", "Cantidad", "Recomendación"], "Header"), ...report.quality.issues.map((row) => excelRow([row.severity, row.label, row.count, row.recommendation]))];

    const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>${xmlEsc(report.generatedBy)}</Author><Created>${new Date(report.generatedAt).toISOString()}</Created><Company>INBESTIGA</Company><Version>17.6</Version></DocumentProperties><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Borders/><Font ss:FontName="Arial" ss:Size="10"/><Interior/><NumberFormat/><Protection/></Style><Style ss:ID="Header"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1D1D1F" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style><Style ss:ID="Title"><Font ss:FontName="Arial" ss:Size="18" ss:Bold="1" ss:Color="#1D1D1F"/><Alignment ss:Vertical="Center"/></Style></Styles>${sheetXml("Resumen ejecutivo", summaryRows, [170, 120, 300])}${sheetXml("Por colaborador", teamRows, [180, 120, 120, 65, 75, 80, 65, 80, 65, 65, 70, 70, 75, 85, 90, 80, 85, 70, 180])}${sheetXml("Detalle de tareas", detailRows, [90, 250, 160, 110, 180, 140, 100, 80, 85, 85, 70, 85, 80, 80, 80, 80, 70, 240, 70, 140, 80, 130, 130])}${sheetXml("Riesgos y alertas", riskRows, [80, 140, 150, 230, 300])}${sheetXml("Calidad de datos", qualityRows, [80, 220, 80, 400])}</Workbook>`;
    downloadBlob(`work360_equipo_${filenamePart(report)}.xls`, `\ufeff${workbook}`, "application/vnd.ms-excel;charset=utf-8");
    notify("Reporte Excel creado", "Incluye Resumen, Colaboradores, Tareas, Riesgos y Calidad de datos.", "success");
  }

  function printableHtml(report) {
    const metric = (label, value) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Work 360 · Reporte del equipo</title><style>body{font-family:Arial,sans-serif;color:#1d1d1f;margin:28px}h1{font-size:28px;margin:0}p{color:#5f6368}.meta{display:flex;justify-content:space-between;border-bottom:2px solid #1d1d1f;padding-bottom:16px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.metrics div{border:1px solid #ddd;border-radius:10px;padding:12px}.metrics span,.metrics strong{display:block}.metrics span{font-size:10px;color:#666;text-transform:uppercase}.metrics strong{font-size:22px;margin-top:6px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #ddd;padding:7px;text-align:left;vertical-align:top}th{background:#1d1d1f;color:#fff}.note{font-size:9px;margin-top:18px}@media print{body{margin:10mm}.no-print{display:none}}</style></head><body><div class="meta"><div><h1>WORK 360 · Reporte del equipo</h1><p>${esc(report.scope)} · ${esc(report.generatedBy)}</p></div><div><b>${esc(report.filters.preset === "all" ? "Todo el historial" : `${report.filters.start} — ${report.filters.end}`)}</b><p>${esc(new Date(report.generatedAt).toLocaleString("es-PE"))}</p></div></div><div class="metrics">${metric("Tareas", report.metrics.total)}${metric("Cumplimiento", report.metrics.completionRate === null ? "N/D" : `${report.metrics.completionRate}%`)}${metric("A tiempo", report.metrics.onTimeRate === null ? "N/D" : `${report.metrics.onTimeRate}%`)}${metric("Vencidas", report.metrics.overdue)}${metric("Bloqueadas", report.metrics.blocked)}${metric("Estimadas", formatHours(report.metrics.estimateHours))}${metric("Registradas", formatHours(report.metrics.trackedHours))}${metric("Calidad de datos", `${report.quality.score}%`)}</div><h2>Rendimiento por colaborador</h2><table><thead><tr><th>Colaborador</th><th>Tareas</th><th>Cumplimiento</th><th>A tiempo</th><th>Pendientes</th><th>Vencidas</th><th>Bloqueadas</th><th>Estimadas</th><th>Registradas</th><th>Carga</th></tr></thead><tbody>${report.team.map((row) => `<tr><td><b>${esc(row.name)}</b><br>${esc(row.area)}</td><td>${row.assigned}</td><td>${row.completionRate === null ? "N/D" : `${row.completionRate}%`}</td><td>${row.onTimeRate === null ? "N/D" : `${row.onTimeRate}%`}</td><td>${row.pending}</td><td>${row.overdue}</td><td>${row.blocked}</td><td>${esc(formatHours(row.estimateHours))}</td><td>${esc(formatHours(row.trackedHours))}</td><td>${row.loadPercent === null ? "N/D" : `${row.loadPercent}%`}</td></tr>`).join("")}</tbody></table><p class="note">Los indicadores dependen de la calidad de fechas, estimaciones, tiempos y evidencias registradas. Este reporte no debe utilizarse como medida aislada de desempeño personal.</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`;
  }

  function printReport(report) {
    if (!authorized()) return notify("Acceso restringido", "La impresión del equipo requiere rol de Dirección o Supervisión.", "warning");
    if (!report) return;
    const popup = window.open("", "_blank");
    try { if (popup) popup.opener = null; } catch { /* sin acceso al opener */ }
    if (!popup) return notify("Ventana bloqueada", "Permite ventanas emergentes para imprimir o guardar como PDF.", "warning");
    popup.document.open();
    popup.document.write(printableHtml(report));
    popup.document.close();
  }

  async function saveSnapshot(report) {
    if (!authorized()) return notify("Acceso restringido", "Guardar reportes del equipo requiere rol de Dirección o Supervisión.", "warning");
    if (!report) return;
    try {
      if (typeof sb === "undefined" || !sb?.rpc) throw new Error("Supabase no está disponible en esta sesión.");
      const payload = {
        version: VERSION,
        generated_at: report.generatedAt,
        generated_by: report.generatedBy,
        scope: report.scope,
        filters: report.filters,
        metrics: report.metrics,
        quality: { score: report.quality.score, counts: report.quality.counts },
        team: report.team.map(({ id, name, area, assigned, completed, completionRate, onTimeRate, pending, overdue, blocked, estimateHours, trackedHours, capacityHours, loadPercent }) => ({ id, name, area, assigned, completed, completionRate, onTimeRate, pending, overdue, blocked, estimateHours, trackedHours, capacityHours, loadPercent }))
      };
      const title = `Work 360 · ${report.filters.preset === "all" ? "Historial" : `${report.filters.start} a ${report.filters.end}`} · ${new Date().toLocaleString("es-PE")}`;
      const result = await sb.rpc("ibm_v32_create_report_snapshot", { p_title: title, p_report_type: "work360_team", p_payload: payload });
      if (result?.error) throw result.error;
      notify("Snapshot guardado", "El resumen ejecutivo quedó registrado en Reportes Pro.", "success");
    } catch (error) {
      notify("No se pudo guardar el snapshot", error?.message || text(error), "error");
    }
  }

  function ensureButton() {
    const shell = document.getElementById("v17Work360Shell");
    if (!shell || document.getElementById(BUTTON_ID)) return;
    if (!authorized()) return;
    const tools = shell.querySelector(".v17-tool-grid");
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "v176-team-report-button";
    button.innerHTML = `<span>Reporte del equipo</span><small>Excel · CSV · PDF</small>`;
    button.addEventListener("click", openReports);
    if (tools) tools.appendChild(button); else shell.querySelector(".v17-work360-head")?.appendChild(button);
  }

  function installObserver() {
    if (shellObserver || typeof MutationObserver === "undefined") return;
    shellObserver = new MutationObserver(() => ensureButton());
    shellObserver.observe(document.body, { childList: true, subtree: true });
  }

  function health() {
    return {
      version: VERSION,
      authorized: authorized(),
      button: !!document.getElementById(BUTTON_ID),
      tasks_visible: array(appState().tasks).length,
      members_visible: activeMembers().length,
      snapshots_rpc_reused: "ibm_v32_create_report_snapshot",
      schema_changes: false
    };
  }

  function registerBuild() {
    try { window.INBESTIGA_QUALITY_CORE?.register?.("work360-team-reports", { version: VERSION, mode: "read-only-reporting-existing-rpc" }); } catch { /* opcional */ }
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "work360-team-reports"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    ensureButton();
    installObserver();
    window.addEventListener("inbestiga:lifecycle-updated", () => { if (document.getElementById(MODAL_ID)) scheduleRender(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.getElementById(MODAL_ID)) closeReports();
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && text(event.key).toLowerCase() === "r" && authorized()) {
        const activeSection = document.querySelector(".section.active")?.id;
        if (activeSection === "tasks") { event.preventDefault(); openReports(); }
      }
    });
    registerBuild();
  }

  window.INBESTIGA_WORK360_TEAM_REPORTS = {
    version: VERSION,
    build: BUILD,
    open: openReports,
    close: closeReports,
    buildReport,
    exportExcel,
    exportCsv,
    saveSnapshot,
    health,
    refreshButton: ensureButton
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
