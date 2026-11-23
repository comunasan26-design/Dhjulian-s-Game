"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { RatingValue } from "./RatingValue";

interface QueueStatus {
  status: "idle" | "searching" | "matched";
  code?: string;
  elapsedMs?: number;
  window?: number;
  online: number;
  searching: number;
}

interface Me {
  rating: number;
  games: number;
  label: string;
}

/** Depois desse tempo a sala é completada com bots (o círculo dá uma volta completa). */
const FILL_MS = 60_000;

/** Círculo de busca: o anel enche em 60 s; no meio, o tempo que passou. */
function SearchRing({ elapsedMs }: { elapsedMs: number }) {
  const r = 52;
  const len = 2 * Math.PI * r;
  const frac = Math.min(1, elapsedMs / FILL_MS);
  const s = Math.floor(elapsedMs / 1000);
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-label={`Procurando há ${s} segundos`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-edge" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - frac)}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
      <g className="origin-center animate-spin [animation-duration:3s]">
        <circle cx="60" cy="8" r="4" fill="var(--color-gold-2)" />
      </g>
      <text x="60" y="58" textAnchor="middle" className="fill-[var(--color-gold-2)] font-mono" fontSize="22">
        {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
      </text>
      <text x="60" y="78" textAnchor="middle" className="fill-current text-muted" fontSize="10">
        procurando
      </text>
    </svg>
  );
}

/** Modo ranqueado: rating do jogador, botão de buscar partida e a tela de busca. */
export function RankedPanel() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [q, setQ] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Quando a busca começou (no relógio deste aparelho) e quanto tempo já passou. */
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const searching = q?.status === "searching";

  useEffect(() => {
    void fetch("/api/ranked/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d));
  }, []);

  const handle = useCallback(
    (s: QueueStatus) => {
      setQ(s);
      if (s.status === "matched" && s.code) router.push(`/sala/${s.code}`);
      if (s.status === "searching") {
        const at = Date.now() - (s.elapsedMs ?? 0);
        setStartedAt(at);
        setElapsed(Date.now() - at);
      }
    },
    [router],
  );

  // enquanto procura: consulta a fila a cada 2 s (é isso que faz o pareamento)
  useEffect(() => {
    if (!searching) return;
    const poll = setInterval(async () => {
      const r = await fetch("/api/ranked/queue", { cache: "no-store" });
      if (r.ok) handle(await r.json());
    }, 2000);
    return () => clearInterval(poll);
  }, [searching, handle]);

  // e o relógio do círculo anda a cada 0,5 s
  useEffect(() => {
    if (!searching) return;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => clearInterval(tick);
  }, [searching, startedAt]);

  async function start() {
    setError(null);
    const r = await fetch("/api/ranked/queue", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error ?? "Não foi possível entrar na fila.");
    handle(d);
  }

  async function cancel() {
    await fetch("/api/ranked/queue", { method: "DELETE" });
    setQ(null);
  }

  // sai da fila se fechar a aba durante a busca
  useEffect(() => {
    if (!searching) return;
    const leave = () => navigator.sendBeacon?.("/api/ranked/queue?sair=1");
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [searching]);

  const stage = elapsed < 30_000 ? "Procurando jogadores com rating parecido (±100)" : elapsed < FILL_MS ? "Ampliando a busca (±250)" : "Completando a mesa com bots…";

  return (
    <section className="rounded-xl border border-gold/50 bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-gold-2">⚔️ Partida ranqueada</h2>
          <p className="text-xs text-muted">6 jogadores · pareamento por rating · completa com bots depois de 1 minuto</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted">Seu rating</p>
          <p className="text-lg text-ink">{me ? <RatingValue rating={me.rating} games={me.games} self /> : "…"}</p>
        </div>
      </div>
      {error && <p className="mt-3 rounded-md border border-blood/50 bg-blood/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      {!searching ? (
        <Button variant="primary" size="lg" className="mt-4 w-full" onClick={start} disabled={q?.status === "matched"}>
          {q?.status === "matched" ? "Entrando na partida…" : "Procurar partida ranqueada"}
        </Button>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2">
          <SearchRing elapsedMs={elapsed} />
          <p className="text-center text-sm text-ink">{stage}</p>
          <p className="text-center text-xs text-muted">
            <span className="text-emerald-300">● {q?.online ?? 0} online</span> · 🔎 {q?.searching ?? 0} procurando partida
          </p>
          <Button variant="ghost" onClick={cancel}>
            Cancelar busca
          </Button>
        </div>
      )}
    </section>
  );
}
