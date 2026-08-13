import express from 'express';

const TEMPLATE_CATEGORIES = ['general', 'inspection', 'handover', 'infrastructure', 'change_order'];
const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'checkbox', 'select', 'phone', 'email'];
const STATUSES = ['draft', 'completed', 'approved'];

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((field, index) => ({
    id: String(field.id || `field_${index + 1}`).trim().replace(/[^A-Za-z0-9_]/g, '_'),
    label: String(field.label || '').trim(),
    type: FIELD_TYPES.includes(field.type) ? field.type : 'text',
    required: Boolean(field.required),
    options: Array.isArray(field.options) ? field.options.map(String).map((value) => value.trim()).filter(Boolean) : [],
  })).filter((field) => field.id && field.label);
}

function templateFromRow(row) {
  return { id: row.id, name: row.name, description: row.description, category: row.category, color: row.color, icon: row.icon, fields: row.fields || [], active: row.active, version: row.version, useCount: Number(row.use_count || 0), createdAt: row.created_at, updatedAt: row.updated_at };
}

function recordFromRow(row) {
  return { id: row.id, templateId: row.template_id, templateName: row.template_name, templateFields: row.template_fields || [], clientId: row.client_id, clientName: row.client_name, projectId: row.project_id, projectName: row.project_name, title: row.title, status: row.status, values: row.values || {}, notes: row.notes, scheduledFor: row.scheduled_for, createdByName: row.created_by_name, completedByName: row.completed_by_name, approvedByName: row.approved_by_name, completedAt: row.completed_at, approvedAt: row.approved_at, createdAt: row.created_at, updatedAt: row.updated_at };
}

function missingRequired(fields, values) {
  return fields.filter((field) => field.required).filter((field) => values[field.id] === undefined || values[field.id] === null || values[field.id] === '' || (field.type === 'checkbox' && values[field.id] !== true)).map((field) => field.label);
}

