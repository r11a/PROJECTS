import JSZip from 'jszip';
import { readWorkbookRows } from './priorityWorkbook.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const fields={id:'מזהה קבוע',name:'שם רכיב / עבודה',category:'מערכת / קטגוריה',type:'סוג ציוד',floor:'קומה',location:'מיקום',status:'מצב',notes:'הערות',quantity:'כמות',manufacturer:'יצרן',model:'דגם',hours:'שעות מתוכננות',due:'תאריך יעד'};
const aliases={id:['מזהה','מזהה קבוע','שם מצלמה','מספר מצלמה','תג','tag','id','קוד רכיב','מספר משימה'],name:['שם','תיאור','תאור','תיאור רכיב','תיאור עבודה','משימה','עבודה','description','name','task'],type:['סוג','סוג מצלמה','סוג ציוד','type'],location:['מיקום','מיקום/שם מצלמה','חדר','location'],status:['מצב','סטטוס','status'],notes:['הערות','הערה','notes','remarks'],quantity:['כמות','qty','quantity'],manufacturer:['יצרן','manufacturer'],model:['דגם','model'],hours:['שעות','שעות מתוכננות','משך שעות','hours'],due:['תאריך יעד','מועד ביצוע','תאריך סיום','due date','due']};
aliases.category=['מערכת','קטגוריה','system','category'];
aliases.floor=['קומה','מפלס','floor','level'];
aliases.id.push('מק"ט','מק״ט','מקט','sku','item code','קוד');
export const clean=value=>String(value??'').normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202e]/g,'').replace(/\s+/g,' ').trim();
export const identity=value=>clean(value).toLowerCase();
const fail=message=>{throw Object.assign(new Error(message),{statusCode:400});};
const decode=s=>s.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const attr=(s,k)=>s.match(new RegExp(`(?:[\\w-]+:)?${k}="([^"]*)"`))?.[1];

export function parseCsv(text) {
  text=text.replace(/^\uFEFF/,'');
  const counts={'\t':0,';':0,',':0};let inQuotes=false;
  for(const c of text.slice(0,10000)){if(c==='"')inQuotes=!inQuotes;else if(!inQuotes&&Object.hasOwn(counts,c))counts[c]++;}
  const separator=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===separator&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;if(rows.length>5000||row.length>60)fail('הטבלה גדולה מדי: עד 5,000 שורות ו־60 עמודות');}
  if(quoted)fail('קובץ CSV מכיל שדה מצוטט שלא נסגר');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}

export async function parseOds(buffer) {
  const zip=await JSZip.loadAsync(buffer);
  if(Object.values(zip.files).reduce((n,e)=>n+Number(e._data?.uncompressedSize||0),0)>40*1024*1024)fail('קובץ ODS גדול מדי לאחר פתיחה');
  const xml=await zip.file('content.xml')?.async('string');if(!xml)fail('לא נמצא תוכן גיליון ODS');
  const tables=[];
  for(const match of xml.matchAll(/<table:table\b([^>]*)>([\s\S]*?)<\/table:table>/g)) {
    const rows=[],spans=new Map();let ri=0;
    for(const row of match[2].matchAll(/<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g)) {
      const cells=[];let ci=0;
      for(const c of (row[2]||'').matchAll(/<table:(table-cell|covered-table-cell)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:\1>)/g)) {
        const value=decode([...(c[3]||'').matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g)].map(p=>p[1].replace(/<[^>]*>/g,'')).join(' '));
        const repeats=Number(attr(c[2],'number-columns-repeated')||1),span=Number(attr(c[2],'number-rows-spanned')||1);
        if((value&&repeats>60)||span>5000)fail('תאים חוזרים או מאוחדים חורגים מגודל הטבלה');
        for(let n=0;n<Math.min(repeats,61);n++,ci++){cells[ci]=value||spans.get(`${ri}:${ci}`)||'';if(span>1)for(let j=1;j<span;j++)spans.set(`${ri+j}:${ci}`,value);}
      }
      const repeats=Number(attr(row[1],'number-rows-repeated')||1);
      if(cells.some(Boolean)&&repeats>5000)fail('יותר מדי שורות חוזרות');
      if(cells.some(Boolean)||repeats<100)for(let n=0;n<Math.min(repeats,5001);n++){rows.push(cells.slice(0,60));ri++;if(ri>5000)fail('עד 5,000 שורות לגיליון');}
    }
    tables.push({name:decode(attr(match[1],'name')||`גיליון ${tables.length+1}`),rows});
  }
  return tables;
}

