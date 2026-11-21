// Despachante de ações dos jogadores + processamento de prazos.
import { CARD_DEFS, type CurseCard, fxOf, RULES } from "../catalog";
import {
  cardFx,
  combatHas,
  equippedFx,
  equippedFxAll,
  flag,
  hasCurseFx,
  heldFx,
  matchesWho,
  monsterFx,
  num,
  runeFx,
} from "./fx";
import { type AbilityKey, type Params, activateAbility } from "./abilities";
import {
  addMonster,
  applyAllBadStuff,
  badStuffVictims,
  castCurse,
  createPrompt,
  hasBlockingPrompts,
  maybeApplyBadStuff,
  onCombatChanged,
  removeCurse,
  removeMonster,
  requestEndTurn,
  resolveVictory,
  revalidateEquipment,
  startCombat,
  startFlee,
  startPlaying,
  freeTreasures,
  joinHelper,
  surrender,
} from "./core";
import { answerPrompt, type PromptAnswer, timeoutPrompt } from "./prompts";
import { type Ctx, type GameState, type HelpDeal, type PlayerState, TIMERS, fail } from "./state";
import {
  combatTags,
  computeCombat,
  equipCheck,
  playerSide,
  runeSockets,
  slotOf,
} from "./stats";
import {
  currentPlayer,
  defOf,
  discardCard,
  discardFromPlayer,
  drawCard,
  gainLevels,
  hasPassive,
  passiveFx,
  passiveFxSrc,
  scaled,
  isCurrent,
  itemDef,
  log,
  maxClasses,
  nameOf,
  player,
  removeFromPlayer,
  rollD6,
  uid,
} from "./util";

export type Action =
  | { type: "READY" }
  | { type: "START_NOW" }
  | { type: "KICK_DOOR" }
  | { type: "LOOK_FOR_TROUBLE"; cardId: string }
  | { type: "LOOT_ROOM" }
  | { type: "END_TURN" }
  | { type: "SKIP_AFK" }
  | { type: "EQUIP"; cardId: string }
  | { type: "UNEQUIP"; cardId: string }
  | { type: "PLACE"; cardId: string }
  | { type: "DISCARD"; cardId: string }
  | { type: "SELL"; cardIds: string[] }
  | { type: "PLAY_RACE"; cardId: string }
  | { type: "PLAY_CLASS"; cardId: string; replaceId?: string }
  | { type: "DISCARD_RACE" }
  | { type: "DISCARD_CLASS"; cardId: string }
  | { type: "SOCKET_RUNE"; runeId: string; itemId: string }
  | { type: "PLAY_CURSE"; cardId: string; targetId: string }
  | { type: "PLAY_LEVELUP"; cardId: string }
  | { type: "PLAY_MONSTER_BONUS"; cardId: string; monsterId: string }
  | { type: "PLAY_WANDERING"; cardId: string; monsterCardId: string; targetId?: string }
  | { type: "USE_CARD"; cardId: string; side?: "player" | "monster"; targetId?: string; monsterId?: string; index?: number }
  | { type: "TRADE"; toId: string; give: string[]; take: string[] }
  | { type: "KISS"; targetId: string; cardId: string }
  | { type: "ACCEPT_WISH" }
  | { type: "DISPENSE"; monsterId: string; discardId?: string }
  | { type: "SCREAMER_ADD"; monsterCardId: string }
  | { type: "CATADOR" }
  | { type: "OWL_PEEK" }
  | { type: "OWL_DECIDE"; bottom: boolean }
  | { type: "MEDALHAO"; targetId: string }
  | { type: "DISMISS_NOTICE"; id: string }
  | { type: "CHAT"; text: string }
  | { type: "ASK_HELP"; targetId: string; count: number; mode: HelpDeal["mode"] }
  | { type: "OFFER_HELP"; count: number; mode: HelpDeal["mode"] }
  | { type: "RESOLVE" }
  | { type: "PASS" }
  | { type: "FLEE" }
  | { type: "ACCEPT_BAD_STUFF" }
  | { type: "REROLL"; index: number; source: "dado" | "cajado"; cardId?: string }
  | { type: "WISH_RING" }
  | { type: "ARCO" }
  | { type: "SOPRO" }
  | { type: "ABILITY"; key: AbilityKey; discard: string[]; params: Params }
  | { type: "ANSWER"; promptId: string; answer: PromptAnswer }
  | { type: "THREATEN"; count: number }
  | { type: "SURRENDER" }
  | { type: "TICK" };

// ============================================================================
// Prazos
// ============================================================================

export function tick(state: GameState, ctx: Ctx): boolean {
  let changed = false;
  for (let guard = 0; guard < 60; guard++) {
    const expired = state.prompts.find((p) => p.deadline <= ctx.now);
    if (!expired) break;
    timeoutPrompt(state, ctx, expired);
    changed = true;
  }
  const c = state.combat;
  if (c && c.stage === "resolving" && c.resolveDeadline !== null && c.resolveDeadline <= ctx.now) {
    const calc = computeCombat(state);
    if (calc?.winning) resolveVictory(state, ctx);
    else {
      c.stage = "fight";
      c.resolveDeadline = null;
    }
    changed = true;
  }
  const c2 = state.combat;
  if (c2 && c2.stage === "badstuff" && c2.flee && c2.flee.deadline <= ctx.now) {
    applyAllBadStuff(state, ctx);
    changed = true;
  }
  return changed;
}

export function nextDeadline(state: GameState): number | null {
  const ds: number[] = state.prompts.map((p) => p.deadline);
  if (state.combat?.stage === "resolving" && state.combat.resolveDeadline) ds.push(state.combat.resolveDeadline);
  if (state.combat?.flee) ds.push(state.combat.flee.deadline);
  return ds.length ? Math.min(...ds) : null;
}

// ============================================================================
// Auxiliares de validação
// ============================================================================

function ownTurn(state: GameState, p: PlayerState) {
  if (state.phase !== "PLAYING") fail("A partida não está em andamento.");
  if (!isCurrent(state, p.id)) fail("Não é o seu turno.");
  if (state.turn.ending) fail("Seu turno está terminando: escolha as cartas da Caridade.");
}

/** No seu turno e fora de combate (ou na preparação). */
function manageWindow(state: GameState, p: PlayerState) {
  if (state.phase === "SETUP") return;
  ownTurn(state, p);
  if (state.combat) fail("Não dá para fazer isso durante um combate.");
}

function combatFor(state: GameState) {
  if (!state.combat) fail("Não há combate em andamento.");
  return state.combat;
}

/** Pode jogar cartas que afetam o combate atual? */
function canInterfere(state: GameState, p: PlayerState) {
  const combat = combatFor(state);
  if (combat.stage === "badstuff") fail("O combate já foi decidido.");
  if (combat.desafio && combat.fighterId !== p.id) fail("Desafio: ninguém mais pode jogar cartas neste combate.");
  const side = playerSide(state, combat);
  if (!side.includes(p.id) && combatHas(state, combat, "detectaMentiras") && p.curseCastRound === state.round)
    fail("Planetar: quem lançou maldição nesta rodada não pode ajudar nem atrapalhar.");
  return combat;
}

