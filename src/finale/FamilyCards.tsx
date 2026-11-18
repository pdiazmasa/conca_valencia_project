import { FAMILIES, type Family } from "../data";
import "./familyCards.css";

// Selección de familia en PC: 4 tarjetas grandes en fila, con el mismo estilo que "See it your way".
// En móvil no se ven (sigue la lista de App.tsx); en PC la lista se esconde (familyCards.css).
// Solo el nombre de la familia: ni nota, ni cifras, ni edades.

type Member = NonNullable<Family["household"]>[number];

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

// Dibujo del hogar: un círculo por persona, los adultos grandes y los hijos pequeños.
function Household({ members }: { members: Member[] }) {
  return (
    <div className="fc-people" aria-hidden="true">
      {members.map((m, i) => (
        <span
          key={m.name}
          className={`fc-person${m.role === "child" ? " is-child" : ""}`}
          style={{ ["--i" as string]: i }}
        >
          {initial(m.name)}
        </span>
      ))}
    </div>
  );
}

export function FamilyCards({ onPick }: { onPick: (f: Family) => void }) {
  return (
    <div className="fc-grid">
      {FAMILIES.map((f) => {
        const members = f.household ?? [];
        return (
          <button key={f.id} type="button" className="fc-card" onClick={() => onPick(f)}>
            <Household members={members} />
            <span className="fc-body">
              <span className="fc-name">{f.name}</span>
            </span>
            <span className="fc-go" aria-hidden="true">
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path d="m1 1 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}
