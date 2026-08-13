export async function buildOperationalInsights({ pool, user }) {
  const [taskStats, collection, risks, alerts, recent, stages, workload] = await Promise.all([
    pool.query(`SELECT COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled') AND due_date<CURRENT_DATE)::int overdue,
                       COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7)::int due_soon,
                       COUNT(*) FILTER (WHERE status NOT IN ('done','cancelled'))::int open,
                       COUNT(*) FILTER (WHERE status='done' AND completed_at>=NOW()-INTERVAL '7 days')::int completed_week FROM tasks`),
    pool.query(`SELECT COALESCE(SUM(value-paid),0)::numeric outstanding,COUNT(*) FILTER (WHERE paid<value)::int open_projects FROM projects WHERE archived_at IS NULL`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE health<70)::int health_risks,COUNT(*) FILTER (WHERE flag<>'')::int flagged,
                       COUNT(*)::int total_projects,COALESCE(ROUND(AVG(progress)),0)::int average_progress
                FROM projects WHERE archived_at IS NULL`),
    pool.query(`SELECT t.id,t.title,t.due_date,t.priority,t.project_id,p.name project_name,c.name client_name,c.id client_id
                FROM tasks t LEFT JOIN clients c ON c.id=t.client_id
                LEFT JOIN projects p ON p.id=t.project_id
                LEFT JOIN user_alert_snoozes s ON s.user_id=$1 AND s.alert_key='task:'||t.id
                LEFT JOIN user_alert_dismissals d ON d.user_id=$1 AND d.alert_key='task:'||t.id
                WHERE t.status NOT IN ('done','cancelled') AND t.due_date<CURRENT_DATE
                  AND (s.snoozed_until IS NULL OR s.snoozed_until<=NOW()) AND d.alert_key IS NULL
                  AND ($2='admin' OR t.assignee_id=$1 OR EXISTS(SELECT 1 FROM professionals pr WHERE pr.id=t.assignee_professional_id AND pr.affiliation='company' AND pr.linked_user_id=$1)
                    OR EXISTS(SELECT 1 FROM project_professionals pp JOIN professionals pr ON pr.id=pp.professional_id WHERE pp.project_id=t.project_id AND pr.affiliation='company' AND pr.linked_user_id=$1))
                ORDER BY t.due_date,t.priority DESC LIMIT 25`, [user.id,user.role]),
    pool.query(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.created_at,COALESCE(u.display_name,u.username,'מערכת') user_name
                FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 8`),
    pool.query(`SELECT stage,COUNT(*)::int count FROM projects WHERE archived_at IS NULL GROUP BY stage ORDER BY count DESC`),
    pool.query(`SELECT COALESCE(NULLIF(manager,''),'לא הוקצה') manager,COUNT(*)::int projects,
                       COALESCE(ROUND(AVG(progress)),0)::int average_progress
                FROM projects WHERE archived_at IS NULL GROUP BY COALESCE(NULLIF(manager,''),'לא הוקצה') ORDER BY projects DESC LIMIT 8`),
  ]);
  const stats = {
    ...taskStats.rows[0],
    outstanding:Number(collection.rows[0].outstanding),
    openProjects:collection.rows[0].open_projects,
    ...risks.rows[0],
  };
  const suggestions = [];
  if (stats.overdue) suggestions.push({ tone:'danger', title:`${stats.overdue} משימות באיחור`, text:'נדרשת הקצאה מחדש או עדכון יעד', target:'tasks' });
  if (stats.due_soon) suggestions.push({ tone:'warning', title:`${stats.due_soon} משימות לשבוע הקרוב`, text:'כדאי לוודא משאבים וחומרים', target:'calendar' });
  if (stats.health_risks) suggestions.push({ tone:'danger', title:`${stats.health_risks} פרויקטים בסיכון`, text:'מדד הבריאות נמוך מ־70', target:'projects' });
  if (stats.outstanding) suggestions.push({ tone:'info', title:`₪${Math.round(stats.outstanding).toLocaleString('he-IL')} לגבייה`, text:`${stats.openProjects} פרויקטים עם יתרה פתוחה`, target:'finance' });
  if (!suggestions.length) suggestions.push({ tone:'success', title:'המערכת מאוזנת', text:'אין כרגע חריגות הדורשות טיפול', target:'dashboard' });
  return {
    stats,
    suggestions,
    alerts:alerts.rows.map((row)=>({ key:`task:${row.id}`, taskId:row.id, projectId:row.project_id, projectName:row.project_name, title:row.title, dueDate:row.due_date, priority:row.priority, clientName:row.client_name, clientId:row.client_id })),
    recentActivities:recent.rows.map((row)=>({ id:row.id, action:row.action, entityType:row.entity_type, entityId:row.entity_id, userName:row.user_name, createdAt:row.created_at })),
    analysisContext:{ stages:stages.rows, workload:workload.rows },
  };
}
