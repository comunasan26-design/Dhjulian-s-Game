import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, handle, requireUser } from "@/lib/http";
import { bumpVersion, loadRoom, payloadFor } from "@/lib/rooms";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const user = await requireUser();
  const { code } = await ctx.params;
  const room = await loadRoom(code);
  if (room.players.some((p) => p.userId === user.id)) {
    // Já é membro: reconexão
    await db().roomPlayer.update({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      data: { lastSeenAt: new Date() },
    });
    await bumpVersion(room.id);
    return NextResponse.json(payloadFor(await loadRoom(code), user.id));
  }
  if (room.status !== "LOBBY") throw new HttpError(400, "Essa partida já começou.");
  if (room.players.length >= room.maxPlayers) throw new HttpError(400, "A sala está cheia.");
  const seat = Math.max(-1, ...room.players.map((p) => p.seat)) + 1;
  try {
    await db().roomPlayer.create({ data: { roomId: room.id, userId: user.id, seat } });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
  }
  await bumpVersion(room.id);
  return NextResponse.json(payloadFor(await loadRoom(code), user.id));
});
