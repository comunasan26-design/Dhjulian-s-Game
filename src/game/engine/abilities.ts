// Habilidades ativas de raças e classes.
import type { ClassId, MonsterCard, RaceId } from "../catalog";
import { classDef, def, raceDef } from "../catalog";
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
  specialIds,
  tier11,
} from "./stats";
import {
  defOf,
  discardCard,
  discardFromPlayer,
  drawCard,
  drawTo,
  gainLevels,
  hasClass,
  hasRace,
  isCurrent,
  itemDef,
  log,
  loseLevels,
  nameOf,
  ownerOf,
  player,
  removeFromPlayer,
  rollD6,
  shuffle,
  uid,
} from "./util";

export type AbilityKey =
  | "luzSagrada"
  | "reforjar"
  | "baforada"
  | "disparoDuplo"
  | "engenhoca"
  | "arremesso"
  | "adaptacao"
  | "brutalidade"
  | "pactoDiabolico"
  | "tempestade"
  | "bugiganga"
  | "galope"
  | "hibernar"
  | "pressagio"
  | "tridente"
  | "cantoSereia"
  | "truqueFeerico"
  | "mordida"
  | "desafio"
  | "encantar"
  | "cura"
  | "roubo"
  | "domarFera"
  | "escudoFe"
  | "esmagar"
  | "labia"
  | "polimorfia"
  | "maldicaoSombria"
  | "pazInterior"
  | "armadilha"
  | "duplicata"
  | "furiaSangrenta"
  | "infusao"
  | "transmutar";

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

type Limit = "combat" | "round" | "turn" | "ownTurn";

interface Spec {
  key: AbilityKey;
  race?: RaceId;
  cls?: ClassId;
  /** Usa o nome da ativa (ou rótulo próprio). */
  label?: string;
  limit: Limit;
  /** Habilidade usada dentro do combate (afetada por Golem, Desafio etc.). */
  combat: boolean;
  /** Conta como "contra" um monstro Lendário (Resistência Lendária). */
  againstMonster?: boolean;
  discard?: number;
  wholeHand?: number;
  costText: string;
  fields: FieldSpec[];
  check: (state: GameState, p: PlayerState) => string | null;
  /** Valida parâmetros e devolve o efeito (sem alterar o estado). */
  prepare: (state: GameState, ctx: Ctx, p: PlayerState, params: Params) => { run: () => void; paramCards?: string[] };
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
  if (opts.notLegendary && d.id === "monster.tarrasque") fail("O Tarrasque não pode ser afetado.");
  return { cm, d };
}

function otherPlayer(state: GameState, p: PlayerState, params: Params, key = "player"): PlayerState {
  const t = player(state, str(params, key));
  if (t.id === p.id) fail("Escolha outro jogador.");
  return t;
}

/** Imagem Espelhada do Ilusionista contra ativas. */
function reflected(state: GameState, ctx: Ctx, actor: PlayerState, target: PlayerState, label: string): boolean {
  if (target.id === actor.id || !hasClass(state, target, "ilusionista")) return false;
  if (hasClass(state, actor, "bruxo") && label === "Maldição Sombria") return false;
  const r = rollD6(state, target, ctx, "Imagem Espelhada");
  if (r.total >= (tier11(target) ? 5 : 6)) {
    log(state, ctx, `🪞 Imagem Espelhada! ${label} de ${actor.name} se volta contra ele.`, "combat");
    return true;
  }
  return false;
}

