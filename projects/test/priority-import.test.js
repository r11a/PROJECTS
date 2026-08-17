import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assignPrioritySystems, classifyPriorityLine, inferPrioritySystem, matchPriorityLines, parsePriorityWorkbook } from '../server/priorityWorkbook.js';
import { hasCatalogWrite, normalizeEditedLines, publicParsedLine, publicParsedOrder } from '../server/priorityOrders.js';

const fixture = fileURLToPath(new URL('./fixtures/priority-order-sanitized.xlsx', import.meta.url));
const prefixedFixture = fileURLToPath(new URL('./fixtures/priority-order-prefixed-sanitized.xlsx', import.meta.url));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Priority XLSX parser recognizes order headers, financial summary and Hebrew line items', async () => {
  const parsed = await parsePriorityWorkbook(await readFile(fixture), 'priority-order-sanitized.xlsx');
  assert.equal(parsed.order.priorityOrderNumber, 'SO-TEST-001');
  assert.equal(parsed.order.priorityCustomerNumber, '100001');
  assert.equal(parsed.order.customerName, 'לקוח בדיקה');
  assert.equal(parsed.order.orderDescription, 'הזמנה מסוננת לבדיקות');
  assert.equal(parsed.order.totalAmount, 10530);
  assert.equal(parsed.lines.length, 6);
  assert.equal(parsed.lines[1].description, 'ערכת אינטרקום לבדיקה');
});

test('Priority parser accepts namespace-prefixed exports that standard Excel readers reject', async () => {
  const parsed = await parsePriorityWorkbook(await readFile(prefixedFixture), 'priority-order-prefixed-sanitized.xlsx');
  assert.equal(parsed.order.priorityOrderNumber, 'SO-PREFIX-001');
  assert.equal(parsed.order.customerName, 'לקוח בדיקה');
  assert.equal(parsed.lines[1].description, 'ציוד בדיקה בעברית');
});

test('Priority parser classifies 000 safely and detects equipment, material, work days and services', async () => {
  const { lines } = await parsePriorityWorkbook(await readFile(fixture));
  assert.deepEqual(lines.map((line) => line.classification), ['description', 'equipment', 'material', 'installation_day', 'programming_day', 'service']);
  assert.equal(lines[0].includeInEquipment, false);
  assert.equal(lines[0].prioritySku, '000');
  assert.equal(classifyPriorityLine({ prioritySku: '000', description: 'generic' }), 'description');
});

test('catalog learning matches priority_sku first and falls back to code case-insensitively', () => {
  const lines = matchPriorityLines([
    { prioritySku: 'eq-001' }, { prioritySku: 'fallback-2' }, { prioritySku: '000' }, { prioritySku: 'unknown' },
  ], [
    { id: 1, priority_sku: 'EQ-001', code: 'OTHER' },
    { id: 2, priority_sku: '', code: 'FALLBACK-2' },
    { id: 3, priority_sku: '000', code: '000' },
  ]);
  assert.equal(lines[0].catalogItem.id, 1);
  assert.equal(lines[0].catalogMatch, 'priority_sku');
  assert.equal(lines[1].catalogItem.id, 2);
  assert.equal(lines[1].catalogMatch, 'code');
  assert.equal(lines[2].catalogItem, null);
  assert.equal(lines[3].catalogItem, null);
});

test('Priority lines infer their target system from catalog hierarchy and domain keywords', () => {
  const systems=[{id:10,name:'מצלמות'},{id:20,name:'תקשורת ורשת'},{id:30,name:'מערכת אזעקה'},{id:40,name:'אודיו ומולטימדיה'}];
  assert.equal(inferPrioritySystem({description:'מצלמת כיפה IP חיצונית'},systems),10);
  assert.equal(inferPrioritySystem({description:'מתג 24 יציאות POE'},systems),20);
  assert.equal(inferPrioritySystem({description:'גלאי נפח פנימי'},systems),30);
  assert.equal(inferPrioritySystem({catalogItem:{parent_id:40},description:'פריט קיים'},systems),40);
  assert.equal(assignPrioritySystems([{description:'מגבר WIIM'}],systems)[0].projectSystemId,40);
});

test('confirmed row payload supports quantity, description, classification, system and ignore overrides', async () => {
  const parsed = await parsePriorityWorkbook(await readFile(fixture));
  const edits = parsed.lines.map((line) => ({ ...line, catalogItemId: null, projectSystemId: null }));
  Object.assign(edits[1], { quantity: 7, description: 'שם שנערך ידנית', projectSystemId: 42, classification: 'material' });
  Object.assign(edits[5], { classification: 'ignore', include: true });
  const normalized = normalizeEditedLines(parsed.lines, edits);
  assert.equal(normalized[1].quantity, 7);
  assert.equal(normalized[1].description, 'שם שנערך ידנית');
  assert.equal(normalized[1].projectSystemId, 42);
  assert.equal(normalized[1].classification, 'material');
  assert.equal(normalized[5].include, false);
});

