import { AlertCircle, CheckCircle2, PackagePlus } from "lucide-react";
import { priorityClassifications } from "./priorityImport";

export function PriorityLineEditor({ line, index, systems, catalogItems, canCreateCatalogItems, onChange }) {
  const patch = (changes) => onChange(index, changes);
  const changeClassification = (classification) => patch({
    classification,
    include: classification !== "ignore",
    includeInEquipment: ["equipment", "material"].includes(classification),
    includeInReferenceHours: ["installation_day", "programming_day"].includes(classification),
  });
  const status = line.catalogItemId ? "קיים בקטלוג" : line.createCatalogItem ? "פריט חדש" : "ללא התאמה";
  return (
    <article className={`priority-line ${line.include ? "included" : "excluded"}`}>
      <label className="priority-include" data-label="ייבוא"><input type="checkbox" checked={Boolean(line.include)} onChange={(event) => patch({ include: event.target.checked })} /><span>{line.sourceRow}</span></label>
      <label data-label="מק״ט"><input value={line.prioritySku || ""} readOnly title="מק״ט המקור נשמר לצורכי ביקורת" /></label>
      <label className="priority-description" data-label="תיאור"><input value={line.description} onChange={(event) => patch({ description: event.target.value })} /></label>
      <label data-label="כמות"><input type="number" min="0" step="0.001" value={line.quantity} onChange={(event) => patch({ quantity: event.target.value })} /></label>
      <label data-label="יחידה"><input value={line.unit || ""} onChange={(event) => patch({ unit: event.target.value })} /></label>
      <label data-label="סיווג"><select value={line.classification} onChange={(event) => changeClassification(event.target.value)}>{priorityClassifications.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label data-label="פריט קטלוג"><select value={line.catalogItemId || ""} onChange={(event) => patch({ catalogItemId: event.target.value, createCatalogItem: false })}><option value="">ללא התאמה</option>{catalogItems.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.prioritySku || item.code}</option>)}</select></label>
      <label data-label="מערכת יעד"><select value={line.projectSystemId || ""} onChange={(event) => patch({ projectSystemId: event.target.value })}><option value="">בחירת מערכת…</option>{systems.map((system) => <option value={system.id} key={system.id}>{system.name}</option>)}</select></label>
      <div className="priority-line-actions" data-label="פעולה">
        <span className={line.catalogItemId ? "matched" : line.createCatalogItem ? "new" : "unmatched"}>{line.catalogItemId ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}{status}</span>
        {canCreateCatalogItems && !line.catalogItemId && ["equipment", "material"].includes(line.classification) && <label><input type="checkbox" checked={Boolean(line.createCatalogItem)} onChange={(event) => patch({ createCatalogItem: event.target.checked })} /><PackagePlus size={14} />יצירה בקטלוג</label>}
        <label><input type="checkbox" checked={Boolean(line.includeInEquipment)} onChange={(event) => patch({ includeInEquipment: event.target.checked })} />הוספה לציוד</label>
        {["installation_day", "programming_day"].includes(line.classification) && <label><input type="checkbox" checked={Boolean(line.includeInReferenceHours)} onChange={(event) => patch({ includeInReferenceHours: event.target.checked })} />חישוב שעות</label>}
      </div>
      {line.createCatalogItem && <div className="priority-new-catalog"><label>יצרן<input value={line.manufacturer || ""} onChange={(event) => patch({ manufacturer: event.target.value })} /></label><label>דגם<input value={line.model || ""} onChange={(event) => patch({ model: event.target.value })} /></label><small>הפריט ייווצר כרכיב תחת מערכת היעד. המערכת בפרויקט נשארת ניתנת לשינוי גם בייבואים עתידיים.</small></div>}
    </article>
  );
}
