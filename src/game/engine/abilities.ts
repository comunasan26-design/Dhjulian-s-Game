// Ativas de raças e classes. Nenhuma ativa é registrada aqui: cada raça/classe no JSON
// (cartas/racas.json e cartas/classes.json) diz qual "acao" genérica usar, com custo, limite e números.
// Este arquivo só sabe EXECUTAR cada tipo de ação.
import { type AbilityDef, def, type Fx, type MonsterCard, RULES, type Tag } from "../catalog";
import {
  addMonster,
  addSpecialCurse,
  cancelHelpPrompts,
  createPrompt,
  defendCurse,
  endCombat,
  joinHelper,
  onCombatChanged,
  onPersistentCurse,
  removeHelper,
  removeMonster,
} from "./core";
import { cardFx, combatFx, combatHas, flag, heldFx, monsterFx, num, runeFx, strs } from "./fx";
import { type Ctx, type GameState, type HelpDeal, type PlayerState, fail } from "./state";
import {
  activeMonsters,
  combatTags,
  effectiveHelper,
  equipCheck,
  hasLegendary,
  isLegendaryItem,
  meetsRestrictions,
  monsterDef,
  playerSide,
  slotOf,
} from "./stats";
import {
  defOf,
  discardCard,
  discardFromPlayer,
  drawCard,
  drawTo,
  gainLevels,
  hasClass,
  hasPassive,
  identityCards,
  isCurrent,
  itemDef,
  log,
  loseLevels,
  nameOf,
  ownerOf,
  passiveFxSrc,
  player,
  removeFromPlayer,
  rollD6,
  scaled,
  shuffle,
  uid,
} from "./util";

/** Chave de uma ativa: "<id da carta>#<id da ativa>". */
export type AbilityKey = string;

export type FieldKind =
  | "player"
  | "monster"
  | "wandering"
  | "ownEquipped"
  | "ownEquippedNoRing"
  | "otherEquipped"
  | "handItem"
  | "itemHandOrTable"
  | "bigItem"
  | "restrictedItem"
  | "ownCurse"
  | "side"
  | "handMonster"
  | "handDoor"
  | "combatItem"
  | "curaMode"
  | "targetCurse"
  | "goblinMode"
  | "discardItem"
  | "faceUpTreasure"
  | "dealCount"
  | "dealMode"
  | "kit"
  | "victim";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  label: string;
  optional?: boolean;
}

/** Como executar um tipo de ação genérica. */
interface Spec {
  acao: string;
  /** Ação usada dentro do combate (afetada por monstros imunes a magia, Desafio etc.). */
  combat: boolean;
  /** Conta como "contra" um monstro Lendário (Resistência Lendária). */
  againstMonster?: boolean;
  fields: FieldSpec[];
  check: (state: GameState, p: PlayerState, ab: AbilityDef) => string | null;
  /** Valida parâmetros e devolve o efeito (sem alterar o estado). */
  prepare: (state: GameState, ctx: Ctx, p: PlayerState, params: Params, ab: AbilityDef) => { run: () => void; paramCards?: string[] };
}

export type Params = Record<string, unknown>;

// ----------------------------------------------------------------------------
// Auxiliares
// ----------------------------------------------------------------------------

function str(params: Params, key: string): string {
  const v = params[key];
  if (typeof v !== "string" || !v) fail("Parâmetro ausente: " + key);
  return v;
}

function optStr(params: Params, key: string): string | null {
  const v = params[key];
  return typeof v === "string" && v ? v : null;
}

function inCombat(state: GameState): string | null {
  return state.combat ? null : "Só durante um combate.";
}

function onSide(state: GameState, p: PlayerState): string | null {
  if (!state.combat) return "Só durante um combate.";
  if (state.combat.stage === "badstuff") return "O combate já foi decidido.";
  if (!playerSide(state, state.combat).includes(p.id)) return "Você precisa estar lutando neste combate.";
  return null;
}

function isFighter(state: GameState, p: PlayerState): string | null {
  if (!state.combat) return "Só durante um combate.";
  if (state.combat.stage === "badstuff") return "O combate já foi decidido.";
  if (state.combat.fighterId !== p.id) return "Só quem está lutando pode usar.";
  return null;
}

function ownTurnFree(state: GameState, p: PlayerState): string | null {
  if (state.phase !== "PLAYING") return "A partida ainda não começou.";
  if (!isCurrent(state, p.id)) return "Só no seu turno.";
  if (state.turn.ending) return "Seu turno está terminando.";
  if (state.combat) return "Não pode ser usada em combate.";
  return null;
}

function combatMonster(state: GameState, params: Params, opts: { notLegendary?: boolean } = {}) {
  const combat = state.combat;
  if (!combat) fail("Não há combate.");
  const id = str(params, "monster");
  const cm = activeMonsters(combat).find((m) => m.cardId === id);
  if (!cm) fail("Monstro inválido.");
  const d = monsterDef(state, cm);
  if (opts.notLegendary && d.legendary) fail("Não funciona em Lendários.");
  if (opts.notLegendary && monsterFx(state, cm, "imbativel").length) fail(`${d.name} não pode ser afetado.`);
  return { cm, d };
}

function otherPlayer(state: GameState, p: PlayerState, params: Params, key = "player"): PlayerState {
  const t = player(state, str(params, key));
  if (t.id === p.id) fail("Escolha outro jogador.");
  return t;
}

/** Passiva "refleteNoDado" do alvo contra ativas. */
function reflected(state: GameState, ctx: Ctx, actor: PlayerState, target: PlayerState, label: string): boolean {
  if (target.id === actor.id) return false;
  for (const { fx, source } of passiveFxSrc(state, target, "refleteNoDado")) {
    const r = rollD6(state, target, ctx, source);
    if (r.total >= scaled(fx, "dado", target.level, 6)) {
      log(state, ctx, `🪞 ${source}! ${label} de ${actor.name} se volta contra ele.`, "combat");
      return true;
    }
  }
  return false;
}

