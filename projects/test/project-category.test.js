import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read=(name)=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('project category is generic, editable and forward compatible',async()=>{const [migration,server,app,workspace]=await Promise.all([read('migrations/036_project_category.sql'),read('server/index.js'),read('src/App.jsx'),read('src/ProjectWorkspace.jsx')]);for(const token of ['project_category','project_category_custom','project_profile'])assert.match(migration,new RegExp(token));assert.match(migration,/smart_home/);assert.match(migration,/other/);assert.doesNotMatch(migration,/hospital|hotel|office/i);assert.match(server,/projectCategoryCustom/);assert.match(server,/projectProfile/);assert.match(app,/הכל/);assert.match(app,/בית חכם/);assert.match(app,/אחרים/);assert.match(app,/workflowLabel/);assert.match(workspace,/projectCategoryCustom/);});

test('category participates in portfolio gantt, risk center, dashboard and reports',async()=>{const [gantt,risk,app,reports,reportUi]=await Promise.all([read('src/GanttWorkspace.jsx'),read('src/features/risk-center/RiskCenter.jsx'),read('src/App.jsx'),read('server/operations.js'),read('src/Workspaces.jsx')]);assert.match(gantt,/projectCategory/);assert.match(gantt,/category/);assert.match(risk,/project_category/);assert.match(app,/smartHomeCount/);assert.match(reports,/projectCategories/);assert.match(reportUi,/report-project-category/);});
