import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(path)=>readFile(new URL(path,import.meta.url),'utf8');

test('tasks support multiple performers, half-hour planning and the extended task taxonomy',async()=>{
  const [migration,server,ui]=await Promise.all([
    read('../migrations/037_task_collaboration_and_reviews.sql'),
    read('../server/operations.js'),
    read('../src/Workspaces.jsx'),
  ]);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS task_assignees/);
  assert.match(migration,/supervision.*inspection.*meeting/s);
  assert.match(server,/replaceTaskAssignees/);
  assert.match(ui,/assigneeProfessionalIds/);
  assert.match(ui,/step="0\.5"/);
  assert.match(ui,/>פיקוח</);
});

test('calendar and project dashboard use the requested compact operational controls',async()=>{
  const [calendar,risk,project,dashboard]=await Promise.all([
    read('../src/Operational.jsx'),
    read('../src/features/risk-center/RiskCenter.jsx'),
    read('../src/ProjectWorkspace.jsx'),
    read('../src/App.jsx'),
  ]);
  assert.match(calendar,/כל המשתמשים/);
  assert.match(calendar,/\["monthDetail","חודש מפורט"\]/);
  assert.match(risk,/slice\(0,expanded\?visible\.length:3\)/);
  assert.match(risk,/'הרחב'/);
  assert.doesNotMatch(risk,/הצג את כל הפרויקטים/);
  assert.match(dashboard,/'הפק תובנות'/);
  assert.doesNotMatch(dashboard,/<InsightsTile/);
  assert.match(dashboard,/active\.map\(\(project,index\)/);
  assert.match(dashboard,/expected-\$\{entry\.id\}/);
  assert.match(dashboard,/paid-\$\{entry\.id\}/);
  assert.match(project,/פעילות, שינויים ובקרה/);
  assert.match(project,/קבצים ומסמכים/);
});
