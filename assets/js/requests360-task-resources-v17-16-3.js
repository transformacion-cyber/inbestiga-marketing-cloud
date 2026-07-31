/* INBESTIGA Marketing Cloud v17.16.3 · Request resources inside tasks */
(()=>{
  "use strict";
  if(window.INBESTIGA_REQUESTS_360_TASK_RESOURCES?.version==="v17.16.3")return;
  const VERSION="v17.16.3",MODULE="requests360-task-resources-v17-16-3";
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const kind=file=>{
    const type=String(file?.file_type||file?.mime_type||"").toLowerCase(),name=String(file?.file_name||"").toLowerCase(),declared=String(file?.kind||"").toLowerCase();
    if(declared==="audio"||type.startsWith("audio/")||/\.(webm|m4a|mp3|wav|ogg|aac)$/i.test(name))return"audio";
    if(declared==="image"||type.startsWith("image/"))return"image";
    if(declared==="video"||type.startsWith("video/"))return"video";
    if(declared==="pdf"||type.includes("pdf")||name.endsWith(".pdf"))return"pdf";
    return"document";
  };
  const size=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  function resourceMarkup(file){
    const fileKind=kind(file),icon=fileKind==="audio"?"AUD":fileKind==="image"?"IMG":fileKind==="video"?"VID":fileKind==="pdf"?"PDF":"DOC";
    return`<article class="req360-task-resource ${fileKind}">
      <span class="req360-task-resource-icon">${icon}</span>
      <div><strong>${esc(file.file_name||"Archivo")}</strong><small>${esc(file.file_type||"archivo")} · ${size(Number(file.file_size)||0)}</small>${file.urlError?`<em>${esc(file.urlError)}</em>`:""}</div>
      ${file.url?`<a href="${esc(file.url)}" target="_blank" rel="noopener">Abrir</a>`:""}
      ${fileKind==="audio"&&file.url?`<audio controls preload="metadata"><source src="${esc(file.url)}" type="${esc(file.file_type||"audio/webm")}">Tu navegador no puede reproducir este audio.</audio>`:""}
    </article>`;
  }
  async function inject(taskId){
    const api=window.INBESTIGA_REQUESTS_360;
    if(!api?.getTaskResources)return;
    let bundle;
    try{bundle=await api.getTaskResources(taskId)}catch(error){console.info("[Solicitudes 360] Recursos de tarea",error?.message||error);return}
    if(!bundle?.request)return;
    const host=document.querySelector("#premiumModalBody .v66-task-detail");
    if(!host)return;
    host.querySelector(".req360-task-source")?.remove();
    const section=document.createElement("section");
    section.className="v66-detail-section req360-task-source";
    const request=bundle.request,files=bundle.files||[],links=bundle.links||[];
    section.innerHTML=`
      <div class="v66-detail-section-head">
        <div><span>SOLICITUDES 360 · ${esc(request.reference)}</span><h4>Referencias originales del solicitante</h4></div>
        <b>${files.length+links.length}</b>
      </div>
      <div class="req360-task-source-meta"><strong>${esc(request.requester_name)}</strong><span>${esc(request.requester_area)} · ${esc(request.request_type)}</span><p>${esc(request.description)}</p></div>
      ${files.length?`<div class="req360-task-resource-list">${files.map(resourceMarkup).join("")}</div>`:'<div class="v66-empty-inline">No se adjuntaron archivos.</div>'}
      ${links.length?`<div class="req360-task-link-list">${links.map(link=>`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer"><span>ENLACE</span><strong>${esc(link)}</strong><b>Abrir ↗</b></a>`).join("")}</div>`:""}`;
    const dock=host.querySelector(".v66-action-dock");
    if(dock)dock.insertAdjacentElement("beforebegin",section);
    else host.appendChild(section);
  }
  function install(){
    const base=window.v412OpenTask;
    if(typeof base!=="function"||base.__requests360ResourcesWrapped)return false;
    const wrapped=function(id,...args){
      const result=base.call(this,id,...args);
      setTimeout(()=>inject(id),120);
      return result;
    };
    wrapped.__requests360ResourcesWrapped=true;
    wrapped.__requests360ResourcesBase=base;
    window.v412OpenTask=wrapped;
    return true;
  }
  function init(){
    install();
    window.addEventListener("inbestiga:authenticated-ui-ready",install,{once:true});
    try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"request-resources-inside-task",polling:false,realtimeChannels:0,mutationObservers:0,backendChanges:false})}catch{}
  }
  window.INBESTIGA_REQUESTS_360_TASK_RESOURCES=Object.freeze({version:VERSION,inject,install});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
