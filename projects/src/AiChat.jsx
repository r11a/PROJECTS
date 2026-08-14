import { Component, useEffect, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, Eraser, Mic, Send, Sparkles, X } from "lucide-react";
import { ModalPortal } from "./AppModal";
import "./ai-chat-actions.css";

const helpDestinations = [
  { page:"my-work",label:"פתח את העבודה שלי",pattern:/העבודה שלי|סדר היום|עדיפויות אישיות/i },
  { page:"calendar",label:"פתח לוח שנה",pattern:/לוח שנה|אירוע|Outlook|תאריך/i },
  { page:"gantt",label:"פתח לוח גאנט",pattern:/גאנט|ציר זמן|נתיב קריטי/i },
  { page:"tasks",label:"פתח משימות ואבני דרך",pattern:/משימ|אבני דרך|אבן דרך|תלות|אחראי|מבצע/i },
  { page:"reports",label:"פתח דוחות וניתוחים",pattern:/דוח|PDF|מצגת|סטטיסטיקה|ניתוח/i },
  { page:"settings",label:"פתח הגדרות ומערכת",pattern:/הגדר|הרשא|משתמש|Audit|גיבוי|NAS|סוכן AI/i },
  { page:"forms",label:"פתח טפסים ומסמכים",pattern:/טופס|מסמך|קובץ|תמונה|וידאו/i },
  { page:"finance",label:"פתח תשלומים וגבייה",pattern:/תשלום|גבייה|יתרה|תקציב|כספ/i },
  { page:"catalog",label:"פתח מערכות ורכיבים",pattern:/מערכות ורכיבים|קטלוג|רכיב|KNX|מצלמ/i },
  { page:"professionals",label:"פתח אנשי מקצוע",pattern:/אנשי מקצוע|טכנאי|אדריכל|חשמלאי|ספק/i },
  { page:"clients",label:"פתח לקוחות",pattern:/לקוח|לקוחות|Priority/i },
  { page:"projects",label:"פתח פרויקטים",pattern:/פרויקט|פרויקטים|אשף|ארכיון/i },
  { page:"dashboard",label:"פתח תמונת מצב",pattern:/תמונת מצב|דשבורד|תובנות/i },
];
const destinationsFor=(question)=>helpDestinations.filter((item)=>item.pattern.test(question)).slice(0,2).map(({page,label})=>({page,label}));

const helpGroups = [
  { title:"פרויקטים", examples:["אילו פרויקטים דורשים תשומת לב?","תן לי תמונת מצב של הפרויקטים הפעילים","אילו פרויקטים נמצאים בשלב התקנות?"] },
  { title:"משימות ולוח שנה", examples:["אילו משימות באיחור?","מה צריך לבצע בשבוע הקרוב?","אצל מי יש עומס משימות?"] },
  { title:"כספים וגבייה", examples:["מה היתרה הכוללת לגבייה?","באילו פרויקטים יתרת הגבייה הגבוהה ביותר?","סכם לי את מצב הגבייה"] },
  { title:"מערכות וצוות", examples:["אילו מערכות מותקנות הכי הרבה?","מי מנהל את הפרויקטים הפעילים?","כמה פרויקטים כוללים מצלמות?"] },
  { title:"מדריך מסכים ופעולות", examples:["מה המטרה של מסך העבודה שלי ואיך משתמשים בו?","הסבר לי בפירוט מה עושה כל טאב בתוך פרויקט","מה אפשר לבצע במסך משימות ואבני דרך?","איך עובדים נכון עם לוח הגאנט?"] },
  { title:"הגדרות והרשאות", examples:["הסבר לי את כל הטאבים במסך הגדרות ומערכת","מה ההבדל בין משתמש לאיש מקצוע?","איפה מגדירים שיתוף לוח שנה ל-Outlook?","איך מגדירים תיקיית NAS למסמכים?"] },
  { title:"פעולות נפוצות", examples:["איך יוצרים פרויקט חדש שלב אחר שלב?","איך מפיקים ושומרים דוח PDF בפרויקט?","איך מדווחים שעות עבודה?","איך יוצרים תלות בין משימות?"] },
];

