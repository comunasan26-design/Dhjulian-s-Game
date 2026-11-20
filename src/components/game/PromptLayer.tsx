"use client";

import type { GameView } from "@/game/engine";
import { Button } from "../ui/Button";
import { CardView } from "./CardView";
import { useGame } from "./GameContext";
import { cardOptions } from "./flows";
import { usePicker } from "./Picker";
import { Countdown } from "./useClock";

type PromptV = GameView["prompts"][number];

const MODE_LABEL: Record<string, string> = {
  random: "aleatório",
  fighter: "quem luta escolhe",
  helper: "ajudante escolhe primeiro",
};

const KIND_TITLE: Record<string, string> = {
  helpRequest: "Pedido de ajuda",
  helpOffer: "Oferta de ajuda",
  fairySwap: "Truque Feérico",
  chooseLoss: "Escolha o que perder",
  bigOrLevels: "Gigante das Colinas",
  distribute: "Divisão dos tesouros",
  bardo: "Sorte do Bardo",
  loot: "Saquear o corpo",
  charity: "Caridade",
  trade: "Proposta de troca",
  fairyCurse: "Troca Feérica",
  possession: "Possessão",
  debt: "Dívida com o Diabo",
};

function arr(x: unknown): string[] {
  return Array.isArray(x) ? (x as string[]) : [];
}

