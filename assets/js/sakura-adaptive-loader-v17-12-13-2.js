/* INBESTIGA Marketing Cloud v17.12.13.2 · SAKURA adaptive lazy loader */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_LOADER) return;
  const VERSION = "v17.12.13.2";
  const MODULE = "sakura-adaptive-loader-v17-12-13-2";
  const runtime = window.INBESTIGA_PUBLIC_RUNTIME_CONFIG || {};
  const flags = Object.assign({
    enabled: true,
    chat: true,
    actions: true,
    learning: true,
    voice: true,
    reports: true,
    bridgeUrl: "http://127.0.0.1:8765"
  }, runtime.sakura || {});
  let loading = null;

  function appVisible() {
    const app = document.getElementById("appScreen");
    return !!app && !app.classList.contains("hidden");
  }
  function syncVisibility() {
    const button = document.getElementById("sakuraNativeLauncher");
    if (button) button.hidden = !appVisible() || flags.enabled === false;
  }
  async function loadPilot() {
    if (window.INBESTIGA_SAKURA_NATIVE?.open) return window.INBESTIGA_SAKURA_NATIVE.open();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-sakura-native-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "assets/css/sakura-adaptive-workspace-v17-12-13-2.css";
        link.dataset.sakuraNativeCss = "1";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "assets/js/sakura-adaptive-workspace-v17-12-13-2.js";
      script.async = true;
      script.dataset.sakuraNativeModule = "1";
      script.onload = () => {
        loading = null;
        if (window.INBESTIGA_SAKURA_NATIVE?.open) {
          window.INBESTIGA_SAKURA_NATIVE.open();
          resolve(true);
        } else reject(new Error("SAKURA no pudo iniciar."));
      };
      script.onerror = () => {
        loading = null;
        reject(new Error("No se pudo cargar el módulo de SAKURA."));
      };
      document.body.appendChild(script);
    });
    return loading;
  }
  function createLauncher() {
    if (document.getElementById("sakuraNativeLauncher")) return;
    if (!document.getElementById("sakuraNativeLauncherStyle")) {
      const style = document.createElement("style");
      style.id = "sakuraNativeLauncherStyle";
      style.textContent = `.sakura-native-launcher-shell{position:fixed;right:22px;bottom:max(22px,env(safe-area-inset-bottom));z-index:2100;display:flex;align-items:center;gap:11px;padding:8px 15px 8px 8px;border:1px solid rgba(226,188,255,.24);border-radius:999px;color:#f8efff;cursor:pointer;background:linear-gradient(145deg,rgba(45,24,70,.96),rgba(18,11,30,.94));box-shadow:0 18px 48px rgba(38,13,68,.36),inset 0 1px 0 rgba(255,255,255,.12);transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease}.sakura-native-launcher-shell:hover{transform:translateY(-3px);box-shadow:0 23px 58px rgba(57,20,98,.46),inset 0 1px 0 rgba(255,255,255,.16)}.sakura-native-launcher-shell[hidden]{display:none!important}.sakura-native-launcher-orb{width:43px;height:43px;border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 34% 27%,#fff 0 8%,#f4d7ff 10%,#d39cff 24%,#9158ff 48%,#5a28d8 67%,#2a0c52 84%,#11051f 100%);box-shadow:0 0 0 5px rgba(153,86,255,.12),0 0 30px rgba(157,77,255,.52),0 0 48px rgba(238,92,187,.20)}.sakura-native-launcher-orb:before,.sakura-native-launcher-orb:after{content:"";position:absolute;border-radius:50%;pointer-events:none;border:1px solid rgba(214,174,255,.38);animation:skLauncherOrbit 6.5s linear infinite}.sakura-native-launcher-orb:before{inset:-5px}.sakura-native-launcher-orb:after{inset:-9px;border-style:dashed;animation-direction:reverse;animation-duration:9s}.sakura-native-launcher-orb i{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 14px #fff,15px 8px 0 -2px #ef61b9,-14px -8px 0 -2px #6dc9ff}.sakura-native-launcher-copy{display:grid;text-align:left;line-height:1.05}.sakura-native-launcher-copy strong{font-size:12px;letter-spacing:.15em}.sakura-native-launcher-copy small{font-size:9px;color:#b9a5c8;margin-top:4px}@keyframes skLauncherOrbit{to{transform:rotate(360deg)}}@media(max-width:720px){.sakura-native-launcher-shell{right:12px;bottom:max(12px,env(safe-area-inset-bottom));padding-right:10px}.sakura-native-launcher-copy small{display:none}}`;
      document.head.appendChild(style);
    }
    const button = document.createElement("button");
    button.id = "sakuraNativeLauncher";
    button.className = "sakura-native-launcher-shell";
    button.type = "button";
    button.setAttribute("aria-label", "Abrir SAKURA");
    button.innerHTML = '<span class="sakura-native-launcher-orb" aria-hidden="true"><i></i></span><span class="sakura-native-launcher-copy"><strong>SAKURA</strong><small>Compañera de trabajo</small></span>';
    button.addEventListener("click", () => loadPilot().catch(error => {
      try { window.premiumToast?.("SAKURA no pudo abrirse", error.message, "error"); }
      catch (_) { console.error(error); }
    }));
    document.body.appendChild(button);
    syncVisibility();
  }
  function installHooks() {
    const originalNav = window.navTo;
    if (typeof originalNav === "function" && !originalNav.__sakuraVisibilityWrapped) {
      const wrapped = function (...args) {
        const result = originalNav.apply(this, args);
        requestAnimationFrame(syncVisibility);
        return result;
      };
      wrapped.__sakuraVisibilityWrapped = true;
      wrapped.__sakuraBase = originalNav;
      window.navTo = wrapped;
    }
    const originalRenderAll = window.renderAll;
    if (typeof originalRenderAll === "function" && !originalRenderAll.__sakuraVisibilityWrapped) {
      const wrappedRender = async function (...args) {
        const result = await originalRenderAll.apply(this, args);
        requestAnimationFrame(syncVisibility);
        return result;
      };
      wrappedRender.__sakuraVisibilityWrapped = true;
      wrappedRender.__sakuraBase = originalRenderAll;
      window.renderAll = wrappedRender;
    }
    document.addEventListener("click", event => {
      if (event.target.closest("#loginForm, #logoutBtn")) setTimeout(syncVisibility, 450);
    }, { passive: true });
    window.addEventListener("pageshow", syncVisibility, { passive: true });
  }
  function registerBuild() {
    try { window.INBESTIGA_QUALITY_CORE?.register?.(MODULE, { version: VERSION, mode: "lazy", polling: false, realtimeChannels: 0 }); } catch (_) {}
  }
  function init() { createLauncher(); installHooks(); registerBuild(); }
  window.INBESTIGA_SAKURA_LOADER = { version: VERSION, flags, load: loadPilot, syncVisibility };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
