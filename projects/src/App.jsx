import { Component, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpDown,
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  CreditCard,
  FileText,
  Filter,
  Flag,
  FolderKanban,
  FormInput,
  Gauge,
  Home,
  LayoutDashboard,
  Link2,
  ListFilter,
  Database,
  LogOut,
  Mail,
  Map,
  MapPin,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  WalletCards,
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
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import { passwordsMatch } from "./features/auth/passwordPolicy";
import { activity, clients, milestones, stageMeta } from "./data";
import {
  AlertCenter,
  CalendarWorkspace,
  ClientsWorkspace,
  InsightsTile,
  OperationalSettings,
} from "./Operational";
import { FormsWorkspace } from "./FormsWorkspace";
import { MasterDataWorkspace } from "./MasterDataWorkspace";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { ModalPortal } from "./AppModal";
import packageJson from "../package.json";
import {
  FinanceWorkspace,
  ReportsWorkspace,
  TasksWorkspace,
} from "./Workspaces";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { MyWorkWorkspace, PortfolioControlWorkspace } from "./ProductivityWorkspace";

const projectClassificationOptions = [
  ["private_house", "בית פרטי"],
  ["villa", "וילה"],
  ["cottage", "קוטג׳"],
  ["penthouse", "פנטהאוז"],
  ["apartment_building", "בניין משותף"],
  ["studio", "סטודיו"],
  ["duplex", "דופלקס"],
];
const projectClassificationLabels = Object.fromEntries(projectClassificationOptions);
import { GanttWorkspace } from "./GanttWorkspace";
import { MessageCenter } from "./Messages";
import { AiChat, AiChatBoundary } from "./AiChat";
import "./operational.css";
import "./forms-workspace.css";
import "./master-data.css";
import "./workspaces.css";
import "./theme-dark.css";
import "./contacts.css";
import "./messages.css";
import "./task-center.css";
import "./ai-chat.css";
import "./ai-chat-voice.css";
import "./commercial-gantt.css";
import "./modal-system.css";
import "./productivity.css";
import projectsMark from "./assets/projects-mark.svg";

const money = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const compactMoney = (value) =>
  value >= 1000000
    ? `₪${(value / 1000000).toFixed(2)}M`
    : `₪${Math.round(value / 1000)}K`;
const actionNamesForDashboard = {
  create: "יצר רשומה",
  update: "עדכן רשומה",
  delete: "מחק רשומה",
  archive: "העביר לארכיון",
  restore: "שחזר מהארכיון",
  upload: "העלה קובץ",
  login: "נכנס למערכת",
  logout: "יצא מהמערכת",
  snooze: "דחה התראה",
  backup: "יצר גיבוי",
};

class WorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("PROJECTS workspace failure", error, info);
    api("/ui-errors", {
      method: "POST",
      body: JSON.stringify({
        message: String(error?.message || "Unknown UI error").slice(0, 500),
        stack: String(error?.stack || "").slice(0, 6000),
        componentStack: String(info?.componentStack || "").slice(0, 6000),
        page: this.props.page,
        path: window.location.href.slice(0, 1000),
        userAgent: navigator.userAgent.slice(0, 500),
      }),
    }).catch(() => {});
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="workspace-error" dir="rtl">
        <AlertTriangle size={34} />
        <h2>המסך נתקל בתקלה נקודתית</h2>
        <p>שאר המערכת ממשיכה לפעול. אפשר לנסות לפתוח מחדש את המסך בלי לרענן את כל האפליקציה.</p>
        <button type="button" className="primary-button" onClick={() => this.setState({ error: null })}>פתיחה מחדש</button>
        <details><summary>פרטי תקלה</summary><code>{String(this.state.error?.message || "Unknown UI error")}</code></details>
      </section>
    );
  }
}
// Vite loads this bundle from <application base>/assets/. Deriving the base
// from the bundle URL works whether the Ingress page URL ends with a slash or
// not, and also keeps the standalone interface rooted at /.
const bundlePath = new URL(import.meta.url).pathname;
const applicationBase = bundlePath.includes("/assets/")
  ? bundlePath.replace(/\/assets\/[^/]+$/, "").replace(/\/$/, "")
  : "";
export const apiRoot = `${applicationBase}/api`;

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${apiRoot}${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: isFormData
      ? { ...options.headers }
      : { "Content-Type": "application/json", ...options.headers },
  });
  const rawBody = response.status === 204 ? "" : await response.text();
  let body = null;
  if (rawBody) {
    try { body = JSON.parse(rawBody); }
    catch { body = { error: rawBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 260) }; }
  }
  if (!response.ok) {
    const error = new Error(
      body?.error || `הבקשה נכשלה (HTTP ${response.status})`,
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }
  if (
    options.method &&
    options.method !== "GET" &&
    /^\/operations\/(tasks|payments)/.test(path)
  )
    window.dispatchEvent(new Event("projects:data-changed"));
  return body;
}

const nav = [
  { id: "dashboard", label: "תמונת מצב", icon: LayoutDashboard },
  { id: "my-work", label: "העבודה שלי", icon: CheckCircle2 },
  { id: "calendar", label: "לוח שנה", icon: CalendarDays },
  { id: "projects", label: "פרויקטים", icon: FolderKanban },
  { id: "clients", label: "לקוחות", icon: Users },
  { id: "professionals", label: "אנשי מקצוע", icon: Users },
  { id: "catalog", label: "מערכות ורכיבים", icon: Database },
  { id: "forms", label: "טפסים ומסמכים", icon: FormInput },
  { id: "finance", label: "תשלומים וגבייה", icon: WalletCards },
];

function StatusBadge({ stage, compact = false }) {
  const meta = stageMeta[stage] || stageMeta.waiting;
  return (
    <span
      className={`status-badge ${compact ? "compact" : ""}`}
      style={{ "--status": meta.color, "--status-soft": meta.soft }}
    >
      <i />
      {meta.label}
    </span>
  );
}

