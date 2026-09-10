import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProjectCheck,loadProjectCheck} from '../server/projectCheck.js';

test('project checks exclude closed tasks and distinguish missing metadata from deliberate repeated products',()=>{
  const equipment=[{id:1,name:'Camera',manufacturer:'Maker',model:'M1',quantity:4,quantity_installed:2,tag:' C1 '},{id:2,name:'Camera',manufacturer:'Maker',model:'M1',quantity:1,quantity_installed:1,tag:'c2'}];
  const tasks=[{id:1,title:'Late',status:'open',overdue:true,assignee_id:1},{id:2,title:'Assigned professional',status:'open',assignee_professional_id:2},{id:3,status:'done',overdue:true},{id:4,status:'cancelled',overdue:true}];
  const result=buildProjectCheck({id:'P'},tasks,equipment);
  assert.deepEqual(result.findings.map(f=>f.key),['overdue','remaining']);
  assert.equal(result.findings[1].items[0].detail,'נותרו 2 להתקנה');
  assert.equal(result.truncated,false);
  const revised=buildProjectCheck({id:'P'},[{id:1,status:'open'}],[...equipment,{id:3,tag:'c1',manufacturer:' ',model:'',quantity:1,quantity_installed:2}]);
  assert.deepEqual(revised.findings.map(f=>f.key),['unassigned','specification','remaining','quantity','duplicates']);
  assert.equal(revised.findings.at(-1).count,2);
});

test('project check is bounded and queries only the selected project without writes',async()=>{
  const queries=[];
  const pool={query:async(sql,params)=>{queries.push(sql);assert.deepEqual(params,['P']);assert.match(sql,/^SELECT /);return {rows:sql.includes('FROM projects')?[{id:'P',name:'Project'}]:[]};}};
  const result=await loadProjectCheck(pool,'P');
  assert.equal(queries.length,3);assert.deepEqual(result.findings,[]);
  assert.equal(await loadProjectCheck({query:async()=>({rows:[]})},'missing'),null);
  const bounded=buildProjectCheck({id:'P'},Array.from({length:1001},(_,id)=>({id,status:'open'})),[]);
  assert.equal(bounded.truncated,true);assert.equal(bounded.findings[0].items.length,30);
});
