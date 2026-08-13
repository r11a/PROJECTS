import express from 'express';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { buildOperationalInsights } from './insights.js';

const INSIGHT_CACHE_TTL = 30 * 60 * 1000;
const INSIGHT_REFRESH_COOLDOWN = 5 * 60 * 1000;
const insightCache = new Map();
const MODEL_RATES = {
  'gemini-3.5-flash-lite':{ input:0.30, output:2.50 },
  'gemini-3.6-flash':{ input:1.50, output:7.50 },
  'gemini-3.5-flash':{ input:1.50, output:9.00 },
  'gemini-3.1-flash-lite':{ input:0.25, output:1.50 },
  'gpt-5.6-luna':{ input:0.20, output:1.20 },
  'gpt-5.6-terra':{ input:2.00, output:12.00 },
  'gpt-5.6-sol':{ input:5.00, output:30.00 },
};

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    defaultModel: 'gemini-3.5-flash-lite',
    models: [
      { id:'gemini-3.5-flash-lite', name:'Gemini 3.5 Flash-Lite', recommendation:'הכי חסכוני', cost:'$0.30 קלט / $2.50 פלט למיליון טוקנים; מכסה חינמית בכפוף ל-Google', description:'הבחירה המומלצת להתחלה: מהיר וחסכוני לשאלות, חיפוש וסיכומים.' },
      { id:'gemini-3.6-flash', name:'Gemini 3.6 Flash', recommendation:'איזון מומלץ', cost:'$1.50 קלט / $7.50 פלט למיליון טוקנים', description:'איזון טוב יותר בין הבנת מידע, איכות תשובה ומהירות.' },
      { id:'gemini-3.5-flash', name:'Gemini 3.5 Flash', recommendation:'משימות מורכבות', cost:'$1.50 קלט / $9.00 פלט למיליון טוקנים', description:'מתאים יותר לניתוח מתמשך ולמשימות מורכבות.' },
      { id:'gemini-3.1-flash-lite', name:'Gemini 3.1 Flash-Lite', recommendation:'חלופה חסכונית', cost:'$0.25 קלט / $1.50 פלט למיליון טוקנים; מכסה חינמית בכפוף ל-Google', description:'מודל קל וחסכוני כחלופה ל-Flash-Lite העדכני.' },
    ],
  },
  openai: {
    name: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    defaultModel: 'gpt-5.6-luna',
    models: [
      { id:'gpt-5.6-luna', name:'GPT-5.6 Luna', recommendation:'הכי חסכוני', cost:'$0.20 קלט / $1.20 פלט למיליון טוקנים', description:'הבחירה המומלצת לעלות נמוכה ולפעולות שוטפות.' },
      { id:'gpt-5.6-terra', name:'GPT-5.6 Terra', recommendation:'איזון מומלץ', cost:'$2.00 קלט / $12.00 פלט למיליון טוקנים', description:'איזון גבוה בין איכות, מהירות ועלות.' },
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

async function generateProviderText(provider, model, apiKey, prompt, { test = false, responseJson = false, onUsage } = {}) {
  const timeout = AbortSignal.timeout(25000);
  let response;
  if (provider === 'gemini') {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method:'POST', signal:timeout,
      headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
      body:JSON.stringify({
        contents:[{ parts:[{ text:prompt }] }],
        generationConfig:{ maxOutputTokens:test ? 16 : 900, temperature:test ? 0 : 0.2, ...(responseJson ? { responseMimeType:'application/json' } : {}) },
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
  const text = provider === 'gemini'
    ? payload.candidates?.[0]?.content?.parts?.map((part)=>part.text || '').join('') || ''
    : payload.output_text || payload.output?.flatMap((item)=>item.content || []).map((item)=>item.text || '').join('') || '';
  if (!test && onUsage) {
    const inputTokens = Number(provider === 'gemini' ? payload.usageMetadata?.promptTokenCount : payload.usage?.input_tokens) || Math.ceil(prompt.length / 4);
    const reportedTotal = Number(provider === 'gemini' ? payload.usageMetadata?.totalTokenCount : payload.usage?.total_tokens);
    const candidateOutput = Number(provider === 'gemini' ? payload.usageMetadata?.candidatesTokenCount : payload.usage?.output_tokens) || Math.ceil(text.length / 4);
    const outputTokens = provider === 'gemini' && reportedTotal ? Math.max(candidateOutput,reportedTotal-inputTokens) : candidateOutput;
    const totalTokens = reportedTotal || inputTokens + outputTokens;
    const rates = MODEL_RATES[model] || { input:0,output:0 };
    await onUsage({ inputTokens,outputTokens,totalTokens,estimatedCostUsd:(inputTokens*rates.input+outputTokens*rates.output)/1_000_000 });
  }
  return text;
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

async function buildChatContext(pool, question) {
  const normalized = String(question || '').toLowerCase();
  const wantsProjects = /פרויקט|לקוח|כתובת|שלב|התקדמות|project|client/.test(normalized);
  const wantsTasks = /משימ|איחור|לבצע|תאריך|יומן|לוח שנה|task|calendar/.test(normalized);
  const wantsFinance = /כספ|תשלום|גבייה|יתרה|שקל|חשבונ|payment|finance/.test(normalized);
  const wantsPeople = /איש מקצוע|טכנאי|מנהל|אדריכל|חשמלאי|מפקח|ספק|עובד|professional|manager/.test(normalized);
  const wantsSystems = /מערכת|רכיב|מצלמ|אזעק|תקשורת|בית חכם|ציוד|knx|system|equipment/.test(normalized);
  const queries = [
    pool.query(`SELECT COUNT(*)::int projects,
      COUNT(*) FILTER (WHERE archived_at IS NULL)::int active_projects,
      COALESCE(ROUND(AVG(progress)) FILTER (WHERE archived_at IS NULL),0)::int average_progress,
      COALESCE(SUM(value-paid) FILTER (WHERE archived_at IS NULL),0)::numeric outstanding
      FROM projects`),
  ];
  const keys = ['overview'];
  if (wantsProjects || (!wantsTasks && !wantsFinance && !wantsPeople && !wantsSystems)) {
    keys.push('projects');
    queries.push(pool.query(`SELECT serial_code,name,client,address,stage,progress,manager,value,paid,due,health,flag,project_size,contractor_progress
      FROM projects WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT 60`));
    keys.push('clients');
    queries.push(pool.query(`SELECT name,phone,email,address,city,priority_customer_number,status
      FROM clients ORDER BY updated_at DESC LIMIT 60`));
  }
  if (wantsTasks) {
    keys.push('tasks');
    queries.push(pool.query(`SELECT t.title,t.status,t.priority,t.due_date,t.start_date,p.name project_name,
      COALESCE(u.display_name,pr.display_name,'לא הוקצה') assignee
      FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assignee_id
      LEFT JOIN professionals pr ON pr.id=t.assignee_professional_id
      WHERE t.status NOT IN ('done','cancelled') ORDER BY t.due_date,t.priority DESC LIMIT 60`));
  }
  if (wantsFinance) {
    keys.push('finance');
    queries.push(pool.query(`SELECT serial_code,name,client,value,paid,(value-paid) outstanding,due
      FROM projects WHERE archived_at IS NULL AND value>paid ORDER BY (value-paid) DESC LIMIT 50`));
  }
  if (wantsPeople) {
    keys.push('professionals');
    queries.push(pool.query(`SELECT display_name,company_name,job_title,affiliation,phone,email,active
      FROM professionals ORDER BY active DESC,display_name LIMIT 60`));
  }
  if (wantsSystems) {
    keys.push('systems');
    queries.push(pool.query(`SELECT ec.name,ec.item_type,COALESCE(parent.name,'ללא קטגוריה') category,
      COUNT(DISTINCT pe.project_id)::int projects,COALESCE(SUM(pe.quantity),0)::numeric quantity
      FROM project_equipment pe JOIN equipment_catalog ec ON ec.id=pe.catalog_item_id
      LEFT JOIN equipment_catalog parent ON parent.id=ec.parent_id
      GROUP BY ec.id,parent.name ORDER BY quantity DESC LIMIT 60`));
  }
  const results = await Promise.all(queries);
  return Object.fromEntries(results.map((result,index)=>[keys[index],result.rows]));
}

function chatPrompt({ question, history, context }) {
  const safeHistory = (Array.isArray(history) ? history : []).slice(-6).map((item)=>({
    role:item?.role === 'assistant' ? 'assistant' : 'user',
    text:String(item?.text || '').slice(0,1200),
  }));
  return `אתה הסוכן החכם של PROJECTS לניהול פרויקטי בית חכם ומתח נמוך.
ענה בעברית ברורה, קצרה ומעשית. התבסס רק על נתוני PROJECTS המצורפים ועל מבנה המערכת המתואר כאן.
אם הנתונים אינם מספיקים, אמור זאת במפורש ואל תמציא. ציין מספרים ושמות רק כאשר הם קיימים בהקשר.
אתה במצב קריאה בלבד: אל תטען שביצעת שינוי, מחיקה, שליחה או שמירה.

מבנה המערכת: תמונת מצב; לוח שנה; פרויקטים ומפה; לקוחות; אנשי מקצוע; מערכות ורכיבים; טפסים ומסמכים; תשלומים וגבייה; משימות ואבני דרך; דוחות וניתוחים; הגדרות. הגדרות ספק AI נמצאות תחת הגדרות ומערכת > סוכן AI.

היסטוריית השיחה: ${JSON.stringify(safeHistory)}
נתונים רלוונטיים ועדכניים: ${JSON.stringify(context)}
שאלת המשתמש: ${String(question).slice(0,1500)}

החזר תשובה בלבד, ללא JSON. כאשר מתאים השתמש ברשימה קצרה.`;
}

export async function createAiRouter({ pool, authenticate, requireRoles, audit, dataDir }) {
  const router = express.Router();
  const encryptionKey = await getEncryptionKey(dataDir);
  router.use(authenticate);

  const usageRecorder = (request,provider,model,feature) => async (usage) => {
    try {
      await pool.query(`INSERT INTO ai_usage_log(user_id,provider,model,feature,input_tokens,output_tokens,total_tokens,estimated_cost_usd)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[request.user.id,provider,model,feature,usage.inputTokens,usage.outputTokens,usage.totalTokens,usage.estimatedCostUsd]);
    } catch (error) { console.error('AI usage logging failed',error.message); }
  };

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
      const text = await generateProviderText(global.activeProvider, selected.model, decrypt(selected.api_key_encrypted,encryptionKey), insightPrompt(snapshot), {
        responseJson:true,
        onUsage:usageRecorder(request,global.activeProvider,selected.model,'insights'),
      });
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

  router.post('/ai/chat', async (request, response) => {
    const question = String(request.body?.question || '').trim();
    if (question.length < 2 || question.length > 1500) return response.status(400).json({ error:'יש להזין שאלה באורך 2–1,500 תווים' });
    const [globalResult, providerResult] = await Promise.all([
      pool.query("SELECT value FROM app_settings WHERE key='ai'"),
      pool.query('SELECT provider,enabled,model,api_key_encrypted FROM ai_provider_settings'),
    ]);
    const global = { activeProvider:'gemini', ...(globalResult.rows[0]?.value || {}) };
    const selected = providerResult.rows.find((row)=>row.provider === global.activeProvider);
    const definition = PROVIDERS[global.activeProvider];
    if (!definition || !selected?.enabled || !selected.api_key_encrypted) {
      return response.status(409).json({ error:'הסוכן אינו מוכן. יש להפעיל ספק ולשמור מפתח API תחת הגדרות ומערכת > סוכן AI.' });
    }
    try {
      const context = await buildChatContext(pool,question);
      const answer = (await generateProviderText(
        global.activeProvider,
        selected.model,
        decrypt(selected.api_key_encrypted,encryptionKey),
        chatPrompt({ question, history:request.body?.history, context }),
        { onUsage:usageRecorder(request,global.activeProvider,selected.model,'chat') },
      )).trim();
      if (!answer) throw new Error('AI provider returned an empty answer');
      response.json({ answer:answer.slice(0,6000), provider:global.activeProvider, providerName:definition.name, model:selected.model, generatedAt:new Date().toISOString() });
    } catch (error) {
      console.error('AI chat failed', global.activeProvider, error.message);
      response.status(502).json({ error:error.name === 'TimeoutError' ? 'הסוכן לא השיב בזמן. נסו שוב בעוד רגע.' : 'לא ניתן לקבל כרגע תשובה מהסוכן. בדקו את החיבור והמכסה של ספק ה-AI.' });
    }
  });

  router.get('/ai/settings', requireRoles('admin'), async (_request, response) => response.json(await getSettings()));

  router.patch('/ai/settings', requireRoles('admin'), async (request, response) => {
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

  router.post('/ai/providers/:provider/test', requireRoles('admin'), async (request, response) => {
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
