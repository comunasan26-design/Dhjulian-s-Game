// Carrega as cartas dos arquivos JSON da pasta /cartas e valida tudo com mensagens claras.
import bonusJson from "../../../cartas/bonus-monstro.json";
import classesJson from "../../../cartas/classes.json";
import diversosJson from "../../../cartas/diversos.json";
import itensJson from "../../../cartas/itens.json";
import maldicoesJson from "../../../cartas/maldicoes.json";
import erranteJson from "../../../cartas/monstro-errante.json";
import monstrosJson from "../../../cartas/monstros.json";
import pocoesJson from "../../../cartas/pocoes.json";
import racasJson from "../../../cartas/racas.json";
import runasJson from "../../../cartas/runas.json";
import subirJson from "../../../cartas/subir-nivel.json";
import {
  BAD_STUFF_TYPES,
  CURSE_EFFECTS,
  type EffectSpec,
  type Fx,
  ITEM_EFFECTS,
  MISC_EFFECTS,
  MONSTER_EFFECTS,
  POTION_EFFECTS,
  RUNE_EFFECTS,
} from "./effects";
import type {
  BadEffect,
  ClassCard,
  ClassId,
  CurseCard,
  ItemCard,
  LevelUpCard,
  MiscCard,
  MonsterBonusCard,
  MonsterCard,
  PotionCard,
  RaceCard,
  RaceId,
  Rarity,
  RuneCard,
  Slot,
  Tag,
  WanderingCard,
} from "./types";

export const RACE_IDS: RaceId[] = [
  "divino", "anao", "draconato", "elfo", "gnomo", "gigante", "humano", "orc", "diabrete",
  "elemental", "goblin", "centauro", "torkle", "owlin", "tritao", "fada", "vampirico",
];
export const CLASS_IDS: ClassId[] = [
  "guerreiro", "mago", "clerigo", "ladino", "druida", "paladino", "barbaro", "bardo",
  "feiticeiro", "bruxo", "monge", "patrulheiro", "ilusionista", "berserker", "artifice", "alquimista",
];
const RARITIES: Rarity[] = ["comum", "incomum", "raro", "epico", "lendario"];
const TAGS: Tag[] = ["morto-vivo", "demonio", "dragao", "fogo", "aquatico", "animal", "voador", "sagrado"];
const SLOTS: Record<string, Slot> = {
  capacete: "head", peitoral: "chest", calcas: "legs", botas: "feet", mao: "hand", anel: "ring", colar: "neck", montaria: "mount",
};
const BAD_SLOTS: Record<string, "head" | "chest" | "legs" | "feet" | "mount" | "hands"> = {
  capacete: "head", peitoral: "chest", calcas: "legs", botas: "feet", montaria: "mount", maos: "hands",
};
const CURSE_TYPES: Record<string, CurseCard["curseType"]> = {
  instantanea: "instant", combate: "combat", duracao: "duration", persistente: "persistent",
};

type Raw = Record<string, unknown>;

class Problems {
  list: string[] = [];
  add(file: string, card: unknown, msg: string) {
    const id = card && typeof card === "object" && "id" in card ? String((card as Raw).id) : "?";
    this.list.push(`cartas/${file} → carta "${id}": ${msg}`);
  }
}

function checkKeys(p: Problems, file: string, c: Raw, allowed: string[]) {
  for (const k of Object.keys(c)) {
    if (!allowed.includes(k)) p.add(file, c, `campo desconhecido "${k}". Campos válidos: ${allowed.join(", ")}.`);
  }
}

function str(p: Problems, file: string, c: Raw, key: string, required = true): string {
  const v = c[key];
  if (v === undefined) {
    if (required) p.add(file, c, `falta o campo "${key}".`);
    return "";
  }
  if (typeof v !== "string" || !v.trim()) {
    p.add(file, c, `"${key}" precisa ser um texto.`);
    return "";
  }
  return v;
}

function num(p: Problems, file: string, c: Raw, key: string, required = true, fallback = 0): number {
  const v = c[key];
  if (v === undefined) {
    if (required) p.add(file, c, `falta o campo "${key}" (número).`);
    return fallback;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) {
    p.add(file, c, `"${key}" precisa ser um número (sem aspas).`);
    return fallback;
  }
  return v;
}

function bool(p: Problems, file: string, c: Raw, key: string): boolean {
  const v = c[key];
  if (v === undefined) return false;
  if (typeof v !== "boolean") {
    p.add(file, c, `"${key}" precisa ser true ou false.`);
    return false;
  }
  return v;
}

