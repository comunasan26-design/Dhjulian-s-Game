"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Action, GameView } from "@/game/engine";
import type { ConnState } from "../room/useRoom";
import { Button } from "../ui/Button";
import { GameFx, SoundToggle } from "../fx/GameFx";
import { CardInspector } from "./CardInspector";
import { type CurseRef, CurseInspector } from "./CurseInspector";
import { CardBackside } from "../art/CardArt";
import { DragDiscardZone, setDropHandler } from "../art/drag";
import { CardView } from "./CardView";
import { CombatReturnBar, CombatScreen, combatRole } from "./CombatScreen";
import { GameProvider, useGame } from "./GameContext";
import { dropCard } from "./flows";
import { LogPanel } from "./LogPanel";
import { MobileHand, MyArea } from "./MyArea";
import { PickerProvider, usePicker } from "./Picker";
import { PlayerPanel } from "./PlayerPanel";
import { PromptLayer } from "./PromptLayer";
import { TurnControls } from "./TurnControls";

type MobileTab = "mesa" | "eu" | "jogadores" | "log";

/** Esconde a seção no celular quando não é a aba ativa (no desktop tudo aparece). */
function show(active: boolean): string {
  return active ? "" : "hidden lg:block";
}

const CONN_LABEL: Record<ConnState, string> = {
  connecting: "conectando…",
  online: "conectado",
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
  backHref = "/lobby",
}: {
  view: GameView;
  roomName: string;
  code: string;
  conn: ConnState;
  busy: boolean;
  act: (a: Action) => Promise<boolean>;
  backHref?: string;
}) {
  const [inspect, setInspect] = useState<string | null>(null);
  const [curseRef, setCurseRef] = useState<CurseRef | null>(null);
  const [tab, setTab] = useState<MobileTab>("mesa");
  const [seenLog, setSeenLog] = useState(0);
  const lastCombat = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const lastTick = useRef(0);
  /** Tela de batalha minimizada (para ver a mesa) neste combate/visão. */
  const [minimized, setMinimized] = useState<string | null>(null);

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

  // No celular, volta para a aba da mesa quando começa um combate
  useEffect(() => {
    const id = view.combat?.id ?? null;
    if (id !== null && id !== lastCombat.current) {
      setTab("mesa");
    }
    lastCombat.current = id;
  }, [view.combat?.id]);

  const lastChat = [...view.log].reverse().find((l) => l.kind === "chat")?.id ?? 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "log") setSeenLog(lastChat);
  }, [tab, lastChat]);

  const me = view.players.find((p) => p.id === view.me)!;
  const others = view.order.map((id) => view.players.find((p) => p.id === id)!).filter((p) => p.id !== view.me);
  const winner = view.players.find((p) => p.id === view.winnerId);
  const combatKey = view.combat ? `${view.combat.id}:${combatRole(view)}` : null;
  const combatOpen = !!combatKey && view.phase !== "FINISHED" && minimized !== combatKey;

  return (
    <GameProvider
      value={{ view, me, isHost: view.hostId === view.me, busy, act, inspect: setInspect, inspectCurse: (playerId, curseId) => setCurseRef({ playerId, curseId }), serverOffset: offset }}
    >
      <PickerProvider>
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 p-2 pb-20 sm:p-3 lg:pb-3">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={backHref} className="text-sm text-muted hover:text-ink">
              ←
            </Link>
            <h1 className="max-w-[45vw] truncate font-display text-lg text-gold-2 sm:max-w-none sm:text-xl">{roomName}</h1>
            <span className="rounded bg-panel-2 px-2 py-0.5 font-mono text-xs tracking-widest">{code}</span>
            <span className="text-xs text-muted sm:text-sm">Rodada {view.round}</span>
            <span className="text-xs text-muted lg:hidden">
              · Nível {me.level} · ⚔️ {me.power}
            </span>
            <span className={`ml-auto text-xs ${conn === "online" ? "text-emerald-400" : "text-amber-400"}`}>● {CONN_LABEL[conn]}</span>
            <SoundToggle />
            <Link href="/regras" target="_blank" className="hidden text-xs text-muted underline hover:text-ink sm:inline">
              Regras
            </Link>
            {view.phase !== "FINISHED" && <SurrenderButton act={act} />}
          </header>

          <div className={`${show(tab === "jogadores")} lg:block`}>
            <div className="flex flex-col gap-2 lg:scroll-thin lg:flex-row lg:overflow-x-auto lg:pb-1">
              {others.map((p) => (
                <PlayerPanel key={p.id} p={p} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className={`sticky top-0 z-20 lg:static ${show(tab === "mesa")}`}>
                <TurnControls />
              </div>
              <div className={show(tab === "mesa")}>
                {view.combat && !combatOpen && <CombatReturnBar onOpen={() => setMinimized(null)} />}
                {!view.combat && <TableArea view={view} me={me} act={act} />}
              </div>
              {tab === "mesa" && <MobileHand />}
              <div className={show(tab === "eu")}>
                <MyArea />
              </div>
            </div>
            <div className={`lg:sticky lg:top-2 lg:h-[calc(100vh-1rem)] ${show(tab === "log")} ${tab === "log" ? "h-[calc(100dvh-7rem)]" : ""}`}>
              <LogPanel />
            </div>
          </div>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-edge bg-panel/95 backdrop-blur lg:hidden">
          {(
            [
              ["mesa", "🎲", "Mesa", view.currentPlayerId === me.id || !!view.combat],
              ["eu", "🧙", "Você", false],
              ["jogadores", "👥", `Jogadores`, false],
              ["log", "💬", "Histórico", lastChat > seenLog],
            ] as [MobileTab, string, string, boolean][]
          ).map(([key, icon, label, dot]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === key ? "text-gold-2" : "text-muted"}`}
            >
              <span className="text-lg leading-none">{icon}</span>
              {label}
              {dot && <span className="absolute right-[30%] top-1.5 h-2 w-2 rounded-full bg-gold" />}
            </button>
          ))}
        </nav>
        {combatOpen && <CombatScreen onMinimize={() => setMinimized(combatKey)} />}
        <PromptLayer hideCombatBubbles={combatOpen} />
        <DropBridge onInspect={setInspect} />
        <DragDiscardZone />
        <GameFx view={view} />
        <CardInspector cardId={inspect} onClose={() => setInspect(null)} />
        <CurseInspector target={curseRef} onClose={() => setCurseRef(null)} />
        {winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-w-md rounded-2xl border-2 border-gold bg-panel p-8 text-center">
              <p className="text-5xl">🏆</p>
              <h2 className="mt-3 font-display text-3xl text-gold-2">{winner.name} venceu!</h2>
              <p className="mt-2 text-muted">Chegou ao nível 20 derrotando um monstro.</p>
              <Link href={backHref} className="mt-6 inline-block rounded-md bg-gold px-4 py-2 font-medium text-black">
                Voltar
              </Link>
            </div>
          </div>
        )}
      </PickerProvider>
    </GameProvider>
  );
}

/** Baralhos, descartes e porta aberta (quando não há combate). */
function TableArea({ view, me, act }: { view: GameView; me: GameView["players"][number]; act: (a: Action) => Promise<boolean> }) {
  const topDoor = view.decks.doorDiscard[view.decks.doorDiscard.length - 1];
  const topTreasure = view.decks.treasureDiscard[view.decks.treasureDiscard.length - 1];
  return (
    <section data-drop="table" className="drop-zone flex flex-wrap items-start gap-3 rounded-xl border border-edge bg-panel p-3 sm:gap-4">
      <div className="flex gap-3">
        <DeckPile deck="door" label="Portas" count={view.decks.door} />
        <DeckPile deck="treasure" label="Tesouros" count={view.decks.treasure} />
      </div>
      {view.turn.revealed && view.cards[view.turn.revealed] && (
        <div>
          <p className="mb-1 text-xs text-muted">Porta aberta</p>
          <CardView id={view.turn.revealed} />
        </div>
      )}
      <div data-drop="discard" className="drop-zone rounded-lg">
        <p className="mb-1 text-xs text-muted">Descarte de Portas</p>
        {topDoor ? <CardView id={topDoor} size="sm" /> : <p className="text-xs text-muted">vazio</p>}
      </div>
      <div data-drop="discard" className="drop-zone rounded-lg">
        <p className="mb-1 text-xs text-muted">Descarte de Tesouros</p>
        {topTreasure ? <CardView id={topTreasure} size="sm" /> : <p className="text-xs text-muted">vazio</p>}
        {view.lastItemDiscard && me.passives.includes("catador") && view.lastItemDiscard.by !== me.id && (
          <Button size="sm" className="mt-1" onClick={() => act({ type: "CATADOR" })}>
            👺 Catar item
          </Button>
        )}
      </div>
      {view.reward && (
        <div className="w-full min-w-0 basis-full">
          <p className="mb-1 text-xs text-muted">Tesouros sendo divididos</p>
          <div className="flex flex-wrap gap-1">
            {(view.reward.cards ?? []).map((id) => (
              <CardView key={id} id={id} size="sm" />
            ))}
            {!view.reward.cards && <span className="text-xs">{view.reward.count} carta(s)</span>}
          </div>
        </div>
      )}
    </section>
  );
}

/** Recebe as cartas soltas por arraste e decide a jogada. */
function DropBridge({ onInspect }: { onInspect: (id: string) => void }) {
  const api = useGame();
  const picker = usePicker();
  const ref = useRef({ api, picker, onInspect });
  useEffect(() => {
    ref.current = { api, picker, onInspect };
  });
  useEffect(() => {
    setDropHandler(async (cardId, target) => {
      const { api: a, picker: p, onInspect: open } = ref.current;
      const r = await dropCard(a, p, cardId, target);
      if (r === "inspect") open(cardId);
    });
    return () => setDropHandler(null);
  }, []);
  return null;
}

/** Pilha de cartas viradas (baralho) com contador. */
function DeckPile({ deck, label, count }: { deck: "door" | "treasure"; label: string; count: number }) {
  const layers = Math.min(3, Math.ceil(count / 30));
  return (
    <div className="flex flex-col items-center">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <div className="relative">
        {Array.from({ length: layers }, (_, i) => (
          <div key={i} className="absolute inset-0" style={{ transform: `translate(${(layers - i) * 2}px, ${(layers - i) * 2}px)` }}>
            <div className="game-card relative aspect-[5/7] w-[5.25rem] opacity-80 sm:w-[6rem]">
              <CardBackside deck={deck} />
            </div>
          </div>
        ))}
        <div className="game-card relative aspect-[5/7] w-[5.25rem] sm:w-[6rem]">
          <CardBackside deck={deck} />
          <span className="absolute bottom-[8%] left-1/2 z-10 -translate-x-1/2 rounded-full border border-gold/60 bg-black/80 px-2 font-display text-sm text-gold-2">
            {count}
          </span>
        </div>
      </div>
    </div>
  );
}

function SurrenderButton({ act }: { act: (a: Action) => Promise<boolean> }) {
  const [ask, setAsk] = useState(false);
  if (!ask)
    return (
      <button onClick={() => setAsk(true)} className="text-xs text-muted hover:text-red-300" title="Desistir da partida">
        🏳️ Desistir
      </button>
    );
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-red-300">Desistir? Conta como morte e você sai da partida.</span>
      <Button size="sm" variant="danger" onClick={() => act({ type: "SURRENDER" })}>
        Sim
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setAsk(false)}>
        Não
      </Button>
    </span>
  );
}
