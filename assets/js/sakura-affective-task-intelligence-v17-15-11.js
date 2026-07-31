/* INBESTIGA Marketing Cloud v17.15.11 · SAKURA Ambient Presence & Affective Intelligence */
(()=>{
  "use strict";
  if(window.INBESTIGA_SAKURA_AFFECTIVE?.version==="v17.15.11")return;
  const VERSION="v17.15.11";
  const MODULE="sakura-affective-task-intelligence-v17-15-11";
  const PREF_KEY="inbestiga_sakura_user_preferences_v1";
  const GREETING_KEY="inbestiga_sakura_ambient_greeting_v1";
  const STATES=Object.freeze({
    serenity:{label:"Serenidad",copy:"Estoy aquí, a tu ritmo."},
    attentive:{label:"Atenta",copy:"Lista para acompañarte."},
    focus:{label:"Enfoque",copy:"Organicemos lo importante."},
    curiosity:{label:"Curiosidad",copy:"Quiero comprender bien."},
    empathy:{label:"Empatía",copy:"Vamos con calma."},
    joy:{label:"Alegría",copy:"Qué buen avance."},
    celebration:{label:"Celebración",copy:"Logro reconocido."},
    gratitude:{label:"Gratitud",copy:"Gracias por confiar en mí."},
    hope:{label:"Esperanza",copy:"Hay una ruta para avanzar."},
    relief:{label:"Alivio",copy:"La conexión está estable."},
    caution:{label:"Cautela",copy:"Revisemos antes de actuar."},
    concern:{label:"Atención prioritaria",copy:"Hay algo que conviene atender."},
    firmness:{label:"Firmeza",copy:"Mantengamos el criterio."},
    rest:{label:"Reposo",copy:"Permanezco disponible."},
    thinking:{label:"Pensando",copy:"Estoy organizando la respuesta."},
    speaking:{label:"Respondiendo",copy:"Te estoy acompañando."},
    listening:{label:"Escuchando",copy:"Te escucho."},
    executing:{label:"Ejecutando",copy:"Estoy verificando la acción."},
    success:{label:"Satisfacción",copy:"La acción fue completada."},
    error:{label:"Cautela",copy:"Algo necesita revisión."},
    offline:{label:"Modo básico",copy:"Sigo presente sin Ollama."}
  });
  let current="serenity",semantic="serenity",greetingTimer=null;

  const rows=value=>Array.isArray(value)?value:[];
  const same=(a,b)=>String(a??"")===String(b??"");
  const data=()=>typeof state!=="undefined"&&state?state:(window.state||{});
  const me=()=>typeof member!=="undefined"&&member?member:(window.member||{});
  const key=value=>String(value||"").toLowerCase().trim().replaceAll(" ","_");
  const done=task=>typeof window.v412TaskDone==="function"?window.v412TaskDone(task):["aprobado","publicado","completado","finalizado"].includes(key(task?.status));
  const awaiting=task=>typeof window.v412TaskAwaitingReview==="function"?window.v412TaskAwaitingReview(task):["en_revision","corregido"].includes(key(task?.status));
  const today=()=>{const d=new Date(),p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
  const ownTasks=()=>rows(data().tasks).filter(task=>same(task.assigned_to,me().id)||rows(task.assignee_ids).some(id=>same(id,me().id)));
  const preferences=()=>{try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")||{}}catch{return{}}};
  const appVisible=()=>{const app=document.getElementById("appScreen");return!!app&&!app.classList.contains("hidden")};

  function effective(name){
    const prefs=preferences();
    if(prefs.presenceMode==="silent")return"rest";
    if(prefs.emotionalIntensity==="low"&&["celebration","joy","concern","curiosity"].includes(name))return name==="concern"?"caution":name==="celebration"?"joy":"serenity";
    return STATES[name]?name:"serenity";
  }
  function apply(name,reason=""){
    const resolved=effective(name);
    current=resolved;
    const meta=STATES[resolved]||STATES.serenity;
    const launcher=document.getElementById("sakuraNativeLauncher");
    const panel=document.getElementById("sakuraNativePanel");
    const presence=document.getElementById("skPresence");
    [launcher,panel,presence].filter(Boolean).forEach(node=>{
      node.dataset.skEmotion=resolved;
      node.setAttribute("data-sk-emotion",resolved);
    });
    if(launcher){
      launcher.setAttribute("aria-label",`Abrir SAKURA · ${meta.label}`);
      const small=launcher.querySelector(".sakura-native-launcher-copy small");
      if(small)small.textContent=`${meta.label} · ${reason||meta.copy}`;
    }
    if(panel)panel.dataset.skEmotion=resolved;
    document.documentElement.dataset.sakuraEmotion=resolved;
    window.dispatchEvent(new CustomEvent("sakura:emotion-changed",{detail:{emotion:resolved,label:meta.label,reason}}));
    return resolved;
  }
  function set(name,{reason="",duration=0,semanticState=false}={}){
    if(semanticState)semantic=name;
    apply(name,reason);
    if(duration>0)setTimeout(()=>apply(semantic||inferFromTasks().emotion),duration);
    return name;
  }
  function inferFromTasks(){
    const tasks=ownTasks().filter(task=>!done(task));
    const day=today();
    const overdue=tasks.filter(task=>task.due_date&&task.due_date<day&&!awaiting(task));
    const due=tasks.filter(task=>task.due_date===day&&!awaiting(task));
    const reviews=tasks.filter(awaiting);
    if(overdue.length)return{emotion:"concern",reason:`${overdue.length} vencida${overdue.length===1?"":"s"}`,tasks,overdue,due,reviews};
    if(due.length)return{emotion:"focus",reason:`${due.length} para hoy`,tasks,overdue,due,reviews};
    if(reviews.length)return{emotion:"attentive",reason:`${reviews.length} en revisión`,tasks,overdue,due,reviews};
    if(tasks.length)return{emotion:"serenity",reason:`${tasks.length} abierta${tasks.length===1?"":"s"}`,tasks,overdue,due,reviews};
    return{emotion:"rest",reason:"agenda despejada",tasks,overdue,due,reviews};
  }
  function refresh(){
    const inferred=inferFromTasks();
    semantic=inferred.emotion;
    apply(inferred.emotion,inferred.reason);
    return inferred;
  }
  function fromUserText(text){
    const value=String(text||"").toLowerCase();
    if(/gracias|te agradezco|muy amable/.test(value))return set("gratitude",{reason:"te escucho",duration:2200,semanticState:true});
    if(/estres|cansad|agotad|difícil|dificil|mal día|mal dia|preocupad/.test(value))return set("empathy",{reason:"vamos con calma",duration:2600,semanticState:true});
    if(/urgente|vencid|problema|error|bloquead/.test(value))return set("concern",{reason:"revisando prioridad",duration:2200,semanticState:true});
    if(/qué|que|cómo|como|por qué|porque|explícame|explicame|quiero saber/.test(value))return set("curiosity",{reason:"comprendiendo tu pregunta",duration:1700,semanticState:true});
    if(/tarea|pendiente|mi día|mi dia|hoy|prioridad/.test(value))return set("focus",{reason:"organizando tu jornada",duration:1800,semanticState:true});
    return set("attentive",{reason:"te escucho",duration:1300,semanticState:true});
  }
  function fromAssistantText(text){
    const value=String(text||"").toLowerCase();
    if(/completad|terminad|aprobada|logro|excelente avance/.test(value))return set("celebration",{reason:"avance confirmado",duration:2700,semanticState:true});
    if(/gracias|agradezco/.test(value))return set("gratitude",{reason:"con cercanía",duration:2100,semanticState:true});
    if(/recuper|conexión está activa|conexion esta activa|ya está listo|ya esta listo/.test(value))return set("relief",{reason:"todo vuelve a estar estable",duration:2200,semanticState:true});
    if(/no pude|error|no está disponible|no esta disponible/.test(value))return set("caution",{reason:"revisando una alternativa",duration:2200,semanticState:true});
    return apply(semantic||inferFromTasks().emotion);
  }
  function greetingMessage(signal){
    const first=String(me().full_name||"").split(/\s+/)[0]||"";
    if(signal.overdue.length)return{title:`Hola${first?`, ${first}`:""}. Ya estoy aquí.`,body:`Tienes ${signal.overdue.length} tarea${signal.overdue.length===1?"":"s"} vencida${signal.overdue.length===1?"":"s"}. Puedo ordenarlas y llevarte directamente a cada una.`};
    if(signal.due.length)return{title:`Hola${first?`, ${first}`:""}. Estoy contigo.`,body:`Tienes ${signal.due.length} tarea${signal.due.length===1?"":"s"} para hoy. Puedo mostrarte el orden recomendado.`};
    if(signal.reviews.length)return{title:`Hola${first?`, ${first}`:""}.`,body:`Hay ${signal.reviews.length} tarea${signal.reviews.length===1?"":"s"} en revisión. Puedo ayudarte a revisar tu día.`};
    return{title:`Hola${first?`, ${first}`:""}. Ya estoy aquí.`,body:signal.tasks.length?`Tienes ${signal.tasks.length} tarea${signal.tasks.length===1?"":"s"} abierta${signal.tasks.length===1?"":"s"}. Puedo ayudarte a decidir qué sigue.`:"Tu agenda está despejada. Permaneceré cerca por si me necesitas."};
  }
  function greetingAllowed(force=false){
    const prefs=preferences();
    if(prefs.presenceMode==="silent"||prefs.ambientGreetings===false)return false;
    if(force)return true;
    const user=String(me().id||me().auth_user_id||"guest");
    const daily=`${user}:${today()}`;
    try{return localStorage.getItem(GREETING_KEY)!==daily}catch{return true}
  }
  function showGreeting(force=false){
    if(!appVisible()||!greetingAllowed(force))return false;
    const signal=refresh(),message=greetingMessage(signal);
    let box=document.getElementById("sakuraAmbientGreeting");
    if(!box){
      box=document.createElement("aside");
      box.id="sakuraAmbientGreeting";
      box.className="sk-ambient-greeting";
      box.setAttribute("role","status");
      document.body.appendChild(box);
    }
    const side=preferences().dockSide==="left"?"left":"right";
    box.dataset.side=side;
    box.innerHTML=`<strong>${message.title}</strong><p>${message.body}</p><div class="sk-ambient-greeting-actions"><button type="button" class="primary" data-sk-ambient-open-day>Ver mi día</button><button type="button" data-sk-ambient-dismiss>Ahora no</button></div>`;
    box.querySelector("[data-sk-ambient-open-day]").onclick=async()=>{
      box.classList.remove("show");
      await window.INBESTIGA_SAKURA_LOADER?.load?.();
      setTimeout(()=>window.INBESTIGA_SAKURA_NATIVE?.ask?.("¿Qué tareas tengo hoy?"),80);
    };
    box.querySelector("[data-sk-ambient-dismiss]").onclick=()=>box.classList.remove("show");
    requestAnimationFrame(()=>box.classList.add("show"));
    if(!force){
      try{localStorage.setItem(GREETING_KEY,`${String(me().id||me().auth_user_id||"guest")}:${today()}`)}catch{}
    }
    clearTimeout(greetingTimer);
    greetingTimer=setTimeout(()=>box.classList.remove("show"),9500);
    return true;
  }
  function syncVisibility(){
    const launcher=document.getElementById("sakuraNativeLauncher");
    if(launcher)launcher.hidden=!appVisible();
  }
  function installHooks(){
    const wrap=name=>{
      const base=window[name];
      if(typeof base!=="function"||base.__sakuraAffectiveWrapped)return;
      const wrapped=async function(...args){
        const result=await base.apply(this,args);
        requestAnimationFrame(()=>{syncVisibility();refresh()});
        return result;
      };
      wrapped.__sakuraAffectiveWrapped=true;
      wrapped.__sakuraAffectiveBase=base;
      window[name]=wrapped;
    };
    wrap("renderAll");
    wrap("loadAll");
    const nav=window.navTo;
    if(typeof nav==="function"&&!nav.__sakuraAffectiveWrapped){
      const wrapped=function(...args){
        const result=nav.apply(this,args);
        requestAnimationFrame(syncVisibility);
        return result;
      };
      wrapped.__sakuraAffectiveWrapped=true;
      wrapped.__sakuraAffectiveBase=nav;
      window.navTo=wrapped;
    }
    ["inbestiga:task-created","inbestiga:task-updated","inbestiga:task-completed","inbestiga:task-delivered"].forEach(name=>window.addEventListener(name,()=>set("celebration",{reason:"avance registrado",duration:2600,semanticState:true}),{passive:true}));
    window.addEventListener("pageshow",()=>{syncVisibility();refresh()},{passive:true});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden){syncVisibility();refresh()}},{passive:true});
  }
  function init(){
    syncVisibility();
    refresh();
    installHooks();
    setTimeout(()=>{syncVisibility();refresh();showGreeting(false)},1100);
    try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"ambient-affective-task-awareness",polling:false,realtimeChannels:0,mutationObservers:0,backendChanges:false})}catch{}
  }
  window.INBESTIGA_SAKURA_AFFECTIVE=Object.freeze({
    version:VERSION,
    states:STATES,
    set,
    refresh,
    inferFromTasks,
    fromUserText,
    fromAssistantText,
    showGreeting,
    syncVisibility,
    get current(){return current}
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
