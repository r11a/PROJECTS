import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  Check,
  Download,
  Eye,
  FileText,
  HardHat,
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
  X,
} from "lucide-react";

const emptyProfessional = {
  displayName: "",
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
};
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
  const [equipment, setEquipment] = useState([]);
  const [query, setQuery] = useState("");
  const [professionalForm, setProfessionalForm] = useState(null);
  const [equipmentForm, setEquipmentForm] = useState(null);
  const [roleForm, setRoleForm] = useState(false);
  const [priorityScanOpen, setPriorityScanOpen] = useState(false);
  const [priorityScan, setPriorityScan] = useState(null);
  const [priorityProjectId, setPriorityProjectId] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [professionalView,setProfessionalView]=useState(()=>localStorage.getItem('projects-professional-view')||'grid');
  const [professionalRole,setProfessionalRole]=useState('');
  const [professionalSort,setProfessionalSort]=useState('az');

  const load = async () => {
    try {
      const [people, roleData, equipmentData] = await Promise.all([
        api("/professionals"),
        api("/professional-roles"),
        api("/equipment-catalog"),
      ]);
      setProfessionals(people.professionals);
      setRoles(roleData.roles);
      setEquipment(equipmentData.items);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const refresh = async () => {
    await load();
    await onDataChanged?.();
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => setTab(initialTab), [initialTab]);

  const filteredProfessionals = useMemo(
    () =>
      professionals.filter((item) =>
        `${item.displayName} ${item.companyName} ${item.jobTitle} ${item.phone} ${item.email} ${item.roles.map((role) => role.name).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ).filter(item=>!professionalRole||item.roles.some(role=>String(role.id)===professionalRole)).sort((a,b)=>professionalSort==='za'?b.displayName.localeCompare(a.displayName,'he'):professionalSort==='new'?Number(b.id)-Number(a.id):professionalSort==='old'?Number(a.id)-Number(b.id):a.displayName.localeCompare(b.displayName,'he')),
    [professionals, query,professionalRole,professionalSort],
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
          {tab==='professionals'&&<><select value={professionalRole} onChange={e=>setProfessionalRole(e.target.value)}><option value="">כל התפקידים</option>{roles.filter(x=>x.active).map(x=><option key={x.id} value={String(x.id)}>{x.name}</option>)}</select><select value={professionalSort} onChange={e=>setProfessionalSort(e.target.value)}><option value="az">א׳–ת׳</option><option value="za">ת׳–א׳</option><option value="new">חדש–ישן</option><option value="old">ישן–חדש</option></select><div className="professional-view-switch"><button className={professionalView==='grid'?'active':''} onClick={()=>{setProfessionalView('grid');localStorage.setItem('projects-professional-view','grid')}}><LayoutGrid size={16}/></button><button className={professionalView==='table'?'active':''} onClick={()=>{setProfessionalView('table');localStorage.setItem('projects-professional-view','table')}}><Rows3 size={16}/></button></div></>}
          {tab === "professionals" && user.role === "admin" && (
            <button className="ops-secondary" onClick={() => setRoleForm(true)}>
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
              <button className="ops-primary" onClick={() => setEquipmentForm({ ...emptyEquipment })}><Plus size={16} />פריט חדש</button>
            </>
          )}
        </div>
      </div>
      {tab === "professionals" && (
        <ProfessionalsGrid
          items={filteredProfessionals}
          view={professionalView}
          user={user}
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
          onEdit={(item) =>
            setEquipmentForm({ ...item, parentId: item.parentId || "" })
          }
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
        <RoleEditor
          onClose={() => setRoleForm(false)}
          onSave={async (value) => {
            try {
              await api("/professional-roles", {
                method: "POST",
                body: JSON.stringify(value),
              });
              setRoleForm(false);
              setNotice("סוג התפקיד נוסף");
              refresh();
            } catch (error) {
              setNotice(error.message);
            }
          }}
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

function ProfessionalsGrid({ items, user, onEdit, onDelete,view='grid' }) {
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
            <em className={`affiliation ${item.affiliation}`}>
              {item.affiliation === "company" ? "עובד חברה" : "חיצוני"}
            </em>
          </header>
          <div className="role-chips">
            {item.roles.map((role) => (
              <span key={role.id} style={{ "--role-color": role.color }}>
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
          </dl>
          <footer>
            <span className="professional-project-load" title={`${item.projectCount} פרויקטים משויכים`}>
              <i style={{width:`${Math.min(100,Number(item.projectCount||0)*14)}%`}}/>
              <b>{item.projectCount} פרויקטים</b> · {item.clientCount} לקוחות
            </span>
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

function ProfessionalEditor({ value, roles, users, onClose, onSave }) {
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
          שם מלא *
          <input
            required
            value={form.displayName}
            onChange={(event) =>
              setForm({ ...form, displayName: event.target.value })
            }
          />
        </label>
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
                <Check size={14} />
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

function EquipmentTree({ items, apiRoot, user, onEdit, onDelete }) {
  const names = {
    system_type: "סוג מערכת",
    system: "מערכת",
    component: "רכיב",
  };
  if (!items.length)
    return (
      <EmptyState
        icon={Boxes}
        title="קטלוג המערכות עדיין ריק"
        text="בנה היררכיה פשוטה: סוג מערכת, מערכת ורכיבים ששייכים אליה."
      />
    );
  return (
    <div className="equipment-list">
      <div className="equipment-head">
        <span>שם</span>
        <span>סוג</span>
        <span>יצרן / דגם</span>
        <span>קוד</span>
        <span>סטטוס</span>
        <span />
      </div>
      {items.map((item) => (
        <div className={`equipment-row level-${item.itemType}`} key={item.id}>
          <span>
            {item.iconImageStoredName ? (
              <img
                className="catalog-icon-image"
                src={`${apiRoot}/equipment-catalog/${item.id}/icon`}
                alt=""
              />
            ) : (
              <i style={{ background: item.color }} />
            )}{" "}
            <strong>{item.name}</strong>
          </span>
          <span>{names[item.itemType]}</span>
          <span>
            {[item.manufacturer, item.model].filter(Boolean).join(" · ") || "—"}
          </span>
          <span>{item.code || "—"}</span>
          <span>{item.active ? "פעיל" : "מושבת"}</span>
          <span>
            {["admin", "manager"].includes(user.role) && (
              <button onClick={() => onEdit(item)}>
                <Pencil size={15} />
              </button>
            )}
            {user.role === "admin" && (
              <button onClick={() => onDelete(item)}>
                <Trash2 size={15} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
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
      title={form.id ? "עריכת פריט קטלוג" : "פריט מערכת חדש"}
      subtitle="קטלוג מרכזי שניתן לשייך לכל פרויקט ולכל לקוח"
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
            <option value="system">מערכת</option>
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

function RoleEditor({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    color: "#6957df",
    icon: "user-round",
  });
  return (
    <Modal
      title="סוג תפקיד חדש"
      subtitle="התפקיד יהיה זמין לכל אנשי המקצוע"
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
          אייקון
          <input
            value={form.icon}
            onChange={(event) => setForm({ ...form, icon: event.target.value })}
            placeholder="user-round"
          />
        </label>
        <div className="wide form-actions">
          <button type="button" className="ops-secondary" onClick={onClose}>
            ביטול
          </button>
          <button className="ops-primary">הוספת תפקיד</button>
        </div>
      </form>
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
  return (
    <div
      className="ops-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="ops-modal master-modal">
        <header>
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
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
