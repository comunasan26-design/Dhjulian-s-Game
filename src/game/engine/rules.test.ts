import { describe, expect, it } from "vitest";
import { applyAction } from "./actions";
import { createGame, startPlaying } from "./core";
import type { Ctx, GameState } from "./state";
import { computeCombat } from "./stats";
import { newCard } from "./util";

/** RNG controlável: devolve os valores da fila (para d6 use valor-1) e depois 0. */
function makeCtx(queue: number[] = []) {
  const q = [...queue];
  const ctx: Ctx & { push: (...v: number[]) => void; advance: (ms: number) => void } = {
    now: 1_000_000,
    rng: { int: (max: number) => Math.min(max - 1, q.length ? q.shift()! : 0) },
    push: (...v: number[]) => q.push(...v),
    advance: (ms: number) => {
      ctx.now += ms;
    },
  };
  return ctx;
}

function setup(n = 3): { state: GameState; ctx: ReturnType<typeof makeCtx>; ids: string[] } {
  const ctx = makeCtx();
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  const state = createGame(players, "p0", ctx);
  // Mesa limpa e previsível: sem raça/classe, mãos vazias, ordem p0, p1, p2
  for (const p of state.players) {
    for (const id of [...p.hand]) state.decks.doorDiscard.push(id);
    p.hand = [];
    if (p.race) state.decks.doorDiscard.push(p.race);
    for (const c of p.classes) state.decks.doorDiscard.push(c);
    p.race = null;
    p.classes = [];
  }
  state.order = players.map((p) => p.id);
  startPlaying(state, ctx);
  return { state, ctx, ids: state.order };
}

/** Coloca uma carta (nova) no topo do baralho de Portas. */
function topDoor(state: GameState, defId: string): string {
  const id = newCard(state, defId);
  state.decks.door.unshift(id);
  return id;
}

function give(state: GameState, pid: string, defId: string, zone: "hand" | "equipped" | "carried" = "hand"): string {
  const id = newCard(state, defId);
  state.players.find((p) => p.id === pid)![zone].push(id);
  return id;
}

const P = (state: GameState, id: string) => state.players.find((p) => p.id === id)!;

