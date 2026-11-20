"use client";

import { CardBackside, CardFront } from "../art/CardArt";
import { RuneHalo } from "../art/RuneHalo";
import { METAL_OF, rarityOf } from "../art/metals";
import { useDraggable } from "../art/drag";
import { instLines, openZoom, useHold } from "../art/zoom";
import { cardDef } from "@/game/display";
import { useGameOptional } from "./GameContext";

const WIDTH = {
  sm: "w-[5.25rem] sm:w-[6rem]",
  md: "w-[7rem] sm:w-[8.5rem]",
};

/**
 * Carta do jogo: moldura de metal (raridade) + gema (tipo).
 * Toque/clique abre as ações; segurar (ou botão direito) ergue a carta para ver de perto e virar.
 */
export function CardView({
  id,
  defId,
  onClick,
  selected,
  size = "md",
  badge,
  dim,
  deck,
  draggable = false,
}: {
  id?: string;
  defId?: string;
  onClick?: () => void;
  selected?: boolean;
  size?: "sm" | "md";
  badge?: string;
  dim?: boolean;
  /** Para cartas ocultas: de qual baralho é o verso. */
  deck?: "door" | "treasure";
  /** Pode ser arrastada para ser jogada (cartas da sua mão). */
  draggable?: boolean;
}) {
  const game = useGameOptional();
  const inst = id ? game?.view.cards[id] : undefined;
  const d = defId ? cardDef(defId) : inst ? cardDef(inst.defId) : null;
  const click = onClick ?? (id && game ? () => game.inspect(id) : undefined);
  const hold = useHold(
    d
      ? () =>
          openZoom({
            defId: d.id,
            inst: inst ? { reforged: inst.reforged, runes: inst.runes, charges: inst.charges, tamed: inst.tamed, artificeSecond: inst.artificeSecond } : undefined,
            extra: instLines(inst, (r) => game?.name(r) ?? r),
          })
      : null,
  );
  const instInfo = inst ? { reforged: inst.reforged, runes: inst.runes, charges: inst.charges, tamed: inst.tamed, artificeSecond: inst.artificeSecond } : undefined;
  const dragger = useDraggable(id, d?.id, instInfo, draggable && !!d, hold.cancel);
  // combina segurar + arrastar nos mesmos eventos de ponteiro
  const handlers: Record<string, (e: never) => void> = {};
  for (const src of [hold.handlers, dragger.handlers] as Record<string, (e: never) => void>[]) {
    for (const [k, fn] of Object.entries(src)) {
      const prev = handlers[k];
      handlers[k] = prev ? (e: never) => (prev(e), fn(e)) : fn;
    }
  }
  const runes = inst?.runes?.length ?? 0;
  const metal = METAL_OF[rarityOf(d)];

  return (
    <button
      type="button"
      {...handlers}
      onClick={() => {
        if (dragger.consumed() || hold.consumed()) return;
        click?.();
      }}
      title={d ? `${d.name} — segure para ver de perto` : "Carta oculta"}
      aria-label={d ? d.name : "Carta oculta"}
      className={`game-card relative block aspect-[5/7] shrink-0 rounded-[7%/5%] text-left ${WIDTH[size]} ${click ? "interactive cursor-pointer" : "cursor-default"} ${
        d ? `metal-${metal}` : ""
      } ${hold.holding ? "holding" : ""} ${draggable && d ? "draggable-card" : ""} ${selected ? "ring-[3px] ring-gold-2 ring-offset-2 ring-offset-bg" : ""} ${dim ? "opacity-50 grayscale" : ""}`}
    >
      {runes > 0 && <RuneHalo count={runes} layer="back" />}
      {d ? <CardFront d={d} inst={inst} size={size} /> : <CardBackside deck={deck} />}
      {runes > 0 && <RuneHalo count={runes} layer="front" />}
      {inst?.artificeSecond && (
        <span className="absolute -left-1 -top-1 z-20 rounded-full border border-sky-900 bg-sky-400 px-1.5 text-[10px] font-bold text-black">½</span>
      )}
      {badge && (
        <span className="absolute -left-1 -top-2 z-20 whitespace-nowrap rounded border border-gold/50 bg-black/85 px-1.5 text-[10px] text-gold-2">
          {badge}
        </span>
      )}
    </button>
  );
}
