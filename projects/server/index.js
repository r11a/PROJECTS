import express from 'express';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedProjects } from '../src/data.js';
import { createOperationalRouter } from './operational.js';
import { createFormsRouter } from './forms.js';
import { createManagementRouter } from './management.js';
import { createOperationsRouter } from './operations.js';
import { createGeocoder } from './geocoder.js';
import { createBackupRouter } from './backup.js';
import { createAiRouter } from './ai.js';
import { createProductivityRouter, executeAutomations, startAutomationScheduler } from './productivity.js';
import { createPriorityOrdersRouter } from './priorityOrders.js';
import { createProjectIntelligenceRouter, loadProjectHealth } from './projectIntelligence.js';
import { createPushService, startPushScheduler } from './pushNotifications.js';
import { imageFileFilter } from './uploadPolicy.js';
import { installPostgresDateOnlyParser } from './dateOnly.js';

const { Pool, Client, types } = pg;
installPostgresDateOnlyParser(types);
const DATA_DIR = process.env.PROJECTS_DATA_DIR || '/data';
const OPTIONS_FILE = process.env.PROJECTS_OPTIONS_FILE || '/data/options.json';
const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);
const PORT = Number(process.env.PORT || 3000);
const APP_VERSION = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const ROLES = ['admin', 'manager', 'supervisor', 'technician', 'finance', 'viewer', 'custom'];
const EDIT_ROLES = ['admin', 'manager', 'supervisor', 'technician', 'finance', 'custom'];

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
const geocoder = createGeocoder(pool);
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
  'installation_hours_target', 'programming_hours_target',
  'phone', 'email', 'health', 'tasks_done', 'tasks_total', 'manager_professional_id', 'client_id',
  'project_size', 'contractor_progress', 'document_folder', 'project_classification', 'project_category', 'project_category_custom', 'project_profile',
  'project_icon', 'project_color', 'installation_lead_professional_id',
  'finance_mode', 'payment_terms', 'deposit_amount', 'deposit_paid', 'finance_breakdown',
];
const inputToColumn = {
  id: 'id', name: 'name', client: 'client', location: 'location', address: 'address', lat: 'lat', lng: 'lng',
  stage: 'stage', progress: 'progress', manager: 'manager', ownerInitials: 'owner_initials', value: 'value',
  paid: 'paid', due: 'due', priority: 'priority', flag: 'flag', systems: 'systems',
  installationHoursTarget:'installation_hours_target',programmingHoursTarget:'programming_hours_target',
  nextMilestone: 'next_milestone', phone: 'phone', email: 'email', health: 'health',
  tasksDone: 'tasks_done', tasksTotal: 'tasks_total',
  managerId: 'manager_professional_id',
  clientId: 'client_id',
  projectSize: 'project_size', contractorProgress: 'contractor_progress', documentFolder:'document_folder',
  projectClassification: 'project_classification',
  projectCategory: 'project_category', projectCategoryCustom: 'project_category_custom', projectProfile: 'project_profile',
  projectIcon: 'project_icon', projectColor: 'project_color', installationLeadId: 'installation_lead_professional_id',
  financeMode: 'finance_mode', paymentTerms: 'payment_terms', depositAmount: 'deposit_amount', depositPaid: 'deposit_paid', financeBreakdown: 'finance_breakdown',
};
const STAGE_PROGRESS = { waiting:0,mobilization:9,infrastructure:18,threading:27,electrician_threading:36,threading_done:45,installation_a:55,installation_b:65,installation_c:75,activation_programming:85,finishes:93,post_delivery:100 };