function ProjectMarker({ project, onOpen }) {
  const meta = stageMeta[project.stage] || stageMeta.waiting;
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "project-map-marker-wrap",
        html: `<div class="project-map-marker" style="--marker:${meta.color}"><span>${project.progress}%</span></div>`,
        iconSize: [48, 56],
        iconAnchor: [24, 53],
        popupAnchor: [0, -48],
      }),
    [meta.color, project.progress],
  );
  return (
    <Marker position={[project.lat, project.lng]} icon={icon}>
      <Popup className="project-popup">
        <div className="map-popup-content" dir="rtl">
          <div className="eyebrow">{project.id}</div>
          <strong>{project.name}</strong>
          <span>{project.address}</span>
          <div className="popup-progress">
            <i
              style={{ width: `${project.progress}%`, background: meta.color }}
            />
          </div>
          <button onClick={() => onOpen(project)}>
            פתח פרויקט <ArrowLeft size={14} />
          </button>
        </div>
      </Popup>
    </Marker>
  );
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [search, setSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigationSwipe=useRef(null);
  useEffect(()=>{
    const start=(event)=>{const touch=event.touches?.[0];if(touch)navigationSwipe.current={x:touch.clientX,y:touch.clientY};};
    const end=(event)=>{const startPoint=navigationSwipe.current;const touch=event.changedTouches?.[0];navigationSwipe.current=null;if(!startPoint||!touch||Math.abs(touch.clientY-startPoint.y)>70)return;const delta=touch.clientX-startPoint.x;if(delta<-85&&!sidebarOpen)setSidebarOpen(true);if(delta>85&&sidebarOpen)setSidebarOpen(false);};
    window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchend',end,{passive:true});return()=>{window.removeEventListener('touchstart',start);window.removeEventListener('touchend',end);};
  },[sidebarOpen]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [insights, setInsights] = useState(null);
  const [insightsRefreshing, setInsightsRefreshing] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const hiddenAlertSignature = useRef("");
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const messageAudioContext = useRef(null);
  const newestIncomingMessageId = useRef(null);
  const messageListInitialized = useRef(false);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [configuration, setConfiguration] = useState({
    settings: {},
    catalogs: [],
    customFields: [],
  });
  const [team, setTeam] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [equipmentCatalog, setEquipmentCatalog] = useState([]);
  const [projectTemplates, setProjectTemplates] = useState([]);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  const loadReferenceData = async () => {
    const [
      settingsResult,
      teamResult,
      clientsResult,
      professionalsResult,
      equipmentResult,
      templatesResult,
    ] = await Promise.all([
      api("/settings"),
      api("/team"),
      api("/clients"),
      api("/professionals"),
      api("/equipment-catalog"),
      api("/project-templates"),
    ]);
    setConfiguration(settingsResult);
    setTeam(teamResult.users);
    setClientOptions(clientsResult.clients);
    setProfessionals(professionalsResult.professionals);
    setEquipmentCatalog(equipmentResult.items);
    setProjectTemplates(templatesResult.templates);
    return {
      settingsResult,
      teamResult,
      clientsResult,
      professionalsResult,
      equipmentResult,
      templatesResult,
    };
  };
  const refreshCurrentUser = async (changedUser) => {
    if (changedUser && String(changedUser.id) === String(user?.id)) {
      setUser(changedUser);
    } else {
      const result = await api("/auth/me");
      setUser(result.user);
    }
    await loadReferenceData();
  };
  const loadProjects = () =>
    api("/projects").then((result) => {
      setProjects(result.projects);
      setSelectedProject((current) =>
        current
          ? result.projects.find((item) => item.id === current.id) || current
          : current,
      );
      return result.projects;
    });
  const loadTaskCount = () =>
    api("/operations/tasks/count")
      .then((result) => {
        const count = Number(result.count || 0);
        setOpenTasksCount(count);
        return count;
      });
  const playIncomingMessageSound = () => {
    if (user?.messageSoundEnabled === false) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = messageAudioContext.current || new AudioContext();
    messageAudioContext.current = context;
    if (context.state !== "running") return;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    gain.connect(context.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + 0.32 + index * 0.08);
    });
  };
  const uploadCurrentUserAvatar = async (file) => {
    if (!file) return;
    try {
      const body = new FormData();
      body.set("avatar", file);
      const result = await api("/auth/avatar", { method: "POST", body });
      setUser(result.user);
      await loadReferenceData();
      setNotice("תמונת המשתמש עודכנה בסרגל");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const loadInsights = async (force = false) => {
    setInsightsRefreshing(true);
    try {
      const result = await api(`/ai/insights${force ? "?refresh=1" : ""}`);
      setInsights(result);
      const signature = result.alerts.map((alert) => alert.key).sort().join("|");
      if (signature && signature !== hiddenAlertSignature.current) setAlertsOpen(true);
      if (!signature) hiddenAlertSignature.current = "";
      return result;
    } finally {
      setInsightsRefreshing(false);
    }
  };

  useEffect(() => {
    api("/auth/me")
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        return Promise.all([api("/projects"), loadReferenceData(), loadTaskCount()]).then(
          ([result]) => setProjects(result.projects),
        );
      })
      .catch((error) => {
        if (error.status === 401) setUser(null);
        else setStartupError(error.message || "שרת הנתונים אינו זמין");
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) return undefined;
    const refresh = () => loadProjects().catch(() => {});
    window.addEventListener("projects:data-changed", refresh);
    return () => window.removeEventListener("projects:data-changed", refresh);
  }, [user?.id]);
  useEffect(() => {
    if (!user) return undefined;
    const stream = new EventSource(`${apiRoot}/live`, {
      withCredentials: true,
    });
    let timer;
    const changed = (event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        let table = "";
        try {
          table = JSON.parse(event.data).table || "";
        } catch {}
        loadProjects().catch(() => {});
        if (!table || table === "tasks") loadTaskCount().catch(() => {});
        if (["clients", "client_contacts", "projects"].includes(table))
          loadReferenceData().catch(() => {});
        if (table === "users") refreshCurrentUser().catch(() => {});
        window.dispatchEvent(
          new CustomEvent("projects:live-change", { detail: { table } }),
        );
      }, 120);
    };
    stream.addEventListener("change", changed);
    return () => {
      clearTimeout(timer);
      stream.close();
    };
  }, [user?.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!user) return undefined;
    const unlock = () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext || user.messageSoundEnabled === false) return;
      const context = messageAudioContext.current || new AudioContext();
      messageAudioContext.current = context;
      context.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [user?.id, user?.messageSoundEnabled]);
  useEffect(() => {
    if (!user) return undefined;
    const load = () =>
      api("/messages")
        .then((result) => {
          setUnreadMessages(result.unread);
          const incoming = result.messages.find(
            (message) => String(message.recipientId) === String(user.id) && String(message.senderId) !== String(user.id),
          );
          const incomingId = incoming ? Number(incoming.id) : null;
          if (messageListInitialized.current && incomingId && incomingId > Number(newestIncomingMessageId.current || 0)) {
            playIncomingMessageSound();
          }
          newestIncomingMessageId.current = incomingId;
          messageListInitialized.current = true;
        })
        .catch(() => {});
    load();
    const live = (event) => {
      if (event.detail?.table === "user_messages") load();
    };
    window.addEventListener("projects:live-change", live);
    return () => {
      window.removeEventListener("projects:live-change", live);
      messageListInitialized.current = false;
      newestIncomingMessageId.current = null;
    };
  }, [user?.id, user?.messageSoundEnabled]);
  useEffect(() => {
    if (!user) return undefined;
    const refresh = () => loadInsights(false).catch(() => {});
    refresh();
    const timer = setInterval(refresh, 60000);
    const live = (event) => {
      if (["projects","tasks","payments"].includes(event.detail?.table)) refresh();
    };
    window.addEventListener("projects:live-change", live);
    return () => {
      clearInterval(timer);
      window.removeEventListener("projects:live-change", live);
    };
  }, [user?.id]);

  const appearanceMode = user?.appearanceTheme || "light";
  const darkMode =
    appearanceMode === "dark" ||
    (appearanceMode === "auto" && systemPrefersDark);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const syncPreference = (event) => setSystemPrefersDark(event.matches);
    media.addEventListener?.("change", syncPreference);
    return () => media.removeEventListener?.("change", syncPreference);
  }, []);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.dataset.projectsTheme = "dark";
      document.documentElement.style.colorScheme = "dark";
    } else {
      delete document.documentElement.dataset.projectsTheme;
      document.documentElement.style.removeProperty("color-scheme");
    }
    return () => {
      delete document.documentElement.dataset.projectsTheme;
      document.documentElement.style.removeProperty("color-scheme");
    };
  }, [darkMode]);

  const openProject = (project) => {
    setSelectedProject(project);
    setPage("project");
    setSidebarOpen(false);
  };
  const openMessageLink = (linkedUrl) => {
    const params = new URLSearchParams(String(linkedUrl || "").replace(/^\?/, ""));
    const projectId = params.get("project");
    const taskId = params.get("task") || "";
    if (!projectId) {
      setNotice("התיוג אינו כולל קישור לפרויקט או למשימה");
      return;
    }
    const target = projects.find((item) => String(item.id) === String(projectId));
    if (!target) {
      setNotice("הפרויקט שממנו נשלח התיוג אינו זמין יותר");
      return;
    }
    setLinkedTaskId(taskId);
    openProject(target);
    setMessagesOpen(false);
  };
  useEffect(()=>{
    if(!user||!projects.length)return;
    const params=new URLSearchParams(window.location.search);const projectId=params.get('project');const taskId=params.get('task')||'';
    if(!projectId)return;const target=projects.find(item=>String(item.id)===projectId);if(target)openProject(target);
    if(target)setLinkedTaskId(taskId);params.delete('project');params.delete('task');const query=params.toString();window.history.replaceState({},'',`${window.location.pathname}${query?`?${query}`:''}${window.location.hash}`);
  },[user?.id,projects.length]);
  const updateProject = async (id, patch) => {
    try {
      const { project } = await api(`/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setProjects((current) =>
        current.map((item) => (item.id === id ? project : item)),
      );
      setSelectedProject((current) => (current?.id === id ? project : current));
      if (patch.clientId || patch.newClient || patch.clientName !== undefined)
        await loadReferenceData();
      setNotice("השינוי נשמר בהצלחה");
      return project;
    } catch (error) {
      setNotice(error.message);
      return null;
    }
  };

  const archiveProject = async (id, archived) => {
    try {
      await api(`/projects/${encodeURIComponent(id)}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      const result = await api("/projects");
      setProjects(result.projects);
      setSelectedProject(null);
      setPage("projects");
      setNotice(
        archived
          ? "הפרויקט הועבר לארכיון"
          : "הפרויקט שוחזר לרשימת הפרויקטים הפעילים",
      );
      return true;
    } catch (error) {
      setNotice(error.message);
      return false;
    }
  };

  const createProject = async (project) => {
    try {
      const { equipmentItems = [], ...projectInput } = project;
      const result = await api("/projects", {
        method: "POST",
        body: JSON.stringify(projectInput),
      });
      await Promise.all(
        equipmentItems.map((item) =>
          api(`/projects/${result.project.id}/equipment`, {
            method: "POST",
            body: JSON.stringify({
              catalogItemId: item.id,
              quantity: item.quantity,
              status: "planned",
            }),
          }),
        ),
      );
      await loadReferenceData();
      setProjects((current) => [result.project, ...current]);
      setNewProjectOpen(false);
      setNotice("הפרויקט החדש נוצר");
      openProject(result.project);
    } catch (error) {
      setNotice(error.message);
    }
  };

  const login = async (credentials) => {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setUser(result.user);
    if (result.user.mustChangePassword) return;
    const [projectResult] = await Promise.all([
      api("/projects"),
      loadReferenceData(),
    ]);
    setProjects(projectResult.projects);
  };

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    setProjects([]);
  };

  if (loading)
    return (
      <div className="app-loader">
        <div className="brand-mark">
          <img src={projectsMark} alt="" />
        </div>
        <strong>
          <b>PRO</b>JECTS
        </strong>
        <span>טוען מערכת...</span>
      </div>
    );
  if (!user && startupError) return <StartupError message={startupError} />;
  if (!user) return <LoginPage onLogin={login} />;
  if (user.mustChangePassword) return <InitialPasswordPage onChanged={()=>window.location.reload()} />;

  const filteredProjects = projects.filter((project) => {
    const haystack =
      `${project.name} ${project.client} ${project.location} ${project.id}`.toLowerCase();
    return (
      haystack.includes(search.toLowerCase()) &&
      (stageFilter === "all" || project.stage === stageFilter)
    );
  });
  const globalQuery = search.trim().toLocaleLowerCase("he");
  const globalSearchResults = globalQuery
    ? [
        ...projects
          .filter((project) =>
            `${project.name} ${project.client} ${project.location} ${project.address} ${project.id}`
              .toLocaleLowerCase("he")
              .includes(globalQuery),
          )
          .slice(0, 5)
          .map((project) => ({
            id: `project-${project.id}`,
            type: "פרויקט",
            title: project.name,
            subtitle: `${project.id} · ${project.client || project.location || ""}`,
            icon: FolderKanban,
            project,
          })),
        ...clientOptions
          .filter((client) =>
            `${client.firstName || ""} ${client.lastName || ""} ${client.name || ""} ${client.phone || ""} ${client.mobile || ""} ${client.email || ""} ${client.address || ""}`
              .toLocaleLowerCase("he")
              .includes(globalQuery),
          )
          .slice(0, 3)
          .map((client) => ({
            id: `client-${client.id}`,
            type: "לקוח",
            title: client.name || `${client.firstName || ""} ${client.lastName || ""}`.trim(),
            subtitle: client.mobile || client.phone || client.address || "פתיחת מאגר הלקוחות",
            icon: Users,
            page: "clients",
          })),
        ...professionals
          .filter((professional) =>
            `${professional.name || ""} ${professional.role || ""} ${professional.company || ""} ${professional.phone || ""} ${professional.email || ""}`
              .toLocaleLowerCase("he")
              .includes(globalQuery),
          )
          .slice(0, 3)
          .map((professional) => ({
            id: `professional-${professional.id}`,
            type: "איש מקצוע",
            title: professional.name,
            subtitle: professional.role || professional.company || professional.phone || "פתיחת מאגר אנשי המקצוע",
            icon: UserRound,
            page: "professionals",
          })),
      ].slice(0, 8)
    : [];
  const openGlobalSearchResult = (result) => {
    if (result.project) openProject(result.project);
    else if (result.page) setPage(result.page);
    setSearch("");
    setGlobalSearchOpen(false);
  };

  const secondaryTitles = {
    "my-work": "העבודה שלי",
    control: "בקרת ביצוע",
    tasks: "משימות ואבני דרך",
    reports: "דוחות וניתוחים",
    users: "משתמשים והרשאות",
    settings: "הגדרות ומערכת",
  };
  const pageTitle =
    selectedProject && page === "project"
      ? selectedProject.name
      : secondaryTitles[page] ||
        nav.find((item) => item.id === page)?.label ||
        "תמונת מצב";
  const todayLabel = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const company = configuration.settings.company || {};
  const companyLogo = company.logo?.storedName
    ? `${apiRoot}/settings/company-logo?v=${encodeURIComponent(company.logo.updatedAt || "")}`
    : "";
  const stageOptions = configuration.catalogs.filter(
    (item) => item.category === "stage" && item.active,
  );
  const openCollectionCount = projects.filter(
    (project) => Number(project.paid) < Number(project.value),
  ).length;

  return (
    <div className={`app-shell${darkMode ? " theme-dark" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div
          className="brand"
          role="button"
          tabIndex="0"
          aria-label="סגירת תפריט הניווט"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSidebarOpen(false);
            }
          }}
        >
          <div className="brand-mark">
            <img src={projectsMark} alt="" />
          </div>
          <div>
            <strong>
              <b>PRO</b>JECTS
            </strong>
            <span>Manage Smarter. Deliver Better.</span>
          </div>
        </div>
        <div className="workspace-switch">
          <div
            className={`workspace-logo ${companyLogo ? "has-company-logo" : ""}`}
          >
            {companyLogo ? (
              <img src={companyLogo} alt="" />
            ) : (
              (company.name || "SH").slice(0, 2)
            )}
          </div>
          <div>
            <strong>{company.name || "החברה שלי"}</strong>
            <span>סביבת עבודה ראשית</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <nav className="main-nav">
          <span className="nav-label">סביבת עבודה</span>
            {nav.map(({ id, label, icon: Icon }) => {
            const badge =
              id === "projects"
                ? projects.length
                : id === "finance"
                  ? openCollectionCount
                  : null;
            return (
              <button
                key={id}
                className={
                  page === id || (page === "project" && id === "projects")
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setPage(id);
                  setSelectedProject(null);
                  setSidebarOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{label}</span>
                {badge !== null && <em>{badge}</em>}
              </button>
            );
          })}
          <span className="nav-label nav-second">ניהול</span>
          <button
            className={page === "tasks" ? "active" : ""}
            onClick={() => {
              setPage("tasks");
              setSidebarOpen(false);
            }}
          >
            <ClipboardCheck size={19} />
            <span>משימות ואבני דרך</span>
            {insights?.stats?.overdue > 0 && <em>{insights.stats.overdue}</em>}
          </button>
          <button className={page === "gantt" ? "active" : ""} onClick={()=>{setPage('gantt');setSidebarOpen(false)}}><Activity size={19}/><span>לוח גאנט</span></button>
          <button className={page === "control" ? "active" : ""} onClick={()=>{setPage('control');setSidebarOpen(false)}}><Gauge size={19}/><span>בקרת ביצוע</span></button>
          <button
            className={page === "reports" ? "active" : ""}
            onClick={() => {
              setPage("reports");
              setSidebarOpen(false);
            }}
          >
            <Activity size={19} />
            <span>דוחות וניתוחים</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button
            className={page === "settings" ? "active" : ""}
            onClick={() => {
              setPage("settings");
              setSidebarOpen(false);
            }}
          >
            <Settings size={19} />
            <span>
              {user.role === "admin" ? "הגדרות ומערכת" : "מראה והעדפות"}
            </span>
          </button>
          <div className="sidebar-version">
            <span>PROJECTS</span>
            <b>v{packageJson.version}</b>
          </div>
          <div className="user-card">
            <label
              className={`avatar user-photo-avatar ${user.avatarImage ? "has-photo" : ""}`}
              style={{ background: user.avatarColor, color: "#fff", "--avatar-color": user.avatarColor }}
              title="העלאה או החלפה של תמונת המשתמש"
            >
              {avatarGlyph(user, true)}
              <span />
              <input type="file" accept="image/*" onChange={(event) => { uploadCurrentUserAvatar(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            <div>
              <strong>{user.displayName}</strong>
              <span>{roleLabels[user.role]}</span>
            </div>
            <button className="logout-button" onClick={logout} title="יציאה">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)}>
            <Menu />
          </button>
          <div className="title-block">
            {page === "project" && (
              <button
                className="back-button"
                onClick={() => setPage("projects")}
              >
                <ChevronLeft size={19} />
              </button>
            )}
            <div>
              <span>
                {page === "project"
                  ? `${selectedProject?.id}  /  פרויקטים`
                  : todayLabel}
              </span>
              <h1>{pageTitle}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div
              className="global-search-shell"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  setGlobalSearchOpen(false);
              }}
            >
              <label className="global-search">
                <Search size={18} />
                <input
                  value={search}
                  onFocus={() => setGlobalSearchOpen(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setGlobalSearchOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && globalSearchResults[0])
                      openGlobalSearchResult(globalSearchResults[0]);
                    if (event.key === "Escape") setGlobalSearchOpen(false);
                  }}
                  placeholder="חיפוש בכל המערכת..."
                />
                <kbd>⌘ K</kbd>
              </label>
              {globalSearchOpen && globalQuery && (
                <div className="global-search-results" role="listbox">
                  {globalSearchResults.map((result) => {
                    const ResultIcon = result.icon;
                    return (
                      <button key={result.id} type="button" onClick={() => openGlobalSearchResult(result)}>
                        <span><ResultIcon size={17} /></span>
                        <div><strong>{result.title}</strong><small>{result.subtitle}</small></div>
                        <em>{result.type}</em>
                      </button>
                    );
                  })}
                  {!globalSearchResults.length && <p>לא נמצאו תוצאות מתאימות</p>}
                </div>
              )}
            </div>
            <button
              className="icon-button"
              onClick={() => setAlertsOpen(true)}
              title="התראות"
            >
              <Bell size={20} />
              {insights?.alerts?.length > 0 && <i />}
            </button>
            <button
              className="icon-button task-shortcut-button"
              onClick={() => { setSelectedProject(null); setPage("tasks"); }}
              title="משימות פתוחות"
              aria-label={`${openTasksCount} משימות פתוחות`}
            >
              <ClipboardCheck size={20} />
              <em>{openTasksCount > 99 ? "99+" : openTasksCount}</em>
            </button>
            <button className="icon-button ai-chat-button" onClick={() => setAiChatOpen(true)} title="הסוכן החכם">
              <Sparkles size={20} />
            </button>
            <button
              className="icon-button message-button"
              onClick={() => setMessagesOpen(true)}
              title="הודעות צוות"
            >
              <MessageSquare size={20} />
              {unreadMessages > 0 && <em>{unreadMessages}</em>}
            </button>
            {["admin", "manager"].includes(user.role) && (
              <button
                className="primary-button"
                onClick={() => setNewProjectOpen(true)}
              >
                <Plus size={18} />
                פרויקט חדש
              </button>
            )}
          </div>
        </header>

        <WorkspaceErrorBoundary key={`${page}:${selectedProject?.id || ""}`} page={page}>
        <div className="page-content">
          {page === "dashboard" && (
            <Dashboard
              projects={projects}
              openProject={openProject}
              setPage={setPage}
              insights={insights}
              insightsRefreshing={insightsRefreshing}
              onRefreshInsights={() => loadInsights(true).catch((error) => setNotice(error.message))}
              user={user}
            />
          )}
          {page === "calendar" && (
            <CalendarWorkspace
              api={api}
              apiRoot={apiRoot}
              user={user}
              setNotice={setNotice}
            />
          )}
          {page === "my-work" && (
            <MyWorkWorkspace api={api} user={user} projects={projects} professionals={professionals} setNotice={setNotice} openProject={openProject}/>
          )}
          {page === "projects" && (
            <ProjectsPage
              projects={filteredProjects}
              search={search}
              setSearch={setSearch}
              stageFilter={stageFilter}
              setStageFilter={setStageFilter}
              openProject={openProject}
              api={api}
              user={user}
              setNotice={setNotice}
            />
          )}
          {page === "clients" && (
            <ClientsWorkspace
              api={api}
              apiRoot={apiRoot}
              user={user}
              setNotice={setNotice}
              onDataChanged={loadReferenceData}
            />
          )}
          {["professionals", "catalog"].includes(page) && (
            <MasterDataWorkspace
              api={api}
              apiRoot={apiRoot}
              user={user}
              users={team}
              clients={clientOptions}
              projects={projects}
              setNotice={setNotice}
              onDataChanged={loadReferenceData}
              initialTab={page === "catalog" ? "equipment" : "professionals"}
            />
          )}
          {page === "forms" && (
            <FormsWorkspace
              api={api}
              apiRoot={apiRoot}
              user={user}
              setNotice={setNotice}
            />
          )}
          {page === "finance" && (
            <FinanceWorkspace
              api={api}
              user={user}
              projects={projects}
              setNotice={setNotice}
              openProject={openProject}
            />
          )}
          {page === "tasks" && (
            <TasksWorkspace
              api={api}
              user={user}
              projects={projects}
              professionals={professionals}
              setNotice={setNotice}
            />
          )}
          {page==='gantt'&&<GanttWorkspace api={api} setNotice={setNotice} user={user} projects={projects} professionals={professionals}/>}
          {page==='control'&&<PortfolioControlWorkspace api={api} setNotice={setNotice} openProject={openProject} projects={projects}/>}
          {page === "reports" && (
            <ReportsWorkspace api={api} setNotice={setNotice} company={company} companyLogo={companyLogo} user={user} />
          )}
          {page === "settings" && (
            <OperationalSettings
              api={api}
              apiRoot={apiRoot}
              user={user}
              setNotice={setNotice}
              onUserChanged={setUser}
              onConfigurationChanged={setConfiguration}
              usersPanel={user.role === "admin" ? <UsersPage setNotice={setNotice} currentUser={user} onChanged={refreshCurrentUser} /> : null}
            />
          )}
          {page === "project" && selectedProject && (
            <ProjectWorkspace
              project={
                projects.find((p) => p.id === selectedProject.id) ||
                selectedProject
              }
              updateProject={updateProject}
              archiveProject={archiveProject}
              api={api}
              apiRoot={apiRoot}
              user={user}
              projects={projects}
              clients={clientOptions}
              professionals={professionals}
              stageOptions={stageOptions}
              setNotice={setNotice}
              setPage={setPage}
              linkedTaskId={linkedTaskId}
              onLinkedTaskHandled={() => setLinkedTaskId("")}
            />
          )}
        </div>
        </WorkspaceErrorBoundary>
      </main>
      {newProjectOpen && (
        <NewProjectModal
          api={api}
          onClose={() => setNewProjectOpen(false)}
          onCreate={createProject}
          professionals={professionals}
          clients={clientOptions}
          stageOptions={stageOptions}
          equipment={equipmentCatalog}
          templates={projectTemplates}
        />
      )}
      {alertsOpen && insights?.alerts?.length > 0 && (
        <AlertCenter
          alerts={insights.alerts}
          api={api}
          setNotice={setNotice}
          onClose={() => {
            hiddenAlertSignature.current = insights.alerts
              .map((alert) => alert.key)
              .sort()
              .join("|");
            setAlertsOpen(false);
          }}
          onOpenTask={(alert) => {
            const project = projects.find((item) => item.id === alert.projectId);
            if (project) openProject(project);
            else {
              setPage("tasks");
              setSidebarOpen(false);
            }
            setAlertsOpen(false);
          }}
          onSnoozed={async () => {
            setAlertsOpen(false);
            setInsights((current) => ({ ...current, alerts: [] }));
            await loadInsights(true);
          }}
        />
      )}
      {messagesOpen && (
        <MessageCenter
          api={api}
          apiRoot={apiRoot}
          user={user}
          users={team}
          onClose={() => setMessagesOpen(false)}
          setNotice={setNotice}
          onUnread={setUnreadMessages}
          onOpenLinked={openMessageLink}
        />
      )}
      {aiChatOpen && <AiChatBoundary onClose={() => setAiChatOpen(false)}><AiChat apiRoot={apiRoot} onClose={() => setAiChatOpen(false)} /></AiChatBoundary>}
      {notice && (
        <div className="toast">
          <CheckCircle2 size={19} />
          {notice}
        </div>
      )}
    </div>
  );
}

const roleLabels = {
  admin: "מנהל מערכת",
  manager: "מנהל פרויקט",
  technician: "טכנאי",
  finance: "כספים",
  viewer: "צופה",
};
const avatarIcons = {
  user: "אדם",
  wrench: "כלי עבודה",
  hardhat: "קסדה",
  lightning: "חשמל",
  shield: "מגן",
  star: "כוכב",
};
function avatarGlyph(user, currentUser = false) {
  if (currentUser) {
    const names = String(user.displayName || "משתמש").trim().split(/\s+/);
    const initials = `${names[0]?.[0] || "מ"}${names.length > 1 ? names.at(-1)?.[0] || "" : names[0]?.[1] || ""}`;
    return <><b className="avatar-initials">{initials}</b><img className="current-user-avatar-image" src={`${apiRoot}/auth/avatar?v=${encodeURIComponent(user.avatarImage || user.id || "current")}`} alt="" onLoad={(event)=>event.currentTarget.classList.add("loaded")} onError={(event)=>event.currentTarget.classList.remove("loaded")}/></>;
  }
  if (user.avatarImage) return <img src={`${apiRoot}/users/${user.id}/avatar?v=${encodeURIComponent(user.avatarImage)}`} alt="" />;
  if (!user.avatarIcon || user.avatarIcon === "user") {
    const names = String(user.displayName || "משתמש").trim().split(/\s+/);
    return `${names[0]?.[0] || "מ"}${names.length > 1 ? names.at(-1)?.[0] || "" : names[0]?.[1] || ""}`;
  }
  return (
    { wrench: "🔧", hardhat: "⛑", lightning: "ϟ", shield: "◆", star: "★" }[
      user.avatarIcon
    ] || user.displayName.slice(0, 2)
  );
}

function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onLogin(form);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="login-shell" dir="rtl">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            <img src={projectsMark} alt="" />
          </div>
          <strong>
            <b>PRO</b>JECTS
          </strong>
          <small>Manage Smarter. Deliver Better.</small>
        </div>
        <div className="login-copy">
          <span>כניסה מאובטחת</span>
          <h1>ברוכים הבאים</h1>
          <p>התחברו למרחב ניהול הפרויקטים שלכם</p>
        </div>
        <form onSubmit={submit}>
          <label>
            שם משתמש
            <input
              autoFocus
              autoComplete="username"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            סיסמה
            <input
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button className="primary-button" disabled={submitting}>
            {submitting ? "מתחבר..." : "כניסה למערכת"} <ArrowLeft size={17} />
          </button>
        </form>
        <small className="login-hint">
          בכניסה דרך Home Assistant הזיהוי מתבצע אוטומטית.
        </small>
      </div>
    </div>
  );
}

function InitialPasswordPage({onChanged}) {
  const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
  const [error,setError]=useState(''); const [submitting,setSubmitting]=useState(false);
  const submit=async(event)=>{event.preventDefault();setError('');if(!passwordsMatch(form.newPassword,form.confirmPassword))return setError('הסיסמאות אינן תואמות');setSubmitting(true);try{const result=await api('/auth/password',{method:'POST',body:JSON.stringify(form)});onChanged(result.user)}catch(changeError){setError(changeError.message)}finally{setSubmitting(false)}};
  return <div className="login-shell" dir="rtl"><div className="login-card"><div className="login-brand"><div className="brand-mark"><img src={projectsMark} alt=""/></div><strong><b>PRO</b>JECTS</strong></div><div className="login-copy"><span>אבטחת החשבון</span><h1>החלפת סיסמה ראשונית</h1><p>לפני תחילת העבודה יש לבחור סיסמה אישית וחזקה.</p></div><form onSubmit={submit}><label>סיסמה נוכחית<input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={event=>setForm({...form,currentPassword:event.target.value})}/></label><label>סיסמה חדשה<input type="password" autoComplete="new-password" minLength="12" required value={form.newPassword} onChange={event=>setForm({...form,newPassword:event.target.value})}/></label><label>אימות סיסמה<input type="password" autoComplete="new-password" minLength="12" required value={form.confirmPassword} onChange={event=>setForm({...form,confirmPassword:event.target.value})}/></label><small>לפחות 12 תווים, אות גדולה, אות קטנה ומספר.</small>{error&&<div className="login-error">{error}</div>}<button className="primary-button" disabled={submitting}>{submitting?'שומר...':'שמירת סיסמה'} <ArrowLeft size={17}/></button></form></div></div>;
}

function UsersPage({ setNotice, currentUser, onChanged }) {
  const [users, setUsers] = useState([]);
  const [identityLink, setIdentityLink] = useState({ primaryUserId:"", secondaryUserId:"" });
  const [linkingIdentity,setLinkingIdentity]=useState(false);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "viewer",
    avatarColor: "#6957df",
    avatarIcon: "user",
  });
  const loadUsers = () =>
    api("/users")
      .then((result) => setUsers(result.users))
      .catch((error) => setNotice(error.message));
  useEffect(() => {
    loadUsers();
    const timer = setInterval(loadUsers, 30000);
    return () => clearInterval(timer);
  }, []);
  const createUser = async (event) => {
    event.preventDefault();
    try {
      await api("/users", { method: "POST", body: JSON.stringify(form) });
      setForm({
        username: "",
        displayName: "",
        password: "",
        role: "viewer",
        avatarColor: "#6957df",
        avatarIcon: "user",
      });
      setNotice("המשתמש נוצר");
      loadUsers();
      onChanged?.();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const updateUser = async (id, patch) => {
    try {
      const result = await api(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      loadUsers();
      onChanged?.(result.user);
      setNotice("ההרשאה עודכנה");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const uploadAvatar = async (id, file) => {
    if (!file) return;
    try {
      const body = new FormData();
      body.set("avatar", file);
      const result = await api(`/users/${id}/avatar`, { method: "POST", body });
      loadUsers();
      onChanged?.(result.user);
      setNotice("תמונת המשתמש עודכנה");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const removeAvatar = async (id) => {
    try {
      await api(`/users/${id}/avatar`, { method: "DELETE" });
      loadUsers();
      onChanged?.();
      setNotice("תמונת המשתמש הוסרה");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const deleteUser = async (item) => {
    if (!window.confirm(`למחוק את המשתמש „${item.displayName}”?`)) return;
    try {
      await api(`/users/${item.id}`, { method: "DELETE" });
      loadUsers();
      onChanged?.();
      setNotice("המשתמש נמחק");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const mergeIdentities = async (event) => {
    event.preventDefault();
    if (!identityLink.primaryUserId || !identityLink.secondaryUserId || identityLink.primaryUserId === identityLink.secondaryUserId) return setNotice("יש לבחור שתי זהויות שונות");
    const primary = users.find((item)=>String(item.id)===String(identityLink.primaryUserId));
    const secondary = users.find((item)=>String(item.id)===String(identityLink.secondaryUserId));
    if (!window.confirm(`לאחד את “${secondary?.displayName}” אל הזהות הראשית “${primary?.displayName}”? מעכשיו תוצג זהות אחת וניתן יהיה להיכנס אליה גם דרך Web וגם דרך Home Assistant.`)) return;
    setLinkingIdentity(true);
    try {
      await api('/users/merge-identities',{ method:'POST',body:JSON.stringify(identityLink) });
      setIdentityLink({ primaryUserId:"",secondaryUserId:"" });
      await loadUsers();
      onChanged?.();
      setNotice("הזהויות אוחדו בהצלחה לחשבון אחד");
    } catch (error) { setNotice(error.message); } finally { setLinkingIdentity(false); }
  };
  return (
    <div className="section-page users-page">
      <div className="page-intro">
        <div>
          <h2>משתמשים והרשאות כניסה</h2>
          <p>
            כאן מנהלים גישה לתוכנה בלבד. תפקיד מקצועי ושיוך לפרויקט מנוהלים
            במאגר אנשי המקצוע.
          </p>
        </div>
        <span className="security-pill">
          <ShieldCheck size={17} />
          {users.length} משתמשים
        </span>
      </div>
      <div className="users-layout">
        <div className="panel users-list">
          <div className="panel-head">
            <div>
              <h3>חשבונות מערכת</h3>
              <span>
                אפשר לערוך, להשבית או למחוק; לא ניתן למחוק את המשתמש המחובר.
              </span>
            </div>
          </div>
          {users.map((item) => (
            <div className="user-row visual-user-row" key={item.id}>
              <div
                className={`avatar user-photo-avatar ${item.avatarImage ? "has-photo" : ""}`}
                style={{ background: item.avatarColor, color: "#fff", "--avatar-color": item.avatarColor }}
              >
                {avatarGlyph(item)}
              </div>
              <div>
                <strong>{item.displayName}</strong>
                <span>
                  {item.identityTypes?.includes('web') ? `Web: ${item.username}` : "ללא כניסת Web"}{" "}
                  {item.identityTypes?.includes('ingress') && "· Home Assistant Ingress"}
                </span>
                <small className={item.online?"user-online":"user-offline"}>{item.online?"מחובר כעת":item.lastSeenAt?`נראה לאחרונה ${new Date(item.lastSeenAt).toLocaleString("he-IL")}`:"טרם התחבר"}</small>
                <small className="user-last-login">התחברות אחרונה: {item.lastLoginAt?new Date(item.lastLoginAt).toLocaleString("he-IL"):"טרם התחבר"}</small>
              </div>
              <select
                value={item.role}
                onChange={(e) => updateUser(item.id, { role: e.target.value })}
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="user-appearance">
                <input
                  aria-label="צבע משתמש"
                  type="color"
                  value={item.avatarColor}
                  onChange={(e) =>
                    updateUser(item.id, { avatarColor: e.target.value })
                  }
                />
                <select
                  aria-label="אייקון משתמש"
                  value={item.avatarIcon}
                  onChange={(e) =>
                    updateUser(item.id, { avatarIcon: e.target.value })
                  }
                >
                  {Object.entries(avatarIcons).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label className="user-photo-upload" title="העלאת תמונת משתמש">
                  <input type="file" accept="image/*" onChange={(event) => { uploadAvatar(item.id, event.target.files?.[0]); event.target.value = ""; }} />
                  תמונה
                </label>
                {item.avatarImage && <button type="button" className="user-photo-remove" onClick={() => removeAvatar(item.id)}>הסרה</button>}
              </div>
              <label className="active-toggle">
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={(e) =>
                    updateUser(item.id, { active: e.target.checked })
                  }
                />
                <span />
              </label>
              <button
                className="user-delete"
                disabled={String(item.id) === String(currentUser.id)}
                onClick={() => deleteUser(item)}
                title="מחיקת משתמש"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <form className="panel create-user" onSubmit={createUser}>
          <div className="panel-head">
            <div>
              <h3>חשבון כניסה חדש</h3>
              <span>לאחר היצירה אפשר לקשר אותו לאדם במאגר אנשי המקצוע</span>
            </div>
          </div>
          <label>
            שם תצוגה
            <input
              required
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
            />
          </label>
          <label>
            שם משתמש
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            סיסמה
            <input
              type="password"
              minLength="8"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            הרשאת מערכת
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="new-user-appearance">
            <label>
              צבע
              <input
                type="color"
                value={form.avatarColor}
                onChange={(e) =>
                  setForm({ ...form, avatarColor: e.target.value })
                }
              />
            </label>
            <label>
              אייקון
              <select
                value={form.avatarIcon}
                onChange={(e) =>
                  setForm({ ...form, avatarIcon: e.target.value })
                }
              >
                {Object.entries(avatarIcons).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="primary-button">
            <Plus size={17} />
            יצירת חשבון
          </button>
        </form>
      </div>
      {users.length > 1 && <form className="panel identity-linker" onSubmit={mergeIdentities}>
        <div className="identity-linker-copy"><span><Link2 size={19}/></span><div><h3>איחוד זהויות Web ו־Home Assistant</h3><p>בחרו את החשבון שיישאר מוצג, ואת החשבון הכפול שיוטמע בו. ההרשאות, המראה והשם של הזהות הראשית נשמרים.</p></div></div>
        <label>הזהות הראשית שתוצג<select value={identityLink.primaryUserId} onChange={(event)=>setIdentityLink({...identityLink,primaryUserId:event.target.value})}><option value="">בחירת חשבון ראשי</option>{users.map((item)=><option key={item.id} value={item.id}>{item.displayName} · {item.identityTypes?.join(' + ')||'חשבון'}</option>)}</select></label>
        <span className="identity-link-arrow">←</span>
        <label>הזהות הכפולה לאיחוד<select value={identityLink.secondaryUserId} onChange={(event)=>setIdentityLink({...identityLink,secondaryUserId:event.target.value})}><option value="">בחירת חשבון כפול</option>{users.filter((item)=>String(item.id)!==String(identityLink.primaryUserId)&&String(item.id)!==String(currentUser.id)).map((item)=><option key={item.id} value={item.id}>{item.displayName} · {item.identityTypes?.join(' + ')||'חשבון'}</option>)}</select></label>
        <button className="primary-button" disabled={linkingIdentity||!identityLink.primaryUserId||!identityLink.secondaryUserId}>{linkingIdentity?'מאחד זהויות...':'איחוד לחשבון אחד'}</button>
      </form>}
    </div>
  );
}

function StartupError({ message }) {
  return (
    <div className="startup-error" dir="rtl">
      <div className="brand-mark">
        <img src={projectsMark} alt="" />
      </div>
      <span>
        <AlertTriangle size={25} />
      </span>
      <h1>לא ניתן לטעון את שרת הנתונים</h1>
      <p>אין צורך בשם משתמש או בסיסמה כאשר נכנסים דרך Home Assistant.</p>
      <code>
        {message} · API: {apiRoot}
      </code>
      <button
        className="primary-button"
        onClick={() => window.location.reload()}
      >
        <RotateCcw size={17} />
        ניסיון חוזר
      </button>
      <small>
        אם התקלה חוזרת, העתיקו את יומן ה־App ממסך PROJECTS ב־Home Assistant.
      </small>
    </div>
  );
}

function SystemPage({ setNotice }) {
  const [backups, setBackups] = useState([]);
  const [busy, setBusy] = useState(false);
  const loadBackups = () =>
    api("/system/backups")
      .then((result) => setBackups(result.backups))
      .catch((error) => setNotice(error.message));
  useEffect(loadBackups, []);
  const createBackup = async () => {
    setBusy(true);
    try {
      await api("/system/backups", { method: "POST" });
      setNotice("הגיבוי הושלם");
      loadBackups();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };
  const restore = async (name) => {
    if (
      !window.confirm(
        `לשחזר את ${name}? המערכת תופעל מחדש וכל הנתונים הנוכחיים יוחלפו.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api("/system/restore", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNotice("השחזור החל; המערכת תעלה מחדש בעוד רגע");
    } catch (error) {
      setNotice(error.message);
      setBusy(false);
    }
  };
  return (
    <div className="section-page system-page">
      <div className="page-intro">
        <div>
          <h2>גיבוי, שחזור ובריאות מערכת</h2>
          <p>
            גיבויי PostgreSQL נשמרים בתוך נתוני ה־Add-on ונכללים גם בגיבוי Home
            Assistant
          </p>
        </div>
        <button
          className="primary-button"
          disabled={busy}
          onClick={createBackup}
        >
          <Database size={17} />
          {busy ? "מבצע..." : "יצירת גיבוי"}
        </button>
      </div>
      <div className="panel backup-list">
        <div className="panel-head">
          <div>
            <h3>גיבויים זמינים</h3>
            <span>שחזור מפעיל מחדש את שירות ה־API באופן מבוקר</span>
          </div>
          <span className="health-online">
            <i />
            PostgreSQL מחובר
          </span>
        </div>
        {backups.length === 0 && (
          <div className="empty-backups">עדיין לא נוצרו גיבויים ידניים.</div>
        )}
        {backups.map((backup) => (
          <div className="backup-row" key={backup.name}>
            <div className="doc-icon">
              <Database size={18} />
            </div>
            <div>
              <strong>{backup.name}</strong>
              <span>
                {new Date(backup.createdAt).toLocaleString("he-IL")} ·{" "}
                {(backup.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => restore(backup.name)}
            >
              <RotateCcw size={15} />
              שחזור
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ projects, openProject, setPage, insights, insightsRefreshing, onRefreshInsights, user }) {
  const active = projects.filter((p) => p.stage !== "completed");
  const value = active.reduce((sum, p) => sum + p.value, 0);
  const unpaid = active.reduce((sum, p) => sum + (p.value - p.paid), 0);
  const avg = active.length
    ? Math.round(active.reduce((sum, p) => sum + p.progress, 0) / active.length)
    : 0;
  const stageData = Object.entries(stageMeta)
    .map(([key, value]) => ({
      name: value.label,
      value: projects.filter((p) => p.stage === key).length,
      color: value.color,
    }))
    .filter((x) => x.value);
  const cashData = projects
    .slice(0, 6)
    .map((project) => ({
      month: project.id.replace("PRJ-", ""),
      paid: Math.round(project.paid / 1000),
      expected: Math.round(project.value / 1000),
    }));
  const upcomingMilestones = projects
    .filter((project) => project.stage !== "completed")
    .slice(0, 4);
  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <h2>
            שלום, {user.displayName} <span>👋</span>
          </h2>
          <p>הנה תמונת המצב התפעולית המעודכנת.</p>
        </div>
        <div className="welcome-actions">
          <button
            className={`dashboard-task-button ${insights?.stats?.overdue > 0 ? "urgent" : ""}`}
            onClick={() => setPage("tasks")}
          >
            <ClipboardCheck size={18} />
            <span>משימות</span>
            <b>{insights?.stats?.open || 0}</b>
          </button>
          <div className="live-pill">
            <i />
            הנתונים מעודכנים עכשיו
          </div>
        </div>
      </section>
      <section className="kpi-grid">
        <KpiCard
          icon={FolderKanban}
          tone="purple"
          label="פרויקטים פעילים"
          value={active.length}
          change={`${projects.length - active.length} פרויקטים הושלמו`}
          onClick={() => setPage("projects")}
        />
        <KpiCard
          icon={TrendingUp}
          tone="blue"
          label="היקף פרויקטים פעילים"
          value={compactMoney(value)}
          change="לפי שווי החוזים המעודכן"
          onClick={() => setPage("projects")}
        />
        <KpiCard
          icon={Gauge}
          tone="green"
          label="התקדמות ממוצעת"
          value={`${avg}%`}
          change={`ממוצע של ${active.length} פרויקטים פעילים`}
          onClick={() => setPage("projects")}
        />
        <KpiCard
          icon={CircleDollarSign}
          tone="orange"
          label="יתרה פתוחה לגבייה"
          value={compactMoney(unpaid)}
          change={`${active.filter((p) => Number(p.paid) < Number(p.value)).length} פרויקטים עם יתרה`}
          alert
          onClick={() => setPage("finance")}
        />
      </section>
      <InsightsTile insights={insights} onNavigate={setPage} refreshing={insightsRefreshing} onRefresh={onRefreshInsights} />
      <section className="dashboard-grid top">
        <div className="panel portfolio-panel">
          <PanelHead
            title="פרויקטים שדורשים תשומת לב"
            subtitle="לפי סיכון, חריגה ותשלומים"
            action="לכל הפרויקטים"
            onAction={() => setPage("projects")}
          />
          <div className="attention-list">
            {projects
              .filter((p) => p.flag)
              .slice(0, 4)
              .map((project) => (
                <button
                  key={project.id}
                  className="attention-item"
                  onClick={() => openProject(project)}
                >
                  <div
                    className={`risk-indicator ${project.health < 65 ? "danger" : "warning"}`}
                  >
                    <Flag size={16} />
                  </div>
                  <div className="attention-main">
                    <div>
                      <strong>{project.name}</strong>
                      <span>
                        {project.id} · {project.location}
                      </span>
                    </div>
                    <span className="flag-label">
                      <AlertTriangle size={14} />
                      {project.flag}
                    </span>
                  </div>
                  <div className="attention-progress">
                    <b>{project.progress}%</b>
                    <div>
                      <i
                        style={{
                          width: `${project.progress}%`,
                          background: stageMeta[project.stage].color,
                        }}
                      />
                    </div>
                  </div>
                  <StatusBadge stage={project.stage} compact />
                  <ChevronLeft size={18} />
                </button>
              ))}
            {!projects.some((p) => p.flag) && (
              <div className="inline-empty">
                אין כרגע פרויקטים מסומנים לטיפול.
              </div>
            )}
          </div>
        </div>
        <div className="panel stage-panel">
          <PanelHead title="התפלגות לפי שלב" subtitle="כלל הפרויקטים" />
          <div className="stage-chart-wrap">
            <ResponsiveContainer width="54%" height={210}>
              <PieChart>
                <Pie
                  data={stageData}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={4}
                  stroke="none"
                >
                  {stageData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>{projects.length}</strong>
              <span>פרויקטים</span>
            </div>
            <div className="chart-legend">
              {stageData.map((item) => (
                <div key={item.name}>
                  <i style={{ background: item.color }} />
                  <span>{item.name}</span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="dashboard-grid bottom">
        <div className="panel cash-panel">
          <PanelHead
            title="גבייה לפי פרויקט"
            subtitle="חוזה מול תשלומים שהתקבלו · באלפי ₪"
            action={`${cashData.length} פרויקטים`}
            onAction={() => setPage("finance")}
          />
          <div className="cash-legend" aria-label="מקרא גרף הגבייה">
            <span>
              <i className="paid" />
              התקבל
            </span>
            <span>
              <i className="expected" />
              צפי
            </span>
          </div>
          <ResponsiveContainer width="100%" height={235}>
            <BarChart data={cashData} barGap={5}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#edf0f6"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8b93a7", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#a1a8b7", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "#f7f8fb" }}
                formatter={(chartValue, name) => [
                  `${chartValue} אלפי ₪`,
                  name === "paid" ? "התקבל" : "היקף חוזה",
                ]}
                labelFormatter={(label) => `פרויקט PRJ-${label}`}
                contentStyle={{ direction: "rtl", textAlign: "right" }}
              />
              <Bar dataKey="expected" fill="#e8ebf3" radius={[5, 5, 0, 0]} />
              <Bar dataKey="paid" fill="#6d5de8" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel milestones-panel">
          <PanelHead
            title="אבני דרך קרובות"
            subtitle="היעדים הבאים בפרויקטים הפעילים"
            action="ללוח השנה"
            onAction={() => setPage("calendar")}
          />
          <div className="milestone-list">
            {upcomingMilestones.map((item, index) => {
              const dueParts = String(item.due || "").split(".");
              return (
                <div className="milestone-item" key={item.id}>
                  <div
                    className={`date-tile ${item.health < 70 ? "risk" : index === 0 ? "today" : "soon"}`}
                  >
                    <b>{dueParts[0] || "—"}</b>
                    <span>{dueParts[1] || ""}</span>
                  </div>
                  <div>
                    <strong>
                      {item.nextMilestone || "טרם הוגדרה אבן דרך"}
                    </strong>
                    <span>{item.name}</span>
                  </div>
                  {item.health < 70 && <em>בסיכון</em>}
                  <MoreHorizontal size={18} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel activity-panel">
          <PanelHead
            title="פעילות אחרונה"
            action="Audit Log"
            onAction={() =>
              setPage(user.role === "admin" ? "settings" : "tasks")
            }
          />
          <div className="activity-list">
            {(insights?.recentActivities || []).map((item) => (
              <div className="activity-item" key={item.id}>
                <div className="mini-avatar">
                  {(item.userName || "מערכת").slice(0, 2)}
                </div>
                <div>
                  <p>
                    {item.userName || "מערכת"} ·{" "}
                    {actionNamesForDashboard[item.action] || item.action}
                  </p>
                  <strong>
                    {item.entityType} {item.entityId || ""}
                  </strong>
                  <span>
                    {new Date(item.createdAt).toLocaleString("he-IL")}
                  </span>
                </div>
              </div>
            ))}
            {!(insights?.recentActivities || []).length && (
              <div className="inline-empty">אין פעילות חדשה להצגה.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ icon: Icon, tone, label, value, change, trend, alert, onClick }) {
  return (
    <div className={`kpi-card ${onClick?'clickable':''}`} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} onClick={onClick} onKeyDown={event=>{if(onClick&&(event.key==='Enter'||event.key===' '))onClick()}}>
      <div className={`kpi-icon ${tone}`}>
        <Icon size={22} />
      </div>
      <div className="kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={alert ? "alert" : ""}>
          {trend && <TrendingUp size={13} />}
          {alert && <AlertTriangle size={13} />}
          {change}
        </small>
      </div>
      <MoreHorizontal size={19} className="kpi-more" />
    </div>
  );
}

function PanelHead({ title, subtitle, action, onAction }) {
  return (
    <div className="panel-head">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction}>
          {action}
          <ChevronLeft size={15} />
        </button>
      )}
    </div>
  );
}

function ProjectsPage({
  projects,
  search,
  setSearch,
  stageFilter,
  setStageFilter,
  openProject,
  api,
  user,
  setNotice,
}) {
  const [view, setView] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForm, setDeleteForm] = useState({ confirmation: "", password: "" });
  const [deleting, setDeleting] = useState(false);
  const [manager, setManager] = useState("");
  const [priority, setPriority] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [projectSort, setProjectSort] = useState({ key:"name", direction:"asc" });
  const switchArchive = async (archived) => {
    setShowArchived(archived);
    setStageFilter("all");
    if (!archived) return;
    setArchiveLoading(true);
    try {
      const result = await api("/projects?scope=archived");
      setArchivedProjects(result.projects);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setArchiveLoading(false);
    }
  };
  const beginPermanentDelete = (project) => {
    if (!window.confirm(`זהו אישור ראשון למחיקה לצמיתות של "${project.name}". להמשיך?`)) return;
    setDeleteForm({ confirmation: "", password: "" });
    setDeleteTarget(project);
  };
  const permanentDelete = async (event) => {
    event.preventDefault();
    if (!deleteTarget || deleteForm.confirmation.trim().toUpperCase() !== deleteTarget.serialCode.toUpperCase()) return;
    setDeleting(true);
    try {
      await api(`/projects/${encodeURIComponent(deleteTarget.id)}/permanent`, {
        method: "DELETE",
        body: JSON.stringify(deleteForm),
      });
      setArchivedProjects((items) => items.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice("הפרויקט וכל הנתונים המשויכים אליו נמחקו לצמיתות");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setDeleting(false);
    }
  };
  const sourceProjects = showArchived
    ? archivedProjects.filter(
        (project) =>
          `${project.name} ${project.client} ${project.location} ${project.id}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (stageFilter === "all" || project.stage === stageFilter),
      )
    : projects;
  const filteredProjects = sourceProjects.filter(
    (project) =>
      (!manager || project.manager === manager) &&
      (!priority || project.priority === priority) &&
      (!flagged || project.flag),
  );
  const visibleProjects = useMemo(() => {
    const stageOrder=Object.keys(stageMeta);
    const value=(project,key)=>key==="name"?(project.name||""):key==="stage"?stageOrder.indexOf(project.stage):key==="progress"?Number(project.progress||0):key==="manager"?(project.manager||""):key==="milestone"?new Date(project.due||"9999-12-31").getTime():key==="balance"?Number(project.value||0)-Number(project.paid||0):"";
    const direction=projectSort.direction==="asc"?1:-1;
    return [...filteredProjects].sort((a,b)=>{const left=value(a,projectSort.key),right=value(b,projectSort.key);return (typeof left==="string"?left.localeCompare(right,"he"):(left-right))*direction;});
  },[filteredProjects,projectSort]);
  const toggleProjectSort=(key)=>setProjectSort(current=>({key,direction:current.key===key&&current.direction==="asc"?"desc":"asc"}));
  const managers = [
    ...new Set(
      sourceProjects.map((project) => project.manager).filter(Boolean),
    ),
  ];
  return (
    <div className="section-page">
      <div className="page-intro">
        <div>
          <h2>{showArchived ? "ארכיון פרויקטים" : "כל הפרויקטים"}</h2>
          <p>
            {showArchived
              ? "פרויקטים שהסתיימו נשמרים כאן וניתנים לשחזור מלא"
              : `ניהול, מעקב ובקרה של ${visibleProjects.length} פרויקטים בתצוגה הנוכחית`}
          </p>
        </div>
        <div className="project-page-actions">
          <div className="archive-switch">
            <button
              className={!showArchived ? "active" : ""}
              onClick={() => switchArchive(false)}
            >
              פעילים
            </button>
            <button
              className={showArchived ? "active" : ""}
              onClick={() => switchArchive(true)}
            >
              <Archive size={16} />
              ארכיון
            </button>
          </div>
          <div className="view-switch">
            <button
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
            >
              <ListFilter size={17} />
              טבלה
            </button>
            <button
              className={view === "board" ? "active" : ""}
              onClick={() => setView("board")}
            >
              <FolderKanban size={17} />
              לוח
            </button>
            <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
              <Map size={17} />
              מפה
            </button>
          </div>
        </div>
      </div>
      <div className="toolbar panel projects-filter-toolbar">
        <label className="table-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש פרויקט, לקוח או מזהה..."
          />
        </label>
        <label
          className="stage-filter-select"
          style={{
            "--stage-color":
              stageFilter === "all"
                ? "#6957df"
                : stageMeta[stageFilter]?.color || "#6957df",
          }}
        >
          <span>
            <i />
            שלב
          </span>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            <option value="all">כל השלבים · {sourceProjects.length}</option>
            {Object.entries(stageMeta).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label} ·{" "}
                {
                  sourceProjects.filter((project) => project.stage === key)
                    .length
                }
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>
        <button
          className={`filter-button ${filtersOpen ? "active" : ""}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={17} />
          מסננים
        </button>
      </div>
      {filtersOpen && (
        <div className="advanced-project-filters panel">
          <label>
            מנהל פרויקט
            <select
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">כולם</option>
              {managers.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            עדיפות
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">הכול</option>
              <option value="low">נמוכה</option>
              <option value="normal">רגילה</option>
              <option value="high">גבוהה</option>
              <option value="urgent">דחופה</option>
            </select>
          </label>
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setFlagged(e.target.checked)}
            />
            פרויקטים מסומנים בלבד
          </label>
          <button
            onClick={() => {
              setManager("");
              setPriority("");
              setFlagged(false);
            }}
          >
            ניקוי מסננים
          </button>
        </div>
      )}
      {archiveLoading ? (
        <div className="panel inline-empty">טוען ארכיון...</div>
      ) : view === "map" ? (
        <MapPage projects={visibleProjects} openProject={openProject} stageFilter={stageFilter} setStageFilter={setStageFilter}/>
      ) : view === "table" ? (
        <div className="panel projects-table-wrap">
          <table className="projects-table">
            <thead>
              <tr>
                <th><button className={projectSort.key==="name"?"active":""} onClick={()=>toggleProjectSort("name")}>פרויקט<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="stage"?"active":""} onClick={()=>toggleProjectSort("stage")}>שלב נוכחי<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="progress"?"active":""} onClick={()=>toggleProjectSort("progress")}>התקדמות<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="manager"?"active":""} onClick={()=>toggleProjectSort("manager")}>מנהל פרויקט<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="milestone"?"active":""} onClick={()=>toggleProjectSort("milestone")}>אבן דרך הבאה<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="balance"?"active":""} onClick={()=>toggleProjectSort("balance")}>יתרה לגבייה<ArrowUpDown size={13}/></button></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr key={project.id} onClick={() => openProject(project)}>
                  <td>
                    <div className="project-cell">
                      <div className="project-thumb">
                        <Home size={18} />
                      </div>
                      <div>
                        <strong>{project.name}</strong>
                        <span>
                          {project.id} · {project.serialCode} · {project.location} · {projectClassificationLabels[project.projectClassification] || "בית פרטי"}
                        </span>
                        {showArchived && (
                          <small className="archived-date">
                            בארכיון מ־
                            {new Date(project.archivedAt).toLocaleDateString(
                              "he-IL",
                            )}
                          </small>
                        )}
                      </div>
                      {project.flag && <Flag size={14} className="row-flag" />}
                    </div>
                  </td>
                  <td>
                    <StatusBadge stage={project.stage} />
                  </td>
                  <td>
                    <div className="table-progress">
                      <div>
                        <i
                          style={{
                            width: `${project.progress}%`,
                            background: stageMeta[project.stage].color,
                          }}
                        />
                      </div>
                      <b>{project.progress}%</b>
                    </div>
                  </td>
                  <td>
                    <div className="manager-cell">
                      <span>{project.ownerInitials}</span>
                      {project.manager || "לא הוקצה"}
                    </div>
                  </td>
                  <td>
                    <div className="milestone-cell">
                      <strong>{project.nextMilestone || "לא הוגדר"}</strong>
                      <span>
                        <CalendarDays size={13} />
                        {project.due || "ללא תאריך"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong className="money-cell">
                      {money.format(project.value - project.paid)}
                    </strong>
                  </td>
                  <td>
                    <div className="archive-row-actions">
                      {showArchived && user.role === "admin" && <button className="archive-delete" onClick={(event) => { event.stopPropagation(); beginPermanentDelete(project); }} title="מחיקה לצמיתות"><Trash2 size={17} /></button>}
                      <button className="round-more" onClick={(e) => { e.stopPropagation(); openProject(project); }} title="פתיחת פרויקט"><MoreHorizontal size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleProjects.length && (
            <div className="inline-empty">
              {showArchived
                ? "הארכיון ריק."
                : "לא נמצאו פרויקטים התואמים למסננים."}
            </div>
          )}
        </div>
      ) : (
        <BoardView projects={visibleProjects} openProject={openProject} />
      )}
      {deleteTarget && (
        <ModalPortal>
        <div className="ops-modal-backdrop" onMouseDown={() => !deleting && setDeleteTarget(null)}>
          <div className="ops-modal compact permanent-delete-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="ops-modal-title">
              <div><span>אישור שני · Administrator בלבד</span><h2>מחיקה לצמיתות</h2><p>לא ניתן לשחזר פעולה זו מגיבוי שטרם נוצר.</p></div>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}><X size={18} /></button>
            </div>
            <form onSubmit={permanentDelete}>
              <div className="permanent-delete-warning"><AlertTriangle size={22} /><div><strong>{deleteTarget.name}</strong><p>הפרויקט, המשימות, התשלומים, המסמכים, הטפסים והיסטוריית לוח השנה שלו יימחקו.</p></div></div>
              <div className="ops-form-grid">
                <label className="wide">הקלידו את המספר הסידורי: <b>{deleteTarget.serialCode}</b><input className="permanent-delete-code" autoFocus required value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} placeholder={deleteTarget.serialCode} /></label>
                <label className="wide">סיסמת Administrator של PROJECTS<input type="password" required autoComplete="current-password" value={deleteForm.password} onChange={(event) => setDeleteForm({ ...deleteForm, password: event.target.value })} /></label>
              </div>
              <div className="ops-modal-actions"><button type="button" className="ops-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>ביטול</button><button className="danger permanent-delete-confirm" disabled={deleting || deleteForm.confirmation.trim().toUpperCase() !== deleteTarget.serialCode.toUpperCase() || !deleteForm.password}>{deleting ? "מוחק..." : "מחיקה סופית"}</button></div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

function BoardView({ projects, openProject }) {
  return (
    <div className="board-view">
      {Object.entries(stageMeta).map(([key, meta]) => {
        const items = projects.filter((p) => p.stage === key);
        return (
          <div className="board-column" key={key}>
            <div className="board-head">
              <span>
                <i style={{ background: meta.color }} />
                {meta.label}
              </span>
              <b>{items.length}</b>
              <Plus size={17} />
            </div>
            <div className="board-cards">
              {items.map((project) => (
                <button
                  className="board-card"
                  key={project.id}
                  onClick={() => openProject(project)}
                >
                  <div className="board-card-top">
                    <span>{project.id}</span>
                    {project.flag && <Flag size={14} />}
                  </div>
                  <strong>{project.name}</strong>
                  <small>
                    <MapPin size={13} />
                    {project.location}
                  </small>
                  <div className="systems-mini">
                    <em>{projectClassificationLabels[project.projectClassification] || "בית פרטי"}</em>
                    {project.systems.slice(0, 2).map((s) => (
                      <em key={s}>{s}</em>
                    ))}
                  </div>
                  <div className="board-card-bottom">
                    <div className="mini-avatar">{project.ownerInitials}</div>
                    <div className="micro-progress">
                      <i
                        style={{
                          width: `${project.progress}%`,
                          background: meta.color,
                        }}
                      />
                    </div>
                    <b>{project.progress}%</b>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MapPage({ projects, openProject, stageFilter, setStageFilter }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const visible = projects.filter((p) =>
    `${p.name} ${p.client} ${p.address} ${p.location}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="map-page section-page">
      <div className="page-intro">
        <div>
          <h2>מפת פרויקטים חיה</h2>
          <p>תמונת מצב גאוגרפית של הפרויקטים הפעילים</p>
        </div>
        <div className="map-stat">
          <MapPin size={18} />
          <strong>{projects.length}</strong> מיקומים מוצגים
        </div>
      </div>
      <div className="map-workspace panel">
        <div className="map-sidebar">
          <label className="table-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש כתובת, לקוח או פרויקט..."
            />
          </label>
          <div className="map-filter-title">
            <span>{visible.length} פרויקטים</span>
            <small>סינון לפי שלב במקרא</small>
          </div>
          <div className="map-project-list">
            {visible.map((p) => (
              <button
                key={p.id}
                className={selected?.id === p.id ? "active" : ""}
                onClick={() => setSelected(p)}
              >
                <i style={{ background: stageMeta[p.stage].color }} />
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.location} · {p.progress}%
                  </span>
                </div>
                <ChevronLeft size={17} />
              </button>
            ))}
          </div>
          <div className="map-legend">
            <span>מקרא שלבים</span>
            {Object.entries(stageMeta)
              .slice(0, 5)
              .map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() =>
                    setStageFilter(stageFilter === key ? "all" : key)
                  }
                  className={stageFilter === key ? "active" : ""}
                >
                  <i style={{ background: meta.color }} />
                  {meta.label}
                </button>
              ))}
          </div>
        </div>
        <div className="leaflet-shell">
          <MapContainer
            center={[32.12, 34.83]}
            zoom={10}
            zoomControl={false}
            scrollWheelZoom
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomleft" />
            {visible.map((p) => (
              <ProjectMarker key={p.id} project={p} onOpen={openProject} />
            ))}
          </MapContainer>
          {selected && (
            <div className="floating-project-card">
              <button onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
              <span className="eyebrow">{selected.id}</span>
              <h3>{selected.name}</h3>
              <p>
                <MapPin size={14} />
                {selected.address}
              </p>
              <StatusBadge stage={selected.stage} />
              <div className="floating-progress">
                <span>התקדמות</span>
                <b>{selected.progress}%</b>
                <div>
                  <i
                    style={{
                      width: `${selected.progress}%`,
                      background: stageMeta[selected.stage].color,
                    }}
                  />
                </div>
              </div>
              <button
                className="open-project"
                onClick={() => openProject(selected)}
              >
                פתח תיק פרויקט <ArrowLeft size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientsPage() {
  return (
    <div className="section-page">
      <div className="page-intro">
        <div>
          <h2>לקוחות ואנשי קשר</h2>
          <p>מרכז מידע מאוחד לכל הלקוחות והשותפים בפרויקטים</p>
        </div>
        <button className="secondary-button">
          <Upload size={17} />
          ייבוא לקוחות
        </button>
      </div>
      <div className="client-stats">
        <div>
          <Users />
          <span>
            סה״כ לקוחות<strong>48</strong>
          </span>
        </div>
        <div>
          <Building2 />
          <span>
            לקוחות עסקיים<strong>11</strong>
          </span>
        </div>
        <div>
          <FolderKanban />
          <span>
            פרויקטים משויכים<strong>64</strong>
          </span>
        </div>
        <div>
          <TrendingUp />
          <span>
            שווי לקוח ממוצע<strong>₪286K</strong>
          </span>
        </div>
      </div>
      <div className="panel clients-panel">
        <div className="toolbar">
          <label className="table-search">
            <Search size={18} />
            <input placeholder="חיפוש לקוח, איש קשר או טלפון..." />
          </label>
          <button className="filter-button">
            <Filter size={17} />
            סינון
          </button>
        </div>
        <div className="client-grid">
          {clients.map((client, index) => (
            <button className="client-card" key={client.name}>
              <div className={`client-avatar c${index}`}>
                {client.name.slice(0, 2)}
              </div>
              <div className="client-title">
                <span>{client.type}</span>
                <h3>{client.name}</h3>
                <p>
                  <MapPin size={13} />
                  {client.city}
                </p>
              </div>
              <MoreHorizontal size={18} />
              <div className="client-contact">
                <span>
                  <UserRound size={15} />
                  {client.contact}
                </span>
                <span>
                  <Phone size={15} />
                  {client.phone}
                </span>
              </div>
              <div className="client-metrics">
                <div>
                  <span>פרויקטים</span>
                  <strong>{client.projects}</strong>
                </div>
                <div>
                  <span>היקף פעילות</span>
                  <strong>{money.format(client.total)}</strong>
                </div>
              </div>
              <span className="client-open">
                פתיחת כרטיס לקוח <ChevronLeft size={15} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormsPage({ setNotice }) {
  const forms = [
    {
      title: "סקר אתר ואפיון ראשוני",
      desc: "פרטי נכס, צרכים, מערכות ותשתיות קיימות",
      fields: 28,
      uses: 14,
      icon: ClipboardCheck,
      tone: "purple",
    },
    {
      title: "בדיקת תשתיות לפני התקנה",
      desc: "לוחות, צנרת, נקודות חשמל ותקשורת",
      fields: 36,
      uses: 9,
      icon: CheckCircle2,
      tone: "blue",
    },
    {
      title: "פרוטוקול מסירת מערכת",
      desc: "בדיקות סופיות, הדרכה, קודים וחתימת לקוח",
      fields: 42,
      uses: 21,
      icon: FileText,
      tone: "green",
    },
    {
      title: "דוח ביקור טכנאי",
      desc: "תקלות, פעולות שבוצעו, חלקים ותמונות",
      fields: 18,
      uses: 37,
      icon: Settings,
      tone: "orange",
    },
  ];
  return (
    <div className="section-page">
      <div className="page-intro">
        <div>
          <h2>טפסים ומסמכים</h2>
          <p>תבניות חכמות לתיעוד אחיד בכל שלבי הפרויקט</p>
        </div>
        <button
          className="primary-button"
          onClick={() => setNotice("בונה הטפסים יתווסף בגרסה הבאה")}
        >
          <Plus size={17} />
          תבנית חדשה
        </button>
      </div>
      <div className="forms-grid">
        {forms.map(({ title, desc, fields, uses, icon: Icon, tone }) => (
          <div className="panel form-card" key={title}>
            <div className={`form-icon ${tone}`}>
              <Icon />
            </div>
            <button>
              <MoreHorizontal />
            </button>
            <span>תבנית פעילה</span>
            <h3>{title}</h3>
            <p>{desc}</p>
            <div className="form-meta">
              <span>
                <FormInput size={15} />
                {fields} שדות
              </span>
              <span>
                <FileText size={15} />
                {uses} מילויים
              </span>
            </div>
            <div className="form-actions">
              <button onClick={() => setNotice("התצוגה המקדימה מוכנה לבדיקה")}>
                תצוגה מקדימה
              </button>
              <button onClick={() => setNotice("מצב העריכה יתווסף בגרסה הבאה")}>
                עריכה
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="panel files-overview">
        <PanelHead
          title="מסמכים אחרונים"
          subtitle="קבצים שהועלו לאחרונה לפרויקטים"
          action="כל המסמכים"
        />
        <div className="documents-list">
          {[
            "תוכנית חשמל - קומה א׳.pdf",
            "כתב כמויות KNX.xlsx",
            "תמונות לוח תקשורת.zip",
            "פרוטוקול מסירה חתום.pdf",
          ].map((name, i) => (
            <div key={name}>
              <div className="doc-icon">
                <FileText size={19} />
              </div>
              <div>
                <strong>{name}</strong>
                <span>
                  {
                    [
                      "וילה משפחת כהן",
                      "בית משפחת אלון",
                      "פנטהאוז משפחת ברק",
                      "דירת משפחת לביא",
                    ][i]
                  }
                </span>
              </div>
              <span>{[3.2, 1.8, 24.6, 2.1][i]} MB</span>
              <MoreHorizontal size={18} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinancePage({ projects, openProject }) {
  const total = projects.reduce((s, p) => s + p.value, 0),
    paid = projects.reduce((s, p) => s + p.paid, 0);
  return (
    <div className="section-page">
      <div className="page-intro">
        <div>
          <h2>תשלומים וגבייה</h2>
          <p>בקרת תזרים, אבני דרך לתשלום ויתרות פתוחות</p>
        </div>
        <button className="secondary-button">
          <FileText size={17} />
          הפקת דוח
        </button>
      </div>
      <div className="finance-hero">
        <div>
          <span>היקף חוזים כולל</span>
          <strong>{money.format(total)}</strong>
          <small>
            <TrendingUp size={14} />
            8.2% מהרבעון הקודם
          </small>
        </div>
        <div
          className="collection-ring"
          style={{
            "--percent": `${Math.round((paid / total) * 100) * 3.6}deg`,
          }}
        >
          <span>
            <strong>{Math.round((paid / total) * 100)}%</strong>נגבה
          </span>
        </div>
        <div className="finance-split">
          <div>
            <i className="green" />
            <span>
              התקבל<strong>{money.format(paid)}</strong>
            </span>
          </div>
          <div>
            <i className="orange" />
            <span>
              יתרה פתוחה<strong>{money.format(total - paid)}</strong>
            </span>
          </div>
        </div>
      </div>
      <div className="panel finance-table-wrap">
        <PanelHead
          title="מצב גבייה לפי פרויקט"
          subtitle="לחיצה על שורה תפתח את תיק הפרויקט"
        />
        <table className="projects-table finance-table">
          <thead>
            <tr>
              <th>פרויקט ולקוח</th>
              <th>שווי חוזה</th>
              <th>שולם</th>
              <th>יתרה</th>
              <th>אחוז גבייה</th>
              <th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const percent = Math.round((p.paid / p.value) * 100);
              const overdue = p.flag.includes("תשלום");
              return (
                <tr key={p.id} onClick={() => openProject(p)}>
                  <td>
                    <div className="project-cell">
                      <div className="project-thumb">
                        <Home size={17} />
                      </div>
                      <div>
                        <strong>{p.name}</strong>
                        <span>{p.client}</span>
                      </div>
                    </div>
                  </td>
                  <td>{money.format(p.value)}</td>
                  <td className="paid-money">{money.format(p.paid)}</td>
                  <td>
                    <strong>{money.format(p.value - p.paid)}</strong>
                  </td>
                  <td>
                    <div className="collection-cell">
                      <div>
                        <i style={{ width: `${percent}%` }} />
                      </div>
                      <b>{percent}%</b>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`payment-state ${overdue ? "overdue" : percent === 100 ? "paid" : ""}`}
                    >
                      {overdue ? "באיחור" : percent === 100 ? "שולם" : "תקין"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectDetail({
  project,
  updateProject,
  canEdit,
  professionals,
  stageOptions,
}) {
  const [tab, setTab] = useState("overview");
  const dueAmount = project.value - project.paid;
  const projectMilestones = [
    { title: "אפיון וחתימת חוזה", status: "done", date: "12.03.2026" },
    { title: "אישור תוכניות ביצוע", status: "done", date: "28.05.2026" },
    { title: project.nextMilestone, status: "current", date: project.due },
    { title: "תכנות, בדיקות ותרחישים", status: "future", date: "08.09.2026" },
    { title: "מסירה והדרכת לקוח", status: "future", date: "22.09.2026" },
  ];
  return (
    <div className="project-detail">
      <div className="project-hero panel">
        <div className="project-identity">
          <div className="project-home-icon">
            <Home size={27} />
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
              <MapPin size={15} />
              {project.address}
            </p>
          </div>
        </div>
        <div className="project-hero-actions">
          <button className="secondary-button" disabled={!canEdit}>
            <MessageSquare size={16} />
            הוספת עדכון
          </button>
          <button className="icon-button" disabled={!canEdit}>
            <MoreHorizontal />
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
                ? stageOptions.map((item) => [
                    item.metadata?.key || item.name,
                    item.name,
                  ])
                : Object.entries(stageMeta).map(([key, meta]) => [
                    key,
                    meta.label,
                  ])
              ).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
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
              disabled={!canEdit}
              value={project.managerId || ""}
              onChange={(e) => {
                const manager = professionals.find(
                  (item) => String(item.id) === e.target.value,
                );
                updateProject(project.id, {
                  managerId: manager?.id || null,
                  manager: manager?.displayName || "",
                  ownerInitials: manager?.displayName?.slice(0, 2) || "",
                });
              }}
            >
              <option value="">ללא מנהל</option>
              {professionals
                .filter(
                  (item) =>
                    item.active &&
                    item.affiliation === "company" &&
                    item.roles.some((role) => role.key === "project_manager"),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                    {item.linkedUserId ? " · משתמש מערכת" : ""}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <span>יעד לאבן דרך</span>
            <strong>{project.due}</strong>
            <small>{project.nextMilestone}</small>
          </div>
        </div>
      </div>
      <div className="detail-tabs">
        {[
          ["overview", "סקירה"],
          ["tasks", "משימות ואבני דרך"],
          ["systems", "מערכות"],
          ["forms", "טפסים וקבצים"],
          ["finance", "כספים"],
          ["activity", "פעילות"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "tasks" && <em>7</em>}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="detail-grid">
          <div className="detail-main">
            <div className="panel overview-card">
              <PanelHead
                title="התקדמות הפרויקט"
                subtitle={`${project.tasksDone} מתוך ${project.tasksTotal} משימות הושלמו`}
              />
              <div className="large-progress">
                <div>
                  <i
                    style={{
                      width: `${project.progress}%`,
                      background: stageMeta[project.stage].color,
                    }}
                  />
                </div>
                <strong>{project.progress}%</strong>
              </div>
              <div className="milestone-timeline">
                {projectMilestones.map((m, index) => (
                  <div className={m.status} key={`${m.title}-${index}`}>
                    <span>
                      {m.status === "done" ? <Check size={14} /> : ""}
                    </span>
                    <div>
                      <strong>{m.title}</strong>
                      <small>{m.date}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel systems-card">
              <PanelHead title="מערכות בפרויקט" action="ניהול מערכות" />
              <div className="system-tiles">
                {project.systems.map((system, index) => (
                  <div key={system}>
                    <span className={`system-icon s${index % 4}`}>
                      <Command size={18} />
                    </span>
                    <strong>{system}</strong>
                    <small>{index < 2 ? "התקנה בתהליך" : "טרם התחיל"}</small>
                    <CheckCircle2 size={17} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="detail-side">
            <div className="panel contact-card">
              <PanelHead title="פרטי לקוח" />
              <div className="contact-person">
                <div className="client-avatar">
                  {project.client.slice(0, 2)}
                </div>
                <div>
                  <strong>{project.client}</strong>
                  <span>לקוח ראשי</span>
                </div>
              </div>
              <a href={`tel:${project.phone}`}>
                <Phone size={16} />
                {project.phone}
              </a>
              <a href={`mailto:${project.email}`}>
                <Mail size={16} />
                {project.email}
              </a>
              <p>
                <MapPin size={16} />
                {project.address}
              </p>
              <button>פתיחת כרטיס לקוח</button>
            </div>
            <div className="panel money-summary">
              <PanelHead title="סיכום כספי" />
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
                <strong>{money.format(dueAmount)}</strong>
              </div>
              <div className="money-progress">
                <i
                  style={{ width: `${(project.paid / project.value) * 100}%` }}
                />
              </div>
              <small>
                {Math.round((project.paid / project.value) * 100)}% נגבה
              </small>
              <button onClick={() => setTab("finance")}>
                לפירוט תשלומים <ChevronLeft size={15} />
              </button>
            </div>
            <div className="panel quick-notes">
              <PanelHead title="הערה מהירה" />
              <textarea placeholder="כתבו עדכון לצוות..." />
              <button>פרסום עדכון</button>
            </div>
          </div>
        </div>
      )}
      {tab !== "overview" && (
        <ProjectTabPlaceholder tab={tab} project={project} />
      )}
    </div>
  );
}

function ProjectTabPlaceholder({ tab, project }) {
  const content = {
    tasks: [
      "משימות ואבני דרך",
      "ניהול המשימות המלא יכלול אחראים, תאריכי יעד ותלויות בין שלבים.",
      ClipboardCheck,
    ],
    systems: [
      "מערכות בפרויקט",
      `${project.systems.length} מערכות משויכות לפרויקט. במסך המלא יופיעו ציוד, דגמים ותוצאות בדיקה.`,
      Command,
    ],
    forms: [
      "טפסים וקבצים",
      "כאן ירוכזו סקרי האתר, תוכניות, תמונות, פרוטוקולים וחתימות.",
      FileText,
    ],
    finance: [
      "כספים ותשלומים",
      `נותרה יתרה של ${money.format(project.value - project.paid)} לגבייה בפרויקט.`,
      CreditCard,
    ],
    activity: [
      "יומן פעילות",
      "כל שינוי, עדכון, קובץ ותשלום יתועדו כאן לפי זמן ומשתמש.",
      Activity,
    ],
  }[tab];
  const Icon = content[2];
  return (
    <div className="panel tab-placeholder">
      <div>
        <Icon size={30} />
      </div>
      <h3>{content[0]}</h3>
      <p>{content[1]}</p>
      <button className="secondary-button">
        <Plus size={17} />
        הוספת פריט
      </button>
    </div>
  );
}

function NewProjectModal({
  api,
  onClose,
  onCreate,
  professionals,
  clients,
  stageOptions,
  equipment,
  templates,
}) {
  const managers = professionals.filter(
    (item) =>
      item.active &&
      item.affiliation === "company" &&
      item.roles.some((role) => role.key === "project_manager"),
  );
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    clientMode: "existing",
    clientId: "",
    clientName: "",
    clientFirstName: "",
    clientLastName: "",
    clientPhone: "",
    clientEmail: "",
    clientAddress: "",
    clientCity: "",
    location: "",
    projectClassification: "private_house",
    managerId: managers[0]?.id || "",
    stage: stageOptions[0]?.metadata?.key || "planning",
    value: "",
    installationHoursTarget: "",
    programmingHoursTarget: "",
    startDate: new Date().toISOString().slice(0, 10),
    targetDate: "",
    selectedEquipment: {},
    templateId: "",
  });
  const submit = (event) => {
    event.preventDefault();
    const client = clients.find(
      (item) => String(item.id) === String(form.clientId),
    );
    const manager = managers.find(
      (item) => String(item.id) === String(form.managerId),
    );
    if (step < 3) return setStep(step + 1);
    const equipmentItems = Object.entries(form.selectedEquipment)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([id, quantity]) => ({
        id: Number(id),
        quantity: Number(quantity),
      }));
    const newClient =
      form.clientMode === "new"
        ? {
            firstName: form.clientFirstName,
            lastName: form.clientLastName,
            name: `${form.clientFirstName} ${form.clientLastName}`.trim(),
            address: form.clientAddress,
            phone: form.clientPhone,
            email: form.clientEmail,
            city: form.clientCity,
          }
        : undefined;
    onCreate({
      name: form.name,
      clientId: client?.id || null,
      newClient,
      location: form.location || client?.city || form.clientCity || "",
      projectClassification: form.projectClassification,
      address: client?.address || form.clientAddress || form.location,
      lat: 32.08,
      lng: 34.82,
      stage: form.stage,
      progress: 0,
      managerId: manager?.id || null,
      manager: manager?.displayName || "",
      ownerInitials: manager?.displayName?.slice(0, 2) || "",
      value: Number(form.value) || 0,
      installationHoursTarget: Number(form.installationHoursTarget) || 0,
      programmingHoursTarget: Number(form.programmingHoursTarget) || 0,
      paid: 0,
      due: form.targetDate
        ? new Date(form.targetDate).toLocaleDateString("he-IL")
        : "",
      priority: "normal",
      flag: "",
      systems: [],
      equipmentItems,
      templateId: form.templateId || null,
      startDate: form.startDate,
      nextMilestone: "פגישת אפיון ראשונית",
      phone: client?.phone || form.clientPhone || "",
      email: client?.email || form.clientEmail || "",
      health: 100,
      tasksDone: 0,
      tasksTotal: 0,
    });
  };
  const categories = equipment.filter(
    (item) => item.itemType === "system_type" && item.active,
  );
  if (step === 1)
    return (
      <ModalPortal>
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div
          className="modal project-wizard"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="modal-head">
            <div>
              <span>אשף פרויקט חדש · שלב 1 מתוך 3</span>
              <h2>לקוח וזהות הפרויקט</h2>
            </div>
            <button onClick={onClose}>
              <X />
            </button>
          </div>
          <div className="wizard-progress">
            <i style={{ width: "33.333%" }} />
          </div>
          <form onSubmit={submit}>
            <label>
              שם הפרויקט
              <input
                autoFocus
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="לדוגמה: וילה משפחת ישראלי"
              />
            </label>
            <label>
              סיווג הפרויקט
              <select
                value={form.projectClassification}
                onChange={(event) =>
                  setForm({ ...form, projectClassification: event.target.value })
                }
              >
                {projectClassificationOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="client-mode-switch">
              <button
                type="button"
                className={form.clientMode === "existing" ? "active" : ""}
                onClick={() => setForm({ ...form, clientMode: "existing" })}
              >
                לקוח קיים
              </button>
              <button
                type="button"
                className={form.clientMode === "new" ? "active" : ""}
                onClick={() =>
                  setForm({ ...form, clientMode: "new", clientId: "" })
                }
              >
                לקוח חדש
              </button>
            </div>
            {form.clientMode === "existing" ? (
              <div className="form-row">
                <label>
                  לקוח
                  <select
                    required
                    value={form.clientId}
                    onChange={(event) =>
                      setForm({ ...form, clientId: event.target.value })
                    }
                  >
                    <option value="">בחירת לקוח מהמאגר</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} · {client.address}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  עיר / מיקום
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                    placeholder="נלקח מכתובת הלקוח אם ריק"
                  />
                </label>
              </div>
            ) : (
              <div className="new-client-fields">
                <p>הלקוח ייווצר אוטומטית במאגר ויקושר לפרויקט.</p>
                <div className="form-row">
                  <label>
                    שם פרטי
                    <input
                      required
                      value={form.clientFirstName}
                      onChange={(event) =>
                        setForm({ ...form, clientFirstName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    שם משפחה
                    <input required value={form.clientLastName} onChange={(event) => setForm({ ...form, clientLastName: event.target.value })}/>
                  </label>
                  <label>
                    טלפון
                    <input
                      required
                      value={form.clientPhone}
                      onChange={(event) =>
                        setForm({ ...form, clientPhone: event.target.value })
                      }
                    />
                  </label>
                </div>
                <AddressAutocomplete
                  api={api}
                  required
                  value={form.clientAddress}
                  onChange={(clientAddress) =>
                    setForm((current) => ({ ...current, clientAddress }))
                  }
                  onSelect={(item) =>
                    setForm((current) => ({
                      ...current,
                      clientAddress: item.address,
                      clientCity: item.city || current.clientCity,
                      location: item.city || current.location,
                      lat: item.lat,
                      lng: item.lng,
                    }))
                  }
                />
                <label>
                  עיר
                  <input
                    value={form.clientCity}
                    onChange={(event) =>
                      setForm({ ...form, clientCity: event.target.value })
                    }
                  />
                </label>
                <label>
                  דוא״ל
                  <input
                    type="email"
                    value={form.clientEmail}
                    onChange={(event) =>
                      setForm({ ...form, clientEmail: event.target.value })
                    }
                  />
                </label>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                ביטול
              </button>
              <button className="primary-button" type="submit">
                המשך <ArrowLeft size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
      </ModalPortal>
    );
  return (
    <ModalPortal>
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal project-wizard"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span>אשף פרויקט חדש · שלב {step} מתוך 3</span>
            <h2>
              {step === 1
                ? "לקוח וזהות הפרויקט"
                : step === 2
                  ? "ניהול ולוחות זמנים"
                  : "מערכות וסקירה"}
            </h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="wizard-progress">
          <i style={{ width: `${(step / 3) * 100}%` }} />
        </div>
        <form onSubmit={submit}>
          {step === 1 && (
            <>
              <label>
                שם הפרויקט
                <input
                  autoFocus
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="לדוגמה: וילה משפחת ישראלי"
                />
              </label>
              <label>
                סיווג הפרויקט
                <select
                  value={form.projectClassification}
                  onChange={(event) =>
                    setForm({ ...form, projectClassification: event.target.value })
                  }
                >
                  {projectClassificationOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <div className="client-mode-switch">
                <button
                  type="button"
                  className={form.clientMode === "existing" ? "active" : ""}
                  onClick={() => setForm({ ...form, clientMode: "existing" })}
                >
                  לקוח קיים
                </button>
                <button
                  type="button"
                  className={form.clientMode === "new" ? "active" : ""}
                  onClick={() =>
                    setForm({ ...form, clientMode: "new", clientId: "" })
                  }
                >
                  לקוח חדש
                </button>
              </div>
              {form.clientMode === "existing" ? (
                <div className="form-row">
                  <label>
                    לקוח
                    <select
                      required
                      value={form.clientId}
                      onChange={(e) =>
                        setForm({ ...form, clientId: e.target.value })
                      }
                    >
                      <option value="">בחירת לקוח מהמאגר</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} · {client.address}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    עיר / מיקום
                    <input
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                      placeholder="נלקח מכתובת הלקוח אם ריק"
                    />
                  </label>
                </div>
              ) : (
                <div className="new-client-fields">
                  <p>הלקוח ייווצר אוטומטית במאגר ויקושר לפרויקט.</p>
                  <div className="form-row">
                    <label>
                      שם פרטי
                      <input
                        required
                        value={form.clientFirstName}
                        onChange={(e) =>
                          setForm({ ...form, clientFirstName: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      שם משפחה
                      <input required value={form.clientLastName} onChange={(e) => setForm({ ...form, clientLastName: e.target.value })}/>
                    </label>
                    <label>
                      טלפון
                      <input
                        required
                        value={form.clientPhone}
                        onChange={(e) =>
                          setForm({ ...form, clientPhone: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      כתובת
                      <input
                        required
                        value={form.clientAddress}
                        onChange={(e) =>
                          setForm({ ...form, clientAddress: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      עיר
                      <input
                        value={form.clientCity}
                        onChange={(e) =>
                          setForm({ ...form, clientCity: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    דוא״ל
                    <input
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) =>
                        setForm({ ...form, clientEmail: e.target.value })
                      }
                    />
                  </label>
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <label>
                תבנית עבודה
                <select value={form.templateId} onChange={(e)=>setForm({...form,templateId:e.target.value})}>
                  <option value="">פרויקט ריק — ללא תבנית</option>
                  {templates.filter(item=>item.active).map(template=><option key={template.id} value={template.id}>{template.name} · {template.task_count} משימות</option>)}
                </select>
                <small>התבנית תיצור אוטומטית משימות, תלות ויעדי שעות החל מתאריך ההתחלה.</small>
              </label>
              <div className="form-row">
                <label>
                  מנהל פרויקט
                  <select
                    value={form.managerId}
                    onChange={(e) =>
                      setForm({ ...form, managerId: e.target.value })
                    }
                  >
                    <option value="">ללא מנהל</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  שלב התחלתי
                  <select
                    value={form.stage}
                    onChange={(e) =>
                      setForm({ ...form, stage: e.target.value })
                    }
                  >
                    {(stageOptions.length
                      ? stageOptions.map((item) => [
                          item.metadata?.key || item.name,
                          item.name,
                        ])
                      : [["planning", "תכנון"]]
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  תאריך התחלה
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  יעד מסירה
                  <input
                    type="date"
                    min={form.startDate}
                    value={form.targetDate}
                    onChange={(e) =>
                      setForm({ ...form, targetDate: e.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                שווי משוער
                <input
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="₪ 0"
                />
              </label>
              <div className="form-row project-hour-target-fields">
                <label>
                  יעד שעות התקנה
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.installationHoursTarget}
                    onChange={(e) => setForm({ ...form, installationHoursTarget: e.target.value })}
                    placeholder="ללא יעד"
                  />
                </label>
                <label>
                  יעד שעות תכנות
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.programmingHoursTarget}
                    onChange={(e) => setForm({ ...form, programmingHoursTarget: e.target.value })}
                    placeholder="ללא יעד"
                  />
                </label>
              </div>
              <p className="time-target-note">היעדים מיועדים רק להתקנה ולתכנות. יתר הפעילויות נמדדות בפועל ללא יעד.</p>
            </>
          )}
          {step === 3 && (
            <>
              <p className="wizard-help">
                בחרו מערכות ראשוניות וכמות. אפשר להוסיף, לשנות או להסיר בהמשך
                מתוך הפרויקט.
              </p>
              <div className="wizard-systems">
                {categories.map((category) => (
                  <section key={category.id}>
                    <h3>{category.name}</h3>
                    {equipment
                      .filter(
                        (item) =>
                          String(item.parentId) === String(category.id) &&
                          item.active,
                      )
                      .map((item) => (
                        <label key={item.id}>
                          <span>{item.name}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={form.selectedEquipment[item.id] || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                selectedEquipment: {
                                  ...form.selectedEquipment,
                                  [item.id]: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                  </section>
                ))}
              </div>
            </>
          )}
          <div className="modal-actions">
            <button
              type="button"
              onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            >
              {step === 1 ? "ביטול" : "חזרה"}
            </button>
            <button className="primary-button" type="submit">
              {step === 3 ? "יצירת פרויקט" : "המשך"} <ArrowLeft size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}

export default App;
