"use client";

import { KIND_ICON, KIND_LABEL, KIND_STYLE, cardDef, shortInfo } from "@/game/display";
import { useGameOptional } from "./GameContext";

export function CardView({
  id,
  defId,
  onClick,
  selected,
  size = "md",
  badge,
  dim,
}: {
  id?: string;
  defId?: string;
  onClick?: () => void;
  selected?: boolean;
  size?: "sm" | "md";
  badge?: string;
  dim?: boolean;
}) {
  const game = useGameOptional();
  const inst = id ? game?.view.cards[id] : undefined;
  const d = defId ? cardDef(defId) : inst ? cardDef(inst.defId) : null;
  const w = size === "sm" ? "w-[5.75rem] sm:w-[6.5rem]" : "w-[7rem] sm:w-[8.5rem]";
  const h = size === "sm" ? "min-h-[4.25rem] sm:min-h-[4.5rem]" : "min-h-[6.5rem] sm:min-h-[7.5rem]";
  const click = onClick ?? (id && game ? () => game.inspect(id) : undefined);

  if (!d) {
    return (
      <div className={`${w} ${h} rounded-lg border border-edge bg-[repeating-linear-gradient(45deg,#2a221c,#2a221c_6px,#221b16_6px,#221b16_12px)]`} />
    );
  }
  const bonus =
    d.kind === "item"
      ? (inst?.tamed ? 0 : d.bonus) + (inst?.reforged ? 1 : 0)
      : d.kind === "monster" && inst?.tamed
        ? d.treasures
        : null;
  return (
    <button
      type="button"
      onClick={click}
      title={d.name}
      className={`relative flex shrink-0 ${w} ${h} flex-col rounded-lg border-2 p-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${KIND_STYLE[d.kind]} ${
        selected ? "ring-2 ring-gold-2 ring-offset-2 ring-offset-bg" : ""
      } ${dim ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted">
          {KIND_ICON[d.kind]} {inst?.tamed ? "Montaria domada" : KIND_LABEL[d.kind]}
        </span>
        {d.kind === "monster" && !inst?.tamed && (
          <span className="rounded bg-red-700 px-1 text-[11px] font-bold text-white">{d.level}</span>
        )}
        {bonus !== null && bonus !== 0 && (
          <span className="rounded bg-amber-600 px-1 text-[11px] font-bold text-black">+{bonus}</span>
        )}
        {d.kind === "monsterBonus" && (
          <span className={`rounded px-1 text-[11px] font-bold ${d.value > 0 ? "bg-red-700 text-white" : "bg-emerald-700 text-white"}`}>
            {d.value > 0 ? "+" : ""}
            {d.value}
          </span>
        )}
      </div>
      <div className={`mt-0.5 font-display leading-tight text-ink ${size === "sm" ? "text-[11px] sm:text-[12px]" : "text-[12px] sm:text-[13px]"}`}>{d.name}</div>
      {size === "md" && <div className="mt-auto pt-1 text-[10px] leading-tight text-muted">{inst?.tamed ? "Monstro domado" : shortInfo(d)}</div>}
      {(inst?.runes?.length ?? 0) > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-black">ᚱ{inst!.runes!.length}</span>
      )}
      {inst?.artificeSecond && <span className="absolute -left-1 -top-1 rounded-full bg-sky-500 px-1 text-[10px] text-black">½</span>}
      {badge && <span className="absolute -bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-gold-2">{badge}</span>}
    </button>
  );
}
