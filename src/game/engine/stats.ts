// Valores derivados: limites, slots, força de combate e Fugir.
import { def, fxOf, RULES, type ItemCard, type MonsterCard, type Slot, type Tag } from "../catalog";
import {
  cardFx,
  combatFx,
  combatHas,
  curseFx,
  equippedFx,
  equippedFxAll,
  flag,
  hasCurseFx,
  matchesListed,
  matchesWho,
  monsterFx,
  nullified,
  num,
  runeFx,
  strs,
  text,
} from "./fx";
import type { CombatMonster, CombatState, GameState, PlayerState } from "./state";
import {
  classesOf,
  raceOf as raceOfId,
  defOf,
  equippedRuneCount,
  hasClass,
  hasPassive,
  passiveFx,
  passiveFxSrc,
  passiveSum,
  scaled,
  inst,
  itemDef,
  lostLevelThisRound,
  player,
  tryPlayer,
} from "./util";

export interface CalcLine {
  label: string;
  value: number;
}

const ARMOR_SLOTS: Slot[] = ["head", "chest", "legs", "feet"];

/** Nome do slot no JSON (português) ↔ slot interno. */
export const SLOT_PT: Record<Slot, string> = {
  head: "capacete",
  chest: "peitoral",
  legs: "calcas",
  feet: "botas",
  hand: "maos",
  ring: "anel",
  neck: "colar",
  mount: "montaria",
};
const PT_SLOT: Record<string, Slot> = { ...Object.fromEntries(Object.entries(SLOT_PT).map(([k, v]) => [v, k as Slot])), mao: "hand" };
export function slotFromPt(name: unknown): Slot | null {
  return PT_SLOT[String(name)] ?? null;
}
const NULL_TARGET: Partial<Record<Slot, string>> = { ring: "aneis", mount: "montarias", chest: "peitorais" };

export function tier11(p: PlayerState): boolean {
  return p.level >= 11;
}

export function hasCurse(p: PlayerState, defId: string): boolean {
  return p.curses.some((c) => c.defId === defId);
}

// ----------------------------------------------------------------------------
// Limites
// ----------------------------------------------------------------------------

export function handLimit(state: GameState, p: PlayerState): number {
  let n = RULES.limiteMao + passiveSum(state, p, "limiteMao");
  for (const id of [...p.carried, ...p.equipped]) n += num(cardFx(state, id, "limiteMao"), "quantidade");
  return n;
}

export function isLegendaryItem(state: GameState, cardId: string): boolean {
  const d = itemDef(state, cardId);
  if (!d) return false;
  if (d.rarity === "lendario") return true;
  return runeFx(state, cardId, "contaComoLendario").length > 0;
}

export function bigLimit(state: GameState, p: PlayerState): number {
  if (hasPassive(state, p, "semItensGrandes")) return 0;
  let n = RULES.limiteItensGrandes + passiveSum(state, p, "grandesExtras", "quantidade");
  for (const { fx } of equippedFxAll(state, p, "grandeExtra")) if (matchesWho(state, p, fx)) n += 1;
  return n;
}

export function legendaryLimit(state: GameState, p: PlayerState): number {
  return hasCurseFx(p, "semLendarios") ? 0 : RULES.limiteItensLendarios;
}

export function slotBaseCapacity(state: GameState, p: PlayerState, slot: Slot): number {
  const pt = SLOT_PT[slot];
  if (passiveFx(state, p, "semSlot").some((fx) => slotFromPt(fx.slot) === slot)) return 0;
  let n = RULES.slots[pt] ?? 1;
  for (const fx of passiveFx(state, p, "slotExtra")) if (slotFromPt(fx.slot) === slot) n += scaled(fx, "quantidade", p.level, 1);
  return n;
}

/** Slots onde o jogador pode ter um segundo item com metade do bônus (ex.: Artífice). */
export function artificeAllowed(state: GameState, p: PlayerState): Slot[] {
  return passiveFx(state, p, "slotExtraMetade").flatMap((fx) => strs(fx, "slots").map((x) => slotFromPt(x)).filter((x): x is Slot => !!x));
}

export function artificeSlotLimit(state: GameState, p: PlayerState): number {
  return passiveFx(state, p, "slotExtraMetade").reduce((a, fx) => a + scaled(fx, "quantidade", p.level, 1), 0);
}

