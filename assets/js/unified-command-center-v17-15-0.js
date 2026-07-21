/* INBESTIGA Marketing Cloud v17.15.0 · Unified Command Center & Intelligent Operations */
(() => {
  "use strict";
  if (window.INBESTIGA_V17150) return;

  const VERSION = "v17.15.0";
  const MODULE = "unified-command-center-v17-15-0";
  const PALETTE_PREFIX = "ib15:";
  const HISTORY_LIMIT = 60;
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const rows = value => Array.isArray(value) ? value : [];
  const same = (a, b) => String(a ?? "") === String(b ?? "");
  const data = () => typeof state !== "undefined" && state ? state : (window.state || {});
  const me = () => typeof member !== "undefined" && member ? member : (window.member || {});
  const escapeHtml = value => typeof window.esc === "function"
    ? window.esc(value)
    : String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const statusKey = value => typeof window.v412StatusKey === "function" ? window.v412StatusKey(value) : normalize(value).replaceAll(" ", "_");
  const dayKey = value => {
    try {
      if (typeof window.v121LocalDateKey === "function") return window.v121LocalDateKey(value || new Date());
      const date = value instanceof Date ? value : new Date(value || Date.now());
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 10);
    } catch (_) { return new Date().toISOString().slice(0, 10); }
  };
  const todayKey = () => typeof window.today === "function" ? window.today() : dayKey();
  const done = task => typeof window.v412TaskDone === "function"
    ? window.v412TaskDone(task)
    : ["aprobado","completado","publicado","finalizado","cerrado"].includes(statusKey(task?.status));
  const awaiting = task => typeof window.v412TaskAwaitingReview === "function"
    ? window.v412TaskAwaitingReview(task)
    : ["en_revision","corregido"].includes(statusKey(task?.status));
  const overdue = task => typeof window.v412TaskOverdue === "function"
    ? window.v412TaskOverdue(task)
    : !!(task?.due_date && String(task.due_date).slice(0, 10) < todayKey() && !done(task) && !awaiting(task));
  const nameOf = (collection, id) => typeof window.nameOf === "function"
    ? window.nameOf(collection, id)
    : rows(collection).find(item => same(item.id, id))?.name || "";
  const personName = id => typeof window.memberName === "function"
    ? window.memberName(id)
    : rows(data().members).find(person => same(person.id, id))?.full_name || "Sin responsable";
  const initials = value => String(value || "iB").trim().split(/\s+/).slice(0, 2).map(word => word[0] || "").join("").toUpperCase();
  const shortDate = value => {
    if (!value) return "Sin fecha";
    try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-PE", {day:"2-digit", month:"short"}); }
    catch (_) { return String(value); }
  };
  const dateTime = value => {
    if (!value) return "";
    try { return new Date(value).toLocaleString("es-PE", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"}); }
    catch (_) { return String(value); }
  };
  const daysSince = value => {
    const time = new Date(value || 0).getTime();
    if (!Number.isFinite(time) || !time) return 0;
    return Math.max(0, Math.floor((Date.now() - time) / 86400000));
  };
  const role = () => {
    if (typeof window.isDirector === "function" && window.isDirector()) return "director";
    if (typeof window.isSupervisor === "function" && window.isSupervisor()) return "supervisor";
    const key = statusKey(me().role_code || me().role || me().position);
    if (["admin","director","gerente","owner"].some(token => key.includes(token))) return "director";
    if (["supervisor","jefe","coordinador","lead"].some(token => key.includes(token))) return "supervisor";
    return "member";
  };
  const manager = () => role() !== "member";
  const taskAssignees = task => [...new Set([task?.assigned_to, ...rows(task?.assignee_ids), ...rows(task?.executor_ids), ...rows(task?.executors)].map(value => typeof value === "object" ? value.id : value).filter(Boolean))];
  const belongsToMe = task => taskAssignees(task).some(id => same(id, me().id));
  const taskHours = task => {
    const hours = Number(task?.estimated_hours ?? task?.hours_estimated ?? task?.planned_hours ?? 0);
    if (Number.isFinite(hours) && hours > 0) return hours;
    const minutes = Number(task?.estimated_minutes ?? task?.planned_minutes ?? 0);
    return Number.isFinite(minutes) && minutes > 0 ? minutes / 60 : 0;
  };
  const taskPriority = task => {
    const key = statusKey(task?.priority || task?.urgency || "media");
    if (["urgente","critical","critica","critico"].includes(key)) return 4;
    if (["alta","high"].includes(key)) return 3;
    if (["baja","low"].includes(key)) return 1;
    return 2;
  };
  const dependencyIds = task => {
    const raw = [task?.depends_on_task_id, task?.dependency_task_id, task?.blocked_by_task_id, task?.dependency_id, ...rows(task?.dependency_ids), ...rows(task?.depends_on), ...rows(task?.blocked_by)];
    return [...new Set(raw.map(value => typeof value === "object" ? (value.id || value.task_id) : value).filter(Boolean).map(String))];
  };
  const taskById = id => rows(data().tasks).find(task => same(task.id, id));
  const blocked = task => dependencyIds(task).some(id => { const dependency = taskById(id); return dependency && !done(dependency); });
  const taskEvidence = task => [task?.evidence_url, task?.delivery_url, task?.attachment_url, task?.file_url, task?.submitted_file, task?.delivery_file, ...rows(task?.attachments), ...rows(task?.evidence)].filter(Boolean);
  const updatedAt = task => task?.updated_at || task?.last_activity_at || task?.created_at || 0;
  const campaignActive = campaign => !["finalizada","archivada","cancelada","cerrada"].includes(statusKey(campaign?.status));
  const actionLabel = route => ({home:"Inicio",myday:"Mi día",tasks:"Tareas",campaigns:"Campañas",approvals:"Aprobaciones",workload:"Carga del equipo",notifications:"Notificaciones",messages:"Mensajes",creativeRoomsClean:"Creative Arena",control:"Control",workIntel:"Trabajo 360",assets:"Archivos",search:"Buscar"}[route] || route || "Módulo");

  function taskScore(task) {
    let score = taskPriority(task) * 8;
    if (overdue(task)) score += 55;
    if (String(task?.due_date || "").slice(0, 10) === todayKey()) score += 35;
    if (["observado","corregir","requiere_correccion"].includes(statusKey(task?.status)) || statusKey(task?.approval_status) === "observado") score += 48;
    if (awaiting(task)) score += 40;
    if (blocked(task)) score += 31;
    const age = daysSince(updatedAt(task));
    if (age >= 3) score += Math.min(20, age * 2);
    return score;
  }

  function loadModel(openTasks) {
    const map = new Map();
    rows(data().members).filter(person => statusKey(person.status) !== "inactive").forEach(person => map.set(String(person.id), {person, tasks:[], hours:0, late:0, today:0, reviews:0}));
    openTasks.forEach(task => {
      const ids = taskAssignees(task);
      ids.forEach(id => {
        const entry = map.get(String(id));
        if (!entry) return;
        entry.tasks.push(task);
        entry.hours += taskHours(task);
        if (overdue(task)) entry.late += 1;
        if (String(task.due_date || "").slice(0, 10) === todayKey()) entry.today += 1;
        if (awaiting(task)) entry.reviews += 1;
      });
    });
    const loads = [...map.values()].map(entry => {
      const taskLoad = entry.tasks.length;
      const hourLoad = entry.hours;
      const percent = Math.min(100, Math.round(Math.max(taskLoad / 8, hourLoad / 40) * 100));
      const tone = percent >= 90 || entry.late >= 3 ? "danger" : percent >= 70 || entry.late ? "warning" : "good";
      return {...entry, percent, tone};
    }).sort((a, b) => b.percent - a.percent || b.late - a.late || b.tasks.length - a.tasks.length);
    return {
      loads,
      overloaded: loads.filter(item => item.percent >= 85 || item.late >= 3),
      available: loads.filter(item => item.percent <= 40 && item.tasks.length <= 4),
      totalHours: Math.round(loads.reduce((sum, item) => sum + item.hours, 0) * 10) / 10
    };
  }

  function notificationSeverity(notification) {
    const text = normalize([notification?.title, notification?.message, notification?.body, notification?.type].filter(Boolean).join(" "));
    if (/vencid|bloque|rechaz|error|fall|urgente|critic|elimin/.test(text)) return "critical";
    if (/revision|aproba|observ|correccion|entrega|asign/.test(text)) return "important";
    return "info";
  }

  function operationalModel() {
    const allTasks = rows(data().tasks);
    const open = allTasks.filter(task => !done(task));
    const mine = open.filter(belongsToMe);
    const scope = manager() ? open : mine;
    const late = scope.filter(overdue);
    const dueToday = scope.filter(task => String(task.due_date || "").slice(0, 10) === todayKey() && !awaiting(task));
    const reviews = open.filter(awaiting).filter(task => manager() || belongsToMe(task));
    const observed = mine.filter(task => ["observado","corregir","requiere_correccion"].includes(statusKey(task.status)) || statusKey(task.approval_status) === "observado");
    const unassigned = manager() ? open.filter(task => !taskAssignees(task).length) : [];
    const blockedTasks = scope.filter(blocked);
    const stale = scope.filter(task => !awaiting(task) && !blocked(task) && daysSince(updatedAt(task)) >= 3);
    const activeCampaigns = rows(data().campaigns).filter(campaignActive);
    const riskyCampaigns = activeCampaigns.map(campaign => {
      const tasks = open.filter(task => same(task.campaign_id, campaign.id));
      const lateTasks = tasks.filter(overdue);
      const staleTasks = tasks.filter(task => daysSince(updatedAt(task)) >= 4);
      const pastEnd = campaign.end_date && String(campaign.end_date).slice(0, 10) < todayKey();
      return {campaign, tasks, lateTasks, staleTasks, risk: pastEnd || lateTasks.length > 0 || staleTasks.length >= 2};
    }).filter(item => item.risk);
    const notifications = rows(data().notifications).filter(item => !item.read_at && !item.is_read);
    const notificationGroups = notifications.reduce((groups, item) => { groups[notificationSeverity(item)].push(item); return groups; }, {critical:[], important:[], info:[]});
    let unreadMessages = [];
    try { unreadMessages = rows(typeof window.unreadMessages === "function" ? window.unreadMessages() : []); } catch (_) {}
    const capacity = loadModel(open.filter(task => !awaiting(task)));
    const sorted = [...scope].sort((a, b) => taskScore(b) - taskScore(a) || String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")));
    const next = selectNextAction({role:role(), sorted, reviews, observed, late, dueToday, blockedTasks, unassigned, riskyCampaigns, capacity});
    return {role:role(), allTasks, open, mine, scope, late, dueToday, reviews, observed, unassigned, blockedTasks, stale, activeCampaigns, riskyCampaigns, notifications, notificationGroups, unreadMessages, capacity, next};
  }

  function taskAction(task, label = "Abrir tarea") {
    return {label, run:() => {
      if (typeof window.v412OpenTask === "function") return window.v412OpenTask(task.id);
      window.navTo?.("tasks");
    }};
  }
  function selectNextAction(model) {
    const {role:currentRole, sorted, reviews, observed, late, dueToday, blockedTasks, unassigned, riskyCampaigns, capacity} = model;
    if (currentRole === "director") {
      const review = reviews[0];
      if (review) return {kind:"DECISIÓN PENDIENTE", title:review.title || "Entrega pendiente de aprobación", meta:`${personName(review.assigned_to)} · ${shortDate(review.due_date)}`, reason:"La entrega está esperando una decisión y puede bloquear el trabajo siguiente.", facts:[["Estado", statusKey(review.status).replaceAll("_"," ")],["Evidencias", String(taskEvidence(review).length)],["Espera", `${daysSince(updatedAt(review))} d`]], ...taskAction(review,"Revisar entrega")};
      const campaign = riskyCampaigns[0];
      if (campaign) return {kind:"RIESGO DE CAMPAÑA", title:campaign.campaign.name || campaign.campaign.title || "Campaña que necesita atención", meta:`${campaign.lateTasks.length} vencidas · ${campaign.staleTasks.length} sin actividad`, reason:"Existe riesgo de retraso por fechas vencidas o falta de movimiento reciente.", facts:[["Cliente", nameOf(data().clients,campaign.campaign.client_id)||"Sin cliente"],["Tareas abiertas",String(campaign.tasks.length)],["Cierre",shortDate(campaign.campaign.end_date)]], label:"Abrir campaña", run:()=>window.v413OpenCampaign?.(campaign.campaign.id) || window.navTo?.("campaigns")};
      const overloaded = capacity.overloaded[0];
      if (overloaded) return {kind:"CAPACIDAD DEL EQUIPO", title:`Revisar carga de ${overloaded.person.full_name || "un miembro"}`, meta:`${overloaded.tasks.length} tareas · ${Math.round(overloaded.hours*10)/10} h estimadas`, reason:"La carga supera el rango recomendado y aumenta el riesgo de retrasos.", facts:[["Carga",`${overloaded.percent}%`],["Vencidas",String(overloaded.late)],["Para hoy",String(overloaded.today)]], label:"Ver capacidad", run:()=>window.navTo?.("workload")};
    }
    if (currentRole === "supervisor") {
      const review = reviews[0];
      if (review) return {kind:"REVISIÓN PRIORITARIA", title:review.title || "Entrega lista para validar", meta:`${personName(review.assigned_to)} · ${shortDate(review.due_date)}`, reason:"Resolver esta revisión permite que el responsable continúe o cierre el trabajo.", facts:[["Estado",statusKey(review.status).replaceAll("_"," ")],["Evidencias",String(taskEvidence(review).length)],["Espera",`${daysSince(updatedAt(review))} d`]], ...taskAction(review,"Validar entrega")};
      const blockedTask = blockedTasks[0];
      if (blockedTask) return {kind:"BLOQUEO ACTIVO", title:blockedTask.title || "Tarea bloqueada", meta:`${personName(blockedTask.assigned_to)} · ${shortDate(blockedTask.due_date)}`, reason:"La tarea depende de trabajo todavía incompleto y necesita coordinación.", facts:[["Dependencias",String(dependencyIds(blockedTask).length)],["Prioridad",blockedTask.priority||"Media"],["Campaña",nameOf(data().campaigns,blockedTask.campaign_id)||"Sin campaña"]], ...taskAction(blockedTask,"Resolver bloqueo")};
      const empty = unassigned[0];
      if (empty) return {kind:"TRABAJO SIN RESPONSABLE", title:empty.title || "Tarea pendiente de asignación", meta:`${nameOf(data().clients,empty.client_id)||"Sin cliente"} · ${shortDate(empty.due_date)}`, reason:"Nadie puede avanzar hasta que exista un responsable confirmado.", facts:[["Prioridad",empty.priority||"Media"],["Campaña",nameOf(data().campaigns,empty.campaign_id)||"Sin campaña"],["Vence",shortDate(empty.due_date)]], ...taskAction(empty,"Asignar responsable")};
    }
    const personal = observed[0] || late[0] || dueToday[0] || sorted[0];
    if (personal) {
      const isObserved = observed.some(item => same(item.id, personal.id));
      const isLate = overdue(personal);
      return {kind:isObserved?"CORRECCIÓN REQUERIDA":isLate?"PRIORIDAD VENCIDA":"SIGUIENTE ACCIÓN", title:personal.title || "Continuar trabajo", meta:`${nameOf(data().campaigns,personal.campaign_id)||nameOf(data().clients,personal.client_id)||"Trabajo interno"} · ${shortDate(personal.due_date)}`, reason:isObserved?"La entrega tiene observaciones y necesita una nueva versión.":isLate?"La fecha ya venció y conviene resolver o reprogramar el pendiente.":"Es el trabajo con mayor prioridad según fecha, estado y dependencias.", facts:[["Estado",statusKey(personal.status||"pendiente").replaceAll("_"," ")],["Prioridad",personal.priority||"Media"],["Responsable",personName(personal.assigned_to)]], ...taskAction(personal,isObserved?"Corregir entrega":"Abrir prioridad")};
    }
    return {kind:"OPERACIÓN ESTABLE", title:"No hay bloqueos críticos en este momento.", meta:"La plataforma no detectó tareas urgentes dentro de tu alcance.", reason:"Puedes continuar desde Mi día o revisar el historial de actividad reciente.", facts:[["Tareas abiertas",String(model.sorted.length)],["Revisiones",String(reviews.length)],["Bloqueos",String(blockedTasks.length)]], label:"Abrir Mi día", run:()=>window.navTo?.("myday")};
  }

  function operationalContext() {
    const model = operationalModel();
    return {
      version:VERSION,
      role:model.role,
      counts:{open:model.scope.length, late:model.late.length, due_today:model.dueToday.length, reviews:model.reviews.length, blocked:model.blockedTasks.length, unassigned:model.unassigned.length, risky_campaigns:model.riskyCampaigns.length, unread_notifications:model.notifications.length, unread_messages:model.unreadMessages.length},
      next_action:{kind:model.next.kind,title:model.next.title,reason:model.next.reason,meta:model.next.meta},
      capacity:{overloaded:model.capacity.overloaded.length,available:model.capacity.available.length,total_estimated_hours:model.capacity.totalHours},
      generated_at:new Date().toISOString()
    };
  }

  function openTask(id) { if (typeof window.v412OpenTask === "function") return window.v412OpenTask(id); window.navTo?.("tasks"); }
  function openCampaign(id) { if (typeof window.v413OpenCampaign === "function") return window.v413OpenCampaign(id); window.navTo?.("campaigns"); }
  function openMember(id) { if (typeof window.openMemberProfile === "function") return window.openMemberProfile(id); window.navTo?.("team"); }

  function commandSection() {
    let section = q("#ib15UnifiedCommandCenter");
    if (section) return section;
    const anchor = q("#v13OpsCenter") || q("#v12CommandStage") || q("#mzLivingBrief");
    if (!anchor) return null;
    section = document.createElement("section");
    section.id = "ib15UnifiedCommandCenter";
    section.className = "ib15-command-center";
    section.dataset.mzSectionKey = "unified-command-center";
    anchor.insertAdjacentElement("afterend", section);
    return section;
  }

  function renderCommandCenter() {
    const root = commandSection();
    if (!root) return;
    const model = operationalModel();
    const next = model.next;
    const roleLabel = model.role === "director" ? "Dirección" : model.role === "supervisor" ? "Supervisión" : "Personal";
    const topLoad = model.capacity.loads.slice(0, 5);
    const history = loadHistory().slice(0, 4);
    const signals = [
      {icon:"!",value:model.blockedTasks.length,title:"Bloqueos",meta:model.blockedTasks.length?"Tareas que dependen de trabajo pendiente":"Sin dependencias críticas",tone:model.blockedTasks.length?"danger":"good",route:"tasks"},
      {icon:"✓",value:model.reviews.length,title:"Decisiones",meta:model.reviews.length?"Entregas esperando revisión":"Bandeja al día",tone:model.reviews.length?"warning":"good",route:"approvals"},
      {icon:"↗",value:model.capacity.overloaded.length,title:"Carga alta",meta:model.capacity.overloaded.length?"Personas por encima del rango":"Capacidad equilibrada",tone:model.capacity.overloaded.length?"warning":"good",route:"workload"}
    ];
    root.innerHTML = `<div class="ib15-command-head"><div><span class="ib15-kicker">CENTRO DE MANDO UNIFICADO · ${escapeHtml(roleLabel.toUpperCase())}</span><h2>Qué ocurre, quién debe actuar y cuál es el siguiente paso.</h2><p>Prioridades, decisiones, bloqueos y capacidad reunidos en una lectura operativa. Ninguna acción importante se ejecuta sin confirmación.</p></div><div class="ib15-command-head-actions"><span class="ib15-version"><i></i>${VERSION}</span><button type="button" class="ib15-secondary" data-ib15-search>Buscar <kbd>Ctrl K</kbd></button><button type="button" class="ib15-secondary ib15-history-trigger" data-ib15-history>Historial</button></div></div>
      <div class="ib15-command-grid"><article class="ib15-focus-card"><div class="ib15-focus-top"><span class="ib15-focus-icon">✦</span><div class="ib15-focus-copy"><span>${escapeHtml(next.kind)}</span><h3>${escapeHtml(next.title)}</h3><p>${escapeHtml(next.reason)}</p></div></div><div class="ib15-focus-facts">${rows(next.facts).map(([label,value])=>`<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value||"—")}</strong></span>`).join("")}</div><div class="ib15-focus-actions"><button type="button" class="ib15-primary" data-ib15-next>${escapeHtml(next.label)} ↗</button><button type="button" class="ib15-secondary" data-ib15-sakura="next">Preguntar a SAKURA</button><button type="button" class="ib15-tertiary" data-ib15-refresh>Actualizar lectura</button></div></article><div class="ib15-side-stack">${signals.map(signal=>`<article class="ib15-signal-card" data-tone="${signal.tone}"><span class="ib15-signal-icon">${signal.icon}</span><div class="ib15-signal-copy"><strong>${escapeHtml(signal.title)}</strong><span>${escapeHtml(signal.meta)}</span></div><b class="ib15-signal-value">${signal.value}</b><button type="button" class="ib15-tertiary" data-ib15-route="${signal.route}">Abrir módulo</button></article>`).join("")}</div></div>
      <div class="ib15-command-metrics"><article class="ib15-command-metric"><span>VENCIDAS</span><strong>${model.late.length}</strong><small>${model.late.length?"Necesitan cierre o reprogramación":"Sin retrasos en tu alcance"}</small></article><article class="ib15-command-metric"><span>PARA HOY</span><strong>${model.dueToday.length}</strong><small>Entregas activas del día</small></article><article class="ib15-command-metric"><span>SIN RESPONSABLE</span><strong>${model.unassigned.length}</strong><small>${manager()?"Trabajo pendiente de asignación":"Visible para jefaturas"}</small></article><article class="ib15-command-metric"><span>CAMPAÑAS EN RIESGO</span><strong>${model.riskyCampaigns.length}</strong><small>Por fecha o inactividad</small></article><article class="ib15-command-metric"><span>NOTIFICACIONES</span><strong>${model.notifications.length}</strong><small>${model.notificationGroups.critical.length} críticas · ${model.notificationGroups.important.length} importantes</small></article></div>
      <div class="ib15-capacity-strip"><article class="ib15-capacity-card"><div class="ib15-card-title"><strong>Capacidad observada</strong><span>${model.capacity.totalHours} h estimadas abiertas</span></div><div class="ib15-load-list">${topLoad.length?topLoad.map(item=>`<div class="ib15-load-row" data-tone="${item.tone}"><div class="ib15-load-person"><span class="ib15-load-avatar">${escapeHtml(initials(item.person.full_name))}</span><strong>${escapeHtml(item.person.full_name||"Miembro")}</strong></div><div class="ib15-load-track"><i style="width:${item.percent}%"></i></div><span>${item.tasks.length} tareas · ${Math.round(item.hours*10)/10} h</span></div>`).join(""):'<div class="ib15-empty">Todavía no hay datos suficientes para calcular la capacidad.</div>'}</div></article><article class="ib15-history-card"><div class="ib15-card-title"><strong>Actividad reciente</strong><button type="button" class="ib15-tertiary" data-ib15-history>Ver todo</button></div><div class="ib15-history-mini">${history.length?history.map(item=>`<button type="button" data-ib15-history-open="${escapeHtml(item.id)}"><time>${escapeHtml(historyTime(item.at))}</time><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta||"")}</span></div></button>`).join(""):'<div class="ib15-empty">Las acciones recientes aparecerán aquí.</div>'}</div></article></div>`;
    q("[data-ib15-next]", root)?.addEventListener("click", () => { recordHistory("priority", next.title, next.meta, ""); next.run?.(); });
    qa("[data-ib15-route]", root).forEach(button => button.addEventListener("click", () => window.navTo?.(button.dataset.ib15Route)));
    qa("[data-ib15-history]", root).forEach(button => button.addEventListener("click", openHistory));
    q("[data-ib15-search]", root)?.addEventListener("click", () => openUniversalSearch());
    q("[data-ib15-refresh]", root)?.addEventListener("click", () => { renderAllEnhancements(); window.premiumToast?.("Lectura actualizada", "Prioridades, bloqueos y capacidad se recalcularon con los datos cargados.", "success"); });
    q("[data-ib15-sakura]", root)?.addEventListener("click", () => askSakura(`Ayúdame con mi siguiente acción recomendada: ${next.title}. Motivo: ${next.reason}. Dame pasos concretos y no ejecutes nada sin mi confirmación.`));
    qa("[data-ib15-history-open]", root).forEach(button => button.addEventListener("click", () => openHistoryItem(button.dataset.ib15HistoryOpen)));
  }

  function approvalModel() {
    const tasks = rows(data().tasks);
    const waiting = tasks.filter(awaiting);
    const observed = tasks.filter(task => ["observado","requiere_correccion"].includes(statusKey(task.status)) || statusKey(task.approval_status) === "observado");
    const scopedWaiting = manager() ? waiting : waiting.filter(belongsToMe);
    const missingEvidence = scopedWaiting.filter(task => !taskEvidence(task).length);
    const oldest = [...scopedWaiting].sort((a,b)=>new Date(updatedAt(a)||0)-new Date(updatedAt(b)||0))[0];
    return {waiting:scopedWaiting, observed:manager()?observed:observed.filter(belongsToMe), missingEvidence, oldest};
  }

  function enhanceApprovals() {
    const section = q("#approvals");
    if (!section) return;
    let panel = q("#ib15ApprovalIntelligence", section);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "ib15ApprovalIntelligence";
      panel.className = "ib15-intelligence-panel";
      const anchor = q("#v413ApprovalToolbar", section) || q("#approvalList", section);
      anchor?.insertAdjacentElement("afterend", panel);
    }
    const model = approvalModel();
    const top = [...model.waiting].sort((a,b)=>daysSince(updatedAt(b))-daysSince(updatedAt(a))).slice(0,5);
    panel.innerHTML = `<div class="ib15-intelligence-head"><div><span class="ib15-kicker">INTELIGENCIA DE APROBACIÓN</span><h3>Decisiones ordenadas por espera y riesgo.</h3><p>La plataforma no aprueba automáticamente: prepara el contexto para que la revisión sea más rápida.</p></div><button type="button" class="ib15-secondary" data-ib15-sakura-approvals>Resumir con SAKURA</button></div><div class="ib15-summary-grid"><article class="ib15-summary-card" data-tone="${model.waiting.length?"warning":""}"><span>POR REVISAR</span><strong>${model.waiting.length}</strong><small>Entregas que esperan decisión</small></article><article class="ib15-summary-card" data-tone="${model.observed.length?"warning":""}"><span>OBSERVADAS</span><strong>${model.observed.length}</strong><small>Esperan una nueva versión</small></article><article class="ib15-summary-card" data-tone="${model.missingEvidence.length?"danger":""}"><span>SIN EVIDENCIA</span><strong>${model.missingEvidence.length}</strong><small>Revisiones sin archivo o enlace detectado</small></article><article class="ib15-summary-card"><span>MAYOR ESPERA</span><strong>${model.oldest?daysSince(updatedAt(model.oldest)):0} d</strong><small>${escapeHtml(model.oldest?.title||"Bandeja al día")}</small></article></div><div class="ib15-priority-list">${top.length?top.map((task,index)=>`<article class="ib15-priority-row"><span class="ib15-priority-index">${String(index+1).padStart(2,"0")}</span><div class="ib15-priority-copy"><strong>${escapeHtml(task.title||"Entrega")}</strong><span>${escapeHtml(personName(task.assigned_to))} · ${daysSince(updatedAt(task))} días esperando · ${taskEvidence(task).length} evidencia(s)</span></div><button type="button" class="ib15-secondary" data-ib15-open-task="${escapeHtml(task.id)}">Revisar</button></article>`).join(""):'<div class="ib15-empty">No existen entregas pendientes de aprobación.</div>'}</div>`;
    qa("[data-ib15-open-task]", panel).forEach(button => button.addEventListener("click", () => openTask(button.dataset.ib15OpenTask)));
    q("[data-ib15-sakura-approvals]", panel)?.addEventListener("click", () => askSakura(`Resume mi bandeja de aprobaciones. Tengo ${model.waiting.length} por revisar, ${model.observed.length} observadas y ${model.missingEvidence.length} sin evidencia detectada. Ordénalas por riesgo y dime cuál revisar primero.`));
  }

  function enhanceWorkload() {
    const section = q("#workload");
    if (!section) return;
    let panel = q("#ib15WorkloadIntelligence", section);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "ib15WorkloadIntelligence";
      panel.className = "ib15-intelligence-panel";
      q("#workloadGrid", section)?.insertAdjacentElement("beforebegin", panel);
    }
    const model = operationalModel();
    const capacity = model.capacity;
    const highest = capacity.loads[0];
    const rowsHtml = capacity.loads.slice(0, 8).map((item,index)=>`<article class="ib15-priority-row"><span class="ib15-priority-index">${String(index+1).padStart(2,"0")}</span><div class="ib15-priority-copy"><strong>${escapeHtml(item.person.full_name||"Miembro")}</strong><span>${item.tasks.length} tareas · ${Math.round(item.hours*10)/10} h · ${item.late} vencidas · ${item.percent}% de carga observada</span></div><button type="button" class="ib15-secondary" data-ib15-member="${escapeHtml(item.person.id)}">Ver perfil</button></article>`).join("");
    panel.innerHTML = `<div class="ib15-intelligence-head"><div><span class="ib15-kicker">CAPACIDAD OPERATIVA</span><h3>Distribución de trabajo sin calificar a las personas.</h3><p>La lectura combina cantidad de tareas, horas estimadas y vencimientos. Solo sugiere; no reasigna automáticamente.</p></div><button type="button" class="ib15-secondary" data-ib15-sakura-capacity>Consultar a SAKURA</button></div><div class="ib15-summary-grid"><article class="ib15-summary-card" data-tone="${capacity.overloaded.length?"danger":""}"><span>CARGA ALTA</span><strong>${capacity.overloaded.length}</strong><small>Miembros por encima del rango observado</small></article><article class="ib15-summary-card"><span>DISPONIBLES</span><strong>${capacity.available.length}</strong><small>Carga menor o igual al 40%</small></article><article class="ib15-summary-card"><span>HORAS ABIERTAS</span><strong>${capacity.totalHours}</strong><small>Estimación acumulada de tareas activas</small></article><article class="ib15-summary-card"><span>MAYOR CARGA</span><strong>${highest?`${highest.percent}%`:"—"}</strong><small>${escapeHtml(highest?.person?.full_name||"Sin datos")}</small></article></div><div class="ib15-priority-list">${rowsHtml||'<div class="ib15-empty">No hay datos suficientes para calcular la carga.</div>'}</div>`;
    qa("[data-ib15-member]", panel).forEach(button => button.addEventListener("click", () => openMember(button.dataset.ib15Member)));
    q("[data-ib15-sakura-capacity]", panel)?.addEventListener("click", () => askSakura(`Analiza la capacidad actual del equipo usando solo los datos visibles. Hay ${capacity.overloaded.length} personas con carga alta, ${capacity.available.length} con disponibilidad y ${capacity.totalHours} horas estimadas abiertas. Propón opciones, pero no reasignes tareas.`));
  }

  function enhanceNotifications() {
    const section = q("#notifications");
    if (!section) return;
    let panel = q("#ib15NotificationIntelligence", section);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "ib15NotificationIntelligence";
      panel.className = "ib15-intelligence-panel";
      q("#notificationList", section)?.insertAdjacentElement("beforebegin", panel);
    }
    const model = operationalModel();
    const groups = model.notificationGroups;
    panel.innerHTML = `<div class="ib15-intelligence-head"><div><span class="ib15-kicker">NOTIFICACIONES AGRUPADAS</span><h3>Primero lo que cambia una decisión.</h3><p>Las alertas se clasifican localmente para reducir ruido. Los registros originales permanecen intactos.</p></div><button type="button" class="ib15-secondary" data-ib15-sakura-notifications>Preparar resumen</button></div><div class="ib15-notification-groups"><article class="ib15-notification-group" data-tone="danger"><strong>Críticas <b>${groups.critical.length}</b></strong><span>Vencimientos, bloqueos, errores o urgencias.</span></article><article class="ib15-notification-group" data-tone="warning"><strong>Importantes <b>${groups.important.length}</b></strong><span>Revisiones, entregas, observaciones y asignaciones.</span></article><article class="ib15-notification-group"><strong>Informativas <b>${groups.info.length}</b></strong><span>Actividad que no requiere intervención inmediata.</span></article></div>`;
    q("[data-ib15-sakura-notifications]", panel)?.addEventListener("click", () => askSakura(`Resume mis notificaciones sin repetirlas. Hay ${groups.critical.length} críticas, ${groups.important.length} importantes y ${groups.info.length} informativas. Indícame cuáles cambian lo que debo hacer hoy.`));
  }

  function historyKey() { return `inbestiga_v17_15_history_${String(me().id || "anonymous")}`; }
  function loadHistory() {
    try { const parsed = JSON.parse(localStorage.getItem(historyKey()) || "[]"); return rows(parsed).slice(0, HISTORY_LIMIT); }
    catch (_) { return []; }
  }
  function saveHistory(items) { try { localStorage.setItem(historyKey(), JSON.stringify(rows(items).slice(0, HISTORY_LIMIT))); } catch (_) {} }
  function recordHistory(type, title, meta = "", route = "", entityId = "") {
    if (!title) return;
    const history = loadHistory();
    const recent = history[0];
    if (recent && recent.type === type && recent.title === title && Date.now() - new Date(recent.at).getTime() < 20000) return;
    history.unshift({id:`${Date.now()}_${Math.random().toString(36).slice(2,8)}`, type, title:String(title), meta:String(meta || ""), route:String(route || ""), entityId:String(entityId || ""), at:new Date().toISOString()});
    saveHistory(history);
    if (q("#ib15UnifiedCommandCenter")) renderCommandCenter();
  }
  function historyTime(value) {
    try {
      const diff = Date.now() - new Date(value).getTime();
      if (diff < 60000) return "Ahora";
      if (diff < 3600000) return `${Math.floor(diff/60000)} min`;
      if (diff < 86400000) return `${Math.floor(diff/3600000)} h`;
      return new Date(value).toLocaleDateString("es-PE", {day:"2-digit",month:"short"});
    } catch (_) { return ""; }
  }
  function ensureHistoryDrawer() {
    let backdrop = q("#ib15HistoryBackdrop");
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = "ib15HistoryBackdrop";
    backdrop.className = "ib15-history-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = `<aside class="ib15-history-drawer" role="dialog" aria-modal="true" aria-label="Historial de actividad"><header><div><span class="ib15-kicker">ACTIVIDAD LOCAL</span><h2>Historial reciente</h2><p>Navegación y aperturas registradas en este dispositivo. No modifica datos productivos.</p></div><button type="button" class="ib15-history-close" data-ib15-history-close aria-label="Cerrar">×</button></header><div class="ib15-history-list" id="ib15HistoryList"></div><div class="ib15-history-actions"><button type="button" class="ib15-secondary" data-ib15-history-clear>Limpiar historial</button><button type="button" class="ib15-primary" data-ib15-history-close>Cerrar</button></div></aside>`;
    backdrop.addEventListener("click", event => { if (event.target === backdrop || event.target.closest("[data-ib15-history-close]")) closeHistory(); });
    q("[data-ib15-history-clear]", backdrop)?.addEventListener("click", () => { saveHistory([]); renderHistory(); renderCommandCenter(); });
    document.body.appendChild(backdrop);
    return backdrop;
  }
  function renderHistory() {
    const backdrop = ensureHistoryDrawer();
    const host = q("#ib15HistoryList", backdrop);
    const history = loadHistory();
    if (!host) return;
    host.innerHTML = history.length ? history.map(item => `<button type="button" class="ib15-history-item" data-ib15-history-item="${escapeHtml(item.id)}"><i>${escapeHtml(({task:"T",campaign:"C",navigation:"↗",approval:"✓",priority:"!",member:"P"}[item.type]||"•"))}</i><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta||"")}</span><time>${escapeHtml(dateTime(item.at))}</time></div></button>`).join("") : '<div class="ib15-empty">Todavía no hay acciones registradas en este dispositivo.</div>';
    qa("[data-ib15-history-item]", host).forEach(button => button.addEventListener("click", () => openHistoryItem(button.dataset.ib15HistoryItem)));
  }
  function openHistory() { const backdrop = ensureHistoryDrawer(); renderHistory(); backdrop.classList.add("open"); backdrop.setAttribute("aria-hidden","false"); }
  function closeHistory() { const backdrop = q("#ib15HistoryBackdrop"); backdrop?.classList.remove("open"); backdrop?.setAttribute("aria-hidden","true"); }
  function openHistoryItem(id) {
    const item = loadHistory().find(entry => same(entry.id, id));
    if (!item) return;
    closeHistory();
    if (item.type === "task" && item.entityId) return openTask(item.entityId);
    if (item.type === "campaign" && item.entityId) return openCampaign(item.entityId);
    if (item.type === "member" && item.entityId) return openMember(item.entityId);
    if (item.route) return window.navTo?.(item.route);
  }

  function paletteEntityItems() {
    const items = [];
    const model = operationalModel();
    const add = item => items.push({...item, key:`${PALETTE_PREFIX}${item.key}`});
    add({key:"late",code:"O1",title:"Ver tareas vencidas",meta:`${model.late.length} pendientes fuera de fecha · prioridad operativa`,aliases:"atrasadas retrasadas fuera de fecha",kind:"command",action:()=>window.navTo?.("tasks")});
    add({key:"today",code:"O2",title:"Abrir prioridades de hoy",meta:`${model.dueToday.length} tareas programadas para hoy`,aliases:"mi dia agenda hoy pendientes",kind:"command",action:()=>window.navTo?.("myday")});
    add({key:"approvals",code:"O3",title:"Revisar aprobaciones",meta:`${model.reviews.length} entregas esperan decisión`,aliases:"entregas revisar validar aprobar",kind:"command",action:()=>window.navTo?.("approvals")});
    add({key:"capacity",code:"O4",title:"Analizar capacidad del equipo",meta:`${model.capacity.overloaded.length} cargas altas · ${model.capacity.available.length} disponibles`,aliases:"carga horas personas disponibilidad equipo",kind:"command",action:()=>window.navTo?.("workload")});
    add({key:"history",code:"O5",title:"Abrir historial de actividad",meta:"Navegación y acciones recientes de este dispositivo",aliases:"reciente actividad volver",kind:"command",action:openHistory});
    add({key:"sakura",code:"O6",title:"Consultar prioridades con SAKURA",meta:model.next.title,aliases:"asistente siguiente accion ayuda",kind:"command",action:()=>askSakura(`Analiza mi operación actual y ayúdame a ejecutar la siguiente acción: ${model.next.title}. No hagas cambios sin confirmación.`)});
    [...model.scope].sort((a,b)=>taskScore(b)-taskScore(a)).slice(0,30).forEach((task,index)=>add({key:`task:${task.id}`,code:`T${String(index+1).padStart(2,"0")}`,title:task.title||"Tarea",meta:`Tarea · ${personName(task.assigned_to)} · ${shortDate(task.due_date)} · ${statusKey(task.status).replaceAll("_"," ")}`,aliases:`tarea ${nameOf(data().campaigns,task.campaign_id)} ${nameOf(data().clients,task.client_id)} ${personName(task.assigned_to)} ${overdue(task)?"vencida retrasada":""}`,kind:"task",action:()=>openTask(task.id)}));
    rows(data().campaigns).filter(campaignActive).slice(0,18).forEach((campaign,index)=>add({key:`campaign:${campaign.id}`,code:`C${String(index+1).padStart(2,"0")}`,title:campaign.name||campaign.title||"Campaña",meta:`Campaña · ${nameOf(data().clients,campaign.client_id)||"Sin cliente"} · ${statusKey(campaign.status).replaceAll("_"," ")}`,aliases:`campana proyecto cliente ${nameOf(data().clients,campaign.client_id)}`,kind:"campaign",action:()=>openCampaign(campaign.id)}));
    rows(data().members).filter(person=>statusKey(person.status)!=="inactive").slice(0,22).forEach((person,index)=>{
      add({key:`member:${person.id}`,code:`P${String(index+1).padStart(2,"0")}`,title:person.full_name||"Miembro",meta:`Persona · ${person.position||person.role_code||"Equipo"}`,aliases:`miembro colaborador responsable perfil ${person.email||""}`,kind:"member",action:()=>openMember(person.id)});
      const late = model.open.filter(task=>taskAssignees(task).some(id=>same(id,person.id))&&overdue(task)).length;
      if(late)add({key:`member-late:${person.id}`,code:"PX",title:`Tareas vencidas de ${person.full_name}`,meta:`${late} tarea(s) fuera de fecha`,aliases:`pendientes atrasados retrasados ${person.full_name}`,kind:"command",action:()=>{window.navTo?.("search");setTimeout(()=>{const input=q("#globalSearch");if(input){input.value=person.full_name;input.dispatchEvent(new Event("input",{bubbles:true}))}},40)}});
    });
    rows(data().assets).slice(0,14).forEach((asset,index)=>add({key:`asset:${asset.id}`,code:`A${String(index+1).padStart(2,"0")}`,title:asset.name||asset.file_name||"Archivo",meta:`Archivo · ${nameOf(data().campaigns,asset.campaign_id)||nameOf(data().clients,asset.client_id)||asset.file_type||"Biblioteca"}`,aliases:`documento evidencia recurso adjunto`,kind:"asset",action:()=>window.navTo?.("assets")}));
    return items;
  }

  function refreshPalette() {
    if (typeof V12_PALETTE_ITEMS === "undefined" || !Array.isArray(V12_PALETTE_ITEMS)) return;
    for (let index = V12_PALETTE_ITEMS.length - 1; index >= 0; index -= 1) {
      if (String(V12_PALETTE_ITEMS[index]?.key || "").startsWith(PALETTE_PREFIX)) V12_PALETTE_ITEMS.splice(index, 1);
    }
    V12_PALETTE_ITEMS.push(...paletteEntityItems());
  }

  function installPalette() {
    if (typeof v12PaletteMatches === "function" && !v12PaletteMatches.__ib15Wrapped) {
      const base = v12PaletteMatches;
      const wrapped = function(item, query) {
        const text = normalize(query);
        if (!text) return true;
        const haystack = normalize(`${item?.title||""} ${item?.meta||""} ${item?.key||""} ${item?.aliases||""}`);
        const tokens = text.split(/\s+/).filter(Boolean);
        return tokens.every(token => haystack.includes(token)) || base(item, query);
      };
      wrapped.__ib15Wrapped = true;
      wrapped.__ib15Base = base;
      v12PaletteMatches = wrapped;
    }
    if (typeof v12OpenCommandPalette === "function" && !v12OpenCommandPalette.__ib15Wrapped) {
      const base = v12OpenCommandPalette;
      const wrapped = function(query = "") {
        const result = base.apply(this, arguments.length ? [] : arguments);
        refreshPalette();
        const input = q("#v12PaletteInput");
        if (input && typeof query === "string" && query) input.value = query;
        if (typeof v12RenderPalette === "function") v12RenderPalette(input?.value || "");
        decoratePalette();
        return result;
      };
      wrapped.__ib15Wrapped = true;
      wrapped.__ib15Base = base;
      v12OpenCommandPalette = wrapped;
    }
    const input = q("#v12PaletteInput");
    if (input && !input.dataset.ib15Bound) {
      input.dataset.ib15Bound = "1";
      input.placeholder = "Buscar módulos, tareas, campañas, personas, archivos o una acción…";
      input.addEventListener("input", () => requestAnimationFrame(decoratePalette));
    }
  }
  function decoratePalette() {
    const input = q("#v12PaletteInput");
    const query = input?.value || "";
    if (typeof V12_PALETTE_ITEMS === "undefined") return;
    const visible = V12_PALETTE_ITEMS.filter(item => typeof v12PaletteMatches === "function" ? v12PaletteMatches(item, query) : true);
    qa("#v12PaletteResults [data-v12-palette-index]").forEach(button => {
      const item = visible[Number(button.dataset.v12PaletteIndex)];
      if (item?.kind) button.dataset.ib15Kind = item.kind;
    });
  }
  function openUniversalSearch(query = "") {
    installPalette();
    refreshPalette();
    if (typeof v12OpenCommandPalette === "function") return v12OpenCommandPalette(query);
    window.navTo?.("search");
  }

  async function askSakura(prompt) {
    const text = String(prompt || "Revisa mis prioridades operativas y dime cuál es el siguiente paso.");
    try {
      if (window.INBESTIGA_SAKURA_LOADER?.load) await window.INBESTIGA_SAKURA_LOADER.load();
      else window.INBESTIGA_SAKURA_NATIVE?.open?.();
      patchSakura();
      const input = q("#skInput");
      if (input) { input.value = text; input.dispatchEvent(new Event("input", {bubbles:true})); input.focus(); }
      injectSakuraQuickAction();
    } catch (error) {
      window.premiumToast?.("SAKURA no pudo abrirse", error?.message || String(error), "error");
    }
  }
  function injectSakuraQuickAction() {
    const host = q("#skQuickActions");
    if (!host || q("#ib15SakuraOperations", host)) return;
    const button = document.createElement("button");
    button.id = "ib15SakuraOperations";
    button.type = "button";
    button.className = "ib15-sakura-quick";
    button.textContent = "Revisar prioridades";
    button.addEventListener("click", () => {
      const context = operationalContext();
      const input = q("#skInput");
      if (input) { input.value = `Analiza mis prioridades actuales. Siguiente acción: ${context.next_action.title}. Tengo ${context.counts.late} vencidas, ${context.counts.reviews} revisiones y ${context.counts.blocked} bloqueos. Dime qué hacer primero y no ejecutes nada sin confirmación.`; input.focus(); }
    });
    host.prepend(button);
  }
  function patchSakura() {
    const api = window.INBESTIGA_SAKURA_NATIVE;
    if (!api || api.__ib15Wrapped) return false;
    if (typeof api.context === "function") {
      const baseContext = api.context.bind(api);
      api.context = () => ({...baseContext(), intelligent_operations:operationalContext()});
    }
    if (typeof api.open === "function") {
      const baseOpen = api.open.bind(api);
      api.open = function() { const result = baseOpen(...arguments); requestAnimationFrame(injectSakuraQuickAction); return result; };
    }
    api.__ib15Wrapped = true;
    return true;
  }

  function wrapGlobal(name, after) {
    const current = window[name];
    if (typeof current !== "function" || current.__ib15Wrapped) return false;
    const wrapped = function(...args) {
      const result = current.apply(this, args);
      const finish = () => { try { after(...args); } catch (error) { console.warn(`[${MODULE}] ${name}`, error); } };
      if (result && typeof result.then === "function") result.finally(() => requestAnimationFrame(finish));
      else requestAnimationFrame(finish);
      return result;
    };
    wrapped.__ib15Wrapped = true;
    wrapped.__ib15Base = current;
    window[name] = wrapped;
    return true;
  }

  function installWrappers() {
    wrapGlobal("renderHome", () => renderCommandCenter());
    wrapGlobal("renderApprovals", () => enhanceApprovals());
    wrapGlobal("renderWorkload", () => enhanceWorkload());
    wrapGlobal("renderNotifications", () => enhanceNotifications());
    wrapGlobal("loadAll", () => renderAllEnhancements());

    if (typeof navTo === "function" && !navTo.__ib15HistoryWrapped) {
      const base = navTo;
      const wrapped = function(route, ...args) {
        const result = base.call(this, route, ...args);
        if (route && route !== "home") recordHistory("navigation", `Abriste ${actionLabel(route)}`, "Navegación de la plataforma", route);
        requestAnimationFrame(() => {
          if (route === "home") renderCommandCenter();
          if (route === "approvals") enhanceApprovals();
          if (route === "workload") enhanceWorkload();
          if (route === "notifications") enhanceNotifications();
          patchSakura();
        });
        return result;
      };
      wrapped.__ib15HistoryWrapped = true;
      wrapped.__ib15Base = base;
      navTo = wrapped;
    }
    if (typeof v412OpenTask === "function" && !v412OpenTask.__ib15HistoryWrapped) {
      const base = v412OpenTask;
      const wrapped = function(id, ...args) {
        const task = taskById(id);
        if (task) recordHistory("task", task.title || "Tarea", `${personName(task.assigned_to)} · ${shortDate(task.due_date)}`, "tasks", id);
        return base.call(this, id, ...args);
      };
      wrapped.__ib15HistoryWrapped = true;
      wrapped.__ib15Base = base;
      v412OpenTask = wrapped;
    }
    if (typeof v413OpenCampaign === "function" && !v413OpenCampaign.__ib15HistoryWrapped) {
      const base = v413OpenCampaign;
      const wrapped = function(id, ...args) {
        const campaign = rows(data().campaigns).find(item => same(item.id, id));
        if (campaign) recordHistory("campaign", campaign.name || campaign.title || "Campaña", nameOf(data().clients,campaign.client_id)||"Sin cliente", "campaigns", id);
        return base.call(this, id, ...args);
      };
      wrapped.__ib15HistoryWrapped = true;
      wrapped.__ib15Base = base;
      v413OpenCampaign = wrapped;
    }
  }

  function bindDelegation() {
    if (document.body.dataset.ib15Delegated) return;
    document.body.dataset.ib15Delegated = "1";
    document.body.addEventListener("click", event => {
      const approval = event.target.closest("[data-v1212-approval],[data-approval-action]");
      if (approval) {
        const task = taskById(approval.dataset.taskId || approval.closest("[data-task-id]")?.dataset.taskId);
        const action = approval.dataset.v1212Approval || approval.dataset.approvalAction || "decision";
        recordHistory("approval", `${actionLabel("approvals")}: ${task?.title || "entrega"}`, `Acción preparada: ${action}`, "approvals", task?.id || "");
      }
    }, {passive:true});
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeHistory();
    });
  }

  function renderAllEnhancements() {
    try { renderCommandCenter(); } catch (error) { console.warn(`[${MODULE}] home`, error); }
    if (q("#approvals.active")) enhanceApprovals();
    if (q("#workload.active")) enhanceWorkload();
    if (q("#notifications.active")) enhanceNotifications();
    installPalette();
    refreshPalette();
    patchSakura();
  }

  function registerBuild() {
    try { window.INBESTIGA_QUALITY_CORE?.register?.(MODULE, {version:VERSION, mode:"local-intelligent-operations", polling:false, realtimeChannels:0, mutationObservers:0}); } catch (_) {}
    const build = window.INBESTIGA_BUILD || {};
    window.INBESTIGA_BUILD = {...build, version:VERSION, name:"UNIFIED COMMAND CENTER & INTELLIGENT OPERATIONS", modules:[...new Set([...(Array.isArray(build.modules)?build.modules:[]), MODULE])]};
    document.documentElement.dataset.inbestigaBuild = VERSION;
    document.documentElement.dataset.ib15DesignSystem = "unified";
    window.dispatchEvent(new CustomEvent("inbestiga:operational-context", {detail:operationalContext()}));
  }

  function init() {
    installWrappers();
    installPalette();
    bindDelegation();
    ensureHistoryDrawer();
    renderAllEnhancements();
    registerBuild();
    window.addEventListener("pageshow", () => requestAnimationFrame(renderAllEnhancements), {passive:true});
    window.addEventListener("inbestiga:realtime-event", () => requestAnimationFrame(renderAllEnhancements), {passive:true});
    window.addEventListener("inbestiga:lifecycle-updated", () => requestAnimationFrame(renderAllEnhancements), {passive:true});
  }

  window.INBESTIGA_V17150 = {
    version:VERSION,
    render:renderAllEnhancements,
    model:operationalModel,
    context:operationalContext,
    search:openUniversalSearch,
    history:{open:openHistory,close:closeHistory,list:loadHistory,clear:()=>{saveHistory([]);renderHistory();renderCommandCenter();}},
    askSakura,
    health:()=>({status:"ok",value:"Centro de mando v17.15.0",detail:"Lectura local por rol, buscador universal, aprobaciones, capacidad, historial y contexto SAKURA. Sin polling, MutationObserver, SQL ni canales Realtime nuevos."})
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
