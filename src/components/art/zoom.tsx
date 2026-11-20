"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CARD_DEFS, type CardDef } from "@/game/catalog";
import { fullText } from "@/game/display";
import { sfx } from "@/lib/audio/sound";
import { CardBackText, CardFront, type CardInstInfo } from "./CardArt";
import { RuneHalo } from "./RuneHalo";
import { METAL_OF, rarityOf } from "./metals";

// ---------------------------------------------------------------------------
// Estado global da carta "erguida" (segurar a carta abre o zoom)
// ---------------------------------------------------------------------------

export interface ZoomPayload {
  defId: string;
  inst?: CardInstInfo;
  extra?: string[];
}

let current: ZoomPayload | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openZoom(p: ZoomPayload) {
  current = p;
  sfx("pickup");
  emit();
}
export function closeZoom() {
  current = null;
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Linhas extras do verso (runas, cargas, reforjada…). */
export function instLines(inst: CardInstInfo | undefined, runeName: (id: string) => string): string[] {
  if (!inst) return [];
  const out: string[] = [];
  if (inst.reforged) out.push(`⚒️ Reforjada (+${Number(inst.reforged) || 1})`);
  if (inst.artificeSecond) out.push("½ No slot extra do Artífice (metade do bônus)");
  if (inst.charges !== undefined) out.push(`Cargas: ${inst.charges}`);
  if (inst.runes?.length) out.push(`ᚱ Runas encaixadas: ${inst.runes.map(runeName).join(", ")}`);
  return out;
}

// ---------------------------------------------------------------------------
// Segurar (long-press) — também abre com o botão direito do mouse
// ---------------------------------------------------------------------------

export function useHold(onHold: (() => void) | null, ms = 420) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [holding, setHolding] = useState(false);
  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    setHolding(false);
  }, []);
  useEffect(() => clear, [clear]);
  if (!onHold) return { holding: false, handlers: {}, consumed: () => false };
  return {
    holding,
    consumed: () => {
      if (!fired.current) return false;
      fired.current = false;
      return true;
    },
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        setHolding(true);
        timer.current = window.setTimeout(() => {
          fired.current = true;
          timer.current = null;
          setHolding(false);
          onHold();
        }, ms);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!start.current) return;
        if (Math.abs(e.clientX - start.current.x) + Math.abs(e.clientY - start.current.y) > 12) clear();
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        clear();
        onHold();
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Carta que vira (frente/verso) com inclinação seguindo o ponteiro
// ---------------------------------------------------------------------------

export function FlipCard({
  d,
  inst,
  extra = [],
  className = "w-[min(78vw,19rem)]",
  startFlipped = false,
  lift = false,
}: {
  d: CardDef;
  inst?: CardInstInfo;
  extra?: string[];
  className?: string;
  startFlipped?: boolean;
  lift?: boolean;
}) {
  const [flipped, setFlipped] = useState(startFlipped);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const metal = METAL_OF[rarityOf(d)];
  return (
    <div className={`card-3d ${lift ? "card-lift" : ""} ${className}`}>
      <button
        type="button"
        aria-label={flipped ? "Ver a frente da carta" : "Virar a carta para ver o que ela faz"}
        onClick={(e) => {
          e.stopPropagation();
          setFlipped((f) => !f);
          sfx("flip");
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -10, y: ((e.clientX - r.left) / r.width - 0.5) * 12 });
        }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className="block w-full"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: "transform 120ms ease-out", transformStyle: "preserve-3d" }}
      >
        <div className={`card-flipper aspect-[5/7] w-full ${flipped ? "flipped" : ""}`}>
          <div className={`card-side rounded-[6.4%/4.6%] shadow-[0_14px_34px_rgba(0,0,0,0.65)] ${metal === "negro" ? "ring-1 ring-red-900/60" : ""}`}>
            <CardFront d={d} inst={inst} size="lg" />
            {(inst?.runes?.length ?? 0) > 0 && <RuneHalo count={inst!.runes!.length} />}
          </div>
          <div className="card-side back rounded-[6.4%/4.6%] shadow-[0_14px_34px_rgba(0,0,0,0.65)]">
            <CardBackText d={d} lines={[...fullText(d), ...extra]} />
          </div>
        </div>
      </button>
    </div>
  );
}

/** Sobreposição da carta erguida. Montada uma vez no layout. */
export function CardZoomHost() {
  const z = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  useEffect(() => {
    if (!z) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeZoom();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [z]);
  if (!z) return null;
  const d = CARD_DEFS[z.defId];
  if (!d) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/70 p-4 backdrop-blur-[2px]" onClick={closeZoom}>
      <FlipCard key={z.defId + JSON.stringify(z.inst ?? {})} d={d} inst={z.inst} extra={z.extra} lift />
      <p className="text-center text-xs text-muted">Toque na carta para virar · toque fora para soltar</p>
    </div>
  );
}
