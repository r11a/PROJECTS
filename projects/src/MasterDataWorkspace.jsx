import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  ArrowDownAZ,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronLeft,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  HardHat,
  Hammer,
  Cable,
  Camera,
  FolderKanban,
  GripVertical,
  Network,
  Palette,
  Ruler,
  ShieldCheck,
  Truck,
  Wrench,
  Zap,
  Link2,
  Pencil,
  Plus,
  LayoutGrid,
  Rows3,
  Search,
  Trash2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { AppModal } from "./AppModal";
import { MobileActionMenu } from "./MobileActionMenu";
import "./professional-projects.css";

const emptyProfessional = {
  displayName: "",
  firstName: "",
  lastName: "",
  affiliation: "external",
  companyName: "",
  jobTitle: "",
  phone: "",
  additionalPhonesText: "",
  email: "",
  address: "",
  notes: "",
  color: "#6957df",
  icon: "user-round",
  linkedUserId: "",
  roleIds: [],
  customValues: {},
};
const roleIconOptions = [
  ["user-round", "אדם", UserRound], ["briefcase", "תפקיד", BriefcaseBusiness], ["folder-kanban", "ניהול פרויקט", FolderKanban],
  ["wrench", "טכנאי", Wrench], ["hard-hat", "ביצוע", HardHat], ["hammer", "קבלן", Hammer], ["ruler", "אדריכלות", Ruler],
  ["shield-check", "פיקוח", ShieldCheck], ["zap", "חשמל", Zap], ["cable", "תשתיות", Cable], ["network", "תקשורת", Network],
  ["camera", "מצלמות", Camera], ["palette", "עיצוב", Palette], ["truck", "ספק", Truck], ["building", "חברה", Building2],
];
function RoleIcon({name,size=16}){const Icon=roleIconOptions.find(([key])=>key===name)?.[2]||UserRound;return <Icon size={size}/>}
const emptyEquipment = {
  itemType: "system_type",
  parentId: "",
  code: "",
  name: "",
  manufacturer: "",
  model: "",
  unit: "יחידה",
  description: "",
  color: "#6957df",
  icon: "cpu",
  active: true,
  prioritySku: "",
};

