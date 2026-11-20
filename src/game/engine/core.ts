// Núcleo das regras: turnos, combate, fuga, Coisas Ruins, morte, recompensas e maldições.
import { ALL_CARDS, CARD_DEFS, def, findFx, type CurseCard, type MonsterCard, type Slot } from "../catalog";
import {
  cardFxAll,
  combatFx,
  combatHas,
  curseFx,
  equippedFx,
  equippedFxAll,
  flag,
  type Fx,
  hasCurseFx,
  matchesListed,
  monsterFx,
  num,
  runeFx,
  strs,
} from "./fx";
import {
  type ActiveCurse,
  type CombatMonster,
  type CombatState,
  type Ctx,
  type GameState,
  type HelpDeal,
  type PlayerState,
  type Prompt,
  type PromptKind,
  START_HAND,
  TIMERS,
  fail,
} from "./state";
import {
  activeMonsters,
  computeCombat,
  effectiveHelper,
  equipCheck,
  fleeInfo,
  handLimit,
  handsUsed,
  isLegendaryItem,
  monsterDef,
  playerSide,
  slotOf,
  tier11,
} from "./stats";
import {
  classesOf,
  currentPlayer,
  defOf,
  discardCard,
  discardFromPlayer,
  drawCard,
  drawTo,
  gainLevels,
  giveItem,
  hasClass,
  hasRace,
  isCurrent,
  itemDef,
  leftOf,
  log,
  loseLevels,
  nameOf,
  newCard,
  otherPlayers,
  pickRandom,
  player,
  removeFromPlayer,
  rollD6,
  shuffle,
  tryPlayer,
  uid,
} from "./util";

// ============================================================================
// Criação da partida
// ============================================================================

export function createGame(
  players: { id: string; name: string; bot?: boolean }[],
  hostId: string,
  ctx: Ctx,
): GameState {
  const state: GameState = {
    phase: "SETUP",
    players: [],
    order: [],
    currentIdx: 0,
    round: 1,
    turnSerial: 0,
    turnPhase: "KICK",
    turn: freshTurn(),
    decks: { door: [], treasure: [], doorDiscard: [], treasureDiscard: [] },
    cards: {},
    nextCardId: 0,
    combat: null,
    combatCounter: 0,
    reward: null,
    prompts: [],
    notices: [],
    log: [],
    logCounter: 0,
    idCounter: 0,
    winnerId: null,
    initialRolls: {},
    lastFaceUp: null,
    lastItemDiscard: null,
    hostId,
    lastActionAt: ctx.now,
  };
  for (const c of ALL_CARDS) {
    for (let i = 0; i < (c.copies ?? 1); i++) {
      const id = newCard(state, c.id);
      (c.deck === "door" ? state.decks.door : state.decks.treasure).push(id);
    }
  }
  shuffle(state.decks.door, ctx);
  shuffle(state.decks.treasure, ctx);

  players.forEach((pl, seat) => {
    state.players.push({
      id: pl.id,
      name: pl.name,
      seat,
      level: 1,
      hand: [],
      equipped: [],
      carried: [],
      race: null,
      classes: [],
      curses: [],
      pendingCombatCurses: [],
      usage: {},
      streak: 0,
      needsNewHand: false,
      hibernating: false,
      artificeSlots: [],
      lostRound: 0,
      lostRoundAmount: 0,
      lostRoundCorpoSeco: 0,
      curseCastRound: 0,
      lastTurnStart: 0,
      ambush: [],
      ready: false,
      owlPeek: null,
      ...(pl.bot ? { bot: true } : {}),
    });
  });

  // Raça e classe aleatórias (tiradas do baralho de Portas)
  for (const p of state.players) {
    const races = state.decks.door.filter((id) => defOf(state, id).kind === "race");
    const r = pickRandom(races, ctx);
    state.decks.door.splice(state.decks.door.indexOf(r), 1);
    p.race = r;
    const classes = state.decks.door.filter((id) => defOf(state, id).kind === "class");
    const c = pickRandom(classes, ctx);
    state.decks.door.splice(state.decks.door.indexOf(c), 1);
    p.classes = [c];
    drawTo(state, p, "door", START_HAND, ctx);
    drawTo(state, p, "treasure", START_HAND, ctx);
  }

  // Ordem: maior d6 começa (empates rolam de novo), depois sentido horário
  let contenders = state.players.map((p) => p.id);
  let first = contenders[0];
  for (let guard = 0; guard < 20; guard++) {
    const rolls: Record<string, number> = {};
    for (const id of contenders) {
      const v = ctx.rng.int(6) + 1;
      rolls[id] = v;
      if (guard === 0) state.initialRolls[id] = v;
    }
    const best = Math.max(...Object.values(rolls));
    contenders = contenders.filter((id) => rolls[id] === best);
    if (contenders.length === 1) {
      first = contenders[0];
      break;
    }
    first = contenders[0];
  }
  const firstSeat = player(state, first).seat;
  state.order = [...state.players]
    .sort((a, b) => {
      const n = state.players.length;
      return ((a.seat - firstSeat + n) % n) - ((b.seat - firstSeat + n) % n);
    })
    .map((p) => p.id);
  log(
    state,
    ctx,
    `🎲 Rolagens iniciais: ${state.players.map((p) => `${p.name} ${state.initialRolls[p.id]}`).join(", ")}. ${player(state, first).name} começa.`,
    "system",
  );
  log(state, ctx, "Preparação: joguem raça, classe e itens da mão e cliquem em “Pronto”.", "system");
  return state;
}

export function freshTurn(): GameState["turn"] {
  return {
    fought: false,
    lastResult: null,
    revealed: null,
    owlStartDone: false,
    owlEndDone: false,
    ending: false,
    wonCombat: false,
    lastCombatLost: {},
  };
}

export function startPlaying(state: GameState, ctx: Ctx) {
  state.phase = "PLAYING";
  log(state, ctx, "A partida começou!", "system");
  beginTurn(state, ctx, state.order[0], 0);
}

// ============================================================================
// Turnos
// ============================================================================

export function beginTurn(state: GameState, ctx: Ctx, pid: string, depth: number) {
  state.currentIdx = state.order.indexOf(pid);
  state.turnSerial += 1;
  state.turn = freshTurn();
  state.turnPhase = "KICK";
  const p = player(state, pid);
  p.lastTurnStart = state.turnSerial;
  if (p.hibernating) {
    p.hibernating = false;
    log(state, ctx, `${p.name} saiu do casco.`);
  }
  if (p.needsNewHand) {
    p.needsNewHand = false;
    drawTo(state, p, "door", START_HAND, ctx);
    drawTo(state, p, "treasure", START_HAND, ctx);
    log(state, ctx, `${p.name} recebeu 4 Portas e 4 Tesouros após a morte.`);
  }
  log(state, ctx, `— Turno de ${p.name} (rodada ${state.round}) —`, "system", p.id);

  const sono = p.curses.find((c) => findFx(c.defId, "pulaTurno"));
  if (sono && depth < state.players.length * 2) {
    sono.remaining = (sono.remaining ?? 1) - 1;
    if ((sono.remaining ?? 0) <= 0) removeCurse(state, p, sono.id);
    log(state, ctx, `💤 ${p.name} está sob Sono Encantado e pula o turno.`, "curse", p.id);
    advanceTurn(state, ctx, depth + 1);
    return;
  }
  if (hasCurseFx(p, "descartaNoInicioDoTurno") && p.hand.length > 0) {
    createPrompt(state, ctx, "debt", p.id, {}, { blocking: true });
  }
}

