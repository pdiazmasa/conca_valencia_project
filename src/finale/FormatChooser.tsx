import { FORMATS, FORMAT_ORDER, type FormatId } from "../formats";
import "./finale.css";

export interface FormatChooserProps {
  current: FormatId;
  onChangeFormat: (f: FormatId) => void;
  onNextSteps: () => void;
}

function WrappedIllustration() {
  return (
    <svg className="fin-art-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Tarjeta izquierda (fondo) */}
      <g className="fin-art-wrapped-left">
        <rect x="20" y="16" width="46" height="64" rx="8" fill="#f5f5f7" stroke="#e6e6e8" strokeWidth="1.5" />
        <line x1="28" y1="26" x2="44" y2="26" stroke="#d6d6d6" strokeWidth="2" strokeLinecap="round" />
        <line x1="28" y1="33" x2="54" y2="33" stroke="#e6e6e8" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Tarjeta derecha (fondo) */}
      <g className="fin-art-wrapped-right">
        <rect x="54" y="16" width="46" height="64" rx="8" fill="#f5f5f7" stroke="#e6e6e8" strokeWidth="1.5" />
        <line x1="62" y1="26" x2="82" y2="26" stroke="#d6d6d6" strokeWidth="2" strokeLinecap="round" />
        <line x1="62" y1="33" x2="88" y2="33" stroke="#e6e6e8" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Tarjeta central (frente) */}
      <g className="fin-art-wrapped-center">
        <rect x="37" y="10" width="46" height="68" rx="8" fill="#ffffff" stroke="#d6d6d6" strokeWidth="1.5" />
        {/* Barras de progreso de stories arriba */}
        <line x1="42" y1="16" x2="52" y2="16" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" />
        <line x1="55" y1="16" x2="65" y2="16" stroke="#1d1d1f" strokeWidth="2" strokeLinecap="round" />
        <line x1="68" y1="16" x2="78" y2="16" stroke="#e6e6e8" strokeWidth="2" strokeLinecap="round" />
        {/* Elementos interiores simulando story */}
        <circle cx="60" cy="36" r="9" fill="#f5f5f7" stroke="#e6e6e8" strokeWidth="1.2" />
        <path d="M57 36 L63 36 M60 33 L60 39" stroke="#0071e3" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="47" y1="52" x2="73" y2="52" stroke="#1d1d1f" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="51" y1="60" x2="69" y2="60" stroke="#707070" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function DashboardIllustration() {
  return (
    <svg className="fin-art-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Gauge a la izquierda */}
      <g className="fin-art-dash-gauge">
        <path d="M 20 54 A 18 18 0 0 1 56 54" fill="none" stroke="#e6e6e8" strokeWidth="4" strokeLinecap="round" />
        <path d="M 20 54 A 18 18 0 0 1 47 38" fill="none" stroke="#0071e3" strokeWidth="4" strokeLinecap="round" />
        <g className="fin-art-dash-needle">
          <circle cx="38" cy="54" r="3.5" fill="#1d1d1f" />
          <line x1="38" y1="54" x2="48" y2="42" stroke="#1d1d1f" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      </g>
      {/* Barras a la derecha */}
      <g className="fin-art-dash-bars">
        <line x1="66" y1="64" x2="108" y2="64" stroke="#e6e6e8" strokeWidth="1.5" strokeLinecap="round" />
        <rect className="fin-art-dash-bar fin-art-dash-bar-1" x="70" y="44" width="6" height="20" rx="3" fill="#86868b" />
        <rect className="fin-art-dash-bar fin-art-dash-bar-2" x="80" y="30" width="6" height="34" rx="3" fill="#1d1d1f" />
        <rect className="fin-art-dash-bar fin-art-dash-bar-3" x="90" y="40" width="6" height="24" rx="3" fill="#86868b" />
        <rect className="fin-art-dash-bar fin-art-dash-bar-4" x="100" y="22" width="6" height="42" rx="3" fill="#0071e3" />
      </g>
    </svg>
  );
}

function AudioIllustration() {
  return (
    <svg className="fin-art-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g className="fin-art-audio-waves">
        <rect className="fin-art-audio-bar fin-art-audio-1" x="28" y="36" width="5" height="18" rx="2.5" fill="#86868b" />
        <rect className="fin-art-audio-bar fin-art-audio-2" x="40" y="26" width="5" height="38" rx="2.5" fill="#1d1d1f" />
        <rect className="fin-art-audio-bar fin-art-audio-3" x="52" y="17" width="5" height="56" rx="2.5" fill="#0071e3" />
        <rect className="fin-art-audio-bar fin-art-audio-4" x="64" y="22" width="5" height="46" rx="2.5" fill="#1d1d1f" />
        <rect className="fin-art-audio-bar fin-art-audio-5" x="76" y="30" width="5" height="30" rx="2.5" fill="#1d1d1f" />
        <rect className="fin-art-audio-bar fin-art-audio-6" x="88" y="38" width="5" height="14" rx="2.5" fill="#86868b" />
      </g>
    </svg>
  );
}

