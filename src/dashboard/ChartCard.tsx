import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type ChartCardProps = {
  eyebrow: string;
  title?: string;
  takeaway: ReactNode;
  children?: ReactNode;
  more?: ReactNode;
  moreLabel?: string;
  className?: string;
  tone?: "default" | "alert";
  badge?: ReactNode;
};

// Mismo corte que el CSS: a partir de 1024 px el "More" se abre como popover anclado a la tarjeta.
const DESKTOP_QUERY = "(min-width: 1024px)";
const isDesktop = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DESKTOP_QUERY).matches;

// Desplegable reutilizable con botón redondo "+" que gira 45° a "×" y anima altura/opacidad.
// En PC (>= 1024 px) el panel se abre como popover (position: absolute) para que la página no crezca.
export type ChartExpandProps = {
  label?: string;
  children: ReactNode;
  className?: string;
};

export function ChartExpand({
  label = "What does this chart show?",
  children,
  className,
}: ChartExpandProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const panelId = `dbx-cc-more-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Popover en PC: Esc y clic (o toque) fuera lo cierran. En móvil no se escucha nada.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isDesktop()) return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!isDesktop()) return;
      const target = e.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`dbx-cc-expand${className ? ` ${className}` : ""}`}>
      <button
        ref={toggleRef}
        type="button"
        className={`dbx-cc-toggle${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="dbx-cc-plus" aria-hidden="true">
          +
        </span>
        <span className="dbx-cc-toggle-label">{label}</span>
      </button>

      <div
        id={panelId}
        className={`dbx-cc-collapse${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="dbx-cc-more">
          {/* Solo se ve en PC (popover); en móvil el CSS lo oculta */}
          <button
            type="button"
            className="dbx-cc-close"
            aria-label="Close"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false);
              toggleRef.current?.focus();
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}

// Tarjeta estándar del dashboard: "una gráfica, una frase en negrita y un + para saber más".
export function ChartCard({
  eyebrow,
  title,
  takeaway,
  children,
  more,
  moreLabel = "What does this chart show?",
  className,
  tone = "default",
  badge,
}: ChartCardProps): JSX.Element {
  const toneClass = tone === "alert" ? " dbx-cc-alert" : "";
  const extraClass = className ? ` ${className}` : "";

  return (
    <section className={`card dbx-cc${toneClass}${extraClass}`}>
      <div className="dbx-cc-head">
        <div className="dbx-cc-titles">
          <p className="eyebrow dbx-cc-eyebrow">{eyebrow}</p>
          {title && <h2 className="dbx-cc-title">{title}</h2>}
        </div>
        {badge && <div className="dbx-cc-badge">{badge}</div>}
      </div>

      {children && <div className="dbx-cc-chart">{children}</div>}

      <div className="dbx-cc-footer">
        {/* En PC el takeaway se recorta a 2 líneas: el texto completo queda en el title */}
        <p
          className="dbx-cc-takeaway"
          title={typeof takeaway === "string" ? takeaway : undefined}
        >
          {takeaway}
        </p>
        {more && <ChartExpand label={moreLabel}>{more}</ChartExpand>}
      </div>
    </section>
  );
}
