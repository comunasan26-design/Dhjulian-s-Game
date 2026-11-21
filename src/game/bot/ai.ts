// IA dos bots. Eles jogam para ganhar, sem dó:
// - simulam cada jogada no motor (que é puro) e procuram o COMBO mais barato de cartas e habilidades
//   que vira um combate — a favor deles ou contra quem está lutando;
// - guardam as cartas boas para a hora certa e só gastam o necessário;
// - procuram encrenca quando um combo garante a vitória com folga contra o que os outros podem jogar;
// - vendem o que não serve para subir de nível, usam a mão que sobraria na Caridade e
//   gastam tudo o que têm para impedir que alguém chegue ao nível máximo;
// - aliam-se a outros bots contra humanos e contra quem está na frente, e traem quem está quase ganhando.
import { CARD_DEFS, type CardDef, type CurseCard, findFx, type ItemCard, type MonsterCard, RULES } from "../catalog";
import { abilityInfos } from "../engine/abilities";
import { type Action, applyAction } from "../engine/actions";
import { type Ctx, type GameState, GameError, type PlayerState, type Prompt } from "../engine/state";
import { freeTreasures, rewardTreasures } from "../engine/core";
import { combatHas, hasCurseFx } from "../engine/fx";
import { computeCombat, equipCheck, fleeInfo, handLimit, playerPower, playerSide, slotOf } from "../engine/stats";
import { hasPassive, isCurrent, passiveFx } from "../engine/util";

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

function itemDefOf(state: GameState, cardId: string): ItemCard | null {
  const df = d(state, cardId);
  return df.kind === "item" ? df : null;
}

const fxIs = (state: GameState, cardId: string, tipo: string) => !!findFx(state.cards[cardId]?.defId, tipo);
const unbreakable = (state: GameState, cardId: string) =>
  (state.cards[cardId]?.runes ?? []).some((r) => findFx(state.cards[r]?.defId, "naoRoubavel"));
const fxVal = (state: GameState, cardId: string, tipo: string, key = "valor") => Number(findFx(state.cards[cardId]?.defId, tipo)?.[key] ?? 0) || 0;

/** Determinístico e "médio" para simular (d6 = 4). */
const SIM_RNG = { int: (max: number) => Math.floor((max - 1) / 2) + (max === 6 ? 1 : 0) };

/** Simula uma ação numa cópia do estado (sem o histórico, que é o que mais pesa para copiar). */
function simulate(state: GameState, actorId: string, action: Action, ctx: Ctx): GameState | null {
  const log = state.log;
  state.log = [];
  let s: GameState;
  try {
    s = structuredClone(state);
  } finally {
    state.log = log;
  }
  try {
    applyAction(s, actorId, action, { now: ctx.now, rng: SIM_RNG, offline: ctx.offline });
    return s;
  } catch (e) {
    if (e instanceof GameError) return null;
    return null;
  }
}

const MAX = () => RULES.nivelMaximo;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ----------------------------------------------------------------------------
// Dificuldade (1 a 30)
// ----------------------------------------------------------------------------

/**
 * Como a dificuldade muda o jeito de jogar: nas baixas o bot enxerga combos menores, avalia as jogadas
 * com "ruído", às vezes faz o óbvio sem pensar (chuta a porta, foge, passa) e atrapalha menos os outros.
 * Na 30 ele joga o melhor que sabe.
 */
interface SkillProfile {
  t: number;
  depth: number;
  noise: number;
  mistake: number;
  hinder: number;
  rand: () => number;
}

export function skillProfile(skill: number, rand: () => number = Math.random): SkillProfile {
  const t = (Math.max(1, Math.min(30, skill)) - 1) / 29;
  return {
    t,
    depth: 1 + Math.round(3 * t),
    noise: 80 * Math.pow(1 - t, 1.3),
    mistake: 0.4 * Math.pow(1 - t, 1.6),
    hinder: 0.2 + 0.8 * t,
    rand,
  };
}

const FULL_SKILL: SkillProfile = { t: 1, depth: 4, noise: 0, mistake: 0, hinder: 1, rand: () => 0.5 };
/** Perfil do bot que está decidindo agora (as decisões são síncronas). */
let SK: SkillProfile = FULL_SKILL;


// ----------------------------------------------------------------------------
// Valores
// ----------------------------------------------------------------------------

/** Valor de estar num nível: cada nível vale 100 e os últimos valem bem mais (a corrida aperta no fim). */
function levelValue(level: number): number {
  const end = Math.max(0, level - (MAX() - 6));
  return level * 100 + end * end * 20;
}

function levelGain(from: number, n: number): number {
  return levelValue(Math.min(MAX(), from + n)) - levelValue(from);
}

/** Valor aproximado de uma carta para o bot `me` (contexto: nível dele). */
function cardValue(state: GameState, cardId: string, me?: PlayerState): number {
  const c = state.cards[cardId];
  if (!c) return 0;
  const df = CARD_DEFS[c.defId];
  switch (df.kind) {
    case "levelup":
      return me && me.level >= MAX() - 1 ? 8 : 95;
    case "item":
      return df.bonus * 11 + df.price / 50 + (df.flee ?? 0) * 6 + (c.runes?.length ?? 0) * 12 + (Number(c.reforged) || 0) * 10;
    case "potion": {
      const lado = fxVal(state, cardId, "bonusLado") || fxVal(state, cardId, "menosEmAlvo") || fxVal(state, cardId, "contraMortosVivos") * 0.7;
      const special = fxIs(state, cardId, "forcaAjuda") || fxIs(state, cardId, "fugaAutomatica") ? 45 : fxIs(state, cardId, "subirNivel") ? (me && me.level >= MAX() - 1 ? 10 : 90) : 0;
      return 18 + lado * 9 + special + df.price / 60;
    }
    case "rune":
      return 22 + df.price / 50;
    case "misc":
      return 22 + df.price / 40 + (fxIs(state, cardId, "teletransporte") ? 25 : 0);
    case "monsterBonus":
      return 12 + Math.abs(df.value) * 6;
    case "wandering":
      return 34;
    case "curse":
      return 30;
    case "monster":
      return 18;
    default:
      return 12;
  }
}

/** O que o jogador tem (nível + cartas), na escala dos valores acima. */
function assets(state: GameState, me: string): number {
  const p = P(state, me);
  let v = levelValue(p.level);
  for (const id of p.hand) v += cardValue(state, id, p);
  for (const id of p.carried) v += cardValue(state, id, p) * 0.9;
  for (const id of p.equipped) v += cardValue(state, id, p) * 1.1 + 4;
  v -= p.curses.length * 22 + p.pendingCombatCurses.length * 28;
  return v;
}

// ----------------------------------------------------------------------------
// Quem é ameaça
// ----------------------------------------------------------------------------

/**
 * O quanto um adversário preocupa: humanos mais que bots, quem está acima da média e na liderança
 * mais ainda, e quem está a poucos níveis da vitória vira o alvo de todo mundo — mesmo que seja outro bot.
 */
function threat(state: GameState, me: string, o: PlayerState): number {
  if (o.id === me) return 0;
  let w = o.bot ? 0.7 : 1;
  const others = state.players.filter((x) => x.id !== o.id);
  w *= 1 + Math.max(0, o.level - avg(others.map((x) => x.level))) * 0.12;
  const top = Math.max(...state.players.map((x) => x.level));
  if (o.level === top && o.level > 1 && o.level >= P(state, me).level) w *= 1.35;
  const toGo = MAX() - o.level;
  if (toGo <= 4) w *= 1 + (5 - toGo) * 0.45;
  // quem está bem atrás de mim preocupa menos
  const behind = P(state, me).level - o.level - 2;
  if (behind > 0 && toGo > 4) w *= Math.max(0.4, 1 - behind * 0.12);
  return w;
}

/** Peso antigo (mantido para as decisões de ajuda e ameaça). */
function weight(state: GameState, me: string, other: PlayerState): number {
  return threat(state, me, other);
}

function isAlly(state: GameState, me: string, other: PlayerState): boolean {
  return !!other.bot && other.id !== me && threat(state, me, other) < 0.85 && other.level < MAX() - 3;
}

/**
 * O quanto um jogador já está forte em relação à mesa (0 a 1): nível acima da média, liderança,
 * proximidade da vitória e poder de combate. Usado (com peso baixo) antes de ajudar alguém.
 */
