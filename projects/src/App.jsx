import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, Bell, Building2, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronLeft, CircleDollarSign, ClipboardCheck, Clock3, Command, CreditCard,
  FileText, Filter, Flag, FolderKanban, FormInput, Gauge, Home, LayoutDashboard, ListFilter,
  Database, LogOut, Mail, Map, MapPin, Menu, MessageSquare, MoreHorizontal, Phone, Plus, RotateCcw, Search, Settings,
  ShieldCheck, SlidersHorizontal, Sparkles, Tag, TrendingUp, Upload, UserRound, Users, WalletCards, X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { activity, clients, milestones, stageMeta } from './data';
import { AlertCenter, CalendarWorkspace, ClientsWorkspace, InsightsTile, OperationalSettings } from './Operational';
import './operational.css';
import projectsMark from './assets/projects-mark.svg';

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const compactMoney = (value) => value >= 1000000 ? `₪${(value / 1000000).toFixed(2)}M` : `₪${Math.round(value / 1000)}K`;
const actionNamesForDashboard = { create: 'יצר רשומה', update: 'עדכן רשומה', delete: 'מחק רשומה', upload: 'העלה קובץ', login: 'נכנס למערכת', snooze: 'דחה התראה', backup: 'יצר גיבוי' };
const ingressRoot = window.location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/)?.[1] || '';
export const apiRoot = `${ingressRoot}/api`;

