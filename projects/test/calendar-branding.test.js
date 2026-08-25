import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read=(file)=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('Outlook subscriptions never reuse a Home Assistant Ingress URL',async()=>{
  const server=await read('server/operational.js');
  const ui=await read('src/Operational.jsx');
  const migration=await read('migrations/042_calendar_public_url.sql');
  assert.match(migration,/public_base_url/);
  assert.match(server,/X-Projects-Ingress/);
  assert.match(server,/api\/hassio_ingress/);
  assert.match(server,/feedUrl/);
  assert.match(ui,/feed\?\.feedUrl/);
  assert.match(ui,/נדרש להחליף את המנוי הישן/);
});

test('browser, Apple, maskable PWA and push icons use dedicated assets',async()=>{
  const manifest=JSON.parse(await read('public/manifest.webmanifest'));
  const html=await read('index.html');
  const worker=await read('public/sw.js');
  assert.equal(manifest.icons.some(icon=>icon.purpose==='any'&&icon.src.includes('icon-512.png')),true);
  assert.equal(manifest.icons.some(icon=>icon.purpose==='maskable'&&icon.src.includes('icon-maskable.png')),true);
  assert.match(html,/apple-touch-icon\.png/);
  assert.match(worker,/icon-512\.png/);
  assert.match(worker,/projects-shell-v3/);
});
