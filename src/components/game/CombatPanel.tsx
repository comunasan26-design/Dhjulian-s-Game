"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { CardView } from "./CardView";
import { useGame } from "./GameContext";
import { flowAskHelp, flowOfferHelp, pickFailedRoll } from "./flows";
import { usePicker } from "./Picker";
import { Countdown } from "./useClock";

const DISPENSE: Record<string, { label: string; can: (race: string | null, classes: string[]) => boolean; discard: boolean }> = {
  "monster.goblin": { label: "Dispensar (primo Goblin)", can: (r) => r === "goblin", discard: false },
  "monster.urso-coruja": { label: "Dispensar (Druida)", can: (_r, c) => c.includes("druida"), discard: true },
  "monster.gigante-colinas": { label: "Dispensar (primo Gigante)", can: (r) => r === "gigante", discard: true },
  "monster.elemental-fogo": { label: "Dispensar (parente Elemental)", can: (r) => r === "elemental", discard: true },
  "monster.vampiro": { label: "Dispensar (Vampírico)", can: (r) => r === "vampirico", discard: false },
  "monster.solar": { label: "Dispensar e subir 1 nível", can: (r, c) => r === "divino" || c.includes("paladino"), discard: false },
};

export function CombatPanel() {
  const api = useGame();
  const picker = usePicker();
  const { view, me } = api;
  const c = view.combat!;
  const calc = c.calc;
  const [showCalc, setShowCalc] = useState(false);
  const fighter = view.players.find((p) => p.id === c.fighterId)!;
  const isFighter = me.id === c.fighterId;
  const side = calc?.side ?? [];
  const onSide = side.includes(me.id);
  const victims = c.victims ?? [];
  const hasItem = (id: string) => me.equipped.some((x) => view.cards[x]?.defId === id);

  return (
    <section className="rounded-xl border-2 border-red-900/70 bg-gradient-to-b from-red-950/40 to-panel p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-red-200 sm:text-xl">
          ⚔️ Combate de {fighter.name}
          {c.helperId && (
            <span className="ml-2 text-sm text-muted">
              {c.helperTraitor || !side.includes(c.helperId) ? "· ajudante virou contra! " : "· com ajuda de "}
              {api.playerName(c.helperId)}
              {c.helperForced ? " (forçado, sem tesouro)" : c.helperDeal && c.helperDeal.count > 0 ? ` (${c.helperDeal.count} tesouro(s))` : ""}
            </span>
          )}
        </h2>
        {c.stage === "resolving" && c.resolveDeadline && (
          <span className="rounded-full bg-gold/20 px-3 py-1 text-sm text-gold-2">
            Vitória em <Countdown deadline={c.resolveDeadline} /> — última chance de interferir!
          </span>
        )}
        {c.stage === "badstuff" && c.flee && (
          <span className="rounded-full bg-blood/30 px-3 py-1 text-sm text-red-200">
            Coisas Ruins em <Countdown deadline={c.flee.deadline} />
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3">
        {/* Lado dos jogadores */}
        <div className="rounded-lg border border-edge bg-panel-2/60 p-2">
          <p className="text-xs uppercase tracking-wide text-muted">Jogadores</p>
          <p className="font-display text-3xl text-sky-300 sm:text-4xl">{calc?.playerTotal ?? "?"}</p>
          <p className="truncate text-xs sm:text-sm">{side.map((id) => api.playerName(id)).join(" + ")}</p>
          {c.allies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {c.allies.map((a) => (
                <CardView key={a.cardId} id={a.cardId} size="sm" badge="aliado" />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center">
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-bold sm:px-3 sm:text-sm ${calc?.winning ? "bg-emerald-700 text-white" : "bg-red-800 text-white"}`}
          >
            {calc?.winning ? "VENCENDO" : "PERDENDO"}
          </span>
        </div>
        {/* Monstros */}
        <div className="rounded-lg border border-edge bg-panel-2/60 p-2">
          <p className="text-xs uppercase tracking-wide text-muted">Monstros</p>
          <p className="font-display text-3xl text-red-300 sm:text-4xl">{calc?.monsterTotal ?? "?"}</p>
          {(calc?.monsterSide.length ?? 0) > 0 && (
            <p className="text-xs text-red-300">Lutando pelo monstro: {calc!.monsterSide.map((id) => api.playerName(id)).join(", ")}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {c.monsters.map((m) => {
          const total = calc?.monsters.find((x) => x.cardId === m.cardId)?.total;
          const d = api.def(m.cardId);
          const dispense = d ? DISPENSE[d.id] : undefined;
          return (
            <div key={m.cardId} className="flex flex-col items-center gap-1">
              <CardView id={m.cardId} badge={m.defeated ? "morto" : total !== undefined ? `força ${total}` : undefined} dim={m.defeated} />
              <div className="flex flex-wrap justify-center gap-1 text-[10px]">
                {m.wandering && <span className="rounded bg-rose-900 px-1">errante</span>}
                {m.ignoreSpecial && <span className="rounded bg-stone-700 px-1">sem Especial</span>}
                {m.petrified && <span className="rounded bg-stone-700 px-1">petrificou</span>}
                {m.ettinFight && <span className="rounded bg-stone-700 px-1">cabeças brigando</span>}
              </div>
              {isFighter && dispense && dispense.can(me.raceId, me.classIds) && !m.ignoreSpecial && c.stage !== "badstuff" && (
                <Button
                  size="sm"
                  onClick={async () => {
                    let discardId: string | undefined;
                    if (dispense.discard) {
                      const v = await picker.pick({
                        title: "Descarte 1 carta",
                        options: (me.hand ?? []).map((id) => ({ value: id, label: id, card: id })),
                      });
                      if (!v) return;
                      discardId = v;
                    }
                    await api.act({ type: "DISPENSE", monsterId: m.cardId, discardId });
                  }}
                >
                  {dispense.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <button className="mt-2 text-xs text-muted underline" onClick={() => setShowCalc((s) => !s)}>
        {showCalc ? "Esconder cálculo" : "Ver cálculo detalhado"}
      </button>
      {showCalc && calc && (
        <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
          <ul className="space-y-0.5">
            {calc.playerLines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="text-muted">{l.label}</span>
                <span className={l.value < 0 ? "text-red-300" : "text-sky-300"}>{l.value >= 0 ? `+${l.value}` : l.value}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-0.5">
            {calc.monsterLines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="whitespace-pre text-muted">{l.label}</span>
                <span className={l.value < 0 ? "text-sky-300" : "text-red-300"}>{l.value >= 0 ? `+${l.value}` : l.value}</span>
              </li>
            ))}
          </ul>
          {onSide && (
            <ul className="space-y-0.5 sm:col-span-2">
              {c.fleePreview
                .filter((f) => f.playerId === me.id)
                .map((f, i) => (
                  <li key={i} className="text-muted">
                    Fugir de {api.name(f.monsterCardId)}:{" "}
                    {f.impossible ? (
                      <span className="text-red-300">impossível ({f.impossible})</span>
                    ) : f.auto ? (
                      <span className="text-emerald-300">automático ({f.auto})</span>
                    ) : (
                      <span className="text-ink">
                        1d6 {f.bonus >= 0 ? "+" : ""}
                        {f.bonus} ≥ 5
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {/* Resultado da fuga */}
      {c.flee && (
        <div className="mt-3 rounded-lg border border-blood/50 bg-blood/10 p-2 text-sm">
          <p className="mb-1 font-medium text-red-200">Fuga:</p>
          <ul className="space-y-0.5">
            {c.flee.results.map((r, i) => (
              <li key={i}>
                {r.success ? "🏃" : "❌"} {api.playerName(r.playerId)} vs {api.name(r.monsterCardId)}
                {r.roll > 0 && ` — tirou ${r.roll} (bônus ${r.bonus >= 0 ? "+" : ""}${r.bonus})`}
                {r.note && <span className="text-muted"> · {r.note}</span>}
                {c.flee!.substitutes[r.playerId] && <span className="text-sky-300"> · protegido por {api.playerName(c.flee!.substitutes[r.playerId])}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">
            Aguardando: {victims.filter((v) => !c.flee!.confirmed.includes(v)).map((v) => api.playerName(v)).join(", ") || "—"}
          </p>
        </div>
      )}

      {/* Ações */}
      <div className="mt-3 flex flex-wrap gap-2">
        {isFighter && c.stage === "fight" && (
          <>
            <Button variant="success" disabled={!calc?.winning || api.busy} onClick={() => api.act({ type: "RESOLVE" })}>
              ⚔️ Atacar!
            </Button>
            <Button variant="danger" disabled={api.busy} onClick={() => api.act({ type: "FLEE" })}>
              🏃 Fugir / desistir
            </Button>
            {!c.helperId && (
              <Button onClick={() => flowAskHelp(api, picker)} disabled={api.busy}>
                🙏 Pedir ajuda
              </Button>
            )}
            {c.monsters.some((m) => api.def(m.cardId)?.id === "monster.glabrezu" && !m.ignoreSpecial) && !c.glabrezuAccepted && (
              <Button onClick={() => api.act({ type: "ACCEPT_WISH" })}>😈 Aceitar o desejo (+1 nível, monstro +10)</Button>
            )}
          </>
        )}
        {isFighter && c.stage === "resolving" && (
          <Button variant="danger" onClick={() => api.act({ type: "FLEE" })}>
            🏃 Desistir e fugir
          </Button>
        )}
        {!onSide && c.stage !== "badstuff" && !c.helperId && !c.desafio && (
          <Button onClick={() => flowOfferHelp(api, picker)} disabled={api.busy}>
            🤚 Oferecer ajuda
          </Button>
        )}
        {!onSide && c.stage === "resolving" && !c.passed.includes(me.id) && (
          <Button variant="primary" onClick={() => api.act({ type: "PASS" })}>
            ✅ Deixar passar
          </Button>
        )}
        {!onSide && me.raceId === "elfo" && hasItem("item.arco-elfico") && !c.bowUsedBy.includes(me.id) && c.stage !== "badstuff" && (
          <Button onClick={() => api.act({ type: "ARCO" })}>🏹 Atirar com o Arco Élfico</Button>
        )}
        {onSide && hasItem("item.dragao-bebe") && !c.breathUsedBy.includes(me.id) && c.stage !== "badstuff" && (
          <Button onClick={() => api.act({ type: "SOPRO" })}>🐲 Sopro do Dragão Bebê (+3 fogo)</Button>
        )}
        {victims.includes(me.id) && c.flee && !c.flee.confirmed.includes(me.id) && (
          <>
            <Button variant="danger" onClick={() => api.act({ type: "ACCEPT_BAD_STUFF" })}>
              ☠️ Aceitar as Coisas Ruins
            </Button>
            {hasItem("item.anel-desejos") && <Button onClick={() => api.act({ type: "WISH_RING" })}>💍 Gastar um desejo</Button>}
            {hasItem("item.cajado-arquimago") && !c.rerolled.includes(`${me.id}:cajado`) && (
              <Button
                onClick={async () => {
                  const idx = await pickFailedRoll(api, picker);
                  if (idx !== null) await api.act({ type: "REROLL", index: idx, source: "cajado" });
                }}
              >
                🎲 Rerrolar (Cajado)
              </Button>
            )}
            {[...(me.hand ?? []), ...me.carried].some((id) => view.cards[id]?.defId === "misc.dado-viciado") && (
              <Button
                onClick={async () => {
                  const idx = await pickFailedRoll(api, picker);
                  if (idx !== null) await api.act({ type: "REROLL", index: idx, source: "dado" });
                }}
              >
                🎲 Dado Viciado
              </Button>
            )}
          </>
        )}
      </div>
      {c.screamerFor === me.id && (
        <p className="mt-2 text-sm text-gold-2">📣 O Cogumelo gritou para você: clique em um monstro da sua mão para colocá-lo no combate.</p>
      )}
      {c.desafio && <p className="mt-2 text-sm text-gold-2">⚔️ Desafio! Ninguém mais pode jogar cartas neste combate.</p>}
    </section>
  );
}
