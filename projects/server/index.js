import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedProjects } from '../src/data.js';
import { createOperationalRouter } from './operational.js';
import { createFormsRouter } from './forms.js';
import { createManagementRouter } from './management.js';
import { createOperationsRouter } from './operations.js';

const { Pool, Client } = pg;
const execFileAsync = promisify(execFile);
const DATA_DIR = process.env.PROJECTS_DATA_DIR || '/data';
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const OPTIONS_FILE = process.env.PROJECTS_OPTIONS_FILE || '/data/options.json';
const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);
const PORT = Number(process.env.PORT || 3000);
const ROLES = ['admin', 'manager', 'technician', 'finance', 'viewer'];
const EDIT_ROLES = ['admin', 'manager', 'technician', 'finance'];

await mkdir(BACKUP_DIR, { recursive: true });

async function readOptions() {
  try {
    return JSON.parse(await readFile(OPTIONS_FILE, 'utf8'));
  } catch {
    return {
      admin_username: process.env.PROJECTS_ADMIN_USERNAME || 'admin',
      admin_password: process.env.PROJECTS_ADMIN_PASSWORD || 'change-me-now',
    };
  }
}

async function ensureDatabase() {
  const client = new Client({ ...databaseConfig('postgres') });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = 'projects'");
  if (!exists.rowCount) await client.query('CREATE DATABASE projects');
  await client.end();
}

function databaseConfig(database = process.env.PGDATABASE || 'projects') {
  return {
    host: process.env.PGHOST || '/run/postgresql',
    user: process.env.PGUSER || 'postgres',
    database,
    max: 10,
  };
}

await ensureDatabase();
const pool = new Pool(databaseConfig());
const liveResponses = new Set();
const liveListener = await pool.connect();
await liveListener.query('LISTEN projects_live_change');
liveListener.on('notification', (message) => {
  for (const response of liveResponses) response.write(`event: change\ndata: ${message.payload || '{}'}\n\n`);
});
liveListener.on('error', (error) => console.error('Live update listener error', error.message));

