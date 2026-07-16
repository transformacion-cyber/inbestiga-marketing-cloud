/* ===== INBESTIGA v17.10.1 · VERSION & PWA DIAGNOSTIC HOTFIX ===== */
(() => {
  "use strict";

  const VERSION = "v17.10.1";
  const DEMO_NAMES = new Set(["member", "eleam", "italo", "juan", "mayito"]);
  const MANAGER_ROLES = new Set(["italo", "jhulio", "alejandro", "director", "admin", "administrator", "supervisor"]);
  const hiddenMembers = new Map();
  const wrapped = new Set();
  let backendChecked = false;
  let backendReady = false;
  let governanceBound = false;
  let selectedPreview = null;
  let enhancementScheduled = false;
  let rosterChanged = false;
  let accessRevocationInProgress = false;

  const arr = (value) => Array.isArray(value) ? value : [];
  const str = (value) => String(value ?? "");
  const same = (a, b) => str(a) === str(b);
  const lower = (value) => str(value).trim().toLowerCase();
  const escHtml = (value) => {
    try { if (typeof window.esc === "function") return window.esc(value); } catch (_) {}
    return str(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  };
  const getState = () => { try { return typeof state !== "undefined" ? state : null; } catch (_) { return null; } };
  const getMember = () => { try { return typeof member !== "undefined" ? member : null; } catch (_) { return null; } };
  const getSb = () => { try { return typeof sb !== "undefined" ? sb : null; } catch (_) { return null; } };
  const isManager = () => MANAGER_ROLES.has(lower(getMember()?.role_code)) || (() => { try { return typeof isSupervisor === "function" && isSupervisor(); } catch (_) { return false; } })();
  const roleRank = (role) => ({ italo: 100, director: 100, admin: 100, administrator: 100, jhulio: 80, alejandro: 60, supervisor: 60, member: 10, guest: 0 }[lower(role)] ?? 10);
  const canManagePerson = (person) => {
    if (!person?.id || same(person.id, getMember()?.id)) return false;
    const actorRole = lower(getMember()?.role_code);
    if (actorRole === "italo") return true;
    return roleRank(actorRole) > roleRank(person.role_code);
  };
  const notify = (title, detail = "", tone = "success") => {
    if (typeof window.premiumToast === "function") return window.premiumToast(title, detail, tone);
    if (typeof window.toast === "function") return window.toast(title, detail);
    console[tone === "error" ? "error" : "log"](`[${VERSION}] ${title}`, detail);
  };

  function memberScore(person) {
    let score = 0;
    if (person?.auth_user_id) score += 100;
    if (lower(person?.status || "active") === "active") score += 30;
    const words = str(person?.full_name).trim().split(/\s+/).filter(Boolean).length;
    score += Math.min(words, 5) * 5;
    if (person?.email) score += 5;
    if (!DEMO_NAMES.has(lower(person?.full_name))) score += 20;
    return score;
  }

  function isLegacyDemo(person) {
    const name = lower(person?.full_name);
    return DEMO_NAMES.has(name) && name.split(/\s+/).length === 1;
  }

  function isVisibleMember(person) {
    if (!person?.id) return false;
    if (same(person.id, getMember()?.id)) return true;
    const status = lower(person.status || "active");
    if (["inactive", "deleted", "removed", "archived"].includes(status)) return false;
    if (!person.auth_user_id) return false;
    if (isLegacyDemo(person)) return false;
    return true;
  }

  function pruneMembers() {
    const app = getState();
    if (!app || !Array.isArray(app.members)) { rosterChanged = false; return []; }
    const beforeSignature = app.members.map((person) => `${person?.id || ""}:${person?.status || ""}:${person?.auth_user_id || ""}`).sort().join("|");
    const combined = new Map();
    for (const person of [...hiddenMembers.values(), ...app.members]) {
      if (person?.id) combined.set(str(person.id), person);
    }
    const byEmail = new Map();
    const hidden = [];
    const visible = [];
    const ordered = [...combined.values()].sort((a, b) => memberScore(b) - memberScore(a));
    for (const person of ordered) {
      const emailKey = lower(person.email);
      const duplicate = emailKey && byEmail.has(emailKey);
      if (duplicate || !isVisibleMember(person)) hidden.push(person);
      else {
        visible.push(person);
        if (emailKey) byEmail.set(emailKey, person.id);
      }
    }
    hiddenMembers.clear();
    hidden.forEach((person) => hiddenMembers.set(str(person.id), person));
    app.members = visible.sort((a, b) => str(a.full_name).localeCompare(str(b.full_name), "es"));
    const afterSignature = app.members.map((person) => `${person?.id || ""}:${person?.status || ""}:${person?.auth_user_id || ""}`).sort().join("|");
    rosterChanged = beforeSignature !== afterSignature;
    return app.members;
  }

  async function enforceCurrentMemberAccess() {
    const current = getMember();
    if (!current?.id || accessRevocationInProgress) return true;
    const active = lower(current.status || "active") === "active";
    const validIdentity = !!current.auth_user_id && !isLegacyDemo(current);
    if (active && validIdentity) return true;
    accessRevocationInProgress = true;
    notify("Acceso desactivado", "Este perfil ya no está habilitado como miembro oficial de Marketing Cloud.", "warning");
    try { await getSb()?.auth?.signOut?.(); } catch (_) {}
    setTimeout(() => { try { window.location.reload(); } catch (_) {} }, 450);
    return false;
  }

  function allKnownMembers() {
    const merged = new Map();
    arr(getState()?.members).forEach((person) => merged.set(str(person.id), person));
    [...hiddenMembers.values()].forEach((person) => merged.set(str(person.id), person));
    return [...merged.values()];
  }

  function officialMembers(excludeId = "") {
    return arr(getState()?.members).filter((person) => !excludeId || !same(person.id, excludeId));
  }

  function taskById(id) { return arr(getState()?.tasks).find((task) => same(task?.id, id)); }
  function taskDone(task) {
    try { if (typeof window.v412TaskDone === "function") return !!window.v412TaskDone(task); } catch (_) {}
    return ["aprobado", "publicado", "completado", "finalizado", "done", "hecho"].includes(lower(task?.status));
  }
  function taskAwaitingReview(task) {
    try { if (typeof window.v412TaskAwaitingReview === "function") return !!window.v412TaskAwaitingReview(task); } catch (_) {}
    return ["en_revision", "corregido"].includes(lower(task?.status).replaceAll(" ", "_"));
  }

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDeadline(task) {
    if (!task?.due_date) return null;
    const time = /^\d{2}:\d{2}/.test(str(task.due_time)) ? str(task.due_time).slice(0, 5) : "23:59";
    const value = new Date(`${task.due_date}T${time}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  function deadlineInfo(task) {
    if (!task?.due_date) return { className: "missing", label: "Sin deadline", detail: "La tarea no tiene fecha límite." };
    const due = parseDeadline(task);
    if (!due) return { className: "missing", label: "Deadline inválido", detail: str(task.due_date) };
    const done = taskDone(task);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    const dateLabel = due.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: due.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
    const timeLabel = /^\d{2}:\d{2}/.test(str(task.due_time)) ? ` · ${str(task.due_time).slice(0, 5)}` : "";
    if (done) return { className: "done", label: `Deadline ${dateLabel}${timeLabel}`, detail: "Tarea aprobada o completada.", due };
    if (taskAwaitingReview(task)) return { className: "review", label: "En revisión", detail: `Entrega enviada. Deadline original: ${dateLabel}${timeLabel}`, due };
    if (diff < 0) {
      const hours = Math.max(1, Math.ceil(Math.abs(diff) / 3600000));
      const relative = hours < 24 ? `${hours} h` : `${Math.ceil(hours / 24)} d`;
      return { className: "overdue", label: `Vencida hace ${relative}`, detail: `${dateLabel}${timeLabel}`, due };
    }
    const today = localDateKey(now), tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
    const tomorrow = localDateKey(tomorrowDate);
    if (task.due_date === today) return { className: "today", label: `Hoy${timeLabel}`, detail: `${dateLabel}${timeLabel}`, due };
    if (task.due_date === tomorrow) return { className: "soon", label: `Mañana${timeLabel}`, detail: `${dateLabel}${timeLabel}`, due };
    if (diff <= 3 * 86400000) return { className: "soon", label: `${dateLabel}${timeLabel}`, detail: "Deadline próximo.", due };
    return { className: "", label: `${dateLabel}${timeLabel}`, detail: "Fecha límite de entrega.", due };
  }

  function deadlineChip(task) {
    const info = deadlineInfo(task);
    return `<span class="v1710-deadline-chip ${info.className}" title="${escHtml(info.detail)}">${escHtml(info.label)}</span>`;
  }

  function taskIdFromNode(node) {
    return node?.dataset?.taskId || node?.getAttribute?.("data-v17-task-row") || node?.getAttribute?.("data-v179-task-id") || "";
  }

  function decorateTaskNodes() {
    document.querySelectorAll("[data-task-id],[data-v17-task-row],[data-v179-task-id]").forEach((node) => {
      if (node.querySelector(":scope > .v1710-deadline-chip, :scope .v1710-deadline-inline")) return;
      const task = taskById(taskIdFromNode(node));
      if (!task) return;
      const holder = node.querySelector(".v412-task-top,.v17-list-title,.v13-execution-copy,.v413-focus-task") || node;
      if (!holder) return;
      const wrap = document.createElement("div");
      wrap.className = "v1710-deadline-inline";
      wrap.innerHTML = deadlineChip(task);
      holder.appendChild(wrap);
    });
  }

  function setDeadlinePreset(days, hour = "18:00", dateId = "taskDue", timeId = "taskTime") {
    const date = new Date();
    date.setDate(date.getDate() + Number(days || 0));
    const dateInput = document.getElementById(dateId), timeInput = document.getElementById(timeId);
    if (dateInput) dateInput.value = localDateKey(date);
    if (timeInput) timeInput.value = hour;
  }

  function enhanceDeadlineInputs() {
    const manager = isManager();
    const dateInput = document.getElementById("taskDue"), timeInput = document.getElementById("taskTime");
    if (dateInput) {
      const label = dateInput.closest("label");
      if (label && !label.classList.contains("v1710-deadline-label")) {
        label.classList.add("v1710-deadline-label");
        const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = "Fecha límite ";
        label.insertAdjacentHTML("beforeend", `<small>Deadline visible para responsables y jefes.${manager ? " Obligatorio al crear una tarea." : ""}</small>`);
        if (manager) label.insertAdjacentHTML("afterbegin", `<span class="v1710-required">OBLIGATORIA</span>`);
      }
      if (manager) dateInput.required = true;
      dateInput.min = localDateKey(new Date());
    }
    if (timeInput) {
      const label = timeInput.closest("label");
      if (label && !label.classList.contains("v1710-deadline-label")) {
        label.classList.add("v1710-deadline-label");
        const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = "Hora límite ";
        label.insertAdjacentHTML("beforeend", "<small>Opcional. Si queda vacía, el plazo termina al final del día.</small>");
      }
    }
    const form = document.getElementById("taskForm");
    if (form && !document.getElementById("v1710DeadlinePresets")) {
      const impactLabel = document.getElementById("taskImpact")?.closest("label");
      impactLabel?.insertAdjacentHTML("afterend", `<div id="v1710DeadlinePresets" class="v1710-deadline-presets"><span>Atajos de deadline</span><button type="button" data-v1710-deadline="0">Hoy 18:00</button><button type="button" data-v1710-deadline="1">Mañana</button><button type="button" data-v1710-deadline="3">+3 días</button><button type="button" data-v1710-deadline="7">+7 días</button></div>`);
      document.querySelectorAll("[data-v1710-deadline]").forEach((button) => button.addEventListener("click", () => setDeadlinePreset(button.dataset.v1710Deadline)));
    }
    const quickDate = document.getElementById("v179QuickTaskDue"), quickTime = document.getElementById("v179QuickTaskTime");
    if (quickDate) {
      quickDate.required = manager;
      quickDate.min = localDateKey(new Date());
      const label = quickDate.closest("label");
      const span = label?.querySelector("span");
      if (span) span.textContent = manager ? "Fecha límite · obligatoria" : "Fecha límite";
    }
    if (quickTime) {
      const span = quickTime.closest("label")?.querySelector("span");
      if (span) span.textContent = "Hora límite";
    }
  }

  function enhanceTaskDetail(taskId) {
    const task = taskById(taskId);
    const body = document.getElementById("premiumModalBody");
    if (!task || !body || body.querySelector(".v1710-deadline-detail")) return;
    const info = deadlineInfo(task);
    const panel = document.createElement("div");
    panel.className = `v1710-deadline-detail ${info.className}`;
    panel.innerHTML = `<div><strong>${escHtml(info.label)}</strong><span>${escHtml(info.detail)}</span></div>${deadlineChip(task)}`;
    body.prepend(panel);
  }

  function quickDeadlineGuard(event) {
    const target = event.target?.closest?.("#premiumModalActions button");
    if (!target || !document.getElementById("v179QuickTaskDue") || !isManager()) return;
    const label = lower(target.textContent);
    if (!label.includes("crear tarea")) return;
    const input = document.getElementById("v179QuickTaskDue");
    if (!input.value) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      input.reportValidity();
      notify("Falta el deadline", "Selecciona una fecha límite antes de crear la tarea.", "warning");
    }
  }

  async function checkBackend(force = false) {
    if (backendChecked && !force) return backendReady;
    const client = getSb();
    if (!client || !getMember()?.id) { backendChecked = false; backendReady = false; return false; }
    backendChecked = true; backendReady = false;
    try {
      const { data, error } = await client.rpc("ibm_v1710_capabilities");
      if (error) throw error;
      const value = typeof data === "string" ? JSON.parse(data) : data;
      backendReady = value?.version === "17.10" || value?.member_governance === true;
    } catch (error) {
      backendReady = false;
      console.info("[v17.10] Backend opcional no instalado.", error?.message || error);
    }
    return backendReady;
  }

  function memberOptions(selected = "", exclude = "") {
    return officialMembers(exclude).map((person) => `<option value="${escHtml(person.id)}" ${same(person.id, selected) ? "selected" : ""}>${escHtml(person.full_name || person.email)} · ${escHtml(person.position || person.role_code || "Equipo")}</option>`).join("");
  }

  function candidateOptions(selected = "") {
    const people = allKnownMembers().filter(canManagePerson).sort((a, b) => str(a.full_name).localeCompare(str(b.full_name), "es"));
    return people.map((person) => `<option value="${escHtml(person.id)}" ${same(person.id, selected) ? "selected" : ""}>${escHtml(person.full_name || "Sin nombre")} · ${escHtml(person.email || "sin correo")} ${hiddenMembers.has(str(person.id)) ? "· oculto" : ""}</option>`).join("");
  }

  function initials(person) {
    return str(person?.full_name || person?.email || "M").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  function governanceMarkup() {
    const activeCount = officialMembers().length;
    const hidden = [...hiddenMembers.values()].filter(canManagePerson).sort((a, b) => str(a.full_name).localeCompare(str(b.full_name), "es"));
    const currentRole = lower(getMember()?.role_code);
    const canManage = MANAGER_ROLES.has(currentRole);
    return `<section id="v1710GovernancePanel" class="v1710-governance-panel">
      <div class="v1710-governance-head"><div><span class="v1710-governance-badge ${backendReady ? "ready" : ""}">${backendReady ? "Gobernanza conectada" : "SQL v17.10 pendiente"}</span><h3>Miembros oficiales y eliminación segura</h3><p>Las listas operativas muestran perfiles activos, vinculados a Auth y con identidad completa. Los perfiles de prueba o inactivos permanecen aquí hasta que un jefe los transfiera o elimine de Marketing Cloud.</p></div><span class="v1710-governance-badge">${escHtml(currentRole || "sin rol")}</span></div>
      <div class="v1710-governance-body">
        <div class="v1710-governance-metrics"><div class="v1710-governance-metric"><span>Miembros oficiales</span><strong>${activeCount}</strong></div><div class="v1710-governance-metric"><span>Ocultos / prueba</span><strong>${hidden.length}</strong></div><div class="v1710-governance-metric"><span>Backend</span><strong>${backendReady ? "Listo" : "Local"}</strong></div></div>
        <div class="v1710-governance-grid">
          <div class="v1710-governance-card"><h4>Eliminar de Marketing Cloud</h4><p>Primero revisa dependencias. Si el perfil tiene tareas, archivos o historial, transfiérelos a un miembro oficial antes de eliminarlo.</p>
            <label class="v1710-field">Perfil a gestionar<select id="v1710DeleteMember"><option value="">Selecciona un perfil</option>${candidateOptions()}</select></label>
            <label class="v1710-field">Transferir trabajo a<select id="v1710TransferMember"><option value="">Sin transferencia · solo si no tiene dependencias</option>${memberOptions()}</select></label>
            <label class="v1710-field">Confirmación<input id="v1710DeleteConfirm" placeholder="Escribe el correo exacto del perfil"></label>
            <div class="v1710-confirm-help">La eliminación es permanente dentro de Marketing Cloud. No borra la cuenta Auth ni afecta otros sistemas de la empresa.</div>
            <div class="v1710-governance-actions"><button type="button" class="ghost" id="v1710PreviewDelete">Revisar dependencias</button><button type="button" class="v1710-warning" id="v1710DeactivateMember">Desactivar</button><button type="button" class="v1710-danger" id="v1710DeleteMemberBtn" ${backendReady && canManage ? "" : "disabled"}>Eliminar definitivamente</button></div>
            <div id="v1710DeletePreview" class="v1710-preview"><p>Selecciona un perfil y pulsa “Revisar dependencias”.</p></div>
          </div>
          <div class="v1710-governance-card"><h4>Perfiles ocultos o de prueba</h4><p>No aparecen en Trabajo 360, asignaciones, carga ni reportes operativos.</p><div class="v1710-hidden-list">${hidden.length ? hidden.map((person) => `<div class="v1710-hidden-member"><div class="v1710-hidden-avatar">${escHtml(initials(person))}</div><div><strong>${escHtml(person.full_name || "Sin nombre")}</strong><span>${escHtml(person.email || "sin correo")} · ${escHtml(person.status || "active")} ${person.auth_user_id ? "· vinculado" : "· sin Auth"}</span></div><button type="button" class="ghost" data-v1710-manage="${escHtml(person.id)}">Gestionar</button></div>`).join("") : `<div class="v1710-empty">No hay perfiles de prueba o inactivos.</div>`}</div></div>
        </div>
        <div class="v1710-manager-note"><strong>Alcance seguro:</strong> esta función elimina únicamente el perfil y sus relaciones dentro del esquema <code>marketing_app</code>. La cuenta de Supabase Auth y el sistema Tickets no se eliminan, para no afectar otras plataformas de la empresa.</div>
      </div>
    </section>`;
  }

  function injectGovernance() {
    if (!isManager()) return;
    const pane = document.getElementById("admin_users");
    if (!pane) return;
    document.getElementById("v1710GovernancePanel")?.remove();
    pane.insertAdjacentHTML("beforeend", governanceMarkup());
    bindGovernance();
    if (!backendChecked && getMember()?.id) {
      checkBackend().then((ready) => {
        const badge = document.querySelector("#v1710GovernancePanel .v1710-governance-badge");
        if (ready && badge && !badge.classList.contains("ready")) injectGovernance();
      }).catch(() => {});
    }
  }

  function selectedCandidate() {
    const id = document.getElementById("v1710DeleteMember")?.value;
    return allKnownMembers().find((person) => same(person.id, id) && canManagePerson(person)) || null;
  }

  function renderPreview(value) {
    const host = document.getElementById("v1710DeletePreview");
    if (!host) return;
    if (!value) { host.innerHTML = "<p>No se recibió información de dependencias.</p>"; return; }
    const dependencies = arr(value.dependencies).filter((row) => Number(row.count || 0) > 0);
    const transferCount = Number(value.transfer_dependencies ?? value.total_dependencies ?? 0);
    const cleanupCount = Number(value.cleanup_dependencies || 0);
    host.innerHTML = `<h5>${escHtml(value.member?.full_name || value.member?.email || "Perfil")}</h5><p>${Number(value.total_dependencies || 0)} registros vinculados en ${dependencies.length} ubicaciones. ${transferCount ? `${transferCount} se transferirán.` : ""} ${cleanupCount ? `${cleanupCount} corresponden a configuración personal y se retirarán.` : ""}</p>${dependencies.length ? `<div class="v1710-dependency-list">${dependencies.map((row) => `<div class="v1710-dependency-row"><span>${escHtml(row.table || row.relation || "tabla")} · ${escHtml(row.column || "")} <em class="v1710-dependency-action ${row.action === "cleanup" ? "cleanup" : "transfer"}">${row.action === "cleanup" ? "retirar" : "transferir"}</em></span><strong>${Number(row.count || 0)}</strong></div>`).join("")}</div>` : "<p>No tiene dependencias. Puede eliminarse sin transferencia.</p>"}<p>${value.requires_transfer ? "Selecciona un miembro oficial para transferir el trabajo y el historial operativo." : "No necesita transferencia de trabajo."}</p>`;
  }

  async function previewDelete() {
    const person = selectedCandidate();
    if (!person) return notify("Selecciona un perfil", "Elige el miembro que deseas revisar.", "warning");
    const host = document.getElementById("v1710DeletePreview");
    if (host) host.innerHTML = "<p>Analizando dependencias…</p>";
    if (!await checkBackend()) {
      selectedPreview = { member: person, total_dependencies: null, dependencies: [], requires_transfer: true };
      renderPreview(selectedPreview);
      notify("SQL v17.10 pendiente", "Instala el SQL opcional para revisar y eliminar perfiles desde la plataforma.", "warning");
      return;
    }
    const { data, error } = await getSb().rpc("ibm_v1710_member_delete_preview", { p_member_id: person.id });
    if (error) throw error;
    selectedPreview = typeof data === "string" ? JSON.parse(data) : data;
    renderPreview(selectedPreview);
  }

  async function deactivateMember() {
    const person = selectedCandidate();
    if (!person) return notify("Selecciona un perfil", "Elige el miembro que deseas desactivar.", "warning");
    if (!await checkBackend()) return notify("SQL v17.10 pendiente", "Instala el SQL opcional para desactivar desde este panel.", "warning");
    if (!confirm(`¿Desactivar a ${person.full_name || person.email}? Dejará de aparecer en las listas operativas.`)) return;
    const { error } = await getSb().rpc("ibm_v1710_deactivate_member", { p_member_id: person.id });
    if (error) throw error;
    notify("Miembro desactivado", "El perfil ya no aparece en Trabajo 360 ni en asignaciones.", "success");
    if (typeof loadAll === "function") await loadAll();
    pruneMembers();
    if (typeof renderAll === "function") await renderAll();
    injectGovernance();
  }

  async function deleteMemberPermanently() {
    const person = selectedCandidate();
    if (!person) return notify("Selecciona un perfil", "Elige el miembro que deseas eliminar.", "warning");
    if (!await checkBackend()) return notify("SQL v17.10 pendiente", "Instala el SQL opcional antes de eliminar perfiles.", "warning");
    const confirmValue = document.getElementById("v1710DeleteConfirm")?.value?.trim() || "";
    if (lower(confirmValue) !== lower(person.email)) return notify("Confirmación incorrecta", "Escribe el correo exacto del perfil.", "warning");
    if (!selectedPreview || !same(selectedPreview.member?.id, person.id)) await previewDelete();
    const transferTo = document.getElementById("v1710TransferMember")?.value || null;
    if (selectedPreview?.requires_transfer && !transferTo) return notify("Transferencia necesaria", "Este perfil tiene trabajo vinculado. Selecciona un miembro oficial.", "warning");
    if (!confirm(`ELIMINACIÓN PERMANENTE DE MARKETING CLOUD\n\nPerfil: ${person.full_name || person.email}\nTransferencia: ${transferTo ? (officialMembers().find((item) => same(item.id, transferTo))?.full_name || transferTo) : "sin transferencia"}\n\nEsta acción no se puede deshacer. ¿Continuar?`)) return;
    const { data, error } = await getSb().rpc("ibm_v1710_delete_member", { p_member_id: person.id, p_transfer_to_member_id: transferTo, p_confirm_email: confirmValue });
    if (error) throw error;
    hiddenMembers.delete(str(person.id));
    notify("Perfil eliminado", "Desapareció de Marketing Cloud y su trabajo fue transferido según la selección.", "success");
    if (typeof loadAll === "function") await loadAll();
    pruneMembers();
    if (typeof renderAll === "function") await renderAll();
    injectGovernance();
    return data;
  }

  function bindGovernance() {
    if (!document.getElementById("v1710GovernancePanel")) return;
    document.getElementById("v1710PreviewDelete")?.addEventListener("click", () => previewDelete().catch((error) => notify("No se pudo revisar", error?.message || str(error), "error")));
    document.getElementById("v1710DeactivateMember")?.addEventListener("click", () => deactivateMember().catch((error) => notify("No se pudo desactivar", error?.message || str(error), "error")));
    document.getElementById("v1710DeleteMemberBtn")?.addEventListener("click", () => deleteMemberPermanently().catch((error) => notify("No se pudo eliminar", error?.message || str(error), "error")));
    document.getElementById("v1710DeleteMember")?.addEventListener("change", (event) => {
      selectedPreview = null;
      const transfer = document.getElementById("v1710TransferMember");
      if (transfer) transfer.innerHTML = `<option value="">Sin transferencia · solo si no tiene dependencias</option>${memberOptions("", event.target.value)}`;
      const host = document.getElementById("v1710DeletePreview");
      if (host) host.innerHTML = "<p>Pulsa “Revisar dependencias” antes de eliminar.</p>";
    });
    document.querySelectorAll("[data-v1710-manage]").forEach((button) => button.addEventListener("click", () => {
      const select = document.getElementById("v1710DeleteMember");
      if (select) { select.value = button.dataset.v1710Manage; select.dispatchEvent(new Event("change")); }
      document.getElementById("v1710GovernancePanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    governanceBound = true;
  }

  function wrapFunction(name, after) {
    const original = window[name];
    if (typeof original !== "function" || wrapped.has(name)) return;
    const replacement = function (...args) {
      enforceCurrentMemberAccess();
      pruneMembers();
      const result = original.apply(this, args);
      Promise.resolve(result).finally(() => queueMicrotask(() => {
        pruneMembers();
        enhanceDeadlineInputs();
        decorateTaskNodes();
        if (after) after(...args);
      }));
      return result;
    };
    replacement.__v1710Wrapped = true;
    window[name] = replacement;
    wrapped.add(name);
  }

  function wrapFunctions() {
    ["fillSelects", "renderHome", "renderTasks", "renderMyDay", "renderApprovals", "renderCampaigns", "renderV356", "renderWorkload", "renderTeam", "renderSearch", "renderMessages", "renderReports", "renderSchedulePro", "renderMemberProfile"].forEach((name) => wrapFunction(name));
    wrapFunction("renderAdmin", () => injectGovernance());
    const originalOpen = window.v412OpenTask;
    if (typeof originalOpen === "function" && !originalOpen.__v1710Wrapped) {
      const replacement = function (taskId) {
        const result = originalOpen.apply(this, arguments);
        setTimeout(() => enhanceTaskDetail(taskId), 35);
        return result;
      };
      replacement.__v1710Wrapped = true;
      window.v412OpenTask = replacement;
    }
    const quick = window.v66QuickTaskModal;
    if (typeof quick === "function" && !quick.__v1710Wrapped) {
      const replacement = function (...args) {
        const result = quick.apply(this, args);
        setTimeout(enhanceDeadlineInputs, 30);
        return result;
      };
      replacement.__v1710Wrapped = true;
      window.v66QuickTaskModal = replacement;
    }
  }

  function updateVersionMarkers() {
    const build = window.INBESTIGA_BUILD || {};
    const modules = Array.from(new Set([...(Array.isArray(build.modules) ? build.modules : []), "deadlines-member-governance-v17-10"]));
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: "DEADLINES & MEMBER GOVERNANCE", modules };
    document.documentElement.dataset.inbestigaBuild = VERSION;
    document.querySelectorAll("[data-build-version]").forEach((node) => { node.textContent = VERSION; });
  }

  async function init() {
    if (governanceBound) return;
    pruneMembers();
    const refreshRosterAfterBoot = rosterChanged && !!getMember()?.id;
    wrapFunctions();
    updateVersionMarkers();
    document.addEventListener("click", quickDeadlineGuard, true);
    if (!await enforceCurrentMemberAccess()) return;
    await checkBackend();
    pruneMembers();
    enhanceDeadlineInputs();
    decorateTaskNodes();
    injectGovernance();
    if (refreshRosterAfterBoot && typeof renderAll === "function") {
      try { await renderAll(); } catch (error) { console.warn("[v17.10] No se pudo refrescar el directorio oficial.", error); }
    }
    const observer = new MutationObserver(() => {
      if (enhancementScheduled) return;
      enhancementScheduled = true;
      requestAnimationFrame(() => {
        enhancementScheduled = false;
        pruneMembers();
        enhanceDeadlineInputs();
        decorateTaskNodes();
        if (document.getElementById("admin")?.classList.contains("active") && isManager() && !document.getElementById("v1710GovernancePanel")) injectGovernance();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.INBESTIGA_V1710 = { version: VERSION, hiddenMembers: () => [...hiddenMembers.values()], visibleMembers: () => officialMembers(), manageableMembers: () => allKnownMembers().filter(canManagePerson), pruneMembers, deadlineInfo, roleRank, canManagePerson, enforceCurrentMemberAccess, previewDelete, deleteMemberPermanently };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(init, 80), { once: true });
  else setTimeout(init, 80);
})();
