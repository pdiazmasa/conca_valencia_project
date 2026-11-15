import { ANALYSIS, type Family, type Person } from "./data";
import { addDays, buildIcs, downloadIcs } from "./reminders";

type Move = { title: string; action: string; effort: string; scoreBefore: number; scoreAfter: number };

const effortLabel: Record<string, string> = { low: "Low effort", medium: "Medium effort", high: "High effort" };
const dateLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Efecto sobre la nota que publica el plan (no lo calculamos nosotros).
const scoreEffect = (m: Move) => (m.scoreAfter > m.scoreBefore ? `Score ${m.scoreBefore} → ${m.scoreAfter}` : "Doesn't move the score on its own");

// Pantalla final: cada persona elige su primer paso, ve cómo se hace y se lleva recordatorios y una hoja.
export function NextStepsScreen({
  family,
  people,
  choices,
  onChoose,
  onRestart,
}: {
  family: Family;
  people: Person[];
  choices: Record<number, number>;
  onChoose: (person: number, move: number) => void;
  onRestart: () => void;
}) {
  const analysis = ANALYSIS[family.id];
  const moves: Move[] = analysis?.score.moves ?? [];
  const combined = analysis?.score.combined ?? null;
  const couple = people.length > 1;
  const allChosen = moves.length > 0 && people.every((_, i) => choices[i] !== undefined);
  const picked = people.map((_, i) => (choices[i] !== undefined ? moves[choices[i]] : null));
  const same = couple && allChosen && choices[0] === choices[1];

  const today = new Date();
  const day7 = addDays(today, 7);
  const day30 = addDays(today, 30);

  // Qué se recuerda: el paso común o el de cada persona por su nombre.
  const stepsText = (field: "title" | "action") =>
    same || !couple
      ? picked[0]![field]
      : picked.map((m, i) => `${people[i].name}: ${m![field]}`).join(" · ");

  const addReminders = () => {
    if (!allChosen) return;
    const title = stepsText("title");
    const ics = buildIcs(
      [
        {
          days: 7,
          summary: `Same Page: did you start your first step?`,
          description: `Your first step: ${title}. How: ${stepsText("action")}`,
        },
        {
          days: 30,
          summary: `Same Page: review your plan`,
          description: `Open Same Page again and compare today's picture with your plan. Your first step was: ${title}.`,
        },
      ],
      today,
    );
    downloadIcs(ics);
  };

  return (
    <main className="content">
      <h1>Your next steps</h1>
      {moves.length === 0 ? (
        <p className="context" style={{ marginTop: 12 }}>This plan has no next steps listed.</p>
      ) : (
        <>
          <p className="context" style={{ marginTop: 12 }}>
            {couple ? "Each of you, pick the one you would do first." : "Pick the one you would do first."}
          </p>

          {people.map((person, pi) => (
            <section key={person.name} className="steps-person">
              {couple && <p className="eyebrow">{person.name}</p>}
              <ul className="steps-list" role="radiogroup" aria-label={couple ? `${person.name}'s first step` : "Your first step"}>
                {moves.map((m, mi) => {
                  const on = choices[pi] === mi;
                  return (
                    <li key={m.title}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`card steps-card${on ? " on" : ""}`}
                        onClick={() => onChoose(pi, mi)}
                      >
                        <span className="steps-head">
                          <span className="steps-title">{m.title}</span>
                          <span className="badge badge-soft">{effortLabel[m.effort] ?? m.effort}</span>
                        </span>
                        <span className="steps-effect">{scoreEffect(m)}</span>
                        {on && (
                          <span className="steps-how">
                            <span className="eyebrow">How to do it</span>
                            <span>{m.action}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {couple && allChosen && (
            <section className="card steps-agree" aria-live="polite">
              <span className={`badge ${same ? "badge-solid" : "badge-outline"}`}>{same ? "You agree" : "You chose differently"}</span>
              <p className="context" style={{ marginTop: 12 }}>
                {same
                  ? `You both chose "${picked[0]!.title}". Start there.`
                  : "The plan leaves the order to you. Talk it through and agree on one to start with."}
              </p>
            </section>
          )}

          {combined && (
            <p className="steps-note">Doing {combined.moves.length === 1 ? "it" : "all of them"} together takes the score to {combined.scoreAfter}.</p>
          )}

          <section className="card steps-remind">
            <p className="eyebrow">Keep it</p>
            <p className="context">
              Reminders for day 7 ({dateLabel(day7)}) and day 30 ({dateLabel(day30)}). Your calendar app sends them.
            </p>
            <div className="steps-buttons">
              <button type="button" className="pill pill-filled" onClick={addReminders} disabled={!allChosen}>
                Add reminders to my calendar
              </button>
              <button type="button" className="pill pill-outline" onClick={() => window.print()} disabled={!allChosen}>
                Save this page
              </button>
            </div>
            {!allChosen && <p className="steps-note">{couple ? "Both of you need to pick a step first." : "Pick a step first."}</p>}
          </section>

          {/* Hoja que solo se ve al guardar o imprimir. */}
          {allChosen && (
            <section className="steps-sheet" aria-hidden="true">
              <h1>Same Page · Your next steps</h1>
              <p>{family.name} · {dateLabel(today)}</p>
              {people.map((person, i) => (
                <div key={person.name} className="steps-sheet-item">
                  <h2>{couple ? `${person.name}: ` : ""}{picked[i]!.title}</h2>
                  <p>{picked[i]!.action}</p>
                  <p>{effortLabel[picked[i]!.effort] ?? picked[i]!.effort} · {scoreEffect(picked[i]!)}</p>
                </div>
              ))}
              {combined && <p>All the steps together take the score to {combined.scoreAfter}.</p>}
              <p>Check in on day 7 ({dateLabel(day7)}) and day 30 ({dateLabel(day30)}).</p>
            </section>
          )}
        </>
      )}
      <div className="actions">
        <button type="button" className="pill pill-outline" onClick={onRestart}>
          Start over
        </button>
      </div>
    </main>
  );
}
