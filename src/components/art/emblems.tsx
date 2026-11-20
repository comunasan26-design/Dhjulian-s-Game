/**
 * Ilustrações das cartas em SVG (estilo xilogravura colorida), numa caixa 100x100.
 * A ilustração depende do tipo e dos detalhes da carta: monstros pela tag (dragão, morto-vivo…),
 * maldições pelo tipo, itens pelo espaço/arma, raças e classes pelo nome. Cartas novas caem num desenho padrão.
 */
import type { ReactNode } from "react";
import type { CardDef } from "@/game/catalog";

const INK = "#24160b";
const C = {
  steel: "#c3cbd4",
  steelD: "#7f8996",
  gold: "#e0ad45",
  goldD: "#9a6a17",
  wood: "#8a5a2c",
  woodD: "#5a3615",
  leather: "#9b6a3c",
  flesh: "#e2b48a",
  fleshD: "#b98257",
  bone: "#efe6d2",
  boneD: "#c8bb9c",
  red: "#b3322a",
  redD: "#6e1a14",
  green: "#4f8a3c",
  greenD: "#2c5422",
  purple: "#7a4a9e",
  purpleD: "#43245c",
  blue: "#3f6fb8",
  blueD: "#22406e",
  black: "#2a2230",
  fire: "#f08a2a",
  fireL: "#ffd36b",
  white: "#fbf6ea",
};
const st = (w = 2.6) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: "round" as const, strokeLinecap: "round" as const });

