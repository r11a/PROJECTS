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
  if (!value) return "×œ×œ× ×ª××¨×™×š";
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? formatDateIL(value) : new Date(value).toLocaleDateString("he-IL");
};
const projectClassificationOptions = [
  ["private_house", "×‘×™×ª ×¤×¨×˜×™"],
  ["villa", "×•×™×œ×”"],
  ["cottage", "×§×•×˜×’×³"],
  ["penthouse", "×¤× ×˜×”××•×–"],
  ["apartment_building", "×‘× ×™×™×Ÿ ×ž×©×•×ª×£"],
  ["studio", "×¡×˜×•×“×™×•"],
  ["duplex", "×“×•×¤×œ×§×¡"],
];
const projectIconOptions=[["home","×‘×™×ª"],["villa","×•×™×œ×”"],["cottage","×§×•×˜×’×³"],["building","×‘× ×™×™×Ÿ"],["penthouse","×¤× ×˜×”××•×–"],["studio","×¡×˜×•×“×™×•"]];
function ProjectTypeIcon({project,size=27}){const key=project.projectIcon||project.projectClassification;const Icon={home:Home,private_house:Home,villa:Castle,cottage:House,building:Building2,apartment_building:Building2,penthouse:PanelsTopLeft,studio:Command,duplex:House}[key]||Home;return <Icon size={size}/>}
function Modal({ title, onClose, children }) {
  return <AppModal title={title} subtitle="×›×¨×˜×™×¡ ×¤×¨×•×™×§×˜" onClose={onClose}>{children}</AppModal>;
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
  const updateBom=async(item,patch)=>{try{await api(`/projects/${project.id}/bom/${item.id}`,{method:'PATCH',body:JSON.stringify(patch)});setNotice('× ×ª×•× ×™ ×”×‘×™×¦×•×¢ ×¢×•×“×›× ×•');load()}catch(error){setNotice(error.message)}};
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
      setNotice("×”×¢×“×›×•×Ÿ ×¤×•×¨×¡× ×œ×¦×•×•×ª");
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
      setNotice("××™×© ×”×¦×•×•×ª ×©×•×™×š ×œ×¤×¨×•×™×§×˜");
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
      catch(error){if(error.status!==409||error.body?.code!=='SIMILAR_PROFESSIONAL')throw error;const match=error.body.matches?.[0];if(match&&confirm(`${error.message}.\n××™×©×•×¨ â€” ××™×—×•×“ ×•×©×™×•×š ×”××“× ×”×§×™×™×.\n×‘×™×˜×•×œ â€” ××¤×©×¨×•×ª ×œ×™×¦×™×¨×ª ×›×¨×˜×™×¡ × ×¤×¨×“.`)){await api(`/professionals/${match.id}/merge`,{method:'POST',body:JSON.stringify(body)});professionalId=match.id;}else if(confirm('×œ×™×¦×•×¨ ×‘×›×œ ×–××ª ×›×¨×˜×™×¡ × ×¤×¨×“?')){const result=await api('/professionals',{method:'POST',body:JSON.stringify({...body,allowDuplicate:true})});professionalId=result.professional.id;}else return;}
      await api(`/projects/${project.id}/team`,{method:'POST',body:JSON.stringify({professionalId,roleTypeId})});setModal('');setNotice('××™×© ×”×ž×§×¦×•×¢ × ×©×ž×¨ ×‘×ž××’×¨ ×•×©×•×™×š ×œ×¤×¨×•×™×§×˜');load();
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
      setNotice("×”×¦×™×•×“ × ×•×¡×£ ×œ×¤×¨×•×™×§×˜");
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
      setNotice("×”×ž×¡×ž×š ×”×•×¢×œ×” ×•×©×•×™×š ×œ×¤×¨×•×™×§×˜");
      load();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const uploadRecordFiles=async(files,title,category)=>{for(const file of files.filter(file=>file instanceof File&&file.size)){const body=new FormData();body.set('projectId',project.id);body.set('title',`${title} Â· ${file.name}`);body.set('category',category);body.set('file',file);await api('/documents',{method:'POST',body});}};
  const addReview=async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await api(`/projects/${project.id}/site-reviews`,{method:'POST',body:JSON.stringify({reviewDate:f.get('reviewDate'),performedBy:f.get('performedBy'),supervisionType:f.get('supervisionType'),summary:f.get('summary'),followUp:f.get('followUp'),hours:f.get('hours'),planUpdateRequired:f.get('planUpdateRequired')==='on',voiceContextId:reviewVoiceContext})});await uploadRecordFiles(f.getAll('attachments'),`×‘×™×§×•×¨×ª ××ª×¨ ${f.get('reviewDate')}`,'×‘×™×§×•×¨×ª ××ª×¨');setReviewVoiceContext(newVoiceContext());setModal('');setNotice('×‘×™×§×•×¨×ª ×”××ª×¨, ×”×©×¢×•×ª ×•×”×§×‘×¦×™× × ×©×ž×¨×•');load()}catch(error){setNotice(error.message)}};
  const addMeeting=async(e,providedForm)=>{e.preventDefault();const f=providedForm||new FormData(e.currentTarget);try{const result=await api(`/projects/${project.id}/meetings`,{method:'POST',body:JSON.stringify({meetingAt:f.get('meetingAt'),attendees:f.get('attendees'),summary:f.get('summary'),followUp:f.get('followUp'),hours:f.get('hours'),voiceContextId:f.get('voiceContextId')})});const aiTasks=JSON.parse(String(f.get('aiTasks')||'[]'));if(aiTasks.length)await api(`/projects/${project.id}/meetings/${result.meeting.id}/tasks`,{method:'POST',body:JSON.stringify({tasks:aiTasks})});await uploadRecordFiles(f.getAll('attachments'),`×¡×™×›×•× ×¤×’×™×©×” ${String(f.get('meetingAt')).slice(0,10)}`,'×¡×™×›×•× ×¤×’×™×©×”');setModal('');setNotice(aiTasks.length?`×¡×™×›×•× ×”×¤×’×™×©×” × ×©×ž×¨ ×•× ×•×¦×¨×• ${aiTasks.length} ×ž×©×™×ž×•×ª`:'×¡×™×›×•× ×”×¤×’×™×©×”, ×”×©×¢×•×ª ×•×”×§×‘×¦×™× × ×©×ž×¨×•');load()}catch(error){setNotice(error.message)}};
  const archiveDocument=async(file)=>{if(user.role!=='admin'||!confirm(`×œ×”×¢×‘×™×¨ ××ª â€ž${file.title||file.original_name}â€ ×œ×¡×œ ×”×ž×—×–×•×¨ ×œÖ¾14 ×™×•×?`))return;try{await api(`/documents/${file.id}`,{method:'DELETE'});setNotice('×”×ž×¡×ž×š ×”×•×¢×‘×¨ ×œ×¡×œ ×”×ž×—×–×•×¨ ×œÖ¾14 ×™×•×');load()}catch(error){setNotice(error.message)}};
  const deleteTeam = async (x) => {
    if (!confirm(`×œ×”×¡×™×¨ ××ª ${x.display_name} ×ž×”×¤×¨×•×™×§×˜?`)) return;
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
    if (!confirm(`×œ×”×¡×™×¨ ××ª ${x.name}?`)) return;
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
      ? "×œ×©×—×–×¨ ××ª ×”×¤×¨×•×™×§×˜ ×œ×¨×©×™×ž×” ×”×¤×¢×™×œ×”"
      : "×œ×”×¢×‘×™×¨ ××ª ×”×¤×¨×•×™×§×˜ ×œ××¨×›×™×•×Ÿ";
    const warning =
      !project.archived && project.stage !== "completed"
        ? "\n×”×¤×¨×•×™×§×˜ ××™× ×• ×ž×¡×•×ž×Ÿ ×›×”×•×©×œ×. ×¢×“×™×™×Ÿ × ×™×ª×Ÿ ×œ××¨×›×‘ ××•×ª×•."
        : "";
    if (!confirm(`${action}?${warning}`)) return;
    await archiveProject(project.id, !project.archived);
  };
  const toggleCompleted=async()=>{try{await api(`/projects/${project.id}/complete`,{method:"PATCH",body:JSON.stringify({completed:!project.completed})});setNotice(project.completed?"×”×¤×¨×•×™×§×˜ ×”×•×—×–×¨ ×œ×¤×¢×™×œ×™×":"×”×¤×¨×•×™×§×˜ ×”×•×¢×‘×¨ ×œ×”×¡×ª×™×™×ž×•");window.dispatchEvent(new Event("projects:data-changed"));setPage("projects");}catch(error){setNotice(error.message)}};
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
    ["overview", "×¡×§×™×¨×”"],
    ["tasks", "×ž×©×™×ž×•×ª ×•××‘× ×™ ×“×¨×š"],
    ["gantt", "×’×× ×˜"],
    ["reviews", "×‘×™×§×•×¨×•×ª ×•×¤×’×™×©×•×ª"],
    ["hours", "×©×¢×•×ª ×¢×‘×•×“×”"],
    ["systems", "×ž×¢×¨×›×•×ª ×•×¦×•×•×ª"],
    ["priority", "×”×–×ž× ×•×ª Priority"],
    ["forms", "×˜×¤×¡×™× ×•×§×‘×¦×™×"],
    ["finance", "×›×¡×¤×™×"],
    ["activity", "×¤×¢×™×œ×•×ª"],
    ["governance", "×©×™× ×•×™×™× ×•×‘×§×¨×”"],
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
              <span>Â·</span>
              <button type="button" className="project-navigation-link" onClick={() => requestNavigation(project)} title="× ×•×•×˜ ×œ×›×ª×•×‘×ª ×‘××¤×œ×™×§×¦×™×™×ª ×”× ×™×•×•×˜"><MapPin size={15} />{project.address}<small>× ×•×•×˜</small></button>
            </p>
          </div>
        </div>
        <div className="project-hero-actions">
          <button className="secondary-button" disabled={!canEdit||project.archived} onClick={toggleCompleted}><CheckCircle2 size={16}/>{project.completed?"×”×—×–×¨×” ×œ×¤×¢×™×œ×™×":"×¡×™×ž×•×Ÿ ×›×”×¡×ª×™×™×"}</button>
          <button className="secondary-button" disabled={!canEdit} onClick={() => { setTab("hours"); setHoursReportRequest((current) => current + 1); }}>
            <Timer size={16}/>
            ×“×™×•×•×— ×©×¢×•×ª
          </button>
          <button
            className="secondary-button"
            disabled={!canEdit}
            onClick={() => setTab("activity")}
          >
            <MessageSquare size={16} />
            ×”×•×¡×¤×ª ×¢×“×›×•×Ÿ
          </button>
        </div>
        <div className="hero-metrics">
          <div>
            <span>×©×œ×‘ × ×•×›×—×™</span>
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
                    ["planning", "×ª×›× ×•×Ÿ"],
                    ["infrastructure", "×ª×©×ª×™×•×ª"],
                    ["installation", "×”×ª×§× ×”"],
                    ["programming", "×ª×›× ×•×ª"],
                    ["handover", "×œ×§×¨××ª ×ž×¡×™×¨×”"],
                    ["completed", "×”×•×©×œ×"],
                  ]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span>×”×ª×§×“×ž×•×ª</span>
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
            <span>×”×ª×§×“×ž×•×ª ×§×‘×œ×Ÿ</span>
            <strong className={`contractor-progress-value contractor-${project.contractorProgress || "waiting"}`}>
              {{ finishing: "×¢×‘×•×“×•×ª ×’×ž×¨", carpentry: "×”×¨×›×‘×•×ª × ×’×¨×•×ª", waiting: "×‘×”×ž×ª× ×”", infrastructure_paving: "×¡×œ×™×œ×ª ×ª×©×ª×™×•×ª", drywall_paint: "×¢×‘×•×“×•×ª ×’×‘×¡ ×•×¦×‘×¢", stopped: "×‘×¢×¦×™×¨×”" }[project.contractorProgress] || "×‘×”×ž×ª× ×”"}
            </strong>
          </div>
          <div>
            <span>×‘×¨×™××•×ª ×”×¤×¨×•×™×§×˜</span>
            <strong
              className={project.health < 70 ? "health-risk" : "health-good"}
            >
              {project.health}/100
            </strong>
            <small>
              {project.health < 70 ? "×“×•×¨×© ×ª×©×•×ž×ª ×œ×‘" : "×ž×ª× ×”×œ ×›×©×•×¨×”"}
            </small>
          </div>
          <div>
            <span>×ž× ×”×œ ×¤×¨×•×™×§×˜</span>
            <select
              className="project-manager-select"
              disabled={!canManage}
              value={project.managerId || ""}
              onChange={(e) =>
                updateProject(project.id, { managerId: e.target.value || null })
              }
            >
              <option value="">×œ×œ× ×ž× ×”×œ</option>
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
            <span>×ž×©×™×ž×•×ª</span>
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
              ×‘××™×—×•×¨
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
                  <strong>×”×¤×¨×•×™×§×˜ × ×ž×¦× ×‘××¨×›×™×•×Ÿ</strong>
                  <small>
                    ×›×œ ×”× ×ª×•× ×™× × ×©×ž×¨×• ×•× ×™×ª×Ÿ ×œ×©×—×–×¨ ××•×ª×• ×œ×¨×©×™×ž×” ×”×¤×¢×™×œ×”.
                  </small>
                </span>
              </>
            ) : (
              <>
                <Pencil size={18} />
                <span>
                  <strong>× ×™×”×•×œ ×¤×¨×˜×™ ×”×¤×¨×•×™×§×˜</strong>
                  <small>×¢×¨×™×›×ª ×”×¤×¨×•×™×§×˜ ×•×”×œ×§×•×— ×”×ž×§×•×©×¨ × ×©×ž×¨×ª ×ž×™×“ ×‘×ž××’×¨.</small>
                </span>
              </>
            )}
          </div>
          <div>
            <button className="secondary-button" onClick={openProjectEdit}>
              <Pencil size={16} />
              ×¢×¨×™×›×ª ×¤×¨×•×™×§×˜
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
              {project.archived ? "×©×—×–×•×¨ ×¤×¨×•×™×§×˜" : "×”×¢×‘×¨×” ×œ××¨×›×™×•×Ÿ"}
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
                  <h3>××‘× ×™ ×”×“×¨×š ×”×§×¨×•×‘×•×ª</h3>
                  <span>{workspace.milestones.length} ××‘× ×™ ×“×¨×š ×‘×¤×¨×•×™×§×˜</span>
                </div>
                <button onClick={() => setTab("tasks")}>× ×™×”×•×œ ×ž×œ×</button>
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
                          {dateText(m.due_date)} Â· {m.owner_name || "×œ×œ× ××—×¨××™"}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="inline-empty">
                    ×˜×¨× ×”×•×’×“×¨×• ××‘× ×™ ×“×¨×š. × ×™×ª×Ÿ ×œ×”×•×¡×™×£ ×‘×œ×©×•× ×™×ª ×”×ž×©×™×ž×•×ª.
                  </div>
                )}
              </div>
            </div>
            <div className="panel systems-card">
              <div className="panel-head">
                <div>
                  <h3>×ž×¢×¨×›×•×ª ×•×¦×™×•×“</h3>
                  <span>×¦×™×•×“ ×©×”×•×§×¦×” ×‘×¤×•×¢×œ ×œ×¤×¨×•×™×§×˜</span>
                </div>
                <button onClick={() => setTab("systems")}>× ×™×”×•×œ ×ž×¢×¨×›×•×ª</button>
              </div>
              <div className="system-tiles">
                {workspace.equipment.slice(0, 6).map((x, i) => (
                  <div key={x.id}>
                    <span className={`system-icon s${i % 4}`}>
                      <Command size={18} />
                    </span>
                    <strong>{x.name}</strong>
                    <small>
                      {x.location || x.status} Â· {x.quantity} {x.unit}
                    </small>
                    <CheckCircle2 size={17} />
                  </div>
                ))}
                {!workspace.equipment.length && (
                  <div className="inline-empty">
                    ××™×Ÿ ×¢×“×™×™×Ÿ ×¦×™×•×“ ×ž×©×•×™×š ×œ×¤×¨×•×™×§×˜.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="detail-side">
            <div className="panel contact-card">
              <div className="panel-head">
                <div>
                  <h3>×¤×¨×˜×™ ×œ×§×•×—</h3>
                </div>
              </div>
              <div className="contact-person">
                <div className="client-avatar">
                  {project.client.slice(0, 2)}
                </div>
                <div>
                  <strong>{project.client}</strong>
                  <span>×œ×§×•×— ×¨××©×™</span>
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
                ×¤×ª×™×—×ª ×ž××’×¨ ×”×œ×§×•×—×•×ª
              </button>
            </div>
            {user.financeAccess!==false&&<div className="panel money-summary">
              <div className="panel-head">
                <div>
                  <h3>×¡×™×›×•× ×›×¡×¤×™</h3>
                </div>
              </div>
              <div>
                <span>×©×•×•×™ ×”×¤×¨×•×™×§×˜</span>
                <strong>{money.format(project.value)}</strong>
              </div>
              <div>
                <span>×©×•×œ× ×¢×“ ×›×”</span>
                <strong className="green-text">
                  {money.format(project.paid)}
                </strong>
              </div>
              <div className="due-row">
                <span>×™×ª×¨×” ×œ×’×‘×™×™×”</span>
                <strong>{money.format(due)}</strong>
              </div>
              <div className="money-progress">
                <i
                  style={{
                    width: `${project.value ? (project.paid / project.value) * 100 : 0}%`,
                  }}
                />
              </div>
              <button onClick={() => setTab("finance")}>×œ×¤×™×¨×•×˜ ×ª×©×œ×•×ž×™×</button>
            </div>}
            <form className="panel quick-notes" onSubmit={addUpdate}>
              <div className="panel-head">
                <div>
                  <h3>×¢×“×›×•×Ÿ ×ž×”×™×¨ ×œ×¦×•×•×ª</h3>
                </div>
              </div>
              <SmartTextArea api={api} value={note} onChange={setNote} setNotice={setNotice} label="×ª×•×›×Ÿ ×”×¢×“×›×•×Ÿ" textareaProps={{placeholder:"×ž×” ×§×¨×”, ×ž×” ×”×•×—×œ×˜ ×•×ž×” ×”×¤×¢×•×œ×” ×”×‘××”?"}}/>
              <VoiceNotes api={api} apiRoot={apiRoot} entityType="project_update_draft" entityId={updateVoiceContext} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/>
              <button disabled={!note.trim()}>×¤×¨×¡×•× ×¢×“×›×•×Ÿ</button>
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
          <section className="panel project-resource project-bom"><div className="panel-head"><div><h3>BOM ×œ×¤×™ ×ž×¢×¨×›×•×ª</h3><span>×”×•×–×ž×Ÿ, ×”×•×ª×§×Ÿ, ×ª×•×›× ×ª ×•×™×ª×¨×” ×œ×‘×™×¦×•×¢</span></div></div>{[...new Map(bom.map((item)=>[item.project_system_id||'none',{name:item.system_name||'×œ×œ× ×ž×¢×¨×›×ª',color:item.system_color||'#6957df'}])).entries()].map(([systemId,system])=><div className="bom-system" key={systemId}><header style={{borderInlineStartColor:system.color}}><strong>{system.name}</strong></header><div className="bom-head"><span>×¤×¨×™×˜</span><span>×”×•×–×ž×Ÿ</span><span>×”×•×ª×§×Ÿ</span><span>×ª×•×›× ×ª</span><span>×™×ª×¨×”</span></div>{bom.filter((item)=>String(item.project_system_id||'none')===String(systemId)).map((item)=><article key={item.id}><div><strong>{item.name}</strong><small>{item.priority_sku||item.code}</small></div><b>{item.ordered}</b><input type="number" min="0" max={item.ordered} step="1" value={item.installed} disabled={!canEdit} onChange={(event)=>setBom((current)=>current.map((row)=>row.id===item.id?{...row,installed:Number(event.target.value),remaining:Math.max(0,row.ordered-Number(event.target.value))}:row))} onBlur={(event)=>updateBom(item,{installed:Number(event.target.value),programmed:item.programmed})}/><input type="number" min="0" max={item.installed} step="1" value={item.programmed} disabled={!canEdit} onChange={(event)=>setBom((current)=>current.map((row)=>row.id===item.id?{...row,programmed:Number(event.target.value)}:row))} onBlur={(event)=>updateBom(item,{installed:item.installed,programmed:Number(event.target.value)})}/><strong className={item.remaining?'remaining':''}>{item.remaining}</strong></article>)}</div>)}</section>
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>×¦×•×•×ª ×”×¤×¨×•×™×§×˜</h3>
                <span>×¢×•×‘×“×™ ×—×‘×¨×” ×•×× ×©×™ ×ž×§×¦×•×¢ ×—×™×¦×•× ×™×™×</span>
              </div>
              {canManage && (
                <button onClick={() => setModal("team")}>
                  <Plus size={15} />
                  ×©×™×•×š ××™×© ×¦×•×•×ª
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
                      {x.role_name} {x.is_primary && "Â· ××—×¨××™ ×¨××©×™"}
                    </small>
                  </div>
                  {x.phone && (
                    <a className="team-phone-action" href={`tel:${x.phone}`} title={`×—×™×•×’ ××œ ${x.display_name}`} aria-label={`×—×™×•×’ ××œ ${x.display_name}`}>
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
              <div className="inline-empty">×˜×¨× ×©×•×™×š ×¦×•×•×ª ×œ×¤×¨×•×™×§×˜.</div>
            )}
          </section>
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>×ž×¢×¨×›×•×ª, ×¦×™×•×“ ×•×¨×›×™×‘×™×</h3>
                <span>×›×ž×•×ª, ×ž×™×§×•×, ×¡×˜×˜×•×¡ ×•×ž×¡×¤×¨ ×¡×™×“×•×¨×™</span>
              </div>
              {canEdit && (
                <button onClick={() => setModal("equipment")}>
                  <Plus size={15} />
                  ×”×•×¡×¤×ª ×¦×™×•×“
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
                      {x.manufacturer} {x.model} Â· {x.quantity} {x.unit} Â·{" "}
                      {x.location || "×œ×œ× ×ž×™×§×•×"}
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
              <div className="inline-empty">×˜×¨× ×©×•×™×š ×¦×™×•×“ ×œ×¤×¨×•×™×§×˜.</div>
            )}
          </section>
        </div>
      )}
      {tab === "priority" && (
        <section className="panel project-resource priority-orders-page">
          <div className="panel-head">
            <div><h3>×”×–×ž× ×•×ª Priority</h3><span>×”×™×¡×˜×•×¨×™×™×ª ×”×–×ž× ×•×ª, ×©×•×¨×•×ª ×ž×§×•×¨, ×¦×™×•×“ ×•×©×¢×•×ª ×™×™×—×•×¡</span></div>
            {canImportPriority && <button onClick={() => setModal("priority-import")}><FileSpreadsheet size={16}/>×™×™×‘×•× ×”×–×ž× ×”</button>}
          </div>
          {workspace.priorityOrders?.length ? workspace.priorityOrders.map((order) => <article className="priority-order-row" key={order.id}>
            <span><FileSpreadsheet size={20}/></span>
            <div><strong>{order.priorityOrderNumber}</strong><small>{order.customerName || project.client} Â· {order.orderStatus || "×œ×œ× ×¡×˜×˜×•×¡"} Â· {dateText(order.orderDate || order.createdAt)} Â· {order.selectedCount}/{order.lineCount} ×©×•×¨×•×ª</small></div>
            {order.totalAmount !== undefined && <strong>{priorityMoney.format(order.totalAmount)}</strong>}
            <button type="button" onClick={async()=>{try{setPriorityOrderDetail(await api(`/projects/${encodeURIComponent(project.id)}/priority-orders/${order.id}`))}catch(error){setNotice(error.message)}}}>×¦×¤×™×™×”</button>
          </article>) : <div className="priority-order-empty"><FileSpreadsheet size={38}/><p>×˜×¨× ×™×•×‘××• ×”×–×ž× ×•×ª Priority ×œ×¤×¨×•×™×§×˜.</p>{canImportPriority&&<button className="primary-button" onClick={()=>setModal("priority-import")}>×™×™×‘×•× ×”×–×ž× ×” ×¨××©×•× ×”</button>}</div>}
        </section>
      )}
      {tab === "forms" && (
        <div className="project-two-columns">
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>×˜×¤×¡×™ ×”×¤×¨×•×™×§×˜</h3>
                <span>×˜×™×•×˜×•×ª, ×˜×¤×¡×™× ×©×”×•×©×œ×ž×• ×•××™×©×•×¨×™×</span>
              </div>
              <button onClick={() => setPage("forms")}>
                <Plus size={15} />
                ×˜×•×¤×¡ ×—×“×©
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
                      {x.template_name} Â· {dateText(x.updated_at)}
                    </small>
                  </div>
                  <span className={`resource-status ${x.status}`}>
                    {x.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="inline-empty">
                ××™×Ÿ ×˜×¤×¡×™× ×”×ž×©×•×™×›×™× ×œ×¤×¨×•×™×§×˜. ×™×¦×™×¨×” ×ž×ª×•×š ×ž××’×¨ ×”×˜×¤×¡×™× ×ª×©×™×™×š ××•×ª×
                ××•×˜×•×ž×˜×™×ª.
              </div>
            )}
          </section>
          <section className="panel project-resource">
            <div className="panel-head">
              <div>
                <h3>×§×‘×¦×™× ×•×ž×¡×ž×›×™×</h3>
                <span>×ª×•×›× ×™×•×ª, ×”×–×ž× ×•×ª, ×¡×¨×™×§×•×ª ×•×ª×™×¢×•×“</span>
              </div>
              {canEdit && (
                <button onClick={() => setModal("document")}>
                  <Upload size={15} />
                  ×”×¢×œ××” ×œ×¤×¨×•×™×§×˜
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
                      {x.category} Â· {dateText(x.created_at)} Â· {x.uploaded_by_name || '×ž×¢×¨×›×ª'} Â·{" "}
                      {(Number(x.size_bytes) / 1024 / 1024).toFixed(1)} MB
                    </small>
                  </div>
                  <button onClick={(event)=>{event.stopPropagation();setPreviewFile(x)}} title="×¤×ª×™×—×” / ×ª×¦×•×’×”">
                    <Eye size={16} />
                  </button>
                  {user.role==='admin'&&<button className="danger-icon" onClick={(event)=>{event.stopPropagation();archiveDocument(x)}} title="×”×¢×‘×¨×” ×œ×¡×œ ×”×ž×—×–×•×¨"><Trash2 size={16}/></button>}
                  <a
                    href={`${apiRoot}/documents/${x.id}/download`}
                    onClick={(event)=>event.stopPropagation()}
                    title="×”×•×¨×“×”"
                  >
                    <Download size={16} />
                  </a>
                </div>
              ))
            ) : (
              <div className="inline-empty">××™×Ÿ ×ž×¡×ž×›×™× ×‘×¤×¨×•×™×§×˜.</div>
            )}
          </section>
        </div>
      )}
      {tab === "reviews"&&<div className="project-two-columns execution-records">
        <section className="panel project-resource"><div className="panel-head"><div><h3>×‘×™×§×•×¨×•×ª ××ª×¨</h3><span>×¤×™×§×•×—, ×ž×ž×¦××™× ×•×¢×“×›×•×Ÿ ×ª×•×›× ×™×•×ª</span></div>{canEdit&&<button onClick={()=>setModal('review')}><Plus size={15}/>×‘×™×§×•×¨×ª</button>}</div>{workspace.reviews.length?workspace.reviews.map(x=><article className="execution-card" key={x.id}><header><strong>{dateText(x.review_date)} Â· {x.supervision_type||'×¤×™×§×•×— ××ª×¨'}</strong><small>{x.performed_by_name||x.created_by_name||'×œ× ×¦×•×™×Ÿ'}</small></header><p>{x.summary}</p>{x.follow_up&&<footer>×”×ž×©×š ×˜×™×¤×•×œ: {x.follow_up}</footer>}{x.plan_update_required&&<b>× ×“×¨×© ×¢×“×›×•×Ÿ ×ª×›× ×™×ª</b>}<VoiceNotesToggle api={api} apiRoot={apiRoot} entityType="site_review" entityId={x.id} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/></article>):<div className="inline-empty">×˜×¨× ×ª×•×¢×“×• ×‘×™×§×•×¨×•×ª ××ª×¨.</div>}</section>
        <section className="panel project-resource"><div className="panel-head"><div><h3>×¡×™×›×•×ž×™ ×¤×’×™×©×•×ª</h3><span>× ×•×›×—×™×, ×”×—×œ×˜×•×ª ×•×”×ž×©×š ×˜×™×¤×•×œ</span></div>{canEdit&&<button onClick={()=>setModal('meeting')}><Plus size={15}/>×¤×’×™×©×”</button>}</div>{workspace.meetings.length?workspace.meetings.map(x=><article className="execution-card" key={x.id}><header><strong>{new Date(x.meeting_at).toLocaleString('he-IL')}</strong><small>{x.attendees||'×œ× ×¦×•×™× ×• × ×•×›×—×™×'}</small></header><p>{x.summary}</p>{x.follow_up&&<footer>×”×ž×©×š ×˜×™×¤×•×œ: {x.follow_up}</footer>}<VoiceNotesToggle api={api} apiRoot={apiRoot} entityType="meeting" entityId={x.id} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/></article>):<div className="inline-empty">×˜×¨× × ×©×ž×¨×• ×¡×™×›×•×ž×™ ×¤×’×™×©×•×ª.</div>}</section>
      </div>}
      {tab === "activity" && (
        <div className="project-two-columns activity-layout">
          <form className="panel project-update-form" onSubmit={addUpdate}>
            <h3>×¤×¨×¡×•× ×¢×“×›×•×Ÿ</h3>
            <p>×”×¢×“×›×•×Ÿ × ×©×ž×¨ ×‘×”×™×¡×˜×•×¨×™×” ×•×ž×•×¤×™×¢ ×œ×›×œ ×ž×™ ×©×ž×•×¨×©×” ×œ×¦×¤×•×ª ×‘×¤×¨×•×™×§×˜.</p>
            <SmartTextArea api={api} value={note} onChange={setNote} setNotice={setNotice} label="×ª×•×›×Ÿ ×”×¢×“×›×•×Ÿ" textareaProps={{placeholder:'×¡×™×›×•× ×‘×™×§×•×¨, ×”×—×œ×˜×”, ×—×¨×™×’×” ××• ×”× ×—×™×” ×œ×‘×™×¦×•×¢'}}/>
            <VoiceNotes api={api} apiRoot={apiRoot} entityType="project_update_draft" entityId={updateVoiceContext} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/>
            <div className="project-mention-picker"><small>×ª×™×•×’ ×ž×©×ª×ž×©:</small>{mentionUsers.filter(item=>item.active&&String(item.id)!==String(user.id)).map(item=><button type="button" key={item.id} onClick={()=>setNote(current=>`${current}${current&&!current.endsWith(' ')?' ':''}@${item.displayName} `)}>@{item.displayName}</button>)}</div>
            <button className="ops-primary" disabled={!note.trim()}>
              <MessageSquare size={16} />
              ×¤×¨×¡×•× ×œ×¦×•×•×ª
            </button>
          </form>
          <section className="panel project-timeline">
            <div className="panel-head">
              <div>
                <h3>×™×•×ž×Ÿ ×¤×¢×™×œ×•×ª</h3>
                <span>×¢×“×›×•× ×™× ×•×¤×¢×•×œ×•×ª ×ž×¢×¨×›×ª</span>
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
                        : `${x.user_name || "×ž×¢×¨×›×ª"} Â· ${x.action}`}
                    </strong>
                    <small>
                      {x.kind === "update"
                        ? x.created_by_name || "×ž×©×ª×ž×©"
                        : x.entity_type}{" "}
                      Â· {new Date(x.when).toLocaleString("he-IL")}
                    </small>
                  </div>
                </div>
              ))}
          </section>
        </div>
      )}
      {modal==='review'&&<Modal title="×‘×™×§×•×¨×ª ××ª×¨ ×—×“×©×”" onClose={()=>setModal('')}><form className="work-form" onSubmit={addReview}><label>×ª××¨×™×š ×¤×™×§×•×—<input type="date" name="reviewDate" required defaultValue={localDateValue()}/></label><label>×¡×•×’ ×¤×™×§×•×—<input name="supervisionType" placeholder="×¤×™×§×•×— ×ª×©×ª×™×•×ª / ×”×ª×§× ×•×ª / ×ž×¡×™×¨×”"/></label><label>×ž×™ ×‘×™×¦×¢<select name="performedBy"><option value="">×‘×—×™×¨×” ×ž×”×ž××’×¨</option>{professionals.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label><label>×©×¢×•×ª ×¤×™×§×•×—<input type="number" name="hours" min="0" max="24" step="0.25" placeholder="0"/></label><label className="wide">×ž×ž×¦××™× ×•×¡×™×›×•×<textarea name="summary" required rows="5"/></label><label className="wide">×”×ž×©×š ×˜×™×¤×•×œ<textarea name="followUp" rows="3"/></label><div className="wide"><VoiceNotes api={api} apiRoot={apiRoot} entityType="site_review_draft" entityId={reviewVoiceContext} projectId={project.id} setNotice={setNotice} canDelete={user.role==='admin'}/></div><label className="wide">×ª×ž×•× ×•×ª, ×¡×§×™×¦×” ××• ×ª×›× ×™×ª ×ž×¢×•×“×›× ×ª<input type="file" name="attachments" accept="image/*,application/pdf,.dwg,.dxf" multiple/></label><label className="wide check-label"><input type="checkbox" name="planUpdateRequired"/>× ×“×¨×© ×¢×“×›×•×Ÿ ×ª×›× ×™×ª</label><div className="wide form-actions"><button type="button" className="ops-secondary" onClick={()=>setModal('')}>×‘×™×˜×•×œ</button><button className="ops-primary">×©×ž×™×¨×ª ×‘×™×§×•×¨×ª</button></div></form></Modal>}
      {modal==='meeting'&&<MeetingSummaryForm api={api} apiRoot={apiRoot} project={project} professionals={professionals} setNotice={setNotice} onClose={()=>setModal('')} onSubmit={addMeeting}/>}
      {modal === "team" && (
        <Modal title="×©×™×•×š ××™×© ×¦×•×•×ª" onClose={() => setModal("")}>
          <form className="work-form" onSubmit={addTeam}>
            <div className="wide form-inline-note"><button type="button" className="ops-secondary" onClick={()=>setModal('new-professional')}><Plus size={15}/>××™×© ×ž×§×¦×•×¢ ×—×“×©</button></div>
            <label>
              ×ª×¤×§×™×“ ×‘×¤×¨×•×™×§×˜
              <select name="roleTypeId" required value={teamRoleId} onChange={(event)=>setTeamRoleId(event.target.value)}>
                <option value="">×‘×—×™×¨×ª ×ª×¤×§×™×“</option>
                {reference.roles.filter((r)=>r.active).map((r)=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label>
              ×—×™×¤×•×© ×‘×ž××’×¨
              <input value={teamQuery} onChange={(event)=>setTeamQuery(event.target.value)} placeholder="×©×, ×—×‘×¨×” ××• ×˜×œ×¤×•×Ÿ" />
            </label>
            <label>
              ××™×© ×ž×§×¦×•×¢ ×ž×ª××™×
              <select name="professionalId" required>
                <option value="">×‘×—×™×¨×” ×ž×”×ž××’×¨</option>
                {professionals
                  .filter((p) => p.active && (!teamRoleId || p.roles?.some((role)=>String(role.id)===String(teamRoleId))) && (!teamQuery || `${p.displayName} ${p.companyName||''} ${p.phone||''}`.toLowerCase().includes(teamQuery.toLowerCase())))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} Â· {p.companyName || "×¢×•×‘×“ ×—×‘×¨×”"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="wide check-label">
              <input type="checkbox" name="isPrimary" />
              ××—×¨××™ ×¨××©×™ ×‘×ª×¤×§×™×“ ×–×”
            </label>
            <label className="wide">
              ×”×¢×¨×•×ª
              <textarea name="notes" />
            </label>
            <div className="wide form-actions">
              <button
                type="button"
                className="ops-secondary"
                onClick={() => setModal("")}
              >
                ×‘×™×˜×•×œ
              </button>
              <button className="ops-primary">×©×™×•×š ×œ×¤×¨×•×™×§×˜</button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "new-professional"&&<Modal title="××™×© ×ž×§×¦×•×¢ ×—×“×© ×•×©×™×•×š ×œ×¤×¨×•×™×§×˜" onClose={()=>setModal('')}><form className="work-form" onSubmit={createProfessionalAndAssign}><label>×©× ×ž×œ×<input name="displayName" required autoFocus/></label><label>×©×™×•×š<select name="affiliation"><option value="external">×—×™×¦×•× ×™</option><option value="company">×¢×•×‘×“ ×—×‘×¨×”</option></select></label><label>×—×‘×¨×”<input name="companyName"/></label><label>×ª×¤×§×™×“ ×—×•×¤×©×™<input name="jobTitle"/></label><label>×˜×œ×¤×•×Ÿ<input name="phone" inputMode="tel"/></label><label>×“×•××´×œ<input name="email" type="email"/></label><label className="wide">×ª×¤×§×™×“ ×‘×¤×¨×•×™×§×˜<select name="roleTypeId" required><option value="">×‘×—×™×¨×ª ×ª×¤×§×™×“</option>{reference.roles.filter(role=>role.active).map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label><div className="wide form-actions"><button type="button" className="ops-secondary" onClick={()=>setModal('team')}>×—×–×¨×”</button><button className="ops-primary">×©×ž×™×¨×” ×•×©×™×•×š</button></div></form></Modal>}
      {modal === "equipment" && (
        <Modal title="×”×•×¡×¤×ª ×¦×™×•×“ ×œ×¤×¨×•×™×§×˜" onClose={() => setModal("")}>
          <form className="work-form" onSubmit={addEquipment}>
            <label className="wide">
              ×¤×¨×™×˜ ×§×˜×œ×•×’
              <select name="catalogItemId" required>
                <option value="">×‘×—×™×¨×” ×ž×”×§×˜×œ×•×’</option>
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
              ×›×ž×•×ª
              <input
                name="quantity"
                type="number"
                min="0"
                step="0.1"
                defaultValue="1"
              />
            </label>
            <label>
              ×ž×™×§×•× ×‘×¤×¨×•×™×§×˜
              <input name="location" placeholder="×œ×ž×©×œ: ××¨×•×Ÿ ×ª×§×©×•×¨×ª ×§×•×ž×” 1" />
            </label>
            <label>
              ×¡×˜×˜×•×¡
              <select name="status">
                <option value="planned">×ž×ª×•×›× ×Ÿ</option>
                <option value="ordered">×”×•×–×ž×Ÿ</option>
                <option value="delivered">×¡×•×¤×§</option>
                <option value="installed">×”×•×ª×§×Ÿ</option>
                <option value="tested">× ×‘×“×§</option>
              </select>
            </label>
            <label>
              ×ž×¡×¤×¨ ×¡×™×“×•×¨×™
              <input name="serialNumber" />
            </label>
            <label className="wide">
              ×”×¢×¨×•×ª
              <textarea name="notes" />
            </label>
            <div className="wide form-actions">
              <button
                type="button"
                className="ops-secondary"
                onClick={() => setModal("")}
              >
                ×‘×™×˜×•×œ
              </button>
              <button className="ops-primary">×”×•×¡×¤×” ×œ×¤×¨×•×™×§×˜</button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "document" && (
        <Modal title="×”×¢×œ××ª ×ž×¡×ž×š ×œ×¤×¨×•×™×§×˜" onClose={() => setModal("")}>
          <form className="work-form" onSubmit={addDocument}>
            <label className="wide document-drop">
              <Upload size={23} />
              <strong>×‘×—×™×¨×ª ×§×•×‘×¥ ×¢×“ 100MB</strong>
              <input name="file" type="file" required />
            </label>
            <label>
              ×›×•×ª×¨×ª
              <input name="title" placeholder="×× ×¨×™×§ ×™×•×¦×’ ×©× ×”×§×•×‘×¥" />
            </label>
            <label>
              ×§×˜×’×•×¨×™×”
              <select name="category">
                <option>×ª×•×›× ×™×ª</option>
                <option>×ž×¡×ž×š ×¡×¨×•×§</option>
                <option>PDF</option>
                <option>×”×–×ž× ×”</option>
                <option>×”×¦×¢×ª ×ž×—×™×¨</option>
                <option>×¤×¨×•×˜×•×§×•×œ</option>
                <option>×¦×™×œ×•× ××ª×¨</option>
                <option>××—×¨</option>
              </select>
            </label>
            <label>
              ×’×¨×¡×”
              <input name="version" type="number" min="1" defaultValue="1" />
            </label>
            <label>
              ×ª×’×™×
              <input name="tags" placeholder="×—×©×ž×œ, ×§×•×ž×” 2" />
            </label>
            <label className="wide">
              ×ª×™××•×¨
              <textarea name="description" />
            </label>
            <div className="wide form-actions">
              <button
                type="button"
                className="ops-secondary"
                onClick={() => setModal("")}
              >
                ×‘×™×˜×•×œ
              </button>
              <button className="ops-primary">
                <Upload size={16} />
                ×”×¢×œ××” ×•×©×™×•×š
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
      {modal === "priority-import" && <PriorityImportWizard project={project} api={api} onClose={()=>setModal("")} onImported={async()=>{await load();setNotice("×”×–×ž× ×ª Priority ×™×•×‘××” ×•×¢×“×›× ×” ××ª ×”×¤×¨×•×™×§×˜")}} />}
      {priorityOrderDetail && <AppModal title={`×”×–×ž× ×ª Priority ${priorityOrderDetail.order.priorityOrderNumber}`} subtitle="×ª×™×¢×•×“ ×”×™×™×‘×•× ×œ×¤×¨×•×™×§×˜" onClose={()=>setPriorityOrderDetail(null)} className="priority-order-detail">
        <div className="priority-order-detail-content">
          <header><div><span>×œ×§×•×—</span><strong>{priorityOrderDetail.order.customerName}</strong></div><div><span>×¡×˜×˜×•×¡</span><strong>{priorityOrderDetail.order.orderStatus||"â€”"}</strong></div><div><span>×”×¦×¢×ª ×ž×—×™×¨</span><strong>{priorityOrderDetail.order.quotationNumber||"â€”"}</strong></div>{priorityOrderDetail.order.totalAmount!==undefined&&<div><span>×¡×”×´×›</span><strong>{priorityMoney.format(priorityOrderDetail.order.totalAmount)}</strong></div>}</header>
          <div className="priority-order-detail-lines">{priorityOrderDetail.lines.map(line=><article key={line.id}><span>{line.prioritySku||"â€”"}</span><div><strong>{line.description}</strong>{line.originalDescription!==line.description&&<small>×ž×§×•×¨: {line.originalDescription}</small>}</div><b>{line.quantity} {line.unit}</b><em>{classificationLabel(line.classification)}</em><small>{line.projectSystemName||"×œ×œ× ×ž×¢×¨×›×ª"}{line.catalogItemName?` Â· ${line.catalogItemName}`:""}</small></article>)}</div>
        </div>
      </AppModal>}
      {previewFile&&<Modal title={previewFile.title||previewFile.original_name} onClose={()=>setPreviewFile(null)} className="project-media-modal">
        <div className="project-media-viewer">
          {previewFile.mime_type?.startsWith('image/')?<img src={`${apiRoot}/documents/${previewFile.id}/preview`} alt={previewFile.title||previewFile.original_name}/>:previewFile.mime_type?.startsWith('video/')?<video src={`${apiRoot}/documents/${previewFile.id}/preview`} controls playsInline/>:previewFile.mime_type==='application/pdf'?<iframe src={`${apiRoot}/documents/${previewFile.id}/preview`} title={previewFile.title||previewFile.original_name}/>:<div className="media-unsupported"><FileText size={52}/><h3>×”×ž×¡×ž×š ×–×ž×™×Ÿ ×œ×¤×ª×™×—×” ××• ×œ×”×•×¨×“×”</h3><p>×ª×¦×•×’×” ×ž×§×“×™×ž×” ×ž×œ××” ×©×œ ×§×•×‘×¦×™ Word ×•Ö¾Excel ×ª×œ×•×™×” ×‘×™×™×©×•× ×”×ž×•×ª×§×Ÿ ×‘×ž×›×©×™×¨.</p></div>}
          <footer><span>{previewFile.category} Â· {dateText(previewFile.created_at)} Â· {previewFile.uploaded_by_name||'×ž×¢×¨×›×ª'}</span><div><a className="ops-secondary" href={`${apiRoot}/documents/${previewFile.id}/preview`} target="_blank" rel="noreferrer">×¤×ª×™×—×” ×‘×ž×›×©×™×¨</a><a className="ops-primary" href={`${apiRoot}/documents/${previewFile.id}/download`}><Download size={16}/>×”×•×¨×“×ª ×”×§×•×‘×¥</a></div></footer>
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
    <Modal title="×¢×¨×™×›×ª ×¤×¨×•×™×§×˜ ×•×œ×§×•×—" onClose={onClose}>
      <form className="work-form project-edit-form" onSubmit={onSubmit}>
        <label className="wide">
          ×©× ×”×¤×¨×•×™×§×˜
          <input name="name" required defaultValue={project.name} />
        </label>
        <div className="wide client-mode-switch">
          <button
            type="button"
            className={editClientMode === "existing" ? "active" : ""}
            onClick={() => setEditClientMode("existing")}
          >
            ×§×™×©×•×¨ ×œ×œ×§×•×— ×§×™×™×
          </button>
          <button
            type="button"
            className={editClientMode === "new" ? "active" : ""}
            onClick={() => setEditClientMode("new")}
          >
            ×™×¦×™×¨×ª ×œ×§×•×— ×—×“×©
          </button>
        </div>
        {editClientMode === "existing" ? (
          <>
            <label>
              ×œ×§×•×— ×‘×ž××’×¨
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
                <option value="">×‘×—×™×¨×ª ×œ×§×•×—</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} Â· {client.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ×©× ×”×œ×§×•×—
              <input
                required
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
              />
              <small>
                ×©×™× ×•×™ ×”×©× ×™×¢×“×›×Ÿ ××ª ×›×¨×˜×™×¡ ×”×œ×§×•×— ×•××ª ×›×œ ×”×¤×¨×•×™×§×˜×™× ×”×ž×§×•×©×¨×™× ××œ×™×•.
              </small>
            </label>
          </>
        ) : (
          <>
            <label>
              ×©× ×œ×§×•×— ×—×“×©
              <input
                required
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
              />
            </label>
            <label>
              ×˜×œ×¤×•×Ÿ ×œ×§×•×—
              <input name="clientPhone" required defaultValue={project.phone} />
            </label>
            <label>
              ×›×ª×•×‘×ª ×œ×§×•×—
              <input
                name="clientAddress"
                required
                defaultValue={project.address}
              />
            </label>
            <label>
              ×¢×™×¨
              <input name="clientCity" defaultValue={project.location} />
            </label>
            <label className="wide">
              ×“×•××´×œ ×œ×§×•×—
              <input
                name="clientEmail"
                type="email"
                defaultValue={project.email}
              />
            </label>
          </>
        )}
        <label>×ª×—×•× ×”×¤×¨×•×™×§×˜<select name="projectCategory" value={projectCategory} onChange={(event)=>setProjectCategory(event.target.value)}><option value="smart_home">×‘×™×ª ×—×›×</option><option value="other">××—×¨</option></select></label>
        {projectCategory==='other'&&<><label>×¡×•×’ ×¤×¨×•×™×§×˜ ×—×•×¤×©×™<input name="projectCategoryCustom" required defaultValue={project.projectCategoryCustom||''}/></label><div className="wide project-profile-fields"><label>×©× ×ª×”×œ×™×š ×¢×‘×•×“×”<input name="workflowLabel" defaultValue={project.projectProfile?.workflowLabel||''}/></label><label>×©× ××–×•×¨ ×”×ž×¢×¨×›×•×ª<input name="systemsLabel" defaultValue={project.projectProfile?.systemsLabel||''}/></label><label>×©× ××–×•×¨×™ ×”×¢×‘×•×“×”<input name="areasLabel" defaultValue={project.projectProfile?.areasLabel||''}/></label></div></>}
        {projectCategory==='smart_home'&&<label>
          ×¡×™×•×•×’ ×”×¤×¨×•×™×§×˜
          <select name="projectClassification" defaultValue={project.projectClassification || "private_house"}>
            {projectClassificationOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>}
        <label>××™×™×§×•×Ÿ ×”×¤×¨×•×™×§×˜<select name="projectIcon" defaultValue={project.projectIcon||project.projectClassification||"home"}>{projectIconOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>×¦×‘×¢ ×ž×•×‘×™×œ<input type="color" name="projectColor" defaultValue={project.projectColor||"#6957df"}/></label>
        <label>×¨××© ×¦×•×•×ª ×”×ª×§× ×”<select name="installationLeadId" defaultValue={project.installationLeadId||""}><option value="">×œ×œ× ×”×§×¦××”</option>{professionals.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label>
          ×ž×™×§×•× / ×¢×™×¨ ×”×¤×¨×•×™×§×˜
          <input name="location" defaultValue={project.location} />
        </label>
        <label>
          ×›×ª×•×‘×ª ××ª×¨ ×”×¤×¨×•×™×§×˜
          <input name="address" required defaultValue={project.address} />
        </label>
        <label>
          ×˜×œ×¤×•×Ÿ ×‘×¤×¨×•×™×§×˜
          <input name="phone" defaultValue={project.phone} />
        </label>
        <label>
          ×“×•××´×œ ×‘×¤×¨×•×™×§×˜
          <input name="email" type="email" defaultValue={project.email} />
        </label>
        {canViewFinance&&<label>
          ×©×•×•×™ ×”×¤×¨×•×™×§×˜
          <input
            name="value"
            type="number"
            min="0"
            defaultValue={project.value}
          />
        </label>}
        {canViewFinance&&<fieldset className="wide project-finance-wizard"><legend>××©×£ ×›×¡×¤×™× ××•×¤×¦×™×•× ×œ×™</legend><label>××•×¤×Ÿ ×ª×§×¦×•×‘<select name="financeMode" defaultValue={project.financeMode||"total"}><option value="total">×¡×›×•× ×›×œ×œ×™</option><option value="systems">×¤×™×¦×•×œ ×œ×¤×™ ×ž×¢×¨×›×•×ª</option></select></label><label>×ª× ××™ ×ª×©×œ×•×<input name="paymentTerms" defaultValue={project.paymentTerms||""} placeholder="×œ×“×•×’×ž×”: 30% ×ž×§×“×ž×”, 40% ×”×ª×§× ×”, 30% ×ž×¡×™×¨×”"/></label><label>×¡×›×•× ×ž×§×“×ž×”<input name="depositAmount" type="number" min="0" step="0.01" defaultValue={project.depositAmount||""}/></label><label className="finance-paid-check"><input name="depositPaid" type="checkbox" defaultChecked={project.depositPaid}/>×”×ž×§×“×ž×” ×©×•×œ×ž×”</label>{(project.systems||[]).length>0&&<div className="wide finance-system-breakdown"><strong>×¤×™×¦×•×œ ×¡×›×•× ×œ×¤×™ ×ž×¢×¨×›×ª</strong>{project.systems.map((name,index)=><label key={`${name}-${index}`}>{name}<input name={`systemAmount-${index}`} type="number" min="0" step="0.01" defaultValue={project.financeBreakdown?.find(item=>item.name===name)?.amount||""}/></label>)}</div>}</fieldset>}
        <label>
          ×™×¢×“ ×©×¢×•×ª ×”×ª×§× ×”
          <input name="installationHoursTarget" type="number" min="0" step="0.5" defaultValue={project.installationHoursTarget || ""} placeholder="×œ×œ× ×™×¢×“" />
        </label>
        <label>
          ×™×¢×“ ×©×¢×•×ª ×ª×›× ×•×ª
          <input name="programmingHoursTarget" type="number" min="0" step="0.5" defaultValue={project.programmingHoursTarget || ""} placeholder="×œ×œ× ×™×¢×“" />
        </label>
        <p className="wide time-target-note">×¨×§ ×”×ª×§× ×” ×•×ª×›× ×•×ª ×ž× ×•×”×œ×•×ª ×ž×•×œ ×™×¢×“. ×™×ª×¨ ×¡×•×’×™ ×”×¢×‘×•×“×” × ×ž×“×“×™× ×‘×¤×•×¢×œ ×œ×œ× ×™×¢×“.</p>
        <label>
          ×ª××¨×™×š ×™×¢×“ / ×˜×§×¡×˜
          <input name="due" defaultValue={project.due} />
        </label>
        <label>
          ××‘×Ÿ ×”×“×¨×š ×”×‘××”
          <input name="nextMilestone" defaultValue={project.nextMilestone} />
        </label>
        <label>
          ×¢×“×™×¤×•×ª
          <select name="priority" defaultValue={project.priority || "normal"}>
            <option value="low">× ×ž×•×›×”</option>
            <option value="normal">×¨×’×™×œ×”</option>
            <option value="high">×’×‘×•×”×”</option>
            <option value="urgent">×“×—×•×¤×”</option>
          </select>
        </label>
        <label className="wide">
          ×“×’×œ / ×¡×™×ž×•×Ÿ
          <input name="flag" defaultValue={project.flag} />
        </label>
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ×‘×™×˜×•×œ
          </button>
          <button className="ops-primary">
            <Check size={16} />
            ×©×ž×™×¨×ª ×”×©×™× ×•×™×™×
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
    ["finishing", "×¢×‘×•×“×•×ª ×’×ž×¨"],
    ["carpentry", "×”×¨×›×‘×•×ª × ×’×¨×•×ª"],
    ["waiting", "×‘×”×ž×ª× ×”"],
    ["infrastructure_paving", "×¡×œ×™×œ×ª ×ª×©×ª×™×•×ª"],
    ["drywall_paint", "×¢×‘×•×“×•×ª ×’×‘×¡ ×•×¦×‘×¢"],
    ["stopped", "×‘×¢×¦×™×¨×”"],
  ];
  return (
    <section className="panel project-attributes">
      <label>
        ×¡×™×•×•×’ ×”×¤×¨×•×™×§×˜
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
        ×’×•×“×œ ×”×¤×¨×•×™×§×˜
        <select
          value={project.projectSize || "medium"}
          onChange={(event) =>
            updateProject(project.id, { projectSize: event.target.value })
          }
        >
          <option value="small">×§×˜×Ÿ</option>
          <option value="medium">×‘×™× ×•× ×™</option>
          <option value="large">×’×“×•×œ</option>
        </select>
      </label>
      <label>
        ×”×ª×§×“×ž×•×ª ×§×‘×œ×Ÿ
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
        ×ª×™×§×™×™×ª ×ž×¡×ž×›×™× ×‘Ö¾NAS
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
        <small>×©× ×ª×™×§×™×™×ª ×”×¤×¨×•×™×§×˜ ×‘×ª×•×š ×ª×™×§×™×™×ª ×”×ž×¡×ž×›×™× ×”×¨××©×™×ª</small>
      </label>
      <div>
        <span>×”×ª×§×“×ž×•×ª ×”×¤×¨×•×™×§×˜</span>
        <strong>{project.progress}%</strong>
        <small>×ž×—×•×©×‘ ××•×˜×•×ž×˜×™×ª ×œ×¤×™ ×©×œ×‘ ×”×¤×¨×•×™×§×˜</small>
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
        throw new Error("×”×“×¤×“×¤×Ÿ ××™× ×• ×ª×•×ž×š ×‘×¦×™×œ×•× ×™×©×™×¨");
      }
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      setCameraOpen(true);
    } catch (error) {
      setNotice(error.message || "×œ× × ×™×ª× ×” ×”×¨×©××” ×œ×ž×¦×œ×ž×”");
    }
  };
  const captureComputerPhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return setNotice("×”×ž×¦×œ×ž×” ×¢×“×™×™×Ÿ ×œ× ×ž×•×›× ×”");
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
      return setNotice("×™×© ×œ×‘×—×•×¨ ×ª×ž×•× ×”, ×¡×¨×˜×•×Ÿ ××• ×œ×¦×œ× ×ª×ž×•× ×”");
    if(file.type.startsWith("video/")&&file.size>30*1024*1024&&!confirm("×”×¡×¨×˜×•×Ÿ ×’×“×•×œ ×žÖ¾30MB. ×”×¢×œ××” ×—×¨×™×’×” ×–×ž×™× ×” ×œ×ž× ×”×œ ×‘×œ×‘×“ ×•×“×•×¨×©×ª ××™×©×•×¨ ×ž×¤×•×¨×©. ×œ×”×ž×©×™×š?"))return;
    setBusy(true);
    try {
      const documentBody = new FormData();
      documentBody.append("projectId", project.id);
      documentBody.append("category", "×¦×™×œ×•× ××ª×¨");
      documentBody.append("title", text || file.name);
      documentBody.append("description", text);
      if(file.type.startsWith("video/")&&file.size>30*1024*1024)documentBody.append("largeFileApproved","true");
      documentBody.append("file", file);
      await api("/documents", { method: "POST", body: documentBody });
      await api(`/projects/${project.id}/updates`, {
        method: "POST",
        body: JSON.stringify({ body: text || `×”×•×¢×œ×ª×” ×ª×ž×•× ×”: ${file.name}` }),
      });
      setNotice(`${file.type.startsWith("video/")?"×”×¡×¨×˜×•×Ÿ":"×”×ª×ž×•× ×”"} ×•×”×¢×“×›×•×Ÿ × ×•×¡×¤×• ×œ×¤×¨×•×™×§×˜`);
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
          ×¦×™×œ×•× ××• ×”×¢×œ××ª ×ª×ž×•× ×”
        </button>
      ) : (
        <form onSubmit={submit}>
          <div className="photo-source-grid">
            <label className="photo-capture"><Camera size={22}/><span>×¦×™×œ×•× ×‘×˜×œ×¤×•×Ÿ</span><input type="file" accept="image/*" capture="environment" aria-label="×¦×™×œ×•× ×ª×ž×•× ×” ×‘×˜×œ×¤×•×Ÿ" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
            <label className="photo-capture"><Upload size={22}/><span>×‘×—×™×¨×” ×ž×”×’×œ×¨×™×”</span><input type="file" accept="image/*" aria-label="×‘×—×™×¨×ª ×ª×ž×•× ×” ×ž×”×’×œ×¨×™×”" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
            <button type="button" className="photo-capture" onClick={openComputerCamera}><Camera size={22}/><span>×ž×¦×œ×ž×ª ×ž×—×©×‘</span></button>
            <label className="photo-capture"><Film size={22}/><span>×¡×¨×˜×•×Ÿ ×¢×“ 30MB</span><input type="file" accept="video/*" aria-label="×‘×—×™×¨×ª ×¡×¨×˜×•×Ÿ" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
          </div>
          {cameraOpen && <div className="webcam-capture"><video ref={videoRef} playsInline muted/><div><button type="button" className="ops-secondary" onClick={closeCamera}>×‘×™×˜×•×œ</button><button type="button" className="ops-primary" onClick={captureComputerPhoto}><Camera size={16}/>×¦×™×œ×•×</button></div></div>}
          {file&&<div className="selected-media"><Check size={16}/><span>{file.name}</span><small>{(file.size/1024/1024).toFixed(1)} MB</small></div>}
          <label>
            ×ž×œ×œ × ×œ×•×•×”
            <textarea
              name="text"
              placeholder="×ž×” ×¨×•××™× ×‘×ª×ž×•× ×”, ×ž×™×§×•× ×‘××ª×¨ ×•×”×¤×¢×•×œ×” ×”× ×“×¨×©×ª"
            />
          </label>
          <div>
            <button
              type="button"
              className="ops-secondary"
              onClick={() => setOpen(false)}
            >
              ×‘×™×˜×•×œ
            </button>
            <button className="ops-primary" disabled={busy}>
              {busy ? "×ž×¢×œ×”..." : "×©×ž×™×¨×” ×‘×¤×¨×•×™×§×˜"}
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
        <span>×—×™×¤×•×© ×›×ª×•×‘×ª ×—×›×</span>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="×”×§×œ×“×ª ×¨×—×•×‘, ×ž×¡×¤×¨ ×•×¢×™×¨"
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
      <small>Photon Â· OpenStreetMap â€” ×œ×œ× ×ž×¤×ª×— API ×•×œ×œ× ×¢×œ×•×ª ×©×™×ž×•×©.</small>
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
      setNotice("×”×ž×©×™×ž×” × ×©×ž×¨×” ×‘×”×¦×œ×—×”");
      if (typeof onDataChanged === "function") onDataChanged();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const saveSchedule = async (item, dates) => {
    try {
      const base = item.kind === "task" ? "/operations/tasks" : "/operations/milestones";
      await api(`${base}/${item.id}`, { method:"PATCH", body:JSON.stringify(item.kind === "task" ? dates : { dueDate:dates.dueDate, color:dates.color }) });
      if(dates.mentionUserIds?.length)await api('/mentions',{method:'POST',body:JSON.stringify({userIds:dates.mentionUserIds,subject:`×ª×™×•×’ ×‘×ž×©×™×ž×” ${item.title}`,body:`×ª×•×™×’×ª ×‘×ž×©×™×ž×” ${item.title}. ×”×ª××¨×™×›×™× ×¢×•×“×›× ×• ×œ-${dates.startDate} ×¢×“ ${dates.dueDate}.`,linkedUrl:`?project=${encodeURIComponent(project.id)}&task=${encodeURIComponent(item.id)}`})});
      setNotice("×ª××¨×™×›×™ ×”×ž×©×™×ž×” ×¢×•×“×›× ×•");
      if (typeof onDataChanged === "function") await onDataChanged();
    } catch (error) { setNotice(error.message); if (typeof onDataChanged === "function") await onDataChanged(); }
  };
  if (!items.length) return <div className="panel gantt-empty"><Activity size={30} /><h3>×œ×•×— ×”×’×× ×˜ ×ž×•×›×Ÿ</h3><p>×”×•×¡×™×¤×• ×œ×ž×©×™×ž×•×ª ×ª××¨×™×š ×”×ª×—×œ×” ×•×¡×™×•× ××• ××‘× ×™ ×“×¨×š ×›×“×™ ×œ×‘× ×•×ª ××ª ×¦×™×¨ ×”×‘×™×¦×•×¢.</p></div>;
  return (
    <>
      <GanttTimeline compact groups={[[project.name, items]]} onOpen={(item) => setEditor({ kind: item.kind, item })} onScheduleChange={saveSchedule} users={users} title={`×’×× ×˜ ×‘×™×¦×•×¢ Â· ${project.name}`} />
      {editor && <TaskEditor api={api} setNotice={setNotice} kind={editor.kind} initial={editor.item} projects={projects} professionals={professionals} tasks={tasks} fixedProjectId={project.id} onClose={() => setEditor(null)} onSave={save} />}
    </>
  );
}

const timeActivityLabels={planning:'×ª×›× ×•×Ÿ',supervision:'×¤×™×§×•×—',technician:'×–×ž×Ÿ ×˜×›× ××™×',installation:'×”×ª×§× ×”',threading:'×”×©×—×œ×•×ª',programming:'×ª×›× ×•×ª',training:'×”×“×¨×›×”'};

function ProjectHoursPanel({project,entries,professionals,api,setNotice,onDone,canEdit,openRequest=0}){
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(openRequest>0)setOpen(true)},[openRequest]);
  const totals=summarizeTimeEntries(entries);
  const totalHours=totals.reduce((sum,item)=>sum+item.hours,0);
  const submit=async(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);try{await api(`/projects/${project.id}/time-entries`,{method:'POST',body:JSON.stringify({activityType:data.get('activityType'),workDate:data.get('workDate'),hours:data.get('hours'),professionalId:data.get('professionalId')||null,notes:data.get('notes')})});setOpen(false);setNotice('×“×™×•×•×— ×”×©×¢×•×ª × ×©×ž×¨');onDone()}catch(error){setNotice(error.message)}};
  const targetFor=(key)=>key==='installation'?Number(project.installationHoursTarget||0):key==='programming'?Number(project.programmingHoursTarget||0):0;
  return <section className="project-hours-page">
    <header className="panel project-hours-head"><div><span><Timer size={19}/></span><div><h3>×ž×•× ×” ×©×¢×•×ª ×œ×¤×¨×•×™×§×˜</h3><p>× ×ª×•× ×™ ×‘×™×¦×•×¢ ×ž×•×‘× ×™× ×ž×“×•×—×•×ª, ×˜×¤×¡×™× ×•×“×™×•×•×— ×™×“× ×™. ×™×¢×“×™× × ×§×‘×¢×™× ×‘×”×§×ž×ª ×”×¤×¨×•×™×§×˜ ××• ×‘×¢×¨×™×›×ª×•.</p></div></div><strong>{totalHours.toLocaleString('he-IL',{maximumFractionDigits:1})}<small> ×©×¢×•×ª ×‘×¤×•×¢×œ</small></strong>{canEdit&&<div className="hours-actions"><button className="ops-primary" onClick={()=>setOpen(true)}><Plus size={16}/>×“×™×•×•×— ×©×¢×•×ª</button></div>}</header>
    <div className="project-hours-kpis">{totals.map(item=>{const target=targetFor(item.key);const percent=target?item.hours/target*100:0;return <article className={target&&item.hours>target?'over-target':''} key={item.key}><span>{item.label}</span><b>{item.hours.toLocaleString('he-IL',{maximumFractionDigits:1})}</b><small>{target?`×ž×ª×•×š ×™×¢×“ ${target} ×©×¢×•×ª`:'×©×¢×•×ª ×©× ×ž×“×“×•'}</small><i style={{width:`${target?Math.min(100,Math.max(4,percent)):totalHours?Math.max(4,item.hours/totalHours*100):0}%`}}/>{target>0&&<em>{Math.round(percent)}%</em>}</article>})}</div>
    <div className="project-hours-grid"><section className="panel"><h3>×”×ª×¤×œ×’×•×ª ×©×¢×•×ª ×œ×¤×™ ×¤×¢×™×œ×•×ª</h3><div className="project-hours-chart" dir="ltr"><ResponsiveContainer width="100%" height={300}><BarChart data={totals} layout="vertical" margin={{top:8,right:18,bottom:4,left:86}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} domain={[0,'auto']}/><YAxis type="category" dataKey="label" width={78} tickLine={false} axisLine={false} tick={{fill:'#626a7d',fontSize:12}}/><Tooltip formatter={(value)=>[`${value} ×©×¢×•×ª`,'×‘×¤×•×¢×œ']} labelFormatter={(label)=>String(label)} contentStyle={{direction:'rtl',textAlign:'right'}}/><Bar dataKey="hours" fill="#6957df" radius={[0,8,8,0]} minPointSize={2} isAnimationActive/></BarChart></ResponsiveContainer></div></section><section className="panel time-entry-list"><h3>×“×™×•×•×—×™× ××—×¨×•× ×™×</h3>{entries.slice(0,12).map(item=><article key={item.id}><i/><div><strong>{timeActivityLabels[item.activity_type]||item.activity_type}</strong><small>{item.professional_name||item.user_name||'×ž×©×ª×ž×©'} Â· {dateText(item.work_date)}</small></div><b>{Number(item.hours)} ×©×³</b></article>)}{!entries.length&&<div className="inline-empty">×˜×¨× ×“×•×•×—×• ×©×¢×•×ª ×œ×¤×¨×•×™×§×˜.</div>}</section></div>
    {open&&<Modal title="×“×™×•×•×— ×©×¢×•×ª ×¢×‘×•×“×”" onClose={()=>setOpen(false)}><form className="work-form" onSubmit={submit}><label>×¡×•×’ ×¤×¢×™×œ×•×ª<select name="activityType" required>{Object.entries(timeActivityLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>×ª××¨×™×š<input type="date" name="workDate" required defaultValue={localDateValue()}/></label><label>×ž×¡×¤×¨ ×©×¢×•×ª<input type="number" name="hours" required min="0.25" max="24" step="0.25" autoFocus/></label><label>×ž×‘×¦×¢<select name="professionalId"><option value="">×”×ž×©×ª×ž×© ×”×ž×“×•×•×—</option>{professionals.filter(item=>item.active!==false).map(item=><option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label><label className="wide">×”×¢×¨×•×ª<textarea name="notes"/></label><div className="form-actions wide"><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>×‘×™×˜×•×œ</button><button className="ops-primary">×©×ž×™×¨×ª ×“×™×•×•×—</button></div></form></Modal>}
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
        <h3>×œ×•×— ×”×’×× ×˜ ×ž×•×›×Ÿ</h3>
        <p>
          ×”×•×¡×™×¤×• ×œ×ž×©×™×ž×•×ª ×ª××¨×™×š ×”×ª×—×œ×” ×•×™×¢×“, ××• ××‘× ×™ ×“×¨×š, ×›×“×™ ×œ×‘× ×•×ª ×¦×™×¨ ×‘×™×¦×•×¢.
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
    day: { pixelsPerDay: 92, tickDays: 1, label: "×™×•×" },
    week: { pixelsPerDay: 34, tickDays: 7, label: "×©×‘×•×¢" },
    month: { pixelsPerDay: 13, tickDays: 30, label: "×—×•×“×©" },
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
          <h3>×’×× ×˜ ×‘×™×¦×•×¢ ×œ×¤×¨×•×™×§×˜</h3>
          <p>
            {dateText(dataMin)} â€” {dateText(dataMax)} Â· {items.length} ×¤×¢×™×œ×•×™×•×ª ×•××‘× ×™
            ×“×¨×š
          </p>
        </div>
        <div className="project-gantt-actions" aria-label="×¨×ž×ª ×ª×¦×•×’×ª ×”×’×× ×˜">
          {[["day", "×™×•×"], ["week", "×©×‘×•×¢"], ["month", "×—×•×“×©"]].map(([value, label]) => (
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
        {dependencyLines.length > 0 && <svg className="gantt-dependencies" width={trackWidth} height={items.length * 64} viewBox={`0 0 ${trackWidth} ${items.length * 64}`} preserveAspectRatio="none" aria-label="×§×•×•×™ ×ª×œ×•×ª ×‘×™×Ÿ ×ž×©×™×ž×•×ª"><defs><marker id="gantt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>{dependencyLines.map(line => <path key={line.id} d={line.d} markerEnd="url(#gantt-arrow)" />)}</svg>}
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
                    ? "××‘×Ÿ ×“×¨×š"
                    : item.assignee_name || "×œ×œ× ××—×¨××™"}
                </small>
                <em>{dateText(item.start)} â€” {dateText(item.end)}</em>
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
                  <span>{item.kind === "milestone" ? item.title : item.critical ? `×ž×©×™×ž×” ×§×¨×™×˜×™×ª Â· ${item.title}` : item.title}</span>
                </i>
              </div>
            </article>
          );
        })}
        </div>
      </div>
      <footer className="project-gantt-legend">
        <span><i className="planned" />×ž×©×™×ž×” ×¤×¢×™×œ×”</span>
        <span><i className="done" />×”×•×©×œ×ž×”</span>
        <span><i className="critical" />×ž×©×™×ž×” ×§×¨×™×˜×™×ª</span>
        <small>×ª×¦×•×’×ª {zoomConfig.label} Â· ×”×’×œ×™×œ×” ×ž×¨×—×™×‘×” ××ª ×¦×™×¨ ×”×–×ž×Ÿ ××•×˜×•×ž×˜×™×ª</small>
      </footer>
    </section>
  );
}





