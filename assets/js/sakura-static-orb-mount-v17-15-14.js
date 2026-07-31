/* INBESTIGA Marketing Cloud v17.15.14 · static SAKURA orb mount */
(()=>{
  "use strict";
  if(window.INBESTIGA_SAKURA_STATIC_ORB?.version==="v17.15.14")return;
  const VERSION="v17.15.14",MODULE="sakura-static-orb-mount-v17-15-14";
  const prefs=()=>{
    try{return JSON.parse(localStorage.getItem("inbestiga_sakura_user_preferences_v1")||"{}")||{}}
    catch{return{}}
  };
  const ready=()=>document.documentElement.dataset.inbestigaSession==="ready";
  const orb=()=>document.getElementById("sakuraNativeLauncher");
  const bind=button=>{
    if(!button||button.dataset.skStaticBound==="true")return;
    button.dataset.skStaticBound="true";
    button.addEventListener("click",()=>{
      window.INBESTIGA_SAKURA_LOADER?.load?.().catch?.(error=>{
        try{window.premiumToast?.("SAKURA no pudo abrirse",error?.message||String(error),"error")}
        catch{console.error(error)}
      });
    });
  };
  const mount=()=>{
    const button=orb();
    if(!button)return false;
    bind(button);
    const silent=prefs().presenceMode==="silent";
    button.hidden=false;
    button.dataset.skSessionReady=ready()?"true":"false";
    button.dataset.skUserHidden=silent?"true":"false";
    button.setAttribute("aria-hidden",ready()&&!silent?"false":"true");
    button.style.removeProperty("display");
    button.style.removeProperty("visibility");
    button.style.removeProperty("opacity");
    if(ready()&&!silent){
      button.style.setProperty("display","flex","important");
      button.style.setProperty("visibility","visible","important");
      button.style.setProperty("opacity","1","important");
      button.style.setProperty("pointer-events","auto","important");
      button.dataset.skMounted="true";
    }else{
      button.style.setProperty("display","none","important");
      button.style.setProperty("pointer-events","none","important");
    }
    return ready()&&!silent;
  };
  const settle=()=>{
    mount();
    requestAnimationFrame(mount);
    setTimeout(mount,50);
    setTimeout(mount,180);
    setTimeout(mount,520);
  };
  const init=()=>{
    settle();
    [
      "inbestiga:session-ready",
      "inbestiga:authenticated-ui-ready",
      "inbestiga:pwa-ready",
      "pageshow",
      "focus"
    ].forEach(name=>window.addEventListener(name,settle,{passive:true}));
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)settle()},{passive:true});
    try{
      window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{
        version:VERSION,
        mode:"static-authenticated-orb",
        polling:false,
        realtimeChannels:0,
        mutationObservers:0,
        backendChanges:false
      });
    }catch{}
  };
  window.INBESTIGA_SAKURA_STATIC_ORB=Object.freeze({version:VERSION,mount,settle});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
