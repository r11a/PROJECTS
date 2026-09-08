import express from 'express';
import multer from 'multer';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {parseTableFile,mapTableRows,threeWay,identity,clean,fields} from './tableImportParser.js';

const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const error=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const states={new:'חדש',changed:'השתנה',unchanged:'ללא שינוי',conflict:'התנגשות',invalid:'דורש תיקון',cancelled:'מבוטל במקור',missing:'חסר בקובץ'};

export function suggestProject(tables,projects) {
  const text=identity(tables.flatMap(t=>t.rows.flatMap(r=>r)).join(' | '));
  const matches=projects.filter(p=>identity(p.name).length>=3&&text.includes(identity(p.name)));
  return {matches:matches.map(p=>({id:p.id,name:p.name})),suggested:matches.length===1?matches[0].id:null};
}
function suggestSystem(table,systems) {
  const text=identity(table.rows.slice(0,8).flat().join(' '));
  const known=systems.filter(s=>text.includes(identity(s.name))&&identity(s.name).length>2);
  if(known.length===1)return {systemId:known[0].id,systemName:known[0].name};
  const rules=[[/מצלמ|cctv|camera/,'מצלמות'],[/רמקול|אודיו|audio|speaker/,'אודיו'],[/אזעק|alarm/,'אזעקה'],[/knx|בית חכם/,'בית חכם'],[/מולטימדיה|multimedia/,'מולטימדיה'],[/תקשורת|רשת|network/,'תקשורת']];
  const name=rules.find(([pattern])=>pattern.test(text))?.[1]||'ציוד מיובא';
  return {systemId:systems.find(s=>identity(s.name)===identity(name))?.id||null,systemName:name};
}
const catalogSignature=(name,manufacturer,model)=>JSON.stringify([clean(name),clean(manufacturer),clean(model)]);
const incoming=row=>row.kind==='task'?{title:`${row.id} · ${row.name}`,description:row.notes,status:row.status==='installed'?'done':row.status==='in_progress'?'in_progress':'open',due_date:row.due,estimated_hours:row.hours}:{catalog:catalogSignature([row.name,row.manufacturer,row.model].filter(Boolean).join(' · '),row.manufacturer,row.model),project_system:row.systemName,quantity:row.quantity,quantity_installed:row.status==='installed'?row.quantity:0,status:row.status,location:row.location,notes:row.notes,tag:row.id,import_floor:row.floor||''};
const equipmentValues=row=>({catalog:catalogSignature(row.name,row.manufacturer,row.model),project_system:row.system_name||'',quantity:Number(row.quantity),quantity_installed:Number(row.quantity_installed||0),status:row.status,location:row.location,notes:row.notes,tag:row.tag||'',import_floor:row.custom_values?.import_floor||''});
const taskValues=row=>({title:row.title,description:row.description,status:row.status,due_date:typeof row.due_date==='string'?row.due_date.slice(0,10):row.due_date?.toISOString().slice(0,10),estimated_hours:row.estimated_hours===null?null:Number(row.estimated_hours)});

async function loadState(db,projectId,lock=false) {
  const p=await db.query('SELECT id,name FROM projects WHERE id=$1'+(lock?' FOR UPDATE':''),[projectId]);if(!p.rowCount)throw error('הפרויקט לא נמצא',404);
  const equipment=(await db.query(`SELECT pe.*,e.name,e.manufacturer,e.model,s.name system_name FROM project_equipment pe JOIN equipment_catalog e ON e.id=pe.catalog_item_id LEFT JOIN equipment_catalog s ON s.id=COALESCE(pe.project_system_id,CASE WHEN e.item_type IN ('system','system_type') THEN e.id ELSE e.parent_id END) WHERE pe.project_id=$1${lock?' FOR UPDATE OF pe':''}`,[projectId])).rows;
  const tasks=(await db.query('SELECT * FROM tasks WHERE project_id=$1'+(lock?' FOR UPDATE':''),[projectId])).rows;
  const links=(await db.query('SELECT * FROM project_table_import_rows WHERE project_id=$1',[projectId])).rows;
  const systems=(await db.query("SELECT id,name FROM equipment_catalog WHERE item_type='system' AND active=TRUE ORDER BY name")).rows;
  return {equipment,tasks,links,systems};
}

