const CACHE='deshflow-shell-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/','/control','/icon.svg','/manifest.webmanifest'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok&&response.headers.get('content-type')?.includes('text/html')){const copy=response.clone();void caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;}).catch(async()=>await caches.match(event.request)||await caches.match(url.pathname==='/'?'/':'/control')||Response.error()));
  }else if(url.pathname.startsWith('/_next/static/')||url.pathname==='/icon.svg'){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;})));
  }
});
