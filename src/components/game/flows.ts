"use client";

import { type CardDef, findFx } from "@/game/catalog";
import type { AbilityInfo, Action, GameView } from "@/game/engine";
import type { GameApi } from "./GameContext";
import type { PickOption, usePicker } from "./Picker";
import type { DropTarget } from "../art/drag";

type Picker = ReturnType<typeof usePicker>;

export interface CardAction {
  label: string;
  run: () => Promise<unknown>;
  primary?: boolean;
}

// ----------------------------------------------------------------------------
// Opções
// ----------------------------------------------------------------------------

/**
 * Opções do Monstro Errante: no combate (a seu favor se você está lutando, contra quem luta se não está);
 * fora de combate, lutar agora no seu turno ou deixar o monstro de tocaia na porta de outro jogador.
 */
function wanderingOptions(api: GameApi, picker: Picker, wanderingId: string, monsterId?: string): CardAction[] {
  const view = api.view;
  const me = api.me;
  const monsters = (me.hand ?? []).filter((id) => api.def(id)?.kind === "monster");
  if (!monsters.length) return [];
  const chooseMonster = async (title: string) =>
    monsterId ?? (await picker.pick({ title, options: cardOptions(monsters) }));
  const out: CardAction[] = [];
  const c = view.combat;
  if (c) {
    if (c.stage === "badstuff") return [];
    const mine = c.fighterId === me.id || c.helperId === me.id;
    out.push({
      label: mine ? "Monstro Errante: reforçar meu combate (mais níveis e tesouros)" : `Monstro Errante: contra ${api.playerName(c.fighterId)}`,
      primary: true,
      run: async () => {
        const m = await chooseMonster("Qual monstro entra no combate?");
        if (m) return api.act({ type: "PLAY_WANDERING", cardId: wanderingId, monsterCardId: m });
      },
    });
    return out;
  }
  if (view.currentPlayerId === me.id && (view.turnPhase === "AFTER_DOOR" || view.turnPhase === "END"))
    out.push({
      label: "Monstro Errante: lutar com ele agora (a seu favor)",
      primary: true,
      run: async () => {
        const m = await chooseMonster("Com qual monstro você quer lutar?");
        if (m) return api.act({ type: "PLAY_WANDERING", cardId: wanderingId, monsterCardId: m, targetId: me.id });
      },
    });
  out.push({
    label: "Monstro Errante: soltar contra outro jogador…",
    primary: out.length === 0,
    run: async () => {
      const t = await picker.pick({
        title: "Quem vai enfrentar o monstro?",
        description: "O monstro fica escondido atrás da porta dele: ele luta ao chutar a próxima porta.",
        options: playerOptions(view, (id) => id !== me.id),
      });
      if (!t) return;
      const m = await chooseMonster("Qual monstro vai ficar de tocaia?");
      if (m) return api.act({ type: "PLAY_WANDERING", cardId: wanderingId, monsterCardId: m, targetId: t });
    },
  });
  return out;
}

export function playerOptions(view: GameView, filter: (id: string) => boolean = () => true): PickOption[] {
  return view.players
    .filter((p) => filter(p.id))
    .map((p) => ({
      value: p.id,
      label: `${p.name}${p.id === view.me ? " (você)" : ""}`,
      sub: `Nível ${p.level} · força ${p.power} · ${p.handCount} carta(s)`,
    }));
}

export function cardOptions(ids: string[]): PickOption[] {
  return ids.map((id) => ({ value: id, label: id, card: id }));
}

function monsterIds(view: GameView, wanderingOnly = false): string[] {
  return (view.combat?.monsters ?? []).filter((m) => !m.defeated && (!wanderingOnly || m.wandering)).map((m) => m.cardId);
}

function sidePlayers(view: GameView): string[] {
  return view.combat?.calc?.side ?? [];
}