/** Passa a vez para o próximo jogador. */
export function advanceTurn(state: GameState, ctx: Ctx, depth = 0) {
  if (state.phase !== "PLAYING") return;
  if (state.combat) endCombat(state, ctx, "ended");
  if (state.reward) continueRewardForce(state, ctx);
  const cur = currentPlayer(state);
  // Maldições com duração e Maldição Sombria
  for (const c of [...cur.curses]) {
    if (findFx(c.defId, "pulaTurno")) continue;
    if (c.remaining !== undefined) {
      c.remaining -= 1;
      if (c.remaining <= 0) {
        removeCurse(state, cur, c.id);
        log(state, ctx, `A maldição ${curseName(state, c)} saiu de ${cur.name}.`, "curse", cur.id);
      }
    }
  }
  cur.owlPeek = null;
  let next = state.currentIdx + 1;
  if (next >= state.order.length) {
    next = 0;
    state.round += 1;
    state.truces = (state.truces ?? []).filter((t) => t.round === state.round);
    log(state, ctx, `══ Rodada ${state.round} ══`, "system");
  }
  beginTurn(state, ctx, state.order[next], depth);
}

/** Encerrar turno com Caridade. */
export function requestEndTurn(state: GameState, ctx: Ctx, p: PlayerState, auto = false) {
  const excess = p.hand.length - handLimit(state, p);
  if (excess > 0) {
    if (auto) {
      const chosen = shuffle([...p.hand], ctx).slice(0, excess);
      doCharity(state, ctx, p, chosen);
      advanceTurn(state, ctx);
      return;
    }
    state.turn.ending = true;
    createPrompt(state, ctx, "charity", p.id, { count: excess }, { blocking: false });
    return;
  }
  advanceTurn(state, ctx);
}

export function doCharity(state: GameState, ctx: Ctx, p: PlayerState, cards: string[]) {
  const minLevel = Math.min(...state.players.map((x) => x.level));
  const lowest = state.players.filter((x) => x.level === minLevel);
  if (lowest.some((x) => x.id === p.id)) {
    for (const c of cards) discardFromPlayer(state, p, c);
    log(state, ctx, `${p.name} descartou ${cards.length} carta(s) na Caridade.`);
    return;
  }
  cards.forEach((c, i) => {
    const to = lowest[i % lowest.length];
    removeFromPlayer(p, c);
    to.hand.push(c);
  });
  log(state, ctx, `${p.name} doou ${cards.length} carta(s) para ${lowest.map((x) => x.name).join(", ")} (Caridade).`);
}

// ============================================================================
// Prompts
// ============================================================================

export function createPrompt(
  state: GameState,
  ctx: Ctx,
  kind: PromptKind,
  playerId: string,
  data: Record<string, unknown>,
  opts: { blocking?: boolean; ms?: number } = {},
): Prompt {
  const ms =
    opts.ms ??
    (kind === "helpRequest" || kind === "helpOffer"
      ? TIMERS.help
      : kind === "loot"
        ? TIMERS.loot
        : kind === "trade"
          ? TIMERS.trade
          : TIMERS.prompt);
  const pr: Prompt = {
    id: uid(state, "p"),
    kind,
    playerId,
    deadline: ctx.now + ms,
    blocking: opts.blocking ?? true,
    data,
  };
  state.prompts.push(pr);
  return pr;
}

export function removePrompt(state: GameState, id: string) {
  state.prompts = state.prompts.filter((p) => p.id !== id);
}

export function hasBlockingPrompts(state: GameState): boolean {
  return state.prompts.some((p) => p.blocking);
}

export function cancelHelpPrompts(state: GameState) {
  state.prompts = state.prompts.filter((p) => p.kind !== "helpRequest" && p.kind !== "helpOffer");
}

// ============================================================================
// Combate
// ============================================================================

export function startCombat(state: GameState, ctx: Ctx, fighterId: string, monsterCardId: string) {
  if (state.combat) fail("Já existe um combate em andamento.");
  state.combatCounter += 1;
  const combat: CombatState = {
    id: state.combatCounter,
    fighterId,
    helperId: null,
    helperDeal: null,
    helperForced: false,
    helperTraitor: false,
    monsters: [],
    allies: [],
    playerMods: [],
    monsterSideMods: [],
    fleeMods: [],
    stage: "fight",
    resolveDeadline: null,
    passed: [],
    flee: null,
    desafio: false,
    glabrezuAccepted: false,
    legendaryResistanceUsed: false,
    oniDoubled: false,
    mapa: 0,
    pendingTraitor: false,
    isolated: [],
    silenced: [],
    cantFlee: [],
    autoFlee: [],
    infusions: [],
    adaptations: [],
    berserkDouble: [],
    elfDouble: [],
    screamerFor: null,
    bowUsedBy: [],
    breathUsedBy: [],
    used: [],
    levelsLost: {},
    rerolled: [],
    othersPenaltyApplied: false,
    bribes: [],
  };
  state.combat = combat;
  state.turnPhase = "COMBAT";
  state.turn.fought = true;
  const p = player(state, fighterId);
  log(state, ctx, `⚔️ ${p.name} enfrenta ${nameOf(state, monsterCardId)}!`, "combat", p.id);
  addMonster(state, ctx, monsterCardId, { wandering: false, addedBy: null });
  // Maldições de combate pendentes
  const pending = p.pendingCombatCurses.splice(0);
  for (const pc of pending) {
    log(state, ctx, `A maldição ${nameOf(state, pc.cardId)} pendente atinge ${p.name}.`, "curse", p.id);
    applyCombatCurse(state, ctx, pc.cardId, p, pc.casterId);
    discardCard(state, pc.cardId);
  }
}

export function addMonster(
  state: GameState,
  ctx: Ctx,
  cardId: string,
  opts: { wandering: boolean; addedBy: string | null },
) {
  const combat = state.combat!;
  const cm: CombatMonster = { cardId, mods: [], wandering: opts.wandering, addedBy: opts.addedBy, ignoreSpecial: false };
  combat.monsters.push(cm);
  const d = monsterDef(state, cm);
  const fighter = player(state, combat.fighterId);
  if (opts.wandering) log(state, ctx, `👹 ${d.name} entrou no combate como Monstro Errante!`, "combat", opts.addedBy ?? undefined);
  for (const fx of d.fx ?? []) {
    if (fx.tipo === "aoRevelar") {
      const r = rollD6(state, fighter, ctx, `${d.name} (ao revelar)`);
      if (r.total <= num(fx, "dadoAte")) {
        if (fx.jogadorGanha !== undefined) {
          cm.petrified = true;
          cm.revealPlayer = (cm.revealPlayer ?? 0) + num(fx, "jogadorGanha");
          log(state, ctx, `${d.name}: ${fighter.name} fica com ${num(fx, "jogadorGanha")}.`, "combat");
        }
        if (fx.monstroGanha !== undefined) {
          cm.ettinFight = true;
          cm.revealMonster = (cm.revealMonster ?? 0) + num(fx, "monstroGanha");
          log(state, ctx, `${d.name} fica com ${num(fx, "monstroGanha")}.`, "combat");
        }
      }
    }
    if (fx.tipo === "grito" && state.players.length > 1) {
      combat.screamerFor = leftOf(state, combat.fighterId).id;
      log(state, ctx, `📣 ${d.name} grita! ${player(state, combat.screamerFor).name} pode pôr um monstro da mão no combate.`, "combat");
    }
  }
  onCombatChanged(state, ctx);
}

/** Recalcula após qualquer mudança no combate. */
export function onCombatChanged(state: GameState, ctx: Ctx) {
  const combat = state.combat;
  if (!combat) return;
  // Monstros com nível <= 0 morrem (Tempestade Elemental)
  for (const cm of combat.monsters) {
    if (cm.defeated) continue;
    const lvl = monsterDef(state, cm).level + cm.mods.reduce((a, m) => a + m.value, 0);
    if (lvl <= 0) {
      cm.defeated = true;
      log(state, ctx, `💀 ${nameOf(state, cm.cardId)} chegou ao nível 0 e morreu!`, "combat");
    }
  }
  if (activeMonsters(combat).length === 0) {
    if (combat.monsters.some((m) => m.defeated)) {
      resolveVictory(state, ctx);
    } else {
      endCombat(state, ctx, "ended");
    }
    return;
  }
  if (combat.stage === "resolving") {
    const calc = computeCombat(state)!;
    if (calc.winning) {
      combat.resolveDeadline = ctx.now + TIMERS.resolve;
      combat.passed = [];
    } else {
      combat.stage = "fight";
      combat.resolveDeadline = null;
      combat.passed = [];
      log(state, ctx, "A situação mudou: o combate continua.", "combat");
    }
  }
}

