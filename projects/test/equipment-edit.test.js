import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsRouter} from '../server/operations.js';

function fixture({available=true,failWrite=false}={}) {
  const original={id:1,project_id:'P1',catalog_item_id:10,project_system_id:8,effective_system_id:8,quantity:3,quantity_installed:2,status:'in_progress',location:'קומה 1',tag:'C1',notes:'הערה ידנית',custom_values:{site:'keep'},manufacturer:'Maker',model:'M1',unit:'יחידה'};
  let persisted={...original},working,catalogCreated=false;const calls=[];
  const query=async(sql,args=[])=>{
    calls.push(sql);
    if(sql==='BEGIN'){working={...persisted};return {rows:[]};}
    if(sql==='ROLLBACK'){catalogCreated=false;return {rows:[]};}
    if(sql==='COMMIT'){persisted=working;return {rows:[]};}
    if(sql.includes('FOR UPDATE OF pe'))return {rowCount:1,rows:[working]};
    if(sql.startsWith('SELECT * FROM project_equipment')){working={...persisted};return {rowCount:1,rows:[working]};}
    if(sql.startsWith('SELECT e.id FROM project_equipment'))return {rowCount:available?1:0,rows:available?[{id:20}]:[]};
    if(sql.startsWith('INSERT INTO equipment_catalog')){catalogCreated=true;return {rows:[]};}
    if(sql.startsWith('SELECT id FROM equipment_catalog'))return {rowCount:1,rows:[{id:30}]};
    if(sql.startsWith('UPDATE project_equipment SET')){
      if(failWrite)throw new Error('write failed');
      for(const match of sql.matchAll(/(\w+)=\$(\d+)/g))if(match[1]!=='id'&&match[1]!=='project_id')working[match[1]]=args[Number(match[2])-1];
      working.custom_values=JSON.parse(working.custom_values);return {rows:[working]};
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const router=createOperationsRouter({pool:{query,connect:async()=>({query,release:()=>calls.push('RELEASE')})},authenticate:(_q,_s,n)=>n(),requireRoles:()=> (_q,_s,n)=>n(),audit:async()=>{}});
  const handler=router.stack.find(l=>l.route?.path==='/projects/:id/equipment/:itemId'&&l.route.methods.patch).route.stack.at(-1).handle;
  const response={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  return {original,calls,response,persisted:()=>persisted,catalogCreated:()=>catalogCreated,run:body=>handler({params:{id:'P1',itemId:'1'},user:{id:1,role:'admin'},body},response)};
}

test('component replacement preserves project row identity, installation progress and manual fields',async()=>{
  const f=fixture();await f.run({catalogItemId:20});assert.equal(f.persisted().catalog_item_id,20);
  for(const key of ['id','project_id','project_system_id','quantity','quantity_installed','status','location','tag','notes','custom_values'])assert.deepEqual(f.persisted()[key],f.original[key]);
  assert.ok(f.calls.includes('COMMIT'));
});
test('replacement outside the project category is rejected without writing',async()=>{
  const f=fixture({available:false});await assert.rejects(f.run({catalogItemId:99}),/קטגוריה/);assert.equal(f.persisted().catalog_item_id,10);assert.ok(f.calls.includes('ROLLBACK'));
});
test('custom component name creates a separate catalog item without renaming the shared original',async()=>{
  const f=fixture();await f.run({manualName:'שם מותאם'});assert.equal(f.persisted().catalog_item_id,30);assert.ok(f.catalogCreated());assert.ok(!f.calls.some(sql=>sql.startsWith('UPDATE equipment_catalog')));
});
test('failed replacement rolls back catalog creation and releases the connection',async()=>{
  const f=fixture({failWrite:true});await assert.rejects(f.run({manualName:'שם מותאם'}),/write failed/);assert.equal(f.persisted().catalog_item_id,10);assert.equal(f.catalogCreated(),false);assert.equal(f.calls.at(-1),'RELEASE');
});