function MyPrompt({ pr }: { pr: PromptV }) {
  const api = useGame();
  const picker = usePicker();
  const d = pr.data ?? {};
  const answer = (a: Record<string, unknown>) => api.act({ type: "ANSWER", promptId: pr.id, answer: a });
  const deal = d.deal as { count: number; mode: string } | undefined;
  const dealText = deal && deal.count > 0 ? `${deal.count} tesouro(s), ${MODE_LABEL[deal.mode]}` : "sem tesouros";
  const hand = api.me.hand ?? [];

  let body: React.ReactNode = null;
  switch (pr.kind) {
    case "helpRequest":
      body = (
        <>
          <p>
            <b>{api.playerName(String(d.fighterId))}</b> pede sua ajuda. Oferta: {dealText}.
          </p>
          {Boolean(d.threat) && <p className="text-red-300">🔱 Tridente: se recusar, você perde 1 nível!</p>}
          <div className="mt-2 flex gap-2">
            <Button variant="success" onClick={() => answer({ accept: true })}>
              Ajudar
            </Button>
            <Button onClick={() => answer({ accept: false })}>Recusar</Button>
          </div>
        </>
      );
      break;
    case "helpOffer":
      body = (
        <>
          <p>
            <b>{api.playerName(String(d.helperId))}</b> quer ajudar você. Pede: {dealText}.
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="success" onClick={() => answer({ accept: true })}>
              Aceitar
            </Button>
            <Button onClick={() => answer({ accept: false })}>Recusar</Button>
          </div>
        </>
      );
      break;
    case "fairySwap":
      body = (
        <>
          <p>
            <b>{api.playerName(String(d.fairyId))}</b> quer trocar {api.name(String(d.mine))} pelo seu {api.name(String(d.theirs))}.
          </p>
          <div className="mt-2 flex gap-2">
            <Button onClick={() => answer({ block: false })}>Deixar trocar</Button>
            <Button
              variant="danger"
              disabled={hand.length < 2}
              onClick={async () => {
                const cards = await picker.pickMany({ title: "Descarte 2 cartas para impedir", options: cardOptions(hand), count: 2 });
                if (cards) await answer({ block: true, discard: cards });
              }}
            >
              Impedir (descartar 2)
            </Button>
          </div>
        </>
      );
      break;
    case "chooseLoss":
    case "distribute":
    case "charity": {
      const cands = pr.kind === "charity" ? hand : arr(d.candidates ?? d.cards);
      const count = Number(d.count ?? 1);
      const title =
        pr.kind === "charity"
          ? `Escolha ${count} carta(s) para doar/descartar`
          : pr.kind === "distribute"
            ? `Escolha ${count} tesouro(s) para ${api.playerName(String(d.helperId))}`
            : String(d.reason ?? `Escolha ${count}`);
      body = (
        <>
          <p>{title}</p>
          <Button
            className="mt-2"
            variant="primary"
            onClick={async () => {
              const cards = await picker.pickMany({ title, options: cardOptions(cands), count: Math.min(count, cands.length) });
              if (cards) await answer({ cardIds: cards });
            }}
          >
            Escolher
          </Button>
        </>
      );
      break;
    }
    case "bigOrLevels":
      body = (
        <>
          <p>Perca 1 item Grande ou {String(d.levels)} níveis.</p>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={async () => {
                const bigs = arr(d.bigs);
                const v = bigs.length > 1 ? await picker.pick({ title: "Qual item Grande perder?", options: cardOptions(bigs) }) : bigs[0];
                if (v) await answer({ choice: "item", cardId: v });
              }}
            >
              Perder item Grande
            </Button>
            <Button variant="danger" onClick={() => answer({ choice: "levels" })}>
              Perder {String(d.levels)} níveis
            </Button>
          </div>
        </>
      );
      break;
    case "bardo":
      body = (
        <>
          <p>Escolha 1 dos tesouros para descartar.</p>
          <Button
            className="mt-2"
            variant="primary"
            onClick={async () => {
              const v = await picker.pick({ title: "Descartar qual tesouro?", options: cardOptions(arr(d.cards)) });
              if (v) await answer({ cardId: v });
            }}
          >
            Escolher
          </Button>
        </>
      );
      break;
    case "loot":
      body = (
        <>
          <p>
            Pegue 1 item do corpo de <b>{api.playerName(String(d.deadId))}</b>.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              onClick={async () => {
                const v = await picker.pick({ title: "Qual item pegar?", options: cardOptions(arr(d.items)) });
                if (v) await answer({ cardId: v });
              }}
            >
              Escolher item
            </Button>
            <Button onClick={() => answer({ cardId: null })}>Não pegar nada</Button>
          </div>
        </>
      );
      break;
    case "trade":
      body = (
        <>
          <p>
            <b>{api.playerName(String(d.fromId))}</b> propõe uma troca.
          </p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted">Você recebe:</p>
              <div className="flex flex-wrap gap-1">
                {arr(d.give).map((id) => (
                  <CardView key={id} id={id} size="sm" />
                ))}
              </div>
            </div>
            <div>
              <p className="text-muted">Você dá:</p>
              <div className="flex flex-wrap gap-1">
                {arr(d.take).map((id) => (
                  <CardView key={id} id={id} size="sm" />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="success" onClick={() => answer({ accept: true })}>
              Aceitar
            </Button>
            <Button onClick={() => answer({ accept: false })}>Recusar</Button>
          </div>
        </>
      );
      break;
    case "fairyCurse": {
      const victim = api.view.players.find((p) => p.id === d.victimId);
      body = (
        <>
          <p>Troque 1 item seu com {victim?.name} (mesmo slot).</p>
          <Button
            className="mt-2"
            variant="primary"
            onClick={async () => {
              const mine = await picker.pick({ title: "Seu item", options: cardOptions(api.me.equipped) });
              if (!mine) return;
              const theirs = await picker.pick({ title: `Item de ${victim?.name}`, options: cardOptions(victim?.equipped ?? []) });
              if (theirs) await answer({ myItem: mine, theirItem: theirs });
            }}
          >
            Escolher
          </Button>
        </>
      );
      break;
    }
    case "possession":
      body = (
        <>
          <p>O Fantasma possuiu {api.playerName(String(d.victimId))}: escolha 1 item dele para ficar com você.</p>
          <Button
            className="mt-2"
            variant="primary"
            onClick={async () => {
              const v = await picker.pick({ title: "Qual item?", options: cardOptions(arr(d.candidates)) });
              if (v) await answer({ cardId: v });
            }}
          >
            Escolher
          </Button>
        </>
      );
      break;
    case "debt":
      body = (
        <>
          <p>Descarte 1 carta da mão.</p>
          <Button
            className="mt-2"
            variant="primary"
            onClick={async () => {
              const v = await picker.pick({ title: "Descartar qual carta?", options: cardOptions(hand) });
              if (v) await answer({ cardId: v });
            }}
          >
            Escolher
          </Button>
        </>
      );
      break;
  }
  return (
    <div className="rounded-xl border-2 border-gold bg-panel p-3 text-sm shadow-2xl">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-display text-gold-2">{KIND_TITLE[pr.kind] ?? "Decisão"}</p>
        <Countdown deadline={pr.deadline} />
      </div>
      {body}
    </div>
  );
}

export function PromptLayer() {
  const api = useGame();
  const mine = api.view.prompts.filter((p) => p.playerId === api.me.id);
  const others = api.view.prompts.filter((p) => p.playerId !== api.me.id);
  const notices = api.view.notices;
  if (mine.length === 0 && others.length === 0 && notices.length === 0) return null;
  return (
    <div className="fixed bottom-3 right-3 z-40 flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2">
      {notices.map((n) => (
        <div key={n.id} className="rounded-xl border-2 border-sky-500 bg-panel p-3 text-sm shadow-2xl">
          <p className="font-display text-sky-200">{n.text}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {n.cards.map((c) => (
              <CardView key={c} id={c} size="sm" />
            ))}
            {n.cards.length === 0 && <span className="text-muted">Nenhuma carta.</span>}
          </div>
          <div className="mt-2 flex gap-2">
            {n.kind === "owl" ? (
              <>
                <Button size="sm" onClick={() => api.act({ type: "OWL_DECIDE", bottom: false })}>
                  Deixar no topo
                </Button>
                <Button size="sm" onClick={() => api.act({ type: "OWL_DECIDE", bottom: true })}>
                  Mandar para o fundo
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => api.act({ type: "DISMISS_NOTICE", id: n.id })}>
                Ok
              </Button>
            )}
          </div>
        </div>
      ))}
      {mine.map((pr) => (
        <MyPrompt key={pr.id} pr={pr} />
      ))}
      {others.length > 0 && (
        <div className="rounded-xl border border-edge bg-panel/95 p-2 text-xs text-muted">
          {others.map((pr) => (
            <p key={pr.id}>
              ⏳ {api.playerName(pr.playerId)}: {KIND_TITLE[pr.kind] ?? "decidindo"} (<Countdown deadline={pr.deadline} />)
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
