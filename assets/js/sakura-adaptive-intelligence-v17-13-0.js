/* INBESTIGA Marketing Cloud v17.13.0 · SAKURA Adaptive Intelligence, Visual Director & Controlled Web Explorer */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_ADAPTIVE_INTELLIGENCE) return;

  const VERSION = "v17.13.0";
  const MODULE = "sakura-adaptive-intelligence-v17-13-0";
  const runtime = window.INBESTIGA_PUBLIC_RUNTIME_CONFIG || {};
  const runtimeSakura = runtime.sakura || {};
  const rows = value => Array.isArray(value) ? value : [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clamp = (n,min,max) => Math.max(min,Math.min(max,Number(n)||0));
  const same = (a,b) => String(a ?? "") === String(b ?? "");
  const nowIso = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  const memberNow = () => (typeof member !== "undefined" && member) ? member : (window.member || {});
  const stateNow = () => (typeof state !== "undefined" && state) ? state : (window.state || {});
  const isManager = () => !!(window.isDirector?.() || window.isSupervisor?.());
  const isDirector = () => !!window.isDirector?.();
  const toast = (title, detail = "", tone = "success") => {
    try { if (window.premiumToast) return window.premiumToast(title, detail, tone); } catch (_) {}
    console[tone === "error" ? "error" : "info"](`[SAKURA] ${title}`, detail);
  };

  const BASE_FLAGS = Object.freeze({
    SAKURA_ENABLED: runtimeSakura.enabled !== false,
    SAKURA_CHAT_ENABLED: runtimeSakura.chat !== false,
    SAKURA_ACTIONS_ENABLED: runtimeSakura.actions !== false,
    SAKURA_LEARNING_ENABLED: runtimeSakura.learning !== false,
    SAKURA_VOICE_ENABLED: runtimeSakura.voice !== false,
    SAKURA_REPORTS_ENABLED: runtimeSakura.reports !== false,
    SAKURA_VISUAL_DIRECTOR_ENABLED: runtimeSakura.visualDirector !== false,
    SAKURA_WEB_ENABLED: runtimeSakura.web === true || runtimeSakura.webEnabled === true,
    SAKURA_WORKSPACE_LAYOUT_ENABLED: runtimeSakura.workspaceLayout !== false
  });

  const STORAGE = Object.freeze({
    flags: "inbestiga_sakura_feature_flags_v17130",
    layouts: "inbestiga_sakura_workspace_layouts_v17130",
    layoutHistory: "inbestiga_sakura_workspace_layout_history_v17130",
    fusion: "inbestiga_sakura_fusion_preferences_v17130",
    memories: "inbestiga_sakura_supervised_memories_v17130",
    patterns: "inbestiga_sakura_pattern_signatures_v17130",
    corrections: "inbestiga_sakura_interpretation_corrections_v17130",
    visual: "inbestiga_sakura_visual_tokens_v17130",
    visualHistory: "inbestiga_sakura_visual_history_v17130",
    web: "inbestiga_sakura_web_preferences_v17130",
    webSaved: "inbestiga_sakura_web_saved_v17130",
    context: "inbestiga_sakura_context_engine_v17130",
    drafts: "inbestiga_sakura_composer_drafts_v17130"
  });

  const app = {
    attached: false,
    panel: null,
    currentCustomTab: "",
    flags: loadJson(STORAGE.flags, BASE_FLAGS),
    layouts: loadJson(STORAGE.layouts, {}),
    layoutHistory: loadJson(STORAGE.layoutHistory, []),
    fusion: loadJson(STORAGE.fusion, { mode:"auto", intensity:64, surfaceAlpha:36, headerAlpha:46, chatAlpha:34, composerAlpha:54 }),
    memories: loadJson(STORAGE.memories, []),
    patterns: loadJson(STORAGE.patterns, {}),
    corrections: loadJson(STORAGE.corrections, []),
    visual: loadJson(STORAGE.visual, null),
    visualHistory: loadJson(STORAGE.visualHistory, []),
    web: loadJson(STORAGE.web, { privacy:"ask", domains:"", type:"web", query:"", lastConsentQuery:"" }),
    webSaved: loadJson(STORAGE.webSaved, []),
    context: loadJson(STORAGE.context, {lastText:"",normalized:"",entities:{},updatedAt:""}),
    drafts: loadJson(STORAGE.drafts, {}),
    visualProposals: [],
    selectedVisualProposal: 0,
    paletteProposals: [],
    webResults: [],
    webLoading: false,
    lastLayoutMode: "right",
    drag: null,
    dockHot: "",
    layoutPopover: null,
    correctionDialog: null
  };
  const workspacePanels = new Map();

  function registerWorkspacePanel(id, adapter={}){
    id=String(id||"").trim(); if(!id)return false;
    workspacePanels.set(id,{id,label:String(adapter.label||id),getElement:typeof adapter.getElement==="function"?adapter.getElement:()=>document.getElementById(id),recover:typeof adapter.recover==="function"?adapter.recover:null,apply:typeof adapter.apply==="function"?adapter.apply:null});
    return true;
  }
  function recoverWorkspacePanels(){
    workspacePanels.forEach(entry=>{try{if(entry.recover)return entry.recover();const el=entry.getElement?.();if(!el)return;const r=el.getBoundingClientRect(),safe=computeSafeTop();if(r.right<24||r.left>innerWidth-24||r.bottom<safe+24||r.top>innerHeight-24){entry.apply?.("right");}}catch(_){}});
    recoverPanel();
  }

  function userSuffix(){
    const m = memberNow();
    return String(m.id || m.auth_user_id || "guest").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "guest";
  }
  function scopedKey(base){ return `${base}:${userSuffix()}`; }
  function loadJson(key, fallback){
    try { const parsed = JSON.parse(localStorage.getItem(scopedKey(key)) || "null"); return parsed == null ? clone(fallback) : parsed; }
    catch (_) { return clone(fallback); }
  }
  function saveJson(key, value){
    try { localStorage.setItem(scopedKey(key), JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }
  function saveAll(){
    saveJson(STORAGE.flags, app.flags); saveJson(STORAGE.layouts, app.layouts); saveJson(STORAGE.layoutHistory, app.layoutHistory.slice(-40));
    saveJson(STORAGE.fusion, app.fusion); saveJson(STORAGE.memories, app.memories.slice(-240)); saveJson(STORAGE.patterns, app.patterns);
    saveJson(STORAGE.corrections, app.corrections.slice(-180)); saveJson(STORAGE.visual, app.visual); saveJson(STORAGE.visualHistory, app.visualHistory.slice(-50));
    saveJson(STORAGE.web, app.web); saveJson(STORAGE.webSaved, app.webSaved.slice(-150)); saveJson(STORAGE.context, app.context); saveJson(STORAGE.drafts, app.drafts);
  }

  function currentModule(){
    return document.querySelector("main .section.active, .content .section.active, section.section.active")?.id ||
      document.querySelector("[data-section].active")?.dataset.section || "home";
  }

  /* -------------------- Feature flags -------------------- */
  function flag(name){ return app.flags.SAKURA_ENABLED !== false && app.flags[name] !== false; }
  function setFlag(name, enabled){
    if (!(name in BASE_FLAGS)) return false;
    app.flags[name] = !!enabled; saveJson(STORAGE.flags, app.flags); applyFeatureFlags(); return true;
  }
  function applyFeatureFlags(){
    const root = document.documentElement;
    Object.entries(app.flags).forEach(([key,value]) => root.setAttribute(`data-${key.replaceAll("_","-").toLowerCase()}`, value ? "true" : "false"));
    const launcher = document.getElementById("sakuraNativeLauncher"), top = document.getElementById("sakuraTopNavButton");
    if (launcher) launcher.hidden = app.flags.SAKURA_ENABLED === false;
    if (top) top.hidden = app.flags.SAKURA_ENABLED === false;
    const panel = document.getElementById("sakuraNativePanel");
    if (!panel) return;
    panel.querySelector('[data-sk-tab="chat"]')?.toggleAttribute("hidden", !flag("SAKURA_CHAT_ENABLED"));
    panel.querySelector('[data-sk-tab="reports"]')?.toggleAttribute("hidden", !flag("SAKURA_REPORTS_ENABLED"));
    panel.querySelector('[data-sk-tab="learning"]')?.toggleAttribute("hidden", !flag("SAKURA_LEARNING_ENABLED"));
    panel.querySelector('[data-sk-tab="director"]')?.toggleAttribute("hidden", !flag("SAKURA_VISUAL_DIRECTOR_ENABLED"));
    panel.querySelector('[data-sk-tab="web"]')?.toggleAttribute("hidden", !flag("SAKURA_WEB_ENABLED"));
    const mic = panel.querySelector("#skMic"); if (mic) mic.hidden = !flag("SAKURA_VOICE_ENABLED");
  }

  /* -------------------- Safe area and layout -------------------- */
  function computeSafeTop(){
    const selectors = ["#v472AppleTopNav", ".v472-apple-top-nav", ".topbar", ".top-nav", "header.app-header", "[data-fixed-nav]"];
    let bottom = 10;
    selectors.forEach(selector => document.querySelectorAll(selector).forEach(el => {
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.height < 1) return;
      if (rect.top <= 30 && rect.bottom > 0 && rect.bottom < innerHeight * .35) bottom = Math.max(bottom, rect.bottom);
    }));
    return Math.ceil(bottom + 10);
  }
  function updateSafeArea(){
    const top = computeSafeTop();
    document.documentElement.style.setProperty("--sk-safe-top", `${top}px`);
    recoverPanel();
    return top;
  }
  function defaultLayout(){ return {mode:"right",left:null,top:null,width:500,height:null,updatedAt:nowIso()}; }
  function layoutForModule(module=currentModule()){
    const value = app.layouts[module] || app.layouts.__default || defaultLayout();
    return {...defaultLayout(), ...value};
  }
  function snapshotLayout(label){
    const current = readPanelLayout();
    app.layoutHistory.push({id:uid("layout"),label,module:currentModule(),layout:current,at:nowIso()});
    app.layoutHistory = app.layoutHistory.slice(-40); saveJson(STORAGE.layoutHistory, app.layoutHistory);
  }
  function readPanelLayout(){
    const panel = document.getElementById("sakuraNativePanel");
    if (!panel) return defaultLayout();
    const rect = panel.getBoundingClientRect();
    return {mode:panel.dataset.layoutMode || panel.dataset.dock || "right",left:Math.round(rect.left),top:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height),updatedAt:nowIso()};
  }
  function saveLayout(layout, module=currentModule()){
    app.layouts[module] = {...layout,updatedAt:nowIso()};
    app.layouts.__default = {...layout,updatedAt:nowIso()};
    saveJson(STORAGE.layouts, app.layouts);
  }
  function clearDockPadding(){
    const screen = document.getElementById("appScreen");
    screen?.classList.remove("sakura-workspace-docked-right","sakura-workspace-docked-left");
  }
  function applyDockPadding(mode, width){
    const screen = document.getElementById("appScreen"); if (!screen) return;
    clearDockPadding();
    if (innerWidth >= 1200 && (mode === "right" || mode === "left" || mode === "columns")) {
      const side = mode === "left" ? "left" : "right";
      const dockWidth = mode === "columns" ? clamp(width || Math.round(innerWidth * .46),460,760) : clamp(width,380,680);
      document.documentElement.style.setProperty("--sk-dock-width", `${dockWidth}px`);
      screen.classList.add(`sakura-workspace-docked-${side}`);
    }
  }
  function applyLayout(mode, options={}){
    const panel = document.getElementById("sakuraNativePanel"); if (!panel) return;
    const record = options.record !== false;
    const existing = readPanelLayout();
    if (record) snapshotLayout(`Antes de ${mode}`);
    mode = ["right","left","columns","bottom","floating","full","compact","orb"].includes(mode) ? mode : "right";
    if (!panel.classList.contains("open")) panel.classList.add("open");
    panel.classList.remove("minimized");
    panel.dataset.layoutMode = mode;
    panel.dataset.dock = mode === "left" ? "left" : "right";
    panel.style.removeProperty("left"); panel.style.removeProperty("right"); panel.style.removeProperty("top"); panel.style.removeProperty("bottom"); panel.style.removeProperty("width"); panel.style.removeProperty("height");
    const width = mode === "columns" ? clamp(options.width || (existing.mode === "columns" ? existing.width : Math.round(innerWidth * .46)),460,760) : clamp(options.width || existing.width || 500,380,680);
    if (mode === "floating") {
      const safe = computeSafeTop(), maxLeft = Math.max(8, innerWidth - width - 8), maxTop = Math.max(safe, innerHeight - 260);
      const left = clamp(options.left ?? existing.left ?? (innerWidth - width - 18), 8, maxLeft);
      const top = clamp(options.top ?? existing.top ?? safe, safe, maxTop);
      const height = clamp(options.height || existing.height || (innerHeight - top - 12), 280, innerHeight - top - 8);
      document.documentElement.style.setProperty("--sk-floating-left", `${left}px`);
      document.documentElement.style.setProperty("--sk-floating-top", `${top}px`);
      document.documentElement.style.setProperty("--sk-floating-width", `${width}px`);
      document.documentElement.style.setProperty("--sk-floating-height", `${height}px`);
      clearDockPadding();
      saveLayout({mode,left,top,width,height});
    } else {
      applyDockPadding(mode,width);
      saveLayout({mode,left:null,top:null,width,height:null});
    }
    app.lastLayoutMode = mode === "compact" || mode === "orb" ? (options.previous || app.lastLayoutMode || "right") : mode;
    highlightLayoutButtons(); recoverPanel();
  }
  function recoverPanel(){
    const panel = document.getElementById("sakuraNativePanel"); if (!panel || !panel.classList.contains("open")) return;
    const safe = computeSafeTop(), rect = panel.getBoundingClientRect();
    if (panel.dataset.layoutMode === "floating") {
      const width = Math.min(rect.width, innerWidth - 16), height = Math.min(rect.height, innerHeight - safe - 8);
      const left = clamp(rect.left, 8, Math.max(8, innerWidth - width - 8));
      const top = clamp(rect.top, safe, Math.max(safe, innerHeight - height - 8));
      document.documentElement.style.setProperty("--sk-floating-left", `${left}px`);
      document.documentElement.style.setProperty("--sk-floating-top", `${top}px`);
      document.documentElement.style.setProperty("--sk-floating-width", `${width}px`);
      document.documentElement.style.setProperty("--sk-floating-height", `${height}px`);
    }
  }
  function restoreLayout(module=currentModule()){
    const layout = layoutForModule(module); applyLayout(layout.mode,{...layout,record:false});
  }
  function undoLayout(){
    const index = [...app.layoutHistory].reverse().findIndex(x => x.module === currentModule());
    if (index < 0) return toast("Sin movimiento anterior", "Todavía no existe una distribución para recuperar.", "warning");
    const actual = app.layoutHistory.length - 1 - index, item = app.layoutHistory.splice(actual,1)[0];
    saveJson(STORAGE.layoutHistory, app.layoutHistory); applyLayout(item.layout.mode,{...item.layout,record:false}); toast("Distribución recuperada", item.label || "Movimiento anterior");
  }
  function resetLayouts(){
    app.layouts = {}; app.layoutHistory = []; saveJson(STORAGE.layouts, app.layouts); saveJson(STORAGE.layoutHistory, app.layoutHistory);
    applyLayout("right",{record:false,width:500}); toast("Paneles restablecidos", "SAKURA volvió a la posición segura de la derecha.");
  }

  function ensureDockZones(){
    let host = document.getElementById("skDockZones");
    if (host) return host;
    host = document.createElement("div"); host.id = "skDockZones"; host.className = "sk-dock-zones";
    host.innerHTML = '<div class="sk-dock-zone" data-zone="left">IZQUIERDA</div><div class="sk-dock-zone" data-zone="right">DERECHA</div><div class="sk-dock-zone" data-zone="bottom">ABAJO</div><div class="sk-dock-zone" data-zone="full">VISTA COMPLETA</div>';
    document.body.appendChild(host); return host;
  }
  function zoneAt(x,y){
    const zones = document.querySelectorAll(".sk-dock-zone"); let found = "";
    zones.forEach(zone => { const r = zone.getBoundingClientRect(), hit = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; zone.classList.toggle("hot", hit); if (hit) found = zone.dataset.zone; });
    return found;
  }
  function startDrag(event){
    if (!flag("SAKURA_WORKSPACE_LAYOUT_ENABLED") || event.button !== 0) return;
    const panel = document.getElementById("sakuraNativePanel"); if (!panel) return;
    event.preventDefault(); event.stopPropagation();
    const rect = panel.getBoundingClientRect(); snapshotLayout("Mover panel");
    applyLayout("floating",{record:false,left:rect.left,top:rect.top,width:rect.width,height:rect.height});
    app.drag = {pointerId:event.pointerId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height};
    event.currentTarget?.setPointerCapture?.(event.pointerId); document.body.classList.add("sk-dragging-panel"); ensureDockZones().classList.add("active");
  }
  function moveDrag(event){
    if (!app.drag || event.pointerId !== app.drag.pointerId) return;
    const safe = computeSafeTop(), left = clamp(event.clientX-app.drag.offsetX,8,Math.max(8,innerWidth-app.drag.width-8)), top = clamp(event.clientY-app.drag.offsetY,safe,Math.max(safe,innerHeight-app.drag.height-8));
    document.documentElement.style.setProperty("--sk-floating-left",`${left}px`); document.documentElement.style.setProperty("--sk-floating-top",`${top}px`);
    app.dockHot = zoneAt(event.clientX,event.clientY);
  }
  function endDrag(event){
    if (!app.drag || event.pointerId !== app.drag.pointerId) return;
    const hot = app.dockHot, layout = readPanelLayout(); app.drag = null; app.dockHot = "";
    document.body.classList.remove("sk-dragging-panel"); document.getElementById("skDockZones")?.classList.remove("active"); document.querySelectorAll(".sk-dock-zone").forEach(x=>x.classList.remove("hot"));
    if (hot) applyLayout(hot,{record:false}); else saveLayout({...layout,mode:"floating"});
  }

  function showLayoutPopover(anchor){
    app.layoutPopover?.remove();
    const pop = document.createElement("div"); pop.className = "sk-layout-popover"; pop.id = "skLayoutPopover";
    const current = document.getElementById("sakuraNativePanel")?.dataset.layoutMode || "right";
    pop.innerHTML = `<h4>Organizar espacio de trabajo</h4><p>Coloca SAKURA en una zona segura. La distribución se guarda por usuario y módulo. Paneles registrados: ${workspacePanels.size||1}.</p><div class="sk-layout-grid">${[["right","Derecha"],["left","Izquierda"],["columns","Dos columnas"],["floating","Flotante"],["bottom","Inferior"],["full","Vista completa"],["compact","Barra compacta"],["orb","Solo núcleo"]].map(([id,name])=>`<button type="button" class="${current===id?"active":""}" data-sk-layout="${id}">${name}</button>`).join("")}</div><div class="sk-layout-tools"><button type="button" data-sk-layout-tool="safe">Zona segura</button><button type="button" data-sk-layout-tool="undo">Deshacer</button><button type="button" data-sk-layout-tool="reset">Restablecer</button></div>`;
    document.body.appendChild(pop); app.layoutPopover = pop;
    const rect = anchor?.getBoundingClientRect?.() || {right:innerWidth-20,bottom:70};
    const width = Math.min(420, innerWidth-24), left = clamp(rect.right-width,12,innerWidth-width-12), top = clamp(rect.bottom+8,12,innerHeight-pop.offsetHeight-12);
    pop.style.left = `${left}px`; pop.style.top = `${top}px`;
    pop.addEventListener("click", e => {
      const layout = e.target.closest("[data-sk-layout]"); if (layout) { applyLayout(layout.dataset.skLayout); pop.remove(); app.layoutPopover=null; return; }
      const tool = e.target.closest("[data-sk-layout-tool]")?.dataset.skLayoutTool;
      if (tool === "safe") { recoverWorkspacePanels(); toast("Paneles reubicados", "Los paneles registrados están dentro de la zona visible."); }
      if (tool === "undo") undoLayout(); if (tool === "reset") resetLayouts();
    });
    setTimeout(()=>document.addEventListener("pointerdown", closeLayoutPopoverOutside,{once:true,capture:true}),0);
  }
  function closeLayoutPopoverOutside(e){ if (app.layoutPopover && !app.layoutPopover.contains(e.target)) { app.layoutPopover.remove(); app.layoutPopover=null; } }
  function highlightLayoutButtons(){
    const mode = document.getElementById("sakuraNativePanel")?.dataset.layoutMode;
    document.querySelectorAll("[data-sk-layout]").forEach(b=>b.classList.toggle("active",b.dataset.skLayout===mode));
  }

  /* -------------------- Technological core -------------------- */
  const coreMarkup = () => '<span class="sk-tech-core" aria-hidden="true"><i class="tc-halo"></i><i class="tc-ring r3"></i><i class="tc-ring r2"></i><i class="tc-ring r1"></i><i class="tc-segments"></i><i class="tc-particles"></i><i class="tc-petals"></i><i class="tc-network"></i><i class="tc-prism"></i><i class="tc-scanner"></i><i class="tc-wave"></i><i class="tc-core"></i></span>';
  function installCores(){
    [document.querySelector("#skPresence"),document.querySelector("#sakuraNativeLauncher .sakura-native-launcher-orb")].filter(Boolean).forEach(host => {
      if (host.querySelector(".sk-tech-core")) return; host.innerHTML = coreMarkup();
    });
    syncCoreSettings(window.INBESTIGA_SAKURA_STUDIO?.load?.() || {});
  }
  function syncCoreSettings(style={}){
    const root = document.documentElement;
    root.dataset.sakuraOrb = style.orbDesign || root.dataset.sakuraOrb || "orbital";
    root.dataset.sakuraOrbAnimation = style.orbAnimation === false ? "off" : "on";
    root.dataset.sakuraLowPower = style.lowPower ? "true" : "false";
    root.style.setProperty("--sk-tech-speed", String(clamp((style.orbSpeed || 100)/100,.35,2.2)));
  }

  /* -------------------- Image fusion and palette -------------------- */
  function applyFusion(style={}){
    const panel = document.getElementById("sakuraNativePanel"); if (!panel) return;
    panel.dataset.fusionMode = app.fusion.mode || "auto";
    document.documentElement.style.setProperty("--sk-fusion-alpha",`${clamp(app.fusion.intensity,0,100)}%`);
    document.documentElement.style.setProperty("--sk-fusion-surface-alpha",`${clamp(app.fusion.surfaceAlpha,10,95)}%`);
    document.documentElement.style.setProperty("--sk-fusion-header-alpha",`${clamp(app.fusion.headerAlpha,10,95)}%`);
    document.documentElement.style.setProperty("--sk-fusion-chat-alpha",`${clamp(app.fusion.chatAlpha,10,95)}%`);
    document.documentElement.style.setProperty("--sk-fusion-composer-alpha",`${clamp(app.fusion.composerAlpha,10,95)}%`);
    if (style.backgroundType === "image" && style.backgroundAssetId) panel.classList.add("sk-has-user-image"); else panel.classList.remove("sk-has-user-image");
  }
  function openAssetDb(){
    return new Promise((resolve,reject)=>{ const req=indexedDB.open("inbestiga_sakura_style_assets_v1",1); req.onerror=()=>reject(req.error); req.onsuccess=()=>resolve(req.result); req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains("backgrounds")) req.result.createObjectStore("backgrounds",{keyPath:"id"}); }; });
  }
  async function readBackgroundBlob(assetId){
    if (!assetId) return null; const db = await openAssetDb();
    try { return await new Promise((resolve,reject)=>{ const tx=db.transaction("backgrounds","readonly"),req=tx.objectStore("backgrounds").get(assetId);req.onsuccess=()=>resolve(req.result?.blob||null);req.onerror=()=>reject(req.error); }); }
    finally { db.close(); }
  }
  function rgbToHex(r,g,b){ return `#${[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,"0")).join("")}`; }
  function hexToRgb(hex){ const x=String(hex||"").replace("#",""); if(!/^[0-9a-f]{6}$/i.test(x)) return {r:128,g:80,b:190}; return {r:parseInt(x.slice(0,2),16),g:parseInt(x.slice(2,4),16),b:parseInt(x.slice(4,6),16)}; }
  function mixHex(a,b,amount=.5){ const x=hexToRgb(a),y=hexToRgb(b),t=clamp(amount,0,1); return rgbToHex(x.r+(y.r-x.r)*t,x.g+(y.g-x.g)*t,x.b+(y.b-x.b)*t); }
  function luminance(hex){ const c=hexToRgb(hex),v=[c.r,c.g,c.b].map(n=>{n/=255;return n<=.03928?n/12.92:Math.pow((n+.055)/1.055,2.4)});return .2126*v[0]+.7152*v[1]+.0722*v[2]; }
  function textFor(bg){ return luminance(bg) > .42 ? "#121217" : "#ffffff"; }
  async function extractPalette(){
    const style = window.INBESTIGA_SAKURA_STUDIO?.load?.() || {};
    if (!style.backgroundAssetId) throw new Error("Sube primero una fotografía en Diseño · Plataforma → SAKURA.");
    const blob = await readBackgroundBlob(style.backgroundAssetId); if (!blob) throw new Error("No pude recuperar la imagen guardada.");
    const bitmap = await createImageBitmap(blob), canvas=document.createElement("canvas"), size=96; canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(bitmap,0,0,size,size);bitmap.close?.();
    const pixels=ctx.getImageData(0,0,size,size).data,buckets=new Map();
    for(let i=0;i<pixels.length;i+=16){ if(pixels[i+3]<180)continue; const r=Math.round(pixels[i]/32)*32,g=Math.round(pixels[i+1]/32)*32,b=Math.round(pixels[i+2]/32)*32; const max=Math.max(r,g,b),min=Math.min(r,g,b); if(max<24||min>240)continue; const key=`${clamp(r,0,255)},${clamp(g,0,255)},${clamp(b,0,255)}`; buckets.set(key,(buckets.get(key)||0)+1+(max-min)/64); }
    const colors=[...buckets.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([key])=>rgbToHex(...key.split(",").map(Number)));
    if(colors.length<3)colors.push("#8f55ed","#ef61b9","#2dd4ff"); return colors;
  }
  function paletteToProposals(colors){
    const primary=colors[0]||"#8f55ed",secondary=colors[1]||"#ef61b9",third=colors[2]||"#2dd4ff";
    return [
      {id:"palette_glass",name:"Cristal fusionado",desc:"La fotografía domina y las superficies se vuelven translúcidas.",fusion:"glass",panelColor1:mixHex(primary,"#08070c",.72),panelColor2:mixHex(secondary,"#11131c",.66),panelColor3:mixHex(third,"#08070c",.78),accent:secondary,accent2:third,buttonBg:secondary,frameColor:third,headerColor1:mixHex(primary,"#09070d",.58),headerColor2:mixHex(secondary,"#09070d",.72),surface:mixHex(primary,"#141018",.65),surface2:mixHex(secondary,"#17121d",.68),chatBg:"rgba(10,8,14,.30)",userBubble:mixHex(primary,secondary,.48),assistantBubble:"rgba(20,16,25,.60)",orbPrimary:primary,orbSecondary:secondary,orbTertiary:third,text:"#ffffff"},
      {id:"palette_deep",name:"Integración profunda",desc:"Colores derivados y máxima continuidad con la imagen.",fusion:"deep",panelColor1:primary,panelColor2:secondary,panelColor3:third,accent:third,accent2:secondary,buttonBg:third,frameColor:secondary,headerColor1:primary,headerColor2:mixHex(primary,"#000000",.62),surface:mixHex(primary,"#000000",.45),surface2:mixHex(secondary,"#000000",.45),chatBg:"rgba(7,7,10,.18)",userBubble:primary,assistantBubble:"rgba(8,8,12,.45)",orbPrimary:primary,orbSecondary:secondary,orbTertiary:third,text:"#ffffff"},
      {id:"palette_clean",name:"Imagen limpia",desc:"Fondo visible con controles de contraste alto.",fusion:"clean",panelColor1:"#121216",panelColor2:primary,panelColor3:"#08080b",accent:primary,accent2:secondary,buttonBg:primary,frameColor:"#ffffff",headerColor1:"#17171c",headerColor2:"#0b0b0e",surface:"#202027",surface2:"#292932",chatBg:"rgba(12,12,16,.46)",userBubble:primary,assistantBubble:"rgba(22,22,28,.78)",orbPrimary:primary,orbSecondary:secondary,orbTertiary:third,text:"#ffffff"}
    ];
  }
  async function analyzeBackground(){
    const colors=await extractPalette(); app.paletteProposals=paletteToProposals(colors); app.visualProposals=app.paletteProposals; app.selectedVisualProposal=0; renderDirector(); toast("Fotografía analizada","SAKURA creó tres propuestas seguras basadas en sus colores.");
  }
  async function autoFuseIfNeeded(style){
    if(!style?.backgroundAssetId||style.backgroundType!=="image")return false;
    if(app.fusion.lastAssetId===style.backgroundAssetId)return false;
    try{const colors=await extractPalette();app.paletteProposals=paletteToProposals(colors);app.fusion.lastAssetId=style.backgroundAssetId;app.fusion.mode=app.paletteProposals[0]?.fusion||"glass";saveJson(STORAGE.fusion,app.fusion);await applyPaletteProposal(0,true);toast("Fusión visual automática","SAKURA adaptó colores, superficies, marco y núcleo a la fotografía.");return true}catch(error){console.info("[SAKURA] No se pudo fusionar automáticamente",error?.message||error);return false}
  }
  async function applyPaletteProposal(index, persist=true){
    const proposal=app.paletteProposals[index]||app.visualProposals[index]; if(!proposal)return;
    const studio=window.INBESTIGA_SAKURA_STUDIO,base=studio?.load?.()||{}; app.fusion.mode=proposal.fusion||app.fusion.mode; saveJson(STORAGE.fusion,app.fusion);
    const next={...base,...proposal,backgroundType:base.backgroundAssetId?"image":base.backgroundType,headerText:textFor(proposal.headerColor1||proposal.panelColor1),headerMuted:mixHex(textFor(proposal.headerColor1||proposal.panelColor1),proposal.headerColor1||proposal.panelColor1,.28),assistantText:proposal.text||"#ffffff",userText:"#ffffff",inputText:proposal.text||"#ffffff",buttonText:textFor(proposal.buttonBg||proposal.accent)};
    await studio?.apply?.(next,{persist}); applyFusion(next); syncCoreSettings(next); if(persist)toast("Tema fusionado aplicado","La imagen y todo el panel de SAKURA ahora comparten una misma identidad visual.");
  }

  /* -------------------- Natural context and supervised memory -------------------- */
  const typoRules = [
    [/\bcleinte\b/gi,"cliente"],[/\bclinte\b/gi,"cliente"],[/\bestado\s*ceo\b/gi,"Estado CEO"],[/\bestadoceo\b/gi,"Estado CEO"],[/\bvcl\b/gi,"VSL"],[/\bx\s*1[.,]5\b/gi,"1.5x"],[/\b3\s*pm\b/gi,"15:00"]
  ];
  function normalizeText(text){ let normalized=String(text||"").trim(); typoRules.forEach(([rule,value])=>normalized=normalized.replace(rule,value)); return normalized; }
  function extractEntities(text){
    const s=stateNow(),lower=String(text||"").toLocaleLowerCase("es");
    const memberHit=rows(s.members).find(x=>String(x.full_name||x.name||"").toLocaleLowerCase("es").split(/\s+/).some(p=>p.length>3&&lower.includes(p)));
    const clientHit=rows(s.clients).find(x=>lower.includes(String(x.name||"").toLocaleLowerCase("es")));
    const campaignHit=rows(s.campaigns).find(x=>lower.includes(String(x.name||"").toLocaleLowerCase("es")));
    return {member:memberHit?{id:memberHit.id,name:memberHit.full_name||memberHit.name}:null,client:clientHit?{id:clientHit.id,name:clientHit.name}:null,campaign:campaignHit?{id:campaignHit.id,name:campaignHit.name}:null};
  }
  function signature(text){
    return normalizeText(text).toLowerCase().replace(/\b\d+[\d:.,/-]*\b/g,"#").replace(/[^a-záéíóúñ# ]/g," ").replace(/\s+/g," ").trim().split(" ").slice(0,8).join(" ");
  }
  function trackExplicitInput(text){
    if(!text)return text; const normalized=normalizeText(text),entities=extractEntities(normalized),sig=signature(normalized);
    app.context={lastText:text,normalized,entities,updatedAt:nowIso()}; saveJson(STORAGE.context,app.context);
    if(sig.length>8){const row=app.patterns[sig]||{count:0,lastAt:"",suggested:false};row.count++;row.lastAt=nowIso();if(row.count>=3&&!row.suggested)row.pending=true;app.patterns[sig]=row;saveJson(STORAGE.patterns,app.patterns)}
    return normalized;
  }
  function saveComposerDraft(value,module=currentModule()){app.drafts[module]=String(value||"").slice(0,12000);saveJson(STORAGE.drafts,app.drafts)}
  function restoreComposerDraft(module=currentModule()){const input=document.querySelector("#sakuraNativePanel #skInput");if(input&&!input.value){input.value=app.drafts[module]||"";input.dispatchEvent(new Event("input",{bubbles:true}))}}
  function installInputContextCapture(panel){
    if(panel.dataset.skContextCapture==="1")return;panel.dataset.skContextCapture="1";
    panel.addEventListener("click",event=>{if(event.target.closest("#skSend")){const input=panel.querySelector("#skInput");if(input){const normalized=trackExplicitInput(input.value);if(normalized&&normalized!==input.value)input.value=normalized}}},true);
    panel.addEventListener("keydown",event=>{if(event.target.matches("#skInput")&&event.key==="Enter"&&!event.shiftKey){const normalized=trackExplicitInput(event.target.value);if(normalized&&normalized!==event.target.value)event.target.value=normalized;setTimeout(()=>saveComposerDraft(""),0)}},true);
    panel.addEventListener("input",event=>{if(event.target.matches("#skInput"))saveComposerDraft(event.target.value)},true);
    panel.addEventListener("click",event=>{const wrong=event.target.closest('[data-sk-feedback="wrong"]');if(!wrong)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();showCorrectionDialog(wrong.closest("[data-sk-message]")?.dataset.skMessage||"")},true);
  }
  function showCorrectionDialog(messageId){
    app.correctionDialog?.remove(); const host=document.createElement("div");host.className="sk-correction-dialog";
    const options=["Responsable incorrecto","Cliente incorrecto","Acción incorrecta","Fecha incorrecta","Perdió el contexto","Respuesta demasiado literal","Otra interpretación"];
    host.innerHTML=`<div class="sk-correction-card"><h3>¿Qué entendió mal SAKURA?</h3><p>Esta corrección se guarda únicamente como aprendizaje personal y puedes eliminarla después.</p><div class="sk-correction-options">${options.map(x=>`<button type="button" data-correction-type="${esc(x)}">${esc(x)}</button>`).join("")}</div><textarea id="skCorrectionDetail" placeholder="Escribe la interpretación correcta…"></textarea><div class="sk-correction-actions"><button type="button" data-correction-cancel>Cancelar</button><button type="button" class="primary" data-correction-save disabled>Guardar corrección</button></div></div>`;
    document.body.appendChild(host);app.correctionDialog=host;let selected="";
    host.addEventListener("click",e=>{const option=e.target.closest("[data-correction-type]");if(option){selected=option.dataset.correctionType;host.querySelectorAll("[data-correction-type]").forEach(x=>x.style.outline=x===option?"2px solid #9b5cff":"");host.querySelector("[data-correction-save]").disabled=false}if(e.target.closest("[data-correction-cancel]")){host.remove();app.correctionDialog=null}if(e.target.closest("[data-correction-save]")){const detail=host.querySelector("#skCorrectionDetail").value.trim();app.corrections.push({id:uid("correction"),messageId,type:selected,detail,at:nowIso(),scope:"personal"});saveJson(STORAGE.corrections,app.corrections);host.remove();app.correctionDialog=null;toast("Corrección guardada","SAKURA priorizará esta interpretación en tu aprendizaje personal.")}});
  }
  function pendingPatternSuggestions(){ return Object.entries(app.patterns).filter(([,x])=>x.pending).slice(0,12); }
  function addMemory(title,content,scope="personal",type="preference"){
    if(!title||!content)return;app.memories.push({id:uid("memory"),title:String(title).slice(0,100),content:String(content).slice(0,4000),scope,type,status:scope==="personal"?"active":"proposal",createdAt:nowIso(),owner:userSuffix()});saveJson(STORAGE.memories,app.memories);
  }

  /* -------------------- Visual Director -------------------- */
  const SAFE_PLATFORM_DEFAULTS = Object.freeze({background:"#0f1016",surface:"#191b24",surface2:"#252837",text:"#f6f7fb",muted:"#b9bdc9",primary:"#7c55e8",secondary:"#e454a7",accent:"#36c8f4",buttonText:"#ffffff",radius:18,shadow:36,glass:18,fontBody:"system",fontHeading:"system",density:"normal",motion:"normal"});
  function sanitizeTokenValue(key,value){
    if(["background","surface","surface2","text","muted","primary","secondary","accent","buttonText"].includes(key))return /^#[0-9a-f]{6}$/i.test(String(value))?String(value):SAFE_PLATFORM_DEFAULTS[key];
    if(key==="radius")return clamp(value,8,32);if(key==="shadow")return clamp(value,0,70);if(key==="glass")return clamp(value,0,40);
    if(key==="fontBody"||key==="fontHeading")return ["system","montserrat","poppins","manrope","space"].includes(value)?value:"system";
    if(key==="density")return ["compact","normal","comfortable"].includes(value)?value:"normal";
    if(key==="motion")return ["none","reduced","normal"].includes(value)?value:"normal";return value;
  }
  function fontToken(id){return {system:'-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',montserrat:'Montserrat,-apple-system,sans-serif',poppins:'Poppins,-apple-system,sans-serif',manrope:'Manrope,-apple-system,sans-serif',space:'"Space Grotesk",-apple-system,sans-serif'}[id]||'-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif';}
  function proposalFromCommand(command,variant=0){
    const q=String(command||"").toLowerCase();let t={...SAFE_PLATFORM_DEFAULTS};
    if(/ejecutiv|sobri|corporativ/.test(q))t={...t,background:"#0b0c10",surface:"#15171d",surface2:"#20232b",text:"#f4f1e8",muted:"#bbb6aa",primary:"#b89b55",secondary:"#7259bd",accent:"#d9bb72",radius:12,shadow:28,glass:8,fontHeading:"montserrat"};
    if(/japon|sakura|cerezo|rosa/.test(q))t={...t,background:"#20131c",surface:"#38202f",surface2:"#4a293c",text:"#fff8fc",muted:"#e5c8d6",primary:"#e85cae",secondary:"#ff9fc4",accent:"#8d68df",radius:22,shadow:34,glass:20,fontHeading:"poppins"};
    if(/futur|tecnol|hologr/.test(q))t={...t,background:"#061018",surface:"#0b2634",surface2:"#103a4d",text:"#effcff",muted:"#a7d9e5",primary:"#20c8ef",secondary:"#5e83ff",accent:"#27e0c0",radius:16,shadow:42,glass:16,fontHeading:"space"};
    if(/minimal|apple|limpi/.test(q))t={...t,background:"#f5f5f7",surface:"#ffffff",surface2:"#eceef2",text:"#171719",muted:"#6e6e73",primary:"#0071e3",secondary:"#7c5cff",accent:"#34c759",buttonText:"#ffffff",radius:18,shadow:18,glass:6,fontHeading:"system"};
    if(/oscuro|dark|negro/.test(q)){t.background="#090a0e";t.surface="#15161c";t.surface2="#21232c";t.text="#f7f8fb";t.muted="#b5b9c5"}
    if(/claro|blanco|light/.test(q)){t.background="#f4f5f8";t.surface="#ffffff";t.surface2="#e9ecf2";t.text="#17191f";t.muted="#656b78"}
    if(/menos reflej|sin reflej|reduce.*glass/.test(q))t.glass=4;if(/cristal|glass|transparen/.test(q))t.glass=26;
    if(/boton.*visible|contraste/.test(q)){t.accent=luminance(t.background)>.4?"#005bd6":"#ffd24b";t.buttonText=luminance(t.accent)>.42?"#101114":"#ffffff"}
    if(/letra.*elegante|tipograf.*elegante/.test(q))t.fontHeading="manrope";if(/montserrat/.test(q))t.fontHeading=t.fontBody="montserrat";if(/poppins/.test(q))t.fontHeading=t.fontBody="poppins";
    if(/compact/.test(q))t.density="compact";if(/ampli|espacios/.test(q))t.density="comfortable";if(/sin anim/.test(q))t.motion="none";if(/menos anim|suave/.test(q))t.motion="reduced";
    const shifts=[0,.16,-.12],shift=shifts[variant]||0;if(shift>0){t.primary=mixHex(t.primary,"#ffffff",shift);t.secondary=mixHex(t.secondary,"#ffffff",shift);t.surface=mixHex(t.surface,"#ffffff",.06)}if(shift<0){t.primary=mixHex(t.primary,"#000000",-shift);t.secondary=mixHex(t.secondary,"#000000",-shift);t.surface=mixHex(t.surface,"#000000",.12)}
    Object.keys(t).forEach(k=>t[k]=sanitizeTokenValue(k,t[k]));return t;
  }
  function generateVisualProposals(command){
    if(!command.trim())throw new Error("Describe el estilo que quieres crear.");
    app.visualProposals=[0,1,2].map((variant,index)=>({id:uid("visual"),name:["Equilibrado","Luminoso","Profundo"][index],desc:["Mantiene jerarquía y legibilidad.","Aumenta claridad y aire visual.","Refuerza contraste y presencia."][index],tokens:proposalFromCommand(command,variant),command}));app.selectedVisualProposal=0;renderDirector();
  }
  function ensurePlatformTokenStyle(){
    let style=document.getElementById("sakuraVisualDirectorSafeTokens");if(style)return style;style=document.createElement("style");style.id="sakuraVisualDirectorSafeTokens";style.textContent=`html[data-sakura-platform-theme="personal"] body{--sakura-platform-bg:var(--sv-bg);--sakura-platform-surface:var(--sv-surface);--sakura-platform-surface-2:var(--sv-surface-2);--sakura-platform-text:var(--sv-text);--sakura-platform-muted:var(--sv-muted);--sakura-platform-primary:var(--sv-primary);--sakura-platform-secondary:var(--sv-secondary);--sakura-platform-accent:var(--sv-accent);font-family:var(--sv-font-body)!important;background:var(--sv-bg)!important;color:var(--sv-text)!important}html[data-sakura-platform-theme="personal"] #appScreen,html[data-sakura-platform-theme="personal"] .app,html[data-sakura-platform-theme="personal"] .main{background:var(--sv-bg)!important;color:var(--sv-text)!important}html[data-sakura-platform-theme="personal"] .card,html[data-sakura-platform-theme="personal"] .panel,html[data-sakura-platform-theme="personal"] .mz-card,html[data-sakura-platform-theme="personal"] .v11-signal-card{border-radius:var(--sv-radius)!important;background:color-mix(in srgb,var(--sv-surface) calc(100% - var(--sv-glass)),transparent)!important;color:var(--sv-text)!important;box-shadow:0 16px 42px color-mix(in srgb,#000 var(--sv-shadow),transparent)!important}html[data-sakura-platform-theme="personal"] button.primary,html[data-sakura-platform-theme="personal"] .primary-btn{background:var(--sv-primary)!important;color:var(--sv-button-text)!important}html[data-sakura-platform-theme="personal"] h1,html[data-sakura-platform-theme="personal"] h2,html[data-sakura-platform-theme="personal"] h3{font-family:var(--sv-font-heading)!important}html[data-sakura-density="compact"] .card,html[data-sakura-density="compact"] .panel{padding:12px!important}html[data-sakura-density="comfortable"] .card,html[data-sakura-density="comfortable"] .panel{padding:24px!important}html[data-sakura-motion="none"] *{animation:none!important;transition:none!important}html[data-sakura-motion="reduced"] *{animation-duration:.35s!important;transition-duration:.18s!important}`;document.head.appendChild(style);return style;
  }
  function applyPlatformTokens(tokens,{persist=true}={}){
    tokens={...SAFE_PLATFORM_DEFAULTS,...tokens};Object.keys(tokens).forEach(k=>tokens[k]=sanitizeTokenValue(k,tokens[k]));ensurePlatformTokenStyle();const root=document.documentElement;
    const map={background:"--sv-bg",surface:"--sv-surface",surface2:"--sv-surface-2",text:"--sv-text",muted:"--sv-muted",primary:"--sv-primary",secondary:"--sv-secondary",accent:"--sv-accent",buttonText:"--sv-button-text"};Object.entries(map).forEach(([k,v])=>root.style.setProperty(v,tokens[k]));
    root.style.setProperty("--sv-radius",`${tokens.radius}px`);root.style.setProperty("--sv-shadow",`${tokens.shadow}%`);root.style.setProperty("--sv-glass",`${tokens.glass}%`);root.style.setProperty("--sv-font-body",fontToken(tokens.fontBody));root.style.setProperty("--sv-font-heading",fontToken(tokens.fontHeading));root.dataset.sakuraPlatformTheme="personal";root.dataset.sakuraDensity=tokens.density;root.dataset.sakuraMotion=tokens.motion;
    if(persist){app.visual=tokens;saveJson(STORAGE.visual,tokens)}return tokens;
  }
  function sakuraStyleFromTokens(tokens,current={}){
    const fontName={system:"SF Pro / Sistema",montserrat:"Montserrat",poppins:"Poppins",manrope:"Manrope",space:"Space Grotesk"}[tokens.fontBody]||"SF Pro / Sistema";
    const headingName={system:"SF Pro / Sistema",montserrat:"Montserrat",poppins:"Poppins",manrope:"Manrope",space:"Space Grotesk"}[tokens.fontHeading]||fontName;
    return {...current,backgroundType:current.backgroundAssetId?"image":"gradient",panelColor1:tokens.background,panelColor2:tokens.surface2,panelColor3:tokens.surface,frameColor:tokens.accent,panelRadius:tokens.radius,headerColor1:tokens.surface2,headerColor2:tokens.background,headerText:tokens.text,headerMuted:tokens.muted,chatBg:tokens.background,surface:tokens.surface,surface2:tokens.surface2,text:tokens.text,muted:tokens.muted,accent:tokens.accent,accent2:tokens.secondary,userBubble:tokens.primary,userText:tokens.buttonText,assistantBubble:tokens.surface2,assistantText:tokens.text,inputBg:tokens.surface,inputText:tokens.text,inputBorder:tokens.accent,buttonBg:tokens.primary,buttonText:tokens.buttonText,mainFont:fontName,nameFont:headingName,messageFont:fontName,buttonFont:fontName,orbPrimary:tokens.primary,orbSecondary:tokens.secondary,orbTertiary:tokens.accent,orbGlow:tokens.accent,lowPower:tokens.motion!=="normal"};
  }
  async function applyVisualToSakura(tokens,{persist=true}={}){
    const studio=window.INBESTIGA_SAKURA_STUDIO;if(!studio?.apply)return null;
    const current=studio.load?.()||{};const style=sakuraStyleFromTokens(tokens,current);
    await studio.apply(style,{persist});return style;
  }
  function rollbackVisual(){
    const item=app.visualHistory.pop();if(!item)return toast("Sin versión anterior","Todavía no hay un diseño para restaurar.","warning");saveJson(STORAGE.visualHistory,app.visualHistory);if(item.tokens)applyPlatformTokens(item.tokens);else{document.documentElement.removeAttribute("data-sakura-platform-theme");app.visual=null;saveJson(STORAGE.visual,null)}toast("Diseño restaurado",item.label||"Versión anterior");renderDirector();
  }
  async function applyVisualProposal(){
    const proposal=app.visualProposals[app.selectedVisualProposal];if(!proposal)return;const scope=document.getElementById("skVisualScope")?.value||"personal",includeSakura=document.getElementById("skVisualIncludeSakura")?.checked!==false;
    if(scope==="area"&&!isManager())return toast("Sin permiso","Solo responsables autorizados pueden proponer estilos de área.","warning");if(scope==="global"&&!isDirector())return toast("Sin permiso","Solo Dirección puede publicar un estilo global.","warning");
    const confirmed=await confirmAction(`Aplicar propuesta ${proposal.name}`,scope==="personal"?"Solo afectará tu perfil.":scope==="area"?"Se preparará como propuesta del área.":"Se publicará mediante el sistema de Diseño existente.");if(!confirmed)return;
    app.visualHistory.push({id:uid("visual_history"),label:`Antes de ${proposal.name}`,tokens:app.visual?clone(app.visual):null,instruction:proposal.command||"",changes:clone(proposal.tokens),requestedBy:{id:memberNow().id||null,name:memberNow().full_name||"Usuario"},at:nowIso(),scope,result:"confirmed"});saveJson(STORAGE.visualHistory,app.visualHistory);
    if(scope==="personal"){applyPlatformTokens(proposal.tokens);if(includeSakura)await applyVisualToSakura(proposal.tokens);toast("Diseño aplicado",includeSakura?"SAKURA adaptó la plataforma y su propia interfaz mediante tokens seguros.":"SAKURA adaptó tu experiencia personal mediante tokens seguros.");}
    else if(scope==="area"){addMemory(`Propuesta visual de área: ${proposal.name}`,JSON.stringify({tokens:proposal.tokens,sakura:includeSakura?sakuraStyleFromTokens(proposal.tokens):null}),"area","visual_proposal");toast("Propuesta guardada","Quedó pendiente de aprobación del área.");}
    else await publishGlobalVisual(proposal,includeSakura);
    renderDirector();
  }
  async function publishGlobalVisual(proposal,includeSakura=true){
    const client=window.sb||(typeof sb!=="undefined"?sb:null);if(!client?.rpc)throw new Error("Supabase no está disponible para publicar.");
    const t=proposal.tokens;const payload={mode:luminance(t.background)>.4?"light":"dark",primary:t.primary,secondary:t.secondary,accent:t.accent,background:t.background,surface:t.surface,surface2:t.surface2,text:t.text,muted:t.muted,radius:t.radius,baseSize:14,headingScale:1.08,navWidth:0,fontBody:t.fontBody,fontHeading:t.fontHeading,density:t.density,shadow:t.shadow>35?"strong":t.shadow<18?"soft":"normal",motion:t.motion};
    const saved=await client.rpc("ibm_v178_save_design_draft",{p_name:`SAKURA Director Visual · ${new Date().toLocaleString("es-PE")}`,p_settings:payload,p_module_settings:includeSakura?{sakura:sakuraStyleFromTokens(t,window.INBESTIGA_SAKURA_STUDIO?.load?.()||{})}:{},p_asset_slots:{}});if(saved.error)throw saved.error;const id=saved.data?.id||saved.data;if(!id)throw new Error("No se recibió la versión guardada.");const published=await client.rpc("ibm_v178_publish_design",{p_version_id:id});if(published.error)throw published.error;toast("Diseño global publicado","El sistema de Diseño guardó una versión reversible.");
  }
  async function confirmAction(title,detail){
    try{if(typeof window.premiumConfirmModal==="function")return !!(await window.premiumConfirmModal({title,subtitle:detail,preview:`<div class="modal-preview">${esc(detail)}</div>`,confirmLabel:"Confirmar",cancelLabel:"Cancelar"}));}catch(_){}
    return window.confirm(`${title}\n\n${detail}`);
  }

  /* -------------------- Controlled web explorer -------------------- */
  function cleanDomains(value){return String(value||"").split(/[\s,;]+/).map(x=>x.trim().replace(/^https?:\/\//,"").replace(/\/.*$/,"")).filter(x=>/^[a-z0-9.-]+$/i.test(x)).slice(0,20)}
  function safeQuery(text){return String(text||"").replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,500)}
  async function runWebSearch(){
    if(!flag("SAKURA_WEB_ENABLED"))return toast("Explorador web desactivado","Actívalo en Ajustes después de configurar el proveedor.","warning");
    const query=safeQuery(document.getElementById("skWebQuery")?.value||app.web.query),type=document.getElementById("skWebType")?.value||app.web.type,domains=cleanDomains(document.getElementById("skWebDomains")?.value||app.web.domains);if(!query)return toast("Escribe una búsqueda","SAKURA mostrará la consulta exacta antes de enviarla.","warning");
    app.web={...app.web,query,type,domains:domains.join(", ")};saveJson(STORAGE.web,app.web);
    if(app.web.privacy==="off")return toast("Internet desactivado","Cambia el modo de privacidad en el Explorador Web.","warning");
    if(app.web.privacy==="ask"){const ok=await confirmAction("Autorizar búsqueda web",`Consulta que saldrá de la plataforma: “${query}”${domains.length?` · Solo dominios: ${domains.join(", ")}`:""}`);if(!ok)return;app.web.lastConsentQuery=query;saveJson(STORAGE.web,app.web)}
    app.webLoading=true;renderWeb();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),26000);
    try{
      const response=await fetch("/api/sakura-web",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,type,domains,privacy:app.web.privacy}),signal:controller.signal,cache:"no-store"});
      const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`Explorador web ${response.status}`);app.webResults=rows(payload.results);document.documentElement.dataset.sakuraInternet="online";toast("Búsqueda completada",`${app.webResults.length} resultados con procedencia.`);
    }catch(error){document.documentElement.dataset.sakuraInternet=navigator.onLine?"provider-error":"offline";app.webResults=[];toast("Explorador web no disponible",error.name==="AbortError"?"La búsqueda superó el tiempo permitido.":error.message||String(error),"warning");}
    finally{clearTimeout(timer);app.webLoading=false;renderWeb()}
  }
  function manualSearch(){
    const query=safeQuery(document.getElementById("skWebQuery")?.value||app.web.query);if(!query)return;const type=document.getElementById("skWebType")?.value||"web",tbm=type==="images"?"&tbm=isch":type==="videos"?"&tbm=vid":"";window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}${tbm}`,"_blank","noopener,noreferrer");
  }
  function webTargetLabel(target,id){const s=stateNow();if(target==="campaign")return rows(s.campaigns).find(x=>same(x.id,id))?.name||"Campaña";if(target==="task")return rows(s.tasks).find(x=>same(x.id,id))?.title||"Tarea";return({notebook:"Cuaderno de investigación",library:"Biblioteca Visual",creative:"Creative Arena",report:"Reporte",knowledge:"Conocimiento pendiente"})[target]||"Cuaderno"}
  function saveWebResult(index){
    const item=app.webResults[index];if(!item)return;const target=document.getElementById("skWebTarget")?.value||"notebook",targetId=document.getElementById("skWebTargetEntity")?.value||"";
    if(["campaign","task"].includes(target)&&!targetId)return toast("Selecciona el destino","Elige la campaña o tarea antes de guardar.","warning");
    const record={id:uid("webref"),...item,target,targetId,targetLabel:webTargetLabel(target,targetId),savedAt:nowIso(),savedBy:userSuffix(),status:target==="knowledge"?"pending_approval":"saved"};app.webSaved.push(record);saveJson(STORAGE.webSaved,app.webSaved);
    if(target==="knowledge")addMemory(`Referencia web: ${item.title||"Resultado"}`,`${item.snippet||""}\nFuente: ${item.url}`,"personal","web_reference");
    toast("Referencia guardada",`${record.targetLabel}. Se conservó la fuente y no se asumió licencia comercial.`);renderWeb();
  }
  function openWebDestination(record){if(!record)return;const target=record.target;if(target==="campaign"){window.navTo?.("campaigns");window.v413OpenCampaign?.(record.targetId)}else if(target==="task"){window.navTo?.("tasks");window.v412OpenTask?.(record.targetId)}else if(target==="library")window.navTo?.("assets");else if(target==="creative")window.navTo?.("creativeRoomsClean");else if(target==="report")openCustomTab("web");else if(target==="knowledge")openCustomTab("memory");}
  function exportWebReferences(){const payload={schema:"inbestiga-sakura-web-references",version:1,exportedAt:nowIso(),references:app.webSaved};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`sakura_referencias_${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

  /* -------------------- Custom views -------------------- */
  function addCustomViews(panel){
    const tabs=panel.querySelector(".sk-tabs"),body=panel.querySelector(".sk-body");if(!tabs||!body)return;
    if(!tabs.querySelector('[data-sk-tab="director"]'))tabs.insertAdjacentHTML("beforeend",'<button type="button" data-sk-tab="director">Director</button><button type="button" data-sk-tab="web">Web</button><button type="button" data-sk-tab="memory">Memoria</button>');
    if(!body.querySelector("#skViewDirector"))body.insertAdjacentHTML("beforeend",'<section id="skViewDirector" class="sk-view"></section><section id="skViewWeb" class="sk-view"></section><section id="skViewMemory" class="sk-view"></section>');
    tabs.querySelectorAll("[data-sk-tab]").forEach(button=>{
      if(button.dataset.skV17130Bound==="1")return;button.dataset.skV17130Bound="1";
      button.addEventListener("click",()=>{const custom=["director","web","memory"].includes(button.dataset.skTab);if(custom)openCustomTab(button.dataset.skTab);else closeCustomTabs();button.scrollIntoView?.({behavior:"smooth",block:"nearest",inline:"nearest"});});
    });
    renderDirector();renderWeb();renderMemory();
  }
  function closeCustomTabs(){app.currentCustomTab="";["Director","Web","Memory"].forEach(id=>document.getElementById(`skView${id}`)?.classList.remove("active"));}
  function openCustomTab(tab){
    app.currentCustomTab=tab;document.querySelectorAll("#sakuraNativePanel .sk-view").forEach(v=>v.classList.remove("active"));document.querySelectorAll("#sakuraNativePanel [data-sk-tab]").forEach(b=>b.classList.toggle("active",b.dataset.skTab===tab));
    const view=document.getElementById(`skView${tab[0].toUpperCase()+tab.slice(1)}`);view?.classList.add("active");document.querySelector("#sakuraNativePanel .sk-composer")?.toggleAttribute("hidden",true);
    if(tab==="director")renderDirector();if(tab==="web")renderWeb();if(tab==="memory")renderMemory();
  }
  function restoreComposerOnBaseTab(){document.querySelector("#sakuraNativePanel .sk-composer")?.removeAttribute("hidden")}

  function contrastRatio(a,b){const l1=luminance(a),l2=luminance(b),hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+.05)/(lo+.05)}
  function validateVisualTokens(tokens){const t={...SAFE_PLATFORM_DEFAULTS,...tokens},text=contrastRatio(t.text,t.background),button=contrastRatio(t.buttonText||"#fff",t.primary);return{safe:text>=4.5&&button>=3,text:Number(text.toFixed(1)),button:Number(button.toFixed(1)),responsive:true,health:"sin cambios estructurales"}}

  function proposalMarkup(proposal,index){
    const t=proposal.tokens||proposal,v=validateVisualTokens(t);return `<button type="button" class="sk-token-proposal ${app.selectedVisualProposal===index?"selected":""}" data-visual-proposal="${index}" style="--proposal-bg:${esc(t.background||t.panelColor1)};--proposal-surface:${esc(t.surface||t.panelColor2)};--proposal-text:${esc(t.text||"#fff")};--proposal-accent:${esc(t.accent||t.buttonBg||"#8f55ed")}"><span><i></i><strong>${esc(proposal.name||`Propuesta ${index+1}`)}</strong><small>${esc(proposal.desc||"Tema adaptativo seguro")}</small><em>${v.safe?"✓ Contraste seguro":"⚠ Contraste corregible"} · Responsive</em></span></button>`;
  }
  function renderDirector(){
    const host=document.getElementById("skViewDirector");if(!host)return;const style=window.INBESTIGA_SAKURA_STUDIO?.load?.()||{},hasImage=!!style.backgroundAssetId;
    host.innerHTML=`<div class="sk-ai-panel"><article class="sk-ai-card"><h3>SAKURA · Director Visual</h3><p>Describe el resultado. SAKURA convierte la orden en tokens visuales autorizados; nunca ejecuta CSS o JavaScript generado por el modelo.</p><div class="sk-ai-field wide" style="margin-top:12px"><span>Orden visual</span><textarea id="skVisualCommand" placeholder="Ej. Haz la plataforma más ejecutiva, oscura, con menos reflejos y botones más visibles."></textarea></div><div class="sk-ai-grid"><label class="sk-ai-field"><span>Alcance</span><select id="skVisualScope"><option value="personal">Mi perfil</option>${isManager()?'<option value="area">Mi área</option>':''}${isDirector()?'<option value="global">Toda la empresa</option>':''}</select></label><label class="sk-ai-field"><span>Fusión de SAKURA</span><select id="skFusionMode"><option value="auto">Adaptación automática</option><option value="glass">Cristal sobre imagen</option><option value="deep">Integración profunda</option><option value="clean">Imagen limpia</option><option value="contrast">Alto contraste</option></select></label><label class="sk-ai-field"><span>SAKURA y plataforma</span><label class="sk-inline-check"><input id="skVisualIncludeSakura" type="checkbox" checked> Aplicar también a SAKURA</label></label></div><div class="sk-ai-actions"><button type="button" class="primary" id="skGenerateVisual">Crear tres propuestas</button><button type="button" id="skAnalyzeBackground" ${hasImage?"":"disabled"}>Analizar fotografía</button><button type="button" id="skUndoVisual">Restaurar diseño anterior</button></div>${app.visualProposals.length?`<div class="sk-token-proposals">${app.visualProposals.map(proposalMarkup).join("")}</div><div class="sk-ai-actions"><button type="button" class="primary" id="skApplyVisual">Aplicar propuesta seleccionada</button></div>`:""}</article><article class="sk-ai-card"><h4>Fusión inteligente del fondo</h4><p>${hasImage?"La fotografía está disponible. Ajusta cuánto se fusionan sus colores y superficies.":"Sube una imagen desde Diseño · Plataforma → SAKURA para activar la adaptación automática."}</p><div class="sk-ai-grid cols3"><label class="sk-ai-field"><span>Intensidad · ${app.fusion.intensity}%</span><input id="skFusionIntensity" type="range" min="20" max="100" value="${app.fusion.intensity}"></label><label class="sk-ai-field"><span>Transparencia chat · ${app.fusion.chatAlpha}%</span><input id="skFusionChat" type="range" min="12" max="85" value="${app.fusion.chatAlpha}"></label><label class="sk-ai-field"><span>Transparencia encabezado · ${app.fusion.headerAlpha}%</span><input id="skFusionHeader" type="range" min="18" max="90" value="${app.fusion.headerAlpha}"></label></div></article></div>`;
    const fusion=host.querySelector("#skFusionMode");if(fusion)fusion.value=app.fusion.mode;
    host.querySelector("#skGenerateVisual")?.addEventListener("click",()=>{try{generateVisualProposals(host.querySelector("#skVisualCommand").value)}catch(e){toast("No se pudo generar",e.message,"warning")}});
    host.querySelector("#skAnalyzeBackground")?.addEventListener("click",()=>analyzeBackground().catch(e=>toast("No se pudo analizar",e.message||String(e),"error")));
    host.querySelector("#skUndoVisual")?.addEventListener("click",rollbackVisual);host.querySelector("#skApplyVisual")?.addEventListener("click",()=>applyVisualProposal().catch(e=>toast("No se pudo aplicar",e.message||String(e),"error")));
    host.querySelectorAll("[data-visual-proposal]").forEach(b=>b.addEventListener("click",()=>{app.selectedVisualProposal=Number(b.dataset.visualProposal);renderDirector()}));
    fusion?.addEventListener("change",()=>{app.fusion.mode=fusion.value;saveJson(STORAGE.fusion,app.fusion);applyFusion(style)});
    [["#skFusionIntensity","intensity"],["#skFusionChat","chatAlpha"],["#skFusionHeader","headerAlpha"]].forEach(([sel,key])=>host.querySelector(sel)?.addEventListener("input",e=>{app.fusion[key]=Number(e.target.value);saveJson(STORAGE.fusion,app.fusion);applyFusion(style)}));
  }

  function renderWeb(){
    const host=document.getElementById("skViewWeb");if(!host)return;const campaigns=rows(stateNow().campaigns),tasks=rows(stateNow().tasks).filter(t=>!['aprobado','publicado','completado','finalizado'].includes(String(t.status||'').toLowerCase())),configured=!!runtimeSakura.webProvider || !!runtimeSakura.webEndpoint || app.flags.SAKURA_WEB_ENABLED;
    const target=app.web.target||"notebook",entityOptions=target==="campaign"?campaigns.map(c=>`<option value="${esc(c.id)}">${esc(c.name||"Campaña")}</option>`).join(""):target==="task"?tasks.slice(0,100).map(t=>`<option value="${esc(t.id)}">${esc(t.title||"Tarea")}</option>`).join(""):"";
    host.innerHTML=`<div class="sk-ai-panel"><article class="sk-ai-card"><h3>Explorador Web controlado</h3><p>Busca información, imágenes o videos sin exponer conversaciones privadas. Antes de buscar se muestra la consulta exacta.</p><div class="sk-ai-grid"><label class="sk-ai-field"><span>Tipo</span><select id="skWebType"><option value="web">Información</option><option value="news">Noticias</option><option value="images">Imágenes</option><option value="videos">Videos</option></select></label><label class="sk-ai-field"><span>Privacidad</span><select id="skWebPrivacy"><option value="off">Desactivado</option><option value="ask">Preguntar antes</option><option value="requested">Buscar cuando lo solicito</option><option value="domains">Solo dominios autorizados</option></select></label><label class="sk-ai-field wide"><span>Consulta exacta</span><textarea id="skWebQuery" placeholder="Ej. oficinas futuristas verticales para una campaña empresarial">${esc(app.web.query)}</textarea></label><label class="sk-ai-field wide"><span>Dominios autorizados, opcional</span><input id="skWebDomains" value="${esc(app.web.domains)}" placeholder="ej. behance.net, youtube.com"></label><label class="sk-ai-field"><span>Guardar resultado en</span><select id="skWebTarget"><option value="notebook">Cuaderno de investigación</option><option value="campaign">Campaña</option><option value="task">Tarea</option><option value="library">Biblioteca Visual</option><option value="creative">Creative Arena</option><option value="report">Reporte</option><option value="knowledge">Conocimiento pendiente</option></select></label>${["campaign","task"].includes(target)?`<label class="sk-ai-field"><span>${target==="campaign"?"Campaña":"Tarea"}</span><select id="skWebTargetEntity"><option value="">Seleccionar</option>${entityOptions}</select></label>`:""}</div><div class="sk-web-consent">${configured?"El proveedor se ejecuta desde Vercel; la clave nunca se envía al navegador.":"Explorador web no configurado. Define TAVILY_API_KEY en Vercel y activa SAKURA_WEB_ENABLED. Mientras tanto, usa búsqueda manual."}</div><div class="sk-ai-actions"><button type="button" class="primary" id="skRunWeb" ${app.webLoading?"disabled":""}>${app.webLoading?"Buscando…":"Revisar y buscar"}</button><button type="button" id="skManualWeb">Abrir búsqueda manual</button></div>${app.webResults.length?`<div class="sk-web-results">${app.webResults.map((r,i)=>`<article class="sk-web-result ${r.thumbnail?"":"no-image"}">${r.thumbnail?`<img class="sk-web-thumb" src="${esc(r.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:""}<div><strong>${esc(r.title||"Resultado")}</strong><p>${esc(r.snippet||r.description||"")}</p><div class="sk-web-meta"><span>${esc(r.source||safeHost(r.url))}</span>${r.publishedAt?`<span>${esc(r.publishedAt)}</span>`:""}<span>${esc(r.type||app.web.type)}</span></div><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Abrir fuente ↗</a><div class="sk-ai-actions"><button type="button" data-save-web="${i}">Guardar referencia</button></div></div></article>`).join("")}</div>`:""}</article><article class="sk-ai-card"><h4>Referencias guardadas</h4><p>${app.webSaved.length?`${app.webSaved.length} referencias con procedencia.`:"Aún no guardaste resultados."}</p><div class="sk-memory-list">${app.webSaved.slice().reverse().slice(0,30).map(r=>`<article class="sk-memory-item"><header><div><strong>${esc(r.title||"Referencia")}</strong><small>${esc(r.targetLabel||webTargetLabel(r.target,r.targetId))} · ${esc(r.source||safeHost(r.url))}</small></div><button type="button" data-delete-web-ref="${esc(r.id)}">Eliminar</button></header><p>${esc(String(r.snippet||"").slice(0,180))}</p><div class="sk-ai-actions"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Abrir fuente</a><button type="button" data-open-web-ref="${esc(r.id)}">Abrir destino</button></div></article>`).join("")}</div><div class="sk-ai-actions"><button type="button" id="skExportWeb">Exportar referencias</button></div></article></div>`;
    host.querySelector("#skWebType").value=app.web.type;host.querySelector("#skWebPrivacy").value=app.web.privacy;host.querySelector("#skWebTarget").value=target;if(host.querySelector("#skWebTargetEntity"))host.querySelector("#skWebTargetEntity").value=app.web.targetId||"";
    host.querySelector("#skWebType")?.addEventListener("change",e=>{app.web.type=e.target.value;saveJson(STORAGE.web,app.web)});host.querySelector("#skWebPrivacy")?.addEventListener("change",e=>{app.web.privacy=e.target.value;saveJson(STORAGE.web,app.web)});host.querySelector("#skWebTarget")?.addEventListener("change",e=>{app.web.target=e.target.value;app.web.targetId="";saveJson(STORAGE.web,app.web);renderWeb()});host.querySelector("#skWebTargetEntity")?.addEventListener("change",e=>{app.web.targetId=e.target.value;saveJson(STORAGE.web,app.web)});host.querySelector("#skRunWeb")?.addEventListener("click",runWebSearch);host.querySelector("#skManualWeb")?.addEventListener("click",manualSearch);host.querySelector("#skExportWeb")?.addEventListener("click",exportWebReferences);host.querySelectorAll("[data-save-web]").forEach(b=>b.addEventListener("click",()=>saveWebResult(Number(b.dataset.saveWeb))));host.querySelectorAll("[data-delete-web-ref]").forEach(b=>b.addEventListener("click",()=>{app.webSaved=app.webSaved.filter(x=>x.id!==b.dataset.deleteWebRef);saveJson(STORAGE.webSaved,app.webSaved);renderWeb()}));host.querySelectorAll("[data-open-web-ref]").forEach(b=>b.addEventListener("click",()=>openWebDestination(app.webSaved.find(x=>x.id===b.dataset.openWebRef))));
  }
  function safeHost(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return "Fuente web"}}

  function renderMemory(){
    const host=document.getElementById("skViewMemory");if(!host)return;const suggestions=pendingPatternSuggestions();
    host.innerHTML=`<div class="sk-ai-panel"><article class="sk-ai-card"><h3>Qué sabe SAKURA de mí</h3><p>Solo aparecen recuerdos explícitos, correcciones y patrones propuestos. Nada se convierte en conocimiento de área o empresa sin aprobación.</p><div class="sk-ai-grid"><label class="sk-ai-field"><span>Título</span><input id="skMemoryTitle" placeholder="Ej. Prefiero reportes breves"></label><label class="sk-ai-field"><span>Alcance</span><select id="skMemoryScope"><option value="personal">Solo para mí</option>${isManager()?'<option value="area">Proponer para mi área</option>':''}${isDirector()?'<option value="company">Proponer para la empresa</option>':''}</select></label><label class="sk-ai-field wide"><span>Contenido</span><textarea id="skMemoryContent" placeholder="Describe la preferencia, procedimiento o contexto…"></textarea></label></div><div class="sk-ai-actions"><button type="button" class="primary" id="skSaveMemory">Guardar aprendizaje supervisado</button><button type="button" id="skExportMemory">Exportar mis recuerdos</button></div><div class="sk-memory-list">${app.memories.slice().reverse().slice(0,40).map(m=>`<article class="sk-memory-item"><header><div><strong>${esc(m.title)}</strong><small>${esc(m.scope)} · ${new Date(m.createdAt).toLocaleDateString("es-PE")}</small></div><button type="button" data-delete-memory="${esc(m.id)}">Eliminar</button></header><p>${esc(m.content)}</p></article>`).join("")||'<p class="sk-note">No existen recuerdos explícitos todavía.</p>'}</div></article><article class="sk-ai-card"><h4>Patrones propuestos</h4><p>SAKURA solo propone después de observar la misma estructura varias veces; no guarda el contenido de tus conversaciones en este detector.</p><div class="sk-memory-list">${suggestions.map(([sig,row])=>`<article class="sk-memory-item"><header><div><strong>${esc(sig)}</strong><small>${row.count} repeticiones</small></div></header><div class="sk-ai-actions"><button type="button" data-accept-pattern="${esc(sig)}">Guardar para mí</button><button type="button" data-dismiss-pattern="${esc(sig)}">Descartar</button></div></article>`).join("")||'<p class="sk-note">No hay patrones pendientes.</p>'}</div></article><article class="sk-ai-card"><h4>Correcciones de interpretación</h4><p>${app.corrections.length} correcciones personales activas.</p><div class="sk-memory-list">${app.corrections.slice().reverse().slice(0,20).map(c=>`<article class="sk-memory-item"><header><div><strong>${esc(c.type)}</strong><small>${new Date(c.at).toLocaleDateString("es-PE")}</small></div><button type="button" data-delete-correction="${esc(c.id)}">Eliminar</button></header><p>${esc(c.detail||"Sin detalle adicional")}</p></article>`).join("")}</div></article></div>`;
    host.querySelector("#skSaveMemory")?.addEventListener("click",()=>{const title=host.querySelector("#skMemoryTitle").value.trim(),content=host.querySelector("#skMemoryContent").value.trim(),scope=host.querySelector("#skMemoryScope").value;if(!title||!content)return toast("Completa el aprendizaje","Escribe un título y contenido.","warning");addMemory(title,content,scope);toast("Aprendizaje guardado",scope==="personal"?"Solo se utiliza en tu perfil.":"Quedó como propuesta pendiente.");renderMemory()});
    host.querySelector("#skExportMemory")?.addEventListener("click",exportMemories);host.querySelectorAll("[data-delete-memory]").forEach(b=>b.addEventListener("click",()=>{app.memories=app.memories.filter(x=>x.id!==b.dataset.deleteMemory);saveJson(STORAGE.memories,app.memories);renderMemory()}));host.querySelectorAll("[data-delete-correction]").forEach(b=>b.addEventListener("click",()=>{app.corrections=app.corrections.filter(x=>x.id!==b.dataset.deleteCorrection);saveJson(STORAGE.corrections,app.corrections);renderMemory()}));
    host.querySelectorAll("[data-accept-pattern]").forEach(b=>b.addEventListener("click",()=>{const sig=b.dataset.acceptPattern;addMemory(`Patrón frecuente: ${sig}`,`SAKURA puede usar esta estructura como preferencia personal.`,"personal","pattern");app.patterns[sig].pending=false;app.patterns[sig].suggested=true;saveJson(STORAGE.patterns,app.patterns);renderMemory()}));host.querySelectorAll("[data-dismiss-pattern]").forEach(b=>b.addEventListener("click",()=>{const sig=b.dataset.dismissPattern;app.patterns[sig].pending=false;app.patterns[sig].suggested=true;saveJson(STORAGE.patterns,app.patterns);renderMemory()}));
  }
  function exportMemories(){const payload={schema:"inbestiga-sakura-supervised-memory",version:1,exportedAt:nowIso(),memories:app.memories,corrections:app.corrections};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`sakura_memoria_${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

  function augmentSettings(panel){
    const host=panel.querySelector("#skViewSettings");if(!host||host.querySelector("#skAdaptiveSettings"))return;const card=document.createElement("div");card.id="skAdaptiveSettings";card.className="sk-section";card.innerHTML=`<h3>Autonomía y módulos</h3><p>Desactiva cualquier capacidad sin afectar el resto de Marketing Cloud.</p><div class="sk-feature-flags">${Object.keys(BASE_FLAGS).filter(x=>x!=="SAKURA_ENABLED").map(key=>`<label class="sk-feature-flag"><span>${esc(key.replace("SAKURA_","").replace("_ENABLED","").replaceAll("_"," "))}</span><input type="checkbox" data-sk-feature="${key}" ${app.flags[key]!==false?"checked":""}></label>`).join("")}</div><div class="sk-action-actions"><button type="button" class="sk-secondary" id="skOpenLayout">Organizar paneles</button><button type="button" class="sk-secondary" id="skSafePanel">Reubicar en zona segura</button></div>`;host.appendChild(card);
    card.querySelectorAll("[data-sk-feature]").forEach(input=>input.addEventListener("change",()=>setFlag(input.dataset.skFeature,input.checked)));card.querySelector("#skOpenLayout")?.addEventListener("click",e=>showLayoutPopover(e.currentTarget));card.querySelector("#skSafePanel")?.addEventListener("click",()=>{recoverPanel();toast("Panel recuperado","El encabezado y controles quedaron dentro de la pantalla.")});
  }

  /* -------------------- Attach / lifecycle -------------------- */
  function enhancePanel(){
    const panel=document.getElementById("sakuraNativePanel");if(!panel)return false;app.panel=panel;panel.classList.add("sk-v17130-ready");
    if(!panel.querySelector("#skMovePanel")){const btn=document.createElement("button");btn.id="skMovePanel";btn.className="sk-icon-btn";btn.type="button";btn.title="Mover panel";btn.setAttribute("aria-label","Mover panel");btn.textContent="✥";panel.querySelector(".sk-head-actions")?.prepend(btn);btn.addEventListener("pointerdown",startDrag)}
    const dock=panel.querySelector("#skDockSide");if(dock){dock.textContent="▦";dock.title="Organizar espacio de trabajo";dock.onclick=e=>{e.preventDefault();showLayoutPopover(dock)}}
    const minimize=panel.querySelector("#skMinimize");if(minimize&&!minimize.dataset.skV17130Bound){minimize.dataset.skV17130Bound="1";minimize.onclick=e=>{e.preventDefault();const mode=panel.dataset.layoutMode||"right";if(mode==="compact")applyLayout(app.lastLayoutMode||"right");else applyLayout("compact",{previous:mode})}}
    installCores();addCustomViews(panel);installInputContextCapture(panel);augmentSettings(panel);applyFeatureFlags();updateSafeArea();restoreLayout();restoreComposerDraft();
    const style=window.INBESTIGA_SAKURA_STUDIO?.load?.()||{};applyFusion(style);syncCoreSettings(style);autoFuseIfNeeded(style);
    panel.querySelectorAll('[data-sk-tab]:not([data-sk-tab="director"]):not([data-sk-tab="web"]):not([data-sk-tab="memory"])').forEach(b=>b.addEventListener("click",()=>{restoreComposerOnBaseTab();if(b.dataset.skTab==="settings")requestAnimationFrame(()=>augmentSettings(panel))}));
    return true;
  }
  function wrapNativeOpen(){
    const api=window.INBESTIGA_SAKURA_NATIVE;if(!api?.open||api.open.__v17130)return;const base=api.open;const wrapped=function(){const result=base.apply(this,arguments);requestAnimationFrame(()=>{enhancePanel();window.INBESTIGA_SAKURA_STUDIO?.apply?.(window.INBESTIGA_SAKURA_STUDIO.load?.()||{}).then(style=>{applyFusion(style);syncCoreSettings(style)}).catch(()=>{})});return result};wrapped.__v17130=true;wrapped.__base=base;api.open=wrapped;
  }
  function wrapNavigation(){
    if(typeof window.navTo!=="function"||window.navTo.__sakuraV17130)return;const base=window.navTo;const wrapped=function(){const before=currentModule(),input=document.querySelector("#sakuraNativePanel #skInput");if(input)saveComposerDraft(input.value,before);const result=base.apply(this,arguments);requestAnimationFrame(()=>{if(document.getElementById("sakuraNativePanel")?.classList.contains("open")){restoreLayout(currentModule());restoreComposerDraft(currentModule())}});return result};wrapped.__sakuraV17130=true;wrapped.__base=base;window.navTo=wrapped;
  }
  function attach(){
    registerWorkspacePanel("sakuraNativePanel",{label:"SAKURA",getElement:()=>document.getElementById("sakuraNativePanel"),recover:recoverPanel,apply:mode=>applyLayout(mode||"right")});
    wrapNativeOpen();wrapNavigation();enhancePanel();installCores();applyFeatureFlags();
    if(app.visual)applyPlatformTokens(app.visual,{persist:false});
    document.documentElement.dataset.sakuraInternet=navigator.onLine?"unknown":"offline";
    if(!app.attached){app.attached=true;window.addEventListener("resize",updateSafeArea,{passive:true});window.addEventListener("online",()=>document.documentElement.dataset.sakuraInternet="unknown",{passive:true});window.addEventListener("offline",()=>document.documentElement.dataset.sakuraInternet="offline",{passive:true});document.addEventListener("visibilitychange",()=>document.documentElement.dataset.sakuraVisible=document.hidden?"false":"true",{passive:true});document.addEventListener("sakura:style-applied",e=>{const style=e.detail||{};syncCoreSettings(style);applyFusion(style);installCores();autoFuseIfNeeded(style)},{passive:true});document.addEventListener("pointermove",moveDrag,{passive:true});document.addEventListener("pointerup",endDrag,{passive:true});}
    registerBuild();return true;
  }
  function registerBuild(){
    try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"adaptive-safe-controller",polling:false,realtimeChannels:0,mutations:false,webProvider:"server-only"})}catch(_){}
    const build=window.INBESTIGA_BUILD||{};window.INBESTIGA_BUILD={...build,version:VERSION,name:"SAKURA ADAPTIVE INTELLIGENCE, VISUAL DIRECTOR & CONTROLLED WEB EXPLORER",modules:[...new Set([...(rows(build.modules)),MODULE])]};document.documentElement.dataset.inbestigaBuild=VERSION;
  }
  function health(){return{status:"ok",value:"SAKURA Adaptive Intelligence",detail:"Zona segura, layouts por módulo, 8 núcleos multicapa, fusión de imagen, memoria supervisada, Director Visual por tokens y Explorador Web controlado; sin consultas repetitivas, observadores globales ni canales de sincronización nuevos."}}

  const api={version:VERSION,attach,health,flags:()=>clone(app.flags),setFlag,layout:{apply:applyLayout,restore:restoreLayout,undo:undoLayout,reset:resetLayouts,recover:recoverWorkspacePanels,registerPanel:registerWorkspacePanel,listPanels:()=>[...workspacePanels.values()].map(x=>({id:x.id,label:x.label}))},fusion:{analyze:analyzeBackground,applyProposal:applyPaletteProposal,preferences:()=>clone(app.fusion)},memory:{list:()=>clone(app.memories),add:addMemory,corrections:()=>clone(app.corrections)},visual:{generate:generateVisualProposals,applyTokens:applyPlatformTokens,rollback:rollbackVisual},web:{search:runWebSearch,saved:()=>clone(app.webSaved)}};
  window.INBESTIGA_SAKURA_ADAPTIVE_INTELLIGENCE=api;
  window.INBESTIGA_SAKURA_FEATURES=api;
  registerBuild();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",attach,{once:true});else attach();
})();