export function handsUsed(state: GameState, p: PlayerState, except?: string): number {
  let n = 0;
  for (const id of p.equipped) {
    if (id === except) continue;
    const d = itemDef(state, id);
    if (d && d.slot === "hand") n += d.hands ?? 1;
  }
  if (hasCurseFx(p, "ocupaUmaMao")) n += 1;
  return n;
}

export function handCapacity(state: GameState, p: PlayerState): number {
  return slotBaseCapacity(state, p, "hand");
}

export function meetsRestrictions(state: GameState, p: PlayerState, d: ItemCard): string | null {
  const race = raceOfId(state, p);
  const classes = classesOf(state, p);
  if (d.requires && ((d.requires.races?.length ?? 0) > 0 || (d.requires.classes?.length ?? 0) > 0)) {
    const ok =
      (race && d.requires.races?.includes(race)) || classes.some((c) => d.requires?.classes?.includes(c));
    if (!ok) return `${d.name}: restrito a outra raça/classe.`;
  }
  if (d.forbids) {
    const bad =
      (race && d.forbids.races?.includes(race)) || classes.some((c) => d.forbids?.classes?.includes(c));
    if (bad) return `${d.name}: sua raça/classe não pode usar.`;
  }
  return null;
}

/**
 * Verifica se o item pode ser equipado agora. Retorna erro ou null.
 * `asSecond` indica que vai para o slot extra do Artífice.
 */
export function equipCheck(state: GameState, p: PlayerState, cardId: string): { error: string | null; asSecond: boolean } {
  const d = itemDef(state, cardId);
  const c = inst(state, cardId);
  if (!d && !c.tamed) return { error: "Essa carta não é um item equipável.", asSecond: false };
  const slot: Slot = d ? d.slot : "mount";
  const restr = d ? meetsRestrictions(state, p, d) : null;
  if (restr) return { error: restr, asSecond: false };
  if (d?.big) {
    const bigs = p.equipped.filter((id) => itemDef(state, id)?.big).length;
    if (bigs + 1 > bigLimit(state, p)) return { error: "Você não pode equipar mais itens Grandes.", asSecond: false };
  }
  if (d && isLegendaryItem(state, cardId)) {
    const legs = p.equipped.filter((id) => isLegendaryItem(state, id)).length;
    if (legs + 1 > legendaryLimit(state, p)) return { error: "Só 1 item Lendário equipado por vez.", asSecond: false };
  }
  if (slot === "hand") {
    if (handsUsed(state, p) + (d?.hands ?? 1) > handCapacity(state, p)) return { error: "Suas mãos estão ocupadas.", asSecond: false };
    return { error: null, asSecond: false };
  }
  const inSlot = p.equipped.filter((id) => slotOf(state, id) === slot);
  const base = slotBaseCapacity(state, p, slot);
  if (base === 0) return { error: "Sua raça não pode usar esse tipo de item.", asSecond: false };
  if (inSlot.length < base) return { error: null, asSecond: false };
  // Slot extra do Artífice
  const artSlots = artificeAllowed(state, p);
  if (artSlots.includes(slot) && artificeSlotLimit(state, p) > 0) {
    const hasSecond = inSlot.some((id) => state.cards[id]?.artificeSecond);
    const chosen = p.artificeSlots.includes(slot) || p.artificeSlots.length < artificeSlotLimit(state, p);
    if (!hasSecond && chosen && inSlot.length < base + 1) return { error: null, asSecond: true };
  }
  return { error: "Esse slot já está ocupado. Desequipe o item atual primeiro.", asSecond: false };
}

export function slotOf(state: GameState, cardId: string): Slot | null {
  const c = state.cards[cardId];
  if (!c) return null;
  if (c.tamed) return "mount";
  const d = def(c.defId);
  return d.kind === "item" ? d.slot : null;
}

/** Número de encaixes de runa de um item para o jogador. */
export function runeSockets(state: GameState, p: PlayerState, cardId: string): number {
  const d = itemDef(state, cardId);
  if (!d) return 0;
  return (RULES.encaixesDeRuna[d.rarity] ?? 1) + passiveSum(state, p, "encaixesExtras", "quantidade");
}

// ----------------------------------------------------------------------------
// Combate
// ----------------------------------------------------------------------------

