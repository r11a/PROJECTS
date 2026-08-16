import express from 'express';
import { executeAutomations } from './productivity.js';

const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'];
const MILESTONE_STATUSES = ['planned', 'in_progress', 'completed', 'delayed'];
const PAYMENT_STATUSES = ['pending', 'paid', 'cancelled'];

async function syncProjectMetrics(pool, projectId) {
  if (!projectId) return;
  await pool.query(`UPDATE projects p SET
    paid=COALESCE((SELECT SUM(amount) FROM project_payments WHERE project_id=p.id AND status='paid' AND entry_type<>'credit'),0),
    tasks_total=(SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status<>'cancelled'),
    tasks_done=(SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status='done'),
    updated_at=NOW() WHERE p.id=$1`, [projectId]);
}

async function mayEditProject(pool, request, projectId) {
  if (request.user.role === 'admin') return true;
  if (request.user.permissions?.projects === 'write') return true;
  if (!projectId) return false;
  if (!['manager', 'technician', 'supervisor'].includes(request.user.role)) return false;
  return true;
}

async function moveToRecycleBin(pool, request, entityType, row, displayName, projectId) {
  await pool.query(`INSERT INTO recycle_bin(entity_type,entity_id,display_name,project_id,payload,deleted_by)
    VALUES($1,$2,$3,$4,$5,$6)`, [entityType, String(row.id), displayName || '', projectId || null, JSON.stringify(row), request.user.id]);
}

