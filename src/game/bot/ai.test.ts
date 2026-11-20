import { describe, expect, it } from "vitest";
import { applyAction } from "../engine/actions";
import { createGame } from "../engine/core";
import type { Ctx, GameState } from "../engine/state";
import { newCard } from "../engine/util";
import { botName, decide, shouldAcceptHelpOffer, shouldAcceptHelpRequest, shouldPayThreat, stepBots, strengthOf } from "./ai";
import { computeCombat } from "../engine/stats";

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

describe("bots jogam combos", () => {
  /** Mesa com 2 jogadores (bot e humano), sem cartas, na fase de jogo. */
  function table(botLevel: number, humanLevel: number, current: "p0" | "p1" = "p0") {
    const ctx: Ctx = { now: 1_000, rng: { int: () => 0 } };
    const state = createGame(
      [
        { id: "p0", name: "Bot", bot: true },
        { id: "p1", name: "Humano" },
      ],
      "p0",
      ctx,
    );
    state.order = current === "p0" ? ["p0", "p1"] : ["p1", "p0"];
    for (const p of state.players) {
      p.hand = [];
      p.race = null;
      p.classes = [];
      p.equipped = [];
      p.carried = [];
    }
    applyAction(state, "p0", { type: "START_NOW" }, ctx);
    state.currentIdx = 0;
    const P = (id: string) => state.players.find((p) => p.id === id)!;
    P("p0").level = botLevel;
    P("p1").level = humanLevel;
    const give = (pid: string, defId: string) => {
      const id = newCard(state, defId);
      P(pid).hand.push(id);
      return id;
    };
    return { state, ctx, P, give };
  }

  /** Deixa o bot agir até passar a vez (ou parar), aplicando as ações. */
  function run(state: GameState, ctx: Ctx, stop: (a: NonNullable<ReturnType<typeof decide>>) => boolean, max = 8) {
    const done: string[] = [];
    for (let i = 0; i < max; i++) {
      const a = decide(state, "p0", ctx);
      if (!a) break;
      done.push(a.type);
      if (stop(a)) break;
      applyAction(state, "p0", a, ctx);
    }
    return done;
  }

  it("vira o próprio combate com o combo mais barato e guarda o resto", () => {
    const { state, ctx, P, give } = table(1, 1);
    const filhote = give("p0", "bonus.filhote"); // -5
    const ferido = give("p0", "bonus.ferido"); // -3
    const forca = give("p0", "potion.forca-menor"); // +2
    const acido = give("p0", "potion.acido"); // -3 no alvo
    state.decks.door.unshift(newCard(state, "monster.mimico")); // nível 7
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    expect(computeCombat(state)!.winning).toBe(false);
    run(state, ctx, (a) => a.type === "RESOLVE" || a.type === "FLEE");
    // venceu (ou o monstro morreu) usando Filhote + Ferido, sem gastar as poções
    expect(!state.combat || computeCombat(state)!.winning).toBe(true);
    expect(P("p0").hand).not.toContain(filhote);
    expect(P("p0").hand).not.toContain(ferido);
    expect(P("p0").hand).toEqual(expect.arrayContaining([forca, acido]));
  });

  it("gasta tudo o que for preciso para impedir que alguém vença o jogo", () => {
    const { state, ctx, P, give } = table(5, 19, "p1");
    give("p0", "bonus.anciao"); // +10
    give("p0", "bonus.enfurecido"); // +5
    give("p0", "bonus.faminto"); // +3
    state.decks.door.unshift(newCard(state, "monster.gosma")); // nível 5: o humano vence com folga e chega ao 20
    applyAction(state, "p1", { type: "KICK_DOOR" }, ctx);
    applyAction(state, "p1", { type: "RESOLVE" }, ctx);
    expect(state.combat?.stage).toBe("resolving");
    run(state, ctx, (a) => a.type === "PASS");
    expect(state.winnerId).toBeFalsy();
    expect(computeCombat(state)!.winning).toBe(false);
    expect(P("p0").hand.length).toBeLessThan(3);
  });

  it("não desperdiça cartas atrapalhando um combate que não importa", () => {
    const { state, ctx, P, give } = table(8, 2, "p1");
    give("p0", "bonus.anciao");
    state.decks.door.unshift(newCard(state, "monster.kobold")); // nível 1, 1 tesouro
    applyAction(state, "p1", { type: "KICK_DOOR" }, ctx);
    applyAction(state, "p1", { type: "RESOLVE" }, ctx);
    // pode até chantagear (não custa nada), mas não gasta o Ancião num combate de 1 nível de quem está atrás
    const done = run(state, ctx, (a) => a.type === "PASS");
    expect(done.at(-1)).toBe("PASS");
    expect(P("p0").hand.length).toBe(1);
  });

  it("procura encrenca quando vence com folga", () => {
    const { state, ctx, give } = table(9, 3);
    const kobold = give("p0", "monster.kobold");
    state.decks.door.unshift(newCard(state, "levelup.treino")); // a porta não é monstro: vai para a mão
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    expect(state.turnPhase).toBe("AFTER_DOOR");
    const done = run(state, ctx, (a) => a.type === "LOOK_FOR_TROUBLE" || a.type === "LOOT_ROOM");
    expect(done.at(-1)).toBe("LOOK_FOR_TROUBLE");
    expect(state.players[0].hand).toContain(kobold);
  });
});
