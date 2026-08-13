import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

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

export function GanttTimeline({ groups, query = "", onQueryChange, onOpen, title = "לוח גאנט", compact = false }) {
  const [zoom, setZoom] = useState("week");
  const [anchor, setAnchor] = useState(midnight(new Date()));
  const [collapsed, setCollapsed] = useState(new Set());
  const [tooltip, setTooltip] = useState(null);
  const scrollRef = useRef(null);
  const pendingShift = useRef(0);
  const config = zooms[zoom];
  const pagePixels = config.pageDays * config.pixelsPerDay;
  const canvasDays = config.pageDays * 5;
  const canvasWidth = canvasDays * config.pixelsPerDay;
  const rangeStart = anchor - config.pageDays * 2 * DAY;
  const rangeEnd = rangeStart + canvasDays * DAY;

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
    const sourceX = ((midnight(source.item.end) - rangeStart) / DAY + 1) * config.pixelsPerDay;
    const targetX = ((midnight(row.item.start) - rangeStart) / DAY) * config.pixelsPerDay;
    const sourceY = source.top + 32;
    const targetY = row.top + 32;
    const bendX = Math.max(sourceX + 22, (sourceX + targetX) / 2);
    return [{ key: `${row.name}-${dependencyId}-${row.item.id}`, d: `M ${sourceX} ${sourceY} C ${bendX} ${sourceY}, ${bendX} ${targetY}, ${targetX} ${targetY}` }];
  });
  const ticks = Array.from({ length: Math.floor(canvasDays / config.tickDays) + 1 }, (_, index) => {
    const value = rangeStart + index * config.tickDays * DAY;
    return { value, left: index * config.tickDays * config.pixelsPerDay };
  });
  const todayLeft = ((midnight(new Date()) - rangeStart) / DAY) * config.pixelsPerDay;

  const centerTimeline = (behavior = "auto") => {
    scrollRef.current?.scrollTo({ left: pagePixels * 2 - Math.max(0, (scrollRef.current.clientWidth - pagePixels) / 2), behavior });
  };
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    if (pendingShift.current) {
      scrollRef.current.scrollLeft -= pendingShift.current * pagePixels;
      pendingShift.current = 0;
    } else centerTimeline();
  }, [anchor, zoom]);
  const shiftAnchor = (direction) => {
    pendingShift.current = 0;
    setAnchor((current) => current + direction * config.pageDays * DAY);
  };
  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element || pendingShift.current) return;
    if (element.scrollLeft < pagePixels * 0.75) {
      pendingShift.current = -1;
      setAnchor((current) => current - config.pageDays * DAY);
    } else if (element.scrollLeft > pagePixels * 3.25) {
      pendingShift.current = 1;
      setAnchor((current) => current + config.pageDays * DAY);
    }
  };
  const chooseZoom = (value) => {
    pendingShift.current = 0;
    setZoom(value);
  };
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
    <section className={`cg-shell ${compact ? "compact" : ""}`}>
      <header className="cg-toolbar">
        <div className="cg-title"><CalendarDays size={18} /><span><strong>{title}</strong><small>{dateLabel(anchor, true)} · תצוגת {config.label}</small></span></div>
        {onQueryChange && <label className="cg-search"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="חיפוש פרויקט או משימה" /></label>}
        <div className="cg-zoom">{Object.entries(zooms).map(([value, item]) => <button type="button" className={zoom === value ? "active" : ""} onClick={() => chooseZoom(value)} key={value}>{item.label}</button>)}</div>
        <div className="cg-navigation">
          <button type="button" onClick={() => shiftAnchor(-1)} title="תקופה קודמת"><ChevronRight size={17} /></button>
          <button type="button" className="today" onClick={goToday}>היום</button>
          <button type="button" onClick={() => shiftAnchor(1)} title="תקופה הבאה"><ChevronLeft size={17} /></button>
          <input aria-label="מעבר לתאריך" type="date" value={inputDate(anchor)} onChange={(event) => goDate(event.target.value)} />
        </div>
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
        <div className="cg-scroll" ref={scrollRef} onScroll={handleScroll}>
          <div className="cg-canvas" style={{ width: canvasWidth }}>
            <div className="cg-ruler">{ticks.map((tick) => <span key={tick.value} style={{ left: tick.left }}>{dateLabel(tick.value, zoom === "day")}</span>)}</div>
            <div className="cg-body" style={{ height: bodyHeight, "--grid": `${config.tickDays * config.pixelsPerDay}px` }}>
              {todayLeft >= 0 && todayLeft <= canvasWidth && <div className="cg-today-line" style={{ left: todayLeft }}><span>היום</span></div>}
              <svg className="cg-dependencies" width={canvasWidth} height={bodyHeight} viewBox={`0 0 ${canvasWidth} ${bodyHeight}`} preserveAspectRatio="none"><defs><marker id="cg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>{dependencies.map((line) => <path key={line.key} d={line.d} markerEnd="url(#cg-arrow)" />)}</svg>
              {rows.map((row) => {
                if (row.type === "group") {
                  const starts = row.items.map((item) => midnight(item.start));
                  const ends = row.items.map((item) => midnight(item.end));
                  const left = ((Math.min(...starts) - rangeStart) / DAY) * config.pixelsPerDay;
                  const width = ((Math.max(...ends) - Math.min(...starts)) / DAY + 1) * config.pixelsPerDay;
                  return <div className="cg-group-row" key={row.key} style={{ top: row.top, height: row.height }}><i style={{ left, width, background: palette[row.groupIndex % palette.length] }} /></div>;
                }
                const item = row.item;
                const color = item.critical ? "#C92A3A" : item.status === "done" || item.status === "completed" ? "#087F5B" : palette[row.groupIndex % palette.length];
                const left = ((midnight(item.start) - rangeStart) / DAY) * config.pixelsPerDay;
                const exactWidth = Math.max(10, ((midnight(item.end) - midnight(item.start)) / DAY + 1) * config.pixelsPerDay);
                const visible = left + exactWidth >= 0 && left <= canvasWidth;
                if (!visible) return <div className="cg-item-row" key={row.key} style={{ top: row.top, height: row.height }} />;
                return <div className="cg-item-row" key={row.key} style={{ top: row.top, height: row.height }}><button type="button" className={`cg-bar ${item.kind} ${item.critical ? "critical" : ""}`} style={{ left, width: item.kind === "milestone" ? 22 : exactWidth, background: color, color: contrastText(color) }} onClick={() => onOpen?.(item)} onMouseMove={(event) => setTooltip({ item, x: event.clientX, y: event.clientY })} onMouseLeave={() => setTooltip(null)} aria-label={`פתיחת ${item.title}`}>{item.kind === "milestone" ? <i /> : <span>{item.title}</span>}</button></div>;
              })}
            </div>
          </div>
        </div>
      </div>
      <footer className="cg-legend"><span><i className="active" />משימה פעילה</span><span><i className="done" />הושלמה</span><span><i className="critical" />נתיב קריטי</span><small>גלילה רציפה · לחיצה פותחת משימה · ריחוף מציג פרטים</small></footer>
      {tooltip && <div className="cg-tooltip" style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 285), top: Math.max(12, tooltip.y - 94) }}><strong>{tooltip.item.title}</strong><span>{dateLabel(tooltip.item.start, true)} — {dateLabel(tooltip.item.end, true)}</span><span>{tooltip.item.assignee_name || tooltip.item.owner_name || "ללא אחראי"} · {tooltip.item.status || "ללא סטטוס"}</span>{tooltip.item.dependency_title && <em>תלויה ב: {tooltip.item.dependency_title}</em>}</div>}
    </section>
  );
}