function withoutArabic(value = '') {
  return String(value).replace(/[\u0600-\u06ff]+/g, '').replace(/\s+,/g, ',').replace(/,\s*,+/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
}

function projectFromRow(row) {
  return {
    id: row.id, serialCode:row.serial_code, name: row.name, client: row.client, location: row.location, address: withoutArabic(row.address),
    lat: Number(row.lat), lng: Number(row.lng), stage: row.stage, progress: Number(row.progress),
    manager: row.manager, ownerInitials: row.owner_initials, value: Number(row.value), paid: Number(row.paid),
    due: row.due, priority: row.priority, flag: row.flag, systems: Array.isArray(row.systems) ? row.systems : [], installationHoursTarget:Number(row.installation_hours_target||0),programmingHoursTarget:Number(row.programming_hours_target||0),
    nextMilestone: row.next_milestone, phone: row.phone, email: row.email, health: Number(row.health),
    tasksDone: Number(row.tasks_done), tasksTotal: Number(row.tasks_total), managerId: row.manager_professional_id, clientId: row.client_id,
    archived: Boolean(row.archived_at), archivedAt: row.archived_at, archivedBy: row.archived_by,
    projectSize: row.project_size || 'medium', contractorProgress: row.contractor_progress || 'waiting', documentFolder:row.document_folder || '',
    projectClassification: row.project_classification || 'private_house',
    projectCategory: row.project_category || 'smart_home', projectCategoryCustom: row.project_category_custom || '', projectProfile: row.project_profile && typeof row.project_profile==='object' ? row.project_profile : {},
    projectIcon: row.project_icon || '', projectColor: row.project_color || '#6957df', installationLeadId: row.installation_lead_professional_id,
    managerUserId: row.manager_user_id || null, managerAvatarColor: row.manager_avatar_color || row.manager_color || '#6957df',
    nextTaskTitle: row.next_task_title || row.next_milestone || '', nextTaskDate: row.next_task_date || row.due || '', nextTaskAssignee: row.next_task_assignee || '',
    completed: Boolean(row.completed_at), completedAt: row.completed_at, completedBy: row.completed_by,
    financeMode: row.finance_mode || 'total', paymentTerms: row.payment_terms || '', depositAmount:Number(row.deposit_amount||0), depositPaid:Boolean(row.deposit_paid), financeBreakdown:Array.isArray(row.finance_breakdown) ? row.finance_breakdown : [],
  };
}

function projectForUser(row, user) {
  const project = projectFromRow(row);
  if (user?.financeAccess !== false) return project;
  return {
    ...project,
    value: 0,
    paid: 0,
    financeMode: 'restricted',
    paymentTerms: '',
    depositAmount: 0,
    depositPaid: false,
    financeBreakdown: [],
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
    const rawName = String(draft.name || '').trim();
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const firstName = String(draft.firstName || (nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : rawName)).trim();
    const lastName = String(draft.lastName || (nameParts.length > 1 ? nameParts.at(-1) : '')).trim();
    const name = [firstName,lastName].filter(Boolean).join(' ');
    const address = String(draft.address || '').trim();
    const phone = String(draft.phone || '').trim();
    if (!name || !address || !phone) throw Object.assign(new Error('ללקוח חדש חובה להזין שם, כתובת וטלפון'), { status: 400 });
    const existing = await db.query('SELECT * FROM clients WHERE lower(btrim(name))=lower($1) AND btrim(phone)=btrim($2) LIMIT 1', [name, phone]);
    if (existing.rowCount) return existing.rows[0];
    const next = await db.query("SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D','','g'),'')::int),1000)+1 AS value FROM clients");
    const created = await db.query(
      `INSERT INTO clients(code,name,first_name,last_name,client_type,primary_contact_name,phone,email,address,city,apartment_number)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [`CUS-${next.rows[0].value}`, name, firstName, lastName, draft.clientType || 'private', draft.primaryContactName || name, phone, draft.email || '', address, draft.city || input.location || '', draft.apartmentNumber || ''],
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
    return await geocoder.geocode(address);
  } catch { return null; }
}

async function seedDatabase() {
  const options = await readOptions();
  const username = String(options.admin_username || 'admin').trim();
  const password = String(options.admin_password || 'change-me-now');
  const existing = await pool.query('SELECT id,password_hash FROM users WHERE username=$1', [username]);
  if (!existing.rowCount) {
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(`INSERT INTO users(username,display_name,password_hash,role,must_change_password)
      VALUES($1,$2,$3,'admin',$4)`, [username, username, passwordHash, password === 'change-me-now']);
  } else if (existing.rows[0].password_hash && await bcrypt.compare('change-me-now', existing.rows[0].password_hash)) {
    await pool.query('UPDATE users SET must_change_password=TRUE WHERE id=$1', [existing.rows[0].id]);
  }

  await seedDemoProjects();
}

async function seedDemoProjects() {
  const setting = await pool.query("SELECT value FROM app_settings WHERE key='demoData'");
  if (setting.rows[0]?.value?.enabled === false) return 0;
  const dataState = await pool.query(`SELECT
    COUNT(*) FILTER (WHERE is_demo=TRUE)::int demo_count,
    COUNT(*) FILTER (WHERE is_demo=FALSE)::int real_count FROM projects`);
  if (dataState.rows[0].real_count > 0 && dataState.rows[0].demo_count === 0) return 0;
  const existing = await pool.query('SELECT id FROM projects WHERE id=ANY($1::text[])', [seedProjects.map((project) => project.id)]);
  const existingIds = new Set(existing.rows.map((row) => row.id));
  let inserted = 0;
  for (const project of seedProjects) {
    if (existingIds.has(project.id)) continue;
    const legacyStages = { planning:'waiting',installation:'installation_b',programming:'activation_programming',handover:'finishes',completed:'post_delivery' };
    const seededProject = {
      projectSize:'medium', contractorProgress:'waiting', documentFolder:'', projectClassification:'private_house',
      projectIcon:'', projectColor:'#6957df',
      financeMode:'total', paymentTerms:'', depositAmount:0, depositPaid:false, financeBreakdown:[],
      installationHoursTarget:0, programmingHoursTarget:0,
      ...project, stage:legacyStages[project.stage] || project.stage,
    };
    seededProject.progress = STAGE_PROGRESS[seededProject.stage] ?? seededProject.progress;
    const values = projectColumns.map((column) => {
      const inputKey = Object.keys(inputToColumn).find((key) => inputToColumn[key] === column);
      if (column === 'systems' || column === 'finance_breakdown') return JSON.stringify(seededProject[inputKey] || []);
      if (column === 'installation_hours_target' || column === 'programming_hours_target') {
        return Math.max(0, Number(seededProject[inputKey]) || 0);
      }
      return seededProject[inputKey];
    });
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await pool.query(`INSERT INTO projects(${projectColumns.join(', ')}) VALUES(${placeholders})`, values);
    await pool.query('UPDATE projects SET is_demo=TRUE WHERE id=$1', [project.id]);
    inserted += 1;
  }
  return inserted;
}

async function demoDataState(db = pool) {
  const result = await db.query(`SELECT
    COALESCE((SELECT (value->>'enabled')::boolean FROM app_settings WHERE key='demoData'),TRUE) enabled,
    (SELECT COUNT(*)::int FROM projects WHERE is_demo=TRUE) project_count,
    (SELECT COUNT(*)::int FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE is_demo=TRUE)) task_count,
    ((SELECT COUNT(*) FROM projects WHERE is_demo=FALSE) > 0
      OR (SELECT COUNT(*) FROM tasks task WHERE task.project_id IS NULL OR EXISTS (SELECT 1 FROM projects project WHERE project.id=task.project_id AND project.is_demo=FALSE)) > 0
      OR (SELECT COUNT(*) FROM clients client WHERE NOT EXISTS (SELECT 1 FROM projects project WHERE project.is_demo=TRUE AND project.client_id=client.id)) > 0
      OR (SELECT COUNT(*) FROM professionals person WHERE NOT EXISTS (SELECT 1 FROM projects project WHERE project.is_demo=TRUE AND project.manager_professional_id=person.id)) > 0
      OR (SELECT COUNT(*) FROM form_records form_record WHERE form_record.project_id IS NULL OR EXISTS (SELECT 1 FROM projects project WHERE project.id=form_record.project_id AND project.is_demo=FALSE)) > 0
      OR (SELECT COUNT(*) FROM site_inspections inspection WHERE inspection.project_id IS NULL OR EXISTS (SELECT 1 FROM projects project WHERE project.id=inspection.project_id AND project.is_demo=FALSE)) > 0) has_real_data`);
  return result.rows[0];
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
app.use(helmet({ contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:','https://*.tile.openstreetmap.org'],connectSrc:["'self'",'https://photon.komoot.io'],fontSrc:["'self'",'data:'],mediaSrc:["'self'",'blob:'],frameSrc:["'self'",'blob:'],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"],frameAncestors:["'self'",'http:','https:']}} }));
app.use(express.json({ limit: '1mb' }));

function cookieValue(request, name) {
  const cookies = Object.fromEntries((request.headers.cookie || '').split(';').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }).filter(([key]) => key));
  return cookies[name];
}

function publicUser(row) {
  const lockedUntil = row.locked_until ? new Date(row.locked_until).toISOString() : null;
  const isLocked = Boolean(row.locked_until && new Date(row.locked_until).getTime() > Date.now());
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, active: row.active, permissions:row.permissions||{}, financeAccess:canViewFinanceUser(row), mustChangePassword:Boolean(row.must_change_password), haUserId: row.ha_user_id, mergedIntoUserId:row.merged_into_user_id, identityTypes:[row.username?'web':null,row.ha_user_id?'ingress':null].filter(Boolean), avatarColor: row.avatar_color || '#6957df', avatarIcon: row.avatar_icon || 'user', avatarImage: row.avatar_image || '', appearanceTheme: row.appearance_theme || 'light', messageSoundEnabled:row.message_sound_enabled !== false, lastSeenAt:row.last_seen_at, lastLoginAt:row.last_login_at, online:Boolean(row.last_seen_at&&Date.now()-new Date(row.last_seen_at).getTime()<120000), failedLoginAttempts:Number(row.failed_login_attempts || 0), lockedUntil, isLocked };
}

function isStrongPassword(value) {
  const password = String(value || '');
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function generateStrongPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*';
  const all = `${upper}${lower}${digits}${symbols}`;
  const randomChar = (set) => set[randomBytes(1)[0] % set.length];
  const base = [
    randomChar(upper),
    randomChar(lower),
    randomChar(digits),
    randomChar(symbols),
  ];
  for (let index = 0; index < 16; index += 1) {
    base.push(all[randomBytes(1)[0] % all.length]);
  }
  const password = base
    .map((value, index, list) => list[(index * 13 + randomBytes(1)[0]) % list.length])
    .join('');
  if (isStrongPassword(password)) return password;
  return generateStrongPassword();
}

const ROLE_PERMISSIONS={
  admin:{'*':'write'}, manager:{projects:'write',clients:'write',professionals:'write',tasks:'write',calendar:'write',forms:'write',catalog:'write',finance:'write',reports:'read',messages:'write'},
  supervisor:{projects:'write',clients:'read',professionals:'read',tasks:'write',calendar:'write',forms:'write',catalog:'read',reports:'read',messages:'write'},
  technician:{projects:'read',tasks:'write',calendar:'read',forms:'write',catalog:'read',messages:'write'},
  finance:{projects:'read',clients:'read',finance:'write',reports:'read',messages:'write'}, viewer:{projects:'read',clients:'read',professionals:'read',tasks:'read',calendar:'read',forms:'read',catalog:'read',reports:'read',messages:'write'}, custom:{},
};
function canViewFinanceUser(user){
  if(!user||(user.financeAccess??user.finance_access)===false)return false;
  if(user.role==='admin')return true;
  const explicit=user.permissions?.finance;
  const level=explicit??ROLE_PERMISSIONS[user.role]?.finance??'none';
  return level==='read'||level==='write';
}
function permissionResource(request){const path=String(request.originalUrl||request.path).split('?')[0];if(/\/users|\/audit|\/backup|\/system\//.test(path))return 'settings';if(/payment|finance/.test(path))return 'finance';if(/equipment|catalog/.test(path))return 'catalog';if(/professional/.test(path))return 'professionals';if(/client/.test(path))return 'clients';if(/message/.test(path))return 'messages';if(/calendar/.test(path))return 'calendar';if(/task|milestone|gantt|my-work/.test(path))return 'tasks';if(/form|document|file|inspection|meeting/.test(path))return 'forms';if(/report|insight|presentation/.test(path))return 'reports';if(/project/.test(path))return 'projects';return null;}
function accessLevel(user,resource){if(resource==='finance'&&!canViewFinanceUser(user))return 'none';if(user.role==='admin')return 'write';return user.permissions?.[resource]||ROLE_PERMISSIONS[user.role]?.[resource]||'none';}
function requestAllowed(user,request){const resource=permissionResource(request);if(!resource)return true;const required=['GET','HEAD','OPTIONS'].includes(request.method)?'read':'write';const level=accessLevel(user,resource);return level==='write'||(required==='read'&&level==='read');}

const FINANCE_RESPONSE_KEYS = new Set([
  'finance','financeProjects','payments','financeBreakdown','financeMode','paymentTerms',
  'depositAmount','depositPaid','priceImpact','estimatedCost','estimatedCostUsd',
  'finance_projects','finance_breakdown','finance_mode','payment_terms','deposit_amount',
  'deposit_paid','price_impact','estimated_cost','estimated_cost_usd','monthlyBudgetUsd',
  'monthly_budget_usd','overdue_payments',
]);
function redactFinancePayload(value) {
  if (Array.isArray(value)) return value.map(redactFinancePayload);
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  const projectLike=('serialCode' in value||'serial_code' in value)&&('stage' in value||'client' in value);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !FINANCE_RESPONSE_KEYS.has(key)&&!(projectLike&&(key==='value'||key==='paid')))
    .map(([key, item]) => [key, redactFinancePayload(item)]));
}
function enforceFinanceResponsePolicy(response, user) {
  if (user?.financeAccess !== false || response.locals.financePolicyApplied) return;
  response.locals.financePolicyApplied = true;
  const sendJson = response.json.bind(response);
  response.json = (payload) => sendJson(redactFinancePayload(payload));
}

const presenceWrites=new Map();
async function touchPresence(user){const previous=presenceWrites.get(String(user.id))||0;if(Date.now()-previous<45000)return;presenceWrites.set(String(user.id),Date.now());const returningAfterAbsence=!user.lastSeenAt||Date.now()-new Date(user.lastSeenAt).getTime()>15*60*1000;await pool.query('UPDATE users SET last_seen_at=NOW(),last_login_at=CASE WHEN $2 THEN NOW() ELSE last_login_at END WHERE id=$1',[user.id,returningAfterAbsence]);if(returningAfterAbsence)await audit({user},'login','session',String(user.id),{automatic:true});}

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
         ON CONFLICT(ha_user_id) DO UPDATE SET display_name = CASE WHEN users.username IS NULL THEN EXCLUDED.display_name ELSE users.display_name END, updated_at = NOW()
         RETURNING *`,
        [displayName, haUserId],
      );
      request.user = publicUser(result.rows[0]);
      if (!request.user.active) return response.status(403).json({ error: 'User is disabled' });
      enforceFinanceResponsePolicy(response, request.user);
      await touchPresence(request.user);
      if(!requestAllowed(request.user,request))return response.status(403).json({error:'Insufficient permissions'});
      return next();
    }

    const token = cookieValue(request, 'projects_session') || request.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return response.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, jwtSecret);
    const result = await pool.query('SELECT * FROM users WHERE id = $1 AND active = TRUE', [payload.sub]);
    if (!result.rowCount) return response.status(401).json({ error: 'User is unavailable' });
    request.user = publicUser(result.rows[0]);
    enforceFinanceResponsePolicy(response, request.user);
    if (request.user.mustChangePassword && !['/api/auth/me','/api/auth/password','/api/auth/logout'].includes(request.path)) return response.status(428).json({ error:'Password change required',code:'PASSWORD_CHANGE_REQUIRED' });
    await touchPresence(request.user);
    if(!requestAllowed(request.user,request))return response.status(403).json({error:'Insufficient permissions'});
    next();
  } catch {
    response.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireRoles(...roles) {
  return (request, response, next) => {
    if(roles.length===1&&roles[0]==='admin')return request.user.role==='admin'?next():response.status(403).json({error:'Administrator permission required'});
    const level=accessLevel(request.user,permissionResource(request));
    const permitted=roles.includes(request.user.role)||level==='write'||(['GET','HEAD'].includes(request.method)&&level==='read');
    return permitted?next():response.status(403).json({ error: 'Insufficient permissions' });
  };
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
    response.json({ status: 'ok', database: 'ok', version: APP_VERSION });
  } catch (error) {
    response.status(503).json({ status: 'error', database: 'unavailable', message: error.message });
  }
});

const dummyPasswordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 12);
const ipLoginAttempts = new Map();
app.post('/api/auth/login', async (request, response) => {
  const username = String(request.body?.username || '').trim();
  const password = String(request.body?.password || '');
  const key = `${request.ip}|${username.toLowerCase()}`;
  const attempt = ipLoginAttempts.get(key);
  if (attempt?.lockedUntil > Date.now()) return response.status(429).json({ error:'Too many login attempts' });
  const result = await pool.query('SELECT * FROM users WHERE username = $1 AND active = TRUE', [username]);
  const row=result.rows[0];
  if (row?.locked_until && new Date(row.locked_until).getTime()>Date.now()) return response.status(429).json({error:'Account temporarily locked'});
  const valid=await bcrypt.compare(password,row?.password_hash||dummyPasswordHash);
  if (!row || !row.password_hash || !valid) {
    const count=(attempt?.count||0)+1; ipLoginAttempts.set(key,{count,lockedUntil:count>=5?Date.now()+15*60*1000:0});
    if(row)await pool.query(`UPDATE users SET failed_login_attempts=failed_login_attempts+1,locked_until=CASE WHEN failed_login_attempts+1>=5 THEN NOW()+INTERVAL '15 minutes' ELSE locked_until END WHERE id=$1`,[row.id]);
    return response.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }
  ipLoginAttempts.delete(key); await pool.query('UPDATE users SET failed_login_attempts=0,locked_until=NULL WHERE id=$1',[row.id]);
  const user = publicUser(row);
  const token = jwt.sign({ sub: String(user.id), role: user.role }, jwtSecret, { expiresIn: '12h' });
  response.cookie('projects_session', token, { httpOnly: true, sameSite: 'strict', secure: request.secure, maxAge: 12 * 60 * 60 * 1000, path: '/' });
  await pool.query('UPDATE users SET last_login_at=NOW(),last_seen_at=NOW() WHERE id=$1',[user.id]);
  await audit({ user }, 'login', 'session', String(user.id));
  response.json({ user });
});

