const DB_NAME="projects-offline-v1";
const DB_VERSION=1;
const QUEUE_STORE="outbox";
const CACHE_STORE="apiCache";
const META_STORE="meta";

const openDb=()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(QUEUE_STORE))db.createObjectStore(QUEUE_STORE,{keyPath:"id"});if(!db.objectStoreNames.contains(CACHE_STORE))db.createObjectStore(CACHE_STORE,{keyPath:"key"});if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE,{keyPath:"key"});};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
const requestValue=(request)=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
const withStore=async(name,mode,work)=>{const db=await openDb();try{const transaction=db.transaction(name,mode),store=transaction.objectStore(name),result=await work(store);await new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error)});return result}finally{db.close()}};
const all=(name)=>withStore(name,"readonly",store=>requestValue(store.getAll()));
const put=(name,value)=>withStore(name,"readwrite",store=>requestValue(store.put(value)));
const remove=(name,key)=>withStore(name,"readwrite",store=>requestValue(store.delete(key)));
const emit=async(extra={})=>{const entries=await all(QUEUE_STORE).catch(()=>[]);window.dispatchEvent(new CustomEvent("projects:offline-status",{detail:{online:navigator.onLine,pending:entries.filter(item=>item.status!=="failed").length,failed:entries.filter(item=>item.status==="failed").length,syncing:false,...extra}}));};

const allowedMutation=(path,method)=>{
  if(!["POST","PATCH"].includes(method))return false;
  return [
    /^\/operations\/tasks(?:\/\d+)?$/,/^\/projects\/\d+\/time-entries(?:\/\d+)?$/,
    /^\/projects\/\d+\/(?:site-reviews|meetings|updates)(?:\/\d+)?$/,/^\/form-records(?:\/\d+)?$/,
    /^\/projects\/\d+\/meetings\/offline:[0-9a-f-]+\/tasks$/,/^\/messages$/,/^\/documents$/,/^\/voice-notes$/,
  ].some(pattern=>pattern.test(path));
};
const responseShape=(path,id)=>path==="/messages"?{message:{id},notification:{sent:0,skipped:1},offlineQueued:true}:path==="/documents"?{document:{id},offlineQueued:true}:path==="/voice-notes"?{note:{id},offlineQueued:true}:path==="/form-records"?{record:{id},offlineQueued:true}:path.endsWith('/tasks')&&path.includes('/meetings/')?{tasks:[],offlineQueued:true}:path.includes("site-reviews")?{review:{id},offlineQueued:true}:path.includes("meetings")?{meeting:{id},offlineQueued:true}:path.includes("time-entries")?{entry:{id},offlineQueued:true}:path.includes("updates")?{update:{id},offlineQueued:true}:{task:{id},notification:{sent:0,skipped:1},offlineQueued:true};
const serializeBody=async(body)=>{
  if(body instanceof FormData){const values=[];for(const [key,value] of body.entries())values.push({key,value,blob:value instanceof Blob,filename:value instanceof File?value.name:""});return {type:"form",values}}
  return {type:"text",value:body??null};
};
const mapped=(value,mappings)=>{if(typeof value!=="string")return value;let output=value;for(const [temporary,actual] of Object.entries(mappings))output=output.split(temporary).join(String(actual));return output};
const restoreBody=(serialized,mappings)=>{if(serialized.type==="form"){const form=new FormData();for(const item of serialized.values){if(item.blob)form.append(item.key,item.value,item.filename||'offline-file');else form.append(item.key,mapped(item.value,mappings))}return form}return serialized.value==null?undefined:mapped(serialized.value,mappings)};
const parseBody=async(response)=>{const text=response.status===204?"":await response.text();if(!text)return null;try{return JSON.parse(text)}catch{return {error:text.slice(0,300)}}};
const serverId=(body)=>body?.task?.id||body?.review?.id||body?.meeting?.id||body?.entry?.id||body?.record?.id||body?.message?.id||body?.document?.id||body?.note?.id||body?.update?.id||null;

