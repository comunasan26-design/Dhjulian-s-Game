// Visão do estado filtrada para um jogador (nunca vaza mãos alheias nem a ordem dos baralhos).
import { type AbilityInfo, abilityInfos } from "./abilities";
import { badStuffVictims, curseName, freeTreasures } from "./core";
import type { ActiveCurse, CardInst, CombatState, GameState, LogEntry, Prompt } from "./state";
import {
  type CalcLine,
  type CombatCalc,
  computeCombat,
  fleeInfo,
  handLimit,
  playerPower,
  playerSide,
  runeSockets,
} from "./stats";
import { fxOf } from "../catalog";
import { classesOf, identityCards, maxClasses, player, raceOf } from "./util";

export interface PlayerView {
  id: string;
  name: string;
  seat: number;
  level: number;
  handCount: number;
  hand: string[] | null;
  equipped: string[];
  carried: string[];
  race: string | null;
  classes: string[];
  raceId: string | null;
  classIds: string[];
  curses: (ActiveCurse & { name: string })[];
  pendingCombatCurses: string[];
  streak: number;
  needsNewHand: boolean;
  hibernating: boolean;
  ready: boolean;
  bot: boolean;
  /** Dificuldade do bot (1 a 30). */
  skill?: number;
  /** Tipos de efeito passivo que o jogador tem (vindos da raça/classe no JSON). */
  passives: string[];
  maxClasses: number;
  power: number;
  handLimit: number;
  ambushCount: number;
  online: boolean;
  runeSockets: Record<string, number>;
}

export interface FleePreview {
  playerId: string;
  monsterCardId: string;
  bonus: number;
  lines: CalcLine[];
  auto: string | null;
  impossible: string | null;
}

export interface GameView {
  me: string;
  phase: GameState["phase"];
  hostId: string;
  players: PlayerView[];
  order: string[];
  currentPlayerId: string;
  round: number;
  turnSerial: number;
  turnPhase: GameState["turnPhase"];
  turn: GameState["turn"];
  decks: { door: number; treasure: number; doorDiscard: string[]; treasureDiscard: string[] };
  cards: Record<string, Pick<CardInst, "defId" | "reforged" | "runes" | "charges" | "tamed" | "artificeSecond">>;
  combat:
    | (CombatState & {
        calc: CombatCalc | null;
        flee: CombatState["flee"];
        victims: string[];
        fleePreview: FleePreview[];
        /** Tesouros do lutador ainda não prometidos (máximo de uma ameaça). */
        freeTreasures: number;
      })
    | null;
  reward: { cards: string[] | null; count: number; fighterId: string; helperId: string | null; faceUp: boolean } | null;
  prompts: (Omit<Prompt, "data"> & { data: Record<string, unknown> | null })[];
  notices: { id: string; text: string; cards: string[]; kind?: string }[];
  log: LogEntry[];
  winnerId: string | null;
  initialRolls: Record<string, number>;
  lastFaceUp: GameState["lastFaceUp"];
  lastItemDiscard: GameState["lastItemDiscard"];
  abilities: AbilityInfo[];
  lastActionAt: number;
  now: number;
}

