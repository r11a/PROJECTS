import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationsRouter } from '../server/operations.js';

function fixture(failTask=false) {
  let pending=null,persisted=null;const calls=[];
  const db={async query(sql,args=[]) {
    calls.push(sql);
    if(sql==='BEGIN')return {rows:[]};
    if(sql==='ROLLBACK'){pending=null;return {rows:[]};}
    if(sql==='COMMIT'){persisted=pending;return {rows:[]};}
    if(sql.startsWith('INSERT INTO project_site_reviews')){pending={id:9,project_id:'P1',created_by:1,plan_update_required:true};return {rows:[pending]};}
    if(sql.startsWith('INSERT INTO professionals'))return {rows:[{id:2}]};
    if(sql.startsWith('INSERT INTO tasks')){if(failTask)throw new Error('Task insert failed');return {rows:[{id:3}]};}
    return {rows:[]};
  },release(){calls.push('RELEASE');}};
  const router=createOperationsRouter({pool:{connect:async()=>db},authenticate:(_q,_s,next)=>next(),requireRoles:()=> (_q,_s,next)=>next(),audit:async()=>calls.push('AUDIT')});
  const handler=router.stack.find(layer=>layer.route?.path==='/projects/:id/site-reviews'&&layer.route.methods.post).route.stack.at(-1).handle;
  const response={status(){return this;},json(body){this.body=body;return this;}};
  return {calls,persisted:()=>persisted,response,run:()=>handler({params:{id:'P1'},user:{id:1},body:{reviewDate:'2026-09-08',summary:'Review',planUpdateRequired:true}},response)};
}

test('failed plan task rolls back the review and releases its connection',async()=>{
  const f=fixture(true);await assert.rejects(f.run(),/Task insert failed/);
  assert.equal(f.persisted(),null);assert.ok(f.calls.includes('ROLLBACK'));assert.ok(!f.calls.includes('COMMIT'));assert.equal(f.calls.at(-1),'RELEASE');
});
test('review and linked task commit before audit on a released connection',async()=>{
  const f=fixture();await f.run();assert.equal(f.persisted().plan_update_task_id,3);
  assert.deepEqual(f.calls.slice(-3),['COMMIT','RELEASE','AUDIT']);assert.equal(f.response.body.review.id,9);
});
