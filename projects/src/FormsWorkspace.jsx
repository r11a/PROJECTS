import { useEffect, useMemo, useState } from 'react';
import { Camera, Check, CheckCircle2, ClipboardCheck, Download, FileText, FormInput, Pencil, Plus, Save, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { ModalPortal } from './AppModal';

const statusMeta = {
  draft: { label: 'טיוטה', tone: 'draft' },
  completed: { label: 'הושלם', tone: 'completed' },
  approved: { label: 'אושר', tone: 'approved' },
};
const categoryNames = { general: 'כללי', inspection: 'ביקורת', handover: 'מסירה', infrastructure: 'תשתיות', change_order: 'שינוי לקוח' };
const fieldTypeNames = { text: 'טקסט', textarea: 'טקסט ארוך', number: 'מספר', date: 'תאריך', checkbox: 'סימון', select: 'בחירה', phone: 'טלפון', email: 'דוא״ל' };
const emptyField = () => ({ id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, label: '', type: 'text', required: false, options: [] });

export function FormsWorkspace({ api, apiRoot, user, setNotice }) {
  const [data, setData] = useState({ templates: [], records: [], clients: [], projects: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('templates');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [templateEditor, setTemplateEditor] = useState(null);
  const [recordEditor, setRecordEditor] = useState(null);
  const [uploading, setUploading] = useState(false);
  const canManage = ['admin', 'manager'].includes(user.role);
  const canFill = ['admin', 'manager', 'technician'].includes(user.role);

  const load = async () => {
    try { setLoading(true); setData(await api(`/forms?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`)); }
    catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [query, status]);

  const removeTemplate = async (template) => {
    if (!window.confirm(`למחוק את התבנית „${template.name}”?`)) return;
    try { await api(`/form-templates/${template.id}`, { method: 'DELETE' }); setNotice('התבנית נמחקה'); load(); } catch (error) { setNotice(error.message); }
  };
  const removeRecord = async (record) => {
    if (!window.confirm(`למחוק את הטופס „${record.title}”?`)) return;
    try { await api(`/form-records/${record.id}`, { method: 'DELETE' }); setNotice('הטופס נמחק'); setRecordEditor(null); load(); } catch (error) { setNotice(error.message); }
  };
  const uploadFile = async (file, target) => {
    if (!file || !target) return setNotice('יש לבחור לקוח או פרויקט לשיוך הקובץ');
    const [type,id]=target.split(':');
    const body=new FormData();
    body.set(type==='project'?'projectId':'clientId',id);
    body.set('title',file.name || `צילום ${new Date().toLocaleString('he-IL')}`);
    body.set('category',file.type?.startsWith('image/')?'תמונה':'מסמך');
    body.set('file',file);
    setUploading(true);
    try{await api('/documents',{method:'POST',body});setNotice(file.type?.startsWith('image/')?'התמונה הועלתה בהצלחה':'הקובץ הועלה בהצלחה');await load();}
    catch(error){setNotice(error.message);}finally{setUploading(false);}
  };

  const activeTemplates = data.templates.filter((template) => template.active);
  const visibleTemplates = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('he');
    return term ? data.templates.filter((template) => `${template.name} ${template.description} ${categoryNames[template.category] || ''}`.toLocaleLowerCase('he').includes(term)) : data.templates;
  }, [data.templates, query]);
  return <div className="forms-workspace">
    <div className="page-intro forms-intro"><div><h2>טפסים ומסמכים</h2><p>תבניות, מילויים ומסמכי לקוח הנשמרים במערכת המשותפת</p></div><div>{canFill && <button className="secondary-button" disabled={!activeTemplates.length} onClick={() => setRecordEditor({ template: activeTemplates[0] })}><FormInput size={17} />מילוי טופס</button>}{canManage && <button className="primary-button" onClick={() => setTemplateEditor({})}><Plus size={17} />תבנית חדשה</button>}</div></div>
    <div className="forms-summary"><Summary icon={ClipboardCheck} label="תבניות פעילות" value={activeTemplates.length} /><Summary icon={FileText} label="טפסים שנשמרו" value={data.records.length} /><Summary icon={CheckCircle2} label="הושלמו ואושרו" value={data.records.filter((record) => record.status !== 'draft').length} /></div>
    <div className="forms-command panel"><nav><button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>תבניות</button><button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>טפסים שמולאו</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>קבצים ותמונות</button></nav><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בטפסים, לקוחות ופרויקטים..." /></label>{tab === 'records' && <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">כל הסטטוסים</option><option value="draft">טיוטה</option><option value="completed">הושלם</option><option value="approved">אושר</option></select>}</div>
    {loading ? <div className="forms-loading panel">טוען נתונים...</div> : tab === 'templates' ? <TemplateGrid templates={visibleTemplates} canManage={canManage} canFill={canFill} onEdit={setTemplateEditor} onFill={(template) => setRecordEditor({ template })} onDelete={removeTemplate} api={api} reload={load} setNotice={setNotice} /> : tab === 'records' ? <RecordList records={data.records} onOpen={(record) => setRecordEditor({ record, template: data.templates.find((item) => item.id === record.templateId) })} /> : <FilesHub files={data.files} clients={data.clients} projects={data.projects} apiRoot={apiRoot} canUpload={canFill} uploading={uploading} onUpload={uploadFile} />}
    {templateEditor && <ModalPortal><TemplateEditor initial={templateEditor.id ? templateEditor : null} api={api} onClose={() => setTemplateEditor(null)} onSaved={() => { setTemplateEditor(null); load(); }} setNotice={setNotice} user={user} onDelete={removeTemplate} /></ModalPortal>}
    {recordEditor && <ModalPortal><RecordEditor initial={recordEditor.record || null} initialTemplate={recordEditor.template} templates={activeTemplates} clients={data.clients} projects={data.projects} api={api} user={user} onClose={() => setRecordEditor(null)} onSaved={() => { setRecordEditor(null); load(); }} onDelete={removeRecord} setNotice={setNotice} /></ModalPortal>}
  </div>;
}

