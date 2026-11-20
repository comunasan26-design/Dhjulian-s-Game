"use client";

import type { PlayerView } from "@/game/engine";
import { CardView } from "./CardView";
import { useGame } from "./GameContext";

export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-gold bg-black/50 font-display text-sm text-gold-2">
      {level}
    </span>
  );
}

export function PlayerPanel({ p }: { p: PlayerView }) {
  const api = useGame();
  const { view } = api;
  const current = view.currentPlayerId === p.id;
  const inCombat = view.combat && (view.combat.fighterId === p.id || view.combat.helperId === p.id);
  return (
    <div
      className={`w-full shrink-0 rounded-xl lg:w-[17rem] border bg-panel p-2 ${current ? "border-gold pulse-ring" : "border-edge"} ${
        inCombat ? "ring-1 ring-red-700" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <LevelBadge level={p.level} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            <span className={`mr-1 inline-block h-2 w-2 rounded-full ${p.online ? "bg-emerald-400" : "bg-stone-600"}`} title={p.online ? "online" : "offline"} />
            {p.name}
            {view.hostId === p.id && <span className="ml-1 text-xs text-gold">👑</span>}
          </p>
          <p className="truncate text-xs text-muted">
            {p.race ? api.name(p.race) : "Sem raça"} · {p.classes.length ? p.classes.map((c) => api.name(c)).join(" / ") : "Sem classe"}
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>
            ⚔️ <span className="text-ink">{p.power}</span>
          </p>
          <p>
            🂠 <span className="text-ink">{p.handCount}</span>
          </p>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {p.curses.map((c) => (
          <span key={c.id} className="rounded bg-purple-900/80 px-1.5 text-[10px] text-purple-100" title={c.name}>
            🕯️ {c.name}
            {c.remaining !== undefined ? ` (${c.remaining})` : ""}
          </span>
        ))}
        {p.pendingCombatCurses.length > 0 && (
          <span className="rounded bg-purple-900/50 px-1.5 text-[10px]">+{p.pendingCombatCurses.length} no próximo combate</span>
        )}
        {p.hibernating && <span className="rounded bg-emerald-900 px-1.5 text-[10px]">🐢 no casco</span>}
        {p.streak > 0 && <span className="rounded bg-red-900 px-1.5 text-[10px]">🔥 fúria {p.streak}</span>}
        {p.needsNewHand && <span className="rounded bg-stone-700 px-1.5 text-[10px]">💀 morreu</span>}
        {view.phase === "SETUP" && <span className="rounded bg-stone-700 px-1.5 text-[10px]">{p.ready ? "✅ pronto" : "⏳ preparando"}</span>}
      </div>
      {(p.equipped.length > 0 || p.carried.length > 0) && (
        <div className="scroll-thin mt-2 flex max-h-40 gap-1 overflow-x-auto lg:flex-wrap lg:overflow-y-auto lg:overflow-x-hidden">
          {p.equipped.map((id) => (
            <CardView key={id} id={id} size="sm" />
          ))}
          {p.carried.map((id) => (
            <CardView key={id} id={id} size="sm" dim badge="mesa" />
          ))}
        </div>
      )}
    </div>
  );
}
