import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/http";
import { payloadFor, startGame } from "@/lib/rooms";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const user = await requireUser();
  const { code } = await ctx.params;
  const room = await startGame(code, user.id);
  return NextResponse.json(payloadFor(room, user.id));
});
