/* INBESTIGA Marketing Cloud v17.12.13.5 · SAKURA permanent presence + top navigation access */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_LOADER?.version === "v17.12.13.5") return;
  const VERSION = "v17.12.13.5";
  const MODULE = "sakura-presence-loader-v17-12-13-5";
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

  function notifyError(error) {
    try { window.premiumToast?.("SAKURA no pudo abrirse", error?.message || String(error), "error"); }
    catch (_) { console.error(error); }
  }

  function ensureLauncherStyle() {
    if (document.getElementById("sakuraNativeLauncherStyle")) return;
    const style = document.createElement("style");
    style.id = "sakuraNativeLauncherStyle";
    style.textContent = `
      .sakura-native-launcher-shell{position:fixed;right:22px;bottom:max(22px,env(safe-area-inset-bottom));z-index:2147482000;display:flex;align-items:center;gap:11px;padding:8px 15px 8px 8px;border:1px solid rgba(226,188,255,.30);border-radius:999px;color:#fff;cursor:pointer;background:#211529;box-shadow:0 16px 42px rgba(38,13,68,.32);transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease}
      .sakura-native-launcher-shell:hover{transform:translateY(-2px);box-shadow:0 20px 50px rgba(57,20,98,.42)}
      .sakura-native-launcher-shell[hidden]{display:none!important}
      .sakura-native-launcher-orb{width:43px;height:43px;border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 34% 27%,#fff 0 8%,#f4d7ff 10%,#d39cff 24%,#9158ff 48%,#5a28d8 67%,#2a0c52 84%,#11051f 100%);box-shadow:0 0 0 5px rgba(153,86,255,.12),0 0 30px rgba(157,77,255,.54),0 0 48px rgba(238,92,187,.22)}
      .sakura-native-launcher-orb:before,.sakura-native-launcher-orb:after{content:"";position:absolute;border-radius:50%;pointer-events:none;border:1px solid rgba(214,174,255,.40);animation:skLauncherOrbit 6.5s linear infinite}.sakura-native-launcher-orb:before{inset:-5px}.sakura-native-launcher-orb:after{inset:-9px;border-style:dashed;animation-direction:reverse;animation-duration:9s}
      .sakura-native-launcher-orb i{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 14px #fff,15px 8px 0 -2px #ef61b9,-14px -8px 0 -2px #6dc9ff}
      .sakura-native-launcher-copy{display:grid;text-align:left;line-height:1.05}.sakura-native-launcher-copy strong{font-size:12px;letter-spacing:.13em}.sakura-native-launcher-copy small{font-size:10px;color:#d0bfd9;margin-top:4px}
      @keyframes skLauncherOrbit{to{transform:rotate(360deg)}}
      @media(max-width:720px){.sakura-native-launcher-shell{right:12px;bottom:max(12px,env(safe-area-inset-bottom));padding-right:10px}.sakura-native-launcher-copy small{display:none}}
    `;
    document.head.appendChild(style);
  }

  async function loadWorkspace() {
    try { window.INBESTIGA_SAKURA_APPEARANCE?.refreshUser?.(); } catch (_) {}
    if (window.INBESTIGA_SAKURA_NATIVE?.open) return window.INBESTIGA_SAKURA_NATIVE.open();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-sakura-native-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "assets/css/sakura-apple-workspace-v17-12-13-5.css";
        link.dataset.sakuraNativeCss = "1";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "assets/js/sakura-apple-workspace-v17-12-13-5.js";
      script.async = true;
      script.dataset.sakuraNativeModule = "1";
      script.onload = () => {
        loading = null;
        if (!window.INBESTIGA_SAKURA_NATIVE?.open) return reject(new Error("SAKURA no pudo iniciar."));
        window.INBESTIGA_SAKURA_NATIVE.open();
        resolve(true);
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
    ensureLauncherStyle();
    let button = document.getElementById("sakuraNativeLauncher");
    if (!button) {
      button = document.createElement("button");
      button.id = "sakuraNativeLauncher";
      button.className = "sakura-native-launcher-shell";
      button.type = "button";
      button.setAttribute("aria-label", "Abrir SAKURA");
      button.innerHTML = '<span class="sakura-native-launcher-orb" aria-hidden="true"><i></i></span><span class="sakura-native-launcher-copy"><strong>SAKURA</strong><small>Compañera de trabajo</small></span>';
      button.addEventListener("click", () => loadWorkspace().catch(notifyError));
    }
    if (button.parentElement !== document.body) document.body.appendChild(button);
    button.hidden = flags.enabled === false;
  }

  function injectTopNavigationButton() {
    const right = document.querySelector("#v472AppleTopNav .v472-right");
    if (!right || document.getElementById("sakuraTopNavButton")) return false;
    const button = document.createElement("button");
    button.id = "sakuraTopNavButton";
    button.type = "button";
    button.setAttribute("aria-label", "Abrir SAKURA");
    button.innerHTML = '<span class="sk-top-orb" aria-hidden="true"></span><span>SAKURA</span>';
    button.addEventListener("click", () => loadWorkspace().catch(notifyError));
    const create = document.getElementById("v171210QuickCreateButton");
    if (create?.parentElement === right) right.insertBefore(button, create);
    else right.insertBefore(button, right.firstChild);
    return true;
  }

  function ensurePresence() {
    if (flags.enabled === false) return;
    createLauncher();
    injectTopNavigationButton();
  }

  function registerBuild() {
    try { window.INBESTIGA_QUALITY_CORE?.register?.(MODULE, { version: VERSION, mode: "permanent-lazy-dual-entry", polling: false, realtimeChannels: 0 }); } catch (_) {}
    const build = window.INBESTIGA_BUILD || {};
    window.INBESTIGA_BUILD = {
      ...build,
      version: VERSION,
      name: "SAKURA READABLE UI & CUSTOM APPEARANCE",
      modules: [...new Set([...(Array.isArray(build.modules) ? build.modules : []), MODULE])]
    };
    document.documentElement.dataset.inbestigaBuild = VERSION;
  }

  function init() {
    ensurePresence();
    registerBuild();
    requestAnimationFrame(ensurePresence);
    setTimeout(ensurePresence, 350);
    setTimeout(ensurePresence, 1200);
  }

  window.INBESTIGA_SAKURA_LOADER = { version: VERSION, flags, load: loadWorkspace, attach: ensurePresence };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
  window.addEventListener("pageshow", ensurePresence, { passive: true });
})();