export function joinHelper(
  state: GameState,
  ctx: Ctx,
  helperId: string,
  deal: HelpDeal | null,
  forced: boolean,
) {
  const combat = state.combat;
  if (!combat) fail("Não há combate.");
  if (combat.helperId) fail("Já existe um ajudante neste combate.");
  combat.helperId = helperId;
  combat.helperDeal = forced ? null : deal;
  combat.helperForced = forced;
  cancelHelpPrompts(state);
  const h = player(state, helperId);
  log(
    state,
    ctx,
    `🤝 ${h.name} está ajudando ${player(state, combat.fighterId).name}${
      forced ? " (sem tesouro)" : deal && deal.count > 0 ? ` em troca de ${deal.count} tesouro(s)` : ""
    }.`,
    "combat",
  );
  if (combatHas(state, combat, "venenoNoAjudante")) {
    if (equippedFx(state, h, "imuneVeneno")) {
      log(state, ctx, `${h.name} está imune ao sopro venenoso (Amuleto da Saúde).`, "combat");
    } else {
      loseLevels(state, h, 1, ctx, "Sopro venenoso do Dragão Verde");
    }
  }
  if (combat.pendingTraitor) {
    combat.pendingTraitor = false;
    combat.helperTraitor = true;
    log(state, ctx, `🌀 Ilusão Traidora: ${h.name} passa para o lado do monstro!`, "curse");
  }
  onCombatChanged(state, ctx);
}

export function removeHelper(state: GameState, ctx: Ctx, reason: string) {
  const combat = state.combat;
  if (!combat?.helperId) return;
  log(state, ctx, `${player(state, combat.helperId).name} saiu do combate (${reason}).`, "combat");
  combat.helperId = null;
  combat.helperDeal = null;
  combat.helperForced = false;
  combat.helperTraitor = false;
  onCombatChanged(state, ctx);
}

/** Remove um monstro do combate (sem derrotá-lo). */
export function removeMonster(state: GameState, ctx: Ctx, cardId: string, toDiscard = true) {
  const combat = state.combat!;
  const i = combat.monsters.findIndex((m) => m.cardId === cardId);
  if (i < 0) return;
  combat.monsters.splice(i, 1);
  if (toDiscard) discardCard(state, cardId);
  onCombatChanged(state, ctx);
}

export function endCombat(state: GameState, ctx: Ctx, result: "won" | "fled" | "lost" | "ended") {
  const combat = state.combat;
  if (!combat) return;
  if (result !== "won") {
    for (const { cm, fx } of combatFx(state, combat, "incendeiaVila")) {
      const exclude = new Set([combat.fighterId, combat.helperId]);
      log(state, ctx, `🔥 ${monsterDef(state, cm).name} incendeia a vila!`, "combat");
      for (const p of state.players) if (!exclude.has(p.id)) loseLevels(state, p, num(fx, "niveis", 1), ctx, "vila incendiada");
    }
  }
  const side = playerSide(state, combat).map((id) => player(state, id));
  const toTop: string[] = [];
  for (const cm of combat.monsters) {
    const d = monsterDef(state, cm);
    const phylactery = monsterFx(state, cm, "filacteria")[0];
    if ((result === "fled" || result === "lost") && monsterFx(state, cm, "voltaAoFugir").length && !cm.defeated) {
      toTop.push(cm.cardId);
      log(state, ctx, `🧟 ${d.name} não desiste: voltou ao topo do baralho de Portas.`, "combat");
    } else if (result === "won" && phylactery && !side.some((p) => matchesListed(state, p, phylactery))) {
      toTop.push(cm.cardId);
      log(state, ctx, `☠️ ${d.name} voltou ao topo do baralho de Portas!`, "combat");
    } else {
      discardCard(state, cm.cardId);
    }
  }
  if (toTop.length) state.decks.door.unshift(...toTop);
  for (const a of combat.allies) discardCard(state, a.cardId);
  state.combat = null;
  cancelHelpPrompts(state);
  state.turn.lastResult = result;
  state.turn.lastCombatLost = { ...combat.levelsLost };
  if (result === "won") state.turn.wonCombat = true;
  if (state.phase === "PLAYING") state.turnPhase = "END";
}

// ----------------------------------------------------------------------------
// Vitória
// ----------------------------------------------------------------------------

export function resolveVictory(state: GameState, ctx: Ctx) {
  const combat = state.combat!;
  const fighter = player(state, combat.fighterId);
  const helperId = effectiveHelper(state, combat);
  const helper = tryPlayer(state, helperId);
  const side = playerSide(state, combat).map((id) => player(state, id));
  const beaten = combat.monsters;
  const fighterLevelBefore = fighter.level;
  let levels = 0;
  for (const cm of beaten) levels += monsterDef(state, cm).levels;
  let treasures = rewardTreasures(state, combat);
  if (combat.desafio) levels *= 2;
  log(
    state,
    ctx,
    `🏅 ${fighter.name}${helper ? ` e ${helper.name}` : ""} derrotaram ${beaten.map((m) => nameOf(state, m.cardId)).join(" + ")}!`,
    "combat",
  );
  const bardo = hasClass(state, fighter, "bardo");
  if (bardo) treasures += 1;

  for (const cu of [...fighter.curses]) {
    const fx = findFx(cu.defId, "monstrosGanham");
    if (fx && fx.someAoDerrotarNivel !== undefined && beaten.some((m) => monsterDef(state, m).level >= num(fx, "someAoDerrotarNivel"))) {
      removeCurse(state, fighter, cu.id);
      log(state, ctx, `${def(cu.defId).name} sumiu de ${fighter.name}.`, "curse");
    }
  }
  for (const p of side) if (hasClass(state, p, "berserker")) p.streak += 1;

  gainLevels(state, fighter, levels, ctx, true, "monstro derrotado");
  if (
    !helper &&
    hasRace(state, fighter, "orc") &&
    fighter.usage["orcBlood"] !== state.round &&
    beaten.some((m) => monsterDef(state, m).level > fighterLevelBefore)
  ) {
    fighter.usage["orcBlood"] = state.round;
    gainLevels(state, fighter, 1, ctx, true, "Sede de Sangue");
  }
  for (const p of side) {
    for (const { cardId, fx } of equippedFxAll(state, p, "nivelExtraAoVencer")) {
      const r = rollD6(state, p, ctx, nameOf(state, cardId));
      if (r.total >= num(fx, "dado", 6)) gainLevels(state, p, 1, ctx, true, nameOf(state, cardId));
    }
  }
  if (helper && hasRace(state, helper, "elfo") && helper.usage["elfGrace"] !== state.round) {
    helper.usage["elfGrace"] = state.round;
    gainLevels(state, helper, 1, ctx, true, "Graça Élfica");
  }
  if (state.winnerId) {
    endCombat(state, ctx, "won");
    return;
  }
  // Efeitos "mesmo vencendo"
  if (combatHas(state, combat, "maldicaoDoFarao")) {
    for (const p of side) {
      if (p.equipped.length === 0) continue;
      const c = pickRandom(p.equipped, ctx);
      log(state, ctx, `Maldição do faraó: ${p.name} perdeu ${nameOf(state, c)}.`, "combat");
      discardFromPlayer(state, p, c);
    }
  }
  if (combatHas(state, combat, "explodeAoMorrer")) {
    for (const p of side) {
      if (p.equipped.length === 0) continue;
      if (p.equipped.length === 1) {
        log(state, ctx, `A explosão do Balor destruiu ${nameOf(state, p.equipped[0])} de ${p.name}.`, "combat");
        discardFromPlayer(state, p, p.equipped[0]);
      } else {
        createPrompt(state, ctx, "chooseLoss", p.id, {
          victimId: p.id,
          candidates: [...p.equipped],
          count: 1,
          reason: "Explosão do Balor: escolha 1 item equipado para perder",
        });
      }
    }
  }
  const helperBonus = beaten.reduce((a, m) => a + monsterFx(state, m, "tesouroExtraAjudante").reduce((x, fx) => x + num(fx, "quantidade", 1), 0), 0);
  const deal = combat.helperForced ? null : combat.helperDeal;
  const bribes = (combat.bribes ?? []).filter((b) => state.players.some((p) => p.id === b.playerId));
  endCombat(state, ctx, "won");

  const pool: string[] = [];
  for (let i = 0; i < treasures; i++) {
    const c = drawCard(state, "treasure", ctx);
    if (c) pool.push(c);
  }
  state.reward = {
    cards: pool,
    fighterId: fighter.id,
    helperId: helper?.id ?? null,
    deal: helper ? deal : null,
    faceUp: !!helper,
    bardo: bardo && pool.length > 0,
    helperExtra: helper ? helperBonus : 0,
    bribes,
  };
  if (helper && helperBonus > 0) {
    const got = drawTo(state, helper, "treasure", helperBonus, ctx);
    if (got.length) log(state, ctx, `${helper.name} comprou ${got.length} tesouro(s) extra(s) por ajudar.`);
  }
  continueReward(state, ctx);
}