/** Quem aceitou suborno não pode atrapalhar o protegido nesta rodada. */
function truceBlocks(state: GameState, actor: PlayerState, targetId: string | null | undefined): boolean {
  return !!targetId && (state.truces ?? []).some((t) => t.by === actor.id && t.protects === targetId && t.round === state.round);
}

function assertMayHinder(state: GameState, actor: PlayerState, targetId: string | null | undefined) {
  if (truceBlocks(state, actor, targetId))
    fail("Você aceitou não atrapalhar esse jogador nesta rodada (foi pago pela ameaça).");
}

function inHand(p: PlayerState, cardId: string) {
  if (!p.hand.includes(cardId)) fail("Essa carta não está na sua mão.");
}

function handOrTable(p: PlayerState, cardId: string) {
  if (!p.hand.includes(cardId) && !p.carried.includes(cardId)) fail("Essa carta não está com você.");
}

function multiplier(state: GameState, p: PlayerState): number {
  return hasPassive(state, p, "pocoesDobradas") ? 2 : 1;
}

function allPassed(state: GameState, ctx: Ctx): boolean {
  const combat = state.combat!;
  const side = new Set(playerSide(state, combat));
  return state.players
    .filter((p) => !side.has(p.id) && !ctx.offline?.has(p.id))
    .every((p) => combat.passed.includes(p.id));
}

function canBeHelper(state: GameState, target: PlayerState): string | null {
  const combat = state.combat!;
  if (combat.helperId) return "Já existe um ajudante.";
  if (combat.isolated.includes(combat.fighterId)) return "Ninguém pode ajudar neste combate.";
  if (combat.desafio) return "Desafio: ninguém pode lutar junto.";
  if (target.id === combat.fighterId) return "Você não pode ajudar a si mesmo.";
  if (combatHas(state, combat, "detectaMentiras") && target.curseCastRound === state.round)
    return "Planetar: quem lançou maldição nesta rodada não pode ajudar.";
  return null;
}

function parseDeal(count: unknown, mode: unknown): HelpDeal {
  return {
    count: Math.max(0, Math.min(20, Math.floor(Number(count) || 0))),
    mode: mode === "fighter" || mode === "helper" ? mode : "random",
  };
}

// ============================================================================
// Despachante
// ============================================================================

export function applyAction(state: GameState, actorId: string, action: Action, ctx: Ctx) {
  tick(state, ctx);
  const p = player(state, actorId);
  if (state.phase === "FINISHED" && action.type !== "CHAT" && action.type !== "DISMISS_NOTICE" && action.type !== "TICK")
    fail("A partida terminou.");
  const before = combatKey(state);
  dispatch(state, p, action, ctx);
  // Qualquer ação que mude o combate durante a janela de ataque reinicia o prazo
  const c = state.combat;
  if (c && c.stage === "resolving" && before !== null && action.type !== "RESOLVE" && combatKey(state) !== before) {
    c.resolveDeadline = ctx.now + TIMERS.resolve;
    c.passed = [];
  }
  if (action.type !== "TICK" && action.type !== "CHAT") {
    state.lastActionAt = ctx.now;
    if (!p.bot) state.botNextAt = Math.max(state.botNextAt ?? 0, ctx.now + 1200);
  }
}

/** "Impressão digital" do combate (ignora prazo e quem já passou). */
function combatKey(state: GameState): string | null {
  const c = state.combat;
  if (!c) return null;
  const calc = computeCombat(state);
  return JSON.stringify([
    { ...c, resolveDeadline: null, passed: [], stage: null },
    calc ? [calc.playerTotal, calc.monsterTotal, calc.side, calc.monsterSide] : null,
  ]);
}