export function monsterDef(state: GameState, cm: CombatMonster): MonsterCard {
  return defOf(state, cm.cardId) as MonsterCard;
}

export function activeMonsters(combat: CombatState): CombatMonster[] {
  return combat.monsters.filter((m) => !m.defeated);
}

/** Monstros cujo texto Especial está valendo. */
export function specialIds(state: GameState, combat: CombatState | null): Set<string> {
  const s = new Set<string>();
  if (!combat) return s;
  for (const m of activeMonsters(combat)) if (!m.ignoreSpecial) s.add(inst(state, m.cardId).defId);
  return s;
}

export function combatTags(state: GameState, combat: CombatState | null): Set<Tag> {
  const s = new Set<Tag>();
  if (!combat) return s;
  for (const m of activeMonsters(combat)) for (const t of monsterDef(state, m).tags) s.add(t);
  return s;
}

export function hasLegendary(state: GameState, combat: CombatState): boolean {
  return activeMonsters(combat).some((m) => monsterDef(state, m).legendary);
}

/** Jogador escravizado pelo Aboleth (mais cartas na mão, fora o lutador). */
export function abolethThrall(state: GameState, combat: CombatState): string | null {
  if (!combatHas(state, combat, "escravizaMente")) return null;
  const candidates = state.players.filter((p) => p.id !== combat.fighterId);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.hand.length - a.hand.length || b.level - a.level || a.seat - b.seat);
  if (candidates[0].hand.length === 0) return null;
  return candidates[0].id;
}

export function helperIsTraitor(state: GameState, combat: CombatState): boolean {
  if (!combat.helperId) return false;
  if (combat.helperTraitor) return true;
  if (combatHas(state, combat, "seduzAjudante")) return true;
  return false;
}

export function playerSide(state: GameState, combat: CombatState): string[] {
  const ids = [combat.fighterId];
  const thrall = abolethThrall(state, combat);
  if (combat.helperId && !helperIsTraitor(state, combat) && combat.helperId !== thrall) ids.push(combat.helperId);
  return ids;
}

export function monsterSidePlayers(state: GameState, combat: CombatState): string[] {
  const ids: string[] = [];
  const thrall = abolethThrall(state, combat);
  if (combat.helperId && (helperIsTraitor(state, combat) || combat.helperId === thrall)) ids.push(combat.helperId);
  if (thrall && !ids.includes(thrall)) ids.push(thrall);
  return ids;
}

/** O ajudante está do lado do jogador? */
export function effectiveHelper(state: GameState, combat: CombatState): string | null {
  const side = playerSide(state, combat);
  return combat.helperId && side.includes(combat.helperId) ? combat.helperId : null;
}

interface ItemEntry {
  cardId: string;
  ownerId: string;
  label: string;
  value: number;
}

function itemUsable(state: GameState, p: PlayerState, d: ItemCard | null, slot: Slot): boolean {
  if (hasCurseFx(p, "semItensDeMao") && slot === "hand") return false;
  if (hasCurseFx(p, "semArmaduraEArmas") && (ARMOR_SLOTS.includes(slot) || slot === "hand")) return false;
  void d;
  return true;
}

/** Bônus de um item específico de um jogador (sem considerar Marilith). */
function itemValue(
  state: GameState,
  p: PlayerState,
  cardId: string,
  combat: CombatState | null,
  specials: Set<string>,
  tags: Set<Tag>,
): number | null {
  const c = inst(state, cardId);
  const d = def(c.defId);
  let slot: Slot;
  let base: number;
  let isBig = false;
  if (c.tamed && d.kind === "monster") {
    slot = "mount";
    base = d.treasures;
  } else if (d.kind === "item") {
    slot = d.slot;
    base = d.bonus;
    isBig = !!d.big;
  } else return null;
  const item = d.kind === "item" ? d : null;
  if (!itemUsable(state, p, item, slot)) return 0;

  let v = base;
  v += Number(c.reforged) || 0;
  for (const fx of runeFx(state, cardId, "bonusItem")) v += num(fx, "valor");
  // Bônus extras por raça/classe e contra certos monstros (efeitos do item)
  for (const fx of fxOf(c.defId)) {
    if (fx.tipo === "bonusPara" && matchesListed(state, p, fx)) v += num(fx, "valor");
    if (fx.tipo === "bonusContra" && combat) {
      const tagsHit = strs(fx, "tags").some((t) => tags.has(t as Tag));
      const giantHit = flag(fx, "gigantes") && activeMonsters(combat).some((m) => monsterDef(state, m).giant);
      if (tagsHit || giantHit) v += num(fx, "valor");
    }
  }
  if (runeFx(state, cardId, "dobraItem").length > 0) v *= 2;
  if (c.artificeSecond) v = Math.floor(v / 2);
  if (combat && combat.infusions.includes(cardId)) v *= 2;

  if (combat) {
    if (slot === "hand" && nullified(state, combat, "itensDeMao")) return 0;
    if (slot === "hand" && nullified(state, combat, "metadeItensDeMao")) v = Math.floor(v / 2);
    if (isBig && nullified(state, combat, "itensGrandes")) return 0;
    if (slot === "mount" && nullified(state, combat, "montarias")) return 0;
    if (slot === "chest" && nullified(state, combat, "peitorais")) return 0;
    if (slot === "ring" && nullified(state, combat, "aneis")) return 0;
  }
  return v;
}

