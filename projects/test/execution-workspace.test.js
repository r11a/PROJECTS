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
  assert.match(gantt, /global-gantt-dependencies/);
  assert.match(gantt, /dependency_task_id/);
  assert.match(gantt, /משימה קריטית/);
  assert.match(gantt, /לוח גאנט לכל הפרויקטים/);
});

test('proprietary release is explicitly unlicensed for npm reuse', async () => {
  const packageJson = JSON.parse(await read('../package.json'));
  const license = await read('../../LICENSE');
  assert.equal(packageJson.license, 'UNLICENSED');
  assert.match(license, /All rights reserved/i);
  assert.match(license, /No permission is granted/i);
});
