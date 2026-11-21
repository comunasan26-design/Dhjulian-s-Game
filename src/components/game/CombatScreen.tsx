"use client";

import { type ReactNode, useState } from "react";
import { findFx, fxOf } from "@/game/catalog";
import { fullText } from "@/game/display";
import type { GameView, PlayerView } from "@/game/engine";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SoundToggle } from "../fx/GameFx";
import { CardView } from "./CardView";
import { type GameApi, useGame } from "./GameContext";
import { cardOptions, flowAbility, flowAskHelp, flowOfferHelp, pickFailedRoll } from "./flows";
import { usePicker } from "./Picker";
import { LevelBadge } from "./PlayerPanel";
import { Countdown } from "./useClock";

type Combat = NonNullable<GameView["combat"]>;
type PromptV = GameView["prompts"][number];

const MODE_LABEL: Record<string, string> = {
  random: "sorteio entre os tesouros",
  fighter: "quem luta escolhe quais",
  helper: "o ajudante escolhe primeiro",
};

/** Tipos de pedido que a tela de batalha mostra como balões (e o painel de decisões esconde). */
export const COMBAT_BUBBLE_KINDS = new Set(["helpOffer", "threat", "helpRequest"]);

/** Está do lado dos jogadores (lutando ou ajudando)? Muda a visão da tela de batalha. */
export function combatRole(view: GameView): "side" | "spectator" | null {
  const c = view.combat;
  if (!c) return null;
  const side = c.calc?.side ?? [c.fighterId, ...(c.helperId ? [c.helperId] : [])];
  return side.includes(view.me) ? "side" : "spectator";
}

/** Cartas da mão (e poções na mesa) que dá para usar num combate. */
function combatCards(api: GameApi): { usable: string[]; rest: string[] } {
  const { me, view } = api;
  const c = view.combat!;
  const hand = me.hand ?? [];
  const hasWandering = hand.some((id) => api.def(id)?.kind === "wandering");
  const ok = (id: string, fromHand: boolean) => {
    const d = api.def(id);
    if (!d) return false;
    if (d.kind === "potion") return true;
    if (d.kind === "misc") return !d.permanent && !findFx(d.id, "kitLadrao");
    if (!fromHand) return false;
    if (d.kind === "curse" || d.kind === "monsterBonus" || d.kind === "wandering") return true;
    if (d.kind === "monster") return hasWandering || c.screamerFor === me.id;
    return false;
  };
  const usable = [...hand.filter((id) => ok(id, true)), ...me.carried.filter((id) => ok(id, false))];
  return { usable, rest: hand.filter((id) => !usable.includes(id)) };
}

// ----------------------------------------------------------------------------
// Peças
// ----------------------------------------------------------------------------

