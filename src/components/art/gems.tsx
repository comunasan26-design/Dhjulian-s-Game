/**
 * Gemas desenhadas em SVG (facetas em polígonos chapados, sem filtros: leves para renderizar dezenas de cartas).
 * Cada gema tem um contorno poligonal (gemOutline) que ela preenche por inteiro; o engaste de metal da carta
 * segue esse mesmo contorno. Tudo centrado em (0,0), cabendo numa caixa de lado 2R.
 */
import { ART, type CardDef } from "@/game/catalog";
import { KIND_FILE } from "./emblems";

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

/** Gema de cada tipo de carta (definida em cartas/imagens.json, bloco "gemas"). */
export function gemOf(kind: CardDef["kind"] | undefined): GemKind {
  const g = kind ? ART.gemas[KIND_FILE[kind]] : undefined;
  return (g && g in GEM_LABEL ? g : "quartzoBranco") as GemKind;
}

type Pt = [number, number];
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

const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (a: number, r: number, sx = 1, sy = 1): Pt => [r2(Math.sin(a) * r * sx), r2(-Math.cos(a) * r * sy)];
export const poly = (pts: readonly Pt[]) => pts.map(([x, y]) => `${x},${y}`).join(" ");
const lerp = (a: Pt, b: Pt, t: number): Pt => [r2(a[0] + (b[0] - a[0]) * t), r2(a[1] + (b[1] - a[1]) * t)];

function ngon(n: number, R: number, sx = 1, sy = 1, phase = Math.PI / n): Pt[] {
  return Array.from({ length: n }, (_, i) => pt((i / n) * Math.PI * 2 + phase, R, sx, sy));
}
function cutRect(W: number, H: number, cut: number): Pt[] {
  return [
    [-W + cut, -H],
    [W - cut, -H],
    [W, -H + cut],
    [W, H - cut],
    [W - cut, H],
    [-W + cut, H],
    [-W, H - cut],
    [-W, -H + cut],
  ];
}
const OBSIDIAN: Pt[] = [
  [-0.35, -0.95],
  [0.45, -0.88],
  [0.95, -0.25],
  [0.82, 0.55],
  [0.2, 0.95],
  [-0.62, 0.78],
  [-0.97, 0.05],
];

/** Contorno de cada gema (o engaste segue este polígono). */
export function gemOutline(kind: GemKind, R: number): Pt[] {
  switch (kind) {
    case "quartzoBranco":
    case "quartzoMarrom":
    case "bismuto": {
      const s = r2(R * 0.84);
      return [
        [-s, -s],
        [s, -s],
        [s, s],
        [-s, s],
      ];
    }
    case "esmeralda":
      return cutRect(R * 0.98, R * 0.74, R * 0.26);
    case "turmalina":
      return cutRect(R * 0.58, R, R * 0.2);
    case "topazio":
      return ngon(8, R, 0.76, 1);
    case "obsidiana":
    case "obsidianaRachada":
      return OBSIDIAN.map(([x, y]) => [r2(x * R), r2(y * R)]);
    default:
      return ngon(8, R);
  }
}

/** Polígono convexo deslocado para fora (d > 0) ou para dentro (d < 0). */
export function offsetPoly(pts: Pt[], d: number): Pt[] {
  const n = pts.length;
  const cx = pts.reduce((a, p) => a + p[0], 0) / n;
  const cy = pts.reduce((a, p) => a + p[1], 0) / n;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    let nx = q[1] - p[1];
    let ny = -(q[0] - p[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const mx = (p[0] + q[0]) / 2 - cx;
    const my = (p[1] + q[1]) / 2 - cy;
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { p: [p[0] + nx * d, p[1] + ny * d] as Pt, dir: [q[0] - p[0], q[1] - p[1]] as Pt };
  });
  return lines.map((l2, i) => {
    const l1 = lines[(i - 1 + n) % n];
    const det = l1.dir[0] * l2.dir[1] - l1.dir[1] * l2.dir[0];
    if (Math.abs(det) < 1e-9) return [r2(l2.p[0]), r2(l2.p[1])] as Pt;
    const t = ((l2.p[0] - l1.p[0]) * l2.dir[1] - (l2.p[1] - l1.p[1]) * l2.dir[0]) / det;
    return [r2(l1.p[0] + l1.dir[0] * t), r2(l1.p[1] + l1.dir[1] * t)] as Pt;
  });
}

/** Sombra por direção: luz vindo de cima-esquerda. */
function shadeFor(mid: Pt, pal: Pal): string {
  const a = (Math.atan2(mid[1], mid[0]) * 180) / Math.PI; // -180..180, 0 = direita, -90 = cima
  if (a < -100 && a > -170) return pal[3];
  if (a <= -170 || a > 150) return pal[2];
  if (a >= -100 && a < -20) return pal[2];
  if (a >= -20 && a < 70) return pal[0];
  return pal[1];
}