app.post('/api/auth/logout', authenticate, async (request, response) => {
  await audit(request,'logout','session',String(request.user.id));
  await pool.query("UPDATE users SET last_seen_at=NOW()-INTERVAL '10 minutes' WHERE id=$1",[request.user.id]);
  response.clearCookie('projects_session', { path: '/' });
  response.status(204).end();
});

app.get('/api/auth/me', authenticate, (request, response) => response.json({ user: request.user }));

app.post('/api/auth/password', authenticate, async (request,response) => {
  const currentPassword=String(request.body?.currentPassword||''),newPassword=String(request.body?.newPassword||'');
  if(!isStrongPassword(newPassword))return response.status(400).json({error:'Password must contain at least 12 characters, upper and lower case letters, and a number'});
  const current=await pool.query('SELECT * FROM users WHERE id=$1 AND active=TRUE',[request.user.id]);
  if(!current.rowCount||!current.rows[0].password_hash||!await bcrypt.compare(currentPassword,current.rows[0].password_hash))return response.status(401).json({error:'Current password is incorrect'});
  if(await bcrypt.compare(newPassword,current.rows[0].password_hash))return response.status(400).json({error:'Choose a different password'});
  const result=await pool.query('UPDATE users SET password_hash=$1,must_change_password=FALSE,failed_login_attempts=0,locked_until=NULL,updated_at=NOW() WHERE id=$2 RETURNING *',[await bcrypt.hash(newPassword,12),request.user.id]);
  await audit(request,'change_password','user',String(request.user.id)); response.json({user:publicUser(result.rows[0])});
});

app.get('/api/live', authenticate, (request, response) => {
  response.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  response.flushHeaders(); response.write('event: ready\ndata: {}\n\n'); liveResponses.add(response);
  const heartbeat=setInterval(()=>response.write(': keepalive\n\n'),25000);
  request.on('close',()=>{clearInterval(heartbeat);liveResponses.delete(response)});
});

