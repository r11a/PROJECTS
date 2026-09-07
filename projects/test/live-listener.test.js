import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createLiveListener } from '../server/liveListener.js';

test('LISTEN reconnects once after a failure and requests a fresh snapshot',async()=>{
  const clients=[],pending=[],notifications=[];
  let refreshed=0;
  const listener=createLiveListener({
    createClient:()=>{const client=new EventEmitter(); client.connect=async()=>{}; client.query=async sql=>{client.sql=sql;}; client.end=async()=>{client.ended=true;client.emit('end');}; clients.push(client);return client;},
    onNotification:message=>notifications.push(message),onError:()=>{},onReconnect:()=>refreshed++,
    schedule:callback=>{pending.push(callback);return pending.length;},cancel:()=>{},
  });
  await listener.start();
  clients[0].emit('error',new Error('Connection lost'));
  clients[0].emit('end');
  assert.equal(pending.length,1);
  pending.shift()();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(clients[1].sql,'LISTEN projects_live_change');
  assert.equal(refreshed,1);
  clients[0].emit('notification',{payload:'stale'});
  clients[1].emit('notification',{payload:'fresh'});
  assert.deepEqual(notifications,[{payload:'fresh'}]);
  await listener.stop();
  assert.equal(clients[1].ended,true);
  assert.equal(pending.length,0);
});

test('startup failure retries and shutdown cancels the scheduled reconnect',async()=>{
  let scheduled,cancelled;
  const listener=createLiveListener({createClient:()=>{const client=new EventEmitter();client.connect=async()=>{throw Error('DB unavailable');};client.end=async()=>{};return client;},onNotification:()=>{},onError:()=>{},schedule:callback=>{scheduled=callback;return 42;},cancel:id=>{cancelled=id;}});
  await listener.start(); assert.equal(typeof scheduled,'function');
  await listener.stop(); assert.equal(cancelled,42);
});
