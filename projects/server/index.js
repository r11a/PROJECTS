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
  'phone', 'email', 'health', 'tasks_done', 'tasks_total',
];
const inputToColumn = {
  id: 'id', name: 'name', client: 'client', location: 'location', address: 'address', lat: 'lat', lng: 'lng',
  stage: 'stage', progress: 'progress', manager: 'manager', ownerInitials: 'owner_initials', value: 'value',
  paid: 'paid', due: 'due', priority: 'priority', flag: 'flag', systems: 'systems',
  nextMilestone: 'next_milestone', phone: 'phone', email: 'email', health: 'health',
  tasksDone: 'tasks_done', tasksTotal: 'tasks_total',
};

function projectFromRow(row) {
  return {
    id: row.id, name: row.name, client: row.client, location: row.location, address: row.address,
    lat: Number(row.lat), lng: Number(row.lng), stage: row.stage, progress: Number(row.progress),
    manager: row.manager, ownerInitials: row.owner_initials, value: Number(row.value), paid: Number(row.paid),
    due: row.due, priority: row.priority, flag: row.flag, systems: row.systems || [],
    nextMilestone: row.next_milestone, phone: row.phone, email: row.email, health: Number(row.health),
    tasksDone: Number(row.tasks_done), tasksTotal: Number(row.tasks_total),
  };
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
    const values = projectColumns.map((column) => {
      const inputKey = Object.keys(inputToColumn).find((key) => inputToColumn[key] === column);
      return column === 'systems' ? JSON.stringify(project[inputKey] || []) : project[inputKey];
    });
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await pool.query(`INSERT INTO projects(${projectColumns.join(', ')}) VALUES(${placeholders})`, values);
  }
}

await runMigrations();
await seedDatabase();

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
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, active: row.active, haUserId: row.ha_user_id };
}

async function authenticate(request, response, next) {
  try {
    if (request.get('X-Projects-Ingress') === 'true') {
      const haUserId = request.get('X-Remote-User-Id');
      if (!haUserId) return response.status(401).json({ error: 'Missing Home Assistant user identity' });
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

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok', database: 'ok', version: '0.2.0' });
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

app.get('/api/projects', authenticate, async (_request, response) => {
  const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC, id DESC');
  response.json({ projects: result.rows.map(projectFromRow) });
});

app.post('/api/projects', authenticate, requireRoles('admin', 'manager'), async (request, response) => {
  const nextNumber = await pool.query("SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '\\D', '', 'g'), '')::int), 1000) + 1 AS value FROM projects");
  const project = {
    id: request.body.id || `PRJ-${nextNumber.rows[0].value}`,
    name: request.body.name || 'פרויקט חדש', client: request.body.client || '', location: request.body.location || '',
    address: request.body.address || request.body.location || '', lat: request.body.lat ?? 32.0853, lng: request.body.lng ?? 34.7818,
    stage: request.body.stage || 'planning', progress: request.body.progress ?? 0, manager: request.body.manager || request.user.displayName,
    ownerInitials: request.body.ownerInitials || request.user.displayName.slice(0, 2), value: request.body.value ?? 0,
    paid: request.body.paid ?? 0, due: request.body.due || '', priority: request.body.priority || 'normal', flag: request.body.flag || '',
    systems: request.body.systems || [], nextMilestone: request.body.nextMilestone || 'אפיון ראשוני', phone: request.body.phone || '',
    email: request.body.email || '', health: request.body.health ?? 100, tasksDone: request.body.tasksDone ?? 0, tasksTotal: request.body.tasksTotal ?? 0,
  };
  const values = Object.keys(inputToColumn).map((key) => key === 'systems' ? JSON.stringify(project[key]) : project[key]);
  const columns = Object.values(inputToColumn);
  const result = await pool.query(
    `INSERT INTO projects(${columns.join(', ')}) VALUES(${values.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
    values,
  );
  await audit(request, 'create', 'project', project.id);
  response.status(201).json({ project: projectFromRow(result.rows[0]) });
});

app.patch('/api/projects/:id', authenticate, requireRoles(...EDIT_ROLES), async (request, response) => {
  const allowedByRole = {
    admin: Object.keys(inputToColumn).filter((key) => key !== 'id'),
    manager: Object.keys(inputToColumn).filter((key) => key !== 'id'),
    technician: ['stage', 'progress', 'flag', 'systems', 'nextMilestone', 'health', 'tasksDone', 'tasksTotal'],
    finance: ['paid', 'value', 'flag'],
  };
  const entries = Object.entries(request.body || {}).filter(([key]) => allowedByRole[request.user.role].includes(key));
  if (!entries.length) return response.status(400).json({ error: 'No editable fields supplied' });
  const sets = entries.map(([key], index) => `${inputToColumn[key]} = $${index + 1}`);
  const values = entries.map(([key, value]) => key === 'systems' ? JSON.stringify(value) : value);
  values.push(request.params.id);
  const result = await pool.query(
    `UPDATE projects SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values,
  );
  if (!result.rowCount) return response.status(404).json({ error: 'Project not found' });
  await audit(request, 'update', 'project', request.params.id, Object.fromEntries(entries));
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
    `INSERT INTO users(username, display_name, password_hash, role)
     VALUES($1, $2, $3, $4) RETURNING *`,
    [username, request.body.displayName || username, passwordHash, role],
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

app.use('/api', (_request, response) => response.status(404).json({ error: 'Not found' }));
app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.code === '23505') return response.status(409).json({ error: 'A record with these details already exists' });
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