async function pickDeal(picker: Picker, maxTreasures: number): Promise<{ count: number; mode: "random" | "fighter" | "helper" } | null> {
  const countStr = await picker.pick({
    title: "Quantos tesouros o ajudante leva?",
    description: "Combinem antes: o ajudante recebe essa quantidade dos tesouros (se vencerem).",
    options: Array.from({ length: Math.min(12, Math.max(1, maxTreasures)) + 1 }, (_, i) => ({
      value: String(i),
      label: i === 0 ? "Nenhum" : `${i} tesouro(s)`,
    })),
  });
  if (countStr === null) return null;
  const count = Number(countStr);
  if (count === 0) return { count, mode: "random" };
  const mode = await picker.pick({
    title: "Como dividir os tesouros?",
    options: [
      { value: "random", label: "Aleatório", sub: "Sorteio entre os tesouros abertos" },
      { value: "fighter", label: "Quem luta decide", sub: "O lutador escolhe quais vão para o ajudante" },
      { value: "helper", label: "Ajudante escolhe primeiro", sub: "O ajudante pega os dele primeiro" },
    ],
  });
  if (!mode) return null;
  return { count, mode: mode as "random" | "fighter" | "helper" };
}

function expectedTreasures(api: GameApi): number {
  const c = api.view.combat;
  if (!c) return 3;
  let t = 0;
  for (const m of c.monsters) {
    const d = api.def(m.cardId);
    if (d?.kind === "monster") t += d.treasures;
  }
  return t;
}

// ----------------------------------------------------------------------------
// Fluxos de combate
// ----------------------------------------------------------------------------

export async function flowAskHelp(api: GameApi, picker: Picker, targetId?: string) {
  const target =
    targetId ??
    (await picker.pick({
      title: "Pedir ajuda a quem?",
      options: playerOptions(api.view, (id) => id !== api.me.id),
    }));
  if (!target) return;
  const deal = await pickDeal(picker, expectedTreasures(api));
  if (!deal) return;
  return api.act({ type: "ASK_HELP", targetId: target, count: deal.count, mode: deal.mode });
}

export async function flowOfferHelp(api: GameApi, picker: Picker) {
  const deal = await pickDeal(picker, expectedTreasures(api));
  if (!deal) return;
  return api.act({ type: "OFFER_HELP", count: deal.count, mode: deal.mode });
}

export async function flowTrade(api: GameApi, picker: Picker) {
  const to = await picker.pick({ title: "Trocar com quem?", options: playerOptions(api.view, (id) => id !== api.me.id) });
  if (!to) return;
  const other = api.view.players.find((p) => p.id === to)!;
  const mine = [...api.me.equipped, ...api.me.carried];
  const give = await picker.pickMany({
    title: "O que você oferece?",
    description: "Só itens na mesa (equipados ou não). Pode deixar vazio para só pedir.",
    options: cardOptions(mine),
    min: 0,
  });
  if (give === null) return;
  const take = await picker.pickMany({
    title: `O que você quer de ${other.name}?`,
    description: "Pode deixar vazio para dar um presente.",
    options: cardOptions([...other.equipped, ...other.carried]),
    min: 0,
  });
  if (take === null) return;
  return api.act({ type: "TRADE", toId: to, give, take });
}

export async function flowSell(api: GameApi, picker: Picker) {
  const ids = [...api.me.hand!, ...api.me.carried, ...api.me.equipped].filter((id) => {
    const d = api.def(id);
    return d && "price" in d;
  });
  const chosen = await picker.pickMany({
    title: "Vender itens",
    description: "1.000 de ouro = 1 nível (nunca o nível 20). O ouro que sobrar é perdido.",
    options: ids.map((id) => {
      const d = api.def(id) as CardDef & { price: number };
      return { value: id, label: d.name, sub: `${d.price} de ouro`, card: id };
    }),
    min: 1,
  });
  if (!chosen) return;
  const gold = chosen.reduce((a, id) => a + ((api.def(id) as { price?: number })?.price ?? 0), 0);
  const ok = await picker.confirm(`Vender ${chosen.length} item(ns)?`, `Valor base: ${gold} de ouro (runas e Carta do Rei somam mais).`);
  if (!ok) return;
  return api.act({ type: "SELL", cardIds: chosen });
}

// ----------------------------------------------------------------------------
// Habilidades
// ----------------------------------------------------------------------------

