/* INBESTIGA Marketing Cloud v17.16.4 · Official Clean Start */
(()=>{
  "use strict";
  if(window.INBESTIGA_OFFICIAL_CLEAN_START?.version==="v17.16.4")return;
  const VERSION="v17.16.4",MODULE="official-clean-start-v17-16-4";
  const MARKER="inbestiga:official-clean-start:v17.16.4";
  const EXACT=new Set([
    "inbestiga:requests360:history",
    "inbestiga:requests360:draft",
    "inbestiga:v178:design-history",
    "inbestiga:v178:asset-library",
    "inbestiga:v17152:local-change-history",
    "inbestiga:v14:runtime-errors",
    "inbestiga:last_diagnostic",
    "inbestiga:last_interaction_integrity",
    "inbestiga:v161:production-certification",
    "inbestiga:v171:system-health",
    "inbestiga:v15:selected-campaign",
    "inbestiga:v15:campaign-tab",
    "inbestiga_ca_current_board",
    "inbestiga_sakura_learning_fallback_v1",
    "inbestiga_sakura_aliases_v1"
  ]);
  const PREFIXES=[
    "inbestiga:v413:draft:",
    "inbestiga:requests360:notified:",
    "inbestiga:requests360:last-seen:",
    "inbestiga_ca_board:",
    "inbestiga_ca_prefs:",
    "inbestiga_sakura_conversation_v2:",
    "inbestiga_sakura_supervised_memories_v17130:",
    "inbestiga_sakura_pattern_signatures_v17130:",
    "inbestiga_sakura_interpretation_corrections_v17130:",
    "inbestiga_sakura_visual_history_v17130:",
    "inbestiga_sakura_web_saved_v17130:",
    "inbestiga_sakura_context_engine_v17130:",
    "inbestiga_sakura_composer_drafts_v17130:",
    "inbestiga_sakura_workspace_layout_history_v17130:"
  ];
  const protectedKey=key=>
    key===MARKER||
    key==="IBM_SUPABASE_URL"||key==="IBM_SUPABASE_ANON"||key==="ib_member_session"||
    /^sb-.*-auth-token$/.test(key)||
    key.startsWith("inbestiga:sakura:floating-orb:")||
    key.startsWith("inbestiga_sakura_style_")||
    key.startsWith("inbestiga_sakura_custom_themes_")||
    key.startsWith("inbestiga_sakura_global_style_")||
    key==="inbestiga_sakura_user_preferences_v1"||
    key==="IBM_V416_AUTOMATION_RULES"||key==="IBM_V417_PRIVACY_TIMEOUT";
  function run(){
    try{
      if(localStorage.getItem(MARKER))return {alreadyClean:true,removed:[]};
      const removed=[];
      const keys=[];
      for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key)keys.push(key)}
      for(const key of keys){
        if(protectedKey(key))continue;
        if(EXACT.has(key)||PREFIXES.some(prefix=>key.startsWith(prefix))){
          try{localStorage.removeItem(key);removed.push(key)}catch{}
        }
      }
      localStorage.setItem(MARKER,JSON.stringify({version:VERSION,cleanedAt:new Date().toISOString(),removed:removed.length}));
      try{sessionStorage.removeItem("inbestiga:pwa-controller-reload:v17.16.3")}catch{}
      window.dispatchEvent(new CustomEvent("inbestiga:official-clean-start",{detail:{version:VERSION,removed:removed.length}}));
      return {alreadyClean:false,removed};
    }catch(error){return {alreadyClean:false,removed:[],error:String(error?.message||error)}}
  }
  const result=run();
  window.INBESTIGA_OFFICIAL_CLEAN_START=Object.freeze({version:VERSION,module:MODULE,result,run});
  try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"one-time-local-operational-cleanup",polling:false,realtimeChannels:0,mutationObservers:0,backendChanges:false})}catch{}
})();