function dispatch(state: GameState, p: PlayerState, a: Action, ctx: Ctx) {
  switch (a.type) {
    case "TICK":
      return;
    case "CHAT": {
      const text = String(a.text ?? "").trim().slice(0, 300);
      if (!text) return;
      log(state, ctx, `${p.name}: ${text}`, "chat", p.id);
      return;
    }
    case "DISMISS_NOTICE":
      state.notices = state.notices.filter((n) => !(n.id === a.id && n.playerId === p.id));
      return;
    case "ANSWER":
      answerPrompt(state, ctx, p.id, a.promptId, a.answer ?? {});
      return;

    // ----------------------------------------------------------------- Preparação
    case "READY": {
      if (state.phase !== "SETUP") fail("A partida já começou.");
      p.ready = true;
      log(state, ctx, `${p.name} está pronto.`, "system");
      if (state.players.every((x) => x.ready)) startPlaying(state, ctx);
      return;
    }
    case "START_NOW": {
      if (state.phase !== "SETUP") fail("A partida já começou.");
      if (p.id !== state.hostId) fail("Só o anfitrião pode começar.");
      startPlaying(state, ctx);
      return;
    }

    // ----------------------------------------------------------------- Turno
    case "KICK_DOOR": {
      ownTurn(state, p);
      if (state.turnPhase !== "KICK") fail("Você já chutou a porta neste turno.");
      if (hasBlockingPrompts(state)) fail("Resolva as escolhas pendentes primeiro.");
      state.turn.owlStartDone = true;
      clearOwl(state, p);
      if (p.ambush.length > 0) {
        const m = p.ambush.shift()!;
        log(state, ctx, `🪞 Emboscada! ${p.name} encontra ${nameOf(state, m)} atrás da porta.`, "combat");
        startCombat(state, ctx, p.id, m);
        return;
      }
      const card = drawCard(state, "door", ctx);
      if (!card) fail("Não há mais cartas de Porta.");
      state.turn.revealed = card;
      const d = defOf(state, card);
      log(state, ctx, `🚪 ${p.name} chutou a porta: ${d.name}!`, "info", p.id);
      if (d.kind === "monster") {
        startCombat(state, ctx, p.id, card);
      } else if (d.kind === "curse") {
        state.turnPhase = "AFTER_DOOR";
        castCurse(state, ctx, card, null, p);
      } else {
        p.hand.push(card);
        state.turnPhase = "AFTER_DOOR";
      }
      return;
    }
    case "LOOK_FOR_TROUBLE": {
      ownTurn(state, p);
      if (state.turnPhase !== "AFTER_DOOR") fail("Agora não dá para procurar encrenca.");
      if (hasBlockingPrompts(state)) fail("Resolva as escolhas pendentes primeiro.");
      inHand(p, a.cardId);
      if (defOf(state, a.cardId).kind !== "monster") fail("Escolha um monstro da mão.");
      removeFromPlayer(p, a.cardId);
      log(state, ctx, `😤 ${p.name} foi procurar encrenca.`, "combat");
      startCombat(state, ctx, p.id, a.cardId);
      return;
    }
    case "LOOT_ROOM": {
      ownTurn(state, p);
      if (state.turnPhase !== "AFTER_DOOR") fail("Agora não dá para saquear.");
      lootRoom(state, ctx, p);
      return;
    }
    case "END_TURN": {
      ownTurn(state, p);
      if (state.combat) fail("Termine o combate primeiro.");
      if (state.reward) fail("Aguarde a divisão dos tesouros.");
      if (state.turnPhase === "KICK") fail("Chute a porta primeiro.");
      if (hasBlockingPrompts(state)) fail("Há escolhas pendentes; aguarde.");
      if (state.turn.ending) fail("Escolha as cartas da Caridade.");
      if (state.turnPhase === "AFTER_DOOR") lootRoom(state, ctx, p);
      clearOwl(state, p);
      requestEndTurn(state, ctx, p);
      return;
    }
    case "SKIP_AFK": {
      if (state.phase !== "PLAYING") fail("A partida não está em andamento.");
      const cur = currentPlayer(state);
      if (cur.id === p.id) fail("É o seu turno.");
      if (!ctx.offline?.has(cur.id)) fail(`${cur.name} está conectado.`);
      if (ctx.now - state.lastActionAt < TIMERS.afkSkip) fail("Aguarde um pouco antes de pular o jogador.");
      skipAfk(state, ctx, cur);
      return;
    }

    // ----------------------------------------------------------------- Itens
    case "EQUIP": {
      manageWindow(state, p);
      handOrTable(p, a.cardId);
      const res = equipCheck(state, p, a.cardId);
      if (res.error) fail(res.error);
      removeFromPlayer(p, a.cardId);
      p.equipped.push(a.cardId);
      if (res.asSecond) {
        state.cards[a.cardId].artificeSecond = true;
        const slot = slotOf(state, a.cardId);
        if (slot && !p.artificeSlots.includes(slot)) p.artificeSlots.push(slot);
      }
      log(state, ctx, `${p.name} equipou ${nameOf(state, a.cardId)}.`, "info", p.id);
      return;
    }
    case "UNEQUIP": {
      manageWindow(state, p);
      if (!p.equipped.includes(a.cardId)) fail("Esse item não está equipado.");
      removeFromPlayer(p, a.cardId);
      delete state.cards[a.cardId].artificeSecond;
      p.carried.push(a.cardId);
      return;
    }
    case "PLACE": {
      inHand(p, a.cardId);
      const d = defOf(state, a.cardId);
      if (!("price" in d) && !state.cards[a.cardId].tamed) fail("Só cartas de valor podem ir para a mesa.");
      removeFromPlayer(p, a.cardId);
      p.carried.push(a.cardId);
      return;
    }
    case "DISCARD": {
      handOrTable(p, a.cardId);
      discardFromPlayer(state, p, a.cardId);
      log(state, ctx, `${p.name} descartou ${nameOf(state, a.cardId)}.`, "info", p.id);
      return;
    }
    case "SELL": {
      ownTurn(state, p);
      if (state.combat) fail("Não dá para vender durante um combate.");
      if (hasCurseFx(p, "naoPodeNegociar")) fail("Uma maldição impede você de vender itens.");
      const ids = [...new Set(a.cardIds ?? [])];
      if (ids.length === 0) fail("Escolha itens para vender.");
      let gold = 0;
      for (const id of ids) {
        if (!p.hand.includes(id) && !p.carried.includes(id) && !p.equipped.includes(id)) fail("Item inválido.");
        const d = defOf(state, id);
        if (!("price" in d)) fail(`${d.name} não pode ser vendido.`);
        gold += d.price;
        for (const r of state.cards[id].runes ?? []) {
          const rd = defOf(state, r);
          if ("price" in rd) gold += rd.price;
        }
      }
      for (const id of [...p.carried, ...p.equipped]) {
        const fx = cardFx(state, id, "vendaMultiplicador");
        if (fx) gold = Math.floor(gold * num(fx, "valor", 1));
      }
      const levels = Math.floor(gold / RULES.ouroPorNivel);
      for (const id of ids) discardFromPlayer(state, p, id);
      log(state, ctx, `💰 ${p.name} vendeu ${ids.length} item(ns) por ${gold} de ouro.`, "info", p.id);
      if (levels > 0) gainLevels(state, p, levels, ctx, false, "venda de itens");
      return;
    }
    case "PLAY_RACE": {
      manageWindow(state, p);
      inHand(p, a.cardId);
      if (defOf(state, a.cardId).kind !== "race") fail("Isso não é uma carta de raça.");
      removeFromPlayer(p, a.cardId);
      if (p.race) discardCard(state, p.race);
      p.race = a.cardId;
      revalidateEquipment(state, ctx, p);
      log(state, ctx, `${p.name} agora é ${nameOf(state, a.cardId)}.`, "info", p.id);
      return;
    }
    case "PLAY_CLASS": {
      manageWindow(state, p);
      inHand(p, a.cardId);
      const d = defOf(state, a.cardId);
      if (d.kind !== "class") fail("Isso não é uma carta de classe.");
      if (p.classes.some((c) => state.cards[c]?.defId === d.id)) fail("Você já tem essa classe.");
      removeFromPlayer(p, a.cardId);
      if (p.classes.length >= maxClasses(state, p)) {
        const replace = a.replaceId && p.classes.includes(a.replaceId) ? a.replaceId : p.classes[0];
        p.classes = p.classes.filter((c) => c !== replace);
        discardCard(state, replace);
      }
      p.classes.push(a.cardId);
      revalidateEquipment(state, ctx, p);
      log(state, ctx, `${p.name} agora é ${d.name}.`, "info", p.id);
      return;
    }
    case "DISCARD_RACE": {
      if (!p.race) fail("Você não tem raça.");
      discardCard(state, p.race);
      p.race = null;
      revalidateEquipment(state, ctx, p);
      log(state, ctx, `${p.name} descartou a própria raça.`, "info", p.id);
      return;
    }
    case "DISCARD_CLASS": {
      if (!p.classes.includes(a.cardId)) fail("Classe inválida.");
      p.classes = p.classes.filter((c) => c !== a.cardId);
      discardCard(state, a.cardId);
      revalidateEquipment(state, ctx, p);
      log(state, ctx, `${p.name} descartou a classe ${nameOf(state, a.cardId)}.`, "info", p.id);
      return;
    }
    case "SOCKET_RUNE": {
      manageWindow(state, p);
      handOrTable(p, a.runeId);
      if (defOf(state, a.runeId).kind !== "rune") fail("Isso não é uma runa.");
      if (!p.equipped.includes(a.itemId) || !itemDef(state, a.itemId)) fail("A runa precisa ir num item equipado.");
      const c = state.cards[a.itemId];
      const used = (c.runes ?? []).length;
      if (used >= runeSockets(state, p, a.itemId)) fail("Esse item não tem encaixe livre.");
      removeFromPlayer(p, a.runeId);
      c.runes = [...(c.runes ?? []), a.runeId];
      log(state, ctx, `${p.name} engastou ${nameOf(state, a.runeId)} em ${nameOf(state, a.itemId)}.`, "info", p.id);
      return;
    }

    // ----------------------------------------------------------------- Cartas a qualquer momento
    case "PLAY_CURSE": {
      if (state.phase !== "PLAYING") fail("A partida não está em andamento.");
      inHand(p, a.cardId);
      const d = defOf(state, a.cardId);
      if (d.kind !== "curse") fail("Isso não é uma maldição.");
      const target = player(state, a.targetId);
      const combat = state.combat;
      assertMayHinder(state, p, target.id);
      if (combat && (target.id === combat.helperId || (d as CurseCard).curseType === "combat")) assertMayHinder(state, p, combat.fighterId);
      if (combat && combat.desafio && p.id !== combat.fighterId && (target.id === combat.fighterId || (d as CurseCard).curseType === "combat"))
        fail("Desafio: ninguém mais pode jogar cartas neste combate.");
      if (combat && (target.id === combat.fighterId || target.id === combat.helperId)) {
        const side = playerSide(state, combat);
        if (!side.includes(p.id) && combatHas(state, combat, "detectaMentiras") && p.curseCastRound === state.round)
          fail("Planetar: quem lançou maldição nesta rodada não pode atrapalhar.");
      }
      removeFromPlayer(p, a.cardId);
      castCurse(state, ctx, a.cardId, p, target);
      return;
    }
    case "PLAY_LEVELUP": {
      if (state.phase !== "PLAYING") fail("A partida não está em andamento.");
      inHand(p, a.cardId);
      if (defOf(state, a.cardId).kind !== "levelup") fail("Isso não é uma carta de subir nível.");
      if (p.level >= RULES.nivelMaximo - 1) fail(`Cartas de subir nível nunca levam ao nível ${RULES.nivelMaximo}.`);
      discardFromPlayer(state, p, a.cardId);
      gainLevels(state, p, 1, ctx, false, nameOf(state, a.cardId));
      return;
    }
    case "PLAY_MONSTER_BONUS": {
      const combat = canInterfere(state, p);
      inHand(p, a.cardId);
      const d = defOf(state, a.cardId);
      if (d.kind !== "monsterBonus") fail("Isso não é um bônus de monstro.");
      const cm = combat.monsters.find((m) => m.cardId === a.monsterId && !m.defeated);
      if (!cm) fail("Monstro inválido.");
      let value = d.value;
      if (
        value > 0 &&
        !combat.oniDoubled &&
        !cm.ignoreSpecial &&
        monsterFx(state, cm, "dobraPrimeiroBonus").length > 0
      ) {
        combat.oniDoubled = true;
        value *= 2;
        log(state, ctx, "O Oni dobra o primeiro bônus jogado a favor dele!", "combat");
      }
      if (value > 0) assertMayHinder(state, p, combat.fighterId);
      cm.mods.push({ id: uid(state, "m"), value, by: p.id, label: d.name });
      discardFromPlayer(state, p, a.cardId);
      log(state, ctx, `${p.name} jogou ${d.name} (${value > 0 ? "+" : ""}${value}) em ${nameOf(state, cm.cardId)}.`, "combat", p.id);
      onCombatChanged(state, ctx);
      return;
    }
    case "PLAY_WANDERING": {
      if (!state.combat) {
        playWanderingOutside(state, ctx, p, a);
        return;
      }
      const combat = canInterfere(state, p);
      inHand(p, a.cardId);
      inHand(p, a.monsterCardId);
      if (defOf(state, a.cardId).kind !== "wandering") fail("Use uma carta de Monstro Errante.");
      if (defOf(state, a.monsterCardId).kind !== "monster") fail("Escolha um monstro da mão.");
      const fighter = player(state, combat.fighterId);
      assertMayHinder(state, p, fighter.id);
      const block = equippedFx(state, fighter, "bloqueiaErrantes");
      if (block) fail(`${nameOf(state, block.cardId)}: ninguém pode jogar Monstros Errantes neste combate.`);
      discardFromPlayer(state, p, a.cardId);
      removeFromPlayer(p, a.monsterCardId);
      addMonster(state, ctx, a.monsterCardId, { wandering: true, addedBy: p.id });
      return;
    }
    case "SCREAMER_ADD": {
      const combat = combatFor(state);
      if (combat.screamerFor !== p.id) fail("O grito não é para você.");
      assertMayHinder(state, p, combat.fighterId);
      inHand(p, a.monsterCardId);
      if (defOf(state, a.monsterCardId).kind !== "monster") fail("Escolha um monstro da mão.");
      combat.screamerFor = null;
      removeFromPlayer(p, a.monsterCardId);
      addMonster(state, ctx, a.monsterCardId, { wandering: true, addedBy: p.id });
      return;
    }
    case "USE_CARD":
      playConsumable(state, ctx, p, a);
      return;
    case "KISS": {
      if (state.phase !== "PLAYING") fail("A partida não está em andamento.");
      const target = player(state, a.targetId);
      if (target.id === p.id) fail("Você não pode se beijar.");
      const sapo = target.curses.find((c) => fxOf(c.defId).some((f) => f.tipo === "acabaComBeijo"));
      if (!sapo) fail(`${target.name} não tem uma maldição que acaba com um beijo.`);
      inHand(p, a.cardId);
      discardFromPlayer(state, p, a.cardId);
      removeCurse(state, target, sapo.id);
      log(state, ctx, `💋 ${p.name} beijou ${target.name}, que voltou ao normal!`, "curse");
      return;
    }
    case "TRADE": {
      if (state.combat) fail("Não dá para trocar durante um combate.");
      const to = player(state, a.toId);
      if (to.id === p.id) fail("Escolha outro jogador.");
      if (hasCurseFx(p, "naoPodeNegociar") || hasCurseFx(to, "naoPodeNegociar")) fail("Uma maldição impede essa troca.");
      const give = [...new Set(a.give ?? [])];
      const take = [...new Set(a.take ?? [])];
      if (give.length + take.length === 0) fail("Escolha itens para a troca.");
      for (const id of give) if (!p.equipped.includes(id) && !p.carried.includes(id)) fail("Só itens na mesa podem ser trocados.");
      for (const id of take) if (!to.equipped.includes(id) && !to.carried.includes(id)) fail("Item inválido do outro jogador.");
      for (const id of [...give, ...take])
        if (runeFx(state, id, "naoRoubavel").length > 0) fail(`${nameOf(state, id)} tem uma runa que impede trocas.`);
      createPrompt(state, ctx, "trade", to.id, { fromId: p.id, give, take }, { blocking: false });
      log(state, ctx, `${p.name} propôs uma troca para ${to.name}.`);
      return;
    }

    // ----------------------------------------------------------------- Combate
    case "ASK_HELP": {
      const combat = combatFor(state);
      if (combat.fighterId !== p.id) fail("Só quem luta pode pedir ajuda.");
      if (combat.stage === "badstuff") fail("O combate já foi decidido.");
      if (combatHas(state, combat, "semPedirAjuda")) fail("Este monstro não deixa você pedir ajuda (mas outros podem se oferecer).");
      const target = player(state, a.targetId);
      const err = canBeHelper(state, target);
      if (err) fail(err);
      if (state.prompts.some((x) => x.kind === "helpRequest" && x.playerId === target.id)) fail("Já existe um pedido para esse jogador.");
      const deal = parseDeal(a.count, a.mode);
      createPrompt(state, ctx, "helpRequest", target.id, { fighterId: p.id, deal, threat: false, combatId: combat.id });
      log(state, ctx, `🙏 ${p.name} pediu ajuda a ${target.name}.`, "combat");
      return;
    }
    case "OFFER_HELP": {
      const combat = combatFor(state);
      if (combat.stage === "badstuff") fail("O combate já foi decidido.");
      const err = canBeHelper(state, p);
      if (err) fail(err);
      if (state.prompts.some((x) => x.kind === "helpOffer" && x.data.helperId === p.id)) fail("Você já ofereceu ajuda.");
      const deal = parseDeal(a.count, a.mode);
      createPrompt(state, ctx, "helpOffer", combat.fighterId, { helperId: p.id, deal, combatId: combat.id });
      log(state, ctx, `🤚 ${p.name} ofereceu ajuda.`, "combat");
      return;
    }
    case "RESOLVE": {
      const combat = combatFor(state);
      if (combat.fighterId !== p.id) fail("Só quem luta pode atacar.");
      if (combat.stage !== "fight") fail("O combate já está sendo resolvido.");
      const calc = computeCombat(state)!;
      if (!calc.winning) fail("Você ainda não está vencendo.");
      combat.stage = "resolving";
      combat.resolveDeadline = ctx.now + TIMERS.resolve;
      combat.passed = [];
      log(state, ctx, `⚔️ ${p.name} vai atacar! Últimos segundos para jogar cartas.`, "combat");
      if (allPassed(state, ctx)) resolveVictory(state, ctx);
      return;
    }
    case "PASS": {
      const combat = combatFor(state);
      if (combat.stage !== "resolving") fail("Nada para passar agora.");
      if (playerSide(state, combat).includes(p.id)) fail("Você está no combate.");
      if (!combat.passed.includes(p.id)) combat.passed.push(p.id);
      if (allPassed(state, ctx)) resolveVictory(state, ctx);
      return;
    }
    case "FLEE": {
      const combat = combatFor(state);
      if (combat.fighterId !== p.id) fail("Só quem luta decide fugir.");
      if (combat.stage === "badstuff") fail("A fuga já foi rolada.");
      startFlee(state, ctx);
      return;
    }
    case "ACCEPT_BAD_STUFF": {
      const combat = combatFor(state);
      if (!combat.flee) fail("Nada para aceitar.");
      if (!badStuffVictims(state).includes(p.id)) fail("Você não vai sofrer Coisas Ruins.");
      if (!combat.flee.confirmed.includes(p.id)) combat.flee.confirmed.push(p.id);
      maybeApplyBadStuff(state, ctx);
      return;
    }
    case "REROLL": {
      const combat = combatFor(state);
      const flee = combat.flee;
      if (!flee) fail("Nada para rerrolar.");
      const r = flee.results[a.index];
      if (!r || r.playerId !== p.id) fail("Escolha uma rolagem sua.");
      if (r.success || r.roll === 0) fail("Essa rolagem não pode ser refeita.");
      if (a.source === "cajado") {
        if (!equippedFx(state, p, "rerrolarFuga")) fail("Você não tem um item equipado que refaz a fuga.");
        if (combat.rerolled.includes(`${p.id}:cajado`)) fail("Esse item já foi usado neste combate.");
        combat.rerolled.push(`${p.id}:cajado`);
      } else {
        const card = a.cardId ?? heldFx(state, p, "rerrolarFuga")?.cardId;
        if (!card || !(p.hand.includes(card) || p.carried.includes(card)) || !cardFx(state, card, "rerrolarFuga"))
          fail("Você não tem uma carta que refaz a fuga.");
        discardFromPlayer(state, p, card);
      }
      const roll = rollD6(state, p, ctx, `nova rolagem para fugir de ${nameOf(state, r.monsterCardId)}`);
      r.roll = roll.total;
      r.success = roll.total + r.bonus >= RULES.fugirCom;
      r.note = r.success ? "rerrolado" : "rerrolado, falhou de novo";
      log(state, ctx, r.success ? `🏃 ${p.name} conseguiu fugir na nova rolagem!` : `❌ Falhou de novo.`, "combat");
      maybeApplyBadStuff(state, ctx);
      return;
    }
    case "WISH_RING": {
      const combat = combatFor(state);
      if (!combat.flee) fail("Use quando for sofrer Coisas Ruins.");
      const wish = equippedFx(state, p, "desejos");
      if (!wish) fail("Você não tem um item de desejos equipado.");
      const ring = wish.cardId;
      const mine = combat.flee.results.filter((r) => r.playerId === p.id && !r.success);
      if (mine.length === 0) fail("Você não vai sofrer Coisas Ruins.");
      const c = state.cards[ring];
      c.charges = (c.charges ?? num(wish.fx, "cargas", 3)) - 1;
      for (const r of mine) {
        r.success = true;
        r.note = "Anel dos Três Desejos";
      }
      log(state, ctx, `💍 ${p.name} gastou um desejo e anulou as Coisas Ruins! (${c.charges} carga(s) restante(s))`, "combat");
      if (c.charges <= 0) {
        const into = `item.${String(wish.fx.viraEm ?? "")}`;
        delete c.charges;
        if (CARD_DEFS[into]) {
          c.defId = into;
          log(state, ctx, `O item virou ${CARD_DEFS[into].name}.`);
        }
      }
      maybeApplyBadStuff(state, ctx);
      return;
    }
    case "ARCO": {
      const combat = canInterfere(state, p);
      const bowFx = equippedFxAll(state, p, "atirarDeLonge").find(({ fx }) => matchesWho(state, p, fx));
      if (!bowFx) fail("Você não tem um item para atirar de longe (ou sua raça não pode usá-lo assim).");
      const bow = bowFx.cardId;
      if (playerSide(state, combat).includes(p.id)) fail("Você já está no combate.");
      if (combat.bowUsedBy.includes(p.id)) fail("Você já atirou neste combate.");
      combat.bowUsedBy.push(p.id);
      combat.playerMods.push({ id: uid(state, "m"), value: itemDef(state, bow)!.bonus, by: p.id, label: `${nameOf(state, bow)} (${p.name})` });
      log(state, ctx, `🏹 ${p.name} atirou de longe com ${nameOf(state, bow)}!`, "combat");
      onCombatChanged(state, ctx);
      return;
    }
    case "SOPRO": {
      const combat = combatFor(state);
      if (combat.stage === "badstuff") fail("O combate já foi decidido.");
      if (!playerSide(state, combat).includes(p.id)) fail("Você precisa estar no combate.");
      const breath = equippedFx(state, p, "sopro");
      if (!breath) fail("Você não tem um item que sopra fogo.");
      if (combat.breathUsedBy.includes(p.id)) fail("Já soprou neste combate.");
      combat.breathUsedBy.push(p.id);
      combat.playerMods.push({ id: uid(state, "m"), value: num(breath.fx, "valor", 3), by: p.id, label: `Sopro: ${nameOf(state, breath.cardId)} (${p.name})`, fire: true });
      log(state, ctx, `🐲 ${nameOf(state, breath.cardId)} soprou fogo!`, "combat");
      onCombatChanged(state, ctx);
      return;
    }
    case "ACCEPT_WISH": {
      const combat = combatFor(state);
      if (combat.fighterId !== p.id) fail("Só quem luta pode aceitar o desejo.");
      if (!combatHas(state, combat, "desejo")) fail("Nenhum monstro está oferecendo um desejo.");
      if (combat.glabrezuAccepted) fail("Você já aceitou o desejo.");
      if (combat.stage !== "fight") fail("Tarde demais para desejos.");
      combat.glabrezuAccepted = true;
      gainLevels(state, p, 1, ctx, false, "desejo do Glabrezu");
      log(state, ctx, "😈 O monstro sorri: o desejo tem um preço.", "combat");
      onCombatChanged(state, ctx);
      return;
    }
    case "DISPENSE":
      dispense(state, ctx, p, a.monsterId, a.discardId);
      return;
    case "CATADOR": {
      const scav = passiveFx(state, p, "catador")[0];
      if (!scav) fail("Você não tem a passiva de catar itens.");
      const li = state.lastItemDiscard;
      if (!li || !state.decks.treasureDiscard.includes(li.cardId)) fail("Não há item para catar.");
      if (li.by === p.id) fail("O item foi descartado por você.");
      if (li.tried.includes(p.id)) fail("Você já tentou catar esse item.");
      if (p.usage["catador"] === state.round) fail("Catador: 1x por rodada.");
      p.usage["catador"] = state.round;
      li.tried.push(p.id);
      const r = rollD6(state, p, ctx, `Catador (${nameOf(state, li.cardId)})`);
      if (r.total >= scaled(scav, "dado", p.level, 5)) {
        state.decks.treasureDiscard.splice(state.decks.treasureDiscard.indexOf(li.cardId), 1);
        p.carried.push(li.cardId);
        log(state, ctx, `👺 ${p.name} catou ${nameOf(state, li.cardId)}!`);
        state.lastItemDiscard = null;
      }
      return;
    }
    case "OWL_PEEK": {
      ownTurn(state, p);
      if (!hasPassive(state, p, "olhosDaNoite")) fail("Você não tem a passiva de ver a carta do topo.");
      const start = state.turnPhase === "KICK" && !state.turn.owlStartDone && !state.turn.revealed;
      const end = state.turnPhase === "END" && !state.turn.owlEndDone && !state.combat;
      if (!start && !end) fail("Olhos da Noite: só no início e no fim do seu turno.");
      if (start) state.turn.owlStartDone = true;
      else state.turn.owlEndDone = true;
      const top = state.decks.door[0];
      if (!top) fail("O baralho de Portas está vazio.");
      p.owlPeek = top;
      state.notices.push({ id: uid(state, "n"), playerId: p.id, text: "Olhos da Noite: carta do topo de Portas.", cards: [top], kind: "owl" });
      return;
    }
    case "OWL_DECIDE": {
      if (!p.owlPeek) fail("Nada para decidir.");
      if (a.bottom && state.decks.door[0] === p.owlPeek) {
        state.decks.door.push(state.decks.door.shift()!);
        log(state, ctx, `🦉 ${p.name} mandou a carta do topo de Portas para o fundo.`);
      }
      clearOwl(state, p);
      return;
    }
    case "MEDALHAO": {
      if (!equippedFx(state, p, "verMao")) fail("Você não tem um item que lê pensamentos.");
      if (p.usage["medalhao"] === state.round) fail("Medalhão: 1x por rodada.");
      const target = player(state, a.targetId);
      if (target.id === p.id) fail("Escolha outro jogador.");
      p.usage["medalhao"] = state.round;
      state.notices.push({ id: uid(state, "n"), playerId: p.id, text: `Mão de ${target.name}:`, cards: [...target.hand] });
      log(state, ctx, `🔮 ${p.name} leu os pensamentos de ${target.name}.`);
      return;
    }
    case "THREATEN": {
      const combat = combatFor(state);
      if (combat.stage === "badstuff") fail("O combate já foi decidido.");
      if (combat.desafio) fail("Desafio: ninguém mais pode jogar neste combate.");
      if (playerSide(state, combat).includes(p.id)) fail("Você está no combate.");
      if (truceBlocks(state, p, combat.fighterId)) fail("Você já tem um acordo com esse jogador nesta rodada.");
      if (combat.used.includes(`${p.id}:threat`)) fail("Você já fez uma ameaça neste combate.");
      const free = freeTreasures(state, combat);
      if (free <= 0) fail(`${player(state, combat.fighterId).name} não vai ganhar mais tesouros neste combate: não há o que pedir.`);
      const count = Math.floor(Number(a.count) || 0);
      if (count < 1 || count > free) fail(`Você pode pedir de 1 a ${free} tesouro(s).`);
      combat.used.push(`${p.id}:threat`);
      createPrompt(state, ctx, "threat", combat.fighterId, { threatenerId: p.id, count, combatId: combat.id }, { blocking: false, ms: TIMERS.help });
      log(state, ctx, `😈 ${p.name} ameaça atrapalhar ${player(state, combat.fighterId).name} se não receber ${count} tesouro(s).`, "combat", p.id);
      return;
    }
    case "SURRENDER":
      surrender(state, ctx, p);
      return;
    case "ABILITY": {
      const params = a.params ?? {};
      if (state.combat && params.side === "monster") assertMayHinder(state, p, state.combat.fighterId);
      if (["maldicaoSombria", "roubo", "truqueFeerico", "mordida", "pactoDiabolico"].includes(a.key) && typeof params.player === "string")
        assertMayHinder(state, p, params.player);
    }
      activateAbility(state, ctx, p, a.key, Array.isArray(a.discard) ? a.discard : [], a.params ?? {});
      return;
    default:
      fail("Ação desconhecida.");
  }
}

