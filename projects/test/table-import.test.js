import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {parseTableFile,mapTableRows,parseCsv,threeWay} from '../server/tableImportParser.js';
import {buildImportPlan,suggestProject} from '../server/tableImport.js';
import {groupEquipment} from '../src/features/priority-import/equipmentGrouping.js';

const fixture=()=>({tables:[{index:0,name:'קומה -2',rows:[['התקנות מצלמות בית לוי'],['שם מצלמה','מצב','הערות','מיקום/שם מצלמה','סוג מצלמה'],['-2c1','לא מותקן','חסרה נקודה','חניה','מיני'],['-2c2','מותקן','','מסדרון','מיני'],['סיכום התקנות'],['סהכ','2']]}]});
const config=[{index:0,enabled:true,headerRow:1,mapping:{id:0,status:1,notes:2,location:3,type:4},kind:'equipment',systemName:'מצלמות'}];
const empty=()=>({equipment:[],tasks:[],links:[],systems:[]});

test('XLSX and ODS detect multi-row headers, preserve identifiers and exclude summary rows',async()=>{
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('קומה -2');fixture().tables[0].rows.forEach(r=>sheet.addRow(r));
  const parsed=await parseTableFile(Buffer.from(await workbook.xlsx.writeBuffer()),'test.xlsx');
  assert.equal(parsed.tables[0].headerRow,1);assert.equal(parsed.tables[0].mapping.id,0);
  const rows=mapTableRows(parsed,config);assert.equal(rows.length,2);assert.equal(rows[0].id,'-2c1');assert.equal(rows[1].status,'installed');
  const zip=new JSZip();zip.file('content.xml','<office:document><table:table table:name="Test"><table:table-row><table:table-cell><text:p>id</text:p></table:table-cell><table:table-cell><text:p>notes</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>A1</text:p></table:table-cell><table:table-cell table:number-rows-spanned="2"><text:p>Shared note</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>A2</text:p></table:table-cell><table:covered-table-cell/></table:table-row></table:table></office:document>');
  const ods=await parseTableFile(await zip.generateAsync({type:'nodebuffer'}),'test.ods');assert.equal(ods.tables[0].rows[2][1],'Shared note');
});

test('CSV preserves quoted cells and line breaks and refuses malformed quotes',()=>{
  assert.deepEqual(parseCsv('Project title\nid,name\nC1,Camera'),[['Project title'],['id','name'],['C1','Camera']]);
  assert.deepEqual(parseCsv('id;notes\nA1;"one;two"\nA2;"line1\nline2"'),[['id','notes'],['A1','one;two'],['A2','line1\nline2']]);
  assert.throws(()=>parseCsv('id,notes\nA1,"unfinished'),/CSV/);
});

test('project matching proposes one exact project name, exposes ambiguity and ignores files without a match',()=>{
  assert.equal(suggestProject(fixture().tables,[{id:'p1',name:'בית לוי'}]).suggested,'p1');
  assert.equal(suggestProject(fixture().tables,[{id:'p1',name:'בית לוי'},{id:'p2',name:'בית לוי'}]).suggested,null);
  assert.equal(suggestProject(fixture().tables,[{id:'p2',name:'בית כהן'}]).matches.length,0);
});

test('duplicate IDs and ranges are blocked, cancelled rows remain excluded and tasks require a valid date',()=>{
  const f=fixture();f.tables[0].rows.splice(4,0,['-2c1','בוטל'],['0c61- 0c67','מותקן']);
  const rows=mapTableRows(f,config);assert.match(rows[0].error,/מזהה/);assert.match(rows[2].error,/מזהה/);assert.match(rows[3].error,/טווח/);
  const plan=buildImportPlan(mapTableRows(fixture(),[{...config[0],kind:'task',due:'2026-02-31'}]),empty());assert.equal(plan[0].status,'invalid');
});

test('three-way comparison preserves local-only edits and flags simultaneous source changes',()=>{
  const baseline={notes:'original',location:'A',quantity:1};
  assert.deepEqual(threeWay(baseline,{...baseline,notes:'manual'},baseline),{changes:[],conflicts:[]});
  const result=threeWay(baseline,{...baseline,notes:'manual'},{...baseline,notes:'file'});assert.equal(result.conflicts.length,1);
  assert.equal(threeWay(baseline,{...baseline,location:'B'},{...baseline,notes:'file'}).conflicts.length,0);
});

test('repeat imports update existing records without duplicates, retain overrides and flag deleted targets',()=>{
  const rows=mapTableRows(fixture(),config),first=buildImportPlan(rows,empty(),{'-2c1':{edits:{name:'מצלמת כיפה',manufacturer:'Maker',model:'M1'}}})[0];
  const [name,manufacturer,model]=JSON.parse(first.values.catalog);
  const current={id:1,name,manufacturer,model,system_name:'מצלמות',quantity:1,quantity_installed:0,status:'waiting',location:first.values.location,notes:first.values.notes,tag:'-2c1'};
  const state={...empty(),equipment:[current],links:[{source_key:'-2c1',equipment_id:1,source_values:first.values,overrides:first.overrides}]};
  assert.equal(buildImportPlan(rows,state)[0].status,'unchanged');assert.equal(buildImportPlan(rows,state)[0].manufacturer,'Maker');
  assert.equal(buildImportPlan(rows,{...state,equipment:[]})[0].status,'invalid');
  assert.equal(buildImportPlan([],state)[0].status,'missing');
  assert.equal(buildImportPlan(rows,{...state,links:[]})[0].status,'conflict');
});

test('floor summaries count identical equipment while preserving every source identifier and separating models',()=>{
  const items=[{id:1,tag:'C1',catalog_item_id:4,name:'Dome',quantity:2,quantity_installed:1,custom_values:{import_floor:'-2'}},{id:2,tag:'C2',catalog_item_id:4,name:'Dome',quantity:1,quantity_installed:1,custom_values:{import_floor:'-2'}},{id:3,tag:'C3',catalog_item_id:4,name:'Dome',quantity:1,custom_values:{import_floor:'0'}},{id:4,tag:'C4',catalog_item_id:5,name:'Dome',quantity:1,custom_values:{import_floor:'-2'}}];
  const grouped=groupEquipment(items);assert.equal(grouped.length,3);const pair=grouped.find(g=>g.items.length===2);assert.equal(pair.quantity,3);assert.equal(pair.installed,2);assert.deepEqual(pair.items.map(i=>i.tag),['C1','C2']);
});

test('multiple sheets may have independent mappings and duplicate IDs across sheets are blocked',async()=>{
  const w=new ExcelJS.Workbook();w.addWorksheet('Floor -1').addRows([['id','name'],['C1','Camera']]);w.addWorksheet('Floor 0').addRows([['notes','tag','description'],['existing','C1','Camera']]);
  const parsed=await parseTableFile(Buffer.from(await w.xlsx.writeBuffer()),'test.xlsx');assert.equal(parsed.tables[1].mapping.id,1);
  const rows=mapTableRows(parsed,parsed.tables.map(t=>({...t,kind:'equipment'})));assert.equal(rows.length,2);assert.ok(rows.every(r=>r.error));
});
