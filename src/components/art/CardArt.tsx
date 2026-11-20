/**
 * Arte das cartas: moldura de metal (cor pela raridade), gema no topo (pelo tipo), pergaminho e emblema.
 * Tudo em SVG estático; os gradientes ficam num único <svg> de definições (CardArtDefs) montado no layout.
 */
import type { CSSProperties, ReactNode } from "react";
import { type CardDef, RARITY_LABEL } from "@/game/catalog";
import { KIND_LABEL, shortInfo } from "@/game/display";
import { Emblem, KIND_FILE, sceneOf } from "./emblems";
import { GEM_LABEL, Gem, type GemKind, gemOf, gemOutline, offsetPoly, poly } from "./gems";
import { METAL, METAL_LABEL, METAL_OF, type Metal, rarityOf } from "./metals";

export type CardSize = "sm" | "md" | "lg";

export interface CardInstInfo {
  reforged?: boolean | number;
  runes?: string[];
  charges?: number;
  tamed?: boolean;
  artificeSecond?: boolean;
}

const METALS = Object.keys(METAL) as Metal[];

/** Definições compartilhadas (gradientes de metal e textura martelada). Montar uma vez por página. */
export function CardArtDefs() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {METALS.map((m) => {
          const s = METAL[m].stops;
          return (
            <g key={m}>
              <linearGradient id={`mg-${m}`} x1="0" y1="0" x2="1" y2="1">
                {s.map((c, i) => (
                  <stop key={i} offset={`${(i / (s.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </linearGradient>
              <linearGradient id={`mgv-${m}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s[3]} />
                <stop offset="45%" stopColor={s[2]} />
                <stop offset="100%" stopColor={s[5]} />
              </linearGradient>
              <radialGradient id={`rv-${m}`} cx="35%" cy="32%" r="70%">
                <stop offset="0%" stopColor={METAL[m].shine} />
                <stop offset="45%" stopColor={s[2]} />
                <stop offset="100%" stopColor={METAL[m].edge} />
              </radialGradient>
            </g>
          );
        })}
        {(Object.keys(KIND_FILE) as CardDef["kind"][]).map((k) => (
          <linearGradient key={k} id={`sky-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sceneOf(k)[0]} />
            <stop offset="75%" stopColor={sceneOf(k)[1]} />
          </linearGradient>
        ))}
        <radialGradient id="art-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#fffbe8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fffbe8" stopOpacity="0" />
        </radialGradient>
        <clipPath id="art-arch" clipPathUnits="userSpaceOnUse">
          <path d={ARCH} />
        </clipPath>
        <pattern id="metal-grain" width="26" height="26" patternUnits="userSpaceOnUse">
          <ellipse cx="5" cy="6" rx="3.2" ry="2.4" fill="#000" opacity="0.22" />
          <ellipse cx="18" cy="4" rx="2" ry="1.4" fill="#fff" opacity="0.18" />
          <ellipse cx="14" cy="16" rx="3.6" ry="2.6" fill="#000" opacity="0.16" />
          <ellipse cx="23" cy="21" rx="1.6" ry="1.2" fill="#fff" opacity="0.2" />
          <ellipse cx="6" cy="21" rx="2.4" ry="1.6" fill="#000" opacity="0.2" />
          <path d="M1 12 L9 10 M16 24 L24 13" stroke="#fff" strokeWidth="0.5" opacity="0.25" />
          <path d="M10 1 L13 8" stroke="#000" strokeWidth="0.6" opacity="0.3" />
        </pattern>
      </defs>
    </svg>
  );
}

const ARCH = "M4 100 V38 C4 14 32 4 70 4 C108 4 136 14 136 38 V100 Z";

/** Janela em arco com cenário (céu, brilho, colinas) e a ilustração da carta. */
function ArtWindow({ d, compact = false }: { d: CardDef; compact?: boolean }) {
  const [, , ground] = sceneOf(d.kind);
  return (
    <div className={`absolute ${compact ? "inset-x-[10%] top-[43%] h-[38%]" : "inset-x-[12%] top-[34%] h-[37%]"}`}>
      <svg viewBox="0 0 140 100" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
        <path d={ARCH} fill={`url(#sky-${d.kind})`} />
        <g clipPath="url(#art-arch)">
          <circle cx="70" cy="48" r="46" fill="url(#art-glow)" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M70 48 L64 -40 L76 -40 Z" transform={`rotate(${i * 30} 70 48)`} fill="#fffbe8" opacity="0.13" />
          ))}
          <path d="M0 84 C20 72 36 76 52 82 C70 70 92 72 108 80 C120 74 132 74 140 78 V100 H0 Z" fill={ground} opacity="0.55" />
          <path d="M0 92 C30 86 60 90 90 88 C110 86 126 88 140 90 V100 H0 Z" fill={ground} />
          <ellipse cx="70" cy="93" rx="30" ry="4" fill="#24160b" opacity="0.3" />
          <g transform="translate(23 3) scale(0.94)">
            <Emblem d={d} />
          </g>
        </g>
        <path d={ARCH} fill="none" stroke="#24160b" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
        <path d="M8 100 V39 C8 18 34 8 70 8 C106 8 132 18 132 39 V100" fill="none" stroke="#c9a14a" strokeWidth="1" opacity="0.7" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

const OUTER = "M18 2 H232 Q248 2 248 18 V332 Q248 348 232 348 H18 Q2 348 2 332 V18 Q2 2 18 2 Z";
const INNER = "M23 14 H227 Q236 14 236 23 V327 Q236 336 227 336 H23 Q14 336 14 327 V23 Q14 14 23 14 Z";

/** Moldura de metal com rebites, cantoneiras e engaste da gema. */
export function MetalFrame({ metal, gem, children }: { metal: Metal; gem?: ReturnType<typeof gemOf> | null; children?: ReactNode }) {
  const M = METAL[metal];
  const rivets: [number, number][] = [
    [8, 8],
    [242, 8],
    [8, 342],
    [242, 342],
    [8, 175],
    [242, 175],
    [70, 8],
    [180, 8],
    [125, 342],
  ];
  return (
    <svg viewBox="0 0 250 350" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <path d={OUTER + INNER} fillRule="evenodd" fill={`url(#mg-${metal})`} />
      <path d={OUTER + INNER} fillRule="evenodd" fill="url(#metal-grain)" />
      <path d={OUTER} fill="none" stroke={M.edge} strokeWidth="2.5" />
      <rect x="5" y="5" width="240" height="340" rx="14" fill="none" stroke={M.shine} strokeWidth="1" opacity="0.35" />
      <path d={INNER} fill="none" stroke={M.edge} strokeWidth="2.4" />
      <rect x="16.5" y="16.5" width="217" height="317" rx="7" fill="none" stroke={M.deep} strokeWidth="2" opacity="0.55" />
      {metal === "negro" && <rect x="11" y="11" width="228" height="328" rx="10" fill="none" stroke="#8a1c12" strokeWidth="1.2" opacity="0.7" />}
      {/* cantoneiras internas */}
      {[
        "M19 52 V19 H52",
        "M231 52 V19 H198",
        "M19 298 V331 H52",
        "M231 298 V331 H198",
      ].map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke={M.edge} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke={`url(#mgv-${metal})`} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {rivets.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="4.4" fill={`url(#rv-${metal})`} stroke={M.edge} strokeWidth="0.9" />
          <circle cx={x - 1.3} cy={y - 1.4} r="1.1" fill={M.shine} opacity="0.85" />
        </g>
      ))}
      {gem && <GemSetting gem={gem} metal={metal} />}
      {children}
    </svg>
  );
}

const GEM_R = 20;

/** Engaste de metal no formato da própria gema, com garras nos vértices e abas laterais. */
function GemSetting({ gem, metal }: { gem: GemKind; metal: Metal }) {
  const M = METAL[metal];
  const outline = gemOutline(gem, GEM_R);
  const bezel = offsetPoly(outline, 5.5);
  const seat = offsetPoly(outline, 1.2);
  const top = Math.min(...bezel.map((p) => p[1]));
  const cy = 30 + Math.max(0, 4 - (30 + top)); // não deixa o engaste sair da carta
  const wingY = Math.min(12, Math.max(...bezel.map((p) => p[1])) - 2);
  const wingX = Math.max(...bezel.map((p) => p[0])) - 2;
  return (
    <g transform={`translate(125 ${cy})`}>
      <path
        d={`M${-wingX - 28} -8 L${-wingX} -18 L${-wingX} ${wingY} Z M${wingX + 28} -8 L${wingX} -18 L${wingX} ${wingY} Z`}
        fill={`url(#mgv-${metal})`}
        stroke={M.edge}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon points={poly(bezel)} fill={`url(#mg-${metal})`} stroke={M.edge} strokeWidth="2" strokeLinejoin="round" />
      <polygon points={poly(bezel)} fill="url(#metal-grain)" />
      <polygon points={poly(offsetPoly(outline, 3.6))} fill="none" stroke={M.shine} strokeWidth="0.8" opacity="0.5" strokeDasharray="1.5 2.5" />
      <polygon points={poly(seat)} fill="#120b07" stroke={M.deep} strokeWidth="1.2" strokeLinejoin="round" />
      <Gem kind={gem} R={GEM_R} />
      {bezel.length <= 8 &&
        bezel.map((b, i) => {
          const o = outline[i];
          return <circle key={i} cx={((b[0] + o[0]) / 2).toFixed(2)} cy={((b[1] + o[1]) / 2).toFixed(2)} r="1.9" fill={`url(#rv-${metal})`} stroke={M.edge} strokeWidth="0.6" />;
        })}
    </g>
  );
}

const TINT: Partial<Record<CardDef["kind"], string>> = {
  monster: "rgba(120, 18, 10, 0.16)",
  wandering: "rgba(110, 20, 50, 0.18)",
  curse: "rgba(20, 80, 40, 0.18)",
  levelup: "rgba(230, 190, 60, 0.18)",
  potion: "rgba(40, 120, 130, 0.14)",
  rune: "rgba(150, 20, 30, 0.12)",
  race: "rgba(110, 70, 30, 0.14)",
  monsterBonus: "rgba(200, 60, 120, 0.12)",
  misc: "rgba(200, 150, 30, 0.12)",
};

const fs = (cqw: number, minPx: number): CSSProperties => ({ fontSize: `max(${minPx}px, ${cqw}cqw)` });

function Seal({ children, tone }: { children: ReactNode; tone: "wax" | "gold" | "green" }) {
  const fill = tone === "wax" ? "#8e1414" : tone === "green" ? "#1e6b34" : "#c99a2e";
  const ring = tone === "wax" ? "#5c0909" : tone === "green" ? "#0f3d1d" : "#6e4c0c";
  const text = tone === "gold" ? "#2b1a05" : "#fbe9d0";
  return (
    <div className="absolute bottom-[0.5%] left-1/2 aspect-square w-[24%] -translate-x-1/2">
      <svg viewBox="-20 -20 40 40" className="absolute inset-0 h-full w-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" aria-hidden>
        {tone === "wax" ? (
          <path
            d={Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const r = i % 2 ? 17 : 19;
              return `${i ? "L" : "M"}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
            }).join(" ") + " Z"}
            fill={fill}
            stroke={ring}
            strokeWidth="1.2"
          />
        ) : (
          <circle r="18.5" fill={fill} stroke={ring} strokeWidth="1.5" />
        )}
        <circle r="13.5" fill="none" stroke={ring} strokeWidth="1" opacity="0.7" />
        <ellipse cx="-6" cy="-9" rx="6" ry="2.5" fill="#fff" opacity="0.25" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display font-bold" style={{ ...fs(9, 9), color: text }}>
        {children}
      </span>
    </div>
  );
}

/** Frente da carta (sem interatividade). O contêiner define a largura; a altura vem da proporção 5:7. */
export function CardFront({ d, inst, size = "md" }: { d: CardDef; inst?: CardInstInfo; size?: CardSize }) {
  const metal = METAL_OF[rarityOf(d)];
  const gem = gemOf(d.kind);
  const compact = size === "sm";
  const bonus =
    d.kind === "item" ? (inst?.tamed ? 0 : d.bonus) + (Number(inst?.reforged) || 0) : d.kind === "monster" && inst?.tamed ? d.treasures : null;
  const info = inst?.tamed
    ? "Montaria domada"
    : d.kind === "race" || d.kind === "class"
      ? [d.passive.name, ...d.actives.map((x) => x.name)].filter(Boolean).join(" · ")
      : shortInfo(d);
  return (
    <div className="absolute inset-0 [container-type:inline-size]">
      <div className="parchment absolute inset-x-[5.2%] inset-y-[3.7%] overflow-hidden rounded-[4%/3%]">
        {TINT[d.kind] && <div className="absolute inset-0" style={{ background: TINT[d.kind] }} />}
        <ArtWindow d={d} compact={compact} />
      </div>
      <MetalFrame metal={metal} gem={gem} />
      <div
        className="absolute inset-x-[9%] top-[17.5%] text-center font-semibold uppercase tracking-wider text-[#6b4a2a]"
        style={fs(compact ? 6.4 : 5.4, 6)}
      >
        {inst?.tamed ? "Montaria" : KIND_LABEL[d.kind]}
      </div>
      <div
        className={`absolute inset-x-[9%] text-center font-display font-bold leading-[1.08] text-[#2b1a0d] ${compact ? "top-[24%] line-clamp-2" : "top-[22.5%] line-clamp-3"}`}
        style={fs(compact ? 11 : 9.6, 9)}
      >
        {d.name}
      </div>
      {!compact && (
        <div className="absolute inset-x-[10%] top-[73%] line-clamp-2 text-center leading-tight text-[#4a3420]" style={fs(5.8, 7)}>
          {info}
        </div>
      )}
      {d.kind === "monster" && !inst?.tamed && <Seal tone="wax">{d.level}</Seal>}
      {bonus !== null && bonus !== 0 && <Seal tone="gold">+{bonus}</Seal>}
      {d.kind === "monsterBonus" && <Seal tone={d.value > 0 ? "wax" : "green"}>{`${d.value > 0 ? "+" : ""}${d.value}`}</Seal>}
    </div>
  );
}

/** Verso com o texto completo da carta. */
export function CardBackText({ d, lines, extra }: { d: CardDef; lines: string[]; extra?: ReactNode }) {
  const metal = METAL_OF[rarityOf(d)];
  const gem = gemOf(d.kind);
  return (
    <div className="absolute inset-0 [container-type:inline-size]">
      <div className="parchment absolute inset-x-[5.2%] inset-y-[3.7%] overflow-hidden rounded-[4%/3%]">
        {TINT[d.kind] && <div className="absolute inset-0" style={{ background: TINT[d.kind] }} />}
      </div>
      <MetalFrame metal={metal} gem={gem} />
      <div className="absolute inset-x-[9%] bottom-[6%] top-[18%] flex flex-col text-[#2b1a0d]">
        <p className="text-center font-display font-bold leading-tight" style={fs(7.2, 12)}>
          {d.name}
        </p>
        <p className="mt-[2%] text-center uppercase tracking-wide text-[#6b4a2a]" style={fs(4.2, 9)}>
          {KIND_LABEL[d.kind]} · {"rarity" in d ? RARITY_LABEL[d.rarity] : d.kind === "monster" && d.legendary ? "Lendário" : "Comum"}
        </p>
        <div className="scroll-thin mt-[3%] min-h-0 flex-1 space-y-[3%] overflow-y-auto border-t border-[#6b4a2a]/40 pt-[3%] leading-snug" style={fs(4.6, 11)}>
          {lines.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          {extra}
        </div>
        <p className="mt-[2%] text-center italic text-[#6b4a2a]" style={fs(3.6, 9)}>
          Moldura de {METAL_LABEL[metal].toLowerCase()} · {GEM_LABEL[gem]}
        </p>
      </div>
    </div>
  );
}

/** Costas de carta oculta (ou do baralho). */
export function CardBackside({ deck }: { deck?: "door" | "treasure" }) {
  const metal: Metal = deck === "treasure" ? "ouro" : "bronze";
  const leather = deck === "treasure" ? "#3a2410" : deck === "door" ? "#3a1512" : "#2a1d14";
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 250 350" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect x="10" y="10" width="230" height="330" rx="10" fill={leather} />
        <rect x="10" y="10" width="230" height="330" rx="10" fill="url(#metal-grain)" opacity="0.6" />
        <g transform="translate(125 175)" stroke={`url(#mgv-${metal})`} fill="none">
          <circle r="78" strokeWidth="3" />
          <circle r="70" strokeWidth="1" strokeDasharray="3 5" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M0 -64 L10 -18 L0 -10 L-10 -18 Z" transform={`rotate(${i * 45})`} strokeWidth="2.2" fill={`url(#mg-${metal})`} opacity={i % 2 ? 0.55 : 1} />
          ))}
          <circle r="22" strokeWidth="3" fill="#120b07" />
          {deck === "door" && <path d="M-9 14 V-6 Q-9 -15 0 -15 Q9 -15 9 -6 V14 Z M4 2 h0.1" strokeWidth="3" />}
          {deck === "treasure" && <path d="M-12 12 V-2 H12 V12 Z M-12 -2 Q-12 -12 0 -12 Q12 -12 12 -2 M-2 2 H2" strokeWidth="3" />}
          {!deck && <path d="M0 -12 L10 0 L0 12 L-10 0 Z" strokeWidth="3" />}
        </g>
        {[60, 290].map((y) => (
          <path key={y} d={`M40 ${y} H210`} stroke={`url(#mgv-${metal})`} strokeWidth="2" strokeDasharray="10 4 2 4" />
        ))}
      </svg>
      <MetalFrame metal={metal} />
    </div>
  );
}