function canBeHelper(state: GameState, target: PlayerState): string | null {
  const combat = state.combat!;
  if (combat.helperId) return "Já existe um ajudante.";
  if (combat.isolated.includes(combat.fighterId)) return "Ninguém pode ajudar neste combate.";
  if (combat.desafio) return "Desafio: ninguém pode lutar junto.";
  if (target.id === combat.fighterId) return "Escolha outro jogador.";
  if (combatHas(state, combat, "detectaMentiras") && target.curseCastRound === state.round)
    return "Quem lançou maldição nesta rodada não pode ajudar neste combate.";
  return null;
}

function parseDeal(params: Params): HelpDeal {
  const count = Math.max(0, Math.min(20, Number(params.dealCount ?? 0) || 0));
  const mode = params.dealMode === "fighter" || params.dealMode === "helper" ? params.dealMode : "random";
  return { count, mode };
}

// ----------------------------------------------------------------------------
// Definições
// ----------------------------------------------------------------------------

const SPECS: Spec[] = [
  {
    acao: "bonusCombate",
    combat: true,
    againstMonster: true,
    fields: [],
    check: onSide,
    prepare: (state, ctx, p, _params, ab) => ({
      run: () => {
        const tags = combatTags(state, state.combat);
        let v = scaled(ab.params, "valor", p.level);
        if (strs(ab.params, "dobraContraTags").some((t) => tags.has(t as Tag))) v *= 2;
        state.combat!.playerMods.push({ id: uid(state, "m"), value: v, by: p.id, label: `${ab.name} (${p.name})`, fire: flag(ab.params, "fogo") });
      },
    }),
  },
  {
    acao: "reforjar",
    combat: false,
    fields: [
      { name: "costItem", kind: "itemHandOrTable", label: "Item a descartar" },
      { name: "item", kind: "ownEquippedNoRing", label: "Item equipado a reforjar" },
    ],
    check: ownTurnFree,
    prepare: (state, ctx, p, params, ab) => {
      const cost = str(params, "costItem");
      const target = str(params, "item");
      if (cost === target) fail("Escolha itens diferentes.");
      if (!(p.hand.includes(cost) || p.carried.includes(cost)) || !itemDef(state, cost)) fail("Item de custo inválido.");
      if (!p.equipped.includes(target) || !itemDef(state, target)) fail("Escolha um item equipado.");
      if (slotOf(state, target) === "ring") fail("Anéis não podem ser reforjados.");
      if (state.cards[target].reforged) fail("Esse item já foi reforjado.");
      return {
        paramCards: [cost],
        run: () => {
          discardFromPlayer(state, p, cost);
          state.cards[target].reforged = scaled(ab.params, "bonus", p.level, 1);
          log(state, ctx, `⚒️ ${p.name} usou ${ab.name} em ${nameOf(state, target)} (+${scaled(ab.params, "bonus", p.level, 1)} permanente).`);
        },
      };
    },
  },
  {
    acao: "nivelDobradoAjudando",
    combat: true,
    againstMonster: true,
    fields: [],
    check: (state, p) => {
      const e = onSide(state, p);
      if (e) return e;
      if (effectiveHelper(state, state.combat!) !== p.id) return "Só funciona quando você está ajudando.";
      return null;
    },
    prepare: (state, ctx, p) => ({
      run: () => {
        state.combat!.elfDouble.push(p.id);
      },
    }),
  },
  {
    acao: "itemDaMaoParaLado",
    combat: true,
    fields: [
      { name: "handItem", kind: "handItem", label: "Item da mão" },
      { name: "side", kind: "side", label: "Lado do combate" },
    ],
    check: (state, p) => {
      const e = inCombat(state);
      if (e) return e;
      if (state.combat!.stage === "badstuff") return "O combate já foi decidido.";
      if (!p.hand.some((id) => itemDef(state, id))) return "Você não tem itens na mão.";
      return null;
    },
    prepare: (state, ctx, p, params, ab) => {
      const card = str(params, "handItem");
      const d = itemDef(state, card);
      if (!p.hand.includes(card) || !d) fail("Escolha um item da sua mão.");
      const side = params.side === "monster" ? "monster" : "player";
      const isSide = playerSide(state, state.combat!).includes(p.id);
      return {
        paramCards: [card],
        run: () => {
          discardFromPlayer(state, p, card);
          const mod = { id: uid(state, "m"), value: d.bonus, by: p.id, label: `${ab.name}: ${d.name} (${p.name})` };
          if (side === "player") state.combat!.playerMods.push(mod);
          else state.combat!.monsterSideMods.push(mod);
          void isSide;
        },
      };
    },
  },
  {
    acao: "arremesso",
    combat: true,
    againstMonster: true,
    fields: [{ name: "bigItem", kind: "bigItem", label: "Item Grande" }],
    check: onSide,
    prepare: (state, ctx, p, params, ab) => {
      const card = str(params, "bigItem");
      const d = itemDef(state, card);
      if (!d?.big || !(p.hand.includes(card) || p.equipped.includes(card) || p.carried.includes(card)))
        fail("Escolha um item Grande seu.");
      return {
        paramCards: [card],
        run: () => {
          loseLevels(state, p, scaled(ab.params, "perdeNiveis", p.level, 0), ctx, ab.name);
          discardFromPlayer(state, p, card);
          const mult = scaled(ab.params, "multiplicador", p.level, 2);
          state.combat!.playerMods.push({ id: uid(state, "m"), value: d.bonus * mult, by: p.id, label: `${ab.name}: ${d.name} (${p.name})` });
        },
      };
    },
  },
  {
    acao: "usarItemRestrito",
    combat: true,
    againstMonster: true,
    fields: [{ name: "item", kind: "restrictedItem", label: "Item restrito" }],
    check: onSide,
    prepare: (state, ctx, p, params, ab) => {
      const card = str(params, "item");
      const d = itemDef(state, card);
      if (!d || !(p.hand.includes(card) || p.carried.includes(card))) fail("Escolha um item da mão ou da mesa.");
      if (!meetsRestrictions(state, p, d)) fail("Esse item não é restrito para você.");
      return {
        paramCards: [card],
        run: () => {
          state.combat!.adaptations.push({ cardId: card, playerId: p.id });
          log(state, ctx, `${p.name} usa ${d.name} (${ab.name}) até o fim do combate.`);
        },
      };
    },
  },
  {
    acao: "ignorarEspecial",
    combat: true,
    fields: [{ name: "monster", kind: "monster", label: "Monstro" }],
    check: onSide,
    prepare: (state, ctx, p, params, ab) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: flag(ab.params, "naoEmLendarios") });
      return {
        run: () => {
          cm.ignoreSpecial = true;
          log(state, ctx, `💢 O texto Especial de ${d.name} será ignorado.`, "combat");
        },
      };
    },
  },
  {
    acao: "passarMaldicao",
    combat: false,
    fields: [
      { name: "curse", kind: "ownCurse", label: "Sua maldição" },
      { name: "player", kind: "player", label: "Passar para" },
    ],
    check: (state, p) => (p.curses.length ? null : "Você não tem maldições ativas."),
    prepare: (state, ctx, p, params) => {
      const cid = str(params, "curse");
      const curse = p.curses.find((c) => c.id === cid);
      if (!curse) fail("Maldição inválida.");
      const target = otherPlayer(state, p, params);
      return {
        run: () => {
          p.curses = p.curses.filter((c) => c.id !== cid);
          const final = defendCurse(state, ctx, target, p, "a maldição passada");
          if (!final) {
            if (curse.cardId) discardCard(state, curse.cardId);
            return;
          }
          final.curses.push(curse);
          log(state, ctx, `😈 ${p.name} passou uma maldição para ${final.name}.`, "curse");
          onPersistentCurse(state, ctx, final, curse.defId);
        },
      };
    },
  },
  {
    acao: "monstrosPerdemNivel",
    combat: true,
    againstMonster: true,
    fields: [],
    check: onSide,
    prepare: (state, ctx, p, _params, ab) => ({
      run: () => {
        const v = -Math.abs(scaled(ab.params, "valor", p.level, 2));
        for (const cm of activeMonsters(state.combat!)) cm.mods.push({ id: uid(state, "m"), value: v, by: p.id, label: ab.name });
        if (flag(ab.params, "fogo")) state.combat!.playerMods.push({ id: uid(state, "m"), value: 0, by: p.id, label: `${ab.name} (fogo)`, fire: true });
      },
    }),
  },
  {
    acao: "bugiganga",
    combat: false,
    fields: [
      { name: "mode", kind: "goblinMode", label: "O que fazer" },
      { name: "card", kind: "discardItem", label: "Item do descarte", optional: true },
      { name: "faceUp", kind: "faceUpTreasure", label: "Tesouro aberto", optional: true },
    ],
    check: () => null,
    prepare: (state, ctx, p, params) => {
      if (params.mode === "steal") {
        const card = str(params, "faceUp");
        const lf = state.lastFaceUp;
        if (!lf || lf.turnSerial !== state.turnSerial || !lf.cards.includes(card)) fail("Esse tesouro não está disponível.");
        const owner = player(state, lf.ownerId);
        if (owner.id === p.id) fail("Esse tesouro já é seu.");
        if (!owner.hand.includes(card) && !owner.carried.includes(card)) fail("O tesouro já foi usado.");
        if (owner.hibernating) fail(`${owner.name} está no casco (imune a roubos).`);
        return {
          run: () => {
            if (reflected(state, ctx, p, owner, "o roubo")) return;
            removeFromPlayer(owner, card);
            p.hand.push(card);
            log(state, ctx, `👺 ${p.name} pegou ${nameOf(state, card)} de ${owner.name}!`);
          },
        };
      }
      const card = str(params, "card");
      if (!state.decks.treasureDiscard.includes(card) || !itemDef(state, card)) fail("Escolha um item da pilha de descarte.");
      return {
        run: () => {
          state.decks.treasureDiscard.splice(state.decks.treasureDiscard.indexOf(card), 1);
          p.carried.push(card);
          if (state.lastItemDiscard?.cardId === card) state.lastItemDiscard = null;
          log(state, ctx, `👺 ${p.name} pegou ${nameOf(state, card)} do descarte.`);
        },
      };
    },
  },
  {
    acao: "abrirOutraPorta",
    combat: false,
    fields: [],
    check: (state, p) => {
      const e = ownTurnFree(state, p);
      if (e) return e;
      if (state.turnPhase !== "END" || (state.turn.lastResult !== "won" && state.turn.lastResult !== "fled"))
        return "Só depois de vencer ou fugir de um combate.";
      return null;
    },
    prepare: (state, ctx, p, _params, ab) => ({
      run: () => {
        state.turnPhase = "KICK";
        state.turn.revealed = null;
        state.turn.lastResult = null;
        log(state, ctx, `🐎 ${p.name} usou ${ab.name}: vai abrir mais uma porta!`);
      },
    }),
  },
  {
    acao: "hibernar",
    combat: false,
    fields: [],
    check: (state, p) => {
      const e = ownTurnFree(state, p);
      if (e) return e;
      if (state.turnPhase !== "KICK" || state.turn.fought || state.turn.revealed) return "Só no início do turno, antes de chutar a porta.";
      return null;
    },
    prepare: (state, ctx, p, _params, ab) => ({
      run: () => {
        const got = drawTo(state, p, "treasure", scaled(ab.params, "tesouros", p.level, 2), ctx);
        p.hibernating = true;
        state.turnPhase = "END";
        log(state, ctx, `🐢 ${p.name} usou ${ab.name}: comprou ${got.length} Tesouros e fica imune a maldições e roubos.`);
      },
    }),
  },
  {
    acao: "pressagio",
    combat: false,
    fields: [{ name: "card", kind: "handDoor", label: "Carta de Porta da mão" }],
    check: (state, p) => (p.hand.some((id) => defOf(state, id).deck === "door") ? null : "Você não tem cartas de Porta na mão."),
    prepare: (state, ctx, p, params, ab) => {
      const card = str(params, "card");
      if (!p.hand.includes(card) || defOf(state, card).deck !== "door") fail("Escolha uma carta de Porta da sua mão.");
      return {
        paramCards: [card],
        run: () => {
          removeFromPlayer(p, card);
          const bottom = state.decks.door.pop();
          state.decks.door.unshift(card);
          if (bottom) p.hand.push(bottom);
          log(state, ctx, `🦉 ${p.name} usou ${ab.name}.`);
        },
      };
    },
  },
  {
    acao: "ameacarAjuda",
    combat: true,
    fields: [
      { name: "player", kind: "player", label: "Jogador ameaçado" },
      { name: "dealCount", kind: "dealCount", label: "Tesouros oferecidos" },
      { name: "dealMode", kind: "dealMode", label: "Divisão" },
    ],
    check: (state, p) => {
      const e = isFighter(state, p);
      if (e) return e;
      if (state.combat!.helperId) return "Você já tem ajudante.";
      if (combatHas(state, state.combat, "semPedirAjuda")) return "Este monstro não deixa você pedir ajuda.";
      return null;
    },
    prepare: (state, ctx, p, params, ab) => {
      const target = otherPlayer(state, p, params);
      const err = canBeHelper(state, target);
      if (err) fail(err);
      const deal = parseDeal(params);
      return {
        run: () => {
          if (reflected(state, ctx, p, target, ab.name)) return;
          const lose = scaled(ab.params, "perdeNiveis", p.level, 1);
          createPrompt(state, ctx, "helpRequest", target.id, { fighterId: p.id, deal, threat: true, threatLevels: lose, threatName: ab.name, combatId: state.combat!.id });
          log(state, ctx, `🔱 ${p.name} usou ${ab.name} em ${target.name}: ajude ou perca ${lose} nível(is)!`, "combat");
        },
      };
    },
  },
  {
    acao: "forcarAjuda",
    combat: true,
    fields: [{ name: "player", kind: "player", label: "Jogador encantado" }],
    check: (state, p) => {
      const e = isFighter(state, p);
      if (e) return e;
      if (state.combat!.helperId) return "Você já tem ajudante.";
      return null;
    },
    prepare: (state, ctx, p, params, ab) => {
      const target = otherPlayer(state, p, params);
      const err = canBeHelper(state, target);
      if (err) fail(err);
      return {
        run: () => {
          if (reflected(state, ctx, p, target, ab.name)) return;
          log(state, ctx, `🧜 ${ab.name} obriga ${target.name} a ajudar!`, "combat");
          joinHelper(state, ctx, target.id, null, true);
        },
      };
    },
  },
  {
    acao: "trocarItem",
    combat: false,
    fields: [
      { name: "item", kind: "ownEquipped", label: "Seu item" },
      { name: "player", kind: "player", label: "Jogador" },
      { name: "otherItem", kind: "otherEquipped", label: "Item dele (mesmo slot)" },
    ],
    check: ownTurnFree,
    prepare: (state, ctx, p, params, ab) => {
      const mine = str(params, "item");
      const target = otherPlayer(state, p, params);
      const theirs = str(params, "otherItem");
      if (!p.equipped.includes(mine) || !target.equipped.includes(theirs)) fail("Escolha itens equipados.");
      if (slotOf(state, mine) !== slotOf(state, theirs)) fail("Os itens precisam ser do mesmo slot.");
      if (isLegendaryItem(state, mine) || isLegendaryItem(state, theirs)) fail("Não funciona com itens Lendários.");
      if (runeFx(state, theirs, "naoRoubavel").length > 0) fail("Uma runa impede que esse item seja trocado.");
      if (target.hibernating) fail(`${target.name} está no casco.`);
      return {
        run: () => {
          if (reflected(state, ctx, p, target, ab.name)) return;
          createPrompt(state, ctx, "fairySwap", target.id, { fairyId: p.id, mine, theirs, blockCost: scaled(ab.params, "custoBloqueio", p.level, 2), abilityName: ab.name });
          log(state, ctx, `🧚 ${p.name} tenta trocar ${nameOf(state, mine)} por ${nameOf(state, theirs)} de ${target.name}.`);
        },
      };
    },
  },
  {
    acao: "roubarNivel",
    combat: false,
    fields: [{ name: "player", kind: "player", label: "Vítima (nível ≥ ao seu)" }],
    check: (state, p) => {
      const e = ownTurnFree(state, p);
      if (e) return e;
      if (!state.turn.wonCombat) return "Só depois de vencer um combate neste turno.";
      if (p.level >= RULES.nivelMaximo - 1) return `Nunca leva ao nível ${RULES.nivelMaximo}.`;
      return null;
    },
    prepare: (state, ctx, p, params, ab) => {
      const target = otherPlayer(state, p, params);
      if (target.level < p.level) fail("A vítima precisa ter nível igual ou maior que o seu.");
      return {
        run: () => {
          if (reflected(state, ctx, p, target, ab.name)) {
            loseLevels(state, p, 1, ctx, `${ab.name} refletida`);
            gainLevels(state, target, 1, ctx, false, `${ab.name} refletida`);
            return;
          }
          const lost = loseLevels(state, target, 1, ctx, `${ab.name} de ${p.name}`);
          if (lost) gainLevels(state, p, 1, ctx, false, ab.name);
        },
      };
    },
  },
  {
    acao: "desafio",
    combat: true,
    againstMonster: true,
    fields: [],
    check: (state, p) => {
      const e = isFighter(state, p);
      if (e) return e;
      if (state.combat!.stage !== "fight") return "Só antes de resolver o combate.";
      if (p.equipped.length === 0) return "Você precisa de um item equipado.";
      return null;
    },
    prepare: (state, ctx, p, _params, ab) => ({
      run: () => {
        const combat = state.combat!;
        const best = [...p.equipped].sort((a, b) => worth(state, b) - worth(state, a))[0];
        if (best) {
          log(state, ctx, `${p.name} sacrificou ${nameOf(state, best)}.`);
          discardFromPlayer(state, p, best);
        }
        if (combat.helperId) removeHelper(state, ctx, ab.name);
        cancelHelpPrompts(state);
        combat.desafio = true;
        combat.desafioPenalty = scaled(ab.params, "penalidade", p.level, 0);
        combat.desafioMult = scaled(ab.params, "multiplicadorNiveis", p.level, 1);
        log(state, ctx, `⚔️ ${p.name} usou ${ab.name}! Ninguém mais pode jogar cartas neste combate.`, "combat");
      },
    }),
  },
  {
    acao: "mandarMonstroEmbora",
    combat: true,
    fields: [{ name: "monster", kind: "monster", label: "Monstro" }],
    check: onSide,
    prepare: (state, ctx, p, params, ab) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: flag(ab.params, "naoEmLendarios") });
      return {
        run: () => {
          const got = drawTo(state, p, "treasure", Math.floor(d.treasures * scaled(ab.params, "fracaoTesouros", p.level, 1)), ctx);
          log(state, ctx, `✨ ${p.name} usou ${ab.name}: ${d.name} foi embora e ${p.name} ganhou ${got.length} tesouro(s).`, "combat");
          removeMonster(state, ctx, cm.cardId);
        },
      };
    },
  },
  {
    acao: "curar",
    combat: false,
    fields: [
      { name: "player", kind: "player", label: "Jogador (você ou outro)" },
      { name: "mode", kind: "curaMode", label: "O que curar" },
      { name: "curse", kind: "targetCurse", label: "Maldição", optional: true },
    ],
    check: () => null,
    prepare: (state, ctx, p, params, ab) => {
      const target = player(state, str(params, "player"));
      if (params.mode === "level") {
        const avail =
          target.lostRound === state.round ? target.lostRoundAmount - target.lostRoundCorpoSeco : 0;
        if (avail <= 0) fail("Esse jogador não perdeu níveis curáveis nesta rodada.");
        return {
          run: () => {
            target.lostRoundAmount -= 1;
            gainLevels(state, target, 1, ctx, false, `${ab.name} de ${p.name}`);
          },
        };
      }
      const cid = str(params, "curse");
      const cu = target.curses.find((c) => c.id === cid);
      if (!cu) fail("Maldição inválida.");
      return {
        run: () => {
          target.curses = target.curses.filter((c) => c.id !== cid);
          if (cu.cardId) discardCard(state, cu.cardId);
          log(state, ctx, target.id === p.id ? `💚 ${p.name} removeu uma das próprias maldições.` : `💚 ${p.name} removeu uma maldição de ${target.name}.`, "curse");
        },
      };
    },
  },
  {
    acao: "roubarItem",
    combat: false,
    fields: [
      { name: "player", kind: "player", label: "Vítima" },
      { name: "otherItem", kind: "otherEquipped", label: "Item equipado (não Grande)" },
      { name: "kit", kind: "kit", label: "Usar Kit de Ladrão", optional: true },
    ],
    check: () => null,
    prepare: (state, ctx, p, params, ab) => stealPrepare(state, ctx, p, params, ab),
  },
  {
    acao: "domarFera",
    combat: true,
    fields: [{ name: "monster", kind: "monster", label: "Monstro Animal" }],
    check: isFighter,
    prepare: (state, ctx, p, params, ab) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: true });
      const tag = typeof ab.params.tag === "string" ? ab.params.tag : null;
      if (tag && !d.tags.includes(tag as Tag)) fail(`Só monstros com a tag ${tag}.`);
      const lvl = d.level + cm.mods.reduce((a, m) => a + m.value, 0);
      if (lvl > p.level) fail("O monstro precisa ter nível igual ou menor que o seu.");
      return {
        run: () => {
          removeMonster(state, ctx, cm.cardId, false);
          const c = state.cards[cm.cardId];
          c.tamed = true;
          const old = p.equipped.filter((id) => slotOf(state, id) === "mount");
          for (const id of old) {
            removeFromPlayer(p, id);
            p.carried.push(id);
          }
          if (equipCheck(state, p, cm.cardId).error) p.carried.push(cm.cardId);
          else p.equipped.push(cm.cardId);
          log(state, ctx, `🐾 ${p.name} domou ${d.name}! Agora é uma montaria (+${d.treasures}).`, "combat");
        },
      };
    },
  },
  {
    acao: "assumirCoisasRuins",
    combat: true,
    fields: [{ name: "player", kind: "victim", label: "Jogador a proteger" }],
    check: (state) => {
      if (!state.combat?.flee) return "Só quando alguém vai sofrer Coisas Ruins.";
      return null;
    },
    prepare: (state, ctx, p, params, ab) => {
      const victim = otherPlayer(state, p, params);
      const flee = state.combat!.flee!;
      if (!flee.results.some((r) => r.playerId === victim.id && !r.success)) fail("Esse jogador não vai sofrer Coisas Ruins.");
      if (flee.substitutes[victim.id]) fail("Alguém já assumiu por ele.");
      return {
        run: () => {
          flee.substitutes[victim.id] = p.id;
          flee.substituteTreasures = { ...(flee.substituteTreasures ?? {}), [p.id]: scaled(ab.params, "tesouros", p.level, 0) };
          flee.confirmed = flee.confirmed.filter((id) => id !== p.id);
          log(state, ctx, `🛡️ ${p.name} usou ${ab.name}: vai assumir as Coisas Ruins de ${victim.name}!`, "combat");
        },
      };
    },
  },
  {
    acao: "cancelarBonusMonstro",
    combat: true,
    againstMonster: true,
    fields: [],
    check: onSide,
    prepare: (state, ctx, p) => ({
      run: () => {
        const combat = state.combat!;
        const side = new Set(playerSide(state, combat));
        const keep = (m: { by: string | null; value: number }) => !(m.value > 0 && m.by && !side.has(m.by));
        let removed = 0;
        for (const cm of combat.monsters) {
          const before = cm.mods.length;
          cm.mods = cm.mods.filter(keep);
          removed += before - cm.mods.length;
        }
        const before = combat.monsterSideMods.length;
        combat.monsterSideMods = combat.monsterSideMods.filter(keep);
        removed += before - combat.monsterSideMods.length;
        log(state, ctx, `💥 ${p.name} cancelou ${removed} bônus do monstro!`, "combat");
      },
    }),
  },
  {
    acao: "polimorfia",
    combat: true,
    fields: [{ name: "monster", kind: "monster", label: "Monstro" }],
    check: onSide,
    prepare: (state, ctx, p, params, ab) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: flag(ab.params, "naoEmLendarios") });
      return {
        run: () => {
          let found: string | null = null;
          for (let guard = 0; guard < 300; guard++) {
            const c = drawCard(state, "door", ctx);
            if (!c) break;
            if (defOf(state, c).kind === "monster") {
              found = c;
              break;
            }
            discardCard(state, c);
          }
          if (!found) {
            log(state, ctx, "A Polimorfia não encontrou nenhum monstro.", "combat");
            return;
          }
          log(state, ctx, `🌀 ${d.name} virou ${nameOf(state, found)}!`, "combat");
          const combat = state.combat!;
          const idx = combat.monsters.indexOf(cm);
          combat.monsters.splice(idx, 1);
          discardCard(state, cm.cardId);
          addMonster(state, ctx, found, { wandering: cm.wandering, addedBy: cm.addedBy });
        },
      };
    },
  },
  {
    acao: "maldicaoForca",
    combat: false,
    fields: [{ name: "player", kind: "player", label: "Alvo" }],
    check: () => null,
    prepare: (state, ctx, p, params, ab) => {
      const target = otherPlayer(state, p, params);
      return {
        run: () => {
          p.curseCastRound = state.round;
          const final = defendCurse(state, ctx, target, p, ab.name);
          if (!final) return;
          const v = scaled(ab.params, "valor", p.level, -3);
          addSpecialCurse(state, final, "special.forca", v, scaled(ab.params, "turnos", p.level, 1), p.id, ab.name);
          log(state, ctx, `🌑 ${final.name} está sob ${ab.name} (${v}).`, "curse");
          if (state.combat) onCombatChanged(state, ctx);
        },
      };
    },
  },
  {
    acao: "encerrarCombate",
    combat: true,
    fields: [],
    check: (state, p) => {
      const e = onSide(state, p);
      if (e) return e;
      return null;
    },
    prepare: (state, ctx, p, _params, ab) => ({
      run: () => {
        if (flag(ab.params, "naoEmLendarios") && hasLegendary(state, state.combat!)) fail("Não funciona em Lendários.");
        log(state, ctx, `☮️ ${p.name} usou ${ab.name}: o combate termina sem vencedor.`, "combat");
        endCombat(state, ctx, "ended");
      },
    }),
  },
  {
    acao: "anularErrante",
    combat: true,
    fields: [{ name: "monster", kind: "wandering", label: "Monstro Errante" }],
    check: (state) => {
      if (!state.combat) return "Só durante um combate.";
      if (!state.combat.monsters.some((m) => m.wandering && !m.defeated)) return "Não há Monstro Errante no combate.";
      return null;
    },
    prepare: (state, ctx, p, params) => {
      const id = str(params, "monster");
      const cm = state.combat!.monsters.find((m) => m.cardId === id && m.wandering && !m.defeated);
      if (!cm) fail("Escolha um Monstro Errante.");
      return {
        run: () => {
          log(state, ctx, `🪤 ${p.name} anulou ${nameOf(state, id)}!`, "combat");
          removeMonster(state, ctx, id);
        },
      };
    },
  },
  {
    acao: "duplicata",
    combat: true,
    againstMonster: true,
    fields: [{ name: "handMonster", kind: "handMonster", label: "Monstro da mão" }],
    check: (state, p) => {
      const e = isFighter(state, p);
      if (e) return e;
      if (state.combat!.helperId) return "Não pode ter ajudante.";
      return null;
    },
    prepare: (state, ctx, p, params) => {
      const card = str(params, "handMonster");
      if (!p.hand.includes(card) || defOf(state, card).kind !== "monster") fail("Escolha um monstro da mão.");
      return {
        paramCards: [card],
        run: () => {
          removeFromPlayer(p, card);
          const combat = state.combat!;
          combat.allies.push({ cardId: card, by: p.id });
          if (!combat.isolated.includes(p.id)) combat.isolated.push(p.id);
          cancelHelpPrompts(state);
          const d = def(state.cards[card].defId) as MonsterCard;
          log(state, ctx, `👥 ${d.name} luta ao lado de ${p.name} (+${Math.ceil(d.level / 2)}).`, "combat");
        },
      };
    },
  },
  {
    acao: "dobrarFuria",
    combat: true,
    againstMonster: true,
    fields: [],
    check: (state, p) => {
      const e = onSide(state, p);
      if (e) return e;
      if (p.streak <= 0) return "Sua Fúria Crescente está zerada.";
      return null;
    },
    prepare: (state, ctx, p) => ({
      run: () => {
        state.combat!.berserkDouble.push(p.id);
      },
    }),
  },
  {
    acao: "dobrarItem",
    combat: true,
    againstMonster: true,
    fields: [{ name: "item", kind: "combatItem", label: "Item equipado (seu ou do aliado)" }],
    check: onSide,
    prepare: (state, ctx, p, params) => {
      const card = str(params, "item");
      const side = playerSide(state, state.combat!);
      const own = ownerOf(state, card);
      if (!own || own.zone !== "equipped" || !side.includes(own.p.id)) fail("Escolha um item equipado de quem está lutando.");
      return {
        run: () => {
          state.combat!.infusions.push(card);
          log(state, ctx, `🔧 ${nameOf(state, card)} tem o bônus dobrado.`, "combat");
        },
      };
    },
  },
  {
    acao: "buscarPocao",
    combat: false,
    fields: [],
    check: (state, p) => {
      if (state.phase !== "PLAYING" || !isCurrent(state, p.id)) return "Só no seu turno.";
      if (!state.decks.treasure.some((id) => defOf(state, id).kind === "potion")) return "Não há poções no baralho de Tesouros.";
      return null;
    },
    prepare: (state, ctx, p) => ({
      run: () => {
        const idx = state.decks.treasure.findIndex((id) => defOf(state, id).kind === "potion");
        const [card] = state.decks.treasure.splice(idx, 1);
        p.hand.push(card);
        shuffle(state.decks.treasure, ctx);
        log(state, ctx, `⚗️ ${p.name} pegou uma poção do baralho.`);
      },
    }),
  },
];