export function createFormsRouter({ pool, authenticate, requireRoles, audit }) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/forms', async (request, response) => {
    const query = String(request.query.q || '').trim();
    const status = STATUSES.includes(request.query.status) ? request.query.status : '';
    const [templates, records, clients, projects, files] = await Promise.all([
      pool.query(`SELECT t.*,COUNT(r.id)::int use_count FROM form_templates t LEFT JOIN form_records r ON r.template_id=t.id GROUP BY t.id ORDER BY t.active DESC,t.updated_at DESC,t.name`),
      pool.query(`SELECT r.*,t.name template_name,c.name client_name,p.name project_name,creator.display_name created_by_name,completer.display_name completed_by_name,approver.display_name approved_by_name
        FROM form_records r JOIN form_templates t ON t.id=r.template_id LEFT JOIN clients c ON c.id=r.client_id LEFT JOIN projects p ON p.id=r.project_id LEFT JOIN users creator ON creator.id=r.created_by LEFT JOIN users completer ON completer.id=r.completed_by LEFT JOIN users approver ON approver.id=r.approved_by
        WHERE ($1='' OR concat_ws(' ',r.title,t.name,c.name,p.name,r.notes,r.values::text) ILIKE $2) AND ($3='' OR r.status=$3)
        ORDER BY r.updated_at DESC LIMIT 250`, [query, `%${query}%`, status]),
      pool.query('SELECT id,name,code FROM clients ORDER BY name'),
      pool.query('SELECT id,name,client_id FROM projects ORDER BY name'),
      pool.query(`SELECT f.id,f.original_name,f.mime_type,f.size_bytes,f.created_at,f.category,f.title,c.name client_name,p.name project_name,COALESCE(u.display_name,u.username,'מערכת') uploaded_by_name
        FROM client_files f LEFT JOIN clients c ON c.id=f.client_id LEFT JOIN projects p ON p.id=f.project_id LEFT JOIN users u ON u.id=f.uploaded_by
        WHERE f.deleted_at IS NULL AND ($1='' OR concat_ws(' ',f.original_name,f.title,f.category,c.name,p.name) ILIKE $2)
        ORDER BY f.created_at DESC LIMIT 80`, [query, `%${query}%`]),
    ]);
    response.json({ templates: templates.rows.map(templateFromRow), records: records.rows.map(recordFromRow), clients: clients.rows, projects: projects.rows, files: files.rows });
  });

  router.post('/form-templates', requireRoles('admin', 'manager'), async (request, response) => {
    const name = String(request.body.name || '').trim();
    const fields = normalizeFields(request.body.fields);
    if (!name) return response.status(400).json({ error: 'שם התבנית הוא שדה חובה' });
    if (!fields.length) return response.status(400).json({ error: 'יש להוסיף לפחות שדה אחד לתבנית' });
    const result = await pool.query(`INSERT INTO form_templates(name,description,category,color,icon,fields,active,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [name, request.body.description || '', TEMPLATE_CATEGORIES.includes(request.body.category) ? request.body.category : 'general', request.body.color || '#6957df', request.body.icon || 'clipboard-check', JSON.stringify(fields), request.body.active ?? true, request.user.id]);
    await audit(request, 'create', 'form_template', String(result.rows[0].id), { name });
    response.status(201).json({ template: templateFromRow(result.rows[0]) });
  });

  router.patch('/form-templates/:id', requireRoles('admin', 'manager'), async (request, response) => {
    const current = await pool.query('SELECT * FROM form_templates WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'התבנית לא נמצאה' });
    const fields = request.body.fields === undefined ? current.rows[0].fields : normalizeFields(request.body.fields);
    if (!fields.length) return response.status(400).json({ error: 'יש להשאיר לפחות שדה אחד בתבנית' });
    if (!String(request.body.name ?? current.rows[0].name).trim()) return response.status(400).json({ error: 'שם התבנית הוא שדה חובה' });
    const result = await pool.query(`UPDATE form_templates SET name=$1,description=$2,category=$3,color=$4,icon=$5,fields=$6,active=$7,version=version+1,updated_at=NOW() WHERE id=$8 RETURNING *`, [String(request.body.name ?? current.rows[0].name).trim(), request.body.description ?? current.rows[0].description, TEMPLATE_CATEGORIES.includes(request.body.category) ? request.body.category : current.rows[0].category, request.body.color || current.rows[0].color, request.body.icon || current.rows[0].icon, JSON.stringify(fields), request.body.active ?? current.rows[0].active, request.params.id]);
    await audit(request, 'update', 'form_template', request.params.id, { name: result.rows[0].name, version: result.rows[0].version });
    response.json({ template: templateFromRow(result.rows[0]) });
  });

  router.delete('/form-templates/:id', requireRoles('admin'), async (request, response) => {
    const used = await pool.query('SELECT COUNT(*)::int count FROM form_records WHERE template_id=$1', [request.params.id]);
    if (used.rows[0].count) return response.status(409).json({ error: 'לא ניתן למחוק תבנית שכבר מולאה; אפשר להשבית אותה' });
    const result = await pool.query('DELETE FROM form_templates WHERE id=$1 RETURNING id,name', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'התבנית לא נמצאה' });
    await audit(request, 'delete', 'form_template', request.params.id, { name: result.rows[0].name });
    response.status(204).end();
  });

  router.post('/form-records', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const template = await pool.query('SELECT * FROM form_templates WHERE id=$1 AND active=TRUE', [request.body.templateId]);
    if (!template.rowCount) return response.status(404).json({ error: 'התבנית אינה זמינה' });
    const status = STATUSES.includes(request.body.status) ? request.body.status : 'draft';
    if (status === 'approved' && !['admin', 'manager'].includes(request.user.role)) return response.status(403).json({ error: 'רק מנהל יכול לאשר טופס' });
    const values = request.body.values && typeof request.body.values === 'object' ? request.body.values : {};
    const missing = status === 'draft' ? [] : missingRequired(template.rows[0].fields, values);
    if (missing.length) return response.status(400).json({ error: `חסרים שדות חובה: ${missing.join(', ')}` });
    const title = String(request.body.title || template.rows[0].name).trim();
    const result = await pool.query(`INSERT INTO form_records(template_id,template_version,template_fields,client_id,project_id,title,status,values,notes,scheduled_for,created_by,completed_by,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [request.body.templateId, template.rows[0].version, JSON.stringify(template.rows[0].fields), request.body.clientId || null, request.body.projectId || null, title, status, JSON.stringify(values), request.body.notes || '', request.body.scheduledFor || null, request.user.id, status === 'completed' ? request.user.id : null, status === 'completed' ? new Date() : null]);
    await audit(request, 'create', 'form_record', String(result.rows[0].id), { title, status, templateId: request.body.templateId });
    response.status(201).json({ record: result.rows[0] });
  });

  router.get('/form-records/:id', async (request, response) => {
    const result = await pool.query(`SELECT r.*,t.name template_name,c.name client_name,p.name project_name,creator.display_name created_by_name,completer.display_name completed_by_name,approver.display_name approved_by_name FROM form_records r JOIN form_templates t ON t.id=r.template_id LEFT JOIN clients c ON c.id=r.client_id LEFT JOIN projects p ON p.id=r.project_id LEFT JOIN users creator ON creator.id=r.created_by LEFT JOIN users completer ON completer.id=r.completed_by LEFT JOIN users approver ON approver.id=r.approved_by WHERE r.id=$1`, [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'הטופס לא נמצא' });
    response.json({ record: recordFromRow(result.rows[0]) });
  });

  router.patch('/form-records/:id', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const current = await pool.query(`SELECT r.* FROM form_records r WHERE r.id=$1`, [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'הטופס לא נמצא' });
    const row = current.rows[0];
    if (row.status === 'approved' && !['admin', 'manager'].includes(request.user.role)) return response.status(403).json({ error: 'טופס מאושר ניתן לעריכה רק על ידי מנהל' });
    const status = STATUSES.includes(request.body.status) ? request.body.status : row.status;
    if (status === 'approved' && !['admin', 'manager'].includes(request.user.role)) return response.status(403).json({ error: 'רק מנהל יכול לאשר טופס' });
    const values = request.body.values && typeof request.body.values === 'object' ? request.body.values : row.values;
    const missing = status === 'draft' ? [] : missingRequired(row.template_fields, values);
    if (missing.length) return response.status(400).json({ error: `חסרים שדות חובה: ${missing.join(', ')}` });
    if (!String(request.body.title ?? row.title).trim()) return response.status(400).json({ error: 'כותרת הטופס היא שדה חובה' });
    const completedNow = status === 'completed' && row.status !== 'completed';
    const approvedNow = status === 'approved' && row.status !== 'approved';
    const clientId = request.body.clientId === undefined ? row.client_id : request.body.clientId || null;
    const projectId = request.body.projectId === undefined ? row.project_id : request.body.projectId || null;
    const scheduledFor = request.body.scheduledFor === undefined ? row.scheduled_for : request.body.scheduledFor || null;
    const result = await pool.query(`UPDATE form_records SET client_id=$1,project_id=$2,title=$3,status=$4,values=$5,notes=$6,scheduled_for=$7,completed_by=CASE WHEN $8 THEN $10 ELSE completed_by END,completed_at=CASE WHEN $8 THEN NOW() ELSE completed_at END,approved_by=CASE WHEN $9 THEN $10 ELSE approved_by END,approved_at=CASE WHEN $9 THEN NOW() ELSE approved_at END,updated_at=NOW() WHERE id=$11 RETURNING *`, [clientId, projectId, String(request.body.title ?? row.title).trim(), status, JSON.stringify(values), request.body.notes ?? row.notes, scheduledFor, completedNow, approvedNow, request.user.id, request.params.id]);
    await audit(request, 'update', 'form_record', request.params.id, { title: result.rows[0].title, status });
    response.json({ record: result.rows[0] });
  });

  router.delete('/form-records/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM form_records WHERE id=$1 RETURNING id,title', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'הטופס לא נמצא' });
    await audit(request, 'delete', 'form_record', request.params.id, { title: result.rows[0].title });
    response.status(204).end();
  });

  return router;
}