/** Lapidação brilhante (contorno octogonal, redondo ou oval). */
function Brilliant({ outline, pal, fire = false }: { outline: Pt[]; pal: Pal; fire?: boolean }) {
  const n = outline.length;
  const table = outline.map((p) => lerp([0, 0], p, 0.48));
  const girdleMid = outline.map((p, i) => lerp(lerp(p, outline[(i + 1) % n], 0.5), [0, 0], 0.18));
  const ext = Math.max(...outline.map((p) => Math.abs(p[0])));
  return (
    <g>
      <polygon points={poly(outline)} fill={pal[1]} />
      {outline.map((o, i) => {
        const o2 = outline[(i + 1) % n];
        const m = girdleMid[i];
        const t1 = table[i];
        const t2 = table[(i + 1) % n];
        const mid = lerp(o, o2, 0.5);
        return (
          <g key={i}>
            <polygon points={poly([o, m, t1])} fill={shadeFor(lerp(o, t1, 0.5), pal)} />
            <polygon points={poly([m, o2, t2])} fill={shadeFor(lerp(o2, t2, 0.5), pal)} opacity={0.92} />
            <polygon points={poly([o, o2, m])} fill={shadeFor(mid, pal)} opacity={0.75} />
            <polygon points={poly([t1, m, t2])} fill={shadeFor([-mid[0], -mid[1]], pal)} opacity={0.85} />
          </g>
        );
      })}
      <polygon points={poly(table)} fill={pal[2]} />
      <polygon points={poly([table[n - 2], table[n - 1], table[0], [0, 0]])} fill={pal[3]} opacity={0.6} />
      {fire && (
        <g opacity={0.75}>
          <polygon points={poly([table[0], table[1], [0, 0]])} fill="#9fd8ff" />
          <polygon points={poly([table[3], table[4], [0, 0]])} fill="#ffc2e6" />
          <polygon points={poly([table[5], table[6], [0, 0]])} fill="#fff2a0" />
        </g>
      )}
      <polygon points={poly(outline)} fill="none" stroke={pal[0]} strokeWidth={ext * 0.05} />
      <ellipse cx={r2(-ext * 0.3)} cy={r2(-ext * 0.36)} rx={r2(ext * 0.2)} ry={r2(ext * 0.09)} fill={pal[4]} opacity={0.9} transform={`rotate(-35 ${r2(-ext * 0.3)} ${r2(-ext * 0.36)})`} />
    </g>
  );
}

/** Lapidação em degraus (esmeralda / turmalina): o contorno e dois degraus internos. */
function Step({ outline, pal }: { outline: Pt[]; pal: Pal }) {
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const W = Math.max(...xs);
  const H = Math.max(...ys);
  const steps = [outline, offsetPoly(outline, -Math.min(W, H) * 0.24), offsetPoly(outline, -Math.min(W, H) * 0.48)];
  const fills = [pal[1], pal[2], pal[3]];
  return (
    <g>
      {steps.map((r, i) => (
        <g key={i}>
          <polygon points={poly(r)} fill={fills[i]} stroke={pal[0]} strokeWidth={Math.min(W, H) * 0.05} />
          <polygon points={poly([r[2], r[3], r[4], r[5]])} fill={pal[0]} opacity={0.35} />
          <polygon points={poly([r[7], r[0], r[1]])} fill={pal[4]} opacity={0.3} />
        </g>
      ))}
      <line x1={r2(-W * 0.55)} y1={r2(-H * 0.7)} x2={r2(-W * 0.1)} y2={r2(-H * 0.7)} stroke={pal[4]} strokeWidth={Math.min(W, H) * 0.09} strokeLinecap="round" opacity={0.85} />
    </g>
  );
}

/** Quartzo visto de cima: quadrado com a ponta piramidal (4 facetas) e uma terminação central. */
function QuartzTop({ outline, pal }: { outline: Pt[]; pal: Pal }) {
  const s = outline[1][0];
  const inner = offsetPoly(outline, -s * 0.62);
  const tip: Pt = [r2(-s * 0.08), r2(-s * 0.1)];
  const faces = [
    { pts: [outline[0], outline[1], inner[1], inner[0]], c: pal[3] },
    { pts: [outline[1], outline[2], inner[2], inner[1]], c: pal[1] },
    { pts: [outline[2], outline[3], inner[3], inner[2]], c: pal[0] },
    { pts: [outline[3], outline[0], inner[0], inner[3]], c: pal[2] },
  ];
  return (
    <g>
      {faces.map((f, i) => (
        <polygon key={i} points={poly(f.pts)} fill={f.c} stroke={pal[0]} strokeWidth={s * 0.04} />
      ))}
      <polygon points={poly([inner[0], inner[1], tip])} fill={pal[4]} />
      <polygon points={poly([inner[1], inner[2], tip])} fill={pal[2]} />
      <polygon points={poly([inner[2], inner[3], tip])} fill={pal[1]} />
      <polygon points={poly([inner[3], inner[0], tip])} fill={pal[3]} />
      <line x1={r2(-s * 0.7)} y1={r2(-s * 0.84)} x2={r2(s * 0.1)} y2={r2(-s * 0.84)} stroke={pal[4]} strokeWidth={s * 0.08} strokeLinecap="round" opacity={0.7} />
      <polygon points={poly(outline)} fill="none" stroke={pal[0]} strokeWidth={s * 0.06} />
    </g>
  );
}

