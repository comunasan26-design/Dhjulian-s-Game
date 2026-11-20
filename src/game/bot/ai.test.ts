import { describe, expect, it } from "vitest";
import { applyAction } from "../engine/actions";
import { createGame } from "../engine/core";
import type { Ctx, GameState } from "../engine/state";
import { newCard } from "../engine/util";
import { botName, shouldAcceptHelpOffer, shouldAcceptHelpRequest, shouldPayThreat, stepBots, strengthOf } from "./ai";

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function botGame(seed: number, n: number, steps: number) {
  const rand = mulberry(seed);
  let now = 1_000_000;
  const ctx = (): Ctx => ({ now, rng: { int: (m: number) => Math.floor(rand() * m) } });
  const players = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: botName(i), bot: true }));
  const state: GameState = createGame(players, "b0", ctx());
  let acted = 0;
  let idle = 0;
  let maxMs = 0;
  for (let i = 0; i < steps && state.phase !== "FINISHED"; i++) {
    now += 1000;
    const t0 = performance.now();
    const changed = stepBots(state, ctx());
    maxMs = Math.max(maxMs, performance.now() - t0);
    if (changed) {
      acted++;
      idle = 0;
    } else {
      idle++;
      // Deixa os prazos correrem quando ninguém age
      now += 15_000;
      applyAction(state, "b0", { type: "TICK" }, ctx());
      if (idle > 30) throw new Error(`seed ${seed}: bots travaram na fase ${state.turnPhase} / combate ${state.combat?.stage}\n${state.log.slice(-10).map((l) => l.text).join("\n")}`);
    }
  }
  return { state, acted, maxMs };
}

describe("bots", () => {
  it("jogam partidas inteiras sozinhos sem travar", () => {
    let finished = 0;
    let worst = 0;
    let rounds = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { state, maxMs } = botGame(seed, 3 + (seed % 3), 3000);
      worst = Math.max(worst, maxMs);
      rounds += state.round;
      if (state.phase === "FINISHED") finished++;
    }
    console.log(`partidas de bots terminadas: ${finished}/6, rodadas: ${rounds}, decisão mais lenta: ${worst.toFixed(0)}ms`);
    expect(rounds).toBeGreaterThan(20);
  }, 600_000);
});

describe("bots e ameaças", () => {
  function combatWithThreat() {
    const ctx: Ctx = { now: 1_000, rng: { int: () => 0 } };
    const state = createGame(
      [
        { id: "p0", name: "Bot", bot: true },
        { id: "p1", name: "Humano" },
        { id: "p2", name: "Outro" },
      ],
      "p0",
      ctx,
    );
    state.order = ["p0", "p1", "p2"];
    for (const p of state.players) {
      p.hand = [];
      p.race = null;
      p.classes = [];
      p.equipped = [];
    }
    applyAction(state, "p0", { type: "START_NOW" }, ctx);
    state.players[0].level = 10;
    state.decks.door.unshift(newCard(state, "monster.gosma")); // nível 5, 2 tesouros, 1 nível
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    return { state, ctx, bot: state.players[0], human: state.players[1] };
  }

  it("recusa ameaça de quem não tem como atrapalhar", () => {
    const { state, ctx, bot } = combatWithThreat();
    expect(shouldPayThreat(state, bot, "p1", 1, ctx)).toBe(false);
  });

  it("paga um preço justo quando a ameaça é real", () => {
    const { state, ctx, bot, human } = combatWithThreat();
    human.hand.push(newCard(state, "bonus.anciao")); // +10 no monstro vira o combate
    expect(shouldPayThreat(state, bot, "p1", 1, ctx)).toBe(true);
  });

  it("recusa pedido exagerado (todos os tesouros por um monstro de 1 nível)", () => {
    const { state, ctx, bot, human } = combatWithThreat();
    human.hand.push(newCard(state, "bonus.anciao"));
    expect(shouldPayThreat(state, bot, "p1", 2, ctx)).toBe(false);
  });
});

describe("bots e pedidos de ajuda", () => {
  function fight(fighterLevel: number, levels: Record<string, number>, fighterId = "p0") {
    const ctx: Ctx = { now: 1_000, rng: { int: () => 0 } };
    const state = createGame(
      [
        { id: "p0", name: "Bot", bot: true },
        { id: "p1", name: "Humano" },
        { id: "p2", name: "Outro" },
      ],
      "p0",
      ctx,
    );
    state.order = [fighterId, ...["p0", "p1", "p2"].filter((x) => x !== fighterId)];
    for (const p of state.players) {
      p.hand = [];
      p.race = null;
      p.classes = [];
      p.equipped = [];
      p.level = levels[p.id] ?? 3;
    }
    applyAction(state, "p0", { type: "START_NOW" }, ctx);
    state.currentIdx = 0;
    state.players.find((p) => p.id === fighterId)!.level = fighterLevel;
    state.decks.door.unshift(newCard(state, "monster.gosma")); // nível 5, 2 tesouros, 1 nível
    applyAction(state, fighterId, { type: "KICK_DOOR" }, ctx);
    const P = (id: string) => state.players.find((p) => p.id === id)!;
    return { state, P };
  }

  it("quem já está muito forte conta como mais forte", () => {
    const { state, P } = fight(3, { p1: 15, p2: 3 });
    expect(strengthOf(state, P("p1"))).toBeGreaterThan(strengthOf(state, P("p2")) + 0.4);
  });

  it("aceita a oferta de ajuda de um jogador comum, mas não a de quem já lidera com folga pedindo mais", () => {
    const comum = fight(3, { p1: 4, p2: 4 });
    expect(comum.state.combat?.fighterId).toBe("p0");
    expect(shouldAcceptHelpOffer(comum.state, comum.P("p0"), comum.P("p1"), 1)).toBe(true);
    const lider = fight(3, { p1: 15, p2: 3 });
    expect(shouldAcceptHelpOffer(lider.state, lider.P("p0"), lider.P("p1"), 2)).toBe(false);
  });

  it("ajuda quem pede com uma boa oferta, mas pensa duas vezes antes de fortalecer o líder", () => {
    const comum = fight(3, { p0: 5, p2: 5 }, "p1");
    expect(comum.state.combat?.fighterId).toBe("p1");
    expect(shouldAcceptHelpRequest(comum.state, comum.P("p0"), comum.P("p1"), 2)).toBe(true);
    const lider = fight(15, { p0: 4, p2: 3 }, "p1");
    lider.state.combat!.monsters[0].mods.push({ id: "x", value: 12, by: "p2", label: "teste" });
    expect(shouldAcceptHelpRequest(lider.state, lider.P("p0"), lider.P("p1"), 2)).toBe(false);
  });
});
