import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, Search, ZoomIn } from "lucide-react";

const day = 86400000;
const date = (value) => new Date(value).toLocaleDateString("he-IL", { day: "numeric", month: "short" });
const colors = ["#7057df", "#1596c4", "#e3a313", "#2e9c72", "#d15f83", "#4e7fd7"];
const atMidnight = (value) => new Date(value).setHours(0, 0, 0, 0);

function ProjectGroup({ name, items, color, collapsed, onToggle, min, max, groupIndex }) {
  const position = (value) => ((atMidnight(value) - min) / (max - min)) * 100;
  const dependencies = items.flatMap((item, targetIndex) => {
    if (item.kind !== "task" || !item.dependency_task_id) return [];
    const sourceIndex = items.findIndex((candidate) => candidate.kind === "task" && String(candidate.id) === String(item.dependency_task_id));
    if (sourceIndex < 0) return [];
    const source = items[sourceIndex];
    const sourceX = Math.max(0, Math.min(100, position(source.end)));
    const targetX = Math.max(0, Math.min(100, position(item.start)));
    const sourceY = sourceIndex * 57 + 28;
    const targetY = targetIndex * 57 + 28;
    const bendX = Math.max(sourceX + 1.5, (sourceX + targetX) / 2);
    return [{ id: `${source.id}-${item.id}`, d: `M ${sourceX} ${sourceY} C ${bendX} ${sourceY}, ${bendX} ${targetY}, ${targetX} ${targetY}` }];
  });
  const markerId = `portfolio-arrow-${groupIndex}`;

  return (
    <section className="gantt-project-group">
      <button className="gantt-project-title" onClick={onToggle}>
        <span style={{ background: color }} />
        <strong>{name}</strong>
        <em>{items.length}</em>
        {collapsed ? <ChevronLeft /> : <ChevronDown />}
      </button>
      {!collapsed && (
        <div className="gantt-project-items">
          {dependencies.length > 0 && (
            <svg className="global-gantt-dependencies" viewBox={`0 0 100 ${items.length * 57}`} preserveAspectRatio="none" aria-label="קווי תלות בין משימות">
              <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
              {dependencies.map((line) => <path key={line.id} d={line.d} markerEnd={`url(#${markerId})`} />)}
            </svg>
          )}
          {items.map((item) => {
            const start = position(item.start);
            const width = Math.max(0.7, ((atMidnight(item.end) - atMidnight(item.start) + day) / (max - min)) * 100);
            return (
              <article key={`${item.kind}-${item.id}`} className={item.critical ? "critical" : ""}>
                <div>
                  <span className="gantt-person" style={{ background: item.assignee_color || color }}>{(item.assignee_name || item.owner_name || "?").slice(0, 2)}</span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.assignee_name || item.owner_name || "לא הוקצה"} · {date(item.start)}–{date(item.end)}</small>
                    {item.dependency_title && <em className="global-dependency-label">↳ תלויה ב: {item.dependency_title}</em>}
                  </span>
                </div>
                <div className="global-gantt-track">
                  <i className={`${item.kind} ${item.critical ? "critical" : ""}`} style={{ "--left": `${start}%`, "--width": `${width}%`, "--color": item.critical ? "#dc3545" : color }} title={`${item.title} · ${date(item.start)}–${date(item.end)}`}>
                    <span>{item.critical ? "משימה קריטית" : item.title}</span>
                  </i>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function GanttWorkspace({ api, setNotice }) {
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState("week");
  const [collapsed, setCollapsed] = useState(new Set());
  const load = () => Promise.all([api("/operations/tasks?q=&status="), api("/operations/milestones?projectId=")]).then(([a, b]) => { setTasks(a.tasks); setMilestones(b.milestones); }).catch((error) => setNotice(error.message));
  useEffect(() => { load(); const live = () => load(); window.addEventListener("projects:live-change", live); return () => window.removeEventListener("projects:live-change", live); }, []);
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of tasks) {
      if (!item.start_date || !item.due_date) continue;
      const name = item.project_name || "ללא פרויקט";
      if (!map.has(name)) map.set(name, []);
      map.get(name).push({ ...item, kind: "task", start: item.start_date, end: item.due_date });
    }
    for (const item of milestones) {
      if (!item.due_date) continue;
      const name = item.project_name || "ללא פרויקט";
      if (!map.has(name)) map.set(name, []);
      map.get(name).push({ ...item, kind: "milestone", start: item.due_date, end: item.due_date });
    }
    return [...map.entries()].map(([name, items]) => [name, items.sort((a, b) => atMidnight(a.start) - atMidnight(b.start))]).filter(([name, items]) => !query || `${name} ${items.map((item) => item.title).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  }, [tasks, milestones, query]);
  const all = groups.flatMap(([, items]) => items);
  const today = new Date().setHours(0, 0, 0, 0);
  const min = Math.min(today, ...all.map((item) => atMidnight(item.start))) - 3 * day;
  const max = Math.max(today + 14 * day, ...all.map((item) => atMidnight(item.end))) + 3 * day;
  const total = Math.max(1, (max - min) / day);
  const tick = zoom === "day" ? 1 : zoom === "week" ? 7 : 30;
  const ticks = Array.from({ length: Math.ceil(total / tick) + 1 }, (_, index) => min + index * tick * day).filter((value) => value <= max);
  const toggle = (name) => setCollapsed((current) => { const next = new Set(current); next.has(name) ? next.delete(name) : next.add(name); return next; });

  return (
    <div className="ops-page global-gantt-page">
      <section className="ops-hero gantt-hero"><div><span className="ops-eyebrow"><CalendarDays size={15} />תכנון רוחבי</span><h2>לוח גאנט לכל הפרויקטים</h2><p>משימות, אבני דרך, תלות ונתיב קריטי בתמונה אחת ברורה.</p></div><div className="gantt-summary"><b>{groups.length}</b><span>פרויקטים</span><b>{tasks.filter((item) => item.critical).length}</b><span>משימות קריטיות</span></div></section>
      <div className="global-gantt-toolbar panel"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש פרויקט או משימה" /></label><div><ZoomIn size={16} />{[["day", "יום"], ["week", "שבוע"], ["month", "חודש"]].map(([id, label]) => <button className={zoom === id ? "active" : ""} onClick={() => setZoom(id)} key={id}>{label}</button>)}</div><span><i /> היום</span><span className="critical-key"><i /> נתיב קריטי</span></div>
      <section className="global-gantt panel" style={{ "--columns": ticks.length }}><header><div>פרויקט / משימה</div><div>{ticks.map((value) => <span key={value}>{date(value)}</span>)}</div></header><div className="global-gantt-body"><div className="today-line" style={{ "--today": `${((today - min) / (max - min)) * 100}%` }} />{groups.map(([name, items], groupIndex) => <ProjectGroup key={name} name={name} items={items} color={colors[groupIndex % colors.length]} collapsed={collapsed.has(name)} onToggle={() => toggle(name)} min={min} max={max} groupIndex={groupIndex} />)}</div></section>
    </div>
  );
}