describe("regras", () => {
  it("vitória com ajudante: divisão de tesouros escolhida pelo ajudante", () => {
    const { state, ctx } = setup();
    P(state, "p0").level = 5;
    P(state, "p1").level = 5;
    topDoor(state, "monster.gosma"); // nível 5, 2 tesouros
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    expect(state.combat).not.toBeNull();
    expect(computeCombat(state)!.winning).toBe(false); // 5 x 5: empate perde
    applyAction(state, "p0", { type: "ASK_HELP", targetId: "p1", count: 1, mode: "helper" }, ctx);
    const req = state.prompts.find((p) => p.kind === "helpRequest")!;
    applyAction(state, "p1", { type: "ANSWER", promptId: req.id, answer: { accept: true } }, ctx);
    expect(state.combat!.helperId).toBe("p1");
    expect(computeCombat(state)!.winning).toBe(true);
    applyAction(state, "p0", { type: "RESOLVE" }, ctx);
    expect(state.combat!.stage).toBe("resolving");
    applyAction(state, "p2", { type: "PASS" }, ctx);
    expect(state.combat).toBeNull();
    expect(P(state, "p0").level).toBe(6);
    expect(P(state, "p1").level).toBe(5); // ajudante não sobe (não é Elfo)
    const dist = state.prompts.find((p) => p.kind === "distribute")!;
    expect(dist.playerId).toBe("p1");
    const pool = dist.data.cards as string[];
    applyAction(state, "p1", { type: "ANSWER", promptId: dist.id, answer: { cardIds: [pool[1]] } }, ctx);
    expect(P(state, "p1").hand).toContain(pool[1]);
    expect(P(state, "p0").hand).toContain(pool[0]);
    expect(state.reward).toBeNull();
  });

  it("fuga falha e aplica as Coisas Ruins (Kobold leva as botas)", () => {
    const { state, ctx } = setup();
    P(state, "p0").level = 5; // Kobold não persegue nível 5+... então use nível 1
    P(state, "p0").level = 1;
    const boots = give(state, "p0", "item.botas-cravejadas", "equipped");
    topDoor(state, "monster.kobold");
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    // 1 + 2 (botas) = 3 > 1: vencendo; mas vamos fugir e falhar de propósito
    ctx.push(0); // d6 = 1
    applyAction(state, "p0", { type: "FLEE" }, ctx);
    expect(state.combat!.stage).toBe("badstuff");
    applyAction(state, "p0", { type: "ACCEPT_BAD_STUFF" }, ctx);
    expect(state.combat).toBeNull();
    expect(P(state, "p0").equipped).not.toContain(boots);
    expect(state.decks.treasureDiscard).toContain(boots);
  });

  it("morte: perde itens e mão; os outros saqueiam do maior para o menor nível", () => {
    const { state, ctx } = setup();
    const p0 = P(state, "p0");
    p0.level = 10;
    P(state, "p1").level = 3;
    P(state, "p2").level = 7;
    const sword = give(state, "p0", "item.espada-vorpal", "equipped");
    const helm = give(state, "p0", "item.elmo-couro", "equipped");
    give(state, "p0", "potion.cura", "hand");
    topDoor(state, "monster.verme"); // nível 28, Morte
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    ctx.push(0); // d6 = 1
    applyAction(state, "p0", { type: "FLEE" }, ctx);
    applyAction(state, "p0", { type: "ACCEPT_BAD_STUFF" }, ctx);
    expect(p0.level).toBe(10);
    expect(p0.hand.length).toBe(0);
    expect(p0.equipped.length).toBe(0);
    expect(p0.needsNewHand).toBe(true);
    const loot1 = state.prompts.find((p) => p.kind === "loot")!;
    expect(loot1.playerId).toBe("p2"); // maior nível primeiro
    applyAction(state, "p2", { type: "ANSWER", promptId: loot1.id, answer: { cardId: sword } }, ctx);
    const loot2 = state.prompts.find((p) => p.kind === "loot")!;
    expect(loot2.playerId).toBe("p1");
    applyAction(state, "p1", { type: "ANSWER", promptId: loot2.id, answer: { cardId: helm } }, ctx);
    expect(P(state, "p2").carried).toContain(sword);
    expect(P(state, "p1").carried).toContain(helm);
    // No próximo turno dele, recebe 4 + 4
    applyAction(state, "p0", { type: "END_TURN" }, ctx);
    applyAction(state, "p1", { type: "KICK_DOOR" }, ctx);
  });

  it("caridade: o excesso vai para o jogador de menor nível", () => {
    const { state, ctx } = setup();
    P(state, "p0").level = 4;
    P(state, "p1").level = 2;
    P(state, "p2").level = 3;
    for (let i = 0; i < 7; i++) give(state, "p0", "levelup.critico");
    topDoor(state, "race.elfo");
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx); // carta vai para a mão (8 cartas)
    applyAction(state, "p0", { type: "END_TURN" }, ctx); // saqueia (9) e pede caridade
    const pr = state.prompts.find((p) => p.kind === "charity")!;
    expect(pr.data.count).toBe(4);
    const cards = P(state, "p0").hand.slice(0, 4);
    applyAction(state, "p0", { type: "ANSWER", promptId: pr.id, answer: { cardIds: cards } }, ctx);
    expect(P(state, "p1").hand.length).toBe(4);
    expect(state.order[state.currentIdx]).toBe("p1");
  });

  it("vender: 1.000 de ouro = 1 nível, nunca o 20", () => {
    const { state, ctx } = setup();
    const p0 = P(state, "p0");
    p0.level = 19;
    give(state, "p0", "item.espada-vorpal", "carried");
    topDoor(state, "race.elfo");
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    applyAction(state, "p0", { type: "SELL", cardIds: [p0.carried[0]] }, ctx);
    expect(p0.level).toBe(19);
  });

  it("do 19 para o 20 derrotando um monstro: vitória", () => {
    const { state, ctx } = setup();
    P(state, "p0").level = 19;
    topDoor(state, "monster.estirge");
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    applyAction(state, "p0", { type: "RESOLVE" }, ctx);
    ctx.advance(20_000);
    applyAction(state, "p1", { type: "TICK" }, ctx);
    expect(state.winnerId).toBe("p0");
    expect(state.phase).toBe("FINISHED");
  });

  it("maldição de combate jogada fora de combate vale no próximo combate do alvo", () => {
    const { state, ctx } = setup();
    const curse = give(state, "p1", "curse.fraqueza");
    applyAction(state, "p1", { type: "PLAY_CURSE", cardId: curse, targetId: "p0" }, ctx);
    expect(P(state, "p0").pendingCombatCurses.length).toBe(1);
    P(state, "p0").level = 6;
    topDoor(state, "monster.estirge");
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    expect(computeCombat(state)!.playerTotal).toBe(3);
  });

  it("Divino anula maldição com 5+ e Anel de Proteção vira Anel de Lata", () => {
    const { state, ctx } = setup();
    const p0 = P(state, "p0");
    p0.race = newCard(state, "race.divino");
    const c1 = give(state, "p1", "curse.azar");
    p0.level = 5;
    ctx.push(4); // d6 = 5
    applyAction(state, "p1", { type: "PLAY_CURSE", cardId: c1, targetId: "p0" }, ctx);
    expect(p0.level).toBe(5);
    const ring = give(state, "p0", "item.anel-protecao", "equipped");
    const c2 = give(state, "p1", "curse.azar");
    ctx.push(0); // Divino falha
    applyAction(state, "p1", { type: "PLAY_CURSE", cardId: c2, targetId: "p0" }, ctx);
    expect(p0.level).toBe(5);
    expect(state.cards[ring].defId).toBe("item.anel-lata");
  });

  it("habilidade: Luz Sagrada dobra contra Mortos-vivos e respeita 1x por combate", () => {
    const { state, ctx } = setup();
    const p0 = P(state, "p0");
    p0.race = newCard(state, "race.divino");
    p0.level = 2;
    const a = give(state, "p0", "levelup.critico");
    const b = give(state, "p0", "levelup.treino");
    topDoor(state, "monster.esqueleto"); // nível 3, morto-vivo
    applyAction(state, "p0", { type: "KICK_DOOR" }, ctx);
    applyAction(state, "p0", { type: "ABILITY", key: "luzSagrada", discard: [a], params: {} }, ctx);
    expect(computeCombat(state)!.playerTotal).toBe(2 + 4);
    expect(() => applyAction(state, "p0", { type: "ABILITY", key: "luzSagrada", discard: [b], params: {} }, ctx)).toThrow();
  });
});
