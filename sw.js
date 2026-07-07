const C='studyhub-v5';
const SHELL=['./','index.html','app.js','styles.css','data.json','manifest.webmanifest',
'icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// network-first: always fetch the latest when online, update the cache, and
// fall back to cache only when offline. Keeps updated notes from going stale.
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
e.respondWith(fetch(e.request).then(res=>{const cp=res.clone();
caches.open(C).then(c=>c.put(e.request,cp));return res;})
.catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));});
