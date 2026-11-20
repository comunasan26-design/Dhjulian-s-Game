"use client";

import { CARD_DEFS } from "@/game/catalog";
import { FlipCard } from "../art/zoom";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useGame } from "./GameContext";
import { flowAbility } from "./flows";
import { usePicker } from "./Picker";

export interface CurseRef {
  playerId: string;
  curseId: string;
}

/** Mostra uma maldição ativa (carta + o que faz) e as habilidades que podem removê-la ou passá-la. */
export function CurseInspector({ target, onClose }: { target: CurseRef | null; onClose: () => void }) {
  const api = useGame();
  const picker = usePicker();
  if (!target) return null;
  const owner = api.view.players.find((p) => p.id === target.playerId);
  const curse = owner?.curses.find((c) => c.id === target.curseId);
  if (!owner || !curse) return null;
  const d = CARD_DEFS[curse.defId];
  const mine = owner.id === api.me.id;
  const options = api.view.abilities.flatMap((ab) => {
    if (ab.acao === "curar")
      return [{ ab, label: `Remover com ${ab.name}`, preset: { player: owner.id, mode: "curse", curse: curse.id } }];
    if (ab.acao === "passarMaldicao" && mine) return [{ ab, label: `Passar para outro com ${ab.name}`, preset: { curse: curse.id } }];
    return [];
  });
  return (
    <Modal open title={`🕯️ ${curse.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {d && (
          <div className="mx-auto shrink-0">
            <FlipCard key={curse.id} d={d} className="w-[9rem] sm:w-[11rem]" />
            <p className="mt-1 text-center text-[10px] text-muted">toque para virar</p>
          </div>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted">
            Maldição ativa em {mine ? "você" : owner.name}
          </p>
          {d && "text" in d && <p className="mt-2">{d.text}</p>}
          {!d && <p className="mt-2">{curse.name}</p>}
          {curse.remaining !== undefined && <p className="mt-2 text-gold-2">Ainda dura {curse.remaining} turno(s) de {mine ? "você" : owner.name}.</p>}
          {curse.value !== undefined && <p className="mt-1 text-muted">Valor: {curse.value}</p>}
        </div>
      </div>
      {options.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-edge pt-3">
          {options.map(({ ab, label, preset }) => (
            <div key={ab.key} className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                disabled={!ab.available || api.busy}
                onClick={async () => {
                  onClose();
                  await flowAbility(api, picker, ab, preset);
                }}
              >
                ✴️ {label}
              </Button>
              <span className="text-xs text-muted">{ab.available ? ab.costText : ab.reason}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
