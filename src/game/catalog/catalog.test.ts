import { describe, expect, it } from "vitest";
import { applyAction } from "../engine/actions";
import { createGame, startPlaying } from "../engine/core";
import type { Ctx } from "../engine/state";
import { computeCombat, fleeInfo } from "../engine/stats";
import { newCard } from "../engine/util";
import { abilityInfos } from "../engine/abilities";
import { CARD_DEFS, type ClassCard, type ItemCard, type MonsterCard } from "./index";
import { loadCatalog } from "./load";

describe("cartas em JSON", () => {
  it("os arquivos da pasta /cartas não têm problemas", () => {
    expect(loadCatalog().problems).toEqual([]);
  });

  it("uma carta nova criada só com dados funciona no jogo", () => {
    // Simula alguém criando um monstro e um item novos no JSON
    const monster: MonsterCard = {
      id: "monster.teste-lobisomem",
      name: "Lobisomem de Teste",
      kind: "monster",
      deck: "door",
      level: 6,
      tags: ["animal"],
      special: "",
      badStuffText: "",
      badStuff: [{ t: "levels", n: 1 }],
      treasures: 2,
      levels: 1,
      tier: 1,
      legendary: false,
      fx: [
        { tipo: "bonusContra", racas: ["elfo"], valor: 4 },
        { tipo: "anula", alvo: "itensDeMao" },
        { tipo: "naoPersegue", classes: ["druida"] },
      ],
    };
    const item: ItemCard = {
      id: "item.teste-amuleto",
      name: "Amuleto de Teste",
      kind: "item",
      deck: "treasure",
      slot: "neck",
      rarity: "comum",
      bonus: 1,
      price: 100,
      text: "",
      fx: [{ tipo: "bonusPara", classes: ["druida"], valor: 3 }],
    };
    CARD_DEFS[monster.id] = monster;
    CARD_DEFS[item.id] = item;
    try {
      const ctx: Ctx = { now: 1, rng: { int: () => 0 } };
      const state = createGame(
        [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        "a",
        ctx,
      );
      state.order = ["a", "b"];
      const a = state.players[0];
      for (const id of a.hand) state.decks.doorDiscard.push(id);
      a.hand = [];
      a.race = newCard(state, "race.elfo");
      a.classes = [newCard(state, "class.druida")];
      a.level = 5;
      a.equipped = [newCard(state, "item.teste-amuleto"), newCard(state, "item.espada-vorpal")];
      startPlaying(state, ctx);
      state.decks.door.unshift(newCard(state, monster.id));
      applyAction(state, "a", { type: "KICK_DOOR" }, ctx);
      const calc = computeCombat(state)!;
      // Jogador: 5 (nível) + 4 (amuleto 1 + 3 por ser Druida); a espada (item de mão) é anulada
      expect(calc.playerTotal).toBe(9);
      // Monstro: 6 + 4 contra Elfos
      expect(calc.monsterTotal).toBe(10);
      // Não persegue Druidas: fuga automática
      expect(fleeInfo(state, a, state.combat!.monsters[0]).auto).toBeTruthy();
    } finally {
      delete CARD_DEFS[monster.id];
      delete CARD_DEFS[item.id];
    }
  });

  it("uma classe nova criada só com dados tem passiva e ativa funcionando", () => {
    const cls: ClassCard = {
      id: "class.teste-cavaleiro",
      name: "Cavaleiro de Teste",
      kind: "class",
      deck: "door",
      passive: { name: "Armadura Pesada", text: "" },
      fx: [{ tipo: "forca", valor: 1, valorPorNivel: { "11": 3 } }],
      actives: [
        {
          id: "investida",
          name: "Investida",
          text: "",
          acao: "bonusCombate",
          limite: "combate",
          custo: { descartar: 1 },
          params: { tipo: "bonusCombate", valor: 3, dobraContraTags: ["animal"] },
        },
      ],
    };
    CARD_DEFS[cls.id] = cls;
    try {
      const ctx: Ctx = { now: 1, rng: { int: () => 0 } };
      const state = createGame(
        [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        "a",
        ctx,
      );
      state.order = ["a", "b"];
      const a = state.players[0];
      a.classes = [newCard(state, cls.id)];
      a.level = 4;
      a.equipped = [];
      a.race = null;
      startPlaying(state, ctx);
      state.decks.door.unshift(newCard(state, "monster.estirge"));
      applyAction(state, "a", { type: "KICK_DOOR" }, ctx);
      const base = computeCombat(state)!.playerTotal;
      expect(base).toBe(4 + 1); // nível + passiva
      const info = abilityInfos(state, a).find((x) => x.key === "class.teste-cavaleiro#investida");
      expect(info).toBeTruthy();
      const discard = a.hand[0];
      applyAction(state, "a", { type: "ABILITY", key: "class.teste-cavaleiro#investida", discard: [discard], params: {} }, ctx);
      // Estirge é animal: +3 dobra para +6
      expect(computeCombat(state)!.playerTotal).toBe(base + 6);
      a.level = 11;
      // nível 11: passiva vira +3 (valorPorNivel)
      expect(computeCombat(state)!.playerTotal).toBe(11 + 3 + 6);
    } finally {
      delete CARD_DEFS[cls.id];
    }
  });
});
