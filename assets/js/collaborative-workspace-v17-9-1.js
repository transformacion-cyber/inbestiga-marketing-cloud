/* ===== INBESTIGA v17.9.1 · COLLABORATIVE WORKSPACE · SCHEMA-AWARE RPC HOTFIX (v17.12.5) ===== */
(() => {
  "use strict";

  const VERSION = "v17.9";
  const BUCKET = "inbestiga-work-files";
  const MAX_FILES = 3;
  const MAX_LINKS = 5;
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const BLOCKED_EXTENSIONS = new Set(["exe", "msi", "bat", "cmd", "com", "scr", "ps1", "sh", "js", "mjs", "html", "htm", "php", "apk", "dmg", "iso"]);
  const MANAGER_ROLES = new Set(["italo", "jhulio", "alejandro", "director", "admin", "administrator", "supervisor"]);
  const LOCAL_KEY = "inbestiga:v179:workspace";
  const signedUrlCache = new Map();

  let initialized = false;
  let cloudAvailable = false;
  let cloudChecked = false;
  let cloudLastCheckedAt = 0;
  let cloudLastError = null;
  let cloudCheckPromise = null;
  const CLOUD_RETRY_MS = 5000;
  let realtimeChannel = null;
  let workspace = emptyWorkspace();
  let baseFunctions = {};
  let refreshTimer = null;

  function emptyWorkspace() {
    return { version: VERSION, task_participants: [], attachments: [], submissions: [], reviews: [], shared_tasks: [] };
  }

  function arr(value) { return Array.isArray(value) ? value : []; }
  function str(value) { return String(value ?? ""); }
  function same(a, b) { return str(a) === str(b); }
  function escHtml(value) {
    if (typeof window.esc === "function") return window.esc(value);
    return str(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function getState() { try { return typeof state !== "undefined" ? state : null; } catch (_) { return null; } }
  function getMember() { try { return typeof member !== "undefined" ? member : null; } catch (_) { return null; } }
  function getAuthUser() { try { return typeof authUser !== "undefined" ? authUser : null; } catch (_) { return null; } }
  function getSb() { try { return typeof sb !== "undefined" ? sb : null; } catch (_) { return null; } }
  function isManager() {
    const current = getMember();
    const role = str(current?.role_code).toLowerCase();
    if (MANAGER_ROLES.has(role)) return true;
    try { return typeof isSupervisor === "function" && isSupervisor(); } catch (_) { return false; }
  }
  function notify(title, detail = "", tone = "success") {
    if (typeof window.premiumToast === "function") return window.premiumToast(title, detail, tone);
    if (typeof window.toast === "function") return window.toast(title, detail);
    console[tone === "error" ? "error" : "log"](`[${VERSION}] ${title}`, detail);
  }
  function formatBytes(bytes) {
    if (typeof window.v415FormatBytes === "function") return window.v415FormatBytes(bytes);
    const n = Number(bytes) || 0;
    if (!n) return "0 KB";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
    return `${(n / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }
  function formatDate(value) {
    if (!value) return "Sin fecha";
    try { return new Date(value).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }); }
    catch (_) { return str(value); }
  }
  function memberById(id) { return arr(getState()?.members).find((item) => same(item?.id, id)); }
  function memberNameById(id) { return memberById(id)?.full_name || "Miembro"; }
  function taskById(id) { return arr(getState()?.tasks).find((item) => same(item?.id, id)); }
  function campaignById(id) { return arr(getState()?.campaigns).find((item) => same(item?.id, id)); }
  function briefById(id) { return arr(getState()?.briefs).find((item) => same(item?.id, id)); }

  function parseRpcData(data) {
    if (!data) return null;
    if (typeof data === "string") {
      try { return JSON.parse(data); } catch (_) { return data; }
    }
    return data;
  }
  function extractId(data, keys = ["id", "task_id", "campaign_id", "brief_id", "submission_id"]) {
    const value = parseRpcData(data);
    if (!value) return "";
    if (typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)) return value;
    if (Array.isArray(value)) return value.length ? extractId(value[0], keys) : "";
    if (typeof value === "object") {
      for (const key of keys) if (value[key]) return str(value[key]);
      if (value.data) return extractId(value.data, keys);
    }
    return "";
  }

  function normalizeWorkspace(raw) {
    const value = parseRpcData(raw) || {};
    return {
      version: value.version || VERSION,
      actor: value.actor || null,
      task_participants: arr(value.task_participants),
      attachments: arr(value.attachments),
      submissions: arr(value.submissions),
      reviews: arr(value.reviews),
      shared_tasks: arr(value.shared_tasks)
    };
  }

  function localWorkspaceKey() {
    const current = getAuthUser()?.id || getMember()?.auth_user_id || getMember()?.id || "guest";
    return `${LOCAL_KEY}:${current}`;
  }
  function loadLocalWorkspace() {
    try { return normalizeWorkspace(JSON.parse(localStorage.getItem(localWorkspaceKey()) || "{}")); }
    catch (_) { return emptyWorkspace(); }
  }
  function saveLocalWorkspace() {
    try { localStorage.setItem(localWorkspaceKey(), JSON.stringify(workspace)); } catch (_) {}
  }

  function normalizeRpcPayload(data) {
    const value = parseRpcData(data);
    if (Array.isArray(value)) return value[0] || null;
    if (value && typeof value === "object" && "data" in value && Object.keys(value).length === 1) return normalizeRpcPayload(value.data);
    return value;
  }

  function rpcErrorText(error) {
    if (!error) return "";
    return [error.message, error.details, error.hint].filter(Boolean).join(" · ") || str(error);
  }

  async function callRpc(name, params) {
    const client = getSb();
    if (!client?.rpc) return { data: null, error: new Error("Supabase todavía no está disponible en esta sesión.") };
    const attempts = [];
    if (typeof client.schema === "function") {
      try {
        const scoped = client.schema("marketing_app");
        if (scoped?.rpc) attempts.push({ label: "marketing_app", client: scoped });
      } catch (_) {}
    }
    attempts.push({ label: "default", client });
    const seen = new Set();
    let last = { data: null, error: new Error(`No se pudo invocar ${name}.`) };
    for (const attempt of attempts) {
      if (!attempt.client || seen.has(attempt.client)) continue;
      seen.add(attempt.client);
      try {
        const result = await attempt.client.rpc(name, params);
        if (!result?.error) return result || { data: null, error: null };
        last = result;
      } catch (error) {
        last = { data: null, error };
      }
    }
    return last;
  }

  function cloudUnavailableMessage() {
    const text = rpcErrorText(cloudLastError).toLowerCase();
    if (text.includes("schema") && (text.includes("exposed") || text.includes("profile"))) return "Supabase no tiene expuesto el esquema marketing_app en Data API.";
    if (text.includes("permission") || text.includes("42501") || text.includes("not allowed")) return "La cuenta autenticada no tiene permiso para ejecutar el módulo colaborativo.";
    if (text.includes("schema cache") || text.includes("pgrst202") || text.includes("could not find the function")) return "La API de Supabase todavía no reconoce las funciones instaladas; recarga su esquema y vuelve a intentar.";
    return "No se pudo conectar con el módulo colaborativo de Supabase. El SQL ya puede estar instalado; revisa la conexión o vuelve a cargar la página.";
  }

  async function checkCloud(force = false) {
    if (cloudAvailable && !force) return true;
    const now = Date.now();
    if (!force && cloudChecked && now - cloudLastCheckedAt < CLOUD_RETRY_MS) return false;
    if (cloudCheckPromise) return cloudCheckPromise;
    cloudCheckPromise = (async () => {
      cloudChecked = true;
      cloudLastCheckedAt = Date.now();
      const client = getSb();
      if (!client) {
        cloudAvailable = false;
        cloudLastError = new Error("Supabase todavía no está disponible.");
        updateBackendBadges();
        return false;
      }
      try {
        let result = await callRpc("ibm_v179_capabilities");
        if (result?.error) throw result.error;
        const value = normalizeRpcPayload(result?.data) || {};
        cloudAvailable = str(value.version).replace(/^v/i, "") === "17.9" || value.collaborative_workspace === true || value.multi_assignee === true;
        if (!cloudAvailable) throw new Error("La respuesta de capacidades v17.9 no fue reconocida.");
        cloudLastError = null;
      } catch (error) {
        cloudAvailable = false;
        cloudLastError = error;
        console.warn("[v17.9.1] No se pudo validar el backend colaborativo.", rpcErrorText(error));
      }
      updateBackendBadges();
      return cloudAvailable;
    })();
    try { return await cloudCheckPromise; }
    finally { cloudCheckPromise = null; }
  }

  async function refreshWorkspace({ render = false } = {}) {
    clearTimeout(refreshTimer);
    const client = getSb();
    await checkCloud();
    if (cloudAvailable && client) {
      try {
        const { data, error } = await callRpc("ibm_v179_workspace");
        if (error) throw error;
        workspace = normalizeWorkspace(data);
      } catch (error) {
        console.warn("[v17.9] No se pudo cargar el espacio colaborativo.", error);
        workspace = loadLocalWorkspace();
      }
    } else {
      workspace = loadLocalWorkspace();
    }
    mergeWorkspaceIntoState();
    updateBackendBadges();
    if (render) renderAffectedViews();
    return workspace;
  }

  function participantRows(taskId) { return arr(workspace.task_participants).filter((row) => same(row.task_id, taskId) && row.status !== "removed"); }
  function participantIds(taskId) {
    const task = taskById(taskId);
    const ids = participantRows(taskId).map((row) => row.member_id);
    if (task?.v179_primary_assigned_to && !ids.some((id) => same(id, task.v179_primary_assigned_to))) ids.unshift(task.v179_primary_assigned_to);
    else if (task?.assigned_to && !ids.some((id) => same(id, task.assigned_to))) ids.unshift(task.assigned_to);
    return [...new Set(ids.filter(Boolean).map(str))];
  }
  function participantNames(taskId) { return participantIds(taskId).map(memberNameById); }
  function isTaskParticipant(taskId, memberId = getMember()?.id) { return participantIds(taskId).some((id) => same(id, memberId)); }

  function mergeWorkspaceIntoState() {
    const app = getState();
    if (!app) return;
    const taskMap = new Map(arr(app.tasks).map((task) => [str(task.id), task]));
    for (const raw of arr(workspace.shared_tasks)) {
      const task = raw?.task_json || raw;
      if (!task?.id) continue;
      const current = taskMap.get(str(task.id));
      if (current) Object.assign(current, task);
      else { app.tasks = arr(app.tasks); app.tasks.push({ ...task }); taskMap.set(str(task.id), app.tasks[app.tasks.length - 1]); }
    }
    const currentMember = getMember();
    const manager = isManager();
    for (const task of arr(app.tasks)) {
      const rows = participantRows(task.id);
      const primary = task.v179_primary_assigned_to || task.assigned_to;
      task.v179_primary_assigned_to = primary;
      task.v179_participant_ids = [...new Set([primary, ...rows.map((row) => row.member_id)].filter(Boolean).map(str))];
      task.v179_multi_assignee = task.v179_participant_ids.length > 1;
      if (!manager && currentMember?.id && task.v179_participant_ids.some((id) => same(id, currentMember.id))) {
        task.assigned_to = currentMember.id;
      }
    }
  }

  function attachmentsFor(entityType, entityId, category = "") {
    return arr(workspace.attachments).filter((item) => item.archived_at == null && item.entity_type === entityType && same(item.entity_id, entityId) && (!category || item.category === category));
  }
  function submissionAttachments(submissionId) {
    return arr(workspace.attachments).filter((item) => item.archived_at == null && same(item.submission_id, submissionId));
  }
  function submissionsFor(taskId) {
    return arr(workspace.submissions).filter((item) => same(item.task_id, taskId)).sort((a, b) => str(b.submitted_at || b.created_at).localeCompare(str(a.submitted_at || a.created_at)));
  }
  function reviewsFor(taskId) {
    return arr(workspace.reviews).filter((item) => same(item.task_id, taskId)).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
  }
  function latestSubmission(taskId) { return submissionsFor(taskId)[0] || null; }

  function parseLinks(value) {
    const result = [];
    const seen = new Set();
    for (const line of str(value).split(/\r?\n|,/)) {
      const url = line.trim();
      if (!url || seen.has(url)) continue;
      let parsed;
      try { parsed = new URL(url); } catch (_) { throw new Error(`El enlace no es válido: ${url}`); }
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Los enlaces deben comenzar con http:// o https://");
      seen.add(url); result.push(url);
    }
    if (result.length > MAX_LINKS) throw new Error(`Puedes agregar hasta ${MAX_LINKS} enlaces por bloque.`);
    return result;
  }
  function fileExtension(file) { return str(file?.name).split(".").pop().toLowerCase(); }
  function validateFiles(files, existingCount = 0) {
    const list = Array.from(files || []);
    if (existingCount + list.length > MAX_FILES) throw new Error(`Solo se permiten ${MAX_FILES} archivos por bloque. Ya existen ${existingCount}.`);
    for (const file of list) {
      if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} supera el máximo de 25 MB.`);
      if (BLOCKED_EXTENSIONS.has(fileExtension(file))) throw new Error(`${file.name} utiliza un tipo de archivo no permitido.`);
    }
    return list;
  }
  function safeFileName(name) {
    return str(name || "archivo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
  }
  function storagePath(entityType, entityId, category, file) {
    const authId = getAuthUser()?.id || getMember()?.auth_user_id;
    if (!authId) throw new Error("La sesión no tiene un identificador de Auth válido.");
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return `${authId}/${entityType}/${entityId}/${category}/${nonce}-${safeFileName(file.name)}`;
  }

  async function uploadFile(entityType, entityId, category, file) {
    const client = getSb();
    if (!client?.storage) throw new Error("Supabase Storage no está disponible.");
    validateFiles([file]);
    const path = storagePath(entityType, entityId, category, file);
    const { error } = await client.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream"
    });
    if (error) throw error;
    return path;
  }

  async function registerAttachment(payload) {
    const client = getSb();
    if (!cloudAvailable || !client) {
      const item = { id: crypto.randomUUID(), ...payload, uploader_member_id: getMember()?.id, created_at: new Date().toISOString() };
      workspace.attachments.push(item); saveLocalWorkspace(); return item;
    }
    const { data, error } = await callRpc("ibm_v179_create_attachment", {
      p_entity_type: payload.entity_type,
      p_entity_id: payload.entity_id,
      p_category: payload.category,
      p_submission_id: payload.submission_id || null,
      p_file_name: payload.file_name || null,
      p_mime_type: payload.mime_type || null,
      p_file_size: payload.file_size || 0,
      p_storage_path: payload.storage_path || null,
      p_external_url: payload.external_url || null,
      p_notes: payload.notes || ""
    });
    if (error) throw error;
    return parseRpcData(data);
  }

  async function addAttachments({ entityType, entityId, category = "reference", submissionId = null, files = [], links = [], notes = "" }) {
    await checkCloud(true);
    if (!cloudAvailable && (files.length || links.length)) throw new Error(cloudUnavailableMessage());
    const existing = category === "submission" && submissionId
      ? submissionAttachments(submissionId).filter((item) => item.storage_path).length
      : attachmentsFor(entityType, entityId, category).filter((item) => item.storage_path && (!submissionId || same(item.submission_id, submissionId))).length;
    const validFiles = validateFiles(files, existing);
    const validLinks = Array.isArray(links) ? links : parseLinks(links);
    const uploaded = [];
    for (const file of validFiles) {
      const path = await uploadFile(entityType, entityId, category, file);
      try {
        const saved = await registerAttachment({
          entity_type: entityType, entity_id: entityId, category, submission_id: submissionId,
          file_name: file.name, mime_type: file.type || "application/octet-stream", file_size: file.size,
          storage_path: path, external_url: null, notes
        });
        uploaded.push(saved);
      } catch (error) {
        try { await getSb()?.storage?.from(BUCKET)?.remove([path]); } catch (_) {}
        throw error;
      }
    }
    for (const url of validLinks) {
      uploaded.push(await registerAttachment({
        entity_type: entityType, entity_id: entityId, category, submission_id: submissionId,
        file_name: new URL(url).hostname, mime_type: "text/uri-list", file_size: 0,
        storage_path: null, external_url: url, notes
      }));
    }
    await refreshWorkspace();
    return uploaded;
  }

  async function openAttachment(id) {
    const item = arr(workspace.attachments).find((row) => same(row.id, id));
    if (!item) return;
    if (item.external_url) { window.open(item.external_url, "_blank", "noopener"); return; }
    if (!item.storage_path) return;
    const cached = signedUrlCache.get(item.storage_path);
    if (cached && cached.expires > Date.now()) { window.open(cached.url, "_blank", "noopener"); return; }
    const client = getSb();
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(item.storage_path, 3600);
    if (error) throw error;
    signedUrlCache.set(item.storage_path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
    window.open(data.signedUrl, "_blank", "noopener");
  }

  function attachmentRowsMarkup(items, emptyText = "Sin archivos o enlaces registrados.") {
    if (!items.length) return `<div class="v179-empty">${escHtml(emptyText)}</div>`;
    return `<div class="v179-file-list">${items.map((item) => `<button type="button" class="v179-file" data-v179-open-attachment="${escHtml(item.id)}"><span class="v179-file-icon">${item.external_url ? "↗" : fileIcon(item.mime_type, item.file_name)}</span><span><strong>${escHtml(item.file_name || "Recurso")}</strong><small>${item.external_url ? escHtml(item.external_url) : `${escHtml(item.mime_type || "Archivo")} · ${formatBytes(item.file_size)}`} · ${escHtml(memberNameById(item.uploader_member_id))}</small></span><b>Abrir</b></button>`).join("")}</div>`;
  }
  function fileIcon(mime, name) {
    const type = str(mime).toLowerCase(), ext = str(name).toLowerCase();
    if (type.startsWith("image/")) return "▧";
    if (type.startsWith("video/")) return "▶";
    if (type.startsWith("audio/")) return "AUD";
    if (type.includes("pdf") || ext.endsWith(".pdf")) return "PDF";
    if (type.includes("word") || /\.docx?$/.test(ext)) return "DOC";
    if (type.includes("sheet") || /\.xlsx?$/.test(ext)) return "XLS";
    if (type.includes("presentation") || /\.pptx?$/.test(ext)) return "PPT";
    return "FILE";
  }

  function fileInputMarkup(id, label = "Archivos") {
    return `<label class="v179-field full"><span>${escHtml(label)}</span><input id="${id}" type="file" multiple accept="image/*,video/mp4,video/quicktime,video/webm,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.zip,.psd,.ai,.indd,.aep,.prproj"><small>Hasta ${MAX_FILES} archivos · máximo 25 MB por archivo.</small><div class="v179-file-preview" data-v179-preview-for="${id}"></div></label>`;
  }
  function linksInputMarkup(id, label = "Enlaces") {
    return `<label class="v179-field full"><span>${escHtml(label)}</span><textarea id="${id}" rows="3" placeholder="Un enlace por línea · Drive, Figma, Canva, YouTube, referencias web..."></textarea><small>Hasta ${MAX_LINKS} enlaces.</small></label>`;
  }
  function selectedFiles(id) { return Array.from(document.getElementById(id)?.files || []); }

  function memberPickerMarkup(id, selected = []) {
    const selectedSet = new Set(arr(selected).map(str));
    const people = arr(getState()?.members).filter((person) => person.status !== "inactive");
    return `<div id="${id}" class="v179-assignee-picker">${people.map((person) => `<label><input type="checkbox" value="${escHtml(person.id)}" ${selectedSet.has(str(person.id)) ? "checked" : ""}><span><strong>${escHtml(person.full_name)}</strong><small>${escHtml(person.position || person.role_code || "Equipo")}</small></span></label>`).join("")}</div>`;
  }
  function checkedMemberIds(containerId) {
    return Array.from(document.querySelectorAll(`#${CSS.escape(containerId)} input[type="checkbox"]:checked`)).map((input) => input.value).filter(Boolean);
  }

  function ensureFormEnhancements() {
    const taskSelect = document.getElementById("taskAssignee");
    if (taskSelect && !document.getElementById("v179TaskAssignees")) {
      const label = taskSelect.closest("label");
      if (label) {
        label.classList.add("v179-assignee-field");
        taskSelect.hidden = true;
        label.insertAdjacentHTML("beforeend", `<small>Selecciona uno o varios ejecutores.</small>${memberPickerMarkup("v179TaskAssignees", [taskSelect.value || getMember()?.id])}`);
        label.style.gridColumn = "1/-1";
        document.getElementById("v179TaskAssignees")?.addEventListener("change", () => {
          const ids = checkedMemberIds("v179TaskAssignees");
          taskSelect.value = ids[0] || "";
        });
      }
    } else if (taskSelect) refreshPicker("v179TaskAssignees", taskSelect.value || getMember()?.id);

    const taskForm = document.getElementById("taskForm");
    if (taskForm && !document.getElementById("v179TaskReferenceFiles")) {
      taskForm.querySelector("button[type='submit'],button:not([type])")?.insertAdjacentHTML("beforebegin", `<div class="v179-form-block">${fileInputMarkup("v179TaskReferenceFiles", "Archivos de referencia")}${linksInputMarkup("v179TaskReferenceLinks", "Links de referencia")}</div>`);
    }
    const taskUpdate = document.getElementById("taskUpdateForm");
    if (taskUpdate && !document.getElementById("v179UpdateFiles")) {
      taskUpdate.querySelector("button[type='submit'],button:not([type])")?.insertAdjacentHTML("beforebegin", `<div class="v179-form-block">${fileInputMarkup("v179UpdateFiles", "Archivos de la entrega")}${linksInputMarkup("v179UpdateLinks", "Links de la entrega")}</div>`);
    }
    const campaignForm = document.getElementById("campaignForm");
    if (campaignForm && !document.getElementById("v179CampaignReferenceFiles")) {
      campaignForm.querySelector("button[type='submit'],button:not([type])")?.insertAdjacentHTML("beforebegin", `<div class="v179-form-block">${fileInputMarkup("v179CampaignReferenceFiles", "Referencias del proyecto / campaña")}${linksInputMarkup("v179CampaignReferenceLinks", "Links del proyecto / campaña")}</div>`);
    }
    const briefForm = document.getElementById("briefForm");
    if (briefForm && !document.getElementById("v179BriefReferenceFiles")) {
      briefForm.querySelector("button[type='submit'],button:not([type])")?.insertAdjacentHTML("beforebegin", `<div class="v179-form-block">${fileInputMarkup("v179BriefReferenceFiles", "Referencias del brief")}${linksInputMarkup("v179BriefReferenceLinks", "Links del brief")}</div>`);
    }
    bindFilePreviews();
    injectBackendNotice();
  }

  function refreshPicker(id, selectedFallback = "") {
    const container = document.getElementById(id);
    if (!container) return;
    const selected = new Set(Array.from(container.querySelectorAll("input:checked")).map((input) => input.value));
    if (!selected.size && selectedFallback) selected.add(str(selectedFallback));
    const fresh = document.createElement("div");
    fresh.innerHTML = memberPickerMarkup(id, [...selected]);
    container.replaceWith(fresh.firstElementChild);
    document.getElementById(id)?.addEventListener("change", () => {
      const ids = checkedMemberIds(id), legacy = document.getElementById("taskAssignee");
      if (legacy) legacy.value = ids[0] || "";
    });
  }

  function bindFilePreviews() {
    document.querySelectorAll("input[type='file'][multiple]").forEach((input) => {
      if (input.dataset.v179PreviewBound) return;
      input.dataset.v179PreviewBound = "1";
      input.addEventListener("change", () => {
        const preview = document.querySelector(`[data-v179-preview-for="${CSS.escape(input.id)}"]`);
        if (!preview) return;
        try {
          const files = validateFiles(input.files);
          preview.innerHTML = files.map((file) => `<span>${escHtml(file.name)} · ${formatBytes(file.size)}</span>`).join("");
        } catch (error) {
          input.value = ""; preview.innerHTML = `<span class="error">${escHtml(error.message)}</span>`;
        }
      });
    });
  }

  function injectBackendNotice() {
    const target = document.getElementById("v413TaskCommand") || document.getElementById("tasks");
    if (!target || document.getElementById("v179BackendNotice")) return;
    const notice = document.createElement("div");
    notice.id = "v179BackendNotice";
    notice.className = `v179-backend-notice ${cloudAvailable ? "ready" : "local"}`;
    notice.innerHTML = cloudAvailable
      ? `<i></i><div><strong>Espacio colaborativo v17.9 activo</strong><span>Archivos de 25 MB, entregas, puntajes y tareas con varios ejecutores sincronizados.</span></div>`
      : `<i></i><div><strong>Conexión colaborativa pendiente</strong><span>${escHtml(cloudUnavailableMessage())}</span></div>`;
    target.prepend(notice);
  }
  function updateBackendBadges() {
    document.querySelectorAll("#v179BackendNotice").forEach((node) => node.remove());
    if (initialized) injectBackendNotice();
  }

  async function createLegacyEntity({ rpc, params, collection, matcher, idKeys }) {
    const client = getSb();
    const before = new Set(arr(getState()?.[collection]).map((item) => str(item.id)));
    const { data, error } = await callRpc(rpc, params);
    if (error) throw error;
    let id = extractId(data, idKeys);
    if (typeof loadAll === "function") await loadAll();
    const list = arr(getState()?.[collection]);
    if (!id) {
      const created = list.filter((item) => !before.has(str(item.id))).sort((a, b) => str(b.created_at || b.updated_at).localeCompare(str(a.created_at || a.updated_at)));
      id = str(created.find(matcher)?.id || created[0]?.id || "");
    }
    if (!id) {
      const found = list.slice().sort((a, b) => str(b.created_at || b.updated_at).localeCompare(str(a.created_at || a.updated_at))).find(matcher);
      id = str(found?.id || "");
    }
    if (!id) throw new Error("La entidad se creó, pero no fue posible identificarla para vincular los archivos.");
    return id;
  }

  async function setTaskParticipants(taskId, memberIds) {
    const ids = [...new Set(arr(memberIds).filter(Boolean).map(str))];
    if (!ids.length) return;
    if (!cloudAvailable) return;
    const { error } = await callRpc("ibm_v179_set_task_participants", { p_task_id: taskId, p_member_ids: ids });
    if (error) throw error;
  }

  async function handleTaskCreate(form) {
    const title = document.getElementById("taskTitle")?.value?.trim();
    if (!title) throw new Error("Escribe un título para la tarea.");
    const assignees = checkedMemberIds("v179TaskAssignees");
    const fallback = document.getElementById("taskAssignee")?.value;
    if (!assignees.length && fallback) assignees.push(fallback);
    if (!assignees.length) throw new Error("Selecciona al menos un ejecutor.");
    const files = selectedFiles("v179TaskReferenceFiles"), links = parseLinks(document.getElementById("v179TaskReferenceLinks")?.value || "");
    validateFiles(files);
    await checkCloud(true);
    if (!cloudAvailable && (assignees.length > 1 || files.length || links.length)) throw new Error(cloudUnavailableMessage());
    const primary = assignees[0], person = memberById(primary);
    const taskId = await createLegacyEntity({
      rpc: "ibm_v30_create_task",
      params: {
        p_title: title,
        p_description: document.getElementById("taskDescription")?.value?.trim() || "",
        p_assigned_to: primary || null,
        p_client_id: document.getElementById("taskClient")?.value || null,
        p_area_id: document.getElementById("taskArea")?.value || person?.area_id || getMember()?.area_id || null,
        p_campaign_id: document.getElementById("taskCampaign")?.value || null,
        p_due_date: document.getElementById("taskDue")?.value || null,
        p_due_time: document.getElementById("taskTime")?.value || null,
        p_priority: document.getElementById("taskPriority")?.value || "media",
        p_impact: Number(document.getElementById("taskImpact")?.value || 3),
        p_checklist: typeof parseTaskChecklist === "function" ? parseTaskChecklist(document.getElementById("taskChecklist")?.value || "") : str(document.getElementById("taskChecklist")?.value).split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean)
      },
      collection: "tasks",
      matcher: (task) => task.title === title && same(task.assigned_to, primary),
      idKeys: ["id", "task_id"]
    });
    await setTaskParticipants(taskId, assignees);
    if (files.length || links.length) await addAttachments({ entityType: "task", entityId: taskId, category: "reference", files, links, notes: "Referencias adjuntas al crear la tarea" });
    window.dispatchEvent(new CustomEvent("inbestiga:task-created", { detail: { taskId, source: "form", assignees } }));
    form.reset();
    refreshPicker("v179TaskAssignees", getMember()?.id);
    await refreshWorkspace();
    if (typeof renderAll === "function") await renderAll();
    notify("Tarea creada", `${assignees.length} ejecutor${assignees.length === 1 ? "" : "es"} · ${files.length} archivo${files.length === 1 ? "" : "s"} de referencia`, "success");
  }

  async function handleCampaignCreate(form) {
    const name = document.getElementById("campaignName")?.value?.trim();
    if (!name) throw new Error("Escribe el nombre del proyecto o campaña.");
    const files = selectedFiles("v179CampaignReferenceFiles"), links = parseLinks(document.getElementById("v179CampaignReferenceLinks")?.value || "");
    validateFiles(files); await checkCloud(true);
    if (!cloudAvailable && (files.length || links.length)) throw new Error(cloudUnavailableMessage());
    const campaignId = await createLegacyEntity({
      rpc: "ibm_v30_create_campaign",
      params: {
        p_name: name,
        p_client_id: document.getElementById("campaignClient")?.value || null,
        p_area_id: document.getElementById("campaignArea")?.value || null,
        p_status: document.getElementById("campaignStatus")?.value || "planificacion",
        p_start_date: document.getElementById("campaignStart")?.value || null,
        p_end_date: document.getElementById("campaignEnd")?.value || null,
        p_objective: document.getElementById("campaignObjective")?.value?.trim() || "",
        p_audience: document.getElementById("campaignAudience")?.value?.trim() || "",
        p_main_message: document.getElementById("campaignMessage")?.value?.trim() || ""
      },
      collection: "campaigns",
      matcher: (campaign) => campaign.name === name,
      idKeys: ["id", "campaign_id"]
    });
    if (files.length || links.length) await addAttachments({ entityType: "campaign", entityId: campaignId, category: "reference", files, links, notes: "Referencias iniciales del proyecto / campaña" });
    form.reset(); await refreshWorkspace(); if (typeof renderAll === "function") await renderAll();
    notify("Proyecto creado", "Las referencias quedaron disponibles para el equipo.", "success");
  }

  async function handleBriefCreate(form) {
    const title = document.getElementById("briefTitle")?.value?.trim();
    if (!title) throw new Error("Escribe el título del brief.");
    const campaignId = document.getElementById("briefCampaign")?.value || null;
    const files = selectedFiles("v179BriefReferenceFiles"), links = parseLinks(document.getElementById("v179BriefReferenceLinks")?.value || "");
    validateFiles(files); await checkCloud(true);
    if (!cloudAvailable && (files.length || links.length)) throw new Error(cloudUnavailableMessage());
    const briefId = await createLegacyEntity({
      rpc: "ibm_v30_create_brief",
      params: {
        p_campaign_id: campaignId,
        p_title: title,
        p_objective: document.getElementById("briefObjective")?.value?.trim() || "",
        p_audience: document.getElementById("briefAudience")?.value?.trim() || "",
        p_formats: document.getElementById("briefFormats")?.value?.trim() || "",
        p_references_text: document.getElementById("briefRefs")?.value?.trim() || "",
        p_brand_rules: document.getElementById("briefRules")?.value?.trim() || "",
        p_deliverables: document.getElementById("briefDeliverables")?.value?.trim() || ""
      },
      collection: "briefs",
      matcher: (brief) => brief.title === title && (!campaignId || same(brief.campaign_id, campaignId)),
      idKeys: ["id", "brief_id"]
    });
    if (files.length || links.length) await addAttachments({ entityType: "brief", entityId: briefId, category: "reference", files, links, notes: "Referencias adjuntas al brief" });
    form.reset(); await refreshWorkspace(); if (typeof renderAll === "function") await renderAll();
    notify("Brief creado", "El contenido y sus referencias quedaron vinculados.", "success");
  }

  async function createSubmission(taskId, { comment, files, links }) {
    await checkCloud();
    if (!cloudAvailable) throw new Error(cloudUnavailableMessage());
    validateFiles(files);
    if (!files.length && !links.length) throw new Error("Agrega al menos un archivo o un enlace de entrega.");
    const { data, error } = await callRpc("ibm_v179_create_submission", { p_task_id: taskId, p_comment: comment || "Entrega enviada a revisión", p_links: links.map((url) => ({ url })) });
    if (error) throw error;
    const submissionId = extractId(data, ["submission_id", "id"]);
    if (!submissionId) throw new Error("No se recibió el identificador de la entrega.");
    if (files.length) await addAttachments({ entityType: "task", entityId: taskId, category: "submission", submissionId, files, links: [], notes: comment || "Entrega" });
    await refreshWorkspace();
    if (typeof loadAll === "function") await loadAll();
    await refreshWorkspace();
    renderAffectedViews();
    window.dispatchEvent(new CustomEvent("inbestiga:task-submission-created", { detail: { taskId, submissionId, source: "delivery" } }));
    return submissionId;
  }

  async function updateTaskStatus(taskId, status, evidenceUrl = "", comment = "") {
    await checkCloud();
    if (cloudAvailable) {
      const { error } = await callRpc("ibm_v179_update_task_status", { p_task_id: taskId, p_status: status, p_evidence_url: evidenceUrl || null, p_comment: comment || "" });
      if (error) throw error;
      return;
    }
    const { error } = await callRpc("ibm_v30_update_task", { p_task_id: taskId, p_status: status, p_evidence_url: evidenceUrl || "", p_quality: null, p_comment: comment || "Progreso actualizado" });
    if (error) throw error;
  }

  async function handleTaskUpdate(form) {
    const taskId = document.getElementById("updateTaskId")?.value;
    if (!taskId) throw new Error("Selecciona una tarea.");
    const status = document.getElementById("updateTaskStatus")?.value || "en_proceso";
    const files = selectedFiles("v179UpdateFiles"), links = parseLinks(document.getElementById("v179UpdateLinks")?.value || "");
    const comment = document.getElementById("updateComment")?.value?.trim() || "";
    if (files.length || links.length) {
      await createSubmission(taskId, { comment, files, links });
    } else {
      const evidence = document.getElementById("updateEvidence")?.value?.trim() || "";
      await updateTaskStatus(taskId, status, evidence, comment);
      if (typeof loadAll === "function") await loadAll();
      await refreshWorkspace(); renderAffectedViews();
    }
    form.reset(); notify("Tarea actualizada", files.length || links.length ? "La entrega fue enviada a revisión." : "El estado fue guardado.", "success");
  }

  function bindSubmitInterceptors() {
    document.addEventListener("submit", async (event) => {
      const form = event.target;
      if (!form?.id || !["taskForm", "campaignForm", "briefForm", "taskUpdateForm"].includes(form.id)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const button = form.querySelector("button[type='submit'],button:not([type])");
      const original = button?.textContent;
      if (button) { button.disabled = true; button.textContent = "Guardando…"; }
      try {
        if (form.id === "taskForm") await handleTaskCreate(form);
        if (form.id === "campaignForm") await handleCampaignCreate(form);
        if (form.id === "briefForm") await handleBriefCreate(form);
        if (form.id === "taskUpdateForm") await handleTaskUpdate(form);
      } catch (error) { notify("No se pudo completar", error?.message || str(error), "error"); }
      finally { if (button) { button.disabled = false; button.textContent = original || "Guardar"; } }
    }, true);
  }

  function entityAttachmentModal({ entityType, entityId, category = "reference", submissionId = null, title = "Agregar archivos", subtitle = "" }) {
    const existing = submissionId ? submissionAttachments(submissionId) : attachmentsFor(entityType, entityId, category);
    const body = `<div class="v179-modal-grid"><div class="v179-current-files"><h4>Recursos actuales</h4>${attachmentRowsMarkup(existing)}</div>${fileInputMarkup("v179ModalFiles", category === "reference" ? "Archivos de referencia" : "Archivos de entrega")}${linksInputMarkup("v179ModalLinks", category === "reference" ? "Links de referencia" : "Links de entrega")}<label class="v179-field full"><span>Notas</span><textarea id="v179ModalNotes" rows="3" placeholder="Describe la utilidad del archivo, versión o contexto."></textarea></label></div>`;
    openPremiumModal({ title, subtitle, body, actions: [
      { label: "Cancelar", value: null, className: "ghost" },
      { label: "Guardar recursos", className: "primary", loadingLabel: "Subiendo…", onClick: async () => {
        const files = selectedFiles("v179ModalFiles"), links = parseLinks(document.getElementById("v179ModalLinks")?.value || "");
        if (!files.length && !links.length) throw new Error("Selecciona un archivo o agrega un enlace.");
        await addAttachments({ entityType, entityId, category, submissionId, files, links, notes: document.getElementById("v179ModalNotes")?.value?.trim() || "" });
        notify("Recursos guardados", "Los usuarios autorizados ya pueden abrirlos.", "success");
        return true;
      } }
    ] });
    requestAnimationFrame(bindFilePreviews);
  }

  function deliveryModal(taskId) {
    const task = taskById(taskId); if (!task) return;
    const body = `<div class="v179-modal-grid"><div class="v179-delivery-summary"><strong>${escHtml(task.title || "Tarea")}</strong><span>${escHtml(participantNames(taskId).join(" · ") || memberNameById(task.assigned_to))}</span></div>${fileInputMarkup("v179DeliveryFiles", "Archivos realizados")}${linksInputMarkup("v179DeliveryLinks", "Links de la entrega")}<label class="v179-field full"><span>Comentario de entrega</span><textarea id="v179DeliveryComment" rows="4" placeholder="Explica qué realizaste, qué debe revisar el jefe y si existe alguna consideración."></textarea></label><label class="v179-confirm full"><input id="v179DeliveryConfirm" type="checkbox"><span>Confirmo que la entrega está lista para revisión.</span></label></div>`;
    openPremiumModal({ title: "Presentar tarea", subtitle: "Hasta 3 archivos de 25 MB y 5 enlaces", body, actions: [
      { label: "Cancelar", value: null, className: "ghost" },
      { label: "Enviar a revisión", className: "primary", loadingLabel: "Enviando…", onClick: async () => {
        if (!document.getElementById("v179DeliveryConfirm")?.checked) throw new Error("Confirma que la entrega está lista para revisión.");
        const files = selectedFiles("v179DeliveryFiles"), links = parseLinks(document.getElementById("v179DeliveryLinks")?.value || "");
        await createSubmission(taskId, { comment: document.getElementById("v179DeliveryComment")?.value?.trim() || "", files, links });
        notify("Entrega enviada", "Los jefes ya pueden revisar archivos, hora y ejecutor.", "success");
        return true;
      } }
    ] });
    requestAnimationFrame(bindFilePreviews);
  }

  function progressModal(taskId, preset = "") {
    const task = taskById(taskId); if (!task) return;
    const current = preset || (typeof v412StatusKey === "function" ? v412StatusKey(task.status) : task.status) || "pendiente";
    const body = `<div class="v179-modal-grid"><label class="v179-field"><span>Nuevo estado</span><select id="v179ProgressStatus"><option value="pendiente" ${current === "pendiente" ? "selected" : ""}>Pendiente</option><option value="en_proceso" ${current === "en_proceso" ? "selected" : ""}>En ejecución</option><option value="corregido" ${current === "corregido" ? "selected" : ""}>Corregida</option><option value="en_revision" ${current === "en_revision" ? "selected" : ""}>En revisión</option></select></label><label class="v179-field full"><span>Enlace de avance opcional</span><input id="v179ProgressEvidence" type="url" value="${escHtml(task.evidence_url || "")}" placeholder="https://..."></label><label class="v179-field full"><span>Comentario</span><textarea id="v179ProgressComment" rows="4" placeholder="Qué cambió, qué está listo y cuál es el siguiente paso"></textarea></label></div>`;
    openPremiumModal({ title: preset === "corregido" ? "Registrar corrección" : "Actualizar progreso", subtitle: task.title || "Tarea", body, actions: [
      { label: "Cancelar", value: null, className: "ghost" },
      { label: "Guardar", className: "primary", loadingLabel: "Guardando…", onClick: async () => {
        const evidence = document.getElementById("v179ProgressEvidence")?.value?.trim() || "";
        if (evidence) parseLinks(evidence);
        await updateTaskStatus(taskId, document.getElementById("v179ProgressStatus")?.value || "en_proceso", evidence, document.getElementById("v179ProgressComment")?.value?.trim() || "Progreso actualizado");
        if (typeof loadAll === "function") await loadAll(); await refreshWorkspace(); renderAffectedViews();
        notify("Progreso actualizado", "El equipo ya ve el nuevo estado.", "success");
        return true;
      } }
    ] });
  }

  function scoreSelect(name, memberId, criterion) {
    return `<select data-v179-score-member="${escHtml(memberId)}" data-v179-score="${criterion}"><option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>`;
  }
  function collectScores() {
    const result = [];
    document.querySelectorAll("[data-v179-score-row]").forEach((row) => {
      const memberId = row.dataset.v179ScoreRow;
      const score = { member_id: memberId };
      let has = false;
      for (const criterion of ["quality", "timeliness", "collaboration", "communication"]) {
        const value = row.querySelector(`[data-v179-score="${criterion}"]`)?.value;
        score[criterion] = value ? Number(value) : null;
        if (value) has = true;
      }
      if (has) result.push(score);
    });
    return result;
  }

  async function reviewTaskEnhanced(taskId, decision) {
    const task = taskById(taskId); if (!task) return;
    const observe = decision === "observe";
    const people = participantIds(taskId).length ? participantIds(taskId) : [task.v179_primary_assigned_to || task.assigned_to].filter(Boolean);
    const scoreMarkup = (observe || !latestSubmission(taskId)) ? "" : `<section class="v179-score-block"><div><h4>Puntaje opcional por miembro</h4><p>Escala de 1 a 5. Solo se guardan los criterios seleccionados.</p></div><div class="v179-score-table"><div class="head"><span>Miembro</span><span>Calidad</span><span>Plazo</span><span>Colaboración</span><span>Comunicación</span></div>${people.map((memberId) => `<div class="row" data-v179-score-row="${escHtml(memberId)}"><strong>${escHtml(memberNameById(memberId))}</strong>${scoreSelect("", memberId, "quality")}${scoreSelect("", memberId, "timeliness")}${scoreSelect("", memberId, "collaboration")}${scoreSelect("", memberId, "communication")}</div>`).join("")}</div></section>`;
    const body = `<div class="v179-modal-grid"><div class="v179-review-preview"><strong>${escHtml(task.title || "Tarea")}</strong><span>${escHtml(participantNames(taskId).join(" · ") || memberNameById(task.assigned_to))}</span><p>${escHtml(str(task.description).slice(0, 260))}</p></div><label class="v179-field full"><span>${observe ? "Observación obligatoria" : "Comentario de aprobación"}</span><textarea id="v179ReviewComment" rows="4" placeholder="${observe ? "Indica exactamente qué debe corregirse." : "Describe brevemente tu revisión."}"></textarea></label>${scoreMarkup}</div>`;
    openPremiumModal({ title: observe ? "Observar entrega" : "Validar y puntuar", subtitle: "La decisión quedará en el historial", body, actions: [
      { label: "Cancelar", value: null, className: "ghost" },
      { label: observe ? "Enviar observación" : "Validar entrega", className: observe ? "danger" : "primary", loadingLabel: "Registrando…", onClick: async () => {
        const comment = document.getElementById("v179ReviewComment")?.value?.trim() || "";
        if (observe && !comment) throw new Error("Escribe la observación que debe corregirse.");
        const existing = await callRpc("ibm_v32_review_task", { p_task_id: taskId, p_decision: decision, p_comment: comment });
        if (existing.error) throw existing.error;
        await checkCloud();
        let reviewAddonWarning = "";
        if (cloudAvailable) {
          const submission = latestSubmission(taskId);
          if (submission?.id) {
            try {
              const { error } = await callRpc("ibm_v179_review_submission", { p_task_id: taskId, p_submission_id: submission.id, p_decision: decision, p_comment: comment, p_scores: collectScores() });
              if (error) throw error;
            } catch (error) {
              reviewAddonWarning = error?.message || "No se pudo guardar el puntaje adicional.";
              console.warn("[v17.9] La decisión productiva se guardó, pero falló el complemento de entrega/puntaje.", error);
            }
          }
        }
        if (typeof loadAll === "function") await loadAll(); await refreshWorkspace(); renderAffectedViews();
        notify("Revisión registrada", reviewAddonWarning ? `La decisión se guardó. Complemento pendiente: ${reviewAddonWarning}` : (observe ? "La observación fue enviada." : "La validación y los puntajes fueron guardados."), reviewAddonWarning ? "warning" : "success");
        return true;
      } }
    ] });
  }

  function participantMarkup(taskId) {
    const ids = participantIds(taskId);
    if (!ids.length) return "";
    return `<section class="v179-detail-section"><div class="v179-section-head"><div><span>EQUIPO ASIGNADO</span><h4>${ids.length} ejecutor${ids.length === 1 ? "" : "es"}</h4></div></div><div class="v179-participants">${ids.map((id, index) => `<button type="button" data-v179-member="${escHtml(id)}"><i>${escHtml((memberNameById(id).match(/\b\w/g) || []).slice(0, 2).join(""))}</i><span><strong>${escHtml(memberNameById(id))}</strong><small>${index === 0 ? "Ejecutor principal" : "Co-ejecutor"}</small></span></button>`).join("")}</div></section>`;
  }
  function referenceMarkup(entityType, entityId, canAdd = false) {
    const items = attachmentsFor(entityType, entityId, "reference");
    return `<section class="v179-detail-section"><div class="v179-section-head"><div><span>REFERENCIAS</span><h4>Archivos, documentos y links</h4></div><div><b>${items.length}</b>${canAdd ? `<button type="button" data-v179-add-reference="${entityType}:${escHtml(entityId)}">Agregar</button>` : ""}</div></div>${attachmentRowsMarkup(items, "Todavía no hay referencias adjuntas.")}</section>`;
  }
  function submissionsMarkup(taskId) {
    const list = submissionsFor(taskId);
    if (!list.length) return `<section class="v179-detail-section"><div class="v179-section-head"><div><span>ENTREGAS</span><h4>Presentaciones del equipo</h4></div><b>0</b></div><div class="v179-empty">Todavía no se enviaron entregas colaborativas.</div></section>`;
    return `<section class="v179-detail-section"><div class="v179-section-head"><div><span>ENTREGAS</span><h4>Quién entregó y cuándo</h4></div><b>${list.length}</b></div><div class="v179-submissions">${list.map((submission) => { const files = submissionAttachments(submission.id); return `<article><div class="v179-submission-head"><div><strong>${escHtml(memberNameById(submission.submitted_by))}</strong><span>${formatDate(submission.submitted_at || submission.created_at)}</span></div><span class="v179-status ${escHtml(submission.status || "submitted")}">${escHtml(submission.status || "submitted")}</span></div><p>${escHtml(submission.comment || "Sin comentario")}</p>${attachmentRowsMarkup(files, "Entrega sin archivos registrados.")}</article>`; }).join("")}</div></section>`;
  }
  function scoreMarkup(taskId) {
    const list = reviewsFor(taskId);
    if (!list.length) return "";
    const average = Math.round(list.reduce((sum, row) => sum + (Number(row.overall_score) || 0), 0) / Math.max(1, list.filter((row) => row.overall_score != null).length));
    return `<section class="v179-detail-section"><div class="v179-section-head"><div><span>EVALUACIÓN</span><h4>Puntajes registrados</h4></div><b>${Number.isFinite(average) ? `${average}/100` : "—"}</b></div><div class="v179-score-cards">${list.map((row) => `<article><strong>${escHtml(memberNameById(row.member_id))}</strong><b>${row.overall_score == null ? "Sin puntaje" : `${row.overall_score}/100`}</b><span>${escHtml(memberNameById(row.reviewer_id))} · ${formatDate(row.created_at)}</span>${row.comment ? `<p>${escHtml(row.comment)}</p>` : ""}</article>`).join("")}</div></section>`;
  }

  function enhanceOpenTask(taskId) {
    const host = document.getElementById("premiumModalBody");
    const detail = host?.querySelector(".v66-task-detail");
    if (!detail || detail.querySelector(".v179-detail-section")) return;
    const task = taskById(taskId); if (!task) return;
    const description = detail.querySelector(".v66-detail-section");
    const wrapper = document.createElement("div");
    wrapper.className = "v179-task-extension";
    wrapper.innerHTML = `${participantMarkup(taskId)}${referenceMarkup("task", taskId, isManager())}${submissionsMarkup(taskId)}${scoreMarkup(taskId)}`;
    description?.insertAdjacentElement("afterend", wrapper);
    const dock = detail.querySelector(".v66-action-dock");
    if (dock) {
      const deliver = dock.querySelector('[data-v66-task-action="deliver"]'); if (deliver) deliver.textContent = "Presentar entrega";
      const attach = dock.querySelector('[data-v66-task-action="attach"]'); if (attach) attach.textContent = isManager() ? "Agregar referencia" : "Presentar archivos";
      if (isTaskParticipant(taskId) && !dock.querySelector("[data-v179-deliver]")) dock.insertAdjacentHTML("beforeend", `<button type="button" class="primary" data-v179-deliver="${escHtml(taskId)}">Nueva entrega</button>`);
    }
    bindDynamicActions(host);
  }

  function enhanceOpenCampaign(campaignId) {
    const host = document.getElementById("premiumModalBody");
    const detail = host?.querySelector(".v66-campaign-detail");
    if (!detail || detail.querySelector(".v179-campaign-extension")) return;
    const briefs = arr(getState()?.briefs).filter((brief) => same(brief.campaign_id, campaignId));
    const extension = document.createElement("div");
    extension.className = "v179-campaign-extension";
    extension.innerHTML = `${referenceMarkup("campaign", campaignId, isManager())}<section class="v179-detail-section"><div class="v179-section-head"><div><span>BRIEFS</span><h4>Referencias por brief</h4></div><b>${briefs.length}</b></div><div class="v179-brief-list">${briefs.length ? briefs.map((brief) => `<article><div><strong>${escHtml(brief.title || "Brief")}</strong><span>${escHtml(str(brief.objective).slice(0, 120) || "Sin objetivo")}</span></div>${attachmentRowsMarkup(attachmentsFor("brief", brief.id, "reference"), "Sin referencias")}${isManager() ? `<button type="button" data-v179-add-brief-reference="${escHtml(brief.id)}">Agregar referencias</button>` : ""}</article>`).join("") : `<div class="v179-empty">Todavía no hay briefs en esta campaña.</div>`}</div></section>`;
    detail.querySelector(".v66-action-dock")?.insertAdjacentElement("beforebegin", extension);
    bindDynamicActions(host);
  }

  function bindDynamicActions(root = document) {
    root.querySelectorAll("[data-v179-open-attachment]").forEach((button) => { if (button.dataset.bound) return; button.dataset.bound = "1"; button.addEventListener("click", () => openAttachment(button.dataset.v179OpenAttachment).catch((error) => notify("No se pudo abrir", error.message, "error"))); });
    root.querySelectorAll("[data-v179-member]").forEach((button) => { if (button.dataset.bound) return; button.dataset.bound = "1"; button.addEventListener("click", () => { try { closePremiumModal(); openMemberProfile(button.dataset.v179Member); } catch (_) {} }); });
    root.querySelectorAll("[data-v179-add-reference]").forEach((button) => { if (button.dataset.bound) return; button.dataset.bound = "1"; button.addEventListener("click", () => { const [entityType, entityId] = button.dataset.v179AddReference.split(":"); entityAttachmentModal({ entityType, entityId, category: "reference", title: "Agregar referencias" }); }); });
    root.querySelectorAll("[data-v179-add-brief-reference]").forEach((button) => { if (button.dataset.bound) return; button.dataset.bound = "1"; button.addEventListener("click", () => entityAttachmentModal({ entityType: "brief", entityId: button.dataset.v179AddBriefReference, category: "reference", title: "Referencias del brief" })); });
    root.querySelectorAll("[data-v179-deliver]").forEach((button) => { if (button.dataset.bound) return; button.dataset.bound = "1"; button.addEventListener("click", () => { closePremiumModal(); setTimeout(() => deliveryModal(button.dataset.v179Deliver), 20); }); });
    root.querySelectorAll("[data-v179-open-task]").forEach((button) => { if (button.dataset.bound) return; button.dataset.bound = "1"; button.addEventListener("click", () => v412OpenTask(button.dataset.v179OpenTask)); });
  }

  function decorateTaskCards() {
    document.querySelectorAll("[data-task-id]").forEach((card) => {
      const taskId = card.dataset.taskId, count = participantIds(taskId).length;
      if (count > 1 && !card.querySelector(".v179-team-badge")) card.insertAdjacentHTML("beforeend", `<span class="v179-team-badge">Equipo · ${count}</span>`);
    });
  }

  function dashboardSubmissions() {
    const list = arr(workspace.submissions).slice().sort((a, b) => str(b.submitted_at || b.created_at).localeCompare(str(a.submitted_at || a.created_at)));
    return isManager() ? list.slice(0, 8) : list.filter((item) => same(item.submitted_by, getMember()?.id)).slice(0, 6);
  }
  function dashboardMarkup(title, stableId = "v179DeliveryDashboard") {
    const list = dashboardSubmissions();
    return `<section class="v179-dashboard" id="${escHtml(stableId)}"><div class="v179-dashboard-head"><div><span>WORK 360 · ENTREGAS</span><h3>${escHtml(title)}</h3><p>${isManager() ? "Revisa quién entregó, cuándo y cuántos archivos presentó." : "Consulta tus entregas recientes y su estado de revisión."}</p></div><b>${list.length}</b></div><div class="v179-dashboard-list">${list.length ? list.map((submission) => { const task = taskById(submission.task_id), files = submissionAttachments(submission.id); return `<button type="button" data-v179-open-task="${escHtml(submission.task_id)}"><span class="v179-avatar">${escHtml((memberNameById(submission.submitted_by).match(/\b\w/g) || []).slice(0,2).join(""))}</span><span><strong>${escHtml(task?.title || "Tarea")}</strong><small>${escHtml(memberNameById(submission.submitted_by))} · ${formatDate(submission.submitted_at || submission.created_at)}</small></span><em>${files.length} recurso${files.length === 1 ? "" : "s"}</em><i class="v179-status ${escHtml(submission.status || "submitted")}">${escHtml(submission.status || "submitted")}</i></button>`; }).join("") : `<div class="v179-empty">Todavía no hay entregas registradas.</div>`}</div></section>`;
  }
  function injectHomeDashboard() {
    const home = document.getElementById("home"); if (!home || document.getElementById("v179HomeDeliveryDashboard")) return;
    const target = home.querySelector(".v47-wrap,.mz-home-shell,.v412-home") || home;
    const container = document.createElement("div"); container.innerHTML = dashboardMarkup(isManager() ? "Entregas del equipo" : "Mis entregas recientes", "v179HomeDeliveryDashboard");
    const section = container.firstElementChild;
    target.appendChild(section); bindDynamicActions(section);
  }
  function injectWork360Dashboard() {
    const target = document.getElementById("workSummary") || document.getElementById("workIntel");
    if (!target || target.querySelector("#v179Work360DeliveryDashboard")) return;
    const container = document.createElement("div"); container.innerHTML = dashboardMarkup("Entregas recientes", "v179Work360DeliveryDashboard"); target.appendChild(container.firstElementChild); bindDynamicActions(target);
  }
  function injectMemberScore() {
    const profileStats = document.getElementById("memberProfileStats");
    if (!profileStats || profileStats.querySelector("[data-v179-member-score]")) return;
    let targetId = null;
    try { targetId = currentProfileMemberId || getMember()?.id; } catch (_) { targetId = getMember()?.id; }
    const rows = arr(workspace.reviews).filter((review) => same(review.member_id, targetId) && review.overall_score != null);
    if (!rows.length) return;
    const average = Math.round(rows.reduce((sum, row) => sum + Number(row.overall_score || 0), 0) / rows.length);
    profileStats.insertAdjacentHTML("beforeend", `<div class="profile-stat" data-v179-member-score><span class="small">Puntaje de entregas</span><br><strong>${average}</strong><span class="small"> / 100</span></div>`);
  }

  function wrapFunctions() {
    const names = ["renderHome", "renderTasks", "renderMyDay", "renderApprovals", "renderCampaigns", "renderV356", "renderMemberProfile"];
    for (const name of names) {
      const original = window[name]; if (typeof original !== "function" || original.__v179Wrapped) continue;
      baseFunctions[name] = original;
      const wrapped = function (...args) {
        mergeWorkspaceIntoState();
        const result = original.apply(this, args);
        queueMicrotask(() => {
          ensureFormEnhancements(); decorateTaskCards();
          if (name === "renderHome") injectHomeDashboard();
          if (name === "renderV356") injectWork360Dashboard();
          if (name === "renderMemberProfile") injectMemberScore();
        });
        return result;
      };
      wrapped.__v179Wrapped = true; window[name] = wrapped;
    }

    if (typeof window.v412OpenTask === "function" && !window.v412OpenTask.__v179Wrapped) {
      const original = window.v412OpenTask;
      const wrapped = function (id) { const result = original.apply(this, arguments); setTimeout(() => enhanceOpenTask(id), 30); return result; };
      wrapped.__v179Wrapped = true; window.v412OpenTask = wrapped;
    }
    if (typeof window.v413OpenCampaign === "function" && !window.v413OpenCampaign.__v179Wrapped) {
      const original = window.v413OpenCampaign;
      const wrapped = function (id) { const result = original.apply(this, arguments); setTimeout(() => enhanceOpenCampaign(id), 30); return result; };
      wrapped.__v179Wrapped = true; window.v413OpenCampaign = wrapped;
    }
    window.v66OpenDeliveryModal = deliveryModal;
    window.v66OpenProgressModal = progressModal;
    window.v66OpenAttachModal = (taskId) => isManager() ? entityAttachmentModal({ entityType: "task", entityId: taskId, category: "reference", title: "Agregar referencias a la tarea" }) : deliveryModal(taskId);
    window.reviewTask = reviewTaskEnhanced;
    wrapQuickCreateModals();
  }

  function wrapQuickCreateModals() {
    window.v66QuickTaskModal = function (campaignId = "") {
      const body = `<div class="v179-modal-grid"><label class="v179-field full"><span>Título</span><input id="v179QuickTaskTitle" required placeholder="Qué debe realizarse"></label><label class="v179-field full"><span>Ejecutores</span>${memberPickerMarkup("v179QuickTaskAssignees", [getMember()?.id])}</label><label class="v179-field"><span>Prioridad</span><select id="v179QuickTaskPriority"><option value="alta">Alta</option><option value="media" selected>Media</option><option value="baja">Baja</option></select></label><label class="v179-field"><span>Campaña</span><select id="v179QuickTaskCampaign"><option value="">Sin campaña</option>${arr(getState()?.campaigns).map((c) => `<option value="${escHtml(c.id)}" ${same(c.id, campaignId) ? "selected" : ""}>${escHtml(c.name)}</option>`).join("")}</select></label><label class="v179-field"><span>Fecha</span><input id="v179QuickTaskDue" type="date"></label><label class="v179-field"><span>Hora</span><input id="v179QuickTaskTime" type="time"></label><label class="v179-field full"><span>Descripción</span><textarea id="v179QuickTaskDescription" rows="3"></textarea></label><label class="v179-field full"><span>Checklist</span><textarea id="v179QuickTaskChecklist" rows="3" placeholder="Un elemento por línea"></textarea></label>${fileInputMarkup("v179QuickTaskFiles", "Archivos de referencia")}${linksInputMarkup("v179QuickTaskLinks", "Links de referencia")}</div>`;
      openPremiumModal({ title: "Nueva tarea colaborativa", subtitle: "Asigna a una o varias personas", body, actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Crear tarea", className: "primary", loadingLabel: "Creando…", onClick: async () => {
          const title = document.getElementById("v179QuickTaskTitle")?.value?.trim(); if (!title) throw new Error("Escribe un título.");
          const assignees = checkedMemberIds("v179QuickTaskAssignees"); if (!assignees.length) throw new Error("Selecciona al menos un ejecutor.");
          const files = selectedFiles("v179QuickTaskFiles"), links = parseLinks(document.getElementById("v179QuickTaskLinks")?.value || ""); validateFiles(files); await checkCloud(true);
          if (!cloudAvailable && (assignees.length > 1 || files.length || links.length)) throw new Error(cloudUnavailableMessage());
          const primary = assignees[0], person = memberById(primary);
          const taskId = await createLegacyEntity({ rpc: "ibm_v30_create_task", params: { p_title: title, p_description: document.getElementById("v179QuickTaskDescription")?.value?.trim() || "", p_assigned_to: primary, p_client_id: null, p_area_id: person?.area_id || getMember()?.area_id || null, p_campaign_id: document.getElementById("v179QuickTaskCampaign")?.value || null, p_due_date: document.getElementById("v179QuickTaskDue")?.value || null, p_due_time: document.getElementById("v179QuickTaskTime")?.value || null, p_priority: document.getElementById("v179QuickTaskPriority")?.value || "media", p_impact: 3, p_checklist: str(document.getElementById("v179QuickTaskChecklist")?.value).split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean) }, collection: "tasks", matcher: (task) => task.title === title && same(task.assigned_to, primary), idKeys: ["id", "task_id"] });
          await setTaskParticipants(taskId, assignees); if (files.length || links.length) await addAttachments({ entityType: "task", entityId: taskId, category: "reference", files, links, notes: "Referencias de la tarea" });
          window.dispatchEvent(new CustomEvent("inbestiga:task-created", { detail: { taskId, source: "quick", assignees } }));
          await refreshWorkspace(); if (typeof renderAll === "function") await renderAll(); notify("Tarea creada", "Todos los ejecutores ya pueden verla.", "success"); return true;
        } }
      ] });
      requestAnimationFrame(bindFilePreviews);
    };

    window.v66QuickCampaignModal = function () {
      const body = `<div class="v179-modal-grid"><label class="v179-field full"><span>Nombre</span><input id="v179QuickCampaignName" required placeholder="Nombre del proyecto o campaña"></label><label class="v179-field"><span>Cliente</span><select id="v179QuickCampaignClient"><option value="">Sin cliente</option>${arr(getState()?.clients).map((c) => `<option value="${escHtml(c.id)}">${escHtml(c.name || c.company_name || "Cliente")}</option>`).join("")}</select></label><label class="v179-field"><span>Área</span><select id="v179QuickCampaignArea"><option value="">Sin área</option>${arr(getState()?.areas).map((a) => `<option value="${escHtml(a.id)}">${escHtml(a.name || a.title || "Área")}</option>`).join("")}</select></label><label class="v179-field"><span>Inicio</span><input id="v179QuickCampaignStart" type="date"></label><label class="v179-field"><span>Fin</span><input id="v179QuickCampaignEnd" type="date"></label><label class="v179-field full"><span>Objetivo</span><textarea id="v179QuickCampaignObjective" rows="3"></textarea></label>${fileInputMarkup("v179QuickCampaignFiles", "Archivos de referencia")}${linksInputMarkup("v179QuickCampaignLinks", "Links de referencia")}</div>`;
      openPremiumModal({ title: "Nuevo proyecto / campaña", subtitle: "Crea el espacio con sus referencias", body, actions: [
        { label: "Cancelar", value: null, className: "ghost" },
        { label: "Crear proyecto", className: "primary", loadingLabel: "Creando…", onClick: async () => {
          const name = document.getElementById("v179QuickCampaignName")?.value?.trim(); if (!name) throw new Error("Escribe un nombre.");
          const files = selectedFiles("v179QuickCampaignFiles"), links = parseLinks(document.getElementById("v179QuickCampaignLinks")?.value || ""); validateFiles(files); await checkCloud(true);
          if (!cloudAvailable && (files.length || links.length)) throw new Error(cloudUnavailableMessage());
          const campaignId = await createLegacyEntity({ rpc: "ibm_v30_create_campaign", params: { p_name: name, p_client_id: document.getElementById("v179QuickCampaignClient")?.value || null, p_area_id: document.getElementById("v179QuickCampaignArea")?.value || null, p_status: "planificacion", p_start_date: document.getElementById("v179QuickCampaignStart")?.value || null, p_end_date: document.getElementById("v179QuickCampaignEnd")?.value || null, p_objective: document.getElementById("v179QuickCampaignObjective")?.value?.trim() || "", p_audience: "", p_main_message: "" }, collection: "campaigns", matcher: (campaign) => campaign.name === name, idKeys: ["id", "campaign_id"] });
          if (files.length || links.length) await addAttachments({ entityType: "campaign", entityId: campaignId, category: "reference", files, links, notes: "Referencias del proyecto" });
          await refreshWorkspace(); if (typeof renderAll === "function") await renderAll(); notify("Proyecto creado", "Las referencias quedaron vinculadas.", "success"); return true;
        } }
      ] });
      requestAnimationFrame(bindFilePreviews);
    };
  }

  function renderAffectedViews() {
    mergeWorkspaceIntoState();
    try { if (typeof renderHome === "function") renderHome(); } catch (_) {}
    try { if (typeof renderTasks === "function") renderTasks(); } catch (_) {}
    try { if (typeof renderMyDay === "function") renderMyDay(); } catch (_) {}
    try { if (typeof renderApprovals === "function") renderApprovals(); } catch (_) {}
    try { if (typeof renderCampaigns === "function") renderCampaigns(); } catch (_) {}
    try { if (typeof renderV356 === "function") renderV356(); } catch (_) {}
    setTimeout(() => { ensureFormEnhancements(); decorateTaskCards(); injectHomeDashboard(); injectWork360Dashboard(); bindDynamicActions(); }, 20);
  }

  function subscribeRealtime() {
    const client = getSb(); if (!cloudAvailable || !client?.channel || realtimeChannel) return;
    try {
      realtimeChannel = client.channel(`inbestiga-v179-${getAuthUser()?.id || Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "marketing_app", table: "task_participants" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "marketing_app", table: "work_item_attachments" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "marketing_app", table: "task_submissions" }, scheduleRefresh)
        .on("postgres_changes", { event: "*", schema: "marketing_app", table: "task_reviews" }, scheduleRefresh)
        .subscribe();
    } catch (error) { console.warn("[v17.9] Realtime opcional no disponible", error); }
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshWorkspace({ render: true }), 350);
  }

  function bindGlobalActions() {
    document.addEventListener("click", (event) => {
      const open = event.target.closest("[data-v179-open-attachment]");
      if (open) { event.preventDefault(); openAttachment(open.dataset.v179OpenAttachment).catch((error) => notify("No se pudo abrir", error.message, "error")); }
    });
  }

  async function init() {
    if (initialized) return;
    const ready = getState()?.member || getMember()?.id;
    if (!ready) { setTimeout(init, 250); return; }
    initialized = true;
    wrapFunctions(); bindSubmitInterceptors(); bindGlobalActions();
    await checkCloud(); await refreshWorkspace(); subscribeRealtime();
    ensureFormEnhancements(); renderAffectedViews();
    setInterval(() => { if (document.visibilityState === "visible") refreshWorkspace({ render: false }).then(() => { mergeWorkspaceIntoState(); decorateTaskCards(); injectHomeDashboard(); injectWork360Dashboard(); }); }, 30000);
    window.INBESTIGA_V179 = { version: "v17.9.1", refresh: refreshWorkspace, workspace: () => workspace, openAttachment, deliveryModal, entityAttachmentModal, checkCloud: () => checkCloud(true), diagnostics: () => ({ cloudAvailable, cloudChecked, lastCheckedAt: cloudLastCheckedAt, lastError: rpcErrorText(cloudLastError) }) };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