function worth(state: GameState, cardId: string): number {
  const d = defOf(state, cardId);
  const bonus = d.kind === "item" ? d.bonus : d.kind === "monster" ? d.treasures : 0;
  return bonus * 10000 + ("price" in d ? d.price : 0);
}

function stealPrepare(state: GameState, ctx: Ctx, p: PlayerState, params: Params, ab: AbilityDef) {
  const target = otherPlayer(state, p, params);
  const card = str(params, "otherItem");
  if (!target.equipped.includes(card)) fail("Escolha um item equipado da vítima.");
  const d = itemDef(state, card);
  if (d?.big) fail("Não dá para roubar itens Grandes.");
  if (hasPassive(state, target, "itensNaoRoubaveis")) fail(`Os itens equipados de ${target.name} não podem ser roubados.`);
  if (target.hibernating) fail(`${target.name} está no casco (imune a roubos).`);
  if (runeFx(state, card, "naoRoubavel").length > 0) fail("Uma runa impede que esse item seja roubado.");
  const kitId = optStr(params, "kit");
  // Quem tem a ativa por raça/classe é "ladrão"; quem só tem o kit usa o sucesso do kit
  const isThief = !ab.fromItem;
  if (kitId && !(p.hand.includes(kitId) || p.carried.includes(kitId))) fail("Kit de Ladrão inválido.");
  const kitFx = kitId ? cardFx(state, kitId, "kitLadrao") : undefined;
  if (kitId && !kitFx) fail("Kit de Ladrão inválido.");
  if (!isThief && !kitId) fail("Você precisa de uma carta que permita roubar.");
  return {
    paramCards: kitId ? [kitId] : [],
    run: () => {
      if (kitId) discardFromPlayer(state, p, kitId);
      if (reflected(state, ctx, p, target, ab.name)) {
        loseLevels(state, p, 1, ctx, `${ab.name} refletido`);
        return;
      }
      const r = rollD6(state, p, ctx, `${ab.name} em ${target.name}`);
      const bonus = kitFx && isThief ? num(kitFx, "bonus", 2) : 0;
      const need = isThief ? scaled(ab.params, "sucesso", p.level, 4) : num(kitFx, "sucessoSemLadino", 5);
      if (r.total + bonus >= need) {
        removeFromPlayer(target, card);
        delete state.cards[card].artificeSecond;
        p.carried.push(card);
        log(state, ctx, `🗡️ ${p.name} roubou ${nameOf(state, card)} de ${target.name}!`);
      } else {
        log(state, ctx, `🗡️ ${p.name} foi pego tentando roubar ${target.name}.`);
        loseLevels(state, p, 1, ctx, `${ab.name} fracassado`);
      }
    },
  };
}

