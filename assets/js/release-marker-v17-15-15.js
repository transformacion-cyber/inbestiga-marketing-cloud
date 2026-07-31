
/* INBESTIGA Marketing Cloud v17.15.15 · SAKURA FLOATING DRAGGABLE ORB PRESENCE SYSTEM */
(()=>{
  "use strict";
  const VERSION="v17.15.15",NAME="SAKURA FLOATING DRAGGABLE ORB PRESENCE SYSTEM",MODULE="release-marker-v17-15-15";
  let state=window.INBESTIGA_BUILD&&typeof window.INBESTIGA_BUILD==="object"?window.INBESTIGA_BUILD:{};
  const align=()=>{document.documentElement.dataset.inbestigaBuild=VERSION;return VERSION};
  const release=Object.freeze({version:VERSION,name:NAME,module:MODULE,loaded_at:new Date().toISOString(),align});
  try{const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_RELEASE");if(!descriptor||descriptor.configurable)Object.defineProperty(window,"INBESTIGA_RELEASE",{value:release,writable:false,configurable:false,enumerable:true})}catch{window.INBESTIGA_RELEASE=release}
  const merge=(incoming={})=>{const value=incoming&&typeof incoming==="object"?incoming:{},modules=[...new Set([...(Array.isArray(state.modules)?state.modules:[]),...(Array.isArray(value.modules)?value.modules:[]),MODULE])];state={...state,...value,version:VERSION,name:NAME,modules};align();return state};
  merge(state);
  try{const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_BUILD");if(!descriptor||descriptor.configurable)Object.defineProperty(window,"INBESTIGA_BUILD",{get:()=>state,set:(incoming)=>{state=merge(incoming)},configurable:true,enumerable:true})}catch{window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD)}
  try{window.dispatchEvent(new CustomEvent("inbestiga:release-ready",{detail:release}))}catch{}
})();
