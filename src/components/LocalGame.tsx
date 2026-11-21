"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { botName, stepBots } from "@/game/bot/ai";
import { type Action, applyAction, createGame, type Ctx, type GameState, type GameView, tick, viewFor } from "@/game/engine";
import { Board } from "./game/Board";
import { Button } from "./ui/Button";
import { SkillSelect } from "./SkillSelect";

const STORAGE_KEY = "dg_local_game_v1";
const ME = "voce";

function ctx(): Ctx {
  return {
    now: Date.now(),
    rng: {
      int: (max: number) => {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] % max;
      },
    },
  };
}

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

function save(state: GameState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento indisponível: a partida continua só nesta aba
  }
}

/** Partida local: tudo roda no navegador (sem conta e sem banco), contra bots. */
export function LocalGame() {
  const stateRef = useRef<GameState | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [saved, setSaved] = useState<GameState | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("Você");
  const [bots, setBots] = useState(3);
  const [skill, setSkill] = useState(20);
  const [toast, setToast] = useState<string | null>(null);

  const commit = useCallback(() => {
    const s = stateRef.current;
    save(s);
    setView(s ? viewFor(s, ME, Date.now(), new Set([ME])) : null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(load());
    setReady(true);
  }, []);

  // Laço dos bots e dos prazos. Os bots pensam num Web Worker (a tela não trava enquanto decidem);
  // sem suporte a workers, roda aqui mesmo como antes.
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" });
    } catch {
      worker = null;
    }
    let pending: { id: number; sent: GameState; at: number } | null = null;
    let seq = 0;
    if (worker)
      worker.onmessage = (e: MessageEvent<{ id: number; changed: boolean; state: GameState | null }>) => {
        const p = pending;
        pending = null;
        if (!p || p.id !== e.data.id || !e.data.changed || !e.data.state) return;
        // se o jogador agiu enquanto os bots pensavam, descarta (eles pensam de novo no próximo ciclo)
        if (stateRef.current !== p.sent) return;
        stateRef.current = e.data.state;
        commit();
      };
    if (worker)
      worker.onerror = () => {
        // worker quebrou: volta a rodar os bots aqui
        worker?.terminate();
        worker = null;
        pending = null;
      };
    const t = setInterval(() => {
      const s = stateRef.current;
      if (!s || s.phase === "FINISHED") return;
      if (worker) {
        if (pending && Date.now() - pending.at < 8000) return;
        pending = { id: ++seq, sent: s, at: Date.now() };
        worker.postMessage({ id: pending.id, state: s, now: Date.now() });
        return;
      }
      const c = ctx();
      const changed = tick(s, c) || stepBots(s, c);
      if (changed) commit();
    }, 300);
    return () => {
      clearInterval(t);
      worker?.terminate();
    };
  }, [commit]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(
    async (a: Action) => {
      const s = stateRef.current;
      if (!s) return false;
      const clone = structuredClone(s);
      try {
        applyAction(clone, ME, a, ctx());
      } catch (e) {
        if (a.type !== "TICK") setToast((e as Error).message);
        return false;
      }
      if (clone.closed) {
        stateRef.current = null;
        save(null);
        setSaved(null);
        setView(null);
        setToast("Você desistiu da partida.");
        return true;
      }
      stateRef.current = clone;
      commit();
      return true;
    },
    [commit],
  );

  function start() {
    const players = [
      { id: ME, name: name.trim().slice(0, 20) || "Você" },
      ...Array.from({ length: bots }, (_, i) => ({ id: `bot-${i + 1}`, name: botName(i), bot: true, skill })),
    ];
    stateRef.current = createGame(players, ME, ctx());
    commit();
  }

  function resume() {
    stateRef.current = saved;
    commit();
  }

  function quit() {
    stateRef.current = null;
    save(null);
    setSaved(null);
    setView(null);
  }

  if (view) {
    return (
      <>
        <Board view={view} roomName="Partida local" code="LOCAL" conn="online" busy={false} act={act} backHref="/local" />
        <div className="mx-auto mb-4 w-full max-w-[1600px] px-3 text-right">
          <Button size="sm" variant="ghost" onClick={() => confirm("Abandonar esta partida local?") && quit()}>
            Abandonar partida local
          </Button>
        </div>
        {toast && (
          <div className="fixed left-1/2 top-3 z-[60] max-w-[90vw] -translate-x-1/2 rounded-lg border border-blood bg-panel px-4 py-2 text-sm text-red-200 shadow-xl">
            {toast}
          </div>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Início
      </Link>
      <div className="mt-3 rounded-2xl border border-edge bg-panel p-6">
        <p className="text-sm uppercase tracking-[0.25em] text-gold">Modo local</p>
        <h1 className="mt-1 font-display text-3xl">Jogar contra bots</h1>
        <p className="mt-2 text-sm text-muted">
          Tudo roda no seu navegador: não precisa de conta, de sala nem de internet depois de carregar. A partida fica salva neste
          aparelho.
        </p>
        {ready && saved && saved.phase !== "FINISHED" && (
          <div className="mt-4 rounded-lg border border-gold/50 bg-panel-2 p-3">
            <p className="text-sm">
              Partida salva: rodada {saved.round}, {saved.players.length} jogadores.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="primary" onClick={resume}>
                Continuar
              </Button>
              <Button variant="ghost" onClick={quit}>
                Descartar
              </Button>
            </div>
          </div>
        )}
        <label className="mt-5 block text-sm text-muted">
          Seu nome
          <input
            className="mt-1 w-full rounded-md border border-edge bg-bg px-3 py-2 text-ink outline-none focus:border-gold"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="mt-4 flex items-center justify-between text-sm text-muted">
          Quantidade de bots
          <select className="rounded-md border border-edge bg-bg px-2 py-1 text-ink" value={bots} onChange={(e) => setBots(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <SkillSelect className="mt-4" value={skill} onChange={setSkill} />
        <Button variant="primary" size="lg" className="mt-6 w-full" onClick={start}>
          ▶ Nova partida local
        </Button>
      </div>
    </main>
  );
}
