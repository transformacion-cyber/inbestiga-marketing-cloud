/* ===== v12.1 PLATFORM STABILITY HARDENING ===== */
(function(){
  "use strict";
  const REQUIRED_STATE_ARRAYS=["members","tasks","campaigns","messages","notifications","live_presence","role_permissions"];
  const REQUIRED_RPCS=["ibm_v30_create_brief", "ibm_v30_create_campaign", "ibm_v30_create_comment", "ibm_v30_create_editorial", "ibm_v30_create_task", "ibm_v30_create_wall_post_inline", "ibm_v30_toggle_reaction", "ibm_v30_update_profile_inline", "ibm_v30_update_task", "ibm_v31_asset_approval", "ibm_v31_create_asset_inline", "ibm_v31_create_board", "ibm_v31_create_board_card_inline", "ibm_v31_create_incident", "ibm_v31_create_template", "ibm_v31_upsert_member_basic", "ibm_v32_create_report_snapshot", "ibm_v32_log_client_error", "ibm_v32_review_task", "ibm_v32_set_permission", "ibm_v33_mark_all_messages_read", "ibm_v33_mark_all_notifications_read", "ibm_v33_send_message", "ibm_v33_touch_presence", "ibm_v34_update_nav_preferences", "ibm_v352_repost_wall_post", "ibm_v352_visit_member_profile", "ibm_v354_restore_own_wall_post", "ibm_v354_trash_own_wall_post", "ibm_v356_create_time_event", "ibm_v356_create_work_link", "ibm_v356_upsert_my_work_profile", "ibm_v357_create_schedule_exception", "ibm_v357_delete_my_schedule_block", "ibm_v357_update_schedule_exception_status", "ibm_v357_upsert_my_schedule_block", "ibm_v358_clear_my_grid_week", "ibm_v358_set_my_grid_slot", "ibm_v359_create_schedule_exception_multi", "ibm_v359_review_member_schedule", "ibm_v359_set_my_grid_slot", "ibm_v359_submit_my_schedule", "ibm_v359_unlock_member_schedule", "ibm_v35_update_home_feed_preferences", "ibm_v375_bootstrap"];
  function duplicateIds(){const seen=new Set(),duplicates=[];document.querySelectorAll("[id]").forEach(node=>{if(seen.has(node.id)&&!duplicates.includes(node.id))duplicates.push(node.id);seen.add(node.id)});return duplicates}
  function visibleTechnicalText(){const pattern=/\b(function|const|let)\s+v\d+|\.innerHTML\s*=|=>\s*\{|<\/script>/;return [...document.body.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE&&pattern.test(node.textContent||"")).map(node=>(node.textContent||"").trim().slice(0,160))}
  async function fetchOpenApiRpcs(){
    const config=typeof cfg==="function"?cfg():{};
    if(!config.url||!config.key||typeof fetch!=="function")return{available:false,names:[],reason:"Configuración o fetch no disponible"};
    try{
      const response=await fetch(`${config.url.replace(/\/$/,"")}/rest/v1/`,{headers:{apikey:config.key,Authorization:`Bearer ${session?.access_token||config.key}`,Accept:"application/openapi+json"}});
      if(!response.ok)throw new Error(`OpenAPI ${response.status}`);
      const spec=await response.json();
      const names=Object.keys(spec.paths||{}).filter(path=>path.startsWith("/rpc/")).map(path=>path.slice(5));
      return{available:true,names,reason:""};
    }catch(error){return{available:false,names:[],reason:error?.message||String(error)}}
  }
  async function run(options={}){
    const network=options.network!==false;
    const report={
      version:"v12.1",
      generated_at:new Date().toISOString(),
      local_date:typeof today==="function"?today():null,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"unknown",
      session:!!(typeof authUser!=="undefined"&&authUser?.id),
      supabase_client:!!(typeof sb!=="undefined"&&sb),
      supabase_library:!!window.supabase,
      konva_loaded:!!window.Konva,
      role:{code:typeof member!=="undefined"?member?.role_code:null,label:typeof roleLabel==="function"?roleLabel():null,director:typeof isDirector==="function"?isDirector():false,supervisor:typeof isSupervisor==="function"?isSupervisor():false},
      state_arrays:Object.fromEntries(REQUIRED_STATE_ARRAYS.map(key=>{const source=typeof state!=="undefined"?state:{};return [key,Array.isArray(source?.[key])?source[key].length:null]})),
      duplicate_ids:duplicateIds(),
      visible_technical_text:visibleTechnicalText(),
      required_rpcs:REQUIRED_RPCS.length,
      missing_rpcs:[],
      openapi:{available:false,reason:"No solicitado"}
    };
    if(network){const api=await fetchOpenApiRpcs();report.openapi={available:api.available,reason:api.reason};if(api.available)report.missing_rpcs=REQUIRED_RPCS.filter(name=>!api.names.includes(name))}
    report.ok=!report.duplicate_ids.length&&!report.visible_technical_text.length&&report.supabase_library&&Object.values(report.state_arrays).every(value=>value!==null)&&(!report.openapi.available||!report.missing_rpcs.length);
    try{localStorage.setItem("inbestiga:last_diagnostic",JSON.stringify(report))}catch(error){}
    console.info("[INBESTIGA v12.1 diagnostics]",report);
    return report;
  }
  window.INBESTIGA_PLATFORM_DIAGNOSTICS={version:"v12.1",requiredRpcs:[...REQUIRED_RPCS],run,last:()=>{try{return JSON.parse(localStorage.getItem("inbestiga:last_diagnostic")||"null")}catch(error){return null}}};
  const baseRenderAll=typeof renderAll==="function"?renderAll:null;
  if(baseRenderAll){renderAll=async function(){const result=await baseRenderAll.apply(this,arguments);queueMicrotask(()=>run({network:false}));return result}}
  window.addEventListener("error",event=>{try{console.error("[INBESTIGA runtime]",event.error||event.message)}catch(error){}});
  window.addEventListener("unhandledrejection",event=>{try{console.error("[INBESTIGA promise]",event.reason)}catch(error){}});
  window.__inbestigaModulesReady=true;
  if(typeof window.v121StartCore==="function")setTimeout(window.v121StartCore,0);
})();
