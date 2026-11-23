// Rating do modo ranqueado (estilo Elo para 6 jogadores): cada partida vira vários duelos 1x1.
// Funções puras (sem banco), usadas pelo servidor e pelos testes.
import { CARD_DEFS } from "../game/catalog";
import type { GameState } from "../game/engine";

export const RATING_START = 1200;
export const RATING_MIN = 100;
export const RANKED_SIZE = 6;
/** Partidas de colocação: o rating já conta desde a 1ª, mas até completar aparece com "?" (provisório). */
export const PLACEMENT_GAMES = 5;
export const ABANDON_PENALTY = 10;

/**
 * Rating fixo (predefinido) de um bot de dificuldade 1 a 30: 600 (nível 1) a 2050 (nível 30).
 * Toda partida ranqueada conta, com qualquer número de bots: ganhar de um bot vale conforme o rating do nível dele.
 */
export function botRating(skill: number): number {
  return 600 + 50 * (Math.max(1, Math.min(30, Math.round(skill))) - 1);
}

/** Dificuldade dos bots que completam uma sala: a que tem o rating mais próximo da média dos humanos. */
export function botSkillFor(humanRatings: number[]): number {
  const avg = humanRatings.length ? humanRatings.reduce((a, b) => a + b, 0) / humanRatings.length : RATING_START;
  return Math.max(1, Math.min(30, Math.round((avg - 600) / 50) + 1));
}

/** Fator K: velocidade de mudança do rating. */
export function kFactor(games: number, rating: number): number {
  if (games < 10) return 48;
  if (games < 30) return 32;
  return rating >= 2000 ? 16 : 20;
}

/** Janela de rating aceita na fila, pelo tempo de espera (depois de 60 s a sala é completada com bots). */
export function queueWindow(waitMs: number): number {
  if (waitMs < 30_000) return 100;
  if (waitMs < 60_000) return 250;
  return Infinity;
}

export interface RatedPlayer {
  id: string;
  bot: boolean;
  /** Rating de ANTES da partida. */
  rating: number;
  /** Partidas ranqueadas já jogadas (só humanos). */
  games: number;
  /** Colocação final (1 = melhor; empates repetem a posição). */
  position: number;
  abandoned: boolean;
}

export interface RatingChange {
  id: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Variação de rating dos humanos. Cada humano "duela" com os outros N-1 jogadores:
 * acima = 1, empate = 0,5, abaixo = 0; compara com o esperado pela diferença de rating
 * (duelos contra bots valem metade). Quem abandona perde mais 10. Nunca abaixo de 100.
 */
export function ratingChanges(players: RatedPlayer[]): RatingChange[] {
  const n = players.length;
  if (n < 2) return [];
  const out: RatingChange[] = [];
  for (const i of players) {
    if (i.bot) continue;
    let sum = 0;
    for (const j of players) {
      if (j.id === i.id) continue;
      const expected = 1 / (1 + Math.pow(10, (j.rating - i.rating) / 400));
      const score = i.position < j.position ? 1 : i.position === j.position ? 0.5 : 0;
      sum += (j.bot ? 0.5 : 1) * (score - expected);
    }
    let delta = (kFactor(i.games, i.rating) / (n - 1)) * sum;
    if (i.abandoned) delta -= ABANDON_PENALTY;
    const after = Math.max(RATING_MIN, i.rating + delta);
    out.push({ id: i.id, before: i.rating, after, delta: after - i.rating });
  }
  return out;
}

/** Soma dos bônus dos itens equipados (critério de desempate). */
export function equipmentBonus(state: GameState, playerId: string): number {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return 0;
  let total = 0;
  for (const id of p.equipped) {
    const c = state.cards[id];
    const d = c && CARD_DEFS[c.defId];
    if (d?.kind === "item") total += d.bonus + (Number(c.reforged) || 0);
  }
  return total;
}

/**
 * Colocação final: 1º quem venceu; depois por nível (maior = melhor), desempate pelo bônus dos itens
 * equipados; se ainda igual, mesma posição. Quem abandonou fica em último.
 */
export function finalPositions(state: GameState, allIds: string[]): Map<string, number> {
  const pos = new Map<string, number>();
  const present = state.players.filter((p) => allIds.includes(p.id));
  const key = (id: string) => {
    const p = state.players.find((x) => x.id === id)!;
    return [state.winnerId === id ? 1 : 0, p.level, equipmentBonus(state, id)];
  };
  const cmp = (a: string, b: string) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  };
  const sorted = present.map((p) => p.id).sort(cmp);
  sorted.forEach((id, i) => {
    const prev = sorted[i - 1];
    pos.set(id, prev !== undefined && cmp(prev, id) === 0 ? pos.get(prev)! : i + 1);
  });
  // quem saiu da mesa (desistiu) fica em último, empatado com os outros que saíram
  for (const id of allIds) if (!pos.has(id)) pos.set(id, allIds.length);
  return pos;
}

/** Texto do rating: arredondado, com "?" enquanto as partidas de colocação não terminaram (provisório). */
export function ratingLabel(rating: number, games: number): string {
  return `${Math.round(rating)}${games < PLACEMENT_GAMES ? "?" : ""}`;
}
