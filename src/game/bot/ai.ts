// IA dos bots. Os bots decidem simulando ações no motor (que é puro) e escolhendo a que mais melhora
// a situação deles: ganhar níveis e poder, vencer monstros, atrapalhar jogadores humanos e o líder,
// aliar-se a outros bots (menos os que estão quase ganhando) e negociar itens exclusivos da sua classe.
import { CARD_DEFS, type CardDef, findFx, type ItemCard, type MonsterCard, RULES } from "../catalog";
import { abilityInfos } from "../engine/abilities";
import { type Action, applyAction } from "../engine/actions";
import { type Ctx, type GameState, GameError, type PlayerState, type Prompt } from "../engine/state";
import { freeTreasures } from "../engine/core";
import { combatHas } from "../engine/fx";
import { computeCombat, equipCheck, fleeInfo, playerPower, playerSide, slotOf } from "../engine/stats";
import { hasPassive, isCurrent } from "../engine/util";

export const BOT_DELAY_MS = 900;

const BOT_NAMES = [
  "Grimbold",
  "Sela de Ferro",
  "Mordecai",
  "Brisa Rúnica",
  "Torvald",
  "Nyx Sombria",
  "Bartolomeu",
  "Kára",
  "Fennick",
  "Velha Magda",
];

export function botName(i: number): string {
  return `🤖 ${BOT_NAMES[i % BOT_NAMES.length]}${i >= BOT_NAMES.length ? ` ${Math.floor(i / BOT_NAMES.length) + 1}` : ""}`;
}

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------

function P(state: GameState, id: string): PlayerState {
  return state.players.find((p) => p.id === id)!;
}

function d(state: GameState, cardId: string): CardDef {
  return CARD_DEFS[state.cards[cardId].defId];
}

/** Valor aproximado de uma carta para quem a tem. */
function cardValue(state: GameState, cardId: string): number {
  const c = state.cards[cardId];
  if (!c) return 0;
  const df = CARD_DEFS[c.defId];
  switch (df.kind) {
    case "levelup":
      return 90;
    case "item":
      return df.bonus * 10 + df.price / 50 + (df.flee ?? 0) * 6;
    case "potion":
      return 30 + df.price / 40;
    case "rune":
      return 20 + df.price / 50;
    case "misc":
      return 20 + df.price / 40;
    case "monsterBonus":
      return 25 + Math.abs(df.value) * 2;
    case "wandering":
      return 30;
    case "curse":
      return 30;
    case "monster":
      return 18;
    default:
      return 12;
  }
}

function itemDefOf(state: GameState, cardId: string): ItemCard | null {
  const df = d(state, cardId);
  return df.kind === "item" ? df : null;
}

const fxIs = (state: GameState, cardId: string, tipo: string) => !!findFx(state.cards[cardId]?.defId, tipo);
const unbreakable = (state: GameState, cardId: string) =>
  (state.cards[cardId]?.runes ?? []).some((r) => findFx(state.cards[r]?.defId, "naoRoubavel"));

/** Determinístico e "médio" para simular (d6 = 4). */
const SIM_RNG = { int: (max: number) => Math.floor((max - 1) / 2) + (max === 6 ? 1 : 0) };

function simulate(state: GameState, actorId: string, action: Action, ctx: Ctx): GameState | null {
  const s = structuredClone(state);
  s.log = [];
  try {
    applyAction(s, actorId, action, { now: ctx.now, rng: SIM_RNG, offline: ctx.offline });
    return s;
  } catch (e) {
    if (e instanceof GameError) return null;
    return null;
  }
}

function maxOtherLevel(state: GameState, me: string): number {
  return Math.max(0, ...state.players.filter((p) => p.id !== me).map((p) => p.level));
}

/**
 * Peso de um adversário: humanos pesam um pouco mais que bots (preferência, não obsessão),
 * e quem está liderando ou perto de ganhar pesa muito — mesmo que seja outro bot.
 */
function weight(state: GameState, me: string, other: PlayerState): number {
  const leaderLevel = maxOtherLevel(state, me);
  let w = other.bot ? 0.6 : 1;
  if (other.level === leaderLevel && other.level >= P(state, me).level && other.level > 1) w *= 1.8;
  if (other.level >= RULES.nivelMaximo - 4) w = Math.max(w, 1.6);
  return w;
}

function isAlly(state: GameState, me: string, other: PlayerState): boolean {
  return !!other.bot && weight(state, me, other) < 0.8;
}

/**
 * O quanto um jogador já está forte em relação à mesa (0 a 1): nível acima da média, liderança,
 * proximidade da vitória e poder de combate. Usado (com peso baixo) antes de ajudar alguém.
 */
export function strengthOf(state: GameState, p: PlayerState): number {
  const others = state.players.filter((x) => x.id !== p.id);
  if (others.length === 0) return 0;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const lead = clamp((p.level - avg(others.map((o) => o.level))) / 5);
  const ahead = p.level >= Math.max(...others.map((o) => o.level)) && p.level > 1 ? 0.25 : 0;
  const nearWin = clamp((p.level - (RULES.nivelMaximo - 8)) / 7);
  const pow = clamp((playerPower(state, p) - avg(others.map((o) => playerPower(state, o)))) / 12);
  return clamp(0.35 * lead + ahead + 0.25 * nearWin + 0.15 * pow);
}

/** Peso (baixo) de fortalecer alguém que já está forte, em "pontos" comparáveis a tesouros/níveis. */
const STRENGTH_PENALTY = 50;

