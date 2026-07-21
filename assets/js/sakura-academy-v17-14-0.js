/* INBESTIGA Marketing Cloud v17.14.0 · SAKURA Academy & Scientific Calculation Engine */
(() => {
  "use strict";
  if (window.INBESTIGA_SAKURA_ACADEMY?.version === "v17.14.0") return;

  const VERSION = "v17.14.0";
  const MODULE = "sakura-academy-v17-14-0";
  const DB_NAME = "inbestiga_sakura_academy_v1";
  const DB_VERSION = 1;
  const DOC_STORE = "documents";
  const CARD_STORE = "cards";
  const ATTEMPT_STORE = "attempts";
  const FALLBACK_KEY = "inbestiga_sakura_learning_fallback_v1";
  const SETTINGS_KEY = "inbestiga_sakura_academy_settings_v1";
  const MAX_FILE_BYTES = 2_500_000;
  const MAX_TEXT_CHARS = 180_000;
  const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json"]);
  const root = document.documentElement;
  const rows = value => Array.isArray(value) ? value : [];
  const uid = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const nowIso = () => new Date().toISOString();
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9πρμωθφλδσ+\-*/^=().,%\s]/g, " ").replace(/\s+/g, " ").trim();
  const firstName = () => String(window.member?.full_name || window.member?.name || "").trim().split(/\s+/)[0] || "Usuario";
  const ownerId = () => String(window.member?.id || window.member?.auth_user_id || "guest");
  const toast = (title, detail = "", tone = "success") => {
    try { if (window.premiumToast) return window.premiumToast(title, detail, tone); } catch {}
    console[tone === "error" ? "error" : "info"](`[SAKURA Academy ${VERSION}] ${title}`, detail);
  };

  const SUBJECTS = {
    mathematics: { label: "Matemáticas", icon: "∑", keywords: ["matematica", "algebra", "aritmetica", "geometria", "calculo", "ecuacion", "porcentaje", "fraccion", "raiz", "potencia", "trigonometria"] },
    physics: { label: "Física", icon: "⚛", keywords: ["fisica", "fuerza", "velocidad", "aceleracion", "energia", "potencia", "densidad", "masa", "newton", "ohm", "movimiento"] },
    chemistry: { label: "Química", icon: "⌬", keywords: ["quimica", "molar", "mol", "reaccion", "estequiometria", "elemento", "compuesto", "ph", "concentracion", "atomo"] },
    communication: { label: "Comunicación", icon: "✦", keywords: ["comunicacion", "redaccion", "argumento", "persuasion", "mensaje", "copy", "discurso", "coherencia", "gramatica", "ortografia"] },
    literature: { label: "Literatura", icon: "❦", keywords: ["literatura", "narrador", "personaje", "poesia", "novela", "cuento", "metafora", "simbolo", "genero", "movimiento literario"] },
    business: { label: "Empresa", icon: "◇", keywords: ["marketing", "ventas", "campana", "empresa", "proceso", "cliente", "inbestiga", "tarea", "kpi", "estrategia"] },
    general: { label: "General", icon: "◉", keywords: [] }
  };

  const CORE_FORMULAS = [
    { id:"core-speed", title:"Velocidad media", subject:"physics", aliases:["velocidad media","velocidad","rapidez"], expression:"d/t", resultSymbol:"v", resultUnit:"m/s", variables:[{key:"d",label:"distancia",aliases:["distancia","recorrido"],unit:"m"},{key:"t",label:"tiempo",aliases:["tiempo","duracion"],unit:"s"}], description:"Relación entre distancia recorrida y tiempo empleado en movimiento uniforme.", source:"SAKURA Academy Core" },
    { id:"core-force", title:"Segunda ley de Newton", subject:"physics", aliases:["fuerza","segunda ley de newton","newton"], expression:"m*a", resultSymbol:"F", resultUnit:"N", variables:[{key:"m",label:"masa",aliases:["masa"],unit:"kg"},{key:"a",label:"aceleración",aliases:["aceleracion"],unit:"m/s^2"}], description:"La fuerza neta es el producto de la masa por la aceleración.", source:"SAKURA Academy Core" },
    { id:"core-density", title:"Densidad", subject:"physics", aliases:["densidad"], expression:"m/V", resultSymbol:"ρ", resultUnit:"kg/m^3", variables:[{key:"m",label:"masa",aliases:["masa"],unit:"kg"},{key:"V",label:"volumen",aliases:["volumen"],unit:"m^3"}], description:"Cociente entre la masa y el volumen de una sustancia.", source:"SAKURA Academy Core" },
    { id:"core-work", title:"Trabajo mecánico", subject:"physics", aliases:["trabajo mecanico","trabajo"], expression:"F*d", resultSymbol:"W", resultUnit:"J", variables:[{key:"F",label:"fuerza",aliases:["fuerza"],unit:"N"},{key:"d",label:"desplazamiento",aliases:["desplazamiento","distancia"],unit:"m"}], description:"Trabajo realizado por una fuerza paralela al desplazamiento.", source:"SAKURA Academy Core" },
    { id:"core-power", title:"Potencia", subject:"physics", aliases:["potencia"], expression:"W/t", resultSymbol:"P", resultUnit:"W", variables:[{key:"W",label:"trabajo o energía",aliases:["trabajo","energia"],unit:"J"},{key:"t",label:"tiempo",aliases:["tiempo"],unit:"s"}], description:"Cantidad de trabajo o energía transferida por unidad de tiempo.", source:"SAKURA Academy Core" },
    { id:"core-ohm", title:"Ley de Ohm", subject:"physics", aliases:["ley de ohm","voltaje","resistencia electrica"], expression:"I*R", resultSymbol:"V", resultUnit:"V", variables:[{key:"I",label:"corriente",aliases:["corriente","intensidad"],unit:"A"},{key:"R",label:"resistencia",aliases:["resistencia"],unit:"ohm"}], description:"El voltaje es igual al producto de la corriente por la resistencia.", source:"SAKURA Academy Core" },
    { id:"core-kinetic", title:"Energía cinética", subject:"physics", aliases:["energia cinetica"], expression:"0.5*m*v^2", resultSymbol:"Ec", resultUnit:"J", variables:[{key:"m",label:"masa",aliases:["masa"],unit:"kg"},{key:"v",label:"velocidad",aliases:["velocidad"],unit:"m/s"}], description:"Energía asociada al movimiento de un cuerpo.", source:"SAKURA Academy Core" },
    { id:"core-ideal-gas", title:"Ley de gases ideales", subject:"chemistry", aliases:["gases ideales","gas ideal"], expression:"n*R*T/V", resultSymbol:"P", resultUnit:"Pa", variables:[{key:"n",label:"cantidad de sustancia",aliases:["moles","mol","cantidad de sustancia"],unit:"mol"},{key:"R",label:"constante de gases",aliases:["constante r"],unit:"J/(mol*K)",default:8.314462618},{key:"T",label:"temperatura",aliases:["temperatura"],unit:"K"},{key:"V",label:"volumen",aliases:["volumen"],unit:"m^3"}], description:"Presión de un gas ideal a partir de cantidad de sustancia, temperatura y volumen.", source:"SAKURA Academy Core" },
    { id:"core-percent", title:"Porcentaje de una cantidad", subject:"mathematics", aliases:["porcentaje","por ciento"], expression:"base*rate/100", resultSymbol:"resultado", resultUnit:"", variables:[{key:"base",label:"cantidad base",aliases:["cantidad","base","de"],unit:""},{key:"rate",label:"porcentaje",aliases:["porcentaje","tasa"],unit:"%"}], description:"Calcula un porcentaje de una cantidad.", source:"SAKURA Academy Core" }
  ];

  const UNIT_TABLE = {
    length: { label:"Longitud", base:"m", units:{ m:1, km:1000, cm:.01, mm:.001, um:1e-6, nm:1e-9, in:.0254, ft:.3048, yd:.9144, mi:1609.344 } },
    mass: { label:"Masa", base:"kg", units:{ kg:1, g:.001, mg:1e-6, ug:1e-9, lb:.45359237, oz:.028349523125, t:1000 } },
    time: { label:"Tiempo", base:"s", units:{ s:1, ms:.001, min:60, h:3600, day:86400 } },
    volume: { label:"Volumen", base:"m3", units:{ m3:1, l:.001, ml:1e-6, cm3:1e-6, ft3:.028316846592 } },
    speed: { label:"Velocidad", base:"m/s", units:{ "m/s":1, "km/h":1/3.6, "mi/h":.44704, "ft/s":.3048 } },
    pressure: { label:"Presión", base:"Pa", units:{ pa:1, kpa:1000, mpa:1e6, bar:100000, atm:101325, psi:6894.757293168 } },
    energy: { label:"Energía", base:"J", units:{ j:1, kj:1000, cal:4.184, kcal:4184, wh:3600, kwh:3.6e6 } },
    temperature: { label:"Temperatura", base:"K", units:{ c:"c", f:"f", k:"k" } }
  };

  const ATOMIC_WEIGHTS = {
    H:1.008, He:4.002602, Li:6.94, Be:9.0121831, B:10.81, C:12.011, N:14.007, O:15.999, F:18.998403163, Ne:20.1797,
    Na:22.98976928, Mg:24.305, Al:26.9815385, Si:28.085, P:30.973761998, S:32.06, Cl:35.45, Ar:39.948, K:39.0983, Ca:40.078,
    Sc:44.955908, Ti:47.867, V:50.9415, Cr:51.9961, Mn:54.938044, Fe:55.845, Co:58.933194, Ni:58.6934, Cu:63.546, Zn:65.38,
    Ga:69.723, Ge:72.63, As:74.921595, Se:78.971, Br:79.904, Kr:83.798, Rb:85.4678, Sr:87.62, Ag:107.8682, Cd:112.414,
    Sn:118.71, I:126.90447, Ba:137.327, Pt:195.084, Au:196.966569, Hg:200.592, Pb:207.2
  };

  let dbPromise = null;
  let mounted = false;
  let state = { activePane:"library", pendingFiles:[], selectedSubject:"all", query:"", cards:[], documents:[], settings:loadSettings() };

  function loadSettings(){
    try { return { autoMirror:true, showSources:true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null") }; }
    catch { return { autoMirror:true, showSources:true }; }
  }
  function saveSettings(){ try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch {} }

  function openDb(){
    if (dbPromise) return dbPromise;
    if (!window.indexedDB) return Promise.resolve(null);
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DOC_STORE)) {
          const store = db.createObjectStore(DOC_STORE, { keyPath:"id" });
          store.createIndex("owner", "ownerId", { unique:false });
          store.createIndex("status", "status", { unique:false });
        }
        if (!db.objectStoreNames.contains(CARD_STORE)) {
          const store = db.createObjectStore(CARD_STORE, { keyPath:"id" });
          store.createIndex("owner", "ownerId", { unique:false });
          store.createIndex("document", "documentId", { unique:false });
          store.createIndex("status", "status", { unique:false });
          store.createIndex("subject", "subject", { unique:false });
        }
        if (!db.objectStoreNames.contains(ATTEMPT_STORE)) {
          const store = db.createObjectStore(ATTEMPT_STORE, { keyPath:"id" });
          store.createIndex("owner", "ownerId", { unique:false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir Academia."));
    });
    return dbPromise;
  }

  async function tx(storeName, mode, operation){
    const db = await openDb();
    if (!db) return operation(null);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;
      try { result = operation(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error("Error de almacenamiento local."));
      transaction.onabort = () => reject(transaction.error || new Error("Operación cancelada."));
    });
  }

  async function getAll(storeName){
    const db = await openDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(rows(request.result));
      request.onerror = () => reject(request.error);
    });
  }
  async function put(storeName, value){
    const db = await openDb();
    if (!db) throw new Error("IndexedDB no está disponible en este navegador.");
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).put(value);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }
  async function remove(storeName, id){
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  function classifySubject(text){
    const n = normalize(text);
    let best = { id:"general", score:0 };
    for (const [id, subject] of Object.entries(SUBJECTS)) {
      if (id === "general") continue;
      const score = subject.keywords.reduce((sum, keyword) => sum + (n.includes(normalize(keyword)) ? 1 : 0), 0);
      if (score > best.score) best = { id, score };
    }
    return best.id;
  }

  function fileExtension(name){ return String(name||"").split(".").pop().toLowerCase(); }
  async function sha256(text){
    try {
      const bytes = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
    } catch { return normalize(text).slice(0,120); }
  }

  function sanitizeText(raw){
    const text = String(raw ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").slice(0, MAX_TEXT_CHARS);
    const warnings = [];
    if (/<script|javascript:|onerror\s*=|onload\s*=/i.test(text)) warnings.push("Se eliminaron fragmentos ejecutables.");
    if (/ignore (all|previous) instructions|system prompt|developer message|cambia tus permisos|omite las reglas|service_role/i.test(text)) warnings.push("Se detectaron instrucciones no académicas; se tratarán únicamente como texto no confiable.");
    const clean = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/javascript:/gi, "")
      .replace(/\bon(?:error|load|click)\s*=\s*["'][\s\S]*?["']/gi, "")
      .trim();
    return { text:clean, warnings };
  }

  async function readKnowledgeFile(file){
    if (!file) throw new Error("Selecciona un archivo.");
    if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera 2.5 MB. Divide el contenido antes de importarlo.");
    const ext = fileExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) throw new Error("Esta primera versión admite TXT, Markdown, CSV y JSON. PDF y DOCX quedan para el extractor documental posterior.");
    let raw = await file.text();
    if (ext === "json") {
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw new Error("El JSON no es válido."); }
      raw = jsonToKnowledgeText(parsed);
    } else if (ext === "csv") {
      raw = csvToKnowledgeText(raw);
    }
    const sanitized = sanitizeText(raw);
    if (sanitized.text.length < 20) throw new Error("El archivo no contiene suficiente texto útil.");
    return { ...sanitized, ext, name:file.name, size:file.size };
  }

  function jsonToKnowledgeText(value, path = ""){
    const lines = [];
    const walk = (node, current, depth) => {
      if (depth > 8) return;
      if (Array.isArray(node)) return node.slice(0,500).forEach((item,index)=>walk(item, `${current}[${index}]`, depth+1));
      if (node && typeof node === "object") return Object.entries(node).slice(0,500).forEach(([key,item])=>walk(item, current ? `${current}.${key}` : key, depth+1));
      lines.push(`${current || path || "valor"}: ${String(node ?? "")}`);
    };
    walk(value, path, 0);
    return lines.join("\n");
  }

  function csvToKnowledgeText(raw){
    const lines = String(raw).split(/\r?\n/).filter(Boolean).slice(0,3000);
    if (!lines.length) return "";
    const delimiter = (lines[0].match(/;/g)||[]).length > (lines[0].match(/,/g)||[]).length ? ";" : ",";
    const headers = lines[0].split(delimiter).map(x=>x.trim());
    return lines.slice(1).map((line,rowIndex)=>{
      const cells = line.split(delimiter);
      return `Registro ${rowIndex+1}: ` + headers.map((header,index)=>`${header || `campo_${index+1}`}=${String(cells[index]||"").trim()}`).join("; ");
    }).join("\n");
  }

  function splitSections(text){
    const blocks = String(text).split(/\n{2,}|(?=^#{1,4}\s+)/m).map(x=>x.trim()).filter(x=>x.length>=12);
    if (blocks.length <= 1) return String(text).split(/\n/).map(x=>x.trim()).filter(x=>x.length>=18).reduce((groups,line)=>{
      const last=groups[groups.length-1];
      if (!last || last.length+line.length>700) groups.push(line); else groups[groups.length-1]+=`\n${line}`;
      return groups;
    },[]);
    return blocks.slice(0,800);
  }

  function detectCardType(block){
    const n = normalize(block);
    if (/([a-zαρμωθφλδσ][a-z0-9_]*\s*=\s*[^\n]{1,120})/i.test(block) || /formula|ecuacion/.test(n)) return "formula";
    if (/^\s*(paso|1[.)]|primero|procedimiento|metodo)/i.test(block) || /pasos|procedimiento|metodo/.test(n)) return "method";
    if (/ejemplo|caso practico|resuelto/.test(n)) return "example";
    if (/estructura|regla|principio|criterio/.test(n)) return "framework";
    if (/\bes\b|se define|significa|consiste/.test(n)) return "definition";
    return "knowledge";
  }

  function detectFormula(block){
    const lines = String(block).split(/\n/).map(x=>x.trim()).filter(Boolean);
    for (const line of lines) {
      const normalizedLine = line.replace(/[×·]/g,"*").replace(/÷/g,"/").replace(/[−–]/g,"-").replace(/²/g,"^2").replace(/³/g,"^3");
      const match = normalizedLine.match(/(?:^|[:;])\s*([A-Za-zΑ-Ωα-ωρμωθφλδσ][A-Za-z0-9_ρμωθφλδσ]{0,12})\s*=\s*([A-Za-z0-9_ρμωθφλδσ+\-*/^().\s]{1,140})/);
      if (match) return { symbol:match[1], expression:match[2].trim().replace(/\s+/g,"") };
    }
    return null;
  }

  function titleFromBlock(block, index, type){
    const first = String(block).split(/\n/).map(x=>x.replace(/^#{1,5}\s*/,"").trim()).find(Boolean) || "";
    const colonTitle = first.match(/^([^:]{4,80}):/);
    if (colonTitle) return colonTitle[1].trim();
    if (first.length <= 82) return first;
    const labels = { formula:"Fórmula", method:"Método", example:"Ejemplo", framework:"Estructura", definition:"Definición", knowledge:"Conocimiento" };
    return `${labels[type] || "Ficha"} ${index+1}`;
  }

  async function extractCards(documentRecord){
    const sections = splitSections(documentRecord.text);
    const existing = await getAll(CARD_STORE);
    const ownerCards = existing.filter(card=>card.ownerId===ownerId());
    const cards = [];
    for (let index=0; index<sections.length; index++) {
      const content = sections[index].slice(0,2400);
      const type = detectCardType(content);
      const formula = type === "formula" ? detectFormula(content) : null;
      const title = titleFromBlock(content,index,type).slice(0,120);
      const subject = documentRecord.subject === "auto" ? classifySubject(`${title}\n${content}`) : documentRecord.subject;
      const fingerprint = await sha256(normalize(`${title}|${formula?.expression||""}|${content}`).slice(0,5000));
      const duplicate = ownerCards.find(card=>card.fingerprint===fingerprint || (normalize(card.title)===normalize(title) && normalize(card.content)===normalize(content)));
      const contradiction = ownerCards.find(card=>normalize(card.title)===normalize(title) && normalize(card.content)!==normalize(content) && card.status==="approved");
      cards.push({
        id:uid("academy-card"), documentId:documentRecord.id, ownerId:ownerId(), title, subject, type, content,
        formula, sourceName:documentRecord.sourceName, sourceType:documentRecord.sourceType, status:duplicate?"duplicate":"pending",
        confidence: formula ? .92 : type==="definition"||type==="framework" ? .82 : .68,
        warnings:[...(duplicate?["Duplicado detectado."]:[]),...(contradiction?[`Posible contradicción con “${contradiction.title}”.`]:[])],
        fingerprint, createdAt:nowIso(), updatedAt:nowIso(), version:1
      });
    }
    return cards.slice(0,500);
  }

  async function importFiles(files, subject = "auto"){
    const selected = [...files].slice(0,12);
    if (!selected.length) return [];
    const results = [];
    for (const file of selected) {
      try {
        const parsed = await readKnowledgeFile(file);
        const checksum = await sha256(parsed.text);
        const allDocs = await getAll(DOC_STORE);
        if (allDocs.some(doc=>doc.ownerId===ownerId() && doc.checksum===checksum)) {
          results.push({ file:file.name, ok:false, duplicate:true, reason:"Este archivo ya fue importado." });
          continue;
        }
        const documentRecord = {
          id:uid("academy-doc"), ownerId:ownerId(), title:file.name.replace(/\.[^.]+$/,"").slice(0,120), subject,
          sourceName:file.name, sourceType:parsed.ext, size:parsed.size, checksum, text:parsed.text,
          status:"pending", warnings:parsed.warnings, createdAt:nowIso(), updatedAt:nowIso(), version:1
        };
        await put(DOC_STORE,documentRecord);
        const cards = await extractCards(documentRecord);
        for (const card of cards) await put(CARD_STORE,card);
        results.push({ file:file.name, ok:true, document:documentRecord, cards:cards.length, warnings:parsed.warnings });
      } catch (error) { results.push({ file:file.name, ok:false, reason:error.message||String(error) }); }
    }
    await refreshData();
    return results;
  }

  function cardToLearning(card){
    const formulaText = card.formula ? `\nFórmula estructurada: ${card.formula.symbol} = ${card.formula.expression}` : "";
    return {
      id:`academy:${card.id}`, type:card.type==="formula"?"academic_formula":"academic_knowledge", scope:"personal", owner_id:ownerId(),
      title:`${SUBJECTS[card.subject]?.label||"Academia"} · ${card.title}`,
      content:`${card.content}${formulaText}\nFuente: ${card.sourceName || "Academia de SAKURA"}`.slice(0,10000),
      analysis:{subject:card.subject,academy_card_id:card.id,formula:card.formula||null,confidence:card.confidence},
      created_at:card.createdAt, updated_at:nowIso(), status:"active", source:"academy", version:card.version||1
    };
  }

  function mirrorApprovedCards(cards){
    if (!state.settings.autoMirror) return;
    try {
      const current = rows(JSON.parse(localStorage.getItem(FALLBACK_KEY)||"[]"));
      const map = new Map(current.map(entry=>[String(entry.id),entry]));
      cards.filter(card=>card.status==="approved").forEach(card=>map.set(`academy:${card.id}`,cardToLearning(card)));
      let merged=[...map.values()].slice(-320),json=JSON.stringify(merged);
      while(json.length>520000&&merged.length>1){merged=merged.slice(20);json=JSON.stringify(merged)}
      localStorage.setItem(FALLBACK_KEY,json);
      document.dispatchEvent(new CustomEvent("sakura:academy-updated",{detail:{approved:cards.filter(card=>card.status==="approved").length}}));
    } catch (error) { console.info("[SAKURA Academy] No se pudo sincronizar la memoria local", error?.message||error); }
  }

  async function approveDocument(documentId){
    const docs = await getAll(DOC_STORE);
    const documentRecord = docs.find(doc=>doc.id===documentId&&doc.ownerId===ownerId());
    if (!documentRecord) throw new Error("No se encontró el documento.");
    const cards = (await getAll(CARD_STORE)).filter(card=>card.documentId===documentId&&card.ownerId===ownerId());
    for (const card of cards) {
      if (card.status === "duplicate") continue;
      card.status="approved";card.updatedAt=nowIso();await put(CARD_STORE,card);
    }
    documentRecord.status="approved";documentRecord.updatedAt=nowIso();await put(DOC_STORE,documentRecord);
    mirrorApprovedCards(cards);
    await refreshData();
    return cards.filter(card=>card.status==="approved").length;
  }

  async function rejectDocument(documentId){
    const cards = (await getAll(CARD_STORE)).filter(card=>card.documentId===documentId&&card.ownerId===ownerId());
    for (const card of cards) await remove(CARD_STORE,card.id);
    await remove(DOC_STORE,documentId);
    await refreshData();
  }

  async function setCardStatus(cardId,status){
    const cards=await getAll(CARD_STORE),card=cards.find(item=>item.id===cardId&&item.ownerId===ownerId());
    if(!card)return false;card.status=status;card.updatedAt=nowIso();await put(CARD_STORE,card);mirrorApprovedCards([card]);await refreshData();return true;
  }

  async function deleteCard(cardId){
    const cards=await getAll(CARD_STORE),card=cards.find(item=>item.id===cardId&&item.ownerId===ownerId());
    if(!card)return false;await remove(CARD_STORE,cardId);
    try{const current=rows(JSON.parse(localStorage.getItem(FALLBACK_KEY)||"[]")).filter(entry=>entry.id!==`academy:${cardId}`);localStorage.setItem(FALLBACK_KEY,JSON.stringify(current))}catch{}
    await refreshData();return true;
  }

  async function seedCore(){
    const existing = await getAll(CARD_STORE);
    const ownerCards = existing.filter(card=>card.ownerId===ownerId());
    const added=[];
    for (const formula of CORE_FORMULAS) {
      const id=`${formula.id}:${ownerId()}`;
      if(ownerCards.some(card=>card.id===id))continue;
      const card={id,documentId:"academy-core-v17-14-0",ownerId:ownerId(),title:formula.title,subject:formula.subject,type:"formula",content:`${formula.description}\n${formula.resultSymbol} = ${formula.expression}`,formula:{symbol:formula.resultSymbol,expression:formula.expression,variables:formula.variables,aliases:formula.aliases,resultUnit:formula.resultUnit},sourceName:formula.source,sourceType:"core",status:"approved",confidence:1,warnings:[],fingerprint:`core:${formula.id}`,createdAt:nowIso(),updatedAt:nowIso(),version:1};
      await put(CARD_STORE,card);added.push(card);
    }
    if(added.length)mirrorApprovedCards(added);
    return added.length;
  }

  function tokens(text){return [...new Set(normalize(text).split(/\s+/).filter(word=>word.length>2))];}
  async function search(query,{limit=6,subject="all"}={}){
    const q=tokens(query);if(!q.length)return[];
    const cards=(state.cards.length?state.cards:await getAll(CARD_STORE)).filter(card=>card.ownerId===ownerId()&&card.status==="approved"&&(subject==="all"||card.subject===subject));
    return cards.map(card=>{
      const hay=normalize(`${card.title} ${card.content} ${card.formula?.expression||""} ${card.formula?.aliases?.join(" ")||""}`);
      let score=q.reduce((sum,word)=>sum+(hay.includes(word)?1:0),0);
      if(normalize(card.title).includes(normalize(query)))score+=4;
      return{...card,score};
    }).filter(card=>card.score>0).sort((a,b)=>b.score-a.score||b.confidence-a.confidence).slice(0,limit);
  }

  class ExpressionParser {
    constructor(input,variables={}){this.input=String(input||"").replace(/[×·]/g,"*").replace(/÷/g,"/").replace(/[−–]/g,"-").replace(/²/g,"^2").replace(/³/g,"^3");this.variables={pi:Math.PI,"π":Math.PI,e:Math.E,...variables};this.index=0;this.current=this.nextToken()}
    nextToken(){while(/\s/.test(this.input[this.index]||""))this.index++;if(this.index>=this.input.length)return{type:"eof"};const rest=this.input.slice(this.index);const number=rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?/i);if(number){this.index+=number[0].length;return{type:"number",value:Number(number[0])}}const id=rest.match(/^[A-Za-zΑ-Ωα-ωρμωθφλδσ_][A-Za-z0-9_Α-Ωα-ωρμωθφλδσ]*/);if(id){this.index+=id[0].length;return{type:"id",value:id[0]}}const char=this.input[this.index++];if("+-*/^(),%".includes(char))return{type:char,value:char};throw new Error(`Símbolo no permitido: ${char}`)}
    eat(type){if(this.current.type!==type)throw new Error(`Se esperaba “${type}”.`);const value=this.current;this.current=this.nextToken();return value}
    parse(){const value=this.expression();if(this.current.type!=="eof")throw new Error("La expresión contiene texto que no pude interpretar.");if(!Number.isFinite(value))throw new Error("El resultado no es finito.");return value}
    expression(){let value=this.term();while(this.current.type==="+"||this.current.type==="-"){const op=this.current.type;this.eat(op);const right=this.term();value=op==="+"?value+right:value-right}return value}
    term(){let value=this.power();while(this.current.type==="*"||this.current.type==="/"){const op=this.current.type;this.eat(op);const right=this.power();if(op==="/"&&right===0)throw new Error("No se puede dividir entre cero.");value=op==="*"?value*right:value/right}return value}
    power(){let value=this.unary();if(this.current.type==="^"){this.eat("^");value=Math.pow(value,this.power())}return value}
    unary(){if(this.current.type==="+"){this.eat("+");return this.unary()}if(this.current.type==="-"){this.eat("-");return-this.unary()}let value=this.primary();while(this.current.type==="%"){this.eat("%");value/=100}return value}
    primary(){if(this.current.type==="number")return this.eat("number").value;if(this.current.type==="("){this.eat("(");const value=this.expression();this.eat(")");return value}if(this.current.type==="id"){const name=this.eat("id").value;if(this.current.type==="("){this.eat("(");const args=[];if(this.current.type!==")"){args.push(this.expression());while(this.current.type===","){this.eat(",");args.push(this.expression())}}this.eat(")");return this.call(name,args)}if(Object.prototype.hasOwnProperty.call(this.variables,name))return Number(this.variables[name]);const lower=name.toLowerCase();if(Object.prototype.hasOwnProperty.call(this.variables,lower))return Number(this.variables[lower]);throw new Error(`Falta el valor de ${name}.`)}throw new Error("Expresión incompleta.")}
    call(name,args){const fn=String(name).toLowerCase(),one=()=>{if(args.length!==1)throw new Error(`${name} requiere un valor.`);return args[0]},two=()=>{if(args.length!==2)throw new Error(`${name} requiere dos valores.`);return args};switch(fn){case"sqrt":case"raiz":return Math.sqrt(one());case"abs":return Math.abs(one());case"sin":case"sen":return Math.sin(one());case"cos":return Math.cos(one());case"tan":return Math.tan(one());case"asin":return Math.asin(one());case"acos":return Math.acos(one());case"atan":return Math.atan(one());case"ln":return Math.log(one());case"log":return Math.log10(one());case"exp":return Math.exp(one());case"floor":return Math.floor(one());case"ceil":return Math.ceil(one());case"round":return Math.round(one());case"min":return Math.min(...args);case"max":return Math.max(...args);case"pow":{const[a,b]=two();return Math.pow(a,b)}case"deg":case"grados":return one()*Math.PI/180;default:throw new Error(`Función no permitida: ${name}.`)}}
  }

  function calculate(expression,variables={}){const parser=new ExpressionParser(expression,variables);const value=parser.parse();return{value,formatted:formatNumber(value),expression,variables:{...variables}}}
  function formatNumber(value){if(!Number.isFinite(value))return String(value);const abs=Math.abs(value);if((abs!==0&&abs<1e-6)||abs>=1e10)return value.toExponential(8).replace(/0+e/,"e");return Number(value.toPrecision(12)).toLocaleString("es-PE",{maximumFractionDigits:10})}

  function convertTemperature(value,from,to){const f=from.toLowerCase(),t=to.toLowerCase();let kelvin=f==="c"?value+273.15:f==="f"?(value-32)*5/9+273.15:value;return t==="c"?kelvin-273.15:t==="f"?(kelvin-273.15)*9/5+32:kelvin}
  function findUnit(unit){const needle=String(unit||"").trim().toLowerCase().replace(/³/g,"3");for(const[groupId,group]of Object.entries(UNIT_TABLE)){for(const key of Object.keys(group.units)){if(key.toLowerCase()===needle)return{groupId,group,key}}}return null}
  function convertUnit(value,from,to){const a=findUnit(from),b=findUnit(to);if(!a||!b)throw new Error("No reconozco una de las unidades.");if(a.groupId!==b.groupId)throw new Error("Las unidades pertenecen a magnitudes diferentes.");if(a.groupId==="temperature")return{value:convertTemperature(Number(value),a.key,b.key),group:a.group.label};return{value:Number(value)*a.group.units[a.key]/b.group.units[b.key],group:a.group.label}}

  function molarMass(formula){
    const input=String(formula||"").trim();if(!/^[A-Z][A-Za-z0-9()]*$/.test(input))throw new Error("Escribe una fórmula química como H2O, CO2 o Ca(OH)2.");let index=0;
    function number(){const match=input.slice(index).match(/^\d+/);if(!match)return 1;index+=match[0].length;return Number(match[0])}
    function group(stop=false){let total=0,composition={},closed=!stop;while(index<input.length){if(input[index]===")"){if(!stop)throw new Error("Paréntesis inesperado.");index++;closed=true;break}if(input[index]==="("){index++;const nested=group(true),multiplier=number();total+=nested.total*multiplier;for(const[k,v]of Object.entries(nested.composition))composition[k]=(composition[k]||0)+v*multiplier;continue}const match=input.slice(index).match(/^([A-Z][a-z]?)/);if(!match)throw new Error(`No pude interpretar la fórmula cerca de ${input.slice(index)}.`);const symbol=match[1];index+=symbol.length;if(!ATOMIC_WEIGHTS[symbol])throw new Error(`El elemento ${symbol} no está incluido en el catálogo básico.`);const count=number();total+=ATOMIC_WEIGHTS[symbol]*count;composition[symbol]=(composition[symbol]||0)+count}if(!closed)throw new Error("Falta cerrar un paréntesis en la fórmula química.");return{total,composition}}
    const result=group(false);if(index!==input.length)throw new Error("La fórmula química está incompleta.");return{formula:input,value:result.total,formatted:formatNumber(result.total),composition:result.composition,unit:"g/mol"}
  }

  function parseVariables(raw){
    const vars={};String(raw||"").split(/[;\n]+/).forEach(part=>{const match=part.trim().match(/^([A-Za-zΑ-Ωα-ωρμωθφλδσ_][\wΑ-Ωα-ωρμωθφλδσ]*)\s*=\s*(-?\d+(?:[.,]\d+)?(?:e[+\-]?\d+)?)/i);if(match)vars[match[1]]=Number(match[2].replace(",","."))});return vars;
  }

  function extractNumberNearAlias(text,aliases){
    for(const alias of aliases){const a=normalize(alias).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const normalized=normalize(text);let match=normalized.match(new RegExp(`${a}\\s*(?:de|=|es|:)??\\s*(-?\\d+(?:[.,]\\d+)?)`));if(match)return Number(match[1].replace(",","."));match=normalized.match(new RegExp(`(-?\\d+(?:[.,]\\d+)?)\\s*(?:[a-z/%^0-9]+\\s*)?${a}`));if(match)return Number(match[1].replace(",","."))}return null;
  }

  function matchCoreFormula(text){const n=normalize(text);return CORE_FORMULAS.map(formula=>({formula,score:formula.aliases.reduce((sum,alias)=>sum+(n.includes(normalize(alias))?1:0),0)})).sort((a,b)=>b.score-a.score)[0]}
  function solveNaturalFormula(text){
    const match=matchCoreFormula(text);if(!match||match.score===0)return null;const formula=match.formula,vars={};const missing=[];
    for(const variable of formula.variables){let value=variable.default??extractNumberNearAlias(text,variable.aliases||[variable.label]);if(value===null||value===undefined||Number.isNaN(value))missing.push(variable.label);else vars[variable.key]=value}
    if(missing.length)return{handled:true,text:`Para usar ${formula.title} necesito: ${missing.join(", ")}. Puedes escribir, por ejemplo: “${formula.aliases[0]} con ${formula.variables.filter(v=>v.default===undefined).map((v,i)=>`${v.label} ${i+2}`).join(" y ")}”.`};
    const result=calculate(formula.expression,vars);const substitutions=formula.variables.map(v=>`${v.key}=${vars[v.key]}`).join(", ");return{handled:true,text:`Usé ${formula.title}: ${formula.resultSymbol} = ${formula.expression}.\nSustitución: ${substitutions}.\nResultado: ${formula.resultSymbol} = ${result.formatted}${formula.resultUnit?` ${formula.resultUnit}`:""}.\nFuente: ${formula.source}.`};
  }

  async function answer(text){
    const raw=String(text||"").trim(),n=normalize(raw);if(!raw)return{handled:false};
    const unitMatch=raw.match(/(?:convierte|convertir)\s+(-?\d+(?:[.,]\d+)?)\s*([a-zA-Z/³^0-9]+)\s+(?:a|en)\s+([a-zA-Z/³^0-9]+)/i);
    if(unitMatch){try{const result=convertUnit(Number(unitMatch[1].replace(",",".")),unitMatch[2],unitMatch[3]);return{handled:true,text:`${unitMatch[1]} ${unitMatch[2]} equivalen a ${formatNumber(result.value)} ${unitMatch[3]}. Magnitud: ${result.group}.`}}catch(error){return{handled:true,text:error.message}}}
    const molar=raw.match(/(?:masa molar|peso molecular)(?:\s+de)?\s+([A-Z][A-Za-z0-9()]*)/i);
    if(molar){try{const result=molarMass(molar[1]);return{handled:true,text:`La masa molar de ${result.formula} es ${result.formatted} g/mol. Composición: ${Object.entries(result.composition).map(([k,v])=>`${k}${v>1?`×${v}`:""}`).join(", ")}.`}}catch(error){return{handled:true,text:error.message}}}
    const direct=raw.match(/^(?:\/calc|calcula|calcular|cuanto es|cuánto es|resuelve)\s*[:：]?\s*(.+)$/i);
    const directExpression=direct?.[1]?.replace(/[?¿!¡.]+$/g,"").trim()||"";
    const looksLikeExpression=/^[0-9πe().,+\-*/^\s]+$/i.test(directExpression)||/^(sqrt|raiz|abs|sin|sen|cos|tan|asin|acos|atan|ln|log|exp|min|max|pow|round|floor|ceil)\s*\(/i.test(directExpression);
    if(direct&&looksLikeExpression){try{const result=calculate(directExpression);return{handled:true,text:`Resultado: ${result.formatted}\nOperación interpretada: ${result.expression}.`}}catch(error){return{handled:true,text:`No pude calcularlo todavía: ${error.message}`}}}
    const natural=/(calcula|calcular|resuelve|resultado|con|si |cuando |tiene|masa|distancia|tiempo|aceleracion|corriente|resistencia|volumen|temperatura|moles)/.test(n)&&/\d/.test(n)?solveNaturalFormula(raw):null;if(natural)return natural;
    if(/formula|fórmula|como se calcula|cómo se calcula|estructura|metodo|método|definicion|definición/.test(n)){
      const found=await search(raw,{limit:3});if(found.length){const top=found[0],formula=top.formula?`\nFórmula: ${top.formula.symbol} = ${top.formula.expression}.`:"";return{handled:true,text:`Según mi Academia: ${top.title}. ${top.content.slice(0,650)}${formula}\nFuente: ${top.sourceName}.`}}
    }
    return{handled:false};
  }

  function libraryStats(){const approved=state.cards.filter(c=>c.status==="approved"),pending=state.cards.filter(c=>c.status==="pending"),formulas=approved.filter(c=>c.type==="formula");return{approved:approved.length,pending:pending.length,formulas:formulas.length,documents:state.documents.length}}

  async function refreshData(){
    const [cards,documents]=await Promise.all([getAll(CARD_STORE),getAll(DOC_STORE)]);
    state.cards=cards.filter(card=>card.ownerId===ownerId());state.documents=documents.filter(doc=>doc.ownerId===ownerId());
    if(mounted)renderAcademy();
    return state;
  }

  function subjectOptions(selected="auto",includeAuto=true){return `${includeAuto?`<option value="auto" ${selected==="auto"?"selected":""}>Detectar automáticamente</option>`:""}${Object.entries(SUBJECTS).map(([id,s])=>`<option value="${id}" ${selected===id?"selected":""}>${esc(s.label)}</option>`).join("")}`}
  function renderAcademy(){
    const host=document.getElementById("skAcademyMount");if(!host)return false;mounted=true;const stats=libraryStats();
    host.innerHTML=`<section class="ska-shell" data-ska-pane="${esc(state.activePane)}">
      <header class="ska-hero"><div><span>SAKURA ACADEMY · ${VERSION}</span><h3>Aprende, calcula y comprueba</h3><p>Biblioteca académica local, fórmulas estructuradas y motores exactos. Nada se incorpora sin aprobación.</p></div><div class="ska-hero-stats"><b>${stats.formulas}<small>fórmulas</small></b><b>${stats.approved}<small>fichas aprobadas</small></b><b>${stats.pending}<small>por revisar</small></b></div></header>
      <nav class="ska-tabs">${[["library","Biblioteca"],["import","Subir archivos"],["calculator","Calcular"],["practice","Practicar"],["settings","Control"]].map(([id,label])=>`<button type="button" data-ska-pane="${id}" class="${state.activePane===id?"active":""}">${label}</button>`).join("")}</nav>
      <div class="ska-content">${paneMarkup()}</div>
    </section>`;
    bindAcademy(host);return true;
  }

  function paneMarkup(){switch(state.activePane){case"import":return importPane();case"calculator":return calculatorPane();case"practice":return practicePane();case"settings":return settingsPane();default:return libraryPane()}}
  function libraryPane(){
    const cards=state.cards.filter(card=>card.status==="approved"&&(state.selectedSubject==="all"||card.subject===state.selectedSubject)&&(!state.query||normalize(`${card.title} ${card.content}`).includes(normalize(state.query)))).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return `<div class="ska-toolbar"><input id="skaSearch" value="${esc(state.query)}" placeholder="Buscar fórmula, concepto o estructura"><select id="skaSubjectFilter"><option value="all">Todas las materias</option>${Object.entries(SUBJECTS).map(([id,s])=>`<option value="${id}" ${state.selectedSubject===id?"selected":""}>${esc(s.label)}</option>`).join("")}</select><button type="button" class="sk-secondary" data-ska-refresh>Actualizar</button></div><div class="ska-card-grid">${cards.length?cards.slice(0,120).map(card=>cardMarkup(card)).join(""):'<div class="ska-empty">Aún no hay fichas aprobadas. Sube un archivo o activa la biblioteca base.</div>'}</div>`;
  }
  function cardMarkup(card){const subject=SUBJECTS[card.subject]||SUBJECTS.general;return `<article class="ska-card"><div class="ska-card-top"><span class="ska-subject">${subject.icon} ${esc(subject.label)}</span><span>${Math.round((card.confidence||0)*100)}%</span></div><h4>${esc(card.title)}</h4><p>${esc(card.content.slice(0,260))}${card.content.length>260?"…":""}</p>${card.formula?`<code>${esc(card.formula.symbol)} = ${esc(card.formula.expression)}</code>`:""}<div class="ska-source">${esc(card.sourceName||"Academia")}</div><div class="ska-actions"><button type="button" data-ska-use-card="${esc(card.id)}">Usar</button><button type="button" data-ska-delete-card="${esc(card.id)}">Eliminar</button></div></article>`}
  function importPane(){
    const pendingDocs=state.documents.filter(doc=>doc.status==="pending").sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    return `<div class="ska-import-grid"><section class="ska-panel"><h4>Subir conocimiento</h4><p>Formatos seguros en esta versión: TXT, Markdown, CSV y JSON. El contenido se extrae, clasifica y deja en revisión.</p><label class="ska-drop"><input id="skaFileInput" type="file" multiple accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,text/csv,application/json"><strong>Seleccionar archivos</strong><span>Máximo 12 archivos y 2.5 MB por archivo</span></label><div class="ska-field"><label>Materia</label><select id="skaImportSubject">${subjectOptions("auto",true)}</select></div><button type="button" class="sk-primary" id="skaImportButton">Analizar archivos</button><div id="skaImportStatus" class="ska-status"></div><p class="ska-note">Los archivos nunca pueden cambiar permisos, ejecutar código ni modificar la personalidad de SAKURA.</p></section><section class="ska-panel"><h4>Documentos por revisar</h4><div class="ska-doc-list">${pendingDocs.length?pendingDocs.map(doc=>docMarkup(doc)).join(""):'<div class="ska-empty">No hay documentos pendientes.</div>'}</div></section></div>`;
  }
  function docMarkup(doc){const cards=state.cards.filter(card=>card.documentId===doc.id),duplicates=cards.filter(card=>card.status==="duplicate").length,warnings=[...(doc.warnings||[]),...cards.flatMap(card=>card.warnings||[])];return `<article class="ska-doc"><div><strong>${esc(doc.title)}</strong><span>${esc(SUBJECTS[doc.subject]?.label||"Detección automática")} · ${cards.length} fichas${duplicates?` · ${duplicates} duplicadas`:""}</span></div>${warnings.length?`<p>${esc([...new Set(warnings)].slice(0,3).join(" "))}</p>`:""}<div class="ska-actions"><button type="button" class="sk-primary" data-ska-approve-doc="${esc(doc.id)}">Aprobar conocimiento</button><button type="button" data-ska-review-doc="${esc(doc.id)}">Ver fichas</button><button type="button" data-ska-reject-doc="${esc(doc.id)}">Descartar</button></div></article>`}
  function calculatorPane(){return `<div class="ska-calc-grid"><section class="ska-panel"><h4>Calculadora científica</h4><div class="ska-field"><label>Expresión</label><input id="skaExpression" placeholder="Ej. sqrt(144) + 3^2"></div><div class="ska-field"><label>Variables opcionales</label><input id="skaVariables" placeholder="Ej. m=5; a=3"></div><button type="button" class="sk-primary" id="skaCalculate">Calcular exactamente</button><div id="skaCalcResult" class="ska-result">Admite +, −, ×, ÷, potencias, raíces, trigonometría y logaritmos.</div></section><section class="ska-panel"><h4>Conversión de unidades</h4><div class="ska-unit-row"><input id="skaUnitValue" type="number" step="any" value="1"><input id="skaUnitFrom" value="km" placeholder="km"><span>→</span><input id="skaUnitTo" value="m" placeholder="m"></div><button type="button" id="skaConvert" class="sk-primary">Convertir</button><div id="skaUnitResult" class="ska-result">Longitud, masa, tiempo, volumen, velocidad, presión, energía y temperatura.</div></section><section class="ska-panel"><h4>Masa molar básica</h4><div class="ska-field"><label>Fórmula química</label><input id="skaChemicalFormula" value="H2O" placeholder="Ej. C6H12O6"></div><button type="button" id="skaMolarMass" class="sk-primary">Calcular masa molar</button><div id="skaChemResult" class="ska-result">Catálogo local de elementos químicos comunes.</div></section><section class="ska-panel"><h4>Aplicar fórmula aprendida</h4><div class="ska-field"><label>Fórmula</label><select id="skaFormulaSelect"><option value="">Seleccionar</option>${state.cards.filter(card=>card.status==="approved"&&card.formula).map(card=>`<option value="${esc(card.id)}">${esc(card.title)}</option>`).join("")}</select></div><div class="ska-field"><label>Valores</label><input id="skaFormulaVariables" placeholder="Ej. m=5; a=3"></div><button type="button" id="skaApplyFormula" class="sk-primary">Aplicar fórmula</button><div id="skaFormulaResult" class="ska-result">La fórmula, variables y fuente quedarán visibles.</div></section></div>`}
  function practicePane(){const formulas=state.cards.filter(card=>card.status==="approved"&&card.formula);const card=formulas[Math.floor(Math.random()*Math.max(1,formulas.length))];if(!card)return'<div class="ska-empty">Aprueba al menos una fórmula para practicar.</div>';return `<section class="ska-panel ska-practice" data-practice-card="${esc(card.id)}"><span>PRÁCTICA GUIADA</span><h4>¿Qué fórmula corresponde a “${esc(card.title)}”?</h4><p>${esc(card.content.slice(0,300))}</p><div class="ska-field"><label>Escribe la expresión</label><input id="skaPracticeAnswer" placeholder="Ej. m*a"></div><button type="button" id="skaCheckPractice" class="sk-primary">Comprobar</button><button type="button" data-ska-new-practice>Otro ejercicio</button><div id="skaPracticeResult" class="ska-result">SAKURA comparará la estructura matemática, no solo el texto exacto.</div></section>`}
  function settingsPane(){return `<div class="ska-import-grid"><section class="ska-panel"><h4>Control de aprendizaje</h4><label class="ska-switch"><input id="skaAutoMirror" type="checkbox" ${state.settings.autoMirror?"checked":""}><span>Usar fichas aprobadas en el chat de SAKURA</span></label><label class="ska-switch"><input id="skaShowSources" type="checkbox" ${state.settings.showSources?"checked":""}><span>Mostrar siempre la fuente</span></label><div class="ska-actions"><button type="button" id="skaExport" class="sk-secondary">Exportar Academia</button><label class="sk-secondary ska-import-backup">Importar respaldo<input id="skaImportBackup" type="file" accept="application/json,.json"></label><button type="button" id="skaSeedCore" class="sk-primary">Restaurar fórmulas base</button></div></section><section class="ska-panel"><h4>Seguridad y alcance</h4><ul><li>Almacenamiento personal en IndexedDB.</li><li>Sin SQL, Realtime, polling ni observadores globales.</li><li>Sin eval ni Function dinámica.</li><li>Conocimiento externo siempre pendiente de aprobación.</li><li>Los archivos no pueden modificar permisos ni ejecutar instrucciones.</li></ul></section></div>`}

  function bindAcademy(host){
    host.querySelectorAll("[data-ska-pane]").forEach(button=>button.addEventListener("click",()=>{state.activePane=button.dataset.skaPane;renderAcademy()}));
    host.querySelector("#skaSearch")?.addEventListener("input",event=>{state.query=event.target.value;clearTimeout(event.target._timer);event.target._timer=setTimeout(renderAcademy,120)});
    host.querySelector("#skaSubjectFilter")?.addEventListener("change",event=>{state.selectedSubject=event.target.value;renderAcademy()});
    host.querySelector("[data-ska-refresh]")?.addEventListener("click",refreshData);
    host.querySelector("#skaImportButton")?.addEventListener("click",async()=>{const input=host.querySelector("#skaFileInput"),subject=host.querySelector("#skaImportSubject")?.value||"auto",status=host.querySelector("#skaImportStatus");if(!input?.files?.length){toast("Selecciona archivos","Todavía no hay archivos para analizar.","warning");return}status.textContent="Analizando y estructurando conocimiento…";const results=await importFiles(input.files,subject);const ok=results.filter(r=>r.ok),fail=results.filter(r=>!r.ok);status.innerHTML=`<strong>${ok.length} archivo(s) procesado(s).</strong>${fail.length?`<span>${esc(fail.map(x=>`${x.file}: ${x.reason}`).join(" · "))}</span>`:""}`;input.value="";toast(ok.length?"Archivos analizados":"No se incorporaron archivos",ok.length?"Revisa las fichas antes de aprobarlas.":fail[0]?.reason||"Revisa el formato.",ok.length?"success":"error")});
    host.querySelectorAll("[data-ska-approve-doc]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{const count=await approveDocument(button.dataset.skaApproveDoc);toast("Conocimiento aprobado",`${count} ficha(s) ya están disponibles para SAKURA.`)}catch(error){toast("No se pudo aprobar",error.message,"error")}}));
    host.querySelectorAll("[data-ska-reject-doc]").forEach(button=>button.addEventListener("click",async()=>{if(!confirm("¿Descartar este documento y sus fichas pendientes?"))return;await rejectDocument(button.dataset.skaRejectDoc);toast("Documento descartado","No se incorporó ningún conocimiento.")}));
    host.querySelectorAll("[data-ska-review-doc]").forEach(button=>button.addEventListener("click",()=>showDocumentReview(button.dataset.skaReviewDoc)));
    host.querySelectorAll("[data-ska-delete-card]").forEach(button=>button.addEventListener("click",async()=>{if(!confirm("¿Eliminar esta ficha de la Academia?"))return;await deleteCard(button.dataset.skaDeleteCard);toast("Ficha eliminada","SAKURA dejó de utilizarla.")}));
    host.querySelectorAll("[data-ska-use-card]").forEach(button=>button.addEventListener("click",()=>{state.activePane="calculator";renderAcademy();requestAnimationFrame(()=>{const select=document.getElementById("skaFormulaSelect");if(select){select.value=button.dataset.skaUseCard;select.dispatchEvent(new Event("change"))}})}));
    host.querySelector("#skaCalculate")?.addEventListener("click",()=>{const out=host.querySelector("#skaCalcResult");try{const result=calculate(host.querySelector("#skaExpression").value,parseVariables(host.querySelector("#skaVariables").value));out.innerHTML=`<strong>${esc(result.formatted)}</strong><span>${esc(result.expression)}</span>`}catch(error){out.textContent=error.message}});
    host.querySelector("#skaConvert")?.addEventListener("click",()=>{const out=host.querySelector("#skaUnitResult");try{const value=Number(host.querySelector("#skaUnitValue").value),from=host.querySelector("#skaUnitFrom").value,to=host.querySelector("#skaUnitTo").value,result=convertUnit(value,from,to);out.innerHTML=`<strong>${esc(formatNumber(result.value))} ${esc(to)}</strong><span>${esc(result.group)}</span>`}catch(error){out.textContent=error.message}});
    host.querySelector("#skaMolarMass")?.addEventListener("click",()=>{const out=host.querySelector("#skaChemResult");try{const result=molarMass(host.querySelector("#skaChemicalFormula").value);out.innerHTML=`<strong>${esc(result.formatted)} g/mol</strong><span>${esc(Object.entries(result.composition).map(([k,v])=>`${k}${v>1?`×${v}`:""}`).join(", "))}</span>`}catch(error){out.textContent=error.message}});
    host.querySelector("#skaApplyFormula")?.addEventListener("click",()=>{const out=host.querySelector("#skaFormulaResult"),card=state.cards.find(item=>item.id===host.querySelector("#skaFormulaSelect").value),vars=parseVariables(host.querySelector("#skaFormulaVariables").value);if(!card?.formula){out.textContent="Selecciona una fórmula.";return}try{const result=calculate(card.formula.expression,vars);out.innerHTML=`<strong>${esc(card.formula.symbol||"Resultado")} = ${esc(result.formatted)}${card.formula.resultUnit?` ${esc(card.formula.resultUnit)}`:""}</strong><span>${esc(card.formula.expression)} · Fuente: ${esc(card.sourceName)}</span>`}catch(error){out.textContent=error.message}});
    host.querySelector("#skaCheckPractice")?.addEventListener("click",async()=>{const card=state.cards.find(item=>item.id===host.querySelector(".ska-practice")?.dataset.practiceCard),answer=normalize(host.querySelector("#skaPracticeAnswer").value).replace(/\s/g,""),expected=normalize(card?.formula?.expression||"").replace(/\s/g,""),ok=answer===expected,out=host.querySelector("#skaPracticeResult");out.innerHTML=ok?`<strong>Correcto.</strong><span>${esc(card.formula.symbol)} = ${esc(card.formula.expression)}</span>`:`<strong>Aún no.</strong><span>La expresión aprobada es ${esc(card.formula.symbol)} = ${esc(card.formula.expression)}.</span>`;await put(ATTEMPT_STORE,{id:uid("attempt"),ownerId:ownerId(),cardId:card.id,answer,expected,ok,createdAt:nowIso()})});
    host.querySelector("[data-ska-new-practice]")?.addEventListener("click",renderAcademy);
    host.querySelector("#skaAutoMirror")?.addEventListener("change",event=>{state.settings.autoMirror=event.target.checked;saveSettings();if(state.settings.autoMirror)mirrorApprovedCards(state.cards)});
    host.querySelector("#skaShowSources")?.addEventListener("change",event=>{state.settings.showSources=event.target.checked;saveSettings()});
    host.querySelector("#skaSeedCore")?.addEventListener("click",async()=>{const count=await seedCore();await refreshData();toast("Biblioteca base lista",count?`${count} fórmula(s) restauradas.`:"Las fórmulas base ya estaban disponibles.")});
    host.querySelector("#skaExport")?.addEventListener("click",exportAcademy);
    host.querySelector("#skaImportBackup")?.addEventListener("change",event=>importBackup(event.target.files?.[0]));
  }

  function showDocumentReview(documentId){
    const doc=state.documents.find(item=>item.id===documentId),cards=state.cards.filter(card=>card.documentId===documentId);if(!doc)return;
    const overlay=document.createElement("div");overlay.className="ska-review-overlay";overlay.innerHTML=`<div class="ska-review"><header><div><span>REVISIÓN HUMANA</span><h3>${esc(doc.title)}</h3></div><button type="button" data-close>×</button></header><div class="ska-review-list">${cards.map(card=>`<article><div><span>${esc(SUBJECTS[card.subject]?.label||"General")} · ${esc(card.type)}</span><strong>${esc(card.title)}</strong><p>${esc(card.content)}</p>${card.formula?`<code>${esc(card.formula.symbol)} = ${esc(card.formula.expression)}</code>`:""}${card.warnings?.length?`<em>${esc(card.warnings.join(" "))}</em>`:""}</div><div><button type="button" class="sk-primary" data-approve="${esc(card.id)}" ${card.status==="duplicate"?"disabled":""}>Aprobar</button><button type="button" data-reject="${esc(card.id)}">Rechazar</button></div></article>`).join("")}</div><footer><button type="button" class="sk-primary" data-approve-all="${esc(doc.id)}">Aprobar todo</button><button type="button" data-close>Cerrar</button></footer></div>`;document.body.appendChild(overlay);overlay.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>overlay.remove());overlay.addEventListener("click",event=>{if(event.target===overlay)overlay.remove()});overlay.querySelectorAll("[data-approve]").forEach(button=>button.onclick=async()=>{await setCardStatus(button.dataset.approve,"approved");button.textContent="Aprobada";button.disabled=true});overlay.querySelectorAll("[data-reject]").forEach(button=>button.onclick=async()=>{await setCardStatus(button.dataset.reject,"rejected");button.closest("article")?.remove()});overlay.querySelector("[data-approve-all]").onclick=async()=>{await approveDocument(documentId);overlay.remove();toast("Documento aprobado","Las fichas válidas ya están disponibles.")};
  }

  async function exportAcademy(){const payload={schema:"inbestiga-sakura-academy",version:1,build:VERSION,exportedAt:nowIso(),owner:ownerId(),documents:state.documents,cards:state.cards};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`sakura_academy_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function importBackup(file){if(!file)return;try{if(file.size>8_000_000)throw new Error("El respaldo es demasiado grande.");const payload=JSON.parse(await file.text());if(payload.schema!=="inbestiga-sakura-academy"||!Array.isArray(payload.cards))throw new Error("No es un respaldo válido de Academia.");for(const doc of rows(payload.documents)){await put(DOC_STORE,{...doc,ownerId:ownerId(),id:uid("academy-doc-import"),updatedAt:nowIso()})}for(const card of payload.cards){await put(CARD_STORE,{...card,ownerId:ownerId(),id:uid("academy-card-import"),documentId:"imported-backup",updatedAt:nowIso()})}await refreshData();mirrorApprovedCards(state.cards);toast("Respaldo importado","Revisa las fichas y elimina duplicados si fuera necesario.")}catch(error){toast("No se pudo importar",error.message,"error")}finally{file.value=""}}

  function ensureMount(){const learning=document.getElementById("skViewLearning");if(!learning)return false;let mount=learning.querySelector("#skAcademyMount");if(!mount){mount=document.createElement("div");mount.id="skAcademyMount";learning.prepend(mount)}renderAcademy();return true}
  function onLearningClick(event){if(event.target.closest?.('[data-sk-tab="learning"]'))requestAnimationFrame(()=>setTimeout(ensureMount,20))}

  function registerBuild(){
    try{window.INBESTIGA_QUALITY_CORE?.register?.(MODULE,{version:VERSION,mode:"local-academy-calculation-engine",polling:false,realtimeChannels:0,mutations:false,dynamicCode:false})}catch{}
    const build=window.INBESTIGA_BUILD||{};window.INBESTIGA_BUILD={...build,version:VERSION,name:"SAKURA ACADEMY & SCIENTIFIC CALCULATION ENGINE",modules:[...new Set([...(Array.isArray(build.modules)?build.modules:[]),MODULE])]};root.dataset.inbestigaBuild=VERSION;
  }
  function health(){const stats=libraryStats();return{status:"ok",value:"SAKURA Academy",detail:`${stats.formulas} fórmulas, ${stats.approved} fichas aprobadas, motor matemático y unidades local; sin SQL, polling, Realtime, eval ni Function dinámica.`}}

  async function init(){registerBuild();document.addEventListener("click",onLearningClick,true);await seedCore().catch(error=>console.info("[SAKURA Academy] Biblioteca base pendiente",error?.message||error));await refreshData();if(document.getElementById("skViewLearning")?.classList.contains("active"))ensureMount();window.addEventListener("pageshow",registerBuild,{passive:true});setTimeout(registerBuild,650);setTimeout(registerBuild,1750)}

  const api={version:VERSION,init,search,answer,calculate,convertUnit,molarMass,parseVariables,seedCore,refresh:refreshData,health,state:()=>({...state,cards:[...state.cards],documents:[...state.documents]}),importFiles,approveDocument};
  window.INBESTIGA_SAKURA_ACADEMY=api;
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
