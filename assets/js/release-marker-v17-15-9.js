/* INBESTIGA Marketing Cloud v17.15.9 · BUILD MANIFEST VERSION ALIGNMENT HOTFIX */
(()=>{
  "use strict";
  const VERSION="v17.15.9";
  const NAME="BUILD MANIFEST VERSION ALIGNMENT HOTFIX";
  const MODULE="release-marker-v17-15-9";
  let state=window.INBESTIGA_BUILD&&typeof window.INBESTIGA_BUILD==="object"
    ? window.INBESTIGA_BUILD
    : {};

  const align=()=>{
    document.documentElement.dataset.inbestigaBuild=VERSION;
    return VERSION;
  };

  const release=Object.freeze({
    version:VERSION,
    name:NAME,
    module:MODULE,
    loaded_at:new Date().toISOString(),
    align
  });

  try{
    const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_RELEASE");
    if(!descriptor||descriptor.configurable){
      Object.defineProperty(window,"INBESTIGA_RELEASE",{
        value:release,
        writable:false,
        configurable:false,
        enumerable:true
      });
    }
  }catch{window.INBESTIGA_RELEASE=release}

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
  try{
    const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_BUILD");
    if(!descriptor||descriptor.configurable){
      Object.defineProperty(window,"INBESTIGA_BUILD",{
        configurable:false,
        enumerable:true,
        get(){return{...state,modules:[...(state.modules||[])]}},
        set(value){merge(value)}
      });
    }else{
      window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD);
    }
  }catch{window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD)}

  window.addEventListener("pageshow",align,{passive:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)align()},{passive:true});

  try{
    window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{
      version:VERSION,
      mode:"build-manifest-version-alignment",
      polling:false,
      realtimeChannels:0,
      mutationObservers:0,
      dynamicCode:false,
      backendChanges:false
    });
  }catch{}
})();