export function buildImportPlan(rows,state,choices={}) {
  const used=new Set();
  const plan=rows.map(row=>{
    const knownSystem=row.systemId?state.systems.find(s=>String(s.id)===String(row.systemId)):state.systems.find(s=>identity(s.name)===identity(row.systemName));
    if(row.systemId&&!knownSystem)row={...row,error:'מערכת היעד אינה זמינה'};
    row={...row,systemName:knownSystem?.name||row.systemName,systemId:knownSystem?.id||null};
    const link=state.links.find(l=>l.source_key===row.key),collection=row.kind==='task'?state.tasks:state.equipment;
    const overrides={...(link?.overrides||{}),...Object.fromEntries(Object.entries(choices[row.key]?.edits||{}).filter(([k])=>['name','manufacturer','model'].includes(k)).map(([k,v])=>[k,clean(v).slice(0,160)]))};
    row={...row,...overrides};const values=incoming(row);
    let existing=link?collection.find(e=>String(e.id)===String(row.kind==='task'?link.task_id:link.equipment_id)):undefined;
    let problem=row.error;
    if(link&&!existing)problem='הרכיב המקושר נמחק או שסוג הרשומה השתנה. לא ייווצר מחדש אוטומטית';
    if(!link){
      const explicit=choices[row.key]?.existingId;
      const matches=explicit?collection.filter(e=>String(e.id)===String(explicit)):row.kind==='equipment'?collection.filter(e=>identity(e.tag||e.serial_number)===row.key):collection.filter(e=>identity(e.title.split(' · ')[0])===row.key);
      if(matches.length>1)problem='כמה רשומות קיימות מתאימות למזהה; בחרו שיוך יחיד';
      if(explicit&&!matches.length)problem='הרשומה שנבחרה אינה בפרויקט';
      if(matches.length===1)existing=matches[0];
      if(existing&&state.links.some(l=>l.source_key!==row.key&&String(row.kind==='task'?l.task_id:l.equipment_id)===String(existing.id)))problem='הרשומה מקושרת כבר למזהה אחר';
    }
    const current=existing?(row.kind==='task'?taskValues(existing):equipmentValues(existing)):null;
    const diff=existing?threeWay(link?.source_values||null,current,values):{changes:[],conflicts:[]};
    if(existing&&!link&&diff.changes.length)diff.conflicts=[...diff.changes];
    let status=problem?'invalid':row.cancelled?'cancelled':!existing?'new':diff.conflicts.length?'conflict':diff.changes.length?'changed':'unchanged';
    const existingKey=existing?`${row.kind}:${existing.id}`:null;
    if(existingKey&&used.has(existingKey)){status='invalid';problem='שתי שורות מבקשות לעדכן את אותה רשומה';}if(existingKey)used.add(existingKey);
    return {...row,values,current,overrides,existingId:existing?.id||null,status,problem,changes:diff.changes,conflicts:diff.conflicts,linked:Boolean(link)};
  });
  const present=new Set(rows.map(r=>r.key));
  for(const link of state.links)if(!present.has(link.source_key))plan.push({key:link.source_key,id:link.source_key,status:'missing',problem:'לא יימחק: ייתכן שהקובץ חלקי',changes:[],conflicts:[]});
  return plan;
}

async function ensureSystem(db,name) {
  await db.query("INSERT INTO equipment_catalog(item_type,name) VALUES('system_type',$1) ON CONFLICT DO NOTHING",[name]);
  const parent=(await db.query("SELECT id FROM equipment_catalog WHERE item_type='system_type' AND parent_id IS NULL AND lower(name)=lower($1)",[name])).rows[0];
  if(!parent)throw error('לא ניתן ליצור קטגוריה');
  await db.query("INSERT INTO equipment_catalog(item_type,parent_id,name) VALUES('system',$1,$2) ON CONFLICT DO NOTHING",[parent.id,name]);
  const row=(await db.query("SELECT id FROM equipment_catalog WHERE item_type='system' AND parent_id=$1 AND lower(name)=lower($2)",[parent.id,name])).rows[0];
  if(!row)throw error('לא ניתן ליצור מערכת יעד');return row.id;
}
async function ensureCatalog(db,systemId,signature) {
  const [name,manufacturer,model]=JSON.parse(signature);
  await db.query("INSERT INTO equipment_catalog(item_type,parent_id,name,manufacturer,model,unit) VALUES('component',$1,$2,$3,$4,'יחידה') ON CONFLICT DO NOTHING",[systemId,name,manufacturer,model]);
  const row=(await db.query("SELECT id,manufacturer,model FROM equipment_catalog WHERE item_type='component' AND parent_id=$1 AND lower(name)=lower($2)",[systemId,name])).rows[0];
  if(!row||clean(row.manufacturer)!==manufacturer||clean(row.model)!==model)throw error('התנגשות בפריט קטלוג: אותו שם עם יצרן או דגם שונים');return row.id;
}