/** Quantos tesouros o combate atual rende se for vencido agora (sem o extra do Bardo, que é descartado). */
export function rewardTreasures(state: GameState, combat: CombatState): number {
  const fighter = player(state, combat.fighterId);
  const side = playerSide(state, combat).map((id) => player(state, id));
  const elmo = !!equippedFx(state, fighter, "metadeErrantes");
  let treasures = 0;
  for (const cm of combat.monsters) {
    let t = monsterDef(state, cm).treasures;
    if (cm.wandering && elmo && cm.addedBy !== fighter.id) t = Math.floor(t / 2);
    treasures += t;
  }
  const animalOrFlyer = combat.monsters.some((m) => {
    const t = monsterDef(state, m).tags;
    return t.includes("animal") || t.includes("voador");
  });
  if (side.some((p) => hasClass(state, p, "patrulheiro")) && animalOrFlyer) treasures += 1;
  treasures += Number(combat.mapa) || 0;
  for (const fx of curseFx(fighter, "menosTesouros")) treasures -= num(fx, "quantidade", 1);
  if (hasCurseFx(fighter, "metadeTesouros")) treasures = Math.floor(treasures / 2);
  return Math.max(0, treasures);
}

/**
 * Tesouros que ainda são do lutador: o total da recompensa menos o que já foi prometido
 * ao ajudante e às ameaças aceitas. É o máximo que se pode pedir numa ameaça.
 */
export function freeTreasures(state: GameState, combat: CombatState): number {
  let free = rewardTreasures(state, combat);
  if (combat.helperId && !combat.helperForced && combat.helperDeal) free -= combat.helperDeal.count;
  for (const b of combat.bribes ?? []) free -= b.count;
  return Math.max(0, free);
}

export function continueReward(state: GameState, ctx: Ctx) {
  const r = state.reward;
  if (!r) return;
  const fighter = player(state, r.fighterId);
  if (r.bardo) {
    r.bardo = false;
    if (r.cards.length > 1) {
      createPrompt(state, ctx, "bardo", fighter.id, { cards: [...r.cards] });
      return;
    }
  }
  if (r.helperId && r.deal && r.deal.count > 0 && r.cards.length > 0) {
    const n = Math.min(r.deal.count, r.cards.length);
    const helper = player(state, r.helperId);
    if (r.deal.mode === "random") {
      const chosen = shuffle([...r.cards], ctx).slice(0, n);
      giveRewardTo(state, ctx, helper, chosen);
      r.deal = null;
    } else {
      const chooser = r.deal.mode === "fighter" ? fighter.id : helper.id;
      createPrompt(state, ctx, "distribute", chooser, { cards: [...r.cards], count: n, helperId: helper.id });
      return;
    }
  }
  // Paga as ameaças aceitas
  for (const b of r.bribes ?? []) {
    if (r.cards.length === 0) break;
    const taker = tryPlayer(state, b.playerId);
    if (!taker) continue;
    const chosen = shuffle([...r.cards], ctx).slice(0, Math.min(b.count, r.cards.length));
    log(state, ctx, `😈 ${fighter.name} pagou a ameaça de ${taker.name}.`);
    giveRewardTo(state, ctx, taker, chosen);
  }
  r.bribes = [];
  if (r.cards.length > 0) {
    if (r.faceUp) {
      log(state, ctx, `💰 ${fighter.name} ficou com: ${r.cards.map((c) => nameOf(state, c)).join(", ")}.`);
      state.lastFaceUp = { ownerId: fighter.id, cards: [...r.cards], turnSerial: state.turnSerial };
    } else {
      log(state, ctx, `💰 ${fighter.name} comprou ${r.cards.length} tesouro(s).`);
    }
    fighter.hand.push(...r.cards);
  }
  state.reward = null;
}

/** Entrega o que sobrou da recompensa ao lutador (usado ao forçar o fim do turno). */
function continueRewardForce(state: GameState, ctx: Ctx) {
  const r = state.reward;
  if (!r) return;
  state.prompts = state.prompts.filter((p) => p.kind !== "bardo" && p.kind !== "distribute");
  r.bardo = false;
  r.deal = null;
  continueReward(state, ctx);
}

export function giveRewardTo(state: GameState, ctx: Ctx, p: PlayerState, cards: string[]) {
  const r = state.reward!;
  r.cards = r.cards.filter((c) => !cards.includes(c));
  p.hand.push(...cards);
  if (cards.length) {
    log(state, ctx, `💰 ${p.name} ficou com: ${cards.map((c) => nameOf(state, c)).join(", ")}.`);
    state.lastFaceUp = { ownerId: p.id, cards: [...cards], turnSerial: state.turnSerial };
  }
}

// ----------------------------------------------------------------------------
// Fuga e Coisas Ruins
// ----------------------------------------------------------------------------

export function startFlee(state: GameState, ctx: Ctx) {
  const combat = state.combat!;
  cancelHelpPrompts(state);
  const participants = playerSide(state, combat);
  const results: NonNullable<CombatState["flee"]>["results"] = [];
  for (const pid of participants) {
    const p = player(state, pid);
    for (const cm of activeMonsters(combat)) {
      const d = monsterDef(state, cm);
      if (pid !== combat.fighterId && monsterFx(state, cm, "ajudanteSofre").length) {
        results.push({ playerId: pid, monsterCardId: cm.cardId, roll: 0, bonus: 0, success: false, note: `${d.name}: o ajudante também sofre` });
        continue;
      }
      const info = fleeInfo(state, p, cm);
      if (info.impossible) {
        results.push({ playerId: pid, monsterCardId: cm.cardId, roll: 0, bonus: 0, success: false, note: info.impossible });
        continue;
      }
      if (info.auto) {
        results.push({ playerId: pid, monsterCardId: cm.cardId, roll: 0, bonus: 0, success: true, note: info.auto });
        continue;
      }
      const r = rollD6(state, p, ctx, `Fugir de ${d.name} (bônus ${info.bonus >= 0 ? "+" : ""}${info.bonus})`);
      let success = r.total + info.bonus >= 5;
      let note: string | undefined;
      const stubborn = equippedFx(state, p, "podeEmpacar");
      if (success && stubborn) {
        const m = rollD6(state, p, ctx, nameOf(state, stubborn.cardId));
        if (m.natural === 1) {
          success = false;
          note = "a Mula empacou";
        }
      }
      results.push({ playerId: pid, monsterCardId: cm.cardId, roll: r.total, bonus: info.bonus, success, note });
    }
  }
  for (const r of results) {
    log(
      state,
      ctx,
      `${r.success ? "🏃" : "❌"} ${player(state, r.playerId).name} ${r.success ? "fugiu de" : "não fugiu de"} ${nameOf(state, r.monsterCardId)}${r.note ? ` (${r.note})` : ""}.`,
      "combat",
    );
  }
  if (results.every((r) => r.success)) {
    endCombat(state, ctx, "fled");
    return;
  }
  combat.stage = "badstuff";
  combat.resolveDeadline = null;
  combat.flee = { results, deadline: ctx.now + TIMERS.badStuff, confirmed: [], substitutes: {} };
  log(state, ctx, "☠️ Coisas Ruins à vista! Última chance para reações (Anel dos Três Desejos, Escudo da Fé, rerrolagens…).", "combat");
}

