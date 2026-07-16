/* ===== v16.0 PRODUCTIVITY & REALTIME CORE ===== */
(function () {
  "use strict";

  if (window.INBESTIGA_PRODUCTIVITY_REALTIME) return;

  const VERSION = "v16.0";
  const BUILD = "PRODUCTIVITY & REALTIME CORE";
  const SNOOZE_KEY = "inbestiga:v16:notification-snooze";
  const MUTE_KEY = "inbestiga:v16:notification-mutes";
  const CERT_KEY = "inbestiga:v16:last-certification";
  const TABLES = ["notifications", "messages", "tasks", "campaigns", "live_presence"];

  let realtimeChannel = null;
  let realtimeState = "idle";
  let lastRealtimeEvent = null;
  let syncTimer = null;
  let showSnoozed = false;

  const escHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);

  const sameId = (a, b) => String(a ?? "") === String(b ?? "");
  const list = (value) => (Array.isArray(value) ? value : []);

  function statusKey(value) {
    return typeof v412StatusKey === "function"
      ? v412StatusKey(value)
      : String(value || "").toLowerCase().replaceAll(" ", "_");
  }

  function isDone(task) {
    return typeof v412TaskDone === "function"
      ? v412TaskDone(task)
      : ["aprobado", "publicado", "finalizado", "completado"].includes(statusKey(task?.status));
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "") || fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Preferencias locales opcionales.
    }
  }

  function localDate(value) {
    if (!value) return "Sin fecha";
    try {
      return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return String(value);
    }
  }

  function legacyRealtimeLive() {
    try { return typeof realtimeAvailable !== "undefined" && realtimeAvailable === true; }
    catch { return false; }
  }

  function statusCopy() {
    if (!navigator.onLine) {
      return {
        state: "offline",
        title: "Sin conexión",
        meta: "La interfaz permanece disponible; los datos productivos necesitan internet.",
      };
    }
    if (realtimeState === "live" || legacyRealtimeLive()) {
      return {
        state: "live",
        title: "Actualización en vivo",
        meta: lastRealtimeEvent
          ? `Último cambio ${new Date(lastRealtimeEvent).toLocaleTimeString("es-PE", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "Supabase Realtime conectado.",
      };
    }
    if (realtimeState === "connecting") {
      return {
        state: "connecting",
        title: "Conectando Realtime",
        meta: "Verificando el canal productivo sin modificar datos.",
      };
    }
    if (realtimeState === "error") {
      return {
        state: "error",
        title: "Realtime no disponible",
        meta: "La sincronización manual y loadAll continúan operativos.",
      };
    }
    return {
      state: "idle",
      title: "Sincronización estándar",
      meta: "Activa la conexión en vivo para recibir cambios del equipo.",
    };
  }

  function ensureOfflineBanner() {
    let node = document.getElementById("v16OfflineBanner");
    if (!node) {
      node = document.createElement("div");
      node.id = "v16OfflineBanner";
      node.className = "v16-offline-banner";
      node.textContent =
        "Estás sin conexión. La plataforma conserva la interfaz, pero las operaciones productivas deben esperar a recuperar internet.";
      document.body.appendChild(node);
    }
    node.classList.toggle("show", !navigator.onLine);
  }

  function liveStripHtml() {
    const copy = statusCopy();
    return `
      <div class="v16-live-strip" data-state="${copy.state}">
        <div class="v16-live-copy">
          <i></i>
          <div>
            <strong>${escHtml(copy.title)}</strong>
            <span>${escHtml(copy.meta)}</span>
          </div>
        </div>
        <div class="v16-live-actions">
          <button type="button" data-v16-live="certify">Certificar servicios</button>
          <button type="button" data-v16-live="sync">Sincronizar</button>
          <button type="button" data-v16-live="toggle" class="primary">
            ${realtimeState === "live" || legacyRealtimeLive() ? "Revisar conexión" : "Conectar en vivo"}
          </button>
        </div>
      </div>`;
  }

  function injectLiveStrips() {
    const targets = [
      document.querySelector("#notifications .v15-notification-center"),
      document.querySelector("#workload .v15-workload-summary"),
      document.querySelector("#campaigns .v15-campaign-os"),
    ].filter(Boolean);

    targets.forEach((target, index) => {
      const parent = target.parentElement;
      if (!parent) return;
      let strip = parent.querySelector(`:scope > .v16-live-strip[data-slot="${index}"]`);
      const holder = document.createElement("div");
      holder.innerHTML = liveStripHtml();
      const next = holder.firstElementChild;
      next.dataset.slot = String(index);
      if (strip) strip.replaceWith(next);
      else target.insertAdjacentElement("beforebegin", next);
    });
  }

  function refreshLiveUi() {
    ensureOfflineBanner();
    injectLiveStrips();
  }

  function scheduleProductiveRefresh() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        if (typeof safeSync === "function") await safeSync("v16_realtime");
        else if (typeof loadAll === "function") await loadAll();
        window.INBESTIGA_COLLABORATION_OS?.refresh?.();
        renderCapacityCenter();
        renderCampaignIntelligence();
        enhanceNotifications();
      } catch (error) {
        console.warn("[v16] realtime refresh", error);
      }
    }, 450);
  }

  function realtimeSchema() {
    return window.INBESTIGA_REALTIME_CONFIG?.schema || "marketing_app";
  }

  function stopRealtime() {
    if (realtimeChannel && typeof sb !== "undefined" && sb?.removeChannel) {
      try {
        sb.removeChannel(realtimeChannel);
      } catch {
        // El canal es opcional.
      }
    }
    realtimeChannel = null;
    realtimeState = "idle";
    refreshLiveUi();
  }

  function startRealtime() {
    if (!navigator.onLine) {
      realtimeState = "offline";
      refreshLiveUi();
      return;
    }

    try {
      if (typeof window.startRealtime === "function") {
        window.startRealtime();
        realtimeState = legacyRealtimeLive() ? "live" : "connecting";
        refreshLiveUi();
        setTimeout(() => {
          realtimeState = legacyRealtimeLive() ? "live" : (typeof realtimeStarted !== "undefined" && realtimeStarted ? "connecting" : "error");
          refreshLiveUi();
        }, 900);
        return;
      }
    } catch (error) {
      console.warn("[v16] legacy realtime bridge", error);
    }

    if (
      typeof sb === "undefined" ||
      !sb?.channel ||
      !(typeof authUser !== "undefined" && authUser?.id)
    ) {
      realtimeState = "error";
      refreshLiveUi();
      return;
    }

    stopRealtime();
    realtimeState = "connecting";
    refreshLiveUi();

    try {
      const channel = sb.channel(`inbestiga-v16-${authUser.id}`);
      const schema = realtimeSchema();

      TABLES.forEach((table) => {
        channel.on(
          "postgres_changes",
          { event: "*", schema, table },
          (payload) => {
            lastRealtimeEvent = new Date().toISOString();
            window.dispatchEvent(
              new CustomEvent("inbestiga:realtime-event", {
                detail: { table, event: payload?.eventType || "change" },
              }),
            );
            scheduleProductiveRefresh();
            refreshLiveUi();
          },
        );
      });

      realtimeChannel = channel.subscribe((status) => {
        if (status === "SUBSCRIBED") realtimeState = "live";
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          realtimeState = "error";
        }
        refreshLiveUi();
      });
    } catch (error) {
      console.warn("[v16] realtime", error);
      realtimeState = "error";
      refreshLiveUi();
    }
  }

  async function manualSync() {
    try {
      if (typeof safeSync === "function") await safeSync("v16_manual");
      else if (typeof loadAll === "function") await loadAll();
      window.INBESTIGA_COLLABORATION_OS?.refresh?.();
      renderCapacityCenter();
      renderCampaignIntelligence();
      enhanceNotifications();
      if (typeof premiumToast === "function") {
        premiumToast("Sincronización completada", "Los módulos operativos fueron actualizados.", "success");
      }
    } catch (error) {
      if (typeof premiumToast === "function") {
        premiumToast("No se pudo sincronizar", error?.message || String(error), "warning");
      }
    }
  }

  function notificationType(id) {
    const prefix = String(id || "").split(":")[0];
    if (prefix === "m") return "message";
    if (prefix === "t") return "task";
    const raw = list(state?.notifications).find((item) => `n:${item.id}` === id);
    return String(raw?.entity_type || "system").toLowerCase();
  }

  function cleanSnoozes() {
    const map = readJson(SNOOZE_KEY, {});
    const now = Date.now();
    Object.keys(map).forEach((key) => {
      if (Number(map[key]) <= now) delete map[key];
    });
    writeJson(SNOOZE_KEY, map);
    return map;
  }

  function notificationPrefs() {
    return {
      snoozed: cleanSnoozes(),
      muted: new Set(readJson(MUTE_KEY, [])),
    };
  }

  function ensureNotificationTools() {
    const center = document.getElementById("v15NotificationCenter");
    if (!center) return null;

    let tools = document.getElementById("v16NotificationTools");
    if (!tools) {
      tools = document.createElement("div");
      tools.id = "v16NotificationTools";
      tools.className = "v16-notification-tools";
      tools.innerHTML = `
        <p id="v16NotifPreferenceMeta">
          Control local de lectura: pospone novedades sin alterar los datos productivos.
        </p>
        <div class="v16-notif-actions">
          <button type="button" data-v16-notif-command="read">Marcar notificaciones leídas</button>
          <button type="button" data-v16-notif-command="snoozed">Ver pospuestas</button>
          <button type="button" data-v16-notif-command="reset">Restablecer</button>
        </div>`;
      center.querySelector(".v15-notif-toolbar")?.insertAdjacentElement("afterend", tools);
    }
    return tools;
  }

  function enhanceNotifications() {
    const center = document.getElementById("v15NotificationCenter");
    if (!center) return;

    ensureNotificationTools();
    const prefs = notificationPrefs();
    let hidden = 0;

    center.querySelectorAll(".v15-notif-item").forEach((article) => {
      const openButton = article.querySelector("[data-v15-notif]");
      if (!openButton) return;

      const id = openButton.dataset.v15Notif;
      const type = notificationType(id);
      const isSnoozed = Number(prefs.snoozed[id] || 0) > Date.now();
      const isMuted = prefs.muted.has(type);

      article.classList.toggle("v16-snoozed", isSnoozed);
      article.classList.toggle("v16-muted", isMuted);
      if (isSnoozed || isMuted) hidden += 1;

      let actions = article.querySelector(".v16-item-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "v16-item-actions";
        openButton.replaceWith(actions);
        actions.appendChild(openButton);

        const snooze = document.createElement("button");
        snooze.type = "button";
        snooze.dataset.v16Snooze = id;
        snooze.textContent = "Posponer 1 h";

        const mute = document.createElement("button");
        mute.type = "button";
        mute.dataset.v16Mute = type;
        mute.textContent = "Silenciar tipo";

        actions.append(snooze, mute);
      }
    });

    center.classList.toggle("v16-show-snoozed", showSnoozed);
    const meta = document.getElementById("v16NotifPreferenceMeta");
    if (meta) {
      meta.textContent = hidden
        ? `${hidden} novedad${hidden === 1 ? "" : "es"} pospuesta${hidden === 1 ? "" : "s"} o silenciada${hidden === 1 ? "" : "s"}. Los filtros son personales y locales.`
        : "No hay novedades pospuestas ni tipos silenciados.";
    }
  }

  function notificationCommand(action) {
    if (action === "read") {
      if (typeof markAllNotificationsRead === "function") return markAllNotificationsRead();
      return navTo("notifications");
    }
    if (action === "snoozed") {
      showSnoozed = !showSnoozed;
      enhanceNotifications();
      return;
    }
    if (action === "reset") {
      writeJson(SNOOZE_KEY, {});
      writeJson(MUTE_KEY, []);
      showSnoozed = false;
      enhanceNotifications();
      if (typeof premiumToast === "function") {
        premiumToast("Preferencias restablecidas", "Todas las novedades vuelven a mostrarse.", "success");
      }
    }
  }

  function snoozeNotification(id) {
    const map = cleanSnoozes();
    map[id] = Date.now() + 3600000;
    writeJson(SNOOZE_KEY, map);
    enhanceNotifications();
  }

  function muteNotificationType(type) {
    const muted = new Set(readJson(MUTE_KEY, []));
    muted.add(type);
    writeJson(MUTE_KEY, [...muted]);
    enhanceNotifications();
  }

  function taskHours(task) {
    const candidates = [
      task?.estimated_hours,
      task?.estimate_hours,
      task?.planned_hours,
      task?.hours_estimated,
      task?.effort_hours,
    ];
    for (const value of candidates) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) return Math.min(number, 80);
    }
    const priority = String(task?.priority || "").toLowerCase();
    if (priority.includes("alta") || priority.includes("high")) return 4;
    if (priority.includes("media") || priority.includes("medium")) return 2.5;
    return 1.5;
  }

  function memberCapacity(memberRow) {
    const candidates = [
      memberRow?.weekly_capacity_hours,
      memberRow?.capacity_hours,
      memberRow?.available_hours,
    ];
    for (const value of candidates) {
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) return Math.min(number, 80);
    }
    return 40;
  }

  function capacityModel() {
    const now = new Date();
    const limit = new Date(now.getTime() + 7 * 86400000);
    const open = list(state?.tasks).filter((task) => !isDone(task));
    const members = list(state?.members).filter((row) => row.status !== "inactive");

    return members
      .map((row) => {
        const tasks = open.filter((task) => sameId(task.assigned_to, row.id));
        const week = tasks.filter((task) => {
          if (!task.due_date) return true;
          const due = new Date(`${String(task.due_date).slice(0, 10)}T23:59:59`);
          return due <= limit;
        });
        const hours = week.reduce((sum, task) => sum + taskHours(task), 0);
        const capacity = memberCapacity(row);
        const utilization = Math.round((hours / capacity) * 100);
        const late = tasks.filter(
          (task) => typeof v412TaskOverdue === "function"
            ? v412TaskOverdue(task)
            : (task.due_date && typeof today === "function" && task.due_date < today() && !isDone(task)),
        ).length;
        return { member: row, tasks, week, hours, capacity, utilization, late };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }

  function renderCapacityCenter() {
    const section = document.getElementById("workload");
    const grid = document.getElementById("workloadGrid");
    if (!section || !grid) return;

    let center = document.getElementById("v16CapacityCenter");
    if (!center) {
      center = document.createElement("section");
      center.id = "v16CapacityCenter";
      center.className = "v16-capacity-center";
      const anchor = document.getElementById("v15Rebalance") || grid;
      anchor.insertAdjacentElement("afterend", center);
    }

    const cards = capacityModel().slice(0, 8);
    center.innerHTML = `
      <div class="v16-capacity-head">
        <div>
          <span class="v413-eyebrow">CAPACIDAD SEMANAL</span>
          <h3>Horas estimadas y carga real en una sola lectura.</h3>
          <p>
            La plataforma usa horas registradas cuando existen y un estimado conservador
            cuando una tarea todavía no tiene esfuerzo definido.
          </p>
        </div>
        <div class="v16-capacity-actions">
          <button type="button" data-v16-capacity="tasks">Ver tareas</button>
          <button type="button" data-v16-capacity="refresh">Recalcular</button>
        </div>
      </div>
      <div class="v16-capacity-grid">
        ${
          cards.length
            ? cards
                .map((item) => {
                  const tone =
                    item.utilization > 110
                      ? "danger"
                      : item.utilization > 85
                        ? "warning"
                        : "good";
                  return `
                    <article class="v16-capacity-card" data-tone="${tone}" data-v16-member="${escHtml(item.member.id)}">
                      <span>${item.late ? `${item.late} vencida${item.late === 1 ? "" : "s"}` : "Ritmo semanal"}</span>
                      <strong>${escHtml(item.member.full_name || "Miembro")}</strong>
                      <small>${item.hours.toFixed(1)} h estimadas de ${item.capacity} h · ${item.tasks.length} tareas abiertas</small>
                      <div class="v16-capacity-track"><i style="width:${Math.min(100, item.utilization)}%"></i></div>
                    </article>`;
                })
                .join("")
            : '<div class="v15-empty">No hay miembros activos para calcular capacidad.</div>'
        }
      </div>`;
  }

  function dependencyId(task) {
    return (
      task?.dependency_id ||
      task?.depends_on ||
      task?.blocked_by_task_id ||
      task?.parent_task_id ||
      ""
    );
  }

  function currentCampaignModel() {
    const select = document.getElementById("v15CampaignSelect");
    const campaignId = select?.value || "";
    if (!campaignId) return null;

    const campaign = list(state?.campaigns).find((item) => sameId(item.id, campaignId));
    if (!campaign) return null;

    const tasks = list(state?.tasks).filter((task) => sameId(task.campaign_id, campaignId));
    const rooms = list(state?.cr_rooms).filter(
      (room) =>
        sameId(room.campaign_id, campaignId) ||
        sameId(room.board_state?.campaign_id, campaignId),
    );
    const open = tasks.filter((task) => !isDone(task));
    const milestones = open
      .slice()
      .sort((a, b) =>
        String(a.due_date || "9999-12-31").localeCompare(
          String(b.due_date || "9999-12-31"),
        ),
      )
      .slice(0, 6);
    const dependencies = tasks
      .map((task) => ({ task, dependency: dependencyId(task) }))
      .filter(
        (item) => item.dependency || statusKey(item.task.status).includes("bloq"),
      );

    return { campaign, tasks, rooms, milestones, dependencies };
  }

  function renderCampaignIntelligence() {
    const body = document.getElementById("v15CampaignBody");
    const workspace = document.getElementById("v15CampaignWorkspace");
    if (!body || !workspace) return;

    let host = document.getElementById("v16CampaignIntelligence");
    if (!host) {
      host = document.createElement("section");
      host.id = "v16CampaignIntelligence";
      host.className = "v16-campaign-intelligence";
      body.insertAdjacentElement("afterend", host);
    }

    const model = currentCampaignModel();
    if (!model) {
      host.innerHTML = "";
      return;
    }

    const milestones = model.milestones.length
      ? model.milestones
          .map(
            (task) => `
              <article class="v16-milestone">
                <time>${escHtml(localDate(task.due_date))}</time>
                <div>
                  <strong>${escHtml(task.title || "Tarea")}</strong>
                  <span>${escHtml(typeof memberName === "function" ? memberName(task.assigned_to) : "Sin responsable")} · ${escHtml(statusKey(task.status).replaceAll("_", " "))}</span>
                </div>
                <button type="button" data-v16-task="${escHtml(task.id)}">Abrir</button>
              </article>`,
          )
          .join("")
      : '<div class="v15-empty">No hay próximos hitos pendientes.</div>';

    const dependencies = model.dependencies.length
      ? model.dependencies
          .slice(0, 5)
          .map((item) => {
            const parent = model.tasks.find((task) => sameId(task.id, item.dependency));
            return `
              <article class="v16-dependency warning">
                <strong>${escHtml(item.task.title || "Tarea bloqueada")}</strong>
                <span>${
                  parent
                    ? `Depende de ${escHtml(parent.title || "otra tarea")}`
                    : "Marcada como bloqueada; revisa la dependencia o el responsable."
                }</span>
              </article>`;
          })
          .join("")
      : `
        <article class="v16-dependency">
          <strong>Flujo sin bloqueos declarados</strong>
          <span>No se detectaron campos de dependencia ni estados bloqueados en la campaña.</span>
        </article>`;

    host.innerHTML = `
      <article class="v16-campaign-panel">
        <h3>Próximos hitos</h3>
        <p>Ordenados por fecha para que el equipo vea qué movimiento sostiene el avance.</p>
        <div class="v16-milestone-list">${milestones}</div>
      </article>
      <aside class="v16-campaign-panel">
        <h3>Dependencias y continuidad</h3>
        <p>Lectura preventiva de bloqueos y conexiones con Creative Arena.</p>
        <div class="v16-dependency-list">${dependencies}</div>
        <div class="v16-campaign-actions">
          ${
            model.rooms[0]
              ? `<button type="button" class="primary" data-v16-room="${escHtml(model.rooms[0].id)}">Abrir pizarra vinculada</button>`
              : ""
          }
          <button type="button" data-v16-campaign-export="${escHtml(model.campaign.id)}">Exportar resumen</button>
        </div>
      </aside>`;
  }

  function exportCampaign(id) {
    const campaign = list(state?.campaigns).find((item) => sameId(item.id, id));
    if (!campaign) return;

    const tasks = list(state?.tasks).filter((task) => sameId(task.campaign_id, id));
    const assets = list(state?.assets).filter((asset) => sameId(asset.campaign_id, id));
    const briefs = list(state?.briefs).filter((brief) => sameId(brief.campaign_id, id));
    const payload = {
      version: VERSION,
      generated_at: new Date().toISOString(),
      campaign,
      tasks,
      briefs,
      assets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `INBESTIGA_campaign_${String(campaign.name || id).replace(/[^a-z0-9_-]+/gi, "_")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function addPaletteItems() {
    if (typeof V12_PALETTE_ITEMS === "undefined") return;

    for (let index = V12_PALETTE_ITEMS.length - 1; index >= 0; index -= 1) {
      if (String(V12_PALETTE_ITEMS[index]?.key || "").startsWith("v16:")) {
        V12_PALETTE_ITEMS.splice(index, 1);
      }
    }

    const items = [];
    list(state?.clients)
      .slice(0, 8)
      .forEach((client, index) =>
        items.push({
          key: `v16:client:${client.id}`,
          code: `CL${index + 1}`,
          title: client.name || client.company_name || "Cliente",
          meta: "Cliente · abrir campañas",
          action: () => navTo("campaigns"),
        }),
      );

    list(state?.cr_rooms)
      .slice(0, 8)
      .forEach((room, index) =>
        items.push({
          key: `v16:room:${room.id}`,
          code: `B${index + 1}`,
          title: room.name || room.title || "Pizarra",
          meta: "Creative Arena · abrir pizarra",
          action: () => {
            navTo("creativeRoomsClean");
            setTimeout(() => window.CreativeArenaClean?.openBoard?.(room.id), 70);
          },
        }),
      );

    list(state?.messages)
      .filter((message) => sameId(message.recipient_id || message.receiver_id, member?.id))
      .slice(0, 8)
      .forEach((message, index) =>
        items.push({
          key: `v16:message:${message.id}`,
          code: `M${index + 1}`,
          title:
            (typeof memberName === "function" ? memberName(message.sender_id) : "Mensaje") ||
            "Mensaje",
          meta: `Mensaje · ${String(message.text_content || "").slice(0, 60)}`,
          action: () => {
            navTo("messages");
            setTimeout(
              () =>
                typeof selectConversation === "function" &&
                selectConversation(message.sender_id),
              40,
            );
          },
        }),
      );

    items.push({
      key: "v16:certification",
      code: "Q1",
      title: "Certificar servicios productivos",
      meta: "Supabase, RPC, Storage, Realtime y PWA",
      action: () => window.INBESTIGA_PRODUCTION_CERTIFICATION?.open?.("automatic") || certify(),
    });

    V12_PALETTE_ITEMS.push(...items);
  }

  async function testStorage() {
    if (typeof sb === "undefined" || !sb?.storage) {
      return { status: "warn", value: "No disponible", meta: "Cliente Storage no cargado" };
    }
    try {
      const bucket = window.INBESTIGA_MEDIA_BUCKET || "inbestiga-media";
      const prefix =
        (typeof member !== "undefined" && member?.id) ||
        (typeof authUser !== "undefined" && authUser?.id) ||
        "";
      const { error } = await sb.storage.from(bucket).list(prefix, { limit: 1 });
      if (error) throw error;
      return {
        status: "ok",
        value: "Accesible",
        meta: `Bucket ${bucket} disponible para la sesión.`,
      };
    } catch (error) {
      return {
        status: "warn",
        value: "Pendiente",
        meta: error?.message || String(error),
      };
    }
  }

  async function testRealtime() {
    if (!navigator.onLine) {
      return {
        status: "warn",
        value: "Sin conexión",
        meta: "Recupera internet para certificar Realtime.",
      };
    }
    if (typeof sb === "undefined" || !sb?.channel) {
      return {
        status: "warn",
        value: "No disponible",
        meta: "Cliente Realtime no cargado.",
      };
    }

    return new Promise((resolve) => {
      let settled = false;
      let channel = null;
      let timeout = null;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
          if (channel && sb?.removeChannel) sb.removeChannel(channel);
        } catch {
          // Canal de prueba opcional.
        }
        resolve(result);
      };

      timeout = setTimeout(
        () =>
          finish({
            status: "warn",
            value: "Sin confirmación",
            meta: "El canal no confirmó suscripción en 4 segundos.",
          }),
        4000,
      );

      try {
        channel = sb.channel(`inbestiga-v16-cert-${Date.now()}`).subscribe((status) => {
          if (status === "SUBSCRIBED") {
            finish({
              status: "ok",
              value: "Conectado",
              meta: "El servicio Realtime confirmó el canal de prueba.",
            });
          } else if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
            finish({
              status: "warn",
              value: "No confirmado",
              meta: `Estado recibido: ${status}`,
            });
          }
        });
      } catch (error) {
        finish({
          status: "warn",
          value: "No disponible",
          meta: error?.message || String(error),
        });
      }
    });
  }

  async function certify() {
    if (typeof premiumToast === "function") {
      premiumToast(
        "Certificación iniciada",
        "Las pruebas son de solo lectura y no alteran registros.",
        "success",
      );
    }

    let diagnostics = null;
    try {
      diagnostics = await window.INBESTIGA_PLATFORM_DIAGNOSTICS?.run?.({ network: true });
    } catch (error) {
      diagnostics = {
        openapi: { available: false, reason: error?.message || String(error) },
        missing_rpcs: [],
      };
    }

    const [storage, realtime] = await Promise.all([testStorage(), testRealtime()]);
    const sessionActive = typeof authUser !== "undefined" && authUser?.id;
    const tests = [
      {
        name: "Sesión",
        status: sessionActive ? "ok" : "warn",
        value: sessionActive ? "Activa" : "Pendiente",
        meta: "Se requiere una cuenta real para validar políticas.",
      },
      {
        name: "RPC",
        status: diagnostics?.openapi?.available
          ? diagnostics.missing_rpcs?.length
            ? "fail"
            : "ok"
          : "warn",
        value: diagnostics?.openapi?.available
          ? diagnostics.missing_rpcs?.length
            ? `${diagnostics.missing_rpcs.length} faltantes`
            : "Verificadas"
          : "Sin OpenAPI",
        meta:
          diagnostics?.openapi?.reason ||
          `${diagnostics?.required_rpcs || 45} funciones requeridas.`,
      },
      { name: "Storage", ...storage },
      { name: "Realtime", ...realtime },
      {
        name: "Conectividad",
        status: navigator.onLine ? "ok" : "warn",
        value: navigator.onLine ? "En línea" : "Offline",
        meta: "Estado actual del navegador.",
      },
      {
        name: "PWA",
        status: "serviceWorker" in navigator ? "ok" : "warn",
        value: "serviceWorker" in navigator ? "Compatible" : "No compatible",
        meta:
          location.protocol === "https:" || location.hostname === "localhost"
            ? "El shell puede instalarse y almacenarse en caché."
            : "La instalación requiere HTTPS o localhost.",
      },
    ];

    const report = {
      version: VERSION,
      build: BUILD,
      generated_at: new Date().toISOString(),
      tests,
      diagnostics,
    };
    writeJson(CERT_KEY, report);

    const body = `
      <div class="v16-cert-grid">
        ${tests
          .map(
            (test) => `
              <article class="v16-cert-card" data-status="${test.status}">
                <span>${escHtml(test.name)}</span>
                <strong>${escHtml(test.value)}</strong>
                <small>${escHtml(test.meta)}</small>
              </article>`,
          )
          .join("")}
      </div>
      <div class="v16-cert-note">
        No se ejecutaron inserciones, actualizaciones ni eliminaciones. Las políticas
        RLS de escritura solo pueden certificarse mediante un plan de pruebas controlado
        con cuentas productivas.
      </div>`;

    if (typeof openPremiumModal === "function") {
      openPremiumModal({
        title: "Certificación productiva",
        subtitle: `${VERSION} · RPC, Storage, Realtime y PWA`,
        body,
        actions: [{ label: "Cerrar", value: null, className: "primary" }],
      });
    }
    return report;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((error) =>
        console.info("[v16] service worker opcional", error?.message || error),
      );
  }

  function refresh() {
    refreshLiveUi();
    enhanceNotifications();
    renderCapacityCenter();
    renderCampaignIntelligence();
    addPaletteItems();
  }

  function wire() {
    document.addEventListener("click", (event) => {
      const live = event.target.closest("[data-v16-live]")?.dataset.v16Live;
      if (live === "certify") return window.INBESTIGA_PRODUCTION_CERTIFICATION?.open?.("automatic") || certify();
      if (live === "sync") return manualSync();
      if (live === "toggle") return startRealtime();

      const notificationAction = event.target.closest("[data-v16-notif-command]")?.dataset
        .v16NotifCommand;
      if (notificationAction) return notificationCommand(notificationAction);

      const snooze = event.target.closest("[data-v16-snooze]")?.dataset.v16Snooze;
      if (snooze) return snoozeNotification(snooze);

      const mute = event.target.closest("[data-v16-mute]")?.dataset.v16Mute;
      if (mute) return muteNotificationType(mute);

      const capacity = event.target.closest("[data-v16-capacity]")?.dataset.v16Capacity;
      if (capacity === "tasks") return navTo("tasks");
      if (capacity === "refresh") return renderCapacityCenter();

      const memberId = event.target.closest("[data-v16-member]")?.dataset.v16Member;
      if (memberId && typeof openMemberProfile === "function") {
        return openMemberProfile(memberId);
      }

      const taskId = event.target.closest("[data-v16-task]")?.dataset.v16Task;
      if (taskId) {
        return typeof v412OpenTask === "function"
          ? v412OpenTask(taskId)
          : homeOpenTask(taskId);
      }

      const roomId = event.target.closest("[data-v16-room]")?.dataset.v16Room;
      if (roomId) {
        navTo("creativeRoomsClean");
        return setTimeout(() => window.CreativeArenaClean?.openBoard?.(roomId), 70);
      }

      const campaignId = event.target.closest("[data-v16-campaign-export]")?.dataset
        .v16CampaignExport;
      if (campaignId) return exportCampaign(campaignId);

      if (event.target.closest("#v15CampaignSelect,[data-v15-tab]")) {
        setTimeout(renderCampaignIntelligence, 0);
      }
      if (event.target.closest("#v15NotificationCenter")) {
        setTimeout(enhanceNotifications, 0);
      }
    });

    window.addEventListener("online", () => {
      realtimeState = "idle";
      refreshLiveUi();
      startRealtime();
    });
    window.addEventListener("offline", () => {
      realtimeState = "offline";
      refreshLiveUi();
    });
  }

  const baseRenderNotifications =
    typeof renderNotifications === "function" ? renderNotifications : null;
  if (baseRenderNotifications) {
    renderNotifications = function () {
      const result = baseRenderNotifications.apply(this, arguments);
      queueMicrotask(enhanceNotifications);
      return result;
    };
  }

  const baseRenderWorkload = typeof renderWorkload === "function" ? renderWorkload : null;
  if (baseRenderWorkload) {
    renderWorkload = function () {
      const result = baseRenderWorkload.apply(this, arguments);
      queueMicrotask(renderCapacityCenter);
      return result;
    };
  }

  const baseRenderCampaigns =
    typeof renderCampaigns === "function" ? renderCampaigns : null;
  if (baseRenderCampaigns) {
    renderCampaigns = function () {
      const result = baseRenderCampaigns.apply(this, arguments);
      queueMicrotask(renderCampaignIntelligence);
      return result;
    };
  }

  const baseOpenPalette =
    typeof v12OpenCommandPalette === "function" ? v12OpenCommandPalette : null;
  if (baseOpenPalette) {
    v12OpenCommandPalette = function () {
      addPaletteItems();
      return baseOpenPalette.apply(this, arguments);
    };
  }

  const baseLoadAll = typeof loadAll === "function" ? loadAll : null;
  if (baseLoadAll) {
    loadAll = async function () {
      const result = await baseLoadAll.apply(this, arguments);
      queueMicrotask(refresh);
      return result;
    };
  }

  function init() {
    wire();
    registerServiceWorker();
    refresh();
    if (navigator.onLine) setTimeout(() => {
      if (legacyRealtimeLive()) { realtimeState = "live"; refreshLiveUi(); }
      else startRealtime();
    }, 350);

    window.INBESTIGA_QUALITY_CORE?.register?.("productivity-realtime-core", {
      version: VERSION,
      mode: "productive-readonly-bridge",
    });

    window.INBESTIGA_PRODUCTIVITY_REALTIME = {
      version: VERSION,
      build: BUILD,
      refresh,
      certify,
      startRealtime,
      stopRealtime,
      capacity: capacityModel,
      lastCertification: () => readJson(CERT_KEY, null),
    };

    window.INBESTIGA_BUILD = {
      ...(window.INBESTIGA_BUILD || {}),
      version: VERSION,
      name: BUILD,
    };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
