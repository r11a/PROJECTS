import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

let openPortalCount = 0;
let pageOverflowBeforeFirstPortal = "";
const dialogStack = [];
const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

export function AppModal({ title, subtitle = "", onClose, children, className = "", closeOnBackdrop = true, busy = false, protectChanges = true, hasChanges = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = () => {
    if (busy) return;
    if (protectChanges && (dirty || hasChanges)) setConfirmClose(true);
    else onClose?.();
  };
  useEffect(() => {
    if (!(dirty || hasChanges) || !protectChanges) return;
    const preventLoss = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty, hasChanges, protectChanges]);
  // Capture before React's autoFocus moves focus into the newly mounted form.
  const returnFocusRef = useRef(document.activeElement);
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = returnFocusRef.current;
    dialogStack.push(dialog);
    const focusables = () => [...dialog.querySelectorAll(focusableSelector)].filter(element => element.getClientRects().length && !element.closest('[inert]'));
    (dialog.querySelector('[autofocus]') || focusables()[0] || dialog).focus();
    const onKeyDown = (event) => {
      if (dialogStack.at(-1) !== dialog) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current?.(); }
      if (event.key === "Tab") {
        const elements = focusables();
        const first = elements[0] || dialog;
        const last = elements.at(-1) || dialog;
        if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last) || !elements.length) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    };
    const onFocus = event => { if (dialogStack.at(-1) === dialog && !dialog.contains(event.target)) (focusables()[0] || dialog).focus(); };
    const onFormChange = event => { if (event.target.closest('form') && event.target.closest('[role="dialog"]') === dialog) setDirty(true); };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocus);
    dialog.addEventListener('projects:form-changed', onFormChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocus);
      dialog.removeEventListener('projects:form-changed', onFormChange);
      const wasTop = dialogStack.at(-1) === dialog;
      dialogStack.splice(dialogStack.indexOf(dialog), 1);
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <ModalPortal>
      <div className={`modal-backdrop app-modal-backdrop ${className ? `${className}-backdrop` : ""}`.trim()} onMouseDown={() => closeOnBackdrop && requestClose()}>
        <section ref={dialogRef} tabIndex={-1} className={`modal work-modal app-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} onMouseDown={(event) => event.stopPropagation()} onChangeCapture={event=>{if(event.target.closest('form') && event.target.closest('[role="dialog"]')===dialogRef.current && !event.target.closest('[data-no-dirty]'))setDirty(true);}} onClickCapture={event=>{const button=event.target.closest('button');if(button?.type==='button' && button.textContent.trim()==='ביטול' && button.closest('.form-actions,.modal-actions,.ops-modal-actions') && button.closest('[role="dialog"]')===dialogRef.current){event.preventDefault();event.stopPropagation();requestClose();}}} dir="rtl">
          <header className="modal-head app-modal-head">
            <div>
              {subtitle && <span>{subtitle}</span>}
              <h2 id={titleId}>{title}</h2>
            </div>
            <button type="button" className="app-modal-close" disabled={busy} onClick={requestClose} aria-label="סגירת החלון" title="סגירה">
              <X size={21} />
            </button>
          </header>
          {confirmClose&&<div className="unsaved-changes" role="alert"><strong>יש שינויים שלא נשמרו</strong><div><button type="button" className="primary-button" onClick={()=>setConfirmClose(false)}>המשך עריכה</button><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>יציאה ללא שמירה</button></div></div>}
          <div className="app-modal-content">{children}</div>
        </section>
      </div>
    </ModalPortal>
  );
}