/** Aceito um pedido de ajuda de `fighter` em troca de `count` tesouros? */
export function shouldAcceptHelpRequest(state: GameState, me: PlayerState, fighter: PlayerState, count: number, threat = false): boolean {
  const calc = computeCombat(state);
  const wouldWin = !!calc && calc.playerTotal + playerPower(state, me) > calc.monsterTotal;
  if (!wouldWin) return false;
  const stake = monsterStake(state);
  const ally = isAlly(state, me.id, fighter);
  if (fighter.level >= RULES.nivelMaximo - 2 && !ally) return false;
  // Ganho para mim (tesouros + nível do Elfo) contra o quanto o lutador avança
  const myGain = count * 40 + (hasPassive(state, me, "nivelAoAjudar") ? 100 : 0);
  const theirGain = weight(state, me.id, fighter) * stake.levels * 60;
  // mesmo quando vale a pena, fortalecer quem já está forte pesa um pouco contra
  const score = myGain - theirGain - STRENGTH_PENALTY * strengthOf(state, fighter) + (ally ? 80 : 0);
  if (score > 0) return true;
  // ameaçado pelo lutador: às vezes é melhor ajudar do que sofrer
  return threat && me.level > 1 && fighter.level < RULES.nivelMaximo - 2;
}

/** Aceito a oferta de `helper` (que leva `count` tesouros) para me ajudar? */
export function shouldAcceptHelpOffer(state: GameState, me: PlayerState, helper: PlayerState, count: number): boolean {
  const calc = computeCombat(state);
  if (!calc || calc.winning) return false;
  if (calc.playerTotal + playerPower(state, helper) <= calc.monsterTotal) return false;
  if (!helper.bot && helper.level >= RULES.nivelMaximo - 3) return false;
  const stake = monsterStake(state);
  const benefit = stake.levels * 90 + Math.max(0, stake.treasures - count) * 25;
  const w = isAlly(state, me.id, helper) ? 0.3 : weight(state, me.id, helper);
  const helperGain = w * (count * 30 + (hasPassive(state, helper, "nivelAoAjudar") ? 100 : 0));
  return benefit - helperGain - STRENGTH_PENALTY * strengthOf(state, helper) > 0;
}

function monsterStake(state: GameState): { levels: number; treasures: number } {
  const c = state.combat;
  if (!c) return { levels: 0, treasures: 0 };
  let levels = 0;
  let treasures = 0;
  for (const m of c.monsters) {
    const md = d(state, m.cardId) as MonsterCard;
    levels += md.levels;
    treasures += md.treasures;
  }
  return { levels, treasures };
}

/** O jogador `who` consegue fazer o lutador perder com as cartas que tem? */
function canFlip(state: GameState, who: string, ctx: Ctx): boolean {
  if (!state.combat) return false;
  const winning = (s: GameState) => !!s.combat && !!computeCombat(s)?.winning;
  if (!winning(state)) return false;
  const w = P(state, who);
  if (!w) return false;
  return !!plan(state, who, (s) => (s.combat ? hinderCandidates(s, P(s, who)) : []), (s) => !s.combat || !winning(s), ctx, 4);
}

/**
 * Vale a pena pagar uma ameaça? Só se quem ameaça consegue mesmo virar o combate (ou tem mão para isso)
 * e se o preço for menor que a perda esperada. Pedidos exagerados são recusados.
 */
export function shouldPayThreat(state: GameState, me: PlayerState, threatenerId: string, count: number, ctx: Ctx): boolean {
  const c = state.combat;
  if (!c || c.fighterId !== me.id) return false;
  const free = freeTreasures(state, c);
  if (count < 1 || count > free) return false;
  const calc = computeCombat(state);
  if (!calc?.winning) return false; // perdendo de qualquer jeito: pagar não protege nada
  const threatener = P(state, threatenerId);
  if (!threatener) return false;
  const stake = monsterStake(state);
  const winsGame = me.level + stake.levels >= RULES.nivelMaximo;
  // chance de a ameaça ser real
  let p = canFlip(state, threatenerId, ctx) ? 0.85 : threatener.hand.length >= 5 ? 0.15 : 0.03;
  // se outros também podem virar o combate, pagar um só não garante a vitória
  const others = state.players.filter((o) => o.id !== me.id && o.id !== threatenerId && !calc.side.includes(o.id));
  if (others.some((o) => canFlip(state, o.id, ctx))) p *= 0.5;
  const treasureValue = 45;
  const lossIfHindered = stake.levels * 100 + free * treasureValue + 80 + (winsGame ? 5000 : 0);
  // ceder a chantagem tem um "preço de orgulho": pagar custa um pouco mais que o valor das cartas
  const cost = count * treasureValue * 1.3;
  if (p * lossIfHindered <= cost) return false;
  // nunca entrega quase tudo, a não ser que a vitória do jogo dependa disso ou a ameaça seja certa e o prêmio alto
  const reasonable = count <= Math.max(1, Math.floor(free * 0.6));
  return reasonable || winsGame || (p >= 0.85 && stake.levels >= 2);
}

function handValue(state: GameState, p: PlayerState): number {
  return p.hand.reduce((a, id) => a + cardValue(state, id), 0);
}

/** Avaliação do estado do ponto de vista do bot. */
function evaluate(state: GameState, me: string): number {
  if (state.winnerId === me) return 1e6;
  if (state.winnerId) return -1e6;
  const bot = P(state, me);
  let score = bot.level * 100 + playerPower(state, bot) * 8 + handValue(state, bot) * 0.4;
  score += bot.carried.reduce((a, id) => a + cardValue(state, id), 0) * 0.15;
  score -= bot.curses.length * 25 + bot.pendingCombatCurses.length * 30;
  for (const o of state.players) {
    if (o.id === me) continue;
    const w = weight(state, me, o);
    score -= w * (o.level * 100 + playerPower(state, o) * 5 + o.curses.length * -25 + o.pendingCombatCurses.length * -35);
  }
  const c = state.combat;
  if (c && c.stage !== "badstuff") {
    const calc = computeCombat(state);
    if (calc) {
      const margin = calc.playerTotal - calc.monsterTotal;
      const stake =
        c.monsters.reduce((a, m) => a + ((d(state, m.cardId) as MonsterCard).levels ?? 1), 0) * 100 +
        c.monsters.reduce((a, m) => a + ((d(state, m.cardId) as MonsterCard).treasures ?? 1), 0) * 25;
      if (calc.side.includes(me)) {
        score += calc.winning ? stake + 200 + Math.min(margin, 6) * 4 : Math.max(margin, -30) * 8;
      } else {
        const fighter = P(state, c.fighterId);
        const w = weight(state, me, fighter);
        if (calc.winning) score -= w * (stake + 200 + Math.min(margin, 6) * 4);
      }
    }
  }
  return score;
}

