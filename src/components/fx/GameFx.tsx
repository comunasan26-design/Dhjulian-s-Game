"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CARD_DEFS } from "@/game/catalog";
import type { GameView } from "@/game/engine";
import { engine, type Mood, type SfxName } from "@/lib/audio/sound";
import { LottiePlayer, preloadLottie } from "./Lottie";

interface FxEvent {
  key: number;
  anim: string;
  title: string;
  sub?: string;
}

const ANIMS = ["nivel", "combate", "vitoria", "morte", "maldicao", "runa", "fim", "tesouro", "fuga"];

function moodOf(v: GameView): Mood {
  if (v.phase === "FINISHED") return v.winnerId === v.me ? "victory" : "defeat";
  if (v.combat) {
    const boss = v.combat.monsters.some((m) => {
      const d = CARD_DEFS[v.cards[m.cardId]?.defId ?? ""];
      return d?.kind === "monster" && d.legendary;
    });
    return boss ? "boss" : "combat";
  }
  return "calm";
}

const clean = (t: string) => t.replace(/^[^\p{L}\p{N}]+/u, "");

/** Compara a visão anterior com a atual e devolve sons e animações a tocar. */
function detect(prev: GameView, cur: GameView): { sounds: SfxName[]; anims: Omit<FxEvent, "key">[] } {
  const sounds = new Set<SfxName>();
  const anims: Omit<FxEvent, "key">[] = [];
  const me = cur.players.find((p) => p.id === cur.me);
  const myName = me?.name ?? "";
  const lastId = prev.log.length ? prev.log[prev.log.length - 1].id : 0;

  if (!prev.combat && cur.combat) {
    sounds.add("combat");
    const m = cur.combat.monsters[0];
    const name = m ? CARD_DEFS[cur.cards[m.cardId]?.defId ?? ""]?.name : undefined;
    anims.push({ anim: "combate", title: "Combate!", sub: name });
  }

  for (const l of cur.log) {
    if (l.id <= lastId) continue;
    if (l.kind === "dice") sounds.add("dice");
    if (/derrotaram/.test(l.text)) {
      sounds.add("win");
      anims.push({ anim: "vitoria", title: "Monstro derrotado!", sub: clean(l.text) });
    } else if (/morreu/.test(l.text)) {
      sounds.add("death");
      anims.push({ anim: "morte", title: l.text.includes(myName) && l.by === cur.me ? "Você morreu!" : "Morte!", sub: clean(l.text) });
    } else if (l.kind === "curse" && /(lançou|revelou)/.test(l.text)) {
      sounds.add("curse");
      if (l.text.endsWith(` em ${myName}.`)) anims.push({ anim: "maldicao", title: "Você foi amaldiçoado!", sub: clean(l.text) });
    } else if (/ fugiu de /.test(l.text) || /conseguiu fugir/.test(l.text)) {
      sounds.add("flee");
      if (l.text.includes(`${myName} `)) anims.push({ anim: "fuga", title: "Fugiu!", sub: clean(l.text) });
    } else if (/não fugiu/.test(l.text)) {
      sounds.add("lose");
    }
  }

  for (const p of cur.players) {
    const before = prev.players.find((x) => x.id === p.id);
    if (!before) continue;
    if (p.level > before.level) {
      sounds.add("levelUp");
      if (p.id === cur.me) anims.push({ anim: "nivel", title: `Nível ${p.level}!`, sub: "Você subiu de nível" });
    } else if (p.level < before.level && p.id === cur.me) {
      sounds.add("levelDown");
    }
  }

  for (const [id, c] of Object.entries(cur.cards)) {
    const n = c.runes?.length ?? 0;
    if (n > (prev.cards[id]?.runes?.length ?? 0)) {
      sounds.add("rune");
      anims.push({ anim: "runa", title: "Runa encaixada!", sub: CARD_DEFS[c.defId]?.name });
    }
  }

  if (!prev.reward && cur.reward) {
    sounds.add("treasure");
    if (cur.reward.fighterId === cur.me || cur.reward.helperId === cur.me) anims.push({ anim: "tesouro", title: "Tesouros!", sub: `${cur.reward.count} carta(s)` });
  }

  if (prev.phase !== "FINISHED" && cur.phase === "FINISHED") {
    const w = cur.players.find((p) => p.id === cur.winnerId);
    sounds.add(cur.winnerId === cur.me ? "gameWin" : "gameLose");
    anims.push({ anim: cur.winnerId === cur.me ? "fim" : "morte", title: cur.winnerId === cur.me ? "Vitória!" : `${w?.name ?? "Alguém"} venceu!` });
  }
  return { sounds: [...sounds], anims };
}

/** Trilha sonora + efeitos + animações de eventos da partida. */
export function GameFx({ view }: { view: GameView }) {
  const prev = useRef<GameView | null>(null);
  const counter = useRef(0);
  const [queue, setQueue] = useState<FxEvent[]>([]);

  useEffect(() => {
    preloadLottie(ANIMS);
    const unlock = () => engine.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      engine.setMood("off");
    };
  }, []);

  useEffect(() => {
    engine.setMood(moodOf(view));
    const p = prev.current;
    prev.current = view;
    if (!p) return;
    const { sounds, anims } = detect(p, view);
    sounds.forEach((s) => engine.sfx(s));
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (anims.length && !reduce) {
      setQueue((q) => [...q, ...anims.map((a) => ({ ...a, key: ++counter.current }))].slice(-3));
    }
  }, [view]);

  const cur = queue[0];
  if (!cur) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[12%] z-40 flex flex-col items-center">
      <div key={cur.key} className="fx-pop flex flex-col items-center">
        <LottiePlayer name={cur.anim} className="h-48 w-48 sm:h-60 sm:w-60" onDone={() => setQueue((q) => q.slice(1))} />
        <p className="-mt-4 rounded-full bg-black/70 px-4 py-1 font-display text-xl text-gold-2 shadow-lg sm:text-2xl">{cur.title}</p>
        {cur.sub && <p className="mt-1 max-w-[80vw] rounded bg-black/60 px-2 py-0.5 text-center text-xs text-ink/90">{cur.sub}</p>}
      </div>
    </div>
  );
}

/** Botão de som (liga/desliga) com volume. */
export function SoundToggle() {
  const state = useSyncExternalStore(
    (l) => engine.subscribe(l),
    () => `${engine.enabled}|${engine.volume}`,
    () => "true|0.6",
  );
  const [on, vol] = state.split("|");
  const enabled = on === "true";
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => engine.setEnabled(!enabled)}
        className="flex items-center gap-1 rounded px-1 text-xs text-muted hover:text-ink"
        title={enabled ? "Desligar som e música" : "Ligar som e música"}
        aria-label={enabled ? "Desligar som" : "Ligar som"}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {enabled ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M16 9l5 6M21 9l-5 6" />}
        </svg>
        <span className="hidden sm:inline">{enabled ? "Som" : "Mudo"}</span>
      </button>
      {enabled && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={Number(vol)}
          onChange={(e) => engine.setVolume(Number(e.target.value))}
          className="hidden w-16 accent-[var(--color-gold)] sm:block"
          aria-label="Volume"
        />
      )}
    </span>
  );
}
