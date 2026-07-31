/* INBESTIGA Marketing Cloud v17.15.13 · authenticated SAKURA orb mount */
(()=>{
  "use strict";
  if(window.INBESTIGA_SAKURA_AUTHENTICATED_ORB?.version==="v17.15.13")return;
  const VERSION="v17.15.13",MODULE="sakura-authenticated-orb-mount-v17-15-13";
  const appScreen=()=>document.getElementById("appScreen");
  const authenticated=()=>{
    const screen=appScreen();
    return !!screen&&!screen.classList.contains("hidden")&&!!document.getElementById("userPill")?.textContent?.trim();
  };
  const preferences=()=>{
    try{return JSON.parse(localStorage.getItem("inbestiga_sakura_user_preferences_v1")||"{}")||{}}
    catch{return{}}
  };
  const mount=()=>{
    if(!authenticated())return false;
    window.INBESTIGA_SAKURA_LOADER?.attach?.();
    const launcher=document.getElementById("sakuraNativeLauncher");
    if(!launcher)return false;
    const silent=preferences().presenceMode==="silent";
    launcher.hidden=false;
    launcher.dataset.skSessionReady="true";
    launcher.dataset.skUserHidden=silent?"true":"false";
    if(!silent){
      launcher.style.setProperty("display","flex","important");
      launcher.style.setProperty("visibility","visible","important");
      launcher.style.setProperty("opacity","1","important");
      launcher.style.setProperty("pointer-events","auto","important");
      launcher.setAttribute("aria-hidden","false");
      launcher.dataset.skAuthenticated="true";
      launcher.dataset.skAmbientReady="true";
    }else{
      launcher.style.setProperty("display","none","important");
      launcher.style.setProperty("pointer-events","none","important");
    }
    window.INBESTIGA_SAKURA_POST_LOGIN_ORB?.reveal?.();
    window.INBESTIGA_SAKURA_AFFECTIVE?.syncVisibility?.();
    return !silent;
  };
  const settle=()=>{
    requestAnimationFrame(mount);
    setTimeout(mount,60);
    setTimeout(mount,240);
    setTimeout(mount,700);
  };
  const init=()=>{
    settle();
    window.addEventListener("inbestiga:session-ready",settle,{passive:true});
    window.addEventListener("pageshow",settle,{passive:true});
    window.addEventListener("focus",settle,{passive:true});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)settle()},{passive:true});
    document.addEventListener("click",event=>{
      if(event.target?.closest?.("#sakuraTopNavButton"))setTimeout(mount,40);
    },{passive:true});
    try{
      window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{
        version:VERSION,
        mode:"authenticated-orb-direct-mount",
        polling:false,
        realtimeChannels:0,
        mutationObservers:0,
        backendChanges:false
      });
    }catch{}
  };
  window.INBESTIGA_SAKURA_AUTHENTICATED_ORB=Object.freeze({version:VERSION,mount,settle,authenticated});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
