import express from 'express';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { buildOperationalInsights } from './insights.js';
import { buildLiveSystemKnowledge } from './aiKnowledge.js';

const INSIGHT_CACHE_TTL = 30 * 60 * 1000;
const INSIGHT_REFRESH_COOLDOWN = 5 * 60 * 1000;
const insightCache = new Map();
export const MODEL_RATES = {
  'gemini-3.5-flash-lite':{ input:0.30, output:2.50 },
  'gemini-3.6-flash':{ input:1.50, output:7.50 },
  'gemini-3.5-flash':{ input:1.50, output:9.00 },
  'gemini-3.1-flash-lite':{ input:0.25, output:1.50 },
  'gpt-5.6-luna':{ input:1.00, output:6.00 },
  'gpt-5.6-terra':{ input:2.50, output:15.00 },
  'gpt-5.6-sol':{ input:5.00, output:30.00 },
};

export const PROVIDERS = {
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
      { id:'gpt-5.6-luna', name:'GPT-5.6 Luna', recommendation:'הכי חסכוני במשפחת 5.6', cost:'$1.00 קלט / $6.00 פלט למיליון טוקנים', description:'הבחירה המומלצת לעלות נמוכה ולפעולות שוטפות.' },
      { id:'gpt-5.6-terra', name:'GPT-5.6 Terra', recommendation:'איזון מומלץ', cost:'$2.50 קלט / $15.00 פלט למיליון טוקנים', description:'איזון גבוה בין איכות, מהירות ועלות.' },
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

export function providerError(provider, status, payload) {
  const detail = payload?.error?.message || payload?.message || payload?.raw || '';
  const reason = payload?.error?.details?.find?.((item)=>item?.reason)?.reason || payload?.error?.status || payload?.error?.code || '';
  if (/API_KEY_INVALID|authentication|invalid.*key/i.test(`${reason} ${detail}`)) return 'מפתח ה־API אינו תקין. צרו מפתח חדש אצל הספק ושמרו אותו מחדש.';
  if (/FAILED_PRECONDITION/i.test(reason)) return 'החשבון אינו מורשה למסלול שנבחר באזור זה. בדקו את זמינות המסלול או הפעילו חיוב אצל הספק.';
  if (status === 401 || status === 403) return 'מפתח ה-API אינו תקין או שאין לו הרשאה לשירות.';
  if (status === 429) return 'המכסה הסתיימה או שמגבלת הקצב נחצתה. בדקו את מסלול החיוב והמכסה.';
  if (status === 404) return `המודל שנבחר אינו זמין בחשבון ${PROVIDERS[provider].name}.`;
  return detail ? `הספק החזיר שגיאה: ${detail.slice(0, 220)}` : `בדיקת החיבור נכשלה (HTTP ${status}).`;
}

const wait = (milliseconds) => new Promise((resolve)=>setTimeout(resolve,milliseconds));

async function requestProvider(provider, model, apiKey, prompt, { test, responseJson }) {
  const url = provider === 'gemini'
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    : 'https://api.openai.com/v1/responses';
  const options = provider === 'gemini' ? {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
    body:JSON.stringify({
      contents:[{ parts:[{ text:prompt }] }],
      generationConfig:{ maxOutputTokens:test ? 128 : 900, ...(responseJson ? { responseMimeType:'application/json' } : {}) },
    }),
  } : {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
    body:JSON.stringify({ model, input:prompt, max_output_tokens:test ? 128 : 900 }),
  };
  let lastError;
  for (let attempt=0;attempt<2;attempt+=1) {
    try {
      const response = await fetch(url,{ ...options,signal:AbortSignal.timeout(35000) });
      if ((response.status === 408 || response.status === 429 || response.status >= 500) && attempt === 0) {
        await response.arrayBuffer().catch(()=>{});
        const retryAfter=Number(response.headers.get('retry-after'));
        await wait(Number.isFinite(retryAfter) && retryAfter>0 ? Math.min(retryAfter*1000,5000) : 850+Math.floor(Math.random()*250));
        continue;
      }
      return response;
    } catch (error) {
      lastError=error;
      if (attempt === 0 && error.name !== 'TimeoutError') { await wait(850+Math.floor(Math.random()*250));continue; }
      throw error;
    }
  }
  throw lastError || new Error('AI provider request failed');
}

export async function generateProviderText(provider, model, apiKey, prompt, { test = false, responseJson = false, onUsage } = {}) {
  let response;
  try {
    response = await requestProvider(provider,model,apiKey,prompt,{ test,responseJson });
  } catch (error) {
    if (error.name === 'TimeoutError') throw error;
    const message=`לא ניתן להתחבר אל ${PROVIDERS[provider].name}. בדקו של־Home Assistant יש גישה לאינטרנט ול־DNS.`;
    throw Object.assign(new Error(message), { statusCode:503,publicMessage:message });
  }
  const raw = await response.text();
  let payload={};
  try { payload=raw ? JSON.parse(raw) : {}; } catch { payload={ raw:raw.slice(0,300) }; }
  if (!response.ok) {
    const message=providerError(provider,response.status,payload);
    throw Object.assign(new Error(message), { statusCode:400,publicMessage:message });
  }
  const text = provider === 'gemini'
    ? payload.candidates?.[0]?.content?.parts?.map((part)=>part.text || '').join('') || ''
    : payload.output_text || payload.output?.flatMap((item)=>item.content || []).map((item)=>item.text || '').join('') || '';
  if (!text.trim()) {
    const finishReason=payload.candidates?.[0]?.finishReason || '';
    const blockedReasons=new Set(['SAFETY','RECITATION','LANGUAGE','PROHIBITED_CONTENT','SPII','BLOCKLIST','IMAGE_SAFETY','IMAGE_PROHIBITED_CONTENT','IMAGE_RECITATION','CONTENT_BLOCKED']);
    const blocked=payload.promptFeedback?.blockReason || (blockedReasons.has(finishReason) ? finishReason : '');
    const incomplete=payload.incomplete_details?.reason || (finishReason==='MAX_TOKENS' ? finishReason : '') || (payload.status && payload.status!=='completed' ? payload.status : '');
    const message=blocked
      ? `הספק חסם את יצירת התשובה (${blocked}). נסחו את השאלה מחדש ללא מידע רגיש.`
      : incomplete
        ? `הספק לא השלים את התשובה (${incomplete}). נסו שאלה קצרה וממוקדת יותר.`
        : 'הספק החזיר תשובה ריקה. בדקו את המודל שנבחר ונסו שוב.';
    throw Object.assign(new Error(message),{ statusCode:422,publicMessage:message });
  }
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

export async function testProvider(provider, model, apiKey) {
  const text=await generateProviderText(provider, model, apiKey, 'Reply with exactly OK', { test:true });
  if (!text.trim()) throw new Error('AI provider returned an empty test response');
  return true;
}

export function parseInsightResponse(text) {
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

export async function buildChatContext(pool, question, user = { role:'admin',id:null }) {
  const normalized = String(question || '').toLowerCase();
  const wantsHelp = /(איך|איפה|כיצד).*(יוצר|מפיק|מגדיר|משתמש|מעלה|משתף|מוסיף|עורך|מוחק|פותח)|מה.*(עושה|המטרה)|הסבר|טאב|פעולה|עזרה|מדריך|how to|where.*setting|help|create|export/.test(normalized);
  const wantsProjects = /פרויקט|לקוח|כתובת|שלב|התקדמות|project|client/.test(normalized);
  const wantsTasks = /משימ|איחור|לבצע|תאריך|יומן|לוח שנה|task|calendar/.test(normalized);
  const wantsFinance = /כספ|תשלום|גבייה|יתרה|שקל|חשבונ|payment|finance/.test(normalized);
  const wantsPeople = /איש מקצוע|טכנאי|מנהל|אדריכל|חשמלאי|מפקח|ספק|עובד|professional|manager/.test(normalized);
  const wantsSystems = /מערכת|רכיב|מצלמ|אזעק|תקשורת|בית חכם|ציוד|knx|system|equipment/.test(normalized);
  const queries = [
    pool.query(`SELECT COUNT(*)::int projects,
      COUNT(*) FILTER (WHERE archived_at IS NULL)::int active_projects,
      COALESCE(ROUND(AVG(progress) FILTER (WHERE archived_at IS NULL)),0)::int average_progress,
      COALESCE(SUM(value-paid) FILTER (WHERE archived_at IS NULL),0)::numeric outstanding
      FROM projects`),
  ];
  const keys = ['overview'];
  if ((!wantsHelp && wantsProjects) || (!wantsHelp && !wantsTasks && !wantsFinance && !wantsPeople && !wantsSystems)) {
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
    keys.push('projectSystems');
    queries.push(pool.query(`SELECT system name,COUNT(DISTINCT p.id)::int projects
      FROM projects p CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.systems,'[]'::jsonb)) system
      WHERE p.archived_at IS NULL GROUP BY system ORDER BY projects DESC,system LIMIT 60`));
    keys.push('systems');
    queries.push(pool.query(`SELECT ec.name,ec.item_type,COALESCE(parent.name,'ללא קטגוריה') category,
      COUNT(DISTINCT pe.project_id)::int projects,COALESCE(SUM(pe.quantity),0)::numeric quantity
      FROM project_equipment pe JOIN equipment_catalog ec ON ec.id=pe.catalog_item_id
      LEFT JOIN equipment_catalog parent ON parent.id=ec.parent_id
      GROUP BY ec.id,parent.name ORDER BY quantity DESC LIMIT 60`));
  }
  const results = await Promise.all(queries);
  const context = Object.fromEntries(results.map((result,index)=>[keys[index],result.rows]));
  if (wantsHelp) context.help = {
    createProject:[
      'לחצו על פרויקט חדש בכותרת הראשית.',
      'שלב 1: הזינו שם פרויקט ובחרו לקוח קיים, או צרו לקוח חדש עם שם פרטי, שם משפחה, טלפון וכתובת.',
      'שלב 2: בחרו מנהל פרויקט, שלב התחלתי, תאריכי התחלה ומסירה ושווי משוער.',
      'שלב 3: בחרו מערכות ורכיבים וכמות, ואז לחצו יצירת פרויקט.',
    ],
    calendarShare:[
      'פתחו הגדרות ומערכת ובחרו Outlook.',
      'צרו קישור לוח שנה לקריאה בלבד והעתיקו אותו.',
      'ב-Outlook בחרו Add calendar ואז Subscribe from web והדביקו את הקישור.',
    ],
    pdfReport:[
      'פתחו דוחות וניתוחים ולחצו אשף דוח PDF.',
      'בחרו סוג דוח ופרויקט לפי הצורך.',
      'בחרו אם לשמור עותק במסמכי הפרויקט ולחצו הפקת והורדת PDF.',
    ],
    aiSettings:'הגדרות הספק, המודל, מפתח ה-API והתקציב נמצאות תחת הגדרות ומערכת > סוכן AI.',
  };
  context.systemKnowledge = await buildLiveSystemKnowledge(pool,question,user);
  return context;
}

export function chatPrompt({ question, history, context }) {
  const safeHistory = (Array.isArray(history) ? history : []).filter((item)=>['user','assistant'].includes(item?.role)).slice(-6).map((item)=>({
    role:item?.role === 'assistant' ? 'assistant' : 'user',
    text:String(item?.text || '').slice(0,1200),
  }));
  return `אתה הסוכן החכם של PROJECTS לניהול פרויקטי בית חכם ומתח נמוך.
ענה בעברית ברורה, קצרה ומעשית. התבסס רק על נתוני PROJECTS המצורפים ועל מבנה המערכת המתואר כאן.
אם הנתונים אינם מספיקים, אמור זאת במפורש ואל תמציא. ציין מספרים ושמות רק כאשר הם קיימים בהקשר.
אתה במצב קריאה בלבד: אל תטען שביצעת שינוי, מחיקה, שליחה או שמירה.

מבנה המערכת: תמונת מצב; לוח שנה; פרויקטים ומפה; לקוחות; אנשי מקצוע; מערכות ורכיבים; טפסים ומסמכים; תשלומים וגבייה; משימות ואבני דרך; דוחות וניתוחים; הגדרות. הגדרות ספק AI נמצאות תחת הגדרות ומערכת > סוכן AI.

קטלוג היכולות, סכמת המערכת, מצב הרשומות והשינויים האחרונים נבנו מחדש בזמן השאלה ונמצאים ב-systemKnowledge. השתמש בהם כמקור האמת למבנה העדכני ולשינויים במערכת.
בשאלת עזרה השתמש ב-systemKnowledge.helpGuide: הסבר תחילה את מטרת המסך או הפעולה, אחר כך את דרך העבודה בצעדים, ולבסוף הרשאות, קשרים והערות חשובות אם הם קיימים. אל תמציא כפתור או פעולה שאינם מופיעים במדריך.
אל תחשוף סודות, סיסמאות, מפתחות, טוקנים או מידע שאינו כלול בהקשר המורשה למשתמש.

היסטוריית השיחה: ${JSON.stringify(safeHistory)}
נתונים רלוונטיים ועדכניים: ${JSON.stringify(context)}
שאלת המשתמש: ${String(question).slice(0,1500)}

החזר תשובה בלבד, ללא JSON. כאשר מתאים השתמש ברשימה קצרה.`;
}

const STAGE_LABELS = {
  waiting:'בהמתנה',mobilization:'בהנעה',infrastructure:'תשתיות',threading:'השחלות',
  threading_done:'בוצעו השחלות',installation_a:'התקנות שלב א׳',installation_b:'התקנות שלב ב׳',
  installation_c:'התקנות שלב ג׳',activation_programming:'הפעלות ותכנות',finishes:'פינישים',post_delivery:'מוכן למסירה',
};

const money = (value) => `${Number(value || 0).toLocaleString('he-IL',{ minimumFractionDigits:2,maximumFractionDigits:2 })} ש״ח`;

export async function buildLocalChatAnswer(pool, question) {
  const normalized=String(question || '').toLowerCase();
  if (/(איך|כיצד).*(יוצר|פותח|מקים).*פרויקט/.test(normalized)) return [
    'ליצירת פרויקט חדש:',
    '1. לחצו על „פרויקט חדש” בכותרת הראשית.',
    '2. בחרו לקוח קיים או צרו לקוח חדש והשלימו שם, טלפון וכתובת.',
    '3. בחרו מנהל, שלב התחלתי, תאריכי התחלה ומסירה ושווי משוער.',
    '4. בחרו מערכות ורכיבים וכמויות ולחצו „יצירת פרויקט”.',
  ].join('\n');
  if (/(איך|איפה|כיצד).*(outlook|אאוטלוק|שיתוף.*לוח|לוח.*שיתוף)/.test(normalized)) return 'פתחו הגדרות ומערכת > Outlook, צרו קישור לקריאה בלבד והעתיקו אותו. ב‑Outlook בחרו Add calendar > Subscribe from web והדביקו את הקישור.';
  if (/(איך|איפה|כיצד).*(דוח|pdf)/.test(normalized)) return 'פתחו דוחות וניתוחים > אשף דוח PDF, בחרו סוג דוח ופרויקט, בחרו אם לשמור עותק במסמכי הפרויקט ולחצו „הפקת והורדת PDF”.';
  if (/יתרה.*גבייה|גבייה.*כוללת|כמה.*לגבות/.test(normalized)) {
    const result=await pool.query(`SELECT COALESCE(SUM(value-paid),0)::numeric outstanding FROM projects WHERE archived_at IS NULL`);
    return `היתרה הכוללת לגבייה בפרויקטים הפעילים היא ${money(result.rows[0]?.outstanding)}.`;
  }
  if (/תמונת מצב.*פרויקט|מצב.*פרויקט.*פעיל|סיכום.*פרויקט/.test(normalized)) {
    const [summary,stages,tasks]=await Promise.all([
      pool.query(`SELECT COUNT(*)::int active,COALESCE(ROUND(AVG(progress)),0)::int progress,
        COALESCE(SUM(value-paid),0)::numeric outstanding FROM projects WHERE archived_at IS NULL`),
      pool.query(`SELECT stage,COUNT(*)::int count FROM projects WHERE archived_at IS NULL GROUP BY stage ORDER BY count DESC,stage LIMIT 5`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled'))::int open,
        COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled') AND due_date<CURRENT_DATE)::int overdue FROM tasks`),
    ]);
    const item=summary.rows[0] || {};
    const stageText=stages.rows.map((row)=>`${STAGE_LABELS[row.stage] || row.stage}: ${row.count}`).join(', ') || 'אין חלוקת שלבים';
    return `תמונת מצב: ${item.active || 0} פרויקטים פעילים, התקדמות ממוצעת ${item.progress || 0}%, יתרה לגבייה ${money(item.outstanding)}. משימות פתוחות: ${tasks.rows[0]?.open || 0}, מתוכן באיחור: ${tasks.rows[0]?.overdue || 0}. חלוקת שלבים: ${stageText}.`;
  }
  if (/תשומת לב|בסיכון|דורש.*טיפול|דורשים.*טיפול/.test(normalized)) {
    const result=await pool.query(`SELECT p.name,p.stage,p.progress,p.health,p.flag,
      COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','cancelled') AND t.due_date<CURRENT_DATE)::int overdue
      FROM projects p LEFT JOIN tasks t ON t.project_id=p.id WHERE p.archived_at IS NULL
      GROUP BY p.id HAVING p.health<75 OR COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','cancelled') AND t.due_date<CURRENT_DATE)>0 OR btrim(COALESCE(p.flag,''))<>''
      ORDER BY overdue DESC,p.health,p.progress LIMIT 8`);
    if (!result.rows.length) return 'לא נמצאו כרגע פרויקטים פעילים עם משימות באיחור, מדד בריאות נמוך או דגל פעיל.';
    return `הפרויקטים שדורשים תשומת לב:\n${result.rows.map((row,index)=>`${index+1}. ${row.name} — ${STAGE_LABELS[row.stage] || row.stage}, ${row.progress}% התקדמות${row.overdue ? `, ${row.overdue} משימות באיחור` : ''}${row.health<75 ? `, בריאות ${row.health}` : ''}${row.flag ? `, דגל: ${row.flag}` : ''}`).join('\n')}`;
  }
  if (/שלב.*התקנ|נמצאים.*התקנ|בהתקנות/.test(normalized)) {
    const result=await pool.query(`SELECT name,stage,progress,manager FROM projects
      WHERE archived_at IS NULL AND stage IN ('installation_a','installation_b','installation_c') ORDER BY stage,progress DESC`);
    if (!result.rows.length) return 'אין כרגע פרויקטים פעילים בשלבי ההתקנות.';
    return `פרויקטים בשלבי התקנות:\n${result.rows.map((row,index)=>`${index+1}. ${row.name} — ${STAGE_LABELS[row.stage]}, ${row.progress}%${row.manager ? `, מנהל: ${row.manager}` : ''}`).join('\n')}`;
  }
  if (/משימ.*איחור|משימות.*באיחור/.test(normalized)) {
    const result=await pool.query(`SELECT t.title,t.due_date,p.name project_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id
      WHERE t.status NOT IN ('done','cancelled') AND t.due_date<CURRENT_DATE ORDER BY t.due_date LIMIT 20`);
    if (!result.rows.length) return 'אין כרגע משימות פעילות באיחור.';
    return `משימות באיחור:\n${result.rows.map((row,index)=>`${index+1}. ${row.title}${row.project_name ? ` — ${row.project_name}` : ''}, יעד ${new Date(row.due_date).toLocaleDateString('he-IL')}`).join('\n')}`;
  }
  if (/כמה.*פרויקט.*מצלמ|פרויקט.*כולל.*מצלמ/.test(normalized)) {
    const result=await pool.query(`SELECT DISTINCT p.name FROM projects p WHERE p.archived_at IS NULL AND (
      EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(p.systems,'[]'::jsonb)) system WHERE system ILIKE ANY(ARRAY['%מצלמ%','%cctv%','%nvr%','%frigate%','%scrypted%']))
      OR EXISTS (SELECT 1 FROM project_equipment pe JOIN equipment_catalog ec ON ec.id=pe.catalog_item_id
        LEFT JOIN equipment_catalog parent ON parent.id=ec.parent_id WHERE pe.project_id=p.id
        AND (ec.name ILIKE ANY(ARRAY['%מצלמ%','%cctv%','%nvr%','%frigate%','%scrypted%']) OR parent.name ILIKE '%מצלמ%')))
      ORDER BY p.name`);
    return result.rows.length ? `${result.rows.length} פרויקטים פעילים כוללים מערכות מצלמות: ${result.rows.map((row)=>row.name).join(', ')}.` : 'לא נמצאו מערכות מצלמות המשויכות לפרויקטים הפעילים.';
  }
  return '';
}

export async function createAiRouter({ pool, authenticate, requireRoles, audit, dataDir }) {
  const router = express.Router();
  const encryptionKey = await getEncryptionKey(dataDir);
  const runningChatJobs = new Set();
  router.use(authenticate);

  const cleanChatJobs = () => pool.query(`DELETE FROM ai_chat_jobs
    WHERE expires_at<NOW() OR created_at<NOW()-INTERVAL '1 day'`);

  const chatError = (error) => ({
    error:error.name === 'TimeoutError'
      ? 'הסוכן לא השיב בזמן. נסו שוב; אם התקלה חוזרת, בדקו את חיבור האינטרנט של Home Assistant.'
      : error.publicMessage || 'לא ניתן להכין כרגע את נתוני השיחה. נסו שוב; אם התקלה חוזרת, בדקו את יומן ה־Add-on.',
  });

  const usageRecorder = (request,provider,model,feature) => async (usage) => {
    try {
      await pool.query(`INSERT INTO ai_usage_log(user_id,provider,model,feature,input_tokens,output_tokens,total_tokens,estimated_cost_usd)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[request.user.id,provider,model,feature,usage.inputTokens,usage.outputTokens,usage.totalTokens,usage.estimatedCostUsd]);
    } catch (error) { console.error('AI usage logging failed',error.message); }
  };

  async function monthlyUsageUsd() {
    const result=await pool.query(`SELECT COALESCE(SUM(estimated_cost_usd),0)::numeric spent
      FROM ai_usage_log WHERE created_at>=date_trunc('month',CURRENT_DATE)`);
    return Number(result.rows[0]?.spent) || 0;
  }

  async function enforceBudget(global) {
    const limit=Number(global.monthlyBudgetUsd) || 0;
    if (limit<=0) return;
    const spent=await monthlyUsageUsd();
    if (spent<limit) return;
    const message=`תקציב ה־AI החודשי של PROJECTS נוצל ($${spent.toFixed(2)} מתוך $${limit.toFixed(2)}). מנהל מערכת יכול להגדיל את התקציב או להגדיר 0 ללא הגבלה.`;
    throw Object.assign(new Error(message),{ statusCode:402,publicMessage:message });
  }

  async function getSettings() {
    const [globalResult, providerResult,spent] = await Promise.all([
      pool.query("SELECT value FROM app_settings WHERE key='ai'"),
      pool.query('SELECT * FROM ai_provider_settings ORDER BY provider'),
      monthlyUsageUsd(),
    ]);
    const global = { activeProvider:'gemini', monthlyBudgetUsd:10, ...(globalResult.rows[0]?.value || {}),readOnly:true };
    const rows = Object.fromEntries(providerResult.rows.map((row)=>[row.provider,row]));
    return { ...global, monthUsageUsd:spent, providers:Object.fromEntries(Object.keys(PROVIDERS).map((provider)=>[provider,publicProvider(rows[provider],provider)])) };
  }

  async function runChatJob(jobId) {
    if (runningChatJobs.has(jobId)) return;
    runningChatJobs.add(jobId);
    let job;
    try {
      const claimed=await pool.query(`UPDATE ai_chat_jobs SET status='working',updated_at=NOW()
        WHERE id=$1 AND (status='pending' OR (status='working' AND updated_at<NOW()-INTERVAL '20 seconds'))
        RETURNING *`,[jobId]);
      job=claimed.rows[0];
      if (!job) return;
      const [providerResult,userResult]=await Promise.all([
        pool.query(`SELECT provider,enabled,model,api_key_encrypted FROM ai_provider_settings WHERE provider=$1`,[job.provider]),
        pool.query('SELECT id,display_name,role FROM users WHERE id=$1',[job.user_id]),
      ]);
      const selected=providerResult.rows[0];
      const definition=PROVIDERS[job.provider];
      if (!definition || !selected?.enabled || !selected.api_key_encrypted) {
        throw Object.assign(new Error('הסוכן אינו מוכן. יש לבדוק את הגדרות ספק ה-AI.'),{ publicMessage:'הסוכן אינו מוכן. יש לבדוק את הגדרות ספק ה-AI.' });
      }
      const jobUser=userResult.rows[0] || { id:job.user_id,role:'user',display_name:'' };
      const context=await buildChatContext(pool,job.question,{ ...jobUser,displayName:jobUser.display_name });
      const answer=(await generateProviderText(
        job.provider,
        job.model || selected.model,
        decrypt(selected.api_key_encrypted,encryptionKey),
        chatPrompt({ question:job.question,history:job.history,context }),
        { onUsage:usageRecorder({ user:{ id:job.user_id } },job.provider,job.model || selected.model,'chat') },
      )).trim();
      if (!answer) throw new Error('AI provider returned an empty answer');
      await pool.query(`UPDATE ai_chat_jobs SET status='complete',answer=$2,error='',generated_at=NOW(),updated_at=NOW(),
        expires_at=NOW()+INTERVAL '10 minutes' WHERE id=$1`,[jobId,answer.slice(0,6000)]);
    } catch (error) {
      console.error('AI chat failed',job?.provider || 'unknown',error.message);
      const failure=chatError(error);
      try {
        await pool.query(`UPDATE ai_chat_jobs SET status='error',error=$2,updated_at=NOW(),
          expires_at=NOW()+INTERVAL '10 minutes' WHERE id=$1`,[jobId,failure.error]);
      } catch (updateError) { console.error('AI chat failure persistence failed',updateError.message); }
    } finally {
      runningChatJobs.delete(jobId);
    }
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
      await enforceBudget(global);
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
      return response.json({ ...base, ai:{ status:'fallback', provider:global.activeProvider, providerName:definition.name, model:selected.model, generatedAt:new Date().toISOString(), error:error.publicMessage || 'לא ניתן היה לעדכן את ניתוח ה-AI. מוצגות תובנות מקומיות עד לניסיון הבא.' } });
    }
  });

  router.post('/ai/chat/stream', async (request,response) => {
    const question=String(request.body?.question || '').trim();
    if (question.length<2 || question.length>1500) return response.status(400).json({ error:'יש להזין שאלה באורך 2–1,500 תווים' });
    response.status(200).set({
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'X-Accel-Buffering':'no',
      Connection:'keep-alive',
    });
    response.flushHeaders();
    const send=(payload)=>{ if (!response.writableEnded && !response.destroyed) response.write(`data: ${JSON.stringify(payload)}\n\n`); };
    send({ type:'status',status:'working' });
    const heartbeat=setInterval(()=>{ if (!response.writableEnded && !response.destroyed) response.write(`: heartbeat ${Date.now()}\n\n`); },5000);
    try {
      const localAnswer=await buildLocalChatAnswer(pool,question);
      if (localAnswer) {
        send({ type:'answer',answer:localAnswer,provider:'local',providerName:'PROJECTS',model:'מנוע נתונים מקומי',generatedAt:new Date().toISOString() });
        return;
      }
      const [globalResult,providerResult]=await Promise.all([
        pool.query("SELECT value FROM app_settings WHERE key='ai'"),
        pool.query('SELECT provider,enabled,model,api_key_encrypted FROM ai_provider_settings'),
      ]);
      const global={ activeProvider:'gemini',...(globalResult.rows[0]?.value || {}) };
      const selected=providerResult.rows.find((row)=>row.provider===global.activeProvider);
      const definition=PROVIDERS[global.activeProvider];
      if (!definition || !selected?.enabled || !selected.api_key_encrypted) throw Object.assign(new Error('הסוכן אינו מוכן'),{ publicMessage:'הסוכן אינו מוכן. יש להפעיל ספק ולשמור מפתח API תחת הגדרות ומערכת > סוכן AI.' });
      await enforceBudget(global);
      const context=await buildChatContext(pool,question,request.user);
      const history=Array.isArray(request.body?.history) ? request.body.history : [];
      const answer=(await generateProviderText(global.activeProvider,selected.model,decrypt(selected.api_key_encrypted,encryptionKey),chatPrompt({ question,history,context }),{
        onUsage:usageRecorder(request,global.activeProvider,selected.model,'chat'),
      })).trim();
      send({ type:'answer',answer:answer.slice(0,6000),provider:global.activeProvider,providerName:definition.name,model:selected.model,generatedAt:new Date().toISOString() });
    } catch (error) {
      console.error('AI streaming chat failed',error.message);
      send({ type:'error',...chatError(error) });
    } finally {
      clearInterval(heartbeat);
      if (!response.writableEnded) response.end();
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
    await cleanChatJobs();
    const activeJob=await pool.query(`SELECT 1 FROM ai_chat_jobs WHERE user_id=$1 AND status IN ('pending','working') LIMIT 1`,[request.user.id]);
    if (activeJob.rowCount) return response.status(409).json({ error:'שאלה קודמת עדיין בעיבוד. המתינו לתשובה לפני שליחת שאלה נוספת.' });
    try { await enforceBudget(global); }
    catch (error) { return response.status(error.statusCode || 402).json({ error:error.publicMessage || error.message }); }
    const jobId=randomBytes(18).toString('base64url');
    const history=Array.isArray(request.body?.history) ? request.body.history : [];
    await pool.query(`INSERT INTO ai_chat_jobs(id,user_id,status,question,history,provider,model)
      VALUES($1,$2,'pending',$3,$4::jsonb,$5,$6)`,[jobId,request.user.id,question,JSON.stringify(history),global.activeProvider,selected.model]);
    response.status(202).json({ jobId,status:'working' });
    void runChatJob(jobId);
  });

  router.get('/ai/chat/:jobId', async (request,response) => {
    await cleanChatJobs();
    const result=await pool.query(`SELECT id,user_id,status,answer,error,provider,model,generated_at
      FROM ai_chat_jobs WHERE id=$1 AND user_id=$2`,[request.params.jobId,request.user.id]);
    const job=result.rows[0];
    if (!job) return response.status(404).json({ error:'בקשת השיחה אינה זמינה עוד' });
    if (job.status==='pending' || job.status==='working') {
      void runChatJob(job.id);
      return response.status(202).json({ status:'working' });
    }
    if (job.status==='error') return response.status(422).json({ error:job.error });
    response.json({ answer:job.answer,provider:job.provider,providerName:PROVIDERS[job.provider]?.name || job.provider,model:job.model,generatedAt:job.generated_at });
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
      [JSON.stringify({ activeProvider, monthlyBudgetUsd, readOnly:true }),request.user.id]);
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