function canBeHelper(state: GameState, target: PlayerState): string | null {
  const combat = state.combat!;
  if (combat.helperId) return "Já existe um ajudante.";
  if (combat.isolated.includes(combat.fighterId)) return "Ninguém pode ajudar neste combate (Isolamento/Duplicata).";
  if (combat.desafio) return "Desafio: ninguém pode lutar junto.";
  if (target.id === combat.fighterId) return "Escolha outro jogador.";
  if (specialIds(state, combat).has("monster.planetar") && target.curseCastRound === state.round)
    return "Planetar: quem lançou maldição nesta rodada não pode ajudar.";
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
    key: "luzSagrada",
    race: "divino",
    limit: "combat",
    combat: true,
    againstMonster: true,
    discard: 1,
    costText: "Descarte 1 carta",
    fields: [],
    check: onSide,
    prepare: (state, ctx, p) => ({
      run: () => {
        const tags = combatTags(state, state.combat);
        let v = tier11(p) ? 4 : 2;
        if (tags.has("morto-vivo") || tags.has("demonio")) v *= 2;
        state.combat!.playerMods.push({ id: uid(state, "m"), value: v, by: p.id, label: `Luz Sagrada (${p.name})` });
      },
    }),
  },
  {
    key: "reforjar",
    race: "anao",
    limit: "ownTurn",
    combat: false,
    costText: "Descarte 1 item",
    fields: [
      { name: "costItem", kind: "itemHandOrTable", label: "Item a descartar" },
      { name: "item", kind: "ownEquippedNoRing", label: "Item equipado a reforjar" },
    ],
    check: ownTurnFree,
    prepare: (state, ctx, p, params) => {
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
          state.cards[target].reforged = true;
          log(state, ctx, `⚒️ ${p.name} reforjou ${nameOf(state, target)} (+1 permanente).`);
        },
      };
    },
  },
  {
    key: "baforada",
    race: "draconato",
    limit: "combat",
    combat: true,
    againstMonster: true,
    discard: 3,
    costText: "Descarte 3 cartas",
    fields: [],
    check: onSide,
    prepare: (state, ctx, p) => ({
      run: () => {
        state.combat!.playerMods.push({ id: uid(state, "m"), value: tier11(p) ? 7 : 5, by: p.id, label: `Baforada (${p.name})`, fire: true });
      },
    }),
  },
  {
    key: "disparoDuplo",
    race: "elfo",
    limit: "combat",
    combat: true,
    againstMonster: true,
    discard: 3,
    costText: "Descarte 3 cartas",
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
    key: "engenhoca",
    race: "gnomo",
    limit: "combat",
    combat: true,
    costText: "Descarte 1 item da mão",
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
    prepare: (state, ctx, p, params) => {
      const card = str(params, "handItem");
      const d = itemDef(state, card);
      if (!p.hand.includes(card) || !d) fail("Escolha um item da sua mão.");
      const side = params.side === "monster" ? "monster" : "player";
      const isSide = playerSide(state, state.combat!).includes(p.id);
      return {
        paramCards: [card],
        run: () => {
          discardFromPlayer(state, p, card);
          const mod = { id: uid(state, "m"), value: d.bonus, by: p.id, label: `Engenhoca: ${d.name} (${p.name})` };
          if (side === "player") state.combat!.playerMods.push(mod);
          else state.combat!.monsterSideMods.push(mod);
          void isSide;
        },
      };
    },
  },
  {
    key: "arremesso",
    race: "gigante",
    limit: "combat",
    combat: true,
    againstMonster: true,
    costText: "Perca 1 nível e descarte 1 item Grande",
    fields: [{ name: "bigItem", kind: "bigItem", label: "Item Grande" }],
    check: onSide,
    prepare: (state, ctx, p, params) => {
      const card = str(params, "bigItem");
      const d = itemDef(state, card);
      if (!d?.big || !(p.hand.includes(card) || p.equipped.includes(card) || p.carried.includes(card)))
        fail("Escolha um item Grande seu.");
      return {
        paramCards: [card],
        run: () => {
          loseLevels(state, p, 1, ctx, "Arremesso");
          discardFromPlayer(state, p, card);
          state.combat!.playerMods.push({ id: uid(state, "m"), value: d.bonus * 2, by: p.id, label: `Arremesso: ${d.name} (${p.name})` });
        },
      };
    },
  },
  {
    key: "adaptacao",
    race: "humano",
    limit: "turn",
    combat: true,
    againstMonster: true,
    discard: 3,
    costText: "Descarte 3 cartas",
    fields: [{ name: "item", kind: "restrictedItem", label: "Item restrito" }],
    check: onSide,
    prepare: (state, ctx, p, params) => {
      const card = str(params, "item");
      const d = itemDef(state, card);
      if (!d || !(p.hand.includes(card) || p.carried.includes(card))) fail("Escolha um item da mão ou da mesa.");
      if (!meetsRestrictions(state, p, d)) fail("Esse item não é restrito para você.");
      return {
        paramCards: [card],
        run: () => {
          state.combat!.adaptations.push({ cardId: card, playerId: p.id });
          log(state, ctx, `${p.name} usa ${d.name} por Adaptação até o fim do combate.`);
        },
      };
    },
  },
  {
    key: "brutalidade",
    race: "orc",
    limit: "combat",
    combat: true,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [{ name: "monster", kind: "monster", label: "Monstro" }],
    check: onSide,
    prepare: (state, ctx, p, params) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: true });
      return {
        run: () => {
          cm.ignoreSpecial = true;
          log(state, ctx, `💢 O texto Especial de ${d.name} será ignorado.`, "combat");
        },
      };
    },
  },
  {
    key: "pactoDiabolico",
    race: "diabrete",
    limit: "round",
    combat: false,
    discard: 1,
    costText: "Descarte 1 carta",
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
          const final = defendCurse(state, ctx, target, p, "o Pacto Diabólico");
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
    key: "tempestade",
    race: "elemental",
    limit: "combat",
    combat: true,
    againstMonster: true,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [],
    check: onSide,
    prepare: (state, ctx, p) => ({
      run: () => {
        const v = tier11(p) ? -4 : -2;
        for (const cm of activeMonsters(state.combat!)) cm.mods.push({ id: uid(state, "m"), value: v, by: p.id, label: "Tempestade Elemental" });
        state.combat!.playerMods.push({ id: uid(state, "m"), value: 0, by: p.id, label: "Tempestade Elemental (fogo)", fire: true });
      },
    }),
  },
  {
    key: "bugiganga",
    race: "goblin",
    limit: "ownTurn",
    combat: false,
    discard: 1,
    costText: "Descarte 1 carta",
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
            if (reflected(state, ctx, p, owner, "Bugiganga Roubada")) return;
            removeFromPlayer(owner, card);
            p.hand.push(card);
            log(state, ctx, `👺 ${p.name} roubou ${nameOf(state, card)} de ${owner.name}!`);
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
    key: "galope",
    race: "centauro",
    limit: "ownTurn",
    combat: false,
    discard: 1,
    costText: "Descarte 1 carta",
    fields: [],
    check: (state, p) => {
      const e = ownTurnFree(state, p);
      if (e) return e;
      if (state.turnPhase !== "END" || (state.turn.lastResult !== "won" && state.turn.lastResult !== "fled"))
        return "Só depois de vencer ou fugir de um combate.";
      return null;
    },
    prepare: (state, ctx, p) => ({
      run: () => {
        state.turnPhase = "KICK";
        state.turn.revealed = null;
        state.turn.lastResult = null;
        log(state, ctx, `🐎 ${p.name} galopa para a próxima porta!`);
      },
    }),
  },
  {
    key: "hibernar",
    race: "torkle",
    limit: "ownTurn",
    combat: false,
    costText: "Sem custo (no lugar de chutar a porta)",
    fields: [],
    check: (state, p) => {
      const e = ownTurnFree(state, p);
      if (e) return e;
      if (state.turnPhase !== "KICK" || state.turn.fought || state.turn.revealed) return "Só no início do turno, antes de chutar a porta.";
      return null;
    },
    prepare: (state, ctx, p) => ({
      run: () => {
        const got = drawTo(state, p, "treasure", 2, ctx);
        p.hibernating = true;
        state.turnPhase = "END";
        log(state, ctx, `🐢 ${p.name} entrou no casco: comprou ${got.length} Tesouros e fica imune a maldições e roubos.`);
      },
    }),
  },
  {
    key: "pressagio",
    race: "owlin",
    limit: "round",
    combat: false,
    costText: "Coloque 1 carta de Porta da mão no topo do baralho",
    fields: [{ name: "card", kind: "handDoor", label: "Carta de Porta da mão" }],
    check: (state, p) => (p.hand.some((id) => defOf(state, id).deck === "door") ? null : "Você não tem cartas de Porta na mão."),
    prepare: (state, ctx, p, params) => {
      const card = str(params, "card");
      if (!p.hand.includes(card) || defOf(state, card).deck !== "door") fail("Escolha uma carta de Porta da sua mão.");
      return {
        paramCards: [card],
        run: () => {
          removeFromPlayer(p, card);
          const bottom = state.decks.door.pop();
          state.decks.door.unshift(card);
          if (bottom) p.hand.push(bottom);
          log(state, ctx, `🦉 ${p.name} usou Presságio.`);
        },
      };
    },
  },
  {
    key: "tridente",
    race: "tritao",
    label: "Tridente",
    limit: "round",
    combat: true,
    costText: "Sem custo (ameaça: quem recusar perde 1 nível)",
    fields: [
      { name: "player", kind: "player", label: "Jogador ameaçado" },
      { name: "dealCount", kind: "dealCount", label: "Tesouros oferecidos" },
      { name: "dealMode", kind: "dealMode", label: "Divisão" },
    ],
    check: (state, p) => {
      const e = isFighter(state, p);
      if (e) return e;
      if (state.combat!.helperId) return "Você já tem ajudante.";
      if (specialIds(state, state.combat).has("monster.bugbear")) return "Bugbear: você não pode pedir ajuda.";
      return null;
    },
    prepare: (state, ctx, p, params) => {
      const target = otherPlayer(state, p, params);
      const err = canBeHelper(state, target);
      if (err) fail(err);
      const deal = parseDeal(params);
      return {
        run: () => {
          if (reflected(state, ctx, p, target, "Tridente")) return;
          createPrompt(state, ctx, "helpRequest", target.id, { fighterId: p.id, deal, threat: true, combatId: state.combat!.id });
          log(state, ctx, `🔱 ${p.name} ameaça ${target.name}: ajude ou perca 1 nível!`, "combat");
        },
      };
    },
  },
  {
    key: "cantoSereia",
    race: "tritao",
    label: "Canto da Sereia",
    limit: "round",
    combat: true,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [{ name: "player", kind: "player", label: "Jogador encantado" }],
    check: (state, p) => {
      const e = isFighter(state, p);
      if (e) return e;
      if (state.combat!.helperId) return "Você já tem ajudante.";
      return null;
    },
    prepare: (state, ctx, p, params) => {
      const target = otherPlayer(state, p, params);
      const err = canBeHelper(state, target);
      if (err) fail(err);
      return {
        run: () => {
          if (reflected(state, ctx, p, target, "Canto da Sereia")) return;
          log(state, ctx, `🧜 O Canto da Sereia obriga ${target.name} a ajudar!`, "combat");
          joinHelper(state, ctx, target.id, null, true);
        },
      };
    },
  },
  {
    key: "truqueFeerico",
    race: "fada",
    limit: "ownTurn",
    combat: false,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [
      { name: "item", kind: "ownEquipped", label: "Seu item" },
      { name: "player", kind: "player", label: "Jogador" },
      { name: "otherItem", kind: "otherEquipped", label: "Item dele (mesmo slot)" },
    ],
    check: ownTurnFree,
    prepare: (state, ctx, p, params) => {
      const mine = str(params, "item");
      const target = otherPlayer(state, p, params);
      const theirs = str(params, "otherItem");
      if (!p.equipped.includes(mine) || !target.equipped.includes(theirs)) fail("Escolha itens equipados.");
      if (slotOf(state, mine) !== slotOf(state, theirs)) fail("Os itens precisam ser do mesmo slot.");
      if (isLegendaryItem(state, mine) || isLegendaryItem(state, theirs)) fail("Não funciona com itens Lendários.");
      if ((state.cards[theirs].runes ?? []).some((r) => state.cards[r]?.defId === "rune.vinculo")) fail("Runa do Vínculo: esse item não pode ser trocado.");
      if (target.hibernating) fail(`${target.name} está no casco.`);
      return {
        run: () => {
          if (reflected(state, ctx, p, target, "Truque Feérico")) return;
          createPrompt(state, ctx, "fairySwap", target.id, { fairyId: p.id, mine, theirs });
          log(state, ctx, `🧚 ${p.name} tenta trocar ${nameOf(state, mine)} por ${nameOf(state, theirs)} de ${target.name}.`);
        },
      };
    },
  },
  {
    key: "mordida",
    race: "vampirico",
    limit: "ownTurn",
    combat: false,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [{ name: "player", kind: "player", label: "Vítima (nível ≥ ao seu)" }],
    check: (state, p) => {
      const e = ownTurnFree(state, p);
      if (e) return e;
      if (!state.turn.wonCombat) return "Só depois de vencer um combate neste turno.";
      if (p.level >= 19) return "A Mordida nunca leva ao nível 20.";
      return null;
    },
    prepare: (state, ctx, p, params) => {
      const target = otherPlayer(state, p, params);
      if (target.level < p.level) fail("A vítima precisa ter nível igual ou maior que o seu.");
      return {
        run: () => {
          if (reflected(state, ctx, p, target, "Mordida")) {
            loseLevels(state, p, 1, ctx, "Mordida refletida");
            gainLevels(state, target, 1, ctx, false, "Mordida refletida");
            return;
          }
          const lost = loseLevels(state, target, 1, ctx, `Mordida de ${p.name}`);
          if (lost) gainLevels(state, p, 1, ctx, false, "Mordida");
        },
      };
    },
  },
  {
    key: "desafio",
    cls: "guerreiro",
    limit: "combat",
    combat: true,
    againstMonster: true,
    wholeHand: 4,
    costText: "Descarte a mão (mín. 4) e seu item equipado de maior bônus",
    fields: [],
    check: (state, p) => {
      const e = isFighter(state, p);
      if (e) return e;
      if (state.combat!.stage !== "fight") return "Só antes de resolver o combate.";
      if (p.equipped.length === 0) return "Você precisa de um item equipado.";
      return null;
    },
    prepare: (state, ctx, p) => ({
      run: () => {
        const combat = state.combat!;
        const best = [...p.equipped].sort((a, b) => worth(state, b) - worth(state, a))[0];
        if (best) {
          log(state, ctx, `${p.name} sacrificou ${nameOf(state, best)}.`);
          discardFromPlayer(state, p, best);
        }
        if (combat.helperId) removeHelper(state, ctx, "Desafio");
        cancelHelpPrompts(state);
        combat.desafio = true;
        log(state, ctx, `⚔️ ${p.name} lançou um DESAFIO! Ninguém mais pode jogar cartas neste combate.`, "combat");
      },
    }),
  },
  {
    key: "encantar",
    cls: "mago",
    limit: "combat",
    combat: true,
    wholeHand: 3,
    costText: "Descarte a mão inteira (mín. 3)",
    fields: [{ name: "monster", kind: "monster", label: "Monstro" }],
    check: onSide,
    prepare: (state, ctx, p, params) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: true });
      return {
        run: () => {
          const got = drawTo(state, p, "treasure", d.treasures, ctx);
          log(state, ctx, `✨ ${p.name} encantou ${d.name} e ganhou ${got.length} tesouro(s).`, "combat");
          removeMonster(state, ctx, cm.cardId);
        },
      };
    },
  },
  {
    key: "cura",
    cls: "clerigo",
    limit: "round",
    combat: false,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [
      { name: "player", kind: "player", label: "Jogador (você ou outro)" },
      { name: "mode", kind: "curaMode", label: "O que curar" },
      { name: "curse", kind: "targetCurse", label: "Maldição", optional: true },
    ],
    check: () => null,
    prepare: (state, ctx, p, params) => {
      const target = player(state, str(params, "player"));
      if (params.mode === "level") {
        const avail =
          target.lostRound === state.round ? target.lostRoundAmount - target.lostRoundCorpoSeco : 0;
        if (avail <= 0) fail("Esse jogador não perdeu níveis curáveis nesta rodada.");
        return {
          run: () => {
            target.lostRoundAmount -= 1;
            gainLevels(state, target, 1, ctx, false, `Cura de ${p.name}`);
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
          log(state, ctx, `💚 ${p.name} removeu uma maldição de ${target.name}.`, "curse");
        },
      };
    },
  },
  {
    key: "roubo",
    cls: "ladino",
    limit: "round",
    combat: false,
    discard: 1,
    costText: "Descarte 1 carta e role 1d6",
    fields: [
      { name: "player", kind: "player", label: "Vítima" },
      { name: "otherItem", kind: "otherEquipped", label: "Item equipado (não Grande)" },
      { name: "kit", kind: "kit", label: "Usar Kit de Ladrão", optional: true },
    ],
    check: () => null,
    prepare: (state, ctx, p, params) => stealPrepare(state, ctx, p, params),
  },
  {
    key: "domarFera",
    cls: "druida",
    limit: "round",
    combat: true,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [{ name: "monster", kind: "monster", label: "Monstro Animal" }],
    check: isFighter,
    prepare: (state, ctx, p, params) => {
      const { cm, d } = combatMonster(state, params);
      if (!d.tags.includes("animal")) fail("Só monstros Animal.");
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
    key: "escudoFe",
    cls: "paladino",
    limit: "round",
    combat: true,
    costText: "Sem custo; depois compre 3 Tesouros",
    fields: [{ name: "player", kind: "victim", label: "Jogador a proteger" }],
    check: (state) => {
      if (!state.combat?.flee) return "Só quando alguém vai sofrer Coisas Ruins.";
      return null;
    },
    prepare: (state, ctx, p, params) => {
      const victim = otherPlayer(state, p, params);
      const flee = state.combat!.flee!;
      if (!flee.results.some((r) => r.playerId === victim.id && !r.success)) fail("Esse jogador não vai sofrer Coisas Ruins.");
      if (flee.substitutes[victim.id]) fail("Alguém já assumiu por ele.");
      return {
        run: () => {
          flee.substitutes[victim.id] = p.id;
          flee.confirmed = flee.confirmed.filter((id) => id !== p.id);
          log(state, ctx, `🛡️ ${p.name} vai assumir as Coisas Ruins de ${victim.name}!`, "combat");
        },
      };
    },
  },
  {
    key: "esmagar",
    cls: "barbaro",
    limit: "combat",
    combat: true,
    againstMonster: true,
    wholeHand: 4,
    costText: "Descarte a mão inteira (mín. 4)",
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
        log(state, ctx, `💥 ${p.name} esmagou ${removed} bônus do monstro!`, "combat");
      },
    }),
  },
  {
    key: "labia",
    cls: "bardo",
    limit: "round",
    combat: true,
    discard: 1,
    costText: "Descarte 1 carta",
    fields: [{ name: "monster", kind: "monster", label: "Monstro" }],
    check: onSide,
    prepare: (state, ctx, p, params) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: true });
      return {
        run: () => {
          const got = drawTo(state, p, "treasure", Math.floor(d.treasures / 2), ctx);
          log(state, ctx, `🎶 ${p.name} convenceu ${d.name} a ir embora e ganhou ${got.length} tesouro(s).`, "combat");
          removeMonster(state, ctx, cm.cardId);
        },
      };
    },
  },
  {
    key: "polimorfia",
    cls: "feiticeiro",
    limit: "combat",
    combat: true,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [{ name: "monster", kind: "monster", label: "Monstro" }],
    check: onSide,
    prepare: (state, ctx, p, params) => {
      const { cm, d } = combatMonster(state, params, { notLegendary: true });
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
    key: "maldicaoSombria",
    cls: "bruxo",
    limit: "round",
    combat: false,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [{ name: "player", kind: "player", label: "Alvo" }],
    check: () => null,
    prepare: (state, ctx, p, params) => {
      const target = otherPlayer(state, p, params);
      return {
        run: () => {
          p.curseCastRound = state.round;
          const final = defendCurse(state, ctx, target, p, "Maldição Sombria");
          if (!final) return;
          const v = tier11(p) ? 5 : 3;
          addSpecialCurse(state, final, "special.sombria", v, 1, p.id);
          log(state, ctx, `🌑 ${final.name} está sob Maldição Sombria (-${v}).`, "curse");
          if (state.combat) onCombatChanged(state, ctx);
        },
      };
    },
  },
  {
    key: "pazInterior",
    cls: "monge",
    limit: "round",
    combat: true,
    discard: 2,
    costText: "Descarte 2 cartas",
    fields: [],
    check: (state, p) => {
      const e = onSide(state, p);
      if (e) return e;
      if (hasLegendary(state, state.combat!)) return "Não funciona em Lendários.";
      return null;
    },
    prepare: (state, ctx, p) => ({
      run: () => {
        log(state, ctx, `☮️ ${p.name} encontrou a Paz Interior: o combate termina sem vencedor.`, "combat");
        endCombat(state, ctx, "ended");
      },
    }),
  },
  {
    key: "armadilha",
    cls: "patrulheiro",
    limit: "round",
    combat: true,
    discard: 2,
    costText: "Descarte 2 cartas",
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
          log(state, ctx, `🪤 ${p.name} prendeu ${nameOf(state, id)} numa armadilha!`, "combat");
          removeMonster(state, ctx, id);
        },
      };
    },
  },
  {
    key: "duplicata",
    cls: "ilusionista",
    limit: "combat",
    combat: true,
    againstMonster: true,
    discard: 2,
    costText: "Descarte 2 cartas + 1 monstro da mão",
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
          log(state, ctx, `👥 Duplicata: ${d.name} luta ao lado de ${p.name} (+${Math.ceil(d.level / 2)}).`, "combat");
        },
      };
    },
  },
  {
    key: "furiaSangrenta",
    cls: "berserker",
    limit: "combat",
    combat: true,
    againstMonster: true,
    discard: 4,
    costText: "Descarte 4 cartas",
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
    key: "infusao",
    cls: "artifice",
    limit: "combat",
    combat: true,
    againstMonster: true,
    discard: 3,
    costText: "Descarte 3 cartas",
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
          log(state, ctx, `🔧 Infusão: ${nameOf(state, card)} tem o bônus dobrado.`, "combat");
        },
      };
    },
  },
  {
    key: "transmutar",
    cls: "alquimista",
    limit: "ownTurn",
    combat: false,
    discard: 2,
    costText: "Descarte 2 cartas",
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
        log(state, ctx, `⚗️ ${p.name} transmutou uma poção.`);
      },
    }),
  },
];