function InformeIllustration() {
  return (
    <svg className="fin-art-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Hoja de documento */}
      <rect x="35" y="12" width="50" height="66" rx="7" fill="#ffffff" stroke="#d6d6d6" strokeWidth="1.5" />
      {/* Encabezado */}
      <rect x="43" y="20" width="16" height="4" rx="2" fill="#0071e3" />
      {/* Líneas de texto */}
      <g className="fin-art-rep-lines">
        <line className="fin-art-rep-line fin-art-rep-l1" x1="43" y1="32" x2="77" y2="32" stroke="#1d1d1f" strokeWidth="2.5" strokeLinecap="round" />
        <line className="fin-art-rep-line fin-art-rep-l2" x1="43" y1="41" x2="73" y2="41" stroke="#707070" strokeWidth="2" strokeLinecap="round" />
        <line className="fin-art-rep-line fin-art-rep-l3" x1="43" y1="49" x2="69" y2="49" stroke="#707070" strokeWidth="2" strokeLinecap="round" />
        <line className="fin-art-rep-line fin-art-rep-l4" x1="43" y1="57" x2="59" y2="57" stroke="#0071e3" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Pluma que escribe */}
      <g className="fin-art-rep-pen">
        <path d="M76 29 L82 23 L85 26 L79 32 Z" fill="#1d1d1f" />
        <polygon points="76,29 74,33 78,32" fill="#0071e3" />
      </g>
    </svg>
  );
}

function LifelineIllustration() {
  return (
    <svg className="fin-art-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Línea de vida: puntos (uno por año) que se apagan en rojo al final */}
      <line x1="14" y1="45" x2="106" y2="45" stroke="#e6e6e8" strokeWidth="2" strokeLinecap="round" />
      <g className="fin-art-life-dots">
        {Array.from({ length: 10 }, (_, i) => (
          <circle
            key={i}
            className={`fin-art-life-dot fin-art-life-d${i}`}
            cx={18 + i * 9.6}
            cy={45}
            r={3.6}
            fill={i < 7 ? "#1d1d1f" : i === 7 ? "#e7000b" : "#ffffff"}
            stroke={i < 7 ? "#1d1d1f" : i === 7 ? "#e7000b" : "#d6d6d6"}
            strokeWidth="1.4"
          />
        ))}
      </g>
      <g className="fin-art-life-flag">
        <line x1="85.2" y1="45" x2="85.2" y2="24" stroke="#e7000b" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="85.2" y="20" width="18" height="9" rx="3" fill="#e7000b" />
      </g>
      <line x1="18" y1="62" x2="44" y2="62" stroke="#707070" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="69" x2="34" y2="69" stroke="#d6d6d6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GenericIllustration() {
  return (
    <svg className="fin-art-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g className="fin-art-fallback-grid">
        <rect className="fin-art-fallback-b1" x="34" y="19" width="22" height="22" rx="6" fill="#f5f5f7" stroke="#e6e6e8" strokeWidth="1.5" />
        <rect className="fin-art-fallback-b2" x="64" y="19" width="22" height="22" rx="6" fill="#f5f5f7" stroke="#e6e6e8" strokeWidth="1.5" />
        <rect className="fin-art-fallback-b3" x="34" y="49" width="22" height="22" rx="6" fill="#f5f5f7" stroke="#e6e6e8" strokeWidth="1.5" />
        <rect className="fin-art-fallback-b4" x="64" y="49" width="22" height="22" rx="6" fill="#0071e3" opacity="0.85" />
      </g>
    </svg>
  );
}

function renderIllustration(id: string) {
  switch (id) {
    case "wrapped":
      return <WrappedIllustration />;
    case "dashboard":
      return <DashboardIllustration />;
    case "audio":
      return <AudioIllustration />;
    case "informe":
      return <InformeIllustration />;
    case "lifeline":
      return <LifelineIllustration />;
    default:
      return <GenericIllustration />;
  }
}

export function FormatChooser({ current, onChangeFormat, onNextSteps }: FormatChooserProps) {
  return (
    <main className="content fin-content">
      <div className="fin-header">
        <h1 className="fin-title">See it your way</h1>
        <p className="fin-subtitle">Same plan, told differently.</p>
      </div>

      <div className="fin-grid" role="group" aria-label="Choose plan format">
        {FORMAT_ORDER.map((id) => {
          const item = FORMATS[id];
          const name = item?.name ?? id;
          const tagline = item?.tagline ?? "";
          const isCurrent = id === current;

          return (
            <button
              key={id}
              type="button"
              className={`fin-widget fin-widget-${id} ${isCurrent ? "fin-widget-current" : ""}`}
              onClick={() => onChangeFormat(id)}
              aria-label={`${name}: ${tagline}${isCurrent ? " (Just seen)" : ""}`}
            >
              {isCurrent && <span className="fin-badge">Just seen</span>}
              <div className="fin-art" aria-hidden="true">
                {renderIllustration(id)}
              </div>
              <div className="fin-widget-body">
                <span className="fin-widget-name">{name}</span>
                <span className="fin-widget-tagline">{tagline}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="actions fin-actions">
        <button type="button" className="pill pill-filled fin-next-btn" onClick={onNextSteps}>
          Your next steps
        </button>
      </div>
    </main>
  );
}

export default FormatChooser;
