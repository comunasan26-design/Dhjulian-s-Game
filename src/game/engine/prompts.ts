// Respostas (e tempo esgotado) dos prompts pendentes.
import {
  continueReward,
  doCharity,
  giveRewardTo,
  joinHelper,
  nextLoot,
  advanceTurn,
  removePrompt,
} from "./core";
import { type Ctx, type GameState, type HelpDeal, type Prompt, fail } from "./state";
import { equipCheck, handLimit, slotOf } from "./stats";
import {
  defOf,
  discardFromPlayer,
  giveItem,
  log,
  loseLevels,
  nameOf,
  pickRandom,
  player,
  removeFromPlayer,
  shuffle,
  tryPlayer,
} from "./util";

export type PromptAnswer = {
  accept?: boolean;
  cardIds?: string[];
  cardId?: string | null;
  choice?: "item" | "levels";
  block?: boolean;
  discard?: string[];
  myItem?: string;
  theirItem?: string;
};

function arr(x: unknown): string[] {
  return Array.isArray(x) ? (x.filter((v) => typeof v === "string") as string[]) : [];
}

function pickExact(candidates: string[], chosen: string[] | undefined, count: number): string[] {
  const uniq = [...new Set(chosen ?? [])];
  if (uniq.length !== count) fail(`Escolha exatamente ${count} carta(s).`);
  for (const c of uniq) if (!candidates.includes(c)) fail("Escolha inválida.");
  return uniq;
}

/** Pares possíveis da Troca Feérica (item do jogador da esquerda x item da vítima, mesmo slot). */
export function fairyPairs(state: GameState, leftId: string, victimId: string): [string, string][] {
  const left = player(state, leftId);
  const victim = player(state, victimId);
  const pairs: [string, string][] = [];
  for (const a of left.equipped) {
    for (const b of victim.equipped) {
      const sa = slotOf(state, a);
      if (sa && sa === slotOf(state, b)) pairs.push([a, b]);
    }
  }
  return pairs;
}

export function answerPrompt(state: GameState, ctx: Ctx, actorId: string, promptId: string, ans: PromptAnswer) {
  const pr = state.prompts.find((p) => p.id === promptId);
  if (!pr) fail("Essa escolha não está mais disponível.");
  if (pr.playerId !== actorId) fail("Essa escolha não é sua.");
  resolvePrompt(state, ctx, pr, ans, false);
}

export function timeoutPrompt(state: GameState, ctx: Ctx, pr: Prompt) {
  log(state, ctx, `⏱️ Tempo esgotado para ${player(state, pr.playerId).name}: escolha automática.`, "system");
  resolvePrompt(state, ctx, pr, {}, true);
}

