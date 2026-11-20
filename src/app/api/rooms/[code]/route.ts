import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { assertMember, loadRoom, payloadFor, touchPresence } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const user = await requireUser();
  const { code } = await ctx.params;
  const room = await loadRoom(code);
  assertMember(room, user.id);
  await touchPresence(room.id, user.id);
  return NextResponse.json(payloadFor(room, user.id));
});
