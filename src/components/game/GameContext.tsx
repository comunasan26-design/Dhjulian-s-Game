"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CardDef } from "@/game/catalog";
import { cardDef } from "@/game/display";
import type { Action, GameView, PlayerView } from "@/game/engine";

export interface GameApi {
  view: GameView;
  me: PlayerView;
  isHost: boolean;
  busy: boolean;
  act: (a: Action) => Promise<boolean>;
  def: (cardId: string) => CardDef | null;
  name: (cardId: string) => string;
  playerName: (id: string | null | undefined) => string;
  inspect: (cardId: string) => void;
  serverOffset: number;
}

const Ctx = createContext<GameApi | null>(null);

export function useGame(): GameApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("GameProvider ausente");
  return c;
}

export function useGameOptional(): GameApi | null {
  return useContext(Ctx);
}

export function GameProvider({ value, children }: { value: Omit<GameApi, "def" | "name" | "playerName">; children: ReactNode }) {
  const def = (id: string) => {
    const c = value.view.cards[id];
    return c ? cardDef(c.defId) : null;
  };
  const api: GameApi = {
    ...value,
    def,
    name: (id) => def(id)?.name ?? "Carta oculta",
    playerName: (id) => value.view.players.find((p) => p.id === id)?.name ?? "—",
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
