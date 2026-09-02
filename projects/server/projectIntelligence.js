import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';

const VOICE_LIMIT_BYTES = 8 * 1024 * 1024;
const VOICE_MIMES = new Set(['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a']);

export function calculateHealth(row, canViewFinance = true) {
  const reasons=[];
  let score=100;
  const apply=(points,label,kind,entityId=null)=>{if(points<=0)return;score-=points;reasons.push({points,label,kind,entityId});};
  apply(Math.min(30,Number(row.overdue_tasks||0)*6),`${row.overdue_tasks} משימות באיחור`,'tasks',row.risk_task_id);
  apply(Math.min(20,Number(row.critical_open||0)*7),`${row.critical_open} משימות קריטיות פתוחות`,'critical',row.risk_task_id);
  apply(Math.min(15,Number(row.gantt_late||0)*5),`${row.gantt_late} משימות בפיגור מול הגאנט`,'gantt',row.risk_task_id);
  apply(Math.min(15,Math.max(0,Number(row.hours_overrun_pct||0))/5),'חריגה מיעד השעות','hours');
  if(canViewFinance) apply(Math.min(20,Number(row.overdue_payments||0)*8),`${row.overdue_payments} תשלומים בפיגור`,'finance');
  apply(Math.min(15,Number(row.missing_equipment||0)*3),`${row.missing_equipment} פריטי ציוד טרם הותקנו`,'equipment');
  if(Number(row.contractor_progress||0)<Number(row.progress||0)-20) apply(10,'התקדמות הקבלן מפגרת אחרי הפרויקט','contractor');
  score=Math.max(0,Math.round(score));
  return {score,tone:score>=80?'green':score>=60?'yellow':'red',reasons:reasons.sort((a,b)=>b.points-a.points)};
}

  const HEALTH_SQL=`SELECT p.id,p.name,p.stage,p.manager,p.created_at,p.project_category,p.project_category_custom,p.progress,p.contractor_progress,
  COALESCE(task_stats.overdue_tasks,0)::int overdue_tasks,COALESCE(task_stats.critical_open,0)::int critical_open,COALESCE(task_stats.gantt_late,0)::int gantt_late,task_stats.risk_task_id,
  COALESCE(payment_stats.overdue_payments,0)::int overdue_payments,COALESCE(equipment_stats.missing_equipment,0)::int missing_equipment,
  CASE WHEN COALESCE(p.installation_hours_target,0)+COALESCE(p.programming_hours_target,0)>0 THEN
    GREATEST(0,(COALESCE(hours.actual,0)-(p.installation_hours_target+p.programming_hours_target))*100/(p.installation_hours_target+p.programming_hours_target)) ELSE 0 END hours_overrun_pct
  FROM projects p
  LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled') AND due_date<CURRENT_DATE) overdue_tasks,
    COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled') AND critical) critical_open,
    COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled') AND start_date<CURRENT_DATE AND due_date<CURRENT_DATE) gantt_late,
    (ARRAY_AGG(id ORDER BY critical DESC,due_date) FILTER (WHERE status NOT IN ('done','cancelled') AND (critical OR due_date<CURRENT_DATE)))[1] risk_task_id FROM tasks WHERE project_id=p.id) task_stats ON TRUE
  LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE status='pending' AND due_date<CURRENT_DATE) overdue_payments FROM project_payments WHERE project_id=p.id) payment_stats ON TRUE
  LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE COALESCE(quantity_installed,0)<COALESCE(quantity_ordered,quantity)) missing_equipment FROM project_equipment WHERE project_id=p.id) equipment_stats ON TRUE
  LEFT JOIN (SELECT project_id,SUM(hours) actual FROM project_time_entries WHERE activity_type IN ('installation','programming') GROUP BY project_id) hours ON hours.project_id=p.id
  WHERE p.archived_at IS NULL AND p.completed_at IS NULL`;

export async function loadProjectHealth(pool,canViewFinance=true){return (await pool.query(HEALTH_SQL)).rows.map((row)=>({...row,...calculateHealth(row,canViewFinance)}));}

