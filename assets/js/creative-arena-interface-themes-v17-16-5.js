/* INBESTIGA Marketing Cloud v17.16.5 · Creative Arena interface themes */
(()=>{
  "use strict";
  if(window.INBESTIGA_CREATIVE_ARENA_THEMES?.version==="v17.16.5")return;
  const VERSION="v17.16.5",MODULE="creative-arena-interface-themes-v17-16-5";
  const THEMES=Object.freeze([
    {id:"apple-studio",name:"Apple Studio",description:"Limpio, luminoso y ordenado.",accent:"#0071e3",soft:"#85c2ff",bg:"#f5f5f7",panel:"#ffffff",canvas:"linear-gradient(145deg,#f8fbff,#eef2f8)",text:"#1d1d1f",muted:"#6e6e73"},
    {id:"mythic-arena",name:"Mítica / Dota",description:"La apariencia épica original.",accent:"#ef9c41",soft:"#ffd18c",bg:"#071018",panel:"#171319",canvas:"linear-gradient(145deg,#131820,#080b10)",text:"#ffffff",muted:"#aeb4c0"},
    {id:"aurora-bloom",name:"Aurora Bloom",description:"Magia cromática que impulsa ideas.",accent:"#7c5cff",soft:"#ff8fd0",bg:"#f5f0ff",panel:"#ffffff",canvas:"linear-gradient(145deg,#e8f9ff,#fff0fa)",text:"#2c2137",muted:"#796b84"},
    {id:"sakura-dream",name:"Sakura Dream",description:"Suave, cálido y creativo.",accent:"#d94892",soft:"#ffafcf",bg:"#fff3f8",panel:"#fffdfd",canvas:"linear-gradient(145deg,#fff5fa,#f6efff)",text:"#39232e",muted:"#856b77"},
    {id:"prism-lab",name:"Prism Lab",description:"Iridescencia tecnológica y energía.",accent:"#5358ff",soft:"#45d7ff",bg:"#f2f7ff",panel:"#ffffff",canvas:"linear-gradient(145deg,#eff9ff,#f4efff)",text:"#1f2641",muted:"#6a7189"},
    {id:"emerald-spell",name:"Emerald Spell",description:"Naturaleza, claridad y encanto.",accent:"#168b68",soft:"#62d4ad",bg:"#eef9f4",panel:"#fbfffd",canvas:"linear-gradient(145deg,#edfff7,#e5f5ef)",text:"#18382e",muted:"#668278"},
    {id:"solar-forge",name:"Solar Forge",description:"Calidez dorada para construir.",accent:"#d47b16",soft:"#ffc766",bg:"#fff7e9",panel:"#fffdf8",canvas:"linear-gradient(145deg,#fff8e9,#ffedd4)",text:"#3d2c18",muted:"#8b765c"},
    {id:"nebula-atelier",name:"Nebula Atelier",description:"Cosmos profundo y magia visual.",accent:"#a878ff",soft:"#73dfff",bg:"#0b0c18",panel:"#19142c",canvas:"linear-gradient(145deg,#151b32,#1e1230)",text:"#f6f1ff",muted:"#b1a8c6"},
    {id:"midnight-ink",name:"Midnight Ink",description:"Oscuro, elegante y concentrado.",accent:"#589cff",soft:"#9bc6ff",bg:"#101216",panel:"#1b1e25",canvas:"linear-gradient(145deg,#161b25,#0e1118)",text:"#f5f7fb",muted:"#9da5b2"}
  ]);
  const root=()=>document.getElementById("creativeArenaCleanRoot");
  const slug=value=>String(value||"default").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,72)||"default";
  const userKey=()=>{
    const pill=document.getElementById("userPill")?.textContent?.trim();
    const bodyId=document.body?.dataset?.memberId||document.documentElement?.dataset?.memberId;
    return slug(bodyId||pill||"default");
  };
  const storageKey=()=>`inbestiga:creative-arena:interface-theme:${userKey()}`;
  const valid=id=>THEMES.some(theme=>theme.id===id);
  const saved=()=>{
    try{const id=localStorage.getItem(storageKey());return valid(id)?id:"apple-studio"}catch{return"apple-studio"}
  };
  const notify=(title,detail)=>{
    try{window.premiumToast?.(title,detail,"success")}catch{}
  };
  const apply=(id,{persist=true,announce=false}={})=>{
    const arena=root();if(!arena)return false;
    const chosen=valid(id)?id:"apple-studio";
    arena.dataset.caInterfaceTheme=chosen;
    if(persist){try{localStorage.setItem(storageKey(),chosen)}catch{}}
    arena.querySelectorAll("[data-ca-interface-theme-choice]").forEach(button=>{
      const active=button.dataset.caInterfaceThemeChoice===chosen;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",active?"true":"false");
    });
    const theme=THEMES.find(item=>item.id===chosen);
    const label=arena.querySelector("[data-ca-interface-theme-current]");
    if(label)label.textContent=theme?.name||"Apple Studio";
    if(announce)notify("Apariencia aplicada",`${theme?.name||"Apple Studio"} quedó guardado para tu usuario.`);
    return true;
  };
  const cardMarkup=theme=>`
    <button type="button" class="ca-interface-theme-card" data-ca-interface-theme-choice="${theme.id}"
      aria-pressed="false"
      style="--theme-accent:${theme.accent};--theme-soft:${theme.soft};--theme-bg:${theme.bg};--theme-panel:${theme.panel};--theme-canvas:${theme.canvas};--theme-text:${theme.text};--theme-muted:${theme.muted}">
      <span class="ca-interface-theme-preview" aria-hidden="true"><i></i><i></i><i></i></span>
      <strong>${theme.name}</strong>
      <small>${theme.description}</small>
    </button>`;
  const mount=()=>{
    const arena=root();if(!arena)return false;
    apply(saved(),{persist:false});
    const studio=arena.querySelector(".ca-theme-studio");
    const cards=arena.querySelector("#caThemeCards");
    if(!studio||!cards)return true;
    if(!arena.querySelector("#caInterfaceThemeStudio")){
      const section=document.createElement("section");
      section.id="caInterfaceThemeStudio";
      section.className="ca-interface-theme-studio";
      section.innerHTML=`
        <div class="ca-interface-theme-head">
          <div><span>ESTILO DE CREATIVE ARENA</span><h4>Elige el ambiente que te invite a crear</h4><p>Solo cambia la apariencia. Tus herramientas, tableros y funciones permanecen intactos.</p></div>
          <b class="ca-interface-theme-badge" data-ca-interface-theme-current>Apple Studio</b>
        </div>
        <div class="ca-interface-theme-grid">${THEMES.map(cardMarkup).join("")}</div>`;
      cards.insertAdjacentElement("beforebegin",section);
      const label=document.createElement("div");
      label.className="ca-board-palette-label";
      label.innerHTML="<strong>Paletas del lienzo</strong><span>Colores del board y fondos personales</span>";
      cards.insertAdjacentElement("beforebegin",label);
      section.addEventListener("click",event=>{
        const choice=event.target.closest("[data-ca-interface-theme-choice]");
        if(!choice)return;
        apply(choice.dataset.caInterfaceThemeChoice,{persist:true,announce:true});
      });
    }
    const heading=studio.querySelector(".ca-theme-heading h3");
    if(heading)heading.textContent="Apariencia y temas";
    const description=studio.querySelector(".ca-theme-heading p");
    if(description)description.textContent="El estilo de interfaz y las paletas se guardan de manera individual para cada usuario.";
    apply(saved(),{persist:false});
    return true;
  };
  const reset=()=>apply("apple-studio",{persist:true,announce:true});
  const init=()=>{
    mount();
    ["inbestiga:authenticated-ui-ready","pageshow","focus"].forEach(name=>window.addEventListener(name,mount,{passive:true}));
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)mount()},{passive:true});
    document.addEventListener("click",event=>{
      if(event.target?.closest?.("[data-view='theme'],[data-nav='creativeRoomsClean'],button[onclick*='creativeRoomsClean']"))setTimeout(mount,80);
    },{passive:true});
    try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"creative-arena-appearance-only",polling:false,realtimeChannels:0,mutationObservers:0,backendChanges:false})}catch{}
  };
  window.INBESTIGA_CREATIVE_ARENA_THEMES=Object.freeze({version:VERSION,themes:THEMES,mount,apply,reset,storageKey});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
