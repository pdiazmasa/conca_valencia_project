type HandoffScreenProps = {
  participantName: string;
  onStartTurn: () => void;
};

export function HandoffScreen({ participantName, onStartTurn }: HandoffScreenProps) {
  return (
    <main className="card">
      <p className="eyebrow">Next person</p>
      <h1>{`Pass the phone to ${participantName}`}</h1>
      <p className="muted">
        Other people&apos;s answers stay hidden while it is your turn.
      </p>
      <button type="button" className="btn-primary" onClick={onStartTurn}>
        {`I'm ${participantName}, start`}
      </button>
    </main>
  );
}
