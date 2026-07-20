/* INBESTIGA Marketing Cloud v17.13.1 · SAKURA Live Motion & Intelligent Background Fusion Hotfix */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_LIVE_VISUALS?.version === "v17.13.1") return;

  const VERSION = "v17.13.1";
  const MODULE = "sakura-live-motion-background-fusion-v17-13-1";
  const STORAGE_KEY = "inbestiga_sakura_live_visuals_v17131";
  const MODES = new Set(["full", "moderate", "low", "off"]);
  const root = document.documentElement;
  const state = loadState();
  let attached = false;
  let repairInFlight = null;
  let motionBootstrapped = false;

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
    console[tone === "error" ? "error" : "info"](`[SAKURA v17.13.1] ${title}`, detail);
  }
  function styleNow() { return window.INBESTIGA_SAKURA_STUDIO?.load?.() || {}; }
  function panelNow() { return document.getElementById("sakuraNativePanel"); }

  function setMotionMode(mode, { persist = true, explicit = true } = {}) {
    mode = MODES.has(mode) ? mode : "full";
    state.motionMode = mode;
    if (explicit) state.explicitMotionChoice = true;
    if (persist) saveState();
    root.dataset.sakuraMotionPolicy = mode;
    root.dataset.sakuraVisible = document.hidden ? "false" : "true";
    root.dataset.sakuraOrbAnimation = mode === "off" ? "off" : "on";
    root.dataset.sakuraLowPower = mode === "low" ? "true" : "false";
    root.style.setProperty("--sk-live-motion-scale", mode === "moderate" ? "1.55" : mode === "low" ? "2.4" : "1");
    updateMotionDiagnostic();
    document.dispatchEvent(new CustomEvent("sakura:motion-mode-changed", { detail: { mode } }));
    return mode;
  }

  async function verifyMotion() {
    const host = document.querySelector("#skPresence .sk-tech-core, #sakuraNativeLauncher .sk-tech-core");
    if (!host) return { ok: false, reason: "Abre SAKURA para comprobar el núcleo." };
    if (state.motionMode === "off") return { ok: false, reason: "Las animaciones están desactivadas por el usuario." };
    const target = host.querySelector(".r1, .tc-core, .tc-scanner");
    if (!target) return { ok: false, reason: "No se encontró una capa animada." };
    const animations = target.getAnimations?.() || [];
    const animation = animations.find(item => item.playState !== "finished");
    if (!animation) return { ok: false, reason: "El navegador no inició la animación CSS." };
    const first = Number(animation.currentTime || 0);
    await new Promise(resolve => setTimeout(resolve, 360));
    const second = Number(animation.currentTime || 0);
    const ok = second > first && animation.playState === "running";
    return { ok, reason: ok ? "Movimiento real confirmado." : `La animación está ${animation.playState || "pausada"}.` };
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
          console.info("[SAKURA v17.13.1] La paleta automática mantendrá la configuración actual", error?.message || error);
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
    if (status) status.textContent = result?.reason || `Modo ${state.motionMode}.`;
  }
  function updateBackgroundDiagnostic(detail, ok) {
    const card = document.getElementById("skLiveVisualDiagnostics");
    if (!card) return;
    const status = card.querySelector("[data-sk-background-status]");
    if (status) {
      status.textContent = detail || (ok ? "Fondo verificado." : "Fondo pendiente.");
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
      <h3>Movimiento y fondo · v17.13.1</h3>
      <p>Comprueba que el núcleo esté realmente animado y que la fotografía se vea en el panel activo.</p>
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
      /* Migra preferencias antiguas que podían dejar el núcleo inmóvil. El usuario puede volver a elegir Bajo consumo o Sin animación explícitamente. */
      const legacyMode = MODES.has(style.motionMode) ? style.motionMode : "full";
      state.motionMode = state.explicitMotionChoice ? state.motionMode : ((legacyMode === "off" || style.lowPower === true) ? "full" : legacyMode);
      motionBootstrapped = true;
    }
    setMotionMode(state.motionMode, { persist: false, explicit: false });
    if (style.backgroundType === "image" && style.backgroundAssetId) repairBackground();
    return true;
  }

  function wrapLoader() {
    const loader = window.INBESTIGA_SAKURA_LOADER;
    if (!loader?.load || loader.load.__v17131) return;
    const base = loader.load;
    const wrapped = async function () {
      const result = await base.apply(this, arguments);
      requestAnimationFrame(() => { enhancePanel(); setTimeout(enhancePanel, 160); });
      return result;
    };
    wrapped.__v17131 = true;
    wrapped.__base = base;
    loader.load = wrapped;
  }

  function attach() {
    wrapLoader();
    enhancePanel();
    if (attached) return true;
    attached = true;
    setMotionMode(state.motionMode, { persist: false, explicit: false });
    document.addEventListener("sakura:style-applied", event => {
      const style = event.detail || {};
      if (!state.explicitMotionChoice && MODES.has(style.motionMode)) setMotionMode(style.motionMode, { persist: false, explicit: false });
      requestAnimationFrame(() => { enhancePanel(); if (style.backgroundType === "image") repairBackground(); });
    }, { passive: true });
    document.addEventListener("sakura:background-verified", event => {
      const detail = event.detail || {};
      setBackgroundStatus(detail.ok === true, detail.reason || "Comprobación terminada.", detail.assetId || "");
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      root.dataset.sakuraVisible = document.hidden ? "false" : "true";
      if (!document.hidden) setMotionMode(state.motionMode, { persist: false, explicit: false });
    }, { passive: true });
    document.addEventListener("click", event => {
      if (event.target.closest('[data-sk-tab="settings"]')) requestAnimationFrame(() => setTimeout(installDiagnostics, 30));
    }, true);
    window.addEventListener("pageshow", () => requestAnimationFrame(enhancePanel), { passive: true });
    try { window.INBESTIGA_QUALITY_CORE?.register?.(MODULE, { version: VERSION, mode: "visual-hotfix", polling: false, realtimeChannels: 0, mutations: false }); } catch {}
    return true;
  }

  function health() {
    return {
      status: "ok",
      value: "SAKURA Live Motion & Background Fusion",
      detail: `Movimiento ${state.motionMode}; fondo ${state.lastBackgroundStatus}; sin polling, Realtime ni observadores globales.`
    };
  }

  const api = { version: VERSION, attach, setMotionMode, verifyMotion, repairBackground, health, state: () => ({ ...state }) };
  window.INBESTIGA_SAKURA_LIVE_VISUALS = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach, { once: true }); else attach();
  setTimeout(() => { wrapLoader(); enhancePanel(); }, 450);
  setTimeout(() => { wrapLoader(); enhancePanel(); }, 1400);
})();