function resolvePrompt(state: GameState, ctx: Ctx, pr: Prompt, ans: PromptAnswer, timeout: boolean) {
  const d = pr.data;
  const me = player(state, pr.playerId);
  switch (pr.kind) {
    case "helpRequest": {
      const combat = state.combat;
      const valid = combat && combat.id === d.combatId && !combat.helperId && combat.stage !== "badstuff";
      removePrompt(state, pr.id);
      if (!valid) return;
      const fighter = player(state, String(d.fighterId));
      if (ans.accept && !timeout) {
        joinHelper(state, ctx, me.id, d.deal as HelpDeal, false);
      } else {
        log(state, ctx, `${me.name} recusou ajudar ${fighter.name}.`, "combat");
        if (d.threat) loseLevels(state, me, 1, ctx, "recusou a ameaça do Tridente");
      }
      return;
    }
    case "helpOffer": {
      const combat = state.combat;
      const valid = combat && combat.id === d.combatId && !combat.helperId && combat.stage !== "badstuff";
      removePrompt(state, pr.id);
      if (!valid) return;
      const helper = player(state, String(d.helperId));
      if (ans.accept && !timeout) joinHelper(state, ctx, helper.id, d.deal as HelpDeal, false);
      else log(state, ctx, `${me.name} recusou a ajuda de ${helper.name}.`, "combat");
      return;
    }
    case "fairySwap": {
      const fairy = player(state, String(d.fairyId));
      const mine = String(d.mine);
      const theirs = String(d.theirs);
      if (ans.block && !timeout) {
        const cards = pickExact(me.hand, ans.discard, 2);
        for (const c of cards) discardFromPlayer(state, me, c);
        log(state, ctx, `${me.name} descartou 2 cartas e impediu o Truque Feérico.`);
        removePrompt(state, pr.id);
        return;
      }
      removePrompt(state, pr.id);
      if (!fairy.equipped.includes(mine) || !me.equipped.includes(theirs)) return;
      removeFromPlayer(fairy, mine);
      removeFromPlayer(me, theirs);
      delete state.cards[mine].artificeSecond;
      delete state.cards[theirs].artificeSecond;
      // Equipa direto se possível; senão, vai para a mesa
      if (equipCheck(state, fairy, theirs).error) fairy.carried.push(theirs);
      else fairy.equipped.push(theirs);
      if (equipCheck(state, me, mine).error) me.carried.push(mine);
      else me.equipped.push(mine);
      log(state, ctx, `🧚 ${fairy.name} trocou ${nameOf(state, mine)} por ${nameOf(state, theirs)} de ${me.name}.`);
      return;
    }
    case "chooseLoss": {
      const victim = player(state, String(d.victimId));
      const count = Number(d.count);
      const cands = arr(d.candidates).filter((id) => victim.equipped.includes(id) || victim.carried.includes(id));
      const n = Math.min(count, cands.length);
      const chosen = timeout ? shuffle([...cands], ctx).slice(0, n) : pickExact(cands, ans.cardIds, n);
      removePrompt(state, pr.id);
      for (const id of chosen) {
        log(state, ctx, `${victim.name} perdeu ${nameOf(state, id)}.`);
        discardFromPlayer(state, victim, id);
      }
      return;
    }
    case "bigOrLevels": {
      const victim = player(state, String(d.victimId));
      const bigs = arr(d.bigs).filter((id) => victim.equipped.includes(id));
      removePrompt(state, pr.id);
      const choice = timeout ? "item" : ans.choice;
      if (choice === "item" && bigs.length) {
        if (d.dwarf) {
          log(state, ctx, `⛏️ Teimosia Anã: ${victim.name} não perdeu o item Grande.`);
          return;
        }
        const id = ans.cardId && bigs.includes(ans.cardId) ? ans.cardId : bigs[0];
        log(state, ctx, `${victim.name} perdeu ${nameOf(state, id)}.`);
        discardFromPlayer(state, victim, id);
      } else {
        loseLevels(state, victim, Number(d.levels), ctx, "Gigante das Colinas");
      }
      return;
    }
    case "distribute": {
      const r = state.reward;
      if (!r) {
        removePrompt(state, pr.id);
        return;
      }
      const n = Math.min(Number(d.count), r.cards.length);
      const chosen = timeout ? shuffle([...r.cards], ctx).slice(0, n) : pickExact(r.cards, ans.cardIds, n);
      removePrompt(state, pr.id);
      const helper = player(state, String(d.helperId));
      giveRewardTo(state, ctx, helper, chosen);
      r.deal = null;
      continueReward(state, ctx);
      return;
    }
    case "bardo": {
      const r = state.reward;
      if (!r) {
        removePrompt(state, pr.id);
        return;
      }
      let id: string;
      if (timeout || !ans.cardId) {
        id = [...r.cards].sort((a, b) => priceOf(state, a) - priceOf(state, b))[0];
      } else {
        if (!r.cards.includes(ans.cardId)) fail("Escolha inválida.");
        id = ans.cardId;
      }
      removePrompt(state, pr.id);
      r.cards = r.cards.filter((c) => c !== id);
      state.decks.treasureDiscard.push(id);
      log(state, ctx, `🎶 ${me.name} descartou ${nameOf(state, id)} (Sorte do Bardo).`);
      continueReward(state, ctx);
      return;
    }
    case "loot": {
      const items = arr(d.items);
      const queue = arr(d.queue);
      let take: string | null = null;
      if (!timeout && ans.cardId) {
        if (!items.includes(ans.cardId)) fail("Item inválido.");
        take = ans.cardId;
      }
      removePrompt(state, pr.id);
      const rest = items.filter((i) => i !== take);
      if (take) {
        me.carried.push(take);
        log(state, ctx, `${me.name} pegou ${nameOf(state, take)} de ${String(d.deadName ?? tryPlayer(state, String(d.deadId))?.name ?? "quem saiu")}.`);
      }
      nextLoot(state, ctx, String(d.deadId), rest, queue);
      return;
    }
    case "charity": {
      const count = Math.max(0, me.hand.length - limitFor(state, me.id));
      const chosen = timeout || !ans.cardIds ? shuffle([...me.hand], ctx).slice(0, count) : pickExact(me.hand, ans.cardIds, count);
      removePrompt(state, pr.id);
      if (chosen.length) doCharity(state, ctx, me, chosen);
      if (state.turn.ending && state.order[state.currentIdx] === me.id && !state.combat) {
        state.turn.ending = false;
        advanceTurn(state, ctx);
      }
      return;
    }
    case "trade": {
      removePrompt(state, pr.id);
      const from = tryPlayer(state, String(d.fromId));
      if (!from) return;
      if (!ans.accept || timeout) {
        log(state, ctx, `${me.name} recusou a troca com ${from.name}.`);
        return;
      }
      if (state.combat) fail("Não dá para trocar durante um combate.");
      const give = arr(d.give);
      const take = arr(d.take);
      const okGive = give.every((id) => from.equipped.includes(id) || from.carried.includes(id));
      const okTake = take.every((id) => me.equipped.includes(id) || me.carried.includes(id));
      if (!okGive || !okTake) {
        log(state, ctx, "A troca não é mais possível (itens mudaram).");
        return;
      }
      for (const id of give) giveItem(state, from, me, id);
      for (const id of take) giveItem(state, me, from, id);
      log(
        state,
        ctx,
        `🤝 Troca: ${from.name} deu ${give.map((i) => nameOf(state, i)).join(", ") || "nada"} e recebeu ${
          take.map((i) => nameOf(state, i)).join(", ") || "nada"
        } de ${me.name}.`,
      );
      return;
    }
    case "fairyCurse": {
      const victim = player(state, String(d.victimId));
      const pairs = fairyPairs(state, me.id, victim.id);
      removePrompt(state, pr.id);
      if (pairs.length === 0) {
        log(state, ctx, "Troca Feérica: não há itens no mesmo slot para trocar.", "curse");
        return;
      }
      let pair = pairs.find((p) => p[0] === ans.myItem && p[1] === ans.theirItem);
      if (!pair) {
        if (!timeout) fail("Escolha um par de itens do mesmo slot.");
        pair = pickRandom(pairs, ctx);
      }
      const [a, b] = pair;
      removeFromPlayer(me, a);
      removeFromPlayer(victim, b);
      delete state.cards[a].artificeSecond;
      delete state.cards[b].artificeSecond;
      if (equipCheck(state, me, b).error) me.carried.push(b);
      else me.equipped.push(b);
      if (equipCheck(state, victim, a).error) victim.carried.push(a);
      else victim.equipped.push(a);
      log(state, ctx, `🧚 Troca Feérica: ${me.name} trocou ${nameOf(state, a)} por ${nameOf(state, b)} de ${victim.name}.`, "curse");
      return;
    }
    case "possession": {
      const victim = player(state, String(d.victimId));
      const cands = arr(d.candidates).filter((id) => victim.equipped.includes(id) || victim.carried.includes(id));
      removePrompt(state, pr.id);
      if (cands.length === 0) return;
      let id = ans.cardId ?? null;
      if (!id || !cands.includes(id)) {
        if (!timeout) fail("Escolha um item.");
        id = pickRandom(cands, ctx);
      }
      giveItem(state, victim, me, id);
      log(state, ctx, `👻 Possessão: ${me.name} ficou com ${nameOf(state, id)} de ${victim.name}.`);
      return;
    }
    case "threat": {
      const combat = state.combat;
      const valid = combat && combat.id === d.combatId && combat.stage !== "badstuff";
      removePrompt(state, pr.id);
      const threatener = tryPlayer(state, String(d.threatenerId));
      if (!valid || !threatener) return;
      if (ans.accept && !timeout) {
        combat.bribes.push({ playerId: threatener.id, count: Number(d.count) });
        state.truces = [...(state.truces ?? []), { by: threatener.id, protects: me.id, round: state.round }];
        log(state, ctx, `🤝 ${me.name} aceitou pagar ${String(d.count)} tesouro(s) a ${threatener.name} (se vencer). ${threatener.name} não pode atrapalhar ${me.name} nesta rodada.`, "combat");
      } else {
        log(state, ctx, `${me.name} recusou a ameaça de ${threatener.name}.`, "combat");
      }
      return;
    }
    case "debt": {
      removePrompt(state, pr.id);
      if (me.hand.length === 0) return;
      let id = ans.cardId ?? null;
      if (!id || !me.hand.includes(id)) {
        if (!timeout) fail("Escolha uma carta da mão.");
        id = pickRandom(me.hand, ctx);
      }
      discardFromPlayer(state, me, id);
      log(state, ctx, `😈 Dívida com o Diabo: ${me.name} descartou ${nameOf(state, id)}.`, "curse");
      return;
    }
    default:
      removePrompt(state, pr.id);
  }
}

function priceOf(state: GameState, id: string): number {
  const d = defOf(state, id);
  return "price" in d ? d.price : 0;
}

function limitFor(state: GameState, id: string): number {
  return handLimit(state, player(state, id));
}
