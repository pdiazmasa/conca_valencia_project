import { useCallback, useEffect, useRef, useState } from "react";
import { getClip, type Clip } from "./manifest";

// Voz de reserva del navegador: solo una voz en inglés. Si el sistema no tiene ninguna,
// no se habla (mejor silencio que inglés leído con voz española); quedan los subtítulos.
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
}

export type NarratorStatus = "idle" | "playing" | "paused" | "blocked";

// Reproduce una lista de clips seguidos. Usa el mp3 si existe; si no, la voz del navegador (inglés).
export function useNarrator() {
  const [status, setStatus] = useState<NarratorStatus>("idle");
  const [current, setCurrent] = useState(-1);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);
  const runId = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastKeys = useRef<string[]>([]);

  const halt = useCallback(() => {
    runId.current++;
    audioRef.current?.pause();
    audioRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const playClip = useCallback((clip: Clip, id: number) => new Promise<void>((resolve, reject) => {
    const fallback = () => {
      const voice = pickEnglishVoice();
      if (!voice) return resolve();
      const u = new SpeechSynthesisUtterance(clip.text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rateRef.current;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    };
    if (!clip.url) return fallback();
    const a = new Audio(clip.url);
    a.playbackRate = rateRef.current;
    audioRef.current = a;
    a.onended = () => resolve();
    a.onerror = () => (runId.current === id ? fallback() : resolve());
    a.play().catch((e: unknown) => {
      if ((e as Error)?.name === "NotAllowedError") reject(e);
      else fallback();
    });
  }), []);

  const play = useCallback(async (keys: string[]) => {
    halt();
    const id = runId.current;
    lastKeys.current = keys;
    setStatus("playing");
    try {
      for (let i = 0; i < keys.length; i++) {
        if (runId.current !== id) return;
        const clip = getClip(keys[i]);
        if (!clip) continue;
        setCurrent(i);
        await playClip(clip, id);
      }
      if (runId.current === id) { setStatus("idle"); setCurrent(-1); }
    } catch {
      if (runId.current === id) { setStatus("blocked"); setCurrent(-1); }
    }
  }, [halt, playClip]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.pause();
    setStatus("paused");
  }, []);
  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {});
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
    setStatus("playing");
  }, []);
  const stop = useCallback(() => { halt(); setStatus("idle"); setCurrent(-1); }, [halt]);
  const replay = useCallback(() => play(lastKeys.current), [play]);
  const setRate = useCallback((r: number) => {
    rateRef.current = r; setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  useEffect(() => halt, [halt]);

  return { status, current, rate, play, pause, resume, stop, replay, setRate };
}
