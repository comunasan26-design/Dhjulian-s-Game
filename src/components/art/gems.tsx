/**
 * Gemas desenhadas em SVG (facetas em polígonos chapados, sem filtros: leves para renderizar dezenas de cartas).
 * Cada gema é desenhada centrada em (0,0) com "raio" R.
 */
import type { CardDef } from "@/game/catalog";

export type GemKind =
  | "quartzoBranco"
  | "quartzoMarrom"
  | "topazio"
  | "bismuto"
  | "turmalina"
  | "safira"
  | "rubi"
  | "esmeralda"
  | "diamante"
  | "obsidiana"
  | "obsidianaRachada";

export const GEM_LABEL: Record<GemKind, string> = {
  quartzoBranco: "Quartzo branco",
  quartzoMarrom: "Quartzo marrom",
  topazio: "Topázio amarelo",
  bismuto: "Bismuto",
  turmalina: "Turmalina rosa",
  safira: "Safira azul",
  rubi: "Rubi vermelho",
  esmeralda: "Esmeralda verde",
  diamante: "Diamante",
  obsidiana: "Obsidiana",
  obsidianaRachada: "Obsidiana rachada",
};

export function gemOf(kind: CardDef["kind"] | undefined): GemKind {
  switch (kind) {
    case "race":
      return "quartzoMarrom";
    case "misc":
      return "topazio";
    case "potion":
      return "bismuto";
    case "monsterBonus":
      return "turmalina";
    case "item":
      return "safira";
    case "rune":
      return "rubi";
    case "curse":
      return "esmeralda";
    case "levelup":
      return "diamante";
    case "monster":
      return "obsidiana";
    case "wandering":
      return "obsidianaRachada";
    default:
      return "quartzoBranco";
  }
}

/** [mais escuro, escuro, médio, claro, brilho] */
type Pal = [string, string, string, string, string];

const PAL: Record<Exclude<GemKind, "bismuto" | "obsidiana" | "obsidianaRachada">, Pal> = {
  quartzoBranco: ["#8c8d97", "#bfc1ca", "#dfe0e7", "#f4f4f8", "#ffffff"],
  quartzoMarrom: ["#24130a", "#4f2e17", "#7d522e", "#b0825a", "#f0d6b8"],
  topazio: ["#6e4200", "#b87106", "#eea918", "#ffd654", "#fff6c8"],
  turmalina: ["#560a30", "#9c1f5a", "#d64686", "#f597c0", "#ffe3f0"],
  safira: ["#081a52", "#1b3a96", "#2c62cc", "#6c9ef0", "#dbe8ff"],
  rubi: ["#43040e", "#870c20", "#c21934", "#ee5a6d", "#ffd3d9"],
  esmeralda: ["#04361c", "#0a6535", "#14954f", "#4ccd87", "#cdf7de"],
  diamante: ["#8ea2b7", "#c5d3e1", "#e6eef6", "#ffffff", "#ffffff"],
};

const pt = (a: number, r: number, sx = 1, sy = 1) => [Math.sin(a) * r * sx, -Math.cos(a) * r * sy] as const;
const poly = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

/** Lapidação brilhante (redonda/oval): mesa octogonal + coroa em triângulos alternados. */
function Brilliant({ R, pal, sx = 1, sy = 1, fire = false }: { R: number; pal: Pal; sx?: number; sy?: number; fire?: boolean }) {
  const n = 8;
  const outer = Array.from({ length: n }, (_, i) => pt((i / n) * Math.PI * 2 + Math.PI / n, R, sx, sy));
  const mid = Array.from({ length: n }, (_, i) => pt((i / n) * Math.PI * 2, R * 0.78, sx, sy));
  const table = Array.from({ length: n }, (_, i) => pt((i / n) * Math.PI * 2 + Math.PI / n, R * 0.45, sx, sy));
  // luz vindo de cima-esquerda: facetas mais claras nesse lado
  const shade = (i: number) => {
    const a = ((i + 0.5) / n) * 360;
    if (a > 260 || a < 20) return pal[3];
    if (a < 100) return pal[2];
    if (a < 200) return pal[0];
    return pal[1];
  };
  return (
    <g>
      <polygon points={poly(outer)} fill={pal[1]} stroke={pal[0]} strokeWidth={R * 0.06} />
      {outer.map((o, i) => {
        const o2 = outer[(i + 1) % n];
        const m = mid[(i + 1) % n];
        const t1 = table[i];
        const t2 = table[(i + 1) % n];
        return (
          <g key={i}>
            <polygon points={poly([o, m, t1])} fill={shade(i)} />
            <polygon points={poly([m, o2, t2])} fill={shade(i + 1)} opacity={0.9} />
            <polygon points={poly([t1, m, t2])} fill={shade(i + 4)} opacity={0.85} />
          </g>
        );
      })}
      <polygon points={poly(table)} fill={pal[2]} />
      <polygon points={poly(table.slice(5).concat(table.slice(0, 2)))} fill={pal[3]} opacity={0.55} />
      {fire && (
        <g opacity={0.75}>
          <polygon points={poly([table[0], table[1], [0, 0]])} fill="#9fd8ff" />
          <polygon points={poly([table[3], table[4], [0, 0]])} fill="#ffc2e6" />
          <polygon points={poly([table[5], table[6], [0, 0]])} fill="#fff2a0" />
        </g>
      )}
      <ellipse cx={-R * 0.32 * sx} cy={-R * 0.38 * sy} rx={R * 0.2} ry={R * 0.1} fill={pal[4]} opacity={0.9} transform={`rotate(-35 ${-R * 0.32 * sx} ${-R * 0.38 * sy})`} />
      <circle cx={R * 0.3 * sx} cy={R * 0.1 * sy} r={R * 0.06} fill={pal[4]} opacity={0.7} />
    </g>
  );
}

