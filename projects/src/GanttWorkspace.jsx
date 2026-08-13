import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { GanttTimeline } from "./GanttTimeline";
import { TaskEditor } from "./Workspaces";

const midnight = (value) => new Date(value).setHours(0, 0, 0, 0);

export function GanttWorkspace({ api, setNotice, user, projects, professionals }) {
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState(null);
  const load = () => Promise.all([
    api("/operations/tasks?q=&status="),
    api("/operations/milestones?projectId="),
  ]).then(([taskResult, milestoneResult]) => {
    setTasks(taskResult.tasks);
    setMilestones(milestoneResult.milestones);
  }).catch((error) => setNotice(error.message));
  useEffect(() => {
    load();
    const live = () => load();
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, []);
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
    return [...map.entries()]
      .map(([name, items]) => [name, items.sort((a, b) => midnight(a.start) - midnight(b.start))])
      .filter(([name, items]) => !query || `${name} ${items.map((item) => item.title).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  }, [tasks, milestones, query]);
  const save = async (value) => {
    try {
      const base = editor.kind === "task" ? "/operations/tasks" : "/operations/milestones";
      await api(`${base}/${editor.item.id}`, { method: "PATCH", body: JSON.stringify(value) });
      setEditor(null);
      setNotice("המשימה נשמרה בהצלחה");
      load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  return (
    <div className="ops-page global-gantt-page">
      <section className="ops-hero gantt-hero">
        <div><span className="ops-eyebrow"><CalendarDays size={15} />תכנון רוחבי</span><h2>לוח גאנט לכל הפרויקטים</h2><p>משימות, אבני דרך, תלות ונתיב קריטי בתצוגה מסחרית אחידה.</p></div>
        <div className="gantt-summary"><b>{groups.length}</b><span>פרויקטים</span><b>{tasks.filter((item) => item.critical).length}</b><span>משימות קריטיות</span></div>
      </section>
      <GanttTimeline groups={groups} query={query} onQueryChange={setQuery} onOpen={(item) => setEditor({ kind: item.kind, item })} title="תכנון כלל הפרויקטים" />
      {editor && <TaskEditor kind={editor.kind} initial={editor.item} projects={projects} professionals={professionals} tasks={tasks} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  );
}