function collectItems(
  state: GameState,
  p: PlayerState,
  combat: CombatState | null,
  specials: Set<string>,
  tags: Set<Tag>,
): ItemEntry[] {
  const out: ItemEntry[] = [];
  const ids = [...p.equipped];
  if (combat) for (const a of combat.adaptations) if (a.playerId === p.id && !ids.includes(a.cardId)) ids.push(a.cardId);
  for (const id of ids) {
    const v = itemValue(state, p, id, combat, specials, tags);
    if (v === null) continue;
    out.push({ cardId: id, ownerId: p.id, label: defOf(state, id).name, value: v });
  }
  for (const { fx, source } of passiveFxSrc(state, p, "casco")) {
    let v = scaled(fx, "valor", p.level);
    if (combat && nullified(state, combat, "peitorais")) v = 0;
    out.push({ cardId: "", ownerId: p.id, label: source, value: v });
  }
  return out;
}

function hasHandItems(state: GameState, p: PlayerState): boolean {
  return p.equipped.some((id) => slotOf(state, id) === "hand") || hasCurseFx(p, "ocupaUmaMao");
}

export function emptyArmorSlots(state: GameState, p: PlayerState): number {
  let n = 0;
  for (const s of ARMOR_SLOTS) {
    if (s === "chest" && hasPassive(state, p, "casco")) continue; // o casco conta como peitoral
    if (!p.equipped.some((id) => slotOf(state, id) === s)) n++;
  }
  return n;
}

export function hasArmor(state: GameState, p: PlayerState): boolean {
  return hasPassive(state, p, "casco") || p.equipped.some((id) => ARMOR_SLOTS.includes(slotOf(state, id) as Slot));
}

