import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('release version stays synchronized across package and Home Assistant metadata', async () => {
  const packageJson=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const [config,docker]=await Promise.all([
    readFile(new URL('../config.yaml',import.meta.url),'utf8'),
    readFile(new URL('../Dockerfile',import.meta.url),'utf8'),
  ]);
  assert.match(config,new RegExp(`^version: "${packageJson.version.replaceAll('.','\\.')}"$`,'m'));
  assert.match(docker,new RegExp(`io\\.hass\\.version="${packageJson.version.replaceAll('.','\\.')}"`));
});

test('all AI data dependencies exist in ordered migrations', async () => {
  const migrations=await Promise.all([
    '001_initial.sql','003_operational_core.sql','005_management_foundation.sql','006_project_operations.sql',
    '010_project_workflow_fields.sql','013_ai_providers.sql','014_project_serial_codes.sql','015_ai_usage.sql','016_ai_chat_jobs.sql',
  ].map((name)=>readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8')));
  const schema=migrations.join('\n');
  for (const token of ['CREATE TABLE IF NOT EXISTS projects','CREATE TABLE IF NOT EXISTS clients','CREATE TABLE IF NOT EXISTS tasks','CREATE TABLE IF NOT EXISTS professionals','CREATE TABLE IF NOT EXISTS equipment_catalog','CREATE TABLE IF NOT EXISTS project_equipment','CREATE TABLE IF NOT EXISTS ai_provider_settings','CREATE TABLE IF NOT EXISTS ai_usage_log','CREATE TABLE IF NOT EXISTS ai_chat_jobs','priority_customer_number','assignee_professional_id','serial_code','parent_id','item_type','quantity','company_name','job_title','affiliation','project_size','contractor_progress']) {
    assert.ok(schema.includes(token),`missing AI schema dependency: ${token}`);
  }
});

test('every legacy overlay is portaled above page containers', async () => {
  const files = await Promise.all([
    'App.jsx', 'Operational.jsx', 'FormsWorkspace.jsx', 'GanttTimeline.jsx',
    'Messages.jsx', 'AiChat.jsx',
  ].map((name) => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')));
  const source = files.join('\n');
  for (const token of [
    'ops-modal-backdrop', 'modal-backdrop', 'cg-dialog-backdrop',
    'message-backdrop', 'ai-chat-backdrop',
  ]) {
    assert.ok(source.includes(token), `missing overlay coverage: ${token}`);
  }
  for (const file of files) {
    if (/className=.*(?:modal-backdrop|dialog-backdrop|message-backdrop|ai-chat-backdrop)/s.test(file)) {
      assert.match(file, /ModalPortal/, 'overlay file must use ModalPortal');
    }
  }
  const modalCss = await readFile(new URL('../src/modal-system.css', import.meta.url), 'utf8');
  const globalCss = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(modalCss, /body > :is\(\.modal-backdrop/);
  assert.match(modalCss, /overflow-y: auto !important/);
  assert.match(modalCss, /-webkit-overflow-scrolling: touch/);
  assert.doesNotMatch(modalCss, /flex:\s*1\s+1\s+0\s*!important/);
  assert.doesNotMatch(globalCss, /Unified commercial modal behavior/);
  assert.doesNotMatch(globalCss, /One modal contract for the entire product/);
});

test('message sound is personal, realtime and ignores the initial message load', async () => {
  const [app, operational, server, migration] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/Operational.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../server/operational.js', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/026_message_sound_preference.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /messageListInitialized/);
  assert.match(app, /table === "user_messages"/);
  assert.match(app, /senderId.*user\.id/);
  assert.match(app, /messageSoundEnabled === false/);
  assert.match(operational, /preferences\/message-sound/);
  assert.match(server, /router\.patch\('\/preferences\/message-sound'/);
  assert.match(migration, /message_sound_enabled BOOLEAN NOT NULL DEFAULT TRUE/);
});

test('document library opens an in-app responsive viewer', async () => {
  const [workspace, css] = await Promise.all([
    readFile(new URL('../src/FormsWorkspace.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/forms-workspace.css', import.meta.url), 'utf8'),
  ]);
  assert.match(workspace, /function DocumentViewer/);
  assert.match(workspace, /documents\/\$\{file\.id\}\/preview/);
  assert.match(workspace, /application\/pdf/);
  assert.match(css, /\.document-viewer-modal/);
  assert.match(css, /height:100dvh/);
});

test('workspace failures are isolated and reported without replacing navigation', async () => {
  const [app, server] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../server/operational.js', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /class WorkspaceErrorBoundary extends Component/);
  assert.match(app, /api\("\/ui-errors"/);
  assert.match(server, /router\.post\('\/ui-errors'/);
});

test('effects never return asynchronous loaders as React cleanup functions', async () => {
  const files = ['../src/App.jsx', '../src/Workspaces.jsx'];
  for (const file of files) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /useEffect\(\s*(?:load|loadBackups)\s*,/);
  }
});
