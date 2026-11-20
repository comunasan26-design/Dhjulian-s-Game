import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, handle, readJson, requireUser } from "@/lib/http";
import { bumpVersion, loadRoom } from "@/lib/rooms";

/** Anfitrião remove alguém da sala de espera. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const user = await requireUser();
  const { code } = await ctx.params;
  const body = await readJson(req);
  const room = await loadRoom(code);
  if (room.hostId !== user.id) throw new HttpError(403, "Só o anfitrião pode remover jogadores.");
  if (room.status !== "LOBBY") throw new HttpError(400, "A partida já começou.");
  const target = String(body.userId ?? "");
  if (target === user.id) throw new HttpError(400, "Use “Sair da sala”.");
  await db().roomPlayer.deleteMany({ where: { roomId: room.id, userId: target } });
  await bumpVersion(room.id);
  return NextResponse.json({ ok: true });
});