export function badStuffVictims(state: GameState): string[] {
  const combat = state.combat;
  if (!combat?.flee) return [];
  const ids = new Set<string>();
  for (const r of combat.flee.results) {
    if (!r.success) ids.add(combat.flee.substitutes[r.playerId] ?? r.playerId);
  }
  return [...ids];
}

export function maybeApplyBadStuff(state: GameState, ctx: Ctx) {
  const combat = state.combat;
  if (!combat?.flee) return;
  const victims = badStuffVictims(state);
  if (victims.length === 0) {
    endCombat(state, ctx, "fled");
    return;
  }
  if (victims.every((v) => combat.flee!.confirmed.includes(v))) applyAllBadStuff(state, ctx);
}

export function applyAllBadStuff(state: GameState, ctx: Ctx) {
  const combat = state.combat!;
  const flee = combat.flee!;
  const byPlayer = new Map<string, string[]>();
  for (const r of flee.results) {
    if (r.success) continue;
    const arr = byPlayer.get(r.playerId) ?? [];
    arr.push(r.monsterCardId);
    byPlayer.set(r.playerId, arr);
  }
  const paladins: PlayerState[] = [];
  for (const [pid, monsters] of byPlayer) {
    const sub = flee.substitutes[pid];
    const target = player(state, sub ?? pid);
    if (sub) {
      paladins.push(target);
      log(state, ctx, `🛡️ ${target.name} assume as Coisas Ruins de ${player(state, pid).name} (Escudo da Fé).`, "combat");
    }
    if (hasClass(state, target, "berserker") && target.streak > 0) {
      target.streak = 0;
    }
    // Runa do Sangue: perca 1 nível a mais ao perder um combate
    let blood = 0;
    for (const id of target.equipped)
      for (const fx of runeFx(state, id, "perdeNivelAoPerder")) blood += num(fx, "quantidade", 1);
    if (blood) loseLevels(state, target, blood, ctx, "runa (perdeu o combate)");
    for (const mid of monsters) {
      const cm = combat.monsters.find((m) => m.cardId === mid);
      if (!cm) continue;
      if (!state.players.includes(target)) continue;
      applyBadStuff(state, ctx, target, cm);
    }
    if (combat.desafio && pid === combat.fighterId && !sub) {
      killPlayer(state, ctx, target, "Desafio perdido");
    }
  }
  for (const pal of paladins) {
    const got = drawTo(state, pal, "treasure", 3, ctx);
    log(state, ctx, `${pal.name} comprou ${got.length} tesouro(s) pelo Escudo da Fé.`);
  }
  endCombat(state, ctx, "lost");
}

function itemProtected(state: GameState, p: PlayerState, cardId: string, d: MonsterCard | null): boolean {
  const c = state.cards[cardId];
  if (!c) return true;
  const prot = cardFxAll(state, cardId, "protecao").map((fx) => fx.contra);
  if (prot.includes("tudo")) return true;
  if (d) {
    if (prot.includes("fogo") && d.tags.includes("fogo")) return true;
    if (d.acidRust && (prot.includes("acido") || runeFx(state, cardId, "protegeAcido").length > 0)) return true;
  }
  if (slotOf(state, cardId) === "head" && equippedFx(state, p, "protegeCapacete")) return true;
  return false;
}

function itemWorth(state: GameState, cardId: string): number {
  const d = defOf(state, cardId);
  const bonus = d.kind === "item" ? d.bonus : d.kind === "monster" ? d.treasures : 0;
  const price = "price" in d ? d.price : 0;
  return bonus * 10000 + price;
}

function slotItems(state: GameState, p: PlayerState, slot: Slot | "hands"): string[] {
  const s: Slot = slot === "hands" ? "hand" : slot;
  return p.equipped.filter((id) => slotOf(state, id) === s);
}

export function applyBadStuff(state: GameState, ctx: Ctx, target: PlayerState, cm: CombatMonster) {
  const d = monsterDef(state, cm);
  const combat = state.combat;
  const immune = (why: string) => log(state, ctx, `🛡️ ${target.name} é imune às Coisas Ruins de ${d.name} (${why}).`, "combat");
  if (hasRace(state, target, "draconato") && !d.legendary && (d.tags.includes("fogo") || d.tags.includes("dragao")))
    return immune("Escamas Dracônicas");
  if (hasRace(state, target, "tritao") && d.tags.includes("aquatico")) return immune("Filho das Marés");
  for (const { cardId, fx } of equippedFxAll(state, target, "imuneCoisasRuins")) {
    if (flag(fx, "excetoLendarios") && d.legendary) continue;
    if (strs(fx, "tags").some((t) => d.tags.includes(t as never))) return immune(nameOf(state, cardId));
  }
  const antidote = equippedFx(state, target, "imuneVeneno");
  if (d.poison && antidote) return immune(nameOf(state, antidote.cardId));

  log(state, ctx, `☠️ Coisas Ruins de ${d.name} em ${target.name}: ${d.badStuffText}`, "combat");
  let dwarfSave = hasRace(state, target, "anao") ? 1 : 0;
  const losses: string[] = [];
  let death = false;
  const takeDwarf = (n: number) => {
    if (dwarfSave > 0 && n > 0) {
      dwarfSave = 0;
      return n - 1;
    }
    return n;
  };
  const candidatesAll = () => target.equipped.filter((id) => !itemProtected(state, target, id, d) && !losses.includes(id));
  for (const e of d.badStuff) {
    switch (e.t) {
      case "levels": {
        let n = e.n;
        const regen = equippedFx(state, target, "perdeMenosNiveis");
        if (regen && target.usage["regen"] !== state.round) {
          target.usage["regen"] = state.round;
          const less = num(regen.fx, "quantidade", 1);
          n = Math.max(0, n - less);
          log(state, ctx, `💍 ${nameOf(state, regen.cardId)}: ${target.name} perde ${less} nível(is) a menos.`);
        }
        loseLevels(state, target, n, ctx, d.name, { corpoSeco: (d.fx ?? []).some((fx) => fx.tipo === "drenoDeVida") });
        break;
      }
      case "slot":
        for (const id of slotItems(state, target, e.slot)) if (!itemProtected(state, target, id, d)) losses.push(id);
        break;
      case "rings": {
        const rings = target.equipped.filter((id) => slotOf(state, id) === "ring" && !itemProtected(state, target, id, d));
        if (e.n === "all" || rings.length <= e.n) losses.push(...rings);
        else {
          const n = takeDwarf(e.n);
          if (n > 0)
            createPrompt(state, ctx, "chooseLoss", target.id, {
              victimId: target.id,
              candidates: rings,
              count: n,
              reason: `${d.name}: escolha ${n} anel(éis) para perder`,
            });
        }
        break;
      }
      case "handCards": {
        const cards = shuffle([...target.hand], ctx).slice(0, e.n);
        for (const c of cards) discardFromPlayer(state, target, c);
        if (cards.length) log(state, ctx, `${target.name} perdeu ${cards.length} carta(s) da mão.`);
        break;
      }
      case "death":
        death = true;
        break;
      case "chooseEquipped": {
        const cands = candidatesAll();
        if (cands.length <= e.n) losses.push(...cands);
        else {
          const n = takeDwarf(e.n);
          if (n > 0)
            createPrompt(state, ctx, "chooseLoss", target.id, {
              victimId: target.id,
              candidates: cands,
              count: n,
              reason: `${d.name}: escolha ${n} item(ns) equipado(s) para perder`,
            });
        }
        break;
      }
      case "randomEquipped": {
        const n = takeDwarf(e.n);
        losses.push(...shuffle(candidatesAll(), ctx).slice(0, n));
        break;
      }
      case "bigOrChoose2": {
        const bigs = candidatesAll().filter((id) => itemDef(state, id)?.big);
        if (bigs.length > 0) {
          if (takeDwarf(1) === 0) break;
          if (bigs.length === 1) losses.push(bigs[0]);
          else
            createPrompt(state, ctx, "chooseLoss", target.id, {
              victimId: target.id,
              candidates: bigs,
              count: 1,
              reason: `${d.name}: escolha 1 item Grande para perder`,
            });
        } else {
          const cands = candidatesAll();
          const n = takeDwarf(2);
          if (cands.length <= n) losses.push(...cands);
          else if (n > 0)
            createPrompt(state, ctx, "chooseLoss", target.id, {
              victimId: target.id,
              candidates: cands,
              count: n,
              reason: `${d.name}: escolha ${n} item(ns) para perder`,
            });
        }
        break;
      }
      case "bigOrLevels": {
        const bigs = candidatesAll().filter((id) => itemDef(state, id)?.big);
        if (bigs.length === 0) loseLevels(state, target, e.n, ctx, d.name);
        else
          createPrompt(state, ctx, "bigOrLevels", target.id, {
            victimId: target.id,
            bigs,
            levels: e.n,
            dwarf: dwarfSave > 0,
          });
        break;
      }
      case "mummyRot":
        addSpecialCurse(state, target, "special.mumia", 2, 2, null);
        log(state, ctx, `${target.name} pegou a Podridão de Múmia (-2 por 2 rodadas).`, "curse");
        break;
      case "possession": {
        const cands = [...target.equipped, ...target.carried].filter((id) => !itemProtected(state, target, id, d));
        if (cands.length === 0 || takeDwarf(1) === 0) break;
        const left = leftOf(state, target.id);
        if (left.id === target.id) break;
        createPrompt(state, ctx, "possession", left.id, { victimId: target.id, candidates: cands });
        break;
      }
      case "chimera": {
        let lost = 0;
        for (let i = 0; i < 3; i++) if (rollD6(state, target, ctx, "cabeça da Quimera").total <= 3) lost++;
        loseLevels(state, target, lost, ctx, "Quimera");
        break;
      }
      case "vampirize":
        break;
      case "carried": {
        const cands = target.carried.filter((id) => !itemProtected(state, target, id, d));
        if (dwarfSave > 0 && cands.length > 0) {
          dwarfSave = 0;
          cands.sort((a, b) => itemWorth(state, b) - itemWorth(state, a));
          cands.shift();
        }
        losses.push(...cands);
        break;
      }
      case "othersLoseLevels":
        if (combat && !combat.othersPenaltyApplied) {
          combat.othersPenaltyApplied = true;
          for (const o of otherPlayers(state, target.id)) loseLevels(state, o, e.n, ctx, `${d.name} passou pela cidade`);
        }
        break;
    }
  }
  if (dwarfSave > 0 && losses.length > 0) {
    losses.sort((a, b) => itemWorth(state, b) - itemWorth(state, a));
    const saved = losses.shift()!;
    log(state, ctx, `⛏️ Teimosia Anã: ${target.name} manteve ${nameOf(state, saved)}.`);
  }
  for (const id of [...new Set(losses)]) {
    log(state, ctx, `${target.name} perdeu ${nameOf(state, id)}.`);
    discardFromPlayer(state, target, id);
  }
  if (death) killPlayer(state, ctx, target, d.name);
}

