"use client";

import { useEffect, useState } from "react";
import { RatingValue } from "./RatingValue";

interface MeResult {
  rating: number;
  games: number;
  label: string;
  match: { counted: boolean; finished: boolean; position: number | null; delta: number | null } | null;
}

/** Aviso no fim de uma partida ranqueada: colocação e quanto o rating mudou. */
export function RankedResult({ code }: { code: string }) {
  const [r, setR] = useState<MeResult | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let stop = false;
    let tries = 0;
    const get = async () => {
      const res = await fetch(`/api/ranked/me?code=${code}`, { cache: "no-store" });
      const d = (await res.json().catch(() => null)) as MeResult | null;
      if (stop) return;
      if (d) setR(d);
      // o servidor fecha o resultado logo depois do fim; tenta de novo até aparecer
      if ((!d?.match?.finished || d.match.position === null) && ++tries < 8) setTimeout(get, 1500);
    };
    void get();
    return () => {
      stop = true;
    };
  }, [code]);

  if (closed || !r?.match?.finished || r.match.position === null) return null;
  const { counted, position, delta } = r.match;
  const d = Math.round(delta ?? 0);
  return (
    <div className="fixed inset-x-3 top-14 z-[55] mx-auto max-w-md rounded-xl border border-gold/60 bg-panel/95 p-4 text-center shadow-2xl backdrop-blur">
      <p className="text-xs uppercase tracking-widest text-gold">Partida ranqueada</p>
      <p className="mt-1 font-display text-2xl text-gold-2">{position}º lugar</p>
      {counted ? (
        <p className="mt-1 text-sm text-ink">
          Rating:{" "}
          <b>
            <RatingValue rating={r.rating} games={r.games} self />
          </b>{" "}
          <span className={d >= 0 ? "text-emerald-300" : "text-red-300"}>
            ({d >= 0 ? "+" : ""}
            {d})
          </span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Esta partida não contou para o rating.</p>
      )}
      <button type="button" className="mt-3 text-xs text-muted underline" onClick={() => setClosed(true)}>
        Fechar
      </button>
    </div>
  );
}
