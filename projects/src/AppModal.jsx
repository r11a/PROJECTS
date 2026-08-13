import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ModalPortal({ children }) {
  return createPortal(children, document.body);
}

export function AppModal({ title, subtitle = "", onClose, children, className = "", closeOnBackdrop = true }) {
  const titleId = useId();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
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