/** Bismuto: cristal em degraus quadrados, iridescente. */
function Bismuth({ outline }: { outline: Pt[] }) {
  const cols = ["#5b2a86", "#d4357f", "#f0b429", "#2fb6a6", "#3f6fd8", "#9be15d"];
  const s = outline[1][0];
  const rings = 5;
  return (
    <g>
      {Array.from({ length: rings }, (_, i) => {
        const k = s * (1 - i * 0.19);
        const off = r2(i * s * 0.05);
        const sq: Pt[] = [
          [r2(-k + off), r2(-k - off)],
          [r2(k + off), r2(-k - off)],
          [r2(k + off), r2(k - off)],
          [r2(-k + off), r2(k - off)],
        ];
        const bevel = s * 0.13;
        return (
          <g key={i}>
            <polygon points={poly(i === 0 ? outline : sq)} fill={cols[i % cols.length]} stroke="#1d1030" strokeWidth={s * 0.05} />
            <polygon points={poly([sq[0], sq[1], [sq[1][0] - bevel, sq[1][1] + bevel], [sq[0][0] + bevel, sq[0][1] + bevel]])} fill="#ffffff" opacity={0.3} />
            <polygon points={poly([sq[1], sq[2], [sq[2][0] - bevel, sq[2][1] - bevel], [sq[1][0] - bevel, sq[1][1] + bevel]])} fill="#000" opacity={0.25} />
          </g>
        );
      })}
      <rect x={r2(-s * 0.12)} y={r2(-s * 0.32)} width={r2(s * 0.24)} height={r2(s * 0.24)} fill="#1d1030" />
    </g>
  );
}

/** Obsidiana lascada: facetas conchoidais vítreas, opcionalmente rachada. */
function Obsidian({ outline, R, cracked }: { outline: Pt[]; R: number; cracked?: boolean }) {
  const n = outline.length;
  const center: Pt = [r2(R * 0.05), r2(R * 0.05)];
  const tones = ["#1d1924", "#0b090e", "#15121a", "#050407", "#221d2b", "#0e0c12", "#18141e"];
  const crack = `M ${r2(-R * 0.15)} ${r2(-R * 0.9)} L ${r2(R * 0.05)} ${r2(-R * 0.35)} L ${r2(-R * 0.18)} ${r2(-R * 0.05)} L ${r2(R * 0.12)} ${r2(R * 0.3)} L ${r2(R * 0.02)} ${r2(R * 0.9)} M ${r2(R * 0.05)} ${r2(-R * 0.35)} L ${r2(R * 0.6)} ${r2(-R * 0.25)} M ${r2(-R * 0.18)} ${r2(-R * 0.05)} L ${r2(-R * 0.75)} ${r2(R * 0.2)}`;
  return (
    <g>
      {outline.map((p, i) => (
        <polygon key={i} points={poly([p, outline[(i + 1) % n], center])} fill={tones[i % tones.length]} stroke="#000" strokeWidth={R * 0.03} />
      ))}
      <path d={`M ${r2(-R * 0.62)} ${r2(-R * 0.3)} Q ${r2(-R * 0.4)} ${r2(-R * 0.7)} ${r2(R * 0.18)} ${r2(-R * 0.66)}`} stroke="#d9d4f0" strokeWidth={R * 0.09} fill="none" strokeLinecap="round" opacity={0.7} />
      <circle cx={r2(R * 0.45)} cy={r2(R * 0.35)} r={r2(R * 0.06)} fill="#8e86ad" opacity={0.6} />
      <polygon points={poly(outline)} fill="none" stroke="#000" strokeWidth={R * 0.06} />
      {cracked && (
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={crack} stroke="#ff5a2a" strokeWidth={R * 0.14} opacity={0.45} />
          <path d={crack} stroke="#ffd2a8" strokeWidth={R * 0.045} />
        </g>
      )}
    </g>
  );
}

/** Desenha a gema preenchendo todo o seu contorno (gemOutline). */
export function Gem({ kind, R }: { kind: GemKind; R: number }) {
  const outline = gemOutline(kind, R);
  switch (kind) {
    case "bismuto":
      return <Bismuth outline={outline} />;
    case "obsidiana":
      return <Obsidian outline={outline} R={R} />;
    case "obsidianaRachada":
      return <Obsidian outline={outline} R={R} cracked />;
    case "quartzoBranco":
    case "quartzoMarrom":
      return <QuartzTop outline={outline} pal={PAL[kind]} />;
    case "esmeralda":
    case "turmalina":
      return <Step outline={outline} pal={PAL[kind]} />;
    case "diamante":
      return <Brilliant outline={outline} pal={PAL.diamante} fire />;
    default:
      return <Brilliant outline={outline} pal={PAL[kind]} />;
  }
}