/** Força "pessoal" de um jogador (nível + itens + passivas + maldições). */
function personLines(
  state: GameState,
  p: PlayerState,
  combat: CombatState | null,
  opts: { isHelper: boolean; marilithItems?: Set<string> },
): CalcLine[] {
  const specials = specialIds(state, combat);
  const tags = combatTags(state, combat);
  const lines: CalcLine[] = [];
  const lvl = combat && opts.isHelper && combat.elfDouble.includes(p.id) ? p.level * 2 : p.level;
  lines.push({ label: combat && opts.isHelper && combat.elfDouble.includes(p.id) ? "Nível x2 (Disparo Duplo)" : "Nível", value: lvl });

  const items = collectItems(state, p, combat, specials, tags);
  for (const it of items) {
    if (opts.marilithItems?.has(`${it.ownerId}:${it.cardId}:${it.label}`)) {
      lines.push({ label: `${it.label} (anulado pela Marilith)`, value: 0 });
    } else if (it.value !== 0) {
      lines.push({ label: it.label, value: it.value });
    }
  }
  // Passivas de raça/classe
  for (const { fx, source } of passiveFxSrc(state, p, "bonusPorItem")) {
    const slot = slotFromPt(fx.slot);
    if (!slot) continue;
    const target = NULL_TARGET[slot];
    if (combat && target && nullified(state, combat, target)) continue;
    const count = p.equipped.filter((id) => slotOf(state, id) === slot).length;
    if (count > 0) lines.push({ label: source, value: count * scaled(fx, "valor", p.level) });
  }
  for (const { fx, source } of passiveFxSrc(state, p, "bonusPorRuna")) {
    let runes = 0;
    for (const id of p.equipped) runes += (state.cards[id]?.runes ?? []).length;
    const max = fx.maximo === undefined ? Infinity : num(fx, "maximo");
    if (runes > 0) lines.push({ label: source, value: Math.min(max, runes * scaled(fx, "valor", p.level)) });
  }
  for (const { fx, source } of passiveFxSrc(state, p, "forca")) {
    if (flag(fx, "seMaosLivres") && hasHandItems(state, p)) continue;
    lines.push({ label: source, value: scaled(fx, "valor", p.level) });
  }
  if (combat) {
    for (const { fx, source } of passiveFxSrc(state, p, "bonusContra")) {
      if (strs(fx, "tags").some((t) => tags.has(t as Tag))) lines.push({ label: source, value: scaled(fx, "valor", p.level) });
    }
  }
  for (const { fx, source } of passiveFxSrc(state, p, "bonusPorSlotVazio")) {
    const e = emptyArmorSlots(state, p);
    if (e > 0) lines.push({ label: `${source} (${e} slot(s) vazio(s))`, value: e * scaled(fx, "valor", p.level) });
  }
  if (p.streak > 0) {
    for (const { fx, source } of passiveFxSrc(state, p, "furia")) {
      let v = p.streak * scaled(fx, "valor", p.level);
      if (combat?.berserkDouble.includes(p.id)) v *= 2;
      lines.push({ label: `${source} (${p.streak} vitória(s))`, value: v });
    }
  }
  // Maldições
  for (const cu of p.curses) {
    for (const fx of fxOf(cu.defId)) if (fx.tipo === "forca") lines.push({ label: def(cu.defId).name, value: num(fx, "valor") });
    if (cu.defId === "special.forca") lines.push({ label: cu.label ?? "Maldição", value: cu.value ?? 0 });
    // compatibilidade com partidas salvas antes das cartas em JSON
    if (cu.defId === "special.sombria") lines.push({ label: "Maldição Sombria", value: -(cu.value ?? 3) });
    if (cu.defId === "special.mumia") lines.push({ label: "Podridão de Múmia", value: -2 });
  }
  if (combat) {
    // Especiais de monstros que afetam jogadores
    for (const { cm, fx } of combatFx(state, combat, "jogadoresGanham")) {
      if (flag(fx, "soAjudante") && !opts.isHelper) continue;
      if (strs(fx, "excetoClasses").some((c) => hasClass(state, p, c))) continue;
      const listed = strs(fx, "racas").length > 0 || strs(fx, "classes").length > 0 || flag(fx, "armaDeImpacto");
      const impact = flag(fx, "armaDeImpacto") && p.equipped.some((id) => itemDef(state, id)?.impact);
      if (listed && !matchesListed(state, p, fx) && !impact) continue;
      lines.push({ label: `${monsterDef(state, cm).name}: especial`, value: num(fx, "valor") });
    }
    if (p.id === combat.fighterId) {
      for (const m of combat.monsters) {
        if (m.defeated || m.ignoreSpecial || !m.revealPlayer) continue;
        lines.push({ label: `${monsterDef(state, m).name} (ao revelar)`, value: m.revealPlayer });
      }
    }
    if (p.id === combat.fighterId && combat.desafio && combat.desafioPenalty) lines.push({ label: "Desafio", value: combat.desafioPenalty });
    for (const mod of combat.playerMods) if (mod.target === p.id) lines.push({ label: mod.label, value: mod.value });
  }
  return lines;
}

function sum(lines: CalcLine[]): number {
  return lines.reduce((a, l) => a + l.value, 0);
}

export function playerPower(state: GameState, p: PlayerState): number {
  return sum(personLines(state, p, null, { isHelper: false }));
}

/** Há dano de fogo do lado dos jogadores? */
export function sideHasFire(state: GameState, combat: CombatState): boolean {
  if (combat.playerMods.some((m) => m.fire)) return true;
  for (const id of playerSide(state, combat)) {
    const p = player(state, id);
    for (const cid of p.equipped) {
      const d = itemDef(state, cid);
      if (d?.fire) return true;
      if (runeFx(state, cid, "fogo").length > 0) return true;
    }
  }
  return false;
}

