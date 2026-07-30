/* INBESTIGA Marketing Cloud v17.15.5 · SAKURA Chat Layout & Composer Diagnostics */
(()=>{
  "use strict";
  if(window.INBESTIGA_SAKURA_CHAT_HOTFIX?.version==="v17.15.5")return;
  const VERSION="v17.15.5";
  const MODULE="sakura-chat-composer-hotfix-v17-15-5";

  function inspect(){
    const panel=document.getElementById("sakuraNativePanel");
    const row=panel?.querySelector(".sk-composer-row");
    const mic=document.getElementById("skMic");
    const input=document.getElementById("skInput");
    const send=document.getElementById("skSend");
    if(!panel||!row||!mic||!input||!send)return{ok:true,present:false};
    const rr=row.getBoundingClientRect();
    const mr=mic.getBoundingClientRect();
    const ir=input.getBoundingClientRect();
    const sr=send.getBoundingClientRect();
    const sameRow=Math.abs(mr.top-ir.top)<5&&Math.abs(ir.top-sr.top)<5;
    const inputUsable=ir.width>=120;
    const inside=mr.left>=rr.left-2&&sr.right<=rr.right+2&&ir.left>=mr.right-2&&sr.left>=ir.right-2;
    const horizontalOverflow=panel.scrollWidth>panel.clientWidth+2;
    return{
      ok:sameRow&&inputUsable&&inside&&!horizontalOverflow,
      present:true,
      sameRow,
      inputUsable,
      inside,
      horizontalOverflow,
      rowWidth:Math.round(rr.width),
      inputWidth:Math.round(ir.width),
      mic:{left:Math.round(mr.left),top:Math.round(mr.top),width:Math.round(mr.width)},
      send:{left:Math.round(sr.left),top:Math.round(sr.top),width:Math.round(sr.width)}
    };
  }

  function health(){
    const result=inspect();
    return{
      status:result.ok?"ok":"warning",
      value:"SAKURA Chat & Composer",
      detail:result.present
        ?`Compositor ${result.sameRow?"en una fila":"desalineado"}; entrada ${result.inputWidth||0}px; desbordamiento horizontal ${result.horizontalOverflow?"detectado":"ausente"}.`
        :"SAKURA todavía no fue abierta en esta sesión.",
      diagnostics:result
    };
  }

  try{
    window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{
      version:VERSION,
      mode:"visual-chat-composer-hotfix",
      polling:false,
      realtimeChannels:0,
      mutations:false,
      dynamicCode:false,
      backendChanges:false,
      health
    });
  }catch(_){ }

  window.INBESTIGA_SAKURA_CHAT_HOTFIX=Object.freeze({version:VERSION,inspect,health});
})();