/** Escolhe as N cartas menos valiosas da mão (exceto as reservadas). */
function cheapest(state: GameState, p: PlayerState, n: number, reserved: string[] = []): string[] | null {
  const pool = p.hand.filter((id) => !reserved.includes(id)).sort((a, b) => cardValue(state, a) - cardValue(state, b));
  return pool.length >= n ? pool.slice(0, n) : null;
}

// ----------------------------------------------------------------------------
// Geração de candidatos
// ----------------------------------------------------------------------------

type Mode = "boost" | "hinder" | "manage";

function abilityCandidates(state: GameState, me: PlayerState, mode: Mode): Action[] {
  const out: Action[] = [];
  const c = state.combat;
  const monsters = c ? c.monsters.filter((m) => !m.defeated).map((m) => m.cardId) : [];
  for (const ab of abilityInfos(state, me)) {
    if (!ab.available) continue;
    const combatOnly = ["bonusCombate", "nivelDobradoAjudando", "arremesso", "monstrosPerdemNivel", "ignorarEspecial", "mandarMonstroEmbora", "polimorfia", "domarFera", "duplicata", "dobrarFuria", "dobrarItem", "cancelarBonusMonstro", "itemDaMaoParaLado"];
    if (mode === "manage" && combatOnly.includes(ab.acao)) continue;
    if (mode !== "manage" && !combatOnly.includes(ab.acao) && ab.acao !== "maldicaoForca") continue;
    if (["desafio", "encerrarCombate", "assumirCoisasRuins", "ameacarAjuda", "forcarAjuda", "usarItemRestrito"].includes(ab.acao)) continue;
    const base = (params: Record<string, unknown>, reserved: string[] = []) => {
      if (ab.wholeHand) return { type: "ABILITY", key: ab.key, discard: [], params } as Action;
      const disc = cheapest(state, me, ab.discard, reserved);
      if (!disc) return null;
      return { type: "ABILITY", key: ab.key, discard: disc, params } as Action;
    };
    const push = (a: Action | null) => a && out.push(a);
    const fields = ab.fields.map((f) => f.kind);
    if (fields.length === 0) {
      push(base({}));
      continue;
    }
    if (fields[0] === "monster") {
      for (const m of monsters) push(base({ monster: m }));
      continue;
    }
    if (ab.acao === "itemDaMaoParaLado") {
      const items = me.hand.filter((id) => itemDefOf(state, id));
      items.sort((a, b) => (itemDefOf(state, b)?.bonus ?? 0) - (itemDefOf(state, a)?.bonus ?? 0));
      if (items[0]) push({ type: "ABILITY", key: ab.key, discard: [], params: { handItem: items[0], side: mode === "hinder" ? "monster" : "player" } });
      continue;
    }
    if (ab.acao === "arremesso") {
      const bigs = [...me.hand, ...me.carried, ...me.equipped].filter((id) => itemDefOf(state, id)?.big);
      for (const b of bigs) push({ type: "ABILITY", key: ab.key, discard: [], params: { bigItem: b } });
      continue;
    }
    if (ab.acao === "dobrarItem" && c) {
      const items = playerSide(state, c).flatMap((pid) => P(state, pid).equipped);
      items.sort((a, b) => (itemDefOf(state, b)?.bonus ?? 0) - (itemDefOf(state, a)?.bonus ?? 0));
      if (items[0]) push(base({ item: items[0] }));
      continue;
    }
    if (ab.acao === "duplicata") {
      const ms = me.hand.filter((id) => d(state, id).kind === "monster");
      ms.sort((a, b) => (d(state, b) as MonsterCard).level - (d(state, a) as MonsterCard).level);
      if (ms[0]) push(base({ handMonster: ms[0] }, [ms[0]]));
      continue;
    }
    if (ab.acao === "maldicaoForca") {
      for (const o of state.players) if (o.id !== me.id) push(base({ player: o.id }));
      continue;
    }
    if (ab.acao === "roubarNivel") {
      for (const o of state.players) if (o.id !== me.id && o.level >= me.level) push(base({ player: o.id }));
      continue;
    }
    if (ab.acao === "reforjar") {
      const cost = [...me.hand, ...me.carried].filter((id) => itemDefOf(state, id)).sort((a, b) => cardValue(state, a) - cardValue(state, b))[0];
      const target = me.equipped
        .filter((id) => slotOf(state, id) !== "ring" && !state.cards[id].reforged)
        .sort((a, b) => cardValue(state, b) - cardValue(state, a))[0];
      if (cost && target) push({ type: "ABILITY", key: ab.key, discard: [], params: { costItem: cost, item: target } });
      continue;
    }
    if (ab.acao === "curar") {
      for (const cu of me.curses) push(base({ player: me.id, mode: "curse", curse: cu.id }));
      push(base({ player: me.id, mode: "level" }));
      continue;
    }
    if (ab.acao === "passarMaldicao") {
      for (const cu of me.curses)
        for (const o of state.players) if (o.id !== me.id && !isAlly(state, me.id, o)) push(base({ curse: cu.id, player: o.id }));
      continue;
    }
    if (ab.acao === "roubarItem") {
      for (const o of state.players) {
        if (o.id === me.id || isAlly(state, me.id, o)) continue;
        for (const it of o.equipped) if (!itemDefOf(state, it)?.big) push(base({ player: o.id, otherItem: it }));
      }
      continue;
    }
    if (ab.acao === "bugiganga") {
      const best = state.decks.treasureDiscard
        .filter((id) => itemDefOf(state, id))
        .sort((a, b) => cardValue(state, b) - cardValue(state, a))[0];
      if (best) push(base({ mode: "discard", card: best }));
      continue;
    }
    if (ab.acao === "buscarPocao" || ab.acao === "abrirOutraPorta" || ab.acao === "hibernar") {
      if (ab.acao === "abrirOutraPorta") push(base({}));
      continue;
    }
  }
  return out;
}