async function runMigrations() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (applied.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(new URL(name, MIGRATIONS_DIR), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
      console.log(`Applied migration ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

const projectColumns = [
  'id', 'name', 'client', 'location', 'address', 'lat', 'lng', 'stage', 'progress', 'manager',
  'owner_initials', 'value', 'paid', 'due', 'priority', 'flag', 'systems', 'next_milestone',
  'phone', 'email', 'health', 'tasks_done', 'tasks_total', 'manager_professional_id', 'client_id',
  'project_size', 'contractor_progress',
];
const inputToColumn = {
  id: 'id', name: 'name', client: 'client', location: 'location', address: 'address', lat: 'lat', lng: 'lng',
  stage: 'stage', progress: 'progress', manager: 'manager', ownerInitials: 'owner_initials', value: 'value',
  paid: 'paid', due: 'due', priority: 'priority', flag: 'flag', systems: 'systems',
  nextMilestone: 'next_milestone', phone: 'phone', email: 'email', health: 'health',
  tasksDone: 'tasks_done', tasksTotal: 'tasks_total',
  managerId: 'manager_professional_id',
  clientId: 'client_id',
  projectSize: 'project_size', contractorProgress: 'contractor_progress',
};
const STAGE_PROGRESS = { waiting:0,mobilization:9,infrastructure:18,threading:27,electrician_threading:36,threading_done:45,installation_a:55,installation_b:65,installation_c:75,activation_programming:85,finishes:93,post_delivery:100 };

function projectFromRow(row) {
  return {
    id: row.id, name: row.name, client: row.client, location: row.location, address: row.address,
    lat: Number(row.lat), lng: Number(row.lng), stage: row.stage, progress: Number(row.progress),
    manager: row.manager, ownerInitials: row.owner_initials, value: Number(row.value), paid: Number(row.paid),
    due: row.due, priority: row.priority, flag: row.flag, systems: row.systems || [],
    nextMilestone: row.next_milestone, phone: row.phone, email: row.email, health: Number(row.health),
    tasksDone: Number(row.tasks_done), tasksTotal: Number(row.tasks_total), managerId: row.manager_professional_id, clientId: row.client_id,
    archived: Boolean(row.archived_at), archivedAt: row.archived_at, archivedBy: row.archived_by,
    projectSize: row.project_size || 'medium', contractorProgress: row.contractor_progress || 'waiting',
  };
}

async function resolveProjectClient(db, input, currentProject = null) {
  const requestedId = input.clientId;
  if (requestedId) {
    const selected = await db.query('SELECT * FROM clients WHERE id=$1', [requestedId]);
    if (!selected.rowCount) throw Object.assign(new Error('הלקוח שנבחר לא נמצא'), { status: 400 });
    return selected.rows[0];
  }

  const draft = input.newClient || ((!currentProject && input.client) ? {
    name: input.client, address: input.address, phone: input.phone, email: input.email, city: input.location,
  } : null);
  if (draft) {
    const name = String(draft.name || '').trim();
    const address = String(draft.address || '').trim();
    const phone = String(draft.phone || '').trim();
    if (!name || !address || !phone) throw Object.assign(new Error('ללקוח חדש חובה להזין שם, כתובת וטלפון'), { status: 400 });
    const existing = await db.query('SELECT * FROM clients WHERE lower(btrim(name))=lower($1) AND btrim(phone)=btrim($2) LIMIT 1', [name, phone]);
    if (existing.rowCount) return existing.rows[0];
    const next = await db.query("SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D','','g'),'')::int),1000)+1 AS value FROM clients");
    const created = await db.query(
      `INSERT INTO clients(code,name,client_type,primary_contact_name,phone,email,address,city)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [`CUS-${next.rows[0].value}`, name, draft.clientType || 'private', draft.primaryContactName || name, phone, draft.email || '', address, draft.city || input.location || ''],
    );
    return created.rows[0];
  }

  if (currentProject?.client_id) {
    const current = await db.query('SELECT * FROM clients WHERE id=$1', [currentProject.client_id]);
    if (current.rowCount) return current.rows[0];
  }
  return null;
}

async function geocodeAddress(address) {
  if (!String(address || '').trim()) return null;
  try {
    const setting=await pool.query("SELECT value FROM app_settings WHERE key='map'"); const key=setting.rows[0]?.value?.googleApiKey;
    if(!key)return null;
    const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.searchParams.set('address',address);url.searchParams.set('components','country:IL');url.searchParams.set('language','he');url.searchParams.set('key',key);
    const response=await fetch(url);if(!response.ok)return null;const data=await response.json();const first=data.results?.[0];return first?{lat:first.geometry.location.lat,lng:first.geometry.location.lng,formattedAddress:first.formatted_address}:null;
  } catch { return null; }
}

async function seedDatabase() {
  const options = await readOptions();
  const username = String(options.admin_username || 'admin').trim();
  const password = String(options.admin_password || 'change-me-now');
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users(username, display_name, password_hash, role)
     VALUES($1, $2, $3, 'admin')
     ON CONFLICT(username) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
    [username, username, passwordHash],
  );

  const count = await pool.query('SELECT COUNT(*)::int AS count FROM projects');
  if (count.rows[0].count > 0) return;
  for (const project of seedProjects) {
    const legacyStages = { planning:'waiting',installation:'installation_b',programming:'activation_programming',handover:'finishes',completed:'post_delivery' };
    const seededProject = { projectSize:'medium', contractorProgress:'waiting', ...project, stage:legacyStages[project.stage] || project.stage };
    seededProject.progress = STAGE_PROGRESS[seededProject.stage] ?? seededProject.progress;
    const values = projectColumns.map((column) => {
      const inputKey = Object.keys(inputToColumn).find((key) => inputToColumn[key] === column);
      return column === 'systems' ? JSON.stringify(seededProject[inputKey] || []) : seededProject[inputKey];
    });
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await pool.query(`INSERT INTO projects(${projectColumns.join(', ')}) VALUES(${placeholders})`, values);
  }
}

