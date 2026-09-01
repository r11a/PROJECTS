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
  KeyRound,
  Mail,
  Map,
  MapPin,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Unlock,
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
  OperationalSettings,
} from "./Operational";
import { FormsWorkspace } from "./FormsWorkspace";
import { MasterDataWorkspace } from "./MasterDataWorkspace";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { AppModal, ModalPortal } from "./AppModal";
import packageJson from "../package.json";
import { cacheApiResponse, cachedApiResponse, discardOfflineFailure, flushOfflineQueue, initializeOfflineSync, offlineEntries, offlineStatus, queueOfflineMutation, retryOfflineFailures } from "./offlineQueue";
import {
  FinanceWorkspace,
  ReportsWorkspace,
  TasksWorkspace,
} from "./Workspaces";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { MyWorkWorkspace, PortfolioControlWorkspace } from "./ProductivityWorkspace";
import { localDateValue } from "./dateTime";
import { RiskCenter } from "./features/risk-center/RiskCenter";
import "./project-category.css";

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
const projectCategoryText=(project)=>project.projectCategory==='other'?(project.projectCategoryCustom||'אחר'):'בית חכם';
const contractorProgressLabels = {
  finishing: "עבודות גמר", carpentry: "הרכבות נגרות", waiting: "בהמתנה",
  infrastructure: "סלילת תשתיות", infrastructure_paving: "סלילת תשתיות", drywall_paint: "עבודות גבס וצבע", stopped: "בעצירה",
};

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
    // localStorage may be blocked on some environments; navigation still works without persistence.
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
import { GanttWorkspace } from "./GanttWorkspace";
import { MessageCenter } from "./Messages";
import { AiChat, AiChatBoundary } from "./AiChat";
import "./operational.css";
import "./forms-workspace.css";
import "./master-data.css";
import "./workspaces.css";
import "./contacts.css";
import "./messages.css";
import "./commercial-ui.css";
import "./commercial-ui-extra.css";
import "./task-center.css";
import "./ai-chat.css";
import "./ai-chat-voice.css";
import "./commercial-gantt.css";
import "./modal-system.css";
import "./productivity.css";
import "./responsive-unified.css";
import "./theme-dark.css";
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
  const method=String(options.method||"GET").toUpperCase();
  let response;
  try{response=await fetch(`${apiRoot}${path}`, {
      credentials: "same-origin",cache: "no-store",...options,
      headers:isFormData?{...options.headers}:{"Content-Type":"application/json",...options.headers},
    });}
  catch(error){
    if(method==="GET"){const cached=await cachedApiResponse(path);if(cached!==null)return cached}
    const queued=await queueOfflineMutation(path,{...options,method});if(queued)return queued;
    throw new Error(navigator.onLine?`לא ניתן להגיע לשרת: ${error.message}`:"אין חיבור לרשת והפעולה הזו אינה זמינה במצב Offline");
  }
  const rawBody = response.status === 204 ? "" : await response.text();
  let body = null;
  if (rawBody) {
    try { body = JSON.parse(rawBody); }
    catch { body = { error: rawBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 260) }; }
  }
  if (!response.ok) {
    if([502,503,504].includes(response.status)){
      if(method==="GET"){const cached=await cachedApiResponse(path);if(cached!==null)return cached}
      const queued=await queueOfflineMutation(path,{...options,method});if(queued)return queued;
    }
    const error = new Error(
      body?.error || `הבקשה נכשלה (HTTP ${response.status})`,
    );
    error.status = response.status;
    error.body = body;
    error.code = body?.code;
    throw error;
  }
  if(method==="GET")await cacheApiResponse(path,body);
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
  { id: "forms", label: "מסמכים והקלטות", icon: FormInput },
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
  const navigationSwipe = useRef(null);
  const SWIPE_EDGE_TRIGGER_PX = 30;
  const SWIPE_OPEN_THRESHOLD_PX = 72;
  const SWIPE_VERTICAL_TOLERANCE_PX = 28;
  useEffect(()=>{
    const start=(event)=>{
      const touch=event.touches?.[0];
      if(!touch) return;
      navigationSwipe.current={
        x: touch.clientX,
        y: touch.clientY,
        edge: touch.clientX >= window.innerWidth - SWIPE_EDGE_TRIGGER_PX,
      };
    };
    const end=(event)=>{
      const startPoint=navigationSwipe.current;
      const touch=event.changedTouches?.[0];
      navigationSwipe.current=null;
      if(!startPoint||!touch) return;
      const deltaX=touch.clientX-startPoint.x;
      const deltaY=touch.clientY-startPoint.y;
      const absDeltaX=Math.abs(deltaX);
      const absDeltaY=Math.abs(deltaY);
      if(absDeltaY > SWIPE_VERTICAL_TOLERANCE_PX || absDeltaX < SWIPE_OPEN_THRESHOLD_PX) return;
      if(deltaX <= -SWIPE_OPEN_THRESHOLD_PX && startPoint.edge && !sidebarOpen) {
        setSidebarOpen(true);
        return;
      }
      if(deltaX >= SWIPE_OPEN_THRESHOLD_PX && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('touchstart',start,{passive:true});
    window.addEventListener('touchend',end,{passive:true});
    return()=>{window.removeEventListener('touchstart',start);window.removeEventListener('touchend',end);};
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
  const [offlineState,setOfflineState]=useState({online:navigator.onLine,pending:0,failed:0,syncing:false});
  const [offlinePanel,setOfflinePanel]=useState(null);
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

  useEffect(() => {
    if (user && pageResources[page] && !userCanAccess(user, page)) {
      setSelectedProject(null);
      setPage("dashboard");
    }
  }, [user, page]);

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
    const refreshReference = () => loadReferenceData().catch(() => {});
    window.addEventListener("projects:reference-changed", refreshReference);
    return () => window.removeEventListener("projects:reference-changed", refreshReference);
  }, [user?.id]);
  useEffect(() => {
    if (!user) return undefined;
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible" && navigator.onLine) loadProjects().catch(() => {});
    };
    const timer = window.setInterval(refreshWhenActive, 20000);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [user?.id]);
  useEffect(() => {
    if (!user) return undefined;
    const stream = new EventSource(`${apiRoot}/live`, {
      withCredentials: true,
    });
    let timer;
    const pendingTables = new Set();
    const changed = (event) => {
      let table = "";
      try {
        table = JSON.parse(event.data).table || "";
      } catch {}
      pendingTables.add(table);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const tables = [...pendingTables];
        pendingTables.clear();
        const has = (...names) => tables.includes("") || names.some((name) => tables.includes(name));
        if (has("projects", "tasks", "milestones", "payments", "project_payments", "project_equipment", "project_team", "work_logs", "change_requests"))
          loadProjects().catch(() => {});
        if (has("tasks")) loadTaskCount().catch(() => {});
        if (has("clients", "client_contacts", "projects"))
          loadReferenceData().catch(() => {});
        if (has("users")) refreshCurrentUser().catch(() => {});
        tables.forEach((changedTable) => window.dispatchEvent(
          new CustomEvent("projects:live-change", { detail: { table: changedTable } }),
        ));
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
    const timer = setTimeout(() => setNotice(""), 5200);
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
      document.body.classList.add("theme-dark");
      document.body.dataset.projectsTheme = "dark";
    } else {
      delete document.documentElement.dataset.projectsTheme;
      document.documentElement.style.removeProperty("color-scheme");
      document.body.classList.remove("theme-dark");
      delete document.body.dataset.projectsTheme;
    }
    return () => {
      delete document.documentElement.dataset.projectsTheme;
      document.documentElement.style.removeProperty("color-scheme");
      document.body.classList.remove("theme-dark");
      delete document.body.dataset.projectsTheme;
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
      if (error.code === "COLLECTION_STAGE_WARNING" && window.confirm(`${error.message}\n\nהאם לעבור שלב בכל זאת?`)) {
        return updateProject(id, { ...patch, overrideCollectionWarning: true });
      }
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
  const openCollectionCount = userCanAccess(user,"finance")
    ? projects.filter((project) => Number(project.paid) < Number(project.value)).length
    : 0;

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
            {nav.filter(item=>userCanAccess(user,item.id)).map(({ id, label, icon: Icon }) => {
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
          {userCanAccess(user,"tasks")&&<button
            className={page === "tasks" ? "active" : ""}
            onClick={() => {
              setPage("tasks");
              setSidebarOpen(false);
            }}
          >
            <ClipboardCheck size={19} />
            <span>משימות ואבני דרך</span>
            {insights?.stats?.overdue > 0 && <em>{insights.stats.overdue}</em>}
          </button>}
          {userCanAccess(user,"gantt")&&<button className={page === "gantt" ? "active" : ""} onClick={()=>{setPage('gantt');setSidebarOpen(false)}}><Activity size={19}/><span>לוח גאנט</span></button>}
          {userCanAccess(user,"control")&&<button className={page === "control" ? "active" : ""} onClick={()=>{setPage('control');setSidebarOpen(false)}}><Gauge size={19}/><span>בקרת ביצוע</span></button>}
          {userCanAccess(user,"reports")&&<button
            className={page === "reports" ? "active" : ""}
            onClick={() => {
              setPage("reports");
              setSidebarOpen(false);
            }}
          >
            <Activity size={19} />
            <span>דוחות וניתוחים</span>
          </button>}
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
            <button type="button" className={`offline-indicator ${offlineState.online?offlineState.pending||offlineState.failed?'pending':'online':'offline'} ${offlineState.syncing?'syncing':''}`} onClick={async()=>setOfflinePanel(await offlineEntries())} title={offlineState.online?offlineState.pending?`${offlineState.pending} פעולות ממתינות לסנכרון`:'מחובר ומסונכרן':`${offlineState.pending} פעולות נשמרו במכשיר`}>
              <span/>
              <b>{offlineState.online?(offlineState.pending?`מסנכרן ${offlineState.pending}`:'מסונכרן'):`Offline · ${offlineState.pending}`}</b>
              {offlineState.failed>0&&<em>{offlineState.failed}</em>}
            </button>
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
              api={api}
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
              onOpenEvent={(event) => {
                const linkedProject = projects.find((item) => String(item.id) === String(event.projectId));
                const eventId = String(
                  event.sourceId || String(event.id || "").replace(/^[^-]+-/, "") || "",
                );
                const isScheduledEvent = ["task", "milestone"].includes(event.type);
                if (!linkedProject) return setNotice("הפרויקט המקושר לא נמצא");
                setLinkedTaskId(isScheduledEvent ? eventId : "");
                openProject(linkedProject);
                if (isScheduledEvent && eventId) window.setTimeout(() => window.dispatchEvent(new CustomEvent("projects:open-schedule-item", { detail: { id: eventId, type: event.type } })), 0);
              }}
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
          {page === "finance" && userCanAccess(user, "finance") && (
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
          user={user}
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
      {aiChatOpen && <AiChatBoundary onClose={() => setAiChatOpen(false)}><AiChat apiRoot={apiRoot} onClose={() => setAiChatOpen(false)} onNavigate={(target)=>{setAiChatOpen(false);setSelectedProject(null);setPage(target);setSidebarOpen(false)}} /></AiChatBoundary>}
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="סגירת ההודעה">×</button>
        </div>
      )}
      {offlinePanel&&<AppModal title="סנכרון עבודה Offline" subtitle={offlineState.online?"המכשיר מחובר לרשת":"השינויים שמורים בבטחה במכשיר"} onClose={()=>setOfflinePanel(null)} className="offline-sync-modal"><div className="offline-sync-summary"><span className={offlineState.online?'online':'offline'}><i/>{offlineState.online?'מחובר':'מצב Offline'}</span><b>{offlinePanel.length} פעולות בתור</b></div><div className="offline-sync-list">{offlinePanel.map(item=><article key={item.id}><span><strong>{offlineActionLabel(item.path,item.method)}</strong><small>{new Date(item.createdAt).toLocaleString('he-IL')}</small></span><em className={item.status}>{item.status==='failed'?'דורש טיפול':item.status==='syncing'?'מסתנכרן':'ממתין'}</em>{item.error&&<p>{item.error}</p>}{item.status==='failed'&&<button type="button" onClick={async()=>{await discardOfflineFailure(item.id);setOfflinePanel(await offlineEntries())}}><Trash2 size={14}/>ביטול פעולה</button>}</article>)}{!offlinePanel.length&&<div className="inline-empty"><CheckCircle2 size={24}/>כל הנתונים מסונכרנים</div>}</div><footer>{offlineState.failed>0&&<button type="button" className="secondary-button" onClick={async()=>{await retryOfflineFailures();setOfflinePanel(await offlineEntries())}}>ניסיון חוזר</button>}<button type="button" className="primary-button" disabled={!offlineState.online||!offlinePanel.length} onClick={async()=>{await flushOfflineQueue(apiRoot);setOfflinePanel(await offlineEntries())}}>סנכרון עכשיו</button></footer></AppModal>}
    </div>
  );
}

const roleLabels = {
  admin: "מנהל מערכת",
  manager: "מנהל פרויקט",
  supervisor: "מפקח",
  technician: "טכנאי",
  finance: "כספים",
  viewer: "צופה",
  custom: "הרשאה מותאמת אישית",
};
const permissionSections=[
  ["projects","פרויקטים"],["clients","לקוחות"],["professionals","אנשי מקצוע"],["tasks","משימות וגאנט"],
  ["calendar","לוח שנה"],["forms","מסמכים והקלטות"],["catalog","מערכות ורכיבים"],["finance","כספים וגבייה"],
  ["reports","דוחות וניתוחים"],["messages","הודעות"],["settings","הגדרות מערכת"],
];
function PermissionMatrix({value={},onChange}){return <div className="permission-matrix"><header><b>מסך / תחום</b><span>ללא</span><span>קריאה</span><span>קריאה וכתיבה</span></header>{permissionSections.map(([key,label])=><div key={key}><b>{label}</b>{["none","read","write"].map(level=><label key={level}><input type="radio" name={`permission-${key}`} checked={(value[key]||"none")===level} onChange={()=>onChange({...value,[key]:level})}/><span/></label>)}</div>)}</div>}
const pageResources={dashboard:"projects","my-work":"tasks",calendar:"calendar",projects:"projects",clients:"clients",professionals:"professionals",catalog:"catalog",forms:"forms",finance:"finance",tasks:"tasks",gantt:"tasks",control:"projects",reports:"reports",settings:"settings"};
const uiRoleResources={
  manager:["projects","clients","professionals","tasks","calendar","forms","catalog","finance","reports","messages"],
  supervisor:["projects","clients","professionals","tasks","calendar","forms","catalog","reports","messages"],
  technician:["projects","tasks","calendar","forms","catalog","messages"],
  finance:["projects","clients","finance","reports","messages"],
  viewer:["projects","clients","professionals","tasks","calendar","forms","catalog","reports","messages"],
};
function userCanAccess(user,page){const resource=pageResources[page]||page;if(resource==="finance"&&user.financeAccess===false)return false;if(user.role==="admin")return true;if(user.role==="custom")return ["read","write"].includes(user.permissions?.[resource]);return (uiRoleResources[user.role]||[]).includes(resource);}
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
  const submit=async(event)=>{event.preventDefault();setError('');if(!passwordsMatch(form.newPassword,form.confirmPassword))return setError('הסיסמאות אינן תואמות');setSubmitting(true);try{const result=await api('/auth/password',{method:'POST',body:JSON.stringify(form)});if(typeof onChanged==='function')onChanged(result.user)}catch(changeError){setError(changeError.message)}finally{setSubmitting(false)}};
  return <div className="login-shell" dir="rtl"><div className="login-card"><div className="login-brand"><div className="brand-mark"><img src={projectsMark} alt=""/></div><strong><b>PRO</b>JECTS</strong></div><div className="login-copy"><span>אבטחת החשבון</span><h1>החלפת סיסמה ראשונית</h1><p>לפני תחילת העבודה יש לבחור סיסמה אישית וחזקה.</p></div><form onSubmit={submit}><label>סיסמה נוכחית<input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={event=>setForm({...form,currentPassword:event.target.value})}/></label><label>סיסמה חדשה<input type="password" autoComplete="new-password" minLength="12" required value={form.newPassword} onChange={event=>setForm({...form,newPassword:event.target.value})}/></label><label>אימות סיסמה<input type="password" autoComplete="new-password" minLength="12" required value={form.confirmPassword} onChange={event=>setForm({...form,confirmPassword:event.target.value})}/></label><small>לפחות 12 תווים, אות גדולה, אות קטנה ומספר.</small>{error&&<div className="login-error">{error}</div>}<button className="primary-button" disabled={submitting}>{submitting?'שומר...':'שמירת סיסמה'} <ArrowLeft size={17}/></button></form></div></div>;
}

function UsersPage({ setNotice, currentUser, onChanged }) {
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("accounts");
  const [identityLink, setIdentityLink] = useState({ primaryUserId:"", secondaryUserId:"" });
  const [linkingIdentity,setLinkingIdentity]=useState(false);
  const [passwordActions,setPasswordActions]=useState({});
  const [savingAction,setSavingAction]=useState("");
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "viewer",
    avatarColor: "#6957df",
    avatarIcon: "user",
    financeAccess:true,
    permissions:{},
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
        financeAccess:true,
        permissions:{},
      });
      setNotice("המשתמש נוצר");
      loadUsers();
      if (typeof onChanged === "function") onChanged();
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
      if (typeof onChanged === "function") onChanged(result.user);
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
      if (typeof onChanged === "function") onChanged(result.user);
      setNotice("תמונת המשתמש עודכנה");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const removeAvatar = async (id) => {
    try {
      await api(`/users/${id}/avatar`, { method: "DELETE" });
      loadUsers();
      if (typeof onChanged === "function") onChanged();
      setNotice("תמונת המשתמש הוסרה");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const deleteUser = async (item) => {
    if (!window.confirm(`למחוק את המשתמש "${item.displayName}"?`)) return;
    try {
      await api(`/users/${item.id}`, { method: "DELETE" });
      loadUsers();
      if (typeof onChanged === "function") onChanged();
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
    if (!window.confirm(`לאחד את "${secondary?.displayName}" אל הזהות הראשית "${primary?.displayName}"? מעכשיו תוצג זהות אחת וניתן יהיה להיכנס אליה גם דרך Web וגם דרך Home Assistant.`)) return;
    setLinkingIdentity(true);
    try {
      await api('/users/merge-identities',{ method:'POST',body:JSON.stringify(identityLink) });
      setIdentityLink({ primaryUserId:"",secondaryUserId:"" });
      await loadUsers();
      if (typeof onChanged === "function") onChanged();
      setNotice("הזהויות אוחדו בהצלחה לחשבון אחד");
    } catch (error) { setNotice(error.message); } finally { setLinkingIdentity(false); }
  };
  const openPasswordReset = (itemId) => setPasswordActions((state)=>({
    ...state,
    [itemId]: { ...(state[itemId] || { newPassword:"", requirePasswordChange:true, generatedPassword:"" }), open: true },
  }));
  const updatePasswordAction = (itemId, patch) => setPasswordActions((state)=>({
    ...state,
    [itemId]: { ...(state[itemId] || { newPassword:"", requirePasswordChange:true, open:true, generatedPassword:"" }), ...patch },
  }));
  const closePasswordReset = (itemId) => setPasswordActions((state)=>({
    ...state,
    [itemId]: { ...(state[itemId] || {}), open:false, newPassword:"", generatedPassword:"" },
  }));
  const randomPassword = () => {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const symbols = "!@#$%^&*";
    const all = `${upper}${lower}${digits}${symbols}`;
    const pick = (set) => set[Math.floor(Math.random() * set.length)];
    const created = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    for (let index = 0; index < 12; index += 1) created.push(pick(all));
    return created.sort(() => Math.random() - 0.5).join("");
  };
  const hasStrongPassword = (value) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
  const resetUserPassword = async (itemId) => {
    const state = passwordActions[itemId] || {};
    const requestedPassword = String(state.newPassword || "").trim();
    const finalPassword = requestedPassword || randomPassword();
    if (!hasStrongPassword(finalPassword)) return setNotice("Password must contain at least 12 characters, upper and lower case letters, and a number");
    setSavingAction(`reset:${itemId}`);
    try {
      const result = await api(`/users/${itemId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({
          newPassword: requestedPassword || "",
          requirePasswordChange: state.requirePasswordChange !== false,
          unlockAccount: true,
        }),
      });
      setPasswordActions((current) => ({
        ...current,
        [itemId]: { ...(current[itemId] || {}), newPassword:"", generatedPassword: requestedPassword ? "" : (result.generatedPassword || finalPassword), open: true, requirePasswordChange: true },
      }));
      loadUsers();
      if (typeof onChanged === "function") onChanged(result.user);
      setNotice("סיסמת משתמש עודכנה בהצלחה");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSavingAction("");
    }
  };
  const unlockUser = async (item) => {
    if (!window.confirm(`לשחרר נעילה של \"${item.displayName}\"?`)) return;
    setSavingAction(`unlock:${item.id}`);
    try {
      const result = await api(`/users/${item.id}/unlock`, { method: "POST" });
      loadUsers();
      if (typeof onChanged === "function") onChanged(result.user);
      setNotice("נעילת המשתמש שוחררה");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSavingAction("");
    }
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
      <nav className="users-tabs" aria-label="ניהול משתמשים">
        <button type="button" className={activeTab === "accounts" ? "active" : ""} onClick={() => setActiveTab("accounts")}>משתמשים</button>
        <button type="button" className={activeTab === "create" ? "active" : ""} onClick={() => setActiveTab("create")}><Plus size={16} /> יצירת משתמש</button>
        <button type="button" className={activeTab === "identities" ? "active" : ""} onClick={() => setActiveTab("identities")}>איחוד זהויות</button>
      </nav>
      {activeTab === "accounts" && <div className="users-layout">
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
            <article className="admin-user-row" key={item.id}>
              <div className="admin-user-identity">
                <div
                  className={`avatar user-photo-avatar ${item.avatarImage ? "has-photo" : ""}`}
                  style={{ background: item.avatarColor, color: "#fff", "--avatar-color": item.avatarColor }}
                >
                  {avatarGlyph(item)}
                </div>
                <div className="admin-user-details">
                  <strong>{item.displayName}</strong>
                  <span>
                    {item.identityTypes?.includes('web') ? `Web: ${item.username}` : "ללא כניסת Web"}{" "}
                    {item.identityTypes?.includes('ingress') && "· Home Assistant Ingress"}
                  </span>
                  <small className={item.online ? "user-online" : "user-offline"}>{item.online ? "מחובר כעת" : item.lastSeenAt ? `נראה לאחרונה ${new Date(item.lastSeenAt).toLocaleString("he-IL")}` : "טרם התחבר"}</small>
                  <small className="user-last-login">התחברות אחרונה: {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString("he-IL") : "טרם התחבר"}</small>
                </div>
                <div className="admin-user-glance">
                  <span className="admin-role-badge">{roleLabels[item.role]}</span>
                  <span className={item.financeAccess !== false ? "admin-finance-badge allowed" : "admin-finance-badge blocked"}>
                    {item.financeAccess !== false ? "כספים גלויים" : "כספים מוסתרים"}
                  </span>
                  {item.isLocked ? <span className="admin-lock-badge">ננעל</span> : null}
                  <label className="admin-switch" title={item.active ? "החשבון פעיל" : "החשבון מושבת"}>
                    <input type="checkbox" checked={item.active} disabled={item.username==='admin'} onChange={(e) => updateUser(item.id, { active: e.target.checked })} />
                    <span aria-hidden="true" />
                    <b>{item.active ? "פעיל" : "מושבת"}</b>
                  </label>
                </div>
              </div>
              <details className="admin-user-settings">
                <summary><span>עריכת משתמש והרשאות</span><ChevronDown size={16} /></summary>
                <div className="admin-user-controls">
                  <div className="admin-password-action">
                    <button
                      type="button"
                      className="admin-secondary-action"
                      onClick={() => openPasswordReset(item.id)}
                    >
                      <KeyRound size={15} />
                      <span>איפוס סיסמה</span>
                    </button>
                    {item.isLocked ? (
                      <button
                        type="button"
                        className="admin-secondary-action"
                        onClick={() => unlockUser(item)}
                        disabled={savingAction === `unlock:${item.id}`}
                      >
                        <Unlock size={15} />
                        <span>{savingAction === `unlock:${item.id}` ? "פועל..." : "שחרור נעילה"}</span>
                      </button>
                    ) : null}
                  </div>
                  <label className="user-control-field admin-icon-field">
                    <span>תפקיד והרשאה</span>
                    <select value={item.role} disabled={item.username==='admin'} onChange={(e) => updateUser(item.id, { role: e.target.value })}>
                      {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="admin-checkbox-option" title="שליטה נפרדת בחשיפת נתונים כספיים">
                    <input type="checkbox" checked={item.financeAccess !== false} disabled={item.username==='admin'} onChange={(event) => updateUser(item.id, { financeAccess: event.target.checked })} />
                    <span><b>גישה לנתונים כספיים</b><small>{item.financeAccess !== false ? "מוצגים למשתמש" : "מוסתרים מהמשתמש"}</small></span>
                  </label>
                  <label className="user-control-field user-color-field">
                    <span>צבע משתמש</span>
                    <input aria-label="צבע משתמש" type="color" value={item.avatarColor} onChange={(e) => updateUser(item.id, { avatarColor: e.target.value })} />
                  </label>
                  <label className="user-control-field">
                    <span>אייקון</span>
                    <select aria-label="אייקון משתמש" value={item.avatarIcon} onChange={(e) => updateUser(item.id, { avatarIcon: e.target.value })}>
                      {Object.entries(avatarIcons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="admin-photo-upload" title="העלאת תמונת משתמש">
                    <Upload size={15} /><span>{item.avatarImage ? "החלפת תמונה" : "העלאת תמונה"}</span>
                    <input type="file" accept="image/*" onChange={(event) => { uploadAvatar(item.id, event.target.files?.[0]); event.target.value = ""; }} />
                  </label>
                  {item.avatarImage && <button type="button" className="admin-secondary-action" onClick={() => removeAvatar(item.id)}>הסרת תמונה</button>}
                  <button type="button" className="admin-delete-action" disabled={item.username==='admin'||String(item.id) === String(currentUser.id)} onClick={() => deleteUser(item)} title={item.username==='admin'?'משתמש ADMIN מוגן ואינו ניתן למחיקה':'מחיקת משתמש'}><Trash2 size={15} /><span>מחיקה</span></button>
                  {passwordActions[item.id]?.open ? (
                    <div className="admin-password-editor">
                      <h5>איפוס סיסמה למשתמש</h5>
                      <label className="user-control-field admin-icon-field">
                        <span>סיסמה חדשה</span>
                        <input
                          type="password"
                          dir="ltr"
                          value={passwordActions[item.id]?.newPassword || ""}
                          onChange={(event) => updatePasswordAction(item.id, { newPassword: event.target.value })}
                          placeholder="השאר ריק ליצירת סיסמה אקראית"
                        />
                      </label>
                      <div className="admin-password-inline">
                        <label className="admin-checkbox-option">
                          <input
                            type="checkbox"
                            checked={passwordActions[item.id]?.requirePasswordChange !== false}
                            onChange={(event) => updatePasswordAction(item.id, { requirePasswordChange: event.target.checked })}
                          />
                          <span>דרוש שינוי סיסמה בכניסה הבאה</span>
                        </label>
                        <button
                          type="button"
                          className="admin-secondary-action"
                          onClick={() => updatePasswordAction(item.id, { newPassword: randomPassword() })}
                        >
                          יצירת סיסמה
                        </button>
                      </div>
                      <div className="admin-password-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => resetUserPassword(item.id)}
                          disabled={savingAction === `reset:${item.id}`}
                        >
                          {savingAction === `reset:${item.id}` ? "שומר..." : "שמירת סיסמה"}
                        </button>
                        <button
                          type="button"
                          className="admin-secondary-action"
                          onClick={() => closePasswordReset(item.id)}
                        >
                          ביטול
                        </button>
                      </div>
                      {passwordActions[item.id]?.generatedPassword ? (
                        <p className="admin-generated-password">
                          סיסמה זמנית: <strong>{passwordActions[item.id]?.generatedPassword}</strong> (שמור במקום בטוח)
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {item.role === "custom" && <details className="user-permissions"><summary>הרשאות מפורטות</summary><PermissionMatrix value={item.permissions} onChange={(permissions) => updateUser(item.id, { permissions })} /></details>}
              </details>
            </article>
          ))}
        </div>
      </div>}
      {activeTab === "create" &&
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
              minLength="12"
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
          <label className="finance-access-toggle"><input type="checkbox" checked={form.financeAccess} onChange={(event)=>setForm({...form,financeAccess:event.target.checked})}/>אפשר צפייה בכספים</label>
          {form.role==="custom"&&<PermissionMatrix value={form.permissions} onChange={(permissions)=>setForm({...form,permissions})}/>}
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
      }
      {activeTab === "identities" && users.length > 1 && <form className="panel identity-linker" onSubmit={mergeIdentities}>
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
  useEffect(() => {
    loadBackups();
  }, []);
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

function Dashboard({ api, projects, openProject, setPage, insights, insightsRefreshing, onRefreshInsights, user }) {
  const [insightsOpen,setInsightsOpen]=useState(false);
  const [insightsBusy,setInsightsBusy]=useState(false);
  const active = projects.filter((p) => p.stage !== "completed");
  const smartHomeCount=active.filter((project)=>project.projectCategory!=='other').length;
  const otherCount=active.length-smartHomeCount;
  const canViewFinance = userCanAccess(user,"finance");
  const value = canViewFinance ? active.reduce((sum, p) => sum + p.value, 0) : 0;
  const unpaid = canViewFinance ? active.reduce((sum, p) => sum + (p.value - p.paid), 0) : 0;
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
  const cashData = canViewFinance ? active.map((project,index) => ({
      id:project.id,
      projectName: project.name,
      paid: Math.round(project.paid / 1000),
      expected: Math.round(project.value / 1000),
      color:`hsl(${Math.round((index*137.508+258)%360)} 68% 52%)`,
    })) : [];
  const generateInsights=async()=>{setInsightsBusy(true);try{await onRefreshInsights?.();setInsightsOpen(true)}finally{setInsightsBusy(false)}};
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
          <button className="dashboard-ai-button" onClick={generateInsights} disabled={insightsBusy||insightsRefreshing}><Sparkles size={18}/><span>{insightsBusy||insightsRefreshing?'מפיק תובנות…':'הפק תובנות'}</span></button>
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
          change={`${smartHomeCount} בית חכם · ${otherCount} אחרים`}
          onClick={() => setPage("projects")}
        />
        {canViewFinance && <KpiCard
          icon={TrendingUp}
          tone="blue"
          label="היקף פרויקטים פעילים"
          value={compactMoney(value)}
          change="לפי שווי החוזים המעודכן"
          onClick={() => setPage("projects")}
        />}
        <KpiCard
          icon={Gauge}
          tone="green"
          label="התקדמות ממוצעת"
          value={`${avg}%`}
          change={`ממוצע של ${active.length} פרויקטים פעילים`}
          onClick={() => setPage("projects")}
        />
        {canViewFinance && <KpiCard
          icon={CircleDollarSign}
          tone="orange"
          label="יתרה פתוחה לגבייה"
          value={compactMoney(unpaid)}
          change={`${active.filter((p) => Number(p.paid) < Number(p.value)).length} פרויקטים עם יתרה`}
          alert
          onClick={() => setPage("finance")}
        />}
      </section>
      <RiskCenter api={api} projects={projects} openProject={openProject}/>
      <section className="dashboard-grid top">
        {projects.some((p) => p.flag) && <div className="panel portfolio-panel">
          <PanelHead
            title="פרויקטים שדורשים תשומת לב"
            subtitle={canViewFinance ? "לפי סיכון, חריגה ותשלומים" : "לפי סיכון וחריגה תפעולית"}
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
        </div>}
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
        {canViewFinance && <div className="panel cash-panel">
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
          <div className="cash-chart-scroll"><div style={{minWidth:`${Math.max(640,cashData.length*112)}px`}}><ResponsiveContainer width="100%" height={270}>
            <BarChart data={cashData} barGap={5}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#edf0f6"
              />
              <XAxis
                dataKey="projectName"
                interval={0}
                height={56}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8b93a7", fontSize: 12 }}
                tickFormatter={(label)=>String(label).length>16?`${String(label).slice(0,16)}…`:label}
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
                labelFormatter={(label) => `פרויקט ${label}`}
                contentStyle={{ direction: "rtl", textAlign: "right" }}
              />
              <Bar dataKey="expected" radius={[6, 6, 0, 0]}>{cashData.map((entry)=><Cell key={`expected-${entry.id}`} fill={entry.color} fillOpacity={0.18}/>)}</Bar>
              <Bar dataKey="paid" radius={[6, 6, 0, 0]}>{cashData.map((entry)=><Cell key={`paid-${entry.id}`} fill={entry.color}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer></div></div>
        </div>}
        <div className="panel milestones-panel">
          <PanelHead
            title="משימות קרובות"
            subtitle="המשימה הבאה בכל פרויקט פעיל"
            action="ללוח השנה"
            onAction={() => setPage("calendar")}
          />
          <div className="milestone-list">
            {upcomingMilestones.map((item, index) => {
              const taskDate=String(item.nextTaskDate||item.due||'').slice(0,10);const dueParts=taskDate?/^\d{4}-\d{2}-\d{2}$/.test(taskDate)?new Date(`${taskDate}T00:00:00`).toLocaleDateString('he-IL').split('.'):taskDate.split('.'):[];
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
                      {item.nextTaskTitle || item.nextMilestone || "טרם הוגדרה משימה"}
                    </strong>
                    <span>{item.name}{item.nextTaskAssignee?` · ${item.nextTaskAssignee}`:''}</span>
                  </div>
                  {item.health < 70 && <em>בסיכון</em>}
                  <MoreHorizontal size={18} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {insightsOpen&&<AppModal title="תובנות ניהוליות" subtitle="ניתוח עדכני של נתוני PROJECTS" className="dashboard-insights-modal" onClose={()=>setInsightsOpen(false)}><div className="dashboard-insights-list">{(insights?.suggestions||[]).slice(0,5).map((item,index)=><button key={`${item.title}-${index}`} className={item.tone||'info'} onClick={()=>{setInsightsOpen(false);setPage(item.target)}}><span><Sparkles size={17}/></span><div><strong>{item.title}</strong><p>{item.text}</p></div><ChevronLeft size={17}/></button>)}{!(insights?.suggestions||[]).length&&<div className="inline-empty">לא נמצאו כרגע תובנות הדורשות פעולה.</div>}</div></AppModal>}
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
  const canViewFinance=userCanAccess(user,"finance");
  const [view, setView] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [projectScope,setProjectScope]=useState("active");
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteForm, setDeleteForm] = useState({ confirmation: "", password: "" });
  const [deleting, setDeleting] = useState(false);
  const [manager, setManager] = useState("");
  const [priority, setPriority] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [category,setCategory]=useState("all");
  const [projectSort, setProjectSort] = useState({ key:"name", direction:"asc" });
  const switchArchive = async (scope) => {
    const archived=scope==="archived";
    setProjectScope(scope);
    setShowArchived(archived);
    setStageFilter("all");
    if (scope==="active") return;
    setArchiveLoading(true);
    try {
      const result = await api(`/projects?scope=${scope}`);
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
  const sourceProjects = projectScope!=="active"
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
      (category==="all"||(category==="smart_home"?project.projectCategory!=="other":project.projectCategory==="other")) &&
      (!flagged || project.flag),
  );
  const visibleProjects = useMemo(() => {
    const stageOrder=Object.keys(stageMeta);
    const contractorOrder=['waiting','infrastructure_paving','drywall_paint','carpentry','finishing','stopped'];
    const value=(project,key)=>key==="name"?(project.name||""):key==="stage"?stageOrder.indexOf(project.stage):key==="contractor"?contractorOrder.indexOf(project.contractorProgress||'waiting'):key==="progress"?Number(project.progress||0):key==="manager"?(project.manager||""):key==="milestone"?new Date(project.due||"9999-12-31").getTime():key==="balance"&&canViewFinance?Number(project.value||0)-Number(project.paid||0):"";
    const direction=projectSort.direction==="asc"?1:-1;
    return [...filteredProjects].sort((a,b)=>{const left=value(a,projectSort.key),right=value(b,projectSort.key);return (typeof left==="string"?left.localeCompare(right,"he"):(left-right))*direction;});
  },[filteredProjects,projectSort,canViewFinance]);
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
          <h2>{projectScope==="archived" ? "ארכיון פרויקטים" : projectScope==="completed" ? "פרויקטים שהסתיימו" : "כל הפרויקטים"}</h2>
          <p>
            {showArchived
              ? "פרויקטים שהסתיימו נשמרים כאן וניתנים לשחזור מלא"
              : `ניהול, מעקב ובקרה של ${visibleProjects.length} פרויקטים בתצוגה הנוכחית`}
          </p>
        </div>
        <div className="project-page-actions">
          <div className="archive-switch">
            <button
              className={projectScope==="active" ? "active" : ""}
              onClick={() => switchArchive("active")}
            >
              פעילים
            </button>
            <button className={projectScope==="completed"?"active":""} onClick={()=>switchArchive("completed")}><CheckCircle2 size={16}/>הסתיימו</button>
            <button
              className={projectScope==="archived" ? "active" : ""}
              onClick={() => switchArchive("archived")}
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
        <div className="project-category-filter"><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>הכל</button><button className={category==='smart_home'?'active':''} onClick={()=>setCategory('smart_home')}>בית חכם</button><button className={category==='other'?'active':''} onClick={()=>setCategory('other')}>אחרים</button></div>
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
              setCategory("all");
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
                <th><button className={projectSort.key==="contractor"?"active":""} onClick={()=>toggleProjectSort("contractor")}>התקדמות קבלן<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="progress"?"active":""} onClick={()=>toggleProjectSort("progress")}>התקדמות<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="manager"?"active":""} onClick={()=>toggleProjectSort("manager")}>מנהל פרויקט<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="milestone"?"active":""} onClick={()=>toggleProjectSort("milestone")}>משימה הבאה<ArrowUpDown size={13}/></button></th>
                {canViewFinance&&<th><button className={projectSort.key==="balance"?"active":""} onClick={()=>toggleProjectSort("balance")}>יתרה לגבייה<ArrowUpDown size={13}/></button></th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project) => (
                <tr key={project.id} onClick={() => openProject(project)}>
                  <td>
                    <div className="project-cell">
                      <div className="project-thumb" style={{background:`${project.projectColor||'#6957df'}18`,color:project.projectColor||'#6957df'}}>
                        <Home size={18} />
                      </div>
                      <div>
                        <strong>{project.name}</strong>
                        <span>
                          {project.location} · {projectCategoryText(project)} · {projectClassificationLabels[project.projectClassification] || "בית פרטי"}
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
                  <td><span className={`contractor-progress-chip contractor-${project.contractorProgress || "waiting"}`}>{contractorProgressLabels[project.contractorProgress] || "בהמתנה"}</span></td>
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
                      <span style={{background:project.managerAvatarColor||'#6957df'}}><b>{project.ownerInitials||project.manager?.slice(0,2)}</b>{project.managerUserId&&<img src={`${apiRoot}/users/${project.managerUserId}/avatar`} alt="" onError={(event)=>{event.currentTarget.style.display='none'}}/>}</span>
                      {project.manager || "לא הוקצה"}
                    </div>
                  </td>
                  <td>
                    <div className="milestone-cell">
                      <strong>{project.nextTaskTitle || project.nextMilestone || "לא הוגדרה משימה"}</strong>
                      <span>
                        <CalendarDays size={13} />
                        {project.nextTaskDate ? new Date(`${String(project.nextTaskDate).slice(0,10)}T00:00:00`).toLocaleDateString('he-IL') : project.due || "ללא תאריך"}{project.nextTaskAssignee?` · ${project.nextTaskAssignee}`:''}
                      </span>
                    </div>
                  </td>
                  {canViewFinance&&<td>
                    <strong className="money-cell">
                      {money.format(project.value - project.paid)}
                    </strong>
                  </td>}
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
                    <em>{projectCategoryText(project)} · {projectClassificationLabels[project.projectClassification] || "בית פרטי"}</em>
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
  const [navigationTarget,setNavigationTarget]=useState(null);
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
              <button className="open-project navigation" onClick={()=>setNavigationTarget(selected)}><MapPin size={17}/>נווט ליעד</button>
            </div>
          )}
        </div>
      </div>
      {navigationTarget&&<AppModal title="בחירת אפליקציית ניווט" subtitle={navigationTarget.address||navigationTarget.location} className="navigation-selector-modal" onClose={()=>setNavigationTarget(null)}><div className="navigation-selector-body"><div className="navigation-provider-list">{NAVIGATION_OPTIONS.map((option)=><button type="button" className="navigation-provider" key={option.key} onClick={()=>{openNavigation(navigationTarget,option.key);setNavigationTarget(null)}}><span className="navigation-provider-icon" style={{background:option.color}}>{option.icon}</span><span>{option.label}</span></button>)}</div></div></AppModal>}
    </div>
  );
  useEffect(()=>{let disposed=false;offlineStatus().then(value=>!disposed&&setOfflineState(value));const changed=event=>setOfflineState(current=>({...current,...event.detail}));window.addEventListener("projects:offline-status",changed);return()=>{disposed=true;window.removeEventListener("projects:offline-status",changed)}},[]);
  useEffect(()=>{if(!user?.id)return;return initializeOfflineSync(apiRoot)},[user?.id]);
}

function offlineActionLabel(path,method){const action=method==='PATCH'?'עדכון':'יצירה';if(path.includes('/tasks'))return `${action} משימה`;if(path.includes('/time-entries'))return `${action} דיווח שעות`;if(path.includes('/site-reviews'))return `${action} ביקורת אתר`;if(path.includes('/meetings'))return `${action} סיכום פגישה`;if(path.includes('/updates'))return `${action} עדכון לפרויקט`;if(path==='/messages')return 'שליחת הודעה פנימית';if(path==='/documents')return 'העלאת תמונה או מסמך';if(path.includes('/form-records'))return `${action} טופס`;return 'עדכון נתונים'}

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
          <h2>מסמכים והקלטות</h2>
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
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [defaultNavigationProvider, setDefaultNavigationProvider] = useState(() =>
    readNavigationProvider(),
  );
  const [rememberNavigation, setRememberNavigation] = useState(false);
  const projectMilestones = [
    { title: "אפיון וחתימת חוזה", status: "done", date: "12.03.2026" },
    { title: "אישור תוכניות ביצוע", status: "done", date: "28.05.2026" },
    { title: project.nextMilestone, status: "current", date: project.due },
    { title: "תכנות, בדיקות ותרחישים", status: "future", date: "08.09.2026" },
    { title: "מסירה והדרכת לקוח", status: "future", date: "22.09.2026" },
  ];
  const requestNavigation = (nextProject = project) => {
    if (!nextProject?.address && !nextProject?.location && !nextProject?.name) {
      return;
    }
    setNavigationTarget(nextProject);
  };

  const selectNavigationProvider = (providerKey) => {
    if (!navigationTarget) return;
    if (rememberNavigation) {
      setDefaultNavigationProvider(providerKey);
      saveNavigationProvider(providerKey);
    }
    openNavigation(navigationTarget, providerKey);
    setNavigationTarget(null);
    setRememberNavigation(false);
  };
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
              <button
                type="button"
                className="primary-button project-nav-button"
                onClick={() => requestNavigation(project)}
                disabled={!project.address && !project.location && !project.lat && !project.lng}
              >
                <MapPin size={18} />
                ניווט ליעד
              </button>
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
      {navigationTarget && (
        <AppModal
          title="בחירת אפליקציית ניווט"
          subtitle="בחרו אפליקציה לניווט ליעד"
          className="navigation-selector-modal"
          onClose={() => setNavigationTarget(null)}
        >
          <div className="navigation-selector-body">
            <div className="navigation-provider-list">
              {NAVIGATION_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={`navigation-provider ${defaultNavigationProvider === option.key ? "active" : ""}`}
                  key={option.key}
                  onClick={() => selectNavigationProvider(option.key)}
                >
                  <span
                    className="navigation-provider-icon"
                    style={{ background: option.color }}
                  >
                    {option.icon}
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <label className="navigation-remember">
              <input
                type="checkbox"
                checked={rememberNavigation}
                onChange={(event) => setRememberNavigation(event.target.checked)}
              />
              תמיד להשתמש באפליקציה הנבחרת
            </label>
          </div>
        </AppModal>
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
  user,
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
    projectCategory:"smart_home",projectCategoryCustom:"",projectProfile:{workflowLabel:"",systemsLabel:"",areasLabel:""},
    projectIcon: "home",
    projectColor: "#6957df",
    managerId: managers[0]?.id || "",
    installationLeadId: "",
    stage: stageOptions[0]?.metadata?.key || "planning",
    value: "",
    installationHoursTarget: "",
    programmingHoursTarget: "",
    startDate: localDateValue(),
    targetDate: "",
    selectedEquipment: {},
    templateId: "",
    financeEnabled: false,
    financeMode: "total",
    paymentTerms: "",
    depositAmount: "",
    depositPaid: false,
    systemBudgets: {},
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
      projectCategory:form.projectCategory,projectCategoryCustom:form.projectCategory==='other'?form.projectCategoryCustom:"",projectProfile:form.projectCategory==='other'?form.projectProfile:{},
      projectIcon:form.projectIcon,
      projectColor:form.projectColor,
      address: client?.address || form.clientAddress || form.location,
      lat: 32.08,
      lng: 34.82,
      stage: form.stage,
      progress: 0,
      managerId: manager?.id || null,
      manager: manager?.displayName || "",
      installationLeadId:form.installationLeadId||null,
      ownerInitials: manager?.displayName?.slice(0, 2) || "",
      value:form.financeEnabled&&form.financeMode==="systems"?equipmentItems.reduce((sum,{id})=>sum+(Number(form.systemBudgets[id])||0),0):Number(form.value)||0,
      financeMode:form.financeEnabled?form.financeMode:"total",
      paymentTerms:form.financeEnabled?form.paymentTerms:"",
      depositAmount:form.financeEnabled?Number(form.depositAmount)||0:0,
      depositPaid:form.financeEnabled&&form.depositPaid,
      financeBreakdown:form.financeEnabled&&form.financeMode==="systems"?equipmentItems.map(({id})=>({name:equipment.find(item=>Number(item.id)===id)?.name||String(id),amount:Number(form.systemBudgets[id])||0})):[],
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
            <label>תחום הפרויקט<select value={form.projectCategory} onChange={(event)=>setForm({...form,projectCategory:event.target.value})}><option value="smart_home">בית חכם</option><option value="other">אחר</option></select></label>
            {form.projectCategory==='other'&&<><label>סוג פרויקט חופשי<input required value={form.projectCategoryCustom} onChange={(event)=>setForm({...form,projectCategoryCustom:event.target.value})} placeholder="לדוגמה: מרכז הדרכה"/></label><div className="wide project-profile-fields"><label>שם תהליך עבודה<input value={form.projectProfile.workflowLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,workflowLabel:event.target.value}})} placeholder="אופציונלי"/></label><label>שם אזור המערכות<input value={form.projectProfile.systemsLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,systemsLabel:event.target.value}})} placeholder="אופציונלי"/></label><label>שם אזורי העבודה<input value={form.projectProfile.areasLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,areasLabel:event.target.value}})} placeholder="אופציונלי"/></label></div></>}
            {form.projectCategory==='smart_home'&&<label>
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
            </label>}
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
              <label>תחום הפרויקט<select value={form.projectCategory} onChange={(event)=>setForm({...form,projectCategory:event.target.value})}><option value="smart_home">בית חכם</option><option value="other">אחר</option></select></label>
              {form.projectCategory==='other'&&<><label>סוג פרויקט חופשי<input required value={form.projectCategoryCustom} onChange={(event)=>setForm({...form,projectCategoryCustom:event.target.value})} placeholder="לדוגמה: מרכז הדרכה"/></label><div className="wide project-profile-fields"><label>שם תהליך עבודה<input value={form.projectProfile.workflowLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,workflowLabel:event.target.value}})}/></label><label>שם אזור המערכות<input value={form.projectProfile.systemsLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,systemsLabel:event.target.value}})}/></label><label>שם אזורי העבודה<input value={form.projectProfile.areasLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,areasLabel:event.target.value}})}/></label></div></>}
              {form.projectCategory==='smart_home'&&<label>
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
              </label>}
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
              <div className="form-row">
                <label>אייקון מוביל<select value={form.projectIcon} onChange={(event)=>setForm({...form,projectIcon:event.target.value})}><option value="home">בית פרטי</option><option value="villa">וילה</option><option value="cottage">קוטג׳</option><option value="building">בניין משותף</option><option value="penthouse">פנטהאוז</option><option value="studio">סטודיו</option></select></label>
                <label>צבע מוביל<input type="color" value={form.projectColor} onChange={(event)=>setForm({...form,projectColor:event.target.value})}/></label>
                <label>ראש צוות התקנה<select value={form.installationLeadId} onChange={(event)=>setForm({...form,installationLeadId:event.target.value})}><option value="">ללא הקצאה</option>{professionals.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
              </div>
              {user.financeAccess!==false&&<label>
                שווי משוער
                <input
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="₪ 0"
                />
              </label>}
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
              {user.financeAccess!==false&&<fieldset className="project-finance-wizard">
                <legend><label className="finance-paid-check"><input type="checkbox" checked={form.financeEnabled} onChange={(event)=>setForm({...form,financeEnabled:event.target.checked})}/>הפעלת אשף כספים אופציונלי</label></legend>
                {form.financeEnabled&&<><label>אופן תקצוב<select value={form.financeMode} onChange={(event)=>setForm({...form,financeMode:event.target.value})}><option value="total">סכום כללי</option><option value="systems">סכום מפוצל לכל מערכת</option></select></label><label>תנאי תשלום<input value={form.paymentTerms} onChange={(event)=>setForm({...form,paymentTerms:event.target.value})} placeholder="לדוגמה: 30% מקדמה, יתרה לפי אבני דרך"/></label><label>מקדמה<input type="number" min="0" step="0.01" value={form.depositAmount} onChange={(event)=>setForm({...form,depositAmount:event.target.value})}/></label><label className="finance-paid-check"><input type="checkbox" checked={form.depositPaid} onChange={(event)=>setForm({...form,depositPaid:event.target.checked})}/>המקדמה שולמה</label></>}
              </fieldset>}
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
                          {form.financeEnabled&&form.financeMode==="systems"&&Number(form.selectedEquipment[item.id])>0&&<input type="number" min="0" step="0.01" placeholder="סכום למערכת" value={form.systemBudgets[item.id]||""} onChange={(event)=>setForm({...form,systemBudgets:{...form.systemBudgets,[item.id]:event.target.value}})}/>}
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




