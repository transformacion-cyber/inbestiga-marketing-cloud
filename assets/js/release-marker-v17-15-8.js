/* INBESTIGA Marketing Cloud v17.15.8 · CANONICAL RELEASE MARKER & VERSION HEALTH TRUTH HOTFIX */
(()=>{
  "use strict";
  const VERSION="v17.15.8";
  const NAME="CANONICAL RELEASE MARKER & VERSION HEALTH TRUTH HOTFIX";
  const MODULE="release-marker-v17-15-8";
  let state=window.INBESTIGA_BUILD&&typeof window.INBESTIGA_BUILD==="object"
    ? window.INBESTIGA_BUILD
    : {};

  const normalize=(value)=>{
    const match=String(value||"").trim().match(/(\d+)\.(\d+)\.(\d+)/);
    return match?`v${match[1]}.${match[2]}.${match[3]}`:"";
  };

  const align=()=>{
    document.documentElement.dataset.inbestigaBuild=VERSION;
    return VERSION;
  };

  const release=Object.freeze({
    version:VERSION,
    normalized_version:normalize(VERSION),
    name:NAME,
    module:MODULE,
    loaded_at:new Date().toISOString(),
    align
  });

  const existingRelease=Object.getOwnPropertyDescriptor(window,"INBESTIGA_RELEASE");
  if(!existingRelease||existingRelease.configurable){
    Object.defineProperty(window,"INBESTIGA_RELEASE",{
      value:release,
      writable:false,
      configurable:false,
      enumerable:true
    });
  }else if(normalize(window.INBESTIGA_RELEASE?.version)!==VERSION){
    console.warn("[INBESTIGA] Un marcador antiguo no configurable fue cargado antes del release canónico.");
  }

  const merge=(incoming={})=>{
    const value=incoming&&typeof incoming==="object"?incoming:{};
    const modules=[...new Set([
      ...(Array.isArray(state.modules)?state.modules:[]),
      ...(Array.isArray(value.modules)?value.modules:[]),
      MODULE
    ])];
    state={...state,...value,version:VERSION,name:NAME,modules};
    align();
    return state;
  };

  merge(state);
  const buildDescriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_BUILD");
  if(!buildDescriptor||buildDescriptor.configurable){
    Object.defineProperty(window,"INBESTIGA_BUILD",{
      configurable:false,
      enumerable:true,
      get(){return{...state,modules:[...(state.modules||[])]}},
      set(value){merge(value)}
    });
  }else{
    try{window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD)}catch{}
  }

  window.addEventListener("pageshow",align,{passive:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)align()},{passive:true});

  try{
    window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{
      version:VERSION,
      mode:"single-final-canonical-release-marker",
      polling:false,
      realtimeChannels:0,
      mutationObservers:0,
      dynamicCode:false,
      backendChanges:false
    });
  }catch{}
})();
