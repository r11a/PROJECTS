import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Flag,
  FolderKanban,
  ListFilter,
  ListChecks,
  Plus,
  Presentation,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppModal } from "./AppModal";
import { createMilestoneDraft, createTaskDraft } from "./features/tasks/taskDefaults";

const money = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const dateText = (value) =>
  value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(
        "he-IL",
      )
    : "ללא תאריך";
const dueText=(value)=>{if(!value)return "ללא תאריך";const today=new Date();today.setHours(0,0,0,0);const due=new Date(`${String(value).slice(0,10)}T00:00:00`);const days=Math.round((due-today)/86400000);return days===0?"לביצוע היום":days===1?"לביצוע מחר":days>1?`לביצוע בעוד ${days} ימים`:`באיחור של ${Math.abs(days)} ימים`};
const taskStatus = {
  open: "פתוחה",
  in_progress: "בביצוע",
  done: "הושלמה",
  cancelled: "בוטלה",
};
const taskPriority = {
  urgent: "דחופה",
  high: "גבוהה",
  normal: "רגילה",
  low: "נמוכה",
};
const taskPriorityRank = { urgent: 4, high: 3, normal: 2, low: 1 };
const milestoneStatus = {
  planned: "מתוכננת",
  in_progress: "בתהליך",
  completed: "הושלמה",
  delayed: "באיחור",
};
const paymentStatus = { pending: "ממתין", paid: "שולם", cancelled: "בוטל" };
const paymentEntryTypes = { invoice:"דרישת תשלום", addition:"תוספת לפרויקט", credit:"זיכוי לפרויקט" };
const stageNames = {
  waiting: "בהמתנה",
  mobilization: "בהנעה",
  planning: "תכנון",
  infrastructure: "תשתיות",
  threading: "השחלות",
  threading_done: "בוצעו השחלות",
  installation_a: "התקנות שלב א׳",
  installation_b: "התקנות שלב ב׳",
  installation_c: "התקנות שלב ג׳",
  activation_programming: "הפעלות ותכנות",
  finishes: "פינישים",
  post_delivery: "מוכן למסירה",
  installation: "התקנה",
  programming: "תכנות",
  handover: "לקראת מסירה",
  completed: "הושלם",
};
const contractorStageNames = { waiting:"בהמתנה",infrastructure:"סלילת תשתיות",drywall_paint:"עבודות גבס וצבע",carpentry:"הרכבות נגרות",finishing:"עבודות גמר",stopped:"בעצירה" };
const projectSizeNames = { small:"קטן",medium:"בינוני",large:"גדול" };
const deadlineNames = { overdue:"באיחור",today:"היום",week:"7 ימים",later:"בהמשך",none:"ללא תאריך" };
let currentTaskOptions = [];

function EmptyState({ icon: Icon, title, text, action, onAction }) {
  return (
    <div className="work-empty">
      <span>
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="ops-primary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children, className = "" }) {
  return <AppModal title={title} subtitle={subtitle} onClose={onClose} className={className}>{children}</AppModal>;
}

function AiReportContent({ text }) {
  const normalized = String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "\n$1:\n")
    .replace(/(^|\s)#{1,4}\s*/g, "\n")
    .replace(/(^|\s)\d+[.)]\s+/g, "\n")
    .replace(/[•▪]/g, "\n")
    .replace(/\*\*/g, "");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^#{1,4}\s*/, "").replace(/^[-*•]\s*/, ""));
  if (!lines.length) return null;
  return (
    <div className="ai-report-copy">
      {lines.slice(0, 14).map((line, index) => {
        const heading = /[:：]$/.test(line) || /^(תקציר|חריגים|חסמים|החלטות|פעולות|סיכונים|המלצות)/.test(line);
        return heading
          ? <h3 key={`${line}-${index}`}>{line.replace(/[:：]$/, "")}</h3>
          : <p key={`${line}-${index}`}><i />{line}</p>;
      })}
    </div>
  );
}

