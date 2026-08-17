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
  InsightsTile,
  OperationalSettings,
} from "./Operational";
import { FormsWorkspace } from "./FormsWorkspace";
import { MasterDataWorkspace } from "./MasterDataWorkspace";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { AppModal, ModalPortal } from "./AppModal";
import packageJson from "../package.json";
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
  ["private_house", "×‘×™×ª ×¤×¨×˜×™"],
  ["villa", "×•×™×œ×”"],
  ["cottage", "×§×•×˜×’×³"],
  ["penthouse", "×¤× ×˜×”××•×–"],
  ["apartment_building", "×‘× ×™×™×Ÿ ×ž×©×•×ª×£"],
  ["studio", "×¡×˜×•×“×™×•"],
  ["duplex", "×“×•×¤×œ×§×¡"],
];
const projectClassificationLabels = Object.fromEntries(projectClassificationOptions);
const projectCategoryText=(project)=>project.projectCategory==='other'?(project.projectCategoryCustom||'××—×¨'):'×‘×™×ª ×—×›×';
const contractorProgressLabels = {
  finishing: "×¢×‘×•×“×•×ª ×’×ž×¨", carpentry: "×”×¨×›×‘×•×ª × ×’×¨×•×ª", waiting: "×‘×”×ž×ª× ×”",
  infrastructure: "×¡×œ×™×œ×ª ×ª×©×ª×™×•×ª", infrastructure_paving: "×¡×œ×™×œ×ª ×ª×©×ª×™×•×ª", drywall_paint: "×¢×‘×•×“×•×ª ×’×‘×¡ ×•×¦×‘×¢", stopped: "×‘×¢×¦×™×¨×”",
};

const PROJECT_NAVIGATION_PROVIDER_KEY = "projects_navigation_provider_v1";
const NAVIGATION_OPTIONS = [
  { key: "google", label: "Google Maps", icon: "G", color: "#1A73E8" },
  { key: "apple", label: "Apple Maps", icon: "ï£¿", color: "#111111" },
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
import "./theme-dark.css";
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
import projectsMark from "./assets/projects-mark.svg";

const money = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const compactMoney = (value) =>
  value >= 1000000
    ? `â‚ª${(value / 1000000).toFixed(2)}M`
    : `â‚ª${Math.round(value / 1000)}K`;
const actionNamesForDashboard = {
  create: "×™×¦×¨ ×¨×©×•×ž×”",
  update: "×¢×“×›×Ÿ ×¨×©×•×ž×”",
  delete: "×ž×—×§ ×¨×©×•×ž×”",
  archive: "×”×¢×‘×™×¨ ×œ××¨×›×™×•×Ÿ",
  restore: "×©×—×–×¨ ×ž×”××¨×›×™×•×Ÿ",
  upload: "×”×¢×œ×” ×§×•×‘×¥",
  login: "× ×›× ×¡ ×œ×ž×¢×¨×›×ª",
  logout: "×™×¦× ×ž×”×ž×¢×¨×›×ª",
  snooze: "×“×—×” ×”×ª×¨××”",
  backup: "×™×¦×¨ ×’×™×‘×•×™",
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
        <h2>×”×ž×¡×š × ×ª×§×œ ×‘×ª×§×œ×” × ×§×•×“×ª×™×ª</h2>
        <p>×©××¨ ×”×ž×¢×¨×›×ª ×ž×ž×©×™×›×” ×œ×¤×¢×•×œ. ××¤×©×¨ ×œ× ×¡×•×ª ×œ×¤×ª×•×— ×ž×—×“×© ××ª ×”×ž×¡×š ×‘×œ×™ ×œ×¨×¢× ×Ÿ ××ª ×›×œ ×”××¤×œ×™×§×¦×™×”.</p>
        <button type="button" className="primary-button" onClick={() => this.setState({ error: null })}>×¤×ª×™×—×” ×ž×—×“×©</button>
        <details><summary>×¤×¨×˜×™ ×ª×§×œ×”</summary><code>{String(this.state.error?.message || "Unknown UI error")}</code></details>
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
      body?.error || `×”×‘×§×©×” × ×›×©×œ×” (HTTP ${response.status})`,
    );
    error.status = response.status;
    error.body = body;
    error.code = body?.code;
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
  { id: "dashboard", label: "×ª×ž×•× ×ª ×ž×¦×‘", icon: LayoutDashboard },
  { id: "my-work", label: "×”×¢×‘×•×“×” ×©×œ×™", icon: CheckCircle2 },
  { id: "calendar", label: "×œ×•×— ×©× ×”", icon: CalendarDays },
  { id: "projects", label: "×¤×¨×•×™×§×˜×™×", icon: FolderKanban },
  { id: "clients", label: "×œ×§×•×—×•×ª", icon: Users },
  { id: "professionals", label: "×× ×©×™ ×ž×§×¦×•×¢", icon: Users },
  { id: "catalog", label: "×ž×¢×¨×›×•×ª ×•×¨×›×™×‘×™×", icon: Database },
  { id: "forms", label: "×ž×¡×ž×›×™× ×•×”×§×œ×˜×•×ª", icon: FormInput },
  { id: "finance", label: "×ª×©×œ×•×ž×™× ×•×’×‘×™×™×”", icon: WalletCards },
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
            ×¤×ª×— ×¤×¨×•×™×§×˜ <ArrowLeft size={14} />
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
      setNotice("×ª×ž×•× ×ª ×”×ž×©×ª×ž×© ×¢×•×“×›× ×” ×‘×¡×¨×’×œ");
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
        else setStartupError(error.message || "×©×¨×ª ×”× ×ª×•× ×™× ××™× ×• ×–×ž×™×Ÿ");
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
      setNotice("×”×ª×™×•×’ ××™× ×• ×›×•×œ×œ ×§×™×©×•×¨ ×œ×¤×¨×•×™×§×˜ ××• ×œ×ž×©×™×ž×”");
      return;
    }
    const target = projects.find((item) => String(item.id) === String(projectId));
    if (!target) {
      setNotice("×”×¤×¨×•×™×§×˜ ×©×ž×ž× ×• × ×©×œ×— ×”×ª×™×•×’ ××™× ×• ×–×ž×™×Ÿ ×™×•×ª×¨");
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
      setNotice("×”×©×™× ×•×™ × ×©×ž×¨ ×‘×”×¦×œ×—×”");
      return project;
    } catch (error) {
      if (error.code === "COLLECTION_STAGE_WARNING" && window.confirm(`${error.message}\n\n×”×× ×œ×¢×‘×•×¨ ×©×œ×‘ ×‘×›×œ ×–××ª?`)) {
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
          ? "×”×¤×¨×•×™×§×˜ ×”×•×¢×‘×¨ ×œ××¨×›×™×•×Ÿ"
          : "×”×¤×¨×•×™×§×˜ ×©×•×—×–×¨ ×œ×¨×©×™×ž×ª ×”×¤×¨×•×™×§×˜×™× ×”×¤×¢×™×œ×™×",
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
      setNotice("×”×¤×¨×•×™×§×˜ ×”×—×“×© × ×•×¦×¨");
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
        <span>×˜×•×¢×Ÿ ×ž×¢×¨×›×ª...</span>
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
            type: "×¤×¨×•×™×§×˜",
            title: project.name,
            subtitle: `${project.id} Â· ${project.client || project.location || ""}`,
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
            type: "×œ×§×•×—",
            title: client.name || `${client.firstName || ""} ${client.lastName || ""}`.trim(),
            subtitle: client.mobile || client.phone || client.address || "×¤×ª×™×—×ª ×ž××’×¨ ×”×œ×§×•×—×•×ª",
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
            type: "××™×© ×ž×§×¦×•×¢",
            title: professional.name,
            subtitle: professional.role || professional.company || professional.phone || "×¤×ª×™×—×ª ×ž××’×¨ ×× ×©×™ ×”×ž×§×¦×•×¢",
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
    "my-work": "×”×¢×‘×•×“×” ×©×œ×™",
    control: "×‘×§×¨×ª ×‘×™×¦×•×¢",
    tasks: "×ž×©×™×ž×•×ª ×•××‘× ×™ ×“×¨×š",
    reports: "×“×•×—×•×ª ×•× ×™×ª×•×—×™×",
    users: "×ž×©×ª×ž×©×™× ×•×”×¨×©××•×ª",
    settings: "×”×’×“×¨×•×ª ×•×ž×¢×¨×›×ª",
  };
  const pageTitle =
    selectedProject && page === "project"
      ? selectedProject.name
      : secondaryTitles[page] ||
        nav.find((item) => item.id === page)?.label ||
        "×ª×ž×•× ×ª ×ž×¦×‘";
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
          aria-label="×¡×’×™×¨×ª ×ª×¤×¨×™×˜ ×”× ×™×•×•×˜"
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
            <strong>{company.name || "×”×—×‘×¨×” ×©×œ×™"}</strong>
            <span>×¡×‘×™×‘×ª ×¢×‘×•×“×” ×¨××©×™×ª</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <nav className="main-nav">
          <span className="nav-label">×¡×‘×™×‘×ª ×¢×‘×•×“×”</span>
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
          <span className="nav-label nav-second">× ×™×”×•×œ</span>
          {userCanAccess(user,"tasks")&&<button
            className={page === "tasks" ? "active" : ""}
            onClick={() => {
              setPage("tasks");
              setSidebarOpen(false);
            }}
          >
            <ClipboardCheck size={19} />
            <span>×ž×©×™×ž×•×ª ×•××‘× ×™ ×“×¨×š</span>
            {insights?.stats?.overdue > 0 && <em>{insights.stats.overdue}</em>}
          </button>}
          {userCanAccess(user,"gantt")&&<button className={page === "gantt" ? "active" : ""} onClick={()=>{setPage('gantt');setSidebarOpen(false)}}><Activity size={19}/><span>×œ×•×— ×’×× ×˜</span></button>}
          {userCanAccess(user,"control")&&<button className={page === "control" ? "active" : ""} onClick={()=>{setPage('control');setSidebarOpen(false)}}><Gauge size={19}/><span>×‘×§×¨×ª ×‘×™×¦×•×¢</span></button>}
          {userCanAccess(user,"reports")&&<button
            className={page === "reports" ? "active" : ""}
            onClick={() => {
              setPage("reports");
              setSidebarOpen(false);
            }}
          >
            <Activity size={19} />
            <span>×“×•×—×•×ª ×•× ×™×ª×•×—×™×</span>
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
              {user.role === "admin" ? "×”×’×“×¨×•×ª ×•×ž×¢×¨×›×ª" : "×ž×¨××” ×•×”×¢×“×¤×•×ª"}
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
              title="×”×¢×œ××” ××• ×”×—×œ×¤×” ×©×œ ×ª×ž×•× ×ª ×”×ž×©×ª×ž×©"
            >
              {avatarGlyph(user, true)}
              <span />
              <input type="file" accept="image/*" onChange={(event) => { uploadCurrentUserAvatar(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            <div>
              <strong>{user.displayName}</strong>
              <span>{roleLabels[user.role]}</span>
            </div>
            <button className="logout-button" onClick={logout} title="×™×¦×™××”">
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
                  ? `${selectedProject?.id}  /  ×¤×¨×•×™×§×˜×™×`
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
                  placeholder="×—×™×¤×•×© ×‘×›×œ ×”×ž×¢×¨×›×ª..."
                />
                <kbd>âŒ˜ K</kbd>
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
                  {!globalSearchResults.length && <p>×œ× × ×ž×¦××• ×ª×•×¦××•×ª ×ž×ª××™×ž×•×ª</p>}
                </div>
              )}
            </div>
            <button
              className="icon-button"
              onClick={() => setAlertsOpen(true)}
              title="×”×ª×¨××•×ª"
            >
              <Bell size={20} />
              {insights?.alerts?.length > 0 && <i />}
            </button>
            <button
              className="icon-button task-shortcut-button"
              onClick={() => { setSelectedProject(null); setPage("tasks"); }}
              title="×ž×©×™×ž×•×ª ×¤×ª×•×—×•×ª"
              aria-label={`${openTasksCount} ×ž×©×™×ž×•×ª ×¤×ª×•×—×•×ª`}
            >
              <ClipboardCheck size={20} />
              <em>{openTasksCount > 99 ? "99+" : openTasksCount}</em>
            </button>
            <button className="icon-button ai-chat-button" onClick={() => setAiChatOpen(true)} title="×”×¡×•×›×Ÿ ×”×—×›×">
              <Sparkles size={20} />
            </button>
            <button
              className="icon-button message-button"
              onClick={() => setMessagesOpen(true)}
              title="×”×•×“×¢×•×ª ×¦×•×•×ª"
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
                ×¤×¨×•×™×§×˜ ×—×“×©
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
                if (!linkedProject) return setNotice("×”×¤×¨×•×™×§×˜ ×”×ž×§×•×©×¨ ×œ× × ×ž×¦×");
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
        <div className="toast">
          <CheckCircle2 size={19} />
          {notice}
        </div>
      )}
    </div>
  );
}