export function viewFor(state: GameState, me: string, now: number, online: Set<string> = new Set()): GameView {
  const visible = new Set<string>();
  const show = (ids: (string | null | undefined)[]) => {
    for (const id of ids) {
      if (!id) continue;
      visible.add(id);
      for (const r of state.cards[id]?.runes ?? []) visible.add(r);
    }
  };

  const players: PlayerView[] = state.players.map((p) => {
    const mine = p.id === me;
    show(p.equipped);
    show(p.carried);
    show([p.race, ...p.classes]);
    show(p.curses.map((c) => c.cardId));
    show(p.pendingCombatCurses.map((c) => c.cardId));
    if (mine) show(p.hand);
    const sockets: Record<string, number> = {};
    for (const id of p.equipped) sockets[id] = runeSockets(state, p, id);
    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      level: p.level,
      handCount: p.hand.length,
      hand: mine ? [...p.hand] : null,
      equipped: [...p.equipped],
      carried: [...p.carried],
      race: p.race,
      classes: [...p.classes],
      raceId: raceOf(state, p),
      classIds: classesOf(state, p),
      curses: p.curses.map((c) => ({ ...c, name: curseName(state, c) })),
      pendingCombatCurses: p.pendingCombatCurses.map((c) => c.cardId),
      streak: p.streak,
      needsNewHand: p.needsNewHand,
      hibernating: p.hibernating,
      ready: p.ready,
      bot: !!p.bot,
      ...(p.bot ? { skill: p.skill ?? 30 } : {}),
      passives: [...new Set(identityCards(state, p).flatMap((id) => fxOf(state.cards[id].defId).map((f) => f.tipo)))],
      maxClasses: maxClasses(state, p),
      power: playerPower(state, p),
      handLimit: handLimit(state, p),
      ambushCount: p.ambush.length,
      online: !!p.bot || online.has(p.id),
      runeSockets: sockets,
    };
  });

  const doorDiscard = state.decks.doorDiscard.slice(-12);
  const treasureDiscard = [...state.decks.treasureDiscard];
  show(doorDiscard);
  show(treasureDiscard);
  show([state.turn.revealed]);

  let combat: GameView["combat"] = null;
  if (state.combat) {
    const c = state.combat;
    show(c.monsters.map((m) => m.cardId));
    show(c.allies.map((a) => a.cardId));
    show(c.adaptations.map((a) => a.cardId));
    const fleePreview: FleePreview[] = [];
    for (const pid of playerSide(state, c)) {
      for (const m of c.monsters.filter((x) => !x.defeated)) {
        const info = fleeInfo(state, player(state, pid), m);
        fleePreview.push({ playerId: pid, monsterCardId: m.cardId, ...info });
      }
    }
    combat = {
      ...structuredClone(c),
      calc: computeCombat(state),
      victims: badStuffVictims(state),
      fleePreview,
      freeTreasures: freeTreasures(state, c),
    };
  }

  let reward: GameView["reward"] = null;
  if (state.reward) {
    const r = state.reward;
    const seeCards = r.faceUp || r.fighterId === me;
    if (seeCards) show(r.cards);
    reward = { cards: seeCards ? [...r.cards] : null, count: r.cards.length, fighterId: r.fighterId, helperId: r.helperId, faceUp: r.faceUp };
  }

  const prompts = state.prompts.map((pr) => {
    const mine = pr.playerId === me;
    const publicKinds = ["loot", "helpRequest", "helpOffer", "trade", "distribute"];
    const data = mine || publicKinds.includes(pr.kind) ? structuredClone(pr.data) : null;
    if (data) {
      for (const v of Object.values(data)) {
        if (typeof v === "string") show([v]);
        if (Array.isArray(v)) show(v.filter((x) => typeof x === "string") as string[]);
      }
    }
    return { id: pr.id, kind: pr.kind, playerId: pr.playerId, deadline: pr.deadline, blocking: pr.blocking, data };
  });

  const notices = state.notices.filter((n) => n.playerId === me).map((n) => ({ id: n.id, text: n.text, cards: n.cards, kind: n.kind }));
  for (const n of notices) show(n.cards);
  if (state.lastFaceUp) show(state.lastFaceUp.cards);

  const cards: GameView["cards"] = {};
  for (const id of visible) {
    const c = state.cards[id];
    if (!c) continue;
    cards[id] = { defId: c.defId, reforged: c.reforged, runes: c.runes, charges: c.charges, tamed: c.tamed, artificeSecond: c.artificeSecond };
  }

  const meP = state.players.find((p) => p.id === me);
  return {
    me,
    phase: state.phase,
    hostId: state.hostId,
    players,
    order: state.order,
    currentPlayerId: state.order[state.currentIdx],
    round: state.round,
    turnSerial: state.turnSerial,
    turnPhase: state.turnPhase,
    turn: state.turn,
    decks: { door: state.decks.door.length, treasure: state.decks.treasure.length, doorDiscard, treasureDiscard },
    cards,
    combat,
    reward,
    prompts,
    notices,
    log: state.log.slice(-120),
    winnerId: state.winnerId,
    initialRolls: state.initialRolls,
    lastFaceUp: state.lastFaceUp,
    lastItemDiscard: state.lastItemDiscard,
    abilities: meP ? abilityInfos(state, meP) : [],
    lastActionAt: state.lastActionAt,
    now,
  };
}
