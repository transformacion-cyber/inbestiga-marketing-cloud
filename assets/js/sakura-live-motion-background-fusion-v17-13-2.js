/* INBESTIGA Marketing Cloud v17.13.2 · SAKURA Particle Motion Sync Hotfix */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_LIVE_VISUALS?.version === "v17.13.2") return;

  const VERSION = "v17.13.2";
  const MODULE = "sakura-live-motion-background-fusion-v17-13-2";
  /* Se conserva la clave v17.13.1 para migrar la elección ya realizada por el usuario. */
  const STORAGE_KEY = "inbestiga_sakura_live_visuals_v17131";
  const MODES = new Set(["full", "moderate", "low", "off"]);
  const root = document.documentElement;
  const state = loadState();
  const particleFallbacks = new WeakMap();
  let attached = false;
  let repairInFlight = null;
  let motionBootstrapped = false;
  let studioMotionWrite = null;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
      return {
        motionMode: MODES.has(saved.motionMode) ? saved.motionMode : "full",
        explicitMotionChoice: saved.explicitMotionChoice === true,
        lastBackgroundAssetId: String(saved.lastBackgroundAssetId || ""),
        lastBackgroundStatus: saved.lastBackgroundStatus || "pending"
      };
    } catch {
      return { motionMode: "full", explicitMotionChoice: false, lastBackgroundAssetId: "", lastBackgroundStatus: "pending" };
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
  function toast(title, detail = "", tone = "success") {
    try { if (window.premiumToast) return window.premiumToast(title, detail, tone); } catch {}
    console[tone === "error" ? "error" : "info"](`[SAKURA v17.13.2] ${title}`, detail);
  }
  function styleNow() { return window.INBESTIGA_SAKURA_STUDIO?.load?.() || {}; }
  function panelNow() { return document.getElementById("sakuraNativePanel"); }
  function desiredMotionStyle(mode) {
    return { motionMode: mode, orbAnimation: mode !== "off", lowPower: mode === "low" };
  }
  function styleMatchesMotion(style, mode) {
    const desired = desiredMotionStyle(mode);
    return style?.motionMode === desired.motionMode && style?.orbAnimation === desired.orbAnimation && style?.lowPower === desired.lowPower;
  }

  function applyMotionDataset(mode) {
    root.dataset.sakuraMotionPolicy = mode;
    root.dataset.sakuraVisible = document.hidden ? "false" : "true";
    root.dataset.sakuraOrbAnimation = mode === "off" ? "off" : "on";
    root.dataset.sakuraLowPower = mode === "low" ? "true" : "false";
    root.style.setProperty("--sk-live-motion-scale", mode === "moderate" ? "1.55" : mode === "low" ? "2.4" : "1");
  }

  function cancelParticleFallback(element) {
    const animation = particleFallbacks.get(element);
    if (animation) {
      try { animation.cancel(); } catch {}
      particleFallbacks.delete(element);
    }
    element?.classList?.remove("sk-particle-waapi-fallback");
  }
  function ensureParticleFallback(element, mode, force = false) {
    if (!element) return null;
    if (mode === "off" || mode === "low" || document.hidden) {
      cancelParticleFallback(element);
      return null;
    }
    const existing = particleFallbacks.get(element);
    if (existing) {
      try { existing.play(); } catch {}
      return existing;
    }
    const nativeAnimations = element.getAnimations?.() || [];
    const computed = getComputedStyle(element);
    if (!force && nativeAnimations.length && computed.animationName !== "none") {
      nativeAnimations.forEach(animation => { try { if (animation.playState !== "running") animation.play(); } catch {} });
      return null;
    }
    element.classList.add("sk-particle-waapi-fallback");
    const duration = mode === "moderate" ? 13000 : 8400;
    const animation = element.animate([
      { transform: "rotate(0deg) scale(.96)", filter: "brightness(.9)" },
      { transform: "rotate(90deg) scale(1.035)", filter: "brightness(1.18)" },
      { transform: "rotate(180deg) scale(.985)", filter: "brightness(1)" },
      { transform: "rotate(270deg) scale(1.025)", filter: "brightness(1.15)" },
      { transform: "rotate(360deg) scale(.96)", filter: "brightness(.9)" }
    ], { duration, iterations: Infinity, easing: "linear" });
    try { animation.id = "sakura-particle-fallback-v17-13-2"; } catch {}
    particleFallbacks.set(element, animation);
    return animation;
  }

  function repairMotionNow({ forceParticleFallback = false } = {}) {
    applyMotionDataset(state.motionMode);
    const hosts = [...document.querySelectorAll(".sk-tech-core")];
    hosts.forEach(host => {
      host.dataset.motionPolicy = state.motionMode;
      const animations = host.getAnimations?.({ subtree: true }) || [];
      if (state.motionMode === "off" || document.hidden) {
        animations.forEach(animation => { try { animation.pause(); } catch {} });
      } else {
        animations.forEach(animation => { try { if (animation.playState !== "running") animation.play(); } catch {} });
      }
      const particles = host.querySelector(".tc-particles");
      ensureParticleFallback(particles, state.motionMode, forceParticleFallback);
    });
    return hosts.length;
  }

  async function persistStudioMotion(mode) {
    if (studioMotionWrite) return studioMotionWrite;
    const studio = window.INBESTIGA_SAKURA_STUDIO;
    if (!studio?.load || !studio?.apply) return false;
    const current = studio.load() || {};
    if (styleMatchesMotion(current, mode)) return true;
    const next = { ...current, ...desiredMotionStyle(mode) };
    studioMotionWrite = Promise.resolve(studio.apply(next, { persist: true }))
      .then(() => {
        applyMotionDataset(mode);
        requestAnimationFrame(() => repairMotionNow());
        return true;
      })
      .catch(error => {
        console.info("[SAKURA v17.13.2] No se pudo sincronizar la preferencia de movimiento", error?.message || error);
        return false;
      })
      .finally(() => { studioMotionWrite = null; });
    return studioMotionWrite;
  }

  function setMotionMode(mode, { persist = true, explicit = true, syncStudio = explicit } = {}) {
    mode = MODES.has(mode) ? mode : "full";
    state.motionMode = mode;
    if (explicit) state.explicitMotionChoice = true;
    if (persist) saveState();
    applyMotionDataset(mode);
    requestAnimationFrame(() => repairMotionNow());
    if (syncStudio) void persistStudioMotion(mode);
    updateMotionDiagnostic();
    document.dispatchEvent(new CustomEvent("sakura:motion-mode-changed", { detail: { mode } }));
    return mode;
  }

  function animationSnapshot(element) {
    if (!element) return null;
    const animations = element.getAnimations?.() || [];
    const animation = animations.find(item => item.id === "sakura-particle-fallback-v17-13-2")
      || animations.find(item => item.playState === "running")
      || animations.find(item => item.playState !== "finished")
      || animations[0];
    const computed = getComputedStyle(element);
    return {
      element,
      animation,
      currentTime: Number(animation?.currentTime || 0),
      playState: animation?.playState || "missing",
      transform: computed.transform,
      opacity: computed.opacity,
      animationName: computed.animationName,
      display: computed.display
    };
  }
  function snapshotMoved(first, second) {
    if (!first || !second || second.display === "none") return false;
    const timelineMoved = second.currentTime > first.currentTime + 24 && second.playState === "running";
    const visualMoved = second.transform !== first.transform || second.opacity !== first.opacity;
    return timelineMoved && visualMoved;
  }

  async function verifyMotion({ retry = true } = {}) {
    const host = document.querySelector("#skPresence .sk-tech-core, #sakuraNativeLauncher .sk-tech-core");
    if (!host) return { ok: false, reason: "Abre SAKURA para comprobar el núcleo." };
    if (state.motionMode === "off") return { ok: false, reason: "Las animaciones están desactivadas por el usuario." };
    repairMotionNow();
    const selectors = state.motionMode === "low"
      ? [["núcleo", ".tc-core"], ["anillo", ".r1"]]
      : [["núcleo", ".tc-core"], ["anillo", ".r1"], ["escáner", ".tc-scanner"], ["ondas", ".tc-wave"], ["partículas", ".tc-particles"]];
    const candidates = selectors.map(([label, selector]) => ({ label, selector, snap: animationSnapshot(host.querySelector(selector)) }));
    const first = candidates.filter(item => item.snap && item.snap.display !== "none");
    const skipped = candidates.filter(item => !item.snap || item.snap.display === "none").map(item => item.label);
    await new Promise(resolve => setTimeout(resolve, 480));
    const checks = first.map(item => {
      const second = animationSnapshot(host.querySelector(item.selector));
      return { label: item.label, ok: snapshotMoved(item.snap, second), first: item.snap, second };
    });
    const failed = checks.filter(check => !check.ok);
    if (failed.some(check => check.label === "partículas") && retry && state.motionMode !== "low") {
      ensureParticleFallback(host.querySelector(".tc-particles"), state.motionMode, true);
      return verifyMotion({ retry: false });
    }
    const ok = checks.length > 0 && failed.length === 0;
    const skippedText = skipped.length ? ` Capas ocultas por el diseño: ${skipped.join(", ")}.` : "";
    const detail = ok
      ? `Movimiento real confirmado en ${checks.map(check => check.label).join(", ")}.${skippedText}`
      : `Sin movimiento confirmado en: ${failed.map(check => check.label).join(", ") || "capas visibles"}.${skippedText}`;
    return {
      ok,
      reason: detail,
      layers: [
        ...checks.map(check => ({ layer: check.label, ok: check.ok, playState: check.second?.playState || "missing", animationName: check.second?.animationName || "none" })),
        ...skipped.map(layer => ({ layer, ok: true, skipped: "hidden-by-design" }))
      ]
    };
  }

  function ensureBackgroundLayer() {
    const panel = panelNow();
    if (!panel) return null;
    let layer = panel.querySelector(":scope > .sk-live-background-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "sk-live-background-layer";
      layer.setAttribute("aria-hidden", "true");
      panel.prepend(layer);
    }
    return layer;
  }

  function setBackgroundStatus(ok, detail, assetId = "") {
    root.dataset.sakuraBackgroundLive = ok ? "true" : "false";
    state.lastBackgroundStatus = ok ? "verified" : "error";
    if (assetId) state.lastBackgroundAssetId = assetId;
    saveState();
    const panel = panelNow();
    if (panel) {
      panel.dataset.backgroundLive = ok ? "true" : "false";
      panel.title = ok ? "Fondo personalizado verificado" : panel.title;
    }
    updateBackgroundDiagnostic(detail, ok);
  }

  async function repairBackground({ notify = false, analyze = false } = {}) {
    if (repairInFlight) return repairInFlight;
    repairInFlight = (async () => {
      const studio = window.INBESTIGA_SAKURA_STUDIO;
      if (!studio?.load || !studio?.apply) return { ok: false, reason: "El editor de SAKURA todavía no está disponible." };
      let style = styleNow();
      if (style.backgroundType !== "image" || !style.backgroundAssetId) {
        root.dataset.sakuraBackgroundLive = "false";
        panelNow()?.classList.remove("sk-has-user-image");
        return { ok: false, reason: "No hay una fotografía seleccionada." };
      }
      ensureBackgroundLayer();
      await studio.apply(style, { persist: true });
      if (analyze) {
        try {
          const fusion = window.INBESTIGA_SAKURA_ADAPTIVE_INTELLIGENCE?.fusion;
          await fusion?.analyze?.();
          await fusion?.applyProposal?.(0, true);
          style = styleNow();
          await studio.apply(style, { persist: true });
        } catch (error) {
          console.info("[SAKURA v17.13.2] La paleta automática mantendrá la configuración actual", error?.message || error);
        }
      }
      const verification = await studio.verifyBackground?.(style).catch(error => ({ ok: false, reason: error?.message || String(error) }));
      const cssImage = getComputedStyle(root).getPropertyValue("--sk-panel-image").trim();
      const layer = ensureBackgroundLayer();
      const computedLayer = layer ? getComputedStyle(layer).backgroundImage : "";
      const ok = verification?.ok === true && cssImage.includes("blob:") && computedLayer.includes("blob:");
      const reason = ok ? "La fotografía está visible y fusionada con todo el panel." : (verification?.reason || "El navegador no confirmó el fondo visual.");
      setBackgroundStatus(ok, reason, style.backgroundAssetId);
      if (notify) toast(ok ? "Fondo reparado" : "Fondo no visible", reason, ok ? "success" : "error");
      return { ok, reason, assetId: style.backgroundAssetId };
    })().finally(() => { repairInFlight = null; });
    return repairInFlight;
  }

  function updateMotionDiagnostic(result) {
    const card = document.getElementById("skLiveVisualDiagnostics");
    if (!card) return;
    const select = card.querySelector("#skLiveMotionMode");
    if (select) select.value = state.motionMode;
    const status = card.querySelector("[data-sk-motion-status]");
    if (status) text(status, result?.reason || `Modo ${state.motionMode}.`);
  }
  function text(element, value) { element.textContent = String(value || ""); }
  function updateBackgroundDiagnostic(detail, ok) {
    const card = document.getElementById("skLiveVisualDiagnostics");
    if (!card) return;
    const status = card.querySelector("[data-sk-background-status]");
    if (status) {
      text(status, detail || (ok ? "Fondo verificado." : "Fondo pendiente."));
      status.dataset.ok = ok ? "true" : "false";
    }
  }

  function installDiagnostics() {
    const host = document.querySelector("#sakuraNativePanel #skViewSettings");
    if (!host || document.getElementById("skLiveVisualDiagnostics")) return false;
    const card = document.createElement("section");
    card.id = "skLiveVisualDiagnostics";
    card.className = "sk-section sk-live-diagnostics";
    card.innerHTML = `
      <h3>Movimiento y fondo · v17.13.2</h3>
      <p>Comprueba el movimiento real del núcleo, los anillos, el escáner y las partículas del panel activo.</p>
      <label class="sk-live-field"><span>Nivel de animación</span><select id="skLiveMotionMode"><option value="full">Completa</option><option value="moderate">Moderada</option><option value="low">Bajo consumo</option><option value="off">Sin animación</option></select></label>
      <div class="sk-live-status"><strong>Animación</strong><span data-sk-motion-status>Modo ${state.motionMode}.</span></div>
      <div class="sk-live-actions"><button type="button" id="skActivateMotion">Activar animaciones ahora</button><button type="button" id="skTestMotion">Probar movimiento</button></div>
      <div class="sk-live-status"><strong>Fondo</strong><span data-sk-background-status>Comprobación pendiente.</span></div>
      <div class="sk-live-actions"><button type="button" id="skRepairBackground">Reparar fondo</button><button type="button" id="skRefuseBackground">Fusionar y adaptar colores</button></div>`;
    host.appendChild(card);
    const select = card.querySelector("#skLiveMotionMode");
    select.value = state.motionMode;
    select.addEventListener("change", () => setMotionMode(select.value));
    card.querySelector("#skActivateMotion").addEventListener("click", async () => {
      setMotionMode("full");
      await persistStudioMotion("full");
      const result = await verifyMotion();
      updateMotionDiagnostic(result);
      toast(result.ok ? "Animaciones activas" : "Animación no confirmada", result.reason, result.ok ? "success" : "warning");
    });
    card.querySelector("#skTestMotion").addEventListener("click", async () => {
      const result = await verifyMotion();
      updateMotionDiagnostic(result);
      toast(result.ok ? "Movimiento confirmado" : "Movimiento detenido", result.reason, result.ok ? "success" : "warning");
    });
    card.querySelector("#skRepairBackground").addEventListener("click", () => repairBackground({ notify: true }));
    card.querySelector("#skRefuseBackground").addEventListener("click", () => repairBackground({ notify: true, analyze: true }));
    return true;
  }

  function enhancePanel() {
    const panel = panelNow();
    if (!panel) return false;
    ensureBackgroundLayer();
    installDiagnostics();
    const style = styleNow();
    if (!motionBootstrapped) {
      const legacyMode = MODES.has(style.motionMode) ? style.motionMode : "full";
      const legacyStopped = legacyMode === "off" || style.lowPower === true || style.orbAnimation === false;
      state.motionMode = state.explicitMotionChoice ? state.motionMode : (legacyStopped ? "full" : legacyMode);
      motionBootstrapped = true;
      if (legacyStopped && !state.explicitMotionChoice) void persistStudioMotion("full");
    }
    setMotionMode(state.motionMode, { persist: false, explicit: false, syncStudio: false });
    if (!styleMatchesMotion(style, state.motionMode)) void persistStudioMotion(state.motionMode);
    if (style.backgroundType === "image" && style.backgroundAssetId) repairBackground();
    return true;
  }

  function wrapLoader() {
    const loader = window.INBESTIGA_SAKURA_LOADER;
    if (!loader?.load || loader.load.__v17132) return;
    const base = loader.load;
    const wrapped = async function () {
      const result = await base.apply(this, arguments);
      requestAnimationFrame(() => { enhancePanel(); setTimeout(enhancePanel, 160); });
      return result;
    };
    wrapped.__v17132 = true;
    wrapped.__base = base;
    loader.load = wrapped;
  }

  function registerBuild() {
    try { window.INBESTIGA_QUALITY_CORE?.register?.(MODULE, { version: VERSION, mode: "particle-motion-sync-hotfix", polling: false, realtimeChannels: 0, mutations: false }); } catch {}
    const build = window.INBESTIGA_BUILD || {};
    window.INBESTIGA_BUILD = { ...build, version: VERSION, name: "SAKURA PARTICLE MOTION SYNC HOTFIX", modules: [...new Set([...(Array.isArray(build.modules) ? build.modules : []), MODULE])] };
    root.dataset.inbestigaBuild = VERSION;
  }

  function attach() {
    wrapLoader();
    enhancePanel();
    registerBuild();
    if (attached) return true;
    attached = true;
    setMotionMode(state.motionMode, { persist: false, explicit: false, syncStudio: false });
    document.addEventListener("sakura:style-applied", event => {
      const style = event.detail || {};
      queueMicrotask(() => {
        if (!state.explicitMotionChoice && MODES.has(style.motionMode) && style.orbAnimation !== false && style.lowPower !== true) {
          state.motionMode = style.motionMode;
        }
        applyMotionDataset(state.motionMode);
        if (!styleMatchesMotion(style, state.motionMode)) void persistStudioMotion(state.motionMode);
        requestAnimationFrame(() => { enhancePanel(); repairMotionNow(); if (style.backgroundType === "image") repairBackground(); });
      });
    }, { passive: true });
    document.addEventListener("sakura:background-verified", event => {
      const detail = event.detail || {};
      setBackgroundStatus(detail.ok === true, detail.reason || "Comprobación terminada.", detail.assetId || "");
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      root.dataset.sakuraVisible = document.hidden ? "false" : "true";
      if (!document.hidden) {
        applyMotionDataset(state.motionMode);
        requestAnimationFrame(() => repairMotionNow());
      }
    }, { passive: true });
    document.addEventListener("click", event => {
      if (event.target.closest('[data-sk-tab="settings"]')) requestAnimationFrame(() => setTimeout(installDiagnostics, 30));
    }, true);
    window.addEventListener("pageshow", () => requestAnimationFrame(() => { enhancePanel(); repairMotionNow(); registerBuild(); }), { passive: true });
    return true;
  }

  function health() {
    return {
      status: "ok",
      value: "SAKURA Particle Motion Sync",
      detail: `Movimiento ${state.motionMode}; verificación específica de partículas; fondo ${state.lastBackgroundStatus}; sin polling, Realtime ni observadores globales.`
    };
  }

  const api = { version: VERSION, attach, setMotionMode, verifyMotion, repairMotionNow, repairBackground, health, state: () => ({ ...state }) };
  window.INBESTIGA_SAKURA_LIVE_VISUALS = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach, { once: true }); else attach();
  setTimeout(() => { wrapLoader(); enhancePanel(); registerBuild(); }, 450);
  setTimeout(() => { wrapLoader(); enhancePanel(); registerBuild(); }, 1400);
})();
