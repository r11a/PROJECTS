const CACHE='projects-shell-v3';
self.addEventListener('install',(event)=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./','./manifest.webmanifest','./icon-512.png','./icon-maskable.png','./apple-touch-icon.png'])).catch(()=>{}).then(()=>self.skipWaiting())));
self.addEventListener('activate',(event)=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))])));
self.addEventListener('fetch',(event)=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(async()=>await caches.match(request)||await caches.match('./')));return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response})));
});
self.addEventListener('sync',(event)=>{if(event.tag==='projects-outbox')event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>clients.forEach(client=>client.postMessage({type:'PROJECTS_SYNC'}))))});
self.addEventListener('push',(event)=>{
  let data={};
  try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  const options={
    body:data.body||'',
    icon:'./icon-512.png',
    badge:'./icon-512.png',
    dir:'rtl',
    lang:'he',
    tag:data.tag||`projects-${Date.now()}`,
    renotify:Boolean(data.renotify),
    silent:Boolean(data.silent),
    data:{url:data.url||'./',category:data.category||'system'},
    actions:[{action:'open',title:'פתיחה'},{action:'dismiss',title:'סגירה'}],
  };
  event.waitUntil(self.registration.showNotification(data.title||'התראה חדשה',options));
});
self.addEventListener('notificationclick',(event)=>{
  event.notification.close();
  if(event.action==='dismiss')return;
  const destination=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async(clients)=>{
    const sameApp=clients.find(client=>client.url.startsWith(self.registration.scope));
    if(sameApp){await sameApp.focus();if('navigate' in sameApp)await sameApp.navigate(destination);return;}
    return self.clients.openWindow(destination);
  }));
});
