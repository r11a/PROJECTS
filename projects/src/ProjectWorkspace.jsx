import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  Building2,
  Castle,
  Camera,
  Check,
  CheckCircle2,
  Command,
  Download,
  Eye,
  Film,
  FileText,
  FileSpreadsheet,
  Flag,
  Home,
  House,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  PanelsTopLeft,
  Phone,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
  Timer,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { TasksWorkspace, FinanceWorkspace, TaskEditor } from "./Workspaces";
import { GanttTimeline } from "./GanttTimeline";
import { AppModal } from "./AppModal";
import { ProjectGovernancePanel } from "./ProductivityWorkspace";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { summarizeTimeEntries } from "./features/timeTracking/model";
import { formatDateIL, localDateValue } from "./dateTime";
import { PriorityImportWizard } from "./features/priority-import/PriorityImportWizard";
import { MeetingSummaryForm } from "./features/meetings/MeetingSummaryForm";
import { VoiceNotes, VoiceNotesToggle } from "./features/voice-notes/VoiceNotes";
import { SmartTextArea } from "./features/smart-input/SmartTextArea";
import { classificationLabel, priorityMoney } from "./features/priority-import/priorityImport";

const money = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const PROJECT_NAVIGATION_PROVIDER_KEY = "projects_navigation_provider_v1";
const NAVIGATION_OPTIONS = [
  { key: "google", label: "Google Maps", icon: "G", color: "#1A73E8" },
  { key: "apple", label: "Apple Maps", icon: "", color: "#111111" },
  { key: "waze", label: "Waze", icon: "W", color: "#33CCFF" },
];
const getNavigationProviderLabel = (key) =>
  NAVIGATION_OPTIONS.find((option) => option.key === key)?.label;
const getNavigationLabel = (project) =>
  [project.address, project.location, project.name, project.id]
    .filter(Boolean)
    .join(", ");