export const ACTION_SPECS: Record<string, Spec> = Object.fromEntries(SPECS.map((s) => [s.acao, s]));

/** Uma ativa que o jogador tem (de raça, classe ou de uma carta como o Kit de Ladrão). */
export interface OwnedAbility {
  key: AbilityKey;
  ab: AbilityDef;
  source: string;
}

/** Ativas do jogador: tudo vem das cartas (JSON). */
export function abilitiesOf(state: GameState, p: PlayerState): OwnedAbility[] {
  const out: OwnedAbility[] = [];
  for (const id of identityCards(state, p)) {
    const d = def(state.cards[id].defId);
    if (d.kind !== "race" && d.kind !== "class") continue;
    for (const ab of d.actives) if (ACTION_SPECS[ab.acao]) out.push({ key: `${d.id}#${ab.id}`, ab, source: d.name });
  }
  // Cartas que permitem roubar (ex.: Kit de Ladrão) concedem a ação de roubo a quem não a tem
  const kit = heldFx(state, p, "kitLadrao");
  if (kit && !out.some((o) => o.ab.acao === "roubarItem")) {
    const kd = defOf(state, kit.cardId);
    out.push({
      key: `${kd.id}#kit`,
      ab: { id: "kit", name: kd.name, text: "text" in kd ? kd.text : "", acao: "roubarItem", limite: "rodada", custo: { descartar: 1 }, params: { tipo: "roubarItem" } as Fx, fromItem: true },
      source: kd.name,
    });
  }
  return out;
}