function worth(state: GameState, cardId: string): number {
  const d = defOf(state, cardId);
  const bonus = d.kind === "item" ? d.bonus : d.kind === "monster" ? d.treasures : 0;
  return bonus * 10000 + ("price" in d ? d.price : 0);
}

function stealPrepare(state: GameState, ctx: Ctx, p: PlayerState, params: Params) {
  const target = otherPlayer(state, p, params);
  const card = str(params, "otherItem");
  if (!target.equipped.includes(card)) fail("Escolha um item equipado da vítima.");
  const d = itemDef(state, card);
  if (d?.big) fail("Não dá para roubar itens Grandes.");
  if (hasClass(state, target, "ladino")) fail(`${target.name} é Ladino: os itens dele não podem ser roubados.`);
  if (target.hibernating) fail(`${target.name} está no casco (imune a roubos).`);
  if ((state.cards[card].runes ?? []).some((r) => state.cards[r]?.defId === "rune.vinculo")) fail("Runa do Vínculo: não pode ser roubado.");
  const kitId = optStr(params, "kit");
  const isThief = hasClass(state, p, "ladino");
  if (kitId && !(p.hand.includes(kitId) || p.carried.includes(kitId))) fail("Kit de Ladrão inválido.");
  if (kitId && state.cards[kitId]?.defId !== "misc.kit-ladrao") fail("Kit de Ladrão inválido.");
  if (!isThief && !kitId) fail("Sem ser Ladino, você precisa de um Kit de Ladrão.");
  return {
    paramCards: kitId ? [kitId] : [],
    run: () => {
      if (kitId) discardFromPlayer(state, p, kitId);
      if (reflected(state, ctx, p, target, "Roubo")) {
        loseLevels(state, p, 1, ctx, "Roubo refletido");
        return;
      }
      const r = rollD6(state, p, ctx, `Roubo em ${target.name}`);
      const bonus = kitId && isThief ? 2 : 0;
      const need = isThief ? 4 : 5;
      if (r.total + bonus >= need) {
        removeFromPlayer(target, card);
        delete state.cards[card].artificeSecond;
        p.carried.push(card);
        log(state, ctx, `🗡️ ${p.name} roubou ${nameOf(state, card)} de ${target.name}!`);
      } else {
        log(state, ctx, `🗡️ ${p.name} foi pego tentando roubar ${target.name}.`);
        loseLevels(state, p, 1, ctx, "Roubo fracassado");
      }
    },
  };
}

