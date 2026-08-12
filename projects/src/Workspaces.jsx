import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Flag,
  FolderKanban,
  ListChecks,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
const milestoneStatus = {
  planned: "מתוכננת",
  in_progress: "בתהליך",
  completed: "הושלמה",
  delayed: "באיחור",
};
const paymentStatus = { pending: "ממתין", paid: "שולם", cancelled: "בוטל" };
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
  return (
    <div className={`modal-backdrop ${className ? `${className}-backdrop` : ""}`.trim()} onMouseDown={onClose}>
      <div
        className={`modal work-modal ${className}`.trim()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span>{subtitle}</span>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
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
}) {
  const isMilestone = kind === "milestone";
  const [form, setForm] = useState(
    initial ||
      (isMilestone
        ? {
            projectId: "",
            title: "",
            dueDate: "",
            status: "planned",
            progress: 0,
            ownerProfessionalId: "",
            description: "",
          }
        : {
            projectId: "",
            title: "",
            startDate: new Date().toISOString().slice(0, 10),
            dueDate: "",
            status: "open",
            priority: "normal",
            assigneeProfessionalId: "",
            taskType: "task",
            estimatedHours: "",
            description: "",
          }),
  );
  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      projectId: form.projectId || initial?.project_id,
      dueDate: form.dueDate || initial?.due_date,
      assigneeProfessionalId: form.assigneeProfessionalId || null,
      ownerProfessionalId: form.ownerProfessionalId || null,
    });
  };
  return (
    <Modal
      title={isMilestone ? "אבן דרך" : "משימה"}
      subtitle={initial?.id ? "עריכה ועדכון" : "פריט תפעולי חדש"}
      onClose={onClose}
    >
      <form className="work-form" onSubmit={submit}>
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
        <label>
          תאריך יעד
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
          אחראי
          <select
            value={
              form.ownerProfessionalId ||
              form.owner_professional_id ||
              form.assigneeProfessionalId ||
              form.assignee_professional_id ||
              ""
            }
            onChange={(e) =>
              setForm({
                ...form,
                [isMilestone
                  ? "ownerProfessionalId"
                  : "assigneeProfessionalId"]: e.target.value,
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
                value={form.estimatedHours || form.estimated_hours || ""}
                onChange={(e) =>
                  setForm({ ...form, estimatedHours: e.target.value })
                }
              />
            </label>
          </>
        )}
        {!isMilestone && (
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
}) {
  const [tab, setTab] = useState("tasks");
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
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
    const live = () => load();
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, [query, status, projectId]);
  const items = tab === "tasks" ? tasks : milestones;
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
            {projectId ? "משימות ואבני דרך בפרויקט" : "מרכז משימות ואבני דרך"}
          </h2>
          <p>
            תמונה אחת של אחריות, מועדים, חריגות והתקדמות — עם היסטוריה מלאה בלוח
            השנה.
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
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">כל הסטטוסים</option>
            {Object.entries(taskStatus).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
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
      <div className="work-list panel">
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
              className={`work-row ${item.status}`}
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
                <span>
                  {item.project_name ||
                    projects.find((p) => p.id === item.project_id)?.name}{" "}
                  {item.description && `· ${item.description}`}
                </span>
                {tab === "tasks" && item.dependency_title && <small className="task-dependency">תלויה ב: {item.dependency_title}</small>}
              </div>
              <span className={`work-priority ${item.priority || item.status}`}>
                {tab === "tasks"
                  ? item.priority === "urgent"
                    ? "דחופה"
                    : taskStatus[item.status]
                  : milestoneStatus[item.status]}
              </span>
              <span className="work-owner">
                <UserRound size={15} />
                {item.assignee_name || item.owner_name || "לא הוקצה"}
              </span>
              <span
                className={`work-date ${new Date(item.due_date) < new Date() && !["done", "completed"].includes(item.status) ? "late" : ""}`}
              >
                <CalendarDays size={15} />
                <span>{dateText(item.due_date)}<small>{dueText(item.due_date)}</small></span>
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
  const [editor, setEditor] = useState(null);
  const [query, setQuery] = useState("");
  const load = () =>
    api(`/operations/payments?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => setPayments(r.payments))
      .catch((e) => setNotice(e.message));
  useEffect(load, [projectId]);
  const visible = payments.filter((x) =>
    `${x.title} ${x.project_name || ""} ${x.reference}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const total = projects
      .filter((p) => !projectId || p.id === projectId)
      .reduce((s, p) => s + Number(p.value), 0),
    paid = payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.amount), 0);
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
          <strong>{money.format(Math.max(0, total - paid))}</strong>
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
    </div>
  );
}