async function ensureSeedRelationships() {
  await pool.query(`
    INSERT INTO clients(code,name,primary_contact_name,phone,email,address,city)
    SELECT 'CUS-' || upper(substr(md5(p.client),1,8)),p.client,p.client,MAX(p.phone),MAX(p.email),MAX(p.address),MAX(p.location)
    FROM projects p
    WHERE btrim(COALESCE(p.client,''))<>'' AND NOT EXISTS (SELECT 1 FROM clients c WHERE lower(c.name)=lower(p.client))
    GROUP BY p.client
    HAVING btrim(COALESCE(MAX(p.phone),''))<>'' AND btrim(COALESCE(MAX(p.address),''))<>''
    ON CONFLICT(code) DO NOTHING;

    UPDATE projects p SET client_id=c.id FROM clients c
    WHERE p.client_id IS NULL AND lower(c.name)=lower(p.client);

    INSERT INTO professionals(display_name,affiliation,job_title,color,icon)
    SELECT DISTINCT btrim(p.manager),'company','מנהל פרויקט','#6957df','folder-kanban'
    FROM projects p
    WHERE btrim(COALESCE(p.manager,''))<>'' AND NOT EXISTS (SELECT 1 FROM professionals person WHERE lower(person.display_name)=lower(btrim(p.manager)) AND person.affiliation='company');

    INSERT INTO professional_role_assignments(professional_id,role_type_id)
    SELECT person.id,role.id FROM professionals person CROSS JOIN professional_role_types role
    WHERE role.role_key='project_manager' AND person.affiliation='company' AND person.job_title='מנהל פרויקט'
    ON CONFLICT DO NOTHING;

    UPDATE projects p SET manager_professional_id=person.id FROM professionals person
    WHERE p.manager_professional_id IS NULL AND lower(person.display_name)=lower(btrim(p.manager)) AND person.affiliation='company';

    INSERT INTO project_payments(project_id,title,amount,status,paid_at,notes)
    SELECT p.id,'יתרת פתיחה',p.paid,'paid',CURRENT_DATE,'נוצר אוטומטית מהנתונים הקיימים'
    FROM projects p WHERE p.paid>0 AND NOT EXISTS (SELECT 1 FROM project_payments payment WHERE payment.project_id=p.id);
  `);
}

await runMigrations();
await seedDatabase();
try {
  await ensureSeedRelationships();
} catch (error) {
  // Legacy normalization is helpful but must never prevent the API from
  // starting. Incomplete historical records remain editable in the app.
  console.warn('Skipped legacy relationship normalization:', error.message);
}

const secretFile = path.join(DATA_DIR, 'jwt.secret');
let jwtSecret;
try {
  jwtSecret = (await readFile(secretFile, 'utf8')).trim();
} catch {
  jwtSecret = randomBytes(48).toString('base64url');
  await writeFile(secretFile, jwtSecret, { mode: 0o600 });
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));

function cookieValue(request, name) {
  const cookies = Object.fromEntries((request.headers.cookie || '').split(';').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }).filter(([key]) => key));
  return cookies[name];
}

function publicUser(row) {
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, active: row.active, haUserId: row.ha_user_id, avatarColor: row.avatar_color || '#6957df', avatarIcon: row.avatar_icon || 'user', appearanceTheme: row.appearance_theme || 'light' };
}