export function strengthOf(state: GameState, p: PlayerState): number {
  const others = state.players.filter((x) => x.id !== p.id);
  if (others.length === 0) return 0;
  const lead = clamp01((p.level - avg(others.map((o) => o.level))) / 5);
  const ahead = p.level >= Math.max(...others.map((o) => o.level)) && p.level > 1 ? 0.25 : 0;
  const nearWin = clamp01((p.level - (MAX() - 8)) / 7);
  const pow = clamp01((playerPower(state, p) - avg(others.map((o) => playerPower(state, o)))) / 12);
  return clamp01(0.35 * lead + ahead + 0.25 * nearWin + 0.15 * pow);
}

/** Peso (baixo) de fortalecer alguém que já está forte, em "pontos" comparáveis a tesouros/níveis. */
const STRENGTH_PENALTY = 50;

// ----------------------------------------------------------------------------
// Combate: o que está em jogo
// ----------------------------------------------------------------------------

function monsterStake(state: GameState): { levels: number; treasures: number } {
  const c = state.combat;
  if (!c) return { levels: 0, treasures: 0 };
  let levels = 0;
  for (const m of c.monsters) if (!m.defeated) levels += (d(state, m.cardId) as MonsterCard).levels;
  if (c.desafio) levels *= c.desafioMult ?? 1;
  return { levels, treasures: rewardTreasures(state, c) };
}

/** Valor, para `pid`, de o lado dos jogadores vencer o combate atual agora. */
function stakeFor(state: GameState, pid: string): number {
  const c = state.combat;
  if (!c) return 0;
  const p = P(state, pid);
  const side = playerSide(state, c);
  if (!side.includes(pid)) return 0;
  const { levels, treasures } = monsterStake(state);
  if (pid === c.fighterId) {
    const share = c.helperId && !c.helperForced ? Math.max(0, treasures - (c.helperDeal?.count ?? 0)) : treasures;
    if (p.level + levels >= MAX()) return 100_000;
    return levelGain(p.level, levels) + share * 30;
  }
  const elf = hasPassive(state, p, "nivelAoAjudar") ? levelGain(p.level, 1) : 0;
  return (c.helperForced ? 0 : (c.helperDeal?.count ?? 0) * 30) + elf;
}

/** Quanto custa sofrer as Coisas Ruins desse monstro. */
function badStuffCost(state: GameState, p: PlayerState, md: MonsterCard): number {
  const equippedVals = p.equipped.map((id) => cardValue(state, id, p) * 1.1);
  const avgEq = avg(equippedVals) || 15;
  let c = 0;
  for (const e of md.badStuff) {
    switch (e.t) {
      case "death":
        c += 220 + equippedVals.reduce((a, b) => a + b, 0) + p.carried.reduce((a, id) => a + cardValue(state, id, p), 0) + p.hand.reduce((a, id) => a + cardValue(state, id, p), 0) * 0.8;
        break;
      case "levels":
        c += levelValue(p.level) - levelValue(Math.max(1, p.level - e.n));
        break;
      case "rollLevels":
        c += (levelValue(p.level) - levelValue(Math.max(1, p.level - Math.ceil(e.upTo / 2)))) * Math.max(1, e.rolls) * 0.6;
        break;
      case "bigOrLevels":
        c += Math.min(80, levelValue(p.level) - levelValue(Math.max(1, p.level - e.n)));
        break;
      case "handCards":
        c += e.n * 25;
        break;
      case "chooseEquipped":
      case "randomEquipped":
        c += e.n * avgEq;
        break;
      case "carried":
        c += p.carried.reduce((a, id) => a + cardValue(state, id, p), 0);
        break;
      case "tempPenalty":
        c += Math.abs(e.value) * 12;
        break;
      case "othersLoseLevels":
        break;
      default:
        c += 45;
    }
  }
  return c;
}

/** Perda esperada se `p` tiver de fugir de todos os monstros do combate agora. */
function expectedFleeLoss(state: GameState, p: PlayerState): number {
  const c = state.combat;
  if (!c) return 0;
  let loss = 0;
  for (const cm of c.monsters) {
    if (cm.defeated) continue;
    const md = d(state, cm.cardId) as MonsterCard;
    const info = fleeInfo(state, p, cm);
    let fail: number;
    if (info.auto) fail = 0;
    else if (info.impossible) fail = 1;
    else {
      const mods = c.fleeMods.filter((m) => !m.target || m.target === p.id).reduce((a, m) => a + m.value, 0);
      const need = RULES.fugirCom - info.bonus - mods;
      fail = 1 - clamp01((7 - need) / 6);
    }
    loss += fail * badStuffCost(state, p, md);
  }
  return loss;
}

/** Quanto os adversários de quem luta conseguem atrapalhar (estimativa pelo tamanho das mãos). */
function hostileHinder(state: GameState, fighterId: string): number {
  let h = 0;
  for (const o of state.players) {
    if (o.id === fighterId) continue;
    if (o.bot && isAlly(state, o.id, P(state, fighterId))) continue;
    h += Math.min(o.hand.length, 6) * 0.9;
  }
  return h;
}

/** Quanto ainda posso somar ao meu lado com as cartas que sobram na mão (estimativa). */
function reserveBoost(state: GameState, p: PlayerState): number {
  let r = 0;
  for (const id of p.hand) {
    const df = d(state, id);
    if (df.kind === "monsterBonus" && df.value < 0) r += -df.value;
    if (df.kind === "potion") r += fxVal(state, id, "bonusLado") || fxVal(state, id, "menosEmAlvo") || 0;
  }
  return r;
}

const marginOf = (s: GameState) => {
  const calc = computeCombat(s);
  return calc ? calc.playerTotal - calc.monsterTotal : 0;
};
const winningNow = (s: GameState) => !!s.combat && !!computeCombat(s)?.winning;
/** O combate acabou bem para o lado dos jogadores (venceu ou o monstro foi embora)? */
const endedWell = (s: GameState) => !s.combat && (s.turn.lastResult === "won" || s.turn.lastResult === "ended");

// ----------------------------------------------------------------------------
// Decisões de ajuda, ameaça e suborno
// ----------------------------------------------------------------------------

/** Aceito um pedido de ajuda de `fighter` em troca de `count` tesouros? */
export function shouldAcceptHelpRequest(state: GameState, me: PlayerState, fighter: PlayerState, count: number, threatened = false, threatLevels = 0): boolean {
  const calc = computeCombat(state);
  const wouldWin = !!calc && calc.playerTotal + playerPower(state, me) > calc.monsterTotal;
  const refuseCost = threatened ? levelValue(me.level) - levelValue(Math.max(1, me.level - Math.max(1, threatLevels))) : 0;
  if (!wouldWin) return false;
  const stake = monsterStake(state);
  const ally = isAlly(state, me.id, fighter);
  if (fighter.level + stake.levels >= MAX() && !ally) return false;
  if (fighter.level >= MAX() - 2 && !ally && !threatened) return false;
  // Ganho para mim (tesouros + nível do Elfo) contra o quanto o lutador avança
  const myGain = count * 40 + (hasPassive(state, me, "nivelAoAjudar") ? 100 : 0);
  const theirGain = weight(state, me.id, fighter) * stake.levels * 60;
  // mesmo quando vale a pena, fortalecer quem já está forte pesa um pouco contra
  const score = myGain - theirGain - STRENGTH_PENALTY * strengthOf(state, fighter) + (ally ? 80 : 0);
  if (score > 0) return true;
  // ameaçado: às vezes é melhor ajudar do que perder níveis
  return threatened && me.level > 1 && score + refuseCost > 0;
}

/** Aceito a oferta de `helper` (que leva `count` tesouros) para me ajudar? */
export function shouldAcceptHelpOffer(state: GameState, me: PlayerState, helper: PlayerState, count: number): boolean {
  const calc = computeCombat(state);
  if (!calc || calc.winning) return false;
  if (calc.playerTotal + playerPower(state, helper) <= calc.monsterTotal) return false;
  if (!helper.bot && helper.level >= MAX() - 3) return false;
  const stake = monsterStake(state);
  const benefit = stake.levels * 90 + Math.max(0, stake.treasures - count) * 25 + expectedFleeLoss(state, me) * 0.5;
  const w = isAlly(state, me.id, helper) ? 0.3 : weight(state, me.id, helper);
  const helperGain = w * (count * 30 + (hasPassive(state, helper, "nivelAoAjudar") ? 100 : 0));
  return benefit - helperGain - STRENGTH_PENALTY * strengthOf(state, helper) > 0;
}

