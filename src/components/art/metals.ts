import { ART, type CardDef, type Rarity } from "@/game/catalog";

export type Metal = "cobre" | "bronze" | "prata" | "ouro" | "negro";

/** Metal da moldura de cada raridade (definido em cartas/imagens.json, bloco "molduras"). */
export const METAL_OF = ART.molduras as Record<Rarity, Metal>;

export const METAL_LABEL: Record<Metal, string> = {
  cobre: "Cobre",
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  negro: "Ferro negro",
};

/** Raridade usada na moldura: cartas sem raridade são "comum" (cobre); monstros lendários são "lendario". */
export function rarityOf(d: CardDef | null | undefined): Rarity {
  if (!d) return "comum";
  if ("rarity" in d && d.rarity) return d.rarity;
  if (d.kind === "monster" && d.legendary) return "lendario";
  return "comum";
}

/** Paradas de gradiente (escuro → brilho → escuro) e cores de detalhe de cada metal. */
export const METAL: Record<Metal, { stops: string[]; edge: string; shine: string; deep: string }> = {
  cobre: { stops: ["#4a2410", "#8f4c24", "#d07c40", "#f6b27a", "#b0602e", "#5e2e13", "#9a5428"], edge: "#2a1206", shine: "#ffd2a6", deep: "#3a1a09" },
  bronze: { stops: ["#3b2a0f", "#7c5b25", "#b98a3f", "#e8c682", "#8f6b2f", "#4a3412", "#a07a36"], edge: "#22180a", shine: "#fff0c2", deep: "#2e2009" },
  prata: { stops: ["#3a3e44", "#7d848c", "#c4c9cf", "#f7f9fb", "#9ba2a9", "#50555b", "#b4bac0"], edge: "#1d2024", shine: "#ffffff", deep: "#2a2d31" },
  ouro: { stops: ["#5a3c07", "#a8741a", "#e5b43c", "#fff2a8", "#c9902a", "#6e4c0c", "#e0a933"], edge: "#2e1e03", shine: "#fffbe0", deep: "#3d2904" },
  negro: { stops: ["#030303", "#19181c", "#38343e", "#6f667a", "#26232b", "#08080a", "#2f2b35"], edge: "#000000", shine: "#a99bbd", deep: "#050407" },
};
