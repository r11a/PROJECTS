import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { buildOperationalInsights } from './insights.js';
import { CLIENT_UPLOAD_LIMIT, documentFileFilter, imageFileFilter, assertVideoSize } from './uploadPolicy.js';

const CLIENT_FIELDS = {
  name: 'name', firstName:'first_name', lastName:'last_name', apartmentNumber:'apartment_number', clientType: 'client_type', companyNumber: 'company_number', priorityCustomerNumber: 'priority_customer_number', primaryContactName: 'primary_contact_name', referralSource:'referral_source',
  phone: 'phone', additionalPhones: 'additional_phones', email: 'email', additionalEmails: 'additional_emails',
  address: 'address', city: 'city', notes: 'notes', status: 'status', customValues: 'custom_values',
};
const CONTACT_FIELDS = {
  name: 'name', company: 'company', role: 'role', phone: 'phone', additionalPhones: 'additional_phones',
  email: 'email', isReferrer: 'is_referrer', notes: 'notes',
};
const CATALOG_CATEGORIES = ['stage', 'system', 'tag', 'flag', 'priority', 'contact_role', 'task_status', 'inspection_template'];
const JSON_FIELDS = new Set(['additionalPhones', 'additionalEmails', 'customValues', 'findings', 'metadata', 'options']);

