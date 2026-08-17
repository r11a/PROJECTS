import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { matchPriorityLines, parsePriorityWorkbook } from './priorityWorkbook.js';

const MAX_PRIORITY_FILE_SIZE = 15 * 1024 * 1024;
const PREVIEW_TTL = 30 * 60 * 1000;
const CLASSIFICATIONS = new Set(['equipment', 'material', 'installation_day', 'programming_day', 'service', 'description', 'ignore']);
const previews = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, preview] of previews) if (preview.expiresAt <= now) previews.delete(id);
}, 5 * 60 * 1000).unref();

function cleanFilename(value = '') {
  return path.basename(String(value)).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240) || 'priority-order.xlsx';
}

function priorityFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || '').toLocaleLowerCase('en-US');
  const mime = String(file.mimetype || '').toLocaleLowerCase('en-US');
  const validMime = mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/octet-stream' || mime === 'application/zip';
  if (extension !== '.xlsx' || !validMime) return callback(Object.assign(new Error('ניתן להעלות קובץ Excel מסוג XLSX בלבד'), { statusCode: 415 }));
  callback(null, true);
}

export function hasCatalogWrite(user) {
  return user?.role === 'admin' || user?.role === 'manager' || user?.permissions?.catalog === 'write';
}

function publicCatalog(row) {
  return { id: row.id, code: row.code, name: row.name, manufacturer: row.manufacturer, model: row.model, unit: row.unit, parentId: row.parent_id, prioritySku: row.priority_sku || '', color: row.color, icon: row.icon };
}

function publicOrder(row, canViewFinance) {
  const order = {
    id: row.id, projectId: row.project_id, clientId: row.client_id,
    priorityOrderNumber: row.priority_order_number, priorityCustomerNumber: row.priority_customer_number,
    quotationNumber: row.quotation_number, customerName: row.customer_name, contactName: row.contact_name,
    orderStatus: row.order_status, orderDescription: row.order_description, orderDate: row.order_date,
    supplyDate: row.supply_date, sourceFilename: row.source_filename, importedBy: row.imported_by,
    importedByName: row.imported_by_name, createdAt: row.created_at, updatedAt: row.updated_at,
  };
  if (canViewFinance) Object.assign(order, {
    grossAmount: Number(row.gross_amount || 0), discountPercent: Number(row.discount_percent || 0),
    netAmount: Number(row.net_amount || 0), vatAmount: Number(row.vat_amount || 0),
    totalAmount: Number(row.total_amount || 0), purchaseCost: Number(row.purchase_cost || 0), profit: Number(row.profit || 0),
  });
  return order;
}

export function publicParsedOrder(order, canViewFinance) {
  const result = {
    priorityOrderNumber: order.priorityOrderNumber, priorityCustomerNumber: order.priorityCustomerNumber,
    quotationNumber: order.quotationNumber, customerName: order.customerName, contactName: order.contactName,
    orderStatus: order.orderStatus, orderDescription: order.orderDescription, orderDate: order.orderDate, supplyDate: order.supplyDate,
  };
  if (canViewFinance) Object.assign(result, {
    grossAmount: order.grossAmount, discountPercent: order.discountPercent, netAmount: order.netAmount,
    vatAmount: order.vatAmount, totalAmount: order.totalAmount, purchaseCost: order.purchaseCost, profit: order.profit,
  });
  return result;
}

export function publicParsedLine(line, canViewFinance) {
  const result = {
    sourceRow: line.sourceRow, prioritySku: line.prioritySku, description: line.description,
    quantity: line.quantity, unit: line.unit, barcode: line.barcode, supplier: line.supplier || '',
    manufacturer: line.manufacturer || '', model: line.model || '', deliveryDate: line.deliveryDate,
    remainingQuantity: line.remainingQuantity, lineStatus: line.lineStatus || '', classification: line.classification,
    include: line.include, includeInEquipment: line.includeInEquipment,
    includeInReferenceHours: line.includeInReferenceHours, referenceHours: line.referenceHours,
    catalogMatch: line.catalogMatch, catalogItem: line.catalogItem ? publicCatalog(line.catalogItem) : null,
  };
  if (canViewFinance) Object.assign(result, { unitPrice: line.unitPrice, lineTotal: line.lineTotal, cost: line.cost });
  return result;
}

