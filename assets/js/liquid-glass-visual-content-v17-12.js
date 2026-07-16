/* ===== INBESTIGA v17.12.9 · LIQUID GLASS VISUAL CONTENT BUILDER · UNIFIED EDITOR BRIDGE ===== */
(() => {
  "use strict";
  if (window.__INBESTIGA_V1712_VISUAL_CONTENT__) return;
  window.__INBESTIGA_V1712_VISUAL_CONTENT__ = true;

  const VERSION = "v17.12.9";
  const LOCAL_KEY = "inbestiga:v1712:visual-content";
  const LOCAL_MODE_KEY = "inbestiga:v1712:glass-mode";
  const MANAGER_ROLES = new Set(["italo","jhulio","alejandro","admin","director","owner","ceo","gerente","supervisor","marketing_lead"]);
  const LIBRARY = [
    ["Aurora líquida","assets/media/liquid-glass/aurora-fluid.webp"],
    ["Cristal futuro","assets/media/liquid-glass/crystal-future.webp"],
    ["Plataformas etéreas","assets/media/liquid-glass/cloud-platforms.webp"],
    ["Paisaje futurista","assets/media/liquid-glass/future-landscape.webp"],
    ["Cielo suave","assets/media/liquid-glass/soft-sky.webp"],
    ["Nubes serenas","assets/media/liquid-glass/serene-clouds.webp"],
    ["Nubes azules","assets/media/liquid-glass/blue-clouds.webp"],
    ["Órbita líquida","assets/media/liquid-glass/liquid-orbit.webp"]
  ];

  const DEFAULT_MODEL = {
    schema: 1,
    mode: "liquid",
    hero: {
      kicker: "INBESTIGA MARKETING CLOUD",
      title: "Un espacio visual para crear, dirigir y avanzar.",
      subtitle: "Trabajo, campañas, creatividad y desempeño reunidos en una experiencia Liquid Glass diseñada para el equipo.",
      image: LIBRARY[0][1],
      primaryLabel: "Abrir mi día",
      primarySection: "myday",
      secondaryLabel: "Salas creativas",
      secondarySection: "creativeRoomsClean"
    },
    cards: [
      { eyebrow:"CREATIVIDAD", title:"Salas creativas", description:"Pizarras, ideas, referencias y colaboración visual.", image:LIBRARY[1][1], section:"creativeRoomsClean" },
      { eyebrow:"EJECUCIÓN", title:"Trabajo 360", description:"Tareas, responsables, horas, entregas y seguimiento.", image:LIBRARY[2][1], section:"workIntel" },
      { eyebrow:"ESTRATEGIA", title:"Campañas", description:"Clientes, campañas, briefs y contenido editorial.", image:LIBRARY[3][1], section:"campaigns" }
    ],
    galleryTitle: "Una plataforma con más imagen, contexto y presencia.",
    galleryKicker: "BIBLIOTECA VISUAL",
    gallery: [
      { label:"Universo creativo", image:LIBRARY[4][1] },
      { label:"Ambiente editorial", image:LIBRARY[5][1] },
      { label:"Cultura del equipo", image:LIBRARY[6][1] },
      { label:"Innovación INBESTIGA", image:LIBRARY[7][1] }
    ],
    spotlight: {
      kicker:"PANEL DESTACADO",
      title:"La información también puede sentirse inspiradora.",
      description:"Los administradores pueden reemplazar imágenes, títulos, botones y paneles sin modificar el código de la plataforma.",
      image:LIBRARY[7][1],
      buttonLabel:"Ver campañas",
      buttonSection:"campaigns"
    },
    updatedAt: new Date().toISOString()
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value, fallback = "") => String(value ?? fallback).trim();

  let model = null;
  let activeCard = 0;
  let selectedLibraryTarget = "hero";
  let cloudAvailable = false;
  let cloudChecked = false;
  let booted = false;

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); }
    catch (_) { return null; }
  }

  function writeLocal(value) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
      localStorage.setItem(LOCAL_MODE_KEY, value.mode || "liquid");
      return true;
    } catch (error) {
      console.warn("[v17.12] No se pudo guardar localmente", error);
      return false;
    }
  }

  function validImage(value, fallback) {
    const url = text(value);
    if (/^(?:assets\/|https:\/\/|data:image\/(?:png|jpeg|jpg|webp|gif);base64,)/i.test(url)) return url.slice(0, 1400000);
    return fallback;
  }

  function safeSection(value, fallback) {
    const section = text(value);
    return /^[a-zA-Z0-9_-]{2,48}$/.test(section) ? section : fallback;
  }

  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const base = clone(DEFAULT_MODEL);
    const hero = source.hero && typeof source.hero === "object" ? source.hero : {};
    const spotlight = source.spotlight && typeof source.spotlight === "object" ? source.spotlight : {};
    const sourceCards = Array.isArray(source.cards) ? source.cards : [];
    const sourceGallery = Array.isArray(source.gallery) ? source.gallery : [];
    return {
      schema: 1,
      mode: ["liquid","soft","classic"].includes(source.mode) ? source.mode : base.mode,
      hero: {
        kicker: text(hero.kicker, base.hero.kicker).slice(0, 80),
        title: text(hero.title, base.hero.title).slice(0, 180),
        subtitle: text(hero.subtitle, base.hero.subtitle).slice(0, 360),
        image: validImage(hero.image, base.hero.image),
        primaryLabel: text(hero.primaryLabel, base.hero.primaryLabel).slice(0, 70),
        primarySection: safeSection(hero.primarySection, base.hero.primarySection),
        secondaryLabel: text(hero.secondaryLabel, base.hero.secondaryLabel).slice(0, 70),
        secondarySection: safeSection(hero.secondarySection, base.hero.secondarySection)
      },
      cards: base.cards.map((fallback, index) => {
        const item = sourceCards[index] && typeof sourceCards[index] === "object" ? sourceCards[index] : {};
        return {
          eyebrow: text(item.eyebrow, fallback.eyebrow).slice(0, 60),
          title: text(item.title, fallback.title).slice(0, 100),
          description: text(item.description, fallback.description).slice(0, 240),
          image: validImage(item.image, fallback.image),
          section: safeSection(item.section, fallback.section)
        };
      }),
      galleryTitle: text(source.galleryTitle, base.galleryTitle).slice(0, 180),
      galleryKicker: text(source.galleryKicker, base.galleryKicker).slice(0, 70),
      gallery: base.gallery.map((fallback, index) => {
        const item = sourceGallery[index] && typeof sourceGallery[index] === "object" ? sourceGallery[index] : {};
        return { label:text(item.label, fallback.label).slice(0, 100), image:validImage(item.image, fallback.image) };
      }),
      spotlight: {
        kicker:text(spotlight.kicker, base.spotlight.kicker).slice(0, 70),
        title:text(spotlight.title, base.spotlight.title).slice(0, 180),
        description:text(spotlight.description, base.spotlight.description).slice(0, 360),
        image:validImage(spotlight.image, base.spotlight.image),
        buttonLabel:text(spotlight.buttonLabel, base.spotlight.buttonLabel).slice(0, 70),
        buttonSection:safeSection(spotlight.buttonSection, base.spotlight.buttonSection)
      },
      editor: source.editor && typeof source.editor === "object" ? clone(source.editor) : {},
      updatedAt: text(source.updatedAt, new Date().toISOString()).slice(0, 40)
    };
  }

  model = normalize(readLocal() || DEFAULT_MODEL);

  function currentRole() {
    try { return String(member?.role_code || member?.role || "member").toLowerCase(); }
    catch (_) { return "member"; }
  }

  function canManage() {
    const role = currentRole();
    if (MANAGER_ROLES.has(role)) return true;
    try { return typeof isSupervisor === "function" && Boolean(isSupervisor()); }
    catch (_) { return false; }
  }

  function notify(title, detail = "", type = "success") {
    try {
      if (typeof premiumToast === "function") premiumToast(title, detail, type);
      else if (typeof toast === "function") toast(title, detail);
    } catch (_) {}
  }

  function navigate(section) {
    try {
      if (typeof navTo === "function") navTo(section);
      else if (typeof window.navTo === "function") window.navTo(section);
    } catch (error) {
      console.warn("[v17.12] No se pudo abrir", section, error);
    }
  }

  function applyMode() {
    document.documentElement.dataset.ibGlassMode = model.mode;
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  function ensureAmbient() {
    if (document.getElementById("ibV1712Ambient")) return;
    const ambient = document.createElement("div");
    ambient.id = "ibV1712Ambient";
    ambient.setAttribute("aria-hidden", "true");
    ambient.innerHTML = "<span></span><span></span><span></span>";
    document.body.prepend(ambient);
  }

  function heroMarkup() {
    return `
      <article class="ib-v1712-visual-hero">
        <img src="${esc(model.hero.image)}" alt="${esc(model.hero.title)}" loading="eager" fetchpriority="high">
        ${canManage() ? '<button type="button" class="ib-v1712-edit-fab" data-v1712-open-builder>Editar visual</button>' : ""}
        <div class="ib-v1712-visual-hero-content">
          <span class="ib-v1712-kicker">✦ ${esc(model.hero.kicker)}</span>
          <h1>${esc(model.hero.title)}</h1>
          <p>${esc(model.hero.subtitle)}</p>
          <div class="ib-v1712-hero-actions">
            <button type="button" class="primary" data-v1712-nav="${esc(model.hero.primarySection)}">${esc(model.hero.primaryLabel)} ↗</button>
            <button type="button" class="ib-v1712-hero-secondary" data-v1712-nav="${esc(model.hero.secondarySection)}">${esc(model.hero.secondaryLabel)}</button>
          </div>
        </div>
      </article>`;
  }

  function cardsMarkup() {
    return `<div class="ib-v1712-panel-grid">${model.cards.map((card) => `
      <article class="ib-v1712-image-card" role="button" tabindex="0" data-v1712-nav="${esc(card.section)}">
        <img src="${esc(card.image)}" alt="${esc(card.title)}" loading="lazy">
        <div class="ib-v1712-image-card-content">
          <span>${esc(card.eyebrow)}</span>
          <h3>${esc(card.title)}</h3>
          <p>${esc(card.description)}</p>
          <b aria-hidden="true">›</b>
        </div>
      </article>`).join("")}</div>`;
  }

  function galleryMarkup() {
    return `
      <section class="ib-v1712-gallery-panel">
        <div class="ib-v1712-gallery-head">
          <div><span>${esc(model.galleryKicker)}</span><h2>${esc(model.galleryTitle)}</h2></div>
          ${canManage() ? '<button type="button" data-v1712-open-builder>Editar imágenes</button>' : ""}
        </div>
        <div class="ib-v1712-gallery">${model.gallery.map((item) => `
          <figure><img src="${esc(item.image)}" alt="${esc(item.label)}" loading="lazy"><figcaption>${esc(item.label)}</figcaption></figure>`).join("")}</div>
      </section>`;
  }

  function spotlightMarkup() {
    return `
      <section class="ib-v1712-spotlight">
        <div>
          <span class="ib-v1712-kicker">✦ ${esc(model.spotlight.kicker)}</span>
          <h2>${esc(model.spotlight.title)}</h2>
          <p>${esc(model.spotlight.description)}</p>
          <div class="ib-v1712-hero-actions"><button type="button" class="primary" data-v1712-nav="${esc(model.spotlight.buttonSection)}">${esc(model.spotlight.buttonLabel)} ↗</button></div>
        </div>
        <div class="ib-v1712-spotlight-visual"><img src="${esc(model.spotlight.image)}" alt="${esc(model.spotlight.title)}" loading="lazy"></div>
      </section>`;
  }

  function renderHome() {
    const home = document.getElementById("home");
    if (!home) return;
    let mount = document.getElementById("ibV1712VisualShell");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "ibV1712VisualShell";
      mount.className = "ib-v1712-visual-shell";
      const nav = home.querySelector(".ib-home-nav");
      if (nav && nav.parentNode === home) nav.insertAdjacentElement("afterend", mount);
      else home.prepend(mount);
    }
    mount.innerHTML = `${heroMarkup()}${cardsMarkup()}${galleryMarkup()}${spotlightMarkup()}`;
    mount.querySelectorAll("[data-v1712-nav]").forEach((node) => {
      node.addEventListener("click", () => navigate(node.getAttribute("data-v1712-nav")));
      node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") navigate(node.getAttribute("data-v1712-nav")); });
    });
    mount.querySelectorAll("[data-v1712-open-builder]").forEach((node) => node.addEventListener("click", openBuilder));
  }

  function syncStateLabel() {
    const node = document.getElementById("ibV1712SyncState");
    if (!node) return;
    node.textContent = cloudAvailable ? "Supabase activo" : "Fallback local seguro";
  }

  function builderLibraryMarkup() {
    const currentImage = targetImage();
    return LIBRARY.map(([label, url]) => `
      <button type="button" data-v1712-library="${esc(url)}" class="${currentImage === url ? "active" : ""}" title="${esc(label)}">
        <img src="${esc(url)}" alt="${esc(label)}" loading="lazy">
      </button>`).join("");
  }

  function targetImage() {
    if (selectedLibraryTarget === "hero") return model.hero.image;
    if (selectedLibraryTarget.startsWith("card:")) return model.cards[Number(selectedLibraryTarget.split(":")[1])]?.image || "";
    if (selectedLibraryTarget.startsWith("gallery:")) return model.gallery[Number(selectedLibraryTarget.split(":")[1])]?.image || "";
    if (selectedLibraryTarget === "spotlight") return model.spotlight.image;
    return model.hero.image;
  }

  function setTargetImage(value) {
    const image = validImage(value, targetImage());
    if (selectedLibraryTarget === "hero") model.hero.image = image;
    else if (selectedLibraryTarget.startsWith("card:")) model.cards[Number(selectedLibraryTarget.split(":")[1])].image = image;
    else if (selectedLibraryTarget.startsWith("gallery:")) model.gallery[Number(selectedLibraryTarget.split(":")[1])].image = image;
    else if (selectedLibraryTarget === "spotlight") model.spotlight.image = image;
  }

  function activeCardMarkup() {
    const card = model.cards[activeCard];
    return `
      <div class="ib-v1712-card-tabs">${model.cards.map((_, index) => `<button type="button" data-v1712-card-tab="${index}" class="${index === activeCard ? "active" : ""}">Panel ${index + 1}</button>`).join("")}</div>
      <div class="ib-v1712-builder-fields">
        <label>Etiqueta<input data-v1712-field="card.eyebrow" value="${esc(card.eyebrow)}"></label>
        <label>Título<input data-v1712-field="card.title" value="${esc(card.title)}"></label>
        <label class="wide">Descripción<textarea data-v1712-field="card.description">${esc(card.description)}</textarea></label>
        <label>Sección al abrir<input data-v1712-field="card.section" value="${esc(card.section)}"></label>
        <label>URL de imagen<input data-v1712-field="card.image" value="${esc(card.image)}"></label>
        <div class="wide"><button type="button" data-v1712-target="card:${activeCard}">Elegir imagen para este panel</button></div>
      </div>`;
  }

  function galleryEditorMarkup() {
    return model.gallery.map((item, index) => `
      <div class="ib-v1712-panel-editor">
        <strong>Imagen ${index + 1}</strong>
        <div class="ib-v1712-builder-fields">
          <label>Etiqueta<input data-v1712-gallery-label="${index}" value="${esc(item.label)}"></label>
          <label>URL de imagen<input data-v1712-gallery-image="${index}" value="${esc(item.image)}"></label>
          <div class="wide"><button type="button" data-v1712-target="gallery:${index}">Elegir imagen ${index + 1}</button></div>
        </div>
      </div>`).join("");
  }

  function builderMarkup() {
    return `
      <div class="ib-v1712-builder-head">
        <div><span class="ib-v1712-kicker">VISUAL CONTENT BUILDER ${VERSION}</span><h2>Liquid Glass Studio</h2><p>Edita portadas, paneles, textos, imágenes y accesos sin modificar código. Creative Arena, Auth y datos operativos permanecen fuera de este editor.</p></div>
        <span class="ib-v1712-sync-state" id="ibV1712SyncState">${cloudAvailable ? "Supabase activo" : "Fallback local seguro"}</span>
      </div>
      <div class="ib-v1712-builder-grid">
        <div>
          <section class="ib-v1712-builder-card">
            <h3>Apariencia general</h3>
            <div class="ib-v1712-builder-fields">
              <label>Intensidad del vidrio<select data-v1712-field="mode"><option value="liquid" ${model.mode === "liquid" ? "selected" : ""}>Liquid Glass intenso</option><option value="soft" ${model.mode === "soft" ? "selected" : ""}>Liquid Glass suave</option><option value="classic" ${model.mode === "classic" ? "selected" : ""}>Clásico ligero</option></select></label>
              <label>Imagen de portada<input data-v1712-field="hero.image" value="${esc(model.hero.image)}"></label>
              <label class="wide">Etiqueta principal<input data-v1712-field="hero.kicker" value="${esc(model.hero.kicker)}"></label>
              <label class="wide">Título principal<input data-v1712-field="hero.title" value="${esc(model.hero.title)}"></label>
              <label class="wide">Descripción<textarea data-v1712-field="hero.subtitle">${esc(model.hero.subtitle)}</textarea></label>
              <label>Botón principal<input data-v1712-field="hero.primaryLabel" value="${esc(model.hero.primaryLabel)}"></label>
              <label>Sección principal<input data-v1712-field="hero.primarySection" value="${esc(model.hero.primarySection)}"></label>
              <label>Botón secundario<input data-v1712-field="hero.secondaryLabel" value="${esc(model.hero.secondaryLabel)}"></label>
              <label>Sección secundaria<input data-v1712-field="hero.secondarySection" value="${esc(model.hero.secondarySection)}"></label>
              <div class="wide"><button type="button" data-v1712-target="hero">Elegir imagen de portada</button> <button type="button" data-v1712-upload="hero">Subir portada</button></div>
            </div>
          </section>
          <section class="ib-v1712-builder-card" style="margin-top:18px">
            <h3>Paneles visuales</h3>${activeCardMarkup()}
          </section>
          <section class="ib-v1712-builder-card" style="margin-top:18px">
            <h3>Galería editable</h3>
            <div class="ib-v1712-builder-fields"><label class="wide">Etiqueta de galería<input data-v1712-field="galleryKicker" value="${esc(model.galleryKicker)}"></label><label class="wide">Título de galería<input data-v1712-field="galleryTitle" value="${esc(model.galleryTitle)}"></label></div>
            ${galleryEditorMarkup()}
          </section>
          <section class="ib-v1712-builder-card" style="margin-top:18px">
            <h3>Panel destacado</h3>
            <div class="ib-v1712-builder-fields">
              <label>Etiqueta<input data-v1712-field="spotlight.kicker" value="${esc(model.spotlight.kicker)}"></label>
              <label>Título<input data-v1712-field="spotlight.title" value="${esc(model.spotlight.title)}"></label>
              <label class="wide">Descripción<textarea data-v1712-field="spotlight.description">${esc(model.spotlight.description)}</textarea></label>
              <label>Botón<input data-v1712-field="spotlight.buttonLabel" value="${esc(model.spotlight.buttonLabel)}"></label>
              <label>Sección<input data-v1712-field="spotlight.buttonSection" value="${esc(model.spotlight.buttonSection)}"></label>
              <label class="wide">Imagen<input data-v1712-field="spotlight.image" value="${esc(model.spotlight.image)}"></label>
              <div class="wide"><button type="button" data-v1712-target="spotlight">Elegir imagen destacada</button> <button type="button" data-v1712-upload="spotlight">Subir imagen</button></div>
            </div>
          </section>
          <section class="ib-v1712-builder-card" style="margin-top:18px">
            <h3>Biblioteca visual incluida</h3>
            <p class="small">Primero selecciona qué espacio quieres modificar y después elige una imagen.</p>
            <div class="ib-v1712-library" id="ibV1712Library">${builderLibraryMarkup()}</div>
            <input type="file" id="ibV1712UploadInput" accept="image/jpeg,image/png,image/webp" hidden>
          </section>
          <div class="ib-v1712-savebar">
            <button type="button" data-v1712-reset>Restaurar propuesta</button>
            <button type="button" data-v1712-preview>Actualizar vista previa</button>
            <button type="button" class="primary" data-v1712-save>Guardar y publicar</button>
          </div>
        </div>
        <aside class="ib-v1712-builder-preview">
          <div class="ib-v1712-builder-card"><h3>Vista previa</h3><div class="ib-v1712-mini-preview" id="ibV1712MiniPreview"><img src="${esc(model.hero.image)}" alt="Vista previa"><div><span>${esc(model.hero.kicker)}</span><strong>${esc(model.hero.title)}</strong><small>${esc(model.hero.subtitle)}</small></div></div></div>
        </aside>
      </div>`;
  }

  function ensureAdminPane() {
    if (!canManage()) return;
    const admin = document.getElementById("admin");
    const tabs = admin?.querySelector(".admin-tabs");
    if (!admin || !tabs) return;
    if (!tabs.querySelector('[data-admin="visual"]')) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.admin = "visual";
      button.textContent = "Contenido visual";
      tabs.appendChild(button);
    }
    let pane = document.getElementById("admin_visual");
    if (!pane) {
      pane = document.createElement("div");
      pane.id = "admin_visual";
      pane.className = "admin-pane";
      admin.appendChild(pane);
    }
    pane.innerHTML = builderMarkup();
    bindBuilder(pane);
    tabs.querySelectorAll("button").forEach((button) => {
      if (button.dataset.v1712Bound === "1") return;
      button.dataset.v1712Bound = "1";
      button.addEventListener("click", () => {
        tabs.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === button));
        admin.querySelectorAll(".admin-pane").forEach((node) => node.classList.toggle("active", node.id === `admin_${button.dataset.admin}`));
        if (button.dataset.admin === "visual") refreshBuilder();
      });
    });
  }

  function openBuilder() {
    if (!canManage()) return;
    ensureAdminPane();
    navigate("admin");
    setTimeout(() => {
      const button = document.querySelector('#admin .admin-tabs [data-admin="visual"]');
      button?.click();
      document.getElementById("admin_visual")?.scrollIntoView({behavior:"smooth",block:"start"});
    }, 80);
  }

  function updateByPath(path, value) {
    if (path === "mode") model.mode = ["liquid","soft","classic"].includes(value) ? value : "liquid";
    else if (path.startsWith("hero.")) model.hero[path.split(".")[1]] = value;
    else if (path.startsWith("spotlight.")) model.spotlight[path.split(".")[1]] = value;
    else if (path === "galleryTitle") model.galleryTitle = value;
    else if (path === "galleryKicker") model.galleryKicker = value;
    else if (path.startsWith("card.")) model.cards[activeCard][path.split(".")[1]] = value;
    model = normalize(model);
  }

  function updatePreview() {
    applyMode();
    const preview = document.getElementById("ibV1712MiniPreview");
    if (preview) preview.innerHTML = `<img src="${esc(model.hero.image)}" alt="Vista previa"><div><span>${esc(model.hero.kicker)}</span><strong>${esc(model.hero.title)}</strong><small>${esc(model.hero.subtitle)}</small></div>`;
    const library = document.getElementById("ibV1712Library");
    if (library) library.innerHTML = builderLibraryMarkup();
    renderHome();
  }

  function refreshBuilder() {
    const pane = document.getElementById("admin_visual");
    if (!pane) return;
    pane.innerHTML = builderMarkup();
    bindBuilder(pane);
  }

  async function uploadImage(target, file) {
    if (!file) return;
    if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) throw new Error("Usa una imagen JPG, PNG o WebP.");
    if (file.size > 12 * 1024 * 1024) throw new Error("La imagen supera 12 MB.");
    let url = "";
    if (typeof v415UploadOrInline === "function") url = await v415UploadOrInline(file, {folder:"visual-content",maxSide:2200,quality:.84,statusId:""});
    else url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("No se pudo leer la imagen.")); reader.readAsDataURL(file); });
    selectedLibraryTarget = target;
    setTargetImage(url);
    model = normalize(model);
    updatePreview();
    refreshBuilder();
    notify("Imagen preparada", "Quedó aplicada al panel seleccionado.", "success");
  }

  function bindBuilder(root) {
    root.querySelectorAll("[data-v1712-field]").forEach((field) => {
      const handler = () => { updateByPath(field.dataset.v1712Field, field.value); updatePreview(); };
      field.addEventListener("input", handler);
      field.addEventListener("change", handler);
    });
    root.querySelectorAll("[data-v1712-card-tab]").forEach((button) => button.addEventListener("click", () => { activeCard = Number(button.dataset.v1712CardTab) || 0; refreshBuilder(); }));
    root.querySelectorAll("[data-v1712-gallery-label]").forEach((field) => field.addEventListener("input", () => { model.gallery[Number(field.dataset.v1712GalleryLabel)].label = field.value; model = normalize(model); updatePreview(); }));
    root.querySelectorAll("[data-v1712-gallery-image]").forEach((field) => field.addEventListener("input", () => { model.gallery[Number(field.dataset.v1712GalleryImage)].image = field.value; model = normalize(model); updatePreview(); }));
    root.querySelectorAll("[data-v1712-target]").forEach((button) => button.addEventListener("click", () => { selectedLibraryTarget = button.dataset.v1712Target; refreshBuilder(); }));
    root.querySelectorAll("[data-v1712-library]").forEach((button) => button.addEventListener("click", () => { setTargetImage(button.dataset.v1712Library); model = normalize(model); updatePreview(); refreshBuilder(); }));
    root.querySelectorAll("[data-v1712-upload]").forEach((button) => button.addEventListener("click", () => { selectedLibraryTarget = button.dataset.v1712Upload; const input = document.getElementById("ibV1712UploadInput"); if (input) { input.value = ""; input.click(); } }));
    const upload = document.getElementById("ibV1712UploadInput");
    if (upload) upload.addEventListener("change", async () => { try { await uploadImage(selectedLibraryTarget, upload.files?.[0]); } catch (error) { notify("No se pudo usar la imagen", error?.message || String(error), "error"); } });
    root.querySelector("[data-v1712-preview]")?.addEventListener("click", () => { model = normalize(model); updatePreview(); notify("Vista actualizada", "Los cambios todavía no se han publicado globalmente.", "success"); });
    root.querySelector("[data-v1712-reset]")?.addEventListener("click", () => { if (!confirm("¿Restaurar la propuesta visual original de v17.12?")) return; model = normalize(DEFAULT_MODEL); activeCard = 0; selectedLibraryTarget = "hero"; updatePreview(); refreshBuilder(); });
    root.querySelector("[data-v1712-save]")?.addEventListener("click", saveModel);
  }

  function appClient() { try { return typeof sb !== "undefined" ? sb : window.sb; } catch (_) { return window.sb; } }

  async function loadCloud() {
    const client = appClient();
    let signedMember = "";
    try { signedMember = String(member?.id || ""); } catch (_) {}
    if (cloudChecked || !client?.rpc || !signedMember) return;
    cloudChecked = true;
    try {
      const { data, error } = await client.rpc("ibm_v1712_visual_content_get");
      if (error) throw error;
      const payload = Array.isArray(data) ? data[0]?.payload : (data?.payload || data);
      if (payload && typeof payload === "object") {
        model = normalize(payload);
        writeLocal(model);
        cloudAvailable = true;
        applyMode();
        renderHome();
        refreshBuilder();
      } else {
        cloudAvailable = true;
      }
    } catch (error) {
      cloudAvailable = false;
      console.info("[v17.12] SQL visual opcional no disponible; se mantiene fallback local.", error?.message || error);
    }
    syncStateLabel();
  }

  async function saveModel() {
    if (!canManage()) return notify("Acceso restringido", "Solo Dirección o Supervisión puede publicar contenido visual.", "warning");
    model.updatedAt = new Date().toISOString();
    model = normalize(model);
    writeLocal(model);
    applyMode();
    renderHome();
    let detail = "Guardado en este dispositivo.";
    const client = appClient();
    if (client?.rpc) {
      try {
        const { error } = await client.rpc("ibm_v1712_visual_content_save", { p_payload:model });
        if (error) throw error;
        cloudAvailable = true;
        detail = "Publicado para todos los usuarios mediante Supabase.";
      } catch (error) {
        cloudAvailable = false;
        detail = "Guardado localmente. Ejecuta el SQL opcional v17.12 para sincronizarlo entre dispositivos.";
        console.warn("[v17.12] No se pudo publicar en Supabase", error);
      }
    }
    syncStateLabel();
    notify("Contenido visual guardado", detail, cloudAvailable ? "success" : "warning");
  }

  function patchVersion() {
    document.documentElement.setAttribute("data-inbestiga-build", VERSION);
    document.querySelectorAll(".v472-brand-text small").forEach((node) => { if ((node.textContent || "").trim() !== VERSION) node.textContent = VERSION; });
    const legacy = document.querySelector("#appScreen .side .brand .small");
    if (legacy && /v\d+/i.test(legacy.textContent || "") && (legacy.textContent || "").trim() !== `${VERSION} · Marketing Cloud`) legacy.textContent = `${VERSION} · Marketing Cloud`;
  }

  function boot() {
    if (!document.body) return;
    applyMode();
    ensureAmbient();
    patchVersion();
    renderHome();
    ensureAdminPane();
    if (!booted) {
      booted = true;
      document.addEventListener("click", (event) => {
        const trigger = event.target.closest?.("[data-v1712-open-builder]");
        if (trigger) { event.preventDefault(); openBuilder(); }
      });
    }
    loadCloud();
  }

  let mutationRefreshQueued = false;
  function refreshDynamicMounts() {
    if (document.getElementById("home") && !document.getElementById("ibV1712VisualShell")) renderHome();
    if (canManage() && document.getElementById("admin") && !document.getElementById("admin_visual")) ensureAdminPane();
    patchVersion();
    loadCloud();
  }
  function scheduleDynamicRefresh() {
    if (mutationRefreshQueued) return;
    mutationRefreshQueued = true;
    requestAnimationFrame(() => {
      mutationRefreshQueued = false;
      refreshDynamicMounts();
    });
  }
  function visualMutationIsRelevant(records) {
    return records.some((record) => [...record.addedNodes].some((node) => {
      const element = node instanceof Element ? node : node.parentElement;
      if (!element) return false;
      return element.matches?.("#home, #admin, #admin_visual, #ibV1712VisualShell, .v472-brand-text, .v472-brand-text small, #appScreen .side .brand, #appScreen .side .brand .small") ||
        Boolean(element.querySelector?.("#home, #admin, #admin_visual, #ibV1712VisualShell, .v472-brand-text small, #appScreen .side .brand .small"));
    }));
  }
  const observer = new MutationObserver((records) => {
    if (visualMutationIsRelevant(records)) scheduleDynamicRefresh();
  });

  document.addEventListener("DOMContentLoaded", () => {
    boot();
    observer.observe(document.documentElement, {childList:true,subtree:true});
    setTimeout(scheduleDynamicRefresh, 500);
    setTimeout(scheduleDynamicRefresh, 1600);
  });
  window.addEventListener("load", () => setTimeout(boot, 300));
  window.addEventListener("storage", (event) => {
    if (event.key !== LOCAL_KEY) return;
    model = normalize(readLocal() || DEFAULT_MODEL);
    applyMode();
    renderHome();
    refreshBuilder();
  });

  async function setModel(payload, options = {}) {
    model = normalize(payload);
    if (options.persistLocal !== false) writeLocal(model);
    applyMode();
    renderHome();
    refreshBuilder();
    if (options.publish === true) return await saveModel();
    return clone(model);
  }

  window.INBESTIGA_VISUAL_CONTENT_V1712 = {
    version:VERSION,
    get:() => clone(model),
    set:setModel,
    save:saveModel,
    reset:() => { model = normalize(DEFAULT_MODEL); writeLocal(model); applyMode(); renderHome(); refreshBuilder(); },
    defaults:() => clone(DEFAULT_MODEL),
    library:() => clone(LIBRARY),
    canManage,
    open:openBuilder,
    render:renderHome
  };
})();
