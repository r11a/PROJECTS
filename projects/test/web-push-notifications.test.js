import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('PWA push notifications persist devices, preferences, lists, campaigns and delivery audit',async()=>{
  const [migration,server]=await Promise.all([read('../migrations/038_web_push_notifications.sql'),read('../server/pushNotifications.js')]);
  for(const table of ['push_subscriptions','user_push_preferences','notification_lists','notification_list_members','notification_campaigns','notification_deliveries'])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(server,/webpush\.setVapidDetails/);
  assert.match(server,/https:\/\/github\.com\/r11a\/PROJECTS/);
  assert.doesNotMatch(server,/@projects\.local/);
  assert.match(server,/BadJwtToken/);
  assert.match(server,/router\.use\(authenticate\)/);
  assert.match(server,/requireRoles\('admin'\)/);
  assert.match(server,/subscription_id=\$2 AND dedupe_key=\$3/);
  assert.match(server,/u\.finance_access=TRUE/);
  assert.match(server,/router\.post\('\/push\/test'/);
  assert.match(server,/result\.sent>0\?'sent':'failed'/);
  assert.match(server,/inQuietHours/);
  assert.match(server,/personalized\.silent/);
});

test('push service worker opens contextual links and the UI supports personal scheduled audiences',async()=>{
  const [worker,manifest,ui,operational]=await Promise.all([read('../public/sw.js'),read('../public/manifest.webmanifest'),read('../src/PushNotifications.jsx'),read('../server/operational.js')]);
  assert.match(worker,/self\.addEventListener\('push'/);
  assert.match(worker,/self\.addEventListener\('notificationclick'/);
  assert.match(manifest,/"display": "standalone"/);
  assert.match(ui,/משתמשים בודדים/);
  assert.match(ui,/רשימת תפוצה/);
  assert.match(ui,/המשתמשים הרלוונטיים לפרויקט/);
  assert.match(ui,/\{\{שם\}\}/);
  assert.match(ui,/שליחת בדיקה/);
  assert.match(ui,/failure_count/);
  assert.match(ui,/שעות שקט אישיות/);
  assert.doesNotMatch(operational,/הודעה מאת.*PROJECTS/);
});

test('private VAPID key is excluded from general application settings',async()=>{
  const operational=await read('../server/operational.js');
  assert.match(operational,/WHERE key<>'pushVapid'/);
});
