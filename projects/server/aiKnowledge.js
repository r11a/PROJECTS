const SENSITIVE_TABLES = new Set([
  'ai_provider_settings',
  'ai_chat_jobs',
  'calendar_feed_tokens',
  'user_alert_snoozes',
  'user_alert_dismissals',
]);

const FINANCE_TABLES = new Set(['project_payments']);
const FINANCE_KEY = /^(finance|financeProjects|payments|financeBreakdown|financeMode|paymentTerms|depositAmount|depositPaid|priceImpact|estimatedCost|estimatedCostUsd|monthlyBudgetUsd|value|paid|balance|amount|finance_projects|finance_breakdown|finance_mode|payment_terms|deposit_amount|deposit_paid|price_impact|estimated_cost|estimated_cost_usd|monthly_budget_usd|overdue_payments)$/i;
const FINANCE_TEXT = /(finance|payment|paid|price|cost|budget|deposit|credit|amount|\u05db\u05e1\u05e4|\u05d2\u05d1\u05d9|\u05ea\u05e9\u05dc\u05d5\u05dd|\u05d9\u05ea\u05e8\u05d4|\u05ea\u05e7\u05e6\u05d9\u05d1|\u05de\u05d7\u05d9\u05e8|\u05e2\u05dc\u05d5\u05ea|\u05de\u05e7\u05d3\u05de\u05d4|\u05d6\u05d9\u05db\u05d5\u05d9|\u05e1\u05db\u05d5\u05dd)/i;

function containsFinanceText(value) {
  try { return FINANCE_TEXT.test(typeof value === 'string' ? value : JSON.stringify(value)); }
  catch { return false; }
}

function stripFinanceKnowledge(value) {
  if (Array.isArray(value)) return value.map(stripFinanceKnowledge).filter((item)=>item !== null);
  if (typeof value === 'string') return containsFinanceText(value) ? null : value;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key])=>!FINANCE_KEY.test(key))
    .map(([key,item])=>[key,stripFinanceKnowledge(item)])
    .filter(([,item])=>item !== null));
}

export const PRODUCT_CAPABILITIES = [
  { area:'תמונת מצב', features:['מדדי פרויקטים','תובנות אוטומטיות','משימות והתראות','פעילות אחרונה'] },
  { area:'העבודה שלי', features:['משימות אישיות','איחורים','ממתינות לתלות','תצוגות שמורות'] },
  { area:'לוח שנה', features:['יום, שבוע, חודש ושנה','סינון לפי פרויקט','אירועים ומשימות','שיתוף Outlook לקריאה בלבד'] },
  { area:'פרויקטים', features:['אשף הקמה','ארכיון','מפה','שלבים והתקדמות','צוות','מערכות ורכיבים','קבצים ומדיה','ביקורות אתר','סיכומי פגישות','שעות עבודה','כספים','גאנט'] },
  { area:'לקוחות', features:['פרטי קשר וכתובת','מספר Priority','תגיות ודגלים','פרויקטים ומסמכים משויכים'] },
  { area:'אנשי מקצוע', features:['עובדי חברה וחיצוניים','תפקידים גמישים','שיוך לפרויקטים','אווטרים ופרטי קשר'] },
  { area:'מערכות ורכיבים', features:['קטגוריות ותתי קטגוריות','כמויות בפרויקט','אייקונים ותמונות','סריקת הזמנת Priority'] },
  { area:'מסמכים והקלטות', features:['תבניות וטפסים ממולאים','צילום והעלאה','הקלטות קוליות ותמלול','תצוגה והורדה','אחסון פנימי או NAS','סל מחזור'] },
  { area:'תשלומים וגבייה', features:['תקציב, תשלום ויתרה','מועדי גבייה','סטטוסים ודוחות'] },
  { area:'משימות ואבני דרך', features:['אחראי ומבצע','תתי משימות ותלויות','קדימות וקריטיות','תיוג משתמשים','התראות ודחייה'] },
  { area:'לוח גאנט', features:['פורטפוליו וכל פרויקט','תלויות','נתיב קריטי','גרירה ושינוי משך','יום, שבוע וחודש'] },
  { area:'בקרת ביצוע', features:['בריאות פרויקט','Baseline','בקשות שינוי','אוטומציות ותבניות פרויקט'] },
  { area:'דוחות וניתוחים', features:['סטטיסטיקות','אשף PDF','מצגת ניהול','דוחות בעזרת AI','שימוש ועלות AI'] },
  { area:'הודעות', features:['הודעות בין משתמשים','תגובות','תיוג @','קישור לישות','צליל הודעה'] },
  { area:'הגדרות ומערכת', access:'admin', features:['חברה ולוגו','משתמשים והרשאות','Audit','מראה אישי','AI','מפה וכתובות','NAS','גיבוי ושחזור','נתוני דמו'] },
];