function prunePreviews() {
  const now = Date.now();
  for (const [id, preview] of previews) if (preview.expiresAt <= now) previews.delete(id);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null;
}

export function normalizeEditedLines(parsedLines, edits) {
  const editByRow = new Map((Array.isArray(edits) ? edits : []).map((line) => [Number(line.sourceRow), line]));
  if (editByRow.size !== parsedLines.length) throw Object.assign(new Error('תצוגת הפריטים השתנתה או אינה מלאה; יש לפתוח את הקובץ מחדש'), { statusCode: 400 });
  return parsedLines.map((source, index) => {
    const edit = editByRow.get(Number(source.sourceRow));
    if (!edit) throw Object.assign(new Error(`חסרה שורה ${source.sourceRow} באישור הייבוא`), { statusCode: 400 });
    const classification = String(edit.classification || source.classification);
    if (!CLASSIFICATIONS.has(classification)) throw Object.assign(new Error(`סיווג לא תקין בשורה ${source.sourceRow}`), { statusCode: 400 });
    const quantity = safeNumber(edit.quantity, source.quantity);
    if (quantity < 0 || quantity > 1000000) throw Object.assign(new Error(`כמות לא תקינה בשורה ${source.sourceRow}`), { statusCode: 400 });
    const include = Boolean(edit.include) && classification !== 'ignore';
    const includeInReferenceHours = include && Boolean(edit.includeInReferenceHours) && ['installation_day', 'programming_day'].includes(classification);
    return {
      ...source,
      originalDescription: source.description,
      sortOrder: index,
      description: String(edit.description ?? source.description).trim().slice(0, 2000),
      quantity,
      unit: String(edit.unit ?? source.unit).trim().slice(0, 80),
      classification,
      include,
      includeInEquipment: include && Boolean(edit.includeInEquipment),
      includeInReferenceHours,
      referenceHours: includeInReferenceHours ? quantity * 8 : 0,
      catalogItemId: edit.catalogItemId ? Number(edit.catalogItemId) : null,
      projectSystemId: edit.projectSystemId ? Number(edit.projectSystemId) : null,
      createCatalogItem: Boolean(edit.createCatalogItem),
      manufacturer: String(edit.manufacturer ?? source.manufacturer ?? '').trim().slice(0, 240),
      model: String(edit.model ?? source.model ?? '').trim().slice(0, 240),
    };
  });
}

async function validateCatalogReferences(db, lines) {
  const catalogIds = [...new Set(lines.map((line) => line.catalogItemId).filter(Boolean))];
  const systemIds = [...new Set(lines.map((line) => line.projectSystemId).filter(Boolean))];
  const catalog = catalogIds.length ? await db.query("SELECT * FROM equipment_catalog WHERE id=ANY($1::bigint[]) AND item_type='component' AND active=TRUE", [catalogIds]) : { rows: [] };
  const systems = systemIds.length ? await db.query("SELECT * FROM equipment_catalog WHERE id=ANY($1::bigint[]) AND item_type='system' AND active=TRUE", [systemIds]) : { rows: [] };
  const catalogById = new Map(catalog.rows.map((row) => [Number(row.id), row]));
  const systemsById = new Map(systems.rows.map((row) => [Number(row.id), row]));
  for (const line of lines) {
    if (line.catalogItemId && !catalogById.has(line.catalogItemId)) throw Object.assign(new Error(`פריט הקטלוג שנבחר בשורה ${line.sourceRow} אינו זמין`), { statusCode: 400 });
    if (line.projectSystemId && !systemsById.has(line.projectSystemId)) throw Object.assign(new Error(`המערכת שנבחרה בשורה ${line.sourceRow} אינה זמינה`), { statusCode: 400 });
  }
  return { catalogById, systemsById };
}

