"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameContext";

/** Relógio sincronizado com o servidor (atualiza a cada 500ms). */
export function useServerNow(): number {
  const { serverOffset } = useGame();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return now + serverOffset;
}

export function Countdown({ deadline }: { deadline: number }) {
  const now = useServerNow();
  const s = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <span className={`tabular-nums ${s <= 5 ? "text-red-400" : "text-gold-2"}`}>{s}s</span>;
}