export function createTableImportRouter({pool,authenticate,requireRoles,audit,dataDir}) {
  const router=express.Router(),previews=new Map();
  setInterval(()=>{for(const [key,p] of previews)if(p.expires<Date.now())previews.delete(key);},60000).unref();
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1}});
  router.use(authenticate);
  const permission=requireRoles('admin','manager');
  const retrieve=request=>{const p=previews.get(request.body.previewId);if(!p||p.userId!==String(request.user.id)||p.expires<Date.now())throw error('התצוגה פגה; העלו את הקובץ מחדש',410);return p;};
  router.post('/table-import/discard',permission,(request,response)=>{const p=previews.get(request.body.previewId);if(p?.userId===String(request.user.id))previews.delete(request.body.previewId);response.sendStatus(204);});
  router.post('/table-import/inspect',permission,upload.single('file'),async(request,response)=>{
    if(!request.file)throw error('יש לבחור קובץ');
    for(const [key,p] of previews)if(p.expires<Date.now())previews.delete(key);
    if(previews.size>=6||[...previews.values()].filter(p=>p.userId===String(request.user.id)).length>=3)throw error('יש יותר מדי תצוגות פתוחות; סיימו ייבוא פתוח או נסו שוב לאחר פקיעתו',429);
    const parsed=await parseTableFile(request.file.buffer,request.file.originalname);
    let filename=request.file.originalname;
    if([...filename].every(c=>c.charCodeAt(0)<=255)){const decoded=Buffer.from(filename,'latin1').toString('utf8');if(!decoded.includes('\uFFFD'))filename=decoded;}
    filename=path.basename(filename).replace(/[\u0000-\u001f]/g,'').slice(0,240);
    const projects=(await pool.query('SELECT id,name FROM projects WHERE archived_at IS NULL ORDER BY name')).rows;
    const systems=(await pool.query("SELECT id,name FROM equipment_catalog WHERE item_type='system' AND active=TRUE ORDER BY name")).rows;
    parsed.tables=parsed.tables.map(t=>({...t,...suggestSystem(t,systems)}));
    const previewId=randomUUID(),detection=suggestProject(parsed.tables,projects);
    previews.set(previewId,{userId:String(request.user.id),parsed,fileHash:hash(request.file.buffer),buffer:request.file.buffer,filename,expires:Date.now()+30*60000});
    response.json({previewId,...parsed,projects,systems,fields,states,detection});
  });
  router.post('/table-import/plan',permission,async(request,response)=>{
    const preview=retrieve(request),projectId=String(request.body.projectId||'');
    const rows=mapTableRows(preview.parsed,request.body.configs||[]);if(!rows.length)throw error('לא נמצאו שורות לייבוא. בדקו את המיפוי והגיליונות המסומנים');
    const state=await loadState(pool,projectId),choices=request.body.choices||{};
    const plan=buildImportPlan(rows,state,choices),digest=hash(plan),planId=randomUUID();
    const duplicate=(await pool.query('SELECT id FROM project_table_imports WHERE project_id=$1 AND file_hash=$2 LIMIT 1',[projectId,preview.fileHash])).rowCount>0;
    preview.plan={projectId,configs:request.body.configs,choices,rows,digest,planId};
    response.json({plan,planId,duplicate,existingEquipment:state.equipment.map(e=>({id:e.id,label:[e.tag,e.name,e.location].filter(Boolean).join(' · ')})),existingTasks:state.tasks.map(t=>({id:t.id,label:t.title}))});
  });
  router.post('/table-import/commit',permission,async(request,response)=>{
    const preview=retrieve(request),saved=preview.plan;
    if(!saved||saved.planId!==request.body.planId||request.body.confirm!==true)throw error('נדרש אישור מפורש לתצוגה המקדימה');
    const db=await pool.connect();let summary={created:0,updated:0,unchanged:0,skipped:0},importId,writtenPath;
    try{
      await db.query('BEGIN');
      const state=await loadState(db,saved.projectId,true),plan=buildImportPlan(saved.rows,state,saved.choices);
      if(hash(plan)!==saved.digest)throw error('נתוני הפרויקט השתנו מאז התצוגה. רעננו את ההשוואה ואשרו שוב',409);
      const decisions=request.body.decisions||{};
      for(const row of plan)if(row.status==='conflict'&&!['file','keep','skip'].includes(decisions[row.key]))throw error('יש להכריע בכל התנגשות או לדלג עליה');
      importId=(await db.query('INSERT INTO project_table_imports(project_id,filename,file_hash,mapping,summary,created_by,token) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[saved.projectId,preview.filename,preview.fileHash,JSON.stringify(saved.configs),'{}',request.user.id,saved.planId])).rows[0].id;
      const systemIds=new Map(state.systems.map(s=>[s.name,s.id])),catalogIds=new Map();
      for(const row of plan){
        if(['invalid','cancelled','missing'].includes(row.status)||decisions[row.key]==='skip'){summary.skipped++;continue;}
        let id=row.existingId;
        const apply=row.status==='new'||(row.changes.length&&decisions[row.key]!=='keep');
        // Only incoming fields that changed since the last import are eligible for update.
        const values=row.current?{...row.current,...Object.fromEntries(row.changes.map(c=>[c.field,c.after]))}:row.values;
        if(apply&&row.kind==='equipment'){
          let systemId=systemIds.get(values.project_system);if(!systemId){systemId=await ensureSystem(db,values.project_system);systemIds.set(values.project_system,systemId);}
          const prior=state.equipment.find(e=>String(e.id)===String(id));
          let catalogId=row.current&&values.catalog===row.current.catalog?prior.catalog_item_id:catalogIds.get(`${systemId}:${values.catalog}`);
          if(!catalogId){catalogId=await ensureCatalog(db,systemId,values.catalog);catalogIds.set(`${systemId}:${values.catalog}`,catalogId);}
          if(prior&&values.project_system===row.current.project_system)systemId=prior.project_system_id;
          const args=[saved.projectId,catalogId,systemId,values.quantity,values.quantity_installed,values.status,values.location,values.notes,values.tag,JSON.stringify({...prior?.custom_values,import_floor:values.import_floor})];
          if(id)await db.query('UPDATE project_equipment SET catalog_item_id=$2,project_system_id=$3,quantity=$4,quantity_installed=$5,status=$6,location=$7,notes=$8,tag=$9,custom_values=$10,updated_at=NOW() WHERE project_id=$1 AND id=$11',[...args,id]);
          else id=(await db.query('INSERT INTO project_equipment(project_id,catalog_item_id,project_system_id,quantity,quantity_installed,status,location,notes,tag,custom_values) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',args)).rows[0].id;
        }else if(apply&&row.kind==='task'){
          const args=[saved.projectId,values.title,values.description,values.status,values.due_date,values.estimated_hours,request.user.id];
          if(id)await db.query("UPDATE tasks SET title=$2,description=$3,status=$4,due_date=$5,estimated_hours=$6,completed_at=CASE WHEN $4='done' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW(),version=version+1 WHERE project_id=$1 AND id=$7",[...args.slice(0,6),id]);
          else id=(await db.query("INSERT INTO tasks(project_id,title,description,status,due_date,estimated_hours,created_by,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $4='done' THEN NOW() ELSE NULL END) RETURNING id",args)).rows[0].id;
        }
        await db.query('INSERT INTO project_table_import_rows(project_id,source_key,equipment_id,task_id,source_values,import_id,overrides) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(project_id,source_key) DO UPDATE SET source_values=EXCLUDED.source_values,import_id=EXCLUDED.import_id,equipment_id=EXCLUDED.equipment_id,task_id=EXCLUDED.task_id,overrides=EXCLUDED.overrides',[saved.projectId,row.key,row.kind==='equipment'?id:null,row.kind==='task'?id:null,JSON.stringify(row.values),importId,JSON.stringify(row.overrides)]);
        if(row.status==='new')summary.created++;else if(apply)summary.updated++;else summary.unchanged++;
      }
      let fileId=(await db.query('SELECT f.id FROM project_table_imports i JOIN client_files f ON f.id=i.file_id WHERE i.project_id=$1 AND i.file_hash=$2 AND f.deleted_at IS NULL LIMIT 1',[saved.projectId,preview.fileHash])).rows[0]?.id;
      if(!fileId){
        const extension=path.extname(preview.filename).toLowerCase(),storedName=`${randomUUID()}${extension}`,directory=path.join(dataDir,'uploads','documents');
        await mkdir(directory,{recursive:true});const target=path.join(directory,storedName);await writeFile(target,preview.buffer,{flag:'wx'});writtenPath=target;
        const mime={'.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ods':'application/vnd.oasis.opendocument.spreadsheet','.csv':'text/csv','.pdf':'application/pdf'}[extension];
        fileId=(await db.query("INSERT INTO client_files(project_id,title,original_name,stored_name,mime_type,size_bytes,category,description,storage_area,uploaded_by,related_entity_type,related_entity_id) VALUES($1,$2,$2,$3,$4,$5,'ייבוא טבלה',$6,'internal',$7,'project_table_import',$8) RETURNING id",[saved.projectId,preview.filename,storedName,mime,preview.buffer.length,`מקור לייבוא ${importId}`,request.user.id,String(importId)])).rows[0].id;
      }
      await db.query('UPDATE project_table_imports SET summary=$2,file_id=$3 WHERE id=$1',[importId,JSON.stringify(summary),fileId]);
      await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');if(writtenPath)await unlink(writtenPath).catch(()=>{});throw e;}finally{db.release();}
    previews.delete(request.body.previewId);
    await audit(request,'import','project_table_import',String(importId),{projectId:saved.projectId,...summary});
    response.json({summary,projectId:saved.projectId});
  });
  return router;
}
