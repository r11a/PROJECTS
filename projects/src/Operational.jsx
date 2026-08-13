import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  CirclePlus,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  FileText,
  Copy,
  Eye,
  ExternalLink,
  Filter,
  Flag,
  FolderOpen,
  HardHat,
  History,
  LayoutGrid,
  KeyRound,
  Link2,
  List,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Package,
  Palette,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
  UserRound,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";
import { AddressAutocomplete } from "./AddressAutocomplete";

const roleNames = {
  architect: "אדריכל",
  electrician: "חשמלאי",
  supervisor: "מפקח",
  contractor: "קבלן",
  designer: "מעצב פנים",
  other: "אחר",
};
const actionNames = {
  create: "יצירה",
  update: "עדכון",
  delete: "מחיקה",
  archive: "העברה לארכיון",
  restore: "שחזור מהארכיון",
  upload: "העלאת קובץ",
  import: "ייבוא",
  login: "כניסה",
  logout: "יציאה",
  backup: "גיבוי",
  restore_requested: "בקשת שחזור",
  snooze: "דחיית התראה",
  dismiss: "ביטול התראה",
  test: "בדיקת חיבור",
};
const categoryNames = {
  stage: "שלבים",
  system: "מערכות",
  tag: "תגיות",
  flag: "דגלים",
  priority: "עדיפויות",
  contact_role: "תפקידי אנשי קשר",
  task_status: "סטטוסי משימות",
  inspection_template: "תבניות ביקורת",
};
const iconOptions = [
  "circle",
  "star",
  "flag",
  "clock",
  "home",
  "camera",
  "network",
  "speaker",
  "cpu",
  "zap",
  "shield",
  "ruler",
  "palette",
  "hard-hat",
];

