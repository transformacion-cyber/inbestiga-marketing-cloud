
/* INBESTIGA Marketing Cloud v17.15.15 · SAKURA Floating Draggable Orb Presence */
(()=>{
  "use strict";
  if(window.INBESTIGA_SAKURA_FLOATING_ORB?.version==="v17.15.15")return;
  const VERSION="v17.15.15";
  const MODULE="sakura-floating-orb-presence-v17-15-15";
  const STORAGE_PREFIX="inbestiga:sakura:floating-orb:";
  const orb=()=>document.getElementById("sakuraNativeLauncher");
  const tooltipShow=(node,on)=>{if(!node)return;node.dataset.skTooltip=on?"true":"false"};
  const viewport=()=>({w:window.innerWidth||document.documentElement.clientWidth||1280,h:window.innerHeight||document.documentElement.clientHeight||720});
  const safe=(node)=>{
    const styles=getComputedStyle(node);
    const width=parseFloat(styles.width)||96;
    const height=parseFloat(styles.height)||96;
    const margin=18;
    const {w,h}=viewport();
    return {width,height,minX:margin,minY:margin,maxX:Math.max(margin,w-width-margin),maxY:Math.max(margin,h-height-margin)};
  };
  const currentUserKey=()=>{
    try{
      const fromDataset=document.body?.dataset?.memberId||document.documentElement?.dataset?.memberId;
      if(fromDataset)return String(fromDataset);
      const member=(window.currentMember&&window.currentMember.id)||(window.currentUser&&window.currentUser.id);
      if(member)return String(member);
      const cached=JSON.parse(localStorage.getItem('ib_member_session')||'null');
      if(cached?.id)return String(cached.id);
      if(cached?.email)return String(cached.email);
    }catch{}
    return 'default';
  };
  const storageKey=()=>`${STORAGE_PREFIX}${currentUserKey()}`;
  const readPos=()=>{
    try{
      const data=JSON.parse(localStorage.getItem(storageKey())||"null");
      if(data&&Number.isFinite(data.x)&&Number.isFinite(data.y))return data;
    }catch{}
    return null;
  };
  const writePos=(x,y)=>{
    try{localStorage.setItem(storageKey(), JSON.stringify({x:Math.round(x),y:Math.round(y),version:VERSION,savedAt:new Date().toISOString()}));}catch{}
  };
  const resetPos=()=>{
    const node=orb(); if(!node) return;
    const {width,height,maxX,maxY}=safe(node);
    const x=Math.min(maxX, (viewport().w-width-26));
    const y=Math.min(maxY, (viewport().h-height-34));
    applyPos(node,x,y,false);
    writePos(x,y);
  };
  const clamp=(node,x,y)=>{
    const s=safe(node);
    return {x:Math.max(s.minX, Math.min(s.maxX, x)), y:Math.max(s.minY, Math.min(s.maxY, y))};
  };
  const applyPos=(node,x,y,markManual=true)=>{
    const p=clamp(node,x,y);
    node.style.left=`${p.x}px`;
    node.style.top=`${p.y}px`;
    node.style.right='auto';
    node.style.bottom='auto';
    node.dataset.skPosition=markManual?"manual":"default";
    return p;
  };
  const ensureStructure=()=>{
    const node=orb();
    if(!node) return null;
    if(node.dataset.skFloatingEnhanced==="true") return node;
    node.dataset.skFloatingEnhanced="true";
    node.dataset.skStaticOrb="v17.15.15";
    node.setAttribute('aria-label','Abrir SAKURA');
    node.innerHTML=`
      <span class="sk-orb-aura" aria-hidden="true"></span>
      <span class="sk-orb-ring ring-a" aria-hidden="true"></span>
      <span class="sk-orb-ring ring-b" aria-hidden="true"></span>
      <span class="sk-orb-ring ring-c" aria-hidden="true"></span>
      <span class="sk-orb-comet" aria-hidden="true"></span>
      <span class="sk-orb-particles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <span class="sk-orb-glyphs" aria-hidden="true"><i>✦</i><i>◌</i><i>✧</i><i>+</i></span>
      <span class="sakura-native-launcher-orb" aria-hidden="true"><i></i><b></b><em></em><u></u></span>
      <span class="sakura-native-launcher-copy"><strong>SAKURA</strong><small>Serenidad · Estoy aquí, a tu ritmo.</small></span>`;
    return node;
  };
  const installDefaultClick=()=>{
    const node=orb();
    if(!node||node.dataset.skFloatingClickBound==="true") return;
    node.dataset.skFloatingClickBound="true";
    node.addEventListener('click', event=>{
      if(node.dataset.skCancelClick==='true'){
        event.preventDefault();
        event.stopImmediatePropagation();
        node.dataset.skCancelClick='false';
        return;
      }
    }, true);
    node.addEventListener('dblclick', event=>{event.preventDefault(); resetPos();});
    node.addEventListener('mouseenter', ()=>tooltipShow(node,true), {passive:true});
    node.addEventListener('mouseleave', ()=>{if(node.dataset.skDragging!=="true")tooltipShow(node,false)}, {passive:true});
    node.addEventListener('focus', ()=>tooltipShow(node,true), {passive:true});
    node.addEventListener('blur', ()=>tooltipShow(node,false), {passive:true});
  };
  const installDrag=()=>{
    const node=orb();
    if(!node||node.dataset.skFloatingDragBound==="true") return;
    node.dataset.skFloatingDragBound="true";
    let state=null;
    const onMove=event=>{
      if(!state||event.pointerId!==state.pointerId)return;
      const dx=event.clientX-state.startX;
      const dy=event.clientY-state.startY;
      if(!state.moved && Math.hypot(dx,dy)>6){
        state.moved=true;
        node.dataset.skDragging="true";
        tooltipShow(node,false);
      }
      if(!state.moved)return;
      const next=applyPos(node, state.originX+dx, state.originY+dy, true);
      state.lastX=next.x; state.lastY=next.y;
    };
    const finish=event=>{
      if(!state||event.pointerId!==state.pointerId)return;
      try{node.releasePointerCapture(event.pointerId);}catch{}
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', finish);
      node.removeEventListener('pointercancel', finish);
      if(state.moved){
        node.dataset.skCancelClick='true';
        writePos(state.lastX, state.lastY);
      }
      node.dataset.skDragging="false";
      state=null;
    };
    node.addEventListener('pointerdown', event=>{
      if(event.button!==0&&event.pointerType!=="touch")return;
      const rect=node.getBoundingClientRect();
      state={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originX:rect.left,originY:rect.top,lastX:rect.left,lastY:rect.top,moved:false};
      try{node.setPointerCapture(event.pointerId);}catch{}
      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerup', finish);
      node.addEventListener('pointercancel', finish);
    });
  };
  const syncVisibility=()=>{
    const node=orb(); if(!node) return false;
    const ready=document.documentElement.dataset.inbestigaSession==="ready" || document.documentElement.dataset.inbestigaSession==="authenticated";
    const hidden=node.dataset.skUserHidden==="true";
    node.hidden=!(ready&&!hidden);
    node.setAttribute('aria-hidden', ready&&!hidden ? 'false' : 'true');
    if(ready&&!hidden){
      node.style.display='grid';
      node.style.visibility='visible';
      node.style.opacity='1';
      node.style.pointerEvents='auto';
    }
    return ready&&!hidden;
  };
  const restoreOrDefault=()=>{
    const node=orb(); if(!node) return;
    const saved=readPos();
    if(saved) applyPos(node, saved.x, saved.y, true);
    else resetPos();
  };
  const settle=()=>{
    const node=ensureStructure(); if(!node) return;
    installDefaultClick();
    installDrag();
    restoreOrDefault();
    syncVisibility();
  };
  const handleResize=()=>{
    const node=orb(); if(!node) return;
    const rect=node.getBoundingClientRect();
    const next=applyPos(node, rect.left, rect.top, node.dataset.skPosition==="manual");
    if(node.dataset.skPosition==="manual") writePos(next.x, next.y);
  };
  const init=()=>{
    settle();
    window.addEventListener('resize', handleResize, {passive:true});
    ['inbestiga:session-ready','inbestiga:authenticated-ui-ready','pageshow','focus'].forEach(name=>window.addEventListener(name, settle, {passive:true}));
    document.addEventListener('visibilitychange', ()=>{if(!document.hidden) settle();}, {passive:true});
    try{
      window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:'floating-draggable-orb',polling:false,realtimeChannels:0,mutationObservers:0,backendChanges:false});
    }catch{}
  };
  window.INBESTIGA_SAKURA_FLOATING_ORB=Object.freeze({version:VERSION,settle,resetPosition:resetPos,storageKey});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