function list<T extends string>(p: Problems, file: string, c: Raw, key: string, valid?: readonly T[]): T[] {
  const v = c[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    p.add(file, c, `"${key}" precisa ser uma lista de textos, ex.: ["a", "b"].`);
    return [];
  }
  if (valid) for (const x of v) if (!valid.includes(x as T)) p.add(file, c, `"${x}" não é válido em "${key}". Opções: ${valid.join(", ")}.`);
  return v as T[];
}

function one<T extends string>(p: Problems, file: string, c: Raw, key: string, valid: readonly T[], required = true): T {
  const v = str(p, file, c, key, required);
  if (v && !valid.includes(v as T)) p.add(file, c, `"${key}" = "${v}" não é válido. Opções: ${valid.join(", ")}.`);
  return v as T;
}

function copies(p: Problems, file: string, c: Raw): number | undefined {
  if (c.copias === undefined) return undefined;
  const n = num(p, file, c, "copias");
  if (n < 0 || !Number.isInteger(n)) p.add(file, c, `"copias" precisa ser um número inteiro (0 tira a carta do baralho).`);
  return n;
}

function effects(p: Problems, file: string, c: Raw, key: string, registry: Record<string, EffectSpec>): Fx[] {
  const v = c[key];
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    p.add(file, c, `"${key}" precisa ser uma lista: [ { "tipo": "..." } ].`);
    return [];
  }
  const out: Fx[] = [];
  for (const e of v) {
    if (!e || typeof e !== "object" || typeof (e as Raw).tipo !== "string") {
      p.add(file, c, `cada item de "${key}" precisa ter "tipo".`);
      continue;
    }
    const fx = e as Fx;
    const spec = registry[fx.tipo];
    if (!spec) {
      p.add(file, c, `tipo de efeito desconhecido "${fx.tipo}" em "${key}". Veja cartas/EFEITOS.md.`);
      continue;
    }
    for (const [k, val] of Object.entries(fx)) {
      if (k === "tipo") continue;
      const ps = spec.params?.[k];
      if (!ps) {
        p.add(file, c, `o efeito "${fx.tipo}" não tem o parâmetro "${k}". Parâmetros: ${Object.keys(spec.params ?? {}).join(", ") || "nenhum"}.`);
        continue;
      }
      const ok =
        ps.tipo === "numero"
          ? typeof val === "number"
          : ps.tipo === "sim/nao"
            ? typeof val === "boolean"
            : ps.tipo === "lista"
              ? Array.isArray(val)
              : typeof val === "string" || (k === "quantidade" && typeof val === "number");
      if (!ok) p.add(file, c, `no efeito "${fx.tipo}", "${k}" precisa ser ${ps.tipo}.`);
      if (ps.opcoes && typeof val === "string" && !ps.opcoes.includes(val))
        p.add(file, c, `no efeito "${fx.tipo}", "${k}" = "${val}" não é válido. Opções: ${ps.opcoes.join(", ")}.`);
      if ((k === "racas" || k === "classes" || k === "excetoClasses") && Array.isArray(val)) {
        const valid: readonly string[] = k === "racas" ? RACE_IDS : CLASS_IDS;
        for (const x of val) if (!valid.includes(x)) p.add(file, c, `"${x}" não é uma ${k === "racas" ? "raça" : "classe"} válida.`);
      }
      if (k === "tags" && Array.isArray(val)) for (const x of val) if (!TAGS.includes(x)) p.add(file, c, `tag "${x}" inválida.`);
    }
    for (const [k, ps] of Object.entries(spec.params ?? {})) {
      if (ps.obrigatorio && fx[k] === undefined) p.add(file, c, `o efeito "${fx.tipo}" precisa do parâmetro "${k}".`);
    }
    out.push(fx);
  }
  return out;
}

function arr(file: string, data: unknown, p: Problems): Raw[] {
  if (!Array.isArray(data)) {
    p.list.push(`cartas/${file}: o arquivo precisa ser uma lista [ ... ] de cartas.`);
    return [];
  }
  return data as Raw[];
}

const ABILITY_KEYS = ["nome", "texto"];

function ability(p: Problems, file: string, c: Raw, key: string) {
  const v = c[key];
  if (!v || typeof v !== "object") {
    p.add(file, c, `falta "${key}": { "nome": "...", "texto": "..." }.`);
    return { name: "", text: "" };
  }
  checkKeys(p, file, v as Raw, ABILITY_KEYS);
  return { name: str(p, file, v as Raw, "nome"), text: str(p, file, v as Raw, "texto") };
}