/** Ações para o lado dos jogadores (quando o bot ou um aliado luta). */
function boostCandidates(state: GameState, me: PlayerState): Action[] {
  const c = state.combat!;
  const out: Action[] = [];
  const monsters = c.monsters.filter((m) => !m.defeated).map((m) => m.cardId);
  const side = playerSide(state, c);
  for (const id of me.hand) {
    const df = d(state, id);
    if (df.kind === "monsterBonus" && df.value < 0) for (const m of monsters) out.push({ type: "PLAY_MONSTER_BONUS", cardId: id, monsterId: m });
    if (df.kind === "potion") {
      if (fxIs(state, id, "bonusLado") || fxIs(state, id, "contraMortosVivos"))
        out.push({ type: "USE_CARD", cardId: id, side: "player", targetId: side.includes(me.id) ? me.id : c.fighterId });
      if (fxIs(state, id, "menosEmAlvo")) for (const m of monsters) out.push({ type: "USE_CARD", cardId: id, monsterId: m });
    }
  }
  if (me.id === c.fighterId) {
    for (const m of c.monsters) out.push({ type: "DISPENSE", monsterId: m.cardId, discardId: cheapest(state, me, 1)?.[0] });
  }
  if (side.includes(me.id)) out.push({ type: "SOPRO" });
  else out.push({ type: "ARCO" });
  out.push(...abilityCandidates(state, me, "boost"));
  return out;
}

/** Ações para atrapalhar quem está lutando. */
function hinderCandidates(state: GameState, me: PlayerState): Action[] {
  const c = state.combat!;
  const out: Action[] = [];
  const monsters = c.monsters.filter((m) => !m.defeated).map((m) => m.cardId);
  const strongestHandMonster = me.hand
    .filter((id) => d(state, id).kind === "monster")
    .sort((a, b) => (d(state, b) as MonsterCard).level - (d(state, a) as MonsterCard).level)[0];
  for (const id of me.hand) {
    const df = d(state, id);
    if (df.kind === "monsterBonus" && df.value > 0) for (const m of monsters) out.push({ type: "PLAY_MONSTER_BONUS", cardId: id, monsterId: m });
    if (df.kind === "wandering" && strongestHandMonster) out.push({ type: "PLAY_WANDERING", cardId: id, monsterCardId: strongestHandMonster });
    if (df.kind === "potion" && fxIs(state, id, "bonusLado")) out.push({ type: "USE_CARD", cardId: id, side: "monster" });
    if (fxIs(state, id, "menosEmAlvo")) out.push({ type: "USE_CARD", cardId: id, targetId: c.fighterId });
    if (df.kind === "curse" && df.curseType === "combat") out.push({ type: "PLAY_CURSE", cardId: id, targetId: c.fighterId });
  }
  for (const id of [...me.hand, ...me.carried]) {
    if (fxIs(state, id, "isca")) for (const m of monsters) out.push({ type: "USE_CARD", cardId: id, monsterId: m });
  }
  out.push(...abilityCandidates(state, me, "hinder"));
  return out;
}

/** Melhorias fora de combate: equipar, runas, subir nível, maldições, habilidades. */
function manageCandidates(state: GameState, me: PlayerState, ownTurn: boolean): Action[] {
  const out: Action[] = [];
  if (ownTurn || state.phase === "SETUP") {
    for (const id of [...me.hand, ...me.carried]) {
      const df = d(state, id);
      if (df.kind === "item" || state.cards[id].tamed) {
        const chk = equipCheck(state, me, id);
        if (!chk.error) out.push({ type: "EQUIP", cardId: id });
        else if (df.kind === "item") {
          // Troca por um item pior no mesmo slot
          const worse = me.equipped.filter((e) => slotOf(state, e) === df.slot && cardValue(state, e) < cardValue(state, id));
          for (const w of worse) out.push({ type: "UNEQUIP", cardId: w });
        }
      }
      if (df.kind === "rune") for (const it of me.equipped) out.push({ type: "SOCKET_RUNE", runeId: id, itemId: it });
      if (df.kind === "race") out.push({ type: "PLAY_RACE", cardId: id });
      if (df.kind === "class") for (const c of me.classes) out.push({ type: "PLAY_CLASS", cardId: id, replaceId: c });
    }
  }
  if (state.phase !== "PLAYING") return out;
  for (const id of me.hand) {
    const df = d(state, id);
    if (df.kind === "levelup" && me.level < RULES.nivelMaximo - 1) out.push({ type: "PLAY_LEVELUP", cardId: id });
    if (fxIs(state, id, "subirNivel") && me.level < RULES.nivelMaximo - 1) out.push({ type: "USE_CARD", cardId: id });
    if (df.kind === "curse") {
      for (const o of state.players) if (o.id !== me.id && !isAlly(state, me.id, o)) out.push({ type: "PLAY_CURSE", cardId: id, targetId: o.id });
    }
  }
  out.push(...abilityCandidates(state, me, "manage"));
  return out;
}

/** Escolhe a melhor ação (simulada) que melhora a avaliação acima de um limiar. */
function bestOf(state: GameState, me: string, actions: Action[], ctx: Ctx, threshold: number): { action: Action; s: GameState; gain: number } | null {
  const base = evaluate(state, me);
  let best: { action: Action; s: GameState; gain: number } | null = null;
  const seen = new Set<string>();
  for (const a of actions) {
    const k = JSON.stringify(a);
    if (seen.has(k)) continue;
    seen.add(k);
    const s = simulate(state, me, a, ctx);
    if (!s) continue;
    const gain = evaluate(s, me) - base;
    if (gain > threshold && (!best || gain > best.gain)) best = { action: a, s, gain };
  }
  return best;
}