async function authenticate(request, response, next) {
  try {
    if (request.get('X-Projects-Ingress') === 'true') {
      // Port 8099 is restricted by Nginx to the Supervisor ingress gateway. Some
      // Supervisor versions omit identity headers, but authentication has still
      // already been completed by Home Assistant.
      const haUserId = request.get('X-Remote-User-Id') || 'projects-ingress-admin';
      const displayName = request.get('X-Remote-User-Display-Name') || request.get('X-Remote-User-Name') || 'Home Assistant Admin';
      const result = await pool.query(
        `INSERT INTO users(display_name, role, ha_user_id)
         VALUES($1, 'admin', $2)
         ON CONFLICT(ha_user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()
         RETURNING *`,
        [displayName, haUserId],
      );
      request.user = publicUser(result.rows[0]);
      if (!request.user.active) return response.status(403).json({ error: 'User is disabled' });
      return next();
    }

    const token = cookieValue(request, 'projects_session') || request.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return response.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, jwtSecret);
    const result = await pool.query('SELECT * FROM users WHERE id = $1 AND active = TRUE', [payload.sub]);
    if (!result.rowCount) return response.status(401).json({ error: 'User is unavailable' });
    request.user = publicUser(result.rows[0]);
    next();
  } catch {
    response.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireRoles(...roles) {
  return (request, response, next) => roles.includes(request.user.role) ? next() : response.status(403).json({ error: 'Insufficient permissions' });
}

async function audit(request, action, entityType, entityId, details = {}) {
  await pool.query(
    'INSERT INTO audit_log(user_id, action, entity_type, entity_id, details) VALUES($1, $2, $3, $4, $5)',
    [request.user?.id || null, action, entityType, entityId, details],
  );
}

async function resolveProjectManager(managerId) {
  if (!managerId) return null;
  const result = await pool.query(
    `SELECT p.id,p.display_name FROM professionals p
     WHERE p.id=$1 AND p.active=TRUE AND p.affiliation='company'
       AND EXISTS (SELECT 1 FROM professional_role_assignments a JOIN professional_role_types r ON r.id=a.role_type_id WHERE a.professional_id=p.id AND r.role_key='project_manager' AND r.active=TRUE)`,
    [managerId],
  );
  if (!result.rowCount) { const error = new Error('יש לבחור מנהל פרויקט פעיל מתוך עובדי החברה'); error.statusCode = 400; throw error; }
  return result.rows[0];
}

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'ok', version: '0.7.5' });
  } catch (error) {
    response.status(503).json({ status: 'error', database: 'unavailable', message: error.message });
  }
});

app.post('/api/auth/login', async (request, response) => {
  const username = String(request.body?.username || '').trim();
  const password = String(request.body?.password || '');
  const result = await pool.query('SELECT * FROM users WHERE username = $1 AND active = TRUE', [username]);
  if (!result.rowCount || !result.rows[0].password_hash || !await bcrypt.compare(password, result.rows[0].password_hash)) {
    return response.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }
  const user = publicUser(result.rows[0]);
  const token = jwt.sign({ sub: String(user.id), role: user.role }, jwtSecret, { expiresIn: '12h' });
  response.cookie('projects_session', token, { httpOnly: true, sameSite: 'strict', secure: request.secure, maxAge: 12 * 60 * 60 * 1000, path: '/' });
  await audit({ user }, 'login', 'session', String(user.id));
  response.json({ user });
});

app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie('projects_session', { path: '/' });
  response.status(204).end();
});

app.get('/api/auth/me', authenticate, (request, response) => response.json({ user: request.user }));

app.get('/api/live', authenticate, (request, response) => {
  response.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  response.flushHeaders(); response.write('event: ready\ndata: {}\n\n'); liveResponses.add(response);
  const heartbeat=setInterval(()=>response.write(': keepalive\n\n'),25000);
  request.on('close',()=>{clearInterval(heartbeat);liveResponses.delete(response)});
});

app.get('/api/projects', authenticate, async (request, response) => {
  const scope = ['active', 'archived', 'all'].includes(request.query.scope) ? request.query.scope : 'active';
  const where = scope === 'all' ? '' : scope === 'archived' ? 'WHERE p.archived_at IS NOT NULL' : 'WHERE p.archived_at IS NULL';
  const result = await pool.query(`SELECT p.*,COALESCE(pr.display_name,p.manager) manager
    FROM projects p LEFT JOIN professionals pr ON pr.id=p.manager_professional_id
    ${where}
    ORDER BY p.created_at DESC,p.id DESC`);
  response.json({ projects: result.rows.map(projectFromRow) });
});

