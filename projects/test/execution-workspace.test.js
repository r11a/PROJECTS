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

test('Gantt scheduling supports drag, resize, long press duration and persistent color', async () => {
  const timeline = await read('../src/GanttTimeline.jsx');
  const operations = await read('../server/operations.js');
  const migration = await read('../migrations/019_gantt_messages.sql');
  for (const token of ['beginTaskDrag','moveTaskDrag','adjustDialogDuration','scheduleColors','onScheduleChange','mentionUserIds','משימה קריטית']) assert.match(timeline,new RegExp(token));
  assert.match(timeline,/item\.critical \? "#C92A3A"/);
  assert.match(operations,/critical=\$13,color=\$14/);
  assert.match(migration,/ALTER TABLE tasks ADD COLUMN IF NOT EXISTS color/);
});

test('project time reporting keeps targets in project setup and actual hours in the workspace', async () => {
  const app = await read('../src/App.jsx');
  const operational = await read('../src/Operational.jsx');
  const projectWorkspace = await read('../src/ProjectWorkspace.jsx');
  const operations = await read('../server/operations.js');
  const server = await read('../server/index.js');
  const migration = await read('../migrations/021_task_avatars_project_hours.sql');
  const avatarLiveMigration = await read('../migrations/022_user_avatar_live_updates.sql');
  const avatarRecoveryMigration = await read('../migrations/023_recover_merged_user_avatars.sql');
  const demoMigration = await read('../migrations/024_demo_data_management.sql');
  for (const token of ['installationHoursTarget','programmingHoursTarget']) {
    assert.match(app,new RegExp(token));
    assert.match(projectWorkspace,new RegExp(token));
    assert.match(server,new RegExp(token));
  }
  assert.match(projectWorkspace,/דיווח שעות עבודה/);
  assert.doesNotMatch(projectWorkspace,/ProjectModal/);
  assert.match(app,/onChanged=\{refreshCurrentUser\}/);
  assert.match(app,/onChanged\?\.\(result\.user\)/);
  assert.match(avatarLiveMigration,/CREATE TRIGGER projects_live_change[\s\S]*ON users/);
  assert.match(app,/uploadCurrentUserAvatar/);
  assert.match(server,/post\('\/api\/auth\/avatar'/);
  assert.match(server,/installationHoursTarget:0, programmingHoursTarget:0/);
  assert.match(server,/column === 'installation_hours_target' \|\| column === 'programming_hours_target'/);
  assert.match(server,/avatar_image=COALESCE\(NULLIF\(avatar_image,''\),NULLIF\(\$7,''\),''\)/);
  assert.match(avatarRecoveryMigration,/merged_into_user_id = primary_user\.id/);
  assert.match(demoMigration,/ADD COLUMN IF NOT EXISTS is_demo/);
  assert.match(server,/patch\('\/api\/system\/demo-data'/);
  assert.match(server,/לא ניתן להפעיל נתוני דמו לאחר שנוצר מידע אמיתי במערכת/);
  assert.match(server,/DELETE FROM projects WHERE id=ANY\(\$1::text\[\]\) AND is_demo=TRUE/);
  assert.match(server,/get\('\/api\/auth\/avatar'/);
  assert.match(app,/user\.avatarImage \|\| user\.id \|\| "current"/);
  assert.match(operational,/DemoDataToggle/);
  assert.match(operational,/activationLocked/);
  assert.match(projectWorkspace,/openRequest/);
  assert.doesNotMatch(projectWorkspace,/setTargetsOpen/);
  assert.match(operations,/project_time_entries/);
  assert.match(operations,/operations\/tasks\/count/);
  assert.match(migration,/installation_hours_target/);
  assert.match(migration,/programming_hours_target/);
});

test('professional roles and profiles are fully manageable', async()=>{
  const management=await read('../server/management.js');
  const master=await read('../src/MasterDataWorkspace.jsx');
  const operational=await read('../src/Operational.jsx');
  const migration=await read('../migrations/025_professional_profiles_and_fields.sql');
  assert.match(management,/role_\$\{randomUUID\(\)\.replaceAll\('-',''\)\}/);
  assert.match(management,/patch\('\/professional-roles\/:id'/);
  assert.match(management,/delete\('\/professional-roles\/:id'/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS first_name/);
  assert.match(migration,/professional'/);
  assert.match(master,/professionalAffiliation/);
  assert.match(master,/company-flag-logo/);
  assert.match(master,/roleIconOptions/);
  assert.match(master,/customFields=\[\]/);
  assert.match(operational,/<option value="professional">/);
});

test('management reports, presentation, replies and mentions are wired end to end', async () => {
  const workspaces = await read('../src/Workspaces.jsx');
  const messages = await read('../src/Messages.jsx');
  const operational = await read('../server/operational.js');
  assert.match(workspaces,/generatePresentation/);
  assert.match(workspaces,/generateAiReport/);
  assert.match(workspaces,/ישיבת ניהול פרויקטים/);
  assert.match(messages,/const reply/);
  assert.match(messages,/insertMention/);
  assert.match(operational,/parent_message_id/);
  assert.match(operational,/mentions:mentioned/);
  assert.match(operational,/router\.post\('\/mentions'/);
});

test('proprietary release is explicitly unlicensed for npm reuse', async () => {
  const packageJson = JSON.parse(await read('../package.json'));
  const license = await read('../../LICENSE');
  assert.equal(packageJson.license, 'UNLICENSED');
  assert.match(license, /All rights reserved/i);
  assert.match(license, /No permission is granted/i);
});
