/* INBESTIGA v17.12.12 · Real Crystal Media Editor · Observer Conflict + Boot Stability Hotfix */
(() => {
  "use strict";
  if (window.__INBESTIGA_V17124_MEDIA_EDITOR__) return;
  window.__INBESTIGA_V17124_MEDIA_EDITOR__ = true;

  const VERSION = "v17.12.12";
  const FALLBACK_LIBRARY = [
    ["Aurora líquida", "assets/media/liquid-glass/aurora-fluid.webp"],
    ["Cristal futuro", "assets/media/liquid-glass/crystal-future.webp"],
    ["Plataformas etéreas", "assets/media/liquid-glass/cloud-platforms.webp"],
    ["Paisaje futurista", "assets/media/liquid-glass/future-landscape.webp"],
    ["Cielo suave", "assets/media/liquid-glass/soft-sky.webp"],
    ["Nubes serenas", "assets/media/liquid-glass/serene-clouds.webp"],
    ["Nubes azules", "assets/media/liquid-glass/blue-clouds.webp"],
    ["Órbita líquida", "assets/media/liquid-glass/liquid-orbit.webp"]
  ];

  let target = "hero";
  let modal = null;
  let selectedUrl = "";
  let enhanceQueued = false;
  let observer = null;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  function notify(title, detail, type = "success") {
    try { (window.premiumToast || window.toast)?.(title, detail, type); } catch (_) {}
  }

  function targetLabel(value) {
    if (value === "hero") return "Portada principal";
    if (value === "spotlight") return "Panel destacado";
    if (value.startsWith("card:")) return `Panel visual ${Number(value.split(":")[1]) + 1}`;
    if (value.startsWith("gallery:")) return `Galería · imagen ${Number(value.split(":")[1]) + 1}`;
    return "Imagen";
  }

  function targetField(value) {
    if (value === "hero") return q('[data-v1712-field="hero.image"]');
    if (value === "spotlight") return q('[data-v1712-field="spotlight.image"]');
    if (value.startsWith("card:")) return q('[data-v1712-field="card.image"]');
    if (value.startsWith("gallery:")) return q(`[data-v1712-gallery-image="${Number(value.split(":")[1])}"]`);
    return null;
  }

  function updateModalPreview() {
    const image = q(".ib-v17122-selected-preview img", modal);
    const empty = q(".ib-v17122-selected-empty", modal);
    if (!image || !empty) return;
    if (selectedUrl) {
      image.src = selectedUrl;
      image.hidden = false;
      empty.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      empty.hidden = false;
    }
  }

  function applyUrl(url) {
    const field = targetField(target);
    if (!field) {
      notify("No se encontró el panel", "Vuelve a abrir el editor visual.", "error");
      return false;
    }
    field.value = url;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    selectedUrl = url;
    updateModalPreview();
    q("[data-v1712-preview]")?.click();
    notify("Imagen aplicada", `${targetLabel(target)} se actualizó en la vista previa.`, "success");
    return true;
  }

  function setBusy(active, text = "Procesando…") {
    const busy = q(".ib-v17122-busy", modal);
    if (!busy) return;
    busy.hidden = !active;
    const label = q("span", busy);
    if (label) label.textContent = text;
  }

  async function upload(file, input = null) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Usa JPG, PNG o WebP.");
    if (file.size > 12 * 1024 * 1024) throw new Error("La imagen supera 12 MB.");
    setBusy(true, "Optimizando y cargando…");
    try {
      let url = "";
      if (typeof window.v415UploadOrInline === "function") {
        url = await window.v415UploadOrInline(file, {
          folder: "visual-content",
          maxSide: 2400,
          quality: 0.88,
          statusId: ""
        });
      } else {
        url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
          reader.readAsDataURL(file);
        });
      }
      if (applyUrl(url)) close();
    } finally {
      if (input) input.value = "";
      setBusy(false);
    }
  }

  function library() {
    const seen = new Set();
    const fromBuilder = qa("[data-v1712-library]").map((button) => ({
      url: button.dataset.v1712Library || "",
      name: button.getAttribute("aria-label") || button.title || q("span", button)?.textContent || "Imagen"
    }));
    const source = fromBuilder.length ? fromBuilder : FALLBACK_LIBRARY.map(([name, url]) => ({ name, url }));
    return source.filter((item) => item.url && !seen.has(item.url) && seen.add(item.url));
  }

  function open(value) {
    target = value || "hero";
    selectedUrl = targetField(target)?.value || "";
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "ib-v17122-media-modal";
      document.body.appendChild(modal);
    }
    const items = library();
    modal.innerHTML = `
      <div class="ib-v17122-media-backdrop" data-close></div>
      <section class="ib-v17122-media-dialog" role="dialog" aria-modal="true" aria-label="Selector de imagen">
        <header>
          <div><span>EDITOR VISUAL · ${VERSION}</span><h2>Cambiar imagen</h2><p>${esc(targetLabel(target))}</p></div>
          <button type="button" class="ib-v17122-close" data-close aria-label="Cerrar">×</button>
        </header>
        <div class="ib-v17122-selected-preview">
          <img alt="Vista previa actual">
          <div class="ib-v17122-selected-empty">Sin imagen seleccionada</div>
          <strong>Vista previa actual</strong>
        </div>
        <div class="ib-v17122-media-tabs">
          <button type="button" class="active" data-tab="library">Biblioteca</button>
          <button type="button" data-tab="upload">Subir imagen</button>
          <button type="button" data-tab="url">Usar enlace</button>
        </div>
        <div class="ib-v17122-tab active" data-pane="library">
          <p class="ib-v17122-help">Elige una imagen incluida. El cambio se verá inmediatamente antes de publicar.</p>
          <div class="ib-v17122-library">${items.map((item, index) => `
            <button type="button" data-pick="${esc(item.url)}">
              <img src="${esc(item.url)}" alt="${esc(item.name)}"><span>${esc(item.name || `Imagen ${index + 1}`)}</span><i>Usar</i>
            </button>`).join("")}</div>
        </div>
        <div class="ib-v17122-tab" data-pane="upload">
          <div class="ib-v17122-drop" role="button" tabindex="0" aria-label="Seleccionar o arrastrar una imagen">
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden>
            <b>Arrastra una imagen aquí</b><span>o toca para buscar en tu dispositivo</span><small>JPG, PNG o WebP · máximo 12 MB</small>
          </div>
        </div>
        <div class="ib-v17122-tab" data-pane="url">
          <label class="ib-v17122-url"><span>Pega la URL de una imagen</span>
            <input type="url" placeholder="https://…" value="${selectedUrl.startsWith("http") ? esc(selectedUrl) : ""}">
            <button type="button">Aplicar enlace</button>
          </label>
        </div>
        <div class="ib-v17122-busy" hidden><i></i><span>Procesando…</span></div>
        <footer><button type="button" data-remove>Quitar imagen</button><button type="button" class="primary" data-close>Listo</button></footer>
      </section>`;
    modal.classList.add("open");
    document.body.classList.add("ib-v17122-modal-open");
    updateModalPreview();
    bindModal();
  }

  function close() {
    modal?.classList.remove("open");
    document.body.classList.remove("ib-v17122-modal-open");
  }

  function bindModal() {
    qa("[data-close]", modal).forEach((node) => node.addEventListener("click", close));
    qa("[data-tab]", modal).forEach((button) => button.addEventListener("click", () => {
      qa("[data-tab]", modal).forEach((node) => node.classList.toggle("active", node === button));
      qa("[data-pane]", modal).forEach((node) => node.classList.toggle("active", node.dataset.pane === button.dataset.tab));
    }));
    qa("[data-pick]", modal).forEach((button) => button.addEventListener("click", () => {
      if (applyUrl(button.dataset.pick || "")) close();
    }));

    const drop = q(".ib-v17122-drop", modal);
    const input = q(".ib-v17122-drop input", modal);
    drop?.addEventListener("click", (event) => {
      if (event.target === input) return;
      input?.click();
    });
    drop?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      input?.click();
    });
    input?.addEventListener("change", () => {
      upload(input.files?.[0], input).catch((error) => notify("No se pudo usar la imagen", error.message, "error"));
    });
    ["dragenter", "dragover"].forEach((name) => drop?.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add("drag");
    }));
    ["dragleave", "drop"].forEach((name) => drop?.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove("drag");
    }));
    drop?.addEventListener("drop", (event) => {
      upload(event.dataTransfer?.files?.[0], input).catch((error) => notify("No se pudo usar la imagen", error.message, "error"));
    });

    q(".ib-v17122-url button", modal)?.addEventListener("click", () => {
      const value = q(".ib-v17122-url input", modal)?.value.trim();
      if (!/^https?:\/\//i.test(value || "")) {
        notify("Enlace no válido", "Debe comenzar con http:// o https://", "warning");
        return;
      }
      if (applyUrl(value)) close();
    });
    q("[data-remove]", modal)?.addEventListener("click", () => {
      if (applyUrl("")) close();
    });
  }

  function enhanceBuilder() {
    const pane = q("#admin_visual");
    if (!pane) return;
    qa("[data-v1712-target]", pane).forEach((button) => {
      const desired = button.dataset.v1712Target.startsWith("gallery:")
        ? "Cambiar o subir imagen"
        : "Elegir, subir o arrastrar imagen";
      if (button.textContent.trim() !== desired) button.textContent = desired;
      if (!button.classList.contains("ib-v17122-media-trigger")) button.classList.add("ib-v17122-media-trigger");
      button.dataset.v17123Enhanced = "1";
    });
    qa('input[data-v1712-field$=".image"],input[data-v1712-gallery-image]', pane).forEach((input) => {
      const label = input.closest("label");
      if (label && !label.querySelector(".ib-v17122-input-note")) {
        label.insertAdjacentHTML("beforeend", '<small class="ib-v17122-input-note">También puedes pegar un enlace directo aquí.</small>');
      }
    });
  }

  function scheduleEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      enhanceBuilder();
    });
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => [...record.addedNodes].some((node) => {
        if (!(node instanceof Element)) return false;
        return node.id === "admin_visual" || node.matches?.("[data-v1712-target], [data-v1712-field], [data-v1712-gallery-image]") ||
          Boolean(node.querySelector?.("#admin_visual, [data-v1712-target], [data-v1712-field], [data-v1712-gallery-image]"));
      }));
      if (relevant) scheduleEnhance();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-v1712-target]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(button.dataset.v1712Target);
  }, true);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });

  function bootEditor() {
    enhanceBuilder();
    startObserver();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootEditor, { once: true });
  else bootEditor();
  window.addEventListener("load", () => setTimeout(scheduleEnhance, 300), { once: true });

  window.INBESTIGA_REAL_CRYSTAL_EDITOR = { version: VERSION, open, enhance: scheduleEnhance };
})();
