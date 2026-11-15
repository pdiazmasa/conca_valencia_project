import { useEffect } from "react";
import { coupleIntroText, coupleOutcome, coupleText, formatStat, truthValue, turnText, verdictFor, type Probe } from "../data";
import { coupleIntroKey, coupleKey, coverKey, getClip, planKey, questionKey, sectionKey, turnKey, verdictKey } from "../audio/manifest";
import { useNarrator } from "../audio/useNarrator";
import { StatValue } from "./Dashboard";
import { CoupleFigures, coupleValues, useCouple } from "../analysis/CoupleReveal";
import type { AskProps, PageProps, RevealProps } from "./types";
import "./audio.css";

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
  );
}

export function AudioAsk({ family, probe }: AskProps) {
  const n = useNarrator();
  const keys = [questionKey(family.id, probe.id)];
  useEffect(() => {
    n.play(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, probe.id]);
  const playing = n.status === "playing";
  return (
    <div className="audio-ask">
      <button type="button" className="audio-btn" onClick={() => (playing ? n.pause() : n.status === "paused" ? n.resume() : n.play(keys))} aria-label={playing ? "Pause" : "Listen to the question"}>
        <PlayIcon playing={playing} />
      </button>
      <p className="audio-hint">{n.status === "blocked" ? "Tap to listen" : playing ? "Listening…" : "Listen to the question"}</p>
    </div>
  );
}

export function AudioReveal({ family, probe, answer, animate }: RevealProps) {
  const n = useNarrator();
  const keys = [verdictKey(probe.id, verdictFor(probe, answer)), planKey(family.id, probe.id)];
  const lines = [
    { who: "Your guess", text: getClip(keys[0])?.text ?? "" },
    { who: "Your plan", text: getClip(keys[1])?.text ?? "" },
  ];
  useEffect(() => {
    if (animate) n.play(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, probe.id, answer, animate]);

  const playing = n.status === "playing";
  return (
    <div className="audio-reveal">
      <p className="question-sm">{probe.question}</p>
      <div className="audio-player">
        <button type="button" className="audio-btn" onClick={() => (playing ? n.pause() : n.status === "paused" ? n.resume() : n.play(keys))} aria-label={playing ? "Pause" : "Listen"}>
          <PlayIcon playing={playing} />
        </button>
        <div className="audio-controls">
          <button type="button" className="pill pill-outline" onClick={() => n.replay()}>Listen again</button>
          <button type="button" className="pill pill-outline" onClick={() => n.setRate(n.rate === 1 ? 0.8 : 1)} aria-pressed={n.rate < 1}>
            {n.rate < 1 ? "Slower: on" : "Slower"}
          </button>
        </div>
        {n.status === "blocked" && <p className="audio-hint">Tap the button to listen</p>}
      </div>
      <ol className="audio-captions">
        {lines.map((l, i) => (
          <li key={l.who} className={n.current === i ? "on" : ""}>
            <span className="eyebrow">{l.who}</span>
            <p>{l.text}</p>
          </li>
        ))}
      </ol>
      <StatValue probe={probe} v={truthValue(probe)} />
    </div>
  );
}

// Página del análisis en Audio: un solo reproductor por página que lee, en orden, lo que pensabas y lo que dice
// el plan (para las sondas de la sección) y el resumen de la sección. Si responden dos personas, en lugar de
// "lo que dijiste" lee una frase conjunta (coinciden o no, y cómo está el plan) y debajo salen las cifras de cada uno.
export function AudioPage({ family, analysis, page, answers }: PageProps) {
  const n = useNarrator();
  const couple = useCouple();

  type Item = { key: string; text: string };
  const item = (key: string, fallback = ""): Item => ({ key, text: getClip(key)?.text ?? fallback });
  const probeItems = (p: Probe): Item[] => {
    if (!couple) return [item(verdictKey(p.id, verdictFor(p, answers[p.id] ?? p.input.initial))), item(planKey(family.id, p.id))];
    const values = coupleValues(couple, p);
    const outcome = coupleOutcome(p, values[0], values[1]);
    return [
      ...(couple.order[0] === p.id ? [item(coupleIntroKey(family.id), coupleIntroText(couple.people))] : []),
      item(coupleKey(p.id, outcome), coupleText(p.id, outcome)),
      item(planKey(family.id, p.id)),
    ];
  };

  const items: Item[] =
    page.kind === "cover"
      ? analysis.score.spoken.map((_, i) => item(coverKey(family.id, i)))
      : [
          ...page.probes.flatMap(probeItems),
          ...page.section.spoken.map((_, i) => item(sectionKey(family.id, page.section.id, i))),
        ];
  const keys = items.map((i) => i.key);
  const id = page.kind === "cover" ? "cover" : page.section.id;

  useEffect(() => {
    n.play(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, id]);

  const playing = n.status === "playing";
  const headline = page.kind === "section" ? page.section.headline : null;
  return (
    <div className="audio-reveal">
      <h1 className="a-title">{page.kind === "cover" ? "Your financial health" : page.section.title}</h1>
      <div className="audio-player">
        <button type="button" className="audio-btn" onClick={() => (playing ? n.pause() : n.status === "paused" ? n.resume() : n.play(keys))} aria-label={playing ? "Pause" : "Listen"}>
          <PlayIcon playing={playing} />
        </button>
        <div className="audio-controls">
          <button type="button" className="pill pill-outline" onClick={() => n.replay()}>Listen again</button>
          <button type="button" className="pill pill-outline" onClick={() => n.setRate(n.rate === 1 ? 0.8 : 1)} aria-pressed={n.rate < 1}>
            {n.rate < 1 ? "Slower: on" : "Slower"}
          </button>
        </div>
        {n.status === "blocked" && <p className="audio-hint">Tap the button to listen</p>}
      </div>
      {page.kind === "cover" && <p className="stat-value">{analysis.score.value}<span className="stat-unit">/ 100</span></p>}
      {headline && <p className="stat-value">{formatStat(headline.kind, headline.value)}<span className="stat-unit">{headline.label}</span></p>}
      <ol className="audio-captions">
        {items.map((it, i) => (
          <li key={it.key} className={n.current === i ? "on" : ""}>
            <p>{it.text}</p>
          </li>
        ))}
      </ol>
      {couple && page.kind === "section" && page.probes.map((p) => (
        <div key={p.id} className="a-section">
          <p className="question-sm">{p.question}</p>
          <CoupleFigures probe={p} people={couple.people} values={coupleValues(couple, p)} />
        </div>
      ))}
    </div>
  );
}

// Aviso de turno ("Timothy, it's your turn to answer."): suena solo si esa persona usará Audio.
export function AudioTurn({ name }: { name: string }) {
  const n = useNarrator();
  useEffect(() => {
    n.play([turnKey(name)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return n.status === "blocked" ? (
    <button type="button" className="pill pill-outline" onClick={() => n.play([turnKey(name)])}>
      Tap to listen
    </button>
  ) : (
    <p className="audio-hint">{turnText(name)}</p>
  );
}
