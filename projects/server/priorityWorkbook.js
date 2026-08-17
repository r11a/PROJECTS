import ExcelJS from 'exceljs';
import JSZip from 'jszip';

const ORDER_FIELDS = {
  priorityCustomerNumber: ['מס לקוח', 'מס. לקוח', 'מספר לקוח', 'customer number', 'customer no'],
  customerName: ['שם לקוח', 'customer name'],
  contactName: ['איש קשר', 'contact person', 'contact'],
  priorityOrderNumber: ['הזמנה', 'מס הזמנה', 'מספר הזמנה', 'order number', 'sales order'],
  quotationNumber: ['הצעת מחיר', 'מס הצעת מחיר', 'quotation'],
  orderDescription: ['פרטים', 'תאור פרויקט', 'תיאור פרויקט', 'תיאור הזמנה', 'order description'],
  orderStatus: ['סטטוס', 'מצב הזמנה', 'order status'],
  orderDate: ['תאריך', 'תאריך הזמנה', 'order date'],
  supplyDate: ['ת אספקה', 'ת.אספקה', 'ת. אספקה', 'ת.אספקה/חויב עד תאריך', 'supply date', 'delivery date'],
  grossAmount: ['מחיר כולל', 'סכום לפני הנחה', 'gross amount'],
  discountPercent: ['הנחה כללית (%)', 'הנחה כללית', 'discount percent'],
  netAmount: ['מחיר אחרי הנחה', 'סכום נטו', 'net amount'],
  vatAmount: ['מע"מ', 'מעמ', 'vat'],
  totalAmount: ['מחיר כולל מע"מ', 'סה"כ כולל מע"מ', 'total including vat'],
  purchaseCost: ['עלות קניה', 'עלות רכישה', 'purchase cost'],
  profit: ['רווח בפועל', 'profit'],
};

const LINE_FIELDS = {
  prioritySku: ['מק"ט', 'מקט', 'קוד פריט', 'item code', 'sku'],
  description: ['תאור מוצר', 'תיאור מוצר', 'תאור פריט', 'תיאור פריט', 'description'],
  quantity: ['כמות', 'quantity', 'qty'],
  unit: ["יח'", 'יחידה', 'יחידות', 'unit'],
  unitPrice: ['מחיר ליחידה', "מחיר ליח'", 'unit price'],
  lineTotal: ['סה"כ מחיר', 'סך מחיר', 'line total'],
  cost: ['עלות', 'cost'],
  barcode: ['ברקוד', 'barcode'],
  supplier: ['ספק לרכש', 'ספק', 'supplier'],
  manufacturer: ['יצרן', 'manufacturer'],
  model: ['דגם', 'model'],
  deliveryDate: ['ת אספקה', 'ת. אספקה', 'תאריך אספקה', 'delivery date'],
  remainingQuantity: ['יתרה לאספקה', 'remaining quantity'],
  lineStatus: ['סטטוס', 'מצב שורה', 'line status'],
};

const normalizeHeader = (value) => String(value ?? '')
  .replace(/[\u200e\u200f]/g, '')
  .replace(/[.:'"׳״()\[\]_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('he-IL');

const aliases = (definition) => Object.fromEntries(Object.entries(definition).flatMap(([field, names]) => names.map((name) => [normalizeHeader(name), field])));
const ORDER_ALIASES = aliases(ORDER_FIELDS);
const LINE_ALIASES = aliases(LINE_FIELDS);

function xmlDecode(value = '') {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function columnIndex(reference = 'A1') {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function excelDate(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(number * 86400000));
}

function cellValue(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') return value.text ?? value.result ?? value.richText?.map((part) => part.text).join('') ?? String(value);
  return value;
}

async function readWithExcelJs(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.map((sheet) => {
    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell, index) => { values[index - 1] = cellValue(cell); });
      rows.push(values);
    });
    return { name: sheet.name, rows };
  });
}

