import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "../catalog";
import { abilityInfos } from "./abilities";
import { applyAction, type Action, tick } from "./actions";
import { createGame } from "./core";
import { type Ctx, type GameState, GameError } from "./state";
import { viewFor } from "./view";

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Toda carta (não virtual) precisa estar em exatamente um lugar. */
function checkConservation(state: GameState) {
  const seen = new Map<string, string>();
  const put = (id: string, where: string) => {
    if (seen.has(id)) throw new Error(`Carta ${id} (${state.cards[id]?.defId}) em dois lugares: ${seen.get(id)} e ${where}`);
    seen.set(id, where);
    for (const r of state.cards[id]?.runes ?? []) put(r, `${where}/runa`);
  };
  state.decks.door.forEach((id) => put(id, "door"));
  state.decks.treasure.forEach((id) => put(id, "treasure"));
  state.decks.doorDiscard.forEach((id) => put(id, "doorDiscard"));
  state.decks.treasureDiscard.forEach((id) => put(id, "treasureDiscard"));
  for (const p of state.players) {
    p.hand.forEach((id) => put(id, `${p.name}.hand`));
    p.equipped.forEach((id) => put(id, `${p.name}.equipped`));
    p.carried.forEach((id) => put(id, `${p.name}.carried`));
    if (p.race) put(p.race, `${p.name}.race`);
    p.classes.forEach((id) => put(id, `${p.name}.class`));
    p.curses.forEach((c) => c.cardId && put(c.cardId, `${p.name}.curse`));
    p.pendingCombatCurses.forEach((c) => put(c.cardId, `${p.name}.pending`));
    p.ambush.forEach((id) => put(id, `${p.name}.ambush`));
  }
  if (state.combat) {
    state.combat.monsters.forEach((m) => put(m.cardId, "combat"));
    state.combat.allies.forEach((m) => put(m.cardId, "ally"));
  }
  state.reward?.cards.forEach((id) => put(id, "reward"));
  for (const pr of state.prompts) {
    if (pr.kind === "loot") (pr.data.items as string[]).forEach((id) => put(id, "loot"));
  }
  const total = ALL_CARDS.reduce((a, c) => a + (c.copies ?? 1), 0);
  const realSeen = [...seen.keys()].filter((id) => !state.cards[id]?.virtual).length;
  if (realSeen !== total) {
    const missing = Object.keys(state.cards).filter((id) => !seen.has(id) && !state.cards[id].virtual);
    throw new Error(`Cartas sumiram: ${missing.map((m) => state.cards[m].defId).join(", ")} (${realSeen}/${total})`);
  }
}

