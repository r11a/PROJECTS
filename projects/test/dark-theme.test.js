import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('the dark theme is loaded after every feature stylesheet',async()=>{
  const app=await read('src/App.jsx');
  const darkImport=app.lastIndexOf('import "./theme-dark.css"');
  assert.ok(darkImport>0);
  assert.equal(app.slice(darkImport).match(/import\s+["'][^"']+\.css["']/g)?.length,1);
});

test('granite mode covers atomic surfaces instead of only page backgrounds',async()=>{
  const css=await read('src/theme-dark.css');
  for(const selector of [
    '.projects-table-wrap',
    '.projects-table thead',
    '.master-stats span',
    '.client-command>label',
    '.professional-card',
    '.equipment-board-intro',
    '.equipment-parent-row',
    '.equipment-subrow',
    '.productivity-hero',
    '.forms-workspace',
    '.operational-form-card',
    '.form-builder-body',
    '.dynamic-form-fields',
    '.priority-wizard',
    '.message-center',
    '.voice-player',
    '.permission-matrix',
    '.calendar-year-view button',
    '.cg-shell',
    '.dropdown-menu',
    ".theme-dark input[type='range']",
    '.recharts-cartesian-grid-horizontal line',
    '.primary-button',
  ])assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('real documents are the only deliberately white dark-mode canvases',async()=>{
  const css=await read('src/theme-dark.css');
  const intentional=css.match(/\/\* White is intentional[^]*?\/\*[\s\S]*?\*\//)?.[0]||'';
  assert.match(intentional,/pdf-report-sheet/);
  assert.match(intentional,/document-viewer-stage iframe/);
  assert.doesNotMatch(intentional,/form|table|hero|toolbar/);
});