/**
 * Monstro Errante fora de combate:
 * - em você mesmo (no seu turno, depois de abrir a porta): luta agora com o monstro da mão (a seu favor);
 * - em outro jogador: o monstro fica de tocaia e ele o enfrenta ao chutar a próxima porta.
 */
function playWanderingOutside(state: GameState, ctx: Ctx, p: PlayerState, a: Extract<Action, { type: "PLAY_WANDERING" }>) {
  if (state.phase !== "PLAYING") fail("A partida não está em andamento.");
  inHand(p, a.cardId);
  inHand(p, a.monsterCardId);
  if (defOf(state, a.cardId).kind !== "wandering") fail("Use uma carta de Monstro Errante.");
  if (defOf(state, a.monsterCardId).kind !== "monster") fail("Escolha um monstro da mão.");
  const target = player(state, a.targetId || p.id);
  if (target.id === p.id) {
    ownTurn(state, p);
    if (state.turnPhase !== "AFTER_DOOR" && state.turnPhase !== "END") fail("Chute a porta primeiro.");
    if (hasBlockingPrompts(state)) fail("Resolva as escolhas pendentes primeiro.");
    if (state.reward) fail("Aguarde a divisão dos tesouros.");
    discardFromPlayer(state, p, a.cardId);
    removeFromPlayer(p, a.monsterCardId);
    log(state, ctx, `🐺 ${p.name} chamou um Monstro Errante para lutar: ${nameOf(state, a.monsterCardId)}!`, "combat", p.id);
    startCombat(state, ctx, p.id, a.monsterCardId);
    return;
  }
  assertMayHinder(state, p, target.id);
  if (target.hibernating) fail(`${target.name} está no casco.`);
  discardFromPlayer(state, p, a.cardId);
  removeFromPlayer(p, a.monsterCardId);
  target.ambush.push(a.monsterCardId);
  log(state, ctx, `🐺 ${p.name} soltou um Monstro Errante atrás da porta de ${target.name}: ele vai enfrentá-lo no próximo turno!`, "combat", p.id);
}

