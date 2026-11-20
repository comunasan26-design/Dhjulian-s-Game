"use client";

import { useEffect, useRef } from "react";

const cache = new Map<string, Promise<unknown>>();

function loadData(name: string): Promise<unknown> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/animacoes/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`Animação ${name} não encontrada`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p;
}

/** Pré-carrega o player e as animações (chamar quando o jogo abre). */
export function preloadLottie(names: string[]) {
  void import("lottie-web/build/player/lottie_light").catch(() => undefined);
  for (const n of names) void loadData(n).catch(() => undefined);
}

/** Toca uma animação Lottie de public/animacoes/<name>.json uma vez. */
export function LottiePlayer({ name, onDone, className }: { name: string; onDone?: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    // se algo falhar, não trava a fila de animações
    const fallback = window.setTimeout(() => done.current?.(), 4000);
    Promise.all([import("lottie-web/build/player/lottie_light"), loadData(name)])
      .then(([mod, data]) => {
        if (cancelled || !ref.current) return;
        const anim = mod.default.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: false,
          autoplay: true,
          animationData: structuredClone(data),
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
        anim.addEventListener("complete", () => {
          window.clearTimeout(fallback);
          done.current?.();
        });
        destroy = () => anim.destroy();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      destroy?.();
    };
  }, [name]);
  return <div ref={ref} className={className} aria-hidden />;
}
