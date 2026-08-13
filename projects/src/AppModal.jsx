import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

let openPortalCount = 0;
let pageOverflowBeforeFirstPortal = "";

export function ModalPortal({ children }) {
  useEffect(() => {
    if (openPortalCount === 0) {
      pageOverflowBeforeFirstPortal = document.body.style.overflow;
    }
    openPortalCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      openPortalCount = Math.max(0, openPortalCount - 1);
      if (openPortalCount === 0) {
        document.body.style.overflow = pageOverflowBeforeFirstPortal;
      }
    };
  }, []);
  return createPortal(children, document.body);
}

export function AppModal({ title, subtitle = "", onClose, children, className = "", closeOnBackdrop = true }) {
  const titleId = useId();
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <ModalPortal>
      <div className={`modal-backdrop app-modal-backdrop ${className ? `${className}-backdrop` : ""}`.trim()} onMouseDown={() => closeOnBackdrop && onClose?.()}>
        <section className={`modal work-modal app-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()} dir="rtl">
          <header className="modal-head app-modal-head">
            <div>
              {subtitle && <span>{subtitle}</span>}
              <h2 id={titleId}>{title}</h2>
            </div>
            <button type="button" className="app-modal-close" onClick={onClose} aria-label="סגירת החלון" title="סגירה">
              <X size={21} />
            </button>
          </header>
          <div className="app-modal-content">{children}</div>
        </section>
      </div>
    </ModalPortal>
  );
}