function findOwned(state: GameState, p: PlayerState, key: AbilityKey): OwnedAbility | undefined {
  return abilitiesOf(state, p).find((o) => o.key === key);
}

function usageUsed(state: GameState, p: PlayerState, o: OwnedAbility): boolean {
  const k = o.key;
  switch (o.ab.limite) {
    case "combate":
      return !!state.combat?.used.includes(`${p.id}:${k}`);
    case "rodada":
      return p.usage[k] === state.round;
    case "turno":
      return p.usage[k] === state.turnSerial;
    case "turnoProprio":
      return p.usage[k] !== undefined && p.lastTurnStart > 0 && p.usage[k] >= p.lastTurnStart;
  }
}

function markUsage(state: GameState, p: PlayerState, o: OwnedAbility) {
  switch (o.ab.limite) {
    case "combate":
      state.combat?.used.push(`${p.id}:${o.key}`);
      break;
    case "rodada":
      p.usage[o.key] = state.round;
      break;
    case "turno":
    case "turnoProprio":
      p.usage[o.key] = state.turnSerial;
      break;
  }
}

function unmark(state: GameState, p: PlayerState, o: OwnedAbility) {
  if (o.ab.limite === "combate" && state.combat) state.combat.used = state.combat.used.filter((u) => u !== `${p.id}:${o.key}`);
  else delete p.usage[o.key];
}