/** Lapidação em degraus (esmeralda / turmalina): retângulo de cantos cortados com degraus concêntricos. */
function Step({ R, pal, w = 0.82, h = 1 }: { R: number; pal: Pal; w?: number; h?: number }) {
  const rect = (k: number) => {
    const W = R * w * k;
    const H = R * h * k;
    const c = Math.min(W, H) * 0.32;
    return [
      [-W + c, -H],
      [W - c, -H],
      [W, -H + c],
      [W, H - c],
      [W - c, H],
      [-W + c, H],
      [-W, H - c],
      [-W, -H + c],
    ] as [number, number][];
  };
  const steps = [1, 0.78, 0.56];
  const fills = [pal[1], pal[2], pal[3]];
  return (
    <g>
      {steps.map((k, i) => {
        const r = rect(k);
        return (
          <g key={k}>
            <polygon points={poly(r)} fill={fills[i]} stroke={pal[0]} strokeWidth={R * 0.04} />
            {/* metade inferior-direita mais escura (sombra) */}
            <polygon points={poly([r[2], r[3], r[4], r[5]])} fill={pal[0]} opacity={0.35} />
            <polygon points={poly([r[7], r[0], r[1]])} fill={pal[4]} opacity={0.25} />
          </g>
        );
      })}
      <rect x={-R * w * 0.3} y={-R * h * 0.36} width={R * w * 0.6} height={R * h * 0.72} fill={pal[2]} opacity={0.9} />
      <line x1={-R * w * 0.62} y1={-R * h * 0.75} x2={-R * w * 0.2} y2={-R * h * 0.75} stroke={pal[4]} strokeWidth={R * 0.08} strokeLinecap="round" opacity={0.85} />
    </g>
  );
}

/** Cristal de quartzo: prisma hexagonal com ponta. */
function Crystal({ R, pal }: { R: number; pal: Pal }) {
  const W = R * 0.62;
  const top: [number, number] = [0, -R];
  const sh = -R * 0.45;
  const bot = R * 0.95;
  const left = [[-W, sh], top, [-W * 0.25, sh + R * 0.12], [-W * 0.25, bot], [-W, bot - R * 0.12]] as [number, number][];
  const mid = [top, [W * 0.35, sh + R * 0.08], [W * 0.35, bot], [-W * 0.25, bot], [-W * 0.25, sh + R * 0.12]] as [number, number][];
  const right = [top, [W, sh], [W, bot - R * 0.12], [W * 0.35, bot], [W * 0.35, sh + R * 0.08]] as [number, number][];
  return (
    <g>
      {/* cristais menores ao lado */}
      <polygon points={poly([[-W * 1.45, R * 0.95], [-W * 1.15, R * 0.05], [-W * 0.85, R * 0.95]])} fill={pal[1]} stroke={pal[0]} strokeWidth={R * 0.04} />
      <polygon points={poly([[W * 0.85, R * 0.95], [W * 1.2, R * 0.2], [W * 1.5, R * 0.95]])} fill={pal[2]} stroke={pal[0]} strokeWidth={R * 0.04} />
      <polygon points={poly(left)} fill={pal[3]} stroke={pal[0]} strokeWidth={R * 0.05} />
      <polygon points={poly(mid)} fill={pal[2]} stroke={pal[0]} strokeWidth={R * 0.05} />
      <polygon points={poly(right)} fill={pal[1]} stroke={pal[0]} strokeWidth={R * 0.05} />
      <polygon points={poly([[-W, sh], top, [-W * 0.25, sh + R * 0.12]])} fill={pal[4]} opacity={0.8} />
      <line x1={-W * 0.62} y1={sh + R * 0.3} x2={-W * 0.62} y2={bot - R * 0.3} stroke={pal[4]} strokeWidth={R * 0.07} opacity={0.6} strokeLinecap="round" />
    </g>
  );
}

