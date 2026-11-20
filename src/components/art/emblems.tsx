/**
 * Emblemas em estilo xilogravura (traço de tinta) para o centro das cartas. Caixa 100x100.
 */
import type { CardDef } from "@/game/catalog";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const F = { fill: "currentColor", stroke: "none" } as const;

function Sword() {
  return (
    <g>
      <path d="M50 8 L57 18 L57 64 L43 64 L43 18 Z" {...S} />
      <path d="M50 16 L50 60" {...S} strokeWidth={2} />
      <path d="M30 64 L70 64 L70 71 L30 71 Z" {...F} />
      <path d="M46 71 L54 71 L54 88 L46 88 Z" {...S} />
      <circle cx="50" cy="92" r="5" {...F} />
    </g>
  );
}
function Helmet() {
  return (
    <g>
      <path d="M20 66 C20 34 34 18 50 18 C66 18 80 34 80 66 L80 80 L62 80 L62 58 L38 58 L38 80 L20 80 Z" {...S} />
      <path d="M50 18 L50 58" {...S} strokeWidth={3} />
      <path d="M26 46 L74 46" {...S} strokeWidth={3} />
      <path d="M50 10 L50 18" {...S} />
    </g>
  );
}
function Chest() {
  return (
    <g>
      <path d="M30 18 L42 24 L50 30 L58 24 L70 18 L86 30 L78 48 L74 44 L74 86 L26 86 L26 44 L22 48 L14 30 Z" {...S} />
      <path d="M50 30 L50 86 M34 52 L66 52 M34 68 L66 68" {...S} strokeWidth={3} />
    </g>
  );
}
function Legs() {
  return (
    <g>
      <path d="M28 14 L72 14 L76 88 L56 88 L50 40 L44 88 L24 88 Z" {...S} />
      <path d="M28 26 L72 26" {...S} strokeWidth={3} />
      <circle cx="36" cy="58" r="4" {...F} />
      <circle cx="64" cy="58" r="4" {...F} />
    </g>
  );
}
function Boot() {
  return (
    <g>
      <path d="M32 12 L56 12 L56 58 L82 70 L84 86 L22 86 L22 74 L32 66 Z" {...S} />
      <path d="M32 26 L56 26 M22 78 L84 78" {...S} strokeWidth={3} />
    </g>
  );
}
function Ring() {
  return (
    <g>
      <ellipse cx="50" cy="62" rx="28" ry="24" {...S} strokeWidth={6} />
      <path d="M38 34 L50 18 L62 34 L50 44 Z" {...S} />
      <path d="M42 30 L58 30" {...S} strokeWidth={2} />
    </g>
  );
}
function Amulet() {
  return (
    <g>
      <path d="M22 12 C22 40 36 52 50 56 C64 52 78 40 78 12" {...S} strokeDasharray="3 5" />
      <path d="M50 56 L68 74 L50 94 L32 74 Z" {...S} />
      <circle cx="50" cy="75" r="7" {...F} />
    </g>
  );
}
function Horseshoe() {
  return (
    <g>
      <path d="M26 86 L22 52 C20 28 34 14 50 14 C66 14 80 28 78 52 L74 86 L60 86 L64 52 C66 36 58 28 50 28 C42 28 34 36 36 52 L40 86 Z" {...S} />
      {[
        [27, 70],
        [25, 50],
        [33, 30],
        [73, 70],
        [75, 50],
        [67, 30],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" {...F} />
      ))}
    </g>
  );
}
function Flask() {
  return (
    <g>
      <path d="M42 10 L58 10 M44 10 L44 36 C28 44 20 56 22 70 C24 84 36 90 50 90 C64 90 76 84 78 70 C80 56 72 44 56 36 L56 10" {...S} />
      <path d="M25 64 C38 58 50 70 75 62 L77 70 C74 84 64 88 50 88 C36 88 26 84 23 70 Z" {...F} opacity={0.55} />
      <circle cx="40" cy="74" r="3" fill="#fff" opacity={0.5} />
      <circle cx="56" cy="78" r="2" fill="#fff" opacity={0.5} />
    </g>
  );
}
function RuneStone() {
  return (
    <g>
      <path d="M30 90 L24 40 C24 20 36 10 50 10 C64 10 76 20 76 40 L70 90 Z" {...S} />
      <path d="M44 28 L44 76 M44 28 L58 38 L44 48 L60 74" {...S} strokeWidth={5} />
      <path d="M18 90 L82 90" {...S} />
    </g>
  );
}
function Pouch() {
  return (
    <g>
      <path d="M38 20 L62 20 L56 32 C76 40 84 60 78 76 C74 86 62 90 50 90 C38 90 26 86 22 76 C16 60 24 40 44 32 Z" {...S} />
      <path d="M40 32 L60 32" {...S} strokeWidth={5} />
      <path d="M50 56 L50 74 M44 60 C44 54 56 54 56 60 C56 66 44 64 44 70 C44 76 56 76 56 70" {...S} strokeWidth={3} />
    </g>
  );
}
function LevelUp() {
  return (
    <g>
      <path d="M20 58 L50 30 L80 58 M20 80 L50 52 L80 80" {...S} strokeWidth={8} />
      <path d="M50 4 L54 14 L64 14 L56 20 L59 30 L50 24 L41 30 L44 20 L36 14 L46 14 Z" {...F} />
    </g>
  );
}
function Skull({ horns }: { horns?: boolean }) {
  return (
    <g>
      {horns && <path d="M26 36 C12 30 8 16 14 6 C18 18 26 22 34 26 M74 36 C88 30 92 16 86 6 C82 18 74 22 66 26" {...S} />}
      <path d="M50 16 C30 16 20 30 20 46 C20 58 26 64 32 68 L32 82 L68 82 L68 68 C74 64 80 58 80 46 C80 30 70 16 50 16 Z" {...S} />
      <ellipse cx="38" cy="48" rx="8" ry="9" {...F} />
      <ellipse cx="62" cy="48" rx="8" ry="9" {...F} />
      <path d="M50 58 L45 68 L55 68 Z" {...F} />
      <path d="M40 74 L40 82 M50 74 L50 82 M60 74 L60 82" {...S} strokeWidth={3} />
    </g>
  );
}
function Footprints() {
  return (
    <g>
      <Skull />
      <g transform="translate(0 0) scale(1)" opacity={0.85}>
        <ellipse cx="18" cy="88" rx="5" ry="7" {...F} />
        <ellipse cx="82" cy="80" rx="5" ry="7" {...F} />
      </g>
    </g>
  );
}
function Candle() {
  return (
    <g>
      <path d="M50 8 C56 18 58 24 50 32 C42 24 44 18 50 8 Z" {...F} />
      <path d="M36 40 L64 40 L64 84 L36 84 Z" {...S} />
      <path d="M36 40 C36 50 42 52 42 58 M64 40 C64 46 58 48 58 54" {...S} strokeWidth={3} />
      <path d="M24 88 L76 88" {...S} />
      <ellipse cx="50" cy="64" rx="5" ry="3" {...F} />
      <circle cx="50" cy="64" r="1.6" fill="#fff" />
    </g>
  );
}
function Claws() {
  return (
    <g>
      <path d="M22 18 C40 40 44 62 40 88 M44 12 C60 36 64 60 60 90 M66 16 C80 38 84 58 80 84" {...S} strokeWidth={7} />
    </g>
  );
}
function Bust() {
  return (
    <g>
      <circle cx="50" cy="34" r="18" {...S} />
      <path d="M16 90 C16 66 30 56 50 56 C70 56 84 66 84 90" {...S} />
      <path d="M32 30 L22 22 M68 30 L78 22" {...S} strokeWidth={3} />
    </g>
  );
}
function Crossed() {
  return (
    <g>
      <path d="M18 18 L82 82 M82 18 L18 82" {...S} strokeWidth={6} />
      <path d="M12 30 L30 12 M70 88 L88 70" {...S} />
      <circle cx="82" cy="18" r="8" {...F} />
      <circle cx="18" cy="82" r="5" {...F} />
    </g>
  );
}

export function Emblem({ d }: { d: CardDef }) {
  switch (d.kind) {
    case "item":
      switch (d.slot) {
        case "head":
          return <Helmet />;
        case "chest":
          return <Chest />;
        case "legs":
          return <Legs />;
        case "feet":
          return <Boot />;
        case "ring":
          return <Ring />;
        case "neck":
          return <Amulet />;
        case "mount":
          return <Horseshoe />;
        default:
          return <Sword />;
      }
    case "potion":
      return <Flask />;
    case "rune":
      return <RuneStone />;
    case "misc":
      return <Pouch />;
    case "levelup":
      return <LevelUp />;
    case "monster":
      return <Skull horns />;
    case "wandering":
      return <Footprints />;
    case "curse":
      return <Candle />;
    case "monsterBonus":
      return <Claws />;
    case "race":
      return <Bust />;
    default:
      return <Crossed />;
  }
}
