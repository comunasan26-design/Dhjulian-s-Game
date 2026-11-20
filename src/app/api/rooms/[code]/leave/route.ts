import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, handle, requireUser } from "@/lib/http";
import { bumpVersion, loadRoom } from "@/lib/rooms";

/** Sai da sala (só antes da partida começar). */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const user = await requireUser();
  const { code } = await ctx.params;
  const room = await loadRoom(code);
  if (!room.players.some((p) => p.userId === user.id)) return NextResponse.json({ ok: true });
  if (room.status === "PLAYING") throw new HttpError(400, "A partida está em andamento: você pode sair da tela e voltar depois.");
  await db().roomPlayer.delete({ where: { roomId_userId: { roomId: room.id, userId: user.id } } });
  const rest = room.players.filter((p) => p.userId !== user.id);
  if (rest.length === 0) {
    await db().room.delete({ where: { id: room.id } });
    return NextResponse.json({ ok: true });
  }
  if (room.hostId === user.id) {
    await db().room.update({ where: { id: room.id }, data: { hostId: rest[0].userId } });
  }
  await bumpVersion(room.id);
  return NextResponse.json({ ok: true });
});
