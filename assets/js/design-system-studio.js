/* ===== v17.9 COLLABORATIVE WORKSPACE ===== */
(function () {
  "use strict";
  if (window.INBESTIGA_DESIGN_STUDIO) return;

  const VERSION = "v17.9";
  const BUILD = "DESIGN SYSTEM STUDIO · COLLABORATIVE WORKSPACE";
  const LOCAL_KEY = "inbestiga:v178:design-system";
  const HISTORY_KEY = "inbestiga:v178:design-history";
  const ASSET_KEY = "inbestiga:v178:asset-library";
  const MAX_HISTORY = 24;
  const MAX_ASSETS = 80;
  const FONT_MAP = {
    Inter: 'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    Montserrat: 'Montserrat,Inter,system-ui,sans-serif',
    Cinzel: 'Cinzel,Georgia,serif',
    Rajdhani: 'Rajdhani,Inter,system-ui,sans-serif',
    System: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    Georgia: 'Georgia,"Times New Roman",serif'
  };
  const PRESETS = {
    corporate: { name: "INBESTIGA Corporativo", mode: "light", primary: "#6e26f6", secondary: "#6e2fb2", accent: "#ffba00", background: "#f5f5f7", surface: "#ffffff", text: "#1d1d1f", muted: "#6e6e73", fontBody: "Inter", fontHeading: "Inter" },
    executive: { name: "Executive Black", mode: "dark", primary: "#4f46e5", secondary: "#171717", accent: "#f6c453", background: "#09090b", surface: "#18181b", text: "#fafafa", muted: "#a1a1aa", fontBody: "Inter", fontHeading: "Montserrat" },
    titulation: { name: "INBESTIGA Titulación", mode: "light", primary: "#6e2fb2", secondary: "#6e26f6", accent: "#ffba00", background: "#f8f6fc", surface: "#ffffff", text: "#251833", muted: "#766b80", fontBody: "Montserrat", fontHeading: "Montserrat" },
    midnight: { name: "Midnight Aurora", mode: "dark", primary: "#8b5cf6", secondary: "#2563eb", accent: "#22d3ee", background: "#070b14", surface: "#111827", text: "#f8fafc", muted: "#94a3b8", fontBody: "Inter", fontHeading: "Rajdhani" },
    editorial: { name: "Editorial Warm", mode: "light", primary: "#7c2d12", secondary: "#9a3412", accent: "#f59e0b", background: "#f8f3eb", surface: "#fffdf8", text: "#2a1d16", muted: "#7a6a5f", fontBody: "Georgia", fontHeading: "Cinzel" },
    clean: { name: "Clean Studio", mode: "light", primary: "#0f6fff", secondary: "#0f172a", accent: "#15b8a6", background: "#eef3f8", surface: "#ffffff", text: "#162033", muted: "#657086", fontBody: "Inter", fontHeading: "Inter" }
  };
  const MODULES = [
    ["home", "Inicio"], ["workIntel", "Trabajo 360"], ["tasks", "Tareas"], ["campaigns", "Campañas"],
    ["editorial", "Editorial"], ["wall", "Muro"], ["reports", "Reportes"], ["auditpro", "Auditoría"],
    ["profile", "Mi espacio"], ["messages", "Mensajes"]
  ];
  const SLOTS = {
    intro_hero: { label: "Portada principal del inicio", selector: ".mz-cover-media", module: "home", title: "Bienvenida INBESTIGA", description: "Imagen editorial principal del inicio." },
    home_campaign: { label: "Historia destacada", selector: "#mzLeadStory .mz-lead-media", module: "home", title: "Campaña destacada", description: "Imagen de la historia principal." },
    login_background: { label: "Fondo del acceso", selector: "#loginScreen", module: "login", title: "Acceso seguro", description: "Fondo visual de la pantalla de ingreso." },
    work360_banner: { label: "Banner Trabajo 360", selector: "#workIntel", module: "workIntel", title: "Trabajo 360", description: "Rendimiento, carga y reporte del equipo." },
    campaigns_banner: { label: "Banner de campañas", selector: "#campaigns", module: "campaigns", title: "Proyectos y campañas", description: "Dirección y ejecución de campañas." },
    wall_corporate: { label: "Portada del muro corporativo", selector: "#wall", module: "wall", title: "Muro del equipo", description: "Cultura, avances y reconocimientos." },
    reports_banner: { label: "Banner de reportes", selector: "#reports", module: "reports", title: "Reportes ejecutivos", description: "Lectura estratégica de la operación." },
    profile_banner: { label: "Banner de perfiles", selector: "#profile", module: "profile", title: "Mi espacio", description: "Identidad y personalización del miembro." }
  };
  const SAFE_KEYS = new Set(["mode","primary","secondary","accent","background","surface","surface2","text","muted","radius","baseSize","headingScale","navWidth","fontBody","fontHeading","density","shadow","motion"]);

  let active = null;
  let draft = null;
  let versions = [];
  let assets = [];
  let cloudMode = "local";
  let cloudCanManage = false;
  let currentTab = "global";
  let previewDevice = "desktop";
  let initialized = false;
  let lastError = "";
  let healthCache = null;
  let cloudAuth = "";
  let realtimeChannel = null;
  let realtimeStatus = "inactive";
  let scheduleTimer = null;

  const $ = (id) => document.getElementById(id);
  const text = (value) => String(value ?? "").trim();
  const list = (value) => Array.isArray(value) ? value : [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value) => text(value).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const nowIso = () => new Date().toISOString();
  const memberId = () => { try { return text(member?.id); } catch { return ""; } };
  const authId = () => { try { return text(authUser?.id || session?.user?.id); } catch { return ""; } };
  const isGlobalManager = () => { try { return typeof isDirector === "function" && isDirector(); } catch { return false; } };
  const notify = (title, detail = "", type = "success") => { try { if (typeof premiumToast === "function") premiumToast(title, detail, type); else if (typeof toast === "function") toast(title, detail); } catch { /* visual only */ } };

  function readJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value === null ? fallback : value; } catch { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  function validHex(value, fallback) { const v = text(value); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback; }
  function clamp(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
  function validUrl(value) {
    const url = text(value);
    if (!url) return "";
    if (/^https:\/\//i.test(url)) return url.slice(0, 5000);
    if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(url) && url.length <= 1300000) return url;
    return "";
  }
  function cssUrl(value) { return text(value).replace(/["'\\\n\r]/g, (m) => encodeURIComponent(m)); }
  function defaultSlots() {
    return Object.fromEntries(Object.keys(SLOTS).map((key) => [key, { url: "", alt: SLOTS[key].label, focal: "center", overlay: 62, zoom: 102, saturation: 100, enabled: true, startAt: "", endAt: "" }]));
  }
  function defaultModules() { return Object.fromEntries(MODULES.map(([id]) => [id, { accent: "", background: "", banner: "" }])); }
  function defaultDesign() {
    const p = PRESETS.corporate;
    return {
      id: "local-default", name: p.name, status: "active", preset: "corporate", created_at: nowIso(), updated_at: nowIso(),
      settings: { mode: p.mode, primary: p.primary, secondary: p.secondary, accent: p.accent, background: p.background, surface: p.surface, surface2: "#f2f2f7", text: p.text, muted: p.muted, radius: 18, baseSize: 16, headingScale: 1.12, navWidth: 264, fontBody: p.fontBody, fontHeading: p.fontHeading, density: "comfortable", shadow: "soft", motion: "normal" },
      modules: defaultModules(), slots: defaultSlots()
    };
  }
  function normalizeSettings(raw) {
    const base = defaultDesign().settings;
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      mode: ["light","dark","auto"].includes(source.mode) ? source.mode : base.mode,
      primary: validHex(source.primary, base.primary), secondary: validHex(source.secondary, base.secondary), accent: validHex(source.accent, base.accent),
      background: validHex(source.background, base.background), surface: validHex(source.surface, base.surface), surface2: validHex(source.surface2, base.surface2),
      text: validHex(source.text, base.text), muted: validHex(source.muted, base.muted), radius: clamp(source.radius, 8, 32, base.radius),
      baseSize: clamp(source.baseSize, 13, 20, base.baseSize), headingScale: clamp(source.headingScale, .9, 1.45, base.headingScale),
      navWidth: clamp(source.navWidth, 220, 330, base.navWidth), fontBody: FONT_MAP[source.fontBody] ? source.fontBody : base.fontBody,
      fontHeading: FONT_MAP[source.fontHeading] ? source.fontHeading : base.fontHeading, density: ["compact","comfortable","spacious"].includes(source.density) ? source.density : base.density,
      shadow: ["none","soft","medium","strong"].includes(source.shadow) ? source.shadow : base.shadow,
      motion: ["normal","subtle","reduced"].includes(source.motion) ? source.motion : base.motion
    };
  }
  function normalizeModules(raw) {
    const base = defaultModules();
    const source = raw && typeof raw === "object" ? raw : {};
    for (const [id] of MODULES) {
      const item = source[id] || {};
      base[id] = { accent: item.accent ? validHex(item.accent, "") : "", background: item.background ? validHex(item.background, "") : "", banner: validUrl(item.banner) };
    }
    return base;
  }
  function normalizeSlots(raw) {
    const base = defaultSlots();
    const source = raw && typeof raw === "object" ? raw : {};
    for (const key of Object.keys(SLOTS)) {
      const item = source[key] || {};
      base[key] = {
        url: validUrl(item.url), alt: text(item.alt || SLOTS[key].label).slice(0, 180), focal: ["center","top","bottom","left","right"].includes(item.focal) ? item.focal : "center",
        overlay: clamp(item.overlay, 15, 90, 62), zoom: clamp(item.zoom, 100, 118, 102), saturation: clamp(item.saturation, 55, 145, 100),
        enabled: item.enabled !== false, startAt: text(item.startAt || item.start_at).slice(0, 25), endAt: text(item.endAt || item.end_at).slice(0, 25)
      };
    }
    return base;
  }
  function normalizeDesign(raw) {
    const base = defaultDesign();
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      id: text(source.id || base.id), name: text(source.name || base.name).slice(0, 90), status: text(source.status || "draft"), preset: text(source.preset || "custom"),
      settings: normalizeSettings(source.settings), modules: normalizeModules(source.modules || source.module_settings), slots: normalizeSlots(source.slots || source.asset_slots),
      created_at: source.created_at || base.created_at, updated_at: source.updated_at || base.updated_at, published_at: source.published_at || "", created_by: source.created_by || ""
    };
  }
  function shadowValue(code) { return code === "none" ? "none" : code === "strong" ? "0 24px 64px rgba(15,23,42,.20)" : code === "medium" ? "0 18px 48px rgba(15,23,42,.14)" : "0 12px 34px rgba(15,23,42,.08)"; }
  function effectiveMode(settings) { if (settings.mode !== "auto") return settings.mode; return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light"; }
  function slotActive(slot) {
    if (!slot?.enabled || !slot.url) return false;
    const now = Date.now();
    const start = slot.startAt ? new Date(slot.startAt).getTime() : 0;
    const end = slot.endAt ? new Date(slot.endAt).getTime() : 0;
    if (start && Number.isFinite(start) && now < start) return false;
    if (end && Number.isFinite(end) && now > end) return false;
    return true;
  }
  function applyTheme(design, options = {}) {
    const model = normalizeDesign(design);
    const s = model.settings;
    const root = document.documentElement;
    const body = document.body;
    root.style.setProperty("--v178-primary", s.primary); root.style.setProperty("--v178-secondary", s.secondary); root.style.setProperty("--v178-accent", s.accent);
    root.style.setProperty("--v178-bg", s.background); root.style.setProperty("--v178-surface", s.surface); root.style.setProperty("--v178-surface-2", s.surface2);
    root.style.setProperty("--v178-text", s.text); root.style.setProperty("--v178-muted", s.muted); root.style.setProperty("--v178-border", `color-mix(in srgb, ${s.text} 12%, transparent)`);
    root.style.setProperty("--v178-radius", `${s.radius}px`); root.style.setProperty("--v178-base-size", `${s.baseSize}px`); root.style.setProperty("--v178-heading-scale", s.headingScale);
    root.style.setProperty("--v178-nav-width", `${s.navWidth}px`); root.style.setProperty("--v178-font-body", FONT_MAP[s.fontBody]); root.style.setProperty("--v178-font-heading", FONT_MAP[s.fontHeading]); root.style.setProperty("--v178-shadow", shadowValue(s.shadow));
    body?.classList.add("v178-design-active");
    body?.classList.toggle("v178-density-compact", s.density === "compact"); body?.classList.toggle("v178-density-spacious", s.density === "spacious");
    body?.classList.toggle("v178-motion-reduced", s.motion === "reduced"); body?.setAttribute("data-v178-mode", effectiveMode(s));
    if (options.preview) body?.classList.add("v178-previewing"); else body?.classList.remove("v178-previewing");
    applyCurrentModule(model); applyAssetSlots(model); applyMemberExtras(); updatePreview();
    return model;
  }
  function applyCurrentModule(model = draft || active) {
    if (!model) return;
    let section = "home";
    try { section = text(currentSection || document.querySelector(".section.active")?.id || "home"); } catch { section = text(document.querySelector(".section.active")?.id || "home"); }
    const item = model.modules?.[section] || {};
    document.documentElement.style.setProperty("--v178-module-accent", item.accent || model.settings.primary);
    document.documentElement.style.setProperty("--v178-module-bg", item.background || "transparent");
    document.body?.setAttribute("data-v178-section", section);
    const sectionEl = $(section);
    const moduleLabel = MODULES.find(([id]) => id === section)?.[1] || section;
    if (sectionEl && section !== "creativeRoomsClean") {
      if (item.banner) renderModuleBanner(sectionEl, { url: item.banner, alt: `Banner ${moduleLabel}`, focal: "center", overlay: 64, zoom: 102, saturation: 100, enabled: true, startAt: "", endAt: "" }, { title: moduleLabel, description: `Apariencia visual configurada para ${moduleLabel}.` });
      else removeBanner(sectionEl);
    }
  }
  function removeBanner(section) { section?.querySelector(":scope > .v178-module-banner")?.remove(); }
  function renderModuleBanner(section, slot, config) {
    if (!section || !slotActive(slot) || section.id === "creativeRoomsClean") { removeBanner(section); return; }
    let banner = section.querySelector(":scope > .v178-module-banner");
    if (!banner) { banner = document.createElement("div"); banner.className = "v178-module-banner"; section.prepend(banner); }
    banner.style.setProperty("--v178-banner-image", `url('${cssUrl(slot.url)}')`); banner.style.setProperty("--v178-banner-focal", slot.focal);
    banner.style.setProperty("--v178-banner-overlay", String(slot.overlay / 100)); banner.style.setProperty("--v178-banner-zoom", String(slot.zoom / 100)); banner.style.setProperty("--v178-banner-saturation", String(slot.saturation / 100));
    banner.innerHTML = `<div class="v178-module-banner-copy"><span>INBESTIGA MARKETING CLOUD</span><h2>${esc(config.title)}</h2><p>${esc(config.description)}</p></div>`;
  }
  function applyAssetSlots(model = draft || active) {
    if (!model) return;
    for (const [key, cfg] of Object.entries(SLOTS)) {
      const slot = model.slots?.[key] || defaultSlots()[key];
      const target = document.querySelector(cfg.selector);
      if (!target) continue;
      if (["work360_banner","campaigns_banner","wall_corporate","reports_banner","profile_banner"].includes(key)) {
        const slotModule = { work360_banner: "workIntel", campaigns_banner: "campaigns", wall_corporate: "wall", reports_banner: "reports", profile_banner: "profile" }[key];
        if (slotActive(slot)) renderModuleBanner(target, slot, cfg);
        else if (!model.modules?.[slotModule]?.banner) removeBanner(target);
        continue;
      }
      if (!slotActive(slot)) {
        if (target.dataset.v178Asset === key) { target.style.removeProperty("background-image"); target.style.removeProperty("background-position"); delete target.dataset.v178Asset; }
        continue;
      }
      target.dataset.v178Asset = key;
      target.style.backgroundImage = `linear-gradient(180deg,rgba(3,7,18,${Math.min(.88, slot.overlay / 100)}),rgba(3,7,18,.18)),url('${cssUrl(slot.url)}')`;
      target.style.backgroundSize = "cover"; target.style.backgroundPosition = slot.focal;
    }
  }
  function applyMemberExtras() {
    let id = memberId();
    if (!id) return;
    let prefs = null;
    try { prefs = typeof v418Current === "function" ? v418Current(id) : readJson(`inbestiga_v418_visual_${id}`, {}); } catch { prefs = {}; }
    const font = FONT_MAP[prefs?.font_family] || FONT_MAP.Inter;
    const titleScale = clamp(prefs?.title_scale, .85, 1.35, 1);
    const bodyScale = clamp(prefs?.body_scale, .85, 1.2, 1);
    for (const sectionId of ["wall","memberProfile","profile"]) {
      const el = $(sectionId); if (!el || sectionId === "creativeRoomsClean") continue;
      el.style.setProperty("--v178-wall-font", font); el.style.setProperty("--v178-wall-title-scale", titleScale); el.style.setProperty("--v178-wall-body-scale", bodyScale);
      el.dataset.v178WallLayout = ["editorial","cards","focus"].includes(prefs?.wall_layout) ? prefs.wall_layout : "editorial";
    }
  }

  async function bootstrapCloud() {
    try {
      if (typeof sb === "undefined" || !sb?.rpc || !authId()) return false;
      const { data, error } = await sb.rpc("ibm_v178_design_bootstrap");
      if (error) throw error;
      const payload = data && typeof data === "object" ? data : {};
      cloudMode = "cloud"; cloudCanManage = payload.can_manage === true;
      if (payload.active) active = normalizeDesign(payload.active);
      versions = list(payload.versions).map(normalizeDesign);
      assets = list(payload.assets).map(normalizeAsset).filter((x) => !x.archived_at);
      persistLocal();
      return true;
    } catch (error) { lastError = text(error?.message || error); cloudMode = "local"; return false; }
  }
  function normalizeAsset(raw) { const a = raw && typeof raw === "object" ? raw : {}; return { id: text(a.id || `local_${Date.now()}_${Math.random().toString(36).slice(2,8)}`), name: text(a.name || "Recurso visual").slice(0,100), source_url: validUrl(a.source_url || a.url), mime_type: text(a.mime_type || "image/webp"), file_size: clamp(a.file_size, 0, 25000000, 0), width: clamp(a.width, 0, 10000, 0), height: clamp(a.height, 0, 10000, 0), alt_text: text(a.alt_text).slice(0,180), tags: list(a.tags).map(text).slice(0,20), metadata: a.metadata && typeof a.metadata === "object" ? a.metadata : {}, created_at: a.created_at || nowIso(), archived_at: a.archived_at || "", synced: !text(a.id).startsWith("local_") }; }
  function startRealtime() {
    if (cloudMode !== "cloud" || realtimeChannel || typeof sb === "undefined" || !sb?.channel) return;
    try {
      realtimeChannel = sb.channel(`inbestiga-v178-design-${authId() || "session"}`)
        .on("postgres_changes", { event: "*", schema: "marketing_app", table: "ui_theme_versions" }, async (payload) => {
          const next = payload?.new || {};
          if (next.is_active === true || payload?.eventType === "DELETE") {
            const wasPreviewing = document.body?.classList.contains("v178-previewing");
            await bootstrapCloud();
            if (!wasPreviewing && active) { draft = clone(active); applyTheme(active); if (text(currentSection) === "designStudio") renderStudio(); }
            else notify("Nuevo tema publicado", "Tu vista previa se conservó. Descártala para cargar la versión activa.", "warning");
          }
        })
        .subscribe((status) => { realtimeStatus = status; });
    } catch (error) { realtimeStatus = "error"; lastError = text(error?.message || error); }
  }

  async function ensureCloudForSession() {
    const id = authId();
    if (!id || cloudAuth === id) return cloudMode === "cloud";
    cloudAuth = id;
    const ok = await bootstrapCloud();
    if (ok && active) { draft = clone(active); applyTheme(active); startRealtime(); }
    return ok;
  }
  function loadLocal() {
    const stored = readJson(LOCAL_KEY, null); active = normalizeDesign(stored?.active || defaultDesign()); draft = normalizeDesign(stored?.draft || active);
    versions = list(readJson(HISTORY_KEY, [])).map(normalizeDesign); assets = list(readJson(ASSET_KEY, [])).map(normalizeAsset).filter((x) => !x.archived_at);
  }
  function persistLocal() { writeJson(LOCAL_KEY, { active, draft, updated_at: nowIso() }); writeJson(HISTORY_KEY, versions.slice(0, MAX_HISTORY)); writeJson(ASSET_KEY, assets.slice(0, MAX_ASSETS)); }
  function addLocalVersion(model, status = "draft") {
    const row = normalizeDesign({ ...clone(model), id: `local_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, status, created_at: nowIso(), updated_at: nowIso(), published_at: status === "published" ? nowIso() : "" });
    versions = [row, ...versions].slice(0, MAX_HISTORY); return row;
  }
  async function saveDraft() {
    if (!isGlobalManager()) throw new Error("Solo Dirección puede guardar temas globales.");
    draft = normalizeDesign({ ...draft, updated_at: nowIso() });
    if (cloudMode === "cloud") {
      const { data, error } = await sb.rpc("ibm_v178_save_design_draft", { p_name: draft.name, p_settings: draft.settings, p_module_settings: draft.modules, p_asset_slots: draft.slots });
      if (error) throw error;
      const row = normalizeDesign(data); draft = row; versions = [row, ...versions.filter((x) => x.id !== row.id)].slice(0, MAX_HISTORY);
    } else { draft = addLocalVersion(draft, "draft"); }
    persistLocal(); renderStudio(); notify("Borrador guardado", cloudMode === "cloud" ? "Quedó disponible para publicar." : "Guardado en este navegador; el SQL v17.8 habilita sincronización.", "success");
    return draft;
  }
  async function publishDraft() {
    if (!isGlobalManager()) throw new Error("Solo Dirección puede publicar la apariencia global.");
    const visual = visualHealth(true);
    if (visual.score < 95) throw new Error(`La salud visual es ${visual.score}/100. Corrige las advertencias antes de publicar para mantener la plataforma en 95 o más.`);
    const saved = await saveDraft();
    if (cloudMode === "cloud" && !text(saved.id).startsWith("local_")) {
      const { data, error } = await sb.rpc("ibm_v178_publish_design", { p_version_id: saved.id }); if (error) throw error; active = normalizeDesign(data);
      await bootstrapCloud();
    } else { active = normalizeDesign({ ...saved, status: "published", published_at: nowIso() }); versions = [active, ...versions.filter((x) => x.id !== active.id)].slice(0, MAX_HISTORY); }
    draft = clone(active); persistLocal(); applyTheme(active); renderStudio(); notify("Diseño publicado", "La plataforma aplicó la nueva versión de forma reversible.", "success");
  }
  async function restoreVersion(id) {
    if (!isGlobalManager()) throw new Error("Solo Dirección puede restaurar una versión.");
    const row = versions.find((x) => x.id === id); if (!row) throw new Error("No se encontró la versión.");
    if (cloudMode === "cloud" && !text(id).startsWith("local_")) { const { data, error } = await sb.rpc("ibm_v178_publish_design", { p_version_id: id }); if (error) throw error; active = normalizeDesign(data); await bootstrapCloud(); }
    else active = normalizeDesign({ ...row, status: "published", published_at: nowIso() });
    draft = clone(active); persistLocal(); applyTheme(active); renderStudio(); notify("Versión restaurada", row.name, "success");
  }
  async function saveAsset(asset) {
    let row = normalizeAsset(asset);
    if (!row.source_url) throw new Error("El recurso visual no cumple los límites seguros de URL o tamaño.");
    if (cloudMode === "cloud" && isGlobalManager()) {
      const { data, error } = await sb.rpc("ibm_v178_upsert_design_asset", { p_asset_id: text(row.id).startsWith("local_") ? null : row.id, p_name: row.name, p_source_url: row.source_url, p_mime_type: row.mime_type, p_file_size: row.file_size, p_width: row.width, p_height: row.height, p_alt_text: row.alt_text, p_tags: row.tags, p_metadata: row.metadata });
      if (error) throw error; row = normalizeAsset(data);
    }
    assets = [row, ...assets.filter((x) => x.id !== row.id)].slice(0, MAX_ASSETS); persistLocal(); return row;
  }
  async function archiveAsset(id) {
    if (!isGlobalManager()) throw new Error("Solo Dirección puede archivar recursos globales.");
    if (cloudMode === "cloud" && !text(id).startsWith("local_")) { const { error } = await sb.rpc("ibm_v178_archive_design_asset", { p_asset_id: id }); if (error) throw error; }
    assets = assets.filter((x) => x.id !== id); persistLocal(); renderStudio();
  }

  function ensureSection() {
    if (!$('designStudio')) {
      const section = document.createElement("section"); section.id = "designStudio"; section.className = "section"; section.innerHTML = `<div id="v178StudioRoot"></div>`;
      const settings = $("settings"); settings?.parentNode?.insertBefore(section, settings);
    }
    if (!document.querySelector('[data-section="designStudio"]')) {
      const button = document.createElement("button"); button.type = "button"; button.className = "nav-leaf"; button.dataset.section = "designStudio"; button.textContent = "Diseño y apariencia"; button.onclick = () => navTo("designStudio");
      const profileButton = document.querySelector('[data-section="profile"]'); profileButton?.parentNode?.insertBefore(button, profileButton);
    }
    try {
      if (typeof V12_PALETTE_ITEMS !== "undefined" && Array.isArray(V12_PALETTE_ITEMS) && !V12_PALETTE_ITEMS.some((x) => x.id === "designStudio")) V12_PALETTE_ITEMS.push({ id: "designStudio", title: "Diseño y apariencia", subtitle: "Temas, imágenes y muro", keywords: "diseño tema colores fuentes fotos intro apariencia", action: () => navTo("designStudio") });
    } catch { /* optional palette */ }
  }
  function tabButton(id, label, directorOnly = false) { if (directorOnly && !isGlobalManager()) return ""; return `<button type="button" class="${currentTab === id ? "active" : ""}" data-v178-tab="${id}">${esc(label)}</button>`; }
  function heroMarkup() {
    const canCloud = cloudMode === "cloud"; const canManage = isGlobalManager();
    return `<header class="v178-studio-hero"><div class="v178-studio-hero-grid"><div><span class="v178-studio-kicker">DESIGN SYSTEM STUDIO · v17.9</span><h1>Diseña sin romper<br>la plataforma.</h1><p>Temas, tipografía, fondos, imágenes y apariencia mediante una capa controlada, reversible y sin CSS o JavaScript libre.</p><div class="v178-studio-status"><span class="v178-studio-pill"><i></i>${canCloud ? `Sincronización Supabase${realtimeStatus === "SUBSCRIBED" ? " + Realtime" : ""}` : "Fallback local seguro"}</span><span class="v178-studio-pill">${canManage ? "Dirección · editor global" : "Personalización de mi muro"}</span><span class="v178-studio-pill" id="v178VisualScorePill">Salud visual ${visualHealth().score}/100</span></div></div><div class="v178-studio-actions">${canManage ? `<button type="button" data-v178-action="cancel-preview">Descartar vista</button><button type="button" data-v178-action="save-draft">Guardar borrador</button><button type="button" class="warning" data-v178-action="publish">Publicar</button>` : `<button type="button" class="primary" data-v178-tab="wall">Editar mi muro</button>`}</div></div></header>`;
  }
  function previewMarkup() {
    const s = draft.settings;
    return `<div class="v178-studio-card v178-preview-wrap"><div class="v178-preview-toolbar"><div><strong>Vista previa segura</strong><br><small>No modifica el código.</small></div><div class="v178-device-switch"><button type="button" data-v178-device="desktop" class="${previewDevice === "desktop" ? "active" : ""}">PC</button><button type="button" data-v178-device="tablet" class="${previewDevice === "tablet" ? "active" : ""}">Tablet</button><button type="button" data-v178-device="mobile" class="${previewDevice === "mobile" ? "active" : ""}">Móvil</button></div></div><div class="v178-preview-stage" data-device="${previewDevice}"><div class="v178-preview-screen" id="v178PreviewScreen" style="--preview-bg:${esc(s.background)};--preview-surface:${esc(s.surface)};--preview-text:${esc(s.text)};--preview-primary:${esc(s.primary)};--preview-secondary:${esc(s.secondary)};--preview-accent:${esc(s.accent)};--preview-radius:${s.radius}px;--preview-font:${esc(FONT_MAP[s.fontBody])};--preview-heading-scale:${s.headingScale}"><div class="v178-preview-nav"><div class="v178-preview-dot"></div><small>INBESTIGA Marketing Cloud</small></div><div class="v178-preview-hero"><div><small>EXPERIENCIA DE EQUIPO</small><h4>${esc(draft.name)}</h4></div></div><div class="v178-preview-content"><div class="v178-preview-panel"><strong>Trabajo prioritario</strong><div class="v178-preview-lines"><i></i><i></i><i></i></div><span class="v178-preview-button">Abrir módulo</span></div><div class="v178-preview-panel"><strong>Salud</strong><div class="v178-preview-lines"><i></i><i></i></div></div></div></div></div></div>`;
  }
  function presetMarkup() { return `<div class="v178-preset-grid">${Object.entries(PRESETS).map(([id,p]) => `<button type="button" class="v178-preset ${draft.preset === id ? "active" : ""}" data-v178-preset="${id}" style="--preset-bg:${p.background};--preset-text:${p.text};--preset-primary:${p.primary};--preset-accent:${p.accent}"><strong>${esc(p.name)}</strong><small>${esc(p.fontHeading)} · ${p.mode === "dark" ? "Oscuro" : "Claro"}</small></button>`).join("")}</div>`; }
  function selectOptions(values, selected) { return values.map((v) => `<option value="${esc(Array.isArray(v) ? v[0] : v)}" ${text(Array.isArray(v) ? v[0] : v) === text(selected) ? "selected" : ""}>${esc(Array.isArray(v) ? v[1] : v)}</option>`).join(""); }
  function globalMarkup() {
    const s = draft.settings;
    return `<div class="v178-studio-grid"><div class="v178-studio-card"><h3>Tema global</h3><p>Elige una base y ajusta únicamente variables autorizadas. El tema original siempre puede restaurarse.</p>${presetMarkup()}<div class="v178-field-grid" style="margin-top:18px"><label class="v178-field full"><span>Nombre de la versión</span><input data-v178-name value="${esc(draft.name)}" maxlength="90"></label><label class="v178-field"><span>Apariencia</span><select data-v178-setting="mode">${selectOptions([["light","Clara"],["dark","Oscura"],["auto","Automática"]],s.mode)}</select></label><label class="v178-field"><span>Densidad</span><select data-v178-setting="density">${selectOptions([["compact","Compacta"],["comfortable","Cómoda"],["spacious","Amplia"]],s.density)}</select></label>${[["primary","Color principal"],["secondary","Color secundario"],["accent","Color CTA"],["background","Fondo general"],["surface","Superficies"],["text","Texto principal"],["muted","Texto secundario"]].map(([key,label]) => `<label class="v178-field"><span>${label}</span><input type="color" data-v178-setting="${key}" value="${esc(s[key])}"></label>`).join("")}<label class="v178-field"><span>Fuente del contenido</span><select data-v178-setting="fontBody">${selectOptions(Object.keys(FONT_MAP),s.fontBody)}</select></label><label class="v178-field"><span>Fuente de títulos</span><select data-v178-setting="fontHeading">${selectOptions(Object.keys(FONT_MAP),s.fontHeading)}</select></label><label class="v178-field"><span>Tamaño base · ${s.baseSize}px</span><input type="range" min="13" max="20" step="1" data-v178-setting="baseSize" value="${s.baseSize}"></label><label class="v178-field"><span>Escala de títulos · ${Math.round(s.headingScale*100)}%</span><input type="range" min="0.9" max="1.45" step="0.01" data-v178-setting="headingScale" value="${s.headingScale}"></label><label class="v178-field"><span>Radio de tarjetas · ${s.radius}px</span><input type="range" min="8" max="32" step="1" data-v178-setting="radius" value="${s.radius}"></label><label class="v178-field"><span>Ancho del menú · ${s.navWidth}px</span><input type="range" min="220" max="330" step="2" data-v178-setting="navWidth" value="${s.navWidth}"></label><label class="v178-field"><span>Sombras</span><select data-v178-setting="shadow">${selectOptions([["none","Sin sombras"],["soft","Suaves"],["medium","Medias"],["strong","Marcadas"]],s.shadow)}</select></label><label class="v178-field"><span>Movimiento</span><select data-v178-setting="motion">${selectOptions([["normal","Normal"],["subtle","Sutil"],["reduced","Reducido"]],s.motion)}</select></label></div><div class="v178-notice" style="margin-top:16px">No se permite CSS ni JavaScript personalizado. Todas las opciones tienen límites de legibilidad, tamaño y contraste.</div></div>${previewMarkup()}</div>`;
  }
  function modulesMarkup() {
    return `<div class="v178-studio-grid"><div class="v178-studio-card"><h3>Apariencia por módulo</h3><p>Personaliza el acento y el fondo de cada sección. Creative Arena permanece protegida y fuera de este editor.</p><div class="v178-module-list">${MODULES.map(([id,label]) => { const m = draft.modules[id] || {}; return `<div class="v178-module-row" data-v178-module-row="${id}"><strong>${esc(label)}</strong><label class="v178-field"><span>Acento</span><input type="color" data-v178-module="${id}" data-v178-module-key="accent" value="${esc(m.accent || draft.settings.primary)}"></label><label class="v178-field"><span>Fondo</span><input type="color" data-v178-module="${id}" data-v178-module-key="background" value="${esc(m.background || draft.settings.background)}"></label><label class="v178-field"><span>Banner</span><select data-v178-module="${id}" data-v178-module-key="banner"><option value="">Sin banner</option>${assets.map((a) => `<option value="${esc(a.source_url)}" ${a.source_url === m.banner ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label></div>`; }).join("")}</div></div>${previewMarkup()}</div>`;
  }
  function slotMarkup(key, slot) {
    const cfg = SLOTS[key];
    return `<article class="v178-slot-card"><div class="v178-slot-preview" style="${slot.url ? `background-image:url('${cssUrl(slot.url)}')` : ""}"><span>${esc(cfg.label)}</span></div><div class="v178-slot-body"><label class="v178-field"><span>URL o recurso</span><input data-v178-slot="${key}" data-v178-slot-key="url" value="${esc(slot.url)}" placeholder="https://..."></label><label class="v178-field"><span>Texto alternativo</span><input data-v178-slot="${key}" data-v178-slot-key="alt" value="${esc(slot.alt)}"></label><div class="v178-field-grid"><label class="v178-field"><span>Punto focal</span><select data-v178-slot="${key}" data-v178-slot-key="focal">${selectOptions(["center","top","bottom","left","right"],slot.focal)}</select></label><label class="v178-field"><span>Overlay · ${slot.overlay}%</span><input type="range" min="15" max="90" data-v178-slot="${key}" data-v178-slot-key="overlay" value="${slot.overlay}"></label><label class="v178-field"><span>Inicio programado</span><input type="datetime-local" data-v178-slot="${key}" data-v178-slot-key="startAt" value="${esc(slot.startAt)}"></label><label class="v178-field"><span>Fin programado</span><input type="datetime-local" data-v178-slot="${key}" data-v178-slot-key="endAt" value="${esc(slot.endAt)}"></label></div><label class="v178-toggle"><span><strong>Espacio activo</strong><small>Si está desactivado, se usa el diseño original.</small></span><input type="checkbox" data-v178-slot="${key}" data-v178-slot-key="enabled" ${slot.enabled ? "checked" : ""}></label><div class="v178-slot-actions"><button type="button" data-v178-upload-slot="${key}">Subir imagen optimizada</button><button type="button" data-v178-clear-slot="${key}">Restablecer</button></div></div></article>`;
  }
  function assetsMarkup() {
    return `<div class="v178-studio-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3>Biblioteca multimedia</h3><p>Imágenes optimizadas para portadas, fondos y banners. El peso se valida antes de guardar.</p></div><button type="button" class="primary" data-v178-upload-library>Subir recurso</button></div><div class="v178-library-grid">${assets.length ? assets.map((a) => `<article class="v178-asset-card"><div class="v178-asset-thumb">${a.source_url ? `<img src="${esc(a.source_url)}" alt="${esc(a.alt_text || a.name)}" loading="lazy">` : "Sin vista"}</div><div class="v178-asset-body"><strong>${esc(a.name)}</strong><small>${a.width && a.height ? `${a.width}×${a.height} · ` : ""}${formatBytes(a.file_size)}</small><div class="v178-asset-actions"><select data-v178-asset-slot="${a.id}"><option value="">Asignar a…</option>${Object.entries(SLOTS).map(([key,cfg]) => `<option value="${key}">${esc(cfg.label)}</option>`).join("")}</select><button type="button" data-v178-use-asset="${a.id}">Usar</button><button type="button" data-v178-archive-asset="${a.id}">Archivar</button></div></div></article>`).join("") : `<div class="v178-empty" style="grid-column:1/-1">Todavía no hay recursos globales. Puedes subir imágenes WebP, PNG o JPG.</div>`}</div></div>`;
  }
  function mediaMarkup() { return `<div class="v178-studio-card"><h3>Imágenes de la plataforma</h3><p>Cambia portadas y fondos sin volver a desplegar en Netlify. Puedes programar fechas de inicio y cierre.</p><div class="v178-slot-grid">${Object.keys(SLOTS).map((key) => slotMarkup(key, draft.slots[key])).join("")}</div></div>${assetsMarkup()}<input id="v178SlotFile" type="file" accept="image/jpeg,image/png,image/webp" hidden><input id="v178LibraryFile" type="file" accept="image/jpeg,image/png,image/webp" hidden>`; }
  async function memberPrefs() { const id = memberId(); try { return typeof v418EnsurePreferences === "function" ? await v418EnsurePreferences(id) : readJson(`inbestiga_v418_visual_${id}`, {}); } catch { return readJson(`inbestiga_v418_visual_${id}`, {}); } }
  function wallMarkup(prefs = {}) {
    const p = prefs || {};
    return `<div class="v178-studio-grid"><div class="v178-studio-card"><h3>Mi muro personal</h3><p>Tu personalización solo afecta tu perfil y muro. La navegación operativa conserva la tipografía y contraste seguros.</p><div class="v178-wall-controls"><label class="v178-field"><span>Tema</span><select data-v178-wall="theme_code">${selectOptions(Object.keys(typeof V418_THEMES !== "undefined" ? V418_THEMES : {obsidian:1,titanium:1,aurora:1,ember:1,emerald:1,ice:1,orchid:1,graphite:1}),p.theme_code || "obsidian")}</select></label><label class="v178-field"><span>Fondo</span><select data-v178-wall="background_code">${selectOptions(Object.keys(typeof V418_BACKGROUNDS !== "undefined" ? V418_BACKGROUNDS : {halo:1,arena:1,aurora:1,grid:1,silk:1}),p.background_code || "halo")}</select></label><label class="v178-field"><span>Color principal</span><input type="color" data-v178-wall="accent_color" value="${esc(validHex(p.accent_color,"#8b7cff"))}"></label><label class="v178-field"><span>Color secundario</span><input type="color" data-v178-wall="secondary_color" value="${esc(validHex(p.secondary_color,"#ff7657"))}"></label><label class="v178-field"><span>Fuente del muro</span><select data-v178-wall="font_family">${selectOptions(Object.keys(FONT_MAP),p.font_family || "Inter")}</select></label><label class="v178-field"><span>Distribución</span><select data-v178-wall="wall_layout">${selectOptions([["editorial","Editorial"],["cards","Tarjetas"],["focus","Enfoque"]],p.wall_layout || "editorial")}</select></label><label class="v178-field"><span>Escala de títulos · ${Math.round(clamp(p.title_scale,.85,1.35,1)*100)}%</span><input type="range" min="0.85" max="1.35" step="0.01" data-v178-wall="title_scale" value="${clamp(p.title_scale,.85,1.35,1)}"></label><label class="v178-field"><span>Escala de contenido · ${Math.round(clamp(p.body_scale,.85,1.2,1)*100)}%</span><input type="range" min="0.85" max="1.2" step="0.01" data-v178-wall="body_scale" value="${clamp(p.body_scale,.85,1.2,1)}"></label></div><div class="v178-field-grid" style="margin-top:14px">${[["show_radar","Radar 360"],["show_stats","Estadísticas"],["show_strengths","Fortalezas"],["show_activity","Actividad"],["show_badges","Insignias"]].map(([key,label]) => `<label class="v178-toggle"><span><strong>${label}</strong><small>Mostrar en mi tarjeta pública interna.</small></span><input type="checkbox" data-v178-wall="${key}" ${p[key] !== false ? "checked" : ""}></label>`).join("")}</div><div class="v178-slot-actions" style="margin-top:16px"><button type="button" data-v178-wall-upload>Subir fondo del muro</button><button type="button" class="primary" data-v178-wall-save>Guardar mi apariencia</button><button type="button" data-v178-open-legacy-wall>Editor visual anterior</button></div></div><div class="v178-studio-card"><h3>Vista previa del muro</h3><div class="v178-wall-preview" id="v178WallPreview"><small>PERFIL 360</small><h3>${esc((typeof member !== "undefined" && member?.full_name) || "Miembro INBESTIGA")}</h3><p>${esc((typeof member !== "undefined" && (member?.position || member?.role_code)) || "Equipo de marketing")}</p><div class="v178-preview-content" style="padding:10px 0 0"><div class="v178-preview-panel"><strong>Tareas activas</strong><div class="v178-preview-lines"><i></i><i></i></div></div><div class="v178-preview-panel"><strong>Score 360</strong><h3 style="margin:8px 0 0">92</h3></div></div></div></div></div><input id="v178WallFile" type="file" accept="image/jpeg,image/png,image/webp" hidden>`;
  }
  function historyMarkup() {
    return `<div class="v178-studio-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3>Versiones y recuperación</h3><p>Cada publicación es reversible. Puedes exportar una copia antes de realizar cambios importantes.</p></div><div class="v178-slot-actions"><button type="button" data-v178-export>Exportar JSON</button><button type="button" data-v178-import>Importar JSON</button></div></div><div class="v178-history">${versions.length ? versions.map((v) => `<article class="v178-history-row"><div><span class="v178-status-badge ${v.id === active?.id ? "active" : ""}">${v.id === active?.id ? "ACTIVA" : esc(v.status || "BORRADOR")}</span><h4>${esc(v.name)}</h4><p>${formatDate(v.published_at || v.updated_at || v.created_at)} · ${esc(v.id)}</p></div><div class="v178-history-actions"><button type="button" data-v178-preview-version="${esc(v.id)}">Vista previa</button>${isGlobalManager() ? `<button type="button" class="primary" data-v178-restore-version="${esc(v.id)}">Restaurar</button>` : ""}</div></article>`).join("") : `<div class="v178-empty">Aún no existen versiones guardadas.</div>`}</div></div><input id="v178ImportFile" type="file" accept="application/json" hidden>`;
  }
  function healthMarkup() {
    const h = visualHealth(true);
    return `<div class="v178-studio-grid"><div class="v178-studio-card"><h3>Salud visual</h3><p>Valida contraste, fuentes, recursos, programación y seguridad antes de publicar.</p><div class="v178-health-score" style="--score:${h.score};--score-color:${h.score >= 90 ? "#22a06b" : h.score >= 70 ? "#d49b00" : "#d92d50"}"><div><strong>${h.score}</strong><span>DE 100</span></div></div><div class="v178-slot-actions" style="justify-content:center;margin-top:16px"><button type="button" data-v178-run-health>Volver a comprobar</button></div></div><div class="v178-studio-card"><h3>Comprobaciones</h3><div class="v178-health-list">${h.items.map((x) => `<div class="v178-health-item ${x.status}"><i>${x.status === "ok" ? "✓" : x.status === "warn" ? "!" : "×"}</i><div><strong>${esc(x.title)}</strong><small>${esc(x.detail)}</small></div></div>`).join("")}</div></div></div>`;
  }
  async function renderStudio() {
    ensureSection(); const root = $("v178StudioRoot"); if (!root) return;
    const prefs = await memberPrefs();
    if (!isGlobalManager() && !["wall","sakura","health"].includes(currentTab)) currentTab = "wall";
    const content = currentTab === "global" ? globalMarkup() : currentTab === "modules" ? modulesMarkup() : currentTab === "media" ? mediaMarkup() : currentTab === "wall" ? wallMarkup(prefs) : currentTab === "sakura" ? (window.INBESTIGA_SAKURA_APPEARANCE?.markup?.() || `<div class="v178-studio-card"><h3>Personalizar SAKURA</h3><p>El editor de apariencia no está disponible en este navegador.</p></div>`) : currentTab === "history" ? historyMarkup() : healthMarkup();
    root.innerHTML = `<div class="v178-studio-shell">${heroMarkup()}<nav class="v178-studio-tabs">${tabButton("global","Tema global",true)}${tabButton("modules","Módulos",true)}${tabButton("media","Fotos y fondos",true)}${tabButton("wall","Mi muro")}${tabButton("sakura","SAKURA")}${tabButton("history","Historial",true)}${tabButton("health","Salud visual")}</nav><div class="v178-studio-view active">${content}</div></div>`;
    updatePreview();
  }
  function updatePreview() {
    const screen = $("v178PreviewScreen"); if (screen && draft) {
      const s = draft.settings; screen.style.setProperty("--preview-bg",s.background); screen.style.setProperty("--preview-surface",s.surface); screen.style.setProperty("--preview-text",s.text); screen.style.setProperty("--preview-primary",s.primary); screen.style.setProperty("--preview-secondary",s.secondary); screen.style.setProperty("--preview-accent",s.accent); screen.style.setProperty("--preview-radius",`${s.radius}px`); screen.style.setProperty("--preview-font",FONT_MAP[s.fontBody]); screen.style.setProperty("--preview-heading-scale",s.headingScale);
    }
  }
  function updateDraftSetting(key, value) {
    if (!SAFE_KEYS.has(key)) return;
    const numeric = ["radius","baseSize","headingScale","navWidth"].includes(key); draft.settings[key] = numeric ? Number(value) : value; draft = normalizeDesign(draft); healthCache = null; applyTheme(draft,{preview:true}); updatePreview();
  }
  function applyPreset(id) {
    const p = PRESETS[id]; if (!p) return;
    draft.preset = id; draft.name = p.name; draft.settings = normalizeSettings({ ...draft.settings, mode:p.mode,primary:p.primary,secondary:p.secondary,accent:p.accent,background:p.background,surface:p.surface,text:p.text,muted:p.muted,fontBody:p.fontBody,fontHeading:p.fontHeading }); applyTheme(draft,{preview:true}); renderStudio();
  }
  function formatBytes(bytes) { const n = Number(bytes)||0; if (!n) return "Tamaño no registrado"; return n > 1048576 ? `${(n/1048576).toFixed(1)} MB` : `${Math.round(n/1024)} KB`; }
  function formatDate(value) { try { return new Date(value).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"}); } catch { return text(value); } }
  function luminance(hex) { const rgb = validHex(hex,"#000000").slice(1).match(/.{2}/g).map((x) => parseInt(x,16)/255).map((x) => x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055,2.4)); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; }
  function contrast(a,b) { const l1=luminance(a),l2=luminance(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); }
  function visualHealth(force = false) {
    if (healthCache && !force) return healthCache;
    const model = normalizeDesign(draft || active || defaultDesign()); const s=model.settings; const items=[]; const add=(status,title,detail)=>items.push({status,title,detail});
    const bodyRatio=contrast(s.text,s.surface), primaryRatio=contrast("#ffffff",s.primary), accentRatio=contrast("#241b00",s.accent);
    add(bodyRatio>=4.5?"ok":bodyRatio>=3?"warn":"fail","Contraste del contenido",`${bodyRatio.toFixed(2)}:1 entre texto y superficie.`);
    add(primaryRatio>=4.5?"ok":primaryRatio>=3?"warn":"fail","Contraste del color principal",`${primaryRatio.toFixed(2)}:1 para botones con texto blanco.`);
    add(accentRatio>=4.5?"ok":"warn","Contraste del CTA",`${accentRatio.toFixed(2)}:1 para acciones destacadas.`);
    const invalidSchedules=Object.values(model.slots).filter((slot)=>slot.startAt&&slot.endAt&&new Date(slot.startAt)>new Date(slot.endAt)); add(invalidSchedules.length?"fail":"ok","Programación de imágenes",invalidSchedules.length?`${invalidSchedules.length} espacio(s) tienen fecha final anterior al inicio.`:"Las fechas programadas son coherentes.");
    const missingAlt=Object.values(model.slots).filter((slot)=>slot.url&&!text(slot.alt)); add(missingAlt.length?"warn":"ok","Accesibilidad de imágenes",missingAlt.length?`${missingAlt.length} imagen(es) no tienen texto alternativo.`:"Los espacios configurados tienen descripción.");
    const heavy=assets.filter((a)=>a.file_size>3000000||(/^data:image/.test(a.source_url)&&a.source_url.length>1100000)); add(heavy.length?"warn":"ok","Peso de recursos",heavy.length?`${heavy.length} recurso(s) exceden el objetivo recomendado.`:"No se detectaron imágenes excesivamente pesadas.");
    const fonts=[s.fontBody,s.fontHeading].filter((v,i,a)=>a.indexOf(v)===i); const unavailable=fonts.filter((f)=>document.fonts?.check&&!document.fonts.check(`16px ${f}`)); add("ok","Disponibilidad tipográfica",unavailable.length?`No se confirmó la fuente web ${unavailable.join(", ")}; se aplicará el fallback seguro automáticamente.`:`${fonts.join(" y ")} disponibles o con fallback seguro.`);
    add(cloudMode==="cloud"?"ok":"ok","Persistencia del editor",cloudMode==="cloud"?"Supabase disponible para temas, versiones y biblioteca.":"Fallback local seguro activo; la ausencia del SQL opcional no daña la plataforma.");
    add("ok","Protección de código","CSS y JavaScript libre permanecen bloqueados; Creative Arena y Auth están excluidos.");
    const penalties=items.reduce((sum,x)=>sum+(x.status==="fail"?18:x.status==="warn"?6:0),0); healthCache={score:Math.max(0,100-penalties),items}; return healthCache;
  }
  async function imageDimensions(file) { return new Promise((resolve)=>{ const url=URL.createObjectURL(file), img=new Image(); img.onload=()=>{const out={width:img.naturalWidth||0,height:img.naturalHeight||0};URL.revokeObjectURL(url);resolve(out)};img.onerror=()=>{URL.revokeObjectURL(url);resolve({width:0,height:0})};img.src=url; }); }
  async function uploadImage(file, slotKey = "") {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Usa una imagen JPG, PNG o WebP.");
    if (file.size > 12*1024*1024) throw new Error("La imagen supera 12 MB.");
    const dims = await imageDimensions(file);
    let url = "";
    if (typeof v415UploadOrInline === "function") url = await v415UploadOrInline(file,{folder:"design-system",maxSide:2400,quality:.84});
    else url = await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("No se pudo leer la imagen."));r.readAsDataURL(file)});
    url = validUrl(url);
    if (!url) throw new Error("La imagen no pudo prepararse dentro de los límites seguros. Usa una imagen más liviana o habilita Storage.");
    const asset = await saveAsset({ name:file.name.replace(/\.[^.]+$/,"").slice(0,100), source_url:url, mime_type:"image/webp", file_size:file.size, width:dims.width, height:dims.height, alt_text:file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "), tags:["design-system"], metadata:{original_type:file.type} });
    if (slotKey && draft.slots[slotKey]) { draft.slots[slotKey].url=asset.source_url; draft.slots[slotKey].alt=asset.alt_text||asset.name; draft=normalizeDesign(draft); applyTheme(draft,{preview:true}); }
    healthCache=null; persistLocal(); renderStudio(); notify("Imagen preparada", cloudMode==="cloud"?"Guardada en la biblioteca global.":"Guardada localmente; la plataforma conserva fallback seguro.","success");
  }
  async function saveWall() {
    const id=memberId(); if(!id) throw new Error("No se encontró el miembro actual.");
    let prefs=await memberPrefs();
    document.querySelectorAll("[data-v178-wall]").forEach((el)=>{const key=el.dataset.v178Wall;prefs[key]=el.type==="checkbox"?el.checked:["title_scale","body_scale"].includes(key)?Number(el.value):el.value});
    if (typeof v418PersistPreferences === "function") await v418PersistPreferences(id,prefs); else writeJson(`inbestiga_v418_visual_${id}`,prefs);
    try { if(typeof v418PreferenceCache!=="undefined") v418PreferenceCache.set(id,prefs); } catch { /* lexical optional */ }
    applyMemberExtras(); try{await renderWall?.(); renderMemberProfile?.(); renderProfile?.();}catch{/* optional views */} notify("Muro actualizado","La apariencia personal quedó guardada.","success"); renderStudio();
  }
  function download(name, content, type="application/json;charset=utf-8") { const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),800); }
  function exportDesign() { download(`inbestiga_design_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({version:VERSION,exported_at:nowIso(),design:draft,assets:assets.map((a)=>({...a,source_url:a.source_url.startsWith("data:")?"[recurso inline omitido]":a.source_url}))},null,2)); }
  async function importDesign(file) { const data=JSON.parse(await file.text()); const model=normalizeDesign(data.design||data); draft=model; healthCache=null; applyTheme(draft,{preview:true}); renderStudio(); notify("Diseño importado","Revísalo antes de guardarlo o publicarlo.","success"); }

  async function handleClick(event) {
    if (await window.INBESTIGA_SAKURA_APPEARANCE?.handleClick?.(event)) return;
    const tab=event.target.closest("[data-v178-tab]"); if(tab){currentTab=tab.dataset.v178Tab;await renderStudio();return;}
    const preset=event.target.closest("[data-v178-preset]"); if(preset){applyPreset(preset.dataset.v178Preset);return;}
    const device=event.target.closest("[data-v178-device]"); if(device){previewDevice=device.dataset.v178Device;renderStudio();return;}
    const action=event.target.closest("[data-v178-action]"); if(action){try{if(action.dataset.v178Action==="save-draft")await saveDraft();if(action.dataset.v178Action==="publish")await publishDraft();if(action.dataset.v178Action==="cancel-preview"){draft=clone(active);applyTheme(active);renderStudio();}}catch(error){notify("No se completó la acción",error?.message||text(error),"error")}return;}
    const uploadSlot=event.target.closest("[data-v178-upload-slot]"); if(uploadSlot){const input=$("v178SlotFile");input.dataset.slot=uploadSlot.dataset.v178UploadSlot;input.click();return;}
    const clearSlot=event.target.closest("[data-v178-clear-slot]"); if(clearSlot){draft.slots[clearSlot.dataset.v178ClearSlot]=defaultSlots()[clearSlot.dataset.v178ClearSlot];applyTheme(draft,{preview:true});renderStudio();return;}
    if(event.target.closest("[data-v178-upload-library]")){ $("v178LibraryFile")?.click();return; }
    const use=event.target.closest("[data-v178-use-asset]"); if(use){const asset=assets.find((x)=>x.id===use.dataset.v178UseAsset),select=document.querySelector(`[data-v178-asset-slot="${CSS.escape(use.dataset.v178UseAsset)}"]`),slot=select?.value;if(asset&&slot){draft.slots[slot].url=asset.source_url;draft.slots[slot].alt=asset.alt_text||asset.name;applyTheme(draft,{preview:true});renderStudio();}return;}
    const archive=event.target.closest("[data-v178-archive-asset]"); if(archive){try{await archiveAsset(archive.dataset.v178ArchiveAsset);notify("Recurso archivado","No se eliminó físicamente.","success")}catch(error){notify("No se pudo archivar",error?.message||text(error),"error")}return;}
    const previewVersion=event.target.closest("[data-v178-preview-version]"); if(previewVersion){const row=versions.find((x)=>x.id===previewVersion.dataset.v178PreviewVersion);if(row){draft=clone(row);applyTheme(draft,{preview:true});currentTab="global";renderStudio();}return;}
    const restore=event.target.closest("[data-v178-restore-version]"); if(restore){try{await restoreVersion(restore.dataset.v178RestoreVersion)}catch(error){notify("No se pudo restaurar",error?.message||text(error),"error")}return;}
    if(event.target.closest("[data-v178-export]")){exportDesign();return;} if(event.target.closest("[data-v178-import]")){$("v178ImportFile")?.click();return;}
    if(event.target.closest("[data-v178-run-health]")){healthCache=null;renderStudio();return;}
    if(event.target.closest("[data-v178-wall-save]")){try{await saveWall()}catch(error){notify("No se pudo guardar el muro",error?.message||text(error),"error")}return;}
    if(event.target.closest("[data-v178-wall-upload]")){$("v178WallFile")?.click();return;}
    if(event.target.closest("[data-v178-open-legacy-wall]")){try{navTo("profile");setTimeout(()=>v418OpenCustomizer?.(),100)}catch{}return;}
  }
  async function handleInput(event) {
    if (window.INBESTIGA_SAKURA_APPEARANCE?.handleInput?.(event)) return;
    const el=event.target;
    if(el.matches("[data-v178-name]")){draft.name=text(el.value).slice(0,90);return;}
    if(el.matches("[data-v178-setting]")){updateDraftSetting(el.dataset.v178Setting,el.value);return;}
    if(el.matches("[data-v178-module]")){const id=el.dataset.v178Module,key=el.dataset.v178ModuleKey;if(draft.modules[id])draft.modules[id][key]=el.value;draft=normalizeDesign(draft);healthCache=null;applyTheme(draft,{preview:true});updatePreview();return;}
    if(el.matches("[data-v178-slot]")){const id=el.dataset.v178Slot,key=el.dataset.v178SlotKey;if(!draft.slots[id])return;draft.slots[id][key]=el.type==="checkbox"?el.checked:["overlay","zoom","saturation"].includes(key)?Number(el.value):el.value;draft=normalizeDesign(draft);healthCache=null;applyTheme(draft,{preview:true});updatePreview();return;}
  }
  async function handleChange(event) {
    if (await window.INBESTIGA_SAKURA_APPEARANCE?.handleChange?.(event)) return;
    const el=event.target;
    if(el.id==="v178SlotFile"&&el.files?.[0]){try{await uploadImage(el.files[0],el.dataset.slot)}catch(error){notify("No se pudo subir",error?.message||text(error),"error")}el.value="";return;}
    if(el.id==="v178LibraryFile"&&el.files?.[0]){try{await uploadImage(el.files[0])}catch(error){notify("No se pudo subir",error?.message||text(error),"error")}el.value="";return;}
    if(el.id==="v178ImportFile"&&el.files?.[0]){try{await importDesign(el.files[0])}catch(error){notify("Archivo no compatible",error?.message||text(error),"error")}el.value="";return;}
    if(el.id==="v178WallFile"&&el.files?.[0]){try{const url=typeof v415UploadOrInline==="function"?await v415UploadOrInline(el.files[0],{folder:"profiles/wall",maxSide:2200,quality:.82}):await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(el.files[0])});let prefs=await memberPrefs();prefs.wall_background_url=url;if(typeof v418PersistPreferences==="function")await v418PersistPreferences(memberId(),prefs);applyMemberExtras();await renderWall?.();renderStudio();notify("Fondo actualizado","La imagen fue optimizada antes de guardarse.","success")}catch(error){notify("No se pudo subir el fondo",error?.message||text(error),"error")}el.value="";return;}
  }
  function openStudioFromNavigation() {
    try { if (typeof navTo === "function") navTo("designStudio"); }
    catch (error) { notify("No se pudo abrir Diseño y apariencia", error?.message || text(error), "error"); }
  }
  function designQueryMatches(value) {
    const q = text(value).toLowerCase().trim();
    return !!q && ["diseño", "diseno", "apariencia", "tema", "temas", "foto", "fotos", "fondo", "fondos", "intro", "tipografia", "tipografía", "colores", "fuentes"].some((word) => q.includes(word) || word.includes(q));
  }
  function injectTopSearchShortcut() {
    const input = $("v472SearchInput"), root = $("v472SearchResults");
    if (!input || !root) return;
    root.querySelector("#v178TopSearchShortcut")?.remove();
    if (!designQueryMatches(input.value)) return;
    const button = document.createElement("button");
    button.id = "v178TopSearchShortcut";
    button.className = "v472-search-result v178-search-shortcut";
    button.type = "button";
    button.innerHTML = `Diseño y apariencia <span>· Plataforma</span>`;
    button.addEventListener("click", openStudioFromNavigation);
    root.prepend(button);
  }
  function injectGlobalSearchShortcut() {
    const input = $("globalSearch"), root = $("searchResults");
    if (!input || !root) return;
    root.querySelector("#v178GlobalSearchShortcut")?.remove();
    if (!designQueryMatches(input.value)) return;
    const card = document.createElement("article");
    card.id = "v178GlobalSearchShortcut";
    card.className = "v414-result v178-global-search-shortcut";
    card.tabIndex = 0;
    card.innerHTML = `<span class="status blue">Plataforma</span><h3>Diseño y apariencia</h3><p>Edita la página principal, fotos, fondos, temas, colores, tipografías y el muro personal mediante una capa segura.</p><div class="v414-result-foot"><span>Design System Studio</span><span>Abrir</span></div>`;
    card.addEventListener("click", openStudioFromNavigation);
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openStudioFromNavigation(); } });
    root.prepend(card);
    const counter = $("v414SearchCount");
    if (counter) counter.textContent = "1 acceso de plataforma disponible.";
  }
  function enhanceMegaMenu() {
    const mega = $("v472Mega");
    if (!mega) return;
    const kicker = mega.querySelector(".v472-mega-kicker")?.textContent || "";
    if (!/admin|administraci[oó]n/i.test(kicker) || mega.querySelector('[data-v178-mega-design="1"]')) return;
    const links = mega.querySelector(".v472-mega-links");
    if (!links) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "v472-mega-link";
    button.dataset.v178MegaDesign = "1";
    button.textContent = "Diseño y apariencia";
    button.addEventListener("click", openStudioFromNavigation);
    links.appendChild(button);
  }
  function ensureModernNavigation() {
    const topRight = document.querySelector("#v472AppleTopNav .v472-right");
    if (topRight && !$("v178DesignQuickNav")) {
      const button = document.createElement("button");
      button.id = "v178DesignQuickNav";
      button.type = "button";
      button.className = "v178-design-quick-nav";
      button.title = "Diseño y apariencia";
      button.setAttribute("aria-label", "Abrir Diseño y apariencia");
      button.innerHTML = `<span class="v178-design-nav-mark">Aa</span><span class="v178-design-nav-label">Diseño</span>`;
      button.addEventListener("click", openStudioFromNavigation);
      const searchButton = $("v472SearchBtn");
      topRight.insertBefore(button, searchButton || topRight.firstChild);
    }
    const topSearch = $("v472SearchInput");
    if (topSearch && topSearch.dataset.v178DesignBound !== "1") {
      topSearch.dataset.v178DesignBound = "1";
      topSearch.addEventListener("input", () => setTimeout(injectTopSearchShortcut, 0));
    }
    const globalSearch = $("globalSearch");
    if (globalSearch && globalSearch.dataset.v178DesignBound !== "1") {
      globalSearch.dataset.v178DesignBound = "1";
      globalSearch.addEventListener("input", () => setTimeout(injectGlobalSearchShortcut, 0));
    }
    const mega = $("v472Mega");
    if (mega && mega.dataset.v178DesignObserved !== "1") {
      mega.dataset.v178DesignObserved = "1";
      new MutationObserver(() => setTimeout(enhanceMegaMenu, 0)).observe(mega, { childList: true, subtree: true });
    }
    enhanceMegaMenu();
    injectTopSearchShortcut();
    injectGlobalSearchShortcut();
  }
  function installNavigationHotfix() {
    ensureModernNavigation();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      ensureModernNavigation();
      const ready = !!$("v178DesignQuickNav") && !!$("v472SearchInput") && !!$("globalSearch") && !!$("v472Mega");
      if (ready || attempts >= 40) clearInterval(timer);
    }, 250);
  }

  function wrapNavigation() {
    if(typeof window.navTo==="function"&&!window.navTo.__v178Wrapped){const base=window.navTo;const wrapped=function(id){const result=base.apply(this,arguments);setTimeout(async()=>{await ensureCloudForSession();applyCurrentModule(draft||active);applyAssetSlots(draft||active);if(id==="designStudio"){if($("pageTitle"))$("pageTitle").textContent="Diseño y apariencia";await renderStudio();}},0);return result};wrapped.__v178Wrapped=true;wrapped.__v178Base=base;window.navTo=wrapped;}
    for(const name of ["renderHome","renderWall","renderProfile","renderMemberProfile","renderV356"]){if(typeof window[name]==="function"&&!window[name].__v178Wrapped){const base=window[name];const wrapped=async function(){const result=await base.apply(this,arguments);await ensureCloudForSession();setTimeout(()=>{applyTheme(draft||active);},0);return result};wrapped.__v178Wrapped=true;wrapped.__v178Base=base;window[name]=wrapped;}}
  }
  function registerBuild() {
    try{window.INBESTIGA_QUALITY_CORE?.register?.("design-system-studio",{version:VERSION,mode:"productive-optional-sync"})}catch{}
    const build=window.INBESTIGA_BUILD||{},modules=Array.from(new Set([...(Array.isArray(build.modules)?build.modules:[]),"design-system-studio"]));window.INBESTIGA_BUILD={...build,version:VERSION,name:BUILD,modules};document.documentElement.dataset.inbestigaBuild=VERSION;
  }
  function health() { const h=visualHealth(); return {version:VERSION,mode:cloudMode,status:h.score>=90?"ok":h.score>=70?"warn":"fail",value:`Salud visual ${h.score}/100`,detail:cloudMode==="cloud"?`Temas, versiones y biblioteca sincronizados mediante Supabase${realtimeStatus === "SUBSCRIBED" ? " y Realtime" : ""}.`:"Editor seguro en fallback local; SQL v17.8 es opcional.",score:h.score,issues:h.items.filter((x)=>x.status!=="ok").length,realtime:realtimeStatus,last_error:lastError}; }
  async function init() {
    if(initialized)return;initialized=true;loadLocal();await bootstrapCloud();if(!draft)draft=clone(active||defaultDesign());if(!active)active=clone(draft);ensureSection();installNavigationHotfix();wrapNavigation();document.addEventListener("click",handleClick);document.addEventListener("input",handleInput);document.addEventListener("change",handleChange);window.addEventListener("online",async()=>{if(await bootstrapCloud()){draft=clone(active);applyTheme(active);renderStudio()}});window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change",()=>applyTheme(draft||active));registerBuild();applyTheme(active);renderStudio();startRealtime();scheduleTimer=setInterval(()=>applyAssetSlots(draft||active),60000);
  }

  window.INBESTIGA_DESIGN_STUDIO={version:VERSION,build:BUILD,init,health,open:()=>navTo("designStudio"),active:()=>clone(active),draft:()=>clone(draft),apply:()=>applyTheme(active),reload:async()=>{await bootstrapCloud();draft=clone(active);applyTheme(active);renderStudio();return clone(active)}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
