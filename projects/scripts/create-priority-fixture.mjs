import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const target = new URL('../test/fixtures/priority-order-sanitized.xlsx', import.meta.url);
const prefixedTarget = new URL('../test/fixtures/priority-order-prefixed-sanitized.xlsx', import.meta.url);
await mkdir(new URL('../test/fixtures/', import.meta.url), { recursive: true });
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('DataSheet');
sheet.addRow(['מס. לקוח', 'שם לקוח', 'איש קשר', 'תאריך', 'הזמנה', 'סטטוס', 'הצעת מחיר', 'פרטים', 'מחיר כולל', 'הנחה כללית (%)', 'מחיר אחרי הנחה', 'מע"מ', 'מחיר כולל מע"מ', 'עלות קניה', 'רווח בפועל']);
sheet.addRow(['100001', 'לקוח בדיקה', 'ישראל ישראלי', new Date('2026-08-01T00:00:00Z'), 'SO-TEST-001', 'מאושרת לביצוע', 'PQ-TEST-001', 'הזמנה מסוננת לבדיקות', 10000, 10, 9000, 1530, 10530, 5000, 4000]);
sheet.addRow(['מק"ט', 'תאור מוצר', 'כמות', "יח'", 'מחיר ליחידה', 'עלות', 'סה"כ מחיר', 'ברקוד', 'ת. אספקה', 'יתרה לאספקה', 'סטטוס']);
sheet.addRow(['000', 'כותרת כללית לפרויקט', 1, "יח'", 0, 0, 0, '', '', 0, '']);
sheet.addRow(['EQ-001', 'ערכת אינטרקום לבדיקה', 2, "יח'", 1000, 600, 2000, '729000000001', '15/08/2026', 2, 'פתוחה']);
sheet.addRow(['MAT-CAT6', 'כבל תקשורת CAT 6', 100, 'מטר', 6, 2, 600, '', '15/08/2026', 100, 'פתוחה']);
sheet.addRow(['LAB-INSTALL', 'ימי עבודה התקנה', 3, 'יום', 800, 0, 2400, '', '', 3, 'פתוחה']);
sheet.addRow(['LAB-PROGRAM', 'ימי תכנות', 2, 'יום', 900, 0, 1800, '', '', 2, 'פתוחה']);
sheet.addRow(['SERVICE-01', 'שירות התקנה, הפעלה ואינטגרציה', 1, "יח'", 1200, 0, 1200, '', '', 1, 'פתוחה']);
await workbook.xlsx.writeFile(fileURLToPath(target));

const prefixRows = [
  ['מס. לקוח', 'שם לקוח', 'איש קשר', 'תאריך', 'הזמנה', 'סטטוס', 'הצעת מחיר', 'פרטים', 'מחיר כולל מע"מ'],
  ['100001', 'לקוח בדיקה', 'ישראל ישראלי', 46235, 'SO-PREFIX-001', 'מאושרת לביצוע', 'PQ-PREFIX-001', 'מבנה Priority עם namespace', 1170],
  ['מק"ט', 'תאור מוצר', 'כמות', "יח'", 'מחיר ליחידה', 'עלות', 'סה"כ מחיר'],
  ['000', 'כותרת כללית', 1, "יח'", 0, 0, 0],
  ['EQ-PREFIX', 'ציוד בדיקה בעברית', 1, "יח'", 1000, 600, 1000],
];
const escapeXml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const columnName = (index) => { let value = index + 1; let name = ''; while (value) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); } return name; };
const sheetRows = prefixRows.map((row, rowIndex) => `<x:row r="${rowIndex + 1}">${row.map((value, columnIndex) => typeof value === 'number'
  ? `<x:c r="${columnName(columnIndex)}${rowIndex + 1}" t="n"><x:v>${value}</x:v></x:c>`
  : `<x:c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><x:is><x:t>${escapeXml(value)}</x:t></x:is></x:c>`).join('')}</x:row>`).join('');
const zip = new JSZip();
zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="utf-8"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets><x:sheet name="DataSheet" sheetId="1" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></x:sheets></x:workbook>');
zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="utf-8"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>${sheetRows}</x:sheetData></x:worksheet>`);
await writeFile(fileURLToPath(prefixedTarget), await zip.generateAsync({ type:'nodebuffer', compression:'DEFLATE' }));