export function ReportsWorkspace({ api, setNotice }) {
  const [data, setData] = useState(null);
  const [reportError, setReportError] = useState("");
  const [projects, setProjects] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reportType, setReportType] = useState("overview");
  const [projectId, setProjectId] = useState("");
  const [projectReport, setProjectReport] = useState(null);
  const [saveToProject, setSaveToProject] = useState(false);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef(null);
  const loadReports = () => {
    setReportError("");
    return Promise.all([api("/reports/overview"), api("/projects")])
      .then(([overview, projectData]) => {
        setData(overview);
        setProjects(projectData.projects || []);
      })
      .catch((error) => {
        setReportError(error.message);
        setNotice(error.message);
      });
  };
  useEffect(() => {
    loadReports();
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
  if (!data && reportError) return <div className="work-error panel"><AlertTriangle size={28}/><h3>לא ניתן לטעון את הדוחות</h3><p>{reportError}</p><button className="ops-primary" onClick={loadReports}>ניסיון חוזר</button></div>;
  if (!data) return <div className="work-loading">מכין דוחות…</div>;
  const stageColors = [
    "#6957df",
    "#2987e6",
    "#12a594",
    "#e29b38",
    "#d95984",
    "#1d9b66",
  ];
  const localizedStageData = data.stages.map((item) => ({
    ...item,
    label: stageNames[item.stage] || "שלב לא מוגדר",
  }));
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
          <button className="ops-secondary" onClick={exportCsv}><Download size={16} />ייצוא CSV</button>
        </div>
      </section>
      <div className="report-kpis">
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
              >
                {localizedStageData.map((_, i) => (
                  <Cell key={i} fill={stageColors[i % stageColors.length]} />
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
                  style={{ background: stageColors[i % stageColors.length] }}
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
              <Bar dataKey="progress" fill="#6957df" radius={[5, 5, 5, 5]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
      {wizardOpen && (
        <Modal title="אשף הפקת דוח PDF" subtitle="בחירת תוכן, פרויקט ויעד השמירה" className="report-modal" onClose={() => setWizardOpen(false)}>
          <div className="report-wizard">
            <div className="report-wizard-options">
              <label>סוג הדוח<select value={reportType} onChange={(event) => { setReportType(event.target.value); if (event.target.value !== "project") setSaveToProject(false); }}><option value="overview">תמונת מצב מלאה</option><option value="project">דוח פרויקט</option><option value="finance">כספים וגבייה</option><option value="professionals">אנשי מקצוע ומנהלים</option></select></label>
              {(reportType === "project" || saveToProject) && <label>פרויקט<select value={projectId} onChange={(event) => prepareProjectReport(event.target.value)}><option value="">בחירת פרויקט</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>}
              {reportType === "project" && <label className="report-save-check"><input type="checkbox" checked={saveToProject} onChange={(event) => setSaveToProject(event.target.checked)}/><span>לשמור עותק במסמכי הפרויקט / NAS</span></label>}
            </div>
            <div className="pdf-report-sheet" ref={reportRef} dir="rtl">
              <header><div><b>PRO</b>JECTS</div><span>דוח שהופק בתאריך {new Date().toLocaleDateString("he-IL")}</span></header>
              <h1>{reportType === "project" ? projectReport?.project?.name || "דוח פרויקט" : reportType === "finance" ? "דוח כספים וגבייה" : reportType === "professionals" ? "דוח מנהלים ואנשי מקצוע" : "תמונת מצב ניהולית"}</h1>
              {reportType === "project" && projectReport ? <><div className="pdf-kpis"><span><small>שלב</small><b>{projectReport.project.stage}</b></span><span><small>התקדמות</small><b>{projectReport.project.progress}%</b></span><span><small>משימות</small><b>{projectReport.tasks.length}</b></span><span><small>מסמכים</small><b>{projectReport.files.length}</b></span></div><h2>פרטי פרויקט</h2><p>{projectReport.project.client} · {projectReport.project.address}</p><h2>משימות ואבני דרך</h2><table><tbody>{projectReport.tasks.slice(0,20).map((item)=><tr key={item.id}><td>{item.title}</td><td>{taskStatus[item.status] || item.status}</td><td>{dateText(item.due_date)}</td></tr>)}</tbody></table></> : <><div className="pdf-kpis"><span><small>היקף</small><b>{money.format(Number(data.finance.total))}</b></span><span><small>נגבה</small><b>{money.format(Number(data.finance.paid))}</b></span><span><small>יתרה</small><b>{money.format(Number(data.finance.open))}</b></span><span><small>פרויקטים</small><b>{projects.length}</b></span></div><h2>{reportType === "professionals" ? "ביצועים לפי מנהל" : "נתונים מרכזיים"}</h2><table><tbody>{data.managers.map((item)=><tr key={item.name}><td>{item.name}</td><td>{item.projects} פרויקטים</td><td>{item.progress || 0}%</td></tr>)}</tbody></table></>}
            </div>
            <div className="form-actions"><button type="button" className="ops-secondary" onClick={() => setWizardOpen(false)}>ביטול</button><button type="button" className="ops-primary" disabled={generating || (reportType === "project" && !projectReport)} onClick={generatePdf}>{generating ? "מפיק PDF..." : "הפקת והורדת PDF"}</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
