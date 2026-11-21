import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, requireUser } from "@/lib/http";
import { myRankedResult } from "@/lib/ranked";
import { ratingLabel } from "@/lib/rating";

export const dynamic = "force-dynamic";

/** Rating do usuário e, com ?code=, o resultado dele naquela partida ranqueada. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const code = new URL(req.url).searchParams.get("code");
  const u = await db().user.findUnique({ where: { id: user.id }, select: { rating: true, rankedGames: true } });
  const rating = u?.rating ?? 1200;
  const games = u?.rankedGames ?? 0;
  return NextResponse.json({
    rating: Math.round(rating),
    games,
    label: ratingLabel(rating, games),
    match: code ? await myRankedResult(code, user.id) : null,
  });
});
