const CACHE='serena-shell-v2';
const ASSETS=['./','./index.html','./styles.css','./app.js','./config.js','./manifest.json','./icon.svg'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  // Não intercepta Supabase, CDN ou qualquer outro domínio: só os arquivos do próprio app.
  if(new URL(request.url).origin!==self.location.origin)return;
  // Rede primeiro: atualizações chegam sem prender versões antigas; o cache serve só offline.
  event.respondWith(
    fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>caches.match(request).then(cached=>cached||caches.match('./index.html')))
  );
});
