/* ===== v15.0 COLLABORATION & CAMPAIGN OS ===== */
(function(){
  "use strict";
  const VERSION="v15.0";
  const SELECT_KEY="inbestiga:v15:selected-campaign";
  const TAB_KEY="inbestiga:v15:campaign-tab";
  let notificationFilter="all";
  let notificationQuery="";
  function sameId(a,b){return String(a??"")===String(b??"")}
  function list(value){return Array.isArray(value)?value:[]}
  function statusKey(value){return typeof v412StatusKey==="function"?v412StatusKey(value):String(value||"").toLowerCase().replaceAll(" ","_")}
  function statusLabel(value){return typeof v66StatusLabel==="function"?v66StatusLabel(value):String(value||"Sin estado").replaceAll("_"," ")}
  function done(task){return typeof v412TaskDone==="function"?v412TaskDone(task):["aprobado","publicado","finalizado","completado"].includes(statusKey(task?.status))}
  function dateLabel(value){if(!value)return"Sin fecha";try{return new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"})}catch{return String(value)}}
  function dateTime(value){if(!value)return"";try{return new Date(value).toLocaleString("es-PE",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}catch{return""}}
  function campaignList(){return list(state?.campaigns).slice().sort((a,b)=>{const ad=["finalizada","cancelada","archivada"].includes(statusKey(a.status)),bd=["finalizada","cancelada","archivada"].includes(statusKey(b.status));if(ad!==bd)return ad?1:-1;return String(b.updated_at||b.created_at||"").localeCompare(String(a.updated_at||a.created_at||""))})}
  function selectedCampaignId(){const campaigns=campaignList();let id="";try{id=localStorage.getItem(SELECT_KEY)||""}catch{}if(!campaigns.some(c=>sameId(c.id,id)))id=campaigns[0]?.id||"";return id}
  function selectedTab(){let tab="overview";try{tab=localStorage.getItem(TAB_KEY)||tab}catch{}return ["overview","tasks","brief","calendar","assets","creative"].includes(tab)?tab:"overview"}
  function setSelectedCampaign(id){try{localStorage.setItem(SELECT_KEY,String(id||""))}catch{}renderCampaignWorkspace()}
  function setTab(tab){try{localStorage.setItem(TAB_KEY,tab)}catch{}renderCampaignWorkspace()}
  function campaignModel(campaign){
    const id=campaign?.id;
    const tasks=list(state?.tasks).filter(t=>sameId(t.campaign_id,id));
    const briefs=list(state?.briefs).filter(b=>sameId(b.campaign_id,id));
    const editorial=list(state?.editorial).filter(e=>sameId(e.campaign_id,id));
    const assets=list(state?.assets).filter(a=>sameId(a.campaign_id,id));
    const rooms=list(state?.cr_rooms).filter(r=>sameId(r.campaign_id,id)||sameId(r.board_state?.campaign_id,id));
    const open=tasks.filter(t=>!done(t));
    const finished=tasks.filter(done);
    const todayKey=typeof today==="function"?today():new Date().toLocaleDateString("en-CA");
    const late=open.filter(t=>typeof v412TaskOverdue==="function"?v412TaskOverdue(t,todayKey):(t.due_date&&t.due_date<todayKey));
    const review=tasks.filter(t=>["en_revision","observado","corregido"].includes(statusKey(t.status)));
    const teamIds=[...new Set(tasks.map(t=>String(t.assigned_to||"")).filter(Boolean))];
    const team=teamIds.map(id=>typeof by==="function"?by(state.members,id):list(state.members).find(m=>sameId(m.id,id))).filter(Boolean);
    const progress=tasks.length?Math.round(finished.length*100/tasks.length):0;
    const activity=[
      ...tasks.map(t=>({date:t.updated_at||t.created_at,title:t.title||"Tarea",meta:`Tarea · ${statusLabel(t.status)}`,kind:"task",id:t.id})),
      ...editorial.map(e=>({date:e.updated_at||e.created_at||e.publish_date||e.date,title:e.title||"Publicación",meta:`Editorial · ${statusLabel(e.status)}`,kind:"editorial",id:e.id})),
      ...assets.map(a=>({date:a.updated_at||a.created_at,title:a.name||"Archivo",meta:`Archivo · ${a.file_type||"recurso"}`,kind:"asset",id:a.id}))
    ].filter(x=>x.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
    return{campaign,tasks,briefs,editorial,assets,rooms,open,finished,late,review,team,progress,activity};
  }
  function ensureCampaignWorkspace(){
    if($("v15CampaignWorkspace"))return $("v15CampaignWorkspace");
    const anchor=$("v413Portfolio");if(!anchor)return null;
    const section=document.createElement("section");section.id="v15CampaignWorkspace";section.className="v15-campaign-os";
    section.innerHTML=`<div class="v15-campaign-head"><div><span class="v413-eyebrow">CAMPAIGN OPERATING SYSTEM</span><h2>Todo el proyecto, en un solo espacio.</h2><p>Brief, tareas, calendario, entregables y Creative Arena conectados sin modificar la estructura productiva.</p></div><div class="v15-campaign-actions"><button type="button" data-v15-campaign-action="detail">Abrir detalle</button><button type="button" data-v15-campaign-action="task" class="primary">Nueva tarea</button><button type="button" data-v15-campaign-action="board">Nueva pizarra</button></div></div><div class="v15-campaign-selector"><label>Campaña activa<select id="v15CampaignSelect"></select></label><div id="v15CampaignSnapshot" class="v15-campaign-snapshot"></div></div><div id="v15CampaignTabs" class="v15-tabbar"></div><div id="v15CampaignBody" class="v15-workspace-body"></div>`;
    anchor.insertAdjacentElement("afterend",section);
    section.addEventListener("click",event=>{const button=event.target.closest("[data-v15-campaign-action],[data-v15-tab],[data-v15-task],[data-v15-room]");if(!button)return;const campaignId=selectedCampaignId();if(button.dataset.v15Tab)return setTab(button.dataset.v15Tab);const action=button.dataset.v15CampaignAction;if(action==="detail")return typeof v413OpenCampaign==="function"?v413OpenCampaign(campaignId):homeOpenCampaign(campaignId);if(action==="task")return typeof v66QuickTaskModal==="function"?v66QuickTaskModal(campaignId):navTo("tasks");if(action==="board"){if(typeof v66QuickBoardModal==="function"){v66QuickBoardModal();setTimeout(()=>{const select=$("v66BoardCampaign");if(select)select.value=campaignId},20)}else navTo("creativeRoomsClean");return}if(action==="brief"){if(typeof v413ShowCampaignForms==="function")v413ShowCampaignForms();const select=$("briefCampaign");if(select)select.value=campaignId;$("briefTitle")?.focus();return}if(action==="editorial"){navTo("editorial");setTimeout(()=>{const select=$("edCampaign");if(select)select.value=campaignId},30);return}if(action==="assets"){navTo("assets");setTimeout(()=>{const select=$("assetCampaign");if(select)select.value=campaignId},30);return}if(action==="creative")return navTo("creativeRoomsClean");if(button.dataset.v15Task){const id=button.dataset.v15Task,taskAction=button.dataset.v15TaskAction||"open";if(typeof homeQuickTaskAction==="function")return homeQuickTaskAction(id,taskAction);return v412OpenTask(id)}if(button.dataset.v15Room){navTo("creativeRoomsClean");setTimeout(()=>window.CreativeArenaClean?.openBoard?.(button.dataset.v15Room),70)}});
    section.querySelector("#v15CampaignSelect")?.addEventListener("change",e=>setSelectedCampaign(e.target.value));
    return section;
  }
  function renderOverview(model){
    const c=model.campaign,client=typeof nameOf==="function"?nameOf(state.clients,c.client_id):"";
    const health=[
      {tone:model.late.length?"danger":"",title:"Vencimientos",meta:model.late.length?"Requieren nueva decisión o fecha":"Sin tareas vencidas",value:model.late.length},
      {tone:model.review.length?"warning":"",title:"Revisión",meta:model.review.length?"Entregas esperando validación":"Sin entregas bloqueadas",value:model.review.length},
      {tone:!model.tasks.length?"warning":"",title:"Plan de trabajo",meta:model.tasks.length?`${model.open.length} tareas todavía abiertas`:"La campaña aún no tiene tareas",value:model.tasks.length},
      {tone:!model.briefs.length?"warning":"",title:"Brief",meta:model.briefs.length?"Contexto creativo registrado":"Conviene registrar el brief",value:model.briefs.length}
    ];
    const team=model.team.length?model.team.map(m=>`<span class="v15-team-chip"><i>${esc((m.full_name||"?").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase())}</i>${esc(m.full_name||"Miembro")}</span>`).join(""):'<span class="small">Aún no hay responsables vinculados.</span>';
    const activity=model.activity.length?model.activity.map(item=>`<div class="v15-timeline-item"><time>${esc(dateTime(item.date))}</time><i></i><div><strong>${esc(item.title)}</strong><span>${esc(item.meta)}</span></div></div>`).join(""):'<div class="v15-empty">Todavía no existe actividad registrada en esta campaña.</div>';
    return `<div class="v15-overview-grid"><article class="v15-feature"><div class="v15-feature-copy"><div><span class="v413-eyebrow">${esc(statusLabel(c.status||"planificación"))}</span><h3>${esc(c.name||"Campaña")}</h3><p>${esc(c.objective||c.main_message||"Añade un objetivo claro para convertir esta campaña en una historia operativa completa.")}</p></div><div class="v15-feature-meta"><span>${esc(client||"Sin cliente")}</span><span>${esc(dateLabel(c.start_date))} → ${esc(dateLabel(c.end_date))}</span><span>${model.team.length} miembro${model.team.length===1?"":"s"}</span></div></div></article><aside class="v15-side-panel"><h3>Salud de campaña</h3>${health.map(h=>`<div class="v15-health-row ${h.tone}"><i></i><div><strong>${esc(h.title)}</strong><span>${esc(h.meta)}</span></div><b>${h.value}</b></div>`).join("")}<div><div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:7px"><strong>Avance total</strong><b>${model.progress}%</b></div><div class="v15-progress-track"><i style="width:${model.progress}%"></i></div></div></aside></div><div class="v15-overview-grid" style="margin-top:14px"><article class="v15-panel"><h3>Equipo conectado</h3><div class="v15-team-chips" style="margin-top:12px">${team}</div></article><article class="v15-panel"><h3>Actividad reciente</h3><div class="v15-timeline" style="margin-top:10px">${activity}</div></article></div>`;
  }
  function renderTasksTab(model){
    if(!model.tasks.length)return '<div class="v15-empty">Esta campaña todavía no tiene tareas.<br><button type="button" data-v15-campaign-action="task" class="primary" style="margin-top:12px">Crear primera tarea</button></div>';
    const rows=model.tasks.slice().sort((a,b)=>String(a.due_date||"9999").localeCompare(String(b.due_date||"9999"))).map(t=>{const own=sameId(t.assigned_to,member?.id);return`<article class="v15-row"><div><strong>${esc(t.title||"Tarea")}</strong><span>${esc(memberName(t.assigned_to))} · ${esc(dateLabel(t.due_date))} · ${esc(statusLabel(t.status))}</span></div><div class="v15-row-actions"><button type="button" data-v15-task="${esc(t.id)}" data-v15-task-action="open">Abrir</button>${own&&!done(t)?`<button type="button" data-v15-task="${esc(t.id)}" data-v15-task-action="progress">Progreso</button><button type="button" class="primary" data-v15-task="${esc(t.id)}" data-v15-task-action="deliver">Entregar tarea</button>`:""}</div></article>`}).join("");
    return `<div class="v15-panel"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px"><h3>Tareas de campaña</h3><div class="v15-inline-actions"><button type="button" data-v15-campaign-action="task" class="primary">Nueva tarea</button></div></div><div class="v15-list">${rows}</div></div>`;
  }
  function renderBriefTab(model){
    if(!model.briefs.length)return '<div class="v15-empty">Aún no existe un brief vinculado.<br><button type="button" data-v15-campaign-action="brief" class="primary" style="margin-top:12px">Crear brief</button></div>';
    return `<div class="v15-info-grid">${model.briefs.map(b=>`<article class="v15-info-card"><span>BRIEF</span><strong>${esc(b.title||"Brief de campaña")}</strong><p>${esc(b.objective||"Sin objetivo registrado")}</p><p><b>Público:</b> ${esc(b.audience||"Sin definir")}</p><p><b>Entregables:</b> ${esc(b.deliverables||"Sin definir")}</p></article>`).join("")}</div>`;
  }
  function renderCalendarTab(model){
    const entries=[];const c=model.campaign;
    if(c.start_date)entries.push({date:c.start_date,title:"Inicio de campaña",meta:c.name});
    if(c.end_date)entries.push({date:c.end_date,title:"Cierre de campaña",meta:c.name});
    model.tasks.forEach(t=>{if(t.due_date)entries.push({date:t.due_date,title:t.title,meta:`Tarea · ${statusLabel(t.status)}`})});
    model.editorial.forEach(e=>{const date=e.publish_date||e.date||e.scheduled_date;if(date)entries.push({date,title:e.title||"Publicación",meta:`Editorial · ${e.platform||"contenido"}`})});
    entries.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    return `<div class="v15-panel"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px"><h3>Cronología operativa</h3><div class="v15-inline-actions"><button type="button" data-v15-campaign-action="editorial">Agregar publicación</button></div></div><div class="v15-timeline">${entries.length?entries.map(e=>`<div class="v15-timeline-item"><time>${esc(dateLabel(e.date))}</time><i></i><div><strong>${esc(e.title)}</strong><span>${esc(e.meta||"")}</span></div></div>`).join(""):'<div class="v15-empty">No hay fechas operativas registradas.</div>'}</div></div>`;
  }
  function renderAssetsTab(model){
    if(!model.assets.length)return '<div class="v15-empty">Aún no existen entregables o archivos vinculados.<br><button type="button" data-v15-campaign-action="assets" style="margin-top:12px">Subir archivo</button></div>';
    return `<div class="v15-list">${model.assets.map(a=>`<article class="v15-row"><div><strong>${esc(a.name||"Archivo")}</strong><span>${esc(a.file_type||"recurso")} · ${esc(statusLabel(a.approval_status||a.status||"pendiente"))}</span></div><div class="v15-row-actions"><button type="button" data-v15-campaign-action="assets">Abrir archivos</button></div></article>`).join("")}</div>`;
  }
  function renderCreativeTab(model){
    const rooms=model.rooms.map(r=>{const key=r.board_key||r.key||r.id;return`<article class="v15-row"><div><strong>${esc(r.title||r.name||"Pizarra creativa")}</strong><span>${esc(dateTime(r.updated_at||r.created_at)||"Espacio de campaña")}</span></div><div class="v15-row-actions"><button type="button" class="primary" data-v15-room="${esc(key)}">Abrir pizarra</button></div></article>`}).join("");
    return `<div class="v15-panel"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px"><h3>Creative Arena</h3><div class="v15-inline-actions"><button type="button" data-v15-campaign-action="board" class="primary">Nueva pizarra</button><button type="button" data-v15-campaign-action="creative">Abrir Arena</button></div></div>${rooms?`<div class="v15-list">${rooms}</div>`:'<div class="v15-empty">No se detectaron pizarras vinculadas en el bootstrap actual. Puedes crear una nueva sin alterar las existentes.</div>'}</div>`;
  }
  function renderCampaignWorkspace(){
    const root=ensureCampaignWorkspace();if(!root)return;
    const campaigns=campaignList(),select=$("v15CampaignSelect"),id=selectedCampaignId(),campaign=campaigns.find(c=>sameId(c.id,id));
    if(select){select.innerHTML=campaigns.map(c=>`<option value="${esc(c.id)}">${esc(c.name||"Campaña")} · ${esc(statusLabel(c.status||"planificación"))}</option>`).join("")||'<option value="">Sin campañas</option>';select.value=id}
    if(!campaign){$("v15CampaignSnapshot").innerHTML="";$("v15CampaignTabs").innerHTML="";$("v15CampaignBody").innerHTML='<div class="v15-empty">Crea una campaña para activar el espacio integral.</div>';return}
    const model=campaignModel(campaign),snapshot=[["AVANCE",`${model.progress}%`,`${model.finished.length}/${model.tasks.length} tareas`],["VENCIDAS",model.late.length,"requieren atención"],["ENTREGABLES",model.assets.length,"archivos vinculados"],["PUBLICACIONES",model.editorial.length,"piezas editoriales"]];
    $("v15CampaignSnapshot").innerHTML=snapshot.map(x=>`<article class="v15-snapshot-card"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join("");
    const tabs=[["overview","Resumen"],["tasks","Tareas"],["brief","Brief"],["calendar","Cronología"],["assets","Archivos"],["creative","Creative Arena"]],tab=selectedTab();
    $("v15CampaignTabs").innerHTML=tabs.map(([key,label])=>`<button type="button" data-v15-tab="${key}" class="${key===tab?"active":""}">${label}</button>`).join("");
    const renderers={overview:renderOverview,tasks:renderTasksTab,brief:renderBriefTab,calendar:renderCalendarTab,assets:renderAssetsTab,creative:renderCreativeTab};
    $("v15CampaignBody").innerHTML=(renderers[tab]||renderOverview)(model);
  }
  function notificationRows(){
    const rows=[];
    list(state?.notifications).forEach(n=>rows.push({id:`n:${n.id}`,type:String(n.entity_type||"system").toLowerCase(),title:n.title||"Notificación",body:n.body||"",date:n.created_at,unread:!n.read_at,entityId:n.entity_id||n.related_id||"",source:"notification",icon:"N"}));
    list(state?.messages).filter(m=>sameId(m.recipient_id||m.receiver_id,member?.id)).forEach(m=>{const sender=typeof by==="function"?by(state.members,m.sender_id):list(state.members).find(x=>sameId(x.id,m.sender_id));rows.push({id:`m:${m.id}`,type:"message",title:sender?.full_name||"Mensaje directo",body:m.text_content||"",date:m.created_at,unread:!m.read_at,entityId:m.sender_id,source:"message",icon:"M"})});
    list(state?.tasks).filter(t=>sameId(t.assigned_to,member?.id)&&(["observado","en_revision","corregido"].includes(statusKey(t.status))||(typeof v412TaskOverdue==="function"?v412TaskOverdue(t):(!done(t)&&t.due_date&&t.due_date<today())))).forEach(t=>rows.push({id:`t:${t.id}`,type:"task",title:t.title||"Tarea",body:`${statusLabel(t.status)} · ${dateLabel(t.due_date)}`,date:t.updated_at||t.created_at,unread:statusKey(t.status)==="observado",entityId:t.id,source:"task",icon:"T"}));
    return rows.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  }
  function ensureNotificationCenter(){
    const section=$("notifications"),listHost=$("notificationList");if(!section||!listHost)return null;
    let center=$("v15NotificationCenter");if(center)return center;
    center=document.createElement("div");center.id="v15NotificationCenter";center.className="v15-notification-center";
    center.innerHTML=`<div class="v15-notif-toolbar"><div class="v15-notif-search"><input id="v15NotifSearch" placeholder="Buscar mensajes, tareas o alertas"><select id="v15NotifFilter"><option value="all">Todo</option><option value="unread">Sin leer</option><option value="message">Mensajes</option><option value="task">Tareas</option><option value="campaign">Campañas</option><option value="system">Sistema</option></select></div><div class="v15-notif-meta"><button type="button" data-v15-notif-command="messages">Abrir mensajes</button><button type="button" data-v15-notif-command="read-messages">Leer mensajes</button></div></div><div id="v15NotifSummary" class="v15-notif-summary"></div><div id="v15NotifList" class="v15-notif-list"></div>`;
    listHost.replaceChildren(center);
    $("v15NotifSearch")?.addEventListener("input",e=>{notificationQuery=String(e.target.value||"").toLowerCase().trim();renderUnifiedNotifications()});
    $("v15NotifFilter")?.addEventListener("change",e=>{notificationFilter=e.target.value;renderUnifiedNotifications()});
    center.addEventListener("click",event=>{const button=event.target.closest("[data-v15-notif],[data-v15-notif-command]");if(!button)return;if(button.dataset.v15NotifCommand==="messages")return navTo("messages");if(button.dataset.v15NotifCommand==="read-messages")return typeof markAllMessagesRead==="function"?markAllMessagesRead():navTo("messages");const row=notificationRows().find(x=>x.id===button.dataset.v15Notif);if(!row)return;if(row.source==="message"){navTo("messages");setTimeout(()=>typeof selectConversation==="function"&&selectConversation(row.entityId),30);return}if(row.source==="task")return v412OpenTask(row.entityId);if(row.type.includes("campaign")&&row.entityId)return typeof v413OpenCampaign==="function"?v413OpenCampaign(row.entityId):navTo("campaigns");if(row.type.includes("task")&&row.entityId)return v412OpenTask(row.entityId);navTo(row.type==="message"?"messages":"notifications")});
    return center;
  }
  function renderUnifiedNotifications(){
    if(!ensureNotificationCenter())return;
    const all=notificationRows(),unread=all.filter(x=>x.unread),messages=all.filter(x=>x.type==="message"),tasks=all.filter(x=>x.type==="task"||x.type.includes("task")),campaigns=all.filter(x=>x.type.includes("campaign"));
    $("v15NotifSummary").innerHTML=[["SIN LEER",unread.length],["MENSAJES",messages.length],["TAREAS",tasks.length],["CAMPAÑAS",campaigns.length]].map(x=>`<article><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join("");
    let rows=all;if(notificationFilter==="unread")rows=rows.filter(x=>x.unread);else if(notificationFilter!=="all")rows=rows.filter(x=>x.type===notificationFilter||x.type.includes(notificationFilter));if(notificationQuery)rows=rows.filter(x=>`${x.title} ${x.body} ${x.type}`.toLowerCase().includes(notificationQuery));
    $("v15NotifList").innerHTML=rows.length?rows.slice(0,120).map(row=>`<article class="v15-notif-item ${row.unread?"unread":""}"><div class="v15-notif-icon">${esc(row.icon)}</div><div class="v15-notif-copy"><strong>${esc(row.title)}</strong><span>${esc(row.body)}</span><small>${esc(row.type)} · ${esc(dateTime(row.date))}</small></div><button type="button" data-v15-notif="${esc(row.id)}">Abrir</button></article>`).join(""):'<div class="v15-empty">No hay novedades para el filtro seleccionado.</div>';
  }
  function renderWorkloadEnhancement(){
    const section=$("workload"),grid=$("workloadGrid");if(!section||!grid)return;
    let summary=$("v15WorkloadSummary"),rebalance=$("v15Rebalance");if(!summary){summary=document.createElement("div");summary.id="v15WorkloadSummary";summary.className="v15-workload-summary";grid.insertAdjacentElement("beforebegin",summary)}if(!rebalance){rebalance=document.createElement("section");rebalance.id="v15Rebalance";rebalance.className="v15-rebalance";summary.insertAdjacentElement("afterend",rebalance)}
    const open=list(state?.tasks).filter(t=>!done(t)),todayKey=typeof today==="function"?today():"",members=list(state?.members).filter(m=>m.status!=="inactive"),load=members.map(m=>{const tasks=open.filter(t=>sameId(t.assigned_to,m.id)),late=tasks.filter(t=>typeof v412TaskOverdue==="function"?v412TaskOverdue(t,todayKey):(t.due_date&&t.due_date<todayKey));return{member:m,tasks,late,count:tasks.length}}).sort((a,b)=>b.count-a.count),overloaded=load.filter(x=>x.count>=7),available=load.filter(x=>x.count<=2),unassigned=open.filter(t=>!t.assigned_to);
    summary.innerHTML=[["TAREAS ABIERTAS",open.length,"operación activa"],["SOBRECARGA",overloaded.length,"7 o más tareas"],["DISPONIBLES",available.length,"2 o menos tareas"],["SIN ASIGNAR",unassigned.length,"requieren responsable"]].map(x=>`<article><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join("");
    const suggestions=[];if(overloaded.length&&available.length)suggestions.push({title:`Redistribuir desde ${overloaded[0].member.full_name}`,meta:`${overloaded[0].count} tareas abiertas · ${available[0].member.full_name} tiene ${available[0].count}`,action:"workIntel"});if(unassigned.length)suggestions.push({title:`Asignar ${unassigned.length} tarea${unassigned.length===1?"":"s"} sin responsable`,meta:"Completa dueño y fecha para mejorar la capacidad operativa.",action:"tasks"});if(!suggestions.length)suggestions.push({title:"Carga equilibrada",meta:"No se detectan redistribuciones urgentes con el umbral actual.",action:"workIntel"});
    rebalance.innerHTML=`<h3>Recomendación de capacidad</h3><div class="v15-rebalance-list">${suggestions.map((s,i)=>`<article class="v15-rebalance-row"><div><strong>${esc(s.title)}</strong><span>${esc(s.meta)}</span></div><button type="button" data-v15-rebalance="${i}">Abrir</button></article>`).join("")}</div>`;rebalance.querySelectorAll("[data-v15-rebalance]").forEach((button,i)=>button.addEventListener("click",()=>navTo(suggestions[i].action)));
  }
  function refresh(){try{renderCampaignWorkspace()}catch(error){console.error("[v15] campaign workspace",error)}try{renderUnifiedNotifications()}catch(error){console.error("[v15] notification center",error)}try{renderWorkloadEnhancement()}catch(error){console.error("[v15] workload",error)}}
  const baseCampaigns=typeof renderCampaigns==="function"?renderCampaigns:null;if(baseCampaigns)renderCampaigns=function(){const result=baseCampaigns.apply(this,arguments);renderCampaignWorkspace();return result};
  const baseNotifications=typeof renderNotifications==="function"?renderNotifications:null;if(baseNotifications)renderNotifications=function(){renderUnifiedNotifications()};
  const baseWorkload=typeof renderWorkload==="function"?renderWorkload:null;if(baseWorkload)renderWorkload=function(){const result=baseWorkload.apply(this,arguments);renderWorkloadEnhancement();return result};
  const baseLoadAll=typeof loadAll==="function"?loadAll:null;if(baseLoadAll)loadAll=async function(){const result=await baseLoadAll.apply(this,arguments);setTimeout(refresh,0);return result};
  function init(){ensureCampaignWorkspace();ensureNotificationCenter();refresh();window.INBESTIGA_COLLABORATION_OS={version:VERSION,refresh,campaign:renderCampaignWorkspace,notifications:renderUnifiedNotifications,workload:renderWorkloadEnhancement}}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
