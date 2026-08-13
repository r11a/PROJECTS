import express from 'express';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { buildOperationalInsights } from './insights.js';

const INSIGHT_CACHE_TTL = 30 * 60 * 1000;
const INSIGHT_REFRESH_COOLDOWN = 5 * 60 * 1000;
const insightCache = new Map();

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    defaultModel: 'gemini-3.5-flash-lite',
    models: [
      { id:'gemini-3.5-flash-lite', name:'Gemini 3.5 Flash-Lite', recommendation:'הכי חסכוני', cost:'מסלול חינמי זמין בכפוף למכסת Google', description:'הבחירה המומלצת להתחלה: מהיר וחסכוני לשאלות, חיפוש וסיכומים.' },
      { id:'gemini-3.6-flash', name:'Gemini 3.6 Flash', recommendation:'איזון מומלץ', cost:'לפי מכסת ותעריפי החשבון', description:'איזון טוב יותר בין הבנת מידע, איכות תשובה ומהירות.' },
      { id:'gemini-3.5-flash', name:'Gemini 3.5 Flash', recommendation:'משימות מורכבות', cost:'לפי מכסת ותעריפי החשבון', description:'מתאים יותר לניתוח מתמשך ולמשימות מורכבות.' },
      { id:'gemini-3.1-flash-lite', name:'Gemini 3.1 Flash-Lite', recommendation:'חלופה חסכונית', cost:'מסלול חינמי זמין בכפוף למכסת Google', description:'מודל קל וחסכוני כחלופה ל-Flash-Lite העדכני.' },
    ],
  },
  openai: {
    name: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    defaultModel: 'gpt-5.6-luna',
    models: [
      { id:'gpt-5.6-luna', name:'GPT-5.6 Luna', recommendation:'הכי חסכוני', cost:'$0.20 קלט / $1.20 פלט למיליון טוקנים', description:'הבחירה המומלצת לעלות נמוכה ולפעולות שוטפות.' },
      { id:'gpt-5.6-terra', name:'GPT-5.6 Terra', recommendation:'איזון מומלץ', cost:'$2 קלט / $12 פלט למיליון טוקנים', description:'איזון גבוה בין איכות, מהירות ועלות.' },
      { id:'gpt-5.6-sol', name:'GPT-5.6 Sol', recommendation:'איכות מרבית', cost:'$5 קלט / $30 פלט למיליון טוקנים', description:'לניתוחים המורכבים ביותר; אינו הבחירה החסכונית.' },
    ],
  },
};

async function getEncryptionKey(dataDir) {
  const file = path.join(dataDir, 'ai.secret');
  try {
    const key = Buffer.from((await readFile(file, 'utf8')).trim(), 'base64');
    if (key.length === 32) return key;
  } catch {}
  const key = randomBytes(32);
  await writeFile(file, key.toString('base64'), { mode:0o600 });
  return key;
}

function encrypt(value, key) {
  if (!value) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part)=>part.toString('base64url')).join('.');
}

function decrypt(value, key) {
  if (!value) return '';
  const [iv, tag, encrypted] = value.split('.').map((part)=>Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function publicProvider(row, provider) {
  const definition = PROVIDERS[provider];
  return {
    provider,
    name:definition.name,
    enabled:Boolean(row?.enabled),
    configured:Boolean(row?.api_key_encrypted),
    model:row?.model || definition.defaultModel,
    models:definition.models,
    keyUrl:definition.keyUrl,
    docsUrl:definition.docsUrl,
    lastTestedAt:row?.last_tested_at || null,
    lastTestStatus:row?.last_test_status || null,
    lastTestError:row?.last_test_error || '',
  };
}

function providerError(provider, status, payload) {
  const detail = payload?.error?.message || payload?.message || '';
  if (status === 401 || status === 403) return 'מפתח ה-API אינו תקין או שאין לו הרשאה לשירות.';
  if (status === 429) return 'המכסה הסתיימה או שמגבלת הקצב נחצתה. בדקו את מסלול החיוב והמכסה.';
  if (status === 404) return `המודל שנבחר אינו זמין בחשבון ${PROVIDERS[provider].name}.`;
  return detail ? `הספק החזיר שגיאה: ${detail.slice(0, 220)}` : `בדיקת החיבור נכשלה (HTTP ${status}).`;
}

async function generateProviderText(provider, model, apiKey, prompt, { test = false } = {}) {
  const timeout = AbortSignal.timeout(25000);
  let response;
  if (provider === 'gemini') {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method:'POST', signal:timeout,
      headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
      body:JSON.stringify({
        contents:[{ parts:[{ text:prompt }] }],
        generationConfig:{ maxOutputTokens:test ? 16 : 900, temperature:test ? 0 : 0.2, ...(test ? {} : { responseMimeType:'application/json' }) },
      }),
    });
  } else {
    response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST', signal:timeout,
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
      body:JSON.stringify({ model, input:prompt, max_output_tokens:test ? 16 : 900 }),
    });
  }
  const payload = await response.json().catch(()=>({}));
  if (!response.ok) throw Object.assign(new Error(providerError(provider, response.status, payload)), { statusCode:400 });
  if (provider === 'gemini') return payload.candidates?.[0]?.content?.parts?.map((part)=>part.text || '').join('') || '';
  if (payload.output_text) return payload.output_text;
  return payload.output?.flatMap((item)=>item.content || []).map((item)=>item.text || '').join('') || '';
}

