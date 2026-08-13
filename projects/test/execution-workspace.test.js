import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('execution workspace migration includes critical path, records and recycle retention', async () => {
  const migration = await read('../migrations/017_execution_workspace.sql');
  for (const token of ['referral_source', 'critical BOOLEAN', 'deleted_at', 'deleted_by', 'project_site_reviews', 'project_meeting_summaries']) {
    assert.ok(migration.includes(token), `missing execution schema token: ${token}`);
  }
});

test('document deletion is admin-only soft deletion with a restore route', async () => {
  const management = await read('../server/management.js');
  assert.match(management, /router\.delete\('\/documents\/:id', requireRoles\('admin'\)/);
  assert.match(management, /UPDATE client_files SET deleted_at=NOW\(\),deleted_by=\$2/);
  assert.match(management, /router\.post\('\/documents\/:id\/restore',requireRoles\('admin'\)/);
  assert.match(management, /INTERVAL '14 days'/);
});

test('portfolio Gantt exposes critical tasks and dependency connectors', async () => {
  const gantt = await read('../src/GanttWorkspace.jsx');
  const timeline = await read('../src/GanttTimeline.jsx');
  assert.match(timeline, /cg-dependencies/);
  assert.match(timeline, /dependency_task_id/);
  assert.match(timeline, /נתיב קריטי/);
  assert.match(gantt, /לוח גאנט לכל הפרויקטים/);
  assert.match(timeline, /pixelsPerDay/);
  assert.match(timeline, /contrastText/);
  assert.match(timeline, /type="date"/);
  assert.match(timeline, /onScroll=\{handleScroll\}/);
  assert.match(timeline, /timelineFocus/);
  assert.match(timeline, /cg-mobile-toggle/);
  assert.match(timeline, /clampScale/);
  assert.match(timeline, /cg-scale/);
  assert.match(timeline, /onTouchMove=\{movePinch\}/);
  assert.match(timeline, /onPointerDown=\{startMouseDrag\}/);
  assert.match(timeline, /event\.shiftKey/);
  assert.match(gantt, /TaskEditor/);
});

test('project Gantt keeps short tasks readable and projects persist classification', async () => {
  const workspace = await read('../src/ProjectWorkspace.jsx');
  const app = await read('../src/App.jsx');
  const migration = await read('../migrations/018_project_classification.sql');
  const server = await read('../server/index.js');
  assert.match(workspace, /pixelsPerDay/);
  assert.match(workspace, /Math\.max\(118, duration \* zoomConfig\.pixelsPerDay\)/);
  assert.match(workspace, /CommercialProjectGantt/);
  assert.match(workspace, /GanttTimeline/);
  assert.match(app, /projectClassificationOptions/);
  assert.match(migration, /project_classification/);
  assert.match(server, /projectClassification: 'project_classification'/);
});

test('proprietary release is explicitly unlicensed for npm reuse', async () => {
  const packageJson = JSON.parse(await read('../package.json'));
  const license = await read('../../LICENSE');
  assert.equal(packageJson.license, 'UNLICENSED');
  assert.match(license, /All rights reserved/i);
  assert.match(license, /No permission is granted/i);
});
