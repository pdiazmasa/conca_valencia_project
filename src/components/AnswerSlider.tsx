import { useEffect, useRef } from "react";
import type { Scale } from "../data/types";
import { formatValue } from "../utils/format";

type AnswerSliderProps = {
  id: string;
  label: string;
  scale: Scale;
  value: number | null;
  onChange: (value: number) => void;
};

export function AnswerSlider({ id, label, scale, value, onChange }: AnswerSliderProps) {
  const step = scale.step ?? 1;
  const isUntouched = value === null;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef<number | null>(value);
  const onChangeRef = useRef(onChange);

  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    // Catch DOM change events when untouched and target value equals scale.min
    function handleNativeChange() {
      if (valueRef.current === null && el) {
        onChangeRef.current(Number(el.value));
      }
    }

    el.addEventListener("change", handleNativeChange);
    return () => {
      el.removeEventListener("change", handleNativeChange);
    };
  }, []);

  function handleLess() {
    if (value === null) {
      onChange(scale.min);
      return;
    }
    onChange(Math.max(scale.min, value - step));
  }

  function handleMore() {
    if (value === null) {
      onChange(scale.min);
      return;
    }
    onChange(Math.min(scale.max, value + step));
  }

  const lessDisabled = value !== null && value <= scale.min;
  const moreDisabled = value !== null && value >= scale.max;

  return (
    <div className="stack-sm">
      <div
        className={`slider-readout ${isUntouched ? "is-untouched" : ""}`}
        aria-live="polite"
      >
        {isUntouched ? "Move the slider" : formatValue(value, scale.kind, "readout")}
      </div>

      <div className="range-wrap">
        <label htmlFor={id} className="muted" style={{ fontSize: "0.85rem" }}>
          {label}
        </label>

        <div className="slider-controls-row">
          <button
            type="button"
            className="btn-step"
            onClick={handleLess}
            disabled={lessDisabled}
          >
            <span className="btn-step-symbol" aria-hidden="true">
              −
            </span>
            <span>Less</span>
          </button>

          <input
            ref={inputRef}
            id={id}
            className={`range-input ${isUntouched ? "is-untouched" : ""}`}
            type="range"
            min={scale.min}
            max={scale.max}
            step={step}
            value={value ?? scale.min}
            aria-valuetext={
              isUntouched
                ? "Not set yet. Move the slider."
                : formatValue(value, scale.kind, "readout")
            }
            onChange={(event) => onChange(Number(event.target.value))}
            onClick={(event) => {
              if (isUntouched) {
                onChange(Number(event.currentTarget.value));
              }
            }}
            onKeyDown={(event) => {
              if (
                isUntouched &&
                ["ArrowLeft", "ArrowDown", "Home", "PageDown"].includes(event.key)
              ) {
                onChange(scale.min);
              }
            }}
          />

          <button
            type="button"
            className="btn-step"
            onClick={handleMore}
            disabled={moreDisabled}
          >
            <span className="btn-step-symbol" aria-hidden="true">
              +
            </span>
            <span>More</span>
          </button>
        </div>

        <div className="range-ticks">
          <span>{formatValue(scale.min, scale.kind, "tick")}</span>
          <span>{formatValue(scale.max, scale.kind, "tick")}</span>
        </div>
      </div>
    </div>
  );
}