app.post('/api/projects', authenticate, requireRoles('admin', 'manager'), async (request, response) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const nextNumber = await db.query("SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 1000) + 1 AS value FROM projects");
    const selectedManager = await resolveProjectManager(request.body.managerId);
    const selectedClient = await resolveProjectClient(db, request.body);
    if (!selectedClient) throw Object.assign(new Error('יש לבחור לקוח קיים או ליצור לקוח חדש'), { status: 400 });
    const geocoded=await geocodeAddress(request.body.address || selectedClient.address || request.body.location);
    const project = {
    id: request.body.id || `PRJ-${nextNumber.rows[0].value}`,
    name: request.body.name || 'פרויקט חדש', client: selectedClient.name, location: request.body.location || selectedClient.city || '',
    address: geocoded?.formattedAddress || request.body.address || selectedClient.address || request.body.location || '', lat: geocoded?.lat ?? request.body.lat ?? 32.0853, lng: geocoded?.lng ?? request.body.lng ?? 34.7818,
    stage: request.body.stage || 'waiting', progress: STAGE_PROGRESS[request.body.stage || 'waiting'] ?? 0, manager: selectedManager?.display_name || '',
    ownerInitials: selectedManager?.display_name?.slice(0, 2) || '', value: request.body.value ?? 0,
    paid: request.body.paid ?? 0, due: request.body.due || '', priority: request.body.priority || 'normal', flag: request.body.flag || '',
    systems: request.body.systems || [], nextMilestone: request.body.nextMilestone || 'אפיון ראשוני', phone: request.body.phone || selectedClient.phone || '',
    email: request.body.email || selectedClient.email || '', health: request.body.health ?? 100, tasksDone: request.body.tasksDone ?? 0, tasksTotal: request.body.tasksTotal ?? 0,
    managerId: request.body.managerId || null, clientId: selectedClient.id, projectSize: request.body.projectSize || 'medium', contractorProgress: request.body.contractorProgress || 'waiting',
    };
    const values = Object.keys(inputToColumn).map((key) => key === 'systems' ? JSON.stringify(project[key]) : project[key]);
    const columns = Object.values(inputToColumn);
    const result = await db.query(
    `INSERT INTO projects(${columns.join(', ')}) VALUES(${values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
    values,
    );
    await db.query('COMMIT');
    await audit(request, 'create', 'project', project.id, { clientId: selectedClient.id });
    response.status(201).json({ project: projectFromRow(result.rows[0]) });
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.status) return response.status(error.status).json({ error: error.message });
    throw error;
  } finally { db.release(); }
});

app.patch('/api/projects/:id', authenticate, requireRoles(...EDIT_ROLES), async (request, response) => {
  const allowedByRole = {
    admin: Object.keys(inputToColumn).filter((key) => key !== 'id'),
    manager: Object.keys(inputToColumn).filter((key) => key !== 'id'),
    technician: ['stage', 'progress', 'flag', 'systems', 'nextMilestone', 'health', 'tasksDone', 'tasksTotal'],
    finance: ['paid', 'value', 'flag'],
  };
  if (Object.prototype.hasOwnProperty.call(request.body || {}, 'managerId')) {
    const selectedManager = await resolveProjectManager(request.body.managerId);
    request.body.manager = selectedManager?.display_name || '';
    request.body.ownerInitials = selectedManager?.display_name?.slice(0, 2) || '';
  }
  if (Object.prototype.hasOwnProperty.call(request.body || {}, 'stage')) {
    if (Object.prototype.hasOwnProperty.call(STAGE_PROGRESS, request.body.stage)) request.body.progress = STAGE_PROGRESS[request.body.stage];
  }
  if (!Object.prototype.hasOwnProperty.call(request.body || {}, 'stage')) delete request.body.progress;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const current = await db.query('SELECT * FROM projects WHERE id=$1 FOR UPDATE', [request.params.id]);
    if (!current.rowCount) { await db.query('ROLLBACK'); return response.status(404).json({ error: 'Project not found' }); }
    if (['admin', 'manager'].includes(request.user.role) && (request.body.clientId || request.body.newClient)) {
      const selectedClient = await resolveProjectClient(db, request.body, current.rows[0]);
      request.body.clientId = selectedClient.id;
      request.body.client = selectedClient.name;
    }
    if (['admin','manager'].includes(request.user.role) && request.body.address && request.body.address!==current.rows[0].address) { const geocoded=await geocodeAddress(request.body.address);if(geocoded){request.body.address=geocoded.formattedAddress;request.body.lat=geocoded.lat;request.body.lng=geocoded.lng;} }
    if (['admin', 'manager'].includes(request.user.role) && Object.prototype.hasOwnProperty.call(request.body, 'clientName')) {
      const clientName = String(request.body.clientName || '').trim();
      if (!clientName) throw Object.assign(new Error('שם לקוח אינו יכול להיות ריק'), { status: 400 });
      const clientId = request.body.clientId || current.rows[0].client_id;
      if (!clientId) throw Object.assign(new Error('יש לקשר את הפרויקט ללקוח לפני שינוי שמו'), { status: 400 });
      await db.query('UPDATE clients SET name=$1,updated_at=NOW() WHERE id=$2', [clientName, clientId]);
      await db.query('UPDATE projects SET client=$1,updated_at=NOW() WHERE client_id=$2', [clientName, clientId]);
      request.body.client = clientName;
      delete request.body.clientName;
    }
    delete request.body.newClient;
    const entries = Object.entries(request.body || {}).filter(([key]) => allowedByRole[request.user.role].includes(key));
    if (!entries.length) { await db.query('ROLLBACK'); return response.status(400).json({ error: 'No editable fields supplied' }); }
    const sets = entries.map(([key], index) => `${inputToColumn[key]} = $${index + 1}`);
    const values = entries.map(([key, value]) => key === 'systems' ? JSON.stringify(value) : value);
    values.push(request.params.id);
    const result = await db.query(`UPDATE projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    await db.query('COMMIT');
    await audit(request, 'update', 'project', request.params.id, Object.fromEntries(entries));
    response.json({ project: projectFromRow(result.rows[0]) });
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.status) return response.status(error.status).json({ error: error.message });
    throw error;
  } finally { db.release(); }
});

