/* ===== INBESTIGA v17.12.8 · MOBILE CREATIVE NAVIGATION · OBSERVER CONFLICT HOTFIX ===== */
(() => {
  "use strict";

  const VERSION = "v17.12.8";
  const MOBILE_QUERY = "(max-width: 980px)";
  const MANAGER_ROLES = new Set([
    "italo", "jhulio", "alejandro", "admin", "director", "owner", "ceo",
    "gerente", "supervisor", "marketing_lead"
  ]);

  const PUBLIC_GROUPS = [
    {
      id: "creative",
      label: "Creativo",
      title: "Crea y colabora",
      links: [
        ["Salas creativas", "creativeRoomsClean", "Pizarras, ideas y colaboración visual"],
        ["Creative Hub", "hub", "Inspiración y recursos del equipo"],
        ["Archivos", "assets", "Biblioteca de materiales"],
        ["Plantillas", "templates", "Formatos reutilizables"]
      ]
    },
    {
      id: "work",
      label: "Trabajo",
      title: "Organiza tu ejecución",
      links: [
        ["Mi día", "myday", "Prioridades y entregas personales"],
        ["Trabajo 360", "workIntel", "Vista operativa de tu trabajo"],
        ["Horario Pro", "schedulePro", "Agenda y distribución del tiempo"],
        ["Tareas", "tasks", "Asignaciones, entregas y revisiones"]
      ]
    },
    {
      id: "planning",
      label: "Planificación",
      title: "Campañas y calendario",
      links: [
        ["Campañas / Briefs", "campaigns", "Clientes, campañas y briefs"],
        ["Editorial", "editorial", "Plan de contenidos"],
        ["Calendario operativo", "calendarOps", "Fechas y programación"],
        ["Plantillas", "templates", "Recursos reutilizables"]
      ]
    },
    {
      id: "social",
      label: "Social",
      title: "Comunicación del equipo",
      links: [
        ["Muro", "wall", "Actualizaciones y publicaciones"],
        ["Mensajes", "messages", "Conversaciones internas"],
        ["Notificaciones", "notifications", "Alertas y actividad"],
        ["En vivo", "live", "Presencia del equipo"],
        ["Mi basurero", "socialTrash", "Elementos eliminados"]
      ]
    },
    {
      id: "personal",
      label: "Personal",
      title: "Tu espacio",
      links: [
        ["Inicio", "home", "Vista general"],
        ["Mi espacio", "profile", "Perfil y progreso"],
        ["Buscador", "search", "Encuentra cualquier módulo"],
        ["Conexión", "settings", "Preferencias del dispositivo"]
      ]
    }
  ];

  const MANAGER_GROUPS = [
    {
      id: "control",
      label: "Control",
      title: "Supervisión y análisis",
      links: [
        ["Aprobaciones", "approvals", "Revisión de entregas"],
        ["Carga del equipo", "workload", "Capacidad y distribución"],
        ["Control gerencial", "control", "Indicadores operativos"],
        ["Reportes Pro", "reports", "Reportes y exportaciones"],
        ["Auditoría Pro", "auditpro", "Historial y salud del sistema"]
      ]
    },
    {
      id: "admin",
      label: "Admin",
      title: "Administración",
      links: [
        ["Administración", "admin", "Usuarios y catálogos"],
        ["Equipo", "team", "Integrantes y perfiles"],
        ["Seguridad y gobernanza", "governance", "Controles administrativos"]
      ]
    }
  ];

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function currentRole() {
    try {
      if (typeof member !== "undefined" && member) {
        return String(member.role_code || member.role || "member").toLowerCase();
      }
    } catch (_) {}
    return "member";
  }

  function isManager() {
    const role = currentRole();
    if (MANAGER_ROLES.has(role)) return true;
    try {
      return typeof isSupervisor === "function" && Boolean(isSupervisor());
    } catch (_) {
      return false;
    }
  }

  function availableGroups() {
    return isManager() ? [...PUBLIC_GROUPS, ...MANAGER_GROUPS] : PUBLIC_GROUPS;
  }

  function patchVersionLabels() {
    document.documentElement.setAttribute("data-inbestiga-build", VERSION);
    document.querySelectorAll(".v472-brand-text small").forEach((node) => {
      if ((node.textContent || "").trim() !== VERSION) node.textContent = VERSION;
      if (node.getAttribute("title") !== "Versión actual de Marketing Cloud") {
        node.setAttribute("title", "Versión actual de Marketing Cloud");
      }
    });
    const legacySidebarVersion = document.querySelector("#appScreen .side .brand .small");
    if (legacySidebarVersion && /v4\./i.test(legacySidebarVersion.textContent || "")) {
      legacySidebarVersion.textContent = `${VERSION} · Marketing Cloud`;
    }
  }

  function closeDirectory() {
    const mega = document.getElementById("v472Mega");
    const dim = document.getElementById("v472Dim");
    if (mega) {
      mega.classList.remove("open", "v17111-mobile-directory");
      mega.removeAttribute("data-v17111-mobile-directory");
    }
    if (dim) dim.classList.remove("show");
  }

  function navigate(sectionId) {
    closeDirectory();
    try {
      if (typeof navTo === "function") navTo(sectionId);
      else if (typeof window.navTo === "function") window.navTo(sectionId);
    } catch (error) {
      console.warn("[v17.12] No se pudo abrir la sección", sectionId, error);
    }
  }

  function groupMarkup(group) {
    return `
      <section class="v17111-mobile-group" data-v17111-group="${escapeHtml(group.id)}">
        <div class="v17111-mobile-group-head">
          <span>${escapeHtml(group.label)}</span>
          <strong>${escapeHtml(group.title)}</strong>
        </div>
        <div class="v17111-mobile-links">
          ${group.links.map(([label, section, detail]) => `
            <button type="button" data-v17111-nav="${escapeHtml(section)}">
              <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></span>
              <b aria-hidden="true">›</b>
            </button>`).join("")}
        </div>
      </section>`;
  }

  function openDirectory() {
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    const mega = document.getElementById("v472Mega");
    const dim = document.getElementById("v472Dim");
    if (!mega || !dim) return;

    const role = currentRole();
    mega.innerHTML = `
      <div class="v17111-mobile-directory-inner">
        <header class="v17111-mobile-directory-head">
          <div>
            <span>MARKETING CLOUD ${VERSION}</span>
            <h2>Todos los espacios</h2>
            <p>Acceso móvil para ${escapeHtml(role === "member" ? "miembros" : "gestión y supervisión")}.</p>
          </div>
          <button type="button" data-v17111-close aria-label="Cerrar navegación">×</button>
        </header>
        <button type="button" class="v17111-creative-hero" data-v17111-nav="creativeRoomsClean">
          <span class="v17111-creative-icon" aria-hidden="true">✦</span>
          <span><small>ACCESO DESTACADO</small><strong>Salas creativas</strong><em>Abre tus pizarras y espacios de colaboración.</em></span>
          <b aria-hidden="true">›</b>
        </button>
        <div class="v17111-mobile-directory-groups">
          ${availableGroups().map(groupMarkup).join("")}
        </div>
      </div>`;

    mega.classList.add("open", "v17111-mobile-directory");
    mega.setAttribute("data-v17111-mobile-directory", "true");
    dim.classList.add("show");

    mega.querySelector("[data-v17111-close]")?.addEventListener("click", closeDirectory);
    mega.querySelectorAll("[data-v17111-nav]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.getAttribute("data-v17111-nav")));
    });
  }

  function interceptMobileNavigation(event) {
    const trigger = event.target.closest?.("#v472MobileToggle, [data-v415-more='true']");
    if (!trigger || !window.matchMedia(MOBILE_QUERY).matches) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openDirectory();
  }

  function bind() {
    if (window.__INBESTIGA_V17111_MOBILE_NAV__) return;
    window.__INBESTIGA_V17111_MOBILE_NAV__ = true;
    document.addEventListener("click", interceptMobileNavigation, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDirectory();
    });
    window.addEventListener("resize", () => {
      if (!window.matchMedia(MOBILE_QUERY).matches) closeDirectory();
    }, { passive: true });
  }

  function boot() {
    bind();
    patchVersionLabels();
  }

  let versionPatchQueued = false;
  function scheduleVersionPatch() {
    if (versionPatchQueued) return;
    versionPatchQueued = true;
    requestAnimationFrame(() => {
      versionPatchQueued = false;
      patchVersionLabels();
    });
  }
  function versionMutationIsRelevant(records) {
    return records.some((record) => [...record.addedNodes].some((node) => {
      const element = node instanceof Element ? node : node.parentElement;
      if (!element) return false;
      return element.matches?.(".v472-brand-text, .v472-brand-text small, #appScreen .side .brand, #appScreen .side .brand .small") ||
        Boolean(element.querySelector?.(".v472-brand-text small, #appScreen .side .brand .small"));
    }));
  }
  const observer = new MutationObserver((records) => {
    if (versionMutationIsRelevant(records)) scheduleVersionPatch();
  });
  document.addEventListener("DOMContentLoaded", () => {
    boot();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(scheduleVersionPatch, 400);
    setTimeout(scheduleVersionPatch, 1200);
  });
  window.addEventListener("load", () => setTimeout(boot, 300));
})();
