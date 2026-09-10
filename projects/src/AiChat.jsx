import { Component, useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, Eraser, Mic, Send, Sparkles, X } from "lucide-react";
import { ModalPortal } from "./AppModal";
import "./ai-chat-actions.css";
import { equipmentCategories, ResearchText, ResearchResults } from './EquipmentResearch';

const helpDestinations = [
  { page:"my-work",label:"פתח את העבודה שלי",pattern:/העבודה שלי|סדר היום|עדיפויות אישיות/i },
  { page:"calendar",label:"פתח יומן עבודה",pattern:/יומן עבודה|לוח שנה|אירוע|Outlook|תאריך/i },
  { page:"gantt",label:"פתח לוח גאנט",pattern:/גאנט|ציר זמן|נתיב קריטי/i },
  { page:"tasks",label:"פתח משימות ואבני דרך",pattern:/משימ|אבני דרך|אבן דרך|תלות|אחראי|מבצע/i },
  { page:"reports",label:"פתח דוחות וניתוחים",pattern:/דוח|PDF|מצגת|סטטיסטיקה|ניתוח/i },
  { page:"settings",label:"פתח הגדרות ומערכת",pattern:/הגדר|הרשא|משתמש|Audit|גיבוי|NAS|סוכן AI/i },
  { page:"forms",label:"פתח מסמכים והקלטות",pattern:/טופס|מסמך|קובץ|תמונה|וידאו|הקלטה|תמלול/i },
  { page:"finance",label:"פתח תשלומים וגבייה",pattern:/תשלום|גבייה|יתרה|תקציב|כספ/i },
  { page:"catalog",label:"פתח מערכות ורכיבים",pattern:/מערכות ורכיבים|קטלוג|רכיב|KNX|מצלמ/i },
  { page:"professionals",label:"פתח אנשי מקצוע",pattern:/אנשי מקצוע|טכנאי|אדריכל|חשמלאי|ספק/i },
  { page:"clients",label:"פתח לקוחות",pattern:/לקוח|לקוחות|Priority/i },
  { page:"gis",label:"פתח מפת GIS",pattern:/GIS|מפת פרויקט|לוויין|קואורדינטות/i },
  { page:"projects",label:"פתח פרויקטים",pattern:/פרויקט|פרויקטים|אשף|ארכיון/i },
  { page:"dashboard",label:"פתח תמונת מצב",pattern:/תמונת מצב|דשבורד|תובנות/i },
];
const destinationsFor=(question)=>helpDestinations.filter((item)=>item.pattern.test(question)).slice(0,2).map(({page,label})=>({page,label}));

function ProjectCheckResult({result}) {
  return <section className="project-check-results" aria-label={`ממצאי בדיקה · ${result.project.name}`}>
    <strong>{result.project.name}</strong>
    <small>נבדקו {result.checked.tasks} משימות ו־{result.checked.equipment} רכיבים · {new Date(result.generatedAt).toLocaleString('he-IL')}</small>
    {result.truncated&&<p role="alert">הבדיקה חלקית: מוצגות עד 1,001 רשומות מכל סוג. ייתכנו ממצאים נוספים.</p>}
    {!result.findings.length&&<p>לא נמצאו ממצאים בבדיקות שבוצעו.</p>}
    {result.findings.map(finding=><details key={finding.key} className={`project-check-finding ${finding.severity}`}>
      <summary>{finding.title} <b>{finding.count}</b></summary>
      <p>{finding.suggestion}</p>
      <ul>{finding.items.map(item=><li key={item.id}><span>{item.label}</span>{item.detail&&<small>{item.detail}</small>}</li>)}</ul>
      {finding.count>finding.items.length&&<small>מוצגות {finding.items.length} מתוך {finding.count} רשומות.</small>}
      <a href={`?page=project&project=${encodeURIComponent(result.project.id)}&tab=${encodeURIComponent(finding.tab)}`}>פתיחת {finding.tab==='tasks'?'משימות':'מערכות ורכיבים'} בפרויקט</a>
    </details>)}
    <small>{result.scope}</small>
  </section>;
}

