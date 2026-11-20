import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HttpError, handle, readJson, requireUser } from "@/lib/http";
import { MAX_PLAYERS, MIN_PLAYERS, ONLINE_WINDOW_MS, makeCode } from "@/lib/rooms";

export const dynamic = "force-dynamic";

/** Lista salas abertas e as salas do usuário (para reconectar). */
export const GET = handle(async () => {
  const user = await requireUser();
  const now = Date.now();
  const [open, mine] = await Promise.all([
    db().room.findMany({
      where: { status: "LOBBY" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { players: { select: { userId: true, lastSeenAt: true } }, host: { select: { username: true } } },
    }),
    db().room.findMany({
      where: { players: { some: { userId: user.id } }, status: { in: ["LOBBY", "PLAYING"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { players: { select: { userId: true, lastSeenAt: true } }, host: { select: { username: true } } },
    }),
  ]);
  const map = (r: (typeof open)[number]) => ({
    code: r.code,
    name: r.name,
    status: r.status,
    host: r.host.username,
    players: r.players.length + r.bots,
    online: r.players.filter((p) => now - p.lastSeenAt.getTime() < ONLINE_WINDOW_MS).length,
    maxPlayers: r.maxPlayers,
    isMember: r.players.some((p) => p.userId === user.id),
    updatedAt: r.updatedAt.toISOString(),
  });
  return NextResponse.json({ open: open.map(map), mine: mine.map(map) });
});

/** Cria uma sala e entra nela como anfitrião. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const name = String(body.name ?? "").trim().slice(0, 40) || `Mesa de ${user.username}`;
  const maxPlayers = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Number(body.maxPlayers) || 6));
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    try {
      const room = await db().room.create({
        data: {
          code,
          name,
          maxPlayers,
          hostId: user.id,
          players: { create: { userId: user.id, seat: 0 } },
        },
      });
      return NextResponse.json({ code: room.code });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }
  throw new HttpError(500, "Não foi possível gerar um código de sala.");
});
