import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, handle, readJson, requireUser } from "@/lib/http";
import { MAX_PLAYERS, loadRoom, payloadFor } from "@/lib/rooms";

/** Anfitrião adiciona (+1) ou remove (-1) bots na sala de espera, ou muda a dificuldade deles ({ skill }). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const user = await requireUser();
  const { code } = await ctx.params;
  const body = await readJson(req);
  const room = await loadRoom(code);
  if (room.hostId !== user.id) throw new HttpError(403, "Só o anfitrião pode mudar os bots.");
  if (room.status !== "LOBBY") throw new HttpError(400, "A partida já começou.");
  if (body.skill !== undefined) {
    const botSkill = Math.min(30, Math.max(1, Math.round(Number(body.skill) || 20)));
    await db().room.update({ where: { id: room.id }, data: { botSkill, version: { increment: 1 } } });
    return NextResponse.json(payloadFor(await loadRoom(code), user.id));
  }
  const delta = Number(body.delta) > 0 ? 1 : -1;
  const bots = room.bots + delta;
  if (bots < 0) throw new HttpError(400, "Não há bots para remover.");
  if (room.players.length + bots > Math.min(room.maxPlayers, MAX_PLAYERS)) throw new HttpError(400, "A sala está cheia.");
  await db().room.update({ where: { id: room.id }, data: { bots, version: { increment: 1 } } });
  return NextResponse.json(payloadFor(await loadRoom(code), user.id));
});
