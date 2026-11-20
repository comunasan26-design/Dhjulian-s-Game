import type { Fx } from "./effects";
import { loadCatalog } from "./load";
import type { CardDef, ClassCard, ClassId, CurseCard, GameRules, ItemCard, MonsterCard, RaceCard, RaceId } from "./types";

export * from "./types";
export type { Fx } from "./effects";

const loaded = loadCatalog();
if (loaded.problems.length > 0) {
  throw new Error(`Há problemas nos arquivos de cartas (pasta /cartas):\n- ${loaded.problems.join("\n- ")}`);
}

export const RULES: GameRules = loaded.rules;
export const RACES = loaded.races;
export const CLASSES = loaded.classes;
export const ITEMS = loaded.items;
export const POTIONS = loaded.potions;
export const RUNES = loaded.runes;
export const MISC = loaded.misc;
export const LEVEL_UPS = loaded.levelUps;
export const MONSTERS = loaded.monsters;
export const CURSES = loaded.curses;
export const MONSTER_BONUSES = loaded.bonuses;
export const WANDERING = loaded.wandering;

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

export function raceDef(id: RaceId): RaceCard | undefined {
  return CARD_DEFS[`race.${id}`] as RaceCard | undefined;
}

export function classDef(id: ClassId): ClassCard | undefined {
  return CARD_DEFS[`class.${id}`] as ClassCard | undefined;
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

/** Efeitos de uma carta (pelo id da definição). */
export function fxOf(defId: string | undefined): Fx[] {
  if (!defId) return [];
  return CARD_DEFS[defId]?.fx ?? [];
}

export function findFx(defId: string | undefined, tipo: string): Fx | undefined {
  return fxOf(defId).find((f) => f.tipo === tipo);
}

export function allFx(defId: string | undefined, tipo: string): Fx[] {
  return fxOf(defId).filter((f) => f.tipo === tipo);
}
