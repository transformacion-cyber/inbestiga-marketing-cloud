/* INBESTIGA Marketing Cloud v17.15.2 · Release marker */
(()=>{
  "use strict";
  const VERSION="v17.15.2",MODULE="release-marker-v17-15-2";
  try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"release-marker",polling:false,realtimeChannels:0,mutations:false,dynamicCode:false,backendChanges:false})}catch{}
  const build=window.INBESTIGA_BUILD||{};
  window.INBESTIGA_BUILD={...build,version:VERSION,name:"PLATFORM INTERACTION INTEGRITY & AUTOMATIC DIAGNOSTICS",modules:[...new Set([...(Array.isArray(build.modules)?build.modules:[]),MODULE]) ]};
  document.documentElement.dataset.inbestigaBuild=VERSION;
})();