function candidateActions(state: GameState, pid: string, rand: () => number): Action[] {
  const v = viewFor(state, pid, 0);
  const me = v.players.find((p) => p.id === pid)!;
  if (!me) return [{ type: "TICK" }];
  const others = v.players.filter((p) => p.id !== pid);
  const pick = <T,>(arr: T[]): T | undefined => arr[Math.floor(rand() * arr.length)];
  const hand = me.hand ?? [];
  const acts: Action[] = [];
  const other = pick(others)?.id ?? pid;
  for (const pr of v.prompts.filter((p) => p.playerId === pid)) {
    const d = pr.data ?? {};
    const cands = (d.candidates as string[]) ?? (d.cards as string[]) ?? (d.items as string[]) ?? hand;
    const count = Number(d.count ?? 1);
    acts.push({
      type: "ANSWER",
      promptId: pr.id,
      answer: {
        accept: rand() < 0.6,
        cardIds: [...cands].sort(() => rand() - 0.5).slice(0, count),
        cardId: pick(cands) ?? null,
        choice: rand() < 0.5 ? "item" : "levels",
        block: rand() < 0.3,
        discard: hand.slice(0, 2),
      },
    });
  }
  if (state.phase === "SETUP") {
    acts.push({ type: "READY" });
    for (const c of hand) acts.push({ type: "EQUIP", cardId: c });
    return acts;
  }
  const c = state.combat;
  acts.push({ type: "KICK_DOOR" }, { type: "LOOT_ROOM" }, { type: "END_TURN" }, { type: "END_TURN" });
  for (const card of hand) {
    acts.push({ type: "EQUIP", cardId: card });
    acts.push({ type: "LOOK_FOR_TROUBLE", cardId: card });
    acts.push({ type: "PLAY_CURSE", cardId: card, targetId: other });
    acts.push({ type: "PLAY_LEVELUP", cardId: card });
    acts.push({ type: "PLAY_RACE", cardId: card });
    acts.push({ type: "PLAY_CLASS", cardId: card });
    acts.push({ type: "PLACE", cardId: card });
    if (c) {
      const m = pick(c.monsters)?.cardId ?? "";
      acts.push({ type: "PLAY_MONSTER_BONUS", cardId: card, monsterId: m });
      acts.push({ type: "PLAY_WANDERING", cardId: card, monsterCardId: pick(hand) ?? "" });
      acts.push({ type: "USE_CARD", cardId: card, side: rand() < 0.5 ? "player" : "monster", monsterId: m, targetId: pick(v.players)?.id, index: 0 });
      acts.push({ type: "SCREAMER_ADD", monsterCardId: card });
    } else {
      acts.push({ type: "USE_CARD", cardId: card, targetId: pick(v.players)?.id });
    }
  }
  for (const card of me.carried) {
    acts.push({ type: "EQUIP", cardId: card });
    acts.push({ type: "SOCKET_RUNE", runeId: card, itemId: pick(me.equipped) ?? "" });
  }
  if (me.equipped.length && rand() < 0.2) acts.push({ type: "SELL", cardIds: [pick(me.equipped)!] });
  if (hand.length > 3 && rand() < 0.1) acts.push({ type: "DISCARD", cardId: pick(hand)! });
  if (c) {
    acts.push({ type: "RESOLVE" }, { type: "RESOLVE" }, { type: "FLEE" }, { type: "PASS" }, { type: "ACCEPT_BAD_STUFF" });
    acts.push({ type: "ASK_HELP", targetId: other, count: Math.floor(rand() * 3), mode: pick(["random", "fighter", "helper"] as const)! });
    acts.push({ type: "OFFER_HELP", count: 1, mode: "random" });
    acts.push({ type: "REROLL", index: 0, source: rand() < 0.5 ? "dado" : "cajado" });
    acts.push({ type: "WISH_RING" }, { type: "ARCO" }, { type: "SOPRO" }, { type: "ACCEPT_WISH" }, { type: "THREATEN", count: 1 });
    for (const m of c.monsters) acts.push({ type: "DISPENSE", monsterId: m.cardId, discardId: pick(hand) });
  }
  if (rand() < 0.002 && state.players.length > 3) acts.push({ type: "SURRENDER" });
  acts.push({ type: "CATADOR" }, { type: "OWL_PEEK" }, { type: "OWL_DECIDE", bottom: rand() < 0.5 });
  acts.push({ type: "MEDALHAO", targetId: other });
  acts.push({ type: "TRADE", toId: other, give: me.carried.slice(0, 1), take: [] });
  acts.push({ type: "KISS", targetId: other, cardId: pick(hand) ?? "" });
  for (const ab of abilityInfos(state, state.players.find((p) => p.id === pid)!)) {
    if (!ab.available) continue;
    const params: Record<string, unknown> = {};
    for (const f of ab.fields) {
      switch (f.kind) {
        case "player":
        case "victim":
          params[f.name] = other;
          break;
        case "monster":
        case "wandering":
          params[f.name] = pick(c?.monsters ?? [])?.cardId;
          break;
        case "ownEquipped":
        case "ownEquippedNoRing":
          params[f.name] = pick(me.equipped);
          break;
        case "otherEquipped":
          params[f.name] = pick(v.players.find((p) => p.id === other)?.equipped ?? []);
          break;
        case "handItem":
        case "handDoor":
        case "handMonster":
          params[f.name] = pick(hand);
          break;
        case "itemHandOrTable":
        case "bigItem":
        case "restrictedItem":
          params[f.name] = pick([...hand, ...me.carried, ...me.equipped]);
          break;
        case "ownCurse":
          params[f.name] = pick(me.curses)?.id;
          break;
        case "targetCurse":
          params[f.name] = pick(v.players.flatMap((p) => p.curses))?.id;
          break;
        case "side":
          params[f.name] = rand() < 0.5 ? "player" : "monster";
          break;
        case "combatItem":
          params[f.name] = pick(me.equipped);
          break;
        case "curaMode":
          params[f.name] = rand() < 0.5 ? "level" : "curse";
          break;
        case "goblinMode":
          params[f.name] = rand() < 0.5 ? "discard" : "steal";
          break;
        case "discardItem":
          params[f.name] = pick(v.decks.treasureDiscard);
          break;
        case "faceUpTreasure":
          params[f.name] = pick(v.lastFaceUp?.cards ?? []);
          break;
        case "dealCount":
          params[f.name] = 1;
          break;
        case "dealMode":
          params[f.name] = "random";
          break;
        case "kit":
          params[f.name] = undefined;
          break;
      }
    }
    const n = ab.wholeHand ? 0 : ab.discard;
    acts.push({ type: "ABILITY", key: ab.key, discard: [...hand].sort(() => rand() - 0.5).slice(0, n), params });
  }
  return acts;
}