export const ABILITY_SPECS: Record<AbilityKey, Spec> = Object.fromEntries(SPECS.map((s) => [s.key, s])) as Record<AbilityKey, Spec>;

export function abilityName(key: AbilityKey): string {
  const s = ABILITY_SPECS[key];
  if (s.label) return s.label;
  if (s.race) return raceDef(s.race).active.name;
  if (s.cls) return classDef(s.cls).active.name;
  return key;
}

/** Habilidades que o jogador possui (por raça/classe ou Kit de Ladrão). */
export function abilitiesOf(state: GameState, p: PlayerState): AbilityKey[] {
  const out: AbilityKey[] = [];
  for (const s of SPECS) {
    if (s.race && hasRace(state, p, s.race)) out.push(s.key);
    else if (s.cls && hasClass(state, p, s.cls)) out.push(s.key);
  }
  if (!out.includes("roubo") && [...p.hand, ...p.carried].some((id) => state.cards[id]?.defId === "misc.kit-ladrao"))
    out.push("roubo");
  return out;
}

function usageUsed(state: GameState, p: PlayerState, s: Spec): boolean {
  const k = s.key;
  switch (s.limit) {
    case "combat":
      return !!state.combat?.used.includes(`${p.id}:${k}`);
    case "round":
      return p.usage[k] === state.round;
    case "turn":
      return p.usage[k] === state.turnSerial;
    case "ownTurn":
      return p.usage[k] !== undefined && p.lastTurnStart > 0 && p.usage[k] >= p.lastTurnStart;
  }
}

