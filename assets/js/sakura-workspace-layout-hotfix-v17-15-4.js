/* INBESTIGA Marketing Cloud v17.15.4 · SAKURA Workspace Layout Hotfix */
(()=>{
  "use strict";
  if(window.INBESTIGA_SAKURA_LAYOUT_HOTFIX?.version==="v17.15.4")return;
  const VERSION="v17.15.4";
  const MODULE="sakura-workspace-layout-hotfix-v17-15-4";

  function inspect(){
    const panel=document.getElementById("sakuraNativePanel");
    const screen=document.getElementById("appScreen");
    if(!panel||!screen)return{ok:true,present:false};
    const open=panel.classList.contains("open")&&!panel.classList.contains("minimized");
    const dock=panel.dataset.dock||"right";
    const panelRect=panel.getBoundingClientRect();
    const main=screen.querySelector(":scope > .main");
    const mainRect=main?.getBoundingClientRect?.();
    const mainStyle=main?getComputedStyle(main):null;
    const contentLeft=mainRect?mainRect.left+(parseFloat(mainStyle?.paddingLeft||"0")||0):0;
    const contentRight=mainRect?mainRect.right-(parseFloat(mainStyle?.paddingRight||"0")||0):0;
    const overlap=Boolean(open&&window.innerWidth>=1280&&mainRect&&(
      dock==="left"?contentLeft<panelRect.right-2:contentRight>panelRect.left+2
    ));
    const horizontalOverflow=panel.scrollWidth>panel.clientWidth+2;
    return{
      ok:!overlap&&!horizontalOverflow,
      present:true,
      open,
      dock,
      overlap,
      horizontalOverflow,
      panelWidth:Math.round(panelRect.width),
      contentLeft:Math.round(contentLeft),
      contentRight:Math.round(contentRight),
      viewportWidth:window.innerWidth
    };
  }

  function health(){
    const result=inspect();
    return{
      status:result.ok?"ok":"warning",
      value:"SAKURA Workspace Layout",
      detail:result.present
        ?`Panel ${result.open?"abierto":"cerrado"}; reserva estructural ${result.overlap?"con solapamiento":"correcta"}; desbordamiento horizontal ${result.horizontalOverflow?"detectado":"ausente"}.`
        :"SAKURA todavía no fue abierta en esta sesión.",
      diagnostics:result
    };
  }

  try{
    window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{
      version:VERSION,
      mode:"visual-layout-hotfix",
      polling:false,
      realtimeChannels:0,
      mutations:false,
      dynamicCode:false,
      backendChanges:false,
      health
    });
  }catch(_){ }

  window.INBESTIGA_SAKURA_LAYOUT_HOTFIX=Object.freeze({version:VERSION,inspect,health});
})();
