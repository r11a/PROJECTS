import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const CLIENT_FIELDS = {
  name: 'name', clientType: 'client_type', companyNumber: 'company_number', primaryContactName: 'primary_contact_name',
  phone: 'phone', additionalPhones: 'additional_phones', email: 'email', additionalEmails: 'additional_emails',
  address: 'address', city: 'city', notes: 'notes', status: 'status', customValues: 'custom_values',
};
const CONTACT_FIELDS = {
  name: 'name', company: 'company', role: 'role', phone: 'phone', additionalPhones: 'additional_phones',
  email: 'email', isReferrer: 'is_referrer', notes: 'notes',
};
const CATALOG_CATEGORIES = ['stage', 'system', 'tag', 'flag', 'priority', 'contact_role', 'task_status', 'inspection_template'];
const JSON_FIELDS = new Set(['additionalPhones', 'additionalEmails', 'customValues', 'findings', 'metadata', 'options']);

function valuesFor(input, fields) {
  return Object.entries(fields).filter(([key]) => input[key] !== undefined).map(([key, column]) => [key, column, JSON_FIELDS.has(key) ? JSON.stringify(input[key]) : input[key]]);
}

function clientFromRow(row) {
  return {
    id: row.id, code: row.code, name: row.name, clientType: row.client_type, companyNumber: row.company_number,
    primaryContactName: row.primary_contact_name, phone: row.phone, additionalPhones: row.additional_phones || [],
    email: row.email, additionalEmails: row.additional_emails || [], address: row.address, city: row.city,
    notes: row.notes, status: row.status, customValues: row.custom_values || {}, createdAt: row.created_at,
    updatedAt: row.updated_at, projectCount: Number(row.project_count || 0), openTaskCount: Number(row.open_task_count || 0),
    labels: row.labels || [],
  };
}

function contactFromRow(row) {
  return {
    id: row.id, clientId: row.client_id, name: row.name, company: row.company, role: row.role, phone: row.phone,
    additionalPhones: row.additional_phones || [], email: row.email, isReferrer: row.is_referrer, notes: row.notes,
  };
}

