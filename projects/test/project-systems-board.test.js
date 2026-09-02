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
  const [projectUi,projectCss,masterUi,masterCss,mobileMenu]=await Promise.all([read('src/ProjectWorkspace.jsx'),read('src/project-systems-board.css'),read('src/MasterDataWorkspace.jsx'),read('src/master-data.css'),read('src/MobileActionMenu.jsx')]);
  for(const label of ['מיקום','תיוג','כמות','הותקן','סטטוס'])assert.match(projectUi,new RegExp(`<small>${label}`));
  assert.match(projectCss,/\.subitem-field>small/);
  assert.match(projectCss,/grid-template-columns:minmax\(0,1fr\)!important/);
  for(const label of ['רכיב','מיקום','תיוג','מק״ט','כמות','סטטוס'])assert.match(masterUi,new RegExp(`<small>${label}`));
  assert.match(masterCss,/\.equipment-mobile-field>small/);
  assert.match(masterCss,/\.equipment-mobile-field\.item-name/);
  assert.match(projectUi,/mobile-subitem-menu/);
  assert.match(mobileMenu,/createPortal/);
  assert.match(mobileMenu,/MoreHorizontal/);
  assert.match(projectCss,/grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(masterUi,/equipment-mobile-menu/);
  assert.match(masterCss,/\.equipment-mobile-menu/);
  assert.match(masterUi,/MobileActionMenu label="פעולות מערכת"/);
});

test('master systems catalog supports collapsing and full CRUD entry points at every level',async()=>{
  const [ui,css]=await Promise.all([read('src/MasterDataWorkspace.jsx'),read('src/master-data.css')]);
  for(const token of ['collapsedCategories','equipment-category-toggle',"onCreate('system',category.id)","onCreate('component',system.id)",'עריכת רכיב','תת־קטגוריה / מערכת'])assert.match(ui,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/aria-expanded=\{categoryOpen\}/);
  assert.match(css,/\.equipment-category-toggle/);
  assert.match(css,/\.equipment-category-actions/);
});

test('uploaded system icons are optically bounded inside a fixed catalog frame',async()=>{
  const css=await read('src/master-data.css');
  assert.match(css,/\.equipment-category-toggle \.catalog-category-icon\{[^}]*overflow:hidden/);
  assert.match(css,/\.equipment-category-toggle \.catalog-category-icon>img\{[^}]*width:36px!important;[^}]*height:36px!important/);
  assert.match(css,/object-fit:contain;object-position:center/);
});

test('advanced project systems board supports field control sorting duplication and cross-system moves',async()=>{
  const [ui,server,migration]=await Promise.all([read('src/ProjectSystemsBoard.jsx'),read('server/operations.js'),read('migrations/044_project_system_field_controls.sql')]);
  for(const token of ['fieldSettings','newColumnType','groupSorts','expandedRows','projectSystemId','כמה עותקים ליצור?','system-fields','columnType','colorOverrides'])assert.match(ui,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const token of ['quantityInstalled','status===\'installed\'','projectSystemId','/duplicate','column_type','project_system_field_settings'])assert.match(server,new RegExp(token));
  for(const token of ['column_type','sku_override','project_system_field_settings'])assert.match(migration,new RegExp(token));
});

test('subitem column titles remain fully readable and sort from the title itself',async()=>{
  const [ui,css]=await Promise.all([read('src/ProjectSystemsBoard.jsx'),read('src/project-systems-board.css')]);
  assert.match(ui,/className="column-title-sort"/);
  assert.match(ui,/field\.type==='number'\?'minmax\(82px,/);
  assert.match(css,/\.board-fields-head span>svg\{position:absolute/);
  assert.match(css,/\.board-fields-head \.column-title-sort b\{[^}]*text-overflow:clip;white-space:normal/);
});

test('project systems export creates a styled RTL Excel workbook',async()=>{
  const [ui,server,dark]=await Promise.all([read('src/ProjectSystemsBoard.jsx'),read('server/projectIntelligence.js'),read('src/theme-dark.css')]);
  for(const token of ['systems.xlsx','ייצוא Excel','rowColorOverrides'])assert.match(ui,new RegExp(token));
  for(const token of ["import ExcelJS from 'exceljs'","addWorksheet('סיכום מערכות'","addWorksheet('רשימת רכיבים'",'rightToLeft:true','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])assert.match(server,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(dark,/Final commercial dark surface pass/);
  assert.match(dark,/--granite-0/);
});
