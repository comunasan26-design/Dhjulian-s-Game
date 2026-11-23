import { describe, expect, it } from "vitest";
import { createGame } from "../game/engine/core";
import { newCard } from "../game/engine/util";
import { botRating, botSkillFor, finalPositions, kFactor, queueWindow, type RatedPlayer, ratingChanges, ratingLabel } from "./rating";

const humans = (k: { games: number; rating?: number }) =>
  Array.from({ length: 6 }, (_, i): RatedPlayer => ({ id: `h${i}`, bot: false, rating: k.rating ?? 1200, games: k.games, position: i + 1, abandoned: false }));

describe("rating ranqueado", () => {
  it("exemplo da especificação: 6 humanos com 1200 e K=20", () => {
    const d = ratingChanges(humans({ games: 30 })).map((c) => Math.round(c.delta * 10) / 10);
    expect(d).toEqual([10, 6, 2, -2, -6, -10]);
  });

  it("exemplo com K=32 e a soma das variações entre humanos é zero", () => {
    const ch = ratingChanges(humans({ games: 15 }));
    expect(ch.map((c) => Math.round(c.delta * 10) / 10)).toEqual([16, 9.6, 3.2, -3.2, -9.6, -16]);
    expect(Math.abs(ch.reduce((a, c) => a + c.delta, 0))).toBeLessThan(1e-9);
  });

  it("fator K, bots, janelas da fila e rótulo de colocação", () => {
    expect([kFactor(0, 1200), kFactor(9, 1200), kFactor(10, 1200), kFactor(29, 1200), kFactor(30, 1999), kFactor(30, 2000)]).toEqual([48, 48, 32, 32, 20, 16]);
    expect([botRating(1), botRating(15), botRating(30)]).toEqual([600, 1300, 2050]);
    expect(botSkillFor([1300, 1300])).toBe(15);
    expect(botSkillFor([3000])).toBe(30);
    expect(botSkillFor([100])).toBe(1);
    expect([queueWindow(0), queueWindow(30_000), queueWindow(60_000)]).toEqual([100, 250, Infinity]);
    expect(ratingLabel(1234.6, 3)).toBe("1235?");
    expect(ratingLabel(1234.6, 5)).toBe("1235");
  });

  it("duelos contra bots valem metade, abandono perde 10 a mais e o mínimo é 100", () => {
    const ps: RatedPlayer[] = [
      { id: "h", bot: false, rating: 1200, games: 30, position: 1, abandoned: false },
      ...Array.from({ length: 5 }, (_, i): RatedPlayer => ({ id: `b${i}`, bot: true, rating: 1200, games: 0, position: i + 2, abandoned: false })),
    ];
    expect(ratingChanges(ps)[0].delta).toBeCloseTo(5); // metade do +10
    ps[0].position = 6;
    ps[0].abandoned = true;
    for (const b of ps.slice(1)) b.position -= 1;
    expect(ratingChanges(ps)[0].delta).toBeCloseTo(-5 - 10);
    ps[0].rating = 105;
    expect(ratingChanges(ps)[0].after).toBe(100);
  });

  it("colocação: vencedor, nível, bônus dos itens, empate e quem desistiu em último", () => {
    const ctx = { now: 1, rng: { int: () => 0 } };
    const ids = ["a", "b", "c", "d", "e", "f"];
    const state = createGame(ids.map((id) => ({ id, name: id })), "a", ctx);
    const P = (id: string) => state.players.find((p) => p.id === id)!;
    for (const p of state.players) p.equipped = [];
    P("a").level = 12;
    P("b").level = 20;
    state.winnerId = "b";
    P("c").level = 12;
    P("c").equipped.push(newCard(state, "item.panela")); // +1: desempata contra "a"
    P("d").level = 5;
    P("e").level = 5;
    state.players = state.players.filter((p) => p.id !== "f"); // desistiu
    const pos = finalPositions(state, ids);
    expect(Object.fromEntries(pos)).toEqual({ b: 1, c: 2, a: 3, d: 4, e: 4, f: 6 });
  });
});