function clearOwl(state: GameState, p: PlayerState) {
  p.owlPeek = null;
  state.notices = state.notices.filter((n) => !(n.playerId === p.id && n.kind === "owl"));
}

function lootRoom(state: GameState, ctx: Ctx, p: PlayerState) {
  if (!state.turn.fought) {
    const c = drawCard(state, "door", ctx);
    if (c) p.hand.push(c);
    log(state, ctx, `${p.name} saqueou a sala (comprou 1 Porta).`, "info", p.id);
  }
  state.turnPhase = "END";
}

function skipAfk(state: GameState, ctx: Ctx, cur: PlayerState) {
  log(state, ctx, `⏭️ ${cur.name} está ausente: o turno será encerrado.`, "system");
  if (state.combat) {
    if (state.combat.stage !== "badstuff") startFlee(state, ctx);
    if (state.combat?.stage === "badstuff") applyAllBadStuff(state, ctx);
  }
  for (const pr of [...state.prompts]) {
    if (pr.playerId === cur.id || pr.blocking) timeoutPrompt(state, ctx, pr);
  }
  if (state.phase !== "PLAYING" || state.order[state.currentIdx] !== cur.id) return;
  if (state.turn.ending) return;
  state.turnPhase = "END";
  requestEndTurn(state, ctx, cur, true);
}

