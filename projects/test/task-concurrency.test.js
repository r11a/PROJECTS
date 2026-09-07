import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationsRouter } from '../server/operations.js';

function fixture({version=3, failAssignments=false}={}) {
  const original={id:41,version,title:'Original',description:'Keep this',status:'open',priority:'normal',project_id:null,start_date:'2026-09-08',due_date:'2026-09-09',all_day:true};
  let persisted={...original}, working;
  const calls=[];
  const db={
    async query(sql, args=[]) {
      calls.push(sql);
      if(sql==='BEGIN') { working={...persisted}; return {rows:[]}; }
      if(sql==='COMMIT') { persisted=working; return {rows:[]}; }
      if(sql==='ROLLBACK') { working=null; return {rows:[]}; }
      if(sql.startsWith('SELECT * FROM tasks')) return {rowCount:1,rows:[{...working}]};
      if(sql.startsWith('SELECT professional_id')) return {rows:[]};
      if(sql.startsWith('UPDATE tasks SET title')) {
        working={...working,title:args[0],description:args[1],version:working.version+1};
        return {rowCount:1,rows:[{...working}]};
      }
      if(sql.startsWith('DELETE FROM task_assignees')) {
        if(failAssignments) throw new Error('Assignment write failed');
        return {rows:[]};
      }
      throw Error(`Unexpected query: ${sql}`);
    },
    release(){calls.push('RELEASE');},
  };
  const router=createOperationsRouter({pool:{connect:async()=>db},authenticate:(_q,_s,next)=>next(),requireRoles:()=> (_q,_s,next)=>next(),audit:async()=>{calls.push('AUDIT');}});
  const handler=router.stack.find(layer=>layer.route?.path==='/operations/tasks/:id' && layer.route.methods.patch).route.stack.at(-1).handle;
  const response={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  return {calls,response,persisted:()=>persisted,run:body=>handler({params:{id:'41'},user:{id:1,role:'admin'},body},response)};
}

test('stale task edit returns a conflict without modifying the task',async()=>{
  const f=fixture(); await f.run({expectedVersion:2,title:'Stale edit'});
  assert.equal(f.response.statusCode,409);
  assert.equal(f.response.body.code,'EDIT_CONFLICT');
  assert.equal(f.persisted().title,'Original');
  assert.ok(f.calls.includes('ROLLBACK'));
  assert.equal(f.calls.at(-1),'RELEASE');
  assert.ok(!f.calls.includes('AUDIT'));
});

test('valid task edit locks the row and commits before audit',async()=>{
  const f=fixture(); await f.run({expectedVersion:3,title:'Updated'});
  assert.equal(f.response.statusCode,200);
  assert.equal(f.response.body.task.version,4);
  assert.equal(f.persisted().description,'Keep this');
  assert.ok(f.calls.some(sql=>sql.endsWith('FOR UPDATE')));
  assert.ok(f.calls.indexOf('COMMIT') < f.calls.indexOf('AUDIT'));
  assert.ok(f.calls.indexOf('RELEASE') < f.calls.indexOf('AUDIT'));
  assert.equal(f.calls.filter(call=>call==='RELEASE').length,1);
});

test('assignment failure rolls back the task edit as well',async()=>{
  const f=fixture({failAssignments:true});
  await assert.rejects(f.run({expectedVersion:3,title:'Must not persist',assigneeProfessionalIds:[]}),/Assignment write failed/);
  assert.equal(f.persisted().title,'Original');
  assert.equal(f.persisted().version,3);
  assert.ok(f.calls.includes('ROLLBACK'));
  assert.ok(!f.calls.includes('COMMIT'));
  assert.equal(f.calls.at(-1),'RELEASE');
});
