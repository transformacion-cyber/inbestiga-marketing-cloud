/* INBESTIGA Marketing Cloud v17.13.0 · SAKURA Adaptive Intelligence permanent presence */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_LOADER?.version === "v17.13.0") return;
  const VERSION = "v17.13.0";
  const MODULE = "sakura-presence-loader-v17-13-0";
  const runtime = window.INBESTIGA_PUBLIC_RUNTIME_CONFIG || {};
  const flags = Object.assign({enabled:true,chat:true,actions:true,learning:true,voice:true,reports:true,visualDirector:true,web:false,workspaceLayout:true,bridgeUrl:"http://127.0.0.1:8765"}, runtime.sakura || {});
  let loading = null;

  function notifyError(error){try{window.premiumToast?.("SAKURA no pudo abrirse",error?.message||String(error),"error")}catch(_){console.error(error)}}
  function addCss(href,key){if(document.querySelector(`link[data-sakura-css="${key}"]`))return;const link=document.createElement("link");link.rel="stylesheet";link.href=href;link.dataset.sakuraCss=key;document.head.appendChild(link)}
  function ensureLauncherStyle(){
    if(document.getElementById("sakuraNativeLauncherStyle"))return;
    const style=document.createElement("style");style.id="sakuraNativeLauncherStyle";style.textContent=`
      .sakura-native-launcher-shell{position:fixed;right:22px;bottom:max(22px,env(safe-area-inset-bottom));z-index:2147482000;display:flex;align-items:center;gap:11px;padding:8px 15px 8px 8px;border:1px solid color-mix(in srgb,var(--sk-frame,#dcbcff) 55%,transparent);border-radius:999px;color:var(--sk-text,#fff);cursor:pointer;background:var(--sk-panel-solid,#211529);box-shadow:0 16px 42px rgba(38,13,68,.32);transition:transform .2s ease,box-shadow .2s ease,opacity .2s ease;font-family:var(--sk-font-main,system-ui,sans-serif)}
      .sakura-native-launcher-shell:hover{transform:translateY(-2px);box-shadow:0 20px 50px rgba(57,20,98,.42)}.sakura-native-launcher-shell[hidden]{display:none!important}
      .sakura-native-launcher-orb{width:43px;height:43px;border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 34% 27%,#fff 0 8%,var(--sk-orb-3,#f4d7ff) 10%,var(--sk-orb-2,#d39cff) 28%,var(--sk-orb-1,#7f46ff) 60%,#21093f 100%);box-shadow:0 0 0 5px color-mix(in srgb,var(--sk-orb-1,#9158ff) 18%,transparent),0 0 30px color-mix(in srgb,var(--sk-orb-1,#9158ff) 58%,transparent)}
      .sakura-native-launcher-orb:before,.sakura-native-launcher-orb:after{content:"";position:absolute;border-radius:50%;pointer-events:none;border:1px solid color-mix(in srgb,var(--sk-orb-2,#d6aeff) 55%,transparent);animation:skLauncherOrbit 6.5s linear infinite}.sakura-native-launcher-orb:before{inset:-5px}.sakura-native-launcher-orb:after{inset:-9px;border-style:dashed;animation-direction:reverse;animation-duration:9s}
      .sakura-native-launcher-orb i{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 14px #fff,15px 8px 0 -2px var(--sk-orb-3,#ef61b9),-14px -8px 0 -2px var(--sk-orb-2,#6dc9ff)}
      .sakura-native-launcher-copy{display:grid;text-align:left;line-height:1.05}.sakura-native-launcher-copy strong{font-size:12px;letter-spacing:.13em}.sakura-native-launcher-copy small{font-size:10px;color:var(--sk-muted,#d0bfd9);margin-top:4px}@keyframes skLauncherOrbit{to{transform:rotate(360deg)}}
      @media(max-width:720px){.sakura-native-launcher-shell{right:12px;bottom:max(12px,env(safe-area-inset-bottom));padding-right:10px}.sakura-native-launcher-copy small{display:none}}
      @media(prefers-reduced-motion:reduce){.sakura-native-launcher-orb:before,.sakura-native-launcher-orb:after{animation:none!important}}
    `;document.head.appendChild(style)
  }
  function loadScript(src,key){
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[data-sakura-module="${key}"]`);
      if(existing){if(existing.dataset.loaded==="1")return resolve(true);existing.addEventListener("load",()=>resolve(true),{once:true});existing.addEventListener("error",()=>reject(new Error(`No se pudo cargar ${key}.`)),{once:true});return}
      const script=document.createElement("script");script.src=src;script.async=true;script.dataset.sakuraModule=key;script.onload=()=>{script.dataset.loaded="1";resolve(true)};script.onerror=()=>reject(new Error(`No se pudo cargar ${key}.`));document.body.appendChild(script)
    })
  }
  async function loadWorkspace(){
    try{window.INBESTIGA_SAKURA_STUDIO?.refreshUser?.()}catch(_){}
    if(window.INBESTIGA_SAKURA_NATIVE?.open){window.INBESTIGA_SAKURA_ADAPTIVE_INTELLIGENCE?.attach?.();return window.INBESTIGA_SAKURA_NATIVE.open()}
    if(loading)return loading;
    loading=(async()=>{
      addCss("assets/css/sakura-personal-workspace-base-v17-12-13-6.css","base");addCss("assets/css/sakura-personal-studio-v17-12-13-6.css","personal-studio");addCss("assets/css/sakura-adaptive-intelligence-v17-13-0.css","adaptive-intelligence");
      await loadScript("assets/js/sakura-personal-workspace-v17-12-13-6.js","workspace-v17-12-13-6");
      await loadScript("assets/js/sakura-adaptive-intelligence-v17-13-0.js","adaptive-intelligence-v17-13-0");
      if(!window.INBESTIGA_SAKURA_NATIVE?.open)throw new Error("SAKURA no pudo iniciar.");
      window.INBESTIGA_SAKURA_NATIVE.open();requestAnimationFrame(()=>window.INBESTIGA_SAKURA_ADAPTIVE_INTELLIGENCE?.attach?.());return true
    })().catch(error=>{notifyError(error);throw error}).finally(()=>{loading=null});
    return loading
  }
  function createLauncher(){ensureLauncherStyle();let button=document.getElementById("sakuraNativeLauncher");if(!button){button=document.createElement("button");button.id="sakuraNativeLauncher";button.className="sakura-native-launcher-shell";button.type="button";button.setAttribute("aria-label","Abrir SAKURA");button.innerHTML='<span class="sakura-native-launcher-orb" aria-hidden="true"><i></i></span><span class="sakura-native-launcher-copy"><strong>SAKURA</strong><small>Compañera de trabajo</small></span>';button.addEventListener("click",()=>loadWorkspace().catch(notifyError))}if(button.parentElement!==document.body)document.body.appendChild(button);button.hidden=flags.enabled===false}
  function injectTopNavigationButton(){const right=document.querySelector("#v472AppleTopNav .v472-right");if(!right||document.getElementById("sakuraTopNavButton"))return false;const button=document.createElement("button");button.id="sakuraTopNavButton";button.type="button";button.setAttribute("aria-label","Abrir SAKURA");button.innerHTML='<span class="sk-top-orb" aria-hidden="true"></span><span>SAKURA</span>';button.addEventListener("click",()=>loadWorkspace().catch(notifyError));const create=document.getElementById("v171210QuickCreateButton");if(create?.parentElement===right)right.insertBefore(button,create);else right.insertBefore(button,right.firstChild);return true}
  function ensurePresence(){if(flags.enabled===false)return;createLauncher();injectTopNavigationButton()}
  function registerBuild(){try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"permanent-lazy-adaptive-intelligence",polling:false,realtimeChannels:0})}catch(_){}const build=window.INBESTIGA_BUILD||{};window.INBESTIGA_BUILD={...build,version:VERSION,name:"SAKURA ADAPTIVE INTELLIGENCE & VISUAL DIRECTOR",modules:[...new Set([...(Array.isArray(build.modules)?build.modules:[]),MODULE]) ]};document.documentElement.dataset.inbestigaBuild=VERSION}
  function init(){ensurePresence();registerBuild();requestAnimationFrame(ensurePresence);setTimeout(ensurePresence,350);setTimeout(ensurePresence,1200)}
  window.INBESTIGA_SAKURA_LOADER={version:VERSION,flags,load:loadWorkspace,attach:ensurePresence};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();window.addEventListener("pageshow",ensurePresence,{passive:true});
})();