async function testProvider(provider, model, apiKey) {
  await generateProviderText(provider, model, apiKey, 'Reply with exactly OK', { test:true });
  return true;
}

function parseInsightResponse(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI response did not contain valid JSON');
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  const tones = new Set(['danger','warning','info','success']);
  const targets = new Set(['dashboard','projects','tasks','calendar','finance','reports','systems']);
  const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).slice(0, 4).map((item)=>({
    tone:tones.has(item?.tone) ? item.tone : 'info',
    title:String(item?.title || '').trim().slice(0, 90),
    text:String(item?.text || '').trim().slice(0, 180),
    target:targets.has(item?.target) ? item.target : 'dashboard',
  })).filter((item)=>item.title && item.text);
  if (!suggestions.length) throw new Error('AI response did not contain usable insights');
  return { summary:String(parsed.summary || '').trim().slice(0, 240), suggestions };
}

function insightPrompt(snapshot) {
  return `אתה סוכן תפעולי בתוך PROJECTS, מערכת לניהול פרויקטי בית חכם ומתח נמוך.
נתח רק את נתוני הסיכום המצורפים. אל תנחש מידע שאינו קיים ואל תחזור על אותו מדד בניסוחים שונים.
בחר 3–4 תובנות קצרות, מעשיות ובעדיפות ניהולית: איחורים וסיכונים, עומס, גבייה, קצב התקדמות וצווארי בקבוק.
החזר JSON בלבד במבנה הבא:
{"summary":"משפט מנהלים אחד","suggestions":[{"tone":"danger|warning|info|success","title":"כותרת קצרה","text":"פעולה מומלצת וקונקרטית","target":"dashboard|projects|tasks|calendar|finance|reports|systems"}]}
כל הטקסט למשתמש חייב להיות בעברית. הנתונים:
${JSON.stringify(snapshot)}`;
}

