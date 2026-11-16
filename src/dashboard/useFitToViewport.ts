import { useLayoutEffect, type RefObject } from "react";

type FitOptions = {
  /** Ancho mínimo de ventana (px) a partir del cual se ajusta; por debajo (móvil) no se toca nada. */
  minWidth?: number;
  /** Escala mínima permitida; si ni así cabe, se deja el scroll antes que hacer ilegible el texto. */
  minScale?: number;
  /** Valores que, al cambiar, obligan a recalcular (familia, página…). */
  deps?: unknown[];
};

// Hace que la página quepa en la ventana sin scroll vertical en PC.
// Mide cuánto sobra en el documento (incluye la barra superior, el progreso y el botón Next de la app,
// que no son nuestros) y escala el bloque interior lo justo. El contenedor exterior recibe la altura ya
// escalada para que el hueco desaparezca de verdad. Con ventanas estrechas (móvil) no hace nada.
// Uso: <div ref={outer}><div ref={inner}>…</div></div>; los popovers dentro deben ser position: absolute.
export function useFitToViewport(
  outerRef: RefObject<HTMLElement | null>,
  innerRef: RefObject<HTMLElement | null>,
  { minWidth = 1024, minScale = 0.7, deps = [] }: FitOptions = {},
) {
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const reset = () => {
      inner.style.transform = "";
      inner.style.transformOrigin = "";
      outer.style.height = "";
    };

    const fit = () => {
      reset();
      if (window.innerWidth < minWidth) return;
      const overflow = document.documentElement.scrollHeight - window.innerHeight;
      if (overflow <= 0) return;
      const natural = inner.offsetHeight;
      if (natural <= 0) return;
      const scale = Math.max(minScale, (natural - overflow - 2) / natural);
      inner.style.transformOrigin = "top center";
      inner.style.transform = `scale(${scale})`;
      outer.style.height = `${Math.ceil(natural * scale)}px`;
    };

    fit();
    // Segundo intento cuando ya han cargado fuentes y animaciones de entrada.
    const late = window.setTimeout(fit, 350);
    let alive = true;
    document.fonts?.ready.then(() => alive && fit());
    window.addEventListener("resize", fit);
    return () => {
      alive = false;
      window.clearTimeout(late);
      window.removeEventListener("resize", fit);
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