function markUsage(state: GameState, p: PlayerState, s: Spec) {
  switch (s.limit) {
    case "combat":
      state.combat?.used.push(`${p.id}:${s.key}`);
      break;
    case "round":
      p.usage[s.key] = state.round;
      break;
    case "turn":
      p.usage[s.key] = state.turnSerial;
      break;
    case "ownTurn":
      p.usage[s.key] = state.turnSerial;
      break;
  }
}

/** Erro geral de disponibilidade (sem parâmetros), ou null. */
export function abilityBlocked(state: GameState, p: PlayerState, key: AbilityKey): string | null {
  const s = ABILITY_SPECS[key];
  if (!abilitiesOf(state, p).includes(key)) return "Você não tem essa habilidade.";
  if (state.phase !== "PLAYING") return "Só durante a partida.";
  if (state.reward && s.combat) return "Aguarde a divisão dos tesouros.";
  if (usageUsed(state, p, s)) {
    return s.limit === "combat"
      ? "Já usada neste combate."
      : s.limit === "round"
        ? "Já usada nesta rodada."
        : "Já usada neste turno.";
  }
  const combat = state.combat;
  if (combat) {
    const specials = specialIds(state, combat);
    if (s.combat && specials.has("monster.golem")) return "Golem de Ferro: nenhuma habilidade ativa funciona neste combate.";
    if (specials.has("monster.carnical") && playerSide(state, combat).includes(p.id) && !hasClass(state, p, "clerigo"))
      return "Carniçal: ninguém do lado dos jogadores usa ativas.";
    if (combat.silenced.includes(p.id)) return "Silêncio Arcano: você não pode usar ativas.";
    if (s.combat && combat.desafio && combat.fighterId !== p.id) return "Desafio: ninguém mais pode jogar neste combate.";
    if (s.combat && specials.has("monster.planetar") && p.curseCastRound === state.round && !playerSide(state, combat).includes(p.id))
      return "Planetar: quem lançou maldição nesta rodada não interfere.";
  }
  if (s.discard && p.hand.length < s.discard) return `Precisa de ${s.discard} carta(s) na mão.`;
  if (s.wholeHand && p.hand.length < s.wholeHand) return `Precisa de pelo menos ${s.wholeHand} cartas na mão.`;
  return s.check(state, p);
}