function blockedFor(state: GameState, p: PlayerState, o: OwnedAbility): string | null {
  const s = ACTION_SPECS[o.ab.acao];
  if (!s) return "Ação desconhecida.";
  if (state.phase !== "PLAYING") return "Só durante a partida.";
  if (state.reward && s.combat) return "Aguarde a divisão dos tesouros.";
  if (usageUsed(state, p, o)) {
    return o.ab.limite === "combate" ? "Já usada neste combate." : o.ab.limite === "rodada" ? "Já usada nesta rodada." : "Já usada neste turno.";
  }
  const combat = state.combat;
  if (combat) {
    if (s.combat && combatHas(state, combat, "imuneMagia")) return "Nenhuma habilidade ativa funciona neste combate.";
    for (const { fx } of combatFx(state, combat, "paralisaAtivas")) {
      const immune = strs(fx, "excetoClasses").some((c) => hasClass(state, p, c));
      if (!immune && playerSide(state, combat).includes(p.id)) return "Um monstro impede o uso de ativas do lado dos jogadores.";
    }
    if (combat.silenced.includes(p.id)) return "Uma maldição impede você de usar ativas.";
    if (s.combat && combat.desafio && combat.fighterId !== p.id) return "Desafio: ninguém mais pode jogar neste combate.";
    if (s.combat && combatHas(state, combat, "detectaMentiras") && p.curseCastRound === state.round && !playerSide(state, combat).includes(p.id))
      return "Quem lançou maldição nesta rodada não interfere neste combate.";
  }
  const discard = o.ab.custo.descartar ?? 0;
  const wholeHand = o.ab.custo.descartarMao ?? 0;
  if (discard && p.hand.length < discard) return `Precisa de ${discard} carta(s) na mão.`;
  if (wholeHand && p.hand.length < wholeHand) return `Precisa de pelo menos ${wholeHand} cartas na mão.`;
  return s.check(state, p, o.ab);
}

