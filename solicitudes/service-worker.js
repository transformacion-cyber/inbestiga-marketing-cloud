/* Solicitudes 360 v17.16.2 */
const CACHE="inbestiga-solicitudes-360-v17-16-2";
const PREFIX="inbestiga-solicitudes-360-";
const SHELL=[
  "/solicitudes/",
  "/solicitudes/index.html",
  "/solicitudes/manifest.webmanifest",
  "/solicitudes/assets/solicitudes-360.css",
  "/solicitudes/assets/solicitudes-360.js",
  "/config/public-runtime-config.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(async path=>{
      const response=await fetch(new Request(path,{cache:"reload"}));
      if(response.ok)await cache.put(path,response.clone());
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).catch(()=>caches.match("/solicitudes/index.html")));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      }
      return response;
    }))
  );
});