export function activateAbility(
  state: GameState,
  ctx: Ctx,
  p: PlayerState,
  key: AbilityKey,
  discard: string[],
  params: Params,
) {
  const s = ABILITY_SPECS[key];
  if (!s) fail("Habilidade desconhecida.");
  const blocked = abilityBlocked(state, p, key);
  if (blocked) fail(blocked);
  const prepared = s.prepare(state, ctx, p, params);
  const reserved = new Set(prepared.paramCards ?? []);
  // Custo de descarte
  let toDiscard: string[] = [];
  if (s.wholeHand) {
    toDiscard = p.hand.filter((id) => !reserved.has(id));
    if (toDiscard.length < s.wholeHand) fail(`Precisa descartar pelo menos ${s.wholeHand} cartas.`);
  } else if (s.discard) {
    const uniq = [...new Set(discard)];
    if (uniq.length !== s.discard) fail(`Escolha exatamente ${s.discard} carta(s) para descartar.`);
    for (const id of uniq) {
      if (!p.hand.includes(id)) fail("Só cartas da sua mão podem ser descartadas.");
      if (reserved.has(id)) fail("Você não pode descartar a carta usada como alvo.");
    }
    toDiscard = uniq;
  }
  for (const id of toDiscard) discardFromPlayer(state, p, id);
  markUsage(state, p, s);
  const name = abilityName(key);
  log(state, ctx, `✴️ ${p.name} usou ${name}.`, "combat", p.id);

  // Magia Selvagem (Feiticeiro)
  if (hasClass(state, p, "feiticeiro")) {
    const r = rollD6(state, p, ctx, "Magia Selvagem");
    if (r.total >= 6) {
      unmark(state, p, s);
      log(state, ctx, `✨ Magia Selvagem: ${name} não conta para o limite.`);
    }
  }
  // Resistência Lendária
  const combat = state.combat;
  if (
    combat &&
    s.againstMonster &&
    hasLegendary(state, combat) &&
    !combat.legendaryResistanceUsed &&
    playerSide(state, combat).includes(p.id)
  ) {
    combat.legendaryResistanceUsed = true;
    log(state, ctx, `🛡️ Resistência Lendária anulou ${name}!`, "combat");
    onCombatChanged(state, ctx);
    return;
  }
  prepared.run();
  if (state.combat) onCombatChanged(state, ctx);
}