// ----------------------------------------------------------------------------
// Morte
// ----------------------------------------------------------------------------

export function killPlayer(state: GameState, ctx: Ctx, p: PlayerState, reason: string): boolean {
  if (hasRace(state, p, "vampirico")) {
    const r = rollD6(state, p, ctx, "Não-morto");
    if (r.total >= 5) {
      log(state, ctx, `🧛 ${p.name} se recusa a morrer (Não-morto)! O turno dele acaba.`, "combat");
      if (isCurrent(state, p.id) && state.turnPhase !== "COMBAT") state.turnPhase = "END";
      return false;
    }
  }
  log(state, ctx, `💀 ${p.name} morreu (${reason})!`, "combat", p.id);
  const items = [...p.equipped, ...p.carried];
  p.equipped = [];
  p.carried = [];
  for (const c of [...p.hand]) discardFromPlayer(state, p, c);
  for (const cu of [...p.curses]) removeCurse(state, p, cu.id);
  for (const pc of p.pendingCombatCurses.splice(0)) discardCard(state, pc.cardId);
  p.streak = 0;
  p.needsNewHand = true;
  p.hibernating = false;
  if (state.combat && state.combat.monsters.some((m) => monsterDef(state, m).badStuff.some((e) => e.t === "vampirize"))) {
    if (p.race) discardCard(state, p.race);
    p.race = newCard(state, "race.vampirico", true);
    log(state, ctx, `🧛 ${p.name} renasceu como Vampírico!`, "combat");
  }
  for (const id of items) delete state.cards[id]?.artificeSecond;
  if (items.length > 0) {
    const queue = otherPlayers(state, p.id)
      .sort((a, b) => b.level - a.level || a.seat - b.seat)
      .map((x) => x.id);
    nextLoot(state, ctx, p.id, items, queue);
  }
  return true;
}

export function nextLoot(state: GameState, ctx: Ctx, deadId: string, items: string[], queue: string[]) {
  if (items.length === 0 || queue.length === 0) {
    for (const id of items) discardCard(state, id);
    const dead = tryPlayer(state, deadId);
    if (items.length) log(state, ctx, `${items.length} item(ns) do corpo de ${dead?.name ?? "quem desistiu"} foram descartados.`);
    return;
  }
  const [next, ...rest] = queue;
  const deadName = tryPlayer(state, deadId)?.name ?? state.leftPlayers?.find((l) => l.id === deadId)?.name ?? "quem saiu";
  createPrompt(state, ctx, "loot", next, { deadId, deadName, items, queue: rest });
}

// ============================================================================
// Maldições
// ============================================================================

export function curseName(state: GameState, c: ActiveCurse): string {
  if (c.defId === "special.sombria") return "Maldição Sombria";
  if (c.defId === "special.mumia") return "Podridão de Múmia";
  return def(c.defId).name;
}

export function removeCurse(state: GameState, p: PlayerState, curseId: string) {
  const i = p.curses.findIndex((c) => c.id === curseId);
  if (i < 0) return;
  const [c] = p.curses.splice(i, 1);
  if (c.cardId) discardCard(state, c.cardId);
}

export function addSpecialCurse(
  state: GameState,
  target: PlayerState,
  defId: string,
  value: number,
  turns: number,
  casterId: string | null,
) {
  const remaining = turns + (isCurrent(state, target.id) ? 1 : 0);
  target.curses.push({ id: uid(state, "k"), defId, value, remaining, casterId });
}

/**
 * Defesas contra uma maldição (ou ativa tratada como maldição).
 * Retorna o jogador que efetivamente recebe o efeito, ou null se anulada.
 */
export function defendCurse(
  state: GameState,
  ctx: Ctx,
  target: PlayerState,
  caster: PlayerState | null,
  label: string,
  allowReflect = true,
): PlayerState | null {
  const bruxo = !!caster && hasClass(state, caster, "bruxo");
  if (target.hibernating) {
    log(state, ctx, `🐢 ${target.name} está no casco e ignora ${label}.`, "curse");
    return null;
  }
  if (
    allowReflect &&
    caster &&
    caster.id !== target.id &&
    !!equippedFx(state, target, "refleteMaldicao") &&
    target.usage["refletor"] !== state.round
  ) {
    target.usage["refletor"] = state.round;
    log(state, ctx, `🪞 ${nameOf(state, equippedFx(state, target, "refleteMaldicao")!.cardId)} de ${target.name} devolve ${label} para ${caster.name}!`, "curse");
    return defendCurse(state, ctx, caster, target, label, false);
  }
  if (!bruxo && hasRace(state, target, "divino")) {
    const r = rollD6(state, target, ctx, "Proteção Celestial");
    if (r.total >= (tier11(target) ? 4 : 5)) {
      log(state, ctx, `✨ Proteção Celestial anulou ${label}.`, "curse");
      return null;
    }
  }
  if (allowReflect && !bruxo && caster && caster.id !== target.id && hasClass(state, target, "ilusionista")) {
    const r = rollD6(state, target, ctx, "Imagem Espelhada");
    if (r.total >= (tier11(target) ? 5 : 6)) {
      log(state, ctx, `🪞 Imagem Espelhada! ${label} volta para ${caster.name}.`, "curse");
      return defendCurse(state, ctx, caster, target, label, false);
    }
  }
  const ward = equippedFx(state, target, "anulaMaldicao");
  if (ward) {
    const before = nameOf(state, ward.cardId);
    const into = `item.${String(ward.fx.viraEm)}`;
    if (CARD_DEFS[into]) state.cards[ward.cardId].defId = into;
    log(state, ctx, `💍 ${before} de ${target.name} anulou ${label}${CARD_DEFS[into] ? ` e virou ${def(into).name}` : ""}.`, "curse");
    return null;
  }
  return target;
}