export function monsterBaseTotal(state: GameState, cm: CombatMonster, combat: CombatState): number {
  const d = monsterDef(state, cm);
  let v = d.level + cm.mods.reduce((a, m) => a + m.value, 0);
  if (cm.wandering) {
    const fighter = player(state, combat.fighterId);
    if (equippedFx(state, fighter, "metadeErrantes") && cm.addedBy !== combat.fighterId)
      v = Math.floor(v / 2);
  }
  return v;
}

export interface CombatCalc {
  playerTotal: number;
  monsterTotal: number;
  playerLines: CalcLine[];
  monsterLines: CalcLine[];
  monsters: { cardId: string; total: number }[];
  winning: boolean;
  fire: boolean;
  side: string[];
  monsterSide: string[];
}

export function computeCombat(state: GameState): CombatCalc | null {
  const combat = state.combat;
  if (!combat) return null;
  const specials = specialIds(state, combat);
  const tags = combatTags(state, combat);
  const side = playerSide(state, combat);
  const mSide = monsterSidePlayers(state, combat);
  const fighter = player(state, combat.fighterId);
  const fire = sideHasFire(state, combat);

  // Marilith: anula os 2 maiores bônus de item do lado dos jogadores
  let marilith: Set<string> | undefined;
  if (nullified(state, combat, "doisMaioresItens")) {
    const all: ItemEntry[] = [];
    for (const id of side) all.push(...collectItems(state, player(state, id), combat, specials, tags));
    all.sort((a, b) => b.value - a.value);
    marilith = new Set(all.slice(0, 2).filter((e) => e.value > 0).map((e) => `${e.ownerId}:${e.cardId}:${e.label}`));
  }

  const playerLines: CalcLine[] = [];
  for (const id of side) {
    const p = player(state, id);
    const lines = personLines(state, p, combat, { isHelper: id !== combat.fighterId, marilithItems: marilith });
    for (const l of lines) playerLines.push({ label: side.length > 1 ? `${p.name}: ${l.label}` : l.label, value: l.value });
  }
  // Aura de Coragem (Paladino)
  const auras = side.flatMap((id) => {
    const p = player(state, id);
    return passiveFxSrc(state, p, "aura").map(({ fx, source }) => ({ source, v: scaled(fx, "valor", p.level) }));
  });
  if (auras.length > 0) {
    const best = auras.reduce((a, b) => (b.v > a.v ? b : a));
    playerLines.push({ label: `${best.source} (${side.length} jogador(es))`, value: best.v * side.length });
  }
  for (const mod of combat.playerMods) if (!mod.target) playerLines.push({ label: mod.label, value: mod.value });
  for (const a of combat.allies) {
    const d = defOf(state, a.cardId) as MonsterCard;
    playerLines.push({ label: `Duplicata: ${d.name}`, value: Math.ceil(d.level / 2) });
  }
  if (fire) {
    for (const { cm, fx } of combatFx(state, combat, "fogoDaBonus"))
      playerLines.push({ label: `Fogo contra ${monsterDef(state, cm).name}`, value: num(fx, "valor") });
  }

  const monsterLines: CalcLine[] = [];
  const monsters: { cardId: string; total: number }[] = [];
  const helperOnSide = side.length > 1;
  const sidePlayers = side.map((id) => player(state, id));
  for (const cm of activeMonsters(combat)) {
    const d = monsterDef(state, cm);
    let t = monsterBaseTotal(state, cm, combat);
    monsterLines.push({ label: `${d.name} (nível ${d.level})`, value: d.level });
    for (const mod of cm.mods) monsterLines.push({ label: `  ${mod.label}`, value: mod.value });
    if (cm.wandering && t !== d.level + cm.mods.reduce((a, m) => a + m.value, 0))
      monsterLines.push({ label: "  Elmo do Olho Vigilante (metade)", value: t - (d.level + cm.mods.reduce((a, m) => a + m.value, 0)) });
    const add = (label: string, v: number) => {
      t += v;
      monsterLines.push({ label: `  ${label}`, value: v });
    };
    for (const fx of monsterFx(state, cm, "bonusContra")) {
      const r = bonusContraValue(state, combat, fx, sidePlayers, fighter, fire, helperOnSide);
      if (r) add(r.label, r.value);
    }
    if (!cm.ignoreSpecial && cm.revealMonster) add("Ao revelar", cm.revealMonster);
    if (combat.glabrezuAccepted) for (const fx of monsterFx(state, cm, "desejo")) add("Desejo concedido", num(fx, "valor"));
    for (const fx of curseFx(fighter, "monstrosGanham")) add("Marca do Caçador", num(fx, "valor"));
    monsters.push({ cardId: cm.cardId, total: t });
  }
  for (const mod of combat.monsterSideMods) monsterLines.push({ label: mod.label, value: mod.value });
  for (const id of mSide) {
    const p = player(state, id);
    const v = sum(personLines(state, p, combat, { isHelper: false }));
    monsterLines.push({ label: `${p.name} (lutando pelo monstro)`, value: v });
  }

  const playerTotal = sum(playerLines);
  const monsterTotal = monsters.reduce((a, m) => a + m.total, 0) + sum(combat.monsterSideMods) + mSide.reduce(
    (a, id) => a + sum(personLines(state, player(state, id), combat, { isHelper: false })),
    0,
  );
  const warrior = side.some((id) => hasPassive(state, player(state, id), "venceEmpates"));
  const winning = monsters.length > 0 && (playerTotal > monsterTotal || (warrior && playerTotal === monsterTotal));
  return { playerTotal, monsterTotal, playerLines, monsterLines, monsters, winning, fire, side, monsterSide: mSide };
}