const helpGroups = [
  { title:"פרויקטים", examples:["אילו פרויקטים דורשים תשומת לב?","תן לי תמונת מצב של הפרויקטים הפעילים","אילו פרויקטים נמצאים בשלב התקנות?"] },
  { title:"משימות ולוח שנה", examples:["אילו משימות באיחור?","מה צריך לבצע בשבוע הקרוב?","אצל מי יש עומס משימות?"] },
  { title:"כספים וגבייה", examples:["מה היתרה הכוללת לגבייה?","באילו פרויקטים יתרת הגבייה הגבוהה ביותר?","סכם לי את מצב הגבייה"] },
  { title:"מערכות וצוות", examples:["אילו מערכות מותקנות הכי הרבה?","מי מנהל את הפרויקטים הפעילים?","כמה פרויקטים כוללים מצלמות?"] },
  { title:"מדריך מסכים ופעולות", examples:["מה המטרה של מסך העבודה שלי ואיך משתמשים בו?","הסבר לי בפירוט מה עושה כל טאב בתוך פרויקט","מה אפשר לבצע במסך משימות ואבני דרך?","איך עובדים נכון עם לוח הגאנט?"] },
  { title:"הגדרות והרשאות", examples:["הסבר לי את כל הטאבים במסך הגדרות ומערכת","מה ההבדל בין משתמש לאיש מקצוע?","איפה מגדירים שיתוף לוח שנה ל-Outlook?","איך מגדירים תיקיית NAS למסמכים?"] },
  { title:"פעולות נפוצות", examples:["איך יוצרים פרויקט חדש שלב אחר שלב?","איך מפיקים ושומרים דוח PDF בפרויקט?","איך מדווחים שעות עבודה?","איך יוצרים תלות בין משימות?"] },
];

