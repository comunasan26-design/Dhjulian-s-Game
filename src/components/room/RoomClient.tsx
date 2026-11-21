"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Board } from "../game/Board";
import { Button } from "../ui/Button";
import { useRoom } from "./useRoom";
import { WaitingRoom } from "./WaitingRoom";
import { RankedResult } from "../ranked/RankedResult";

export function RoomClient({ code, meId }: { code: string; meId: string }) {
  const { payload, needsJoin, fatal, toast, setToast, conn, busy, act, roomCall } = useRoom(code);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  let content: React.ReactNode;
  if (fatal) {
    content = (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-lg">{fatal}</p>
        <Link href="/lobby" className="text-gold underline">
          Voltar ao lobby
        </Link>
      </main>
    );
  } else if (needsJoin) {
    content = (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-lg">Você ainda não está na sala {code}.</p>
        <Button variant="primary" size="lg" disabled={busy} onClick={() => roomCall("join")}>
          Entrar na sala
        </Button>
        <Link href="/lobby" className="text-sm text-muted underline">
          Voltar ao lobby
        </Link>
      </main>
    );
  } else if (!payload) {
    content = <main className="flex flex-1 items-center justify-center text-muted">Carregando a sala…</main>;
  } else if (!payload.game) {
    content = <WaitingRoom room={payload.room} meId={meId} busy={busy} roomCall={roomCall} />;
  } else {
    content = <Board view={payload.game} roomName={payload.room.name} code={payload.room.code} conn={conn} busy={busy} act={act} />;
  }

  return (
    <>
      {content}
      {payload?.room.ranked && payload.game?.phase === "FINISHED" && <RankedResult code={payload.room.code} />}
      {toast && (
        <div className="fixed left-1/2 top-3 z-[60] max-w-[90vw] -translate-x-1/2 rounded-lg border border-blood bg-panel px-4 py-2 text-sm text-red-200 shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
