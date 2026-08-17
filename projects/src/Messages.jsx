import { useEffect, useState } from "react";
import { Check, CheckCheck, CornerUpLeft, Link2, Mail, MessageSquare, Plus, Send, Trash2, X } from "lucide-react";
import { ModalPortal } from "./AppModal";
import { SmartTextArea } from "./features/smart-input/SmartTextArea";
import { VoiceNotes } from "./features/voice-notes/VoiceNotes";

const newVoiceContext=()=>globalThis.crypto?.randomUUID?.()||`voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function MessageCenter({
  api,
  apiRoot,
  user,
  users,
  onClose,
  setNotice,
  onUnread,
  onOpenLinked,
}) {
  const [messages, setMessages] = useState([]);
  const [compose, setCompose] = useState(false);
  const [selected,setSelected]=useState([]);
  const [form, setForm] = useState({ recipientId: "", subject: "", body: "", parentId:null, linkedUrl:"" });
  const [voiceContext,setVoiceContext]=useState(newVoiceContext);
  const load = () =>
    api("/messages")
      .then((result) => {
        setMessages(result.messages);
        onUnread(result.unread);
      })
      .catch((error) => setNotice(error.message));
  useEffect(() => {
    load();
    const live = (event) => {
      if (!event.detail?.table || event.detail.table === "user_messages")
        load();
    };
    window.addEventListener("projects:live-change", live);
    return () => window.removeEventListener("projects:live-change", live);
  }, []);
  const read = async (message) => {
    if (String(message.recipientId) !== String(user.id) || message.readAt)
      return;
    await api(`/messages/${message.id}/read`, { method: "PATCH", body: "{}" });
    load();
  };
  const send = async (event) => {
    event.preventDefault();
    try {
      await api("/messages", { method: "POST", body: JSON.stringify({...form,voiceContextId:voiceContext}) });
      setForm({ recipientId: "", subject: "", body: "", parentId:null, linkedUrl:"" });
      setVoiceContext(newVoiceContext());
      setCompose(false);
      setNotice("ההודעה נשלחה");
      load();
    } catch (error) {
      setNotice(error.message);
    }
  };
  const reply = (message) => {
    const recipientId=String(message.senderId)===String(user.id)?message.recipientId:message.senderId;
    setForm({recipientId:String(recipientId),subject:`תגובה: ${message.subject||"הודעה"}`,body:"",parentId:message.id,linkedUrl:message.linkedUrl||""});
    setCompose(true);
  };
  const insertMention=(item)=>setForm(current=>({...current,body:`${current.body}${current.body&&!current.body.endsWith(' ')?' ':''}@${item.displayName} `}));
  const remove=async(ids)=>{if(!ids.length||!confirm(`למחוק ${ids.length===1?'את ההודעה':`${ids.length} הודעות`} מהתצוגה שלך?`))return;try{await api('/messages',{method:'DELETE',body:JSON.stringify({ids})});setSelected([]);setNotice('ההודעות שנבחרו נמחקו');load()}catch(error){setNotice(error.message)}};
  const openLinked = async (event, message) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await read(message);
      onOpenLinked?.(message.linkedUrl);
    } catch (error) {
      setNotice(error.message || "לא ניתן לפתוח את מקור התיוג");
    }
  };
  return (
    <ModalPortal>
    <div className="message-backdrop" onMouseDown={onClose}>
      <aside
        className="message-center"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <MessageSquare size={20} />
            <span>
              <strong>הודעות צוות</strong>
              <small>עדכונים בזמן אמת בין משתמשים</small>
            </span>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <button
          className="ops-primary message-compose-button"
          onClick={() => setCompose(!compose)}
        >
          <Plus size={16} />
          הודעה חדשה
        </button>
        <div className="online-team"><strong>מחוברים כעת</strong><div>{users.filter(item=>item.online&&String(item.id)!==String(user.id)).map(item=><span key={item.id} style={{"--online-color":item.avatarColor||"#6957df"}}>{item.displayName}</span>)}{!users.some(item=>item.online&&String(item.id)!==String(user.id))&&<small>אין משתמשים נוספים מחוברים כרגע</small>}</div></div>
        {selected.length>0&&<div className="message-selection"><span>{selected.length} נבחרו</span><button className="ops-danger" onClick={()=>remove(selected)}><Trash2 size={15}/>מחיקת מסומנות</button></div>}
        {compose && (
          <form className="message-compose" onSubmit={send}>
            <label>
              נמען
              <select
                required
                value={form.recipientId}
                onChange={(event) =>
                  setForm({ ...form, recipientId: event.target.value })
                }
              >
                <option value="">בחירת משתמש</option>
                {users
                  .filter(
                    (item) =>
                      String(item.id) !== String(user.id) &&
                      item.active !== false,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              כותרת
              <input
                value={form.subject}
                onChange={(event) =>
                  setForm({ ...form, subject: event.target.value })
                }
              />
            </label>
            <SmartTextArea api={api} value={form.body} onChange={(body)=>setForm({...form,body})} setNotice={setNotice} label="הודעה" textareaProps={{required:true}}/>
            <VoiceNotes api={api} apiRoot={apiRoot} entityType="message_draft" entityId={voiceContext} setNotice={setNotice} canDelete/>
            <div className="message-mentions"><small>תיוג משתמש:</small>{users.filter(item=>String(item.id)!==String(user.id)&&item.active!==false).map(item=><button type="button" key={item.id} onClick={()=>insertMention(item)}>@{item.displayName}</button>)}</div>
            <button className="ops-primary">
              <Send size={15} />
              שליחה
            </button>
          </form>
        )}
        <div className="message-list">
          {messages.map((message) => (
            <article
              key={message.id}
              className={
                !message.readAt &&
                String(message.recipientId) === String(user.id)
                  ? "unread"
                  : ""
              }
              onClick={() => read(message)}
            >
              <input type="checkbox" checked={selected.includes(message.id)} onClick={event=>event.stopPropagation()} onChange={event=>setSelected(current=>event.target.checked?[...current,message.id]:current.filter(id=>id!==message.id))} aria-label="בחירת הודעה"/>
              <span className="message-avatar" style={{"--avatar-color":message.senderAvatarColor||"#6957df"}}>
                {message.senderAvatarImage?<img src={`${apiRoot}/users/${message.senderId}/avatar`} alt={message.senderName}/>:<b>{String(message.senderName||"משתמש").trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("")}</b>}
              </span>
              <div>
                <strong>{message.subject || "הודעה ללא כותרת"}</strong>
                <small>
                  {String(message.senderId) === String(user.id)
                    ? `אל ${message.recipientName}`
                    : `מאת ${message.senderName}`}{" "}
                  · {new Date(message.createdAt).toLocaleString("he-IL")}
                </small>
                <p>{message.body}</p>
                {String(message.senderId) === String(user.id) && (
                  <small className={`message-delivery-state ${message.readAt ? "read" : message.deliveredAt ? "delivered" : "sent"}`}>
                    <CheckCheck size={13} />
                    {message.readAt
                      ? `נפתחה ונקראה · ${new Date(message.readAt).toLocaleString("he-IL")}`
                      : message.deliveredAt
                        ? `הגיעה לנמען · ${new Date(message.deliveredAt).toLocaleString("he-IL")}`
                        : "נשלחה"}
                  </small>
                )}
                {message.linkedUrl&&<button type="button" className="message-linked" onClick={(event)=>openLinked(event,message)}><Link2 size={13}/>פתיחת המשימה במקור</button>}
              </div>
              <div className="message-row-actions">{message.readAt && <Check size={15} />}<button onClick={event=>{event.stopPropagation();reply(message)}} title="שליחת תגובה"><CornerUpLeft size={14}/></button><button onClick={event=>{event.stopPropagation();remove([message.id])}} title="מחיקת הודעה"><Trash2 size={14}/></button></div>
            </article>
          ))}
          {!messages.length && (
            <div className="message-empty">אין עדיין הודעות.</div>
          )}
        </div>
      </aside>
    </div>
    </ModalPortal>
  );
}
