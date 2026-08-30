import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('offline outbox persists supported work, files and dependency mappings',async()=>{
  const client=await read('../src/offlineQueue.js');
  for(const token of ['indexedDB.open','outbox','apiCache','crypto.randomUUID','X-Offline-Operation-Id','FormData','Blob','idMappings','flushOfflineQueue'])assert.ok(client.includes(token),`missing ${token}`);
  assert.match(client,/site-reviews/);assert.match(client,/time-entries/);assert.match(client,/voice-notes/);assert.match(client,/documents/);
  assert.doesNotMatch(client,/\["POST","PATCH","DELETE"\]/);
});

test('offline replay is authenticated and idempotent on the server',async()=>{
  const [migration,middleware,index]=await Promise.all([read('../migrations/041_offline_sync.sql'),read('../server/offlineIdempotency.js'),read('../server/index.js')]);
  assert.match(migration,/offline_operation_receipts/);assert.match(migration,/operation_id UUID PRIMARY KEY/);
  assert.match(middleware,/OFFLINE_OPERATION_MISMATCH/);assert.match(middleware,/status='completed'/);assert.match(middleware,/request\.user\?\.id/);
  assert.match(index,/authenticate\(request,response,\(\)=>offlineReceipt/);
});

test('PWA caches its shell and exposes explicit offline synchronization UI',async()=>{
  const [worker,app,main,workspace]=await Promise.all([read('../public/sw.js'),read('../src/App.jsx'),read('../src/main.jsx'),read('../src/Workspaces.jsx')]);
  assert.match(worker,/addEventListener\('fetch'/);assert.match(worker,/request\.mode==='navigate'/);assert.match(worker,/projects-outbox/);
  assert.match(main,/serviceWorker\.register/);assert.match(app,/סנכרון עבודה Offline/);assert.match(workspace,/נשמר במכשיר/);
});

test('offline API cache is schema-versioned without deleting pending work',async()=>{
  const source=await read('../src/offlineQueue.js');
  assert.match(source,/DB_VERSION=2/);
  assert.match(source,/API_CACHE_SCHEMA="v2"/);
  assert.match(source,/transaction\.objectStore\(CACHE_STORE\)\.clear\(\)/);
  assert.match(source,/key:`\$\{API_CACHE_SCHEMA\}:\$\{path\}`/);
  assert.doesNotMatch(source,/objectStore\(QUEUE_STORE\)\.clear/);
});
