import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Sparkles, Square } from "lucide-react";
import { AppModal } from "../../AppModal";
import { localDateTimeValue } from "../../dateTime";
import "./meeting-summary.css";

export function MeetingSummaryForm({ api, onClose, onSubmit, setNotice }) {
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [listening, setListening] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const recognitionRef = useRef(null);
  const speechBaseRef = useRef("");

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("הכתבה קולית אינה נתמכת בדפדפן הזה. ניתן להשתמש במיקרופון של המקלדת במכשיר.");
      return;
    }
    const recognition = new Recognition();
    speechBaseRef.current = summary.trim();
    recognition.lang = "he-IL";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      setSummary([speechBaseRef.current, transcript].filter(Boolean).join("\n"));
    };
    recognition.onerror = () => setNotice("ההכתבה הקולית הופסקה. בדקו הרשאת מיקרופון ונסו שוב.");
    recognition.onend = () => { recognitionRef.current = null; setListening(false); };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const polish = async () => {
    if (summary.trim().length < 10) return setNotice("יש להקליד או להכתיב תוכן לפני העיבוד המקצועי");
    setPolishing(true);
    try {
      const result = await api("/ai/meeting-polish", { method:"POST", body:JSON.stringify({ transcript:summary, followUp }) });
      setSummary(result.summary || summary);
      setFollowUp(result.followUp || followUp);
      setNotice("סיכום הפגישה נוסח מחדש. מומלץ לעבור עליו לפני השמירה.");
    } catch (error) { setNotice(error.message); }
    finally { setPolishing(false); }
  };

  return <AppModal title="סיכום פגישה חדש" subtitle="הכתבה, ניסוח מקצועי והמשך טיפול" onClose={onClose} className="meeting-summary-modal">
    <form className="work-form meeting-summary-form" onSubmit={onSubmit}>
      <label>תאריך ושעה<input type="datetime-local" name="meetingAt" required defaultValue={localDateTimeValue()} /></label>
      <label>נוכחים<input name="attendees" placeholder="שמות מופרדים בפסיק" /></label>
      <label>שעות תכנון / ישיבה<input type="number" name="hours" min="0" max="24" step="0.25" placeholder="0" /></label>
      <section className={`wide meeting-dictation ${listening ? "listening" : ""}`}>
        <div><strong>סיכום והחלטות</strong><span>אפשר להקליד או להכתיב באופן חופשי</span></div>
        <div className="meeting-dictation-actions">
          <button type="button" className="voice-button" onClick={toggleListening}>{listening ? <Square size={15} /> : <Mic size={16} />}{listening ? "סיום הקלטה" : "הכתבה קולית"}</button>
          <button type="button" className="ai-polish-button" onClick={polish} disabled={polishing}>{polishing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}ניסוח מקצועי עם AI</button>
        </div>
        {listening && <div className="meeting-listening"><i /><i /><i /><i /><span>מאזין וממיר לטקסט…</span></div>}
        <textarea name="summary" required rows="9" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="החלטות, תובנות, נושאים שעלו והערות חופשיות…" />
        <small>ה־AI מסדר כותרות, מספור, תובנות והמשכי טיפול בלי להמציא מידע שלא נאמר.</small>
      </section>
      <label className="wide">המשך טיפול<textarea name="followUp" rows="4" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label>
      <label className="wide">תמונות ומסמכי הפגישה<input type="file" name="attachments" accept="image/*,application/pdf,.doc,.docx,.xlsx" multiple /></label>
      <div className="wide form-actions"><button type="button" className="ops-secondary" onClick={onClose}>ביטול</button><button className="ops-primary">שמירת סיכום</button></div>
    </form>
  </AppModal>;
}
