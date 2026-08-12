import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BACKUP_PATTERN = /^projects-.*\.(?:projects-backup|dump)$/;
const DEFAULT_POLICY = { enabled:false, frequency:'daily', retention:14, hour:'02:00', destination:'internal', relativePath:'PROJECTS/Backups' };

function safeSharePath(relativePath) {
  const root = path.resolve('/share');
  const clean = String(relativePath || 'PROJECTS/Backups').replace(/\\/g, '/').split('/').filter((part) => part && part !== '.').join('/');
  if (clean.split('/').includes('..')) throw Object.assign(new Error('נתיב Share אינו תקין'), { statusCode:400 });
  const resolved = path.resolve(root, clean);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw Object.assign(new Error('נתיב Share אינו מורשה'), { statusCode:400 });
  return resolved;
}

export async function createBackupRouter({ pool, authenticate, requireRoles, audit, dataDir, appVersion }) {
  const router = express.Router();
  const internalDir = path.join(dataDir, 'backups');
  const importDir = path.join(internalDir, 'imports');
  await Promise.all([mkdir(internalDir, { recursive:true }), mkdir(importDir, { recursive:true })]);

  const getPolicy = async () => {
    const result = await pool.query("SELECT value FROM app_settings WHERE key='backupPolicy'");
    return { ...DEFAULT_POLICY, ...(result.rows[0]?.value || {}) };
  };
  const targetFor = (policy) => policy.destination === 'share' ? safeSharePath(policy.relativePath) : internalDir;
  const listDirectory = async (directory, source) => {
    try {
      const names = await readdir(directory);
      return (await Promise.all(names.filter((name) => BACKUP_PATTERN.test(name)).map(async (name) => {
        const info = await stat(path.join(directory, name));
        return { name, source, size:info.size, createdAt:info.mtime.toISOString(), format:name.endsWith('.projects-backup')?'full':'database' };
      }))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    } catch { return []; }
  };
  const prune = async (directory, retention) => {
    const backups = await listDirectory(directory, 'target');
    const keep = Math.min(Math.max(Number(retention) || 14, 1), 100);
    await Promise.all(backups.slice(keep).map((item)=>unlink(path.join(directory,item.name)).catch(()=>{})));
  };
  const createBackup = async ({ automatic=false, userId=null }={}) => {
    const policy = await getPolicy();
    const destination = targetFor(policy);
    await mkdir(destination, { recursive:true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `projects-${stamp}.projects-backup`;
    const temporary = await mkdtemp('/tmp/projects-backup-');
    try {
      const filesDir = path.join(temporary, 'files');
      await mkdir(filesDir, { recursive:true });
      await execFileAsync('pg_dump', ['--format=custom','--no-owner','--file',path.join(temporary,'database.dump'),'projects'], { env:process.env });
      for (const folder of ['uploads','branding']) {
        try { await cp(path.join(dataDir,folder), path.join(filesDir,folder), { recursive:true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      const manifest = { product:'PROJECTS', version:appVersion, formatVersion:1, createdAt:new Date().toISOString(), automatic, includes:['postgresql','uploads','branding'] };
      await writeFile(path.join(temporary,'manifest.json'), JSON.stringify(manifest,null,2));
      await execFileAsync('tar', ['-czf',path.join(destination,name),'-C',temporary,'manifest.json','database.dump','files']);
      await prune(destination, policy.retention);
      await pool.query('INSERT INTO audit_log(user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)', [userId,'backup','system',name,JSON.stringify({automatic,destination:policy.destination})]);
      return { name, source:policy.destination, destination:destination, format:'full' };
    } finally { await rm(temporary,{recursive:true,force:true}); }
  };
  const validatePackage = async (filePath) => {
    const { stdout } = await execFileAsync('tar',['-tzf',filePath]);
    const entries = stdout.split(/\r?\n/).filter(Boolean);
    if (entries.some((entry)=>entry.startsWith('/') || entry.split('/').includes('..'))) throw Object.assign(new Error('חבילת הגיבוי מכילה נתיב לא בטוח'),{statusCode:400});
    if (!entries.includes('manifest.json') || !entries.includes('database.dump')) throw Object.assign(new Error('זו אינה חבילת גיבוי תקינה של PROJECTS'),{statusCode:400});
    const temporary = await mkdtemp('/tmp/projects-verify-');
    try {
      await execFileAsync('tar',['-xzf',filePath,'-C',temporary,'manifest.json','database.dump']);
      const manifest = JSON.parse(await readFile(path.join(temporary,'manifest.json'),'utf8'));
      if (manifest.product !== 'PROJECTS' || Number(manifest.formatVersion) !== 1) throw Object.assign(new Error('גרסת חבילת הגיבוי אינה נתמכת'), { statusCode:400 });
      await execFileAsync('pg_restore',['--list',path.join(temporary,'database.dump')]);
      return manifest;
    } finally { await rm(temporary,{recursive:true,force:true}); }
  };
  const locate = async (name, source) => {
    const safeName = path.basename(String(name || ''));
    if (safeName !== name || !BACKUP_PATTERN.test(safeName)) throw Object.assign(new Error('שם גיבוי אינו תקין'),{statusCode:400});
    const policy = await getPolicy();
    const directory = source === 'share' ? targetFor({ ...policy, destination:'share' }) : internalDir;
    const filePath = path.join(directory,safeName);
    await stat(filePath);
    return filePath;
  };
  const scheduleRestore = async (sourcePath, originalName, request) => {
    const extension = originalName.endsWith('.projects-backup') ? '.projects-backup' : '.dump';
    const stagedName = `restore-${Date.now()}-${randomUUID()}${extension}`;
    const stagedPath = path.join(internalDir,stagedName);
    if (path.resolve(sourcePath) !== path.resolve(stagedPath)) await cp(sourcePath,stagedPath);
    if (extension === '.projects-backup') await validatePackage(stagedPath);
    else await execFileAsync('pg_restore',['--list',stagedPath]);
    await audit(request,'restore_requested','system',originalName,{format:extension==='.dump'?'database':'full'});
    await writeFile(path.join(dataDir,'restore.request'),stagedPath);
    return stagedPath;
  };

  const upload = multer({ storage:multer.diskStorage({ destination:importDir, filename:(_request,_file,callback)=>callback(null,`import-${Date.now()}-${randomUUID()}.projects-backup`) }), limits:{fileSize:2*1024*1024*1024,files:1} });
  router.use(authenticate,requireRoles('admin'));
  router.get('/system/backups', async (_request,response) => {
    const policy=await getPolicy(); const target=targetFor(policy); await mkdir(target,{recursive:true});
    const [internal,targetItems]=await Promise.all([listDirectory(internalDir,'internal'),policy.destination==='share'?listDirectory(target,'share'):Promise.resolve([])]);
    response.json({policy,backups:[...targetItems,...internal].filter((item,index,array)=>array.findIndex((other)=>other.name===item.name&&other.source===item.source)===index).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
  });
  router.patch('/system/backup-policy', async (request,response) => {
    const policy={...DEFAULT_POLICY,...request.body,enabled:Boolean(request.body.enabled),frequency:request.body.frequency==='weekly'?'weekly':'daily',retention:Math.min(Math.max(Number(request.body.retention)||14,1),100),destination:request.body.destination==='share'?'share':'internal',relativePath:String(request.body.relativePath||'PROJECTS/Backups').replace(/\\/g,'/')};
    const target=targetFor(policy);await mkdir(target,{recursive:true});const probe=path.join(target,`.projects-write-test-${randomUUID()}`);await writeFile(probe,'ok');await unlink(probe);
    await pool.query("INSERT INTO app_settings(key,value,updated_by) VALUES('backupPolicy',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()",[JSON.stringify(policy),request.user.id]);
    await audit(request,'update','backup_policy','primary',policy);response.json({policy,resolvedPath:target});
  });
  router.post('/system/backups', async (request,response)=>response.status(201).json({backup:await createBackup({userId:request.user.id})}));
  router.get('/system/backups/:source/:name/download', async (request,response)=>response.download(await locate(request.params.name,request.params.source),request.params.name));
  router.post('/system/backups/import', upload.single('backup'), async (request,response) => {
    if(!request.file)return response.status(400).json({error:'יש לבחור חבילת גיבוי'});
    try{const manifest=await validatePackage(request.file.path);const finalName=`projects-imported-${Date.now()}.projects-backup`;await rename(request.file.path,path.join(internalDir,finalName));await audit(request,'import','system',finalName,{originalName:request.file.originalname,manifest});response.status(201).json({backup:{name:finalName,source:'internal',format:'full'},manifest});}catch(error){await unlink(request.file.path).catch(()=>{});throw error;}
  });
  router.post('/system/restore', async (request,response) => {
    const sourcePath=await locate(request.body.name,request.body.source||'internal');await scheduleRestore(sourcePath,request.body.name,request);response.status(202).json({status:'restarting'});setTimeout(async()=>{await pool.end();process.exit(0);},500);
  });

  let schedulerBusy=false;
  const runScheduler=async()=>{if(schedulerBusy)return;schedulerBusy=true;try{const policy=await getPolicy();if(!policy.enabled)return;const localization=await pool.query("SELECT value FROM app_settings WHERE key='localization'");const timezone=localization.rows[0]?.value?.timezone||'Asia/Jerusalem';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter((part)=>part.type!=='literal').map((part)=>[part.type,part.value]));const dateKey=`${parts.year}-${parts.month}-${parts.day}`;const [scheduledHour,scheduledMinute]=String(policy.hour||'02:00').split(':').map(Number);const reachedTime=Number(parts.hour)*60+Number(parts.minute)>=scheduledHour*60+scheduledMinute;const due=reachedTime&&(policy.frequency!=='weekly'||parts.weekday==='Sun');if(due&&policy.lastAutomaticDate!==dateKey){await createBackup({automatic:true});await pool.query("UPDATE app_settings SET value=jsonb_set(value,'{lastAutomaticDate}',to_jsonb($1::text)),updated_at=NOW() WHERE key='backupPolicy'",[dateKey]);}}catch(error){console.error('Automatic backup failed',error.message)}finally{schedulerBusy=false;}};
  setTimeout(runScheduler,15000);setInterval(runScheduler,60000);
  return router;
}