/** O jogador `who` consegue fazer o lutador perder com as cartas que tem? */
function canFlip(state: GameState, who: string, ctx: Ctx): boolean {
  if (!winningNow(state)) return false;
  const w = P(state, who);
  if (!w) return false;
  return !!findCombo(state, who, hinderCandidates(state, w), hinderGoal(1), hinderMetric, ctx, { maxDepth: 3, simCap: 120 });
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
  const winsGame = me.level + stake.levels >= MAX();
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

// ----------------------------------------------------------------------------
// Avaliação geral do estado (para decisões fora de combate)
// ----------------------------------------------------------------------------

function evaluate(state: GameState, me: string): number {
  if (state.winnerId === me) return 1e7;
  if (state.winnerId) return -1e7;
  const bot = P(state, me);
  let score = assets(state, me) + playerPower(state, bot) * 12;
  if (bot.race) score += 15;
  if (bot.classes.length) score += 15;
  for (const o of state.players) {
    if (o.id === me) continue;
    const w = threat(state, me, o);
    score -= w * (levelValue(o.level) + playerPower(state, o) * 8 + o.hand.length * 10 - o.curses.length * 25 - o.pendingCombatCurses.length * 35);
  }
  const c = state.combat;
  if (c && c.stage !== "badstuff") {
    const calc = computeCombat(state);
    if (calc) {
      const margin = calc.playerTotal - calc.monsterTotal;
      if (calc.side.includes(me)) {
        score += calc.winning ? stakeFor(state, me) * 0.9 + Math.min(margin, 6) * 4 : Math.max(margin, -30) * 6 - expectedFleeLoss(state, bot) * 0.6;
      } else if (calc.winning) {
        for (const pid of calc.side) score -= threat(state, me, P(state, pid)) * stakeFor(state, pid) * 0.9;
      }
    }
  }
  return score;
}

/** Escolhe as N cartas menos valiosas da mão (exceto as reservadas). */
function cheapest(state: GameState, p: PlayerState, n: number, reserved: string[] = []): string[] | null {
  const pool = p.hand.filter((id) => !reserved.includes(id)).sort((a, b) => cardValue(state, a, p) - cardValue(state, b, p));
  return pool.length >= n ? pool.slice(0, n) : null;
}

// ----------------------------------------------------------------------------
// Geração de candidatos
// ----------------------------------------------------------------------------

type Mode = "boost" | "hinder" | "manage";

const COMBAT_ACOES = [
  "bonusCombate",
  "nivelDobradoAjudando",
  "arremesso",
  "monstrosPerdemNivel",
  "ignorarEspecial",
  "mandarMonstroEmbora",
  "polimorfia",
  "domarFera",
  "duplicata",
  "dobrarFuria",
  "dobrarItem",
  "cancelarBonusMonstro",
  "itemDaMaoParaLado",
  "forcarAjuda",
  "usarItemRestrito",
  "desafio",
  "anularErrante",
];
/** Ativas que o bot usa por regras próprias (fora da busca de combos). */
const SPECIAL_ACOES = ["encerrarCombate", "assumirCoisasRuins", "ameacarAjuda", "abrirOutraPorta", "hibernar", "pressagio"];

function abilityCandidates(state: GameState, me: PlayerState, mode: Mode): Action[] {
  const out: Action[] = [];
  const c = state.combat;
  const monsters = c ? c.monsters.filter((m) => !m.defeated).map((m) => m.cardId) : [];
  for (const ab of abilityInfos(state, me)) {
    if (!ab.available) continue;
    const combatOnly = COMBAT_ACOES.includes(ab.acao);
    if (mode === "manage" && combatOnly) continue;
    if (mode !== "manage" && !combatOnly && ab.acao !== "maldicaoForca") continue;
    if (SPECIAL_ACOES.includes(ab.acao)) continue;
    const onSide = !!c && playerSide(state, c).includes(me.id);
    const base = (params: Record<string, unknown>, reserved: string[] = []) => {
      if (ab.wholeHand) return { type: "ABILITY", key: ab.key, discard: [], params } as Action;
      const disc = cheapest(state, me, ab.discard, reserved);
      if (!disc) return null;
      return { type: "ABILITY", key: ab.key, discard: disc, params } as Action;
    };
    const push = (a: Action | null) => a && out.push(a);
    const fields = ab.fields.map((f) => f.kind);
    // combos de combate: no modo "boost" só o que ajuda o meu lado; no "hinder" só o que atrapalha
    if (mode === "hinder" && !["itemDaMaoParaLado", "maldicaoForca", "polimorfia"].includes(ab.acao)) continue;
    if (mode === "boost" && ["maldicaoForca"].includes(ab.acao) && !onSide) continue;
    if (ab.acao === "desafio" && (mode !== "boost" || c?.fighterId !== me.id)) continue;
    if (fields.length === 0) {
      push(base({}));
      continue;
    }
    if (ab.acao === "anularErrante") {
      for (const m of c?.monsters ?? []) if (m.wandering && !m.defeated) push(base({ monster: m.cardId }));
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
    if (ab.acao === "forcarAjuda" && c) {
      for (const o of state.players) if (o.id !== me.id && !playerSide(state, c).includes(o.id)) push(base({ player: o.id }));
      continue;
    }
    if (ab.acao === "usarItemRestrito") {
      const restricted = [...me.hand, ...me.carried].filter((id) => itemDefOf(state, id) && equipCheck(state, me, id).error);
      restricted.sort((a, b) => (itemDefOf(state, b)?.bonus ?? 0) - (itemDefOf(state, a)?.bonus ?? 0));
      for (const r of restricted.slice(0, 2)) push(base({ item: r }, [r]));
      continue;
    }
    if (ab.acao === "maldicaoForca") {
      if (c) {
        const targets = mode === "hinder" ? playerSide(state, c).filter((id) => id !== me.id) : [];
        for (const t of targets) push(base({ player: t }));
      } else for (const o of state.players) if (o.id !== me.id && !isAlly(state, me.id, o)) push(base({ player: o.id }));
      continue;
    }
    if (ab.acao === "roubarNivel") {
      for (const o of state.players) if (o.id !== me.id && o.level >= me.level) push(base({ player: o.id }));
      continue;
    }
    if (ab.acao === "reforjar") {
      const cost = [...me.hand, ...me.carried].filter((id) => itemDefOf(state, id)).sort((a, b) => cardValue(state, a, me) - cardValue(state, b, me))[0];
      const target = me.equipped
        .filter((id) => slotOf(state, id) !== "ring" && !state.cards[id].reforged)
        .sort((a, b) => cardValue(state, b, me) - cardValue(state, a, me))[0];
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
    if (ab.acao === "trocarItem") {
      for (const mine of me.equipped)
        for (const o of state.players) {
          if (o.id === me.id || isAlly(state, me.id, o)) continue;
          for (const it of o.equipped)
            if (slotOf(state, it) === slotOf(state, mine) && cardValue(state, it, me) > cardValue(state, mine, me) + 10) push(base({ item: mine, player: o.id, otherItem: it }));
        }
      continue;
    }
    if (ab.acao === "bugiganga") {
      const best = state.decks.treasureDiscard
        .filter((id) => itemDefOf(state, id))
        .sort((a, b) => cardValue(state, b, me) - cardValue(state, a, me))[0];
      if (best) push(base({ mode: "discard", card: best }));
      continue;
    }
    if (ab.acao === "buscarPocao") {
      push(base({}));
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
  const target = side.includes(me.id) ? me.id : c.fighterId;
  for (const id of [...me.hand, ...me.carried]) {
    const df = d(state, id);
    if (df.kind === "monsterBonus" && df.value < 0 && me.hand.includes(id)) for (const m of monsters) out.push({ type: "PLAY_MONSTER_BONUS", cardId: id, monsterId: m });
    if (df.kind === "potion") {
      if (fxIs(state, id, "bonusLado") || fxIs(state, id, "contraMortosVivos")) out.push({ type: "USE_CARD", cardId: id, side: "player", targetId: target });
      if (fxIs(state, id, "menosEmAlvo")) for (const m of monsters) out.push({ type: "USE_CARD", cardId: id, monsterId: m });
      if (fxIs(state, id, "forcaAjuda") && me.id === c.fighterId && !c.helperId)
        for (const o of state.players) if (o.id !== me.id) out.push({ type: "USE_CARD", cardId: id, targetId: o.id });
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

/** Ações para atrapalhar quem está lutando (inclui combos com Monstro Errante). */
function hinderCandidates(state: GameState, me: PlayerState): Action[] {
  const c = state.combat!;
  const out: Action[] = [];
  const side = playerSide(state, c);
  const monsters = c.monsters.filter((m) => !m.defeated).map((m) => m.cardId);
  const handMonsters = me.hand.filter((id) => d(state, id).kind === "monster");
  const wanderers = me.hand.filter((id) => d(state, id).kind === "wandering");
  // Monstros Errantes primeiro: o resto do combo pode mirar no monstro que entra
  for (const w of wanderers.slice(0, 1)) for (const m of handMonsters) out.push({ type: "PLAY_WANDERING", cardId: w, monsterCardId: m });
  const targets = wanderers.length ? [...monsters, ...handMonsters] : monsters;
  for (const id of me.hand) {
    const df = d(state, id);
    if (df.kind === "monsterBonus" && df.value > 0) for (const m of targets) out.push({ type: "PLAY_MONSTER_BONUS", cardId: id, monsterId: m });
    if (df.kind === "potion" && fxIs(state, id, "bonusLado")) out.push({ type: "USE_CARD", cardId: id, side: "monster" });
    if (fxIs(state, id, "menosEmAlvo")) for (const t of side) out.push({ type: "USE_CARD", cardId: id, targetId: t });
    if (df.kind === "curse") {
      const cd = df as CurseCard;
      // maldições de combate no lutador; as outras (perder item, nível, poder) em quem estiver do lado dele
      if (cd.curseType === "combat") out.push({ type: "PLAY_CURSE", cardId: id, targetId: c.fighterId });
      else for (const t of side) out.push({ type: "PLAY_CURSE", cardId: id, targetId: t });
    }
  }
  for (const id of [...me.hand, ...me.carried]) {
    if (fxIs(state, id, "isca")) for (const m of targets) out.push({ type: "USE_CARD", cardId: id, monsterId: m });
  }
  out.push(...abilityCandidates(state, me, "hinder"));
  return out;
}

/** Melhorias fora de combate: equipar, runas, subir nível, maldições, habilidades. */
/** Passivas que dão bônus por slots vazios ou mãos livres (aí tirar um item pode ser melhor). */
function likesEmptySlots(state: GameState, me: PlayerState): boolean {
  return hasPassive(state, me, "bonusPorSlotVazio") || passiveFx(state, me, "forca").some((f) => !!f.seMaosLivres);
}

/** Quantas vezes o bot já mexeu nesta carta (equipar/tirar) neste turno: evita vai-e-volta. */
function gearMoves(state: GameState, me: string, cardId: string): number {
  return mem(state)[`gear:${state.turnSerial}:${me}:${cardId}`] ?? 0;
}
function noteGear(state: GameState, me: string, a: Action | null): Action | null {
  if (a && (a.type === "EQUIP" || a.type === "UNEQUIP")) {
    const m = mem(state);
    for (const k of Object.keys(m)) if (k.startsWith("gear:") && !k.startsWith(`gear:${state.turnSerial}:`)) delete m[k];
    const k = `gear:${state.turnSerial}:${me}:${a.cardId}`;
    m[k] = (m[k] ?? 0) + 1;
  }
  return a;
}

function manageCandidates(state: GameState, me: PlayerState, ownTurn: boolean): Action[] {
  const all = manageCandidatesRaw(state, me, ownTurn);
  return all.filter((a) => !((a.type === "EQUIP" || a.type === "UNEQUIP") && gearMoves(state, me.id, a.cardId) >= 2));
}

function manageCandidatesRaw(state: GameState, me: PlayerState, ownTurn: boolean): Action[] {
  const out: Action[] = [];
  if (ownTurn || state.phase === "SETUP") {
    for (const id of [...me.hand, ...me.carried]) {
      const df = d(state, id);
      if (df.kind === "item" || state.cards[id].tamed) {
        const chk = equipCheck(state, me, id);
        if (!chk.error) out.push({ type: "EQUIP", cardId: id });
        else if (df.kind === "item") {
          // Troca por um item pior no mesmo slot
          const worse = me.equipped.filter((e) => slotOf(state, e) === df.slot && cardValue(state, e, me) < cardValue(state, id, me));
          for (const w of worse) out.push({ type: "UNEQUIP", cardId: w });
        }
      }
      if (df.kind === "rune") for (const it of me.equipped) out.push({ type: "SOCKET_RUNE", runeId: id, itemId: it });
      if (df.kind === "race") out.push({ type: "PLAY_RACE", cardId: id });
      if (df.kind === "class") {
        out.push({ type: "PLAY_CLASS", cardId: id });
        for (const c of me.classes) out.push({ type: "PLAY_CLASS", cardId: id, replaceId: c });
      }
      if (df.kind === "misc" && df.permanent && me.hand.includes(id)) out.push({ type: "PLACE", cardId: id });
    }
    // montagem: tirar itens (Bárbaro, Monge…) e largar raça/classe que atrapalham
    if (likesEmptySlots(state, me)) for (const id of me.equipped) out.push({ type: "UNEQUIP", cardId: id });
    if (me.race) out.push({ type: "DISCARD_RACE" });
    for (const c of me.classes) out.push({ type: "DISCARD_CLASS", cardId: c });
  }
  if (state.phase !== "PLAYING") return out;
  for (const id of me.hand) {
    const df = d(state, id);
    if (df.kind === "levelup" && me.level < MAX() - 1) out.push({ type: "PLAY_LEVELUP", cardId: id });
    if (fxIs(state, id, "subirNivel") && me.level < MAX() - 1) out.push({ type: "USE_CARD", cardId: id });
    if (df.kind === "curse") {
      for (const o of state.players) if (o.id !== me.id && !isAlly(state, me.id, o)) out.push({ type: "PLAY_CURSE", cardId: id, targetId: o.id });
    }
  }
  for (const cu of me.curses) {
    const water = [...me.hand, ...me.carried].find((id) => fxIs(state, id, "removePodridao"));
    if (water && findFx(cu.defId, "removidaPorAguaBenta")) out.push({ type: "USE_CARD", cardId: water, targetId: me.id });
  }
  const heal = [...me.hand, ...me.carried].find((id) => fxIs(state, id, "devolveNivel"));
  if (heal && (state.turn.lastCombatLost[me.id] ?? 0) > 0) out.push({ type: "USE_CARD", cardId: heal, targetId: me.id });
  out.push(...abilityCandidates(state, me, "manage"));
  return out;
}

/** Escolhe a melhor ação (simulada) que melhora a avaliação acima de um limiar. */
/** Jogadas que mudam a "montagem" do personagem: avaliadas depois de reequipar tudo (combos de raça/classe/itens). */
const BUILD = new Set<Action["type"]>(["PLAY_RACE", "PLAY_CLASS", "DISCARD_RACE", "DISCARD_CLASS", "UNEQUIP"]);

function gearCandidates(state: GameState, me: PlayerState): Action[] {
  const out: Action[] = [];
  for (const id of [...me.hand, ...me.carried]) if ((itemDefOf(state, id) || state.cards[id].tamed) && !equipCheck(state, me, id).error) out.push({ type: "EQUIP", cardId: id });
  // tira itens que a nova montagem não aproveita (ou que impedem um melhor no mesmo slot)
  const blocked = new Set([...me.hand, ...me.carried].map((id) => itemDefOf(state, id)?.slot).filter(Boolean));
  for (const id of me.equipped) if (likesEmptySlots(state, me) || blocked.has(itemDefOf(state, id)?.slot)) out.push({ type: "UNEQUIP", cardId: id });
  return out;
}

/** Reequipa gulosamente (até `steps` trocas) para ver o potencial de uma montagem. */
function settle(state: GameState, me: string, ctx: Ctx, steps = 4): GameState {
  let cur = state;
  for (let i = 0; i < steps; i++) {
    const b = bestOf(cur, me, gearCandidates(cur, P(cur, me)), ctx, 3, false);
    if (!b) break;
    cur = b.s;
  }
  return cur;
}

function bestOf(state: GameState, me: string, actions: Action[], ctx: Ctx, threshold: number, deep = true): { action: Action; s: GameState; gain: number } | null {
  const base = evaluate(state, me);
  // montagens são comparadas com a montagem atual já reequipada (senão o bot tira e põe o mesmo item)
  let settledBase: number | null = null;
  let best: { action: Action; s: GameState; gain: number } | null = null;
  const seen = new Set<string>();
  for (const a of actions) {
    const k = JSON.stringify(a);
    if (seen.has(k)) continue;
    seen.add(k);
    const s = simulate(state, me, a, ctx);
    if (!s) continue;
    let gain: number;
    if (deep && BUILD.has(a.type) && !s.combat && !state.combat) {
      settledBase ??= evaluate(settle(state, me, ctx), me);
      gain = evaluate(settle(s, me, ctx), me) - settledBase;
    } else gain = evaluate(s, me) - base;
    if (SK.noise) gain += (SK.rand() - 0.5) * 2 * SK.noise;
    if (gain > threshold && (!best || gain > best.gain)) best = { action: a, s, gain };
  }
  return best;
}

// ----------------------------------------------------------------------------
// Busca de combos
// ----------------------------------------------------------------------------

interface Combo {
  actions: Action[];
  cost: number;
  end: GameState;
}

/** Quanto vale "dar" ao jogador `pid` um lugar no meu combate (o ajudante leva tesouros / nível do Elfo). */
function helperPenalty(s: GameState, me: string): number {
  const c = s.combat;
  if (!c?.helperId || c.helperId === me) return 0;
  const h = P(s, c.helperId);
  if (!h) return 0;
  const gain = (c.helperForced ? 0 : (c.helperDeal?.count ?? 0) * 30) + (hasPassive(s, h, "nivelAoAjudar") ? 100 : 0) + 15;
  return (isAlly(s, me, h) ? 0.3 : threat(s, me, h)) * gain + STRENGTH_PENALTY * strengthOf(s, h) * 0.5;
}

/**
 * Procura a sequência mais barata (em cartas, níveis e habilidades gastos) de até `maxDepth` jogadas
 * que atinge o objetivo. As jogadas quase sempre comutam, então a busca percorre combinações (não
 * permutações) e só aceita passos que avançam a métrica — o que deixa a busca pequena.
 */
function findCombo(
  state: GameState,
  me: string,
  cands: Action[],
  goal: (s: GameState) => boolean,
  metric: (s: GameState) => number,
  ctx: Ctx,
  opts: { maxDepth?: number; budget?: number; simCap?: number } = {},
): Combo | null {
  const maxDepth = Math.min(opts.maxDepth ?? 4, SK.depth);
  const budget = opts.budget ?? Infinity;
  const simCap = Math.round((opts.simCap ?? 450) * (0.4 + 0.6 * SK.t));
  if (goal(state)) return null;
  const base = assets(state, me);
  const basePenalty = helperPenalty(state, me);
  const costOf = (s: GameState, path: Action[]) =>
    Math.max(0, base - assets(s, me)) + Math.max(0, helperPenalty(s, me) - basePenalty) + path.filter((a) => a.type === "ABILITY").length * 12;
  const seen = new Set<string>();
  const root: { a: Action; s: GameState; m: number }[] = [];
  const deferred: Action[] = [];
  let sims = 0;
  const m0 = metric(state);
  for (const a of cands) {
    const k = JSON.stringify(a);
    if (seen.has(k)) continue;
    seen.add(k);
    if (sims >= simCap) break;
    const s = simulate(state, me, a, ctx);
    sims++;
    if (!s) {
      // pode depender de outra jogada antes (ex.: bônus no monstro que um Monstro Errante vai trazer)
      if (a.type === "PLAY_MONSTER_BONUS" || a.type === "USE_CARD") deferred.push(a);
      continue;
    }
    const m = metric(s);
    if (m <= m0) continue;
    root.push({ a, s, m });
  }
  // as mais eficientes primeiro: acham uma solução cedo e podam o resto
  const eff = (r: { a: Action; s: GameState; m: number }) => (r.m - m0) / (costOf(r.s, [r.a]) + 5);
  root.sort((x, y) => eff(y) - eff(x));
  let best: Combo | null = null;
  const dfs = (s: GameState, path: Action[], start: number, used: Set<number>, m: number) => {
    const cost = path.length ? costOf(s, path) : 0;
    if (cost > budget || (best && cost >= best.cost)) return;
    if (path.length && goal(s)) {
      best = { actions: [...path], cost, end: s };
      return;
    }
    if (path.length >= maxDepth || sims >= simCap) return;
    for (let i = start; i < root.length; i++) {
      const r = root[i];
      let s2: GameState | null;
      if (path.length === 0) s2 = r.s;
      else {
        if (sims >= simCap) return;
        s2 = simulate(s, me, r.a, ctx);
        sims++;
      }
      if (!s2) continue;
      const m2 = path.length === 0 ? r.m : metric(s2);
      if (m2 <= m) continue;
      dfs(s2, [...path, r.a], i + 1, used, m2);
    }
    if (path.length === 0) return;
    for (let j = 0; j < deferred.length; j++) {
      if (used.has(j) || sims >= simCap) continue;
      const s2 = simulate(s, me, deferred[j], ctx);
      sims++;
      if (!s2) continue;
      const m2 = metric(s2);
      if (m2 <= m) continue;
      used.add(j);
      dfs(s2, [...path, deferred[j]], start, used, m2);
      used.delete(j);
    }
  };
  dfs(state, [], 0, new Set(), m0);
  return best;
}

/** Métrica para o meu lado: margem do combate (acabar bem vale muito). */
function boostMetric(s: GameState): number {
  if (!s.combat) return endedWell(s) ? 1000 : -1000;
  if (s.combat.stage === "badstuff") return -1000;
  return marginOf(s) + (winningNow(s) ? 0.5 : 0);
}
function boostGoal(need = 0) {
  return (s: GameState) => endedWell(s) || (winningNow(s) && marginOf(s) >= need);
}
/** Métrica para atrapalhar: quanto mais o lutador perde, melhor. */
function hinderMetric(s: GameState): number {
  if (!s.combat) return s.turn.lastResult === "won" ? -1000 : s.turn.lastResult === "ended" ? 300 : 1000;
  return -marginOf(s) + (winningNow(s) ? 0 : 0.5);
}
function hinderGoal(need = 1) {
  return (s: GameState) => (!s.combat ? s.turn.lastResult !== "won" : !winningNow(s) && -marginOf(s) >= need - 1);
}

// ----------------------------------------------------------------------------
// Decisões
// ----------------------------------------------------------------------------

function mem(state: GameState): Record<string, number> {
  state.botMemory ??= {};
  const m = state.botMemory;
  // lembranças de combates que já acabaram não servem mais (e o estado fica menor)
  if (Object.keys(m).length > 150) {
    const cur = state.combat ? `${state.combat.id}.` : null;
    for (const k of Object.keys(m)) {
      const [kind, rest] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
      if (["ask", "offer", "threat", "hinder"].includes(kind) && (!cur || !rest.startsWith(cur))) delete m[k];
    }
  }
  return m;
}

function answerFor(state: GameState, me: PlayerState, pr: Prompt, ctx: Ctx): Action {
  const data = pr.data;
  const answer = (a: Record<string, unknown>): Action => ({ type: "ANSWER", promptId: pr.id, answer: a });
  const arr = (x: unknown) => (Array.isArray(x) ? (x as string[]) : []);
  const byValueAsc = (ids: string[]) => [...ids].sort((a, b) => cardValue(state, a, me) - cardValue(state, b, me));
  switch (pr.kind) {
    case "helpRequest": {
      const fighter = P(state, String(data.fighterId));
      const deal = data.deal as { count: number };
      return answer({ accept: shouldAcceptHelpRequest(state, me, fighter, deal.count, !!data.threat, Number(data.threatLevels ?? 1)) });
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
      const gain = cardValue(state, String(data.mine), me) - cardValue(state, String(data.theirs), me);
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
      const itemCost = cardValue(state, worst, me) * 1.5;
      return answer(itemCost < levelValue(me.level) - levelValue(Math.max(1, me.level - levels)) ? { choice: "item", cardId: worst } : { choice: "levels" });
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
      const best = [...(usable.length ? usable : items)].sort((a, b) => cardValue(state, b, me) - cardValue(state, a, me))[0];
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
          const base = cardValue(state, id, me);
          const usable = itemDefOf(state, id) ? !equipCheck(state, me, id).error || me.equipped.includes(id) : true;
          return a + base * (usable ? 1 : 0.6) * (mine && me.equipped.includes(id) ? 1.3 : 1);
        }, 0);
      const ratio = from.bot ? (isAlly(state, me.id, from) ? 0.9 : 1.1) : 1.25;
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
          const g = cardValue(state, b, me) - cardValue(state, a, me);
          if (g > bestGain) {
            bestGain = g;
            best = [a, b];
          }
        }
      return answer(best ? { myItem: best[0], theirItem: best[1] } : {});
    }
    case "possession": {
      const best = [...arr(data.candidates)].sort((a, b) => cardValue(state, b, me) - cardValue(state, a, me))[0];
      return answer({ cardId: best ?? null });
    }
    case "debt":
      return answer({ cardId: byValueAsc(me.hand)[0] ?? null });
    default:
      void ctx;
      return answer({});
  }
}

function decideBadStuff(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const c = state.combat!;
  const flee = c.flee!;
  // Paladino: assume as Coisas Ruins de um aliado (ou do lutador que eu ajudo)
  for (const ab of abilityInfos(state, me)) {
    if (!ab.available || ab.acao !== "assumirCoisasRuins") continue;
    for (const r of flee.results) {
      if (r.success || r.playerId === me.id || flee.substitutes[r.playerId]) continue;
      const victim = P(state, r.playerId);
      if (!isAlly(state, me.id, victim)) continue;
      const md = d(state, r.monsterCardId) as MonsterCard;
      if (badStuffCost(state, victim, md) > 250 && badStuffCost(state, me, md) < 120) {
        const a: Action = { type: "ABILITY", key: ab.key, discard: [], params: { player: victim.id } };
        if (simulate(state, me.id, a, ctx)) return a;
      }
    }
  }
  const victims = new Set<string>();
  for (const r of flee.results) if (!r.success) victims.add(flee.substitutes[r.playerId] ?? r.playerId);
  if (!victims.has(me.id) || flee.confirmed.includes(me.id)) return null;
  const mine = flee.results.map((r, i) => ({ r, i })).filter(({ r }) => r.playerId === me.id && !r.success);
  const cost = mine.reduce((a, { r }) => a + badStuffCost(state, me, d(state, r.monsterCardId) as MonsterCard), 0);
  const severe = cost >= 150;
  if (severe && me.equipped.some((id) => fxIs(state, id, "desejos"))) return { type: "WISH_RING" };
  const rolled = mine.find(({ r }) => r.roll > 0);
  if (rolled) {
    if (me.equipped.some((id) => fxIs(state, id, "rerrolarFuga")) && !c.rerolled.includes(`${me.id}:cajado`))
      return { type: "REROLL", index: rolled.i, source: "cajado" };
    const dado = [...me.hand, ...me.carried].find((id) => fxIs(state, id, "rerrolarFuga"));
    if (dado && cost > cardValue(state, dado, me) * 2) return { type: "REROLL", index: rolled.i, source: "dado", cardId: dado };
  }
  if (severe) {
    const escape = [...me.hand, ...me.carried].find((id) => fxIs(state, id, "teletransporte") || fxIs(state, id, "fugaAutomatica"));
    if (escape && cost > cardValue(state, escape, me) * 1.5) return { type: "USE_CARD", cardId: escape, targetId: me.id };
  }
  return { type: "ACCEPT_BAD_STUFF" };
}

/** Escolhe a quem pedir ajuda (ou usar o Tridente / Canto da Sereia). */
function helpPlan(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const c = state.combat!;
  if (c.helperId || combatHas(state, c, "semPedirAjuda") || c.desafio) return null;
  const calc = computeCombat(state)!;
  const m = mem(state);
  const { levels, treasures } = monsterStake(state);
  const benefit = levelGain(me.level, levels) * 0.9 + treasures * 15 + expectedFleeLoss(state, me) * 0.6;
  const flips = (o: PlayerState) => calc.playerTotal + playerPower(state, o) > calc.monsterTotal;
  // Tridente (Tritão): "me ajude ou perca níveis" — para o mais forte que vira o combate
  for (const ab of abilityInfos(state, me)) {
    if (!ab.available || ab.acao !== "ameacarAjuda") continue;
    const target = state.players
      .filter((o) => o.id !== me.id && flips(o) && !m[`ask:${c.id}.${c.rev ?? 0}:${me.id}:${o.id}`])
      .sort((a, b) => playerPower(state, b) - playerPower(state, a))[0];
    if (target) {
      m[`ask:${c.id}.${c.rev ?? 0}:${me.id}:${target.id}`] = 1;
      return { type: "ABILITY", key: ab.key, discard: [], params: { player: target.id, dealCount: 1, dealMode: "fighter" } };
    }
  }
  // quanto custa fortalecer cada candidato (tesouros que ele leva + quão forte ele já está), com peso baixo
  const countFor = (o: PlayerState) => (isAlly(state, me.id, o) ? 1 : Math.max(1, Math.ceil(treasures / 2)));
  const cost = (o: PlayerState) => {
    const w = isAlly(state, me.id, o) ? 0.3 : weight(state, me.id, o);
    return w * (countFor(o) * 30 + (hasPassive(state, o, "nivelAoAjudar") ? 100 : 0)) + STRENGTH_PENALTY * strengthOf(state, o);
  };
  const candidates = state.players
    .filter((o) => o.id !== me.id && !m[`ask:${c.id}.${c.rev ?? 0}:${me.id}:${o.id}`])
    .filter((o) => flips(o))
    .filter((o) => cost(o) < benefit)
    .filter((o) => o.level + 1 < MAX() || isAlly(state, me.id, o))
    .sort((a, b) => Number(isAlly(state, me.id, b)) - Number(isAlly(state, me.id, a)) || cost(a) - cost(b));
  const pick = candidates.find((o) => isAlly(state, me.id, o)) ?? candidates.find((o) => !o.bot && weight(state, me.id, o) <= 1.2) ?? candidates[0];
  if (!pick) return null;
  m[`ask:${c.id}.${c.rev ?? 0}:${me.id}:${pick.id}`] = 1;
  void ctx;
  return { type: "ASK_HELP", targetId: pick.id, count: countFor(pick), mode: isAlly(state, me.id, pick) ? "random" : "fighter" };
}

function decideFighter(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const c = state.combat!;
  if (c.stage === "resolving") return null;
  const calc = computeCombat(state)!;
  if (calc.winning) {
    // Antes de atacar: Mapa do Tesouro e desejo do Glabrezu se continuar vencendo com folga
    const extras: Action[] = [{ type: "ACCEPT_WISH" }];
    for (const id of [...me.hand, ...me.carried]) if (fxIs(state, id, "mapa")) extras.push({ type: "USE_CARD", cardId: id });
    for (const a of extras) {
      const s = simulate(state, me.id, a, ctx);
      if (s && winningNow(s) && marginOf(s) >= 3) return a;
    }
    return { type: "RESOLVE" };
  }
  if (state.prompts.some((pr) => (pr.kind === "helpRequest" && pr.data.fighterId === me.id) || (pr.kind === "helpOffer" && pr.playerId === me.id))) return null;
  // Perdendo: quanto vale virar? (o que ganho vencendo + as Coisas Ruins que evito)
  const fleeLoss = expectedFleeLoss(state, me);
  const winValue = stakeFor(state, me.id) + fleeLoss;
  // monstro que volta ao topo se eu fugir: fugir só adia — vale gastar o que for preciso
  const returning = c.monsters.filter((m) => !m.defeated && fxIs(state, m.cardId, "voltaAoFugir")).map((m) => m.cardId);
  const combo = findCombo(state, me.id, boostCandidates(state, me), boostGoal(0), boostMetric, ctx, { budget: returning.length ? Infinity : winValue * 1.05 });
  // combo barato: joga já; caro: tenta antes um ajudante
  if (combo && combo.cost <= 50) return combo.actions[0];
  const ask = helpPlan(state, me, ctx);
  if (ask) return ask;
  if (combo) return combo.actions[0];
  // Fuga difícil e Coisas Ruins pesadas? Tenta escapar de outro jeito
  if (fleeLoss >= 90) {
    const escapes: { a: Action; cost: number }[] = [];
    for (const ab of abilityInfos(state, me)) {
      if (!ab.available || !["encerrarCombate", "mandarMonstroEmbora"].includes(ab.acao)) continue;
      const disc = ab.wholeHand ? [] : cheapest(state, me, ab.discard);
      if (!disc) continue;
      const params = ab.fields.some((f) => f.kind === "monster") ? { monster: c.monsters.find((m) => !m.defeated)?.cardId } : {};
      escapes.push({ a: { type: "ABILITY", key: ab.key, discard: disc, params }, cost: ab.wholeHand ? me.hand.reduce((x, id) => x + cardValue(state, id, me), 0) : disc.reduce((x, id) => x + cardValue(state, id, me), 0) });
    }
    for (const id of [...me.hand, ...me.carried]) {
      if (fxIs(state, id, "teletransporte")) escapes.push({ a: { type: "USE_CARD", cardId: id }, cost: cardValue(state, id, me) });
      if (fxIs(state, id, "fugaAutomatica")) escapes.push({ a: { type: "USE_CARD", cardId: id, targetId: me.id }, cost: cardValue(state, id, me) });
      if (fxIs(state, id, "bonusFugir") && !c.fleeMods.some((m) => m.label.includes(d(state, id).name))) escapes.push({ a: { type: "USE_CARD", cardId: id, targetId: me.id }, cost: cardValue(state, id, me) + 20 });
    }
    escapes.sort((a, b) => a.cost - b.cost);
    for (const e of escapes) {
      if (e.cost > fleeLoss) continue;
      const s = simulate(state, me.id, e.a, ctx);
      if (s && (endedWell(s) || !s.combat || expectedFleeLoss(s, P(s, me.id)) < fleeLoss - 20)) return e.a;
    }
  }
  const m = mem(state);
  for (const id of returning) m[`fled:${id}`] = (m[`fled:${id}`] ?? 0) + 1;
  return { type: "FLEE" };
}

/** Valor, para mim, de impedir que o lado dos jogadores vença o combate atual. */
function hinderValue(state: GameState, me: string): number {
  const c = state.combat!;
  let v = 0;
  for (const pid of playerSide(state, c)) {
    if (pid === me) return 0;
    const p = P(state, pid);
    const st = stakeFor(state, pid);
    if (st >= 100_000) return 100_000;
    v += (isAlly(state, me, p) ? -0.5 : threat(state, me, p)) * st;
  }
  return v;
}

function decideOtherCombat(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const c = state.combat!;
  const calc = computeCombat(state)!;
  const fighter = P(state, c.fighterId);
  const onSide = calc.side.includes(me.id);
  const friendly = onSide || (isAlly(state, me.id, fighter) && hinderValue(state, me.id) <= 0);
  if (friendly) {
    if (!calc.winning) {
      // ajudante: vale gastar até o que vou ganhar; aliado de fora: só o que for barato
      const budget = onSide ? stakeFor(state, me.id) + expectedFleeLoss(state, me) : 45;
      const combo = findCombo(state, me.id, boostCandidates(state, me), boostGoal(0), boostMetric, ctx, { maxDepth: 3, budget, simCap: 250 });
      if (combo) return combo.actions[0];
      // Oferece ajuda a bots aliados
      const m = mem(state);
      const key = `offer:${c.id}.${c.rev ?? 0}:${me.id}`;
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
  const threatKey = `threat:${c.id}.${c.rev ?? 0}:${me.id}`;
  const value = hinderValue(state, me.id);
  if (calc.winning && !m[threatKey] && !c.used.includes(`${me.id}:threat`) && !c.desafio && value < 100_000) {
    const free = freeTreasures(state, c);
    m[threatKey] = 1;
    // quem está perto de ganhar não é chantageado: é derrubado
    if (threat(state, me.id, fighter) < 1.5 && free > 0 && canFlip(state, me.id, ctx)) {
      const stake = monsterStake(state);
      return { type: "THREATEN", count: Math.min(free, Math.max(1, Math.ceil(stake.treasures / 2))) };
    }
  }
  // Só atrapalha quando ele já decidiu atacar (janela de ataque)
  if (c.stage !== "resolving") return null;
  // bots fáceis nem sempre se dão ao trabalho de atrapalhar (decidem uma vez por mudança no combate)
  const hk = `hinder:${c.id}.${c.rev ?? 0}:${me.id}`;
  m[hk] ??= value >= 100_000 || SK.rand() <= SK.hinder ? 1 : 2;
  if (calc.winning && value > 20 && m[hk] === 1) {
    // Atrapalha com folga quando o lutador ainda tem mão para reagir; senão, o mínimo que basta
    const deep = 1 + Math.min(4, Math.floor(fighter.hand.length / 2));
    const budget = value >= 100_000 ? Infinity : value * 0.85;
    const cands = hinderCandidates(state, me);
    const strong = deep > 1 ? findCombo(state, me.id, cands, hinderGoal(deep), hinderMetric, ctx, { budget, simCap: 300 }) : null;
    const combo = strong ?? findCombo(state, me.id, cands, hinderGoal(1), hinderMetric, ctx, { budget, simCap: 300 });
    if (combo) return combo.actions[0];
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
      const current = me.equipped.filter((e) => slotOf(state, e) === df.slot).map((e) => cardValue(state, e, me));
      if (current.length && Math.max(...current) >= cardValue(state, it, me)) continue;
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

/** Vende o que não usa (itens piores que os equipados, itens que não pode usar) para subir de nível. */
function sellIdea(state: GameState, me: PlayerState): Action | null {
  if (me.level >= MAX() - 1 || hasCurseFx(me, "naoPodeNegociar")) return null;
  const junk = [...me.hand, ...me.carried].filter((id) => {
    const df = itemDefOf(state, id);
    if (!df) return false;
    if (!equipCheck(state, me, id).error) return false;
    const sameSlot = me.equipped.filter((e) => slotOf(state, e) === df.slot);
    return sameSlot.some((e) => cardValue(state, e, me) >= cardValue(state, id, me)) || !!df.requires || !!df.forbids;
  });
  junk.sort((a, b) => itemDefOf(state, b)!.price - itemDefOf(state, a)!.price);
  const mult = [...me.carried, ...me.equipped].reduce((a, id) => Math.max(a, fxVal(state, id, "vendaMultiplicador") || 1), 1);
  let gold = 0;
  const pick: string[] = [];
  for (const id of junk) {
    pick.push(id);
    gold += itemDefOf(state, id)!.price * mult;
    if (gold >= RULES.ouroPorNivel) return { type: "SELL", cardIds: pick };
  }
  // quase lá: completa com poções e diversos que valem menos que o nível
  const extras = me.hand
    .filter((id) => !pick.includes(id) && (d(state, id).kind === "potion" || d(state, id).kind === "misc") && "price" in d(state, id))
    .sort((a, b) => cardValue(state, a, me) - cardValue(state, b, me));
  let spent = pick.reduce((a, id) => a + cardValue(state, id, me), 0);
  for (const id of extras) {
    const df = d(state, id) as { price: number };
    pick.push(id);
    gold += df.price * mult;
    spent += cardValue(state, id, me);
    if (spent > levelGain(me.level, 1) * 0.8) return null;
    if (gold >= RULES.ouroPorNivel) return { type: "SELL", cardIds: pick };
  }
  return null;
}

/** Procurar encrenca: luta com um monstro da mão quando um combo garante a vitória com folga. */
function troubleIdea(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  if (SK.t < 0.3) return null;
  const monsters = me.hand.filter((id) => d(state, id).kind === "monster");
  if (!monsters.length) return null;
  const hostile = hostileHinder(state, me.id);
  // depois da porta: procurar encrenca (grátis); depois de um combate: Monstro Errante a seu favor (gasta a carta)
  const wandering = me.hand.find((id) => d(state, id).kind === "wandering");
  const actionFor = (id: string): Action | null =>
    state.turnPhase === "AFTER_DOOR"
      ? { type: "LOOK_FOR_TROUBLE", cardId: id }
      : wandering
        ? { type: "PLAY_WANDERING", cardId: wandering, monsterCardId: id, targetId: me.id }
        : null;
  const extraCost = state.turnPhase === "AFTER_DOOR" ? 0 : wandering ? cardValue(state, wandering, me) : 0;
  let best: { action: Action; value: number } | null = null;
  for (const id of monsters) {
    const action = actionFor(id);
    if (!action) continue;
    const s1 = simulate(state, me.id, action, ctx);
    if (!s1?.combat) continue;
    const me1 = P(s1, me.id);
    const stake = stakeFor(s1, me.id);
    const fleeLoss = expectedFleeLoss(s1, me1);
    // folga desejada contra o que os adversários podem jogar
    const need = Math.min(6, Math.round(hostile * 0.6));
    let end: GameState = s1;
    let cost = 0;
    if (!(winningNow(s1) && marginOf(s1) >= need)) {
      const combo =
        findCombo(s1, me.id, boostCandidates(s1, me1), boostGoal(need), boostMetric, ctx, { maxDepth: 3, budget: stake * 0.6, simCap: 160 }) ??
        findCombo(s1, me.id, boostCandidates(s1, me1), boostGoal(0), boostMetric, ctx, { maxDepth: 3, budget: stake * 0.5, simCap: 120 });
      if (!combo) continue;
      end = combo.end;
      cost = combo.cost;
    }
    const margin = end.combat ? marginOf(end) : 99;
    const reserve = reserveBoost(end, P(end, me.id));
    const pHindered = hostile <= 0 ? 0.03 : Math.max(0.05, Math.min(0.9, (hostile - margin - reserve) / (hostile + 2)));
    const value = (stake >= 100_000 ? 3000 : stake) - cost - extraCost - pHindered * (fleeLoss + stake * 0.3);
    if (value > 45 && (!best || value > best.value)) best = { action, value };
  }
  return best?.action ?? null;
}

/** Monstro Errante de tocaia: um monstro forte da mão na porta de quem está ameaçando vencer. */
function ambushIdea(state: GameState, me: PlayerState): Action | null {
  const wandering = me.hand.find((id) => d(state, id).kind === "wandering");
  if (!wandering || state.combat || state.phase !== "PLAYING" || SK.t < 0.4) return null;
  const monster = me.hand
    .filter((id) => d(state, id).kind === "monster")
    .sort((a, b) => (d(state, b) as MonsterCard).level - (d(state, a) as MonsterCard).level)[0];
  if (!monster) return null;
  const level = (d(state, monster) as MonsterCard).level;
  const target = state.players
    .filter((o) => o.id !== me.id && !isAlly(state, me.id, o) && !o.hibernating)
    .filter((o) => level >= playerPower(state, o) + 3 && threat(state, me.id, o) >= 1.2)
    .sort((a, b) => threat(state, me.id, b) - threat(state, me.id, a))[0];
  return target ? { type: "PLAY_WANDERING", cardId: wandering, monsterCardId: monster, targetId: target.id } : null;
}

/** Fim do turno com mão acima do limite: usa o que iria para a Caridade em vez de dar para alguém. */
function overflowIdea(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const excess = me.hand.length - handLimit(state, me);
  if (excess <= 0) return null;
  // itens vão para a mesa (não contam no limite da mão)
  const item = me.hand
    .filter((id) => itemDefOf(state, id) || d(state, id).kind === "rune" || (d(state, id).kind === "misc" && "price" in d(state, id)))
    .sort((a, b) => cardValue(state, b, me) - cardValue(state, a, me))[0];
  if (item) {
    const a: Action = { type: "PLACE", cardId: item };
    if (simulate(state, me.id, a, ctx)) return a;
  }
  // maldições e cartas soltas: qualquer uso que não piore muito vale mais que doar
  const lowest = Math.min(...state.players.map((x) => x.level));
  const losing = me.level === lowest ? 1 : 0.6; // se eu for o mais baixo, a carta só é descartada
  const cheapestLoss = cheapest(state, me, excess)?.reduce((a, id) => a + cardValue(state, id, me), 0) ?? 0;
  const fromHand = manageCandidates(state, me, true).filter((a) => {
    const id = "cardId" in a ? a.cardId : a.type === "SOCKET_RUNE" ? a.runeId : null;
    return !!id && me.hand.includes(id);
  });
  const use = bestOf(state, me.id, fromHand, ctx, -cheapestLoss * losing);
  return use ? use.action : null;
}

/**
 * Um monstro que "não desiste" voltou ao topo das Portas (todos viram): antes de chutar a porta,
 * o bot troca qualquer carta por força (poções, itens) para não ficar preso fugindo dele para sempre.
 */
function prepareFor(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const top = state.decks.door[0];
  if (!top || !(mem(state)[`fled:${top}`] >= 1)) return null;
  const strength = (s: GameState) => playerPower(s, P(s, me.id)) + reserveBoost(s, P(s, me.id));
  const base = strength(state);
  let best: { a: Action; gain: number } | null = null;
  for (const a of manageCandidates(state, me, true)) {
    const s2 = simulate(state, me.id, a, ctx);
    if (!s2) continue;
    const gain = strength(s2) - base;
    if (gain > 0 && (!best || gain > best.gain)) best = { a, gain };
  }
  return best ? noteGear(state, me.id, best.a) : null;
}

function decideOwnTurn(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  // melhora a mesa; maldições só quando doem de verdade (as boas ficam para a hora do combate)
  const cands = manageCandidates(state, me, true);
  const improve =
    bestOf(state, me.id, cands.filter((a) => a.type !== "PLAY_CURSE"), ctx, 6) ?? bestOf(state, me.id, cands.filter((a) => a.type === "PLAY_CURSE"), ctx, 35);
  if (improve) return noteGear(state, me.id, improve.action);
  const sell = sellIdea(state, me);
  if (sell) return sell;
  if (state.turnPhase === "KICK") {
    if (state.prompts.some((p) => p.blocking)) return null;
    const prep = prepareFor(state, me, ctx);
    if (prep) return prep;
    return { type: "KICK_DOOR" };
  }
  if (state.turnPhase === "AFTER_DOOR") {
    const trouble = troubleIdea(state, me, ctx);
    if (trouble) return trouble;
    return { type: "LOOT_ROOM" };
  }
  if (state.turnPhase === "END") {
    if (state.reward || state.prompts.some((p) => p.blocking) || state.turn.ending) return null;
    // Galope (Centauro): mais uma porta enquanto estiver forte
    for (const ab of abilityInfos(state, me)) {
      if (!ab.available || ab.acao !== "abrirOutraPorta") continue;
      const disc = cheapest(state, me, ab.discard);
      if (!disc || playerPower(state, me) < me.level + 4 || disc.some((id) => cardValue(state, id, me) > 40)) continue;
      return { type: "ABILITY", key: ab.key, discard: disc, params: {} };
    }
    const fight = troubleIdea(state, me, ctx);
    if (fight) return fight;
    const over = overflowIdea(state, me, ctx);
    if (over) return over;
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
  SK = me.skill && me.skill < 30 ? skillProfile(me.skill, () => ctx.rng.int(10_000) / 10_000) : FULL_SKILL;
  try {
    return decideWith(state, me, ctx);
  } finally {
    SK = FULL_SKILL;
  }
}

/** Jogada "sem pensar" (bots de dificuldade baixa às vezes fazem só o óbvio). */
function lazyAction(state: GameState, me: PlayerState): Action | null | undefined {
  const c = state.combat;
  if (c) {
    if (c.stage === "badstuff") return undefined;
    if (c.fighterId === me.id) return c.stage === "fight" ? (computeCombat(state)?.winning ? { type: "RESOLVE" } : { type: "FLEE" }) : null;
    if (c.stage === "resolving" && !playerSide(state, c).includes(me.id) && !c.passed.includes(me.id)) return { type: "PASS" };
    return undefined;
  }
  if (!isCurrent(state, me.id) || state.reward || state.prompts.some((p) => p.blocking) || state.turn.ending) return undefined;
  if (state.turnPhase === "KICK") return { type: "KICK_DOOR" };
  if (state.turnPhase === "AFTER_DOOR") return { type: "LOOT_ROOM" };
  if (state.turnPhase === "END") return { type: "END_TURN" };
  return undefined;
}

function decideWith(state: GameState, me: PlayerState, ctx: Ctx): Action | null {
  const botId = me.id;
  const pr = state.prompts.find((p) => p.playerId === botId);
  if (pr) return answerFor(state, me, pr, ctx);
  if (me.owlPeek) {
    const top = state.decks.door[0];
    const bad = top ? ["monster", "curse"].includes(d(state, top).kind) && (d(state, top).kind === "curse" || (d(state, top) as MonsterCard).level > playerPower(state, me)) : false;
    return { type: "OWL_DECIDE", bottom: bad };
  }
  const notice = state.notices.find((n) => n.playerId === botId);
  if (notice) return { type: "DISMISS_NOTICE", id: notice.id };
  if (state.phase === "PLAYING" && SK.mistake && SK.rand() < SK.mistake) {
    const lazy = lazyAction(state, me);
    if (lazy !== undefined) return lazy;
  }
  if (state.phase === "SETUP") {
    const improve = bestOf(state, botId, manageCandidates(state, me, true), ctx, 4);
    if (improve) return noteGear(state, botId, improve.action);
    return me.ready ? null : { type: "READY" };
  }
  const c = state.combat;
  if (c) {
    if (c.stage === "badstuff") return decideBadStuff(state, me, ctx);
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
  const ambush = ambushIdea(state, me);
  if (ambush) return ambush;
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