function dispense(state: GameState, ctx: Ctx, p: PlayerState, monsterId: string, discardId?: string) {
  const combat = combatFor(state);
  if (combat.fighterId !== p.id) fail("Só quem luta pode dispensar.");
  if (combat.stage === "badstuff") fail("O combate já foi decidido.");
  const cm = combat.monsters.find((m) => m.cardId === monsterId && !m.defeated);
  if (!cm) fail("Monstro inválido.");
  if (cm.ignoreSpecial) fail("O texto Especial desse monstro está sendo ignorado.");
  const fx = monsterFx(state, cm, "dispensavel").find((f) => matchesWho(state, p, f));
  if (!fx) fail("Esse monstro não pode ser dispensado por você.");
  const name = nameOf(state, cm.cardId);
  if (num(fx, "descartar") > 0) {
    const n = num(fx, "descartar");
    if (n === 1) {
      if (!discardId) fail("Escolha 1 carta para descartar.");
      inHand(p, discardId);
      discardFromPlayer(state, p, discardId);
    } else {
      if (p.hand.length < n) fail(`Precisa descartar ${n} cartas.`);
      for (const c of p.hand.slice(0, n)) discardFromPlayer(state, p, c);
    }
  }
  removeMonster(state, ctx, cm.cardId);
  log(state, ctx, `${p.name} dispensou ${name}.`, "combat");
  if (num(fx, "tesouros") > 0) drawTreasuresTo(state, ctx, p, num(fx, "tesouros"));
  if (num(fx, "niveis") > 0) gainLevels(state, p, num(fx, "niveis"), ctx, false, `dispensou ${name}`);
}