export function suggestMapping(rows,headerRow) {
  const map=row=>Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,row.findIndex(c=>names.includes(identity(c))) ]).filter(([,index])=>index>=0));
  let selected=headerRow,best=-1;
  if(selected===undefined)for(let i=0;i<Math.min(rows.length,35);i++){const m=map(rows[i]);const score=Object.keys(m).length+(m.id!==undefined?2:0);if(score>best){best=score;selected=i;}}
  selected=selected??0;return {headerRow:selected,mapping:map(rows[selected]||[])};
}

export async function parseTableFile(buffer,filename) {
  const ext=path.extname(filename).toLowerCase();let tables,warnings=[];
  if(ext==='.xlsx')tables=await readWorkbookRows(buffer);
  else if(ext==='.ods')tables=await parseOds(buffer);
  else if(ext==='.csv')tables=[{name:'CSV',rows:parseCsv(buffer.toString('utf8'))}];
  else if(ext==='.pdf') {
    const dir=await mkdtemp(path.join(tmpdir(),'projects-table-'));
    try {const source=path.join(dir,'source.pdf');await writeFile(source,buffer);const {stdout}=await promisify(execFile)('pdftotext',['-layout','-enc','UTF-8',source,'-'],{timeout:20000,maxBuffer:8*1024*1024});tables=stdout.split('\f').filter(p=>p.trim()).map((page,i)=>({name:`עמוד ${i+1}`,rows:page.split(/\r?\n/).filter(r=>r.trim()).map(r=>r.trim().split(/\s{2,}|\t/))}));}
    catch(error){fail(error.code==='ENOENT'?'פענוח PDF אינו מותקן בשרת':'לא ניתן לחלץ טבלה מה־PDF. קובץ סרוק דורש OCR; מומלץ להעלות XLSX.');}
    finally{await rm(dir,{recursive:true,force:true});}
    warnings.push('PDF עשוי לפצל שורות ועמודות בין עמודים ולשנות כיווניות. בדקו מזהים וסימני מינוס מול המקור; גיליון ללא מזהה קבוע לא ייובא. עדיף XLSX או ODS.');
  } else fail('סוג הקובץ אינו נתמך. יש לבחור XLSX, ODS, CSV או PDF');
  if(!tables.length||tables.length>30)fail('לא נמצאה טבלה או שיש יותר מ־30 גיליונות');
  let total=0;
  tables=tables.map((t,index)=>{
    total+=t.rows.length;if(total>5000||t.rows.some(r=>r.length>60))fail('עד 5,000 שורות ו־60 עמודות לקובץ');
    const rows=t.rows.map(r=>r.map(c=>c instanceof Date?c.toISOString().slice(0,10):clean(c).slice(0,4000)));
    const suggested=suggestMapping(rows);return {index,name:t.name,rows,...suggested,enabled:suggested.mapping.id!==undefined,kind:suggested.mapping.hours!==undefined||rows[suggested.headerRow]?.some(c=>/משימה|task/i.test(c))?'task':'equipment'};
  });return {tables,warnings};
}

