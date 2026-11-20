import { def, fxOf, RULES, type CardDef, type ClassId, type Fx, type ItemCard, type RaceId } from "../catalog";
import {
  type CardInst,
  type Ctx,
  type GameState,
  type LogEntry,
  type PlayerState,
  fail,
} from "./state";

export function uid(state: GameState, prefix: string): string {
  state.idCounter += 1;
  return `${prefix}${state.idCounter}`;
}

export function log(state: GameState, ctx: Ctx, text: string, kind: LogEntry["kind"] = "info", by?: string) {
  state.logCounter += 1;
  state.log.push({ id: state.logCounter, t: ctx.now, text, kind, by });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

export function player(state: GameState, id: string): PlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) fail("Jogador não encontrado.");
  return p;
}

export function tryPlayer(state: GameState, id: string | null | undefined): PlayerState | undefined {
  if (!id) return undefined;
  return state.players.find((x) => x.id === id);
}

export function currentPlayer(state: GameState): PlayerState {
  return player(state, state.order[state.currentIdx]);
}

export function isCurrent(state: GameState, id: string): boolean {
  return state.order[state.currentIdx] === id;
}

export function inst(state: GameState, cardId: string): CardInst {
  const c = state.cards[cardId];
  if (!c) fail("Carta inexistente.");
  return c;
}

export function defOf(state: GameState, cardId: string): CardDef {
  return def(inst(state, cardId).defId);
}

export function nameOf(state: GameState, cardId: string): string {
  return defOf(state, cardId).name;
}

export function itemDef(state: GameState, cardId: string): ItemCard | null {
  const d = defOf(state, cardId);
  return d.kind === "item" ? d : null;
}

export function newCard(state: GameState, defId: string, virtual = false): string {
  state.nextCardId += 1;
  const id = `c${state.nextCardId}`;
  state.cards[id] = { id, defId, ...(virtual ? { virtual: true } : {}) };
  return id;
}

