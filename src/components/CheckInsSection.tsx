type CheckInsSectionProps = {
  contextLine?: string;
  onOpenDay3: () => void;
  onOpenDay30: () => void;
  className?: string;
};

export function CheckInsSection({
  contextLine,
  onOpenDay3,
  onOpenDay30,
  className = "",
}: CheckInsSectionProps) {
  return (
    <section
      className={`card ${className}`.trim()}
      aria-label="Check-ins"
    >
      <div className="stack-sm">
        <h2>Check-ins</h2>
        {contextLine && <p>{contextLine}</p>}
        <p className="muted">Demo: opens now instead of waiting.</p>
      </div>

      <div className="stack-sm">
        <button
          type="button"
          className="btn-secondary"
          onClick={onOpenDay3}
        >
          Open day 3 check-in
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onOpenDay30}
        >
          Open day 30 check-in
        </button>
      </div>
    </section>
  );
}
