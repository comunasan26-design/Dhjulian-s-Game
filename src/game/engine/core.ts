// Núcleo das regras: turnos, combate, fuga, Coisas Ruins, morte, recompensas e maldições.
import { ALL_CARDS, def, type CurseCard, type MonsterCard, type Slot } from "../catalog";
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
  hasCurse,
  isLegendaryItem,
  monsterDef,
  playerSide,
  slotOf,
  specialIds,
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
  inst,
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
  players: { id: string; name: string }[],
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

  const sono = p.curses.find((c) => c.defId === "curse.sono");
  if (sono && depth < state.players.length * 2) {
    sono.remaining = (sono.remaining ?? 1) - 1;
    if ((sono.remaining ?? 0) <= 0) removeCurse(state, p, sono.id);
    log(state, ctx, `💤 ${p.name} está sob Sono Encantado e pula o turno.`, "curse", p.id);
    advanceTurn(state, ctx, depth + 1);
    return;
  }
  if (hasCurse(p, "curse.divida") && p.hand.length > 0) {
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
    if (c.defId === "curse.sono") continue;
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
    mapa: false,
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
  if (d.id === "monster.basilisco") {
    const r = rollD6(state, fighter, ctx, "olhar do Basilisco");
    if (r.total <= 2) {
      cm.petrified = true;
      log(state, ctx, `${fighter.name} ficou meio petrificado (-5).`, "combat");
    }
  }
  if (d.id === "monster.ettin") {
    const r = rollD6(state, fighter, ctx, "cabeças do Ettin");
    if (r.total <= 2) {
      cm.ettinFight = true;
      log(state, ctx, "As cabeças do Ettin estão brigando (-6).", "combat");
    }
  }
  if (d.id === "monster.cogumelo" && state.players.length > 1) {
    combat.screamerFor = leftOf(state, combat.fighterId).id;
    log(state, ctx, `O Cogumelo grita! ${player(state, combat.screamerFor).name} pode pôr um monstro da mão no combate.`, "combat");
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
  if (specialIds(state, combat).has("monster.dragao-verde")) {
    if (h.equipped.some((id) => state.cards[id]?.defId === "item.amuleto-saude")) {
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

function clericOrPaladinOnSide(state: GameState, combat: CombatState): boolean {
  return playerSide(state, combat).some((id) => {
    const p = player(state, id);
    return hasClass(state, p, "clerigo") || hasClass(state, p, "paladino");
  });
}

export function endCombat(state: GameState, ctx: Ctx, result: "won" | "fled" | "lost" | "ended") {
  const combat = state.combat;
  if (!combat) return;
  const specials = specialIds(state, combat);
  if (result !== "won" && specials.has("monster.dragao-vermelho-anciao")) {
    const exclude = new Set([combat.fighterId, combat.helperId]);
    log(state, ctx, "🔥 O Dragão Vermelho Ancião incendeia a vila!", "combat");
    for (const p of state.players) if (!exclude.has(p.id)) loseLevels(state, p, 1, ctx, "vila incendiada");
  }
  const clericPal = clericOrPaladinOnSide(state, combat);
  const toTop: string[] = [];
  for (const cm of combat.monsters) {
    const d = monsterDef(state, cm);
    if ((result === "fled" || result === "lost") && d.id === "monster.zumbi" && !cm.ignoreSpecial && !cm.defeated) {
      toTop.push(cm.cardId);
      log(state, ctx, "🧟 O Zumbi Lerdo não desiste: voltou ao topo do baralho de Portas.", "combat");
    } else if (result === "won" && d.id === "monster.lich" && !cm.ignoreSpecial && !clericPal) {
      toTop.push(cm.cardId);
      log(state, ctx, "☠️ A filactéria do Lich o trouxe de volta ao topo do baralho de Portas!", "combat");
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
  const specials = specialIds(state, combat);
  const beaten = combat.monsters;
  const fighterLevelBefore = fighter.level;
  let levels = 0;
  let treasures = 0;
  const elmo = fighter.equipped.some((id) => state.cards[id]?.defId === "item.elmo-olho");
  for (const cm of beaten) {
    const d = monsterDef(state, cm);
    levels += d.levels;
    let t = d.treasures;
    if (cm.wandering && elmo && cm.addedBy !== fighter.id) t = Math.floor(t / 2);
    treasures += t;
  }
  if (combat.desafio) levels *= 2;
  log(
    state,
    ctx,
    `🏅 ${fighter.name}${helper ? ` e ${helper.name}` : ""} derrotaram ${beaten.map((m) => nameOf(state, m.cardId)).join(" + ")}!`,
    "combat",
  );
  if (side.some((p) => hasClass(state, p, "patrulheiro")) && beaten.some((m) => {
    const t = monsterDef(state, m).tags;
    return t.includes("animal") || t.includes("voador");
  }))
    treasures += 1;
  if (combat.mapa) treasures += 2;
  if (hasCurse(fighter, "curse.sombra")) treasures -= 1;
  if (hasCurse(fighter, "curse.riqueza")) treasures = Math.floor(treasures / 2);
  treasures = Math.max(0, treasures);
  const bardo = hasClass(state, fighter, "bardo");
  if (bardo) treasures += 1;

  if (hasCurse(fighter, "curse.marca") && beaten.some((m) => monsterDef(state, m).level >= 20)) {
    const mk = fighter.curses.find((c) => c.defId === "curse.marca")!;
    removeCurse(state, fighter, mk.id);
    log(state, ctx, `A Marca do Caçador sumiu de ${fighter.name}.`, "curse");
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
    if (p.equipped.some((id) => state.cards[id]?.defId === "item.espada-vorpal")) {
      const r = rollD6(state, p, ctx, "Espada Vorpal");
      if (r.total >= 6) gainLevels(state, p, 1, ctx, true, "Espada Vorpal cortou a cabeça");
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
  if (specials.has("monster.senhor-mumias")) {
    for (const p of side) {
      if (p.equipped.length === 0) continue;
      const c = pickRandom(p.equipped, ctx);
      log(state, ctx, `Maldição do faraó: ${p.name} perdeu ${nameOf(state, c)}.`, "combat");
      discardFromPlayer(state, p, c);
    }
  }
  if (specials.has("monster.balor")) {
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
  const tarrasque = beaten.some((m) => inst(state, m.cardId).defId === "monster.tarrasque");
  const deal = combat.helperForced ? null : combat.helperDeal;
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
    helperExtra: tarrasque && helper ? 1 : 0,
  };
  if (helper && tarrasque) {
    const got = drawTo(state, helper, "treasure", 1, ctx);
    if (got.length) log(state, ctx, `${helper.name} comprou 1 tesouro extra (Tarrasque).`);
  }
  continueReward(state, ctx);
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
  const specials = specialIds(state, combat);
  const results: NonNullable<CombatState["flee"]>["results"] = [];
  for (const pid of participants) {
    const p = player(state, pid);
    for (const cm of activeMonsters(combat)) {
      const d = monsterDef(state, cm);
      if (pid !== combat.fighterId && specials.has("monster.medusa") && d.id === "monster.medusa") {
        results.push({ playerId: pid, monsterCardId: cm.cardId, roll: 0, bonus: 0, success: false, note: "Medusa: o ajudante também sofre" });
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
      if (success && p.equipped.some((id) => state.cards[id]?.defId === "item.mula")) {
        const m = rollD6(state, p, ctx, "Mula Teimosa");
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
      for (const r of state.cards[id]?.runes ?? []) if (state.cards[r]?.defId === "rune.sangue") blood++;
    if (blood) loseLevels(state, target, blood, ctx, "Runa do Sangue");
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
  if (c.defId === "item.calcas-dignidade") return true;
  if (d) {
    if (c.defId === "item.calcas-antichamas" && d.tags.includes("fogo")) return true;
    if (d.acidRust && c.defId === "item.grevas-mithral") return true;
    if (d.acidRust && (c.runes ?? []).some((r) => state.cards[r]?.defId === "rune.pedra")) return true;
  }
  if (slotOf(state, cardId) === "head" && p.equipped.some((id) => state.cards[id]?.defId === "item.escudo-torre")) return true;
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
  if (!d.legendary && d.tags.includes("fogo") && target.equipped.some((id) => state.cards[id]?.defId === "item.armadura-dragao"))
    return immune("Armadura de Escamas de Dragão Vermelho");
  if (d.poison && target.equipped.some((id) => state.cards[id]?.defId === "item.amuleto-saude"))
    return immune("Amuleto da Saúde");

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
        if (target.equipped.some((id) => state.cards[id]?.defId === "item.anel-regeneracao") && target.usage["regen"] !== state.round) {
          target.usage["regen"] = state.round;
          n = Math.max(0, n - 1);
          log(state, ctx, `💍 Anel da Regeneração: ${target.name} perde 1 nível a menos.`);
        }
        loseLevels(state, target, n, ctx, d.name, { corpoSeco: d.id === "monster.corpo-seco" });
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
  if (state.combat && specialIds(state, state.combat).has("monster.vampiro")) {
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
    if (items.length) log(state, ctx, `${items.length} item(ns) do corpo de ${player(state, deadId).name} foram descartados.`);
    return;
  }
  const [next, ...rest] = queue;
  createPrompt(state, ctx, "loot", next, { deadId, items, queue: rest });
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
    target.equipped.some((id) => state.cards[id]?.defId === "item.escudo-refletor") &&
    target.usage["refletor"] !== state.round
  ) {
    target.usage["refletor"] = state.round;
    log(state, ctx, `🪞 O Escudo Refletor de ${target.name} devolve ${label} para ${caster.name}!`, "curse");
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
  const ring = target.equipped.find((id) => state.cards[id]?.defId === "item.anel-protecao");
  if (ring) {
    state.cards[ring].defId = "item.anel-lata";
    log(state, ctx, `💍 O Anel de Proteção de ${target.name} anulou ${label} e virou um Anel de Lata.`, "curse");
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
  const items = p.equipped.filter((id) => slotOf(state, id) === slot && state.cards[id]?.defId !== "item.calcas-dignidade");
  if (items.length === 0) {
    log(state, ctx, `${p.name} não tinha nada nesse slot.`, "curse");
    return;
  }
  for (const id of items) {
    log(state, ctx, `${p.name} perdeu ${nameOf(state, id)}.`, "curse");
    discardFromPlayer(state, p, id);
  }
}

export function applyCurse(state: GameState, ctx: Ctx, cardId: string, target: PlayerState, caster: PlayerState | null) {
  const d = defOf(state, cardId) as CurseCard;
  const bruxo = !!caster && hasClass(state, caster, "bruxo");
  const keepCard = d.curseType === "duration" || d.curseType === "persistent";
  switch (d.id) {
    case "curse.azar":
      loseLevels(state, target, 1, ctx, d.name);
      break;
    case "curse.lich":
      loseLevels(state, target, target.level >= 15 ? 3 : 2, ctx, d.name);
      break;
    case "curse.vento":
      loseSlotByCurse(state, ctx, target, "head");
      break;
    case "curse.ferrugem":
      loseSlotByCurse(state, ctx, target, "chest");
      break;
    case "curse.calcas":
      loseSlotByCurse(state, ctx, target, "legs");
      break;
    case "curse.botas":
      loseSlotByCurse(state, ctx, target, "feet");
      break;
    case "curse.montaria":
      loseSlotByCurse(state, ctx, target, "mount");
      break;
    case "curse.dedos": {
      const rings = target.equipped.filter((id) => slotOf(state, id) === "ring");
      if (rings.length <= 2 || !caster || caster.id === target.id) {
        const lose = rings.length <= 2 ? rings : shuffle([...rings], ctx).slice(0, 2);
        for (const id of lose) {
          log(state, ctx, `${target.name} perdeu ${nameOf(state, id)}.`, "curse");
          discardFromPlayer(state, target, id);
        }
      } else {
        createPrompt(state, ctx, "chooseLoss", caster.id, {
          victimId: target.id,
          candidates: rings,
          count: 2,
          reason: `Dedos Escorregadios: escolha 2 anéis de ${target.name}`,
        });
      }
      break;
    }
    case "curse.mimico": {
      const items = [...target.equipped].sort((a, b) => itemWorth(state, b) - itemWorth(state, a));
      if (items[0]) {
        log(state, ctx, `${target.name} perdeu ${nameOf(state, items[0])}.`, "curse");
        discardFromPlayer(state, target, items[0]);
      }
      break;
    }
    case "curse.mao-furada": {
      const cards = shuffle([...target.hand], ctx).slice(0, 2);
      for (const c of cards) discardFromPlayer(state, target, c);
      log(state, ctx, `${target.name} descartou ${cards.length} carta(s) da mão.`, "curse");
      break;
    }
    case "curse.impostos": {
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
    case "curse.troca": {
      const left = leftOf(state, target.id);
      if (left.id !== target.id) {
        createPrompt(state, ctx, "fairyCurse", left.id, { victimId: target.id });
      }
      break;
    }
    case "curse.amnesia":
      for (const c of [...target.classes]) discardCard(state, c);
      target.classes = [];
      target.artificeSlots = [];
      revalidateEquipment(state, ctx, target);
      log(state, ctx, `${target.name} esqueceu a própria classe.`, "curse");
      break;
    case "curse.identidade":
      if (target.race) discardCard(state, target.race);
      target.race = newCard(state, "race.humano", true);
      revalidateEquipment(state, ctx, target);
      log(state, ctx, `${target.name} agora é Humano.`, "curse");
      break;
    default:
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
        if (d.id !== "curse.sono" && isCurrent(state, target.id)) turns += 1;
        target.curses.push({ id: uid(state, "k"), defId: d.id, cardId, remaining: turns, casterId: caster?.id ?? null });
      } else if (d.curseType === "persistent") {
        target.curses.push({ id: uid(state, "k"), defId: d.id, cardId, casterId: caster?.id ?? null });
        onPersistentCurse(state, ctx, target, d.id);
      }
  }
  if (!keepCard) discardCard(state, cardId);
}

export function onPersistentCurse(state: GameState, ctx: Ctx, target: PlayerState, defId: string) {
  if (defId === "curse.espada") {
    // Libera uma mão
    while (handsUsed(state, target) > 2) {
      const handItems = target.equipped.filter((id) => slotOf(state, id) === "hand");
      if (!handItems.length) break;
      handItems.sort((a, b) => itemWorth(state, a) - itemWorth(state, b));
      removeFromPlayer(target, handItems[0]);
      target.carried.push(handItems[0]);
      log(state, ctx, `${target.name} teve que largar ${nameOf(state, handItems[0])} para segurar a Espada Amaldiçoada.`, "curse");
    }
  }
  if (defId === "curse.coroa-espinhos") {
    for (const id of [...target.equipped]) {
      if (isLegendaryItem(state, id)) {
        removeFromPlayer(target, id);
        target.hand.push(id);
        log(state, ctx, `${nameOf(state, id)} voltou para a mão de ${target.name} (Coroa de Espinhos).`, "curse");
      }
    }
  }
}

/** Efeito de uma maldição de combate no combate atual. */
export function applyCombatCurse(state: GameState, ctx: Ctx, cardId: string, target: PlayerState, casterId: string | null) {
  const combat = state.combat!;
  const d = defOf(state, cardId);
  switch (d.id) {
    case "curse.fraqueza":
      combat.playerMods.push({ id: uid(state, "m"), value: tier11(target) ? -5 : -3, by: casterId, label: `Fraqueza Súbita (${target.name})`, target: target.id });
      break;
    case "curse.chumbo":
      combat.cantFlee.push(target.id);
      break;
    case "curse.escuro":
      combat.monsterSideMods.push({ id: uid(state, "m"), value: 5, by: casterId, label: "Medo do Escuro" });
      break;
    case "curse.isolamento":
      combat.isolated.push(target.id);
      if (combat.fighterId === target.id && combat.helperId) removeHelper(state, ctx, "Isolamento");
      break;
    case "curse.silencio":
      combat.silenced.push(target.id);
      break;
    case "curse.horda": {
      for (let guard = 0; guard < 200; guard++) {
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
    case "curse.ilusao-traidora":
      if (combat.helperId) {
        combat.helperTraitor = true;
        log(state, ctx, `🌀 ${player(state, combat.helperId).name} passou para o lado do monstro!`, "curse");
      } else {
        combat.pendingTraitor = true;
      }
      break;
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
