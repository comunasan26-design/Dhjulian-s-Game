// Acesso aos efeitos das cartas (definidos nos JSON da pasta /cartas).
import { findFx, fxOf, type Fx } from "../catalog";
import type { CombatMonster, CombatState, GameState, PlayerState } from "./state";
import { classesOf, raceOf } from "./util";

export type { Fx };

export function num(fx: Fx | undefined, key: string, fallback = 0): number {
  const v = fx?.[key];
  return typeof v === "number" ? v : fallback;
}

export function flag(fx: Fx | undefined, key: string): boolean {
  return fx?.[key] === true;
}

export function strs(fx: Fx | undefined, key: string): string[] {
  const v = fx?.[key];
  return Array.isArray(v) ? (v as string[]) : [];
}

export function text(fx: Fx | undefined, key: string): string | undefined {
  const v = fx?.[key];
  return typeof v === "string" ? v : undefined;
}

/** Efeito de uma carta (instância). */
export function cardFx(state: GameState, cardId: string, tipo: string): Fx | undefined {
  return findFx(state.cards[cardId]?.defId, tipo);
}

export function cardFxAll(state: GameState, cardId: string, tipo: string): Fx[] {
  return fxOf(state.cards[cardId]?.defId).filter((f) => f.tipo === tipo);
}

/** Primeiro item equipado com o efeito. */
export function equippedFx(state: GameState, p: PlayerState, tipo: string): { cardId: string; fx: Fx } | null {
  for (const id of p.equipped) {
    const fx = cardFx(state, id, tipo);
    if (fx) return { cardId: id, fx };
  }
  return null;
}

export function equippedFxAll(state: GameState, p: PlayerState, tipo: string): { cardId: string; fx: Fx }[] {
  const out: { cardId: string; fx: Fx }[] = [];
  for (const id of p.equipped) for (const fx of cardFxAll(state, id, tipo)) out.push({ cardId: id, fx });
  return out;
}

/** Primeira carta na mão/mesa (não equipada) com o efeito. */
export function heldFx(state: GameState, p: PlayerState, tipo: string): { cardId: string; fx: Fx } | null {
  for (const id of [...p.hand, ...p.carried]) {
    const fx = cardFx(state, id, tipo);
    if (fx) return { cardId: id, fx };
  }
  return null;
}

/** Efeitos das runas engastadas num item. */
export function runeFx(state: GameState, itemId: string, tipo: string): Fx[] {
  const out: Fx[] = [];
  for (const r of state.cards[itemId]?.runes ?? []) for (const fx of cardFxAll(state, r, tipo)) out.push(fx);
  return out;
}

/** Runas com o efeito em qualquer item equipado. */
export function equippedRuneFx(state: GameState, p: PlayerState, tipo: string): Fx[] {
  return p.equipped.flatMap((id) => runeFx(state, id, tipo));
}

/** Maldições ativas no jogador com o efeito. */
export function curseFx(p: PlayerState, tipo: string): Fx[] {
  const out: Fx[] = [];
  for (const c of p.curses) for (const fx of fxOf(c.defId)) if (fx.tipo === tipo) out.push(fx);
  return out;
}

export function hasCurseFx(p: PlayerState, tipo: string): boolean {
  return p.curses.some((c) => findFx(c.defId, tipo));
}

/** Efeitos dos monstros do combate (só os que estão com o Especial valendo). */
export function combatFx(state: GameState, combat: CombatState | null, tipo: string): { cm: CombatMonster; fx: Fx }[] {
  if (!combat) return [];
  const out: { cm: CombatMonster; fx: Fx }[] = [];
  for (const cm of combat.monsters) {
    if (cm.defeated || cm.ignoreSpecial) continue;
    for (const fx of fxOf(state.cards[cm.cardId]?.defId)) if (fx.tipo === tipo) out.push({ cm, fx });
  }
  return out;
}

export function combatHas(state: GameState, combat: CombatState | null, tipo: string): boolean {
  return combatFx(state, combat, tipo).length > 0;
}

/** Monstros do combate que anulam um tipo de item. */
export function nullified(state: GameState, combat: CombatState | null, alvo: string): boolean {
  return combatFx(state, combat, "anula").some(({ fx }) => fx.alvo === alvo);
}

export function monsterFx(state: GameState, cm: CombatMonster, tipo: string): Fx[] {
  if (cm.ignoreSpecial) return [];
  return fxOf(state.cards[cm.cardId]?.defId).filter((f) => f.tipo === tipo);
}

/**
 * O jogador atende à condição de raças/classes do efeito?
 * Sem raças nem classes na condição, vale para todos.
 */
export function matchesWho(state: GameState, p: PlayerState, fx: Fx, racesKey = "racas", classesKey = "classes"): boolean {
  const races = strs(fx, racesKey);
  const classes = strs(fx, classesKey);
  if (races.length === 0 && classes.length === 0) return true;
  const r = raceOf(state, p);
  if (r && races.includes(r)) return true;
  return classesOf(state, p).some((c) => classes.includes(c));
}

/** Condição de raças/classes explícita (sem ela, falso). */
export function matchesListed(state: GameState, p: PlayerState, fx: Fx): boolean {
  if (strs(fx, "racas").length === 0 && strs(fx, "classes").length === 0) return false;
  return matchesWho(state, p, fx);
}
