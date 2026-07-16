/* ===== v17.7 MEMBER WALL WORK SYNC ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_MEMBER_WALL_WORK_SYNC) return;

  const VERSION = "v17.7";
  const BUILD = "MEMBER WALL WORK SYNC";
  const LOCAL_PREFIX = "inbestiga:v177:wall-work:";
  const PREF_PREFIX = "inbestiga:v177:wall-work-prefs:";
  const MAX_LINKS = 500;
  const DONE = new Set(["aprobado", "publicado", "completado", "completada", "finalizado", "finalizada", "done", "hecho", "cerrado", "cerrada"]);

  let initialized = false;
  let selectedMemberId = "";
  let mode = "starting";
  let lastError = "";
  let links = [];
  let realtimeChannel = null;
  let realtimeStatus = "inactive";
  let syncing = false;
  let wrappersInstalled = false;

  const array = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? "");
  const sameId = (a, b) => text(a) === text(b);
  const esc = (value) => text(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const nowIso = () => new Date().toISOString();

  function appState() {
    try { return typeof state !== "undefined" && state ? state : (window.state || {}); } catch { return window.state || {}; }
  }

  function currentMember() {
    try { return typeof member !== "undefined" && member ? member : (window.member || null); } catch { return window.member || null; }
  }

  function currentAuthId() {
    try { return text(authUser?.id || session?.user?.id || ""); } catch { return ""; }
  }

  function currentMemberId() {
    return text(currentMember()?.id || "guest");
  }

  function getSb() {
    try { return typeof sb !== "undefined" && sb ? sb : (window.sb || null); } catch { return window.sb || null; }
  }

  function getApi() {
    const client = getSb();
    return client?.schema?.("marketing_app") || client;
  }

  function director() {
    try { return typeof isDirector === "function" && isDirector(); } catch { return false; }
  }

  function supervisor() {
    try { return typeof isSupervisor === "function" && isSupervisor(); } catch { return director(); }
  }

  function manager() {
    return director() || supervisor();
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

  function taskMeta(taskId) {
    try { return window.INBESTIGA_WORK360_ADVANCED?.getMeta?.(taskId) || {}; } catch { return {}; }
  }

  function lifecycleState(entity, id) {
    try { return window.INBESTIGA_RECORD_LIFECYCLE?.state?.(entity, id) || "active"; } catch { return "active"; }
  }

  function record(listName, id) {
    return array(appState()[listName]).find((item) => sameId(item?.id, id)) || null;
  }

  function taskById(id) {
    return record("tasks", id);
  }

  function postById(id) {
    return record("posts", id);
  }

  function memberById(id) {
    return record("members", id) || (sameId(currentMember()?.id, id) ? currentMember() : null);
  }

  function campaignById(id) {
    return record("campaigns", id);
  }

  function memberName(id) {
    try { if (typeof window.memberName === "function") return window.memberName(id); } catch { /* fallback */ }
    return memberById(id)?.full_name || "Sin responsable";
  }

  function campaignName(id) {
    return campaignById(id)?.name || "Sin campaña";
  }

  function areaName(id) {
    return record("areas", id)?.name || "Sin área";
  }

  function formatDate(value, fallback = "Sin fecha") {
    if (!value) return fallback;
    try {
      return new Date(`${text(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return text(value); }
  }

  function startOfWeekKey() {
    const date = new Date();
    const day = date.getDay() || 7;
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - day + 1);
    return date.toISOString().slice(0, 10);
  }

  function todayKey() {
    try { return typeof today === "function" ? today() : new Date().toISOString().slice(0, 10); } catch { return new Date().toISOString().slice(0, 10); }
  }

  function localKey() {
    return `${LOCAL_PREFIX}${currentAuthId() || currentMemberId()}`;
  }

  function prefKey(memberId = currentMemberId()) {
    return `${PREF_PREFIX}${memberId || "guest"}`;
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value === null ? fallback : value;
    } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function normalizeLink(row) {
    const source = row && typeof row === "object" ? row : {};
    return {
      id: text(source.id || source.local_id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
      post_id: text(source.post_id),
      task_id: text(source.task_id),
      campaign_id: text(source.campaign_id),
      member_id: text(source.member_id),
      activity_type: text(source.activity_type || "task_progress"),
      summary: text(source.summary),
      visibility: "team",
      payload: source.payload && typeof source.payload === "object" ? source.payload : {},
      created_by: text(source.created_by || source.created_by_auth_id || ""),
      created_at: source.created_at || nowIso(),
      updated_at: source.updated_at || source.created_at || nowIso(),
      synced: source.synced !== false && !text(source.id).startsWith("local_")
    };
  }

  function dedupeRows(rows) {
    const map = new Map();
    for (const raw of array(rows)) {
      const row = normalizeLink(raw);
      const key = row.id || `${row.post_id}:${row.task_id}:${row.activity_type}`;
      const existing = map.get(key);
      if (!existing || text(row.updated_at) >= text(existing.updated_at)) map.set(key, row);
    }
    return [...map.values()].sort((a, b) => text(b.created_at).localeCompare(text(a.created_at))).slice(0, MAX_LINKS);
  }

  function loadLocal() {
    links = dedupeRows(readJson(localKey(), []));
    return links;
  }

  function saveLocal() {
    writeJson(localKey(), links.slice(0, MAX_LINKS));
  }

  function preferences(memberId = currentMemberId()) {
    const stored = readJson(prefKey(memberId), {});
    return {
      showSummary: stored.showSummary !== false,
      autoApproved: stored.autoApproved === true,
      autoApprovedSince: stored.autoApprovedSince || "",
      autoSharedTaskIds: array(stored.autoSharedTaskIds).map(text).slice(-300)
    };
  }

  function savePreferences(memberId, value) {
    writeJson(prefKey(memberId), value);
  }

  function linksForPost(postId) {
    return links.filter((item) => sameId(item.post_id, postId));
  }

  function linksForTask(taskId) {
    return links.filter((item) => sameId(item.task_id, taskId));
  }

  function linksForMember(memberId) {
    return links.filter((item) => sameId(item.member_id, memberId));
  }

  function canManageTask(task) {
    return manager() || sameId(task?.assigned_to, currentMemberId());
  }

  function canLinkPost(post) {
    return manager() || sameId(post?.author_id, currentMemberId());
  }

  function canRemoveLink(link) {
    if (!link) return false;
    if (!link.synced) return true;
    return !!currentAuthId() && sameId(link.created_by, currentAuthId());
  }

  function extractId(data, fields = ["id", "post_id", "task_id"]) {
    const candidate = Array.isArray(data) ? data[0] : data;
    if (typeof candidate === "string" || typeof candidate === "number") return text(candidate);
    if (!candidate || typeof candidate !== "object") return "";
    for (const field of fields) if (candidate[field]) return text(candidate[field]);
    if (candidate.data) return extractId(candidate.data, fields);
    return "";
  }

  function mergeCloud(cloudRows) {
    const pending = links.filter((item) => !item.synced);
    links = dedupeRows([...array(cloudRows).map((item) => ({ ...item, synced: true })), ...pending]);
    saveLocal();
  }

  async function loadCloud() {
    const api = getApi();
    if (!api?.from) {
      mode = "local";
      lastError = "Supabase no está disponible en esta sesión.";
      return false;
    }
    try {
      const result = await api.from("work_activity_links").select("*").order("created_at", { ascending: false }).limit(MAX_LINKS);
      if (result?.error) throw result.error;
      mergeCloud(result?.data || []);
      mode = "cloud";
      lastError = "";
      subscribeRealtime();
      return true;
    } catch (error) {
      mode = "local";
      lastError = error?.message || text(error);
      return false;
    }
  }

  async function cloudCreate(link) {
    const client = getSb();
    if (!client?.rpc) throw new Error("Supabase no está disponible.");
    const result = await client.rpc("ibm_v177_create_work_activity_link", {
      p_post_id: link.post_id || null,
      p_task_id: link.task_id || null,
      p_campaign_id: link.campaign_id || null,
      p_member_id: link.member_id || null,
      p_activity_type: link.activity_type || "task_progress",
      p_summary: link.summary || "",
      p_payload: link.payload || {}
    });
    if (result?.error) throw result.error;
    return normalizeLink({ ...(Array.isArray(result?.data) ? result.data[0] : result?.data), synced: true });
  }

  async function syncPending() {
    if (syncing || mode !== "cloud") return;
    syncing = true;
    try {
      const pending = links.filter((item) => !item.synced && item.post_id);
      for (const item of pending) {
        try {
          const cloud = await cloudCreate(item);
          links = links.filter((row) => row.id !== item.id);
          links.unshift(cloud);
        } catch (error) {
          lastError = error?.message || text(error);
          break;
        }
      }
      links = dedupeRows(links);
      saveLocal();
    } finally {
      syncing = false;
    }
  }

  async function createLink(input) {
    const local = normalizeLink({
      ...input,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      created_by: currentAuthId(),
      created_at: nowIso(),
      updated_at: nowIso(),
      synced: false
    });
    links = dedupeRows([local, ...links]);
    saveLocal();
    if (mode === "cloud") {
      try {
        const cloud = await cloudCreate(local);
        links = dedupeRows([cloud, ...links.filter((item) => item.id !== local.id)]);
        saveLocal();
        return cloud;
      } catch (error) {
        lastError = error?.message || text(error);
      }
    }
    return local;
  }

  async function removeLink(id) {
    const link = links.find((item) => sameId(item.id, id));
    if (!link) return;
    if (!canRemoveLink(link)) throw new Error("Solo quien creó el vínculo puede retirarlo.");
    if (link.synced && mode === "cloud") {
      const client = getSb();
      const result = await client.rpc("ibm_v177_remove_work_activity_link", { p_link_id: link.id });
      if (result?.error) throw result.error;
    }
    links = links.filter((item) => !sameId(item.id, id));
    saveLocal();
    refreshVisibleViews();
  }

  function subscribeRealtime() {
    const client = getSb();
    if (!client?.channel || realtimeChannel) return;
    try {
      realtimeChannel = client.channel(`v177-wall-work-${currentAuthId() || currentMemberId()}`)
        .on("postgres_changes", { event: "*", schema: "marketing_app", table: "work_activity_links" }, async () => {
          realtimeStatus = "event";
          await loadCloud();
          refreshVisibleViews();
        })
        .subscribe((status) => { realtimeStatus = text(status).toLowerCase(); });
    } catch (error) {
      realtimeStatus = "unavailable";
      lastError = error?.message || text(error);
    }
  }

  function activeTasksFor(memberId) {
    return array(appState().tasks).filter((task) => sameId(task?.assigned_to, memberId) && lifecycleState("task", task?.id) === "active" && !isDone(task));
  }

  function completedThisWeek(memberId) {
    const start = startOfWeekKey();
    return array(appState().tasks).filter((task) => {
      if (!sameId(task?.assigned_to, memberId) || !isDone(task)) return false;
      const completed = text(task?.completed_at || task?.approved_at || task?.published_at || task?.updated_at).slice(0, 10);
      return completed && completed >= start;
    });
  }

  function currentFocus(memberId) {
    const active = activeTasksFor(memberId);
    return active.sort((a, b) => {
      const aStatus = /proceso|revision|correg/.test(statusKey(a.status)) ? 0 : 1;
      const bStatus = /proceso|revision|correg/.test(statusKey(b.status)) ? 0 : 1;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return text(a.due_date || "9999-12-31").localeCompare(text(b.due_date || "9999-12-31"));
    })[0] || null;
  }

  function nextDue(memberId) {
    return activeTasksFor(memberId).filter((task) => task?.due_date).sort((a, b) => text(a.due_date).localeCompare(text(b.due_date)))[0] || null;
  }

  function workload(memberId) {
    const active = activeTasksFor(memberId);
    const estimated = active.reduce((sum, task) => sum + Math.max(0, number(taskMeta(task.id)?.estimateHours)), 0);
    const percent = estimated ? Math.round(estimated / 40 * 100) : null;
    const label = percent === null ? "Sin estimaciones" : percent < 65 ? "Disponible" : percent <= 90 ? "Carga saludable" : percent <= 110 ? "Cerca del límite" : "Sobrecargado";
    return { estimated, percent, label };
  }

  function campaignsFor(memberId) {
    const ids = new Set(activeTasksFor(memberId).map((task) => text(task.campaign_id)).filter(Boolean));
    return [...ids].map(campaignById).filter(Boolean);
  }

  function activityTypeLabel(type) {
    return ({ task_progress: "Avance", task_evidence: "Evidencia", task_milestone: "Hito", task_approved: "Tarea aprobada", post_to_task: "Publicación convertida", post_linked: "Publicación vinculada" })[type] || "Actividad de trabajo";
  }

  function statusLabel(value) {
    const key = statusKey(value);
    return ({ pendiente: "Pendiente", asignada: "Asignada", en_proceso: "En ejecución", en_revision: "En revisión", observado: "Observada", corregido: "Corregida", aprobado: "Aprobada", publicado: "Publicada", completado: "Completada", finalizado: "Finalizada" })[key] || text(value || "Pendiente").replaceAll("_", " ");
  }

  function summaryMarkup(memberId, context) {
    const user = memberById(memberId);
    if (!user) return "";
    const prefs = preferences(memberId);
    if (!prefs.showSummary && sameId(memberId, currentMemberId())) return "";
    const active = activeTasksFor(memberId);
    const done = completedThisWeek(memberId);
    const focus = currentFocus(memberId);
    const due = nextDue(memberId);
    const campaigns = campaignsFor(memberId);
    const load = workload(memberId);
    const detailed = sameId(memberId, currentMemberId()) || manager();
    const milestones = linksForMember(memberId).filter((item) => ["task_milestone", "task_approved", "task_evidence"].includes(item.activity_type)).slice(0, 3);
    const metrics = [
      ["Tareas activas", active.length],
      ["Completadas esta semana", done.length],
      ["Campañas activas", campaigns.length],
      detailed ? ["Carga estimada", load.percent === null ? "N/D" : `${load.percent}%`] : ["Próxima entrega", due ? formatDate(due.due_date) : "Sin fecha"]
    ];
    return `<section class="v177-work-summary" data-v177-summary="${esc(memberId)}" data-context="${esc(context)}">
      <div class="v177-summary-head"><div><span>TRABAJO 360</span><h3>Actividad laboral conectada</h3><p>Resumen operativo vinculado con tareas y avances del muro.</p></div><div class="v177-summary-actions">${sameId(memberId, currentMemberId()) ? `<button type="button" class="ghost" data-v177-preferences="1">Preferencias</button>` : ""}<button type="button" class="primary" data-v177-open-work="1">Abrir Trabajo 360</button></div></div>
      <div class="v177-summary-metrics">${metrics.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div>
      <div class="v177-summary-grid">
        <article class="v177-focus-card"><span>FOCO ACTUAL</span>${focus ? `<button type="button" data-v177-open-task="${esc(focus.id)}"><strong>${esc(focus.title || "Tarea")}</strong><small>${esc(campaignName(focus.campaign_id))} · ${esc(statusLabel(focus.status))}</small><em>${focus.due_date ? `Entrega ${esc(formatDate(focus.due_date))}` : "Sin fecha de entrega"}</em></button>` : `<div class="v177-empty">Sin tareas activas.</div>`}</article>
        <article class="v177-focus-card"><span>${detailed ? "CAPACIDAD" : "PROYECTOS ACTIVOS"}</span>${detailed ? `<div class="v177-load"><strong>${esc(load.label)}</strong><small>${load.estimated ? `${load.estimated.toFixed(1)} h estimadas en tareas abiertas` : "Registra estimaciones para calcular la carga"}</small><i><b style="width:${Math.min(100, load.percent || 0)}%"></b></i></div>` : `<div class="v177-campaign-chips">${campaigns.slice(0, 4).map((campaign) => `<button type="button" data-v177-open-campaign="${esc(campaign.id)}">${esc(campaign.name)}</button>`).join("") || `<div class="v177-empty">Sin campañas activas.</div>`}</div>`}</article>
      </div>
      ${milestones.length ? `<div class="v177-milestones"><span>HITOS RECIENTES</span>${milestones.map((item) => { const task = taskById(item.task_id); return `<button type="button" data-v177-open-task="${esc(item.task_id)}"><b>${esc(activityTypeLabel(item.activity_type))}</b><strong>${esc(task?.title || item.summary || "Actividad")}</strong><small>${esc(item.summary || campaignName(item.campaign_id))}</small></button>`; }).join("")}</div>` : ""}
      <div class="v177-privacy-note">El muro comparte avances y logros útiles. Los tiempos detallados, retrasos y alertas personales permanecen en las vistas privadas de gestión.</div>
    </section>`;
  }

  function injectSummary(memberId, context) {
    const mountId = context === "wall" ? "wallProfile360" : "memberProfileCard360";
    const mount = document.getElementById(mountId);
    if (!mount) return;
    const old = document.querySelector(`[data-v177-summary][data-context="${context}"]`);
    if (old) old.remove();
    const markup = summaryMarkup(memberId, context);
    if (!markup) return;
    mount.insertAdjacentHTML("afterend", markup);
  }

  function relationCard(link) {
    const task = taskById(link.task_id);
    const campaign = campaignById(link.campaign_id || task?.campaign_id);
    const progress = number(link.payload?.progress);
    const nextStep = text(link.payload?.next_step);
    return `<div class="v177-linked-card" data-v177-link-id="${esc(link.id)}"><div class="v177-linked-icon">W360</div><div class="v177-linked-copy"><span>${esc(activityTypeLabel(link.activity_type))}</span><strong>${esc(task?.title || link.summary || "Tarea vinculada")}</strong><small>${esc(campaign?.name || "Sin campaña")} · ${esc(statusLabel(link.payload?.status || task?.status))}${progress ? ` · ${progress}%` : ""}</small>${nextStep ? `<p>Próximo paso: ${esc(nextStep)}</p>` : ""}</div><div class="v177-linked-actions"><button type="button" data-v177-open-task="${esc(link.task_id)}">Abrir tarea</button>${canRemoveLink(link) ? `<button type="button" class="danger" data-v177-unlink="${esc(link.id)}">Desvincular</button>` : ""}</div></div>`;
  }

  function appendPostEnhancements(html, post) {
    if (!html || !post?.id) return html;
    const related = linksForPost(post.id);
    const cards = related.slice(0, 3).map(relationCard).join("");
    const actions = canLinkPost(post) ? `<div class="v177-post-work-actions"><span>Trabajo 360</span><button type="button" data-v177-link-post="${esc(post.id)}">Vincular a tarea</button>${manager() ? `<button type="button" data-v177-convert-post="${esc(post.id)}">Convertir en tarea</button>` : ""}</div>` : "";
    const block = `${cards ? `<div class="v177-linked-stack">${cards}</div>` : ""}${actions}`;
    return block ? html.replace(/<\/article>\s*$/, `${block}</article>`) : html;
  }

  function taskShareButton(taskId) {
    const task = taskById(taskId);
    if (!task || !canManageTask(task)) return "";
    const count = linksForTask(taskId).length;
    return `<section class="v177-task-share-panel"><div><span>MURO DEL MIEMBRO</span><strong>Comparte un avance sin duplicar la tarea</strong><small>${count ? `${count} vínculo${count === 1 ? "" : "s"} registrado${count === 1 ? "" : "s"}` : "Todavía no hay avances vinculados"}</small></div><button type="button" class="primary" data-v177-share-task="${esc(taskId)}">Compartir avance</button></section>`;
  }

  function decorateTaskModal(taskId) {
    const host = document.getElementById("premiumModalBody");
    const detail = host?.querySelector(".v66-task-detail,.v412-task-detail");
    if (!detail || detail.querySelector("[data-v177-share-task]")) return;
    const markup = taskShareButton(taskId);
    if (!markup) return;
    const dock = detail.querySelector(".v66-action-dock,.v413-detail-actions");
    if (dock) dock.insertAdjacentHTML("beforebegin", markup); else detail.insertAdjacentHTML("beforeend", markup);
  }

  function openTask(taskId) {
    if (!taskId) return;
    try { if (typeof v412OpenTask === "function") return v412OpenTask(taskId); } catch { /* fallback */ }
    try { navTo?.("tasks"); } catch { /* noop */ }
  }

  function openCampaign(campaignId) {
    if (!campaignId) return;
    try { if (typeof v413OpenCampaign === "function") return v413OpenCampaign(campaignId); } catch { /* fallback */ }
    try { navTo?.("campaigns"); } catch { /* noop */ }
  }

  async function reloadAppData() {
    try { if (typeof loadAll === "function") await loadAll(); } catch (error) { console.warn("[v17.7] loadAll", error); }
  }

  function inferNewestPost(authorId, exactText, beforeIds) {
    const excluded = new Set(array(beforeIds).map(text));
    return array(appState().posts)
      .filter((post) => sameId(post.author_id, authorId) && !excluded.has(text(post.id)) && (!exactText || text(post.text_content) === exactText))
      .sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)))[0] || null;
  }

  function inferNewestTask(title, assigneeId, beforeIds) {
    const excluded = new Set(array(beforeIds).map(text));
    return array(appState().tasks)
      .filter((task) => !excluded.has(text(task.id)) && text(task.title) === text(title) && (!assigneeId || sameId(task.assigned_to, assigneeId)))
      .sort((a, b) => text(b.created_at || b.updated_at).localeCompare(text(a.created_at || a.updated_at)))[0] || null;
  }

  function modalValue(id) {
    return text(document.getElementById(id)?.value).trim();
  }

  function modalChecked(id) {
    return !!document.getElementById(id)?.checked;
  }

  function taskOptions(tasks, selected = "") {
    return array(tasks).map((task) => `<option value="${esc(task.id)}" ${sameId(task.id, selected) ? "selected" : ""}>${esc(task.title || "Tarea")} · ${esc(memberName(task.assigned_to))} · ${esc(statusLabel(task.status))}</option>`).join("");
  }

  function memberOptions(selected = "") {
    return array(appState().members).filter((item) => item?.status !== "inactive").map((item) => `<option value="${esc(item.id)}" ${sameId(item.id, selected) ? "selected" : ""}>${esc(item.full_name || "Miembro")} · ${esc(item.position || item.role_code || "")}</option>`).join("");
  }

  function campaignOptions(selected = "") {
    return `<option value="">Sin campaña</option>${array(appState().campaigns).filter((item) => lifecycleState("campaign", item.id) === "active").map((item) => `<option value="${esc(item.id)}" ${sameId(item.id, selected) ? "selected" : ""}>${esc(item.name || "Campaña")}</option>`).join("")}`;
  }

  function areaOptions(selected = "") {
    return `<option value="">Sin área</option>${array(appState().areas).map((item) => `<option value="${esc(item.id)}" ${sameId(item.id, selected) ? "selected" : ""}>${esc(item.name || "Área")}</option>`).join("")}`;
  }

  async function shareTask(taskId, options = {}) {
    const task = taskById(taskId);
    if (!task || !canManageTask(task)) throw new Error("No tienes permiso para compartir esta tarea.");
    const summary = text(options.summary).trim();
    if (!summary) throw new Error("Escribe qué avance deseas compartir.");
    const progress = Math.max(0, Math.min(100, number(options.progress)));
    const nextStep = text(options.nextStep).trim();
    const evidence = options.includeEvidence && task.evidence_url ? `\nEvidencia: ${task.evidence_url}` : "";
    const postText = [`Avance de Trabajo 360`, summary, `Tarea: ${task.title || "Tarea"}`, `Estado: ${statusLabel(task.status)}`, progress ? `Avance: ${progress}%` : "", nextStep ? `Próximo paso: ${nextStep}` : "", evidence].filter(Boolean).join("\n");
    const before = array(appState().posts).map((post) => post.id);
    const client = getSb();
    if (!client?.rpc) throw new Error("Supabase no está disponible.");
    const result = await client.rpc("ibm_v30_create_wall_post_inline", { p_text_content: postText, p_image_data_url: "" });
    if (result?.error) throw result.error;
    let postId = extractId(result?.data, ["id", "post_id"]);
    await reloadAppData();
    if (!postId) postId = text(inferNewestPost(currentMemberId(), postText, before)?.id);
    if (!postId) throw new Error("La publicación fue creada, pero no se pudo identificar para vincularla. Recarga y vincúlala manualmente.");
    await createLink({
      post_id: postId,
      task_id: task.id,
      campaign_id: task.campaign_id || "",
      member_id: task.assigned_to || currentMemberId(),
      activity_type: options.activityType || (task.evidence_url && options.includeEvidence ? "task_evidence" : "task_progress"),
      summary,
      payload: { status: task.status || "", progress, next_step: nextStep, evidence_included: !!(task.evidence_url && options.includeEvidence) }
    });
    refreshVisibleViews();
    return postId;
  }

  function openShareTask(taskId) {
    const task = taskById(taskId);
    if (!task || !canManageTask(task)) return notify("Acceso restringido", "Solo el responsable o su jefatura puede compartir este avance.", "warning");
    const defaultProgress = number(task.quality_score ?? task.quality ?? 0);
    const body = `<div class="v177-form-grid"><div class="v177-form-preview"><span>TAREA</span><strong>${esc(task.title || "Tarea")}</strong><small>${esc(campaignName(task.campaign_id))} · ${esc(statusLabel(task.status))}</small></div><label class="full">Avance que verá el equipo<textarea id="v177ShareSummary" maxlength="600" placeholder="Resume qué se realizó, qué resultado se obtuvo y qué debe conocer el equipo."></textarea></label><label>Avance aproximado<input id="v177ShareProgress" type="number" min="0" max="100" value="${defaultProgress || ""}" placeholder="0 a 100"></label><label>Tipo<select id="v177ShareType"><option value="task_progress">Avance de trabajo</option><option value="task_milestone">Hito alcanzado</option>${task.evidence_url ? `<option value="task_evidence">Evidencia disponible</option>` : ""}</select></label><label class="full">Próximo paso<textarea id="v177ShareNext" maxlength="300" placeholder="Qué sigue después de este avance"></textarea></label>${task.evidence_url ? `<label class="v177-check full"><input id="v177ShareEvidence" type="checkbox"> Incluir el enlace de evidencia registrado en la tarea.</label>` : ""}<div class="v177-form-note full">La publicación será visible en el muro interno. Los tiempos detallados y alertas personales no se compartirán.</div></div>`;
    if (typeof openPremiumModal !== "function") return;
    openPremiumModal({
      title: "Compartir avance en mi muro",
      subtitle: "Trabajo 360 y el muro quedarán vinculados.",
      body,
      actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Publicar avance", className: "primary", loadingLabel: "Publicando…", onClick: async () => {
          await shareTask(taskId, { summary: modalValue("v177ShareSummary"), progress: modalValue("v177ShareProgress"), nextStep: modalValue("v177ShareNext"), activityType: modalValue("v177ShareType"), includeEvidence: modalChecked("v177ShareEvidence") });
          notify("Avance compartido", "La publicación quedó conectada con la tarea.", "success");
          return true;
        } }
      ]
    });
  }

  async function linkPostToTask(postId, taskId, activityType = "post_linked", summary = "") {
    const post = postById(postId);
    const task = taskById(taskId);
    if (!post || !task) throw new Error("La publicación o la tarea ya no está disponible.");
    if (!canLinkPost(post)) throw new Error("No tienes permiso para vincular esta publicación.");
    const existing = links.some((item) => sameId(item.post_id, postId) && sameId(item.task_id, taskId));
    if (existing) throw new Error("Esta publicación ya está vinculada con la tarea seleccionada.");
    await createLink({
      post_id: postId,
      task_id: taskId,
      campaign_id: task.campaign_id || "",
      member_id: task.assigned_to || post.author_id || "",
      activity_type: activityType,
      summary: summary || text(post.text_content).slice(0, 240),
      payload: { status: task.status || "", linked_from_wall: true }
    });
    refreshVisibleViews();
  }

  function openLinkPost(postId) {
    const post = postById(postId);
    if (!post || !canLinkPost(post)) return notify("Acceso restringido", "No puedes vincular esta publicación.", "warning");
    const available = array(appState().tasks).filter((task) => lifecycleState("task", task.id) === "active" && (manager() || sameId(task.assigned_to, currentMemberId())));
    if (!available.length) return notify("Sin tareas disponibles", "No hay tareas visibles que puedan vincularse.", "warning");
    const body = `<div class="v177-form-grid"><div class="v177-form-preview full"><span>PUBLICACIÓN</span><strong>${esc(memberName(post.author_id))}</strong><small>${esc(text(post.text_content || "Publicación con imagen").slice(0, 240))}</small></div><label class="full">Tarea<select id="v177LinkTask">${taskOptions(available)}</select></label><label>Tipo de vínculo<select id="v177LinkType"><option value="post_linked">Publicación vinculada</option><option value="task_progress">Avance</option><option value="task_evidence">Evidencia</option><option value="task_milestone">Hito</option></select></label><label>Resumen<input id="v177LinkSummary" maxlength="240" value="${esc(text(post.text_content).slice(0, 180))}"></label><div class="v177-form-note full">La publicación original no será modificada. Solo se añadirá el acceso a la tarea.</div></div>`;
    openPremiumModal?.({
      title: "Vincular publicación a Trabajo 360",
      subtitle: "Conecta el avance con una tarea existente.", body,
      actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Vincular", className: "primary", loadingLabel: "Vinculando…", onClick: async () => {
          await linkPostToTask(postId, modalValue("v177LinkTask"), modalValue("v177LinkType"), modalValue("v177LinkSummary"));
          notify("Publicación vinculada", "Ya puede abrirse la tarea directamente desde el muro.", "success");
          return true;
        } }
      ]
    });
  }

  async function convertPostToTask(postId, form) {
    if (!manager()) throw new Error("Solo Dirección o Supervisión puede convertir publicaciones en tareas.");
    const post = postById(postId);
    if (!post) throw new Error("La publicación ya no está disponible.");
    const title = text(form.title).trim();
    if (!title) throw new Error("Escribe un título para la tarea.");
    if (!form.assignedTo) throw new Error("Selecciona un responsable.");
    const before = array(appState().tasks).map((task) => task.id);
    const client = getSb();
    const result = await client.rpc("ibm_v30_create_task", {
      p_title: title,
      p_description: text(form.description).trim(),
      p_assigned_to: form.assignedTo,
      p_client_id: null,
      p_area_id: form.areaId || null,
      p_campaign_id: form.campaignId || null,
      p_due_date: form.dueDate || null,
      p_due_time: form.dueTime || null,
      p_priority: form.priority || "media",
      p_impact: Math.max(1, Math.min(5, number(form.impact) || 3)),
      p_checklist: []
    });
    if (result?.error) throw result.error;
    let taskId = extractId(result?.data, ["id", "task_id"]);
    await reloadAppData();
    if (!taskId) taskId = text(inferNewestTask(title, form.assignedTo, before)?.id);
    if (!taskId) throw new Error("La tarea fue creada, pero no se pudo identificar para vincularla. Puedes vincularla manualmente desde el muro.");
    await linkPostToTask(postId, taskId, "post_to_task", text(post.text_content).slice(0, 240));
    return taskId;
  }

  function openConvertPost(postId) {
    const post = postById(postId);
    if (!post || !manager()) return notify("Acceso restringido", "La conversión a tarea requiere Dirección o Supervisión.", "warning");
    const author = memberById(post.author_id);
    const defaultTitle = text(post.text_content || "Seguimiento de publicación").split("\n")[0].slice(0, 100) || "Seguimiento de publicación";
    const body = `<div class="v177-form-grid"><div class="v177-form-preview full"><span>ORIGEN DEL MURO</span><strong>${esc(author?.full_name || "Miembro")}</strong><small>${esc(text(post.text_content || "Publicación con imagen").slice(0, 260))}</small></div><label class="full">Título de la tarea<input id="v177ConvertTitle" maxlength="160" value="${esc(defaultTitle)}"></label><label>Responsable<select id="v177ConvertAssignee">${memberOptions(post.author_id)}</select></label><label>Campaña<select id="v177ConvertCampaign">${campaignOptions("")}</select></label><label>Área<select id="v177ConvertArea">${areaOptions(author?.area_id || "")}</select></label><label>Prioridad<select id="v177ConvertPriority"><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="baja">Baja</option></select></label><label>Fecha de entrega<input id="v177ConvertDue" type="date" min="${esc(todayKey())}"></label><label>Hora<input id="v177ConvertTime" type="time"></label><label>Impacto<input id="v177ConvertImpact" type="number" min="1" max="5" value="3"></label><label class="full">Descripción<textarea id="v177ConvertDescription">Seguimiento generado desde el muro interno.\n\n${esc(text(post.text_content).slice(0, 800))}</textarea></label><div class="v177-form-note full">La publicación seguirá intacta y mostrará un acceso directo a la nueva tarea.</div></div>`;
    openPremiumModal?.({
      title: "Convertir publicación en tarea",
      subtitle: "Crea seguimiento sin copiar información manualmente.", body,
      actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Crear y vincular", className: "primary", loadingLabel: "Creando…", onClick: async () => {
          const taskId = await convertPostToTask(postId, { title: modalValue("v177ConvertTitle"), assignedTo: modalValue("v177ConvertAssignee"), campaignId: modalValue("v177ConvertCampaign"), areaId: modalValue("v177ConvertArea"), priority: modalValue("v177ConvertPriority"), dueDate: modalValue("v177ConvertDue"), dueTime: modalValue("v177ConvertTime"), impact: modalValue("v177ConvertImpact"), description: modalValue("v177ConvertDescription") });
          notify("Tarea creada", "La publicación quedó conectada con la nueva tarea.", "success");
          setTimeout(() => openTask(taskId), 60);
          return true;
        } }
      ]
    });
  }

  function openPreferences() {
    const id = currentMemberId();
    const prefs = preferences(id);
    const body = `<div class="v177-form-grid"><label class="v177-check full"><input id="v177PrefSummary" type="checkbox" ${prefs.showSummary ? "checked" : ""}> Mostrar el resumen de Trabajo 360 en mi muro.</label><label class="v177-check full"><input id="v177PrefAuto" type="checkbox" ${prefs.autoApproved ? "checked" : ""}> Compartir automáticamente nuevas tareas aprobadas como hitos.</label><div class="v177-form-note full"><strong>Control de privacidad:</strong> el modo automático está desactivado por defecto. Solo publicará tareas aprobadas después de activarlo, nunca retrasos, temporizadores, horas detalladas ni observaciones.</div></div>`;
    openPremiumModal?.({
      title: "Preferencias del muro laboral",
      subtitle: "Controla qué parte de Trabajo 360 aparece en tu espacio.", body,
      actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Guardar", className: "primary", onClick: async () => {
          const nextAuto = modalChecked("v177PrefAuto");
          const next = { ...prefs, showSummary: modalChecked("v177PrefSummary"), autoApproved: nextAuto, autoApprovedSince: nextAuto && !prefs.autoApproved ? nowIso() : prefs.autoApprovedSince };
          savePreferences(id, next);
          injectSummary(id, "wall");
          notify("Preferencias guardadas", "El muro laboral fue actualizado.", "success");
          setTimeout(() => autoShareApproved(), 100);
          return true;
        } }
      ]
    });
  }

  async function autoShareApproved() {
    const id = currentMemberId();
    const prefs = preferences(id);
    if (!prefs.autoApproved || !prefs.autoApprovedSince) return;
    const shared = new Set(prefs.autoSharedTaskIds);
    const candidates = array(appState().tasks)
      .filter((task) => sameId(task.assigned_to, id) && isDone(task) && text(task.updated_at || task.completed_at || "") >= text(prefs.autoApprovedSince) && !shared.has(text(task.id)) && !linksForTask(task.id).some((link) => link.activity_type === "task_approved"))
      .sort((a, b) => text(a.updated_at || a.completed_at).localeCompare(text(b.updated_at || b.completed_at)));
    const task = candidates[0];
    if (!task) return;
    try {
      await shareTask(task.id, { summary: `Completé ${task.title || "una tarea"} y quedó aprobada.`, progress: 100, nextStep: "", activityType: "task_approved", includeEvidence: false });
      const next = preferences(id);
      next.autoSharedTaskIds = [...new Set([...next.autoSharedTaskIds, text(task.id)])].slice(-300);
      savePreferences(id, next);
      notify("Hito compartido", "La tarea aprobada apareció en tu muro.", "success");
    } catch (error) {
      console.warn("[v17.7] auto share", error);
    }
  }

  function refreshVisibleViews() {
    try {
      const active = document.querySelector(".section.active")?.id;
      if (active === "wall" && typeof renderWall === "function") setTimeout(() => renderWall(), 0);
      else if (active === "memberProfile" && typeof renderMemberProfile === "function") setTimeout(() => renderMemberProfile(), 0);
      else if (active === "tasks" && typeof renderTasks === "function") setTimeout(() => renderTasks(), 0);
    } catch { /* noop */ }
  }

  function wrapFunctions() {
    if (wrappersInstalled) return;
    wrappersInstalled = true;

    if (typeof window.renderSocialPost === "function" && !window.renderSocialPost.__v177Wrapped) {
      const base = window.renderSocialPost;
      const wrapped = function (post) { return appendPostEnhancements(base.apply(this, arguments), post); };
      wrapped.__v177Wrapped = true;
      wrapped.__v177Base = base;
      window.renderSocialPost = wrapped;
    }

    if (typeof window.renderWall === "function" && !window.renderWall.__v177Wrapped) {
      const base = window.renderWall;
      const wrapped = async function () {
        if (mode === "starting") await loadCloud();
        const result = await base.apply(this, arguments);
        injectSummary(currentMemberId(), "wall");
        setTimeout(() => autoShareApproved(), 150);
        return result;
      };
      wrapped.__v177Wrapped = true;
      wrapped.__v177Base = base;
      window.renderWall = wrapped;
    }

    if (typeof window.openMemberProfile === "function" && !window.openMemberProfile.__v177Wrapped) {
      const base = window.openMemberProfile;
      const wrapped = function (memberId) { selectedMemberId = text(memberId); return base.apply(this, arguments); };
      wrapped.__v177Wrapped = true;
      wrapped.__v177Base = base;
      window.openMemberProfile = wrapped;
    }

    if (typeof window.renderMemberProfile === "function" && !window.renderMemberProfile.__v177Wrapped) {
      const base = window.renderMemberProfile;
      const wrapped = function () {
        const result = base.apply(this, arguments);
        const id = selectedMemberId || currentMemberId();
        injectSummary(id, "memberProfile");
        return result;
      };
      wrapped.__v177Wrapped = true;
      wrapped.__v177Base = base;
      window.renderMemberProfile = wrapped;
    }

    if (typeof window.v412OpenTask === "function" && !window.v412OpenTask.__v177Wrapped) {
      const base = window.v412OpenTask;
      const wrapped = function (taskId) {
        const result = base.apply(this, arguments);
        setTimeout(() => decorateTaskModal(taskId), 0);
        return result;
      };
      wrapped.__v177Wrapped = true;
      wrapped.__v177Base = base;
      window.v412OpenTask = wrapped;
    }
  }

  function handleClick(event) {
    const openTaskButton = event.target.closest("[data-v177-open-task]");
    if (openTaskButton) { event.preventDefault(); event.stopPropagation(); return openTask(openTaskButton.dataset.v177OpenTask); }
    const openCampaignButton = event.target.closest("[data-v177-open-campaign]");
    if (openCampaignButton) { event.preventDefault(); event.stopPropagation(); return openCampaign(openCampaignButton.dataset.v177OpenCampaign); }
    if (event.target.closest("[data-v177-open-work]")) { event.preventDefault(); try { navTo?.("workIntel"); } catch { navTo?.("tasks"); } return; }
    if (event.target.closest("[data-v177-preferences]")) { event.preventDefault(); return openPreferences(); }
    const share = event.target.closest("[data-v177-share-task]");
    if (share) { event.preventDefault(); event.stopPropagation(); return openShareTask(share.dataset.v177ShareTask); }
    const linkPost = event.target.closest("[data-v177-link-post]");
    if (linkPost) { event.preventDefault(); event.stopPropagation(); return openLinkPost(linkPost.dataset.v177LinkPost); }
    const convert = event.target.closest("[data-v177-convert-post]");
    if (convert) { event.preventDefault(); event.stopPropagation(); return openConvertPost(convert.dataset.v177ConvertPost); }
    const unlink = event.target.closest("[data-v177-unlink]");
    if (unlink) {
      event.preventDefault(); event.stopPropagation();
      const link = links.find((item) => sameId(item.id, unlink.dataset.v177Unlink));
      const execute = async () => { try { await removeLink(unlink.dataset.v177Unlink); notify("Vínculo retirado", "La publicación permanece en el muro sin acceso a la tarea.", "success"); } catch (error) { notify("No se pudo desvincular", error?.message || text(error), "error"); } };
      if (typeof openPremiumModal === "function") openPremiumModal({ title: "Desvincular publicación", subtitle: link?.summary || "Trabajo 360", body: `<div class="v177-confirm"><strong>La publicación y la tarea no serán eliminadas.</strong><p>Solo se retirará el acceso directo entre ambas.</p></div>`, actions: [{ label: "Cancelar", value: null, className: "ghost" }, { label: "Desvincular", className: "danger", onClick: async () => { await execute(); return true; } }] });
      else execute();
    }
  }

  function health() {
    const pending = links.filter((item) => !item.synced).length;
    return {
      version: VERSION,
      mode,
      links_visible: links.length,
      pending,
      realtime: realtimeStatus,
      status: mode === "cloud" && !pending ? "ok" : "info",
      value: mode === "cloud" ? "Muro y Trabajo 360 sincronizados" : "Fallback local disponible",
      detail: mode === "cloud" ? `${links.length} vínculo${links.length === 1 ? "" : "s"} disponible${links.length === 1 ? "" : "s"}.` : "El SQL opcional v17.7 habilita persistencia entre dispositivos; la ausencia no reduce la salud general.",
      last_error: lastError
    };
  }

  function registerBuild() {
    try { window.INBESTIGA_QUALITY_CORE?.register?.("member-wall-work-sync", { version: VERSION, mode: "productive-optional-sync" }); } catch { /* optional */ }
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "member-wall-work-sync"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    loadLocal();
    wrapFunctions();
    document.addEventListener("click", handleClick);
    window.addEventListener("online", async () => { if (await loadCloud()) await syncPending(); refreshVisibleViews(); });
    registerBuild();
    await loadCloud();
    await syncPending();
    refreshVisibleViews();
  }

  window.INBESTIGA_MEMBER_WALL_WORK_SYNC = {
    version: VERSION,
    build: BUILD,
    init,
    health,
    mode: () => mode,
    links: () => links.slice(),
    reload: async () => { await loadCloud(); await syncPending(); refreshVisibleViews(); return links.slice(); },
    shareTask: openShareTask,
    linkPost: openLinkPost,
    convertPost: openConvertPost,
    preferences: openPreferences
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