// ----------------------------------------------------------------------------
// Fugir
// ----------------------------------------------------------------------------

export interface FleeInfo {
  bonus: number;
  lines: CalcLine[];
  auto: string | null;
  impossible: string | null;
}

export function notPursued(state: GameState, p: PlayerState, d: MonsterCard, specialOn: boolean): string | null {
  if (d.goblinoid && equippedFx(state, p, "naoPerseguidoPorGoblinoides")) return "item contra goblinoides";
  for (const fx of fxOf(d.id)) {
    if (fx.tipo !== "naoPersegue") continue;
    if (!specialOn && !flag(fx, "sempre")) continue;
    if (fx.nivelMinimo !== undefined && p.level >= num(fx, "nivelMinimo")) return `não persegue jogadores de nível ${num(fx, "nivelMinimo")} ou mais`;
    if (fx.nivelMaximo !== undefined && p.level <= num(fx, "nivelMaximo")) return `não persegue jogadores de nível ${num(fx, "nivelMaximo")} ou menos`;
    if (flag(fx, "semArmadura") && !hasArmor(state, p)) return "não persegue quem não tem armadura";
    if (matchesListed(state, p, fx)) return "não persegue sua raça/classe";
  }
  return null;
}

export function fleeInfo(state: GameState, p: PlayerState, cm: CombatMonster): FleeInfo {
  const combat = state.combat!;
  const d = monsterDef(state, cm);
  const specialOn = !cm.ignoreSpecial;
  const lines: CalcLine[] = [];
  const res = (auto: string | null, impossible: string | null): FleeInfo => ({
    bonus: lines.reduce((a, l) => a + l.value, 0),
    lines,
    auto,
    impossible,
  });
  if (combat.desafio && p.id === combat.fighterId) return res(null, "Desafio: não dá para fugir");
  if (combat.autoFlee.includes(`${p.id}|all`)) return res("Pergaminho de Teletransporte", null);
  const np = notPursued(state, p, d, specialOn);
  if (np) return res(`${d.name} ${np}`, null);
  const noFlee = passiveFxSrc(state, p, "naoPodeFugir")[0];
  if (noFlee) return res(null, `${noFlee.source}: não pode fugir`);
  if (combat.cantFlee.includes(p.id)) return res(null, "Pés de Chumbo");
  const botas = !!equippedFx(state, p, "fugirDeTudo");
  if (d.cantFlee && specialOn && !botas) return res(null, `${d.name}: não dá para fugir`);
  if (combat.autoFlee.includes(`${p.id}|nonleg`) && !d.legendary) return res("Poção de Invisibilidade", null);
  for (const { fx, source } of passiveFxSrc(state, p, "fugaAutomaticaContra"))
    if (strs(fx, "tags").some((t) => d.tags.includes(t as Tag))) return res(source, null);

  // Bônus
  for (const { fx, source } of passiveFxSrc(state, p, "fugir")) {
    if (flag(fx, "seMaosLivres") && hasHandItems(state, p)) continue;
    const v = scaled(fx, "valor", p.level);
    if (v) lines.push({ label: source, value: v });
  }
  for (const { fx, source } of passiveFxSrc(state, p, "fugirContra"))
    if (strs(fx, "tags").some((t) => d.tags.includes(t as Tag))) lines.push({ label: source, value: scaled(fx, "valor", p.level) });
  let ringFlee = 0;
  for (const id of p.equipped) {
    const c = inst(state, id);
    const idf = itemDef(state, id);
    const slot = slotOf(state, id)!;
    if (!itemUsable(state, p, idf, slot)) continue;
    let f = idf?.flee ?? 0;
    const wind = runeFx(state, id, "fugir").reduce((a, fx) => a + num(fx, "valor"), 0);
    void c;
    if (slot === "ring") {
      ringFlee += f + wind;
      continue;
    }
    if (slot === "mount" && nullified(state, combat, "montarias")) f = 0;
    f += wind;
    if (f !== 0) lines.push({ label: defOf(state, id).name, value: f });
  }
  if (ringFlee !== 0) lines.push({ label: `Anéis (máx. +${RULES.limiteFugirAneis})`, value: Math.min(RULES.limiteFugirAneis, ringFlee) });
  if (specialOn && d.fleeMod) {
    const ignored = fxOf(d.id).some((fx) => fx.tipo === "fugirIgnoradoPor" && matchesListed(state, p, fx));
    if (!ignored) lines.push({ label: d.name, value: d.fleeMod });
  }
  for (const mod of combat.fleeMods) {
    if (mod.target === p.id) lines.push({ label: mod.label, value: mod.value });
  }
  return res(null, null);
}

