import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { access, mkdir, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PROFESSIONAL_FIELDS = {
  displayName: 'display_name', companyName: 'company_name', jobTitle: 'job_title', affiliation: 'affiliation', employeeNumber: 'employee_number', phone: 'phone',
  additionalPhones: 'additional_phones', email: 'email', additionalEmails: 'additional_emails', address: 'address',
  notes: 'notes', color: 'color', icon: 'icon', active: 'active', linkedUserId: 'linked_user_id', customValues: 'custom_values',
};
const EQUIPMENT_FIELDS = {
  itemType: 'item_type', parentId: 'parent_id', code: 'code', name: 'name', manufacturer: 'manufacturer',
  model: 'model', unit: 'unit', description: 'description', color: 'color', icon: 'icon', active: 'active', metadata: 'metadata',
};
const JSON_INPUTS = new Set(['additionalPhones', 'additionalEmails', 'customValues', 'metadata', 'tags']);

function professionalFromRow(row) {
  return {
    id: row.id, displayName: row.display_name, companyName: row.company_name, jobTitle: row.job_title,
    affiliation: row.affiliation, employeeNumber: row.employee_number,
    phone: row.phone, additionalPhones: row.additional_phones || [], email: row.email,
    additionalEmails: row.additional_emails || [], address: row.address, notes: row.notes, color: row.color,
    icon: row.icon, active: row.active, linkedUserId: row.linked_user_id, customValues: row.custom_values || {},
    roles: row.roles || [], projectCount: Number(row.project_count || 0), clientCount: Number(row.client_count || 0),
  };
}

function equipmentFromRow(row) {
  return {
    id: row.id, itemType: row.item_type, parentId: row.parent_id, code: row.code, name: row.name,
    manufacturer: row.manufacturer, model: row.model, unit: row.unit, description: row.description,
    color: row.color, icon: row.icon, iconImageStoredName: row.icon_image_stored_name || '', active: row.active, metadata: row.metadata || {},
  };
}

async function replaceProfessionalRoles(client, professionalId, roleIds) {
  if (!Array.isArray(roleIds)) return;
  await client.query('DELETE FROM professional_role_assignments WHERE professional_id=$1', [professionalId]);
  for (const roleId of [...new Set(roleIds.map(Number).filter(Boolean))]) {
    await client.query('INSERT INTO professional_role_assignments(professional_id,role_type_id) VALUES($1,$2)', [professionalId, roleId]);
  }
}

async function validateEquipmentHierarchy(client, itemType, parentId, ownId = null) {
  if (itemType === 'system_type') {
    if (parentId) { const error = new Error('סוג מערכת אינו יכול להיות משויך לפריט אב'); error.statusCode = 400; throw error; }
    return;
  }
  if (!parentId || String(parentId) === String(ownId)) { const error = new Error('יש לבחור פריט אב תקין'); error.statusCode = 400; throw error; }
  const expectedType = itemType === 'system' ? 'system_type' : 'system';
  const result = await client.query('SELECT item_type FROM equipment_catalog WHERE id=$1 AND active=TRUE', [parentId]);
  if (!result.rowCount || result.rows[0].item_type !== expectedType) { const error = new Error(itemType === 'system' ? 'מערכת חייבת להשתייך לסוג מערכת' : 'רכיב חייב להשתייך למערכת'); error.statusCode = 400; throw error; }
}

export async function createManagementRouter({ pool, authenticate, requireRoles, audit, dataDir }) {
  const router = express.Router();
  const documentsDir = path.join(dataDir, 'uploads', 'documents');
  const equipmentIconsDir = path.join(dataDir, 'uploads', 'equipment-icons');
  await mkdir(documentsDir, { recursive: true });
  await mkdir(equipmentIconsDir, { recursive: true });
  const storageRoots = { share: '/share', media: '/media' };
  const safeStoragePath = (mode, relativePath = 'PROJECTS') => {
    if (mode === 'internal' || mode === 'documents') return documentsDir;
    const root = storageRoots[mode];
    if (!root) throw Object.assign(new Error('סוג האחסון אינו נתמך'), { statusCode: 400 });
    const clean = String(relativePath || 'PROJECTS').replace(/^[\\/]+/, '');
    const resolved = path.resolve(root, clean);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw Object.assign(new Error('נתיב האחסון אינו מורשה'), { statusCode: 400 });
    return resolved;
  };
  const currentStorage = async () => {
    const result = await pool.query("SELECT value FROM app_settings WHERE key='documentStorage'");
    const value = result.rows[0]?.value || { mode: 'internal', relativePath: 'PROJECTS' };
    return { mode: value.mode || 'internal', relativePath: value.relativePath || 'PROJECTS', directory: safeStoragePath(value.mode || 'internal', value.relativePath) };
  };
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => currentStorage().then(async (storage) => { await mkdir(storage.directory, { recursive: true }); callback(null, storage.directory); }).catch(callback),
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).slice(0, 12).toLowerCase()}`),
    }),
    limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  });
  const iconUpload = multer({
    storage: multer.diskStorage({ destination: equipmentIconsDir, filename: (_request, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }),
    fileFilter: (_request, file, callback) => callback(null, ['image/png','image/jpeg','image/webp'].includes(file.mimetype)),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  const priorityUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf'),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });

  router.use(authenticate);

  router.post('/priority-orders/scan', requireRoles('admin', 'manager'), priorityUpload.single('file'), async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'יש לבחור קובץ PDF של הזמנה' });
    const source = path.join(dataDir, 'tmp', `${randomUUID()}.pdf`);
    await mkdir(path.dirname(source), { recursive: true });
    try {
      await writeFile(source, request.file.buffer);
      const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', source, '-'], { maxBuffer: 8 * 1024 * 1024 });
      const parsed = String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
        const columns = line.split(/\s{2,}|\t+/).map((value) => value.trim()).filter(Boolean);
        if (columns.length < 2) return null;
        const codeIndex = columns.findIndex((value) => /[A-Za-z0-9][A-Za-z0-9._\/-]{2,}/.test(value) && /\d/.test(value));
        const quantityIndex = columns.findLastIndex((value) => /^\d+(?:\.\d+)?$/.test(value.replace(/,/g, '')));
        if (codeIndex < 0 || quantityIndex <= codeIndex) return null;
        const quantity = Number(columns[quantityIndex].replace(/,/g, ''));
        if (!(quantity > 0) || quantity > 100000) return null;
        return { code: columns[codeIndex], description: columns.slice(codeIndex + 1, quantityIndex).join(' '), quantity };
      }).filter(Boolean);
      const unique = [...new Map(parsed.map((item) => [`${item.code}:${item.description}`, item])).values()].slice(0, 500);
      const codes = unique.map((item) => item.code);
      const catalog = codes.length ? await pool.query('SELECT id,code,name,unit FROM equipment_catalog WHERE code=ANY($1::text[]) AND active=TRUE', [codes]) : { rows: [] };
      const byCode = new Map(catalog.rows.map((item) => [String(item.code).toLowerCase(), item]));
      const items = unique.map((item) => ({ ...item, catalogItem: byCode.get(item.code.toLowerCase()) || null }));
      await audit(request, 'import', 'priority_order', request.file.originalname, { rows: items.length, matched: items.filter((item) => item.catalogItem).length });
      response.json({ fileName: request.file.originalname, items, textDetected: Boolean(String(stdout || '').trim()) });
    } catch (error) {
      if (error.code === 'ENOENT') return response.status(503).json({ error: 'שירות פענוח ה־PDF אינו מותקן בגרסה זו' });
      throw error;
    } finally {
      await unlink(source).catch(() => {});
    }
  });

  router.get('/professional-roles', async (_request, response) => {
    const result = await pool.query('SELECT * FROM professional_role_types ORDER BY sort_order,name');
    response.json({ roles: result.rows.map((row) => ({ id: row.id, key: row.role_key, name: row.name, color: row.color, icon: row.icon, active: row.active, sortOrder: row.sort_order })) });
  });

  router.post('/professional-roles', requireRoles('admin'), async (request, response) => {
    const name = String(request.body.name || '').trim();
    if (!name) return response.status(400).json({ error: 'שם התפקיד הוא שדה חובה' });
    const key = String(request.body.key || name).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_') || `role_${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO professional_role_types(role_key,name,color,icon,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [key, name, request.body.color || '#6957df', request.body.icon || 'user-round', Number(request.body.sortOrder) || 0],
    );
    await audit(request, 'create', 'professional_role', String(result.rows[0].id), { name });
    response.status(201).json({ role: result.rows[0] });
  });

  router.get('/professionals', async (request, response) => {
    const query = String(request.query.q || '').trim();
    const roleKey = String(request.query.role || '').trim();
    const result = await pool.query(
      `SELECT p.*,
        COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id',rt.id,'key',rt.role_key,'name',rt.name,'color',rt.color,'icon',rt.icon)) FILTER (WHERE rt.id IS NOT NULL),'[]') roles,
        (SELECT COUNT(DISTINCT pp.project_id) FROM project_professionals pp WHERE pp.professional_id=p.id) project_count,
        (SELECT COUNT(DISTINCT cp.client_id) FROM client_professionals cp WHERE cp.professional_id=p.id) client_count
       FROM professionals p
       LEFT JOIN professional_role_assignments pra ON pra.professional_id=p.id
       LEFT JOIN professional_role_types rt ON rt.id=pra.role_type_id
       WHERE ($1='' OR concat_ws(' ',p.display_name,p.company_name,p.job_title,p.phone,p.email,p.address,p.notes) ILIKE $2)
         AND ($3='' OR EXISTS (SELECT 1 FROM professional_role_assignments x JOIN professional_role_types r ON r.id=x.role_type_id WHERE x.professional_id=p.id AND r.role_key=$3))
       GROUP BY p.id ORDER BY p.active DESC,p.display_name`, [query, `%${query}%`, roleKey],
    );
    response.json({ professionals: result.rows.map(professionalFromRow) });
  });

  router.post('/professionals', requireRoles('admin', 'manager'), async (request, response) => {
    const displayName = String(request.body.displayName || '').trim();
    if (!displayName) return response.status(400).json({ error: 'שם איש המקצוע הוא שדה חובה' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const keys = Object.keys(PROFESSIONAL_FIELDS).filter((key) => key !== 'displayName' && request.body[key] !== undefined);
      const columns = ['display_name', ...keys.map((key) => PROFESSIONAL_FIELDS[key])];
      const values = [displayName, ...keys.map((key) => JSON_INPUTS.has(key) ? JSON.stringify(request.body[key]) : request.body[key])];
      const result = await client.query(`INSERT INTO professionals(${columns.join(',')}) VALUES(${values.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`, values);
      await replaceProfessionalRoles(client, result.rows[0].id, request.body.roleIds || []);
      await client.query('COMMIT');
      await audit(request, 'create', 'professional', String(result.rows[0].id), { displayName });
      response.status(201).json({ professional: professionalFromRow({ ...result.rows[0], roles: [] }) });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  router.patch('/professionals/:id', requireRoles('admin', 'manager'), async (request, response) => {
    const entries = Object.entries(request.body || {}).filter(([key]) => PROFESSIONAL_FIELDS[key] && request.body[key] !== undefined);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let row;
      if (entries.length) {
        const values = entries.map(([key, value]) => JSON_INPUTS.has(key) ? JSON.stringify(value) : value);
        values.push(request.params.id);
        const result = await client.query(`UPDATE professionals SET ${entries.map(([key], index) => `${PROFESSIONAL_FIELDS[key]}=$${index + 1}`).join(',')},updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
        row = result.rows[0];
      } else {
        row = (await client.query('SELECT * FROM professionals WHERE id=$1', [request.params.id])).rows[0];
      }
      if (!row) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'איש המקצוע לא נמצא' }); }
      await replaceProfessionalRoles(client, request.params.id, request.body.roleIds);
      await client.query('COMMIT');
      await audit(request, 'update', 'professional', request.params.id, Object.fromEntries(entries));
      response.json({ professional: professionalFromRow({ ...row, roles: [] }) });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  router.delete('/professionals/:id', requireRoles('admin'), async (request, response) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("UPDATE projects SET manager='',owner_initials='',updated_at=NOW() WHERE manager_professional_id=$1", [request.params.id]);
      const result = await client.query('DELETE FROM professionals WHERE id=$1 RETURNING id,display_name', [request.params.id]);
      if (!result.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'איש המקצוע לא נמצא' }); }
      await client.query('COMMIT');
      await audit(request, 'delete', 'professional', request.params.id, { displayName: result.rows[0].display_name });
      response.status(204).end();
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  });

  router.get('/equipment-catalog', async (_request, response) => {
    const result = await pool.query('SELECT * FROM equipment_catalog ORDER BY item_type,parent_id NULLS FIRST,name');
    response.json({ items: result.rows.map(equipmentFromRow) });
  });

  router.post('/equipment-catalog', requireRoles('admin', 'manager'), async (request, response) => {
    if (!['system_type', 'system', 'component'].includes(request.body.itemType) || !String(request.body.name || '').trim()) return response.status(400).json({ error: 'סוג ושם הם שדות חובה' });
    await validateEquipmentHierarchy(pool, request.body.itemType, request.body.parentId || null);
    const keys = Object.keys(EQUIPMENT_FIELDS).filter((key) => request.body[key] !== undefined);
    const values = keys.map((key) => JSON_INPUTS.has(key) ? JSON.stringify(request.body[key]) : request.body[key]);
    const result = await pool.query(`INSERT INTO equipment_catalog(${keys.map((key) => EQUIPMENT_FIELDS[key]).join(',')}) VALUES(${values.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`, values);
    await audit(request, 'create', 'equipment', String(result.rows[0].id), { name: result.rows[0].name, itemType: result.rows[0].item_type });
    response.status(201).json({ item: equipmentFromRow(result.rows[0]) });
  });

  router.patch('/equipment-catalog/:id', requireRoles('admin', 'manager'), async (request, response) => {
    const entries = Object.entries(request.body || {}).filter(([key]) => EQUIPMENT_FIELDS[key] && request.body[key] !== undefined);
    if (!entries.length) return response.status(400).json({ error: 'לא נשלחו שדות לעדכון' });
    const existing = await pool.query('SELECT * FROM equipment_catalog WHERE id=$1', [request.params.id]);
    if (!existing.rowCount) return response.status(404).json({ error: 'הפריט לא נמצא' });
    await validateEquipmentHierarchy(pool, request.body.itemType || existing.rows[0].item_type, request.body.parentId === undefined ? existing.rows[0].parent_id : request.body.parentId, request.params.id);
    const values = entries.map(([key, value]) => JSON_INPUTS.has(key) ? JSON.stringify(value) : value);
    values.push(request.params.id);
    const result = await pool.query(`UPDATE equipment_catalog SET ${entries.map(([key], index) => `${EQUIPMENT_FIELDS[key]}=$${index + 1}`).join(',')},updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!result.rowCount) return response.status(404).json({ error: 'הפריט לא נמצא' });
    await audit(request, 'update', 'equipment', request.params.id, Object.fromEntries(entries));
    response.json({ item: equipmentFromRow(result.rows[0]) });
  });

  router.delete('/equipment-catalog/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM equipment_catalog WHERE id=$1 RETURNING id,name', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'הפריט לא נמצא או נמצא בשימוש' });
    await audit(request, 'delete', 'equipment', request.params.id, { name: result.rows[0].name });
    response.status(204).end();
  });

  router.post('/equipment-catalog/:id/icon', requireRoles('admin', 'manager'), iconUpload.single('icon'), async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'יש לבחור תמונת PNG, JPG או WebP עד 5MB' });
    const current = await pool.query('SELECT icon_image_stored_name FROM equipment_catalog WHERE id=$1', [request.params.id]);
    if (!current.rowCount) { await unlink(request.file.path).catch(() => {}); return response.status(404).json({ error: 'הפריט לא נמצא' }); }
    const result = await pool.query('UPDATE equipment_catalog SET icon_image_stored_name=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [request.file.filename, request.params.id]);
    if (current.rows[0].icon_image_stored_name) await unlink(path.join(equipmentIconsDir, current.rows[0].icon_image_stored_name)).catch(() => {});
    await audit(request, 'upload', 'equipment_icon', request.params.id, { fileName: request.file.originalname });
    response.json({ item: equipmentFromRow(result.rows[0]) });
  });

  router.get('/equipment-catalog/:id/icon', async (request, response) => {
    const result = await pool.query('SELECT icon_image_stored_name FROM equipment_catalog WHERE id=$1', [request.params.id]);
    if (!result.rowCount || !result.rows[0].icon_image_stored_name) return response.status(404).end();
    response.sendFile(path.join(equipmentIconsDir, result.rows[0].icon_image_stored_name));
  });

  router.get('/document-storage', async (_request, response) => {
    const storage = await currentStorage();
    let writable = false; let error = '';
    try { await mkdir(storage.directory, { recursive: true }); await access(storage.directory, fsConstants.R_OK | fsConstants.W_OK); writable = true; } catch (cause) { error = cause.message; }
    response.json({ storage: { mode: storage.mode, relativePath: storage.relativePath, resolvedPath: storage.directory, writable, error } });
  });

  router.get('/document-storage/browse', requireRoles('admin'), async (request, response) => {
    const mode = String(request.query.mode || 'share');
    const relativePath = String(request.query.path || '');
    const directory = safeStoragePath(mode, relativePath || '.');
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      response.json({ mode, relativePath, directories: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort((a,b) => a.localeCompare(b, 'he')) });
    } catch (error) { response.status(400).json({ error: `לא ניתן לקרוא את התיקייה: ${error.message}` }); }
  });

  router.patch('/document-storage', requireRoles('admin'), async (request, response) => {
    const mode = String(request.body.mode || 'internal');
    const relativePath = String(request.body.relativePath || 'PROJECTS').trim();
    const directory = safeStoragePath(mode, relativePath);
    try {
      await mkdir(directory, { recursive: true });
      const probe = path.join(directory, `.projects-write-test-${randomUUID()}`);
      await writeFile(probe, 'PROJECTS'); await unlink(probe);
    } catch (error) { return response.status(400).json({ error: `התיקייה אינה זמינה לכתיבה: ${error.message}` }); }
    const value = { mode, relativePath, verified: true, verifiedAt: new Date().toISOString() };
    await pool.query(`INSERT INTO app_settings(key,value,updated_by) VALUES('documentStorage',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, [JSON.stringify(value), request.user.id]);
    await audit(request, 'update', 'document_storage', 'primary', { mode, relativePath });
    response.json({ storage: { ...value, resolvedPath: directory, writable: true } });
  });

  router.get('/documents', async (request, response) => {
    const result = await pool.query(
      `SELECT f.*,c.name client_name,p.name project_name,COALESCE(u.display_name,u.username,'מערכת') uploaded_by_name
       FROM client_files f LEFT JOIN clients c ON c.id=f.client_id LEFT JOIN projects p ON p.id=f.project_id LEFT JOIN users u ON u.id=f.uploaded_by
       WHERE ($1='' OR concat_ws(' ',f.title,f.original_name,f.category,f.description,c.name,p.name,f.tags::text) ILIKE $2)
         AND ($3='' OR f.client_id::text=$3) AND ($4='' OR f.project_id=$4)
       ORDER BY f.created_at DESC`, [String(request.query.q || ''), `%${String(request.query.q || '')}%`, String(request.query.clientId || ''), String(request.query.projectId || '')],
    );
    response.json({ documents: result.rows.map((row) => ({ id: row.id, clientId: row.client_id, projectId: row.project_id, formRecordId: row.form_record_id, title: row.title || row.original_name, originalName: row.original_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), category: row.category, description: row.description, tags: row.tags || [], version: row.version, clientName: row.client_name, projectName: row.project_name, uploadedByName: row.uploaded_by_name, createdAt: row.created_at })) });
  });

  router.post('/documents', requireRoles('admin', 'manager', 'technician'), upload.single('file'), async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'לא נבחר קובץ' });
    if(request.file.mimetype.startsWith('video/')&&request.file.size>30*1024*1024&&(!['admin','manager'].includes(request.user.role)||request.body.largeFileApproved!=='true')){await unlink(request.file.path).catch(()=>{});return response.status(413).json({error:'סרטון מוגבל ל־30MB. מנהל יכול לאשר העלאה חריגה במפורש.'});}
    const clientId = request.body.clientId || null;
    const projectId = request.body.projectId || null;
    const formRecordId = request.body.formRecordId || null;
    if (!clientId && !projectId && !formRecordId) { await unlink(request.file.path).catch(() => {}); return response.status(400).json({ error: 'יש לשייך את הקובץ ללקוח, פרויקט או טופס' }); }
    let tags = [];
    try { tags = JSON.parse(request.body.tags || '[]'); } catch { tags = String(request.body.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean); }
    const storage = await currentStorage();
    let storagePath = storage.relativePath;
    if (projectId && storage.mode !== 'internal') {
      const project = await pool.query('SELECT id,name,document_folder FROM projects WHERE id=$1',[projectId]);
      if (project.rowCount) {
        const folder = (project.rows[0].document_folder||`${project.rows[0].id}-${project.rows[0].name}`).replace(/[<>:"/\\|?*\x00-\x1F]/g,'-').replace(/\s+/g,' ').trim().slice(0,100);
        storagePath = [storage.relativePath,folder].filter(Boolean).join('/');
        const projectDirectory = safeStoragePath(storage.mode,storagePath); await mkdir(projectDirectory,{recursive:true});
        await rename(request.file.path,path.join(projectDirectory,request.file.filename));
      }
    }
    const result = await pool.query(
      `INSERT INTO client_files(client_id,project_id,form_record_id,title,original_name,stored_name,mime_type,size_bytes,category,description,tags,version,storage_area,storage_path,uploaded_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [clientId, projectId, formRecordId, request.body.title || request.file.originalname, request.file.originalname, request.file.filename, request.file.mimetype, request.file.size, request.body.category || 'אחר', request.body.description || '', JSON.stringify(tags), Number(request.body.version) || 1, storage.mode, storagePath, request.user.id],
    );
    await audit(request, 'upload', 'document', String(result.rows[0].id), { originalName: request.file.originalname, clientId, projectId });
    response.status(201).json({ document: result.rows[0] });
  });

  router.get('/documents/:id/download', async (request, response) => {
    const result = await pool.query('SELECT * FROM client_files WHERE id=$1', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'המסמך לא נמצא' });
    const row = result.rows[0];
    const directory = row.storage_area === 'clients' ? path.join(dataDir, 'uploads', 'clients') : safeStoragePath(row.storage_area, row.storage_path);
    response.download(path.join(directory, row.stored_name), row.original_name);
  });

  router.get('/documents/:id/preview', async (request, response) => {
    const result = await pool.query('SELECT * FROM client_files WHERE id=$1', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'המסמך לא נמצא' });
    const row = result.rows[0];
    const directory = row.storage_area === 'clients' ? path.join(dataDir, 'uploads', 'clients') : safeStoragePath(row.storage_area, row.storage_path);
    response.type(row.mime_type || 'application/octet-stream');
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`);
    response.sendFile(path.join(directory, row.stored_name));
  });

  router.delete('/documents/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM client_files WHERE id=$1 RETURNING *', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'המסמך לא נמצא' });
    const row = result.rows[0];
    const directory = row.storage_area === 'clients' ? path.join(dataDir, 'uploads', 'clients') : safeStoragePath(row.storage_area, row.storage_path);
    await unlink(path.join(directory, row.stored_name)).catch(() => {});
    await audit(request, 'delete', 'document', request.params.id, { originalName: row.original_name });
    response.status(204).end();
  });

  return router;
}