export async function flowAbility(api: GameApi, picker: Picker, info: AbilityInfo, preset: Record<string, unknown> = {}) {
  const { view, me } = api;
  const params: Record<string, unknown> = { ...preset };
  const reserved: string[] = [];
  const pickCard = async (field: string, title: string, ids: string[]) => {
    if (ids.length === 0) throw new Error("Não há opções para: " + title);
    const v = await picker.pick({ title, description: info.text, options: cardOptions(ids) });
    if (v === null) return false;
    params[field] = v;
    reserved.push(v);
    return true;
  };
  const items = (ids: string[]) => ids.filter((id) => api.def(id)?.kind === "item");
  try {
    for (const f of info.fields) {
      let ok = true;
      if (f.name in preset) continue;
      switch (f.kind) {
        case "player": {
          const v = await picker.pick({
            title: `${info.name}: ${f.label}`,
            description: info.text,
            // "curar" pode ter você mesmo como alvo
            options: playerOptions(view, (id) => (info.acao === "curar" ? true : id !== me.id)),
          });
          if (v === null) ok = false;
          else params[f.name] = v;
          break;
        }
        case "victim": {
          const v = await picker.pick({
            title: `${info.name}: ${f.label}`,
            options: playerOptions(view, (id) => id !== me.id && (view.combat?.victims ?? []).includes(id)),
          });
          if (v === null) ok = false;
          else params[f.name] = v;
          break;
        }
        case "monster":
          ok = await pickCard(f.name, `${info.name}: ${f.label}`, monsterIds(view));
          break;
        case "wandering":
          ok = await pickCard(f.name, `${info.name}: ${f.label}`, monsterIds(view, true));
          break;
        case "ownEquipped":
          ok = await pickCard(f.name, f.label, me.equipped);
          break;
        case "ownEquippedNoRing":
          ok = await pickCard(
            f.name,
            f.label,
            me.equipped.filter((id) => {
              const d = api.def(id);
              return d?.kind === "item" && d.slot !== "ring";
            }),
          );
          break;
        case "otherEquipped": {
          const target = view.players.find((p) => p.id === params.player);
          ok = await pickCard(f.name, f.label, target?.equipped ?? []);
          break;
        }
        case "handItem":
          ok = await pickCard(f.name, f.label, items(me.hand ?? []));
          break;
        case "itemHandOrTable":
          ok = await pickCard(f.name, f.label, items([...(me.hand ?? []), ...me.carried]).filter((id) => !reserved.includes(id)));
          break;
        case "bigItem":
          ok = await pickCard(
            f.name,
            f.label,
            [...(me.hand ?? []), ...me.equipped, ...me.carried].filter((id) => {
              const d = api.def(id);
              return d?.kind === "item" && d.big;
            }),
          );
          break;
        case "restrictedItem":
          ok = await pickCard(f.name, f.label, items([...(me.hand ?? []), ...me.carried]));
          break;
        case "handMonster":
          ok = await pickCard(f.name, f.label, (me.hand ?? []).filter((id) => api.def(id)?.kind === "monster"));
          break;
        case "handDoor":
          ok = await pickCard(
            f.name,
            f.label,
            (me.hand ?? []).filter((id) => {
              const d = api.def(id);
              return d && ["monster", "curse", "race", "class", "monsterBonus", "wandering"].includes(d.kind);
            }),
          );
          break;
        case "combatItem": {
          const ids = sidePlayers(view).flatMap((pid) => view.players.find((p) => p.id === pid)?.equipped ?? []);
          ok = await pickCard(f.name, f.label, ids);
          break;
        }
        case "ownCurse": {
          const v = await picker.pick({
            title: f.label,
            options: me.curses.map((c) => ({ value: c.id, label: c.name })),
          });
          if (v === null) ok = false;
          else params[f.name] = v;
          break;
        }
        case "side": {
          const v = await picker.pick({
            title: f.label,
            options: [
              { value: "player", label: "Lado dos jogadores" },
              { value: "monster", label: "Lado do monstro" },
            ],
          });
          if (v === null) ok = false;
          else params[f.name] = v;
          break;
        }
        case "curaMode": {
          const v = await picker.pick({
            title: "O que curar?",
            options: [
              { value: "curse", label: "Remover 1 maldição ativa" },
              { value: "level", label: "Devolver 1 nível perdido nesta rodada" },
            ],
          });
          if (v === null) ok = false;
          else params[f.name] = v;
          break;
        }
        case "targetCurse": {
          if (params.mode !== "curse") break;
          const target = view.players.find((p) => p.id === params.player);
          const v = await picker.pick({
            title: "Qual maldição remover?",
            options: (target?.curses ?? []).map((c) => ({ value: c.id, label: c.name })),
          });
          if (v === null) ok = false;
          else params[f.name] = v;
          break;
        }
        case "goblinMode": {
          const v = await picker.pick({
            title: "Bugiganga Roubada",
            options: [
              { value: "discard", label: "Pegar um item do descarte de Tesouros" },
              { value: "steal", label: "Roubar um tesouro aberto de quem acabou de ganhar" },
            ],
          });
          if (v === null) ok = false;
          else params[f.name] = v;
          break;
        }
        case "discardItem":
          if (params.mode !== "discard") break;
          ok = await pickCard(f.name, "Item do descarte", view.decks.treasureDiscard.filter((id) => api.def(id)?.kind === "item"));
          break;
        case "faceUpTreasure":
          if (params.mode !== "steal") break;
          ok = await pickCard(
            f.name,
            "Tesouro aberto",
            view.lastFaceUp && view.lastFaceUp.turnSerial === view.turnSerial ? view.lastFaceUp.cards : [],
          );
          break;
        case "dealCount": {
          const deal = await pickDeal(picker, expectedTreasures(api));
          if (!deal) ok = false;
          else {
            params.dealCount = deal.count;
            params.dealMode = deal.mode;
          }
          break;
        }
        case "dealMode":
          break;
        case "kit": {
          const kit = [...(me.hand ?? []), ...me.carried].find((id) => !!findFx(api.def(id)?.id, "kitLadrao"));
          if (!kit) break;
          const isThief = !info.key.endsWith("#kit");
          if (!isThief) {
            params[f.name] = kit;
            reserved.push(kit);
            break;
          }
          const use = await picker.confirm("Usar o Kit de Ladrão?", "+2 na rolagem de Roubo (o kit é descartado).");
          if (use) {
            params[f.name] = kit;
            reserved.push(kit);
          }
          break;
        }
      }
      if (!ok) return;
    }
    let discard: string[] = [];
    if (info.wholeHand) {
      const n = (me.hand ?? []).filter((id) => !reserved.includes(id)).length;
      const ok = await picker.confirm(`${info.name}: descartar a mão inteira (${n} cartas)?`, info.text);
      if (!ok) return;
    } else if (info.discard > 0) {
      const chosen = await picker.pickMany({
        title: `${info.name}: escolha ${info.discard} carta(s) para descartar`,
        description: info.text,
        options: cardOptions((me.hand ?? []).filter((id) => !reserved.includes(id))),
        count: info.discard,
      });
      if (!chosen) return;
      discard = chosen;
    } else if (info.fields.length === 0) {
      const ok = await picker.confirm(`Usar ${info.name}?`, `${info.costText}. ${info.text}`);
      if (!ok) return;
    }
    return api.act({ type: "ABILITY", key: info.key, discard, params });
  } catch (e) {
    await picker.confirm((e as Error).message);
  }
}