export function AiChat({ apiRoot, onClose, onNavigate, initialProjectId = '' }) {
  const [messages,setMessages] = useState([{ role:"assistant", text:"שלום, אני הסוכן החכם של PROJECTS. אפשר לשאול אותי על פרויקטים, משימות, גבייה, מערכות או על השימוש בתוכנה." }]);
  const [question,setQuestion] = useState("");
  const [equipmentMode,setEquipmentMode]=useState(false);
  const [checkMode,setCheckMode]=useState(false);
  const [checkProject,setCheckProject]=useState(initialProjectId);
  const [projectError,setProjectError]=useState('');
  const [equipmentDetailsOpen,setEquipmentDetailsOpen]=useState(true);
  const [product,setProduct]=useState({manufacturer:'',model:'',category:'',projectId:''});
  const [projects,setProjects]=useState([]);
  const [freeSearch,setFreeSearch]=useState(false);
  useEffect(()=>{
    if(!equipmentMode&&!checkMode)return;
    const controller=new AbortController();
    setProjectError('');
    fetch(`${apiRoot}/projects`,{credentials:'same-origin',signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('לא ניתן לטעון פרויקטים. עברו למצב אחר וחזרו כדי לנסות שוב.');return r.json();}).then(data=>setProjects(data.projects||[])).catch(error=>{if(error.name!=='AbortError')setProjectError(error.message);});
    return ()=>controller.abort();
  },[equipmentMode,checkMode,apiRoot]);
  const [busy,setBusy] = useState(false);
  const [helpOpen,setHelpOpen] = useState(false);
  const [listening,setListening] = useState(false);
  const threadRef = useRef(null);
  const recognitionRef = useRef(null);
  useEffect(()=>()=>recognitionRef.current?.abort(),[]);
  useEffect(()=>{
    const thread = threadRef.current;
    if (!thread) return undefined;
    const frame = requestAnimationFrame(()=>{ thread.scrollTop=thread.scrollHeight; });
    return ()=>cancelAnimationFrame(frame);
  },[messages,busy]);

  const streamAnswer = async (text,history,options={}) => {
    const response=await fetch(`${apiRoot}/ai/chat/stream`,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{ "Content-Type":"application/json","Accept":"text/event-stream" },
      body:JSON.stringify({ question:text,...(equipmentMode||options.mode==='equipment'?{mode:'equipment',...product,freeSearch}:{history,freeSearch}),...options }),
    });
    if (!response.ok) {
      const raw=await response.text();
      let message=`הבקשה נכשלה (HTTP ${response.status})`;
      try { message=JSON.parse(raw)?.error || message; } catch { if (raw) message=raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,260); }
      const error=new Error(message);error.status=response.status;throw error;
    }
    if (!response.body) throw new Error("הדפדפן אינו תומך בקבלת תשובה זורמת");
    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let buffer="";
    let completed=null;
    const consume=(block)=>{
      const data=block.split("\n").find((line)=>line.startsWith("data:"));
      if (!data) return;
      const event=JSON.parse(data.slice(5).trim());
      if (event.type==="answer") completed=event;
      if (event.type==="error") throw new Error(event.error || "לא ניתן לקבל תשובה מהסוכן");
    };
    while (true) {
      const { value,done }=await reader.read();
      buffer+=decoder.decode(value || new Uint8Array(),{ stream:!done });
      const blocks=buffer.split("\n\n");
      buffer=blocks.pop() || "";
      for (const block of blocks) consume(block);
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
    if (!completed?.answer) throw new Error("החיבור הסתיים לפני שהתקבלה תשובה מלאה");
    return completed;
  };

  const ask = async (event,options={}) => {
    event?.preventDefault();
    if(checkMode){await checkAndSuggest();return;}
    const text = (options.question||question).trim();
    if (!text || busy) return;
    const history = messages.filter((item)=>["user","assistant"].includes(item.role)).slice(-6).map((item)=>({ role:item.role, text:item.text }));
    setMessages((current)=>[...current,{ role:"user",text }]);
    setQuestion("");
    setHelpOpen(false);
    setBusy(true);
    try {
      const result=await streamAnswer(text,history,options);
      if(result.research?.sources?.length)setEquipmentDetailsOpen(false);
      setMessages((current)=>[...current,{ role:"assistant",text:result.answer,research:result.research,question:text,meta:`${result.providerName} · ${result.model}${result.research?.sources?.length?` · ${new Date(result.generatedAt).toLocaleDateString('he-IL')}`:''}`,actions:result.research?[]:destinationsFor(text) }]);
    } catch (error) {
      setMessages((current)=>[...current,{ role:"error",text:error.message,meta:"אפשר לבדוק את החיבור תחת הגדרות ומערכת › סוכן AI" }]);
    } finally { setBusy(false); }
  };
  const checkAndSuggest = async () => {
    if(busy || !checkProject)return;
    setBusy(true);setHelpOpen(false);
    const projectName=projects.find(p=>p.id===checkProject)?.name||checkProject;
    setMessages(current=>[...current,{role:'user',text:`בדוק והצע · ${projectName}`}]);
    try {
      const response=await fetch(`${apiRoot}/ai/project-check?projectId=${encodeURIComponent(checkProject)}`,{credentials:'same-origin',cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'בדיקת הפרויקט נכשלה');
      setMessages(current=>[...current,{role:'assistant',text:`בדיקת הפרויקט: ${result.project.name}`,check:result,meta:'בדיקה מקומית · ללא טוקנים · ללא שינוי נתונים'}]);
    }catch(error){setMessages(current=>[...current,{role:'error',text:error.message}]);}
    finally{setBusy(false);}
  };
  const useExample = (example) => { setQuestion(example); setHelpOpen(false);setCheckMode(false); };
  const toggleVoice = () => {
    if (listening) { recognitionRef.current?.stop();return; }
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessages((current)=>[...current,{role:"error",text:"הדפדפן הזה אינו תומך כרגע בהקלדה קולית. אפשר להשתמש ב-Chrome או Edge מעודכנים, או במקלדת הקולית של הטלפון."}]);
      return;
    }
    const recognition=new Recognition();
    const existing=question.trim();
    recognition.lang="he-IL";
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>setListening(true);
    recognition.onresult=(event)=>{
      let transcript="";
      for(let index=event.resultIndex;index<event.results.length;index+=1) transcript+=event.results[index][0]?.transcript||"";
      setQuestion([existing,transcript.trim()].filter(Boolean).join(" "));
    };
    recognition.onerror=(event)=>{
      if (!["aborted","no-speech"].includes(event.error)) setMessages((current)=>[...current,{role:"error",text:event.error==="not-allowed"?"לא התקבלה הרשאה למיקרופון. אשרו גישה למיקרופון בהגדרות הדפדפן ונסו שוב.":"לא הצלחתי לזהות את הקול. אפשר לנסות שוב או להקליד את השאלה."}]);
    };
    recognition.onend=()=>{setListening(false);recognitionRef.current=null;};
    recognitionRef.current=recognition;
    recognition.start();
  };

  return (
    <ModalPortal>
    <div className="ai-chat-backdrop" onMouseDown={onClose}>
      <aside className="ai-chat" onMouseDown={(event)=>event.stopPropagation()} dir="rtl">
        <header>
          <span><Sparkles size={21}/></span>
          <div><strong>הסוכן החכם</strong><small>נתוני הפרויקטים ומידע טכני לציוד</small></div>
          <button type="button" className={helpOpen ? "active" : ""} onClick={()=>setHelpOpen(!helpOpen)} title="עזרה ודוגמאות"><CircleHelp size={19}/><b>עזרה</b></button>
          <button type="button" onClick={onClose} title="סגירה"><X size={21}/></button>
        </header>
        <section className="equipment-controls" hidden={helpOpen}>
          <div className="equipment-mode" role="group" aria-label="מצב הסוכן"><button type="button" aria-pressed={!equipmentMode&&!checkMode} disabled={busy} onClick={()=>{setEquipmentMode(false);setCheckMode(false);}}>הפרויקטים שלי</button><button type="button" aria-pressed={equipmentMode} disabled={busy} onClick={()=>{setEquipmentMode(true);setCheckMode(false);}}>מידע טכני לציוד</button><button type="button" aria-pressed={checkMode} disabled={busy} onClick={()=>{setEquipmentMode(false);setCheckMode(true);}}>בדוק והצע</button></div>
          {projectError&&<p role="alert">{projectError}</p>}
          {checkMode&&<div className="project-check-controls"><label>פרויקט לבדיקה<select aria-label="פרויקט לבדיקה" disabled={busy} value={checkProject} onChange={e=>setCheckProject(e.target.value)}><option value="">בחרו פרויקט</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p>בדיקת משימות וציוד עם הצעות לטיפול. אין צורך בחיבור AI.</p><button type="button" disabled={busy||!checkProject||!!projectError} onClick={checkAndSuggest}>{busy?'בודק את הפרויקט…':'בדוק את הפרויקט והצע טיפול'}</button></div>}
          {equipmentMode&&<details open={equipmentDetailsOpen} onToggle={event=>setEquipmentDetailsOpen(event.currentTarget.open)}><summary>פרטי הציוד {product.model&&`· ${product.manufacturer} ${product.model}`}</summary><div className="equipment-fields">
            <label>פרויקט<select aria-label="פרויקט לחיפוש ציוד" disabled={busy} value={product.projectId} onChange={e=>setProduct({...product,projectId:e.target.value,manufacturer:'',model:''})}><option value="">זיהוי מתוך השאלה / הזנה ידנית</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>סוג ציוד<select disabled={busy} value={product.category} onChange={e=>setProduct({...product,category:e.target.value})}><option value="">זיהוי מתוך השאלה</option>{equipmentCategories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label>יצרן<input disabled={busy} value={product.manufacturer} maxLength={120} placeholder="או זיהוי מתוך הפרויקט" onChange={e=>setProduct({...product,manufacturer:e.target.value})}/></label>
            <label>דגם מדויק<input disabled={busy} value={product.model} maxLength={160} placeholder="ללא ניחוש לפי שם הפריט" onChange={e=>setProduct({...product,model:e.target.value})}/></label>
          </div></details>}
          <label className="equipment-cost" hidden={checkMode}>חיפוש ציוד<select aria-label="אופן החיפוש" disabled={busy} value={freeSearch?'free':'ai'} onChange={e=>setFreeSearch(e.target.value==='free')}><option value="ai">חסכוני · AI עם מקורות</option><option value="free">קישורים בלבד · ללא טוקנים</option></select></label>
          {equipmentMode&&<button className="equipment-example" type="button" onClick={()=>setQuestion('מה המידות של המפסקים בפרויקט של לוי?')}>לדוגמה: מה המידות של המפסקים בפרויקט של לוי?</button>}
        </section>
        {helpOpen && <section className="ai-chat-help">
          <div><strong>עזרה חכמה ומדריך מלא למערכת</strong><small>הסוכן מכיר את מטרת כל מסך, טאב ופעולה, את סדר העבודה ואת הקשרים בין המודולים. לחיצה על דוגמה תעביר אותה לשורת השאלה.</small></div>
          {helpGroups.map((group)=><article key={group.title}><h4>{group.title}</h4><div>{group.examples.map((example)=><button type="button" key={example} onClick={()=>useExample(example)}>{example}</button>)}</div></article>)}
          <p><b>טיפ:</b> אפשר לבקש מדריך צעד-אחר-צעד, הסבר על מסך מסוים או תשובה מתוך הנתונים החיים. לדוגמה: “הסבר לי איך לנהל ביקורת אתר בפרויקט” או “מה המשימות הפתוחות בפרויקט משפחת כהן בשבועיים הקרובים?”</p>
        </section>}
        <div className="ai-chat-thread" ref={threadRef}>
          {messages.map((message,index)=><article key={index} className={message.role}>
            {message.role !== "user" && <span><Sparkles size={15}/></span>}
            <div>{message.check&&<ProjectCheckResult result={message.check}/>}<ResearchText text={message.text} research={message.research}/><ResearchResults research={message.research} busy={busy} onProject={projectId=>{setProduct(current=>({...current,projectId,manufacturer:'',model:''}));ask(null,{mode:'equipment',projectId,manufacturer:'',model:'',question:message.question});}} onProduct={selected=>{setEquipmentMode(true);setProduct(current=>({...current,manufacturer:selected.manufacturer,model:selected.model}));if(selected.manufacturer&&selected.model){setFreeSearch(false);ask(null,{mode:'equipment',manufacturer:selected.manufacturer,model:selected.model,freeSearch:false,question:message.question});}else {setEquipmentDetailsOpen(true);setQuestion(message.question);}}}/>{message.actions?.length>0&&<nav className="ai-chat-actions">{message.actions.map((action)=><button type="button" key={action.page} onClick={()=>typeof onNavigate==='function'&&onNavigate(action.page)}>{action.label}<ArrowLeft size={14}/></button>)}</nav>}{message.meta && <small>{message.meta}</small>}</div>
          </article>)}
          {listening && <article className="assistant voice-listening"><span><Mic size={15}/></span><div><strong>מאזין…</strong><i/><i/><i/><i/><i/></div></article>}
          {busy && <article className="assistant thinking"><span><Sparkles size={15}/></span><div><i/><i/><i/></div></article>}
        </div>
        <form onSubmit={ask} hidden={checkMode}>
          <button type="button" className="ai-chat-clear" onClick={()=>setMessages((current)=>current.slice(0,1))} title="ניקוי השיחה"><Eraser size={17}/></button>
          <button type="button" className={`ai-chat-mic ${listening?"listening":""}`} onClick={toggleVoice} disabled={busy} title={listening?"סיום ההאזנה":"שאלה בקול"}><Mic size={18}/></button>
          <textarea value={question} onChange={(event)=>setQuestion(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();ask();}}} placeholder={equipmentMode?"שאלו על מידות, מפרט או התקנה...":"שאלו על פרויקט, ציוד או שימוש במערכת..."} rows="1" maxLength="1500"/>
          <button className="ai-chat-send" disabled={busy||!question.trim()} title="שליחה"><Send size={18}/></button>
        </form>
        <footer>חיפוש ציוד: זיהוי מקומי, דגם אחד בכל חיפוש ותשובה שמורה לשבוע. חיפוש חדש עשוי לעלות לפי הספק; אומדן הטוקנים אינו כולל דמי חיפוש. יש לאמת מידות בשרטוט היצרן לפני ביצוע.</footer>
      </aside>
    </div>
    </ModalPortal>
  );
}

export class AiChatBoundary extends Component {
  constructor(props) { super(props); this.state={ failed:false }; }
  static getDerivedStateFromError() { return { failed:true }; }
  componentDidCatch(error) { console.error("PROJECTS AI chat UI failed",error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <ModalPortal><div className="ai-chat-backdrop"><aside className="ai-chat-fallback" dir="rtl"><Sparkles size={28}/><h3>לא ניתן להציג כרגע את חלון הסוכן</h3><p>הממשק הראשי ממשיך לפעול. סגרו את החלון ונסו לפתוח אותו מחדש.</p><button type="button" onClick={this.props.onClose}>סגירה</button></aside></div></ModalPortal>;
  }
}
