// Tipos das definições de cartas (catálogo estático).

export type RaceId =
  | "divino"
  | "anao"
  | "draconato"
  | "elfo"
  | "gnomo"
  | "gigante"
  | "humano"
  | "orc"
  | "diabrete"
  | "elemental"
  | "goblin"
  | "centauro"
  | "torkle"
  | "owlin"
  | "tritao"
  | "fada"
  | "vampirico";

export type ClassId =
  | "guerreiro"
  | "mago"
  | "clerigo"
  | "ladino"
  | "druida"
  | "paladino"
  | "barbaro"
  | "bardo"
  | "feiticeiro"
  | "bruxo"
  | "monge"
  | "patrulheiro"
  | "ilusionista"
  | "berserker"
  | "artifice"
  | "alquimista";

export type Slot = "head" | "chest" | "legs" | "feet" | "hand" | "ring" | "neck" | "mount";
export type Rarity = "comum" | "incomum" | "raro" | "epico" | "lendario";
export type Tag =
  | "morto-vivo"
  | "demonio"
  | "dragao"
  | "fogo"
  | "aquatico"
  | "animal"
  | "voador"
  | "sagrado";

export type DeckName = "door" | "treasure";

interface CardBase {
  id: string;
  name: string;
  deck: DeckName;
  /** Número de cópias no baralho (padrão 1). */
  copies?: number;
}

export interface AbilityText {
  name: string;
  text: string;
}

export interface RaceCard extends CardBase {
  kind: "race";
  race: RaceId;
  passive: AbilityText;
  active: AbilityText;
}

export interface ClassCard extends CardBase {
  kind: "class";
  cls: ClassId;
  passive: AbilityText;
  active: AbilityText;
}

export interface Restriction {
  races?: RaceId[];
  classes?: ClassId[];
}

export interface ItemCard extends CardBase {
  kind: "item";
  slot: Slot;
  hands?: 1 | 2;
  rarity: Rarity;
  bonus: number;
  flee?: number;
  big?: boolean;
  price: number;
  text: string;
  /** Só pode usar quem tiver uma das raças OU classes listadas. */
  requires?: Restriction;
  /** Quem tiver uma das raças OU classes listadas não pode usar. */
  forbids?: Restriction;
  fire?: boolean;
  impact?: boolean;
  mountTags?: Tag[];
}

export interface PotionCard extends CardBase {
  kind: "potion";
  rarity: Rarity;
  price: number;
  text: string;
}

export interface RuneCard extends CardBase {
  kind: "rune";
  rarity: Rarity;
  price: number;
  text: string;
}

export interface MiscCard extends CardBase {
  kind: "misc";
  rarity: Rarity;
  price: number;
  text: string;
  permanent: boolean;
}

export interface LevelUpCard extends CardBase {
  kind: "levelup";
  text: string;
}

export type BadEffect =
  | { t: "levels"; n: number }
  | { t: "slot"; slot: "head" | "chest" | "legs" | "feet" | "mount" | "hands" }
  | { t: "rings"; n: number | "all" }
  | { t: "handCards"; n: number }
  | { t: "death" }
  | { t: "chooseEquipped"; n: number }
  | { t: "randomEquipped"; n: number }
  | { t: "bigOrChoose2" }
  | { t: "bigOrLevels"; n: number }
  | { t: "mummyRot" }
  | { t: "possession" }
  | { t: "chimera" }
  | { t: "vampirize" }
  | { t: "carried" }
  | { t: "othersLoseLevels"; n: number };

export interface MonsterCard extends CardBase {
  kind: "monster";
  level: number;
  tags: Tag[];
  special: string;
  badStuffText: string;
  badStuff: BadEffect[];
  treasures: number;
  levels: number;
  tier: 1 | 2 | 3 | 4;
  legendary: boolean;
  /** Modificador de Fugir contra este monstro. */
  fleeMod?: number;
  /** "Não dá para fugir". */
  cantFlee?: boolean;
  /** Ácido/ferrugem (Grevas de Mithral e Runa da Pedra protegem). */
  acidRust?: boolean;
  /** Veneno/doença (Amuleto da Saúde protege). */
  poison?: boolean;
  /** Gigante (Martelo do Trovão). */
  giant?: boolean;
  /** Kobold/Goblin (Coroa do Rei Goblin). */
  goblinoid?: boolean;
}

export type CurseType = "instant" | "combat" | "duration" | "persistent";

export interface CurseCard extends CardBase {
  kind: "curse";
  curseType: CurseType;
  duration?: number;
  text: string;
}

export interface MonsterBonusCard extends CardBase {
  kind: "monsterBonus";
  value: number;
  text: string;
}

export interface WanderingCard extends CardBase {
  kind: "wandering";
  text: string;
}

export type CardDef =
  | RaceCard
  | ClassCard
  | ItemCard
  | PotionCard
  | RuneCard
  | MiscCard
  | LevelUpCard
  | MonsterCard
  | CurseCard
  | MonsterBonusCard
  | WanderingCard;

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: "Comum",
  incomum: "Incomum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};

export const SLOT_LABEL: Record<Slot, string> = {
  head: "Capacete",
  chest: "Peitoral",
  legs: "Calças",
  feet: "Botas",
  hand: "Mão",
  ring: "Anel",
  neck: "Colar",
  mount: "Montaria",
};

export const TAG_LABEL: Record<Tag, string> = {
  "morto-vivo": "Morto-vivo",
  demonio: "Demônio",
  dragao: "Dragão",
  fogo: "Fogo",
  aquatico: "Aquático",
  animal: "Animal",
  voador: "Voador",
  sagrado: "Sagrado",
};
