import { useEffect, useState } from "react";
import { Check, CornerUpLeft, Link2, Mail, MessageSquare, Plus, Send, Trash2, X } from "lucide-react";
import { ModalPortal } from "./AppModal";

export function MessageCenter({
  api,
  user,
  users,
  onClose,
  setNotice,
  onUnread,
}) {
  const [messages, setMessages] = useState([]);
  const [compose, setCompose] = useState(false);
  const [selected,setSelected]=useState([]);
  const [form, setForm] = useState({ recipientId: "", subject: "", body: "", parentId:null, linkedUrl:"" });
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
      await api("/messages", { method: "POST", body: JSON.stringify(form) });
      setForm({ recipientId: "", subject: "", body: "", parentId:null, linkedUrl:"" });
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
            <label>
              הודעה
              <textarea
                required
                value={form.body}
                onChange={(event) =>
                  setForm({ ...form, body: event.target.value })
                }
              />
            </label>
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
              <span>
                <Mail size={17} />
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
                {message.linkedUrl&&<a className="message-linked" href={message.linkedUrl}><Link2 size={13}/>פתיחת הקישור המצורף</a>}
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
