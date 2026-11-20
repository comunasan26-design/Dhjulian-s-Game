"use client";

/**
 * Encantamento rúnico: anéis de letras rúnicas (futhark antigo, desenhadas em SVG) orbitando a carta em
 * diagonal. Cada anel é desenhado em duas camadas sincronizadas — uma atrás da carta (metade de trás da
 * órbita, mais apagada) e outra na frente (metade da frente) — para dar a ilusão de atravessar a carta em 3D.
 */
import { useId } from "react";

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

const RX = 182;
const RY = 46;
const N = 22;

// Anéis: inclinação (graus), sentido e velocidade. Mais runas encaixadas = mais anéis.
const RINGS = [
  { tilt: -33, reverse: false, dur: 11 },
  { tilt: 33, reverse: true, dur: 13 },
  { tilt: -72, reverse: false, dur: 15 },
];

function orbit(reverse: boolean) {
  // metade de baixo (frente) primeiro; o sentido define para onde as runas andam
  const s = reverse ? 1 : 0;
  return `M${-RX} 0 A${RX} ${RY} 0 1 ${s} ${RX} 0 A${RX} ${RY} 0 1 ${s} ${-RX} 0 Z`;
}

/** `layer="back"` vai antes da arte da carta (fica atrás); `layer="front"` vai depois (fica na frente). */
export function RuneHalo({ count = 1, layer }: { count?: number; layer: "back" | "front" }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rings = RINGS.slice(0, Math.max(1, Math.min(3, count)));
  const front = layer === "front";
  return (
    <svg
      viewBox="-60 -20 370 390"
      className={`rune-halo pointer-events-none absolute ${front ? "z-10" : "z-0"}`}
      style={{ left: "-24%", top: "-5.714%", width: "148%", height: "111.43%", opacity: front ? 1 : 0.5 }}
      aria-hidden
    >
      <defs>
        <clipPath id={`rh-${uid}-${layer}`} clipPathUnits="userSpaceOnUse">
          <rect x={-400} y={front ? 0 : -400} width={800} height={400} />
        </clipPath>
      </defs>
      {rings.map((r, ri) => {
        const path = orbit(r.reverse);
        return (
          <g key={ri} transform={`translate(125 175) rotate(${r.tilt})`}>
            <g clipPath={`url(#rh-${uid}-${layer})`}>
              <ellipse rx={RX} ry={RY} fill="none" stroke="#ff7a5a" strokeWidth={front ? 1.6 : 1} strokeDasharray="2 7" opacity={0.6} />
              <ellipse rx={RX} ry={RY} fill="none" stroke="#ffb36b" strokeWidth={front ? 6 : 4} opacity={0.12} />
              {Array.from({ length: N }, (_, i) => (
                <g key={i}>
                  <g transform={`scale(${front ? 1.15 : 0.85})`}>
                    <path
                      d={GLYPHS[(i * 7 + ri * 5 + count) % GLYPHS.length]}
                      fill="none"
                      stroke={i % 3 === 0 ? "#ffd27a" : "#ff6a5a"}
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  <animateMotion dur={`${r.dur}s`} begin={`${(-i * r.dur) / N}s`} repeatCount="indefinite" path={path} />
                </g>
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
