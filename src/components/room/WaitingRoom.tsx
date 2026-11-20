"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/Button";
import type { RoomInfo } from "./types";

export function WaitingRoom({
  room,
  meId,
  busy,
  roomCall,
}: {
  room: RoomInfo;
  meId: string;
  busy: boolean;
  roomCall: (path: "join" | "leave" | "start" | "kick" | "bots", body?: unknown) => Promise<boolean>;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === meId;
  const link = typeof window !== "undefined" ? `${window.location.origin}/sala/${room.code}` : "";
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/lobby" className="text-sm text-muted hover:text-ink">
        ← Lobby
      </Link>
      <div className="mt-3 rounded-2xl border border-edge bg-panel p-6">
        <p className="text-sm uppercase tracking-[0.25em] text-gold">Sala de espera</p>
        <h1 className="mt-1 font-display text-3xl">{room.name}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-gold/60 bg-bg px-4 py-2 font-mono text-2xl tracking-[0.4em] text-gold-2">{room.code}</span>
          <Button
            size="sm"
            onClick={async () => {
              await navigator.clipboard?.writeText(link).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Link copiado!" : "Copiar link de convite"}
          </Button>
        </div>
        <h2 className="mt-6 text-sm text-muted">
          Jogadores ({room.players.length + room.bots}/{room.maxPlayers}) — recomendado de 3 a 9
        </h2>
        <ul className="mt-2 space-y-2">
          {room.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-edge bg-panel-2 px-3 py-2">
              <span>
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${p.online || p.id === meId ? "bg-emerald-400" : "bg-stone-600"}`} />
                {p.username}
                {p.id === room.hostId && <span className="ml-2 text-xs text-gold">👑 anfitrião</span>}
                {p.id === meId && <span className="ml-2 text-xs text-muted">(você)</span>}
              </span>
              {isHost && p.id !== meId && (
                <Button size="sm" variant="ghost" onClick={() => roomCall("kick", { userId: p.id })}>
                  Remover
                </Button>
              )}
            </li>
          ))}
          {Array.from({ length: room.bots }, (_, i) => (
            <li key={`bot${i}`} className="flex items-center justify-between rounded-lg border border-dashed border-edge bg-panel-2/60 px-3 py-2">
              <span>
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-sky-400" />
                Bot {i + 1} <span className="text-xs text-muted">(controlado pelo computador)</span>
              </span>
            </li>
          ))}
        </ul>
        {isHost && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy || room.players.length + room.bots >= room.maxPlayers} onClick={() => roomCall("bots", { delta: 1 })}>
              🤖 Adicionar bot
            </Button>
            <Button size="sm" variant="ghost" disabled={busy || room.bots === 0} onClick={() => roomCall("bots", { delta: -1 })}>
              Remover bot
            </Button>
            <span className="text-xs text-muted">Bots jogam para vencer: sobem de nível, atrapalham humanos e o líder.</span>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {isHost ? (
            <Button variant="primary" size="lg" disabled={busy || room.players.length + room.bots < 2} onClick={() => roomCall("start")}>
              ▶ Começar partida
            </Button>
          ) : (
            <p className="text-sm text-muted">Aguardando o anfitrião começar a partida…</p>
          )}
          <Button
            variant="ghost"
            onClick={async () => {
              if (await roomCall("leave")) router.push("/lobby");
            }}
          >
            Sair da sala
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted">
          Ao começar, cada jogador recebe raça e classe aleatórias, 4 cartas de Porta e 4 de Tesouro. Quem tirar o maior d6 começa.
        </p>
      </div>
    </main>
  );
}