export function mapTableRows(parsed,configs) {
  const output=[],seen=new Set();
  for(const table of parsed.tables){const config=configs.find(c=>Number(c.index)===table.index);if(!config?.enabled)continue;
    const start=Number(config.headerRow);if(!Number.isInteger(start)||start<0||start>=table.rows.length)fail('שורת כותרת לא תקינה');
    const mapping=config.mapping||{};
    if(!Number.isInteger(mapping.id)||mapping.id<0)fail(`חסרה עמודת מזהה קבוע: ${table.name}`);
    const cols=Object.values(mapping).filter(v=>Number.isInteger(v)&&v>=0);if(new Set(cols).size!==cols.length)fail('אותה עמודה מופתה ליותר משדה אחד');
    for(let r=start+1;r<table.rows.length;r++) {
      const raw=table.rows[r],id=clean(raw[mapping.id]);
      if(/^(?:סה.?כ|סיכום|total|subtotal)/i.test(id))break;
      if(!id)continue;
      if(identity(id)===identity(table.rows[start][mapping.id]))continue;
      const values=Object.fromEntries(Object.entries(mapping).filter(([k,v])=>fields[k]&&Number.isInteger(v)&&v>=0).map(([k,v])=>[k,clean(raw[v])]));
      const key=identity(id);let error=seen.has(key)?'מזהה מופיע יותר מפעם אחת בקובץ':'';seen.add(key);
      if(/^(.+?)(\d+)\s*[-–]\s*\1(\d+)$/.test(id))error='המזהה מכיל טווח. יש לתקן בקובץ למזהה של רכיב יחיד; הטווח לא יורחב אוטומטית';
      const number=(value,fallback)=>value===''||value===undefined?fallback:Number(value.replace(/,/g,''));
      const quantity=number(values.quantity,1),hours=number(values.hours,null);
      if(!Number.isFinite(quantity)||quantity<0||quantity>100000||(hours!==null&&(!Number.isFinite(hours)||hours<0||hours>10000)))error='כמות או שעות אינן מספר תקין';
      const rawStatus=identity(values.status);const cancelled=/בוטל|מבוטל|cancel/.test(rawStatus);
      let status=/^(מותקן|מותקנות|הותקן|installed|הושלם|בוצע|done|completed)$/.test(rawStatus)?'installed':/בביצוע|בתהליך|in.progress/.test(rawStatus)?'in_progress':'waiting';
      const known=!rawStatus||/^(מותקן|מותקנות|הותקן|installed|הושלם|בוצע|done|completed|לא מותקן|ממתין|waiting|open|פתוח)$/.test(rawStatus)||status==='in_progress';
      const notes=[values.notes,rawStatus&&!known?`מצב במקור: ${values.status}`:''].filter(Boolean).join('\n');
      const floor=values.floor||(/^(CSV|עמוד \d+)$/i.test(table.name)?'':table.name);
      let due=values.due||config.due||'';const date=due.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);if(date)due=`${date[3]}-${date[2].padStart(2,'0')}-${date[1].padStart(2,'0')}`;
      if(config.kind==='task'&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||isNaN(new Date(due).getTime())||new Date(due).toISOString().slice(0,10)!==due))error='יש לבחור תאריך יעד לעבודה';
      output.push({key,id,sheet:table.name,row:r+1,floor,kind:config.kind==='task'?'task':'equipment',type:values.type||values.name||'רכיב',name:values.name||values.type||'רכיב',manufacturer:values.manufacturer||'',model:values.model||'',quantity,hours,location:[floor,values.location].filter(Boolean).join(' · '),status,notes,due,systemId:Number(config.systemId)||null,systemName:values.category||config.systemName||'ציוד מיובא',cancelled,error});
    }
  }
  // Mark every occurrence, including the first, rather than importing an arbitrary duplicate.
  const counts=new Map();output.forEach(r=>counts.set(r.key,(counts.get(r.key)||0)+1));
  return output.map(r=>counts.get(r.key)>1?{...r,error:'מזהה מופיע יותר מפעם אחת בקובץ'}:r);
}

export function threeWay(previous,current,incoming) {
  const changes=[],conflicts=[];
  for(const [field,value] of Object.entries(incoming)) {
    if(JSON.stringify(value)===JSON.stringify(previous?.[field]))continue;
    if(JSON.stringify(value)===JSON.stringify(current?.[field]))continue;
    const change={field,before:current?.[field]??null,after:value};changes.push(change);
    if(previous&&JSON.stringify(current?.[field])!==JSON.stringify(previous[field]))conflicts.push(change);
  }
  return {changes,conflicts};
}
