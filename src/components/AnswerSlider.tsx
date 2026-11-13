import type { Scale } from "../data/types";
import { formatValue } from "../utils/format";

type AnswerSliderProps = {
  id: string;
  label: string;
  scale: Scale;
  value: number;
  onChange: (value: number) => void;
};

export function getMidpointValue(scale: Scale): number {
  const step = scale.step ?? 1;
  const mid = (scale.min + scale.max) / 2;
  const snapped = scale.min + Math.round((mid - scale.min) / step) * step;
  return Math.max(scale.min, Math.min(scale.max, snapped));
}

export function AnswerSlider({ id, label, scale, value, onChange }: AnswerSliderProps) {
  const step = scale.step ?? 1;

  return (
    <div className="stack-sm">
      <div className="slider-readout" aria-live="polite">
        {formatValue(value, scale.kind, "readout")}
      </div>
      <div className="range-wrap">
        <label htmlFor={id} className="muted" style={{ fontSize: "0.85rem" }}>
          {label}
        </label>
        <input
          id={id}
          className="range-input"
          type="range"
          min={scale.min}
          max={scale.max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="range-ticks">
          <span>{formatValue(scale.min, scale.kind, "tick")}</span>
          <span>{formatValue(scale.max, scale.kind, "tick")}</span>
        </div>
      </div>
    </div>
  );
}
