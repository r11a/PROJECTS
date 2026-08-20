import express from 'express';
import { loadProjectHealth } from './projectIntelligence.js';

const ACTIVE_TASKS = "('open','in_progress')";
const AUTOMATION_TRIGGER_TYPES = ["project_created","project_stage_changed","task_created","task_status_changed","task_overdue"];
const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];
const toBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const normalizeTriggerTypes = (raw) => {
  const list = asArray(raw);
  const deduped = [];
  const bucket = new Set();
  for (const rawValue of list) {
    const value = String(rawValue || "").trim();
    if (!AUTOMATION_TRIGGER_TYPES.includes(value) || bucket.has(value)) continue;
    bucket.add(value);
    deduped.push(value);
  }
  if (!deduped.length && String(raw).trim()) {
    const value = String(raw).trim();
    if (AUTOMATION_TRIGGER_TYPES.includes(value)) deduped.push(value);
  }
  return deduped.length ? deduped : ["task_overdue"];
};
const normalizeConditionValue = (value) => (value === null || value === undefined ? "" : String(value).trim());
const evaluateCondition = (condition = {}, context = {}) => {
  const field = String(condition.field || "").trim();
  if (!field) return false;
  const operator = String(condition.operator || "equals");
  const currentRaw = context[field];
  const expectedRaw = condition.value;
  const current = normalizeConditionValue(currentRaw);
  const expected = normalizeConditionValue(expectedRaw);

  if (operator === "blank") return current.length === 0;
  if (operator === "not_blank") return current.length > 0;

  if (operator === "contains") return current.includes(expected);
  if (operator === "not_contains") return !current.includes(expected);
  if (operator === "not_equals") return current !== expected;
  return current === expected;
};
const evaluateConditionGroup = (group = {}, context = {}) => {
  const logic = group.logic === "OR" ? "OR" : "AND";
  const list = asArray(group.conditions);
  if (!list.length) return false;
  if (logic === "OR") return list.some((condition) => evaluateCondition(condition, context));
  return list.every((condition) => evaluateCondition(condition, context));
};
const evaluateRuleConditions = (conditions, context = {}) => {
  if (!conditions || typeof conditions !== "object") return true;

  // Backward compatibility: old records stored as flat object.
  if (!Array.isArray(conditions.groups)) {
    const flat = asObject(conditions);
    return Object.entries(flat).every(([key, value]) => {
      if (value === undefined || value === null || String(value).trim() === "") return true;
      return evaluateCondition({ field: key, operator: "equals", value }, context);
    });
  }

  const logic = conditions.logic === "AND" ? "AND" : "OR";
  if (logic === "OR") return conditions.groups.some((group) => evaluateConditionGroup(group, context));
  return conditions.groups.every((group) => evaluateConditionGroup(group, context));
};
const mapAutomationConditionsForSave = (input = {}) => {
  const raw = asObject(input);
  const groups = asArray(raw.groups).map((group, groupIndex) => ({
    logic: group?.logic === "OR" ? "OR" : "AND",
    conditions: asArray(group.conditions)
      .filter((item) => item && item.field !== "")
      .map((condition, index) => ({
        id: condition.id || `${groupIndex}-${index}`,
        field: String(condition.field || "status"),
        operator: String(condition.operator || "equals"),
        value: condition.value ?? "",
        order: Number.isFinite(Number(condition.order)) ? Number(condition.order) : index,
      })),
  })).filter((group) => group.conditions.length > 0);
  return {
    logic: raw.logic === "AND" ? "AND" : "OR",
    groups: groups.length ? groups : [{ logic: "AND", conditions: [{ field: "status", operator: "equals", value: "open", order: 0 }] }],
  };
};
const mapAutomationActionsForSave = (input = []) => asArray(input).map((action, index) => ({
  id: action.id || `${Date.now()}-${index}`,
  type: action.type || "create_task",
  title: action.title || "",
  description: action.description || "",
  dueDays: Number(action.dueDays) || 0,
  priority: action.priority || "normal",
  critical: toBoolean(action.critical),
  taskType: action.taskType || "task",
  targetStage: action.targetStage || "waiting",
  reason: action.reason || "",
  subject: action.subject || "",
  body: action.body || "",
  linkedUrl: action.linkedUrl || "",
  order: Number.isFinite(Number(action.order)) ? Number(action.order) : index,
}));