export function createOperationsRouter({ pool, authenticate, requireRoles, audit }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/operations/tasks/count', async (_request, response) => {
    const result = await pool.query("SELECT COUNT(*)::int count FROM tasks WHERE status NOT IN ('done','cancelled')");
    response.json({ count: result.rows[0]?.count || 0 });
  });

  router.get('/operations/recycle-bin', requireRoles('admin'), async (_request, response) => {
    await pool.query('DELETE FROM recycle_bin WHERE restored_at IS NULL AND purge_at<=NOW()');
    const result = await pool.query(`SELECT r.id,r.entity_type,r.entity_id,r.display_name,r.project_id,r.deleted_at,r.purge_at,
      u.display_name deleted_by_name,p.name project_name
      FROM recycle_bin r LEFT JOIN users u ON u.id=r.deleted_by LEFT JOIN projects p ON p.id=r.project_id
      WHERE r.restored_at IS NULL ORDER BY r.deleted_at DESC`);
    response.json({ items: result.rows });
  });

  router.post('/operations/recycle-bin/:id/restore', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('SELECT * FROM recycle_bin WHERE id=$1 AND restored_at IS NULL', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'הפריט אינו נמצא בסל המחזור' });
    const entry = result.rows[0];
    const row = entry.payload || {};
    if (entry.entity_type === 'task') {
      await pool.query(`INSERT INTO tasks(id,client_id,project_id,title,description,status,priority,assignee_id,assignee_professional_id,owner_professional_id,start_date,due_date,start_time,end_time,all_day,duration_hours,estimated_hours,task_type,dependency_task_id,parent_task_id,critical,color,created_by,created_at,updated_at,completed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        ON CONFLICT(id) DO NOTHING`, [row.id,row.client_id,row.project_id,row.title,row.description,row.status,row.priority,row.assignee_id,row.assignee_professional_id,row.owner_professional_id,row.start_date,row.due_date,row.start_time,row.end_time,row.all_day,row.duration_hours,row.estimated_hours,row.task_type,row.dependency_task_id,row.parent_task_id,row.critical,row.color,row.created_by,row.created_at,row.updated_at,row.completed_at]);
      await syncProjectMetrics(pool, row.project_id);
    } else if (entry.entity_type === 'milestone') {
      await pool.query(`INSERT INTO project_milestones(id,project_id,title,due_date,status,progress,owner_professional_id,description,color,created_by,created_at,updated_at,completed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO NOTHING`, [row.id,row.project_id,row.title,row.due_date,row.status,row.progress,row.owner_professional_id,row.description,row.color,row.created_by,row.created_at,row.updated_at,row.completed_at]);
    } else if (entry.entity_type === 'payment') {
      await pool.query(`INSERT INTO project_payments(id,project_id,title,amount,due_date,status,paid_at,reference,notes,entry_type,created_by,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO NOTHING`, [row.id,row.project_id,row.title,row.amount,row.due_date,row.status,row.paid_at,row.reference,row.notes,row.entry_type,row.created_by,row.created_at,row.updated_at]);
      await syncProjectMetrics(pool, row.project_id);
    } else return response.status(400).json({ error: 'שחזור סוג פריט זה עדיין אינו נתמך' });
    await pool.query('UPDATE recycle_bin SET restored_at=NOW(),restored_by=$1 WHERE id=$2', [request.user.id, request.params.id]);
    await audit(request, 'restore', entry.entity_type, String(entry.entity_id), { recycleBinId: entry.id, projectId: entry.project_id });
    response.status(204).end();
  });

  router.delete('/operations/recycle-bin/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM recycle_bin WHERE id=$1 RETURNING entity_type,entity_id,project_id', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'הפריט אינו נמצא בסל המחזור' });
    await audit(request, 'purge', result.rows[0].entity_type, String(result.rows[0].entity_id), { recycleBinId: request.params.id, projectId: result.rows[0].project_id });
    response.status(204).end();
  });

  router.get('/operations/tasks', async (request, response) => {
    const q = String(request.query.q || '').trim();
    const status = String(request.query.status || '');
    const projectId = String(request.query.projectId || '');
    const result = await pool.query(`SELECT t.*,p.name project_name,c.name client_name,dependency.title dependency_title,
      COALESCE(pr.display_name,u.display_name) assignee_name,pr.color assignee_color,
      owner.display_name owner_name,owner.color owner_color,
      p.manager_professional_id project_manager_id,manager.display_name project_manager_name,
      parent.title parent_task_title,
      (SELECT COUNT(*)::int FROM tasks child WHERE child.parent_task_id=t.id) subtask_count,
      (SELECT COUNT(*)::int FROM tasks child WHERE child.parent_task_id=t.id AND child.status='done') completed_subtask_count
      FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN clients c ON c.id=t.client_id
      LEFT JOIN professionals pr ON pr.id=t.assignee_professional_id LEFT JOIN users u ON u.id=t.assignee_id LEFT JOIN tasks dependency ON dependency.id=t.dependency_task_id
      LEFT JOIN professionals owner ON owner.id=t.owner_professional_id LEFT JOIN tasks parent ON parent.id=t.parent_task_id
      LEFT JOIN professionals manager ON manager.id=p.manager_professional_id
      WHERE ($1='' OR concat_ws(' ',t.title,t.description,p.name,c.name,pr.display_name,u.display_name) ILIKE $2)
        AND ($3='' OR t.status=$3) AND ($4='' OR t.project_id=$4)
      ORDER BY (t.status IN ('done','cancelled')),t.due_date NULLS LAST,t.priority DESC,t.created_at DESC`, [q, `%${q}%`, status, projectId]);
    response.json({ tasks: result.rows });
  });

  router.post('/operations/tasks', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const title = String(request.body.title || '').trim();
    if (!title || !request.body.dueDate || (!request.body.projectId && !request.body.clientId)) return response.status(400).json({ error: 'כותרת, תאריך סיום ופרויקט או לקוח הם שדות חובה' });
    if (request.body.startDate && request.body.startDate > request.body.dueDate) return response.status(400).json({ error: 'תאריך ההתחלה אינו יכול להיות אחרי תאריך היעד' });
    if (request.body.dependencyTaskId) { const dependency=await pool.query("SELECT project_id,status FROM tasks WHERE id=$1",[request.body.dependencyTaskId]); if(!dependency.rowCount||dependency.rows[0].project_id!==request.body.projectId||!['open','in_progress'].includes(dependency.rows[0].status))return response.status(400).json({error:'משימת התלות חייבת להיות פתוחה או בביצוע ובאותו פרויקט'}); }
    if (request.body.parentTaskId) { const parent=await pool.query('SELECT project_id FROM tasks WHERE id=$1',[request.body.parentTaskId]); if(!parent.rowCount||String(parent.rows[0].project_id)!==String(request.body.projectId))return response.status(400).json({error:'משימת האב חייבת להיות באותו פרויקט'}); }
    if (!(await mayEditProject(pool, request, request.body.projectId))) return response.status(403).json({error:'רק מנהל הפרויקט המשויך רשאי ליצור או לערוך משימות בפרויקט'});
    const durationHours=Math.max(0,Number(request.body.durationHours ?? request.body.estimatedHours)||0);
    const allDay=Boolean(request.body.allDay);
    const result = await pool.query(`INSERT INTO tasks(client_id,project_id,title,description,status,priority,assignee_professional_id,owner_professional_id,start_date,due_date,start_time,end_time,all_day,duration_hours,estimated_hours,task_type,dependency_task_id,parent_task_id,critical,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,$16,$17,$18,$19) RETURNING *`, [request.body.clientId || null, request.body.projectId || null, title, request.body.description || '', TASK_STATUSES.includes(request.body.status) ? request.body.status : 'open', request.body.priority || 'normal', request.body.assigneeProfessionalId || null,request.body.ownerProfessionalId || null, request.body.startDate || request.body.dueDate, request.body.dueDate, allDay?null:(request.body.startTime || null), allDay?null:(request.body.endTime || null), allDay, durationHours, request.body.taskType || 'task', request.body.dependencyTaskId || null,request.body.parentTaskId || null,Boolean(request.body.critical), request.user.id]);
    await syncProjectMetrics(pool, request.body.projectId);
    await audit(request, 'create', 'task', String(result.rows[0].id), { title, projectId: request.body.projectId });
    await executeAutomations({ pool,triggerType:'task_created',entityType:'task',entityId:result.rows[0].id,context:{ projectId:request.body.projectId,status:result.rows[0].status,title },userId:request.user.id });
    response.status(201).json({ task: result.rows[0] });
  });

  router.patch('/operations/tasks/:id', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const current = await pool.query('SELECT * FROM tasks WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'המשימה לא נמצאה' });
    const row = current.rows[0];
    if (!(await mayEditProject(pool, request, row.project_id))) return response.status(403).json({error:'רק מנהל הפרויקט המשויך רשאי לערוך משימות בפרויקט'});
    const status = TASK_STATUSES.includes(request.body.status) ? request.body.status : row.status;
    const dependencyId=Object.prototype.hasOwnProperty.call(request.body,'dependencyTaskId')?(request.body.dependencyTaskId||null):row.dependency_task_id;
    const nextStart = request.body.startDate ?? row.start_date; const nextDue = request.body.dueDate ?? row.due_date;
    if(String(request.body.dependencyTaskId||'')===String(request.params.id))return response.status(400).json({error:'משימה אינה יכולה להיות תלויה בעצמה'});
    if(dependencyId){const dependency=await pool.query("SELECT project_id,status FROM tasks WHERE id=$1",[dependencyId]);if(!dependency.rowCount||dependency.rows[0].project_id!==row.project_id||!['open','in_progress'].includes(dependency.rows[0].status))return response.status(400).json({error:'משימת התלות חייבת להיות פתוחה או בביצוע ובאותו פרויקט'});}
    const parentTaskId=Object.prototype.hasOwnProperty.call(request.body,'parentTaskId')?(request.body.parentTaskId||null):row.parent_task_id;
    if(String(parentTaskId||'')===String(request.params.id))return response.status(400).json({error:'משימה אינה יכולה להיות תת־משימה של עצמה'});
    if(parentTaskId){const parent=await pool.query('SELECT project_id,parent_task_id FROM tasks WHERE id=$1',[parentTaskId]);if(!parent.rowCount||String(parent.rows[0].project_id)!==String(row.project_id)||String(parent.rows[0].parent_task_id||'')===String(request.params.id))return response.status(400).json({error:'שיוך משימת האב אינו תקין או יוצר מעגל'});}
    if (nextStart && nextDue && String(nextStart).slice(0,10) > String(nextDue).slice(0,10)) return response.status(400).json({ error: 'תאריך ההתחלה אינו יכול להיות אחרי תאריך היעד' });
    const durationHours=Math.max(0,Number(request.body.durationHours ?? request.body.estimatedHours ?? row.duration_hours ?? row.estimated_hours)||0);
    const allDay=request.body.allDay ?? row.all_day;
    const result = await pool.query(`UPDATE tasks SET title=$1,description=$2,status=$3,priority=$4,assignee_professional_id=$5,owner_professional_id=$6,start_date=$7,due_date=$8,start_time=$9,end_time=$10,all_day=$11,duration_hours=$12,estimated_hours=$12,task_type=$13,dependency_task_id=$14,parent_task_id=$15,critical=$16,color=$17,
      completed_at=CASE WHEN $3='done' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$18 RETURNING *`, [request.body.title ?? row.title, request.body.description ?? row.description, status, request.body.priority ?? row.priority, request.body.assigneeProfessionalId ?? row.assignee_professional_id,request.body.ownerProfessionalId ?? row.owner_professional_id, request.body.startDate ?? row.start_date, request.body.dueDate ?? row.due_date, allDay?null:(request.body.startTime ?? row.start_time), allDay?null:(request.body.endTime ?? row.end_time), allDay, durationHours, request.body.taskType ?? row.task_type, dependencyId,parentTaskId,request.body.critical ?? row.critical, request.body.color ?? row.color, request.params.id]);
    await syncProjectMetrics(pool, row.project_id);
    await audit(request, 'update', 'task', request.params.id, request.body);
    if(status!==row.status) await executeAutomations({ pool,triggerType:'task_status_changed',entityType:'task',entityId:request.params.id,context:{ projectId:row.project_id,status,fromStatus:row.status,title:result.rows[0].title },userId:request.user.id });
    response.json({ task: result.rows[0] });
  });

  router.delete('/operations/tasks/:id', requireRoles('admin'), async (request, response) => {
    const current=await pool.query('SELECT * FROM tasks WHERE id=$1',[request.params.id]);
    if(!current.rowCount)return response.status(404).json({error:'המשימה לא נמצאה'});
    await moveToRecycleBin(pool,request,'task',current.rows[0],current.rows[0].title,current.rows[0].project_id);
    const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING project_id,title', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'המשימה לא נמצאה' });
    await syncProjectMetrics(pool, result.rows[0].project_id);
    await audit(request, 'delete', 'task', request.params.id, { title: result.rows[0].title });
    response.status(204).end();
  });

  router.get('/operations/milestones', async (request, response) => {
    const projectId = String(request.query.projectId || '');
    const result = await pool.query(`SELECT m.*,p.name project_name,pr.display_name owner_name,pr.color owner_color FROM project_milestones m
      JOIN projects p ON p.id=m.project_id LEFT JOIN professionals pr ON pr.id=m.owner_professional_id
      WHERE ($1='' OR m.project_id=$1) ORDER BY (m.status='completed'),m.due_date NULLS LAST,m.created_at`, [projectId]);
    response.json({ milestones: result.rows });
  });

  router.post('/operations/milestones', requireRoles('admin', 'manager'), async (request, response) => {
    const title = String(request.body.title || '').trim();
    if (!title || !request.body.projectId || !request.body.dueDate) return response.status(400).json({ error: 'שם אבן הדרך, הפרויקט ותאריך היעד הם שדות חובה' });
    const result = await pool.query(`INSERT INTO project_milestones(project_id,title,due_date,status,progress,owner_professional_id,description,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [request.body.projectId, title, request.body.dueDate || null, MILESTONE_STATUSES.includes(request.body.status) ? request.body.status : 'planned', Number(request.body.progress) || 0, request.body.ownerProfessionalId || null, request.body.description || '', request.user.id]);
    await audit(request, 'create', 'milestone', String(result.rows[0].id), { title, projectId: request.body.projectId });
    response.status(201).json({ milestone: result.rows[0] });
  });

  router.patch('/operations/milestones/:id', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const current = await pool.query('SELECT * FROM project_milestones WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'אבן הדרך לא נמצאה' });
    const row = current.rows[0]; const status = MILESTONE_STATUSES.includes(request.body.status) ? request.body.status : row.status;
    const result = await pool.query(`UPDATE project_milestones SET title=$1,due_date=$2,status=$3,progress=$4,owner_professional_id=$5,description=$6,color=$7,
      completed_at=CASE WHEN $3='completed' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$8 RETURNING *`, [request.body.title ?? row.title, request.body.dueDate ?? row.due_date, status, Number(request.body.progress ?? row.progress), request.body.ownerProfessionalId ?? row.owner_professional_id, request.body.description ?? row.description, request.body.color ?? row.color, request.params.id]);
    await audit(request, 'update', 'milestone', request.params.id, request.body); response.json({ milestone: result.rows[0] });
  });

  router.delete('/operations/milestones/:id', requireRoles('admin'), async (request, response) => {
    const current=await pool.query('SELECT * FROM project_milestones WHERE id=$1',[request.params.id]);
    if(!current.rowCount)return response.status(404).json({error:'אבן הדרך לא נמצאה'});
    await moveToRecycleBin(pool,request,'milestone',current.rows[0],current.rows[0].title,current.rows[0].project_id);
    const result = await pool.query('DELETE FROM project_milestones WHERE id=$1 RETURNING title', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'אבן הדרך לא נמצאה' });
    await audit(request, 'delete', 'milestone', request.params.id, { title: result.rows[0].title }); response.status(204).end();
  });

  router.get('/operations/payments', async (request, response) => {
    const projectId = String(request.query.projectId || '');
    const result = await pool.query(`SELECT pay.*,p.name project_name,p.client,p.value project_value,u.display_name created_by_name FROM project_payments pay JOIN projects p ON p.id=pay.project_id LEFT JOIN users u ON u.id=pay.created_by WHERE ($1='' OR pay.project_id=$1) ORDER BY (pay.status='paid'),pay.due_date NULLS LAST,pay.created_at DESC`, [projectId]);
    response.json({ payments: result.rows });
  });

  router.get('/operations/finance-summary', async (request,response) => {
    const projectId=String(request.query.projectId||'');
    const result=await pool.query(`SELECT p.id,p.name,p.value,
      COALESCE(SUM(pay.amount) FILTER (WHERE pay.entry_type='addition' AND pay.status<>'cancelled'),0) additions,
      COALESCE(SUM(pay.amount) FILTER (WHERE pay.entry_type='credit' AND pay.status<>'cancelled'),0) credits,
      COALESCE(SUM(pay.amount) FILTER (WHERE pay.entry_type<>'credit' AND pay.status='paid'),0) paid,
      COALESCE(SUM(pay.amount) FILTER (WHERE pay.entry_type<>'credit' AND pay.status='pending'),0) pending,
      MAX(pay.paid_at) FILTER (WHERE pay.status='paid') last_paid_at
      FROM projects p LEFT JOIN project_payments pay ON pay.project_id=p.id
      WHERE ($1='' OR p.id=$1) GROUP BY p.id,p.name,p.value ORDER BY p.name`,[projectId]);
    const projects=result.rows.map(row=>{const total=Number(row.value)+Number(row.additions)-Number(row.credits);const paid=Number(row.paid);return {...row,value:Number(row.value),additions:Number(row.additions),credits:Number(row.credits),total,paid,pending:Number(row.pending),balance:Math.max(0,total-paid)};});
    response.json({projects});
  });

  router.post('/operations/payments', requireRoles('admin', 'manager', 'finance'), async (request, response) => {
    const title = String(request.body.title || '').trim(); const amount = Number(request.body.amount);
    if (!request.body.projectId || !title || !(amount >= 0)) return response.status(400).json({ error: 'פרויקט, תיאור וסכום תקין הם שדות חובה' });
    const status = PAYMENT_STATUSES.includes(request.body.status) ? request.body.status : 'pending';
    const entryType=['invoice','addition','credit'].includes(request.body.entryType)?request.body.entryType:'invoice';
    const result = await pool.query(`INSERT INTO project_payments(project_id,title,amount,due_date,status,paid_at,reference,notes,entry_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [request.body.projectId, title, amount, request.body.dueDate || null, status, status === 'paid' ? (request.body.paidAt || new Date()) : null, request.body.reference || '', request.body.notes || '', entryType, request.user.id]);
    await syncProjectMetrics(pool, request.body.projectId); await audit(request, 'create', 'payment', String(result.rows[0].id), { title, amount }); response.status(201).json({ payment: result.rows[0] });
  });

  router.patch('/operations/payments/:id', requireRoles('admin', 'manager', 'finance'), async (request, response) => {
    const current = await pool.query('SELECT * FROM project_payments WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'התשלום לא נמצא' });
    const row = current.rows[0]; const status = PAYMENT_STATUSES.includes(request.body.status) ? request.body.status : row.status;
    const entryType=['invoice','addition','credit'].includes(request.body.entryType)?request.body.entryType:row.entry_type;
    const result = await pool.query(`UPDATE project_payments SET title=$1,amount=$2,due_date=$3,status=$4,paid_at=$5,reference=$6,notes=$7,entry_type=$8,updated_at=NOW() WHERE id=$9 RETURNING *`, [request.body.title ?? row.title, request.body.amount ?? row.amount, request.body.dueDate ?? row.due_date, status, status === 'paid' ? (request.body.paidAt || row.paid_at || new Date()) : null, request.body.reference ?? row.reference, request.body.notes ?? row.notes, entryType, request.params.id]);
    await syncProjectMetrics(pool, row.project_id); await audit(request, 'update', 'payment', request.params.id, request.body); response.json({ payment: result.rows[0] });
  });

  router.delete('/operations/payments/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('SELECT * FROM project_payments WHERE id=$1', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'התשלום לא נמצא' });
    const row = result.rows[0];
    await moveToRecycleBin(pool, request, 'payment', row, row.title, row.project_id);
    await pool.query('DELETE FROM project_payments WHERE id=$1', [request.params.id]);
    await syncProjectMetrics(pool, row.project_id); await audit(request, 'delete', 'payment', request.params.id, { title: row.title, recycleDays: 30 }); response.status(204).end();
  });

  router.get('/projects/:id/workspace', async (request, response) => {
    const id = request.params.id;
    const [tasks, milestones, payments, team, equipment, forms, files, updates, activity,reviews,meetings,timeEntries] = await Promise.all([
      pool.query(`SELECT t.*,pr.display_name assignee_name,pr.color assignee_color,dependency.title dependency_title FROM tasks t LEFT JOIN professionals pr ON pr.id=t.assignee_professional_id LEFT JOIN tasks dependency ON dependency.id=t.dependency_task_id WHERE t.project_id=$1 ORDER BY (t.status='done'),t.due_date`, [id]),
      pool.query(`SELECT m.*,pr.display_name owner_name FROM project_milestones m LEFT JOIN professionals pr ON pr.id=m.owner_professional_id WHERE m.project_id=$1 ORDER BY (m.status='completed'),m.due_date`, [id]),
      pool.query('SELECT * FROM project_payments WHERE project_id=$1 ORDER BY due_date NULLS LAST,created_at DESC', [id]),
      pool.query(`SELECT pp.*,p.display_name,p.phone,p.email,p.color,p.icon,r.name role_name,r.role_key FROM project_professionals pp JOIN professionals p ON p.id=pp.professional_id JOIN professional_role_types r ON r.id=pp.role_type_id WHERE pp.project_id=$1 ORDER BY pp.is_primary DESC,r.sort_order,p.display_name`, [id]),
      pool.query(`SELECT pe.*,e.name,e.item_type,e.manufacturer,e.model,e.unit,e.color,e.icon FROM project_equipment pe JOIN equipment_catalog e ON e.id=pe.catalog_item_id WHERE pe.project_id=$1 ORDER BY e.item_type,e.name`, [id]),
      pool.query(`SELECT fr.*,ft.name template_name FROM form_records fr JOIN form_templates ft ON ft.id=fr.template_id WHERE fr.project_id=$1 ORDER BY fr.updated_at DESC`, [id]),
      pool.query(`SELECT f.*,COALESCE(u.display_name,u.username,'מערכת') uploaded_by_name FROM client_files f LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.project_id=$1 AND f.deleted_at IS NULL ORDER BY f.created_at DESC`, [id]),
      pool.query('SELECT pu.*,u.display_name created_by_name,u.avatar_color FROM project_updates pu LEFT JOIN users u ON u.id=pu.created_by WHERE pu.project_id=$1 ORDER BY pu.created_at DESC', [id]),
      pool.query(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE (a.entity_type='project' AND a.entity_id=$1) OR (a.details->>'projectId'=$1) ORDER BY a.created_at DESC LIMIT 100`, [id]),
      pool.query(`SELECT r.*,p.display_name performed_by_name,u.display_name created_by_name FROM project_site_reviews r LEFT JOIN professionals p ON p.id=r.performed_by LEFT JOIN users u ON u.id=r.created_by WHERE r.project_id=$1 ORDER BY r.review_date DESC,r.created_at DESC`,[id]),
      pool.query(`SELECT m.*,u.display_name created_by_name FROM project_meeting_summaries m LEFT JOIN users u ON u.id=m.created_by WHERE m.project_id=$1 ORDER BY m.meeting_at DESC`,[id]),
      pool.query(`SELECT e.*,p.display_name professional_name,u.display_name user_name FROM project_time_entries e LEFT JOIN professionals p ON p.id=e.professional_id LEFT JOIN users u ON u.id=e.user_id WHERE e.project_id=$1 ORDER BY e.work_date DESC,e.created_at DESC`,[id]),
    ]);
    response.json({ tasks: tasks.rows, milestones: milestones.rows, payments: request.user.financeAccess === false ? [] : payments.rows, team: team.rows, equipment: equipment.rows, forms: forms.rows, files: files.rows, updates: updates.rows, activity: activity.rows,reviews:reviews.rows,meetings:meetings.rows,timeEntries:timeEntries.rows });
  });

  router.post('/projects/:id/time-entries',requireRoles('admin','manager','technician'),async(request,response)=>{
    const allowed=['planning','supervision','technician','installation','threading','programming','training'];
    const hours=Number(request.body.hours);
    if(!allowed.includes(request.body.activityType)||!request.body.workDate||!hours||hours<=0||hours>24)return response.status(400).json({error:'יש לבחור סוג פעילות, תאריך ומספר שעות תקין'});
    const result=await pool.query(`INSERT INTO project_time_entries(project_id,professional_id,user_id,activity_type,work_date,hours,source_type,source_id,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[request.params.id,request.body.professionalId||null,request.user.id,request.body.activityType,request.body.workDate,hours,request.body.sourceType||'manual',request.body.sourceId||null,request.body.notes||'']);
    await audit(request,'create','time_entry',String(result.rows[0].id),{projectId:request.params.id,hours,activityType:request.body.activityType});response.status(201).json({entry:result.rows[0]});
  });
  router.patch('/projects/:id/time-targets',requireRoles('admin','manager'),async(request,response)=>{
    const installation=Math.max(0,Number(request.body.installationHoursTarget)||0);const programming=Math.max(0,Number(request.body.programmingHoursTarget)||0);
    const result=await pool.query('UPDATE projects SET installation_hours_target=$1,programming_hours_target=$2,updated_at=NOW() WHERE id=$3 RETURNING installation_hours_target,programming_hours_target',[installation,programming,request.params.id]);
    if(!result.rowCount)return response.status(404).json({error:'הפרויקט לא נמצא'});await audit(request,'update','time_targets',request.params.id,{installation,programming});response.json({targets:result.rows[0]});
  });

  router.post('/projects/:id/site-reviews',requireRoles('admin','manager','technician'),async(request,response)=>{
    const summary=String(request.body.summary||'').trim();if(!request.body.reviewDate||!summary)return response.status(400).json({error:'תאריך פיקוח וסיכום הם שדות חובה'});
    const hours=Math.max(0,Number(request.body.hours)||0);if(hours>24)return response.status(400).json({error:'לא ניתן לדווח יותר מ־24 שעות ביום'});
    const result=await pool.query(`INSERT INTO project_site_reviews(project_id,review_date,performed_by,supervision_type,summary,follow_up,plan_update_required,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[request.params.id,request.body.reviewDate,request.body.performedBy||null,request.body.supervisionType||'',summary,request.body.followUp||'',Boolean(request.body.planUpdateRequired),request.user.id]);
    if(hours)await pool.query(`INSERT INTO project_time_entries(project_id,professional_id,user_id,activity_type,work_date,hours,source_type,source_id,notes) VALUES($1,$2,$3,'supervision',$4,$5,'site_review',$6,$7)`,[request.params.id,request.body.performedBy||null,request.user.id,request.body.reviewDate,hours,String(result.rows[0].id),request.body.supervisionType||'ביקורת אתר']);
    await audit(request,'create','site_review',String(result.rows[0].id),{projectId:request.params.id});response.status(201).json({review:result.rows[0]});
  });
  router.post('/projects/:id/meetings',requireRoles('admin','manager','technician'),async(request,response)=>{
    const summary=String(request.body.summary||'').trim();if(!request.body.meetingAt||!summary)return response.status(400).json({error:'תאריך פגישה וסיכום הם שדות חובה'});
    const hours=Math.max(0,Number(request.body.hours)||0);if(hours>24)return response.status(400).json({error:'לא ניתן לדווח יותר מ־24 שעות ביום'});
    const result=await pool.query(`INSERT INTO project_meeting_summaries(project_id,meeting_at,attendees,summary,follow_up,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[request.params.id,request.body.meetingAt,request.body.attendees||'',summary,request.body.followUp||'',request.user.id]);
    if(hours)await pool.query(`INSERT INTO project_time_entries(project_id,user_id,activity_type,work_date,hours,source_type,source_id,notes) VALUES($1,$2,'planning',$3,$4,'meeting_summary',$5,$6)`,[request.params.id,request.user.id,String(request.body.meetingAt).slice(0,10),hours,String(result.rows[0].id),'סיכום פגישה']);
    await audit(request,'create','meeting_summary',String(result.rows[0].id),{projectId:request.params.id});response.status(201).json({meeting:result.rows[0]});
  });

  router.post('/projects/:id/updates', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const body = String(request.body.body || '').trim(); if (!body) return response.status(400).json({ error: 'יש לכתוב תוכן לעדכון' });
    const result = await pool.query('INSERT INTO project_updates(project_id,body,created_by) VALUES($1,$2,$3) RETURNING *', [request.params.id, body, request.user.id]);
    const team=await pool.query('SELECT id,username,display_name FROM users WHERE active=TRUE AND id<>$1',[request.user.id]);
    const normalized=body.toLocaleLowerCase('he-IL');const mentioned=team.rows.filter(item=>normalized.includes(`@${String(item.display_name).toLocaleLowerCase('he-IL')}`)||normalized.includes(`@${String(item.username||'').toLocaleLowerCase('he-IL')}`));
    const projectName=(await pool.query('SELECT name FROM projects WHERE id=$1',[request.params.id])).rows[0]?.name||request.params.id;
    for(const item of mentioned)await pool.query(`INSERT INTO user_messages(sender_id,recipient_id,subject,body,linked_url,mention) VALUES($1,$2,$3,$4,$5,TRUE)`,[request.user.id,item.id,`תויגת בפרויקט ${projectName}`,body,`?project=${encodeURIComponent(request.params.id)}`]);
    await audit(request, 'create', 'project_update', String(result.rows[0].id), { projectId: request.params.id,mentions:mentioned.map(item=>item.id) }); response.status(201).json({ update: result.rows[0],mentions:mentioned.length });
  });

  router.post('/projects/:id/team', requireRoles('admin', 'manager'), async (request, response) => {
    await pool.query(`INSERT INTO project_professionals(project_id,professional_id,role_type_id,is_primary,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,professional_id,role_type_id) DO UPDATE SET is_primary=EXCLUDED.is_primary,notes=EXCLUDED.notes`, [request.params.id, request.body.professionalId, request.body.roleTypeId, Boolean(request.body.isPrimary), request.body.notes || '']);
    await audit(request, 'assign', 'project_professional', `${request.params.id}:${request.body.professionalId}`, { projectId: request.params.id }); response.status(204).end();
  });

  router.delete('/projects/:id/team/:professionalId/:roleTypeId', requireRoles('admin'), async (request, response) => {
    await pool.query('DELETE FROM project_professionals WHERE project_id=$1 AND professional_id=$2 AND role_type_id=$3', [request.params.id, request.params.professionalId, request.params.roleTypeId]);
    await audit(request, 'delete', 'project_professional', `${request.params.id}:${request.params.professionalId}`, { projectId: request.params.id }); response.status(204).end();
  });

  router.post('/projects/:id/equipment', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const result = await pool.query(`INSERT INTO project_equipment(project_id,catalog_item_id,quantity,location,status,serial_number,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [request.params.id, request.body.catalogItemId, Number(request.body.quantity) || 1, request.body.location || '', request.body.status || 'planned', request.body.serialNumber || '', request.body.notes || '']);
    await audit(request, 'create', 'project_equipment', String(result.rows[0].id), { projectId: request.params.id }); response.status(201).json({ equipment: result.rows[0] });
  });

  router.patch('/projects/:id/equipment/:itemId', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const current = await pool.query('SELECT * FROM project_equipment WHERE id=$1 AND project_id=$2', [request.params.itemId, request.params.id]); if (!current.rowCount) return response.status(404).json({ error: 'הציוד לא נמצא' }); const row=current.rows[0];
    const result=await pool.query('UPDATE project_equipment SET quantity=$1,location=$2,status=$3,serial_number=$4,notes=$5,updated_at=NOW() WHERE id=$6 RETURNING *',[request.body.quantity??row.quantity,request.body.location??row.location,request.body.status??row.status,request.body.serialNumber??row.serial_number,request.body.notes??row.notes,request.params.itemId]);
    await audit(request,'update','project_equipment',request.params.itemId,{projectId:request.params.id}); response.json({equipment:result.rows[0]});
  });

  router.delete('/projects/:id/equipment/:itemId', requireRoles('admin'), async (request, response) => { await pool.query('DELETE FROM project_equipment WHERE id=$1 AND project_id=$2',[request.params.itemId,request.params.id]); await audit(request,'delete','project_equipment',request.params.itemId,{projectId:request.params.id}); response.status(204).end(); });

  router.get('/reports/overview', async (request, response) => {
    const reportQuery = async (name, sql, fallback) => {
      try {
        return (await pool.query(sql)).rows;
      } catch (error) {
        console.error(`PROJECTS report query failed [${name}]`, error.message);
        return fallback;
      }
    };
    const [stages, tasks, finance, financeProjects, managers, monthly, systems, components, projectSizes, contractorStages, deadlines, documents, aiUsage, aiUsageSummary] = await Promise.all([
      reportQuery('stages', 'SELECT stage,COUNT(*)::int count,COALESCE(SUM(value),0)::numeric value FROM projects WHERE archived_at IS NULL GROUP BY stage ORDER BY count DESC', []),
      reportQuery('tasks', 'SELECT status,COUNT(*)::int count FROM tasks GROUP BY status', []),
      reportQuery('finance', 'SELECT COALESCE(SUM(value),0)::numeric total,COALESCE(SUM(paid),0)::numeric paid,COALESCE(SUM(value-paid),0)::numeric AS "open" FROM projects', [{ total: 0, paid: 0, open: 0 }]),
      reportQuery('financeProjects', `SELECT id,name,COALESCE(value,0)::numeric total,COALESCE(paid,0)::numeric paid,
        GREATEST(COALESCE(value,0)-COALESCE(paid,0),0)::numeric AS "open"
        FROM projects WHERE archived_at IS NULL AND (COALESCE(value,0)>0 OR COALESCE(paid,0)>0)
        ORDER BY COALESCE(value,0) DESC,name ASC LIMIT 10`, []),
      reportQuery('managers', `SELECT COALESCE(NULLIF(pr.display_name,''),NULLIF(p.manager,''),'ללא מנהל') name,COUNT(*)::int projects,COALESCE(ROUND(AVG(p.progress)),0)::int progress
        FROM projects p LEFT JOIN professionals pr ON pr.id=p.manager_professional_id WHERE p.archived_at IS NULL
        GROUP BY pr.id,pr.display_name,p.manager ORDER BY COUNT(*) DESC`, []),
      reportQuery('monthly', `SELECT to_char(date_trunc('month',COALESCE(paid_at,due_date)::timestamp),'YYYY-MM') month,COALESCE(SUM(amount),0)::numeric amount,status
        FROM project_payments WHERE status<>'cancelled' AND COALESCE(paid_at,due_date) IS NOT NULL GROUP BY 1,status ORDER BY 1`, []),
      reportQuery('systems', `SELECT system name,COUNT(*)::int projects FROM projects p CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.systems,'[]'::jsonb)) system
        WHERE p.archived_at IS NULL GROUP BY system ORDER BY projects DESC,name LIMIT 12`, []),
      reportQuery('components', `SELECT c.name,COALESCE(SUM(e.quantity),0)::numeric quantity,COUNT(DISTINCT e.project_id)::int projects
        FROM project_equipment e JOIN equipment_catalog c ON c.id=e.catalog_item_id JOIN projects p ON p.id=e.project_id
        WHERE p.archived_at IS NULL GROUP BY c.id,c.name ORDER BY quantity DESC,c.name LIMIT 12`, []),
      reportQuery('projectSizes', `SELECT COALESCE(project_size,'medium') size,COUNT(*)::int count FROM projects WHERE archived_at IS NULL GROUP BY project_size ORDER BY count DESC`, []),
      reportQuery('contractorStages', `SELECT COALESCE(contractor_progress,'waiting') stage,COUNT(*)::int count FROM projects WHERE archived_at IS NULL GROUP BY contractor_progress ORDER BY count DESC`, []),
      reportQuery('deadlines', `SELECT bucket,COUNT(*)::int count FROM (SELECT CASE
        WHEN due_date<CURRENT_DATE THEN 'overdue' WHEN due_date=CURRENT_DATE THEN 'today' WHEN due_date<=CURRENT_DATE+7 THEN 'week'
        WHEN due_date IS NULL THEN 'none' ELSE 'later' END bucket FROM tasks WHERE status NOT IN ('done','cancelled')) items GROUP BY bucket`, []),
      reportQuery('documents', `SELECT COALESCE(NULLIF(f.category,''),'אחר') category,COUNT(*)::int count FROM client_files f
        LEFT JOIN projects p ON p.id=f.project_id WHERE f.project_id IS NULL OR p.archived_at IS NULL GROUP BY f.category ORDER BY count DESC LIMIT 10`, []),
      reportQuery('aiUsage', `SELECT to_char(date_trunc('day',created_at),'YYYY-MM-DD') day,
        COUNT(*) FILTER (WHERE feature='chat')::int questions,COUNT(*) FILTER (WHERE feature='insights')::int insights,
        COALESCE(SUM(total_tokens),0)::bigint tokens,COALESCE(SUM(estimated_cost_usd),0)::numeric estimated_cost
        FROM ai_usage_log WHERE created_at>=CURRENT_DATE-29 GROUP BY 1 ORDER BY 1`, []),
      reportQuery('aiUsageSummary', `SELECT COUNT(*) FILTER (WHERE feature='chat')::int questions,
        COUNT(*) FILTER (WHERE feature='insights')::int insights,COALESCE(SUM(total_tokens),0)::bigint tokens,
        COALESCE(SUM(estimated_cost_usd),0)::numeric estimated_cost
        FROM ai_usage_log WHERE created_at>=CURRENT_DATE-29`, [{ questions:0,insights:0,tokens:0,estimated_cost:0 }]),
    ]);
    const canViewFinance=request.user.financeAccess!==false;
    response.json({
      stages:canViewFinance?stages:stages.map(({value: _value,...stage})=>stage),
      tasks,
      finance:canViewFinance?(finance[0] || { total: 0, paid: 0, open: 0 }):{ restricted:true,total:0,paid:0,open:0 },
      financeProjects:canViewFinance?financeProjects:[],
      managers,
      monthly:canViewFinance?monthly:[],
      systems, components, projectSizes, contractorStages, deadlines, documents, aiUsage,
      aiUsageSummary:aiUsageSummary[0] || { questions:0,insights:0,tokens:0,estimated_cost:0 },
    });
  });

  return router;
}
