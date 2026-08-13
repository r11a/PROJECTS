import pptxgen from "pptxgenjs";

const COLORS = { ink: "1B1D2A", muted: "6F7587", primary: "6957DF", primarySoft: "EEEAFE", blue: "4F83E3", green: "2A9D78", amber: "D99A35", red: "C94659", surface: "F7F7FB", white: "FFFFFF", line: "E5E7EF" };
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const number = (value) => Number(value || 0);
const money = new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const stageNames = { waiting:"בהמתנה",mobilization:"בהנעה",infrastructure:"תשתיות",threading:"השחלות",threading_done:"בוצעו השחלות",installation_a:"התקנות שלב א׳",installation_b:"התקנות שלב ב׳",installation_c:"התקנות שלב ג׳",activation_programming:"הפעלות ותכנות",finishes:"פינישים",ready_for_delivery:"מוכן למסירה",post_delivery:"תוספות לאחר מסירה" };

function addHeader(slide, title, eyebrow, page) {
  slide.background = { color: COLORS.surface };
  slide.addShape("rect", { x:0,y:0,w:13.333,h:0.11,line:{color:COLORS.primary},fill:{color:COLORS.primary} });
  slide.addText(eyebrow, { x:8.5,y:0.42,w:4.15,h:0.26,fontFace:"Arial",fontSize:11,bold:true,color:COLORS.primary,align:"right",rtlMode:true,margin:0 });
  slide.addText(title, { x:4.1,y:0.76,w:8.55,h:0.52,fontFace:"Arial",fontSize:26,bold:true,color:COLORS.ink,align:"right",rtlMode:true,margin:0,fit:"shrink" });
  slide.addText(String(page).padStart(2,"0"), { x:0.65,y:6.92,w:0.5,h:0.2,fontFace:"Arial",fontSize:9,color:COLORS.muted,margin:0 });
}

function addKpi(slide, x, label, value, color = COLORS.primary) {
  slide.addShape("roundRect", { x,y:2.15,w:3.65,h:1.55,rectRadius:0.08,line:{color:COLORS.line,width:1},fill:{color:COLORS.white},shadow:{type:"outer",color:"C9CAD4",blur:2,angle:45,distance:1,opacity:0.16} });
  slide.addShape("rect", { x:x+3.53,y:2.38,w:0.06,h:1.08,line:{color},fill:{color} });
  slide.addText(label, { x:x+0.3,y:2.42,w:2.92,h:0.24,fontFace:"Arial",fontSize:12,color:COLORS.muted,align:"right",rtlMode:true,margin:0 });
  slide.addText(clean(value), { x:x+0.3,y:2.78,w:2.92,h:0.52,fontFace:"Arial",fontSize:25,bold:true,color:COLORS.ink,align:"right",rtlMode:true,margin:0,fit:"shrink" });
}

function addList(slide, items, { x=6.75,y=1.65,w=5.85,h=4.8,color=COLORS.primary } = {}) {
  const rows = items.filter(Boolean).slice(0, 8);
  const rowHeight = Math.min(0.66, h / Math.max(rows.length, 1));
  rows.forEach((item,index) => {
    const top = y + index * rowHeight;
    slide.addShape("ellipse", { x:x+w-0.22,y:top+0.14,w:0.09,h:0.09,line:{color},fill:{color} });
    slide.addText(clean(item), { x,y:top,w:w-0.35,h:rowHeight-0.05,fontFace:"Arial",fontSize:15,color:COLORS.ink,align:"right",valign:"mid",rtlMode:true,margin:0.03,fit:"shrink" });
  });
}