function Summary({ icon: Icon, label, value }) { return <div className="panel"><span><Icon size={20} /></span><div><small>{label}</small><strong>{value}</strong></div></div>; }

function TemplateGrid({ templates, canManage, canFill, onEdit, onFill, onDelete, api, reload, setNotice }) {
  const toggle = async (template) => { try { await api(`/form-templates/${template.id}`, { method: 'PATCH', body: JSON.stringify({ ...template, active: !template.active }) }); setNotice(template.active ? 'התבנית הושבתה' : 'התבנית הופעלה'); reload(); } catch (error) { setNotice(error.message); } };
  if (!templates.length) return <Empty text="לא נמצאו תבניות. צרו תבנית ראשונה כדי להתחיל לעבוד." />;
  return <div className="operational-forms-grid">{templates.map((template) => <article className={`panel operational-form-card ${template.active ? '' : 'inactive'}`} key={template.id} style={{ '--form-color': template.color }}><header><span><ClipboardCheck size={21} /></span><em>{template.active ? 'פעילה' : 'מושבתת'}</em></header><small>{categoryNames[template.category] || template.category}</small><h3>{template.name}</h3><p>{template.description || 'ללא תיאור'}</p><div className="operational-form-meta"><span><FormInput size={15} />{template.fields.length} שדות</span><span><FileText size={15} />{template.useCount} מילויים</span><span>גרסה {template.version}</span></div><footer>{canFill && template.active && <button className="form-fill" onClick={() => onFill(template)}>מילוי חדש</button>}{canManage && <button onClick={() => onEdit(template)}><Pencil size={15} />עריכה</button>}{canManage && <button onClick={() => toggle(template)}>{template.active ? 'השבתה' : 'הפעלה'}</button>}{canManage && template.useCount === 0 && <button className="form-delete" onClick={() => onDelete(template)}><Trash2 size={15} /></button>}</footer></article>)}</div>;
}

