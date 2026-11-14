import { useEffect, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Curva igual a --ease de styles.css, para que la cifra y la marca se muevan a la vez.
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

// Interpola de `from` a `to` tras `delay` ms. Devuelve el valor actual y si ha terminado.
export function useTween(from: number, to: number, { duration = 900, delay = 350 } = {}) {
  const [state, setState] = useState({ v: reduced() ? to : from, done: reduced() });

  useEffect(() => {
    if (reduced()) {
      setState({ v: to, done: true });
      return;
    }
    let raf = 0;
    let start = 0;
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        setState({ v: from + (to - from) * ease(t), done: t === 1 });
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [from, to, duration, delay]);

  return state;
}
