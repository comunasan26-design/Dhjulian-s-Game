"use client";

import type { Slot } from "@/game/catalog";
import { SLOT_LABEL } from "@/game/catalog";
import { Button } from "../ui/Button";
import { CardView } from "./CardView";
import { useGame } from "./GameContext";
import { flowAbility } from "./flows";
import { usePicker } from "./Picker";
import { LevelBadge } from "./PlayerPanel";

const SLOT_ORDER: Slot[] = ["head", "chest", "legs", "feet", "hand", "neck", "ring", "mount"];

export function MyArea() {
  const api = useGame();
  const picker = usePicker();
  const { me, view } = api;
  const hand = me.hand ?? [];
  const bySlot = (slot: Slot) =>
    me.equipped.filter((id) => {
      const inst = view.cards[id];
      if (inst?.tamed) return slot === "mount";
      const d = api.def(id);
      return d?.kind === "item" && d.slot === slot;
    });
  const otherEquipped = me.equipped.filter((id) => {
    const d = api.def(id);
    return !(d?.kind === "item" || view.cards[id]?.tamed);
  });

  return (
    <section className="rounded-xl border border-gold/40 bg-panel p-3">
      <div className="flex flex-wrap items-center gap-3">
        <LevelBadge level={me.level} />
        <div>
          <p className="font-display text-lg text-gold-2">{me.name}</p>
          <p className="text-xs text-muted">
            Força {me.power} · mão {hand.length}/{me.handLimit}
            {me.streak > 0 && ` · Fúria ${me.streak}`}
            {me.hibernating && " · 🐢 no casco"}
            {me.ambushCount > 0 && ` · ⚠️ ${me.ambushCount} emboscada(s) na próxima porta`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {me.curses.map((c) => (
            <span key={c.id} className="rounded bg-purple-900/80 px-2 py-0.5 text-xs text-purple-100">
              🕯️ {c.name}
              {c.remaining !== undefined ? ` (${c.remaining} turno(s))` : ""}
            </span>
          ))}
          {me.pendingCombatCurses.map((id) => (
            <span key={id} className="rounded bg-purple-900/50 px-2 py-0.5 text-xs">
              ⏳ {api.name(id)} (próximo combate)
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[auto_1fr]">
        {/* Raça, classe e habilidades */}
        <div className="min-w-0 space-y-2 xl:w-[19rem]">
          <div className="flex flex-wrap gap-2">
            {me.race ? <CardView id={me.race} size="sm" /> : <span className="text-xs text-muted">Sem raça</span>}
            {me.classes.map((c) => (
              <CardView key={c} id={c} size="sm" />
            ))}
          </div>
          <div className="space-y-1">
            {view.abilities.map((ab) => (
              <div key={ab.key} className="flex min-w-0 items-center gap-2">
                <Button
                  size="sm"
                  variant={ab.available ? "primary" : "secondary"}
                  disabled={!ab.available || api.busy}
                  title={ab.text}
                  onClick={() => flowAbility(api, picker, ab)}
                  className="min-w-[9rem] shrink-0 justify-start"
                >
                  ✴️ {ab.name}
                </Button>
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted" title={ab.reason ?? ab.costText}>
                  {ab.reason ?? ab.costText}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Equipamento */}
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-muted">Equipado</p>
          <div className="flex flex-wrap gap-2">
            {SLOT_ORDER.map((slot) => {
              const items = bySlot(slot);
              if (items.length === 0) return null;
              return (
                <div key={slot} className="rounded-lg border border-edge/70 p-1">
                  <p className="px-1 text-[10px] uppercase text-muted">{SLOT_LABEL[slot]}</p>
                  <div className="flex gap-1">
                    {items.map((id) => (
                      <CardView key={id} id={id} />
                    ))}
                  </div>
                </div>
              );
            })}
            {otherEquipped.map((id) => (
              <CardView key={id} id={id} />
            ))}
            {me.equipped.length === 0 && <p className="text-sm text-muted">Nada equipado. Clique em um item da mão para equipar.</p>}
          </div>
          {me.carried.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-xs uppercase tracking-wide text-muted">Na mesa (não equipado)</p>
              <div className="flex flex-wrap gap-2">
                {me.carried.map((id) => (
                  <CardView key={id} id={id} size="sm" />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs uppercase tracking-wide text-muted">
          Sua mão ({hand.length}) — clique numa carta para ver as ações
        </p>
        <div className="scroll-thin flex gap-2 overflow-x-auto pb-2" data-zone="hand">
          {hand.map((id) => (
            <CardView key={id} id={id} />
          ))}
          {hand.length === 0 && <p className="text-sm text-muted">Sem cartas na mão.</p>}
        </div>
      </div>
    </section>
  );
}

/** Mão compacta para o celular, mostrada na aba da mesa (útil durante combates). */
export function MobileHand() {
  const { me } = useGame();
  const hand = me.hand ?? [];
  if (hand.length === 0) return null;
  return (
    <section className="rounded-xl border border-edge bg-panel p-2 lg:hidden">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">Sua mão ({hand.length}) — toque para usar</p>
      <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">
        {hand.map((id) => (
          <CardView key={id} id={id} size="sm" />
        ))}
      </div>
    </section>
  );
}