// This guide is product documentation, not customer data. Keep it close to the
// implemented navigation so the assistant can explain both the purpose and the
// actual workflow of every workspace without inventing actions.
export const PRODUCT_HELP_GUIDE = [
  { area:'תמונת מצב', keywords:['דשבורד','אריח','תובנות'], purpose:'מסך ניהולי מהיר שמרכז מצב פרויקטים, גבייה, משימות חריגות ופעילות אחרונה.', actions:['לחיצה על אריח פותחת את הרשימה שממנה חושב המדד','אריח התובנות מציג את התובנות האחרונות','החיפוש העליון מאתר ישויות בכל המערכת'], connections:['פרויקטים','משימות ואבני דרך','תשלומים וגבייה','דוחות וניתוחים'] },
  { area:'העבודה שלי', keywords:['אישי','שלי','עדיפויות','סדר יום'], purpose:'מרכז העבודה האישי של המשתמש. הוא מאחד משימות באיחור, להיום, בהמשך, חסומות והודעות רלוונטיות כדי שלא יהיה צורך לעבור בין פרויקטים.', actions:['סינון לפי פרויקט ועדיפות','שמירת תצוגה אישית','השלמת משימה או דחייתה למחר','פתיחת המשימה או הפרויקט המקושר'], permissions:'כל משתמש רואה רק עבודה והודעות המותרות לו.' },
  { area:'לוח שנה', keywords:['אירוע','תאריך','Outlook','ics'], purpose:'ציר זמן דינמי של משימות, אבני דרך ואירועים מכל הפרויקטים.', actions:['מעבר בין יום, שבוע, חודש ושנה','בחירת תאריך יזומה וחזרה להיום','סינון לפי פרויקט','שיתוף קישור ICS לקריאה בלבד ב-Outlook'], notes:['שינויים במערכת מתעדכנים בלוח אוטומטית','שיתוף Outlook הוא חד-כיווני ואינו מאפשר עריכה מ-Outlook'] },
  { area:'פרויקטים', keywords:['פרויקט','אשף','ארכיון','מפה'], purpose:'מרכז ניהול מחזור החיים של כל פרויקט, מהקמה ועד מסירה וארכיון.', actions:['יצירה באמצעות אשף','מיון וסינון לפי עמודות, שלב וסטטוס','מעבר בין פעילים לארכיון','פתיחת מיקום במפה','עריכת פרטי הפרויקט, הלקוח, הסיווג, היעדים והצוות'], tabs:{'סקירה':'בריאות, שלב, התקדמות ומידע מרכזי','משימות ואבני דרך':'תכנון ביצוע, אחראים, מבצעים, תלויות ותתי-משימות','גאנט':'לוח זמנים, קשרי תלות ונתיב קריטי','ביקורות ופגישות':'תיעוד ביקורת אתר וסיכומי פגישות','שעות עבודה':'דיווח שעות וניתוח מול יעדי התקנה ותכנות','מערכות וצוות':'מערכות, כמויות ואנשי הצוות בפרויקט','טפסים וקבצים':'מסמכים, תמונות, וידאו וטפסים משויכים','כספים':'תקציב, תשלומים ויתרה','פעילות':'היסטוריית עדכונים בפרויקט'} },
  { area:'לקוחות', keywords:['לקוח','Priority','כתובת','תג','דגל'], purpose:'מאגר לקוחות שמחבר בין פרטי קשר, כתובת, פרויקטים ומסמכים.', actions:['יצירה ועריכת שם פרטי, שם משפחה, טלפון, כתובת ומספר Priority','חיפוש, מיון ותצוגת טבלה או לוח','פתיחת דוא״ל וטלפון מהמכשיר','צפייה בפרויקטים המשויכים'], notes:['יצירת פרויקט ללקוח חדש יוצרת ומקשרת רשומת לקוח אחת, במקום עותק לא קשור.'] },
  { area:'אנשי מקצוע', keywords:['איש מקצוע','טכנאי','אדריכל','חשמלאי','ספק','תפקיד'], purpose:'מאגר נפרד של עובדי חברה ואנשי מקצוע חיצוניים; איש מקצוע אינו חייב להיות משתמש בתוכנה.', actions:['יצירה ועריכת פרטי איש מקצוע','ניהול תפקידים, אייקונים ושדות','סינון עובד חברה או חיצוני','שיוך אותו אדם למספר פרויקטים ותפקידים'], notes:['משתמש הוא זהות כניסה והרשאות; איש מקצוע הוא ישות תפעולית. ניתן לקשר ביניהם בלי לאחד את המשמעות.'] },
  { area:'מערכות ורכיבים', keywords:['מערכת','רכיב','קטלוג','KNX','מצלמה','אזעקה','תקשורת'], purpose:'קטלוג מערכות, תתי-קטגוריות ורכיבים לשימוש חוזר בפרויקטים.', actions:['ניהול קטגוריות, תתי-קטגוריות, אייקונים ותמונות','שיוך רכיבים וכמויות לפרויקט','הוספה ידנית של פריט','סריקת הזמנת Priority והצעת מק״ט וכמות לבדיקה'] },
  { area:'מסמכים והקלטות', keywords:['טופס','מסמך','קובץ','תמונה','וידאו','NAS','צילום','הקלטה','תמלול'], purpose:'מרכז יצירה, העלאה, צפייה ושמירה של מסמכים, מדיה והקלטות קוליות.', actions:['צילום מהטלפון או בחירת קובץ','הקלטה קולית, ניגון ותמלול','תצוגה מקדימה והורדה','שיוך ישיר ללקוח או לפרויקט','שמירה באחסון הפנימי או בתיקיית NAS שהוגדרה','מחיקת מנהל לסל מחזור ושחזור בתקופת השמירה'], permissions:'מחיקה מותרת למנהל מערכת בלבד; הצפייה כפופה להרשאות הישות המשויכת.' },
  { area:'תשלומים וגבייה', keywords:['כספים','גבייה','תשלום','יתרה','תקציב'], purpose:'מעקב אחר ערך הפרויקט, תשלומים שהתקבלו, יתרה ומועדי גבייה.', actions:['הוספת תשלום או אבן גבייה','שינוי סטטוס','פתיחת הפרויקט מהיתרה','הפקת דוח כספי'], notes:['היתרה מחושבת מהערך פחות התשלומים שנקלטו.'] },
  { area:'משימות ואבני דרך', keywords:['משימה','אבן דרך','תלות','קריטית','אחראי','מבצע'], purpose:'סביבת הביצוע המרכזית לכל המשימות מכל הפרויקטים.', actions:['יצירה ועריכת משימה','הגדרת אחראי, מבצע, עדיפות, תאריך התחלה וסיום','יצירת תת-משימות ותלות במשימה פתוחה מאותו פרויקט','סימון משימה קריטית','סינון, מיון ותצוגות שמורות','תיוג משתמש ב-@ ופתיחת הקישור מההודעה'], notes:['משימה שהושלמה מפסיקה לצבור ימי איחור.'] },
  { area:'לוח גאנט', keywords:['גאנט','ציר זמן','נתיב קריטי','גרירה'], purpose:'הצגה חזותית של לוחות הזמנים וקשרי התלות ברמת פרויקט או כלל הפורטפוליו.', actions:['מעבר יום, שבוע וחודש וחזרה להיום','שינוי קנה מידה בכפתורי ‎+/-‎ או צביטה','גרירת משימה לעדכון תאריכים','מתיחת קצוות לשינוי משך','לחיצה לפתיחת משימה וריחוף להצגת פרטים','לחיצה ארוכה לשינוי תאריך, משך, צבע, קריטיות ותיוג'], notes:['משימה קריטית תמיד מוצגת באדום; קווי החיבור מציגים תלות בין משימות.'] },
  { area:'בקרת ביצוע', keywords:['בריאות','Baseline','בקשת שינוי','אוטומציה','תבנית'], purpose:'כלי שליטה ניהוליים להשוואת תכנון מול ביצוע ולניהול שינוי מבוקר.', actions:['שמירת Baseline של התכנון המאושר','פתיחת בקשת שינוי עם השפעת זמן וכסף','אישור או דחיית שינוי','יצירת תבניות פרויקט','הפעלת אוטומציות מתועדות'], permissions:'פעולות אישור וניהול זמינות למנהל או למנהל מערכת בהתאם לפעולה.' },
  { area:'דוחות וניתוחים', keywords:['דוח','PDF','מצגת','סטטיסטיקה','גרף','AI'], purpose:'ניתוח נתונים והפקת תוצרים ללקוח או לישיבת ניהול.', actions:['צפייה בגרפים דינמיים','אשף בחירת תוכן לדוח PDF','הפקת מצגת ניהול','יצירת טיוטת דוח בעזרת AI','שמירת דוח במסמכי הפרויקט','מעקב אחר כמות שאלות ועלות AI משוערת'], notes:['לפני הפקה אפשר לבחור פרויקט, פרקים ויעד שמירה.'] },
  { area:'הודעות', keywords:['הודעה','תגובה','תיוג','@','צליל'], purpose:'תקשורת פנימית בין משתמשי המערכת עם הקשר לישות שממנה נשלחה ההודעה.', actions:['שליחה ותגובה','תיוג משתמש ב-@','פתיחת הקישור למשימה או לפרויקט המקור','סימון ומחיקה מרוכזת','הפעלת או ביטול צליל אישי'] },
  { area:'הגדרות ומערכת', access:'admin', keywords:['הגדרות','חברה','לוגו','משתמש','הרשאות','Audit','גיבוי','דמו','AI'], purpose:'ניהול זהות החברה, אבטחה, תשתיות והעדפות מערכת.', tabs:{'פרטי חברה':'שם, לוגו ופרטי קשר המופיעים בממשק ובדוחות','משתמשים והרשאות':'חשבונות, תפקידים, חיבור זהויות Ingress/Web, נוכחות ואווטרים','Audit Log':'כניסות, יציאות ושינויים שביצעו משתמשים','מראה':'ערכת נושא אישית לכל משתמש','סוכן AI':'ספק, מודל, מפתח, תקציב ובדיקת חיבור','אחסון ו-NAS':'תיקייה משותפת ומדיניות מסמכים','גיבוי ושחזור':'גיבוי אוטומטי, ייצוא וייבוא','נתוני דמו':'הפעלה או ניקוי נתוני דוגמה לפני הזנת מידע אמיתי'}, permissions:'מיועד למנהל מערכת; מפתחות וסיסמאות לעולם אינם נמסרים לצ׳אט.' },
];