export function fleeModsOnly(lines: CalcLine[]): number {
  return lines.reduce((a, l) => a + l.value, 0);
}

export function equippedCount(p: PlayerState): number {
  return p.equipped.length;
}

export function tryHelperName(state: GameState, combat: CombatState): string | null {
  return tryPlayer(state, combat.helperId)?.name ?? null;
}

export { equippedRuneCount };

/** Bônus do monstro do efeito "bonusContra" (ou null se a condição não vale). */
function bonusContraValue(
  state: GameState,
  combat: CombatState,
  fx: import("../catalog").Fx,
  side: PlayerState[],
  fighter: PlayerState,
  fire: boolean,
  helperOnSide: boolean,
): { label: string; value: number } | null {
  const parts: string[] = [];
  if (strs(fx, "racas").length || strs(fx, "classes").length) {
    if (!side.some((p) => matchesListed(state, p, fx))) return null;
    parts.push(`contra ${[...strs(fx, "racas"), ...strs(fx, "classes")].join("/")}`);
  }
  const item = text(fx, "itemEquipado");
  if (item) {
    if (!side.some((p) => p.equipped.some((c) => state.cards[c]?.defId === `item.${item}`))) return null;
    parts.push(`contra ${def(`item.${item}`).name}`);
  }
  if (flag(fx, "montado")) {
    if (!side.some((p) => p.equipped.some((c) => slotOf(state, c) === "mount"))) return null;
    parts.push("contra quem está montado");
  }
  if (flag(fx, "perdeuNivelNaRodada")) {
    if (!side.some((p) => lostLevelThisRound(state, p))) return null;
    parts.push("contra quem perdeu nível");
  }
  if (fx.itensEquipadosMin !== undefined) {
    if (!side.some((p) => p.equipped.length >= num(fx, "itensEquipadosMin"))) return null;
    parts.push(`contra quem tem ${num(fx, "itensEquipadosMin")}+ itens`);
  }
  if (flag(fx, "semFogo")) {
    if (fire) return null;
    parts.push("sem fogo");
  }
  let mult = 1;
  if (flag(fx, "porAjudante")) {
    mult = helperOnSide ? 1 : 0;
    parts.push("por ajudante");
  }
  if (fx.porNivelAcimaDe !== undefined) {
    mult = Math.max(0, fighter.level - num(fx, "porNivelAcimaDe"));
    parts.push(`por nível acima de ${num(fx, "porNivelAcimaDe")}`);
  }
  if (flag(fx, "porCartaNaMao")) {
    mult = fighter.hand.length;
    parts.push("por carta na mão");
  }
  const value = num(fx, "valor") * mult;
  if (value === 0) return null;
  void combat;
  return { label: parts.join(", ") || "especial", value };
}
