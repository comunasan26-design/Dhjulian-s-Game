import { CARD_DEFS, type CardDef, RARITY_LABEL, SLOT_LABEL, TAG_LABEL } from "./catalog";

export const KIND_LABEL: Record<CardDef["kind"], string> = {
  race: "Raça",
  class: "Classe",
  item: "Item",
  potion: "Poção",
  rune: "Runa",
  misc: "Item diverso",
  levelup: "Subir de nível",
  monster: "Monstro",
  curse: "Maldição",
  monsterBonus: "Bônus de monstro",
  wandering: "Monstro Errante",
};

export const KIND_STYLE: Record<CardDef["kind"], string> = {
  race: "border-emerald-600/70 bg-emerald-950/60",
  class: "border-sky-600/70 bg-sky-950/60",
  item: "border-amber-600/70 bg-amber-950/50",
  potion: "border-teal-500/70 bg-teal-950/60",
  rune: "border-cyan-400/60 bg-cyan-950/50",
  misc: "border-stone-500/70 bg-stone-900/70",
  levelup: "border-yellow-400/80 bg-yellow-950/50",
  monster: "border-red-600/80 bg-red-950/60",
  curse: "border-purple-500/80 bg-purple-950/60",
  monsterBonus: "border-orange-500/70 bg-orange-950/50",
  wandering: "border-rose-500/70 bg-rose-950/50",
};

export const KIND_ICON: Record<CardDef["kind"], string> = {
  race: "🧬",
  class: "🎓",
  item: "🛡️",
  potion: "🧪",
  rune: "ᚱ",
  misc: "🎒",
  levelup: "⬆️",
  monster: "👹",
  curse: "🕯️",
  monsterBonus: "💢",
  wandering: "🚶",
};

export function cardDef(defId: string): CardDef {
  return CARD_DEFS[defId];
}

/** Linha curta descrevendo a carta. */
export function shortInfo(d: CardDef): string {
  switch (d.kind) {
    case "item": {
      const parts = [SLOT_LABEL[d.slot]];
      if (d.hands === 2) parts.push("2 mãos");
      if (d.big) parts.push("Grande");
      parts.push(RARITY_LABEL[d.rarity]);
      return parts.join(" · ");
    }
    case "monster":
      return `Nível ${d.level}${d.tags.length ? " · " + d.tags.map((t) => TAG_LABEL[t]).join(", ") : ""}${d.legendary ? " · Lendário" : ""}`;
    case "curse":
      return { instant: "Instantânea", combat: "De combate", duration: `Duração ${d.duration} rodada(s)`, persistent: "Persistente" }[d.curseType];
    case "potion":
    case "rune":
    case "misc":
      return RARITY_LABEL[d.rarity];
    case "monsterBonus":
      return `${d.value > 0 ? "+" : ""}${d.value} no monstro`;
    default:
      return KIND_LABEL[d.kind];
  }
}

export function fullText(d: CardDef): string[] {
  switch (d.kind) {
    case "race":
    case "class":
      return [`Passiva — ${d.passive.name}: ${d.passive.text}`, `Ativa — ${d.active.name}: ${d.active.text}`];
    case "item": {
      const lines = [`Bônus +${d.bonus}${d.flee ? ` · Fugir ${d.flee > 0 ? "+" : ""}${d.flee}` : ""} · ${d.price} de ouro`];
      if (d.text) lines.push(d.text);
      return lines;
    }
    case "monster":
      return [
        `Especial: ${d.special}`,
        `Coisas Ruins: ${d.badStuffText}`,
        `Recompensa: ${d.treasures} tesouro(s) · ${d.levels} nível(is)`,
      ];
    case "potion":
    case "rune":
    case "misc":
      return [d.text, `${d.price} de ouro`];
    default:
      return [d.text];
  }
}