/** Erro geral de disponibilidade (sem parâmetros), ou null. */
export function abilityBlocked(state: GameState, p: PlayerState, key: AbilityKey): string | null {
  const o = findOwned(state, p, key);
  if (!o) return "Você não tem essa habilidade.";
  return blockedFor(state, p, o);
}

export function activateAbility(state: GameState, ctx: Ctx, p: PlayerState, key: AbilityKey, discard: string[], params: Params) {
  const o = findOwned(state, p, key);
  if (!o) fail("Você não tem essa habilidade.");
  const s = ACTION_SPECS[o.ab.acao];
  const blocked = blockedFor(state, p, o);
  if (blocked) fail(blocked);
  const prepared = s.prepare(state, ctx, p, params, o.ab);
  const reserved = new Set(prepared.paramCards ?? []);
  // Custo de descarte
  let toDiscard: string[] = [];
  const wholeHand = o.ab.custo.descartarMao ?? 0;
  const need = o.ab.custo.descartar ?? 0;
  if (wholeHand) {
    toDiscard = p.hand.filter((id) => !reserved.has(id));
    if (toDiscard.length < wholeHand) fail(`Precisa descartar pelo menos ${wholeHand} cartas.`);
  } else if (need) {
    const uniq = [...new Set(discard)];
    if (uniq.length !== need) fail(`Escolha exatamente ${need} carta(s) para descartar.`);
    for (const id of uniq) {
      if (!p.hand.includes(id)) fail("Só cartas da sua mão podem ser descartadas.");
      if (reserved.has(id)) fail("Você não pode descartar a carta usada como alvo.");
    }
    toDiscard = uniq;
  }
  for (const id of toDiscard) discardFromPlayer(state, p, id);
  markUsage(state, p, o);
  log(state, ctx, `✴️ ${p.name} usou ${o.ab.name}.`, "combat", p.id);

  // Passiva "magiaSelvagem": com sorte, a ativa não conta no limite
  for (const { fx, source } of passiveFxSrc(state, p, "magiaSelvagem")) {
    const r = rollD6(state, p, ctx, source);
    if (r.total >= scaled(fx, "dado", p.level, 6)) {
      unmark(state, p, o);
      log(state, ctx, `✨ ${source}: ${o.ab.name} não conta para o limite.`);
      break;
    }
  }
  // Resistência Lendária
  const combat = state.combat;
  if (combat && s.againstMonster && hasLegendary(state, combat) && !combat.legendaryResistanceUsed && playerSide(state, combat).includes(p.id)) {
    combat.legendaryResistanceUsed = true;
    log(state, ctx, `🛡️ Resistência Lendária anulou ${o.ab.name}!`, "combat");
    onCombatChanged(state, ctx);
    return;
  }
  prepared.run();
  if (state.combat) onCombatChanged(state, ctx);
}

