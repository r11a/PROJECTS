import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Columns2, Minus, Plus, Search } from "lucide-react";
import { ModalPortal } from "./AppModal";

const DAY = 86400000;
const midnight = (value) => new Date(value).setHours(0, 0, 0, 0);
const dateLabel = (value, long = false) => new Date(value).toLocaleDateString("he-IL", long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
const inputDate = (value) => {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};
const palette = ["#6548D7", "#087EA4", "#A85E00", "#087F5B", "#B52B59", "#315FC4"];
const scheduleColors = ["#6548D7", "#315FC4", "#087EA4", "#087F5B", "#A85E00", "#B52B59", "#C92A3A", "#495057"];
const contrastText = (hex) => {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const white = 1.05 / (luminance + 0.05);
  const black = (luminance + 0.05) / 0.05;
  return white >= black ? "#FFFFFF" : "#111318";
};
const zooms = {
  day: { label: "יום", pageDays: 14, tickDays: 1, pixelsPerDay: 68 },
  week: { label: "שבוע", pageDays: 56, tickDays: 7, pixelsPerDay: 18 },
  month: { label: "חודש", pageDays: 180, tickDays: 30, pixelsPerDay: 6 },
};
const clampScale = (value) => Math.min(2.2, Math.max(0.55, Math.round(value * 20) / 20));
const touchDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
const readWorkCalendar = () => {
  const fallback = { includeFriday: false, includeSaturday: false };
  try { return { ...fallback, ...JSON.parse(localStorage.getItem("projects:work-calendar") || "{}") }; }
  catch { return fallback; }
};
const isBlockedWorkday = (value, workCalendar) => {
  const day = new Date(value).getDay();
  return (day === 5 && !workCalendar.includeFriday) || (day === 6 && !workCalendar.includeSaturday);
};

export function GanttTimeline({ groups, query = "", onQueryChange, onOpen, onScheduleChange, users = [], title = "לוח גאנט", compact = false }) {
  const [zoom, setZoom] = useState("day");
  const [anchor, setAnchor] = useState(midnight(new Date()));
  const [collapsed, setCollapsed] = useState(new Set());
  const [tooltip, setTooltip] = useState(null);
  const [timelineFocus, setTimelineFocus] = useState(true);
  const [scale, setScale] = useState(2.2);
  const [dragging, setDragging] = useState(false);
  const [schedulePreview, setSchedulePreview] = useState({});
  const [scheduleDialog, setScheduleDialog] = useState(null);
  const [workCalendar, setWorkCalendar] = useState(readWorkCalendar);
  const scrollRef = useRef(null);
  const pendingShift = useRef(0);
  const pinch = useRef(null);
  const touchPan = useRef(null);
  const mouseDrag = useRef(null);
  const taskDrag = useRef(null);
  const blockTaskClick = useRef(false);
  const longPress = useRef(null);
  const longPressOpened = useRef(false);
  const config = zooms[zoom];
  const pixelsPerDay = config.pixelsPerDay * scale;
  const pagePixels = config.pageDays * pixelsPerDay;
  const canvasDays = config.pageDays * 5;
  const canvasWidth = canvasDays * pixelsPerDay;
  const rangeStart = anchor - config.pageDays * 2 * DAY;
  const rangeEnd = rangeStart + canvasDays * DAY;
  const dateX = (value) => canvasWidth - ((midnight(value) - rangeStart) / DAY) * pixelsPerDay;

  const rows = useMemo(() => {
    const output = [];
    groups.forEach(([name, items], groupIndex) => {
      output.push({ type: "group", key: `group-${name}`, name, items, groupIndex, height: 44 });
      if (!collapsed.has(name)) items.forEach((item) => output.push({ type: "item", key: `${name}-${item.kind}-${item.id}`, name, item, groupIndex, height: 64 }));
    });
    let top = 0;
    return output.map((row) => { const result = { ...row, top }; top += row.height; return result; });
  }, [groups, collapsed]);
  const bodyHeight = rows.reduce((sum, row) => sum + row.height, 0);
  const itemRows = rows.filter((row) => row.type === "item");
  const rowById = new Map(itemRows.map((row) => [`${row.name}-${row.item.id}`, row]));
  const dependencies = itemRows.flatMap((row) => {
    const dependencyId = row.item.dependency_task_id;
    if (!dependencyId) return [];
    const source = rowById.get(`${row.name}-${dependencyId}`);
    if (!source) return [];
    const sourceX = dateX(midnight(source.item.end) + DAY);
    const targetX = dateX(row.item.start);
    const sourceY = source.top + 32;
    const targetY = row.top + 32;
    const bendX = Math.min(sourceX - 22, (sourceX + targetX) / 2);
    return [{ key: `${row.name}-${dependencyId}-${row.item.id}`, d: `M ${sourceX} ${sourceY} C ${bendX} ${sourceY}, ${bendX} ${targetY}, ${targetX} ${targetY}` }];
  });
  const ticks = Array.from({ length: Math.floor(canvasDays / config.tickDays) + 1 }, (_, index) => {
    const value = rangeStart + index * config.tickDays * DAY;
    return { value, left: canvasWidth - index * config.tickDays * pixelsPerDay };
  });
  const todayLeft = dateX(new Date());

  const centerTimeline = (behavior = "auto") => {
    scrollRef.current?.scrollTo({ left: pagePixels * 3 - Math.max(0, (scrollRef.current.clientWidth - pagePixels) / 2), behavior });
  };
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    if (pendingShift.current) {
      scrollRef.current.scrollLeft += pendingShift.current * pagePixels;
      pendingShift.current = 0;
    } else centerTimeline();
  }, [anchor, zoom, scale]);
  const shiftAnchor = (direction) => {
    pendingShift.current = 0;
    setAnchor((current) => current + direction * config.pageDays * DAY);
  };
  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element || pendingShift.current) return;
    if (element.scrollLeft < pagePixels * 0.75) {
      pendingShift.current = 1;
      setAnchor((current) => current + config.pageDays * DAY);
    } else if (element.scrollLeft > pagePixels * 3.25) {
      pendingShift.current = -1;
      setAnchor((current) => current - config.pageDays * DAY);
    }
  };
  const chooseZoom = (value) => {
    pendingShift.current = 0;
    setZoom(value);
  };
  const changeScale = (delta) => setScale((current) => clampScale(current + delta));
  useEffect(() => () => {
    if (longPress.current) clearTimeout(longPress.current);
  }, []);
  useEffect(() => {
    const refresh = () => setWorkCalendar(readWorkCalendar());
    window.addEventListener("projects:work-calendar-changed", refresh);
    return () => window.removeEventListener("projects:work-calendar-changed", refresh);
  }, []);
  const openScheduleDialog = (item, extra = {}) => setScheduleDialog({
    item,
    startDate: inputDate(item.start),
    dueDate: inputDate(item.end),
    color: item.color || palette[0],
    critical: Boolean(item.critical),
    mentionUserIds: [],
    ...extra,
  });
  const startPinch = (event) => {
    if (event.touches.length === 2) {
      touchPan.current = null;
      pinch.current = { distance: touchDistance(event.touches), scale };
    } else if (event.touches.length === 1 && scrollRef.current) {
      const touch = event.touches[0];
      touchPan.current = { x: touch.clientX, y: touch.clientY, left: scrollRef.current.scrollLeft };
    }
  };
  const movePinch = (event) => {
    if (event.touches.length === 2 && pinch.current) {
      event.preventDefault();
      setScale(clampScale(pinch.current.scale * (touchDistance(event.touches) / pinch.current.distance)));
      return;
    }
    if (event.touches.length !== 1 || !touchPan.current || !scrollRef.current) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchPan.current.x;
    const deltaY = touch.clientY - touchPan.current.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < 4) return;
    event.preventDefault();
    scrollRef.current.scrollLeft = touchPan.current.left - deltaX;
  };
  const endPinch = (event) => {
    if (event.touches.length < 2) pinch.current = null;
    if (!event.touches.length) touchPan.current = null;
  };
  const wheelZoom = (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      changeScale(event.deltaY < 0 ? 0.1 : -0.1);
    } else if ((event.shiftKey || event.deltaX) && scrollRef.current) {
      event.preventDefault();
      const delta = event.deltaX || event.deltaY;
      // The RTL time axis advances toward the left; horizontal input follows its visual motion.
      scrollRef.current.scrollLeft -= delta;
    }
  };
  const startMouseDrag = (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || event.target.closest("button")) return;
    mouseDrag.current = { pointerId: event.pointerId, x: event.clientX, left: scrollRef.current.scrollLeft };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const moveMouseDrag = (event) => {
    if (!mouseDrag.current || mouseDrag.current.pointerId !== event.pointerId) return;
    scrollRef.current.scrollLeft = mouseDrag.current.left - (event.clientX - mouseDrag.current.x);
  };
  const endMouseDrag = (event) => {
    if (!mouseDrag.current || mouseDrag.current.pointerId !== event.pointerId) return;
    mouseDrag.current = null;
    setDragging(false);
  };
  const beginTaskDrag = (event, item, mode) => {
    if (!onScheduleChange || event.pointerType === "touch" && event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    const captureTarget = event.currentTarget;
    taskDrag.current = { pointerId:event.pointerId, item, mode, x:event.clientX, start:midnight(item.start), end:midnight(item.end), moved:false };
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = setTimeout(() => {
      if (!taskDrag.current || taskDrag.current.pointerId !== event.pointerId) return;
      taskDrag.current = null;
      longPress.current = null;
      longPressOpened.current = true;
      blockTaskClick.current = true;
      openScheduleDialog(item, { source: "long-press" });
    }, 560);
    captureTarget.setPointerCapture(event.pointerId);
  };
  const moveTaskDrag = (event) => {
    const drag = taskDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const days = -Math.round((event.clientX - drag.x) / pixelsPerDay);
    if (Math.abs(event.clientX - drag.x) > 6 && longPress.current) { clearTimeout(longPress.current); longPress.current=null; }
    if (!days && !drag.moved) return;
    drag.moved = true;
    let start = drag.start;
    let end = drag.end;
    if (drag.mode === "move") { start += days * DAY; end += days * DAY; }
    if (drag.mode === "start") start = Math.min(end, drag.start + days * DAY);
    if (drag.mode === "end") end = Math.max(start, drag.end + days * DAY);
    drag.preview = { start, end };
    setSchedulePreview((current) => ({ ...current, [`${drag.item.kind}-${drag.item.id}`]:{ start, end } }));
  };
  const endTaskDrag = async (event) => {
    const drag = taskDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      if (longPress.current) { clearTimeout(longPress.current); longPress.current=null; }
      if (longPressOpened.current) {
        longPressOpened.current = false;
        setTimeout(() => { blockTaskClick.current = false; }, 160);
      } else requestAnimationFrame(()=>{blockTaskClick.current=false;});
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    taskDrag.current = null;
    if (longPress.current) { clearTimeout(longPress.current); longPress.current=null; }
    blockTaskClick.current = drag.moved;
    const key = `${drag.item.kind}-${drag.item.id}`;
    const preview = drag.preview;
    if (drag.moved && preview) openScheduleDialog(drag.item, {
      source: "drag",
      changeType: drag.mode,
      startDate: inputDate(preview.start),
      dueDate: inputDate(preview.end),
    });
    setSchedulePreview((current) => { const next={...current}; delete next[key]; return next; });
    requestAnimationFrame(() => { blockTaskClick.current = false; });
  };
  const saveScheduleDialog = async (event) => {
    event.preventDefault();
    if (!scheduleDialog) return;
    if (scheduleDialog.startDate > scheduleDialog.dueDate) return;
    if (isBlockedWorkday(`${scheduleDialog.startDate}T12:00:00`, workCalendar) || isBlockedWorkday(`${scheduleDialog.dueDate}T12:00:00`, workCalendar)) {
      alert("לא ניתן לתזמן משימה ביום שאינו יום עבודה. ניתן לשנות זאת בהגדרות המערכת.");
      return;
    }
    if (typeof onScheduleChange === "function") await onScheduleChange(scheduleDialog.item, { startDate:scheduleDialog.startDate, dueDate:scheduleDialog.dueDate, color:scheduleDialog.color, critical:scheduleDialog.critical, mentionUserIds:scheduleDialog.mentionUserIds });
    setScheduleDialog(null);
  };
  const adjustDialogDuration = (days) => setScheduleDialog((current) => {
    if (!current) return current;
    const nextEnd=midnight(`${current.dueDate}T12:00:00`)+days*DAY;
    const minimum=midnight(`${current.startDate}T12:00:00`);
    return { ...current, dueDate:inputDate(Math.max(minimum,nextEnd)) };
  });
  const goToday = () => {
    pendingShift.current = 0;
    setAnchor(midnight(new Date()));
    requestAnimationFrame(() => centerTimeline("smooth"));
  };
  const goDate = (value) => {
    if (!value) return;
    pendingShift.current = 0;
    setAnchor(midnight(`${value}T12:00:00`));
  };
  const toggleGroup = (name) => setCollapsed((current) => { const next = new Set(current); next.has(name) ? next.delete(name) : next.add(name); return next; });

  return (
    <section className={`cg-shell ${compact ? "compact" : ""} ${timelineFocus ? "timeline-focus" : "timeline-details"}`}>
      <header className="cg-toolbar">
        <div className="cg-title"><CalendarDays size={18} /><span><strong>{title}</strong><small>{dateLabel(anchor, true)} · תצוגת {config.label}</small></span></div>
        {onQueryChange && <label className="cg-search"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="חיפוש פרויקט או משימה" /></label>}
        <div className="cg-zoom">{Object.entries(zooms).map(([value, item]) => <button type="button" className={zoom === value ? "active" : ""} onClick={() => chooseZoom(value)} key={value}>{item.label}</button>)}</div>
        <div className="cg-scale" aria-label="שינוי רוחב מרווח הזמן"><button type="button" onClick={() => changeScale(-0.15)} disabled={scale <= 0.55} title="צמצום מרווח הזמן"><Minus size={15} /></button><output>{Math.round(scale * 100)}%</output><button type="button" onClick={() => changeScale(0.15)} disabled={scale >= 2.2} title="הרחבת מרווח הזמן"><Plus size={15} /></button></div>
        <div className="cg-navigation">
          <button type="button" onClick={() => shiftAnchor(-1)} title="תקופה קודמת"><ChevronRight size={17} /></button>
          <button type="button" className="today" onClick={goToday}>היום</button>
          <button type="button" onClick={() => shiftAnchor(1)} title="תקופה הבאה"><ChevronLeft size={17} /></button>
          <input aria-label="מעבר לתאריך" type="date" value={inputDate(anchor)} onChange={(event) => goDate(event.target.value)} />
        </div>
        <button type="button" className="cg-mobile-toggle" onClick={() => setTimelineFocus((current) => !current)} aria-pressed={timelineFocus}><Columns2 size={16} />{timelineFocus ? "פרטים" : "ציר מלא"}</button>
      </header>
      <div className="cg-board" style={{ "--body-height": `${bodyHeight}px` }}>
        <div className="cg-labels">
          <div className="cg-label-head">פרויקט / משימה</div>
          {rows.map((row) => row.type === "group" ? (
            <button type="button" className="cg-group-label" style={{ height: row.height }} key={row.key} onClick={() => toggleGroup(row.name)}><i style={{ background: palette[row.groupIndex % palette.length] }} /><strong>{row.name}</strong><em>{row.items.length}</em>{collapsed.has(row.name) ? <ChevronLeft /> : <ChevronDown />}</button>
          ) : (
            <button type="button" className="cg-item-label" style={{ height: row.height }} key={row.key} onClick={() => onOpen?.(row.item)}><span className="cg-avatar" style={{ background: row.item.assignee_color || palette[row.groupIndex % palette.length] }}>{(row.item.assignee_name || row.item.owner_name || "?").slice(0, 2)}</span><span><strong>{row.item.title}</strong><small>{row.item.assignee_name || row.item.owner_name || "לא הוקצה"} · {dateLabel(row.item.start)}–{dateLabel(row.item.end)}</small>{row.item.dependency_title && <em>תלויה ב: {row.item.dependency_title}</em>}</span></button>
          ))}
        </div>
        <div className={`cg-scroll ${dragging ? "dragging" : ""}`} ref={scrollRef} onScroll={handleScroll} onTouchStart={startPinch} onTouchMove={movePinch} onTouchEnd={endPinch} onTouchCancel={endPinch} onWheel={wheelZoom} onPointerDown={startMouseDrag} onPointerMove={moveMouseDrag} onPointerUp={endMouseDrag} onPointerCancel={endMouseDrag}>
          <div className="cg-canvas" style={{ width: canvasWidth }}>
            <div className="cg-ruler">{ticks.map((tick) => <span key={tick.value} style={{ left: tick.left }}>{dateLabel(tick.value, zoom === "day")}</span>)}</div>
            <div className="cg-body" style={{ height: bodyHeight, "--grid": `${config.tickDays * pixelsPerDay}px` }}>
              {Array.from({ length: canvasDays }, (_, index) => {
                const value = rangeStart + index * DAY;
                return isBlockedWorkday(value, workCalendar) ? <i className="cg-non-working-day" key={value} style={{ left: canvasWidth - (index + 1) * pixelsPerDay, width: pixelsPerDay }} /> : null;
              })}
              {todayLeft >= 0 && todayLeft <= canvasWidth && <div className="cg-today-line" style={{ left: todayLeft }}><span>היום</span></div>}
              <svg className="cg-dependencies" width={canvasWidth} height={bodyHeight} viewBox={`0 0 ${canvasWidth} ${bodyHeight}`} preserveAspectRatio="none"><defs><marker id="cg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{dependencies.map((line) => <path key={line.key} d={line.d} markerEnd="url(#cg-arrow)" />)}</svg>
              {rows.map((row) => {
                if (row.type === "group") {
                  const starts = row.items.map((item) => midnight(item.start));
                  const ends = row.items.map((item) => midnight(item.end));
                  const left = dateX(Math.max(...ends) + DAY);
                  const width = ((Math.max(...ends) - Math.min(...starts)) / DAY + 1) * pixelsPerDay;
                  return <div className="cg-group-row" key={row.key} style={{ top: row.top, height: row.height }}><i style={{ left, width, background: palette[row.groupIndex % palette.length] }} /></div>;
                }
                const item = row.item;
                const preview = schedulePreview[`${item.kind}-${item.id}`];
                const itemStart = preview?.start ?? midnight(item.start);
                const itemEnd = preview?.end ?? midnight(item.end);
                const color = item.critical ? "#C92A3A" : item.color || (item.status === "done" || item.status === "completed" ? "#087F5B" : palette[row.groupIndex % palette.length]);
                const exactLeft = dateX(itemEnd + DAY);
                const exactWidth = Math.max(10, ((itemEnd - itemStart) / DAY + 1) * pixelsPerDay);
                const renderWidth = item.kind === "milestone" ? 28 : Math.max(34, exactWidth);
                const left = exactLeft - Math.max(0, (renderWidth - exactWidth) / 2);
                const visible = left + renderWidth >= 0 && left <= canvasWidth;
                if (!visible) return <div className="cg-item-row" key={row.key} style={{ top: row.top, height: row.height }} />;
                return <div className="cg-item-row" key={row.key} style={{ top: row.top, height: row.height }}><button type="button" className={`cg-bar ${item.kind} ${item.critical ? "critical" : ""} ${preview ? "editing-schedule" : ""}`} style={{ left, width: renderWidth, background: color, color: contrastText(color) }} onClick={() => { if (!blockTaskClick.current) onOpen?.(item); }} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();openScheduleDialog(item,{source:"context"})}} onPointerDown={(event)=>beginTaskDrag(event,item,"move")} onPointerMove={moveTaskDrag} onPointerUp={endTaskDrag} onPointerCancel={endTaskDrag} onMouseMove={(event) => !taskDrag.current && setTooltip({ item, x: event.clientX, y: event.clientY })} onMouseLeave={() => setTooltip(null)} aria-label={`פתיחת ${item.title}`}>{item.kind === "milestone" ? <i /> : <><i className="cg-resize start" onPointerDown={(event)=>beginTaskDrag(event,item,"start")}/><span>{item.title}</span><i className="cg-resize end" onPointerDown={(event)=>beginTaskDrag(event,item,"end")}/></>}</button></div>;
              })}
            </div>
          </div>
        </div>
      </div>
      <footer className="cg-legend"><span><i className="active" />משימה פעילה</span><span><i className="done" />הושלמה</span><span><i className="critical" />נתיב קריטי</span><small>גרירה אופקית עם העכבר · Shift + גלגלת · לחיצה פותחת משימה</small></footer>
      {scheduleDialog && <ModalPortal><div className="cg-dialog-backdrop"><form className="cg-schedule-dialog" onSubmit={saveScheduleDialog} onMouseDown={(event)=>event.stopPropagation()} dir="rtl"><header><div><small>עריכה מהירה מהגאנט</small><h3>{scheduleDialog.item.title}</h3></div><button type="button" onClick={()=>setScheduleDialog(null)}>×</button></header><div><label>הזז לתאריך<input type="date" value={scheduleDialog.startDate} onChange={(event)=>{const oldStart=midnight(scheduleDialog.startDate);const oldEnd=midnight(scheduleDialog.dueDate);const next=midnight(`${event.target.value}T12:00:00`);setScheduleDialog({...scheduleDialog,startDate:event.target.value,dueDate:inputDate(next+(oldEnd-oldStart))})}}/></label>{scheduleDialog.item.kind !== "milestone" && <><label>שנה פרק זמן עד<input type="date" min={scheduleDialog.startDate} value={scheduleDialog.dueDate} onChange={(event)=>setScheduleDialog({...scheduleDialog,dueDate:event.target.value})}/></label><div className="cg-duration-stepper"><span>משך מהיר</span><button type="button" onClick={()=>adjustDialogDuration(-1)} disabled={scheduleDialog.startDate===scheduleDialog.dueDate}><Minus size={15}/>הורדת יום</button><button type="button" onClick={()=>adjustDialogDuration(1)}><Plus size={15}/>הוספת יום</button></div><label className="cg-critical-toggle"><input type="checkbox" checked={scheduleDialog.critical} onChange={(event)=>setScheduleDialog({...scheduleDialog,critical:event.target.checked})}/><span><b>משימה קריטית</b><small>סימון לנתיב הקריטי והצגה קבועה באדום</small></span></label></>}{scheduleDialog.critical?<div className="cg-critical-color"><i/>משימה קריטית מוצגת תמיד באדום</div>:<div className="cg-color-picker"><span>צבע המשימה</span><div>{scheduleColors.map(color=><button type="button" key={color} className={scheduleDialog.color.toUpperCase()===color?"active":""} style={{background:color}} onClick={()=>setScheduleDialog({...scheduleDialog,color})} aria-label={`בחירת צבע ${color}`}/>)}</div><label>צבע מותאם<input type="color" value={scheduleDialog.color} onChange={(event)=>setScheduleDialog({...scheduleDialog,color:event.target.value})}/></label></div>}{users.length>0&&<div className="cg-mention-picker"><span>תיוג משתמשים</span><div>{users.filter(item=>item.active!==false).map(item=>{const selected=scheduleDialog.mentionUserIds.includes(item.id);return <button type="button" className={selected?'selected':''} key={item.id} onClick={()=>setScheduleDialog({...scheduleDialog,mentionUserIds:selected?scheduleDialog.mentionUserIds.filter(id=>id!==item.id):[...scheduleDialog.mentionUserIds,item.id]})}><i style={{background:item.avatarColor||'#6957df'}}>{item.displayName?.slice(0,2)}</i>@{item.displayName}</button>})}</div><small>ההתראה תישלח רק לאחר אישור ושמירה</small></div>}</div><footer><button type="button" onClick={()=>setScheduleDialog(null)}>ביטול</button><button className="primary" type="submit">אישור ושמירה</button></footer></form></div></ModalPortal>}
      {tooltip && <div className="cg-tooltip" style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 285), top: Math.max(12, tooltip.y - 94) }}><strong>{tooltip.item.title}</strong><span>{dateLabel(tooltip.item.start, true)} — {dateLabel(tooltip.item.end, true)}</span><span>{tooltip.item.assignee_name || tooltip.item.owner_name || "ללא אחראי"} · {tooltip.item.status || "ללא סטטוס"}</span>{tooltip.item.dependency_title && <em>תלויה ב: {tooltip.item.dependency_title}</em>}</div>}
    </section>
  );
}