export async function executeAutomations({ pool, triggerType, entityType, entityId, context = {}, userId = null }) {
  const rules = await pool.query(
    "SELECT * FROM automation_rules WHERE active=TRUE AND (trigger_type=$1 OR COALESCE(trigger_types,'[]'::jsonb) ? $1) ORDER BY id",
    [triggerType],
  );
  for (const rule of rules.rows) {
    const conditions = mapAutomationConditionsForSave(rule.conditions);
    if (!evaluateRuleConditions(conditions, context)) continue;
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
        } else if (action.type === 'set_project_stage' && context.projectId) {
          const updated = await db.query('UPDATE projects SET stage=$1,updated_at=NOW() WHERE id=$2 RETURNING stage', [action.targetStage, context.projectId]);
          if (updated.rowCount) {
            details.push({ type: action.type, fromStage: context.stage || context.fromStage || null, toStage: action.targetStage, reason: action.reason || '' });
          }
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
        WHERE (r.trigger_type='task_overdue' OR COALESCE(r.trigger_types,'[]'::jsonb) ? 'task_overdue')
          AND ar.entity_type='task' AND ar.entity_id=t.id::text
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

function requestFinanceRow(row,user) {
  if (user?.financeAccess !== false) return row;
  return { ...row, overdue_payments:0 };
}

export function createProductivityRouter({ pool, authenticate, requireRoles, audit }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/my-work', async (request,response)=>{
    const tasks=await pool.query(`WITH identity_ids AS (
      SELECT id FROM users WHERE id=$1 OR merged_into_user_id=$1
    )
      SELECT t.*,p.name project_name,COALESCE(assignee.display_name,u.display_name) assignee_name,owner.display_name owner_name,
      dependency.title dependency_title,
      CASE
        WHEN t.assignee_id IN (SELECT id FROM identity_ids) OR assignee.linked_user_id IN (SELECT id FROM identity_ids)
          OR EXISTS(SELECT 1 FROM task_assignees ta JOIN professionals tap ON tap.id=ta.professional_id WHERE ta.task_id=t.id AND tap.linked_user_id IN (SELECT id FROM identity_ids)) THEN 'assignee'
        WHEN owner.linked_user_id IN (SELECT id FROM identity_ids) THEN 'owner'
        WHEN manager.linked_user_id IN (SELECT id FROM identity_ids) THEN 'manager'
        ELSE 'related'
      END relevance FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
      LEFT JOIN professionals assignee ON assignee.id=t.assignee_professional_id LEFT JOIN users u ON u.id=t.assignee_id
      LEFT JOIN professionals owner ON owner.id=t.owner_professional_id LEFT JOIN tasks dependency ON dependency.id=t.dependency_task_id
      LEFT JOIN professionals manager ON manager.id=p.manager_professional_id
      WHERE t.status IN ${ACTIVE_TASKS} AND (t.assignee_id IN (SELECT id FROM identity_ids)
        OR assignee.linked_user_id IN (SELECT id FROM identity_ids)
        OR EXISTS(SELECT 1 FROM task_assignees ta JOIN professionals tap ON tap.id=ta.professional_id WHERE ta.task_id=t.id AND tap.linked_user_id IN (SELECT id FROM identity_ids))
        OR owner.linked_user_id IN (SELECT id FROM identity_ids)
        OR manager.linked_user_id IN (SELECT id FROM identity_ids))
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
  router.post('/automation-rules',requireRoles('admin','manager'),async(request,response)=>{
    const triggerTypes = normalizeTriggerTypes(request.body.triggerTypes || request.body.triggerType || request.body.trigger_type);
    const conditions = mapAutomationConditionsForSave(request.body.conditions);
    const actions = mapAutomationActionsForSave(request.body.actions);
    const result=await pool.query(
      `INSERT INTO automation_rules(name,trigger_type,trigger_types,conditions,actions,created_by)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        String(request.body.name||'').trim(),
        triggerTypes[0],
        JSON.stringify(triggerTypes),
        JSON.stringify(conditions),
        JSON.stringify(actions),
        request.user.id,
      ],
    );
    response.status(201).json({rule:result.rows[0]});
  });
  router.patch('/automation-rules/:id',requireRoles('admin','manager'),async(request,response)=>{
    const triggerTypes = request.body.triggerTypes || request.body.triggerType || request.body.trigger_type;
    const normalizedTriggerTypes = triggerTypes === undefined ? null : normalizeTriggerTypes(triggerTypes);
    const update = [];
    const values = [];
    let index = 1;
    if (request.body.name !== undefined) { update.push(`name=$${index++}`); values.push(String(request.body.name||'').trim()); }
    if (normalizedTriggerTypes) {
      update.push(`trigger_type=$${index++}`, `trigger_types=$${index++}`);
      values.push(normalizedTriggerTypes[0], JSON.stringify(normalizedTriggerTypes));
    }
    if (request.body.conditions !== undefined) { update.push(`conditions=$${index++}`); values.push(JSON.stringify(mapAutomationConditionsForSave(request.body.conditions))); }
    if (request.body.actions !== undefined) { update.push(`actions=$${index++}`); values.push(JSON.stringify(mapAutomationActionsForSave(request.body.actions))); }
    if (typeof request.body.active === 'boolean') { update.push(`active=$${index++}`); values.push(request.body.active); }
    if (!update.length) return response.status(400).json({ error: 'לא נשלחו שדות לעדכון' });
    update.push('updated_at=NOW()');
    values.push(request.params.id);
    const result=await pool.query(
      `UPDATE automation_rules SET ${update.join(', ')} WHERE id=$${index} RETURNING *`,
      values,
    );
    response.json({rule:result.rows[0]});
  });
  router.delete('/automation-rules/:id',requireRoles('admin'),async(request,response)=>{await pool.query('DELETE FROM automation_rules WHERE id=$1',[request.params.id]);response.status(204).end();});

  router.get('/portfolio-health',async(request,response)=>{const projects=await loadProjectHealth(pool,request.user.financeAccess!==false);response.json({projects:projects.map(item=>({...item,health:{score:item.score,tone:item.tone==='green'?'good':item.tone==='yellow'?'warning':'risk',reasons:item.reasons.map(reason=>reason.label),nextAction:item.reasons[0]?.label||'הפרויקט מתנהל ללא חריגות מהותיות'}}))});});
  router.get('/resource-workload',async(_request,response)=>{const result=await pool.query(`SELECT p.id,p.display_name,p.color,p.linked_user_id,COALESCE(u.weekly_capacity_hours,40) weekly_capacity_hours,
    COALESCE(SUM(t.estimated_hours) FILTER(WHERE t.status IN ${ACTIVE_TASKS} AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+13),0) allocated_hours,
    COUNT(t.id) FILTER(WHERE t.status IN ${ACTIVE_TASKS} AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+13)::int task_count,
    COUNT(t.id) FILTER(WHERE t.status IN ${ACTIVE_TASKS} AND t.due_date<CURRENT_DATE)::int overdue_count
    FROM professionals p LEFT JOIN users u ON u.id=p.linked_user_id LEFT JOIN tasks t ON t.assignee_professional_id=p.id
    WHERE p.active=TRUE AND p.affiliation='company' GROUP BY p.id,u.weekly_capacity_hours ORDER BY p.display_name`);response.json({resources:result.rows.map(row=>({...row,capacity_hours:Number(row.weekly_capacity_hours)*2,utilization:Number(row.weekly_capacity_hours)>0?Math.round(Number(row.allocated_hours)/(Number(row.weekly_capacity_hours)*2)*100):0}))});});

  router.get('/projects/:id/baselines',async(request,response)=>{const result=await pool.query('SELECT * FROM project_baselines WHERE project_id=$1 ORDER BY created_at DESC',[request.params.id]);response.json({baselines:result.rows});});
  router.post('/projects/:id/baselines',requireRoles('admin','manager'),async(request,response)=>{const snapshot=await pool.query(`SELECT jsonb_build_object('project',(SELECT to_jsonb(p) FROM projects p WHERE p.id=$1),'tasks',COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM tasks t WHERE t.project_id=$1),'[]'),'milestones',COALESCE((SELECT jsonb_agg(m ORDER BY m.id) FROM project_milestones m WHERE m.project_id=$1),'[]')) snapshot`,[request.params.id]);const result=await pool.query('INSERT INTO project_baselines(project_id,label,snapshot,created_by) VALUES($1,$2,$3,$4) RETURNING *',[request.params.id,String(request.body.label||'Baseline ראשי'),snapshot.rows[0].snapshot,request.user.id]);response.status(201).json({baseline:result.rows[0]});});
  router.get('/projects/:id/change-requests',async(request,response)=>{const result=await pool.query(`SELECT c.*,creator.display_name created_by_name,approver.display_name approved_by_name FROM project_change_requests c LEFT JOIN users creator ON creator.id=c.created_by LEFT JOIN users approver ON approver.id=c.approved_by WHERE c.project_id=$1 ORDER BY c.created_at DESC`,[request.params.id]);response.json({changes:result.rows});});
  router.post('/projects/:id/change-requests',requireRoles('admin','manager','technician'),async(request,response)=>{const result=await pool.query(`INSERT INTO project_change_requests(project_id,title,description,status,price_impact,schedule_impact_days,requested_by,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[request.params.id,String(request.body.title||'').trim(),request.body.description||'',request.body.status||'draft',request.user.financeAccess===false?0:Number(request.body.priceImpact)||0,Number(request.body.scheduleImpactDays)||0,request.body.requestedBy||'',request.user.id]);response.status(201).json({change:result.rows[0]});});
  router.patch('/projects/:projectId/change-requests/:id',requireRoles('admin','manager'),async(request,response)=>{const status=request.body.status;const result=await pool.query(`UPDATE project_change_requests SET title=COALESCE($1,title),description=COALESCE($2,description),status=COALESCE($3,status),price_impact=COALESCE($4,price_impact),schedule_impact_days=COALESCE($5,schedule_impact_days),decision_notes=COALESCE($6,decision_notes),approved_by=CASE WHEN $3='approved' THEN $7 ELSE approved_by END,approved_at=CASE WHEN $3='approved' THEN NOW() ELSE approved_at END,updated_at=NOW() WHERE id=$8 AND project_id=$9 RETURNING *`,[request.body.title||null,request.body.description??null,status||null,request.user.financeAccess===false?null:request.body.priceImpact??null,request.body.scheduleImpactDays??null,request.body.decisionNotes??null,request.user.id,request.params.id,request.params.projectId]);response.json({change:result.rows[0]});});
  return router;
}
