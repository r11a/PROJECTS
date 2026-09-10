const blank = value => !String(value ?? '').trim();

// Deterministic, read-only checks: no provider call and no inferred product facts.
export function buildProjectCheck(project, tasks, equipment, generatedAt = new Date().toISOString()) {
  const findings = [];
  const add = (key, severity, title, suggestion, tab, rows) => {
    if (rows.length) findings.push({ key, severity, title, suggestion, tab, count: rows.length,
      items: rows.slice(0, 30).map(row => ({ id: row.id, label: row.title || row.name || String(row.id), detail: row.detail || row.tag || row.location || '' })) });
  };
  const open = tasks.filter(t => !['done', 'cancelled'].includes(t.status));
  add('overdue', 'danger', 'משימות באיחור', 'בדקו מה מעכב את הביצוע ועדכנו יעד ואחראי בהתאם למצב בפועל.', 'tasks', open.filter(t => t.overdue));
  add('unassigned', 'warning', 'משימות ללא אחראי', 'שייכו משתמש או איש מקצוע לכל משימה פתוחה.', 'tasks', open.filter(t => !t.assignee_id && !t.assignee_professional_id));
  add('specification', 'warning', 'פרטי ציוד חסרים', 'השלימו יצרן ודגם מדויקים לפני חיפוש מידות או מפרטי יצרן.', 'systems', equipment.filter(e => blank(e.manufacturer) || blank(e.model)));
  add('remaining', 'info', 'ציוד שנותר להתקנה', 'ודאו שהציוד זמין ותכננו את ההתקנה; פער בכמות אינו בהכרח איחור.', 'systems', equipment.filter(e => Number(e.quantity_ordered ?? e.quantity) > Number(e.quantity_installed || 0)).map(e => ({ ...e, detail: `נותרו ${Number(e.quantity_ordered ?? e.quantity) - Number(e.quantity_installed || 0)} להתקנה${e.location ? ` · ${e.location}` : ''}` })));
  add('quantity', 'warning', 'כמויות התקנה לבדיקה', 'בדקו את הכמות הנדרשת והמותקנת לפני תיקון הרשומה.', 'systems', equipment.filter(e => Number(e.quantity_installed || 0) > Number(e.quantity_ordered ?? e.quantity) || Number(e.quantity_installed || 0) < 0 || Number(e.quantity_ordered ?? e.quantity) < 0));
  const tags = new Map();
  for (const item of equipment) {
    const tag = String(item.tag || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (tag) tags.set(tag, [...(tags.get(tag) || []), item]);
  }
  add('duplicates', 'warning', 'מזהי ציוד חוזרים לבדיקה', 'השוו מיקום ומזהה: ייתכן שהחזרה מכוונת. אין למחוק רכיבים רק בגלל שם או דגם זהים.', 'systems', [...tags.values()].filter(items => items.length > 1).flat());
  return { project, generatedAt, findings, checked: { tasks: tasks.length, equipment: equipment.length },
    truncated: tasks.length > 1000 || equipment.length > 1000,
    scope: 'בדיקת נתוני משימות וציוד בלבד; אינה בדיקת תקינות שרת, גיבויים או קבצים. לא בוצעו שינויים ולא נצרכו טוקנים.' };
}

export async function loadProjectCheck(pool, projectId) {
  const project = (await pool.query('SELECT id,name FROM projects WHERE id=$1', [projectId])).rows[0];
  if (!project) return null;
  const [tasks, equipment] = await Promise.all([
    pool.query(`SELECT id,title,status,assignee_id,assignee_professional_id,(due_date<CURRENT_DATE) overdue FROM tasks WHERE project_id=$1 ORDER BY due_date NULLS LAST,id LIMIT 1001`, [projectId]),
    pool.query(`SELECT pe.id,pe.tag,pe.location,pe.quantity,pe.quantity_ordered,pe.quantity_installed,c.name,c.manufacturer,c.model FROM project_equipment pe JOIN equipment_catalog c ON c.id=pe.catalog_item_id WHERE pe.project_id=$1 ORDER BY pe.id LIMIT 1001`, [projectId]),
  ]);
  return buildProjectCheck(project, tasks.rows, equipment.rows);
}