function RecordList({ records, onOpen }) {
  if (!records.length) return <Empty text="לא נמצאו טפסים שמולאו לפי הסינון הנוכחי." />;
  return <section className="panel form-records"><div className="form-record-head"><span>טופס</span><span>לקוח / פרויקט</span><span>סטטוס</span><span>עודכן</span><span /></div>{records.map((record) => <button className="form-record-row" key={record.id} onClick={() => onOpen(record)}><span><i><FileText size={18} /></i><b>{record.title}</b><small>{record.templateName}</small></span><span><b>{record.clientName || 'ללא לקוח'}</b><small>{record.projectName || 'ללא פרויקט'}</small></span><em className={statusMeta[record.status]?.tone}>{statusMeta[record.status]?.label}</em><time>{new Date(record.updatedAt).toLocaleString('he-IL')}</time><Pencil size={16} /></button>)}</section>;
}

function FilesHub({ files, clients, projects, apiRoot, canUpload, uploading, onUpload }) {
  const [target,setTarget]=useState(projects[0]?.id?`project:${projects[0].id}`:clients[0]?.id?`client:${clients[0].id}`:'');
  return <div className="forms-files-hub">{canUpload&&<section className="panel forms-capture-bar"><div><span><Camera size={21}/></span><div><h3>צילום והעלאת קבצים</h3><p>צלמו מהטלפון או בחרו תמונה, PDF ומסמך מהמכשיר.</p></div></div><label>שיוך<select value={target} onChange={(event)=>setTarget(event.target.value)}><option value="">בחירת לקוח או פרויקט</option><optgroup label="פרויקטים">{projects.map((item)=><option key={item.id} value={`project:${item.id}`}>{item.name}</option>)}</optgroup><optgroup label="לקוחות">{clients.map((item)=><option key={item.id} value={`client:${item.id}`}>{item.name}</option>)}</optgroup></select></label><div className="capture-actions"><label className={uploading?'disabled':''}><Camera size={17}/>צילום עכשיו<input type="file" accept="image/*" capture="environment" disabled={uploading} onChange={(event)=>{const file=event.target.files?.[0];if(file)onUpload(file,target);event.target.value='';}}/></label><label className={uploading?'disabled':''}><Upload size={17}/>{uploading?'מעלה...':'בחירה מהמכשיר'}<input type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" disabled={uploading} onChange={(event)=>{const file=event.target.files?.[0];if(file)onUpload(file,target);event.target.value='';}}/></label></div></section>}{files.length?<section className="panel operational-files-list">{files.map((file) => <a key={file.id} href={`${apiRoot}/documents/${file.id}/download`}><span className={file.mime_type?.startsWith('image/')?'file-thumbnail':''}>{file.mime_type?.startsWith('image/')?<img src={`${apiRoot}/documents/${file.id}/preview`} alt="" loading="lazy"/>:<FileText size={19} />}</span><div><strong>{file.title||file.original_name}</strong><small>{file.project_name||file.client_name||'ללא שיוך'} · {new Date(file.created_at).toLocaleDateString('he-IL')} · {file.uploaded_by_name||'מערכת'}</small></div><em>{formatSize(file.size_bytes)}</em><Download size={17} /></a>)}</section>:<Empty text="עדיין לא הועלו קבצים או תמונות." />}</div>;
}

function TemplateEditor({ initial, api, onClose, onSaved, setNotice, user, onDelete }) {
  const [form, setForm] = useState(initial ? { ...initial, fields: initial.fields.map((field) => ({ ...field, optionsText: (field.options || []).join(', ') })) } : { name: '', description: '', category: 'general', color: '#6957df', icon: 'clipboard-check', active: true, fields: [emptyField()] });
  const [saving, setSaving] = useState(false);
  const updateField = (index, patch) => setForm({ ...form, fields: form.fields.map((field, position) => position === index ? { ...field, ...patch } : field) });
  const save = async (event) => { event.preventDefault(); setSaving(true); try { const payload = { ...form, fields: form.fields.map(({ optionsText, ...field }) => ({ ...field, options: field.type === 'select' ? String(optionsText || '').split(',').map((value) => value.trim()).filter(Boolean) : [] })) }; await api(initial ? `/form-templates/${initial.id}` : '/form-templates', { method: initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); setNotice(initial ? 'התבנית עודכנה' : 'התבנית נוצרה'); onSaved(); } catch (error) { setNotice(error.message); } finally { setSaving(false); } };
  return <div className="ops-modal-backdrop" onMouseDown={onClose}><form className="ops-modal form-builder-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={save}><div className="ops-modal-title"><div><span>ניהול תבניות</span><h2>{initial ? 'עריכת תבנית' : 'תבנית חדשה'}</h2><p>כל שדה שנוסף כאן יופיע מיד בטופס העבודה.</p></div><button type="button" onClick={onClose}><X /></button></div><div className="form-builder-body"><div className="form-builder-meta"><label>שם התבנית<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>קטגוריה<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{Object.entries(categoryNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>צבע<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label><label className="wide">תיאור<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><div className="builder-fields-head"><div><h3>שדות הטופס</h3><small>{form.fields.length} שדות</small></div><button type="button" onClick={() => setForm({ ...form, fields: [...form.fields, emptyField()] })}><Plus size={15} />הוספת שדה</button></div><div className="builder-fields">{form.fields.map((field, index) => <div className="builder-field" key={field.id}><b>{index + 1}</b><label>כותרת<input required value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} /></label><label>סוג<select value={field.type} onChange={(event) => updateField(index, { type: event.target.value })}>{Object.entries(fieldTypeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{field.type === 'select' && <label>אפשרויות<input value={field.optionsText || ''} onChange={(event) => updateField(index, { optionsText: event.target.value })} placeholder="מופרדות בפסיק" /></label>}<label className="field-required"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />חובה</label><button type="button" disabled={form.fields.length === 1} onClick={() => setForm({ ...form, fields: form.fields.filter((_, position) => position !== index) })}><Trash2 size={16} /></button></div>)}</div></div><div className="ops-modal-actions">{initial && user.role === 'admin' && initial.useCount === 0 && <button type="button" className="ops-danger" onClick={() => onDelete(initial)}><Trash2 size={16} />מחיקה</button>}<button type="button" className="ops-ghost" onClick={onClose}>ביטול</button><button className="ops-primary" disabled={saving}>{saving ? 'שומר...' : <><Save size={16} />שמירת תבנית</>}</button></div></form></div>;
}

function RecordEditor({ initial, initialTemplate, templates, clients, projects, api, user, onClose, onSaved, onDelete, setNotice }) {
  const [templateId, setTemplateId] = useState(String(initial?.templateId || initialTemplate?.id || templates[0]?.id || ''));
  const template = templates.find((item) => String(item.id) === templateId) || initialTemplate;
  const [form, setForm] = useState({ title: initial?.title || initialTemplate?.name || templates[0]?.name || '', clientId: initial?.clientId || '', projectId: initial?.projectId || '', scheduledFor: initial?.scheduledFor?.slice?.(0, 10) || '', notes: initial?.notes || '', values: initial?.values || {}, activityType:initial?.activityType || '', workHours:initial?.workHours || '' });
  const [saving, setSaving] = useState(false);
  const availableProjects = form.clientId ? projects.filter((project) => String(project.client_id) === String(form.clientId)) : projects;
  const recordFields = initial ? initial.templateFields : template?.fields || [];
  const save = async (status) => { if (!template) return; setSaving(true); try { const payload = { ...form, templateId: template.id, status }; await api(initial ? `/form-records/${initial.id}` : '/form-records', { method: initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); setNotice(status === 'draft' ? 'הטיוטה נשמרה' : status === 'approved' ? 'הטופס אושר' : 'הטופס הושלם'); onSaved(); } catch (error) { setNotice(error.message); } finally { setSaving(false); } };
  const setValue = (id, value) => setForm({ ...form, values: { ...form.values, [id]: value } });
  return <div className="ops-modal-backdrop" onMouseDown={onClose}><section className="ops-modal form-fill-modal" onMouseDown={(event) => event.stopPropagation()}><div className="ops-modal-title"><div><span>{initial ? `טופס #${initial.id}` : 'מילוי חדש'}</span><h2>{template?.name || 'בחירת תבנית'}</h2><p>{template?.description}</p></div><button onClick={onClose}><X /></button></div><div className="form-fill-body">{!initial && <label className="wide">תבנית<select value={templateId} onChange={(event) => { const next = templates.find((item) => String(item.id) === event.target.value); setTemplateId(event.target.value); setForm({ ...form, title: next?.name || '', values: {} }); }}>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<div className="form-link-grid"><label>כותרת<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>תאריך עבודה<input type="date" value={form.scheduledFor} onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })} /></label><label>לקוח<select value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value, projectId: '' })}><option value="">ללא לקוח</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>פרויקט<select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">ללא פרויקט</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>קטגוריית שעות<select value={form.activityType} onChange={(event)=>setForm({...form,activityType:event.target.value})}><option value="">ללא דיווח שעות</option><option value="planning">תכנון</option><option value="supervision">פיקוח</option><option value="technician">זמן טכנאים</option><option value="installation">התקנה</option><option value="threading">השחלות</option><option value="programming">תכנות</option><option value="training">הדרכה</option></select></label><label>שעות שבוצעו<input type="number" min="0" max="24" step="0.25" value={form.workHours} onChange={(event)=>setForm({...form,workHours:event.target.value})} placeholder="0"/></label></div><div className="dynamic-form-fields">{recordFields.map((field) => <DynamicField key={field.id} field={field} value={form.values[field.id]} onChange={(value) => setValue(field.id, value)} />)}</div><label className="form-notes">הערות כלליות<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>{initial && <div className="record-audit"><span>נוצר על ידי {initial.createdByName || 'משתמש'}</span>{initial.completedAt && <span>הושלם {new Date(initial.completedAt).toLocaleString('he-IL')}</span>}{initial.approvedAt && <span>אושר {new Date(initial.approvedAt).toLocaleString('he-IL')}</span>}</div>}</div><div className="ops-modal-actions">{initial && user.role === 'admin' && <button className="ops-danger" onClick={() => onDelete(initial)}><Trash2 size={16} />מחיקה</button>}<button className="ops-ghost" onClick={onClose}>סגירה</button><button className="ops-secondary" disabled={saving} onClick={() => save('draft')}><Save size={16} />שמירת טיוטה</button><button className="ops-primary" disabled={saving} onClick={() => save(initial?.status === 'completed' && ['admin', 'manager'].includes(user.role) ? 'approved' : initial?.status === 'approved' ? 'approved' : 'completed')}>{initial?.status === 'completed' && ['admin', 'manager'].includes(user.role) ? <><ShieldCheck size={16} />אישור</> : <><Check size={16} />השלמה</>}</button></div></section></div>;
}

function DynamicField({ field, value, onChange }) {
  if (field.type === 'checkbox') return <label className="dynamic-checkbox"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span><Check size={15} /></span><b>{field.label}{field.required && <em>חובה</em>}</b></label>;
  return <label className={field.type === 'textarea' ? 'wide' : ''}>{field.label}{field.required && <em>חובה</em>}{field.type === 'textarea' ? <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} /> : field.type === 'select' ? <select value={value || ''} onChange={(event) => onChange(event.target.value)}><option value="">בחירה...</option>{(field.options || []).map((option) => <option key={option}>{option}</option>)}</select> : <input type={field.type === 'phone' ? 'tel' : field.type} value={value ?? ''} onChange={(event) => onChange(field.type === 'number' ? event.target.value === '' ? '' : Number(event.target.value) : event.target.value)} />}</label>;
}

function Empty({ text }) { return <div className="panel operational-forms-empty"><span><FileText size={25} /></span><h3>אין נתונים להצגה</h3><p>{text}</p></div>; }
function formatSize(bytes) { const value = Number(bytes || 0); return value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`; }