/** Bismuto: cristal em degraus quadrados, iridescente. */
function Bismuth({ R }: { R: number }) {
  const cols = ["#5b2a86", "#d4357f", "#f0b429", "#2fb6a6", "#3f6fd8", "#9be15d"];
  const rings = 5;
  return (
    <g transform="rotate(8)">
      {Array.from({ length: rings }, (_, i) => {
        const s = R * (1 - i * 0.18);
        const off = i * R * 0.04;
        return (
          <g key={i}>
            <rect x={-s + off} y={-s - off} width={s * 2} height={s * 2} fill={cols[i % cols.length]} stroke="#1d1030" strokeWidth={R * 0.05} />
            <polygon
              points={poly([
                [-s + off, -s - off],
                [s + off, -s - off],
                [s + off - R * 0.12, -s - off + R * 0.12],
                [-s + off + R * 0.12, -s - off + R * 0.12],
              ])}
              fill="#ffffff"
              opacity={0.28}
            />
            <polygon
              points={poly([
                [s + off, -s - off],
                [s + off, s - off],
                [s + off - R * 0.12, s - off - R * 0.12],
                [s + off - R * 0.12, -s - off + R * 0.12],
              ])}
              fill="#000"
              opacity={0.25}
            />
          </g>
        );
      })}
      <rect x={-R * 0.12} y={-R * 0.34} width={R * 0.24} height={R * 0.24} fill="#1d1030" />
    </g>
  );
}

/** Obsidiana: cabochão vítreo negro, opcionalmente rachado. */
function Obsidian({ R, cracked }: { R: number; cracked?: boolean }) {
  return (
    <g>
      <ellipse rx={R * 0.95} ry={R * 0.82} fill="#060508" stroke="#000" strokeWidth={R * 0.06} />
      <ellipse rx={R * 0.8} ry={R * 0.68} fill="#151219" />
      <ellipse cy={R * 0.12} rx={R * 0.68} ry={R * 0.5} fill="#0a080d" />
      <path d={`M ${-R * 0.6} ${-R * 0.25} Q ${-R * 0.35} ${-R * 0.62} ${R * 0.15} ${-R * 0.6}`} stroke="#d9d4f0" strokeWidth={R * 0.1} fill="none" strokeLinecap="round" opacity={0.75} />
      <circle cx={R * 0.42} cy={R * 0.32} r={R * 0.07} fill="#8e86ad" opacity={0.6} />
      {cracked && (
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path
            d={`M ${-R * 0.1} ${-R * 0.8} L ${R * 0.05} ${-R * 0.35} L ${-R * 0.18} ${-R * 0.05} L ${R * 0.12} ${R * 0.3} L ${-R * 0.02} ${R * 0.78} M ${R * 0.05} ${-R * 0.35} L ${R * 0.5} ${-R * 0.25} M ${-R * 0.18} ${-R * 0.05} L ${-R * 0.62} ${R * 0.18}`}
            stroke="#ff5a2a"
            strokeWidth={R * 0.13}
            opacity={0.45}
          />
          <path
            d={`M ${-R * 0.1} ${-R * 0.8} L ${R * 0.05} ${-R * 0.35} L ${-R * 0.18} ${-R * 0.05} L ${R * 0.12} ${R * 0.3} L ${-R * 0.02} ${R * 0.78} M ${R * 0.05} ${-R * 0.35} L ${R * 0.5} ${-R * 0.25} M ${-R * 0.18} ${-R * 0.05} L ${-R * 0.62} ${R * 0.18}`}
            stroke="#ffd2a8"
            strokeWidth={R * 0.04}
          />
        </g>
      )}
    </g>
  );
}

export function Gem({ kind, R }: { kind: GemKind; R: number }) {
  switch (kind) {
    case "bismuto":
      return <Bismuth R={R * 0.86} />;
    case "obsidiana":
      return <Obsidian R={R} />;
    case "obsidianaRachada":
      return <Obsidian R={R} cracked />;
    case "quartzoBranco":
    case "quartzoMarrom":
      return <Crystal R={R} pal={PAL[kind]} />;
    case "esmeralda":
      return <Step R={R} pal={PAL.esmeralda} w={0.95} h={0.78} />;
    case "turmalina":
      return <Step R={R} pal={PAL.turmalina} w={0.6} h={1} />;
    case "topazio":
      return <Brilliant R={R} pal={PAL.topazio} sx={0.82} sy={1} />;
    case "diamante":
      return <Brilliant R={R} pal={PAL.diamante} fire />;
    default:
      return <Brilliant R={R} pal={PAL[kind]} />;
  }
}
