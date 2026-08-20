import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowDown, ArrowUp, BarChart3, BellRing, Bot, Check, CheckCircle2, Clock3, FolderKanban, Gauge, Layers3, ListChecks, Plus, RefreshCw, Save, Settings2, ShieldAlert, SlidersHorizontal, Sparkles, Trash2, Users, X } from "lucide-react";
import { TaskEditor } from "./Workspaces";
import { AppModal } from "./AppModal";
import "./my-work-enhancements.css";

const dateOnly=(value)=>String(value||"").slice(0,10);
const dayText=(value)=>value?new Date(`${dateOnly(value)}T00:00:00`).toLocaleDateString("he-IL",{day:"numeric",month:"short"}):"ללא תאריך";
const stageLabels={waiting:"בהמתנה",mobilization:"בהנעה",infrastructure:"תשתיות",threading:"השחלות",threading_done:"בוצעו השחלות",installation_a:"התקנות א׳",installation_b:"התקנות ב׳",installation_c:"התקנות ג׳",activation_programming:"הפעלות ותכנות",finishes:"פינישים",post_delivery:"מוכן למסירה"};
const priorityLabels={low:"נמוכה",normal:"רגילה",high:"גבוהה",urgent:"דחופה"};
const relevanceLabels={assignee:"מבצע",owner:"אחראי",manager:"מנהל הפרויקט",related:"קשור אליי"};
const AUTOMATION_TRIGGERS=[
  {value:"project_created",label:"יצירת פרויקט"},
  {value:"project_stage_changed",label:"שינוי סטטוס פרויקט"},
  {value:"task_created",label:"יצירת משימה"},
  {value:"task_status_changed",label:"שינוי סטטוס משימה"},
  {value:"task_overdue",label:"משימה באיחור"},
];
const AUTOMATION_TRIGGER_LABELS=Object.fromEntries(AUTOMATION_TRIGGERS.map((trigger)=>[trigger.value,trigger.label]));
const AUTOMATION_FIELDS=[
  {value:"stage",label:"סטטוס פרויקט"},
  {value:"fromStage",label:"סטטוס קודם"},
  {value:"status",label:"סטטוס"},
  {value:"fromStatus",label:"סטטוס קודם של המשימה"},
  {value:"projectId",label:"פרויקט"},
  {value:"assignee",label:"אדם אחראי"},
];
const AUTOMATION_OPERATORS=[
  {value:"equals",label:"שווה ל"},
  {value:"not_equals",label:"לא שווה ל"},
  {value:"contains",label:"מכיל"},
  {value:"not_contains",label:"לא מכיל"},
  {value:"blank",label:"ערך ריק"},
  {value:"not_blank",label:"ערך לא ריק"},
];
const AUTOMATION_ACTION_TEMPLATES=[
  {value:"create_task",label:"יצירת משימה"},
  {value:"notify_manager",label:"משלוח הודעה למנהל"},
  {value:"set_project_stage",label:"עדכון שלב פרויקט"},
];
const automationDefaults=(triggerTypes=["task_overdue"])=>({
  name:"",
  triggerTypes,
  conditions:{logic:"OR",groups:[{logic:"AND",conditions:[{id:cryptoRandomId(),field:"status",operator:"equals",value:"open"}]}]},
  actions:[{id:cryptoRandomId(),type:"create_task",title:"",dueDays:1,priority:"high",critical:false,taskType:"task",description:""}],
});

function cryptoRandomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2,9)}`;
}

function formatTriggerLabel(values) {
  const list=Array.isArray(values)?values:[];
  return list.length
    ? list.map((item)=>AUTOMATION_TRIGGER_LABELS[item] || item).join(" + ")
    : "ללא טריגר";
}

function normalizeAutomationFromBackend(rule = {}) {
  const actions = Array.isArray(rule.actions) ? rule.actions.filter(Boolean) : [];
  const rawConditions = rule.conditions && typeof rule.conditions === "object" ? rule.conditions : {};
  const hasGroups = Array.isArray(rawConditions.groups);
  const groups = hasGroups
    ? rawConditions.groups.map((group) => ({
        ...group,
        logic: group.logic === "OR" ? "OR" : "AND",
        conditions: (Array.isArray(group.conditions) ? group.conditions : []).filter((item) => item && item.field),
      }))
    : [{
      logic:"AND",
      conditions:Object.entries(rawConditions)
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
        .map(([field, value], index) => ({
          id: cryptoRandomId(),
          field,
          operator: "equals",
          value,
          order: index,
        })),
    }];
  if (!groups.length || !groups[0].conditions.length) {
    groups[0]=groups[0] || { logic:"AND", conditions:[] };
    groups[0].conditions=[{id:cryptoRandomId(),field:"",operator:"blank",value:""}];
  }
  return {
    id: rule.id,
    name: rule.name || "",
    triggerTypes: Array.isArray(rule.trigger_types) && rule.trigger_types.length
      ? rule.trigger_types.filter(Boolean)
      : [rule.trigger_type || "task_overdue"],
    active: rule.active !== false,
    conditions: { ...rawConditions, logic:"OR", groups },
    actions: actions.map((action,index)=>({ ...action, id: action.id || cryptoRandomId(), order:index })),
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  };
}

function conditionToText(condition = {}) {
  const operator = AUTOMATION_OPERATORS.find((item)=>item.value===condition.operator)?.label || condition.operator;
  const fieldLabel = AUTOMATION_FIELDS.find((item)=>item.value===condition.field)?.label || condition.field;
  const value = condition.value ?? "";
  return `${fieldLabel} ${operator} ${value}`.trim();
}

function buildConditionSummary(conditions) {
  const logic = conditions?.logic === "AND" ? " AND " : " OR ";
  const groups = Array.isArray(conditions?.groups) ? conditions.groups : [];
  return groups
    .map((group)=>`(${(group.conditions || []).map(conditionToText).join(` ${group.logic === "OR" ? "OR" : "AND"} `) || "ללא תנאים"})`)
    .join(logic);
}

export function MyWorkWorkspace({api,user,projects,professionals,setNotice,openProject}){
  const [data,setData]=useState({sections:{overdue:[],today:[],upcoming:[],waiting:[]},stats:{},messages:[],followUps:[],attention:[]});
  const [loading,setLoading]=useState(true);const [section,setSection]=useState("all");const [projectId,setProjectId]=useState("");const [priority,setPriority]=useState("");
  const [views,setViews]=useState([]);const [editor,setEditor]=useState(null);const [undo,setUndo]=useState(null);
  const loadRequest=useRef(0);
  const load=useCallback(async({silent=false}={})=>{const requestId=++loadRequest.current;try{if(!silent)setLoading(true);const [work,saved]=await Promise.all([api("/my-work"),api("/saved-views?workspace=my-work")]);if(requestId!==loadRequest.current)return;setData(work);setViews(saved.views);}catch(error){if(requestId===loadRequest.current)setNotice(error.message)}finally{if(requestId===loadRequest.current)setLoading(false)}},[]);
  useEffect(()=>{load();const live=(event)=>{if(!["tasks","projects","user_messages","professionals"].includes(event.detail?.table))return;load({silent:true})};window.addEventListener("projects:live-change",live);return()=>window.removeEventListener("projects:live-change",live)},[load]);
  const source=section==='all'?Object.values(data.sections||{}).flat():data.sections[section]||[];
  const tasks=useMemo(()=>source.filter(task=>(!projectId||String(task.project_id)===projectId)&&(!priority||task.priority===priority)),[source,projectId,priority]);
  const update=async(task,patch,message)=>{try{await api(`/operations/tasks/${task.id}`,{method:"PATCH",body:JSON.stringify(patch)});setUndo({task,patch:{status:task.status},message});setNotice(message);await load({silent:true})}catch(error){setNotice(error.message)}};
  const saveView=async()=>{const name=prompt("שם לתצוגה השמורה");if(!name)return;try{await api("/saved-views",{method:"POST",body:JSON.stringify({workspace:"my-work",name,filters:{section,projectId,priority}})});setNotice("התצוגה נשמרה עבורך");load({silent:true})}catch(error){setNotice(error.message)}};
  const applyView=(view)=>{const filters=view.filters||{};setSection(filters.section||"overdue");setProjectId(String(filters.projectId||""));setPriority(filters.priority||"")};
  const saveTask=async(value)=>{try{await api(`/operations/tasks/${editor.id}`,{method:"PATCH",body:JSON.stringify(value)});setEditor(null);setNotice("המשימה עודכנה");load({silent:true})}catch(error){setNotice(error.message)}};
  const sections=[["all","הכול",data.stats.total,ListChecks],["overdue","באיחור",data.stats.overdue,ShieldAlert],["today","היום",data.stats.today,Clock3],["upcoming","בהמשך",(data.sections.upcoming||[]).length,ArrowLeft],["waiting","ממתינות לתלות",data.stats.waiting,Layers3]];
  const personalName=String(user?.displayName||user?.username||"").trim().split(/\s+/)[0]||"שלך";
  return <div className="productivity-page my-work-page">
    <section className="productivity-hero"><div><span><Sparkles size={16}/> מרכז העבודה של {personalName}</span><h2>מה דורש את תשומת הלב שלך עכשיו, {personalName}?</h2><p>זהו סדר היום האישי שלך: משימות, חסמים והודעות שרלוונטיים אליך — לפי דחיפות, בלי לחפש בכל פרויקט בנפרד.</p></div><button onClick={load} disabled={loading}><RefreshCw size={17} className={loading?"spin":""}/> רענון</button></section>
    <div className="work-focus-stats">{sections.map(([id,label,count,Icon])=><button key={id} className={section===id?"active":""} onClick={()=>setSection(id)}><Icon size={20}/><span>{label}</span><strong>{count||0}</strong></button>)}</div>
    <section className="productivity-toolbar panel"><div className="saved-view-strip"><button onClick={saveView}><Save size={16}/> שמירת תצוגה</button>{views.map(view=><button key={view.id} onClick={()=>applyView(view)}>{view.name}</button>)}</div><div><select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">כל הפרויקטים</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="">כל העדיפויות</option>{Object.entries(priorityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{(projectId||priority)&&<button onClick={()=>{setProjectId("");setPriority("")}}>ניקוי</button>}</div></section>
    <section className="my-work-list panel">{loading?<div className="productivity-empty"><RefreshCw className="spin"/>טוען את סביבת העבודה...</div>:tasks.length?tasks.map(task=>{const overdue=dateOnly(task.due_date)<new Date().toISOString().slice(0,10);return <article key={task.id} className={`focus-task ${task.critical?"critical":""} ${overdue?'overdue':''}`}><button className="task-complete" title="סימון כהושלמה" onClick={()=>update(task,{status:"done"},"המשימה הושלמה")}><Check size={18}/></button><div className="focus-task-main" onClick={()=>setEditor(task)}><span>{task.project_name||"ללא פרויקט"} <i className={`task-relevance ${task.relevance||"related"}`}>{relevanceLabels[task.relevance]||relevanceLabels.related}</i></span><strong>{task.title}</strong><small>{task.dependency_title?`ממתינה ל: ${task.dependency_title}`:`תאריך סיום: ${dayText(task.due_date)}`} · {priorityLabels[task.priority]||task.priority}</small></div><div className="focus-task-actions"><button onClick={()=>update(task,{dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10)},"המשימה הועברה למחר")}><Clock3 size={15}/> מחר</button><button onClick={()=>{const project=projects.find(item=>item.id===task.project_id);if(project)openProject(project)}}><FolderKanban size={15}/> פרויקט</button></div></article>}):<div className="productivity-empty"><CheckCircle2 size={34}/><strong>הכול מטופל בתצוגה הזו</strong><span>אפשר לעבור לתצוגה אחרת או להסיר מסננים.</span></div>}</section>
    {(data.followUps?.length>0||data.attention?.length>0)&&<section className="my-work-context-grid"><div className="panel"><header><CheckCircle2 size={18}/><strong>המשכי טיפול</strong><span>{data.followUps.length}</span></header>{data.followUps.slice(0,6).map(item=><button key={`${item.kind}-${item.id}`} onClick={()=>{const project=projects.find(project=>String(project.id)===String(item.project_id));if(project)openProject(project)}}><b>{item.project_name}</b><span>{item.follow_up}</span></button>)}</div><div className="panel"><header><ShieldAlert size={18}/><strong>דורש תשומת לב</strong><span>{data.attention.length}</span></header>{data.attention.slice(0,6).map(item=><button key={item.id} onClick={()=>{const project=projects.find(project=>String(project.id)===String(item.id));if(project)openProject(project)}}><b>{item.name}</b><span>{item.flag||`ציון בריאות ${item.health}`}</span></button>)}</div></section>}
    {!!data.messages.length&&<section className="attention-messages panel"><header><BellRing size={18}/><strong>הודעות שמחכות לך</strong><span>{data.messages.length}</span></header>{data.messages.slice(0,4).map(message=><button type="button" key={message.id} onClick={()=>{if(message.linked_url)window.location.assign(message.linked_url)}}><b>{message.subject}</b><span>{message.sender_name}</span></button>)}</section>}
    {undo&&<div className="productivity-undo"><span>{undo.message}</span><button onClick={async()=>{await api(`/operations/tasks/${undo.task.id}`,{method:"PATCH",body:JSON.stringify(undo.patch)});setUndo(null);load({silent:true})}}>ביטול פעולה</button><button onClick={()=>setUndo(null)}><X size={14}/></button></div>}
    {editor&&<TaskEditor api={api} setNotice={setNotice} projects={projects} professionals={professionals} initial={editor} onClose={()=>setEditor(null)} onSave={saveTask}/>}
  </div>
}

export function PortfolioControlWorkspace({api,setNotice,openProject,projects}){
  const [tab,setTab]=useState("health");const [health,setHealth]=useState([]);const [resources,setResources]=useState([]);const [loading,setLoading]=useState(true);
  const load=async()=>{try{setLoading(true);const [a,b]=await Promise.all([api("/portfolio-health"),api("/resource-workload")]);setHealth(a.projects);setResources(b.resources)}catch(error){setNotice(error.message)}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const counts=useMemo(()=>({good:health.filter(x=>x.health.tone==="good").length,warning:health.filter(x=>x.health.tone==="warning").length,risk:health.filter(x=>x.health.tone==="risk").length}),[health]);
  return <div className="productivity-page"><section className="productivity-hero"><div><span><Gauge size={16}/> בקרת ביצוע</span><h2>תמונה ניהולית שאפשר לפעול ממנה</h2><p>בריאות פרויקטים ועומסי צוות מחושבים מנתוני אמת ומתורגמים לפעולה הבאה.</p></div><button onClick={load}><RefreshCw size={17}/> רענון</button></section><nav className="productivity-tabs"><button className={tab==="health"?"active":""} onClick={()=>setTab("health")}><Gauge size={17}/> בריאות פרויקטים</button><button className={tab==="resources"?"active":""} onClick={()=>setTab("resources")}><Users size={17}/> עומסי צוות</button></nav>
    {loading?<div className="productivity-empty panel"><RefreshCw className="spin"/>מחשב תמונת מצב...</div>:tab==="health"?<><div className="health-summary"><article className="good"><strong>{counts.good}</strong><span>תקינים</span></article><article className="warning"><strong>{counts.warning}</strong><span>דורשים תשומת לב</span></article><article className="risk"><strong>{counts.risk}</strong><span>בסיכון</span></article></div><section className="portfolio-health-grid">{health.map(item=><article key={item.id} className={`panel health-project ${item.health.tone}`} onClick={()=>{const project=projects.find(p=>p.id===item.id);if(project)openProject(project)}}><header><div><span>{stageLabels[item.stage]||item.stage}</span><h3>{item.name}</h3><small>{item.manager||"ללא מנהל"}</small></div><strong>{item.health.score}</strong></header><div className="health-meter"><i style={{width:`${item.health.score}%`}}/></div><ul>{item.health.reasons.length?item.health.reasons.map(reason=><li key={reason}>{reason}</li>):<li>ללא חריגות מהותיות</li>}</ul><footer>{item.health.nextAction}<ArrowLeft size={16}/></footer></article>)}</section></>:<section className="resource-board panel"><header><span>עומס ל־14 הימים הקרובים</span><strong>קיבולת מול שעות מתוכננות</strong></header>{resources.map(item=><article key={item.id}><div className="resource-person"><i style={{background:item.color||"#6d5ce7"}}>{item.display_name?.slice(0,2)}</i><span><b>{item.display_name}</b><small>{item.task_count} משימות · {item.overdue_count} באיחור</small></span></div><div className="resource-load"><span><b>{Number(item.allocated_hours)} שעות</b> מתוך {item.capacity_hours}</span><div><i className={item.utilization>100?"over":""} style={{width:`${Math.min(100,item.utilization)}%`}}/></div></div><strong className={item.utilization>100?"over":""}>{item.utilization}%</strong></article>)}</section>}
  </div>
}

export function ProductivitySettings({ api, user, setNotice }) {
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("add");
  const [editingRule, setEditingRule] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const getEmptyCondition = () => ({ id: cryptoRandomId(), field: AUTOMATION_FIELDS[0]?.value || "status", operator: "equals", value: "", order: 0 });
  const getEmptyAction = () => ({ id: cryptoRandomId(), type: "create_task", title: "", dueDays: 1, priority: "normal", critical: false, taskType: "task", description: "" });
  const getEmptyRule = () => ({
    name: "",
    triggerTypes: ["task_overdue"],
    conditions: { logic: "OR", groups: [{ logic: "AND", conditions: [getEmptyCondition()] }], },
    actions: [getEmptyAction()],
  });

  const asMutableRule = (rule) => {
    const normalized = normalizeAutomationFromBackend(rule);
    const sortedGroups = (normalized.conditions?.groups || []).map((group) => ({
      ...group,
      conditions: (group.conditions || []).map((condition) => ({
        ...condition,
        order: Number.isFinite(Number(condition.order)) ? Number(condition.order) : 0,
      })).sort((a, b) => a.order - b.order),
    }));
    const sortedActions = (normalized.actions || []).map((action, index) => ({
      ...action,
      order: Number.isFinite(Number(action.order)) ? Number(action.order) : index,
    })).sort((a, b) => a.order - b.order);
    return {
      ...normalized,
      name: String(normalized.name || ""),
      triggerTypes: normalized.triggerTypes?.length ? normalized.triggerTypes : ["task_overdue"],
      conditions: normalized.conditions && Array.isArray(normalized.conditions.groups)
        ? { ...normalized.conditions, groups: sortedGroups }
        : { logic: "OR", groups: [{ logic: "AND", conditions: [getEmptyCondition()] }], },
      actions: sortedActions.length
        ? sortedActions.map((action) => ({ ...action, id: action.id || cryptoRandomId() }))
        : [getEmptyAction()],
      active: normalized.active !== false,
      id: normalized.id,
    };
  };

  const load = async () => {
    try {
      const [a, b] = await Promise.all([api("/project-templates"), api("/automation-rules")]);
      setTemplates(a.templates || []);
      setRules((b.rules || []).map(normalizeAutomationFromBackend));
      setRuns(b.runs || []);
    } catch (error) {
      setNotice(error.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const addTemplate = async () => {
    const name = window.prompt("שם תבנית:");
    if (!name) return;
    try {
      await api("/project-templates", { method: "POST", body: JSON.stringify({ name }) });
      setNotice("התבנית נוספה");
      load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const addTemplateTask = async (template) => {
    const title = window.prompt("כותרת משימה:");
    if (!title) return;
    try {
      await api(`/project-templates/${template.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, position: (template.tasks?.length || 0) + 1, durationDays: 1 }),
      });
      load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const addRule = () => {
    setEditorMode("add");
    setEditingRule(null);
    setDraft(getEmptyRule());
    setEditorOpen(true);
  };

  const editRule = (rule) => {
    setEditorMode("edit");
    setEditingRule(rule);
    setDraft(asMutableRule(rule));
    setEditorOpen(true);
  };

  const toggleRule = async (rule) => {
    try {
      await api(`/automation-rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !rule.active }),
      });
      load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const deleteRule = async (rule) => {
    if (!window.confirm("למחוק את האוטומציה?")) return;
    try {
      await api(`/automation-rules/${rule.id}`, { method: "DELETE" });
      load();
      setNotice("האוטומציה נמחקה");
    } catch (error) {
      setNotice(error.message);
    }
  };

  const applyRule = async () => {
    if (!draft || !draft.name?.trim()) {
      setNotice("שם האוטומציה חובה");
      return;
    }
    if (!draft.triggerTypes?.length) {
      setNotice("בחר לפחות טריגר אחד");
      return;
    }
    if (!draft.actions?.length) {
      setNotice("בחר לפחות פעולה אחת");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: String(draft.name).trim(),
        triggerTypes: draft.triggerTypes,
        conditions: draft.conditions,
        actions: draft.actions,
      };
      const url = editorMode === "edit" ? `/automation-rules/${draft.id}` : "/automation-rules";
      const method = editorMode === "edit" ? "PATCH" : "POST";
      await api(url, { method, body: JSON.stringify(payload) });
      setNotice(editorMode === "edit" ? "האוטומציה עודכנה" : "האוטומציה נוספה");
      setEditorOpen(false);
      load();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateTriggerType = (value, checked) => {
    const values = draft.triggerTypes || [];
    const next = checked ? Array.from(new Set([...values, value])) : values.filter((item) => item !== value);
    setDraft({ ...draft, triggerTypes: next });
  };

  const updateTopLogic = (logic) => {
    setDraft({ ...draft, conditions: { ...draft.conditions, logic: logic === "AND" ? "AND" : "OR" } });
  };

  const updateGroupLogic = (groupIndex, logic) => {
    const groups = [...draft.conditions.groups];
    groups[groupIndex] = { ...groups[groupIndex], logic: logic === "OR" ? "OR" : "AND" };
    setDraft({ ...draft, conditions: { ...draft.conditions, groups } });
  };

  const moveItem = (items = [], from = 0, to = 0) => {
    if (from === to) return items;
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    const item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    return next;
  };

  const addCondition = (groupIndex) => {
    const groups = [...draft.conditions.groups];
    const order = groups[groupIndex]?.conditions?.length || 0;
    groups[groupIndex] = {
      ...groups[groupIndex],
      conditions: [...(groups[groupIndex]?.conditions || []), { ...getEmptyCondition(), id: cryptoRandomId(), order }],
    };
    groups[groupIndex].conditions = groups[groupIndex].conditions.map((item, index) => ({ ...item, order: index }));
    setDraft({ ...draft, conditions: { ...draft.conditions, groups } });
  };

  const removeCondition = (groupIndex, conditionIndex) => {
    const groups = [...draft.conditions.groups];
    groups[groupIndex] = { ...groups[groupIndex], conditions: groups[groupIndex].conditions.filter((_, index) => index !== conditionIndex) };
    if (!groups[groupIndex].conditions.length) {
      groups[groupIndex].conditions = [{ ...getEmptyCondition(), id: cryptoRandomId(), order: 0 }];
    } else {
      groups[groupIndex].conditions = groups[groupIndex].conditions.map((item, index) => ({ ...item, order: index }));
    }
    setDraft({ ...draft, conditions: { ...draft.conditions, groups } });
  };

  const updateCondition = (groupIndex, conditionIndex, patch) => {
    const groups = [...draft.conditions.groups];
    const nextConditions = [...groups[groupIndex].conditions];
    nextConditions[conditionIndex] = { ...nextConditions[conditionIndex], ...patch };
    groups[groupIndex] = { ...groups[groupIndex], conditions: nextConditions };
    setDraft({ ...draft, conditions: { ...draft.conditions, groups } });
  };

  const moveCondition = (groupIndex, conditionIndex, direction) => {
    const groups = [...draft.conditions.groups];
    const source = groups[groupIndex];
    const nextConditions = moveItem(source.conditions || [], conditionIndex, conditionIndex + direction).map((item, index) => ({ ...item, order: index }));
    if (nextConditions === source.conditions) return;
    groups[groupIndex] = { ...source, conditions: nextConditions };
    setDraft({ ...draft, conditions: { ...draft.conditions, groups } });
  };

  const addConditionGroup = () => {
    const groups = [...(draft.conditions.groups || [])];
    groups.push({ logic: "AND", conditions: [{ ...getEmptyCondition(), id: cryptoRandomId(), order: 0 }] });
    setDraft({ ...draft, conditions: { ...draft.conditions, groups } });
  };

  const removeConditionGroup = (groupIndex) => {
    if ((draft.conditions.groups || []).length <= 1) return;
    const groups = [...draft.conditions.groups];
    groups.splice(groupIndex, 1);
    setDraft({ ...draft, conditions: { ...draft.conditions, groups } });
  };

  const addAction = () => {
    setDraft({
      ...draft,
      actions: [...(draft.actions || []), getEmptyAction()].map((action, index) => ({ ...action, order: index })),
    });
  };

  const removeAction = (index) => {
    if ((draft.actions || []).length <= 1) return;
    const actions = [...draft.actions];
    actions.splice(index, 1);
    setDraft({ ...draft, actions: actions.map((action, position) => ({ ...action, order: position })) });
  };

  const updateAction = (index, patch) => {
    const actions = [...draft.actions];
    actions[index] = { ...actions[index], ...patch };
    setDraft({ ...draft, actions });
  };

  const moveAction = (actionIndex, direction) => {
    const nextActions = moveItem(draft.actions || [], actionIndex, actionIndex + direction).map((action, index) => ({ ...action, order: index }));
    if (nextActions === (draft.actions || [])) return;
    setDraft({ ...draft, actions: nextActions });
  };

  return (
    <section className="productivity-settings">
      <nav className="productivity-tabs">
        <button className={tab === "templates" ? "active" : ""} onClick={() => setTab("templates")}>
          <Layers3 size={17} /> תבניות פרויקט
        </button>
        <button className={tab === "automations" ? "active" : ""} onClick={() => setTab("automations")}>
          <Bot size={17} /> אוטומציות
        </button>
      </nav>

      {tab === "templates" ? (
        <>
          <header className="settings-section-head">
            <div>
              <h3>תבניות עבודה</h3>
              <p>פתיחת פרויקט עם משימות, יעדים והגדרות מוכנות.</p>
            </div>
            <button onClick={addTemplate}><Plus size={16} /> תבנית חדשה</button>
          </header>
          <div className="template-grid">
            {templates.map((template) => (
              <article className="panel" key={template.id}>
                <header>
                  <span>{template.classification}</span>
                  <h4>{template.name}</h4>
                  <p>{template.description || "תבנית מותאמת"}</p>
                </header>
                <div>
                  <b>{template.task_count || 0}</b> משימות · <b>{template.installation_hours_target}</b> שעות התקנה
                </div>
                <button onClick={() => setSelectedTemplateId(selectedTemplateId === template.id ? null : template.id)}>
                  {selectedTemplateId === template.id ? "הסתרת משימות" : "צפייה במשימות"}
                </button>
                {selectedTemplateId === template.id && (
                  <ul>
                    {template.tasks.map((task) => (
                      <li key={task.id}>
                        <span>{task.position}. {task.title}</span>
                        <button
                          title="מחיקה"
                          onClick={async () => {
                            await api(`/project-templates/${template.id}/tasks/${task.id}`, { method: "DELETE" });
                            load();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                    <li>
                      <button onClick={() => addTemplateTask(template)}><Plus size={14} /> הוספת משימה</button>
                    </li>
                  </ul>
                )}
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <header className="settings-section-head">
            <div>
              <h3>אוטומציות תפעוליות</h3>
              <p>בונה ויזואלי: בחר טריגרים, תנאים ופעולות ללא טקסט חופשי.</p>
            </div>
            <button onClick={addRule}><Plus size={16} /> כלל חדש</button>
          </header>

          <div className="automation-list panel">
            {rules.map((rule) => (
              <article key={rule.id}>
                <i className={rule.active ? "on" : ""} />
                <div>
                  <strong>{rule.name}</strong>
                  <span>{formatTriggerLabel(rule.triggerTypes)} · {rule.actions?.length || 0} פעולות</span>
                  <small>{buildConditionSummary(rule.conditions)}</small>
                </div>
                <div className="automation-item-actions">
                  <button onClick={() => toggleRule(rule)}>{rule.active ? "פעילה" : "כבויה"}</button>
                  <button onClick={() => editRule(rule)}>ערוך</button>
                  {user?.role === "admin" && <button onClick={() => deleteRule(rule)}>מחק</button>}
                </div>
              </article>
            ))}
            {!rules.length && <div className="productivity-empty">לא הוגדרו אוטומציות</div>}
          </div>

          <div className="automation-runs panel">
            <h4>הרצות אחרונות</h4>
            {runs.slice(0, 8).map((run) => (
              <div key={run.id}>
                <span>{run.rule_name || "כלל שנמחק"}</span>
                <b className={run.outcome}>{run.outcome === "completed" ? "הושלם" : "נכשל"}</b>
                <small>{new Date(run.created_at).toLocaleString("he-IL")}</small>
              </div>
            ))}
          </div>
        </>
      )}

      {editorOpen && draft && (
        <AppModal className="automation-builder-modal" title={editorMode === "add" ? "יצירת כלל אוטומציה" : "עריכת כלל אוטומציה"} onClose={() => setEditorOpen(false)}>
          <form
            className="automation-builder"
            onSubmit={(event) => {
              event.preventDefault();
              applyRule();
            }}
          >
            <label>
              שם כלל
              <input
                required
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="לדוגמה: משימה חדשה כשאירוע איחור"
              />
            </label>

            <fieldset className="automation-triggers">
              <legend>טריגרים</legend>
              <div className="trigger-grid">
                {AUTOMATION_TRIGGERS.map((trigger) => (
                  <label key={trigger.value}>
                    <input
                      type="checkbox"
                      checked={draft.triggerTypes.includes(trigger.value)}
                      onChange={(event) => updateTriggerType(trigger.value, event.target.checked)}
                    />
                    {trigger.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <section className="automation-editor-block">
              <div className="automation-block-title">
                <h4>תנאים</h4>
                <div className="logic-toolbar">
                  <label>
                    לוגיקה בין קבוצות:
                    <select value={draft.conditions.logic || "OR"} onChange={(event) => updateTopLogic(event.target.value)}>
                      <option value="OR">OR</option>
                      <option value="AND">AND</option>
                    </select>
                  </label>
                  <button type="button" onClick={addConditionGroup}>הוסף קבוצה</button>
                </div>
              </div>

              {(draft.conditions.groups || []).map((group, groupIndex) => (
                <article key={`${groupIndex}-${group.logic || "AND"}`} className="automation-condition-group">
                  <header>
                    <div className="automation-group-headline">
                      <strong>קבוצה {groupIndex + 1}</strong>
                      <span className="automation-group-summary">{group.conditions?.length || 0} תנאים</span>
                    </div>
                    <div className="group-control">
                      <label>
                        בין תנאים:
                        <select value={group.logic || "AND"} onChange={(event) => updateGroupLogic(groupIndex, event.target.value)}>
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      </label>
                      <button type="button" onClick={() => removeConditionGroup(groupIndex)} disabled={(draft.conditions.groups || []).length <= 1}>מחק קבוצה</button>
                    </div>
                  </header>
                  {(group.conditions || []).map((condition, conditionIndex) => (
                    <div key={condition.id} className="automation-condition">
                      <div className="automation-reorder">
                        <button type="button" onClick={() => moveCondition(groupIndex, conditionIndex, -1)} disabled={conditionIndex === 0} title="הזז מעלה">
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" onClick={() => moveCondition(groupIndex, conditionIndex, 1)} disabled={conditionIndex === (group.conditions || []).length - 1} title="הזז מטה">
                          <ArrowDown size={14} />
                        </button>
                      </div>
                      <label>
                        שדה
                        <select
                          value={condition.field || ""}
                          onChange={(event) => updateCondition(groupIndex, conditionIndex, { field: event.target.value })}
                        >
                          {AUTOMATION_FIELDS.map((field) => (
                            <option key={field.value} value={field.value}>{field.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        אופרטור
                        <select
                          value={condition.operator || "equals"}
                          onChange={(event) => updateCondition(groupIndex, conditionIndex, { operator: event.target.value })}
                        >
                          {AUTOMATION_OPERATORS.map((operator) => (
                            <option key={operator.value} value={operator.value}>{operator.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        ערך
                        <input
                          value={condition.value || ""}
                          onChange={(event) => updateCondition(groupIndex, conditionIndex, { value: event.target.value })}
                          placeholder={condition.operator === "blank" || condition.operator === "not_blank" ? "השאר ריק" : "ערך להשוואה"}
                        />
                      </label>
                      <button type="button" className="inline-delete" onClick={() => removeCondition(groupIndex, conditionIndex)}>
                        הסר
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addCondition(groupIndex)}>הוסף תנאי</button>
                </article>
              ))}
            </section>

            <section className="automation-editor-block">
              <div className="automation-block-title">
                <h4>פעולות</h4>
                <button type="button" onClick={addAction}>הוסף פעולה</button>
              </div>
              {(draft.actions || []).map((action, actionIndex) => {
                const type = action.type || "create_task";
                return (
                    <article key={action.id} className="automation-action">
                    <header className="automation-item-headline">
                      <strong>פעולה {actionIndex + 1}</strong>
                      <div className="automation-actions-reorder">
                        <button type="button" onClick={() => moveAction(actionIndex, -1)} disabled={actionIndex === 0} title="הזז מעלה">
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" onClick={() => moveAction(actionIndex, 1)} disabled={actionIndex === (draft.actions || []).length - 1} title="הזז מטה">
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </header>
                    <label>
                      סוג פעולה
                      <select
                        value={type}
                        onChange={(event) => updateAction(actionIndex, { type: event.target.value })}
                      >
                        {AUTOMATION_ACTION_TEMPLATES.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>

                    {type === "create_task" ? (
                      <>
                        <label>
                          כותרת
                          <input
                            value={action.title || ""}
                            onChange={(event) => updateAction(actionIndex, { title: event.target.value })}
                          />
                        </label>
                        <label>
                          תיאור
                          <textarea
                            value={action.description || ""}
                            onChange={(event) => updateAction(actionIndex, { description: event.target.value })}
                          />
                        </label>
                        <div className="automation-action-row">
                          <label>
                            ימי סיום
                            <input
                              type="number"
                              min="0"
                              value={action.dueDays || 0}
                              onChange={(event) => updateAction(actionIndex, { dueDays: Number(event.target.value || 0) })}
                            />
                          </label>
                          <label>
                            עדיפות
                            <select
                              value={action.priority || "normal"}
                              onChange={(event) => updateAction(actionIndex, { priority: event.target.value })}
                            >
                              <option value="low">נמוכה</option>
                              <option value="normal">רגילה</option>
                              <option value="high">גבוהה</option>
                              <option value="urgent">דחופה</option>
                            </select>
                          </label>
                          <label>
                            סוג משימה
                            <select
                              value={action.taskType || "task"}
                              onChange={(event) => updateAction(actionIndex, { taskType: event.target.value })}
                            >
                              <option value="task">task</option>
                              <option value="milestone">milestone</option>
                              <option value="activity">activity</option>
                            </select>
                          </label>
                          <label className="inline-check">
                            <input
                              type="checkbox"
                              checked={Boolean(action.critical)}
                              onChange={(event) => updateAction(actionIndex, { critical: event.target.checked })}
                            />
                            קריטית
                          </label>
                        </div>
                      </>
                    ) : type === "set_project_stage" ? (
                      <>
                        <label>
                          שלב יעד
                          <select
                            value={action.targetStage || "waiting"}
                            onChange={(event) => updateAction(actionIndex, { targetStage: event.target.value })}
                          >
                            <option value="waiting">ממתין</option>
                            <option value="mobilization">הכנות</option>
                            <option value="infrastructure">תשתיות</option>
                            <option value="threading">השחלות</option>
                            <option value="installation_a">התקנה A</option>
                            <option value="installation_b">התקנה B</option>
                            <option value="installation_c">התקנה C</option>
                            <option value="activation_programming">הפעלות ותכנות</option>
                            <option value="finishes">פינישים</option>
                            <option value="post_delivery">מוכן למסירה</option>
                          </select>
                        </label>
                        <label>
                          סיבה (אופציונלי)
                          <input
                            value={action.reason || ""}
                            onChange={(event) => updateAction(actionIndex, { reason: event.target.value })}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label>
                          כותרת
                          <input
                            value={action.subject || ""}
                            onChange={(event) => updateAction(actionIndex, { subject: event.target.value })}
                          />
                        </label>
                        <label>
                          הודעה
                          <textarea
                            value={action.body || ""}
                            onChange={(event) => updateAction(actionIndex, { body: event.target.value })}
                          />
                        </label>
                        <label>
                          קישור (אופציונלי)
                          <input
                            value={action.linkedUrl || ""}
                            onChange={(event) => updateAction(actionIndex, { linkedUrl: event.target.value })}
                            placeholder="/project/ID"
                          />
                        </label>
                      </>
                    )}

                    <button type="button" className="inline-delete" onClick={() => removeAction(actionIndex)}>הסר פעולה</button>
                  </article>
                );
              })}
            </section>

            <footer className="automation-editor-actions">
              <button type="button" className="ops-secondary" onClick={() => setEditorOpen(false)}>ביטול</button>
              <button type="submit" className="ops-primary" disabled={saving}>{saving ? "שומר..." : "שמור"}</button>
            </footer>
          </form>
        </AppModal>
      )}
    </section>
  );
}
export function ProjectGovernancePanel({project,api,user,setNotice}){
  const canViewFinance=user?.financeAccess!==false;
  const [baselines,setBaselines]=useState([]);const [changes,setChanges]=useState([]);const [form,setForm]=useState({title:"",description:"",priceImpact:"",scheduleImpactDays:""});
  const load=async()=>{try{const [a,b]=await Promise.all([api(`/projects/${project.id}/baselines`),api(`/projects/${project.id}/change-requests`)]);setBaselines(a.baselines);setChanges(b.changes)}catch(error){setNotice(error.message)}};useEffect(()=>{load()},[project.id]);
  const createBaseline=async()=>{try{await api(`/projects/${project.id}/baselines`,{method:"POST",body:JSON.stringify({label:`תכנית בסיס ${new Date().toLocaleDateString("he-IL")}`})});setNotice("תכנית הבסיס נשמרה");load()}catch(error){setNotice(error.message)}};
  const createChange=async(event)=>{event.preventDefault();try{await api(`/projects/${project.id}/change-requests`,{method:"POST",body:JSON.stringify({...form,...(!canViewFinance?{priceImpact:""}:{}),status:"pending"})});setForm({title:"",description:"",priceImpact:"",scheduleImpactDays:""});setNotice("בקשת השינוי נפתחה");load()}catch(error){setNotice(error.message)}};
  const decide=async(change,status)=>{try{await api(`/projects/${project.id}/change-requests/${change.id}`,{method:"PATCH",body:JSON.stringify({status})});setNotice(status==="approved"?"השינוי אושר":"השינוי נדחה");load()}catch(error){setNotice(error.message)}};
  return <div className="governance-grid"><section className="panel baseline-card"><header><div><span><BarChart3 size={17}/> תכנית בסיס</span><h3>השוואת תכנון מול ביצוע</h3></div>{["admin","manager"].includes(user.role)&&<button onClick={createBaseline}><Save size={16}/> שמירת מצב נוכחי</button>}</header>{baselines.length?<div className="baseline-list">{baselines.map(item=><div key={item.id}><strong>{item.label}</strong><span>{new Date(item.created_at).toLocaleString("he-IL")}</span><small>{item.snapshot?.tasks?.length||0} משימות בנקודת הייחוס</small></div>)}</div>:<div className="productivity-empty">עדיין לא נשמרה תכנית בסיס. מומלץ לשמור לאחר אישור הלו״ז.</div>}</section><section className="panel change-card"><header><span><SlidersHorizontal size={17}/> בקרת שינויים</span><h3>{canViewFinance?"השפעה על זמן ותקציב לפני ביצוע":"השפעה על לוח הזמנים לפני ביצוע"}</h3></header><form onSubmit={createChange}><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="כותרת השינוי"/><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="מה השתנה ולמה?"/><div>{canViewFinance&&<label>השפעה כספית<input type="number" value={form.priceImpact} onChange={e=>setForm({...form,priceImpact:e.target.value})}/></label>}<label>השפעה בימים<input type="number" value={form.scheduleImpactDays} onChange={e=>setForm({...form,scheduleImpactDays:e.target.value})}/></label></div><button><Plus size={16}/> פתיחת בקשת שינוי</button></form><div className="change-list">{changes.map(change=><article key={change.id}><div><strong>{change.title}</strong><span>{change.status}{canViewFinance&&<> · ₪{Number(change.price_impact).toLocaleString("he-IL")}</>} · {change.schedule_impact_days} ימים</span></div>{change.status==="pending"&&["admin","manager"].includes(user.role)&&<aside><button onClick={()=>decide(change,"approved")}><Check size={15}/> אישור</button><button onClick={()=>decide(change,"rejected")}>דחייה</button></aside>}</article>)}</div></section></div>
}

