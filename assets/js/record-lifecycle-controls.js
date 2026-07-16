/* ===== v17.5.1 RECORD LIFECYCLE CONTROLS · DATABASE COMPATIBILITY HOTFIX ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_RECORD_LIFECYCLE) return;

  const VERSION = "v17.5.1";
  const BUILD = "DATABASE COMPATIBILITY HOTFIX";
  const LOCAL_PREFIX = "inbestiga:v175:lifecycle:";
  const FILTERS = Object.create(null);
  const records = new Map();
  let mode = "starting";
  let lastError = "";
  let initialized = false;
  let syncTimer = null;

  const htmlEsc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const array = (value) => Array.isArray(value) ? value : [];
  const sameId = (a, b) => String(a ?? "") === String(b ?? "");
  const getState = () => (typeof state !== "undefined" && state) ? state : (window.state || {});
  const getMember = () => (typeof member !== "undefined" && member) ? member : (window.member || null);
  const getAuthUser = () => (typeof authUser !== "undefined" && authUser) ? authUser : (window.authUser || null);
  const getSession = () => (typeof session !== "undefined" && session) ? session : (window.session || null);
  const getSb = () => (typeof sb !== "undefined" && sb) ? sb : (window.sb || null);
  const getApi = () => getSb()?.schema?.("marketing_app") || getSb();
  const currentMemberId = () => String(getMember()?.id || "guest");
  const currentAuthId = () => String(getAuthUser()?.id || getSession()?.user?.id || "");
  const keyOf = (entity, id) => `${entity}:${String(id ?? "")}`;
  const nowIso = () => new Date().toISOString();

  const ENTITY = {
    campaign: {
      stateKey: "campaigns", table: "campaigns", module: "campaigns", label: "Proyecto", plural: "Proyectos", section: "campaigns", renderer: "renderCampaigns", editable: true,
      fields(record) { return [
        text("name", "Nombre", record.name, true),
        select("client_id", "Cliente", record.client_id, entityOptions("clients", "name", "Sin cliente"), true),
        select("area_id", "Área", record.area_id, entityOptions("areas", "name", "Sin área"), true),
        select("status", "Estado", record.status || "planificacion", simpleOptions(["brief", "planificacion", "produccion", "revision", "activa", "finalizada"])),
        date("start_date", "Inicio", record.start_date, true), date("end_date", "Fin", record.end_date, true),
        textarea("objective", "Objetivo", record.objective, true), textarea("audience", "Público", record.audience, true),
        textarea("main_message", "Mensaje principal", record.main_message, true)
      ]; }
    },
    task: {
      stateKey: "tasks", table: "tasks", module: "tasks", label: "Tarea", plural: "Tareas", section: "tasks", renderer: "renderTasks", editable: true,
      fields(record) { return [
        text("title", "Título", record.title, true),
        select("assigned_to", "Responsable", record.assigned_to, memberOptions("Sin responsable"), true),
        select("client_id", "Cliente", record.client_id, entityOptions("clients", "name", "Sin cliente"), true),
        select("area_id", "Área", record.area_id, entityOptions("areas", "name", "Sin área"), true),
        select("campaign_id", "Campaña", record.campaign_id, entityOptions("campaigns", "name", "Sin campaña"), true),
        select("priority", "Prioridad", record.priority || "media", simpleOptions(["baja", "media", "alta", "urgente"])),
        date("due_date", "Fecha", record.due_date, true), time("due_time", "Hora", record.due_time, true),
        number("impact", "Impacto", record.impact ?? 3, 1, 5, true),
        textarea("description", "Descripción", record.description, true),
        textarea("checklist", "Checklist · un punto por línea", checklistText(record.checklist), true, "json-lines")
      ]; }
    },
    brief: {
      stateKey: "briefs", table: "briefs", module: "campaigns", label: "Brief", plural: "Briefs", section: "campaigns", editable: true,
      fields(record) { return [
        select("campaign_id", "Campaña", record.campaign_id, entityOptions("campaigns", "name", "Sin campaña"), true),
        text("title", "Título", record.title, true), textarea("objective", "Objetivo", record.objective, true),
        textarea("audience", "Público", record.audience, true), text("formats", "Formatos", record.formats, false, true),
        text("deliverables", "Entregables", record.deliverables, false, true), textarea("references_text", "Referencias", record.references_text, true),
        textarea("brand_rules", "Reglas de marca", record.brand_rules, true)
      ]; }
    },
    editorial: {
      stateKey: "editorial", table: "editorial_items", module: "editorial", label: "Publicación", plural: "Publicaciones", section: "editorial", renderer: "renderEditorial", editable: true,
      fields(record) { return [
        text("title", "Título", record.title, true), select("client_id", "Cliente", record.client_id, entityOptions("clients", "name", "Sin cliente"), true),
        select("campaign_id", "Campaña", record.campaign_id, entityOptions("campaigns", "name", "Sin campaña"), true),
        select("owner_id", "Responsable", record.owner_id, memberOptions("Sin responsable"), true),
        select("platform", "Plataforma", record.platform, simpleOptions(["Instagram", "TikTok", "Facebook", "LinkedIn", "YouTube", "Meta Ads", "WhatsApp"])),
        select("format", "Formato", record.format, simpleOptions(["Reel", "Post", "Story", "Video", "Carousel", "Anuncio"])),
        date("publish_date", "Fecha", record.publish_date, true), time("publish_time", "Hora", record.publish_time, true),
        select("status", "Estado", record.status || "idea", simpleOptions(["idea", "produccion", "revision", "programado", "publicado", "medido"])),
        text("asset_url", "Link arte / video", record.asset_url, false, true), textarea("copy_text", "Copy", record.copy_text, true)
      ]; }
    },
    asset: {
      stateKey: "assets", table: "assets", module: "assets", label: "Archivo", plural: "Archivos", section: "assets", renderer: "renderAssets", editable: true,
      fields(record) { return [
        text("name", "Nombre", record.name, true), select("client_id", "Cliente", record.client_id, entityOptions("clients", "name", "Sin cliente"), true),
        select("campaign_id", "Campaña", record.campaign_id, entityOptions("campaigns", "name", "Sin campaña"), true),
        select("related_task_id", "Tarea relacionada", record.related_task_id, entityOptions("tasks", "title", "Sin tarea"), true),
        text("file_type", "Tipo", record.file_type, false, true), textarea("notes", "Notas", record.notes, true)
      ]; }
    },
    template: {
      stateKey: "templates", table: "templates", module: "templates", label: "Plantilla", plural: "Plantillas", section: "templates", renderer: "renderTemplates", editable: true,
      fields(record) { return [
        text("name", "Nombre", record.name, true), select("type", "Tipo", record.type, simpleOptions(["tarea", "brief", "campaña", "checklist", "reporte"])),
        textarea("description", "Descripción", record.description, true), textarea("items", "Puntos · uno por línea", templateItems(record), true, "template-items")
      ]; }
    },
    incident: {
      stateKey: "incidents", table: "incidents", module: "incidents", label: "Incidencia", plural: "Incidencias", section: "incidents", renderer: "renderIncidents", editable: true,
      fields(record) { const fields = [
        text("title", "Título", record.title, true), select("severity", "Severidad", record.severity || "media", simpleOptions(["baja", "media", "alta", "crítica"])),
        select("client_id", "Cliente", record.client_id, entityOptions("clients", "name", "Sin cliente"), true),
        select("campaign_id", "Campaña", record.campaign_id, entityOptions("campaigns", "name", "Sin campaña"), true),
        select("assigned_to", "Asignar a", record.assigned_to, memberOptions("Sin responsable"), true), textarea("description", "Descripción", record.description, true)
      ]; if (Object.prototype.hasOwnProperty.call(record, "status")) fields.splice(2, 0, select("status", "Estado", record.status || "abierta", simpleOptions(["abierta", "en_proceso", "resuelta", "cerrada"]))); return fields; }
    },
    report: {
      stateKey: "report_snapshots", table: "report_snapshots", module: "reports", label: "Snapshot", plural: "Snapshots", section: "reports", renderer: "v416RenderReports", editable: false
    }
  };

  function text(name, label, value, required = false, wide = false) { return { name, label, value: value ?? "", type: "text", required, wide }; }
  function textarea(name, label, value, wide = true, transform = "") { return { name, label, value: value ?? "", type: "textarea", wide, transform }; }
  function select(name, label, value, options, nullable = false) { return { name, label, value: value ?? "", type: "select", options, nullable }; }
  function date(name, label, value, nullable = false) { return { name, label, value: String(value || "").slice(0, 10), type: "date", nullable }; }
  function time(name, label, value, nullable = false) { return { name, label, value: String(value || "").slice(0, 5), type: "time", nullable }; }
  function number(name, label, value, min, max, nullable = false) { return { name, label, value: value ?? "", type: "number", min, max, nullable }; }
  function simpleOptions(values) { return values.map((value) => ({ value, label: String(value).replaceAll("_", " ") })); }
  function entityOptions(stateKey, labelKey, placeholder) {
    const entity = stateKeyToEntity(stateKey);
    return [{ value: "", label: placeholder }, ...array(getState()?.[stateKey])
      .filter((item) => stateFor(entity, item.id) !== "trashed")
      .map((item) => {
        const lifecycleState = stateFor(entity, item.id);
        const baseLabel = item[labelKey] || item.name || item.title || "Registro";
        return { value: item.id, label: lifecycleState === "archived" ? `${baseLabel} · archivado` : baseLabel, disabled: lifecycleState !== "active" };
      })];
  }
  function memberOptions(placeholder) { return [{ value: "", label: placeholder }, ...array(getState()?.members).filter((item) => item.status !== "inactive").map((item) => ({ value: item.id, label: item.full_name || item.email || "Miembro" }))]; }
  function stateKeyToEntity(key) { return Object.keys(ENTITY).find((name) => ENTITY[name].stateKey === key) || key; }
  function checklistText(value) {
    let parsed = value;
    if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return parsed; } }
    return array(parsed).map((item) => typeof item === "string" ? item : item?.title || item?.text || "").filter(Boolean).join("\n");
  }
  function templateItems(record) { return array(record?.content?.items || record?.items).map(String).join("\n"); }

  function localKey() { return `${LOCAL_PREFIX}${currentMemberId()}`; }
  function readLocal() {
    try { const data = JSON.parse(localStorage.getItem(localKey()) || "{}"); return data && typeof data === "object" ? data : {}; } catch { return {}; }
  }
  function writeLocal(data) { try { localStorage.setItem(localKey(), JSON.stringify(data)); } catch { /* sin almacenamiento */ } }
  function loadLocalRecords() {
    const local = readLocal();
    Object.entries(local.records || {}).forEach(([key, value]) => { if (value && typeof value === "object") records.set(key, { ...value, source: value.source || "local" }); });
  }
  function saveLocalRecord(entity, id, lifecycleState, reason = "", pending = true) {
    const local = readLocal(); local.records = local.records || {};
    const entry = { entity_type: entity, entity_id: String(id), lifecycle_state: lifecycleState, reason, updated_at: nowIso(), updated_by: currentAuthId() || null, pending, source: "local" };
    local.records[keyOf(entity, id)] = entry; writeLocal(local); records.set(keyOf(entity, id), entry); return entry;
  }
  function clearLocalPending(entity, id, cloudEntry) {
    const local = readLocal(); local.records = local.records || {};
    if (local.records[keyOf(entity, id)]) local.records[keyOf(entity, id)] = { ...cloudEntry, pending: false, source: "cloud" };
    writeLocal(local); records.set(keyOf(entity, id), { ...cloudEntry, pending: false, source: "cloud" });
  }
  function pendingCount() { return [...records.values()].filter((item) => item?.pending).length; }
  function stateFor(entity, id) { return records.get(keyOf(entity, id))?.lifecycle_state || "active"; }
  function filterFor(entity) { return FILTERS[entity] || "active"; }
  function rawRecords(entity) { const def = ENTITY[entity]; return def ? array(getState()?.[def.stateKey]) : []; }
  function recordsFor(entity, filter = filterFor(entity)) { return rawRecords(entity).filter((item) => stateFor(entity, item.id) === filter); }

  function canEdit(entity, record) {
    if (!ENTITY[entity]?.editable || !record) return false;
    try { if (typeof window.isDirector === "function" && window.isDirector()) return true; } catch { /* continúa */ }
    try { if (!(typeof window.isSupervisor === "function" && window.isSupervisor())) return false; } catch { return false; }
    if (entity === "template") return false;
    const actor = getMember() || {}, actorId = actor.id, areaId = actor.area_id;
    const sameArea = (value) => !!areaId && sameId(value, areaId);
    const linkedCampaign = record.campaign_id ? findRecord("campaign", record.campaign_id) : null;
    const campaignInScope = !!linkedCampaign && sameArea(linkedCampaign.area_id);
    if (entity === "campaign") return sameArea(record.area_id);
    if (entity === "task") return sameId(record.assigned_to, actorId) || sameArea(record.area_id) || campaignInScope;
    if (entity === "brief") return campaignInScope;
    if (entity === "editorial") return sameId(record.owner_id, actorId) || campaignInScope;
    if (entity === "asset") {
      const linkedTask = record.related_task_id ? findRecord("task", record.related_task_id) : null;
      return campaignInScope || sameId(linkedTask?.assigned_to, actorId) || sameArea(linkedTask?.area_id);
    }
    if (entity === "incident") return sameId(record.assigned_to, actorId) || campaignInScope;
    return false;
  }
  function canLifecycle() {
    try { return typeof window.isDirector === "function" && window.isDirector(); } catch { return false; }
  }

  function modeLabel() {
    if (mode === "cloud") return pendingCount() ? `${pendingCount()} cambio${pendingCount() === 1 ? "" : "s"} pendiente${pendingCount() === 1 ? "" : "s"}` : "Sincronización activa";
    if (mode === "local") return "Fallback local";
    return "Comprobando sincronización";
  }
  function modeState() { return pendingCount() ? "pending" : mode === "cloud" ? "cloud" : "local"; }

  function lifecycleCounts(entity) {
    const list = rawRecords(entity); return {
      active: list.filter((item) => stateFor(entity, item.id) === "active").length,
      archived: list.filter((item) => stateFor(entity, item.id) === "archived").length,
      trashed: list.filter((item) => stateFor(entity, item.id) === "trashed").length
    };
  }

  function toolbarHtml(entity) {
    const count = lifecycleCounts(entity), active = filterFor(entity);
    return `<div class="v175-lifecycle-tabs">
      ${[["active", "Activos"], ["archived", "Archivados"], ["trashed", "Papelera"]].map(([key, label]) => `<button type="button" data-v175-filter="${key}" data-v175-entity="${entity}" class="${active === key ? "active" : ""}">${label}<b>${count[key]}</b></button>`).join("")}
    </div><div class="v175-lifecycle-mode" data-mode="${modeState()}" title="${htmlEsc(lastError)}"><i></i><span>${htmlEsc(modeLabel())}</span></div>`;
  }

  function ensureToolbar(entity) {
    const def = ENTITY[entity], section = document.getElementById(def?.section || "");
    if (!def || !section || document.getElementById(`v175Toolbar_${entity}`)) return;
    const toolbar = document.createElement("div"); toolbar.id = `v175Toolbar_${entity}`; toolbar.className = "v175-lifecycle-toolbar";
    const first = section.firstElementChild; if (first) first.insertAdjacentElement("beforebegin", toolbar); else section.appendChild(toolbar);
  }
  function renderToolbar(entity) { ensureToolbar(entity); const host = document.getElementById(`v175Toolbar_${entity}`); if (host) host.innerHTML = toolbarHtml(entity); }
  function renderAllToolbars() { Object.keys(ENTITY).filter((entity) => ENTITY[entity].section && entity !== "brief").forEach(renderToolbar); renderAuditCoverage(); }

  function fieldId(entity, name) { return `v175_${entity}_${name}`; }
  function optionHtml(options, selected) { return array(options).map((option) => `<option value="${htmlEsc(option.value)}" ${sameId(option.value, selected) ? "selected" : ""} ${option.disabled ? "disabled" : ""}>${htmlEsc(option.label)}</option>`).join(""); }
  function fieldHtml(entity, field) {
    const id = fieldId(entity, field.name), cls = field.wide ? "wide" : "";
    if (field.type === "textarea") return `<label class="${cls}">${htmlEsc(field.label)}<textarea id="${id}" ${field.required ? "required" : ""}>${htmlEsc(field.value)}</textarea></label>`;
    if (field.type === "select") return `<label class="${cls}">${htmlEsc(field.label)}<select id="${id}">${optionHtml(field.options, field.value)}</select></label>`;
    const attrs = `${field.required ? " required" : ""}${field.min !== undefined ? ` min="${field.min}"` : ""}${field.max !== undefined ? ` max="${field.max}"` : ""}`;
    return `<label class="${cls}">${htmlEsc(field.label)}<input id="${id}" type="${field.type}" value="${htmlEsc(field.value)}"${attrs}></label>`;
  }

  function readPatch(entity, fields, record) {
    const patch = {};
    fields.forEach((field) => {
      const element = document.getElementById(fieldId(entity, field.name)); if (!element) return;
      let value = element.value;
      if (field.required && !String(value).trim()) throw new Error(`Completa ${field.label}.`);
      if (field.transform === "json-lines") value = String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean);
      else if (field.transform === "template-items") { const items = String(value).split("\n").map((item) => item.trim()).filter(Boolean); patch.content = { ...(record.content || {}), items }; return; }
      else if (field.type === "number") value = value === "" && field.nullable ? null : Number(value);
      else if (field.nullable && value === "") value = null;
      patch[field.name] = value;
    });
    return patch;
  }

  function isMissingRpc(error) { const message = String(error?.message || error || ""); return /PGRST202|could not find the function|function .* does not exist|404/i.test(message); }

  async function patchRecord(entity, id, patch) {
    const def = ENTITY[entity]; if (!def) throw new Error("Tipo de registro no compatible.");
    if (!canEdit(entity, findRecord(entity, id))) throw new Error("Tu rol no tiene permiso para editar este registro.");
    if (!getSb()) throw new Error("Supabase no está disponible.");
    const rpc = await getApi().rpc("ibm_v175_patch_record", { p_entity_type: entity, p_entity_id: String(id), p_patch: patch });
    if (!rpc.error) return rpc.data;
    if (!isMissingRpc(rpc.error)) throw rpc.error;
    throw new Error("La edición segura requiere instalar manualmente SQL_OPCIONAL_v17_5_1.sql. No se intentó una actualización directa sin auditoría.");
  }

  async function setRecordState(entity, id, lifecycleState, reason = "") {
    if (!canLifecycle()) throw new Error("Solo Dirección puede archivar, eliminar o restaurar registros.");
    if (!ENTITY[entity]) throw new Error("Tipo de registro no compatible.");
    if (!getSb()) { mode = "local"; return saveLocalRecord(entity, id, lifecycleState, reason, true); }
    const result = await getApi().rpc("ibm_v175_set_record_state", { p_entity_type: entity, p_entity_id: String(id), p_lifecycle_state: lifecycleState, p_reason: reason || null });
    if (!result.error) {
      mode = "cloud";
      const data = result.data && typeof result.data === "object" ? result.data : { entity_type: entity, entity_id: String(id), lifecycle_state: lifecycleState, reason, updated_at: nowIso(), updated_by: currentAuthId() };
      clearLocalPending(entity, id, data); return data;
    }
    if (!isMissingRpc(result.error)) throw result.error;
    mode = "local"; lastError = "SQL_OPCIONAL_v17_5_1.sql aún no está instalado; el cambio se conserva en este navegador.";
    return saveLocalRecord(entity, id, lifecycleState, reason, true);
  }

  async function syncLifecycle() {
    clearTimeout(syncTimer);
    loadLocalRecords();
    if (!getSb()?.schema || !currentAuthId()) { mode = "local"; renderAllToolbars(); return; }
    try {
      const result = await getSb().schema("marketing_app").from("record_lifecycle").select("entity_type,entity_id,lifecycle_state,reason,updated_at,updated_by");
      if (result.error) throw result.error;
      array(result.data).forEach((entry) => {
        const key = keyOf(entry.entity_type, entry.entity_id), local = records.get(key);
        if (!local?.pending || String(entry.updated_at || "") >= String(local.updated_at || "")) records.set(key, { ...entry, pending: false, source: "cloud" });
      });
      mode = "cloud"; lastError = "";
      await flushPending();
    } catch (error) {
      mode = "local"; lastError = String(error?.message || error || "Sin sincronización remota");
    }
    rerenderAllEntities(); renderAllToolbars();
  }

  async function flushPending() {
    if (mode !== "cloud" || !pendingCount()) return;
    for (const entry of [...records.values()].filter((item) => item?.pending)) {
      try {
        const result = await getApi().rpc("ibm_v175_set_record_state", { p_entity_type: entry.entity_type, p_entity_id: String(entry.entity_id), p_lifecycle_state: entry.lifecycle_state, p_reason: entry.reason || null });
        if (result.error) throw result.error; clearLocalPending(entry.entity_type, entry.entity_id, result.data || { ...entry, pending: false, source: "cloud" });
      } catch (error) { lastError = String(error?.message || error); break; }
    }
  }

  function findRecord(entity, id) { return rawRecords(entity).find((item) => sameId(item.id, id)); }
  function dependencySummary(entity, id) {
    if (entity === "campaign") return [
      ["Tareas", array(getState()?.tasks).filter((item) => sameId(item.campaign_id, id)).length],
      ["Briefs", array(getState()?.briefs).filter((item) => sameId(item.campaign_id, id)).length],
      ["Archivos", array(getState()?.assets).filter((item) => sameId(item.campaign_id, id)).length]
    ];
    if (entity === "task") return [["Archivos", array(getState()?.assets).filter((item) => sameId(item.related_task_id, id)).length], ["Historial", array(getState()?.approval_history).filter((item) => sameId(item.task_id, id)).length], ["Dependencias", "Conservadas"]];
    return [["Estado", stateFor(entity, id) === "active" ? "Activo" : stateFor(entity, id)], ["Acción", "Reversible"], ["Datos", "Conservados"]];
  }

  async function openEdit(entity, id) {
    const def = ENTITY[entity], record = findRecord(entity, id); if (!def || !record) return;
    if (!canEdit(entity, record)) { notify("Acceso restringido", "Solo Dirección o Supervisión puede editar datos estructurales.", "warning"); return; }
    const fields = def.fields ? def.fields(record) : [];
    const result = await window.openPremiumModal({
      title: `Editar ${def.label.toLowerCase()}`,
      subtitle: record.name || record.title || "Registro operativo",
      icon: "✎",
      body: `<div class="v175-edit-note"><strong>Cambio controlado</strong>Se actualizarán únicamente los campos visibles. Las relaciones, archivos y el historial permanecen intactos.</div><div class="v175-edit-grid">${fields.map((field) => fieldHtml(entity, field)).join("")}</div>`,
      actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Guardar cambios", className: "primary", loadingLabel: "Guardando…", onClick: async () => { const patch = readPatch(entity, fields, record); await patchRecord(entity, id, patch); return true; } }
      ]
    });
    if (result === true) {
      notify(`${def.label} actualizado`, "Los cambios fueron guardados y se volverán a cargar.", "success");
      await refreshData();
    }
  }

  async function openLifecycle(entity, id, target) {
    const def = ENTITY[entity], record = findRecord(entity, id); if (!def || !record) return;
    if (!canLifecycle()) { notify("Acceso restringido", "Solo Dirección puede administrar el ciclo de vida de registros.", "warning"); return; }
    const labels = { archived: ["Archivar", "El registro saldrá de la vista activa, pero conservará relaciones e historial."], trashed: ["Enviar a papelera", "La eliminación es reversible. No se borrarán archivos ni relaciones productivas."], active: ["Restaurar", "El registro volverá a la vista activa."] };
    const [action, description] = labels[target] || ["Cambiar estado", "El cambio será reversible."];
    const deps = dependencySummary(entity, id);
    const reasonId = `v175_reason_${entity}_${String(id).replace(/[^a-z0-9_-]/gi, "")}`;
    const confirmed = await window.openPremiumModal({
      title: `${action} ${def.label.toLowerCase()}`,
      subtitle: record.name || record.title || "Registro operativo",
      icon: target === "trashed" ? "⌫" : target === "active" ? "↺" : "▣",
      body: `<div class="v175-edit-note"><strong>${htmlEsc(action)} reversible</strong>${htmlEsc(description)}</div><div class="v175-dependency-summary">${deps.map(([label, value]) => `<article><span>${htmlEsc(label)}</span><strong>${htmlEsc(value)}</strong></article>`).join("")}</div><div class="v175-edit-grid" style="margin-top:12px"><label class="wide">Motivo<textarea id="${reasonId}" placeholder="Motivo breve para Auditoría"></textarea></label></div>`,
      actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: action, className: target === "trashed" ? "danger" : "primary", loadingLabel: "Aplicando…", onClick: async () => { const reason = document.getElementById(reasonId)?.value || ""; await setRecordState(entity, id, target, reason); return true; } }
      ]
    });
    if (confirmed === true) {
      notify(`${def.label} ${target === "active" ? "restaurado" : target === "archived" ? "archivado" : "enviado a papelera"}`, mode === "cloud" ? "El estado quedó sincronizado." : "El cambio quedó guardado localmente hasta instalar el SQL opcional.", "success");
      rerenderEntity(entity); renderAllToolbars(); window.dispatchEvent(new CustomEvent("inbestiga:lifecycle-updated", { detail: { entity, id, state: target, mode } }));
    }
  }

  function notify(title, body, type = "info") { if (typeof window.premiumToast === "function") window.premiumToast(title, body, type); else console.log(title, body); }
  async function refreshData() {
    if (typeof window.loadAll === "function") await window.loadAll();
    if (typeof window.renderAll === "function") await window.renderAll();
    await syncLifecycle();
  }

  function actionButtonsHtml(entity, id, compact = false) {
    const record = findRecord(entity, id), lifecycleState = stateFor(entity, id); if (!record) return "";
    const buttons = [];
    if (lifecycleState !== "trashed" && canEdit(entity, record)) buttons.push(`<button type="button" class="primary" data-v175-action="edit" data-v175-entity="${entity}" data-v175-id="${htmlEsc(id)}">Editar</button>`);
    if (canLifecycle()) {
      if (lifecycleState === "active") buttons.push(`<button type="button" class="warning" data-v175-action="archive" data-v175-entity="${entity}" data-v175-id="${htmlEsc(id)}">Archivar</button><button type="button" class="danger" data-v175-action="trash" data-v175-entity="${entity}" data-v175-id="${htmlEsc(id)}">Eliminar</button>`);
      else if (lifecycleState === "archived") buttons.push(`<button type="button" data-v175-action="restore" data-v175-entity="${entity}" data-v175-id="${htmlEsc(id)}">Restaurar</button><button type="button" class="danger" data-v175-action="trash" data-v175-entity="${entity}" data-v175-id="${htmlEsc(id)}">Eliminar</button>`);
      else buttons.push(`<button type="button" class="primary" data-v175-action="restore" data-v175-entity="${entity}" data-v175-id="${htmlEsc(id)}">Restaurar</button>`);
    }
    if (!buttons.length) return "";
    return `<div class="v175-record-actions${compact ? " compact" : ""}"><span class="v175-state-chip ${lifecycleState}"><i></i>${lifecycleState === "active" ? "Activo" : lifecycleState === "archived" ? "Archivado" : "Papelera"}</span>${buttons.join("")}</div>`;
  }

  function withFilteredState(entity, callback) {
    const original = {};
    const targetFilter = filterFor(entity);
    Object.entries(ENTITY).forEach(([name, def]) => {
      const stateRef = getState();
      if (!stateRef || !Array.isArray(stateRef[def.stateKey]) || original[def.stateKey]) return;
      original[def.stateKey] = stateRef[def.stateKey];
      const filter = name === entity ? targetFilter : (entity === "campaign" && name === "brief" ? filterFor("brief") : "active");
      stateRef[def.stateKey] = original[def.stateKey].filter((item) => stateFor(name, item.id) === filter);
    });
    try { return callback(); } finally { Object.entries(original).forEach(([key, value]) => { getState()[key] = value; }); }
  }

  function wrapRenderer(name, entity) {
    const base = window[name]; if (typeof base !== "function" || base.__v175Wrapped) return;
    const wrapped = function (...args) { const result = withFilteredState(entity, () => base.apply(this, args)); queueMicrotask(() => { decorateEntity(entity); renderToolbar(entity); }); return result; };
    wrapped.__v175Wrapped = true; wrapped.__v175Base = base; window[name] = wrapped;
  }

  function rerenderEntity(entity) {
    const def = ENTITY[entity]; if (!def) return;
    const renderer = window[def.renderer]; if (typeof renderer === "function") { try { renderer(); } catch (error) { console.warn(`[v17.5.1] render ${entity}`, error); } }
    if (entity === "brief" && typeof window.renderCampaigns === "function") window.renderCampaigns();
  }
  function rerenderAllEntities() { [...new Set(Object.values(ENTITY).map((def) => def.renderer).filter(Boolean))].forEach((name) => { const fn = window[name]; if (typeof fn === "function") { try { fn(); } catch { /* el módulo principal reporta errores */ } } }); }

  function addActions(host, entity, id, compact = false) {
    if (!host || host.querySelector(":scope > .v175-record-actions")) return;
    const holder = document.createElement("div"); holder.innerHTML = actionButtonsHtml(entity, id, compact); const child = holder.firstElementChild; if (child) host.appendChild(child);
  }

  function decorateCampaigns() {
    document.querySelectorAll("#v413Portfolio [data-campaign-id]").forEach((card) => { addActions(card, "campaign", card.dataset.campaignId); card.querySelectorAll("[data-v175-action]").forEach((button) => button.addEventListener("click", (event) => event.stopPropagation())); });
    document.querySelectorAll("#campaignList tbody tr").forEach((row) => {
      if (row.querySelector(".v175-table-actions")) return; const name = row.querySelector("td strong")?.textContent?.trim();
      const matches = recordsFor("campaign").filter((item) => String(item.name || "").trim() === name); if (matches.length !== 1) return;
      const cell = document.createElement("td"); cell.className = "v175-table-actions"; cell.innerHTML = actionButtonsHtml("campaign", matches[0].id, true); row.appendChild(cell);
    });
    const head = document.querySelector("#campaignList thead tr"); if (head && !head.querySelector("[data-v175-head]")) head.insertAdjacentHTML("beforeend", '<th data-v175-head="1">Acciones</th>');
    decorateBriefs();
  }
  function decorateBriefs() {
    const body = document.getElementById("v15CampaignBody");
    const cards = document.querySelectorAll("#v15CampaignBody .v15-info-card");
    const campaignId = document.getElementById("v15CampaignSelect")?.value;
    if (body && (cards.length || filterFor("brief") !== "active")) {
      let toolbar = document.getElementById("v175Toolbar_brief");
      if (!toolbar) { toolbar = document.createElement("div"); toolbar.id = "v175Toolbar_brief"; toolbar.className = "v175-lifecycle-toolbar"; body.prepend(toolbar); }
      toolbar.innerHTML = toolbarHtml("brief");
    }
    const list = recordsFor("brief").filter((item) => !campaignId || sameId(item.campaign_id, campaignId));
    cards.forEach((card, index) => { if (list[index]) addActions(card, "brief", list[index].id); });
  }
  function decorateTasks() {
    document.querySelectorAll("#taskKanban .v412-task-card[data-task-id]").forEach((card) => {
      addActions(card, "task", card.dataset.taskId, true);
      card.querySelectorAll("[data-v175-action]").forEach((button) => button.addEventListener("click", (event) => event.stopPropagation()));
    });
  }

  function decorateEditorial() {
    const list = recordsFor("editorial"); const rows = document.querySelectorAll("#editorialList tbody tr");
    const head = document.querySelector("#editorialList thead tr"); if (head && !head.querySelector("[data-v175-head]")) head.insertAdjacentHTML("beforeend", '<th data-v175-head="1">Acciones</th>');
    rows.forEach((row, index) => { if (!list[index] || row.querySelector(".v175-table-actions")) return; const cell = document.createElement("td"); cell.className = "v175-table-actions"; cell.innerHTML = actionButtonsHtml("editorial", list[index].id, true); row.appendChild(cell); });
  }
  function decorateCards(selector, entity) { const list = recordsFor(entity); document.querySelectorAll(selector).forEach((card, index) => { if (list[index]) addActions(card, entity, list[index].id); }); }
  function decorateReports() {
    const list = recordsFor("report").slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 12);
    document.querySelectorAll("#snapshotList .v416-highlight").forEach((row, index) => { if (list[index]) addActions(row, "report", list[index].id, true); });
  }
  function decorateTaskModal(id) { const body = document.getElementById("premiumModalBody"); if (!body) return; const existing = body.querySelector(`[data-v175-task-actions="${CSS.escape(String(id))}"]`); if (existing) return; const holder = document.createElement("div"); holder.innerHTML = actionButtonsHtml("task", id); const actions = holder.firstElementChild; if (actions) { actions.dataset.v175TaskActions = String(id); body.appendChild(actions); } }
  function decorateEntity(entity) {
    if (entity === "campaign") decorateCampaigns();
    else if (entity === "task") decorateTasks();
    else if (entity === "editorial") decorateEditorial();
    else if (entity === "asset") decorateCards("#assetGrid .asset-card", "asset");
    else if (entity === "template") decorateCards("#templateGrid .template-card", "template");
    else if (entity === "incident") decorateCards("#incidentGrid .incident-card", "incident");
    else if (entity === "report") decorateReports();
    decorateSelects(); renderAuditCoverage();
  }

  function decorateSelects() {
    ["taskCampaign", "briefCampaign", "edCampaign", "assetCampaign", "incidentCampaign", "boardCampaign"].forEach((id) => {
      const select = document.getElementById(id); if (!select) return;
      [...select.options].forEach((option) => { if (!option.value) return; const state = stateFor("campaign", option.value); option.disabled = state !== "active"; if (state !== "active" && !option.textContent.includes("·")) option.textContent += state === "archived" ? " · archivado" : " · papelera"; });
    });
  }

  function enhancedCampaignDetail(id) {
    const c = findRecord("campaign", id); if (!c) return;
    const tasks = recordsFor("task", "active").filter((item) => sameId(item.campaign_id, id));
    const done = tasks.filter((item) => typeof window.v412TaskDone === "function" && window.v412TaskDone(item));
    const late = tasks.filter((item) => typeof window.v412TaskOverdue === "function" ? window.v412TaskOverdue(item) : (item.due_date && typeof today === "function" && item.due_date < today() && !(typeof window.v412TaskDone === "function" && window.v412TaskDone(item))));
    const briefs = recordsFor("brief", "active").filter((item) => sameId(item.campaign_id, id));
    const editorial = recordsFor("editorial", "active").filter((item) => sameId(item.campaign_id, id));
    const assets = recordsFor("asset", "active").filter((item) => sameId(item.campaign_id, id));
    const progress = tasks.length ? Math.round(done.length * 100 / tasks.length) : 0;
    window.openPremiumModal({
      title: c.name || "Proyecto", subtitle: `${typeof window.nameOf === "function" ? window.nameOf(getState().clients, c.client_id) : "" || "Sin cliente"} · ${c.status || "planificación"}`, icon: "",
      body: `<div class="v412-task-detail"><div class="v412-task-detail-grid"><div class="v412-task-detail-box"><span>Avance</span><strong>${progress}%</strong></div><div class="v412-task-detail-box"><span>Tareas</span><strong>${tasks.length}</strong></div><div class="v412-task-detail-box"><span>Vencidas</span><strong>${late.length}</strong></div><div class="v412-task-detail-box"><span>Entregables</span><strong>${assets.length}</strong></div><div class="v412-task-detail-box"><span>Briefs</span><strong>${briefs.length}</strong></div><div class="v412-task-detail-box"><span>Publicaciones</span><strong>${editorial.length}</strong></div></div><div class="v412-task-detail-box"><span>Objetivo</span><p>${htmlEsc(c.objective || "Sin objetivo registrado")}</p></div><div class="v412-task-detail-box"><span>Tareas vinculadas</span>${tasks.length ? tasks.slice(0, 10).map((task) => `<div class="v413-mini-item" data-task-id="${htmlEsc(task.id)}"><div><strong>${htmlEsc(task.title)}</strong><span>${htmlEsc(typeof window.memberName === "function" ? window.memberName(task.assigned_to) : "")} · ${htmlEsc(task.status || "")}</span></div><span>${htmlEsc(typeof window.v412DateLabel === "function" ? window.v412DateLabel(task.due_date) : task.due_date || "")}</span></div>`).join("") : "<p>Sin tareas vinculadas.</p>"}</div>${actionButtonsHtml("campaign", id)}<div class="v413-detail-actions"><button type="button" class="primary" data-v175-detail-create-task="${htmlEsc(c.id)}">Crear tarea</button><button type="button" class="ghost" data-v175-detail-editorial="1">Ver editorial</button><button type="button" class="ghost" data-v175-detail-assets="1">Ver archivos</button></div></div>`,
      actions: [{ label: "Cerrar", value: true, className: "ghost" }]
    });
    setTimeout(() => {
      if (typeof window.v413BindDynamicTaskCards === "function") window.v413BindDynamicTaskCards();
      document.querySelector("[data-v175-detail-create-task]")?.addEventListener("click", () => { window.closePremiumModal(); window.navTo?.("tasks"); const select = document.getElementById("taskCampaign"); if (select) select.value = c.id; window.v413TogglePanel?.("v413CreateTaskPanel", true); });
      document.querySelector("[data-v175-detail-editorial]")?.addEventListener("click", () => { window.closePremiumModal(); window.navTo?.("editorial"); });
      document.querySelector("[data-v175-detail-assets]")?.addEventListener("click", () => { window.closePremiumModal(); window.navTo?.("assets"); const select = document.getElementById("assetCampaign"); if (select) select.value = c.id; });
    }, 0);
  }

  function wrapDetails() {
    if (typeof window.v413OpenCampaign === "function" && !window.v413OpenCampaign.__v175Wrapped) { enhancedCampaignDetail.__v175Wrapped = true; enhancedCampaignDetail.__v175Base = window.v413OpenCampaign; window.v413OpenCampaign = enhancedCampaignDetail; }
    if (typeof window.v412OpenTask === "function" && !window.v412OpenTask.__v175Wrapped) {
      const base = window.v412OpenTask; const wrapped = function (id) { const result = base.apply(this, arguments); setTimeout(() => decorateTaskModal(id), 0); return result; }; wrapped.__v175Wrapped = true; wrapped.__v175Base = base; window.v412OpenTask = wrapped;
    }
  }

  function renderAuditCoverage() {
    const section = document.getElementById("auditpro"); if (!section) return;
    let host = document.getElementById("v175LifecycleAudit");
    if (!host) { host = document.createElement("div"); host.id = "v175LifecycleAudit"; host.className = "panel"; const grid = section.querySelector(".grid2"); if (grid) grid.insertAdjacentElement("beforebegin", host); else section.appendChild(host); }
    const rows = [
      ["Proyectos", "Editar · archivar · papelera · restaurar"], ["Tareas", "Editar datos · archivar · papelera · restaurar"],
      ["Briefs", "Editar · archivar · papelera · restaurar"], ["Editorial", "Editar · archivar · papelera · restaurar"],
      ["Archivos", "Editar metadatos · archivar · papelera · restaurar"], ["Plantillas", "Editar · archivar · papelera · restaurar"],
      ["Incidencias", "Editar · archivar · papelera · restaurar"], ["Reportes", "Inmutables · archivar · papelera · restaurar"]
    ];
    host.innerHTML = `<div class="module-title"><div><h3>Gobierno del ciclo de vida</h3><span class="small">Cobertura v17.5.1 sin borrado físico en cascada.</span></div><span class="status ${mode === "cloud" ? "green" : "orange"}">${htmlEsc(modeLabel())}</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Módulo</th><th>Controles disponibles</th></tr></thead><tbody>${rows.map(([name, controls]) => `<tr><td><strong>${name}</strong></td><td>${controls}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function handleClick(event) {
    const filter = event.target.closest("[data-v175-filter]");
    if (filter) { FILTERS[filter.dataset.v175Entity] = filter.dataset.v175Filter; rerenderEntity(filter.dataset.v175Entity); renderToolbar(filter.dataset.v175Entity); return; }
    const button = event.target.closest("[data-v175-action]"); if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const entity = button.dataset.v175Entity, id = button.dataset.v175Id, action = button.dataset.v175Action;
    if (action === "edit") openEdit(entity, id);
    else if (action === "archive") openLifecycle(entity, id, "archived");
    else if (action === "trash") openLifecycle(entity, id, "trashed");
    else if (action === "restore") openLifecycle(entity, id, "active");
  }

  function installWrappers() {
    wrapRenderer("renderCampaigns", "campaign"); wrapRenderer("renderTasks", "task"); wrapRenderer("renderEditorial", "editorial");
    wrapRenderer("renderAssets", "asset"); wrapRenderer("renderTemplates", "template"); wrapRenderer("renderIncidents", "incident"); wrapRenderer("v416RenderReports", "report");
    wrapDetails();
  }

  function health() {
    const pending = pendingCount();
    if (mode === "cloud" && !pending) return { status: "ok", value: "Ciclo de vida sincronizado", detail: "Edición, archivado, papelera y restauración disponen de backend v17.5.1." };
    if (mode === "cloud" && pending) return { status: "warn", value: `${pending} cambio${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`, detail: lastError || "Los cambios se reintentarán cuando Supabase esté disponible." };
    return { status: "info", value: "Fallback local disponible", detail: "Ejecuta SQL_OPCIONAL_v17_5_1.sql manualmente para sincronizar el ciclo de vida entre dispositivos. No se realiza borrado físico." };
  }

  function init() {
    if (initialized) return; initialized = true;
    loadLocalRecords(); installWrappers(); document.addEventListener("click", handleClick);
    renderAllToolbars(); rerenderAllEntities();
    syncTimer = setTimeout(syncLifecycle, 700);
    window.addEventListener("online", () => syncLifecycle());
    window.INBESTIGA_QUALITY_CORE?.register?.("record-lifecycle-controls", { version: VERSION, mode: "productive-optional-sync" });
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "record-lifecycle-controls"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: BUILD, modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  window.INBESTIGA_RECORD_LIFECYCLE = {
    version: VERSION, build: BUILD, init, sync: syncLifecycle, health, edit: openEdit,
    archive: (entity, id) => openLifecycle(entity, id, "archived"),
    trash: (entity, id) => openLifecycle(entity, id, "trashed"),
    restore: (entity, id) => openLifecycle(entity, id, "active"),
    state: stateFor, mode: () => mode, pending: pendingCount, auditedEntities: Object.keys(ENTITY)
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