/** Lança uma maldição (carta) em um jogador. */
export function castCurse(state: GameState, ctx: Ctx, cardId: string, caster: PlayerState | null, target: PlayerState) {
  const d = defOf(state, cardId) as CurseCard;
  if (caster) {
    caster.curseCastRound = state.round;
    if (caster.id !== target.id && hasRace(state, caster, "diabrete") && caster.usage["malicia"] !== state.round) {
      caster.usage["malicia"] = state.round;
      const got = drawTo(state, caster, "door", 2, ctx);
      log(state, ctx, `😈 Malícia: ${caster.name} comprou ${got.length} Porta(s).`);
    }
  }
  log(state, ctx, `🕯️ ${caster ? `${caster.name} lançou` : "A porta revelou"} ${d.name} em ${target.name}.`, "curse", caster?.id);
  const final = defendCurse(state, ctx, target, caster, d.name);
  if (!final) {
    discardCard(state, cardId);
    return;
  }
  applyCurse(state, ctx, cardId, final, caster);
}

function loseSlotByCurse(state: GameState, ctx: Ctx, p: PlayerState, slot: Slot) {
  const items = p.equipped.filter((id) => slotOf(state, id) === slot && !cardFxAll(state, id, "protecao").some((fx) => fx.contra === "tudo"));
  if (items.length === 0) {
    log(state, ctx, `${p.name} não tinha nada nesse slot.`, "curse");
    return;
  }
  for (const id of items) {
    log(state, ctx, `${p.name} perdeu ${nameOf(state, id)}.`, "curse");
    discardFromPlayer(state, p, id);
  }
}

const CURSE_SLOT: Record<string, Slot> = { capacete: "head", peitoral: "chest", calcas: "legs", botas: "feet", montaria: "mount" };

export function applyCurse(state: GameState, ctx: Ctx, cardId: string, target: PlayerState, caster: PlayerState | null) {
  const d = defOf(state, cardId) as CurseCard;
  const bruxo = !!caster && hasClass(state, caster, "bruxo");
  const keepCard = d.curseType === "duration" || d.curseType === "persistent";
  if (d.curseType === "combat") {
    const combat = state.combat;
    const inCombat = combat && (combat.fighterId === target.id || combat.helperId === target.id);
    if (inCombat) {
      applyCombatCurse(state, ctx, cardId, target, caster?.id ?? null);
    } else {
      target.pendingCombatCurses.push({ cardId, casterId: caster?.id ?? null });
      log(state, ctx, `${d.name} vai valer no próximo combate de ${target.name}.`, "curse");
      return;
    }
  } else if (d.curseType === "duration") {
    let turns = (d.duration ?? 1) + (bruxo ? 1 : 0);
    if (!findFx(d.id, "pulaTurno") && isCurrent(state, target.id)) turns += 1;
    target.curses.push({ id: uid(state, "k"), defId: d.id, cardId, remaining: turns, casterId: caster?.id ?? null });
    onPersistentCurse(state, ctx, target, d.id);
  } else if (d.curseType === "persistent") {
    target.curses.push({ id: uid(state, "k"), defId: d.id, cardId, casterId: caster?.id ?? null });
    onPersistentCurse(state, ctx, target, d.id);
  } else {
    for (const fx of d.fx ?? []) applyInstantCurseFx(state, ctx, d, fx, target, caster);
  }
  if (!keepCard) discardCard(state, cardId);
}

function applyInstantCurseFx(state: GameState, ctx: Ctx, d: CurseCard, fx: Fx, target: PlayerState, caster: PlayerState | null) {
  switch (fx.tipo) {
    case "perderNiveis": {
      let n = num(fx, "quantidade", 1);
      if (fx.nivelMinimoParaExtra !== undefined && target.level >= num(fx, "nivelMinimoParaExtra")) n += num(fx, "extra");
      loseLevels(state, target, n, ctx, d.name);
      break;
    }
    case "perderSlot":
      loseSlotByCurse(state, ctx, target, CURSE_SLOT[String(fx.slot)] ?? "head");
      break;
    case "perderAneis": {
      const n = num(fx, "quantidade", 1);
      const rings = target.equipped.filter((id) => slotOf(state, id) === "ring");
      if (rings.length <= n || !caster || caster.id === target.id) {
        const lose = rings.length <= n ? rings : shuffle([...rings], ctx).slice(0, n);
        for (const id of lose) {
          log(state, ctx, `${target.name} perdeu ${nameOf(state, id)}.`, "curse");
          discardFromPlayer(state, target, id);
        }
      } else {
        createPrompt(state, ctx, "chooseLoss", caster.id, {
          victimId: target.id,
          candidates: rings,
          count: n,
          reason: `${d.name}: escolha ${n} anel(éis) de ${target.name}`,
        });
      }
      break;
    }
    case "perderMelhorItem": {
      const items = [...target.equipped].sort((a, b) => itemWorth(state, b) - itemWorth(state, a));
      if (items[0]) {
        log(state, ctx, `${target.name} perdeu ${nameOf(state, items[0])}.`, "curse");
        discardFromPlayer(state, target, items[0]);
      }
      break;
    }
    case "descartarCartas": {
      const cards = shuffle([...target.hand], ctx).slice(0, num(fx, "quantidade", 1));
      for (const c of cards) discardFromPlayer(state, target, c);
      log(state, ctx, `${target.name} descartou ${cards.length} carta(s) da mão.`, "curse");
      break;
    }
    case "impostos": {
      const lower = state.players.filter((x) => x.level < target.level);
      for (const o of lower) {
        if (target.hand.length === 0) break;
        const c = pickRandom(target.hand, ctx);
        removeFromPlayer(target, c);
        o.hand.push(c);
      }
      log(state, ctx, `${target.name} pagou impostos para ${lower.length} jogador(es).`, "curse");
      break;
    }
    case "trocaFeerica": {
      const left = leftOf(state, target.id);
      if (left.id !== target.id) createPrompt(state, ctx, "fairyCurse", left.id, { victimId: target.id });
      break;
    }
    case "perderClasse":
      for (const c of [...target.classes]) discardCard(state, c);
      target.classes = [];
      target.artificeSlots = [];
      revalidateEquipment(state, ctx, target);
      log(state, ctx, `${target.name} esqueceu a própria classe.`, "curse");
      break;
    case "virarRaca": {
      const raceId = `race.${String(fx.raca)}`;
      if (!CARD_DEFS[raceId]) break;
      if (target.race) discardCard(state, target.race);
      target.race = newCard(state, raceId, true);
      revalidateEquipment(state, ctx, target);
      log(state, ctx, `${target.name} agora é ${def(raceId).name}.`, "curse");
      break;
    }
  }
}

export function onPersistentCurse(state: GameState, ctx: Ctx, target: PlayerState, defId: string) {
  if (findFx(defId, "ocupaUmaMao")) {
    // Libera uma mão
    while (handsUsed(state, target) > 2) {
      const handItems = target.equipped.filter((id) => slotOf(state, id) === "hand");
      if (!handItems.length) break;
      handItems.sort((a, b) => itemWorth(state, a) - itemWorth(state, b));
      removeFromPlayer(target, handItems[0]);
      target.carried.push(handItems[0]);
      log(state, ctx, `${target.name} teve que largar ${nameOf(state, handItems[0])} (${def(defId).name}).`, "curse");
    }
  }
  if (findFx(defId, "semLendarios")) {
    for (const id of [...target.equipped]) {
      if (isLegendaryItem(state, id)) {
        removeFromPlayer(target, id);
        target.hand.push(id);
        log(state, ctx, `${nameOf(state, id)} voltou para a mão de ${target.name} (${def(defId).name}).`, "curse");
      }
    }
  }
}

