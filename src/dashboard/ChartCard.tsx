import { useRef, type MouseEvent, type ReactNode } from "react";

export type WidgetSize = "small" | "medium" | "large";

export type WidgetCardProps = {
  size: WidgetSize;
  eyebrow: string;
  headline?: ReactNode;
  badge?: ReactNode;
  support?: ReactNode;
  footerAction?: ReactNode;
  children?: ReactNode;
  onOpen: (triggerEl: HTMLElement | null) => void;
  tone?: "default" | "alert";
  className?: string;
  ariaLabel?: string;
};

// Tarjeta de widget estilo iOS: blanca, radio 28px, plana con anillo sutil de 1px y sin scroll interno.
// Toda la superficie abre el detalle, salvo los botones internos (como "Pick your first step").
export function WidgetCard({
  size,
  eyebrow,
  headline,
  badge,
  support,
  footerAction,
  children,
  onOpen,
  tone = "default",
  className,
  ariaLabel,
}: WidgetCardProps): JSX.Element {
  const detailsBtnRef = useRef<HTMLButtonElement>(null);

  const handleSurfaceClick = (e: MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, select, textarea")) return;
    onOpen(detailsBtnRef.current);
  };

  const sizeClass = `dbx-w-${size}`;
  const toneClass = tone === "alert" ? " dbx-w-alert" : "";
  const extraClass = className ? ` ${className}` : "";

  return (
    <article
      className={`dbx-widget ${sizeClass}${toneClass}${extraClass}`}
      onClick={handleSurfaceClick}
    >
      <div className="dbx-w-head">
        <p className="dbx-eyebrow dbx-w-eyebrow">{eyebrow}</p>
        <div className="dbx-w-head-right">
          {badge && <div className="dbx-w-badge">{badge}</div>}
          <button
            ref={detailsBtnRef}
            type="button"
            className="dbx-w-details"
            aria-label={ariaLabel ? `Details: ${ariaLabel}` : `Details for ${eyebrow}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(e.currentTarget);
            }}
          >
            <span className="dbx-w-details-text">Details</span>
            <svg className="dbx-w-chev" viewBox="0 0 8 14" aria-hidden="true">
              <path d="M1.5 1.5 6.5 7l-5 5.5" fill="none" />
            </svg>
          </button>
        </div>
      </div>

      {headline && <div className="dbx-w-headline">{headline}</div>}

      {children && <div className="dbx-w-visual">{children}</div>}

      {(support || footerAction) && (
        <div className="dbx-w-foot">
          {support && (
            <p
              className="dbx-w-support"
              title={typeof support === "string" ? support : undefined}
            >
              {support}
            </p>
          )}
          {footerAction && <div className="dbx-w-actions">{footerAction}</div>}
        </div>
      )}
    </article>
  );
}