async function readPriorityOoxml(buffer) {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared = sharedXml ? [...sharedXml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)]
    .map((match) => [...match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((part) => xmlDecode(part[1])).join('')) : [];
  const sheetNames = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort();
  if (!sheetNames.length) throw Object.assign(new Error('קובץ ה־Excel אינו מכיל גיליון נתונים'), { statusCode: 400 });
  return Promise.all(sheetNames.map(async (name, sheetIndex) => {
    const xml = await zip.file(name).async('string');
    const rows = [];
    for (const rowMatch of xml.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
      const row = [];
      for (const cellMatch of rowMatch[1].matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
        const attributes = cellMatch[1];
        const body = cellMatch[2];
        const reference = attributes.match(/\br=["']([^"']+)/)?.[1] || 'A1';
        const type = attributes.match(/\bt=["']([^"']+)/)?.[1] || '';
        const inline = body.match(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/)?.[1];
        const raw = body.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
        let value = inline !== undefined ? xmlDecode(inline) : raw === undefined ? '' : xmlDecode(raw);
        if (type === 's') value = shared[Number(value)] ?? '';
        else if (type === 'n' || (!type && value !== '')) value = Number.isNaN(Number(value)) ? value : Number(value);
        row[columnIndex(reference)] = value;
      }
      rows.push(row);
    }
    return { name: `Sheet ${sheetIndex + 1}`, rows };
  }));
}

export async function readWorkbookRows(buffer) {
  const archive = await JSZip.loadAsync(buffer, { checkCRC32: false }).catch(() => { throw Object.assign(new Error('הקובץ אינו חבילת XLSX תקינה'), { statusCode: 400 }); });
  const entries = Object.values(archive.files);
  const expandedBytes = entries.reduce((total, entry) => total + Number(entry?._data?.uncompressedSize || 0), 0);
  if (entries.length > 250 || expandedBytes > 80 * 1024 * 1024) throw Object.assign(new Error('מבנה קובץ ה־XLSX גדול או מורכב מהטווח המותר'), { statusCode: 413 });
  try {
    return await readWithExcelJs(buffer);
  } catch (error) {
    // Some Priority exports use namespace-prefixed OOXML and omit optional
    // Office package parts. ExcelJS rejects them although Excel opens them.
    return readPriorityOoxml(buffer).catch(() => { throw Object.assign(new Error(`לא ניתן לקרוא את קובץ ה־Excel: ${error.message}`), { statusCode: 400 }); });
  }
}

function asNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? '').replace(/[₪$€,%\s]/g, '').replace(/,/g, '');
  const number = Number(normalized);
  return normalized !== '' && Number.isFinite(number) ? number : null;
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  if (typeof value === 'number') return excelDate(value)?.toISOString().slice(0, 10) || null;
  const text = String(value).trim();
  const local = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (local) return `${local[3].length === 2 ? `20${local[3]}` : local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function fieldMap(row, dictionary) {
  const mapped = {};
  row.forEach((value, index) => {
    const field = dictionary[normalizeHeader(value)];
    if (field && mapped[field] === undefined) mapped[field] = index;
  });
  return mapped;
}

export function classifyPriorityLine(line) {
  const sku = String(line.prioritySku || '').trim();
  const text = `${line.description || ''} ${line.unit || ''}`.toLocaleLowerCase('he-IL');
  if (sku === '000' || (!sku && !line.description)) return 'description';
  if (/(ימי?\s*(עבודה|התקנה)|installation\s*days?)/i.test(text)) return 'installation_day';
  if (/(ימי?\s*תכנות|תכנות\s*ימים?|programming\s*days?)/i.test(text)) return 'programming_day';
  if (/(שירות|התקנה[, ]|אינטגרציה|הפעלה|service|integration)/i.test(text)) return 'service';
  if (/(כבל|צינור|מחבר|מתאם|תקע|שקע|חוט|סיב|cat\s*[5678]|cable|connector|pipe)/i.test(text) || /(מטר|meter)/i.test(String(line.unit || ''))) return 'material';
  return 'equipment';
}

const SYSTEM_KEYWORDS = {
  cameras: ['מצלמ', 'camera', 'nvr', 'dvr', 'cctv', 'frigate', 'scrypted', 'faceid', 'אינטרקום', 'video'],
  network: ['רשת', 'תקשורת', 'network', 'poe', 'switch', 'מתג', 'ראוטר', 'router', 'wifi', 'access point', 'patch panel', 'ארון תקשורת'],
  alarm: ['אזעק', 'alarm', 'ריסקו', 'risco', 'פרדוקס', 'paradox', 'גלאי', 'צופר', 'קיבורד', 'מגנט', 'עשן'],
  audio: ['אודיו', 'מולטימדיה', 'רמקול', 'מגבר', 'wiim', 'סטרימר', 'streamer', 'speaker', 'amplifier'],
  smart_home: ['בית חכם', 'smart home', 'knx', 'switchbee', 'homeii', 'shelly', 'somfy', 'מודול מיזוג', 'מודול ביטחון', 'טאבלט'],
};

function systemBucket(value) {
  const text = String(value || '').toLocaleLowerCase('he-IL');
  return Object.entries(SYSTEM_KEYWORDS).find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] || '';
}

export function inferPrioritySystem(line, systems = []) {
  if (line.catalogItem?.parent_id || line.catalogItem?.parentId) return Number(line.catalogItem.parent_id || line.catalogItem.parentId);
  const lineText = `${line.prioritySku || ''} ${line.description || ''} ${line.manufacturer || ''} ${line.model || ''}`.toLocaleLowerCase('he-IL');
  const bucket = systemBucket(lineText);
  let best = null;
  for (const system of systems) {
    const name = String(system.name || '').trim();
    if (!name) continue;
    const normalizedName = name.toLocaleLowerCase('he-IL');
    let score = lineText.includes(normalizedName) ? 200 : 0;
    if (bucket && systemBucket(name) === bucket) score += 100;
    if (!best || score > best.score) best = { id:Number(system.id),score };
  }
  return best?.score > 0 ? best.id : null;
}

export function assignPrioritySystems(lines, systems = []) {
  return lines.map((line) => ({ ...line, projectSystemId: inferPrioritySystem(line, systems) }));
}

function headerScore(row) {
  const map = fieldMap(row, LINE_ALIASES);
  return ['prioritySku', 'description', 'quantity'].filter((field) => map[field] !== undefined).length;
}

export async function parsePriorityWorkbook(buffer, sourceFilename = '') {
  const sheets = await readWorkbookRows(buffer);
  let best = null;
  for (const sheet of sheets) {
    sheet.rows.forEach((row, index) => {
      const score = headerScore(row);
      if (!best || score > best.score) best = { sheet, index, score };
    });
  }
  if (!best || best.score < 2) throw Object.assign(new Error('לא נמצאה טבלת פריטים תקינה בקובץ Priority'), { statusCode: 400 });

  const { sheet, index: lineHeaderIndex } = best;
  const orderHeaderIndex = sheet.rows.slice(0, lineHeaderIndex).findIndex((row) => {
    const map = fieldMap(row, ORDER_ALIASES);
    return map.priorityOrderNumber !== undefined && map.priorityCustomerNumber !== undefined;
  });
  const orderHeaders = orderHeaderIndex >= 0 ? sheet.rows[orderHeaderIndex] : [];
  const orderValues = orderHeaderIndex >= 0 ? sheet.rows[orderHeaderIndex + 1] || [] : [];
  const orderColumns = fieldMap(orderHeaders, ORDER_ALIASES);
  const order = {};
  for (const [field, column] of Object.entries(orderColumns)) {
    const candidates = orderHeaders.map((header, index) => ORDER_ALIASES[normalizeHeader(header)] === field ? orderValues[index] : undefined);
    order[field] = candidates.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? orderValues[column] ?? '';
  }
  for (const field of ['grossAmount', 'discountPercent', 'netAmount', 'vatAmount', 'totalAmount', 'purchaseCost', 'profit']) order[field] = asNumber(order[field]);
  for (const field of ['orderDate', 'supplyDate']) order[field] = asDate(order[field]);
  order.priorityOrderNumber = String(order.priorityOrderNumber || '').trim();
  order.priorityCustomerNumber = String(order.priorityCustomerNumber || '').trim();
  if (!order.priorityOrderNumber) throw Object.assign(new Error('לא נמצא מספר הזמנת Priority בקובץ'), { statusCode: 400 });

  const lineHeaders = sheet.rows[lineHeaderIndex];
  const lineColumns = fieldMap(lineHeaders, LINE_ALIASES);
  const lines = [];
  for (let rowIndex = lineHeaderIndex + 1; rowIndex < sheet.rows.length; rowIndex += 1) {
    const row = sheet.rows[rowIndex] || [];
    const raw = {};
    lineHeaders.forEach((header, column) => { if (String(header || '').trim() && row[column] !== undefined && row[column] !== '') raw[String(header)] = row[column]; });
    const line = { sourceRow: rowIndex + 1 };
    for (const [field, column] of Object.entries(lineColumns)) line[field] = row[column] ?? '';
    line.prioritySku = String(line.prioritySku || '').trim();
    line.description = String(line.description || '').trim();
    line.quantity = Math.max(0, Math.round(asNumber(line.quantity) ?? 0));
    if (!line.prioritySku && !line.description && !line.quantity) continue;
    line.unit = String(line.unit || '').trim();
    line.unitPrice = asNumber(line.unitPrice);
    line.lineTotal = asNumber(line.lineTotal);
    line.cost = asNumber(line.cost);
    line.remainingQuantity = asNumber(line.remainingQuantity);
    line.deliveryDate = asDate(line.deliveryDate);
    line.barcode = String(line.barcode || '').trim();
    line.classification = classifyPriorityLine(line);
    line.include = line.classification !== 'ignore';
    line.includeInEquipment = ['equipment', 'material'].includes(line.classification) && line.prioritySku !== '000';
    line.includeInReferenceHours = ['installation_day', 'programming_day'].includes(line.classification);
    line.referenceHours = line.includeInReferenceHours ? line.quantity * 8 : 0;
    line.metadata = { priority: raw, sourceRow: line.sourceRow };
    lines.push(line);
  }
  if (!lines.length) throw Object.assign(new Error('לא נמצאו שורות הזמנה לייבוא'), { statusCode: 400 });
  if (lines.length > 2000) throw Object.assign(new Error('הקובץ מכיל יותר מ־2,000 שורות הזמנה ואינו ניתן לייבוא בטוח'), { statusCode: 413 });

  const headerMetadata = {};
  orderHeaders.forEach((header, column) => { if (String(header || '').trim() && orderValues[column] !== undefined && orderValues[column] !== '') headerMetadata[String(header)] = orderValues[column]; });
  return {
    sourceFilename,
    sheetName: sheet.name,
    order,
    lines,
    metadata: { priority: headerMetadata, lineHeaderRow: lineHeaderIndex + 1, parser: 'projects-priority-xlsx-v1' },
  };
}

export function matchPriorityLines(lines, catalogItems) {
  const bySku = new Map();
  const byCode = new Map();
  for (const item of catalogItems) {
    if (item.priority_sku) bySku.set(String(item.priority_sku).trim().toLocaleLowerCase('en-US'), item);
    if (item.code) byCode.set(String(item.code).trim().toLocaleLowerCase('en-US'), item);
  }
  return lines.map((line) => {
    const key = String(line.prioritySku || '').trim().toLocaleLowerCase('en-US');
    const match = key && key !== '000' ? bySku.get(key) || byCode.get(key) || null : null;
    return { ...line, catalogItem: match, catalogMatch: match ? (String(match.priority_sku || '').trim().toLocaleLowerCase('en-US') === key ? 'priority_sku' : 'code') : 'none' };
  });
}

export const PRIORITY_FINANCE_FIELDS = new Set(['grossAmount', 'discountPercent', 'netAmount', 'vatAmount', 'totalAmount', 'purchaseCost', 'profit', 'unitPrice', 'lineTotal', 'cost']);