export function MasterDataWorkspace({
  api,
  apiRoot,
  user,
  users,
  clients,
  projects,
  setNotice,
  onDataChanged,
  initialTab = "professionals",
}) {
  const [tab, setTab] = useState(initialTab);
  const [professionals, setProfessionals] = useState([]);
  const [roles, setRoles] = useState([]);
  const [professionalFields,setProfessionalFields]=useState([]);
  const [equipment, setEquipment] = useState([]);
  const [query, setQuery] = useState("");
  const [professionalForm, setProfessionalForm] = useState(null);
  const [professionalProjects, setProfessionalProjects] = useState(null);
  const [equipmentForm, setEquipmentForm] = useState(null);
  const [roleForm, setRoleForm] = useState(false);
  const [priorityScanOpen, setPriorityScanOpen] = useState(false);
  const [priorityScan, setPriorityScan] = useState(null);
  const [priorityProjectId, setPriorityProjectId] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [professionalView,setProfessionalView]=useState(()=>localStorage.getItem('projects-professional-view')||'grid');
  const [professionalRole,setProfessionalRole]=useState('');
  const [professionalAffiliation,setProfessionalAffiliation]=useState('');
  const [professionalSort,setProfessionalSort]=useState('az');
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequest.current;
    try {
      const [people, roleData, equipmentData,settingsData] = await Promise.all([
        api("/professionals"),
        api("/professional-roles"),
        api("/equipment-catalog"),
        api("/settings"),
      ]);
      if (requestId !== loadRequest.current) return;
      setProfessionals(people.professionals);
      setRoles(roleData.roles);
      setEquipment(equipmentData.items);
      setProfessionalFields((settingsData.customFields||[]).filter(field=>field.entityType==='professional'&&field.active));
    } catch (error) {
      if (requestId !== loadRequest.current) return;
      setNotice(error.message);
    }
  }, []);
  const refresh = async () => {
    await load();
    if (typeof onDataChanged === "function") await onDataChanged();
  };
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const live = (event) => {
      const relevant = initialTab === "equipment"
        ? ["equipment_catalog", "equipment_categories", "settings"]
        : ["professionals", "professional_roles", "settings", "users"];
      if (relevant.includes(event.detail?.table)) load();
    };
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, [initialTab, load]);
  useEffect(() => setTab(initialTab), [initialTab]);

  const filteredProfessionals = useMemo(
    () =>
      professionals.filter((item) =>
        `${item.displayName} ${item.companyName} ${item.jobTitle} ${item.phone} ${item.email} ${item.roles.map((role) => role.name).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ).filter(item=>!professionalRole||item.roles.some(role=>String(role.id)===professionalRole)).filter(item=>!professionalAffiliation||item.affiliation===professionalAffiliation).sort((a,b)=>professionalSort==='za'?b.displayName.localeCompare(a.displayName,'he'):professionalSort==='new'?Number(b.id)-Number(a.id):professionalSort==='old'?Number(a.id)-Number(b.id):a.displayName.localeCompare(b.displayName,'he')),
    [professionals, query,professionalRole,professionalAffiliation,professionalSort],
  );
  const tabs = initialTab === "equipment" ? [["equipment", "מערכות ורכיבים", Boxes]] : [["professionals", "אנשי מקצוע", Users]];

  return (
    <div className="master-workspace ops-page">
      <section className="ops-hero master-hero">
        <div>
          <span className="ops-eyebrow">
            <HardHat size={15} />
            מאגרי אב
          </span>
          <h2>{initialTab === "equipment" ? "מערכות ורכיבים במבנה קטלוגי חכם" : "מאגר אנשי המקצוע של החברה והפרויקטים"}</h2>
          <p>
            כרטיסים מרכזיים שניתנים לשיוך חוזר ללקוחות ולפרויקטים, ללא כפילות.
          </p>
        </div>
        <div className="master-stats">
          <span>
            <b>{professionals.length}</b>אנשי מקצוע
          </span>
          <span>
            <b>{equipment.length}</b>פריטי ציוד
          </span>
        </div>
      </section>
      <nav className="settings-tabs master-tabs">
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
      <div className="master-toolbar">
        <label>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש מהיר בשם, תפקיד, חברה, טלפון, תג או מסמך..."
          />
        </label>
        <div className="master-toolbar-actions">
          {tab==='professionals'&&<><label className="master-icon-filter" title="סינון לפי שיוך"><Building2 size={17}/><select aria-label="סינון לפי שיוך" value={professionalAffiliation} onChange={e=>setProfessionalAffiliation(e.target.value)}><option value="">כולם</option><option value="company">עובדי חברה</option><option value="external">חיצוניים</option></select></label><label className="master-icon-filter" title="סינון לפי תפקיד"><BriefcaseBusiness size={17}/><select aria-label="סינון לפי תפקיד" value={professionalRole} onChange={e=>setProfessionalRole(e.target.value)}><option value="">הכול</option>{roles.filter(x=>x.active).map(x=><option key={x.id} value={String(x.id)}>{x.name}</option>)}</select></label><label className="master-icon-filter" title="סדר תצוגה"><ArrowDownAZ size={17}/><select aria-label="סדר תצוגה" value={professionalSort} onChange={e=>setProfessionalSort(e.target.value)}><option value="az">א׳–ת׳</option><option value="za">ת׳–א׳</option><option value="new">חדש–ישן</option><option value="old">ישן–חדש</option></select></label><div className="professional-view-switch"><button className={professionalView==='grid'?'active':''} onClick={()=>{setProfessionalView('grid');localStorage.setItem('projects-professional-view','grid')}}><LayoutGrid size={16}/></button><button className={professionalView==='table'?'active':''} onClick={()=>{setProfessionalView('table');localStorage.setItem('projects-professional-view','table')}}><Rows3 size={16}/></button></div></>}
          {tab === "professionals" && user.role === "admin" && (
            <button className="ops-secondary" onClick={() => setRoleForm({})}>
              <Plus size={16} />
              סוג תפקיד
            </button>
          )}
          {tab === "professionals" &&
            ["admin", "manager"].includes(user.role) && (
              <button
                className="ops-primary"
                onClick={() => setProfessionalForm({ ...emptyProfessional })}
              >
                <Plus size={16} />
                איש מקצוע חדש
              </button>
            )}
          {tab === "equipment" && ["admin", "manager"].includes(user.role) && (
            <>
              <button className="ops-secondary" onClick={() => setPriorityScanOpen(true)}><FileText size={16}/>סריקת הזמנת Priority</button>
              <button className="ops-primary" onClick={() => setEquipmentForm({ ...emptyEquipment, itemType:"system_type" })}><Plus size={16} />סוג מערכת חדש</button>
            </>
          )}
        </div>
      </div>
      {tab === "professionals" && (
        <ProfessionalsGrid
          items={filteredProfessionals}
          view={professionalView}
          apiRoot={apiRoot}
          customFields={professionalFields}
          user={user}
          onOpenProjects={async (professional) => {
            try {
              const result = await api(`/professionals/${professional.id}/projects`);
              setProfessionalProjects({ professional, projects: result.projects || [] });
            } catch (error) {
              setNotice(error.message);
            }
          }}
          onEdit={(item) =>
            setProfessionalForm({
              ...item,
              additionalPhonesText: (item.additionalPhones || []).join(", "),
              linkedUserId: item.linkedUserId || "",
              roleIds: item.roles.map((role) => Number(role.id)),
            })
          }
          onDelete={async (item) => {
            if (!confirm(`למחוק את ${item.displayName}?`)) return;
            try {
              await api(`/professionals/${item.id}`, { method: "DELETE" });
              setNotice("איש המקצוע נמחק");
              refresh();
            } catch (error) {
              setNotice(error.message);
            }
          }}
        />
      )}
      {tab === "equipment" && (
        <EquipmentTree
          items={equipment.filter(
            (item) =>
              `${item.name} ${item.code} ${item.manufacturer} ${item.model}`
                .toLowerCase()
                .includes(query.toLowerCase()) || !query,
          )}
          apiRoot={apiRoot}
          user={user}
          api={api}
          refresh={refresh}
          setNotice={setNotice}
          onCreate={(itemType,parentId="")=>setEquipmentForm({ ...emptyEquipment, itemType, parentId })}
          onEdit={(item) =>
            setEquipmentForm({ ...item, parentId: item.parentId || "" })
          }
          onDuplicate={async(item,parentId)=>{try{await api(`/equipment-catalog/${item.id}/duplicate`,{method:"POST",body:JSON.stringify({parentId})});setNotice("הפריט שוכפל לקטגוריה שנבחרה");refresh()}catch(error){setNotice(error.message)}}}
          onDelete={async (item) => {
            if (!confirm(`למחוק את ${item.name}?`)) return;
            try {
              await api(`/equipment-catalog/${item.id}`, { method: "DELETE" });
              setNotice("הפריט נמחק");
              refresh();
            } catch (error) {
              setNotice("לא ניתן למחוק פריט שנמצא בשימוש או שיש תחתיו רכיבים");
            }
          }}
        />
      )}
      {professionalForm && (
        <ProfessionalEditor
          value={professionalForm}
          roles={roles}
          customFields={professionalFields}
          users={users}
          onClose={() => setProfessionalForm(null)}
          onSave={async (value) => {
            try {
              const body = {
                ...value,
                linkedUserId: value.linkedUserId || null,
                additionalPhones: value.additionalPhonesText
                  .split(",")
                  .map((phone) => phone.trim())
                  .filter(Boolean),
              };
              delete body.additionalPhonesText;
              const save=body=>api(
                value.id ? `/professionals/${value.id}` : "/professionals",
                {
                  method: value.id ? "PATCH" : "POST",
                  body: JSON.stringify(body),
                },
              );
              try{await save(body)}catch(error){
                if(error.status!==409||error.body?.code!=='SIMILAR_PROFESSIONAL')throw error;
                const match=error.body.matches?.[0];
                if(match&&confirm(`${error.message}.\nאישור — איחוד עם ${match.display_name}.\nביטול — מעבר לאפשרות יצירת כרטיס נפרד.`))await api(`/professionals/${match.id}/merge`,{method:'POST',body:JSON.stringify(body)});
                else if(confirm('ליצור בכל זאת כרטיס נפרד?'))await save({...body,allowDuplicate:true});
                else return;
              }
              setProfessionalForm(null);
              setNotice(
                value.id ? "כרטיס איש המקצוע עודכן" : "איש המקצוע נוסף למאגר",
              );
              refresh();
            } catch (error) {
              setNotice(error.message);
            }
          }}
        />
      )}
      {professionalProjects && (
        <Modal
          title={`הפרויקטים של ${professionalProjects.professional.displayName}`}
          subtitle="כל הפרויקטים שבהם איש המקצוע משויך כמנהל או כחבר צוות"
          onClose={() => setProfessionalProjects(null)}
        >
          <div className="professional-projects-dialog">
            {professionalProjects.projects.length ? professionalProjects.projects.map((project) => (
              <article key={project.id}>
                <div><strong>{project.name}</strong><small>{project.location || "ללא כתובת"}</small></div>
                <span>{project.archived_at ? "בארכיון" : project.stage || "ללא שלב"}</span>
                <b>{Number(project.progress || 0)}%</b>
              </article>
            )) : <EmptyState icon={BriefcaseBusiness} title="אין פרויקטים משויכים" text="איש המקצוע עדיין לא שויך לפרויקט." />}
          </div>
        </Modal>
      )}
      {equipmentForm && (
        <EquipmentEditor
          value={equipmentForm}
          items={equipment}
          onClose={() => setEquipmentForm(null)}
          onSave={async (value, iconFile) => {
            try {
              const result = await api(
                value.id
                  ? `/equipment-catalog/${value.id}`
                  : "/equipment-catalog",
                {
                  method: value.id ? "PATCH" : "POST",
                  body: JSON.stringify({
                    ...value,
                    parentId: value.parentId || null,
                  }),
                },
              );
              const itemId = value.id || result.item.id;
              if (iconFile) {
                const body = new FormData();
                body.append("icon", iconFile);
                await api(`/equipment-catalog/${itemId}/icon`, {
                  method: "POST",
                  body,
                });
              }
              setEquipmentForm(null);
              setNotice(value.id ? "פריט הציוד עודכן" : "פריט נוסף לקטלוג");
              refresh();
            } catch (error) {
              setNotice(error.message);
            }
          }}
        />
      )}
      {roleForm && (
        <RoleManager
          roles={roles}
          onClose={() => setRoleForm(false)}
          onSave={async (value) => {
            try {
              await api(value.id?`/professional-roles/${value.id}`:"/professional-roles", {
                method: value.id?"PATCH":"POST",
                body: JSON.stringify(value),
              });
              setNotice(value.id?"התפקיד עודכן":"סוג התפקיד נוסף");
              await refresh();
              return true;
            } catch (error) {
              setNotice(error.message);
              return false;
            }
          }}
          onDelete={async(role)=>{if(!confirm(`למחוק את התפקיד „${role.name}”?`))return;try{await api(`/professional-roles/${role.id}`,{method:'DELETE'});setNotice('התפקיד נמחק');await refresh()}catch(error){setNotice(error.message)}}}
        />
      )}
      {priorityScanOpen && (
        <Modal title="סריקת הזמנת לקוח מפריוריטי" subtitle="זיהוי מק״ט, תיאור וכמות מתוך PDF" onClose={() => setPriorityScanOpen(false)}>
          <form className="priority-scan-form" onSubmit={async (event) => {
            event.preventDefault();
            const file = new FormData(event.currentTarget).get("file");
            if (!(file instanceof File) || !file.size) return setNotice("יש לבחור קובץ PDF");
            setScanBusy(true);
            try { const body = new FormData(); body.append("file", file); setPriorityScan(await api("/priority-orders/scan", { method: "POST", body })); }
            catch (error) { setNotice(error.message); }
            finally { setScanBusy(false); }
          }}>
            <label>קובץ הזמנה PDF<input name="file" type="file" accept="application/pdf,.pdf" required/></label>
            <button className="ops-primary" disabled={scanBusy}>{scanBusy ? "מפענח..." : "פענוח ההזמנה"}</button>
          </form>
          {priorityScan && <div className="priority-scan-results">
            <div className="scan-summary"><strong>{priorityScan.items.length} שורות זוהו</strong><span>{priorityScan.items.filter((item)=>item.catalogItem).length} הותאמו לקטלוג</span></div>
            {!priorityScan.textDetected && <p className="scan-warning">ה־PDF הוא תמונה סרוקה ללא שכבת טקסט. נדרש OCR לזיהוי.</p>}
            <div className="scan-table"><table><thead><tr><th>מק״ט</th><th>תיאור</th><th>כמות</th><th>קטלוג</th></tr></thead><tbody>{priorityScan.items.map((item,index)=><tr key={`${item.code}-${index}`}><td>{item.code}</td><td>{item.description || item.catalogItem?.name || "—"}</td><td>{item.quantity}</td><td>{item.catalogItem ? "מותאם" : "לא נמצא"}</td></tr>)}</tbody></table></div>
            {priorityScan.items.some((item)=>item.catalogItem) && <div className="scan-import"><select value={priorityProjectId} onChange={(event)=>setPriorityProjectId(event.target.value)}><option value="">בחירת פרויקט לשיוך</option>{projects.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="ops-primary" disabled={!priorityProjectId} onClick={async()=>{setScanBusy(true);try{for(const item of priorityScan.items.filter((row)=>row.catalogItem)){await api(`/projects/${encodeURIComponent(priorityProjectId)}/equipment`,{method:"POST",body:JSON.stringify({catalogItemId:item.catalogItem.id,quantity:item.quantity,notes:`יובא מהזמנת ${priorityScan.fileName}`})})}setNotice("הפריטים המותאמים שויכו לפרויקט");setPriorityScanOpen(false)}catch(error){setNotice(error.message)}finally{setScanBusy(false)}}}>שיוך הפריטים המותאמים</button></div>}
          </div>}
        </Modal>
      )}
    </div>
  );
}

function ProfessionalsGrid({ items, user, onEdit, onDelete, onOpenProjects,view='grid',apiRoot,customFields=[] }) {
  if (!items.length)
    return (
      <EmptyState
        icon={Users}
        title="עדיין אין אנשי מקצוע במאגר"
        text="הוסף עובדי חברה וגורמים חיצוניים; ניתן לשייך לכל אדם כמה תפקידים."
      />
    );
  return (
    <div className={`professional-grid ${view==='table'?'professional-table':''}`}>
      {items.map((item) => (
        <article
          className={`professional-card ${!item.active ? "inactive" : ""}`}
          key={item.id}
          onClick={(event) => {
            if (!event.target.closest("button,a,input,select")) onOpenProjects?.(item);
          }}
        >
          <header>
            <span
              className="professional-avatar"
              style={{ "--person-color": item.color }}
            >
              {item.displayName.slice(0, 2)}
            </span>
            <div>
              <h3>{item.displayName}</h3>
              <p>{item.jobTitle || item.companyName || "ללא תיאור תפקיד"}</p>
            </div>
            {item.affiliation === "company" ? <em className="affiliation company company-flag"><span className="company-flag-logo"><img src={`${apiRoot}/settings/company-logo`} alt="" onError={event=>event.currentTarget.hidden=true}/><Building2 size={14}/></span>עובד חברה</em>:<em className="affiliation external">חיצוני</em>}
          </header>
          <div className="role-chips">
            {item.roles.map((role) => (
              <span key={role.id} style={{ "--role-color": role.color }}>
                <RoleIcon name={role.icon} size={13}/>
                {role.name}
              </span>
            ))}
          </div>
          <dl>
            <div>
              <dt>טלפון</dt>
              <dd>{item.phone || "—"}</dd>
            </div>
            <div>
              <dt>דוא״ל</dt>
              <dd>{item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : "—"}</dd>
            </div>
            <div>
              <dt>חברה</dt>
              <dd>
                {item.affiliation === "company"
                  ? "החברה שלי"
                  : item.companyName || "עצמאי"}
              </dd>
            </div>
            <div>
              <dt>גישה למערכת</dt>
              <dd>
                {item.linkedUserId ? (
                  <>
                    <Link2 size={13} />
                    מקושר למשתמש
                  </>
                ) : (
                  "ללא הרשאה"
                )}
              </dd>
            </div>
            {customFields.filter(field=>item.customValues?.[field.fieldKey]!==undefined&&item.customValues?.[field.fieldKey]!==''&&item.customValues?.[field.fieldKey]!==false).map(field=><div key={field.id}><dt>{field.label}</dt><dd>{field.fieldType==='boolean'?'כן':String(item.customValues[field.fieldKey])}</dd></div>)}
          </dl>
          <footer>
            <button type="button" className="professional-project-load" title={`${item.projectCount} פרויקטים משויכים`} onClick={() => onOpenProjects?.(item)}>
              <i style={{width:`${Math.min(100,Number(item.projectCount||0)*14)}%`}}/>
              <b>{item.projectCount} פרויקטים</b> · {item.clientCount} לקוחות
            </button>
            {["admin", "manager"].includes(user.role) && (
              <button onClick={() => onEdit(item)}>
                <Pencil size={15} />
              </button>
            )}
            {user.role === "admin" && (
              <button className="danger-icon" onClick={() => onDelete(item)}>
                <Trash2 size={15} />
              </button>
            )}
          </footer>
        </article>
      ))}
    </div>
  );
}

function ProfessionalEditor({ value, roles, users, customFields=[], onClose, onSave }) {
  const [form, setForm] = useState(value);
  const toggleRole = (role) => {
    const selected = form.roleIds.includes(Number(role.id));
    const nextRoleIds = selected
      ? form.roleIds.filter((id) => id !== Number(role.id))
      : [...form.roleIds, Number(role.id)];
    const employeeRole = ["project_manager", "technician"].includes(role.key);
    setForm({
      ...form,
      roleIds: nextRoleIds,
      affiliation: !selected && employeeRole ? "company" : form.affiliation,
    });
  };
  return (
    <Modal
      title={form.id ? "עריכת איש מקצוע" : "איש מקצוע חדש"}
      subtitle="תפקידים והרשאת כניסה הם נתונים נפרדים"
      onClose={onClose}
    >
      <form
        className="master-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <label>
          שם פרטי *
          <input
            required
            value={form.firstName}
            onChange={(event) =>
              setForm({ ...form, firstName: event.target.value,displayName:[event.target.value,form.lastName].filter(Boolean).join(' ') })
            }
          />
        </label>
        <label>שם משפחה<input value={form.lastName} onChange={event=>setForm({...form,lastName:event.target.value,displayName:[form.firstName,event.target.value].filter(Boolean).join(' ')})}/></label>
        <label>
          שיוך ארגוני
          <select
            value={form.affiliation}
            onChange={(event) =>
              setForm({ ...form, affiliation: event.target.value })
            }
          >
            <option value="company">עובד החברה</option>
            <option value="external">גורם חיצוני</option>
          </select>
        </label>
        <fieldset className="wide role-picker">
          <legend>תפקידים — ניתן לבחור כמה</legend>
          {roles
            .filter((role) => role.active)
            .map((role) => (
              <button
                type="button"
                key={role.id}
                className={
                  form.roleIds.includes(Number(role.id)) ? "selected" : ""
                }
                style={{ "--role-color": role.color }}
                onClick={() => toggleRole(role)}
              >
                <RoleIcon name={role.icon} size={14} />
                {role.name}
              </button>
            ))}
        </fieldset>
        <label>
          תפקיד / התמחות
          <input
            value={form.jobTitle}
            onChange={(event) =>
              setForm({ ...form, jobTitle: event.target.value })
            }
          />
        </label>
        <label>
          חברה חיצונית
          <input
            disabled={form.affiliation === "company"}
            value={form.companyName}
            onChange={(event) =>
              setForm({ ...form, companyName: event.target.value })
            }
          />
        </label>
        <label>
          טלפון
          <input
            type="tel"
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
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
          />
        </label>
        <label>
          כתובת
          <input
            value={form.address}
            onChange={(event) =>
              setForm({ ...form, address: event.target.value })
            }
          />
        </label>
        <label className="wide linked-user">
          <span>חשבון כניסה מקושר</span>
          <select
            value={form.linkedUserId}
            onChange={(event) =>
              setForm({ ...form, linkedUserId: event.target.value })
            }
          >
            <option value="">ללא גישה לתוכנה</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName} · {item.role}
              </option>
            ))}
          </select>
          <small>קישור לחשבון אינו משנה את התפקידים המקצועיים.</small>
        </label>
        <label className="wide">
          הערות
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm({ ...form, notes: event.target.value })
            }
          />
        </label>
        {customFields.map(field=><label key={field.id} className={field.fieldType==='boolean'?'custom-check':''}>{field.label}{field.fieldType==='boolean'?<input type="checkbox" checked={Boolean(form.customValues?.[field.fieldKey])} onChange={event=>setForm({...form,customValues:{...(form.customValues||{}),[field.fieldKey]:event.target.checked}})}/>:field.fieldType==='select'?<select required={field.required} value={form.customValues?.[field.fieldKey]||''} onChange={event=>setForm({...form,customValues:{...(form.customValues||{}),[field.fieldKey]:event.target.value}})}><option value="">בחירה</option>{(field.options||[]).map(option=><option key={option}>{option}</option>)}</select>:<input required={field.required} type={field.fieldType==='phone'?'tel':field.fieldType} value={form.customValues?.[field.fieldKey]||''} onChange={event=>setForm({...form,customValues:{...(form.customValues||{}),[field.fieldKey]:event.target.value}})}/>}</label>)}
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="ops-primary">
            <Check size={16} />
            שמירה
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EquipmentTree({ items, apiRoot, api, refresh, setNotice, user, onCreate, onEdit, onDelete, onDuplicate }) {
  const catalogColor = (item, inheritedColor) => { const effectiveColor = inheritedColor || item.color || "#6957df"; return effectiveColor; };
  const [expanded,setExpanded]=useState(()=>new Set());
  const [collapsedCategories,setCollapsedCategories]=useState(()=>new Set());
  const [columns,setColumns]=useState(()=>{try{return JSON.parse(localStorage.getItem('projects:equipment-board-columns')||'[]')}catch{return []}});
  const [newColumn,setNewColumn]=useState('');
  const editable=["admin","manager"].includes(user.role);
  const metadata=(item)=>item.metadata||{};
  const update=async(item,patch)=>{try{await api(`/equipment-catalog/${item.id}`,{method:'PATCH',body:JSON.stringify(patch)});await refresh()}catch(error){setNotice(error.message)}};
  const updateMeta=(item,patch)=>update(item,{metadata:{...metadata(item),...patch}});
  const persistColumns=(next)=>{setColumns(next);localStorage.setItem('projects:equipment-board-columns',JSON.stringify(next))};
  const addColumn=()=>{const label=newColumn.trim();if(!label)return;persistColumns([...columns,{key:`custom_${Date.now()}`,label}]);setNewColumn('')};
  const moveColumn=(from,to)=>{if(from===to)return;const next=[...columns];const [column]=next.splice(from,1);next.splice(to,0,column);persistColumns(next)};
  const subitemGrid=`minmax(280px,2.4fr) minmax(92px,.8fr) minmax(82px,.7fr) minmax(105px,.9fr) 68px minmax(98px,.85fr) ${columns.map(()=>'minmax(92px,.75fr)').join(' ')} 92px`;
  if (!items.length)
    return (
      <EmptyState
        icon={Boxes}
        title="קטלוג המערכות עדיין ריק"
        text="בנה היררכיה פשוטה: סוג מערכת, מערכת ורכיבים ששייכים אליה."
      />
    );
  const categories=items.filter(item=>item.itemType==="system_type");
  return <div className="equipment-board">
    <header className="equipment-board-intro"><div><Boxes size={21}/><span><strong>לוח מערכות ורכיבים</strong><small>עריכה ישירה, תתי־פריטים וסיכומי ביצוע בזמן אמת</small></span></div>{editable&&<div className="equipment-add-column"><input value={newColumn} onChange={event=>setNewColumn(event.target.value)} placeholder="שם עמודה חדשה" onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addColumn()}}}/><button onClick={addColumn}><Plus size={15}/>עמודה</button></div>}</header>
    {categories.map(category=>{const color=catalogColor(category);const systems=items.filter(item=>item.itemType==='system'&&String(item.parentId)===String(category.id)),categoryOpen=!collapsedCategories.has(category.id);return <section className={`equipment-board-group panel ${categoryOpen?'category-open':'category-collapsed'}`} key={category.id} style={{'--category-color':color}}><header><button type="button" className="equipment-category-toggle" aria-expanded={categoryOpen} onClick={()=>setCollapsedCategories(current=>{const next=new Set(current);next.has(category.id)?next.delete(category.id):next.add(category.id);return next})}><span className="catalog-category-icon" style={{background:color}}>{category.iconImageStoredName?<img src={`${apiRoot}/equipment-catalog/${category.id}/icon`} alt=""/>:<Boxes size={20}/>}</span><span><strong>{category.name}</strong><small>{systems.length} מערכות · לחיצה לצמצום</small></span>{categoryOpen?<ChevronDown size={18}/>:<ChevronLeft size={18}/>}</button>{editable&&<span className="equipment-category-actions"><button onClick={()=>onCreate('system',category.id)} title="הוספת תת־קטגוריה או מערכת"><Plus size={15}/><span>מערכת</span></button><button onClick={()=>onEdit(category)} title="עריכת סוג מערכת"><Pencil size={15}/><span>עריכה</span></button></span>}</header>
      {categoryOpen&&<div className="equipment-board-scroll"><div className="equipment-board-table" style={{'--custom-columns':columns.length}}><div className="equipment-board-head"><span>תת־קטגוריה / מערכת</span><span>סוג מערכת</span><span>סה״כ כמות</span><span>הותקן</span><span>יתרה</span><span>פעולות</span></div>
      {systems.map(system=>{const children=items.filter(item=>item.itemType==='component'&&String(item.parentId)===String(system.id));const total=children.reduce((sum,item)=>sum+Number(metadata(item).quantity||0),0);const installed=children.reduce((sum,item)=>sum+Number(metadata(item).installedQuantity||0),0);const open=expanded.has(system.id);return <div className={`equipment-parent ${open?'open':''}`} key={system.id}>
        <div className="equipment-parent-row"><button className="equipment-expand" onClick={()=>setExpanded(current=>{const next=new Set(current);next.has(system.id)?next.delete(system.id):next.add(system.id);return next})}>{open?<ChevronDown size={17}/>:<ChevronLeft size={17}/>}</button><input disabled={!editable} defaultValue={system.name} onBlur={event=>event.target.value!==system.name&&update(system,{name:event.target.value})}/><select disabled={!editable} value={system.parentId||''} onChange={event=>update(system,{parentId:Number(event.target.value)})}>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><b>{total}</b><b className="installed">{installed}</b><b className="remaining">{Math.max(0,total-installed)}</b><span className="equipment-row-actions">{editable&&<><button onClick={()=>onCreate('component',system.id)} title="הוספת רכיב"><Plus size={15}/></button><button onClick={()=>onEdit(system)} title="עריכת תת־קטגוריה או מערכת"><Pencil size={15}/></button></>}{user.role==='admin'&&<button onClick={()=>onDelete(system)}><Trash2 size={15}/></button>}</span><span className="equipment-parent-mobile-menu"><MobileActionMenu label="פעולות מערכת">{editable&&<button onClick={()=>onCreate('component',system.id)}><Plus size={16}/><span>הוספת רכיב</span></button>}{editable&&<button onClick={()=>onEdit(system)}><Pencil size={16}/><span>עריכת תת־קטגוריה / מערכת</span></button>}{user.role==='admin'&&<button className="danger" onClick={()=>onDelete(system)}><Trash2 size={16}/><span>מחיקת מערכת</span></button>}</MobileActionMenu></span></div>
        {open&&<div className="equipment-subtable"><div className="equipment-subhead" style={{gridTemplateColumns:subitemGrid}}><span>רכיב</span><span>מיקום</span><span>תיוג</span><span>מק״ט</span><span>כמות</span><span>סטטוס</span>{columns.map((column,index)=><span draggable key={column.key} onDragStart={event=>event.dataTransfer.setData('text/plain',String(index))} onDragOver={event=>event.preventDefault()} onDrop={event=>moveColumn(Number(event.dataTransfer.getData('text/plain')),index)}><GripVertical size={13}/>{column.label}{editable&&<button onClick={()=>persistColumns(columns.filter(item=>item.key!==column.key))}>×</button>}</span>)}<span/></div>
          {children.map(child=>{const data=metadata(child);const custom=data.customFields||{};return <div className="equipment-subrow" key={child.id} style={{gridTemplateColumns:subitemGrid}}><label className="equipment-mobile-field item-name"><small>רכיב</small><input disabled={!editable} defaultValue={child.name} onBlur={event=>event.target.value!==child.name&&update(child,{name:event.target.value})}/></label><label className="equipment-mobile-field"><small>מיקום</small><input disabled={!editable} defaultValue={data.location||''} placeholder="הוספת מיקום" onBlur={event=>updateMeta(child,{location:event.target.value})}/></label><label className="equipment-mobile-field"><small>תיוג</small><input disabled={!editable} defaultValue={data.tag||''} placeholder="הוספת תיוג" onBlur={event=>updateMeta(child,{tag:event.target.value})}/></label><label className="equipment-mobile-field sku"><small>מק״ט</small><input disabled={!editable} defaultValue={child.prioritySku||child.code||''} onBlur={event=>update(child,{prioritySku:event.target.value})}/></label><label className="equipment-mobile-field"><small>כמות</small><input disabled={!editable} type="number" min="0" step="1" defaultValue={Number(data.quantity||0)} onBlur={event=>updateMeta(child,{quantity:Number(event.target.value)})}/></label><label className="equipment-mobile-field status"><small>סטטוס</small><select disabled={!editable} value={data.status||'waiting'} onChange={event=>updateMeta(child,{status:event.target.value,installedQuantity:event.target.value==='installed'?Number(data.quantity||0):Number(data.installedQuantity||0)})} className={`equipment-status ${data.status||'waiting'}`}><option value="waiting">ממתין</option><option value="in_progress">בביצוע</option><option value="installed">הותקן</option></select></label>{columns.map(column=><label className="equipment-mobile-field custom" key={column.key}><small>{column.label}</small><input disabled={!editable} defaultValue={custom[column.key]||''} onBlur={event=>updateMeta(child,{customFields:{...custom,[column.key]:event.target.value}})}/></label>)}<span className="equipment-row-actions">{editable&&<><button onClick={()=>onEdit(child)} title="עריכת רכיב"><Pencil size={14}/></button><button onClick={()=>onDuplicate(child,system.id)} title="שכפול"><Copy size={14}/></button></>}{user.role==='admin'&&<button onClick={()=>onDelete(child)} title="מחיקה"><Trash2 size={14}/></button>}</span><span className="equipment-mobile-menu"><MobileActionMenu label="פעולות רכיב">{editable&&<button onClick={()=>onEdit(child)}><Pencil size={16}/><span>עריכת רכיב</span></button>}{editable&&<button onClick={()=>onDuplicate(child,system.id)}><Copy size={16}/><span>שכפול רכיב</span></button>}{user.role==='admin'&&<button className="danger" onClick={()=>onDelete(child)}><Trash2 size={16}/><span>מחיקת רכיב</span></button>}</MobileActionMenu></span></div>})}
          {editable&&<button className="equipment-add-row" onClick={()=>onCreate('component',system.id)}><Plus size={15}/>הוספת רכיב</button>}</div>}
      </div>})}</div></div>}
    </section>})}
  </div>;
}

function EquipmentEditor({ value, items, onClose, onSave }) {
  const [form, setForm] = useState(value);
  const [iconFile, setIconFile] = useState(null);
  const parentChoices =
    form.itemType === "system"
      ? items.filter((item) => item.itemType === "system_type")
      : form.itemType === "component"
        ? items.filter((item) => item.itemType === "system")
        : [];
  return (
    <Modal
      title={form.id?`עריכת ${form.itemType==='system_type'?'סוג מערכת':form.itemType==='system'?'תת־קטגוריה / מערכת':'רכיב'}`:`${form.itemType==='system_type'?'סוג מערכת':form.itemType==='system'?'תת־קטגוריה / מערכת':'רכיב'} חדש`}
      subtitle="עריכת כל השמות, השיוכים והפרטים במבנה הקטלוג"
      onClose={onClose}
    >
      <form
        className="master-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form, iconFile);
        }}
      >
        <label>
          סוג פריט
          <select
            value={form.itemType}
            onChange={(event) =>
              setForm({ ...form, itemType: event.target.value, parentId: "" })
            }
          >
            <option value="system_type">סוג מערכת</option>
            <option value="system">תת־קטגוריה / מערכת</option>
            <option value="component">רכיב</option>
          </select>
        </label>
        <label>
          שם *
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        {form.itemType !== "system_type" && (
          <label>
            שייך אל *
            <select
              required
              value={form.parentId}
              onChange={(event) =>
                setForm({ ...form, parentId: event.target.value })
              }
            >
              <option value="">בחירה...</option>
              {parentChoices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          קוד / מק״ט
          <input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
        </label>
        <label>מק״ט Priority<input value={form.prioritySku||""} onChange={(event)=>setForm({...form,prioritySku:event.target.value})}/></label>
        <label>
          יצרן
          <input
            value={form.manufacturer}
            onChange={(event) =>
              setForm({ ...form, manufacturer: event.target.value })
            }
          />
        </label>
        <label>
          דגם
          <input
            value={form.model}
            onChange={(event) =>
              setForm({ ...form, model: event.target.value })
            }
          />
        </label>
        <label>
          יחידת מידה
          <input
            value={form.unit}
            onChange={(event) => setForm({ ...form, unit: event.target.value })}
          />
        </label>
        <label>
          צבע
          <input
            type="color"
            value={form.color}
            onChange={(event) =>
              setForm({ ...form, color: event.target.value })
            }
          />
        </label>
        <label className="wide equipment-icon-upload">
          <Upload size={18} />
          <span>
            {iconFile?.name ||
              (form.iconImageStoredName
                ? "החלפת תמונת האייקון"
                : "אייקון תמונה מותאם — PNG, JPG או WebP")}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setIconFile(event.target.files?.[0] || null)}
          />
        </label>
        <label className="wide">
          תיאור
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
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

function RoleManager({ roles,onClose, onSave,onDelete }) {
  const [form, setForm] = useState({name:"",color:"#6957df",icon:"user-round",active:true});
  const edit=role=>setForm({...role});
  const reset=()=>setForm({name:"",color:"#6957df",icon:"user-round",active:true});
  return (
    <Modal
      title="ניהול תפקידים"
      subtitle="הוספה, עריכה, צבע ואייקון מותאם לכל תפקיד"
      onClose={onClose}
    >
      <form
        className="master-form"
        onSubmit={async(event) => {
          event.preventDefault();
          if(await onSave(form))reset();
        }}
      >
        <label>
          שם התפקיד *
          <input
            autoFocus
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          צבע
          <input
            type="color"
            value={form.color}
            onChange={(event) =>
              setForm({ ...form, color: event.target.value })
            }
          />
        </label>
        <label>
          אייקון מותאם
          <div className="role-icon-picker">{roleIconOptions.map(([key,label,Icon])=><button type="button" key={key} title={label} className={form.icon===key?'selected':''} onClick={()=>setForm({...form,icon:key})}><Icon size={19}/></button>)}</div>
        </label>
        {form.id&&<label className="role-active-toggle"><input type="checkbox" checked={form.active!==false} onChange={event=>setForm({...form,active:event.target.checked})}/>תפקיד פעיל וזמין לבחירה</label>}
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ביטול
          </button>
          {form.id&&<button type="button" className="danger-icon role-delete" onClick={()=>onDelete(form)}><Trash2 size={15}/>מחיקה</button>}
          {form.id&&<button type="button" className="ops-secondary" onClick={reset}>תפקיד חדש</button>}
          <button className="ops-primary">{form.id?'שמירת שינויים':'הוספת תפקיד'}</button>
        </div>
      </form>
      <div className="role-management-list">{roles.map(role=><button type="button" key={role.id} className={!role.active?'inactive':''} onClick={()=>edit(role)}><i style={{background:role.color}}><RoleIcon name={role.icon}/></i><span><b>{role.name}</b><small>{role.active?'פעיל':'מושבת'}</small></span><Pencil size={15}/></button>)}</div>
    </Modal>
  );
}

function DocumentsTable({ items, apiRoot, user, onDelete }) {
  if (!items.length)
    return (
      <EmptyState
        icon={FileText}
        title="אין עדיין מסמכים במאגר"
        text="ניתן להעלות תוכניות, PDF, מסמכים סרוקים, הזמנות, תמונות וגיליונות."
      />
    );
  return (
    <div className="documents-table">
      <div className="documents-head">
        <span>מסמך</span>
        <span>קטגוריה</span>
        <span>שיוך</span>
        <span>גרסה</span>
        <span>הועלה</span>
        <span />
      </div>
      {items.map((item) => (
        <div className="document-row" key={item.id}>
          <span>
            <i>
              <FileText size={18} />
            </i>
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.originalName} · {formatBytes(item.sizeBytes)}
              </small>
            </div>
          </span>
          <span>{item.category}</span>
          <span>{item.projectName || item.clientName || "טופס"}</span>
          <span>v{item.version}</span>
          <span>
            {new Date(item.createdAt).toLocaleDateString("he-IL")}
            <small>{item.uploadedByName}</small>
          </span>
          <span>
            <a
              href={`${apiRoot}/documents/${item.id}/preview`}
              target="_blank"
              rel="noreferrer"
              title="תצוגה / פתיחה"
            >
              <Eye size={16} />
            </a>
            <a href={`${apiRoot}/documents/${item.id}/download`} title="הורדה">
              <Download size={16} />
            </a>
            {user.role === "admin" && (
              <button onClick={() => onDelete(item)}>
                <Trash2 size={16} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function DocumentUpload({
  clients,
  projects,
  api,
  onClose,
  onDone,
  setNotice,
}) {
  const [form, setForm] = useState({
    title: "",
    category: "תוכנית",
    clientId: "",
    projectId: "",
    tags: "",
    version: 1,
    description: "",
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (!file || (!form.clientId && !form.projectId))
      return setNotice("יש לבחור קובץ ושיוך ללקוח או לפרויקט");
    const body = new FormData();
    Object.entries(form).forEach(
      ([key, value]) =>
        value !== "" &&
        body.append(
          key,
          key === "tags"
            ? JSON.stringify(
                value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              )
            : value,
        ),
    );
    body.append("file", file);
    setBusy(true);
    try {
      await api("/documents", { method: "POST", body });
      onDone();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="העלאת מסמך למאגר"
      subtitle="עד 100MB · PDF, תמונות, תוכניות, מסמכים סרוקים וגיליונות"
      onClose={onClose}
    >
      <form className="master-form" onSubmit={submit}>
        <label className="wide document-drop">
          <Upload size={25} />
          <strong>{file?.name || "בחירת קובץ"}</strong>
          <input
            type="file"
            required
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <label>
          כותרת
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            placeholder="אם ריק, יופיע שם הקובץ"
          />
        </label>
        <label>
          קטגוריה
          <select
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value })
            }
          >
            {[
              "תוכנית",
              "מסמך סרוק",
              "PDF",
              "הזמנה",
              "הצעת מחיר",
              "פרוטוקול",
              "צילום אתר",
              "אחר",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          לקוח
          <select
            value={form.clientId}
            onChange={(event) =>
              setForm({ ...form, clientId: event.target.value })
            }
          >
            <option value="">ללא</option>
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          פרויקט
          <select
            value={form.projectId}
            onChange={(event) =>
              setForm({ ...form, projectId: event.target.value })
            }
          >
            <option value="">ללא</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          תגים
          <input
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="למשל: חשמל, קומה 2"
          />
        </label>
        <label>
          גרסה
          <input
            type="number"
            min="1"
            value={form.version}
            onChange={(event) =>
              setForm({ ...form, version: event.target.value })
            }
          />
        </label>
        <label className="wide">
          תיאור
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="ops-primary" disabled={busy}>
            {busy ? "מעלה..." : "העלאה"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return <AppModal title={title} subtitle={subtitle} onClose={onClose} className="master-modal">{children}</AppModal>;
}
function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="master-empty">
      <span>
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function formatBytes(value) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 3);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
