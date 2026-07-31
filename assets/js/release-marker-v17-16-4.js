/* INBESTIGA Marketing Cloud v17.16.4 · OFFICIAL CLEAN START · ZERO OPERATIONAL DATA */
(()=>{
  "use strict";
  const VERSION="v17.16.4",NAME="OFFICIAL CLEAN START · ZERO OPERATIONAL DATA",MODULE="release-marker-v17-16-4";
  let state=window.INBESTIGA_BUILD&&typeof window.INBESTIGA_BUILD==="object"?window.INBESTIGA_BUILD:{};
  const align=()=>{document.documentElement.dataset.inbestigaBuild=VERSION;return VERSION};
  const release=Object.freeze({version:VERSION,name:NAME,module:MODULE,loaded_at:new Date().toISOString(),align});
  try{const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_RELEASE");if(!descriptor||descriptor.configurable)Object.defineProperty(window,"INBESTIGA_RELEASE",{value:release,writable:false,configurable:false,enumerable:true})}catch{window.INBESTIGA_RELEASE=release}
  const merge=(incoming={})=>{const value=incoming&&typeof incoming==="object"?incoming:{},modules=[...new Set([...(Array.isArray(state.modules)?state.modules:[]),...(Array.isArray(value.modules)?value.modules:[]),MODULE])];state={...state,...value,version:VERSION,name:NAME,modules};align();return state};
  merge(state);
  try{const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_BUILD");if(!descriptor||descriptor.configurable)Object.defineProperty(window,"INBESTIGA_BUILD",{configurable:false,enumerable:true,get(){return{...state,modules:[...(state.modules||[])]}},set(value){merge(value)}})}catch{window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD)}
  window.addEventListener("pageshow",align,{passive:true});
  try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"official-clean-start",polling:false,realtimeChannels:0,mutationObservers:0,backendChanges:false})}catch{}
})();