test('Priority quantities are normalized to whole units', async () => {
  const parsed=await parsePriorityWorkbook(await readFile(fixture));
  const edits=parsed.lines.map((line)=>({ ...line,quantity:line.sourceRow===parsed.lines[1].sourceRow?7.8:line.quantity }));
  const normalized=normalizeEditedLines(parsed.lines,edits);
  assert.equal(normalized[1].quantity,8);
  assert.equal(Number.isInteger(normalized[1].quantity),true);
});

test('installation and programming day overrides convert quantity to eight-hour reference targets', async () => {
  const parsed = await parsePriorityWorkbook(await readFile(fixture));
  const edits = parsed.lines.map((line) => ({ ...line, includeInReferenceHours: ['installation_day', 'programming_day'].includes(line.classification) }));
  const normalized = normalizeEditedLines(parsed.lines, edits);
  assert.equal(normalized.find((line) => line.classification === 'installation_day').referenceHours, 24);
  assert.equal(normalized.find((line) => line.classification === 'programming_day').referenceHours, 16);
});

test('finance fields are removed server-side for users without finance access', async () => {
  const parsed = await parsePriorityWorkbook(await readFile(fixture));
  const hiddenOrder = publicParsedOrder(parsed.order, false);
  const hiddenLine = publicParsedLine(parsed.lines[1], false);
  for (const key of ['grossAmount', 'netAmount', 'vatAmount', 'totalAmount', 'purchaseCost', 'profit']) assert.equal(key in hiddenOrder, false);
  for (const key of ['unitPrice', 'lineTotal', 'cost']) assert.equal(key in hiddenLine, false);
  assert.equal(publicParsedOrder(parsed.order, true).totalAmount, 10530);
  assert.equal(publicParsedLine(parsed.lines[1], true).lineTotal, 2000);
});

test('catalog creation permission follows generalized write permissions', () => {
  assert.equal(hasCatalogWrite({ role: 'admin' }), true);
  assert.equal(hasCatalogWrite({ role: 'manager' }), true);
  assert.equal(hasCatalogWrite({ role: 'custom', permissions: { catalog: 'write' } }), true);
  assert.equal(hasCatalogWrite({ role: 'supervisor', permissions: { catalog: 'read' } }), false);
});

test('import router persists orders transactionally, learns new SKUs and protects duplicate/re-import behavior', async () => {
  const source = await read('server/priorityOrders.js');
  assert.match(source, /await db\.query\('BEGIN'\)/);
  assert.match(source, /await db\.query\('ROLLBACK'\)/);
  assert.match(source, /await db\.query\('COMMIT'\)/);
  assert.match(source, /PRIORITY_ORDER_EXISTS/);
  assert.match(source, /request\.body\.mode !== 'update'/);
  assert.match(source, /oldInstallationHours/);
  assert.match(source, /installation_hours_target=GREATEST\(0,installation_hours_target-\$1\+\$2\)/);
  assert.match(source, /INSERT INTO equipment_catalog/);
  assert.match(source, /priority_sku/);
  assert.match(source, /DELETE FROM project_equipment WHERE source_priority_order_line_id/);
});

test('schema stores auditable order/line entities and links the existing project BOM', async () => {
  const migration = await read('migrations/033_priority_order_import.sql');
  for (const token of ['CREATE TABLE IF NOT EXISTS priority_orders', 'CREATE TABLE IF NOT EXISTS priority_order_lines', 'original_description', 'imported_description', 'source_priority_order_line_id', 'project_system_id', 'quantity_ordered']) assert.match(migration, new RegExp(token));
  assert.match(migration, /UNIQUE\(project_id, priority_order_number\)/);
  assert.match(migration, /project_equipment_priority_line_idx/);
});

test('critical wizard path is responsive, editable and explicit before import', async () => {
  const [wizard, editor, styles] = await Promise.all([
    read('src/features/priority-import/PriorityImportWizard.jsx'),
    read('src/features/priority-import/PriorityLineEditor.jsx'),
    read('src/features/priority-import/priority-import.css'),
  ]);
  assert.match(wizard, /previewId/);
  assert.match(wizard, /אישור וייבוא/);
  assert.match(wizard, /confirmCustomerMismatch/);
  assert.match(wizard, /setIncluded/);
  assert.match(editor, /description/);
  assert.match(editor, /quantity/);
  assert.match(editor, /classification/);
  assert.match(editor, /projectSystemId/);
  assert.match(editor, /catalogItemId/);
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /priority-line-head\{display:none\}/);
});