app.get('/api/projects', authenticate, async (request, response) => {
  const scope = ['active', 'completed', 'archived', 'all'].includes(request.query.scope) ? request.query.scope : 'active';
  const where = scope === 'all' ? '' : scope === 'archived' ? 'WHERE p.archived_at IS NOT NULL' : scope === 'completed' ? 'WHERE p.archived_at IS NULL AND p.completed_at IS NOT NULL' : 'WHERE p.archived_at IS NULL AND p.completed_at IS NULL';
  const result = await pool.query(`SELECT p.*,COALESCE(pr.display_name,p.manager) manager,pr.linked_user_id manager_user_id,pr.color manager_color,manager_user.avatar_color manager_avatar_color,
    next_task.title next_task_title,next_task.due_date next_task_date,next_task.assignee_name next_task_assignee
    FROM projects p LEFT JOIN professionals pr ON pr.id=p.manager_professional_id
    LEFT JOIN users manager_user ON manager_user.id=pr.linked_user_id
    LEFT JOIN LATERAL (
      SELECT t.title,t.due_date,COALESCE(ap.display_name,au.display_name,'') assignee_name
      FROM tasks t LEFT JOIN professionals ap ON ap.id=t.assignee_professional_id LEFT JOIN users au ON au.id=t.assignee_id
      WHERE t.project_id=p.id AND t.status IN ('open','in_progress','blocked')
      ORDER BY t.due_date NULLS LAST,t.critical DESC,t.created_at LIMIT 1
    ) next_task ON TRUE
    ${where}
    ORDER BY p.created_at DESC,p.id DESC`);
  const healthById=new Map((await loadProjectHealth(pool,request.user.financeAccess!==false)).map((item)=>[String(item.id),item]));
  response.json({ projects: result.rows.map((row) => {const project=projectForUser(row, request.user);const health=healthById.get(String(row.id));return health?{...project,health:health.score,healthTone:health.tone,healthReasons:health.reasons}:project;}) });
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
    address: withoutArabic(geocoded?.formattedAddress || request.body.address || selectedClient.address || request.body.location || ''), lat: geocoded?.lat ?? request.body.lat ?? 32.0853, lng: geocoded?.lng ?? request.body.lng ?? 34.7818,
    stage: request.body.stage || 'waiting', progress: STAGE_PROGRESS[request.body.stage || 'waiting'] ?? 0, manager: selectedManager?.display_name || '',
    ownerInitials: selectedManager?.display_name?.slice(0, 2) || '', value: request.user.financeAccess===false ? 0 : request.body.value ?? 0,
    paid: request.user.financeAccess===false ? 0 : request.body.paid ?? 0, due: request.body.due || '', priority: request.body.priority || 'normal', flag: request.body.flag || '',
    systems: request.body.systems || [], nextMilestone: request.body.nextMilestone || 'אפיון ראשוני', phone: request.body.phone || selectedClient.phone || '',
    email: request.body.email || selectedClient.email || '', health: request.body.health ?? 100, tasksDone: request.body.tasksDone ?? 0, tasksTotal: request.body.tasksTotal ?? 0,
    managerId: request.body.managerId || null, clientId: selectedClient.id, projectSize: request.body.projectSize || 'medium', contractorProgress: request.body.contractorProgress || 'waiting', documentFolder: request.body.documentFolder || '',
    projectClassification: request.body.projectClassification || 'private_house', projectCategory:['smart_home','other'].includes(request.body.projectCategory)?request.body.projectCategory:'smart_home', projectCategoryCustom:String(request.body.projectCategoryCustom||'').trim().slice(0,120), projectProfile:request.body.projectCategory==='other'&&request.body.projectProfile&&typeof request.body.projectProfile==='object'?request.body.projectProfile:{},
    projectIcon:request.body.projectIcon||'',projectColor:request.body.projectColor||'#6957df',installationLeadId:request.body.installationLeadId||null,
    financeMode:request.user.financeAccess===false?'total':request.body.financeMode||'total',paymentTerms:request.user.financeAccess===false?'':request.body.paymentTerms||'',depositAmount:request.user.financeAccess===false?0:Math.max(0,Number(request.body.depositAmount)||0),depositPaid:request.user.financeAccess===false?false:Boolean(request.body.depositPaid),financeBreakdown:request.user.financeAccess===false?[]:Array.isArray(request.body.financeBreakdown)?request.body.financeBreakdown:[],
    installationHoursTarget: Math.max(0, Number(request.body.installationHoursTarget) || 0),
    programmingHoursTarget: Math.max(0, Number(request.body.programmingHoursTarget) || 0),
    };
    const values = Object.keys(inputToColumn).map((key) => ['systems','financeBreakdown','projectProfile'].includes(key) ? JSON.stringify(project[key]) : project[key]);
    const columns = Object.values(inputToColumn);
    const result = await db.query(
    `INSERT INTO projects(${columns.join(', ')}) VALUES(${values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
    values,
    );
    if (request.body.templateId) {
      const template = await db.query('SELECT * FROM project_templates WHERE id=$1 AND active=TRUE', [request.body.templateId]);
      if (!template.rowCount) throw Object.assign(new Error('התבנית שנבחרה אינה זמינה'), { status: 400 });
      const templateTasks = await db.query('SELECT * FROM project_template_tasks WHERE template_id=$1 ORDER BY position,id', [request.body.templateId]);
      const startDate = request.body.startDate || new Date().toISOString().slice(0, 10);
      const taskIds = [];
      for (const item of templateTasks.rows) {
        const inserted = await db.query(`INSERT INTO tasks(project_id,title,description,status,priority,start_date,due_date,task_type,critical,created_by)
          VALUES($1,$2,$3,'open',$4,$5::date+$6::int,$5::date+$6::int+$7::int-1,$8,$9,$10) RETURNING id`,
        [project.id,item.title,item.description,item.priority,startDate,item.start_offset_days,item.duration_days,item.task_type,item.critical,request.user.id]);
        taskIds.push(inserted.rows[0].id);
      }
      for (let index=0; index<templateTasks.rows.length; index++) {
        const dependency=Number(templateTasks.rows[index].dependency_position);
        if (dependency>0 && taskIds[dependency-1]) await db.query('UPDATE tasks SET dependency_task_id=$1 WHERE id=$2',[taskIds[dependency-1],taskIds[index]]);
      }
      await db.query(`UPDATE projects SET template_id=$1,
        installation_hours_target=CASE WHEN installation_hours_target=0 THEN $2 ELSE installation_hours_target END,
        programming_hours_target=CASE WHEN programming_hours_target=0 THEN $3 ELSE programming_hours_target END
        WHERE id=$4`, [request.body.templateId,template.rows[0].installation_hours_target,template.rows[0].programming_hours_target,project.id]);
    }
    await db.query('COMMIT');
    await audit(request, 'create', 'project', project.id, { clientId: selectedClient.id });
    await executeAutomations({ pool,triggerType:'project_created',entityType:'project',entityId:project.id,context:{ projectId:project.id,stage:project.stage,managerProfessionalId: selectedManager?.id || null },userId:request.user.id });
    const createdProject = await pool.query('SELECT * FROM projects WHERE id=$1',[project.id]);
    response.status(201).json({ project: projectForUser(createdProject.rows[0], request.user) });
  } catch (error) {
    await db.query('ROLLBACK');
    if (error.status) return response.status(error.status).json({ error: error.message });
    throw error;
  } finally { db.release(); }
});

app.patch('/api/projects/:id', authenticate, requireRoles(...EDIT_ROLES), async (request, response) => {
  if(Object.prototype.hasOwnProperty.call(request.body||{},'projectCategory')&&!['smart_home','other'].includes(request.body.projectCategory))return response.status(400).json({error:'סיווג הפרויקט אינו תקין'});
  const managerFields = Object.keys(inputToColumn).filter((key) => key !== 'id');
  const allowedByRole = {
    admin: managerFields,
    manager: managerFields,
    supervisor: managerFields.filter((key)=>!['value','paid','financeMode','paymentTerms','depositAmount','depositPaid','financeBreakdown'].includes(key)),
    technician: ['stage', 'progress', 'flag', 'systems', 'nextMilestone', 'health', 'tasksDone', 'tasksTotal'],
    finance: ['paid', 'value', 'flag', 'financeMode', 'paymentTerms', 'depositAmount', 'depositPaid', 'financeBreakdown'],
  };
  const fallbackFields=accessLevel(request.user,'projects')==='write'?managerFields:[];
  const permittedFields=(allowedByRole[request.user.role]||fallbackFields).filter((key)=>request.user.financeAccess!==false||!['value','paid','financeMode','paymentTerms','depositAmount','depositPaid','financeBreakdown'].includes(key));
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
    const editPermission = request.user.role === 'admin' || request.user.permissions?.projects === 'write' || ['manager', 'technician', 'supervisor'].includes(request.user.role);
    if (!editPermission) {
      await db.query('ROLLBACK');
      return response.status(403).json({ error:'אין הרשאה לערוך את פרטי הפרויקט' });
    }
    const collectionRules = { threading:10, installation_a:40, activation_programming:70 };
    const requestedStage = request.body?.stage;
    const requiredPercent = collectionRules[requestedStage];
    const collectedPercent = Number(current.rows[0].value) > 0
      ? Math.round((Number(current.rows[0].paid || 0) / Number(current.rows[0].value)) * 100)
      : 0;
    if (requiredPercent && collectedPercent < requiredPercent && request.body.overrideCollectionWarning !== true) {
      await db.query('ROLLBACK');
      return response.status(409).json({
        error:`הגבייה בפרויקט היא ${collectedPercent}% בלבד. מעבר לשלב זה מומלץ רק לאחר גבייה של ${requiredPercent}% לפחות.`,
        code:'COLLECTION_STAGE_WARNING', requiredPercent, collectedPercent,
      });
    }
    delete request.body.overrideCollectionWarning;
    if (['admin', 'manager'].includes(request.user.role) && (request.body.clientId || request.body.newClient)) {
      const selectedClient = await resolveProjectClient(db, request.body, current.rows[0]);
      request.body.clientId = selectedClient.id;
      request.body.client = selectedClient.name;
    }
    if (['admin','manager'].includes(request.user.role) && request.body.address && request.body.address!==current.rows[0].address) { const geocoded=await geocodeAddress(request.body.address);if(geocoded){request.body.address=geocoded.formattedAddress;request.body.lat=geocoded.lat;request.body.lng=geocoded.lng;}request.body.address=withoutArabic(request.body.address); }
    if (['admin', 'manager'].includes(request.user.role) && Object.prototype.hasOwnProperty.call(request.body, 'clientName')) {
      const clientName = String(request.body.clientName || '').trim();
      if (!clientName) throw Object.assign(new Error('שם לקוח אינו יכול להיות ריק'), { status: 400 });
      const clientId = request.body.clientId || current.rows[0].client_id;
      if (!clientId) throw Object.assign(new Error('יש לקשר את הפרויקט ללקוח לפני שינוי שמו'), { status: 400 });
      const nameParts=clientName.split(/\s+/).filter(Boolean);const firstName=nameParts.length>1?nameParts.slice(0,-1).join(' '):clientName;const lastName=nameParts.length>1?nameParts.at(-1):'';
      await db.query('UPDATE clients SET name=$1,first_name=$2,last_name=$3,updated_at=NOW() WHERE id=$4', [clientName,firstName,lastName,clientId]);
      await db.query('UPDATE projects SET client=$1,updated_at=NOW() WHERE client_id=$2', [clientName, clientId]);
      request.body.client = clientName;
      delete request.body.clientName;
    }
    delete request.body.newClient;
    const entries = Object.entries(request.body || {}).filter(([key]) => permittedFields.includes(key));
    if (!entries.length) { await db.query('ROLLBACK'); return response.status(400).json({ error: 'No editable fields supplied' }); }
    const sets = entries.map(([key], index) => `${inputToColumn[key]} = $${index + 1}`);
    const values = entries.map(([key, value]) => ['systems','financeBreakdown','projectProfile'].includes(key) ? JSON.stringify(value) : value);
    values.push(request.params.id);
    const result = await db.query(`UPDATE projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    await db.query('COMMIT');
    await audit(request, 'update', 'project', request.params.id, Object.fromEntries(entries));
    if(request.body.stage && request.body.stage!==current.rows[0].stage) {
      await executeAutomations({
        pool,
        triggerType:'project_stage_changed',
        entityType:'project',
        entityId:request.params.id,
        context:{
          projectId:request.params.id,
          stage:request.body.stage,
          fromStage:current.rows[0].stage,
          managerProfessionalId:current.rows[0].manager_professional_id || null,
        },
        userId:request.user.id,
      });
    }
    response.json({ project: projectForUser(result.rows[0], request.user) });
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
  response.json({ project: projectForUser(result.rows[0], request.user) });
});

