/* INBESTIGA Marketing Cloud v17.15.7 · SYSTEM HEALTH SCORING & WORK 360 SYNC TRUTH HOTFIX */
(()=>{
  "use strict";
  const VERSION="v17.15.7",NAME="SYSTEM HEALTH SCORING & WORK 360 SYNC TRUTH HOTFIX",MODULE="release-marker-v17-15-7";
  let buildState=window.INBESTIGA_BUILD&&typeof window.INBESTIGA_BUILD==="object"?window.INBESTIGA_BUILD:{};
  const align=()=>{document.documentElement.dataset.inbestigaBuild=VERSION;return VERSION};
  const release=Object.freeze({version:VERSION,name:NAME,module:MODULE,loaded_at:new Date().toISOString(),align});
  try{
    const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_RELEASE");
    if(!descriptor||descriptor.configurable)Object.defineProperty(window,"INBESTIGA_RELEASE",{value:release,writable:false,configurable:false,enumerable:true});
  }catch{window.INBESTIGA_RELEASE=release}
  const merge=(incoming={})=>{
    const value=incoming&&typeof incoming==="object"?incoming:{};
    const modules=[...new Set([...(Array.isArray(buildState.modules)?buildState.modules:[]),...(Array.isArray(value.modules)?value.modules:[]),MODULE])];
    buildState={...buildState,...value,version:VERSION,name:NAME,modules};align();return buildState;
  };
  merge(buildState);
  try{
    const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_BUILD");
    if(!descriptor||descriptor.configurable)Object.defineProperty(window,"INBESTIGA_BUILD",{configurable:false,enumerable:true,get(){return{...buildState,modules:[...(buildState.modules||[])]}},set(value){merge(value)}});
    else window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD);
  }catch{window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD)}
  window.addEventListener("pageshow",align,{passive:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)align()},{passive:true});
  try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"canonical-version-self-healing-and-sync-truth",polling:false,realtimeChannels:0,mutationObservers:0,dynamicCode:false,backendChanges:false})}catch{}
})();
