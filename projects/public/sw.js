const CACHE='projects-shell-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',(event)=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))])));
self.addEventListener('push',(event)=>{
  let data={};
  try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  const options={
    body:data.body||'',
    icon:'./icon.png',
    badge:'./icon.png',
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