export function shuffle<T>(arr: T[], ctx: Ctx): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = ctx.rng.int(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRandom<T>(arr: T[], ctx: Ctx): T {
  return arr[ctx.rng.int(arr.length)];
}

// ----------------------------------------------------------------------------
// Raça e classe
// ----------------------------------------------------------------------------

/** Id da raça do jogador (o "id" da carta em racas.json). */
export function raceOf(state: GameState, p: PlayerState): RaceId | null {
  if (!p.race) return null;
  const d = defOf(state, p.race);
  return d.kind === "race" ? d.id.slice("race.".length) : null;
}

export function classesOf(state: GameState, p: PlayerState): ClassId[] {
  return p.classes
    .map((id) => defOf(state, id))
    .filter((d) => d.kind === "class")
    .map((d) => d.id.slice("class.".length));
}

export function hasRace(state: GameState, p: PlayerState, r: RaceId): boolean {
  return raceOf(state, p) === r;
}

export function hasClass(state: GameState, p: PlayerState, c: ClassId): boolean {
  return classesOf(state, p).includes(c);
}

/** Cartas de raça e classe do jogador (de onde vêm passivas e ativas). */
export function identityCards(state: GameState, p: PlayerState): string[] {
  return [p.race, ...p.classes].filter((x): x is string => !!x && !!state.cards[x]);
}

/** Efeitos passivos (raça + classes) do jogador. */
export function passiveFx(state: GameState, p: PlayerState, tipo: string): Fx[] {
  const out: Fx[] = [];
  for (const id of identityCards(state, p)) for (const fx of fxOf(state.cards[id].defId)) if (fx.tipo === tipo) out.push(fx);
  return out;
}

/** Passivas com o nome da passiva de origem (para mostrar no cálculo). */
export function passiveFxSrc(state: GameState, p: PlayerState, tipo: string): { fx: Fx; source: string }[] {
  const out: { fx: Fx; source: string }[] = [];
  for (const id of identityCards(state, p)) {
    const d = def(state.cards[id].defId);
    const source = d.kind === "race" || d.kind === "class" ? d.passive.name || d.name : d.name;
    for (const fx of fxOf(d.id)) if (fx.tipo === tipo) out.push({ fx, source });
  }
  return out;
}

export function hasPassive(state: GameState, p: PlayerState, tipo: string): boolean {
  return passiveFx(state, p, tipo).length > 0;
}

/**
 * Valor de um parâmetro considerando "<param>PorNivel" (ex.: valorPorNivel { "11": 4 }).
 */
export function scaled(fx: Fx | undefined, key: string, level: number, fallback = 0): number {
  if (!fx) return fallback;
  let v = typeof fx[key] === "number" ? (fx[key] as number) : fallback;
  const table = fx[`${key}PorNivel`];
  if (table && typeof table === "object") {
    let best = -1;
    for (const [lv, val] of Object.entries(table as Record<string, number>)) {
      const n = Number(lv);
      if (level >= n && n > best && typeof val === "number") {
        best = n;
        v = val;
      }
    }
  }
  return v;
}

/** Soma um parâmetro (com escala por nível) de todas as passivas de um tipo. */
export function passiveSum(state: GameState, p: PlayerState, tipo: string, key = "valor"): number {
  return passiveFx(state, p, tipo).reduce((a, fx) => a + scaled(fx, key, p.level), 0);
}

export function maxClasses(state: GameState, p: PlayerState): number {
  let n = 1;
  for (const fx of passiveFx(state, p, "classesExtras")) {
    if (p.level >= scaled(fx, "nivelMinimo", p.level, 0)) n += scaled(fx, "quantidade", p.level, 1);
  }
  return n;
}

// ----------------------------------------------------------------------------
// Onde está uma carta
// ----------------------------------------------------------------------------

export type Zone = "hand" | "equipped" | "carried";

export function zoneOf(p: PlayerState, cardId: string): Zone | null {
  if (p.hand.includes(cardId)) return "hand";
  if (p.equipped.includes(cardId)) return "equipped";
  if (p.carried.includes(cardId)) return "carried";
  return null;
}

export function ownerOf(state: GameState, cardId: string): { p: PlayerState; zone: Zone } | null {
  for (const p of state.players) {
    const z = zoneOf(p, cardId);
    if (z) return { p, zone: z };
  }
  return null;
}

export function removeFromPlayer(p: PlayerState, cardId: string): Zone | null {
  for (const zone of ["hand", "equipped", "carried"] as Zone[]) {
    const i = p[zone].indexOf(cardId);
    if (i >= 0) {
      p[zone].splice(i, 1);
      return zone;
    }
  }
  return null;
}

/** Limpa dados de instância ao sair do jogo do dono. */
function resetInstance(state: GameState, c: CardInst) {
  delete c.reforged;
  delete c.artificeSecond;
  if (c.runes) {
    for (const r of c.runes) discardCard(state, r);
    delete c.runes;
  }
  delete c.charges;
}

/** Envia a carta para a pilha de descarte correta (ou a remove, se virtual). */
export function discardCard(state: GameState, cardId: string, byPlayerId?: string) {
  const c = state.cards[cardId];
  if (!c) return;
  resetInstance(state, c);
  for (const p of state.players) removeFromPlayer(p, cardId);
  if (c.virtual) {
    delete state.cards[cardId];
    return;
  }
  delete c.tamed;
  const d = def(c.defId);
  if (d.deck === "door") {
    state.decks.doorDiscard.push(cardId);
  } else {
    state.decks.treasureDiscard.push(cardId);
    if (d.kind === "item" && byPlayerId) {
      state.lastItemDiscard = { cardId, by: byPlayerId, tried: [] };
    }
  }
}

/** Descarta uma carta que está com um jogador (mão/mesa). */
export function discardFromPlayer(state: GameState, p: PlayerState, cardId: string) {
  removeFromPlayer(p, cardId);
  discardCard(state, cardId, p.id);
}

/** Move uma carta (item) de um jogador para a mesa (carregados) de outro. */
export function giveItem(state: GameState, from: PlayerState, to: PlayerState, cardId: string) {
  removeFromPlayer(from, cardId);
  const c = inst(state, cardId);
  delete c.artificeSecond;
  to.carried.push(cardId);
}

// ----------------------------------------------------------------------------
// Baralhos
// ----------------------------------------------------------------------------

export function drawCard(state: GameState, deck: "door" | "treasure", ctx: Ctx): string | null {
  const pile = deck === "door" ? state.decks.door : state.decks.treasure;
  if (pile.length === 0) {
    const discard = deck === "door" ? state.decks.doorDiscard : state.decks.treasureDiscard;
    if (discard.length === 0) return null;
    pile.push(...shuffle(discard.splice(0), ctx));
    if (deck === "treasure") state.lastItemDiscard = null;
    log(state, ctx, `O baralho de ${deck === "door" ? "Portas" : "Tesouros"} foi reembaralhado.`, "system");
  }
  return pile.shift() ?? null;
}

export function drawTo(state: GameState, p: PlayerState, deck: "door" | "treasure", n: number, ctx: Ctx): string[] {
  const got: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = drawCard(state, deck, ctx);
    if (!c) break;
    p.hand.push(c);
    got.push(c);
  }
  return got;
}

