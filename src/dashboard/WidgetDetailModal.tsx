import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type WidgetDetailModalProps = {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  tone?: "default" | "alert";
  returnFocusTo?: HTMLElement | null;
  children: ReactNode;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

// Panel de detalle accesible: hoja inferior casi completa en móvil y modal centrado en PC.
// Se renderiza en document.body mediante portal para evitar que transform de useFitToViewport afecte a position: fixed.
export function WidgetDetailModal({
  open,
  onClose,
  eyebrow,
  title,
  tone = "default",
  returnFocusTo,
  children,
}: WidgetDetailModalProps): JSX.Element | null {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    const prevActive = (returnFocusTo ?? document.activeElement) as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusTimer = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);

        if (focusables.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !panelRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else if (
          document.activeElement === last ||
          !panelRef.current.contains(document.activeElement)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (prevActive && typeof prevActive.focus === "function" && prevActive.isConnected) {
        prevActive.focus();
      }
    };
  }, [open, returnFocusTo]);

  if (!open || typeof document === "undefined") return null;

  const modalNode = (
    <div
      className="dbx-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`dbx-modal-panel${tone === "alert" ? " dbx-modal-alert" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dbx-modal-grabber" aria-hidden="true" />
        <header className="dbx-modal-head">
          <div className="dbx-modal-titles">
            <p className="dbx-eyebrow dbx-modal-eyebrow">{eyebrow}</p>
            <h2 id={titleId} className="dbx-modal-title">
              {title}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="dbx-modal-close"
            aria-label="Close details"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="dbx-modal-body">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}