export async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${apiRoot}${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: isFormData ? { ...options.headers } : { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

const nav = [
  { id: 'dashboard', label: 'תמונת מצב', icon: LayoutDashboard },
  { id: 'calendar', label: 'לוח שנה', icon: CalendarDays },
  { id: 'projects', label: 'פרויקטים', icon: FolderKanban, badge: 12 },
  { id: 'map', label: 'מפת פרויקטים', icon: Map },
  { id: 'clients', label: 'לקוחות ואנשי קשר', icon: Users },
  { id: 'forms', label: 'טפסים ומסמכים', icon: FormInput },
  { id: 'finance', label: 'תשלומים וגבייה', icon: WalletCards, badge: 3 },
];

function StatusBadge({ stage, compact = false }) {
  const meta = stageMeta[stage] || stageMeta.planning;
  return <span className={`status-badge ${compact ? 'compact' : ''}`} style={{ '--status': meta.color, '--status-soft': meta.soft }}><i />{meta.label}</span>;
}

function ProjectMarker({ project, onOpen }) {
  const meta = stageMeta[project.stage];
  const icon = useMemo(() => L.divIcon({
    className: 'project-map-marker-wrap',
    html: `<div class="project-map-marker" style="--marker:${meta.color}"><span>${project.progress}%</span></div>`,
    iconSize: [48, 56], iconAnchor: [24, 53], popupAnchor: [0, -48],
  }), [meta.color, project.progress]);
  return (
    <Marker position={[project.lat, project.lng]} icon={icon}>
      <Popup className="project-popup">
        <div className="map-popup-content" dir="rtl">
          <div className="eyebrow">{project.id}</div>
          <strong>{project.name}</strong>
          <span>{project.address}</span>
          <div className="popup-progress"><i style={{ width: `${project.progress}%`, background: meta.color }} /></div>
          <button onClick={() => onOpen(project)}>פתח פרויקט <ArrowLeft size={14} /></button>
        </div>
      </Popup>
    </Marker>
  );
}

function App() {
  const [page, setPage] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [insights, setInsights] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(true);

  useEffect(() => {
    api('/auth/me').then(({ user: currentUser }) => Promise.all([currentUser, api('/projects')]))
      .then(([currentUser, result]) => { setUser(currentUser); setProjects(result.projects); })
      .catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!user) return undefined;
    const loadInsights = () => api('/insights').then((result) => { setInsights(result); if (result.alerts.length) setAlertsOpen(true); }).catch(() => {});
    loadInsights();
    const timer = setInterval(loadInsights, 60000);
    return () => clearInterval(timer);
  }, [user?.id]);

  const openProject = (project) => { setSelectedProject(project); setPage('project'); setSidebarOpen(false); };
  const updateProject = async (id, patch) => {
    try {
      const { project } = await api(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setProjects((current) => current.map((item) => item.id === id ? project : item));
      setSelectedProject((current) => current?.id === id ? project : current);
      setNotice('השינוי נשמר בהצלחה');
    } catch (error) { setNotice(error.message); }
  };

  const createProject = async (project) => {
    try {
      const result = await api('/projects', { method: 'POST', body: JSON.stringify(project) });
      setProjects((current) => [result.project, ...current]);
      setNewProjectOpen(false);
      setNotice('הפרויקט החדש נוצר');
      openProject(result.project);
    } catch (error) { setNotice(error.message); }
  };

  const login = async (credentials) => {
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    const projectResult = await api('/projects');
    setUser(result.user);
    setProjects(projectResult.projects);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setProjects([]);
  };

  if (loading) return <div className="app-loader"><div className="brand-mark"><img src={projectsMark} alt="" /></div><strong><b>PRO</b>JECTS</strong><span>טוען מערכת...</span></div>;
  if (!user) return <LoginPage onLogin={login} />;

  const filteredProjects = projects.filter((project) => {
    const haystack = `${project.name} ${project.client} ${project.location} ${project.id}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (stageFilter === 'all' || project.stage === stageFilter);
  });

  const pageTitle = selectedProject && page === 'project' ? selectedProject.name : page === 'users' ? 'משתמשים והרשאות' : page === 'settings' ? 'גיבוי ומערכת' : nav.find((item) => item.id === page)?.label || 'תמונת מצב';
  const todayLabel = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><img src={projectsMark} alt="" /></div><div><strong><b>PRO</b>JECTS</strong><span>SMART PROJECT MANAGEMENT</span></div></div>
        <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="סגור תפריט"><X /></button>
        <div className="workspace-switch"><div className="workspace-logo">SH</div><div><strong>Smart Home Israel</strong><span>סביבת עבודה ראשית</span></div><ChevronDown size={16} /></div>
        <nav className="main-nav">
          <span className="nav-label">סביבת עבודה</span>
          {[...nav, ...(user.role === 'admin' ? [{ id: 'users', label: 'משתמשים והרשאות', icon: ShieldCheck }] : [])].map(({ id, label, icon: Icon, badge }) => (
            <button key={id} className={page === id || (page === 'project' && id === 'projects') ? 'active' : ''} onClick={() => { setPage(id); setSelectedProject(null); setSidebarOpen(false); }}>
              <Icon size={19} /><span>{label}</span>{badge && <em>{badge}</em>}
            </button>
          ))}
          <span className="nav-label nav-second">ניהול</span>
          <button><ClipboardCheck size={19} /><span>משימות ואבני דרך</span><em>7</em></button>
          <button><Tag size={19} /><span>מערכות וקטלוגים</span></button>
          <button><Activity size={19} /><span>דוחות וניתוחים</span></button>
        </nav>
        <div className="sidebar-footer">
          {user.role === 'admin' && <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><Settings size={19} /><span>גיבוי ומערכת</span></button>}
          <div className="user-card"><div className="avatar" style={{ background: user.avatarColor, color: '#fff' }}>{avatarGlyph(user)}<span /></div><div><strong>{user.displayName}</strong><span>{roleLabels[user.role]}</span></div><button className="logout-button" onClick={logout} title="יציאה"><LogOut size={17} /></button></div>
        </div>
      </aside>
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="title-block">
            {page === 'project' && <button className="back-button" onClick={() => setPage('projects')}><ChevronLeft size={19} /></button>}
            <div><span>{page === 'project' ? `${selectedProject?.id}  /  פרויקטים` : todayLabel}</span><h1>{pageTitle}</h1></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש בכל המערכת..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button"><Bell size={20} /><i /></button>
            {['admin', 'manager'].includes(user.role) && <button className="primary-button" onClick={() => setNewProjectOpen(true)}><Plus size={18} />פרויקט חדש</button>}
          </div>
        </header>

        <div className="page-content">
          {page === 'dashboard' && <Dashboard projects={projects} openProject={openProject} setPage={setPage} insights={insights} user={user} />}
          {page === 'calendar' && <CalendarWorkspace api={api} user={user} setNotice={setNotice} />}
          {page === 'projects' && <ProjectsPage projects={filteredProjects} search={search} setSearch={setSearch} stageFilter={stageFilter} setStageFilter={setStageFilter} openProject={openProject} />}
          {page === 'map' && <MapPage projects={filteredProjects} openProject={openProject} stageFilter={stageFilter} setStageFilter={setStageFilter} />}
          {page === 'clients' && <ClientsWorkspace api={api} apiRoot={apiRoot} user={user} setNotice={setNotice} />}
          {page === 'forms' && <FormsPage setNotice={setNotice} />}
          {page === 'finance' && <FinancePage projects={projects} openProject={openProject} />}
          {page === 'users' && user.role === 'admin' && <UsersPage setNotice={setNotice} />}
          {page === 'settings' && user.role === 'admin' && <OperationalSettings api={api} setNotice={setNotice} />}
          {page === 'project' && selectedProject && <ProjectDetail project={projects.find((p) => p.id === selectedProject.id) || selectedProject} updateProject={updateProject} canEdit={['admin', 'manager', 'technician'].includes(user.role)} />}
        </div>
      </main>
      {newProjectOpen && <NewProjectModal onClose={() => setNewProjectOpen(false)} onCreate={createProject} />}
      {alertsOpen && insights?.alerts?.length > 0 && <AlertCenter alerts={insights.alerts} api={api} setNotice={setNotice} onClose={() => setAlertsOpen(false)} onSnoozed={() => { setAlertsOpen(false); setInsights((current) => ({ ...current, alerts: [] })); }} />}
      {notice && <div className="toast"><CheckCircle2 size={19} />{notice}</div>}
    </div>
  );
}

const roleLabels = { admin: 'מנהל מערכת', manager: 'מנהל פרויקט', technician: 'טכנאי', finance: 'כספים', viewer: 'צופה' };
const avatarIcons = { user: 'אדם', wrench: 'כלי עבודה', hardhat: 'קסדה', lightning: 'חשמל', shield: 'מגן', star: 'כוכב' };
function avatarGlyph(user) { return ({ wrench: '🔧', hardhat: '⛑', lightning: 'ϟ', shield: '◆', star: '★' })[user.avatarIcon] || user.displayName.slice(0, 2); }

function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try { await onLogin(form); } catch (loginError) { setError(loginError.message); } finally { setSubmitting(false); }
  };
  return <div className="login-shell" dir="rtl"><div className="login-card"><div className="login-brand"><div className="brand-mark"><img src={projectsMark} alt="" /></div><strong><b>PRO</b>JECTS</strong><small>SMART PROJECT MANAGEMENT</small></div><div className="login-copy"><span>כניסה מאובטחת</span><h1>ברוכים הבאים</h1><p>התחברו למרחב ניהול הפרויקטים שלכם</p></div><form onSubmit={submit}><label>שם משתמש<input autoFocus autoComplete="username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>סיסמה<input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>{error && <div className="login-error">{error}</div>}<button className="primary-button" disabled={submitting}>{submitting ? 'מתחבר...' : 'כניסה למערכת'} <ArrowLeft size={17} /></button></form><small className="login-hint">בכניסה דרך Home Assistant הזיהוי מתבצע אוטומטית.</small></div></div>;
}

function UsersPage({ setNotice }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'viewer', avatarColor: '#6957df', avatarIcon: 'user' });
  const loadUsers = () => api('/users').then((result) => setUsers(result.users)).catch((error) => setNotice(error.message));
  useEffect(loadUsers, []);
  const createUser = async (event) => {
    event.preventDefault();
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ username: '', displayName: '', password: '', role: 'viewer', avatarColor: '#6957df', avatarIcon: 'user' });
      setNotice('המשתמש נוצר'); loadUsers();
    } catch (error) { setNotice(error.message); }
  };
  const updateUser = async (id, patch) => {
    try { await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); loadUsers(); setNotice('ההרשאה עודכנה'); }
    catch (error) { setNotice(error.message); }
  };
  return <div className="section-page users-page"><div className="page-intro"><div><h2>משתמשים והרשאות</h2><p>לכל משתמש זהות חזותית אישית; מותר לבחור צבע זהה למספר משתמשים.</p></div><span className="security-pill"><ShieldCheck size={17} />{users.length} משתמשים</span></div><div className="users-layout"><div className="panel users-list"><div className="panel-head"><div><h3>משתמשים פעילים</h3><span>צבע ואייקון מוצגים בלוח השנה ובפעילות</span></div></div>{users.map((item) => <div className="user-row visual-user-row" key={item.id}><div className="avatar" style={{ background:item.avatarColor,color:'#fff' }}>{avatarGlyph(item)}</div><div><strong>{item.displayName}</strong><span>{item.username || 'Home Assistant'} {item.haUserId && '· Ingress'}</span></div><select value={item.role} onChange={(e) => updateUser(item.id, { role: e.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="user-appearance"><input aria-label="צבע משתמש" type="color" value={item.avatarColor} onChange={(e) => updateUser(item.id,{avatarColor:e.target.value})} /><select aria-label="אייקון משתמש" value={item.avatarIcon} onChange={(e) => updateUser(item.id,{avatarIcon:e.target.value})}>{Object.entries(avatarIcons).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><label className="active-toggle"><input type="checkbox" checked={item.active} onChange={(e) => updateUser(item.id, { active: e.target.checked })} /><span /></label></div>)}</div><form className="panel create-user" onSubmit={createUser}><div className="panel-head"><div><h3>משתמש חדש</h3><span>לכניסה דרך הפורט העצמאי</span></div></div><label>שם תצוגה<input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label><label>שם משתמש<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>סיסמה<input type="password" minLength="8" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><label>תפקיד<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="new-user-appearance"><label>צבע<input type="color" value={form.avatarColor} onChange={(e) => setForm({ ...form, avatarColor:e.target.value })} /></label><label>אייקון<select value={form.avatarIcon} onChange={(e) => setForm({ ...form, avatarIcon:e.target.value })}>{Object.entries(avatarIcons).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><button className="primary-button"><Plus size={17} />יצירת משתמש</button></form></div></div>;
}

function SystemPage({ setNotice }) {
  const [backups, setBackups] = useState([]);
  const [busy, setBusy] = useState(false);
  const loadBackups = () => api('/system/backups').then((result) => setBackups(result.backups)).catch((error) => setNotice(error.message));
  useEffect(loadBackups, []);
  const createBackup = async () => {
    setBusy(true);
    try { await api('/system/backups', { method: 'POST' }); setNotice('הגיבוי הושלם'); loadBackups(); }
    catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const restore = async (name) => {
    if (!window.confirm(`לשחזר את ${name}? המערכת תופעל מחדש וכל הנתונים הנוכחיים יוחלפו.`)) return;
    setBusy(true);
    try { await api('/system/restore', { method: 'POST', body: JSON.stringify({ name }) }); setNotice('השחזור החל; המערכת תעלה מחדש בעוד רגע'); }
    catch (error) { setNotice(error.message); setBusy(false); }
  };
  return <div className="section-page system-page"><div className="page-intro"><div><h2>גיבוי, שחזור ובריאות מערכת</h2><p>גיבויי PostgreSQL נשמרים בתוך נתוני ה־Add-on ונכללים גם בגיבוי Home Assistant</p></div><button className="primary-button" disabled={busy} onClick={createBackup}><Database size={17} />{busy ? 'מבצע...' : 'יצירת גיבוי'}</button></div><div className="panel backup-list"><div className="panel-head"><div><h3>גיבויים זמינים</h3><span>שחזור מפעיל מחדש את שירות ה־API באופן מבוקר</span></div><span className="health-online"><i />PostgreSQL מחובר</span></div>{backups.length === 0 && <div className="empty-backups">עדיין לא נוצרו גיבויים ידניים.</div>}{backups.map((backup) => <div className="backup-row" key={backup.name}><div className="doc-icon"><Database size={18} /></div><div><strong>{backup.name}</strong><span>{new Date(backup.createdAt).toLocaleString('he-IL')} · {(backup.size / 1024 / 1024).toFixed(1)} MB</span></div><button className="secondary-button" disabled={busy} onClick={() => restore(backup.name)}><RotateCcw size={15} />שחזור</button></div>)}</div></div>;
}

function Dashboard({ projects, openProject, setPage, insights, user }) {
  const active = projects.filter((p) => p.stage !== 'completed');
  const value = active.reduce((sum, p) => sum + p.value, 0);
  const unpaid = active.reduce((sum, p) => sum + (p.value - p.paid), 0);
  const avg = active.length ? Math.round(active.reduce((sum, p) => sum + p.progress, 0) / active.length) : 0;
  const stageData = Object.entries(stageMeta).map(([key, value]) => ({ name: value.label, value: projects.filter((p) => p.stage === key).length, color: value.color })).filter((x) => x.value);
  const cashData = projects.slice(0, 6).map((project) => ({ month: project.id.replace('PRJ-', ''), paid: Math.round(project.paid / 1000), expected: Math.round(project.value / 1000) }));
  const upcomingMilestones = projects.filter((project) => project.stage !== 'completed').slice(0, 4);
  return (
    <div className="dashboard-page">
      <section className="welcome-row"><div><h2>שלום, {user.displayName} <span>👋</span></h2><p>הנה תמונת המצב התפעולית המעודכנת.</p></div><div className="live-pill"><i />הנתונים מעודכנים עכשיו</div></section>
      <section className="kpi-grid">
        <KpiCard icon={FolderKanban} tone="purple" label="פרויקטים פעילים" value={active.length} change="2 נוספו החודש" trend />
        <KpiCard icon={TrendingUp} tone="blue" label="היקף פרויקטים פעילים" value={compactMoney(value)} change="12.4% מהחודש הקודם" trend />
        <KpiCard icon={Gauge} tone="green" label="התקדמות ממוצעת" value={`${avg}%`} change="4.8% שיפור החודש" trend />
        <KpiCard icon={CircleDollarSign} tone="orange" label="יתרה פתוחה לגבייה" value={compactMoney(unpaid)} change="3 תשלומים דורשים טיפול" alert />
      </section>
      <InsightsTile insights={insights} onNavigate={setPage} />
      <section className="dashboard-grid top">
        <div className="panel portfolio-panel">
          <PanelHead title="פרויקטים שדורשים תשומת לב" subtitle="לפי סיכון, חריגה ותשלומים" action="לכל הפרויקטים" onAction={() => setPage('projects')} />
          <div className="attention-list">
            {projects.filter((p) => p.flag).slice(0, 4).map((project) => (
              <button key={project.id} className="attention-item" onClick={() => openProject(project)}>
                <div className={`risk-indicator ${project.health < 65 ? 'danger' : 'warning'}`}><Flag size={16} /></div>
                <div className="attention-main"><div><strong>{project.name}</strong><span>{project.id} · {project.location}</span></div><span className="flag-label"><AlertTriangle size={14} />{project.flag}</span></div>
                <div className="attention-progress"><b>{project.progress}%</b><div><i style={{ width: `${project.progress}%`, background: stageMeta[project.stage].color }} /></div></div>
                <StatusBadge stage={project.stage} compact /><ChevronLeft size={18} />
              </button>
            ))}
          </div>
        </div>
        <div className="panel stage-panel">
          <PanelHead title="התפלגות לפי שלב" subtitle="כלל הפרויקטים" />
          <div className="stage-chart-wrap">
            <ResponsiveContainer width="54%" height={210}>
              <PieChart><Pie data={stageData} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={4} stroke="none">{stageData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{projects.length}</strong><span>פרויקטים</span></div>
            <div className="chart-legend">{stageData.map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.value}</b></div>)}</div>
          </div>
        </div>
      </section>
      <section className="dashboard-grid bottom">
        <div className="panel cash-panel">
          <PanelHead title="גבייה לפי פרויקט" subtitle="חוזה מול תשלומים שהתקבלו · באלפי ₪" action="6 פרויקטים" />
          <div className="cash-legend"><span><i className="paid" />התקבל</span><span><i className="expected" />צפי</span></div>
          <ResponsiveContainer width="100%" height={235}>
            <BarChart data={cashData} barGap={5}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8b93a7', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a8b7', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f7f8fb' }} /><Bar dataKey="expected" fill="#e8ebf3" radius={[5, 5, 0, 0]} /><Bar dataKey="paid" fill="#6d5de8" radius={[5, 5, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel milestones-panel"><PanelHead title="אבני דרך קרובות" subtitle="7 הימים הקרובים" action="ללוח השנה" />
          <div className="milestone-list">{upcomingMilestones.map((item, index) => <div className="milestone-item" key={item.id}><div className={`date-tile ${item.health < 70 ? 'risk' : index === 0 ? 'today' : 'soon'}`}><b>{item.due.split('.')[0] || '—'}</b><span>{item.due.split('.')[1] || ''}</span></div><div><strong>{item.nextMilestone}</strong><span>{item.name}</span></div>{item.health < 70 && <em>בסיכון</em>}<MoreHorizontal size={18} /></div>)}</div>
        </div>
        <div className="panel activity-panel"><PanelHead title="פעילות אחרונה" action="הצג הכל" />
          <div className="activity-list">{(insights?.recentActivities || []).map((item) => <div className="activity-item" key={item.id}><div className="mini-avatar">{item.userName.slice(0,2)}</div><div><p>{item.userName} · {actionNamesForDashboard[item.action] || item.action}</p><strong>{item.entityType} {item.entityId || ''}</strong><span>{new Date(item.createdAt).toLocaleString('he-IL')}</span></div></div>)}</div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ icon: Icon, tone, label, value, change, trend, alert }) {
  return <div className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon size={22} /></div><div className="kpi-copy"><span>{label}</span><strong>{value}</strong><small className={alert ? 'alert' : ''}>{trend && <TrendingUp size={13} />}{alert && <AlertTriangle size={13} />}{change}</small></div><MoreHorizontal size={19} className="kpi-more" /></div>;
}

function PanelHead({ title, subtitle, action, onAction }) {
  return <div className="panel-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action && <button onClick={onAction}>{action}<ChevronLeft size={15} /></button>}</div>;
}

function ProjectsPage({ projects, search, setSearch, stageFilter, setStageFilter, openProject }) {
  const [view, setView] = useState('table');
  return <div className="section-page">
    <div className="page-intro"><div><h2>כל הפרויקטים</h2><p>ניהול, מעקב ובקרה של {projects.length} פרויקטים בתצוגה הנוכחית</p></div><div className="view-switch"><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><ListFilter size={17} />טבלה</button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><FolderKanban size={17} />לוח</button></div></div>
    <div className="toolbar panel"><label className="table-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש פרויקט, לקוח או מזהה..." /></label><div className="stage-chips"><button className={stageFilter === 'all' ? 'active' : ''} onClick={() => setStageFilter('all')}>הכל <b>{projects.length}</b></button>{Object.entries(stageMeta).slice(0, 5).map(([key, meta]) => <button key={key} className={stageFilter === key ? 'active' : ''} onClick={() => setStageFilter(key)}>{meta.label}</button>)}</div><button className="filter-button"><SlidersHorizontal size={17} />מסננים</button></div>
    {view === 'table' ? <div className="panel projects-table-wrap"><table className="projects-table"><thead><tr><th>פרויקט</th><th>שלב נוכחי</th><th>התקדמות</th><th>מנהל פרויקט</th><th>אבן דרך הבאה</th><th>יתרה לגבייה</th><th /></tr></thead><tbody>{projects.map((project) => <tr key={project.id} onClick={() => openProject(project)}><td><div className="project-cell"><div className="project-thumb"><Home size={18} /></div><div><strong>{project.name}</strong><span>{project.id} · {project.location}</span></div>{project.flag && <Flag size={14} className="row-flag" />}</div></td><td><StatusBadge stage={project.stage} /></td><td><div className="table-progress"><div><i style={{ width: `${project.progress}%`, background: stageMeta[project.stage].color }} /></div><b>{project.progress}%</b></div></td><td><div className="manager-cell"><span>{project.ownerInitials}</span>{project.manager}</div></td><td><div className="milestone-cell"><strong>{project.nextMilestone}</strong><span><CalendarDays size={13} />{project.due}</span></div></td><td><strong className="money-cell">{money.format(project.value - project.paid)}</strong></td><td><button className="round-more"><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>
    : <BoardView projects={projects} openProject={openProject} />}
  </div>;
}

function BoardView({ projects, openProject }) {
  return <div className="board-view">{Object.entries(stageMeta).slice(0, 5).map(([key, meta]) => { const items = projects.filter((p) => p.stage === key); return <div className="board-column" key={key}><div className="board-head"><span><i style={{ background: meta.color }} />{meta.label}</span><b>{items.length}</b><Plus size={17} /></div><div className="board-cards">{items.map((project) => <button className="board-card" key={project.id} onClick={() => openProject(project)}><div className="board-card-top"><span>{project.id}</span>{project.flag && <Flag size={14} />}</div><strong>{project.name}</strong><small><MapPin size={13} />{project.location}</small><div className="systems-mini">{project.systems.slice(0, 2).map((s) => <em key={s}>{s}</em>)}</div><div className="board-card-bottom"><div className="mini-avatar">{project.ownerInitials}</div><div className="micro-progress"><i style={{ width: `${project.progress}%`, background: meta.color }} /></div><b>{project.progress}%</b></div></button>)}</div></div>; })}</div>;
}

function MapPage({ projects, openProject, stageFilter, setStageFilter }) {
  const [selected, setSelected] = useState(null);
  return <div className="map-page section-page"><div className="page-intro"><div><h2>מפת פרויקטים חיה</h2><p>תמונת מצב גאוגרפית של הפרויקטים הפעילים</p></div><div className="map-stat"><MapPin size={18} /><strong>{projects.length}</strong> מיקומים מוצגים</div></div>
    <div className="map-workspace panel"><div className="map-sidebar"><label className="table-search"><Search size={17} /><input placeholder="חיפוש מיקום..." /></label><div className="map-filter-title"><span>פרויקטים</span><button><Filter size={15} />סינון</button></div><div className="map-project-list">{projects.map((p) => <button key={p.id} className={selected?.id === p.id ? 'active' : ''} onClick={() => setSelected(p)}><i style={{ background: stageMeta[p.stage].color }} /><div><strong>{p.name}</strong><span>{p.location} · {p.progress}%</span></div><ChevronLeft size={17} /></button>)}</div><div className="map-legend"><span>מקרא שלבים</span>{Object.entries(stageMeta).slice(0, 5).map(([key, meta]) => <button key={key} onClick={() => setStageFilter(stageFilter === key ? 'all' : key)} className={stageFilter === key ? 'active' : ''}><i style={{ background: meta.color }} />{meta.label}</button>)}</div></div>
      <div className="leaflet-shell"><MapContainer center={[32.12, 34.83]} zoom={10} zoomControl={false} scrollWheelZoom><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><ZoomControl position="bottomleft" />{projects.map((p) => <ProjectMarker key={p.id} project={p} onOpen={openProject} />)}</MapContainer>{selected && <div className="floating-project-card"><button onClick={() => setSelected(null)}><X size={16} /></button><span className="eyebrow">{selected.id}</span><h3>{selected.name}</h3><p><MapPin size={14} />{selected.address}</p><StatusBadge stage={selected.stage} /><div className="floating-progress"><span>התקדמות</span><b>{selected.progress}%</b><div><i style={{ width: `${selected.progress}%`, background: stageMeta[selected.stage].color }} /></div></div><button className="open-project" onClick={() => openProject(selected)}>פתח תיק פרויקט <ArrowLeft size={15} /></button></div>}</div>
    </div></div>;
}

function ClientsPage() {
  return <div className="section-page"><div className="page-intro"><div><h2>לקוחות ואנשי קשר</h2><p>מרכז מידע מאוחד לכל הלקוחות והשותפים בפרויקטים</p></div><button className="secondary-button"><Upload size={17} />ייבוא לקוחות</button></div><div className="client-stats"><div><Users /><span>סה״כ לקוחות<strong>48</strong></span></div><div><Building2 /><span>לקוחות עסקיים<strong>11</strong></span></div><div><FolderKanban /><span>פרויקטים משויכים<strong>64</strong></span></div><div><TrendingUp /><span>שווי לקוח ממוצע<strong>₪286K</strong></span></div></div><div className="panel clients-panel"><div className="toolbar"><label className="table-search"><Search size={18} /><input placeholder="חיפוש לקוח, איש קשר או טלפון..." /></label><button className="filter-button"><Filter size={17} />סינון</button></div><div className="client-grid">{clients.map((client, index) => <button className="client-card" key={client.name}><div className={`client-avatar c${index}`}>{client.name.slice(0, 2)}</div><div className="client-title"><span>{client.type}</span><h3>{client.name}</h3><p><MapPin size={13} />{client.city}</p></div><MoreHorizontal size={18} /><div className="client-contact"><span><UserRound size={15} />{client.contact}</span><span><Phone size={15} />{client.phone}</span></div><div className="client-metrics"><div><span>פרויקטים</span><strong>{client.projects}</strong></div><div><span>היקף פעילות</span><strong>{money.format(client.total)}</strong></div></div><span className="client-open">פתיחת כרטיס לקוח <ChevronLeft size={15} /></span></button>)}</div></div></div>;
}

function FormsPage({ setNotice }) {
  const forms = [
    { title: 'סקר אתר ואפיון ראשוני', desc: 'פרטי נכס, צרכים, מערכות ותשתיות קיימות', fields: 28, uses: 14, icon: ClipboardCheck, tone: 'purple' },
    { title: 'בדיקת תשתיות לפני התקנה', desc: 'לוחות, צנרת, נקודות חשמל ותקשורת', fields: 36, uses: 9, icon: CheckCircle2, tone: 'blue' },
    { title: 'פרוטוקול מסירת מערכת', desc: 'בדיקות סופיות, הדרכה, קודים וחתימת לקוח', fields: 42, uses: 21, icon: FileText, tone: 'green' },
    { title: 'דוח ביקור טכנאי', desc: 'תקלות, פעולות שבוצעו, חלקים ותמונות', fields: 18, uses: 37, icon: Settings, tone: 'orange' },
  ];
  return <div className="section-page"><div className="page-intro"><div><h2>טפסים ומסמכים</h2><p>תבניות חכמות לתיעוד אחיד בכל שלבי הפרויקט</p></div><button className="primary-button" onClick={() => setNotice('בונה הטפסים יתווסף בגרסה הבאה')}><Plus size={17} />תבנית חדשה</button></div><div className="forms-grid">{forms.map(({ title, desc, fields, uses, icon: Icon, tone }) => <div className="panel form-card" key={title}><div className={`form-icon ${tone}`}><Icon /></div><button><MoreHorizontal /></button><span>תבנית פעילה</span><h3>{title}</h3><p>{desc}</p><div className="form-meta"><span><FormInput size={15} />{fields} שדות</span><span><FileText size={15} />{uses} מילויים</span></div><div className="form-actions"><button onClick={() => setNotice('התצוגה המקדימה מוכנה לבדיקה')}>תצוגה מקדימה</button><button onClick={() => setNotice('מצב העריכה יתווסף בגרסה הבאה')}>עריכה</button></div></div>)}</div><div className="panel files-overview"><PanelHead title="מסמכים אחרונים" subtitle="קבצים שהועלו לאחרונה לפרויקטים" action="כל המסמכים" /><div className="documents-list">{['תוכנית חשמל - קומה א׳.pdf', 'כתב כמויות KNX.xlsx', 'תמונות לוח תקשורת.zip', 'פרוטוקול מסירה חתום.pdf'].map((name, i) => <div key={name}><div className="doc-icon"><FileText size={19} /></div><div><strong>{name}</strong><span>{['וילה משפחת כהן', 'בית משפחת אלון', 'פנטהאוז משפחת ברק', 'דירת משפחת לביא'][i]}</span></div><span>{[3.2, 1.8, 24.6, 2.1][i]} MB</span><MoreHorizontal size={18} /></div>)}</div></div></div>;
}

function FinancePage({ projects, openProject }) {
  const total = projects.reduce((s, p) => s + p.value, 0), paid = projects.reduce((s, p) => s + p.paid, 0);
  return <div className="section-page"><div className="page-intro"><div><h2>תשלומים וגבייה</h2><p>בקרת תזרים, אבני דרך לתשלום ויתרות פתוחות</p></div><button className="secondary-button"><FileText size={17} />הפקת דוח</button></div><div className="finance-hero"><div><span>היקף חוזים כולל</span><strong>{money.format(total)}</strong><small><TrendingUp size={14} />8.2% מהרבעון הקודם</small></div><div className="collection-ring" style={{ '--percent': `${Math.round(paid / total * 100) * 3.6}deg` }}><span><strong>{Math.round(paid / total * 100)}%</strong>נגבה</span></div><div className="finance-split"><div><i className="green" /><span>התקבל<strong>{money.format(paid)}</strong></span></div><div><i className="orange" /><span>יתרה פתוחה<strong>{money.format(total - paid)}</strong></span></div></div></div><div className="panel finance-table-wrap"><PanelHead title="מצב גבייה לפי פרויקט" subtitle="לחיצה על שורה תפתח את תיק הפרויקט" /><table className="projects-table finance-table"><thead><tr><th>פרויקט ולקוח</th><th>שווי חוזה</th><th>שולם</th><th>יתרה</th><th>אחוז גבייה</th><th>סטטוס</th></tr></thead><tbody>{projects.map((p) => { const percent = Math.round(p.paid / p.value * 100); const overdue = p.flag.includes('תשלום'); return <tr key={p.id} onClick={() => openProject(p)}><td><div className="project-cell"><div className="project-thumb"><Home size={17} /></div><div><strong>{p.name}</strong><span>{p.client}</span></div></div></td><td>{money.format(p.value)}</td><td className="paid-money">{money.format(p.paid)}</td><td><strong>{money.format(p.value - p.paid)}</strong></td><td><div className="collection-cell"><div><i style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div></td><td><span className={`payment-state ${overdue ? 'overdue' : percent === 100 ? 'paid' : ''}`}>{overdue ? 'באיחור' : percent === 100 ? 'שולם' : 'תקין'}</span></td></tr>; })}</tbody></table></div></div>;
}

function ProjectDetail({ project, updateProject, canEdit }) {
  const [tab, setTab] = useState('overview');
  const dueAmount = project.value - project.paid;
  const projectMilestones = [
    { title: 'אפיון וחתימת חוזה', status: 'done', date: '12.03.2026' },
    { title: 'אישור תוכניות ביצוע', status: 'done', date: '28.05.2026' },
    { title: project.nextMilestone, status: 'current', date: project.due },
    { title: 'תכנות, בדיקות ותרחישים', status: 'future', date: '08.09.2026' },
    { title: 'מסירה והדרכת לקוח', status: 'future', date: '22.09.2026' },
  ];
  return <div className="project-detail">
    <div className="project-hero panel"><div className="project-identity"><div className="project-home-icon"><Home size={27} /></div><div><div className="project-title-line"><h2>{project.name}</h2>{project.flag && <span className="hero-flag"><Flag size={14} />{project.flag}</span>}</div><p><UserRound size={15} />{project.client}<span>·</span><MapPin size={15} />{project.address}</p></div></div><div className="project-hero-actions"><button className="secondary-button" disabled={!canEdit}><MessageSquare size={16} />הוספת עדכון</button><button className="icon-button" disabled={!canEdit}><MoreHorizontal /></button></div><div className="hero-metrics"><div><span>שלב נוכחי</span><select disabled={!canEdit} value={project.stage} onChange={(e) => updateProject(project.id, { stage: e.target.value })}>{Object.entries(stageMeta).map(([key, meta]) => <option value={key} key={key}>{meta.label}</option>)}</select></div><div><span>התקדמות</span><strong>{project.progress}%</strong><input disabled={!canEdit} type="range" min="0" max="100" value={project.progress} onChange={(e) => updateProject(project.id, { progress: Number(e.target.value) })} style={{ '--range': `${project.progress}%` }} /></div><div><span>בריאות הפרויקט</span><strong className={project.health < 70 ? 'health-risk' : 'health-good'}>{project.health}/100</strong><small>{project.health < 70 ? 'דורש תשומת לב' : 'מתנהל כשורה'}</small></div><div><span>מנהל פרויקט</span><div className="manager-cell"><i>{project.ownerInitials}</i><strong>{project.manager}</strong></div></div><div><span>יעד לאבן דרך</span><strong>{project.due}</strong><small>{project.nextMilestone}</small></div></div></div>
    <div className="detail-tabs">{[['overview','סקירה'],['tasks','משימות ואבני דרך'],['systems','מערכות'],['forms','טפסים וקבצים'],['finance','כספים'],['activity','פעילות']].map(([id, label]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>{label}{id === 'tasks' && <em>7</em>}</button>)}</div>
    {tab === 'overview' && <div className="detail-grid"><div className="detail-main"><div className="panel overview-card"><PanelHead title="התקדמות הפרויקט" subtitle={`${project.tasksDone} מתוך ${project.tasksTotal} משימות הושלמו`} /><div className="large-progress"><div><i style={{ width: `${project.progress}%`, background: stageMeta[project.stage].color }} /></div><strong>{project.progress}%</strong></div><div className="milestone-timeline">{projectMilestones.map((m, index) => <div className={m.status} key={`${m.title}-${index}`}><span>{m.status === 'done' ? <Check size={14} /> : ''}</span><div><strong>{m.title}</strong><small>{m.date}</small></div></div>)}</div></div><div className="panel systems-card"><PanelHead title="מערכות בפרויקט" action="ניהול מערכות" /><div className="system-tiles">{project.systems.map((system, index) => <div key={system}><span className={`system-icon s${index % 4}`}><Command size={18} /></span><strong>{system}</strong><small>{index < 2 ? 'התקנה בתהליך' : 'טרם התחיל'}</small><CheckCircle2 size={17} /></div>)}</div></div></div><div className="detail-side"><div className="panel contact-card"><PanelHead title="פרטי לקוח" /><div className="contact-person"><div className="client-avatar">{project.client.slice(0,2)}</div><div><strong>{project.client}</strong><span>לקוח ראשי</span></div></div><a href={`tel:${project.phone}`}><Phone size={16} />{project.phone}</a><a href={`mailto:${project.email}`}><Mail size={16} />{project.email}</a><p><MapPin size={16} />{project.address}</p><button>פתיחת כרטיס לקוח</button></div><div className="panel money-summary"><PanelHead title="סיכום כספי" /><div><span>שווי הפרויקט</span><strong>{money.format(project.value)}</strong></div><div><span>שולם עד כה</span><strong className="green-text">{money.format(project.paid)}</strong></div><div className="due-row"><span>יתרה לגבייה</span><strong>{money.format(dueAmount)}</strong></div><div className="money-progress"><i style={{ width: `${project.paid / project.value * 100}%` }} /></div><small>{Math.round(project.paid / project.value * 100)}% נגבה</small><button onClick={() => setTab('finance')}>לפירוט תשלומים <ChevronLeft size={15} /></button></div><div className="panel quick-notes"><PanelHead title="הערה מהירה" /><textarea placeholder="כתבו עדכון לצוות..." /><button>פרסום עדכון</button></div></div></div>}
    {tab !== 'overview' && <ProjectTabPlaceholder tab={tab} project={project} />}
  </div>;
}

function ProjectTabPlaceholder({ tab, project }) {
  const content = {
    tasks: ['משימות ואבני דרך', 'ניהול המשימות המלא יכלול אחראים, תאריכי יעד ותלויות בין שלבים.', ClipboardCheck],
    systems: ['מערכות בפרויקט', `${project.systems.length} מערכות משויכות לפרויקט. במסך המלא יופיעו ציוד, דגמים ותוצאות בדיקה.`, Command],
    forms: ['טפסים וקבצים', 'כאן ירוכזו סקרי האתר, תוכניות, תמונות, פרוטוקולים וחתימות.', FileText],
    finance: ['כספים ותשלומים', `נותרה יתרה של ${money.format(project.value - project.paid)} לגבייה בפרויקט.`, CreditCard],
    activity: ['יומן פעילות', 'כל שינוי, עדכון, קובץ ותשלום יתועדו כאן לפי זמן ומשתמש.', Activity],
  }[tab];
  const Icon = content[2];
  return <div className="panel tab-placeholder"><div><Icon size={30} /></div><h3>{content[0]}</h3><p>{content[1]}</p><button className="secondary-button"><Plus size={17} />הוספת פריט</button></div>;
}

function NewProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', client: '', location: '', manager: 'רונן לוי', value: '' });
  const submit = (event) => {
    event.preventDefault();
    onCreate({ id: `PRJ-${1053 + Math.floor(Math.random() * 40)}`, name: form.name, client: form.client, location: form.location, address: form.location, lat: 32.08, lng: 34.82, stage: 'planning', progress: 5, manager: form.manager, ownerInitials: form.manager === 'רונן לוי' ? 'רל' : 'דג', value: Number(form.value) || 0, paid: 0, due: 'טרם נקבע', priority: 'normal', flag: '', systems: [], nextMilestone: 'פגישת אפיון ראשונית', phone: '', email: '', health: 95, tasksDone: 1, tasksTotal: 12 });
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span>פרויקט חדש</span><h2>בואו נתחיל מהפרטים הבסיסיים</h2></div><button onClick={onClose}><X /></button></div><form onSubmit={submit}><label>שם הפרויקט<input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="לדוגמה: וילה משפחת ישראלי" /></label><div className="form-row"><label>לקוח<input required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="שם הלקוח" /></label><label>עיר / מיקום<input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="תל אביב" /></label></div><div className="form-row"><label>מנהל פרויקט<select value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}><option>רונן לוי</option><option>דניאל גולן</option><option>אורי קדם</option></select></label><label>שווי משוער<input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="₪ 0" /></label></div><div className="template-choice"><span>תבנית עבודה</span><button type="button" className="selected"><CheckCircle2 size={19} /><div><strong>פרויקט בית חכם מלא</strong><small>12 שלבים · 34 משימות · 4 טפסים</small></div></button></div><div className="modal-actions"><button type="button" onClick={onClose}>ביטול</button><button className="primary-button" type="submit">יצירת פרויקט <ArrowLeft size={16} /></button></div></form></div></div>;
}

export default App;
