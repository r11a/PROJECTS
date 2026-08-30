import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import "./mobile-action-menu.css";

export function MobileActionMenu({ label = "פעולות", children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 12 });
  const anchorRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const width = Math.min(252, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, anchor.right - width));
    const estimatedHeight = Math.min(260, menuRef.current?.offsetHeight || 180);
    const top = anchor.bottom + estimatedHeight + 12 > window.innerHeight
      ? Math.max(12, anchor.top - estimatedHeight - 8)
      : anchor.bottom + 8;
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!menuRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => event.key === "Escape" && setOpen(false);
    const viewportChanged = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", viewportChanged);
    window.addEventListener("scroll", viewportChanged, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", viewportChanged);
      window.removeEventListener("scroll", viewportChanged, true);
    };
  }, [open]);

  return <>
    <button ref={anchorRef} type="button" className="mobile-action-trigger" aria-label={label} aria-expanded={open} onClick={() => setOpen(value => !value)}><MoreHorizontal size={21} /></button>
    {open && createPortal(<div ref={menuRef} className="mobile-action-popover" role="menu" dir="rtl" style={position}>{children}</div>, document.body)}
  </>;
}