// ----------------------------------------------------------------------------
// Ações de uma carta
// ----------------------------------------------------------------------------

async function consumeCard(api: GameApi, picker: Picker, cardId: string): Promise<unknown> {
  const { view, me } = api;
  const d = api.def(cardId)!;
  const base: Action = { type: "USE_CARD", cardId };
  const pickSide = () =>
    picker.pick({
      title: `${d.name}: para qual lado?`,
      options: [
        { value: "player", label: "Jogadores" },
        { value: "monster", label: "Monstro" },
      ],
    });
  const pickSidePlayer = () =>
    picker.pick({ title: `${d.name}: em quem?`, options: playerOptions(view, (id) => sidePlayers(view).includes(id)) });
  const has = (t: string) => !!findFx(d.id, t);
  if (has("bonusLado")) {
    const side = await pickSide();
    if (!side) return;
    return api.act({ ...base, side: side as "player" | "monster" });
  }
  if (has("menosEmAlvo")) {
    const v = await picker.pick({
      title: `${d.name}: em quem?`,
      options: [
        ...monsterIds(view).map((id) => ({ value: `m:${id}`, label: api.name(id), sub: "Monstro" })),
        ...playerOptions(view, (id) => sidePlayers(view).includes(id)).map((o) => ({ ...o, value: `p:${o.value}` })),
      ],
    });
    if (!v) return;
    return api.act(v.startsWith("m:") ? { ...base, monsterId: v.slice(2) } : { ...base, targetId: v.slice(2) });
  }
  if (has("bonusFugir") || has("fugaAutomatica")) {
    const t = await pickSidePlayer();
    if (!t) return;
    return api.act({ ...base, targetId: t });
  }
  if (has("contraMortosVivos") || has("removePodridao")) {
    if (view.combat) return api.act(base);
    const t = await picker.pick({
      title: `${d.name}: remover maldição de quem?`,
      options: playerOptions(view, (id) => !!view.players.find((p) => p.id === id)?.curses.some((c) => !!findFx(c.defId, "removidaPorAguaBenta"))),
    });
    if (!t) return;
    return api.act({ ...base, targetId: t });
  }
  if (has("devolveNivel") || has("forcaAjuda")) {
    const helping = has("forcaAjuda");
    const t = await picker.pick({
      title: helping ? "Obrigar quem a ajudar?" : "Devolver nível a quem?",
      options: playerOptions(view, (id) => (helping ? id !== me.id : true)),
    });
    if (!t) return;
    return api.act({ ...base, targetId: t });
  }
  if (has("isca")) {
    const m = await picker.pick({ title: `${d.name}: em qual monstro?`, options: cardOptions(monsterIds(view)) });
    if (!m) return;
    return api.act({ ...base, monsterId: m });
  }
  if (has("rerrolarFuga")) {
    const idx = await pickFailedRoll(api, picker);
    if (idx === null) return;
    return api.act({ ...base, index: idx });
  }
  if (has("espelho")) {
    const m = await picker.pick({ title: "Qual Monstro Errante refletir?", options: cardOptions(monsterIds(view, true)) });
    if (!m) return;
    const t = await picker.pick({ title: "Para quem?", options: playerOptions(view, (id) => id !== me.id) });
    if (!t) return;
    return api.act({ ...base, monsterId: m, targetId: t });
  }
  return api.act(base);
}

