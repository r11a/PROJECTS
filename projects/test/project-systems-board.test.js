import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('project systems board persists groups rows custom columns colors and execution quantities',async()=>{
  const [ui,server,migration]=await Promise.all([read('src/ProjectWorkspace.jsx'),read('server/operations.js'),read('migrations/043_project_system_board.sql')]);
  for(const token of ['ProjectSystemsBoard','draggable={canEdit','system-board-order','equipment-order','system-columns/order','quantityInstalled','rowColor','customValues'])assert.match(ui,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const token of ['project_system_board','project_system_columns','board_order','quantity_installed','custom_values'])assert.match(server,new RegExp(token));
  for(const token of ['project_system_board','project_system_columns','board_order','tag TEXT','row_color','custom_values JSONB'])assert.match(migration,new RegExp(token));
});

test('project systems board foreign keys use the existing text project identity',async()=>{
  const migration=await readFile(new URL('../migrations/043_project_system_board.sql',import.meta.url),'utf8');
  assert.match(migration,/project_id TEXT NOT NULL REFERENCES projects\(id\)/);
  assert.doesNotMatch(migration,/project_id BIGINT NOT NULL REFERENCES projects\(id\)/);
});

test('subitem grids remain valid when there are no custom columns',async()=>{
  const [projectBoard,masterBoard]=await Promise.all([read('src/ProjectWorkspace.jsx'),read('src/MasterDataWorkspace.jsx')]);
  assert.match(projectBoard,/const subitemGrid=.*columns\.map/);
  assert.match(projectBoard,/project-subitem-head" style=\{\{gridTemplateColumns:subitemGrid\}\}/);
  assert.match(projectBoard,/project-subitem-row" key=\{item\.id\} style=\{\{[^}]*gridTemplateColumns:subitemGrid/);
  assert.match(masterBoard,/const subitemGrid=.*columns\.map/);
  assert.match(masterBoard,/equipment-subhead" style=\{\{gridTemplateColumns:subitemGrid\}\}/);
  assert.match(masterBoard,/equipment-subrow" key=\{child\.id\} style=\{\{gridTemplateColumns:subitemGrid\}\}/);
});

test('system colors cascade to subitems while individual color overrides remain reversible',async()=>{
  const [ui,server]=await Promise.all([read('src/ProjectWorkspace.jsx'),read('server/operations.js')]);
  assert.match(ui,/propagateColor:Object\.prototype\.hasOwnProperty/);
  assert.match(ui,/חזרה לצבע המערכת/);
  assert.match(ui,/save\(item,\{rowColor:''\}\)/);
  assert.match(server,/request\.body\.propagateColor/);
  assert.match(server,/SET row_color='',updated_at=NOW\(\)/);
  assert.match(server,/hasOwnProperty\.call\(request\.body,'rowColor'\)/);
});

test('systems boards expose labelled touch-friendly mobile subitem cards',async()=>{
  const [projectUi,projectCss,masterUi,masterCss]=await Promise.all([read('src/ProjectWorkspace.jsx'),read('src/project-systems-board.css'),read('src/MasterDataWorkspace.jsx'),read('src/master-data.css')]);
  for(const label of ['מיקום','תיוג','כמות','הותקן','סטטוס'])assert.match(projectUi,new RegExp(`<small>${label}`));
  assert.match(projectCss,/\.subitem-field>small/);
  assert.match(projectCss,/grid-template-columns:minmax\(0,1fr\) 78px 78px!important/);
  for(const label of ['פריט','מיקום','תיוג','מק״ט','כמות','סטטוס'])assert.match(masterUi,new RegExp(`<small>${label}`));
  assert.match(masterCss,/\.equipment-mobile-field>small/);
  assert.match(masterCss,/\.equipment-mobile-field\.item-name/);
});