function aiSections(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.replace(/^#+\s*/,"").replace(/^[-*•]\s*/,"").replace(/\*\*/g,"").trim()).filter(Boolean);
  return lines.length ? lines.slice(0,8) : ["לעבור על פרויקטים בעלי התקדמות נמוכה או משימות קריטיות","לאשר סדרי עדיפויות ואחראים למשימות הפתוחות","לקבוע פעולות גבייה ותאריכי מעקב"];
}

export async function exportManagementPresentation({ projects=[], data={}, company={}, aiReportText="", options={} }) {
  const sections = { overview:true,risks:true,managers:true,systems:true,finance:true,decisions:true,...options.sections };
  const selectedIds = new Set(options.projectIds || []);
  const scopedProjects = selectedIds.size ? projects.filter((item) => selectedIds.has(String(item.id))) : projects;
  const riskThreshold = Math.max(0,Math.min(100,number(options.riskThreshold ?? 50)));
  const maxItems = Math.max(3,Math.min(10,number(options.maxItems ?? 7)));
  const scopeLabel = selectedIds.size ? `${scopedProjects.length} פרויקטים שנבחרו` : "כל הפרויקטים הפעילים";
  const finance = data.finance || {};
  const scopedTotal = selectedIds.size ? scopedProjects.reduce((sum,item)=>sum+number(item.value),0) : number(finance.total);
  const scopedPaid = selectedIds.size ? scopedProjects.reduce((sum,item)=>sum+number(item.paid),0) : number(finance.paid);
  const scopedOpen = Math.max(0,scopedTotal-scopedPaid);
  const openTasks = (data.tasks || []).filter((item)=>item.status!=="done").reduce((sum,item)=>sum+number(item.count),0);
  const risks = scopedProjects.filter((item)=>number(item.progress)<riskThreshold||item.priority==="critical"||item.flag).sort((a,b)=>number(a.progress)-number(b.progress)).slice(0,maxItems);

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "PROJECTS";
  pptx.company = clean(company.name || "PROJECTS");
  pptx.subject = "ישיבת ניהול פרויקטים";
  pptx.title = clean(options.title || `ישיבת ניהול פרויקטים - ${company.name || "PROJECTS"}`);
  pptx.lang = "he-IL";
  pptx.theme = { headFontFace:"Arial",bodyFontFace:"Arial",lang:"he-IL" };
  pptx.defineSlideMaster({ title:"PROJECTS_MASTER",background:{color:COLORS.surface},objects:[{text:{text:"PROJECTS  ·  Manage Smarter. Deliver Better.",options:{x:7.5,y:6.91,w:5.15,h:0.2,fontFace:"Arial",fontSize:8,color:COLORS.muted,align:"right",margin:0}}}],slideNumber:{x:0.65,y:6.9,color:COLORS.muted,fontFace:"Arial",fontSize:8} });

  let page = 1;
  let slide = pptx.addSlide("PROJECTS_MASTER");
  slide.background = { color:COLORS.ink };
  slide.addShape("rect", { x:0,y:0,w:0.15,h:7.5,line:{color:COLORS.primary},fill:{color:COLORS.primary} });
  slide.addText("PROJECTS", { x:7.35,y:1.3,w:5.05,h:0.55,fontFace:"Arial",fontSize:20,bold:true,color:"A99AFF",align:"right",margin:0,charSpacing:3 });
  slide.addText(clean(options.title || "ישיבת ניהול פרויקטים"), { x:3.4,y:2.05,w:9,h:0.86,fontFace:"Arial",fontSize:38,bold:true,color:COLORS.white,align:"right",rtlMode:true,margin:0,fit:"shrink" });
  slide.addText(`${company.name || "תמונת מצב ניהולית"} · ${scopeLabel}`, { x:4.6,y:3.05,w:7.8,h:0.42,fontFace:"Arial",fontSize:18,color:"C8CBD7",align:"right",rtlMode:true,margin:0,fit:"shrink" });
  slide.addShape("line", { x:8.65,y:3.76,w:3.75,h:0,line:{color:COLORS.primary,width:3} });
  slide.addText(new Date().toLocaleString("he-IL"), { x:8.1,y:4.04,w:4.3,h:0.3,fontFace:"Arial",fontSize:12,color:"A7ACBB",align:"right",rtlMode:true,margin:0 });

  if (sections.overview) {
    slide = pptx.addSlide("PROJECTS_MASTER"); addHeader(slide,"תמונת מצב מנהלים",`${scopeLabel} · נתונים מרכזיים`,++page);
    addKpi(slide,8.75,"פרויקטים",scopedProjects.length,COLORS.primary); addKpi(slide,4.84,"משימות פתוחות",openTasks,COLORS.amber); addKpi(slide,0.93,"יתרה לגבייה",money.format(scopedOpen),COLORS.green);
    slide.addText("מיקוד לישיבה", { x:8.75,y:4.55,w:3.65,h:0.34,fontFace:"Arial",fontSize:18,bold:true,color:COLORS.ink,align:"right",rtlMode:true,margin:0 });
    addList(slide,[`${risks.length} פרויקטים דורשים תשומת לב`,`${openTasks} משימות עדיין פתוחות`,`היקף כולל: ${money.format(scopedTotal)}`],{x:6.55,y:4.98,w:5.85,h:1.55});
  }
  if (sections.risks) {
    slide = pptx.addSlide("PROJECTS_MASTER"); addHeader(slide,"מוקדי תשומת לב",`סף סיכון: התקדמות מתחת ל־${riskThreshold}%`,++page);
    if (!risks.length) slide.addText("לא נמצאו פרויקטים חריגים לפי הסף שנבחר", { x:2.1,y:2.6,w:9.2,h:0.6,fontFace:"Arial",fontSize:24,bold:true,color:COLORS.green,align:"center",rtlMode:true,margin:0 });
    else risks.forEach((item,index)=>{const y=1.55+index*0.7;const progress=Math.max(0,Math.min(100,number(item.progress)));slide.addText(clean(item.name),{x:8.2,y,w:4.2,h:0.3,fontFace:"Arial",fontSize:15,bold:true,color:COLORS.ink,align:"right",rtlMode:true,margin:0,fit:"shrink"});slide.addText(`${stageNames[item.stage]||clean(item.stage)} · ${progress}%`,{x:8.2,y:y+0.32,w:4.2,h:0.2,fontFace:"Arial",fontSize:10,color:COLORS.muted,align:"right",rtlMode:true,margin:0});slide.addShape("roundRect",{x:1.05,y:y+0.13,w:6.6,h:0.16,line:{color:COLORS.line},fill:{color:"E6E7EE"}});slide.addShape("roundRect",{x:1.05,y:y+0.13,w:Math.max(0.12,6.6*progress/100),h:0.16,line:{color:progress<25?COLORS.red:COLORS.amber},fill:{color:progress<25?COLORS.red:COLORS.amber}})});
  }
  if (sections.managers) {
    slide = pptx.addSlide("PROJECTS_MASTER"); addHeader(slide,"ביצוע לפי מנהל","עומסים והתקדמות",++page);
    const managers=(data.managers||[]).slice(0,maxItems); if(!managers.length) slide.addText("טרם הוקצו מנהלי פרויקטים",{x:2,y:2.7,w:9.3,h:0.5,fontFace:"Arial",fontSize:24,color:COLORS.muted,align:"center",rtlMode:true,margin:0});
    managers.forEach((item,index)=>{const y=1.55+index*0.69;const progress=Math.max(0,Math.min(100,number(item.progress)));slide.addText(clean(item.name||"ללא מנהל"),{x:9.2,y,w:3.2,h:0.28,fontFace:"Arial",fontSize:15,bold:true,color:COLORS.ink,align:"right",rtlMode:true,margin:0});slide.addText(`${number(item.projects)} פרויקטים`,{x:9.2,y:y+0.3,w:3.2,h:0.2,fontFace:"Arial",fontSize:10,color:COLORS.muted,align:"right",rtlMode:true,margin:0});slide.addShape("roundRect",{x:1.2,y:y+0.15,w:7.25,h:0.22,line:{color:COLORS.line},fill:{color:"E6E7EE"}});slide.addShape("roundRect",{x:1.2,y:y+0.15,w:Math.max(0.12,7.25*progress/100),h:0.22,line:{color:COLORS.primary},fill:{color:COLORS.primary}});slide.addText(`${progress}%`,{x:0.55,y:y+0.08,w:0.55,h:0.3,fontFace:"Arial",fontSize:12,bold:true,color:COLORS.ink,align:"center",margin:0})});
  }
  if (sections.systems) {
    slide = pptx.addSlide("PROJECTS_MASTER"); addHeader(slide,"מערכות וטכנולוגיות","מערכות מובילות בפרויקטים",++page);
    const systems=(data.systems||[]).slice(0,maxItems).map((item)=>`${item.name}: ${number(item.projects)} פרויקטים`); const components=(data.components||[]).slice(0,maxItems).map((item)=>`${item.name}: ${number(item.quantity)} יחידות`);
    slide.addText("מערכות מובילות",{x:7,y:1.55,w:5.4,h:0.4,fontFace:"Arial",fontSize:20,bold:true,color:COLORS.ink,align:"right",rtlMode:true,margin:0}); addList(slide,systems,{x:6.65,y:2.05,w:5.75,h:3.9,color:COLORS.blue});
    slide.addText("רכיבים מובילים",{x:1,y:1.55,w:5.4,h:0.4,fontFace:"Arial",fontSize:20,bold:true,color:COLORS.ink,align:"right",rtlMode:true,margin:0}); addList(slide,components,{x:0.65,y:2.05,w:5.75,h:3.9,color:COLORS.green});
  }
  if (sections.finance) {
    slide = pptx.addSlide("PROJECTS_MASTER"); addHeader(slide,"כספים וגבייה",scopeLabel,++page);
    addKpi(slide,8.75,"היקף",money.format(scopedTotal),COLORS.primary); addKpi(slide,4.84,"נגבה",money.format(scopedPaid),COLORS.green); addKpi(slide,0.93,"יתרה",money.format(scopedOpen),COLORS.red);
    const collectionRate=scopedTotal?Math.round(scopedPaid/scopedTotal*100):0; slide.addText(`שיעור גבייה: ${collectionRate}%`,{x:3,y:4.55,w:7.3,h:0.5,fontFace:"Arial",fontSize:25,bold:true,color:COLORS.ink,align:"center",rtlMode:true,margin:0});
  }
  if (sections.decisions) {
    slide = pptx.addSlide("PROJECTS_MASTER"); addHeader(slide,"החלטות ופעולות","סיכום ניהולי",++page); addList(slide,aiSections(aiReportText),{x:1.15,y:1.6,w:11.2,h:4.75});
    slide.addShape("roundRect",{x:1.15,y:6.25,w:11.2,h:0.42,line:{color:"D8D3FA"},fill:{color:COLORS.primarySoft}}); slide.addText("בסיום הישיבה: לכל החלטה יש להגדיר אחראי ותאריך יעד",{x:1.45,y:6.34,w:10.6,h:0.2,fontFace:"Arial",fontSize:12,bold:true,color:COLORS.primary,align:"center",rtlMode:true,margin:0});
  }

  const fileName = `PROJECTS-management-${new Date().toISOString().slice(0,10)}.pptx`;
  await pptx.writeFile({ fileName });
  return fileName;
}
