import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('productivity platform persists templates, automations, baselines and change requests',async()=>{
  const migration=await read('migrations/027_productivity_platform.sql');
  for(const table of ['saved_views','project_templates','project_template_tasks','automation_rules','automation_runs','project_baselines','project_change_requests']) assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration,/projects_template_fk/);
});

test('daily work, portfolio control and project governance are wired into the UI',async()=>{
  const [app,workspace,project,settings]=await Promise.all([read('src/App.jsx'),read('src/ProductivityWorkspace.jsx'),read('src/ProjectWorkspace.jsx'),read('src/Operational.jsx')]);
  assert.match(app,/MyWorkWorkspace/);assert.match(app,/PortfolioControlWorkspace/);assert.match(app,/templateId: form\.templateId/);
  assert.match(workspace,/ProjectGovernancePanel/);assert.match(workspace,/saved-views\?workspace=my-work/);
  assert.match(project,/שינויים ובקרה/);assert.match(settings,/ProductivitySettings/);
});

test('automation engine is connected to real lifecycle events and overdue scheduling',async()=>{
  const [server,operations,engine]=await Promise.all([read('server/index.js'),read('server/operations.js'),read('server/productivity.js')]);
  assert.match(server,/project_created/);assert.match(server,/project_stage_changed/);assert.match(server,/SELECT \* FROM project_templates WHERE id=\$1 AND active=TRUE/);assert.match(operations,/task_status_changed/);
  assert.match(engine,/startAutomationScheduler/);assert.match(engine,/triggerType:'task_overdue'/);
  assert.doesNotMatch(engine,/SUM\(DISTINCT e\.hours\)/);
});