app.patch('/api/projects/:id/archive', authenticate, requireRoles('admin', 'manager'), async (request, response) => {
  const archived = request.body.archived !== false;
  const result = await pool.query(
    `UPDATE projects SET archived_at=$1,archived_by=$2,updated_at=NOW() WHERE id=$3 RETURNING *`,
    [archived ? new Date() : null, archived ? request.user.id : null, request.params.id],
  );
  if (!result.rowCount) return response.status(404).json({ error: 'Project not found' });
  await audit(request, archived ? 'archive' : 'restore', 'project', request.params.id);
  response.json({ project: projectFromRow(result.rows[0]) });
});

app.get('/api/users', authenticate, requireRoles('admin'), async (_request, response) => {
  const result = await pool.query('SELECT * FROM users ORDER BY created_at');
  response.json({ users: result.rows.map(publicUser) });
});

app.post('/api/users', authenticate, requireRoles('admin'), async (request, response) => {
  const username = String(request.body.username || '').trim();
  const password = String(request.body.password || '');
  const role = ROLES.includes(request.body.role) ? request.body.role : 'viewer';
  if (!username || password.length < 8) return response.status(400).json({ error: 'Username and password of at least 8 characters are required' });
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users(username, display_name, password_hash, role, avatar_color, avatar_icon)
     VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
    [username, request.body.displayName || username, passwordHash, role, request.body.avatarColor || '#6957df', request.body.avatarIcon || 'user'],
  );
  await audit(request, 'create', 'user', String(result.rows[0].id), { username, role });
  response.status(201).json({ user: publicUser(result.rows[0]) });
});

