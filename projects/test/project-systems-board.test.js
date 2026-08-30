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