export async function createAiRouter({ pool, authenticate, requireRoles, audit, dataDir }) {
  const router = express.Router();
  const encryptionKey = await getEncryptionKey(dataDir);
  router.use(authenticate);

  async function getSettings() {
    const [globalResult, providerResult] = await Promise.all([
      pool.query("SELECT value FROM app_settings WHERE key='ai'"),
      pool.query('SELECT * FROM ai_provider_settings ORDER BY provider'),
    ]);
    const global = { activeProvider:'gemini', monthlyBudgetUsd:10, readOnly:true, ...(globalResult.rows[0]?.value || {}) };
    const rows = Object.fromEntries(providerResult.rows.map((row)=>[row.provider,row]));
    return { ...global, providers:Object.fromEntries(Object.keys(PROVIDERS).map((provider)=>[provider,publicProvider(rows[provider],provider)])) };
  }

  router.get('/ai/insights', async (request, response) => {
    const base = await buildOperationalInsights({ pool, user:request.user });
    const [globalResult, providerResult] = await Promise.all([
      pool.query("SELECT value FROM app_settings WHERE key='ai'"),
      pool.query('SELECT provider,enabled,model,api_key_encrypted FROM ai_provider_settings'),
    ]);
    const global = { activeProvider:'gemini', ...(globalResult.rows[0]?.value || {}) };
    const selected = providerResult.rows.find((row)=>row.provider === global.activeProvider);
    const definition = PROVIDERS[global.activeProvider];
    if (!definition || !selected?.enabled || !selected.api_key_encrypted) {
      return response.json({ ...base, ai:{ status:selected?.enabled ? 'unconfigured' : 'disabled', provider:global.activeProvider, model:selected?.model || definition?.defaultModel || '', generatedAt:new Date().toISOString() } });
    }

    const snapshot = {
      stats:base.stats,
      stages:base.analysisContext.stages,
      workload:base.analysisContext.workload.map((item,index)=>({ teamMember:index + 1, projects:item.projects, averageProgress:item.average_progress })),
    };
    const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const cacheKey = `${request.user.role}:${global.activeProvider}:${selected.model}`;
    const cached = insightCache.get(cacheKey);
    const now = Date.now();
    const force = request.query.refresh === '1';
    const canReuse = cached && !force && (cached.fingerprint === fingerprint && now - cached.createdAt < INSIGHT_CACHE_TTL || now - cached.createdAt < INSIGHT_REFRESH_COOLDOWN);
    if (canReuse) {
      return response.json({ ...base, ...cached.value, ai:{ ...cached.value.ai, cached:true } });
    }

    try {
      const text = await generateProviderText(global.activeProvider, selected.model, decrypt(selected.api_key_encrypted,encryptionKey), insightPrompt(snapshot));
      const generated = parseInsightResponse(text);
      const value = {
        summary:generated.summary,
        suggestions:[...generated.suggestions, ...base.suggestions].filter((item,index,items)=>items.findIndex((candidate)=>candidate.title === item.title) === index).slice(0,4),
        ai:{ status:'ready', provider:global.activeProvider, providerName:definition.name, model:selected.model, generatedAt:new Date().toISOString(), cached:false },
      };
      insightCache.set(cacheKey,{ fingerprint, createdAt:now, value });
      return response.json({ ...base, ...value });
    } catch (error) {
      console.error('AI insights generation failed', global.activeProvider, error.message);
      return response.json({ ...base, ai:{ status:'fallback', provider:global.activeProvider, providerName:definition.name, model:selected.model, generatedAt:new Date().toISOString(), error:'לא ניתן היה לעדכן את ניתוח ה-AI. מוצגות תובנות מקומיות עד לניסיון הבא.' } });
    }
  });

  router.use(requireRoles('admin'));

  router.get('/ai/settings', async (_request, response) => response.json(await getSettings()));

  router.patch('/ai/settings', async (request, response) => {
    const provider = String(request.body.provider || '');
    if (!PROVIDERS[provider]) return response.status(400).json({ error:'ספק AI אינו נתמך' });
    const model = String(request.body.model || '');
    if (!PROVIDERS[provider].models.some((item)=>item.id === model)) return response.status(400).json({ error:'המודל שנבחר אינו נתמך' });
    const activeProvider = PROVIDERS[request.body.activeProvider] ? request.body.activeProvider : provider;
    const monthlyBudgetUsd = Math.min(Math.max(Number(request.body.monthlyBudgetUsd) || 0, 0), 100000);
    const current = await pool.query('SELECT api_key_encrypted FROM ai_provider_settings WHERE provider=$1', [provider]);
    let encryptedKey = current.rows[0]?.api_key_encrypted || '';
    const keyChanged = typeof request.body.apiKey === 'string' && request.body.apiKey.trim().length > 0;
    if (keyChanged) encryptedKey = encrypt(request.body.apiKey.trim(), encryptionKey);
    if (request.body.clearApiKey === true) encryptedKey = '';
    await pool.query(`INSERT INTO ai_provider_settings(provider,enabled,model,api_key_encrypted,updated_by)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider) DO UPDATE SET enabled=EXCLUDED.enabled,model=EXCLUDED.model,
      api_key_encrypted=EXCLUDED.api_key_encrypted,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [provider,Boolean(request.body.enabled),model,encryptedKey,request.user.id]);
    await pool.query(`INSERT INTO app_settings(key,value,updated_by) VALUES('ai',$1,$2)
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [JSON.stringify({ activeProvider, monthlyBudgetUsd, readOnly:request.body.readOnly !== false }),request.user.id]);
    await audit(request,'update','ai_provider',provider,{ model, activeProvider, enabled:Boolean(request.body.enabled), keyChanged:keyChanged || request.body.clearApiKey === true });
    response.json(await getSettings());
  });

  router.post('/ai/providers/:provider/test', async (request, response) => {
    const provider = request.params.provider;
    if (!PROVIDERS[provider]) return response.status(404).json({ error:'ספק AI אינו נתמך' });
    const result = await pool.query('SELECT model,api_key_encrypted FROM ai_provider_settings WHERE provider=$1',[provider]);
    if (!result.rows[0]?.api_key_encrypted) return response.status(400).json({ error:'יש להזין ולשמור מפתח API לפני בדיקת החיבור' });
    try {
      await testProvider(provider,result.rows[0].model,decrypt(result.rows[0].api_key_encrypted,encryptionKey));
      await pool.query("UPDATE ai_provider_settings SET last_tested_at=NOW(),last_test_status='success',last_test_error=NULL WHERE provider=$1",[provider]);
      await audit(request,'test','ai_provider',provider,{ model:result.rows[0].model, success:true });
      response.json({ success:true, message:`החיבור אל ${PROVIDERS[provider].name} תקין` });
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'בדיקת החיבור הסתיימה ללא מענה. בדקו את החיבור לאינטרנט.' : error.message;
      await pool.query("UPDATE ai_provider_settings SET last_tested_at=NOW(),last_test_status='error',last_test_error=$2 WHERE provider=$1",[provider,message]);
      await audit(request,'test','ai_provider',provider,{ model:result.rows[0].model, success:false });
      response.status(400).json({ error:message });
    }
  });
  return router;
}
