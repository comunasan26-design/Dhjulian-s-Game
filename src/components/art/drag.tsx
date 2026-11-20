"use client";

/**
 * Arrastar cartas (mouse e toque) para jogá-las: solte sobre uma área marcada com `data-drop`.
 * Valores de data-drop: "table" (mesa/combate), "player:<id>", "monster:<cardId>", "discard".
 */
import { useRef, useSyncExternalStore } from "react";
import { CARD_DEFS } from "@/game/catalog";
import { sfx } from "@/lib/audio/sound";
import { CardFront, type CardInstInfo } from "./CardArt";

export type DropTarget = { kind: "table" } | { kind: "discard" } | { kind: "player"; id: string } | { kind: "monster"; id: string };

interface DragState {
  cardId: string;
  defId: string;
  inst?: CardInstInfo;
  x: number;
  y: number;
  w: number;
}

let drag: DragState | null = null;
let handler: ((cardId: string, target: DropTarget) => void) | null = null;
let overEl: Element | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** O tabuleiro registra o que fazer quando uma carta é solta. */
export function setDropHandler(h: typeof handler) {
  handler = h;
}

function parseDrop(v: string | null): DropTarget | null {
  if (!v) return null;
  if (v === "table" || v === "discard") return { kind: v };
  const [k, id] = v.split(":");
  if ((k === "player" || k === "monster") && id) return { kind: k, id };
  return null;
}

function dropElAt(x: number, y: number): Element | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const z = el.closest("[data-drop]");
    if (z) return z;
  }
  return null;
}

function setOver(el: Element | null) {
  if (el === overEl) return;
  overEl?.classList.remove("drop-over");
  overEl = el;
  overEl?.classList.add("drop-over");
}

function finish(x: number | null, y: number | null) {
  const d = drag;
  drag = null;
  setOver(null);
  document.body.classList.remove("card-dragging");
  emit();
  if (!d || x === null || y === null) return;
  const target = parseDrop(dropElAt(x, y)?.getAttribute("data-drop") ?? null);
  if (target && handler) {
    sfx("play");
    handler(d.cardId, target);
  }
}

/**
 * Handlers de ponteiro para tornar uma carta arrastável. No toque, só começa a arrastar se o dedo
 * subir (para cima), assim o gesto lateral continua rolando a fileira de cartas.
 */
export function useDraggable(cardId: string | undefined, defId: string | undefined, inst: CardInstInfo | undefined, enabled: boolean, onStart: () => void) {
  const origin = useRef<{ x: number; y: number; pid: number; touch: boolean; w: number } | null>(null);
  const active = useRef(false);
  const fired = useRef(false);
  if (!enabled || !cardId || !defId) return { handlers: {}, consumed: () => false };
  return {
    consumed: () => {
      if (!fired.current) return false;
      fired.current = false;
      return true;
    },
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        origin.current = { x: e.clientX, y: e.clientY, pid: e.pointerId, touch: e.pointerType !== "mouse", w: e.currentTarget.getBoundingClientRect().width };
        active.current = false;
      },
      onPointerMove: (e: React.PointerEvent) => {
        const o = origin.current;
        if (!o) return;
        const dx = e.clientX - o.x;
        const dy = e.clientY - o.y;
        if (!active.current) {
          if (Math.abs(dx) + Math.abs(dy) < 10) return;
          if (o.touch && !(dy < -8 && Math.abs(dy) > Math.abs(dx))) {
            origin.current = null; // gesto lateral: deixa rolar
            return;
          }
          active.current = true;
          try {
            e.currentTarget.setPointerCapture(o.pid);
          } catch {
            /* ignora */
          }
          onStart();
          drag = { cardId, defId, inst, x: e.clientX, y: e.clientY, w: Math.max(o.w, 110) };
          document.body.classList.add("card-dragging");
          sfx("pickup");
        }
        if (drag) {
          drag = { ...drag, x: e.clientX, y: e.clientY };
          setOver(dropElAt(e.clientX, e.clientY));
          emit();
        }
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (active.current) {
          fired.current = true;
          finish(e.clientX, e.clientY);
        }
        origin.current = null;
        active.current = false;
      },
      onPointerCancel: () => {
        if (active.current) finish(null, null);
        origin.current = null;
        active.current = false;
      },
    },
  };
}

/** Carta "fantasma" que segue o ponteiro durante o arraste. Montada uma vez no layout. */
export function DragGhost() {
  const d = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => drag,
    () => null,
  );
  if (!d) return null;
  const def = CARD_DEFS[d.defId];
  if (!def) return null;
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[70] aspect-[5/7]"
      style={{ width: d.w, transform: `translate(${d.x - d.w / 2}px, ${d.y - d.w * 0.9}px) rotate(-4deg) scale(1.06)` }}
    >
      <div className="relative h-full w-full drop-shadow-[0_18px_22px_rgba(0,0,0,0.7)]">
        <CardFront d={def} inst={d.inst} size="md" />
      </div>
    </div>
  );
}