/** Efeito de uma maldição de combate no combate atual. */
export function applyCombatCurse(state: GameState, ctx: Ctx, cardId: string, target: PlayerState, casterId: string | null) {
  const combat = state.combat!;
  const d = defOf(state, cardId);
  for (const fx of d.fx ?? []) {
    switch (fx.tipo) {
      case "forcaNoCombate": {
        const v = tier11(target) && fx.valorNivel11 !== undefined ? num(fx, "valorNivel11") : num(fx, "valor");
        combat.playerMods.push({ id: uid(state, "m"), value: v, by: casterId, label: `${d.name} (${target.name})`, target: target.id });
        break;
      }
      case "naoPodeFugir":
        combat.cantFlee.push(target.id);
        break;
      case "monstroGanha":
        combat.monsterSideMods.push({ id: uid(state, "m"), value: num(fx, "valor"), by: casterId, label: d.name });
        break;
      case "ninguemAjuda":
        combat.isolated.push(target.id);
        if (combat.fighterId === target.id && combat.helperId) removeHelper(state, ctx, d.name);
        break;
      case "semAtivas":
        combat.silenced.push(target.id);
        break;
      case "chamadoDaHorda": {
        for (let guard = 0; guard < 300; guard++) {
          const c = drawCard(state, "door", ctx);
          if (!c) break;
          if (defOf(state, c).kind === "monster") {
            addMonster(state, ctx, c, { wandering: true, addedBy: casterId });
            break;
          }
          discardCard(state, c);
        }
        break;
      }
      case "ajudanteTraidor":
        if (combat.helperId) {
          combat.helperTraitor = true;
          log(state, ctx, `🌀 ${player(state, combat.helperId).name} passou para o lado do monstro!`, "curse");
        } else {
          combat.pendingTraitor = true;
        }
        break;
    }
  }
  log(state, ctx, `${d.name} afeta o combate de ${target.name}.`, "curse");
  onCombatChanged(state, ctx);
}

/** Desequipa itens que o jogador não pode mais usar. */
export function revalidateEquipment(state: GameState, ctx: Ctx, p: PlayerState) {
  const current = [...p.equipped];
  p.equipped = [];
  if (!hasClass(state, p, "artifice")) p.artificeSlots = [];
  for (const id of current) delete state.cards[id]?.artificeSecond;
  // Recoloca um a um respeitando as regras
  for (const id of current) {
    const res = equipCheck(state, p, id);
    if (res.error) {
      p.carried.push(id);
      log(state, ctx, `${nameOf(state, id)} foi desequipado de ${p.name} (${res.error})`);
    } else {
      p.equipped.push(id);
      if (res.asSecond) {
        state.cards[id].artificeSecond = true;
        const slot = slotOf(state, id);
        if (slot && !p.artificeSlots.includes(slot)) p.artificeSlots.push(slot);
      }
    }
  }
}

export { classesOf, giveItem };

// ============================================================================
// Desistência
// ============================================================================

/**
 * O jogador desiste: conta como morte (os outros saqueiam os itens), mas ele sai do jogo.
 * Se não sobrar nenhum humano, a partida é encerrada (closed). Se sobrar um só jogador, ele vence.
 */
export function surrender(state: GameState, ctx: Ctx, p: PlayerState) {
  if (state.phase === "FINISHED") fail("A partida já terminou.");
  log(state, ctx, `🏳️ ${p.name} desistiu da partida.`, "system", p.id);
  const wasCurrent = state.phase === "PLAYING" && isCurrent(state, p.id);
  // Combate e recompensas
  const combat = state.combat;
  if (combat) {
    if (combat.fighterId === p.id) endCombat(state, ctx, "ended");
    else {
      if (combat.helperId === p.id) removeHelper(state, ctx, "desistiu");
      combat.bribes = combat.bribes.filter((b) => b.playerId !== p.id);
    }
  }
  const r = state.reward;
  if (r) {
    if (r.fighterId === p.id) {
      for (const c of r.cards) discardCard(state, c);
      state.reward = null;
    } else {
      if (r.helperId === p.id) {
        r.helperId = null;
        r.deal = null;
      }
      r.bribes = (r.bribes ?? []).filter((b) => b.playerId !== p.id);
    }
  }
  // Prompts que dependem dele
  const refs = ["fighterId", "helperId", "fromId", "victimId", "fairyId", "threatenerId"];
  const stale = state.prompts.filter((pr) => pr.playerId === p.id || refs.some((k) => pr.data[k] === p.id));
  for (const pr of stale) {
    if (pr.kind === "loot") {
      // passa a vez do saque para o próximo da fila
      removePrompt(state, pr.id);
      nextLoot(state, ctx, String(pr.data.deadId), pr.data.items as string[], pr.data.queue as string[]);
    } else if (pr.kind === "distribute" || pr.kind === "bardo") {
      removePrompt(state, pr.id);
      if (state.reward) {
        state.reward.deal = null;
        state.reward.bardo = false;
      }
    } else if (pr.kind === "charity") {
      removePrompt(state, pr.id);
    } else {
      removePrompt(state, pr.id);
    }
  }
  for (const pr of state.prompts) {
    if (pr.kind === "loot") pr.data.queue = (pr.data.queue as string[]).filter((id) => id !== p.id);
  }
  // "Morte": itens para o saque, mão e maldições descartadas
  const items = [...p.equipped, ...p.carried];
  p.equipped = [];
  p.carried = [];
  for (const c of [...p.hand]) discardFromPlayer(state, p, c);
  for (const cu of [...p.curses]) removeCurse(state, p, cu.id);
  for (const pc of p.pendingCombatCurses.splice(0)) discardCard(state, pc.cardId);
  for (const m of p.ambush.splice(0)) discardCard(state, m);
  if (p.race) discardCard(state, p.race);
  for (const c of p.classes) discardCard(state, c);
  p.race = null;
  p.classes = [];
  for (const id of items) delete state.cards[id]?.artificeSecond;
  // Sai da mesa
  const idx = state.order.indexOf(p.id);
  state.order.splice(idx, 1);
  state.players = state.players.filter((x) => x.id !== p.id);
  state.leftPlayers = [...(state.leftPlayers ?? []), { id: p.id, name: p.name }];
  state.truces = (state.truces ?? []).filter((t) => t.by !== p.id && t.protects !== p.id);
  if (state.lastFaceUp?.ownerId === p.id) state.lastFaceUp = null;
  if (state.hostId === p.id) state.hostId = state.players.find((x) => !x.bot)?.id ?? state.players[0]?.id ?? state.hostId;
  if (items.length > 0 && state.players.length > 0) {
    const queue = [...state.players].sort((a, b) => b.level - a.level || a.seat - b.seat).map((x) => x.id);
    nextLoot(state, ctx, p.id, items, queue);
  } else {
    for (const id of items) discardCard(state, id);
  }
  // Fim de jogo?
  if (!state.players.some((x) => !x.bot)) {
    state.closed = true;
    state.phase = "FINISHED";
    log(state, ctx, "Todos os jogadores humanos desistiram. A sala foi encerrada.", "system");
    return;
  }
  if (state.players.length === 1) {
    state.winnerId = state.players[0].id;
    state.phase = "FINISHED";
    log(state, ctx, `🏆 ${state.players[0].name} venceu: é o último na mesa!`, "system");
    return;
  }
  if (state.phase === "SETUP") {
    if (state.players.every((x) => x.ready)) startPlaying(state, ctx);
    return;
  }
  // Ajusta a vez
  if (idx < state.currentIdx) state.currentIdx -= 1;
  if (wasCurrent) {
    let next = idx;
    if (next >= state.order.length) {
      next = 0;
      state.round += 1;
      log(state, ctx, `══ Rodada ${state.round} ══`, "system");
    }
    state.combat = null;
    beginTurn(state, ctx, state.order[next], 0);
  }
}