export function createPriorityOrdersRouter({ pool, authenticate, requireRoles, audit }) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), fileFilter: priorityFileFilter, limits: { fileSize: MAX_PRIORITY_FILE_SIZE, files: 1, fields: 10 } });
  router.use(authenticate);

  router.post('/projects/:projectId/priority-orders/preview', requireRoles('admin', 'manager'), upload.single('file'), async (request, response) => {
    if (!request.file) return response.status(400).json({ error: 'יש לבחור קובץ XLSX של הזמנת Priority' });
    if (request.file.buffer.length < 4 || request.file.buffer[0] !== 0x50 || request.file.buffer[1] !== 0x4b) return response.status(415).json({ error: 'הקובץ אינו קובץ XLSX תקין' });
    const projectResult = await pool.query(`SELECT p.id,p.name,p.client_id,p.installation_hours_target,p.programming_hours_target,c.name client_name,c.priority_customer_number
      FROM projects p LEFT JOIN clients c ON c.id=p.client_id WHERE p.id=$1`, [request.params.projectId]);
    if (!projectResult.rowCount) return response.status(404).json({ error: 'הפרויקט לא נמצא' });
    const parsed = await parsePriorityWorkbook(request.file.buffer, cleanFilename(request.file.originalname));
    const [catalog, systems, duplicate] = await Promise.all([
      pool.query("SELECT * FROM equipment_catalog WHERE item_type='component' AND active=TRUE ORDER BY name"),
      pool.query("SELECT * FROM equipment_catalog WHERE item_type='system' AND active=TRUE ORDER BY name"),
      pool.query('SELECT id,priority_order_number,created_at FROM priority_orders WHERE project_id=$1 AND lower(priority_order_number)=lower($2)', [request.params.projectId, parsed.order.priorityOrderNumber]),
    ]);
    parsed.lines = matchPriorityLines(parsed.lines, catalog.rows);
    const project = projectResult.rows[0];
    const savedCustomerNumber = String(project.priority_customer_number || '').trim();
    const importedCustomerNumber = String(parsed.order.priorityCustomerNumber || '').trim();
    const customerMismatch = Boolean(savedCustomerNumber && importedCustomerNumber && savedCustomerNumber.toLocaleLowerCase('en-US') !== importedCustomerNumber.toLocaleLowerCase('en-US'));
    const previewId = randomUUID();
    prunePreviews();
    previews.set(previewId, { userId: String(request.user.id), projectId: String(request.params.projectId), parsed, expiresAt: Date.now() + PREVIEW_TTL });
    const canViewFinance = request.user.financeAccess !== false;
    response.json({
      previewId, expiresAt: new Date(Date.now() + PREVIEW_TTL).toISOString(), fileName: parsed.sourceFilename,
      project: { id: project.id, name: project.name, clientName: project.client_name || '', priorityCustomerNumber: savedCustomerNumber },
      order: publicParsedOrder(parsed.order, canViewFinance),
      lines: parsed.lines.map((line) => publicParsedLine(line, canViewFinance)),
      systems: systems.rows.map(publicCatalog), catalogItems: catalog.rows.map(publicCatalog),
      customerMismatch, duplicate: duplicate.rowCount ? { exists: true, orderId: duplicate.rows[0].id, createdAt: duplicate.rows[0].created_at } : { exists: false },
      targets: { installation: Number(project.installation_hours_target || 0), programming: Number(project.programming_hours_target || 0) }, canCreateCatalogItems: hasCatalogWrite(request.user),
    });
  });

  router.post('/projects/:projectId/priority-orders/import', requireRoles('admin', 'manager'), async (request, response) => {
    prunePreviews();
    const preview = previews.get(String(request.body.previewId || ''));
    if (!preview || preview.userId !== String(request.user.id) || preview.projectId !== String(request.params.projectId)) return response.status(410).json({ error: 'תצוגת הייבוא פגה; יש להעלות את הקובץ מחדש' });
    const lines = normalizeEditedLines(preview.parsed.lines, request.body.lines);
    if (lines.some((line) => line.createCatalogItem) && !hasCatalogWrite(request.user)) return response.status(403).json({ error: 'אין הרשאה ליצור פריטי קטלוג חדשים' });
    const selected = lines.filter((line) => line.include);
    if (!selected.length) return response.status(400).json({ error: 'יש לבחור לפחות שורה אחת לייבוא' });
    const order = preview.parsed.order;
    const db = await pool.connect();
    let resultSummary;
    try {
      await db.query('BEGIN');
      const projectResult = await db.query(`SELECT p.*,c.priority_customer_number FROM projects p LEFT JOIN clients c ON c.id=p.client_id WHERE p.id=$1 FOR UPDATE OF p`, [request.params.projectId]);
      if (!projectResult.rowCount) throw Object.assign(new Error('הפרויקט לא נמצא'), { statusCode: 404 });
      const project = projectResult.rows[0];
      const savedCustomerNumber = String(project.priority_customer_number || '').trim();
      const importedCustomerNumber = String(order.priorityCustomerNumber || '').trim();
      if (savedCustomerNumber && importedCustomerNumber && savedCustomerNumber.toLocaleLowerCase('en-US') !== importedCustomerNumber.toLocaleLowerCase('en-US') && request.body.confirmCustomerMismatch !== true) {
        throw Object.assign(new Error('מספר לקוח Priority אינו תואם ללקוח הפרויקט; נדרש אישור מפורש'), { statusCode: 409, code: 'PRIORITY_CUSTOMER_MISMATCH' });
      }
      await validateCatalogReferences(db, lines);
      const existing = await db.query('SELECT * FROM priority_orders WHERE project_id=$1 AND lower(priority_order_number)=lower($2) FOR UPDATE', [request.params.projectId, order.priorityOrderNumber]);
      if (existing.rowCount && request.body.mode !== 'update') throw Object.assign(new Error('הזמנה זו כבר קיימת בפרויקט'), { statusCode: 409, code: 'PRIORITY_ORDER_EXISTS', orderId: existing.rows[0].id });
      let oldInstallationHours = 0;
      let oldProgrammingHours = 0;
      let orderId;
      if (existing.rowCount) {
        orderId = existing.rows[0].id;
        const oldHours = await db.query(`SELECT
          COALESCE(SUM(reference_hours) FILTER (WHERE classification='installation_day' AND include_in_project),0) installation,
          COALESCE(SUM(reference_hours) FILTER (WHERE classification='programming_day' AND include_in_project),0) programming
          FROM priority_order_lines WHERE priority_order_id=$1`, [orderId]);
        oldInstallationHours = Number(oldHours.rows[0].installation || 0);
        oldProgrammingHours = Number(oldHours.rows[0].programming || 0);
        await db.query('DELETE FROM project_equipment WHERE source_priority_order_line_id IN (SELECT id FROM priority_order_lines WHERE priority_order_id=$1)', [orderId]);
        await db.query('DELETE FROM priority_order_lines WHERE priority_order_id=$1', [orderId]);
        await db.query(`UPDATE priority_orders SET client_id=$1,priority_customer_number=$2,quotation_number=$3,customer_name=$4,contact_name=$5,
          order_status=$6,order_description=$7,order_date=$8,supply_date=$9,gross_amount=$10,discount_percent=$11,net_amount=$12,vat_amount=$13,
          total_amount=$14,purchase_cost=$15,profit=$16,source_filename=$17,raw_metadata=$18,imported_by=$19,updated_at=NOW() WHERE id=$20`,
        [project.client_id, order.priorityCustomerNumber, order.quotationNumber, order.customerName, order.contactName, order.orderStatus, order.orderDescription,
          safeDate(order.orderDate), safeDate(order.supplyDate), order.grossAmount, order.discountPercent, order.netAmount, order.vatAmount, order.totalAmount,
          order.purchaseCost, order.profit, preview.parsed.sourceFilename, JSON.stringify(preview.parsed.metadata), request.user.id, orderId]);
      } else {
        const inserted = await db.query(`INSERT INTO priority_orders(project_id,client_id,priority_order_number,priority_customer_number,quotation_number,customer_name,
          contact_name,order_status,order_description,order_date,supply_date,gross_amount,discount_percent,net_amount,vat_amount,total_amount,purchase_cost,profit,
          source_filename,raw_metadata,imported_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
        [request.params.projectId, project.client_id, order.priorityOrderNumber, order.priorityCustomerNumber, order.quotationNumber, order.customerName, order.contactName,
          order.orderStatus, order.orderDescription, safeDate(order.orderDate), safeDate(order.supplyDate), order.grossAmount, order.discountPercent, order.netAmount,
          order.vatAmount, order.totalAmount, order.purchaseCost, order.profit, preview.parsed.sourceFilename, JSON.stringify(preview.parsed.metadata), request.user.id]);
        orderId = inserted.rows[0].id;
      }

      let createdCatalogItems = 0;
      let existingMatches = 0;
      let equipmentAdded = 0;
      for (const line of lines) {
        let catalogItemId = line.catalogItemId;
        if (line.include && line.createCatalogItem && !catalogItemId) {
          if (!line.projectSystemId) throw Object.assign(new Error(`יש לבחור מערכת יעד עבור הפריט החדש בשורה ${line.sourceRow}`), { statusCode: 400 });
          const existingMatch = line.prioritySku && line.prioritySku !== '000' ? await db.query(`SELECT id FROM equipment_catalog WHERE active=TRUE AND item_type='component'
            AND (lower(priority_sku)=lower($1) OR (priority_sku='' AND lower(code)=lower($1))) ORDER BY (priority_sku<>'') DESC LIMIT 1`, [line.prioritySku]) : { rows: [] };
          if (existingMatch.rows.length) {
            catalogItemId = existingMatch.rows[0].id;
            existingMatches += 1;
          } else {
            const sameName = await db.query("SELECT id FROM equipment_catalog WHERE item_type='component' AND parent_id=$1 AND lower(name)=lower($2) LIMIT 1", [line.projectSystemId, line.description || line.prioritySku]);
            if (sameName.rowCount) {
              catalogItemId = sameName.rows[0].id;
              await db.query("UPDATE equipment_catalog SET priority_sku=CASE WHEN priority_sku='' THEN $1 ELSE priority_sku END,updated_at=NOW() WHERE id=$2", [line.prioritySku === '000' ? '' : line.prioritySku, catalogItemId]);
              existingMatches += 1;
            } else {
              const created = await db.query(`INSERT INTO equipment_catalog(item_type,parent_id,code,name,manufacturer,model,unit,description,color,icon,priority_sku,metadata)
                VALUES('component',$1,$2,$3,$4,$5,$6,$7,(SELECT color FROM equipment_catalog WHERE id=$1),(SELECT icon FROM equipment_catalog WHERE id=$1),$8,$9) RETURNING id`,
              [line.projectSystemId, line.prioritySku, line.description || line.prioritySku, line.manufacturer, line.model, line.unit || 'יחידה', line.description, line.prioritySku === '000' ? '' : line.prioritySku, JSON.stringify({ priority: line.metadata?.priority || {} })]);
              catalogItemId = created.rows[0].id;
              createdCatalogItems += 1;
            }
          }
        } else if (catalogItemId) existingMatches += 1;
        if (line.includeInEquipment && !catalogItemId) throw Object.assign(new Error(`יש לבחור או ליצור פריט קטלוג בשורה ${line.sourceRow}`), { statusCode: 400 });
        if (line.includeInEquipment && !line.projectSystemId) throw Object.assign(new Error(`יש לבחור מערכת יעד בשורה ${line.sourceRow}`), { statusCode: 400 });
        const insertedLine = await db.query(`INSERT INTO priority_order_lines(priority_order_id,priority_sku,original_description,imported_description,quantity,unit,
          unit_price,line_total,cost,barcode,line_status,classification,catalog_item_id,project_system_id,include_in_project,include_in_equipment,
          include_in_reference_hours,reference_hours,metadata,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
        [orderId, line.prioritySku, line.originalDescription || line.description, line.description, line.quantity, line.unit, line.unitPrice, line.lineTotal, line.cost,
          line.barcode, line.lineStatus || '', line.classification, catalogItemId, line.projectSystemId, line.include, line.includeInEquipment,
          line.includeInReferenceHours, line.referenceHours, JSON.stringify(line.metadata || {}), line.sortOrder]);
        if (line.include && line.includeInEquipment && catalogItemId) {
          await db.query(`INSERT INTO project_equipment(project_id,catalog_item_id,project_system_id,source_priority_order_line_id,quantity,quantity_ordered,source_unit,status,notes)
            VALUES($1,$2,$3,$4,$5,$5,$6,'planned',$7)`, [request.params.projectId, catalogItemId, line.projectSystemId, insertedLine.rows[0].id, line.quantity, line.unit, `הזמנת Priority ${order.priorityOrderNumber}`]);
          equipmentAdded += 1;
        }
      }
      const installationHours = lines.filter((line) => line.include && line.classification === 'installation_day').reduce((total, line) => total + line.referenceHours, 0);
      const programmingHours = lines.filter((line) => line.include && line.classification === 'programming_day').reduce((total, line) => total + line.referenceHours, 0);
      const targets = await db.query(`UPDATE projects SET
        installation_hours_target=GREATEST(0,installation_hours_target-$1+$2),
        programming_hours_target=GREATEST(0,programming_hours_target-$3+$4),updated_at=NOW()
        WHERE id=$5 RETURNING installation_hours_target,programming_hours_target`, [oldInstallationHours, installationHours, oldProgrammingHours, programmingHours, request.params.projectId]);
      await db.query("SELECT pg_notify('projects_live_change',$1)", [JSON.stringify({ entity: 'priority_order', projectId: request.params.projectId, orderId })]);
      await db.query('COMMIT');
      resultSummary = { orderId, orderNumber: order.priorityOrderNumber, totalRows: lines.length, selectedRows: selected.length, equipmentAdded, createdCatalogItems, existingMatches, installationHoursAdded: installationHours - oldInstallationHours, programmingHoursAdded: programmingHours - oldProgrammingHours, installationHoursTarget: Number(targets.rows[0].installation_hours_target), programmingHoursTarget: Number(targets.rows[0].programming_hours_target), updated: Boolean(existing.rowCount) };
    } catch (error) {
      await db.query('ROLLBACK');
      if (error.statusCode) return response.status(error.statusCode).json({ error: error.message, code: error.code, orderId: error.orderId });
      throw error;
    } finally {
      db.release();
    }
    previews.delete(String(request.body.previewId));
    await audit(request, resultSummary.updated ? 'reimport' : 'import', 'priority_order', String(resultSummary.orderId), { projectId: request.params.projectId, fileName: preview.parsed.sourceFilename, ...resultSummary });
    response.status(resultSummary.updated ? 200 : 201).json({ import: resultSummary });
  });

  router.get('/projects/:projectId/priority-orders', async (request, response) => {
    const result = await pool.query(`SELECT o.*,u.display_name imported_by_name,
      COUNT(l.id)::int line_count,COUNT(l.id) FILTER (WHERE l.include_in_project)::int selected_count
      FROM priority_orders o LEFT JOIN users u ON u.id=o.imported_by LEFT JOIN priority_order_lines l ON l.priority_order_id=o.id
      WHERE o.project_id=$1 GROUP BY o.id,u.display_name ORDER BY o.created_at DESC`, [request.params.projectId]);
    response.json({ orders: result.rows.map((row) => ({ ...publicOrder(row, request.user.financeAccess !== false), lineCount: Number(row.line_count), selectedCount: Number(row.selected_count) })) });
  });

  router.get('/projects/:projectId/priority-orders/:orderId', async (request, response) => {
    const orderResult = await pool.query(`SELECT o.*,u.display_name imported_by_name FROM priority_orders o LEFT JOIN users u ON u.id=o.imported_by WHERE o.id=$1 AND o.project_id=$2`, [request.params.orderId, request.params.projectId]);
    if (!orderResult.rowCount) return response.status(404).json({ error: 'הזמנת Priority לא נמצאה' });
    const lines = await pool.query(`SELECT l.*,c.name catalog_item_name,s.name project_system_name FROM priority_order_lines l
      LEFT JOIN equipment_catalog c ON c.id=l.catalog_item_id LEFT JOIN equipment_catalog s ON s.id=l.project_system_id WHERE l.priority_order_id=$1 ORDER BY l.sort_order`, [request.params.orderId]);
    const canViewFinance = request.user.financeAccess !== false;
    response.json({
      order: publicOrder(orderResult.rows[0], canViewFinance),
      lines: lines.rows.map((row) => {
        const line = { id: row.id, prioritySku: row.priority_sku, originalDescription: row.original_description, description: row.imported_description,
          quantity: Number(row.quantity), unit: row.unit, barcode: row.barcode, lineStatus: row.line_status, classification: row.classification,
          catalogItemId: row.catalog_item_id, catalogItemName: row.catalog_item_name, projectSystemId: row.project_system_id,
          projectSystemName: row.project_system_name, include: row.include_in_project, includeInEquipment: row.include_in_equipment,
          includeInReferenceHours: row.include_in_reference_hours, referenceHours: Number(row.reference_hours) };
        if (canViewFinance) Object.assign(line, { unitPrice: Number(row.unit_price || 0), lineTotal: Number(row.line_total || 0), cost: Number(row.cost || 0) });
        return line;
      }),
    });
  });

  return router;
}

export const __priorityPreviewStore = previews;
