import express from 'express';

const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'];
const MILESTONE_STATUSES = ['planned', 'in_progress', 'completed', 'delayed'];
const PAYMENT_STATUSES = ['pending', 'paid', 'cancelled'];

async function syncProjectMetrics(pool, projectId) {
  if (!projectId) return;
  await pool.query(`UPDATE projects p SET
    paid=COALESCE((SELECT SUM(amount) FROM project_payments WHERE project_id=p.id AND status='paid'),0),
    tasks_total=(SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status<>'cancelled'),
    tasks_done=(SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status='done'),
    updated_at=NOW() WHERE p.id=$1`, [projectId]);
}

export function createOperationsRouter({ pool, authenticate, requireRoles, audit }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/operations/tasks', async (request, response) => {
    const q = String(request.query.q || '').trim();
    const status = String(request.query.status || '');
    const projectId = String(request.query.projectId || '');
    const result = await pool.query(`SELECT t.*,p.name project_name,c.name client_name,dependency.title dependency_title,
      COALESCE(pr.display_name,u.display_name) assignee_name,pr.color assignee_color
      FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN clients c ON c.id=t.client_id
      LEFT JOIN professionals pr ON pr.id=t.assignee_professional_id LEFT JOIN users u ON u.id=t.assignee_id LEFT JOIN tasks dependency ON dependency.id=t.dependency_task_id
      WHERE ($1='' OR concat_ws(' ',t.title,t.description,p.name,c.name,pr.display_name,u.display_name) ILIKE $2)
        AND ($3='' OR t.status=$3) AND ($4='' OR t.project_id=$4)
      ORDER BY (t.status IN ('done','cancelled')),t.due_date NULLS LAST,t.priority DESC,t.created_at DESC`, [q, `%${q}%`, status, projectId]);
    response.json({ tasks: result.rows });
  });

  router.post('/operations/tasks', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const title = String(request.body.title || '').trim();
    if (!title || !request.body.dueDate || (!request.body.projectId && !request.body.clientId)) return response.status(400).json({ error: 'כותרת, תאריך יעד ופרויקט או לקוח הם שדות חובה' });
    if (request.body.startDate && request.body.startDate > request.body.dueDate) return response.status(400).json({ error: 'תאריך ההתחלה אינו יכול להיות אחרי תאריך היעד' });
    if (request.body.dependencyTaskId) { const dependency=await pool.query("SELECT project_id,status FROM tasks WHERE id=$1",[request.body.dependencyTaskId]); if(!dependency.rowCount||dependency.rows[0].project_id!==request.body.projectId||!['open','in_progress'].includes(dependency.rows[0].status))return response.status(400).json({error:'משימת התלות חייבת להיות פתוחה או בביצוע ובאותו פרויקט'}); }
    const result = await pool.query(`INSERT INTO tasks(client_id,project_id,title,description,status,priority,assignee_professional_id,start_date,due_date,estimated_hours,task_type,dependency_task_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [request.body.clientId || null, request.body.projectId || null, title, request.body.description || '', TASK_STATUSES.includes(request.body.status) ? request.body.status : 'open', request.body.priority || 'normal', request.body.assigneeProfessionalId || null, request.body.startDate || request.body.dueDate, request.body.dueDate, Number(request.body.estimatedHours) || 0, request.body.taskType || 'task', request.body.dependencyTaskId || null, request.user.id]);
    await syncProjectMetrics(pool, request.body.projectId);
    await audit(request, 'create', 'task', String(result.rows[0].id), { title, projectId: request.body.projectId });
    response.status(201).json({ task: result.rows[0] });
  });

  router.patch('/operations/tasks/:id', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const current = await pool.query('SELECT * FROM tasks WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'המשימה לא נמצאה' });
    const row = current.rows[0];
    const status = TASK_STATUSES.includes(request.body.status) ? request.body.status : row.status;
    const nextStart = request.body.startDate ?? row.start_date; const nextDue = request.body.dueDate ?? row.due_date;
    if(String(request.body.dependencyTaskId||'')===String(request.params.id))return response.status(400).json({error:'משימה אינה יכולה להיות תלויה בעצמה'});
    if(request.body.dependencyTaskId){const dependency=await pool.query("SELECT project_id,status FROM tasks WHERE id=$1",[request.body.dependencyTaskId]);if(!dependency.rowCount||dependency.rows[0].project_id!==row.project_id||!['open','in_progress'].includes(dependency.rows[0].status))return response.status(400).json({error:'משימת התלות חייבת להיות פתוחה או בביצוע ובאותו פרויקט'});}
    if (nextStart && nextDue && String(nextStart).slice(0,10) > String(nextDue).slice(0,10)) return response.status(400).json({ error: 'תאריך ההתחלה אינו יכול להיות אחרי תאריך היעד' });
    const result = await pool.query(`UPDATE tasks SET title=$1,description=$2,status=$3,priority=$4,assignee_professional_id=$5,start_date=$6,due_date=$7,estimated_hours=$8,task_type=$9,dependency_task_id=$10,
      completed_at=CASE WHEN $3='done' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$11 RETURNING *`, [request.body.title ?? row.title, request.body.description ?? row.description, status, request.body.priority ?? row.priority, request.body.assigneeProfessionalId ?? row.assignee_professional_id, request.body.startDate ?? row.start_date, request.body.dueDate ?? row.due_date, request.body.estimatedHours ?? row.estimated_hours, request.body.taskType ?? row.task_type, request.body.dependencyTaskId ?? row.dependency_task_id, request.params.id]);
    await syncProjectMetrics(pool, row.project_id);
    await audit(request, 'update', 'task', request.params.id, request.body);
    response.json({ task: result.rows[0] });
  });

  router.delete('/operations/tasks/:id', requireRoles('admin'), async (request, response) => {
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
    const result = await pool.query(`UPDATE project_milestones SET title=$1,due_date=$2,status=$3,progress=$4,owner_professional_id=$5,description=$6,
      completed_at=CASE WHEN $3='completed' THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$7 RETURNING *`, [request.body.title ?? row.title, request.body.dueDate ?? row.due_date, status, Number(request.body.progress ?? row.progress), request.body.ownerProfessionalId ?? row.owner_professional_id, request.body.description ?? row.description, request.params.id]);
    await audit(request, 'update', 'milestone', request.params.id, request.body); response.json({ milestone: result.rows[0] });
  });

  router.delete('/operations/milestones/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM project_milestones WHERE id=$1 RETURNING title', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'אבן הדרך לא נמצאה' });
    await audit(request, 'delete', 'milestone', request.params.id, { title: result.rows[0].title }); response.status(204).end();
  });

  router.get('/operations/payments', async (request, response) => {
    const projectId = String(request.query.projectId || '');
    const result = await pool.query(`SELECT pay.*,p.name project_name,p.client,p.value project_value,u.display_name created_by_name FROM project_payments pay JOIN projects p ON p.id=pay.project_id LEFT JOIN users u ON u.id=pay.created_by WHERE ($1='' OR pay.project_id=$1) ORDER BY (pay.status='paid'),pay.due_date NULLS LAST,pay.created_at DESC`, [projectId]);
    response.json({ payments: result.rows });
  });

  router.post('/operations/payments', requireRoles('admin', 'manager', 'finance'), async (request, response) => {
    const title = String(request.body.title || '').trim(); const amount = Number(request.body.amount);
    if (!request.body.projectId || !title || !(amount >= 0)) return response.status(400).json({ error: 'פרויקט, תיאור וסכום תקין הם שדות חובה' });
    const status = PAYMENT_STATUSES.includes(request.body.status) ? request.body.status : 'pending';
    const result = await pool.query(`INSERT INTO project_payments(project_id,title,amount,due_date,status,paid_at,reference,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [request.body.projectId, title, amount, request.body.dueDate || null, status, status === 'paid' ? (request.body.paidAt || new Date()) : null, request.body.reference || '', request.body.notes || '', request.user.id]);
    await syncProjectMetrics(pool, request.body.projectId); await audit(request, 'create', 'payment', String(result.rows[0].id), { title, amount }); response.status(201).json({ payment: result.rows[0] });
  });

  router.patch('/operations/payments/:id', requireRoles('admin', 'manager', 'finance'), async (request, response) => {
    const current = await pool.query('SELECT * FROM project_payments WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'התשלום לא נמצא' });
    const row = current.rows[0]; const status = PAYMENT_STATUSES.includes(request.body.status) ? request.body.status : row.status;
    const result = await pool.query(`UPDATE project_payments SET title=$1,amount=$2,due_date=$3,status=$4,paid_at=$5,reference=$6,notes=$7,updated_at=NOW() WHERE id=$8 RETURNING *`, [request.body.title ?? row.title, request.body.amount ?? row.amount, request.body.dueDate ?? row.due_date, status, status === 'paid' ? (request.body.paidAt || row.paid_at || new Date()) : null, request.body.reference ?? row.reference, request.body.notes ?? row.notes, request.params.id]);
    await syncProjectMetrics(pool, row.project_id); await audit(request, 'update', 'payment', request.params.id, request.body); response.json({ payment: result.rows[0] });
  });

  router.delete('/operations/payments/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM project_payments WHERE id=$1 RETURNING project_id,title', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'התשלום לא נמצא' });
    await syncProjectMetrics(pool, result.rows[0].project_id); await audit(request, 'delete', 'payment', request.params.id, { title: result.rows[0].title }); response.status(204).end();
  });

  router.get('/projects/:id/workspace', async (request, response) => {
    const id = request.params.id;
    const [tasks, milestones, payments, team, equipment, forms, files, updates, activity] = await Promise.all([
      pool.query(`SELECT t.*,pr.display_name assignee_name,pr.color assignee_color,dependency.title dependency_title FROM tasks t LEFT JOIN professionals pr ON pr.id=t.assignee_professional_id LEFT JOIN tasks dependency ON dependency.id=t.dependency_task_id WHERE t.project_id=$1 ORDER BY (t.status='done'),t.due_date`, [id]),
      pool.query(`SELECT m.*,pr.display_name owner_name FROM project_milestones m LEFT JOIN professionals pr ON pr.id=m.owner_professional_id WHERE m.project_id=$1 ORDER BY (m.status='completed'),m.due_date`, [id]),
      pool.query('SELECT * FROM project_payments WHERE project_id=$1 ORDER BY due_date NULLS LAST,created_at DESC', [id]),
      pool.query(`SELECT pp.*,p.display_name,p.phone,p.email,p.color,p.icon,r.name role_name,r.role_key FROM project_professionals pp JOIN professionals p ON p.id=pp.professional_id JOIN professional_role_types r ON r.id=pp.role_type_id WHERE pp.project_id=$1 ORDER BY pp.is_primary DESC,r.sort_order,p.display_name`, [id]),
      pool.query(`SELECT pe.*,e.name,e.item_type,e.manufacturer,e.model,e.unit,e.color,e.icon FROM project_equipment pe JOIN equipment_catalog e ON e.id=pe.catalog_item_id WHERE pe.project_id=$1 ORDER BY e.item_type,e.name`, [id]),
      pool.query(`SELECT fr.*,ft.name template_name FROM form_records fr JOIN form_templates ft ON ft.id=fr.template_id WHERE fr.project_id=$1 ORDER BY fr.updated_at DESC`, [id]),
      pool.query('SELECT * FROM client_files WHERE project_id=$1 ORDER BY created_at DESC', [id]),
      pool.query('SELECT pu.*,u.display_name created_by_name,u.avatar_color FROM project_updates pu LEFT JOIN users u ON u.id=pu.created_by WHERE pu.project_id=$1 ORDER BY pu.created_at DESC', [id]),
      pool.query(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE (a.entity_type='project' AND a.entity_id=$1) OR (a.details->>'projectId'=$1) ORDER BY a.created_at DESC LIMIT 100`, [id]),
    ]);
    response.json({ tasks: tasks.rows, milestones: milestones.rows, payments: payments.rows, team: team.rows, equipment: equipment.rows, forms: forms.rows, files: files.rows, updates: updates.rows, activity: activity.rows });
  });

  router.post('/projects/:id/updates', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const body = String(request.body.body || '').trim(); if (!body) return response.status(400).json({ error: 'יש לכתוב תוכן לעדכון' });
    const result = await pool.query('INSERT INTO project_updates(project_id,body,created_by) VALUES($1,$2,$3) RETURNING *', [request.params.id, body, request.user.id]);
    await audit(request, 'create', 'project_update', String(result.rows[0].id), { projectId: request.params.id }); response.status(201).json({ update: result.rows[0] });
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

  router.get('/reports/overview', async (_request, response) => {
    const reportQuery = async (name, sql, fallback) => {
      try {
        return (await pool.query(sql)).rows;
      } catch (error) {
        console.error(`PROJECTS report query failed [${name}]`, error.message);
        return fallback;
      }
    };
    const [stages, tasks, finance, managers, monthly] = await Promise.all([
      reportQuery('stages', 'SELECT stage,COUNT(*)::int count,COALESCE(SUM(value),0)::numeric value FROM projects GROUP BY stage ORDER BY count DESC', []),
      reportQuery('tasks', 'SELECT status,COUNT(*)::int count FROM tasks GROUP BY status', []),
      reportQuery('finance', 'SELECT COALESCE(SUM(value),0)::numeric total,COALESCE(SUM(paid),0)::numeric paid,COALESCE(SUM(value-paid),0)::numeric AS "open" FROM projects', [{ total: 0, paid: 0, open: 0 }]),
      reportQuery('managers', `SELECT COALESCE(NULLIF(pr.display_name,''),NULLIF(p.manager,''),'ללא מנהל') name,COUNT(*)::int projects,COALESCE(ROUND(AVG(p.progress)),0)::int progress
        FROM projects p LEFT JOIN professionals pr ON pr.id=p.manager_professional_id
        GROUP BY pr.id,pr.display_name,p.manager ORDER BY COUNT(*) DESC`, []),
      reportQuery('monthly', `SELECT to_char(date_trunc('month',COALESCE(paid_at,due_date)::timestamp),'YYYY-MM') month,COALESCE(SUM(amount),0)::numeric amount,status
        FROM project_payments WHERE COALESCE(paid_at,due_date) IS NOT NULL GROUP BY 1,status ORDER BY 1`, []),
    ]);
    response.json({ stages, tasks, finance: finance[0] || { total: 0, paid: 0, open: 0 }, managers, monthly });
  });

  return router;
}