export const stats: Record<string, { ok: number; fail: number }> = {};
export const abilityStats: Record<string, number> = {};

function progressAction(state: GameState, rand: () => number): Action | null {
  const c = state.combat;
  if (state.phase === "SETUP") return { type: "READY" };
  if (c) {
    if (c.stage === "badstuff") return { type: "ACCEPT_BAD_STUFF" };
    if (c.stage === "resolving") return { type: "TICK" };
    return rand() < 0.5 ? { type: "RESOLVE" } : { type: "FLEE" };
  }
  if (state.turnPhase === "KICK") return { type: "KICK_DOOR" };
  return { type: "END_TURN" };
}

function runGame(seed: number, nPlayers: number, steps: number) {
  const rand = mulberry(seed);
  let now = 1_000_000;
  const ctx = (): Ctx => ({ now, rng: { int: (m: number) => Math.floor(rand() * m) } });
  const players = Array.from({ length: nPlayers }, (_, i) => ({ id: `u${i}`, name: `P${i}` }));
  const state = createGame(players, "u0", ctx());
  checkConservation(state);
  let ok = 0;
  for (let i = 0; i < steps && state.phase !== "FINISHED"; i++) {
    now += Math.floor(rand() * 4000);
    if (rand() < 0.05) now += 60_000; // estoura prazos às vezes
    // Quem tem prompt pendente responde primeiro; senão, em geral o jogador da vez age
    const promptOwner = state.prompts.length && rand() < 0.7 ? state.prompts[0].playerId : null;
    const pid = promptOwner ?? (rand() < 0.6 ? state.order[state.currentIdx] : players[Math.floor(rand() * nPlayers)].id);
    const acts = candidateActions(state, pid, rand);
    let a = acts[Math.floor(rand() * acts.length)];
    if (!promptOwner && pid === state.order[state.currentIdx] && rand() < 0.5) a = progressAction(state, rand) ?? a;
    stats[a.type] = stats[a.type] ?? { ok: 0, fail: 0 };
    const snapshot = JSON.stringify(state);
    try {
      applyAction(state, pid, a, ctx());
      ok++;
      stats[a.type].ok++;
      if (a.type === "ABILITY") abilityStats[a.key] = (abilityStats[a.key] ?? 0) + 1;
    } catch (e) {
      stats[a.type].fail++;
      if (!(e instanceof GameError)) {
        throw new Error(`seed ${seed} passo ${i} ação ${JSON.stringify(a)}: ${(e as Error).stack}`);
      }
      // Ação inválida não pode ter mudado o estado de forma parcial perigosa: restauramos
      Object.assign(state, JSON.parse(snapshot));
    }
    tick(state, ctx());
    try {
      checkConservation(state);
      viewFor(state, pid, now);
    } catch (e) {
      console.log(state.log.slice(-25).map((l) => l.text).join("\n"));
      throw new Error(`seed ${seed} passo ${i} após ${JSON.stringify(a)}: ${(e as Error).message}`);
    }
  }
  return { state, ok };
}

describe("simulação do motor", () => {
  it("cria a partida com raça, classe e 8 cartas para cada jogador", () => {
    const rand = mulberry(1);
    const state = createGame(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
      "a",
      { now: 0, rng: { int: (m) => Math.floor(rand() * m) } },
    );
    for (const p of state.players) {
      expect(p.hand.length).toBe(8);
      expect(p.race).toBeTruthy();
      expect(p.classes.length).toBe(1);
    }
    checkConservation(state);
    // Quem tirou o maior d6 começa
    const best = Math.max(...Object.values(state.initialRolls));
    expect(state.initialRolls[state.order[0]]).toBe(best);
  });

  it("a ordem começa por quem tirou mais e segue o sentido da mesa", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rand = mulberry(seed);
      const n = 3 + (seed % 7);
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
      const state = createGame(players, "p0", { now: 0, rng: { int: (m) => Math.floor(rand() * m) } });
      const firstSeat = state.players.find((p) => p.id === state.order[0])!.seat;
      state.order.forEach((id, i) => {
        expect(state.players.find((p) => p.id === id)!.seat).toBe((firstSeat + i) % n);
      });
    }
  });

  it("joga muitas partidas aleatórias sem erros internos nem cartas perdidas", () => {
    let finished = 0;
    let totalOk = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { state, ok } = runGame(seed, 3 + (seed % 5), 4000);
      totalOk += ok;
      if (state.phase === "FINISHED") finished++;
    }
    expect(totalOk).toBeGreaterThan(1000);
    console.log(`partidas terminadas: ${finished}/40, ações válidas: ${totalOk}`);
    console.log(JSON.stringify(stats));
    console.log(JSON.stringify(abilityStats));
  }, 300_000);
});