function selectHelpGuide(question, isAdmin, broad) {
  const visible = PRODUCT_HELP_GUIDE.filter((item)=>!item.access || isAdmin);
  if (broad) return visible;
  const normalized = String(question || '').toLocaleLowerCase('he-IL');
  const matches = visible.filter((item)=>[item.area,...(item.keywords || [])].some((term)=>normalized.includes(String(term).toLocaleLowerCase('he-IL'))));
  return matches.length ? matches : visible;
}

const topicPatterns = {
  documents:/מסמ|קובץ|קבצים|תמונה|תמונות|וידאו|pdf|media|document|file/i,
  forms:/טופס|טפסים|ביקורת|פיקוח|פגישה|ישיבה|form|inspection|meeting/i,
  time:/שעות|דיווח זמן|תכנון|תכנות|התקנה|פיקוח|technician|hours|time/i,
  calendar:/לוח שנה|אירוע|outlook|calendar|event/i,
  messages:/הודע|תיוג|תגובה|message|mention/i,
  governance:/baseline|בייסליין|בקשת שינוי|אוטומציה|תבנית פרויקט|change request|automation|template/i,
  users:/משתמש|הרשאה|התחבר|התנתק|אווטר|user|permission|login/i,
  settings:/הגדר|חברה|לוגו|nas|גיבוי|מפה|כתובת|דמו|setting|backup|storage/i,
  audit:/audit|יומן פעולות|מי שינה|מה השתנה|שינויים אחרונים|פעילות משתמש/i,
};

