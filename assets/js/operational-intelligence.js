/* ===== v13.0 OPERATIONAL INTELLIGENCE CORE ===== */
(function(){
  "use strict";
  const V13_VERSION="v13.0";
  const DYNAMIC_PREFIX="v13:";
  const DAY=86400000;
  function sameId(a,b){return String(a??"")===String(b??"")}
  function uniqueById(items){const seen=new Set();return (items||[]).filter(item=>{const key=String(item?.id||"");if(!key||seen.has(key))return false;seen.add(key);return true})}
  function daysSince(value){const time=new Date(value||0).getTime();return Number.isFinite(time)&&time>0?Math.floor((Date.now()-time)/DAY):0}
  function activeCampaigns(){return (state.campaigns||[]).filter(c=>!["finalizada","archivada","cancelada"].includes(v412StatusKey(c.status)))}
  function openTasks(){return (state.tasks||[]).filter(t=>!v412TaskDone(t))}
  function taskScope(){const all=openTasks();return (typeof isSupervisor==="function"&&isSupervisor())?all:all.filter(t=>sameId(t.assigned_to,member?.id))}
  function memberLoads(tasks){const map=new Map();(tasks||[]).forEach(t=>{if(!t.assigned_to)return;const key=String(t.assigned_to);map.set(key,(map.get(key)||0)+1)});return [...map.entries()].map(([id,count])=>({member:by(state.members,id),count})).filter(x=>x.member).sort((a,b)=>b.count-a.count)}
  function campaignStale(c){const stamp=c.updated_at||c.created_at;return stamp&&daysSince(stamp)>=7}
  function dataQuality(tasks,campaigns){const unassigned=tasks.filter(t=>!t.assigned_to).length;const undated=tasks.filter(t=>!t.due_date).length;const campaignIds=new Set(campaigns.map(c=>String(c.id)));const orphan=tasks.filter(t=>t.campaign_id&&!campaignIds.has(String(t.campaign_id))).length;return{unassigned,undated,orphan,total:unassigned+undated+orphan}}
  function operationalModel(){
    const signals=typeof v12Signals==="function"?v12Signals():{};
    const tasks=openTasks(),scope=taskScope(),campaigns=activeCampaigns();
    const stale=campaigns.filter(campaignStale).sort((a,b)=>daysSince(b.updated_at||b.created_at)-daysSince(a.updated_at||a.created_at));
    const loads=memberLoads(tasks),overloaded=loads.filter(x=>x.count>=6),quality=dataQuality(tasks,campaigns);
    const todayKey=typeof today==="function"?today():"";
    const late=scope.filter(t=>typeof v412TaskOverdue==="function"?v412TaskOverdue(t,todayKey):(t.due_date&&t.due_date<todayKey));
    const due=scope.filter(t=>typeof v412TaskDueToday==="function"?v412TaskDueToday(t,todayKey):t.due_date===todayKey);
    const unreadMessages=(state.messages||[]).filter(m=>sameId(m.recipient_id||m.receiver_id,member?.id)&&!m.read_at).length;
    const unreadNotifications=(state.notifications||[]).filter(n=>!n.read_at&&(!n.member_id||sameId(n.member_id,member?.id))).length;
    const execution=uniqueById([...(signals.observed||[]),...(signals.review||[]),...late,...due,...scope].filter(Boolean)).slice(0,4);
    const insights=[];
    if((signals.review||[]).length)insights.push({tone:"warning",title:`${signals.review.length} entrega${signals.review.length===1?"":"s"} espera${signals.review.length===1?"":"n"} decisión`,meta:"Revisar ahora evita que la producción quede bloqueada.",label:"Revisar",action:()=>navTo("approvals")});
    if(late.length)insights.push({tone:"danger",title:`${late.length} tarea${late.length===1?"":"s"} fuera de fecha`,meta:"Prioriza responsables, evidencia y nueva fecha de compromiso.",label:"Resolver",action:()=>navTo("tasks")});
    if(stale.length)insights.push({tone:"warning",title:`${stale.length} campaña${stale.length===1?"":"s"} sin movimiento reciente`,meta:`La más antigua lleva ${daysSince(stale[0].updated_at||stale[0].created_at)} días sin actualización.`,label:"Abrir",action:()=>homeOpenCampaign(stale[0].id)});
    if(overloaded.length)insights.push({tone:"warning",title:`${overloaded.length} miembro${overloaded.length===1?"":"s"} con carga alta`,meta:`${overloaded[0]?.member?.full_name||"Un miembro"} concentra ${overloaded[0]?.count||0} tareas abiertas.`,label:"Capacidad",action:()=>navTo("workIntel")});
    if(quality.total)insights.push({tone:"warning",title:`${quality.total} dato${quality.total===1?"":"s"} operativo${quality.total===1?"":"s"} incompleto${quality.total===1?"":"s"}`,meta:`${quality.unassigned} sin responsable · ${quality.undated} sin fecha · ${quality.orphan} sin campaña válida.`,label:"Corregir",action:()=>navTo("tasks")});
    if(unreadMessages+unreadNotifications)insights.push({tone:"success",title:`${unreadMessages+unreadNotifications} novedad${unreadMessages+unreadNotifications===1?"":"es"} sin revisar`,meta:`${unreadMessages} mensajes · ${unreadNotifications} notificaciones.`,label:"Ver",action:()=>navTo("notifications")});
    if(!insights.length)insights.push({tone:"success",title:"Operación estable",meta:"No se detectaron bloqueos críticos en la lectura actual.",label:"Mi día",action:()=>navTo("myday")});
    return{signals,tasks,scope,campaigns,stale,loads,overloaded,quality,late,due,execution,insights,unreadMessages,unreadNotifications};
  }
  function ensureOpsCenter(){
    if($("v13OpsCenter"))return $("v13OpsCenter");
    const anchor=$("v12CommandStage");if(!anchor)return null;
    const section=document.createElement("section");section.id="v13OpsCenter";section.className="v13-ops-center";section.dataset.mzSectionKey="operational-intelligence";
    section.innerHTML=`<div class="v13-ops-head"><div><span class="mz-kicker">OPERATIONAL INTELLIGENCE</span><h2>Decisiones claras, sin buscar entre módulos.</h2><p>La plataforma convierte tareas, campañas, carga y actividad en una lectura operativa accionable.</p></div><button id="v13HealthButton" type="button" class="v13-health-button">Salud del sistema</button></div><div class="v13-ops-grid"><article class="v13-ops-panel"><div class="v13-panel-title"><div><span>LECTURA EJECUTIVA</span><h3>Lo que necesita atención.</h3></div><b id="v13InsightCount">0</b></div><div id="v13InsightList" class="v13-insight-list"></div></article><article class="v13-ops-panel"><div class="v13-panel-title"><div><span>EJECUCIÓN RÁPIDA</span><h3>Actúa sin perder contexto.</h3></div></div><div id="v13ExecutionList" class="v13-execution-list"></div></article></div><div id="v13OpsMetrics" class="v13-ops-metrics"></div>`;
    anchor.insertAdjacentElement("afterend",section);
    $("v13HealthButton")?.addEventListener("click",openHealthCenter);
    return section;
  }
  function renderInsights(model){const host=$("v13InsightList"),count=$("v13InsightCount");if(count)count.textContent=String(model.insights.length);if(!host)return;host.innerHTML=model.insights.slice(0,6).map((item,index)=>`<article class="v13-insight ${esc(item.tone||"")}"><i class="v13-insight-dot"></i><div><strong>${esc(item.title)}</strong><small>${esc(item.meta)}</small></div><button type="button" data-v13-insight="${index}">${esc(item.label||"Abrir")}</button></article>`).join("");host.querySelectorAll("[data-v13-insight]").forEach(button=>button.addEventListener("click",()=>model.insights[Number(button.dataset.v13Insight)]?.action?.()))}
  function renderExecution(model){const host=$("v13ExecutionList");if(!host)return;if(!model.execution.length){host.innerHTML='<div class="v13-empty">No hay tareas inmediatas. Puedes continuar desde Mi día.</div>';return}host.innerHTML=model.execution.map(task=>{const mine=sameId(task.assigned_to,member?.id),done=v412TaskDone(task),meta=`${nameOf(state.campaigns,task.campaign_id)||nameOf(state.clients,task.client_id)||"Sin campaña"} · ${homeShortDate(task.due_date)} · ${v66StatusLabel(task.status||"pendiente")}`;return`<article class="v13-execution-card"><div class="v13-execution-copy"><strong>${esc(task.title||"Tarea")}</strong><span>${esc(meta)}</span></div><div class="v13-execution-actions"><button type="button" class="primary" data-v13-task="${esc(task.id)}" data-v13-action="open">Abrir</button>${mine&&!done?`<button type="button" data-v13-task="${esc(task.id)}" data-v13-action="progress">Progreso</button><button type="button" data-v13-task="${esc(task.id)}" data-v13-action="deliver">Entregar tarea</button>`:""}</div></article>`}).join("");host.querySelectorAll("[data-v13-task]").forEach(button=>button.addEventListener("click",()=>homeQuickTaskAction(button.dataset.v13Task,button.dataset.v13Action)))}
  function renderMetrics(model){const host=$("v13OpsMetrics");if(!host)return;const metrics=[["URGENCIAS",model.late.length,model.late.length?"Tareas fuera de fecha":"Sin vencimientos críticos"],["CAMPAÑAS EN PAUSA",model.stale.length,model.stale.length?"Siete días o más sin actividad":"Ritmo reciente"],["CARGA ALTA",model.overloaded.length,model.overloaded.length?"Seis o más tareas abiertas":"Capacidad equilibrada"],["CALIDAD DE DATOS",model.quality.total,model.quality.total?"Responsable, fecha o campaña incompleta":"Registros esenciales completos"]];host.innerHTML=metrics.map(([label,value,meta])=>`<article class="v13-ops-metric"><span>${esc(label)}</span><strong>${esc(String(value))}</strong><small>${esc(meta)}</small></article>`).join("")}
  function renderOpsCenter(){if(!ensureOpsCenter())return;const model=operationalModel();renderInsights(model);renderExecution(model);renderMetrics(model)}
  function dynamicPaletteItems(){
    const tasks=openTasks().slice().sort((a,b)=>String(a.due_date||"9999-12-31").localeCompare(String(b.due_date||"9999-12-31"))).slice(0,16).map((t,index)=>({key:`${DYNAMIC_PREFIX}task:${t.id}`,code:`T${String(index+1).padStart(2,"0")}`,title:t.title||"Tarea",meta:`Tarea · ${nameOf(state.campaigns,t.campaign_id)||nameOf(state.clients,t.client_id)||"Sin campaña"} · ${homeShortDate(t.due_date)}`,action:()=>homeOpenTask(t.id)}));
    const campaigns=activeCampaigns().slice(0,10).map((c,index)=>({key:`${DYNAMIC_PREFIX}campaign:${c.id}`,code:`C${String(index+1).padStart(2,"0")}`,title:c.name||"Campaña",meta:`Campaña · ${nameOf(state.clients,c.client_id)||"Sin cliente"}`,action:()=>homeOpenCampaign(c.id)}));
    const members=(state.members||[]).slice(0,10).map((m,index)=>({key:`${DYNAMIC_PREFIX}member:${m.id}`,code:`P${String(index+1).padStart(2,"0")}`,title:m.full_name||"Miembro",meta:`Persona · ${m.position||m.role_code||"Equipo"}`,action:()=>openMemberProfile(m.id)}));
    const assets=(state.assets||[]).slice(0,8).map((a,index)=>({key:`${DYNAMIC_PREFIX}asset:${a.id}`,code:`A${String(index+1).padStart(2,"0")}`,title:a.name||"Archivo",meta:`Archivo · ${nameOf(state.campaigns,a.campaign_id)||nameOf(state.clients,a.client_id)||a.file_type||"Recurso"}`,action:()=>navTo("assets")}));
    const commands=[{key:`${DYNAMIC_PREFIX}health`,code:"H1",title:"Salud del sistema",meta:"Diagnóstico no destructivo de módulos y Supabase",action:openHealthCenter},{key:`${DYNAMIC_PREFIX}notifications`,code:"H2",title:"Centro de notificaciones",meta:"Mensajes, revisiones y alertas",action:()=>navTo("notifications")}];
    return[...commands,...tasks,...campaigns,...members,...assets]
  }
  function refreshPalette(){if(typeof V12_PALETTE_ITEMS==="undefined")return;for(let i=V12_PALETTE_ITEMS.length-1;i>=0;i--)if(String(V12_PALETTE_ITEMS[i]?.key||"").startsWith(DYNAMIC_PREFIX))V12_PALETTE_ITEMS.splice(i,1);V12_PALETTE_ITEMS.push(...dynamicPaletteItems())}
  async function healthReport(){
    let report=null;try{report=await window.INBESTIGA_PLATFORM_DIAGNOSTICS?.run?.({network:true})}catch(error){console.warn("[v13] diagnostics",error)}
    const local={session:typeof authUser!=="undefined"&&!!authUser?.id,supabase_client:typeof sb!=="undefined"&&!!sb,konva_loaded:!!window.Konva,duplicate_ids:[],visible_technical_text:[],missing_rpcs:[],openapi:{available:false,reason:"Diagnóstico avanzado no disponible"}};
    return report||local
  }
  async function openHealthCenter(){
    if(window.INBESTIGA_QUALITY_CORE?.open)return window.INBESTIGA_QUALITY_CORE.open();
    if(typeof premiumToast==="function")premiumToast("Diagnóstico iniciado","La revisión es de solo lectura y no modifica datos.","success");
    const report=await healthReport(),missing=report.missing_rpcs||[],dupes=report.duplicate_ids||[],technical=report.visible_technical_text||[],stateArrays=report.state_arrays||{};
    const rows=[["SESIÓN",report.session?"Activa":"No disponible",report.session?"Usuario autenticado":"Inicia sesión para pruebas completas"],["SUPABASE",report.supabase_client?"Disponible":"No disponible",report.openapi?.available?"OpenAPI consultada":report.openapi?.reason||"Cliente local"],["CREATIVE ARENA",report.konva_loaded?"Motor listo":"Motor no cargado",report.konva_loaded?"Konva disponible":"Revisa conexión o CDN"],["ESTRUCTURA",!dupes.length&&!technical.length?"Correcta":"Revisar",`${dupes.length} IDs duplicados · ${technical.length} bloques técnicos visibles`],["RPC",missing.length?`${missing.length} faltantes`:"Sin faltantes detectados",report.openapi?.available?`${report.required_rpcs||0} funciones requeridas verificadas`:"La verificación de red no estuvo disponible"],["DATOS",Object.values(stateArrays).every(v=>v!==null)?"Cargados":"Parciales",Object.entries(stateArrays).map(([k,v])=>`${k}: ${v??"—"}`).slice(0,4).join(" · ")||"Sin lectura"]];
    const body=`<div class="v13-health-grid">${rows.map(([label,value,meta])=>`<article class="v13-health-item"><span>${esc(label)}</span><strong>${esc(String(value))}</strong><small>${esc(String(meta))}</small></article>`).join("")}</div><div class="v13-health-note">Diagnóstico generado por ${V13_VERSION}. No crea, modifica ni elimina registros. RLS, Storage y Realtime requieren una sesión productiva para certificación completa.</div>`;
    if(typeof openPremiumModal==="function")openPremiumModal({title:"Salud del sistema",subtitle:"Lectura técnica no destructiva",body,actions:[{label:"Cerrar",value:null,className:"primary"}]});
    else if(typeof premiumToast==="function")premiumToast("Diagnóstico completado",missing.length?`${missing.length} RPC requieren revisión.`:"No se detectaron fallas estructurales.",missing.length?"warning":"success")
  }
  const baseOpenPalette=typeof v12OpenCommandPalette==="function"?v12OpenCommandPalette:null;
  if(baseOpenPalette)v12OpenCommandPalette=function(){refreshPalette();return baseOpenPalette.apply(this,arguments)};
  const baseRenderHome=typeof renderHome==="function"?renderHome:null;
  if(baseRenderHome)renderHome=function(){const result=baseRenderHome.apply(this,arguments);try{renderOpsCenter();refreshPalette()}catch(error){console.error("[v13] operational intelligence",error)}return result};
  function init(){const input=$("v12PaletteInput");if(input)input.placeholder="Buscar módulos, tareas, campañas, personas y archivos…";ensureOpsCenter();renderOpsCenter();refreshPalette();window.INBESTIGA_OPERATIONAL_INTELLIGENCE={version:V13_VERSION,render:renderOpsCenter,model:operationalModel,health:openHealthCenter}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