app.patch('/api/projects/:id/complete', authenticate, requireRoles('admin','manager'), async(request,response)=>{
  const completed=request.body.completed!==false;
  const result=await pool.query(`UPDATE projects SET completed_at=$1,completed_by=$2,updated_at=NOW() WHERE id=$3 AND archived_at IS NULL RETURNING *`,[completed?new Date():null,completed?request.user.id:null,request.params.id]);
  if(!result.rowCount)return response.status(404).json({error:'Project not found or archived'});
  await audit(request,completed?'complete':'reopen','project',request.params.id);
  response.json({project:projectForUser(result.rows[0],request.user)});
});

app.delete('/api/projects/:id/permanent', authenticate, requireRoles('admin'), async (request, response) => {
  const password = String(request.body.password || '');
  const confirmation = String(request.body.confirmation || '').trim();
  const account = await pool.query(`SELECT password_hash FROM users WHERE active=TRUE AND password_hash IS NOT NULL
    AND (id=$1 OR (role='admin' AND username IS NOT NULL)) ORDER BY CASE WHEN id=$1 THEN 0 ELSE 1 END LIMIT 1`, [request.user.id]);
  if (!account.rowCount || !(await bcrypt.compare(password, account.rows[0].password_hash))) {
    return response.status(401).json({ error: 'סיסמת מנהל המערכת אינה נכונה' });
  }
  const db = await pool.connect();
  let project;
  let storedFiles = [];
  try {
    await db.query('BEGIN');
    const projectResult = await db.query('SELECT id,serial_code,name,client_id,archived_at FROM projects WHERE id=$1 FOR UPDATE', [request.params.id]);
    project = projectResult.rows[0];
    if (!project) { await db.query('ROLLBACK'); return response.status(404).json({ error:'הפרויקט לא נמצא' }); }
    if (!project.archived_at) { await db.query('ROLLBACK'); return response.status(409).json({ error:'ניתן למחוק לצמיתות רק פרויקט שנמצא בארכיון' }); }
    if (confirmation.toUpperCase() !== project.serial_code.toUpperCase()) { await db.query('ROLLBACK'); return response.status(400).json({ error:'המספר הסידורי שהוקלד אינו תואם' }); }
    const files = await db.query('SELECT stored_name FROM client_files WHERE project_id=$1 OR form_record_id IN (SELECT id FROM form_records WHERE project_id=$1)', [project.id]);
    storedFiles = files.rows.map((item)=>item.stored_name).filter((name)=>path.basename(name) === name);
    await db.query('DELETE FROM client_files WHERE project_id=$1 OR form_record_id IN (SELECT id FROM form_records WHERE project_id=$1)', [project.id]);
    await db.query('DELETE FROM site_inspections WHERE project_id=$1', [project.id]);
    await db.query('DELETE FROM form_records WHERE project_id=$1', [project.id]);
    await db.query('DELETE FROM projects WHERE id=$1', [project.id]);
    await db.query('DELETE FROM calendar_history WHERE project_id=$1', [project.id]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
  await Promise.all(storedFiles.map((name)=>unlink(path.join(DATA_DIR,'uploads','clients',name)).catch(()=>{})));
  await audit(request,'delete','project',project.id,{ name:project.name, serialCode:project.serial_code, permanent:true, archivedAt:project.archived_at });
  response.status(204).end();
});

app.get('/api/users', authenticate, requireRoles('admin'), async (_request, response) => {
  const result = await pool.query('SELECT * FROM users WHERE merged_into_user_id IS NULL ORDER BY created_at');
  response.json({ users: result.rows.map(publicUser) });
});

app.get('/api/system/demo-data', authenticate, requireRoles('admin'), async (_request, response) => {
  const state = await demoDataState();
  response.json({ enabled:state.enabled, projectCount:state.project_count, taskCount:state.task_count, hasRealData:state.has_real_data, activationLocked:!state.enabled&&state.has_real_data });
});

app.patch('/api/system/demo-data', authenticate, requireRoles('admin'), async (request, response) => {
  if (typeof request.body?.enabled !== 'boolean') return response.status(400).json({ error:'יש לבחור הפעלה או ביטול של נתוני הדמו' });
  const enabled = request.body.enabled;
  if (enabled) {
    const state = await demoDataState();
    if (state.has_real_data) return response.status(409).json({ error:'לא ניתן להפעיל נתוני דמו לאחר שנוצר מידע אמיתי במערכת' });
  }
  let projectCount = 0;
  let taskCount = 0;
  if (!enabled) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const demo = await db.query('SELECT id,client_id,manager_professional_id FROM projects WHERE is_demo=TRUE FOR UPDATE');
      const projectIds = demo.rows.map((row) => row.id);
      const clientIds = [...new Set(demo.rows.map((row) => row.client_id).filter(Boolean))];
      const professionalIds = [...new Set(demo.rows.map((row) => row.manager_professional_id).filter(Boolean))];
      projectCount = projectIds.length;
      if (projectIds.length) {
        taskCount = Number((await db.query('SELECT COUNT(*)::int count FROM tasks WHERE project_id=ANY($1::text[])',[projectIds])).rows[0].count);
        await db.query('DELETE FROM form_records WHERE project_id=ANY($1::text[])',[projectIds]);
        await db.query('DELETE FROM site_inspections WHERE project_id=ANY($1::text[])',[projectIds]);
        await db.query('DELETE FROM projects WHERE id=ANY($1::text[]) AND is_demo=TRUE',[projectIds]);
        await db.query('DELETE FROM calendar_history WHERE project_id=ANY($1::text[])',[projectIds]);
      }
      if (clientIds.length) await db.query(`DELETE FROM clients c WHERE c.id=ANY($1::bigint[])
        AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.client_id=c.id)
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.client_id=c.id)
        AND NOT EXISTS (SELECT 1 FROM client_professionals cp WHERE cp.client_id=c.id)`,[clientIds]);
      if (professionalIds.length) await db.query(`DELETE FROM professionals person WHERE person.id=ANY($1::bigint[])
        AND person.linked_user_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.manager_professional_id=person.id)
        AND NOT EXISTS (SELECT 1 FROM project_professionals pp WHERE pp.professional_id=person.id)
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.assignee_professional_id=person.id OR t.owner_professional_id=person.id)`,[professionalIds]);
      await db.query(`INSERT INTO app_settings(key,value,updated_by) VALUES('demoData',$1,$2)
        ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[JSON.stringify({enabled:false}),request.user.id]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally { db.release(); }
  } else {
    await pool.query(`INSERT INTO app_settings(key,value,updated_by) VALUES('demoData',$1,$2)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[JSON.stringify({enabled:true}),request.user.id]);
    projectCount = await seedDemoProjects();
    await ensureSeedRelationships();
  }
  await audit(request,'update','demo_data','seed',{enabled,projectCount,taskCount,usersPreserved:true});
  const state = await demoDataState();
  response.json({enabled:state.enabled,projectCount:state.project_count,taskCount:state.task_count,deletedProjects:enabled?0:projectCount,deletedTasks:enabled?0:taskCount,usersPreserved:true,hasRealData:state.has_real_data,activationLocked:!state.enabled&&state.has_real_data});
});

app.post('/api/users/merge-identities', authenticate, requireRoles('admin'), async (request, response) => {
  const primaryUserId = String(request.body.primaryUserId || '');
  const secondaryUserId = String(request.body.secondaryUserId || '');
  if (!primaryUserId || !secondaryUserId || primaryUserId === secondaryUserId) return response.status(400).json({ error:'יש לבחור שתי זהויות שונות' });
  if (secondaryUserId === String(request.user.id)) return response.status(409).json({ error:'לא ניתן למזג את המשתמש המחובר כזהות משנית. יש לבחור בו כזהות הראשית' });
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const result = await db.query('SELECT * FROM users WHERE id=ANY($1::bigint[]) AND merged_into_user_id IS NULL FOR UPDATE', [[primaryUserId,secondaryUserId]]);
    if (result.rowCount !== 2) throw Object.assign(new Error('אחת הזהויות אינה זמינה לאיחוד'),{ statusCode:404 });
    const primary = result.rows.find((item)=>String(item.id)===primaryUserId);
    const secondary = result.rows.find((item)=>String(item.id)===secondaryUserId);
    if (primary.username && secondary.username && primary.username !== secondary.username) throw Object.assign(new Error('לשתי הזהויות יש חשבון Web שונה. יש לבחור זוג של Web ו-Ingress'),{ statusCode:409 });
    if (primary.ha_user_id && secondary.ha_user_id && primary.ha_user_id !== secondary.ha_user_id) throw Object.assign(new Error('לשתי הזהויות יש חשבון Home Assistant שונה ולא ניתן לאחד אותן'),{ statusCode:409 });
    const linked = await db.query('SELECT id,linked_user_id FROM professionals WHERE linked_user_id=ANY($1::bigint[])', [[primaryUserId,secondaryUserId]]);
    const primaryProfessional = linked.rows.find((item)=>String(item.linked_user_id)===primaryUserId);
    const secondaryProfessional = linked.rows.find((item)=>String(item.linked_user_id)===secondaryUserId);
    if (primaryProfessional && secondaryProfessional && String(primaryProfessional.id)!==String(secondaryProfessional.id)) throw Object.assign(new Error('כל זהות מקושרת לאיש מקצוע אחר. יש להסיר אחד מהקישורים לפני האיחוד'),{ statusCode:409 });
    await db.query('UPDATE users SET username=NULL,password_hash=NULL,ha_user_id=NULL,active=FALSE,merged_into_user_id=$1,updated_at=NOW() WHERE id=$2',[primaryUserId,secondaryUserId]);
    await db.query(`UPDATE users SET
      username=COALESCE(username,$2),password_hash=COALESCE(password_hash,$3),ha_user_id=COALESCE(ha_user_id,$4),
      last_seen_at=GREATEST(last_seen_at,$5),last_login_at=GREATEST(last_login_at,$6),
      avatar_image=COALESCE(NULLIF(avatar_image,''),NULLIF($7,''),''),updated_at=NOW()
      WHERE id=$1`,[primaryUserId,secondary.username,secondary.password_hash,secondary.ha_user_id,secondary.last_seen_at,secondary.last_login_at,secondary.avatar_image]);
    if (!primaryProfessional && secondaryProfessional) await db.query('UPDATE professionals SET linked_user_id=$1 WHERE id=$2',[primaryUserId,secondaryProfessional.id]);
    await db.query('UPDATE user_messages SET sender_id=$1 WHERE sender_id=$2',[primaryUserId,secondaryUserId]);
    await db.query('UPDATE user_messages SET recipient_id=$1 WHERE recipient_id=$2',[primaryUserId,secondaryUserId]);
    await db.query('COMMIT');
    await audit(request,'merge','user_identity',primaryUserId,{ secondaryUserId, primaryDisplayName:primary.display_name, secondaryDisplayName:secondary.display_name });
    const canonical = await pool.query('SELECT * FROM users WHERE id=$1',[primaryUserId]);
    response.json({ user:publicUser(canonical.rows[0]) });
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { db.release(); }
});

app.post('/api/users', authenticate, requireRoles('admin'), async (request, response) => {
  const username = String(request.body.username || '').trim();
  const password = String(request.body.password || '');
  const role = ROLES.includes(request.body.role) ? request.body.role : 'viewer';
  if (!username || !isStrongPassword(password)) return response.status(400).json({ error: 'Password must contain at least 12 characters, upper and lower case letters, and a number' });
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users(username, display_name, password_hash, role, avatar_color, avatar_icon)
     VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
    [username, request.body.displayName || username, passwordHash, role, request.body.avatarColor || '#6957df', request.body.avatarIcon || 'user'],
  );
  if(request.body.permissions||typeof request.body.financeAccess==='boolean')await pool.query('UPDATE users SET permissions=$1,finance_access=$2 WHERE id=$3',[JSON.stringify(request.body.permissions||{}),request.body.financeAccess!==false,result.rows[0].id]);
  const createdUser=await pool.query('SELECT * FROM users WHERE id=$1',[result.rows[0].id]);
  await audit(request, 'create', 'user', String(result.rows[0].id), { username, role });
  response.status(201).json({ user: publicUser(createdUser.rows[0]) });
});