// ----------------------------------------------------------------------------
// Dados
// ----------------------------------------------------------------------------

function hasRuneFx(state: GameState, p: PlayerState, tipo: string): boolean {
  return p.equipped.some((id) => (state.cards[id]?.runes ?? []).some((r) => fxOf(state.cards[r]?.defId).some((f) => f.tipo === tipo)));
}

export function equippedRuneCount(state: GameState, p: PlayerState, runeDefId: string): number {
  let n = 0;
  for (const id of p.equipped) {
    for (const r of state.cards[id]?.runes ?? []) if (state.cards[r]?.defId === runeDefId) n++;
  }
  return n;
}

/** Rola 1d6 para um jogador, aplicando Corvo Agourento (-1) e Runa da Sorte (refaz 1). */
export function rollD6(state: GameState, p: PlayerState | null, ctx: Ctx, label: string): { natural: number; total: number } {
  let natural = ctx.rng.int(6) + 1;
  let note = "";
  if (p && natural === 1 && hasRuneFx(state, p, "rerrolaUm") && p.usage["runaSorte"] !== state.round) {
    p.usage["runaSorte"] = state.round;
    const again = ctx.rng.int(6) + 1;
    note = ` (Runa da Sorte refez o 1 → ${again})`;
    natural = again;
  }
  let total = natural;
  if (p) {
    for (const c of p.curses) {
      for (const fx of fxOf(c.defId)) {
        if (fx.tipo !== "menosNoDado") continue;
        const v = typeof fx.valor === "number" ? fx.valor : 1;
        total -= v;
        note += ` (-${v} ${def(c.defId).name})`;
      }
    }
  }
  log(state, ctx, `🎲 ${p ? p.name : "Mesa"} rolou ${natural}${note} — ${label}`, "dice", p?.id);
  return { natural, total };
}

// ----------------------------------------------------------------------------
// Níveis
// ----------------------------------------------------------------------------

/**
 * Sobe níveis. Só derrotar monstro (fromMonster) pode levar ao nível 20.
 */
export function gainLevels(state: GameState, p: PlayerState, n: number, ctx: Ctx, fromMonster: boolean, reason: string) {
  if (n <= 0) return;
  const cap = fromMonster ? RULES.nivelMaximo : RULES.nivelMaximo - 1;
  const before = p.level;
  p.level = Math.min(cap, Math.max(p.level, p.level + n));
  if (p.level !== before) {
    log(state, ctx, `⬆️ ${p.name} subiu para o nível ${p.level} (${reason}).`, "level", p.id);
  }
  if (p.level >= RULES.nivelMaximo && fromMonster && !state.winnerId) {
    state.winnerId = p.id;
    state.phase = "FINISHED";
    log(state, ctx, `🏆 ${p.name} chegou ao nível ${RULES.nivelMaximo} e venceu o jogo!`, "system");
  }
}

export function loseLevels(
  state: GameState,
  p: PlayerState,
  n: number,
  ctx: Ctx,
  reason: string,
  opts: { corpoSeco?: boolean } = {},
): number {
  if (n <= 0) return 0;
  const before = p.level;
  p.level = Math.max(1, p.level - n);
  const lost = before - p.level;
  if (lost > 0) {
    if (p.lostRound !== state.round) {
      p.lostRound = state.round;
      p.lostRoundAmount = 0;
      p.lostRoundCorpoSeco = 0;
    }
    p.lostRoundAmount += lost;
    if (opts.corpoSeco) p.lostRoundCorpoSeco += lost;
    if (state.combat) {
      state.combat.levelsLost[p.id] = (state.combat.levelsLost[p.id] ?? 0) + lost;
    }
    log(state, ctx, `⬇️ ${p.name} perdeu ${lost} nível(is) e está no nível ${p.level} (${reason}).`, "level", p.id);
  }
  return lost;
}

export function lostLevelThisRound(state: GameState, p: PlayerState): boolean {
  return p.lostRound === state.round && p.lostRoundAmount > 0;
}

export function leftOf(state: GameState, id: string): PlayerState {
  const i = state.order.indexOf(id);
  return player(state, state.order[(i + 1) % state.order.length]);
}

export function otherPlayers(state: GameState, id: string): PlayerState[] {
  return state.players.filter((p) => p.id !== id);
}