export interface LoadedCatalog {
  races: RaceCard[];
  classes: ClassCard[];
  items: ItemCard[];
  potions: PotionCard[];
  runes: RuneCard[];
  misc: MiscCard[];
  levelUps: LevelUpCard[];
  monsters: MonsterCard[];
  curses: CurseCard[];
  bonuses: MonsterBonusCard[];
  wandering: WanderingCard[];
  problems: string[];
}

function tierOf(level: number): 1 | 2 | 3 | 4 {
  if (level <= 10) return 1;
  if (level <= 20) return 2;
  if (level <= 30) return 3;
  return 4;
}

export function loadCatalog(): LoadedCatalog {
  const p = new Problems();
  const ids = new Set<string>();
  const uniq = (file: string, c: Raw, full: string) => {
    if (ids.has(full)) p.add(file, c, `id repetido. Cada carta precisa de um "id" único no arquivo.`);
    ids.add(full);
    if (typeof c.id === "string" && !/^[a-z0-9-]+$/.test(c.id)) p.add(file, c, `o "id" deve ter só letras minúsculas sem acento, números e hífen.`);
  };

  const races: RaceCard[] = arr("racas.json", racasJson, p).map((c) => {
    const f = "racas.json";
    checkKeys(p, f, c, ["id", "nome", "habilidadesDe", "copias", "passiva", "ativa"]);
    uniq(f, c, `race.${c.id}`);
    return {
      id: `race.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "race",
      deck: "door",
      copies: copies(p, f, c),
      race: one(p, f, c, "habilidadesDe", RACE_IDS),
      passive: ability(p, f, c, "passiva"),
      active: ability(p, f, c, "ativa"),
    };
  });
  const classes: ClassCard[] = arr("classes.json", classesJson, p).map((c) => {
    const f = "classes.json";
    checkKeys(p, f, c, ["id", "nome", "habilidadesDe", "copias", "passiva", "ativa"]);
    uniq(f, c, `class.${c.id}`);
    return {
      id: `class.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "class",
      deck: "door",
      copies: copies(p, f, c),
      cls: one(p, f, c, "habilidadesDe", CLASS_IDS),
      passive: ability(p, f, c, "passiva"),
      active: ability(p, f, c, "ativa"),
    };
  });
  const restriction = (f: string, c: Raw, key: string) => {
    const v = c[key];
    if (v === undefined) return undefined;
    if (typeof v !== "object" || !v) {
      p.add(f, c, `"${key}" precisa ser { "racas": [...], "classes": [...] }.`);
      return undefined;
    }
    checkKeys(p, f, v as Raw, ["racas", "classes"]);
    return { races: list(p, f, v as Raw, "racas", RACE_IDS), classes: list(p, f, v as Raw, "classes", CLASS_IDS) };
  };
  const items: ItemCard[] = arr("itens.json", itensJson, p).map((c) => {
    const f = "itens.json";
    checkKeys(p, f, c, ["id", "nome", "slot", "maos", "raridade", "bonus", "fugir", "grande", "preco", "copias", "somente", "proibido", "fogo", "impacto", "tags", "texto", "efeitos"]);
    uniq(f, c, `item.${c.id}`);
    const slotName = one(p, f, c, "slot", Object.keys(SLOTS));
    const slot = SLOTS[slotName] ?? "head";
    const hands = c.maos === undefined ? (slot === "hand" ? 1 : undefined) : num(p, f, c, "maos");
    if (hands !== undefined && hands !== 1 && hands !== 2) p.add(f, c, `"maos" precisa ser 1 ou 2.`);
    return {
      id: `item.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "item",
      deck: "treasure",
      copies: copies(p, f, c),
      slot,
      hands: hands as 1 | 2 | undefined,
      rarity: one(p, f, c, "raridade", RARITIES),
      bonus: num(p, f, c, "bonus"),
      flee: c.fugir === undefined ? undefined : num(p, f, c, "fugir"),
      big: bool(p, f, c, "grande") || undefined,
      price: num(p, f, c, "preco"),
      text: c.texto === undefined ? "" : str(p, f, c, "texto"),
      requires: restriction(f, c, "somente"),
      forbids: restriction(f, c, "proibido"),
      fire: bool(p, f, c, "fogo") || undefined,
      impact: bool(p, f, c, "impacto") || undefined,
      mountTags: list(p, f, c, "tags", TAGS),
      fx: effects(p, f, c, "efeitos", ITEM_EFFECTS),
    };
  });
  const simpleTreasure = <K extends "potion" | "rune" | "misc">(file: string, data: unknown, kind: K, reg: Record<string, EffectSpec>, prefix: string) =>
    arr(file, data, p).map((c) => {
      checkKeys(p, file, c, ["id", "nome", "raridade", "preco", "copias", "texto", "efeitos", ...(kind === "misc" ? ["permanente"] : [])]);
      uniq(file, c, `${prefix}.${c.id}`);
      const fx = effects(p, file, c, "efeitos", reg);
      if (fx.length === 0) p.add(file, c, `precisa de pelo menos 1 efeito em "efeitos".`);
      return {
        id: `${prefix}.${str(p, file, c, "id")}`,
        name: str(p, file, c, "nome"),
        kind,
        deck: "treasure" as const,
        copies: copies(p, file, c),
        rarity: one(p, file, c, "raridade", RARITIES),
        price: num(p, file, c, "preco"),
        text: str(p, file, c, "texto"),
        ...(kind === "misc" ? { permanent: bool(p, file, c, "permanente") } : {}),
        fx,
      };
    });
  const potions = simpleTreasure("pocoes.json", pocoesJson, "potion", POTION_EFFECTS, "potion") as PotionCard[];
  const runes = simpleTreasure("runas.json", runasJson, "rune", RUNE_EFFECTS, "rune") as RuneCard[];
  const misc = simpleTreasure("diversos.json", diversosJson, "misc", MISC_EFFECTS, "misc") as MiscCard[];
  const levelUps: LevelUpCard[] = arr("subir-nivel.json", subirJson, p).map((c) => {
    const f = "subir-nivel.json";
    checkKeys(p, f, c, ["id", "nome", "copias", "texto"]);
    uniq(f, c, `levelup.${c.id}`);
    return {
      id: `levelup.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "levelup",
      deck: "treasure",
      copies: copies(p, f, c),
      text: `${c.texto ? `${str(p, f, c, "texto")} ` : ""}Suba 1 nível (nunca para o nível 20). Jogue a qualquer momento.`,
    };
  });
  const monsters: MonsterCard[] = arr("monstros.json", monstrosJson, p).map((c) => {
    const f = "monstros.json";
    checkKeys(p, f, c, ["id", "nome", "nivel", "tags", "tesouros", "niveis", "copias", "fugir", "naoDaPraFugir", "acido", "veneno", "gigante", "goblinoide", "especial", "efeitos", "coisasRuinsTexto", "coisasRuins"]);
    uniq(f, c, `monster.${c.id}`);
    const level = num(p, f, c, "nivel");
    const badRaw = c.coisasRuins;
    const badStuff: BadEffect[] = [];
    if (!Array.isArray(badRaw)) p.add(f, c, `"coisasRuins" precisa ser uma lista, ex.: [ { "tipo": "perderNiveis", "quantidade": 2 } ].`);
    else
      for (const fx of effects(p, f, c, "coisasRuins", BAD_STUFF_TYPES)) {
        const n = typeof fx.quantidade === "number" ? fx.quantidade : 1;
        switch (fx.tipo) {
          case "perderNiveis": badStuff.push({ t: "levels", n }); break;
          case "perderSlot": badStuff.push({ t: "slot", slot: BAD_SLOTS[String(fx.slot)] ?? "head" }); break;
          case "perderAneis": badStuff.push({ t: "rings", n: fx.quantidade === "todos" ? "all" : Number(fx.quantidade) || 1 }); break;
          case "perderCartasDaMao": badStuff.push({ t: "handCards", n }); break;
          case "morte": badStuff.push({ t: "death" }); break;
          case "escolherItensParaPerder": badStuff.push({ t: "chooseEquipped", n }); break;
          case "perderItensAleatorios": badStuff.push({ t: "randomEquipped", n }); break;
          case "perderGrandeOuDoisItens": badStuff.push({ t: "bigOrChoose2" }); break;
          case "perderGrandeOuNiveis": badStuff.push({ t: "bigOrLevels", n: Number(fx.niveis) || 1 }); break;
          case "podridaoDeMumia": badStuff.push({ t: "mummyRot" }); break;
          case "possessao": badStuff.push({ t: "possession" }); break;
          case "quimera": badStuff.push({ t: "chimera" }); break;
          case "virarVampirico": badStuff.push({ t: "vampirize" }); break;
          case "perderItensNaoEquipados": badStuff.push({ t: "carried" }); break;
          case "outrosPerdemNiveis": badStuff.push({ t: "othersLoseLevels", n }); break;
        }
      }
    return {
      id: `monster.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "monster",
      deck: "door",
      copies: copies(p, f, c),
      level,
      tags: list(p, f, c, "tags", TAGS),
      special: c.especial === undefined ? "Nenhum." : str(p, f, c, "especial"),
      badStuffText: str(p, f, c, "coisasRuinsTexto"),
      badStuff,
      treasures: num(p, f, c, "tesouros"),
      levels: num(p, f, c, "niveis"),
      tier: tierOf(level),
      legendary: level >= 31,
      fleeMod: c.fugir === undefined ? undefined : num(p, f, c, "fugir"),
      cantFlee: bool(p, f, c, "naoDaPraFugir") || undefined,
      acidRust: bool(p, f, c, "acido") || undefined,
      poison: bool(p, f, c, "veneno") || undefined,
      giant: bool(p, f, c, "gigante") || undefined,
      goblinoid: bool(p, f, c, "goblinoide") || undefined,
      fx: effects(p, f, c, "efeitos", MONSTER_EFFECTS),
    };
  });
  const curses: CurseCard[] = arr("maldicoes.json", maldicoesJson, p).map((c) => {
    const f = "maldicoes.json";
    checkKeys(p, f, c, ["id", "nome", "tipo", "duracao", "copias", "texto", "efeitos"]);
    uniq(f, c, `curse.${c.id}`);
    const type = CURSE_TYPES[one(p, f, c, "tipo", Object.keys(CURSE_TYPES))] ?? "instant";
    if (type === "duration" && c.duracao === undefined) p.add(f, c, `maldições de "duracao" precisam do campo "duracao" (em rodadas).`);
    const fx = effects(p, f, c, "efeitos", CURSE_EFFECTS);
    if (fx.length === 0) p.add(f, c, `precisa de pelo menos 1 efeito em "efeitos".`);
    return {
      id: `curse.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "curse",
      deck: "door",
      copies: copies(p, f, c),
      curseType: type,
      duration: c.duracao === undefined ? undefined : num(p, f, c, "duracao"),
      text: str(p, f, c, "texto"),
      fx,
    };
  });
  const bonuses: MonsterBonusCard[] = arr("bonus-monstro.json", bonusJson, p).map((c) => {
    const f = "bonus-monstro.json";
    checkKeys(p, f, c, ["id", "nome", "valor", "copias", "texto"]);
    uniq(f, c, `bonus.${c.id}`);
    const value = num(p, f, c, "valor");
    return {
      id: `bonus.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "monsterBonus",
      deck: "door",
      copies: copies(p, f, c),
      value,
      text: `${c.texto ? `${str(p, f, c, "texto")} ` : ""}${value > 0 ? "+" : ""}${value} de nível para um monstro em combate. Uso único.`,
    };
  });
  const wandering: WanderingCard[] = arr("monstro-errante.json", erranteJson, p).map((c) => {
    const f = "monstro-errante.json";
    checkKeys(p, f, c, ["id", "nome", "copias", "texto"]);
    uniq(f, c, `wandering.${c.id}`);
    return {
      id: `wandering.${str(p, f, c, "id")}`,
      name: str(p, f, c, "nome"),
      kind: "wandering",
      deck: "door",
      copies: copies(p, f, c),
      text: str(p, f, c, "texto"),
    };
  });

  // Referências entre cartas
  const itemIds = new Set(items.map((i) => i.id.slice(5)));
  for (const it of items)
    for (const fx of it.fx ?? [])
      if (typeof fx.viraEm === "string" && !itemIds.has(fx.viraEm)) p.list.push(`cartas/itens.json → carta "${it.id.slice(5)}": "viraEm" aponta para o item "${fx.viraEm}", que não existe.`);
  for (const m of monsters)
    for (const fx of m.fx ?? [])
      if (typeof fx.itemEquipado === "string" && !itemIds.has(fx.itemEquipado))
        p.list.push(`cartas/monstros.json → carta "${m.id.slice(8)}": "itemEquipado" aponta para o item "${fx.itemEquipado}", que não existe.`);
  for (const k of RACE_IDS) if (!races.some((r) => r.race === k)) p.list.push(`cartas/racas.json: nenhuma raça usa "habilidadesDe": "${k}" (a raça padrão precisa existir).`);
  if (!races.some((r) => r.id === "race.humano")) p.list.push(`cartas/racas.json: a raça "humano" precisa existir (usada pela maldição Crise de Identidade).`);
  if (!races.some((r) => r.id === "race.vampirico")) p.list.push(`cartas/racas.json: a raça "vampirico" precisa existir (usada pelo Vampiro Ancestral).`);

  return { races, classes, items, potions, runes, misc, levelUps, monsters, curses, bonuses, wandering, problems: p.list };
}
