/* INBESTIGA Marketing Cloud v17.15.6 · SYSTEM HEALTH, COMMAND CENTER & VERSION INTEGRITY HOTFIX */
(()=>{
  "use strict";
  const VERSION="v17.15.6";
  const NAME="SYSTEM HEALTH, COMMAND CENTER & VERSION INTEGRITY HOTFIX";
  const MODULE="release-marker-v17-15-6";
  const release=Object.freeze({version:VERSION,name:NAME,module:MODULE,loaded_at:new Date().toISOString()});
  try{
    if(!window.INBESTIGA_RELEASE || window.INBESTIGA_RELEASE.version!==VERSION){
      Object.defineProperty(window,"INBESTIGA_RELEASE",{value:release,writable:false,configurable:false,enumerable:true});
    }
  }catch{window.INBESTIGA_RELEASE=release}
  let buildState=window.INBESTIGA_BUILD && typeof window.INBESTIGA_BUILD==="object" ? window.INBESTIGA_BUILD : {};
  const merge=(incoming={})=>{
    const value=incoming && typeof incoming==="object" ? incoming : {};
    const modules=[...new Set([...(Array.isArray(buildState.modules)?buildState.modules:[]),...(Array.isArray(value.modules)?value.modules:[]),MODULE])];
    buildState={...buildState,...value,version:VERSION,name:NAME,modules};
    document.documentElement.dataset.inbestigaBuild=VERSION;
    return buildState;
  };
  merge(buildState);
  try{
    const descriptor=Object.getOwnPropertyDescriptor(window,"INBESTIGA_BUILD");
    if(!descriptor || descriptor.configurable){
      Object.defineProperty(window,"INBESTIGA_BUILD",{
        configurable:false,enumerable:true,
        get(){return {...buildState,modules:[...(buildState.modules||[])]}},
        set(value){merge(value)}
      });
    }else{window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD)}
  }catch{window.INBESTIGA_BUILD=merge(window.INBESTIGA_BUILD)}
  try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"canonical-release-integrity",polling:false,realtimeChannels:0,mutationObservers:0,dynamicCode:false,backendChanges:false})}catch{}
})();
