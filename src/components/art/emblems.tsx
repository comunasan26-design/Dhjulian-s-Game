/**
 * Ilustrações das cartas: o desenho vem de cartas/imagens.json (campo "imagem" de cada carta).
 * O valor pode ser o nome de um desenho de imagens.json, um SVG escrito na própria carta, ou o
 * endereço de uma imagem (arquivo em public/ como "/imagens/x.png", ou um link https://).
 */
import { ART, type CardDef } from "@/game/catalog";
import { isImageUrl } from "@/game/catalog/load";

/** Chave de cada tipo de carta em imagens.json (o nome do arquivo de cartas). */
export const KIND_FILE: Record<CardDef["kind"], string> = {
  race: "racas",
  class: "classes",
  item: "itens",
  potion: "pocoes",
  rune: "runas",
  misc: "diversos",
  levelup: "subir-nivel",
  monster: "monstros",
  curse: "maldicoes",
  monsterBonus: "bonus-monstro",
  wandering: "monstro-errante",
};

/** Ajusta um SVG qualquer para ocupar a caixa 100x100 da ilustração. */
function fit(svg: string): string {
  const t = svg.trim();
  if (!t.startsWith("<svg")) return `<svg viewBox="0 0 100 100" width="100" height="100">${t}</svg>`;
  return t.replace(/^<svg\b([^>]*)>/, (_m, attrs: string) => {
    let a = attrs.replace(/\s(width|height|x|y)="[^"]*"/g, "");
    if (!/viewBox=/.test(a)) a += ' viewBox="0 0 100 100"';
    return `<svg${a} width="100" height="100">`;
  });
}

/** Ilustração (caixa 100x100) da carta. */
export function Emblem({ d }: { d: CardDef }) {
  const img = (d.image ?? ART.padroes[KIND_FILE[d.kind]] ?? "").trim();
  if (!img) return null;
  if (isImageUrl(img)) return <image href={img} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet" />;
  const svg = img.startsWith("<") ? img : ART.desenhos[img];
  if (!svg) return null;
  return <g dangerouslySetInnerHTML={{ __html: fit(svg) }} />;
}

/** Cores do cenário da janela de ilustração: [céu, horizonte, chão]. */
export function sceneOf(kind: CardDef["kind"]): [string, string, string] {
  const c = ART.cenarios[KIND_FILE[kind]];
  return c ? [c.ceu, c.horizonte, c.chao] : ["#cccccc", "#eeeeee", "#999999"];
}
