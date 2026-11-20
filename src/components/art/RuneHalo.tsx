/**
 * Letras rúnicas (futhark antigo) girando ao redor de uma carta encantada.
 * As runas são desenhadas em SVG (não dependem de fonte) e andam pelo contorno com <animateMotion>.
 */

// Glifos em traço, numa caixa de -5..5 x -7..7 ("para cima" = -y)
const GLYPHS = [
  "M-3 7V-7M-3-3L3-7M-3 1L3-3", // ᚠ
  "M-3 7V-7L3-3V7", // ᚢ
  "M-3-7V7M-3-3L2 0L-3 3", // ᚦ
  "M-3 7V-7L3-3M-3-2L3 2", // ᚨ
  "M-3 7V-7L2-4L-3-1L3 7", // ᚱ
  "M3-7L-3 0L3 7", // ᚲ
  "M-4-7L4 7M4-7L-4 7", // ᚷ
  "M-3 7V-7L2-4L-3-1", // ᚹ
  "M-3-7V7M3-7V7M-3-2L3 2", // ᚺ
  "M0-7V7M-3-2L3 2", // ᚾ
  "M0-7V7", // ᛁ
  "M-1-6L-4-2L-1 2M1-2L4 2L1 6", // ᛃ
  "M0-7V7M0-7L3-4M0 7L-3 4", // ᛇ
  "M-3-7V7M-3-7L2-4M-3 7L2 4", // ᛈ
  "M0 7V-7M0-1L-4-6M0-1L4-6", // ᛉ
  "M3-7L-3-2L3 2L-3 7", // ᛊ
  "M0 7V-7M-4-3L0-7L4-3", // ᛏ
  "M-3-7V7L3 3.5L-3 0L3-3.5Z", // ᛒ
  "M-3 7V-7L0-3L3-7V7", // ᛖ
  "M-3 7V-7L3-2M3 7V-7L-3-2", // ᛗ
  "M-3 7V-7L3-3", // ᛚ
  "M0-7L4 0L0 7L-4 0Z", // ᛜ
  "M-4-7V7L4-7V7Z", // ᛞ
  "M-4 7L3-1L0-7L-3-1L4 7", // ᛟ
];

// Contorno (viewBox da carta: 250x350; o halo tem margem de 22), sentido horário a partir do topo
const X = -11;
const Y = -11;
const W = 272;
const H = 372;
const R = 26;
const LOOP = `M${X + R} ${Y} H${X + W - R} A${R} ${R} 0 0 1 ${X + W} ${Y + R} V${Y + H - R} A${R} ${R} 0 0 1 ${X + W - R} ${Y + H} H${X + R} A${R} ${R} 0 0 1 ${X} ${Y + H - R} V${Y + R} A${R} ${R} 0 0 1 ${X + R} ${Y} Z`;

/** `count` = quantidade de runas encaixadas (mais runas, mais rápido). */
export function RuneHalo({ count = 1 }: { count?: number }) {
  const n = 26;
  const dur = Math.max(9, 20 - count * 4);
  return (
    <svg
      viewBox="-22 -22 294 394"
      className="rune-halo pointer-events-none absolute z-10"
      style={{ left: "-8.8%", top: "-6.3%", width: "117.6%", height: "112.6%" }}
      aria-hidden
    >
      <path d={LOOP} fill="none" stroke="#ff8a6a" strokeWidth="1.2" strokeDasharray="2 9" opacity="0.55" />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <path
            d={GLYPHS[(i * 7 + count) % GLYPHS.length]}
            fill="none"
            stroke={i % 3 === 0 ? "#ffd27a" : "#ff6a5a"}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <animateMotion dur={`${dur}s`} begin={`${(-i * dur) / n}s`} repeatCount="indefinite" rotate="auto" path={LOOP} />
        </g>
      ))}
    </svg>
  );
}