const getNavigationCoordinates = (project) => {
  const lat = Number(project?.lat);
  const lng = Number(project?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat},${lng}`;
};
const readNavigationProvider = () => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(PROJECT_NAVIGATION_PROVIDER_KEY) || "";
  } catch {
    return "";
  }
};
const saveNavigationProvider = (value) => {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(PROJECT_NAVIGATION_PROVIDER_KEY, value);
  } catch {
    // localStorage may be blocked on some environments.
  }
};
const buildNavigationUrl = (provider, project) => {
  const destination = getNavigationCoordinates(project) || getNavigationLabel(project);
  if (!destination) return "";
  if (provider === "google") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }
  if (provider === "waze") {
    const coords = getNavigationCoordinates(project);
    if (coords) {
      return `https://waze.com/ul?ll=${encodeURIComponent(coords)}&navigate=yes&z=12`;
    }
    return `https://www.waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`;
  }
  if (provider === "apple") {
    const destinationCoordinates = getNavigationCoordinates(project);
    if (destinationCoordinates) {
      return `https://maps.apple.com/?daddr=${encodeURIComponent(destinationCoordinates)}`;
    }
    return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`;
  }
  return "";
};
const openNavigation = (project, provider) => {
  const url = buildNavigationUrl(provider, project);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};
const dateText = (value) => {
  if (!value) return "ללא תאריך";
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? formatDateIL(value) : new Date(value).toLocaleDateString("he-IL");
};
const projectClassificationOptions = [
  ["private_house", "בית פרטי"],
  ["villa", "וילה"],
  ["cottage", "קוטג׳"],
  ["penthouse", "פנטהאוז"],
  ["apartment_building", "בניין משותף"],
  ["studio", "סטודיו"],
  ["duplex", "דופלקס"],
];
const projectIconOptions=[["home","בית"],["villa","וילה"],["cottage","קוטג׳"],["building","בניין"],["penthouse","פנטהאוז"],["studio","סטודיו"]];
function ProjectTypeIcon({project,size=27}){const key=project.projectIcon||project.projectClassification;const Icon={home:Home,private_house:Home,villa:Castle,cottage:House,building:Building2,apartment_building:Building2,penthouse:PanelsTopLeft,studio:Command,duplex:House}[key]||Home;return <Icon size={size}/>}
function Modal({ title, onClose, children }) {
  return <AppModal title={title} subtitle="כרטיס פרויקט" onClose={onClose}>{children}</AppModal>;
}
const newVoiceContext=()=>globalThis.crypto?.randomUUID?.()||`voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ProjectWorkspace({
  project,
  updateProject,
  archiveProject,
  api,
  apiRoot,
  user,
  projects,
  clients,
  professionals,
  stageOptions,
  setNotice,
  setPage,
  linkedTaskId = "",
  onLinkedTaskHandled,
}) {
  const [tab, setTab] = useState("overview");
  const [workspace, setWorkspace] = useState({
    tasks: [],
    milestones: [],
    payments: [],
    team: [],
    equipment: [],
    forms: [],
    files: [],
    updates: [],
    activity: [],
    reviews: [],
    meetings: [],
    timeEntries: [],
    priorityOrders: [],
  });
  const [bom,setBom]=useState([]);
  const [mentionUsers,setMentionUsers]=useState([]);
  const [note, setNote] = useState("");
  const [updateVoiceContext,setUpdateVoiceContext]=useState(newVoiceContext);
  const [reviewVoiceContext,setReviewVoiceContext]=useState(newVoiceContext);
  const [modal, setModal] = useState("");
  const [hoursReportRequest, setHoursReportRequest] = useState(0);
  const [previewFile,setPreviewFile]=useState(null);
  const [priorityOrderDetail,setPriorityOrderDetail]=useState(null);
  const [teamRoleId,setTeamRoleId]=useState("");
  const [teamQuery,setTeamQuery]=useState("");
  const [reference, setReference] = useState({ roles: [], equipment: [] });
  const [editClientMode, setEditClientMode] = useState("existing");
  const [editClientId, setEditClientId] = useState(project.clientId || "");
  const [editClientName, setEditClientName] = useState(project.client || "");
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [defaultNavigationProvider, setDefaultNavigationProvider] = useState(() =>
    readNavigationProvider()
  );
  const [rememberNavigation, setRememberNavigation] = useState(() =>
    Boolean(readNavigationProvider())
  );
  const canEdit = user.permissions?.projects === "write" || ["admin", "manager", "technician", "supervisor"].includes(user.role);
  const canManage = ["admin", "manager"].includes(user.role);
  const canImportPriority = ["admin", "manager", "supervisor"].includes(user.role) || user.permissions?.projects === "write";
  const load = async () => {
    try {
      const [nextWorkspace,bomResult]=await Promise.all([api(`/projects/${encodeURIComponent(project.id)}/workspace`),api(`/projects/${encodeURIComponent(project.id)}/bom`)]);
      setWorkspace(nextWorkspace);setBom(bomResult.items||[]);
    } catch (e) {
      setNotice(e.message);
    }
  };
  const updateBom=async(item,patch)=>{try{await api(`/projects/${project.id}/bom/${item.id}`,{method:'PATCH',body:JSON.stringify(patch)});setNotice('נתוני הביצוע עודכנו');load()}catch(error){setNotice(error.message)}};
  useEffect(() => {
    load();
    api('/team').then(result=>setMentionUsers(result.users||[])).catch(()=>{});
  }, [project.id]);
  useEffect(() => {
    const live = (event) => {
      if (["tasks","project_milestones","project_payments","project_equipment","project_professionals","client_files","project_updates","project_site_reviews","project_meeting_summaries","project_time_entries","priority_orders","priority_order_lines"].includes(event.detail?.table)) load();
    };
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, [project.id]);
  useEffect(() => {
    if (linkedTaskId) setTab("tasks");
  }, [linkedTaskId]);
  useEffect(() => {
    if (!modal) return;
    Promise.all([api("/professional-roles"), api("/equipment-catalog")])
      .then(([a, b]) => setReference({ roles: a.roles, equipment: b.items }))
      .catch((e) => setNotice(e.message));
  }, [modal]);
  const due = Number(project.value) - Number(project.paid);
  const completed = workspace.tasks.filter((x) => x.status === "done").length;
  const addUpdate = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    try {
      await api(`/projects/${project.id}/updates`, {
        method: "POST",
        body: JSON.stringify({ body: note, voiceContextId:updateVoiceContext }),
      });
      setNote("");
      setUpdateVoiceContext(newVoiceContext());
      setNotice("העדכון פורסם לצוות");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const addTeam = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/projects/${project.id}/team`, {
        method: "POST",
        body: JSON.stringify({
          professionalId: f.get("professionalId"),
          roleTypeId: f.get("roleTypeId"),
          isPrimary: f.get("isPrimary") === "on",
          notes: f.get("notes"),
        }),
      });
      setModal("");
      setNotice("איש הצוות שויך לפרויקט");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const createProfessionalAndAssign=async(e)=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const roleTypeId=Number(f.get('roleTypeId'));const body={displayName:f.get('displayName'),affiliation:f.get('affiliation'),companyName:f.get('companyName'),jobTitle:f.get('jobTitle'),phone:f.get('phone'),email:f.get('email'),roleIds:[roleTypeId]};
    try{
      let professionalId;
      try{const result=await api('/professionals',{method:'POST',body:JSON.stringify(body)});professionalId=result.professional.id;}
      catch(error){if(error.status!==409||error.body?.code!=='SIMILAR_PROFESSIONAL')throw error;const match=error.body.matches?.[0];if(match&&confirm(`${error.message}.\nאישור — איחוד ושיוך האדם הקיים.\nביטול — אפשרות ליצירת כרטיס נפרד.`)){await api(`/professionals/${match.id}/merge`,{method:'POST',body:JSON.stringify(body)});professionalId=match.id;}else if(confirm('ליצור בכל זאת כרטיס נפרד?')){const result=await api('/professionals',{method:'POST',body:JSON.stringify({...body,allowDuplicate:true})});professionalId=result.professional.id;}else return;}
      await api(`/projects/${project.id}/team`,{method:'POST',body:JSON.stringify({professionalId,roleTypeId})});setModal('');setNotice('איש המקצוע נשמר במאגר ושויך לפרויקט');load();
    }catch(error){setNotice(error.message)}
  };
  const addEquipment = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api(`/projects/${project.id}/equipment`, {
        method: "POST",
        body: JSON.stringify({
          catalogItemId: f.get("catalogItemId"),
          quantity: f.get("quantity"),
          location: f.get("location"),
          status: f.get("status"),
          serialNumber: f.get("serialNumber"),
          notes: f.get("notes"),
        }),
      });
      setModal("");
      setNotice("הציוד נוסף לפרויקט");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const addDocument = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    f.set("projectId", project.id);
    try {
      await api("/documents", { method: "POST", body: f });
      setModal("");
      setNotice("המסמך הועלה ושויך לפרויקט");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const uploadRecordFiles=async(files,title,category)=>{for(const file of files.filter(file=>file instanceof File&&file.size)){const body=new FormData();body.set('projectId',project.id);body.set('title',`${title} · ${file.name}`);body.set('category',category);body.set('file',file);await api('/documents',{method:'POST',body});}};
  const addReview=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api(`/projects/${project.id}/site-reviews`,{method:'POST',body:JSON.stringify({reviewDate:f.get('reviewDate'),performedBy:f.get('performedBy'),supervisionType:f.get('supervisionType'),summary:f.get('summary'),followUp:f.get('followUp'),hours:f.get('hours'),planUpdateRequired:f.get('planUpdateRequired')==='on',voiceContextId:reviewVoiceContext})});await uploadRecordFiles(f.getAll('attachments'),`ביקורת אתר ${f.get('reviewDate')}`,'ביקורת אתר');setReviewVoiceContext(newVoiceContext());setModal('');setNotice('ביקורת האתר, השעות והקבצים נשמרו');load()}catch(error){setNotice(error.message)}};
  const addMeeting=async(e,providedForm)=>{e.preventDefault();const f=providedForm||new FormData(e.currentTarget);try{const result=await api(`/projects/${project.id}/meetings`,{method:'POST',body:JSON.stringify({meetingAt:f.get('meetingAt'),attendees:f.get('attendees'),summary:f.get('summary'),followUp:f.get('followUp'),hours:f.get('hours'),voiceContextId:f.get('voiceContextId')})});const aiTasks=JSON.parse(String(f.get('aiTasks')||'[]'));if(aiTasks.length)await api(`/projects/${project.id}/meetings/${result.meeting.id}/tasks`,{method:'POST',body:JSON.stringify({tasks:aiTasks})});await uploadRecordFiles(f.getAll('attachments'),`סיכום פגישה ${String(f.get('meetingAt')).slice(0,10)}`,'סיכום פגישה');setModal('');setNotice(aiTasks.length?`סיכום הפגישה נשמר ונוצרו ${aiTasks.length} משימות`:'סיכום הפגישה, השעות והקבצים נשמרו');load()}catch(error){setNotice(error.message)}};
  const archiveDocument=async(file)=>{if(user.role!=='admin'||!confirm(`להעביר את "${file.title||file.original_name}" לסל המחזור ל־14 יום?`))return;try{await api(`/documents/${file.id}`,{method:'DELETE'});setNotice('המסמך הועבר לסל המחזור ל־14 יום');load()}catch(error){setNotice(error.message)}};
  const deleteTeam = async (x) => {
    if (!confirm(`להסיר את ${x.display_name} מהפרויקט?`)) return;
    try {
      await api(
        `/projects/${project.id}/team/${x.professional_id}/${x.role_type_id}`,
        { method: "DELETE" },
      );
      load();
    } catch (e) {
      setNotice(e.message);
    }
  };
  const deleteEquipment = async (x) => {
    if (!confirm(`להסיר את ${x.name}?`)) return;
    try {
      await api(`/projects/${project.id}/equipment/${x.id}`, {
        method: "DELETE",
      });
      load();
    } catch (e) {
      setNotice(e.message);
    }
  };
  const openProjectEdit = () => {
    setEditClientMode(project.clientId ? "existing" : "new");
    setEditClientId(project.clientId || "");
    setEditClientName(project.client || "");
    setModal("edit");
  };
  const editProject = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const patch = {
      name: f.get("name"),
      location: f.get("location"),
      address: f.get("address"),
      phone: f.get("phone"),
      email: f.get("email"),
      due: f.get("due"),
      nextMilestone: f.get("nextMilestone"),
      priority: f.get("priority"),
      flag: f.get("flag"),
      projectClassification: f.get("projectClassification")||project.projectClassification,
      projectCategory:f.get("projectCategory"),projectCategoryCustom:f.get("projectCategory")==='other'?f.get("projectCategoryCustom"):(project.projectCategoryCustom||""),projectProfile:f.get("projectCategory")==='other'?{workflowLabel:f.get("workflowLabel")||"",systemsLabel:f.get("systemsLabel")||"",areasLabel:f.get("areasLabel")||""}:(project.projectProfile||{}),
      projectIcon:f.get("projectIcon"),projectColor:f.get("projectColor"),installationLeadId:f.get("installationLeadId")||null,
      installationHoursTarget: Number(f.get("installationHoursTarget") || 0),
      programmingHoursTarget: Number(f.get("programmingHoursTarget") || 0),
    };
    if(user.financeAccess!==false)Object.assign(patch,{value:Number(f.get("value")||0),financeMode:f.get("financeMode"),paymentTerms:f.get("paymentTerms"),depositAmount:Number(f.get("depositAmount")||0),depositPaid:f.get("depositPaid")==="on",financeBreakdown:(project.systems||[]).map((name,index)=>({name,amount:Number(f.get(`systemAmount-${index}`)||0)}))});
    if (editClientMode === "new")
      patch.newClient = {
        name: editClientName,
        address: f.get("clientAddress"),
        phone: f.get("clientPhone"),
        email: f.get("clientEmail"),
        city: f.get("clientCity"),
      };
    else {
      patch.clientId = editClientId;
      patch.clientName = editClientName;
    }
    const saved = await updateProject(project.id, patch);
    if (saved) setModal("");
  };
  const toggleArchive = async () => {
    const action = project.archived
      ? "לשחזר את הפרויקט לרשימה הפעילה"
      : "להעביר את הפרויקט לארכיון";
    const warning =
      !project.archived && project.stage !== "completed"
        ? "\nהפרויקט אינו מסומן כהושלם. עדיין ניתן לארכב אותו."
        : "";
    if (!confirm(`${action}?${warning}`)) return;
    await archiveProject(project.id, !project.archived);
  };
  const toggleCompleted=async()=>{try{await api(`/projects/${project.id}/complete`,{method:"PATCH",body:JSON.stringify({completed:!project.completed})});setNotice(project.completed?"הפרויקט הוחזר לפעילים":"הפרויקט הועבר להסתיימו");window.dispatchEvent(new Event("projects:data-changed"));setPage("projects");}catch(error){setNotice(error.message)}};
  const requestNavigation = (nextProject = project) => {
    if (!nextProject?.id) return;
    setNavigationTarget(nextProject);
  };
  const runNavigation = (provider) => {
    if (!navigationTarget) return;
    if (rememberNavigation) saveNavigationProvider(provider);
    setDefaultNavigationProvider(provider);
    openNavigation(navigationTarget, provider);
    setNavigationTarget(null);
  };
  const tabs = [
    ["overview", "סקירה"],
    ["tasks", "משימות ואבני דרך"],
    ["gantt", "גאנט"],
    ["reviews", "ביקורות ופגישות"],
    ["hours", "שעות עבודה"],
    ["systems", "מערכות וצוות"],
    ["priority", "הזמנות Priority"],
    ["forms", "טפסים וקבצים"],
    ["finance", "כספים"],
    ["activity", "פעילות"],
    ["governance", "שינויים ובקרה"],
  ].filter(([key])=>key!=="finance"||user.financeAccess!==false);
  return (
    <div className="project-detail project-workspace">
      <div className="project-hero panel">
        <div className="project-identity">
          <div className="project-home-icon" style={{background:`${project.projectColor||'#6957df'}20`,color:project.projectColor||'#6957df'}}>
            <ProjectTypeIcon project={project}/>
          </div>
          <div>
            <div className="project-title-line">
              <h2>{project.name}</h2>
              {project.flag && (
                <span className="hero-flag">
                  <Flag size={14} />
                  {project.flag}
                </span>
              )}
            </div>
            <p>
              <UserRound size={15} />
              {project.client}
              <span>·</span>
              <button type="button" className="project-navigation-link" onClick={() => requestNavigation(project)} title="נווט לכתובת באפליקציית הניווט"><MapPin size={15} />{project.address}<small>נווט</small></button>
            </p>
          </div>
        </div>
        <div className="project-hero-actions">
          <button className="secondary-button" disabled={!canEdit||project.archived} onClick={toggleCompleted}><CheckCircle2 size={16}/>{project.completed?"החזרה לפעילים":"סימון כהסתיים"}</button>
          <button className="secondary-button" disabled={!canEdit} onClick={() => { setTab("hours"); setHoursReportRequest((current) => current + 1); }}>
            <Timer size={16}/>
            דיווח שעות
          </button>
          <button
            className="secondary-button"
            disabled={!canEdit}
            onClick={() => setTab("activity")}
          >
            <MessageSquare size={16} />
            הוספת עדכון
          </button>
        </div>
        <div className="hero-metrics">
          <div>
            <span>שלב נוכחי</span>
            <select
              disabled={!canEdit}
              value={project.stage}
              onChange={(e) =>
                updateProject(project.id, { stage: e.target.value })
              }
            >
              {(stageOptions.length
                ? stageOptions.map((i) => [i.metadata?.key || i.name, i.name])
                : [
                    ["planning", "תכנון"],
                    ["infrastructure", "תשתיות"],
                    ["installation", "התקנה"],
                    ["programming", "תכנות"],
                    ["handover", "לקראת מסירה"],
                    ["completed", "הושלם"],
                  ]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span>התקדמות</span>
            <strong>{project.progress}%</strong>
            <input
              disabled={!canEdit}
              type="range"
              min="0"
              max="100"
              value={project.progress}
              onChange={(e) =>
                updateProject(project.id, { progress: Number(e.target.value) })
              }
              style={{ "--range": `${project.progress}%` }}
            />
          </div>
          <div>
            <span>התקדמות קבלן</span>
            <strong className={`contractor-progress-value contractor-${project.contractorProgress || "waiting"}`}>
              {{ finishing: "עבודות גמר", carpentry: "הרכבות נגרות", waiting: "בהמתנה", infrastructure_paving: "סלילת תשתיות", drywall_paint: "עבודות גבס וצבע", stopped: "בעצירה" }[project.contractorProgress] || "בהמתנה"}
            </strong>
          </div>
          <div>
            <span>בריאות הפרויקט</span>
            <strong
              className={project.health < 70 ? "health-risk" : "health-good"}
            >
              {project.health}/100
            </strong>
            <small>
              {project.health < 70 ? "דורש תשומת לב" : "מתנהל כשורה"}
            </small>
          </div>
          <div>
            <span>מנהל פרויקט</span>
            <select
              className="project-manager-select"
              disabled={!canManage}
              value={project.managerId || ""}
              onChange={(e) =>
                updateProject(project.id, { managerId: e.target.value || null })
              }
            >
              <option value="">ללא מנהל</option>
              {professionals
                .filter(
                  (p) =>
                    p.active &&
                    p.affiliation === "company" &&
                    p.roles.some((r) => r.key === "project_manager"),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <span>משימות</span>
            <strong>
              {completed}/{workspace.tasks.length}
            </strong>
            <small>
              {
                workspace.tasks.filter(
                  (x) =>
                    x.status !== "done" && new Date(x.due_date) < new Date(),
                ).length
              }{" "}
              באיחור
            </small>
          </div>
        </div>
      </div>
      <div className="detail-tabs">
        {tabs.map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "tasks" && <em>{workspace.tasks.length}</em>}
          </button>
        ))}
      </div>
      {tab === "overview" && canManage && (
        <div className="project-management-bar panel">
          <div>
            {project.archived ? (
              <>
                <Archive size={18} />
                <span>
                  <strong>הפרויקט נמצא בארכיון</strong>
                  <small>
                    כל הנתונים נשמרו וניתן לשחזר אותו לרשימה הפעילה.
                  </small>
                </span>
              </>
            ) : (
              <>
                <Pencil size={18} />
                <span>
                  <strong>ניהול פרטי הפרויקט</strong>
                  <small>עריכת הפרויקט והלקוח המקושר נשמרת מיד במאגר.</small>
                </span>
              </>
            )}
          </div>
          <div>
            <button className="secondary-button" onClick={openProjectEdit}>
              <Pencil size={16} />
              עריכת פרויקט
            </button>
            <button
              className={`secondary-button archive-action ${project.archived ? "restore" : ""}`}
              onClick={toggleArchive}
            >
              {project.archived ? (
                <RotateCcw size={16} />
              ) : (
                <Archive size={16} />
              )}{" "}
              {project.archived ? "שחזור פרויקט" : "העברה לארכיון"}
            </button>
          </div>
        </div>
      )}
      {tab === "overview" && canManage && (
        <ProjectAttributesPanel
          project={project}
          updateProject={updateProject}
          api={api}
          setNotice={setNotice}
        />
      )}
      {tab === "overview" && canManage && (
        <GoogleAddressField
          project={project}
          api={api}
          updateProject={updateProject}
          setNotice={setNotice}
        />
      )}
      {tab === "overview" && canEdit && (
        <ProjectPhotoUpdate
          project={project}
          api={api}
          setNotice={setNotice}
          onDone={load}
        />
      )}
      {tab === "hours" && (
        <ProjectHoursPanel project={project} entries={workspace.timeEntries || []} professionals={professionals} api={api} setNotice={setNotice} onDone={load} canEdit={canEdit} openRequest={hoursReportRequest}/>
      )}
      {tab === "governance" && <ProjectGovernancePanel project={project} api={api} user={user} setNotice={setNotice}/>}
      {tab === "overview" && (
        <div className="detail-grid">
          <div className="detail-main">
            <div className="panel overview-card">
              <div className="panel-head">
                <div>
                  <h3>אבני הדרך הקרובות</h3>
                  <span>{workspace.milestones.length} אבני דרך בפרויקט</span>
                </div>
                <button onClick={() => setTab("tasks")}>ניהול מלא</button>
              </div>
              <div className="milestone-timeline">
                {workspace.milestones.length ? (
                  workspace.milestones.slice(0, 6).map((m) => (
                    <div
                      className={
                        m.status === "completed"
                          ? "done"
                          : m.status === "in_progress"
                            ? "current"
                            : "future"
                      }
                      key={m.id}
                    >
                      <span>
                        {m.status === "completed" ? <Check size={14} /> : ""}
                      </span>
                      <div>
                        <strong>{m.title}</strong>
                        <small>
                          {dateText(m.due_date)} · {m.owner_name || "ללא אחראי"}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="inline-empty">
                    טרם הוגדרו אבני דרך. ניתן להוסיף בלשונית המשימות.
                  </div>
                )}
              </div>
            </div>
            <div className="panel systems-card">
              <div className="panel-head">
                <div>
                  <h3>מערכות וציוד</h3>
                  <span>ציוד שהוקצה בפועל לפרויקט</span>
                </div>
                <button onClick={() => setTab("systems")}>ניהול מערכות</button>
              </div>
              <div className="system-tiles">
                {workspace.equipment.slice(0, 6).map((x, i) => (
                  <div key={x.id}>
                    <span className={`system-icon s${i % 4}`}>
                      <Command size={18} />
                    </span>
                    <strong>{x.name}</strong>
                    <small>
                      {x.location || x.status} · {x.quantity} {x.unit}
                    </small>
                    <CheckCircle2 size={17} />
                  </div>
                ))}
                {!workspace.equipment.length && (
                  <div className="inline-empty">
                    אין עדיין ציוד משויך לפרויקט.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="detail-side">
            <div className="panel contact-card">
              <div className="panel-head">
                <div>
                  <h3>פרטי לקוח</h3>
                </div>
              </div>
              <div className="contact-person">
                <div className="client-avatar">
                  {project.client.slice(0, 2)}
                </div>
                <div>
                  <strong>{project.client}</strong>
                  <span>לקוח ראשי</span>
                </div>
              </div>
              {project.phone && (
                <a href={`tel:${project.phone}`}>
                  <Phone size={16} />
                  {project.phone}
                </a>
              )}
              {project.email && (
                <a href={`mailto:${project.email}`}>
                  <Mail size={16} />
                  {project.email}
                </a>
              )}
              <p>
                <MapPin size={16} />
                {project.address}
              </p>
              <button onClick={() => setPage("clients")}>
                פתיחת מאגר הלקוחות
              </button>
            </div>
            {user.financeAccess!==false&&<div className="panel money-summary">
              <div className="panel-head">
                <div>
                  <h3>סיכום כספי</h3>
                </div>
              </div>
              <div>
                <span>שווי הפרויקט</span>
                <strong>{money.format(project.value)}</strong>
              </div>
              <div>
                <span>שולם עד כה</span>
                <strong className="green-text">
                  {money.format(project.paid)}
                </strong>
              </div>
              <div className="due-row">
                <span>יתרה לגבייה</span>
                <strong>{money.format(due)}</strong>
              </div>
              <div className="money-progress">
                <i
                  style={{
                    width: `${project.value ? (project.paid / project.value) * 100 : 0}%`,
                  }}
                />
              </div>
              <button onClick={() => setTab("finance")}>לפירוט תשלומים</button>
            </div>}
            <form className="panel quick-notes" onSubmit={addUpdate}>
              <div className="panel-head">
                <div>
                  <h3>עדכון מהיר לצוות</h3>
                </div>
              </div>
              <SmartTextArea api={api} value={note} onChange={setNote} setNotice={setNotice} label="תוכן העדכון" textareaProps={{placeholder:"מה קרה, מה הוחלט ומה הפעולה הבאה?"}}/>
              <VoiceNotes api={api} apiRoot={apiRoot} entityType="project_update_draft" entityId={updateVoiceContext} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/>
              <button disabled={!note.trim()}>פרסום עדכון</button>
            </form>
          </div>
        </div>
      )}
      {tab === "tasks" && (
        <TasksWorkspace
          api={api}
          user={user}
          projects={projects}
          professionals={professionals}
          setNotice={setNotice}
          projectId={project.id}
          onDataChanged={load}
          initialTaskId={linkedTaskId}
          onInitialTaskOpened={onLinkedTaskHandled}
        />
      )}
      {tab === "gantt" && (
        <CommercialProjectGantt
          tasks={workspace.tasks}
          milestones={workspace.milestones}
          project={project}
          projects={projects}
          professionals={professionals}
          api={api}
          setNotice={setNotice}
          onDataChanged={load}
          users={mentionUsers.filter(item=>String(item.id)!==String(user.id))}
        />
      )}
      {tab === "finance" && user.financeAccess!==false && (
        <FinanceWorkspace
          api={api}
          user={user}
          projects={projects}
          setNotice={setNotice}
          projectId={project.id}
        />
      )}
      {tab === "systems" && (
        <div className="project-two-columns">
          <section className="panel project-resource project-bom"><div className="panel-head"><div><h3>BOM לפי מערכות</h3><span>הוזמן, הותקן, תוכנת ויתרה לביצוע</span></div></div>{[...new Map(bom.map((item)=>[item.project_system_id||'none',{name:item.system_name||'ללא מערכת',color:item.system_color||'#6957df'}])).entries()].map(([systemId,system])=><div className="bom-system" key={systemId}><header style={{borderInlineStartColor:system.color}}><strong>{system.name}</strong></header><div className="bom-head"><span>פריט</span><span>הוזמן</span><span>הותקן</span><span>תוכנת</span><span>יתרה</span></div>{bom.filter((item)=>String(item.project_system_id||'none')===String(systemId)).map((item)=><article key={item.id}><div><strong>{item.name}</strong><small>{item.priority_sku||item.code}</small></div><b>{item.ordered}</b><input type="number" min="0" max={item.ordered} step="1" value={item.installed} disabled={!canEdit} onChange={(event)=>setBom((current)=>current.map((row)=>row.id===item.id?{...row,installed:Number(event.target.value),remaining:Math.max(0,row.ordered-Number(event.target.value))}:row))} onBlur={(event)=>updateBom(item,{installed:Number(event.target.value),programmed:item.programmed})}/><input type="number" min="0" max={item.installed} step="1" value={item.programmed} disabled={!canEdit} onChange={(event)=>setBom((current)=>current.map((row)=>row.id===item.id?{...row,programmed:Number(event.target.value)}:row))} onBlur={(event)=>updateBom(item,{installed:item.installed,programmed:Number(event.target.value)})}/><strong className={item.remaining?'remaining':''}>{item.remaining}</strong></article>)}</div>)}</section>
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>צוות הפרויקט</h3>
                <span>עובדי חברה ואנשי מקצוע חיצוניים</span>
              </div>
              {canManage && (
                <button onClick={() => setModal("team")}>
                  <Plus size={15} />
                  שיוך איש צוות
                </button>
              )}
            </div>
            {workspace.team.length ? (
              workspace.team.map((x) => (
                <div
                  className="resource-row"
                  key={`${x.professional_id}-${x.role_type_id}`}
                >
                  <span
                    className="resource-avatar"
                    style={{ background: x.color }}
                  >
                    {x.display_name.slice(0, 2)}
                  </span>
                  <div>
                    <strong>{x.display_name}</strong>
                    <small>
                      {x.role_name} {x.is_primary && "· אחראי ראשי"}
                    </small>
                  </div>
                  {x.phone && (
                    <a className="team-phone-action" href={`tel:${x.phone}`} title={`חיוג אל ${x.display_name}`} aria-label={`חיוג אל ${x.display_name}`}>
                      <Phone size={16} />
                    </a>
                  )}
                  {user.role === "admin" && (
                    <button onClick={() => deleteTeam(x)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="inline-empty">טרם שויך צוות לפרויקט.</div>
            )}
          </section>
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>מערכות, ציוד ורכיבים</h3>
                <span>כמות, מיקום, סטטוס ומספר סידורי</span>
              </div>
              {canEdit && (
                <button onClick={() => setModal("equipment")}>
                  <Plus size={15} />
                  הוספת ציוד
                </button>
              )}
            </div>
            {workspace.equipment.length ? (
              workspace.equipment.map((x) => (
                <div className="resource-row resource-row-preview" key={x.id} role="button" tabIndex={0} onClick={()=>setPreviewFile(x)} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setPreviewFile(x)}}}>
                  <span className="resource-avatar equipment">
                    <Command size={17} />
                  </span>
                  <div>
                    <strong>{x.name}</strong>
                    <small>
                      {x.manufacturer} {x.model} · {x.quantity} {x.unit} ·{" "}
                      {x.location || "ללא מיקום"}
                    </small>
                  </div>
                  <span className="resource-status">{x.status}</span>
                  {user.role === "admin" && (
                    <button onClick={() => deleteEquipment(x)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="inline-empty">טרם שויך ציוד לפרויקט.</div>
            )}
          </section>
        </div>
      )}
      {tab === "priority" && (
        <section className="panel project-resource priority-orders-page">
          <div className="panel-head">
            <div><h3>הזמנות Priority</h3><span>היסטוריית הזמנות, שורות מקור, ציוד ושעות ייחוס</span></div>
            {canImportPriority && <button onClick={() => setModal("priority-import")}><FileSpreadsheet size={16}/>ייבוא הזמנה</button>}
          </div>
          {workspace.priorityOrders?.length ? workspace.priorityOrders.map((order) => <article className="priority-order-row" key={order.id}>
            <span><FileSpreadsheet size={20}/></span>
            <div><strong>{order.priorityOrderNumber}</strong><small>{order.customerName || project.client} · {order.orderStatus || "ללא סטטוס"} · {dateText(order.orderDate || order.createdAt)} · {order.selectedCount}/{order.lineCount} שורות</small></div>
            {order.totalAmount !== undefined && <strong>{priorityMoney.format(order.totalAmount)}</strong>}
            <button type="button" onClick={async()=>{try{setPriorityOrderDetail(await api(`/projects/${encodeURIComponent(project.id)}/priority-orders/${order.id}`))}catch(error){setNotice(error.message)}}}>צפייה</button>
          </article>) : <div className="priority-order-empty"><FileSpreadsheet size={38}/><p>טרם יובאו הזמנות Priority לפרויקט.</p>{canImportPriority&&<button className="primary-button" onClick={()=>setModal("priority-import")}>ייבוא הזמנה ראשונה</button>}</div>}
        </section>
      )}
      {tab === "forms" && (
        <div className="project-two-columns">
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>טפסי הפרויקט</h3>
                <span>טיוטות, טפסים שהושלמו ואישורים</span>
              </div>
              <button onClick={() => setPage("forms")}>
                <Plus size={15} />
                טופס חדש
              </button>
            </div>
            {workspace.forms.length ? (
              workspace.forms.map((x) => (
                <div className="resource-row" key={x.id}>
                  <span className="resource-avatar equipment file-thumb">
                    {x.mime_type?.startsWith('image/')?<img src={`${apiRoot}/documents/${x.id}/preview`} alt=""/>:<FileText size={17} />}
                  </span>
                  <div>
                    <strong>{x.title}</strong>
                    <small>
                      {x.template_name} · {dateText(x.updated_at)}
                    </small>
                  </div>
                  <span className={`resource-status ${x.status}`}>
                    {x.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="inline-empty">
                אין טפסים המשויכים לפרויקט. יצירה מתוך מאגר הטפסים תשייך אותם
                אוטומטית.
              </div>
            )}
          </section>
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>קבצים ומסמכים</h3>
                <span>תוכניות, הזמנות, סריקות ותיעוד</span>
              </div>
              {canEdit && (
                <button onClick={() => setModal("document")}>
                  <Upload size={15} />
                  העלאה לפרויקט
                </button>
              )}
            </div>
            {workspace.files.length ? (
              workspace.files.map((x) => (
                <div className="resource-row" key={x.id}>
                  <span className="resource-avatar equipment file-thumb">
                    {x.mime_type?.startsWith('image/')?<img src={`${apiRoot}/documents/${x.id}/preview`} alt="" loading="lazy"/>:x.mime_type?.startsWith('video/')?<Film size={17}/>:<FileText size={17} />}
                  </span>
                  <div>
                    <strong>{x.title || x.original_name}</strong>
                    <small>
                      {x.category} · {dateText(x.created_at)} · {x.uploaded_by_name || 'מערכת'} ·{" "}
                      {(Number(x.size_bytes) / 1024 / 1024).toFixed(1)} MB
                    </small>
                  </div>
                  <button onClick={(event)=>{event.stopPropagation();setPreviewFile(x)}} title="פתיחה / תצוגה">
                    <Eye size={16} />
                  </button>
                  {user.role==='admin'&&<button className="danger-icon" onClick={(event)=>{event.stopPropagation();archiveDocument(x)}} title="העברה לסל המחזור"><Trash2 size={16}/></button>}
                  <a
                    href={`${apiRoot}/documents/${x.id}/download`}
                    onClick={(event)=>event.stopPropagation()}
                    title="הורדה"
                  >
                    <Download size={16} />
                  </a>
                </div>
              ))
            ) : (
              <div className="inline-empty">אין מסמכים בפרויקט.</div>
            )}
          </section>
        </div>
      )}
      {tab === "reviews"&&<div className="project-two-columns execution-records">
        <section className="panel project-resource"><div className="panel-head"><div><h3>ביקורות אתר</h3><span>פיקוח, ממצאים ועדכון תוכניות</span></div>{canEdit&&<button onClick={()=>setModal('review')}><Plus size={15}/>ביקורת</button>}</div>{workspace.reviews.length?workspace.reviews.map(x=><article className="execution-card" key={x.id}><header><strong>{dateText(x.review_date)} · {x.supervision_type||'פיקוח אתר'}</strong><small>{x.performed_by_name||x.created_by_name||'לא צוין'}</small></header><p>{x.summary}</p>{x.follow_up&&<footer>המשך טיפול: {x.follow_up}</footer>}{x.plan_update_required&&<b>נדרש עדכון תכנית</b>}<VoiceNotesToggle api={api} apiRoot={apiRoot} entityType="site_review" entityId={x.id} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/></article>):<div className="inline-empty">טרם תועדו ביקורות אתר.</div>}</section>
        <section className="panel project-resource"><div className="panel-head"><div><h3>סיכומי פגישות</h3><span>נוכחים, החלטות והמשך טיפול</span></div>{canEdit&&<button onClick={()=>setModal('meeting')}><Plus size={15}/>פגישה</button>}</div>{workspace.meetings.length?workspace.meetings.map(x=><article className="execution-card" key={x.id}><header><strong>{new Date(x.meeting_at).toLocaleString('he-IL')}</strong><small>{x.attendees||'לא צוינו נוכחים'}</small></header><p>{x.summary}</p>{x.follow_up&&<footer>המשך טיפול: {x.follow_up}</footer>}<VoiceNotesToggle api={api} apiRoot={apiRoot} entityType="meeting" entityId={x.id} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/></article>):<div className="inline-empty">טרם נשמרו סיכומי פגישות.</div>}</section>
      </div>}
      {tab === "activity" && (
        <div className="project-two-columns activity-layout">
          <form className="panel project-update-form" onSubmit={addUpdate}>
            <h3>פרסום עדכון</h3>
            <p>העדכון נשמר בהיסטוריה ומופיע לכל מי שמורשה לצפות בפרויקט.</p>
            <SmartTextArea api={api} value={note} onChange={setNote} setNotice={setNotice} label="תוכן העדכון" textareaProps={{placeholder:'סיכום ביקור, החלטה, חריגה או הנחיה לביצוע'}}/>
            <VoiceNotes api={api} apiRoot={apiRoot} entityType="project_update_draft" entityId={updateVoiceContext} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/>
            <div className="project-mention-picker"><small>תיוג משתמש:</small>{mentionUsers.filter(item=>item.active&&String(item.id)!==String(user.id)).map(item=><button type="button" key={item.id} onClick={()=>setNote(current=>`${current}${current&&!current.endsWith(' ')?' ':''}@${item.displayName} `)}>@{item.displayName}</button>)}</div>
            <button className="ops-primary" disabled={!note.trim()}>
              <MessageSquare size={16} />
              פרסום לצוות
            </button>
          </form>
          <section className="panel project-timeline">
            <div className="panel-head">
              <div>
                <h3>יומן פעילות</h3>
                <span>עדכונים ופעולות מערכת</span>
              </div>
            </div>
            {[
              ...workspace.updates.map((x) => ({
                ...x,
                kind: "update",
                when: x.created_at,
              })),
              ...workspace.activity.map((x) => ({
                ...x,
                kind: "audit",
                when: x.created_at,
              })),
            ]
              .sort((a, b) => new Date(b.when) - new Date(a.when))
              .slice(0, 100)
              .map((x, i) => (
                <div className="timeline-row" key={`${x.kind}-${x.id}-${i}`}>
                  <span>
                    <Activity size={15} />
                  </span>
                  <div>
                    <strong>
                      {x.kind === "update"
                        ? x.body
                        : `${x.user_name || "מערכת"} · ${x.action}`}
                    </strong>
                    <small>
                      {x.kind === "update"
                        ? x.created_by_name || "משתמש"
                        : x.entity_type}{" "}
                      · {new Date(x.when).toLocaleString("he-IL")}
                    </small>
                  </div>
                </div>
              ))}
          </section>
        </div>
      )}
      {modal==='review'&&<Modal title="ביקורת אתר חדשה" onClose={()=>setModal('')}><form className="work-form" onSubmit={addReview}><label>תאריך פיקוח<input type="date" name="reviewDate" required defaultValue={localDateValue()}/></label><label>סוג פיקוח<input name="supervisionType" placeholder="פיקוח תשתיות / התקנות / מסירה"/></label><label>מי ביצע<select name="performedBy"><option value="">בחירה מהמאגר</option>{professionals.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label><label>שעות פיקוח<input type="number" name="hours" min="0" max="24" step="0.25" placeholder="0"/></label><label className="wide">ממצאים וסיכום<textarea name="summary" required rows="5"/></label><label className="wide">המשך טיפול<textarea name="followUp" rows="3"/></label><div className="wide"><VoiceNotes api={api} apiRoot={apiRoot} entityType="site_review_draft" entityId={reviewVoiceContext} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/></div><label className="wide">תמונות, סקיצה או תכנית מעודכנת<input type="file" name="attachments" accept="image/*,application/pdf,.dwg,.dxf" multiple/></label><label className="wide check-label"><input type="checkbox" name="planUpdateRequired"/>נדרש עדכון תכנית</label><div className="wide form-actions"><button type="button" className="ops-secondary" onClick={()=>setModal('')}>ביטול</button><button className="ops-primary">שמירת ביקורת</button></div></form></Modal>}
      {modal==='meeting'&&<MeetingSummaryForm api={api} apiRoot={apiRoot} project={project} professionals={professionals} setNotice={setNotice} onClose={()=>setModal('')} onSubmit={addMeeting}/>}
      {modal === "team" && (
        <Modal title="שיוך איש צוות" onClose={() => setModal("")}>
          <form className="work-form" onSubmit={addTeam}>
            <div className="wide form-inline-note"><button type="button" className="ops-secondary" onClick={()=>setModal('new-professional')}><Plus size={15}/>איש מקצוע חדש</button></div>
            <label>
              תפקיד בפרויקט
              <select name="roleTypeId" required value={teamRoleId} onChange={(event)=>setTeamRoleId(event.target.value)}>
                <option value="">בחירת תפקיד</option>
                {reference.roles.filter((r)=>r.active).map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label>
              חיפוש במאגר
              <input value={teamQuery} onChange={(event)=>setTeamQuery(event.target.value)} placeholder="שם, חברה או טלפון" />
            </label>
            <label>
              איש מקצוע מתאים
              <select name="professionalId" required>
                <option value="">בחירה מהמאגר</option>
                {professionals
                  .filter((p) => p.active && (!teamRoleId || p.roles?.some((role)=>String(role.id)===String(teamRoleId))) && (!teamQuery || `${p.displayName} ${p.companyName||''} ${p.phone||''}`.toLowerCase().includes(teamQuery.toLowerCase())))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} · {p.companyName || "עובד חברה"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="wide check-label">
              <input type="checkbox" name="isPrimary" />
              אחראי ראשי בתפקיד זה
            </label>
            <label className="wide">
              הערות
              <textarea name="notes" />
            </label>
            <div className="wide form-actions">
              <button
                type="button"
                className="ops-secondary"
                onClick={() => setModal("")}
              >
                ביטול
              </button>
              <button className="ops-primary">שיוך לפרויקט</button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "new-professional"&&<Modal title="איש מקצוע חדש ושיוך לפרויקט" onClose={()=>setModal('')}><form className="work-form" onSubmit={createProfessionalAndAssign}><label>שם מלא<input name="displayName" required autoFocus/></label><label>שיוך<select name="affiliation"><option value="external">חיצוני</option><option value="company">עובד חברה</option></select></label><label>חברה<input name="companyName"/></label><label>תפקיד חופשי<input name="jobTitle"/></label><label>טלפון<input name="phone" inputMode="tel"/></label><label>דוא״ל<input name="email" type="email"/></label><label className="wide">תפקיד בפרויקט<select name="roleTypeId" required><option value="">בחירת תפקיד</option>{reference.roles.filter(role=>role.active).map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label><div className="wide form-actions"><button type="button" className="ops-secondary" onClick={()=>setModal('team')}>חזרה</button><button className="ops-primary">שמירה ושיוך</button></div></form></Modal>}
      {modal === "equipment" && (
        <Modal title="הוספת ציוד לפרויקט" onClose={() => setModal("")}>
          <form className="work-form" onSubmit={addEquipment}>
            <label className="wide">
              פריט קטלוג
              <select name="catalogItemId" required>
                <option value="">בחירה מהקטלוג</option>
                {reference.equipment
                  .filter((x) => x.active)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} {x.manufacturer} {x.model}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              כמות
              <input
                name="quantity"
                type="number"
                min="0"
                step="0.1"
                defaultValue="1"
              />
            </label>
            <label>
              מיקום בפרויקט
              <input name="location" placeholder="למשל: ארון תקשורת קומה 1" />
            </label>
            <label>
              סטטוס
              <select name="status">
                <option value="planned">מתוכנן</option>
                <option value="ordered">הוזמן</option>
                <option value="delivered">סופק</option>
                <option value="installed">הותקן</option>
                <option value="tested">נבדק</option>
              </select>
            </label>
            <label>
              מספר סידורי
              <input name="serialNumber" />
            </label>
            <label className="wide">
              הערות
              <textarea name="notes" />
            </label>
            <div className="wide form-actions">
              <button
                type="button"
                className="ops-secondary"
                onClick={() => setModal("")}
              >
                ביטול
              </button>
              <button className="ops-primary">הוספה לפרויקט</button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "document" && (
        <Modal title="העלאת מסמך לפרויקט" onClose={() => setModal("")}>
          <form className="work-form" onSubmit={addDocument}>
            <label className="wide document-drop">
              <Upload size={23} />
              <strong>בחירת קובץ עד 100MB</strong>
              <input name="file" type="file" required />
            </label>
            <label>
              כותרת
              <input name="title" placeholder="אם ריק יוצג שם הקובץ" />
            </label>
            <label>
              קטגוריה
              <select name="category">
                <option>תוכנית</option>
                <option>מסמך סרוק</option>
                <option>PDF</option>
                <option>הזמנה</option>
                <option>הצעת מחיר</option>
                <option>פרוטוקול</option>
                <option>צילום אתר</option>
                <option>אחר</option>
              </select>
            </label>
            <label>
              גרסה
              <input name="version" type="number" min="1" defaultValue="1" />
            </label>
            <label>
              תגים
              <input name="tags" placeholder="חשמל, קומה 2" />
            </label>
            <label className="wide">
              תיאור
              <textarea name="description" />
            </label>
            <div className="wide form-actions">
              <button
                type="button"
                className="ops-secondary"
                onClick={() => setModal("")}
              >
                ביטול
              </button>
              <button className="ops-primary">
                <Upload size={16} />
                העלאה ושיוך
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "edit" && (
        <ProjectEditModal
          project={project}
          clients={clients}
          professionals={professionals}
          editClientMode={editClientMode}
          setEditClientMode={setEditClientMode}
          editClientId={editClientId}
          setEditClientId={setEditClientId}
          editClientName={editClientName}
          setEditClientName={setEditClientName}
          onSubmit={editProject}
          canViewFinance={user.financeAccess!==false}
          onClose={() => setModal("")}
        />
      )}
      {modal === "priority-import" && <PriorityImportWizard project={project} api={api} onClose={()=>setModal("")} onImported={async()=>{await load();setNotice("הזמנת Priority יובאה ועדכנה את הפרויקט")}} />}
      {priorityOrderDetail && <AppModal title={`הזמנת Priority ${priorityOrderDetail.order.priorityOrderNumber}`} subtitle="תיעוד הייבוא לפרויקט" onClose={()=>setPriorityOrderDetail(null)} className="priority-order-detail">
        <div className="priority-order-detail-content">
          <header><div><span>לקוח</span><strong>{priorityOrderDetail.order.customerName}</strong></div><div><span>סטטוס</span><strong>{priorityOrderDetail.order.orderStatus||"—"}</strong></div><div><span>הצעת מחיר</span><strong>{priorityOrderDetail.order.quotationNumber||"—"}</strong></div>{priorityOrderDetail.order.totalAmount!==undefined&&<div><span>סה״כ</span><strong>{priorityMoney.format(priorityOrderDetail.order.totalAmount)}</strong></div>}</header>
          <div className="priority-order-detail-lines">{priorityOrderDetail.lines.map(line=><article key={line.id}><span>{line.prioritySku||"—"}</span><div><strong>{line.description}</strong>{line.originalDescription!==line.description&&<small>מקור: {line.originalDescription}</small>}</div><b>{line.quantity} {line.unit}</b><em>{classificationLabel(line.classification)}</em><small>{line.projectSystemName||"ללא מערכת"}{line.catalogItemName?` · ${line.catalogItemName}`:""}</small></article>)}</div>
        </div>
      </AppModal>}
      {previewFile&&<Modal title={previewFile.title||previewFile.original_name} onClose={()=>setPreviewFile(null)} className="project-media-modal">
        <div className="project-media-viewer">
          {previewFile.mime_type?.startsWith('image/')?<img src={`${apiRoot}/documents/${previewFile.id}/preview`} alt={previewFile.title||previewFile.original_name}/>:previewFile.mime_type?.startsWith('video/')?<video src={`${apiRoot}/documents/${previewFile.id}/preview`} controls playsInline/>:previewFile.mime_type==='application/pdf'?<iframe src={`${apiRoot}/documents/${previewFile.id}/preview`} title={previewFile.title||previewFile.original_name}/>:<div className="media-unsupported"><FileText size={52}/><h3>המסמך זמין לפתיחה או להורדה</h3><p>תצוגה מקדימה מלאה של קובצי Word ו־Excel תלויה ביישום המותקן במכשיר.</p></div>}
          <footer><span>{previewFile.category} · {dateText(previewFile.created_at)} · {previewFile.uploaded_by_name||'מערכת'}</span><div><a className="ops-secondary" href={`${apiRoot}/documents/${previewFile.id}/preview`} target="_blank" rel="noreferrer">פתיחה במכשיר</a><a className="ops-primary" href={`${apiRoot}/documents/${previewFile.id}/download`}><Download size={16}/>הורדת הקובץ</a></div></footer>
        </div>
      </Modal>}
      {navigationTarget && (
        <AppModal title="בחירת אפליקציית ניווט" subtitle={getNavigationLabel(navigationTarget)} onClose={() => setNavigationTarget(null)} className="navigation-selector-modal">
          <div className="navigation-selector-body">
            <div className="navigation-provider-list">
              {NAVIGATION_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`navigation-provider ${defaultNavigationProvider === option.key ? "active" : ""}`}
                  style={{ "--provider-color": option.color }}
                  onClick={() => runNavigation(option.key)}
                >
                  <span className="navigation-provider-icon">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <label className="navigation-remember">
              <input
                type="checkbox"
                checked={rememberNavigation}
                onChange={(e) => setRememberNavigation(e.target.checked)}
              />
              <span>זכור לי בחירה זו</span>
            </label>
            <button type="button" className="ops-secondary" onClick={() => setNavigationTarget(null)}>
              ביטול
            </button>
          </div>
        </AppModal>
      )}

    </div>
  );
}

function ProjectEditModal({
  project,
  clients,
  professionals,
  editClientMode,
  setEditClientMode,
  editClientId,
  setEditClientId,
  editClientName,
  setEditClientName,
  onSubmit,
  onClose,
  canViewFinance,
}) {
  const [projectCategory,setProjectCategory]=useState(project.projectCategory||'smart_home');
  return (
    <Modal title="עריכת פרויקט ולקוח" onClose={onClose}>
      <form className="work-form project-edit-form" onSubmit={onSubmit}>
        <label className="wide">
          שם הפרויקט
          <input name="name" required defaultValue={project.name} />
        </label>
        <div className="wide client-mode-switch">
          <button
            type="button"
            className={editClientMode === "existing" ? "active" : ""}
            onClick={() => setEditClientMode("existing")}
          >
            קישור ללקוח קיים
          </button>
          <button
            type="button"
            className={editClientMode === "new" ? "active" : ""}
            onClick={() => setEditClientMode("new")}
          >
            יצירת לקוח חדש
          </button>
        </div>
        {editClientMode === "existing" ? (
          <>
            <label>
              לקוח במאגר
              <select
                required
                value={editClientId}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditClientId(value);
                  setEditClientName(
                    clients.find((x) => String(x.id) === String(value))?.name ||
                      "",
                  );
                }}
              >
                <option value="">בחירת לקוח</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              שם הלקוח
              <input
                required
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
              />
              <small>
                שינוי השם יעדכן את כרטיס הלקוח ואת כל הפרויקטים המקושרים אליו.
              </small>
            </label>
          </>
        ) : (
          <>
            <label>
              שם לקוח חדש
              <input
                required
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
              />
            </label>
            <label>
              טלפון לקוח
              <input name="clientPhone" required defaultValue={project.phone} />
            </label>
            <label>
              כתובת לקוח
              <input
                name="clientAddress"
                required
                defaultValue={project.address}
              />
            </label>
            <label>
              עיר
              <input name="clientCity" defaultValue={project.location} />
            </label>
            <label className="wide">
              דוא״ל לקוח
              <input
                name="clientEmail"
                type="email"
                defaultValue={project.email}
              />
            </label>
          </>
        )}
        <label>תחום הפרויקט<select name="projectCategory" value={projectCategory} onChange={(event)=>setProjectCategory(event.target.value)}><option value="smart_home">בית חכם</option><option value="other">אחר</option></select></label>
        {projectCategory==='other'&&<><label>סוג פרויקט חופשי<input name="projectCategoryCustom" required defaultValue={project.projectCategoryCustom||''}/></label><div className="wide project-profile-fields"><label>שם תהליך עבודה<input name="workflowLabel" defaultValue={project.projectProfile?.workflowLabel||''}/></label><label>שם אזור המערכות<input name="systemsLabel" defaultValue={project.projectProfile?.systemsLabel||''}/></label><label>שם אזורי העבודה<input name="areasLabel" defaultValue={project.projectProfile?.areasLabel||''}/></label></div></>}
        {projectCategory==='smart_home'&&<label>
          סיווג הפרויקט
          <select name="projectClassification" defaultValue={project.projectClassification || "private_house"}>
            {projectClassificationOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>}
        <label>אייקון הפרויקט<select name="projectIcon" defaultValue={project.projectIcon||project.projectClassification||"home"}>{projectIconOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>צבע מוביל<input type="color" name="projectColor" defaultValue={project.projectColor||"#6957df"}/></label>
        <label>ראש צוות התקנה<select name="installationLeadId" defaultValue={project.installationLeadId||""}><option value="">ללא הקצאה</option>{professionals.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label>
          מיקום / עיר הפרויקט
          <input name="location" defaultValue={project.location} />
        </label>
        <label>
          כתובת אתר הפרויקט
          <input name="address" required defaultValue={project.address} />
        </label>
        <label>
          טלפון בפרויקט
          <input name="phone" defaultValue={project.phone} />
        </label>
        <label>
          דוא״ל בפרויקט
          <input name="email" type="email" defaultValue={project.email} />
        </label>
        {canViewFinance&&<label>
          שווי הפרויקט
          <input
            name="value"
            type="number"
            min="0"
            defaultValue={project.value}
          />
        </label>}
        {canViewFinance&&<fieldset className="wide project-finance-wizard"><legend>אשף כספים אופציונלי</legend><label>אופן תקצוב<select name="financeMode" defaultValue={project.financeMode||"total"}><option value="total">סכום כללי</option><option value="systems">פיצול לפי מערכות</option></select></label><label>תנאי תשלום<input name="paymentTerms" defaultValue={project.paymentTerms||""} placeholder="לדוגמה: 30% מקדמה, 40% התקנה, 30% מסירה"/></label><label>סכום מקדמה<input name="depositAmount" type="number" min="0" step="0.01" defaultValue={project.depositAmount||""}/></label><label className="finance-paid-check"><input name="depositPaid" type="checkbox" defaultChecked={project.depositPaid}/>המקדמה שולמה</label>{(project.systems||[]).length>0&&<div className="wide finance-system-breakdown"><strong>פיצול סכום לפי מערכת</strong>{project.systems.map((name,index)=><label key={`${name}-${index}`}>{name}<input name={`systemAmount-${index}`} type="number" min="0" step="0.01" defaultValue={project.financeBreakdown?.find(item=>item.name===name)?.amount||""}/></label>)}</div>}</fieldset>}
        <label>
          יעד שעות התקנה
          <input name="installationHoursTarget" type="number" min="0" step="0.5" defaultValue={project.installationHoursTarget || ""} placeholder="ללא יעד" />
        </label>
        <label>
          יעד שעות תכנות
          <input name="programmingHoursTarget" type="number" min="0" step="0.5" defaultValue={project.programmingHoursTarget || ""} placeholder="ללא יעד" />
        </label>
        <p className="wide time-target-note">רק התקנה ותכנות מנוהלות מול יעד. יתר סוגי העבודה נמדדים בפועל ללא יעד.</p>
        <label>
          תאריך יעד / טקסט
          <input name="due" defaultValue={project.due} />
        </label>
        <label>
          אבן הדרך הבאה
          <input name="nextMilestone" defaultValue={project.nextMilestone} />
        </label>
        <label>
          עדיפות
          <select name="priority" defaultValue={project.priority || "normal"}>
            <option value="low">נמוכה</option>
            <option value="normal">רגילה</option>
            <option value="high">גבוהה</option>
            <option value="urgent">דחופה</option>
          </select>
        </label>
        <label className="wide">
          דגל / סימון
          <input name="flag" defaultValue={project.flag} />
        </label>
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="ops-primary">
            <Check size={16} />
            שמירת השינויים
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectAttributesPanel({ project, updateProject, api, setNotice }) {
  const [documentFolder, setDocumentFolder] = useState(project.documentFolder || "");
  useEffect(() => setDocumentFolder(project.documentFolder || ""), [project.documentFolder]);
  const contractor = [
    ["finishing", "עבודות גמר"],
    ["carpentry", "הרכבות נגרות"],
    ["waiting", "בהמתנה"],
    ["infrastructure_paving", "סלילת תשתיות"],
    ["drywall_paint", "עבודות גבס וצבע"],
    ["stopped", "בעצירה"],
  ];
  return (
    <section className="panel project-attributes">
      <label>
        סיווג הפרויקט
        <select
          value={project.projectClassification || "private_house"}
          onChange={(event) =>
            updateProject(project.id, { projectClassification: event.target.value })
          }
        >
          {projectClassificationOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        גודל הפרויקט
        <select
          value={project.projectSize || "medium"}
          onChange={(event) =>
            updateProject(project.id, { projectSize: event.target.value })
          }
        >
          <option value="small">קטן</option>
          <option value="medium">בינוני</option>
          <option value="large">גדול</option>
        </select>
      </label>
      <label>
        התקדמות קבלן
        <select
          value={project.contractorProgress || "waiting"}
          onChange={(event) =>
            updateProject(project.id, {
              contractorProgress: event.target.value,
            })
          }
        >
          {contractor.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        תיקיית מסמכים ב־NAS
        <input
          value={documentFolder}
          placeholder={`${project.id}-${project.name}`}
          onChange={(event) => setDocumentFolder(event.target.value)}
          onBlur={() => {
            if (documentFolder !== (project.documentFolder || "")) {
              updateProject(project.id, { documentFolder });
            }
          }}
        />
        <small>שם תיקיית הפרויקט בתוך תיקיית המסמכים הראשית</small>
      </label>
      <div>
        <span>התקדמות הפרויקט</span>
        <strong>{project.progress}%</strong>
        <small>מחושב אוטומטית לפי שלב הפרויקט</small>
      </div>
    </section>
  );
}

function ProjectPhotoUpdate({ project, api, setNotice, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };
  useEffect(() => () => closeCamera(), []);
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);
  const openComputerCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("הדפדפן אינו תומך בצילום ישיר");
      }
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCameraOpen(true);
    } catch (error) {
      setNotice(error.message || "לא ניתנה הרשאה למצלמה");
    }
  };
  const captureComputerPhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return setNotice("המצלמה עדיין לא מוכנה");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setFile(new File([blob], `project-${project.id}-${Date.now()}.jpg`, { type: "image/jpeg" }));
      closeCamera();
    }, "image/jpeg", 0.9);
  };
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("text") || "").trim();
    if (!(file instanceof File) || !file.size)
      return setNotice("יש לבחור תמונה, סרטון או לצלם תמונה");
    if(file.type.startsWith("video/")&&file.size>30*1024*1024&&!confirm("הסרטון גדול מ־30MB. העלאה חריגה זמינה למנהל בלבד ודורשת אישור מפורש. להמשיך?"))return;
    setBusy(true);
    try {
      const documentBody = new FormData();
      documentBody.append("projectId", project.id);
      documentBody.append("category", "צילום אתר");
      documentBody.append("title", text || file.name);
      documentBody.append("description", text);
      if(file.type.startsWith("video/")&&file.size>30*1024*1024)documentBody.append("largeFileApproved","true");
      documentBody.append("file", file);
      await api("/documents", { method: "POST", body: documentBody });
      await api(`/projects/${project.id}/updates`, {
        method: "POST",
        body: JSON.stringify({ body: text || `הועלתה תמונה: ${file.name}` }),
      });
      setNotice(`${file.type.startsWith("video/")?"הסרטון":"התמונה"} והעדכון נוספו לפרויקט`);
      setFile(null);
      setOpen(false);
      onDone();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`panel project-photo-update ${open ? "open" : ""}`}>
      {!open ? (
        <button className="ops-primary" onClick={() => setOpen(true)}>
          <Camera size={17} />
          צילום או העלאת תמונה
        </button>
      ) : (
        <form onSubmit={submit}>
          <div className="photo-source-grid">
            <label className="photo-capture"><Camera size={22}/><span>צילום בטלפון</span><input type="file" accept="image/*" capture="environment" aria-label="צילום תמונה בטלפון" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
            <label className="photo-capture"><Upload size={22}/><span>בחירה מהגלריה</span><input type="file" accept="image/*" aria-label="בחירת תמונה מהגלריה" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
            <button type="button" className="photo-capture" onClick={openComputerCamera}><Camera size={22}/><span>מצלמת מחשב</span></button>
            <label className="photo-capture"><Film size={22}/><span>סרטון עד 30MB</span><input type="file" accept="video/*" aria-label="בחירת סרטון" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
          </div>
          {cameraOpen && <div className="webcam-capture"><video ref={videoRef} playsInline muted/><div><button type="button" className="ops-secondary" onClick={closeCamera}>ביטול</button><button type="button" className="ops-primary" onClick={captureComputerPhoto}><Camera size={16}/>צילום</button></div></div>}
          {file&&<div className="selected-media"><Check size={16}/><span>{file.name}</span><small>{(file.size/1024/1024).toFixed(1)} MB</small></div>}
          <label>
            מלל נלווה
            <textarea
              name="text"
              placeholder="מה רואים בתמונה, מיקום באתר והפעולה הנדרשת"
            />
          </label>
          <div>
            <button
              type="button"
              className="ops-secondary"
              onClick={() => setOpen(false)}
            >
              ביטול
            </button>
            <button className="ops-primary" disabled={busy}>
              {busy ? "מעלה..." : "שמירה בפרויקט"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function GoogleAddressField({ project, api, updateProject, setNotice }) {
  const [query, setQuery] = useState(project.address || "");
  const [addresses, setAddresses] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || query.length < 3) return;
    const timer = setTimeout(
      () =>
        api(`/address-search?q=${encodeURIComponent(query)}`)
          .then((result) => setAddresses(result.addresses))
          .catch((error) => {
            setAddresses([]);
            setNotice(error.message);
          }),
      350,
    );
    return () => clearTimeout(timer);
  }, [query, open]);
  const choose = async (item) => {
    setQuery(item.address);
    setOpen(false);
    await updateProject(project.id, {
      address: item.address,
      lat: item.lat,
      lng: item.lng,
    });
  };
  return (
    <section className="panel google-address-field">
      <label>
        <MapPin size={17} />
        <span>חיפוש כתובת חכם</span>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="הקלדת רחוב, מספר ועיר"
          autoComplete="off"
        />
      </label>
      {open && addresses.length > 0 && (
        <div>
          {addresses.map((item) => (
            <button key={item.placeId} onClick={() => choose(item)}>
              <MapPin size={14} />
              {item.address}
            </button>
          ))}
        </div>
      )}
      <small>Photon · OpenStreetMap — ללא מפתח API וללא עלות שימוש.</small>
    </section>
  );
}

function CommercialProjectGantt({ tasks, milestones, project, projects, professionals, api, setNotice, onDataChanged, users=[] }) {
  const [editor, setEditor] = useState(null);
  const items = [
    ...tasks.filter((item) => item.start_date && item.due_date).map((item) => ({ ...item, kind: "task", start: item.start_date, end: item.due_date })),
    ...milestones.filter((item) => item.due_date).map((item) => ({ ...item, kind: "milestone", start: item.due_date, end: item.due_date })),
  ].sort((a, b) => new Date(a.start) - new Date(b.start));
  const save = async (value) => {
    try {
      const base = editor.kind === "task" ? "/operations/tasks" : "/operations/milestones";
      await api(`${base}/${editor.item.id}`, { method: "PATCH", body: JSON.stringify(value) });
      setEditor(null);
      setNotice("המשימה נשמרה בהצלחה");
      if (typeof onDataChanged === "function") onDataChanged();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const saveSchedule = async (item, dates) => {
    try {
      const base = item.kind === "task" ? "/operations/tasks" : "/operations/milestones";
      await api(`${base}/${item.id}`, { method:"PATCH", body:JSON.stringify(item.kind === "task" ? dates : { dueDate:dates.dueDate, color:dates.color }) });
      if(dates.mentionUserIds?.length)await api('/mentions',{method:'POST',body:JSON.stringify({userIds:dates.mentionUserIds,subject:`תיוג במשימה ${item.title}`,body:`תויגת במשימה ${item.title}. התאריכים עודכנו ל-${dates.startDate} עד ${dates.dueDate}.`,linkedUrl:`?project=${encodeURIComponent(project.id)}&task=${encodeURIComponent(item.id)}`})});
      setNotice("תאריכי המשימה עודכנו");
      if (typeof onDataChanged === "function") await onDataChanged();
    } catch (error) { setNotice(error.message); if (typeof onDataChanged === "function") await onDataChanged(); }
  };
  if (!items.length) return <div className="panel gantt-empty"><Activity size={30} /><h3>לוח הגאנט מוכן</h3><p>הוסיפו למשימות תאריך התחלה וסיום או אבני דרך כדי לבנות את ציר הביצוע.</p></div>;
  return (
    <>
      <GanttTimeline compact groups={[[project.name, items]]} onOpen={(item) => setEditor({ kind: item.kind, item })} onScheduleChange={saveSchedule} users={users} title={`גאנט ביצוע · ${project.name}`} />
      {editor && <TaskEditor api={api} setNotice={setNotice} kind={editor.kind} initial={editor.item} projects={projects} professionals={professionals} tasks={tasks} fixedProjectId={project.id} onClose={() => setEditor(null)} onSave={save} />}
    </>
  );
}

const timeActivityLabels={planning:'תכנון',supervision:'פיקוח',technician:'זמן טכנאים',installation:'התקנה',threading:'השחלות',programming:'תכנות',training:'הדרכה'};

function ProjectHoursPanel({project,entries,professionals,api,setNotice,onDone,canEdit,openRequest=0}){
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(openRequest>0)setOpen(true)},[openRequest]);
  const totals=summarizeTimeEntries(entries);
  const totalHours=totals.reduce((sum,item)=>sum+item.hours,0);
  const submit=async(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);try{await api(`/projects/${project.id}/time-entries`,{method:'POST',body:JSON.stringify({activityType:data.get('activityType'),workDate:data.get('workDate'),hours:data.get('hours'),professionalId:data.get('professionalId')||null,notes:data.get('notes')})});setOpen(false);setNotice('דיווח השעות נשמר');onDone()}catch(error){setNotice(error.message)}};
  const targetFor=(key)=>key==='installation'?Number(project.installationHoursTarget||0):key==='programming'?Number(project.programmingHoursTarget||0):0;
  return <section className="project-hours-page">
    <header className="panel project-hours-head"><div><span><Timer size={19}/></span><div><h3>מונה שעות לפרויקט</h3><p>נתוני ביצוע מובנים מדוחות, טפסים ודיווח ידני. יעדים נקבעים בהקמת הפרויקט או בעריכתו.</p></div></div><strong>{totalHours.toLocaleString('he-IL',{maximumFractionDigits:1})}<small> שעות בפועל</small></strong>{canEdit&&<div className="hours-actions"><button className="ops-primary" onClick={()=>setOpen(true)}><Plus size={16}/>דיווח שעות</button></div>}</header>
    <div className="project-hours-kpis">{totals.map(item=>{const target=targetFor(item.key);const percent=target?item.hours/target*100:0;return <article className={target&&item.hours>target?'over-target':''} key={item.key}><span>{item.label}</span><b>{item.hours.toLocaleString('he-IL',{maximumFractionDigits:1})}</b><small>{target?`מתוך יעד ${target} שעות`:'שעות שנמדדו'}</small><i style={{width:`${target?Math.min(100,Math.max(4,percent)):totalHours?Math.max(4,item.hours/totalHours*100):0}%`}}/>{target>0&&<em>{Math.round(percent)}%</em>}</article>})}</div>
    <div className="project-hours-grid"><section className="panel"><h3>התפלגות שעות לפי פעילות</h3><div className="project-hours-chart" dir="ltr"><ResponsiveContainer width="100%" height={300}><BarChart data={totals} layout="vertical" margin={{top:8,right:18,bottom:4,left:86}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} domain={[0,'auto']}/><YAxis type="category" dataKey="label" width={78} tickLine={false} axisLine={false} tick={{fill:'#626a7d',fontSize:12}}/><Tooltip formatter={(value)=>[`${value} שעות`,'בפועל']} labelFormatter={(label)=>String(label)} contentStyle={{direction:'rtl',textAlign:'right'}}/><Bar dataKey="hours" fill="#6957df" radius={[0,8,8,0]} minPointSize={2} isAnimationActive/></BarChart></ResponsiveContainer></div></section><section className="panel time-entry-list"><h3>דיווחים אחרונים</h3>{entries.slice(0,12).map(item=><article key={item.id}><i/><div><strong>{timeActivityLabels[item.activity_type]||item.activity_type}</strong><small>{item.professional_name||item.user_name||'משתמש'} · {dateText(item.work_date)}</small></div><b>{Number(item.hours)} ש׳</b></article>)}{!entries.length&&<div className="inline-empty">טרם דווחו שעות לפרויקט.</div>}</section></div>
    {open&&<Modal title="דיווח שעות עבודה" onClose={()=>setOpen(false)}><form className="work-form" onSubmit={submit}><label>סוג פעילות<select name="activityType" required>{Object.entries(timeActivityLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>תאריך<input type="date" name="workDate" required defaultValue={localDateValue()}/></label><label>מספר שעות<input type="number" name="hours" required min="0.25" max="24" step="0.25" autoFocus/></label><label>מבצע<select name="professionalId"><option value="">המשתמש המדווח</option>{professionals.filter(item=>item.active!==false).map(item=><option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label><label className="wide">הערות<textarea name="notes"/></label><div className="form-actions wide"><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>ביטול</button><button className="ops-primary">שמירת דיווח</button></div></form></Modal>}
  </section>;
}

function ProjectGantt({ tasks, milestones }) {
  const [zoom, setZoom] = useState("week");
  const [selected, setSelected] = useState("");
  const [futureDays, setFutureDays] = useState(30);
  const items = [
    ...tasks.map((item) => ({
      ...item,
      kind: "task",
      start: item.start_date || item.created_at,
      end: item.due_date,
      color: item.status === "done" ? "#1d9b66" : "#6957df",
    })),
    ...milestones.map((item) => ({
      ...item,
      kind: "milestone",
      start: item.due_date,
      end: item.due_date,
      color: item.status === "completed" ? "#1d9b66" : "#e29b38",
    })),
  ].filter((item) => item.start && item.end);
  if (!items.length)
    return (
      <div className="panel gantt-empty">
        <Activity size={30} />
        <h3>לוח הגאנט מוכן</h3>
        <p>
          הוסיפו למשימות תאריך התחלה ויעד, או אבני דרך, כדי לבנות ציר ביצוע.
        </p>
      </div>
    );
  const starts = items.map((item) => new Date(item.start).setHours(0, 0, 0, 0));
  const ends = items.map((item) => new Date(item.end).setHours(0, 0, 0, 0));
  const dataMin = Math.min(...starts);
  const dataMax = Math.max(...ends, dataMin + 86400000);
  const min = dataMin;
  const max = dataMax + futureDays * 86400000;
  const span = Math.max(1, (max - min) / 86400000 + 1);
  const zoomConfig = {
    day: { pixelsPerDay: 92, tickDays: 1, label: "יום" },
    week: { pixelsPerDay: 34, tickDays: 7, label: "שבוע" },
    month: { pixelsPerDay: 13, tickDays: 30, label: "חודש" },
  }[zoom];
  const trackWidth = Math.max(1080, Math.ceil(span * zoomConfig.pixelsPerDay) + 180);
  const adaptiveTickDays = span <= 14 ? 1 : span <= 60 ? Math.min(7, zoomConfig.tickDays) : zoomConfig.tickDays;
  const tickCount = Math.floor((span - 1) / adaptiveTickDays) + 1;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const day = Math.min(span - 1, index * adaptiveTickDays);
    return { day, date: new Date(min + day * 86400000) };
  });
  const dependencyLines = items.flatMap((item, targetIndex) => {
    if (item.kind !== "task" || !item.dependency_task_id) return [];
    const sourceIndex = items.findIndex(
      (candidate) => candidate.kind === "task" && String(candidate.id) === String(item.dependency_task_id),
    );
    if (sourceIndex < 0) return [];
    const source = items[sourceIndex];
    const sourceDay = (new Date(source.end).setHours(0, 0, 0, 0) - min) / 86400000 + 1;
    const targetDay = (new Date(item.start).setHours(0, 0, 0, 0) - min) / 86400000;
    const sourceX = trackWidth - Math.min(trackWidth, sourceDay * zoomConfig.pixelsPerDay);
    const targetX = trackWidth - Math.min(trackWidth, targetDay * zoomConfig.pixelsPerDay);
    const sourceY = sourceIndex * 64 + 32;
    const targetY = targetIndex * 64 + 32;
    const midX = (sourceX + targetX) / 2;
    return [{ id: `${source.id}-${item.id}`, d: `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}` }];
  });
  const extendTimeline = (event) => {
    const element = event.currentTarget;
    const distance = Math.abs(element.scrollLeft);
    const limit = element.scrollWidth - element.clientWidth;
    if (limit - distance < 120) {
      const increment = zoom === "day" ? 7 : zoom === "week" ? 28 : 90;
      setFutureDays((current) => current + increment);
    }
  };
  return (
    <section className="panel gantt-board">
      <header>
        <div>
          <h3>גאנט ביצוע לפרויקט</h3>
          <p>
            {dateText(dataMin)} — {dateText(dataMax)} · {items.length} פעילויות ואבני
            דרך
          </p>
        </div>
        <div className="project-gantt-actions" aria-label="רמת תצוגת הגאנט">
          {[["day", "יום"], ["week", "שבוע"], ["month", "חודש"]].map(([value, label]) => (
            <button key={value} type="button" className={zoom === value ? "active" : ""} onClick={() => setZoom(value)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="project-gantt-viewport" onScroll={extendTimeline}>
        <div className="gantt-scale" style={{ width: trackWidth }}>
          {ticks.map(({ day, date }) => (
            <span key={day} style={{ right: day * zoomConfig.pixelsPerDay }}>
              {date.toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
            </span>
          ))}
        </div>
        <div className="gantt-rows" style={{ width: trackWidth + 240 }}>
        {dependencyLines.length > 0 && <svg className="gantt-dependencies" width={trackWidth} height={items.length * 64} viewBox={`0 0 ${trackWidth} ${items.length * 64}`} preserveAspectRatio="none" aria-label="קווי תלות בין משימות"><defs><marker id="gantt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>{dependencyLines.map(line => <path key={line.id} d={line.d} markerEnd="url(#gantt-arrow)" />)}</svg>}
        {items.map((item) => {
          const start =
            (new Date(item.start).setHours(0, 0, 0, 0) - min) / 86400000;
          const duration = Math.max(
            1,
            (new Date(item.end).setHours(0, 0, 0, 0) -
              new Date(item.start).setHours(0, 0, 0, 0)) /
              86400000 +
              1,
          );
          const startPixels = start * zoomConfig.pixelsPerDay;
          const availableWidth = Math.max(22, trackWidth - startPixels);
          const actualWidth = Math.max(8, duration * zoomConfig.pixelsPerDay);
          const barWidth = item.kind === "milestone"
            ? 148
            : Math.min(availableWidth, Math.max(118, duration * zoomConfig.pixelsPerDay));
          const isShort = item.kind === "task" && actualWidth < barWidth;
          return (
            <article key={`${item.kind}-${item.id}`} className={String(selected) === `${item.kind}-${item.id}` ? "selected" : ""} onClick={() => setSelected(String(selected) === `${item.kind}-${item.id}` ? "" : `${item.kind}-${item.id}`)}>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {item.kind === "milestone"
                    ? "אבן דרך"
                    : item.assignee_name || "ללא אחראי"}
                </small>
                <em>{dateText(item.start)} — {dateText(item.end)}</em>
              </div>
              <div className="gantt-track" style={{ width: trackWidth }}>
                <i
                  className={`${item.kind} ${item.critical ? "critical" : ""} ${isShort ? "short" : ""}`}
                  style={{
                    "--start": `${startPixels}px`,
                    "--width": `${barWidth}px`,
                    "--actual": `${Math.min(actualWidth, barWidth)}px`,
                    "--bar": item.color,
                  }}
                >
                  <u>{item.kind === "milestone" ? "â—†" : ""}</u>
                  <span>{item.kind === "milestone" ? item.title : item.critical ? `משימה קריטית · ${item.title}` : item.title}</span>
                </i>
              </div>
            </article>
          );
        })}
        </div>
      </div>
      <footer className="project-gantt-legend">
        <span><i className="planned" />משימה פעילה</span>
        <span><i className="done" />הושלמה</span>
        <span><i className="critical" />משימה קריטית</span>
        <small>תצוגת {zoomConfig.label} · הגלילה מרחיבה את ציר הזמן אוטומטית</small>
      </footer>
    </section>
  );
}





