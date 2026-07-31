/* INBESTIGA Marketing Cloud v17.15.12 · SAKURA post-login orb visibility */
(()=>{
  "use strict";
  if(window.INBESTIGA_SAKURA_POST_LOGIN_ORB?.version==="v17.15.12")return;
  const VERSION="v17.15.12",MODULE="sakura-post-login-orb-visibility-v17-15-12";
  const appVisible=()=>{
    const screen=document.getElementById("appScreen");
    return !!screen&&!screen.classList.contains("hidden");
  };
  const silent=()=>{
    try{
      const prefs=JSON.parse(localStorage.getItem("inbestiga_sakura_user_preferences_v1")||"{}");
      return prefs?.presenceMode==="silent";
    }catch{return false}
  };
  const reveal=()=>{
    const launcher=document.getElementById("sakuraNativeLauncher");
    if(!launcher)return false;
    const shouldShow=appVisible()&&!silent();
    launcher.hidden=!shouldShow;
    if(shouldShow){
      launcher.removeAttribute("hidden");
      launcher.style.removeProperty("display");
      launcher.style.removeProperty("visibility");
      launcher.setAttribute("aria-hidden","false");
      launcher.dataset.skAmbientReady="true";
    }else{
      launcher.setAttribute("aria-hidden","true");
    }
    window.INBESTIGA_SAKURA_AFFECTIVE?.syncVisibility?.();
    return shouldShow;
  };
  const afterTransition=()=>{
    requestAnimationFrame(reveal);
    setTimeout(reveal,80);
    setTimeout(reveal,360);
  };
  const wrapShow=()=>{
    const original=window.show;
    if(typeof original!=="function"||original.__sakuraOrbVisibilityWrapped)return;
    const wrapped=function(screen,...args){
      const result=original.call(this,screen,...args);
      afterTransition();
      if(screen==="appScreen"){
        window.dispatchEvent(new CustomEvent("inbestiga:session-ready"));
      }else{
        window.dispatchEvent(new CustomEvent("inbestiga:session-ended"));
      }
      return result;
    };
    wrapped.__sakuraOrbVisibilityWrapped=true;
    wrapped.__sakuraOrbVisibilityBase=original;
    window.show=wrapped;
  };
  const init=()=>{
    wrapShow();
    afterTransition();
    window.addEventListener("pageshow",afterTransition,{passive:true});
    window.addEventListener("focus",afterTransition,{passive:true});
    window.addEventListener("inbestiga:session-ready",afterTransition,{passive:true});
    window.addEventListener("inbestiga:session-ended",afterTransition,{passive:true});
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)afterTransition()},{passive:true});
    document.addEventListener("click",event=>{
      if(event.target?.closest?.("#loginBtn,#loginForm,[data-login],[data-auth-submit]"))setTimeout(afterTransition,250);
    },{passive:true});
    try{
      window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{
        version:VERSION,
        mode:"post-login-ambient-orb-visibility",
        polling:false,
        realtimeChannels:0,
        mutationObservers:0,
        backendChanges:false
      });
    }catch{}
  };
  window.INBESTIGA_SAKURA_POST_LOGIN_ORB=Object.freeze({version:VERSION,reveal,afterTransition});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
