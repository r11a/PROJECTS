import express from 'express';

const ACTIVE_TASKS = "('open','in_progress')";
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];

export async function executeAutomations({ pool, triggerType, entityType, entityId, context = {}, userId = null }) {
  const rules = await pool.query('SELECT * FROM automation_rules WHERE active=TRUE AND trigger_type=$1 ORDER BY id', [triggerType]);
  for (const rule of rules.rows) {
    const conditions = asObject(rule.conditions);
    if (conditions.stage && conditions.stage !== context.stage) continue;
    if (conditions.fromStage && conditions.fromStage !== context.fromStage) continue;
    if (conditions.status && conditions.status !== context.status) continue;
    if (conditions.fromStatus && conditions.fromStatus !== context.fromStatus) continue;
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const details = [];
      for (const action of asArray(rule.actions)) {
        if (action.type === 'create_task' && context.projectId && action.title) {
          const dueDays = Math.max(0, Number(action.dueDays) || 0);
          const created = await db.query(`INSERT INTO tasks(project_id,title,description,status,priority,start_date,due_date,task_type,critical,created_by)
            VALUES($1,$2,$3,'open',$4,CURRENT_DATE,CURRENT_DATE+$5::int,$6,$7,$8) RETURNING id`, [context.projectId,String(action.title).trim(),String(action.description||''),action.priority||'normal',dueDays,action.taskType||'task',Boolean(action.critical),userId]);
          details.push({ type:action.type, taskId:created.rows[0].id });
        } else if (action.type === 'notify_manager' && context.projectId) {
          const sent = await db.query(`INSERT INTO user_messages(sender_id,recipient_id,subject,body,linked_url)
            SELECT COALESCE($1,(SELECT id FROM users WHERE active=TRUE ORDER BY (role='admin') DESC,id LIMIT 1)),pr.linked_user_id,$2,$3,$4 FROM projects p JOIN professionals pr ON pr.id=p.manager_professional_id
            WHERE p.id=$5 AND pr.linked_user_id IS NOT NULL RETURNING id`, [userId,action.subject||'עדכון אוטומטי בפרויקט',action.body||rule.name,`?project=${encodeURIComponent(context.projectId)}`,context.projectId]);
          details.push({ type:action.type, messages:sent.rowCount });
        }
      }
      await db.query(`INSERT INTO automation_runs(rule_id,entity_type,entity_id,outcome,details) VALUES($1,$2,$3,'completed',$4)`, [rule.id,entityType,String(entityId),JSON.stringify(details)]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      await pool.query(`INSERT INTO automation_runs(rule_id,entity_type,entity_id,outcome,details) VALUES($1,$2,$3,'failed',$4)`, [rule.id,entityType,String(entityId),JSON.stringify({ error:error.message })]).catch(()=>{});
      console.error('Automation failed', rule.id, error);
    } finally { db.release(); }
  }
}

export function startAutomationScheduler({ pool }) {
  const run = async () => {
    const overdue = await pool.query(`SELECT t.id,t.project_id,t.title FROM tasks t
      WHERE t.status IN ${ACTIVE_TASKS} AND t.due_date<CURRENT_DATE
      AND NOT EXISTS(SELECT 1 FROM automation_runs ar JOIN automation_rules r ON r.id=ar.rule_id
        WHERE r.trigger_type='task_overdue' AND ar.entity_type='task' AND ar.entity_id=t.id::text
        AND ar.created_at::date=CURRENT_DATE)`);
    for (const task of overdue.rows) await executeAutomations({ pool,triggerType:'task_overdue',entityType:'task',entityId:task.id,context:{ projectId:task.project_id,title:task.title,status:'overdue' } });
  };
  const timer=setInterval(()=>run().catch(error=>console.error('Automation scheduler failed',error.message)),10*60*1000);
  timer.unref?.();
  setTimeout(()=>run().catch(error=>console.error('Initial automation scheduler failed',error.message)),15000).unref?.();
  return ()=>clearInterval(timer);
}