const roleLabels = {
  admin: "×ž× ×”×œ ×ž×¢×¨×›×ª",
  manager: "×ž× ×”×œ ×¤×¨×•×™×§×˜",
  supervisor: "×ž×¤×§×—",
  technician: "×˜×›× ××™",
  finance: "×›×¡×¤×™×",
  viewer: "×¦×•×¤×”",
  custom: "×”×¨×©××” ×ž×•×ª××ž×ª ××™×©×™×ª",
};
const permissionSections=[
  ["projects","×¤×¨×•×™×§×˜×™×"],["clients","×œ×§×•×—×•×ª"],["professionals","×× ×©×™ ×ž×§×¦×•×¢"],["tasks","×ž×©×™×ž×•×ª ×•×’×× ×˜"],
  ["calendar","×œ×•×— ×©× ×”"],["forms","×ž×¡×ž×›×™× ×•×”×§×œ×˜×•×ª"],["catalog","×ž×¢×¨×›×•×ª ×•×¨×›×™×‘×™×"],["finance","×›×¡×¤×™× ×•×’×‘×™×™×”"],
  ["reports","×“×•×—×•×ª ×•× ×™×ª×•×—×™×"],["messages","×”×•×“×¢×•×ª"],["settings","×”×’×“×¨×•×ª ×ž×¢×¨×›×ª"],
];
function PermissionMatrix({value={},onChange}){return <div className="permission-matrix"><header><b>×ž×¡×š / ×ª×—×•×</b><span>×œ×œ×</span><span>×§×¨×™××”</span><span>×§×¨×™××” ×•×›×ª×™×‘×”</span></header>{permissionSections.map(([key,label])=><div key={key}><b>{label}</b>{["none","read","write"].map(level=><label key={level}><input type="radio" name={`permission-${key}`} checked={(value[key]||"none")===level} onChange={()=>onChange({...value,[key]:level})}/><span/></label>)}</div>)}</div>}
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
  user: "××“×",
  wrench: "×›×œ×™ ×¢×‘×•×“×”",
  hardhat: "×§×¡×“×”",
  lightning: "×—×©×ž×œ",
  shield: "×ž×’×Ÿ",
  star: "×›×•×›×‘",
};
function avatarGlyph(user, currentUser = false) {
  if (currentUser) {
    const names = String(user.displayName || "×ž×©×ª×ž×©").trim().split(/\s+/);
    const initials = `${names[0]?.[0] || "×ž"}${names.length > 1 ? names.at(-1)?.[0] || "" : names[0]?.[1] || ""}`;
    return <><b className="avatar-initials">{initials}</b><img className="current-user-avatar-image" src={`${apiRoot}/auth/avatar?v=${encodeURIComponent(user.avatarImage || user.id || "current")}`} alt="" onLoad={(event)=>event.currentTarget.classList.add("loaded")} onError={(event)=>event.currentTarget.classList.remove("loaded")}/></>;
  }
  if (user.avatarImage) return <img src={`${apiRoot}/users/${user.id}/avatar?v=${encodeURIComponent(user.avatarImage)}`} alt="" />;
  if (!user.avatarIcon || user.avatarIcon === "user") {
    const names = String(user.displayName || "×ž×©×ª×ž×©").trim().split(/\s+/);
    return `${names[0]?.[0] || "×ž"}${names.length > 1 ? names.at(-1)?.[0] || "" : names[0]?.[1] || ""}`;
  }
  return (
    { wrench: "ðŸ”§", hardhat: "â›‘", lightning: "ÏŸ", shield: "â—†", star: "â˜…" }[
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
          <span>×›× ×™×¡×” ×ž××•×‘×˜×—×ª</span>
          <h1>×‘×¨×•×›×™× ×”×‘××™×</h1>
          <p>×”×ª×—×‘×¨×• ×œ×ž×¨×—×‘ × ×™×”×•×œ ×”×¤×¨×•×™×§×˜×™× ×©×œ×›×</p>
        </div>
        <form onSubmit={submit}>
          <label>
            ×©× ×ž×©×ª×ž×©
            <input
              autoFocus
              autoComplete="username"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            ×¡×™×¡×ž×”
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
            {submitting ? "×ž×ª×—×‘×¨..." : "×›× ×™×¡×” ×œ×ž×¢×¨×›×ª"} <ArrowLeft size={17} />
          </button>
        </form>
        <small className="login-hint">
          ×‘×›× ×™×¡×” ×“×¨×š Home Assistant ×”×–×™×”×•×™ ×ž×ª×‘×¦×¢ ××•×˜×•×ž×˜×™×ª.
        </small>
      </div>
    </div>
  );
}

function InitialPasswordPage({onChanged}) {
  const [form,setForm]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
  const [error,setError]=useState(''); const [submitting,setSubmitting]=useState(false);
  const submit=async(event)=>{event.preventDefault();setError('');if(!passwordsMatch(form.newPassword,form.confirmPassword))return setError('×”×¡×™×¡×ž××•×ª ××™× ×Ÿ ×ª×•××ž×•×ª');setSubmitting(true);try{const result=await api('/auth/password',{method:'POST',body:JSON.stringify(form)});if(typeof onChanged==='function')onChanged(result.user)}catch(changeError){setError(changeError.message)}finally{setSubmitting(false)}};
  return <div className="login-shell" dir="rtl"><div className="login-card"><div className="login-brand"><div className="brand-mark"><img src={projectsMark} alt=""/></div><strong><b>PRO</b>JECTS</strong></div><div className="login-copy"><span>××‘×˜×—×ª ×”×—×©×‘×•×Ÿ</span><h1>×”×—×œ×¤×ª ×¡×™×¡×ž×” ×¨××©×•× ×™×ª</h1><p>×œ×¤× ×™ ×ª×—×™×œ×ª ×”×¢×‘×•×“×” ×™×© ×œ×‘×—×•×¨ ×¡×™×¡×ž×” ××™×©×™×ª ×•×—×–×§×”.</p></div><form onSubmit={submit}><label>×¡×™×¡×ž×” × ×•×›×—×™×ª<input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={event=>setForm({...form,currentPassword:event.target.value})}/></label><label>×¡×™×¡×ž×” ×—×“×©×”<input type="password" autoComplete="new-password" minLength="12" required value={form.newPassword} onChange={event=>setForm({...form,newPassword:event.target.value})}/></label><label>××™×ž×•×ª ×¡×™×¡×ž×”<input type="password" autoComplete="new-password" minLength="12" required value={form.confirmPassword} onChange={event=>setForm({...form,confirmPassword:event.target.value})}/></label><small>×œ×¤×—×•×ª 12 ×ª×•×•×™×, ××•×ª ×’×“×•×œ×”, ××•×ª ×§×˜× ×” ×•×ž×¡×¤×¨.</small>{error&&<div className="login-error">{error}</div>}<button className="primary-button" disabled={submitting}>{submitting?'×©×•×ž×¨...':'×©×ž×™×¨×ª ×¡×™×¡×ž×”'} <ArrowLeft size={17}/></button></form></div></div>;
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
      setNotice("×”×ž×©×ª×ž×© × ×•×¦×¨");
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
      setNotice("×”×”×¨×©××” ×¢×•×“×›× ×”");
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
      setNotice("×ª×ž×•× ×ª ×”×ž×©×ª×ž×© ×¢×•×“×›× ×”");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const removeAvatar = async (id) => {
    try {
      await api(`/users/${id}/avatar`, { method: "DELETE" });
      loadUsers();
      if (typeof onChanged === "function") onChanged();
      setNotice("×ª×ž×•× ×ª ×”×ž×©×ª×ž×© ×”×•×¡×¨×”");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const deleteUser = async (item) => {
    if (!window.confirm(`×œ×ž×—×•×§ ××ª ×”×ž×©×ª×ž×© â€ž${item.displayName}â€?`)) return;
    try {
      await api(`/users/${item.id}`, { method: "DELETE" });
      loadUsers();
      if (typeof onChanged === "function") onChanged();
      setNotice("×”×ž×©×ª×ž×© × ×ž×—×§");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const mergeIdentities = async (event) => {
    event.preventDefault();
    if (!identityLink.primaryUserId || !identityLink.secondaryUserId || identityLink.primaryUserId === identityLink.secondaryUserId) return setNotice("×™×© ×œ×‘×—×•×¨ ×©×ª×™ ×–×”×•×™×•×ª ×©×•× ×•×ª");
    const primary = users.find((item)=>String(item.id)===String(identityLink.primaryUserId));
    const secondary = users.find((item)=>String(item.id)===String(identityLink.secondaryUserId));
    if (!window.confirm(`×œ××—×“ ××ª â€œ${secondary?.displayName}â€ ××œ ×”×–×”×•×ª ×”×¨××©×™×ª â€œ${primary?.displayName}â€? ×ž×¢×›×©×™×• ×ª×•×¦×’ ×–×”×•×ª ××—×ª ×•× ×™×ª×Ÿ ×™×”×™×” ×œ×”×™×›× ×¡ ××œ×™×” ×’× ×“×¨×š Web ×•×’× ×“×¨×š Home Assistant.`)) return;
    setLinkingIdentity(true);
    try {
      await api('/users/merge-identities',{ method:'POST',body:JSON.stringify(identityLink) });
      setIdentityLink({ primaryUserId:"",secondaryUserId:"" });
      await loadUsers();
      if (typeof onChanged === "function") onChanged();
      setNotice("×”×–×”×•×™×•×ª ××•×—×“×• ×‘×”×¦×œ×—×” ×œ×—×©×‘×•×Ÿ ××—×“");
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
      setNotice("×¡×™×¡×ž×ª ×ž×©×ª×ž×© ×¢×•×“×›× ×” ×‘×”×¦×œ×—×”");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSavingAction("");
    }
  };
  const unlockUser = async (item) => {
    if (!window.confirm(`×œ×©×—×¨×¨ × ×¢×™×œ×” ×©×œ \"${item.displayName}\"?`)) return;
    setSavingAction(`unlock:${item.id}`);
    try {
      const result = await api(`/users/${item.id}/unlock`, { method: "POST" });
      loadUsers();
      if (typeof onChanged === "function") onChanged(result.user);
      setNotice("× ×¢×™×œ×ª ×”×ž×©×ª×ž×© ×©×•×—×¨×¨×”");
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
          <h2>×ž×©×ª×ž×©×™× ×•×”×¨×©××•×ª ×›× ×™×¡×”</h2>
          <p>
            ×›××Ÿ ×ž× ×”×œ×™× ×’×™×©×” ×œ×ª×•×›× ×” ×‘×œ×‘×“. ×ª×¤×§×™×“ ×ž×§×¦×•×¢×™ ×•×©×™×•×š ×œ×¤×¨×•×™×§×˜ ×ž× ×•×”×œ×™×
            ×‘×ž××’×¨ ×× ×©×™ ×”×ž×§×¦×•×¢.
          </p>
        </div>
        <span className="security-pill">
          <ShieldCheck size={17} />
          {users.length} ×ž×©×ª×ž×©×™×
        </span>
      </div>
      <nav className="users-tabs" aria-label="× ×™×”×•×œ ×ž×©×ª×ž×©×™×">
        <button type="button" className={activeTab === "accounts" ? "active" : ""} onClick={() => setActiveTab("accounts")}>×ž×©×ª×ž×©×™×</button>
        <button type="button" className={activeTab === "create" ? "active" : ""} onClick={() => setActiveTab("create")}><Plus size={16} /> ×™×¦×™×¨×ª ×ž×©×ª×ž×©</button>
        <button type="button" className={activeTab === "identities" ? "active" : ""} onClick={() => setActiveTab("identities")}>××™×—×•×“ ×–×”×•×™×•×ª</button>
      </nav>
      {activeTab === "accounts" && <div className="users-layout">
        <div className="panel users-list">
          <div className="panel-head">
            <div>
              <h3>×—×©×‘×•× ×•×ª ×ž×¢×¨×›×ª</h3>
              <span>
                ××¤×©×¨ ×œ×¢×¨×•×š, ×œ×”×©×‘×™×ª ××• ×œ×ž×—×•×§; ×œ× × ×™×ª×Ÿ ×œ×ž×—×•×§ ××ª ×”×ž×©×ª×ž×© ×”×ž×—×•×‘×¨.
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
                    {item.identityTypes?.includes('web') ? `Web: ${item.username}` : "×œ×œ× ×›× ×™×¡×ª Web"}{" "}
                    {item.identityTypes?.includes('ingress') && "Â· Home Assistant Ingress"}
                  </span>
                  <small className={item.online ? "user-online" : "user-offline"}>{item.online ? "×ž×—×•×‘×¨ ×›×¢×ª" : item.lastSeenAt ? `× ×¨××” ×œ××—×¨×•× ×” ${new Date(item.lastSeenAt).toLocaleString("he-IL")}` : "×˜×¨× ×”×ª×—×‘×¨"}</small>
                  <small className="user-last-login">×”×ª×—×‘×¨×•×ª ××—×¨×•× ×”: {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString("he-IL") : "×˜×¨× ×”×ª×—×‘×¨"}</small>
                </div>
                <div className="admin-user-glance">
                  <span className="admin-role-badge">{roleLabels[item.role]}</span>
                  <span className={item.financeAccess !== false ? "admin-finance-badge allowed" : "admin-finance-badge blocked"}>
                    {item.financeAccess !== false ? "×›×¡×¤×™× ×’×œ×•×™×™×" : "×›×¡×¤×™× ×ž×•×¡×ª×¨×™×"}
                  </span>
                  {item.isLocked ? <span className="admin-lock-badge">× × ×¢×œ</span> : null}
                  <label className="admin-switch" title={item.active ? "×”×—×©×‘×•×Ÿ ×¤×¢×™×œ" : "×”×—×©×‘×•×Ÿ ×ž×•×©×‘×ª"}>
                    <input type="checkbox" checked={item.active} onChange={(e) => updateUser(item.id, { active: e.target.checked })} />
                    <span aria-hidden="true" />
                    <b>{item.active ? "×¤×¢×™×œ" : "×ž×•×©×‘×ª"}</b>
                  </label>
                </div>
              </div>
              <details className="admin-user-settings">
                <summary><span>×¢×¨×™×›×ª ×ž×©×ª×ž×© ×•×”×¨×©××•×ª</span><ChevronDown size={16} /></summary>
                <div className="admin-user-controls">
                  <div className="admin-password-action">
                    <button
                      type="button"
                      className="admin-secondary-action"
                      onClick={() => openPasswordReset(item.id)}
                    >
                      <KeyRound size={15} />
                      <span>××™×¤×•×¡ ×¡×™×¡×ž×”</span>
                    </button>
                    {item.isLocked ? (
                      <button
                        type="button"
                        className="admin-secondary-action"
                        onClick={() => unlockUser(item)}
                        disabled={savingAction === `unlock:${item.id}`}
                      >
                        <Unlock size={15} />
                        <span>{savingAction === `unlock:${item.id}` ? "×¤×•×¢×œ..." : "×©×—×¨×•×¨ × ×¢×™×œ×”"}</span>
                      </button>
                    ) : null}
                  </div>
                  <label className="user-control-field admin-icon-field">
                    <span>×ª×¤×§×™×“ ×•×”×¨×©××”</span>
                    <select value={item.role} onChange={(e) => updateUser(item.id, { role: e.target.value })}>
                      {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="admin-checkbox-option" title="×©×œ×™×˜×” × ×¤×¨×“×ª ×‘×—×©×™×¤×ª × ×ª×•× ×™× ×›×¡×¤×™×™×">
                    <input type="checkbox" checked={item.financeAccess !== false} onChange={(event) => updateUser(item.id, { financeAccess: event.target.checked })} />
                    <span><b>×’×™×©×” ×œ× ×ª×•× ×™× ×›×¡×¤×™×™×</b><small>{item.financeAccess !== false ? "×ž×•×¦×’×™× ×œ×ž×©×ª×ž×©" : "×ž×•×¡×ª×¨×™× ×ž×”×ž×©×ª×ž×©"}</small></span>
                  </label>
                  <label className="user-control-field user-color-field">
                    <span>×¦×‘×¢ ×ž×©×ª×ž×©</span>
                    <input aria-label="×¦×‘×¢ ×ž×©×ª×ž×©" type="color" value={item.avatarColor} onChange={(e) => updateUser(item.id, { avatarColor: e.target.value })} />
                  </label>
                  <label className="user-control-field">
                    <span>××™×™×§×•×Ÿ</span>
                    <select aria-label="××™×™×§×•×Ÿ ×ž×©×ª×ž×©" value={item.avatarIcon} onChange={(e) => updateUser(item.id, { avatarIcon: e.target.value })}>
                      {Object.entries(avatarIcons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="admin-photo-upload" title="×”×¢×œ××ª ×ª×ž×•× ×ª ×ž×©×ª×ž×©">
                    <Upload size={15} /><span>{item.avatarImage ? "×”×—×œ×¤×ª ×ª×ž×•× ×”" : "×”×¢×œ××ª ×ª×ž×•× ×”"}</span>
                    <input type="file" accept="image/*" onChange={(event) => { uploadAvatar(item.id, event.target.files?.[0]); event.target.value = ""; }} />
                  </label>
                  {item.avatarImage && <button type="button" className="admin-secondary-action" onClick={() => removeAvatar(item.id)}>×”×¡×¨×ª ×ª×ž×•× ×”</button>}
                  <button type="button" className="admin-delete-action" disabled={String(item.id) === String(currentUser.id)} onClick={() => deleteUser(item)} title="×ž×—×™×§×ª ×ž×©×ª×ž×©"><Trash2 size={15} /><span>×ž×—×™×§×”</span></button>
                  {passwordActions[item.id]?.open ? (
                    <div className="admin-password-editor">
                      <h5>××™×¤×•×¡ ×¡×™×¡×ž×” ×œ×ž×©×ª×ž×©</h5>
                      <label className="user-control-field admin-icon-field">
                        <span>×¡×™×¡×ž×” ×—×“×©×”</span>
                        <input
                          type="password"
                          dir="ltr"
                          value={passwordActions[item.id]?.newPassword || ""}
                          onChange={(event) => updatePasswordAction(item.id, { newPassword: event.target.value })}
                          placeholder="×”×©××¨ ×¨×™×§ ×œ×™×¦×™×¨×ª ×¡×™×¡×ž×” ××§×¨××™×ª"
                        />
                      </label>
                      <div className="admin-password-inline">
                        <label className="admin-checkbox-option">
                          <input
                            type="checkbox"
                            checked={passwordActions[item.id]?.requirePasswordChange !== false}
                            onChange={(event) => updatePasswordAction(item.id, { requirePasswordChange: event.target.checked })}
                          />
                          <span>×“×¨×•×© ×©×™× ×•×™ ×¡×™×¡×ž×” ×‘×›× ×™×¡×” ×”×‘××”</span>
                        </label>
                        <button
                          type="button"
                          className="admin-secondary-action"
                          onClick={() => updatePasswordAction(item.id, { newPassword: randomPassword() })}
                        >
                          ×™×¦×™×¨×ª ×¡×™×¡×ž×”
                        </button>
                      </div>
                      <div className="admin-password-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => resetUserPassword(item.id)}
                          disabled={savingAction === `reset:${item.id}`}
                        >
                          {savingAction === `reset:${item.id}` ? "×©×•×ž×¨..." : "×©×ž×™×¨×ª ×¡×™×¡×ž×”"}
                        </button>
                        <button
                          type="button"
                          className="admin-secondary-action"
                          onClick={() => closePasswordReset(item.id)}
                        >
                          ×‘×™×˜×•×œ
                        </button>
                      </div>
                      {passwordActions[item.id]?.generatedPassword ? (
                        <p className="admin-generated-password">
                          ×¡×™×¡×ž×” ×–×ž× ×™×ª: <strong>{passwordActions[item.id]?.generatedPassword}</strong> (×©×ž×•×¨ ×‘×ž×§×•× ×‘×˜×•×—)
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {item.role === "custom" && <details className="user-permissions"><summary>×”×¨×©××•×ª ×ž×¤×•×¨×˜×•×ª</summary><PermissionMatrix value={item.permissions} onChange={(permissions) => updateUser(item.id, { permissions })} /></details>}
              </details>
            </article>
          ))}
        </div>
      </div>}
      {activeTab === "create" &&
        <form className="panel create-user" onSubmit={createUser}>
          <div className="panel-head">
            <div>
              <h3>×—×©×‘×•×Ÿ ×›× ×™×¡×” ×—×“×©</h3>
              <span>×œ××—×¨ ×”×™×¦×™×¨×” ××¤×©×¨ ×œ×§×©×¨ ××•×ª×• ×œ××“× ×‘×ž××’×¨ ×× ×©×™ ×”×ž×§×¦×•×¢</span>
            </div>
          </div>
          <label>
            ×©× ×ª×¦×•×’×”
            <input
              required
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
            />
          </label>
          <label>
            ×©× ×ž×©×ª×ž×©
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            ×¡×™×¡×ž×”
            <input
              type="password"
              minLength="12"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            ×”×¨×©××ª ×ž×¢×¨×›×ª
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
          <label className="finance-access-toggle"><input type="checkbox" checked={form.financeAccess} onChange={(event)=>setForm({...form,financeAccess:event.target.checked})}/>××¤×©×¨ ×¦×¤×™×™×” ×‘×›×¡×¤×™×</label>
          {form.role==="custom"&&<PermissionMatrix value={form.permissions} onChange={(permissions)=>setForm({...form,permissions})}/>}
          <div className="new-user-appearance">
            <label>
              ×¦×‘×¢
              <input
                type="color"
                value={form.avatarColor}
                onChange={(e) =>
                  setForm({ ...form, avatarColor: e.target.value })
                }
              />
            </label>
            <label>
              ××™×™×§×•×Ÿ
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
            ×™×¦×™×¨×ª ×—×©×‘×•×Ÿ
          </button>
        </form>
      }
      {activeTab === "identities" && users.length > 1 && <form className="panel identity-linker" onSubmit={mergeIdentities}>
        <div className="identity-linker-copy"><span><Link2 size={19}/></span><div><h3>××™×—×•×“ ×–×”×•×™×•×ª Web ×•Ö¾Home Assistant</h3><p>×‘×—×¨×• ××ª ×”×—×©×‘×•×Ÿ ×©×™×™×©××¨ ×ž×•×¦×’, ×•××ª ×”×—×©×‘×•×Ÿ ×”×›×¤×•×œ ×©×™×•×˜×ž×¢ ×‘×•. ×”×”×¨×©××•×ª, ×”×ž×¨××” ×•×”×©× ×©×œ ×”×–×”×•×ª ×”×¨××©×™×ª × ×©×ž×¨×™×.</p></div></div>
        <label>×”×–×”×•×ª ×”×¨××©×™×ª ×©×ª×•×¦×’<select value={identityLink.primaryUserId} onChange={(event)=>setIdentityLink({...identityLink,primaryUserId:event.target.value})}><option value="">×‘×—×™×¨×ª ×—×©×‘×•×Ÿ ×¨××©×™</option>{users.map((item)=><option key={item.id} value={item.id}>{item.displayName} Â· {item.identityTypes?.join(' + ')||'×—×©×‘×•×Ÿ'}</option>)}</select></label>
        <span className="identity-link-arrow">â†</span>
        <label>×”×–×”×•×ª ×”×›×¤×•×œ×” ×œ××™×—×•×“<select value={identityLink.secondaryUserId} onChange={(event)=>setIdentityLink({...identityLink,secondaryUserId:event.target.value})}><option value="">×‘×—×™×¨×ª ×—×©×‘×•×Ÿ ×›×¤×•×œ</option>{users.filter((item)=>String(item.id)!==String(identityLink.primaryUserId)&&String(item.id)!==String(currentUser.id)).map((item)=><option key={item.id} value={item.id}>{item.displayName} Â· {item.identityTypes?.join(' + ')||'×—×©×‘×•×Ÿ'}</option>)}</select></label>
        <button className="primary-button" disabled={linkingIdentity||!identityLink.primaryUserId||!identityLink.secondaryUserId}>{linkingIdentity?'×ž××—×“ ×–×”×•×™×•×ª...':'××™×—×•×“ ×œ×—×©×‘×•×Ÿ ××—×“'}</button>
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
      <h1>×œ× × ×™×ª×Ÿ ×œ×˜×¢×•×Ÿ ××ª ×©×¨×ª ×”× ×ª×•× ×™×</h1>
      <p>××™×Ÿ ×¦×•×¨×š ×‘×©× ×ž×©×ª×ž×© ××• ×‘×¡×™×¡×ž×” ×›××©×¨ × ×›× ×¡×™× ×“×¨×š Home Assistant.</p>
      <code>
        {message} Â· API: {apiRoot}
      </code>
      <button
        className="primary-button"
        onClick={() => window.location.reload()}
      >
        <RotateCcw size={17} />
        × ×™×¡×™×•×Ÿ ×—×•×–×¨
      </button>
      <small>
        ×× ×”×ª×§×œ×” ×—×•×–×¨×ª, ×”×¢×ª×™×§×• ××ª ×™×•×ž×Ÿ ×”Ö¾App ×ž×ž×¡×š PROJECTS ×‘Ö¾Home Assistant.
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
      setNotice("×”×’×™×‘×•×™ ×”×•×©×œ×");
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
        `×œ×©×—×–×¨ ××ª ${name}? ×”×ž×¢×¨×›×ª ×ª×•×¤×¢×œ ×ž×—×“×© ×•×›×œ ×”× ×ª×•× ×™× ×”× ×•×›×—×™×™× ×™×•×—×œ×¤×•.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api("/system/restore", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNotice("×”×©×—×–×•×¨ ×”×—×œ; ×”×ž×¢×¨×›×ª ×ª×¢×œ×” ×ž×—×“×© ×‘×¢×•×“ ×¨×’×¢");
    } catch (error) {
      setNotice(error.message);
      setBusy(false);
    }
  };
  return (
    <div className="section-page system-page">
      <div className="page-intro">
        <div>
          <h2>×’×™×‘×•×™, ×©×—×–×•×¨ ×•×‘×¨×™××•×ª ×ž×¢×¨×›×ª</h2>
          <p>
            ×’×™×‘×•×™×™ PostgreSQL × ×©×ž×¨×™× ×‘×ª×•×š × ×ª×•× ×™ ×”Ö¾Add-on ×•× ×›×œ×œ×™× ×’× ×‘×’×™×‘×•×™ Home
            Assistant
          </p>
        </div>
        <button
          className="primary-button"
          disabled={busy}
          onClick={createBackup}
        >
          <Database size={17} />
          {busy ? "×ž×‘×¦×¢..." : "×™×¦×™×¨×ª ×’×™×‘×•×™"}
        </button>
      </div>
      <div className="panel backup-list">
        <div className="panel-head">
          <div>
            <h3>×’×™×‘×•×™×™× ×–×ž×™× ×™×</h3>
            <span>×©×—×–×•×¨ ×ž×¤×¢×™×œ ×ž×—×“×© ××ª ×©×™×¨×•×ª ×”Ö¾API ×‘××•×¤×Ÿ ×ž×‘×•×§×¨</span>
          </div>
          <span className="health-online">
            <i />
            PostgreSQL ×ž×—×•×‘×¨
          </span>
        </div>
        {backups.length === 0 && (
          <div className="empty-backups">×¢×“×™×™×Ÿ ×œ× × ×•×¦×¨×• ×’×™×‘×•×™×™× ×™×“× ×™×™×.</div>
        )}
        {backups.map((backup) => (
          <div className="backup-row" key={backup.name}>
            <div className="doc-icon">
              <Database size={18} />
            </div>
            <div>
              <strong>{backup.name}</strong>
              <span>
                {new Date(backup.createdAt).toLocaleString("he-IL")} Â·{" "}
                {(backup.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => restore(backup.name)}
            >
              <RotateCcw size={15} />
              ×©×—×–×•×¨
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ api, projects, openProject, setPage, insights, insightsRefreshing, onRefreshInsights, user }) {
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
  const cashData = canViewFinance ? projects
    .slice(0, 6)
    .map((project) => ({
      projectName: project.name,
      paid: Math.round(project.paid / 1000),
      expected: Math.round(project.value / 1000),
    })) : [];
  const upcomingMilestones = projects
    .filter((project) => project.stage !== "completed")
    .slice(0, 4);
  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <h2>
            ×©×œ×•×, {user.displayName} <span>ðŸ‘‹</span>
          </h2>
          <p>×”× ×” ×ª×ž×•× ×ª ×”×ž×¦×‘ ×”×ª×¤×¢×•×œ×™×ª ×”×ž×¢×•×“×›× ×ª.</p>
        </div>
        <div className="welcome-actions">
          <button
            className={`dashboard-task-button ${insights?.stats?.overdue > 0 ? "urgent" : ""}`}
            onClick={() => setPage("tasks")}
          >
            <ClipboardCheck size={18} />
            <span>×ž×©×™×ž×•×ª</span>
            <b>{insights?.stats?.open || 0}</b>
          </button>
          <div className="live-pill">
            <i />
            ×”× ×ª×•× ×™× ×ž×¢×•×“×›× ×™× ×¢×›×©×™×•
          </div>
        </div>
      </section>
      <section className="kpi-grid">
        <KpiCard
          icon={FolderKanban}
          tone="purple"
          label="×¤×¨×•×™×§×˜×™× ×¤×¢×™×œ×™×"
          value={active.length}
          change={`${smartHomeCount} ×‘×™×ª ×—×›× Â· ${otherCount} ××—×¨×™×`}
          onClick={() => setPage("projects")}
        />
        {canViewFinance && <KpiCard
          icon={TrendingUp}
          tone="blue"
          label="×”×™×§×£ ×¤×¨×•×™×§×˜×™× ×¤×¢×™×œ×™×"
          value={compactMoney(value)}
          change="×œ×¤×™ ×©×•×•×™ ×”×—×•×–×™× ×”×ž×¢×•×“×›×Ÿ"
          onClick={() => setPage("projects")}
        />}
        <KpiCard
          icon={Gauge}
          tone="green"
          label="×”×ª×§×“×ž×•×ª ×ž×ž×•×¦×¢×ª"
          value={`${avg}%`}
          change={`×ž×ž×•×¦×¢ ×©×œ ${active.length} ×¤×¨×•×™×§×˜×™× ×¤×¢×™×œ×™×`}
          onClick={() => setPage("projects")}
        />
        {canViewFinance && <KpiCard
          icon={CircleDollarSign}
          tone="orange"
          label="×™×ª×¨×” ×¤×ª×•×—×” ×œ×’×‘×™×™×”"
          value={compactMoney(unpaid)}
          change={`${active.filter((p) => Number(p.paid) < Number(p.value)).length} ×¤×¨×•×™×§×˜×™× ×¢× ×™×ª×¨×”`}
          alert
          onClick={() => setPage("finance")}
        />}
      </section>
      <InsightsTile insights={insights} onNavigate={setPage} refreshing={insightsRefreshing} onRefresh={onRefreshInsights} />
      <RiskCenter api={api} projects={projects} openProject={openProject}/>
      <section className="dashboard-grid top">
        <div className="panel portfolio-panel">
          <PanelHead
            title="×¤×¨×•×™×§×˜×™× ×©×“×•×¨×©×™× ×ª×©×•×ž×ª ×œ×‘"
            subtitle={canViewFinance ? "×œ×¤×™ ×¡×™×›×•×Ÿ, ×—×¨×™×’×” ×•×ª×©×œ×•×ž×™×" : "×œ×¤×™ ×¡×™×›×•×Ÿ ×•×—×¨×™×’×” ×ª×¤×¢×•×œ×™×ª"}
            action="×œ×›×œ ×”×¤×¨×•×™×§×˜×™×"
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
                        {project.id} Â· {project.location}
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
                ××™×Ÿ ×›×¨×’×¢ ×¤×¨×•×™×§×˜×™× ×ž×¡×•×ž× ×™× ×œ×˜×™×¤×•×œ.
              </div>
            )}
          </div>
        </div>
        <div className="panel stage-panel">
          <PanelHead title="×”×ª×¤×œ×’×•×ª ×œ×¤×™ ×©×œ×‘" subtitle="×›×œ×œ ×”×¤×¨×•×™×§×˜×™×" />
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
              <span>×¤×¨×•×™×§×˜×™×</span>
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
            title="×’×‘×™×™×” ×œ×¤×™ ×¤×¨×•×™×§×˜"
            subtitle="×—×•×–×” ×ž×•×œ ×ª×©×œ×•×ž×™× ×©×”×ª×§×‘×œ×• Â· ×‘××œ×¤×™ â‚ª"
            action={`${cashData.length} ×¤×¨×•×™×§×˜×™×`}
            onAction={() => setPage("finance")}
          />
          <div className="cash-legend" aria-label="×ž×§×¨× ×’×¨×£ ×”×’×‘×™×™×”">
            <span>
              <i className="paid" />
              ×”×ª×§×‘×œ
            </span>
            <span>
              <i className="expected" />
              ×¦×¤×™
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
                dataKey="projectName"
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
                  `${chartValue} ××œ×¤×™ â‚ª`,
                  name === "paid" ? "×”×ª×§×‘×œ" : "×”×™×§×£ ×—×•×–×”",
                ]}
                labelFormatter={(label) => `×¤×¨×•×™×§×˜ ${label}`}
                contentStyle={{ direction: "rtl", textAlign: "right" }}
              />
              <Bar dataKey="expected" fill="#e8ebf3" radius={[5, 5, 0, 0]} />
              <Bar dataKey="paid" fill="#6d5de8" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>}
        <div className="panel milestones-panel">
          <PanelHead
            title="××‘× ×™ ×“×¨×š ×§×¨×•×‘×•×ª"
            subtitle="×”×™×¢×“×™× ×”×‘××™× ×‘×¤×¨×•×™×§×˜×™× ×”×¤×¢×™×œ×™×"
            action="×œ×œ×•×— ×”×©× ×”"
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
                    <b>{dueParts[0] || "â€”"}</b>
                    <span>{dueParts[1] || ""}</span>
                  </div>
                  <div>
                    <strong>
                      {item.nextMilestone || "×˜×¨× ×”×•×’×“×¨×” ××‘×Ÿ ×“×¨×š"}
                    </strong>
                    <span>{item.name}</span>
                  </div>
                  {item.health < 70 && <em>×‘×¡×™×›×•×Ÿ</em>}
                  <MoreHorizontal size={18} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel activity-panel">
          <PanelHead
            title="×¤×¢×™×œ×•×ª ××—×¨×•× ×”"
            action="Audit Log"
            onAction={() =>
              setPage(user.role === "admin" ? "settings" : "tasks")
            }
          />
          <div className="activity-list">
            {(insights?.recentActivities || []).map((item) => (
              <div className="activity-item" key={item.id}>
                <div className="mini-avatar">
                  {(item.userName || "×ž×¢×¨×›×ª").slice(0, 2)}
                </div>
                <div>
                  <p>
                    {item.userName || "×ž×¢×¨×›×ª"} Â·{" "}
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
              <div className="inline-empty">××™×Ÿ ×¤×¢×™×œ×•×ª ×—×“×©×” ×œ×”×¦×’×”.</div>
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
    if (!window.confirm(`×–×”×• ××™×©×•×¨ ×¨××©×•×Ÿ ×œ×ž×—×™×§×” ×œ×¦×ž×™×ª×•×ª ×©×œ "${project.name}". ×œ×”×ž×©×™×š?`)) return;
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
      setNotice("×”×¤×¨×•×™×§×˜ ×•×›×œ ×”× ×ª×•× ×™× ×”×ž×©×•×™×›×™× ××œ×™×• × ×ž×—×§×• ×œ×¦×ž×™×ª×•×ª");
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
    const value=(project,key)=>key==="name"?(project.name||""):key==="stage"?stageOrder.indexOf(project.stage):key==="progress"?Number(project.progress||0):key==="manager"?(project.manager||""):key==="milestone"?new Date(project.due||"9999-12-31").getTime():key==="balance"&&canViewFinance?Number(project.value||0)-Number(project.paid||0):"";
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
          <h2>{projectScope==="archived" ? "××¨×›×™×•×Ÿ ×¤×¨×•×™×§×˜×™×" : projectScope==="completed" ? "×¤×¨×•×™×§×˜×™× ×©×”×¡×ª×™×™×ž×•" : "×›×œ ×”×¤×¨×•×™×§×˜×™×"}</h2>
          <p>
            {showArchived
              ? "×¤×¨×•×™×§×˜×™× ×©×”×¡×ª×™×™×ž×• × ×©×ž×¨×™× ×›××Ÿ ×•× ×™×ª× ×™× ×œ×©×—×–×•×¨ ×ž×œ×"
              : `× ×™×”×•×œ, ×ž×¢×§×‘ ×•×‘×§×¨×” ×©×œ ${visibleProjects.length} ×¤×¨×•×™×§×˜×™× ×‘×ª×¦×•×’×” ×”× ×•×›×—×™×ª`}
          </p>
        </div>
        <div className="project-page-actions">
          <div className="archive-switch">
            <button
              className={projectScope==="active" ? "active" : ""}
              onClick={() => switchArchive("active")}
            >
              ×¤×¢×™×œ×™×
            </button>
            <button className={projectScope==="completed"?"active":""} onClick={()=>switchArchive("completed")}><CheckCircle2 size={16}/>×”×¡×ª×™×™×ž×•</button>
            <button
              className={projectScope==="archived" ? "active" : ""}
              onClick={() => switchArchive("archived")}
            >
              <Archive size={16} />
              ××¨×›×™×•×Ÿ
            </button>
          </div>
          <div className="view-switch">
            <button
              className={view === "table" ? "active" : ""}
              onClick={() => setView("table")}
            >
              <ListFilter size={17} />
              ×˜×‘×œ×”
            </button>
            <button
              className={view === "board" ? "active" : ""}
              onClick={() => setView("board")}
            >
              <FolderKanban size={17} />
              ×œ×•×—
            </button>
            <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
              <Map size={17} />
              ×ž×¤×”
            </button>
          </div>
        </div>
      </div>
      <div className="toolbar panel projects-filter-toolbar">
        <div className="project-category-filter"><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>×”×›×œ</button><button className={category==='smart_home'?'active':''} onClick={()=>setCategory('smart_home')}>×‘×™×ª ×—×›×</button><button className={category==='other'?'active':''} onClick={()=>setCategory('other')}>××—×¨×™×</button></div>
        <label className="table-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="×—×™×¤×•×© ×¤×¨×•×™×§×˜, ×œ×§×•×— ××• ×ž×–×”×”..."
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
            ×©×œ×‘
          </span>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
          >
            <option value="all">×›×œ ×”×©×œ×‘×™× Â· {sourceProjects.length}</option>
            {Object.entries(stageMeta).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label} Â·{" "}
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
          ×ž×¡× × ×™×
        </button>
      </div>
      {filtersOpen && (
        <div className="advanced-project-filters panel">
          <label>
            ×ž× ×”×œ ×¤×¨×•×™×§×˜
            <select
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">×›×•×œ×</option>
              {managers.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            ×¢×“×™×¤×•×ª
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">×”×›×•×œ</option>
              <option value="low">× ×ž×•×›×”</option>
              <option value="normal">×¨×’×™×œ×”</option>
              <option value="high">×’×‘×•×”×”</option>
              <option value="urgent">×“×—×•×¤×”</option>
            </select>
          </label>
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setFlagged(e.target.checked)}
            />
            ×¤×¨×•×™×§×˜×™× ×ž×¡×•×ž× ×™× ×‘×œ×‘×“
          </label>
          <button
            onClick={() => {
              setManager("");
              setPriority("");
              setCategory("all");
              setFlagged(false);
            }}
          >
            × ×™×§×•×™ ×ž×¡× × ×™×
          </button>
        </div>
      )}
      {archiveLoading ? (
        <div className="panel inline-empty">×˜×•×¢×Ÿ ××¨×›×™×•×Ÿ...</div>
      ) : view === "map" ? (
        <MapPage projects={visibleProjects} openProject={openProject} stageFilter={stageFilter} setStageFilter={setStageFilter}/>
      ) : view === "table" ? (
        <div className="panel projects-table-wrap">
          <table className="projects-table">
            <thead>
              <tr>
                <th><button className={projectSort.key==="name"?"active":""} onClick={()=>toggleProjectSort("name")}>×¤×¨×•×™×§×˜<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="stage"?"active":""} onClick={()=>toggleProjectSort("stage")}>×©×œ×‘ × ×•×›×—×™<ArrowUpDown size={13}/></button></th>
                <th>×”×ª×§×“×ž×•×ª ×§×‘×œ×Ÿ</th>
                <th><button className={projectSort.key==="progress"?"active":""} onClick={()=>toggleProjectSort("progress")}>×”×ª×§×“×ž×•×ª<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="manager"?"active":""} onClick={()=>toggleProjectSort("manager")}>×ž× ×”×œ ×¤×¨×•×™×§×˜<ArrowUpDown size={13}/></button></th>
                <th><button className={projectSort.key==="milestone"?"active":""} onClick={()=>toggleProjectSort("milestone")}>××‘×Ÿ ×“×¨×š ×”×‘××”<ArrowUpDown size={13}/></button></th>
                {canViewFinance&&<th><button className={projectSort.key==="balance"?"active":""} onClick={()=>toggleProjectSort("balance")}>×™×ª×¨×” ×œ×’×‘×™×™×”<ArrowUpDown size={13}/></button></th>}
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
                          {project.location} Â· {projectCategoryText(project)} Â· {projectClassificationLabels[project.projectClassification] || "×‘×™×ª ×¤×¨×˜×™"}
                        </span>
                        {showArchived && (
                          <small className="archived-date">
                            ×‘××¨×›×™×•×Ÿ ×žÖ¾
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
                  <td><span className={`contractor-progress-chip contractor-${project.contractorProgress || "waiting"}`}>{contractorProgressLabels[project.contractorProgress] || "×‘×”×ž×ª× ×”"}</span></td>
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
                      {project.manager || "×œ× ×”×•×§×¦×”"}
                    </div>
                  </td>
                  <td>
                    <div className="milestone-cell">
                      <strong>{project.nextMilestone || "×œ× ×”×•×’×“×¨"}</strong>
                      <span>
                        <CalendarDays size={13} />
                        {project.due || "×œ×œ× ×ª××¨×™×š"}
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
                      {showArchived && user.role === "admin" && <button className="archive-delete" onClick={(event) => { event.stopPropagation(); beginPermanentDelete(project); }} title="×ž×—×™×§×” ×œ×¦×ž×™×ª×•×ª"><Trash2 size={17} /></button>}
                      <button className="round-more" onClick={(e) => { e.stopPropagation(); openProject(project); }} title="×¤×ª×™×—×ª ×¤×¨×•×™×§×˜"><MoreHorizontal size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleProjects.length && (
            <div className="inline-empty">
              {showArchived
                ? "×”××¨×›×™×•×Ÿ ×¨×™×§."
                : "×œ× × ×ž×¦××• ×¤×¨×•×™×§×˜×™× ×”×ª×•××ž×™× ×œ×ž×¡× × ×™×."}
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
              <div><span>××™×©×•×¨ ×©× ×™ Â· Administrator ×‘×œ×‘×“</span><h2>×ž×—×™×§×” ×œ×¦×ž×™×ª×•×ª</h2><p>×œ× × ×™×ª×Ÿ ×œ×©×—×–×¨ ×¤×¢×•×œ×” ×–×• ×ž×’×™×‘×•×™ ×©×˜×¨× × ×•×¦×¨.</p></div>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}><X size={18} /></button>
            </div>
            <form onSubmit={permanentDelete}>
              <div className="permanent-delete-warning"><AlertTriangle size={22} /><div><strong>{deleteTarget.name}</strong><p>×”×¤×¨×•×™×§×˜, ×”×ž×©×™×ž×•×ª, ×”×ª×©×œ×•×ž×™×, ×”×ž×¡×ž×›×™×, ×”×˜×¤×¡×™× ×•×”×™×¡×˜×•×¨×™×™×ª ×œ×•×— ×”×©× ×” ×©×œ×• ×™×™×ž×—×§×•.</p></div></div>
              <div className="ops-form-grid">
                <label className="wide">×”×§×œ×™×“×• ××ª ×”×ž×¡×¤×¨ ×”×¡×™×“×•×¨×™: <b>{deleteTarget.serialCode}</b><input className="permanent-delete-code" autoFocus required value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} placeholder={deleteTarget.serialCode} /></label>
                <label className="wide">×¡×™×¡×ž×ª Administrator ×©×œ PROJECTS<input type="password" required autoComplete="current-password" value={deleteForm.password} onChange={(event) => setDeleteForm({ ...deleteForm, password: event.target.value })} /></label>
              </div>
              <div className="ops-modal-actions"><button type="button" className="ops-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>×‘×™×˜×•×œ</button><button className="danger permanent-delete-confirm" disabled={deleting || deleteForm.confirmation.trim().toUpperCase() !== deleteTarget.serialCode.toUpperCase() || !deleteForm.password}>{deleting ? "×ž×•×—×§..." : "×ž×—×™×§×” ×¡×•×¤×™×ª"}</button></div>
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
                    <em>{projectCategoryText(project)} Â· {projectClassificationLabels[project.projectClassification] || "×‘×™×ª ×¤×¨×˜×™"}</em>
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
          <h2>×ž×¤×ª ×¤×¨×•×™×§×˜×™× ×—×™×”</h2>
          <p>×ª×ž×•× ×ª ×ž×¦×‘ ×’××•×’×¨×¤×™×ª ×©×œ ×”×¤×¨×•×™×§×˜×™× ×”×¤×¢×™×œ×™×</p>
        </div>
        <div className="map-stat">
          <MapPin size={18} />
          <strong>{projects.length}</strong> ×ž×™×§×•×ž×™× ×ž×•×¦×’×™×
        </div>
      </div>
      <div className="map-workspace panel">
        <div className="map-sidebar">
          <label className="table-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="×—×™×¤×•×© ×›×ª×•×‘×ª, ×œ×§×•×— ××• ×¤×¨×•×™×§×˜..."
            />
          </label>
          <div className="map-filter-title">
            <span>{visible.length} ×¤×¨×•×™×§×˜×™×</span>
            <small>×¡×™× ×•×Ÿ ×œ×¤×™ ×©×œ×‘ ×‘×ž×§×¨×</small>
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
                    {p.location} Â· {p.progress}%
                  </span>
                </div>
                <ChevronLeft size={17} />
              </button>
            ))}
          </div>
          <div className="map-legend">
            <span>×ž×§×¨× ×©×œ×‘×™×</span>
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
                <span>×”×ª×§×“×ž×•×ª</span>
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
                ×¤×ª×— ×ª×™×§ ×¤×¨×•×™×§×˜ <ArrowLeft size={15} />
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
          <h2>×œ×§×•×—×•×ª ×•×× ×©×™ ×§×©×¨</h2>
          <p>×ž×¨×›×– ×ž×™×“×¢ ×ž××•×—×“ ×œ×›×œ ×”×œ×§×•×—×•×ª ×•×”×©×•×ª×¤×™× ×‘×¤×¨×•×™×§×˜×™×</p>
        </div>
        <button className="secondary-button">
          <Upload size={17} />
          ×™×™×‘×•× ×œ×§×•×—×•×ª
        </button>
      </div>
      <div className="client-stats">
        <div>
          <Users />
          <span>
            ×¡×”×´×› ×œ×§×•×—×•×ª<strong>48</strong>
          </span>
        </div>
        <div>
          <Building2 />
          <span>
            ×œ×§×•×—×•×ª ×¢×¡×§×™×™×<strong>11</strong>
          </span>
        </div>
        <div>
          <FolderKanban />
          <span>
            ×¤×¨×•×™×§×˜×™× ×ž×©×•×™×›×™×<strong>64</strong>
          </span>
        </div>
        <div>
          <TrendingUp />
          <span>
            ×©×•×•×™ ×œ×§×•×— ×ž×ž×•×¦×¢<strong>â‚ª286K</strong>
          </span>
        </div>
      </div>
      <div className="panel clients-panel">
        <div className="toolbar">
          <label className="table-search">
            <Search size={18} />
            <input placeholder="×—×™×¤×•×© ×œ×§×•×—, ××™×© ×§×©×¨ ××• ×˜×œ×¤×•×Ÿ..." />
          </label>
          <button className="filter-button">
            <Filter size={17} />
            ×¡×™× ×•×Ÿ
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
                  <span>×¤×¨×•×™×§×˜×™×</span>
                  <strong>{client.projects}</strong>
                </div>
                <div>
                  <span>×”×™×§×£ ×¤×¢×™×œ×•×ª</span>
                  <strong>{money.format(client.total)}</strong>
                </div>
              </div>
              <span className="client-open">
                ×¤×ª×™×—×ª ×›×¨×˜×™×¡ ×œ×§×•×— <ChevronLeft size={15} />
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
      title: "×¡×§×¨ ××ª×¨ ×•××¤×™×•×Ÿ ×¨××©×•× ×™",
      desc: "×¤×¨×˜×™ × ×›×¡, ×¦×¨×›×™×, ×ž×¢×¨×›×•×ª ×•×ª×©×ª×™×•×ª ×§×™×™×ž×•×ª",
      fields: 28,
      uses: 14,
      icon: ClipboardCheck,
      tone: "purple",
    },
    {
      title: "×‘×“×™×§×ª ×ª×©×ª×™×•×ª ×œ×¤× ×™ ×”×ª×§× ×”",
      desc: "×œ×•×—×•×ª, ×¦× ×¨×ª, × ×§×•×“×•×ª ×—×©×ž×œ ×•×ª×§×©×•×¨×ª",
      fields: 36,
      uses: 9,
      icon: CheckCircle2,
      tone: "blue",
    },
    {
      title: "×¤×¨×•×˜×•×§×•×œ ×ž×¡×™×¨×ª ×ž×¢×¨×›×ª",
      desc: "×‘×“×™×§×•×ª ×¡×•×¤×™×•×ª, ×”×“×¨×›×”, ×§×•×“×™× ×•×—×ª×™×ž×ª ×œ×§×•×—",
      fields: 42,
      uses: 21,
      icon: FileText,
      tone: "green",
    },
    {
      title: "×“×•×— ×‘×™×§×•×¨ ×˜×›× ××™",
      desc: "×ª×§×œ×•×ª, ×¤×¢×•×œ×•×ª ×©×‘×•×¦×¢×•, ×—×œ×§×™× ×•×ª×ž×•× ×•×ª",
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
          <h2>×ž×¡×ž×›×™× ×•×”×§×œ×˜×•×ª</h2>
          <p>×ª×‘× ×™×•×ª ×—×›×ž×•×ª ×œ×ª×™×¢×•×“ ××—×™×“ ×‘×›×œ ×©×œ×‘×™ ×”×¤×¨×•×™×§×˜</p>
        </div>
        <button
          className="primary-button"
          onClick={() => setNotice("×‘×•× ×” ×”×˜×¤×¡×™× ×™×ª×•×•×¡×£ ×‘×’×¨×¡×” ×”×‘××”")}
        >
          <Plus size={17} />
          ×ª×‘× ×™×ª ×—×“×©×”
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
            <span>×ª×‘× ×™×ª ×¤×¢×™×œ×”</span>
            <h3>{title}</h3>
            <p>{desc}</p>
            <div className="form-meta">
              <span>
                <FormInput size={15} />
                {fields} ×©×“×•×ª
              </span>
              <span>
                <FileText size={15} />
                {uses} ×ž×™×œ×•×™×™×
              </span>
            </div>
            <div className="form-actions">
              <button onClick={() => setNotice("×”×ª×¦×•×’×” ×”×ž×§×“×™×ž×” ×ž×•×›× ×” ×œ×‘×“×™×§×”")}>
                ×ª×¦×•×’×” ×ž×§×“×™×ž×”
              </button>
              <button onClick={() => setNotice("×ž×¦×‘ ×”×¢×¨×™×›×” ×™×ª×•×•×¡×£ ×‘×’×¨×¡×” ×”×‘××”")}>
                ×¢×¨×™×›×”
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="panel files-overview">
        <PanelHead
          title="×ž×¡×ž×›×™× ××—×¨×•× ×™×"
          subtitle="×§×‘×¦×™× ×©×”×•×¢×œ×• ×œ××—×¨×•× ×” ×œ×¤×¨×•×™×§×˜×™×"
          action="×›×œ ×”×ž×¡×ž×›×™×"
        />
        <div className="documents-list">
          {[
            "×ª×•×›× ×™×ª ×—×©×ž×œ - ×§×•×ž×” ××³.pdf",
            "×›×ª×‘ ×›×ž×•×™×•×ª KNX.xlsx",
            "×ª×ž×•× ×•×ª ×œ×•×— ×ª×§×©×•×¨×ª.zip",
            "×¤×¨×•×˜×•×§×•×œ ×ž×¡×™×¨×” ×—×ª×•×.pdf",
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
                      "×•×™×œ×” ×ž×©×¤×—×ª ×›×”×Ÿ",
                      "×‘×™×ª ×ž×©×¤×—×ª ××œ×•×Ÿ",
                      "×¤× ×˜×”××•×– ×ž×©×¤×—×ª ×‘×¨×§",
                      "×“×™×¨×ª ×ž×©×¤×—×ª ×œ×‘×™×",
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
          <h2>×ª×©×œ×•×ž×™× ×•×’×‘×™×™×”</h2>
          <p>×‘×§×¨×ª ×ª×–×¨×™×, ××‘× ×™ ×“×¨×š ×œ×ª×©×œ×•× ×•×™×ª×¨×•×ª ×¤×ª×•×—×•×ª</p>
        </div>
        <button className="secondary-button">
          <FileText size={17} />
          ×”×¤×§×ª ×“×•×—
        </button>
      </div>
      <div className="finance-hero">
        <div>
          <span>×”×™×§×£ ×—×•×–×™× ×›×•×œ×œ</span>
          <strong>{money.format(total)}</strong>
          <small>
            <TrendingUp size={14} />
            8.2% ×ž×”×¨×‘×¢×•×Ÿ ×”×§×•×“×
          </small>
        </div>
        <div
          className="collection-ring"
          style={{
            "--percent": `${Math.round((paid / total) * 100) * 3.6}deg`,
          }}
        >
          <span>
            <strong>{Math.round((paid / total) * 100)}%</strong>× ×’×‘×”
          </span>
        </div>
        <div className="finance-split">
          <div>
            <i className="green" />
            <span>
              ×”×ª×§×‘×œ<strong>{money.format(paid)}</strong>
            </span>
          </div>
          <div>
            <i className="orange" />
            <span>
              ×™×ª×¨×” ×¤×ª×•×—×”<strong>{money.format(total - paid)}</strong>
            </span>
          </div>
        </div>
      </div>
      <div className="panel finance-table-wrap">
        <PanelHead
          title="×ž×¦×‘ ×’×‘×™×™×” ×œ×¤×™ ×¤×¨×•×™×§×˜"
          subtitle="×œ×—×™×¦×” ×¢×œ ×©×•×¨×” ×ª×¤×ª×— ××ª ×ª×™×§ ×”×¤×¨×•×™×§×˜"
        />
        <table className="projects-table finance-table">
          <thead>
            <tr>
              <th>×¤×¨×•×™×§×˜ ×•×œ×§×•×—</th>
              <th>×©×•×•×™ ×—×•×–×”</th>
              <th>×©×•×œ×</th>
              <th>×™×ª×¨×”</th>
              <th>××—×•×– ×’×‘×™×™×”</th>
              <th>×¡×˜×˜×•×¡</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const percent = Math.round((p.paid / p.value) * 100);
              const overdue = p.flag.includes("×ª×©×œ×•×");
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
                      {overdue ? "×‘××™×—×•×¨" : percent === 100 ? "×©×•×œ×" : "×ª×§×™×Ÿ"}
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
    { title: "××¤×™×•×Ÿ ×•×—×ª×™×ž×ª ×—×•×–×”", status: "done", date: "12.03.2026" },
    { title: "××™×©×•×¨ ×ª×•×›× ×™×•×ª ×‘×™×¦×•×¢", status: "done", date: "28.05.2026" },
    { title: project.nextMilestone, status: "current", date: project.due },
    { title: "×ª×›× ×•×ª, ×‘×“×™×§×•×ª ×•×ª×¨×—×™×©×™×", status: "future", date: "08.09.2026" },
    { title: "×ž×¡×™×¨×” ×•×”×“×¨×›×ª ×œ×§×•×—", status: "future", date: "22.09.2026" },
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
              <span>Â·</span>
              <MapPin size={15} />
              {project.address}
            </p>
          </div>
        </div>
        <div className="project-hero-actions">
          <button className="secondary-button" disabled={!canEdit}>
            <MessageSquare size={16} />
            ×”×•×¡×¤×ª ×¢×“×›×•×Ÿ
          </button>
          <button className="icon-button" disabled={!canEdit}>
            <MoreHorizontal />
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
              <option value="">×œ×œ× ×ž× ×”×œ</option>
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
                    {item.linkedUserId ? " Â· ×ž×©×ª×ž×© ×ž×¢×¨×›×ª" : ""}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <span>×™×¢×“ ×œ××‘×Ÿ ×“×¨×š</span>
            <strong>{project.due}</strong>
            <small>{project.nextMilestone}</small>
          </div>
        </div>
      </div>
      <div className="detail-tabs">
        {[
          ["overview", "×¡×§×™×¨×”"],
          ["tasks", "×ž×©×™×ž×•×ª ×•××‘× ×™ ×“×¨×š"],
          ["systems", "×ž×¢×¨×›×•×ª"],
          ["forms", "×˜×¤×¡×™× ×•×§×‘×¦×™×"],
          ["finance", "×›×¡×¤×™×"],
          ["activity", "×¤×¢×™×œ×•×ª"],
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
                title="×”×ª×§×“×ž×•×ª ×”×¤×¨×•×™×§×˜"
                subtitle={`${project.tasksDone} ×ž×ª×•×š ${project.tasksTotal} ×ž×©×™×ž×•×ª ×”×•×©×œ×ž×•`}
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
              <PanelHead title="×ž×¢×¨×›×•×ª ×‘×¤×¨×•×™×§×˜" action="× ×™×”×•×œ ×ž×¢×¨×›×•×ª" />
              <div className="system-tiles">
                {project.systems.map((system, index) => (
                  <div key={system}>
                    <span className={`system-icon s${index % 4}`}>
                      <Command size={18} />
                    </span>
                    <strong>{system}</strong>
                    <small>{index < 2 ? "×”×ª×§× ×” ×‘×ª×”×œ×™×š" : "×˜×¨× ×”×ª×—×™×œ"}</small>
                    <CheckCircle2 size={17} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="detail-side">
            <div className="panel contact-card">
              <PanelHead title="×¤×¨×˜×™ ×œ×§×•×—" />
              <div className="contact-person">
                <div className="client-avatar">
                  {project.client.slice(0, 2)}
                </div>
                <div>
                  <strong>{project.client}</strong>
                  <span>×œ×§×•×— ×¨××©×™</span>
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
              <PanelHead title="×¡×™×›×•× ×›×¡×¤×™" />
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
                <strong>{money.format(dueAmount)}</strong>
              </div>
              <div className="money-progress">
                <i
                  style={{ width: `${(project.paid / project.value) * 100}%` }}
                />
              </div>
              <small>
                {Math.round((project.paid / project.value) * 100)}% × ×’×‘×”
              </small>
              <button onClick={() => setTab("finance")}>
                ×œ×¤×™×¨×•×˜ ×ª×©×œ×•×ž×™× <ChevronLeft size={15} />
              </button>
            </div>
            <div className="panel quick-notes">
              <PanelHead title="×”×¢×¨×” ×ž×”×™×¨×”" />
              <textarea placeholder="×›×ª×‘×• ×¢×“×›×•×Ÿ ×œ×¦×•×•×ª..." />
              <button>×¤×¨×¡×•× ×¢×“×›×•×Ÿ</button>
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
      "×ž×©×™×ž×•×ª ×•××‘× ×™ ×“×¨×š",
      "× ×™×”×•×œ ×”×ž×©×™×ž×•×ª ×”×ž×œ× ×™×›×œ×•×œ ××—×¨××™×, ×ª××¨×™×›×™ ×™×¢×“ ×•×ª×œ×•×™×•×ª ×‘×™×Ÿ ×©×œ×‘×™×.",
      ClipboardCheck,
    ],
    systems: [
      "×ž×¢×¨×›×•×ª ×‘×¤×¨×•×™×§×˜",
      `${project.systems.length} ×ž×¢×¨×›×•×ª ×ž×©×•×™×›×•×ª ×œ×¤×¨×•×™×§×˜. ×‘×ž×¡×š ×”×ž×œ× ×™×•×¤×™×¢×• ×¦×™×•×“, ×“×’×ž×™× ×•×ª×•×¦××•×ª ×‘×“×™×§×”.`,
      Command,
    ],
    forms: [
      "×˜×¤×¡×™× ×•×§×‘×¦×™×",
      "×›××Ÿ ×™×¨×•×›×–×• ×¡×§×¨×™ ×”××ª×¨, ×ª×•×›× ×™×•×ª, ×ª×ž×•× ×•×ª, ×¤×¨×•×˜×•×§×•×œ×™× ×•×—×ª×™×ž×•×ª.",
      FileText,
    ],
    finance: [
      "×›×¡×¤×™× ×•×ª×©×œ×•×ž×™×",
      `× ×•×ª×¨×” ×™×ª×¨×” ×©×œ ${money.format(project.value - project.paid)} ×œ×’×‘×™×™×” ×‘×¤×¨×•×™×§×˜.`,
      CreditCard,
    ],
    activity: [
      "×™×•×ž×Ÿ ×¤×¢×™×œ×•×ª",
      "×›×œ ×©×™× ×•×™, ×¢×“×›×•×Ÿ, ×§×•×‘×¥ ×•×ª×©×œ×•× ×™×ª×•×¢×“×• ×›××Ÿ ×œ×¤×™ ×–×ž×Ÿ ×•×ž×©×ª×ž×©.",
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
        ×”×•×¡×¤×ª ×¤×¨×™×˜
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
      nextMilestone: "×¤×’×™×©×ª ××¤×™×•×Ÿ ×¨××©×•× ×™×ª",
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
              <span>××©×£ ×¤×¨×•×™×§×˜ ×—×“×© Â· ×©×œ×‘ 1 ×ž×ª×•×š 3</span>
              <h2>×œ×§×•×— ×•×–×”×•×ª ×”×¤×¨×•×™×§×˜</h2>
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
              ×©× ×”×¤×¨×•×™×§×˜
              <input
                autoFocus
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="×œ×“×•×’×ž×”: ×•×™×œ×” ×ž×©×¤×—×ª ×™×©×¨××œ×™"
              />
            </label>
            <label>×ª×—×•× ×”×¤×¨×•×™×§×˜<select value={form.projectCategory} onChange={(event)=>setForm({...form,projectCategory:event.target.value})}><option value="smart_home">×‘×™×ª ×—×›×</option><option value="other">××—×¨</option></select></label>
            {form.projectCategory==='other'&&<><label>×¡×•×’ ×¤×¨×•×™×§×˜ ×—×•×¤×©×™<input required value={form.projectCategoryCustom} onChange={(event)=>setForm({...form,projectCategoryCustom:event.target.value})} placeholder="×œ×“×•×’×ž×”: ×ž×¨×›×– ×”×“×¨×›×”"/></label><div className="wide project-profile-fields"><label>×©× ×ª×”×œ×™×š ×¢×‘×•×“×”<input value={form.projectProfile.workflowLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,workflowLabel:event.target.value}})} placeholder="××•×¤×¦×™×•× ×œ×™"/></label><label>×©× ××–×•×¨ ×”×ž×¢×¨×›×•×ª<input value={form.projectProfile.systemsLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,systemsLabel:event.target.value}})} placeholder="××•×¤×¦×™×•× ×œ×™"/></label><label>×©× ××–×•×¨×™ ×”×¢×‘×•×“×”<input value={form.projectProfile.areasLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,areasLabel:event.target.value}})} placeholder="××•×¤×¦×™×•× ×œ×™"/></label></div></>}
            {form.projectCategory==='smart_home'&&<label>
              ×¡×™×•×•×’ ×”×¤×¨×•×™×§×˜
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
                ×œ×§×•×— ×§×™×™×
              </button>
              <button
                type="button"
                className={form.clientMode === "new" ? "active" : ""}
                onClick={() =>
                  setForm({ ...form, clientMode: "new", clientId: "" })
                }
              >
                ×œ×§×•×— ×—×“×©
              </button>
            </div>
            {form.clientMode === "existing" ? (
              <div className="form-row">
                <label>
                  ×œ×§×•×—
                  <select
                    required
                    value={form.clientId}
                    onChange={(event) =>
                      setForm({ ...form, clientId: event.target.value })
                    }
                  >
                    <option value="">×‘×—×™×¨×ª ×œ×§×•×— ×ž×”×ž××’×¨</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} Â· {client.address}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ×¢×™×¨ / ×ž×™×§×•×
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                    placeholder="× ×œ×§×— ×ž×›×ª×•×‘×ª ×”×œ×§×•×— ×× ×¨×™×§"
                  />
                </label>
              </div>
            ) : (
              <div className="new-client-fields">
                <p>×”×œ×§×•×— ×™×™×•×•×¦×¨ ××•×˜×•×ž×˜×™×ª ×‘×ž××’×¨ ×•×™×§×•×©×¨ ×œ×¤×¨×•×™×§×˜.</p>
                <div className="form-row">
                  <label>
                    ×©× ×¤×¨×˜×™
                    <input
                      required
                      value={form.clientFirstName}
                      onChange={(event) =>
                        setForm({ ...form, clientFirstName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    ×©× ×ž×©×¤×—×”
                    <input required value={form.clientLastName} onChange={(event) => setForm({ ...form, clientLastName: event.target.value })}/>
                  </label>
                  <label>
                    ×˜×œ×¤×•×Ÿ
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
                  ×¢×™×¨
                  <input
                    value={form.clientCity}
                    onChange={(event) =>
                      setForm({ ...form, clientCity: event.target.value })
                    }
                  />
                </label>
                <label>
                  ×“×•××´×œ
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
                ×‘×™×˜×•×œ
              </button>
              <button className="primary-button" type="submit">
                ×”×ž×©×š <ArrowLeft size={16} />
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
            <span>××©×£ ×¤×¨×•×™×§×˜ ×—×“×© Â· ×©×œ×‘ {step} ×ž×ª×•×š 3</span>
            <h2>
              {step === 1
                ? "×œ×§×•×— ×•×–×”×•×ª ×”×¤×¨×•×™×§×˜"
                : step === 2
                  ? "× ×™×”×•×œ ×•×œ×•×—×•×ª ×–×ž× ×™×"
                  : "×ž×¢×¨×›×•×ª ×•×¡×§×™×¨×”"}
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
                ×©× ×”×¤×¨×•×™×§×˜
                <input
                  autoFocus
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="×œ×“×•×’×ž×”: ×•×™×œ×” ×ž×©×¤×—×ª ×™×©×¨××œ×™"
                />
              </label>
              <label>×ª×—×•× ×”×¤×¨×•×™×§×˜<select value={form.projectCategory} onChange={(event)=>setForm({...form,projectCategory:event.target.value})}><option value="smart_home">×‘×™×ª ×—×›×</option><option value="other">××—×¨</option></select></label>
              {form.projectCategory==='other'&&<><label>×¡×•×’ ×¤×¨×•×™×§×˜ ×—×•×¤×©×™<input required value={form.projectCategoryCustom} onChange={(event)=>setForm({...form,projectCategoryCustom:event.target.value})} placeholder="×œ×“×•×’×ž×”: ×ž×¨×›×– ×”×“×¨×›×”"/></label><div className="wide project-profile-fields"><label>×©× ×ª×”×œ×™×š ×¢×‘×•×“×”<input value={form.projectProfile.workflowLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,workflowLabel:event.target.value}})}/></label><label>×©× ××–×•×¨ ×”×ž×¢×¨×›×•×ª<input value={form.projectProfile.systemsLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,systemsLabel:event.target.value}})}/></label><label>×©× ××–×•×¨×™ ×”×¢×‘×•×“×”<input value={form.projectProfile.areasLabel} onChange={(event)=>setForm({...form,projectProfile:{...form.projectProfile,areasLabel:event.target.value}})}/></label></div></>}
              {form.projectCategory==='smart_home'&&<label>
                ×¡×™×•×•×’ ×”×¤×¨×•×™×§×˜
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
                  ×œ×§×•×— ×§×™×™×
                </button>
                <button
                  type="button"
                  className={form.clientMode === "new" ? "active" : ""}
                  onClick={() =>
                    setForm({ ...form, clientMode: "new", clientId: "" })
                  }
                >
                  ×œ×§×•×— ×—×“×©
                </button>
              </div>
              {form.clientMode === "existing" ? (
                <div className="form-row">
                  <label>
                    ×œ×§×•×—
                    <select
                      required
                      value={form.clientId}
                      onChange={(e) =>
                        setForm({ ...form, clientId: e.target.value })
                      }
                    >
                      <option value="">×‘×—×™×¨×ª ×œ×§×•×— ×ž×”×ž××’×¨</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} Â· {client.address}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ×¢×™×¨ / ×ž×™×§×•×
                    <input
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                      placeholder="× ×œ×§×— ×ž×›×ª×•×‘×ª ×”×œ×§×•×— ×× ×¨×™×§"
                    />
                  </label>
                </div>
              ) : (
                <div className="new-client-fields">
                  <p>×”×œ×§×•×— ×™×™×•×•×¦×¨ ××•×˜×•×ž×˜×™×ª ×‘×ž××’×¨ ×•×™×§×•×©×¨ ×œ×¤×¨×•×™×§×˜.</p>
                  <div className="form-row">
                    <label>
                      ×©× ×¤×¨×˜×™
                      <input
                        required
                        value={form.clientFirstName}
                        onChange={(e) =>
                          setForm({ ...form, clientFirstName: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      ×©× ×ž×©×¤×—×”
                      <input required value={form.clientLastName} onChange={(e) => setForm({ ...form, clientLastName: e.target.value })}/>
                    </label>
                    <label>
                      ×˜×œ×¤×•×Ÿ
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
                      ×›×ª×•×‘×ª
                      <input
                        required
                        value={form.clientAddress}
                        onChange={(e) =>
                          setForm({ ...form, clientAddress: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      ×¢×™×¨
                      <input
                        value={form.clientCity}
                        onChange={(e) =>
                          setForm({ ...form, clientCity: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    ×“×•××´×œ
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
                ×ª×‘× ×™×ª ×¢×‘×•×“×”
                <select value={form.templateId} onChange={(e)=>setForm({...form,templateId:e.target.value})}>
                  <option value="">×¤×¨×•×™×§×˜ ×¨×™×§ â€” ×œ×œ× ×ª×‘× ×™×ª</option>
                  {templates.filter(item=>item.active).map(template=><option key={template.id} value={template.id}>{template.name} Â· {template.task_count} ×ž×©×™×ž×•×ª</option>)}
                </select>
                <small>×”×ª×‘× ×™×ª ×ª×™×¦×•×¨ ××•×˜×•×ž×˜×™×ª ×ž×©×™×ž×•×ª, ×ª×œ×•×ª ×•×™×¢×“×™ ×©×¢×•×ª ×”×—×œ ×ž×ª××¨×™×š ×”×”×ª×—×œ×”.</small>
              </label>
              <div className="form-row">
                <label>
                  ×ž× ×”×œ ×¤×¨×•×™×§×˜
                  <select
                    value={form.managerId}
                    onChange={(e) =>
                      setForm({ ...form, managerId: e.target.value })
                    }
                  >
                    <option value="">×œ×œ× ×ž× ×”×œ</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ×©×œ×‘ ×”×ª×—×œ×ª×™
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
                      : [["planning", "×ª×›× ×•×Ÿ"]]
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
                  ×ª××¨×™×š ×”×ª×—×œ×”
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
                  ×™×¢×“ ×ž×¡×™×¨×”
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
                <label>××™×™×§×•×Ÿ ×ž×•×‘×™×œ<select value={form.projectIcon} onChange={(event)=>setForm({...form,projectIcon:event.target.value})}><option value="home">×‘×™×ª ×¤×¨×˜×™</option><option value="villa">×•×™×œ×”</option><option value="cottage">×§×•×˜×’×³</option><option value="building">×‘× ×™×™×Ÿ ×ž×©×•×ª×£</option><option value="penthouse">×¤× ×˜×”××•×–</option><option value="studio">×¡×˜×•×“×™×•</option></select></label>
                <label>×¦×‘×¢ ×ž×•×‘×™×œ<input type="color" value={form.projectColor} onChange={(event)=>setForm({...form,projectColor:event.target.value})}/></label>
                <label>×¨××© ×¦×•×•×ª ×”×ª×§× ×”<select value={form.installationLeadId} onChange={(event)=>setForm({...form,installationLeadId:event.target.value})}><option value="">×œ×œ× ×”×§×¦××”</option>{professionals.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
              </div>
              {user.financeAccess!==false&&<label>
                ×©×•×•×™ ×ž×©×•×¢×¨
                <input
                  type="number"
                  min="0"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="â‚ª 0"
                />
              </label>}
              <div className="form-row project-hour-target-fields">
                <label>
                  ×™×¢×“ ×©×¢×•×ª ×”×ª×§× ×”
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.installationHoursTarget}
                    onChange={(e) => setForm({ ...form, installationHoursTarget: e.target.value })}
                    placeholder="×œ×œ× ×™×¢×“"
                  />
                </label>
                <label>
                  ×™×¢×“ ×©×¢×•×ª ×ª×›× ×•×ª
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.programmingHoursTarget}
                    onChange={(e) => setForm({ ...form, programmingHoursTarget: e.target.value })}
                    placeholder="×œ×œ× ×™×¢×“"
                  />
                </label>
              </div>
              <p className="time-target-note">×”×™×¢×“×™× ×ž×™×•×¢×“×™× ×¨×§ ×œ×”×ª×§× ×” ×•×œ×ª×›× ×•×ª. ×™×ª×¨ ×”×¤×¢×™×œ×•×™×•×ª × ×ž×“×“×•×ª ×‘×¤×•×¢×œ ×œ×œ× ×™×¢×“.</p>
              {user.financeAccess!==false&&<fieldset className="project-finance-wizard">
                <legend><label className="finance-paid-check"><input type="checkbox" checked={form.financeEnabled} onChange={(event)=>setForm({...form,financeEnabled:event.target.checked})}/>×”×¤×¢×œ×ª ××©×£ ×›×¡×¤×™× ××•×¤×¦×™×•× ×œ×™</label></legend>
                {form.financeEnabled&&<><label>××•×¤×Ÿ ×ª×§×¦×•×‘<select value={form.financeMode} onChange={(event)=>setForm({...form,financeMode:event.target.value})}><option value="total">×¡×›×•× ×›×œ×œ×™</option><option value="systems">×¡×›×•× ×ž×¤×•×¦×œ ×œ×›×œ ×ž×¢×¨×›×ª</option></select></label><label>×ª× ××™ ×ª×©×œ×•×<input value={form.paymentTerms} onChange={(event)=>setForm({...form,paymentTerms:event.target.value})} placeholder="×œ×“×•×’×ž×”: 30% ×ž×§×“×ž×”, ×™×ª×¨×” ×œ×¤×™ ××‘× ×™ ×“×¨×š"/></label><label>×ž×§×“×ž×”<input type="number" min="0" step="0.01" value={form.depositAmount} onChange={(event)=>setForm({...form,depositAmount:event.target.value})}/></label><label className="finance-paid-check"><input type="checkbox" checked={form.depositPaid} onChange={(event)=>setForm({...form,depositPaid:event.target.checked})}/>×”×ž×§×“×ž×” ×©×•×œ×ž×”</label></>}
              </fieldset>}
            </>
          )}
          {step === 3 && (
            <>
              <p className="wizard-help">
                ×‘×—×¨×• ×ž×¢×¨×›×•×ª ×¨××©×•× ×™×•×ª ×•×›×ž×•×ª. ××¤×©×¨ ×œ×”×•×¡×™×£, ×œ×©× ×•×ª ××• ×œ×”×¡×™×¨ ×‘×”×ž×©×š
                ×ž×ª×•×š ×”×¤×¨×•×™×§×˜.
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
                          {form.financeEnabled&&form.financeMode==="systems"&&Number(form.selectedEquipment[item.id])>0&&<input type="number" min="0" step="0.01" placeholder="×¡×›×•× ×œ×ž×¢×¨×›×ª" value={form.systemBudgets[item.id]||""} onChange={(event)=>setForm({...form,systemBudgets:{...form.systemBudgets,[item.id]:event.target.value}})}/>}
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
              {step === 1 ? "×‘×™×˜×•×œ" : "×—×–×¨×”"}
            </button>
            <button className="primary-button" type="submit">
              {step === 3 ? "×™×¦×™×¨×ª ×¤×¨×•×™×§×˜" : "×”×ž×©×š"} <ArrowLeft size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}

export default App;