function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "לק"
  );
}
function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "ללא תאריך";
}
function bytes(value) {
  return value > 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value / 1024))} KB`;
}

function DynamicIcon({ name, size = 16 }) {
  const icons = {
    star: Star,
    flag: Flag,
    clock: Clock3,
    camera: Camera,
    cctv: Camera,
    "circle-dot": Camera,
    "rotate-3d": Camera,
    "eye-off": Camera,
    "scan-eye": Camera,
    zap: Zap,
    "plug-zap": Zap,
    shield: ShieldCheck,
    "shield-alert": ShieldCheck,
    "shield-check": ShieldCheck,
    siren: ShieldCheck,
    radar: Activity,
    scan: Activity,
    "smoke-detector": ShieldCheck,
    magnet: ShieldCheck,
    waves: Activity,
    palette: Palette,
    "hard-hat": HardHat,
    ruler: Pencil,
    home: Building2,
    "house-plug": Building2,
    network: Activity,
    wifi: Activity,
    "radio-tower": Activity,
    server: Database,
    "git-branch-plus": Activity,
    speaker: Sparkles,
    "audio-lines": Sparkles,
    radio: Sparkles,
    "volume-2": Sparkles,
    mountain: Sparkles,
    cpu: Settings2,
    "circuit-board": Settings2,
    box: Package,
    "tablet-smartphone": Settings2,
    "toggle-right": Settings2,
    snowflake: Sparkles,
    "scan-face": UserRound,
    "door-open": Building2,
    "panel-top": Settings2,
    split: Activity,
    "rectangle-horizontal": Settings2,
    "align-justify": Settings2,
    "chart-no-axes-combined": Activity,
    circle: Tag,
  };
  const Icon = icons[name] || Tag;
  return <Icon size={size} />;
}

export function InsightsTile({ insights, onNavigate, refreshing, onRefresh }) {
  if (!insights)
    return (
      <section className="insights-tile panel loading">
        <RefreshCw className="spin" size={20} />
        מחשב תובנות...
      </section>
    );
  return (
    <section className="insights-tile panel">
      <header>
        <div>
          <span>
            <Sparkles size={17} />
          </span>
          <div>
            <h3>תובנות אוטומטיות</h3>
            <p>{insights.summary || "PROJECTS מנתח משימות, גבייה ובריאות פרויקטים"}</p>
          </div>
        </div>
        <div className="insight-status">
          <em className={insights.ai?.status || "local"}>
            {insights.ai?.status === "ready" ? "AI" : insights.ai?.status === "fallback" || insights.ai?.status === "disabled" || insights.ai?.status === "unconfigured" ? "מקומי" : "LIVE"}
          </em>
          <button type="button" onClick={onRefresh} disabled={refreshing} title="רענון ניתוח חכם">
            <RefreshCw className={refreshing ? "spin" : ""} size={15} />
          </button>
        </div>
      </header>
      <div className="insight-results">
        {insights.suggestions.slice(0, 4).map((item, index) => (
          <button
            key={`${item.title}-${index}`}
            className={item.tone}
            onClick={() => onNavigate(item.target)}
          >
            <span>
              {item.tone === "danger" ? (
                <AlertTriangle />
              ) : item.tone === "success" ? (
                <CheckCircle2 />
              ) : item.tone === "warning" ? (
                <Clock3 />
              ) : (
                <Activity />
              )}
            </span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </div>
            <ChevronLeft size={16} />
          </button>
        ))}
        <footer>
          <span>{insights.ai?.providerName || "מנוע תובנות מקומי"}{insights.ai?.model ? ` · ${insights.ai.model}` : ""}</span>
          <small>{insights.ai?.error || `${insights.ai?.cached ? "ניתוח שמור" : "מתעדכן אוטומטית ברקע"}${insights.ai?.generatedAt ? ` · ${new Date(insights.ai.generatedAt).toLocaleTimeString("he-IL", { hour:"2-digit", minute:"2-digit" })}` : ""}`}</small>
        </footer>
      </div>
    </section>
  );
}

export function AlertCenter({ alerts, api, onSnoozed, onClose, setNotice, onOpenTask }) {
  const [duration, setDuration] = useState("hour");
  const [busy, setBusy] = useState(false);
  const durationOptions=[['hour','שעה','בעוד שעה'],['day','יום','מחר'],['week','שבוע','בעוד שבוע'],['month','חודש','בעוד חודש']];
  const snooze = async () => {
    setBusy(true);
    try {
      const result=await api("/alerts/snooze", {
        method: "POST",
        body: JSON.stringify({
          keys: alerts.map((alert) => alert.key),
          duration,
        }),
      });
      setNotice(`ההתראות נדחו עד ${result?.snoozedUntil?new Date(result.snoozedUntil).toLocaleString('he-IL'):'המועד שנבחר'}`);
      await onSnoozed?.(result);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };
  const dismiss=async()=>{setBusy(true);try{await api('/alerts/dismiss',{method:'POST',body:JSON.stringify({keys:alerts.map(alert=>alert.key)})});setNotice('ההתראות בוטלו עבורך');onSnoozed()}catch(error){setNotice(error.message)}finally{setBusy(false)}};
  return (
    <div className="alert-backdrop">
      <section className="alert-center">
        <header>
          <span>
            <AlertTriangle size={22} />
          </span>
          <div>
            <small>מרכז התראות משימות</small>
            <h2>
              {alerts.length === 1
                ? "משימה שלא הושלמה בזמן"
                : `${alerts.length} משימות שלא הושלמו בזמן`}
            </h2>
          </div>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="alert-summary"><span><b>{alerts.length}</b> התראות פעילות</span><p>בחרו משימה לטיפול מיידי, או דחו את כל ההתראות למועד נוח.</p></div>
        <div className="alert-list">
          {alerts.map((alert) => (
            <article key={alert.key}>
              <span className={`alert-priority ${alert.priority}`}>
                <ClipboardCheck size={17} />
              </span>
              <div>
                <strong>{alert.title}</strong>
                <small>
                  {alert.clientName || "ללא לקוח"} · יעד{" "}
                  {formatDate(alert.dueDate)}
                </small>
              </div>
              <em>
                {Math.max(
                  1,
                  Math.ceil(
                    (Date.now() - new Date(alert.dueDate).getTime()) / 86400000,
                  ),
                )}{" "}
                ימים באיחור
              </em>
              <button className="alert-open-task" onClick={()=>onOpenTask(alert)}>פתח משימה</button>
            </article>
          ))}
        </div>
        <footer>
          <div className="alert-deferral"><span><Clock3 size={16}/>דחיית התראה</span><div>{durationOptions.map(([value,label,hint])=><button type="button" key={value} className={duration===value?'active':''} onClick={()=>setDuration(value)} title={hint}>{label}</button>)}</div></div>
          <div className="alert-footer-actions"><button className="ops-ghost" onClick={onClose}>סגירה</button><button className="ops-secondary" onClick={dismiss} disabled={busy}>ביטול קבוע</button><button className="ops-primary" onClick={snooze} disabled={busy}>
            {busy ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Clock3 size={16} />
            )}
            דחיית כל ההתראות
          </button></div>
        </footer>
      </section>
    </div>
  );
}

export function CalendarWorkspace({ api, apiRoot, user, setNotice }) {
  const swipeStart = useRef(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState("month");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState("");
  const [calendarFeed, setCalendarFeed] = useState(null);
  const canCreate = ["admin", "manager"].includes(user.role);
  const year = cursor.getFullYear(),
    month = cursor.getMonth();
  const weekStart = new Date(year, month, cursor.getDate() - cursor.getDay());
  const weekDays = Array.from(
    { length: 7 },
    (_, index) =>
      new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + index,
      ),
  );
  const rangeTitle =
    view === "year"
      ? String(year)
      : view === "day"
        ? cursor.toLocaleDateString("he-IL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : ["month", "monthDetail"].includes(view)
          ? cursor.toLocaleDateString("he-IL", {
              month: "long",
              year: "numeric",
            })
          : `${weekDays[0].toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}`;
  const localKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const load = async () => {
    const fromDate =
      view === "year"
        ? new Date(year, 0, 1)
        : view === "day"
          ? new Date(year, month, cursor.getDate())
          : ["month", "monthDetail"].includes(view)
            ? new Date(year, month, 1)
            : weekStart;
    const toDate =
      view === "year"
        ? new Date(year + 1, 0, 1)
        : view === "day"
          ? new Date(year, month, cursor.getDate() + 1)
          : ["month", "monthDetail"].includes(view)
            ? new Date(year, month + 1, 1)
            : new Date(
                weekStart.getFullYear(),
                weekStart.getMonth(),
                weekStart.getDate() + 7,
              );
    try {
      const result = await api(
        `/calendar?from=${encodeURIComponent(fromDate.toISOString())}&to=${encodeURIComponent(toDate.toISOString())}&projectId=${encodeURIComponent(projectFilter)}`,
      );
      setEvents(result.events);
      setProjects(result.projects || []);
      setLastUpdated(new Date());
    } catch (error) {
      setNotice(error.message);
    }
  };
  useEffect(() => {
    load();
    setSelectedDay(null);
    const timer = setInterval(load, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [year, month, cursor.getDate(), view, projectFilter]);
  useEffect(() => {
    api("/calendar-feed")
      .then(setCalendarFeed)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const live = () => load();
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, [year, month, cursor.getDate(), view, projectFilter]);
  const createCalendarFeed = async () => {
    try {
      const result = await api("/calendar-feed", {
        method: "POST",
        body: "{}",
      });
      setCalendarFeed({ active: true, token: result.token });
      setNotice("קישור Outlook לקריאה בלבד נוצר");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const calendarFeedUrl = calendarFeed?.token
    ? `${window.location.origin}${apiRoot}/calendar-feed/${calendarFeed.token}.ics`
    : "";
  const copyCalendarFeed = async () => {
    try {
      await navigator.clipboard.writeText(calendarFeedUrl);
      setNotice("הקישור הועתק. ב-Outlook יש לבחור Subscribe from web.");
    } catch {
      setNotice(calendarFeedUrl);
    }
  };
  const revokeCalendarFeed = async () => {
    if (!confirm("לבטל את קישור Outlook הקיים?")) return;
    try {
      await api("/calendar-feed", { method: "DELETE" });
      setCalendarFeed({ active: false, token: null });
      setNotice("קישור Outlook בוטל");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const first = new Date(year, month, 1),
    gridStart = new Date(year, month, 1 - first.getDay());
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      ),
  );
  const monthDays = Array.from(
    { length: new Date(year, month + 1, 0).getDate() },
    (_, index) => new Date(year, month, index + 1),
  );
  const eventMap = useMemo(
    () =>
      events.reduce((map, event) => {
        const key = localKey(new Date(event.startAt));
        (map[key] ||= []).push(event);
        return map;
      }, {}),
    [events],
  );
  const chosenEvents = selectedDay ? eventMap[localKey(selectedDay)] || [] : [];
  const move = (direction) =>
    setCursor(
      view === "year"
        ? new Date(year + direction, month, 1)
        : ["month", "monthDetail"].includes(view)
          ? new Date(year, month + direction, 1)
          : view === "day"
            ? new Date(year, month, cursor.getDate() + direction)
            : new Date(year, month, cursor.getDate() + direction * 7),
    );
  const beginSwipe = (event) => {
    if (event.target.closest("button,input,select,label,.calendar-view-switch"))
      return (swipeStart.current = null);
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const finishSwipe = (event) => {
    if (!swipeStart.current || !event.changedTouches[0]) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.current.x;
    const deltaY = touch.clientY - swipeStart.current.y;
    swipeStart.current = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2)
      return;
    move(deltaX < 0 ? 1 : -1);
  };
  const chooseDate = (value) => {
    const [nextYear, nextMonth, nextDay] = value.split("-").map(Number);
    if (!nextYear || !nextMonth || !nextDay) return;
    const date = new Date(nextYear, nextMonth - 1, nextDay);
    setCursor(date);
    setSelectedDay(view === "month" ? date : null);
  };
  const renderEvent = (event) => (
    <article
      className="agenda-event"
      key={event.id}
      style={{ "--event": event.assigneeColor || event.color }}
      onClick={() => setSelectedDay(new Date(event.startAt))}
    >
      <span>
        <DynamicIcon name={event.assigneeIcon || event.icon} />
      </span>
      <div>
        <strong>{event.title}</strong>
        <small>
          {event.assigneeName || "ללא אחראי"} · {event.type}
        </small>
      </div>
      <time>
        {new Date(event.startAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
    </article>
  );
  const viewChoices = [
    ["day", "1", "יום"],
    ["week", "7", "שבוע"],
    ["month", "30", "חודש"],
    ["monthDetail", "31", "חודש מפורט"],
    ["year", "365", "שנה"],
  ];
  const navigationUnit =
    view === "day"
      ? "יום"
      : view === "week"
        ? "שבוע"
        : view === "year"
          ? "שנה"
          : "חודש";
  const weekdayNames = [
    ["ראשון", "א׳"],
    ["שני", "ב׳"],
    ["שלישי", "ג׳"],
    ["רביעי", "ד׳"],
    ["חמישי", "ה׳"],
    ["שישי", "ו׳"],
    ["שבת", "ש׳"],
  ];
  return (
    <div
      className="ops-page calendar-workspace"
      tabIndex="0"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") move(1);
        if (event.key === "ArrowRight") move(-1);
        if (event.key.toLowerCase() === "t") setCursor(new Date());
      }}
    >
      <div className="ops-hero">
        <div>
          <span className="ops-eyebrow">
            <CalendarDays size={15} />
            תכנון וביצוע
          </span>
          <h2>לוח שנה תפעולי</h2>
          <p>כל ההיסטוריה, המשימות, הביקורות ואבני הדרך מתעדכנות אוטומטית.</p>
        </div>
        {canCreate && (
          <button className="ops-primary" onClick={() => setCreating(true)}>
            <Plus size={17} />
            אירוע חדש
          </button>
        )}
      </div>
      <section
        className="calendar-shell panel"
        onTouchStart={beginSwipe}
        onTouchEnd={finishSwipe}
        onTouchCancel={() => {
          swipeStart.current = null;
        }}
      >
        <header className="calendar-toolbar">
          <div className="calendar-navigation">
            <button
              onClick={() => move(-1)}
              title={`${navigationUnit} קודם`}
              aria-label={`${navigationUnit} קודם`}
            >
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setCursor(new Date())}>היום</button>
            <button
              onClick={() => move(1)}
              title={`${navigationUnit} הבא`}
              aria-label={`${navigationUnit} הבא`}
            >
              <ArrowLeft size={18} />
            </button>
            <label className="calendar-date-picker" title="בחירת תאריך">
              <CalendarDays size={15} />
              <span>בחירת תאריך</span>
              <input
                type="date"
                value={localKey(cursor)}
                onChange={(event) => chooseDate(event.target.value)}
                aria-label="מעבר לתאריך"
              />
            </label>
          </div>
          <div className="calendar-title">
            <h3>{rangeTitle}</h3>
            <span>
              <i />
              מתעדכן אוטומטית
              {lastUpdated &&
                ` · ${lastUpdated.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
          <div className="calendar-view-switch">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="">כל הפרויקטים</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {viewChoices.map(([id, label, title]) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                onClick={() => setView(id)}
                title={title}
                aria-label={`תצוגת ${title}`}
              >
                {label}
              </button>
            ))}
            <button onClick={load} aria-label="רענון">
              <RefreshCw size={15} />
            </button>
          </div>
        </header>
        {view === "month" && (
          <>
            <div className="calendar-weekdays">
              {weekdayNames.map(([full, short]) => (
                <span key={full}>
                  <b className="weekday-full">{full}</b>
                  <b className="weekday-short">{short}</b>
                </span>
              ))}
            </div>
            <div className="calendar-grid">
              {days.map((day) => {
                const key = localKey(day),
                  dayEvents = eventMap[key] || [],
                  outside = day.getMonth() !== month,
                  today = key === localKey(new Date());
                return (
                  <button
                    key={key}
                    className={`${outside ? "outside" : ""} ${today ? "today" : ""} ${selectedDay && key === localKey(selectedDay) ? "selected" : ""}`}
                    onClick={() => setSelectedDay(day)}
                  >
                    <time>{day.getDate()}</time>
                    <div>
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          style={{
                            "--event": event.assigneeColor || event.color,
                          }}
                          title={event.title}
                        >
                          <i />
                          {event.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && (
                        <em>+{dayEvents.length - 3} נוספים</em>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {view === "week" && (
          <div className="calendar-week-view">
            {weekDays.map((day) => {
              const key = localKey(day);
              return (
                <section
                  key={key}
                  className={key === localKey(new Date()) ? "today" : ""}
                >
                  <header>
                    <span>
                      {day.toLocaleDateString("he-IL", { weekday: "short" })}
                    </span>
                    <strong>{day.getDate()}</strong>
                  </header>
                  <div>
                    {(eventMap[key] || []).map(renderEvent)}
                    {!(eventMap[key] || []).length && (
                      <small>אין אירועים</small>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {view === "day" && (
          <div className="calendar-day-view">
            <header>
              <strong>{cursor.getDate()}</strong>
              <span>
                {cursor.toLocaleDateString("he-IL", {
                  weekday: "long",
                  month: "long",
                })}
              </span>
            </header>
            <div>
              {(eventMap[localKey(cursor)] || []).length ? (
                (eventMap[localKey(cursor)] || []).map(renderEvent)
              ) : (
                <InlineEmpty text="אין פעולות מתוכננות ליום זה" />
              )}
            </div>
          </div>
        )}
        {view === "monthDetail" && (
          <div className="calendar-agenda">
            {monthDays.map((day) => {
              const dayEvents = eventMap[localKey(day)] || [];
              if (!dayEvents.length) return null;
              return (
                <section key={localKey(day)}>
                  <header>
                    <strong>
                      {day.toLocaleDateString("he-IL", { weekday: "long" })}
                    </strong>
                    <span>
                      {day.toLocaleDateString("he-IL", {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                  </header>
                  <div>{dayEvents.map(renderEvent)}</div>
                </section>
              );
            })}
            {!events.length && <InlineEmpty text="אין היסטוריה בחודש זה" />}
          </div>
        )}
        {view === "year" && (
          <div className="calendar-year-view">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const count = events.filter(
                (event) => new Date(event.startAt).getMonth() === monthIndex,
              ).length;
              return (
                <button
                  key={monthIndex}
                  onClick={() => {
                    setCursor(new Date(year, monthIndex, 1));
                    setView("month");
                  }}
                >
                  <span>
                    {new Date(year, monthIndex, 1).toLocaleDateString("he-IL", {
                      month: "long",
                    })}
                  </span>
                  <strong>{count}</strong>
                  <small>אירועים</small>
                  <i style={{ "--fill": `${Math.min(count * 8, 100)}%` }} />
                </button>
              );
            })}
          </div>
        )}
      </section>
      {selectedDay && (
        <aside className="day-drawer panel">
          <div className="day-drawer-head">
            <div>
              <span>
                {selectedDay.toLocaleDateString("he-IL", { weekday: "long" })}
              </span>
              <h3>
                {selectedDay.toLocaleDateString("he-IL", {
                  day: "numeric",
                  month: "long",
                })}
              </h3>
            </div>
            <button onClick={() => setSelectedDay(null)}>
              <X size={18} />
            </button>
          </div>
          {chosenEvents.length ? (
            chosenEvents.map(renderEvent)
          ) : (
            <InlineEmpty text="אין אירועים ביום זה" />
          )}
        </aside>
      )}
      {creating && (
        <CalendarEventModal
          api={api}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
          setNotice={setNotice}
        />
      )}
    </div>
  );
}

function CalendarEventModal({ api, onClose, onDone, setNotice }) {
  const [form, setForm] = useState({
    title: "",
    startAt: new Date().toISOString().slice(0, 16),
    type: "general",
    notes: "",
    color: "#6957df",
    allDay: true,
    projectId: "",
    assigneeId: "",
  });
  const [options, setOptions] = useState({ projects: [], users: [] });
  useEffect(() => {
    api("/calendar-options")
      .then(setOptions)
      .catch((error) => setNotice(error.message));
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    try {
      await api("/calendar", { method: "POST", body: JSON.stringify(form) });
      setNotice("האירוע נוסף ללוח השנה");
      onDone();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <div className="ops-modal-backdrop" onMouseDown={onClose}>
      <div
        className="ops-modal compact"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ops-modal-title">
          <div>
            <span>לוח שנה</span>
            <h2>אירוע חשוב חדש</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="ops-form-grid">
            <label className="wide">
              כותרת
              <input
                autoFocus
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              מועד
              <input
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </label>
            <label>
              סוג
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="general">כללי</option>
                <option value="meeting">פגישה</option>
                <option value="delivery">אספקה</option>
                <option value="installation">התקנה</option>
                <option value="payment">תשלום</option>
              </select>
            </label>
            <label>
              פרויקט
              <select
                value={form.projectId}
                onChange={(e) =>
                  setForm({ ...form, projectId: e.target.value })
                }
              >
                <option value="">ללא שיוך</option>
                {options.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              אחראי
              <select
                value={form.assigneeId}
                onChange={(e) =>
                  setForm({ ...form, assigneeId: e.target.value })
                }
              >
                <option value="">ללא אחראי</option>
                {options.users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              צבע
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </label>
            <label className="wide">
              הערות
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="ops-modal-actions">
            <button type="button" className="ops-ghost" onClick={onClose}>
              ביטול
            </button>
            <button className="ops-primary">
              <Check size={16} />
              הוספה ללוח
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ClientsWorkspace({
  api,
  apiRoot,
  user,
  setNotice,
  onDataChanged,
}) {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem("projects-client-view") || "table",
  );
  const [sortMode, setSortMode] = useState("name-asc");
  const [configuration, setConfiguration] = useState({
    customFields: [],
    catalogs: [],
  });
  const canManage = ["admin", "manager"].includes(user.role);
  const canExecute = ["admin", "manager", "technician"].includes(user.role);

  const loadClients = async (value = query) => {
    setLoading(true);
    try {
      const result = await api(`/clients?q=${encodeURIComponent(value)}`);
      setClients(result.clients);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };
  const loadDetail = async (id) => {
    try {
      setDetail(await api(`/clients/${id}`));
      setSelectedId(id);
    } catch (error) {
      setNotice(error.message);
    }
  };
  useEffect(() => {
    const timer = setTimeout(() => loadClients(query), 240);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    api("/settings")
      .then(setConfiguration)
      .catch((error) => setNotice(error.message));
  }, []);
  useEffect(() => {
    const live = () => {
      loadClients();
      if (selectedId) loadDetail(selectedId);
    };
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, [selectedId, query]);
  const refresh = async () => {
    await loadClients();
    if (selectedId) await loadDetail(selectedId);
    await onDataChanged?.();
  };
  const createClient = async (form) => {
    try {
      const result = await api("/clients", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setNewOpen(false);
      setNotice("כרטיס הלקוח נוצר בהצלחה");
      await loadClients("");
      await onDataChanged?.();
      await loadDetail(result.client.id);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        sortMode === "name-desc"
          ? b.name.localeCompare(a.name, "he")
          : sortMode === "newest"
            ? new Date(b.createdAt) - new Date(a.createdAt)
            : sortMode === "oldest"
              ? new Date(a.createdAt) - new Date(b.createdAt)
              : a.name.localeCompare(b.name, "he"),
      ),
    [clients, sortMode],
  );
  const chooseView = (next) => {
    setViewMode(next);
    localStorage.setItem("projects-client-view", next);
  };

  if (selectedId && detail)
    return (
      <ClientDetail
        data={detail}
        api={api}
        apiRoot={apiRoot}
        canManage={canManage}
        canExecute={canExecute}
        isAdmin={user.role === "admin"}
        configuration={configuration}
        onBack={() => {
          setSelectedId(null);
          setDetail(null);
        }}
        onDeleted={() => {
          setSelectedId(null);
          setDetail(null);
          loadClients();
        }}
        onRefresh={refresh}
        setNotice={setNotice}
      />
    );

  return (
    <div className={`ops-page clients-workspace clients-${viewMode}-view`}>
      <div className="ops-hero">
        <div>
          <span className="ops-eyebrow">
            <Users size={15} />
            מרכז לקוחות
          </span>
          <h2>כל הקשרים, המסמכים והביצוע במקום אחד</h2>
          <p>חיפוש חכם לפי שם, שם משפחה, כתובת, טלפון, מייל, תג או דגל.</p>
        </div>
        {canManage && (
          <button className="ops-primary" onClick={() => setNewOpen(true)}>
            <Plus size={18} />
            לקוח חדש
          </button>
        )}
      </div>
      <div className="client-command panel">
        <label>
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש לקוח, כתובת, טלפון, תג או דגל..."
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="ניקוי חיפוש">
              <X size={16} />
            </button>
          )}
        </label>
        <div className="client-list-controls">
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="name-asc">א׳–ת׳</option>
            <option value="name-desc">ת׳–א׳</option>
            <option value="newest">חדש לישן</option>
            <option value="oldest">ישן לחדש</option>
          </select>
          <div>
            <button
              className={viewMode === "table" ? "active" : ""}
              onClick={() => chooseView("table")}
              title="טבלה"
            >
              <List size={17} />
            </button>
            <button
              className={viewMode === "board" ? "active" : ""}
              onClick={() => chooseView("board")}
              title="לוח"
            >
              <LayoutGrid size={17} />
            </button>
          </div>
          <b>{clients.length} לקוחות</b>
        </div>
      </div>
      {!loading && clients.length > 0 && viewMode === "table" && (
        <div className="panel clients-compact-table">
          <header>
            <span>שם</span>
            <span>שם משפחה</span>
            <span>כתובת</span>
            <span>פרויקטים</span>
            <span>נייד</span>
            <span />
          </header>
          {sortedClients.map((client) => (
            <button key={client.id} onClick={() => loadDetail(client.id)}>
              <span>
                <i>{initials(client.name)}</i>
                <strong>{client.firstName || client.name}</strong>
              </span>
              <span><strong>{client.lastName || "—"}</strong></span>
              <span>
                <MapPin size={14} />
                {client.address}
                {client.apartmentNumber && ` · דירה ${client.apartmentNumber}`}
              </span>
              <span>
                <BriefcaseBusiness size={14} />
                {client.projectCount}
              </span>
              <a
                href={`tel:${client.phone}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Phone size={14} />
                {client.phone}
              </a>
              <ChevronLeft size={17} />
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="ops-skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} />
          ))}
        </div>
      ) : clients.length && viewMode === "board" ? (
        <div className="operational-client-grid">
          {sortedClients.map((client) => (
            <button
              className="operational-client-card"
              key={client.id}
              onClick={() => loadDetail(client.id)}
            >
              <div className="client-card-accent" />
              <div className="client-card-head">
                <span className="large-avatar">{initials(client.name)}</span>
                <div>
                  <small>
                    {client.code} ·{" "}
                    {client.clientType === "business" ? "עסקי" : "פרטי"}
                  </small>
                  <h3>{client.name}</h3>
                </div>
                <ChevronLeft size={20} />
              </div>
              <div className="client-card-contact">
                <span>
                  <MapPin size={14} />
                  {client.address}
                </span>
                <span>
                  <Phone size={14} />
                  {client.phone}
                </span>
                {client.email && (
                  <a href={`mailto:${client.email}`} onClick={(event)=>event.stopPropagation()}>
                    <Mail size={14} />
                    {client.email}
                  </a>
                )}
              </div>
              <div className="label-strip">
                {client.labels.slice(0, 4).map((label) => (
                  <em key={label.id} style={{ "--label": label.color }}>
                    <DynamicIcon name={label.icon} size={12} />
                    {label.name}
                  </em>
                ))}
              </div>
              <div className="client-card-foot">
                <span>
                  <BriefcaseBusiness size={14} />
                  <b>{client.projectCount}</b> פרויקטים
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : !clients.length ? (
        <div className="ops-empty panel">
          <div>
            <Search size={28} />
          </div>
          <h3>לא נמצאו לקוחות</h3>
          <p>נסו מונח אחר או צרו כרטיס לקוח חדש.</p>
        </div>
      ) : null}
      {newOpen && (
        <ClientFormModal
          api={api}
          configuration={configuration}
          onClose={() => setNewOpen(false)}
          onSubmit={createClient}
        />
      )}
    </div>
  );
}

function ClientFormModal({
  api,
  onClose,
  onSubmit,
  initial,
  configuration = { customFields: [], catalogs: [] },
}) {
  const base = initial || {
    firstName: "",
    lastName: "",
    name: "",
    address: "",
    apartmentNumber: "",
    phone: "",
    email: "",
    city: "",
    priorityCustomerNumber: "",
    referralSource: "",
    primaryContactName: "",
    clientType: "private",
    notes: "",
    additionalPhones: [],
    additionalEmails: [],
    customValues: {},
    labels: [],
  };
  const [form, setForm] = useState({
    ...base,
    additionalPhonesText: (base.additionalPhones || []).join(", "),
    additionalEmailsText: (base.additionalEmails || []).join(", "),
    labelIds: (base.labels || []).map((item) => item.id),
  });
  const [saving, setSaving] = useState(false);
  const customFields = configuration.customFields.filter(
    (field) => field.entityType === "client" && field.active && !["priorityCustomerNumber","priority_customer_number"].includes(field.fieldKey),
  );
  const labels = configuration.catalogs.filter(
    (item) => ["tag", "flag"].includes(item.category) && item.active,
  );
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        additionalPhones: form.additionalPhonesText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        additionalEmails: form.additionalEmailsText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="ops-modal-backdrop" onMouseDown={onClose}>
      <div
        className="ops-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ops-modal-title">
          <div>
            <span>כרטיס לקוח</span>
            <h2>{initial ? "עריכת פרטי לקוח" : "לקוח חדש"}</h2>
            <p>שם פרטי, שם משפחה, כתובת וטלפון הם שדות חובה.</p>
          </div>
          <button onClick={onClose} aria-label="סגירה">
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="ops-form-grid">
            <label>
              שם פרטי <b>חובה</b>
              <input
                autoFocus
                required
                value={form.firstName || ""}
                onChange={(event) =>
                  setForm({ ...form, firstName: event.target.value })
                }
              />
            </label>
            <label>
              שם משפחה <b>חובה</b>
              <input required value={form.lastName || ""} onChange={(event)=>setForm({...form,lastName:event.target.value})}/>
            </label>
            <AddressAutocomplete
              api={api}
              className="wide"
              required
              value={form.address}
              onChange={(address) =>
                setForm((current) => ({ ...current, address }))
              }
              onSelect={(item) =>
                setForm((current) => ({
                  ...current,
                  address: item.address,
                  city: item.city || current.city,
                }))
              }
            />
            <label>
              מספר דירה
              <input inputMode="numeric" value={form.apartmentNumber || ""} onChange={(event)=>setForm({...form,apartmentNumber:event.target.value})}/>
            </label>
            <label>
              עיר
              <input
                value={form.city || ""}
                onChange={(event) =>
                  setForm({ ...form, city: event.target.value })
                }
              />
            </label>
            <label>
              מספר לקוח בפריוריטי
              <input
                value={form.priorityCustomerNumber || ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    priorityCustomerNumber: event.target.value,
                  })
                }
              />
            </label>
            <label>
              גורם מפנה
              <input value={form.referralSource || ""} onChange={(event)=>setForm({...form,referralSource:event.target.value})} placeholder="אדריכל, מפקח, לקוח קיים או מקור אחר"/>
            </label>
            <label>
              טלפון <b>חובה</b>
              <input
                required
                inputMode="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder="050-0000000"
              />
            </label>
            <label>
              טלפונים נוספים
              <input
                value={form.additionalPhonesText}
                onChange={(event) =>
                  setForm({ ...form, additionalPhonesText: event.target.value })
                }
                placeholder="מופרדים בפסיק"
              />
            </label>
            <label>
              דוא״ל
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder="name@example.com"
              />
            </label>
            <label>
              מיילים נוספים
              <input
                value={form.additionalEmailsText}
                onChange={(event) =>
                  setForm({ ...form, additionalEmailsText: event.target.value })
                }
                placeholder="מופרדים בפסיק"
              />
            </label>
            <label>
              איש קשר ראשי
              <input
                value={form.primaryContactName}
                onChange={(event) =>
                  setForm({ ...form, primaryContactName: event.target.value })
                }
              />
            </label>
            <label>
              סוג לקוח
              <select
                value={form.clientType}
                onChange={(event) =>
                  setForm({ ...form, clientType: event.target.value })
                }
              >
                <option value="private">פרטי</option>
                <option value="business">עסקי</option>
              </select>
            </label>
            {customFields.map((field) => (
              <label key={field.id}>
                {field.label}
                {field.required && <b>חובה</b>}
                <input
                  type={
                    field.fieldType === "number"
                      ? "number"
                      : field.fieldType === "date"
                        ? "date"
                        : field.fieldType === "email"
                          ? "email"
                          : field.fieldType === "phone"
                            ? "tel"
                            : "text"
                  }
                  required={field.required}
                  value={form.customValues?.[field.fieldKey] ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      customValues: {
                        ...form.customValues,
                        [field.fieldKey]: event.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
            {labels.length > 0 && (
              <div className="wide client-label-picker">
                <span>תגיות ודגלים</span>
                <div>
                  {labels.map((label) => (
                    <button
                      type="button"
                      key={label.id}
                      className={
                        form.labelIds.includes(label.id) ? "selected" : ""
                      }
                      style={{ "--label": label.color }}
                      onClick={() =>
                        setForm({
                          ...form,
                          labelIds: form.labelIds.includes(label.id)
                            ? form.labelIds.filter((id) => id !== label.id)
                            : [...form.labelIds, label.id],
                        })
                      }
                    >
                      <DynamicIcon name={label.icon} size={13} />
                      {label.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="wide">
              הערות פתיחה
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                placeholder="מידע שחשוב לצוות לדעת כבר בתחילת הדרך"
              />
            </label>
          </div>
          <div className="ops-modal-actions">
            <button type="button" className="ops-ghost" onClick={onClose}>
              ביטול
            </button>
            <button className="ops-primary" disabled={saving}>
              {saving ? (
                <RefreshCw className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}{" "}
              {saving ? "שומר..." : initial ? "שמירת שינויים" : "יצירת כרטיס"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LegacyClientFormModal({
  onClose,
  onSubmit,
  initial,
  configuration = { customFields: [], catalogs: [] },
}) {
  const base = initial || {
    name: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    priorityCustomerNumber: "",
    primaryContactName: "",
    clientType: "private",
    notes: "",
    additionalPhones: [],
    additionalEmails: [],
    customValues: {},
    labels: [],
  };
  const [form, setForm] = useState({
    ...base,
    additionalPhonesText: (base.additionalPhones || []).join(", "),
    additionalEmailsText: (base.additionalEmails || []).join(", "),
    labelIds: (base.labels || []).map((item) => item.id),
  });
  const [saving, setSaving] = useState(false);
  const customFields = configuration.customFields.filter(
    (field) => field.entityType === "client" && field.active,
  );
  const labels = configuration.catalogs.filter(
    (item) => ["tag", "flag"].includes(item.category) && item.active,
  );
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    await onSubmit({
      ...form,
      additionalPhones: form.additionalPhonesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      additionalEmails: form.additionalEmailsText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    });
    setSaving(false);
  };
  return (
    <div className="ops-modal-backdrop" onMouseDown={onClose}>
      <div
        className="ops-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ops-modal-title">
          <div>
            <span>כרטיס לקוח</span>
            <h2>{initial ? "עריכת פרטי לקוח" : "לקוח חדש"}</h2>
            <p>שם, כתובת וטלפון הם שדות החובה היחידים.</p>
          </div>
          <button onClick={onClose} aria-label="סגירה">
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="ops-form-grid">
            <label className="wide">
              שם לקוח <b>חובה</b>
              <input
                autoFocus
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="משפחת ישראלי / שם חברה"
              />
            </label>
            <label className="wide">
              כתובת <b>חובה</b>
              <input
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="רחוב, מספר, עיר"
              />
            </label>
            <label>
              טלפון <b>חובה</b>
              <input
                required
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-0000000"
              />
            </label>
            <label>
              טלפונים נוספים
              <input
                value={form.additionalPhonesText}
                onChange={(e) =>
                  setForm({ ...form, additionalPhonesText: e.target.value })
                }
                placeholder="מופרדים בפסיק"
              />
            </label>
            <label>
              דוא״ל
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
              />
            </label>
            <label>
              מיילים נוספים
              <input
                value={form.additionalEmailsText}
                onChange={(e) =>
                  setForm({ ...form, additionalEmailsText: e.target.value })
                }
                placeholder="מופרדים בפסיק"
              />
            </label>
            <label>
              איש קשר ראשי
              <input
                value={form.primaryContactName}
                onChange={(e) =>
                  setForm({ ...form, primaryContactName: e.target.value })
                }
              />
            </label>
            <label>
              סוג לקוח
              <select
                value={form.clientType}
                onChange={(e) =>
                  setForm({ ...form, clientType: e.target.value })
                }
              >
                <option value="private">פרטי</option>
                <option value="business">עסקי</option>
              </select>
            </label>
            {customFields.map((field) => (
              <label key={field.id}>
                {field.label}
                {field.required && <b>חובה</b>}
                <input
                  type={
                    field.fieldType === "number"
                      ? "number"
                      : field.fieldType === "date"
                        ? "date"
                        : field.fieldType === "email"
                          ? "email"
                          : field.fieldType === "phone"
                            ? "tel"
                            : "text"
                  }
                  required={field.required}
                  value={form.customValues?.[field.fieldKey] ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customValues: {
                        ...form.customValues,
                        [field.fieldKey]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
            {labels.length > 0 && (
              <div className="wide client-label-picker">
                <span>תגיות ודגלים</span>
                <div>
                  {labels.map((label) => (
                    <button
                      type="button"
                      key={label.id}
                      className={
                        form.labelIds.includes(label.id) ? "selected" : ""
                      }
                      style={{ "--label": label.color }}
                      onClick={() =>
                        setForm({
                          ...form,
                          labelIds: form.labelIds.includes(label.id)
                            ? form.labelIds.filter((id) => id !== label.id)
                            : [...form.labelIds, label.id],
                        })
                      }
                    >
                      <DynamicIcon name={label.icon} size={13} />
                      {label.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="wide">
              הערות פתיחה
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="מידע שחשוב לצוות לדעת כבר בתחילת הדרך"
              />
            </label>
          </div>
          <div className="ops-modal-actions">
            <button type="button" className="ops-ghost" onClick={onClose}>
              ביטול
            </button>
            <button className="ops-primary" disabled={saving}>
              {saving ? (
                <RefreshCw className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}
              {saving ? "שומר..." : initial ? "שמירת שינויים" : "יצירת כרטיס"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientDetail({
  data,
  api,
  apiRoot,
  canManage,
  canExecute,
  isAdmin,
  configuration,
  onBack,
  onDeleted,
  onRefresh,
  setNotice,
}) {
  const {
    client,
    contacts,
    tasks,
    inspections,
    files,
    projects,
    equipment = [],
  } = data;
  const [tab, setTab] = useState("overview");
  const [action, setAction] = useState(null);
  const [contactView, setContactView] = useState(
    () => localStorage.getItem("projects-contact-view") || "compact",
  );
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(client);
  const openTasks = tasks.filter((task) => task.status !== "done");
  useEffect(() => {
    localStorage.setItem("projects-contact-view", contactView);
  }, [contactView]);
  const saveClient = async () => {
    try {
      await api(`/clients/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditing(false);
      setNotice("פרטי הלקוח נשמרו");
      onRefresh();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const deleteClient = async () => {
    if (!window.confirm(`למחוק את ${client.name}? הפעולה תתועד ב-Audit Log.`))
      return;
    try {
      await api(`/clients/${client.id}`, { method: "DELETE" });
      setNotice("כרטיס הלקוח נמחק");
      onDeleted();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const completeTask = async (task) => {
    try {
      await api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: task.status === "done" ? "open" : "done",
        }),
      });
      setNotice(task.status === "done" ? "המשימה נפתחה מחדש" : "המשימה הושלמה");
      onRefresh();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <div className="ops-page client-detail">
      <div className="client-detail-top">
        <button className="ops-back" onClick={onBack}>
          <ArrowLeft size={17} />
          חזרה לכל הלקוחות
        </button>
        <div className="client-report-actions">
          {isAdmin && (
            <button className="ops-danger" onClick={deleteClient}>
              <Trash2 size={15} />
              מחיקת לקוח
            </button>
          )}
        </div>
      </div>
      <section className="client-profile-hero panel">
        <div className="profile-glow" />
        <div className="profile-main">
          <span className="profile-avatar">{initials(client.name)}</span>
          <div>
            <span className="ops-eyebrow">{client.code}</span>
            <h2>{client.name}</h2>
            <p>
              <MapPin size={14} />
              {client.address}
              {client.apartmentNumber && ` · דירה ${client.apartmentNumber}`}
            </p>
          </div>
        </div>
        <div className="profile-actions">
          {canManage && (
            <button className="ops-secondary" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              עריכה
            </button>
          )}
          <a className="ops-primary" href={`tel:${client.phone}`}>
            <Phone size={16} />
            חיוג
          </a>
        </div>
        <div className="profile-meta">
          <span>
            <Phone />
            טלפון<strong>{client.phone}</strong>
          </span>
          <a href={client.email ? `mailto:${client.email}` : undefined}>
            <Mail />
            דוא״ל<strong>{client.email || "לא הוגדר"}</strong>
          </a>
          <span>
            <BriefcaseBusiness />
            פרויקטים<strong>{projects.length}</strong>
          </span>
        </div>
        <div className="label-strip profile-labels">
          {client.labels.map((label) => (
            <em key={label.id} style={{ "--label": label.color }}>
              <DynamicIcon name={label.icon} size={13} />
              {label.name}
            </em>
          ))}
          {!client.labels.length && <span>אין תגיות או דגלים</span>}
        </div>
      </section>
      {client.priorityCustomerNumber && (
        <div className="priority-customer-number">
          <span>מספר לקוח בפריוריטי</span>
          <strong>{client.priorityCustomerNumber}</strong>
        </div>
      )}
      <nav className="ops-tabs">
        {[
          ["overview", "סקירה", Activity],
          ["contacts", "אנשי קשר", Users],
          ["systems", "מערכות", Package],
          ["inspections", "ביקורות אתר", ShieldCheck],
          ["files", "קבצים", FolderOpen],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setAction(null);
            }}
          >
            <Icon size={16} />
            {label}
            <em>
              {id === "contacts"
                ? contacts.length
                : id === "systems"
                  ? equipment.length
                : id === "inspections"
                      ? inspections.length
                      : id === "files"
                        ? files.length
                        : projects.length}
            </em>
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <div className="ops-detail-grid">
          <div className="panel ops-section">
            <SectionTitle
              icon={BriefcaseBusiness}
              title="פרויקטים משויכים"
              action={projects.length ? `${projects.length} פרויקטים` : ""}
            />
            {projects.length ? (
              projects.map((project) => (
                <div className="project-link-row" key={project.id}>
                  <span
                    className="mini-status"
                    style={{ "--progress": `${project.progress}%` }}
                  >
                    <i />
                  </span>
                  <div>
                    <strong>{project.name}</strong>
                    <small>
                      {project.id} · {project.stage}
                    </small>
                  </div>
                  <b>{project.progress}%</b>
                </div>
              ))
            ) : (
              <InlineEmpty text="אין עדיין פרויקט משויך ללקוח" />
            )}
          </div>
          <aside>
            <div className="panel ops-section note-card">
              <SectionTitle icon={FileText} title="הערות לקוח" />
              <p>{client.notes || "אין הערות בכרטיס זה."}</p>
            </div>
          </aside>
        </div>
      )}
      {tab === "contacts" && (
        <div className="panel ops-section">
          <SectionTitle
            icon={Users}
            title="אנשי קשר וגורמים מקצועיים"
            button={
              <div className="section-title-actions">
                <div className="view-toggle">
                  <button
                    className={contactView === "compact" ? "active" : ""}
                    onClick={() => setContactView("compact")}
                    title="רשימה צרה"
                  >
                    <List size={15} />
                  </button>
                  <button
                    className={contactView === "cards" ? "active" : ""}
                    onClick={() => setContactView("cards")}
                    title="כרטיסים"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>
                {canManage && (
                  <button
                    className="ops-primary small"
                    onClick={() =>
                      setAction(action === "contact" ? null : "contact")
                    }
                  >
                    <Plus size={15} />
                    איש קשר
                  </button>
                )}
              </div>
            }
          />
          {action === "contact" && (
            <ContactForm
              clientId={client.id}
              api={api}
              onDone={() => {
                setAction(null);
                onRefresh();
              }}
              setNotice={setNotice}
            />
          )}
          {contacts.length ? (
            <div className={`contacts-table ${contactView}`}>
              {contactView === "compact" && (
                <div className="contacts-list-head">
                  <span>שם</span>
                  <span>טלפון</span>
                  <span>תפקיד</span>
                  <span>דוא״ל</span>
                </div>
              )}
              {contacts.map((contact) => (
                <div className="contact-row" key={contact.id}>
                  <span className="contact-role-icon">
                    <UserRound size={17} />
                  </span>
                  <div className="contact-name">
                    <strong>
                      {contact.name}
                      {contact.isReferrer && (
                        <em>
                          <Star size={11} />
                          מפנה
                        </em>
                      )}
                    </strong>
                    {contact.company && <small>{contact.company}</small>}
                  </div>
                  <a
                    className="contact-phone"
                    href={contact.phone ? "tel:" + contact.phone : undefined}
                  >
                    <Phone size={14} />
                    {contact.phone || "ללא טלפון"}
                  </a>
                  <span className="contact-role">
                    {roleNames[contact.role] || contact.role || "ללא תפקיד"}
                  </span>
                  <a
                    className="contact-email"
                    href={contact.email ? "mailto:" + contact.email : undefined}
                  >
                    <Mail size={14} />
                    {contact.email || "ללא מייל"}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <InlineEmpty text="עדיין לא נוספו אנשי קשר" />
          )}
        </div>
      )}
      {tab === "systems" && (
        <div className="panel ops-section">
          <SectionTitle
            icon={Package}
            title="מערכות וציוד אצל הלקוח"
            action={`${equipment.reduce((sum, item) => sum + Number(item.quantity), 0)} יחידות`}
            button={
              canExecute && (
                <button
                  className="ops-primary small"
                  onClick={() =>
                    setAction(action === "equipment" ? null : "equipment")
                  }
                >
                  <Plus size={15} />
                  שיוך מערכת
                </button>
              )
            }
          />
          {action === "equipment" && (
            <ClientEquipmentForm
              clientId={client.id}
              api={api}
              onDone={() => {
                setAction(null);
                onRefresh();
              }}
              setNotice={setNotice}
            />
          )}
          <div className="client-equipment-list">
            {equipment.map((item) => (
              <article key={item.id}>
                <span className="equipment-custom-icon">
                  {item.icon_image_stored_name ? (
                    <img
                      src={`${apiRoot}/equipment-catalog/${item.catalog_item_id}/icon`}
                      alt=""
                    />
                  ) : (
                    <DynamicIcon name={item.icon} />
                  )}
                </span>
                <div>
                  <small>{item.category_name}</small>
                  <strong>{item.name}</strong>
                  <em>{item.location || "ללא מיקום"}</em>
                </div>
                <b>
                  {Number(item.quantity).toLocaleString("he-IL")} {item.unit}
                </b>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm(`להסיר את ${item.name}?`)) return;
                      await api(`/clients/${client.id}/equipment/${item.id}`, {
                        method: "DELETE",
                      });
                      onRefresh();
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </article>
            ))}
          </div>
          {!equipment.length && (
            <InlineEmpty text="עדיין לא שויכו מערכות ללקוח" />
          )}
        </div>
      )}
      {tab === "tasks" && (
        <div className="panel ops-section">
          <SectionTitle
            icon={ClipboardCheck}
            title="משימות לביצוע"
            button={
              canExecute && (
                <button
                  className="ops-primary small"
                  onClick={() => setAction(action === "task" ? null : "task")}
                >
                  <Plus size={15} />
                  משימה
                </button>
              )
            }
          />
          {action === "task" && (
            <TaskForm
              clientId={client.id}
              api={api}
              onDone={() => {
                setAction(null);
                onRefresh();
              }}
              setNotice={setNotice}
            />
          )}
          {tasks.length ? (
            <div className="task-list">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  className={`task-row ${task.status === "done" ? "done" : ""}`}
                  onClick={() => canExecute && completeTask(task)}
                >
                  <span className="task-check">
                    {task.status === "done" && <Check size={14} />}
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.description || "ללא תיאור"}</small>
                  </div>
                  <em className={`priority ${task.priority}`}>
                    {task.priority}
                  </em>
                  <span>
                    <CalendarDays size={13} />
                    {formatDate(task.due_date)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <InlineEmpty text="אין משימות בכרטיס זה" />
          )}
        </div>
      )}
      {tab === "inspections" && (
        <div className="panel ops-section">
          <SectionTitle
            icon={ShieldCheck}
            title="ביקורות אתר"
            button={
              canExecute && (
                <button
                  className="ops-primary small"
                  onClick={() =>
                    setAction(action === "inspection" ? null : "inspection")
                  }
                >
                  <Plus size={15} />
                  ביקורת חדשה
                </button>
              )
            }
          />
          {action === "inspection" && (
            <InspectionForm
              clientId={client.id}
              api={api}
              onDone={() => {
                setAction(null);
                onRefresh();
              }}
              setNotice={setNotice}
            />
          )}
          {inspections.length ? (
            <div className="inspection-grid">
              {inspections.map((item) => (
                <article key={item.id}>
                  <div>
                    <ShieldCheck size={20} />
                    <span className={`inspection-state ${item.status}`}>
                      {item.status}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.notes || "ללא הערות מסכמות"}</p>
                  <footer>
                    <span>
                      <CalendarDays size={13} />
                      {formatDate(item.inspection_date)}
                    </span>
                    <b>
                      {item.score == null ? "טרם דורג" : `${item.score}/100`}
                    </b>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <InlineEmpty text="עדיין לא בוצעו ביקורות אתר" />
          )}
        </div>
      )}
      {tab === "files" && (
        <div className="panel ops-section">
          <SectionTitle
            icon={FolderOpen}
            title="קבצים, הזמנות ותוכניות"
            button={
              canExecute && (
                <button
                  className="ops-primary small"
                  onClick={() => setAction(action === "file" ? null : "file")}
                >
                  <Upload size={15} />
                  העלאת קובץ
                </button>
              )
            }
          />
          {action === "file" && (
            <FileUpload
              clientId={client.id}
              api={api}
              onDone={() => {
                setAction(null);
                onRefresh();
              }}
              setNotice={setNotice}
            />
          )}
          {files.length ? (
            <div className="file-grid">
              {files.map((file) => (
                <a
                  key={file.id}
                  target="_blank"
                  rel="noreferrer"
                  href={
                    file.storage_area === "clients"
                      ? `${apiRoot}/files/${file.id}/download`
                      : `${apiRoot}/documents/${file.id}/preview`
                  }
                >
                  <span>
                    <FileText size={20} />
                  </span>
                  <div>
                    <strong>{file.title || file.original_name}</strong>
                    <small>
                      {file.category} · {bytes(Number(file.size_bytes))} ·{" "}
                      {formatDate(file.created_at)}
                    </small>
                  </div>
                  <Eye size={17} />
                </a>
              ))}
            </div>
          ) : (
            <InlineEmpty text="אין קבצים בכרטיס זה" />
          )}
        </div>
      )}
      {editing && (
        <ClientFormModal
          api={api}
          configuration={configuration}
          initial={editForm}
          onClose={() => setEditing(false)}
          onSubmit={async (form) => {
            setEditForm(form);
            try {
              await api(`/clients/${client.id}`, {
                method: "PATCH",
                body: JSON.stringify(form),
              });
              setEditing(false);
              setNotice("פרטי הלקוח נשמרו");
              onRefresh();
            } catch (error) {
              setNotice(error.message);
            }
          }}
        />
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, action, button }) {
  return (
    <div className="ops-section-title">
      <div>
        <span>
          <Icon size={17} />
        </span>
        <h3>{title}</h3>
        {action && <small>{action}</small>}
      </div>
      {button}
    </div>
  );
}
function InlineEmpty({ text }) {
  return (
    <div className="inline-empty">
      <Archive size={22} />
      <span>{text}</span>
    </div>
  );
}
function ContactMini({ contact }) {
  return (
    <div className="contact-mini">
      <span>{initials(contact.name)}</span>
      <div>
        <strong>{contact.name}</strong>
        <small>
          {roleNames[contact.role] || contact.role}
          {contact.company && ` · ${contact.company}`}
        </small>
      </div>
      {contact.phone && (
        <a href={`tel:${contact.phone}`}>
          <Phone size={14} />
        </a>
      )}
    </div>
  );
}

function ContactForm({ clientId, api, onDone, setNotice }) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    role: "architect",
    phone: "",
    email: "",
    isReferrer: false,
    notes: "",
  });
  const submit = async (event) => {
    event.preventDefault();
    try {
      await api(`/clients/${clientId}/contacts`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setNotice("איש הקשר נוסף");
      onDone();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <form className="inline-create" onSubmit={submit}>
      <label>
        שם
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </label>
      <label>
        תפקיד
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          {Object.entries(roleNames).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        חברה
        <input
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />
      </label>
      <label>
        טלפון
        <input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label>
        מייל
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={form.isReferrer}
          onChange={(e) => setForm({ ...form, isReferrer: e.target.checked })}
        />
        גורם מפנה
      </label>
      <button className="ops-primary small">
        <Check size={15} />
        שמירה
      </button>
    </form>
  );
}

function ClientEquipmentForm({ clientId, api, onDone, setNotice }) {
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState({
    catalogItemId: "",
    quantity: 1,
    location: "",
    notes: "",
  });
  useEffect(() => {
    api("/equipment-catalog")
      .then((result) => setCatalog(result.items))
      .catch((error) => setNotice(error.message));
  }, []);
  const categories = catalog.filter(
    (item) => item.itemType === "system_type" && item.active,
  );
  const submit = async (event) => {
    event.preventDefault();
    try {
      await api(`/clients/${clientId}/equipment`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setNotice("המערכת שויכה ללקוח");
      onDone();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <form className="inline-create equipment-create" onSubmit={submit}>
      <label className="wide">
        מערכת
        <select
          required
          value={form.catalogItemId}
          onChange={(event) =>
            setForm({ ...form, catalogItemId: event.target.value })
          }
        >
          <option value="">בחירה מהקטלוג</option>
          {categories.map((category) => (
            <optgroup key={category.id} label={category.name}>
              {catalog
                .filter(
                  (item) =>
                    String(item.parentId) === String(category.id) &&
                    item.active,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        כמות
        <input
          type="number"
          min="0.01"
          step="0.01"
          required
          value={form.quantity}
          onChange={(event) =>
            setForm({ ...form, quantity: event.target.value })
          }
        />
      </label>
      <label>
        מיקום
        <input
          value={form.location}
          onChange={(event) =>
            setForm({ ...form, location: event.target.value })
          }
          placeholder="לדוגמה: קומת כניסה"
        />
      </label>
      <label className="wide">
        הערות
        <input
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </label>
      <button className="ops-primary small">
        <Check size={15} />
        שיוך ללקוח
      </button>
    </form>
  );
}

function TaskForm({ clientId, api, onDone, setNotice }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "normal",
    assigneeId: "",
  });
  const [users, setUsers] = useState([]);
  useEffect(() => {
    api("/calendar-options")
      .then((result) => setUsers(result.users))
      .catch(() => {});
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    try {
      await api(`/clients/${clientId}/tasks`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setNotice("המשימה נוספה");
      onDone();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <form className="inline-create task-create" onSubmit={submit}>
      <label className="wide">
        מה צריך לבצע?
        <input
          autoFocus
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label className="wide">
        תיאור
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>
      <label>
        יעד <b>חובה</b>
        <input
          required
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
      </label>
      <label>
        עדיפות
        <select
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        >
          <option value="normal">רגילה</option>
          <option value="high">גבוהה</option>
          <option value="critical">קריטית</option>
        </select>
      </label>
      <label>
        אחראי
        <select
          value={form.assigneeId}
          onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
        >
          <option value="">ללא אחראי</option>
          {users.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName}
            </option>
          ))}
        </select>
      </label>
      <button className="ops-primary small">
        <Check size={15} />
        הוספה
      </button>
    </form>
  );
}

function InspectionForm({ clientId, api, onDone, setNotice }) {
  const [form, setForm] = useState({
    title: "ביקורת אתר",
    inspectionDate: new Date().toISOString().slice(0, 10),
    score: "",
    findingsText: "",
    notes: "",
    status: "completed",
  });
  const submit = async (event) => {
    event.preventDefault();
    try {
      await api(`/clients/${clientId}/inspections`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          score: form.score ? Number(form.score) : null,
          findings: form.findingsText
            .split("\n")
            .filter(Boolean)
            .map((text) => ({ text, resolved: false })),
        }),
      });
      setNotice("ביקורת האתר נשמרה");
      onDone();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <form className="inline-create inspection-create" onSubmit={submit}>
      <label>
        כותרת
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label>
        תאריך
        <input
          type="date"
          value={form.inspectionDate}
          onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
        />
      </label>
      <label>
        ציון
        <input
          type="number"
          min="0"
          max="100"
          value={form.score}
          onChange={(e) => setForm({ ...form, score: e.target.value })}
        />
      </label>
      <label className="wide">
        ממצאים — שורה לכל ממצא
        <textarea
          value={form.findingsText}
          onChange={(e) => setForm({ ...form, findingsText: e.target.value })}
        />
      </label>
      <label className="wide">
        סיכום
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
      <button className="ops-primary small">
        <Check size={15} />
        שמירת ביקורת
      </button>
    </form>
  );
}

function FileUpload({ clientId, api, onDone, setNotice }) {
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState("תוכנית");
  const [uploading, setUploading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("clientId", clientId);
    body.append("category", category);
    try {
      await api("/documents", { method: "POST", body });
      setNotice("הקובץ הועלה לתיקיית המסמכים הראשית");
      onDone();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <form className="file-drop" onSubmit={submit}>
      <label>
        <Upload size={25} />
        <strong>{file ? file.name : "בחירת קובץ להעלאה"}</strong>
        <span>PDF, תמונות, תוכניות, גיליונות או הזמנות · עד 50MB</span>
        <input
          type="file"
          required
          onChange={(e) => setFile(e.target.files[0])}
        />
      </label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option>תוכנית</option>
        <option>הזמנה</option>
        <option>הצעת מחיר</option>
        <option>צילום אתר</option>
        <option>פרוטוקול</option>
        <option>אחר</option>
      </select>
      <button className="ops-primary small" disabled={uploading}>
        {uploading ? (
          <RefreshCw className="spin" size={15} />
        ) : (
          <Upload size={15} />
        )}
        {uploading ? "מעלה..." : "העלאה"}
      </button>
    </form>
  );
}

export function OperationalSettings({
  api,
  apiRoot,
  user,
  setNotice,
  onUserChanged,
  onConfigurationChanged,
  usersPanel,
}) {
  const [data, setData] = useState({
    settings: {},
    catalogs: [],
    customFields: [],
  });
  const [tab, setTab] = useState(
    user.role === "admin" ? "business" : "appearance",
  );
  const [audit, setAudit] = useState([]);
  const [backups, setBackups] = useState([]);
  const [backupPolicy, setBackupPolicy] = useState(null);
  const [auditQuery, setAuditQuery] = useState("");
  const load = async () => {
    try {
      const result = await api("/settings");
      setData(result);
      onConfigurationChanged?.(result);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const loadAudit = () =>
    api(`/audit?q=${encodeURIComponent(auditQuery)}`)
      .then((result) => setAudit(result.entries))
      .catch((error) => setNotice(error.message));
  const clearAudit = async () => {
    if (
      !window.confirm(
        "לנקות את כל יומן הפעולות? הפעולה בלתי הפיכה ותישמר רשומת ניקוי חדשה.",
      )
    )
      return;
    try {
      const result = await api("/audit", { method: "DELETE" });
      const refreshed = await api("/audit");
      setAuditQuery("");
      setAudit(refreshed.entries);
      setNotice(`${result.deletedCount} רשומות נמחקו מיומן הפעולות`);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const applySavedSetting = (key, value) => {
    const next = { ...data, settings: { ...data.settings, [key]: value } };
    setData(next);
    onConfigurationChanged?.(next);
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (tab === "audit") loadAudit();
  }, [tab, auditQuery]);
  const loadBackups = () =>
    api("/system/backups")
      .then((result) => {
        setBackups(result.backups);
        setBackupPolicy(result.policy);
      })
      .catch((error) => setNotice(error.message));
  useEffect(() => {
    if (tab === "backup") loadBackups();
  }, [tab]);
  const adminTabs = [
    ["business", "עסק ומערכת", Building2],
    ["users", "משתמשים והרשאות", ShieldCheck],
    ["storage", "מסמכים ו-Synology", FolderOpen],
    ["catalogs", "קטלוגים ועיצוב", Palette],
    ["fields", "שדות מותאמים", Settings2],
    ["audit", "Audit Log", History],
    ["backup", "גיבוי ובריאות", Database],
    ["ai", "סוכן AI", Sparkles],
  ];
  const tabs = [
    ["appearance", "מראה", Palette],
    ["calendarShare", "Outlook", CalendarDays],
    ...(user.role === "admin" ? adminTabs : []),
  ];
  return (
    <div className="ops-page settings-workspace">
      <div className="ops-hero">
        <div>
          <span className="ops-eyebrow">
            <Settings2 size={15} />
            מרכז שליטה
          </span>
          <h2>המערכת מתאימה את עצמה לדרך שבה אתם עובדים</h2>
          <p>שלטו בתהליך, במונחים, בצבעים, בסמלים ובמידע—בלי לשנות קוד.</p>
        </div>
        <span className="settings-health">
          <i />
          כל השירותים פעילים
        </span>
      </div>
      <nav className="settings-tabs">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      {tab === "business" && (
        <BusinessSettings
          settings={data.settings}
          api={api}
          apiRoot={apiRoot}
          onSaved={applySavedSetting}
          setNotice={setNotice}
        />
      )}
      {tab === "users" && usersPanel}
      {tab === "appearance" && (
        <AppearanceSettings
          initialTheme={user.appearanceTheme || "light"}
          api={api}
          onUserChanged={onUserChanged}
          user={user}
          setNotice={setNotice}
        />
      )}
      {tab === "calendarShare" && (
        <OutlookCalendarShare
          api={api}
          apiRoot={apiRoot}
          setNotice={setNotice}
        />
      )}
      {tab === "storage" && (
        <DocumentStorageSettings api={api} setNotice={setNotice} />
      )}
      {tab === "catalogs" && (
        <CatalogSettings
          catalogs={data.catalogs}
          api={api}
          reload={load}
          setNotice={setNotice}
        />
      )}
      {tab === "fields" && (
        <CustomFields
          fields={data.customFields}
          api={api}
          reload={load}
          setNotice={setNotice}
        />
      )}
      {tab === "audit" && (
        <AuditLog
          entries={audit}
          query={auditQuery}
          setQuery={setAuditQuery}
          onClear={clearAudit}
        />
      )}
      {tab === "backup" && (
        <BackupSettings
          api={api}
          apiRoot={apiRoot}
          backups={backups}
          policy={backupPolicy}
          reload={loadBackups}
          setNotice={setNotice}
        />
      )}
      {tab === "ai" && <AiSettings api={api} setNotice={setNotice} />}
    </div>
  );
}

function AiSettings({ api, setNotice }) {
  const [settings, setSettings] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [apiKeys, setApiKeys] = useState({ gemini: "", openai: "" });
  const [busy, setBusy] = useState("");
  const load = async () => {
    try {
      const result = await api("/ai/settings");
      setSettings(result);
      setSelectedProvider(result.activeProvider || "gemini");
    } catch (error) {
      setNotice(error.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  if (!settings)
    return (
      <section className="panel ai-loading">
        <RefreshCw className="spin" size={18} /> טוען הגדרות AI...
      </section>
    );
  const provider = settings.providers[selectedProvider];
  const updateProvider = (changes) =>
    setSettings({
      ...settings,
      providers: {
        ...settings.providers,
        [selectedProvider]: { ...provider, ...changes },
      },
    });
  const persist = async (extra = {}) => {
    const result = await api("/ai/settings", {
      method: "PATCH",
      body: JSON.stringify({
        provider: selectedProvider,
        activeProvider: settings.activeProvider,
        model: provider.model,
        enabled: provider.enabled,
        apiKey: apiKeys[selectedProvider],
        monthlyBudgetUsd: settings.monthlyBudgetUsd,
        readOnly: settings.readOnly,
        ...extra,
      }),
    });
    setSettings(result);
    setApiKeys({ ...apiKeys, [selectedProvider]: "" });
    return result;
  };
  const save = async () => {
    setBusy("save");
    try {
      await persist();
      setNotice(`הגדרות ${provider.name} נשמרו בהצלחה`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  };
  const test = async () => {
    setBusy("test");
    try {
      if (apiKeys[selectedProvider]) await persist();
      const result = await api(`/ai/providers/${selectedProvider}/test`, {
        method: "POST",
        body: "{}",
      });
      setNotice(result.message);
      await load();
    } catch (error) {
      setNotice(error.message);
      await load();
    } finally {
      setBusy("");
    }
  };
  const clearKey = async () => {
    if (!window.confirm(`למחוק את מפתח ${provider.name} השמור?`)) return;
    setBusy("clear");
    try {
      await persist({ enabled: false, clearApiKey: true });
      setNotice("המפתח נמחק בצורה מאובטחת");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="ai-settings-layout">
      <section className="panel ai-provider-panel">
        <header className="ai-heading">
          <span><Sparkles size={23} /></span>
          <div>
            <h3>מנוע ה-AI של PROJECTS</h3>
            <p>בחרו ספק, מודל ומגבלת עלות. ניתן לעבור ספק בכל עת בלי לשנות את המערכת.</p>
          </div>
          <span className={`ai-status ${provider.configured && provider.lastTestStatus === "success" ? "ready" : ""}`}>
            <i />
            {provider.configured ? provider.lastTestStatus === "success" ? "חיבור תקין" : "מפתח נשמר" : "טרם הוגדר"}
          </span>
        </header>
        <div className="ai-provider-switch">
          {Object.values(settings.providers).map((item) => (
            <button key={item.provider} className={selectedProvider === item.provider ? "active" : ""} onClick={() => setSelectedProvider(item.provider)}>
              <strong>{item.name}</strong><small>{item.configured ? "מוגדר" : "לא מוגדר"}</small>
            </button>
          ))}
        </div>
        <div className="ai-key-card">
          <div className="ai-key-title"><KeyRound size={19} /><div><strong>מפתח API</strong><small>המפתח מוצפן בצד השרת ולעולם אינו מוצג מחדש.</small></div></div>
          <input type="password" autoComplete="new-password" value={apiKeys[selectedProvider]} onChange={(event) => setApiKeys({ ...apiKeys, [selectedProvider]: event.target.value })} placeholder={provider.configured ? "מפתח שמור — הזינו רק כדי להחליף" : "הדביקו כאן את המפתח"} />
          <div className="ai-key-actions">
            <a className="ops-secondary" href={provider.keyUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> יצירת מפתח אצל {provider.name}</a>
            <a href={provider.docsUrl} target="_blank" rel="noreferrer">הוראות רשמיות</a>
            {provider.configured && <button className="ai-clear-key" onClick={clearKey} disabled={Boolean(busy)}>מחיקת מפתח</button>}
          </div>
        </div>
        <div className="ai-model-heading"><div><h3>בחירת מודל</h3><p>הרשימה כוללת מודלים יציבים ורלוונטיים לסוכן PROJECTS בלבד.</p></div><span>{provider.models.length} אפשרויות</span></div>
        <div className="ai-model-grid">
          {provider.models.map((model) => (
            <button key={model.id} className={provider.model === model.id ? "active" : ""} onClick={() => updateProvider({ model: model.id })}>
              <span className="ai-model-radio"><i /></span>
              <div><strong>{model.name}</strong><code>{model.id}</code><p>{model.description}</p><footer><b>{model.recommendation}</b><span>{model.cost}</span></footer></div>
            </button>
          ))}
        </div>
      </section>
      <aside className="panel ai-control-panel">
        <header><ShieldCheck size={22} /><div><h3>שליטה ובטיחות</h3><p>ברירות מחדל שמונעות הפתעות בעלות ובפעולות.</p></div></header>
        <label className="ai-field">ספק פעיל<select value={settings.activeProvider} onChange={(event) => setSettings({ ...settings, activeProvider: event.target.value })}>{Object.values(settings.providers).map((item) => <option key={item.provider} value={item.provider}>{item.name}</option>)}</select></label>
        <label className="ai-field">תקרת תקציב חודשית (USD)<input type="number" min="0" max="100000" value={settings.monthlyBudgetUsd} onChange={(event) => setSettings({ ...settings, monthlyBudgetUsd: Number(event.target.value) })} /><small>נוצלו החודש כ־${Number(settings.monthUsageUsd || 0).toFixed(4)}. בהגעה לתקרה יצירת תשובות נעצרת; 0 מאפשר שימוש ללא הגבלה.</small></label>
        <label className="setting-toggle ai-toggle"><span><b>הפעלת {provider.name}</b><small>מאפשרת להשתמש בספק לאחר בדיקת החיבור.</small></span><input type="checkbox" checked={provider.enabled} onChange={(event) => updateProvider({ enabled: event.target.checked })} /><i /></label>
        <label className="setting-toggle ai-toggle"><span><b>מצב קריאה בלבד — נעול</b><small>הסוכן יענה וינתח, אך אין לו מסלול לשינוי נתונים. מידע רלוונטי לשאלה נשלח לספק ה־AI הפעיל.</small></span><input type="checkbox" checked disabled /><i /></label>
        {provider.lastTestedAt && <div className={`ai-last-test ${provider.lastTestStatus}`}><CheckCircle2 size={17} /><div><strong>{provider.lastTestStatus === "success" ? "בדיקה אחרונה הצליחה" : "בדיקה אחרונה נכשלה"}</strong><small>{new Date(provider.lastTestedAt).toLocaleString("he-IL")}{provider.lastTestError ? ` · ${provider.lastTestError}` : ""}</small></div></div>}
        <footer>
          <button className="ops-secondary" onClick={test} disabled={Boolean(busy) || (!provider.configured && !apiKeys[selectedProvider])}>{busy === "test" ? <RefreshCw className="spin" size={16} /> : <Zap size={16} />} בדיקת חיבור</button>
          <button className="ops-primary" onClick={save} disabled={Boolean(busy)}>{busy === "save" ? <RefreshCw className="spin" size={16} /> : <Save size={16} />} שמירה</button>
        </footer>
        <p className="ai-foundation-note"><Sparkles size={15} /> הספק הפעיל משמש את הצ׳אט ואת התובנות האוטומטיות. הסוכן פועל בקריאה בלבד, מכבד את תקרת התקציב ומתעד שימוש לצורך בקרה.</p>
      </aside>
    </div>
  );
}

function OutlookCalendarShare({ api, apiRoot, setNotice }) {
  const [feed, setFeed] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api("/calendar-feed")
      .then(setFeed)
      .catch((error) => setNotice(error.message));
  useEffect(() => {
    load();
  }, []);
  const url = feed?.token
    ? `${window.location.origin}${apiRoot}/calendar-feed/${feed.token}.ics`
    : "";
  const create = async () => {
    setBusy(true);
    try {
      const result = await api("/calendar-feed", {
        method: "POST",
        body: "{}",
      });
      setFeed({ active: true, token: result.token });
      setNotice("קישור Outlook לקריאה בלבד נוצר");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("הקישור הועתק. ב-Outlook בחרו הוספת לוח שנה מהאינטרנט.");
    } catch {
      setNotice(url);
    }
  };
  const revoke = async () => {
    if (!confirm("לבטל את הקישור? כל המנויים הקיימים יפסיקו להתעדכן.")) return;
    setBusy(true);
    try {
      await api("/calendar-feed", { method: "DELETE" });
      setFeed({ active: false });
      setNotice("קישור Outlook בוטל");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel outlook-share">
      <header>
        <span>
          <CalendarDays size={23} />
        </span>
        <div>
          <h3>לוח שנה ב-Outlook — צפייה בלבד</h3>
          <p>
            מנוי ICS מציג משימות, אבני דרך ואירועים. לא ניתן לערוך את PROJECTS
            מתוך Outlook.
          </p>
        </div>
      </header>
      {feed?.active ? (
        <>
          <label>
            קישור המנוי
            <input readOnly dir="ltr" value={url} />
          </label>
          <div className="outlook-share-actions">
            <button className="ops-primary" onClick={copy}>
              <Copy size={16} />
              העתקת קישור
            </button>
            <button className="ops-danger" onClick={revoke} disabled={busy}>
              ביטול הקישור
            </button>
          </div>
          <small>
            יש לבחור ב-Outlook: Add calendar → Subscribe from web. הכתובת חייבת
            להיות נגישה מבחוץ ב-HTTPS.
          </small>
        </>
      ) : (
        <button className="ops-primary" onClick={create} disabled={busy}>
          <Link2 size={16} />
          {busy ? "יוצר קישור..." : "יצירת קישור Outlook"}
        </button>
      )}
    </section>
  );
}

function AppearanceSettings({
  initialTheme,
  api,
  onUserChanged,
  user,
  setNotice,
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [saving, setSaving] = useState("");
  useEffect(() => setTheme(initialTheme), [initialTheme]);
  const choices = [
    ["light", "בהיר", "המראה הנוכחי של PROJECTS", Sun],
    ["dark", "כהה", "שחור, אפור וגרניט עם טקסט בהיר", Moon],
    ["auto", "אוטומטי", "מותאם להגדרת המכשיר", Monitor],
  ];
  const choose = async (nextTheme) => {
    if (saving || nextTheme === theme) return;
    setSaving(nextTheme);
    try {
      const result = await api("/preferences/appearance", {
        method: "PATCH",
        body: JSON.stringify({ theme: nextTheme }),
      });
      setTheme(result.appearanceTheme);
      onUserChanged({ ...user, appearanceTheme: result.appearanceTheme });
      setNotice("הגדרת המראה נשמרה והוחלה");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving("");
    }
  };
  return (
    <section className="panel appearance-settings">
      <header>
        <span>
          <Palette size={22} />
        </span>
        <div>
          <h3>ערכת הצבעים האישית שלי</h3>
          <p>
            הבחירה נשמרת למשתמש שלך בלבד. מצב בהיר נשאר בדיוק כפי שהוא כיום.
          </p>
        </div>
      </header>
      <div className="theme-choice-grid">
        {choices.map(([id, title, description, Icon]) => (
          <button
            key={id}
            className={theme === id ? "active" : ""}
            onClick={() => choose(id)}
            disabled={Boolean(saving)}
            aria-pressed={theme === id}
          >
            <div className={`theme-preview ${id}`}>
              <span className="preview-sidebar" />
              <span className="preview-topbar" />
              <span className="preview-card one" />
              <span className="preview-card two" />
            </div>
            <span className="theme-choice-copy">
              <i>
                <Icon size={18} />
              </i>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              {theme === id && <Check size={18} />}
            </span>
            {saving === id && (
              <em>
                <RefreshCw className="spin" size={15} />
                שומר...
              </em>
            )}
          </button>
        ))}
      </div>
      <footer>
        <Moon size={17} />
        <span>
          במצב כהה נשמרת ניגודיות גבוהה בטפסים, טבלאות, חלונות ולוחות עבודה.
        </span>
      </footer>
    </section>
  );
}

function DocumentStorageSettings({ api, setNotice }) {
  const [storage, setStorage] = useState({
    mode: "internal",
    relativePath: "PROJECTS",
    resolvedPath: "",
    writable: false,
  });
  const [directories, setDirectories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [recycle,setRecycle]=useState([]);
  const load = () =>
    api("/document-storage")
      .then((result) => setStorage(result.storage))
      .catch((error) => setNotice(error.message));
  const loadRecycle=()=>api('/documents-recycle-bin').then(result=>setRecycle(result.documents||[])).catch(()=>setRecycle([]));
  useEffect(() => {
    load();loadRecycle();
  }, []);
  const browse = async (
    mode = storage.mode,
    relativePath = storage.relativePath,
  ) => {
    if (mode === "internal") return setDirectories([]);
    try {
      const result = await api(
        `/document-storage/browse?mode=${encodeURIComponent(mode)}&path=${encodeURIComponent(relativePath)}`,
      );
      setDirectories(result.directories);
    } catch (error) {
      setDirectories([]);
      setNotice(error.message);
    }
  };
  useEffect(() => {
    browse();
  }, [storage.mode, storage.relativePath]);
  const save = async () => {
    setBusy(true);
    try {
      const result = await api("/document-storage", {
        method: "PATCH",
        body: JSON.stringify({
          mode: storage.mode,
          relativePath: storage.relativePath,
        }),
      });
      setStorage(result.storage);
      setNotice("תיקיית המסמכים נבדקה ונשמרה");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };
  const enter = (name) =>
    setStorage({
      ...storage,
      relativePath: [storage.relativePath, name].filter(Boolean).join("/"),
    });
  const up = () =>
    setStorage({
      ...storage,
      relativePath: storage.relativePath
        .split("/")
        .filter(Boolean)
        .slice(0, -1)
        .join("/"),
    });
  return (
    <>
    <section className="panel storage-settings">
      <header>
        <span>
          <FolderOpen size={22} />
        </span>
        <div>
          <h3>תיקיית מסמכים ראשית</h3>
          <p>
            אחסון פנימי או תיקיית רשת שחוברה ל־Home Assistant מסוג Share/Media.
          </p>
        </div>
        <em className={storage.writable ? "healthy" : "unhealthy"}>
          {storage.writable ? "זמין לכתיבה" : "טרם אומת"}
        </em>
      </header>
      <div className="storage-mode-grid">
        {[
          ["internal", "פנימי", "נשמר בגיבוי ה-Add-on"],
          ["share", "Share / Synology", "מומלץ למסמכי משרד"],
          ["media", "Media", "מתאים לתוכן מדיה"],
        ].map(([id, title, text]) => (
          <button
            key={id}
            className={storage.mode === id ? "active" : ""}
            onClick={() =>
              setStorage({
                ...storage,
                mode: id,
                relativePath: id === "internal" ? "PROJECTS" : "",
              })
            }
          >
            <strong>{title}</strong>
            <small>{text}</small>
          </button>
        ))}
      </div>
      <ol className="nas-guide">
        <li>ב־Home Assistant פתחו הגדרות ← מערכת ← אחסון והוסיפו את שיתוף ה־SMB של Synology כאחסון רשת.</li>
        <li>בחרו כאן Share / Synology או Media בהתאם לסוג האחסון שהוגדר ב־HA.</li>
        <li>בחרו תיקייה ולחצו בדיקה ושמירה; לכל פרויקט תיווצר תיקיית משנה לפי השם שהוגדר בכרטיס הפרויקט.</li>
      </ol>
      {storage.mode !== "internal" && (
        <div className="folder-browser">
          <label>
            נתיב יחסי בתוך /{storage.mode}
            <input
              value={storage.relativePath}
              onChange={(event) =>
                setStorage({
                  ...storage,
                  relativePath: event.target.value.replace(/\\/g, "/"),
                })
              }
              placeholder="Synology/PROJECTS"
            />
          </label>
          <div className="folder-browser-toolbar">
            <button onClick={up} disabled={!storage.relativePath}>
              תיקייה למעלה
            </button>
            <span>
              /{storage.mode}/{storage.relativePath}
            </span>
          </div>
          <div className="folder-browser-list">
            {directories.map((name) => (
              <button key={name} onClick={() => enter(name)}>
                <FolderOpen size={16} />
                {name}
              </button>
            ))}
            {!directories.length && (
              <small>
                אין תיקיות להצגה בנתיב זה, או שהחיבור טרם הוגדר ב‑HA.
              </small>
            )}
          </div>
        </div>
      )}
      <footer>
        <div>
          <small>נתיב פעיל</small>
          <code>
            {storage.resolvedPath || `/${storage.mode}/${storage.relativePath}`}
          </code>
        </div>
        <button className="ops-primary" onClick={save} disabled={busy}>
          {busy ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
          בדיקה ושמירה
        </button>
      </footer>
    </section>
    <section className="panel storage-settings document-recycle">
      <header><span><Trash2 size={22}/></span><div><h3>סל מחזור מסמכים</h3><p>מסמכים שנמחקו נשמרים 14 יום לפני מחיקה סופית.</p></div><em>{recycle.length}</em></header>
      <div className="document-recycle-list">{recycle.map(item=><div key={item.id}><FileText size={17}/><span><b>{item.title||item.original_name}</b><small>נמחק ב־{new Date(item.deleted_at).toLocaleString('he-IL')}</small></span><button className="ops-secondary" onClick={async()=>{try{await api(`/documents/${item.id}/restore`,{method:'POST'});setNotice('המסמך שוחזר');loadRecycle()}catch(error){setNotice(error.message)}}}><RotateCcw size={15}/>שחזור</button></div>)}{!recycle.length&&<small>סל המחזור ריק.</small>}</div>
    </section>
    </>
  );
}

function BusinessSettings({ settings, api, apiRoot, onSaved, setNotice }) {
  const groups = [
    [
      "company",
      "פרטי החברה",
      "זהות העסק שתופיע במסמכים ובמערכת",
      [
        ["name", "שם החברה", "text"],
        ["companyNumber", "ח.פ / עוסק", "text"],
        ["phone", "טלפון", "tel"],
        ["email", "דוא״ל", "email"],
        ["address", "כתובת", "text"],
      ],
    ],
    [
      "localization",
      "אזוריות וכספים",
      "כללי ברירת מחדל לתאריכים וגבייה",
      [
        ["currency", "מטבע", "select", ["ILS", "USD", "EUR"]],
        ["vatRate", "מע״מ (%)", "number"],
        ["timezone", "אזור זמן", "text"],
        ["dateFormat", "פורמט תאריך", "select", ["DD.MM.YYYY", "YYYY-MM-DD"]],
      ],
    ],
    [
      "projectNumbering",
      "מספור פרויקטים",
      "קוד עקבי לכל פרויקט חדש",
      [
        ["prefix", "קידומת", "text"],
        ["includeYear", "כלול שנה", "boolean"],
        ["nextNumber", "המספר הבא", "number"],
      ],
    ],
    [
      "map",
      "מפה, כתובות ומיקום",
      "מפת OpenStreetMap וחיפוש כתובות חינמי באמצעות Photon",
      [
        ["provider", "ספק מפה", "select", ["openstreetmap"]],
        ["photonUrl", "שרת Photon", "url"],
        ["addressLanguage", "שפת כתובות", "select", ["default", "en"]],
        ["defaultLat", "קו רוחב", "number"],
        ["defaultLng", "קו אורך", "number"],
        ["defaultZoom", "זום", "number"],
      ],
    ],
    [
      "notifications",
      "התראות",
      "אירועים שייצרו התראה",
      [
        ["taskDue", "משימה מתקרבת", "boolean"],
        ["paymentDue", "גבייה מתקרבת", "boolean"],
        ["milestoneRisk", "אבן דרך בסיכון", "boolean"],
        ["emailEnabled", "שליחת מייל", "boolean"],
      ],
    ],
  ];
  return (
    <div className="settings-card-grid">
      {groups.map(([key, title, subtitle, fields]) => (
        <SettingCard
          key={key}
          settingKey={key}
          title={title}
          subtitle={subtitle}
          fields={fields}
          initial={settings[key] || {}}
          api={api}
          apiRoot={apiRoot}
          onSaved={onSaved}
          setNotice={setNotice}
        />
      ))}
    </div>
  );
}

function SettingCard({
  settingKey,
  title,
  subtitle,
  fields,
  initial,
  api,
  apiRoot,
  onSaved,
  setNotice,
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  useEffect(() => setForm(initial), [JSON.stringify(initial)]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const save = async (event) => {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const result = await api(`/settings/${settingKey}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      onSaved(settingKey, result.setting.value);
      setNotice(`${title} נשמרו בהצלחה`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };
  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("logo", file);
    setUploadingLogo(true);
    try {
      const result = await api("/settings/company-logo", {
        method: "POST",
        body,
      });
      onSaved("company", result.setting.value);
      setForm(result.setting.value);
      setNotice("לוגו החברה נשמר");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  };
  return (
    <form
      className={`setting-card panel ${dirty ? "dirty" : ""}`}
      onSubmit={save}
    >
      <header>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
          {dirty && <small>יש שינויים שלא נשמרו</small>}
        </div>
        <button
          type="submit"
          className="setting-save-button"
          disabled={saving || !dirty}
        >
          {saving ? (
            <RefreshCw className="spin" size={17} />
          ) : (
            <Save size={17} />
          )}
          <span>{saving ? "שומר..." : dirty ? "שמור" : "נשמר"}</span>
        </button>
      </header>
      {settingKey === "company" && (
        <div className="company-logo-control">
          <span>
            {form.logo?.storedName ? (
              <img
                src={`${apiRoot}/settings/company-logo?v=${encodeURIComponent(form.logo.updatedAt || "")}`}
                alt="לוגו החברה"
              />
            ) : (
              <Building2 size={25} />
            )}
          </span>
          <div>
            <strong>לוגו החברה</strong>
            <small>PNG, JPG או WebP · עד 5MB</small>
          </div>
          <label className="ops-secondary small">
            {uploadingLogo
              ? "מעלה..."
              : form.logo?.storedName
                ? "החלפת לוגו"
                : "העלאת לוגו"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadLogo}
              disabled={uploadingLogo}
            />
          </label>
        </div>
      )}
      <div>
        {fields.map(([key, label, type, options]) =>
          type === "boolean" ? (
            <label className="setting-toggle" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              <i />
            </label>
          ) : (
            <label key={key}>
              <span>{label}</span>
              {type === "select" ? (
                <select
                  value={form[key] ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                >
                  {options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={type}
                  step={type === "number" ? "any" : undefined}
                  value={form[key] ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [key]:
                        type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </label>
          ),
        )}
      </div>
    </form>
  );
}

function CatalogSettings({ catalogs, api, reload, setNotice }) {
  const [category, setCategory] = useState("tag");
  const [form, setForm] = useState({
    name: "",
    color: "#6957df",
    icon: "tag",
    symbol: "",
  });
  const items = catalogs.filter((item) => item.category === category);
  const create = async (event) => {
    event.preventDefault();
    try {
      await api("/catalogs", {
        method: "POST",
        body: JSON.stringify({ ...form, category }),
      });
      setForm({ name: "", color: "#6957df", icon: "tag", symbol: "" });
      setNotice("הפריט נוסף לקטלוג");
      reload();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const toggle = async (item) => {
    try {
      await api(`/catalogs/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      reload();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <div className="catalog-layout">
      <aside className="panel catalog-nav">
        {Object.entries(categoryNames).map(([id, name]) => (
          <button
            key={id}
            className={category === id ? "active" : ""}
            onClick={() => setCategory(id)}
          >
            <DynamicIcon
              name={id === "flag" ? "flag" : id === "system" ? "cpu" : "tag"}
            />
            {name}
            <em>{catalogs.filter((item) => item.category === id).length}</em>
          </button>
        ))}
      </aside>
      <section className="panel catalog-main">
        <div className="catalog-heading">
          <div>
            <h3>{categoryNames[category]}</h3>
            <p>שם, צבע, אייקון וסמל ניתנים לשינוי בכל עת.</p>
          </div>
        </div>
        <form className="catalog-create" onSubmit={create}>
          <label>
            שם
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="פריט חדש"
            />
          </label>
          <label>
            צבע
            <span className="color-input">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
              <b>{form.color}</b>
            </span>
          </label>
          <label>
            אייקון
            <select
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            >
              {iconOptions.map((icon) => (
                <option key={icon}>{icon}</option>
              ))}
            </select>
          </label>
          <label>
            סמל
            <input
              maxLength="8"
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              placeholder="★ / VIP"
            />
          </label>
          <button className="ops-primary small">
            <Plus size={15} />
            הוספה
          </button>
        </form>
        <div className="catalog-items">
          {items.map((item) => (
            <button
              key={item.id}
              className={!item.active ? "inactive" : ""}
              onClick={() => toggle(item)}
            >
              <span style={{ "--item-color": item.color }}>
                <DynamicIcon name={item.icon} />
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.symbol || item.icon}</small>
              </div>
              <em>{item.active ? "פעיל" : "מושבת"}</em>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CustomFields({ fields, api, reload, setNotice }) {
  const [form, setForm] = useState({
    entityType: "client",
    fieldKey: "",
    label: "",
    fieldType: "text",
    required: false,
  });
  const create = async (event) => {
    event.preventDefault();
    try {
      await api("/custom-fields", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({
        entityType: "client",
        fieldKey: "",
        label: "",
        fieldType: "text",
        required: false,
      });
      setNotice("השדה המותאם נוצר");
      reload();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const toggle = async (field) => {
    try {
      await api(`/custom-fields/${field.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !field.active }),
      });
      reload();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const remove = async (field) => {
    if (!confirm(`למחוק את השדה „${field.label}”?`)) return;
    try {
      await api(`/custom-fields/${field.id}`, { method: "DELETE" });
      setNotice("השדה נמחק");
      reload();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <div className="custom-fields-layout">
      <form className="panel custom-field-create" onSubmit={create}>
        <div className="ops-section-title">
          <div>
            <span>
              <CirclePlus size={17} />
            </span>
            <h3>שדה מותאם חדש</h3>
          </div>
        </div>
        <label>
          ישות
          <select
            value={form.entityType}
            onChange={(e) =>
              setForm({
                ...form,
                entityType: e.target.value,
                required: e.target.value === "client" ? false : form.required,
              })
            }
          >
            <option value="client">לקוח</option>
            <option value="project">פרויקט</option>
            <option value="task">משימה</option>
            <option value="inspection">ביקורת</option>
          </select>
        </label>
        <label>
          כותרת
          <input
            required
            value={form.label}
            onChange={(e) =>
              setForm({
                ...form,
                label: e.target.value,
                fieldKey: form.fieldKey || e.target.value.replace(/\s+/g, "_"),
              })
            }
          />
        </label>
        <label>
          מפתח טכני
          <input
            required
            pattern="[A-Za-z0-9_]+"
            value={form.fieldKey}
            onChange={(e) => setForm({ ...form, fieldKey: e.target.value })}
          />
        </label>
        <label>
          סוג
          <select
            value={form.fieldType}
            onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
          >
            {[
              "text",
              "number",
              "date",
              "select",
              "boolean",
              "url",
              "phone",
              "email",
            ].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label
          className="check-label"
          title={
            form.entityType === "client"
              ? "בכרטיס לקוח רק שם, כתובת וטלפון הם שדות חובה"
              : ""
          }
        >
          <input
            type="checkbox"
            disabled={form.entityType === "client"}
            checked={form.required}
            onChange={(e) => setForm({ ...form, required: e.target.checked })}
          />
          שדה חובה
        </label>
        {form.entityType === "client" && (
          <small className="field-policy-note">
            בכרטיס לקוח רק שם, כתובת וטלפון נשארים חובה.
          </small>
        )}
        <button className="ops-primary">
          <Plus size={16} />
          יצירת שדה
        </button>
      </form>
      <section className="panel custom-field-list">
        <div className="ops-section-title">
          <div>
            <span>
              <Settings2 size={17} />
            </span>
            <h3>שדות קיימים</h3>
          </div>
        </div>
        {fields.length ? (
          fields.map((field) => (
            <div
              className={`custom-field-row ${field.active ? "" : "inactive"}`}
              key={field.id}
            >
              <span>{field.label.slice(0, 1)}</span>
              <div>
                <strong>{field.label}</strong>
                <small>
                  {field.entityType} · {field.fieldKey}
                </small>
              </div>
              <em>{field.fieldType}</em>
              {field.required && <b>חובה</b>}
              <button className="field-toggle" onClick={() => toggle(field)}>
                {field.active ? "השבתה" : "הפעלה"}
              </button>
              <button
                className="field-delete"
                onClick={() => remove(field)}
                title="מחיקה"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        ) : (
          <InlineEmpty text="עדיין לא נוצרו שדות מותאמים" />
        )}
      </section>
    </div>
  );
}

function AuditLog({ entries, query, setQuery, onClear }) {
  return (
    <section className="panel audit-panel">
      <div className="audit-toolbar">
        <div>
          <h3>יומן פעולות משתמשים</h3>
          <p>תיעוד בלתי תלוי של שינויים ופעולות רגישות.</p>
        </div>
        <div className="audit-toolbar-actions">
          <label>
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש משתמש, פעולה או רשומה..."
            />
          </label>
          <button className="ops-danger" onClick={onClear}>
            <Trash2 size={15} />
            ניקוי יומן
          </button>
        </div>
      </div>
      <div className="audit-table">
        <div className="audit-head">
          <span>משתמש</span>
          <span>פעולה</span>
          <span>ישות</span>
          <span>פרטים</span>
          <span>מועד</span>
        </div>
        {entries.map((entry) => (
          <div className="audit-row" key={entry.id}>
            <span>
              <i>{initials(entry.userName)}</i>
              <b>{entry.userName}</b>
            </span>
            <span>
              <em className={`audit-action ${entry.action}`}>
                {actionNames[entry.action] || entry.action}
              </em>
            </span>
            <span>
              {entry.entityType}
              <small>{entry.entityId || ""}</small>
            </span>
            <span className="audit-details">
              {Object.keys(entry.details || {})
                .slice(0, 3)
                .map((key) => `${key}: ${String(entry.details[key])}`)
                .join(" · ") || "—"}
            </span>
            <time>{new Date(entry.createdAt).toLocaleString("he-IL")}</time>
          </div>
        ))}
      </div>
      {!entries.length && <InlineEmpty text="לא נמצאו פעולות התואמות לחיפוש" />}
    </section>
  );
}

function BackupSettings({ api, apiRoot, backups, policy, reload, setNotice }) {
  const [form, setForm] = useState(
    policy || {
      enabled: false,
      frequency: "daily",
      retention: 14,
      hour: "02:00",
      destination: "internal",
      relativePath: "PROJECTS/Backups",
    },
  );
  const [busy, setBusy] = useState("");
  const [file, setFile] = useState(null);
  useEffect(() => {
    if (policy) setForm(policy);
  }, [policy]);
  const save = async () => {
    setBusy("save");
    try {
      await api("/system/backup-policy", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setNotice("מדיניות הגיבוי נשמרה והיעד נבדק לכתיבה");
      reload();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  };
  const backup = async () => {
    setBusy("backup");
    try {
      await api("/system/backups", { method: "POST" });
      setNotice("חבילת הגיבוי המלאה נוצרה");
      reload();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  };
  const restore = async (item) => {
    if (
      !window.confirm(
        `לשחזר את ${item.name}? בסיס הנתונים והקבצים הפנימיים הנוכחיים יוחלפו והמערכת תופעל מחדש.`,
      )
    )
      return;
    setBusy(item.name);
    try {
      await api("/system/restore", {
        method: "POST",
        body: JSON.stringify({ name: item.name, source: item.source }),
      });
      setNotice("השחזור אומת והמערכת מופעלת מחדש");
    } catch (error) {
      setNotice(error.message);
      setBusy("");
    }
  };
  const importBackup = async (event) => {
    event.preventDefault();
    if (!file) return;
    const formElement = event.currentTarget;
    setBusy("import");
    const body = new FormData();
    body.append("backup", file);
    try {
      await api("/system/backups/import", { method: "POST", body });
      setFile(null);
      formElement.reset();
      setNotice("חבילת הגיבוי יובאה ואומתה");
      reload();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="backup-settings-layout">
      <section className="panel backup-policy">
        <header>
          <span>
            <Database size={23} />
          </span>
          <div>
            <h3>גיבוי מלא ואוטומטי</h3>
            <p>PostgreSQL, קבצים שהועלו ולוגו החברה בחבילת PROJECTS אחת.</p>
          </div>
          <label className="setting-toggle">
            <span>אוטומטי</span>
            <input
              type="checkbox"
              checked={Boolean(form.enabled)}
              onChange={(event) =>
                setForm({ ...form, enabled: event.target.checked })
              }
            />
            <i />
          </label>
        </header>
        <div className="backup-destination">
          <button
            className={form.destination === "internal" ? "active" : ""}
            onClick={() => setForm({ ...form, destination: "internal" })}
          >
            <Database size={18} />
            <strong>פנימי</strong>
            <small>בתוך נתוני ה־Add-on</small>
          </button>
          <button
            className={form.destination === "share" ? "active" : ""}
            onClick={() => setForm({ ...form, destination: "share" })}
          >
            <FolderOpen size={18} />
            <strong>תיקיית Share</strong>
            <small>מומלץ להגנה חיצונית</small>
          </button>
        </div>
        {form.destination === "share" && (
          <label className="backup-path">
            נתיב בתוך ‎/share
            <input
              value={form.relativePath}
              onChange={(event) =>
                setForm({
                  ...form,
                  relativePath: event.target.value.replace(/\\/g, "/"),
                })
              }
              placeholder="PROJECTS/Backups"
            />
            <small>הנתיב המלא יהיה ‎/share/{form.relativePath}</small>
          </label>
        )}
        <div className="backup-schedule">
          <label>
            תדירות
            <select
              value={form.frequency}
              onChange={(event) =>
                setForm({ ...form, frequency: event.target.value })
              }
            >
              <option value="daily">כל יום</option>
              <option value="weekly">כל שבוע · יום ראשון</option>
            </select>
          </label>
          <label>
            שעה
            <input
              type="time"
              value={form.hour}
              onChange={(event) =>
                setForm({ ...form, hour: event.target.value })
              }
            />
          </label>
          <label>
            מספר גרסאות
            <input
              type="number"
              min="1"
              max="100"
              value={form.retention}
              onChange={(event) =>
                setForm({ ...form, retention: Number(event.target.value) })
              }
            />
          </label>
        </div>
        <footer>
          <button
            className="ops-secondary"
            onClick={backup}
            disabled={Boolean(busy)}
          >
            {busy === "backup" ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Database size={16} />
            )}
            גיבוי עכשיו
          </button>
          <button
            className="ops-primary"
            onClick={save}
            disabled={Boolean(busy)}
          >
            {busy === "save" ? (
              <RefreshCw className="spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            בדיקה ושמירת הגדרות
          </button>
        </footer>
      </section>
      <section className="panel backup-library">
        <header>
          <div>
            <h3>חבילות גיבוי</h3>
            <p>{backups.length} גיבויים זמינים לשחזור או לייצוא.</p>
          </div>
          <form onSubmit={importBackup}>
            <label className="ops-secondary">
              <Upload size={16} />
              {file?.name || "ייבוא גיבוי"}
              <input
                type="file"
                accept=".projects-backup,application/gzip"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
            {file && (
              <button className="ops-primary" disabled={Boolean(busy)}>
                {busy === "import" ? "מאמת..." : "העלאה ואימות"}
              </button>
            )}
          </form>
        </header>
        {backups.map((item) => (
          <div className="backup-item" key={`${item.source}-${item.name}`}>
            <span>
              <Archive size={18} />
            </span>
            <div>
              <strong>{item.name}</strong>
              <small>
                {new Date(item.createdAt).toLocaleString("he-IL")} ·{" "}
                {bytes(item.size)} ·{" "}
                {item.source === "share" ? "Share" : "פנימי"} ·{" "}
                {item.format === "full" ? "מלא" : "מסד בלבד"}
              </small>
            </div>
            <a
              className="ops-secondary"
              href={`${apiRoot}/system/backups/${item.source}/${encodeURIComponent(item.name)}/download`}
            >
              <Download size={15} />
              ייצוא
            </a>
            <button
              className="ops-secondary"
              onClick={() => restore(item)}
              disabled={Boolean(busy)}
            >
              <RotateCcw size={15} />
              שחזור
            </button>
          </div>
        ))}
        {!backups.length && <InlineEmpty text="עדיין לא נוצרו חבילות גיבוי" />}
      </section>
    </div>
  );
}