const wants = (question, topic) => topicPatterns[topic].test(String(question || ''));
const isBroadQuestion = (question) => /הכול|הכל|כל המערכת|כל המסכים|מה יש במערכת|מה המערכת כוללת|everything|entire system|capabilit/i.test(String(question || ''));

async function safeQuery(pool, sql, parameters = []) {
  try { return (await pool.query(sql, parameters)).rows; }
  catch (error) {
    console.warn('AI knowledge query skipped', error.message);
    return [];
  }
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[
    key,
    /(password|secret|token|api.?key|credential|authorization|cookie)/i.test(key) ? '[מוסתר]' : redactSecrets(item),
  ]));
}

function sanitizeSettings(rows, canViewFinance = true) {
  return rows.map((row) => {
    if (row.key !== 'ai') return { ...row,value:redactSecrets(row.value) };
    const value = redactSecrets(row.value || {});
    return { ...row, value:{ activeProvider:value.activeProvider,...(canViewFinance ? { monthlyBudgetUsd:value.monthlyBudgetUsd } : {}),readOnly:true } };
  });
}

function normalizeColumns(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed=JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* PostgreSQL array text is handled below. */ }
  if (value.startsWith('{') && value.endsWith('}')) return value.slice(1,-1).split(',').map((item)=>item.replace(/^"|"$/g,'').trim()).filter(Boolean);
  return [];
}