export async function createProjectIntelligenceRouter({pool,authenticate,requireRoles,audit,dataDir}) {
  const router=express.Router();
  const voiceDir=path.join(dataDir,'uploads','voice');
  await mkdir(voiceDir,{recursive:true});
  const upload=multer({storage:multer.diskStorage({destination:voiceDir,filename:(_r,file,cb)=>cb(null,`${randomUUID()}${path.extname(file.originalname||'').slice(0,8)||'.webm'}`)}),limits:{fileSize:VOICE_LIMIT_BYTES,files:1},fileFilter:(_r,file,cb)=>{const valid=VOICE_MIMES.has(String(file.mimetype).split(';')[0]);cb(valid?null:new Error('סוג קובץ ההקלטה אינו נתמך'),valid);}});
  router.use(authenticate);

  router.get('/risk-center',async(request,response)=>{
    const projects=(await loadProjectHealth(pool,request.user.financeAccess!==false)).filter(item=>item.score<100).sort((a,b)=>a.score-b.score);
    response.json({projects});
  });

  router.get('/projects/:id/systems.xlsx',async(request,response)=>{
    const projectResult=await pool.query('SELECT id,name,client,address,stage,manager,updated_at FROM projects WHERE id=$1',[request.params.id]);
    if(!projectResult.rowCount)return response.status(404).json({error:'הפרויקט לא נמצא'});
    const project=projectResult.rows[0];
    const items=(await pool.query(`SELECT pe.*,c.name,c.code,COALESCE(NULLIF(pe.sku_override,''),c.priority_sku,c.code,'') sku,
      COALESCE(NULLIF(psb.title,''),s.name,'ללא מערכת') system_name,COALESCE(NULLIF(psb.color,''),s.color,'#6957df') system_color
      FROM project_equipment pe JOIN equipment_catalog c ON c.id=pe.catalog_item_id
      LEFT JOIN equipment_catalog s ON s.id=COALESCE(pe.project_system_id,c.parent_id)
      LEFT JOIN project_system_board psb ON psb.project_id=pe.project_id AND psb.system_id=s.id
      WHERE pe.project_id=$1 ORDER BY COALESCE(psb.sort_order,0),system_name,pe.board_order,c.name`,[request.params.id])).rows;
    const workbook=new ExcelJS.Workbook();workbook.creator='PROJECTS';workbook.created=new Date();
    const purple='6957DF',navy='202536',soft='F3F1FF',line='E4E7EE',green='238263',amber='B57620';
    const titleStyle={font:{name:'Arial',size:20,bold:true,color:{argb:'FFFFFFFF'}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:`FF${purple}`}},alignment:{horizontal:'right',vertical:'middle'}};
    const headerStyle={font:{name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}},fill:{type:'pattern',pattern:'solid',fgColor:{argb:`FF${navy}`}},alignment:{horizontal:'center',vertical:'middle'},border:{bottom:{style:'thin',color:{argb:`FF${line}`}}}};
    const summary=workbook.addWorksheet('סיכום מערכות',{views:[{rightToLeft:true,state:'frozen',ySplit:7}]});summary.columns=[{width:34},{width:18},{width:16},{width:16},{width:16},{width:18}];summary.mergeCells('A1:F2');summary.getCell('A1').value=`PROJECTS | סיכום מערכות — ${project.name}`;Object.assign(summary.getCell('A1'),titleStyle);summary.getRow(1).height=28;summary.getRow(2).height=16;
    summary.mergeCells('A3:F3');summary.getCell('A3').value=`לקוח: ${project.client||'—'}   |   כתובת: ${project.address||'—'}   |   שלב: ${project.stage||'—'}   |   מנהל: ${project.manager||'—'}`;summary.getCell('A3').alignment={horizontal:'right'};summary.getCell('A3').font={name:'Arial',size:11,color:{argb:`FF${navy}`}};
    summary.mergeCells('A4:F4');summary.getCell('A4').value=`הופק בתאריך ${new Intl.DateTimeFormat('he-IL',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Jerusalem'}).format(new Date())}`;summary.getCell('A4').font={name:'Arial',size:9,color:{argb:'FF7F8797'}};summary.getCell('A4').alignment={horizontal:'right'};
    summary.addRow([]);const summaryHeader=summary.addRow(['מערכת','מספר פריטים','הוזמן','הותקן','תוכנת','יתרה להתקנה']);summaryHeader.eachCell(cell=>Object.assign(cell,headerStyle));summaryHeader.height=24;
    const systems=new Map();for(const item of items){const key=item.system_name||'ללא מערכת';if(!systems.has(key))systems.set(key,{name:key,color:item.system_color||'#6957df',lines:0,ordered:0,installed:0,programmed:0});const row=systems.get(key);row.lines++;row.ordered+=Number(item.quantity_ordered??item.quantity??0);row.installed+=Number(item.quantity_installed||0);row.programmed+=Number(item.quantity_programmed||0)}
    for(const system of systems.values()){const row=summary.addRow([system.name,system.lines,system.ordered,system.installed,system.programmed,Math.max(0,system.ordered-system.installed)]);row.getCell(1).font={name:'Arial',bold:true,color:{argb:`FF${String(system.color).replace('#','').padStart(6,'0').slice(-6).toUpperCase()}`}};row.eachCell(cell=>{cell.alignment={horizontal:'center',vertical:'middle'};cell.border={bottom:{style:'hair',color:{argb:`FF${line}`}}}});row.getCell(1).alignment={horizontal:'right',vertical:'middle'}}
    const total=summary.addRow(['סה״כ',items.length,items.reduce((sum,item)=>sum+Number(item.quantity_ordered??item.quantity??0),0),items.reduce((sum,item)=>sum+Number(item.quantity_installed||0),0),items.reduce((sum,item)=>sum+Number(item.quantity_programmed||0),0),items.reduce((sum,item)=>sum+Math.max(0,Number(item.quantity_ordered??item.quantity??0)-Number(item.quantity_installed||0)),0)]);total.eachCell(cell=>{cell.font={name:'Arial',bold:true,color:{argb:`FF${navy}`}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:`FF${soft}`}};cell.alignment={horizontal:'center'}});total.getCell(1).alignment={horizontal:'right'};
    const details=workbook.addWorksheet('רשימת רכיבים',{views:[{rightToLeft:true,state:'frozen',ySplit:1}]});details.columns=[{header:'מערכת',key:'system',width:22},{header:'פריט',key:'name',width:40},{header:'מק״ט',key:'sku',width:18},{header:'מיקום',key:'location',width:22},{header:'תיוג',key:'tag',width:18},{header:'כמות',key:'quantity',width:12},{header:'הותקן',key:'installed',width:12},{header:'תוכנת',key:'programmed',width:12},{header:'יתרה',key:'remaining',width:12},{header:'סטטוס',key:'status',width:16},{header:'הערות',key:'notes',width:34}];details.getRow(1).eachCell(cell=>Object.assign(cell,headerStyle));details.autoFilter={from:'A1',to:'K1'};
    const statusLabels={waiting:'ממתין',planned:'ממתין',in_progress:'בביצוע',installed:'הותקן'};for(const item of items){const quantity=Number(item.quantity_ordered??item.quantity??0),installed=Number(item.quantity_installed||0);const row=details.addRow({system:item.system_name,name:item.name,sku:item.sku,location:item.location,tag:item.tag,quantity,installed,programmed:Number(item.quantity_programmed||0),remaining:Math.max(0,quantity-installed),status:statusLabels[item.status]||item.status||'ממתין',notes:item.notes||''});row.eachCell(cell=>{cell.alignment={horizontal:'right',vertical:'top',wrapText:true};cell.border={bottom:{style:'hair',color:{argb:`FF${line}`}}}});row.getCell(7).font={color:{argb:`FF${green}`},bold:true};row.getCell(9).font={color:{argb:`FF${amber}`},bold:true}}
    const buffer=await workbook.xlsx.writeBuffer();await audit(request,'export','project_systems',request.params.id,{projectId:request.params.id,format:'xlsx',rows:items.length});response.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');response.setHeader('Content-Disposition',`attachment; filename="PROJECTS-${String(project.id).replace(/[^a-zA-Z0-9_-]/g,'_')}-systems.xlsx"`);response.send(Buffer.from(buffer));
  });

  router.get('/projects/:id/bom',async(request,response)=>{
    const result=await pool.query(`SELECT pe.id,pe.project_id,pe.project_system_id,s.name system_name,s.color system_color,s.icon system_icon,
      pe.catalog_item_id,c.name,c.code,c.priority_sku,c.unit,
      COALESCE(pe.quantity_ordered,pe.quantity,0)::numeric ordered,COALESCE(pe.quantity_installed,0)::numeric installed,
      COALESCE(pe.quantity_programmed,0)::numeric programmed,
      GREATEST(0,COALESCE(pe.quantity_ordered,pe.quantity,0)-COALESCE(pe.quantity_installed,0))::numeric remaining
      FROM project_equipment pe JOIN equipment_catalog c ON c.id=pe.catalog_item_id LEFT JOIN equipment_catalog s ON s.id=pe.project_system_id
      WHERE pe.project_id=$1 ORDER BY s.name,c.name`,[request.params.id]);
    response.json({items:result.rows.map(row=>({...row,ordered:Number(row.ordered),installed:Number(row.installed),programmed:Number(row.programmed),remaining:Number(row.remaining)}))});
  });
  router.patch('/projects/:id/bom/:itemId',requireRoles('admin','manager','technician'),async(request,response)=>{
    const current=await pool.query('SELECT * FROM project_equipment WHERE id=$1 AND project_id=$2',[request.params.itemId,request.params.id]);
    if(!current.rowCount)return response.status(404).json({error:'פריט BOM לא נמצא'});
    const ordered=Number(current.rows[0].quantity_ordered??current.rows[0].quantity??0);
    const installed=Math.max(0,Math.min(ordered,Number(request.body.installed??current.rows[0].quantity_installed)));
    const programmed=Math.max(0,Math.min(installed,Number(request.body.programmed??current.rows[0].quantity_programmed)));
    const result=await pool.query('UPDATE project_equipment SET quantity_installed=$1,quantity_programmed=$2,status=CASE WHEN $1>=COALESCE(quantity_ordered,quantity) THEN \'installed\' ELSE status END,updated_at=NOW() WHERE id=$3 RETURNING *',[installed,programmed,request.params.itemId]);
    await audit(request,'update','project_bom',request.params.itemId,{projectId:request.params.id,installed,programmed});
    await pool.query("SELECT pg_notify('projects_live_change',$1)",[JSON.stringify({table:'project_equipment',projectId:request.params.id,id:request.params.itemId})]);
    response.json({item:result.rows[0]});
  });

  router.get('/voice-notes',async(request,response)=>{
    const all=request.query.all==='1';const projectId=String(request.query.projectId||'');const entityType=String(request.query.entityType||'');const entityId=String(request.query.entityId||'');
    if(all&&request.user.permissions?.forms==='none')return response.status(403).json({error:'אין הרשאה לצפייה במסמכים ובהקלטות'});
    const result=all
      ? await pool.query(`SELECT v.*,COALESCE(u.display_name,u.username,'מערכת') recorded_by_name,p.name project_name FROM voice_notes v LEFT JOIN users u ON u.id=v.recorded_by LEFT JOIN projects p ON p.id=v.project_id WHERE v.deleted_at IS NULL ORDER BY v.created_at DESC LIMIT 500`)
      : projectId
      ? await pool.query(`SELECT v.*,COALESCE(u.display_name,u.username,'מערכת') recorded_by_name FROM voice_notes v LEFT JOIN users u ON u.id=v.recorded_by WHERE v.project_id=$1 AND v.deleted_at IS NULL ORDER BY v.created_at DESC`,[projectId])
      : await pool.query(`SELECT v.*,COALESCE(u.display_name,u.username,'מערכת') recorded_by_name FROM voice_notes v LEFT JOIN users u ON u.id=v.recorded_by WHERE v.entity_type=$1 AND v.entity_id=$2 AND v.deleted_at IS NULL ORDER BY v.created_at DESC`,[entityType,entityId]);
    response.json({notes:result.rows});
  });
  router.post('/voice-notes',upload.single('audio'),async(request,response)=>{
    const duration=Number(request.body.durationSeconds);if(!request.file||!duration||duration>60.5)return response.status(400).json({error:'הקלטה תקינה עד 60 שניות נדרשת'});
    const entityType=String(request.body.entityType||'').slice(0,80);const entityId=String(request.body.entityId||'').slice(0,120);if(!entityType||!entityId)return response.status(400).json({error:'חסר שיוך להקלטה'});
    const result=await pool.query(`INSERT INTO voice_notes(entity_type,entity_id,project_id,original_name,stored_name,mime_type,size_bytes,duration_seconds,transcript,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[entityType,entityId,request.body.projectId||null,request.file.originalname,request.file.filename,request.file.mimetype,request.file.size,duration,String(request.body.transcript||'').slice(0,12000),request.user.id]);
    await audit(request,'record','voice_note',String(result.rows[0].id),{entityType,entityId,projectId:request.body.projectId||null,duration});await pool.query("SELECT pg_notify('projects_live_change',$1)",[JSON.stringify({table:'voice_notes',entityType,entityId,projectId:request.body.projectId||null})]);response.status(201).json({note:result.rows[0]});
  });
  router.get('/voice-notes/:id/audio',async(request,response)=>{const result=await pool.query('SELECT * FROM voice_notes WHERE id=$1 AND deleted_at IS NULL',[request.params.id]);if(!result.rowCount)return response.sendStatus(404);response.type(result.rows[0].mime_type).sendFile(path.join(voiceDir,result.rows[0].stored_name));});
  router.patch('/preferences/voice-rate',async(request,response)=>{const rate=[.5,1,1.25,1.5,1.75,2].includes(Number(request.body.rate))?Number(request.body.rate):1;await pool.query('UPDATE users SET voice_playback_rate=$1 WHERE id=$2',[rate,request.user.id]);response.json({rate});});
  router.patch('/voice-notes/:id/text',async(request,response)=>{const result=await pool.query('UPDATE voice_notes SET transcript=COALESCE($1,transcript),ai_summary=COALESCE($2,ai_summary) WHERE id=$3 AND deleted_at IS NULL RETURNING *',[request.body.transcript===undefined?null:String(request.body.transcript).slice(0,12000),request.body.aiSummary===undefined?null:String(request.body.aiSummary).slice(0,12000),request.params.id]);if(!result.rowCount)return response.sendStatus(404);await audit(request,'update_text','voice_note',request.params.id);await pool.query("SELECT pg_notify('projects_live_change',$1)",[JSON.stringify({table:'voice_notes',id:request.params.id})]);response.json({note:result.rows[0]});});
  router.delete('/voice-notes/:id',async(request,response)=>{const result=await pool.query('SELECT * FROM voice_notes WHERE id=$1 AND deleted_at IS NULL',[request.params.id]);if(!result.rowCount)return response.sendStatus(404);if(request.user.role!=='admin'&&String(result.rows[0].recorded_by)!==String(request.user.id))return response.sendStatus(403);await pool.query('UPDATE voice_notes SET deleted_at=NOW(),deleted_by=$1 WHERE id=$2',[request.user.id,request.params.id]);await audit(request,'delete','voice_note',request.params.id);await pool.query("SELECT pg_notify('projects_live_change',$1)",[JSON.stringify({table:'voice_notes',id:request.params.id})]);response.sendStatus(204);});
  return router;
}
