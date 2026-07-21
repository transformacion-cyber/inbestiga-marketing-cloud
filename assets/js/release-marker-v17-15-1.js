/* INBESTIGA Marketing Cloud v17.15.1 · Release marker */
(()=>{
  "use strict";
  const VERSION="v17.15.1",MODULE="release-marker-v17-15-1";
  try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"release-marker",polling:false,realtimeChannels:0,mutations:false,dynamicCode:false})}catch{}
  const build=window.INBESTIGA_BUILD||{};
  window.INBESTIGA_BUILD={...build,version:VERSION,name:"SAKURA ACADEMY INTERACTION & SUPERVISED SELF-IMPROVEMENT HOTFIX",modules:[...new Set([...(Array.isArray(build.modules)?build.modules:[]),MODULE])]};
  document.documentElement.dataset.inbestigaBuild=VERSION;
})();