/** Balão de fala ao lado do nome: azul = ajuda, roxo = ameaça, verde = deixou passar, cinza = aguardando. */
function Bubble({ tone, icon, label, onClick }: { tone: "blue" | "purple" | "green" | "gray"; icon: string; label: string; onClick?: () => void }) {
  const color = {
    blue: "border-sky-400 bg-sky-950 text-sky-100",
    purple: "border-purple-400 bg-purple-950 text-purple-100",
    green: "border-emerald-400 bg-emerald-950 text-emerald-100",
    gray: "border-stone-500 bg-stone-900 text-stone-200",
  }[tone];
  const cls = `combat-bubble relative inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[11px] font-medium leading-tight ${color} ${
    onClick ? "cursor-pointer hover:brightness-125" : ""
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} title={label}>
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  ) : (
    <span className={cls} title={label}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

function Strength({ value, tone, label }: { value: number | string; tone: "player" | "monster"; label: string }) {
  return (
    <div className="text-center leading-none">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`font-display text-3xl sm:text-4xl ${tone === "player" ? "text-sky-300" : "text-red-300"}`}>{value}</p>
    </div>
  );
}

/** Placar do meio: força dos dois lados, quem está vencendo e os prazos. */
function Scoreboard({ c, compact = false }: { c: Combat; compact?: boolean }) {
  const calc = c.calc;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-1">
      {!compact && <Strength value={calc?.playerTotal ?? "?"} tone="player" label="Jogadores" />}
      <div className="flex flex-col items-center gap-1">
        <span className={`rounded-full px-3 py-1 text-xs font-bold text-white sm:text-sm ${calc?.winning ? "bg-emerald-700" : "bg-red-800"}`}>
          {calc?.winning ? "VENCENDO" : "PERDENDO"}
        </span>
        {c.stage === "resolving" && c.resolveDeadline && (
          <span className="text-[11px] text-gold-2">
            ataque em <Countdown deadline={c.resolveDeadline} />
          </span>
        )}
        {c.stage === "badstuff" && c.flee && (
          <span className="text-[11px] text-red-200">
            Coisas Ruins em <Countdown deadline={c.flee.deadline} />
          </span>
        )}
      </div>
      {!compact && <Strength value={calc?.monsterTotal ?? "?"} tone="monster" label="Monstros" />}
    </div>
  );
}

/** Um monstro do combate (clicável para ver detalhes; aceita cartas soltas sobre ele). */
function MonsterCard({ c, cardId, onOpen, size = "md" }: { c: Combat; cardId: string; onOpen: () => void; size?: "sm" | "md" }) {
  const api = useGame();
  const picker = usePicker();
  const { me } = api;
  const m = c.monsters.find((x) => x.cardId === cardId)!;
  const total = c.calc?.monsters.find((x) => x.cardId === cardId)?.total;
  const d = api.def(cardId);
  const isFighter = me.id === c.fighterId;
  const dispFx =
    d && !m.ignoreSpecial
      ? fxOf(d.id).find((f) => {
          if (f.tipo !== "dispensavel") return false;
          const races = (f.racas as string[] | undefined) ?? [];
          const classes = (f.classes as string[] | undefined) ?? [];
          if (!races.length && !classes.length) return true;
          return (me.raceId !== null && races.includes(me.raceId)) || me.classIds.some((k) => classes.includes(k));
        })
      : undefined;
  return (
    <div data-drop={`monster:${cardId}`} className="drop-zone flex flex-col items-center gap-1 rounded-lg p-1">
      <CardView id={cardId} size={size} onClick={onOpen} badge={m.defeated ? "morto" : total !== undefined ? `força ${total}` : undefined} dim={m.defeated} />
      <div className="flex flex-wrap justify-center gap-1 text-[10px]">
        {m.mods.length > 0 && <span className="rounded bg-red-900 px-1">{m.mods.length} carta(s) nele</span>}
        {m.wandering && <span className="rounded bg-rose-900 px-1">errante</span>}
        {m.ignoreSpecial && <span className="rounded bg-stone-700 px-1">sem Especial</span>}
        {m.petrified && <span className="rounded bg-stone-700 px-1">petrificou</span>}
        {m.ettinFight && <span className="rounded bg-stone-700 px-1">cabeças brigando</span>}
      </div>
      {isFighter && dispFx && c.stage !== "badstuff" && (
        <Button
          size="sm"
          onClick={async () => {
            let discardId: string | undefined;
            if (Number(dispFx.descartar ?? 0) > 0) {
              const v = await picker.pick({ title: "Descarte 1 carta", options: cardOptions(me.hand ?? []) });
              if (!v) return;
              discardId = v;
            }
            await api.act({ type: "DISPENSE", monsterId: cardId, discardId });
          }}
        >
          Dispensar
          {typeof dispFx.tesouros === "number" ? ` (+${dispFx.tesouros} tesouro)` : ""}
          {typeof dispFx.niveis === "number" ? ` (+${dispFx.niveis} nível)` : ""}
        </Button>
      )}
    </div>
  );
}

/** Ficha curta de um jogador (nível, força, raça/classe). */
function PlayerChip({ p, extra, onClick, children }: { p: PlayerView; extra?: ReactNode; onClick?: () => void; children?: ReactNode }) {
  const api = useGame();
  const body = (
    <>
      <LevelBadge level={p.level} />
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-medium">
          <span className={`mr-1 inline-block h-2 w-2 rounded-full ${p.online ? "bg-emerald-400" : "bg-stone-600"}`} />
          {p.name}
          {p.id === api.me.id && <span className="text-muted"> (você)</span>}
        </span>
        <span className="block truncate text-[11px] text-muted">
          ⚔️ {p.power} · {p.race ? api.name(p.race) : "Sem raça"}
          {p.classes.length ? ` · ${p.classes.map((c) => api.name(c)).join("/")}` : ""}
        </span>
        {extra}
      </span>
    </>
  );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {onClick ? (
        <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-2 rounded-lg p-1 text-left hover:bg-white/5">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-2 p-1">{body}</div>
      )}
      {children}
    </div>
  );
}

/** Balões de um jogador para mim (ofertas, ameaças, pedidos) + se ele deixou passar. */
function useBubbles(c: Combat) {
  const api = useGame();
  const mine = api.view.prompts.filter((p) => p.playerId === api.me.id && COMBAT_BUBBLE_KINDS.has(p.kind));
  const from = (pr: PromptV): string | null => {
    const d = pr.data ?? {};
    if (pr.kind === "helpOffer") return String(d.helperId);
    if (pr.kind === "threat") return String(d.threatenerId);
    if (pr.kind === "helpRequest") return String(d.fighterId);
    return null;
  };
  const myRequests = api.view.prompts.filter((p) => p.kind === "helpRequest" && c.fighterId === api.me.id);
  return {
    of: (playerId: string) => mine.filter((pr) => from(pr) === playerId),
    waiting: (playerId: string) => myRequests.some((pr) => pr.playerId === playerId),
    passed: (playerId: string) => c.passed.includes(playerId),
  };
}

function BubbleRow({ c, playerId, onOpen }: { c: Combat; playerId: string; onOpen: (pr: PromptV) => void }) {
  const b = useBubbles(c);
  const prs = b.of(playerId);
  return (
    <div className="flex flex-wrap gap-1">
      {prs.map((pr) =>
        pr.kind === "threat" ? (
          <Bubble key={pr.id} tone="purple" icon="😈" label="ameaça" onClick={() => onOpen(pr)} />
        ) : (
          <Bubble key={pr.id} tone="blue" icon={pr.kind === "helpRequest" ? "🙏" : "🤚"} label={pr.kind === "helpRequest" ? "pede ajuda" : "quer ajudar"} onClick={() => onOpen(pr)} />
        ),
      )}
      {b.waiting(playerId) && <Bubble tone="gray" icon="⏳" label="pedido enviado" />}
      {b.passed(playerId) && <Bubble tone="green" icon="✔" label="deixou passar" />}
    </div>
  );
}

/** Pop-up de um balão: ameaça (roxo) ou ajuda (azul), com aceitar e recusar. */
function BubblePopup({ pr, onClose }: { pr: PromptV | null; onClose: () => void }) {
  const api = useGame();
  if (!pr) return null;
  const live = api.view.prompts.find((p) => p.id === pr.id);
  if (!live) return null;
  const d = live.data ?? {};
  const deal = d.deal as { count: number; mode: string } | undefined;
  const dealText = deal && deal.count > 0 ? `${deal.count} tesouro(s) — ${MODE_LABEL[deal.mode] ?? deal.mode}` : "nada (ajuda de graça)";
  const answer = async (accept: boolean) => {
    onClose();
    await api.act({ type: "ANSWER", promptId: live.id, answer: { accept } });
  };
  const free = api.view.combat?.freeTreasures ?? 0;
  let title = "";
  let body: ReactNode = null;
  let canAccept = true;
  if (live.kind === "threat") {
    title = `😈 Ameaça de ${api.playerName(String(d.threatenerId))}`;
    canAccept = Number(d.count) <= free;
    body = (
      <>
        <p>
          <b>{api.playerName(String(d.threatenerId))}</b> ameaça atrapalhar seu combate.
        </p>
        <p className="mt-2 rounded-lg border border-purple-700 bg-purple-950/50 p-2">
          Quer em troca: <b>{String(d.count)} tesouro(s)</b>, pagos só se você vencer. Se aceitar, ele não pode atrapalhar você nesta rodada.
        </p>
        {!canAccept && <p className="mt-2 text-red-300">{free > 0 ? `Você só tem ${free} tesouro(s) livre(s).` : "Todos os seus tesouros já foram prometidos."}</p>}
      </>
    );
  } else if (live.kind === "helpOffer") {
    title = `🤚 ${api.playerName(String(d.helperId))} quer ajudar`;
    body = (
      <>
        <p>
          <b>{api.playerName(String(d.helperId))}</b> se oferece para lutar do seu lado.
        </p>
        <p className="mt-2 rounded-lg border border-sky-700 bg-sky-950/50 p-2">
          Quer em troca: <b>{dealText}</b>.
        </p>
      </>
    );
  } else {
    title = `🙏 ${api.playerName(String(d.fighterId))} pede sua ajuda`;
    body = (
      <>
        <p>
          <b>{api.playerName(String(d.fighterId))}</b> quer que você lute do lado dele.
        </p>
        <p className="mt-2 rounded-lg border border-sky-700 bg-sky-950/50 p-2">
          Oferece: <b>{dealText}</b>.
        </p>
        {Boolean(d.threat) && <p className="mt-2 text-red-300">🔱 Tridente: se recusar, você perde 1 nível!</p>}
      </>
    );
  }
  return (
    <Modal open tone={live.kind === "threat" ? "purple" : "blue"} title={title} onClose={onClose}>
      <div className="text-sm">
        {body}
        <p className="mt-2 text-xs text-muted">
          Responda em <Countdown deadline={live.deadline} />
        </p>
        <div className="mt-3 flex gap-2">
          <Button variant="success" disabled={!canAccept || api.busy} onClick={() => answer(true)}>
            {live.kind === "threat" ? "Aceitar (pagar)" : live.kind === "helpRequest" ? "Aceitar (ajudar)" : "Aceitar"}
          </Button>
          <Button variant="danger" disabled={api.busy} onClick={() => answer(false)}>
            Recusar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ModLine({ label, value, positiveIsGood = true }: { label: string; value: number; positiveIsGood?: boolean }) {
  const good = positiveIsGood ? value >= 0 : value < 0;
  return (
    <li className="flex justify-between gap-2">
      <span className="whitespace-pre-wrap text-muted">{label}</span>
      <span className={good ? "text-sky-300" : "text-red-300"}>{value >= 0 ? `+${value}` : value}</span>
    </li>
  );
}

/** Detalhes de um monstro: a carta, as especificações e tudo o que está dando efeito nele. */
function MonsterDetail({ c, cardId, onClose }: { c: Combat; cardId: string | null; onClose: () => void }) {
  const api = useGame();
  if (!cardId) return null;
  const m = c.monsters.find((x) => x.cardId === cardId);
  const d = api.def(cardId);
  if (!m || !d || d.kind !== "monster") return null;
  const total = c.calc?.monsters.find((x) => x.cardId === cardId)?.total;
  return (
    <Modal open wide title={`👹 ${d.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 justify-center">
          <CardView id={cardId} />
        </div>
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-red-900/70 px-2 py-0.5">Nível {d.level}</span>
            {total !== undefined && <span className="rounded bg-red-800 px-2 py-0.5 font-bold">Força no combate: {total}</span>}
            <span className="rounded bg-amber-900/70 px-2 py-0.5">{d.treasures} tesouro(s)</span>
            <span className="rounded bg-sky-900/70 px-2 py-0.5">+{d.levels} nível(is)</span>
            {d.legendary && <span className="rounded bg-yellow-700 px-2 py-0.5">Lendário</span>}
            {d.cantFlee && <span className="rounded bg-stone-700 px-2 py-0.5">Não dá para fugir</span>}
            {typeof d.fleeMod === "number" && d.fleeMod !== 0 && (
              <span className="rounded bg-stone-700 px-2 py-0.5">
                Fugir {d.fleeMod > 0 ? "+" : ""}
                {d.fleeMod}
              </span>
            )}
            {d.tags.map((t) => (
              <span key={t} className="rounded bg-stone-800 px-2 py-0.5">
                {t}
              </span>
            ))}
          </div>
          {fullText(d).map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Cartas e efeitos neste monstro</p>
            {m.mods.length === 0 && c.monsterSideMods.length === 0 && !m.revealMonster ? (
              <p className="text-xs text-muted">Nada por enquanto.</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-xs">
                {m.revealMonster ? <ModLine label="Ao revelar" value={m.revealMonster} positiveIsGood={false} /> : null}
                {m.mods.map((x) => (
                  <ModLine key={x.id} label={`${x.label}${x.by ? ` — ${api.playerName(x.by)}` : ""}`} value={x.value} positiveIsGood={false} />
                ))}
                {c.monsterSideMods.map((x) => (
                  <ModLine key={x.id} label={`${x.label} (todo o lado do monstro)${x.by ? ` — ${api.playerName(x.by)}` : ""}`} value={x.value} positiveIsGood={false} />
                ))}
              </ul>
            )}
          </div>
          {(c.calc?.monsterSide.length ?? 0) > 0 && (
            <p className="text-xs text-red-300">Lutando pelo monstro: {c.calc!.monsterSide.map((id) => api.playerName(id)).join(", ")}</p>
          )}
          {c.calc && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">Cálculo completo do lado do monstro</summary>
              <ul className="mt-1 space-y-0.5">
                {c.calc.monsterLines.map((l, i) => (
                  <ModLine key={i} label={l.label} value={l.value} positiveIsGood={false} />
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Detalhes do lado dos jogadores (ou de um jogador): itens equipados e o que está fortalecendo. */
function SideDetail({ c, ids, onClose }: { c: Combat; ids: string[] | null; onClose: () => void }) {
  const api = useGame();
  if (!ids) return null;
  const players = ids.map((id) => api.view.players.find((p) => p.id === id)).filter((p): p is PlayerView => !!p);
  const onPlayerSide = ids.some((id) => (c.calc?.side ?? []).includes(id));
  return (
    <Modal open wide title={players.length === 1 ? `🧙 ${players[0].name}` : "🧙 Lado dos jogadores"} onClose={onClose}>
      <div className="space-y-4 text-sm">
        {players.map((p) => (
          <div key={p.id}>
            <PlayerChip p={p} />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {p.race && <CardView id={p.race} size="sm" />}
              {p.classes.map((k) => (
                <CardView key={k} id={k} size="sm" />
              ))}
              {p.equipped.map((id) => (
                <CardView key={id} id={id} size="sm" />
              ))}
              {p.equipped.length === 0 && <p className="self-center text-xs text-muted">Nada equipado.</p>}
            </div>
          </div>
        ))}
        {onPlayerSide && c.allies.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Aliados</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {c.allies.map((a) => (
                <CardView key={a.cardId} id={a.cardId} size="sm" badge="aliado" />
              ))}
            </div>
          </div>
        )}
        {onPlayerSide && c.calc && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">O que está somando na força ({c.calc.playerTotal})</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {c.calc.playerLines.map((l, i) => (
                <ModLine key={i} label={l.label} value={l.value} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Mão de combate: cartas usáveis (arrastáveis), o resto da mão recolhido. */
function CombatHand({ hint }: { hint: string }) {
  const api = useGame();
  const [showRest, setShowRest] = useState(false);
  const { usable, rest } = combatCards(api);
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">Cartas para o combate — {hint}</p>
      <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-2 pb-2 pt-4" data-drop="hand">
        {usable.map((id) => (
          <CardView key={id} id={id} size="sm" draggable />
        ))}
        {usable.length === 0 && <p className="self-center text-xs text-muted">Nenhuma carta de combate na mão.</p>}
      </div>
      {rest.length > 0 && (
        <>
          <button className="text-[11px] text-muted underline" onClick={() => setShowRest((s) => !s)}>
            {showRest ? "Esconder o resto da mão" : `Ver o resto da mão (${rest.length})`}
          </button>
          {showRest && (
            <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-2 pb-2 pt-4">
              {rest.map((id) => (
                <CardView key={id} id={id} size="sm" draggable />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Ativas de raça/classe (e as cartas de raça/classe, que mostram as passivas ao tocar). */
function AbilityBar() {
  const api = useGame();
  const picker = usePicker();
  const { me, view } = api;
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {[me.race, ...me.classes]
        .filter((id): id is string => !!id)
        .map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => api.inspect(id)}
            title="Ver as passivas"
            className="rounded-md border border-gold/40 bg-black/40 px-2 py-1 text-xs text-gold-2 hover:bg-gold/10"
          >
            {api.def(id)?.kind === "race" ? "🧬" : "🎓"} {api.name(id)}
          </button>
        ))}
      <>
        {view.abilities.map((ab) => (
          <Button
            key={ab.key}
            size="sm"
            variant={ab.available ? "primary" : "secondary"}
            disabled={!ab.available || api.busy}
            title={`${ab.text}${ab.reason ? ` — ${ab.reason}` : ab.costText ? ` — ${ab.costText}` : ""}`}
            onClick={() => flowAbility(api, picker, ab)}
          >
            ✴️ {ab.name}
          </Button>
        ))}
        {view.abilities.length === 0 && <p className="self-center text-xs text-muted">Sem habilidades ativas. Toque na raça/classe para ver as passivas.</p>}
      </>
    </div>
  );
}

/** Botões de quem está do lado dos jogadores. */
function FighterActions({ c }: { c: Combat }) {
  const api = useGame();
  const picker = usePicker();
  const { me, view } = api;
  const isFighter = me.id === c.fighterId;
  const victims = c.victims ?? [];
  const hasFx = (tipo: string) => me.equipped.some((x) => !!findFx(view.cards[x]?.defId, tipo));
  return (
    <div className="flex flex-wrap gap-2">
      {isFighter && c.stage === "fight" && (
        <>
          <Button variant="success" size="lg" disabled={!c.calc?.winning || api.busy} onClick={() => api.act({ type: "RESOLVE" })}>
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
          {c.monsters.some((m) => !m.ignoreSpecial && !!findFx(view.cards[m.cardId]?.defId, "desejo")) && !c.glabrezuAccepted && (
            <Button onClick={() => api.act({ type: "ACCEPT_WISH" })}>😈 Aceitar o desejo (+1 nível, monstro +10)</Button>
          )}
        </>
      )}
      {isFighter && c.stage === "resolving" && (
        <Button variant="danger" onClick={() => api.act({ type: "FLEE" })}>
          🏃 Desistir e fugir
        </Button>
      )}
      {hasFx("sopro") && !c.breathUsedBy.includes(me.id) && c.stage !== "badstuff" && (
        <Button onClick={() => api.act({ type: "SOPRO" })}>🐲 Sopro (fogo)</Button>
      )}
      {victims.includes(me.id) && c.flee && !c.flee.confirmed.includes(me.id) && (
        <>
          <Button variant="danger" onClick={() => api.act({ type: "ACCEPT_BAD_STUFF" })}>
            ☠️ Aceitar as Coisas Ruins
          </Button>
          {hasFx("desejos") && <Button onClick={() => api.act({ type: "WISH_RING" })}>💍 Gastar um desejo</Button>}
          {hasFx("rerrolarFuga") && !c.rerolled.includes(`${me.id}:cajado`) && (
            <Button
              onClick={async () => {
                const idx = await pickFailedRoll(api, picker);
                if (idx !== null) await api.act({ type: "REROLL", index: idx, source: "cajado" });
              }}
            >
              🎲 Rerrolar (item equipado)
            </Button>
          )}
          {[...(me.hand ?? []), ...me.carried].some((id) => !!findFx(view.cards[id]?.defId, "rerrolarFuga")) && (
            <Button
              onClick={async () => {
                const idx = await pickFailedRoll(api, picker);
                if (idx !== null) await api.act({ type: "REROLL", index: idx, source: "dado" });
              }}
            >
              🎲 Rerrolar (carta)
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Botões de quem está de fora: ameaçar, oferecer ajuda, deixar passar, atirar de longe. */
function SpectatorActions({ c }: { c: Combat }) {
  const api = useGame();
  const picker = usePicker();
  const { me, view } = api;
  const fighter = view.players.find((p) => p.id === c.fighterId)!;
  const passed = c.passed.includes(me.id);
  const onMonsterSide = (c.calc?.monsterSide ?? []).includes(me.id);
  const bowOk = me.equipped.some((x) => {
    const f = findFx(view.cards[x]?.defId, "atirarDeLonge");
    const races = (f?.racas as string[] | undefined) ?? [];
    return !!f && (races.length === 0 || (me.raceId !== null && races.includes(me.raceId)));
  });
  const live = c.stage !== "badstuff";
  return (
    <div className="flex flex-wrap gap-2">
      {live && !c.desafio && !onMonsterSide && !c.used.includes(`${me.id}:threat`) && c.freeTreasures > 0 && (
        <Button
          className="border-purple-500 bg-purple-900/70 hover:bg-purple-800"
          disabled={api.busy || passed}
          title={passed ? "Você deixou passar: espere o combate mudar" : undefined}
          onClick={async () => {
            const v = await picker.pick({
              title: `Ameaçar atrapalhar ${fighter.name}`,
              description: `Peça tesouros para não atrapalhar. ${fighter.name} tem ${c.freeTreasures} tesouro(s) ainda não prometido(s). Se aceitar, você recebe quando ele vencer e não pode atrapalhá-lo nesta rodada.`,
              options: Array.from({ length: c.freeTreasures }, (_, i) => ({ value: String(i + 1), label: `${i + 1} tesouro(s)` })),
            });
            if (v) await api.act({ type: "THREATEN", count: Number(v) });
          }}
        >
          😈 Ameaçar
        </Button>
      )}
      {live && !c.helperId && !c.desafio && !onMonsterSide && (
        <Button
          className="border-sky-500 bg-sky-900/70 hover:bg-sky-800"
          disabled={api.busy || passed}
          title={passed ? "Você deixou passar: espere o combate mudar" : undefined}
          onClick={() => flowOfferHelp(api, picker)}
        >
          🤚 Pedir para ajudar
        </Button>
      )}
      {live && !passed && (
        <Button variant="primary" disabled={api.busy} onClick={() => api.act({ type: "PASS" })}>
          ✅ Deixar passar
        </Button>
      )}
      {live && bowOk && !c.bowUsedBy.includes(me.id) && <Button onClick={() => api.act({ type: "ARCO" })}>🏹 Atirar de longe</Button>}
      {passed && live && <p className="self-center text-xs text-emerald-300">✔ Você deixou passar. Se o combate mudar, pode agir de novo.</p>}
    </div>
  );
}

/** Resultado da fuga, acordos e avisos do combate. */
function CombatNotes({ c }: { c: Combat }) {
  const api = useGame();
  const { me } = api;
  const fighter = api.view.players.find((p) => p.id === c.fighterId)!;
  const victims = c.victims ?? [];
  const onSide = (c.calc?.side ?? []).includes(me.id);
  return (
    <div className="space-y-2 text-sm">
      {c.flee && (
        <div className="rounded-lg border border-blood/50 bg-blood/10 p-2">
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
      {onSide && c.stage !== "badstuff" && (
        <ul className="space-y-0.5 text-xs text-muted">
          {c.fleePreview
            .filter((f) => f.playerId === me.id)
            .map((f, i) => (
              <li key={i}>
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
      {c.screamerFor === me.id && <p className="text-gold-2">📣 O Cogumelo gritou para você: toque em um monstro da sua mão para colocá-lo no combate.</p>}
      {c.bribes.length > 0 && (
        <p className="text-gold-2">
          🤝 Acordos: {c.bribes.map((b) => `${api.playerName(b.playerId)} recebe ${b.count} tesouro(s) se ${fighter.name} vencer`).join("; ")}
        </p>
      )}
      {c.desafio && <p className="text-gold-2">⚔️ Desafio! Ninguém mais pode jogar cartas neste combate.</p>}
    </div>
  );
}

/** Últimos acontecimentos do combate (para não precisar abrir o histórico). */
function CombatTicker() {
  const { view } = useGame();
  const lines = view.log.filter((l) => l.kind === "combat" || l.kind === "dice" || l.kind === "curse").slice(-3);
  if (!lines.length) return null;
  return (
    <ul className="space-y-0.5 border-t border-white/5 px-3 py-1.5 text-[11px] text-muted">
      {lines.map((l) => (
        <li key={l.id} className="truncate">
          {l.text}
        </li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// As duas visões
// ----------------------------------------------------------------------------

/** Visão de quem está lutando (ou ajudando): monstros em cima, você embaixo, os outros nas laterais. */
function FighterView({ c, openMonster, openPlayers, openBubble }: ViewProps) {
  const api = useGame();
  const picker = usePicker();
  const { view, me } = api;
  const side = c.calc?.side ?? [c.fighterId];
  const monsterSide = c.calc?.monsterSide ?? [];
  const others = view.order.filter((id) => !side.includes(id) && !monsterSide.includes(id)).map((id) => view.players.find((p) => p.id === id)!);
  const isFighter = me.id === c.fighterId;
  const canAsk = isFighter && c.stage === "fight" && !c.helperId;
  const left = others.filter((_, i) => i % 2 === 0);
  const right = others.filter((_, i) => i % 2 === 1);
  const card = (p: PlayerView) => (
    <div key={p.id} data-drop={`player:${p.id}`} className="drop-zone w-[11.5rem] shrink-0 rounded-xl border border-edge bg-black/40 p-1.5 lg:w-auto">
      <PlayerChip p={p} onClick={() => openPlayers([p.id])} />
      <div className="flex flex-wrap items-center gap-1 px-1 pb-1">
        <BubbleRow c={c} playerId={p.id} onOpen={openBubble} />
        {canAsk && !view.prompts.some((pr) => pr.kind === "helpRequest" && pr.playerId === p.id) && (
          <button
            type="button"
            className="rounded-full border border-sky-700 px-2 py-0.5 text-[11px] text-sky-200 hover:bg-sky-900/60"
            onClick={() => flowAskHelp(api, picker, p.id)}
          >
            🙏 pedir ajuda
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[13rem_minmax(0,1fr)_13rem]">
      <div className="hidden min-w-0 flex-col gap-2 lg:flex">{left.map(card)}</div>
      <div className="flex min-w-0 flex-col gap-2">
        {/* Inimigos (em cima) */}
        <div className="rounded-xl border border-red-900/70 bg-gradient-to-b from-red-950/60 to-transparent p-2">
          <div className="flex flex-wrap justify-center gap-2">
            {c.monsters.map((m) => (
              <MonsterCard key={m.cardId} c={c} cardId={m.cardId} onOpen={() => openMonster(m.cardId)} />
            ))}
          </div>
          {monsterSide.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {monsterSide.map((id) => (
                <div key={id} className="rounded-lg border border-red-800 bg-red-950/60 px-1">
                  <PlayerChip p={view.players.find((p) => p.id === id)!} onClick={() => openPlayers([id])} extra={<span className="text-[10px] text-red-300">do lado do monstro</span>} />
                </div>
              ))}
            </div>
          )}
        </div>
        <Scoreboard c={c} />
        {/* no celular, os outros jogadores ficam numa faixa só */}
        {others.length > 0 && <div className="scroll-thin -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 lg:hidden">{others.map(card)}</div>}
      </div>
      <div className="hidden min-w-0 flex-col gap-2 lg:flex">{right.map(card)}</div>

      {/* Seu lado (embaixo) */}
      <div data-drop={`player:${me.id}`} className="drop-zone min-w-0 rounded-xl border border-sky-800/70 bg-gradient-to-t from-sky-950/50 to-transparent p-2 lg:col-span-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="order-3 min-w-0 lg:order-1">
            {[...side].sort((a, b) => Number(b === me.id) - Number(a === me.id)).map((id) => {
              const p = view.players.find((x) => x.id === id)!;
              return (
                <div key={id} className="min-w-0">
                  <PlayerChip p={p} onClick={() => openPlayers([id])} extra={id !== c.fighterId ? <span className="text-[10px] text-sky-300">ajudante</span> : undefined} />
                  <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-2 pb-1 pt-3">
                    {p.equipped.map((eq) => (
                      <CardView key={eq} id={eq} size="sm" draggable={id === me.id} />
                    ))}
                    {p.equipped.length === 0 && <p className="text-xs text-muted">Nada equipado.</p>}
                  </div>
                </div>
              );
            })}
            {c.allies.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {c.allies.map((a) => (
                  <CardView key={a.cardId} id={a.cardId} size="sm" badge="aliado" />
                ))}
              </div>
            )}
          </div>
          <div className="order-1 min-w-0 space-y-2 lg:order-2">
            <FighterActions c={c} />
            <AbilityBar />
          </div>
          <div className="order-2 min-w-0 lg:order-3 lg:col-span-2">
            <CombatHand hint="toque para usar ou arraste para o seu lado / para o monstro" />
          </div>
          <div className="order-4 min-w-0 lg:col-span-2">
            <CombatNotes c={c} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Visão de quem está de fora: o jogador à esquerda, o monstro à direita, você embaixo. */
function SpectatorView({ c, openMonster, openPlayers, openBubble }: ViewProps) {
  const api = useGame();
  const { view, me } = api;
  const side = c.calc?.side ?? [c.fighterId];
  const monsterSide = c.calc?.monsterSide ?? [];
  const fighter = view.players.find((p) => p.id === c.fighterId)!;
  const spectators = view.order.filter((id) => id !== me.id && !side.includes(id)).map((id) => view.players.find((p) => p.id === id)!);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Jogador (esquerda) */}
        <div data-drop={`player:${c.fighterId}`} className="drop-zone rounded-xl border border-sky-800/70 bg-gradient-to-b from-sky-950/60 to-transparent p-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => openPlayers(side)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openPlayers(side)}
            className="w-full cursor-pointer rounded-lg text-left hover:bg-white/5"
          >
            {side.map((id) => {
              const p = view.players.find((x) => x.id === id)!;
              return <PlayerChip key={id} p={p} extra={id !== c.fighterId ? <span className="text-[10px] text-sky-300">ajudante</span> : undefined} />;
            })}
            <div className="mt-1 flex items-end justify-between gap-2 px-1">
              <Strength value={c.calc?.playerTotal ?? "?"} tone="player" label="Força" />
              <span className="text-[11px] text-muted underline">ver itens</span>
            </div>
          </div>
          <div className="mt-1 px-1">
            <BubbleRow c={c} playerId={c.fighterId} onOpen={openBubble} />
          </div>
        </div>
        {/* Monstro (direita) */}
        <div className="rounded-xl border border-red-900/70 bg-gradient-to-b from-red-950/60 to-transparent p-2">
          <div className="flex items-end justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-red-200">{c.monsters.map((m) => api.name(m.cardId)).join(" + ")}</p>
              <p className="text-[11px] text-muted">
                Nível {c.monsters.map((m) => (api.def(m.cardId) as { level?: number } | null)?.level ?? "?").join(" + ")}
              </p>
            </div>
            <Strength value={c.calc?.monsterTotal ?? "?"} tone="monster" label="Força" />
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {c.monsters.map((m) => (
              <MonsterCard key={m.cardId} c={c} cardId={m.cardId} size="sm" onOpen={() => openMonster(m.cardId)} />
            ))}
          </div>
          {monsterSide.length > 0 && <p className="mt-1 text-[11px] text-red-300">Do lado do monstro: {monsterSide.map((id) => api.playerName(id)).join(", ")}</p>}
        </div>
      </div>

      <Scoreboard c={c} compact />
      <p className="-mt-2 text-center text-[11px] text-muted">
        Arraste cartas para o lado de {fighter.name} (ajudar) ou para o monstro (atrapalhar). Toque num lado para ver o que o fortalece.
      </p>

      {spectators.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {spectators.map((p) => (
            <div key={p.id} className="flex items-center gap-1 rounded-full border border-edge bg-black/40 py-0.5 pl-1 pr-2 text-xs">
              <LevelBadge level={p.level} />
              <span className="max-w-[7rem] truncate">{p.name}</span>
              {c.passed.includes(p.id) && <span className="text-emerald-300" title="deixou passar">✔</span>}
            </div>
          ))}
        </div>
      )}

      {/* Você (embaixo) */}
      <div className="rounded-xl border border-gold/40 bg-gradient-to-t from-black/60 to-transparent p-2">
        <PlayerChip p={me} />
        <div className="mt-1 space-y-2">
          <SpectatorActions c={c} />
          <AbilityBar />
          <CombatHand hint="arraste para um lado ou toque para usar" />
          <CombatNotes c={c} />
        </div>
      </div>
    </div>
  );
}

interface ViewProps {
  c: Combat;
  openMonster: (cardId: string) => void;
  openPlayers: (ids: string[]) => void;
  openBubble: (pr: PromptV) => void;
}

/**
 * Tela de batalha: quando um combate começa, a tela escurece, pisca em branco e forma a caixa do combate.
 * Quem luta vê os monstros em cima e o próprio lado embaixo; quem está de fora vê os dois lados e as cartas para interferir.
 * Ao virar ajudante, a tela pisca de novo e passa para a visão de quem luta.
 */
export function CombatScreen({ onMinimize }: { onMinimize: () => void }) {
  const api = useGame();
  const { view } = api;
  const c = view.combat!;
  const role = combatRole(view)!;
  const fighter = view.players.find((p) => p.id === c.fighterId)!;
  const [monster, setMonster] = useState<string | null>(null);
  const [players, setPlayers] = useState<string[] | null>(null);
  const [bubble, setBubble] = useState<PromptV | null>(null);
  const props: ViewProps = { c, openMonster: setMonster, openPlayers: setPlayers, openBubble: setBubble };
  const helper = c.helperId ? api.playerName(c.helperId) : null;

  return (
    <div className="combat-screen fixed inset-0 z-[35] flex items-stretch justify-center p-1.5 sm:p-4" role="dialog" aria-label="Combate">
      {/* o flash se repete quando a visão muda (começo do combate, ou quando você vira ajudante) */}
      <div key={`${c.id}:${role}`} className="combat-flash" aria-hidden />
      <div
        key={`box:${c.id}:${role}`}
        data-drop="table"
        className="combat-box drop-zone relative flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border-2 border-red-900/80 bg-panel shadow-[0_0_60px_rgba(120,20,20,0.45)]"
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-2">
          <h2 className="min-w-0 flex-1 truncate font-display text-base text-red-200 sm:text-xl">
            ⚔️ {role === "side" ? (c.fighterId === api.me.id ? "Você está lutando" : `Você ajuda ${fighter.name}`) : `Combate de ${fighter.name}`}
            {helper && role === "spectator" && <span className="ml-2 text-sm text-muted">com {helper}</span>}
            {helper && role === "side" && c.fighterId === api.me.id && <span className="ml-2 text-sm text-sky-300">com {helper}</span>}
          </h2>
          <SoundToggle />
          <Button size="sm" variant="ghost" onClick={onMinimize} title="Ver a mesa (o combate continua)">
            🗺️ Ver mesa
          </Button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">{role === "side" ? <FighterView {...props} /> : <SpectatorView {...props} />}</div>
        <CombatTicker />
      </div>
      <MonsterDetail c={c} cardId={monster} onClose={() => setMonster(null)} />
      <SideDetail c={c} ids={players} onClose={() => setPlayers(null)} />
      <BubblePopup pr={bubble} onClose={() => setBubble(null)} />
    </div>
  );
}

/** Barra na mesa enquanto a tela de batalha está minimizada. */
export function CombatReturnBar({ onOpen }: { onOpen: () => void }) {
  const { view } = useGame();
  const c = view.combat!;
  const fighter = view.players.find((p) => p.id === c.fighterId)!;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-2 rounded-xl border-2 border-red-900/70 bg-red-950/40 px-3 py-2 text-left"
    >
      <span className="font-display text-red-200">
        ⚔️ {fighter.id === view.me ? "Seu combate" : `Combate de ${fighter.name}`}: {c.calc?.playerTotal ?? "?"} × {c.calc?.monsterTotal ?? "?"}
      </span>
      <span className="rounded-md bg-gold px-2 py-1 text-xs font-medium text-black">Voltar ao combate</span>
    </button>
  );
}
