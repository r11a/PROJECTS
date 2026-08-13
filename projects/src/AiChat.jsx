import { useEffect, useRef, useState } from "react";
import { CircleHelp, Eraser, Send, Sparkles, X } from "lucide-react";

const helpGroups = [
  { title:"פרויקטים", examples:["אילו פרויקטים דורשים תשומת לב?","תן לי תמונת מצב של הפרויקטים הפעילים","אילו פרויקטים נמצאים בשלב התקנות?"] },
  { title:"משימות ולוח שנה", examples:["אילו משימות באיחור?","מה צריך לבצע בשבוע הקרוב?","אצל מי יש עומס משימות?"] },
  { title:"כספים וגבייה", examples:["מה היתרה הכוללת לגבייה?","באילו פרויקטים יתרת הגבייה הגבוהה ביותר?","סכם לי את מצב הגבייה"] },
  { title:"מערכות וצוות", examples:["אילו מערכות מותקנות הכי הרבה?","מי מנהל את הפרויקטים הפעילים?","כמה פרויקטים כוללים מצלמות?"] },
  { title:"עזרה בתוכנה", examples:["איך יוצרים פרויקט חדש?","איפה מגדירים שיתוף לוח שנה?","איך מפיקים דוח PDF?"] },
];

export function AiChat({ api, onClose }) {
  const [messages,setMessages] = useState([{ role:"assistant", text:"שלום, אני הסוכן החכם של PROJECTS. אפשר לשאול אותי על פרויקטים, משימות, גבייה, מערכות או על השימוש בתוכנה." }]);
  const [question,setQuestion] = useState("");
  const [busy,setBusy] = useState(false);
  const [helpOpen,setHelpOpen] = useState(false);
  const endRef = useRef(null);
  useEffect(()=>endRef.current?.scrollIntoView({ behavior:"smooth" }),[messages,busy,helpOpen]);

  const ask = async (event) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const history = messages.slice(-6).map((item)=>({ role:item.role, text:item.text }));
    setMessages((current)=>[...current,{ role:"user",text }]);
    setQuestion("");
    setHelpOpen(false);
    setBusy(true);
    try {
      const result = await api("/ai/chat",{ method:"POST",body:JSON.stringify({ question:text,history }) });
      setMessages((current)=>[...current,{ role:"assistant",text:result.answer,meta:`${result.providerName} · ${result.model}` }]);
    } catch (error) {
      setMessages((current)=>[...current,{ role:"error",text:error.message }]);
    } finally { setBusy(false); }
  };
  const useExample = (example) => { setQuestion(example); setHelpOpen(false); };

  return (
    <div className="ai-chat-backdrop" onMouseDown={onClose}>
      <aside className="ai-chat" onMouseDown={(event)=>event.stopPropagation()} dir="rtl">
        <header>
          <span><Sparkles size={21}/></span>
          <div><strong>הסוכן החכם</strong><small>תשובות מתוך נתוני PROJECTS · קריאה בלבד</small></div>
          <button className={helpOpen ? "active" : ""} onClick={()=>setHelpOpen(!helpOpen)} title="עזרה ודוגמאות"><CircleHelp size={19}/><b>עזרה</b></button>
          <button onClick={onClose} title="סגירה"><X size={21}/></button>
        </header>
        {helpOpen && <section className="ai-chat-help">
          <div><strong>מה אפשר לשאול?</strong><small>לחיצה על דוגמה תעביר אותה לשורת השאלה. אפשר לנסח גם באופן חופשי.</small></div>
          {helpGroups.map((group)=><article key={group.title}><h4>{group.title}</h4><div>{group.examples.map((example)=><button key={example} onClick={()=>useExample(example)}>{example}</button>)}</div></article>)}
          <p><b>טיפ:</b> לקבלת תשובה מדויקת ציינו פרויקט, תקופה או תחום. לדוגמה: “מה המשימות הפתוחות בפרויקט משפחת כהן בשבועיים הקרובים?”</p>
        </section>}
        <div className="ai-chat-thread">
          {messages.map((message,index)=><article key={index} className={message.role}>
            {message.role !== "user" && <span><Sparkles size={15}/></span>}
            <div><p>{message.text}</p>{message.meta && <small>{message.meta}</small>}</div>
          </article>)}
          {busy && <article className="assistant thinking"><span><Sparkles size={15}/></span><div><i/><i/><i/></div></article>}
          <div ref={endRef}/>
        </div>
        <form onSubmit={ask}>
          <button type="button" className="ai-chat-clear" onClick={()=>setMessages((current)=>current.slice(0,1))} title="ניקוי השיחה"><Eraser size={17}/></button>
          <textarea value={question} onChange={(event)=>setQuestion(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();ask();}}} placeholder="שאלו על פרויקט, משימה, גבייה או שימוש במערכת..." rows="1" maxLength="1500"/>
          <button className="ai-chat-send" disabled={busy||!question.trim()} title="שליחה"><Send size={18}/></button>
        </form>
        <footer>הסוכן עשוי לטעות. בהחלטות חשובות יש לאמת את הנתונים במסך המקור.</footer>
      </aside>
    </div>
  );
}