export async function pickFailedRoll(api: GameApi, picker: Picker): Promise<number | null> {
  const results = api.view.combat?.flee?.results ?? [];
  const opts = results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.playerId === api.me.id && !r.success && r.roll > 0)
    .map(({ r, i }) => ({ value: String(i), label: `Fuga de ${api.name(r.monsterCardId)}`, sub: `Tirou ${r.roll} (bônus ${r.bonus})` }));
  if (opts.length === 0) {
    await picker.confirm("Não há rolagem de fuga sua para refazer.");
    return null;
  }
  const v = await picker.pick({ title: "Qual rolagem refazer?", options: opts });
  return v === null ? null : Number(v);
}

export function cardActions(api: GameApi, picker: Picker, cardId: string): CardAction[] {
  const { view, me } = api;
  const d = api.def(cardId);
  if (!d) return [];
  const zone = me.hand?.includes(cardId) ? "hand" : me.equipped.includes(cardId) ? "equipped" : me.carried.includes(cardId) ? "carried" : null;
  if (!zone) return [];
  const myTurn = view.currentPlayerId === me.id;
  const out: CardAction[] = [];
  const act = (a: Action) => () => api.act(a);
  const inCombat = !!view.combat;
  const tamed = view.cards[cardId]?.tamed;

  if (zone === "equipped") {
    out.push({ label: "Desequipar", run: act({ type: "UNEQUIP", cardId }) });
    if (myTurn && !inCombat) out.push({ label: "Vender", run: () => sellOne(api, picker, cardId) });
    return out;
  }
  if (d.kind === "item" || tamed) out.push({ label: "Equipar", run: act({ type: "EQUIP", cardId }), primary: true });
  if (d.kind === "rune") {
    out.push({
      label: "Engastar em item equipado",
      primary: true,
      run: async () => {
        const item = await picker.pick({ title: "Engastar em qual item?", options: cardOptions(me.equipped) });
        if (item) return api.act({ type: "SOCKET_RUNE", runeId: cardId, itemId: item });
      },
    });
  }
  if (d.kind === "potion" || (d.kind === "misc" && !d.permanent && !findFx(d.id, "kitLadrao"))) {
    out.push({ label: "Usar", run: () => consumeCard(api, picker, cardId), primary: true });
  }
  if (zone === "hand") {
    switch (d.kind) {
      case "race":
        out.push({ label: "Jogar raça (substitui a atual)", run: act({ type: "PLAY_RACE", cardId }), primary: true });
        break;
      case "class":
        out.push({
          label: "Jogar classe",
          primary: true,
          run: async () => {
            let replaceId: string | undefined;
            if (me.classes.length >= 1) {
              if (me.classes.length >= me.maxClasses) {
                const r = await picker.pick({
                  title: "Substituir qual classe?",
                  options: me.classes.map((c) => ({ value: c, label: api.name(c) })),
                });
                if (!r) return;
                replaceId = r;
              }
            }
            return api.act({ type: "PLAY_CLASS", cardId, replaceId });
          },
        });
        break;
      case "monster":
        if (myTurn && view.turnPhase === "AFTER_DOOR")
          out.push({ label: "Procurar encrenca (lutar com ele)", run: act({ type: "LOOK_FOR_TROUBLE", cardId }), primary: true });
        if (view.combat?.screamerFor === me.id)
          out.push({ label: "Grito do Cogumelo: pôr no combate", run: act({ type: "SCREAMER_ADD", monsterCardId: cardId }), primary: true });
        {
          const wandering = (me.hand ?? []).find((id) => api.def(id)?.kind === "wandering");
          if (wandering) out.push(...wanderingOptions(api, picker, wandering, cardId));
        }
        break;
      case "curse":
        out.push({
          label: "Lançar maldição em…",
          primary: true,
          run: async () => {
            const t = await picker.pick({ title: `${d.name}: em quem?`, description: d.text, options: playerOptions(view) });
            if (t) return api.act({ type: "PLAY_CURSE", cardId, targetId: t });
          },
        });
        break;
      case "monsterBonus":
        if (inCombat)
          out.push({
            label: "Jogar no monstro…",
            primary: true,
            run: async () => {
              const m = await picker.pick({ title: `${d.name}: em qual monstro?`, options: cardOptions(monsterIds(view)) });
              if (m) return api.act({ type: "PLAY_MONSTER_BONUS", cardId, monsterId: m });
            },
          });
        break;
      case "wandering":
        out.push(...wanderingOptions(api, picker, cardId));
        break;
      case "levelup":
        out.push({ label: "Subir 1 nível", run: act({ type: "PLAY_LEVELUP", cardId }), primary: true });
        break;
    }
    if ("price" in d) out.push({ label: "Colocar na mesa", run: act({ type: "PLACE", cardId }) });
    const frogs = view.players.filter((p) => p.id !== me.id && p.curses.some((c) => !!findFx(c.defId, "acabaComBeijo")));
    if (frogs.length)
      out.push({
        label: "Descartar para beijar o sapo",
        run: async () => {
          const t = await picker.pick({ title: "Beijar quem?", options: playerOptions(view, (id) => frogs.some((f) => f.id === id)) });
          if (t) return api.act({ type: "KISS", targetId: t, cardId });
        },
      });
  }
  if ("price" in d && myTurn && !inCombat) out.push({ label: "Vender", run: () => sellOne(api, picker, cardId) });
  out.push({
    label: "Descartar",
    run: async () => {
      if (await picker.confirm(`Descartar ${d.name}?`)) return api.act({ type: "DISCARD", cardId });
    },
  });
  return out;
}