app.patch('/api/users/:id', authenticate, requireRoles('admin'), async (request, response) => {
  const protectedUser = await pool.query('SELECT username,role FROM users WHERE id=$1', [request.params.id]);
  if (!protectedUser.rowCount) return response.status(404).json({ error: 'User not found' });
  const isSystemAdministrator = protectedUser.rows[0].username === 'admin';
  if (isSystemAdministrator && (request.body.active === false || (request.body.role && request.body.role !== 'admin'))) {
    return response.status(409).json({ error: 'משתמש ADMIN הוא חשבון מערכת מוגן ותמיד חייב להישאר פעיל כמנהל מערכת' });
  }
  const updates = [];
  const values = [];
  if (request.body.displayName) { values.push(request.body.displayName); updates.push(`display_name = $${values.length}`); }
  if (ROLES.includes(request.body.role)) { values.push(request.body.role); updates.push(`role = $${values.length}`); }
  if (typeof request.body.active === 'boolean') { values.push(request.body.active); updates.push(`active = $${values.length}`); }
  if (request.body.avatarColor) { values.push(request.body.avatarColor); updates.push(`avatar_color = $${values.length}`); }
  if (request.body.avatarIcon) { values.push(request.body.avatarIcon); updates.push(`avatar_icon = $${values.length}`); }
  if (request.body.permissions && typeof request.body.permissions==='object') { values.push(JSON.stringify(request.body.permissions)); updates.push(`permissions = $${values.length}`); }
  if (typeof request.body.financeAccess==='boolean') { values.push(request.body.financeAccess); updates.push(`finance_access = $${values.length}`); }
  if (request.body.password) {
    const newPassword=String(request.body.password);
    if (!isStrongPassword(newPassword)) return response.status(400).json({ error: 'Password must contain at least 12 characters, upper and lower case letters, and a number' });
    values.push(await bcrypt.hash(newPassword, 12)); updates.push(`password_hash = $${values.length}`); updates.push('must_change_password = FALSE');
  }
  if (!updates.length) return response.status(400).json({ error: 'No editable fields supplied' });
  values.push(request.params.id);
  const result = await pool.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
  if (!result.rowCount) return response.status(404).json({ error: 'User not found' });
  await audit(request, 'update', 'user', request.params.id);
  response.json({ user: publicUser(result.rows[0]) });
});