export async function buildLiveSystemKnowledge(pool, question, user = { role:'admin',id:null }) {
  const isAdmin = user?.role === 'admin';
  const canViewFinance = user?.financeAccess !== false;
  const broad = isBroadQuestion(question);
  const helpOrMeta = broad || /איך|איפה|עזרה|מדריך|אפשר|יכולת|מסך|תפריט|טאב|פעולה|מה.*(עושה|המטרה)|הסבר|help|how|where/i.test(String(question || ''));
  const [inventory, recentChanges, users] = await Promise.all([
    safeQuery(pool, `SELECT relname table_name,n_live_tup::bigint approximate_records
      FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY relname`),
    isAdmin
      ? safeQuery(pool, `SELECT a.action,a.entity_type,a.entity_id,a.details,a.created_at,
          COALESCE(u.display_name,u.username,'מערכת') user_name
          FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 30`)
      : user?.id
        ? safeQuery(pool, `SELECT a.action,a.entity_type,a.entity_id,a.details,a.created_at
            FROM audit_log a WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 15`,[user.id])
        : Promise.resolve([]),
    isAdmin
      ? safeQuery(pool, `SELECT id,username,display_name,role,active,must_change_password,last_login_at,last_seen_at,created_at,updated_at
          FROM users ORDER BY active DESC,display_name,username LIMIT 100`)
      : user?.id
        ? safeQuery(pool, `SELECT id,username,display_name,role,active,last_login_at,last_seen_at FROM users WHERE id=$1`,[user.id])
        : Promise.resolve([]),
  ]);

  const visibleInventory = inventory.filter((item) => !SENSITIVE_TABLES.has(item.table_name) && (canViewFinance || !FINANCE_TABLES.has(item.table_name)));
  const safeRecentChanges = canViewFinance
    ? recentChanges
    : recentChanges.filter((item)=>!containsFinanceText(item)).map(stripFinanceKnowledge);
  const knowledge = {
    generatedAt:new Date().toISOString(),
    freshness:'נבנה מחדש מבסיס הנתונים בזמן השאלה',
    currentUser:{ id:user?.id || null,displayName:user?.displayName || '',role:user?.role || 'user' },
    capabilities:canViewFinance
      ? PRODUCT_CAPABILITIES.filter((item)=>!item.access || isAdmin)
      : stripFinanceKnowledge(PRODUCT_CAPABILITIES.filter((item)=>!item.access || isAdmin).filter((item)=>!containsFinanceText(item.area))),
    dataInventory:visibleInventory,
    recentChanges:safeRecentChanges.map((item)=>({ ...item,details:redactSecrets(item.details) })),
    users,
  };

  if (helpOrMeta) knowledge.helpGuide = canViewFinance
    ? selectHelpGuide(question,isAdmin,broad)
    : stripFinanceKnowledge(selectHelpGuide(question,isAdmin,broad).filter((item)=>!containsFinanceText(item.area)));

  if (helpOrMeta && isAdmin) {
    const schema = await safeQuery(pool, `SELECT table_name,json_agg(column_name ORDER BY ordinal_position) columns
      FROM information_schema.columns WHERE table_schema='public'
      GROUP BY table_name ORDER BY table_name`);
    knowledge.liveSchema = schema.filter((item)=>!SENSITIVE_TABLES.has(item.table_name) && (canViewFinance || !FINANCE_TABLES.has(item.table_name)))
      .map((item)=>({ ...item,columns:normalizeColumns(item.columns).filter((column)=>!/(password|secret|token|api_key)/i.test(column) && (canViewFinance || !FINANCE_KEY.test(column))) }));
  }

  if (isAdmin && (broad || wants(question,'settings'))) {
    knowledge.settings = sanitizeSettings(await safeQuery(pool, 'SELECT key,value,updated_at FROM app_settings ORDER BY key'),canViewFinance);
  }
  if (broad || wants(question,'documents')) {
    knowledge.documents = await safeQuery(pool, `SELECT f.title,f.original_name,f.mime_type,f.category,f.size_bytes,f.version,f.created_at,
      c.name client_name,p.name project_name,COALESCE(u.display_name,u.username,'מערכת') uploaded_by
      FROM client_files f LEFT JOIN clients c ON c.id=f.client_id LEFT JOIN projects p ON p.id=f.project_id
      LEFT JOIN users u ON u.id=f.uploaded_by WHERE f.deleted_at IS NULL ORDER BY f.created_at DESC LIMIT 40`);
  }
  if (broad || wants(question,'forms')) {
    knowledge.formsAndFieldWork = {
      templates:await safeQuery(pool, 'SELECT name,description,active,version,updated_at FROM form_templates ORDER BY updated_at DESC LIMIT 30'),
      records:await safeQuery(pool, `SELECT r.title,r.status,r.scheduled_for,r.activity_type,r.work_hours,r.updated_at,
        t.name template_name,p.name project_name FROM form_records r JOIN form_templates t ON t.id=r.template_id
        LEFT JOIN projects p ON p.id=r.project_id ORDER BY r.updated_at DESC LIMIT 30`),
      siteReviews:await safeQuery(pool, `SELECT r.review_date,r.supervision_type,r.summary,r.follow_up,r.plan_update_required,r.created_at,p.name project_name
        FROM project_site_reviews r LEFT JOIN projects p ON p.id=r.project_id ORDER BY r.review_date DESC LIMIT 25`),
      meetings:await safeQuery(pool, `SELECT m.meeting_at,m.attendees,m.summary,m.follow_up,m.created_at,p.name project_name
        FROM project_meeting_summaries m LEFT JOIN projects p ON p.id=m.project_id ORDER BY m.meeting_at DESC LIMIT 25`),
    };
  }
  if (broad || wants(question,'time')) {
    knowledge.timeTracking = await safeQuery(pool, `SELECT e.activity_type,e.work_date,e.hours,e.notes,p.name project_name,
      COALESCE(pr.display_name,u.display_name,'לא הוקצה') reported_for
      FROM project_time_entries e LEFT JOIN projects p ON p.id=e.project_id
      LEFT JOIN professionals pr ON pr.id=e.professional_id LEFT JOIN users u ON u.id=e.user_id
      ORDER BY e.work_date DESC,e.created_at DESC LIMIT 50`);
  }
  if (broad || wants(question,'calendar')) {
    knowledge.calendar = await safeQuery(pool, `SELECT h.title,h.source_type,h.status,h.event_at,h.event_end,p.name project_name
      FROM calendar_history h LEFT JOIN projects p ON p.id=h.project_id
      WHERE h.status<>'deleted' ORDER BY h.event_at DESC LIMIT 40`);
  }
  if (broad || wants(question,'messages')) {
    const messages = user?.id ? await safeQuery(pool, `SELECT m.subject,m.body,m.read_at,m.created_at,
      sender.display_name sender_name,recipient.display_name recipient_name
      FROM user_messages m LEFT JOIN users sender ON sender.id=m.sender_id LEFT JOIN users recipient ON recipient.id=m.recipient_id
       WHERE m.sender_id=$1 OR m.recipient_id=$1 ORDER BY m.created_at DESC LIMIT 30`,[user.id]) : [];
    knowledge.messages = canViewFinance ? messages : messages.filter((item)=>!containsFinanceText(item));
  }
  if (broad || wants(question,'governance')) {
    knowledge.governance = {
      templates:await safeQuery(pool, 'SELECT name,description,classification,active,updated_at FROM project_templates ORDER BY updated_at DESC LIMIT 25'),
      automations:await safeQuery(pool, `SELECT r.name,r.trigger_type,r.trigger_types,r.active,r.updated_at,
        (SELECT MAX(ar.created_at) FROM automation_runs ar WHERE ar.rule_id=r.id) last_run_at
        FROM automation_rules r ORDER BY r.updated_at DESC LIMIT 25`),
      baselines:await safeQuery(pool, `SELECT b.label,b.created_at,p.name project_name FROM project_baselines b
        LEFT JOIN projects p ON p.id=b.project_id ORDER BY b.created_at DESC LIMIT 25`),
      changes:await safeQuery(pool, canViewFinance
        ? `SELECT c.title,c.status,c.price_impact,c.schedule_impact_days,c.updated_at,p.name project_name FROM project_change_requests c LEFT JOIN projects p ON p.id=c.project_id ORDER BY c.updated_at DESC LIMIT 30`
        : `SELECT c.title,c.status,c.schedule_impact_days,c.updated_at,p.name project_name FROM project_change_requests c LEFT JOIN projects p ON p.id=c.project_id ORDER BY c.updated_at DESC LIMIT 30`),
    };
  }
  return knowledge;
}
