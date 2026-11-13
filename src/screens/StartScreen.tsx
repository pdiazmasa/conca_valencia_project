import { useRef } from "react";
import type { Family } from "../data/types";

type StartScreenProps = {
  families: Family[];
  selectedFamilyId: string;
  peopleCount: number;
  participantNames: string[];
  onSelectFamily: (familyId: string) => void;
  onChangePeopleCount: (count: number) => void;
  onChangeName: (index: number, name: string) => void;
  onBegin: () => void;
  onOpenAdvisor: () => void;
};

export function StartScreen({
  families,
  selectedFamilyId,
  peopleCount,
  participantNames,
  onSelectFamily,
  onChangePeopleCount,
  onChangeName,
  onBegin,
  onOpenAdvisor,
}: StartScreenProps) {
  const peopleSectionRef = useRef<HTMLElement | null>(null);

  function handleSelectFamily(familyId: string) {
    onSelectFamily(familyId);
    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    peopleSectionRef.current?.scrollIntoView?.({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <main className="stack-lg start-main">
      <section className="card">
        <div className="stack-sm">
          <h1>Same Page</h1>
          <p className="muted">See your plan the way it really is, together.</p>
        </div>
      </section>

      <section className="card">
        <h2>Pick a family</h2>
        <div className="stack-sm" role="group" aria-label="Pick a family">
          {families.map((family) => {
            const selected = family.id === selectedFamilyId;
            return (
              <button
                key={family.id}
                type="button"
                className={`family-card ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => handleSelectFamily(family.id)}
              >
                <span className="family-card-title">{family.displayName}</span>
                <span className="family-card-headline">{family.headline}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section ref={peopleSectionRef} className="card people-section">
        <h2>How many people are deciding?</h2>
        <div className="count-grid" role="group" aria-label="How many people are deciding">
          {[1, 2, 3, 4].map((count) => {
            const selected = count === peopleCount;
            return (
              <button
                key={count}
                type="button"
                className={`count-btn ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onChangePeopleCount(count)}
              >
                {count}
              </button>
            );
          })}
        </div>

        <div className="stack-sm">
          {Array.from({ length: peopleCount }).map((_, idx) => (
            <label key={idx} className="field-label">
              <span>{`Person ${idx + 1} name`}</span>
              <input
                type="text"
                className="text-input"
                value={participantNames[idx] ?? ""}
                placeholder={`Person ${idx + 1}`}
                onChange={(event) => onChangeName(idx, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="start-sticky-bar">
        <button type="button" className="btn-primary" onClick={onBegin}>
          Start
        </button>
        <button type="button" className="btn-link btn-link-compact" onClick={onOpenAdvisor}>
          Advisor view
        </button>
      </div>
    </main>
  );
}