function healthFor(row) {
  let score = 100;
  const reasons = [];
  const take = (points, text) => { score -= points; reasons.push(text); };
  if (Number(row.critical_overdue) > 0) take(Math.min(35, Number(row.critical_overdue) * 15), `${row.critical_overdue} משימות קריטיות באיחור`);
  if (Number(row.overdue_tasks) > 0) take(Math.min(20, Number(row.overdue_tasks) * 4), `${row.overdue_tasks} משימות באיחור`);
  if (Number(row.delayed_milestones) > 0) take(Math.min(20, Number(row.delayed_milestones) * 10), `${row.delayed_milestones} אבני דרך בסיכון`);
  if (Number(row.overdue_payments) > 0) take(12, 'גבייה בפיגור');
  if (Number(row.installation_target) > 0 && Number(row.installation_actual) > Number(row.installation_target)) take(10, 'חריגה מיעד שעות התקנה');
  if (Number(row.programming_target) > 0 && Number(row.programming_actual) > Number(row.programming_target)) take(10, 'חריגה מיעד שעות תכנות');
  if (Number(row.days_without_update) > 14) take(8, `לא עודכן ${row.days_without_update} ימים`);
  score = Math.max(0, score);
  return { score, tone:score>=80?'good':score>=55?'warning':'risk', reasons:reasons.slice(0,5), nextAction:reasons[0]||'הפרויקט מתנהל ללא חריגות מהותיות' };
}

