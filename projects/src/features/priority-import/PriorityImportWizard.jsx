import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { AppModal } from "../../AppModal";
import { PriorityLineEditor } from "./PriorityLineEditor";
import { PriorityOrderPreview } from "./PriorityOrderPreview";
import { classificationLabel, preparePriorityLines, priorityHours, priorityReview } from "./priorityImport";
import "./priority-import.css";

const STEPS = ["העלאת קובץ", "פרטי הזמנה", "בחירת פריטים", "קטלוג ומערכות", "שעות ייחוס", "סיכום ואישור"];

export function PriorityImportWizard({ project, api, onClose, onImported }) {
  const inputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(null);
  const [lines, setLines] = useState([]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mismatchConfirmed, setMismatchConfirmed] = useState(false);
  const [updateConfirmed, setUpdateConfirmed] = useState(false);
  const [bulkSystem, setBulkSystem] = useState("");
  const [result, setResult] = useState(null);
  const [existingOrder, setExistingOrder] = useState(null);
  const hours = useMemo(() => priorityHours(lines), [lines]);
  const review = useMemo(() => priorityReview(lines), [lines]);

  const updateLine = (index, changes) => setLines((current) => current.map((line, itemIndex) => itemIndex === index ? { ...line, ...changes } : line));
  const upload = async () => {
    if (!file) return setError("יש לבחור קובץ XLSX של הזמנת Priority");
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.set("file", file);
      const data = await api(`/projects/${encodeURIComponent(project.id)}/priority-orders/preview`, { method: "POST", body });
      setPreview(data); setLines(preparePriorityLines(data.lines)); setMismatchConfirmed(!data.customerMismatch); setUpdateConfirmed(!data.duplicate?.exists); setStep(1);
    } catch (uploadError) { setError(uploadError.message); }
    finally { setBusy(false); }
  };
  const applyToIncluded = (changes) => setLines((current) => current.map((line) => line.include ? { ...line, ...changes } : line));
  const setIncluded = (predicate) => setLines((current) => current.map((line) => ({ ...line, include: predicate(line) })));
  const canContinue = () => {
    if (step === 1 && preview?.customerMismatch && !mismatchConfirmed) return "נדרש אישור לאי־התאמת מספר הלקוח";
    if (step === 1 && preview?.duplicate?.exists && !updateConfirmed) return "יש לבחור ייבוא מחדש או לבטל";
    if (step >= 2 && !lines.some((line) => line.include)) return "יש לבחור לפחות שורה אחת";
    if (step >= 3) {
      const invalid = lines.find((line) => line.include && line.includeInEquipment && !line.catalogItemId && !line.createCatalogItem);
      if (invalid) return `יש להתאים פריט קטלוג בשורה ${invalid.sourceRow}`;
      const missingSystem = lines.find((line) => line.include && line.createCatalogItem && !line.projectSystemId);
      if (missingSystem) return `יש לבחור מערכת יעד לפריט החדש בשורה ${missingSystem.sourceRow}`;
      const unassignedEquipment = lines.find((line) => line.include && line.includeInEquipment && !line.projectSystemId);
      if (unassignedEquipment) return `יש לבחור מערכת יעד בשורה ${unassignedEquipment.sourceRow}`;
    }
    return "";
  };
  const next = () => { const issue = canContinue(); if (issue) return setError(issue); setError(""); setStep((value) => Math.min(STEPS.length - 1, value + 1)); };
  const submit = async () => {
    const issue = canContinue(); if (issue) return setError(issue);
    setBusy(true); setError("");
    try {
      const response = await api(`/projects/${encodeURIComponent(project.id)}/priority-orders/import`, { method: "POST", body: JSON.stringify({
        previewId: preview.previewId, confirmCustomerMismatch: mismatchConfirmed, mode: preview.duplicate?.exists ? "update" : "create",
        lines: lines.map((line) => ({ sourceRow: line.sourceRow, include: line.include, description: line.description, quantity: Number(line.quantity), unit: line.unit,
          classification: line.classification, catalogItemId: line.catalogItemId || null, projectSystemId: line.projectSystemId || null,
          createCatalogItem: line.createCatalogItem, includeInEquipment: line.includeInEquipment, includeInReferenceHours: line.includeInReferenceHours,
          manufacturer: line.manufacturer, model: line.model, systemManuallyChanged:Boolean(line.systemManuallyChanged) })),
      }) });
      setResult(response.import); window.dispatchEvent(new Event("projects:data-changed")); await onImported?.(response.import);
    } catch (importError) { setError(importError.message); }
    finally { setBusy(false); }
  };

  return <AppModal title="ייבוא הזמנת Priority" subtitle={`פרויקט · ${project.name}`} onClose={onClose} closeOnBackdrop={false} className="priority-import-modal">
    <div className="priority-wizard">
      <nav className="priority-steps" aria-label="שלבי הייבוא">{STEPS.map((label, index) => <div className={index === step ? "active" : index < step ? "done" : ""} key={label}><span>{index < step ? <Check size={14} /> : index + 1}</span><small>{label}</small></div>)}</nav>
      <div className="priority-step-content">
        {result ? <section className="priority-success"><span><Check size={34} /></span><h3>ההזמנה יובאה בהצלחה</h3><p>הזמנה {result.orderNumber} נשמרה עם {result.selectedRows} שורות נבחרות ו־{result.equipmentAdded} פריטי ציוד.</p><div><b>יעד התקנה: {result.installationHoursTarget} שעות</b><b>יעד תכנות: {result.programmingHoursTarget} שעות</b></div></section> : <>
          {step === 0 && <section className="priority-upload-zone" onClick={() => inputRef.current?.click()}><input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(""); }} /><span><FileSpreadsheet size={38} /></span><h3>{file ? file.name : "בחירת קובץ הזמנה"}</h3><p>קובץ XLSX שיוצא מ־Priority. הקובץ ינותח לתצוגה מקדימה ולא יישמר במערכת.</p><button type="button"><Upload size={16} />{file ? "בחירת קובץ אחר" : "בחירת קובץ"}</button><small>עד 15MB · קובצי XLSX בלבד</small></section>}
          {step === 1 && preview && <><PriorityOrderPreview preview={preview} mismatchConfirmed={mismatchConfirmed} onMismatchConfirmed={setMismatchConfirmed} updateConfirmed={updateConfirmed} onUpdateConfirmed={setUpdateConfirmed} onReviewExisting={async()=>{try{setExistingOrder(await api(`/projects/${encodeURIComponent(project.id)}/priority-orders/${preview.duplicate.orderId}`))}catch(reviewError){setError(reviewError.message)}}} />{existingOrder&&<section className="priority-existing-review"><header><strong>ייבוא קיים · {existingOrder.order.priorityOrderNumber}</strong><button type="button" onClick={()=>setExistingOrder(null)}>הסתרה</button></header>{existingOrder.lines.map(line=><div key={line.id}><span>{line.prioritySku}</span><b>{line.description}</b><small>{line.quantity} {line.unit} · {classificationLabel(line.classification)}</small></div>)}</section>}</>}
          {step === 2 && <><header className="priority-section-head"><div><h3>בחירת פריטים ועריכה</h3><p>כל שורה ניתנת לעריכה לפני הייבוא. שורות שלא סומנו יישמרו בהיסטוריית ההזמנה בלבד.</p></div><div className="priority-quick-actions"><button type="button" onClick={() => setIncluded(() => true)}>בחר הכל</button><button type="button" onClick={() => setIncluded(() => false)}>בטל הכל</button><button type="button" onClick={() => setIncluded((line) => ["equipment", "material"].includes(line.classification))}>ציוד וחומר בלבד</button></div></header><div className="priority-line-head"><span>ייבוא</span><span>מק״ט</span><span>תיאור</span><span>כמות</span><span>יחידה</span><span>סיווג</span><span>קטלוג</span><span>מערכת יעד</span><span>פעולה</span></div><div className="priority-lines">{lines.map((line, index) => <PriorityLineEditor key={line.sourceRow} line={line} index={index} systems={preview.systems} catalogItems={preview.catalogItems} canCreateCatalogItems={preview.canCreateCatalogItems} onChange={updateLine} />)}</div></>}
          {step === 3 && <><header className="priority-section-head"><div><h3>התאמת קטלוג ומערכות</h3><p>זהות פריט הקטלוג והשיוך למערכת בפרויקט הם שני דברים נפרדים. אפשר לשייך את אותו מק״ט למערכת אחרת בכל פרויקט.</p></div></header><div className="priority-bulk-bar"><strong>פעולה מרוכזת על כל השורות המסומנות</strong><select value={bulkSystem} onChange={(event) => setBulkSystem(event.target.value)}><option value="">בחירת מערכת…</option>{preview.systems.map((system) => <option value={system.id} key={system.id}>{system.name}</option>)}</select><button type="button" disabled={!bulkSystem} onClick={() => applyToIncluded({ projectSystemId: bulkSystem })}>שיוך למערכת</button><select defaultValue="" onChange={(event) => { if (event.target.value) applyToIncluded({ classification: event.target.value, includeInEquipment: ["equipment", "material"].includes(event.target.value), includeInReferenceHours: ["installation_day", "programming_day"].includes(event.target.value) }); event.target.value = ""; }}><option value="">קביעת סיווג…</option>{[...new Map(lines.map((line) => [line.classification, classificationLabel(line.classification)])).entries()].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><div className="priority-lines mapping">{lines.filter((line) => line.include).map((line) => { const index = lines.findIndex((item) => item.sourceRow === line.sourceRow); return <PriorityLineEditor key={line.sourceRow} line={line} index={index} systems={preview.systems} catalogItems={preview.catalogItems} canCreateCatalogItems={preview.canCreateCatalogItems} onChange={updateLine} />; })}</div></>}
          {step === 4 && <section className="priority-hours"><header><h3>המרת ימי עבודה לשעות ייחוס</h3><p>שעות אלה הן יעד תכנוני בלבד ואינן נרשמות כשעות עבודה שבוצעו.</p></header>{lines.filter((line) => line.include && ["installation_day", "programming_day"].includes(line.classification)).map((line) => <article key={line.sourceRow}><label><input type="checkbox" checked={line.includeInReferenceHours} onChange={(event) => updateLine(lines.indexOf(line), { includeInReferenceHours: event.target.checked })} /></label><div><strong>{line.description}</strong><small>{classificationLabel(line.classification)}</small></div><b>{Number(line.quantity) || 0} ימים × 8 = {(Number(line.quantity) || 0) * 8} שעות</b></article>)}{!hours.installation && !hours.programming && <div className="priority-empty-hours">לא נבחרו שורות של ימי התקנה או תכנות.</div>}<div className="priority-targets"><div><span>שעות התקנה</span><small>קיים: {preview.targets.installation}</small><b>תוספת: +{hours.installation}</b><strong>לאחר הייבוא: {preview.targets.installation + hours.installation}</strong></div><div><span>שעות תכנות</span><small>קיים: {preview.targets.programming}</small><b>תוספת: +{hours.programming}</b><strong>לאחר הייבוא: {preview.targets.programming + hours.programming}</strong></div></div></section>}
          {step === 5 && <section className="priority-final-review"><header><h3>בדיקה אחרונה לפני כתיבה למסד הנתונים</h3><p>רק לחיצה על „אישור וייבוא” תבצע שינויים. הפעולה תתבצע כטרנזקציה אחת.</p></header><div className="priority-review-grid"><div><span>הזמנה</span><strong>{preview.order.priorityOrderNumber}</strong></div><div><span>שורות שזוהו</span><strong>{review.total}</strong></div><div><span>שורות לייבוא</span><strong>{review.selected}</strong></div><div><span>פריטי ציוד</span><strong>{review.equipment}</strong></div><div><span>פריטים חדשים בקטלוג</span><strong>{review.newCatalog}</strong></div><div><span>התאמות קיימות</span><strong>{review.matched}</strong></div><div><span>שורות שירות/תיאור</span><strong>{review.services}</strong></div><div><span>תוספת שעות התקנה</span><strong>{hours.installation}</strong></div><div><span>תוספת שעות תכנות</span><strong>{hours.programming}</strong></div></div>{preview.duplicate?.exists && <p className="priority-final-warning"><AlertTriangle size={17} />ההזמנה הקיימת תעודכן באופן אידמפוטנטי; ציוד ושעות לא יוכפלו.</p>}</section>}
        </>}
        {error && <div className="priority-error" role="alert"><AlertTriangle size={17} />{error}</div>}
      </div>
      <footer className="priority-wizard-actions">{result ? <button className="primary-button" type="button" onClick={onClose}>סיום</button> : <><button type="button" onClick={step === 0 ? onClose : () => { setError(""); setStep((value) => value - 1); }}><ArrowRight size={16} />{step === 0 ? "ביטול" : "הקודם"}</button><span>שלב {step + 1} מתוך {STEPS.length}</span>{step === 0 ? <button className="primary-button" type="button" disabled={busy || !file} onClick={upload}>{busy ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}ניתוח הקובץ</button> : step === STEPS.length - 1 ? <button className="primary-button" type="button" disabled={busy} onClick={submit}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}אישור וייבוא</button> : <button className="primary-button" type="button" onClick={next}>הבא<ArrowLeft size={16} /></button>}</>}</footer>
    </div>
  </AppModal>;
}
