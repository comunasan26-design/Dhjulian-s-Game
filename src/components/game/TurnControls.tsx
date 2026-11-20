"use client";

import { Button } from "../ui/Button";
import { useGame } from "./GameContext";
import { cardOptions, flowSell, flowTrade } from "./flows";
import { usePicker } from "./Picker";
import { useServerNow } from "./useClock";

const PHASE_LABEL: Record<string, string> = {
  KICK: "Chutar a porta",
  AFTER_DOOR: "Procurar encrenca ou saquear",
  COMBAT: "Combate",
  END: "Fim do turno",
};

export function TurnControls() {
  const api = useGame();
  const picker = usePicker();
  const { view, me } = api;
  const now = useServerNow();
  const myTurn = view.currentPlayerId === me.id;
  const current = view.players.find((p) => p.id === view.currentPlayerId);
  const blocking = view.prompts.some((p) => p.blocking);
  const isOwlin = me.raceId === "owlin";
  const canSkip = !myTurn && current && !current.online && now - view.lastActionAt > 45_000;

  if (view.phase === "SETUP") {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/50 bg-panel p-3">
        <p className="mr-auto text-sm">
          <span className="font-display text-gold-2">Preparação:</span> equipe itens e jogue raça/classe da mão. Depois clique em
          “Estou pronto”.
        </p>
        <Button variant="primary" disabled={me.ready} onClick={() => api.act({ type: "READY" })}>
          {me.ready ? "Aguardando os outros…" : "✅ Estou pronto"}
        </Button>
        {api.isHost && (
          <Button variant="ghost" onClick={() => api.act({ type: "START_NOW" })}>
            Começar agora
          </Button>
        )}
      </div>
    );
  }
  if (view.phase === "FINISHED") return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-panel p-3">
      <div className="mr-auto">
        <p className="text-sm">
          {myTurn ? <span className="font-display text-gold-2">Seu turno</span> : <span>Turno de {current?.name}</span>}
          <span className="text-muted"> · {PHASE_LABEL[view.turnPhase]}</span>
        </p>
        {view.turn.ending && myTurn && <p className="text-xs text-gold">Escolha as cartas da Caridade para encerrar.</p>}
      </div>
      {myTurn && view.turnPhase === "KICK" && (
        <Button variant="primary" size="lg" disabled={api.busy || blocking} onClick={() => api.act({ type: "KICK_DOOR" })}>
          🚪 Chutar a porta
        </Button>
      )}
      {myTurn && isOwlin && ((view.turnPhase === "KICK" && !view.turn.owlStartDone) || (view.turnPhase === "END" && !view.turn.owlEndDone)) && (
        <Button onClick={() => api.act({ type: "OWL_PEEK" })}>🦉 Olhos da Noite</Button>
      )}
      {myTurn && view.turnPhase === "AFTER_DOOR" && (
        <>
          <Button
            disabled={!(me.hand ?? []).some((id) => api.def(id)?.kind === "monster")}
            onClick={async () => {
              const m = await picker.pick({
                title: "Procurar encrenca: escolha um monstro da mão",
                options: cardOptions((me.hand ?? []).filter((id) => api.def(id)?.kind === "monster")),
              });
              if (m) await api.act({ type: "LOOK_FOR_TROUBLE", cardId: m });
            }}
          >
            😤 Procurar encrenca
          </Button>
          <Button variant="primary" onClick={() => api.act({ type: "LOOT_ROOM" })}>
            🎒 Saquear a sala
          </Button>
        </>
      )}
      {myTurn && view.turnPhase === "END" && !view.turn.ending && (
        <Button variant="primary" size="lg" disabled={api.busy || blocking || !!view.reward} onClick={() => api.act({ type: "END_TURN" })}>
          ⏭️ Encerrar turno
        </Button>
      )}
      {myTurn && !view.combat && view.turnPhase !== "COMBAT" && (
        <Button variant="ghost" onClick={() => flowSell(api, picker)}>
          💰 Vender itens
        </Button>
      )}
      {!view.combat && (
        <Button variant="ghost" onClick={() => flowTrade(api, picker)}>
          🤝 Propor troca
        </Button>
      )}
      {canSkip && (
        <Button variant="danger" onClick={() => api.act({ type: "SKIP_AFK" })}>
          ⏭️ Pular {current?.name} (ausente)
        </Button>
      )}
    </div>
  );
}
