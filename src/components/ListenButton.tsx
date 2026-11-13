import { useEffect, useState } from "react";
import { isSpeechAvailable, speakEnUs, stopSpeech } from "../utils/speech";

type ListenButtonProps = {
  text: string;
};

export function ListenButton({ text }: ListenButtonProps) {
  const available = isSpeechAvailable();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, [text]);

  if (!available) {
    return null;
  }

  function handleClick() {
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
      return;
    }
    const started = speakEnUs(text, () => setSpeaking(false));
    setSpeaking(started);
  }

  return (
    <button
      type="button"
      className="btn-secondary no-print"
      onClick={handleClick}
    >
      {speaking ? "Stop listening" : "Listen"}
    </button>
  );
}