function unmark(state: GameState, p: PlayerState, s: Spec) {
  if (s.limit === "combat" && state.combat) {
    state.combat.used = state.combat.used.filter((u) => u !== `${p.id}:${s.key}`);
  } else {
    delete p.usage[s.key];
  }
}

export interface AbilityInfo {
  key: AbilityKey;
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

export function abilityInfos(state: GameState, p: PlayerState): AbilityInfo[] {
  return abilitiesOf(state, p).map((key) => {
    const s = ABILITY_SPECS[key];
    const reason = abilityBlocked(state, p, key);
    let source = "Kit de Ladrão";
    let text = "Roube 1 item equipado (não Grande): sucesso com 5+ sem ser Ladino; falha perde 1 nível.";
    if (s.race && hasRace(state, p, s.race)) {
      source = raceDef(s.race).name;
      text = raceDef(s.race).active.text;
    } else if (s.cls && hasClass(state, p, s.cls)) {
      source = classDef(s.cls).name;
      text = classDef(s.cls).active.text;
    }
    return {
      key,
      name: abilityName(key),
      source,
      text,
      costText: s.costText,
      discard: s.discard ?? 0,
      wholeHand: s.wholeHand ?? 0,
      fields: s.fields,
      available: reason === null,
      reason,
    };
  });
}
