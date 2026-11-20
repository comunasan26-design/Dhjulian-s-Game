import { NextResponse } from "next/server";
import type { Action } from "@/game/engine";
import { HttpError, handle, readJson, requireUser } from "@/lib/http";
import { payloadFor, performAction } from "@/lib/rooms";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const user = await requireUser();
  const { code } = await ctx.params;
  const body = await readJson(req);
  const action = body.action as Action | undefined;
  if (!action || typeof action !== "object" || typeof action.type !== "string") throw new HttpError(400, "Ação inválida.");
  const room = await performAction(code, user.id, action);
  return NextResponse.json(payloadFor(room, user.id));
});