export async function createOperationalRouter({ pool, authenticate, requireRoles, audit, dataDir }) {
  const router = express.Router();
  const uploadDir = path.join(dataDir, 'uploads', 'clients');
  const brandingDir = path.join(dataDir, 'branding');
  await Promise.all([mkdir(uploadDir, { recursive: true }), mkdir(brandingDir, { recursive: true })]);
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).slice(0, 12).toLowerCase()}`),
    }),
    limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  });
  const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  router.use(authenticate);

  router.get('/audit', requireRoles('admin'), async (request, response) => {
    const query = String(request.query.q || '').trim();
    const entityType = String(request.query.entityType || '').trim();
    const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 500);
    const result = await pool.query(
      `SELECT a.id,a.action,a.entity_type,a.entity_id,a.details,a.created_at,
              COALESCE(u.display_name,u.username,'מערכת') AS user_name,u.role
       FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
       WHERE ($1='' OR concat_ws(' ',a.action,a.entity_type,a.entity_id,a.details::text,u.display_name,u.username) ILIKE $2)
         AND ($3='' OR a.entity_type=$3)
       ORDER BY a.created_at DESC LIMIT $4`, [query, `%${query}%`, entityType, limit],
    );
    response.json({ entries: result.rows.map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, details: row.details, createdAt: row.created_at, userName: row.user_name, role: row.role })) });
  });

  router.get('/insights', async (request, response) => {
    const [taskStats, collection, risks, alerts, recent] = await Promise.all([
      pool.query(`SELECT COUNT(*) FILTER (WHERE status<>'done' AND due_date<CURRENT_DATE)::int overdue,
                         COUNT(*) FILTER (WHERE status<>'done' AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7)::int due_soon,
                         COUNT(*) FILTER (WHERE status='done' AND completed_at>=NOW()-INTERVAL '7 days')::int completed_week FROM tasks`),
      pool.query(`SELECT COALESCE(SUM(value-paid),0)::numeric outstanding,COUNT(*) FILTER (WHERE paid<value)::int open_projects FROM projects`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE health<70)::int health_risks,COUNT(*) FILTER (WHERE flag<>'')::int flagged FROM projects`),
      pool.query(`SELECT t.id,t.title,t.due_date,t.priority,c.name client_name,c.id client_id
                  FROM tasks t LEFT JOIN clients c ON c.id=t.client_id
                  LEFT JOIN user_alert_snoozes s ON s.user_id=$1 AND s.alert_key='task:'||t.id
                  WHERE t.status<>'done' AND t.due_date<CURRENT_DATE AND (s.snoozed_until IS NULL OR s.snoozed_until<=NOW())
                  ORDER BY t.due_date,t.priority DESC LIMIT 25`, [request.user.id]),
      pool.query(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.created_at,COALESCE(u.display_name,u.username,'מערכת') user_name
                  FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 8`),
    ]);
    const stats = { ...taskStats.rows[0], outstanding: Number(collection.rows[0].outstanding), openProjects: collection.rows[0].open_projects, ...risks.rows[0] };
    const suggestions = [];
    if (stats.overdue) suggestions.push({ tone: 'danger', title: `${stats.overdue} משימות באיחור`, text: 'נדרשת הקצאה מחדש או עדכון יעד', target: 'calendar' });
    if (stats.due_soon) suggestions.push({ tone: 'warning', title: `${stats.due_soon} משימות לשבוע הקרוב`, text: 'כדאי לוודא משאבים וחומרים', target: 'calendar' });
    if (stats.health_risks) suggestions.push({ tone: 'danger', title: `${stats.health_risks} פרויקטים בסיכון`, text: 'מדד הבריאות נמוך מ־70', target: 'projects' });
    if (stats.outstanding) suggestions.push({ tone: 'info', title: `₪${Math.round(stats.outstanding).toLocaleString('he-IL')} לגבייה`, text: `${stats.openProjects} פרויקטים עם יתרה פתוחה`, target: 'finance' });
    if (!suggestions.length) suggestions.push({ tone: 'success', title: 'המערכת מאוזנת', text: 'אין כרגע חריגות הדורשות טיפול', target: 'dashboard' });
    response.json({ stats, suggestions, alerts: alerts.rows.map((row) => ({ key: `task:${row.id}`, taskId: row.id, title: row.title, dueDate: row.due_date, priority: row.priority, clientName: row.client_name, clientId: row.client_id })), recentActivities: recent.rows.map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, userName: row.user_name, createdAt: row.created_at })) });
  });

  router.post('/alerts/snooze', async (request, response) => {
    const durations = { hour: '1 hour', day: '1 day', week: '1 week', month: '1 month' };
    const duration = durations[request.body.duration];
    const keys = Array.isArray(request.body.keys) ? request.body.keys.filter((key) => /^task:\d+$/.test(key)) : [];
    if (!duration || !keys.length) return response.status(400).json({ error: 'Alert keys and a valid duration are required' });
    await pool.query(`INSERT INTO user_alert_snoozes(user_id,alert_key,snoozed_until) SELECT $1,unnest($2::text[]),NOW()+$3::interval
      ON CONFLICT(user_id,alert_key) DO UPDATE SET snoozed_until=EXCLUDED.snoozed_until`, [request.user.id, keys, duration]);
    await audit(request, 'snooze', 'alerts', keys.join(','), { duration: request.body.duration });
    response.status(204).end();
  });

  router.get('/settings', async (_request, response) => {
    const [settings, catalogs, fields] = await Promise.all([
      pool.query('SELECT key, value, updated_at FROM app_settings ORDER BY key'),
      pool.query('SELECT * FROM catalog_items ORDER BY category, sort_order, name'),
      pool.query('SELECT * FROM custom_field_definitions ORDER BY entity_type, sort_order, label'),
    ]);
    response.json({
      settings: Object.fromEntries(settings.rows.map((row) => [row.key, row.value])),
      catalogs: catalogs.rows.map((row) => ({ id: row.id, category: row.category, name: row.name, color: row.color, icon: row.icon, symbol: row.symbol, description: row.description, active: row.active, sortOrder: row.sort_order, metadata: row.metadata })),
      customFields: fields.rows.map((row) => ({ id: row.id, entityType: row.entity_type, fieldKey: row.field_key, label: row.label, fieldType: row.field_type, required: row.required, active: row.active, sortOrder: row.sort_order, options: row.options })),
    });
  });

  router.get('/settings/company-logo', async (_request, response) => {
    const setting = await pool.query("SELECT value FROM app_settings WHERE key='company'");
    const storedName = setting.rows[0]?.value?.logo?.storedName;
    if (!storedName || path.basename(storedName) !== storedName) return response.status(404).json({ error: 'Company logo not found' });
    response.set('Cache-Control', 'private, no-cache');
    response.sendFile(path.join(brandingDir, storedName));
  });

  router.post('/settings/company-logo', requireRoles('admin'), logoUpload.single('logo'), async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'יש לבחור קובץ לוגו' });
    const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    const extension = extensions[request.file.mimetype];
    if (!extension) return response.status(400).json({ error: 'הלוגו חייב להיות PNG, JPG או WebP' });
    const storedName = `company-logo.${extension}`;
    await writeFile(path.join(brandingDir, storedName), request.file.buffer, { mode: 0o600 });
    const existing = await readdir(brandingDir);
    await Promise.all(existing.filter((name) => name.startsWith('company-logo.') && name !== storedName).map((name) => unlink(path.join(brandingDir, name)).catch(() => {})));
    const current = await pool.query("SELECT value FROM app_settings WHERE key='company'");
    const value = { ...(current.rows[0]?.value || {}), logo: { storedName, originalName: request.file.originalname, mimeType: request.file.mimetype, updatedAt: new Date().toISOString(), url: '/settings/company-logo' } };
    const result = await pool.query(`INSERT INTO app_settings(key,value,updated_by) VALUES('company',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING key,value,updated_at`, [JSON.stringify(value), request.user.id]);
    await audit(request, 'upload', 'company_logo', 'company', { originalName: request.file.originalname, mimeType: request.file.mimetype });
    response.status(201).json({ setting: result.rows[0] });
  });

  router.patch('/settings/:key', requireRoles('admin'), async (request, response) => {
    const result = await pool.query(
      `INSERT INTO app_settings(key, value, updated_by) VALUES($1, $2, $3)
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [request.params.key, JSON.stringify(request.body || {}), request.user.id],
    );
    await audit(request, 'update', 'setting', request.params.key, request.body);
    response.json({ setting: result.rows[0] });
  });

  router.post('/catalogs', requireRoles('admin'), async (request, response) => {
    const category = CATALOG_CATEGORIES.includes(request.body.category) ? request.body.category : null;
    if (!category || !String(request.body.name || '').trim()) return response.status(400).json({ error: 'Category and name are required' });
    const result = await pool.query(
      `INSERT INTO catalog_items(category, name, color, icon, symbol, description, sort_order, metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [category, request.body.name.trim(), request.body.color || '#6957df', request.body.icon || 'circle', request.body.symbol || '', request.body.description || '', request.body.sortOrder || 0, JSON.stringify(request.body.metadata || {})],
    );
    await audit(request, 'create', 'catalog_item', String(result.rows[0].id), { category, name: request.body.name });
    response.status(201).json({ item: result.rows[0] });
  });

  router.patch('/catalogs/:id', requireRoles('admin'), async (request, response) => {
    const allowed = { name: 'name', color: 'color', icon: 'icon', symbol: 'symbol', description: 'description', active: 'active', sortOrder: 'sort_order', metadata: 'metadata' };
    const entries = valuesFor(request.body || {}, allowed);
    if (!entries.length) return response.status(400).json({ error: 'No editable fields supplied' });
    const values = entries.map(([, , value]) => value); values.push(request.params.id);
    const result = await pool.query(`UPDATE catalog_items SET ${entries.map(([, column], index) => `${column}=$${index + 1}`).join(',')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!result.rowCount) return response.status(404).json({ error: 'Catalog item not found' });
    await audit(request, 'update', 'catalog_item', request.params.id, request.body);
    response.json({ item: result.rows[0] });
  });

  router.delete('/catalogs/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM catalog_items WHERE id=$1 RETURNING id', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Catalog item not found' });
    await audit(request, 'delete', 'catalog_item', request.params.id);
    response.status(204).end();
  });

  router.post('/custom-fields', requireRoles('admin'), async (request, response) => {
    const { entityType, fieldKey, label, fieldType = 'text', options = [] } = request.body;
    const required = entityType === 'client' ? false : Boolean(request.body.required);
    if (!entityType || !fieldKey || !label) return response.status(400).json({ error: 'Entity, key and label are required' });
    const result = await pool.query(
      `INSERT INTO custom_field_definitions(entity_type, field_key, label, field_type, required, options)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [entityType, fieldKey, label, fieldType, required, JSON.stringify(options)],
    );
    await audit(request, 'create', 'custom_field', String(result.rows[0].id), request.body);
    response.status(201).json({ field: result.rows[0] });
  });

  router.get('/clients', async (request, response) => {
    const query = String(request.query.q || '').trim();
    const like = `%${query}%`;
    const result = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id=c.id) AS project_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.client_id=c.id AND t.status <> 'done') AS open_task_count,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ci.id,'name',ci.name,'category',ci.category,'color',ci.color,'icon',ci.icon,'symbol',ci.symbol) ORDER BY ci.sort_order)
          FROM client_labels cl JOIN catalog_items ci ON ci.id=cl.catalog_item_id WHERE cl.client_id=c.id), '[]'::jsonb) AS labels
       FROM clients c
       WHERE $1='' OR concat_ws(' ',c.code,c.name,c.primary_contact_name,c.phone,c.additional_phones::text,c.email,c.additional_emails::text,c.address,c.city,c.notes) ILIKE $2
         OR EXISTS (SELECT 1 FROM client_contacts cc WHERE cc.client_id=c.id AND concat_ws(' ',cc.name,cc.company,cc.role,cc.phone,cc.additional_phones::text,cc.email) ILIKE $2)
         OR EXISTS (SELECT 1 FROM client_labels cl JOIN catalog_items ci ON ci.id=cl.catalog_item_id WHERE cl.client_id=c.id AND concat_ws(' ',ci.name,ci.symbol) ILIKE $2)
       ORDER BY c.updated_at DESC, c.name LIMIT 200`, [query, like],
    );
    response.json({ clients: result.rows.map(clientFromRow) });
  });

  router.post('/clients', requireRoles('admin', 'manager'), async (request, response) => {
    const required = ['name', 'address', 'phone'];
    if (required.some((key) => !String(request.body[key] || '').trim())) return response.status(400).json({ error: 'שם לקוח, כתובת וטלפון הם שדות חובה' });
    const next = await pool.query("SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D','','g'),'')::int),1000)+1 AS value FROM clients");
    const input = { clientType: 'private', ...request.body };
    const entries = valuesFor(input, CLIENT_FIELDS);
    const columns = ['code', ...entries.map(([, column]) => column)];
    const values = [`CUS-${next.rows[0].value}`, ...entries.map(([, , value]) => value)];
    const result = await pool.query(`INSERT INTO clients(${columns.join(',')}) VALUES(${values.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`, values);
    if (Array.isArray(request.body.labelIds) && request.body.labelIds.length) {
      await pool.query('INSERT INTO client_labels(client_id,catalog_item_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING', [result.rows[0].id, request.body.labelIds]);
    }
    await audit(request, 'create', 'client', String(result.rows[0].id), { name: request.body.name });
    response.status(201).json({ client: clientFromRow(result.rows[0]) });
  });

  router.get('/clients/:id', async (request, response) => {
    const [client, contacts, tasks, inspections, files, projects] = await Promise.all([
      pool.query(`SELECT c.*, COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ci.id,'name',ci.name,'category',ci.category,'color',ci.color,'icon',ci.icon,'symbol',ci.symbol)) FROM client_labels cl JOIN catalog_items ci ON ci.id=cl.catalog_item_id WHERE cl.client_id=c.id),'[]'::jsonb) labels FROM clients c WHERE c.id=$1`, [request.params.id]),
      pool.query('SELECT * FROM client_contacts WHERE client_id=$1 ORDER BY is_referrer DESC, name', [request.params.id]),
      pool.query('SELECT t.*,u.display_name assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.client_id=$1 ORDER BY (t.status=\'done\'), t.due_date NULLS LAST, t.created_at DESC', [request.params.id]),
      pool.query('SELECT * FROM site_inspections WHERE client_id=$1 ORDER BY inspection_date DESC, created_at DESC', [request.params.id]),
      pool.query('SELECT * FROM client_files WHERE client_id=$1 ORDER BY created_at DESC', [request.params.id]),
      pool.query('SELECT * FROM projects WHERE client_id=$1 ORDER BY created_at DESC', [request.params.id]),
    ]);
    if (!client.rowCount) return response.status(404).json({ error: 'Client not found' });
    response.json({ client: clientFromRow(client.rows[0]), contacts: contacts.rows.map(contactFromRow), tasks: tasks.rows, inspections: inspections.rows, files: files.rows, projects: projects.rows });
  });

  router.patch('/clients/:id', requireRoles('admin', 'manager'), async (request, response) => {
    for (const key of ['name', 'address', 'phone']) if (request.body[key] !== undefined && !String(request.body[key]).trim()) return response.status(400).json({ error: 'שם לקוח, כתובת וטלפון אינם יכולים להיות ריקים' });
    const entries = valuesFor(request.body || {}, CLIENT_FIELDS);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let result = await client.query('SELECT * FROM clients WHERE id=$1', [request.params.id]);
      if (!result.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'Client not found' }); }
      if (entries.length) {
        const values = entries.map(([, , value]) => value); values.push(request.params.id);
        result = await client.query(`UPDATE clients SET ${entries.map(([, column], index) => `${column}=$${index + 1}`).join(',')},updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
      }
      if (Array.isArray(request.body.labelIds)) {
        await client.query('DELETE FROM client_labels WHERE client_id=$1', [request.params.id]);
        if (request.body.labelIds.length) await client.query('INSERT INTO client_labels(client_id,catalog_item_id) SELECT $1,unnest($2::bigint[])', [request.params.id, request.body.labelIds]);
      }
      await client.query('COMMIT');
      await audit(request, 'update', 'client', request.params.id, request.body);
      response.json({ client: clientFromRow(result.rows[0]) });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  router.delete('/clients/:id', requireRoles('admin'), async (request, response) => {
    const files = await pool.query('SELECT stored_name FROM client_files WHERE client_id=$1', [request.params.id]);
    const result = await pool.query('DELETE FROM clients WHERE id=$1 RETURNING id,name', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Client not found' });
    await Promise.all(files.rows.map((file) => unlink(path.join(uploadDir, file.stored_name)).catch(() => {})));
    await audit(request, 'delete', 'client', request.params.id, { name: result.rows[0].name });
    response.status(204).end();
  });

  router.post('/clients/:id/contacts', requireRoles('admin', 'manager'), async (request, response) => {
    if (!String(request.body.name || '').trim()) return response.status(400).json({ error: 'Contact name is required' });
    const entries = valuesFor(request.body, CONTACT_FIELDS);
    const result = await pool.query(`INSERT INTO client_contacts(client_id,${entries.map(([, column]) => column).join(',')}) VALUES($1,${entries.map((_, index) => `$${index + 2}`).join(',')}) RETURNING *`, [request.params.id, ...entries.map(([, , value]) => value)]);
    await audit(request, 'create', 'client_contact', String(result.rows[0].id), { clientId: request.params.id });
    response.status(201).json({ contact: contactFromRow(result.rows[0]) });
  });

  router.delete('/contacts/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM client_contacts WHERE id=$1 RETURNING id', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Contact not found' });
    await audit(request, 'delete', 'client_contact', request.params.id);
    response.status(204).end();
  });

  router.post('/clients/:id/tasks', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    if (!String(request.body.title || '').trim()) return response.status(400).json({ error: 'Task title is required' });
    if (!request.body.dueDate) return response.status(400).json({ error: 'תאריך יעד הוא שדה חובה במשימה' });
    const result = await pool.query(`INSERT INTO tasks(client_id,title,description,status,priority,assignee_id,due_date,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [request.params.id, request.body.title, request.body.description || '', request.body.status || 'open', request.body.priority || 'normal', request.body.assigneeId || null, request.body.dueDate || null, request.user.id]);
    await audit(request, 'create', 'task', String(result.rows[0].id), { clientId: request.params.id });
    response.status(201).json({ task: result.rows[0] });
  });

  router.patch('/tasks/:id', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const allowed = { title: 'title', description: 'description', status: 'status', priority: 'priority', assigneeId: 'assignee_id', dueDate: 'due_date' };
    const entries = valuesFor(request.body, allowed);
    if (!entries.length) return response.status(400).json({ error: 'No editable fields supplied' });
    const values = entries.map(([, , value]) => value); values.push(request.params.id);
    const completed = request.body.status === 'done' ? ',completed_at=NOW()' : request.body.status ? ',completed_at=NULL' : '';
    const result = await pool.query(`UPDATE tasks SET ${entries.map(([, column], index) => `${column}=$${index + 1}`).join(',')}${completed},updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!result.rowCount) return response.status(404).json({ error: 'Task not found' });
    await audit(request, 'update', 'task', request.params.id, request.body);
    response.json({ task: result.rows[0] });
  });

  router.delete('/tasks/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Task not found' });
    await audit(request, 'delete', 'task', request.params.id);
    response.status(204).end();
  });

  router.post('/clients/:id/inspections', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const result = await pool.query(`INSERT INTO site_inspections(client_id,project_id,title,inspection_date,inspector_name,status,score,findings,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [request.params.id, request.body.projectId || null, request.body.title || 'ביקורת אתר', request.body.inspectionDate || new Date().toISOString().slice(0, 10), request.body.inspectorName || request.user.displayName, request.body.status || 'draft', request.body.score || null, JSON.stringify(request.body.findings || []), request.body.notes || '', request.user.id]);
    await audit(request, 'create', 'inspection', String(result.rows[0].id), { clientId: request.params.id });
    response.status(201).json({ inspection: result.rows[0] });
  });

  router.delete('/inspections/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM site_inspections WHERE id=$1 RETURNING id', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Inspection not found' });
    await audit(request, 'delete', 'inspection', request.params.id);
    response.status(204).end();
  });

  router.post('/clients/:id/files', requireRoles('admin', 'manager', 'technician'), upload.single('file'), async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'File is required' });
    const result = await pool.query(`INSERT INTO client_files(client_id,original_name,stored_name,mime_type,size_bytes,category,description,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [request.params.id, request.file.originalname, request.file.filename, request.file.mimetype, request.file.size, request.body.category || 'other', request.body.description || '', request.user.id]);
    await audit(request, 'upload', 'client_file', String(result.rows[0].id), { clientId: request.params.id, name: request.file.originalname });
    response.status(201).json({ file: result.rows[0] });
  });

  router.get('/files/:id/download', async (request, response) => {
    const result = await pool.query('SELECT * FROM client_files WHERE id=$1', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'File not found' });
    response.download(path.join(uploadDir, result.rows[0].stored_name), result.rows[0].original_name);
  });

  router.delete('/files/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM client_files WHERE id=$1 RETURNING id,stored_name', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'File not found' });
    await unlink(path.join(uploadDir, result.rows[0].stored_name)).catch(() => {});
    await audit(request, 'delete', 'client_file', request.params.id);
    response.status(204).end();
  });

  router.get('/calendar', async (request, response) => {
    const from = request.query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const to = request.query.to || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();
    const projectId = String(request.query.projectId || '');
    const [result, projects] = await Promise.all([
      pool.query(`SELECT h.*,u.display_name assignee_name,COALESCE(u.avatar_color,h.color) assignee_color,COALESCE(u.avatar_icon,h.icon) assignee_icon,p.name project_name
        FROM calendar_history h LEFT JOIN users u ON u.id=h.user_id LEFT JOIN projects p ON p.id=h.project_id
        WHERE h.event_at >= $1::timestamptz AND h.event_at < $2::timestamptz AND ($3='' OR h.project_id=$3)
        ORDER BY h.event_at`, [from, to, projectId]),
      pool.query('SELECT id,name FROM projects ORDER BY name'),
    ]);
    response.json({ projects: projects.rows, events: result.rows.map((row) => ({ id: `${row.source_type}-${row.source_id}`, title: row.title, type: row.source_type, status: row.status, startAt: row.event_at, endAt: row.event_end, allDay: row.payload?.allDay ?? true, color: row.color, icon: row.icon, clientId: row.client_id, projectId: row.project_id, projectName: row.project_name, notes: row.payload?.notes || row.payload?.description || '', assigneeName: row.assignee_name, assigneeColor: row.assignee_color, assigneeIcon: row.assignee_icon })) });
  });

  router.get('/calendar-options', async (_request, response) => {
    const [projects, users] = await Promise.all([
      pool.query('SELECT id,name FROM projects ORDER BY name'),
      pool.query('SELECT id,display_name,avatar_color,avatar_icon FROM users WHERE active=TRUE ORDER BY display_name'),
    ]);
    response.json({ projects: projects.rows, users: users.rows.map((row) => ({ id: row.id, displayName: row.display_name, avatarColor: row.avatar_color, avatarIcon: row.avatar_icon })) });
  });

  router.post('/calendar', requireRoles('admin', 'manager'), async (request, response) => {
    if (!request.body.title || !request.body.startAt) return response.status(400).json({ error: 'Title and start date are required' });
    const result = await pool.query(`INSERT INTO calendar_events(title,event_type,start_at,end_at,all_day,color,icon,client_id,project_id,assignee_id,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [request.body.title, request.body.type || 'general', request.body.startAt, request.body.endAt || null, request.body.allDay ?? true, request.body.color || '#6957df', request.body.icon || 'calendar', request.body.clientId || null, request.body.projectId || null, request.body.assigneeId || null, request.body.notes || '', request.user.id]);
    await audit(request, 'create', 'calendar_event', String(result.rows[0].id), { title: request.body.title });
    response.status(201).json({ event: result.rows[0] });
  });

  router.delete('/calendar/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM calendar_events WHERE id=$1 RETURNING id', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Event not found' });
    await audit(request, 'delete', 'calendar_event', request.params.id);
    response.status(204).end();
  });

  return router;
}