async function sellOne(api: GameApi, picker: Picker, cardId: string) {
  const d = api.def(cardId) as CardDef & { price?: number };
  const ok = await picker.confirm(`Vender ${d.name} por ${d.price ?? 0} de ouro?`, "Sozinho, só vira nível se somar 1.000 de ouro. Use “Vender itens” para juntar vários.");
  if (ok) return api.act({ type: "SELL", cardIds: [cardId] });
}

/**
 * Carta solta por arraste. Depende de onde a carta estava e de onde foi solta:
 * - descarte: descarta (itens equipados são desequipados antes; raça/classe também podem ser descartadas);
 * - equipado → inventário/mão: desequipa; inventário → equipamento/mesa: equipa;
 * - mão → jogador: maldição nele; → monstro: bônus nele; → inventário: coloca na mesa; → mesa: jogada principal.
 * Devolve "inspect" quando não dá para decidir sozinho (abre as ações da carta).
 */
export async function dropCard(api: GameApi, picker: Picker, cardId: string, target: DropTarget): Promise<"done" | "inspect" | "none"> {
  const { me } = api;
  const d = api.def(cardId);
  const from = me.hand?.includes(cardId)
    ? "hand"
    : me.equipped.includes(cardId)
      ? "equipped"
      : me.carried.includes(cardId)
        ? "carried"
        : me.race === cardId
          ? "race"
          : me.classes.includes(cardId)
            ? "class"
            : null;
  if (!d || !from) return "none";
  const tamed = !!api.view.cards[cardId]?.tamed;

  if (target.kind === "discard") {
    if (from === "race") await api.act({ type: "DISCARD_RACE" });
    else if (from === "class") await api.act({ type: "DISCARD_CLASS", cardId });
    else if (from === "equipped") {
      if (await api.act({ type: "UNEQUIP", cardId })) await api.act({ type: "DISCARD", cardId });
    } else await api.act({ type: "DISCARD", cardId });
    return "done";
  }
  if (from === "equipped") {
    if (target.kind === "inventory" || target.kind === "hand") await api.act({ type: "UNEQUIP", cardId });
    return "done";
  }
  if (from === "carried") {
    if (target.kind === "equip" || target.kind === "table") await api.act({ type: "EQUIP", cardId });
    return "done";
  }
  if (from === "race" || from === "class") return "none";

  // vindo da mão
  if (target.kind === "hand") return "none";
  if (target.kind === "inventory") {
    if ("price" in d || tamed) await api.act({ type: "PLACE", cardId });
    return "done";
  }
  if (target.kind === "equip" && (d.kind === "item" || tamed)) {
    await api.act({ type: "EQUIP", cardId });
    return "done";
  }
  if (target.kind === "player" && d.kind === "curse") {
    await api.act({ type: "PLAY_CURSE", cardId, targetId: target.id });
    return "done";
  }
  if (target.kind === "monster" && d.kind === "monsterBonus") {
    await api.act({ type: "PLAY_MONSTER_BONUS", cardId, monsterId: target.id });
    return "done";
  }
  if (api.view.combat && (target.kind === "player" || target.kind === "monster")) {
    const r = await dropOnCombatSide(api, picker, cardId, target);
    if (r) return r;
  }
  const actions = cardActions(api, picker, cardId).filter((a) => a.label !== "Descartar");
  const primary = actions.find((a) => a.primary);
  if (primary) {
    await primary.run();
    return "done";
  }
  return "inspect";
}

