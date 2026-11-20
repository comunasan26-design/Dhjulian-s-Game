"use client";

import { KIND_LABEL, fullText, shortInfo } from "@/game/display";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { FlipCard, instLines } from "../art/zoom";
import { useGame } from "./GameContext";
import { cardActions } from "./flows";
import { usePicker } from "./Picker";

export function CardInspector({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const api = useGame();
  const picker = usePicker();
  if (!cardId) return null;
  const d = api.def(cardId);
  if (!d) return null;
  const inst = api.view.cards[cardId];
  const actions = cardActions(api, picker, cardId);
  return (
    <Modal open title={d.name} onClose={onClose}>
      <div className="flex gap-4">
        <div className="shrink-0">
          <FlipCard
            key={cardId}
            d={d}
            inst={inst}
            extra={instLines(inst, api.name)}
            className="w-[8.5rem] sm:w-[11rem]"
          />
          <p className="mt-1 text-center text-[10px] text-muted">toque para virar</p>
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted">
            {KIND_LABEL[d.kind]} · {shortInfo(d)}
          </p>
          {fullText(d).map((t, i) => (
            <p key={i} className="mt-2">
              {t}
            </p>
          ))}
          {inst?.reforged && <p className="mt-2 text-gold-2">⚒️ Reforjado (+1)</p>}
          {inst?.artificeSecond && <p className="mt-2 text-sky-300">½ No slot extra do Artífice (metade do bônus)</p>}
          {inst?.charges !== undefined && <p className="mt-2 text-gold-2">Cargas: {inst.charges}</p>}
          {(inst?.runes?.length ?? 0) > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted">Runas:</p>
              <ul className="list-inside list-disc">
                {inst!.runes!.map((r) => (
                  <li key={r}>{api.name(r)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-edge pt-3">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant={a.primary ? "primary" : "secondary"}
              disabled={api.busy}
              onClick={async () => {
                onClose();
                await a.run();
              }}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </Modal>
  );
}
