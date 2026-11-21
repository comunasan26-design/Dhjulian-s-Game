import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { joinQueue, leaveQueue, pollQueue } from "@/lib/ranked";

export const dynamic = "force-dynamic";

/** Situação na fila (chamado a cada ~2 s enquanto procura partida; também faz o pareamento). */
export const GET = handle(async () => {
  const user = await requireUser();
  return NextResponse.json(await pollQueue(user.id));
});

/** Entra na fila do modo ranqueado (com ?sair=1, sai dela: usado ao fechar a aba). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (new URL(req.url).searchParams.get("sair")) {
    await leaveQueue(user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(await joinQueue(user.id));
});

/** Sai da fila. */
export const DELETE = handle(async () => {
  const user = await requireUser();
  await leaveQueue(user.id);
  return NextResponse.json({ ok: true });
});