export async function cacheApiResponse(path,body){if(body!==undefined&&body!==null)await put(CACHE_STORE,{key:path,body,savedAt:Date.now()}).catch(()=>{})}
export async function cachedApiResponse(path){return (await withStore(CACHE_STORE,"readonly",store=>requestValue(store.get(path))).catch(()=>null))?.body??null}
export async function queueOfflineMutation(path,options={}){
  const method=String(options.method||"GET").toUpperCase();if(!allowedMutation(path,method))return null;
  const id=crypto.randomUUID(),temporaryId=`offline:${id}`;
  await put(QUEUE_STORE,{id,temporaryId,path,method,headers:options.headers||{},body:await serializeBody(options.body),createdAt:Date.now(),status:"pending",attempts:0,error:""});
  navigator.serviceWorker?.ready.then(registration=>registration.sync?.register('projects-outbox')).catch(()=>{});
  await emit({queued:true});return responseShape(path,temporaryId);
}
export async function offlineStatus(){const entries=await all(QUEUE_STORE).catch(()=>[]);return {online:navigator.onLine,pending:entries.filter(item=>item.status!=="failed").length,failed:entries.filter(item=>item.status==="failed").length}}
export async function flushOfflineQueue(apiRoot){
  if(!navigator.onLine)return emit();const entries=(await all(QUEUE_STORE).catch(()=>[])).sort((a,b)=>a.createdAt-b.createdAt);const mappingRow=await withStore(META_STORE,"readonly",store=>requestValue(store.get("idMappings"))).catch(()=>null),mappings=mappingRow?.value||{};
  for(const item of entries){
    if(item.status==="failed")continue;
    await put(QUEUE_STORE,{...item,status:"syncing",attempts:item.attempts+1,error:""});await emit({syncing:true});
    try{
      const body=restoreBody(item.body,mappings),isForm=body instanceof FormData;
      const response=await fetch(`${apiRoot}${mapped(item.path,mappings)}`,{method:item.method,credentials:"same-origin",headers:{...(isForm?{}:{"Content-Type":"application/json"}),...item.headers,"X-Offline-Operation-Id":item.id},body});
      const result=await parseBody(response);
      if(!response.ok){if(response.status>=400&&response.status<500){await put(QUEUE_STORE,{...item,status:"failed",attempts:item.attempts+1,error:result?.error||`HTTP ${response.status}`});continue}throw new Error(result?.error||`HTTP ${response.status}`)}
      const actualId=serverId(result);if(actualId&&item.temporaryId){mappings[item.temporaryId]=actualId;await put(META_STORE,{key:"idMappings",value:mappings})}
      await remove(QUEUE_STORE,item.id);
    }catch(error){await put(QUEUE_STORE,{...item,status:"pending",attempts:item.attempts+1,error:String(error.message||error)});break}
  }
  await emit({synced:true});window.dispatchEvent(new Event("projects:data-changed"));
}
export async function retryOfflineFailures(){const entries=await all(QUEUE_STORE);for(const item of entries.filter(entry=>entry.status==="failed"))await put(QUEUE_STORE,{...item,status:"pending",error:""});await emit()}
export async function discardOfflineFailure(id){await remove(QUEUE_STORE,id);await emit()}
export async function offlineEntries(){return (await all(QUEUE_STORE).catch(()=>[])).sort((a,b)=>a.createdAt-b.createdAt)}
export function initializeOfflineSync(apiRoot){const sync=()=>flushOfflineQueue(apiRoot),wentOffline=()=>emit(),workerMessage=event=>{if(event.data?.type==="PROJECTS_SYNC")sync()};window.addEventListener("online",sync);window.addEventListener("offline",wentOffline);navigator.serviceWorker?.addEventListener("message",workerMessage);sync();emit();return()=>{window.removeEventListener("online",sync);window.removeEventListener("offline",wentOffline);navigator.serviceWorker?.removeEventListener("message",workerMessage)}}