/**
 * Plano guloso: aplica até `steps` ações em sequência; se o objetivo for atingido, devolve a primeira.
 */
function plan(
  state: GameState,
  me: string,
  gen: (s: GameState) => Action[],
  goal: (s: GameState) => boolean,
  ctx: Ctx,
  steps = 4,
): Action | null {
  let cur = state;
  let first: Action | null = null;
  for (let i = 0; i < steps; i++) {
    const b = bestOf(cur, me, gen(cur), ctx, 0);
    if (!b) return null;
    first ??= b.action;
    cur = b.s;
    if (goal(cur)) return first;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Decisões
// ----------------------------------------------------------------------------

function mem(state: GameState): Record<string, number> {
  state.botMemory ??= {};
  return state.botMemory;
}

function answerFor(state: GameState, me: PlayerState, pr: Prompt, ctx: Ctx): Action {
  const data = pr.data;
  const answer = (a: Record<string, unknown>): Action => ({ type: "ANSWER", promptId: pr.id, answer: a });
  const arr = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);
  const byValueAsc = (ids: string[]) => [...ids].sort((a, b) => cardValue(state, a) - cardValue(state, b));
  switch (pr.kind) {
    case "helpRequest": {
      const fighter = P(state, String(data.fighterId));
      const deal = data.deal as { count: number };
      return answer({ accept: shouldAcceptHelpRequest(state, me, fighter, deal.count, !!data.threat) });
    }
    case "threat": {
      return answer({ accept: shouldPayThreat(state, me, String(data.threatenerId), Number(data.count), ctx) });
    }
    case "helpOffer": {
      const helper = P(state, String(data.helperId));
      const deal = (data.deal as { count?: number } | undefined) ?? {};
      return answer({ accept: shouldAcceptHelpOffer(state, me, helper, Number(deal.count ?? 1)) });
    }
    case "fairySwap": {
      const gain = cardValue(state, String(data.mine)) - cardValue(state, String(data.theirs));
      const block = gain < 0 && me.hand.length >= 2;
      return answer({ block, discard: block ? cheapest(state, me, 2) ?? [] : [] });
    }
    case "chooseLoss": {
      const victim = P(state, String(data.victimId));
      const cands = arr(data.candidates);
      const n = Math.min(Number(data.count ?? 1), cands.length);
      // Se a vítima sou eu, perco os piores; se é outro, tiro os melhores dele
      const sorted = byValueAsc(cands);
      return answer({ cardIds: victim.id === me.id ? sorted.slice(0, n) : sorted.reverse().slice(0, n) });
    }
    case "bigOrLevels": {
      const bigs = arr(data.bigs);
      const worst = byValueAsc(bigs)[0];
      const levels = Number(data.levels);
      const itemCost = cardValue(state, worst) * 1.5;
      return answer(itemCost < levels * 100 ? { choice: "item", cardId: worst } : { choice: "levels" });
    }
    case "distribute": {
      const cards = arr(data.cards);
      const n = Number(data.count ?? 1);
      const helperId = String(data.helperId);
      const sorted = byValueAsc(cards);
      // Se eu sou o ajudante, pego os melhores; se sou quem lutou, dou os piores
      return answer({ cardIds: helperId === me.id ? sorted.reverse().slice(0, n) : sorted.slice(0, n) });
    }
    case "bardo":
      return answer({ cardId: byValueAsc(arr(data.cards))[0] });
    case "loot": {
      const items = arr(data.items);
      const usable = items.filter((id) => !itemDefOf(state, id) || !equipCheck(state, me, id).error);
      const best = [...(usable.length ? usable : items)].sort((a, b) => cardValue(state, b) - cardValue(state, a))[0];
      return answer({ cardId: best ?? null });
    }
    case "charity": {
      const count = Math.max(0, Number(data.count ?? me.hand.length - 5));
      return answer({ cardIds: byValueAsc(me.hand).slice(0, Math.min(count, me.hand.length)) });
    }
    case "trade": {
      const from = P(state, String(data.fromId));
      const give = arr(data.take); // o que eu dou
      const get = arr(data.give); // o que eu recebo
      const valueToMe = (ids: string[], mine: boolean) =>
        ids.reduce((a, id) => {
          const base = cardValue(state, id);
          const usable = itemDefOf(state, id) ? !equipCheck(state, me, id).error || me.equipped.includes(id) : true;
          return a + base * (usable ? 1 : 0.6) * (mine && me.equipped.includes(id) ? 1.3 : 1);
        }, 0);
      const ratio = from.bot ? (isAlly(state, me.id, from) ? 0.9 : 1.1) : 1.2;
      const accept = valueToMe(get, false) >= valueToMe(give, true) * ratio && weight(state, me.id, from) < 1.5;
      return answer({ accept });
    }
    case "fairyCurse": {
      const victim = P(state, String(data.victimId));
      let best: [string, string] | null = null;
      let bestGain = -Infinity;
      for (const a of me.equipped)
        for (const b of victim.equipped) {
          if (slotOf(state, a) !== slotOf(state, b)) continue;
          const g = cardValue(state, b) - cardValue(state, a);
          if (g > bestGain) {
            bestGain = g;
            best = [a, b];
          }
        }
      return answer(best ? { myItem: best[0], theirItem: best[1] } : {});
    }
    case "possession": {
      const best = [...arr(data.candidates)].sort((a, b) => cardValue(state, b) - cardValue(state, a))[0];
      return answer({ cardId: best ?? null });
    }
    case "debt":
      return answer({ cardId: byValueAsc(me.hand)[0] ?? null });
    default:
      void ctx;
      return answer({});
  }
}

function decideBadStuff(state: GameState, me: PlayerState): Action | null {
  const c = state.combat!;
  const flee = c.flee!;
  const victims = new Set<string>();
  for (const r of flee.results) if (!r.success) victims.add(flee.substitutes[r.playerId] ?? r.playerId);
  if (!victims.has(me.id) || flee.confirmed.includes(me.id)) return null;
  const mine = flee.results.map((r, i) => ({ r, i })).filter(({ r }) => r.playerId === me.id && !r.success);
  const severe = mine.some(({ r }) => {
    const md = d(state, r.monsterCardId) as MonsterCard;
    return md.badStuff.some((e) => e.t === "death" || (e.t === "levels" && e.n >= 2));
  });
  if (severe && me.equipped.some((id) => fxIs(state, id, "desejos"))) return { type: "WISH_RING" };
  const rolled = mine.find(({ r }) => r.roll > 0);
  if (rolled) {
    if (me.equipped.some((id) => fxIs(state, id, "rerrolarFuga")) && !c.rerolled.includes(`${me.id}:cajado`))
      return { type: "REROLL", index: rolled.i, source: "cajado" };
    const dado = [...me.hand, ...me.carried].find((id) => fxIs(state, id, "rerrolarFuga"));
    if (dado && severe) return { type: "REROLL", index: rolled.i, source: "dado", cardId: dado };
  }
  if (severe) {
    const escape = [...me.hand, ...me.carried].find((id) => fxIs(state, id, "teletransporte") || fxIs(state, id, "fugaAutomatica"));
    if (escape) return { type: "USE_CARD", cardId: escape, targetId: me.id };
  }
  return { type: "ACCEPT_BAD_STUFF" };
}

function decideFighter(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const c = state.combat!;
  if (c.stage === "resolving") return null;
  const calc = computeCombat(state)!;
  const winning = (s: GameState) => !!s.combat && !!computeCombat(s)?.winning;
  if (calc.winning) {
    // Antes de atacar: Mapa do Tesouro e desejo do Glabrezu se continuar vencendo
    const extras: Action[] = [{ type: "ACCEPT_WISH" }];
    for (const id of [...me.hand, ...me.carried]) if (fxIs(state, id, "mapa")) extras.push({ type: "USE_CARD", cardId: id });
    for (const a of extras) {
      const s = simulate(state, me.id, a, ctx);
      if (s && winning(s) && computeCombat(s)!.playerTotal - computeCombat(s)!.monsterTotal >= 3) return a;
    }
    return { type: "RESOLVE" };
  }
  // Tenta virar o combate com o que tem
  const p = plan(state, me.id, (s) => (s.combat ? boostCandidates(s, P(s, me.id)) : []), (s) => !s.combat || winning(s), ctx, 4);
  if (p) return p;
  // Pede ajuda (prefere bots aliados)
  const m = mem(state);
  if (!c.helperId && !combatHas(state, c, "semPedirAjuda")) {
    if (state.prompts.some((pr) => pr.kind === "helpRequest" && pr.data.fighterId === me.id)) return null;
    const treasures = c.monsters.reduce((a, x) => a + (d(state, x.cardId) as MonsterCard).treasures, 0);
    const stake = monsterStake(state);
    // quanto custa fortalecer cada candidato (tesouros que ele leva + quão forte ele já está), com peso baixo
    const cost = (o: PlayerState) => {
      const count = o.bot ? 1 : Math.max(1, Math.ceil(treasures / 2));
      const w = isAlly(state, me.id, o) ? 0.3 : weight(state, me.id, o);
      return w * (count * 30 + (hasPassive(state, o, "nivelAoAjudar") ? 100 : 0)) + STRENGTH_PENALTY * strengthOf(state, o);
    };
    const benefit = stake.levels * 90 + treasures * 15;
    const candidates = state.players
      .filter((o) => o.id !== me.id && !m[`ask:${c.id}:${me.id}:${o.id}`])
      .filter((o) => calc.playerTotal + playerPower(state, o) > calc.monsterTotal)
      .filter((o) => cost(o) < benefit)
      .sort((a, b) => Number(isAlly(state, me.id, b)) - Number(isAlly(state, me.id, a)) || cost(a) - cost(b));
    const pick = candidates.find((o) => isAlly(state, me.id, o)) ?? candidates.find((o) => !o.bot && weight(state, me.id, o) <= 1);
    if (pick) {
      m[`ask:${c.id}:${me.id}:${pick.id}`] = 1;
      const count = pick.bot ? 1 : Math.max(1, Math.ceil(treasures / 2));
      return { type: "ASK_HELP", targetId: pick.id, count, mode: "random" };
    }
  }
  if (state.prompts.some((pr) => pr.kind === "helpOffer" && pr.playerId === me.id)) return null;
  // Fuga difícil e Coisas Ruins pesadas? Tenta escapar de outro jeito
  const danger = c.monsters.some((x) => {
    const md = d(state, x.cardId) as MonsterCard;
    const info = fleeInfo(state, me, x);
    const hard = info.impossible || (!info.auto && info.bonus < 1);
    return hard && md.badStuff.some((e) => e.t === "death" || (e.t === "levels" && e.n >= 3));
  });
  if (danger) {
    const escapes: Action[] = [];
    for (const ab of abilityInfos(state, me)) {
      if (!ab.available || !["encerrarCombate", "mandarMonstroEmbora"].includes(ab.acao)) continue;
      const disc = ab.wholeHand ? [] : cheapest(state, me, ab.discard);
      if (!disc) continue;
      const params = ab.fields.some((f) => f.kind === "monster") ? { monster: c.monsters[0].cardId } : {};
      escapes.push({ type: "ABILITY", key: ab.key, discard: disc, params });
    }
    for (const id of [...me.hand, ...me.carried]) {
      if (fxIs(state, id, "teletransporte")) escapes.push({ type: "USE_CARD", cardId: id });
      if (fxIs(state, id, "fugaAutomatica")) escapes.push({ type: "USE_CARD", cardId: id, targetId: me.id });
    }
    for (const a of escapes) if (simulate(state, me.id, a, ctx)) return a;
  }
  return { type: "FLEE" };
}

function decideOtherCombat(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const c = state.combat!;
  const calc = computeCombat(state)!;
  const fighter = P(state, c.fighterId);
  const onSide = calc.side.includes(me.id);
  const friendly = onSide || isAlly(state, me.id, fighter);
  const winning = (s: GameState) => !!s.combat && !!computeCombat(s)?.winning;
  if (friendly) {
    if (!calc.winning) {
      const p = plan(state, me.id, (s) => (s.combat ? boostCandidates(s, P(s, me.id)) : []), (s) => !s.combat || winning(s), ctx, 3);
      if (p) return p;
      // Oferece ajuda a bots aliados
      const m = mem(state);
      const key = `offer:${c.id}:${me.id}`;
      const stake = monsterStake(state);
      const worth =
        40 + (hasPassive(state, me, "nivelAoAjudar") ? 100 : 0) + 80 - weight(state, me.id, fighter) * stake.levels * 60 - STRENGTH_PENALTY * strengthOf(state, fighter) > 0;
      if (!onSide && !c.helperId && fighter.bot && !m[key] && worth && calc.playerTotal + playerPower(state, me) > calc.monsterTotal) {
        m[key] = 1;
        return { type: "OFFER_HELP", count: 1, mode: "random" };
      }
    }
    if (c.stage === "resolving" && !onSide && !c.passed.includes(me.id)) return { type: "PASS" };
    return null;
  }
  // Adversário: ameaça (pede tesouros para não atrapalhar) se consegue virar o combate
  const m = mem(state);
  const threatKey = `threat:${c.id}:${me.id}`;
  if (calc.winning && !m[threatKey] && !c.used.includes(`${me.id}:threat`) && !c.desafio) {
    const fw = weight(state, me.id, fighter);
    const free = freeTreasures(state, c);
    if (fw < 1.5 && free > 0 && canFlip(state, me.id, ctx)) {
      m[threatKey] = 1;
      const stake = monsterStake(state);
      return { type: "THREATEN", count: Math.min(free, Math.max(1, Math.ceil(stake.treasures / 2))) };
    }
    m[threatKey] = 1;
  }
  // Só atrapalha quando ele já decidiu atacar (janela de ataque)
  if (c.stage !== "resolving") return null;
  if (calc.winning) {
    const p = plan(state, me.id, (s) => (s.combat ? hinderCandidates(s, P(s, me.id)) : []), (s) => !s.combat || !winning(s), ctx, 4);
    if (p) return p;
  }
  if (!c.passed.includes(me.id)) return { type: "PASS" };
  return null;
}

/** Tenta negociar um item exclusivo da sua raça/classe que esteja na mesa de outro jogador. */
function tradeIdea(state: GameState, me: PlayerState): Action | null {
  if (state.combat || state.phase !== "PLAYING") return null;
  const m = mem(state);
  const myRace = me.race ? state.cards[me.race].defId.slice("race.".length) : undefined;
  const myClasses = me.classes.map((c) => state.cards[c].defId.slice("class.".length));
  for (const o of state.players) {
    if (o.id === me.id) continue;
    for (const it of [...o.equipped, ...o.carried]) {
      const df = itemDefOf(state, it);
      if (!df?.requires) continue;
      const exclusive =
        (myRace && df.requires.races?.includes(myRace as never)) || myClasses.some((c) => df.requires?.classes?.includes(c as never));
      if (!exclusive) continue;
      const key = `trade:${me.id}:${it}`;
      if (m[key] && state.turnSerial - m[key] < state.players.length * 3) continue;
      if (unbreakable(state, it)) continue;
      // Precisa ser melhor que o que já uso no slot
      const current = me.equipped.filter((e) => slotOf(state, e) === df.slot).map((e) => cardValue(state, e));
      if (current.length && Math.max(...current) >= cardValue(state, it)) continue;
      // Oferta justa: item meu (fora de uso de preferência) com preço parecido
      const offer = [...me.carried, ...me.equipped.filter((e) => slotOf(state, e) !== df.slot)]
        .filter((id) => itemDefOf(state, id) && !unbreakable(state, id))
        .map((id) => ({ id, diff: Math.abs((itemDefOf(state, id)!.price ?? 0) - df.price), price: itemDefOf(state, id)!.price, carried: me.carried.includes(id) }))
        .filter((x) => x.price >= df.price * 0.7)
        .sort((a, b) => Number(b.carried) - Number(a.carried) || a.diff - b.diff)[0];
      m[key] = state.turnSerial;
      if (!offer) continue;
      return { type: "TRADE", toId: o.id, give: [offer.id], take: [it] };
    }
  }
  return null;
}

function sellIdea(state: GameState, me: PlayerState): Action | null {
  if (me.level >= RULES.nivelMaximo - 1) return null;
  const junk = [...me.hand, ...me.carried].filter((id) => {
    const df = itemDefOf(state, id);
    if (!df) return false;
    if (!equipCheck(state, me, id).error) return false;
    const sameSlot = me.equipped.filter((e) => slotOf(state, e) === df.slot);
    return sameSlot.some((e) => cardValue(state, e) >= cardValue(state, id)) || !!df.requires || !!df.forbids;
  });
  junk.sort((a, b) => itemDefOf(state, b)!.price - itemDefOf(state, a)!.price);
  let gold = 0;
  const pick: string[] = [];
  for (const id of junk) {
    pick.push(id);
    gold += itemDefOf(state, id)!.price;
    if (gold >= RULES.ouroPorNivel) return { type: "SELL", cardIds: pick };
  }
  return null;
}

function decideOwnTurn(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const improve = bestOf(state, me.id, manageCandidates(state, me, true), ctx, 6);
  if (improve) return improve.action;
  const sell = sellIdea(state, me);
  if (sell) return sell;
  if (state.turnPhase === "KICK") {
    if (state.prompts.some((p) => p.blocking)) return null;
    return { type: "KICK_DOOR" };
  }
  if (state.turnPhase === "AFTER_DOOR") {
    // Procura encrenca com um monstro que consiga vencer com folga
    let bestM: { id: string; margin: number } | null = null;
    for (const id of me.hand) {
      if (d(state, id).kind !== "monster") continue;
      const s = simulate(state, me.id, { type: "LOOK_FOR_TROUBLE", cardId: id }, ctx);
      const calc = s && computeCombat(s);
      if (!calc) continue;
      const margin = calc.playerTotal - calc.monsterTotal;
      if (calc.winning && margin >= 2 && (!bestM || margin > bestM.margin)) bestM = { id, margin };
    }
    if (bestM) return { type: "LOOK_FOR_TROUBLE", cardId: bestM.id };
    return { type: "LOOT_ROOM" };
  }
  if (state.turnPhase === "END") {
    if (state.reward || state.prompts.some((p) => p.blocking) || state.turn.ending) return null;
    const trade = tradeIdea(state, me);
    if (trade) return trade;
    return { type: "END_TURN" };
  }
  return null;
}

/** Decide a próxima ação de um bot (ou null se não houver nada a fazer agora). */
export function decide(state: GameState, botId: string, ctx: Ctx): Action | null {
  const me = P(state, botId);
  if (!me?.bot || state.phase === "FINISHED") return null;
  const pr = state.prompts.find((p) => p.playerId === botId);
  if (pr) return answerFor(state, me, pr, ctx);
  if (me.owlPeek) {
    const top = state.decks.door[0];
    const bad = top ? ["monster", "curse"].includes(d(state, top).kind) && (d(state, top).kind === "curse" || (d(state, top) as MonsterCard).level > me.level + 4) : false;
    return { type: "OWL_DECIDE", bottom: bad };
  }
  const notice = state.notices.find((n) => n.playerId === botId);
  if (notice) return { type: "DISMISS_NOTICE", id: notice.id };
  if (state.phase === "SETUP") {
    const improve = bestOf(state, botId, manageCandidates(state, me, true), ctx, 4);
    if (improve) return improve.action;
    return me.ready ? null : { type: "READY" };
  }
  const c = state.combat;
  if (c) {
    if (c.stage === "badstuff") return decideBadStuff(state, me);
    if (c.fighterId === botId) return decideFighter(state, me, ctx);
    return decideOtherCombat(state, me, ctx);
  }
  if (state.reward) return null;
  if (isCurrent(state, botId)) return decideOwnTurn(state, me, ctx);
  // Fora do seu turno: maldições no líder/humanos e negociações
  const key = `idle:${botId}`;
  const m = mem(state);
  const stamp = state.turnSerial * 10 + (state.turnPhase === "END" ? 1 : 0);
  if (m[key] === stamp) return null;
  m[key] = stamp;
  const harm = bestOf(state, botId, manageCandidates(state, me, false), ctx, 40);
  if (harm) return harm.action;
  return tradeIdea(state, me);
}

/**
 * Faz no máximo um bot agir, respeitando o ritmo (botNextAt).
 * Retorna true se o estado mudou.
 */
export function stepBots(state: GameState, ctx: Ctx): boolean {
  if (state.phase === "FINISHED") return false;
  if ((state.botNextAt ?? 0) > ctx.now) return false;
  const bots = state.players.filter((p) => p.bot);
  if (bots.length === 0) return false;
  const current = state.order[state.currentIdx];
  const prio = (id: string) =>
    state.prompts.some((p) => p.playerId === id) ? 0 : state.combat?.fighterId === id ? 1 : id === current ? 2 : 3;
  const ordered = [...bots].sort((a, b) => prio(a.id) - prio(b.id));
  for (const b of ordered) {
    const memBefore = JSON.stringify(state.botMemory ?? {});
    let action: Action | null = null;
    try {
      action = decide(state, b.id, ctx);
    } catch (e) {
      console.error("bot decide", e);
      action = null;
    }
    if (!action) {
      if (JSON.stringify(state.botMemory ?? {}) !== memBefore) return true;
      continue;
    }
    const clone = structuredClone(state);
    try {
      applyAction(clone, b.id, action, ctx);
    } catch (e) {
      if (!(e instanceof GameError)) console.error("bot action", e);
      // Plano B para nunca travar o turno do bot
      const fallback = fallbackAction(state, b.id);
      if (!fallback || JSON.stringify(fallback) === JSON.stringify(action)) continue;
      try {
        applyAction(clone, b.id, fallback, ctx);
      } catch {
        continue;
      }
    }
    Object.assign(state, clone);
    state.botNextAt = ctx.now + BOT_DELAY_MS;
    return true;
  }
  return false;
}

function fallbackAction(state: GameState, botId: string): Action | null {
  const pr = state.prompts.find((p) => p.playerId === botId);
  if (pr) return { type: "ANSWER", promptId: pr.id, answer: {} };
  const c = state.combat;
  if (c) {
    if (c.stage === "badstuff") return { type: "ACCEPT_BAD_STUFF" };
    if (c.fighterId === botId) return c.stage === "fight" ? { type: "FLEE" } : null;
    if (c.stage === "resolving") return { type: "PASS" };
    return null;
  }
  if (state.phase === "SETUP") return { type: "READY" };
  if (!isCurrent(state, botId)) return null;
  if (state.turnPhase === "KICK") return { type: "KICK_DOOR" };
  if (state.turnPhase === "AFTER_DOOR") return { type: "LOOT_ROOM" };
  if (state.turnPhase === "END") return { type: "END_TURN" };
  return null;
}

/** Há algum bot que pode ter algo a fazer agora? (barato; usado para evitar cálculos à toa) */
export function hasBots(state: GameState): boolean {
  return state.players.some((p) => p.bot);
}
