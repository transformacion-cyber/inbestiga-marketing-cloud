/* INBESTIGA Marketing Cloud v17.12.13 · SAKURA native lazy loader */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_LOADER) return;
  const VERSION = "v17.12.13";
  const MODULE = "sakura-native-loader-v17-12-13";
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
        link.href = "assets/css/sakura-native-pilot-v17-12-13.css";
        link.dataset.sakuraNativeCss = "1";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "assets/js/sakura-native-pilot-v17-12-13.js";
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
      style.textContent = `.sakura-native-launcher-shell{position:fixed;right:22px;bottom:max(22px,env(safe-area-inset-bottom));z-index:2100;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.64);border-radius:999px;padding:8px 14px 8px 8px;background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(245,235,255,.76));box-shadow:0 16px 42px rgba(82,37,133,.22),inset 0 1px 0 #fff;backdrop-filter:blur(24px);color:#24142f;cursor:pointer}.sakura-native-launcher-shell[hidden]{display:none!important}.sakura-native-launcher-orb{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 36% 28%,#fff 0 12%,#ffc5ed 26%,#ba72ff 54%,#6d27bd 78%,#32104f 100%);box-shadow:0 0 0 5px rgba(132,69,217,.10),0 0 28px rgba(187,94,255,.42)}.sakura-native-launcher-copy{display:grid;text-align:left;line-height:1.05}.sakura-native-launcher-copy strong{font-size:12px;letter-spacing:.14em}.sakura-native-launcher-copy small{font-size:9px;color:#786d83;margin-top:4px}@media(max-width:720px){.sakura-native-launcher-shell{right:12px;bottom:max(12px,env(safe-area-inset-bottom));padding-right:10px}.sakura-native-launcher-copy small{display:none}}`;
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