// ----------------------------------------------------------------------------- armas e itens
function Sword({ x = 50, y = 50, r = 0, s = 1 }: { x?: number; y?: number; r?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 -44 L7 -34 L7 14 L-7 14 L-7 -34 Z" fill={C.steel} {...st()} />
      <path d="M0 -38 L0 10" stroke={C.white} strokeWidth="2" />
      <path d="M2.5 -32 L2.5 12" stroke={C.steelD} strokeWidth="2" />
      <path d="M-20 14 H20 L17 21 H-17 Z" fill={C.gold} {...st()} />
      <rect x="-4.5" y="21" width="9" height="16" rx="2" fill={C.leather} {...st()} />
      <circle cx="0" cy="41" r="5" fill={C.gold} {...st()} />
    </g>
  );
}
function Axe({ x = 50, y = 50, r = 0, s = 1, double = false }: { x?: number; y?: number; r?: number; s?: number; double?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <rect x="-3.5" y="-40" width="7" height="84" rx="3" fill={C.wood} {...st()} />
      <path d="M3 -36 C22 -40 30 -26 30 -14 C30 -4 22 6 3 2 Z" fill={C.steel} {...st()} />
      <path d="M8 -30 C20 -30 25 -22 25 -14" stroke={C.white} strokeWidth="2" fill="none" />
      {double && <path d="M-3 -36 C-22 -40 -30 -26 -30 -14 C-30 -4 -22 6 -3 2 Z" fill={C.steel} {...st()} />}
    </g>
  );
}
function Hammer({ x = 50, y = 50, r = 0, s = 1 }: { x?: number; y?: number; r?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <rect x="-3.5" y="-26" width="7" height="70" rx="3" fill={C.wood} {...st()} />
      <rect x="-22" y="-42" width="44" height="22" rx="3" fill={C.steelD} {...st()} />
      <rect x="-18" y="-39" width="36" height="6" fill={C.steel} />
      <path d="M-22 -31 H22" {...st(1.6)} />
    </g>
  );
}
function Shield({ x = 50, y = 52, s = 1, emblem }: { x?: number; y?: number; s?: number; emblem?: "cross" | "boss" }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -38 C14 -32 26 -34 32 -36 C34 -6 26 22 0 40 C-26 22 -34 -6 -32 -36 C-26 -34 -14 -32 0 -38 Z" fill={C.blue} {...st()} />
      <path d="M0 -30 C10 -26 20 -27 25 -28 C26 -6 20 16 0 31 C-20 16 -26 -6 -25 -28 C-20 -27 -10 -26 0 -30 Z" fill="none" stroke={C.gold} strokeWidth="3" />
      {emblem === "cross" && <path d="M0 -20 V20 M-14 -4 H14" stroke={C.gold} strokeWidth="7" strokeLinecap="round" />}
      {emblem === "boss" && <circle r="8" fill={C.gold} {...st()} />}
    </g>
  );
}
function Bow({ x = 50, y = 50, s = 1 }: { x?: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-10 -40 C24 -26 24 26 -10 40" fill="none" stroke={C.wood} strokeWidth="7" strokeLinecap="round" />
      <path d="M-10 -40 C24 -26 24 26 -10 40" fill="none" {...st(1.4)} />
      <path d="M-10 -40 L-10 40" stroke={INK} strokeWidth="1.4" />
      <path d="M-30 0 H26" {...st(2.4)} />
      <path d="M26 0 L18 -5 M26 0 L18 5" {...st(2.4)} />
      <path d="M-30 0 L-36 -6 M-30 0 L-36 6 M-26 0 L-32 -6 M-26 0 L-32 6" stroke={C.red} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}
function Staff({ x = 50, y = 50, r = 0, top = "orb" }: { x?: number; y?: number; r?: number; top?: "orb" | "star" | "leaf" | "cross" }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0 -30 L0 44" stroke={C.wood} strokeWidth="6" strokeLinecap="round" />
      <path d="M0 -30 L0 44" stroke={INK} strokeWidth="1.2" opacity="0.6" />
      {top === "orb" && (
        <>
          <path d="M-8 -30 C-8 -40 8 -40 8 -30" fill="none" {...st(2.2)} />
          <circle cy="-40" r="9" fill={C.purple} {...st()} />
          <circle cx="-3" cy="-43" r="3" fill={C.white} opacity="0.8" />
        </>
      )}
      {top === "star" && <path d="M0 -50 L4 -40 L14 -40 L6 -34 L9 -24 L0 -30 L-9 -24 L-6 -34 L-14 -40 L-4 -40 Z" fill={C.fireL} {...st(2)} />}
      {top === "leaf" && (
        <>
          <path d="M0 -30 C-16 -36 -16 -50 -4 -54 C-2 -44 4 -40 0 -30 Z" fill={C.green} {...st(2)} />
          <path d="M0 -32 C14 -38 18 -48 10 -54 C6 -46 0 -42 0 -32 Z" fill={C.green} {...st(2)} />
        </>
      )}
      {top === "cross" && <path d="M0 -54 V-28 M-9 -45 H9" stroke={C.gold} strokeWidth="6" strokeLinecap="round" />}
    </g>
  );
}
function Dagger({ x = 50, y = 50, r = 0, s = 1 }: { x?: number; y?: number; r?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 -30 L6 -20 L5 6 L-5 6 L-6 -20 Z" fill={C.steel} {...st()} />
      <path d="M-12 6 H12 L10 11 H-10 Z" fill={C.goldD} {...st(2)} />
      <rect x="-3.5" y="11" width="7" height="12" rx="2" fill={C.black} {...st(2)} />
    </g>
  );
}
function Spear({ x = 50, y = 50, r = 0 }: { x?: number; y?: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0 -24 L0 46" stroke={C.wood} strokeWidth="5" strokeLinecap="round" />
      <path d="M0 -48 L9 -26 L0 -20 L-9 -26 Z" fill={C.steel} {...st()} />
      <path d="M-6 -18 L6 -18" stroke={C.red} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}
function Helmet() {
  return (
    <g>
      <path d="M50 8 C60 8 66 14 64 22 C58 18 54 16 50 16" fill={C.red} {...st(2)} />
      <path d="M18 70 C18 36 32 20 50 20 C68 20 82 36 82 70 L82 84 L62 84 L62 60 L38 60 L38 84 L18 84 Z" fill={C.steel} {...st()} />
      <path d="M50 20 V60" {...st(2)} />
      <path d="M26 48 H74" stroke={C.steelD} strokeWidth="4" />
      <path d="M26 38 C30 30 38 26 46 25" stroke={C.white} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="72" r="2.5" fill={INK} />
      <circle cx="70" cy="72" r="2.5" fill={INK} />
    </g>
  );
}
function Breastplate() {
  return (
    <g>
      <path d="M30 16 L42 22 L50 30 L58 22 L70 16 L88 30 L80 50 L76 46 L76 88 L24 88 L24 46 L20 50 L12 30 Z" fill={C.steel} {...st()} />
      <path d="M50 30 V88" {...st(2)} />
      <path d="M30 56 C40 62 60 62 70 56 M30 72 C40 78 60 78 70 72" stroke={C.steelD} strokeWidth="3" fill="none" />
      <path d="M32 34 C36 30 42 32 44 38" stroke={C.white} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="44" r="5" fill={C.gold} {...st(2)} />
    </g>
  );
}
function Greaves() {
  return (
    <g>
      <path d="M26 12 L74 12 L78 88 L56 88 L50 42 L44 88 L22 88 Z" fill={C.leather} {...st()} />
      <path d="M26 24 H74" stroke={C.woodD} strokeWidth="4" />
      <path d="M28 52 L46 52 L44 70 L26 70 Z M72 52 L54 52 L56 70 L74 70 Z" fill={C.steel} {...st(2)} />
      <circle cx="50" cy="18" r="3.5" fill={C.gold} {...st(1.6)} />
    </g>
  );
}
function Boot() {
  return (
    <g>
      <path d="M30 10 L58 10 L58 56 L84 68 L86 88 L20 88 L20 74 L30 64 Z" fill={C.leather} {...st()} />
      <path d="M30 22 H58" stroke={C.woodD} strokeWidth="4" />
      <path d="M20 80 H86" stroke={C.woodD} strokeWidth="5" />
      <path d="M36 32 L52 36 M36 42 L52 46" stroke={C.gold} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M58 60 L66 52 L70 60" fill={C.white} {...st(1.6)} />
    </g>
  );
}
function Ring() {
  return (
    <g>
      <ellipse cx="50" cy="62" rx="28" ry="24" fill="none" stroke={C.goldD} strokeWidth="11" />
      <ellipse cx="50" cy="62" rx="28" ry="24" fill="none" stroke={C.gold} strokeWidth="7" />
      <path d="M30 52 C34 46 40 42 46 41" stroke={C.white} strokeWidth="2" fill="none" opacity="0.8" />
      <path d="M36 34 L50 16 L64 34 L50 46 Z" fill={C.red} {...st()} />
      <path d="M50 16 L50 46 M36 34 H64" stroke={C.white} strokeWidth="1.4" opacity="0.6" />
    </g>
  );
}
function Amulet() {
  return (
    <g>
      <path d="M20 10 C20 38 34 50 50 54" fill="none" stroke={C.goldD} strokeWidth="3" strokeDasharray="4 3" />
      <path d="M80 10 C80 38 66 50 50 54" fill="none" stroke={C.goldD} strokeWidth="3" strokeDasharray="4 3" />
      <path d="M50 50 L70 70 L50 94 L30 70 Z" fill={C.gold} {...st()} />
      <circle cx="50" cy="71" r="9" fill={C.green} {...st(2)} />
      <circle cx="47" cy="68" r="3" fill={C.white} opacity="0.7" />
    </g>
  );
}
function Horse() {
  return (
    <g>
      <path d="M28 92 L32 62 C24 56 20 44 26 30 L22 12 L34 22 C44 14 60 16 70 28 C80 40 84 52 80 60 C76 66 68 64 64 58 L56 52 L58 92 Z" fill={C.leather} {...st()} />
      <path d="M34 22 C30 34 34 44 40 52" stroke={C.woodD} strokeWidth="5" fill="none" />
      <circle cx="58" cy="34" r="3.2" fill={INK} />
      <path d="M74 54 L78 52" {...st(2)} />
      <path d="M60 40 L82 52" stroke={C.red} strokeWidth="2.4" />
    </g>
  );
}

// ----------------------------------------------------------------------------- outras cartas
function Potion() {
  return (
    <g>
      <rect x="42" y="6" width="16" height="10" rx="2" fill={C.wood} {...st(2)} />
      <path d="M44 16 L44 34 C26 42 18 56 22 70 C26 84 38 92 50 92 C62 92 74 84 78 70 C82 56 74 42 56 34 L56 16 Z" fill="#cfe7ef" fillOpacity="0.55" {...st()} />
      <path d="M23 62 C36 56 52 68 77 60 C79 76 66 90 50 90 C34 90 22 78 23 62 Z" fill={C.red} />
      <path d="M23 62 C36 56 52 68 77 60" stroke={INK} strokeWidth="1.6" fill="none" />
      <circle cx="38" cy="74" r="4" fill={C.white} opacity="0.6" />
      <circle cx="56" cy="80" r="2.5" fill={C.white} opacity="0.6" />
      <circle cx="48" cy="52" r="2" fill={C.white} opacity="0.6" />
      <path d="M30 50 C28 58 28 64 30 70" stroke={C.white} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}
function RuneStone() {
  return (
    <g>
      <path d="M26 92 L20 42 C20 20 34 8 50 8 C66 8 80 20 80 42 L74 92 Z" fill="#8d8a86" {...st()} />
      <path d="M28 40 C30 24 38 16 48 14" stroke="#c9c5bf" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M44 28 L44 78 M44 28 L60 40 L44 50 L62 78" stroke={C.red} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
      <path d="M44 28 L44 78 M44 28 L60 40 L44 50 L62 78" stroke="#ff6a4a" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 92 H86" {...st(3)} />
      <path d="M20 92 C24 86 30 86 34 92 M66 92 C70 86 76 86 80 92" fill={C.green} {...st(2)} />
    </g>
  );
}
function Pouch() {
  return (
    <g>
      <path d="M36 18 L64 18 L58 32 C80 40 88 62 80 78 C76 88 64 92 50 92 C36 92 24 88 20 78 C12 62 20 40 42 32 Z" fill={C.leather} {...st()} />
      <path d="M38 32 H62" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
      <path d="M30 50 C28 58 28 66 32 72" stroke={C.white} strokeWidth="3" fill="none" opacity="0.5" strokeLinecap="round" />
      {[
        [62, 90],
        [72, 86],
        [80, 92],
      ].map(([x, y]) => (
        <ellipse key={x} cx={x} cy={y} rx="7" ry="4" fill={C.gold} {...st(1.8)} />
      ))}
      <text x="50" y="68" textAnchor="middle" fontSize="20" fontWeight="bold" fill={C.goldD} fontFamily="Georgia, serif">
        $
      </text>
    </g>
  );
}
function LevelUp() {
  return (
    <g>
      <circle cx="50" cy="56" r="32" fill={C.gold} {...st()} />
      <circle cx="50" cy="56" r="25" fill="none" stroke={C.goldD} strokeWidth="2.4" />
      <path d="M34 66 L50 46 L66 66 M34 80 L50 60 L66 80" fill="none" stroke={C.redD} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 4 L55 16 L68 16 L58 24 L62 36 L50 29 L38 36 L42 24 L32 16 L45 16 Z" fill={C.fireL} {...st(2)} />
      <path d="M22 30 L26 34 M78 30 L74 34" {...st(2.4)} />
    </g>
  );
}
function Claws() {
  return (
    <g>
      <path d="M14 84 C30 70 46 48 52 12 C56 40 50 70 30 92 Z" fill={C.boneD} {...st()} />
      <path d="M36 92 C54 76 66 52 70 18 C74 46 70 74 54 94 Z" fill={C.bone} {...st()} />
      <path d="M58 94 C72 80 82 60 86 34 C90 58 86 80 76 94 Z" fill={C.boneD} {...st()} />
      <path d="M20 40 L30 50 M64 66 L74 72" stroke={C.red} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}
function Wanderer() {
  return (
    <g>
      <path d="M50 10 C34 10 26 26 26 40 L18 92 H82 L74 40 C74 26 66 10 50 10 Z" fill={C.purpleD} {...st()} />
      <path d="M50 18 C40 18 34 28 34 38 C34 46 40 52 50 52 C60 52 66 46 66 38 C66 28 60 18 50 18 Z" fill={C.black} {...st(2)} />
      <circle cx="43" cy="38" r="3" fill={C.fireL} />
      <circle cx="57" cy="38" r="3" fill={C.fireL} />
      <path d="M78 56 L78 70" {...st(2)} />
      <path d="M72 70 H84 L82 84 H74 Z" fill={C.goldD} {...st(2)} />
      <circle cx="78" cy="77" r="3.5" fill={C.fireL} />
      <path d="M26 92 L22 98 M74 92 L78 98" {...st(2)} />
    </g>
  );
}

// ----------------------------------------------------------------------------- monstros
function Skull({ cross = false }: { cross?: boolean }) {
  return (
    <g>
      {cross && <path d="M16 70 L84 94 M84 70 L16 94" stroke={C.bone} strokeWidth="9" strokeLinecap="round" />}
      {cross && <path d="M16 70 L84 94 M84 70 L16 94" {...st(1.6)} />}
      <path d="M50 10 C28 10 18 26 18 44 C18 56 24 62 30 66 L30 82 L70 82 L70 66 C76 62 82 56 82 44 C82 26 72 10 50 10 Z" fill={C.bone} {...st()} />
      <ellipse cx="37" cy="46" rx="9" ry="10" fill={INK} />
      <ellipse cx="63" cy="46" rx="9" ry="10" fill={INK} />
      <circle cx="37" cy="47" r="2.5" fill="#7cf0a0" />
      <circle cx="63" cy="47" r="2.5" fill="#7cf0a0" />
      <path d="M50 56 L44 68 L56 68 Z" fill={INK} />
      <path d="M38 74 V82 M46 74 V82 M54 74 V82 M62 74 V82" {...st(2)} />
      <path d="M26 30 C30 20 38 16 46 15" stroke={C.white} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}
function Dragon() {
  return (
    <g>
      <path d="M30 30 L16 6 L40 22 M58 22 L76 2 L70 30" fill={C.boneD} {...st()} />
      <path d="M22 50 C20 30 36 18 54 20 C74 22 86 36 88 52 L94 62 C86 70 72 70 62 66 L58 80 C46 88 30 84 24 72 Z" fill={C.red} {...st()} />
      <path d="M62 66 C70 62 80 60 94 62" {...st(2)} />
      <path d="M66 66 L68 72 L72 66 M76 64 L78 70 L82 64" fill={C.white} {...st(1.4)} />
      <path d="M44 34 C50 30 58 30 62 36 C56 38 50 40 44 34 Z" fill={C.fireL} {...st(2)} />
      <ellipse cx="54" cy="35" rx="1.6" ry="4" fill={INK} />
      <path d="M28 56 C32 64 40 68 48 68 M30 46 L40 50 M32 62 L42 62" stroke={C.redD} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="84" cy="56" r="2" fill={INK} />
      <path d="M90 64 C96 70 92 78 98 82" stroke={C.fire} strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  );
}
function Demon() {
  return (
    <g>
      <path d="M26 34 C12 28 8 12 14 2 C20 16 30 18 36 22 M74 34 C88 28 92 12 86 2 C80 16 70 18 64 22" fill={C.black} {...st()} />
      <path d="M50 18 C30 18 22 34 24 52 C26 70 38 86 50 90 C62 86 74 70 76 52 C78 34 70 18 50 18 Z" fill={C.red} {...st()} />
      <path d="M32 44 L46 50 L32 54 Z M68 44 L54 50 L68 54 Z" fill={C.fireL} {...st(1.8)} />
      <path d="M36 70 C42 76 58 76 64 70 L60 66 L56 72 L52 66 L48 72 L44 66 L40 72 Z" fill={C.white} {...st(1.8)} />
      <path d="M50 54 L46 62 H54 Z" fill={C.redD} />
      <path d="M30 34 C36 28 44 26 50 26" stroke="#ff8a7a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}
function Wolf() {
  return (
    <g>
      <path d="M24 34 L20 8 L40 24 M60 24 L80 8 L76 34" fill={C.steelD} {...st()} />
      <path d="M20 40 C20 24 36 20 50 20 C64 20 80 24 80 40 C80 52 74 58 66 62 L60 86 C54 92 46 92 40 86 L34 62 C26 58 20 52 20 40 Z" fill="#8c8a8f" {...st()} />
      <path d="M36 62 C40 72 44 80 50 82 C56 80 60 72 64 62" fill={C.boneD} {...st(2)} />
      <ellipse cx="36" cy="42" rx="5" ry="4" fill={C.fireL} {...st(1.6)} />
      <ellipse cx="64" cy="42" rx="5" ry="4" fill={C.fireL} {...st(1.6)} />
      <path d="M44 66 C46 62 54 62 56 66 C54 70 46 70 44 66 Z" fill={INK} />
      <path d="M44 78 L46 84 L48 78 M52 78 L54 84 L56 78" fill={C.white} {...st(1.2)} />
    </g>
  );
}
function Bat() {
  return (
    <g>
      <path d="M50 40 C40 30 26 26 6 34 C14 40 16 48 12 56 C20 52 28 54 32 60 C36 54 42 52 50 56 C58 52 64 54 68 60 C72 54 80 52 88 56 C84 48 86 40 94 34 C74 26 60 30 50 40 Z" fill={C.black} {...st()} />
      <ellipse cx="50" cy="52" rx="11" ry="14" fill="#4a3a52" {...st()} />
      <path d="M42 40 L40 30 L46 38 M58 40 L60 30 L54 38" fill="#4a3a52" {...st(1.8)} />
      <circle cx="46" cy="48" r="2.4" fill={C.red} />
      <circle cx="54" cy="48" r="2.4" fill={C.red} />
      <path d="M47 58 L48 62 L49 58 M51 58 L52 62 L53 58" stroke={C.white} strokeWidth="1.4" />
    </g>
  );
}
function Tentacles() {
  return (
    <g>
      <path d="M8 86 C20 80 26 84 30 92" fill="none" stroke="#3f8ab8" strokeWidth="4" strokeLinecap="round" />
      {[
        "M24 92 C14 70 26 52 20 32 C16 20 26 14 32 22",
        "M50 92 C44 66 60 48 52 22 C50 12 60 8 64 16",
        "M76 92 C88 70 74 54 82 34 C86 24 78 18 72 24",
      ].map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke={INK} strokeWidth="13" strokeLinecap="round" />
          <path d={d} fill="none" stroke={C.purple} strokeWidth="9" strokeLinecap="round" />
        </g>
      ))}
      {[
        [26, 70],
        [22, 50],
        [54, 70],
        [56, 46],
        [78, 66],
        [80, 46],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill="#f0c6ff" />
      ))}
      <path d="M4 92 C20 86 30 96 50 90 C70 86 80 96 96 90" fill="none" stroke="#3f8ab8" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}
function FireSpirit() {
  return (
    <g>
      <path d="M50 4 C64 22 80 34 76 58 C74 76 62 90 50 90 C36 90 22 78 22 60 C22 42 34 36 34 20 C42 28 44 36 42 46 C50 38 52 24 50 4 Z" fill={C.fire} {...st()} />
      <path d="M50 34 C58 46 64 54 62 66 C60 78 54 84 50 84 C44 84 36 78 36 68 C36 58 44 54 46 46 C50 52 52 44 50 34 Z" fill={C.fireL} />
      <ellipse cx="43" cy="62" rx="3.5" ry="5" fill={INK} />
      <ellipse cx="57" cy="62" rx="3.5" ry="5" fill={INK} />
      <path d="M44 74 C48 77 52 77 56 74" {...st(2)} fill="none" />
    </g>
  );
}
function Angel() {
  return (
    <g>
      <ellipse cx="50" cy="12" rx="16" ry="5" fill="none" stroke={C.fireL} strokeWidth="4" />
      <path d="M48 40 C34 22 16 22 6 32 C16 34 18 42 14 50 C24 46 30 50 32 58 Z" fill={C.white} {...st()} />
      <path d="M52 40 C66 22 84 22 94 32 C84 34 82 42 86 50 C76 46 70 50 68 58 Z" fill={C.white} {...st()} />
      <path d="M50 26 C40 26 34 34 34 44 C34 58 42 66 50 66 C58 66 66 58 66 44 C66 34 60 26 50 26 Z" fill={C.gold} {...st()} />
      <path d="M38 44 H62" stroke={INK} strokeWidth="2.6" />
      <ellipse cx="50" cy="44" rx="8" ry="6" fill={C.white} {...st(2)} />
      <circle cx="50" cy="44" r="3" fill={C.blue} />
      <path d="M40 66 L36 92 H64 L60 66" fill={C.white} {...st()} />
    </g>
  );
}
function Ogre() {
  return (
    <g>
      <path d="M78 20 L92 6 M74 14 C84 4 98 10 94 20 C90 30 80 30 74 26 Z" fill={C.wood} {...st()} />
      <path d="M78 24 L58 64" stroke={C.wood} strokeWidth="7" strokeLinecap="round" />
      <path d="M78 24 L58 64" {...st(1.4)} />
      <path d="M50 18 C30 18 20 32 20 50 C20 68 32 86 50 86 C68 86 80 68 80 50 C80 32 70 18 50 18 Z" fill={C.green} {...st()} />
      <path d="M20 44 L8 36 L18 54 M80 44 L92 36 L82 54" fill={C.green} {...st(2)} />
      <path d="M32 40 L44 44 M68 40 L56 44" {...st(3)} />
      <circle cx="39" cy="50" r="3.5" fill={C.fireL} {...st(1.4)} />
      <circle cx="61" cy="50" r="3.5" fill={C.fireL} {...st(1.4)} />
      <path d="M36 70 C44 64 56 64 64 70" fill="none" {...st(2.4)} />
      <path d="M40 68 L42 60 L45 67 M60 68 L58 60 L55 67" fill={C.white} {...st(1.4)} />
    </g>
  );
}

// ----------------------------------------------------------------------------- maldições
function CurseBolt() {
  return (
    <g>
      <path d="M14 30 C14 16 30 8 50 8 C70 8 86 16 86 30 C86 40 76 44 66 44 H34 C24 44 14 40 14 30 Z" fill="#4a5a4a" {...st()} />
      <path d="M54 44 L40 70 H52 L42 94 L66 62 H54 L62 44 Z" fill={C.fireL} {...st()} />
      <path d="M24 26 C30 18 40 16 48 16" stroke="#8aa08a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}
function BrokenSword() {
  return (
    <g>
      <g transform="translate(36 54) rotate(-18)">
        <path d="M0 -30 L-6 -24 L7 -18 L6 14 L-6 14 L-6 -24" fill={C.steel} {...st()} />
        <path d="M-18 14 H18 L15 20 H-15 Z" fill={C.goldD} {...st()} />
        <rect x="-4" y="20" width="8" height="16" rx="2" fill={C.leather} {...st()} />
      </g>
      <g transform="translate(66 34) rotate(30)">
        <path d="M0 -26 L6 -16 L4 10 L-2 4 L-6 12 L-6 -16 Z" fill={C.steel} {...st()} />
      </g>
      <path d="M48 22 L52 30 M56 44 L62 46" stroke={C.green} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}
function Hourglass() {
  return (
    <g>
      <rect x="22" y="8" width="56" height="9" rx="2" fill={C.wood} {...st()} />
      <rect x="22" y="83" width="56" height="9" rx="2" fill={C.wood} {...st()} />
      <path d="M30 17 C30 40 46 44 46 50 C46 56 30 60 30 83 H70 C70 60 54 56 54 50 C54 44 70 40 70 17 Z" fill="#d8ecef" fillOpacity="0.55" {...st()} />
      <path d="M34 24 C36 36 46 40 50 46 C54 40 64 36 66 24 Z" fill={C.green} />
      <path d="M50 50 L50 72" stroke={C.green} strokeWidth="2" />
      <path d="M34 82 C38 72 62 72 66 82 Z" fill={C.green} />
      <path d="M26 17 V83 M74 17 V83" stroke={C.woodD} strokeWidth="3" />
    </g>
  );
}
function Shackle() {
  return (
    <g>
      {[
        [30, 22],
        [44, 34],
        [58, 46],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="9" ry="6" transform={`rotate(40 ${x} ${y})`} fill="none" stroke={C.steelD} strokeWidth="5" />
      ))}
      <path d="M58 52 C42 54 34 66 36 78 C38 90 50 94 62 92 C76 90 84 78 82 66 C80 56 72 50 64 50" fill="none" stroke={INK} strokeWidth="11" />
      <path d="M58 52 C42 54 34 66 36 78 C38 90 50 94 62 92 C76 90 84 78 82 66 C80 56 72 50 64 50" fill="none" stroke={C.steel} strokeWidth="7" />
      <ellipse cx="59" cy="72" rx="9" ry="6" fill={C.green} {...st(2)} />
      <circle cx="59" cy="72" r="3" fill={INK} />
    </g>
  );
}

// ----------------------------------------------------------------------------- extras por nome
function Slime({ cube = false }: { cube?: boolean }) {
  return (
    <g>
      {cube ? (
        <>
          <path d="M18 34 L50 22 L82 34 L82 80 L50 92 L18 80 Z" fill="#7fd0a0" fillOpacity="0.7" {...st()} />
          <path d="M18 34 L50 46 L82 34 M50 46 V92" fill="none" {...st(2)} />
          <path d="M30 60 L36 66 M60 62 L66 56" stroke={C.bone} strokeWidth="4" strokeLinecap="round" />
          <circle cx="40" cy="74" r="4" fill={C.boneD} {...st(1.4)} />
        </>
      ) : (
        <>
          <path d="M12 86 C10 64 26 34 50 30 C74 34 90 64 88 86 C76 90 66 84 58 90 C48 84 40 92 30 86 C22 92 16 90 12 86 Z" fill="#8a9a8a" {...st()} />
          <path d="M30 50 C34 42 42 38 48 37" stroke={C.white} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
        </>
      )}
      <circle cx="42" cy={cube ? 52 : 60} r="5" fill={C.white} {...st(1.6)} />
      <circle cx="60" cy={cube ? 52 : 60} r="5" fill={C.white} {...st(1.6)} />
      <circle cx="43" cy={cube ? 53 : 61} r="2" fill={INK} />
      <circle cx="61" cy={cube ? 53 : 61} r="2" fill={INK} />
    </g>
  );
}
function Mushroom() {
  return (
    <g>
      <path d="M40 54 L36 90 H64 L60 54" fill={C.bone} {...st()} />
      <path d="M8 56 C8 26 30 10 50 10 C70 10 92 26 92 56 Z" fill={C.red} {...st()} />
      {[
        [30, 34, 6],
        [54, 22, 5],
        [72, 40, 7],
        [46, 44, 4],
      ].map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} fill={C.white} {...st(1.4)} />
      ))}
      <ellipse cx="44" cy="70" rx="3" ry="4" fill={INK} />
      <ellipse cx="56" cy="70" rx="3" ry="4" fill={INK} />
      <ellipse cx="50" cy="81" rx="5" ry="4" fill={INK} />
      <path d="M2 96 H98" stroke={C.green} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}
function Mimic() {
  return (
    <g>
      <path d="M14 50 L86 50 L86 90 L14 90 Z" fill={C.wood} {...st()} />
      <path d="M14 46 C14 20 86 20 86 46 L82 54 C70 40 30 40 18 54 Z" fill={C.wood} {...st()} />
      <path d="M18 54 C30 44 70 44 82 54 L80 62 C68 70 32 70 20 62 Z" fill={C.redD} {...st(2)} />
      {[24, 34, 44, 54, 64, 74].map((x) => (
        <path key={x} d={`M${x} 56 L${x + 4} 64 L${x + 8} 57`} fill={C.white} {...st(1.4)} />
      ))}
      <path d="M44 66 C40 76 46 84 54 80" stroke="#e86a8a" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M14 70 H86 M50 70 V90" stroke={C.gold} strokeWidth="4" />
      <circle cx="34" cy="34" r="4" fill={C.fireL} {...st(1.4)} />
      <circle cx="66" cy="34" r="4" fill={C.fireL} {...st(1.4)} />
    </g>
  );
}
function Minotaur() {
  return (
    <g>
      <path d="M26 34 C10 30 4 16 8 6 C14 18 24 20 32 22 M74 34 C90 30 96 16 92 6 C86 18 76 20 68 22" fill={C.bone} {...st()} />
      <path d="M50 18 C32 18 24 32 26 50 C28 62 32 72 36 80 C40 90 60 90 64 80 C68 72 72 62 74 50 C76 32 68 18 50 18 Z" fill={C.leather} {...st()} />
      <ellipse cx="50" cy="76" rx="16" ry="11" fill={C.fleshD} {...st()} />
      <circle cx="44" cy="76" r="2.6" fill={INK} />
      <circle cx="56" cy="76" r="2.6" fill={INK} />
      <path d="M40 84 C44 92 56 92 60 84" fill="none" stroke={C.gold} strokeWidth="3" />
      <path d="M34 44 L44 50 M66 44 L56 50" {...st(3)} />
      <circle cx="40" cy="52" r="3" fill={C.red} />
      <circle cx="60" cy="52" r="3" fill={C.red} />
    </g>
  );
}
function Frog() {
  return (
    <g>
      <path d="M14 74 C10 54 26 40 50 40 C74 40 90 54 86 74 C80 88 20 88 14 74 Z" fill={C.green} {...st()} />
      <circle cx="34" cy="38" r="11" fill={C.green} {...st()} />
      <circle cx="66" cy="38" r="11" fill={C.green} {...st()} />
      <circle cx="34" cy="38" r="5" fill={C.white} {...st(1.4)} />
      <circle cx="66" cy="38" r="5" fill={C.white} {...st(1.4)} />
      <circle cx="35" cy="39" r="2.4" fill={INK} />
      <circle cx="67" cy="39" r="2.4" fill={INK} />
      <path d="M28 62 C40 70 60 70 72 62" fill="none" {...st(2.4)} />
      <path d="M38 22 L42 10 L50 18 L58 10 L62 22 Z" fill={C.gold} {...st(2)} />
      <path d="M10 90 C20 82 30 92 40 88 M60 88 C70 92 80 82 90 90" stroke={C.greenD} strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  );
}
function Crown() {
  return (
    <g>
      <path d="M16 74 L12 28 L32 48 L50 18 L68 48 L88 28 L84 74 Z" fill={C.gold} {...st()} />
      <rect x="14" y="72" width="72" height="14" rx="3" fill={C.goldD} {...st()} />
      <circle cx="50" cy="79" r="5" fill={C.red} {...st(1.6)} />
      <circle cx="30" cy="79" r="4" fill={C.blue} {...st(1.4)} />
      <circle cx="70" cy="79" r="4" fill={C.green} {...st(1.4)} />
      {[
        [12, 28],
        [50, 18],
        [88, 28],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="5" fill={C.white} {...st(1.6)} />
      ))}
    </g>
  );
}
function WizardHat() {
  return (
    <g>
      <path d="M8 78 C30 68 70 68 92 78 C80 88 20 88 8 78 Z" fill={C.blueD} {...st()} />
      <path d="M24 74 C30 54 36 30 58 6 C56 22 66 30 72 34 C66 46 72 62 76 74 Z" fill={C.blue} {...st()} />
      <path d="M26 66 C40 62 62 62 74 66" stroke={C.gold} strokeWidth="5" fill="none" />
      <path d="M44 40 L47 48 L55 48 L49 53 L51 61 L44 56 L37 61 L39 53 L33 48 L41 48 Z" fill={C.fireL} {...st(1.4)} />
    </g>
  );
}

// ----------------------------------------------------------------------------- raças (rosto com acessórios)
interface Face {
  skin?: string;
  ears?: "pointy" | "big";
  beard?: boolean;
  tusks?: boolean;
  hat?: boolean;
  horns?: boolean;
  fangs?: boolean;
  halo?: boolean;
  helmet?: boolean;
  scales?: boolean;
}
function HeroFace(f: Face) {
  const skin = f.skin ?? C.flesh;
  return (
    <g>
      {f.halo && <ellipse cx="50" cy="12" rx="20" ry="5" fill="none" stroke={C.fireL} strokeWidth="4" />}
      {f.horns && <path d="M30 30 C20 22 20 10 26 4 C28 14 34 18 38 22 M70 30 C80 22 80 10 74 4 C72 14 66 18 62 22" fill={C.black} {...st()} />}
      {f.ears === "pointy" && <path d="M26 48 L8 34 L26 60 M74 48 L92 34 L74 60" fill={skin} {...st()} />}
      {f.ears === "big" && <path d="M26 44 L4 30 L10 56 L26 58 M74 44 L96 30 L90 56 L74 58" fill={skin} {...st()} />}
      <path d="M26 74 L22 96 H78 L74 74 C68 70 32 70 26 74 Z" fill={f.helmet ? C.steel : C.leather} {...st()} />
      <path d="M50 18 C34 18 26 30 26 46 C26 64 36 78 50 78 C64 78 74 64 74 46 C74 30 66 18 50 18 Z" fill={skin} {...st()} />
      {f.scales && <path d="M34 34 C38 30 42 34 46 30 M54 30 C58 34 62 30 66 34 M38 64 C42 60 46 64 50 60 C54 64 58 60 62 64" stroke={C.redD} strokeWidth="2" fill="none" />}
      <path d="M36 44 H44 M56 44 H64" {...st(2.4)} />
      <circle cx="40" cy="48" r="2.4" fill={INK} />
      <circle cx="60" cy="48" r="2.4" fill={INK} />
      <path d="M50 50 L47 58 H53" fill="none" {...st(2)} />
      {f.beard ? (
        <path d="M30 56 C32 74 40 92 50 94 C60 92 68 74 70 56 C64 64 58 66 50 64 C42 66 36 64 30 56 Z" fill="#a8622c" {...st()} />
      ) : (
        <path d="M42 66 C46 69 54 69 58 66" fill="none" {...st(2)} />
      )}
      {f.tusks && <path d="M40 64 L38 54 L44 62 M60 64 L62 54 L56 62" fill={C.white} {...st(1.6)} />}
      {f.fangs && <path d="M44 66 L45 72 L47 66 M53 66 L55 72 L56 66" fill={C.white} {...st(1.4)} />}
      {f.helmet && (
        <>
          <path d="M24 40 C24 20 36 12 50 12 C64 12 76 20 76 40 Z" fill={C.steel} {...st()} />
          <path d="M24 40 H76" stroke={C.goldD} strokeWidth="4" />
          <path d="M24 30 L10 22 M76 30 L90 22" {...st(4)} />
        </>
      )}
      {f.hat && <path d="M24 28 C36 26 64 26 76 28 L56 -2 C54 6 52 10 44 12 Z" fill={C.red} {...st()} />}
    </g>
  );
}
function Wings() {
  return (
    <g>
      <path d="M48 52 C30 30 10 30 6 44 C14 48 16 56 22 60 C30 58 40 58 48 52 Z" fill="#cfe9ff" fillOpacity="0.85" {...st()} />
      <path d="M52 52 C70 30 90 30 94 44 C86 48 84 56 78 60 C70 58 60 58 52 52 Z" fill="#cfe9ff" fillOpacity="0.85" {...st()} />
      <path d="M48 56 C34 64 22 76 26 84 C36 82 44 72 48 60 M52 56 C66 64 78 76 74 84 C64 82 56 72 52 60" fill="#e8d4ff" fillOpacity="0.85" {...st(2)} />
      <ellipse cx="50" cy="58" rx="5" ry="20" fill={C.green} {...st()} />
      <circle cx="50" cy="34" r="8" fill={C.flesh} {...st()} />
    </g>
  );
}
function Owl() {
  return (
    <g>
      <path d="M50 14 C28 14 18 34 20 58 C22 80 36 92 50 92 C64 92 78 80 80 58 C82 34 72 14 50 14 Z" fill={C.leather} {...st()} />
      <path d="M22 26 L32 34 M78 26 L68 34" {...st(4)} />
      <circle cx="38" cy="44" r="12" fill={C.white} {...st()} />
      <circle cx="62" cy="44" r="12" fill={C.white} {...st()} />
      <circle cx="38" cy="44" r="6" fill={C.fireL} {...st(1.6)} />
      <circle cx="62" cy="44" r="6" fill={C.fireL} {...st(1.6)} />
      <circle cx="38" cy="44" r="2.6" fill={INK} />
      <circle cx="62" cy="44" r="2.6" fill={INK} />
      <path d="M50 52 L45 60 L50 66 L55 60 Z" fill={C.goldD} {...st(1.8)} />
      <path d="M34 72 C40 76 44 72 50 76 C56 72 60 76 66 72" stroke={C.woodD} strokeWidth="3" fill="none" />
    </g>
  );
}
function Turtle() {
  return (
    <g>
      <ellipse cx="50" cy="60" rx="38" ry="28" fill={C.green} {...st()} />
      <path d="M50 32 L64 44 L58 64 L42 64 L36 44 Z" fill={C.greenD} {...st(2)} />
      <path d="M50 32 V22 M64 44 L82 40 M58 64 L72 80 M42 64 L28 80 M36 44 L18 40" {...st(2)} />
      <path d="M50 22 C44 10 56 6 60 14" fill={C.green} {...st(2)} />
      <circle cx="88" cy="58" r="9" fill={C.green} {...st()} />
      <circle cx="90" cy="56" r="1.8" fill={INK} />
    </g>
  );
}
function Centaur() {
  return (
    <g>
      <path d="M30 56 C28 48 36 44 46 46 L80 46 C88 46 92 54 90 62 L86 66 L88 92 H80 L78 70 L46 70 L44 92 H36 L36 70 C30 68 30 62 30 56 Z" fill={C.leather} {...st()} />
      <path d="M90 52 C96 56 96 66 92 72" stroke={C.woodD} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M36 52 L34 26 C34 18 46 18 46 26 L46 50" fill={C.flesh} {...st()} />
      <circle cx="40" cy="14" r="8" fill={C.flesh} {...st()} />
      <Bow x={20} y={34} s={0.5} />
    </g>
  );
}
function Trident() {
  return (
    <g>
      <path d="M50 30 V92" stroke={C.goldD} strokeWidth="6" strokeLinecap="round" />
      <path d="M30 10 V30 C30 38 70 38 70 30 V10 M50 4 V34" fill="none" stroke={C.gold} strokeWidth="6" strokeLinecap="round" />
      <path d="M30 10 L26 18 M70 10 L74 18 M50 4 L46 12" {...st(2.4)} />
      <path d="M6 76 C18 68 26 84 38 76 C50 68 58 84 70 76 C82 68 88 80 96 74" fill="none" stroke={C.blue} strokeWidth="5" strokeLinecap="round" />
      <path d="M6 88 C18 80 26 96 38 88 C50 80 58 96 70 88 C82 80 88 92 96 86" fill="none" stroke={C.blueD} strokeWidth="5" strokeLinecap="round" />
    </g>
  );
}
function Elemental() {
  return (
    <g>
      <path d="M50 8 C76 8 92 30 86 54 C80 78 54 92 32 82 C14 74 10 50 24 36 C36 24 56 30 56 44 C56 54 44 56 40 50" fill="none" stroke={C.blue} strokeWidth="9" strokeLinecap="round" />
      <path d="M50 8 C76 8 92 30 86 54 C80 78 54 92 32 82 C14 74 10 50 24 36 C36 24 56 30 56 44 C56 54 44 56 40 50" fill="none" stroke={C.fire} strokeWidth="4" strokeLinecap="round" />
      <circle cx="40" cy="50" r="5" fill={C.fireL} {...st(1.6)} />
    </g>
  );
}

function raceArt(id: string): ReactNode {
  const k = id.toLowerCase();
  if (/fada|pixie|sprite/.test(k)) return <Wings />;
  if (/owl|coruja/.test(k)) return <Owl />;
  if (/torkle|tartaruga/.test(k)) return <Turtle />;
  if (/centauro/.test(k)) return <Centaur />;
  if (/trit|sereia|mar/.test(k)) return <Trident />;
  if (/elemental/.test(k)) return <Elemental />;
  if (/drac|drag/.test(k)) return <HeroFace skin="#c95a3a" horns scales />;
  if (/anao|anã/.test(k)) return <HeroFace beard helmet />;
  if (/elfo/.test(k)) return <HeroFace ears="pointy" skin="#f0cfa8" />;
  if (/orc/.test(k)) return <HeroFace skin="#7fa05a" tusks />;
  if (/goblin/.test(k)) return <HeroFace skin="#8cb04a" ears="big" fangs />;
  if (/gnomo/.test(k)) return <HeroFace hat beard />;
  if (/gigante/.test(k)) return <HeroFace skin="#c9a07a" beard />;
  if (/diabrete|imp|demon/.test(k)) return <HeroFace skin="#c04040" horns ears="pointy" fangs />;
  if (/vamp/.test(k)) return <HeroFace skin="#e6dcd8" fangs ears="pointy" />;
  if (/divin|celest|anj/.test(k)) return <HeroFace halo skin="#f4dcb8" />;
  return <HeroFace />;
}

// ----------------------------------------------------------------------------- classes
function Lute() {
  return (
    <g>
      <path d="M64 10 L72 4 L80 12 L74 20" fill={C.woodD} {...st()} />
      <path d="M70 16 L48 48" stroke={C.woodD} strokeWidth="8" strokeLinecap="round" />
      <path d="M46 44 C30 36 12 48 14 68 C16 86 36 94 52 82 C64 72 62 54 46 44 Z" fill={C.wood} {...st()} />
      <circle cx="38" cy="66" r="8" fill={C.woodD} {...st(2)} />
      <path d="M70 16 L34 70 M74 18 L38 72" stroke={C.white} strokeWidth="1" />
    </g>
  );
}
function Orb() {
  return (
    <g>
      <path d="M30 86 H70 L64 74 H36 Z" fill={C.goldD} {...st()} />
      <circle cx="50" cy="48" r="28" fill={C.purple} {...st()} />
      <circle cx="50" cy="48" r="18" fill="#a77ad1" />
      <path d="M38 36 C42 30 48 28 54 28" stroke={C.white} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M50 38 L53 46 L61 48 L53 50 L50 58 L47 50 L39 48 L47 46 Z" fill={C.white} />
      <path d="M16 20 L20 24 M84 20 L80 24 M12 52 H18 M82 52 H88" stroke={C.fireL} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}
function Tome() {
  return (
    <g>
      <path d="M14 26 C30 20 42 22 50 30 C58 22 70 20 86 26 V84 C70 78 58 80 50 88 C42 80 30 78 14 84 Z" fill={C.purpleD} {...st()} />
      <path d="M20 30 C32 26 42 28 48 34 V82 C40 76 30 76 20 80 Z M80 30 C68 26 58 28 52 34 V82 C60 76 70 76 80 80 Z" fill={C.bone} {...st(2)} />
      <ellipse cx="66" cy="54" rx="10" ry="7" fill={C.white} {...st(2)} />
      <circle cx="66" cy="54" r="4" fill={C.green} />
      <path d="M26 44 H42 M26 52 H40 M26 60 H42" stroke={C.boneD} strokeWidth="2.4" />
    </g>
  );
}
function Fist() {
  return (
    <g>
      <path d="M28 40 C28 30 36 26 42 30 C44 22 54 22 56 30 C60 24 70 26 70 34 C76 32 82 38 80 46 L78 66 C76 80 66 90 52 90 C38 90 28 80 28 66 Z" fill={C.flesh} {...st()} />
      <path d="M42 30 V48 M56 30 V48 M70 34 V50" {...st(2)} />
      <path d="M28 52 C36 50 42 54 46 60" fill="none" {...st(2)} />
      <path d="M20 92 H84" stroke={C.red} strokeWidth="6" strokeLinecap="round" />
      {[24, 36, 48, 60, 72].map((x) => (
        <circle key={x} cx={x} cy="96" r="3.5" fill={C.wood} {...st(1.4)} />
      ))}
    </g>
  );
}
function Mask() {
  return (
    <g>
      <path d="M10 40 C10 26 30 24 50 34 C70 24 90 26 90 40 C90 58 74 66 60 60 C56 58 54 54 50 54 C46 54 44 58 40 60 C26 66 10 58 10 40 Z" fill={C.purple} {...st()} />
      <ellipse cx="32" cy="44" rx="9" ry="6" fill={INK} />
      <ellipse cx="68" cy="44" rx="9" ry="6" fill={INK} />
      <path d="M50 54 C46 70 54 84 46 96" stroke={C.gold} strokeWidth="3" fill="none" />
      <path d="M18 34 C24 30 32 30 38 32" stroke="#c9a2e6" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}
function Gear() {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <g>
      <g transform="translate(36 62)">
        {teeth.map((a) => (
          <rect key={a} x="-5" y="-30" width="10" height="12" rx="2" transform={`rotate(${a})`} fill={C.goldD} {...st(2)} />
        ))}
        <circle r="22" fill={C.gold} {...st()} />
        <circle r="8" fill={C.goldD} {...st(2)} />
      </g>
      <Hammer x={70} y={44} r={30} s={0.7} />
    </g>
  );
}
function Flasks() {
  return (
    <g>
      <path d="M22 30 V52 C12 58 12 80 30 84 C48 80 48 58 38 52 V30" fill="#cfe7ef" fillOpacity="0.6" {...st()} />
      <path d="M16 66 C22 62 38 70 44 66 C44 78 36 84 30 84 C22 84 16 78 16 66 Z" fill={C.green} />
      <path d="M62 20 V44 L50 84 H86 L74 44 V20" fill="#cfe7ef" fillOpacity="0.6" {...st()} />
      <path d="M56 64 H80 L86 84 H50 Z" fill={C.purple} />
      <path d="M18 30 H42 M58 20 H78" {...st(3)} />
      <circle cx="68" cy="56" r="2" fill={C.white} />
      <circle cx="30" cy="60" r="2" fill={C.white} />
    </g>
  );
}
function HolySymbol() {
  return (
    <g>
      <circle cx="50" cy="50" r="34" fill={C.gold} {...st()} />
      <circle cx="50" cy="50" r="26" fill="none" stroke={C.goldD} strokeWidth="2.4" />
      {Array.from({ length: 12 }, (_, i) => (
        <path key={i} d="M50 10 L50 4" transform={`rotate(${i * 30} 50 50)`} stroke={C.fireL} strokeWidth="4" strokeLinecap="round" />
      ))}
      <path d="M50 30 V70 M36 44 H64" stroke={C.white} strokeWidth="8" strokeLinecap="round" />
      <path d="M50 30 V70 M36 44 H64" {...st(1.4)} />
    </g>
  );
}

function classArt(id: string): ReactNode {
  const k = id.toLowerCase();
  if (/berserk/.test(k)) return <><Axe x={30} y={54} r={-32} s={0.8} /><g transform="translate(100 0) scale(-1 1)"><Axe x={30} y={54} r={-32} s={0.8} /></g></>;
  if (/barbar/.test(k)) return <Axe x={50} y={52} r={-18} />;
  if (/guerreir/.test(k)) return <><Shield x={60} y={56} s={0.75} emblem="boss" /><Sword x={38} y={50} r={-25} s={0.85} /></>;
  if (/paladin/.test(k)) return <><Sword x={50} y={46} r={0} s={0.8} /><Shield x={50} y={62} s={0.6} emblem="cross" /></>;
  if (/mago|wizard/.test(k)) return <><Staff x={40} y={52} r={-12} top="star" /><path d="M54 40 C62 38 76 38 84 40 L72 6 Z" fill={C.blue} {...st()} /><path d="M50 42 H88" stroke={C.blueD} strokeWidth="5" strokeLinecap="round" /></>;
  if (/cl[eé]rig/.test(k)) return <HolySymbol />;
  if (/ladin|thief|rogue/.test(k)) return <><Mask /><Dagger x={50} y={78} r={90} s={0.8} /></>;
  if (/druid/.test(k)) return <Staff x={50} y={50} top="leaf" />;
  if (/bard/.test(k)) return <Lute />;
  if (/feiti|sorc/.test(k)) return <Orb />;
  if (/bruxo|warlock/.test(k)) return <Tome />;
  if (/monge|monk/.test(k)) return <Fist />;
  if (/patrulh|ranger|ca[cç]ad/.test(k)) return <Bow x={50} y={50} />;
  if (/ilusion/.test(k)) return <Mask />;
  if (/art[ií]fic/.test(k)) return <Gear />;
  if (/alquim/.test(k)) return <Flasks />;
  return <><Sword x={36} y={50} r={-30} s={0.85} /><Staff x={64} y={50} r={20} top="orb" /></>;
}

function itemArt(d: Extract<CardDef, { kind: "item" }>): ReactNode {
  const n = d.name.toLowerCase();
  switch (d.slot) {
    case "head":
      if (/coroa|tiara/.test(n)) return <Crown />;
      if (/chap[eé]u|capuz/.test(n)) return <WizardHat />;
      return <Helmet />;
    case "chest":
      return <Breastplate />;
    case "legs":
      return <Greaves />;
    case "feet":
      return <Boot />;
    case "ring":
      return <Ring />;
    case "neck":
      return <Amulet />;
    case "mount":
      return <Horse />;
  }
  if (/escudo/.test(n)) return <Shield emblem="boss" />;
  if (/machad/.test(n)) return <Axe r={-15} />;
  if (/martel|maça|clava|porret/.test(n)) return <Hammer r={-15} />;
  if (/arco|besta/.test(n)) return <Bow />;
  if (/cajad|bast[aã]o|varinha/.test(n)) return <Staff top="orb" />;
  if (/adaga|punhal|faca/.test(n)) return <Dagger s={1.6} r={-20} />;
  if (/lan[cç]a|tridente|alabarda/.test(n)) return <Spear r={-15} />;
  return <Sword r={-15} />;
}

function monsterArt(d: Extract<CardDef, { kind: "monster" }>): ReactNode {
  const t = d.tags;
  const n = d.name.toLowerCase();
  if (/cubo/.test(n)) return <Slime cube />;
  if (/gosma|lodo|geleia|pudim/.test(n)) return <Slime />;
  if (/cogumelo|fungo/.test(n)) return <Mushroom />;
  if (/m[ií]mico/.test(n)) return <Mimic />;
  if (/minotauro/.test(n)) return <Minotaur />;
  if (t.includes("dragao")) return <Dragon />;
  if (t.includes("demonio")) return <Demon />;
  if (t.includes("morto-vivo")) return <Skull cross />;
  if (t.includes("aquatico")) return <Tentacles />;
  if (t.includes("fogo")) return <FireSpirit />;
  if (t.includes("sagrado")) return <Angel />;
  if (t.includes("voador")) return <Bat />;
  if (t.includes("animal")) return <Wolf />;
  return <Ogre />;
}

function curseArt(d: Extract<CardDef, { kind: "curse" }>): ReactNode {
  const n = d.name.toLowerCase();
  if (/sapo/.test(n)) return <Frog />;
  if (/m[ií]mico/.test(n)) return <Mimic />;
  if (/coroa/.test(n)) return <Crown />;
  switch (d.curseType) {
    case "combat":
      return <BrokenSword />;
    case "duration":
      return <Hourglass />;
    case "persistent":
      return <Shackle />;
    default:
      return <CurseBolt />;
  }
}

/** Ilustração (100x100) da carta. */
export function Emblem({ d }: { d: CardDef }) {
  switch (d.kind) {
    case "item":
      return <>{itemArt(d)}</>;
    case "potion":
      return <Potion />;
    case "rune":
      return <RuneStone />;
    case "misc":
      return <Pouch />;
    case "levelup":
      return <LevelUp />;
    case "monster":
      return <>{monsterArt(d)}</>;
    case "wandering":
      return <Wanderer />;
    case "curse":
      return <>{curseArt(d)}</>;
    case "monsterBonus":
      return <Claws />;
    case "race":
      return <>{raceArt(d.id)}</>;
    case "class":
      return <>{classArt(d.id)}</>;
  }
}

/** Cores do "céu" da janela de ilustração por tipo de carta: [topo, base, chão]. */
export const SCENE: Record<CardDef["kind"], [string, string, string]> = {
  race: ["#9cc7a2", "#e9dfb8", "#7d9a5a"],
  class: ["#9fb4cf", "#e6e0cc", "#8a8f99"],
  item: ["#8fb0d6", "#e8e2cf", "#8c8a80"],
  potion: ["#86c9c4", "#e4efe0", "#6f9a8f"],
  rune: ["#d68a7c", "#f0dcc6", "#8a7466"],
  misc: ["#e0c070", "#f2e6c4", "#a48a52"],
  levelup: ["#f5d77a", "#fff4cf", "#c9a24a"],
  monster: ["#b65a45", "#e9c9a6", "#6d4a3a"],
  curse: ["#6f8f6a", "#d9e0c6", "#4a5a44"],
  monsterBonus: ["#d68aa8", "#f2dccc", "#9a6a74"],
  wandering: ["#8a6aa6", "#e0d0e6", "#5a4a66"],
};