export interface AbilityInfo {
  key: AbilityKey;
  acao: string;
  name: string;
  source: string;
  text: string;
  costText: string;
  discard: number;
  wholeHand: number;
  fields: FieldSpec[];
  available: boolean;
  reason: string | null;
}

function costText(ab: AbilityDef): string {
  const parts: string[] = [];
  if (ab.custo.descartar) parts.push(`Descarte ${ab.custo.descartar} carta(s)`);
  if (ab.custo.descartarMao) parts.push(`Descarte a mão inteira (mín. ${ab.custo.descartarMao})`);
  const limit = { combate: "1x por combate", rodada: "1x por rodada", turno: "1x por turno", turnoProprio: "1x por turno seu" }[ab.limite];
  return [...parts, limit].join(" · ");
}

export function abilityInfos(state: GameState, p: PlayerState): AbilityInfo[] {
  return abilitiesOf(state, p).map((o) => {
    const reason = blockedFor(state, p, o);
    return {
      key: o.key,
      acao: o.ab.acao,
      name: o.ab.name,
      source: o.source,
      text: o.ab.text,
      costText: costText(o.ab),
      discard: o.ab.custo.descartar ?? 0,
      wholeHand: o.ab.custo.descartarMao ?? 0,
      fields: ACTION_SPECS[o.ab.acao]?.fields ?? [],
      available: reason === null,
      reason,
    };
  });
}
