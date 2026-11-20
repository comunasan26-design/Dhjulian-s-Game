import { CLASSES } from "./classes";
import { CURSES, MONSTER_BONUSES, WANDERING } from "./doors";
import { MONSTERS } from "./monsters";
import { RACES } from "./races";
import { ITEMS, LEVEL_UPS, MISC, POTIONS, RUNES } from "./treasures";
import type {
  CardDef,
  ClassCard,
  ClassId,
  CurseCard,
  ItemCard,
  MonsterCard,
  RaceCard,
  RaceId,
} from "./types";

export * from "./types";

export const ALL_CARDS: CardDef[] = [
  ...RACES,
  ...CLASSES,
  ...MONSTERS,
  ...CURSES,
  ...MONSTER_BONUSES,
  ...WANDERING,
  ...ITEMS,
  ...POTIONS,
  ...RUNES,
  ...MISC,
  ...LEVEL_UPS,
];

export const CARD_DEFS: Record<string, CardDef> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

export function def(defId: string): CardDef {
  const d = CARD_DEFS[defId];
  if (!d) throw new Error(`Carta desconhecida: ${defId}`);
  return d;
}

export function raceDef(id: RaceId): RaceCard {
  return def(`race.${id}`) as RaceCard;
}

export function classDef(id: ClassId): ClassCard {
  return def(`class.${id}`) as ClassCard;
}

export function isItem(d: CardDef): d is ItemCard {
  return d.kind === "item";
}
export function isMonster(d: CardDef): d is MonsterCard {
  return d.kind === "monster";
}
export function isCurse(d: CardDef): d is CurseCard {
  return d.kind === "curse";
}

/** Preço de venda de uma carta (0 se não pode ser vendida). */
export function priceOf(d: CardDef): number {
  if ("price" in d) return d.price;
  return 0;
}

export { CLASSES, CURSES, ITEMS, LEVEL_UPS, MISC, MONSTER_BONUSES, MONSTERS, POTIONS, RACES, RUNES, WANDERING };