function drawTreasuresTo(state: GameState, ctx: Ctx, p: PlayerState, n: number) {
  for (let i = 0; i < n; i++) {
    const c = drawCard(state, "treasure", ctx);
    if (c) p.hand.push(c);
  }
}

// ============================================================================
// Poções e itens de uso único
// ============================================================================

function playConsumable(state: GameState, ctx: Ctx, p: PlayerState, a: Extract<Action, { type: "USE_CARD" }>) {
  if (state.phase !== "PLAYING") fail("A partida não está em andamento.");
  handOrTable(p, a.cardId);
  const d = defOf(state, a.cardId);
  const mult = d.kind === "potion" ? multiplier(state, p) : 1;
  const combat = state.combat;
  const fxs = d.fx ?? [];
  const has = (t: string) => fxs.find((f) => f.tipo === t);
  const label = (txt: string) => `${d.name}${mult > 1 ? " x2" : ""} (${txt})`;
  if (combat && (a.side === "monster" || has("isca") || (has("menosEmAlvo") && a.targetId)))
    assertMayHinder(state, p, combat.fighterId);

  const finish = () => {
    const keep = d.kind === "potion" ? passiveFxSrc(state, p, "guardaPocao")[0] : undefined;
    if (keep) {
      const r = rollD6(state, p, ctx, keep.source);
      if (r.total >= scaled(keep.fx, "dado", p.level, 6)) {
        log(state, ctx, `🔧 ${keep.source}: ${p.name} guardou a poção.`);
        return;
      }
    }
    discardFromPlayer(state, p, a.cardId);
  };
  const potionCombat = () => {
    const c = canInterfere(state, p);
    if (d.kind === "potion" && combatHas(state, c, "semPocoes")) fail("Ninguém pode usar poções neste combate.");
    return c;
  };
  const sideTarget = (c: NonNullable<GameState["combat"]>): PlayerState => {
    const side = playerSide(state, c);
    const t = a.targetId ? player(state, a.targetId) : side.includes(p.id) ? p : player(state, c.fighterId);
    if (!side.includes(t.id)) fail("Escolha um jogador que esteja lutando.");
    return t;
  };

  if (d.kind !== "potion" && d.kind !== "misc") fail("Essa carta não pode ser usada assim.");
  if (d.kind === "misc" && d.permanent) fail("Essa carta é permanente: coloque-a na mesa.");

  // --- Bônus para um lado do combate
  const bonus = has("bonusLado");
  if (bonus) {
    const c = potionCombat();
    const value = num(bonus, "valor") * mult;
    if (a.side === "monster") {
      c.monsterSideMods.push({ id: uid(state, "m"), value, by: p.id, label: label(p.name) });
    } else {
      c.playerMods.push({ id: uid(state, "m"), value, by: p.id, label: label(p.name), fire: flag(bonus, "fogo") });
      if (bonus.quemBebeFugir !== undefined) {
        const drinker = sideTarget(c);
        c.fleeMods.push({ id: uid(state, "m"), value: num(bonus, "quemBebeFugir"), by: p.id, label: d.name, target: drinker.id });
      }
    }
    log(state, ctx, `🧪 ${p.name} usou ${d.name} (${value > 0 ? "+" : ""}${value} para ${a.side === "monster" ? "o monstro" : "os jogadores"}).`, "combat", p.id);
    finish();
    onCombatChanged(state, ctx);
    return;
  }
  const minus = has("menosEmAlvo");
  if (minus) {
    const c = potionCombat();
    const value = -num(minus, "valor") * mult;
    if (a.monsterId) {
      const cm = c.monsters.find((m) => m.cardId === a.monsterId && !m.defeated);
      if (!cm) fail("Monstro inválido.");
      cm.mods.push({ id: uid(state, "m"), value, by: p.id, label: label(p.name) });
      log(state, ctx, `🧪 ${p.name} usou ${d.name} em ${nameOf(state, cm.cardId)} (${value}).`, "combat", p.id);
    } else {
      const t = player(state, a.targetId ?? "");
      if (!playerSide(state, c).includes(t.id)) fail("Escolha o monstro ou um jogador que esteja lutando.");
      c.playerMods.push({ id: uid(state, "m"), value, by: p.id, label: label(`em ${t.name}`), target: t.id });
      log(state, ctx, `🧪 ${p.name} usou ${d.name} em ${t.name} (${value}).`, "combat", p.id);
    }
    finish();
    onCombatChanged(state, ctx);
    return;
  }
  const fleeUp = has("bonusFugir");
  if (fleeUp) {
    const c = potionCombat();
    const t = sideTarget(c);
    const v = num(fleeUp, "valor") * mult;
    c.fleeMods.push({ id: uid(state, "m"), value: v, by: p.id, label: label(t.name), target: t.id });
    log(state, ctx, `🧪 ${t.name} ganhou +${v} em Fugir.`, "combat", p.id);
    finish();
    return;
  }
  const holy = has("contraMortosVivos");
  const cleanse = has("removePodridao");
  if (holy || cleanse) {
    const t = a.targetId ? player(state, a.targetId) : p;
    const rot = t.curses.find((c) => fxOf(c.defId).some((f) => f.tipo === "removidaPorAguaBenta"));
    const tags = combatTags(state, combat);
    if (holy && combat && combat.stage !== "badstuff" && (tags.has("morto-vivo") || tags.has("demonio"))) {
      const c = potionCombat();
      const v = num(holy, "valor") * mult;
      c.playerMods.push({ id: uid(state, "m"), value: v, by: p.id, label: label(p.name) });
      log(state, ctx, `💧 ${p.name} usou ${d.name} (+${v}).`, "combat", p.id);
      if (rot && cleanse) removeCurse(state, t, rot.id);
      finish();
      onCombatChanged(state, ctx);
      return;
    }
    if (!rot || !cleanse) fail("Use contra Mortos-vivos/Demônios, ou para remover uma maldição que a Água Benta remove.");
    removeCurse(state, t, rot.id);
    log(state, ctx, `💧 ${d.name} removeu uma maldição de ${t.name}.`, "curse");
    finish();
    return;
  }
  const heal = has("devolveNivel");
  if (heal) {
    const t = a.targetId ? player(state, a.targetId) : p;
    const lost = combat ? (combat.levelsLost[t.id] ?? 0) : (state.turn.lastCombatLost[t.id] ?? 0);
    if (lost <= 0) fail(`${t.name} não perdeu níveis neste combate.`);
    const back = Math.min(lost, num(heal, "quantidade", 1) * mult);
    if (combat) combat.levelsLost[t.id] = lost - back;
    else state.turn.lastCombatLost[t.id] = lost - back;
    gainLevels(state, t, back, ctx, false, d.name);
    finish();
    return;
  }
  if (has("forcaAjuda")) {
    const c = potionCombat();
    if (c.fighterId !== p.id) fail("Use no seu próprio combate.");
    const t = player(state, a.targetId ?? "");
    const err = canBeHelper(state, t);
    if (err) fail(err);
    finish();
    log(state, ctx, `🧪 ${d.name} obriga ${t.name} a ajudar.`, "combat");
    joinHelper(state, ctx, t.id, null, true);
    return;
  }
  const escape = has("fugaAutomatica") ?? (has("teletransporte") ? ({ tipo: "teletransporte" } as const) : undefined);
  if (escape) {
    if (!combat) fail("Só durante um combate.");
    const all = escape.tipo === "teletransporte" || !flag(escape as never, "excetoLendarios");
    const t = escape.tipo === "teletransporte" ? p : a.targetId ? player(state, a.targetId) : p;
    if (!playerSide(state, combat).includes(t.id)) fail("Escolha alguém que esteja lutando.");
    if (d.kind === "potion" && combatHas(state, combat, "semPocoes") && !combat.flee) fail("Ninguém pode usar poções neste combate.");
    if (combat.flee) {
      for (const r of combat.flee.results) {
        if (r.playerId === t.id && !r.success && (all || !defOfMonster(state, r.monsterCardId).legendary)) {
          r.success = true;
          r.note = d.name;
        }
      }
      finish();
      log(state, ctx, `💨 ${t.name} escapou (${d.name})!`, "combat");
      maybeApplyBadStuff(state, ctx);
      return;
    }
    combat.autoFlee.push(`${t.id}|${all ? "all" : "nonleg"}`);
    finish();
    log(state, ctx, `💨 ${t.name} vai fugir automaticamente (${d.name}).`, "combat");
    return;
  }
  const up = has("subirNivel");
  if (up) {
    if (p.level >= RULES.nivelMaximo - 1) fail(`Isso nunca leva ao nível ${RULES.nivelMaximo}.`);
    finish();
    gainLevels(state, p, num(up, "quantidade", 1) * mult, ctx, false, d.name);
    return;
  }
  const bait = has("isca");
  if (bait) {
    const c = canInterfere(state, p);
    if (playerSide(state, c).includes(p.id)) fail("Use no combate de outro jogador.");
    const cm = c.monsters.find((m) => m.cardId === a.monsterId && !m.defeated);
    if (!cm) fail("Escolha um monstro.");
    cm.mods.push({ id: uid(state, "m"), value: num(bait, "valor"), by: p.id, label: d.name });
    discardFromPlayer(state, p, a.cardId);
    log(state, ctx, `🍖 ${p.name} jogou ${d.name} (+${num(bait, "valor")}).`, "combat", p.id);
    onCombatChanged(state, ctx);
    return;
  }
  if (has("rerrolarFuga")) {
    dispatch(state, p, { type: "REROLL", index: a.index ?? -1, source: "dado", cardId: a.cardId }, ctx);
    return;
  }
  if (has("espelho")) {
    const c = combatFor(state);
    if (c.fighterId !== p.id) fail("Use no seu combate.");
    const cm = c.monsters.find((m) => m.cardId === a.monsterId && m.wandering && !m.defeated);
    if (!cm) fail("Escolha um Monstro Errante.");
    const t = player(state, a.targetId ?? "");
    if (t.id === p.id) fail("Escolha outro jogador.");
    discardFromPlayer(state, p, a.cardId);
    removeMonster(state, ctx, cm.cardId, false);
    t.ambush.push(cm.cardId);
    log(state, ctx, `🪞 ${p.name} refletiu ${nameOf(state, cm.cardId)} para ${t.name}, que vai enfrentá-lo no próximo turno!`, "combat");
    return;
  }
  const map = has("mapa");
  if (map) {
    const c = combatFor(state);
    if (c.fighterId !== p.id) fail("Use no seu combate.");
    discardFromPlayer(state, p, a.cardId);
    c.mapa = (c.mapa || 0) + num(map, "tesouros", 2);
    log(state, ctx, `🗺️ ${p.name} usou ${d.name}: +${num(map, "tesouros", 2)} tesouros se vencer.`, "combat");
    return;
  }
  if (has("kitLadrao")) fail("Use esta carta pela habilidade Roubo.");
  fail("Essa carta não pode ser usada assim.");
}

function defOfMonster(state: GameState, cardId: string) {
  const d = defOf(state, cardId);
  if (d.kind !== "monster") fail("Não é um monstro.");
  return d;
}

export { discardCard };