app.patch('/api/users/:id', authenticate, requireRoles('admin'), async (request, response) => {
  const updates = [];
  const values = [];
  if (request.body.displayName) { values.push(request.body.displayName); updates.push(`display_name = $${values.length}`); }
  if (ROLES.includes(request.body.role)) { values.push(request.body.role); updates.push(`role = $${values.length}`); }
  if (typeof request.body.active === 'boolean') { values.push(request.body.active); updates.push(`active = $${values.length}`); }
  if (request.body.avatarColor) { values.push(request.body.avatarColor); updates.push(`avatar_color = $${values.length}`); }
  if (request.body.avatarIcon) { values.push(request.body.avatarIcon); updates.push(`avatar_icon = $${values.length}`); }
  if (request.body.password) {
    if (String(request.body.password).length < 8) return response.status(400).json({ error: 'Password must contain at least 8 characters' });
    values.push(await bcrypt.hash(String(request.body.password), 12)); updates.push(`password_hash = $${values.length}`);
  }
  if (!updates.length) return response.status(400).json({ error: 'No editable fields supplied' });
  values.push(request.params.id);
  const result = await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
  if (!result.rowCount) return response.status(404).json({ error: 'User not found' });
  await audit(request, 'update', 'user', request.params.id);
  response.json({ user: publicUser(result.rows[0]) });
});

app.delete('/api/users/:id', authenticate, requireRoles('admin'), async (request, response) => {
  if (String(request.user.id) === String(request.params.id)) return response.status(409).json({ error: 'לא ניתן למחוק את המשתמש המחובר' });
  const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id,display_name', [request.params.id]);
  if (!result.rowCount) return response.status(404).json({ error: 'User not found' });
  await audit(request, 'delete', 'user', request.params.id, { displayName: result.rows[0].display_name });
  response.status(204).end();
});

app.get('/api/system/backups', authenticate, requireRoles('admin'), async (_request, response) => {
  const files = await readdir(BACKUP_DIR);
  const backups = await Promise.all(files.filter((name) => /^projects-.*\.dump$/.test(name)).map(async (name) => {
    const info = await stat(path.join(BACKUP_DIR, name));
    return { name, size: info.size, createdAt: info.mtime.toISOString() };
  }));
  response.json({ backups: backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
});

app.post('/api/system/backups', authenticate, requireRoles('admin'), async (request, response) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `projects-${stamp}.dump`;
  await execFileAsync('pg_dump', ['--format=custom', '--no-owner', '--file', path.join(BACKUP_DIR, name), 'projects'], { env: process.env });
  await audit(request, 'backup', 'system', name);
  response.status(201).json({ backup: { name } });
});

app.post('/api/system/restore', authenticate, requireRoles('admin'), async (request, response) => {
  const name = path.basename(String(request.body.name || ''));
  if (!/^projects-.*\.dump$/.test(name)) return response.status(400).json({ error: 'Invalid backup name' });
  const backupPath = path.join(BACKUP_DIR, name);
  await stat(backupPath);
  await audit(request, 'restore_requested', 'system', name);
  await writeFile(path.join(DATA_DIR, 'restore.request'), backupPath);
  response.status(202).json({ status: 'restarting', message: 'Restore scheduled' });
  setTimeout(async () => {
    await pool.end();
    process.exit(0);
  }, 500);
});

app.use('/api', await createOperationalRouter({ pool, authenticate, requireRoles, audit, dataDir: DATA_DIR }));
app.use('/api', createFormsRouter({ pool, authenticate, requireRoles, audit }));
app.use('/api', await createManagementRouter({ pool, authenticate, requireRoles, audit, dataDir: DATA_DIR }));
app.use('/api', createOperationsRouter({ pool, authenticate, requireRoles, audit }));

app.use('/api', (_request, response) => response.status(404).json({ error: 'Not found' }));
app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.statusCode) return response.status(error.statusCode).json({ error: error.message });
  if (error.code === '23505') return response.status(409).json({ error: 'A record with these details already exists' });
  if (error.code === '23503') return response.status(409).json({ error: 'לא ניתן למחוק רשומה שנמצאת בשימוש; אפשר להשבית אותה' });
  if (error.code === '23514' || error.code === '22P02') return response.status(400).json({ error: 'Invalid field value' });
  response.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '127.0.0.1', () => console.log(`PROJECTS API listening on ${PORT}`));

async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