app.post('/api/users/:id/reset-password', authenticate, requireRoles('admin'), async (request, response) => {
  const targetUserId = request.params.id;
  const requestedPassword = String(request.body?.newPassword || '').trim();
  const requirePasswordChange = request.body?.requirePasswordChange !== false;
  const unlock = request.body?.unlockAccount === true;
  const finalPassword = requestedPassword || generateStrongPassword();

  if (!isStrongPassword(finalPassword)) {
    return response.status(400).json({ error: 'Password must contain at least 12 characters, upper and lower case letters, and a number' });
  }

  const updates = ['password_hash = $1', 'updated_at = NOW()'];
  const values = [await bcrypt.hash(finalPassword, 12)];
  updates.push(`must_change_password = $${values.length + 1}`);
  values.push(requirePasswordChange);
  if (unlock) {
    updates.push('failed_login_attempts = 0');
    updates.push('locked_until = NULL');
  }
  values.push(targetUserId);
  const result = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
  if (!result.rowCount) return response.status(404).json({ error: 'User not found' });
  await audit(request, 'reset_password', 'user', targetUserId, { unlockAccount: unlock, requirePasswordChange });
  response.json({
    user: publicUser(result.rows[0]),
    generatedPassword: requestedPassword ? null : finalPassword,
  });
});

app.post('/api/users/:id/unlock', authenticate, requireRoles('admin'), async (request, response) => {
  const targetUserId = request.params.id;
  const result = await pool.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
    [targetUserId],
  );
  if (!result.rowCount) return response.status(404).json({ error: 'User not found' });
  await audit(request, 'unlock_account', 'user', targetUserId);
  response.json({ user: publicUser(result.rows[0]) });
});

const userAvatarDir = path.join(DATA_DIR, 'uploads', 'user-avatars');
await mkdir(userAvatarDir, { recursive: true });
const userAvatarUpload = multer({
  storage: multer.diskStorage({
    destination: userAvatarDir,
    filename: (_request, file, callback) => callback(null, `${Date.now()}-${randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(file.mimetype.startsWith('image/') ? null : new Error('יש לבחור קובץ תמונה'), file.mimetype.startsWith('image/')),
});

async function storeUserAvatar(userId, file) {
  const current = await pool.query('SELECT avatar_image FROM users WHERE id=$1 AND merged_into_user_id IS NULL', [userId]);
  if (!current.rowCount) {
    await unlink(file.path).catch(() => {});
    return null;
  }
  const result = await pool.query('UPDATE users SET avatar_image=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [file.filename, userId]);
  if (current.rows[0].avatar_image) await unlink(path.join(userAvatarDir, current.rows[0].avatar_image)).catch(() => {});
  return result.rows[0];
}

app.post('/api/auth/avatar', authenticate, userAvatarUpload.single('avatar'), async (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'יש לבחור תמונה' });
  const row = await storeUserAvatar(request.user.id, request.file);
  if (!row) return response.status(404).json({ error: 'המשתמש לא נמצא' });
  await audit(request, 'update_avatar', 'user', String(request.user.id), { selfService:true });
  response.json({ user:publicUser(row) });
});

app.get('/api/auth/avatar', authenticate, async (request, response) => {
  const result = await pool.query(`SELECT COALESCE(NULLIF(users.avatar_image,''),(
    SELECT NULLIF(merged.avatar_image,'') FROM users merged
    WHERE merged.merged_into_user_id=users.id AND merged.avatar_image<>''
    ORDER BY merged.updated_at DESC LIMIT 1
  ),'') avatar_image FROM users WHERE id=$1`, [request.user.id]);
  const avatarImage = result.rows[0]?.avatar_image;
  if (!avatarImage) return response.status(404).end();
  response.set('Cache-Control','no-store');
  response.sendFile(path.join(userAvatarDir,path.basename(avatarImage)),(error)=>{
    if (error && !response.headersSent) response.status(error.code==='ENOENT'?404:500).end();
  });
});

app.post('/api/users/:id/avatar', authenticate, requireRoles('admin'), userAvatarUpload.single('avatar'), async (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'יש לבחור תמונה' });
  const row = await storeUserAvatar(request.params.id, request.file);
  if (!row) return response.status(404).json({ error: 'המשתמש לא נמצא' });
  await audit(request, 'update_avatar', 'user', request.params.id);
  response.json({ user: publicUser(row) });
});

app.delete('/api/users/:id/avatar', authenticate, requireRoles('admin'), async (request, response) => {
  const current = await pool.query('SELECT avatar_image FROM users WHERE id=$1', [request.params.id]);
  const result = await pool.query("UPDATE users SET avatar_image='',updated_at=NOW() WHERE id=$1 RETURNING id", [request.params.id]);
  if (!result.rowCount) return response.status(404).json({ error: 'המשתמש לא נמצא' });
  if (current.rows[0]?.avatar_image) await unlink(path.join(userAvatarDir, current.rows[0].avatar_image)).catch(() => {});
  response.status(204).end();
});

app.get('/api/users/:id/avatar', authenticate, async (request, response) => {
  const result = await pool.query(`SELECT COALESCE(NULLIF(users.avatar_image,''),(
    SELECT NULLIF(merged.avatar_image,'') FROM users merged
    WHERE merged.merged_into_user_id=users.id AND merged.avatar_image<>''
    ORDER BY merged.updated_at DESC LIMIT 1
  ),'') avatar_image FROM users WHERE id=$1 AND merged_into_user_id IS NULL`, [request.params.id]);
  if (!result.rowCount || !result.rows[0].avatar_image) return response.status(404).end();
  response.sendFile(path.join(userAvatarDir, path.basename(result.rows[0].avatar_image)));
});

app.delete('/api/users/:id', authenticate, requireRoles('admin'), async (request, response) => {
  if (String(request.user.id) === String(request.params.id)) return response.status(409).json({ error: 'לא ניתן למחוק את המשתמש המחובר' });
  const protectedUser = await pool.query('SELECT username FROM users WHERE id=$1', [request.params.id]);
  if (protectedUser.rows[0]?.username === 'admin') return response.status(409).json({ error: 'לא ניתן למחוק את משתמש ADMIN המוגן' });
  const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id,display_name', [request.params.id]);
  if (!result.rowCount) return response.status(404).json({ error: 'User not found' });
  await audit(request, 'delete', 'user', request.params.id, { displayName: result.rows[0].display_name });
  response.status(204).end();
});

const pushService=await createPushService({pool,authenticate,requireRoles,audit});
app.use('/api',pushService.router);
app.use('/api', await createOperationalRouter({ pool, authenticate, requireRoles, audit, dataDir: DATA_DIR, geocoder, pushService }));
app.use('/api', await createAiRouter({ pool, authenticate, requireRoles, audit, dataDir:DATA_DIR }));
app.use('/api', createFormsRouter({ pool, authenticate, requireRoles, audit }));
app.use('/api', await createManagementRouter({ pool, authenticate, requireRoles, audit, dataDir: DATA_DIR }));
app.use('/api', createPriorityOrdersRouter({ pool, authenticate, requireRoles, audit }));
app.use('/api', await createProjectIntelligenceRouter({ pool, authenticate, requireRoles, audit, dataDir:DATA_DIR }));
app.use('/api', createOperationsRouter({ pool, authenticate, requireRoles, audit }));
app.use('/api', createProductivityRouter({ pool, authenticate, requireRoles, audit }));
app.use('/api', await createBackupRouter({ pool, authenticate, requireRoles, audit, dataDir:DATA_DIR, appVersion:APP_VERSION }));

startAutomationScheduler({ pool });
startPushScheduler(pushService);

app.use('/api', (_request, response) => response.status(404).json({ error: 'Not found' }));
app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.statusCode) return response.status(error.statusCode).json({ error: error.message });
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error:'File exceeds the allowed size limit' });
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
