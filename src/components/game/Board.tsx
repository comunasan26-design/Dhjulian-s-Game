"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Action, GameView } from "@/game/engine";
import type { ConnState } from "../room/useRoom";
import { Button } from "../ui/Button";
import { CardInspector } from "./CardInspector";
import { CardView } from "./CardView";
import { CombatPanel } from "./CombatPanel";
import { GameProvider } from "./GameContext";
import { LogPanel } from "./LogPanel";
import { MyArea } from "./MyArea";
import { PickerProvider } from "./Picker";
import { PlayerPanel } from "./PlayerPanel";
import { PromptLayer } from "./PromptLayer";
import { TurnControls } from "./TurnControls";

const CONN_LABEL: Record<ConnState, string> = {
  connecting: "conectando…",
  online: "ao vivo",
  reconnecting: "reconectando…",
  offline: "sem internet",
};

export function Board({
  view,
  roomName,
  code,
  conn,
  busy,
  act,
}: {
  view: GameView;
  roomName: string;
  code: string;
  conn: ConnState;
  busy: boolean;
  act: (a: Action) => Promise<boolean>;
}) {
  const [inspect, setInspect] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const lastTick = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset(view.now - Date.now());
  }, [view.now]);

  // Se algum prazo venceu e ninguém processou, pede um "tick" ao servidor
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now() + offset;
      const deadlines = [
        ...view.prompts.map((p) => p.deadline),
        ...(view.combat?.stage === "resolving" && view.combat.resolveDeadline ? [view.combat.resolveDeadline] : []),
        ...(view.combat?.flee ? [view.combat.flee.deadline] : []),
      ];
      if (deadlines.some((d) => d + 2500 < now) && now - lastTick.current > 4000) {
        lastTick.current = now;
        void act({ type: "TICK" });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [view, offset, act]);

  const me = view.players.find((p) => p.id === view.me)!;
  const others = view.order.map((id) => view.players.find((p) => p.id === id)!).filter((p) => p.id !== view.me);
  const winner = view.players.find((p) => p.id === view.winnerId);
  const topDoor = view.decks.doorDiscard[view.decks.doorDiscard.length - 1];
  const topTreasure = view.decks.treasureDiscard[view.decks.treasureDiscard.length - 1];

  return (
    <GameProvider
      value={{ view, me, isHost: view.hostId === view.me, busy, act, inspect: setInspect, serverOffset: offset }}
    >
      <PickerProvider>
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 p-2 sm:p-3">
          <header className="flex flex-wrap items-center gap-3">
            <Link href="/lobby" className="text-sm text-muted hover:text-ink">
              ← Lobby
            </Link>
            <h1 className="font-display text-xl text-gold-2">{roomName}</h1>
            <span className="rounded bg-panel-2 px-2 py-0.5 font-mono text-xs tracking-widest">{code}</span>
            <span className="text-sm text-muted">Rodada {view.round}</span>
            <span className={`ml-auto text-xs ${conn === "online" ? "text-emerald-400" : "text-amber-400"}`}>● {CONN_LABEL[conn]}</span>
            <Link href="/regras" target="_blank" className="text-xs text-muted underline hover:text-ink">
              Regras
            </Link>
          </header>

          <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
            {others.map((p) => (
              <PlayerPanel key={p.id} p={p} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
            <div className="flex min-w-0 flex-col gap-3">
              <TurnControls />
              {view.combat ? (
                <CombatPanel />
              ) : (
                <section className="flex flex-wrap items-center gap-4 rounded-xl border border-edge bg-panel p-3">
                  <div className="text-center">
                    <div className="flex h-[7.5rem] w-[5.5rem] items-center justify-center rounded-lg border-2 border-red-900 bg-red-950/60 font-display text-red-200">
                      Portas
                      <br />
                      {view.decks.door}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex h-[7.5rem] w-[5.5rem] items-center justify-center rounded-lg border-2 border-amber-800 bg-amber-950/50 font-display text-amber-200">
                      Tesouros
                      <br />
                      {view.decks.treasure}
                    </div>
                  </div>
                  {view.turn.revealed && view.cards[view.turn.revealed] && (
                    <div>
                      <p className="mb-1 text-xs text-muted">Porta aberta neste turno</p>
                      <CardView id={view.turn.revealed} />
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-xs text-muted">Descarte de Portas</p>
                    {topDoor ? <CardView id={topDoor} size="sm" /> : <p className="text-xs text-muted">vazio</p>}
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted">Descarte de Tesouros</p>
                    {topTreasure ? <CardView id={topTreasure} size="sm" /> : <p className="text-xs text-muted">vazio</p>}
                    {view.lastItemDiscard && me.raceId === "goblin" && view.lastItemDiscard.by !== me.id && (
                      <Button size="sm" className="mt-1" onClick={() => act({ type: "CATADOR" })}>
                        👺 Catar item
                      </Button>
                    )}
                  </div>
                  {view.reward && (
                    <div>
                      <p className="mb-1 text-xs text-muted">Tesouros sendo divididos</p>
                      <div className="flex gap-1">
                        {(view.reward.cards ?? []).map((id) => (
                          <CardView key={id} id={id} size="sm" />
                        ))}
                        {!view.reward.cards && <span className="text-xs">{view.reward.count} carta(s)</span>}
                      </div>
                    </div>
                  )}
                </section>
              )}
              <MyArea />
            </div>
            <div className="lg:sticky lg:top-2 lg:h-[calc(100vh-1rem)]">
              <LogPanel />
            </div>
          </div>
        </div>
        <PromptLayer />
        <CardInspector cardId={inspect} onClose={() => setInspect(null)} />
        {winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-w-md rounded-2xl border-2 border-gold bg-panel p-8 text-center">
              <p className="text-5xl">🏆</p>
              <h2 className="mt-3 font-display text-3xl text-gold-2">{winner.name} venceu!</h2>
              <p className="mt-2 text-muted">Chegou ao nível 20 derrotando um monstro.</p>
              <Link href="/lobby" className="mt-6 inline-block rounded-md bg-gold px-4 py-2 font-medium text-black">
                Voltar ao lobby
              </Link>
            </div>
          </div>
        )}
      </PickerProvider>
    </GameProvider>
  );
}
