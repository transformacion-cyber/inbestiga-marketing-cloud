/* INBESTIGA Marketing Cloud v17.13.0 · controlled server-side web search adapter */
"use strict";

const MAX_QUERY = 500;
const MAX_DOMAINS = 20;
const BLOCKED_PATTERNS = [
  /(?:password|contrase(?:ñ|n)a|jwt|service[_ -]?role|secret[_ -]?key|api[_ -]?key|bearer\s+[a-z0-9._-]+)/i,
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  /(?:supabase|vercel)[^\n]{0,50}(?:token|secret|password|key)/i
];

function json(res,status,payload){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.end(JSON.stringify(payload));
}
function text(value){return String(value ?? "").replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim()}
function safeUrl(value){
  try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)?url.toString():""}catch{return ""}
}
function safeDomains(value){
  const list=Array.isArray(value)?value:String(value||"").split(/[\s,;]+/);
  return list.map(x=>text(x).replace(/^https?:\/\//i,"").replace(/\/.*$/,"").toLowerCase()).filter(x=>/^[a-z0-9.-]+$/.test(x)&&!x.includes(".." )).slice(0,MAX_DOMAINS);
}
function host(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return "Fuente web"}}
function normalizeResults(payload,type){
  const results=[];
  if(type==="images"){
    for(const image of Array.isArray(payload.images)?payload.images:[]){
      const url=safeUrl(typeof image==="string"?image:image.url),source=safeUrl(image.source_url||image.source||"");
      if(!url)continue;results.push({type:"image",title:text(image.description||"Referencia visual"),snippet:text(image.description||"Verifica la licencia y la fuente antes de usar esta imagen."),url:source||url,thumbnail:url,source:host(source||url),license:text(image.license||"Licencia no confirmada"),publishedAt:""});if(results.length>=16)break;
    }
  }
  for(const row of Array.isArray(payload.results)?payload.results:[]){
    const url=safeUrl(row.url);if(!url)continue;
    const image=Array.isArray(row.images)?row.images.find(x=>safeUrl(typeof x==="string"?x:x.url)):null;
    results.push({type:type==="videos"?"video":type==="news"?"news":"web",title:text(row.title||host(url)).slice(0,240),snippet:text(row.content||row.snippet||"").slice(0,900),url,thumbnail:image?safeUrl(typeof image==="string"?image:image.url):safeUrl(row.thumbnail||row.favicon||""),source:host(url),publishedAt:text(row.published_date||row.publishedAt||"").slice(0,80),score:Number(row.score)||0});
    if(results.length>=18)break;
  }
  return results.slice(0,18);
}

module.exports = async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"Método no permitido."});
  const enabled=String(process.env.SAKURA_WEB_ENABLED||"false").toLowerCase()==="true";
  const apiKey=process.env.TAVILY_API_KEY||"";
  if(!enabled||!apiKey)return json(res,503,{error:"Explorador web no configurado. Activa SAKURA_WEB_ENABLED y TAVILY_API_KEY en Vercel."});
  const body=req.body&&typeof req.body==="object"?req.body:{};
  let query=text(body.query).slice(0,MAX_QUERY),type=["web","news","images","videos"].includes(body.type)?body.type:"web",domains=safeDomains(body.domains);
  if(!query)return json(res,400,{error:"La consulta está vacía."});
  if(BLOCKED_PATTERNS.some(pattern=>pattern.test(query)))return json(res,400,{error:"La consulta parece contener credenciales o información sensible y fue bloqueada."});
  if(type==="videos"){
    const videoDomains=domains.length?domains:["youtube.com","vimeo.com"];
    domains=videoDomains;query=`${query} video`;
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
  try{
    const upstream=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({query,search_depth:"basic",max_results:type==="images"?8:10,topic:type==="news"?"news":"general",include_answer:false,include_raw_content:false,include_images:type==="images"||type==="videos",include_image_descriptions:type==="images",include_favicon:true,include_domains:domains,exclude_domains:[],...(type==="news"?{}:{country:"peru"}),auto_parameters:false,include_usage:false}),signal:controller.signal});
    const payload=await upstream.json().catch(()=>({}));
    if(!upstream.ok)throw new Error(payload?.detail?.error||payload?.error||`Proveedor web ${upstream.status}`);
    return json(res,200,{provider:"tavily",query:text(payload.query||query),type,results:normalizeResults(payload,type),responseTime:payload.response_time||null,privacy:"server-side-key"});
  }catch(error){
    return json(res,error.name==="AbortError"?504:502,{error:error.name==="AbortError"?"El proveedor superó el tiempo permitido.":text(error.message||error)});
  }finally{clearTimeout(timer)}
};