/**
 * Carta solta num dos lados do combate (tela de batalha): poções e cartas de uso para o lado certo,
 * Monstro Errante para o lado do monstro.
 */
async function dropOnCombatSide(
  api: GameApi,
  picker: Picker,
  cardId: string,
  target: { kind: "player" | "monster"; id: string },
): Promise<"done" | null> {
  const { view, me } = api;
  const c = view.combat!;
  const d = api.def(cardId)!;
  const side = sidePlayers(view);
  const has = (t: string) => !!findFx(d.id, t);
  const usable = d.kind === "potion" || (d.kind === "misc" && !d.permanent);
  if (usable && has("bonusLado")) {
    await api.act({ type: "USE_CARD", cardId, side: target.kind === "monster" ? "monster" : "player" });
    return "done";
  }
  if (usable && has("menosEmAlvo")) {
    if (target.kind === "monster") await api.act({ type: "USE_CARD", cardId, monsterId: target.id });
    else if (side.includes(target.id)) await api.act({ type: "USE_CARD", cardId, targetId: target.id });
    else return null;
    return "done";
  }
  if (usable && (has("bonusFugir") || has("fugaAutomatica")) && target.kind === "player" && side.includes(target.id)) {
    await api.act({ type: "USE_CARD", cardId, targetId: target.id });
    return "done";
  }
  if (target.kind === "monster" && c.stage !== "badstuff") {
    const hand = me.hand ?? [];
    if (d.kind === "wandering" || d.kind === "monster") {
      const wanderingId = d.kind === "wandering" ? cardId : hand.find((id) => api.def(id)?.kind === "wandering");
      if (!wanderingId) return null;
      const monsterCardId =
        d.kind === "monster"
          ? cardId
          : await picker.pick({ title: "Qual monstro entra no combate?", options: cardOptions(hand.filter((id) => api.def(id)?.kind === "monster")) });
      if (!monsterCardId) return "done";
      await api.act({ type: "PLAY_WANDERING", cardId: wanderingId, monsterCardId });
      return "done";
    }
  }
  return null;
}
