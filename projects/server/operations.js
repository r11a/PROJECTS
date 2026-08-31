import express from 'express';
import { executeAutomations } from './productivity.js';
import { normalizeDateOnly } from './dateOnly.js';

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

function normalizedAssigneeIds(body, fallback = []) {
  const source = Array.isArray(body.assigneeProfessionalIds)
    ? body.assigneeProfessionalIds
    : body.assigneeProfessionalId ? [body.assigneeProfessionalId] : fallback;
  return [...new Set(source.map(String).filter(Boolean))];
}

async function replaceTaskAssignees(db, taskId, professionalIds, userId) {
  await db.query('DELETE FROM task_assignees WHERE task_id=$1', [taskId]);
  for (const professionalId of professionalIds) {
    await db.query('INSERT INTO task_assignees(task_id,professional_id,assigned_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [taskId, professionalId, userId]);
  }
}

async function syncSourceHours(pool,{projectId,sourceType,sourceId,professionalId,userId,activityType,workDate,hours,notes}){
  await pool.query('DELETE FROM project_time_entries WHERE project_id=$1 AND source_type=$2 AND source_id=$3',[projectId,sourceType,String(sourceId)]);
  if(Number(hours)>0)await pool.query(`INSERT INTO project_time_entries(project_id,professional_id,user_id,activity_type,work_date,hours,source_type,source_id,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[projectId,professionalId||null,userId,activityType,workDate,Number(hours),sourceType,String(sourceId),notes||'']);
}

async function notifyTaskSafely(pushService,taskId,eventType,user){
  try{return await pushService?.notifyTask(taskId,eventType,user)}catch(error){console.error(`Task push failed for ${taskId}:`,error.message);return {sent:0,failed:1,skipped:0}}
}

export function createOperationsRouter({ pool, authenticate, requireRoles, audit, pushService }) {
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
    } else if (entry.entity_type === 'site_review') {
      await pool.query(`INSERT INTO project_site_reviews(id,project_id,review_date,performed_by,supervision_type,summary,follow_up,plan_update_required,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING`,[row.id,row.project_id,row.review_date,row.performed_by,row.supervision_type,row.summary,row.follow_up,row.plan_update_required,row.created_by,row.created_at,row.updated_at]);
    } else if (entry.entity_type === 'meeting_summary') {
      await pool.query(`INSERT INTO project_meeting_summaries(id,project_id,meeting_at,attendees,summary,follow_up,created_by,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,[row.id,row.project_id,row.meeting_at,row.attendees,row.summary,row.follow_up,row.created_by,row.created_at,row.updated_at]);
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
      COALESCE((SELECT json_agg(json_build_object('id',tap.id,'displayName',tap.display_name,'color',tap.color,'linkedUserId',tap.linked_user_id) ORDER BY tap.display_name)
        FROM task_assignees ta JOIN professionals tap ON tap.id=ta.professional_id WHERE ta.task_id=t.id),'[]'::json) assignees,
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
    const dueDate = normalizeDateOnly(request.body.dueDate);
    const startDate = normalizeDateOnly(request.body.startDate || request.body.dueDate);
    if (!dueDate || !startDate) return response.status(400).json({ error: 'התאריך שנשלח אינו תקין' });
    if (!title || !request.body.dueDate || (!request.body.projectId && !request.body.clientId)) return response.status(400).json({ error: 'כותרת, תאריך סיום ופרויקט או לקוח הם שדות חובה' });
    if (request.body.startDate && request.body.startDate > request.body.dueDate) return response.status(400).json({ error: 'תאריך ההתחלה אינו יכול להיות אחרי תאריך היעד' });
    if (request.body.dependencyTaskId) { const dependency=await pool.query("SELECT project_id,status FROM tasks WHERE id=$1",[request.body.dependencyTaskId]); if(!dependency.rowCount||dependency.rows[0].project_id!==request.body.projectId||!['open','in_progress'].includes(dependency.rows[0].status))return response.status(400).json({error:'משימת התלות חייבת להיות פתוחה או בביצוע ובאותו פרויקט'}); }
    if (request.body.parentTaskId) { const parent=await pool.query('SELECT project_id FROM tasks WHERE id=$1',[request.body.parentTaskId]); if(!parent.rowCount||String(parent.rows[0].project_id)!==String(request.body.projectId))return response.status(400).json({error:'משימת האב חייבת להיות באותו פרויקט'}); }
    if (!(await mayEditProject(pool, request, request.body.projectId))) return response.status(403).json({error:'רק מנהל הפרויקט המשויך רשאי ליצור או לערוך משימות בפרויקט'});
    const durationHours=Math.max(0,Number(request.body.durationHours ?? request.body.estimatedHours)||0);
    const allDay=Boolean(request.body.allDay);
    const assigneeIds=normalizedAssigneeIds(request.body);
    const result = await pool.query(`INSERT INTO tasks(client_id,project_id,title,description,status,priority,assignee_professional_id,owner_professional_id,start_date,due_date,start_time,end_time,all_day,duration_hours,estimated_hours,task_type,dependency_task_id,parent_task_id,critical,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,$16,$17,$18,$19) RETURNING *`, [request.body.clientId || null, request.body.projectId || null, title, request.body.description || '', TASK_STATUSES.includes(request.body.status) ? request.body.status : 'open', request.body.priority || 'normal', assigneeIds[0] || null,request.body.ownerProfessionalId || null, startDate, dueDate, allDay?null:(request.body.startTime || null), allDay?null:(request.body.endTime || null), allDay, durationHours, request.body.taskType || 'task', request.body.dependencyTaskId || null,request.body.parentTaskId || null,Boolean(request.body.critical), request.user.id]);
    await replaceTaskAssignees(pool,result.rows[0].id,assigneeIds,request.user.id);
    await syncProjectMetrics(pool, request.body.projectId);
    await audit(request, 'create', 'task', String(result.rows[0].id), { title, projectId: request.body.projectId });
    await executeAutomations({
      pool,
      triggerType:'task_created',
      entityType:'task',
      entityId:result.rows[0].id,
      context:{
        projectId:request.body.projectId,
        status:result.rows[0].status,
        title,
        assigneeProfessionalId: request.body.assigneeProfessionalId || null,
        ownerProfessionalId: request.body.ownerProfessionalId || null,
      },
      userId:request.user.id,
    });
    const notification=await notifyTaskSafely(pushService,result.rows[0].id,'created',request.user);
    response.status(201).json({ task: result.rows[0],notification });
  });

  router.patch('/operations/tasks/:id', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const current = await pool.query('SELECT * FROM tasks WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'המשימה לא נמצאה' });
    const row = current.rows[0];
    if (!(await mayEditProject(pool, request, row.project_id))) return response.status(403).json({error:'רק מנהל הפרויקט המשויך רשאי לערוך משימות בפרויקט'});
    const status = TASK_STATUSES.includes(request.body.status) ? request.body.status : row.status;
    const dependencyId=Object.prototype.hasOwnProperty.call(request.body,'dependencyTaskId')?(request.body.dependencyTaskId||null):row.dependency_task_id;
    const hasStartDate = Object.prototype.hasOwnProperty.call(request.body, 'startDate');
    const hasDueDate = Object.prototype.hasOwnProperty.call(request.body, 'dueDate');
    const nextStart = hasStartDate ? normalizeDateOnly(request.body.startDate) : row.start_date;
    const nextDue = hasDueDate ? normalizeDateOnly(request.body.dueDate) : row.due_date;
    if ((hasStartDate && !nextStart) || (hasDueDate && !nextDue)) return response.status(400).json({ error: 'התאריך שנשלח אינו תקין' });
    if(String(request.body.dependencyTaskId||'')===String(request.params.id))return response.status(400).json({error:'משימה אינה יכולה להיות תלויה בעצמה'});
    if(dependencyId){const dependency=await pool.query("SELECT project_id,status FROM tasks WHERE id=$1",[dependencyId]);if(!dependency.rowCount||dependency.rows[0].project_id!==row.project_id||!['open','in_progress'].includes(dependency.rows[0].status))return response.status(400).json({error:'משימת התלות חייבת להיות פתוחה או בביצוע ובאותו פרויקט'});}
    const parentTaskId=Object.prototype.hasOwnProperty.call(request.body,'parentTaskId')?(request.body.parentTaskId||null):row.parent_task_id;
    if(String(parentTaskId||'')===String(request.params.id))return response.status(400).json({error:'משימה אינה יכולה להיות תת־משימה של עצמה'});
    if(parentTaskId){const parent=await pool.query('SELECT project_id,parent_task_id FROM tasks WHERE id=$1',[parentTaskId]);if(!parent.rowCount||String(parent.rows[0].project_id)!==String(row.project_id)||String(parent.rows[0].parent_task_id||'')===String(request.params.id))return response.status(400).json({error:'שיוך משימת האב אינו תקין או יוצר מעגל'});}
    if (nextStart && nextDue && String(nextStart).slice(0,10) > String(nextDue).slice(0,10)) return response.status(400).json({ error: 'תאריך ההתחלה אינו יכול להיות אחרי תאריך היעד' });
    const durationHours=Math.max(0,Number(request.body.durationHours ?? request.body.estimatedHours ?? row.duration_hours ?? row.estimated_hours)||0);
    const allDay=request.body.allDay ?? row.all_day;
    const fallbackAssignees=(await pool.query('SELECT professional_id FROM task_assignees WHERE task_id=$1',[request.params.id])).rows.map((item)=>item.professional_id);
    const assigneeIds=normalizedAssigneeIds(request.body,fallbackAssignees);
    const primaryAssignee=assigneeIds[0]||null;
    const result = await pool.query(`UPDATE tasks SET title=$1,description=$2,status=$3,priority=$4,assignee_professional_id=$5,owner_professional_id=$6,start_date=$7,due_date=$8,start_time=$9,end_time=$10,all_day=$11,duration_hours=$12,estimated_hours=$12,task_type=$13,dependency_task_id=$14,parent_task_id=$15,critical=$16,color=$17,
      completed_at=CASE WHEN $3='done' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$18 RETURNING *`, [request.body.title ?? row.title, request.body.description ?? row.description, status, request.body.priority ?? row.priority, request.body.assigneeProfessionalId ?? row.assignee_professional_id,request.body.ownerProfessionalId ?? row.owner_professional_id, nextStart, nextDue, allDay?null:(request.body.startTime ?? row.start_time), allDay?null:(request.body.endTime ?? row.end_time), allDay, durationHours, request.body.taskType ?? row.task_type, dependencyId,parentTaskId,request.body.critical ?? row.critical, request.body.color ?? row.color, request.params.id]);
    if(Object.prototype.hasOwnProperty.call(request.body,'assigneeProfessionalIds')){
      await pool.query('UPDATE tasks SET assignee_professional_id=$1 WHERE id=$2',[primaryAssignee,request.params.id]);
      await replaceTaskAssignees(pool,request.params.id,assigneeIds,request.user.id);
    }
    await syncProjectMetrics(pool, row.project_id);
    await audit(request, 'update', 'task', request.params.id, request.body);
    if(status!==row.status) {
      await executeAutomations({
        pool,
        triggerType:'task_status_changed',
        entityType:'task',
        entityId:request.params.id,
        context:{
          projectId:row.project_id,
          status,
          fromStatus:row.status,
          title:result.rows[0].title,
          assigneeProfessionalId: row.assignee_professional_id || null,
          ownerProfessionalId: row.owner_professional_id || null,
        },
        userId:request.user.id,
      });
    }
    if(Object.prototype.hasOwnProperty.call(request.body,'assigneeProfessionalIds')||String(nextDue)!==String(row.due_date)||String(request.body.startTime||'')!==String(row.start_time||''))await notifyTaskSafely(pushService,result.rows[0].id,'updated',request.user);
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
    const [tasks, milestones, payments, team, equipment, forms, files, updates, activity,reviews,meetings,timeEntries,priorityOrders,systemColumns,systemFieldSettings] = await Promise.all([
      pool.query(`SELECT t.*,pr.display_name assignee_name,pr.color assignee_color,dependency.title dependency_title FROM tasks t LEFT JOIN professionals pr ON pr.id=t.assignee_professional_id LEFT JOIN tasks dependency ON dependency.id=t.dependency_task_id WHERE t.project_id=$1 ORDER BY (t.status='done'),t.due_date`, [id]),
      pool.query(`SELECT m.*,pr.display_name owner_name FROM project_milestones m LEFT JOIN professionals pr ON pr.id=m.owner_professional_id WHERE m.project_id=$1 ORDER BY (m.status='completed'),m.due_date`, [id]),
      pool.query('SELECT * FROM project_payments WHERE project_id=$1 ORDER BY due_date NULLS LAST,created_at DESC', [id]),
      pool.query(`SELECT pp.*,p.display_name,p.phone,p.email,p.color,p.icon,r.name role_name,r.role_key FROM project_professionals pp JOIN professionals p ON p.id=pp.professional_id JOIN professional_role_types r ON r.id=pp.role_type_id WHERE pp.project_id=$1 ORDER BY pp.is_primary DESC,r.sort_order,p.display_name`, [id]),
      pool.query(`SELECT pe.*,e.name,e.item_type,e.manufacturer,e.model,e.unit,e.color,e.icon,e.code,COALESCE(NULLIF(pe.sku_override,''),e.priority_sku,e.code) priority_sku,
        COALESCE(pe.project_system_id,e.parent_id) system_id,COALESCE(NULLIF(psb.title,''),s.name) system_name,
        COALESCE(NULLIF(psb.color,''),s.color,e.color,'#6957df') system_color,COALESCE(psb.sort_order,0) system_sort_order,s.parent_id system_type_id,st.name system_type_name
        FROM project_equipment pe JOIN equipment_catalog e ON e.id=pe.catalog_item_id
        LEFT JOIN equipment_catalog s ON s.id=COALESCE(pe.project_system_id,e.parent_id)
        LEFT JOIN equipment_catalog st ON st.id=s.parent_id
        LEFT JOIN project_system_board psb ON psb.project_id=pe.project_id AND psb.system_id=COALESCE(pe.project_system_id,e.parent_id)
        WHERE pe.project_id=$1 ORDER BY COALESCE(psb.sort_order,0),st.name,s.name,pe.board_order,pe.id`, [id]),
      pool.query(`SELECT fr.*,ft.name template_name FROM form_records fr JOIN form_templates ft ON ft.id=fr.template_id WHERE fr.project_id=$1 ORDER BY fr.updated_at DESC`, [id]),
      pool.query(`SELECT f.*,COALESCE(u.display_name,u.username,'מערכת') uploaded_by_name FROM client_files f LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.project_id=$1 AND f.deleted_at IS NULL ORDER BY f.created_at DESC`, [id]),
      pool.query('SELECT pu.*,u.display_name created_by_name,u.avatar_color FROM project_updates pu LEFT JOIN users u ON u.id=pu.created_by WHERE pu.project_id=$1 ORDER BY pu.created_at DESC', [id]),
      pool.query(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE (a.entity_type='project' AND a.entity_id=$1) OR (a.details->>'projectId'=$1) ORDER BY a.created_at DESC LIMIT 100`, [id]),
      pool.query(`SELECT r.*,p.display_name performed_by_name,u.display_name created_by_name,COALESCE((SELECT SUM(e.hours) FROM project_time_entries e WHERE e.source_type='site_review' AND e.source_id=r.id::text),0) work_hours FROM project_site_reviews r LEFT JOIN professionals p ON p.id=r.performed_by LEFT JOIN users u ON u.id=r.created_by WHERE r.project_id=$1 ORDER BY r.review_date DESC,r.created_at DESC`,[id]),
      pool.query(`SELECT m.*,u.display_name created_by_name,COALESCE((SELECT SUM(e.hours) FROM project_time_entries e WHERE e.source_type='meeting_summary' AND e.source_id=m.id::text),0) work_hours FROM project_meeting_summaries m LEFT JOIN users u ON u.id=m.created_by WHERE m.project_id=$1 ORDER BY m.meeting_at DESC`,[id]),
      pool.query(`SELECT e.*,p.display_name professional_name,u.display_name user_name FROM project_time_entries e LEFT JOIN professionals p ON p.id=e.professional_id LEFT JOIN users u ON u.id=e.user_id WHERE e.project_id=$1 ORDER BY e.work_date DESC,e.created_at DESC`,[id]),
      pool.query(`SELECT o.id,o.priority_order_number,o.customer_name,o.order_status,o.order_date,o.total_amount,o.created_at,
        COUNT(l.id)::int line_count,COUNT(l.id) FILTER (WHERE l.include_in_project)::int selected_count
        FROM priority_orders o LEFT JOIN priority_order_lines l ON l.priority_order_id=o.id WHERE o.project_id=$1
        GROUP BY o.id ORDER BY o.created_at DESC`,[id]),
      pool.query('SELECT id,column_key,label,column_type,sort_order FROM project_system_columns WHERE project_id=$1 ORDER BY sort_order,id',[id]),
      pool.query('SELECT field_key,label,sort_order FROM project_system_field_settings WHERE project_id=$1 ORDER BY sort_order,field_key',[id]),
    ]);
    response.json({ tasks: tasks.rows, milestones: milestones.rows, payments: request.user.financeAccess === false ? [] : payments.rows, team: team.rows, equipment: equipment.rows, forms: forms.rows, files: files.rows, updates: updates.rows, activity: activity.rows,reviews:reviews.rows,meetings:meetings.rows,timeEntries:timeEntries.rows,
      systemColumns:systemColumns.rows,systemFieldSettings:systemFieldSettings.rows,priorityOrders:priorityOrders.rows.map((row)=>({id:row.id,priorityOrderNumber:row.priority_order_number,customerName:row.customer_name,orderStatus:row.order_status,orderDate:row.order_date,lineCount:Number(row.line_count),selectedCount:Number(row.selected_count),createdAt:row.created_at,...(request.user.financeAccess===false?{}:{totalAmount:Number(row.total_amount||0)})})) });
  });

  router.post('/projects/:id/time-entries',requireRoles('admin','manager','technician'),async(request,response)=>{
    const allowed=['planning','supervision','technician','installation','threading','programming','training'];
    const hours=Number(request.body.hours);
    if(!allowed.includes(request.body.activityType)||!request.body.workDate||!hours||hours<=0||hours>24)return response.status(400).json({error:'יש לבחור סוג פעילות, תאריך ומספר שעות תקין'});
    const result=await pool.query(`INSERT INTO project_time_entries(project_id,professional_id,user_id,activity_type,work_date,hours,source_type,source_id,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[request.params.id,request.body.professionalId||null,request.user.id,request.body.activityType,request.body.workDate,hours,request.body.sourceType||'manual',request.body.sourceId||null,request.body.notes||'']);
    await audit(request,'create','time_entry',String(result.rows[0].id),{projectId:request.params.id,hours,activityType:request.body.activityType});response.status(201).json({entry:result.rows[0]});
  });
  router.patch('/projects/:id/time-entries/:entryId',requireRoles('admin','manager','technician'),async(request,response)=>{const current=await pool.query('SELECT * FROM project_time_entries WHERE id=$1 AND project_id=$2',[request.params.entryId,request.params.id]);if(!current.rowCount)return response.status(404).json({error:'דיווח השעות לא נמצא'});const row=current.rows[0],allowed=['planning','supervision','technician','installation','threading','programming','training'];const activityType=request.body.activityType??row.activity_type,hours=Number(request.body.hours??row.hours),workDate=request.body.workDate??row.work_date;if(!allowed.includes(activityType)||!workDate||hours<=0||hours>24)return response.status(400).json({error:'פרטי דיווח השעות אינם תקינים'});const result=await pool.query(`UPDATE project_time_entries SET professional_id=$1,activity_type=$2,work_date=$3,hours=$4,notes=$5 WHERE id=$6 RETURNING *`,[request.body.professionalId===undefined?row.professional_id:(request.body.professionalId||null),activityType,workDate,hours,request.body.notes??row.notes,request.params.entryId]);await audit(request,'update','time_entry',request.params.entryId,{projectId:request.params.id,hours,activityType});response.json({entry:result.rows[0]});});
  router.delete('/projects/:id/time-entries/:entryId',requireRoles('admin','manager'),async(request,response)=>{const result=await pool.query('DELETE FROM project_time_entries WHERE id=$1 AND project_id=$2 RETURNING *',[request.params.entryId,request.params.id]);if(!result.rowCount)return response.status(404).json({error:'דיווח השעות לא נמצא'});await audit(request,'delete','time_entry',request.params.entryId,{projectId:request.params.id,hours:result.rows[0].hours});response.status(204).end();});
  router.patch('/projects/:id/time-targets',requireRoles('admin','manager'),async(request,response)=>{
    const installation=Math.max(0,Number(request.body.installationHoursTarget)||0);const programming=Math.max(0,Number(request.body.programmingHoursTarget)||0);
    const result=await pool.query('UPDATE projects SET installation_hours_target=$1,programming_hours_target=$2,updated_at=NOW() WHERE id=$3 RETURNING installation_hours_target,programming_hours_target',[installation,programming,request.params.id]);
    if(!result.rowCount)return response.status(404).json({error:'הפרויקט לא נמצא'});await audit(request,'update','time_targets',request.params.id,{installation,programming});response.json({targets:result.rows[0]});
  });

  router.post('/projects/:id/site-reviews',requireRoles('admin','manager','technician'),async(request,response)=>{
    const summary=String(request.body.summary||'').trim();if(!request.body.reviewDate||!summary)return response.status(400).json({error:'תאריך פיקוח וסיכום הם שדות חובה'});
    const hours=Math.max(0,Number(request.body.hours)||0);if(hours>24)return response.status(400).json({error:'לא ניתן לדווח יותר מ־24 שעות ביום'});
    const result=await pool.query(`INSERT INTO project_site_reviews(project_id,review_date,performed_by,supervision_type,summary,follow_up,plan_update_required,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[request.params.id,request.body.reviewDate,request.body.performedBy||null,request.body.supervisionType||'',summary,request.body.followUp||'',Boolean(request.body.planUpdateRequired),request.user.id]);
    if(request.body.voiceContextId)await pool.query(`UPDATE voice_notes SET entity_type='site_review',entity_id=$1,project_id=$2 WHERE entity_type='site_review_draft' AND entity_id=$3 AND recorded_by=$4`,[String(result.rows[0].id),request.params.id,String(request.body.voiceContextId),request.user.id]);
    await syncSourceHours(pool,{projectId:request.params.id,sourceType:'site_review',sourceId:result.rows[0].id,professionalId:request.body.performedBy,userId:request.user.id,activityType:'supervision',workDate:request.body.reviewDate,hours,notes:request.body.supervisionType||'ביקורת אתר'});
    await audit(request,'create','site_review',String(result.rows[0].id),{projectId:request.params.id});response.status(201).json({review:result.rows[0]});
  });
  router.patch('/projects/:id/site-reviews/:reviewId',requireRoles('admin','manager','technician'),async(request,response)=>{
    const current=await pool.query('SELECT * FROM project_site_reviews WHERE id=$1 AND project_id=$2',[request.params.reviewId,request.params.id]);if(!current.rowCount)return response.status(404).json({error:'ביקורת האתר לא נמצאה'});const row=current.rows[0];
    const result=await pool.query(`UPDATE project_site_reviews SET review_date=$1,performed_by=$2,supervision_type=$3,summary=$4,follow_up=$5,plan_update_required=$6,updated_at=NOW() WHERE id=$7 RETURNING *`,[request.body.reviewDate||row.review_date,request.body.performedBy||null,request.body.supervisionType??row.supervision_type,String(request.body.summary??row.summary).trim(),request.body.followUp??row.follow_up,request.body.planUpdateRequired??row.plan_update_required,request.params.reviewId]);
    if(request.body.hours!==undefined&&request.body.hours!=='')await syncSourceHours(pool,{projectId:request.params.id,sourceType:'site_review',sourceId:request.params.reviewId,professionalId:result.rows[0].performed_by,userId:request.user.id,activityType:'supervision',workDate:result.rows[0].review_date,hours:Math.max(0,Number(request.body.hours)||0),notes:result.rows[0].supervision_type||'ביקורת אתר'});await audit(request,'update','site_review',request.params.reviewId,{projectId:request.params.id});response.json({review:result.rows[0]});
  });
  router.delete('/projects/:id/site-reviews/:reviewId',requireRoles('admin'),async(request,response)=>{const current=await pool.query('SELECT * FROM project_site_reviews WHERE id=$1 AND project_id=$2',[request.params.reviewId,request.params.id]);if(!current.rowCount)return response.status(404).json({error:'ביקורת האתר לא נמצאה'});await moveToRecycleBin(pool,request,'site_review',current.rows[0],`ביקורת אתר ${current.rows[0].review_date}`,request.params.id);await pool.query("DELETE FROM project_time_entries WHERE source_type='site_review' AND source_id=$1",[String(request.params.reviewId)]);await pool.query('DELETE FROM project_site_reviews WHERE id=$1',[request.params.reviewId]);await audit(request,'delete','site_review',request.params.reviewId,{projectId:request.params.id,recycleDays:30});response.status(204).end();});
  router.post('/projects/:id/meetings',requireRoles('admin','manager','technician'),async(request,response)=>{
    const summary=String(request.body.summary||'').trim();if(!request.body.meetingAt||!summary)return response.status(400).json({error:'תאריך פגישה וסיכום הם שדות חובה'});
    const hours=Math.max(0,Number(request.body.hours)||0);if(hours>24)return response.status(400).json({error:'לא ניתן לדווח יותר מ־24 שעות ביום'});
    const result=await pool.query(`INSERT INTO project_meeting_summaries(project_id,meeting_at,attendees,summary,follow_up,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[request.params.id,request.body.meetingAt,request.body.attendees||'',summary,request.body.followUp||'',request.user.id]);
    if(request.body.voiceContextId)await pool.query(`UPDATE voice_notes SET entity_type='meeting',entity_id=$1,project_id=$2 WHERE entity_type='meeting_draft' AND entity_id=$3 AND recorded_by=$4`,[String(result.rows[0].id),request.params.id,String(request.body.voiceContextId),request.user.id]);
    await syncSourceHours(pool,{projectId:request.params.id,sourceType:'meeting_summary',sourceId:result.rows[0].id,userId:request.user.id,activityType:'planning',workDate:String(request.body.meetingAt).slice(0,10),hours,notes:'סיכום פגישה'});
    await audit(request,'create','meeting_summary',String(result.rows[0].id),{projectId:request.params.id});response.status(201).json({meeting:result.rows[0]});
  });
  router.patch('/projects/:id/meetings/:meetingId',requireRoles('admin','manager','technician'),async(request,response)=>{const current=await pool.query('SELECT * FROM project_meeting_summaries WHERE id=$1 AND project_id=$2',[request.params.meetingId,request.params.id]);if(!current.rowCount)return response.status(404).json({error:'סיכום הפגישה לא נמצא'});const row=current.rows[0];const result=await pool.query(`UPDATE project_meeting_summaries SET meeting_at=$1,attendees=$2,summary=$3,follow_up=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,[request.body.meetingAt||row.meeting_at,request.body.attendees??row.attendees,String(request.body.summary??row.summary).trim(),request.body.followUp??row.follow_up,request.params.meetingId]);if(request.body.hours!==undefined&&request.body.hours!=='')await syncSourceHours(pool,{projectId:request.params.id,sourceType:'meeting_summary',sourceId:request.params.meetingId,userId:request.user.id,activityType:'planning',workDate:String(result.rows[0].meeting_at).slice(0,10),hours:Math.max(0,Number(request.body.hours)||0),notes:'סיכום פגישה'});await audit(request,'update','meeting_summary',request.params.meetingId,{projectId:request.params.id});response.json({meeting:result.rows[0]});});
  router.delete('/projects/:id/meetings/:meetingId',requireRoles('admin'),async(request,response)=>{const current=await pool.query('SELECT * FROM project_meeting_summaries WHERE id=$1 AND project_id=$2',[request.params.meetingId,request.params.id]);if(!current.rowCount)return response.status(404).json({error:'סיכום הפגישה לא נמצא'});await moveToRecycleBin(pool,request,'meeting_summary',current.rows[0],`סיכום פגישה ${current.rows[0].meeting_at}`,request.params.id);await pool.query("DELETE FROM project_time_entries WHERE source_type='meeting_summary' AND source_id=$1",[String(request.params.meetingId)]);await pool.query('DELETE FROM project_meeting_summaries WHERE id=$1',[request.params.meetingId]);await audit(request,'delete','meeting_summary',request.params.meetingId,{projectId:request.params.id,recycleDays:30});response.status(204).end();});

  router.post('/projects/:id/meetings/:meetingId/tasks',requireRoles('admin','manager','technician'),async(request,response)=>{
    const meeting=await pool.query('SELECT id FROM project_meeting_summaries WHERE id=$1 AND project_id=$2',[request.params.meetingId,request.params.id]);if(!meeting.rowCount)return response.status(404).json({error:'סיכום הפגישה לא נמצא'});
    const suggestions=Array.isArray(request.body.tasks)?request.body.tasks.slice(0,20):[];const created=[];
    for(const item of suggestions){const title=String(item.title||'').trim();if(!title)continue;const dueDate=normalizeDateOnly(item.dueDate);if(!dueDate)return response.status(400).json({error:`יש לבחור תאריך סיום למשימה: ${title}`});const result=await pool.query(`INSERT INTO tasks(project_id,title,description,status,priority,assignee_professional_id,start_date,due_date,created_by) VALUES($1,$2,$3,'open',$4,$5,$6,$6,$7) RETURNING *`,[request.params.id,title,String(item.description||'').slice(0,3000),['normal','high','urgent'].includes(item.priority)?item.priority:'normal',item.assigneeProfessionalId||null,dueDate,request.user.id]);await pool.query('INSERT INTO meeting_task_links(meeting_id,task_id,created_by) VALUES($1,$2,$3)',[request.params.meetingId,result.rows[0].id,request.user.id]);created.push(result.rows[0]);}
    for(const task of created)await notifyTaskSafely(pushService,task.id,'created',request.user);
    await audit(request,'create_tasks','meeting_summary',request.params.meetingId,{projectId:request.params.id,taskIds:created.map((item)=>item.id)});response.status(201).json({tasks:created});
  });
  router.get('/projects/:id/email-recipients',async(request,response)=>{const [project,contacts,team,others]=await Promise.all([pool.query(`SELECT c.email client_email,c.name client_name FROM projects p LEFT JOIN clients c ON c.id=p.client_id WHERE p.id=$1`,[request.params.id]),pool.query(`SELECT cc.id,cc.name,cc.email,'client_contact' source,TRUE relevant FROM client_contacts cc JOIN projects p ON p.client_id=cc.client_id WHERE p.id=$1 AND cc.email<>''`,[request.params.id]),pool.query(`SELECT pr.id,pr.display_name name,pr.email,'professional' source,TRUE relevant FROM project_professionals pp JOIN professionals pr ON pr.id=pp.professional_id WHERE pp.project_id=$1 AND pr.email<>''`,[request.params.id]),pool.query(`SELECT concat('contact-',id) id,name,email,'client_contact' source,FALSE relevant FROM client_contacts WHERE email<>'' UNION ALL SELECT concat('professional-',id),display_name,email,'professional',FALSE FROM professionals WHERE email<>''`)]);const recipients=[...(project.rows[0]?.client_email?[{id:`client-${request.params.id}`,name:project.rows[0].client_name,email:project.rows[0].client_email,source:'client',relevant:true}]:[]),...contacts.rows,...team.rows,...others.rows];response.json({recipients:[...new Map(recipients.map((item)=>[item.email.toLowerCase(),item])).values()]});});
  router.post('/projects/:id/email-draft-opened',async(request,response)=>{await audit(request,'open_draft','meeting_email',String(request.body.meetingId||'draft'),{projectId:request.params.id,recipientCount:Number(request.body.recipientCount||0),ccCount:Number(request.body.ccCount||0)});response.sendStatus(204);});

  router.post('/projects/:id/updates', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const body = String(request.body.body || '').trim(); if (!body) return response.status(400).json({ error: 'יש לכתוב תוכן לעדכון' });
    const result = await pool.query('INSERT INTO project_updates(project_id,body,created_by) VALUES($1,$2,$3) RETURNING *', [request.params.id, body, request.user.id]);
    if(request.body.voiceContextId)await pool.query(`UPDATE voice_notes SET entity_type='project_update',entity_id=$1,project_id=$2 WHERE entity_type='project_update_draft' AND entity_id=$3 AND recorded_by=$4`,[String(result.rows[0].id),request.params.id,String(request.body.voiceContextId),request.user.id]);
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
    const rowColor=Object.prototype.hasOwnProperty.call(request.body,'rowColor')?String(request.body.rowColor||''):row.row_color;
    const quantity=Math.max(0,Number(request.body.quantity??row.quantity)||0);let quantityInstalled=Math.max(0,Number(request.body.quantityInstalled??row.quantity_installed)||0);let status=request.body.status??row.status;if(request.body.status!==undefined&&request.body.quantityInstalled===undefined){if(status==='installed')quantityInstalled=quantity;else if(status==='waiting'||status==='planned')quantityInstalled=0;else if(status==='in_progress'&&quantityInstalled===0&&quantity>0)quantityInstalled=1}if(request.body.quantityInstalled!==undefined){quantityInstalled=Math.min(quantity,quantityInstalled);status=quantityInstalled>=quantity&&quantity>0?'installed':quantityInstalled>0?'in_progress':'waiting'}
    const projectSystemId=Object.prototype.hasOwnProperty.call(request.body,'projectSystemId')?(request.body.projectSystemId||null):row.project_system_id;
    const result=await pool.query('UPDATE project_equipment SET quantity=$1,location=$2,status=$3,serial_number=$4,notes=$5,quantity_installed=$6,tag=$7,row_color=$8,board_order=$9,custom_values=$10,project_system_id=$11,sku_override=$12,updated_at=NOW() WHERE id=$13 RETURNING *',[quantity,request.body.location??row.location,status,request.body.serialNumber??row.serial_number,request.body.notes??row.notes,quantityInstalled,request.body.tag??row.tag,rowColor,request.body.boardOrder??row.board_order,JSON.stringify(request.body.customValues??row.custom_values??{}),projectSystemId,request.body.sku??row.sku_override,request.params.itemId]);
    await audit(request,'update','project_equipment',request.params.itemId,{projectId:request.params.id}); response.json({equipment:result.rows[0]});
  });

  router.delete('/projects/:id/equipment/:itemId', requireRoles('admin'), async (request, response) => { await pool.query('DELETE FROM project_equipment WHERE id=$1 AND project_id=$2',[request.params.itemId,request.params.id]); await audit(request,'delete','project_equipment',request.params.itemId,{projectId:request.params.id}); response.status(204).end(); });
  router.post('/projects/:id/equipment/:itemId/duplicate',requireRoles('admin','manager','technician'),async(request,response)=>{const count=Math.max(1,Math.min(50,Number(request.body.count)||1));const current=await pool.query('SELECT * FROM project_equipment WHERE id=$1 AND project_id=$2',[request.params.itemId,request.params.id]);if(!current.rowCount)return response.status(404).json({error:'הציוד לא נמצא'});const row=current.rows[0],created=[];for(let index=0;index<count;index++){const result=await pool.query(`INSERT INTO project_equipment(project_id,catalog_item_id,quantity,location,status,serial_number,notes,quantity_installed,tag,row_color,board_order,custom_values,project_system_id,sku_override) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11+$12,$13,$14,$15) RETURNING *`,[row.project_id,row.catalog_item_id,row.quantity,row.location,row.status,row.serial_number,row.notes,row.quantity_installed,row.tag,row.row_color,row.board_order,index+1,row.custom_values,row.project_system_id,row.sku_override]);created.push(result.rows[0])}await audit(request,'duplicate','project_equipment',request.params.itemId,{projectId:request.params.id,count});response.status(201).json({equipment:created})});

  router.patch('/projects/:id/system-board/:systemId',requireRoles('admin','manager','technician'),async(request,response)=>{const system=await pool.query("SELECT id FROM equipment_catalog WHERE id=$1 AND item_type='system'",[request.params.systemId]);if(!system.rowCount)return response.status(404).json({error:'המערכת לא נמצאה'});const result=await pool.query(`INSERT INTO project_system_board(project_id,system_id,title,color,sort_order) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(project_id,system_id) DO UPDATE SET title=COALESCE(NULLIF(EXCLUDED.title,''),project_system_board.title),color=COALESCE(NULLIF(EXCLUDED.color,''),project_system_board.color),sort_order=EXCLUDED.sort_order RETURNING *`,[request.params.id,request.params.systemId,request.body.title||'',request.body.color||'',Number(request.body.sortOrder)||0]);if(request.body.propagateColor)await pool.query(`UPDATE project_equipment pe SET row_color='',updated_at=NOW() FROM equipment_catalog e WHERE pe.catalog_item_id=e.id AND pe.project_id=$1 AND COALESCE(pe.project_system_id,e.parent_id)=$2`,[request.params.id,request.params.systemId]);await audit(request,'update','project_system_board',`${request.params.id}:${request.params.systemId}`,{projectId:request.params.id,colorPropagated:Boolean(request.body.propagateColor)});response.json({system:result.rows[0]})});
  router.patch('/projects/:id/system-board-order',requireRoles('admin','manager','technician'),async(request,response)=>{const ids=(request.body.systemIds||[]).map(Number).filter(Boolean);for(let index=0;index<ids.length;index++)await pool.query(`INSERT INTO project_system_board(project_id,system_id,sort_order) VALUES($1,$2,$3) ON CONFLICT(project_id,system_id) DO UPDATE SET sort_order=EXCLUDED.sort_order`,[request.params.id,ids[index],index]);response.sendStatus(204)});
  router.patch('/projects/:id/equipment-order',requireRoles('admin','manager','technician'),async(request,response)=>{const ids=(request.body.itemIds||[]).map(Number).filter(Boolean);for(let index=0;index<ids.length;index++)await pool.query('UPDATE project_equipment SET board_order=$1 WHERE id=$2 AND project_id=$3',[index,ids[index],request.params.id]);response.sendStatus(204)});
  router.post('/projects/:id/system-columns',requireRoles('admin','manager'),async(request,response)=>{const label=String(request.body.label||'').trim(),type=['text','number','status'].includes(request.body.columnType)?request.body.columnType:'text';if(!label)return response.status(400).json({error:'יש להזין שם עמודה'});const key=`custom_${Date.now()}`;const result=await pool.query('INSERT INTO project_system_columns(project_id,column_key,label,column_type,sort_order) VALUES($1,$2,$3,$4,(SELECT COUNT(*) FROM project_system_columns WHERE project_id=$1)) RETURNING *',[request.params.id,key,label,type]);response.status(201).json({column:result.rows[0]})});
  router.patch('/projects/:id/system-columns/:columnId',requireRoles('admin','manager'),async(request,response)=>{const type=['text','number','status'].includes(request.body.columnType)?request.body.columnType:'text',label=String(request.body.label||'').trim();if(!label)return response.status(400).json({error:'יש להזין שם עמודה'});const result=await pool.query('UPDATE project_system_columns SET label=$1,column_type=$2 WHERE id=$3 AND project_id=$4 RETURNING *',[label,type,request.params.columnId,request.params.id]);response.json({column:result.rows[0]})});
  router.patch('/projects/:id/system-fields',requireRoles('admin','manager'),async(request,response)=>{const fields=Array.isArray(request.body.fields)?request.body.fields:[];for(let index=0;index<fields.length;index++){const field=fields[index],key=String(field.key||'').trim(),label=String(field.label||'').trim();if(!key||!label)continue;await pool.query(`INSERT INTO project_system_field_settings(project_id,field_key,label,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,field_key) DO UPDATE SET label=EXCLUDED.label,sort_order=EXCLUDED.sort_order`,[request.params.id,key,label,index])}response.sendStatus(204)});
  router.patch('/projects/:id/system-columns/order',requireRoles('admin','manager'),async(request,response)=>{const ids=(request.body.columnIds||[]).map(Number).filter(Boolean);for(let index=0;index<ids.length;index++)await pool.query('UPDATE project_system_columns SET sort_order=$1 WHERE id=$2 AND project_id=$3',[index,ids[index],request.params.id]);response.sendStatus(204)});
  router.delete('/projects/:id/system-columns/:columnId',requireRoles('admin','manager'),async(request,response)=>{await pool.query('DELETE FROM project_system_columns WHERE id=$1 AND project_id=$2',[request.params.columnId,request.params.id]);response.sendStatus(204)});

  router.get('/reports/overview', async (request, response) => {
    const reportQuery = async (name, sql, fallback) => {
      try {
        return (await pool.query(sql)).rows;
      } catch (error) {
        console.error(`PROJECTS report query failed [${name}]`, error.message);
        return fallback;
      }
    };
    const [stages, tasks, finance, financeProjects, managers, monthly, systems, components, projectSizes, contractorStages, deadlines, documents, aiUsage, aiUsageSummary,projectCategories] = await Promise.all([
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
      reportQuery('projectCategories', `SELECT project_category category,COALESCE(NULLIF(project_category_custom,''),'אחר') custom_name,COUNT(*)::int count FROM projects WHERE archived_at IS NULL GROUP BY project_category,project_category_custom ORDER BY count DESC`, []),
    ]);
    const canViewFinance=request.user.financeAccess!==false;
    response.json({
      stages:canViewFinance?stages:stages.map(({value: _value,...stage})=>stage),
      tasks,
      finance:canViewFinance?(finance[0] || { total: 0, paid: 0, open: 0 }):{ restricted:true,total:0,paid:0,open:0 },
      financeProjects:canViewFinance?financeProjects:[],
      managers,
      monthly:canViewFinance?monthly:[],
      systems, components, projectSizes, contractorStages, deadlines, documents, aiUsage,projectCategories,
      aiUsageSummary:aiUsageSummary[0] || { questions:0,insights:0,tokens:0,estimated_cost:0 },
    });
  });

  return router;
}