export function createProductivityRouter({ pool, authenticate, requireRoles, audit }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/my-work', async (request,response)=>{
    const tasks=await pool.query(`SELECT t.*,p.name project_name,COALESCE(assignee.display_name,u.display_name) assignee_name,owner.display_name owner_name,
      dependency.title dependency_title FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
      LEFT JOIN professionals assignee ON assignee.id=t.assignee_professional_id LEFT JOIN users u ON u.id=t.assignee_id
      LEFT JOIN professionals owner ON owner.id=t.owner_professional_id LEFT JOIN tasks dependency ON dependency.id=t.dependency_task_id
      WHERE t.status IN ${ACTIVE_TASKS} AND (t.assignee_id=$1 OR assignee.linked_user_id=$1 OR owner.linked_user_id=$1
        OR EXISTS(SELECT 1 FROM project_professionals pp JOIN professionals member ON member.id=pp.professional_id WHERE pp.project_id=t.project_id AND member.linked_user_id=$1))
      ORDER BY t.critical DESC,(t.due_date<CURRENT_DATE) DESC,t.due_date,t.priority DESC LIMIT 250`,[request.user.id]);
    const messages=await pool.query(`SELECT m.id,m.subject,m.body,m.linked_url,m.created_at,s.display_name sender_name FROM user_messages m JOIN users s ON s.id=m.sender_id WHERE m.recipient_id=$1 AND m.read_at IS NULL AND NOT ($1=ANY(m.hidden_for)) ORDER BY m.created_at DESC LIMIT 20`,[request.user.id]);
    const today=new Date().toISOString().slice(0,10);
    const sections={ overdue:[],today:[],upcoming:[],waiting:[] };
    for(const task of tasks.rows){const due=String(task.due_date).slice(0,10);if(task.dependency_task_id)sections.waiting.push(task);else if(due<today)sections.overdue.push(task);else if(due===today)sections.today.push(task);else sections.upcoming.push(task);}
    response.json({ sections, messages:messages.rows, stats:{ total:tasks.rowCount,overdue:sections.overdue.length,today:sections.today.length,waiting:sections.waiting.length } });
  });

  router.get('/saved-views',async(request,response)=>{const workspace=String(request.query.workspace||'tasks');const result=await pool.query('SELECT * FROM saved_views WHERE user_id=$1 AND workspace=$2 ORDER BY sort_order,created_at',[request.user.id,workspace]);response.json({views:result.rows});});
  router.post('/saved-views',async(request,response)=>{const name=String(request.body.name||'').trim();if(!name)return response.status(400).json({error:'יש להזין שם לתצוגה'});const result=await pool.query(`INSERT INTO saved_views(user_id,workspace,name,filters) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,workspace,name) DO UPDATE SET filters=EXCLUDED.filters RETURNING *`,[request.user.id,String(request.body.workspace||'tasks'),name,JSON.stringify(asObject(request.body.filters))]);response.status(201).json({view:result.rows[0]});});
  router.delete('/saved-views/:id',async(request,response)=>{await pool.query('DELETE FROM saved_views WHERE id=$1 AND user_id=$2',[request.params.id,request.user.id]);response.status(204).end();});

  router.get('/project-templates',async(_request,response)=>{const result=await pool.query(`SELECT t.*,(SELECT COUNT(*)::int FROM project_template_tasks x WHERE x.template_id=t.id) task_count FROM project_templates t ORDER BY active DESC,name`);const tasks=await pool.query('SELECT * FROM project_template_tasks ORDER BY template_id,position,id');response.json({templates:result.rows.map(item=>({...item,tasks:tasks.rows.filter(task=>String(task.template_id)===String(item.id))}))});});
  router.post('/project-templates',requireRoles('admin','manager'),async(request,response)=>{const name=String(request.body.name||'').trim();if(!name)return response.status(400).json({error:'שם התבנית הוא שדה חובה'});const result=await pool.query(`INSERT INTO project_templates(name,description,classification,default_stage,installation_hours_target,programming_hours_target,folder_structure,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[name,request.body.description||'',request.body.classification||'private_house',request.body.defaultStage||'waiting',Number(request.body.installationHoursTarget)||0,Number(request.body.programmingHoursTarget)||0,JSON.stringify(asArray(request.body.folderStructure)),request.user.id]);response.status(201).json({template:result.rows[0]});});
  router.patch('/project-templates/:id',requireRoles('admin','manager'),async(request,response)=>{const result=await pool.query(`UPDATE project_templates SET name=COALESCE($1,name),description=COALESCE($2,description),active=COALESCE($3,active),updated_at=NOW() WHERE id=$4 RETURNING *`,[request.body.name||null,request.body.description??null,typeof request.body.active==='boolean'?request.body.active:null,request.params.id]);response.json({template:result.rows[0]});});
  router.post('/project-templates/:id/tasks',requireRoles('admin','manager'),async(request,response)=>{const title=String(request.body.title||'').trim();if(!title)return response.status(400).json({error:'כותרת המשימה היא שדה חובה'});const result=await pool.query(`INSERT INTO project_template_tasks(template_id,title,description,start_offset_days,duration_days,priority,task_type,critical,dependency_position,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[request.params.id,title,request.body.description||'',Number(request.body.startOffsetDays)||0,Math.max(1,Number(request.body.durationDays)||1),request.body.priority||'normal',request.body.taskType||'task',Boolean(request.body.critical),request.body.dependencyPosition||null,Number(request.body.position)||0]);response.status(201).json({task:result.rows[0]});});
  router.delete('/project-templates/:templateId/tasks/:id',requireRoles('admin','manager'),async(request,response)=>{await pool.query('DELETE FROM project_template_tasks WHERE id=$1 AND template_id=$2',[request.params.id,request.params.templateId]);response.status(204).end();});
  router.post('/project-templates/:id/apply',requireRoles('admin','manager'),async(request,response)=>{
    const projectId=String(request.body.projectId||'');
    const db=await pool.connect();
    try {
      await db.query('BEGIN');
      const project=await db.query('SELECT template_id FROM projects WHERE id=$1 FOR UPDATE',[projectId]);
      if(!project.rowCount){await db.query('ROLLBACK');return response.status(404).json({error:'הפרויקט לא נמצא'});}
      if(project.rows[0].template_id){await db.query('ROLLBACK');return response.status(409).json({error:'כבר הוחלה תבנית על הפרויקט'});}
      const template=await db.query('SELECT * FROM project_templates WHERE id=$1 AND active=TRUE',[request.params.id]);
      if(!template.rowCount){await db.query('ROLLBACK');return response.status(404).json({error:'התבנית אינה זמינה'});}
      const tasks=await db.query('SELECT * FROM project_template_tasks WHERE template_id=$1 ORDER BY position,id',[request.params.id]);
      const start=request.body.startDate||new Date().toISOString().slice(0,10);const ids=[];
      for(const item of tasks.rows){const inserted=await db.query(`INSERT INTO tasks(project_id,title,description,status,priority,start_date,due_date,task_type,critical,created_by) VALUES($1,$2,$3,'open',$4,$5::date+$6::int,$5::date+$6::int+$7::int-1,$8,$9,$10) RETURNING id`,[projectId,item.title,item.description,item.priority,start,item.start_offset_days,item.duration_days,item.task_type,item.critical,request.user.id]);ids.push(inserted.rows[0].id);}
      for(let index=0;index<tasks.rows.length;index++){const dependency=Number(tasks.rows[index].dependency_position);if(dependency>0&&ids[dependency-1])await db.query('UPDATE tasks SET dependency_task_id=$1 WHERE id=$2',[ids[dependency-1],ids[index]]);}
      await db.query('UPDATE projects SET template_id=$1,installation_hours_target=CASE WHEN installation_hours_target=0 THEN $2 ELSE installation_hours_target END,programming_hours_target=CASE WHEN programming_hours_target=0 THEN $3 ELSE programming_hours_target END,updated_at=NOW() WHERE id=$4',[request.params.id,template.rows[0].installation_hours_target,template.rows[0].programming_hours_target,projectId]);
      await db.query('COMMIT');
      await audit(request,'apply','project_template',request.params.id,{projectId,tasks:ids.length});
      response.json({createdTasks:ids.length});
    } catch(error){await db.query('ROLLBACK');throw error;} finally {db.release();}
  });
  router.get('/automation-rules',requireRoles('admin','manager'),async(_request,response)=>{const [rules,runs]=await Promise.all([pool.query('SELECT * FROM automation_rules ORDER BY active DESC,created_at DESC'),pool.query(`SELECT r.*,a.name rule_name FROM automation_runs r LEFT JOIN automation_rules a ON a.id=r.rule_id ORDER BY r.created_at DESC LIMIT 30`)]);response.json({rules:rules.rows,runs:runs.rows});});
  router.post('/automation-rules',requireRoles('admin','manager'),async(request,response)=>{const result=await pool.query(`INSERT INTO automation_rules(name,trigger_type,conditions,actions,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,[String(request.body.name||'').trim(),request.body.triggerType,JSON.stringify(asObject(request.body.conditions)),JSON.stringify(asArray(request.body.actions)),request.user.id]);response.status(201).json({rule:result.rows[0]});});
  router.patch('/automation-rules/:id',requireRoles('admin','manager'),async(request,response)=>{const result=await pool.query(`UPDATE automation_rules SET name=COALESCE($1,name),active=COALESCE($2,active),conditions=COALESCE($3,conditions),actions=COALESCE($4,actions),updated_at=NOW() WHERE id=$5 RETURNING *`,[request.body.name||null,typeof request.body.active==='boolean'?request.body.active:null,request.body.conditions?JSON.stringify(request.body.conditions):null,request.body.actions?JSON.stringify(request.body.actions):null,request.params.id]);response.json({rule:result.rows[0]});});
  router.delete('/automation-rules/:id',requireRoles('admin'),async(request,response)=>{await pool.query('DELETE FROM automation_rules WHERE id=$1',[request.params.id]);response.status(204).end();});

  router.get('/portfolio-health',async(_request,response)=>{const result=await pool.query(`SELECT p.id,p.name,p.stage,p.progress,p.manager,p.installation_hours_target installation_target,p.programming_hours_target programming_target,
    (CURRENT_DATE-p.updated_at::date)::int days_without_update,
    (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id=p.id AND t.status IN ${ACTIVE_TASKS} AND t.due_date<CURRENT_DATE) overdue_tasks,
    (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id=p.id AND t.status IN ${ACTIVE_TASKS} AND t.due_date<CURRENT_DATE AND t.critical) critical_overdue,
    (SELECT COUNT(*)::int FROM project_milestones m WHERE m.project_id=p.id AND (m.status='delayed' OR (m.status<>'completed' AND m.due_date<CURRENT_DATE))) delayed_milestones,
    (SELECT COUNT(*)::int FROM project_payments pay WHERE pay.project_id=p.id AND pay.status='pending' AND pay.due_date<CURRENT_DATE) overdue_payments,
    COALESCE((SELECT SUM(e.hours) FROM project_time_entries e WHERE e.project_id=p.id AND e.activity_type='installation'),0) installation_actual,
    COALESCE((SELECT SUM(e.hours) FROM project_time_entries e WHERE e.project_id=p.id AND e.activity_type='programming'),0) programming_actual
    FROM projects p WHERE p.archived_at IS NULL ORDER BY p.name`);response.json({projects:result.rows.map(row=>({...row,health:healthFor(row)}))});});
  router.get('/resource-workload',async(_request,response)=>{const result=await pool.query(`SELECT p.id,p.display_name,p.color,p.linked_user_id,COALESCE(u.weekly_capacity_hours,40) weekly_capacity_hours,
    COALESCE(SUM(t.estimated_hours) FILTER(WHERE t.status IN ${ACTIVE_TASKS} AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+13),0) allocated_hours,
    COUNT(t.id) FILTER(WHERE t.status IN ${ACTIVE_TASKS} AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+13)::int task_count,
    COUNT(t.id) FILTER(WHERE t.status IN ${ACTIVE_TASKS} AND t.due_date<CURRENT_DATE)::int overdue_count
    FROM professionals p LEFT JOIN users u ON u.id=p.linked_user_id LEFT JOIN tasks t ON t.assignee_professional_id=p.id
    WHERE p.active=TRUE AND p.affiliation='company' GROUP BY p.id,u.weekly_capacity_hours ORDER BY p.display_name`);response.json({resources:result.rows.map(row=>({...row,capacity_hours:Number(row.weekly_capacity_hours)*2,utilization:Number(row.weekly_capacity_hours)>0?Math.round(Number(row.allocated_hours)/(Number(row.weekly_capacity_hours)*2)*100):0}))});});

  router.get('/projects/:id/baselines',async(request,response)=>{const result=await pool.query('SELECT * FROM project_baselines WHERE project_id=$1 ORDER BY created_at DESC',[request.params.id]);response.json({baselines:result.rows});});
  router.post('/projects/:id/baselines',requireRoles('admin','manager'),async(request,response)=>{const snapshot=await pool.query(`SELECT jsonb_build_object('project',(SELECT to_jsonb(p) FROM projects p WHERE p.id=$1),'tasks',COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM tasks t WHERE t.project_id=$1),'[]'),'milestones',COALESCE((SELECT jsonb_agg(m ORDER BY m.id) FROM project_milestones m WHERE m.project_id=$1),'[]')) snapshot`,[request.params.id]);const result=await pool.query('INSERT INTO project_baselines(project_id,label,snapshot,created_by) VALUES($1,$2,$3,$4) RETURNING *',[request.params.id,String(request.body.label||'Baseline ראשי'),snapshot.rows[0].snapshot,request.user.id]);response.status(201).json({baseline:result.rows[0]});});
  router.get('/projects/:id/change-requests',async(request,response)=>{const result=await pool.query(`SELECT c.*,creator.display_name created_by_name,approver.display_name approved_by_name FROM project_change_requests c LEFT JOIN users creator ON creator.id=c.created_by LEFT JOIN users approver ON approver.id=c.approved_by WHERE c.project_id=$1 ORDER BY c.created_at DESC`,[request.params.id]);response.json({changes:result.rows});});
  router.post('/projects/:id/change-requests',requireRoles('admin','manager','technician'),async(request,response)=>{const result=await pool.query(`INSERT INTO project_change_requests(project_id,title,description,status,price_impact,schedule_impact_days,requested_by,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[request.params.id,String(request.body.title||'').trim(),request.body.description||'',request.body.status||'draft',Number(request.body.priceImpact)||0,Number(request.body.scheduleImpactDays)||0,request.body.requestedBy||'',request.user.id]);response.status(201).json({change:result.rows[0]});});
  router.patch('/projects/:projectId/change-requests/:id',requireRoles('admin','manager'),async(request,response)=>{const status=request.body.status;const result=await pool.query(`UPDATE project_change_requests SET title=COALESCE($1,title),description=COALESCE($2,description),status=COALESCE($3,status),price_impact=COALESCE($4,price_impact),schedule_impact_days=COALESCE($5,schedule_impact_days),decision_notes=COALESCE($6,decision_notes),approved_by=CASE WHEN $3='approved' THEN $7 ELSE approved_by END,approved_at=CASE WHEN $3='approved' THEN NOW() ELSE approved_at END,updated_at=NOW() WHERE id=$8 AND project_id=$9 RETURNING *`,[request.body.title||null,request.body.description??null,status||null,request.body.priceImpact??null,request.body.scheduleImpactDays??null,request.body.decisionNotes??null,request.user.id,request.params.id,request.params.projectId]);response.json({change:result.rows[0]});});
  return router;
}
