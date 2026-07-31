/* INBESTIGA Marketing Cloud v17.16.3 · Solicitudes 360 audio + task handoff */
(()=>{
  "use strict";
  if(window.INBESTIGA_REQUESTS_360?.version==="v17.16.3")return;
  const VERSION="v17.16.3",MODULE="requests360-internal-v17-16-3",BUCKET="inbestiga-requests";
  const local={requests:[],attachments:[],updates:[],loaded:false,loading:false,error:"",activeId:"",filters:{search:"",status:"",area:"",type:""},channel:null,realtimeReady:false,lastSyncAt:0,noticeQueue:[],noticeActive:false};
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const rows=value=>Array.isArray(value)?value:[];
  const client=()=>{try{return typeof sb!=="undefined"&&sb?sb:null}catch{return null}};
  const appState=()=>{try{return typeof state!=="undefined"&&state?state:{} }catch{return{}}};
  const currentMember=()=>{try{return typeof member!=="undefined"?member:null}catch{return null}};
  const statusLabels={draft:"Borrador",new:"Nuevo",reviewing:"En evaluación",needs_info:"Falta información",accepted:"Aprobado",in_production:"En producción",in_review:"En revisión",delivered:"Entregado",completed:"Finalizado",rejected:"No procede"};
  const dateLabel=value=>{if(!value)return"Sin fecha";try{return new Date(value).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:value.includes?.("T")?"short":undefined})}catch{return value}};
  const fileSize=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  const requestById=id=>local.requests.find(item=>String(item.id)===String(id));
  const attachmentsFor=id=>local.attachments.filter(item=>String(item.request_id)===String(id));
  const attachmentKind=file=>{
    const kind=String(file?.kind||"").toLowerCase(),type=String(file?.file_type||file?.mime_type||"").toLowerCase(),name=String(file?.file_name||"").toLowerCase();
    if(kind==="audio"||type.startsWith("audio/")||/\.(webm|m4a|mp3|wav|ogg|oga|aac)$/i.test(name))return"audio";
    if(kind==="image"||type.startsWith("image/")||/\.(png|jpe?g|webp|gif|heic)$/i.test(name))return"image";
    if(kind==="video"||type.startsWith("video/")||/\.(mp4|mov|webm|mkv)$/i.test(name))return"video";
    if(kind==="pdf"||type.includes("pdf")||name.endsWith(".pdf"))return"pdf";
    return"document";
  };
  const taskById=id=>rows(appState().tasks).find(task=>String(task.id)===String(id));
  const normalizeRpcPayload=value=>{
    if(Array.isArray(value))return value[0]||null;
    if(typeof value==="string"){try{return JSON.parse(value)}catch{return value}}
    if(value&&typeof value==="object"&&"data" in value&&Object.keys(value).length===1)return normalizeRpcPayload(value.data);
    return value;
  };
  const createdTaskIdFrom=value=>{
    const data=normalizeRpcPayload(value);
    if(typeof data==="string"&&data.length>8)return data;
    if(data&&typeof data==="object")return String(data.id||data.task_id||data.created_id||"");
    return"";
  };
  async function fetchAttachments(requestId){
    const c=client();if(!c||!requestId)return[];
    const result=await c.from("interarea_request_attachments").select("*").eq("request_id",requestId).order("created_at",{ascending:true});
    if(result.error)throw result.error;
    local.attachments=local.attachments.filter(row=>String(row.request_id)!==String(requestId)).concat(rows(result.data));
    return rows(result.data);
  }
  async function signedResource(file){
    const c=client();
    if(!c||!file?.storage_path)return{...file,url:"",urlError:"Ruta de archivo no disponible."};
    const result=await c.storage.from(BUCKET).createSignedUrl(file.storage_path,21600);
    if(result.error)return{...file,url:"",urlError:String(result.error.message||result.error)};
    return{...file,url:result.data?.signedUrl||"",urlError:""};
  }
  async function enrichedAttachments(requestId){
    const files=await fetchAttachments(requestId);
    return Promise.all(files.map(signedResource));
  }
  async function getTaskResources(taskId){
    const c=client();if(!c||!taskId)return null;
    let item=local.requests.find(row=>String(row.converted_task_id||"")===String(taskId));
    if(!item){
      const result=await c.from("interarea_requests").select("*").eq("converted_task_id",taskId).neq("status","draft").maybeSingle();
      if(result.error)throw result.error;
      item=result.data||null;
      if(item)upsertRequest(item,{prepend:false});
    }
    if(!item)return null;
    const files=await enrichedAttachments(item.id);
    return{request:item,files,links:rows(item.links)};
  }
  async function waitForCreatedTask({before,id,title,assigned,due}){
    for(let attempt=0;attempt<5;attempt++){
      try{await window.loadAll?.()}catch{}
      const tasks=rows(appState().tasks);
      const match=id?tasks.find(task=>String(task.id)===String(id)):tasks
        .filter(task=>!before.has(String(task.id)))
        .sort((a,b)=>String(b.created_at||b.updated_at||"").localeCompare(String(a.created_at||a.updated_at||"")))
        .find(task=>String(task.assigned_to||"")===String(assigned)&&String(task.title||"").trim().toLowerCase()===String(title||"").trim().toLowerCase()&&(!due||String(task.due_date||"")===String(due)));
      if(match)return match;
      if(attempt<4)await new Promise(resolve=>setTimeout(resolve,450*(attempt+1)));
    }
    return null;
  }
  const NOTICE_IDS_PREFIX="inbestiga:requests360:notified:";
  const NOTICE_LAST_PREFIX="inbestiga:requests360:last-seen:";
  const memberKey=()=>String(currentMember()?.id||currentMember()?.auth_user_id||"marketing-session");
  const noticeIdsKey=()=>NOTICE_IDS_PREFIX+memberKey();
  const noticeLastKey=()=>NOTICE_LAST_PREFIX+memberKey();
  const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
  const requestTime=item=>Date.parse(item?.submitted_at||item?.created_at||"")||0;
  function receptionState(stateName,label,detail=""){const host=$("req360RealtimeState"),title=$("req360RealtimeLabel"),copy=$("req360RealtimeDetail");if(host)host.dataset.state=stateName;if(title)title.textContent=label;if(copy)copy.textContent=detail}
  function upsertRequest(item,{prepend=true}={}){if(!item||item.status==="draft")return false;const index=local.requests.findIndex(row=>String(row.id)===String(item.id));if(index>=0)local.requests[index]={...local.requests[index],...item};else prepend?local.requests.unshift(item):local.requests.push(item);return index<0}
  function notifiedIds(){return new Set(readJson(noticeIdsKey(),[]).map(String))}
  function rememberNotified(item){const ids=[String(item.id),...notifiedIds()].slice(0,240);try{localStorage.setItem(noticeIdsKey(),JSON.stringify([...new Set(ids)]));localStorage.setItem(noticeLastKey(),String(Math.max(Number(localStorage.getItem(noticeLastKey())||0),requestTime(item),Date.now())))}catch{}}
  function alreadyNotified(item){return notifiedIds().has(String(item?.id||""))}
  function ensureNoticeHost(){let host=$("req360NotificationHost");if(host)return host;host=document.createElement("div");host.id="req360NotificationHost";host.className="req360-notification-host";host.setAttribute("aria-live","polite");host.setAttribute("aria-atomic","true");document.body.appendChild(host);return host}
  function nextNotice(){if(local.noticeActive||!local.noticeQueue.length)return;local.noticeActive=true;const item=local.noticeQueue.shift(),host=ensureNoticeHost(),notice=document.createElement("article");notice.className="req360-live-notice";notice.innerHTML=`<button class="req360-live-close" type="button" aria-label="Cerrar">×</button><div class="req360-live-orb"><i></i></div><div class="req360-live-copy"><span class="req360-live-kicker"><i></i>NUEVO REQUERIMIENTO</span><strong>${esc(item.requester_name)}</strong><p><b>${esc(item.requester_area)}</b> solicita: ${esc(item.title)}</p><small>${esc(item.request_type||"Requerimiento especial")}${item.urgency&&item.urgency!=="normal"?` · ${esc(item.urgency)}`:""}</small><button class="req360-live-open" type="button">Abrir solicitud</button></div>`;host.appendChild(notice);requestAnimationFrame(()=>notice.classList.add("show"));let timer=setTimeout(closeNotice,12000);function closeNotice(){clearTimeout(timer);notice.classList.remove("show");setTimeout(()=>{notice.remove();local.noticeActive=false;nextNotice()},260)}notice.querySelector(".req360-live-close").onclick=closeNotice;notice.querySelector(".req360-live-open").onclick=()=>{closeNotice();window.navTo?.("requests360");setTimeout(()=>open(item.id),180)};notice.onmouseenter=()=>clearTimeout(timer);notice.onmouseleave=()=>timer=setTimeout(closeNotice,5000)}
  function notifyRequest(item,{force=false}={}){if(!item||item.status==="draft"||(!force&&alreadyNotified(item)))return;rememberNotified(item);local.noticeQueue.push(item);nextNotice();window.INBESTIGA_SAKURA_AFFECTIVE?.set?.("attentive",{reason:"nuevo requerimiento",semanticState:true});window.dispatchEvent(new CustomEvent("inbestiga:request-created",{detail:{request:item}}));try{if(window.Notification?.permission==="granted")new Notification("Nuevo requerimiento",{body:`${item.requester_name} · ${item.requester_area}: ${item.title}`,tag:`request-${item.id}`})}catch{}}
  function notifyRecentUnseen(){const stored=Number(localStorage.getItem(noticeLastKey())||0),baseline=stored||Date.now()-10*60*1000,candidates=local.requests.filter(item=>item.status!=="draft"&&requestTime(item)>baseline&&!alreadyNotified(item)).sort((a,b)=>requestTime(a)-requestTime(b)).slice(-5);candidates.forEach(item=>notifyRequest(item));try{localStorage.setItem(noticeLastKey(),String(Math.max(Date.now(),...local.requests.map(requestTime))))}catch{}}
  async function checkReception({toast=true}={}){const c=client();if(!c){receptionState("error","Recepción desconectada","No hay cliente de Supabase disponible.");return false}receptionState("checking","Comprobando recepción…","Validando bandeja y canal en tiempo real.");try{const result=await c.from("interarea_requests").select("id",{count:"exact",head:true}).neq("status","draft");if(result.error)throw result.error;const live=local.realtimeReady;receptionState(live?"connected":"warning",live?"Recepción en tiempo real activa":"Bandeja disponible",`${result.count||0} requerimiento(s) accesibles${live?" · canal conectado":" · canal conectando"}`);if(toast)window.premiumToast?.(live?"Recepción activa":"Bandeja disponible",live?"Las nuevas solicitudes aparecerán inmediatamente.":"Los datos llegan; el canal en tiempo real aún está conectando.",live?"success":"info");return true}catch(error){receptionState("error","Recepción con error",String(error.message||error));if(toast)window.premiumToast?.("No se pudo comprobar",String(error.message||error),"error");return false}}
  function setBadge(){const count=local.requests.filter(item=>item.status==="new").length;const badge=$("req360NavBadge");if(badge){badge.textContent=count;badge.style.display=count?"inline-grid":"none"}const home=$("req360HomeBadge");if(home){home.textContent=count;home.style.display=count?"inline-grid":"none"}}
  async function load({force=false,silent=false}={}){if(local.loading)return local.requests;if(local.loaded&&!force)return local.requests;const c=client();if(!c){local.error="Cliente de Supabase no disponible.";render();return[]}local.loading=true;local.error="";if(!silent&&$("req360List"))$("req360List").innerHTML='<div class="req360-empty">Cargando requerimientos…</div>';try{const req=await c.from("interarea_requests").select("*").neq("status","draft").order("submitted_at",{ascending:false,nullsFirst:false}).limit(300);if(req.error)throw req.error;local.requests=rows(req.data);const ids=local.requests.map(item=>item.id);if(ids.length){const att=await c.from("interarea_request_attachments").select("*").in("request_id",ids).order("created_at",{ascending:true});if(att.error)throw att.error;local.attachments=rows(att.data)}else local.attachments=[];local.loaded=true;local.lastSyncAt=Date.now();setBadge();render();renderInitialOptions();notifyRecentUnseen();return local.requests}catch(error){local.error=/relation .* does not exist|Could not find the table/i.test(String(error.message||error))?"Solicitudes 360 necesita la instalación inicial del archivo SQL_REQUERIDO_v17_16_0_SOLICITUDES_360.sql.":String(error.message||error);render();return[]}finally{local.loading=false}}
  function filtered(){const q=local.filters.search.trim().toLowerCase();return local.requests.filter(item=>(!local.filters.status||item.status===local.filters.status)&&(!local.filters.area||item.requester_area===local.filters.area)&&(!local.filters.type||item.request_type===local.filters.type)&&(!q||`${item.reference} ${item.requester_name} ${item.requester_area} ${item.title} ${item.description}`.toLowerCase().includes(q)))}
  function metrics(){const all=local.requests;return{new:all.filter(x=>x.status==="new").length,reviewing:all.filter(x=>["reviewing","needs_info"].includes(x.status)).length,production:all.filter(x=>["accepted","in_production","in_review"].includes(x.status)).length,urgent:all.filter(x=>["alta","urgente"].includes(x.urgency)&&!["completed","rejected"].includes(x.status)).length,completed:all.filter(x=>["delivered","completed"].includes(x.status)).length}}
  function render(){const host=$("req360List");if(!host)return;if(local.error){host.innerHTML=`<div class="req360-error"><strong>No se pudo abrir Solicitudes 360.</strong><br>${esc(local.error)}</div>`;renderMetrics();return}const list=filtered();host.innerHTML=list.length?list.map(item=>{const count=attachmentsFor(item.id).length;return`<article class="req360-card" data-request-id="${esc(item.id)}"><div class="req360-card-main"><div class="req360-card-top"><span class="req360-ref">${esc(item.reference||"SIN REFERENCIA")}</span><span class="req360-status" data-status="${esc(item.status)}">${esc(statusLabels[item.status]||item.status)}</span>${item.urgency!=="normal"?`<span class="req360-status" data-status="new">${esc(item.urgency)}</span>`:""}</div><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="req360-meta"><span>${esc(item.requester_name)}</span><span>${esc(item.requester_area)}</span><span>${esc(item.request_type)}</span><span>${count} archivo${count===1?"":"s"}</span></div></div><div class="req360-card-side"><strong>${item.needed_by?`Necesita ${esc(dateLabel(item.needed_by))}`:"Sin fecha solicitada"}</strong><span>${esc(dateLabel(item.submitted_at||item.created_at))}</span></div></article>`}).join(""):'<div class="req360-empty">No hay solicitudes que coincidan con estos filtros.</div>';host.querySelectorAll("[data-request-id]").forEach(card=>card.onclick=()=>open(card.dataset.requestId));renderMetrics()}
  function renderMetrics(){const m=metrics();[["req360MetricNew",m.new],["req360MetricReview",m.reviewing],["req360MetricProduction",m.production],["req360MetricUrgent",m.urgent],["req360MetricDone",m.completed]].forEach(([id,value])=>{if($(id))$(id).textContent=value})}
  async function signedUrl(path){const resource=await signedResource({storage_path:path});return resource.url||""}
  async function loadUpdates(id){const c=client();if(!c)return[];const result=await c.from("interarea_request_updates").select("*").eq("request_id",id).order("created_at",{ascending:false}).limit(100);return result.error?[]:rows(result.data)}
  async function open(id){
    const item=requestById(id);if(!item)return;
    local.activeId=item.id;
    let drawer=$("req360Drawer");
    if(!drawer){
      drawer=document.createElement("div");
      drawer.id="req360Drawer";
      drawer.className="req360-drawer";
      drawer.innerHTML='<div class="req360-drawer-panel"><button class="req360-drawer-close" id="req360DrawerClose">×</button><div id="req360DrawerBody"></div></div>';
      document.body.appendChild(drawer);
      drawer.onclick=event=>{if(event.target===drawer)close()};
      $("req360DrawerClose").onclick=close;
    }
    drawer.classList.add("open");
    const body=$("req360DrawerBody");
    body.innerHTML='<div class="req360-empty">Consultando la solicitud, el audio y todos los archivos…</div>';
    let enriched=[],attachmentError="";
    try{enriched=await enrichedAttachments(id)}catch(error){attachmentError=String(error.message||error)}
    const updates=await loadUpdates(id);local.updates=updates;
    const members=rows(appState().members).filter(person=>person.status!=="inactive");
    const audioFiles=enriched.filter(file=>attachmentKind(file)==="audio");
    const otherFiles=enriched.filter(file=>attachmentKind(file)!=="audio");
    const assigneeOptions=members.map(person=>`<option value="${esc(person.id)}" ${String(person.id)===String(item.assigned_to)?"selected":""}>${esc(person.full_name)}</option>`).join("");
    const linkedTask=item.converted_task_id?taskById(item.converted_task_id):null;
    const fileMarkup=file=>{
      const kind=attachmentKind(file),icon=kind==="audio"?"AUD":kind==="image"?"IMG":kind==="video"?"VID":kind==="pdf"?"PDF":"DOC";
      return`<article class="req360-file ${kind==="audio"?"req360-file-audio":""}">
        <span class="req360-file-icon">${icon}</span>
        <div class="req360-file-copy"><strong>${esc(file.file_name)}</strong><span>${fileSize(file.file_size||0)} · ${esc(file.file_type||"archivo")}</span>${file.urlError?`<small>${esc(file.urlError)}</small>`:""}</div>
        ${file.url?`<a href="${esc(file.url)}" target="_blank" rel="noopener">Abrir</a>`:""}
        ${kind==="audio"&&file.url?`<audio class="req360-audio" controls preload="metadata"><source src="${esc(file.url)}" type="${esc(file.file_type||"audio/webm")}">Tu navegador no puede reproducir este audio.</audio>`:""}
      </article>`;
    };
    body.innerHTML=`
      <div class="req360-detail-head">
        <span class="req360-kicker">${esc(item.reference)}</span>
        <h2>${esc(item.title)}</h2>
        <p>${esc(item.requester_name)} · ${esc(item.requester_area)} · ${esc(dateLabel(item.submitted_at||item.created_at))}</p>
        <div class="req360-meta"><span>${esc(item.request_type)}</span><span>${esc(statusLabels[item.status]||item.status)}</span><span>Urgencia ${esc(item.urgency||"normal")}</span>${item.needed_by?`<span>Necesita ${esc(dateLabel(item.needed_by))}</span>`:""}${audioFiles.length?`<span>${audioFiles.length} audio${audioFiles.length===1?"":"s"}</span>`:""}</div>
      </div>
      ${attachmentError?`<div class="req360-error" style="margin-top:16px"><strong>No se pudieron consultar los adjuntos.</strong><br>${esc(attachmentError)}</div>`:""}
      <div class="req360-detail-grid">
        <section class="req360-box"><h4>Explicación escrita</h4><p class="req360-description">${esc(item.description)}</p></section>
        <section class="req360-box"><h4>Datos del solicitante</h4><p><strong>${esc(item.requester_name)}</strong><br>${esc(item.requester_area)}${item.contact?`<br>${esc(item.contact)}`:""}</p></section>
        <section class="req360-box"><h4>Enlaces</h4>${rows(item.links).length?`<ul>${rows(item.links).map(link=>`<li><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a></li>`).join("")}</ul>`:'<p>Sin enlaces adjuntos.</p>'}</section>
        <section class="req360-box req360-audio-box"><h4>Explicación de voz</h4><div class="req360-audio-list">${audioFiles.length?audioFiles.map(fileMarkup).join(""):'<p>No se adjuntó una grabación de voz.</p>'}</div></section>
      </div>
      <section class="req360-box req360-documents-box" style="margin-top:12px"><h4>Documentos y referencias</h4><div class="req360-files">${otherFiles.length?otherFiles.map(fileMarkup).join(""):'<p>Sin documentos o imágenes adicionales.</p>'}</div></section>
      <section class="req360-admin">
        <h3>Gestión interna</h3>
        <div class="req360-admin-grid">
          <label>Estado<select id="req360DetailStatus">${Object.entries(statusLabels).filter(([key])=>key!=="draft").map(([key,label])=>`<option value="${key}" ${key===item.status?"selected":""}>${label}</option>`).join("")}</select></label>
          <label>Prioridad interna<select id="req360DetailPriority"><option value="">Sin definir</option>${["baja","media","alta","urgente"].map(value=>`<option value="${value}" ${value===item.internal_priority?"selected":""}>${value}</option>`).join("")}</select></label>
          <label>Responsable de la solicitud<select id="req360DetailAssignee"><option value="">Sin asignar</option>${assigneeOptions}</select></label>
          <textarea id="req360DetailNotes" placeholder="Notas internas para Marketing">${esc(item.internal_notes||"")}</textarea>
          <textarea id="req360PublicMessage" placeholder="Mensaje visible para el solicitante, opcional"></textarea>
        </div>
        <div class="req360-admin-actions"><button class="primary" id="req360SaveDetail">Guardar cambios</button><button class="secondary" id="req360CopySummary">Copiar resumen</button></div>
      </section>
      <section class="req360-task-handoff" data-linked="${item.converted_task_id?"true":"false"}">
        <div class="req360-task-handoff-head">
          <div><span>TRABAJO 360</span><h3>${item.converted_task_id?"Tarea vinculada":"Crear tarea desde este requerimiento"}</h3><p>${item.converted_task_id?"Los documentos y audios originales están disponibles dentro del detalle de la tarea.":"Define al responsable y crea la tarea con toda la información recibida."}</p></div>
          <span class="req360-handoff-count">${enriched.length+rows(item.links).length} referencia${enriched.length+rows(item.links).length===1?"":"s"}</span>
        </div>
        ${item.converted_task_id?`
          <div class="req360-linked-task"><div><strong>${esc(linkedTask?.title||item.title)}</strong><span>${esc(linkedTask?`${linkedTask.assigned_to?members.find(person=>String(person.id)===String(linkedTask.assigned_to))?.full_name||"Responsable asignado":"Sin responsable"} · ${linkedTask.due_date||"sin fecha"}`:`ID ${item.converted_task_id}`)}</span></div><button id="req360OpenLinkedTask" type="button">Abrir tarea</button></div>
        `:`
          <div class="req360-task-grid">
            <label class="full">Título de la tarea<input id="req360TaskTitle" value="${esc(item.title)}"></label>
            <label>Responsable<select id="req360TaskAssignee"><option value="">Selecciona responsable</option>${assigneeOptions}</select></label>
            <label>Fecha de entrega<input id="req360TaskDue" type="date" value="${esc(item.needed_by||"")}"></label>
            <label>Prioridad<select id="req360TaskPriority">${["baja","media","alta","urgente"].map(value=>`<option value="${value}" ${value===(item.internal_priority||item.urgency||"media")?"selected":""}>${value}</option>`).join("")}</select></label>
          </div>
          <div class="req360-handoff-summary"><span>Se adjuntarán automáticamente</span><strong>${audioFiles.length} audio${audioFiles.length===1?"":"s"} · ${otherFiles.length} archivo${otherFiles.length===1?"":"s"} · ${rows(item.links).length} enlace${rows(item.links).length===1?"":"s"}</strong></div>
          <button class="req360-create-task" id="req360CreateTask" type="button">Crear tarea y adjuntar todo</button>
        `}
      </section>
      <section class="req360-box" style="margin-top:18px"><h4>Historial</h4><div class="req360-timeline">${updates.length?updates.map(update=>`<article class="req360-update"><strong>${esc(statusLabels[update.status]||update.status||"Actualización")}</strong>${update.message?`<p>${esc(update.message)}</p>`:""}<span>${esc(dateLabel(update.created_at))}</span></article>`).join(""):'<p>Sin actualizaciones adicionales.</p>'}</div></section>`;
    $("req360SaveDetail").onclick=saveDetail;
    $("req360CopySummary").onclick=()=>copySummary(item);
    if($("req360CreateTask"))$("req360CreateTask").onclick=()=>createTaskFromRequest(item);
    if($("req360OpenLinkedTask"))$("req360OpenLinkedTask").onclick=()=>openLinkedTask(item.converted_task_id);
  }
  function close(){$("req360Drawer")?.classList.remove("open")}
  async function saveDetail(){const item=requestById(local.activeId),c=client();if(!item||!c)return;const patch={status:$("req360DetailStatus").value,internal_priority:$("req360DetailPriority").value||null,assigned_to:$("req360DetailAssignee").value||null,internal_notes:$("req360DetailNotes").value.trim()||null,updated_at:new Date().toISOString()};const result=await c.from("interarea_requests").update(patch).eq("id",item.id).select().single();if(result.error){window.premiumToast?.("No se guardó",result.error.message,"error");return}const publicMessage=$("req360PublicMessage").value.trim();if(publicMessage){await c.from("interarea_request_updates").insert({request_id:item.id,status:patch.status,message:publicMessage,visibility:"public",created_by:currentMember()?.id||null})}Object.assign(item,result.data||patch);window.premiumToast?.("Solicitud actualizada",item.reference,"success");await load({force:true,silent:true});open(item.id)}
  function taskDescription(item){
    const links=rows(item.links),files=attachmentsFor(item.id),audios=files.filter(file=>attachmentKind(file)==="audio"),documents=files.filter(file=>attachmentKind(file)!=="audio");
    return[
      `Solicitud interáreas ${item.reference}`,
      `Solicitante: ${item.requester_name} · ${item.requester_area}`,
      `Tipo: ${item.request_type}`,
      `Urgencia declarada: ${item.urgency||"normal"}`,
      item.description,
      links.length?`Enlaces de referencia:\n${links.join("\n")}`:"",
      audios.length?`Explicación de voz adjunta: ${audios.map(file=>file.file_name).join(", ")}`:"",
      documents.length?`Documentos y referencias adjuntas: ${documents.map(file=>file.file_name).join(", ")}`:"",
      `Todos los recursos originales están vinculados desde Solicitudes 360 (${item.reference}).`
    ].filter(Boolean).join("\n\n");
  }
  async function createTaskFromRequest(item){
    const c=client();if(!item||!c)return;
    if(item.converted_task_id){openLinkedTask(item.converted_task_id);return}
    const button=$("req360CreateTask"),title=$("req360TaskTitle")?.value.trim(),assigned=$("req360TaskAssignee")?.value,due=$("req360TaskDue")?.value||null,priority=$("req360TaskPriority")?.value||"media";
    if(!title){window.premiumToast?.("Falta el título","Escribe el nombre de la tarea.","error");return}
    if(!assigned){window.premiumToast?.("Falta el responsable","Selecciona quién realizará la tarea.","error");return}
    if(!due){window.premiumToast?.("Falta la fecha","Define la fecha de entrega de la tarea.","error");return}
    const assignee=rows(appState().members).find(person=>String(person.id)===String(assigned));
    if(!assignee){window.premiumToast?.("Responsable no disponible","Actualiza la plataforma y vuelve a seleccionarlo.","error");return}
    if(button){button.disabled=true;button.textContent="Creando tarea y vinculando referencias…"}
    try{
      const before=new Set(rows(appState().tasks).map(task=>String(task.id)));
      const response=await c.rpc("ibm_v30_create_task",{
        p_title:title,
        p_description:taskDescription(item),
        p_assigned_to:assigned,
        p_client_id:null,
        p_area_id:assignee.area_id||currentMember()?.area_id||null,
        p_campaign_id:null,
        p_due_date:due,
        p_due_time:null,
        p_priority:priority,
        p_impact:3,
        p_checklist:[]
      });
      if(response.error)throw response.error;
      const returnedId=createdTaskIdFrom(response.data);
      const created=await waitForCreatedTask({before,id:returnedId,title,assigned,due});
      if(!created)throw new Error("Supabase recibió la creación, pero la tarea no apareció en Trabajo 360. No se vinculó el requerimiento para evitar una asociación incorrecta.");
      const patch={converted_task_id:created.id,assigned_to:assigned,internal_priority:priority,status:"in_production",updated_at:new Date().toISOString()};
      const linked=await c.from("interarea_requests").update(patch).eq("id",item.id).select().single();
      if(linked.error)throw new Error(`La tarea se creó, pero no se pudo vincular con el requerimiento: ${linked.error.message}`);
      await c.from("interarea_request_updates").insert({
        request_id:item.id,
        status:"in_production",
        message:`Tarea “${created.title||title}” creada y asignada a ${assignee.full_name}. Los audios, documentos y enlaces originales quedaron vinculados.`,
        visibility:"internal",
        created_by:currentMember()?.id||null
      });
      Object.assign(item,linked.data||patch);
      upsertRequest(item,{prepend:false});
      window.dispatchEvent(new CustomEvent("inbestiga:task-created",{detail:{taskId:created.id,source:"requests360",requestId:item.id,assignees:[assigned]}}));
      window.premiumToast?.("Tarea creada y vinculada",`${assignee.full_name} recibió la tarea con todas las referencias del requerimiento.`,"success");
      close();
      window.navTo?.("tasks");
      setTimeout(()=>window.v412OpenTask?.(created.id),180);
    }catch(error){
      window.premiumToast?.("No se pudo crear la tarea",String(error.message||error),"error");
    }finally{
      if(button){button.disabled=false;button.textContent="Crear tarea y adjuntar todo"}
    }
  }
  function openLinkedTask(taskId){
    if(!taskId)return;
    close();window.navTo?.("tasks");setTimeout(()=>window.v412OpenTask?.(taskId),160);
  }
  async function copySummary(item){const text=`${item.reference}\n${item.title}\nSolicitante: ${item.requester_name} · ${item.requester_area}\nTipo: ${item.request_type}\nEstado: ${statusLabels[item.status]||item.status}\nFecha solicitada: ${item.needed_by||"sin fecha"}\n\n${item.description}`;try{await navigator.clipboard.writeText(text);window.premiumToast?.("Resumen copiado",item.reference,"success")}catch{}}
  function bind(){const map={req360Search:"search",req360Status:"status",req360Area:"area",req360Type:"type"};Object.entries(map).forEach(([id,key])=>{const el=$(id);if(!el||el.dataset.bound)return;el.dataset.bound="1";el.addEventListener(el.tagName==="INPUT"?"input":"change",()=>{local.filters[key]=el.value;render()})});if($("req360Refresh")&&!$("req360Refresh").dataset.bound){$("req360Refresh").dataset.bound="1";$("req360Refresh").onclick=()=>load({force:true})}if($("req360CheckReception")&&!$("req360CheckReception").dataset.bound){$("req360CheckReception").dataset.bound="1";$("req360CheckReception").onclick=()=>checkReception()}}
  async function renderSection(){bind();await load({force:true})}
  function renderInitialOptions(){const area=$("req360Area"),type=$("req360Type");if(area&&area.options.length<=1){const values=[...new Set(local.requests.map(item=>item.requester_area).filter(Boolean))].sort();area.innerHTML='<option value="">Todas las áreas</option>'+values.map(value=>`<option>${esc(value)}</option>`).join("")}if(type&&type.options.length<=1){const values=[...new Set(local.requests.map(item=>item.request_type).filter(Boolean))].sort();type.innerHTML='<option value="">Todos los tipos</option>'+values.map(value=>`<option>${esc(value)}</option>`).join("")}}
  const originalRender=window.v412RenderSection;
  if(typeof originalRender==="function"&&!originalRender.__requests360Wrapped){const wrapped=function(id){if(id==="requests360")return renderSection();return originalRender.apply(this,arguments)};wrapped.__requests360Wrapped=true;wrapped.__requests360Base=originalRender;window.v412RenderSection=wrapped}
  function subscribe(){const c=client();if(!c||local.channel)return;receptionState("checking","Conectando recepción…","Preparando el canal de nuevos requerimientos.");try{local.channel=c.channel("requests360-live-v17163").on("postgres_changes",{event:"INSERT",schema:"public",table:"interarea_requests"},payload=>{const item=payload.new;if(item.status==="draft")return;upsertRequest(item);local.loaded=true;setBadge();renderInitialOptions();render();notifyRequest(item)}).on("postgres_changes",{event:"UPDATE",schema:"public",table:"interarea_requests"},payload=>{const item=payload.new,known=!!requestById(item.id),becameVisible=item.status!=="draft"&&(!known||payload.old?.status==="draft");if(item.status==="draft")return;upsertRequest(item);local.loaded=true;setBadge();renderInitialOptions();render();if(becameVisible)notifyRequest(item)}).subscribe(status=>{local.realtimeReady=status==="SUBSCRIBED";if(status==="SUBSCRIBED")receptionState("connected","Recepción en tiempo real activa","Los nuevos requerimientos aparecerán inmediatamente.");else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))receptionState("error","Canal de recepción interrumpido","Pulsa Comprobar recepción para reconectar.");else receptionState("checking","Conectando recepción…",String(status||"Preparando canal"))})}catch(error){receptionState("error","No se pudo conectar Realtime",error.message);console.info("Solicitudes 360 realtime opcional",error.message)}}
  function requestScore(item,query){const q=String(query||"").toLowerCase();let score=0;for(const value of [item.reference,item.title,item.requester_name,item.requester_area,item.request_type])if(value&&q.includes(String(value).toLowerCase()))score+=3;if(/nuevo|nuevos|llegaron|hoy/.test(q)&&item.status==="new")score+=2;return score}
  async function sakuraDigest({query="",limit=6}={}){await load({force:!local.loaded,silent:true});let list=[...local.requests].filter(item=>item.status!=="draft");const q=String(query||"").toLowerCase();if(/hoy/.test(q)){const day=new Date().toISOString().slice(0,10);list=list.filter(item=>String(item.submitted_at||item.created_at).slice(0,10)===day)}if(/nuevo|nuevos|llegaron/.test(q))list=list.filter(item=>item.status==="new");list.sort((a,b)=>requestScore(b,q)-requestScore(a,q)||String(b.submitted_at||b.created_at).localeCompare(String(a.submitted_at||a.created_at)));list=list.slice(0,limit);if(!list.length)return{markup:"",text:"No hay requerimientos que coincidan con esa consulta."};const markup=`<div class="sk-request-digest"><div class="sk-request-head"><div><h4>Solicitudes 360</h4><p>${list.filter(item=>item.status==="new").length} nuevas en esta vista</p></div><span class="sk-request-count">${list.length}</span></div>${list.map(item=>`<article class="sk-request-card"><strong>${esc(item.title)}</strong><span>${esc(item.requester_name)} · ${esc(item.requester_area)} · ${esc(statusLabels[item.status]||item.status)}</span><div class="sk-request-actions"><button class="primary" data-sk-open-request="${esc(item.id)}">Abrir requerimiento</button><button class="secondary" data-sk-copy-request="${esc(item.id)}">Copiar título</button></div></article>`).join("")}</div>`;return{markup,text:`Encontré ${list.length} requerimiento(s).`}}
  async function sakuraSummary(query=""){await load({force:!local.loaded,silent:true});const q=String(query||"").toLowerCase();const item=[...local.requests].sort((a,b)=>requestScore(b,q)-requestScore(a,q))[0];if(!item)return"No encontré un requerimiento autorizado que coincida.";return`${item.reference}: “${item.title}”. Lo solicitó ${item.requester_name}, del área ${item.requester_area}. Estado: ${statusLabels[item.status]||item.status}. ${item.needed_by?`Lo necesita para ${dateLabel(item.needed_by)}.`:"No indicó fecha."} Explicación: ${item.description}`}
  async function openFromSakura(id){if(!local.loaded)await load({silent:true});if(!requestById(id))return false;if(document.documentElement.dataset.sakuraPanelOpen==="true")document.querySelector("#sakuraNativePanel .sk-close")?.click?.();window.navTo?.("requests360");setTimeout(()=>open(id),160);return true}
  function init(){bind();load({silent:true}).then(()=>{renderInitialOptions();checkReception({toast:false})});subscribe();if(document.documentElement.dataset.requests360VisibilityHooks!=="1"){document.documentElement.dataset.requests360VisibilityHooks="1";let lastRefresh=0;const refreshMissed=()=>{if(document.hidden||Date.now()-lastRefresh<15000)return;lastRefresh=Date.now();load({force:true,silent:true}).then(()=>checkReception({toast:false}))};window.addEventListener("focus",refreshMissed,{passive:true});document.addEventListener("visibilitychange",refreshMissed,{passive:true})}try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"public-intake-internal-dashboard-realtime-notifications",polling:false,realtimeChannels:1,mutationObservers:0,backendChanges:true})}catch{}}
  window.INBESTIGA_REQUESTS_360=Object.freeze({
    version:VERSION,
    load,
    render:renderSection,
    open,
    openFromSakura,
    sakuraDigest,
    sakuraSummary,
    checkReception,
    getTaskResources,
    openLinkedTask,
    requests:()=>[...local.requests],
    attachments:()=>[...local.attachments]
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
  window.addEventListener("inbestiga:authenticated-ui-ready",init,{once:true});
})();