export function TaskEditor({
  kind = "task",
  projects,
  professionals,
  tasks = currentTaskOptions,
  initial,
  onClose,
  onSave,
  fixedProjectId = "",
}) {
  const isMilestone = kind === "milestone";
  const [form, setForm] = useState(
    initial ||
      (isMilestone ? createMilestoneDraft() : createTaskDraft()),
  );
  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      projectId: form.projectId || initial?.project_id,
      startDate: form.startDate || initial?.start_date,
      dueDate: form.dueDate || initial?.due_date,
      assigneeProfessionalId: form.assigneeProfessionalId || null,
      ownerProfessionalId: form.ownerProfessionalId || null,
      parentTaskId: form.parentTaskId || null,
    });
  };
  return (
    <Modal
      title={isMilestone ? "אבן דרך" : "משימה"}
      subtitle={initial?.id ? "עריכה ועדכון" : "פריט תפעולי חדש"}
      onClose={onClose}
      className="task-editor-modal"
    >
      <form className="work-form" onSubmit={submit}>
        {!initial?.id && !fixedProjectId && (
          <label>
            פרויקט
            <select
              required
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">בחירת פרויקט</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.client}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="wide">
          כותרת
          <input
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={
              isMilestone
                ? "לדוגמה: אישור תוכניות לביצוע"
                : "תיאור קצר וברור של הפעולה"
            }
          />
        </label>
        {!isMilestone && (
          <label>
            תאריך התחלה
            <input
              required
              type="date"
              value={String(form.startDate || form.start_date || "").slice(
                0,
                10,
              )}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
        )}
        {!isMilestone && <label>
          שעת התחלה
          <input type="time" value={String(form.startTime || form.start_time || "").slice(0,5)} onChange={(e)=>setForm({...form,startTime:e.target.value})}/>
        </label>}
        <label>
          {isMilestone ? "תאריך יעד" : "תאריך סיום"}
          <input
            required
            type="date"
            min={
              !isMilestone
                ? String(form.startDate || form.start_date || "").slice(0, 10)
                : undefined
            }
            value={String(form.dueDate || form.due_date || "").slice(0, 10)}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </label>
        <label>
          סטטוס
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {Object.entries(isMilestone ? milestoneStatus : taskStatus).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {isMilestone ? "אחראי" : "אחראי למשימה"}
          <select
            value={
              form.ownerProfessionalId ||
              form.owner_professional_id ||
              (isMilestone ? "" : form.ownerProfessionalId || form.owner_professional_id) ||
              ""
            }
            onChange={(e) =>
              setForm({
                ...form,
                ownerProfessionalId: e.target.value,
              })
            }
          >
            <option value="">ללא אחראי</option>
            {professionals
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ·{" "}
                  {p.jobTitle || p.roles?.[0]?.name || "איש מקצוע"}
                </option>
              ))}
          </select>
        </label>
        {isMilestone ? (
          <label>
            התקדמות
            <input
              type="number"
              min="0"
              max="100"
              value={form.progress}
              onChange={(e) =>
                setForm({ ...form, progress: Number(e.target.value) })
              }
            />
          </label>
        ) : (
          <>
            <label>
              מבצע
              <select value={form.assigneeProfessionalId || form.assignee_professional_id || ""} onChange={(e) => setForm({ ...form, assigneeProfessionalId: e.target.value })}>
                <option value="">ללא מבצע</option>
                {professionals.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.displayName} · {p.jobTitle || p.roles?.[0]?.name || "איש מקצוע"}</option>)}
              </select>
            </label>
            <label>
              עדיפות
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">נמוכה</option>
                <option value="normal">רגילה</option>
                <option value="high">גבוהה</option>
                <option value="urgent">דחופה</option>
              </select>
            </label>
            <label className="check-label critical-task-toggle">
              <input type="checkbox" checked={Boolean(form.critical)} onChange={(e)=>setForm({...form,critical:e.target.checked})}/>
              משימה קריטית
            </label>
            <label>
              סוג
              <select
                value={form.taskType || form.task_type}
                onChange={(e) => setForm({ ...form, taskType: e.target.value })}
              >
                <option value="task">משימה</option>
                <option value="service">שירות</option>
                <option value="procurement">רכש</option>
                <option value="followup">מעקב</option>
              </select>
            </label>
            <label>
              שעות משוערות
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.durationHours ?? form.duration_hours ?? form.estimatedHours ?? form.estimated_hours ?? ""}
                onChange={(e) =>
                  setForm({ ...form, durationHours: e.target.value, estimatedHours: e.target.value })
                }
              />
            </label>
          </>
        )}
        {!isMilestone && (
          <>
          <label>
            תלויה במשימה
            <select
              value={form.dependencyTaskId || form.dependency_task_id || ""}
              onChange={(e) =>
                setForm({ ...form, dependencyTaskId: e.target.value || null })
              }
            >
              <option value="">ללא תלות</option>
              {tasks
                .filter(
                  (item) =>
                    item.id !== initial?.id &&
                    item.project_id === (form.projectId || initial?.project_id) &&
                    ["open","in_progress"].includes(item.status),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            תת־משימה של
            <select value={form.parentTaskId || form.parent_task_id || ""} onChange={(e) => setForm({ ...form, parentTaskId: e.target.value || null })}>
              <option value="">משימה ראשית</option>
              {tasks.filter((item) => item.id !== initial?.id && item.project_id === (form.projectId || initial?.project_id) && !item.parent_task_id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          </>
        )}
        <label className="wide">
          הנחיות והערות
          <textarea
            value={form.description || ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="מידע שיאפשר לאחראי לבצע בלי צורך בבירור נוסף"
          />
        </label>
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="ops-primary">
            {initial?.id ? "שמירת שינויים" : "יצירה"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function TasksWorkspace({
  api,
  user,
  projects,
  professionals,
  setNotice,
  projectId = "",
  onDataChanged,
  initialTaskId = "",
  onInitialTaskOpened,
}) {
  const [tab, setTab] = useState("tasks");
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [sortBy, setSortBy] = useState("due_asc");
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      setLoading(true);
      const suffix = projectId
        ? `&projectId=${encodeURIComponent(projectId)}`
        : "";
      const [a, b] = await Promise.all([
        api(
          `/operations/tasks?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}${suffix}`,
        ),
        api(
          `/operations/milestones?projectId=${encodeURIComponent(projectId)}`,
        ),
      ]);
      setTasks(a.tasks);
      setMilestones(b.milestones);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const timer = setTimeout(load, 150);
    return () => clearTimeout(timer);
  }, [query, status, projectId]);
  useEffect(() => {
    if (!initialTaskId || !tasks.length) return;
    const item = tasks.find((task) => String(task.id) === String(initialTaskId));
    if (!item) return;
    setTab("tasks");
    setEditor({ kind: "task", item });
    onInitialTaskOpened?.();
  }, [initialTaskId, tasks, onInitialTaskOpened]);
  useEffect(() => {
    const live = () => load();
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, [query, status, projectId]);
  const visibleTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const filtered = tasks.filter((item) => {
      const due = item.due_date
        ? new Date(`${String(item.due_date).slice(0, 10)}T00:00:00`)
        : null;
      if (priority && (item.priority || "normal") !== priority) return false;
      if (assigneeId && String(item.assignee_professional_id || "") !== assigneeId) return false;
      if (managerId && String(item.project_manager_id || "") !== managerId) return false;
      if (projectFilter && String(item.project_id || "") !== projectFilter) return false;
      if (dueFilter === "overdue" && (!due || due >= today || ["done", "cancelled"].includes(item.status))) return false;
      if (dueFilter === "today" && (!due || due.getTime() !== today.getTime())) return false;
      if (dueFilter === "week" && (!due || due < today || due > weekEnd)) return false;
      if (dueFilter === "unscheduled" && due) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sortBy === "priority") return (taskPriorityRank[b.priority] || 2) - (taskPriorityRank[a.priority] || 2);
      if (sortBy === "created_desc") return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === "project") return String(a.project_name || "").localeCompare(String(b.project_name || ""), "he");
      if (sortBy === "assignee") return String(a.assignee_name || "").localeCompare(String(b.assignee_name || ""), "he");
      const left = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return sortBy === "due_desc" ? right - left : left - right;
    });
  }, [tasks, priority, assigneeId, managerId, projectFilter, dueFilter, sortBy]);
  const items = tab === "tasks" ? visibleTasks : milestones;
  const activeFilterCount = [status, priority, assigneeId, managerId, projectFilter, dueFilter].filter(Boolean).length;
  const clearFilters = () => {
    setStatus("");
    setPriority("");
    setAssigneeId("");
    setManagerId("");
    setProjectFilter("");
    setDueFilter("");
  };
  const canEdit = ["admin", "manager", "technician"].includes(user.role);
  currentTaskOptions = tasks;
  const save = async (value) => {
    try {
      const kind = editor.kind;
      const base =
        kind === "task" ? "/operations/tasks" : "/operations/milestones";
      await api(editor.item?.id ? `${base}/${editor.item.id}` : base, {
        method: editor.item?.id ? "PATCH" : "POST",
        body: JSON.stringify(value),
      });
      setEditor(null);
      setNotice("הפריט נשמר בהצלחה");
      load();
      onDataChanged?.();
    } catch (e) {
      setNotice(e.message);
    }
  };
  const remove = async (item) => {
    if (!confirm(`למחוק את „${item.title}”?`)) return;
    try {
      await api(`/operations/${tab}/${item.id}`, { method: "DELETE" });
      setNotice("הפריט נמחק");
      load();
      onDataChanged?.();
    } catch (e) {
      setNotice(e.message);
    }
  };
  return (
    <div className={`ops-page work-page ${projectId ? "embedded-work" : ""}`}>
      <section className="ops-hero compact-work-hero">
        <div>
          <span className="ops-eyebrow">
            <ListChecks size={15} />
            ביצוע ובקרה
          </span>
          <h2>
            {projectId ? "משימות ואבני דרך בפרויקט" : "מרכז המשימות"}
          </h2>
          <p>
            שולחן עבודה אחד לתעדוף, הקצאה ובקרה — מהדחוף ביותר ועד לתכנון קדימה.
          </p>
        </div>
        <div className="work-stat-strip">
          <span>
            <b>
              {
                tasks.filter((t) => !["done", "cancelled"].includes(t.status))
                  .length
              }
            </b>
            פתוחות
          </span>
          <span>
            <b>
              {
                tasks.filter(
                  (t) =>
                    t.status !== "done" && new Date(t.due_date) < new Date(),
                ).length
              }
            </b>
            באיחור
          </span>
          <span>
            <b>{milestones.filter((m) => m.status !== "completed").length}</b>
            אבני דרך פעילות
          </span>
        </div>
      </section>
      <div className="work-toolbar">
        <nav>
          <button
            className={tab === "tasks" ? "active" : ""}
            onClick={() => setTab("tasks")}
          >
            משימות <em>{tasks.length}</em>
          </button>
          <button
            className={tab === "milestones" ? "active" : ""}
            onClick={() => setTab("milestones")}
          >
            אבני דרך <em>{milestones.length}</em>
          </button>
        </nav>
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי משימה, פרויקט או אחראי"
          />
        </label>
        {tab === "tasks" && (
          <div className="task-toolbar-actions">
            <label className="task-select" title="סינון לפי סטטוס">
              <ListFilter size={16} />
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="סטטוס">
                <option value="">כל הסטטוסים</option>
                {Object.entries(taskStatus).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="task-select" title="מיון משימות">
              <ArrowDownUp size={16} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="מיון משימות">
                <option value="due_asc">מועד קרוב</option>
                <option value="due_desc">מועד רחוק</option>
                <option value="priority">קדימות</option>
                <option value="project">פרויקט</option>
                <option value="assignee">אחראי</option>
                <option value="created_desc">חדשות תחילה</option>
              </select>
            </label>
          </div>
        )}
        {canEdit && (
          <button
            className="ops-primary"
            onClick={() =>
              setEditor({ kind: tab === "tasks" ? "task" : "milestone" })
            }
          >
            <Plus size={16} />
            {tab === "tasks" ? "משימה" : "אבן דרך"}
          </button>
        )}
      </div>
      {tab === "tasks" && (
        <section className="task-filter-bar" aria-label="סינון מתקדם למשימות">
          <div className="task-filter-heading"><ListFilter size={17}/><span>מיקוד מהיר</span>{activeFilterCount > 0 && <em>{activeFilterCount}</em>}</div>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="קדימות">
            <option value="">כל הקדימויות</option>
            {Object.entries(taskPriority).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} aria-label="מועד">
            <option value="">כל המועדים</option>
            <option value="overdue">באיחור</option>
            <option value="today">להיום</option>
            <option value="week">7 ימים קרובים</option>
            <option value="unscheduled">ללא תאריך</option>
          </select>
          {!projectId && <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="פרויקט">
            <option value="">כל הפרויקטים</option>
            {projects.map((project) => <option value={String(project.id)} key={project.id}>{project.name}</option>)}
          </select>}
          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} aria-label="אחראי למשימה">
            <option value="">כל האחראים</option>
            {professionals.filter((person) => person.active !== false).map((person) => <option value={String(person.id)} key={person.id}>{person.displayName || person.name}</option>)}
          </select>
          {!projectId && <select value={managerId} onChange={(event) => setManagerId(event.target.value)} aria-label="מנהל פרויקט">
            <option value="">כל מנהלי הפרויקט</option>
            {professionals.filter((person) => person.active !== false && ["project_manager", "מנהל פרויקט"].includes(person.role)).map((person) => <option value={String(person.id)} key={person.id}>{person.displayName || person.name}</option>)}
          </select>}
          {activeFilterCount > 0 && <button type="button" onClick={clearFilters}>ניקוי סינון</button>}
          <small>{visibleTasks.length} מתוך {tasks.length} משימות</small>
        </section>
      )}
      <div className="work-list panel">
        {tab === "tasks" && items.length > 0 && <div className="work-table-head"><span>משימה ופרויקט</span><span>קדימות</span><span>אחראי</span><span>מבצע</span><span>מנהל פרויקט</span><span>תאריך סיום</span><span/></div>}
        {loading ? (
          <div className="work-loading">טוען נתונים…</div>
        ) : !items.length ? (
          <EmptyState
            icon={tab === "tasks" ? ListChecks : Flag}
            title="אין פריטים בתצוגה"
            text="אפשר ליצור את הפריט הראשון או לשנות את הסינון."
            action={
              canEdit ? (tab === "tasks" ? "משימה חדשה" : "אבן דרך חדשה") : ""
            }
            onAction={() =>
              setEditor({ kind: tab === "tasks" ? "task" : "milestone" })
            }
          />
        ) : (
          items.map((item) => (
            <article
              className={`work-row ${tab === "tasks" ? "task-row" : "milestone-row"} ${item.status} ${item.critical ? "critical" : ""}`}
              key={item.id}
              onClick={() =>
                canEdit &&
                setEditor({
                  kind: tab === "tasks" ? "task" : "milestone",
                  item,
                })
              }
            >
              <span className="work-check">
                {["done", "completed"].includes(item.status) ? (
                  <CheckCircle2 />
                ) : (
                  <Clock3 />
                )}
              </span>
              <div className="work-main">
                <strong>{item.title}</strong>
                {item.critical && <b className="critical-task-label">משימה קריטית</b>}
                <span>
                  {item.project_name ||
                    projects.find((p) => p.id === item.project_id)?.name}{" "}
                  {item.description && `· ${item.description}`}
                </span>
                {tab === "tasks" && item.dependency_title && <small className="task-dependency">תלויה ב: {item.dependency_title}</small>}
                {tab === "tasks" && item.parent_task_title && <small className="task-parent">תת־משימה של: {item.parent_task_title}</small>}
                {tab === "tasks" && item.subtask_count > 0 && <small className="task-subtasks">{item.completed_subtask_count}/{item.subtask_count} תתי־משימות הושלמו</small>}
              </div>
              <span className={`work-priority ${item.priority || item.status}`}>
                {tab === "tasks"
                  ? taskPriority[item.priority || "normal"]
                  : milestoneStatus[item.status]}
              </span>
              <span className="work-owner">
                <UserRound size={15} />
                <span><small>{tab === "tasks" ? "אחראי" : "בעלים"}</small>{item.owner_name || "לא הוקצה"}</span>
              </span>
              {tab === "tasks" && <span className="work-assignee"><UserRound size={15}/><span><small>מבצע</small>{item.assignee_name || "לא הוקצה"}</span></span>}
              {tab === "tasks" && <span className="work-manager">
                <FolderKanban size={15}/>
                {item.project_manager_name || "לא הוקצה"}
              </span>}
              <span
                className={`work-date ${new Date(item.due_date) < new Date() && !["done", "completed"].includes(item.status) ? "late" : ""}`}
              >
                <CalendarDays size={15} />
                <span>{dateText(item.due_date)}{!["done","completed","cancelled"].includes(item.status)&&<small>{dueText(item.due_date)}</small>}</span>
              </span>
              {user.role === "admin" && (
                <button
                  className="work-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(item);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </article>
          ))
        )}
      </div>
      {editor && (
        <TaskEditor
          kind={editor.kind}
          projects={
            projectId ? projects.filter((p) => p.id === projectId) : projects
          }
          professionals={professionals}
          initial={
            editor.item
              ? {
                  ...editor.item,
                  projectId: editor.item.project_id,
                  startDate: String(
                    editor.item.start_date || editor.item.due_date || "",
                  ).slice(0, 10),
                  dueDate: String(editor.item.due_date || "").slice(0, 10),
                  assigneeProfessionalId: editor.item.assignee_professional_id,
                  ownerProfessionalId: editor.item.owner_professional_id,
                  parentTaskId: editor.item.parent_task_id,
                  taskType: editor.item.task_type,
                  estimatedHours: editor.item.estimated_hours,
                }
              : projectId
                ? {
                    projectId,
                    title: "",
                    startDate: new Date().toISOString().slice(0, 10),
                    dueDate: "",
                    status: editor.kind === "task" ? "open" : "planned",
                    priority: "normal",
                    progress: 0,
                    description: "",
                  }
                : null
          }
          onClose={() => setEditor(null)}
          onSave={save}
          fixedProjectId={projectId}
        />
      )}
    </div>
  );
}

function PaymentEditor({ projects, initial, onClose, onSave }) {
  const [form, setForm] = useState(
    initial || {
      projectId: "",
      title: "",
      amount: "",
      entryType: "invoice",
      dueDate: "",
      status: "pending",
      reference: "",
      notes: "",
    },
  );
  return (
    <Modal
      title={initial?.id ? "עריכת תשלום" : "דרישת תשלום חדשה"}
      subtitle="תזרים וגבייה"
      onClose={onClose}
    >
      <form
        className="work-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            ...form,
            projectId: form.projectId || initial?.project_id,
            dueDate: form.dueDate || initial?.due_date,
          });
        }}
      >
        {!initial?.id && (
          <label>
            פרויקט
            <select
              required
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">בחירת פרויקט</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          תיאור
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          סכום
          <input
            required
            type="number"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </label>
        <label>
          סוג תנועה
          <select value={form.entryType || form.entry_type || "invoice"} onChange={(e)=>setForm({...form,entryType:e.target.value})}>
            {Object.entries(paymentEntryTypes).map(([value,label])=><option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          מועד
          <input
            type="date"
            value={String(form.dueDate || form.due_date || "").slice(0, 10)}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </label>
        <label>
          סטטוס
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {Object.entries(paymentStatus).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          אסמכתה
          <input
            value={form.reference || ""}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </label>
        <label className="wide">
          הערות
          <textarea
            value={form.notes || ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="ops-primary">שמירה</button>
        </div>
      </form>
    </Modal>
  );
}

export function FinanceWorkspace({
  api,
  user,
  projects,
  setNotice,
  openProject,
  projectId = "",
}) {
  const [payments, setPayments] = useState([]);
  const [financeProjects,setFinanceProjects]=useState([]);
  const [financeSetup,setFinanceSetup]=useState(null);
  const [editor, setEditor] = useState(null);
  const [query, setQuery] = useState("");
  const load = () =>
    Promise.all([
      api(`/operations/payments?projectId=${encodeURIComponent(projectId)}`),
      api(`/operations/finance-summary?projectId=${encodeURIComponent(projectId)}`),
    ])
      .then(([paymentData,summary]) => { setPayments(Array.isArray(paymentData.payments)?paymentData.payments:[]); setFinanceProjects(Array.isArray(summary.projects)?summary.projects:[]); })
      .catch((e) => setNotice(e.message));
  useEffect(load, [projectId]);
  const visible = payments.filter((x) =>
    `${x.title} ${x.project_name || ""} ${x.reference}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const total = financeProjects.reduce((sum,item)=>sum+Number(item.total||0),0);
  const paid = financeProjects.reduce((sum,item)=>sum+Number(item.paid||0),0);
  const balance=financeProjects.reduce((sum,item)=>sum+Number(item.balance||0),0);
  const save = async (value) => {
    try {
      await api(
        editor?.id
          ? `/operations/payments/${editor.id}`
          : "/operations/payments",
        { method: editor?.id ? "PATCH" : "POST", body: JSON.stringify(value) },
      );
      setEditor(null);
      setNotice("התשלום נשמר והיתרה עודכנה");
      load();
    } catch (e) {
      setNotice(e.message);
    }
  };
  const remove = async (item) => {
    if (!confirm(`למחוק את „${item.title}”?`)) return;
    try {
      await api(`/operations/payments/${item.id}`, { method: "DELETE" });
      load();
      setNotice("התשלום נמחק");
    } catch (e) {
      setNotice(e.message);
    }
  };
  const canEdit = ["admin", "manager", "finance"].includes(user.role);
  return (
    <div className={`ops-page work-page ${projectId ? "embedded-work" : ""}`}>
      <section className="finance-work-hero">
        <div>
          <span>היקף חוזים</span>
          <strong>{money.format(total)}</strong>
        </div>
        <div>
          <span>התקבל בפועל</span>
          <strong>{money.format(paid)}</strong>
        </div>
        <div>
          <span>יתרה</span>
          <strong>{money.format(balance)}</strong>
        </div>
        <div className="collection-gauge">
          <i
            style={{
              width: `${total ? Math.min(100, (paid / total) * 100) : 0}%`,
            }}
          />
          <span>{total ? Math.round((paid / total) * 100) : 0}% נגבה</span>
        </div>
      </section>
      <section className="finance-dashboard-grid finance-dashboard-grid-single">
        <article className="panel finance-chart-card">
          <header><div><span>גבייה לפי פרויקט</span><h3>תמונת מזומן ברורה</h3></div><div className="finance-legend"><span><i className="paid"/>שולם</span><span><i className="balance"/>יתרה</span></div></header>
          {financeProjects.length ? (
            <div className="finance-bars" role="list" aria-label="גבייה לפי פרויקט">
              {financeProjects.map((item) => {
                const itemTotal = Math.max(0, Number(item.total || 0));
                const itemPaid = Math.max(0, Number(item.paid || 0));
                const itemBalance = Math.max(0, Number(item.balance || 0));
                const paidPercent = itemTotal ? Math.min(100, Math.round((itemPaid / itemTotal) * 100)) : 0;
                return <button type="button" role="listitem" key={item.id} className="finance-bar-row" onClick={() => openProject?.(projects.find((project) => String(project.id) === String(item.id)))}>
                  <div className="finance-bar-title"><strong>{item.name}</strong><small>{money.format(itemTotal)} היקף</small></div>
                  <div className="finance-bar-track" aria-label={`${item.name}: ${paidPercent}% נגבה`}><i className="paid" style={{ width: `${paidPercent}%` }} /><i className="balance" style={{ width: `${100 - paidPercent}%` }} /></div>
                  <div className="finance-bar-values"><b>{money.format(itemPaid)} <small>שולם</small></b><span>{money.format(itemBalance)} <small>יתרה</small></span><em>{paidPercent}%</em></div>
                </button>;
              })}
            </div>
          ) : (
            <EmptyState icon={CreditCard} title="אין נתונים כספיים" text="הגדירו מסגרת כספית או דרישת תשלום לפרויקט." />
          )}
        </article>
      </section>
      <div className="work-toolbar">
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש תשלום או אסמכתה"
          />
        </label>
        {canEdit && (
          <button className="ops-secondary" onClick={()=>setFinanceSetup({projectId:projectId||projects[0]?.id||"",value:"",paymentTerms:"",depositAmount:"",depositPaid:false,financeMode:"total"})}>
            <WalletCards size={16}/> אשף כספים
          </button>
        )}
        {canEdit && (
          <button className="ops-primary" onClick={() => setEditor({})}>
            <Plus size={16} />
            דרישת תשלום
          </button>
        )}
      </div>
      <div className="work-list panel">
        {!visible.length ? (
          <EmptyState
            icon={CreditCard}
            title="אין תשלומים"
            text="הוסיפו אבני חיוב כדי לעקוב אחר התחייבויות, מועדים וגבייה בפועל."
            action={canEdit ? "דרישת תשלום" : ""}
            onAction={() => setEditor({})}
          />
        ) : (
          visible.map((item) => (
            <article
              className={`work-row payment ${item.status}`}
              key={item.id}
              onClick={() => canEdit && setEditor(item)}
            >
              <span className="work-check">
                <CreditCard />
              </span>
              <div className="work-main">
                <strong>{item.title}</strong>
                <span>
                  {item.project_name ||
                    projects.find((p) => p.id === item.project_id)?.name}{" "}
                  {item.reference && `· אסמכתה ${item.reference}`}
                </span>
              </div>
              <strong className="payment-amount">
                {money.format(Number(item.amount))}
              </strong>
              <span className={`payment-state ${item.status}`}>
                {paymentStatus[item.status]}
              </span>
              <span className="work-date">
                <CalendarDays size={15} />
                {dateText(item.due_date)}
              </span>
              {user.role === "admin" && (
                <button
                  className="work-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(item);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </article>
          ))
        )}
      </div>
      {editor && (
        <PaymentEditor
          projects={
            projectId ? projects.filter((p) => p.id === projectId) : projects
          }
          initial={
            editor.id
              ? {
                  ...editor,
                  projectId: editor.project_id,
                  dueDate: String(editor.due_date || "").slice(0, 10),
                }
              : projectId
                ? {
                    projectId,
                    title: "",
                    amount: "",
                    dueDate: "",
                    status: "pending",
                    reference: "",
                    notes: "",
                  }
                : null
          }
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
      {financeSetup && <AppModal title="אשף כספים לפרויקט" subtitle="מסגרת, תנאים ומקדמה" onClose={()=>setFinanceSetup(null)} className="finance-setup-modal"><form className="work-form" onSubmit={async(event)=>{event.preventDefault();try{const target=projects.find(item=>String(item.id)===String(financeSetup.projectId));await api(`/projects/${encodeURIComponent(financeSetup.projectId)}`,{method:"PATCH",body:JSON.stringify({...financeSetup,value:Number(financeSetup.value||target?.value||0),depositAmount:Number(financeSetup.depositAmount||0)})});setNotice("המסגרת הכספית נשמרה");setFinanceSetup(null);load()}catch(error){setNotice(error.message)}}}><label className="wide">פרויקט<select required value={financeSetup.projectId} onChange={(event)=>{const target=projects.find(item=>String(item.id)===String(event.target.value));setFinanceSetup({...financeSetup,projectId:event.target.value,value:target?.value||"",paymentTerms:target?.paymentTerms||"",depositAmount:target?.depositAmount||"",depositPaid:Boolean(target?.depositPaid),financeMode:target?.financeMode||"total"})}}>{projects.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>אופן תקצוב<select value={financeSetup.financeMode} onChange={(event)=>setFinanceSetup({...financeSetup,financeMode:event.target.value})}><option value="total">סכום כללי</option><option value="systems">פיצול לפי מערכות</option></select></label><label>סכום הפרויקט<input type="number" min="0" step="0.01" value={financeSetup.value} onChange={(event)=>setFinanceSetup({...financeSetup,value:event.target.value})}/></label><label className="wide">תנאי תשלום<input value={financeSetup.paymentTerms} onChange={(event)=>setFinanceSetup({...financeSetup,paymentTerms:event.target.value})} placeholder="למשל: 30% מקדמה, 40% התקנה, 30% מסירה"/></label><label>מקדמה<input type="number" min="0" step="0.01" value={financeSetup.depositAmount} onChange={(event)=>setFinanceSetup({...financeSetup,depositAmount:event.target.value})}/></label><label className="check-label"><input type="checkbox" checked={financeSetup.depositPaid} onChange={(event)=>setFinanceSetup({...financeSetup,depositPaid:event.target.checked})}/>המקדמה שולמה</label><div className="wide form-actions"><button type="button" className="ops-secondary" onClick={()=>setFinanceSetup(null)}>ביטול</button><button className="ops-primary">שמירת מסגרת</button></div></form></AppModal>}
    </div>
  );
}

export function ReportsWorkspace({ api, setNotice, company = {}, companyLogo = "", user = {} }) {
  const canViewFinance = user.financeAccess !== false;
  const [data, setData] = useState(null);
  const [reportError, setReportError] = useState("");
  const [projects, setProjects] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reportType, setReportType] = useState("overview");
  const [projectId, setProjectId] = useState("");
  const [projectReport, setProjectReport] = useState(null);
  const [saveToProject, setSaveToProject] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiReportOpen,setAiReportOpen]=useState(false);
  const [aiPrompt,setAiPrompt]=useState(canViewFinance
    ? "הכן דוח לישיבת ניהול פרויקטים: חריגים, חסמים, משימות באיחור, גבייה והחלטות נדרשות"
    : "הכן דוח לישיבת ניהול פרויקטים: חריגים, חסמים, משימות באיחור והחלטות נדרשות");
  const [aiReportText,setAiReportText]=useState("");
  const [presentationOpen,setPresentationOpen]=useState(false);
  const [presentationStep,setPresentationStep]=useState(1);
  const [presentationOptions,setPresentationOptions]=useState({
    title:"ישיבת ניהול פרויקטים",
    riskThreshold:50,
    maxItems:7,
    projectIds:[],
    sections:{overview:true,risks:true,managers:true,systems:true,finance:canViewFinance,decisions:true},
  });
  const reportRef = useRef(null);
  const loadReports = (silent = false) => {
    setReportError("");
    return Promise.all([api("/reports/overview"), api("/projects")])
      .then(([overview, projectData]) => {
        setData(overview);
        setProjects(projectData.projects || []);
      })
      .catch((error) => {
        setReportError(error.message);
        if (!silent) setNotice(error.message);
      });
  };
  useEffect(() => {
    loadReports();
  }, []);
  useEffect(() => {
    if (!canViewFinance && reportType === "finance") setReportType("overview");
  }, [canViewFinance, reportType]);
  useEffect(() => {
    let timer;
    const live = (event) => {
      if (!["projects","tasks","project_payments","project_equipment","equipment_catalog","client_files","professionals","ai_usage_log"].includes(event.detail?.table)) return;
      clearTimeout(timer);
      timer = setTimeout(() => loadReports(true), 180);
    };
    window.addEventListener("projects:live-change", live);
    return () => { clearTimeout(timer); window.removeEventListener("projects:live-change", live); };
  }, []);
  const prepareProjectReport = async (nextProjectId) => {
    setProjectId(nextProjectId);
    setProjectReport(null);
    if (!nextProjectId) return;
    try {
      const result = await api(`/projects/${encodeURIComponent(nextProjectId)}/workspace`);
      const selectedProject = projects.find((item) => item.id === nextProjectId);
      setProjectReport({
        ...result,
        project: selectedProject
          ? { ...selectedProject, stage: stageNames[selectedProject.stage] || selectedProject.stage }
          : null,
      });
    } catch (error) {
      setNotice(error.message);
    }
  };
  const generatePdf = async () => {
    if (reportType === "project" && !projectId) {
      return setNotice("יש לבחור פרויקט לדוח");
    }
    setGenerating(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all([...reportRef.current.querySelectorAll('img')].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=resolve;image.onerror=resolve})));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      const image = canvas.toDataURL("image/jpeg", 0.94);
      let position = 0;
      pdf.addImage(image, "JPEG", 0, position, pageWidth, imageHeight);
      let remaining = imageHeight - pageHeight;
      while (remaining > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(image, "JPEG", 0, position, pageWidth, imageHeight);
        remaining -= pageHeight;
      }
      const selectedProject = projects.find((item) => item.id === projectId);
      const fileName = `PROJECTS-${reportType}-${selectedProject?.id || new Date().toISOString().slice(0, 10)}.pdf`;
      const blob = pdf.output("blob");
      if (saveToProject && projectId) {
        const form = new FormData();
        form.append("projectId", projectId);
        form.append("category", "דוח");
        form.append("title", fileName.replace(/\.pdf$/i, ""));
        form.append("file", new File([blob], fileName, { type: "application/pdf" }));
        await api("/documents", { method: "POST", body: form });
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setNotice(saveToProject && projectId ? "הדוח הורד ונשמר במסמכי הפרויקט" : "דוח PDF הופק בהצלחה");
      setWizardOpen(false);
    } catch (error) {
      setNotice(error.message || "הפקת הדוח נכשלה");
    } finally {
      setGenerating(false);
    }
  };
  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["מנהל", "פרויקטים", "התקדמות ממוצעת"],
      ...data.managers.map((x) => [x.name, x.projects, x.progress]),
    ];
    const blob = new Blob(
      ["\ufeff" + rows.map((r) => r.join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `projects-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const generateAiReport=async(event)=>{
    event.preventDefault();setGenerating(true);
    try{const job=await api('/ai/chat',{method:'POST',body:JSON.stringify({question:`הכן דוח ניהולי מקצועי בעברית וב-RTL על סמך נתוני PROJECTS. החזר טקסט תמציתי ומובנה בלבד: כותרת קצרה לכל סעיף ולאחריה עד 3 נקודות קצרות. הסעיפים הם תקציר מנהלים, חריגים וחסמים, החלטות נדרשות ופעולות לביצוע. אין להשתמש בטבלאות Markdown, אין פסקאות ארוכות ואין לחזור על אותו מידע. דרישת המשתמש: ${aiPrompt}`})});let result=job;for(let attempt=0;attempt<90&&result.status==='working';attempt++){await new Promise(resolve=>setTimeout(resolve,1000));result=await api(`/ai/chat/${job.jobId}`)}if(!result.answer)throw new Error('הסוכן לא החזיר דוח');setAiReportText(result.answer);setReportType('management');setAiReportOpen(false);setWizardOpen(true);setNotice('דוח AI הוכן ומוכן לעיון ולהפקה');}catch(error){setNotice(error.message)}finally{setGenerating(false)}
  };
  const generatePresentation=async()=>{
    const safePresentationOptions = canViewFinance ? presentationOptions : {
      ...presentationOptions,
      sections:{...presentationOptions.sections,finance:false},
    };
    if (!Object.values(safePresentationOptions.sections).some(Boolean)) return setNotice("יש לבחור לפחות פרק אחד למצגת");
    setGenerating(true);
    try {
      const { exportManagementPresentation } = await import("./presentationExport");
      await exportManagementPresentation({ projects, data, company, aiReportText, options:safePresentationOptions });
      setNotice('מצגת PowerPoint תקנית הופקה בהצלחה');
      setPresentationOpen(false);
    } catch (error) {
      setNotice(error.message || 'הפקת המצגת נכשלה');
    } finally {
      setGenerating(false);
    }
  };
  if (!data && reportError) return <div className="work-error panel"><AlertTriangle size={28}/><h3>לא ניתן לטעון את הדוחות</h3><p>{reportError}</p><button className="ops-primary" onClick={loadReports}>ניסיון חוזר</button></div>;
  if (!data) return <div className="work-loading">מכין דוחות…</div>;
  const stageColorByKey={waiting:"#7B8497",mobilization:"#6D4DE3",infrastructure:"#D18B24",threading:"#E05A33",threading_done:"#A93BB8",installation_a:"#3676E0",installation_b:"#00A0B5",installation_c:"#0E7C66",activation_programming:"#18A558",finishes:"#D33F75",post_delivery:"#2F855A"};
  const localizedStageData = data.stages.map((item) => ({
    ...item,
    label: stageNames[item.stage] || "שלב לא מוגדר",
    color:stageColorByKey[item.stage]||"#596174",
  }));
  const palette = ["#6957df", "#2987e6", "#12a594", "#e29b38", "#d95984", "#587fd8", "#8d63d9"];
  const sizeData = (data.projectSizes || []).map((item) => ({ ...item, label:projectSizeNames[item.size] || item.size }));
  const deadlineData = ["overdue","today","week","later","none"].map((key) => ({ key, label:deadlineNames[key], count:Number(data.deadlines?.find((item)=>item.bucket===key)?.count || 0) }));
  const contractorData = (data.contractorStages || []).map((item) => ({ ...item, label:contractorStageNames[item.stage] || item.stage }));
  const componentData = (data.components || []).map((item) => ({ ...item, quantity:Number(item.quantity), projects:Number(item.projects) }));
  const monthlyMap = new Map();
  (canViewFinance ? data.monthly || [] : []).forEach((item) => { const row=monthlyMap.get(item.month)||{month:item.month,paid:0,pending:0}; row[item.status === "paid" ? "paid" : "pending"] += Number(item.amount); monthlyMap.set(item.month,row); });
  const monthlyData = [...monthlyMap.values()].slice(-12).map((item)=>({ ...item, label:new Date(`${item.month}-01T12:00:00`).toLocaleDateString("he-IL",{month:"short",year:"2-digit"}) }));
  const financeProjectData = (canViewFinance ? data.financeProjects || [] : []).map((item) => ({ ...item, total:Number(item.total || 0), paid:Number(item.paid || 0), open:Number(item.open || 0) }));
  const aiUsageData = (data.aiUsage || []).map((item)=>({ ...item, questions:Number(item.questions),insights:Number(item.insights),tokens:Number(item.tokens),estimatedCost:canViewFinance?Number(item.estimated_cost):0,label:new Date(`${item.day}T12:00:00`).toLocaleDateString("he-IL",{day:"numeric",month:"short"}) }));
  const aiUsageSummary = { questions:Number(data.aiUsageSummary?.questions || 0),insights:Number(data.aiUsageSummary?.insights || 0),tokens:Number(data.aiUsageSummary?.tokens || 0),estimatedCost:canViewFinance?Number(data.aiUsageSummary?.estimated_cost || 0):0 };
  const managementFallback = canViewFinance
    ? `תמונת מצב:\nבמערכת ${projects.length} פרויקטים פעילים.\nיתרת הגבייה היא ${money.format(Number(data.finance?.open || 0))}.\nפעולות נדרשות:\nיש לעבור על משימות באיחור ועל פרויקטים בעלי התקדמות נמוכה.\nיש להגדיר אחראים ותאריכי יעד להחלטות.`
    : `תמונת מצב:\nבמערכת ${projects.length} פרויקטים פעילים.\nפעולות נדרשות:\nיש לעבור על משימות באיחור ועל פרויקטים בעלי התקדמות נמוכה.\nיש להגדיר אחראים ותאריכי יעד להחלטות.`;
  return (
    <div className="ops-page reports-page">
      <section className="ops-hero compact-work-hero">
        <div>
          <span className="ops-eyebrow">
            <BarChart3 size={15} />
            תובנות ניהוליות
          </span>
          <h2>דוחות וניתוחים</h2>
          <p>נתונים חיים מהפרויקטים, המשימות והגבייה — ללא מספרי דמו.</p>
        </div>
        <div className="report-hero-actions">
          <button className="ops-primary" onClick={() => setWizardOpen(true)}><Download size={16} />אשף דוח PDF</button>
          <button className="ops-secondary" onClick={()=>{setPresentationStep(1);setPresentationOpen(true)}}><Presentation size={16}/>אשף מצגת</button>
          <button className="ops-secondary ai-report-button" onClick={()=>setAiReportOpen(true)}><Sparkles size={16}/>דוח באמצעות AI</button>
          <button className="ops-secondary" onClick={exportCsv}><Download size={16} />ייצוא CSV</button>
        </div>
      </section>
      <div className="report-kpis">
        {canViewFinance && <>
        <span>
          <CreditCard />
          <small>היקף כולל</small>
          <b>{money.format(Number(data.finance.total))}</b>
        </span>
        <span>
          <CheckCircle2 />
          <small>נגבה</small>
          <b>{money.format(Number(data.finance.paid))}</b>
        </span>
        <span>
          <AlertTriangle />
          <small>יתרה פתוחה</small>
          <b>{money.format(Number(data.finance.open))}</b>
        </span>
        </>}
        <span>
          <ListChecks />
          <small>משימות פתוחות</small>
          <b>
            {data.tasks
              .filter((x) => x.status !== "done")
              .reduce((s, x) => s + Number(x.count), 0)}
          </b>
        </span>
      </div>
      <section className="report-category-head"><div><span>01</span><h3>מצב הפרויקטים</h3></div><p>שלבי ביצוע, גודל הפרויקטים והתקדמות הקבלן.</p></section>
      <div className="reports-grid">
        <div className="panel report-panel">
          <h3>פרויקטים לפי שלב</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={localizedStageData}
                dataKey="count"
                nameKey="label"
                innerRadius={62}
                outerRadius={95}
                paddingAngle={4}
                isAnimationActive
                animationDuration={950}
                animationEasing="ease-out"
              >
                {localizedStageData.map((_, i) => (
                  <Cell key={i} fill={localizedStageData[i].color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [value, "מספר פרויקטים"]}
                contentStyle={{ direction: "rtl", textAlign: "right" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="report-legend">
            {localizedStageData.map((x, i) => (
              <span key={x.stage}>
                <i
                  style={{ background: x.color }}
                />
                {x.label}
                <b>{x.count}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="panel report-panel">
          <h3>עומס והתקדמות לפי מנהל</h3>
          <ResponsiveContainer className="report-manager-chart" width="100%" height={300}>
            <BarChart
              data={data.managers}
              layout="vertical"
              margin={{ right: 16, left: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="name" width={112} orientation="right" tick={{ fill: "#596174", fontSize: 13 }} />
              <Tooltip
                formatter={(value) => [`${value || 0}%`, "התקדמות ממוצעת"]}
                labelFormatter={(label) => `מנהל: ${label}`}
                contentStyle={{ direction: "rtl", textAlign: "right" }}
              />
              <Bar dataKey="progress" fill="#6957df" radius={[7, 7, 7, 7]} isAnimationActive animationDuration={950} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="reports-grid three-up">
        <div className="panel report-panel report-compact"><h3>חלוקה לפי גודל פרויקט</h3>{sizeData.length ? <><ResponsiveContainer width="100%" height={210}><PieChart><Pie data={sizeData} dataKey="count" nameKey="label" innerRadius={50} outerRadius={78} paddingAngle={4} isAnimationActive animationDuration={1000} animationEasing="ease-out">{sizeData.map((_,index)=><Cell key={index} fill={palette[index%palette.length]}/>)}</Pie><Tooltip formatter={(value)=>[value,"פרויקטים"]} contentStyle={{direction:"rtl"}}/></PieChart></ResponsiveContainer><div className="report-legend">{sizeData.map((item,index)=><span key={item.size}><i style={{background:palette[index%palette.length]}}/>{item.label}<b>{item.count}</b></span>)}</div></> : <div className="chart-empty">אין נתוני גודל</div>}</div>
        <div className="panel report-panel report-wide"><h3>התקדמות הקבלן</h3>{contractorData.length ? <ResponsiveContainer width="100%" height={250}><BarChart data={contractorData} margin={{top:10,right:8,left:8,bottom:20}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}} interval={0} angle={-12}/><YAxis allowDecimals={false}/><Tooltip formatter={(value)=>[value,"פרויקטים"]} contentStyle={{direction:"rtl"}}/><Bar dataKey="count" radius={[8,8,2,2]} isAnimationActive animationBegin={120} animationDuration={900} animationEasing="ease-out">{contractorData.map((_,index)=><Cell key={index} fill={palette[(index+2)%palette.length]}/>)}</Bar></BarChart></ResponsiveContainer> : <div className="chart-empty">אין נתוני קבלן</div>}</div>
      </div>
      <section className="report-category-head"><div><span>02</span><h3>מערכות וטכנולוגיות</h3></div><p>אילו מערכות ורכיבים נמצאים בפרויקטים ובאיזו כמות.</p></section>
      <div className="reports-grid systems-reports">
        <div className="panel report-panel"><h3>מערכות מובילות לפי פרויקטים</h3>{data.systems?.length ? <ResponsiveContainer width="100%" height={310}><BarChart data={data.systems} layout="vertical" margin={{right:10,left:12}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="name" orientation="right" width={125} tick={{fontSize:11}}/><Tooltip formatter={(value)=>[value,"פרויקטים"]} contentStyle={{direction:"rtl"}}/><Bar dataKey="projects" fill="#6957df" radius={[7,7,7,7]} isAnimationActive animationBegin={120} animationDuration={1000} animationEasing="ease-out"/></BarChart></ResponsiveContainer> : <div className="chart-empty">עדיין לא שויכו מערכות לפרויקטים</div>}</div>
        <div className="panel report-panel"><h3>כמויות רכיבים מובילים</h3>{componentData.length ? <ResponsiveContainer width="100%" height={310}><BarChart data={componentData} margin={{top:8,right:8,left:8,bottom:55}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" tick={{fontSize:10}}/><YAxis allowDecimals={false}/><Tooltip formatter={(value,name)=>[value,name==="quantity"?"כמות":"פרויקטים"]} contentStyle={{direction:"rtl"}}/><Bar dataKey="quantity" fill="#12a594" radius={[7,7,2,2]} isAnimationActive animationBegin={180} animationDuration={1000} animationEasing="ease-out"/></BarChart></ResponsiveContainer> : <div className="chart-empty">עדיין לא הוגדרו כמויות רכיבים</div>}</div>
      </div>
      <section className="report-category-head"><div><span>03</span><h3>ביצוע ועומסים</h3></div><p>משימות קרובות, חריגות ועומס מנהלי הפרויקטים.</p></section>
      <div className="reports-grid execution-reports">
        <div className="panel report-panel"><h3>בריאות מועדי המשימות</h3><ResponsiveContainer width="100%" height={260}><BarChart data={deadlineData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip formatter={(value)=>[value,"משימות"]} contentStyle={{direction:"rtl"}}/><Bar dataKey="count" radius={[7,7,2,2]} isAnimationActive animationBegin={150} animationDuration={900} animationEasing="ease-out">{deadlineData.map((item,index)=><Cell key={item.key} fill={item.key==="overdue"?"#d95968":item.key==="today"?"#e29b38":palette[index%palette.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>
        <div className="panel report-panel"><h3>מסמכים לפי סוג</h3>{data.documents?.length ? <><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.documents} dataKey="count" nameKey="category" innerRadius={48} outerRadius={76} paddingAngle={3} isAnimationActive animationBegin={120} animationDuration={1000} animationEasing="ease-out">{data.documents.map((_,index)=><Cell key={index} fill={palette[index%palette.length]}/>)}</Pie><Tooltip formatter={(value)=>[value,"מסמכים"]} contentStyle={{direction:"rtl"}}/></PieChart></ResponsiveContainer><div className="report-legend compact">{data.documents.map((item,index)=><span key={item.category}><i style={{background:palette[index%palette.length]}}/>{item.category}<b>{item.count}</b></span>)}</div></> : <div className="chart-empty">אין מסמכים לסיכום</div>}</div>
      </div>
      {canViewFinance && <>
        <section className="report-category-head"><div><span>04</span><h3>כספים וגבייה</h3></div><p>מגמת תשלומים שהתקבלו מול תשלומים שטרם נגבו.</p></section>
        <div className="panel report-panel report-finance-trend"><h3>מגמת גבייה חודשית</h3>{monthlyData.length ? <ResponsiveContainer width="100%" height={300}><AreaChart data={monthlyData} margin={{top:10,right:12,left:12,bottom:5}}><defs><linearGradient id="paidGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#12a594" stopOpacity={0.45}/><stop offset="95%" stopColor="#12a594" stopOpacity={0.03}/></linearGradient><linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e29b38" stopOpacity={0.35}/><stop offset="95%" stopColor="#e29b38" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis tickFormatter={(value)=>`${Math.round(value/1000)}K`}/><Tooltip formatter={(value,name)=>[money.format(value),name==="paid"?"נגבה":"ממתין"]} contentStyle={{direction:"rtl"}}/><Area type="monotone" dataKey="paid" stroke="#12a594" strokeWidth={3} fill="url(#paidGradient)" isAnimationActive animationDuration={1100} animationEasing="ease-out"/><Area type="monotone" dataKey="pending" stroke="#e29b38" strokeWidth={2} fill="url(#pendingGradient)" isAnimationActive animationBegin={140} animationDuration={1100} animationEasing="ease-out"/></AreaChart></ResponsiveContainer> : financeProjectData.length ? <div className="report-finance-fallback"><p>תמונת מצב נוכחית לפי פרויקט — הוספת תאריכי תשלום תפעיל גם מגמה חודשית.</p>{financeProjectData.map((item)=>{const paidPercent=item.total ? Math.min(100,Math.round((item.paid/item.total)*100)) : 0;return <article key={item.id}><header><strong>{item.name}</strong><span>{money.format(item.paid)} נגבה מתוך {money.format(item.total)}</span></header><div className="report-finance-track" aria-label={`גבייה בפרויקט ${item.name}`}><i style={{width:`${paidPercent}%`}}/></div><footer><b>{paidPercent}% נגבה</b><span>יתרה {money.format(item.open)}</span></footer></article>;})}</div> : <div className="chart-empty">אין עדיין נתונים כספיים להצגה</div>}</div>
      </>}
      <section className="report-category-head"><div><span>05</span><h3>שימוש בסוכן AI</h3></div><p>{canViewFinance ? "כמות שאלות, תובנות אוטומטיות, טוקנים ואומדן עלות ב־30 הימים האחרונים." : "כמות שאלות, תובנות אוטומטיות וטוקנים ב־30 הימים האחרונים."}</p></section>
      <div className="panel report-panel ai-usage-panel">
        <header><div><h3>{canViewFinance ? "שאלות מול עלות משוערת" : "פעילות הסוכן החכם"}</h3><small>{canViewFinance ? "העלות מחושבת לפי טוקנים ומחירי המחירון של המודל; במסלול Gemini החינמי החיוב בפועל עשוי להיות ₪0." : "שאלות ותובנות שנוצרו במערכת, ללא הצגת מידע כספי."}</small></div><div className="ai-usage-kpis"><span><small>שאלות</small><b>{aiUsageSummary.questions}</b></span><span><small>תובנות רקע</small><b>{aiUsageSummary.insights}</b></span><span><small>טוקנים</small><b>{aiUsageSummary.tokens.toLocaleString("he-IL")}</b></span>{canViewFinance && <span><small>אומדן</small><b>${aiUsageSummary.estimatedCost.toFixed(4)}</b></span>}</div></header>
        {aiUsageData.length ? canViewFinance ? <ResponsiveContainer width="100%" height={310}><ComposedChart data={aiUsageData} margin={{top:18,right:12,left:12,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis yAxisId="questions" allowDecimals={false} orientation="right"/><YAxis yAxisId="cost" orientation="left" tickFormatter={(value)=>`$${Number(value).toFixed(3)}`}/><Tooltip formatter={(value,name)=>name==="estimatedCost"?[`$${Number(value).toFixed(6)}`,"עלות משוערת"]:[value,name==="questions"?"שאלות":"תובנות רקע"]} contentStyle={{direction:"rtl"}}/><Bar yAxisId="questions" dataKey="questions" name="questions" fill="#6957df" radius={[7,7,2,2]} isAnimationActive animationDuration={900}/><Line yAxisId="cost" type="monotone" dataKey="estimatedCost" name="estimatedCost" stroke="#e29b38" strokeWidth={3} dot={{r:4,fill:"#e29b38"}} isAnimationActive animationBegin={160} animationDuration={1100}/></ComposedChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height={310}><BarChart data={aiUsageData} margin={{top:18,right:12,left:12,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis allowDecimals={false}/><Tooltip formatter={(value,name)=>[value,name==="questions"?"שאלות":"תובנות רקע"]} contentStyle={{direction:"rtl"}}/><Bar dataKey="questions" name="questions" fill="#6957df" radius={[7,7,2,2]}/><Bar dataKey="insights" name="insights" fill="#12a594" radius={[7,7,2,2]}/></BarChart></ResponsiveContainer> : <div className="chart-empty">הנתונים יופיעו לאחר השאלה הראשונה לסוכן</div>}
      </div>
      <div className="panel report-table">
        <h3>ביצועים לפי מנהל פרויקט</h3>
        <table>
          <thead>
            <tr>
              <th>מנהל</th>
              <th>מספר פרויקטים</th>
              <th>התקדמות ממוצעת</th>
              <th>אינדיקציה</th>
            </tr>
          </thead>
          <tbody>
            {data.managers.map((x) => (
              <tr key={x.name}>
                <td>
                  <UserRound size={15} />
                  {x.name}
                </td>
                <td>{x.projects}</td>
                <td>{x.progress || 0}%</td>
                <td>
                  <div className="mini-progress">
                    <i style={{ width: `${x.progress || 0}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {presentationOpen && (
        <Modal title="אשף מצגת ניהולית" subtitle={`שלב ${presentationStep} מתוך 3 · בחירת תוכן ופרמטרים`} className="presentation-wizard-modal" onClose={()=>setPresentationOpen(false)}>
          <div className="presentation-wizard">
            <nav className="wizard-steps" aria-label="שלבי האשף">
              {["תוכן","מיקוד","אישור"].map((label,index)=><span key={label} className={presentationStep===index+1?"active":presentationStep>index+1?"done":""}><b>{index+1}</b>{label}</span>)}
            </nav>
            {presentationStep===1&&<section className="presentation-step"><header><h3>אילו פרקים יופיעו?</h3><p>כל פרק שנבחר הופך לשקופית עצמאית. שקופית שער תמיד נכללת.</p></header><div className="presentation-section-grid">{[
              ["overview","תמונת מצב","פרויקטים, משימות ויתרה לגבייה"],
              ["risks","סיכונים וחסמים","פרויקטים מתחת לסף ההתקדמות"],
              ["managers","מנהלי פרויקטים","עומס והתקדמות לפי מנהל"],
              ["systems","מערכות ורכיבים","מערכות ורכיבים מובילים"],
              ["finance","כספים וגבייה","היקף, נגבה ויתרה פתוחה"],
              ["decisions","החלטות ופעולות","סיכום AI או המלצות מערכת"],
            ].filter(([key])=>canViewFinance || key!=="finance").map(([key,title,description])=><label key={key} className={presentationOptions.sections[key]?"selected":""}><input type="checkbox" checked={presentationOptions.sections[key]} onChange={(event)=>setPresentationOptions((current)=>({...current,sections:{...current.sections,[key]:event.target.checked}}))}/><span><strong>{title}</strong><small>{description}</small></span><i>{presentationOptions.sections[key]?"נכלל":"לא נכלל"}</i></label>)}</div></section>}
            {presentationStep===2&&<section className="presentation-step"><header><h3>מה חשוב להדגיש?</h3><p>הפרמטרים משפיעים על הסינון ועל כמות המידע בכל שקופית.</p></header><div className="presentation-parameters"><label className="wide">כותרת המצגת<input value={presentationOptions.title} onChange={(event)=>setPresentationOptions((current)=>({...current,title:event.target.value}))} maxLength="90"/></label><label>סף סיכון להתקדמות<input type="number" min="0" max="100" value={presentationOptions.riskThreshold} onChange={(event)=>setPresentationOptions((current)=>({...current,riskThreshold:event.target.value}))}/><small>פרויקט מתחת לאחוז זה יסומן לתשומת לב.</small></label><label>מספר פריטים מרבי בשקופית<select value={presentationOptions.maxItems} onChange={(event)=>setPresentationOptions((current)=>({...current,maxItems:Number(event.target.value)}))}>{[5,7,10].map((value)=><option key={value} value={value}>{value} פריטים</option>)}</select></label><fieldset className="wide"><legend>מיקוד בפרויקטים</legend><p>ללא בחירה המצגת תכלול את כל הפרויקטים הפעילים.</p><div className="presentation-project-list">{projects.map((project)=><label key={project.id}><input type="checkbox" checked={presentationOptions.projectIds.includes(String(project.id))} onChange={(event)=>setPresentationOptions((current)=>({...current,projectIds:event.target.checked?[...current.projectIds,String(project.id)]:current.projectIds.filter((id)=>id!==String(project.id))}))}/><span>{project.name}</span><small>{project.id} · {project.progress||0}%</small></label>)}</div></fieldset></div></section>}
            {presentationStep===3&&<section className="presentation-step presentation-review"><header><h3>המצגת מוכנה להפקה</h3><p>בדקו את הבחירה. הקובץ יופק כ־PPTX תקני הניתן לעריכה ב־PowerPoint.</p></header><div className="presentation-summary"><article><small>כותרת</small><strong>{presentationOptions.title||"ישיבת ניהול פרויקטים"}</strong></article><article><small>שקופיות</small><strong>{1+Object.entries(presentationOptions.sections).filter(([key,enabled])=>enabled&&(canViewFinance||key!=="finance")).length}</strong></article><article><small>היקף</small><strong>{presentationOptions.projectIds.length?`${presentationOptions.projectIds.length} פרויקטים שנבחרו`:"כל הפרויקטים"}</strong></article><article><small>סף סיכון</small><strong>{presentationOptions.riskThreshold}%</strong></article></div><div className="presentation-selected-sections">{Object.entries(presentationOptions.sections).filter(([key,enabled])=>enabled&&(canViewFinance||key!=="finance")).map(([key])=><span key={key}>{({overview:"תמונת מצב",risks:"סיכונים",managers:"מנהלים",systems:"מערכות",finance:"כספים",decisions:"החלטות"})[key]}</span>)}</div></section>}
            <footer className="presentation-wizard-actions"><button type="button" className="ops-secondary" onClick={()=>presentationStep===1?setPresentationOpen(false):setPresentationStep((step)=>step-1)}>{presentationStep===1?"ביטול":"חזרה"}</button>{presentationStep<3?<button type="button" className="ops-primary" onClick={()=>setPresentationStep((step)=>step+1)} disabled={presentationStep===1&&!Object.values(presentationOptions.sections).some(Boolean)}>המשך</button>:<button type="button" className="ops-primary" onClick={generatePresentation} disabled={generating}><Presentation size={16}/>{generating?"מפיק מצגת...":"הפקת PowerPoint"}</button>}</footer>
          </div>
        </Modal>
      )}
      {wizardOpen && (
        <Modal title="אשף הפקת דוח PDF" subtitle="בחירת תוכן, פרויקט ויעד השמירה" className="report-modal" onClose={() => setWizardOpen(false)}>
          <div className="report-wizard">
            <div className="report-wizard-options">
              <label>סוג הדוח<select value={reportType} onChange={(event) => { setReportType(event.target.value); if (event.target.value !== "project") setSaveToProject(false); }}><option value="overview">תמונת מצב מלאה</option><option value="management">ישיבת ניהול פרויקטים</option><option value="project">דוח פרויקט</option>{canViewFinance&&<option value="finance">כספים וגבייה</option>}<option value="professionals">אנשי מקצוע ומנהלים</option></select></label>
              {(reportType === "project" || saveToProject) && <label>פרויקט<select value={projectId} onChange={(event) => prepareProjectReport(event.target.value)}><option value="">בחירת פרויקט</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>}
              {reportType === "project" && <label className="report-save-check"><input type="checkbox" checked={saveToProject} onChange={(event) => setSaveToProject(event.target.checked)}/><span>לשמור עותק במסמכי הפרויקט / NAS</span></label>}
            </div>
            <div className="pdf-report-sheet" ref={reportRef} dir="rtl">
              <header><div className="pdf-company-brand">{companyLogo&&<img src={companyLogo} alt=""/>}<div><strong>{company.name||<><b>PRO</b>JECTS</>}</strong><small>{company.name?'מופק באמצעות PROJECTS':'Manage Smarter. Deliver Better.'}</small></div></div><span>דוח שהופק בתאריך {new Date().toLocaleDateString("he-IL")}</span></header>
              <h1>{reportType === "project" ? projectReport?.project?.name || "דוח פרויקט" : reportType === "finance" ? "דוח כספים וגבייה" : reportType === "professionals" ? "דוח מנהלים ואנשי מקצוע" : reportType === "management" ? "דוח לישיבת ניהול פרויקטים" : "תמונת מצב ניהולית"}</h1>
              {reportType==="management"&&<><h2>תקציר מנהלים</h2><AiReportContent text={aiReportText||managementFallback}/><h2>סדר יום מוצע</h2><ol><li>חסמים ופרויקטים הדורשים החלטה</li><li>משימות קריטיות ובאיחור</li>{canViewFinance&&<li>תחזית גבייה ותשלומים פתוחים</li>}<li>עומס מנהלים והקצאת משאבים</li><li>החלטות, אחראים ותאריכי יעד</li></ol></>}
              {reportType === "project" && projectReport ? <><div className="pdf-kpis"><span><small>שלב</small><b>{projectReport.project.stage}</b></span><span><small>התקדמות</small><b>{projectReport.project.progress}%</b></span><span><small>משימות</small><b>{projectReport.tasks.length}</b></span><span><small>מסמכים</small><b>{projectReport.files.length}</b></span></div><h2>פרטי פרויקט</h2><p>{projectReport.project.client} · {projectReport.project.address}</p><p>מנהל: {projectReport.project.manager||'לא הוקצה'}{canViewFinance&&<> · היקף: {money.format(Number(projectReport.project.value||0))} · יתרה: {money.format(Math.max(0,Number(projectReport.project.value||0)-Number(projectReport.project.paid||0)))}</>}</p><h2>משימות ואבני דרך</h2><table><thead><tr><th>משימה</th><th>סטטוס</th><th>אחראי</th><th>תאריך סיום</th></tr></thead><tbody>{projectReport.tasks.slice(0,30).map((item)=><tr key={item.id}><td>{item.title}{item.critical?' · קריטית':''}</td><td>{taskStatus[item.status] || item.status}</td><td>{item.assignee_name||'—'}</td><td>{dateText(item.due_date)}</td></tr>)}</tbody></table><h2>צוות, מערכות ותיעוד</h2><p>צוות: {projectReport.team.map(item=>`${item.display_name} (${item.role_name})`).join(' · ')||'טרם שויך'}</p><p>מערכות ורכיבים: {projectReport.equipment.slice(0,18).map(item=>`${item.name} × ${Number(item.quantity)}`).join(' · ')||'טרם שויכו'}</p><p>ביקורות אתר: {projectReport.reviews?.length||0} · סיכומי פגישות: {projectReport.meetings?.length||0} · עדכונים: {projectReport.updates?.length||0}</p></> : <><div className="pdf-kpis">{canViewFinance&&<><span><small>היקף</small><b>{money.format(Number(data.finance.total))}</b></span><span><small>נגבה</small><b>{money.format(Number(data.finance.paid))}</b></span><span><small>יתרה</small><b>{money.format(Number(data.finance.open))}</b></span></>}<span><small>פרויקטים</small><b>{projects.length}</b></span></div><h2>{reportType === "professionals" ? "ביצועים לפי מנהל" : "נתונים מרכזיים"}</h2><table><thead><tr><th>מנהל</th><th>פרויקטים</th><th>התקדמות</th></tr></thead><tbody>{data.managers.map((item)=><tr key={item.name}><td>{item.name}</td><td>{item.projects} פרויקטים</td><td>{item.progress || 0}%</td></tr>)}</tbody></table></>}
              <footer className="pdf-signature"><div><b>הופק על ידי</b><span>{user.displayName||user.username||'משתמש מערכת'}</span><small>{user.roleName||user.role||''}</small></div><div><b>מועד הפקה</b><span>{new Date().toLocaleString('he-IL')}</span><small>מסמך מערכת PROJECTS</small></div></footer>
            </div>
            <div className="form-actions"><button type="button" className="ops-secondary" onClick={() => setWizardOpen(false)}>ביטול</button><button type="button" className="ops-primary" disabled={generating || (reportType === "project" && !projectReport)} onClick={generatePdf}>{generating ? "מפיק PDF..." : "הפקת והורדת PDF"}</button></div>
          </div>
        </Modal>
      )}
      {aiReportOpen&&<Modal title="יצירת דוח באמצעות AI" subtitle="הסוכן קורא את נתוני PROJECTS בהרשאת קריאה בלבד" className="ai-report-modal" onClose={()=>setAiReportOpen(false)}><form className="work-form" onSubmit={generateAiReport}><label className="wide">מה לכלול בדוח?<textarea autoFocus value={aiPrompt} onChange={event=>setAiPrompt(event.target.value)} required/></label><div className="form-actions wide"><button type="button" className="ops-secondary" onClick={()=>setAiReportOpen(false)}>ביטול</button><button className="ops-primary" disabled={generating}><Sparkles size={15}/>{generating?'מכין דוח...':'יצירת דוח'}</button></div></form></Modal>}
    </div>
  );
}