export function AiChat({ apiRoot, onClose, onNavigate }) {
  const [messages,setMessages] = useState([{ role:"assistant", text:"שלום, אני הסוכן החכם של PROJECTS. אפשר לשאול אותי על פרויקטים, משימות, גבייה, מערכות או על השימוש בתוכנה." }]);
  const [question,setQuestion] = useState("");
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

  const streamAnswer = async (text,history) => {
    const response=await fetch(`${apiRoot}/ai/chat/stream`,{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{ "Content-Type":"application/json","Accept":"text/event-stream" },
      body:JSON.stringify({ question:text,history }),
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

  const ask = async (event) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const history = messages.filter((item)=>["user","assistant"].includes(item.role)).slice(-6).map((item)=>({ role:item.role, text:item.text }));
    setMessages((current)=>[...current,{ role:"user",text }]);
    setQuestion("");
    setHelpOpen(false);
    setBusy(true);
    try {
      const result=await streamAnswer(text,history);
      setMessages((current)=>[...current,{ role:"assistant",text:result.answer,meta:`${result.providerName} · ${result.model}`,actions:destinationsFor(text) }]);
    } catch (error) {
      setMessages((current)=>[...current,{ role:"error",text:error.message,meta:"אפשר לבדוק את החיבור תחת הגדרות ומערכת › סוכן AI" }]);
    } finally { setBusy(false); }
  };
  const useExample = (example) => { setQuestion(example); setHelpOpen(false); };
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
          <div><strong>הסוכן החכם</strong><small>תשובות מתוך נתוני PROJECTS · קריאה בלבד</small></div>
          <button type="button" className={helpOpen ? "active" : ""} onClick={()=>setHelpOpen(!helpOpen)} title="עזרה ודוגמאות"><CircleHelp size={19}/><b>עזרה</b></button>
          <button type="button" onClick={onClose} title="סגירה"><X size={21}/></button>
        </header>
        {helpOpen && <section className="ai-chat-help">
          <div><strong>עזרה חכמה ומדריך מלא למערכת</strong><small>הסוכן מכיר את מטרת כל מסך, טאב ופעולה, את סדר העבודה ואת הקשרים בין המודולים. לחיצה על דוגמה תעביר אותה לשורת השאלה.</small></div>
          {helpGroups.map((group)=><article key={group.title}><h4>{group.title}</h4><div>{group.examples.map((example)=><button type="button" key={example} onClick={()=>useExample(example)}>{example}</button>)}</div></article>)}
          <p><b>טיפ:</b> אפשר לבקש מדריך צעד-אחר-צעד, הסבר על מסך מסוים או תשובה מתוך הנתונים החיים. לדוגמה: “הסבר לי איך לנהל ביקורת אתר בפרויקט” או “מה המשימות הפתוחות בפרויקט משפחת כהן בשבועיים הקרובים?”</p>
        </section>}
        <div className="ai-chat-thread" ref={threadRef}>
          {messages.map((message,index)=><article key={index} className={message.role}>
            {message.role !== "user" && <span><Sparkles size={15}/></span>}
            <div><p>{message.text}</p>{message.actions?.length>0&&<nav className="ai-chat-actions">{message.actions.map((action)=><button type="button" key={action.page} onClick={()=>onNavigate?.(action.page)}>{action.label}<ArrowLeft size={14}/></button>)}</nav>}{message.meta && <small>{message.meta}</small>}</div>
          </article>)}
          {listening && <article className="assistant voice-listening"><span><Mic size={15}/></span><div><strong>מאזין…</strong><i/><i/><i/><i/><i/></div></article>}
          {busy && <article className="assistant thinking"><span><Sparkles size={15}/></span><div><i/><i/><i/></div></article>}
        </div>
        <form onSubmit={ask}>
          <button type="button" className="ai-chat-clear" onClick={()=>setMessages((current)=>current.slice(0,1))} title="ניקוי השיחה"><Eraser size={17}/></button>
          <button type="button" className={`ai-chat-mic ${listening?"listening":""}`} onClick={toggleVoice} disabled={busy} title={listening?"סיום ההאזנה":"שאלה בקול"}><Mic size={18}/></button>
          <textarea value={question} onChange={(event)=>setQuestion(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();ask();}}} placeholder="שאלו על פרויקט, משימה, גבייה או שימוש במערכת..." rows="1" maxLength="1500"/>
          <button className="ai-chat-send" disabled={busy||!question.trim()} title="שליחה"><Send size={18}/></button>
        </form>
        <footer>הנתונים נטענים מחדש בכל שאלה בהתאם להרשאות שלך. הסוכן עשוי לטעות; בהחלטות חשובות יש לאמת במסך המקור.</footer>
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