function withoutArabic(value = '') {
  return String(value).replace(/[\u0600-\u06ff]+/g, '').replace(/\s+,/g, ',').replace(/,\s*,+/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim();
}

function valuesFor(input, fields) {
  return Object.entries(fields).filter(([key]) => input[key] !== undefined).map(([key, column]) => [key, column, JSON_FIELDS.has(key) ? JSON.stringify(input[key]) : input[key]]);
}

function clientFromRow(row) {
  return {
    id: row.id, code: row.code, name: row.name, firstName:row.first_name || row.name, lastName:row.last_name || '', apartmentNumber:row.apartment_number || '', clientType: row.client_type, companyNumber: row.company_number, priorityCustomerNumber: row.priority_customer_number,
    primaryContactName: row.primary_contact_name, referralSource:row.referral_source || '', phone: row.phone, additionalPhones: row.additional_phones || [],
    email: row.email, additionalEmails: row.additional_emails || [], address: withoutArabic(row.address), city: withoutArabic(row.city),
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

export async function createOperationalRouter({ pool, authenticate, requireRoles, audit, dataDir, geocoder }) {
  const router = express.Router();
  const uploadDir = path.join(dataDir, 'uploads', 'clients');
  const brandingDir = path.join(dataDir, 'branding');
  await Promise.all([mkdir(uploadDir, { recursive: true }), mkdir(brandingDir, { recursive: true })]);
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).slice(0, 12).toLowerCase()}`),
    }),
    fileFilter: documentFileFilter,
    limits: { fileSize: CLIENT_UPLOAD_LIMIT, files: 1 },
  });
  const logoUpload = multer({ storage: multer.memoryStorage(), fileFilter:imageFileFilter, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  const icsText = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const icsDate = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  router.get('/calendar-feed/:token.ics', async (request, response) => {
    const token = await pool.query('SELECT user_id FROM calendar_feed_tokens WHERE token=$1', [request.params.token]);
    if (!token.rowCount) return response.status(404).type('text/plain').send('Calendar feed not found');
    const events = await pool.query(`SELECT h.*,p.name project_name FROM calendar_history h LEFT JOIN projects p ON p.id=h.project_id WHERE h.status<>'deleted' ORDER BY h.event_at`);
    await pool.query('UPDATE calendar_feed_tokens SET last_used_at=NOW() WHERE token=$1', [request.params.token]);
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PROJECTS//Read-only calendar//HE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:PROJECTS'];
    for (const event of events.rows) {
      const title = event.source_type === 'task' && event.project_name && !String(event.title).includes(event.project_name) ? `${event.project_name} — ${event.title}` : event.title;
      lines.push('BEGIN:VEVENT',`UID:${icsText(event.source_type)}-${icsText(event.source_id)}@projects`,`DTSTAMP:${icsDate(event.updated_at || event.first_recorded_at)}`,`DTSTART:${icsDate(event.event_at)}`);
      if (event.event_end) lines.push(`DTEND:${icsDate(event.event_end)}`);
      lines.push(`SUMMARY:${icsText(title)}`,`DESCRIPTION:${icsText(event.payload?.notes || event.payload?.description || '')}`,`LOCATION:${icsText(event.payload?.address || '')}`,'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    response.set({'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="projects-calendar.ics"','Cache-Control':'no-cache, no-store, must-revalidate'}).send(`${lines.join('\r\n')}\r\n`);
  });

  router.use(authenticate);

  router.get('/calendar-feed', async (request, response) => {
    const result = await pool.query('SELECT token,created_at,last_used_at FROM calendar_feed_tokens WHERE user_id=$1', [request.user.id]);
    response.json({ active:Boolean(result.rowCount), token:result.rows[0]?.token || null, createdAt:result.rows[0]?.created_at || null, lastUsedAt:result.rows[0]?.last_used_at || null });
  });
  router.post('/calendar-feed', async (request, response) => {
    const token = `${randomUUID()}${randomUUID().replace(/-/g,'')}`;
    await pool.query(`INSERT INTO calendar_feed_tokens(user_id,token) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET token=EXCLUDED.token,created_at=NOW(),last_used_at=NULL`, [request.user.id, token]);
    await audit(request, 'create', 'calendar_feed', String(request.user.id));
    response.status(201).json({ token });
  });
  router.delete('/calendar-feed', async (request, response) => {
    await pool.query('DELETE FROM calendar_feed_tokens WHERE user_id=$1', [request.user.id]);
    await audit(request, 'delete', 'calendar_feed', String(request.user.id));
    response.status(204).end();
  });

  router.get('/messages', async (request,response) => {
    const result=await pool.query(`SELECT m.*,sender.display_name sender_name,sender.avatar_color sender_avatar_color,sender.avatar_image sender_avatar_image,recipient.display_name recipient_name,recipient.avatar_color recipient_avatar_color,recipient.avatar_image recipient_avatar_image FROM user_messages m JOIN users sender ON sender.id=m.sender_id JOIN users recipient ON recipient.id=m.recipient_id WHERE (m.recipient_id=$1 OR m.sender_id=$1) AND NOT ($1=ANY(m.hidden_for)) ORDER BY m.created_at DESC LIMIT 200`,[request.user.id]);
    response.json({messages:result.rows.map(row=>({id:row.id,senderId:row.sender_id,senderName:row.sender_name,senderAvatarColor:row.sender_avatar_color,senderAvatarImage:row.sender_avatar_image,recipientId:row.recipient_id,recipientName:row.recipient_name,recipientAvatarColor:row.recipient_avatar_color,recipientAvatarImage:row.recipient_avatar_image,subject:row.subject,body:row.body,readAt:row.read_at,createdAt:row.created_at,parentMessageId:row.parent_message_id,linkedUrl:row.linked_url,mention:row.mention})),unread:result.rows.filter(row=>String(row.recipient_id)===String(request.user.id)&&!row.read_at).length});
  });
  router.post('/messages', async (request,response) => {
    const recipientId=Number(request.body.recipientId);const body=String(request.body.body||'').trim();if(!recipientId||!body)return response.status(400).json({error:'יש לבחור נמען ולכתוב הודעה'});
    const subject=String(request.body.subject||'').trim();const linkedUrl=String(request.body.linkedUrl||'').slice(0,500);const parentId=Number(request.body.parentId)||null;
    const result=await pool.query('INSERT INTO user_messages(sender_id,recipient_id,subject,body,parent_message_id,linked_url) SELECT $1,id,$2,$3,$4,$5 FROM users WHERE id=$6 AND active=TRUE RETURNING *',[request.user.id,subject,body,parentId,linkedUrl,recipientId]);
    if(!result.rowCount)return response.status(404).json({error:'הנמען אינו זמין'});
    const team=await pool.query('SELECT id,username,display_name FROM users WHERE active=TRUE AND id<>$1',[request.user.id]);
    const normalized=body.toLocaleLowerCase('he-IL');const mentioned=team.rows.filter(item=>normalized.includes(`@${String(item.display_name).toLocaleLowerCase('he-IL')}`)||normalized.includes(`@${String(item.username||'').toLocaleLowerCase('he-IL')}`)).filter(item=>Number(item.id)!==recipientId);
    for(const item of mentioned)await pool.query('INSERT INTO user_messages(sender_id,recipient_id,subject,body,parent_message_id,linked_url,mention) VALUES($1,$2,$3,$4,$5,$6,TRUE)',[request.user.id,item.id,subject||'תויגת בהודעה',body,result.rows[0].id,linkedUrl]);
    await audit(request,'create','message',String(result.rows[0].id),{recipientId,mentions:mentioned.map(item=>item.id)});response.status(201).json({message:result.rows[0],mentions:mentioned.length});
  });
  router.patch('/messages/:id/read', async (request,response) => { const result=await pool.query('UPDATE user_messages SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND recipient_id=$2 RETURNING *',[request.params.id,request.user.id]);if(!result.rowCount)return response.status(404).json({error:'ההודעה לא נמצאה'});response.json({message:result.rows[0]}); });
  router.delete('/messages', async (request,response) => {
    const ids=Array.isArray(request.body?.ids)?request.body.ids.map(Number).filter(Number.isInteger):[];
    if(!ids.length)return response.status(400).json({error:'יש לבחור לפחות הודעה אחת'});
    const result=await pool.query(`UPDATE user_messages SET hidden_for=array_append(hidden_for,$1) WHERE id=ANY($2::bigint[]) AND (sender_id=$1 OR recipient_id=$1) AND NOT ($1=ANY(hidden_for)) RETURNING id`,[request.user.id,ids]);
    await audit(request,'delete','messages',result.rows.map(row=>row.id).join(','),{count:result.rowCount});
    response.json({deleted:result.rowCount});
  });
  router.post('/mentions', async (request,response)=>{
    const userIds=[...new Set((Array.isArray(request.body.userIds)?request.body.userIds:[]).map(Number).filter(id=>Number.isInteger(id)&&id!==Number(request.user.id)))];
    const body=String(request.body.body||'').trim();if(!userIds.length||!body)return response.status(400).json({error:'יש לבחור משתמש ולצרף תוכן לתיוג'});
    const subject=String(request.body.subject||'תויגת ב-PROJECTS').slice(0,200);const linkedUrl=String(request.body.linkedUrl||'').slice(0,500);
    const result=await pool.query(`INSERT INTO user_messages(sender_id,recipient_id,subject,body,linked_url,mention) SELECT $1,id,$2,$3,$4,TRUE FROM users WHERE id=ANY($5::bigint[]) AND active=TRUE RETURNING id,recipient_id`,[request.user.id,subject,body,linkedUrl,userIds]);
    await audit(request,'create','mentions',result.rows.map(row=>row.id).join(','),{recipients:result.rows.map(row=>row.recipient_id)});response.status(201).json({created:result.rowCount});
  });

  router.patch('/preferences/appearance', async (request, response) => {
    const theme = ['light', 'dark', 'auto'].includes(request.body?.theme) ? request.body.theme : null;
    if (!theme) return response.status(400).json({ error: 'ערכת הצבעים אינה תקינה' });
    const result = await pool.query('UPDATE users SET appearance_theme=$1,updated_at=NOW() WHERE id=$2 RETURNING appearance_theme', [theme, request.user.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'המשתמש אינו זמין' });
    await audit(request, 'update', 'user_preference', String(request.user.id), { appearanceTheme: theme });
    response.json({ appearanceTheme: result.rows[0].appearance_theme });
  });

  router.patch('/preferences/message-sound', async (request, response) => {
    if (typeof request.body?.enabled !== 'boolean') return response.status(400).json({ error: 'הגדרת הצליל אינה תקינה' });
    const result = await pool.query('UPDATE users SET message_sound_enabled=$1,updated_at=NOW() WHERE id=$2 RETURNING message_sound_enabled', [request.body.enabled, request.user.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'המשתמש אינו זמין' });
    await audit(request, 'update', 'user_preference', String(request.user.id), { messageSoundEnabled: request.body.enabled });
    response.json({ messageSoundEnabled: result.rows[0].message_sound_enabled });
  });

  router.post('/ui-errors', async (request, response) => {
    const details = {
      message: String(request.body?.message || 'Unknown UI error').slice(0, 500),
      stack: String(request.body?.stack || '').slice(0, 6000),
      componentStack: String(request.body?.componentStack || '').slice(0, 6000),
      page: String(request.body?.page || '').slice(0, 80),
      path: String(request.body?.path || '').slice(0, 1000),
      userAgent: String(request.body?.userAgent || '').slice(0, 500),
    };
    console.error('PROJECTS UI error', { userId: request.user.id, ...details });
    await audit(request, 'error', 'frontend', details.page || 'unknown', details);
    response.status(204).end();
  });

  router.get('/address-search', async (request,response) => {
    const query=String(request.query.q||'').trim();if(query.length<3)return response.json({addresses:[]});
    try{response.json({addresses:await geocoder.search(query,6),provider:'photon'});}catch(error){console.error('Photon address search failed',error.message);response.json({addresses:[],provider:'photon',unavailable:true});}
  });

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

  router.delete('/audit', requireRoles('admin'), async (request, response) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('DELETE FROM audit_log');
      await client.query(
        'INSERT INTO audit_log(user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)',
        [request.user.id, 'delete', 'audit_log', 'all', JSON.stringify({ deletedCount: result.rowCount, clearedBy: request.user.displayName })],
      );
      await client.query('COMMIT');
      response.json({ deletedCount: result.rowCount });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  });

  router.get('/insights', async (request, response) => {
    response.json(await buildOperationalInsights({ pool, user:request.user }));
  });

  router.get('/team', async (_request, response) => {
    const result = await pool.query('SELECT id,username,display_name,role,active,avatar_color,avatar_icon,avatar_image,last_seen_at,last_login_at FROM users WHERE merged_into_user_id IS NULL ORDER BY active DESC,display_name');
    response.json({ users: result.rows.map((row) => ({ id: row.id, username: row.username, displayName: row.display_name, role: row.role, active: row.active, avatarColor: row.avatar_color, avatarIcon: row.avatar_icon, avatarImage:row.avatar_image, lastSeenAt:row.last_seen_at,lastLoginAt:row.last_login_at,online:Boolean(row.last_seen_at&&Date.now()-new Date(row.last_seen_at).getTime()<120000) })) });
  });

  router.post('/alerts/snooze', async (request, response) => {
    const durations = { hour: '1 hour', day: '1 day', week: '1 week', month: '1 month' };
    const duration = durations[request.body.duration];
    const keys = Array.isArray(request.body.keys) ? request.body.keys.filter((key) => /^task:\d+$/.test(key)) : [];
    if (!duration || !keys.length) return response.status(400).json({ error: 'Alert keys and a valid duration are required' });
    const result = await pool.query(`INSERT INTO user_alert_snoozes(user_id,alert_key,snoozed_until) SELECT $1,unnest($2::text[]),NOW()+$3::interval
      ON CONFLICT(user_id,alert_key) DO UPDATE SET snoozed_until=EXCLUDED.snoozed_until
      RETURNING alert_key,snoozed_until`, [request.user.id, keys, duration]);
    await audit(request, 'snooze', 'alerts', keys.join(','), { duration: request.body.duration });
    response.json({ snoozed:result.rowCount, snoozedUntil:result.rows[0]?.snoozed_until || null, keys:result.rows.map((item)=>item.alert_key) });
  });
  router.post('/alerts/dismiss', async (request,response) => {
    const keys=Array.isArray(request.body.keys)?request.body.keys.filter(key=>/^task:\d+$/.test(key)):[];
    if(!keys.length)return response.status(400).json({error:'יש לבחור התראה לביטול'});
    await pool.query(`INSERT INTO user_alert_dismissals(user_id,alert_key) SELECT $1,unnest($2::text[]) ON CONFLICT(user_id,alert_key) DO UPDATE SET dismissed_at=NOW()`,[request.user.id,keys]);
    await audit(request,'dismiss','alerts',keys.join(','));response.status(204).end();
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
    if (!['client','project','task','inspection','professional'].includes(entityType) || !fieldKey || !label) return response.status(400).json({ error: 'Entity, key and label are required' });
    const result = await pool.query(
      `INSERT INTO custom_field_definitions(entity_type, field_key, label, field_type, required, options)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [entityType, fieldKey, label, fieldType, required, JSON.stringify(options)],
    );
    await audit(request, 'create', 'custom_field', String(result.rows[0].id), request.body);
    response.status(201).json({ field: result.rows[0] });
  });

  router.patch('/custom-fields/:id', requireRoles('admin'), async (request, response) => {
    const current = await pool.query('SELECT * FROM custom_field_definitions WHERE id=$1', [request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'השדה המותאם לא נמצא' });
    const row = current.rows[0];
    const required = row.entity_type === 'client' ? false : (request.body.required ?? row.required);
    const result = await pool.query(`UPDATE custom_field_definitions SET label=$1,field_type=$2,required=$3,active=$4,sort_order=$5,options=$6 WHERE id=$7 RETURNING *`, [request.body.label ?? row.label, request.body.fieldType ?? row.field_type, required, request.body.active ?? row.active, request.body.sortOrder ?? row.sort_order, JSON.stringify(request.body.options ?? row.options), request.params.id]);
    await audit(request, 'update', 'custom_field', request.params.id, request.body);
    response.json({ field: result.rows[0] });
  });

  router.delete('/custom-fields/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM custom_field_definitions WHERE id=$1 RETURNING label', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'השדה המותאם לא נמצא' });
    await audit(request, 'delete', 'custom_field', request.params.id, { label: result.rows[0].label });
    response.status(204).end();
  });

  router.get('/clients', async (request, response) => {
    const query = String(request.query.q || '').trim();
    const like = `%${query}%`;
    const result = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id=c.id AND p.archived_at IS NULL) AS project_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.client_id=c.id AND t.status NOT IN ('done','cancelled')) AS open_task_count,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ci.id,'name',ci.name,'category',ci.category,'color',ci.color,'icon',ci.icon,'symbol',ci.symbol) ORDER BY ci.sort_order)
          FROM client_labels cl JOIN catalog_items ci ON ci.id=cl.catalog_item_id WHERE cl.client_id=c.id), '[]'::jsonb) AS labels
       FROM clients c
       WHERE $1='' OR concat_ws(' ',c.code,c.name,c.first_name,c.last_name,c.priority_customer_number,c.primary_contact_name,c.phone,c.additional_phones::text,c.email,c.additional_emails::text,c.address,c.apartment_number,c.city,c.notes) ILIKE $2
         OR EXISTS (SELECT 1 FROM client_contacts cc WHERE cc.client_id=c.id AND concat_ws(' ',cc.name,cc.company,cc.role,cc.phone,cc.additional_phones::text,cc.email) ILIKE $2)
         OR EXISTS (SELECT 1 FROM client_labels cl JOIN catalog_items ci ON ci.id=cl.catalog_item_id WHERE cl.client_id=c.id AND concat_ws(' ',ci.name,ci.symbol) ILIKE $2)
       ORDER BY c.updated_at DESC, c.name LIMIT 200`, [query, like],
    );
    response.json({ clients: result.rows.map(clientFromRow) });
  });

  router.post('/clients', requireRoles('admin', 'manager'), async (request, response) => {
    request.body.firstName=String(request.body.firstName||request.body.name||'').trim();request.body.lastName=String(request.body.lastName||'').trim();request.body.name=[request.body.firstName,request.body.lastName].filter(Boolean).join(' ');
    const required = ['firstName','lastName', 'address', 'phone'];
    if (required.some((key) => !String(request.body[key] || '').trim())) return response.status(400).json({ error: 'שם לקוח, כתובת וטלפון הם שדות חובה' });
    const next = await pool.query("SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\\D','','g'),'')::int),1000)+1 AS value FROM clients");
    const input = { clientType: 'private', ...request.body, address:withoutArabic(request.body.address), city:withoutArabic(request.body.city), priorityCustomerNumber:request.body.priorityCustomerNumber ?? request.body.customValues?.priorityCustomerNumber ?? '' };
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
    const [client, contacts, tasks, inspections, files, projects, equipment] = await Promise.all([
      pool.query(`SELECT c.*, COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ci.id,'name',ci.name,'category',ci.category,'color',ci.color,'icon',ci.icon,'symbol',ci.symbol)) FROM client_labels cl JOIN catalog_items ci ON ci.id=cl.catalog_item_id WHERE cl.client_id=c.id),'[]'::jsonb) labels FROM clients c WHERE c.id=$1`, [request.params.id]),
      pool.query('SELECT * FROM client_contacts WHERE client_id=$1 ORDER BY is_referrer DESC, name', [request.params.id]),
      pool.query('SELECT t.*,u.display_name assignee_name FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.client_id=$1 ORDER BY (t.status=\'done\'), t.due_date NULLS LAST, t.created_at DESC', [request.params.id]),
      pool.query('SELECT * FROM site_inspections WHERE client_id=$1 ORDER BY inspection_date DESC, created_at DESC', [request.params.id]),
      pool.query('SELECT * FROM client_files WHERE client_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC', [request.params.id]),
      pool.query('SELECT * FROM projects WHERE client_id=$1 ORDER BY created_at DESC', [request.params.id]),
      pool.query(`SELECT ce.*,e.name,e.code,e.unit,e.color,e.icon,e.icon_image_stored_name,e.item_type,parent.name category_name
        FROM client_equipment ce JOIN equipment_catalog e ON e.id=ce.catalog_item_id LEFT JOIN equipment_catalog parent ON parent.id=e.parent_id
        WHERE ce.client_id=$1 ORDER BY parent.name,e.name`, [request.params.id]),
    ]);
    if (!client.rowCount) return response.status(404).json({ error: 'Client not found' });
    response.json({ client: clientFromRow(client.rows[0]), contacts: contacts.rows.map(contactFromRow), tasks: tasks.rows, inspections: inspections.rows, files: files.rows, projects: projects.rows, equipment: equipment.rows });
  });

  router.post('/clients/:id/equipment', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const quantity = Number(request.body.quantity || 1);
    if (!request.body.catalogItemId || !(quantity > 0)) return response.status(400).json({ error: 'יש לבחור מערכת וכמות גדולה מאפס' });
    const result = await pool.query(`INSERT INTO client_equipment(client_id,catalog_item_id,quantity,location,notes) VALUES($1,$2,$3,$4,$5) RETURNING *`, [request.params.id, request.body.catalogItemId, quantity, request.body.location || '', request.body.notes || '']);
    await audit(request, 'create', 'client_equipment', String(result.rows[0].id), { clientId: request.params.id, quantity });
    response.status(201).json({ equipment: result.rows[0] });
  });

  router.patch('/clients/:id/equipment/:itemId', requireRoles('admin', 'manager', 'technician'), async (request, response) => {
    const current = await pool.query('SELECT * FROM client_equipment WHERE id=$1 AND client_id=$2', [request.params.itemId, request.params.id]);
    if (!current.rowCount) return response.status(404).json({ error: 'המערכת לא נמצאה בכרטיס הלקוח' });
    const row = current.rows[0]; const quantity = Number(request.body.quantity ?? row.quantity);
    if (!(quantity > 0)) return response.status(400).json({ error: 'הכמות חייבת להיות גדולה מאפס' });
    const result = await pool.query('UPDATE client_equipment SET quantity=$1,location=$2,notes=$3,updated_at=NOW() WHERE id=$4 RETURNING *', [quantity, request.body.location ?? row.location, request.body.notes ?? row.notes, request.params.itemId]);
    await audit(request, 'update', 'client_equipment', request.params.itemId, request.body); response.json({ equipment: result.rows[0] });
  });

  router.delete('/clients/:id/equipment/:itemId', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('DELETE FROM client_equipment WHERE id=$1 AND client_id=$2 RETURNING id', [request.params.itemId, request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'המערכת לא נמצאה בכרטיס הלקוח' });
    await audit(request, 'delete', 'client_equipment', request.params.itemId, { clientId: request.params.id }); response.status(204).end();
  });

  router.patch('/clients/:id', requireRoles('admin', 'manager'), async (request, response) => {
    if (request.body.address !== undefined) request.body.address=withoutArabic(request.body.address);
    if (request.body.city !== undefined) request.body.city=withoutArabic(request.body.city);
    if(request.body.firstName!==undefined||request.body.lastName!==undefined){const current=await pool.query('SELECT first_name,last_name,name FROM clients WHERE id=$1',[request.params.id]);if(!current.rowCount)return response.status(404).json({error:'הלקוח לא נמצא'});request.body.firstName=String(request.body.firstName??current.rows[0].first_name??current.rows[0].name).trim();request.body.lastName=String(request.body.lastName??current.rows[0].last_name??'').trim();request.body.name=[request.body.firstName,request.body.lastName].filter(Boolean).join(' ');}
    if (request.body.priorityCustomerNumber === undefined && request.body.customValues?.priorityCustomerNumber !== undefined) request.body.priorityCustomerNumber=request.body.customValues.priorityCustomerNumber;
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
        if (request.body.name !== undefined) {
          await client.query('UPDATE projects SET client=$1,updated_at=NOW() WHERE client_id=$2', [result.rows[0].name, request.params.id]);
        }
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
    assertVideoSize(request.file,request.user.role==='admin');
    if (!request.file) return response.status(400).json({ error: 'File is required' });
    const result = await pool.query(`INSERT INTO client_files(client_id,original_name,stored_name,mime_type,size_bytes,category,description,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [request.params.id, request.file.originalname, request.file.filename, request.file.mimetype, request.file.size, request.body.category || 'other', request.body.description || '', request.user.id]);
    await audit(request, 'upload', 'client_file', String(result.rows[0].id), { clientId: request.params.id, name: request.file.originalname });
    response.status(201).json({ file: result.rows[0] });
  });

  router.get('/files/:id/download', async (request, response) => {
    const result = await pool.query('SELECT * FROM client_files WHERE id=$1 AND deleted_at IS NULL', [request.params.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'File not found' });
    response.download(path.join(uploadDir, result.rows[0].stored_name), result.rows[0].original_name);
  });

  router.delete('/files/:id', requireRoles('admin'), async (request, response) => {
    const result = await pool.query('UPDATE client_files SET deleted_at=NOW(),deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL RETURNING id,stored_name,original_name', [request.params.id,request.user.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'File not found' });
    await audit(request, 'archive', 'client_file', request.params.id,{originalName:result.rows[0].original_name,purgeAt:new Date(Date.now()+14*86400000).toISOString()});
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
    response.json({ projects: projects.rows, events: result.rows.map((row) => ({ id: `${row.source_type}-${row.source_id}`, title: row.source_type === 'task' && row.project_name && !String(row.title).includes(row.project_name) ? `${row.project_name} — ${row.title}` : row.title, type: row.source_type, status: row.status, startAt: row.event_at, endAt: row.event_end, allDay: row.payload?.allDay ?? true, color: row.color, icon: row.icon, clientId: row.client_id, projectId: row.project_id, projectName: row.project_name, notes: row.payload?.notes || row.payload?.description || '', assigneeName: row.assignee_name, assigneeColor: row.assignee_color, assigneeIcon: row.assignee_icon })) });
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
