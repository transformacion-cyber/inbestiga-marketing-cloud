/* ===== v14.0 PLATFORM FOUNDATION & QUALITY CORE ===== */
(function(){
  "use strict";
  if(window.INBESTIGA_QUALITY_CORE)return;
  const VERSION="v14.0";
  const BUILD="PLATFORM FOUNDATION & QUALITY CORE";
  const STORAGE_KEY="inbestiga:v14:quality:last";
  const ERROR_KEY="inbestiga:v14:runtime-errors";
  const startedAt=performance.now();
  const currentVersion=()=>window.INBESTIGA_BUILD?.version||VERSION;
  const currentBuild=()=>window.INBESTIGA_BUILD?.name||BUILD;
  const modules=new Map();
  const runtimeErrors=[];
  const escHtml=value=>String(value??"").replace(/[&<>\"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[char]));
  const toneFor=status=>status==="ok"?"good":status==="warn"?"warn":"bad";
  const labelFor=status=>status==="ok"?"Correcto":status==="warn"?"Advertencia":"Falló";
  function register(name,meta={}){modules.set(name,{name,version:meta.version||"—",status:meta.status||"ready",loadedAt:new Date().toISOString(),...meta});return modules.get(name)}
  function duplicateIds(){const seen=new Set(),duplicates=[];document.querySelectorAll("[id]").forEach(node=>{if(seen.has(node.id)&&!duplicates.includes(node.id))duplicates.push(node.id);seen.add(node.id)});return duplicates}
  function visibleTechnicalText(){const patterns=[/\bfunction\s+[A-Za-z_$]/,/\bconst\s+[A-Za-z_$]/,/\.innerHTML\s*=/,/=>\s*\{/,/<\/script>/i,/<style/i];const hits=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){const parent=node.parentElement;if(!parent||["SCRIPT","STYLE","NOSCRIPT","TEXTAREA"].includes(parent.tagName))return NodeFilter.FILTER_REJECT;const value=(node.textContent||"").trim();return value&&patterns.some(pattern=>pattern.test(value))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});while(walker.nextNode()&&hits.length<12)hits.push((walker.currentNode.textContent||"").trim().slice(0,180));return hits}
  function missingGlobals(){const required=["navTo","renderAll","renderHome","openPremiumModal","homeOpenTask","homeOpenCampaign","loadAll"];return required.filter(name=>typeof window[name]!=="function")}
  function missingSections(){const required=["home","tasks","campaigns","creativeRoomsClean","messages","profile360","reports"];return required.filter(id=>!document.getElementById(id))}
  function stateHealth(){const keys=["members","tasks","campaigns","messages","notifications","live_presence","role_permissions"];const source=typeof state!=="undefined"&&state?state:{};return Object.fromEntries(keys.map(key=>[key,Array.isArray(source[key])?source[key].length:null]))}
  function dependencyHealth(){return{Supabase:!!window.supabase,Konva:!!window.Konva,Diagnostics:!!window.INBESTIGA_PLATFORM_DIAGNOSTICS,Operational:!!window.INBESTIGA_OPERATIONAL_INTELLIGENCE}}
  function recentErrors(){try{const stored=JSON.parse(localStorage.getItem(ERROR_KEY)||"[]");return [...stored,...runtimeErrors].slice(-12)}catch(error){return runtimeErrors.slice(-12)}}
  function rememberError(entry){runtimeErrors.push(entry);while(runtimeErrors.length>12)runtimeErrors.shift();try{localStorage.setItem(ERROR_KEY,JSON.stringify(runtimeErrors))}catch(error){}showRuntimeBadge()}
  function showRuntimeBadge(){let badge=document.getElementById("v14RuntimeBadge");if(!badge){badge=document.createElement("button");badge.type="button";badge.id="v14RuntimeBadge";badge.className="v14-runtime-badge";badge.innerHTML='<i></i><span>Error detectado · abrir diagnóstico</span>';badge.addEventListener("click",open);document.body.appendChild(badge)}badge.classList.add("show")}
  function clearRuntimeErrors(){runtimeErrors.length=0;try{localStorage.removeItem(ERROR_KEY)}catch(error){}document.getElementById("v14RuntimeBadge")?.classList.remove("show")}
  function localChecks(){
    const duplicates=duplicateIds(),technical=visibleTechnicalText(),globals=missingGlobals(),sections=missingSections(),states=stateHealth(),deps=dependencyHealth(),errors=recentErrors();
    const stateMissing=Object.entries(states).filter(([,value])=>value===null).map(([key])=>key);
    const dependencyMissing=Object.entries(deps).filter(([,value])=>!value).map(([key])=>key);
    const tests=[
      {name:"Estructura DOM",status:duplicates.length?"fail":"ok",meta:duplicates.length?`${duplicates.length} IDs duplicados: ${duplicates.slice(0,4).join(", ")}`:"Sin IDs duplicados"},
      {name:"Código técnico visible",status:technical.length?"fail":"ok",meta:technical.length?`${technical.length} fragmentos requieren revisión`:"No se detectó código impreso en pantalla"},
      {name:"Funciones esenciales",status:globals.length?"fail":"ok",meta:globals.length?`Faltan: ${globals.join(", ")}`:"Núcleo de navegación y render disponible"},
      {name:"Secciones esenciales",status:sections.length?"fail":"ok",meta:sections.length?`Faltan: ${sections.join(", ")}`:"Home, trabajo, campañas, pizarra y reportes presentes"},
      {name:"Estado de datos",status:stateMissing.length?"warn":"ok",meta:stateMissing.length?`Pendientes de carga: ${stateMissing.join(", ")}`:Object.entries(states).map(([k,v])=>`${k}: ${v}`).slice(0,4).join(" · ")},
      {name:"Dependencias",status:dependencyMissing.length?"warn":"ok",meta:dependencyMissing.length?`No disponibles: ${dependencyMissing.join(", ")}`:"Supabase, Konva y módulos de diagnóstico disponibles"},
      {name:"Errores recientes",status:errors.length?"warn":"ok",meta:errors.length?`${errors.length} eventos registrados en esta sesión o la anterior`:"Sin errores recientes registrados"},
      {name:"Carga del núcleo",status:performance.now()-startedAt>2500?"warn":"ok",meta:`${Math.round(performance.now()-startedAt)} ms desde el inicio del módulo de calidad`}
    ];
    return{duplicates,technical,globals,sections,states,deps,errors,tests};
  }
  async function run(options={}){
    const local=localChecks();let backend=null;
    if(options.network!==false&&window.INBESTIGA_PLATFORM_DIAGNOSTICS?.run){try{backend=await window.INBESTIGA_PLATFORM_DIAGNOSTICS.run({network:true})}catch(error){backend={ok:false,error:error?.message||String(error)}}}
    if(backend){
      const missing=backend.missing_rpcs||[];
      local.tests.push({name:"RPC del backend",status:backend.openapi?.available?(missing.length?"fail":"ok"):"warn",meta:backend.openapi?.available?(missing.length?`${missing.length} RPC faltantes`:`${backend.required_rpcs||0} RPC verificadas`):(backend.openapi?.reason||"OpenAPI no disponible")});
      local.tests.push({name:"Sesión productiva",status:backend.session?"ok":"warn",meta:backend.session?"Usuario autenticado para pruebas de lectura":"Inicia sesión para certificar RLS, Storage y Realtime"});
    }
    const weights={ok:1,warn:.55,fail:0};const score=Math.round(local.tests.reduce((sum,test)=>sum+weights[test.status],0)/Math.max(1,local.tests.length)*100);
    const report={version:currentVersion(),build:currentBuild(),generated_at:new Date().toISOString(),score,ok:local.tests.every(test=>test.status!=="fail"),modules:[...modules.values()],backend,...local};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(report))}catch(error){}
    window.dispatchEvent(new CustomEvent("inbestiga:quality-report",{detail:report}));
    return report;
  }
  function summaryText(report){const failures=report.tests.filter(test=>test.status==="fail").length,warnings=report.tests.filter(test=>test.status==="warn").length;if(failures)return`${failures} falla${failures===1?"":"s"} estructural${failures===1?"":"es"} requiere${failures===1?"":"n"} atención.`;if(warnings)return`Base estable con ${warnings} advertencia${warnings===1?"":"s"} pendiente${warnings===1?"":"s"} de certificación.`;return"Núcleo estable y sin fallas detectadas en esta lectura."}
  function reportHtml(report){
    const cards=[
      ["BUILD",report.version,report.build,"good"],
      ["PUNTUACIÓN",`${report.score}/100`,summaryText(report),report.tests.some(t=>t.status==="fail")?"bad":report.tests.some(t=>t.status==="warn")?"warn":"good"],
      ["MÓDULOS",report.modules.length,report.modules.map(item=>item.name).slice(0,4).join(" · ")||"Registro inicial","good"],
      ["RPC",report.backend?.openapi?.available?(report.backend.missing_rpcs?.length?`${report.backend.missing_rpcs.length} faltantes`:"Verificadas"):"Pendiente",report.backend?.openapi?.reason||"Diagnóstico de red ejecutado",report.backend?.openapi?.available?(report.backend.missing_rpcs?.length?"bad":"good"):"warn"],
      ["ERRORES",report.errors.length,report.errors.length?"Revisa el historial de ejecución":"Sin eventos recientes",report.errors.length?"warn":"good"],
      ["INTEGRIDAD",report.duplicates.length+report.technical.length,report.duplicates.length||report.technical.length?"Requiere corrección":"DOM y contenido técnico limpios",report.duplicates.length||report.technical.length?"bad":"good"]
    ];
    return`<div class="v14-quality-summary"><div class="v14-quality-score">${escHtml(report.score)}</div><div><h3>${escHtml(summaryText(report))}</h3><p>Diagnóstico no destructivo del frontend, módulos locales y compatibilidad con Supabase.</p></div></div><div class="v14-quality-grid">${cards.map(([label,value,meta,tone])=>`<article class="v14-quality-card" data-tone="${tone}"><span>${escHtml(label)}</span><strong>${escHtml(value)}</strong><small>${escHtml(meta)}</small></article>`).join("")}</div><div class="v14-quality-list">${report.tests.map(test=>`<article class="v14-quality-row ${test.status}"><i></i><div><strong>${escHtml(test.name)}</strong><small>${escHtml(test.meta)}</small></div><b>${escHtml(labelFor(test.status))}</b></article>`).join("")}</div><div class="v14-quality-actions"><button type="button" class="primary" data-v14-quality-action="rerun">Volver a comprobar</button><button type="button" data-v14-quality-action="export">Exportar informe</button><button type="button" data-v14-quality-action="clear">Limpiar errores</button></div><div class="v14-quality-note">Las pruebas son de solo lectura. RLS, Storage, Realtime y operaciones de escritura solo pueden certificarse con cuentas reales del Supabase productivo.</div>`
  }
  async function open(){
    if(typeof premiumToast==="function")premiumToast("Control de calidad","Ejecutando pruebas de solo lectura…","success");
    const report=await run({network:true});
    if(typeof openPremiumModal==="function")openPremiumModal({title:"Platform Quality Center",subtitle:`${report.version} · estabilidad, módulos y backend`,body:reportHtml(report),actions:[{label:"Cerrar",value:null,className:"primary"}]});
    else console.table(report.tests);
    return report;
  }
  function exportReport(){const report=last();if(!report)return;const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`INBESTIGA_quality_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}
  function last(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch(error){return null}}
  window.addEventListener("error",event=>rememberError({type:"error",message:String(event.message||event.error||"Error"),source:event.filename||"",line:event.lineno||0,at:new Date().toISOString()}));
  window.addEventListener("unhandledrejection",event=>rememberError({type:"promise",message:String(event.reason?.message||event.reason||"Promesa rechazada"),at:new Date().toISOString()}));
  document.addEventListener("click",event=>{
    const action=event.target.closest?.("[data-v14-quality-action]")?.dataset.v14QualityAction;
    if(action==="rerun"){event.preventDefault();open()}else if(action==="export"){event.preventDefault();exportReport()}else if(action==="clear"){event.preventDefault();clearRuntimeErrors();open()}
  });
  function init(){
    register("home-editorial-core",{version:typeof V12_HOME_VERSION!=="undefined"?V12_HOME_VERSION:"v12.1"});
    register("platform-diagnostics",{version:window.INBESTIGA_PLATFORM_DIAGNOSTICS?.version||"—"});
    register("operational-intelligence",{version:window.INBESTIGA_OPERATIONAL_INTELLIGENCE?.version||"v13.0"});
    register("platform-quality-core",{version:VERSION});
    window.INBESTIGA_BUILD={version:VERSION,name:BUILD,modules:[...modules.keys()]};
    document.documentElement.dataset.inbestigaBuild=VERSION;
    queueMicrotask(()=>run({network:false}));
  }
  window.INBESTIGA_QUALITY_CORE={version:VERSION,build:BUILD,register,run,open,last,clearErrors:clearRuntimeErrors,modules:()=>[...modules.values()]};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
